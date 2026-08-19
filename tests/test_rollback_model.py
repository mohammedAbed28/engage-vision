import hashlib

from conftest import ROOT


def _sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def test_rollback_bundle_is_present_and_verified(bundle):
    rollback = bundle["rollback"]
    path = ROOT / "model" / rollback["legacy_bundle_relative_path"]
    assert path.is_file()
    assert rollback["legacy_model_version"] == "LEGACY_V1"
    assert _sha256(path) == rollback["legacy_bundle_sha256"]
