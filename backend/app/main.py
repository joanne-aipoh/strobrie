import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import models, pos_models, shop_models
from .database import Base, engine
from .routers import (
    bookings,
    contact,
    events,
    menu,
    pos_customers,
    pos_events,
    pos_inventory,
    pos_sales,
    pos_staff,
    pos_waste,
    shop_orders,
    shop_products,
)

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Strobrie API")

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(os.path.join(UPLOADS_DIR, "products"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.include_router(menu.router)
app.include_router(events.router)
app.include_router(contact.router)
app.include_router(bookings.router)
app.include_router(pos_staff.router)
app.include_router(pos_sales.router)
app.include_router(pos_customers.router)
app.include_router(pos_waste.router)
app.include_router(pos_inventory.router)
app.include_router(pos_events.router)
app.include_router(shop_products.router)
app.include_router(shop_orders.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
