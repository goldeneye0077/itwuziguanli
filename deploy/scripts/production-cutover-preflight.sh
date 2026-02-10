#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[production-cutover-preflight] %s\n' "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

check_command() {
  local cmd="$1"

  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "required command not found in PATH: $cmd"
  fi
}

check_file() {
  local path="$1"

  if [ ! -f "$path" ]; then
    fail "required file not found: $path"
  fi
}

check_executable() {
  local path="$1"

  if [ ! -x "$path" ]; then
    fail "required executable bit missing: $path"
  fi
}

log "checking required tooling"
check_command bash
check_command bun
check_command docker
check_command python

log "checking required Step 20/21/22 assets"
required_files=(
  "deploy/docker-compose.yml"
  ".github/workflows/step20-canary-rollback.yml"
  "deploy/scripts/canary-deploy.sh"
  "deploy/scripts/canary-rollback.sh"
  "docs/operations/handover-operations-manual.md"
  "docs/operations/incident-and-rollback-playbook.md"
  "docs/operations/production-cutover-runbook.md"
  "docs/acceptance/step20-release-rollback-report.md"
  "docs/acceptance/step21-handover-report.md"
  "docs/acceptance/step22-production-cutover-closeout.md"
)

for path in "${required_files[@]}"; do
  check_file "$path"
done

log "checking canary script executability and shell syntax"
check_executable "deploy/scripts/canary-deploy.sh"
check_executable "deploy/scripts/canary-rollback.sh"

bash -n "deploy/scripts/canary-deploy.sh"
bash -n "deploy/scripts/canary-rollback.sh"

log "checking compose configuration gate (non-destructive)"
docker compose -f "deploy/docker-compose.yml" config >/dev/null

log "checking command gate script readiness from package.json"
python - <<'PY'
import json
import sys

with open("package.json", "r", encoding="utf-8") as fh:
    payload = json.load(fh)

scripts = payload.get("scripts", {})
required = ["build", "test"]
missing = [name for name in required if name not in scripts]

if missing:
    print("missing script keys:", ", ".join(missing))
    sys.exit(1)

print("script keys present:", ", ".join(required))
PY

log "preflight PASS: production cutover prerequisites are ready"
