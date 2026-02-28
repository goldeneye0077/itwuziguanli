"""Data Service HTTP 客户端

用于主服务（main-service）调用数据访问微服务（data-service）
"""
import os
from typing import Any

import httpx

# Data Service URL，默认指向本地服务
DATA_SERVICE_URL = os.getenv("DATA_SERVICE_URL", "http://localhost:18001")


class DataServiceClient:
    """数据服务 HTTP 客户端

    提供同步和异步方法调用 data-service API
    """

    def __init__(self, base_url: str | None = None, timeout: float = 30.0):
        self.base_url = base_url or DATA_SERVICE_URL
        self.timeout = timeout

    def _get_client(self) -> httpx.Client:
        """获取同步 HTTP 客户端"""
        return httpx.Client(timeout=self.timeout)

    async def _get_async_client(self) -> httpx.AsyncClient:
        """获取异步 HTTP 客户端"""
        return httpx.AsyncClient(timeout=self.timeout)

    # ==================== Application APIs ====================

    def list_applications(
        self,
        applicant_user_id: int | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """获取申请列表"""
        params = {"page": page, "page_size": page_size}
        if applicant_user_id:
            params["applicant_user_id"] = applicant_user_id
        if status:
            params["status"] = status

        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/applications", params=params)
            response.raise_for_status()
            return response.json()

    async def list_applications_async(
        self,
        applicant_user_id: int | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """获取申请列表（异步）"""
        params = {"page": page, "page_size": page_size}
        if applicant_user_id:
            params["applicant_user_id"] = applicant_user_id
        if status:
            params["status"] = status

        async with await self._get_async_client() as client:
            response = await client.get(f"{self.base_url}/api/v1/applications", params=params)
            response.raise_for_status()
            return response.json()

    def get_application(self, application_id: int) -> dict[str, Any]:
        """获取申请详情"""
        with self._get_client() as client:
            response = client.get(
                f"{self.base_url}/api/v1/applications/{application_id}"
            )
            response.raise_for_status()
            return response.json()

    async def get_application_async(self, application_id: int) -> dict[str, Any]:
        """获取申请详情（异步）"""
        async with await self._get_async_client() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/applications/{application_id}"
            )
            response.raise_for_status()
            return response.json()

    # ==================== SKU APIs ====================

    def list_skus(
        self,
        category_id: int | None = None,
        keyword: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """获取物料列表"""
        params = {"page": page, "page_size": page_size}
        if category_id:
            params["category_id"] = category_id
        if keyword:
            params["keyword"] = keyword

        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/skus", params=params)
            response.raise_for_status()
            return response.json()

    async def list_skus_async(
        self,
        category_id: int | None = None,
        keyword: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """获取物料列表（异步）"""
        params = {"page": page, "page_size": page_size}
        if category_id:
            params["category_id"] = category_id
        if keyword:
            params["keyword"] = keyword

        async with await self._get_async_client() as client:
            response = await client.get(f"{self.base_url}/api/v1/skus", params=params)
            response.raise_for_status()
            return response.json()

    def get_sku(self, sku_id: int) -> dict[str, Any]:
        """获取物料详情"""
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/skus/{sku_id}")
            response.raise_for_status()
            return response.json()

    # ==================== Asset APIs ====================

    def list_assets(
        self,
        sku_id: int | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """获取资产列表"""
        params = {"page": page, "page_size": page_size}
        if sku_id:
            params["sku_id"] = sku_id
        if status:
            params["status"] = status

        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/assets", params=params)
            response.raise_for_status()
            return response.json()

    def get_asset(self, asset_id: int) -> dict[str, Any]:
        """获取资产详情"""
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/assets/{asset_id}")
            response.raise_for_status()
            return response.json()

    def get_asset_by_sn(self, sn: str) -> dict[str, Any]:
        """通过序列号获取资产"""
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/assets/sn/{sn}")
            response.raise_for_status()
            return response.json()

    # ==================== Stock APIs ====================

    def get_sku_stock(self, sku_id: int) -> dict[str, Any]:
        """获取 SKU 库存"""
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/stock/sku/{sku_id}")
            response.raise_for_status()
            return response.json()

    def list_sku_stocks(
        self,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """获取所有 SKU 库存"""
        params = {"page": page, "page_size": page_size}
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/stock/skus", params=params)
            response.raise_for_status()
            return response.json()

    # ==================== Organization APIs ====================

    def list_departments(self, parent_id: int | None = None) -> dict[str, Any]:
        """获取部门列表"""
        params = {}
        if parent_id is not None:
            params["parent_id"] = parent_id
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/departments", params=params)
            response.raise_for_status()
            return response.json()

    def get_department(self, department_id: int) -> dict[str, Any]:
        """获取部门详情"""
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/departments/{department_id}")
            response.raise_for_status()
            return response.json()

    def list_users(
        self,
        department_id: int | None = None,
        keyword: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """获取用户列表"""
        params = {"page": page, "page_size": page_size}
        if department_id:
            params["department_id"] = department_id
        if keyword:
            params["keyword"] = keyword
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/users", params=params)
            response.raise_for_status()
            return response.json()

    def get_user(self, user_id: int) -> dict[str, Any]:
        """获取用户详情"""
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/users/{user_id}")
            response.raise_for_status()
            return response.json()

    def get_user_by_username(self, username: str) -> dict[str, Any]:
        """通过用户名获取用户"""
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/users/username/{username}")
            response.raise_for_status()
            return response.json()

    # ==================== Portal APIs ====================

    def list_announcements(
        self,
        is_active: bool | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """获取公告列表"""
        params = {"page": page, "page_size": page_size}
        if is_active is not None:
            params["is_active"] = is_active
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/announcements", params=params)
            response.raise_for_status()
            return response.json()

    def get_announcement(self, announcement_id: int) -> dict[str, Any]:
        """获取公告详情"""
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/announcements/{announcement_id}")
            response.raise_for_status()
            return response.json()

    def list_hero_banners(self, is_active: bool | None = None) -> dict[str, Any]:
        """获取首页横幅列表"""
        params = {}
        if is_active is not None:
            params["is_active"] = is_active
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/hero-banners", params=params)
            response.raise_for_status()
            return response.json()

    # ==================== Notification APIs ====================

    def list_notification_outbox(
        self,
        status: str | None = None,
        channel: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """获取通知发件箱列表"""
        params = {"page": page, "page_size": page_size}
        if status:
            params["status"] = status
        if channel:
            params["channel"] = channel
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/notifications/outbox", params=params)
            response.raise_for_status()
            return response.json()

    def list_user_addresses(self, user_id: int | None = None) -> dict[str, Any]:
        """获取用户地址列表"""
        params = {}
        if user_id:
            params["user_id"] = user_id
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/user-addresses", params=params)
            response.raise_for_status()
            return response.json()

    # ==================== RBAC APIs ====================

    def list_roles(self) -> dict[str, Any]:
        """获取角色列表"""
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/roles")
            response.raise_for_status()
            return response.json()

    def get_role(self, role_id: int) -> dict[str, Any]:
        """获取角色详情"""
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/roles/{role_id}")
            response.raise_for_status()
            return response.json()

    def get_role_permissions(self, role_id: int) -> dict[str, Any]:
        """获取角色权限"""
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/roles/{role_id}/permissions")
            response.raise_for_status()
            return response.json()

    def list_permissions(self) -> dict[str, Any]:
        """获取权限列表"""
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/permissions")
            response.raise_for_status()
            return response.json()

    def list_user_roles(self, user_id: int | None = None) -> dict[str, Any]:
        """获取用户角色列表"""
        params = {}
        if user_id:
            params["user_id"] = user_id
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/user-roles", params=params)
            response.raise_for_status()
            return response.json()

    def list_ui_guards(self) -> dict[str, Any]:
        """获取UI权限守卫列表"""
        with self._get_client() as client:
            response = client.get(f"{self.base_url}/api/v1/ui-guards")
            response.raise_for_status()
            return response.json()


# 单例客户端实例
_data_service_client: DataServiceClient | None = None


def get_data_service_client() -> DataServiceClient:
    """获取 Data Service 客户端单例"""
    global _data_service_client
    if _data_service_client is None:
        _data_service_client = DataServiceClient()
    return _data_service_client
