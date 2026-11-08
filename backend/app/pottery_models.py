from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .database import Base


class PotteryBooking(Base):
    __tablename__ = "pottery_bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date)
    time_slot: Mapped[str] = mapped_column(String(5))  # "10:00" | "12:00" | "14:00"
    session_type: Mapped[str] = mapped_column(String(10))  # "public" | "private"
    seats: Mapped[int] = mapped_column(Integer, default=1)  # public: people; private: always 1 slot
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_email: Mapped[str] = mapped_column(String(255))
    customer_phone: Mapped[str] = mapped_column(String(30))
    amount: Mapped[int] = mapped_column(Integer)
    paid: Mapped[bool] = mapped_column(Boolean, default=False)
    payment_reference: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PotteryBlock(Base):
    """A slot staff have taken off the booker (e.g. the space has an event)."""

    __tablename__ = "pottery_blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date)
    time_slot: Mapped[str] = mapped_column(String(5))
    reason: Mapped[str | None] = mapped_column(String(200), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PotteryRequest(Base):
    """A 'need a different time?' private-session request for staff to follow up."""

    __tablename__ = "pottery_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_email: Mapped[str] = mapped_column(String(255))
    customer_phone: Mapped[str] = mapped_column(String(30))
    preferred: Mapped[str] = mapped_column(String(200))  # free-text desired date/time
    message: Mapped[str | None] = mapped_column(Text, default=None)
    status: Mapped[str] = mapped_column(String(20), default="new")  # new | handled
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
