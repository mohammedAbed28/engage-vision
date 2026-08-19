def test_model_bundle_load(bundle):
    assert bundle["model_version"] == "ENGAGEVISION_MOE_EEL_V1"
    assert bundle["target_version"] == "EEL_V1_W40_C60_BOOTSTRAP_HAC"
    assert bundle["type"] == "cluster_adaptive_mixture_of_experts"
    assert bundle["calibrated"] is True
    assert len(bundle["experts"]) == 12
