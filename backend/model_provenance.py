"""Verifiable provenance for the frozen EngageVision research bundle."""

from __future__ import annotations

from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path
from typing import Any


@lru_cache(maxsize=1)
def _sha256(path_value: str) -> str:
    digest = hashlib.sha256()
    with Path(path_value).open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_model_card(core_dir: Path, bundle_path: Path) -> dict[str, Any]:
    final_dir = Path(__file__).resolve().parents[1]
    manifest_path = final_dir / "model" / "MODEL_BUNDLE_MANIFEST.json"
    metrics_path = final_dir / "model" / "MODEL_METRICS.json"
    # The final application is intentionally locked to the EEL release.  An
    # environment variable must never make provenance disagree with the bundle
    # that server.py actually loaded.
    active_version = "EEL_V1"
    metadata: dict[str, Any] = {}
    metrics: dict[str, Any] = {}
    if manifest_path.is_file():
        with manifest_path.open("r", encoding="utf-8") as handle:
            metadata = json.load(handle)
    if metrics_path.is_file():
        with metrics_path.open("r", encoding="utf-8") as handle:
            metrics = json.load(handle)

    digest = _sha256(str(bundle_path.resolve()))
    expected = os.getenv("ENGAGEVISION_EXPECTED_BUNDLE_SHA256", "").strip().lower()
    expected = expected or str(metadata.get("bundle_sha256") or "").lower()
    return {
        "verified_bundle": bool(expected) and digest == expected,
        "bundle_sha256": digest,
        "expected_sha256_configured": bool(expected),
        "bundle_size_bytes": bundle_path.stat().st_size,
        "model_name": metadata.get("model_version") or "cluster_adaptive_mixture_of_experts",
        "model_version": metadata.get("model_version"),
        "target_version": metadata.get("target_version"),
        "method_name": "Expected Engagement Lift",
        "created_at": metadata.get("created_at"),
        "feature_count": metadata.get("feature_count"),
        "expert_count": metadata.get("expert_count"),
        "hard_examples_added": 0,
        "official_clean_test_metrics": {
            "accuracy": metrics.get("accuracy"),
            "precision": metrics.get("precision"),
            "recall": metrics.get("recall"),
            "f1_score": metrics.get("f1"),
            "fbeta_1_25": metrics.get("fbeta_1_25"),
            "roc_auc": metrics.get("roc_auc"),
            "pr_auc": metrics.get("pr_auc"),
            "brier_score": metrics.get("brier_score"),
            "ece": metrics.get("ece"),
            "TN": metrics.get("TN"),
            "FP": metrics.get("FP"),
            "FN": metrics.get("FN"),
            "TP": metrics.get("TP"),
        },
        "limitations": [
            "The target differs from the legacy target, so metrics are not a same-task gain.",
            "The fixed test has been inspected in prior studies and is not a pristine future holdout.",
        ],
    }
