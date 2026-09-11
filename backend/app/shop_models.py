from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .database import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str | None] = mapped_column(String(30), unique=True, default=None)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    category: Mapped[str] = mapped_column(String(50))
    price: Mapped[int] = mapped_column(Integer)
    stock_qty: Mapped[int | None] = mapped_column(Integer, default=None)  # null = unlimited
    # A quick day-to-day "86" toggle for a made-to-order item that can't be
    # made right now (e.g. out of chicken today) — separate from stock_qty,
    # which tracks a countable batch. Blocks ordering in Flow and the shop
    # without touching any stock number, so it's a one-click on/off.
    unavailable: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    photos: Mapped[list["ProductPhoto"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductPhoto.sort_order"
    )


class ShopSettings(Base):
    """Singleton row (id always 1) for shop-wide toggles that don't belong to
    any one product — e.g. hiding a whole category from the shop (Brunch on
    a weekday, Coffee during a machine outage) without touching every
    product in it."""

    __tablename__ = "shop_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    # JSON list of category names currently hidden from the public shop —
    # e.g. '["Brunch"]'. Encoded as text since it's a small, rarely-queried
    # set; not worth a separate table.
    hidden_categories: Mapped[str] = mapped_column(Text, default="[]")


class ProductPhoto(Base):
    __tablename__ = "product_photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    url: Mapped[str] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped["Product"] = relationship(back_populates="photos")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_email: Mapped[str] = mapped_column(String(255))
    customer_phone: Mapped[str] = mapped_column(String(30))
    fulfillment_method: Mapped[str] = mapped_column(String(20))  # 'pickup' | 'delivery'
    delivery_address: Mapped[str | None] = mapped_column(Text, default=None)
    # Which part of Abuja the customer picked, for confirming the car/bike
    # delivery rate — self-selected from a fixed list, not free text.
    delivery_area: Mapped[str | None] = mapped_column(String(100), default=None)
    # 'bike' or 'car' — which Loyverse delivery price list delivery_fee was
    # looked up from. Null for pickup orders.
    delivery_method: Mapped[str | None] = mapped_column(String(10), default=None)
    # Recomputed server-side from (delivery_method, delivery_area) via
    # delivery_fees.delivery_fee_for — never trust a client-sent amount.
    # 0 for pickup, or an area outside the known list (rate confirmed
    # manually after the fact, same as before this feature existed).
    delivery_fee: Mapped[int] = mapped_column(Integer, default=0)
    # A note card to include with a delivery, for orders placed on someone
    # else's behalf ("Happy anniversary! — love, Tobi"). Delivery only.
    gift_note: Mapped[str | None] = mapped_column(Text, default=None)
    # Loyalty: points spent as a discount and points earned on this order —
    # same mechanics as an in-person Flow sale, just tied to an online order.
    loyalty_customer_id: Mapped[int | None] = mapped_column(ForeignKey("loyalty_customers.id"), default=None)
    points_redeemed: Mapped[int] = mapped_column(Integer, default=0)
    points_earned: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|paid|fulfilled|cancelled
    # When the customer wants to pick up/receive the order. Null means no
    # preference — as soon as possible (same-day, ready as normal).
    requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    subtotal: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    payment_reference: Mapped[str | None] = mapped_column(String(100), default=None)
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid")  # unpaid|paid|failed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), default=None)
    name: Mapped[str] = mapped_column(String(150))
    price: Mapped[int] = mapped_column(Integer)
    qty: Mapped[int] = mapped_column(Integer)
    # Free-text cake inscription ("Happy Birthday Sarah"), for cake/cheesecake
    # line items only — null for everything else.
    inscription: Mapped[str | None] = mapped_column(String(200), default=None)
    # Optional design description for a simple cake design (e.g. "pink
    # flowers on top"). Complex/customized designs are handled off-platform
    # via direct contact, not through this field.
    design_notes: Mapped[str | None] = mapped_column(Text, default=None)
    # For a "build your box" item (e.g. a box of cupcakes split across
    # flavors): JSON text mapping flavor label -> qty, e.g. '{"Vanilla": 3,
    # "Chocolate": 4, "Carrot": 1}'. Null for ordinary single-flavor items.
    flavor_breakdown: Mapped[str | None] = mapped_column(Text, default=None)
    # Free-text add-on request for cake/cheesecake line items (e.g. "extra
    # chocolate flavor layer") — pricing for these varies by size and isn't
    # itemized online, so staff confirm the extra cost directly with the
    # customer before making the cake. Null for everything else.
    addons: Mapped[str | None] = mapped_column(Text, default=None)

    order: Mapped["Order"] = relationship(back_populates="items")
