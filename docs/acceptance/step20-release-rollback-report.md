# Step 20 Release and Rollback Acceptance Report

- Date: 2026-02-07
- Scope: Step 20 only (manual gray release + rollback path)
- Deliverables:
  - `.github/workflows/step20-canary-rollback.yml`
  - `deploy/scripts/canary-deploy.sh`
  - `deploy/scripts/canary-rollback.sh`

## 1) Acceptance Criteria

1. Workflow supports manual canary deploy and manual rollback.
2. Deploy/rollback scripts are safe-by-default and idempotent/best-effort.
3. Required command gates pass:
   - `bun run build && bun test && bun run test`
   - `docker compose -f deploy/docker-compose.yml config`

## 2) Implementation Summary

### 2.1 Workflow

- Added `workflow_dispatch` workflow `step20-canary-rollback.yml` with explicit `action` input (`deploy` / `rollback`).
- Inputs include: `canary_project`, `compose_file`, and action-specific controls (`canary_services`, `canary_build`, `canary_wait_health`, `canary_remove_volumes`).
- Workflow validates compose config before invoking scripts and writes action parameters to `$GITHUB_STEP_SUMMARY`.

### 2.2 Canary deploy script

- `deploy/scripts/canary-deploy.sh`:
  - Uses `set -euo pipefail`.
  - Validates docker and compose file availability.
  - Runs `docker compose config` gate before deploy.
  - Uses isolated compose project (`CANARY_PROJECT`) and default high localhost ports to reduce collision risk.
  - Uses `docker compose up -d --remove-orphans` (plus optional `--build`).
  - Optional health wait loop (`/healthz`) with timeout.

Idempotency behavior:
- Re-running deploy with the same project is safe (`up -d` reconciles to desired state).
- Health wait can be disabled for fast/manual scenarios.

### 2.3 Canary rollback script

- `deploy/scripts/canary-rollback.sh`:
  - Uses `set -euo pipefail`.
  - Handles missing compose file as non-fatal skip (best-effort safety).
  - Runs `docker compose down --remove-orphans` with optional volume removal (`CANARY_REMOVE_VOLUMES=1`).
  - Performs best-effort cleanup of remaining containers/networks (and volumes when enabled) scoped by compose project label.

Best-effort behavior:
- Rollback continues even if services are partially absent or `down` returns non-zero.

## 3) Manual Operation Runbook

Deploy canary:

```bash
action=deploy
canary_project=step20-canary
compose_file=deploy/docker-compose.yml
canary_services="backend frontend nginx"
```

Rollback canary:

```bash
action=rollback
canary_project=step20-canary
compose_file=deploy/docker-compose.yml
canary_remove_volumes=0
```

## 4) Command Evidence

### 4.1 Build and tests

Command:

```bash
bun run build && bun test && bun run test
```

Result: PASS

- `bun run build` completed (`build:backend` compileall + frontend placeholder build command).
- `bun test` completed: `1 pass / 0 fail`.
- `bun run test` completed:
  - backend pytest: `31 passed in 2.42s`
  - frontend placeholder test command completed.

### 4.2 Deploy compose config gate

Command:

```bash
docker compose -f deploy/docker-compose.yml config
```

Result: PASS (compose rendered successfully with no schema errors).

## 5) Assumptions and Constraints

1. Gray release uses Docker Compose project isolation (`-p <canary_project>`) as the minimal executable baseline.
2. Default canary ports are intentionally shifted high to reduce conflict with regular local stack ports.
3. Frontend build/test scripts remain placeholder-style in this repository; Step 20 does not extend scope into Step 21/22 remediation.
4. Rollback is best-effort and non-destructive by default (volumes are preserved unless explicitly requested).
5. `lsp_diagnostics` is clean for shell scripts, but yaml/markdown diagnostics are environment-constrained in this Windows runtime; workflow YAML structure was additionally validated via `python + yaml.safe_load`.

## 6) Step 20 Verdict

Step 20 scope is implemented and command gates pass under current project baseline.
