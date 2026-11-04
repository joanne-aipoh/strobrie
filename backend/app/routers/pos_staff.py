import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import pos_models, pos_schemas
from ..database import get_db
from ..pos_auth import hash_pin, verify_pin

router = APIRouter(prefix="/api/pos/staff", tags=["pos-staff"])


def _generate_temp_pin(db: Session) -> str:
    """A random 6-digit PIN not currently in use. Login is by name + PIN, so
    PINs don't have to be unique, but we avoid clashes so two new hires don't
    briefly share the same temporary PIN."""
    for _ in range(50):
        pin = f"{secrets.randbelow(1_000_000):06d}"
        if not db.query(pos_models.Staff).filter(pos_models.Staff.pin_hash == hash_pin(pin)).first():
            return pin
    # Extremely unlikely; fall back to whatever the last candidate was.
    return pin


@router.get("", response_model=list[pos_schemas.StaffOut])
def list_staff(db: Session = Depends(get_db)):
    """Names, roles and whether a PIN reset is pending — never the PIN hash."""
    return db.scalars(select(pos_models.Staff)).all()


@router.post("/setup", response_model=pos_schemas.StaffOut, status_code=201)
def setup_first_manager(payload: pos_schemas.StaffCreate, db: Session = Depends(get_db)):
    if db.query(pos_models.Staff).count() > 0:
        raise HTTPException(status_code=409, detail="Staff already set up — use the login screen.")
    # The first manager chooses their own PIN, so no forced change.
    staff = pos_models.Staff(
        name=payload.name, pin_hash=hash_pin(payload.pin), role="manager", must_change_pin=False
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.post("", response_model=pos_schemas.StaffCreatedOut, status_code=201)
def add_staff(payload: pos_schemas.StaffAdd, db: Session = Depends(get_db)):
    temp_pin = _generate_temp_pin(db)
    staff = pos_models.Staff(
        name=payload.name, pin_hash=hash_pin(temp_pin), role=payload.role, must_change_pin=True
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    # temp_pin is returned once so the manager can pass it on; it's never stored
    # in plaintext or shown again.
    return pos_schemas.StaffCreatedOut(
        id=staff.id, name=staff.name, role=staff.role, must_change_pin=staff.must_change_pin, temp_pin=temp_pin
    )


@router.post("/{staff_id}/reset-pin", response_model=pos_schemas.StaffCreatedOut)
def reset_pin(staff_id: int, db: Session = Depends(get_db)):
    """Manager action: issue a new temporary PIN (e.g. when someone forgets
    theirs). They'll be forced to set a new one on next login."""
    staff = db.get(pos_models.Staff, staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")
    temp_pin = _generate_temp_pin(db)
    staff.pin_hash = hash_pin(temp_pin)
    staff.must_change_pin = True
    db.commit()
    db.refresh(staff)
    return pos_schemas.StaffCreatedOut(
        id=staff.id, name=staff.name, role=staff.role, must_change_pin=staff.must_change_pin, temp_pin=temp_pin
    )


@router.post("/change-pin", response_model=pos_schemas.StaffOut)
def change_pin(payload: pos_schemas.ChangePinRequest, db: Session = Depends(get_db)):
    """Self-service: a staff member replaces their own PIN. Requires the current
    PIN, which doubles as authentication for the change."""
    staff = db.get(pos_models.Staff, payload.staff_id)
    if staff is None or not verify_pin(payload.current_pin, staff.pin_hash):
        raise HTTPException(status_code=401, detail="Current PIN is incorrect")
    if payload.new_pin == payload.current_pin:
        raise HTTPException(status_code=400, detail="New PIN must be different from the current one")
    staff.pin_hash = hash_pin(payload.new_pin)
    staff.must_change_pin = False
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
