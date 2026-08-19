"""Weighted-average ensembling of the global models' predicted probabilities."""

import itertools
import json
import os

import numpy as np
import pandas as pd

from app.config import ENSEMBLE_WEIGHT_STEP, OUTPUT_DIR
from app.thresholds import find_best_f1_threshold, evaluate_with_threshold


def weighted_average_proba(proba_dict, weights):
    final = None
    for model_name, weight in weights.items():
        if weight == 0:
            continue
        final = weight * proba_dict[model_name] if final is None else final + weight * proba_dict[model_name]
    return final


def generate_weight_grid(model_names, step=ENSEMBLE_WEIGHT_STEP):
    values = np.round(np.arange(0, 1 + step, step), 2)
    rows = []
    for weights in itertools.product(values, repeat=len(model_names)):
        if abs(sum(weights) - 1.0) < 1e-9 and max(weights) > 0:
            rows.append(dict(zip(model_names, weights)))
    return rows


def find_best_weighted_ensemble(y_val, val_proba_dict, candidate_models, label):
    """Grid-searches ensemble weights (in ENSEMBLE_WEIGHT_STEP increments)
    over the global models, scoring each candidate by F1 at its own
    F1-optimal, precision-floored threshold."""
    weight_grid = generate_weight_grid(candidate_models)

    best = None
    rows = []

    for weights in weight_grid:
        val_proba = weighted_average_proba(val_proba_dict, weights)
        threshold_info = find_best_f1_threshold(y_val, val_proba)
        metrics, _ = evaluate_with_threshold(y_val, val_proba, threshold_info["threshold"])

        row = {
            "label": label,
            "weights": json.dumps(weights),
            "threshold": threshold_info["threshold"],
            "validation_precision": metrics["precision"],
            "validation_recall": metrics["recall"],
            "validation_f1": metrics["f1_score"],
            "validation_roc_auc": metrics["roc_auc"],
        }
        rows.append(row)

        if best is None or metrics["f1_score"] > best["validation_f1"]:
            best = {
                "weights": weights,
                "threshold": threshold_info["threshold"],
                "validation_precision": metrics["precision"],
                "validation_recall": metrics["recall"],
                "validation_f1": metrics["f1_score"],
                "validation_roc_auc": metrics["roc_auc"],
            }

    safe_label = label.replace(" ", "_").replace("/", "_")
    pd.DataFrame(rows).sort_values("validation_f1", ascending=False).to_csv(
        os.path.join(OUTPUT_DIR, f"weighted_ensemble_search_{safe_label}.csv"), index=False, encoding="utf-8-sig"
    )

    return best
