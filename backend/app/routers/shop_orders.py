import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import paystack, shop_models, shop_schemas
from ..database import get_db

router = APIRouter(prefix="/api/shop", tags=["shop-orders"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def _build_order(payload: shop_schemas.OrderCreate, db: Session) -> shop_models.Order:
    if payload.fulfillment_method == "delivery" and not (payload.delivery_address or "").strip():
        raise HTTPException(status_code=400, detail="Delivery address is required for delivery orders")

    product_ids = [line.product_id for line in payload.items]
    products = {p.id: p for p in db.query(shop_models.Product).filter(shop_models.Product.id.in_(product_ids))}

    order_items = []
    subtotal = 0
    for line in payload.items:
        product = products.get(line.product_id)
        if product is None or not product.is_active:
            raise HTTPException(status_code=400, detail=f"Product {line.product_id} is not available")
        if product.stock_qty is not None and line.qty > product.stock_qty:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product.name}")
        subtotal += product.price * line.qty
        order_items.append(shop_models.OrderItem(product_id=product.id, name=product.name, price=product.price, qty=line.qty))

    order = shop_models.Order(
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        fulfillment_method=payload.fulfillment_method,
        delivery_address=payload.delivery_address,
        subtotal=subtotal,
        total=subtotal,
    )
    order.items = order_items
    return order


@router.post("/checkout", response_model=shop_schemas.CheckoutResponse, status_code=201)
def checkout(payload: shop_schemas.OrderCreate, db: Session = Depends(get_db)):
    order = _build_order(payload, db)
    db.add(order)
    db.flush()  # assigns order.id without committing yet

    reference = f"strobrie-{order.id}-{uuid.uuid4().hex[:8]}"
    callback_url = payload.callback_url or f"{FRONTEND_URL}/order-confirmation"
    try:
        data = paystack.initialize_transaction(
            email=order.customer_email,
            amount_naira=order.total,
            reference=reference,
            callback_url=callback_url,
        )
    except paystack.PaystackNotConfigured as e:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(e))
    except paystack.PaystackError as e:
        db.rollback()
        raise HTTPException(status_code=502, detail=str(e))

    order.payment_reference = reference
    db.commit()
    return shop_schemas.CheckoutResponse(order_id=order.id, authorization_url=data["authorization_url"], reference=reference)


@router.get("/orders/verify/{reference}", response_model=shop_schemas.OrderOut)
def verify_payment(reference: str, db: Session = Depends(get_db)):
    order = db.query(shop_models.Order).filter(shop_models.Order.payment_reference == reference).first()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.payment_status != "paid":
        try:
            data = paystack.verify_transaction(reference)
        except paystack.PaystackError as e:
            raise HTTPException(status_code=502, detail=str(e))

        if data.get("status") == "success":
            order.payment_status = "paid"
            order.status = "paid"
            for item in order.items:
                if item.product_id is not None:
                    product = db.get(shop_models.Product, item.product_id)
                    if product and product.stock_qty is not None:
                        product.stock_qty = max(0, product.stock_qty - item.qty)
        else:
            order.payment_status = "failed"
        db.commit()
        db.refresh(order)

    return order


@router.get("/admin/orders", response_model=list[shop_schemas.OrderOut])
def list_orders(db: Session = Depends(get_db)):
    stmt = select(shop_models.Order).options(selectinload(shop_models.Order.items)).order_by(shop_models.Order.created_at.desc())
    return db.scalars(stmt).all()


@router.put("/admin/orders/{order_id}/status", response_model=shop_schemas.OrderOut)
def update_order_status(order_id: int, payload: shop_schemas.OrderStatusUpdate, db: Session = Depends(get_db)):
    order = db.get(shop_models.Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = payload.status
    db.commit()
    db.refresh(order)
    return order
