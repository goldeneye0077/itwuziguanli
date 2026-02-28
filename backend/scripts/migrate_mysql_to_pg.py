"""
MySQL 到 PostgreSQL 数据迁移脚本

使用方法:
    # 设置环境变量
    export MYSQL_URL="mysql+pymysql://user:password@host:port/db"
    export PG_URL="postgresql+psycopg2://user:password@host:port/db"

    # 运行迁移
    python scripts/migrate_mysql_to_pg.py
"""
import os
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker


def get_mysql_url() -> str:
    """获取 MySQL 连接 URL"""
    return os.getenv(
        "MYSQL_URL",
        "mysql+pymysql://it_assets_user:change_me_mysql_password@localhost:13306/it_assets"
    )


def get_pg_url() -> str:
    """获取 PostgreSQL 连接 URL"""
    return os.getenv(
        "PG_URL",
        "postgresql+psycopg2://it_assets_user:change_me_pg_password@localhost:15432/it_assets"
    )


def get_tables(mysql_engine) -> list[str]:
    """获取所有表名"""
    inspector = inspect(mysql_engine)
    return inspector.get_table_names()


def migrate_table(mysql_conn, pg_conn, table_name: str, batch_size: int = 1000):
    """迁移单个表的数据"""
    print(f"  迁移表: {table_name}...")

    # 获取表结构
    columns = mysql_conn.execute(text(f"SHOW COLUMNS FROM {table_name}")).fetchall()
    column_names = [col[0] for col in columns]

    # 获取数据
    result = mysql_conn.execute(text(f"SELECT * FROM {table_name}"))
    rows = result.fetchall()

    if not rows:
        print(f"    - 表 {table_name} 无数据，跳过")
        return 0

    # 插入数据
    placeholders = ", ".join([f":{col}" for col in column_names])
    insert_stmt = text(
        f"INSERT INTO {table_name} ({', '.join(column_names)}) VALUES ({placeholders})"
    )

    migrated = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        for row in batch:
            try:
                data = dict(zip(column_names, row))
                pg_conn.execute(insert_stmt, data)
                migrated += 1
            except Exception as e:
                print(f"    - 插入第 {i + migrated} 条记录失败: {e}")

    pg_conn.commit()
    print(f"    - 成功迁移 {migrated} 条记录")
    return migrated


def create_tables(pg_engine):
    """在 PostgreSQL 中创建表结构"""
    print("\n创建表结构...")

    # 使用 SQLAlchemy 的 create_all
    from app.db.base import Base
    import app.models

    Base.metadata.create_all(bind=pg_engine)
    print("表结构创建完成")


def verify_data(mysql_engine, pg_engine) -> dict[str, dict]:
    """验证数据一致性"""
    print("\n验证数据一致性...")

    mysql_tables = get_tables(mysql_engine)
    results = {}

    for table in mysql_tables:
        mysql_count = mysql_engine.connect().execute(
            text(f"SELECT COUNT(*) FROM {table}")
        ).scalar()

        pg_count = pg_engine.connect().execute(
            text(f"SELECT COUNT(*) FROM {table}")
        ).scalar()

        results[table] = {
            "mysql": mysql_count,
            "pg": pg_count,
            "match": mysql_count == pg_count
        }

        status = "✓" if mysql_count == pg_count else "✗"
        print(f"  {status} {table}: MySQL={mysql_count}, PG={pg_count}")

    return results


def main():
    """主函数"""
    print("=" * 50)
    print("MySQL -> PostgreSQL 数据迁移工具")
    print("=" * 50)

    mysql_url = get_mysql_url()
    pg_url = get_pg_url()

    print(f"\nMySQL URL: {mysql_url.split('@')[0]}@...")
    print(f"PG URL: {pg_url.split('@')[0]}@...")

    # 创建引擎
    mysql_engine = create_engine(mysql_url, pool_pre_ping=True)
    pg_engine = create_engine(pg_url, pool_pre_ping=True)

    # 测试连接
    print("\n测试数据库连接...")
    try:
        with mysql_engine.connect() as conn:
            print("  ✓ MySQL 连接成功")
    except Exception as e:
        print(f"  ✗ MySQL 连接失败: {e}")
        return

    try:
        with pg_engine.connect() as conn:
            print("  ✓ PostgreSQL 连接成功")
    except Exception as e:
        print(f"  ✗ PostgreSQL 连接失败: {e}")
        return

    # 获取表列表
    tables = get_tables(mysql_engine)
    print(f"\n发现 {len(tables)} 个表: {', '.join(tables)}")

    # 确认迁移
    print("\n确认开始迁移? (y/n): ", end="")
    if input().lower() != 'y':
        print("已取消")
        return

    # 创建表结构
    # 注意：这里需要从 backend 导入 models
    # 由于路径问题，这里暂时跳过，由 Alembic 迁移来处理
    print("\n跳过表结构创建，请先运行: alembic upgrade head")

    # 迁移数据
    print("\n开始迁移数据...")
    total_migrated = 0

    with mysql_engine.connect() as mysql_conn, \
         pg_engine.connect() as pg_conn:

        for table in tables:
            count = migrate_table(mysql_conn, pg_conn, table)
            total_migrated += count

    print(f"\n数据迁移完成，共迁移 {total_migrated} 条记录")

    # 验证数据
    results = verify_data(mysql_engine, pg_engine)

    # 总结
    all_match = all(r["match"] for r in results.values())
    print("\n" + "=" * 50)
    if all_match:
        print("✓ 数据迁移验证通过")
    else:
        print("✗ 部分数据不一致，请检查")
    print("=" * 50)


if __name__ == "__main__":
    main()
