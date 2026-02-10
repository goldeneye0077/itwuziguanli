# IT Asset Lifecycle

## Startup (Docker Compose)

```bash
cp backend/.env.example deploy/.env
cd deploy
docker compose config
docker compose up -d --build
```

Services started by this stack:

- `mysql`
- `redis`
- `minio`
- `backend`
- `frontend`
- `nginx`
- `celery_worker`
- `celery_beat`

Useful checks:

```bash
docker compose ps
curl http://127.0.0.1:18000/healthz
curl http://127.0.0.1:18080/healthz
```
