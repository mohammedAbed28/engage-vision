"""
Computes the same handcrafted text features the model was trained on
(text_length, word_count, hashtag_count, sentiment_score, sentiment_numeric,
emotion_strength) directly from a caption string, with no external NLP/LLM
API — just simple counting and a small built-in lexicon.

Used by streamlit_app.py so a normal user can just type a caption instead
of entering technical text statistics by hand. These are intentionally
simple heuristics, not a trained sentiment/emotion model — good enough for
a demo/prototype, not meant to be scientifically precise.
"""

import re

_POSITIVE_WORDS = {
    "love", "great", "amazing", "happy", "proud", "beautiful", "wonderful", "hope", "hopeful",
    "grateful", "thank", "thanks", "joy", "excited", "inspire", "inspiring", "support", "strong",
    "strength", "together", "care", "kind", "kindness", "win", "success", "celebrate", "smile",
}
_NEGATIVE_WORDS = {
    "sad", "angry", "hate", "loss", "lost", "grief", "pain", "hurt", "hard", "difficult", "struggle",
    "fear", "afraid", "worried", "worry", "crisis", "tragedy", "sorry", "alone", "broken", "cry",
    "sick", "suffer", "suffering", "danger", "urgent", "help",
}
_EMOTION_WORDS = _POSITIVE_WORDS | _NEGATIVE_WORDS | {
    "never", "always", "forever", "everything", "nothing", "please", "remember", "honor", "memory",
}

_HASHTAG_RE = re.compile(r"#\w+")
_WORD_RE = re.compile(r"[A-Za-z']+")


def extract_text_features(caption: str) -> dict:
    """Returns text_length, word_count, hashtag_count, sentiment_score
    (-1..1), sentiment_numeric (-1/0/1), and emotion_strength (0..1) for a
    caption string."""
    caption = caption or ""
    words = _WORD_RE.findall(caption)
    word_count = len(words)
    hashtag_count = len(_HASHTAG_RE.findall(caption))

    lower_words = [w.lower() for w in words]
    pos_hits = sum(1 for w in lower_words if w in _POSITIVE_WORDS)
    neg_hits = sum(1 for w in lower_words if w in _NEGATIVE_WORDS)
    emotion_hits = sum(1 for w in lower_words if w in _EMOTION_WORDS)

    total_sentiment_hits = pos_hits + neg_hits
    if total_sentiment_hits > 0:
        sentiment_score = (pos_hits - neg_hits) / total_sentiment_hits
    else:
        sentiment_score = 0.0

    if sentiment_score > 0.15:
        sentiment_numeric = 1
    elif sentiment_score < -0.15:
        sentiment_numeric = -1
    else:
        sentiment_numeric = 0

    exclamations = caption.count("!")
    emotion_word_ratio = (emotion_hits / word_count) if word_count else 0.0
    emotion_strength = min(1.0, emotion_word_ratio * 2.5 + min(exclamations, 3) * 0.1)

    return {
        "text_length": float(len(caption)),
        "word_count": float(word_count),
        "hashtag_count": float(hashtag_count),
        "sentiment_score": float(sentiment_score),
        "sentiment_numeric": float(sentiment_numeric),
        "emotion_strength": float(emotion_strength),
    }
