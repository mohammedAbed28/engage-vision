"""
train_final_model.py
=====================

Trains the FINAL selected model for the Multimodal Engagement Prediction
project and saves one deployable bundle: outputs/final_model_bundle.pkl.

Final selected model:  Cluster-Adaptive Mixture of Experts
                        with Hard-Example (error-based) Retraining
                        ("Cluster-Adaptive Global + Expert Blend",
                        "Adaptive Alpha + Cluster Threshold")

The MODEL ARCHITECTURE (global weighted ensemble + per-content-cluster
expert models + adaptive alpha blend + isotonic calibration + cluster
thresholds) is defined in app/moe.py (train_cluster_experts,
get_expert_predictions, tune_global_expert_blend, tune_cluster_expert_blend,
apply_cluster_alpha_blend) together with app/models.py (build_global_models,
build_expert_model). That architecture is unchanged by hard-example
retraining. Hard-Example Retraining is a TRAINING PROCEDURE on top of that
same architecture (see fit_moe() below and STAGE 1/STAGE 2 in main()):
train an initial model, find the rows it gets wrong on a held-out mining
split, add those rows back into training, and retrain the identical
architecture from scratch on the enlarged ("augmented") training set. This
used to live only in an experimental script
(outputs/archive/experiments/train_hard_example_experiment.py); it is now
part of the official, reproducible training procedure below, because that
experiment's candidate is the model that was actually promoted to
production after a leakage-free confirmatory check (see
outputs/final_confirmatory_report.md and
outputs/final_submission/final_model_decision_report.md).

Global ensemble:        RandomForest, ExtraTrees, XGBoost, CatBoost,
                        weighted-average combined (weights grid-searched
                        on validation)
Experts:                One ExtraTrees model per content cluster with
                        enough data (content_k=12)
Blend:                  Per-cluster adaptive alpha (global vs. expert
                        weight), shrunk toward a single global-best alpha
                        by cluster sample size
Calibration:            Isotonic regression, fit on the blended
                        validation-set probabilities
Decision logic:         Content-cluster-specific thresholds (F-beta=1.25),
                        shrunk toward the global threshold by cluster
                        sample size

WHY THIS ARCHITECTURE (over the simpler calibrated-stacking alternative
that was tried in a later iteration of this project): this is an
imbalanced-data problem (~29% High Engagement) where the project goal is
to catch as many actual High-Engagement posts as possible. The stacking
alternative had higher ROC-AUC and precision, but lower F1 and notably
lower Recall. Since F1 is the primary selection metric and Recall the
secondary one here (ROC-AUC only needs to stay reasonably high, not be
maximized), the Mixture-of-Experts architecture is the final selection —
see README.md "Model search log" for the full, honest comparison including
everything that was tried and rejected.

WHY HARD-EXAMPLE RETRAINING: on top of the architecture choice above, the
model is additionally retrained on its own mistakes (leakage-safe, see
below), which was verified — via a final confirmatory check on a shared
test set none of the compared candidates ever trained/tuned on — to
improve F1 and Recall over the plain (non-retrained) MoE with a negligible
ROC-AUC cost. See README.md "Model search log", Round 4/5.

TRAINING PROCEDURE (leakage-safe 3-way split within the original 70% train
split — error mining and final evaluation always use disjoint data):
  1. Original 70/15/15 stratified split -> train_idx / val_idx / test_idx
     (random_state=42). test_idx is "final_test_clean" — touched by
     nothing except the single final evaluation at the end.
  2. train_idx is split again (random_state=123) into train_base (80%) and
     error_mining_validation (20%).
  3. STAGE 1: an initial Cluster-Adaptive MoE is trained on train_base,
     tuned on error_mining_validation, and used to find every misclassified
     row (false positive or false negative) in error_mining_validation.
  4. train_augmented = train_base + all of those misclassified rows
     (added once each — the simplest augmentation strategy, which is the
     one that was actually promoted after the confirmatory check).
  5. STAGE 2: the FINAL Cluster-Adaptive MoE is trained from scratch on
     train_augmented, with ensemble weights / adaptive alpha / isotonic
     calibration / cluster thresholds tuned on the ORIGINAL val_idx (not
     error_mining_validation — this isolates "training-data augmentation"
     as the only change from the plain MoE, and keeps error_mining_validation
     out of the final model's own tuning).
  6. The official final test result is computed on test_idx
     (final_test_clean, ~13k rows) — the same held-out split from step 1,
     never used for mining, training, or tuning at any stage above.

Scientific summary (see README.md for the full version):
This is a multimodal, content-adaptive engagement prediction system. It
predicts High/Low Engagement relative to each account's own historical
baseline (the engagement_class label already encodes that per-account
relativity upstream in the database) rather than one global threshold,
because accounts differ in follower count and exposure level. Content
signals (text, image, sentiment, embeddings, content clusters) drive the
prediction; the final decision combines a global model and content-cluster
expert models using adaptive blend weights and cluster-specific thresholds,
then applies isotonic calibration so the probability shown to the app's
users is trustworthy, not just well-ranked.

Run:
    python train_final_model.py
"""

import json
import os
import shutil
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline as SklearnPipeline
from sklearn.metrics import average_precision_score

from app.config import (
    TARGET_COL, RANDOM_STATE, CONTENT_K, TEXT_PCA_COMPONENTS, IMAGE_PCA_COMPONENTS,
    OUTPUT_DIR, MODEL_BUNDLE_PATH, THRESHOLD_FBETA,
)
from app.data_loader import load_multimodal_data, clean_data
from app.feature_engineering import add_app_ready_interaction_features, define_feature_groups, build_preprocessor
from app.clustering import add_content_clusters, assign_content_cluster_for_inference
from app.clip_layer import run_clip_app_layer_analysis, build_recommendation_rules
from app.models import build_global_models
from app.ensemble import weighted_average_proba, find_best_weighted_ensemble
from app.moe import (
    train_cluster_experts, get_expert_predictions, tune_global_expert_blend,
    tune_cluster_expert_blend, apply_cluster_alpha_blend,
)
from app.thresholds import find_cluster_specific_thresholds, predict_with_cluster_thresholds, evaluate_predictions
from app.reporting import plot_confusion_matrix, plot_roc_curve, plot_pr_curve, plot_calibration_curve, save_classification_report, save_results_csv, save_summary_txt

# Rejected alternative architecture this run is measured against (see
# README.md "Model search log" for the full history). Kept here, not
# re-derived, so the comparison in final_model_results.csv/summary.txt is
# explicit and the two numbers can never silently drift apart.
REJECTED_STACKING_ARCHITECTURE = {
    "model": "REJECTED_Calibrated_Stacking_Ensemble",
    "accuracy": 0.7634, "precision": 0.5851, "recall": 0.6331, "f1_score": 0.6081, "roc_auc": 0.8129,
    "reason": "Higher ROC-AUC/precision but lower F1 and notably lower Recall — not preferred for an "
              "imbalanced High-Engagement-detection goal where F1 is primary and Recall is secondary.",
}

MODEL_NAME = "cluster_adaptive_mixture_of_experts_with_hard_example_retraining"

# Deliberately different from RANDOM_STATE (42, the original 70/15/15
# split) so the train_base / error_mining_validation split is independent
# of it -- matches the random_state used in the original experiment
# (outputs/archive/experiments/train_hard_example_experiment.py) that
# produced the bundle actually promoted to production.
MINING_SPLIT_RANDOM_STATE = 123


def split_data(df):
    y = df[TARGET_COL].copy()
    train_idx, temp_idx, y_train, y_temp = train_test_split(
        df.index, y, test_size=0.30, random_state=RANDOM_STATE, stratify=y
    )
    val_idx, test_idx, y_val, y_test = train_test_split(
        temp_idx, y_temp, test_size=0.50, random_state=RANDOM_STATE, stratify=y_temp
    )
    print(f"Split sizes -> train={len(train_idx):,} val={len(val_idx):,} test={len(test_idx):,}")
    return train_idx, val_idx, test_idx


def split_train_for_error_mining(df, train_idx):
    """Leakage-safe sub-split of the original 70% train_idx, used ONLY for
    hard-example mining (STAGE 1). error_mining_validation is never reused
    as the final model's tuning set (that stays val_idx, from split_data)
    and is never touched again after STAGE 1."""
    y_train_only = df.loc[train_idx, TARGET_COL]
    train_base_idx, error_mining_idx = train_test_split(
        train_idx, test_size=0.20, random_state=MINING_SPLIT_RANDOM_STATE, stratify=y_train_only
    )
    print(f"Error-mining split -> train_base={len(train_base_idx):,} "
          f"error_mining_validation={len(error_mining_idx):,} (random_state={MINING_SPLIT_RANDOM_STATE})")
    return train_base_idx, error_mining_idx


def check_inference_reconstruction_matches_training(df, sample_idx, cluster_artifacts):
    """
    Regression test for the deployment bug documented in
    app/clustering.py: recomputes content_cluster / content_cluster_distance
    / content_cluster_train_high_rate for a sample of rows using the exact
    function predict.py calls at inference time, and asserts it reproduces
    the training-time values. This is what guarantees
    KeyError: ['content_cluster_distance'] cannot happen in the deployed app
    — content_cluster_distance is a real model feature in this architecture.
    """
    sample = df.loc[sample_idx].copy()
    reconstructed = assign_content_cluster_for_inference(cluster_artifacts, sample)

    assert (reconstructed["content_cluster"].values == sample["content_cluster"].values).all(), \
        "content_cluster mismatch between training and inference reconstruction"
    assert np.allclose(reconstructed["content_cluster_distance"].values, sample["content_cluster_distance"].values), \
        "content_cluster_distance mismatch between training and inference reconstruction"
    assert np.allclose(reconstructed["content_cluster_train_high_rate"].values, sample["content_cluster_train_high_rate"].values), \
        "content_cluster_train_high_rate mismatch between training and inference reconstruction"

    print("Inference reconstruction check passed: content_cluster / content_cluster_distance / "
          "content_cluster_train_high_rate all match between training and predict.py's code path.")


def fit_moe(df, fit_idx, tune_idx, label, extra_idx=None):
    """
    Trains one full Cluster-Adaptive Mixture of Experts (content clusters +
    global weighted ensemble + per-cluster experts + adaptive alpha blend +
    isotonic calibration + F-beta=1.25 cluster thresholds) on `fit_idx`,
    tuned on `tune_idx`. The MODEL ARCHITECTURE itself lives in app/moe.py
    (train_cluster_experts, get_expert_predictions, tune_global_expert_blend,
    tune_cluster_expert_blend, apply_cluster_alpha_blend) and app/models.py
    (build_global_models) -- this function is the training PROCEDURE that
    invokes them, reused identically for both the mining-stage model
    (STAGE 1: fit on train_base, tuned on error_mining_validation) and the
    final deployed model (STAGE 2: fit on train_augmented, tuned on the
    original val_idx), so both stages share exactly the same architecture
    and hyperparameters.

    If `extra_idx` is given (used for STAGE 2 to also score the official
    final_test_clean), its calibrated probabilities/predictions are
    computed in the same pass as tune_idx, reusing the already-fitted
    models (no redundant second training or a second disk round-trip).

    Returns a dict with:
      - "pieces": everything needed to reconstruct predictions later
        (global_pipelines, experts, content_cluster_artifacts,
        feature/numeric/categorical/text/image columns, weights,
        alpha_global, alpha_map, calibrator, threshold_map,
        fallback_threshold, threshold_beta).
      - "tune": {"proba", "pred", "clusters", "y"} for tune_idx.
      - "extra": same shape as "tune", only present if extra_idx was given.
    """
    print(f"\n  [{label}] Fitting content clusters (content_k={CONTENT_K}) on {len(fit_idx):,} fit rows...")
    dfc, cluster_artifacts = add_content_clusters(df, fit_idx, n_clusters=CONTENT_K)
    feature_cols, numeric_cols, categorical_cols, text_cols, image_cols = define_feature_groups(dfc)

    X_fit = dfc.loc[fit_idx, feature_cols].copy()
    X_tune = dfc.loc[tune_idx, feature_cols].copy()
    y_fit = dfc.loc[fit_idx, TARGET_COL].copy()
    y_tune = dfc.loc[tune_idx, TARGET_COL].copy()
    tune_clusters = dfc.loc[tune_idx, "content_cluster"].astype(str).values

    X_extra = y_extra = extra_clusters = None
    if extra_idx is not None:
        X_extra = dfc.loc[extra_idx, feature_cols].copy()
        y_extra = dfc.loc[extra_idx, TARGET_COL].copy()
        extra_clusters = dfc.loc[extra_idx, "content_cluster"].astype(str).values

    # --------------------------------------------------------------
    # A. Global weighted ensemble
    # --------------------------------------------------------------
    models = build_global_models(y_fit)
    global_pipelines, tune_proba_dict, extra_proba_dict = {}, {}, {}
    for model_name, model in models.items():
        print(f"  [{label}] Training global model: {model_name}")
        preprocessor = build_preprocessor(numeric_cols, categorical_cols, text_cols, image_cols,
                                           TEXT_PCA_COMPONENTS, IMAGE_PCA_COMPONENTS)
        pipeline = SklearnPipeline(steps=[("preprocessor", preprocessor), ("model", model)])
        pipeline.fit(X_fit, y_fit)

        global_pipelines[model_name] = pipeline
        tune_proba_dict[model_name] = pipeline.predict_proba(X_tune)[:, 1]
        if extra_idx is not None:
            extra_proba_dict[model_name] = pipeline.predict_proba(X_extra)[:, 1]

    best_ensemble = find_best_weighted_ensemble(y_tune, tune_proba_dict, list(global_pipelines.keys()), label)
    weights = best_ensemble["weights"]
    print(f"  [{label}] Best global ensemble weights: {weights}")

    global_tune_proba = weighted_average_proba(tune_proba_dict, weights)
    global_extra_proba = weighted_average_proba(extra_proba_dict, weights) if extra_idx is not None else None

    # --------------------------------------------------------------
    # B. Content-cluster expert models (architecture: app/moe.py)
    # --------------------------------------------------------------
    experts, experts_df = train_cluster_experts(
        dfc, feature_cols, numeric_cols, categorical_cols, text_cols, image_cols,
        fit_idx, tune_idx, TEXT_PCA_COMPONENTS, IMAGE_PCA_COMPONENTS
    )
    print(f"  [{label}] Trained {len(experts)} content-cluster experts.")

    expert_tune_proba = get_expert_predictions(dfc, feature_cols, experts, tune_idx)
    expert_extra_proba = get_expert_predictions(dfc, feature_cols, experts, extra_idx) if extra_idx is not None else None

    # --------------------------------------------------------------
    # C. Adaptive global/expert blend (architecture: app/moe.py)
    # --------------------------------------------------------------
    global_blend_best = tune_global_expert_blend(y_tune, global_tune_proba, expert_tune_proba, tune_clusters)
    alpha_global_anchor = global_blend_best["alpha_global"]

    alpha_map, alpha_df = tune_cluster_expert_blend(
        y_tune, global_tune_proba, expert_tune_proba, tune_clusters, global_alpha=alpha_global_anchor
    )

    adaptive_tune_proba = apply_cluster_alpha_blend(global_tune_proba, expert_tune_proba, tune_clusters, alpha_map)
    adaptive_extra_proba = (
        apply_cluster_alpha_blend(global_extra_proba, expert_extra_proba, extra_clusters, alpha_map)
        if extra_idx is not None else None
    )

    # --------------------------------------------------------------
    # D. Isotonic calibration, fit on tune_idx only
    # --------------------------------------------------------------
    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(np.asarray(adaptive_tune_proba), np.asarray(y_tune))

    calibrated_tune_proba = calibrator.transform(np.asarray(adaptive_tune_proba))
    calibrated_extra_proba = (
        calibrator.transform(np.asarray(adaptive_extra_proba)) if extra_idx is not None else None
    )

    # --------------------------------------------------------------
    # E. Cluster-specific decision thresholds (F-beta=1.25, Recall-weighted)
    # --------------------------------------------------------------
    threshold_map, threshold_df, fallback_threshold = find_cluster_specific_thresholds(
        y_tune, calibrated_tune_proba, tune_clusters, beta=THRESHOLD_FBETA
    )
    tune_pred = predict_with_cluster_thresholds(calibrated_tune_proba, tune_clusters, threshold_map, fallback_threshold)
    extra_pred = (
        predict_with_cluster_thresholds(calibrated_extra_proba, extra_clusters, threshold_map, fallback_threshold)
        if extra_idx is not None else None
    )

    pieces = {
        "global_pipelines": global_pipelines,
        "experts": experts,
        "content_cluster_artifacts": cluster_artifacts,
        "feature_columns": feature_cols,
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "text_embedding_columns": text_cols,
        "image_embedding_columns": image_cols,
        "weights": weights,
        "alpha_global": alpha_global_anchor,
        "alpha_map": alpha_map,
        "threshold_map": threshold_map,
        "threshold_df": threshold_df,
        "fallback_threshold": fallback_threshold,
        "calibrator": calibrator,
        "fit_rows": len(fit_idx),
        "tune_rows": len(tune_idx),
    }
    result = {
        "pieces": pieces,
        "dfc": dfc,
        "tune": {
            "proba": calibrated_tune_proba, "raw_proba": np.asarray(adaptive_tune_proba),
            "pred": tune_pred, "clusters": tune_clusters, "y": y_tune.values,
        },
    }
    if extra_idx is not None:
        result["extra"] = {"proba": calibrated_extra_proba, "pred": extra_pred, "clusters": extra_clusters, "y": y_extra.values}
    return result


def score_pieces_on_indices(df, pieces, idx):
    """
    Generic scorer: evaluates an already-fitted MoE ("pieces", as returned
    by fit_moe()) on arbitrary rows of the ORIGINAL (unclustered) `df`,
    reconstructing content_cluster / content_cluster_distance /
    content_cluster_train_high_rate via the frozen cluster artifacts --
    the exact same function predict.py uses at inference time
    (assign_content_cluster_for_inference), so this matches real inference
    exactly rather than reusing values already baked into some other
    already-clustered dataframe.

    Used by main() for the hard-example LEARNING VERIFICATION step: scoring
    the final (STAGE 2) model on hard_example_idx, the exact rows the
    STAGE 1 mining model got wrong and that were then added into
    train_augmented. This is an internal sanity check, not the official
    generalization test (that remains final_test_clean, scored inline
    inside fit_moe's own STAGE 2 call via extra_idx).
    """
    sub = assign_content_cluster_for_inference(pieces["content_cluster_artifacts"], df.loc[idx])
    X = sub[pieces["feature_columns"]].copy()

    weights = pieces["weights"]
    global_proba = None
    for name, w in weights.items():
        if w == 0:
            continue
        p = pieces["global_pipelines"][name].predict_proba(X)[:, 1]
        global_proba = w * p if global_proba is None else global_proba + w * p

    clusters = sub["content_cluster"].astype(str).values
    expert_proba = np.full(len(idx), np.nan)
    for cluster_id, pipe in pieces["experts"].items():
        mask = clusters == str(cluster_id)
        if mask.sum() == 0:
            continue
        expert_proba[mask] = pipe.predict_proba(X[mask])[:, 1]

    alpha_map = pieces.get("alpha_map", {})
    alpha_arr = np.array([alpha_map.get(c, pieces.get("alpha_global", 1.0)) for c in clusters])
    expert_filled = np.where(pd.isna(expert_proba), global_proba, expert_proba)
    raw_proba = alpha_arr * global_proba + (1 - alpha_arr) * expert_filled

    calibrated_proba = pieces["calibrator"].transform(raw_proba)
    threshold_map = pieces.get("threshold_map", {})
    fallback = pieces.get("fallback_threshold", 0.5)
    thresholds_used = np.array([threshold_map.get(c, fallback) for c in clusters])
    pred = (calibrated_proba >= thresholds_used).astype(int)
    return calibrated_proba, pred, clusters


def find_hard_examples(y_true, y_pred):
    """Identifies every misclassified row (false positive OR false
    negative) in the mining model's predictions on error_mining_validation.
    False negatives get special attention downstream (see main()) because
    Recall is the secondary selection metric for this imbalanced,
    High-Engagement-detection goal — a false negative is a real
    High-Engagement post the model missed."""
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    fp_mask = (y_pred == 1) & (y_true == 0)
    fn_mask = (y_pred == 0) & (y_true == 1)
    return (fp_mask | fn_mask), fp_mask, fn_mask


def backup_existing_bundle():
    """Backs up any existing outputs/final_model_bundle.pkl to a
    timestamped file in outputs/archive/ BEFORE it gets overwritten below.
    Never deletes anything — if this is the very first run, there is
    nothing to back up."""
    if not os.path.exists(MODEL_BUNDLE_PATH):
        print("No existing final_model_bundle.pkl to back up (first run).")
        return None
    archive_dir = os.path.join(OUTPUT_DIR, "archive")
    os.makedirs(archive_dir, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = os.path.join(archive_dir, f"final_model_bundle_backup_{timestamp}.pkl")
    shutil.copy2(MODEL_BUNDLE_PATH, backup_path)
    print(f"Backed up existing final_model_bundle.pkl -> {backup_path}")
    return backup_path


def main():
    print("=" * 100)
    print("TRAINING FINAL SELECTED MODEL")
    print("Cluster-Adaptive Mixture of Experts WITH Hard-Example Retraining")
    print(f"content_k={CONTENT_K} | text_pca={TEXT_PCA_COMPONENTS} | image_pca={IMAGE_PCA_COMPONENTS} | "
          f"threshold_beta={THRESHOLD_FBETA}")
    print("=" * 100)

    backup_path = backup_existing_bundle()

    # 1) Load + clean
    df = load_multimodal_data()
    df = clean_data(df)

    # 2) CLIP application layer (report/recommendation context only — never a model feature)
    clip_summary = run_clip_app_layer_analysis(df)
    clip_recommendation_rules = build_recommendation_rules(clip_summary)

    # 3) App-ready interaction features (identical function used in predict.py)
    df = add_app_ready_interaction_features(df)

    # 4) Original 70/15/15 split. test_idx = "final_test_clean": touched by
    #    nothing else in this script except the single final evaluation.
    train_idx, val_idx, test_idx = split_data(df)

    # 5) Leakage-safe sub-split of train_idx for hard-example mining.
    train_base_idx, error_mining_idx = split_train_for_error_mining(df, train_idx)

    # ================================================================
    # STAGE 1 — mining model: train on train_base, tune + evaluate on
    # error_mining_validation, find every misclassified row.
    # ================================================================
    print("\n" + "=" * 100)
    print("STAGE 1: Training mining model on train_base to find hard examples...")
    print("=" * 100)
    mining_result = fit_moe(df, train_base_idx, error_mining_idx, "mining")
    mining_tune = mining_result["tune"]

    misclassified_mask, fp_mask, fn_mask = find_hard_examples(mining_tune["y"], mining_tune["pred"])
    error_mining_idx_arr = np.array(error_mining_idx)
    hard_example_idx = error_mining_idx_arr[misclassified_mask]

    n_fp, n_fn = int(fp_mask.sum()), int(fn_mask.sum())
    n_total_errors = int(misclassified_mask.sum())
    mining_metrics = evaluate_predictions(mining_tune["y"], mining_tune["pred"], mining_tune["proba"])
    mining_metrics["pr_auc"] = average_precision_score(mining_tune["y"], mining_tune["proba"])
    print(f"\nMining model on error_mining_validation: " +
          ", ".join(f"{k}={v:.4f}" for k, v in mining_metrics.items()))
    print(f"Hard examples found: {n_total_errors:,} total "
          f"({n_fp:,} false positives, {n_fn:,} false negatives) out of {len(error_mining_idx):,} rows "
          f"({n_total_errors/len(error_mining_idx)*100:.1f}% error rate).")

    # ================================================================
    # STAGE 2 — FINAL model: retrain the identical architecture from
    # scratch on train_augmented = train_base + all misclassified rows
    # (added once each), tuned on the ORIGINAL val_idx, and evaluated on
    # the official final_test_clean (test_idx).
    # ================================================================
    train_augmented_idx = pd.Index(list(train_base_idx) + list(hard_example_idx)).unique()
    print(f"\ntrain_augmented = train_base ({len(train_base_idx):,}) + hard examples ({len(hard_example_idx):,}) "
          f"= {len(train_augmented_idx):,} rows")

    print("\n" + "=" * 100)
    print("STAGE 2: Training FINAL model on train_augmented "
          "(tuned on the original val_idx, evaluated on final_test_clean)...")
    print("=" * 100)
    final_result = fit_moe(df, train_augmented_idx, val_idx, "final_model", extra_idx=test_idx)
    pieces = final_result["pieces"]
    test = final_result["extra"]

    # Use the clustered dataframe fit_moe() built internally (has
    # content_cluster / content_cluster_distance /
    # content_cluster_train_high_rate populated) -- NOT the original `df`,
    # which never gets these columns added in the caller's scope.
    check_inference_reconstruction_matches_training(final_result["dfc"], val_idx[:200], pieces["content_cluster_artifacts"])

    pieces["threshold_df"].to_csv(f"{OUTPUT_DIR}/final_model_cluster_thresholds.csv", index=False, encoding="utf-8-sig")

    test_metrics = evaluate_predictions(test["y"], test["pred"], test["proba"])
    test_metrics["pr_auc"] = average_precision_score(test["y"], test["proba"])

    print("\n" + "=" * 100)
    print("FINAL TEST-SET METRICS (Cluster-Adaptive MoE + Hard-Example Retraining, calibrated) "
          "-- computed on final_test_clean")
    print("=" * 100)
    for k, v in test_metrics.items():
        print(f"  {k}: {v:.4f}")

    plot_confusion_matrix(test["y"], test["pred"])
    plot_roc_curve(test["y"], test["proba"])
    plot_pr_curve(test["y"], test["proba"])
    plot_calibration_curve(final_result["tune"]["y"],
                            final_result["tune"]["raw_proba"], final_result["tune"]["proba"])
    save_classification_report(test["y"], test["pred"])

    # Hard-example learning verification (an internal sanity check on
    # whether the model actually relearns the rows injected via
    # hard-example retraining, as opposed to the official generalization
    # result above) was performed separately and archived under
    # outputs/archive/verification/hard_example_learning/ -- see
    # run_hard_example_learning_verification.py there and
    # CODE_STRUCTURE.md in the project root for why it is kept separate
    # from this training script.

    # --------------------------------------------------------------
    # Save the deployable bundle. "type" is kept exactly
    # "cluster_adaptive_mixture_of_experts" (architecture identifier,
    # relied on by audit_data_pipeline.py) -- the hard-example-retraining
    # distinction lives in "model_name" and "hard_example_experiment"
    # below, not in "type".
    # --------------------------------------------------------------
    created_at = datetime.now(timezone.utc).isoformat()
    feature_cols = pieces["feature_columns"]
    experts = pieces["experts"]

    bundle = {
        "type": "cluster_adaptive_mixture_of_experts",
        "model_name": MODEL_NAME,
        "created_at": created_at,
        "random_state": RANDOM_STATE,

        "model_config": {
            "content_k": CONTENT_K,
            "text_pca": TEXT_PCA_COMPONENTS,
            "image_pca": IMAGE_PCA_COMPONENTS,
        },

        "global_pipelines": pieces["global_pipelines"],
        "experts": experts,
        "content_cluster_artifacts": pieces["content_cluster_artifacts"],

        "feature_columns": feature_cols,
        "numeric_columns": pieces["numeric_columns"],
        "categorical_columns": pieces["categorical_columns"],
        "text_embedding_columns": pieces["text_embedding_columns"],
        "image_embedding_columns": pieces["image_embedding_columns"],

        "weights": pieces["weights"],
        "alpha_global": pieces["alpha_global"],
        "alpha_map": pieces["alpha_map"],
        "threshold_map": pieces["threshold_map"],
        "fallback_threshold": pieces["fallback_threshold"],
        "threshold_beta": THRESHOLD_FBETA,
        "calibrator": pieces["calibrator"],
        "calibrated": True,

        "clip_recommendation_rules": clip_recommendation_rules,

        "uses_username": False,
        "uses_user_history": False,
        "uses_clip_post_type_inside_predictor": False,
        "clip_used_as_app_layer": True,
        "test_metrics": test_metrics,
        "rejected_stacking_architecture": REJECTED_STACKING_ARCHITECTURE,

        # Hard-example retraining provenance -- how train_augmented was built.
        "hard_example_experiment": {
            "train_base_rows": len(train_base_idx),
            "error_mining_validation_rows": len(error_mining_idx),
            "hard_examples_added": len(hard_example_idx),
            "false_positives_in_mining_validation": n_fp,
            "false_negatives_in_mining_validation": n_fn,
            "train_augmented_rows": len(train_augmented_idx),
            "mining_split_random_state": MINING_SPLIT_RANDOM_STATE,
            "mining_model_metrics_on_error_mining_validation": mining_metrics,
        },

        "notes": (
            "Final selected model: Cluster-Adaptive Mixture of Experts with Hard-Example "
            "(error-based) Retraining. Global weighted ensemble (RandomForest, ExtraTrees, "
            "XGBoost, CatBoost) blended with per-content-cluster expert models using an "
            "adaptive, sample-size-shrunk alpha, isotonic calibration, and cluster-specific "
            "F-beta=1.25 decision thresholds -- trained on train_augmented (train_base + all "
            "misclassified rows found on a held-out error_mining_validation split), tuned on "
            "the original val_idx, evaluated on the official final_test_clean. Selected over "
            "the plain (non-retrained) MoE and over a calibrated stacking ensemble alternative "
            "because F1 (primary) and Recall (secondary) matter more than ROC-AUC alone for "
            "this imbalanced, High-Engagement-detection goal. CLIP post-type detection is a "
            "separate application layer for recommendations, not a prediction feature."
        ),
    }

    joblib.dump(bundle, MODEL_BUNDLE_PATH, compress=3)
    print(f"\nSaved final model bundle to: {MODEL_BUNDLE_PATH}")

    # --------------------------------------------------------------
    # Reports
    # --------------------------------------------------------------
    all_results = [
        {"model": "FINAL_cluster_adaptive_moe_with_hard_example_retraining", "selected_as_final": "yes", **test_metrics,
         "reason": "Best F1 and Recall while keeping ROC-AUC reasonably high — primary/secondary metrics for "
                   "this imbalanced-data goal. Verified via a leakage-free confirmatory check against the "
                   "plain (non-retrained) MoE and other candidates."},
        {"model": REJECTED_STACKING_ARCHITECTURE["model"], "selected_as_final": "no",
         "accuracy": REJECTED_STACKING_ARCHITECTURE["accuracy"], "precision": REJECTED_STACKING_ARCHITECTURE["precision"],
         "recall": REJECTED_STACKING_ARCHITECTURE["recall"], "f1_score": REJECTED_STACKING_ARCHITECTURE["f1_score"],
         "roc_auc": REJECTED_STACKING_ARCHITECTURE["roc_auc"], "pr_auc": None,
         "reason": REJECTED_STACKING_ARCHITECTURE["reason"]},
    ]
    results_df = save_results_csv(all_results)

    summary_lines = [
        "FINAL MODEL SUMMARY",
        "=" * 60,
        f"Generated: {created_at}",
        "",
        "Final selected model: Cluster-Adaptive Mixture of Experts with Hard-Example Retraining.",
        "  (a.k.a. Cluster-Adaptive Global + Expert Blend / Adaptive Alpha + Cluster Threshold, "
        "retrained on train_augmented)",
        "Global ensemble: RandomForest, ExtraTrees, XGBoost, CatBoost (weighted average)",
        f"Experts: {len(experts)} content-cluster ExtraTrees experts (content_k={CONTENT_K})",
        "Blend: per-cluster adaptive alpha, shrunk toward the global-best alpha by cluster sample size",
        "Calibration: Isotonic regression",
        f"Decision logic: content-cluster-specific thresholds (F-beta={THRESHOLD_FBETA}), shrunk toward the "
        f"global fallback threshold ({pieces['fallback_threshold']:.4f}) by cluster sample size",
        f"Feature config: text_pca={TEXT_PCA_COMPONENTS}, image_pca={IMAGE_PCA_COMPONENTS}, "
        f"{len(feature_cols)} total input features (no username, no user history, CLIP post-type "
        f"used only as an app-layer recommendation signal, never a model feature)",
        "",
        "HARD-EXAMPLE RETRAINING:",
        f"  train_base: {len(train_base_idx):,} rows",
        f"  error_mining_validation: {len(error_mining_idx):,} rows",
        f"  false positives found: {n_fp:,}",
        f"  false negatives found: {n_fn:,}",
        f"  hard examples added to training: {len(hard_example_idx):,}",
        f"  train_augmented (final training set): {len(train_augmented_idx):,} rows",
        "",
        "FINAL TEST-SET METRICS (computed on final_test_clean):",
    ]
    for k, v in test_metrics.items():
        summary_lines.append(f"  {k}: {v:.4f}")
    summary_lines += [
        "",
        "OPTIONAL / ARCHIVED HARD-EXAMPLE LEARNING VERIFICATION:",
        "  A separate sanity check (NOT the official generalization test above, and NOT used",
        "  for model selection) verifies that the model actually relearns the specific",
        "  mistakes injected via hard-example retraining. It is archived, not part of this",
        "  run, at: outputs/archive/verification/hard_example_learning/",
        "  (run_hard_example_learning_verification.py, "
        "hard_example_learning_verification_summary.txt).",
        "",
        "REJECTED ALTERNATIVE (Calibrated Stacking Ensemble) FOR REFERENCE:",
        f"  accuracy: {REJECTED_STACKING_ARCHITECTURE['accuracy']:.4f}",
        f"  precision: {REJECTED_STACKING_ARCHITECTURE['precision']:.4f}",
        f"  recall: {REJECTED_STACKING_ARCHITECTURE['recall']:.4f}",
        f"  f1_score: {REJECTED_STACKING_ARCHITECTURE['f1_score']:.4f}",
        f"  roc_auc: {REJECTED_STACKING_ARCHITECTURE['roc_auc']:.4f}",
        f"  reason rejected: {REJECTED_STACKING_ARCHITECTURE['reason']}",
        "",
        "VERDICT: see README.md 'Model search log' for the full comparison and the multi-metric "
        "selection rule (F1 primary, Recall secondary, ROC-AUC must stay reasonably high).",
    ]
    save_summary_txt(summary_lines)

    metadata = {
        "model": MODEL_NAME,
        "created_at": created_at,
        "train_base_rows": len(train_base_idx),
        "error_mining_validation_rows": len(error_mining_idx),
        "hard_examples_added": len(hard_example_idx),
        "false_positives_in_mining_validation": n_fp,
        "false_negatives_in_mining_validation": n_fn,
        "train_augmented_rows": len(train_augmented_idx),
        "final_test_clean_metrics": test_metrics,
        "archived_learning_verification": {
            "description": "Optional sanity check (NOT part of official model metrics) verifying "
                            "the model relearns the mistakes injected via hard-example retraining.",
            "location": "outputs/archive/verification/hard_example_learning/",
        },
        "threshold_beta": THRESHOLD_FBETA,
        "content_k": CONTENT_K,
        "text_pca": TEXT_PCA_COMPONENTS,
        "image_pca": IMAGE_PCA_COMPONENTS,
        "feature_columns_count": len(feature_cols),
        "num_experts_trained": len(experts),
        "rejected_stacking_architecture": REJECTED_STACKING_ARCHITECTURE,
        "model_config": bundle["model_config"],
        "backed_up_previous_bundle_to": backup_path,
    }
    with open(f"{OUTPUT_DIR}/final_model_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, default=str)

    print("\nDONE. Train final selected model (with hard-example retraining) completed.")
    print(results_df.to_string(index=False))


if __name__ == "__main__":
    main()
