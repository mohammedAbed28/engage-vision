import pytest
from fastapi import HTTPException

import server


def test_upload_contract_requires_date_and_time():
    schema = server.api.openapi()
    operation = schema["paths"]["/predict-from-upload-v3"]["post"]
    body_schema = operation["requestBody"]["content"]["multipart/form-data"]["schema"]
    ref_name = body_schema["$ref"].rsplit("/", 1)[-1]
    required = set(schema["components"]["schemas"][ref_name]["required"])
    assert {"planned_date", "planned_time"}.issubset(required)


def test_invalid_date_is_rejected():
    with pytest.raises(HTTPException):
        server._planned_fields("2026-02-31", "18:30")
