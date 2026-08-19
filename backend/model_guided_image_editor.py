"""Execute research-pipeline recommendations with OpenAI image editing.

This module never invents or selects recommendations. It receives only
recommendations that the EngageVision prediction/recommendation pipeline has
already produced and applies them conservatively to the supplied image.
"""

from __future__ import annotations

import base64
import io
import os
from typing import List, Optional

from PIL import Image, ImageEnhance

from openai_service import DEFAULT_IMAGE_MODEL


DEFAULT_IMAGE_EDIT_MODEL = DEFAULT_IMAGE_MODEL
MAX_EDITOR_INPUT_EDGE = 1536
ALLOWED_QUALITIES = {"low", "medium", "high"}


def _encode_png(image: Image.Image) -> str:
    payload = io.BytesIO()
    image.convert("RGB").save(payload, format="PNG", optimize=True)
    return base64.b64encode(payload.getvalue()).decode("ascii")


def _controlled_edit_kind(recommendation: str) -> Optional[str]:
    """Map a server-approved English action to its one-variable edit."""
    normalized = recommendation.casefold()
    if "brightness" in normalized or " light " in f" {normalized} ":
        return "brightness"
    if "contrast" in normalized or "separation" in normalized:
        return "contrast"
    if "color" in normalized or "white balance" in normalized:
        return "color"
    if "sharp" in normalized or "clarity" in normalized:
        return "sharpness"
    return None


def build_local_controlled_candidates(
    image: Image.Image,
    recommendations: List[str],
) -> list[str]:
    """Execute the same isolated visual change used by sensitivity analysis.

    The generated candidate is deterministic and changes exactly one global
    property. It is not assumed to be better: the completed image is scored
    by the same frozen prediction pipeline alongside the OpenAI candidates.
    """
    if len(recommendations) != 1:
        return []
    edit_kind = _controlled_edit_kind(recommendations[0])
    if edit_kind is None:
        return []

    source = image.convert("RGB")
    enhancers = {
        "brightness": (ImageEnhance.Brightness, 1.15),
        "contrast": (ImageEnhance.Contrast, 1.20),
        "color": (ImageEnhance.Color, 1.18),
        "sharpness": (ImageEnhance.Sharpness, 1.30),
    }
    enhancer_class, factor = enhancers[edit_kind]
    return [_encode_png(enhancer_class(source).enhance(factor))]


def is_image_editor_configured() -> bool:
    return bool(os.getenv("OPENAI_API_KEY", "").strip())


def _prepare_source(image: Image.Image) -> io.BytesIO:
    prepared = image.convert("RGB")
    prepared.thumbnail((MAX_EDITOR_INPUT_EDGE, MAX_EDITOR_INPUT_EDGE), Image.Resampling.LANCZOS)
    payload = io.BytesIO()
    prepared.save(payload, format="PNG", optimize=True)
    payload.seek(0)
    # The OpenAI SDK uses this name to infer the multipart file type.
    payload.name = "engagevision-source.png"
    return payload


def build_execution_prompt(recommendations: List[str], post_type: str) -> str:
    approved = "\n".join(f"{index + 1}. {item}" for index, item in enumerate(recommendations))
    return f"""
Edit the supplied social-media image conservatively. The directions below were
selected and authorized by the EngageVision model recommendation engine. The
user may confirm a direction, but neither the user nor this image generator
creates the optimization claim. Execute only the supplied direction; do not
add your own creative recommendations or decide what would perform better.

Approved edit directions:
{approved}

Content category: {post_type or 'general'}

Make the requested adjustment clearly observable but still natural and
publication-ready. Preserve the original subject, identity, pose, objects, event, meaning, camera
perspective, and factual content. Do not add or remove people. Do not invent
objects, text, logos, symbols, claims, scenery, or calls to action. Do not alter
faces or bodies except for ordinary global lighting/color correction explicitly
requested above. Do not place the recommendation text onto the image. Produce
one polished, realistic revision that remains recognizably the same photograph.
""".strip()


def edit_image_from_recommendations(
    image: Image.Image,
    recommendations: List[str],
    post_type: str,
    quality: str = "medium",
) -> str:
    """Return a base64 PNG edited only from approved EngageVision directions."""
    return edit_image_candidates_from_recommendations(
        image,
        recommendations,
        post_type,
        quality,
        candidate_count=1,
    )[0]


def edit_image_candidates_from_recommendations(
    image: Image.Image,
    recommendations: List[str],
    post_type: str,
    quality: str = "medium",
    candidate_count: int = 2,
) -> list[str]:
    """Return independent edit candidates produced from one controlled prompt."""
    if not is_image_editor_configured():
        raise RuntimeError("OPENAI_API_KEY is not configured")
    if quality not in ALLOWED_QUALITIES:
        raise ValueError("quality must be low, medium or high")
    if not recommendations:
        raise ValueError("At least one approved recommendation is required")
    candidate_count = max(1, min(int(candidate_count), 3))

    from openai import OpenAI

    # Image editing can legitimately take several minutes. The mobile client
    # waits five minutes, so keep the server-side limit comfortably below it
    # and avoid an automatic retry that could double both cost and latency.
    client = OpenAI(timeout=240.0, max_retries=0)
    result = client.images.edit(
        model=os.getenv("OPENAI_IMAGE_EDIT_MODEL", DEFAULT_IMAGE_EDIT_MODEL).strip()
        or DEFAULT_IMAGE_EDIT_MODEL,
        image=_prepare_source(image),
        prompt=build_execution_prompt(recommendations, post_type),
        quality=quality,
        size="auto",
        output_format="png",
        # GPT Image models return base64 image data by default. The legacy
        # response_format parameter is supported only by the DALL-E models.
        n=candidate_count,
    )
    candidates = [
        item.b64_json
        for item in (result.data or [])
        if item.b64_json
    ]
    if not candidates:
        raise RuntimeError("The image editor did not return image data")
    return candidates
