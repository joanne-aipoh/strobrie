from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .database import Base


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    pin_hash: Mapped[str] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(20), default="staff")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LoyaltyCustomer(Base):
    __tablename__ = "loyalty_customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(30), unique=True)
    points: Mapped[int] = mapped_column(Integer, default=0)
    total_spent: Mapped[int] = mapped_column(Integer, default=0)
    visits: Mapped[int] = mapped_column(Integer, default=0)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    unit: Mapped[str] = mapped_column(String(10))
    quantity: Mapped[float] = mapped_column(Float, default=0)

    recipes: Mapped[list["Recipe"]] = relationship(back_populates="ingredient")


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(primary_key=True)
    menu_item_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"))
    qty_per_item: Mapped[float] = mapped_column(Float)

    ingredient: Mapped["InventoryItem"] = relationship(back_populates="recipes")


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"))
    payment_method: Mapped[str] = mapped_column(String(20))
    subtotal: Mapped[int] = mapped_column(Integer)
    discount: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("loyalty_customers.id"), default=None)
    points_redeemed: Mapped[int] = mapped_column(Integer, default=0)
    points_earned: Mapped[int] = mapped_column(Integer, default=0)
    ingredient_deductions: Mapped[dict] = mapped_column(JSON, default=dict)
    voided: Mapped[bool] = mapped_column(Boolean, default=False)
    voided_by_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), default=None)
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    staff: Mapped["Staff"] = relationship(foreign_keys=[staff_id])
    customer: Mapped["LoyaltyCustomer | None"] = relationship()
    items: Mapped[list["SaleItem"]] = relationship(back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"))
    menu_item_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), default=None)
    name: Mapped[str] = mapped_column(String(150))
    category: Mapped[str] = mapped_column(String(30))
    qty: Mapped[int] = mapped_column(Integer)
    price: Mapped[int] = mapped_column(Integer)

    sale: Mapped["Sale"] = relationship(back_populates="items")


class WasteEntry(Base):
    __tablename__ = "waste_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    item_name: Mapped[str] = mapped_column(String(150))
    qty: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(10))
    unit_cost: Mapped[int] = mapped_column(Integer, default=0)
    cost_impact: Mapped[int] = mapped_column(Integer, default=0)
    reason: Mapped[str] = mapped_column(String(50))
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"))
    notes: Mapped[str | None] = mapped_column(Text, default=None)

    staff: Mapped["Staff"] = relationship()


class PosEvent(Base):
    __tablename__ = "pos_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    date: Mapped[date] = mapped_column(Date)
    time: Mapped[str | None] = mapped_column(String(5), default=None)
    capacity: Mapped[int | None] = mapped_column(Integer, default=None)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    cost_budget: Mapped[int] = mapped_column(Integer, default=0)
    created_by_staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"))

    tiers: Mapped[list["TicketTier"]] = relationship(back_populates="event", cascade="all, delete-orphan")


class TicketTier(Base):
    __tablename__ = "ticket_tiers"

    id: Mapped[int] = mapped_column(primary_key=True)
    pos_event_id: Mapped[int] = mapped_column(ForeignKey("pos_events.id"))
    name: Mapped[str] = mapped_column(String(80))
    price: Mapped[int] = mapped_column(Integer, default=0)
    qty: Mapped[int] = mapped_column(Integer, default=0)  # 0 = unlimited

    event: Mapped["PosEvent"] = relationship(back_populates="tiers")


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(primary_key=True)
    pos_event_id: Mapped[int] = mapped_column(ForeignKey("pos_events.id"))
    tier_id: Mapped[int] = mapped_column(ForeignKey("ticket_tiers.id"))
    buyer_name: Mapped[str] = mapped_column(String(120))
    buyer_contact: Mapped[str | None] = mapped_column(String(120), default=None)
    # Only set for tickets bought online (needed to initialize a Paystack
    # transaction and send the confirmation email) — null for tickets sold
    # in person via Flow, where buyer_contact alone is enough.
    buyer_email: Mapped[str | None] = mapped_column(String(255), default=None)
    channel: Mapped[str] = mapped_column(String(20))  # 'paid-now' | 'reserved' | 'online'
    paid: Mapped[bool] = mapped_column(Boolean, default=False)
    payment_method: Mapped[str | None] = mapped_column(String(20), default=None)
    # Paystack transaction reference — only set for 'online' tickets, used to
    # verify payment the same way shop orders do.
    payment_reference: Mapped[str | None] = mapped_column(String(100), default=None)
    checked_in: Mapped[bool] = mapped_column(Boolean, default=False)
    purchase_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Null for online self-service purchases — only set when a staff member
    # sold/recorded the ticket in person via Flow.
    sold_by_staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"), default=None)

    tier: Mapped["TicketTier"] = relationship()
    event: Mapped["PosEvent"] = relationship()
