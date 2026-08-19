"""Constrained caption revision executed by OpenAI from EngageVision guidance."""

from __future__ import annotations

import base64
import io
import json
import os

from PIL import Image
from pydantic import BaseModel, Field

from openai_service import DEFAULT_TEXT_MODEL


ALLOWED_TONES = {"natural", "warm", "confident", "informative", "reflective"}
ALLOWED_GOALS = {"reactions", "conversation", "awareness", "saves", "shares", "support", "inform"}
ALLOWED_LANGUAGES = {"en", "he", "ar"}


def is_caption_writer_configured() -> bool:
    return bool(os.getenv("OPENAI_API_KEY", "").strip())


def _clean_list(value, limit: int = 4) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()][:limit]


def _visual_reference(image: Image.Image) -> str:
    """Create a bounded, low-bandwidth visual reference for caption grounding."""
    prepared = image.convert("RGB")
    prepared.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    payload = io.BytesIO()
    prepared.save(payload, format="JPEG", quality=82, optimize=True)
    encoded = base64.b64encode(payload.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


class CaptionCandidatePayload(BaseModel):
    improved_caption: str = Field(min_length=1, max_length=2200)
    editorial_rationale: str = Field(min_length=1, max_length=600)
    goal_execution: str = Field(min_length=1, max_length=400)
    change_summary: list[str] = Field(min_length=2, max_length=4)
    safety_note: str = Field(min_length=1, max_length=500)


class CaptionRevisionPayload(BaseModel):
    candidates: list[CaptionCandidatePayload] = Field(min_length=3, max_length=4)


def revise_caption_candidates(
    original_caption: str,
    image: Image.Image,
    post_type: str,
    tone: str,
    goal: str,
    language: str,
    guidance: list[dict],
    max_characters: int = 2200,
    optimization_round: int = 1,
    model_feedback: list[dict] | None = None,
) -> list[dict]:
    """Return several factual, publication-ready alternatives in one API call."""
    if not is_caption_writer_configured():
        raise RuntimeError("OPENAI_API_KEY is not configured")
    caption = original_caption.strip()
    if not caption:
        raise ValueError("A caption is required")
    tone = tone if tone in ALLOWED_TONES else "natural"
    goal = goal if goal in ALLOWED_GOALS else "conversation"
    language = language if language in ALLOWED_LANGUAGES else "en"

    goal_definitions = {
        "reactions": "Make the real visual subject and positive value immediately clear; do not ask directly for likes or use engagement bait.",
        "conversation": "Invite one genuine, easy-to-answer response only when a question fits the subject.",
        "awareness": "Make the issue or takeaway immediately understandable; do not add claims or alarmist language.",
        "saves": "Make the caption useful as a future reference through clear structure; mention saving only if that utility is real.",
        "shares": "Make the message easy to pass on; invite sharing only when it would genuinely help the intended audience.",
        "support": "State one proportionate, factually supported next step; never invent a donation, link, event, or urgency.",
        "inform": "Lead with the answer or main fact, then add only the context needed to understand it.",
    }
    tone_definitions = {
        "natural": "Plain, human and specific; avoid marketing language.",
        "warm": "Kind and approachable without inventing emotion or intimacy.",
        "confident": "Direct and clear without certainty beyond the available facts.",
        "informative": "Structured and precise, with the main takeaway first.",
        "reflective": "Thoughtful and measured without fabricating feelings or personal history.",
    }

    from openai import OpenAI

    payload = {
        "original_caption": caption,
        "content_style": post_type or "general",
        "requested_tone": tone,
        "requested_tone_definition": tone_definitions[tone],
        "communication_goal": goal,
        "communication_goal_definition": goal_definitions[goal],
        "output_language": {"en": "English", "he": "Hebrew", "ar": "Arabic"}[language],
        "maximum_characters": max_characters,
        "optimization_round": max(1, int(optimization_round)),
        "optimization_instruction": (
            "Use the measured model feedback from the prior candidates. Preserve factual "
            "safety, avoid structures that scored lower, and apply the same supplied "
            "structured directions with substantially different safe wording."
            if optimization_round > 1 else
            "Produce the first diverse set of controlled editorial candidates."
        ),
        "prior_candidate_model_feedback": list(model_feedback or [])[:4],
        "preferred_length_range": {
            "minimum_characters": min(max_characters, max(80, int(len(caption) * 0.85))),
            "maximum_characters": min(max_characters, max(220, int(len(caption) * 1.45))),
        },
        "engagevision_guidance": [
            {
                "title": item.get("title"),
                "action": item.get("action"),
                "evidence": item.get("evidence"),
            }
            for item in guidance
        ],
    }
    instructions = """
Role: You are the controlled editorial execution layer for a research-based
social-post assistant.

Goal: produce four materially different, publication-ready caption candidates
that preserve the author's facts and voice while executing only the supplied
structured EngageVision guidance. The recommendation engine—not you—has chosen
what may change. Tone and communication goal constrain how you write; they do
not authorize a new optimization direction. The image is only a factual visual
reference. A separate frozen prediction pipeline evaluates every candidate and
accepts or rejects the result.

Success criteria:
- The first line makes the real subject or takeaway immediately clear.
- The caption follows one coherent flow and ends cleanly.
- Every factual statement is traceable to the original caption or an
  unambiguous visible detail.
- The selected goal is executed naturally, without engagement bait.
- The final wording is fluent and professional in output_language.
- The candidates must not be cosmetic paraphrases of each other. Vary the
  opening, information order, sentence rhythm and goal execution while keeping
  exactly the same factual claim ledger.
- Do not optimize any dimension that is absent from engagevision_guidance.
- Do not add a CTA or new hashtags unless a structured guidance item explicitly
  requests that type of change. Tone and communication_goal alone are not such
  a request.
- Follow optimization_instruction. When optimization_round is greater than
  one, use prior_candidate_model_feedback as directional evidence: retain only
  structural patterns associated with a stronger model score, avoid patterns
  associated with a lower score, and explore a clearly different structure
  while preserving exactly the same facts. Model feedback ranks candidates;
  it never authorizes invented claims or engagement bait.

Hard rules:
- Never invent a person, place, event, statistic, experience, feeling, quote,
  benefit, urgency, link, offer, or claim that is absent from the original.
- Preserve the author's meaning and language. Do not turn a neutral post into
  a personal testimony. Do not use clichés such as "this means so much" unless
  that meaning is already stated.
- Use the image only for unambiguous visible context. Never infer identity,
  relationship, exact location, diagnosis, motive, private circumstance or an
  event that is not established by the original caption.
- Write every candidate's improved_caption, every change_summary item, and
  safety_note entirely in output_language. If the original uses another
  language, translate only as needed while preserving meaning, names, numbers,
  hashtags and factual claims.
- Improve structure, clarity, specificity and natural flow. A hook or call to
  action is optional and must fit the supplied goal without pressure.
- Make the first line immediately understandable. It should name the real
  subject, moment, or takeaway instead of using a generic motivational hook.
- Use short readable paragraphs. Remove filler, repeated ideas, exaggerated
  adjectives, engagement bait, and empty phrases such as "you won't believe".
- A call to action is allowed only when engagevision_guidance explicitly asks
  for one and it naturally advances communication_goal. Use one action at most
  and never demand engagement.
- Add or replace hashtags only when engagevision_guidance explicitly asks for
  a tag change. Otherwise preserve existing specific tags and never invent a
  branded, campaign, location, or identity tag.
- Stay near preferred_length_range unless the original is too short to be
  understood. Do not lengthen merely to sound more polished.
- Stay under the supplied character limit.
- Before answering, silently verify a claim ledger: every name, number, event,
  relationship, outcome, feeling and promise in the revision must be traceable
  to the original caption. If it is not traceable, remove it.
- Each editorial_rationale must briefly explain how the model recommendation
  was executed; goal_execution must state how the communication goal was
  respected without choosing a new direction. Both must be written in
  output_language.
- Return three or four distinct candidates in the exact structured schema.
- Return the exact structured fields requested by the response schema.
""".strip()

    client = OpenAI(timeout=60.0, max_retries=1)
    response = client.responses.parse(
        model=os.getenv("OPENAI_TEXT_MODEL", DEFAULT_TEXT_MODEL).strip() or DEFAULT_TEXT_MODEL,
        text_format=CaptionRevisionPayload,
        max_output_tokens=2600,
        store=False,
        # The Responses API now nests verbosity under the text configuration.
        # Keeping it at the former top level is rejected with
        # `unsupported_parameter`, even though older SDK signatures still
        # expose that compatibility argument.
        text={"verbosity": "low"},
        instructions=instructions,
        input=[
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": json.dumps(payload, ensure_ascii=False)},
                    {"type": "input_image", "image_url": _visual_reference(image), "detail": "low"},
                ],
            }
        ],
    )
    parsed = response.output_parsed
    if parsed is None:
        raise RuntimeError("The caption writer returned no structured result")
    candidates: list[dict] = []
    seen: set[str] = set()
    fallback_safety = {
        "en": "Review names, claims and links before publishing.",
        "he": "עברו על שמות, טענות וקישורים לפני הפרסום.",
        "ar": "راجع الأسماء والادعاءات والروابط قبل النشر.",
    }[language]
    for candidate in parsed.candidates:
        improved = candidate.improved_caption.strip()
        normalized = " ".join(improved.lower().split())
        if not improved or len(improved) > max_characters or normalized in seen:
            continue
        seen.add(normalized)
        candidates.append({
            "improved_caption": improved,
            "editorial_rationale": str(candidate.editorial_rationale).strip(),
            "goal_execution": str(candidate.goal_execution).strip(),
            "change_summary": _clean_list(candidate.change_summary),
            "safety_note": str(candidate.safety_note or fallback_safety).strip(),
        })
    if not candidates:
        raise RuntimeError("The caption writer returned no valid candidates")
    return candidates


def revise_caption(
    original_caption: str,
    image: Image.Image,
    post_type: str,
    tone: str,
    goal: str,
    language: str,
    guidance: list[dict],
    max_characters: int = 2200,
) -> dict:
    """Backward-compatible helper returning the first generated candidate."""
    return revise_caption_candidates(
        original_caption,
        image,
        post_type,
        tone,
        goal,
        language,
        guidance,
        max_characters,
    )[0]
