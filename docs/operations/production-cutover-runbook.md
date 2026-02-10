# Step 22 Production Cutover Runbook

- Date: 2026-02-07
- Scope: Step 22 only (production cutover process definition + acceptance closeout artifacts)
- Linked Step 20/21 assets:
  - `.github/workflows/step20-canary-rollback.yml`
  - `deploy/scripts/canary-deploy.sh`
  - `deploy/scripts/canary-rollback.sh`
  - `docs/operations/handover-operations-manual.md`
  - `docs/operations/incident-and-rollback-playbook.md`
- Supporting acceptance evidence:
  - `docs/acceptance/step20-release-rollback-report.md`
  - `docs/acceptance/step21-handover-report.md`

## 1) Purpose and boundaries

This runbook defines production cutover go/no-go gates, timeline, rollback triggers, and sign-off controls.

Boundaries for this Step 22 deliverable:

1. Provide an executable process and non-destructive readiness checks only.
2. Do not mutate production environment in this documentation step.
3. Use Step 20 rollback path and Step 21 operations ownership as the baseline.

## 2) Go/No-Go gates

All gates must be PASS before T0.

| Gate ID | Check | Command / Evidence | Pass condition | Owner |
|---|---|---|---|---|
| G1 | Tooling/path preflight | `bash deploy/scripts/production-cutover-preflight.sh` | Exit code 0 | `<release-operator>` |
| G2 | Command gates | `bun run build && bun test && bun run test` | Exit code 0 | `<qa-owner>` |
| G3 | Canary rollback path is callable | Workflow path `.github/workflows/step20-canary-rollback.yml` and script `deploy/scripts/canary-rollback.sh` confirmed present | Path + command readiness confirmed | `<release-manager>` |
| G4 | Ops handover baseline available | `docs/operations/handover-operations-manual.md` and `docs/operations/incident-and-rollback-playbook.md` reviewed | L1/L2/L3 owners acknowledged | `<ops-lead>` |
| G5 | Acceptance baselines linked | `docs/acceptance/step20-release-rollback-report.md`, `docs/acceptance/step21-handover-report.md` | No unresolved blocker from Step 20/21 | `<project-owner>` |

No-Go policy: any single gate failure blocks T0 and returns cutover status to HOLD.

## 3) Strict cutover timeline template

| Time | Owner | Required actions | Evidence output |
|---|---|---|---|
| T-60 | `<release-operator>` | Run preflight and confirm all prerequisite files/commands/gates are ready. | Preflight output log + exit code |
| T-30 | `<qa-owner>` | Run command gates (`build/test`) and attach command outputs. | Terminal output snapshot |
| T-10 | `<release-manager>` + `<ops-lead>` | Hold go/no-go meeting; verify G1-G5 PASS; freeze non-cutover changes. | Go/No-Go decision record |
| T0 | `<release-manager>` | Execute approved production cutover action in controlled channel (outside this document step). | Change ticket + execution timestamp |
| T+10 | `<oncall-ops>` | Validate health endpoints, service status, and critical logs; compare against pre-cutover baseline. | Health/log checklist results |
| T+30 | `<release-manager>` + `<project-owner>` | Finalize decision: keep release or trigger rollback. Publish stakeholder update. | Closure note or rollback trigger record |

## 4) Rollback trigger and execution path

Trigger rollback immediately if any condition is met after T0:

1. Critical health endpoints remain unavailable for >10 minutes.
2. P1 impact confirmed by L1/L2 with no safe in-place recovery.
3. Release manager confirms user impact exceeds acceptable risk.

Preferred rollback path:

1. Open `.github/workflows/step20-canary-rollback.yml`.
2. Run `workflow_dispatch` with `action=rollback`, `compose_file=deploy/docker-compose.yml`, `canary_remove_volumes=0`.
3. If workflow path is unavailable, execute fallback script `deploy/scripts/canary-rollback.sh` per `docs/operations/incident-and-rollback-playbook.md`.

All rollback actions must be recorded in incident evidence and acceptance closeout.

## 5) Sign-off checklist

- [ ] `<release-operator>`: Preflight output attached.
- [ ] `<qa-owner>`: `bun run build && bun test && bun run test` output attached.
- [ ] `<ops-lead>`: Step 21 manuals acknowledged (`handover-operations-manual.md`, `incident-and-rollback-playbook.md`).
- [ ] `<release-manager>`: Go/No-Go decision signed at T-10 and T+30.
- [ ] `<project-owner>`: Step 22 closeout document approved (`docs/acceptance/step22-production-cutover-closeout.md`).

## 6) Evidence package template

```text
Cutover ticket ID:
Environment:
Operator:
Gate results (G1-G5):
T-60 evidence:
T-30 evidence:
T-10 decision:
T0 execution reference:
T+10 verification:
T+30 closure decision:
Rollback trigger (if any):
```
