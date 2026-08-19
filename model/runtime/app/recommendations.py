"""
Human-readable explanation and improvement recommendations for a single
prediction. These are rule-based heuristics layered on top of the model's
output and input features — they do not affect success_probability or
predicted_label in any way, so they can be freely edited/extended without
touching (or retraining) the predictive model itself.

Wording is deliberately conversational ("your image looks a bit muted")
rather than technical ("low colorfulness detected") — this is what the
app actually shows a normal user, who has no reason to know what
"colorfulness" or "content_cluster" mean.
"""

from typing import Optional

from app.clip_layer import strategy_for_post_type

# Heuristic thresholds for the recommendation rules below. These are
# reasonable defaults for a content-improvement prototype, not values
# tuned against the model's own training data.
LOW_TEXT_IMAGE_SIMILARITY = 0.20
LOW_EMOTION_STRENGTH = 0.20
HIGH_HASHTAG_RATIO = 0.30

_FRIENDLY_CONTENT_GROUP = {
    "personal_story": "personal, authentic stories",
    "awareness": "awareness and advocacy posts",
    "campaign": "campaign and call-to-action posts",
    "activism": "activism and community-action posts",
    "support": "supportive, caring posts",
    "memorial": "memorial and remembrance posts",
    "educational_info": "educational, informative posts",
    "emotional_quote": "reflective quotes and sayings",
    "general": "general social posts",
}


def friendly_content_group_label(predicted_post_type: Optional[str]) -> str:
    """Turns a post type into a natural-language "content group" phrase
    for display, e.g. instead of a raw cluster id like `content_cluster=4`,
    the app says "Similar content group: personal, authentic stories"."""
    if not predicted_post_type:
        return "posts with a similar style to yours"
    return _FRIENDLY_CONTENT_GROUP.get(predicted_post_type, f"posts similar to '{predicted_post_type}' content")


def build_explanation(predicted_label: str, calibrated_probability: float, content_cluster: str,
                       cluster_high_rate: Optional[float], predicted_post_type: Optional[str]) -> str:
    pct = round(calibrated_probability * 100, 1)
    group_label = friendly_content_group_label(predicted_post_type)

    if predicted_label == "High Engagement":
        parts = [f"This post looks strong — we estimate about a {pct}% chance of High Engagement."]
    else:
        parts = [f"This post may struggle to stand out — we estimate about a {pct}% chance of High Engagement."]

    if cluster_high_rate is not None:
        parts.append(
            f"It's grouped with {group_label}, which historically reach High Engagement about "
            f"{round(cluster_high_rate * 100, 1)}% of the time on this account."
        )
    return " ".join(parts)


def build_recommendations(predicted_label: str, features: dict, content_cluster: str,
                           cluster_high_rate: Optional[float], global_high_rate: Optional[float],
                           predicted_post_type: Optional[str], clip_recommendation_rules: dict) -> list:
    if predicted_label == "High Engagement":
        return [
            "This post already looks strong for this account — no changes needed, but keep using "
            "this style and posting habits."
        ]

    recommendations = []

    text_image_similarity = features.get("text_image_similarity")
    if text_image_similarity is not None and text_image_similarity < LOW_TEXT_IMAGE_SIMILARITY:
        recommendations.append(
            "The image and caption may not communicate the same message clearly — try making the "
            "visual match the caption more directly."
        )

    emotion_strength = features.get("emotion_strength")
    if emotion_strength is not None and emotion_strength < LOW_EMOTION_STRENGTH:
        recommendations.append(
            "The caption feels a little flat — adding a more personal or emotional sentence may "
            "make it more relatable."
        )

    word_count = features.get("word_count")
    hashtag_count = features.get("hashtag_count")
    if word_count and hashtag_count is not None and word_count > 0:
        hashtag_ratio = hashtag_count / word_count
        if hashtag_ratio > HIGH_HASHTAG_RATIO:
            recommendations.append(
                "There are quite a lot of hashtags relative to the caption's length — writing a "
                "fuller sentence and trimming hashtags to the most relevant few may read more naturally."
            )

    if cluster_high_rate is not None and global_high_rate is not None and cluster_high_rate < global_high_rate:
        group_label = friendly_content_group_label(predicted_post_type)
        recommendations.append(
            f"Posts like this one ({group_label}) tend to underperform compared to this account's "
            f"overall average — a different content style may work better."
        )

    if predicted_post_type:
        recommendations.append(strategy_for_post_type(clip_recommendation_rules, predicted_post_type))

    recommendations.append(
        "Comparing this draft with this account's own past High Engagement posts may reveal what worked before."
    )
    recommendations.append(
        "Posting time can matter too — engagement patterns are often time-of-day and day-of-week dependent."
    )

    return recommendations
