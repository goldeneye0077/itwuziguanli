# Step 21 Handover Operations Manual

- Date: 2026-02-07
- Scope: Step 21 only (handover docs + operation manualization)
- Baseline assets:
  - `deploy/docker-compose.yml`
  - `.github/workflows/step20-canary-rollback.yml`
  - `deploy/scripts/canary-deploy.sh`
  - `deploy/scripts/canary-rollback.sh`

## 1) Audience and responsibilities

| Role | Owner placeholder | Core responsibility | Escalation trigger |
|---|---|---|---|
| L1 On-call (Ops) | `<oncall-ops>` | First response, health/log checks, incident ticketing | Any P1/P2 symptom persists >10 min |
| L2 Backend owner | `<backend-owner>` | API/service diagnosis and fix decision | backend health/API path failure |
| L2 Frontend owner | `<frontend-owner>` | Frontend availability and smoke verification | frontend/nginx route failure |
| L3 Release manager | `<release-manager>` | Rollback approval, external communication | rollback decision or multi-team incident |

## 2) Handover asset map

| Asset | Path | Usage |
|---|---|---|
| Startup baseline | `README.md` | Local/container startup and health commands |
| Compose baseline | `deploy/docker-compose.yml` | Runtime services and healthcheck definitions |
| Canary workflow | `.github/workflows/step20-canary-rollback.yml` | Manual canary deploy/rollback via `workflow_dispatch` |
| Canary deploy script | `deploy/scripts/canary-deploy.sh` | Local/script-based canary deploy fallback |
| Canary rollback script | `deploy/scripts/canary-rollback.sh` | Local/script-based rollback fallback |
| Step 20 acceptance evidence | `docs/acceptance/step20-release-rollback-report.md` | Prior canary/rollback implementation and gates |

## 3) Day-1 operation checklist (handover day)

1. Environment and baseline verification
   - [ ] Confirm `bun` and `docker` are available.
   - [ ] Verify compose schema:

     ```bash
     docker compose -f deploy/docker-compose.yml config
     ```

   - [ ] Run quality gates:

     ```bash
     bun run build && bun test && bun run test
     ```

2. Service startup and health verification
   - [ ] Start stack:

     ```bash
     docker compose -f deploy/docker-compose.yml up -d --build
     ```

   - [ ] Check service status:

     ```bash
     docker compose -f deploy/docker-compose.yml ps
     ```

   - [ ] Verify health endpoints:

     ```bash
     curl http://127.0.0.1:18000/healthz
     curl http://127.0.0.1:18080/healthz
     ```

3. Step 20 canary/rollback path readiness
   - [ ] Confirm workflow file exists: `.github/workflows/step20-canary-rollback.yml`.
   - [ ] Confirm scripts exist and are executable in CI context:
     - `deploy/scripts/canary-deploy.sh`
     - `deploy/scripts/canary-rollback.sh`
   - [ ] Confirm default rollback mode is non-destructive (`CANARY_REMOVE_VOLUMES=0`).

4. Handover sign-off
   - [ ] L1 on-call receives this manual and playbook.
   - [ ] L2/L3 owners confirm escalation contacts.
   - [ ] Ticket/status page updated with Step 21 handover completion note.

## 4) Day-2 operation checklist (steady-state)

### Daily

- [ ] Service status check:

  ```bash
  docker compose -f deploy/docker-compose.yml ps
  ```

- [ ] Critical service logs check:

  ```bash
  docker compose -f deploy/docker-compose.yml logs --tail=200 backend
  docker compose -f deploy/docker-compose.yml logs --tail=200 nginx
  ```

- [ ] Health endpoint check:

  ```bash
  curl http://127.0.0.1:18000/healthz
  curl http://127.0.0.1:18080/healthz
  ```

### Weekly

- [ ] Re-run project command gates:

  ```bash
  bun run build && bun test && bun run test
  ```

- [ ] Run one non-production canary rollback drill based on Step 20 assets.
- [ ] Verify current manual still matches actual paths/commands.

### Monthly

- [ ] Review incident records and rollback drills; update playbook if drift is found.
- [ ] Reconfirm escalation owners/contact channels are valid.

## 5) Escalation path and SLA

| Severity | Definition | Initial action SLA | Escalation path |
|---|---|---|---|
| P1 | Core API or entry route unavailable, user flow blocked | 5 min | L1 -> L2 backend/frontend -> L3 release manager |
| P2 | Partial degradation, workaround exists | 15 min | L1 -> module owner -> L3 if >30 min unresolved |
| P3 | Minor defect/document drift | 1 business day | L1 creates issue and schedules fix |

Escalation channels (to be filled):

- Ops channel: `<ops-channel>`
- Incident bridge: `<bridge-url-or-room>`
- Business notification owner: `<biz-owner>`

## 6) Canary deploy/rollback quick entry

Preferred path: run workflow `.github/workflows/step20-canary-rollback.yml` with `workflow_dispatch`.

Local fallback commands:

```bash
# Canary deploy
COMPOSE_FILE=deploy/docker-compose.yml \
CANARY_PROJECT=step20-canary \
CANARY_SERVICES="backend frontend nginx" \
CANARY_BUILD=1 \
CANARY_WAIT_HEALTH=1 \
deploy/scripts/canary-deploy.sh

# Canary rollback (non-destructive by default)
COMPOSE_FILE=deploy/docker-compose.yml \
CANARY_PROJECT=step20-canary \
CANARY_REMOVE_VOLUMES=0 \
deploy/scripts/canary-rollback.sh
```

## 7) Known operational constraints

1. Frontend `build/test` scripts are placeholder-style in current repository; operation checks should treat them as command-gate evidence, not runtime quality proof.
2. Markdown/YAML LSP diagnostics are environment-constrained in this Windows runtime; command evidence (`bun` gates and `docker compose config`) is the primary acceptance baseline.
