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


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    customer_email: EmailStr
    customer_phone: str = Field(min_length=1, max_length=30)
    fulfillment_method: Literal["pickup", "delivery"]
    delivery_address: str | None = None
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


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_name: str
    customer_email: EmailStr
    customer_phone: str
    fulfillment_method: str
    delivery_address: str | None
    status: str
    subtotal: int
    total: int
    payment_status: str
    created_at: datetime
    items: list[OrderItemOut]


class OrderStatusUpdate(BaseModel):
    status: Literal["pending", "paid", "fulfilled", "cancelled"]


class CheckoutResponse(BaseModel):
    order_id: int
    authorization_url: str
    reference: str
