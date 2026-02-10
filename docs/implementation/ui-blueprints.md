# Step 03 UI 页面蓝图与交互规范（Precision Graphite）

## 1. 范围与非目标

- 范围：在 Step 02 视觉 Token 与应用壳层基线之上，定义可直接实现的页面蓝图、交互路径、状态规范与可量化 UX 门禁。
- 非目标：本文件不实现业务逻辑、不新增后端接口、不落地具体页面组件代码。

## 2. 视觉与交互总基线（承接 Step 02）

### 2.1 Precision Graphite 视觉约束

- 色彩：统一使用 `precisionGraphiteTokens.color`，主操作使用 `accentPrimary`，危险动作使用 `statusDanger`。
- 字体：统一使用 `"IBM Plex Sans"` + `"IBM Plex Mono"`，禁止引入额外字体栈。
- 间距与密度：首屏信息采用 `sm/md/lg` 节奏，长会话场景优先稳定布局，避免跳变。
- 动效：仅允许 `durationFast/Base/Slow` 与 `easingStandard`，首屏骨架屏与主流程过渡总时长不超过 240ms。

### 2.2 企业级交互护栏（强制）

1. 不允许隐藏关键动作：关键按钮必须在首屏可见区域或固定操作栏，禁止仅通过 hover/menu 暗藏。
2. 破坏性动作必须二次确认并填写原因：`确认弹窗 + 原因输入` 缺一不可。
3. 无权限态必须展示所需角色：明确文案 `当前角色`、`所需角色`、`申请路径`。

## 3. 可量化 UX 门禁

| 指标 | 定义 | 门禁阈值 |
|---|---|---|
| TTA（Time-to-Action） | 页面首屏可交互后到主操作可点击的时间 | P95 <= 12s（审批/出库 P95 <= 10s） |
| Click Depth | 从进入页面到完成主操作的点击层级 | 主流程 <= 4，核心流程目标 <= 3 |
| Audit Visibility | 用户完成主操作后能看到审计痕迹的可见性 | 安全相关流程 100%，其余 >= 95% |

> 审计可见性定义：同页操作日志面板、时间线、或“最近操作”回执中，至少一处可见 `操作者/动作/时间/对象`。

## 4. 页面蓝图（实现就绪）

### 4.1 Dashboard（`/dashboard`）

- 页面目标：在 30 秒内让用户定位待办并进入高频动作（领用、归还、报修）。
- 首屏模块：Hero 指标条、公告看板、我的资产摘要、快捷入口区、最近操作回执。
- 主操作路径：`dashboard.quick-apply` -> 进入 `/store` 开始领用。
- 状态规范：
  - 空态：展示“暂无资产/公告”与 `去物资超市` CTA。
  - 加载态：Hero/卡片骨架屏 + 禁用主操作。
  - 错误态：顶部错误横幅 + `重试`，保留最近一次成功快照。
  - 无权限态：展示 `所需角色：USER/LEADER/ADMIN/SUPER_ADMIN`。

### 4.2 Store（`/store`、`/store/cart`、`/applications`）

- 页面目标：3 步完成“选品 -> 结算 -> 提交申请”。
- 首屏模块：分类树、筛选栏、SKU 网格、悬浮购物车、结算抽屉、AI 预检面板。
- 主操作路径：`store.add-sku` -> `store.open-checkout` -> `store.submit-application`。
- 状态规范：
  - 空态：无 SKU 时展示“调整筛选条件”，无申请时展示“去创建申请”。
  - 加载态：SKU 卡片骨架 + 购物车锁定。
  - 错误态：列表局部重试，不阻断已选购物车。
  - 无权限态：展示 `所需角色：USER/LEADER/ADMIN/SUPER_ADMIN`。

### 4.3 Approval（`/approvals/leader`、`/approvals/admin`、`/applications/:id`）

- 页面目标：90 秒内完成审批判断并写入可追溯理由。
- 首屏模块：待办队列、风险摘要、申请详情卡、审批历史时间线、审批动作面板。
- 主操作路径：`approval.open-item` -> `approval.review-risk` -> `approval.approve/reject`。
- 状态规范：
  - 空态：待办为空时展示“无待办审批”与筛选建议。
  - 加载态：队列与详情分栏骨架；动作区禁用。
  - 错误态：详情加载失败保留队列，可重新拉取详情。
  - 无权限态：
    - 领导队列显示 `所需角色：LEADER/ADMIN/SUPER_ADMIN`
    - 管理员队列显示 `所需角色：ADMIN/SUPER_ADMIN`

### 4.4 Outbound（`/outbound`、`/pickup-ticket/:applicationId`）

- 页面目标：自取核验/快递发货在 60 秒内完成并可审计回放。
- 首屏模块：待自取/待发货 Tab、核验输入区、提货券面板、发货抽屉、出库日志时间线。
- 主操作路径：`outbound.verify-ticket` -> `outbound.confirm-pickup` 或 `outbound.ship-express`。
- 状态规范：
  - 空态：无出库任务时显示“当前无待处理出库”。
  - 加载态：队列 skeleton + 核验按钮禁用。
  - 错误态：核验失败显示错误码与纠正建议（码错误/状态不匹配）。
  - 无权限态：展示 `所需角色：ADMIN/SUPER_ADMIN`。

### 4.5 Inbound（`/inbound`）

- 页面目标：OCR 入库在 120 秒内完成“上传 -> 校对 -> 确认”。
- 首屏模块：OCR 上传区、识别任务列表、校对抽屉、库存摘要、标签打印入口。
- 主操作路径：`inbound.upload-ocr` -> `inbound.review-fields` -> `inbound.confirm-inbound`。
- 状态规范：
  - 空态：暂无识别任务时提供模板与上传指引。
  - 加载态：任务行级加载 + 校对表单骨架。
  - 错误态：识别失败可重试并保留原文件预览。
  - 无权限态：展示 `所需角色：ADMIN/SUPER_ADMIN`。

### 4.6 Analytics（`/analytics`、`/copilot`）

- 页面目标：20 秒内从筛选/自然语言问题得到可行动洞察。
- 首屏模块：过滤器条、趋势图、分布图、指标卡、Copilot 查询框、结果表格。
- 主操作路径：`analytics.apply-filter` 或 `analytics.run-copilot` -> `analytics.export-report`。
- 状态规范：
  - 空态：无数据时提供“时间范围/部门”建议。
  - 加载态：图表骨架 + 查询按钮 loading。
  - 错误态：展示“数据源异常/参数非法”并支持恢复默认筛选。
  - 无权限态：展示 `所需角色：ADMIN/SUPER_ADMIN`。

### 4.7 Admin RBAC（`/admin/rbac`）

- 页面目标：在 4 次点击内完成角色权限变更并看到差异审计。
- 首屏模块：角色树、权限矩阵、用户绑定抽屉、变更差异预览、审计回执区。
- 主操作路径：`rbac.select-role` -> `rbac.toggle-permission` -> `rbac.save-role-permissions`。
- 状态规范：
  - 空态：无角色时引导创建首个角色。
  - 加载态：矩阵 skeleton + 保存按钮禁用。
  - 错误态：保存失败显示冲突字段与回滚入口。
  - 无权限态：展示 `所需角色：SUPER_ADMIN`。

### 4.8 Admin CRUD（`/admin/crud`）

- 页面目标：保持高密度管理效率，同时确保删除/覆盖动作可追责。
- 首屏模块：资源选择器、数据表格、筛选工具栏、行编辑抽屉、批处理工具栏。
- 主操作路径：`crud.select-resource` -> `crud.edit-record` -> `crud.save-record`。
- 状态规范：
  - 空态：资源为空时提供“创建首条记录”入口。
  - 加载态：表格行骨架 + 行动作禁用。
  - 错误态：行级错误提示 + 全局回滚提示条。
  - 无权限态：展示 `所需角色：ADMIN/SUPER_ADMIN`。

### 4.9 Asset Lifecycle（`/assets`、`/assets/:id`、`/assets/return`、`/assets/repair`、`/assets/transfer`、`/admin/assets/scrap`）

- 页面目标：任何资产状态变化都可在单页追踪，并可完成归还/报修/转移/报废申请。
- 首屏模块：资产清单、资产详情头部、生命周期时间线、动作面板、证据与备注区。
- 主操作路径：`asset.open-detail` -> `asset.choose-lifecycle-action` -> `asset.submit-*`。
- 状态规范：
  - 空态：无资产时提示“去物资超市领用”。
  - 加载态：详情头 + 时间线骨架。
  - 错误态：资产状态冲突时显示当前状态与建议动作。
  - 无权限态：
    - 用户侧动作显示 `所需角色：USER/LEADER/ADMIN/SUPER_ADMIN`
    - 报废动作显示 `所需角色：ADMIN/SUPER_ADMIN`

## 5. 路由覆盖核对（对齐 `40-前端路由与页面清单`）

| 路由 | 蓝图页类型 | 主要角色 | 主动作 ID |
|---|---|---|---|
| `/login` | `public-auth` | `PUBLIC` | `auth.login-submit` |
| `/` | `redirect` | `PUBLIC` | `app.redirect-dashboard` |
| `/dashboard` | `dashboard` | `USER/LEADER/ADMIN/SUPER_ADMIN` | `dashboard.quick-apply` |
| `/store` | `store` | `USER/LEADER/ADMIN/SUPER_ADMIN` | `store.add-sku` |
| `/store/cart` | `store` | `USER/LEADER/ADMIN/SUPER_ADMIN` | `store.submit-application` |
| `/applications` | `store` | `USER/LEADER/ADMIN/SUPER_ADMIN` | `store.open-application-detail` |
| `/applications/:id` | `approval` | `USER/LEADER/ADMIN/SUPER_ADMIN` | `approval.open-item` |
| `/assets` | `asset-lifecycle` | `USER/LEADER/ADMIN/SUPER_ADMIN` | `asset.open-detail` |
| `/assets/:id` | `asset-lifecycle` | `USER/LEADER/ADMIN/SUPER_ADMIN` | `asset.choose-lifecycle-action` |
| `/assets/return` | `asset-lifecycle` | `USER/LEADER/ADMIN/SUPER_ADMIN` | `asset.submit-return` |
| `/assets/repair` | `asset-lifecycle` | `USER/LEADER/ADMIN/SUPER_ADMIN` | `asset.submit-repair` |
| `/pickup-ticket/:applicationId` | `outbound` | `USER/LEADER/ADMIN/SUPER_ADMIN` | `outbound.verify-ticket` |
| `/approvals/leader` | `approval` | `LEADER/ADMIN/SUPER_ADMIN` | `approval.leader-approve` |
| `/approvals/admin` | `approval` | `ADMIN/SUPER_ADMIN` | `approval.admin-approve` |
| `/outbound` | `outbound` | `ADMIN/SUPER_ADMIN` | `outbound.confirm-delivery` |
| `/inbound` | `inbound` | `ADMIN/SUPER_ADMIN` | `inbound.confirm-inbound` |
| `/assets/transfer` | `asset-lifecycle` | `LEADER/ADMIN/SUPER_ADMIN` | `asset.submit-transfer` |
| `/admin/assets/scrap` | `asset-lifecycle` | `ADMIN/SUPER_ADMIN` | `asset.submit-scrap` |
| `/analytics` | `analytics` | `ADMIN/SUPER_ADMIN` | `analytics.apply-filter` |
| `/copilot` | `analytics` | `ADMIN/SUPER_ADMIN` | `analytics.run-copilot` |
| `/admin/rbac` | `admin-rbac` | `SUPER_ADMIN` | `rbac.save-role-permissions` |
| `/admin/crud` | `admin-crud` | `ADMIN/SUPER_ADMIN` | `crud.save-record` |

## 6. 页面级 UX 门禁目标

| 蓝图页 | TTA (P95) | Click Depth | Audit Visibility |
|---|---|---|---|
| dashboard | <= 8s | <= 2 | >= 95% |
| store | <= 12s | <= 3 | >= 99% |
| approval | <= 10s | <= 3 | 100% |
| outbound | <= 10s | <= 3 | 100% |
| inbound | <= 12s | <= 4 | 100% |
| analytics | <= 12s | <= 3 | >= 95% |
| admin-rbac | <= 12s | <= 4 | 100% |
| admin-crud | <= 12s | <= 4 | 100% |
| asset-lifecycle | <= 10s | <= 3 | 100% |
