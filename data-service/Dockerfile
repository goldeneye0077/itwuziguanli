# ============================================================
# 阶段 1: 构建依赖
# ============================================================
FROM python:3.12-slim AS builder

# 安装编译依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制依赖文件，利用 Docker 层缓存
COPY pyproject.toml ./

# 安装 Python 依赖
RUN pip install --no-cache-dir --upgrade pip wheel \
    && pip install --no-cache-dir .

# ============================================================
# 阶段 2: 运行镜像
# ============================================================
FROM python:3.12-slim AS runner

# 安装运行时依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/* \
    # 创建非 root 用户
    && useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# 从 builder 阶段复制已安装的 Python 包
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 复制应用代码
COPY --chown=appuser:appuser . .

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
