"""
predict.py
==========

Loads the trained bundle (outputs/final_model_bundle.pkl by default) ONCE
and exposes `predict_success_probability(post_input)` for the app backend
(app_api.py) or any other Python caller. This module never retrains
anything — it only does inference. The prediction itself never touches
MySQL; the one exception is an optional, fault-tolerant enrichment step
that reads historical, aggregate insights (app/insights.py) to make the
recommendations more useful — if the database is unreachable, prediction
still succeeds with rule-based recommendations only.

`post_input` is a dict with the raw fields described in README.md /
sample_post.json: handcrafted numeric features, optional categorical
fields (language, post_type, predicted_post_type), and either:

  - `text_embedding` (384 floats) + `image_embedding` (512 floats),
    precomputed — developer/testing mode (e.g. sample_post.json); or
  - `text` (the caption, str) + `image` (a PIL.Image.Image) — the REAL app
    workflow: this is the ONLY thing a normal user provides, and
    embeddings are extracted automatically (see app/embedding_extractor.py,
    verified to reproduce the training-time embedding space exactly) —
    sample embeddings are never silently substituted for a real request.

Production must use the same text/image embedding models at training and
inference — this is why app/embedding_extractor.py exists and is
documented in detail there, including how the model choice was verified.

Architecture (see train_final_model.py / README.md for the full
rationale): a global weighted ensemble (RandomForest, ExtraTrees, XGBoost,
CatBoost) and, if this post's content cluster has a trained expert, an
ExtraTrees specialist for that cluster, blended by a per-cluster adaptive
alpha; isotonic calibration makes the result trustworthy; and a
content-cluster-specific threshold (falling back to a global threshold)
makes the final call.

IMPORTANT DEPLOYMENT-BUG PREVENTION (kept intentionally, do not remove):
content_cluster / content_cluster_distance / content_cluster_train_high_rate
are all real model FEATURES in this architecture (unlike a simpler design
where they'd be routing-only). An earlier inference implementation forgot
to recreate content_cluster_distance, crashing every live request with
`KeyError: ['content_cluster_distance']`. app.clustering.assign_content_cluster_for_inference
remains the single, shared place these are (re)computed from the frozen
training-time artifacts, and both predict.py and train_final_model.py's
self-check call this exact function, so the training and inference code
paths cannot drift apart again.
"""

import threading
from typing import Optional

import joblib
import numpy as np
import pandas as pd

from app.config import MODEL_BUNDLE_PATH, TEXT_EMBEDDING_DIM, IMAGE_EMBEDDING_DIM
from app.feature_engineering import add_app_ready_interaction_features
from app.clustering import assign_content_cluster_for_inference
from app.recommendations import build_explanation, build_recommendations
from app.improvement import build_suggestion_payload

_bundle = None
_bundle_lock = threading.Lock()


def load_bundle(path: Optional[str] = None):
    """Loads the model bundle from disk. Call this once at app startup
    (app_api.py does this in its startup event); predict_success_probability
    will also lazily call it if needed."""
    global _bundle
    with _bundle_lock:
        _bundle = joblib.load(path or MODEL_BUNDLE_PATH)
    return _bundle


def get_bundle():
    if _bundle is None:
        return load_bundle()
    return _bundle


def _ensure_embeddings(post_input: dict) -> dict:
    """
    Returns a copy of `post_input` guaranteed to have `text_embedding` and
    `image_embedding`. If both are already present (developer/testing
    mode), they are used as-is. Otherwise, real embeddings are extracted
    automatically from `post_input['text']` (the caption) and
    `post_input['image']` (a PIL.Image.Image) using
    app.embedding_extractor — this is the real app workflow: a normal user
    only ever provides an image and a caption, never embeddings, and
    sample/demo embeddings are never silently substituted here.
    """
    post_input = dict(post_input)
    has_text_emb = post_input.get("text_embedding") is not None
    has_image_emb = post_input.get("image_embedding") is not None

    if has_text_emb and has_image_emb:
        return post_input

    text = post_input.get("text") or post_input.get("caption")
    image = post_input.get("image")

    if text is None or image is None:
        raise ValueError(
            "post_input must include either precomputed 'text_embedding' (384 floats) and "
            "'image_embedding' (512 floats) for developer/testing mode, or both 'text' (the "
            "caption) and 'image' (a PIL.Image.Image) so real embeddings can be extracted "
            "automatically. Got neither a complete embedding pair nor a text+image pair."
        )

    from app.embedding_extractor import build_embeddings_for_post
    text_embedding, image_embedding = build_embeddings_for_post(text, image)
    post_input["text_embedding"] = text_embedding
    post_input["image_embedding"] = image_embedding
    return post_input


def _post_input_to_dataframe(post_input: dict) -> pd.DataFrame:
    """Converts a single post's raw input dict into the one-row DataFrame
    shape the training pipeline expects, before content-cluster assignment
    and interaction-feature engineering are applied."""
    if "text_embedding" not in post_input or "image_embedding" not in post_input:
        raise ValueError("post_input must include 'text_embedding' and 'image_embedding'.")

    text_embedding = post_input["text_embedding"]
    image_embedding = post_input["image_embedding"]

    if len(text_embedding) != TEXT_EMBEDDING_DIM:
        raise ValueError(f"text_embedding must have {TEXT_EMBEDDING_DIM} values, got {len(text_embedding)}.")
    if len(image_embedding) != IMAGE_EMBEDDING_DIM:
        raise ValueError(f"image_embedding must have {IMAGE_EMBEDDING_DIM} values, got {len(image_embedding)}.")

    row = {}
    numeric_fields = [
        "img_height", "img_width", "img_brightness", "img_contrast", "img_colorfulness", "img_blur_score",
        "text_length", "word_count", "hashtag_count", "img_aspect_ratio", "img_megapixels",
        "post_hour", "post_month", "day_of_week",
        "text_image_similarity", "sentiment_score", "sentiment_numeric", "emotion_strength",
        "post_type_confidence",
    ]
    for field in numeric_fields:
        row[field] = post_input.get(field, np.nan)

    row["language"] = post_input.get("language") or "unknown"
    row["post_type"] = post_input.get("post_type") or "unknown"
    row["predicted_post_type"] = post_input.get("predicted_post_type")

    for i, value in enumerate(text_embedding):
        row[f"text_emb_{i}"] = value
    for i, value in enumerate(image_embedding):
        row[f"img_emb_{i}"] = value

    return pd.DataFrame([row])


def predict_success_probability(post_input: dict) -> dict:
    """
    Runs the full final-model inference path for one new post and returns
    a JSON-serializable dict with the fields the app needs to display:

      predicted_label          - "Low Engagement" or "High Engagement"
      success_probability       - raw (pre-calibration) blended probability
      calibrated_probability    - isotonic-calibrated probability (what the
                                   app should show the user; this is also
                                   what threshold_used was chosen against)
      threshold_used             - decision threshold applied (cluster-
                                   specific if this cluster had enough
                                   validation data, else the global fallback)
      content_cluster              - detected content cluster id
      content_cluster_distance      - distance from that cluster's center
      used_expert_model              - whether a cluster-specific expert
                                     contributed to the blended probability
      predicted_post_type              - passed through from input, if given
      explanation                       - short human-readable summary
      recommendations                    - list of improvement suggestions
                                         (only substantive when Low Engagement)

    Plus the rule-based, LLM-free improvement-layer fields (see
    app/improvement.py — these never affect the fields above; they are
    purely a downstream application layer):
      caption_improvement_suggestions, image_improvement_suggestions,
      ai_image_prompt, should_improve, improvement_options
    """
    bundle = get_bundle()

    post_input = _ensure_embeddings(post_input)
    df = _post_input_to_dataframe(post_input)
    df = add_app_ready_interaction_features(df)

    # Recreate content_cluster / content_cluster_distance /
    # content_cluster_train_high_rate from the frozen training-time
    # artifacts. All three are real model features here (see module
    # docstring) — this is the fix for the historical KeyError bug.
    cluster_artifacts = bundle["content_cluster_artifacts"]
    df = assign_content_cluster_for_inference(cluster_artifacts, df)

    content_cluster = df["content_cluster"].iloc[0]
    content_cluster_distance = float(df["content_cluster_distance"].iloc[0])
    cluster_high_rate = float(df["content_cluster_train_high_rate"].iloc[0])
    global_high_rate = cluster_artifacts.get("global_high_rate")

    feature_cols = bundle["feature_columns"]
    X = df[feature_cols].copy()

    # 1) Global weighted ensemble probability
    weights = bundle["weights"]
    global_proba = None
    for model_name, weight in weights.items():
        if weight == 0:
            continue
        pipeline = bundle["global_pipelines"][model_name]
        p = pipeline.predict_proba(X)[:, 1]
        global_proba = weight * p if global_proba is None else global_proba + weight * p
    global_proba = float(global_proba[0])

    # 2) Expert probability, if this cluster has a trained expert
    expert_pipeline = bundle["experts"].get(content_cluster)
    used_expert_model = expert_pipeline is not None
    expert_proba = float(expert_pipeline.predict_proba(X)[:, 1][0]) if used_expert_model else np.nan

    # 3) Adaptive cluster alpha blend
    alpha_map = bundle.get("alpha_map", {})
    alpha_global = alpha_map.get(content_cluster, bundle.get("alpha_global", 1.0))
    alpha_expert = 1 - alpha_global
    expert_filled = global_proba if pd.isna(expert_proba) else expert_proba
    raw_proba = float(alpha_global * global_proba + alpha_expert * expert_filled)

    # 4) Isotonic calibration
    calibrator = bundle.get("calibrator")
    calibrated_proba = float(calibrator.transform([raw_proba])[0]) if calibrator is not None else raw_proba

    # 5) Content-cluster-specific threshold, falling back to the global one
    threshold_map = bundle.get("threshold_map", {})
    fallback_threshold = bundle.get("fallback_threshold", 0.5)
    threshold_used = float(threshold_map.get(content_cluster, fallback_threshold))

    predicted_label = "High Engagement" if calibrated_proba >= threshold_used else "Low Engagement"

    predicted_post_type = post_input.get("predicted_post_type")
    clip_recommendation_rules = bundle.get("clip_recommendation_rules", {})

    explanation = build_explanation(
        predicted_label, calibrated_proba, content_cluster, cluster_high_rate, predicted_post_type
    )
    recommendations = build_recommendations(
        predicted_label, post_input, content_cluster, cluster_high_rate, global_high_rate,
        predicted_post_type, clip_recommendation_rules
    )

    result = {
        "predicted_label": predicted_label,
        "success_probability": raw_proba,
        "calibrated_probability": calibrated_proba,
        "threshold_used": threshold_used,
        "content_cluster": content_cluster,
        "content_cluster_distance": content_cluster_distance,
        "used_expert_model": used_expert_model,
        "predicted_post_type": predicted_post_type,
        "explanation": explanation,
        "recommendations": recommendations,
    }

    # Enrich recommendations with historical, aggregate SQL insights
    # (best posting hour, relevant hashtags, comparison to High-Engagement
    # patterns for this post type — see app/insights.py; never a single
    # post's own outcome, never a model feature). This is the only place
    # predict.py touches MySQL, and it degrades gracefully: if the
    # database is unreachable, the base rule-based recommendations above
    # are kept and prediction still succeeds.
    try:
        from app.insights import generate_user_friendly_recommendations
        result["recommendations"] = generate_user_friendly_recommendations(post_input, result)
    except Exception as e:
        print(f"[predict.py] Skipping SQL-based recommendation insights ({e}); using rule-based recommendations only.")

    # Application-layer improvement suggestions (rule-based, no external
    # LLM/image API) -- purely additive, never influences the fields above.
    result.update(build_suggestion_payload(post_input, result))
    return result


if __name__ == "__main__":
    import json
    import sys

    sample_path = sys.argv[1] if len(sys.argv) > 1 else "sample_post.json"
    with open(sample_path, "r", encoding="utf-8") as f:
        sample_post = json.load(f)

    result = predict_success_probability(sample_post)
    print(json.dumps(result, indent=2))
