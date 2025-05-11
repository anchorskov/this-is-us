# tests/test_events_api.py
import requests

BASE_URL = "http://127.0.0.1:8787/api/events/create"

def test_create_event():
    files = {"file": open("worker/dummy.pdf", "rb")}
    data = {
        "name": "PyTest Event",
        "date": "2025-05-12T15:00:00.000Z",
        "location": "Casper, WY",
    }
    resp = requests.post(BASE_URL, files=files, data=data)
    # Accept either creation or duplicate as valid
    assert resp.status_code in (201, 409)
    body = resp.json()
    assert body.get("success") is True or body.get("duplicate") is True

def test_duplicate_pdf():
    files = {"file": open("worker/dummy.pdf", "rb")}
    data = {
        "name": "PyTest Event",
        "date": "2025-05-12T15:00:00.000Z",
        "location": "Casper, WY",
    }
    # First upload: either new or already exists
    resp1 = requests.post(BASE_URL, files=files, data=data)
    assert resp1.status_code in (201, 409)

    # Rewind & second upload must detect duplicate
    files["file"].seek(0)
    resp2 = requests.post(BASE_URL, files=files, data=data)
    assert resp2.status_code == 409
    assert resp2.json().get("duplicate") is True
