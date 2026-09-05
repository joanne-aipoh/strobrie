import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import shop_models, shop_schemas
from ..database import get_db

router = APIRouter(prefix="/api/shop", tags=["shop-products"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "products")
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8MB


# --- Public: storefront -----------------------------------------------------


@router.get("/products", response_model=list[shop_schemas.ProductOut])
def list_products(db: Session = Depends(get_db)):
    stmt = (
        select(shop_models.Product)
        .where(shop_models.Product.is_active.is_(True))
        .options(selectinload(shop_models.Product.photos))
        .order_by(shop_models.Product.category, shop_models.Product.sort_order)
    )
    return db.scalars(stmt).all()


@router.get("/products/{product_id}", response_model=shop_schemas.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(shop_models.Product, product_id)
    if product is None or not product.is_active:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


# --- Admin: product management (Flow's Products tab) -------------------


@router.get("/admin/products", response_model=list[shop_schemas.ProductOut])
def admin_list_products(db: Session = Depends(get_db)):
    stmt = (
        select(shop_models.Product)
        .options(selectinload(shop_models.Product.photos))
        .order_by(shop_models.Product.category, shop_models.Product.sort_order)
    )
    return db.scalars(stmt).all()


@router.post("/admin/products", response_model=shop_schemas.ProductOut, status_code=201)
def create_product(payload: shop_schemas.ProductCreate, db: Session = Depends(get_db)):
    product = shop_models.Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/admin/products/{product_id}", response_model=shop_schemas.ProductOut)
def update_product(product_id: int, payload: shop_schemas.ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(shop_models.Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.model_dump().items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.post("/admin/products/{product_id}/restock", response_model=shop_schemas.ProductOut)
def restock_product(product_id: int, payload: shop_schemas.RestockRequest, db: Session = Depends(get_db)):
    """Log a batch made — adds to stock_qty, treating a currently-unlimited
    (null) product as starting from 0 (i.e. this is what turns tracking on)."""
    product = db.get(shop_models.Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    product.stock_qty = (product.stock_qty or 0) + payload.qty
    db.commit()
    db.refresh(product)
    return product


@router.delete("/admin/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(shop_models.Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    for photo in product.photos:
        _delete_photo_file(photo.url)
    db.delete(product)
    db.commit()


def _delete_photo_file(url: str):
    filename = os.path.basename(url)
    path = os.path.join(UPLOAD_DIR, filename)
    if os.path.isfile(path):
        os.remove(path)


@router.post("/admin/products/{product_id}/photos", response_model=shop_schemas.ProductPhotoOut, status_code=201)
async def upload_product_photo(product_id: int, file: UploadFile, db: Session = Depends(get_db)):
    product = db.get(shop_models.Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WEBP, or GIF images are allowed")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large (max 8MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(contents)

    next_order = len(product.photos)
    photo = shop_models.ProductPhoto(product_id=product_id, url=f"/uploads/products/{filename}", sort_order=next_order)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/admin/photos/{photo_id}", status_code=204)
def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.get(shop_models.ProductPhoto, photo_id)
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    _delete_photo_file(photo.url)
    db.delete(photo)
    db.commit()


@router.put("/admin/products/{product_id}/photos/reorder", response_model=list[shop_schemas.ProductPhotoOut])
def reorder_photos(product_id: int, payload: shop_schemas.PhotoReorderRequest, db: Session = Depends(get_db)):
    photos = {p.id: p for p in db.query(shop_models.ProductPhoto).filter(shop_models.ProductPhoto.product_id == product_id)}
    for order, photo_id in enumerate(payload.photo_ids_in_order):
        if photo_id in photos:
            photos[photo_id].sort_order = order
    db.commit()
    return sorted(photos.values(), key=lambda p: p.sort_order)
