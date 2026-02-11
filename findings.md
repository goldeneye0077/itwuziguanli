# Findings & Decisions
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

## Requirements
<!-- 
  WHAT: What the user asked for, broken down into specific requirements.
  WHY: Keeps requirements visible so you don't forget what you're building.
  WHEN: Fill this in during Phase 1 (Requirements & Discovery).
  EXAMPLE:
    - Command-line interface
    - Add tasks
    - List all tasks
    - Delete tasks
    - Python implementation
-->
<!-- Captured from user request -->
- 讨论并落地物料/库存/入库三者逻辑：
  - `/materials`：SKU CRUD + 分类 CRUD（支持大类/小类层级），不包含库存数量信息
  - `/inventory`：库存管理（以数量库存为主），支持 `on_hand/reserved/available`，且库存数量必须与出入库联动
  - `/inbound`：保留手工入库与 OCR 入库可用；可跳转到 `/inventory`、`/materials`
- 新增 SKU 双轨库存模式：`SERIALIZED`（序列号资产）与 `QUANTITY`（数量库存）
- 库存操作记录需要支持导出（Excel 方向），优先实现 CSV（UTF-8 BOM）

- 把根目录下的 `背景1.avif` 用作 `http://127.0.0.1:18080/dashboard` 的 hero 横幅背景。
- 把根目录下的 4 张商品图放进 `http://127.0.0.1:18080/store` 对应商品卡片的图片框中：
  - `E:\\itwzgl1\\联想.png`
  - `E:\\itwzgl1\\戴尔显示器.png`
  - `E:\\itwzgl1\\逻辑键盘.png`
  - `E:\\itwzgl1\\鼠标.png`
- 项目初始化：解析 `docs/proposal/**` 提案文档，提取项目名称/核心目标、关键交付物与时间节点、核心约束条件，并将概略内容写入根目录 `agent.md`（中文、500字内）。
- `/inbound`：点击“查询物料”后不再展示原始 JSON 列表，改为可视化表格，并提供 SKU 的 CRUD（增/查/改/删，含封面图上传/预览）。
- `/inbound` 页面太臃肿：将“库存相关功能”（SKU 管理、资产创建/查询、库存汇总）拆分为独立页面 `/inventory`；左侧导航将“入库与库存”拆成两个菜单项：`入库`（/inbound）与 `库存管理`（/inventory）。
- `/inventory` 页面增强：
  - 库存汇总从 JSON 输出升级为表格，交互对齐“物料（SKU）查询与管理”，并提供可操作的 CRUD 能力（以 SKU 为粒度编辑/删除，创建沿用“新增物料”）。
  - 页面打开默认加载并展示 SKU 表格与库存汇总表格。
  - “查询物料”“查询库存汇总”都新增按条件筛选查询的条件表单。
  - “查询资产”结果从 JSON 输出升级为表格，并补齐资产 CRUD（编辑/删除；创建沿用现有“创建资产”）。
- Docker：重构 `deploy/docker-compose.yml` 中前后端服务编排（backend/frontend/nginx），提高可维护性并减少重复构建。
- 前端：左侧导航菜单栏图标统一改用 `lucide-react`，并按用户给出的映射逐项应用。
- Fix nav highlight so clicking "领用商城" then "领用购物车" does not keep both highlighted.
- Add a repo-local rule: any workspace change must follow `planning-with-files` and update `task_plan.md`, `findings.md`, `progress.md`.
- Add a repo-local rule: all documentation writing should be in Chinese by default.
- 新增仓库级规则：每次会话结束时，如本轮有运行相关改动（例如 `backend/` `frontend/` `deploy/`），必须自动刷新 Docker 镜像与容器，确保测试看到的是最新版本。
- 把 `/store/cart` 拆成独立页面组件（与 `/store` 分离），并保证购物车在页面间切换时不丢失。
- 修复 `/assets` 页面：按文档应展示“我的资产列表”，当前页面内容不对。
- 前端“打不开”现象需要定位：用户直达 `http://127.0.0.1:18080/assets` 应进入“我的资产”，不能出现 301→403。
- 如果 Docker 镜像名与其他项目重名，需改为更唯一的镜像名，避免互相覆盖/冲突。
- 领用商城页面（`/store`）需要模仿用户提供的截图设计：除底色可不改，其它元素尽量套用（左侧商品卡片网格 + 右侧结算区侧栏、空态、表单、按钮、徽标等）。
- `/inbound` 入库与库存页面需要补齐“手动导入资产”能力：
  - 可选择分类（不要只填数字分类编号）
  - 支持上传 SKU 封面图（用于商城/库存列表展示）
  - 录入品牌、型号、规格、参考价格、安全库存阈值
  - 批量录入资产序列号（SN），支持扫码枪输入（Enter 结束一条）与批量粘贴
  - 其它补全：支持选择“新建物料并入库 / 选择已有物料入库”、去重提示、导入结果可复制/导出
- `/inbound` 最新交互调整：
  - 移除“新建物料并入库”，物料只能在 `/materials` 新建
  - “选择已有物料入库”文案改为“物料入库”
  - 左侧菜单 `/inbound` 文案改为“物料入库”
  - 物料选择下拉按分类层级展示全部物料
  - 物料入库新增“入库数量”字段：SN 扫码/粘贴时数量自动变化，也允许手动输入；无 SN 时可直接手动输入数量
  - 进一步优化：根据 SKU `stockMode` 自动切换表单
    - `SERIALIZED`：显示 SN 录入区；入库数量只读 = SN 条数（避免“数量可随意改”造成校验困惑）
    - `QUANTITY`：隐藏 SN 录入区；仅填写入库数量即可入库（解决耗材无 SN 的入库场景）
  - 去掉独立“数量入库”卡片（统一在“物料入库”内处理）

## Research Findings
<!-- 
  WHAT: Key discoveries from web searches, documentation reading, or exploration.
  WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately.
  WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule).
  EXAMPLE:
    - Python's argparse module supports subcommands for clean CLI design
    - JSON module handles file persistence easily
    - Standard pattern: python script.py <command> [args]
-->
<!-- Key discoveries during exploration -->
- Docker 运行栈出现 500（`/api/v1/admin/skus`、`/api/v1/inventory/summary`）时，优先检查 Alembic 迁移是否落库：本次定位为 MySQL volume 停留在 `202602070001`，缺少 `sku.stock_mode` 字段；在 backend 容器内执行 `alembic upgrade head` 后恢复正常。为避免复现，需要让后端容器启动时自动执行迁移（或在刷新脚本中强制迁移）。
- Nav is generated from `NAV_ROUTE_META` in `frontend/src/routes/app-routes.tsx`.
- `/store` and `/store/cart` both map to `StorePage`. Active nav highlighting must avoid parent + child being active at the same time.
- Dashboard Hero 横幅对应的 DOM 为 `frontend/src/pages/dashboard-page.tsx` 的 `<section className="dashboard-hero ...">`，样式入口在 `frontend/src/styles/index.css` 的 `.dashboard-hero`。
- 当前 `frontend/src/pages/inbound-page.tsx` 同时承载“入库（手动导入 + OCR 入库确认）”与“库存管理（SKU CRUD + 资产创建/查询 + 库存汇总）”，且库存相关 state/handler/UI 主要集中在页面后半部分（包含 `fetchAdminSkus/createAdminSku/updateAdminSku/deleteAdminSku/uploadSkuImage`、`fetchAdminAssets/createAdminAssets`、`fetchInventorySummary`）。
- 当前 `frontend/src/routes/blueprint-routes.ts` 尚未包含 `/inventory`，`frontend/src/routes/app-routes.tsx` 中 `/inbound` 文案仍为“入库与库存”，需要按需求拆分导航与路由。
- 拆分落地方案：新增 `/inventory` 页面承载库存能力；`/inbound` 聚焦入库执行并提供跳转；左侧导航拆分为“入库”（/inbound）与“库存管理”（/inventory），并为库存管理使用 `lucide-react` 的 `Boxes` 图标。
- 后端现状：
  - `GET /api/v1/admin/skus` 暂不支持条件查询（仅全量列表）。
  - `GET /api/v1/inventory/summary` 仅返回按 `sku_id` 聚合的数量字段，不包含 SKU 详情（品牌/型号/规格/阈值/封面等），且暂不支持关键字/分类等筛选。
- 后端已增强：
  - `GET /api/v1/admin/skus` 支持 `sku_id`/`category_id`/`q` 条件筛选。
  - `GET /api/v1/inventory/summary` 支持 `sku_id`/`category_id`/`q`/`below_threshold` 条件筛选，并返回 SKU 详情字段与 `below_safety_stock` 标记，便于前端表格化与低库存筛选。
- 演示 SKU 固定 ID（来自 `backend/app/scripts/seed_demo_data.py`）：8001（联想笔记本）、8002（Dell 显示器）、8003（Logitech 键盘）、8004（Logitech 鼠标）。
- 当前 `/store` 商品卡片图片直接使用 `GET /api/v1/skus` 返回的 `cover_url` 字段（前端映射为 `coverUrl`）渲染 `<img src={coverUrl}>`。
- 提案文档项目名称：`docs/proposal/00-总体与通用规范.md` 为“IT物资全生命周期管理系统”。
- 提案定义的前端技术栈：React 18 + TypeScript + Vite，UI 组件库 Ant Design（见 `docs/proposal/40-前端路由与页面清单.md`）。
- 提案定义的部署与后端依赖版本：Python 3.12+、Node.js 20+、MySQL 8.0+、Redis 7.0+、MinIO、Docker 24+、Nginx 1.24+（见 `docs/proposal/80-部署与运维.md`）。
- `docs/implementation/baseline.md` 记录 `baseline.v1` 规格冻结日期为 2026-02-07，且其“冻结源文件”以 `docs/proposal/**` 为主。
- 提案的核心模块目标（见 `docs/proposal/modules/*.md`）：智慧门户（Hero/公告/我的资产/快捷入口）、物资申领（分类+SKU 卡片+购物车+结算+AI 预审）、入库库存（OCR 入库+赋码/打印+SKU/Asset 管理）。
- 当前 `/inbound` “后台物料”查询结果通过 `<pre className="inbound-result">` 直接渲染 JSON，不利于管理操作；可复用现有表格样式 `analytics-table`（已在报表、资产页使用）。
- 后端现状：SKU 管理仅实现 `GET/POST /api/v1/admin/skus`，缺少更新/删除；前端因此只能“查 + 新建”，无法完成完整 CRUD。
- 当前 `StorePage` 同时包含“目录浏览”和“结算区（购物车 + 提交申请表单）”，拆分后需要共享购物车状态。
- 拆分方案：`/store` 保留目录浏览 + 购物车摘要入口；`/store/cart` 承载结算表单与提交申请。
- 根据 `docs/proposal/40-前端路由与页面清单.md`：`/assets` 应为“我的资产列表（卡片/表格）”，`/assets/:id` 为“资产详情（SN、状态、历史流水）”。
- 根据 `docs/implementation/baseline.md`（baseline.v1）：M01 已冻结 `GET /api/v1/me/assets` 作为“我的资产”基线接口，且 UI 路由字典将 `/assets` 冻结为“我的资产列表”。
- 根据 `docs/implementation/ui-blueprints.md`（4.9 Asset Lifecycle）：`/assets` 首屏应包含资产清单，并有空态（引导去 `/store`）、加载态骨架、错误态提示与建议动作。
- 当前 `frontend/src/routes/app-routes.tsx` 的 `resolveProtectedPage` 未覆盖 `/assets` 与 `/assets/:id`，因此会落入 `BlueprintPlaceholderPage`（表现为页面内容不对）。
- 前端已有 `fetchMyAssets(accessToken)`（调用 `GET /api/v1/me/assets`），Dashboard 已在使用，可直接复用到 `/assets`。
- 当前 `frontend` 静态资源使用 Vite 默认输出目录 `/assets/`，与 SPA 路由 `/assets` 同名：
  - 直达 `/assets` 会被 Nginx 识别为目录并 301 跳转 `/assets/`
  - `/assets/` 没有 index 且禁用目录浏览，返回 403，导致用户感觉“前端打不开”
- 在外层反向代理（`deploy/docker-compose.yml` 的 `nginx` 服务）中，`proxy_set_header Host $host;` 会丢失端口号：
  - upstream（前端 Nginx）返回的 301 会生成不带端口的 Location（例如 `http://127.0.0.1/assets`）
  - 浏览器会跳到 80 端口，表现为“打不开”
  - 修复：将 Host 透传改为 `$http_host`（保留 `127.0.0.1:18080`）
- 进一步验证发现：即使直连 `frontend`（例如 `http://127.0.0.1:13000/assets/`），Location 仍然不带端口，根因是前端 Nginx 默认 `absolute_redirect on` + `port_in_redirect` 使用容器内端口（80）导致端口被省略。
  - 修复：在 `frontend/nginx.conf` 增加 `absolute_redirect off;`，让 301 使用相对路径（例如 `Location: /assets`），从而保留浏览器当前端口。
- 当前 Docker Compose 默认项目名为 `deploy`（来自目录名），镜像名已显式设置为 `itwzgl1-*`，可一定程度避免与其它项目的镜像重名。
- 已重构（Docker 前后端服务编排）：
  - `celery_worker`/`celery_beat` 复用 `itwzgl1-backend` 镜像，避免重复 build 同一份后端镜像。
  - 外层 `nginx` 配置外置为 `deploy/nginx/default.conf` 并通过 volume 挂载，便于维护与审阅。
  - 入口新增 `GET /api/healthz`（透传到后端 `/healthz`），便于通过统一入口探活后端。
- `frontend/src/pages/inbound-page.tsx` 已具备“创建物料 / 创建资产 / 查询资产 / 库存汇总”等基础调用，但交互偏“工作台式调试表单”：分类靠手填 ID、缺少 SKU 图片上传与扫码录入体验，结果以 JSON `pre` 输出为主。
- 后端 `backend/app/api/v1/routers/m06_inbound_inventory.py` 已支持：
  - `POST /api/v1/admin/skus`（包含 `cover_url` 字段）
  - `POST /api/v1/admin/assets`（批量创建资产，支持 `inbound_at`）
  - `PUT /api/v1/admin/assets/{id}`（更新资产；锁定/流程引用资产限制修改关键字段）
  - `DELETE /api/v1/admin/assets/{id}`（删除资产；仅允许“在库 + 未锁定 + 未被流程引用”的资产）
  - 重复 SN 检测：同批次重复与库内已存在都会返回 `DUPLICATE_SN`
- 资产删除约束补充：`stock_flow.asset_id` 外键为 `ondelete="RESTRICT"`，新建资产会生成库存流水，若不先清理 `stock_flow`，即便资产满足删除条件也会触发 `IntegrityError` 而删除失败。
- 基线文档（`docs/implementation/baseline.md`、`docs/proposal/70-文件上传与存储规范.md`）冻结了上传接口：`POST /api/v1/upload/sku-image`，但当前后端尚未实现任何 `/upload/*` 路径。
- 已补齐上传能力（本阶段最小实现）：后端新增 `POST /api/v1/upload/sku-image`，并通过 `StaticFiles` 挂载 `/api/v1/uploads/*` 供前端回显图片；Compose 增加 `backend_uploads` volume 保持持久化。

## Technical Decisions
<!-- 
  WHAT: Architecture and implementation choices you've made, with reasoning.
  WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge.
  WHEN: Update whenever you make a significant technical choice.
  EXAMPLE:
    | Use JSON for storage | Simple, human-readable, built-in Python support |
    | argparse with subcommands | Clean CLI: python todo.py add "task" |
-->
<!-- Decisions made with rationale -->
| Decision | Rationale |
|----------|-----------|
| Highlight only the longest matching nav route | Ensures only one active nav item even when parent/child routes both exist |
| Add `AGENTS.md` to enforce `planning-with-files` on any change | Makes the process requirement explicit and repo-local |
| 文档默认使用中文撰写 | 统一语言风格；保留必要的英文技术元素 |
| 引入 `useM02Cart`（基于 `sessionStorage`） | 让 `/store` 与 `/store/cart` 复用同一套购物车读写逻辑，减少重复代码 |
| `/store/cart` 使用独立组件 `StoreCartPage` | 路由层清晰分离，后续可独立迭代购物车页面交互与布局 |
| 新增 `AssetsPage` 承载 `/assets` | 对齐路由字典与 UI 蓝图，将“我的资产列表”从占位页落地为真实页面 |
| 新增 `AssetDetailPage`（最小实现）承载 `/assets/:id` | 当前基线未冻结资产详情 API，先复用 `fetchMyAssets` 列表按 id 过滤，保证路径可用不落入占位页 |
| `resolveProtectedPage` 显式映射 `/assets` 与 `/assets/:id` | 避免误用 `BlueprintPlaceholderPage`，并让导航高亮与页面职责一致 |
| 前端 Nginx 增加 `/assets` 特例 | 既保留静态文件目录 `/assets/*`，又让 SPA 路由 `/assets` 直达不再 301→403 |
| Docker Compose 显式设置 build 镜像名 | 将 `deploy-*` 改为更唯一的项目镜像名，避免与其他项目冲突 |
| `/store` 侧栏优先支持自提提交，快递引导到 `/store/cart` | 截图侧栏未包含地址信息；先把主要体验落地，避免在商城页引入复杂地址管理 |
| 先实现 `POST /api/v1/upload/sku-image`（本地静态目录存储） | `cover_url` 长度限制为 512，无法存 base64；需要返回可访问 URL 才能在商城卡片回显图片 |
| `/inbound` 手动导入提供“新建 SKU 并入库 / 选择已有 SKU 入库”两种路径 | 更贴近真实入库：同一 SKU 会多批次入库；减少重复创建 SKU 的概率 |
| `/store` 演示商品图通过 `POST /api/v1/upload/sku-image` 上传并写回 MySQL `sku.cover_url` | 不改前端渲染逻辑即可让卡片 `<img src={coverUrl}>` 回显；上传文件也能随 `backend_uploads` 卷持久化 |
| 将 `背景1.avif` 放入 `frontend/public`（命名为 `dashboard-hero-bg.avif`）并在 `.dashboard-hero` 中引用 | 后端上传白名单暂不支持 avif；前端 public 方式部署最简单，回滚成本低 |
| `agent.md` 控制在 500 字内且仅保留“可溯源到 proposal 的核心信息” | 作为初始化提示卡，避免重复提案正文与不确定信息（尤其是排期推断） |
| `/inbound` SKU 列表复用 `analytics-table` 呈现 | 与资产页/报表页保持一致的表格视觉与可读性，避免额外引入新组件库 |
| 后端补齐 SKU CRUD：新增 `PUT/DELETE /api/v1/admin/skus/{id}` | 让物料管理闭环；删除时做引用保护，避免破坏外键与历史数据 |
| 新增错误码 `SKU_IN_USE`（409） | 删除 SKU 被引用时返回明确的业务冲突，前端可直接展示错误信息 |
| Docker 编排重构采用“低风险结构重构” | 优先：celery 服务复用 backend 镜像、Nginx 配置外置文件并通过 volume 挂载；暂不调整 `COMPOSE_PROJECT_NAME` 以避免卷数据迁移 |
| 会话结束自动刷新 Docker（规则 + 脚本） | 保证测试看到的始终是最新镜像与最新容器版本；统一用 `deploy/scripts/refresh-dev.ps1` 执行刷新与健康检查 |
| 后端容器启动自动执行 Alembic 迁移 | 避免数据库 volume 落后于代码导致 API 500；刷新后即为最新 schema |
| 前端遇到 401 自动失效会话并跳转登录 | 防止 token 失效后仍保持“假登录”状态，减少报错与困惑 |
| `/inbound` 禁止新建物料（SKU） | 物料主数据统一在 `/materials` 维护，避免多入口造成口径分叉与重复创建 |
| 新增 `.gitignore` 忽略本地环境与缓存 | 避免将 `deploy/.env`、`node_modules/`、缓存目录、临时数据库文件等推送到远端仓库 |
| 侧边栏图标统一使用 `lucide-react` 并按 route path 做映射 | 避免依赖文案匹配导致图标错位；集中在导航渲染处更易维护 |

| SKU 增加库存模式 `stock_mode`（SERIALIZED/QUANTITY） | 让库存规则由 SKU 决定，兼容耐用品与耗材两类场景 |
| QUANTITY 库存以 `sku_stock` + `sku_stock_flow` 实现 | 不依赖 Asset（SN），同时保证库存可追溯与可审计 |
| QUANTITY：申请提交只增加 reserved，出库再扣减 on_hand | 符合“预占不出库不扣现存”的业务直觉，避免误扣 |
| 库存流水导出优先 CSV（UTF-8 BOM） | Excel 直接打开不乱码，实现最稳且依赖少 |

## Issues Encountered
<!-- 
  WHAT: Problems you ran into and how you solved them.
  WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors).
  WHEN: Document when you encounter blockers or unexpected challenges.
  EXAMPLE:
    | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() |
-->
<!-- Errors and how they were resolved -->
| Issue | Resolution |
|-------|------------|
| Double highlight on `/store` vs `/store/cart` | Use longest-match rule in `isNavItemActive` |
| `/api/v1/inventory/summary` 权限调整为管理员访问 | 前端库存管理页与后端一致：库存汇总用于后台管理；测试改为使用管理员令牌并断言新字段 |

## Resources
<!-- 
  WHAT: URLs, file paths, API references, documentation links you've found useful.
  WHY: Easy reference for later. Don't lose important links in context.
  WHEN: Add as you discover useful resources.
  EXAMPLE:
    - Python argparse docs: https://docs.python.org/3/library/argparse.html
    - Project structure: src/main.py, src/utils.py
-->
<!-- URLs, file paths, API references -->
- `AGENTS.md`
- `frontend/src/routes/app-routes.tsx`
- `frontend/src/routes/blueprint-routes.ts`
- `frontend/src/pages/store-page.tsx`
- `frontend/src/pages/store-cart-page.tsx`
- `frontend/src/pages/m02-cart.ts`
- `docs/implementation/baseline.md`
- `docs/implementation/ui-blueprints.md`
- `docs/proposal/40-前端路由与页面清单.md`
- `docs/proposal/modules/09-资产生命周期管理.md`
- `frontend/nginx.conf`
- `deploy/docker-compose.yml`
- `backend/app/api/v1/routers/m00_common_auth.py`
- `backend/app/main.py`
- `backend/app/core/config.py`
- `backend/app/core/exceptions.py`
- `frontend/src/pages/inbound-page.tsx`
- `frontend/src/pages/inbound-manual-import-card.tsx`
- `frontend/src/api/index.ts`
- `backend/app/schemas/m06.py`
- `backend/app/api/v1/routers/m06_inbound_inventory.py`
- `PUT /api/v1/admin/skus/{id}`
- `DELETE /api/v1/admin/skus/{id}`
- `frontend/public/dashboard-hero-bg.avif`
- `backend/app/scripts/seed_demo_data.py`
- `deploy/.env`

## Visual/Browser Findings
<!-- 
  WHAT: Information you learned from viewing images, PDFs, or browser results.
  WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text.
  WHEN: IMMEDIATELY after viewing images or browser results. Don't wait!
  EXAMPLE:
    - Screenshot shows login form has email and password fields
    - Browser shows API returns JSON with "status" and "data" keys
-->
<!-- CRITICAL: Update after every 2 view/browser operations -->
<!-- Multimodal content must be captured as text immediately -->
- 用户截图（领用商城 UI 参考）关键信息（需在 `/store` 落地，底色可保持不变）：
- 左侧为“物料目录 · 可领用物料”区域：卡片网格展示商品（封面图 16:9 左右、圆角、卡片边框与内阴影效果）。
- 商品卡片内容：标题（品牌+型号）、规格行、库存徽标。
- 库存徽标：有库存时为绿色信息块（文案类似“可用库存: 1”）；无库存为灰色块（文案“无库存”）；无库存时按钮禁用。
- 右侧为“结算区”侧栏：标题“购物车（0）”且数量有强调色；中间为购物车空态（购物车图标 + 提示文案）。
- 侧栏表单：交付方式下拉（截图显示“自提”）、岗位输入框、申请原因多行输入框；每项前有小图标。
- 底部按钮组：左侧灰色“智能预检”，右侧蓝色主按钮“提交申请”；空购物车时整体应禁用或给出提示。
- `/inbound` 当前页面观感偏“调试控制台”：多个卡片以 JSON 形式展示结果，不符合“手动导入资产”场景的一步式操作预期；需要更明显的导入入口与扫码录入区。

---
<!-- 
  REMINDER: The 2-Action Rule
  After every 2 view/browser/search operations, you MUST update this file.
  This prevents visual information from being lost when context resets.
-->
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
