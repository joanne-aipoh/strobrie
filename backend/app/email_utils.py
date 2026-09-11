import json
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import quote

from . import shop_models

# Same business number as the frontend's WhatsApp button/checkout link
# (frontend/src/whatsapp.js) — kept in sync manually since this is Python,
# not shared JS.
WHATSAPP_NUMBER = "2348090701995"


def _whatsapp_link(order_id: int) -> str:
    message = f"Hi Strobriē! I have a question about my order #{order_id}."
    return f"https://wa.me/{WHATSAPP_NUMBER}?text={quote(message)}"

# Sends via Gmail SMTP using the shop's own Gmail account — no separate
# transactional-email service needed. Add SMTP_USER (the Gmail address) and
# SMTP_PASSWORD (a Gmail App Password, not the normal login password — see
# https://myaccount.google.com/apppasswords, requires 2FA enabled) to
# backend/.env. If either is missing, sending is silently skipped so a
# misconfigured mailbox never breaks checkout.
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Strobriē By Joanne")


def _fmt_naira(n: int) -> str:
    return f"₦{n:,.0f}" if isinstance(n, (int, float)) else f"₦{n}"


def _format_flavor_breakdown(raw: str | None) -> str | None:
    if not raw:
        return None
    try:
        breakdown = json.loads(raw)
    except (TypeError, ValueError):
        return None
    return ", ".join(f"{qty} {label}" for label, qty in breakdown.items())


def _item_rows_html(items: list[shop_models.OrderItem]) -> str:
    rows = []
    for item in items:
        details = []
        if item.inscription:
            details.append(f'Inscription: "{item.inscription}"')
        if item.design_notes:
            details.append(f'Color: "{item.design_notes}"')
        if item.addons:
            details.append(f'Add-ons: "{item.addons}"')
        breakdown = _format_flavor_breakdown(item.flavor_breakdown)
        if breakdown:
            details.append(breakdown)
        detail_html = (
            f'<div style="font-size:12.5px;color:#c2477a;margin-top:2px;">{"<br>".join(details)}</div>'
            if details
            else ""
        )
        rows.append(
            f"""
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.08);">
                {item.qty} &times; {item.name}
                {detail_html}
              </td>
              <td style="padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.08);text-align:right;white-space:nowrap;">
                {_fmt_naira(item.price * item.qty)}
              </td>
            </tr>
            """
        )
    return "".join(rows)


def _build_order_email_html(order: shop_models.Order) -> str:
    fulfillment_line = (
        f"Delivery to: {order.delivery_address}" + (f" ({order.delivery_area})" if order.delivery_area else "")
        if order.fulfillment_method == "delivery"
        else "Pickup at the cafe"
    )
    timing_line = (
        f"Requested for: {order.requested_at.strftime('%a, %d %b %Y — %I:%M %p')}"
        if order.requested_at
        else "As soon as possible"
    )
    return f"""
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;">
      <h1 style="font-size:1.4rem;color:#1a1a1a;margin-bottom:4px;">Thank you, {order.customer_name}!</h1>
      <p style="color:#2f7d4f;font-weight:600;margin-top:0;">
        Payment confirmed — order #{order.id} is on its way to being prepared.
      </p>
      <div style="background:#fdf2ed;border-radius:16px;padding:20px;margin-top:16px;">
        <h2 style="font-size:1.1rem;color:#c2477a;margin-top:0;">Order #{order.id}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          {_item_rows_html(order.items)}
        </table>
        <table style="width:100%;margin-top:8px;font-size:14px;font-weight:700;">
          <tr><td style="padding-top:8px;">Total</td><td style="padding-top:8px;text-align:right;">{_fmt_naira(order.total)}</td></tr>
        </table>
        <p style="margin:14px 0 0;font-size:14px;">{fulfillment_line}</p>
        <p style="margin:2px 0 0;font-size:14px;">{timing_line}</p>
      </div>
      <p style="margin-top:20px;font-size:13px;color:#6b6b6b;">
        Questions about your order?
        <a href="{_whatsapp_link(order.id)}" style="color:#c2477a;font-weight:600;text-decoration:none;">
          Message us on WhatsApp
        </a>.
      </p>
      <p style="margin-top:24px;font-size:13px;color:#6b6b6b;">— Strobriē By Joanne</p>
    </div>
    """


def send_order_confirmation_email(order: shop_models.Order) -> bool:
    """Best-effort — returns False (and prints a warning) instead of raising,
    so a missing/broken mailbox never breaks the checkout flow itself."""
    if not SMTP_USER or not SMTP_PASSWORD:
        print("WARNING: SMTP_USER/SMTP_PASSWORD not set — skipping order confirmation email.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your Strobriē order #{order.id} is confirmed"
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
    msg["To"] = order.customer_email
    msg.attach(MIMEText(_build_order_email_html(order), "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, [order.customer_email], msg.as_string())
        return True
    except Exception as e:  # noqa: BLE001 — best-effort send, never break checkout over this
        print(f"WARNING: failed to send order confirmation email for order #{order.id}: {e}")
        return False
