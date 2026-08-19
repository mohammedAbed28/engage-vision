"""Plots and tabular reports produced by train_final_model.py."""

import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
from sklearn.calibration import calibration_curve
from sklearn.metrics import confusion_matrix, roc_curve, roc_auc_score, precision_recall_curve, classification_report

from app.config import OUTPUT_DIR

sns.set_theme(style="whitegrid")
plt.rcParams["figure.figsize"] = (10, 6)


def plot_confusion_matrix(y_true, y_pred, file_name="final_model_confusion_matrix.png"):
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=["Low", "High"], yticklabels=["Low", "High"])
    plt.title("Confusion Matrix - Final Model (Test Set)")
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, file_name), dpi=300)
    plt.close()


def plot_roc_curve(y_true, y_proba, file_name="final_model_roc_curve.png"):
    fpr, tpr, _ = roc_curve(y_true, y_proba)
    auc_value = roc_auc_score(y_true, y_proba)
    plt.figure(figsize=(7, 6))
    plt.plot(fpr, tpr, label=f"AUC = {auc_value:.3f}")
    plt.plot([0, 1], [0, 1], linestyle="--", color="gray")
    plt.title("ROC Curve - Final Model (Test Set)")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, file_name), dpi=300)
    plt.close()


def plot_pr_curve(y_true, y_proba, file_name="final_model_pr_curve.png"):
    precision, recall, _ = precision_recall_curve(y_true, y_proba)
    plt.figure(figsize=(7, 6))
    plt.plot(recall, precision)
    plt.title("Precision-Recall Curve - Final Model (Test Set)")
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, file_name), dpi=300)
    plt.close()


def plot_calibration_curve(y_val, raw_val_proba, calibrated_val_proba, file_name="calibration_reliability_diagram.png"):
    try:
        frac_pos_before, mean_pred_before = calibration_curve(y_val, raw_val_proba, n_bins=10, strategy="quantile")
        frac_pos_after, mean_pred_after = calibration_curve(y_val, calibrated_val_proba, n_bins=10, strategy="quantile")
        plt.figure(figsize=(7, 7))
        plt.plot([0, 1], [0, 1], linestyle="--", color="gray", label="Perfect calibration")
        plt.plot(mean_pred_before, frac_pos_before, marker="o", label="Before calibration")
        plt.plot(mean_pred_after, frac_pos_after, marker="o", label="After calibration (isotonic)")
        plt.xlabel("Mean predicted probability")
        plt.ylabel("Observed fraction High Engagement")
        plt.title("Calibration / Reliability Diagram")
        plt.legend()
        plt.tight_layout()
        plt.savefig(os.path.join(OUTPUT_DIR, file_name), dpi=300)
        plt.close()
    except Exception as e:
        print(f"Skipping reliability diagram: {e}")


def save_classification_report(y_true, y_pred, file_name="final_model_classification_report.csv"):
    report = classification_report(y_true, y_pred, target_names=["Low", "High"], output_dict=True)
    pd.DataFrame(report).transpose().to_csv(os.path.join(OUTPUT_DIR, file_name), encoding="utf-8-sig")


def save_results_csv(all_results: list, file_name="final_model_results.csv"):
    """all_results: list of dicts, one row per candidate/configuration
    evaluated during the model search (see train_final_model.py)."""
    df = pd.DataFrame(all_results).sort_values(["f1_score", "roc_auc"], ascending=False)
    df.to_csv(os.path.join(OUTPUT_DIR, file_name), index=False, encoding="utf-8-sig")
    return df


def save_summary_txt(summary_lines: list, file_name="final_model_summary.txt"):
    with open(os.path.join(OUTPUT_DIR, file_name), "w", encoding="utf-8") as f:
        f.write("\n".join(summary_lines) + "\n")
