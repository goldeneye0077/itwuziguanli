import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+pysqlite:///./it_assets.db")


def _connect_args(database_url: str) -> dict[str, object]:
    """根据数据库类型返回不同的连接参数"""
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    # PostgreSQL 连接参数
    if database_url.startswith("postgresql"):
        return {
            "connect_timeout": 10,
            "options": "-c search_path=public",  # 指定 schema
        }
    # MySQL 连接参数
    if database_url.startswith("mysql"):
        return {"connect_timeout": 10}
    return {}


def _get_engine_config(database_url: str) -> dict[str, object]:
    """根据数据库类型返回不同的引擎配置"""
    config = {
        "pool_pre_ping": True,
        "connect_args": _connect_args(database_url),
    }

    # PostgreSQL 连接池配置
    if database_url.startswith("postgresql"):
        config.update({
            "pool_size": 20,          # 常规连接池大小
            "max_overflow": 10,       # 允许超出的连接数
            "pool_timeout": 30,       # 获取连接超时时间（秒）
            "pool_recycle": 3600,     # 连接回收时间（1小时）
            "pool_pre_ping": True,    # 每次获取连接前检测连接是否有效
        })
    # MySQL 连接池配置
    elif database_url.startswith("mysql"):
        config.update({
            "pool_size": 10,
            "max_overflow": 20,
            "pool_timeout": 30,
            "pool_recycle": 1800,
        })

    return config


engine: Engine = create_engine(
    DATABASE_URL,
    **_get_engine_config(DATABASE_URL),
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=Session,
)


def get_db_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
