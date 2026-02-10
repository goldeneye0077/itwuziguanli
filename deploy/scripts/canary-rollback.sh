#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[canary-rollback] %s\n' "$*"
}

if ! command -v docker >/dev/null 2>&1; then
  log "docker is required but was not found in PATH."
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.yml}"
CANARY_PROJECT="${CANARY_PROJECT:-step20-canary}"
CANARY_REMOVE_VOLUMES="${CANARY_REMOVE_VOLUMES:-0}"
CANARY_TIMEOUT="${CANARY_TIMEOUT:-20}"

if [ ! -f "$COMPOSE_FILE" ]; then
  log "compose file not found: $COMPOSE_FILE (skipping rollback)"
  exit 0
fi

set -- --remove-orphans --timeout "$CANARY_TIMEOUT"
if [ "$CANARY_REMOVE_VOLUMES" = "1" ]; then
  set -- "$@" --volumes
fi

log "attempting compose down for project $CANARY_PROJECT"
if ! docker compose -p "$CANARY_PROJECT" -f "$COMPOSE_FILE" down "$@"; then
  log "compose down returned non-zero; continuing best-effort cleanup"
fi

for container_id in $(docker ps -aq --filter "label=com.docker.compose.project=${CANARY_PROJECT}"); do
  docker rm -f "$container_id" >/dev/null 2>&1 || true
done

for network_id in $(docker network ls -q --filter "label=com.docker.compose.project=${CANARY_PROJECT}"); do
  docker network rm "$network_id" >/dev/null 2>&1 || true
done

if [ "$CANARY_REMOVE_VOLUMES" = "1" ]; then
  for volume_name in $(docker volume ls -q --filter "label=com.docker.compose.project=${CANARY_PROJECT}"); do
    docker volume rm "$volume_name" >/dev/null 2>&1 || true
  done
fi

log "rollback completed (best-effort)"
