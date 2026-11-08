import os
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import paystack, pottery_models, pottery_schemas
from ..database import get_db

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Session rules (from the flyer).
DAYS = {1, 4, 5}  # Tue, Fri, Sat  (Mon=0 … Sun=6)
TIMES = ["10:00", "12:00", "14:00"]
TIME_LABELS = {"10:00": "10:00 AM", "12:00": "12:00 PM", "14:00": "2:00 PM"}
PUBLIC_CAPACITY = 6
PRICE_PUBLIC = 15000
PRICE_PRIVATE = 20000
WEEKS_AHEAD = 6

public_router = APIRouter(prefix="/api/pottery", tags=["pottery"])
# Staff-only; lives under /api/pos so nginx keeps it off the public hostnames.
admin_router = APIRouter(prefix="/api/pos/pottery", tags=["pottery-admin"])


def _upcoming_dates() -> list[date]:
    today = date.today()
    return [today + timedelta(days=i) for i in range(1, WEEKS_AHEAD * 7 + 1) if (today + timedelta(days=i)).weekday() in DAYS]


def _day_label(d: date) -> str:
    return f"{d.strftime('%a')} {d.day} {d.strftime('%b')}"


def _slot_state(db: Session, d: date, t: str) -> dict:
    blocked = (
        db.query(pottery_models.PotteryBlock).filter_by(date=d, time_slot=t).first() is not None
    )
    paid = db.query(pottery_models.PotteryBooking).filter_by(date=d, time_slot=t, paid=True).all()
    private = any(b.session_type == "private" for b in paid)
    public_seats = sum(b.seats for b in paid if b.session_type == "public")
    remaining = max(0, PUBLIC_CAPACITY - public_seats)
    open_ = (not blocked) and (not private)
    return {
        "blocked": blocked,
        "private": private,
        "public_seats": public_seats,
        "public_remaining": remaining,
        "public_available": open_ and remaining > 0,
        "private_available": open_ and public_seats == 0,
    }


# --- public ---------------------------------------------------------------
@public_router.get("/availability", response_model=list[pottery_schemas.DayOut])
def availability(db: Session = Depends(get_db)):
    days = []
    for d in _upcoming_dates():
        slots = []
        any_open = False
        for t in TIMES:
            s = _slot_state(db, d, t)
            any_open = any_open or s["public_available"] or s["private_available"]
            slots.append(
                pottery_schemas.SlotOut(
                    time=t,
                    label=TIME_LABELS[t],
                    public_remaining=s["public_remaining"],
                    public_available=s["public_available"],
                    private_available=s["private_available"],
                )
            )
        if any_open:
            days.append(pottery_schemas.DayOut(date=d, label=_day_label(d), slots=slots))
    return days


@public_router.post("/book", response_model=pottery_schemas.CheckoutResponse, status_code=201)
def book(payload: pottery_schemas.BookRequest, db: Session = Depends(get_db)):
    d = payload.date
    if d.weekday() not in DAYS or payload.time_slot not in TIMES:
        raise HTTPException(status_code=400, detail="That isn't a pottery session slot.")
    if d <= date.today():
        raise HTTPException(status_code=400, detail="Please pick an upcoming date.")

    s = _slot_state(db, d, payload.time_slot)
    if s["blocked"]:
        raise HTTPException(status_code=409, detail="That slot isn't available.")

    if payload.session_type == "private":
        if not s["private_available"]:
            raise HTTPException(status_code=409, detail="That slot is already taken.")
        amount, seats = PRICE_PRIVATE, 1
    else:
        if payload.seats > s["public_remaining"]:
            raise HTTPException(status_code=409, detail=f"Only {s['public_remaining']} seat(s) left in that slot.")
        amount, seats = PRICE_PUBLIC * payload.seats, payload.seats

    reference = f"strobrie-pottery-{uuid.uuid4().hex[:16]}"
    booking = pottery_models.PotteryBooking(
        date=d,
        time_slot=payload.time_slot,
        session_type=payload.session_type,
        seats=seats,
        customer_name=payload.customer_name.strip(),
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone.strip(),
        amount=amount,
        paid=False,
        payment_reference=reference,
    )
    db.add(booking)
    db.commit()

    callback_url = payload.callback_url or f"{FRONTEND_URL}/pottery/confirmation"
    try:
        data = paystack.initialize_transaction(
            email=payload.customer_email, amount_naira=amount, reference=reference, callback_url=callback_url
        )
    except paystack.PaystackNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except paystack.PaystackError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return pottery_schemas.CheckoutResponse(reference=reference, authorization_url=data["authorization_url"])


@public_router.get("/verify/{reference}", response_model=pottery_schemas.BookingOut)
def verify(reference: str, db: Session = Depends(get_db)):
    booking = (
        db.query(pottery_models.PotteryBooking).filter_by(payment_reference=reference).first()
    )
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.paid:
        return booking
    try:
        data = paystack.verify_transaction(reference)
    except paystack.PaystackError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if data.get("status") == "success":
        booking.paid = True
        db.commit()
        db.refresh(booking)
    return booking


@public_router.post("/private-request", status_code=201)
def private_request(payload: pottery_schemas.PrivateRequestCreate, db: Session = Depends(get_db)):
    req = pottery_models.PotteryRequest(
        customer_name=payload.customer_name.strip(),
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone.strip(),
        preferred=payload.preferred.strip(),
        message=(payload.message or "").strip() or None,
    )
    db.add(req)
    db.commit()
    return {"ok": True}


# --- admin (Flow) ---------------------------------------------------------
@admin_router.get("/overview", response_model=list[pottery_schemas.AdminSlotOut])
def overview(db: Session = Depends(get_db)):
    out = []
    for d in _upcoming_dates():
        for t in TIMES:
            s = _slot_state(db, d, t)
            bookings = (
                db.query(pottery_models.PotteryBooking).filter_by(date=d, time_slot=t, paid=True).all()
            )
            out.append(
                pottery_schemas.AdminSlotOut(
                    date=d,
                    label=_day_label(d),
                    time=t,
                    time_label=TIME_LABELS[t],
                    blocked=s["blocked"],
                    public_seats=s["public_seats"],
                    private_booked=s["private"],
                    bookings=bookings,
                )
            )
    return out


@admin_router.post("/block")
def set_block(payload: pottery_schemas.BlockRequest, db: Session = Depends(get_db)):
    existing = (
        db.query(pottery_models.PotteryBlock)
        .filter_by(date=payload.date, time_slot=payload.time_slot)
        .first()
    )
    if payload.blocked and existing is None:
        db.add(pottery_models.PotteryBlock(date=payload.date, time_slot=payload.time_slot, reason=payload.reason))
        db.commit()
    elif not payload.blocked and existing is not None:
        db.delete(existing)
        db.commit()
    return {"ok": True}


@admin_router.get("/requests", response_model=list[pottery_schemas.RequestOut])
def list_requests(db: Session = Depends(get_db)):
    return (
        db.query(pottery_models.PotteryRequest)
        .order_by(pottery_models.PotteryRequest.created_at.desc())
        .all()
    )


@admin_router.post("/requests/{req_id}/handled", response_model=pottery_schemas.RequestOut)
def mark_handled(req_id: int, db: Session = Depends(get_db)):
    req = db.get(pottery_models.PotteryRequest, req_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found.")
    req.status = "handled"
    db.commit()
    db.refresh(req)
    return req
