"""Schemas for M08 admin endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

AdminCrudResource = Literal[
    "users",
    "categories",
    "skus",
    "assets",
    "applications",
    "announcements",
]


class RbacRoleCreateRequest(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=500)


class RoleBindingPermissionGroup(BaseModel):
    resource: str = Field(min_length=1, max_length=64)
    actions: list[str] = Field(min_length=1)


class RbacRoleBindingsRequest(BaseModel):
    role_key: str = Field(min_length=1, max_length=64)
    permissions: list[RoleBindingPermissionGroup]


class AdminUserRolesUpdateRequest(BaseModel):
    roles: list[str]
