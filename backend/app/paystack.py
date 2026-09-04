import os

import httpx

PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY")
PAYSTACK_BASE_URL = "https://api.paystack.co"


class PaystackNotConfigured(Exception):
    pass


class PaystackError(Exception):
    pass


def _headers() -> dict:
    if not PAYSTACK_SECRET_KEY:
        raise PaystackNotConfigured(
            "PAYSTACK_SECRET_KEY is not set — add it to backend/.env (get it from your Paystack dashboard)."
        )
    return {"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"}


def initialize_transaction(email: str, amount_naira: int, reference: str, callback_url: str) -> dict:
    """Amount is converted to kobo (Paystack's smallest unit) here — callers pass whole Naira."""
    payload = {
        "email": email,
        "amount": amount_naira * 100,
        "reference": reference,
        "callback_url": callback_url,
    }
    resp = httpx.post(f"{PAYSTACK_BASE_URL}/transaction/initialize", json=payload, headers=_headers(), timeout=15)
    body = resp.json()
    if not resp.is_success or not body.get("status"):
        raise PaystackError(body.get("message", "Failed to initialize Paystack transaction"))
    return body["data"]  # { authorization_url, access_code, reference }


def verify_transaction(reference: str) -> dict:
    resp = httpx.get(f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}", headers=_headers(), timeout=15)
    body = resp.json()
    if not resp.is_success or not body.get("status"):
        raise PaystackError(body.get("message", "Failed to verify Paystack transaction"))
    return body["data"]  # includes status: 'success' | 'failed' | ...
