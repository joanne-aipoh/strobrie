from datetime import date, datetime
from datetime import date as _date  # alias for annotations on fields literally named "date"
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Till-side payment methods only — the shop's online checkout is Paystack
# card payment exclusively and doesn't use this list.
PaymentMethod = Literal["Cash", "Moniepoint", "Zenith Transfer"]


# --- Staff / auth -----------------------------------------------------------


Role = Literal["staff", "front_desk", "manager"]


class StaffCreate(BaseModel):
    # Used only for the first-manager setup, where the manager picks their own PIN.
    name: str = Field(min_length=1, max_length=120)
    pin: str = Field(pattern=r"^\d{4,6}$")
    role: Role = "manager"


class StaffAdd(BaseModel):
    # A manager adds a teammate: no PIN here — the server issues a temporary one
    # that the new hire must change on first login.
    name: str = Field(min_length=1, max_length=120)
    role: Role = "staff"


class StaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role: str
    must_change_pin: bool = False


class StaffCreatedOut(StaffOut):
    # Returned once when a staff member is created or their PIN is reset, so the
    # manager can read out the temporary PIN. Never stored or shown again.
    temp_pin: str


class RoleUpdate(BaseModel):
    # A manager promotes/demotes a teammate (staff ↔ front desk ↔ manager).
    role: Role


class ChangePinRequest(BaseModel):
    staff_id: int
    current_pin: str
    new_pin: str = Field(pattern=r"^\d{4,6}$")


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


# --- Tabs (unpaid dine-in orders) ---------------------------------------


class TabItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    menu_item_id: int | None
    name: str
    category: str
    qty: int
    price: int


class TabOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    status: str
    opened_at: datetime
    updated_at: datetime | None
    closed_at: datetime | None
    opened_by_staff_id: int
    customer_id: int | None
    # Nested so reopening a tab at the till puts the loyalty customer straight
    # back on the order without a second lookup.
    customer: CustomerOut | None
    sale_id: int | None
    items: list[TabItemOut]


class TabCreate(BaseModel):
    staff_id: int
    label: str = Field(min_length=1, max_length=80)
    items: list[CartLine] = Field(min_length=1)
    customer_id: int | None = None


class TabUpdate(BaseModel):
    """Re-saves the whole tab — the items sent replace what was on it."""

    label: str = Field(min_length=1, max_length=80)
    items: list[CartLine] = Field(min_length=1)
    customer_id: int | None = None


class TabSettle(BaseModel):
    """Pay off a tab. Items are sent again so a last round added at the table
    is included in the same payment."""

    staff_id: int
    payment_method: PaymentMethod
    items: list[CartLine] = Field(min_length=1)
    customer_id: int | None = None
    redeem_points: int = 0


class TabCancel(BaseModel):
    staff_id: int


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
    online_purchasable: bool = True


class TierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price: int
    qty: int
    sold: int
    remaining: int | None
    online_purchasable: bool


class PosEventCreate(BaseModel):
    staff_id: int
    name: str = Field(min_length=1, max_length=150)
    date: date
    time: str | None = None
    capacity: int | None = None
    description: str | None = None
    cost_budget: int = 0
    # New events start as drafts (hidden from the website) unless the creator
    # opts to publish straight away.
    published: bool = False
    tiers: list[TierCreate] = Field(min_length=1)


class PosEventOut(BaseModel):
    id: int
    name: str
    date: date
    time: str | None
    capacity: int | None
    description: str | None
    cost_budget: int
    published: bool
    tiers: list[TierOut]
    tickets_sold: int


class PosEventUpdate(BaseModel):
    # All optional — a caller sends just the fields it wants to change.
    name: str | None = Field(default=None, min_length=1, max_length=150)
    date: _date | None = None
    time: str | None = None
    capacity: int | None = None
    description: str | None = None
    cost_budget: int | None = None
    published: bool | None = None


class TierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    price: int | None = Field(default=None, ge=0)
    qty: int | None = Field(default=None, ge=0)
    online_purchasable: bool | None = None


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


# --- Public event/ticket purchase (customer-facing, Paystack) --------------


class PublicTierOut(BaseModel):
    id: int
    name: str
    price: int
    remaining: int | None


class PublicEventOut(BaseModel):
    id: int
    name: str
    date: date
    time: str | None
    description: str | None
    spots_remaining: int | None
    tiers: list[PublicTierOut]


class EventBuyRequest(BaseModel):
    tier_id: int
    quantity: int = Field(default=1, ge=1, le=20)
    buyer_name: str = Field(min_length=1, max_length=120)
    buyer_email: str = Field(min_length=3, max_length=255)
    buyer_contact: str = Field(min_length=1, max_length=120)
    callback_url: str | None = None


class EventCheckoutResponse(BaseModel):
    ticket_id: int
    authorization_url: str
    reference: str


class PublicTicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pos_event_id: int
    buyer_name: str
    buyer_email: str | None
    channel: str
    paid: bool
    purchase_timestamp: datetime
    event_name: str
    event_date: date
    event_time: str | None
    event_description: str | None
    tier_name: str
    tier_price: int
    quantity: int = 1
