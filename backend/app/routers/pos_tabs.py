from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import pos_models, pos_schemas, pos_stock
from ..database import get_db
from .pos_sales import build_sale

router = APIRouter(prefix="/api/pos/tabs", tags=["pos-tabs"])


def _get_open_tab(db: Session, tab_id: int) -> pos_models.Tab:
    tab = db.get(pos_models.Tab, tab_id)
    if tab is None:
        raise HTTPException(status_code=404, detail="Tab not found")
    if tab.status != "open":
        raise HTTPException(status_code=400, detail=f"This tab is already {tab.status}")
    return tab


def _get_staff(db: Session, staff_id: int) -> pos_models.Staff:
    staff = db.get(pos_models.Staff, staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff


def _get_customer(db: Session, customer_id: int | None) -> pos_models.LoyaltyCustomer | None:
    if customer_id is None:
        return None
    customer = db.get(pos_models.LoyaltyCustomer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


def _replace_items(db: Session, tab: pos_models.Tab, items) -> None:
    """Swap a tab's contents for `items`, keeping stock straight.

    Everything the tab was holding goes back on the shelf first, then the new
    contents are taken fresh. Doing it that way means a table that sends an
    item back, or swaps one for another, settles up with the right stock — and
    it's the same code path however the tab changed.
    """
    pos_stock.return_stock(db, tab.items, tab.ingredient_deductions)
    db.flush()
    tab.ingredient_deductions = pos_stock.take_stock(db, items)
    tab.items = [
        pos_models.TabItem(
            name=line.name, category=line.category, qty=line.qty, price=line.price, menu_item_id=line.menu_item_id
        )
        for line in items
    ]


@router.get("", response_model=list[pos_schemas.TabOut])
def list_tabs(include_closed: bool = False, db: Session = Depends(get_db)):
    """Open tabs, oldest first — the table waiting longest is the one to chase."""
    stmt = select(pos_models.Tab).options(
        selectinload(pos_models.Tab.items), selectinload(pos_models.Tab.customer)
    )
    if not include_closed:
        stmt = stmt.where(pos_models.Tab.status == "open")
    stmt = stmt.order_by(pos_models.Tab.opened_at)
    return db.scalars(stmt).all()


@router.post("", response_model=pos_schemas.TabOut, status_code=201)
def open_tab(payload: pos_schemas.TabCreate, db: Session = Depends(get_db)):
    staff = _get_staff(db, payload.staff_id)
    customer = _get_customer(db, payload.customer_id)

    tab = pos_models.Tab(
        label=payload.label.strip(),
        opened_by_staff_id=staff.id,
        customer_id=customer.id if customer else None,
        ingredient_deductions=pos_stock.take_stock(db, payload.items),
    )
    tab.items = [
        pos_models.TabItem(
            name=line.name, category=line.category, qty=line.qty, price=line.price, menu_item_id=line.menu_item_id
        )
        for line in payload.items
    ]
    db.add(tab)
    db.commit()
    db.refresh(tab)
    return tab


@router.put("/{tab_id}", response_model=pos_schemas.TabOut)
def update_tab(tab_id: int, payload: pos_schemas.TabUpdate, db: Session = Depends(get_db)):
    """Another round at the same table."""
    tab = _get_open_tab(db, tab_id)
    customer = _get_customer(db, payload.customer_id)

    _replace_items(db, tab, payload.items)
    tab.label = payload.label.strip()
    tab.customer_id = customer.id if customer else None
    tab.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(tab)
    return tab


@router.post("/{tab_id}/settle", response_model=pos_schemas.SaleOut, status_code=201)
def settle_tab(tab_id: int, payload: pos_schemas.TabSettle, db: Session = Depends(get_db)):
    """They're leaving — take the money and record the sale.

    The stock this tab was holding simply transfers to the sale, so paying up
    never moves stock a second time.
    """
    tab = _get_open_tab(db, tab_id)
    staff = _get_staff(db, payload.staff_id)
    customer = _get_customer(db, payload.customer_id)

    _replace_items(db, tab, payload.items)

    sale = build_sale(
        db,
        staff,
        customer,
        payload.items,
        payload.payment_method,
        payload.redeem_points,
        tab.ingredient_deductions,
    )
    db.flush()

    tab.status = "paid"
    tab.closed_at = datetime.now(timezone.utc)
    tab.sale_id = sale.id
    tab.customer_id = customer.id if customer else None

    db.commit()
    db.refresh(sale)
    return sale


@router.post("/{tab_id}/cancel", response_model=pos_schemas.TabOut)
def cancel_tab(tab_id: int, payload: pos_schemas.TabCancel, db: Session = Depends(get_db)):
    """Close a tab without taking money — a walkout, or one opened by mistake.

    Whatever it was holding goes back on the shelf. If the food really was
    served, log it under Waste rather than cancelling, so the stock stays gone.
    """
    tab = _get_open_tab(db, tab_id)
    _get_staff(db, payload.staff_id)

    pos_stock.return_stock(db, tab.items, tab.ingredient_deductions)
    tab.status = "cancelled"
    tab.closed_at = datetime.now(timezone.utc)
    tab.ingredient_deductions = {}

    db.commit()
    db.refresh(tab)
    return tab
