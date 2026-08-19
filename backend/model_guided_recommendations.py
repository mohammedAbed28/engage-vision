"""Local counterfactual image recommendations from the frozen MoE bundle.

The external image model never participates here. Each candidate changes one
handcrafted visual signal while holding all other inputs (including embeddings)
fixed, then scores that counterfactual through the same frozen cluster-adaptive
pipeline. This is model sensitivity analysis, not a causal effect estimate.
"""

from __future__ import annotations

import math
from typing import List, Tuple

import predict


MIN_DISPLAY_DELTA = 0.003

CONTROLLED_EXPERIMENTS = [
    {
        "id": "experiment_brightness",
        "priority": 3,
        "title": "Test a restrained light correction",
        "action": "Lift overall brightness slightly while protecting natural skin tones, highlight detail, and the original mood.",
    },
    {
        "id": "experiment_contrast",
        "priority": 3,
        "title": "Test clearer subject separation",
        "action": "Increase contrast slightly around the existing focal subject without crushing shadows or changing the scene.",
    },
    {
        "id": "experiment_color",
        "priority": 3,
        "title": "Test a cleaner color balance",
        "action": "Refine color intensity and white balance conservatively while keeping colors realistic and preserving the original mood.",
    },
    {
        "id": "experiment_sharpness",
        "priority": 3,
        "title": "Test a modest focal-area clarity improvement",
        "action": "Apply restrained sharpening to the existing focal area without altering faces, bodies, objects, text, or texture unnaturally.",
    },
]


def _score_prepared_input(post_input: dict) -> float:
    """Reproduce the frozen bundle's probability path without recommendation I/O."""
    bundle = predict.get_bundle()
    df = predict._post_input_to_dataframe(post_input)
    df = predict.add_app_ready_interaction_features(df)
    cluster_artifacts = bundle["content_cluster_artifacts"]
    df = predict.assign_content_cluster_for_inference(cluster_artifacts, df)

    content_cluster = df["content_cluster"].iloc[0]
    X = df[bundle["feature_columns"]].copy()

    global_probability = None
    for model_name, weight in bundle["weights"].items():
        if weight == 0:
            continue
        probability = bundle["global_pipelines"][model_name].predict_proba(X)[:, 1]
        weighted = weight * probability
        global_probability = weighted if global_probability is None else global_probability + weighted
    global_value = float(global_probability[0])

    expert = bundle["experts"].get(content_cluster)
    expert_value = float(expert.predict_proba(X)[:, 1][0]) if expert is not None else global_value
    alpha_global = bundle.get("alpha_map", {}).get(content_cluster, bundle.get("alpha_global", 1.0))
    raw_value = float(alpha_global * global_value + (1 - alpha_global) * expert_value)
    calibrator = bundle.get("calibrator")
    return float(calibrator.transform([raw_value])[0]) if calibrator is not None else raw_value


def _finite_number(value) -> bool:
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def build_model_guided_image_recommendations(
    prepared_post_input: dict,
    prediction_result: dict,
) -> List[str]:
    """Rank one-variable visual counterfactuals by same-model probability delta."""
    base_probability = float(prediction_result["calibrated_probability"])
    if prediction_result.get("predicted_label") == "High Engagement":
        return [
            "No model-guided image edit is recommended — the current image already receives a strong outlook."
        ]

    candidates: List[Tuple[str, float, float, str]] = [
        (
            "img_brightness",
            1.15,
            255.0,
            "Try a moderately brighter version while preserving natural skin tones, highlights, and the original scene.",
        ),
        (
            "img_contrast",
            1.20,
            128.0,
            "Try a moderate contrast increase so the existing subject separates more clearly from the background.",
        ),
        (
            "img_colorfulness",
            1.18,
            255.0,
            "Try a modest color-intensity increase while keeping colors realistic and preserving the original mood.",
        ),
        (
            "img_blur_score",
            1.30,
            float("inf"),
            "Try a modest sharpness improvement on the existing photograph without changing faces, objects, or texture unnaturally.",
        ),
    ]

    ranked: List[Tuple[float, str]] = []
    for feature_name, multiplier, maximum, instruction in candidates:
        current_value = prepared_post_input.get(feature_name)
        if not _finite_number(current_value):
            continue
        counterfactual = dict(prepared_post_input)
        counterfactual[feature_name] = min(float(current_value) * multiplier, maximum)
        candidate_probability = _score_prepared_input(counterfactual)
        delta = candidate_probability - base_probability
        if delta >= MIN_DISPLAY_DELTA:
            ranked.append(
                (
                    delta,
                    f"{instruction} In an isolated EngageVision what-if test, this direction increased the model outlook by about {delta * 100:.1f} percentage points.",
                )
            )

    ranked.sort(key=lambda item: item[0], reverse=True)
    if ranked:
        return [text for _, text in ranked[:3]]
    return [
        "No model-guided image edit produced a meaningful positive change in the isolated what-if tests; keep the original image."
    ]


def build_model_guided_image_evidence(
    prepared_post_input: dict,
    prediction_result: dict,
) -> list[dict]:
    """Structured counterpart used by the professional mobile guidance UI."""
    base_probability = float(prediction_result["calibrated_probability"])
    candidates = [
        (
            "visual_brightness", "img_brightness", 1.15, 255.0,
            "Lift the subject with a controlled brightness adjustment",
            "Increase brightness moderately while protecting natural skin tones and highlight detail.",
        ),
        (
            "visual_contrast", "img_contrast", 1.20, 128.0,
            "Create clearer separation around the main subject",
            "Increase contrast moderately so the focal subject reads faster without crushing shadows.",
        ),
        (
            "visual_color", "img_colorfulness", 1.18, 255.0,
            "Strengthen color without changing the mood",
            "Increase color intensity slightly while keeping the palette realistic and consistent.",
        ),
        (
            "visual_sharpness", "img_blur_score", 1.30, float("inf"),
            "Improve perceived sharpness on the focal area",
            "Apply modest sharpening to the existing photograph without altering faces, objects or texture.",
        ),
    ]
    evidence: list[dict] = []
    for key, feature_name, multiplier, maximum, title, action in candidates:
        current_value = prepared_post_input.get(feature_name)
        if not _finite_number(current_value):
            continue
        counterfactual = dict(prepared_post_input)
        counterfactual[feature_name] = min(float(current_value) * multiplier, maximum)
        delta = _score_prepared_input(counterfactual) - base_probability
        if delta < MIN_DISPLAY_DELTA:
            continue
        evidence.append(
            {
                "id": key,
                "priority": 1 if delta >= 0.02 else 2,
                "title": title,
                "action": action,
                "evidence": (
                    "An isolated what-if test increased the current model outlook by "
                    f"approximately {delta * 100:.1f} percentage points."
                ),
                "basis": "Model sensitivity test",
                "impact_points": round(delta * 100, 2),
                "validation": (
                    "Apply only this visual property, re-evaluate the same caption, and keep the original image whenever the revised outlook does not improve."
                ),
            }
        )
    evidence.sort(key=lambda item: item["impact_points"], reverse=True)
    if evidence:
        return evidence[:3]

    # A missing positive sensitivity result must not be converted into a false
    # recommendation. The product may still offer a small, safe experiment as
    # long as it is labelled as unverified and the exact edited image is scored
    # again. This keeps the editor useful while preserving the scientific
    # distinction between a pre-identified direction and a controlled trial.
    return [
        {
            **option,
            "evidence": (
                "No visual change produced a reliable positive lift before editing. "
                "This option is offered only as a one-variable controlled experiment."
            ),
            "basis": "Controlled experiment",
            "impact_points": None,
            "validation": (
                "Change only this property, re-evaluate the same caption, and keep "
                "the original unless the completed revision receives a stronger outlook."
            ),
        }
        for option in CONTROLLED_EXPERIMENTS[:3]
    ]
