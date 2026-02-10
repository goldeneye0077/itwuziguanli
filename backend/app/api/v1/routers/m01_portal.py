"""M01 router implementation: smart portal."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ....core.auth import AuthContext, get_auth_context
from ....db.session import get_db_session
from ....models.enums import AnnouncementStatus
from ....models.inventory import Asset
from ....models.portal import Announcement, HeroBanner
from ....schemas.common import ApiResponse, build_success_response

router = APIRouter(tags=["M01"])


def _to_iso8601(value: datetime) -> str:
    if value.tzinfo is None:
        normalized = value.replace(tzinfo=UTC)
    else:
        normalized = value.astimezone(UTC)
    return normalized.isoformat(timespec="seconds").replace("+00:00", "Z")


@router.get("/dashboard/hero", response_model=ApiResponse)
def get_dashboard_hero(
    _: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    hero = db.scalar(
        select(HeroBanner)
        .where(HeroBanner.is_active.is_(True))
        .order_by(HeroBanner.display_order.asc(), HeroBanner.id.desc())
        .limit(1)
    )

    if hero is None:
        return build_success_response(
            {
                "title": "IT 资产全生命周期系统",
                "subtitle": "统一申请、审批与生命周期可视化。",
                "image_url": None,
                "link_url": None,
            }
        )

    return build_success_response(
        {
            "title": hero.title,
            "subtitle": hero.subtitle,
            "image_url": hero.image_url,
            "link_url": hero.link_url,
        }
    )


@router.get("/announcements", response_model=ApiResponse)
def list_announcements(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    _: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    offset = (page - 1) * page_size

    total = db.scalar(
        select(func.count(Announcement.id)).where(
            Announcement.status == AnnouncementStatus.PUBLISHED,
            Announcement.published_at.is_not(None),
        )
    )

    items = db.scalars(
        select(Announcement)
        .where(
            Announcement.status == AnnouncementStatus.PUBLISHED,
            Announcement.published_at.is_not(None),
        )
        .order_by(Announcement.published_at.desc(), Announcement.id.desc())
        .offset(offset)
        .limit(page_size)
    ).all()

    return build_success_response(
        {
            "items": [
                {
                    "id": row.id,
                    "title": row.title,
                    "content": row.content,
                    "published_at": _to_iso8601(row.published_at),
                }
                for row in items
                if row.published_at is not None
            ],
            "meta": {
                "page": page,
                "page_size": page_size,
                "total": total or 0,
            },
        }
    )


@router.get("/me/assets", response_model=ApiResponse)
def list_my_assets(
    context: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db_session),
) -> ApiResponse:
    assets = db.scalars(
        select(Asset)
        .where(Asset.holder_user_id == context.user.id)
        .order_by(Asset.inbound_at.desc(), Asset.id.desc())
    ).all()

    return build_success_response(
        [
            {
                "id": asset.id,
                "asset_tag": asset.asset_tag,
                "sku_id": asset.sku_id,
                "sn": asset.sn,
                "status": asset.status.value,
                "holder_user_id": asset.holder_user_id,
                "inbound_at": _to_iso8601(asset.inbound_at),
            }
            for asset in assets
        ]
    )
