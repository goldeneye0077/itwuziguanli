from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db_session
from app.models.application import Application
from app.schemas.common import ApiResponse

router = APIRouter()


@router.get("/applications")
def list_applications(
    applicant_user_id: int | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db_session),
):
    """获取申请列表"""
    stmt = select(Application)

    if applicant_user_id:
        stmt = stmt.where(Application.applicant_user_id == applicant_user_id)
    if status:
        stmt = stmt.where(Application.status == status)

    # 分页
    offset = (page - 1) * page_size
    stmt = stmt.order_by(Application.id.desc()).offset(offset).limit(page_size)

    applications = db.scalars(stmt).all()

    return ApiResponse(data={
        "items": applications,
        "total": db.scalar(select(func.count(Application.id))),
        "page": page,
        "page_size": page_size,
    })


@router.get("/applications/{application_id}")
def get_application(
    application_id: int,
    db: Session = Depends(get_db_session),
):
    """获取申请详情"""
    application = db.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return ApiResponse(data=application)


@router.get("/applications/{application_id}/items")
def get_application_items(
    application_id: int,
    db: Session = Depends(get_db_session),
):
    """获取申请明细"""
    application = db.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return ApiResponse(data=application.items)


@router.get("/applications/{application_id}/assets")
def get_application_assets(
    application_id: int,
    db: Session = Depends(get_db_session),
):
    """获取申请关联的资产"""
    application = db.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return ApiResponse(data=application.assets)


@router.get("/applications/{application_id}/history")
def get_approval_history(
    application_id: int,
    db: Session = Depends(get_db_session),
):
    """获取审批历史"""
    from app.models.application import ApprovalHistory
    stmt = select(ApprovalHistory).where(
        ApprovalHistory.application_id == application_id
    ).order_by(ApprovalHistory.id)
    history = db.scalars(stmt).all()
    return ApiResponse(data=history)
