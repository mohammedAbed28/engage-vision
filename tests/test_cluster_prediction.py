import pandas as pd

from app.clustering import assign_content_cluster_for_inference


def test_cluster_prediction_uses_frozen_twelve_cluster_router(bundle):
    artifacts = bundle["content_cluster_artifacts"]
    row = {column: 0.0 for column in artifacts["embedding_columns"]}
    assigned = assign_content_cluster_for_inference(artifacts, pd.DataFrame([row]))
    assert artifacts["n_clusters"] == 12
    assert 0 <= int(assigned.loc[0, "content_cluster"]) < 12
    assert float(assigned.loc[0, "content_cluster_distance"]) >= 0
