from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --- public availability ---------------------------------------------------
class SlotOut(BaseModel):
    time: str  # "10:00"
    label: str  # "10:00 AM"
    public_remaining: int
    public_available: bool
    private_available: bool


class DayOut(BaseModel):
    date: date
    label: str  # "Tue 10 Nov"
    slots: list[SlotOut]


# --- booking ---------------------------------------------------------------
class BookRequest(BaseModel):
    date: date
    time_slot: str
    session_type: Literal["public", "private"]
    seats: int = Field(default=1, ge=1, le=6)
    customer_name: str = Field(min_length=1, max_length=120)
    customer_email: EmailStr
    customer_phone: str = Field(min_length=3, max_length=30)
    glaze: bool = False
    callback_url: str | None = None


class CheckoutResponse(BaseModel):
    reference: str
    authorization_url: str


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    time_slot: str
    session_type: str
    seats: int
    customer_name: str
    customer_email: str
    customer_phone: str
    amount: int
    glaze: bool = False
    paid: bool
    created_at: datetime


# --- private "different time" request --------------------------------------
class PrivateRequestCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    customer_email: EmailStr
    customer_phone: str = Field(min_length=3, max_length=30)
    preferred: str = Field(min_length=1, max_length=200)
    message: str | None = Field(default=None, max_length=1000)


class RequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_name: str
    customer_email: str
    customer_phone: str
    preferred: str
    message: str | None
    status: str
    created_at: datetime


# --- admin -----------------------------------------------------------------
class BlockRequest(BaseModel):
    date: date
    time_slot: str
    blocked: bool  # true = disable the slot, false = re-enable
    reason: str | None = Field(default=None, max_length=200)


class RescheduleRequest(BaseModel):
    """Staff move a paid booking to a different date/slot."""

    date: date
    time_slot: str


class WalkinBookingCreate(BaseModel):
    """Staff record a pottery session paid in person at the café."""

    date: date
    time_slot: str
    session_type: Literal["public", "private"]
    seats: int = Field(default=1, ge=1, le=6)
    customer_name: str = Field(min_length=1, max_length=120)
    customer_phone: str = Field(default="", max_length=30)
    amount: int = Field(ge=0)
    glaze: bool = False


class AdminSlotOut(BaseModel):
    date: date
    label: str
    time: str
    time_label: str
    blocked: bool
    public_seats: int  # seats booked (public)
    private_booked: bool
    bookings: list[BookingOut]
