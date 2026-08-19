"""Self-contained FastAPI service for the final Codex EngageVision app.

The production service always loads the frozen EEL v1 bundle.  The archived
legacy bundle is retained only for documented rollback/reference work; it is
not selectable by the mobile application's runtime.  This service never
imports the Claude application or reads a model from the original project.
"""

from __future__ import annotations

import base64
from contextlib import asynccontextmanager
from datetime import datetime
import io
import json
import logging
import os
from pathlib import Path
import re
import sys
from typing import Any, Literal, Optional
import uuid

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool


try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).with_name(".env"))
except ImportError:
    pass

FINAL_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = Path(__file__).resolve().parent
DEFAULT_CORE_DIR = str(FINAL_DIR / "model" / "runtime")
configured_core_dir = os.getenv("ENGAGEVISION_CORE_DIR", "").strip()
CORE_DIR = Path(configured_core_dir or DEFAULT_CORE_DIR).expanduser().resolve()
if not (CORE_DIR / "predict.py").is_file():
    raise RuntimeError(
        f"EngageVision core project was not found at {CORE_DIR}. "
        "Set ENGAGEVISION_CORE_DIR to EngageVision_Final_EEL/model/runtime."
    )

ACTIVE_MODEL_VERSION = "EEL_V1"
ACTIVE_MODEL_PATH = (FINAL_DIR / "model" / "final_engagevision_eel_moe_bundle.pkl").resolve()
if not ACTIVE_MODEL_PATH.is_file():
    raise RuntimeError(f"Configured model bundle does not exist: {ACTIVE_MODEL_PATH}")

# app.config reads these values at import time.
os.environ["MODEL_BUNDLE_PATH"] = str(ACTIVE_MODEL_PATH)
os.environ["TARGET_COL"] = "engagement_class_eel"
sys.path.insert(0, str(CORE_DIR))
# The canonical launcher imports ``backend.server`` from the project root.
# Include this directory explicitly so the self-contained AI/editor modules
# resolve identically when the service is launched as a package or directly.
sys.path.insert(0, str(BACKEND_DIR))

import predict  # noqa: E402
from app.image_features import extract_image_features  # noqa: E402
from app.text_features import extract_text_features  # noqa: E402
from app.embedding_extractor import (  # noqa: E402
    extract_image_embedding,
    extract_text_embedding,
    load_image_embedding_model,
    load_text_embedding_model,
)
from app.improvement import approve_improvement, build_ai_image_prompt  # noqa: E402


@asynccontextmanager
async def lifespan(_: FastAPI):
    predict.load_bundle(str(ACTIVE_MODEL_PATH))
    # Pay the local embedding-model cold-start once, before the health endpoint
    # reports readiness. The launcher waits for that endpoint before opening
    # Expo, so the user's first analysis does not absorb this cost.
    if os.getenv("PRELOAD_EMBEDDING_MODELS", "1").strip() != "0":
        await run_in_threadpool(load_text_embedding_model)
        await run_in_threadpool(load_image_embedding_model)
    yield


api = FastAPI(
    title="EngageVision Expected Engagement Lift API",
    version="11.0.0",
    description=(
        "Multimodal pre-publication prediction using the frozen EEL-trained "
        "Mixture-of-Experts bundle. Predictions are probabilistic and are not "
        "guarantees of future engagement."
    ),
    lifespan=lifespan,
)


class PredictionResponse(BaseModel):
    predicted_label: str
    success_probability: float
    calibrated_probability: float
    threshold_used: float
    content_cluster: str
    content_cluster_distance: float
    used_expert_model: bool
    predicted_post_type: Optional[str] = None
    explanation: str
    recommendations: list[str]
    caption_improvement_suggestions: list[str]
    image_improvement_suggestions: list[str]
    ai_image_prompt: str
    should_improve: bool
    improvement_options: list[str]
    sentiment_label: Optional[str] = None
    sentiment_score: Optional[float] = None
    emotion_strength: Optional[float] = None
    sentiment_method: Optional[str] = None
    sentiment_available: bool = False
    prediction: Optional[str] = None
    probability: Optional[float] = None
    planned_date: Optional[str] = None
    planned_hour: Optional[int] = None
    day_of_week: Optional[str] = None
    model_version: Optional[str] = None
    target_version: Optional[str] = None
    method_name: Optional[str] = None


class DeveloperPostInput(BaseModel):
    text_embedding: list[float]
    image_embedding: list[float]
    text: Optional[str] = None
    language: str = "en"
    post_type: str = "general"
    predicted_post_type: Optional[str] = None
    post_hour: Optional[int] = None
    post_month: Optional[int] = None
    day_of_week: Optional[int] = None
    model_config = {"extra": "allow"}


class ApproveImprovementRequest(BaseModel):
    post: dict[str, Any]
    prediction_result: dict[str, Any]
    user_choice: Literal["caption_only", "image_prompt_only", "both", "none"]


# Native Expo requests do not use browser CORS, but the web preview and a
# future Firebase-hosted client do. Local development origins are allowed by a
# narrow regular expression; production origins must be listed explicitly in
# ENGAGEVISION_CORS_ORIGINS (comma-separated).
_configured_cors_origins = [
    value.strip()
    for value in os.getenv("ENGAGEVISION_CORS_ORIGINS", "").split(",")
    if value.strip()
]
api.add_middleware(
    CORSMiddleware,
    allow_origins=_configured_cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

from model_guided_image_editor import (  # noqa: E402
    ALLOWED_QUALITIES,
    build_local_controlled_candidates,
    edit_image_candidates_from_recommendations,
    is_image_editor_configured,
)
from model_guided_recommendations import build_model_guided_image_evidence  # noqa: E402
from professional_caption_writer import (  # noqa: E402
    ALLOWED_GOALS,
    ALLOWED_TONES,
    is_caption_writer_configured,
    revise_caption_candidates,
)
from professional_guidance import build_professional_guidance, caption_guidance  # noqa: E402
from historical_intelligence import build_benchmark_signals, get_historical_context  # noqa: E402
from model_provenance import read_model_card  # noqa: E402
from openai_service import classify_openai_error, openai_configuration  # noqa: E402
from improvement_policy import evaluate_candidate_acceptance, public_revision  # noqa: E402

# The original predictor optionally appends a legacy SQL recommendation layer
# with generic fallbacks. The V7 product wrapper owns historical intelligence
# itself, with sample-size, lift and language checks, so the legacy enrichment
# is disabled here. Model scoring, calibration and the MoE bundle are untouched.
try:  # pragma: no cover - defensive when the core project changes
    import app.insights as _legacy_insights  # noqa: E402

    _legacy_insights.generate_user_friendly_recommendations = (
        lambda post_input, prediction_result: list(prediction_result.get("recommendations", []))
    )
except Exception:
    pass


logger = logging.getLogger("engagevision.mobile")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(12 * 1024 * 1024)))
MAX_IMAGE_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", "40000000"))
MEANINGFUL_CAPTION_DELTA = max(
    0.005,
    min(float(os.getenv("MEANINGFUL_CAPTION_DELTA", "0.02")), 0.20),
)
MEANINGFUL_IMAGE_DELTA = max(
    0.005,
    min(float(os.getenv("MEANINGFUL_IMAGE_DELTA", "0.02")), 0.20),
)
IMAGE_EDIT_CANDIDATES = max(
    1,
    min(int(os.getenv("IMAGE_EDIT_CANDIDATES", "2")), 3),
)
CAPTION_CANDIDATE_ROUNDS = max(
    1,
    min(int(os.getenv("CAPTION_CANDIDATE_ROUNDS", "2")), 2),
)
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
UNICODE_WORD_RE = re.compile(r"[^\W_]+(?:['’־-][^\W_]+)*", re.UNICODE)
UNICODE_HASHTAG_RE = re.compile(r"#[^\W_]+", re.UNICODE)


class ProfessionalRecommendation(BaseModel):
    id: str
    category: str
    priority: int
    title: str
    action: str
    evidence: str
    basis: str
    source: str
    model_directed: bool
    impact_points: Optional[float] = None
    validation: str


class EvidenceProfile(BaseModel):
    model_analysis_available: bool
    model_bundle_verified: bool
    model_name: str
    historical_analysis_available: bool
    historical_scope: str
    historical_sample_size: int
    caption_ai_available: bool
    image_ai_available: bool
    research_note: str
    prediction_source: str
    recommendation_source: str
    ai_role: str
    validation_source: str


class HistoricalBenchmarkSignal(BaseModel):
    id: str
    current_value: float
    reference_value: float
    ratio_to_reference: float
    unit: str
    status: str


class HistoricalBenchmark(BaseModel):
    available: bool
    scope: str
    sample_size: int
    cohort_high_rate: Optional[float] = None
    dataset_total: int
    dataset_period_start: Optional[str] = None
    dataset_period_end: Optional[str] = None
    signals: list[HistoricalBenchmarkSignal]
    note: str


class ProfessionalPredictionResponse(PredictionResponse):
    professional_recommendations: list[ProfessionalRecommendation]
    professional_strengths: list[str]
    caption_writer_available: bool
    image_editor_available: bool
    historical_hashtag_suggestions: list[str]
    historical_benchmark: HistoricalBenchmark
    evidence_profile: EvidenceProfile


class ModelGuidedImageEditResponse(BaseModel):
    edited_image_base64: str
    edited_image_mime: str
    applied_recommendations: list[str]
    before_probability: float
    after_probability: float
    probability_delta: float
    before_label: str
    after_label: str
    improved_according_to_model: bool
    candidates_evaluated: int
    meaningful_delta_target: float
    meaningful_target_reached: bool
    before_model_score: float
    after_model_score: float
    model_score_delta: float
    calibration_band_unchanged: bool
    model_interpretation: str
    research_note: str
    recommendation_source: str
    generation_source: str
    validation_source: str
    accepted_for_display: bool
    rejection_reason: Optional[str] = None
    best_candidate_probability: float
    best_candidate_delta: float
    best_candidate_generation_source: str


class CaptionRevisionResponse(BaseModel):
    original_caption: str
    improved_caption: str
    editorial_rationale: str
    goal_execution: str
    change_summary: list[str]
    applied_guidance: list[str]
    safety_note: str
    before_probability: float
    after_probability: float
    probability_delta: float
    before_label: str
    after_label: str
    improved_according_to_model: bool
    candidates_evaluated: int
    meaningful_delta_target: float
    meaningful_target_reached: bool
    before_model_score: float
    after_model_score: float
    model_score_delta: float
    calibration_band_unchanged: bool
    model_interpretation: str
    research_note: str
    recommendation_source: str
    generation_source: str
    validation_source: str
    accepted_for_display: bool
    rejection_reason: Optional[str] = None
    best_candidate_probability: float
    best_candidate_delta: float


@api.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


def _error(request: Request, status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"code": code, "detail": message, "request_id": request.state.request_id},
        headers={"x-request-id": request.state.request_id},
    )


async def _read_and_validate_image(request: Request, upload: UploadFile) -> tuple[bytes, Image.Image]:
    content_type = (upload.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Choose a JPG, PNG or WebP image.")

    chunks = []
    size = 0
    while True:
        chunk = await upload.read(1024 * 1024)
        if not chunk:
            break
        size += len(chunk)
        if size > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="The selected image is larger than the upload limit.")
        chunks.append(chunk)
    raw = b"".join(chunks)
    if not raw:
        raise HTTPException(status_code=400, detail="The selected image is empty.")

    try:
        candidate = Image.open(io.BytesIO(raw))
        candidate.verify()
        image = Image.open(io.BytesIO(raw))
        image = ImageOps.exif_transpose(image)
        width, height = image.size
        if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
            raise HTTPException(status_code=413, detail="The image dimensions are too large.")
        return raw, image.convert("RGB")
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="The selected file is not a readable image.")


def _current_model_card() -> dict:
    return read_model_card(CORE_DIR, Path(predict.MODEL_BUNDLE_PATH))


DAY_NAMES = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")


def _planned_fields(planned_date: str, planned_time: str) -> tuple[str, int, int, int, str]:
    """Validate the required schedule and derive every temporal model feature."""
    try:
        date_value = datetime.strptime(planned_date, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="planned_date must use YYYY-MM-DD.")
    try:
        time_value = datetime.strptime(planned_time, "%H:%M").time()
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="planned_time must use 24-hour HH:MM.")
    weekday = date_value.weekday()
    return date_value.isoformat(), time_value.hour, date_value.month, weekday, DAY_NAMES[weekday]


@api.get("/health/v3")
def mobile_health_v3():
    model_card = _current_model_card()
    return {
        "status": "ok",
        "service_ready": predict.get_bundle() is not None,
        # The exact local one-variable editor is always available. OpenAI is
        # an optional second candidate source and is reported separately
        # below; it must not make the product look unavailable when billing or
        # the network is temporarily unavailable.
        "model_guided_image_editor_available": True,
        "caption_writer_available": is_caption_writer_configured(),
        "api_version": 11,
        "active_model_version": ACTIVE_MODEL_VERSION,
        "model_source": {
            "verified_bundle": model_card["verified_bundle"],
            "bundle_sha256": model_card["bundle_sha256"],
            "model_name": model_card["model_name"],
            "created_at": model_card["created_at"],
            "feature_count": model_card["feature_count"],
            "expert_count": model_card["expert_count"],
            "official_clean_test_metrics": model_card["official_clean_test_metrics"],
        },
        "openai": openai_configuration(),
    }


@api.get("/health")
def health():
    """Stable public health endpoint required by the final EEL release."""
    return mobile_health_v3()


@api.get("/model-info")
def model_info():
    card = _current_model_card()
    return {
        "active_model": ACTIVE_MODEL_VERSION,
        "model_version": card.get("model_version"),
        "target_version": card.get("target_version"),
        "method_name": card.get("method_name"),
        "created_at": card.get("created_at"),
        "bundle_sha256": card.get("bundle_sha256"),
        "verified_bundle": card.get("verified_bundle"),
        "feature_count": card.get("feature_count"),
        "expert_count": card.get("expert_count"),
        "class_labels": ["Low Expected Engagement Lift", "High Expected Engagement Lift"],
        "warning": "Predictions are probabilistic and do not guarantee engagement.",
    }


@api.get("/model-metrics")
def model_metrics():
    card = _current_model_card()
    return {
        "model_version": card.get("model_version"),
        "target_version": card.get("target_version"),
        "metrics": card.get("official_clean_test_metrics"),
        "limitations": card.get("limitations"),
    }


@api.post("/predict")
def developer_predict(post: DeveloperPostInput):
    """Developer endpoint for schema tests with precomputed embeddings."""
    payload = post.model_dump()
    result = predict.predict_success_probability(payload)
    card = _current_model_card()
    is_high = str(result["predicted_label"]).startswith("High")
    result.update({
        "prediction": "High" if is_high else "Low",
        "probability": float(result["calibrated_probability"]),
        "model_version": card.get("model_version"),
        "target_version": card.get("target_version"),
        "method_name": card.get("method_name"),
    })
    return result


@api.post("/approve-improvement")
def approve_improvement_endpoint(request: ApproveImprovementRequest):
    return approve_improvement(request.post, request.prediction_result, request.user_choice)


@api.get("/health/v2", include_in_schema=False)
def mobile_health_v2_compatibility():
    """Compatibility alias; new clients require /health/v3 and API version 10."""
    return mobile_health_v3()


@api.get("/research/model-card")
def research_model_card():
    """Public, non-secret provenance for the exact frozen bundle in use."""
    return _current_model_card()


def _build_post_input(
    pil_image: Image.Image,
    caption: str,
    post_type: str,
    language: str,
    post_hour: Optional[int],
    post_month: Optional[int],
    day_of_week: Optional[int],
) -> dict:
    text_features = extract_text_features(caption)
    # The original live helper counts only Latin characters. The trained
    # dataset, however, contains explicit Hebrew and Arabic language categories.
    # Correct only the language-neutral counts here; sentiment/emotion remain
    # untouched so no unvalidated multilingual sentiment model is introduced.
    if language in {"he", "ar"}:
        text_features["word_count"] = float(len(UNICODE_WORD_RE.findall(caption or "")))
        text_features["hashtag_count"] = float(len(UNICODE_HASHTAG_RE.findall(caption or "")))
    post_input = {
        "text": caption.strip(),
        "image": pil_image,
        "post_type": post_type,
        "predicted_post_type": post_type,
        "language": language,
        # The original API inserted a fabricated 0.30 similarity. Leaving
        # the unmeasured value absent lets the frozen preprocessing pipeline
        # handle it consistently instead.
        **extract_image_features(pil_image),
        **text_features,
    }
    # Avoid object-typed None columns before the existing sin/cos feature
    # engineering. Missing values become numeric NaN in predict.py and are
    # handled by the trained preprocessing pipeline.
    for key, value in {
        "post_hour": post_hour,
        "post_month": post_month,
        "day_of_week": day_of_week,
    }.items():
        if value is not None:
            post_input[key] = value
    return post_input


def _prepare_post_input(
    pil_image: Image.Image,
    caption: str,
    post_type: str,
    language: str,
    post_hour: Optional[int],
    post_month: Optional[int],
    day_of_week: Optional[int],
) -> dict:
    """Build one complete live input and extract each embedding exactly once."""
    return predict._ensure_embeddings(
        _build_post_input(
            pil_image, caption, post_type, language,
            post_hour, post_month, day_of_week,
        )
    )


def _multilingual_text_features(caption: str, language: str) -> dict:
    features = extract_text_features(caption)
    if language in {"he", "ar"}:
        features["word_count"] = float(len(UNICODE_WORD_RE.findall(caption or "")))
        features["hashtag_count"] = float(len(UNICODE_HASHTAG_RE.findall(caption or "")))
    return features


def _score_caption_variant(base_prepared: dict, caption: str, language: str) -> dict:
    """Re-score a caption while reusing the unchanged image embedding.

    This is mathematically identical to a full live prediction for the same
    image, but avoids running CLIP again for every generated caption.
    """
    candidate = dict(base_prepared)
    candidate.update(_multilingual_text_features(caption, language))
    candidate["text"] = caption.strip()
    candidate["text_embedding"] = extract_text_embedding(caption)
    return predict.predict_success_probability(candidate)


def _score_image_variant(base_prepared: dict, pil_image: Image.Image) -> dict:
    """Re-score an image while reusing the unchanged caption embedding."""
    candidate = dict(base_prepared)
    candidate.update(extract_image_features(pil_image))
    candidate["image"] = pil_image
    candidate["image_embedding"] = extract_image_embedding(pil_image)
    return predict.predict_success_probability(candidate)


def _predict_image(
    pil_image: Image.Image,
    caption: str,
    post_type: str,
    language: str,
    post_hour: Optional[int],
    post_month: Optional[int],
    day_of_week: Optional[int],
    editorial_goal: Optional[str] = None,
    editorial_tone: Optional[str] = None,
    prepared_post_input: Optional[dict] = None,
) -> dict:
    post_input = _build_post_input(
        pil_image, caption, post_type, language,
        post_hour, post_month, day_of_week,
    )
    # Build the expensive text/image embeddings once, reuse them for the
    # prediction and the one-variable sensitivity tests below. Controlled
    # revision endpoints may pass an already prepared copy.
    prepared = prepared_post_input or predict._ensure_embeddings(post_input)
    result = predict.predict_success_probability(prepared)
    image_evidence = build_model_guided_image_evidence(prepared, result)
    # The execution endpoint receives only the actionable edit instruction.
    # Titles and evidence stay in the product UI and are never misread by the
    # image model as creative directions.
    model_guided = [str(item["action"]) for item in image_evidence]
    historical_context = get_historical_context(post_type, language)
    benchmark_signals = build_benchmark_signals(prepared, historical_context)
    guidance, strengths = build_professional_guidance(
        prepared, result, image_evidence, historical_context,
        editorial_goal=editorial_goal,
        editorial_tone=editorial_tone,
    )
    result["image_improvement_suggestions"] = model_guided
    result["professional_recommendations"] = guidance
    result["professional_strengths"] = strengths
    result["caption_writer_available"] = is_caption_writer_configured()
    # A deterministic, local model-guided editor is always available. OpenAI
    # adds extra visual candidates when configured, but is not a prerequisite
    # for running the controlled comparison.
    result["image_editor_available"] = True
    result["historical_hashtag_suggestions"] = list(historical_context.get("hashtags") or [])
    historical_summary = historical_context.get("summary") or {}
    dataset_profile = historical_context.get("dataset_profile") or {}
    result["historical_benchmark"] = {
        "available": bool(historical_context.get("available")),
        "scope": str(historical_context.get("scope") or "none"),
        "sample_size": int(historical_context.get("sample_size") or 0),
        "cohort_high_rate": (
            float(historical_summary["high_rate"])
            if historical_summary.get("high_rate") is not None
            else None
        ),
        "dataset_total": int(dataset_profile.get("total_rows") or 0),
        "dataset_period_start": str(dataset_profile.get("first_post") or "") or None,
        "dataset_period_end": str(dataset_profile.get("last_post") or "") or None,
        "signals": benchmark_signals,
        "note": str(historical_context.get("note") or ""),
    }
    result["evidence_profile"] = {
        "model_analysis_available": True,
        "model_bundle_verified": bool(_current_model_card()["verified_bundle"]),
        "model_name": str(_current_model_card()["model_name"]),
        "historical_analysis_available": bool(historical_context.get("available")),
        "historical_scope": str(historical_context.get("scope") or "none"),
        "historical_sample_size": int(historical_context.get("sample_size") or 0),
        "caption_ai_available": is_caption_writer_configured(),
        "image_ai_available": is_image_editor_configured(),
        "research_note": str(historical_context.get("note") or ""),
        "prediction_source": "frozen_moe",
        "recommendation_source": "model_recommendation_engine",
        "ai_role": "execution_only",
        "validation_source": "same_frozen_moe",
    }
    # The professional structured layer is the only recommendation source
    # exposed by V7. This removes unsupported generic/account-specific legacy
    # sentences while preserving the frozen predictor's numerical result.
    result["recommendations"] = [str(item["action"]) for item in guidance]
    result["ai_image_prompt"] = build_ai_image_prompt(post_input, result, model_guided)
    return result


def _score_image(
    pil_image: Image.Image,
    caption: str,
    post_type: str,
    language: str,
    post_hour: Optional[int],
    post_month: Optional[int],
    day_of_week: Optional[int],
) -> dict:
    """Run the same frozen scoring pipeline without rebuilding product guidance."""
    post_input = _build_post_input(
        pil_image, caption, post_type, language,
        post_hour, post_month, day_of_week,
    )
    prepared = predict._ensure_embeddings(post_input)
    return predict.predict_success_probability(prepared)


def _is_actionable_model_recommendation(value: str) -> bool:
    return bool(value.strip())


@api.post("/predict-from-upload-v2", response_model=ProfessionalPredictionResponse, include_in_schema=False)
@api.post("/predict-from-upload-v3", response_model=ProfessionalPredictionResponse)
async def predict_from_upload_v2(
    request: Request,
    image: UploadFile = File(...),
    caption: str = Form(...),
    post_type: str = Form("general"),
    language: str = Form("en"),
    goal: str = Form("conversation"),
    tone: str = Form("natural"),
    planned_date: str = Form(...),
    planned_time: str = Form(...),
):
    if not caption.strip():
        return _error(request, 400, "CAPTION_REQUIRED", "Add a caption before requesting a preview.")
    if len(caption) > 2200:
        return _error(request, 400, "CAPTION_TOO_LONG", "The caption is longer than the supported limit.")

    try:
        normalized_date, post_hour, post_month, day_of_week, day_name = _planned_fields(
            planned_date, planned_time
        )
        _, pil_image = await _read_and_validate_image(request, image)
        result = await run_in_threadpool(
            _predict_image,
            pil_image, caption, post_type, language,
            post_hour, post_month, day_of_week, goal, tone,
        )
        card = _current_model_card()
        is_high = str(result["predicted_label"]).startswith("High")
        result.update({
            "prediction": "High" if is_high else "Low",
            "probability": float(result["calibrated_probability"]),
            "planned_date": normalized_date,
            "planned_hour": post_hour,
            "day_of_week": day_name,
            "model_version": card.get("model_version"),
            "target_version": card.get("target_version"),
            "method_name": card.get("method_name"),
            "explanation": (
                "This draft resembles historical posts that performed above their expected engagement level."
                if is_high else
                "This draft resembles historical posts that performed at or below their expected engagement level; review the measured recommendations before publishing."
            ),
        })
        return result
    except HTTPException as exc:
        return _error(request, exc.status_code, "INVALID_IMAGE", str(exc.detail))
    except ValueError:
        logger.exception("Prediction validation failed request_id=%s", request.state.request_id)
        return _error(request, 400, "DRAFT_NOT_SUPPORTED", "This draft could not be analyzed. Try another image.")
    except Exception:
        logger.exception("Prediction failed request_id=%s", request.state.request_id)
        return _error(request, 500, "ANALYSIS_FAILED", "The analysis service could not finish this request.")


@api.post("/caption-revision-v2", response_model=CaptionRevisionResponse, include_in_schema=False)
@api.post("/caption-revision-v3", response_model=CaptionRevisionResponse)
async def caption_revision_v2(
    request: Request,
    image: UploadFile = File(...),
    caption: str = Form(...),
    post_type: str = Form("general"),
    language: str = Form("en"),
    tone: str = Form("natural"),
    goal: str = Form("conversation"),
    planned_date: str = Form(...),
    planned_time: str = Form(...),
):
    if not caption.strip():
        return _error(request, 400, "CAPTION_REQUIRED", "Add a caption before requesting a revision.")
    if len(caption) > 2200:
        return _error(request, 400, "CAPTION_TOO_LONG", "The caption is longer than the supported limit.")
    if tone not in ALLOWED_TONES or goal not in ALLOWED_GOALS:
        return _error(request, 400, "INVALID_DIRECTION", "Choose a supported tone and communication goal.")

    try:
        _, post_hour, post_month, day_of_week, _ = _planned_fields(planned_date, planned_time)
        _, pil_image = await _read_and_validate_image(request, image)
        prepared = await run_in_threadpool(
            _prepare_post_input,
            pil_image, caption, post_type, language,
            post_hour, post_month, day_of_week,
        )
        before = await run_in_threadpool(
            _predict_image,
            pil_image, caption, post_type, language,
            post_hour, post_month, day_of_week, None, None, prepared,
        )
        guidance = caption_guidance(before.get("professional_recommendations", []))
        before_probability = float(before["calibrated_probability"])
        before_model_score = float(before["success_probability"])
        language = language if language in {"en", "he", "ar"} else "en"
        if not guidance:
            no_direction = {
                "en": "The recommendation engine found no model- or data-supported caption change, so no AI text was generated.",
                "he": "מנוע ההמלצות לא מצא שינוי כיתוב שנתמך על ידי המודל או הנתונים, ולכן לא נוצר נוסח AI.",
                "ar": "لم يجد محرك التوصيات تغييرًا للنص مدعومًا بالنموذج أو البيانات، لذلك لم يُنشأ نص بالذكاء الاصطناعي.",
            }[language]
            return {
                "original_caption": caption.strip(),
                "improved_caption": caption.strip(),
                "editorial_rationale": no_direction,
                "goal_execution": no_direction,
                "change_summary": [],
                "applied_guidance": [],
                "safety_note": no_direction,
                "before_probability": before_probability,
                "after_probability": before_probability,
                "probability_delta": 0.0,
                "before_label": str(before["predicted_label"]),
                "after_label": str(before["predicted_label"]),
                "improved_according_to_model": False,
                "candidates_evaluated": 0,
                "meaningful_delta_target": MEANINGFUL_CAPTION_DELTA,
                "meaningful_target_reached": False,
                "before_model_score": before_model_score,
                "after_model_score": before_model_score,
                "model_score_delta": 0.0,
                "calibration_band_unchanged": True,
                "model_interpretation": no_direction,
                "research_note": no_direction,
                "recommendation_source": "model_recommendation_engine",
                "generation_source": "not_run",
                "validation_source": "same_frozen_moe",
                "accepted_for_display": False,
                "rejection_reason": "NO_MODEL_BASED_RECOMMENDATION",
                "best_candidate_probability": before_probability,
                "best_candidate_delta": 0.0,
            }
        if not is_caption_writer_configured():
            return _error(request, 503, "AI_NOT_CONFIGURED", "The professional caption writer is not enabled on this server.")
        scored_revisions: list[tuple[float, float, dict, dict]] = []
        seen_captions: set[str] = set()
        model_feedback: list[dict] = []
        for _round in range(CAPTION_CANDIDATE_ROUNDS):
            revisions = await run_in_threadpool(
                revise_caption_candidates, caption, pil_image, post_type, tone,
                goal, language, guidance, 2200, _round + 1, model_feedback,
            )
            for revision_candidate in revisions:
                normalized = " ".join(revision_candidate["improved_caption"].casefold().split())
                if normalized in seen_captions:
                    continue
                seen_captions.add(normalized)
                candidate_result = await run_in_threadpool(
                    _score_caption_variant,
                    prepared, revision_candidate["improved_caption"], language,
                )
                scored_revisions.append((
                    float(candidate_result["calibrated_probability"]),
                    float(candidate_result["success_probability"]),
                    revision_candidate,
                    candidate_result,
                ))
            if scored_revisions and max(item[0] for item in scored_revisions) - before_probability >= MEANINGFUL_CAPTION_DELTA:
                break
            # Feed real, same-model measurements back into the second writing
            # round. This is a bounded search loop, not reinforcement training:
            # the frozen model never changes and every factual safety rule stays
            # in force.
            strongest = sorted(scored_revisions, key=lambda item: (item[0], item[1]), reverse=True)[:4]
            model_feedback = [
                {
                    "candidate_excerpt": item[2]["improved_caption"][:600],
                    "calibrated_delta_points": round((item[0] - before_probability) * 100, 2),
                    "directional_model_delta_points": round((item[1] - before_model_score) * 100, 2),
                    "calibration_band_changed": abs(item[0] - before_probability) > 1e-9,
                }
                for item in strongest
            ]
        if not scored_revisions:
            raise RuntimeError("The caption writer returned no distinct candidates")
        best_probability, best_model_score, revision, best_after = max(
            scored_revisions, key=lambda item: (item[0], item[1])
        )
        decision = evaluate_candidate_acceptance(
            before_probability, best_probability, MEANINGFUL_CAPTION_DELTA
        )
        accepted = decision.accepted
        improved_caption = public_revision(
            caption.strip(), revision["improved_caption"], decision
        )
        after_probability = best_probability if accepted else before_probability
        after_model_score = best_model_score if accepted else before_model_score
        after = best_after if accepted else before
        delta = after_probability - before_probability
        model_score_delta = after_model_score - before_model_score
        meaningful_target_reached = accepted
        interpretations = {
            "en": (
                "The revised caption received a stronger outlook when the same post was evaluated again.",
                "No generated caption was accepted because model validation did not reach the existing improvement threshold.",
                "No generated caption was accepted because model validation did not reach the existing improvement threshold.",
            ),
            "he": (
                "הכיתוב המעודכן קיבל תחזית חזקה יותר כאשר אותו פוסט הוערך מחדש.",
                "לא התקבל כיתוב שנוצר, משום שאימות המודל לא הגיע לסף השיפור הקיים.",
                "לא התקבל כיתוב שנוצר, משום שאימות המודל לא הגיע לסף השיפור הקיים.",
            ),
            "ar": (
                "حصل النص المعدل على توقع أقوى عند إعادة تقييم المنشور نفسه.",
                "لم يُعتمد أي نص مُنشأ لأن تحقق النموذج لم يبلغ حد التحسن الحالي.",
                "لم يُعتمد أي نص مُنشأ لأن تحقق النموذج لم يبلغ حد التحسن الحالي.",
            ),
        }
        interpretation = interpretations[language][0 if accepted else 2]
        research_notes = {
            "en": "Several constrained caption candidates were re-evaluated with the same frozen pipeline and the strongest measured candidate was selected. The score change is model-based evidence, not a causal guarantee of real-world engagement.",
            "he": "כמה מועמדי כיתוב מוגבלים הוערכו מחדש באותו צינור חיזוי קפוא, ונבחר המועמד בעל התוצאה המדודה החזקה ביותר. שינוי הציון הוא ראיה מבוססת מודל ולא הבטחה סיבתית למעורבות בעולם האמיתי.",
            "ar": "أعيد تقييم عدة نصوص مقيدة عبر مسار التوقع المجمد نفسه، واختير المرشح صاحب أقوى نتيجة مقاسة. تغير النتيجة دليل قائم على النموذج وليس ضمانًا سببيًا للتفاعل الفعلي.",
        }

        return {
            "original_caption": caption.strip(),
            "improved_caption": improved_caption,
            "editorial_rationale": revision["editorial_rationale"] if accepted else interpretation,
            "goal_execution": revision["goal_execution"] if accepted else interpretation,
            "change_summary": revision["change_summary"] if accepted else [],
            "applied_guidance": [str(item.get("title")) for item in guidance if item.get("title")],
            "safety_note": revision["safety_note"] if accepted else interpretation,
            "before_probability": before_probability,
            "after_probability": after_probability,
            "probability_delta": delta,
            "before_label": str(before["predicted_label"]),
            "after_label": str(after["predicted_label"]),
            "improved_according_to_model": accepted,
            "candidates_evaluated": len(scored_revisions),
            "meaningful_delta_target": MEANINGFUL_CAPTION_DELTA,
            "meaningful_target_reached": meaningful_target_reached,
            "before_model_score": before_model_score,
            "after_model_score": after_model_score,
            "model_score_delta": model_score_delta,
            "calibration_band_unchanged": abs(delta) <= 1e-9,
            "model_interpretation": interpretation,
            "research_note": research_notes[language],
            "recommendation_source": "model_recommendation_engine",
            "generation_source": "openai",
            "validation_source": "same_frozen_moe",
            "accepted_for_display": accepted,
            "rejection_reason": decision.rejection_reason,
            "best_candidate_probability": best_probability,
            "best_candidate_delta": decision.probability_delta,
        }
    except HTTPException as exc:
        return _error(request, exc.status_code, "INVALID_IMAGE", str(exc.detail))
    except ValueError:
        logger.exception("Caption revision validation failed request_id=%s", request.state.request_id)
        return _error(request, 400, "CAPTION_REVISION_INVALID", "This caption could not be revised safely.")
    except Exception as exc:
        problem = classify_openai_error(exc, "caption")
        logger.warning(
            "Caption revision failed request_id=%s code=%s exception=%s",
            request.state.request_id, problem.code, type(exc).__name__,
        )
        return _error(request, problem.status, problem.code, problem.message)


@api.post("/model-guided-image-edit", response_model=ModelGuidedImageEditResponse, include_in_schema=False)
@api.post("/model-guided-image-edit-v3", response_model=ModelGuidedImageEditResponse)
async def model_guided_image_edit_endpoint(
    request: Request,
    image: UploadFile = File(...),
    caption: str = Form(...),
    post_type: str = Form("general"),
    language: str = Form("en"),
    selected_recommendations: str = Form(...),
    quality: str = Form("medium"),
    planned_date: str = Form(...),
    planned_time: str = Form(...),
):
    if quality not in ALLOWED_QUALITIES:
        return _error(request, 400, "INVALID_QUALITY", "Choose low, medium or high image quality.")
    try:
        requested = json.loads(selected_recommendations)
    except (json.JSONDecodeError, TypeError):
        return _error(request, 400, "INVALID_RECOMMENDATIONS", "The selected recommendations could not be read.")
    if not isinstance(requested, list) or len(requested) != 1:
        return _error(request, 400, "INVALID_RECOMMENDATIONS", "Choose exactly one recommendation for a controlled comparison.")
    requested = list(dict.fromkeys(str(item).strip() for item in requested if str(item).strip()))
    if not requested or any(len(item) > 500 for item in requested):
        return _error(request, 400, "INVALID_RECOMMENDATIONS", "Choose valid EngageVision recommendations.")

    try:
        _, post_hour, post_month, day_of_week, _ = _planned_fields(planned_date, planned_time)
        _, pil_image = await _read_and_validate_image(request, image)
        prepared = await run_in_threadpool(
            _prepare_post_input,
            pil_image, caption[:2200], post_type, language,
            post_hour, post_month, day_of_week,
        )
        before = await run_in_threadpool(
            _predict_image,
            pil_image, caption[:2200], post_type, language,
            post_hour, post_month, day_of_week, None, None, prepared,
        )

        # Recreate the allowed set server-side. The image model is never
        # allowed to invent advice or execute arbitrary client instructions.
        allowed_order = list(dict.fromkeys(
            str(item).strip()
            for item in before.get("image_improvement_suggestions", [])
            if str(item).strip() and _is_actionable_model_recommendation(str(item))
        ))
        allowed = set(allowed_order)
        if any(item not in allowed for item in requested):
            return _error(
                request, 409, "RECOMMENDATION_MISMATCH",
                "These recommendations no longer match the current model result. Analyze the post again.",
            )

        before_probability = float(before["calibrated_probability"])
        before_model_score = float(before["success_probability"])
        scored_edits: list[tuple[float, float, str, dict, str, str]] = []
        seen_payloads: set[str] = set()

        async def score_candidates(candidates: list[str], direction: str, source: str) -> None:
            for edited_candidate_base64 in candidates:
                if edited_candidate_base64 in seen_payloads:
                    continue
                seen_payloads.add(edited_candidate_base64)
                edited_bytes = base64.b64decode(edited_candidate_base64, validate=True)
                edited_image = Image.open(io.BytesIO(edited_bytes)).convert("RGB")
                candidate_result = await run_in_threadpool(
                    _score_image_variant, prepared, edited_image,
                )
                scored_edits.append((
                    float(candidate_result["calibrated_probability"]),
                    float(candidate_result["success_probability"]),
                    edited_candidate_base64,
                    candidate_result,
                    direction,
                    source,
                ))

        # First evaluate fast, exact one-variable edits for every model-approved
        # direction. This lets EngageVision automatically recover when the
        # user's first choice is not the strongest measured direction.
        test_directions = requested + [item for item in allowed_order if item not in requested]
        for direction in test_directions:
            local_candidates = await run_in_threadpool(
                build_local_controlled_candidates, pil_image, [direction],
            )
            await score_candidates(local_candidates, direction, "controlled_local_editor")

        best_local = max(scored_edits, key=lambda item: (item[0], item[1])) if scored_edits else None
        best_local_delta = (best_local[0] - before_probability) if best_local else float("-inf")

        # Image generation is slower and paid. Use it only when the deterministic
        # candidates did not already reach the meaningful target, and limit it
        # to the selected direction plus the strongest local fallback.
        if best_local_delta < MEANINGFUL_IMAGE_DELTA and is_image_editor_configured():
            ai_directions = requested.copy()
            if best_local and best_local[4] not in ai_directions:
                ai_directions.append(best_local[4])
            for direction in ai_directions[:2]:
                try:
                    openai_candidates = await run_in_threadpool(
                        edit_image_candidates_from_recommendations,
                        pil_image, [direction], post_type, quality, IMAGE_EDIT_CANDIDATES,
                    )
                    await score_candidates(openai_candidates, direction, "openai")
                except Exception as exc:
                    # A completed local experiment remains useful when the
                    # optional external editor times out or is temporarily busy.
                    logger.warning(
                        "Optional OpenAI image candidate failed request_id=%s exception=%s",
                        request.state.request_id, type(exc).__name__,
                    )

        if not scored_edits:
            return _error(
                request, 400, "NO_MODEL_GUIDED_EDIT",
                "No controlled image candidate could be produced for this direction.",
            )

        best_probability, best_model_score, best_edited_base64, best_after, applied_direction, best_generation_source = max(
            scored_edits, key=lambda item: (item[0], item[1])
        )
        decision = evaluate_candidate_acceptance(
            before_probability, best_probability, MEANINGFUL_IMAGE_DELTA
        )
        accepted = decision.accepted
        if accepted:
            edited_base64 = best_edited_base64
            after_probability = best_probability
            after_model_score = best_model_score
            after = best_after
        else:
            original_payload = io.BytesIO()
            pil_image.save(original_payload, format="PNG", optimize=True)
            edited_base64 = base64.b64encode(original_payload.getvalue()).decode("ascii")
            after_probability = before_probability
            after_model_score = before_model_score
            after = before
        delta = after_probability - before_probability
        model_score_delta = after_model_score - before_model_score
        meaningful_target_reached = accepted
        language = language if language in {"en", "he", "ar"} else "en"
        interpretations = {
            "en": (
                "The revised image received a stronger outlook in the second evaluation.",
                "No generated image was accepted because model validation did not reach the existing improvement threshold.",
                "No generated image was accepted because model validation did not reach the existing improvement threshold.",
            ),
            "he": (
                "התמונה המשופרת קיבלה תחזית חזקה יותר בהערכה השנייה.",
                "לא התקבלה תמונה שנוצרה, משום שאימות המודל לא הגיע לסף השיפור הקיים.",
                "לא התקבלה תמונה שנוצרה, משום שאימות המודל לא הגיע לסף השיפור הקיים.",
            ),
            "ar": (
                "حصلت الصورة المعدلة على توقع أقوى في التقييم الثاني.",
                "لم تُعتمد أي صورة مُنشأة لأن تحقق النموذج لم يبلغ حد التحسن الحالي.",
                "لم تُعتمد أي صورة مُنشأة لأن تحقق النموذج لم يبلغ حد التحسن الحالي.",
            ),
        }
        interpretation = interpretations[language][0 if accepted else 2]
        research_notes = {
            "en": "Multiple controlled image candidates were evaluated and the strongest completed edit was selected. Keep it only when it reaches the meaningful improvement target; it is not a guarantee of real-world engagement.",
            "he": "כמה מועמדי תמונה מבוקרים הוערכו ונבחרה העריכה המלאה החזקה ביותר. שמרו אותה רק אם הגיעה ליעד השיפור המשמעותי; אין זו הבטחה למעורבות בפועל.",
            "ar": "قُيّمت عدة صور معدلة بصورة مضبوطة واختير أقوى تعديل مكتمل. احتفظ به فقط إذا بلغ هدف التحسن المعتبر؛ وهو ليس ضمانًا للتفاعل الفعلي.",
        }

        return {
            "edited_image_base64": edited_base64,
            "edited_image_mime": "image/png",
            "applied_recommendations": [applied_direction] if accepted else [],
            "before_probability": before_probability,
            "after_probability": after_probability,
            "probability_delta": delta,
            "before_label": str(before["predicted_label"]),
            "after_label": str(after["predicted_label"]),
            "improved_according_to_model": accepted,
            "candidates_evaluated": len(scored_edits),
            "meaningful_delta_target": MEANINGFUL_IMAGE_DELTA,
            "meaningful_target_reached": meaningful_target_reached,
            "before_model_score": before_model_score,
            "after_model_score": after_model_score,
            "model_score_delta": model_score_delta,
            "calibration_band_unchanged": abs(delta) <= 1e-9,
            "model_interpretation": interpretation,
            "research_note": research_notes[language],
            "recommendation_source": "model_recommendation_engine",
            "generation_source": best_generation_source,
            "validation_source": "same_frozen_moe",
            "accepted_for_display": accepted,
            "rejection_reason": decision.rejection_reason,
            "best_candidate_probability": best_probability,
            "best_candidate_delta": decision.probability_delta,
            "best_candidate_generation_source": best_generation_source,
        }
    except HTTPException as exc:
        return _error(request, exc.status_code, "INVALID_IMAGE", str(exc.detail))
    except ValueError:
        logger.exception("Model-guided edit validation failed request_id=%s", request.state.request_id)
        return _error(request, 400, "EDIT_NOT_SUPPORTED", "This edit request could not be processed.")
    except Exception as exc:
        problem = classify_openai_error(exc, "image")
        logger.warning(
            "Model-guided image edit failed request_id=%s code=%s exception=%s",
            request.state.request_id, problem.code, type(exc).__name__,
        )
        return _error(request, problem.status, problem.code, problem.message)


@api.post("/predict-before-after")
async def predict_before_after(
    request: Request,
    image: UploadFile = File(...),
    before_caption: str = Form(...),
    after_caption: str = Form(...),
    post_type: str = Form("general"),
    language: str = Form("en"),
    planned_date: str = Form(...),
    planned_time: str = Form(...),
):
    """Evaluate a controlled caption change with the same image and schedule."""
    if not before_caption.strip() or not after_caption.strip():
        return _error(request, 400, "CAPTION_REQUIRED", "Both captions are required.")
    try:
        normalized_date, post_hour, post_month, day_of_week, day_name = _planned_fields(
            planned_date, planned_time
        )
        _, pil_image = await _read_and_validate_image(request, image)
        before = await run_in_threadpool(
            _score_image, pil_image, before_caption, post_type, language,
            post_hour, post_month, day_of_week,
        )
        after = await run_in_threadpool(
            _score_image, pil_image, after_caption, post_type, language,
            post_hour, post_month, day_of_week,
        )
        before_probability = float(before["calibrated_probability"])
        after_probability = float(after["calibrated_probability"])
        return {
            "before": before,
            "after": after,
            "before_probability": before_probability,
            "after_probability": after_probability,
            "probability_delta": after_probability - before_probability,
            "planned_date": normalized_date,
            "planned_hour": post_hour,
            "day_of_week": day_name,
            "model_version": _current_model_card().get("model_version"),
            "target_version": _current_model_card().get("target_version"),
            "warning": "A model-score change is comparative evidence, not a causal guarantee.",
        }
    except HTTPException as exc:
        return _error(request, exc.status_code, "INVALID_DRAFT", str(exc.detail))
    except Exception:
        logger.exception("Before/after prediction failed request_id=%s", request.state.request_id)
        return _error(request, 500, "COMPARISON_FAILED", "The comparison could not be completed.")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:api", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
