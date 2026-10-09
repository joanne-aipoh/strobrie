from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.orm import Session

from .. import meta_capi, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


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
