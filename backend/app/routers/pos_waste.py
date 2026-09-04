from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import pos_models, pos_schemas
from ..database import get_db

router = APIRouter(prefix="/api/pos/waste", tags=["pos-waste"])


@router.get("", response_model=list[pos_schemas.WasteOut])
def list_waste(db: Session = Depends(get_db)):
    stmt = select(pos_models.WasteEntry).order_by(pos_models.WasteEntry.timestamp.desc())
    return db.scalars(stmt).all()


@router.post("", response_model=pos_schemas.WasteOut, status_code=201)
def log_waste(payload: pos_schemas.WasteCreate, db: Session = Depends(get_db)):
    staff = db.get(pos_models.Staff, payload.staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")
    entry = pos_models.WasteEntry(
        item_name=payload.item_name,
        qty=payload.qty,
        unit=payload.unit,
        unit_cost=payload.unit_cost,
        cost_impact=round(payload.qty * payload.unit_cost),
        reason=payload.reason,
        staff_id=payload.staff_id,
        notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
