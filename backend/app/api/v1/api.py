from fastapi import APIRouter

from .routers import (
    m00_common_auth,
    m01_portal,
    m02_application,
    m03_approval,
    m04_notification_verify,
    m05_outbound,
    m06_inbound_inventory,
    m07_reports,
    m08_admin,
    m09_asset_lifecycle,
)

api_router = APIRouter()

api_router.include_router(m00_common_auth.router)
api_router.include_router(m01_portal.router)
api_router.include_router(m02_application.router)
api_router.include_router(m03_approval.router)
api_router.include_router(m04_notification_verify.router)
api_router.include_router(m05_outbound.router)
api_router.include_router(m06_inbound_inventory.router)
api_router.include_router(m07_reports.router)
api_router.include_router(m08_admin.router)
api_router.include_router(m09_asset_lifecycle.router)
