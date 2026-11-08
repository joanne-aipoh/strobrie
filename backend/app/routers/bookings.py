from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.orm import Session

from .. import email_utils, meta_capi, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/bookings", tags=["bookings"])
# Staff-only; under /api/pos so nginx keeps it off the public hostnames.
admin_router = APIRouter(prefix="/api/pos/space-requests", tags=["space-requests"])


@admin_router.get("", response_model=list[schemas.BookingRequestOut])
def list_space_requests(db: Session = Depends(get_db)):
    return (
        db.query(models.BookingRequest)
        .order_by(models.BookingRequest.created_at.desc())
        .all()
    )


@router.post("", response_model=schemas.BookingRequestOut, status_code=201)
def create_booking_request(
    payload: schemas.BookingRequestCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    booking = models.BookingRequest(**payload.model_dump())
    db.add(booking)
    db.commit()
    db.refresh(booking)
    # Alert the café (values captured now — the ORM row is detached post-response).
    background_tasks.add_task(
        email_utils.send_space_request_alert,
        booking.name,
        booking.email,
        booking.phone,
        booking.space,
        booking.event_type,
        booking.guest_count,
        booking.preferred_date,
        booking.notes,
        booking.created_at,
    )
    context = meta_capi.request_context(request)
    background_tasks.add_task(
        meta_capi.send_event,
        "Lead",
        context["event_id"],
        context,
        email=payload.email,
        name=payload.name,
        custom_data={"content_category": "space_rental", "content_name": payload.space},
    )
    return booking
