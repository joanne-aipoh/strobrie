from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Till-side payment methods only — the shop's online checkout is Paystack
# card payment exclusively and doesn't use this list.
PaymentMethod = Literal["Cash", "Moniepoint", "Zenith Transfer", "Palm Pay POS", "GTB Transfer"]


# --- Staff / auth -----------------------------------------------------------


class StaffCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    pin: str = Field(pattern=r"^\d{4,6}$")
    role: Literal["staff", "manager"] = "staff"


class StaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role: str


class LoginRequest(BaseModel):
    staff_id: int
    pin: str


# --- Loyalty customers --------------------------------------------------


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=1, max_length=30)


class CustomerUpdate(BaseModel):
    # For fixing a typo'd name or a mistyped phone number — both optional so
    # a caller can send just the one field that needs correcting.
    name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, min_length=1, max_length=30)


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str
    points: int
    total_spent: int
    visits: int
    joined_at: datetime


# --- Sales ------------------------------------------------------------------


class CartLine(BaseModel):
    menu_item_id: int | None = None
    name: str
    category: str = "Other"
    qty: int = Field(ge=1)
    price: int = Field(ge=0)


class ChargeRequest(BaseModel):
    staff_id: int
    payment_method: PaymentMethod
    items: list[CartLine] = Field(min_length=1)
    customer_id: int | None = None
    redeem_points: int = 0


class SaleItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    qty: int
    price: int


class VoidRequest(BaseModel):
    staff_id: int


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    staff_id: int
    payment_method: str
    subtotal: int
    discount: int
    total: int
    customer_id: int | None
    points_redeemed: int
    points_earned: int
    voided: bool
    items: list[SaleItemOut]


# --- Waste --------------------------------------------------------------


class WasteCreate(BaseModel):
    staff_id: int
    item_name: str = Field(min_length=1, max_length=150)
    qty: float = Field(gt=0)
    unit: str
    unit_cost: int = Field(ge=0)
    reason: str
    notes: str | None = None


class WasteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    item_name: str
    qty: float
    unit: str
    unit_cost: int
    cost_impact: int
    reason: str
    staff_id: int
    notes: str | None


# --- Inventory & recipes -------------------------------------------------


class InventoryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    unit: str
    quantity: float


class RestockRequest(BaseModel):
    qty: float = Field(gt=0)


class RecipeLine(BaseModel):
    ingredient_id: int
    qty_per_item: float = Field(gt=0)


class RecipeSetRequest(BaseModel):
    lines: list[RecipeLine]


class RecipeLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ingredient_id: int
    qty_per_item: float


# --- Ticketed events ------------------------------------------------------


class TierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    price: int = Field(ge=0)
    qty: int = Field(ge=0, default=0)


class TierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price: int
    qty: int
    sold: int
    remaining: int | None


class PosEventCreate(BaseModel):
    staff_id: int
    name: str = Field(min_length=1, max_length=150)
    date: date
    time: str | None = None
    capacity: int | None = None
    description: str | None = None
    cost_budget: int = 0
    tiers: list[TierCreate] = Field(min_length=1)


class PosEventOut(BaseModel):
    id: int
    name: str
    date: date
    time: str | None
    capacity: int | None
    description: str | None
    cost_budget: int
    tiers: list[TierOut]
    tickets_sold: int


class TicketSellRequest(BaseModel):
    staff_id: int
    tier_id: int
    buyer_name: str = Field(min_length=1, max_length=120)
    buyer_contact: str | None = None
    channel: Literal["paid", "reserved"]
    payment_method: PaymentMethod = "Cash"


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pos_event_id: int
    tier_id: int
    buyer_name: str
    buyer_contact: str | None
    channel: str
    paid: bool
    payment_method: str | None
    checked_in: bool
    purchase_timestamp: datetime


class CollectPaymentRequest(BaseModel):
    staff_id: int
    payment_method: PaymentMethod = "Cash"
