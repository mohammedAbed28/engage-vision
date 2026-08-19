"""
Content clustering (KMeans over PCA-reduced text+image embeddings) for the
Cluster-Adaptive Mixture-of-Experts architecture.

Unlike a simpler "clusters for threshold-routing only" design, this
architecture uses content_cluster / content_cluster_distance /
content_cluster_train_high_rate as MODEL FEATURES (global models + experts
all see them), and trains one expert model per cluster.

IMPORTANT DEPLOYMENT BUG THIS PROJECT GUARDS AGAINST:
Training creates three cluster-derived columns: content_cluster,
content_cluster_distance, content_cluster_train_high_rate.
content_cluster_distance IS one of the model's feature_columns. An earlier
inference implementation only recreated content_cluster and
content_cluster_train_high_rate, which crashed every live request with
`KeyError: ['content_cluster_distance']`. `assign_content_cluster_for_inference`
below is the single place that recreates all three from the frozen
KMeans/PCA/scaler artifacts, and is used by BOTH train_final_model.py (for a
consistency self-check) and predict.py, so the two code paths can never
drift apart again.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.feature_selection import VarianceThreshold
from sklearn.decomposition import PCA
from sklearn.cluster import MiniBatchKMeans
from sklearn.model_selection import KFold

from app.config import TARGET_COL, RANDOM_STATE, TARGET_ENCODING_SMOOTHING, CLUSTER_PARAM_SHRINKAGE_K


def shrink_toward_global(cluster_value, global_value, n, k=CLUSTER_PARAM_SHRINKAGE_K):
    """
    Empirical-Bayes-style shrinkage: pulls a per-cluster estimate (alpha or
    threshold) toward the stable global estimate, weighted by how much
    validation data that cluster has. With little data (n << k) the result
    stays close to the global value; with lots of data (n >> k) the
    cluster's own estimate dominates. This counters overfitting from
    picking whichever per-cluster value maximizes F1 on a small slice.
    """
    if n <= 0:
        return global_value
    w = n / (n + k)
    return w * cluster_value + (1 - w) * global_value


def compute_smoothed_target_encoding(cluster_series, target_series, global_mean, smoothing=TARGET_ENCODING_SMOOTHING):
    """
    Additive/Bayesian-smoothed mean target encoding: small clusters are
    pulled toward the global rate instead of using their raw (noisy) mean.
    smoothed_rate = (count * cluster_mean + smoothing * global_mean) / (count + smoothing)
    """
    stats = pd.DataFrame({
        "content_cluster": np.asarray(cluster_series),
        TARGET_COL: np.asarray(target_series)
    }).groupby("content_cluster")[TARGET_COL].agg(["mean", "count"])
    smoothed = (stats["mean"] * stats["count"] + global_mean * smoothing) / (stats["count"] + smoothing)
    return smoothed.to_dict()


def add_content_clusters(df: pd.DataFrame, train_idx, n_clusters: int):
    """
    Fits VarianceThreshold -> StandardScaler -> PCA(<=50) -> MiniBatchKMeans
    on TRAIN embeddings only, then assigns content_cluster /
    content_cluster_distance / content_cluster_train_high_rate to every row.

    content_cluster_train_high_rate uses K-fold cross-fitting for TRAIN rows
    (each row's encoding comes from the OTHER folds only, never its own —
    otherwise a train row would partially "see" its own label through its
    cluster's mean, a classic target-encoding leak) and the full-train
    smoothed mapping for VAL/TEST rows (leakage-safe since their own labels
    were never part of that mapping).
    """
    df = df.copy()
    text_cols = [c for c in df.columns if c.startswith("text_emb_")]
    image_cols = [c for c in df.columns if c.startswith("img_emb_")]
    emb_cols = text_cols + image_cols

    if not emb_cols:
        raise ValueError("No embedding columns found.")

    emb_train = df.loc[train_idx, emb_cols].replace([np.inf, -np.inf], np.nan).fillna(0)
    emb_all = df[emb_cols].replace([np.inf, -np.inf], np.nan).fillna(0)

    # A handful of raw embedding dimensions are near-constant (std ~1e-33 on
    # the real text_embeddings table). StandardScaler would divide by that
    # near-zero std and blow those columns up to extreme magnitude, which
    # destabilizes the PCA SVD (silent overflow/NaN) — drop them first.
    variance_filter = VarianceThreshold(threshold=1e-6)
    emb_train_filtered = variance_filter.fit_transform(emb_train)
    emb_all_filtered = variance_filter.transform(emb_all)

    scaler = StandardScaler()
    train_scaled = scaler.fit_transform(emb_train_filtered)
    all_scaled = scaler.transform(emb_all_filtered)

    cluster_pca_components = min(50, train_scaled.shape[1])
    cluster_pca = PCA(n_components=cluster_pca_components, random_state=RANDOM_STATE)
    train_pca = cluster_pca.fit_transform(train_scaled)
    all_pca = cluster_pca.transform(all_scaled)

    kmeans = MiniBatchKMeans(n_clusters=n_clusters, random_state=RANDOM_STATE, batch_size=2048, n_init=10)
    kmeans.fit(train_pca)

    clusters = kmeans.predict(all_pca)
    distances = kmeans.transform(all_pca)

    df["content_cluster"] = clusters.astype(str)
    df["content_cluster_distance"] = distances.min(axis=1)

    train_temp = pd.DataFrame({
        "content_cluster": df.loc[train_idx, "content_cluster"].values,
        TARGET_COL: df.loc[train_idx, TARGET_COL].values
    })
    global_high_rate = train_temp[TARGET_COL].mean()

    full_train_rate_map = compute_smoothed_target_encoding(
        train_temp["content_cluster"], train_temp[TARGET_COL], global_high_rate
    )

    train_idx_arr = np.array(train_idx)
    cross_fit_encoded = pd.Series(index=train_idx_arr, dtype=float)

    kf = KFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    for fit_pos, hold_pos in kf.split(train_idx_arr):
        fit_idx = train_idx_arr[fit_pos]
        hold_idx = train_idx_arr[hold_pos]
        fold_rate_map = compute_smoothed_target_encoding(
            df.loc[fit_idx, "content_cluster"], df.loc[fit_idx, TARGET_COL], global_high_rate
        )
        cross_fit_encoded.loc[hold_idx] = (
            df.loc[hold_idx, "content_cluster"].map(fold_rate_map).fillna(global_high_rate).values
        )

    df["content_cluster_train_high_rate"] = df["content_cluster"].map(full_train_rate_map).fillna(global_high_rate)
    df.loc[train_idx_arr, "content_cluster_train_high_rate"] = cross_fit_encoded.values

    cluster_artifacts = {
        "n_clusters": n_clusters,
        "embedding_columns": emb_cols,
        "variance_filter": variance_filter,
        "scaler": scaler,
        "cluster_pca": cluster_pca,
        "kmeans": kmeans,
        "cluster_high_rate": full_train_rate_map,
        "global_high_rate": float(global_high_rate),
    }

    return df, cluster_artifacts


def assign_content_cluster_for_inference(cluster_artifacts: dict, df: pd.DataFrame) -> pd.DataFrame:
    """
    Recreates content_cluster, content_cluster_distance, and
    content_cluster_train_high_rate on new data using the FROZEN training-time
    variance filter / scaler / PCA / KMeans. This is the fix for the
    KeyError bug described in the module docstring —
    content_cluster_distance MUST be recomputed via kmeans.transform(), not
    skipped, because it is a real model feature in this architecture.
    """
    df = df.copy()
    emb_cols = cluster_artifacts["embedding_columns"]

    emb = df[emb_cols].replace([np.inf, -np.inf], np.nan).fillna(0)
    emb_filtered = cluster_artifacts["variance_filter"].transform(emb)
    scaled = cluster_artifacts["scaler"].transform(emb_filtered)
    pca_scaled = cluster_artifacts["cluster_pca"].transform(scaled)

    clusters = cluster_artifacts["kmeans"].predict(pca_scaled).astype(str)
    distances = cluster_artifacts["kmeans"].transform(pca_scaled)

    df["content_cluster"] = clusters
    df["content_cluster_distance"] = distances.min(axis=1)
    df["content_cluster_train_high_rate"] = (
        df["content_cluster"]
        .map(cluster_artifacts["cluster_high_rate"])
        .fillna(cluster_artifacts["global_high_rate"])
    )
    return df
