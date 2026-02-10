深圳移动IT 物资全生命周期管理系统
开发说明书 (Development Specification)

1. 项目愿景 (Project Vision)
打造一个全生命周期、智慧自动化、极致体验的企业级 IT 资产管理平台。打破传统“进销存”模式，通过 AI 辅助决策、OCR 智能录入、电商化申领体验，实现 IT 资产管理的数字化转型。

2. 技术栈架构 (Tech Stack)
2.1 后端 (Backend)
核心框架: Python 3.10+ / FastAPI (异步高性能)

ORM: SQLAlchemy (Async) 或 Tortoise ORM

数据验证: Pydantic V2

任务队列: Celery + Redis (处理邮件、报表、AI 耗时任务)

AI 接入: LangChain / OpenAI SDK (兼容 DeepSeek/Claude/Gemini)

2.2 前端 (Frontend)
核心框架: React 18 + TypeScript + Vite

UI 组件库: Ant Design 5.0 (或 Shadcn/ui + Tailwind CSS)

状态管理: Zustand (轻量级) 或 React Query (服务端状态同步)

数据可视化: ECharts 或 Recharts

2.3 基础设施 (Infrastructure)
数据库: MySQL 8.0 (业务数据)

缓存/消息: Redis 7.0

对象存储: MinIO (存储物资图片、发票、合同)

容器化: Docker + Docker Compose

3. 数据库模型设计 (Database Schema)
在向 AI 索要代码时，请提供此 Schema 描述。

3.1 核心实体
SysUser (用户): id, 工号, 姓名, 部门ID, 角色(Admin/User), 邮箱, 密码Hash.

Category (分类): id, 名称(如笔记本), 父级ID.

SKU (物资档案 - 定义): id, 分类ID, 品牌, 型号, 规格, 参考价, 封面图URL, 安全库存阈值.

Asset (实物资产 - 实例): id, Asset_Tag(唯一资产标牌), SKU_ID, SN序列号, 状态(在库/锁定/借出/维修/报废), 当前持有人ID, 入库时间.

Application (申请单): id, 申请人ID, 类型(领用/退库/维修), 当前状态, 审批流节点, Delivery_Type(PICKUP/EXPRESS), Pickup_Code(6位数字), Pickup_QR_String.

Logistics (物流信息): id, Application_ID, 收件人, 电话, 地址(省市区+详情), 物流公司, 快递单号, 发货时间.

StockFlow (库存流水): id, Asset_ID, 动作(入库/领用/...), 操作人, 时间.

4. 功能模块详细规约 (Functional Specifications)
模块 1：智慧门户 (Smart Dashboard)
Hero 横幅: 展示 IT 政策或新设备宣传。

公告栏: 系统通知、维护公告。

我的资产: 卡片式展示当前登录用户持有的所有资产及其状态。

快捷入口: [我要领用] [故障报修] [资产归还]。

模块 2：物资申领 (电商化体验)
物资超市:

左侧分类树，右侧商品卡片（显示图片、可用库存）。

交互：点击“加入清单”（购物车模式）。

结算收银台 (Drawer/抽屉式):

物资列表: 确认申请数量。

配送方式选择:

[ 🏢 现场自取 ]: 显示领取地点（如 IT 仓库）。

[ 🚚 快递寄送 ]: 展开地址填写表单（收件人、电话、地址）。支持“保存地址/使用上次地址”。

AI 预审: 提交瞬间，后台调用 LLM 分析“职位 vs 申请物资”匹配度，生成建议。

模块 3：智能审批流 (Workflow)
流程: 申请提交 -> 库存预占(Lock) -> 领导初审 -> 管理员复审 -> 待出库 -> 完成。

初审 (领导):

界面展示申请理由 + AI 建议 (例如：“通过。该员工为视频剪辑师，申请高性能显卡符合业务需求”)。

复审 (管理员):

确认是否有实物可分配。系统自动根据 SKU 锁定状态为“空闲”的具体 Asset 实例。

模块 4：通知与验证 (Notification & Verification)
领取通知: 邮件/钉钉推送。

双码验证系统:

QR Code: 动态加密二维码，用于扫码枪/手机快速识别。

Pickup Code: 6位大号数字码（如 892-110），用于设备故障或人工核对。

模块 5：物资出库 (Smart Outbound)
管理员作业台 (分为两个 Tab):

Tab A: 待自取 (Pickup Queue):

操作：扫描员工二维码 OR 输入 6 位数字码。

弹窗：显示物资明细、SN 号。

动作：点击“确认交付” -> 扣减库存，资产状态变更为“In-Use”。

Tab B: 待发货 (Express Queue):

列表：显示所有需邮寄的订单。

操作：点击“发货录入”。

表单：填写/扫描“快递单号”，选择物流公司。

动作：提交后，状态变更为“已发货”，触发用户通知。

模块 6：入库与库存管理 (Inbound & Inventory)
AI 智能入库:

上传发票/送货单图片 -> OCR 识别物资名称、数量、金额 -> 自动填表 -> 人工校对。

赋码: 入库完成自动生成资产标签（Asset Tag QR），连接打印机打印。

库存操作: 增删改查。库存数量由 Asset 表的记录数自动聚合计算，不可手动修改数字（防作弊）。

模块 7：报表与分析 (Analytics)
可视化: 申领趋势图、部门成本占比饼图、资产状态分布图。

Copilot 查询: 支持自然语言提问（如“上个季度谁领的设备最贵？”），系统返回数据结果。

模块 8：后台管理 (System Admin)
RBAC: 角色权限控制（菜单级、按钮级）。

数据库管理: 简单的可视化 CRUD 工具。

5. UI/UX 设计指南 (Figma Design Spec)
设计风格: 现代、扁平、B端企业级风格。

主色调: 科技蓝 (Primary Blue) + 辅助色 (Success Green, Warning Gold, Error Red).

关键交互模式:

尽量少用模态框 (Modal): 复杂表单全部使用 抽屉 (Drawer) 右侧滑出，保留背景上下文。

购物车悬浮: 申领时的购物车常驻右下角或顶部，随时可查看。

扫描反馈: 扫码成功必须有清晰的声音或震动反馈 + 绿色对勾动画。

关键页面结构:

Sidebar Layout: 侧边导航栏（可收缩）。

Card Layout: 物资展示采用卡片网格。

Ticket Layout: 邮件通知中的“提货券”设计要像电影票一样精致，强调二维码和数字码。

6. 开发与 AI 协作流程 (Workflow with AI)
在开发过程中，请按照以下 Prompt 策略向 Claude/Gemini 提问：

阶段 1: 基础设施 (Infrastructure)
Prompt: "作为 Python 全栈架构师，请基于 FastAPI, SQLAlchemy, Pydantic V2 和 MySQL 设计 IT 物资系统的数据库模型。请包含 User, SKU, Asset, Application, Logistics 五个核心表。Application 表需包含 delivery_type (枚举: PICKUP, EXPRESS) 和 pickup_code 字段。Logistics 表需关联 Application 存储快递信息。请生成完整的 models.py 代码。"

阶段 2: 业务逻辑 (Service Logic)
Prompt: "请编写 '物资申领服务' 的核心逻辑。包含一个 create_application 函数。需求：1. 接收前端传来的 SKU 列表和配送信息；2. 校验 delivery_type，若为快递则必须填写地址；3. 随机生成 6 位数字领取码；4. 开启数据库事务锁定库存。请使用 Python 编写。"

阶段 3: 前端实现 (Frontend Implementation)
Prompt: "请使用 React + Ant Design 实现一个'申领结算抽屉'组件。界面包含物资列表，以及一个 Segmented Control 切换'自取/快递'。当切换到快递时，动态显示收件人、电话、地址表单。请处理表单校验逻辑。"

阶段 4: AI 智能集成 (AI Integration)
Prompt: "我需要一个 AI 辅助函数。使用 OpenAI 格式的 API。输入是员工职位和申请理由，输出是一个 JSON，包含 recommendation (Pass/Reject) 和 reason。请写出 Python 调用代码。"

7. 部署与运维 (Deployment)
Docker Compose: 编排 web, worker (celery), db, redis, minio 服务。

Nginx: 反向代理，处理静态资源和 API 转发。

CI/CD: 代码提交自动构建 Docker 镜像。