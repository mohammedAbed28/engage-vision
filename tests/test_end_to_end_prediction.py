import predict


def test_end_to_end_precomputed_multimodal_prediction(bundle, sample_post):
    result = predict.predict_success_probability(sample_post)
    assert result["predicted_label"] in {"High Engagement", "Low Engagement"}
    assert 0.0 <= float(result["calibrated_probability"]) <= 1.0
    assert 0.0 <= float(result["threshold_used"]) <= 1.0
    assert int(result["content_cluster"]) in range(12)
    assert isinstance(result["recommendations"], list)
