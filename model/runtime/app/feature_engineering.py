"""
App-ready feature engineering.

`add_app_ready_interaction_features` is called identically at training time
(train_final_model.py) and inference time (predict.py) — it must never be
allowed to drift between the two, or the model will see a different feature
distribution live than it was trained on.
"""

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline as SklearnPipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.feature_selection import VarianceThreshold
from sklearn.decomposition import PCA

from app.config import TARGET_COL, USER_COL, RANDOM_STATE, OUTPUT_DIR
import os


def create_onehot_encoder():
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:
        return OneHotEncoder(handle_unknown="ignore", sparse=False)


def add_app_ready_interaction_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    eps = 1e-6

    if "word_count" in df.columns and "text_length" in df.columns:
        df["avg_word_length_proxy"] = df["text_length"] / (df["word_count"] + eps)

    if "hashtag_count" in df.columns and "word_count" in df.columns:
        df["hashtag_ratio"] = df["hashtag_count"] / (df["word_count"] + eps)

    if "img_width" in df.columns and "img_height" in df.columns:
        df["img_area"] = df["img_width"] * df["img_height"]
        df["img_width_height_ratio"] = df["img_width"] / (df["img_height"] + eps)

    if "img_brightness" in df.columns and "img_contrast" in df.columns:
        df["brightness_contrast_interaction"] = df["img_brightness"] * df["img_contrast"]

    if "img_colorfulness" in df.columns and "img_blur_score" in df.columns:
        df["colorfulness_to_blur_ratio"] = df["img_colorfulness"] / (df["img_blur_score"].abs() + eps)

    if "img_brightness" in df.columns and "img_colorfulness" in df.columns:
        df["visual_attractiveness_proxy"] = df["img_brightness"] * df["img_colorfulness"]

    if "text_image_similarity" in df.columns and "emotion_strength" in df.columns:
        df["similarity_emotion_interaction"] = df["text_image_similarity"] * df["emotion_strength"]

    if "text_image_similarity" in df.columns and "sentiment_numeric" in df.columns:
        df["similarity_sentiment_interaction"] = df["text_image_similarity"] * df["sentiment_numeric"]

    if "text_image_similarity" in df.columns and "hashtag_count" in df.columns:
        df["similarity_hashtag_interaction"] = df["text_image_similarity"] * df["hashtag_count"]

    if "post_hour" in df.columns:
        df["post_hour_sin"] = np.sin(2 * np.pi * df["post_hour"] / 24)
        df["post_hour_cos"] = np.cos(2 * np.pi * df["post_hour"] / 24)

    if "day_of_week" in df.columns:
        df["day_of_week_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
        df["day_of_week_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)

    if "post_month" in df.columns:
        df["post_month_sin"] = np.sin(2 * np.pi * df["post_month"] / 12)
        df["post_month_cos"] = np.cos(2 * np.pi * df["post_month"] / 12)

    return df


def define_feature_groups(df: pd.DataFrame):
    """
    Selects the exact feature set used by the final model, and enforces the
    leakage rules from the project spec: current-row engagement outcomes,
    identifiers, raw text/image, and CLIP post-type outputs are excluded.
    User history features are excluded too — the final selected model is
    fully content-based (uses_username=False, uses_user_history=False in the
    saved bundle), which is what let it work identically at training and
    live-inference time without needing per-user state.
    """
    text_embedding_cols = [c for c in df.columns if c.startswith("text_emb_")]
    image_embedding_cols = [c for c in df.columns if c.startswith("img_emb_")]

    excluded_cols = [
        TARGET_COL,
        "post_id",
        USER_COL,
        "post_date",

        "likes",
        "comment_count",
        "engagement_score",
        "engagement_score_pro",
        "cluster_k2",

        "text",
        "img",
        "post_url",

        # CLIP is an application layer only, never a prediction feature.
        "predicted_post_type",
        "post_type_confidence",
        "post_type_model",

        "user_past_posts_count",
        "user_has_history",
        "user_past_avg_engagement",
        "user_past_median_engagement",
        "user_past_max_engagement",
        "user_past_high_rate",
    ]

    excluded_prefixes = ["user_past_mean_", "user_past_std_"]
    excluded_suffixes = ["_diff_from_user_past_mean", "_user_context_z"]

    categorical_cols = [c for c in ["language", "post_type", "content_cluster"] if c in df.columns]
    embedding_set = set(text_embedding_cols + image_embedding_cols)

    numeric_cols = []
    for c in df.columns:
        if c in excluded_cols or c in categorical_cols or c in embedding_set:
            continue
        if any(c.startswith(prefix) for prefix in excluded_prefixes):
            continue
        if any(c.endswith(suffix) for suffix in excluded_suffixes):
            continue
        numeric_cols.append(c)

    feature_cols = numeric_cols + categorical_cols + text_embedding_cols + image_embedding_cols

    feature_summary = pd.DataFrame({
        "feature": feature_cols,
        "feature_group": [
            "numeric_app_ready" if c in numeric_cols else
            "categorical" if c in categorical_cols else
            "text_embedding" if c in text_embedding_cols else
            "image_embedding"
            for c in feature_cols
        ]
    })
    feature_summary.to_csv(os.path.join(OUTPUT_DIR, "features_used_final_model.csv"), index=False, encoding="utf-8-sig")

    return feature_cols, numeric_cols, categorical_cols, text_embedding_cols, image_embedding_cols


def build_preprocessor(numeric_cols, categorical_cols, text_embedding_cols, image_embedding_cols,
                        text_pca_components, image_pca_components):
    transformers = []

    if numeric_cols:
        transformers.append((
            "num",
            SklearnPipeline(steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler())
            ]),
            numeric_cols
        ))

    if categorical_cols:
        transformers.append((
            "cat",
            SklearnPipeline(steps=[
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("onehot", create_onehot_encoder())
            ]),
            categorical_cols
        ))

    if text_embedding_cols:
        transformers.append((
            "text_pca",
            SklearnPipeline(steps=[
                ("imputer", SimpleImputer(strategy="median")),
                # A handful of raw embedding dimensions are near-constant
                # (std ~1e-33, confirmed on the real text_embeddings table).
                # StandardScaler divides by that near-zero std, blowing those
                # columns up to ~1e30+ magnitude, which destabilizes the PCA
                # SVD (silent overflow/NaN in fit) and poisons every
                # downstream model. Dropping near-zero-variance dimensions
                # first keeps scaling numerically safe.
                ("variance_filter", VarianceThreshold(threshold=1e-6)),
                ("scaler", StandardScaler()),
                ("pca", PCA(n_components=text_pca_components, random_state=RANDOM_STATE))
            ]),
            text_embedding_cols
        ))

    if image_embedding_cols:
        transformers.append((
            "image_pca",
            SklearnPipeline(steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("variance_filter", VarianceThreshold(threshold=1e-6)),
                ("scaler", StandardScaler()),
                ("pca", PCA(n_components=image_pca_components, random_state=RANDOM_STATE))
            ]),
            image_embedding_cols
        ))

    return ColumnTransformer(transformers=transformers, remainder="drop", sparse_threshold=0)
