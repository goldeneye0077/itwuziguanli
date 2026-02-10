# Step 21 Incident and Rollback Playbook

- Date: 2026-02-07
- Scope: Incident response and rollback operations for current repository baseline.
- Step 20 linked assets:
  - `.github/workflows/step20-canary-rollback.yml`
  - `deploy/scripts/canary-deploy.sh`
  - `deploy/scripts/canary-rollback.sh`

## 1) Scope and boundaries

This playbook covers:

1. Incident triage and escalation for the Compose-based stack.
2. Canary rollback actions defined in Step 20 artifacts.
3. Evidence capture for acceptance and postmortem.

This playbook does not execute Step 22 production cutover tasks.

## 2) Severity model and rollback triggers

| Severity | Trigger examples | Target action |
|---|---|---|
| P1 | `http://127.0.0.1:18080/healthz` or `http://127.0.0.1:18000/healthz` continuously unavailable; core business flow blocked | Start rollback decision in <=5 min |
| P2 | Partial route/module degradation with workaround | Stabilize and evaluate rollback in <=15 min |
| P3 | Non-critical defect or document drift | Record and schedule fix |

Rollback trigger checklist (any item can trigger rollback approval):

- [ ] Canary deploy finished but health check does not recover within agreed window.
- [ ] Logs show sustained runtime errors and on-call cannot recover with safe restart.
- [ ] Release manager (`<release-manager>`) confirms user impact requires immediate rollback.

## 3) Escalation path

| Stage | Owner placeholder | SLA | Output |
|---|---|---|---|
| L1 triage | `<oncall-ops>` | 0-5 min | Incident ticket + first health/log snapshot |
| L2 diagnosis | `<backend-owner>` / `<frontend-owner>` | 5-15 min | Recovery or rollback recommendation |
| L3 decision | `<release-manager>` | <=20 min | Final action decision + communication |

Communication channels (fill before first drill):

- Incident chat: `<incident-channel>`
- Voice bridge: `<incident-bridge>`
- Stakeholder notification owner: `<biz-comm-owner>`

## 4) First 15-minute triage checklist (Day-1 incident readiness)

1. Create incident context
   - [ ] Record timestamp, operator, impacted environment.
   - [ ] Record latest release/canary action.
2. Run health and status checks

   ```bash
   docker compose -f deploy/docker-compose.yml ps
   curl http://127.0.0.1:18000/healthz
   curl http://127.0.0.1:18080/healthz
   ```

3. Capture logs

   ```bash
   docker compose -f deploy/docker-compose.yml logs --tail=200 backend
   docker compose -f deploy/docker-compose.yml logs --tail=200 nginx
   ```

4. Decide: recover in place or rollback via Step 20 path.

## 5) Rollback execution runbook

### 5.1 Preferred: GitHub Actions workflow dispatch

1. Open workflow `.github/workflows/step20-canary-rollback.yml` in Actions UI.
2. Run `workflow_dispatch` with:
   - `action=rollback`
   - `canary_project=step20-canary` (or active canary project)
   - `compose_file=deploy/docker-compose.yml`
   - `canary_remove_volumes=0` (default non-destructive)
3. Wait for workflow job completion.
4. Save action summary as incident evidence.

### 5.2 Fallback: local script execution

```bash
COMPOSE_FILE=deploy/docker-compose.yml \
CANARY_PROJECT=step20-canary \
CANARY_REMOVE_VOLUMES=0 \
deploy/scripts/canary-rollback.sh
```

If storage cleanup is explicitly approved:

```bash
COMPOSE_FILE=deploy/docker-compose.yml \
CANARY_PROJECT=step20-canary \
CANARY_REMOVE_VOLUMES=1 \
deploy/scripts/canary-rollback.sh
```

## 6) Post-rollback verification

- [ ] Check stack status and confirm no unexpected residual canary resources.
- [ ] Re-check critical health endpoints:

  ```bash
  curl http://127.0.0.1:18000/healthz
  curl http://127.0.0.1:18080/healthz
  ```

- [ ] Record command outputs and incident closure status.
- [ ] Notify stakeholders with rollback result and next-safe-change window.

## 7) Day-2 incident operations checklist

### Daily

- [ ] Review open incidents and pending action items.
- [ ] Confirm escalation roster placeholders are up to date.

### Weekly

- [ ] Run one tabletop drill using this playbook.
- [ ] Validate Step 20 asset paths and commands still exist:
  - `.github/workflows/step20-canary-rollback.yml`
  - `deploy/scripts/canary-deploy.sh`
  - `deploy/scripts/canary-rollback.sh`

### Monthly

- [ ] Review incidents for recurring causes and update runbook.
- [ ] Confirm rollback defaults remain non-destructive unless explicitly approved.

## 8) Incident record template

```text
Incident ID:
Start time:
Severity:
Detected by:
Impacted scope:
Triage commands executed:
Rollback decision owner:
Rollback path: workflow_dispatch | local script
Rollback command/workflow run URL:
Verification result:
Follow-up actions:
```
