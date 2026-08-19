from fastapi.testclient import TestClient

import server


def test_api_health_model_info_and_prediction(bundle, sample_post):
    client = TestClient(server.api)
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["active_model_version"] == "EEL_V1"
    info = client.get("/model-info")
    assert info.status_code == 200
    assert info.json()["verified_bundle"] is True
    response = client.post("/predict", json=sample_post)
    assert response.status_code == 200
    body = response.json()
    assert body["prediction"] in {"High", "Low"}
    assert 0 <= body["probability"] <= 1
    assert body["model_version"] == "ENGAGEVISION_MOE_EEL_V1"


def test_application_runtime_cannot_be_switched_to_legacy(monkeypatch):
    monkeypatch.setenv("ACTIVE_MODEL_VERSION", "LEGACY_V1")
    assert server.ACTIVE_MODEL_VERSION == "EEL_V1"
    assert server.ACTIVE_MODEL_PATH.name == "final_engagevision_eel_moe_bundle.pkl"
    card = server._current_model_card()
    assert card["model_version"] == "ENGAGEVISION_MOE_EEL_V1"
    assert card["target_version"] == "EEL_V1_W40_C60_BOOTSTRAP_HAC"
