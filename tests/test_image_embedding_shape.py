def test_image_embedding_shape(bundle):
    columns = bundle["image_embedding_columns"]
    assert len(columns) == 512
    assert columns == [f"img_emb_{index}" for index in range(512)]
