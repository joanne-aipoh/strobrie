"""Meta Conversions API (CAPI) — server-side copies of the website's pixel events.

The browser pixel (frontend/src/metaPixel.js) misses events when an ad
blocker, iOS privacy setting or a closed tab gets in the way. Sending the same
event from here as well, with the same event_id, lets Meta count it once
(deduplication) without losing it.

Everything here is best-effort: it's called from FastAPI BackgroundTasks after
the response is sent, never raises, and is a silent no-op until
META_CAPI_ACCESS_TOKEN is set in backend/.env.
"""

import hashlib
import logging
import os
import re
import time

import httpx
from fastapi import Request

logger = logging.getLogger(__name__)

META_PIXEL_ID = os.getenv("META_PIXEL_ID", "979447397776892")
META_CAPI_ACCESS_TOKEN = os.getenv("META_CAPI_ACCESS_TOKEN")
# Set only while checking events in Events Manager → Test events; events sent
# with a test code don't count towards real ad results.
META_CAPI_TEST_EVENT_CODE = os.getenv("META_CAPI_TEST_EVENT_CODE")
META_GRAPH_VERSION = os.getenv("META_GRAPH_VERSION", "v24.0")


def _sha256(value: str | None) -> str | None:
    if not value:
        return None
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()


def _normalize_ng_phone(phone: str | None) -> str | None:
    """Meta wants digits only with country code: 0809... → 234809..."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0") and len(digits) == 11:
        digits = "234" + digits[1:]
    return digits or None


def request_context(request: Request) -> dict:
    """What CAPI needs from the customer's own browser request. Captured while
    the request is still in hand, since the event is sent after the response."""
    forwarded = request.headers.get("x-forwarded-for")
    ip = (
        forwarded.split(",")[0].strip()
        if forwarded
        else request.headers.get("x-real-ip") or (request.client.host if request.client else None)
    )
    return {
        "client_ip_address": ip,
        "client_user_agent": request.headers.get("user-agent"),
        # Set by the pixel on .strobrie.com, so they reach the API on any of
        # our hostnames. _fbc is only present after an ad click.
        "fbp": request.cookies.get("_fbp"),
        "fbc": request.cookies.get("_fbc"),
        "event_source_url": request.headers.get("referer"),
        # Browser-generated id for events with no natural id of their own
        # (bookings, RSVPs), so the pixel and server copies dedupe.
        "event_id": request.headers.get("x-meta-event-id"),
    }


def send_event(
    event_name: str,
    event_id: str | None,
    context: dict,
    *,
    email: str | None = None,
    phone: str | None = None,
    name: str | None = None,
    custom_data: dict | None = None,
) -> None:
    if not META_CAPI_ACCESS_TOKEN:
        return

    first, _, last = (name or "").strip().partition(" ")
    user_data = {
        "em": _sha256(email),
        "ph": _sha256(_normalize_ng_phone(phone)),
        "fn": _sha256(first),
        "ln": _sha256(last),
        "ct": _sha256("abuja"),
        "country": _sha256("ng"),
        "client_ip_address": context.get("client_ip_address"),
        "client_user_agent": context.get("client_user_agent"),
        "fbp": context.get("fbp"),
        "fbc": context.get("fbc"),
    }
    event = {
        "event_name": event_name,
        "event_time": int(time.time()),
        "action_source": "website",
        "event_source_url": context.get("event_source_url"),
        "event_id": event_id,
        "user_data": {k: v for k, v in user_data.items() if v},
        "custom_data": custom_data or {},
    }
    body = {"data": [{k: v for k, v in event.items() if v is not None}]}
    if META_CAPI_TEST_EVENT_CODE:
        body["test_event_code"] = META_CAPI_TEST_EVENT_CODE

    try:
        resp = httpx.post(
            f"https://graph.facebook.com/{META_GRAPH_VERSION}/{META_PIXEL_ID}/events",
            params={"access_token": META_CAPI_ACCESS_TOKEN},
            json=body,
            timeout=10,
        )
        if not resp.is_success:
            logger.warning("Meta CAPI %s rejected: %s %s", event_name, resp.status_code, resp.text[:500])
    except httpx.HTTPError as e:
        logger.warning("Meta CAPI %s failed: %s", event_name, e)
