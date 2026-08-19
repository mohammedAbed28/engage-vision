from __future__ import annotations

import base64
import io

from PIL import Image, ImageChops

from improvement_policy import evaluate_candidate_acceptance, public_revision
from model_guided_image_editor import build_local_controlled_candidates
from professional_guidance import build_professional_guidance, caption_guidance


def test_every_controlled_visual_direction_creates_a_complete_candidate():
    source = Image.new("RGB", (32, 32), (80, 110, 140))
    directions = [
        "Lift overall brightness slightly while protecting natural skin tones.",
        "Increase contrast slightly around the existing focal subject.",
        "Refine color intensity and white balance conservatively.",
        "Apply restrained sharpening to the existing focal area.",
    ]

    for direction in directions:
        candidates = build_local_controlled_candidates(source, [direction])
        assert len(candidates) == 1
        revised = Image.open(io.BytesIO(base64.b64decode(candidates[0]))).convert("RGB")
        # A flat image is intentionally unaffected by contrast/sharpness, but
        # the encoded candidate must still be a complete, valid image with the
        # same controlled geometry.
        assert revised.size == source.size


def test_brightness_control_changes_pixels_without_changing_geometry():
    source = Image.new("RGB", (16, 12), (90, 100, 110))
    encoded = build_local_controlled_candidates(
        source,
        ["Lift overall brightness slightly while protecting natural skin tones."],
    )[0]
    revised = Image.open(io.BytesIO(base64.b64decode(encoded))).convert("RGB")
    assert revised.size == source.size
    assert ImageChops.difference(source, revised).getbbox() is not None


def test_selected_editorial_goal_is_guidance_only_and_ranked_first():
    prepared = {
        "text": "A factual caption with enough context for this controlled test.",
        "word_count": 10,
        "hashtag_count": 0,
        "language": "en",
        "post_type": "general",
    }
    prediction = {
        "calibrated_probability": 0.48,
        "threshold_used": 0.50,
        "predicted_label": "Low Engagement",
    }
    guidance, _ = build_professional_guidance(
        prepared,
        prediction,
        editorial_goal="shares",
        editorial_tone="natural",
    )
    assert guidance[0]["id"] == "goal_shares"
    assert guidance[0]["basis"] == "User-selected editorial goal"
    assert guidance[0]["source"] == "user_constraint"
    assert guidance[0]["model_directed"] is False
    assert caption_guidance(guidance) == []
    assert "editorial_goal" not in prepared


def test_model_signal_can_direct_ai_but_user_goal_cannot():
    prepared = {
        "text": "New kitchen",
        "word_count": 2,
        "hashtag_count": 0,
        "language": "en",
        "post_type": "general",
    }
    prediction = {
        "calibrated_probability": 0.48,
        "threshold_used": 0.50,
        "predicted_label": "Low Engagement",
    }
    guidance, _ = build_professional_guidance(
        prepared,
        prediction,
        editorial_goal="shares",
        editorial_tone="natural",
    )

    executable = caption_guidance(guidance)
    assert [item["id"] for item in executable] == ["caption_context"]
    assert executable[0]["source"] == "model_feature_signal"
    assert executable[0]["model_directed"] is True


def test_only_model_validated_candidate_is_publicly_returned():
    accepted = evaluate_candidate_acceptance(0.50, 0.53, minimum_delta=0.02)
    assert accepted.accepted is True
    assert public_revision("original", "candidate", accepted) == "candidate"

    below_target = evaluate_candidate_acceptance(0.50, 0.51, minimum_delta=0.02)
    assert below_target.accepted is False
    assert below_target.rejection_reason == "MEANINGFUL_DELTA_NOT_REACHED"
    assert public_revision("original", "candidate", below_target) == "original"

    lower = evaluate_candidate_acceptance(0.50, 0.49, minimum_delta=0.02)
    assert lower.accepted is False
    assert lower.rejection_reason == "PROBABILITY_DID_NOT_INCREASE"
    assert public_revision("original", "candidate", lower) == "original"
