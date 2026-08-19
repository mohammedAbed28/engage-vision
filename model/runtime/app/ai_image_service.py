"""
AI image-editing integration point.

Today, this project does NOT call any image-generation/editing API — it
only produces a text prompt describing how the image should be improved
(see app/improvement.py::build_ai_image_prompt). This module exists so an
actual image-editing API can be plugged in later without changing any
calling code: `edit_image_with_ai` is the single function that would need
a real implementation, and `is_ai_image_service_available()` is the single
place that decides whether to attempt it.

No API key is ever hardcoded — configure `AI_IMAGE_API_KEY` (and, if the
provider needs one, `AI_IMAGE_API_URL`) in `.env`. With no key configured,
the app behaves exactly as it does today: prompt-only, with a clear
message that no editing service is connected yet.
"""

import os
from typing import Optional

from PIL import Image

from app.improvement import build_ai_image_prompt as _build_ai_image_prompt

NOT_CONNECTED_MESSAGE = (
    "Image editing API is not connected yet. Use this prompt in an image-editing tool."
)


def is_ai_image_service_available() -> bool:
    """True only if an API key has been configured in .env — never
    hardcoded, and false by default (prompt-only mode)."""
    return bool(os.getenv("AI_IMAGE_API_KEY"))


def build_image_edit_prompt(post_input: dict, prediction_result: dict, suggestions: Optional[list] = None) -> str:
    """Thin wrapper around app.improvement.build_ai_image_prompt, kept here
    so callers that only care about "the AI image service" have one
    import to reach for."""
    return _build_ai_image_prompt(post_input, prediction_result, suggestions)


def edit_image_with_ai(image: Image.Image, prompt: str) -> dict:
    """
    Placeholder for a real image-editing/generation call. Returns a dict
    describing what happened rather than raising, so callers (the API and
    Streamlit) can display a clean message either way:

      {"success": False, "edited_image": None, "message": "..."}   — not connected
      {"success": True,  "edited_image": <PIL.Image>, "message": "..."} — once implemented

    To connect a real provider: implement the actual HTTP call to your
    chosen image-editing API here (reading AI_IMAGE_API_KEY /
    AI_IMAGE_API_URL from the environment), and return the edited image.
    Nothing else in this codebase needs to change.
    """
    if not is_ai_image_service_available():
        return {"success": False, "edited_image": None, "message": NOT_CONNECTED_MESSAGE}

    # NOT IMPLEMENTED: no image-editing provider is wired up in this
    # project yet. When one is, replace this block with the real call.
    return {
        "success": False,
        "edited_image": None,
        "message": "An AI_IMAGE_API_KEY is configured, but no provider integration has been "
                    "implemented in app/ai_image_service.py yet. Use the prompt manually for now.",
    }
