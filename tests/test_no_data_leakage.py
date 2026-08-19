from pathlib import Path


def test_no_data_leakage(bundle):
    forbidden = {
        "likes", "comment_count", "expected_likes_eel", "expected_comments_eel",
        "expected_engagement_lift_score", "engagement_class_eel",
        "engagement_score_pro", "engagement_class", "cluster_k2", "username",
        "post_id", "post_url",
    }
    assert forbidden.isdisjoint(bundle["feature_columns"])
    trainer = Path(__file__).resolve().parents[1] / "model" / "training" / "train_eel_moe.py"
    source = trainer.read_text(encoding="utf-8")
    assert 'extra_idx=test_idx' in source
    assert 'frame = frame.drop(columns=["manifest_label", "split"])' in source
