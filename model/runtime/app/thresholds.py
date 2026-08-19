"""
Decision-threshold search and evaluation metrics.

`find_best_f1_threshold` is the single, central function used by every
threshold decision in the pipeline (global ensemble, per-cluster, expert
models, blends) — so the minimum-precision floor for a user-facing app
(MIN_PRECISION_APP) applies consistently everywhere. It accepts a `beta`
parameter (default 1.0, i.e. plain F1) so the same code path can be reused
to optimize F-beta with beta>1 when Recall should be weighted more heavily
than Precision — see README.md "Model search log" for when/why this was
evaluated.
"""

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    precision_recall_curve,
)

from app.config import MIN_PRECISION_APP


def find_best_f1_threshold(y_true, y_proba, min_precision=MIN_PRECISION_APP, beta=1.0):
    """
    Finds the F-beta-maximizing threshold (beta=1.0 -> plain F1) restricted
    to thresholds meeting a minimum precision floor: telling a user "this
    will succeed" when it won't damages trust more than a missed
    high-engagement call. Falls back to the unconstrained F-beta-argmax
    threshold if nothing meets the floor (e.g. a tiny or unusually hard
    subgroup), so this never raises or returns NaN.
    """
    precision, recall, thresholds = precision_recall_curve(y_true, y_proba)
    beta_sq = beta ** 2
    fbeta_scores = (1 + beta_sq) * precision * recall / (beta_sq * precision + recall + 1e-9)

    if min_precision is not None and min_precision > 0 and (precision >= min_precision).any():
        eligible = np.where(precision >= min_precision)[0]
        best_idx = int(eligible[np.argmax(fbeta_scores[eligible])])
    else:
        best_idx = int(np.argmax(fbeta_scores))

    threshold = 0.5 if best_idx >= len(thresholds) else float(thresholds[best_idx])
    return {
        "threshold": threshold,
        "validation_precision": float(precision[best_idx]),
        "validation_recall": float(recall[best_idx]),
        "validation_f1": float(fbeta_scores[best_idx]),
    }


def evaluate_with_threshold(y_true, y_proba, threshold):
    y_pred = (y_proba >= threshold).astype(int)
    metrics = {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1_score": f1_score(y_true, y_pred, zero_division=0),
        "roc_auc": roc_auc_score(y_true, y_proba),
    }
    return metrics, y_pred


def evaluate_predictions(y_true, y_pred, y_proba):
    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1_score": f1_score(y_true, y_pred, zero_division=0),
        "roc_auc": roc_auc_score(y_true, y_proba),
    }


def find_cluster_specific_thresholds(y_val, val_proba, val_clusters, min_cluster_size=100, beta=1.0):
    from app.clustering import shrink_toward_global

    global_info = find_best_f1_threshold(y_val, val_proba, beta=beta)
    global_threshold = global_info["threshold"]

    rows = []
    threshold_map = {}

    temp = pd.DataFrame({
        "y": np.array(y_val),
        "proba": np.array(val_proba),
        "content_cluster": np.array(val_clusters).astype(str),
    })

    for cluster, group in temp.groupby("content_cluster"):
        if len(group) < min_cluster_size or group["y"].nunique() < 2:
            threshold = global_threshold
            source = "global_fallback"
        else:
            info = find_best_f1_threshold(group["y"], group["proba"], beta=beta)
            # Shrink the per-cluster threshold toward the stable global
            # threshold, weighted by cluster sample size, so a cluster with
            # only a few hundred validation rows can't land on an extreme
            # threshold purely by chance.
            threshold = shrink_toward_global(info["threshold"], global_threshold, len(group))
            source = "cluster_specific_shrunk"

        threshold_map[str(cluster)] = float(threshold)
        metrics, _ = evaluate_with_threshold(group["y"], group["proba"], threshold)

        rows.append({
            "content_cluster": str(cluster),
            "threshold": threshold,
            "source": source,
            "n_val": len(group),
            "val_precision": metrics["precision"],
            "val_recall": metrics["recall"],
            "val_f1": metrics["f1_score"],
            "val_auc": metrics["roc_auc"] if group["y"].nunique() == 2 else np.nan,
        })

    return threshold_map, pd.DataFrame(rows), global_threshold


def predict_with_cluster_thresholds(test_proba, test_clusters, threshold_map, global_threshold):
    return np.array([
        1 if p >= threshold_map.get(str(c), global_threshold) else 0
        for p, c in zip(test_proba, test_clusters)
    ])
