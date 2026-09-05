from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/contact", tags=["contact"])


@router.post("", response_model=schemas.ContactMessageOut, status_code=201)
def create_contact_message(payload: schemas.ContactMessageCreate, db: Session = Depends(get_db)):
    message = models.ContactMessage(**payload.model_dump())
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
