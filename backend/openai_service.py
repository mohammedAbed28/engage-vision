"""Shared OpenAI configuration and safe failure classification.

The mobile client must never receive a raw SDK exception: those messages are
too technical, can vary between SDK releases, and do not tell a non-technical
user whether the problem is networking, billing, permissions, or model access.
This module keeps that translation in one place without ever returning the API
key or user content.
"""

from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Any


DEFAULT_TEXT_MODEL = "gpt-5.6-terra"
DEFAULT_IMAGE_MODEL = "gpt-image-2"


@dataclass(frozen=True)
class OpenAIProblem:
    code: str
    status: int
    message: str


def openai_configuration() -> dict[str, Any]:
    """Return only safe, non-secret configuration fields for health checks."""
    return {
        "api_key_configured": bool(os.getenv("OPENAI_API_KEY", "").strip()),
        "text_model": os.getenv("OPENAI_TEXT_MODEL", DEFAULT_TEXT_MODEL).strip()
        or DEFAULT_TEXT_MODEL,
        "image_model": os.getenv("OPENAI_IMAGE_EDIT_MODEL", DEFAULT_IMAGE_MODEL).strip()
        or DEFAULT_IMAGE_MODEL,
        "connection_test": "performed_on_feature_request",
    }


def classify_openai_error(exc: Exception, capability: str) -> OpenAIProblem:
    """Map OpenAI SDK errors to stable, actionable application error codes."""
    try:
        from openai import (
            APIConnectionError,
            APITimeoutError,
            AuthenticationError,
            BadRequestError,
            InternalServerError,
            NotFoundError,
            PermissionDeniedError,
            RateLimitError,
        )
    except ImportError:
        return OpenAIProblem(
            "OPENAI_SDK_MISSING",
            503,
            "The OpenAI server package is not installed. Install requirements-ai.txt and restart the server.",
        )

    if isinstance(exc, AuthenticationError):
        return OpenAIProblem(
            "OPENAI_AUTH_FAILED",
            503,
            "OpenAI rejected the server API key. Create a new project key, update the backend .env file, and restart the server.",
        )
    if isinstance(exc, PermissionDeniedError):
        return OpenAIProblem(
            "OPENAI_PERMISSION_DENIED",
            503,
            "This API key does not have permission to use the selected OpenAI model. Update the project key permissions and try again.",
        )
    if isinstance(exc, RateLimitError):
        code = str(getattr(exc, "code", "") or "").lower()
        body = getattr(exc, "body", None)
        body_text = str(body or "").lower()
        message = str(exc).lower()
        if "insufficient_quota" in code or any(
            marker in f"{body_text} {message}"
            for marker in ("insufficient_quota", "billing", "credit balance", "quota")
        ):
            return OpenAIProblem(
                "OPENAI_BILLING_REQUIRED",
                402,
                "The OpenAI project has no available API credit. Add billing credit in OpenAI Platform and try again.",
            )
        return OpenAIProblem(
            "OPENAI_RATE_LIMITED",
            429,
            "OpenAI is receiving too many requests for this project. Wait briefly and try again.",
        )
    if isinstance(exc, APITimeoutError):
        return OpenAIProblem(
            "OPENAI_TIMEOUT",
            504,
            "OpenAI took longer than expected to complete this request. Try again with the same draft.",
        )
    if isinstance(exc, APIConnectionError):
        return OpenAIProblem(
            "OPENAI_CONNECTION_FAILED",
            503,
            "The EngageVision server could not reach OpenAI. Check the computer internet connection and try again.",
        )
    if isinstance(exc, (NotFoundError, BadRequestError)):
        details = str(exc).lower()
        if "model" in details:
            return OpenAIProblem(
                "OPENAI_MODEL_UNAVAILABLE",
                503,
                "The configured OpenAI model is not available to this project. Check the model names in the backend .env file.",
            )
        return OpenAIProblem(
            "OPENAI_REQUEST_REJECTED",
            400,
            "OpenAI could not process this revision request. Try a different image or simplify the requested change.",
        )
    if isinstance(exc, InternalServerError):
        return OpenAIProblem(
            "OPENAI_TEMPORARY_FAILURE",
            503,
            "OpenAI is temporarily unavailable. Keep the original draft and try the revision again later.",
        )

    label = "caption" if capability == "caption" else "image"
    return OpenAIProblem(
        f"OPENAI_{label.upper()}_FAILED",
        503,
        f"The OpenAI {label} service could not finish this request. Keep the original and try again.",
    )
