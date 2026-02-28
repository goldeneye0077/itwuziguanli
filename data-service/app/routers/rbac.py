from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db_session
from app.models.rbac import RbacRole, RbacPermission, RbacUserRole, RbacRolePermission, RbacUiGuard
from app.schemas.common import ApiResponse

router = APIRouter()


# ==================== Roles ====================

@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db_session),
):
    """获取角色列表"""
    stmt = select(RbacRole).order_by(RbacRole.id)
    roles = db.scalars(stmt).all()
    return ApiResponse(data=roles)


@router.get("/roles/{role_id}")
def get_role(
    role_id: int,
    db: Session = Depends(get_db_session),
):
    """获取角色详情"""
    role = db.get(RbacRole, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return ApiResponse(data=role)


@router.get("/roles/{role_id}/permissions")
def get_role_permissions(
    role_id: int,
    db: Session = Depends(get_db_session),
):
    """获取角色权限"""
    stmt = select(RbacRolePermission).where(RbacRolePermission.role_id == role_id)
    permissions = db.scalars(stmt).all()
    return ApiResponse(data=permissions)


@router.get("/roles/{role_id}/users")
def get_role_users(
    role_id: int,
    db: Session = Depends(get_db_session),
):
    """获取角色下的用户"""
    stmt = select(RbacUserRole).where(RbacUserRole.role_id == role_id)
    user_roles = db.scalars(stmt).all()
    return ApiResponse(data=user_roles)


# ==================== Permissions ====================

@router.get("/permissions")
def list_permissions(
    db: Session = Depends(get_db_session),
):
    """获取权限列表"""
    stmt = select(RbacPermission).order_by(RbacPermission.id)
    permissions = db.scalars(stmt).all()
    return ApiResponse(data=permissions)


@router.get("/permissions/{permission_id}")
def get_permission(
    permission_id: int,
    db: Session = Depends(get_db_session),
):
    """获取权限详情"""
    permission = db.get(RbacPermission, permission_id)
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    return ApiResponse(data=permission)


# ==================== User Roles ====================

@router.get("/user-roles")
def list_user_roles(
    user_id: int | None = None,
    db: Session = Depends(get_db_session),
):
    """获取用户角色列表"""
    stmt = select(RbacUserRole)
    if user_id:
        stmt = stmt.where(RbacUserRole.user_id == user_id)
    user_roles = db.scalars(stmt).all()
    return ApiResponse(data=user_roles)


# ==================== UI Guards ====================

@router.get("/ui-guards")
def list_ui_guards(
    db: Session = Depends(get_db_session),
):
    """获取UI权限守卫列表"""
    stmt = select(RbacUiGuard).order_by(RbacUiGuard.id)
    guards = db.scalars(stmt).all()
    return ApiResponse(data=guards)


@router.get("/ui-guards/{guard_id}")
def get_ui_guard(
    guard_id: int,
    db: Session = Depends(get_db_session),
):
    """获取UI权限守卫详情"""
    guard = db.get(RbacUiGuard, guard_id)
    if not guard:
        raise HTTPException(status_code=404, detail="UiGuard not found")
    return ApiResponse(data=guard)
