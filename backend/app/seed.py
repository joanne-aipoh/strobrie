"""Seed the database with Strobrie's real menu, events, and POS reference data.

Run with: python -m app.seed
"""

from datetime import datetime, timezone

from . import models, pos_models, shop_models
from .database import Base, SessionLocal, engine

# Strobrie's real menu — one shared catalog for both the till (Flow's Sell
# screen) and the online shop. Prices are in whole Naira. All items are
# seeded as available online (is_active=True); toggle per item from Flow's
# Products tab if some shouldn't be orderable online.
PRODUCTS = [
    ("esp", "Coffee", "Espresso", 3800),
    ("ame", "Coffee", "Americano", 4700),
    ("cap", "Coffee", "Cappuccino", 5300),
    ("lat", "Coffee", "Cafe Latte", 5700),
    ("moc", "Coffee", "Cafe Mocha", 6600),
    ("crm", "Coffee", "Caramel Macchiato", 6600),
    ("ica", "Coffee", "Iced Americano", 4800),
    ("ila", "Coffee", "Iced Cafe Latte", 6600),
    ("span", "Coffee", "Spanish Latte", 5800),
    ("lem", "Drinks", "Fresh Lemonade", 5100),
    ("foj", "Drinks", "Fresh Orange Juice", 5700),
    ("ilt", "Drinks", "Lemon Iced Tea", 4700),
    ("vms", "Drinks", "Vanilla Milkshake", 6600),
    ("sms", "Drinks", "Strawberry Milkshake", 7000),
    ("aci", "Drinks", "Acai Berry Smoothie", 7000),
    ("bpc", "Breakfast", "Butter Pancakes (Full)", 10500),
    ("npc", "Breakfast", "Nutella Pancakes (Full)", 11800),
    ("frt", "Breakfast", "French Toast (Full)", 10000),
    ("egg", "Breakfast", "Eggs Your Way", 6200),
    ("sav", "Breakfast", "Savoury Breakfast", 11500),
    ("eng", "Breakfast", "English Breakfast", 15000),
    ("ths", "Breakfast", "Turkey Ham Sandwich", 10500),
    ("chs", "Breakfast", "Chicken Sandwich", 11000),
    ("bbu", "Breakfast", "Breakfast Burger", 12000),
    ("bbq", "Lunch", "BBQ Torzo Sandwich", 11000),
    ("cbu", "Lunch", "Chicken Burger", 10500),
    ("bbn", "Lunch", "Beef Burger", 10500),
    ("suy", "Lunch", "Suya Yakitori", 11500),
    ("rag", "Lunch", "Ragu Pasta", 12000),
    ("pen", "Lunch", "Creamy Chicken Penne", 13500),
    ("vwr", "Lunch", "Vegetarian Wrap", 10500),
    ("fry", "Lunch", "French Fries", 5200),
    ("cup", "Bakery", "Cupcake (Single)", 2800),
    ("lcs", "Bakery", "Lemon Cake Slice", 4800),
    ("rvs", "Bakery", "Red Velvet Slice", 4800),
    ("cbr", "Bakery", "Chocolate Brownie", 2800),
    ("obr", "Bakery", "Oreo Brownie", 3600),
    ("ccc", "Bakery", "Chocolate Chip Cookie", 1800),
    ("cnr", "Bakery", "Cinnamon Roll", 2500),
    ("vmj", "Bar", "Virgin Mojito", 5800),
    ("srp", "Bar", "Strobrie Rum Punch", 7000),
    ("hnk", "Bar", "Heineken", 2000),
    ("dsp", "Bar", "Desperados", 2200),
    ("bav", "Brunch", "Avocado Toast", 11200),
    ("beb", "Brunch", "Eggs Benedict", 9300),
    ("bkb", "Brunch", "Kiddie Breakfast", 7500),
    ("bkc", "Brunch", "Kids Chicken Strips With Fries", 7300),
    ("bcr", "Brunch", "Banana Nutella Crepes", 9700),
    ("bwf", "Brunch", "Butter Waffles", 9700),
    ("bwc", "Brunch", "Waffles With Chicken Strips", 12600),
    ("bvo", "Brunch", "Virgin Orange Mimosa", 6700),
    ("bom", "Brunch", "Orange Mimosa", 6700),
    ("bsm", "Brunch", "Sunrise Mimosa", 7700),
    ("wcv", "Cakes", 'Whole Cake – Vanilla (6")', 37100),
    ("wcb", "Cakes", 'Whole Cake – Banana (6")', 41900),
    ("wcr", "Cakes", 'Whole Cake – Red Velvet (6")', 46400),
    ("wcc", "Cakes", 'Whole Cake – Chocolate (6")', 46400),
    ("wca", "Cakes", 'Whole Cake – Carrot (6")', 46000),
    ("wcl", "Cakes", 'Whole Cake – Lemon (6")', 45000),
    ("wco", "Cakes", 'Whole Cake – Cookies & Cream (6")', 46400),
    ("wcs", "Cakes", 'Whole Cake – Strawberry (6")', 41500),
    ("nyc", "Cakes", 'Cheesecake – New York Style (6")', 46400),
    ("obc", "Cakes", 'Cheesecake – Oreo/Lotus Biscoff (6")', 53500),
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

# Ingredients tracked in the POS inventory, with starting stock levels.
INGREDIENTS = [
    ("coffeebeans", "Coffee beans", "kg", 5),
    ("milk", "Whole milk", "l", 20),
    ("cream", "Cream", "l", 10),
    ("sugar", "Sugar", "kg", 10),
    ("flour", "Flour", "kg", 15),
    ("eggs", "Eggs", "each", 120),
    ("butter", "Butter", "kg", 8),
    ("nutella", "Nutella", "kg", 5),
    ("chocolate", "Chocolate", "kg", 6),
    ("chicken", "Chicken breast", "kg", 15),
    ("beef", "Beef", "kg", 12),
    ("bacon", "Bacon", "kg", 6),
    ("turkeyham", "Turkey ham", "kg", 6),
    ("ciabatta", "Ciabatta bread", "each", 40),
    ("lettuce", "Lettuce", "kg", 5),
    ("tomatoes", "Tomatoes", "kg", 8),
    ("cheese", "Cheese", "kg", 6),
    ("bananas", "Bananas", "kg", 10),
    ("strawberries", "Strawberries", "kg", 6),
    ("blueberries", "Blueberries", "kg", 4),
    ("pasta", "Pasta", "kg", 10),
    ("oranges", "Fresh oranges", "kg", 15),
    ("lemons", "Lemons", "kg", 15),
    ("honey", "Honey", "l", 6),
    ("yogurt", "Yogurt", "l", 8),
    ("coconutmilk", "Coconut milk", "l", 6),
]

# Illustrative starter recipes for Coffee & Drinks — the rest can be defined
# from the Inventory tab in Flow.
RECIPES = {
    "esp": [("coffeebeans", 0.018)],
    "ame": [("coffeebeans", 0.018)],
    "cap": [("coffeebeans", 0.018), ("milk", 0.15)],
    "lat": [("coffeebeans", 0.018), ("milk", 0.2)],
    "moc": [("coffeebeans", 0.018), ("milk", 0.15), ("chocolate", 0.02)],
    "crm": [("coffeebeans", 0.018), ("milk", 0.2)],
    "ica": [("coffeebeans", 0.018)],
    "ila": [("coffeebeans", 0.018), ("milk", 0.2)],
    "span": [("coffeebeans", 0.018), ("milk", 0.2), ("cream", 0.03)],
    "lem": [("lemons", 0.15), ("sugar", 0.03)],
    "foj": [("oranges", 0.35)],
    "ilt": [("lemons", 0.08), ("sugar", 0.02)],
    "vms": [("milk", 0.25), ("cream", 0.05)],
    "sms": [("milk", 0.2), ("strawberries", 0.12)],
    "aci": [("blueberries", 0.1), ("yogurt", 0.1), ("coconutmilk", 0.05)],
}


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(shop_models.Product).count() == 0:
            for i, (slug, category, name, price) in enumerate(PRODUCTS):
                db.add(shop_models.Product(slug=slug, category=category, name=name, price=price, sort_order=i))
            print(f"Inserted {len(PRODUCTS)} products")
        else:
            print("Products already seeded, skipping")

        if db.query(models.Event).count() == 0:
            db.add_all(models.Event(**event) for event in EVENTS)
            print(f"Inserted {len(EVENTS)} events")
        else:
            print("Events already seeded, skipping")

        if db.query(pos_models.InventoryItem).count() == 0:
            for slug, name, unit, qty in INGREDIENTS:
                db.add(pos_models.InventoryItem(slug=slug, name=name, unit=unit, quantity=qty))
            print(f"Inserted {len(INGREDIENTS)} inventory items")
        else:
            print("Inventory already seeded, skipping")
        db.commit()

        if db.query(pos_models.Recipe).count() == 0:
            product_by_slug = {p.slug: p for p in db.query(shop_models.Product).all()}
            ingredient_by_slug = {i.slug: i for i in db.query(pos_models.InventoryItem).all()}
            count = 0
            for item_slug, ingredients in RECIPES.items():
                product = product_by_slug.get(item_slug)
                if not product:
                    continue
                for ing_slug, qty in ingredients:
                    ingredient = ingredient_by_slug.get(ing_slug)
                    if not ingredient:
                        continue
                    db.add(
                        pos_models.Recipe(
                            menu_item_id=product.id, ingredient_id=ingredient.id, qty_per_item=qty
                        )
                    )
                    count += 1
            print(f"Inserted {count} recipe ingredient links")
        else:
            print("Recipes already seeded, skipping")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
