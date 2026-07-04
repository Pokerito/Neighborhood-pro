import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://neighborhood-pro-6.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEMO = {"email": "demo@tasklocal.app", "password": "Demo@12345"}
ADMIN = {"email": "admin@tasklocal.app", "password": "Admin@12345"}


@pytest.fixture(scope="module")
def demo_token():
    r = requests.post(f"{API}/auth/login", json=DEMO, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def auth(t):
    return {"Authorization": f"Bearer {t}"}


def test_root():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_register_new_user():
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Pass@1234", "name": "T"}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "token" in body and body["user"]["email"] == email.lower()


def test_login_demo(demo_token):
    assert isinstance(demo_token, str) and len(demo_token) > 20


def test_auth_me(demo_token):
    r = requests.get(f"{API}/auth/me", headers=auth(demo_token), timeout=15)
    assert r.status_code == 200
    assert r.json()["email"] == DEMO["email"]


def test_categories():
    r = requests.get(f"{API}/categories", timeout=15)
    assert r.status_code == 200
    cats = r.json()
    assert len(cats) == 3
    ids = {c["category_id"] for c in cats}
    assert {"home_repairs", "ev_charging", "specialized"}.issubset(ids)


def test_providers_all_and_filter():
    r = requests.get(f"{API}/providers", timeout=15)
    assert r.status_code == 200
    all_p = r.json()
    assert len(all_p) == 12
    r2 = requests.get(f"{API}/providers", params={"category": "ev_charging"}, timeout=15)
    assert r2.status_code == 200
    ev = r2.json()
    assert len(ev) >= 3 and all(p["category_id"] == "ev_charging" for p in ev)


def test_provider_detail():
    lst = requests.get(f"{API}/providers", timeout=15).json()
    pid = lst[0]["provider_id"]
    r = requests.get(f"{API}/providers/{pid}", timeout=15)
    assert r.status_code == 200
    assert r.json()["provider_id"] == pid


@pytest.fixture(scope="module")
def booking(demo_token):
    lst = requests.get(f"{API}/providers", params={"category": "ev_charging"}, timeout=15).json()
    pid = lst[0]["provider_id"]
    payload = {
        "provider_id": pid,
        "service": "Emergency Charge",
        "scheduled_at": "2026-02-15T10:00:00Z",
        "address": "123 Test St",
        "notes": "TEST booking",
        "estimated_hours": 1.5,
    }
    r = requests.post(f"{API}/bookings", json=payload, headers=auth(demo_token), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_create_booking(booking):
    assert booking["status"] == "requested"
    assert booking["total_amount"] > 0


def test_list_bookings(demo_token, booking):
    r = requests.get(f"{API}/bookings", headers=auth(demo_token), timeout=15)
    assert r.status_code == 200
    ids = {b["booking_id"] for b in r.json()}
    assert booking["booking_id"] in ids


def test_cancel_booking(demo_token, booking):
    bid = booking["booking_id"]
    r = requests.patch(f"{API}/bookings/{bid}/status", json={"status": "cancelled"}, headers=auth(demo_token), timeout=15)
    assert r.status_code == 200
    # verify
    lst = requests.get(f"{API}/bookings", headers=auth(demo_token), timeout=15).json()
    b = next(x for x in lst if x["booking_id"] == bid)
    assert b["status"] == "cancelled"


def test_chat_ai(demo_token):
    sid = f"TEST_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{API}/chat", json={"session_id": sid, "message": "My kitchen sink is leaking, help?"}, headers=auth(demo_token), timeout=90)
    assert r.status_code == 200, r.text
    assert len(r.json().get("reply", "")) > 0


def test_stripe_checkout(demo_token):
    lst = requests.get(f"{API}/providers", timeout=15).json()
    pid = lst[0]["provider_id"]
    b = requests.post(f"{API}/bookings", json={
        "provider_id": pid, "service": "Plumber", "scheduled_at": "2026-02-20T09:00:00Z",
        "address": "1 Main", "estimated_hours": 1.0,
    }, headers=auth(demo_token), timeout=30).json()
    r = requests.post(f"{API}/payments/checkout", json={"booking_id": b["booking_id"]}, headers=auth(demo_token), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("url", "").startswith("http")


def test_admin_stats(admin_token):
    r = requests.get(f"{API}/admin/stats", headers=auth(admin_token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ["users", "providers", "bookings"]:
        assert k in d


def test_admin_stats_forbidden_for_customer(demo_token):
    r = requests.get(f"{API}/admin/stats", headers=auth(demo_token), timeout=15)
    assert r.status_code == 403


def test_provider_apply_promotes_user():
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    reg = requests.post(f"{API}/auth/register", json={"email": email, "password": "Pass@1234", "name": "Applicant"}, timeout=30).json()
    tok = reg["token"]
    r = requests.post(f"{API}/providers/apply", json={
        "business_name": "TEST Biz", "category_id": "specialized", "bio": "test bio",
        "hourly_rate": 40, "services": ["Assembly"], "city": "Test",
    }, headers=auth(tok), timeout=30)
    assert r.status_code == 200
    me = requests.get(f"{API}/auth/me", headers=auth(tok), timeout=15).json()
    assert me["is_provider"] is True
