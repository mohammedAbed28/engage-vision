"""
Loads and cleans multimodal post data from the `safespace` MySQL database
for training. Not used at inference time (predict.py never touches the DB
for model features — see app/clustering.py for why).
"""

import numpy as np
import pandas as pd

from app.config import MAIN_TABLE, TEXT_TABLE, IMAGE_TABLE, TARGET_COL, USER_COL
from app.db import connect_db


def load_multimodal_data() -> pd.DataFrame:
    """
    Joins safespace + text_embeddings + image_embeddings on post_id.

    predicted_post_type / post_type_confidence (CLIP output) are loaded here
    ONLY for the application/report layer (post-type recommendations). They
    are explicitly excluded from the model's feature columns in
    app/feature_engineering.py — CLIP trials did not improve F1 when used as
    a model input, so it is kept as a separate application layer instead.

    Leakage-sensitive columns (likes, comment_count, engagement_score_pro,
    cluster_k2, post_url, raw text/img, username as a categorical, post_id)
    are intentionally NOT selected here as feature candidates.
    """
    text_cols = ",\n        ".join([f"t.text_emb_{i}" for i in range(384)])
    image_cols = ",\n        ".join([f"im.img_emb_{i}" for i in range(512)])

    query = f"""
    SELECT
        s.post_id,
        s.username,
        s.post_date,

        s.post_type,
        s.predicted_post_type,
        s.post_type_confidence,

        s.img_height,
        s.img_width,
        s.img_brightness,
        s.img_contrast,
        s.img_colorfulness,
        s.img_blur_score,

        s.text_length,
        s.word_count,
        s.hashtag_count,

        s.img_aspect_ratio,
        s.img_megapixels,

        s.language,
        s.post_hour,
        s.post_month,
        s.day_of_week,

        s.text_image_similarity,
        s.sentiment_score,
        s.sentiment_numeric,
        s.emotion_strength,

        {text_cols},
        {image_cols},

        s.{TARGET_COL}
    FROM {MAIN_TABLE} s
    JOIN {TEXT_TABLE} t
        ON s.post_id = t.post_id
    JOIN {IMAGE_TABLE} im
        ON s.post_id = im.post_id
    WHERE s.{TARGET_COL} IS NOT NULL;
    """

    conn = connect_db()
    try:
        df = pd.read_sql(query, conn)
    finally:
        conn.close()

    print(f"Loaded rows: {len(df):,} | columns: {len(df.columns):,}")
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """Type coercion and NaN handling — identical rules used at training
    time must be mirrored for any raw input reaching predict.py."""
    df = df.copy()
    df = df.replace([np.inf, -np.inf], np.nan)

    if "post_id" in df.columns:
        df["post_id"] = df["post_id"].astype(str)

    if USER_COL in df.columns:
        df[USER_COL] = df[USER_COL].fillna("unknown").astype(str)

    for cat_col in ["language", "post_type", "predicted_post_type"]:
        if cat_col in df.columns:
            df[cat_col] = df[cat_col].fillna("unknown").astype(str)

    if "post_type_confidence" in df.columns:
        df["post_type_confidence"] = pd.to_numeric(df["post_type_confidence"], errors="coerce").fillna(0)

    if "post_date" in df.columns:
        df["post_date"] = pd.to_datetime(df["post_date"], errors="coerce")

    df[TARGET_COL] = pd.to_numeric(df[TARGET_COL], errors="coerce")
    df = df.dropna(subset=[TARGET_COL])
    df[TARGET_COL] = df[TARGET_COL].astype(int)

    categorical_keep = {"post_id", USER_COL, "language", "post_type", "predicted_post_type", "post_date", TARGET_COL}

    for col in df.columns:
        if col not in categorical_keep:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    return df
