def test_text_embedding_shape(bundle):
    columns = bundle["text_embedding_columns"]
    assert len(columns) == 384
    assert columns == [f"text_emb_{index}" for index in range(384)]
