# Step 00 规格冻结基线（Implementation Baseline）

- 冻结日期：2026-02-07
- 冻结目标：形成 Step 01 的唯一输入契约；本文件只做规格整合，不包含产品代码实现。
- 冻结版本：`baseline.v1`

## 1) 冻结范围

- [x] 冻结对象：枚举、状态机、API 模块清单、DDL 表清单、错误码/通知模板、路由页面、部署环境约束。
- [x] 冻结方式：以 proposal 文档为主、说明书为业务意图补充，形成单一可追踪基线。
- [x] 非目标：不创建后端/前端源码、不修改 proposal 原文、不新增依赖。

**冻结源文件（最小必引）**

- [x] `IT物资管理系统说明书.MD`
- [x] `docs/proposal/00-总体与通用规范.md`
- [x] `docs/proposal/10-状态机定义.md`
- [x] `docs/proposal/20-安全认证与鉴权规范.md`
- [x] `docs/proposal/30-MySQL-DDL.md`
- [x] `docs/proposal/40-前端路由与页面清单.md`
- [x] `docs/proposal/05-错误码与异常处理.md`
- [x] `docs/proposal/60-通知模板定义.md`
- [x] `docs/proposal/70-文件上传与存储规范.md`
- [x] `docs/proposal/80-部署与运维.md`
- [x] `docs/proposal/modules/01-智慧门户.md`
- [x] `docs/proposal/modules/02-物资申领.md`
- [x] `docs/proposal/modules/03-智能审批流.md`
- [x] `docs/proposal/modules/04-通知与验证.md`
- [x] `docs/proposal/modules/05-物资出库.md`
- [x] `docs/proposal/modules/06-入库与库存管理.md`
- [x] `docs/proposal/modules/07-报表与分析.md`
- [x] `docs/proposal/modules/08-后台管理.md`
- [x] `docs/proposal/modules/09-资产生命周期管理.md`

## 2) 术语与唯一真相（source of truth）

**术语（冻结）**

- SKU：物资档案定义（展示与申请粒度）。
- Asset：实物资产实例（状态流转与持有人粒度）。
- Application：申请单主实体（贯穿申领/审批/出库/完结）。
- StockFlow：库存流水（以 Asset 为粒度的动作审计）。

**唯一真相优先级（冲突裁决）**

1. `docs/proposal/00-总体与通用规范.md`（通用对象与跨模块枚举）
2. `docs/proposal/10-状态机定义.md`（状态流转与事件）
3. `docs/proposal/30-MySQL-DDL.md`（落库枚举/表结构的最终落地边界）
4. `docs/proposal/modules/*.md`（模块 API 补充）
5. `IT物资管理系统说明书.MD`（业务意图与体验约束）

**跨文件 Source-of-Truth 追踪矩阵**

| TraceID | 冻结主题 | 主真相文件 | 补充来源 | 冻结结果 |
|---|---|---|---|---|
| TRC-ENUM-001 | 全局枚举 | `docs/proposal/00-总体与通用规范.md` | `docs/proposal/30-MySQL-DDL.md`, `docs/proposal/modules/*.md` | 以 00 定义业务枚举，以 30 约束落库枚举 |
| TRC-STATE-001 | 申请/资产状态机 | `docs/proposal/10-状态机定义.md` | `docs/proposal/modules/03-智能审批流.md`, `docs/proposal/modules/09-资产生命周期管理.md` | 统一事件名与状态名，扩展事件保留但不改核心状态集合 |
| TRC-API-001 | API 模块清单 | `docs/proposal/modules/*.md` | `docs/proposal/20-安全认证与鉴权规范.md`, `docs/proposal/70-文件上传与存储规范.md` | 按模块冻结路径，冲突路径设主路径 + 别名说明 |
| TRC-DDL-001 | 数据表清单 | `docs/proposal/30-MySQL-DDL.md` | `docs/proposal/modules/09-资产生命周期管理.md`, `docs/proposal/70-文件上传与存储规范.md` | 30 为强制落库基线；补充表列为扩展候选 |
| TRC-ERR-001 | 错误码体系 | `docs/proposal/05-错误码与异常处理.md` | `docs/proposal/10-状态机定义.md` | 40xxx/50xxx + 41xxx~46xxx 作为统一命名空间 |
| TRC-NOTIFY-001 | 通知模板与渠道 | `docs/proposal/60-通知模板定义.md` | `docs/proposal/30-MySQL-DDL.md` | 模板 Key 以 60 为准；出站表字段以 30 为准 |
| TRC-UI-001 | 路由与页面 | `docs/proposal/40-前端路由与页面清单.md` | `docs/proposal/modules/*.md` | 40 作为统一路由字典，模块文档提供页面职责 |
| TRC-OPS-001 | 部署与环境 | `docs/proposal/80-部署与运维.md` | `docs/proposal/70-文件上传与存储规范.md`, `docs/proposal/20-安全认证与鉴权规范.md` | 80 为部署基线；70/20 提供对象存储与安全约束 |

## 3) 枚举冻结表

| EnumID | 枚举名 | 冻结值集合 | 级别 | 主来源 |
|---|---|---|---|---|
| E-ROLE | Role | `USER`,`LEADER`,`ADMIN`,`SUPER_ADMIN` | Core | `docs/proposal/00-总体与通用规范.md` |
| E-DELIVERY | DeliveryType | `PICKUP`,`EXPRESS` | Core | `docs/proposal/00-总体与通用规范.md` |
| E-APP-TYPE | ApplicationType | `APPLY`,`RETURN`,`REPAIR` | Core | `docs/proposal/00-总体与通用规范.md` |
| E-APP-STATUS | ApplicationStatus | `SUBMITTED`,`LOCKED`,`LEADER_APPROVED`,`LEADER_REJECTED`,`ADMIN_APPROVED`,`ADMIN_REJECTED`,`READY_OUTBOUND`,`OUTBOUNDED`,`SHIPPED`,`DONE`,`CANCELLED` | Core | `docs/proposal/00-总体与通用规范.md` + `docs/proposal/30-MySQL-DDL.md` |
| E-ASSET-STATUS | AssetStatus | `IN_STOCK`,`LOCKED`,`IN_USE`,`PENDING_INSPECTION`,`BORROWED`,`REPAIRING`,`SCRAPPED` | Core | `docs/proposal/00-总体与通用规范.md` + `docs/proposal/30-MySQL-DDL.md` |
| E-APPROVAL-NODE | ApprovalNode | `LEADER`,`ADMIN` | Core | `docs/proposal/30-MySQL-DDL.md` |
| E-APPROVAL-ACTION | ApprovalAction | `APPROVE`,`REJECT` | Core | `docs/proposal/30-MySQL-DDL.md` |
| E-STOCK-ACTION | StockFlowAction | `INBOUND`,`LOCK`,`UNLOCK`,`OUTBOUND`,`SHIP`,`RECEIVE`,`REPAIR_START`,`REPAIR_FINISH`,`SCRAP`,`CANCEL` | Core | `docs/proposal/30-MySQL-DDL.md` |
| E-ANNOUNCE-STATUS | AnnouncementStatus | `DRAFT`,`PUBLISHED`,`ARCHIVED` | Core | `docs/proposal/30-MySQL-DDL.md` |
| E-OCR-DOC-TYPE | OcrDocType | `INVOICE`,`DELIVERY_NOTE`,`OTHER` | Core | `docs/proposal/30-MySQL-DDL.md` |
| E-OCR-JOB-STATUS | OcrJobStatus | `PENDING`,`PROCESSING`,`READY_FOR_REVIEW`,`CONFIRMED`,`FAILED` | Core | `docs/proposal/30-MySQL-DDL.md` |
| E-TOKEN-REASON | TokenBlacklistReason | `LOGOUT`,`PASSWORD_CHANGED`,`ADMIN_FORCED` | Core | `docs/proposal/30-MySQL-DDL.md` |
| E-NOTIFY-CHANNEL | NotifyChannel | `EMAIL`,`DINGTALK` | Core(落库) | `docs/proposal/30-MySQL-DDL.md` |
| E-NOTIFY-STATUS | NotifyStatus | `PENDING`,`SENT`,`FAILED` | Core | `docs/proposal/30-MySQL-DDL.md` |
| E-VERIFY-TYPE | VerifyType | `QR`,`CODE`,`APPLICATION_ID` | Core(API) | `docs/proposal/modules/04-通知与验证.md` + `docs/proposal/modules/05-物资出库.md` |
| E-UPLOAD-CATEGORY | UploadCategory | `sku_cover`,`invoice`,`contract`,`avatar` | Core(API) | `docs/proposal/70-文件上传与存储规范.md` |
| E-REPORT-GRANULARITY | ReportGranularity | `DAY`,`WEEK`,`MONTH` | Core(API) | `docs/proposal/modules/07-报表与分析.md` |
| E-COPILOT-METRIC | CopilotMetric | `TOTAL_COST`,`MAX_COST`,`COUNT_APPLICATIONS`,`COUNT_ASSETS` | Core(API) | `docs/proposal/modules/07-报表与分析.md` |
| E-COPILOT-DIM | CopilotDimension | `USER`,`DEPARTMENT`,`SKU`,`CATEGORY`,`STATUS`,`MONTH` | Core(API) | `docs/proposal/modules/07-报表与分析.md` |
| E-COPILOT-OP | CopilotFilterOp | `EQ`,`IN`,`GTE`,`LTE`,`BETWEEN`,`CONTAINS` | Core(API) | `docs/proposal/modules/07-报表与分析.md` |
| E-COPILOT-SORT | CopilotSortDirection | `ASC`,`DESC` | Core(API) | `docs/proposal/modules/07-报表与分析.md` |
| E-REPAIR-URGENCY | RepairUrgency | `LOW`,`MEDIUM`,`HIGH` | Extension | `docs/proposal/modules/09-资产生命周期管理.md` |
| E-SCRAP-REASON | ScrapReason | `DAMAGE`,`OBSOLETE`,`LOST` | Extension | `docs/proposal/modules/09-资产生命周期管理.md` |
| E-ASSET-TRANSFER-STATUS | AssetTransferStatus | `PENDING`,`CONFIRMED`,`CANCELLED` | Extension | `docs/proposal/modules/09-资产生命周期管理.md` |

**冲突冻结决议**

- [x] `IN_APP` 在通知规范中存在，但 `notification_outbox.channel` 落库未包含；Step 01 按 `EMAIL`,`DINGTALK` 落库，`IN_APP` 作为后续迁移扩展。
- [x] `TIMEOUT_CANCELLED/SYSTEM_CANCELLED/CONFLICT_CANCELLED` 仅在状态机文档为“可选扩展”；Step 01 不进入核心 `ApplicationStatus` 枚举。

## 4) 状态机冻结表

**Application 状态（冻结）**

| 状态 | 含义 | 允许进入 |
|---|---|---|
| SUBMITTED | 已提交 | create_application |
| LOCKED | 已锁库 | lock_inventory/创建即锁 |
| LEADER_APPROVED | 领导通过 | leader_approve |
| LEADER_REJECTED | 领导驳回 | leader_reject |
| ADMIN_APPROVED | 管理员通过 | admin_approve |
| ADMIN_REJECTED | 管理员驳回 | admin_reject |
| READY_OUTBOUND | 待出库 | mark_ready_outbound |
| OUTBOUNDED | 已交付（自取） | confirm_pickup |
| SHIPPED | 已发货（快递） | ship_express |
| DONE | 完结 | close_done/confirm_received |
| CANCELLED | 已取消 | cancel/timeout_unlock_inventory |

**Application 事件（冻结）**

| 事件 | 前置状态 | 目标状态 | 必要副作用 |
|---|---|---|---|
| create_application | - | SUBMITTED 或 LOCKED | 生成 `pickup_code`；写 `application/application_item` |
| lock_inventory | SUBMITTED | LOCKED | 资产 `IN_STOCK->LOCKED`；写 `stock_flow=LOCK` |
| leader_approve | LOCKED | LEADER_APPROVED | 写 `approval_history` |
| leader_reject | LOCKED | LEADER_REJECTED | 解锁资产；写 `stock_flow=UNLOCK` |
| admin_approve | LEADER_APPROVED | ADMIN_APPROVED | 确认 `application_asset` |
| admin_reject | LEADER_APPROVED | ADMIN_REJECTED | 解锁资产；写 `stock_flow=UNLOCK` |
| mark_ready_outbound | ADMIN_APPROVED | READY_OUTBOUND | 生成/刷新 `pickup_qr_string` |
| confirm_pickup | READY_OUTBOUND | OUTBOUNDED | 资产 `LOCKED->IN_USE`；更新持有人；写 `stock_flow=OUTBOUND` |
| ship_express | READY_OUTBOUND | SHIPPED | 写 `logistics`；写 `stock_flow=SHIP` |
| confirm_received | SHIPPED | DONE | 写 `stock_flow=RECEIVE`（可选） |
| close_done | OUTBOUNDED | DONE | 申请完结 |
| cancel | SUBMITTED/LOCKED/LEADER_APPROVED/ADMIN_APPROVED/READY_OUTBOUND | CANCELLED | 已锁资产需解锁；写 `stock_flow=CANCEL` |
| timeout_unlock_inventory | LOCKED/LEADER_APPROVED/ADMIN_APPROVED/READY_OUTBOUND | CANCELLED | 解锁资产；`stock_flow=CANCEL` + `meta.reason=TIMEOUT_UNLOCK` |

**Asset 状态与事件（冻结）**

| 事件 | 前置状态 | 目标状态 | 备注 |
|---|---|---|---|
| inbound | - | IN_STOCK | 入库创建资产 |
| lock | IN_STOCK | LOCKED | 申请预占 |
| unlock | LOCKED | IN_STOCK | 驳回/取消/超时释放 |
| outbound_pickup | LOCKED | IN_USE | 自取交付 |
| outbound_ship | LOCKED | IN_USE | 快递发货语义 |
| return_asset | IN_USE | PENDING_INSPECTION | 归还待验收 |
| confirm_return_pass | PENDING_INSPECTION | IN_STOCK | 验收通过回库 |
| confirm_return_fail | PENDING_INSPECTION | REPAIRING | 验收不通过转维修 |
| start_repair | IN_USE | REPAIRING | 故障报修 |
| finish_repair | REPAIRING | IN_USE | 维修完成 |
| scrap | IN_STOCK/REPAIRING | SCRAPPED | 报废终态 |

## 5) API 冻结清单（按模块）

**M00 通用与认证**

- [x] `POST /api/v1/auth/login`
- [x] `POST /api/v1/auth/refresh`
- [x] `POST /api/v1/auth/logout`
- [x] `PUT /api/v1/users/me/password`
- [x] `POST /api/v1/admin/users/{id}/reset-password`
- [x] `POST /api/v1/upload`
- [x] `POST /api/v1/upload/sku-image`
- [x] `POST /api/v1/upload/invoice`
- [x] `POST /api/v1/upload/avatar`

**M01 智慧门户**

- [x] `GET /api/v1/dashboard/hero`
- [x] `GET /api/v1/announcements`
- [x] `GET /api/v1/me/assets`

**M02 物资申领**

- [x] `GET /api/v1/categories/tree`
- [x] `GET /api/v1/skus`
- [x] `GET /api/v1/me/addresses`
- [x] `POST /api/v1/me/addresses`
- [x] `POST /api/v1/applications`
- [x] `POST /api/v1/ai/precheck`

**M03 智能审批流**

- [x] `GET /api/v1/approvals/inbox`
- [x] `GET /api/v1/applications/{id}`
- [x] `POST /api/v1/applications/{id}/approve`
- [x] `POST /api/v1/applications/{id}/assign-assets`

**M04 通知与验证**

- [x] `GET /api/v1/applications/{id}/pickup-ticket`
- [x] `POST /api/v1/pickup/verify`
- [x] `POST /api/v1/admin/notifications/test`（冻结主路径）

**M05 物资出库**

- [x] `GET /api/v1/outbound/pickup-queue`
- [x] `POST /api/v1/outbound/confirm-pickup`
- [x] `GET /api/v1/outbound/express-queue`
- [x] `POST /api/v1/outbound/ship`

**M06 入库与库存管理**

- [x] `POST /api/v1/inbound/ocr-jobs`
- [x] `GET /api/v1/inbound/ocr-jobs/{id}`
- [x] `POST /api/v1/inbound/ocr-jobs/{id}/confirm`
- [x] `GET /api/v1/admin/skus`
- [x] `POST /api/v1/admin/skus`
- [x] `GET /api/v1/admin/assets`
- [x] `POST /api/v1/admin/assets`
- [x] `GET /api/v1/inventory/summary`

**M07 报表与分析**

- [x] `GET /api/v1/reports/applications-trend`
- [x] `GET /api/v1/reports/cost-by-department`
- [x] `GET /api/v1/reports/asset-status-distribution`
- [x] `POST /api/v1/copilot/query`

**M08 后台管理**

- [x] `GET /api/v1/admin/rbac/roles`
- [x] `POST /api/v1/admin/rbac/roles`
- [x] `GET /api/v1/admin/rbac/permissions`
- [x] `POST /api/v1/admin/rbac/role-bindings`
- [x] `PUT /api/v1/admin/users/{id}/roles`
- [x] `GET /api/v1/admin/crud/{resource}`

**M09 资产生命周期管理**

- [x] `POST /api/v1/assets/return`
- [x] `POST /api/v1/admin/assets/return/{id}/confirm`
- [x] `POST /api/v1/assets/repair`
- [x] `POST /api/v1/assets/transfer`
- [x] `POST /api/v1/admin/assets/scrap`

**API 冲突冻结决议**

- [x] 通知测试接口统一主路径为 `POST /api/v1/admin/notifications/test`；`/api/v1/notifications/test` 仅保留为历史别名说明，不作为 Step 01 合同输入。

## 6) DDL 冻结清单（按实体域）

**D1 用户与组织域（Core）**

- [x] `sys_user`
- [x] `department`

**D2 分类与物资档案域（Core）**

- [x] `category`
- [x] `sku`

**D3 资产与库存流水域（Core）**

- [x] `asset`
- [x] `stock_flow`

**D4 申请与审批域（Core）**

- [x] `application`
- [x] `application_item`
- [x] `application_asset`
- [x] `approval_history`
- [x] `logistics`

**D5 门户内容域（Core）**

- [x] `announcement`
- [x] `hero_banner`

**D6 RBAC 域（Core）**

- [x] `rbac_role`
- [x] `rbac_permission`
- [x] `rbac_role_permission`
- [x] `rbac_user_role`

**D7 入库/OCR 域（Core）**

- [x] `ocr_inbound_job`

**D8 安全与通知域（Core）**

- [x] `token_blacklist`
- [x] `audit_log`
- [x] `user_address`
- [x] `notification_outbox`

**D9 扩展候选（非 Step 01 强制迁移）**

- [ ] `repair_record`（模块 09 提议）
- [ ] `asset_transfer`（模块 09 提议）
- [ ] `file_upload_log`（文件上传规范提议）

## 7) 错误码与通知模板冻结

**错误码冻结（主来源：`docs/proposal/05-错误码与异常处理.md`）**

- [x] 命名空间：`40xxx/50xxx`（通用）+ `41xxx~46xxx`（业务域）。
- [x] 关键码冻结：`STOCK_INSUFFICIENT`,`APPLICATION_STATUS_INVALID`,`ALREADY_APPROVED`,`PICKUP_CODE_INVALID`,`DUPLICATE_SN`,`ASSET_LOCKED`,`PERMISSION_DENIED`,`TOKEN_EXPIRED`。
- [x] 响应结构冻结：`success=false,error.code,error.message,error.details,error.request_id,error.timestamp`。

**通知模板冻结（主来源：`docs/proposal/60-通知模板定义.md`）**

- [x] `PICKUP_TICKET`
- [x] `APPROVAL_PENDING_LEADER`
- [x] `APPROVAL_APPROVED`
- [x] `APPROVAL_REJECTED`
- [x] `SHIPPED_NOTIFY`
- [x] `TIMEOUT_CANCELLED`

**渠道与投递冻结**

- [x] 渠道定义：`EMAIL`,`DINGTALK`,`IN_APP`（业务语义层）。
- [x] 落库出站：`notification_outbox.channel` 仅 `EMAIL`,`DINGTALK`（Step 01 以 DDL 为准）。

## 8) UI 路由与页面冻结

| 路由 | 模块 | 页面职责 |
|---|---|---|
| `/login` | M00 | 登录 |
| `/dashboard` | M01 | Hero/公告/我的资产/快捷入口 |
| `/store` | M02 | 物资超市 |
| `/store/cart` | M02 | 购物车（可选独立页） |
| `/applications` | M02 | 我的申请列表 |
| `/applications/:id` | M02/M03 | 申请详情/审批历史 |
| `/assets` | M01 | 我的资产列表 |
| `/assets/:id` | M01 | 资产详情 |
| `/assets/return` | M09 | 归还申请 |
| `/assets/repair` | M09 | 故障报修 |
| `/pickup-ticket/:applicationId` | M04 | 提货券 |
| `/approvals/leader` | M03 | 领导待办 |
| `/approvals/admin` | M03 | 管理员待办 |
| `/outbound` | M05 | 出库作业台（待自取/待发货） |
| `/inbound` | M06 | OCR 入库与库存管理 |
| `/assets/transfer` | M09 | 资产转移 |
| `/admin/assets/scrap` | M09 | 报废管理 |
| `/analytics` | M07 | 报表看板 |
| `/copilot` | M07 | 自然语言查询 |
| `/admin/rbac` | M08 | RBAC 管理 |
| `/admin/crud` | M08 | 通用 CRUD 面板 |

## 9) 部署与环境冻结

**版本基线（主来源：`docs/proposal/80-部署与运维.md`）**

- [x] Python `3.12+`
- [x] Node.js `20+ LTS`
- [x] MySQL `8.0+`
- [x] Redis `7.0+`
- [x] Docker `24.0+`
- [x] Nginx `1.24+`

**容器服务基线**

- [x] `mysql`,`redis`,`minio`,`backend`,`celery_worker`,`celery_beat`,`frontend`,`nginx`
- [x] 关键依赖服务均需 `healthcheck`
- [x] 数据服务本机绑定（`127.0.0.1`）

**安全/运维约束冻结**

- [x] 密钥通过环境变量注入，禁止仓库内硬编码。
- [x] Refresh Token 使用 `HttpOnly + Secure + SameSite=Strict` Cookie。
- [x] 生产环境强制 HTTPS 与 HSTS。
- [x] MinIO 私有桶（`documents`,`qrcodes`）必须使用预签名访问。

## 10) 后续步骤输入输出契约（Step 01 的输入）

**Step 01 输入（必须）**

- [x] `docs/implementation/baseline.md`（本文件，唯一冻结契约）
- [x] 上述“冻结源文件（最小必引）”作为追溯依据

**Step 01 输出（必须满足）**

- [ ] 工程骨架中所有枚举/状态命名与本基线完全一致（不得新增核心枚举值）。
- [ ] API 路由骨架覆盖本基线 M00~M09 清单。
- [ ] 数据模型/迁移初稿至少覆盖 D1~D8 Core 表。
- [ ] 安全与部署配置遵循第 9 节冻结约束。

**Step 01 变更边界**

- 允许：新增占位实现、脚手架、空路由、空模型。
- 禁止：修改本基线冻结值；若必须变更，先提交“冻结变更提案（RFC）”并更新追踪矩阵。

---

- [ ] enums aligned
- [ ] states aligned
- [ ] api inventory complete
- [ ] ddl inventory complete
- [ ] security/deploy constraints captured
