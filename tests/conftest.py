from __future__ import annotations

import os
from pathlib import Path
import sys

import pytest


ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "model" / "runtime"
BACKEND = ROOT / "backend"
MODEL_PATH = ROOT / "model" / "final_engagevision_eel_moe_bundle.pkl"

os.environ.setdefault("ACTIVE_MODEL_VERSION", "EEL_V1")
os.environ.setdefault("MODEL_BUNDLE_PATH", str(MODEL_PATH))
os.environ.setdefault("TARGET_COL", "engagement_class_eel")
sys.path.insert(0, str(RUNTIME))
sys.path.insert(0, str(BACKEND))


@pytest.fixture(scope="session")
def bundle():
    import predict

    return predict.load_bundle(str(MODEL_PATH))


@pytest.fixture(scope="session")
def sample_post() -> dict:
    return {
        "text_embedding": [0.0] * 384,
        "image_embedding": [0.0] * 512,
        "text": "A clear test caption with a focused message.",
        "language": "en",
        "post_type": "general",
        "predicted_post_type": "general",
        "img_height": 1080.0,
        "img_width": 1080.0,
        "img_brightness": 128.0,
        "img_contrast": 55.0,
        "img_colorfulness": 45.0,
        "img_blur_score": 350.0,
        "text_length": 44.0,
        "word_count": 9.0,
        "hashtag_count": 0.0,
        "img_aspect_ratio": 1.0,
        "img_megapixels": 1.1664,
        "post_hour": 18,
        "post_month": 8,
        "day_of_week": 0,
        "sentiment_score": 0.5,
        "sentiment_numeric": 0.0,
        "emotion_strength": 0.5,
    }
