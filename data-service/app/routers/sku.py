from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db_session
from app.models.catalog import Sku, Category
from app.schemas.common import ApiResponse

router = APIRouter()


@router.get("/skus")
def list_skus(
    category_id: int | None = None,
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db_session),
):
    """获取物料列表"""
    stmt = select(Sku)

    if category_id:
        stmt = stmt.where(Sku.category_id == category_id)
    if keyword:
        stmt = stmt.where(Sku.name.ilike(f"%{keyword}%"))

    # 分页
    offset = (page - 1) * page_size
    stmt = stmt.order_by(Sku.id.desc()).offset(offset).limit(page_size)

    skus = db.scalars(stmt).all()

    return ApiResponse(data={
        "items": skus,
        "total": db.scalar(select(func.count(Sku.id))),
        "page": page,
        "page_size": page_size,
    })


@router.get("/skus/{sku_id}")
def get_sku(
    sku_id: int,
    db: Session = Depends(get_db_session),
):
    """获取物料详情"""
    sku = db.get(Sku, sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    return ApiResponse(data=sku)


@router.get("/categories")
def list_categories(
    parent_id: int | None = None,
    db: Session = Depends(get_db_session),
):
    """获取分类列表"""
    stmt = select(Category)
    if parent_id is not None:
        stmt = stmt.where(Category.parent_id == parent_id)
    stmt = stmt.order_by(Category.sort_order, Category.id)
    categories = db.scalars(stmt).all()
    return ApiResponse(data=categories)


@router.get("/categories/{category_id}")
def get_category(
    category_id: int,
    db: Session = Depends(get_db_session),
):
    """获取分类详情"""
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return ApiResponse(data=category)
