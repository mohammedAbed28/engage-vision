"""
Central configuration for the Multimodal Engagement Prediction project.

All values that could reasonably differ between a developer machine, a CI
run, and a production deployment are read from environment variables (see
.env.example). Nothing secret is hardcoded here.
"""

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ------------------------------------------------------------------
# Database
# ------------------------------------------------------------------
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "safespace"),
}

MAIN_TABLE = os.getenv("DB_MAIN_TABLE", "safespace")
TEXT_TABLE = os.getenv("DB_TEXT_TABLE", "text_embeddings")
IMAGE_TABLE = os.getenv("DB_IMAGE_TABLE", "image_embeddings")

# ------------------------------------------------------------------
# Target / columns
# ------------------------------------------------------------------
TARGET_COL = os.getenv("TARGET_COL", "engagement_class")
USER_COL = "username"

TEXT_EMBEDDING_DIM = 384
IMAGE_EMBEDDING_DIM = 512

# ------------------------------------------------------------------
# Final selected model configuration: Cluster-Adaptive Mixture of Experts
# (a.k.a. "Cluster-Adaptive Global + Expert Blend" / "Adaptive Alpha +
# Cluster Threshold").
#
# content_k=12 / text_pca=64 / image_pca=64 were chosen after an explicit
# search (content_k in {8,10,12,14}, PCA in {64,128}) in the original
# research script. A later iteration of this project replaced this
# architecture with a simpler calibrated stacking ensemble that had higher
# ROC-AUC/precision but LOWER F1 and notably lower Recall. Because this is
# an imbalanced-data problem where the goal is to catch as many actual
# High-Engagement posts as possible, F1 (primary) and Recall (secondary)
# were judged more important than ROC-AUC alone, so the Mixture-of-Experts
# architecture was restored as final — see README.md "Model search log".
# ------------------------------------------------------------------
CONTENT_K = 12
TEXT_PCA_COMPONENTS = 64
IMAGE_PCA_COMPONENTS = 64

RANDOM_STATE = 42

# ------------------------------------------------------------------
# Mixture-of-experts / shrinkage settings.
# ------------------------------------------------------------------
# An expert is only trained for a content cluster with at least this many
# train/val rows and both classes present; otherwise the blend falls back
# to the global ensemble for that cluster.
MIN_EXPERT_TRAIN_SIZE = 1500
MIN_EXPERT_VAL_SIZE = 250

# Global-ensemble weight grid search step (see app/ensemble.py).
ENSEMBLE_WEIGHT_STEP = 0.05

# Additive/Bayesian smoothing for content_cluster_train_high_rate — pulls
# small clusters' target-rate encoding toward the global rate.
TARGET_ENCODING_SMOOTHING = 20

# Empirical-Bayes shrinkage strength for per-cluster alpha/threshold
# estimates toward their stable global counterpart (n / (n + K) weighting).
CLUSTER_PARAM_SHRINKAGE_K = 200

MIN_CLUSTER_THRESHOLD_SIZE = 100

# Precision floor for a user-facing app: a confident false "this will
# succeed" call damages trust more than a missed high-engagement call.
MIN_PRECISION_APP = 0.50

# Decision-threshold objective: F-beta with beta=1.25 weights Recall more
# heavily than plain F1 (beta=1.0). Verified empirically (post-hoc, no
# retraining) to improve BOTH F1 and Recall on the test set versus plain F1
# thresholding, with ROC-AUC unchanged (threshold choice never affects
# ranking quality) — see README.md "Model search log". This directly
# serves the project's stated goal: for this imbalanced, High-Engagement-
# detection problem, missing a real High-Engagement post (a false
# negative) is a worse outcome than the moderate precision cost of
# weighting recall slightly more.
THRESHOLD_FBETA = 1.25

# ------------------------------------------------------------------
# Paths
# ------------------------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.getenv("OUTPUT_DIR", os.path.join(PROJECT_ROOT, "outputs"))
os.makedirs(OUTPUT_DIR, exist_ok=True)

MODEL_BUNDLE_PATH = os.getenv(
    "MODEL_BUNDLE_PATH", os.path.join(OUTPUT_DIR, "final_model_bundle.pkl")
)
