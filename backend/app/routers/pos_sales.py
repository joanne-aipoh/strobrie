from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import pos_models, pos_schemas, pos_stock
from ..database import get_db

router = APIRouter(prefix="/api/pos/sales", tags=["pos-sales"])

# Earn rate: 1 point per ₦200 spent = 0.5%. Redeem rate: each point is worth
# ₦1 off — points are just money, tracked as whole naira.
NAIRA_PER_POINT_EARNED = 200
NAIRA_PER_POINT_REDEEM = 1


@router.get("", response_model=list[pos_schemas.SaleOut])
def list_sales(db: Session = Depends(get_db)):
    stmt = (
        select(pos_models.Sale)
        .options(selectinload(pos_models.Sale.items))
        .order_by(pos_models.Sale.timestamp.desc())
    )
    return db.scalars(stmt).all()


def build_sale(
    db: Session,
    staff: pos_models.Staff,
    customer: pos_models.LoyaltyCustomer | None,
    items,
    payment_method: str,
    redeem_points: int,
    deductions: dict,
) -> pos_models.Sale:
    """Turn priced lines into a recorded Sale, applying loyalty.

    Stock is *not* touched here — the caller has already moved it (a walk-in
    sale moves it now, a tab moved it when it was opened), and `deductions` is
    what was moved, carried onto the sale so a void can put it back.
    """
    subtotal = sum(line.price * line.qty for line in items)
    discount = 0
    points_redeemed = 0
    if customer is not None:
        points_redeemed = max(0, min(redeem_points, customer.points))
        discount = min(points_redeemed * NAIRA_PER_POINT_REDEEM, subtotal)
    total = subtotal - discount
    points_earned = total // NAIRA_PER_POINT_EARNED

    sale = pos_models.Sale(
        staff_id=staff.id,
        payment_method=payment_method,
        subtotal=subtotal,
        discount=discount,
        total=total,
        customer_id=customer.id if customer else None,
        points_redeemed=points_redeemed,
        points_earned=points_earned,
        ingredient_deductions=deductions,
    )
    sale.items = [
        pos_models.SaleItem(
            name=line.name, category=line.category, qty=line.qty, price=line.price, menu_item_id=line.menu_item_id
        )
        for line in items
    ]
    db.add(sale)

    if customer is not None:
        customer.points = customer.points - points_redeemed + points_earned
        customer.total_spent += total
        customer.visits += 1

    return sale


@router.post("", response_model=pos_schemas.SaleOut, status_code=201)
def charge(payload: pos_schemas.ChargeRequest, db: Session = Depends(get_db)):
    staff = db.get(pos_models.Staff, payload.staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")

    customer = None
    if payload.customer_id is not None:
        customer = db.get(pos_models.LoyaltyCustomer, payload.customer_id)
        if customer is None:
            raise HTTPException(status_code=404, detail="Customer not found")

    deductions = pos_stock.take_stock(db, payload.items)
    sale = build_sale(
        db, staff, customer, payload.items, payload.payment_method, payload.redeem_points, deductions
    )
    db.commit()
    db.refresh(sale)
    return sale


@router.post("/{sale_id}/void", response_model=pos_schemas.SaleOut)
def void_sale(sale_id: int, payload: pos_schemas.VoidRequest, db: Session = Depends(get_db)):
    sale = db.get(pos_models.Sale, sale_id)
    if sale is None:
        raise HTTPException(status_code=404, detail="Sale not found")
    if sale.voided:
        raise HTTPException(status_code=400, detail="Sale is already voided")
    staff = db.get(pos_models.Staff, payload.staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")

    sale.voided = True
    sale.voided_by_id = staff.id
    sale.voided_at = datetime.now(timezone.utc)

    pos_stock.return_stock(db, sale.items, sale.ingredient_deductions)

    if sale.customer_id is not None:
        customer = db.get(pos_models.LoyaltyCustomer, sale.customer_id)
        if customer:
            customer.points = customer.points - sale.points_earned + sale.points_redeemed
            customer.total_spent = max(0, customer.total_spent - sale.total)
            customer.visits = max(0, customer.visits - 1)

    db.commit()
    db.refresh(sale)
    return sale
