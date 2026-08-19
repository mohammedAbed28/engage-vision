"""
Mixture-of-Experts: per-content-cluster expert models, and the adaptive
global/expert blending that is this project's final selected decision logic
(Cluster-Adaptive Global + Expert Blend, a.k.a. Adaptive Alpha + Cluster
Threshold).
"""

import os

import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline as SklearnPipeline

from app.config import MIN_EXPERT_TRAIN_SIZE, MIN_EXPERT_VAL_SIZE, TARGET_COL, OUTPUT_DIR
from app.feature_engineering import build_preprocessor
from app.models import build_expert_model
from app.thresholds import find_best_f1_threshold, evaluate_with_threshold
from app.clustering import shrink_toward_global


def train_cluster_experts(df, feature_cols, numeric_cols, categorical_cols, text_cols, image_cols,
                           train_idx, val_idx, text_pca, image_pca, sample_weight=None):
    """Trains one ExtraTrees expert per content cluster that has enough data
    (>= MIN_EXPERT_TRAIN_SIZE train rows, >= MIN_EXPERT_VAL_SIZE val rows,
    both classes present). Clusters that don't qualify simply have no
    expert — the blend falls back to the global model for them.

    `sample_weight`, if given, must be a 1-D array aligned with `train_idx`
    (same order) — used only by experimental sample-weighting scripts
    (e.g. train_hard_example_experiment.py); production training never
    passes this, so its behavior is completely unchanged (default None)."""
    experts = {}
    expert_rows = []

    X_train_all = df.loc[train_idx, feature_cols].copy()
    y_train_all = df.loc[train_idx, TARGET_COL].copy()
    X_val_all = df.loc[val_idx, feature_cols].copy()
    y_val_all = df.loc[val_idx, TARGET_COL].copy()

    clusters_train = df.loc[train_idx, "content_cluster"].astype(str)
    clusters_val = df.loc[val_idx, "content_cluster"].astype(str)

    sample_weight_arr = np.asarray(sample_weight) if sample_weight is not None else None

    for cluster in sorted(df["content_cluster"].astype(str).unique()):
        train_mask = clusters_train == cluster
        val_mask = clusters_val == cluster
        n_train = int(train_mask.sum())
        n_val = int(val_mask.sum())

        if n_train < MIN_EXPERT_TRAIN_SIZE or n_val < MIN_EXPERT_VAL_SIZE:
            expert_rows.append({"content_cluster": cluster, "trained": False, "reason": "not_enough_data", "n_train": n_train, "n_val": n_val})
            continue

        y_cluster = y_train_all[train_mask]
        if y_cluster.nunique() < 2:
            expert_rows.append({"content_cluster": cluster, "trained": False, "reason": "only_one_class", "n_train": n_train, "n_val": n_val})
            continue

        print(f"Training expert for content_cluster={cluster} | train={n_train:,} | val={n_val:,}")

        preprocessor = build_preprocessor(numeric_cols, categorical_cols, text_cols, image_cols, text_pca, image_pca)
        model = build_expert_model(y_cluster)
        pipeline = SklearnPipeline(steps=[("preprocessor", preprocessor), ("model", model)])
        if sample_weight_arr is not None:
            pipeline.fit(X_train_all[train_mask], y_cluster, model__sample_weight=sample_weight_arr[train_mask.values])
        else:
            pipeline.fit(X_train_all[train_mask], y_cluster)

        val_proba_cluster = pipeline.predict_proba(X_val_all[val_mask])[:, 1]
        y_val_cluster = y_val_all[val_mask]
        info = find_best_f1_threshold(y_val_cluster, val_proba_cluster)
        metrics, _ = evaluate_with_threshold(y_val_cluster, val_proba_cluster, info["threshold"])

        experts[cluster] = pipeline
        expert_rows.append({
            "content_cluster": cluster, "trained": True, "reason": "ok",
            "n_train": n_train, "n_val": n_val,
            "validation_threshold": info["threshold"],
            "validation_precision": metrics["precision"],
            "validation_recall": metrics["recall"],
            "validation_f1": metrics["f1_score"],
            "validation_roc_auc": metrics["roc_auc"],
        })

    pd.DataFrame(expert_rows).to_csv(
        os.path.join(OUTPUT_DIR, "content_cluster_expert_training_summary.csv"), index=False, encoding="utf-8-sig"
    )
    return experts, pd.DataFrame(expert_rows)


def get_expert_predictions(df, feature_cols, experts, indices):
    proba = np.full(len(indices), np.nan)
    clusters = df.loc[indices, "content_cluster"].astype(str).values
    X = df.loc[indices, feature_cols].copy()

    for cluster, pipeline in experts.items():
        mask = clusters == str(cluster)
        if mask.sum() == 0:
            continue
        proba[mask] = pipeline.predict_proba(X[mask])[:, 1]

    return proba


def tune_global_expert_blend(y_val, global_val_proba, expert_val_proba, val_clusters):
    """Single global alpha (weight on the global model vs. the expert),
    grid-searched in 0.05 steps. This also serves as the shrinkage anchor
    for the per-cluster adaptive alphas below."""
    rows = []
    best = None

    temp = pd.DataFrame({
        "y": np.array(y_val),
        "global_proba": np.array(global_val_proba),
        "expert_proba": np.array(expert_val_proba),
    })
    temp["expert_proba_filled"] = temp["expert_proba"].fillna(temp["global_proba"])

    for alpha_global in np.round(np.arange(0, 1.01, 0.05), 2):
        alpha_expert = 1 - alpha_global
        blended = alpha_global * temp["global_proba"].values + alpha_expert * temp["expert_proba_filled"].values
        threshold_info = find_best_f1_threshold(temp["y"].values, blended)
        metrics, _ = evaluate_with_threshold(temp["y"].values, blended, threshold_info["threshold"])

        row = {
            "alpha_global": alpha_global, "alpha_expert": alpha_expert,
            "threshold": threshold_info["threshold"],
            "validation_precision": metrics["precision"], "validation_recall": metrics["recall"],
            "validation_f1": metrics["f1_score"], "validation_roc_auc": metrics["roc_auc"],
        }
        rows.append(row)
        if best is None or metrics["f1_score"] > best["validation_f1"]:
            best = row

    pd.DataFrame(rows).sort_values("validation_f1", ascending=False).to_csv(
        os.path.join(OUTPUT_DIR, "global_expert_blend_search.csv"), index=False, encoding="utf-8-sig"
    )
    return best


def tune_cluster_expert_blend(y_val, global_val_proba, expert_val_proba, val_clusters, global_alpha=0.5):
    """Per-cluster adaptive alpha, shrunk toward the single global alpha
    (weighted by that cluster's own validation sample size). Without this
    shrinkage, each cluster independently grid-searches 21 alpha values
    against a validation slice as small as ~250 rows — a multiple-
    comparisons setup that reliably finds a "best" alpha that is partly
    noise."""
    temp = pd.DataFrame({
        "y": np.array(y_val),
        "global_proba": np.array(global_val_proba),
        "expert_proba": np.array(expert_val_proba),
        "content_cluster": np.array(val_clusters).astype(str),
    })
    temp["expert_proba_filled"] = temp["expert_proba"].fillna(temp["global_proba"])

    rows = []
    alpha_map = {}

    for cluster, group in temp.groupby("content_cluster"):
        if group["y"].nunique() < 2 or len(group) < MIN_EXPERT_VAL_SIZE:
            alpha_map[str(cluster)] = 1.0
            rows.append({"content_cluster": str(cluster), "alpha_global": 1.0, "alpha_expert": 0.0, "source": "global_fallback", "n_val": len(group), "validation_f1": np.nan})
            continue

        best = None
        for alpha_global in np.round(np.arange(0, 1.01, 0.05), 2):
            alpha_expert = 1 - alpha_global
            blended = alpha_global * group["global_proba"].values + alpha_expert * group["expert_proba_filled"].values
            threshold_info = find_best_f1_threshold(group["y"].values, blended)
            metrics, _ = evaluate_with_threshold(group["y"].values, blended, threshold_info["threshold"])

            row = {
                "content_cluster": str(cluster), "alpha_global": alpha_global, "alpha_expert": alpha_expert,
                "source": "cluster_specific", "n_val": len(group), "threshold": threshold_info["threshold"],
                "validation_precision": metrics["precision"], "validation_recall": metrics["recall"],
                "validation_f1": metrics["f1_score"], "validation_roc_auc": metrics["roc_auc"],
            }
            if best is None or metrics["f1_score"] > best["validation_f1"]:
                best = row

        raw_alpha = float(best["alpha_global"])
        shrunk_alpha = shrink_toward_global(raw_alpha, global_alpha, len(group))
        best["alpha_global_raw"] = raw_alpha
        best["alpha_global_shrunk"] = shrunk_alpha
        best["source"] = "cluster_specific_shrunk"

        alpha_map[str(cluster)] = shrunk_alpha
        rows.append(best)

    alpha_df = pd.DataFrame(rows)
    alpha_df.to_csv(os.path.join(OUTPUT_DIR, "cluster_adaptive_blend_alphas.csv"), index=False, encoding="utf-8-sig")
    return alpha_map, alpha_df


def apply_cluster_alpha_blend(global_proba, expert_proba, clusters, alpha_map):
    result = []
    for g, e, c in zip(global_proba, expert_proba, clusters):
        if pd.isna(e):
            result.append(g)
            continue
        alpha_global = alpha_map.get(str(c), 1.0)
        alpha_expert = 1 - alpha_global
        result.append(alpha_global * g + alpha_expert * e)
    return np.array(result)
