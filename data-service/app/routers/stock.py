from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db_session
from app.models.sku_stock import SkuStock, SkuStockFlow
from app.schemas.common import ApiResponse

router = APIRouter()


@router.get("/stock/sku/{sku_id}")
def get_sku_stock(
    sku_id: int,
    db: Session = Depends(get_db_session),
):
    """获取 SKU 库存"""
    stock = db.execute(
        select(SkuStock).where(SkuStock.sku_id == sku_id)
    ).scalar_one_or_none()
    return ApiResponse(data=stock)


@router.get("/stock/skus")
def list_sku_stocks(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db_session),
):
    """获取所有 SKU 库存"""
    stmt = select(SkuStock).order_by(SkuStock.sku_id)

    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    stocks = db.scalars(stmt).all()

    return ApiResponse(data={
        "items": stocks,
        "total": db.scalar(select(func.count(SkuStock.id))),
        "page": page,
        "page_size": page_size,
    })


@router.get("/stock/skus/{sku_id}/flows")
def list_stock_flows(
    sku_id: int,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db_session),
):
    """获取 SKU 库存流水"""
    stmt = select(SkuStockFlow).where(
        SkuStockFlow.sku_id == sku_id
    ).order_by(SkuStockFlow.id.desc())

    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    flows = db.scalars(stmt).all()

    return ApiResponse(data={
        "items": flows,
        "total": db.scalar(select(func.count(SkuStockFlow.id)).where(
            SkuStockFlow.sku_id == sku_id
        )),
        "page": page,
        "page_size": page_size,
    })


@router.get("/stock/department/{department_id}")
def get_department_stock(
    department_id: int,
    db: Session = Depends(get_db_session),
):
    """获取部门库存（库存为负数表示占用）"""
    stmt = select(SkuStock).where(
        SkuStock.department_id == department_id,
        SkuStock.quantity < 0
    )
    stocks = db.scalars(stmt).all()
    return ApiResponse(data=stocks)
