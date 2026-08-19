"""Shared acceptance policy for generated EngageVision candidates.

The generator never decides whether its output is an improvement. A candidate
is accepted only after the same frozen prediction pipeline has scored it and
the existing configured minimum probability delta is reached.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import TypeVar


T = TypeVar("T")


@dataclass(frozen=True)
class AcceptanceDecision:
    accepted: bool
    probability_delta: float
    rejection_reason: str | None


def evaluate_candidate_acceptance(
    before_probability: float,
    candidate_probability: float,
    minimum_delta: float,
) -> AcceptanceDecision:
    """Apply the existing model-validation threshold without modifying it."""
    values = (before_probability, candidate_probability, minimum_delta)
    if not all(math.isfinite(float(value)) for value in values):
        return AcceptanceDecision(False, 0.0, "INVALID_MODEL_SCORE")

    delta = float(candidate_probability) - float(before_probability)
    if delta <= 0.0:
        return AcceptanceDecision(False, delta, "PROBABILITY_DID_NOT_INCREASE")
    accepted = delta >= float(minimum_delta)
    return AcceptanceDecision(
        accepted=accepted,
        probability_delta=delta,
        rejection_reason=None if accepted else "MEANINGFUL_DELTA_NOT_REACHED",
    )


def public_revision(original: T, candidate: T, decision: AcceptanceDecision) -> T:
    """Never expose a rejected generated candidate as the improved version."""
    return candidate if decision.accepted else original
