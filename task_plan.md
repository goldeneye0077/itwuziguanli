# Task Plan: 物料(/materials) + 库存(/inventory) + 入库(/inbound) 数量库存重构

## Goal
重构物料、库存与入库三者职责边界，并引入“数量库存”能力：
- `/materials`：物料(SKU) CRUD + 分类(Category) CRUD（支持大类/小类层级），不包含库存数量信息
- `/inventory`：库存管理（以数量库存为主），表格化展示 `on_hand/reserved/available`，并提供库存操作（入库/出库/盘点调整/流水导出）
- `/inbound`：保留手工入库与 OCR 入库；可跳转 `/inventory`、`/materials`；根据 SKU 库存模式走“序列号资产入库”或“数量入库”
- `/inbound`：物料主数据只允许在 `/materials` 新建；入库页仅允许选择已有物料执行入库
- 全链路一致：申请提交预占、审批驳回释放、出库扣减必须与库存联动且可追溯

## Success Criteria
- `/materials`：分类树可维护（新增/改名/移动/删除受限），SKU 表格 CRUD 可用，支持设置 `stock_mode`
- `/inventory`：页面默认展示表格；支持筛选；数量库存可入库/出库/盘点调整并落流水；流水可导出 CSV（Excel 可直接打开）
- `/inbound`：序列号资产入库流程不回归；新增数量入库入口；OCR 入库仍可用
- 数量库存对申请/审批/出库全链路生效：`reserved` 与 `on_hand` 逻辑正确
- Docker 刷新后（`deploy/scripts/refresh-dev.ps1`）可在 `http://127.0.0.1:18080` 冒烟验证通过

## Current Phase
Phase 4

## Phases

### Phase 1: Requirements & Discovery
- [x] 明确职责边界：/materials 仅主数据；/inventory 管数量；/inbound 管入库
- [x] 明确库存模式：SKU 双轨（SERIALIZED 序列号资产 / QUANTITY 数量库存）
- [x] 明确数量库存联动点：申请预占、驳回释放、出库扣减
- [x] 明确流水导出：库存操作记录可导出 Excel（优先 CSV）
- Status: complete

### Phase 2: Design
- [x] DB：`sku.stock_mode` + `sku_stock` + `sku_stock_flow`
- [x] API：/skus 可用库存兼容双模式；数量库存操作必须写流水；支持 CSV 导出
- [x] 前端：新增 `/materials`；重构 `/inventory`；扩展 `/inbound`（数量入库）
- Status: complete

### Phase 3: Implementation
- [x] 后端：新增迁移（`stock_mode` + `sku_stock` + `sku_stock_flow`）
- [x] 后端：`GET /api/v1/skus` 可用库存支持 QUANTITY
- [x] 后端：`POST /api/v1/applications` 对 QUANTITY 执行 reserved 预占
- [x] 后端：驳回/释放对 QUANTITY 回滚 reserved
- [x] 后端：出库对 QUANTITY 扣减 on_hand 与 reserved
- [x] 后端：新增数量库存操作接口（入库/出库/盘点/流水查询/CSV 导出）
- [x] 后端：新增分类 CRUD 接口（防环/删除约束）
- [x] 前端：新增 `/materials` 页面（分类树 CRUD + SKU CRUD，不展示库存数）
- [x] 前端：重构 `/inventory`（默认表格 + 筛选 + 数量库存操作 + 流水导出）
- [x] 前端：扩展 `/inbound`（数量入库 + 跳转；OCR 不回归）
- [x] 前端：`/inbound` 手工入库改为仅允许选择已有物料（禁用新建物料），物料下拉按分类层级展示；新增入库数量与 SN 联动；移除独立数量入库卡片
- Status: complete

### Phase 4: Verification
- [x] 后端 pytest：覆盖 QUANTITY 的数量库存操作（入库/出库/盘点/导出）
- [ ] 后端 pytest：覆盖 QUANTITY 的预占/释放/出库全链路（申请/审批/出库）
- [x] 前端 typecheck：`npm --prefix frontend run typecheck`
- [x] Docker 刷新：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`
- [x] Docker DB 迁移：容器启动时自动执行 `alembic upgrade head`（避免旧 volume 导致 500）
- [x] 鉴权兜底：当 access token 失效导致 401 时，前端自动清理本地会话并跳转登录
- [x] 冒烟：/materials /inventory /inbound /store /outbound 核心路径可用
- Status: in_progress

### Phase 5: Delivery
- [ ] 更新 `task_plan.md`/`findings.md`/`progress.md` 反映最终状态、决策与测试结果
- Status: pending

## Key Decisions
| Decision | Rationale |
|---|---|
| SKU 双轨库存模式（SERIALIZED/QUANTITY） | 兼容耐用品（需 SN）与耗材（只需数量）两类典型场景 |
| 数量库存禁止“裸改数字”，所有变更必须落流水 | 可追溯、可审计、便于导出与排障 |
| 流水导出优先 CSV（UTF-8 BOM） | Excel 直接打开不乱码，实现稳、依赖少 |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| `m06_inbound_inventory.py` CSV 导出末尾存在 `f\\\"...\\\"` 语法错误导致后端无法编译 | `python -m compileall backend/app` 失败定位到 `flows/export` | 修正为标准 Python 字符串（`f"..."` 等），并重新编译通过 |
| Docker 刷新后 `/api/v1/admin/skus`、`/api/v1/inventory/summary` 返回 500 | 查看 `docker compose -f deploy/docker-compose.yml logs backend` | 定位为 MySQL 未执行最新 Alembic（缺少 `sku.stock_mode` 字段）；在容器内执行 `alembic upgrade head` 修复，并将补上“后端启动自动迁移”避免复现 |

## Archive
- 2026-02-10：/inventory 资产查询表格化 + CRUD（已完成，详见 progress.md）
