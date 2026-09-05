from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, pos_models, pos_schemas, schemas
from ..database import get_db

router = APIRouter(prefix="/api/pos", tags=["pos-inventory"])


@router.get("/inventory", response_model=list[pos_schemas.InventoryItemOut])
def list_inventory(db: Session = Depends(get_db)):
    stmt = select(pos_models.InventoryItem).order_by(pos_models.InventoryItem.name)
    return db.scalars(stmt).all()


@router.post("/inventory/{item_id}/restock", response_model=pos_schemas.InventoryItemOut)
def restock(item_id: int, payload: pos_schemas.RestockRequest, db: Session = Depends(get_db)):
    item = db.get(pos_models.InventoryItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    item.quantity += payload.qty
    db.commit()
    db.refresh(item)
    return item


@router.post("/menu-items/{item_id}/restock", response_model=schemas.MenuItemOut)
def restock_menu_item(item_id: int, payload: schemas.RestockRequest, db: Session = Depends(get_db)):
    """Log a batch made — adds to stock_qty, treating a currently-unlimited
    (null) item as starting from 0 (i.e. this is what turns tracking on)."""
    item = db.get(models.MenuItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    item.stock_qty = (item.stock_qty or 0) + payload.qty
    db.commit()
    db.refresh(item)
    return item


@router.put("/menu-items/{item_id}/stock", response_model=schemas.MenuItemOut)
def set_menu_item_stock(item_id: int, payload: schemas.StockSetRequest, db: Session = Depends(get_db)):
    """Set stock_qty to an exact number, or null to clear it back to unlimited."""
    item = db.get(models.MenuItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    item.stock_qty = payload.stock_qty
    db.commit()
    db.refresh(item)
    return item


@router.get("/recipes/{menu_item_id}", response_model=list[pos_schemas.RecipeLineOut])
def get_recipe(menu_item_id: int, db: Session = Depends(get_db)):
    stmt = select(pos_models.Recipe).where(pos_models.Recipe.menu_item_id == menu_item_id)
    return db.scalars(stmt).all()


@router.put("/recipes/{menu_item_id}", response_model=list[pos_schemas.RecipeLineOut])
def set_recipe(menu_item_id: int, payload: pos_schemas.RecipeSetRequest, db: Session = Depends(get_db)):
    db.query(pos_models.Recipe).filter(pos_models.Recipe.menu_item_id == menu_item_id).delete()
    lines = [
        pos_models.Recipe(menu_item_id=menu_item_id, ingredient_id=line.ingredient_id, qty_per_item=line.qty_per_item)
        for line in payload.lines
    ]
    db.add_all(lines)
    db.commit()
    stmt = select(pos_models.Recipe).where(pos_models.Recipe.menu_item_id == menu_item_id)
    return db.scalars(stmt).all()
