from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --- Products --------------------------------------------------------------


class ProductPhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    sort_order: int


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    category: str
    price: int
    stock_qty: int | None
    is_active: bool
    sort_order: int
    photos: list[ProductPhotoOut]


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    category: str = Field(min_length=1, max_length=50)
    price: int = Field(ge=0)
    stock_qty: int | None = Field(default=None, ge=0)


class ProductUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    category: str = Field(min_length=1, max_length=50)
    price: int = Field(ge=0)
    stock_qty: int | None = Field(default=None, ge=0)
    is_active: bool = True


class PhotoReorderRequest(BaseModel):
    photo_ids_in_order: list[int]


class RestockRequest(BaseModel):
    qty: int = Field(gt=0)


# --- Orders ------------------------------------------------------------


class CartLine(BaseModel):
    product_id: int
    qty: int = Field(ge=1)
    inscription: str | None = Field(default=None, max_length=200)
    design_notes: str | None = Field(default=None, max_length=500)
    # For a "build your box" item: flavor label -> qty (e.g. {"Vanilla": 3,
    # "Chocolate": 4, "Carrot": 1}), must sum to the box size.
    flavor_breakdown: dict[str, int] | None = Field(default=None)
    # Free-text add-on request (e.g. "extra chocolate flavor layer") —
    # cake/cheesecake only. Pricing varies by size and isn't itemized here;
    # staff confirm the extra cost with the customer before making the cake.
    addons: str | None = Field(default=None, max_length=300)


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    customer_email: EmailStr
    customer_phone: str = Field(min_length=1, max_length=30)
    fulfillment_method: Literal["pickup", "delivery"]
    delivery_address: str | None = None
    delivery_area: str | None = Field(default=None, max_length=100)
    # A note card to include with a delivery — for orders placed on behalf
    # of someone else. Delivery only; ignored for pickup.
    gift_note: str | None = Field(default=None, max_length=300)
    # When the customer wants the order ready — for a same-day order leave
    # this unset (ASAP); for a cake ordered days ahead, a future date/time.
    requested_at: datetime | None = None
    # Loyalty: the phone number to spend points from, and how many to spend
    # as a discount. Both optional — omit to check out without redeeming.
    loyalty_phone: str | None = None
    redeem_points: int = Field(default=0, ge=0)
    items: list[CartLine] = Field(min_length=1)
    # Where Paystack redirects the browser after payment. Computed client-side
    # from the shop's own current origin, so it's correct whether the shop is
    # reached at strobrie.com/shop or shop.strobrie.com. Falls back to
    # FRONTEND_URL + /order-confirmation on the backend if omitted.
    callback_url: str | None = None


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int | None
    name: str
    price: int
    qty: int
    inscription: str | None
    design_notes: str | None
    flavor_breakdown: str | None
    addons: str | None


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_name: str
    customer_email: EmailStr
    customer_phone: str
    fulfillment_method: str
    delivery_address: str | None
    delivery_area: str | None
    gift_note: str | None
    status: str
    requested_at: datetime | None
    points_redeemed: int
    points_earned: int
    subtotal: int
    total: int
    payment_status: str
    created_at: datetime
    items: list[OrderItemOut]


class LoyaltyPointsOut(BaseModel):
    points: int
    naira_per_point: int


class ShopSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    brunch_visible: bool


class ShopSettingsUpdate(BaseModel):
    brunch_visible: bool


class BoxFlavorOption(BaseModel):
    product_id: int
    flavor: str
    remaining: int | None  # null = unlimited


class BoxFlavorsOut(BaseModel):
    box_size: int
    flavors: list[BoxFlavorOption]


class OrderStatusUpdate(BaseModel):
    status: Literal["pending", "paid", "fulfilled", "cancelled"]


class CheckoutResponse(BaseModel):
    order_id: int
    authorization_url: str
    reference: str
