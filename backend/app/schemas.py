from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    start_time: datetime
    capacity: int | None
    rsvp_count: int


class RsvpCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    party_size: int = Field(default=1, ge=1, le=10)


class RsvpOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    name: str
    email: EmailStr
    party_size: int
    created_at: datetime


class ContactMessageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    message: str = Field(min_length=1, max_length=4000)


class ContactMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    message: str
    created_at: datetime


class BookingRequestCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    event_type: Literal["birthday", "corporate", "brunch", "private_dinner", "other"]
    space: Literal["indoor", "green_patio", "front_lawn"]
    guest_count: int = Field(ge=1, le=150)
    preferred_date: date
    notes: str | None = Field(default=None, max_length=2000)


class BookingRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    event_type: str
    space: str
    guest_count: int
    preferred_date: date
    notes: str | None
    created_at: datetime
