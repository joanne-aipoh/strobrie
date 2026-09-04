"""Seed the database with Strobrie's real menu/events content.

Run with: python -m app.seed
"""

from datetime import datetime, timezone

from . import models
from .database import Base, SessionLocal, engine

MENU_ITEMS = [
    # Cafe
    dict(category="cafe", name="Full English Breakfast", price_kobo=None, sort_order=1),
    dict(category="cafe", name="Grilled Sandwich & Chips", price_kobo=None, sort_order=2),
    dict(category="cafe", name="Steak Pasta", price_kobo=None, sort_order=3),
    # Drinks — made from real ube
    dict(category="drinks", name="Berry Fizz", price_kobo=680_000, sort_order=1),
    dict(category="drinks", name="Ube Latte", price_kobo=650_000, sort_order=2),
    dict(category="drinks", name="Signature Iced Drinks", price_kobo=750_000, sort_order=3),
    # Bakery
    dict(category="bakery", name="Fresh Pastries, daily", price_kobo=None, sort_order=1),
    dict(category="bakery", name="Cakes & Sweet Bakes", price_kobo=None, sort_order=2),
    dict(category="bakery", name="Custom Orders", price_kobo=None, sort_order=3),
]

EVENTS = [
    dict(
        title="Karaoke Night",
        description="Grab the mic and join us for a night of karaoke, drinks, and good vibes.",
        start_time=datetime(2026, 9, 5, 17, 0, tzinfo=timezone.utc),
        capacity=40,
    ),
    dict(
        title="Sip & Paint",
        description="Drinks, canvases, and good company — no experience needed.",
        start_time=datetime(2026, 9, 12, 16, 0, tzinfo=timezone.utc),
        capacity=20,
    ),
    dict(
        title="Pottery Workshop",
        description="Hands-on pottery session for all skill levels.",
        start_time=datetime(2026, 9, 19, 15, 0, tzinfo=timezone.utc),
        capacity=12,
    ),
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(models.MenuItem).count() == 0:
            db.add_all(models.MenuItem(**item) for item in MENU_ITEMS)
            print(f"Inserted {len(MENU_ITEMS)} menu items")
        else:
            print("Menu items already seeded, skipping")

        if db.query(models.Event).count() == 0:
            db.add_all(models.Event(**event) for event in EVENTS)
            print(f"Inserted {len(EVENTS)} events")
        else:
            print("Events already seeded, skipping")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
