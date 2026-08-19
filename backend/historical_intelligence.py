"""Read-only, aggregate SQL evidence for the recommendation layer.

This module is intentionally separate from the frozen predictor. It never
uses a current post's outcome, username, likes or comments. Historical
patterns are shown only when a sufficiently large comparable sample exists;
otherwise the product says that no reliable historical pattern is available.
"""

from __future__ import annotations

from collections import Counter
import math
import re
import socket
import time
from typing import Any

from app.config import DB_CONFIG, MAIN_TABLE
from app.db import connect_db


MIN_CONTEXT_SAMPLE = 100
MIN_HOUR_SAMPLE = 30
MIN_TAG_SAMPLE = 12
CACHE_SECONDS = 15 * 60
MAX_TEXT_ROWS = 12000
HISTORICAL_TARGET_COL = "engagement_class_eel"
_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_HASHTAG_RE = re.compile(r"#[^\W_]+", re.UNICODE)
_BLOCKED_TAGS = {
    "#fyp", "#viral", "#explore", "#explorepage", "#instagood",
    "#photooftheday", "#like4like", "#followforfollow", "#followme",
}
_cache: dict[tuple[str, str], tuple[float, dict[str, Any]]] = {}


def _database_reachable() -> bool:
    """Avoid adding the MySQL connector's long timeout to every first preview."""
    try:
        host = str(DB_CONFIG.get("host") or "localhost")
        port = int(DB_CONFIG.get("port") or 3306)
        with socket.create_connection((host, port), timeout=0.45):
            return True
    except (OSError, TypeError, ValueError):
        return False


def _empty(reason: str) -> dict[str, Any]:
    return {
        "available": False,
        "scope": "none",
        "sample_size": 0,
        "summary": {},
        "best_time": None,
        "hashtags": [],
        "hashtag_sample_size": 0,
        "benchmark_signals": [],
        "dataset_profile": {},
        "note": reason,
    }


def build_benchmark_signals(
    prepared_post_input: dict[str, Any],
    historical_context: dict[str, Any],
) -> list[dict[str, Any]]:
    """Compare this draft with the High-Engagement cohort without implying causality.

    These values are presentation evidence. They never enter the frozen model and
    they never use the current draft's future engagement outcome. A signal is shown
    only when both the draft value and the aggregate reference are finite.
    """
    if not historical_context.get("available"):
        return []
    summary = historical_context.get("summary") or {}
    definitions = (
        ("caption_length", "word_count", "avg_word_count_high", "words"),
        ("emotion_strength", "emotion_strength", "avg_emotion_strength_high", "score"),
        ("text_image_alignment", "text_image_similarity", "avg_similarity_high", "score"),
        ("brightness", "img_brightness", "avg_brightness_high", "level"),
        ("colorfulness", "img_colorfulness", "avg_colorfulness_high", "level"),
        ("hashtag_count", "hashtag_count", "avg_hashtag_count_high", "tags"),
    )
    signals: list[dict[str, Any]] = []
    for signal_id, current_key, reference_key, unit in definitions:
        try:
            current = float(prepared_post_input.get(current_key))
            reference = float(summary.get(reference_key))
        except (TypeError, ValueError):
            continue
        if not math.isfinite(current) or not math.isfinite(reference) or reference <= 0:
            continue
        ratio = current / reference
        status = "near_reference" if 0.75 <= ratio <= 1.25 else "below_reference" if ratio < 0.75 else "above_reference"
        signals.append(
            {
                "id": signal_id,
                "current_value": round(current, 4),
                "reference_value": round(reference, 4),
                "ratio_to_reference": round(ratio, 4),
                "unit": unit,
                "status": status,
            }
        )
    # Prioritize the largest descriptive gaps, while keeping the card concise.
    signals.sort(key=lambda item: abs(math.log(max(item["ratio_to_reference"], 0.01))), reverse=True)
    return signals[:5]


def _rows(cursor) -> list[dict[str, Any]]:
    return [dict(row) for row in cursor.fetchall()]


def _dataset_profile(cursor, table: str) -> dict[str, Any]:
    cursor.execute(
        f"""
        SELECT COUNT(*) AS total_rows,
               MIN(post_date) AS first_post,
               MAX(post_date) AS last_post,
               COUNT(DISTINCT predicted_post_type) AS content_types
        FROM {table}
        """
    )
    row = dict(cursor.fetchone() or {})
    return {
        "total_rows": int(row.get("total_rows") or 0),
        "first_post": str(row.get("first_post") or ""),
        "last_post": str(row.get("last_post") or ""),
        "content_types": int(row.get("content_types") or 0),
    }


def _summary(cursor, table: str, post_type: str, language: str | None) -> dict[str, Any]:
    language_sql = " AND language = %s" if language else ""
    params: tuple[Any, ...] = (post_type, language) if language else (post_type,)
    cursor.execute(
        f"""
        SELECT
            COUNT(*) AS sample_size,
            AVG({HISTORICAL_TARGET_COL}) AS high_rate,
            AVG(CASE WHEN {HISTORICAL_TARGET_COL} = 1 THEN word_count END) AS avg_word_count_high,
            AVG(CASE WHEN {HISTORICAL_TARGET_COL} = 1 THEN hashtag_count END) AS avg_hashtag_count_high,
            AVG(CASE WHEN {HISTORICAL_TARGET_COL} = 1 THEN emotion_strength END) AS avg_emotion_strength_high,
            AVG(CASE WHEN {HISTORICAL_TARGET_COL} = 1 THEN text_image_similarity END) AS avg_similarity_high,
            AVG(CASE WHEN {HISTORICAL_TARGET_COL} = 1 THEN img_brightness END) AS avg_brightness_high,
            AVG(CASE WHEN {HISTORICAL_TARGET_COL} = 1 THEN img_colorfulness END) AS avg_colorfulness_high
        FROM {table}
        WHERE predicted_post_type = %s
          AND {HISTORICAL_TARGET_COL} IN (0, 1)
          {language_sql}
        """,
        params,
    )
    row = cursor.fetchone() or {}
    return dict(row)


def _wilson_lower(high_count: int, sample_size: int, z: float = 1.96) -> float:
    if sample_size <= 0:
        return 0.0
    p = high_count / sample_size
    denominator = 1.0 + z * z / sample_size
    centre = p + z * z / (2.0 * sample_size)
    margin = z * math.sqrt((p * (1.0 - p) + z * z / (4.0 * sample_size)) / sample_size)
    return (centre - margin) / denominator


def _best_time(
    cursor,
    table: str,
    post_type: str,
    language: str | None,
    baseline_rate: float,
) -> dict[str, Any] | None:
    language_sql = " AND language = %s" if language else ""
    params: tuple[Any, ...] = (post_type, language) if language else (post_type,)
    cursor.execute(
        f"""
        SELECT post_hour, COUNT(*) AS n, SUM({HISTORICAL_TARGET_COL}) AS high_count
        FROM {table}
        WHERE predicted_post_type = %s
          AND {HISTORICAL_TARGET_COL} IN (0, 1)
          AND post_hour BETWEEN 0 AND 23
          {language_sql}
        GROUP BY post_hour
        HAVING COUNT(*) >= {MIN_HOUR_SAMPLE}
        """,
        params,
    )
    candidates = []
    for row in _rows(cursor):
        n = int(row.get("n") or 0)
        high_count = int(row.get("high_count") or 0)
        rate = high_count / n if n else 0.0
        candidates.append(
            {
                "post_hour": int(row["post_hour"]),
                "n": n,
                "high_rate": rate,
                "lift": rate - baseline_rate,
                "conservative_score": _wilson_lower(high_count, n),
            }
        )
    if not candidates:
        return None
    best = max(candidates, key=lambda item: (item["conservative_score"], item["n"]))
    # Do not manufacture a "best time" from ordinary sampling noise.
    return best if best["lift"] >= 0.03 else None


def _rank_hashtags(
    cursor,
    table: str,
    post_type: str,
    language: str | None,
    baseline_rate: float,
) -> tuple[list[str], int]:
    language_sql = " AND language = %s" if language else ""
    params: tuple[Any, ...] = (post_type, language) if language else (post_type,)
    cursor.execute(
        f"""
        SELECT text, {HISTORICAL_TARGET_COL} AS engagement_class
        FROM {table}
        WHERE predicted_post_type = %s
          AND {HISTORICAL_TARGET_COL} IN (0, 1)
          AND text IS NOT NULL
          {language_sql}
        LIMIT {MAX_TEXT_ROWS}
        """,
        params,
    )
    rows = _rows(cursor)
    high = Counter()
    total = Counter()
    display: dict[str, str] = {}
    for row in rows:
        tags = {tag for tag in _HASHTAG_RE.findall(str(row.get("text") or ""))}
        for tag in tags:
            key = tag.casefold()
            if key in _BLOCKED_TAGS or len(key) < 3 or len(key) > 42:
                continue
            display.setdefault(key, tag)
            total[key] += 1
            if int(row.get("engagement_class") or 0) == 1:
                high[key] += 1

    ranked: list[tuple[float, int, str]] = []
    for key, n in total.items():
        if n < MIN_TAG_SAMPLE or high[key] < 4:
            continue
        # Empirical-Bayes smoothing prevents a tiny tag from winning by chance.
        smoothed_rate = (high[key] + 8.0 * baseline_rate) / (n + 8.0)
        lift = smoothed_rate - baseline_rate
        if lift < 0.04:
            continue
        score = lift * math.log1p(n)
        ranked.append((score, n, display[key]))
    ranked.sort(reverse=True)
    return [tag for _, _, tag in ranked[:5]], len(rows)


def get_historical_context(post_type: str, language: str) -> dict[str, Any]:
    """Return conservative aggregate evidence, or an explicit unavailable state."""
    post_type = str(post_type or "general").strip()
    language = language if language in {"en", "he", "ar"} else "en"
    cache_key = (post_type, language)
    cached = _cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
        return cached[1]
    if not _IDENTIFIER_RE.fullmatch(MAIN_TABLE):
        return _empty("The configured historical table name is invalid.")
    if not _database_reachable():
        result = _empty("The historical database is offline; recommendations use model and draft evidence only.")
        _cache[cache_key] = (time.monotonic(), result)
        return result

    connection = None
    cursor = None
    try:
        connection = connect_db()
        cursor = connection.cursor(dictionary=True)
        summary = _summary(cursor, MAIN_TABLE, post_type, language)
        sample_size = int(summary.get("sample_size") or 0)
        scope = "language_and_content_type"
        scope_language: str | None = language
        if sample_size < MIN_CONTEXT_SAMPLE:
            summary = _summary(cursor, MAIN_TABLE, post_type, None)
            sample_size = int(summary.get("sample_size") or 0)
            scope = "content_type"
            scope_language = None
        if sample_size < MIN_CONTEXT_SAMPLE:
            result = _empty("There are not enough comparable historical posts for a reliable aggregate pattern.")
            _cache[cache_key] = (time.monotonic(), result)
            return result

        baseline_rate = float(summary.get("high_rate") or 0.0)
        best_time = _best_time(cursor, MAIN_TABLE, post_type, scope_language, baseline_rate)
        hashtags, hashtag_sample_size = _rank_hashtags(
            cursor, MAIN_TABLE, post_type, scope_language, baseline_rate
        )
        dataset_profile = _dataset_profile(cursor, MAIN_TABLE)
        result = {
            "available": True,
            "scope": scope,
            "sample_size": sample_size,
            "summary": summary,
            "best_time": best_time,
            "hashtags": hashtags,
            "hashtag_sample_size": hashtag_sample_size,
            "benchmark_signals": [],
            "dataset_profile": dataset_profile,
            "note": "Aggregate historical evidence is available for comparable posts.",
        }
    except Exception:
        result = _empty("The historical database is offline; recommendations use model and draft evidence only.")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()
    _cache[cache_key] = (time.monotonic(), result)
    return result
