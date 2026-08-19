"""
Real text/image embedding extraction for new, never-before-seen posts.

VERIFIED MODEL MATCH (do not change without re-verifying): the models
below were confirmed empirically to reproduce the `safespace` database's
stored embeddings EXACTLY. Five real posts were pulled from the database;
their raw `text` and `img` blobs were re-embedded with the models below and
compared via cosine similarity against their stored `text_emb_*` /
`img_emb_*` rows — cosine similarity was 1.0 for every sample, both text
and image. This means:

  - Text:  sentence-transformers/all-MiniLM-L6-v2, whose `.encode()` output
           is already L2-normalized by this model's default pooling config
           (confirmed: stored vectors have norm 1.0, so does raw output).
  - Image: openai/clip-vit-base-patch32 (via `transformers`), whose raw
           `get_image_features()` output is NOT normalized (norm ~10-12) —
           the stored embeddings ARE normalized (norm 1.0), so this module
           L2-normalizes the CLIP output before returning it. Skipping
           this step would silently feed the model out-of-distribution
           vectors.

PRODUCTION MUST USE THE SAME TEXT EMBEDDING MODEL AT TRAINING AND
INFERENCE. Because these models were verified to exactly match what
`final_model_bundle.pkl` was trained on, no retraining is required to use
real extraction here — the embedding space is provably identical. If this
project's database is ever regenerated with a different embedding model,
re-run the verification in this docstring (pull a few real rows, compare
cosine similarity) before trusting this module again.

Models are loaded once per process (module-level cache) since loading
takes several seconds — call `load_text_embedding_model()` /
`load_image_embedding_model()` once at app startup if you want to pay that
cost up front rather than on the first request.
"""

import os
import threading
from typing import Optional

# Both models are already downloaded and cached locally (verified against
# the database — see module docstring). huggingface_hub's from_pretrained()
# otherwise does a network round-trip on every cold start just to check
# for a newer revision, which can stall for a long time on a slow/
# restricted network and would make every fresh app process hang before
# serving its first prediction. Force cache-only loading by default;
# override by setting these to "0" in the environment if you deliberately
# want to fetch an updated model.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
# Keep torch's BLAS/OpenMP thread pool small: this process also holds a
# large scikit-learn/XGBoost/CatBoost bundle in memory, and torch's default
# thread count (one per CPU core) adds unnecessary memory/thread overhead
# on top of that when only ever embedding one post at a time.
os.environ.setdefault("OMP_NUM_THREADS", "1")

import numpy as np
from PIL import Image

from app.config import TEXT_EMBEDDING_DIM, IMAGE_EMBEDDING_DIM

TEXT_MODEL_NAME = "all-MiniLM-L6-v2"
IMAGE_MODEL_NAME = "openai/clip-vit-base-patch32"

_text_model = None
_image_model = None
_image_processor = None
_lock = threading.Lock()


def load_text_embedding_model():
    """Loads (and caches) the sentence-transformers text embedding model."""
    global _text_model
    with _lock:
        if _text_model is None:
            from sentence_transformers import SentenceTransformer
            _text_model = SentenceTransformer(TEXT_MODEL_NAME)
    return _text_model


def load_image_embedding_model():
    """Loads (and caches) the CLIP image embedding model + its processor."""
    global _image_model, _image_processor
    with _lock:
        if _image_model is None:
            from transformers import CLIPModel, CLIPProcessor
            _image_model = CLIPModel.from_pretrained(IMAGE_MODEL_NAME)
            _image_model.eval()
            _image_processor = CLIPProcessor.from_pretrained(IMAGE_MODEL_NAME)
    return _image_model, _image_processor


def extract_text_embedding(text: str) -> list:
    """Returns a 384-value text embedding for `text`, in the exact
    embedding space the model was trained on (see module docstring)."""
    model = load_text_embedding_model()
    vec = model.encode(text or "")
    vec = np.asarray(vec, dtype=np.float64)
    if vec.shape[0] != TEXT_EMBEDDING_DIM:
        raise ValueError(f"Text embedding model returned {vec.shape[0]} dims, expected {TEXT_EMBEDDING_DIM}.")
    return vec.tolist()


def extract_image_embedding(image: Image.Image) -> list:
    """Returns a 512-value image embedding for a PIL Image, L2-normalized
    to match the training-time embedding space (see module docstring)."""
    import torch

    model, processor = load_image_embedding_model()
    inputs = processor(images=image.convert("RGB"), return_tensors="pt")
    with torch.no_grad():
        raw = model.get_image_features(**inputs)[0].numpy().astype(np.float64)

    if raw.shape[0] != IMAGE_EMBEDDING_DIM:
        raise ValueError(f"Image embedding model returned {raw.shape[0]} dims, expected {IMAGE_EMBEDDING_DIM}.")

    norm = np.linalg.norm(raw)
    normalized = raw / norm if norm > 0 else raw
    return normalized.tolist()


def build_embeddings_for_post(text: str, image: Image.Image) -> tuple:
    """Convenience wrapper: returns (text_embedding, image_embedding) for a
    caption + image pair, both in the exact space the model was trained on."""
    return extract_text_embedding(text), extract_image_embedding(image)
