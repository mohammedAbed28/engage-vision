"""Structured, evidence-labelled guidance for the EngageVision product.

The frozen predictor remains the decision engine.  This module translates its
input signals, local counterfactual tests and (when available) aggregate
historical comparisons into ranked editorial actions.  It deliberately keeps
causal language out of the product: a recommendation is a model/data signal,
not a promise of future engagement.
"""

from __future__ import annotations

import math
import re
from typing import Iterable


CAPTION_CATEGORIES = {"caption", "message", "tags"}


def _number(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def _add(
    items: list[dict],
    *,
    key: str,
    category: str,
    priority: int,
    title: str,
    action: str,
    evidence: str,
    basis: str,
    source: str = "model_feature_signal",
    model_directed: bool = True,
    impact_points: float | None = None,
    validation: str = (
        "Change only this element, evaluate the revised post once, and keep the change only if the measured outlook improves without changing the intended meaning."
    ),
) -> None:
    if any(item["id"] == key for item in items):
        return
    items.append(
        {
            "id": key,
            "category": category,
            "priority": max(1, min(int(priority), 3)),
            "title": title,
            "action": action,
            "evidence": evidence,
            "basis": basis,
            "source": source,
            "model_directed": model_directed,
            "impact_points": impact_points,
            "validation": validation,
        }
    )


def build_professional_guidance(
    prepared_post_input: dict,
    prediction_result: dict,
    image_evidence: Iterable[dict] = (),
    historical_context: dict | None = None,
    editorial_goal: str | None = None,
    editorial_tone: str | None = None,
) -> tuple[list[dict], list[str]]:
    """Return ranked recommendations and grounded strengths for one draft."""
    items: list[dict] = []
    strengths: list[str] = []
    post_type = str(
        prediction_result.get("predicted_post_type")
        or prepared_post_input.get("predicted_post_type")
        or prepared_post_input.get("post_type")
        or "general"
    )
    caption = str(prepared_post_input.get("text") or "").strip()
    observed_words = float(len(re.findall(r"[^\W_]+(?:['’־-][^\W_]+)*", caption, re.UNICODE)))
    feature_words = _number(prepared_post_input.get("word_count")) or 0.0
    words = max(observed_words, feature_words)
    language = str(prepared_post_input.get("language") or "en").lower()
    emotion = _number(prepared_post_input.get("emotion_strength"))
    similarity = _number(prepared_post_input.get("text_image_similarity"))
    hashtag_count = _number(prepared_post_input.get("hashtag_count")) or 0.0
    probability = _number(prediction_result.get("calibrated_probability")) or 0.0
    threshold = _number(prediction_result.get("threshold_used")) or 0.5

    historical_context = historical_context or {}
    historical = historical_context.get("summary") or {}
    best_time = historical_context.get("best_time")
    historical_sample = int(historical_context.get("sample_size") or 0)
    avg_words_high = _number(historical.get("avg_word_count_high"))
    avg_emotion_high = _number(historical.get("avg_emotion_strength_high"))
    avg_similarity_high = _number(historical.get("avg_similarity_high"))

    goal_actions = {
        "conversation": (
            "goal_conversation", "Open one genuine conversation",
            "End with one easy, relevant question that can be answered from personal perspective without pressure.",
            "The user selected conversation as the communication goal.",
        ),
        "reactions": (
            "goal_reactions", "Make the value clear at first glance",
            "Lead with the real subject and the most concrete positive value; do not ask for likes or use engagement bait.",
            "The user selected reactions as the communication goal.",
        ),
        "awareness": (
            "goal_awareness", "Make the message immediately understandable",
            "State the issue or takeaway in the opening, then add only the context needed to understand why it matters.",
            "The user selected awareness as the communication goal.",
        ),
        "saves": (
            "goal_saves", "Give the reader something worth returning to",
            "Structure the caption around one useful takeaway or short set of steps, using only facts already present in the post.",
            "The user selected saves as the communication goal.",
        ),
        "shares": (
            "goal_shares", "Make the takeaway easy to pass on",
            "Express one clear, self-contained message that another person can understand without extra context.",
            "The user selected shares as the communication goal.",
        ),
        "support": (
            "goal_support", "Offer one safe and proportionate next step",
            "End with one factual action the reader can take; do not invent a link, campaign, urgency or promised result.",
            "The user selected support as the communication goal.",
        ),
        "inform": (
            "goal_inform", "Lead with the answer, then explain",
            "Put the main fact or conclusion first and follow it with the minimum context needed for accurate understanding.",
            "The user selected information as the communication goal.",
        ),
    }
    goal_direction = goal_actions.get(str(editorial_goal or "").lower())
    if goal_direction:
        key, title, action, evidence = goal_direction
        tone_note = f" Use a {editorial_tone} tone." if editorial_tone else ""
        _add(
            items,
            key=key,
            category="caption",
            priority=1,
            title=title,
            action=action + tone_note,
            evidence=evidence,
            basis="User-selected editorial goal",
            source="user_constraint",
            model_directed=False,
            validation="Apply only this goal-focused change, preserve every fact, and keep it only after the complete revision is evaluated again.",
        )

    # Caption length is treated as context sufficiency, never as "longer is better".
    if words <= 8:
        _add(
            items,
            key="caption_context",
            category="caption",
            priority=1,
            title="Give the reader one clear piece of context",
            action=(
                "Add one specific sentence that explains what is happening, why it matters, "
                "or what the viewer should notice. Keep every fact grounded in the real post."
            ),
            evidence=f"The current caption contains {int(words)} words, so the message may be understood only after extra effort.",
            basis="Draft signal",
            validation="Add only the missing context, re-evaluate the caption, and confirm that no person, event, result, or emotion was invented.",
        )
    elif avg_words_high and words < avg_words_high * 0.55:
        _add(
            items,
            key="caption_context",
            category="caption",
            priority=2,
            title="Add context without making the caption heavy",
            action="Add one concise sentence that connects the opening to the post's main takeaway.",
            evidence=(
                f"This caption has {int(words)} words; successful posts in the same content group "
                f"average about {int(round(avg_words_high))} words across {historical_sample} comparable historical posts."
            ),
            basis="Aggregate comparison",
            validation="Add one concise context sentence, re-evaluate once, and keep it only if clarity and the measured outlook improve together.",
        )
    else:
        strengths.append("The caption provides enough space to communicate a complete idea.")

    if language == "en" and emotion is not None and (
        emotion < 0.20 or (avg_emotion_high is not None and emotion < avg_emotion_high * 0.70)
    ):
        _add(
            items,
            key="caption_voice",
            category="caption",
            priority=2,
            title="Replace generic wording with a human point of view",
            action=(
                "Use one concrete, natural sentence that expresses the real perspective behind the post. "
                "Avoid invented emotion, slogans, or exaggerated claims."
            ),
            evidence="The language signal is less expressive than the reference pattern for this type of post.",
            basis="Draft + aggregate signal" if avg_emotion_high is not None else "Draft signal",
            validation="Rewrite only one sentence in a more natural voice, then compare the before/after outlook while checking that every claim remains factual.",
        )
    elif language == "en" and emotion is not None:
        strengths.append("The wording carries a clear enough emotional tone for this content style.")

    if similarity is not None and (
        similarity < 0.20 or (avg_similarity_high is not None and similarity < avg_similarity_high * 0.70)
    ):
        _add(
            items,
            key="message_alignment",
            category="message",
            priority=1,
            title="Make the caption and image tell the same story",
            action=(
                "Mention the visible subject or moment in the opening line, then connect it directly "
                "to the post's intended takeaway."
            ),
            evidence="The caption-to-image alignment signal is below the reference pattern for similar successful posts.",
            basis="Multimodal signal",
            validation="Change only the opening line to name the visible subject, then re-evaluate and verify that the caption still describes the actual image.",
        )
    elif similarity is not None:
        strengths.append("The image and caption communicate a reasonably consistent message.")

    if words > 0 and hashtag_count / words > 0.30:
        _add(
            items,
            key="hashtag_balance",
            category="tags",
            priority=2,
            title="Let the message lead, not the hashtag list",
            action="Keep only the most specific tags and move them after a complete, readable caption.",
            evidence=f"The draft uses {int(hashtag_count)} hashtags across {int(words)} words.",
            basis="Draft signal",
            validation="Remove generic tags first, keep the caption unchanged, and compare one controlled re-evaluation.",
        )

    if post_type in {"awareness", "campaign", "activism", "support"}:
        _add(
            items,
            key="clear_next_step",
            category="caption",
            priority=2,
            title="End with one proportionate next step",
            action=(
                "Choose one action that genuinely fits the post—comment, save, share, learn more, "
                "or participate—and write it in a natural closing line."
            ),
            evidence="This content style benefits from a clear purpose, but the action must remain accurate and non-coercive.",
            basis="Content-format rule",
            source="content_rule",
            model_directed=False,
            validation="Add one proportionate next step, re-evaluate once, and remove it if it feels forced or changes the post's original purpose.",
        )
    elif post_type == "educational_info":
        _add(
            items,
            key="educational_structure",
            category="caption",
            priority=2,
            title="Lead with the takeaway",
            action="Use a short hook, one clear explanation, and a final save-or-share prompt only if it is useful.",
            evidence="Educational posts are easier to scan when the main learning point appears early.",
            basis="Content-format rule",
            source="content_rule",
            model_directed=False,
            validation="Move the main takeaway to the opening, keep all facts unchanged, and compare the revised outlook once.",
        )

    for visual in image_evidence:
        visual_basis = str(visual.get("basis", "Model sensitivity test"))
        _add(
            items,
            key=str(visual["id"]),
            category="visual",
            priority=int(visual.get("priority", 2)),
            title=str(visual["title"]),
            action=str(visual["action"]),
            evidence=str(visual["evidence"]),
            basis=visual_basis,
            source=(
                "model_counterfactual"
                if visual_basis == "Model sensitivity test"
                else "controlled_experiment"
            ),
            model_directed=True,
            impact_points=_number(visual.get("impact_points")),
            validation=str(visual.get("validation") or "Apply only this visual adjustment, compare the before/after outlook, and keep the original whenever the score does not improve."),
        )

    if best_time:
        hour = int(best_time["post_hour"])
        sample = int(best_time["n"])
        lift_points = float(best_time.get("lift") or 0.0) * 100.0
        _add(
            items,
            key="historical_timing",
            category="timing",
            priority=3,
            title="Test a historically stronger publishing window",
            action=f"If it suits your audience, test publishing close to {hour:02d}:00 and compare results over several posts.",
            evidence=(
                f"This hour contains {sample} comparable historical posts and its observed High-Engagement rate "
                f"was {lift_points:.1f} percentage points above the broader reference group."
            ),
            basis="Aggregate historical pattern",
            source="historical_cohort",
            model_directed=True,
            validation="Test this window across at least five comparable posts and compare the median result with your usual publishing window.",
        )

    historical_hashtags = historical_context.get("hashtags") or []
    if historical_hashtags:
        tag_sample = int(historical_context.get("hashtag_sample_size") or historical_sample)
        _add(
            items,
            key="historical_tags",
            category="tags",
            priority=3,
            title="Test a small set of historically distinctive tags",
            action="Use only the tags that accurately describe this post: " + " ".join(historical_hashtags[:5]),
            evidence=(
                f"These tags passed minimum-support and smoothed-lift checks across {tag_sample} comparable historical captions; "
                "generic popularity tags were excluded."
            ),
            basis="Aggregate historical pattern",
            source="historical_cohort",
            model_directed=True,
            validation="Use two or three relevant tags across several comparable posts and compare the median result with posts that use your usual tag set.",
        )

    margin = probability - threshold
    if prediction_result.get("predicted_label") == "High Engagement":
        strengths.insert(0, "The combined image and caption signals are above the current decision threshold.")
    elif abs(margin) <= 0.05:
        strengths.insert(0, "The draft is close to the current decision boundary, so a focused revision is worth testing.")
    else:
        strengths.insert(0, "The post was evaluated successfully across both visual and caption signals.")

    if not items:
        _add(
            items,
            key="preserve_draft",
            category="general",
            priority=3,
            title="Preserve the current direction",
            action="Make only normal proofreading changes; no evidence-backed structural change was identified.",
            evidence="No tested draft signal produced a sufficiently clear improvement direction.",
            basis="Combined review",
            source="no_change_decision",
            model_directed=False,
            validation="Proofread only; do not introduce a structural change unless a new measured signal supports it.",
        )

    # Lower priority number comes first; within a tier, measured impact wins.
    items.sort(key=lambda item: (item["priority"], -(item.get("impact_points") or 0.0), item["title"]))
    return items[:8], list(dict.fromkeys(strengths))[:4]


def caption_guidance(items: Iterable[dict]) -> list[dict]:
    """Return only model/data-directed instructions for AI execution.

    Tone and communication goal are retained as writing constraints by the
    caller, but they are not optimization evidence and therefore cannot choose
    the change that the AI makes.  Tags are included because they are part of
    the generated caption when the recommendation engine has measured or
    historical support for them.
    """
    return [
        item
        for item in items
        if item.get("category") in CAPTION_CATEGORIES
        and item.get("model_directed") is True
    ][:4]
