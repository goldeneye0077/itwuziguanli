from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db_session
from app.models.portal import Announcement, HeroBanner
from app.schemas.common import ApiResponse

router = APIRouter()


@router.get("/announcements")
def list_announcements(
    is_active: bool | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db_session),
):
    """获取公告列表"""
    stmt = select(Announcement)

    if is_active is not None:
        stmt = stmt.where(Announcement.is_active == is_active)

    offset = (page - 1) * page_size
    stmt = stmt.order_by(Announcement.sort_order, Announcement.id.desc()).offset(offset).limit(page_size)

    announcements = db.scalars(stmt).all()

    return ApiResponse(data={
        "items": announcements,
        "total": db.scalar(select(func.count(Announcement.id))),
        "page": page,
        "page_size": page_size,
    })


@router.get("/announcements/{announcement_id}")
def get_announcement(
    announcement_id: int,
    db: Session = Depends(get_db_session),
):
    """获取公告详情"""
    announcement = db.get(Announcement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return ApiResponse(data=announcement)


@router.get("/hero-banners")
def list_hero_banners(
    is_active: bool | None = None,
    db: Session = Depends(get_db_session),
):
    """获取首页横幅列表"""
    stmt = select(HeroBanner)
    if is_active is not None:
        stmt = stmt.where(HeroBanner.is_active == is_active)
    stmt = stmt.order_by(HeroBanner.sort_order, HeroBanner.id)
    banners = db.scalars(stmt).all()
    return ApiResponse(data=banners)


@router.get("/hero-banners/{banner_id}")
def get_hero_banner(
    banner_id: int,
    db: Session = Depends(get_db_session),
):
    """获取横幅详情"""
    banner = db.get(HeroBanner, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="HeroBanner not found")
    return ApiResponse(data=banner)
