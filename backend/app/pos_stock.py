"""Stock movements shared by the till and by open tabs.

Both a straight walk-in sale and an open dine-in tab take the same things off
the shelf: tracked product stock, and raw ingredients via each item's recipe.
Keeping that in one place is what stops the two paths from drifting — a tab
that's later paid must move stock exactly once, and cancelling it must put
back exactly what it took.
"""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import pos_models, shop_models


def load_products(db: Session, items) -> dict[int, shop_models.Product]:
    """The products behind the menu lines. Custom items (no menu_item_id) have none."""
    ids = [line.menu_item_id for line in items if line.menu_item_id is not None]
    if not ids:
        return {}
    stmt = select(shop_models.Product).where(shop_models.Product.id.in_(ids))
    return {p.id: p for p in db.scalars(stmt)}


def assert_sellable(items, products: dict[int, shop_models.Product]) -> None:
    """Fail fast, before any mutation, if something can't actually be sold."""
    for line in items:
        product = products.get(line.menu_item_id)
        if product and product.unavailable:
            raise HTTPException(status_code=400, detail=f"{product.name} isn't available today")
        if product and product.stock_qty is not None and line.qty > product.stock_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough {product.name} in stock ({product.stock_qty} left)",
            )


def ingredient_deductions(db: Session, items) -> dict[str, float]:
    """How much of each raw ingredient these lines consume, by recipe.

    Keyed by ingredient id as a string because this is stored as JSON on the
    sale, so a void can put back exactly what was taken.
    """
    ids = [line.menu_item_id for line in items if line.menu_item_id is not None]
    recipes_by_item: dict[int, list[pos_models.Recipe]] = {}
    if ids:
        stmt = select(pos_models.Recipe).where(pos_models.Recipe.menu_item_id.in_(ids))
        for recipe in db.scalars(stmt):
            recipes_by_item.setdefault(recipe.menu_item_id, []).append(recipe)

    deductions: dict[str, float] = {}
    for line in items:
        for recipe in recipes_by_item.get(line.menu_item_id, []):
            key = str(recipe.ingredient_id)
            deductions[key] = deductions.get(key, 0) + recipe.qty_per_item * line.qty
    return deductions


def apply_ingredients(db: Session, deductions: dict[str, float], sign: int) -> None:
    """sign -1 takes ingredients off the shelf, +1 puts them back."""
    for ingredient_id, amount in (deductions or {}).items():
        ingredient = db.get(pos_models.InventoryItem, int(ingredient_id))
        if ingredient:
            ingredient.quantity += sign * amount


def apply_product_stock(db: Session, items, products: dict[int, shop_models.Product], sign: int) -> None:
    """sign -1 takes counted stock, +1 returns it. Untracked items are unaffected."""
    for line in items:
        product = products.get(line.menu_item_id)
        if product and product.stock_qty is not None:
            product.stock_qty += sign * line.qty


def take_stock(db: Session, items) -> dict[str, float]:
    """Validate, then move everything these lines need off the shelf.

    Returns the ingredient deductions so they can be recorded and later undone.
    """
    products = load_products(db, items)
    assert_sellable(items, products)
    deductions = ingredient_deductions(db, items)
    apply_ingredients(db, deductions, -1)
    apply_product_stock(db, items, products, -1)
    return deductions


def return_stock(db: Session, items, deductions: dict[str, float]) -> None:
    """Undo a take_stock — used by a void, a cancelled tab, or a tab being re-saved."""
    products = load_products(db, items)
    apply_ingredients(db, deductions, +1)
    apply_product_stock(db, items, products, +1)
