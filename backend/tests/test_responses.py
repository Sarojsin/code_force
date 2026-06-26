import hashlib
import json

from app.core.responses import ETagResponse


def make_etag_content(content):
    return json.dumps(content)


def test_etag_response_sets_etag_header() -> None:
    body = make_etag_content({"data": "hello", "message": "ok"})
    response = ETagResponse(content=body)
    assert "ETag" in response.headers
    etag = response.headers["ETag"]
    expected_hash = hashlib.sha256(body.encode()).hexdigest()
    assert etag == f'"{expected_hash}"'


def test_etag_response_consistent_for_same_content() -> None:
    body = make_etag_content({"data": [1, 2, 3]})
    r1 = ETagResponse(content=body)
    r2 = ETagResponse(content=body)
    assert r1.headers["ETag"] == r2.headers["ETag"]


def test_etag_response_differs_for_different_content() -> None:
    r1 = ETagResponse(content=make_etag_content({"a": 1}))
    r2 = ETagResponse(content=make_etag_content({"a": 2}))
    assert r1.headers["ETag"] != r2.headers["ETag"]
