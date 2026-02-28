from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db_session
from app.models.inventory import Asset
from app.schemas.common import ApiResponse

router = APIRouter()


@router.get("/assets")
def list_assets(
    sku_id: int | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db_session),
):
    """获取资产列表"""
    stmt = select(Asset)

    if sku_id:
        stmt = stmt.where(Asset.sku_id == sku_id)
    if status:
        stmt = stmt.where(Asset.status == status)

    # 分页
    offset = (page - 1) * page_size
    stmt = stmt.order_by(Asset.id.desc()).offset(offset).limit(page_size)

    assets = db.scalars(stmt).all()

    return ApiResponse(data={
        "items": assets,
        "total": db.scalar(select(func.count(Asset.id))),
        "page": page,
        "page_size": page_size,
    })


@router.get("/assets/{asset_id}")
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db_session),
):
    """获取资产详情"""
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return ApiResponse(data=asset)


@router.get("/assets/sn/{sn}")
def get_asset_by_sn(
    sn: str,
    db: Session = Depends(get_db_session),
):
    """通过序列号获取资产"""
    asset = db.execute(
        select(Asset).where(Asset.sn == sn)
    ).scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return ApiResponse(data=asset)
