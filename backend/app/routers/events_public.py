import os
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .. import email_utils, paystack, pos_models, pos_schemas
from ..database import get_db

router = APIRouter(prefix="/api/ticketed-events", tags=["events-public"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def _tickets_sold_for_tier(db: Session, tier_id: int) -> int:
    stmt = select(func.count(pos_models.Ticket.id)).where(
        pos_models.Ticket.tier_id == tier_id, pos_models.Ticket.paid.is_(True)
    )
    return db.scalar(stmt) or 0


def _tickets_sold_for_event(db: Session, event_id: int) -> int:
    stmt = select(func.count(pos_models.Ticket.id)).where(
        pos_models.Ticket.pos_event_id == event_id, pos_models.Ticket.paid.is_(True)
    )
    return db.scalar(stmt) or 0


def _to_public_event(db: Session, event: pos_models.PosEvent) -> pos_schemas.PublicEventOut:
    sold_for_event = _tickets_sold_for_event(db, event.id)
    spots_remaining = max(event.capacity - sold_for_event, 0) if event.capacity is not None else None
    tiers_out = []
    for tier in event.tiers:
        if not tier.online_purchasable:
            continue
        sold = _tickets_sold_for_tier(db, tier.id)
        tier_remaining = (tier.qty - sold) if tier.qty > 0 else None
        # A tier is only as available as both its own limit AND the event's
        # overall capacity allow.
        if spots_remaining is not None:
            tier_remaining = spots_remaining if tier_remaining is None else min(tier_remaining, spots_remaining)
        tiers_out.append(pos_schemas.PublicTierOut(id=tier.id, name=tier.name, price=tier.price, remaining=tier_remaining))
    return pos_schemas.PublicEventOut(
        id=event.id,
        name=event.name,
        date=event.date,
        time=event.time,
        description=event.description,
        spots_remaining=spots_remaining,
        tiers=tiers_out,
    )


@router.get("", response_model=list[pos_schemas.PublicEventOut])
def list_upcoming_events(db: Session = Depends(get_db)):
    """Only events today or later — past events don't show on the public site."""
    stmt = (
        select(pos_models.PosEvent)
        .options(selectinload(pos_models.PosEvent.tiers))
        .where(pos_models.PosEvent.date >= date.today())
        .order_by(pos_models.PosEvent.date)
    )
    events = db.scalars(stmt).all()
    return [_to_public_event(db, e) for e in events]


@router.get("/{event_id}", response_model=pos_schemas.PublicEventOut)
def get_upcoming_event(event_id: int, db: Session = Depends(get_db)):
    event = db.get(pos_models.PosEvent, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return _to_public_event(db, event)


@router.post("/{event_id}/buy", response_model=pos_schemas.EventCheckoutResponse, status_code=201)
def buy_ticket(event_id: int, payload: pos_schemas.EventBuyRequest, db: Session = Depends(get_db)):
    event = db.get(pos_models.PosEvent, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    tier = db.get(pos_models.TicketTier, payload.tier_id)
    if tier is None or tier.pos_event_id != event_id:
        raise HTTPException(status_code=404, detail="Ticket option not found")
    if not tier.online_purchasable:
        raise HTTPException(status_code=400, detail="That option isn't available online — please book it in person")

    if event.capacity is not None and _tickets_sold_for_event(db, event_id) >= event.capacity:
        raise HTTPException(status_code=400, detail="This session is fully booked")
    if tier.qty > 0 and _tickets_sold_for_tier(db, tier.id) >= tier.qty:
        raise HTTPException(status_code=400, detail="That option is sold out — pick another")

    ticket = pos_models.Ticket(
        pos_event_id=event_id,
        tier_id=tier.id,
        buyer_name=payload.buyer_name,
        buyer_email=payload.buyer_email,
        buyer_contact=payload.buyer_contact,
        channel="online",
        paid=False,
    )
    db.add(ticket)
    db.flush()  # assigns ticket.id without committing yet

    reference = f"strobrie-event-{ticket.id}-{uuid.uuid4().hex[:8]}"
    callback_url = payload.callback_url or f"{FRONTEND_URL}/events/confirmation"
    try:
        data = paystack.initialize_transaction(
            email=payload.buyer_email,
            amount_naira=tier.price,
            reference=reference,
            callback_url=callback_url,
        )
    except paystack.PaystackNotConfigured as e:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(e))
    except paystack.PaystackError as e:
        db.rollback()
        raise HTTPException(status_code=502, detail=str(e))

    ticket.payment_reference = reference
    db.commit()
    db.refresh(ticket)

    return pos_schemas.EventCheckoutResponse(
        ticket_id=ticket.id, authorization_url=data["authorization_url"], reference=reference
    )


@router.get("/tickets/verify/{reference}", response_model=pos_schemas.PublicTicketOut)
def verify_ticket_payment(reference: str, db: Session = Depends(get_db)):
    ticket = db.query(pos_models.Ticket).filter(pos_models.Ticket.payment_reference == reference).first()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not ticket.paid:
        try:
            data = paystack.verify_transaction(reference)
        except paystack.PaystackError as e:
            raise HTTPException(status_code=502, detail=str(e))

        if data.get("status") == "success":
            ticket.paid = True
            db.commit()
            db.refresh(ticket)
            email_utils.send_ticket_confirmation_email(ticket)

    return pos_schemas.PublicTicketOut(
        id=ticket.id,
        pos_event_id=ticket.pos_event_id,
        buyer_name=ticket.buyer_name,
        buyer_email=ticket.buyer_email,
        channel=ticket.channel,
        paid=ticket.paid,
        purchase_timestamp=ticket.purchase_timestamp,
        event_name=ticket.event.name,
        event_date=ticket.event.date,
        event_time=ticket.event.time,
        event_description=ticket.event.description,
        tier_name=ticket.tier.name,
    )
