from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db.session import engine
from app.db.base import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时创建表
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="IT Asset Data Service",
    description="数据访问微服务 - 提供 CRUD 操作接口",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/healthz")
def healthz():
    """健康检查"""
    return {"status": "ok", "service": "data-service"}


# 导入并注册路由（延迟导入避免循环依赖）
from app.routers import application, sku, asset, stock, organization, portal, notification, rbac

app.include_router(application.router, prefix="/api/v1", tags=["Application"])
app.include_router(sku.router, prefix="/api/v1", tags=["SKU"])
app.include_router(asset.router, prefix="/api/v1", tags=["Asset"])
app.include_router(stock.router, prefix="/api/v1", tags=["Stock"])
app.include_router(organization.router, prefix="/api/v1", tags=["Organization"])
app.include_router(portal.router, prefix="/api/v1", tags=["Portal"])
app.include_router(notification.router, prefix="/api/v1", tags=["Notification"])
app.include_router(rbac.router, prefix="/api/v1", tags=["RBAC"])
