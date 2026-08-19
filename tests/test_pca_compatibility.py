def test_text_and_image_pca_are_64_components(bundle):
    preprocessor = bundle["global_pipelines"]["Extra Trees"].named_steps["preprocessor"]
    transformers = {name: transformer for name, transformer, _ in preprocessor.transformers}
    assert transformers["text_pca"].named_steps["pca"].n_components == 64
    assert transformers["image_pca"].named_steps["pca"].n_components == 64
    assert bundle["model_config"]["text_pca"] == 64
    assert bundle["model_config"]["image_pca"] == 64
