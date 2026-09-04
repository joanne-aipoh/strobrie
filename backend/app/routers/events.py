from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/events", tags=["events"])


def _rsvp_count(db: Session, event_id: int) -> int:
    stmt = select(func.coalesce(func.sum(models.Rsvp.party_size), 0)).where(
        models.Rsvp.event_id == event_id
    )
    return db.scalar(stmt)


@router.get("", response_model=list[schemas.EventOut])
def list_events(db: Session = Depends(get_db)):
    stmt = (
        select(models.Event)
        .where(models.Event.start_time >= datetime.now(timezone.utc))
        .order_by(models.Event.start_time)
    )
    events = db.scalars(stmt).all()
    return [
        schemas.EventOut(
            id=e.id,
            title=e.title,
            description=e.description,
            start_time=e.start_time,
            capacity=e.capacity,
            rsvp_count=_rsvp_count(db, e.id),
        )
        for e in events
    ]


@router.post("/{event_id}/rsvps", response_model=schemas.RsvpOut, status_code=201)
def create_rsvp(event_id: int, payload: schemas.RsvpCreate, db: Session = Depends(get_db)):
    event = db.get(models.Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.capacity is not None:
        current = _rsvp_count(db, event_id)
        if current + payload.party_size > event.capacity:
            raise HTTPException(status_code=400, detail="Not enough spots left for this session")

    rsvp = models.Rsvp(event_id=event_id, **payload.model_dump())
    db.add(rsvp)
    db.commit()
    db.refresh(rsvp)
    return rsvp
