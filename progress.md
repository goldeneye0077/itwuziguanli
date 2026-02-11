# Progress Log
<!-- 
  WHAT: Your session log - a chronological record of what you did, when, and what happened.
  WHY: Answers "What have I done?" in the 5-Question Reboot Test. Helps you resume after breaks.
  WHEN: Update after completing each phase or encountering errors. More detailed than task_plan.md.
-->

## Session: 2026-02-11

### Task: `/inbound` 按库存模式自动切换表单（解决耗材无 SN 入库）
- **Status:** complete
- **Started:** 2026-02-11
- **Completed:** 2026-02-11
- Actions taken:
  - 更新规划文档：`task_plan.md`、`findings.md`（补充“数量库存不需要 SN，表单随 stockMode 自动切换”）。
  - 调整手工入库卡片（`frontend/src/pages/inbound-manual-import-card.tsx`）：
    - `QUANTITY`：隐藏 SN 录入区；仅填写“入库数量”即可提交入库。
    - `SERIALIZED`：显示 SN 录入区；“入库数量”改为只读并自动等于 SN 条数，避免“数量可随意改”造成困惑。
    - 切换物料时自动清理 SN/数量/导入结果，避免跨物料误用。
    - 数量入库调用补齐 `occurredAt`（使用页面的“入库时间”字段落库存流水）。
  - 验证：
    - `npm --prefix frontend run typecheck`
    - `powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`（`/healthz` 与 `/api/healthz` 通过）
    - `Invoke-WebRequest http://127.0.0.1:18080/inbound` 返回 200
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `frontend/src/pages/inbound-manual-import-card.tsx`

## Session: 2026-02-10

### Phase 1: Requirements & Discovery
- **Status:** in_progress
- **Started:** 2026-02-10
- Actions taken:
  - 确认需求：将根目录 `背景2.avif` 用作 `/dashboard` hero 横幅背景。
  - 读取现有 `DashboardPage` 与 `.dashboard-hero` 样式，准备接入背景图。
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### Task: 侧边栏应用 lucide-react 图标
- **Status:** complete
- **Started:** 2026-02-10
- **Completed:** 2026-02-10
- Actions taken:
  - 更新规划文档：切换本回合目标为“左侧导航应用 lucide-react 图标”。
  - 安装依赖：`npm --prefix frontend install lucide-react`。
  - 侧边栏导航渲染（`frontend/src/routes/app-routes.tsx`）：
    - 引入 `lucide-react` 图标组件，并按 `routePath -> Icon` 映射逐项应用（工作台/商城/购物车/申请/资产/审批/出入库/报表/问答/权限/数据面板等）。
    - 在 `<Link>` 内渲染图标 + 文案，图标 `aria-hidden`，不影响可访问性与高亮逻辑。
  - 样式补齐（`frontend/src/styles/index.css`）：导航项改为 `flex` 对齐并新增 `.app-shell__nav-icon` / `.app-shell__nav-label`。
  - 验证：
    - `npm --prefix frontend run typecheck` 通过
    - `powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1` 刷新容器并通过 `/healthz` 与 `/api/healthz`
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `frontend/src/routes/app-routes.tsx`
  - `frontend/src/styles/index.css`
  - `frontend/package.json`
  - `frontend/package-lock.json`

### Task: Docker 前后端服务重构（deploy）
- **Status:** complete
- **Started:** 2026-02-10
- **Completed:** 2026-02-10
- Actions taken:
  - 盘点 `deploy/docker-compose.yml` / `deploy/.env` / `frontend/Dockerfile` / `frontend/nginx.conf` / `backend/Dockerfile`。
  - 确认当前容器运行与端口映射正常（nginx 18080、backend 18000、frontend 13000，以及 MySQL/Redis/MinIO）。
  - 发现可重构点：celery worker/beat 重复 build 同一份 backend；外层 nginx 使用 heredoc 动态生成配置；默认项目名 `deploy` 的 volumes 为 `deploy_*`，若改项目名需避免数据卷丢失。
  - 新增 `deploy/nginx/default.conf` 并在 compose 中通过 volume 挂载，替换 heredoc 动态生成配置；同时补齐 `GET /api/healthz`（透传到后端 `/healthz`）。
  - 重构 `deploy/docker-compose.yml`：
    - 引入 `x-backend-build` / `x-backend-env`，减少重复配置。
    - `celery_worker`/`celery_beat` 复用 `itwzgl1-backend` 镜像，避免重复 build。
  - 后端配置兼容：`backend/app/core/config.py` 支持 `APP_ENV` 或 `ENVIRONMENT`。
  - 验证与重建：
    - `docker compose -f deploy/docker-compose.yml config`
    - `docker compose -f deploy/docker-compose.yml up -d --build --force-recreate backend nginx celery_worker celery_beat`
    - `docker compose -f deploy/docker-compose.yml restart nginx`
    - `GET http://127.0.0.1:18080/api/healthz` 返回 `{\"status\":\"ok\"}`
    - `python -m compileall -q backend/app` 通过
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `deploy/docker-compose.yml`
  - `deploy/nginx/default.conf`
  - `backend/app/core/config.py`

### Task: 会话结束自动 Docker 刷新（规则 + 脚本）
- **Status:** complete
- **Started:** 2026-02-10
- **Completed:** 2026-02-10
- Actions taken:
  - 切换本轮目标：制定“会话结束自动刷新 Docker”的仓库级规则，确保测试看到最新版本。
  - 更新 `AGENTS.md`：新增强制规则（触发条件、允许跳过条件、刷新命令、健康检查、记录要求、安全边界）。
  - 新增 `deploy/scripts/refresh-dev.ps1`：封装 `docker compose up -d --build --force-recreate ...` 并内置健康检查（`/healthz`、`/api/healthz`）。
  - 实跑脚本验证：刷新成功且 `GET http://127.0.0.1:18080/healthz` 与 `GET http://127.0.0.1:18080/api/healthz` 均通过。
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `AGENTS.md`
  - `deploy/scripts/refresh-dev.ps1`

### Task: 修复 500/401（Docker 迁移 + 会话过期兜底）
- **Status:** complete
- **Started:** 2026-02-10
- **Completed:** 2026-02-10
- Actions taken:
  - 排查前端报错：多条 API 401（未授权）+ `GET /api/v1/admin/skus` 500。
  - 查看后端日志：`docker compose -f deploy/docker-compose.yml logs backend --tail 200`，定位到 MySQL schema 缺少字段：`Unknown column 'sku.stock_mode' in 'field list'`。
  - 在容器内确认迁移状态并升级：
    - `docker compose -f deploy/docker-compose.yml exec -T backend alembic current` -> `202602070001`
    - `docker compose -f deploy/docker-compose.yml exec -T backend alembic heads` -> `202602100001`
    - `docker compose -f deploy/docker-compose.yml exec -T backend alembic upgrade head` -> 成功
  - 复测（未登录场景）：`curl http://127.0.0.1:18080/api/v1/admin/skus` / `.../inventory/summary` 由 500 恢复为 401（符合预期）。
  - 修改 `deploy/docker-compose.yml`：后端启动前自动执行 `alembic upgrade head && uvicorn ...`，避免旧 volume 再次触发 500；并验证 backend 日志出现 Alembic Context。
  - 修改前端鉴权兜底：
    - `frontend/src/api/index.ts`：当响应为 401 时触发 `pgc-auth-unauthorized` 事件（排除 `/auth/login`、`/auth/logout`）。
    - `frontend/src/routes/app-routes.tsx`：监听事件，清理会话并跳转 `/login`。
  - 验证：
    - `npm --prefix frontend run typecheck`
    - `python -m compileall -q backend/app`
    - `powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`（健康检查 OK）
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `deploy/docker-compose.yml`
  - `frontend/src/api/index.ts`
  - `frontend/src/routes/app-routes.tsx`

### Task: `/inbound` 手工入库交互精简与数量联动
- **Status:** complete
- **Started:** 2026-02-10
- **Completed:** 2026-02-10
- Actions taken:
  - 按需求移除“新建物料并入库”：入库页仅允许选择已有物料入库，物料只能在 `/materials` 新建。
  - 将“选择已有物料入库”文案改为“物料入库”，并将卡片标题/说明同步调整。
  - 物料下拉改为按分类层级展示：在 `<select>` 中以“分类(禁用项) + 物料(可选项)”的方式呈现。
  - 物料下拉缩进使用 `-- ` 前缀，保证在浏览器原生 `<select>` 中层级可见。
  - 物料入库新增“入库数量”字段：
    - 扫码/粘贴 SN 时数量自动随 SN 条数变化
    - 也允许手动输入数量；序列号物料提交时校验“数量 == SN 条数”
    - 数量物料提交时调用数量库存入库接口
  - 去掉 `/inbound` 页面独立“数量入库”卡片，统一在“物料入库”内处理。
  - 验证：
    - `npm --prefix frontend run typecheck`
    - `powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`（健康检查 OK）
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `frontend/src/pages/inbound-page.tsx`
  - `frontend/src/pages/inbound-manual-import-card.tsx`

### Task: Git 初始提交并推送到 GitHub
- **Status:** complete
- **Started:** 2026-02-10
- **Completed:** 2026-02-10
- Actions taken:
  - 新增 `.gitignore`（忽略 `deploy/.env`、缓存目录、`*.db` 等本地文件）。
  - 添加远端仓库：`git remote add origin https://github.com/goldeneye0077/itwuziguanli.git`
  - 初始提交：`git commit -m "初始化项目：物料/库存/入库重构"`
  - 推送：`git push -u origin main`

### Task: 导航菜单“入库”改为“物料入库”
- **Status:** complete
- **Started:** 2026-02-10
- **Completed:** 2026-02-10
- Actions taken:
  - 更新侧边栏菜单文案：`/inbound` 从“入库”改为“物料入库”。
  - 验证：`npm --prefix frontend run typecheck`
  - 刷新：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `frontend/src/routes/app-routes.tsx`

## Session: 2026-02-09
<!-- 
  WHAT: The date of this work session.
  WHY: Helps track when work happened, useful for resuming after time gaps.
  EXAMPLE: 2026-01-15
-->

### Phase 1: Requirements & Discovery
<!-- 
  WHAT: Detailed log of actions taken during this phase.
  WHY: Provides context for what was done, making it easier to resume or debug.
  WHEN: Update as you work through the phase, or at least when you complete it.
-->
- **Status:** complete
- **Started:** 2026-02-09 16:50
<!-- 
  STATUS: Same as task_plan.md (pending, in_progress, complete)
  TIMESTAMP: When you started this phase (e.g., "2026-01-15 10:00")
-->
- Actions taken:
  <!-- 
    WHAT: List of specific actions you performed.
    EXAMPLE:
      - Created todo.py with basic structure
      - Implemented add functionality
      - Fixed FileNotFoundError
  -->
  - Reviewed `NAV_ROUTE_META` and nav rendering in `frontend/src/routes/app-routes.tsx`.
  - Confirmed `/store` and `/store/cart` both map to `StorePage`.
  - Identified default prefix matching as cause of double highlight.
- Files created/modified:
  <!-- 
    WHAT: Which files you created or changed.
    WHY: Quick reference for what was touched. Helps with debugging and review.
    EXAMPLE:
      - todo.py (created)
      - todos.json (created by app)
      - task_plan.md (updated)
  -->
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### Phase 2: Planning & Structure
<!-- 
  WHAT: Same structure as Phase 1, for the next phase.
  WHY: Keep a separate log entry for each phase to track progress clearly.
-->
- **Status:** complete
- Actions taken:
  - Decided to highlight only the longest matching nav route to avoid parent/child double highlight.
- Files created/modified:
  - `task_plan.md`
  - `findings.md`

### Phase 3: Implementation
- **Status:** complete
- Actions taken:
  - Updated nav active logic to select longest matching route.
  - Rebuilt frontend container with `--no-deps` after conflict.
  - Added `AGENTS.md` rule to require `planning-with-files` updates for any workspace change.
  - Added `AGENTS.md` rule: documentation must be written in Chinese by default.
  - 新增 `useM02Cart`（sessionStorage 持久化购物车），供 `/store` 与 `/store/cart` 共用。
  - 将 `/store` 精简为“目录浏览 + 购物车摘要/入口”，将结算表单迁移到独立页面 `/store/cart`。
  - 更新路由映射：`/store` -> `StorePage`，`/store/cart` -> `StoreCartPage`。
  - 运行 `npm --prefix frontend run typecheck` 通过。
  - 重新构建并更新 `frontend` 容器：`docker compose up -d --build --no-deps frontend`。
- Files created/modified:
  - `frontend/src/routes/app-routes.tsx`
  - `AGENTS.md`
  - `frontend/src/pages/m02-cart.ts`
  - `frontend/src/pages/store-page.tsx`
  - `frontend/src/pages/store-cart-page.tsx`
  - `frontend/src/pages/index.ts`

### Task: 修复 /assets 页面为“我的资产”
- **Status:** complete
- **Started:** 2026-02-09 17:53
- **Completed:** 2026-02-09 18:02
- Actions taken:
  - 阅读并对齐规格基线与路由字典：`docs/implementation/baseline.md`、`docs/implementation/ui-blueprints.md`、`docs/proposal/40-前端路由与页面清单.md`、`docs/proposal/modules/09-资产生命周期管理.md`。
  - 确认当前 `/assets` 与 `/assets/:id` 未在 `resolveProtectedPage` 显式映射，导致落入 `BlueprintPlaceholderPage`（页面内容不符合“我的资产”预期）。
  - 更新 `task_plan.md` 与 `findings.md`，将 `/assets` 修复任务纳入 `planning-with-files` 流程。
  - 新增 `/assets` 资产列表页：复用 `fetchMyAssets` 展示表格（支持关键词/状态筛选），并提供“查看详情”入口。
  - 新增 `/assets/:id` 最小资产详情页：复用 `fetchMyAssets` 按 id 定位资产，提供“归还/报修/调拨/报废”快捷入口。
  - `AssetLifecyclePage` 支持从 URL query 预填 `assetId`（例如 `/assets/repair?assetId=31`）。
  - 更新路由映射：在 `resolveProtectedPage` 中显式处理 `/assets` 与 `/assets/:id`，避免落入占位页。
  - 运行 `npm --prefix frontend run typecheck` 通过。
  - 重新构建并更新 `frontend` 容器：`docker compose up -d --build --no-deps frontend`。
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `frontend/src/pages/assets-page.tsx`
  - `frontend/src/pages/asset-detail-page.tsx`
  - `frontend/src/pages/asset-lifecycle-page.tsx`
  - `frontend/src/pages/index.ts`
  - `frontend/src/routes/app-routes.tsx`

## Test Results
<!-- 
  WHAT: Table of tests you ran, what you expected, what actually happened.
  WHY: Documents verification of functionality. Helps catch regressions.
  WHEN: Update as you test features, especially during Phase 4 (Testing & Verification).
  EXAMPLE:
    | Add task | python todo.py add "Buy milk" | Task added | Task added successfully | ✓ |
    | List tasks | python todo.py list | Shows all tasks | Shows all tasks | ✓ |
-->
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Frontend typecheck | `npm --prefix frontend run typecheck` | Exit 0 | Exit 0 | PASS |
| Rebuild frontend container | `docker compose up -d --build --no-deps frontend` | Success | Success | PASS |
| Assets pages typecheck | `npm --prefix frontend run typecheck` | Exit 0 | Exit 0 | PASS |
| Rebuild frontend container (assets) | `docker compose up -d --build --no-deps frontend` | Success | Success | PASS |
| Store UI typecheck | `npm --prefix frontend run typecheck` | Exit 0 | Exit 0 | PASS |
| Rebuild frontend container (store UI) | `docker compose up -d --build --no-deps frontend` | Success | Success | PASS |
| Store page HTTP | `GET http://127.0.0.1:18080/store` | 200 | 200 | PASS |
| Inbound manual import typecheck | `npm --prefix frontend run typecheck` | Exit 0 | Exit 0 | PASS |
| Backend compileall | `python -m compileall backend/app` | Exit 0 | Exit 0 | PASS |
| Rebuild backend+frontend (inbound) | `docker compose up -d --build --force-recreate backend frontend` | Success | Success | PASS |
| Upload SKU image auth guard | `POST http://127.0.0.1:18080/api/v1/upload/sku-image` (no token) | 401 | 401 | PASS |
| Upload SKU image + static serve | upload `cmcc.png` then `HEAD /api/v1/uploads/...png` | 200 | 200 | PASS |
| Upload demo SKU images | `POST /api/v1/upload/sku-image` * 4 | URLs returned | URLs returned | PASS |
| Demo SKU cover_url bind | MySQL `UPDATE sku SET cover_url=... WHERE id in (8001..8004)` | cover_url updated | cover_url updated | PASS |
| Demo SKU images serve | `HEAD /api/v1/uploads/sku-covers/...png` * 4 | 200 | 200 | PASS |
| Dashboard hero bg asset serve | `HEAD /dashboard-hero-bg.avif` | 200 | 200 | PASS |
| Rebuild frontend container (hero bg) | `docker compose up -d --build --no-deps frontend` | Success | Success | PASS |
| Frontend typecheck (hero bg) | `npm --prefix frontend run typecheck` | Exit 0 | Exit 0 | PASS |
| agent.md 字数校验 | `Measure-Object -Character agent.md` | <= 500 | 421 | PASS |
| Inbound page HTTP | `GET http://127.0.0.1:18080/inbound` | 200 | 200 | PASS |
| Admin SKU CRUD API smoke | `POST /admin/skus` -> `PUT /admin/skus/{id}` -> `DELETE /admin/skus/{id}` | Success | Success | PASS |
| Admin SKU delete guard | `DELETE /admin/skus/8002` | 409 | 409 | PASS |
| Rebuild backend+frontend (sku crud) | `docker compose up -d --build --no-deps backend frontend` | Success | Success | PASS |
| Compose config (deploy) | `docker compose -f deploy/docker-compose.yml config` | Exit 0 | Exit 0 | PASS |
| Recreate backend+nginx+celery (docker refactor) | `docker compose -f deploy/docker-compose.yml up -d --build --force-recreate backend nginx celery_worker celery_beat` | Success | Success | PASS |
| Nginx restart (config reload) | `docker compose -f deploy/docker-compose.yml restart nginx` | Success | Success | PASS |
| Backend health via gateway | `GET http://127.0.0.1:18080/api/healthz` | 200 | 200 | PASS |
| Backend compileall (env compat) | `python -m compileall -q backend/app` | Exit 0 | Exit 0 | PASS |
| Docker refresh script | `powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1` | Exit 0 + health ok | Exit 0 + health ok | PASS |

## Error Log
<!-- 
  WHAT: Detailed log of every error encountered, with timestamps and resolution attempts.
  WHY: More detailed than task_plan.md's error table. Helps you learn from mistakes.
  WHEN: Add immediately when an error occurs, even if you fix it quickly.
  EXAMPLE:
    | 2026-01-15 10:35 | FileNotFoundError | 1 | Added file existence check |
    | 2026-01-15 10:37 | JSONDecodeError | 2 | Added empty file handling |
-->
<!-- Keep ALL errors - they help avoid repetition -->
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-02-09 16:55 | `docker compose up -d --build frontend` name conflict with backend container | 1 | Retry with `--no-deps` to avoid backend recreate |

## 5-Question Reboot Check
<!-- 
  WHAT: Five questions that verify your context is solid. If you can answer these, you're on track.
  WHY: This is the "reboot test" - if you can answer all 5, you can resume work effectively.
  WHEN: Update periodically, especially when resuming after a break or context reset.
  
  THE 5 QUESTIONS:
  1. Where am I? → Current phase in task_plan.md
  2. Where am I going? → Remaining phases
  3. What's the goal? → Goal statement in task_plan.md
  4. What have I learned? → See findings.md
  5. What have I done? → See progress.md (this file)
-->
<!-- If you can answer these, context is solid -->
| Question | Answer |
|----------|--------|
| Where am I? | Phase 5 |
| Where am I going? | 已完成 |
| What's the goal? | 修复 `/assets` 页面为“我的资产列表”，并补齐 `/assets/:id` 最小详情页，避免落入占位页 |
| What have I learned? | `/assets` 的页面职责与基线接口已在 `docs/implementation/baseline.md` 与 `docs/proposal/40-前端路由与页面清单.md` 冻结；UI 蓝图在 `docs/implementation/ui-blueprints.md` 定义了空态/加载/错误规范 |
| What have I done? | 新增 `AssetsPage`/`AssetDetailPage` 并接入路由；为生命周期表单支持 `assetId` 预填；完成 typecheck 与容器重建 |

### Task: 修复直达 /assets 301→403，并调整 Docker 镜像名避免冲突
- **Status:** complete
- **Started:** 2026-02-09 18:17
- **Completed:** 2026-02-09 18:21
- Actions taken:
  - 复现问题：`GET http://127.0.0.1:18080/assets` 返回 301（补斜杠），`GET /assets/` 返回 403（目录无 index 且禁用目录浏览）。
  - 确认原因：Vite 构建产物静态目录为 `/assets/`，与 SPA 路由 `/assets` 同名，触发 Nginx 目录处理逻辑。
  - 发现镜像命名风险：当前构建镜像名为 `deploy-*`（例如 `deploy-frontend:latest`），过于通用，可能与其它项目重名。
  - 更新 `task_plan.md` / `findings.md` / `progress.md` 记录上述发现与决策。
  - 修复前端 Nginx：`frontend/nginx.conf`
    - 为 `/assets` 增加特例，直达返回 `/index.html`，避免 301→403。
    - `/assets/` 301 到 `/assets`，并通过 `absolute_redirect off;` 确保 Location 使用相对路径（避免跳到 80 端口）。
    - `location /` 的 `try_files` 改为 `try_files $uri /index.html;`（避免目录优先匹配导致的补斜杠行为）。
  - 调整 Compose 镜像名：`deploy/docker-compose.yml`
    - 为 `backend`/`frontend`/`celery_worker`/`celery_beat` 显式设置 `image: itwzgl1-*`。
    - 外层反代 Host 透传改为 `$http_host`（保持 Host 完整）。
  - 重构/重启（强制重建容器）：
    - `docker compose up -d --build --force-recreate backend frontend celery_worker celery_beat`
    - `docker compose up -d --force-recreate nginx`
  - 验证：
    - `GET http://127.0.0.1:18080/assets` 返回 200
    - `GET http://127.0.0.1:18080/assets/` 返回 301，`Location: /assets`
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `frontend/nginx.conf`
  - `deploy/docker-compose.yml`

### Task: 领用商城页面（/store）按截图改造 UI
- **Status:** complete
- **Started:** 2026-02-09 18:30
- **Completed:** 2026-02-09 19:52
- Actions taken:
  - 更新规划文件：`task_plan.md` 切换为本任务目标与阶段；`findings.md` 写入截图拆解要点；`progress.md` 开始记录本任务日志。
  - 改造商城布局：`frontend/src/pages/store-page.tsx` 从“双卡片列表”改为“左侧卡片网格 + 右侧结算侧栏”布局。
  - 新增结算侧栏组件：`frontend/src/pages/store-checkout-sidebar.tsx`，实现购物车空态、交付方式/岗位/申请原因、智能预检与提交申请按钮。
  - 对齐行为：侧栏提交申请后写入 `sessionStorage`（复用 `m02-storage.ts`），确保“我的申请”可看到新提交的申请单。
  - 增补样式：`frontend/src/styles/index.css` 新增商品卡片网格、库存徽标、侧栏空态、按钮组、骨架屏与响应式规则（≤1080px 单列）。
  - 验证与部署：
    - `npm --prefix frontend run typecheck` 通过
    - `deploy/docker-compose.yml`：`docker compose up -d --build --no-deps frontend` 重新构建并更新前端容器
    - `GET http://127.0.0.1:18080/store` 返回 200
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `frontend/src/pages/store-page.tsx`
  - `frontend/src/pages/store-checkout-sidebar.tsx`
  - `frontend/src/styles/index.css`

### Task: 入库与库存（/inbound）补齐手动导入资产能力
- **Status:** complete
- **Started:** 2026-02-09 20:05
- **Completed:** 2026-02-09 20:25
- Actions taken:
  - 对齐基线与实现差距：确认基线冻结 `POST /api/v1/upload/sku-image`，但后端尚未实现 `/upload/*`；并确认 `Sku.cover_url` 长度为 512，无法存 base64，需要返回可访问 URL。
  - 后端实现 SKU 图片上传与回显：
    - 新增 `POST /api/v1/upload/sku-image`（仅管理员可用；限制 jpg/png/webp，<= 5MB），返回 `url` 可直接用于 `<img src>`。
    - 在后端挂载静态目录：`/api/v1/uploads/*` 用于访问上传文件。
    - Docker 增补持久化：`deploy/docker-compose.yml` 为 backend 增加 `backend_uploads` volume，避免容器重建后丢图。
  - 前端补齐手动导入体验：
    - 新增卡片组件 `InboundManualImportCard`：分类下拉、SKU 图片上传预览、扫码枪录入 SN（回车添加）、批量粘贴、去重提示、移除/清空、可选入库时间、导入结果预览与 CSV 导出。
    - 接入到 `/inbound` 页面并默认跨两列展示。
    - 新增 API：`uploadSkuImage()`。
  - 验证与部署：
    - `npm --prefix frontend run typecheck` 通过
    - `python -m compileall backend/app` 通过
    - `cd deploy; docker compose up -d --build --force-recreate backend frontend` 更新容器
    - 冒烟：
      - `POST /api/v1/upload/sku-image` 未登录返回 401（路径存在且鉴权生效）
      - 管理员登录后上传 `cmcc.png` 成功并返回 `/api/v1/uploads/...`，`HEAD` 该 URL 返回 200
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `deploy/docker-compose.yml`
  - `backend/app/core/config.py`
  - `backend/app/main.py`
  - `backend/app/api/v1/routers/m00_common_auth.py`
  - `frontend/src/api/index.ts`
  - `frontend/src/pages/inbound-page.tsx`
  - `frontend/src/pages/inbound-manual-import-card.tsx`
  - `frontend/src/styles/index.css`

---
<!-- 
  REMINDER: 
  - Update after completing each phase or encountering errors
  - Be detailed - this is your "what happened" log
  - Include timestamps for errors to track when issues occurred
-->
*Update after completing each phase or encountering errors*

## Session: 2026-02-10

### Task: 绑定 /store 演示商品图片 + 更新 Dashboard Hero 背景图
- **Status:** complete
- **Started:** 2026-02-10 09:40
- **Completed:** 2026-02-10 09:55
- Actions taken:
  - 定位 `/store` 商品图片渲染链路：`GET /api/v1/skus` → `cover_url` → 前端 `coverUrl` → `<img src={coverUrl}>`。
  - 确认演示 SKU 固定 ID：8001（联想 ThinkPad T14）、8002（Dell U2723QE）、8003（Logitech MX Keys）、8004（Logitech MX Master 3S）。
  - 通过管理员登录获取 token，并调用 `POST /api/v1/upload/sku-image` 上传 4 张 PNG，得到可访问 URL：
    - 8001: `/api/v1/uploads/sku-covers/2026/02/a71e8742c98f40f984f65b4c74a32588.png`
    - 8002: `/api/v1/uploads/sku-covers/2026/02/cc4998c44c6f40828e3699a9a817e148.png`
    - 8003: `/api/v1/uploads/sku-covers/2026/02/fcabd2871d6a4664a33dbca80421c42f.png`
    - 8004: `/api/v1/uploads/sku-covers/2026/02/bb6f9967512946dbab481cfc0c428a85.png`
  - 直接更新 MySQL（`sku.cover_url`）将以上 URL 绑定到对应 SKU（8001-8004）。
  - 将 `背景1.avif` 复制为 `frontend/public/dashboard-hero-bg.avif`，并把 `.dashboard-hero` 背景图引用从 `/背景2.avif` 切换为 `/dashboard-hero-bg.avif`。
  - 重建并滚动更新前端容器：`docker compose up -d --build --no-deps frontend`。
  - 运行 `npm --prefix frontend run typecheck` 通过。
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `frontend/src/styles/index.css`
  - `frontend/public/dashboard-hero-bg.avif`
- Data changes:
  - MySQL：`sku.id in (8001,8002,8003,8004)` 的 `cover_url` 已更新为上传后的 URL
  - `backend_uploads` 卷：新增 4 个 SKU cover 文件（png）

### Task: 解析 proposal 并生成根目录 agent.md（500字内）
- **Status:** complete
- **Started:** 2026-02-10 10:00
- **Completed:** 2026-02-10 10:10
- Actions taken:
  - 扫描并阅读 `docs/proposal/**` 关键文档（00/40/80 + modules 选读），提取项目名称、核心目标、交付物、技术栈约束。
  - 参考 `docs/implementation/baseline.md` 获取已冻结的时间节点：`baseline.v1`（2026-02-07）。
  - 新建 `agent.md`，以结构化要点写入提案概略，并通过字符数统计确保 ≤ 500 字（实际 421 字）。
- Files created/modified:
  - `agent.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### Task: /inbound 后台物料表格化 + SKU CRUD
- **Status:** complete
- **Started:** 2026-02-10 10:20
- **Completed:** 2026-02-10 10:50
- Actions taken:
  - 定位问题：`/inbound` 的“查询物料”当前用 `<pre>` 直接渲染 JSON，不利于管理操作。
  - 后端补齐 SKU CRUD：
    - 新增 `PUT /api/v1/admin/skus/{id}`（全量更新）
    - 新增 `DELETE /api/v1/admin/skus/{id}`（仅允许删除无引用 SKU）
    - 新增错误码 `SKU_IN_USE` 映射为 409，用于删除受限提示。
  - 前端补齐 API 与 UI：
    - 新增 `updateAdminSku()`、`deleteAdminSku()`。
    - 将 `/inbound` 后台物料展示改为表格（复用 `analytics-table`），并增加新增/编辑/删除操作。
    - 新增封面上传与预览：复用 `uploadSkuImage()`，在“新增物料/编辑物料”面板中上传后写入 `coverUrl`。
  - 验证：
    - `python -m compileall -q backend/app` 通过
    - `npm --prefix frontend run typecheck` 通过
    - `cd deploy; docker compose up -d --build --no-deps backend frontend` 更新容器
    - API 冒烟：创建临时 SKU → PUT 更新 → DELETE 删除成功；删除已被引用的 SKU（8002）返回 409
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `backend/app/core/exceptions.py`
  - `backend/app/schemas/m06.py`
  - `backend/app/api/v1/routers/m06_inbound_inventory.py`
  - `frontend/src/api/index.ts`
  - `frontend/src/pages/inbound-page.tsx`
  - `frontend/src/styles/index.css`

### Task: /inbound 拆分“库存管理”为独立页面（/inventory）+ 导航拆分
- **Status:** complete
- **Started:** 2026-02-10 12:00
- **Completed:** 2026-02-10 12:30
- Actions taken:
  - 需求确认：用户要求 `/inbound` 页面减负，将库存相关能力拆到独立页面；并把左侧菜单“入库与库存”拆成“入库”和“库存管理”两个入口。
  - 现状梳理：
    - `/inbound` 页面同时包含：手动导入入库、OCR 识别入库、后台物料（SKU）CRUD、后台资产创建/查询、库存汇总。
    - `frontend/src/routes/blueprint-routes.ts` 目前没有 `/inventory` 路由元信息，`frontend/src/routes/app-routes.tsx` 中 `/inbound` 文案仍为“入库与库存”。
  - 记录工具链错误：Windows PowerShell 5.x 不支持 `&&`，后续统一用 `;` 分隔命令。
  - 拆分实现：
    - 新增库存管理页面：`frontend/src/pages/inventory-page.tsx`，承载 SKU CRUD、资产创建/查询、库存汇总。
    - 精简入库页面：`frontend/src/pages/inbound-page.tsx` 移除库存模块，仅保留手动导入入库 + OCR 入库；页头增加跳转按钮到 `/inventory`。
    - 路由与导航：
      - `frontend/src/routes/blueprint-routes.ts` 新增 `/inventory` 元信息。
      - `frontend/src/routes/app-routes.tsx`：左侧菜单拆分为“入库”（/inbound）与“库存管理”（/inventory），并为 `/inventory` 配置 `Boxes` 图标。
      - `frontend/src/pages/index.ts` 导出 `InventoryPage`。
  - 验证：
    - `npm --prefix frontend run typecheck` 通过
    - Docker 刷新：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`（包含 `/healthz` 与 `/api/healthz` 健康检查）
    - HTTP 冒烟：
      - `GET http://127.0.0.1:18080/inbound` 返回 200
      - `GET http://127.0.0.1:18080/inventory` 返回 200
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `frontend/src/pages/inventory-page.tsx`
  - `frontend/src/pages/inbound-page.tsx`
  - `frontend/src/pages/index.ts`
  - `frontend/src/routes/blueprint-routes.ts`
  - `frontend/src/routes/app-routes.tsx`

### Task: /inventory 库存汇总表格化 + CRUD + 筛选 + 默认加载
- **Status:** complete
- **Started:** 2026-02-10 13:00
- **Completed:** 2026-02-10 14:05
- Actions taken:
  - 需求确认：用户要求库存汇总表格化并提供 CRUD，页面默认展示列表，并为“查询物料/查询库存汇总”增加条件筛选表单。
  - 现状梳理：
    - `frontend/src/pages/inventory-page.tsx`：SKU 已表格化并有 CRUD；库存汇总目前仅以 `<pre>` JSON 输出。
    - `backend/app/api/v1/routers/m06_inbound_inventory.py`：`GET /admin/skus` 暂不支持条件查询；`GET /inventory/summary` 仅返回数量聚合字段，不含 SKU 详情。
  - 后端增强（条件查询 + 汇总返回结构）：
    - `GET /api/v1/admin/skus` 增加筛选参数：`sku_id`/`category_id`/`q`（品牌/型号/规格关键字）。
    - `GET /api/v1/inventory/summary`：
      - 增加筛选参数：`sku_id`/`category_id`/`q`/`below_threshold`
      - 返回字段补齐 SKU 详情：品牌/型号/规格/参考价/封面/安全阈值，并新增 `below_safety_stock` 标记
      - 汇总行以 SKU 为粒度生成（包含 0 库存 SKU），便于默认展示与低库存筛选
  - 前端增强（默认加载 + 条件表单 + 表格化 + 可操作 CRUD）：
    - `frontend/src/pages/inventory-page.tsx`：
      - 页面打开自动拉取并展示“物料（SKU）表格”和“库存汇总表格”
      - “查询物料”“查询库存汇总”新增条件表单（SKU/分类/关键字；汇总额外支持“仅显示低库存”）
      - 库存汇总改为表格展示，并提供“编辑 SKU / 删除”操作（CRUD 以 SKU 为粒度）
    - `frontend/src/api/index.ts`：扩展 `fetchAdminSkus()`、`fetchInventorySummary()` 支持查询参数，并更新库存汇总类型映射
  - 验证：
    - `python -m compileall -q backend/app` 通过
    - `npm --prefix frontend run typecheck` 通过
    - Docker 刷新：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`
    - 冒烟：`GET http://127.0.0.1:18080/inventory` 返回 200
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `backend/app/api/v1/routers/m06_inbound_inventory.py`
  - `frontend/src/api/index.ts`
  - `frontend/src/pages/inventory-page.tsx`
  - `frontend/src/styles/index.css`

### Task: /inventory 资产查询表格化 + CRUD
- **Status:** complete
- **Started:** 2026-02-10 14:20
- **Completed:** 2026-02-10 14:51
- Actions taken:
  - 需求确认：用户要求“资产创建/查询与库存汇总”卡片中，资产查询结果由 JSON 输出升级为表格，并补齐资产 CRUD。
  - 现状梳理：
    - `frontend/src/pages/inventory-page.tsx`：资产查询结果当前以 `<pre>` 输出（不利于管理操作）。
    - `backend/app/api/v1/routers/m06_inbound_inventory.py`：已有 `GET/POST /admin/assets`，但缺少 `PUT/DELETE /admin/assets/{id}`。
  - 后端补齐资产 CRUD：
    - 新增 `PUT /api/v1/admin/assets/{id}`：支持更新 `sku_id`/`sn`/`status`/`inbound_at`，并对锁定/流程引用资产做限制（仅允许更新 `inbound_at`）。
    - 新增 `DELETE /api/v1/admin/assets/{id}`：仅允许删除“在库 + 未锁定 + 未被流程引用”的资产。
    - 修复删除失败：发现即便是新建在库资产也会因 `stock_flow.asset_id` 外键 RESTRICT 触发 `IntegrityError`，导致返回 `ASSET_LOCKED`；已在删除资产前先清理对应 `stock_flow`（并额外防护：若流水已关联申请则仍禁止删除）。
  - 前端资产表格化 + CRUD 交互：
    - `frontend/src/pages/inventory-page.tsx`：资产查询结果改为 `analytics-table` 表格展示，增加“编辑/删除”操作列。
    - 新增“编辑资产”面板：可修改 SKU 编号/SN/状态；保存后自动刷新资产列表与库存汇总。
    - 新增删除按钮：删除成功后自动刷新资产列表与库存汇总；受约束时展示后端错误信息。
  - 验证：
    - `bun run typecheck` 通过
    - Docker 刷新：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`（含 `/healthz` 与 `/api/healthz`）
    - 冒烟：`GET http://127.0.0.1:18080/inventory` 返回 200
    - API 冒烟（管理员）：创建资产 -> 更新资产 -> 删除资产，全链路成功
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `backend/app/schemas/m06.py`
  - `backend/app/api/v1/routers/m06_inbound_inventory.py`
  - `frontend/src/api/index.ts`
  - `frontend/src/pages/inventory-page.tsx`

## Session: 2026-02-10

### Task: 物料/库存/入库 数量库存重构（实施）
- **Status:** in_progress
- **Started:** 2026-02-10
- Actions taken:
  - 切换本轮目标为“数量库存重构”，并更新过程文档（task_plan/findings/progress）
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### Task: 数量库存重构（继续实施：前后端联动）
- **Status:** in_progress
- **Started:** 2026-02-10
- Actions taken:
  - 修复后端语法错误：`backend/app/api/v1/routers/m06_inbound_inventory.py` CSV 导出末尾存在错误转义（`f\"...\"`）导致 `compileall` 失败，已修正并通过 `python -m compileall -q backend/app`。
  - 更新后端测试断言以匹配新响应结构，并调整 `/inventory/summary` 权限为管理员访问：`pytest -q` 全量通过（31 passed）。
  - 前端 API 类型与接口补齐：加入 `stock_mode`、`inbound_quantity`、数量库存操作与流水查询/CSV 导出接口。
  - 新增页面：`/materials`（分类 CRUD + 物料 SKU CRUD，支持设置 `stock_mode`）。
  - 重构 `/inventory`：库存汇总表格展示 `现存/预占/可用`；数量库存支持入库/出库/盘点调整；新增库存流水筛选、分页与 CSV 导出。
  - 扩展 `/inbound`：新增“手工数量入库（QUANTITY）”卡片；OCR 确认支持 `SERIALIZED/QUANTITY` 两种模式；页头增加跳转到 `/materials`。
  - 验证：`npm --prefix frontend run typecheck` 通过。
- Files created/modified:
  - `backend/app/api/v1/routers/m06_inbound_inventory.py`
  - `backend/tests/test_step13_m04_m05.py`
  - `backend/tests/test_step14_m06_inbound_inventory.py`
  - `frontend/src/api/index.ts`
  - `frontend/src/pages/materials-page.tsx`
  - `frontend/src/pages/index.ts`
  - `frontend/src/pages/inventory-page.tsx`
  - `frontend/src/pages/inbound-page.tsx`
  - `frontend/src/routes/blueprint-routes.ts`
  - `frontend/src/routes/app-routes.tsx`
  - `task_plan.md`
- Docker 刷新：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1` 成功，健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`。
- 冒烟（前端路由返回 200）：`/materials`、`/inventory`、`/inbound`。
- 后端 pytest 补齐：新增 QUANTITY 数量库存操作/流水导出测试（m06），并再次执行 `pytest -q` 全量通过（32 passed）。
