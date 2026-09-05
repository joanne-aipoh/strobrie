from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


@router.post("", response_model=schemas.BookingRequestOut, status_code=201)
def create_booking_request(payload: schemas.BookingRequestCreate, db: Session = Depends(get_db)):
    booking = models.BookingRequest(**payload.model_dump())
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking
