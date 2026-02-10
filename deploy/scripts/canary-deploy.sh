#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[canary-deploy] %s\n' "$*"
}

if ! command -v docker >/dev/null 2>&1; then
  log "docker is required but was not found in PATH."
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.yml}"
CANARY_PROJECT="${CANARY_PROJECT:-step20-canary}"
CANARY_SERVICES="${CANARY_SERVICES:-backend frontend nginx}"
CANARY_BUILD="${CANARY_BUILD:-1}"
CANARY_WAIT_HEALTH="${CANARY_WAIT_HEALTH:-1}"
CANARY_HEALTH_TIMEOUT="${CANARY_HEALTH_TIMEOUT:-120}"

export MYSQL_PORT="${MYSQL_PORT:-23306}"
export REDIS_PORT="${REDIS_PORT:-26379}"
export MINIO_API_PORT="${MINIO_API_PORT:-29000}"
export MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-29001}"
export BACKEND_PORT="${BACKEND_PORT:-28000}"
export FRONTEND_PORT="${FRONTEND_PORT:-23000}"
export NGINX_PORT="${NGINX_PORT:-28080}"

if [ ! -f "$COMPOSE_FILE" ]; then
  log "compose file not found: $COMPOSE_FILE"
  exit 1
fi

log "validating compose config for project $CANARY_PROJECT"
docker compose -p "$CANARY_PROJECT" -f "$COMPOSE_FILE" config >/dev/null

set -- -d --remove-orphans
if [ "$CANARY_BUILD" = "1" ]; then
  set -- "$@" --build
fi

if [ -n "${CANARY_SERVICES// }" ]; then
  # shellcheck disable=SC2086
  docker compose -p "$CANARY_PROJECT" -f "$COMPOSE_FILE" up "$@" $CANARY_SERVICES
else
  docker compose -p "$CANARY_PROJECT" -f "$COMPOSE_FILE" up "$@"
fi

if [ "$CANARY_WAIT_HEALTH" != "1" ]; then
  log "deployment command completed (health wait disabled)"
  exit 0
fi

CANARY_HEALTH_URL="${CANARY_HEALTH_URL:-http://127.0.0.1:${NGINX_PORT}/healthz}"

probe_health() {
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS --max-time 2 "$CANARY_HEALTH_URL" >/dev/null; then
      return 0
    fi

    return 1
  fi

  if command -v wget >/dev/null 2>&1; then
    if wget -q -T 2 -O - "$CANARY_HEALTH_URL" >/dev/null; then
      return 0
    fi

    return 1
  fi

  return 2
}

log "waiting for canary health: $CANARY_HEALTH_URL (timeout ${CANARY_HEALTH_TIMEOUT}s)"
deadline=$(( $(date +%s) + CANARY_HEALTH_TIMEOUT ))

while [ "$(date +%s)" -le "$deadline" ]; do
  if probe_health; then
    log "canary stack is healthy"
    exit 0
  fi

  probe_code=$?
  if [ "$probe_code" -eq 2 ]; then
    log "curl/wget unavailable, skipping health probe"
    exit 0
  fi

  sleep 2
done

log "health check timed out"
docker compose -p "$CANARY_PROJECT" -f "$COMPOSE_FILE" ps || true
exit 1
