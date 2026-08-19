PROHIBITED = {
    "likes", "comment_count", "expected_likes_eel", "expected_comments_eel",
    "expected_engagement_lift_score", "engagement_class_eel",
    "engagement_score_pro", "engagement_class", "cluster_k2", "username",
    "post_id", "post_url",
}


def test_feature_schema_is_frozen_and_safe(bundle):
    features = bundle["feature_columns"]
    assert features == bundle["feature_order"]
    assert len(features) == 935
    assert PROHIBITED.isdisjoint(features)
