import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import Base, engine
from .routers import bookings, contact, events, menu

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

app.include_router(menu.router)
app.include_router(events.router)
app.include_router(contact.router)
app.include_router(bookings.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
