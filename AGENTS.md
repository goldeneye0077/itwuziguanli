# 仓库级规则（Repo-Local）

本文件对本仓库内的所有 Agent 生效。

## 强制：任何改动必须使用 planning-with-files

只要要对工作区做**任何**改动（新增/修改/删除文件、调整配置、生成产物等），必须执行 `planning-with-files` 流程。

规划文件（必须放在仓库根目录）：`task_plan.md`、`findings.md`、`progress.md`。

工作流（只要发生改动就必须遵守）：
1. 在首次写入/编辑前：
   在 `task_plan.md` 写清楚目标（Goal）与当前阶段（Current Phase）。
   在 `findings.md` 记录需求与已确认的发现/决策。
2. 工作过程中：
   在 `progress.md` 记录做了什么（包含命令与测试）。
   遇到错误必须同时记录在 `task_plan.md` 与 `progress.md`（含解决方式）。
3. 在结束本次任务/回合前：
   确认三份文件已反映最新状态（阶段、决策、测试结果）。

仅当任务完全只读（不产生任何工作区改动）时，才允许跳过更新。

## 强制：所有文档撰写使用中文

本仓库内所有“文档类内容”默认使用中文撰写，包括但不限于：
- `README.md`、`docs/**` 下的 Markdown 文档
- `task_plan.md`、`findings.md`、`progress.md` 等过程文档
- 任何新增的说明性 Markdown（含 ADR/设计说明/运维手册等）

允许保留的非中文内容：
- 代码标识符、命令、路径、配置键名、API 字段名等技术元素（应保持原样）
- 业内通用专有名词（如需英文更清晰可保留英文，但叙述性文本仍用中文）

## 强制：会话结束自动刷新 Docker（确保测试最新）

目标：避免“容器仍在跑旧镜像/旧构建产物”导致测试看到的不是最新版本。

触发条件（满足任一即必须刷新）：
- 本回合对运行相关内容有改动，包括但不限于：`backend/**`、`frontend/**`、`deploy/**`、`openapi/**`、`package.json`
- 本回合明确要进行页面/API 验证（即使改动范围不大）

允许跳过刷新（必须同时满足）：
- 本回合改动仅限文档（如 `docs/**`、`README.md`、`*.md`）
- 且不涉及任何运行行为变化
- 且在 `progress.md` 明确记录“本回合纯文档改动，未刷新 Docker”

刷新流程（默认全量，Agent 在回合结束前自动执行）：
1. 执行刷新命令（推荐）：
   - `docker compose -f deploy/docker-compose.yml up -d --build --force-recreate backend frontend nginx celery_worker celery_beat`
2. 健康检查（必须通过）：
   - `GET http://127.0.0.1:18080/healthz` 返回 `ok`
   - `GET http://127.0.0.1:18080/api/healthz` 返回 `{"status":"ok"}`

脚本化（优先使用，便于标准化输出与失败定位）：
- Windows PowerShell：`deploy/scripts/refresh-dev.ps1`

记录要求：
- 在 `progress.md` 记录：执行命令、健康检查结果（PASS/FAIL）、以及失败时的排查与修复。

安全边界（未经用户明确要求，禁止自动执行）：
- `docker compose down -v`
- `docker volume rm`
- `docker system prune`
- `docker image prune -a`
