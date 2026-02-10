FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN pip install --no-cache-dir \
    "fastapi>=0.116.0" \
    "uvicorn>=0.35.0" \
    "sqlalchemy>=2.0.37" \
    "alembic>=1.14.0" \
    "celery>=5.4.0" \
    "redis>=5.0.0" \
    "pymysql>=1.1.1" \
    "cryptography>=43.0.0" \
    "python-multipart>=0.0.9"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
