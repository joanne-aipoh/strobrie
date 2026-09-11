from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import pos_models, pos_schemas, shop_models
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

    menu_item_ids = [line.menu_item_id for line in payload.items if line.menu_item_id is not None]
    products_by_id: dict[int, shop_models.Product] = {}
    if menu_item_ids:
        stmt = select(shop_models.Product).where(shop_models.Product.id.in_(menu_item_ids))
        products_by_id = {p.id: p for p in db.scalars(stmt)}

    # Fail fast, before any mutation, if a tracked item doesn't have enough stock,
    # or it's been marked unavailable today (e.g. out of an ingredient it needs).
    for line in payload.items:
        product = products_by_id.get(line.menu_item_id)
        if product and product.unavailable:
            raise HTTPException(status_code=400, detail=f"{product.name} isn't available today")
        if product and product.stock_qty is not None and line.qty > product.stock_qty:
            raise HTTPException(status_code=400, detail=f"Not enough {product.name} in stock ({product.stock_qty} left)")

    subtotal = sum(line.price * line.qty for line in payload.items)
    discount = 0
    points_redeemed = 0
    if customer is not None:
        points_redeemed = max(0, min(payload.redeem_points, customer.points))
        discount = min(points_redeemed * NAIRA_PER_POINT_REDEEM, subtotal)
    total = subtotal - discount
    points_earned = total // NAIRA_PER_POINT_EARNED

    # Deduct ingredients per recipe, remembering exactly what was deducted so a void can restore it.
    menu_item_ids = [line.menu_item_id for line in payload.items if line.menu_item_id is not None]
    recipes_by_item: dict[int, list[pos_models.Recipe]] = {}
    if menu_item_ids:
        stmt = select(pos_models.Recipe).where(pos_models.Recipe.menu_item_id.in_(menu_item_ids))
        for recipe in db.scalars(stmt):
            recipes_by_item.setdefault(recipe.menu_item_id, []).append(recipe)

    deductions: dict[str, float] = {}
    for line in payload.items:
        for recipe in recipes_by_item.get(line.menu_item_id, []):
            amount = recipe.qty_per_item * line.qty
            key = str(recipe.ingredient_id)
            deductions[key] = deductions.get(key, 0) + amount
            ingredient = db.get(pos_models.InventoryItem, recipe.ingredient_id)
            if ingredient:
                ingredient.quantity -= amount

    # Deduct from tracked product stock (an unlimited/made-to-order item has
    # no stock_qty set and is unaffected — already validated as sufficient above).
    for line in payload.items:
        product = products_by_id.get(line.menu_item_id)
        if product and product.stock_qty is not None:
            product.stock_qty -= line.qty

    sale = pos_models.Sale(
        staff_id=staff.id,
        payment_method=payload.payment_method,
        subtotal=subtotal,
        discount=discount,
        total=total,
        customer_id=customer.id if customer else None,
        points_redeemed=points_redeemed,
        points_earned=points_earned,
        ingredient_deductions=deductions,
    )
    sale.items = [
        pos_models.SaleItem(name=line.name, category=line.category, qty=line.qty, price=line.price, menu_item_id=line.menu_item_id)
        for line in payload.items
    ]
    db.add(sale)

    if customer is not None:
        customer.points = customer.points - points_redeemed + points_earned
        customer.total_spent += total
        customer.visits += 1

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

    for ingredient_id, amount in (sale.ingredient_deductions or {}).items():
        ingredient = db.get(pos_models.InventoryItem, int(ingredient_id))
        if ingredient:
            ingredient.quantity += amount

    for sale_item in sale.items:
        if sale_item.menu_item_id is not None:
            product = db.get(shop_models.Product, sale_item.menu_item_id)
            if product and product.stock_qty is not None:
                product.stock_qty += sale_item.qty

    if sale.customer_id is not None:
        customer = db.get(pos_models.LoyaltyCustomer, sale.customer_id)
        if customer:
            customer.points = customer.points - sale.points_earned + sale.points_redeemed
            customer.total_spent = max(0, customer.total_spent - sale.total)
            customer.visits = max(0, customer.visits - 1)

    db.commit()
    db.refresh(sale)
    return sale
