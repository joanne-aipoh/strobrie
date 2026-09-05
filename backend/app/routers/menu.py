from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/menu", tags=["menu"])


@router.get("", response_model=list[schemas.MenuItemOut])
def list_menu_items(db: Session = Depends(get_db)):
    stmt = select(models.MenuItem).order_by(models.MenuItem.category, models.MenuItem.sort_order)
    return db.scalars(stmt).all()
