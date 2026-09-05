from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import pos_models, pos_schemas
from ..database import get_db
from ..pos_auth import hash_pin, verify_pin

router = APIRouter(prefix="/api/pos/staff", tags=["pos-staff"])


@router.get("", response_model=list[pos_schemas.StaffOut])
def list_staff(db: Session = Depends(get_db)):
    """Names and roles only — never the PIN hash."""
    return db.scalars(select(pos_models.Staff)).all()


@router.post("/setup", response_model=pos_schemas.StaffOut, status_code=201)
def setup_first_manager(payload: pos_schemas.StaffCreate, db: Session = Depends(get_db)):
    if db.query(pos_models.Staff).count() > 0:
        raise HTTPException(status_code=409, detail="Staff already set up — use the login screen.")
    staff = pos_models.Staff(name=payload.name, pin_hash=hash_pin(payload.pin), role="manager")
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.post("", response_model=pos_schemas.StaffOut, status_code=201)
def add_staff(payload: pos_schemas.StaffCreate, db: Session = Depends(get_db)):
    pin_hash = hash_pin(payload.pin)
    dupe = db.query(pos_models.Staff).filter(pos_models.Staff.pin_hash == pin_hash).first()
    if dupe:
        raise HTTPException(status_code=400, detail="That PIN is already in use — pick a different one.")
    staff = pos_models.Staff(name=payload.name, pin_hash=pin_hash, role=payload.role)
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}", status_code=204)
def remove_staff(staff_id: int, db: Session = Depends(get_db)):
    staff = db.get(pos_models.Staff, staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")
    db.delete(staff)
    db.commit()


@router.post("/login", response_model=pos_schemas.StaffOut)
def login(payload: pos_schemas.LoginRequest, db: Session = Depends(get_db)):
    staff = db.get(pos_models.Staff, payload.staff_id)
    if staff is None or not verify_pin(payload.pin, staff.pin_hash):
        raise HTTPException(status_code=401, detail="Incorrect PIN")
    return staff
