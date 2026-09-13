import json
import os
import re
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import delivery_fees, email_utils, paystack, pos_models, shop_models, shop_schemas
from ..database import get_db
from .pos_sales import NAIRA_PER_POINT_EARNED, NAIRA_PER_POINT_REDEEM

router = APIRouter(prefix="/api/shop", tags=["shop-orders"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Riders/staff stop doing deliveries at 5pm Lagos time — enforced here
# (never trust the client) rather than at the server's own local time, which
# may run in a different timezone. Mirrors DELIVERY_CUTOFF_HOUR in
# frontend/src/shop/pages/Checkout.jsx.
LAGOS_TZ = ZoneInfo("Africa/Lagos")
DELIVERY_CUTOFF_HOUR = 17

# How many inscription characters reasonably fit iced onto a cake of a given
# size — mirrors frontend/src/shop/inscriptionLimit.js. Keep the two in sync.
INSCRIPTION_LIMIT_BY_SIZE = {'4"': 20, '6"': 30, '8"': 40, '10"': 50, '12"': 60, '14"': 70}
DEFAULT_INSCRIPTION_LIMIT = 40
SIZE_IN_NAME_RE = re.compile(r'\((\d+)"')

# Whole cakes and cheesecakes are made to order and need a day's notice —
# no same-day or ASAP orders online for these; a customer needing one sooner
# calls/WhatsApps instead. Mirrors CAKE_CATEGORIES in
# frontend/src/shop/cakeCategories.js.
CAKE_CATEGORIES = {"Cakes", "Cheesecakes"}


def inscription_limit_for_product(product: "shop_models.Product") -> int:
    if product.category not in CAKE_CATEGORIES:
        return 200
    m = SIZE_IN_NAME_RE.search(product.name)
    if not m:
        return DEFAULT_INSCRIPTION_LIMIT
    return INSCRIPTION_LIMIT_BY_SIZE.get(f'{m.group(1)}"', DEFAULT_INSCRIPTION_LIMIT)


@router.get("/loyalty/points", response_model=shop_schemas.LoyaltyPointsOut)
def loyalty_points(phone: str, db: Session = Depends(get_db)):
    customer = db.query(pos_models.LoyaltyCustomer).filter(pos_models.LoyaltyCustomer.phone == phone.strip()).first()
    if customer is None:
        raise HTTPException(status_code=404, detail="No loyalty account with that phone number")
    return shop_schemas.LoyaltyPointsOut(points=customer.points, naira_per_point=NAIRA_PER_POINT_REDEEM)


# --- Build-your-box (e.g. cupcakes sold as individual flavors, boxed into a
# fixed-size, fixed-price container the customer fills themselves) ---------

BOX_OF_RE = re.compile(r'\(Box of (\d+)\)$')


def box_quantity_for_product(product: "shop_models.Product") -> int | None:
    """How many individual items a box-sized product represents, or None if
    this product isn't a flavor-splittable box (e.g. it's a regular item, or
    already a specific flavor)."""
    if product.name.endswith("(Single)"):
        return 1
    m = BOX_OF_RE.search(product.name)
    return int(m.group(1)) if m else None


def _box_base_name(product: "shop_models.Product") -> str:
    return re.sub(r"\s*\([^)]*\)\s*$", "", product.name).strip()


def _resolve_flavor_trackers(
    db: Session, product: "shop_models.Product", labels
) -> dict[str, "shop_models.Product"]:
    """Flavor label -> its hidden stock-tracker product, for this box item's
    family (e.g. Cupcake's Vanilla/Chocolate/... trackers)."""
    base = _box_base_name(product)
    names = [f"{base} – {label}" for label in labels]
    trackers = db.query(shop_models.Product).filter(
        shop_models.Product.category == product.category, shop_models.Product.name.in_(names)
    )
    return {t.name.split(" – ", 1)[1]: t for t in trackers}


@router.get("/products/{product_id}/box-flavors", response_model=shop_schemas.BoxFlavorsOut)
def box_flavors(product_id: int, db: Session = Depends(get_db)):
    product = db.get(shop_models.Product, product_id)
    if product is None or not product.is_active:
        raise HTTPException(status_code=404, detail="Product not found")
    box_qty = box_quantity_for_product(product)
    if box_qty is None:
        raise HTTPException(status_code=400, detail="This item isn't sold as a build-your-own box")

    base = _box_base_name(product)
    trackers = (
        db.query(shop_models.Product)
        .filter(shop_models.Product.category == product.category, shop_models.Product.name.like(f"{base} – %"))
        .order_by(shop_models.Product.sort_order)
        .all()
    )
    return shop_schemas.BoxFlavorsOut(
        box_size=box_qty,
        flavors=[
            shop_schemas.BoxFlavorOption(
                product_id=t.id,
                flavor=t.name.split(" – ", 1)[1],
                remaining=t.stock_qty,
            )
            for t in trackers
        ],
    )


def _build_order(payload: shop_schemas.OrderCreate, db: Session) -> shop_models.Order:
    if payload.fulfillment_method == "delivery" and not (payload.delivery_address or "").strip():
        raise HTTPException(status_code=400, detail="Delivery address is required for delivery orders")
    if payload.fulfillment_method == "delivery" and not (payload.delivery_area or "").strip():
        raise HTTPException(status_code=400, detail="Please select which part of Abuja you're in")
    if payload.fulfillment_method == "delivery" and not payload.delivery_method:
        raise HTTPException(status_code=400, detail="Please choose bike or car delivery")

    requested_at = payload.requested_at
    if requested_at is not None:
        now = datetime.now(requested_at.tzinfo or timezone.utc)
        if requested_at < now:
            raise HTTPException(status_code=400, detail="Requested date/time can't be in the past")

    if payload.fulfillment_method == "delivery":
        # ASAP (requested_at is None) is checked against right now; a
        # scheduled delivery is checked against its own requested time —
        # riders don't run past 5pm on any day.
        check_at = requested_at.astimezone(LAGOS_TZ) if requested_at is not None else datetime.now(LAGOS_TZ)
        if check_at.hour >= DELIVERY_CUTOFF_HOUR:
            detail = (
                "Delivery can only be scheduled before 5pm."
                if requested_at is not None
                else "It's past 5pm — delivery orders are closed for today. Please schedule a time before 5pm, or choose pickup."
            )
            raise HTTPException(status_code=400, detail=detail)

    product_ids = [line.product_id for line in payload.items]
    products = {p.id: p for p in db.query(shop_models.Product).filter(shop_models.Product.id.in_(product_ids))}

    # Whole cakes/cheesecakes are made to order — need at least a day's
    # notice, so no ASAP and no same-day scheduling for them. Checked
    # against Lagos' calendar date, not the server's own timezone.
    if any(p.category in CAKE_CATEGORIES for p in products.values()):
        today_lagos = datetime.now(LAGOS_TZ).date()
        requested_date_lagos = requested_at.astimezone(LAGOS_TZ).date() if requested_at is not None else today_lagos
        if requested_date_lagos <= today_lagos:
            raise HTTPException(
                status_code=400,
                detail="Whole cakes and cheesecakes need at least a day's notice — please choose a date "
                "from tomorrow onward, or call/WhatsApp us for a same-day order.",
            )

    # A cake can appear as several lines (different inscriptions/design
    # notes) — check stock against the total requested across all of a
    # product's lines, not each line in isolation.
    qty_by_product = {}
    for line in payload.items:
        qty_by_product[line.product_id] = qty_by_product.get(line.product_id, 0) + line.qty

    # Same aggregation for build-your-box flavor picks, across every box
    # line in the order — two separate "Box of 8" lines both drawing on
    # Vanilla need to be checked against Vanilla's stock together. Resolved
    # to the actual tracker product id so different box sizes of the same
    # flavor share one stock check.
    flavor_qty_by_tracker_id = {}
    flavor_tracker_names = {}
    for line in payload.items:
        if not line.flavor_breakdown:
            continue
        product = products.get(line.product_id)
        if product is None:
            continue
        trackers = _resolve_flavor_trackers(db, product, line.flavor_breakdown.keys())
        for label, flavor_qty in line.flavor_breakdown.items():
            tracker = trackers.get(label)
            if tracker is None:
                raise HTTPException(status_code=400, detail=f"'{label}' isn't a valid flavor for {product.name}")
            flavor_qty_by_tracker_id[tracker.id] = flavor_qty_by_tracker_id.get(tracker.id, 0) + flavor_qty
            flavor_tracker_names[tracker.id] = tracker.name.split(" – ", 1)[1]

    if flavor_qty_by_tracker_id:
        flavor_trackers = {
            p.id: p
            for p in db.query(shop_models.Product).filter(shop_models.Product.id.in_(flavor_qty_by_tracker_id.keys()))
        }
        for tracker_id, flavor_qty in flavor_qty_by_tracker_id.items():
            tracker = flavor_trackers[tracker_id]
            if tracker.stock_qty is not None and flavor_qty > tracker.stock_qty:
                raise HTTPException(status_code=400, detail=f"Not enough {flavor_tracker_names[tracker_id]} left")

    order_items = []
    subtotal = 0
    for line in payload.items:
        product = products.get(line.product_id)
        if product is None or not product.is_active:
            raise HTTPException(status_code=400, detail=f"Product {line.product_id} is not available")
        if product.unavailable:
            raise HTTPException(status_code=400, detail=f"{product.name} isn't available today")
        if product.stock_qty is not None and qty_by_product[line.product_id] > product.stock_qty:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product.name}")

        flavor_breakdown_json = None
        if line.flavor_breakdown:
            box_qty = box_quantity_for_product(product)
            if box_qty is None:
                raise HTTPException(status_code=400, detail=f"{product.name} can't be split by flavor")
            expected = box_qty * line.qty
            actual = sum(line.flavor_breakdown.values())
            if actual != expected:
                raise HTTPException(
                    status_code=400,
                    detail=f"Flavor picks for {product.name} must add up to {expected} (got {actual})",
                )
            flavor_breakdown_json = json.dumps(line.flavor_breakdown)

        inscription = (line.inscription or "").strip() or None
        if inscription:
            limit = inscription_limit_for_product(product)
            if len(inscription) > limit:
                raise HTTPException(
                    status_code=400,
                    detail=f'Inscription for {product.name} is too long — {limit} characters max for that size.',
                )
        design_notes = (line.design_notes or "").strip() or None
        addons = (line.addons or "").strip() or None
        subtotal += product.price * line.qty
        order_items.append(
            shop_models.OrderItem(
                product_id=product.id,
                name=product.name,
                price=product.price,
                qty=line.qty,
                inscription=inscription,
                design_notes=design_notes,
                flavor_breakdown=flavor_breakdown_json,
                addons=addons,
            )
        )

    # Reserve stock now, at order creation — not later at payment
    # verification — so Flow (in-person sales) and the shop both see the
    # reduced count immediately and can't both sell the last one. Released
    # back in verify_payment if the payment doesn't succeed.
    for product_id, qty in qty_by_product.items():
        product = products[product_id]
        if product.stock_qty is not None:
            product.stock_qty -= qty
    for tracker_id, flavor_qty in flavor_qty_by_tracker_id.items():
        tracker = flavor_trackers[tracker_id]
        if tracker.stock_qty is not None:
            tracker.stock_qty -= flavor_qty

    loyalty_customer = None
    points_redeemed = 0
    if payload.loyalty_phone:
        loyalty_customer = (
            db.query(pos_models.LoyaltyCustomer)
            .filter(pos_models.LoyaltyCustomer.phone == payload.loyalty_phone.strip())
            .first()
        )
        if loyalty_customer is None:
            raise HTTPException(status_code=404, detail="No loyalty account with that phone number")
        if payload.redeem_points > 0:
            points_redeemed = max(0, min(payload.redeem_points, loyalty_customer.points))

    delivery_method = payload.delivery_method if payload.fulfillment_method == "delivery" else None
    delivery_area = payload.delivery_area if payload.fulfillment_method == "delivery" else None
    delivery_fee = 0
    if payload.fulfillment_method == "delivery":
        delivery_fee = delivery_fees.delivery_fee_for(delivery_method, delivery_area)
        if delivery_fee is None:
            raise HTTPException(
                status_code=400, detail="We only deliver to areas on our list — please pick one from the dropdown."
            )

    discount = min(points_redeemed * NAIRA_PER_POINT_REDEEM, subtotal)
    total = subtotal - discount + delivery_fee
    points_earned = (total // NAIRA_PER_POINT_EARNED) if loyalty_customer else 0

    order = shop_models.Order(
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        fulfillment_method=payload.fulfillment_method,
        delivery_address=payload.delivery_address,
        delivery_area=delivery_area,
        delivery_method=delivery_method,
        delivery_fee=delivery_fee,
        gift_note=(payload.gift_note or "").strip() or None if payload.fulfillment_method == "delivery" else None,
        customer_notes=(payload.customer_notes or "").strip() or None,
        requested_at=requested_at,
        loyalty_customer_id=loyalty_customer.id if loyalty_customer else None,
        points_redeemed=points_redeemed,
        points_earned=points_earned,
        subtotal=subtotal,
        total=total,
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

    if order.payment_status == "unpaid":
        try:
            data = paystack.verify_transaction(reference)
        except paystack.PaystackError as e:
            raise HTTPException(status_code=502, detail=str(e))

        if data.get("status") == "success":
            # Stock for these items was already reserved when the order was
            # created (see _build_order) — nothing to deduct here.
            order.payment_status = "paid"
            order.status = "paid"
            if order.loyalty_customer_id is not None:
                customer = db.get(pos_models.LoyaltyCustomer, order.loyalty_customer_id)
                if customer:
                    # Re-cap against the customer's current balance in case it
                    # moved (e.g. spent in Flow) between checkout and payment.
                    order.points_redeemed = max(0, min(order.points_redeemed, customer.points))
                    customer.points = customer.points - order.points_redeemed + order.points_earned
                    customer.total_spent += order.total
            just_paid = True
        else:
            # Payment didn't go through — release the stock reserved at
            # creation back, so it's available to sell again.
            order.payment_status = "failed"
            for item in order.items:
                if item.product_id is not None:
                    product = db.get(shop_models.Product, item.product_id)
                    if product and product.stock_qty is not None:
                        product.stock_qty += item.qty
                    if product and item.flavor_breakdown:
                        breakdown = json.loads(item.flavor_breakdown)
                        trackers = _resolve_flavor_trackers(db, product, breakdown.keys())
                        for label, flavor_qty in breakdown.items():
                            tracker = trackers.get(label)
                            if tracker and tracker.stock_qty is not None:
                                tracker.stock_qty += flavor_qty
            just_paid = False
        db.commit()
        db.refresh(order)

        if just_paid:
            email_utils.send_order_confirmation_email(order)

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
