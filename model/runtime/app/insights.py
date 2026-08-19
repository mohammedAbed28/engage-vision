"""
SQL-derived, safe aggregate insights used ONLY for human-readable
recommendations — never as model input features, and never using a
single post's own current-row outcome to predict itself. Everything here
is a historical, post-type-level statistic computed across the whole
`safespace` dataset (hashtag popularity, average engagement by posting
hour, typical caption/image patterns in High-Engagement posts) — read at
prediction time purely to phrase better, data-backed advice.

Results are cached in-process after the first DB round-trip per insight
type, since this reference data doesn't change between requests.
"""

import re
from collections import Counter
from typing import Optional

import pandas as pd

from app.db import connect_db
from app.config import TARGET_COL
from app.recommendations import build_recommendations

_HASHTAG_RE = re.compile(r"#(\w+)")
_WORD_RE = re.compile(r"[A-Za-z']{3,}")
_STOPWORD_LIKE = {"the", "and", "for", "you", "your", "this", "that", "with", "are", "was", "have"}

_cache = {"post_type_summary": None, "posting_hour": None, "hashtags": {}}

_DEFAULT_HASHTAGS = {
    "personal_story": ["#PersonalStory", "#NewBeginning", "#Grateful"],
    "awareness": ["#Awareness", "#CommunitySupport", "#TakeAction"],
    "campaign": ["#Awareness", "#CommunitySupport", "#TakeAction"],
    "activism": ["#TakeAction", "#StandTogether", "#ChangeMakers"],
    "support": ["#WeCare", "#SupportEachOther", "#YouAreNotAlone"],
    "memorial": ["#InMemory", "#NeverForgotten", "#Remembrance"],
    "educational_info": ["#LearnMore", "#DidYouKnow", "#Education"],
    "emotional_quote": ["#Reflection", "#WordsToLiveBy", "#Mindset"],
    "general": ["#Community", "#ShareYourStory"],
}


def _load_post_type_summary() -> pd.DataFrame:
    if _cache["post_type_summary"] is not None:
        return _cache["post_type_summary"]
    conn = connect_db()
    query = f"""
        SELECT
            predicted_post_type,
            COUNT(*) AS total_posts,
            AVG({TARGET_COL}) AS high_rate,
            AVG(text_length) AS avg_text_length,
            AVG(word_count) AS avg_word_count,
            AVG(hashtag_count) AS avg_hashtag_count,
            AVG(CASE WHEN {TARGET_COL}=1 THEN text_length END) AS avg_text_length_high,
            AVG(CASE WHEN {TARGET_COL}=1 THEN word_count END) AS avg_word_count_high,
            AVG(CASE WHEN {TARGET_COL}=1 THEN hashtag_count END) AS avg_hashtag_count_high,
            AVG(CASE WHEN {TARGET_COL}=1 THEN emotion_strength END) AS avg_emotion_strength_high,
            AVG(CASE WHEN {TARGET_COL}=1 THEN text_image_similarity END) AS avg_similarity_high,
            AVG(CASE WHEN {TARGET_COL}=1 THEN img_brightness END) AS avg_brightness_high,
            AVG(CASE WHEN {TARGET_COL}=1 THEN img_colorfulness END) AS avg_colorfulness_high
        FROM safespace
        WHERE predicted_post_type IS NOT NULL
        GROUP BY predicted_post_type
    """
    df = pd.read_sql(query, conn)
    conn.close()
    _cache["post_type_summary"] = df.set_index("predicted_post_type")
    return _cache["post_type_summary"]


def _load_posting_hour_stats() -> pd.DataFrame:
    if _cache["posting_hour"] is not None:
        return _cache["posting_hour"]
    conn = connect_db()
    query = f"""
        SELECT predicted_post_type, post_hour, COUNT(*) AS n, AVG({TARGET_COL}) AS high_rate
        FROM safespace
        WHERE predicted_post_type IS NOT NULL AND post_hour IS NOT NULL
        GROUP BY predicted_post_type, post_hour
    """
    df = pd.read_sql(query, conn)
    conn.close()
    _cache["posting_hour"] = df
    return df


def _load_top_hashtags(post_type: str, min_count: int = 3, limit: int = 5) -> list:
    if post_type in _cache["hashtags"]:
        return _cache["hashtags"][post_type]
    conn = connect_db()
    query = (
        "SELECT text FROM safespace "
        f"WHERE predicted_post_type = %s AND {TARGET_COL} = 1 AND text IS NOT NULL "
        "LIMIT 3000"
    )
    df = pd.read_sql(query, conn, params=(post_type,))
    conn.close()

    counter = Counter()
    for text in df["text"].dropna():
        for tag in _HASHTAG_RE.findall(text):
            counter[f"#{tag}"] += 1

    top = [tag for tag, count in counter.most_common(limit * 3) if count >= min_count][:limit]
    _cache["hashtags"][post_type] = top
    return top


def get_post_type_insights(post_type: str) -> Optional[dict]:
    """Returns the historical summary row for one post type, or None if
    there isn't enough data for it."""
    summary = _load_post_type_summary()
    if post_type not in summary.index:
        return None
    return summary.loc[post_type].to_dict()


def suggest_posting_time(post_type: str, min_sample_size: int = 30) -> Optional[dict]:
    """Returns the historically best-performing posting hour for a post
    type (falling back to nothing if there isn't enough data)."""
    hours = _load_posting_hour_stats()
    subset = hours[(hours["predicted_post_type"] == post_type) & (hours["n"] >= min_sample_size)]
    if subset.empty:
        return None
    best = subset.sort_values("high_rate", ascending=False).iloc[0]
    return {"post_hour": int(best["post_hour"]), "high_rate": float(best["high_rate"]), "n": int(best["n"])}


def suggest_hashtags(post_type: str, caption: str = "", language: str = "en", limit: int = 5) -> list:
    """Relevant, non-spammy hashtag suggestions: historically popular
    hashtags among this post type's High-Engagement posts, topped up with
    a small curated fallback list if the database doesn't yield enough."""
    data_driven = _load_top_hashtags(post_type)

    existing_tags = {t.lower() for t in _HASHTAG_RE.findall(caption or "")}
    suggestions = [t for t in data_driven if t[1:].lower() not in existing_tags]

    for fallback_tag in _DEFAULT_HASHTAGS.get(post_type, _DEFAULT_HASHTAGS["general"]):
        if len(suggestions) >= limit:
            break
        if fallback_tag.lower() not in [s.lower() for s in suggestions] and fallback_tag[1:].lower() not in existing_tags:
            suggestions.append(fallback_tag)

    return suggestions[:limit]


def compare_to_high_engagement_patterns(post_input: dict, post_type: str) -> list:
    """Plain-language comparisons between this post's own signals and what
    High-Engagement posts of the same type typically look like."""
    insights = get_post_type_insights(post_type)
    if not insights:
        return []

    comparisons = []

    emotion_strength = post_input.get("emotion_strength")
    avg_emotion_high = insights.get("avg_emotion_strength_high")
    if emotion_strength is not None and avg_emotion_high is not None and emotion_strength < avg_emotion_high * 0.7:
        comparisons.append(
            f"High-performing '{post_type.replace('_', ' ')}' posts tend to have a warmer, more personal "
            f"tone than this draft — adding a more emotional sentence may help it connect better."
        )

    similarity = post_input.get("text_image_similarity")
    avg_similarity_high = insights.get("avg_similarity_high")
    if similarity is not None and avg_similarity_high is not None and similarity < avg_similarity_high * 0.7:
        comparisons.append(
            f"Top-performing posts of this type usually show a picture that closely matches the caption's "
            f"message — this draft's image and caption may not be telling quite the same story yet."
        )

    brightness = post_input.get("img_brightness")
    avg_brightness_high = insights.get("avg_brightness_high")
    if brightness is not None and avg_brightness_high is not None and brightness < avg_brightness_high * 0.75:
        comparisons.append(
            f"Successful '{post_type.replace('_', ' ')}' posts tend to use brighter images than this one — "
            f"a brighter shot may catch more attention while scrolling."
        )

    return comparisons


def generate_user_friendly_recommendations(post_input: dict, prediction_result: dict) -> list:
    """
    Master recommendation list shown in the app: starts from the rule-based
    technical recommendations (app/recommendations.py, already written in
    plain language), then layers on data-backed additions from the
    historical database — a suggested posting time and relevant hashtags —
    when there's enough data to support them. Never uses a post's own
    likes/comments/engagement_class; only aggregate, historical, post-type-
    level statistics.
    """
    predicted_post_type = prediction_result.get("predicted_post_type") or post_input.get("post_type")
    recommendations = list(prediction_result.get("recommendations", []))

    if prediction_result.get("predicted_label") == "High Engagement":
        return recommendations

    if predicted_post_type:
        comparisons = compare_to_high_engagement_patterns(post_input, predicted_post_type)
        recommendations.extend(comparisons)

        best_time = suggest_posting_time(predicted_post_type)
        if best_time:
            hour = best_time["post_hour"]
            recommendations.append(
                f"Posts like this one have historically performed best around {hour}:00 — "
                f"consider scheduling around that time if it fits your audience."
            )

        hashtags = suggest_hashtags(predicted_post_type, post_input.get("text", ""))
        if hashtags:
            recommendations.append(
                f"Hashtags that have worked well for similar posts: {' '.join(hashtags)}."
            )

    return recommendations
