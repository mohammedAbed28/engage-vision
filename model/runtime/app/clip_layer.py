"""
CLIP post-type application layer.

CLIP-predicted post type (`predicted_post_type`) did NOT improve F1 when
tried as a feature inside the prediction model, so it is kept out of
app/feature_engineering.py entirely. It is still useful application
context, though: this module summarizes historical high-engagement rate per
post type and derives a simple content-strategy recommendation string per
type. The resulting table is stored in the model bundle
(`clip_recommendation_rules`) so predict.py can use it without ever hitting
the database again.
"""

import os

import pandas as pd

from app.config import TARGET_COL, OUTPUT_DIR

_STRATEGY_BY_TYPE = {
    "activism": "Use a strong call-to-action, a clear message, and targeted hashtags.",
    "campaign": "Use a strong call-to-action, a clear message, and targeted hashtags.",
    "awareness": "Use a strong call-to-action, a clear message, and targeted hashtags.",
    "personal_story": "Emphasize authentic storytelling, an emotional opening, and supportive hashtags.",
    "support": "Add a clearer action or a stronger emotional hook to avoid passive engagement.",
    "educational_info": "Convert information into a visual insight, add a summary sentence, and improve the headline.",
    "emotional_quote": "Add context or the story behind the quote to increase meaningful engagement.",
    "memorial": "Use a respectful tone, concise text, and remembrance-focused hashtags.",
}
_DEFAULT_STRATEGY = "Clarify the post's goal and improve text-image alignment."


def run_clip_app_layer_analysis(df: pd.DataFrame):
    """Builds the per-post-type high-engagement-rate summary and
    recommendation strategy table used by the app layer. Returns None if
    predicted_post_type isn't available."""
    if "predicted_post_type" not in df.columns:
        return None

    clip_df = df.dropna(subset=["predicted_post_type", TARGET_COL]).copy()
    if clip_df.empty:
        return None

    agg_kwargs = {"total_posts": ("post_id", "count"), "high_posts": (TARGET_COL, "sum")}
    if "post_type_confidence" in clip_df.columns:
        agg_kwargs["avg_confidence"] = ("post_type_confidence", "mean")

    clip_summary = clip_df.groupby("predicted_post_type").agg(**agg_kwargs).reset_index()
    clip_summary["low_posts"] = clip_summary["total_posts"] - clip_summary["high_posts"]
    clip_summary["high_engagement_rate"] = clip_summary["high_posts"] / clip_summary["total_posts"]
    clip_summary = clip_summary.sort_values("high_engagement_rate", ascending=False)

    clip_summary.to_csv(os.path.join(OUTPUT_DIR, "clip_app_layer_post_type_high_rate.csv"), index=False, encoding="utf-8-sig")

    return clip_summary


def build_recommendation_rules(clip_summary: pd.DataFrame) -> dict:
    """Post-type -> {observed_high_engagement_rate, strategy}, saved into
    the model bundle so predict.py needs no database access."""
    if clip_summary is None or clip_summary.empty:
        return {}

    rules = {}
    for _, row in clip_summary.iterrows():
        post_type = row["predicted_post_type"]
        rules[post_type] = {
            "observed_high_engagement_rate": float(row["high_engagement_rate"]),
            "strategy": _STRATEGY_BY_TYPE.get(post_type, _DEFAULT_STRATEGY),
        }
    return rules


def strategy_for_post_type(clip_recommendation_rules: dict, post_type: str) -> str:
    if post_type and post_type in clip_recommendation_rules:
        return clip_recommendation_rules[post_type]["strategy"]
    return _STRATEGY_BY_TYPE.get(post_type, _DEFAULT_STRATEGY)
