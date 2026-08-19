"""
Rule-based, LLM-free "AI-assisted" post improvement layer.

This module never touches the trained model, its bundle, or MySQL — it
consumes the model's prediction OUTPUT (predicted_label,
calibrated_probability, threshold_used, content_cluster,
predicted_post_type, ...) plus the original post_input, and produces:

  - human-readable caption/image improvement suggestions
  - a ready-to-use image-generation/editing prompt (text only — no image
    is actually generated; see README.md "Improvement layer limitations")
  - a rule-based rewritten caption / image prompt, but ONLY when
    `approve_improvement` is called with an explicit user choice

Nothing here is fed back into the model and nothing here claims a
guaranteed outcome: every suggestion is phrased as "may help" / "expected
to help based on model signals", never as a promise, and no medical/legal/
financial claims are ever added.
"""

from typing import Optional

from app.recommendations import LOW_TEXT_IMAGE_SIMILARITY, LOW_EMOTION_STRENGTH

SHORT_CAPTION_WORD_COUNT = 8

LOW_BRIGHTNESS = 90.0
LOW_CONTRAST = 30.0
LOW_COLORFULNESS = 20.0
# img_blur_score is a variance-of-Laplacian-style sharpness score in this
# project's feature pipeline -- lower values indicate a blurrier image.
BLURRY_THRESHOLD = 100.0

NEAR_THRESHOLD_GAP = 0.05

IMPROVEMENT_OPTIONS = ["caption_only", "image_prompt_only", "both", "none"]

_IMAGE_STYLE_BY_POST_TYPE = {
    "personal_story": "warm, authentic, human-centered, and emotionally genuine",
    "awareness": "bold and clear, with a strong focal point and a readable message",
    "campaign": "bold and clear, with a strong focal point and a readable message",
    "activism": "bold and clear, with a strong focal point and a readable message",
    "educational_info": "a clean infographic style with a simple, readable layout",
    "memorial": "calm, respectful, and emotionally appropriate in tone",
    "support": "warm, approachable, and encouraging in tone",
    "emotional_quote": "visually simple, with strong typography and a contemplative mood",
}


def _effective_post_type(post_input: dict, prediction_result: Optional[dict] = None) -> Optional[str]:
    prediction_result = prediction_result or {}
    return (
        post_input.get("predicted_post_type")
        or prediction_result.get("predicted_post_type")
        or post_input.get("post_type")
    )


def _original_caption(post_input: dict) -> str:
    return (post_input.get("text") or post_input.get("caption") or "").strip()


# ------------------------------------------------------------------
# 1) Caption suggestions
# ------------------------------------------------------------------
def generate_caption_suggestions(post_input: dict, prediction_result: dict) -> list:
    """Rule-based caption improvement suggestions (no external LLM)."""
    suggestions = []
    caption = _original_caption(post_input)
    word_count = post_input.get("word_count") or (len(caption.split()) if caption else None)
    emotion_strength = post_input.get("emotion_strength")
    text_image_similarity = post_input.get("text_image_similarity")
    post_type = _effective_post_type(post_input, prediction_result)

    if word_count is not None and word_count <= SHORT_CAPTION_WORD_COUNT:
        suggestions.append(
            "The caption is quite short — adding a sentence of context may help readers "
            "understand the post faster."
        )
    if emotion_strength is not None and emotion_strength < LOW_EMOTION_STRENGTH:
        suggestions.append(
            "The caption feels a little flat. Add a more personal or emotional sentence to make it "
            "more relatable."
        )
    if text_image_similarity is not None and text_image_similarity < LOW_TEXT_IMAGE_SIMILARITY:
        suggestions.append(
            "The image and caption may not communicate the same message clearly. Try making the "
            "visual match the caption more directly."
        )

    if post_type == "personal_story":
        suggestions.append(
            "For a personal-story post, a more authentic, human-centered opening line is expected "
            "to help engagement."
        )
    elif post_type in ("awareness", "campaign", "activism"):
        suggestions.append(
            "For an awareness/campaign post, a clearer call-to-action may help drive engagement."
        )
    elif post_type == "educational_info":
        suggestions.append(
            "For an educational post, a more structured caption (a short lead-in plus a clear "
            "takeaway) is expected to help clarity."
        )

    if not suggestions:
        suggestions.append(
            "No specific caption issues detected by the current heuristics — the caption looks "
            "reasonable as-is."
        )
    return suggestions


# ------------------------------------------------------------------
# 2) Image suggestions
# ------------------------------------------------------------------
def generate_image_improvement_suggestions(post_input: dict, prediction_result: dict) -> list:
    """Rule-based image improvement suggestions from handcrafted image
    signals plus the model's own probability/threshold signals."""
    suggestions = []
    brightness = post_input.get("img_brightness")
    contrast = post_input.get("img_contrast")
    colorfulness = post_input.get("img_colorfulness")
    blur_score = post_input.get("img_blur_score")
    text_image_similarity = post_input.get("text_image_similarity")
    post_type = _effective_post_type(post_input, prediction_result)

    if brightness is not None and brightness < LOW_BRIGHTNESS:
        suggestions.append("Your image looks a bit dark. Try brightening it up so it catches the eye while scrolling.")
    if contrast is not None and contrast < LOW_CONTRAST:
        suggestions.append("Your image looks a little flat. Boosting the contrast may help the subject stand out more.")
    if blur_score is not None and blur_score < BLURRY_THRESHOLD:
        suggestions.append("Your image looks a bit soft or blurry. A sharper photo tends to look more polished.")
    if colorfulness is not None and colorfulness < LOW_COLORFULNESS:
        suggestions.append("Your image looks a bit muted. Try using warmer or more vivid colors so the post stands out more.")
    if text_image_similarity is not None and text_image_similarity < LOW_TEXT_IMAGE_SIMILARITY:
        suggestions.append(
            "The image and caption may not communicate the same message clearly. Try making the "
            "visual match the caption more directly."
        )

    if post_type == "personal_story":
        suggestions.append("A warm, authentic, human-centered image is expected to suit this content type.")
    elif post_type in ("awareness", "campaign", "activism"):
        suggestions.append("A strong single focal point with a clear, readable design may help this content type stand out.")
    elif post_type == "educational_info":
        suggestions.append("A clean infographic-style layout with simple, readable text is expected to suit this content type.")
    elif post_type == "memorial":
        suggestions.append("A calm, respectful, emotionally appropriate visual tone is expected to suit this content type.")

    calibrated_probability = (prediction_result or {}).get("calibrated_probability")
    threshold_used = (prediction_result or {}).get("threshold_used")
    if calibrated_probability is not None and threshold_used is not None:
        gap = threshold_used - calibrated_probability
        if 0 < gap <= NEAR_THRESHOLD_GAP:
            suggestions.append(
                "This post is close to the High Engagement threshold for its content cluster — "
                "small visual improvements may be enough to help push it over."
            )

    if not suggestions:
        suggestions.append(
            "No specific image issues detected by the current heuristics — the image signals "
            "look reasonable as-is."
        )
    return suggestions


# ------------------------------------------------------------------
# 3) AI image-generation/editing prompt (text only, never calls an image API)
# ------------------------------------------------------------------
def build_ai_image_prompt(post_input: dict, prediction_result: dict, suggestions: Optional[list] = None) -> str:
    """
    Builds a ready-to-use text prompt describing how the image should be
    edited or regenerated. This function only produces TEXT — it never
    calls an image-generation/editing API itself (see README.md
    "Improvement layer limitations"). The prompt can be passed to such an
    API later if one is connected.
    """
    post_type = _effective_post_type(post_input, prediction_result) or "general social media"
    suggestions = suggestions if suggestions is not None else generate_image_improvement_suggestions(post_input, prediction_result)
    style = _IMAGE_STYLE_BY_POST_TYPE.get(post_type, "clear, well-composed, and visually engaging")

    text_blob = " ".join(suggestions).lower()
    fixes = []
    if "dark" in text_blob or "brightness" in text_blob:
        fixes.append("brighter")
    if "blurry" in text_blob or "sharper" in text_blob:
        fixes.append("sharper")
    if "contrast" in text_blob:
        fixes.append("higher contrast")
    if "muted" in text_blob or "vivid" in text_blob:
        fixes.append("more vivid in color")
    if "align" in text_blob or "match" in text_blob:
        fixes.append("better aligned with the caption")

    fix_clause = f" Make it {', '.join(fixes)}." if fixes else ""
    post_type_label = post_type.replace("_", " ")

    return (
        f"Improve this social media image for a {post_type_label} post.{fix_clause} "
        f"Keep the overall style {style}. "
        "Keep it realistic, respectful, and suitable for a general social media audience. "
        "Do not add text overlays unless the post type calls for an infographic style."
    )


# ------------------------------------------------------------------
# 4) Rule-based caption rewrite (only called after explicit user approval)
# ------------------------------------------------------------------
def improve_caption(original_caption: str, post_input: dict, prediction_result: dict) -> str:
    """
    Conservative, rule-based caption rewrite: it only appends clarifying /
    emotional / structural wrapper text around the ORIGINAL caption. It
    never invents new factual claims, never changes the topic, and never
    adds medical/legal/financial promises — see module docstring.
    """
    caption = original_caption.strip() if original_caption else ""
    if not caption:
        return caption

    post_type = _effective_post_type(post_input, prediction_result)
    emotion_strength = post_input.get("emotion_strength")
    text_image_similarity = post_input.get("text_image_similarity")
    word_count = post_input.get("word_count") or len(caption.split())

    improved = caption if caption.endswith((".", "!", "?")) else caption + "."

    if word_count is not None and word_count <= SHORT_CAPTION_WORD_COUNT:
        if post_type == "personal_story":
            improved += " This is a moment that means a lot to me, and I wanted to share it with you."
        elif post_type in ("awareness", "campaign", "activism"):
            improved += " Every bit of awareness and support makes a real difference."
        elif post_type == "educational_info":
            improved += " Here's a quick breakdown to help make sense of it."
        else:
            improved += " Here's a closer look at what this means."

    if post_type == "personal_story" and emotion_strength is not None and emotion_strength < LOW_EMOTION_STRENGTH:
        improved += " It's not always easy to share, but moments like this remind me why it matters."

    if text_image_similarity is not None and text_image_similarity < LOW_TEXT_IMAGE_SIMILARITY:
        improved += " Take a closer look at the picture above — it captures exactly what this is about."

    if post_type in ("awareness", "campaign", "activism", "support"):
        improved += " If this resonates with you, consider sharing it to help spread the word."

    return improved.strip()


# ------------------------------------------------------------------
# Shared helpers used by app_api.py
# ------------------------------------------------------------------
def should_offer_improvement(prediction_result: dict) -> bool:
    return prediction_result.get("predicted_label") == "Low Engagement"


def build_suggestion_payload(post_input: dict, prediction_result: dict) -> dict:
    """Used by both the bundled /predict response and the standalone
    /suggest-improvements endpoint, so the two never disagree."""
    caption_suggestions = generate_caption_suggestions(post_input, prediction_result)
    image_suggestions = generate_image_improvement_suggestions(post_input, prediction_result)
    ai_image_prompt = build_ai_image_prompt(post_input, prediction_result, image_suggestions)

    return {
        "caption_improvement_suggestions": caption_suggestions,
        "image_improvement_suggestions": image_suggestions,
        "ai_image_prompt": ai_image_prompt,
        "should_improve": should_offer_improvement(prediction_result),
        "improvement_options": list(IMPROVEMENT_OPTIONS),
    }


# ------------------------------------------------------------------
# 5) Auto-improvement, only after explicit user approval
# ------------------------------------------------------------------
def approve_improvement(post_input: dict, prediction_result: dict, user_choice: str) -> dict:
    """
    user_choice must be one of IMPROVEMENT_OPTIONS
    ("caption_only", "image_prompt_only", "both", "none"). Returns exactly
    the fields relevant to that choice (see README.md for the full
    per-choice response shape).
    """
    if user_choice not in IMPROVEMENT_OPTIONS:
        raise ValueError(f"user_choice must be one of {IMPROVEMENT_OPTIONS}, got {user_choice!r}")

    original_caption = _original_caption(post_input)

    if user_choice == "none":
        return {
            "user_choice": user_choice,
            "original_post": post_input,
            "improvement_summary": "No changes requested — original post returned unchanged.",
        }

    result = {"user_choice": user_choice}

    if user_choice in ("caption_only", "both"):
        result["improved_caption"] = improve_caption(original_caption, post_input, prediction_result)

    if user_choice in ("image_prompt_only", "both"):
        image_suggestions = generate_image_improvement_suggestions(post_input, prediction_result)
        result["improved_image_prompt"] = build_ai_image_prompt(post_input, prediction_result, image_suggestions)
        result["image_improvement_suggestions"] = image_suggestions

    if user_choice == "both":
        result["caption_improvement_suggestions"] = generate_caption_suggestions(post_input, prediction_result)

    if user_choice in ("caption_only", "both"):
        comparison = {"original_caption": original_caption, "improved_caption": result.get("improved_caption")}
        if user_choice == "both":
            comparison["improved_image_prompt"] = result.get("improved_image_prompt")
        result["before_after_comparison"] = comparison

    summary_parts = []
    if "improved_caption" in result:
        summary_parts.append("the caption was rewritten with clearer/warmer wording based on the model's signals")
    if "improved_image_prompt" in result:
        summary_parts.append("an image-editing/generation prompt was produced based on detected image signals")
    result["improvement_summary"] = (
        "Suggested improvement — " + " and ".join(summary_parts) + ". "
        "This is a suggested change based on model signals and does not guarantee higher engagement."
    )
    return result
