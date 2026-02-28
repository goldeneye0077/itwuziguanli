from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db_session
from app.models.notification import NotificationOutbox, UserAddress
from app.schemas.common import ApiResponse

router = APIRouter()


@router.get("/notifications/outbox")
def list_notification_outbox(
    status: str | None = None,
    channel: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db_session),
):
    """获取通知发件箱列表"""
    stmt = select(NotificationOutbox)

    if status:
        stmt = stmt.where(NotificationOutbox.status == status)
    if channel:
        stmt = stmt.where(NotificationOutbox.channel == channel)

    offset = (page - 1) * page_size
    stmt = stmt.order_by(NotificationOutbox.id.desc()).offset(offset).limit(page_size)

    notifications = db.scalars(stmt).all()

    return ApiResponse(data={
        "items": notifications,
        "total": db.scalar(select(func.count(NotificationOutbox.id))),
        "page": page,
        "page_size": page_size,
    })


@router.get("/notifications/outbox/{notification_id}")
def get_notification_outbox(
    notification_id: int,
    db: Session = Depends(get_db_session),
):
    """获取通知详情"""
    notification = db.get(NotificationOutbox, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return ApiResponse(data=notification)


@router.get("/user-addresses")
def list_user_addresses(
    user_id: int | None = None,
    db: Session = Depends(get_db_session),
):
    """获取用户地址列表"""
    stmt = select(UserAddress)
    if user_id:
        stmt = stmt.where(UserAddress.user_id == user_id)
    stmt = stmt.order_by(UserAddress.id.desc())
    addresses = db.scalars(stmt).all()
    return ApiResponse(data=addresses)


@router.get("/user-addresses/{address_id}")
def get_user_address(
    address_id: int,
    db: Session = Depends(get_db_session),
):
    """获取地址详情"""
    address = db.get(UserAddress, address_id)
    if not address:
        raise HTTPException(status_code=404, detail="UserAddress not found")
    return ApiResponse(data=address)
