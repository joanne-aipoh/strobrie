from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .. import pos_models, pos_schemas
from ..database import get_db

router = APIRouter(prefix="/api/pos", tags=["pos-events"])


def _tickets_sold_for_tier(db: Session, tier_id: int) -> int:
    stmt = select(func.count(pos_models.Ticket.id)).where(pos_models.Ticket.tier_id == tier_id)
    return db.scalar(stmt) or 0


def _tickets_sold_for_event(db: Session, event_id: int) -> int:
    stmt = select(func.count(pos_models.Ticket.id)).where(pos_models.Ticket.pos_event_id == event_id)
    return db.scalar(stmt) or 0


def _to_event_out(db: Session, event: pos_models.PosEvent) -> pos_schemas.PosEventOut:
    tiers_out = []
    total_sold = 0
    for tier in event.tiers:
        sold = _tickets_sold_for_tier(db, tier.id)
        total_sold += sold
        remaining = (tier.qty - sold) if tier.qty > 0 else None
        tiers_out.append(
            pos_schemas.TierOut(
                id=tier.id,
                name=tier.name,
                price=tier.price,
                qty=tier.qty,
                sold=sold,
                remaining=remaining,
                online_purchasable=tier.online_purchasable,
            )
        )
    return pos_schemas.PosEventOut(
        id=event.id,
        name=event.name,
        date=event.date,
        time=event.time,
        capacity=event.capacity,
        description=event.description,
        cost_budget=event.cost_budget,
        tiers=tiers_out,
        tickets_sold=total_sold,
    )


def _record_ticket_sale(db: Session, event_name: str, tier_name: str, price: int, payment_method: str, staff_id: int):
    if price <= 0:
        return
    sale = pos_models.Sale(
        staff_id=staff_id,
        payment_method=payment_method,
        subtotal=price,
        discount=0,
        total=price,
    )
    sale.items = [pos_models.SaleItem(name=f"{event_name} — {tier_name} ticket", category="Events", qty=1, price=price)]
    db.add(sale)


@router.get("/events", response_model=list[pos_schemas.PosEventOut])
def list_events(db: Session = Depends(get_db)):
    stmt = select(pos_models.PosEvent).options(selectinload(pos_models.PosEvent.tiers)).order_by(pos_models.PosEvent.date)
    events = db.scalars(stmt).all()
    return [_to_event_out(db, e) for e in events]


@router.get("/events/{event_id}", response_model=pos_schemas.PosEventOut)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.get(pos_models.PosEvent, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return _to_event_out(db, event)


@router.post("/events", response_model=pos_schemas.PosEventOut, status_code=201)
def create_event(payload: pos_schemas.PosEventCreate, db: Session = Depends(get_db)):
    staff = db.get(pos_models.Staff, payload.staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")

    event = pos_models.PosEvent(
        name=payload.name,
        date=payload.date,
        time=payload.time,
        capacity=payload.capacity,
        description=payload.description,
        cost_budget=payload.cost_budget,
        created_by_staff_id=staff.id,
    )
    event.tiers = [
        pos_models.TicketTier(name=t.name, price=t.price, qty=t.qty, online_purchasable=t.online_purchasable)
        for t in payload.tiers
    ]
    db.add(event)
    db.commit()
    db.refresh(event)
    return _to_event_out(db, event)


@router.patch("/events/{event_id}", response_model=pos_schemas.PosEventOut)
def update_event(event_id: int, payload: pos_schemas.PosEventUpdate, db: Session = Depends(get_db)):
    event = db.get(pos_models.PosEvent, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    return _to_event_out(db, event)


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.get(pos_models.PosEvent, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if _tickets_sold_for_event(db, event_id) > 0:
        raise HTTPException(status_code=400, detail="Can't delete an event that already has tickets sold")

    db.delete(event)
    db.commit()


@router.post("/events/{event_id}/tiers", response_model=pos_schemas.TierOut, status_code=201)
def add_tier(event_id: int, payload: pos_schemas.TierCreate, db: Session = Depends(get_db)):
    event = db.get(pos_models.PosEvent, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    tier = pos_models.TicketTier(
        pos_event_id=event_id,
        name=payload.name,
        price=payload.price,
        qty=payload.qty,
        online_purchasable=payload.online_purchasable,
    )
    db.add(tier)
    db.commit()
    db.refresh(tier)
    return pos_schemas.TierOut(id=tier.id, name=tier.name, price=tier.price, qty=tier.qty, sold=0, remaining=(tier.qty or None), online_purchasable=tier.online_purchasable)


@router.patch("/events/{event_id}/tiers/{tier_id}", response_model=pos_schemas.TierOut)
def update_tier(event_id: int, tier_id: int, payload: pos_schemas.TierUpdate, db: Session = Depends(get_db)):
    tier = db.get(pos_models.TicketTier, tier_id)
    if tier is None or tier.pos_event_id != event_id:
        raise HTTPException(status_code=404, detail="Ticket tier not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(tier, field, value)

    db.commit()
    db.refresh(tier)
    sold = _tickets_sold_for_tier(db, tier.id)
    remaining = (tier.qty - sold) if tier.qty > 0 else None
    return pos_schemas.TierOut(
        id=tier.id, name=tier.name, price=tier.price, qty=tier.qty, sold=sold, remaining=remaining,
        online_purchasable=tier.online_purchasable,
    )


@router.delete("/events/{event_id}/tiers/{tier_id}", status_code=204)
def delete_tier(event_id: int, tier_id: int, db: Session = Depends(get_db)):
    tier = db.get(pos_models.TicketTier, tier_id)
    if tier is None or tier.pos_event_id != event_id:
        raise HTTPException(status_code=404, detail="Ticket tier not found")
    if _tickets_sold_for_tier(db, tier.id) > 0:
        raise HTTPException(status_code=400, detail="Can't remove a tier that already has tickets sold")

    db.delete(tier)
    db.commit()


@router.get("/events/{event_id}/tickets", response_model=list[pos_schemas.TicketOut])
def list_tickets(event_id: int, db: Session = Depends(get_db)):
    stmt = select(pos_models.Ticket).where(pos_models.Ticket.pos_event_id == event_id)
    return db.scalars(stmt).all()


@router.post("/events/{event_id}/tickets", response_model=pos_schemas.TicketOut, status_code=201)
def sell_ticket(event_id: int, payload: pos_schemas.TicketSellRequest, db: Session = Depends(get_db)):
    event = db.get(pos_models.PosEvent, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    tier = db.get(pos_models.TicketTier, payload.tier_id)
    if tier is None or tier.pos_event_id != event_id:
        raise HTTPException(status_code=404, detail="Ticket tier not found")
    staff = db.get(pos_models.Staff, payload.staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")

    if tier.qty > 0 and _tickets_sold_for_tier(db, tier.id) >= tier.qty:
        raise HTTPException(status_code=400, detail="That tier is sold out")

    paid_now = payload.channel == "paid"
    ticket = pos_models.Ticket(
        pos_event_id=event_id,
        tier_id=tier.id,
        buyer_name=payload.buyer_name,
        buyer_contact=payload.buyer_contact,
        channel="paid-now" if paid_now else "reserved",
        paid=paid_now,
        payment_method=payload.payment_method if paid_now else None,
        sold_by_staff_id=staff.id,
    )
    db.add(ticket)

    if paid_now:
        _record_ticket_sale(db, event.name, tier.name, tier.price, payload.payment_method, staff.id)

    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/checkin", response_model=pos_schemas.TicketOut)
def checkin_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.get(pos_models.Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket.checked_in = True
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/collect-and-checkin", response_model=pos_schemas.TicketOut)
def collect_payment_and_checkin(ticket_id: int, payload: pos_schemas.CollectPaymentRequest, db: Session = Depends(get_db)):
    ticket = db.get(pos_models.Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    staff = db.get(pos_models.Staff, payload.staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")
    tier = db.get(pos_models.TicketTier, ticket.tier_id)
    event = db.get(pos_models.PosEvent, ticket.pos_event_id)

    ticket.paid = True
    ticket.payment_method = payload.payment_method
    ticket.checked_in = True

    _record_ticket_sale(db, event.name, tier.name, tier.price, payload.payment_method, staff.id)

    db.commit()
    db.refresh(ticket)
    return ticket
