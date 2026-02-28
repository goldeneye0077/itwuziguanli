from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db_session
from app.models.organization import Department, SysUser
from app.schemas.common import ApiResponse

router = APIRouter()


@router.get("/departments")
def list_departments(
    parent_id: int | None = None,
    db: Session = Depends(get_db_session),
):
    """获取部门列表"""
    stmt = select(Department)
    if parent_id is not None:
        stmt = stmt.where(Department.parent_id == parent_id)
    stmt = stmt.order_by(Department.sort_order, Department.id)
    departments = db.scalars(stmt).all()
    return ApiResponse(data=departments)


@router.get("/departments/{department_id}")
def get_department(
    department_id: int,
    db: Session = Depends(get_db_session),
):
    """获取部门详情"""
    department = db.get(Department, department_id)
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return ApiResponse(data=department)


@router.get("/users")
def list_users(
    department_id: int | None = None,
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db_session),
):
    """获取用户列表"""
    stmt = select(SysUser)

    if department_id:
        stmt = stmt.where(SysUser.department_id == department_id)
    if keyword:
        stmt = stmt.where(
            (SysUser.name.ilike(f"%{keyword}%")) |
            (SysUser.username.ilike(f"%{keyword}%"))
        )

    offset = (page - 1) * page_size
    stmt = stmt.order_by(SysUser.id.desc()).offset(offset).limit(page_size)

    users = db.scalars(stmt).all()

    return ApiResponse(data={
        "items": users,
        "total": db.scalar(select(func.count(SysUser.id))),
        "page": page,
        "page_size": page_size,
    })


@router.get("/users/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db_session),
):
    """获取用户详情"""
    user = db.get(SysUser, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return ApiResponse(data=user)


@router.get("/users/username/{username}")
def get_user_by_username(
    username: str,
    db: Session = Depends(get_db_session),
):
    """通过用户名获取用户"""
    user = db.execute(
        select(SysUser).where(SysUser.username == username)
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return ApiResponse(data=user)
