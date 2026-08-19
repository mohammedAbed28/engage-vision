#!/usr/bin/env python3
"""Train the frozen Stage-1 MoE control on the frozen EEL target.

No target/model selection occurs here. Train fits model parameters,
Validation fits calibration/cluster thresholds, and Test is scored once.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


FINAL = Path("/Users/hmode/Documents/Codex/EngageVision_Final_EEL")
RUNTIME = FINAL / "model" / "runtime"
TRAINING = FINAL / "model" / "training"
OUTPUT = FINAL / "model" / "training_output"
TARGET_VALUES = FINAL / "model" / "eel_target_values.csv.gz"
MODEL_PATH = FINAL / "model" / "final_engagevision_eel_moe_bundle.pkl"
TARGET_VERSION = "EEL_V1_W40_C60_BOOTSTRAP_HAC"
MODEL_VERSION = "ENGAGEVISION_MOE_EEL_V1"

# These must be set before importing any app module because the frozen source
# imports configuration constants at module-import time.
os.environ["TARGET_COL"] = "engagement_class_eel"
os.environ["OUTPUT_DIR"] = str(OUTPUT)
os.environ["MODEL_BUNDLE_PATH"] = str(MODEL_PATH)
sys.path.insert(0, str(RUNTIME))
sys.path.insert(0, str(TRAINING))

import joblib  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import pymysql  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    accuracy_score, average_precision_score, brier_score_loss,
    confusion_matrix, f1_score, fbeta_score, precision_score,
    recall_score, roc_auc_score,
)

import base_moe_reference as base  # noqa: E402
from app.data_loader import clean_data  # noqa: E402
from app.feature_engineering import add_app_ready_interaction_features  # noqa: E402


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while block := handle.read(8 * 1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def load_eel_multimodal_data() -> pd.DataFrame:
    env_path = Path(os.getenv("ENGAGEVISION_ENV_FILE", FINAL / ".env"))
    file_config = read_env(env_path)
    config = {
        "host": os.getenv("DB_HOST", file_config.get("DB_HOST", "localhost")),
        "port": int(os.getenv("DB_PORT", file_config.get("DB_PORT", "3306"))),
        "user": os.getenv("DB_USER", file_config.get("DB_USER", "root")),
        "password": os.getenv("DB_PASSWORD", file_config.get("DB_PASSWORD", "")),
        "database": os.getenv("DB_NAME", file_config.get("DB_NAME", "safespace")),
    }
    text_cols = ",\n        ".join(f"t.text_emb_{i}" for i in range(384))
    image_cols = ",\n        ".join(f"im.img_emb_{i}" for i in range(512))
    query = f"""
    SELECT
      s.post_id, s.username, s.post_date,
      s.post_type, s.predicted_post_type, s.post_type_confidence,
      s.img_height, s.img_width, s.img_brightness, s.img_contrast,
      s.img_colorfulness, s.img_blur_score,
      s.text_length, s.word_count, s.hashtag_count,
      s.img_aspect_ratio, s.img_megapixels,
      s.language, s.post_hour, s.post_month, s.day_of_week,
      s.text_image_similarity, s.sentiment_score, s.sentiment_numeric,
      s.emotion_strength,
      {text_cols},
      {image_cols},
      s.engagement_class_eel
    FROM engagevision_final_eel.safespace s
    JOIN safespace.text_embeddings t ON s.post_id = t.post_id
    JOIN safespace.image_embeddings im ON s.post_id = im.post_id
    WHERE s.engagement_class_eel IS NOT NULL
    """
    connection = pymysql.connect(**config)
    try:
        frame = pd.read_sql(query, connection)
    finally:
        connection.close()
    return frame


def expected_calibration_error(y_true, probability, n_bins: int = 10) -> float:
    y_true = np.asarray(y_true, dtype=float)
    probability = np.asarray(probability, dtype=float)
    bins = np.linspace(0, 1, n_bins + 1)
    total = 0.0
    for index in range(n_bins):
        if index < n_bins - 1:
            mask = (probability >= bins[index]) & (probability < bins[index + 1])
        else:
            mask = (probability >= bins[index]) & (probability <= bins[index + 1])
        if mask.any():
            total += mask.mean() * abs(y_true[mask].mean() - probability[mask].mean())
    return float(total)


def metrics(y_true, probability, prediction) -> dict[str, float | int]:
    tn, fp, fn, tp = confusion_matrix(y_true, prediction, labels=[0, 1]).ravel()
    return {
        "accuracy": float(accuracy_score(y_true, prediction)),
        "precision": float(precision_score(y_true, prediction, zero_division=0)),
        "recall": float(recall_score(y_true, prediction, zero_division=0)),
        "specificity": float(tn / (tn + fp)),
        "f1": float(f1_score(y_true, prediction, zero_division=0)),
        "fbeta_1_25": float(fbeta_score(y_true, prediction, beta=1.25, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, probability)),
        "pr_auc": float(average_precision_score(y_true, probability)),
        "brier_score": float(brier_score_loss(y_true, probability)),
        "ece": expected_calibration_error(y_true, probability),
        "TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp),
    }


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    started = datetime.now(timezone.utc)
    print(f"[{started.isoformat()}] Loading the exact EEL SQL join", flush=True)
    frame = clean_data(load_eel_multimodal_data())
    if len(frame) != 88419 or frame["post_id"].nunique() != 88419:
        raise RuntimeError(f"Unexpected cleaned EEL population: {len(frame)} rows")

    manifest = pd.read_csv(TARGET_VALUES, dtype={"post_id": str})[
        ["post_id", "split", "engagement_class_eel"]
    ]
    frame["post_id"] = frame["post_id"].astype(str)
    frame = frame.merge(
        manifest.rename(columns={"engagement_class_eel": "manifest_label"}),
        on="post_id", how="left", validate="one_to_one",
    )
    if frame["split"].isna().any():
        raise RuntimeError("The SQL join does not match the frozen split manifest")
    if not np.array_equal(frame["engagement_class_eel"].values, frame["manifest_label"].values):
        raise RuntimeError("SQL EEL labels differ from the frozen target artifact")
    train_idx = frame.index[frame["split"] == "train"]
    validation_idx = frame.index[frame["split"] == "validation"]
    test_idx = frame.index[frame["split"] == "test"]
    if (len(train_idx), len(validation_idx), len(test_idx)) != (61893, 13263, 13263):
        raise RuntimeError("Frozen split sizes changed")

    # `split` is manifest metadata, not a model input.  Derive the frozen row
    # indices first, then remove it before feature-group discovery so the
    # preprocessor never receives a string-valued pseudo-feature.
    frame = frame.drop(columns=["manifest_label", "split"])
    frame = add_app_ready_interaction_features(frame)

    print("Training frozen Stage-1 MoE control; Test is score-only", flush=True)
    result = base.fit_moe(
        frame, train_idx, validation_idx, "EEL_FINAL_STAGE1_CONTROL",
        extra_idx=test_idx,
    )
    pieces = result["pieces"]
    test = result["extra"]
    test_metrics = metrics(test["y"], test["proba"], test["pred"])
    created_at = datetime.now(timezone.utc).isoformat()

    prohibited = {
        "likes", "comment_count", "expected_likes_eel", "expected_comments_eel",
        "like_residual_eel", "comment_residual_eel", "like_percentile_eel",
        "comment_percentile_eel", "expected_engagement_lift_score",
        "eel_hac_boundary", "engagement_class_eel", "engagement_score_pro",
        "engagement_class", "cluster_k2", "username", "post_id", "post_url",
    }
    found = sorted(prohibited.intersection(pieces["feature_columns"]))
    if found:
        raise RuntimeError(f"Leakage/identifier features found: {found}")

    legacy_path = FINAL / "model" / "legacy" / "final_model_bundle_legacy_v1.pkl"
    bundle = {
        "type": "cluster_adaptive_mixture_of_experts",
        "model_name": "EngageVision MoE trained on Expected Engagement Lift",
        "model_version": MODEL_VERSION,
        "target_version": TARGET_VERSION,
        "method_name": "Expected Engagement Lift",
        "compatibility_version": "engagevision_bundle_v2",
        "created_at": created_at,
        "random_state": 42,
        "model_config": {"content_k": 12, "text_pca": 64, "image_pca": 64},
        "global_pipelines": pieces["global_pipelines"],
        "experts": pieces["experts"],
        "content_cluster_artifacts": pieces["content_cluster_artifacts"],
        "feature_columns": pieces["feature_columns"],
        "feature_order": pieces["feature_columns"],
        "numeric_columns": pieces["numeric_columns"],
        "categorical_columns": pieces["categorical_columns"],
        "text_embedding_columns": pieces["text_embedding_columns"],
        "image_embedding_columns": pieces["image_embedding_columns"],
        "weights": pieces["weights"],
        "alpha_global": pieces["alpha_global"],
        "alpha_map": pieces["alpha_map"],
        "threshold_map": pieces["threshold_map"],
        "fallback_threshold": pieces["fallback_threshold"],
        "threshold_beta": 1.25,
        "calibrator": pieces["calibrator"],
        "calibrated": True,
        "class_labels": {0: "Low Expected Engagement Lift", 1: "High Expected Engagement Lift"},
        "clip_recommendation_rules": {},
        "uses_username": False,
        "uses_user_history": False,
        "uses_clip_post_type_inside_predictor": False,
        "clip_used_as_app_layer": True,
        "test_metrics": test_metrics,
        "metrics": test_metrics,
        "training_metadata": {
            "train_rows": len(train_idx), "validation_rows": len(validation_idx),
            "test_rows": len(test_idx), "train_high_rate": float(frame.loc[train_idx, "engagement_class_eel"].mean()),
            "validation_high_rate": float(frame.loc[validation_idx, "engagement_class_eel"].mean()),
            "test_high_rate": float(frame.loc[test_idx, "engagement_class_eel"].mean()),
            "source_post_id_manifest_sha256": "28f623f8c2fbb6c1c6b26986ffa18b9376e84b8998c30a601e3100c3c7ab24bc",
            "source_commit": "unavailable: original repository has no commits",
            "training_code_sha256": sha256(Path(__file__)),
            "target_artifact_sha256": sha256(TARGET_VALUES),
        },
        "rollback": {
            "legacy_model_version": "LEGACY_V1",
            "legacy_bundle_relative_path": "legacy/final_model_bundle_legacy_v1.pkl",
            "legacy_bundle_sha256": sha256(legacy_path),
        },
        "limitations": [
            "Target differs from the legacy target; metric values are not same-task gains.",
            "Selected expectation family had 9/18 converged audited fits.",
            "Only six accounts; unseen-account performance is not established.",
            "The fixed Test was inspected in prior studies and is not a pristine future holdout.",
        ],
    }
    joblib.dump(bundle, MODEL_PATH, compress=3)

    prediction_frame = pd.DataFrame({
        "post_id": frame.loc[test_idx, "post_id"].values,
        "username": frame.loc[test_idx, "username"].values,
        "true_label": test["y"],
        "predicted_probability": test["proba"],
        "predicted_label": test["pred"],
        "content_cluster": test["clusters"],
    })
    prediction_frame.to_csv(OUTPUT / "eel_test_predictions.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame({"feature": pieces["feature_columns"]}).to_csv(
        OUTPUT / "feature_schema.csv", index=False, encoding="utf-8-sig"
    )
    (FINAL / "model" / "MODEL_METRICS.json").write_text(
        json.dumps(test_metrics, indent=2), encoding="utf-8"
    )
    manifest_out = {
        "model_version": MODEL_VERSION,
        "target_version": TARGET_VERSION,
        "bundle_path": str(MODEL_PATH),
        "bundle_sha256": sha256(MODEL_PATH),
        "bundle_size_bytes": MODEL_PATH.stat().st_size,
        "created_at": created_at,
        "feature_count": len(pieces["feature_columns"]),
        "expert_count": len(pieces["experts"]),
        "global_models": list(pieces["global_pipelines"]),
        "test_metrics": test_metrics,
    }
    (FINAL / "model" / "MODEL_BUNDLE_MANIFEST.json").write_text(
        json.dumps(manifest_out, indent=2), encoding="utf-8"
    )
    print(json.dumps(manifest_out, indent=2), flush=True)


if __name__ == "__main__":
    main()
