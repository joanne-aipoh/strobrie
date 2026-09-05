from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import pos_models, pos_schemas
from ..database import get_db

router = APIRouter(prefix="/api/pos/customers", tags=["pos-customers"])


@router.get("", response_model=list[pos_schemas.CustomerOut])
def list_customers(search: str | None = Query(default=None), db: Session = Depends(get_db)):
    stmt = select(pos_models.LoyaltyCustomer)
    customers = db.scalars(stmt).all()
    if search:
        needle = search.strip().lower()
        customers = [c for c in customers if needle in c.name.lower() or needle in c.phone]
    return sorted(customers, key=lambda c: c.points, reverse=True)


@router.get("/lookup", response_model=pos_schemas.CustomerOut)
def lookup_customer(phone: str, db: Session = Depends(get_db)):
    customer = db.query(pos_models.LoyaltyCustomer).filter(pos_models.LoyaltyCustomer.phone == phone.strip()).first()
    if customer is None:
        raise HTTPException(status_code=404, detail="No customer with that phone number")
    return customer


@router.post("", response_model=pos_schemas.CustomerOut, status_code=201)
def create_customer(payload: pos_schemas.CustomerCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(pos_models.LoyaltyCustomer)
        .filter(pos_models.LoyaltyCustomer.phone == payload.phone.strip())
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="A customer with that phone already exists")
    customer = pos_models.LoyaltyCustomer(name=payload.name.strip(), phone=payload.phone.strip())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer
