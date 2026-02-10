from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .api.v1.api import api_router
from .core.config import get_settings
from .core.exceptions import register_exception_handlers
from .core.logging import get_logger, setup_logging
from .core.middleware import RequestContextMiddleware

settings = get_settings()
logger = get_logger(__name__)
upload_root = Path(settings.upload_dir)
upload_root.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_logging(settings.log_level)
    logger.info(
        "application_startup",
        extra={
            "event": "application.startup",
            "environment": settings.environment,
        },
    )
    yield
    logger.info("application_shutdown", extra={"event": "application.shutdown"})


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(RequestContextMiddleware, header_name=settings.request_id_header)
register_exception_handlers(app)
app.include_router(api_router, prefix="/api/v1")
app.mount("/api/v1/uploads", StaticFiles(directory=str(upload_root)), name="uploads")


@app.get("/healthz", tags=["system"])
def healthz() -> dict[str, str]:
    return {"status": "ok"}
