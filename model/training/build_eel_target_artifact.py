#!/usr/bin/env python3
"""Materialize the frozen EEL target without refitting or touching MySQL.

The source residuals and expected values are the completed M2/A0 artifacts.
This script performs only the already-frozen rename/reweight/boundary step:
0.40 likes + 0.60 comments and the 200-bootstrap median HAC boundary.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd


EXPERIMENT = Path(
    "/Users/hmode/Downloads/files/engagement_predictor/ניסוי/"
    "M2_FOCUSED_OPTIMIZATION_STUDY"
)
FINAL = Path(__file__).resolve().parents[2]
SOURCE_VALUES = EXPERIMENT / "targets" / "A0_FROZEN_M2_REFERENCE_TARGET_VALUES.csv.gz"
SELECTION = EXPERIMENT / "targets" / "FINAL_SELECTED_M2_TARGET.json"
SPLIT_MANIFEST = Path(
    "/Users/hmode/Downloads/files/engagement_predictor/ניסוי/"
    "TARGET_SCORE_THREE_METHODS_THREE_MODELS/EXPERIMENT_SPLIT_MANIFEST.csv"
)
TARGET_VERSION = "EEL_V1_W40_C60_BOOTSTRAP_HAC"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while block := handle.read(8 * 1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    source = pd.read_csv(SOURCE_VALUES, dtype={"post_id": str})
    split = pd.read_csv(SPLIT_MANIFEST, dtype={"post_id": str})[["post_id", "split"]]
    selection = json.loads(SELECTION.read_text(encoding="utf-8"))

    if len(source) != 88419 or source["post_id"].nunique() != 88419:
        raise RuntimeError("Frozen source target does not contain exactly 88,419 unique post_id values")
    if len(split) != 88419 or split["post_id"].nunique() != 88419:
        raise RuntimeError("Frozen split manifest does not contain exactly 88,419 unique post_id values")

    boundaries = {
        account: float(values["boundary"])
        for account, values in selection["frozen_boundary_params"].items()
    }
    out = pd.DataFrame({
        "post_id": source["post_id"],
        "username": source["username"],
        "expected_likes_eel": source["expected_likes_m2"],
        "expected_comments_eel": source["expected_comments_m2"],
        "like_residual_eel": source["like_residual_m2"],
        "comment_residual_eel": source["comment_residual_m2"],
        "like_percentile_eel": source["like_residual_percentile_m2"],
        "comment_percentile_eel": source["comment_residual_percentile_m2"],
    })
    out["expected_engagement_lift_score"] = (
        0.40 * out["like_percentile_eel"] + 0.60 * out["comment_percentile_eel"]
    )
    out["eel_hac_boundary"] = out["username"].map(boundaries)
    if out["eel_hac_boundary"].isna().any():
        raise RuntimeError("At least one account is missing its frozen EEL boundary")
    out["engagement_class_eel"] = (
        out["expected_engagement_lift_score"] >= out["eel_hac_boundary"]
    ).astype("int8")
    out["target_version_eel"] = TARGET_VERSION
    out = out.merge(split, on="post_id", how="left", validate="one_to_one")
    if out["split"].isna().any():
        raise RuntimeError("Split merge lost rows")

    model_path = FINAL / "model" / "eel_target_values.csv.gz"
    sql_path = FINAL / "database" / "sql" / "eel_target_values.csv"
    model_path.parent.mkdir(parents=True, exist_ok=True)
    sql_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(model_path, index=False, encoding="utf-8-sig", compression="gzip")
    out.drop(columns=["username", "split"]).to_csv(sql_path, index=False, encoding="utf-8")

    split_stats = (
        out.groupby("split")["engagement_class_eel"]
        .agg(rows="size", high="sum", high_rate="mean")
        .reset_index()
    )
    validation_path = FINAL / "database" / "sql" / "SQL_EEL_VALIDATION.csv"
    split_stats.to_csv(validation_path, index=False, encoding="utf-8-sig")

    manifest = {
        "target_version": TARGET_VERSION,
        "rows": int(len(out)),
        "unique_post_ids": int(out["post_id"].nunique()),
        "source_values": str(SOURCE_VALUES),
        "source_values_sha256": file_sha256(SOURCE_VALUES),
        "selection": str(SELECTION),
        "selection_sha256": file_sha256(SELECTION),
        "split_manifest": str(SPLIT_MANIFEST),
        "split_manifest_sha256": file_sha256(SPLIT_MANIFEST),
        "output_gzip": str(model_path),
        "output_gzip_sha256": file_sha256(model_path),
        "sql_csv": str(sql_path),
        "sql_csv_sha256": file_sha256(sql_path),
        "split_statistics": split_stats.to_dict(orient="records"),
        "formula": "0.40 * like_percentile_eel + 0.60 * comment_percentile_eel",
        "label_rule": "score >= frozen per-account bootstrap-median HAC boundary",
    }
    (FINAL / "model" / "EEL_TARGET_MANIFEST.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
