## V1 需求确�?(2026-02-24 后台物料是否可见)
- 用户要求：在 `/inventory` 的后台物料列表操作列新增“是否可见”功能�?- 目标行为：当 SKU 为“可见”时，在领用商城 `/store` 的物料列表中呈现；当为“不可见”时，商城不展示该物料�?- 权限边界：仅后台角色（具�?`INVENTORY:WRITE`）可切换可见性；普通用户仅受展示过滤影响�?
## V1 实施决策
- 数据落点：在 `sku` 表新增布尔字�?`is_visible`，默�?`true`，用于控制商城展示�?- 管理端更新：复用现有 `PUT /api/v1/admin/skus/{id}` 更新接口，在 payload 中新�?`is_visible`�?- 商城过滤：`GET /api/v1/skus` 仅返�?`is_visible=true` 的记录；管理�?`GET /api/v1/admin/skus` 不过滤，便于后台管理�?
## V1 前端落地要点
- `/inventory` 的后台物料列表操作列新增“设为可�?设为不可见”按钮，点击后调�?`updateAdminSku` 立即生效�?- 为避免“编辑物料”时覆盖可见性，前端在编辑提交时会携带当�?`is_visible` 值（不提供单独的编辑输入控件）�?
## O1 出库确认报错原因�?026-02-24�?- 报错“申请单状态不支持执行 confirm_pickup。”的直接原因：后�?`POST /api/v1/outbound/confirm-pickup` 仅允�?`ApplicationStatus.READY_OUTBOUND`�?- `/api/v1/outbound/pickup-queue` 会包�?`READY_OUTBOUND` �?`ADMIN_APPROVED` 两类申请单；其中 `ADMIN_APPROVED` 通常表示“已审核但仍待分配资产”，因此不能直接出库�?- 处理方式：先到管理员审批页完成资产分配（`assign-assets`），使状态进�?`READY_OUTBOUND` 后再执行确认自提/发货�?
## A1 ???? (2026-02-12 ????)
- ?????`/store` ????????????????????????
- ???????????????????breadcrumb??????????????

## A1 ????
- ? `store-shell` ??????????
- `store-shell__catalog-head` ?????????
- `store-shell__sidebar` ?????????????????
## P1 ???? (2026-02-12 ??????)
- ????????????????????????????????????
- ?????????? `sessionStorage`?????????????

## P1 ????
- ? `useM02Cart` ?????? `localStorage`???????? key?`pgc-m02-cart-v1:{userId}`????
- ????????? `localStorage` ???? `sessionStorage` ??????????????? `localStorage`?
�?# B1 需求确�?(2026-02-12 顶部 M 文案移除)
- 用户要求：删除每个页面最上方横幅中的 `M` 开头文案（示例：`M02 商城`）�?- 范围：仅删除顶部模块标识，不影响页面标题和功能区标签�?
## B1 实施决策
- 批量移除页面中形�?`<p className="app-shell__section-label">Mxx ...</p>` 的节点�?- 不修�?`useM02Cart` 等代码标识符；不删除�?`Mxx` 的普通标签（如“提示”“筛选栏”）�?
## B1 执行结果与阻�?- 代码检索结果：`frontend/src/pages` 中已�?`Mxx` 顶部标签文案，当前仅存在 `useM02Cart` 这类代码命名�?- 发布阻塞：Docker 刷新时前端镜像构建失败，报错�?`frontend/src/pages/store-page.tsx:60:87 Unterminated string literal`�?- 影响判断：该阻塞属于历史遗留语法损坏，不是本次“移�?M 文案”引入�?
## B1 收尾结论�?026-02-12�?- 已修复前端语法损坏页并恢复可构建状态：`store-page.tsx`、`assets-page.tsx`、`asset-detail-page.tsx`、`asset-lifecycle-page.tsx`、`inbound-page.tsx`、`pickup-ticket-page.tsx`、`admin-crud-page.tsx`�?- 已补回关键业务改动：`StorePage` 继续使用按用户隔离购物车（`useM02Cart(currentUserId)`）�?- 顶部 `Mxx` 文案已完成清理，检索无命中：`rg -n 'app-shell__section-label\">M[0-9]{2} ' frontend/src/pages`�?- 验证通过：`npm --prefix frontend run typecheck`、`deploy/scripts/refresh-dev.ps1`、`/healthz`、`/api/healthz`�?## U1 需求确�?(2026-02-12 购物车用户隔�?
- 用户反馈：领用商城与购物车跨账号共享同一车内容，违反数据隔离预期�?- 目标行为：购物车按登录用户独立隔离；A 用户不可�?B 用户购物车�?
## U1 根因与决�?- 根因：`useM02Cart` 当前使用固定 key `pgc-m02-cart-v1` 写入 `sessionStorage`，未纳入用户身份�?- 决策：将购物车存�?key 改为 `pgc-m02-cart-v1:{userId}`，并在用户ID变化时重新加载对应购物车�?- 决策：调用方（商城页、购物车页）统一传入 `state.user?.id`，只改前端存储逻辑，不改后端接口�?## C2 验收结论 (2026-02-12 购物车缩略图尺寸下调)
- `/store/cart` 物料清单缩略图已按约一半尺寸下调（新尺寸：`96x54`）�?- 实现方式为购物车页面独立样式�?`store-cart-cover`，不会影响审批页与申请详情页的图片显示�?- 本次仅改前端展示层，不涉及接口与数据逻辑�?## C1 需求确�?(2026-02-12 购物车缩略图)
- 用户要求：`/store/cart` 的物料清单缩略图太大，先缩小一半观察效果�?
## C1 实施决策
- 仅改 `store-cart-page.tsx` �?`index.css`：为购物车图片使用独立类名，避免影响审批页与申请详情页�?- 本次仅调整展示尺寸，不改接口、不改数据结构�?## Z2 验收结论 (2026-02-12 出库记录列表文案与交互精简)
- “出库记录列表”已移除“向�?向右”按钮，保留横向滚动条作为唯一横向浏览入口�?- 表头已从英文字段名改为中文显示名，逐列对应原有字段含义�?- 本次仅修改前端展示层，不涉及后端接口、导出字段和数据逻辑�?## Z1 需求确�?(2026-02-12 出库记录表头中文�?
- 用户要求移除“出库记录列表”的“向�?向右”按钮，保留表格横向滚动能力�?- 用户要求出库记录列表表头从英文字段名改为中文展示名�?
## Z1 实施决策
- 仅修改前端页面展示层：`frontend/src/pages/outbound-page.tsx`�?- 移除按钮及其 `useRef/scrollBy` 关联逻辑，避免保留无用代码�?- 表头逐列改为中文，不改数据字段、不改导�?CSV 字段名与后端接口�?## Y2 验收结论 (2026-02-12 滚动条不可见根因修复)
- 已修复容器收缩约束：`app-shell__card`、`page-table-wrap`、`outbound-record-table-wrap`、`admin-crud-table-wrap` 补齐 `min-width: 0` / `max-width: 100%`�?- 已修复提示区布局：`table-scroll-hint-row` 改为稳定双列网格，左右按钮不再被文本挤出可视区�?- `/outbound` �?`/admin/crud` 现在都可通过横向滚动查看完整列；同时保留“向�?向右”按钮辅助操作�?- 本轮仅改前端样式与交互，不改后端接口和业务数据�?## Y1 根因定位 (2026-02-12)
- 截图显示列右侧被裁切，但容器内未出现可用横向滚动入口�?- 判断为布局收缩约束问题：网格项�?`min-width:auto` 下被内容撑宽，内层滚动容器无法形成有�?overflow�?
## Y1 修复决策
- 对卡片与表格容器�?`min-width: 0` / `max-width: 100%`，确保容器能在视口内收缩并产生横向滚动�?- 将滚动提示区改为 `grid` 两列布局，保证“向�?向右”按钮不被文本挤出可视区域�?- 保持 API 与业务逻辑不变，仅修复样式与可用性�?## X2 验收结论 (2026-02-12 表格横向可用�?
- 出库记录表（`/outbound`）新增“向�?向右”按钮，不再依赖系统滚动条是否可见�?- 出库记录与数据面板表格均增强滚动条轨道和滑块可视化，横向滚动入口更明显�?- 相关改动仅涉及前端交互和样式层，不影响后端接口、权限和数据逻辑�?## X1 问题复现与决�?(2026-02-12)
- 用户反馈“表格后面的数据看不到”，截图显示出库记录列已溢出但滚动入口不明显�?- 根因倾向于滚动条可见性与交互可发现性问题，而非数据未返回�?
## X1 修复策略
- 为出库记录表增加显式左右滚动按钮，保证在系统隐藏滚动条时依然可操作�?- 增强出库记录与数据面板结果表格的滚动条轨�?颜色样式，提升可见性�?- 保持接口与业务逻辑不变，仅做前端交互与样式增强�?## D2 验收结论 (2026-02-12 数据面板横向滚动)
- 已为数据面板结果容器增加显式横向滚动与滚动条可视化样式�?- 已将结果表格设置为按内容扩展宽度，并保持最小宽度占满容器�?- 已将单元格设置为不换行，避免列内容被压缩导致可读性下降�?- 本次改动仅影响样式层，不影响数据 CRUD 逻辑�?## D1 需求发�?(2026-02-12 数据面板横向滚动)
- 用户要求“数据面板的数据结果表格也增加横向滚动条”�?- 目标区域�?`/admin/crud` 页的结果表格容器 `.admin-crud-table-wrap`�?- 当前虽有 `overflow: auto`，但表格仍存在宽度与换行导致的可读性问题，需要明确横向滚动策略�?
## D1 方案决策
- 仅改样式层，不改 API 与页面逻辑�?- �?`.admin-crud-table-wrap` 显式设置 `overflow-x: auto`，并补充滚动条可视化样式�?- �?`.admin-crud-table-wrap .analytics-table` 设置 `width: max-content` + `min-width: 100%`，使列多时自然横向扩展�?- �?`.admin-crud-table-wrap .analytics-table th, td` 设置 `white-space: nowrap`，确保横向滚动承载多列展示�?## U2 验收结论 (2026-02-12 出库记录滚动�?
- 已在 `frontend/src/styles/index.css` 为出库记录容器增加显式横向滚动策略�?- 已增加滚动条可视化样式，提升可发现性�?- 已将出库记录表格单元格设置为不换行，配合横向滚动完整展示多列字段�?- 本次改动仅涉及样式层，不影响接口、权限与业务逻辑�?## U1 需求发�?(2026-02-12 出库记录滚动�?
- 用户反馈“出库记录列表”需要明确的横向滚动条，当前超宽表格在部分分辨率下滚动可见性不足�?- 页面结构已具备包裹容�?`outbound-record-table-wrap`，适合在样式层增强，不需要改动接口和组件结构�?
## U1 方案决策
- 仅做前端样式增强，不改后端与 API�?- �?`outbound-record-table-wrap` 显式设置 `overflow-x: auto`，并保持纵向可用滚动�?- 为出库记录表�?单元格增�?`white-space: nowrap`，确保以横向滚动承载多列而非挤压换行�?- 增加滚动条高度样式，提升可见性�?## O3 收尾发现与结�?(2026-02-12 出库记录)
- 本轮需求“出库执行页新增出库记录（含申请人快照）+ 导出”已闭环，不需要新增审计表即可落地�?- 数据来源按计划复�?`stock_flow + sku_stock_flow`，并统一成明细粒度记录�?- 申请人信息口径已固定：仅来自 `application` 快照字段；历史数据无快照时保持空值�?- 权限策略已落地：`ADMIN/SUPER_ADMIN` 可访问，且以 `OUTBOUND:READ` 做能力门禁�?- 前端已提供完整可视化能力：筛选、分页、全字段表格、CSV 导出（导出当前筛选结果）�?
## O3 验收结论
- 后端接口、前端页面、权限映射、自动化测试、Docker 刷新与健康检查均通过�?- 当前可进入业务验证阶段：�?`/outbound` 页签直接审计自提与快递出库动作�?## O2 实施结果 (2026-02-12 出库记录)
- 已在后端落地�?  - `GET /api/v1/outbound/records`
  - `GET /api/v1/outbound/records/export`
- 记录口径已按明细粒度统一�?  - 序列号资产：来自 `stock_flow`（`OUTBOUND`/`SHIP`�?  - 数量库存：来�?`sku_stock_flow`（`OUTBOUND`/`SHIP`�?- 字段覆盖已按计划补齐：记录字段、申请字段、申请人快照字段、物流字段、物料字段、资产字段、数量字段、操作者字段�?- 申请人信息严格遵循快照口径：仅读�?`application` 快照列；历史无快照保持空值，不回�?`sys_user`�?- 权限链路已补齐：
  - 后端 records/export 接口要求 `ADMIN/SUPER_ADMIN`，且�?ADMIN 追加 `OUTBOUND:READ`�?  - 前端 route/action 映射补充 `/outbound`、`outbound.fetch-records`、`outbound.export-records`�?  - 管理端默�?UI Guard 与演示种子数据已�?`OUTBOUND:READ`�?- 前端 `/outbound` 已新增“出库记录”Tab，支持条件筛选、分页、全字段表格展示�?CSV 导出（导出当前筛选条件结果）�?
## O2 验证结论
- `npm --prefix frontend run typecheck`：PASS
- `pytest backend/tests/test_step13_m04_m05.py -q`：PASS（含 records/export 新增用例�?- `pytest backend/tests/test_step17_m08_admin.py -q`：PASS
- Docker 刷新与健康检查：PASS（`/healthz=ok`，`/api/healthz={"status":"ok"}`�?## O1 瀹炴柦鍙戠幇 (2026-02-12 鍑哄簱璁板綍)
- 褰撳墠绯荤粺宸插啓鍑哄簱娴佹按锛氬簭鍒楀彿璧勪骇�?`stock_flow`锛屾暟閲忓簱瀛樺�?`sku_stock_flow`�?- 褰撳墠缂哄彛鏄€滅粺涓€鍑哄簱璁板綍鏌ヨ涓庡鍑衡€濇帴鍙ｏ紝浠ュ強 `/outbound` 椤甸潰鍐呯殑璁板綍瑙嗗浘�?- 鐢宠浜轰俊鎭彛寰勫凡閿佸畾锛氫粎浣跨�?`application` 蹇収瀛楁锛屼笉鍥為€€ `sys_user` 褰撳墠璧勬枡�?- 鍘嗗彶鏃犲揩鐓х敵璇峰崟鍦ㄨ褰曢〉灞曠ず涓虹┖鍊硷紝涓嶅仛鍥炲～�?
## O1 鏈疆鍐崇瓥 (2026-02-12 鍑哄簱璁板綍)
- 涓嶆柊澧炲璁℃柊琛紝澶嶇�?`stock_flow + sku_stock_flow` 鍋氱粺涓€璁板綍瑙嗗浘銆?- 璁板綍绮掑害閲囩敤鈥滄槑缁嗙矑搴︹€濓紝姣忚涓€鏉¤祫浜?鏁伴噺搴撳瓨鍑哄簱鍔ㄤ綔�?- 鍔熻兘鏀惧湪 `/outbound` 绗笁涓?Tab鈥滃嚭搴撹褰曗€濓紝骞舵敮鎸佹寜绛涢€夋潯浠跺鍑?CSV�?## C1 瀹炴柦鍙戠幇 (2026-02-12 鏁版嵁闈㈡澘鍙鍖?CRUD)
- 褰撳�?`/admin/crud` 鍐欐搷浣滃師鍏堜緷璧栤€滃垱�?JSON / 鏇存�?JSON鈥濇枃鏈锛屼笉绗﹀悎鈥滃彲瑙嗗�?CRUD鈥濊姹傘€?- 鍚庣�?`m08_admin` 宸叉敮鎸佸叚绫昏祫婧?`POST/PUT/DELETE`锛屾湰杞棤闇€鏀瑰悗绔崗璁紝鍙渶鏀瑰墠绔氦浜掑眰�?- `applications.express_address_snapshot` 涓哄璞″瓧娈碉紱鏈疆鏀逛负鍙鍖栧湴鍧€瀛愬瓧娈靛苟鍦ㄦ彁浜ゆ椂缁勮瀵硅薄銆?- 琛ㄦ牸琛屽凡瀛樺�?`id` 瀛楁锛屽彲鐩存帴鎵胯浇鈥滅紪杈戣浇�?+ 琛屽唴鍒犻櫎鈥濓紝鏃犻渶棰濆�?ID 杈撳叆鍖恒€?
## C1 鏈疆鍐崇瓥 (2026-02-12 鏁版嵁闈㈡澘鍙鍖?CRUD)
- 缁存寔鍚庣鎺ュ彛涓嶅彉锛屽墠绔噰鐢ㄢ€滄寜璧勬簮瀛楁鍏冩暟鎹姩鎬佹覆鏌撹〃鍗曗€濄€?- 鍒涘缓涓庣紪杈戦兘璧扮粺涓€瀛楁瑙ｆ瀽鍣紝閬垮厤姣忎釜璧勬簮閲嶅�?payload 閫昏緫銆?- 鍒犻櫎鎿嶄綔浠呬繚鐣欎负缁撴灉琛ㄦ牸涓殑琛屾寜閽紝涓嶅啀鎻愪�?JSON/ID 鎵嬪伐杈撳叆妯″紡�?
## C1 瀹屾垚鎯呭喌 (2026-02-12 鏁版嵁闈㈡澘鍙鍖?CRUD)
- 宸插畬鎴愶細`admin-crud-page` 绉婚�?JSON textarea锛屾柊澧炲彲瑙嗗寲鍒涘缓/缂栬緫鍙岄潰鏉裤�?- 宸插畬鎴愶細鍏被璧勬簮瀛楁鍖栨覆鏌擄紙鍚灇涓句笅鎷夈€佹暟鍊兼牎楠屻€佸彲绌哄瓧娈垫竻绌猴級銆?- 宸插畬鎴愶細`applications` 鍦板潃蹇収鏀瑰彲瑙嗗寲杈撳叆骞惰嚜鍔ㄧ粍�?`express_address_snapshot`�?- 宸插畬鎴愶細缁撴灉琛ㄦ牸鏂板鈥滅紪�?鍒犻櫎鈥濇搷浣滃垪锛屽苟鏀寔涓€閿浇鍏ョ紪杈戣〃鍗曘€?- 宸插畬鎴愶細鍓嶇绫诲瀷妫€鏌ラ€氳繃锛坄npm --prefix frontend run typecheck`锛夈�?- 宸插畬鎴愶細Docker 鍒锋柊涓庡仴搴锋鏌ラ€氳繃锛坄/healthz=ok`銆乣/api/healthz={"status":"ok"}`锛夈�?
## C1 棰濆鍐崇瓥 (2026-02-12 鏋勫缓绋冲畾�?
- 鍓嶇�?Docker 鏋勫缓闃舵涓存椂鎷夊彇 `vite` 鏃讹紝榛樿 `registry.npmjs.org` 鍦ㄥ綋鍓嶇綉缁滅幆澧冧笅澶氭�?`ECONNRESET`�?- 涓轰繚璇佷細璇濈粨鏉熻嚜鍔ㄥ埛鏂板彲绋冲畾鎵ц锛屽皢 `frontend/Dockerfile` �?`vite` 瀹夎鍒囨崲�?`https://registry.npmmirror.com`锛屽苟璁剧疆 `strict-ssl=false`�?## R2 鏂板瀹炴柦鍙戠幇 (2026-02-11 缁х画)
- 宸插畬鎴愶細`sys_user` 鎵╁睍瀛楁銆乣application` 鏍囬涓庡揩鐓у瓧娈点€乣/api/v1/me/applications`銆乣/api/v1/me/departments`�?- 宸插畬鎴愶細`ApplicationsPage` 鏀瑰悗绔暟鎹簮锛屼笉鍐嶄娇鐢ㄦ湰鍦?`m02-storage`�?- 宸插畬鎴愶細瀹℃壒椤垫敼涓衡€滄煡鐪嬭鎯呭脊绐?+ 瀹℃壒鎰忚涓嬫�?+ 椹冲洖鍘熷洜蹇呭～鈥濄€?- 宸插畬鎴愶細`/admin/crud` 琛ラ�?`POST/PUT/DELETE`锛屽苟�?`applications` 鎵ц杞垹闄わ紙`CANCELLED`锛夈�?- 宸插畬鎴愶細`/admin/crud` 璺敱涓庡悗绔闂帶鍒舵敹鏁涗负�?`SUPER_ADMIN`�?
## R2 鏈疆鍐崇瓥 (2026-02-11 缁х画)
- 鍚庣浼樺厛锛氬厛琛ラ綈 `m03` 璇︽儏鍝嶅簲�?`m08` CRUD 鍐欐帴鍙ｏ紝鍐嶅仛鍓嶇鑱旇皟锛屽噺灏戝弽澶嶆敼鎺ュ彛銆?- 瀹℃壒璇︽儏寮圭獥澶嶇敤 `fetchApplicationDetail`锛岄伩鍏嶇淮鎶や袱濂楄鎯呯粨鏋勩€?- 鏁版嵁闈㈡澘 CRUD 閲囩敤鈥滈€氱敤 JSON 琛ㄥ�?+ 涓婚敭鍥炲～鈥濈殑瀹炵幇鏂瑰紡锛屽厛淇濊瘉鍔熻兘闂幆锛屽啀杩唬鏄撶敤鎬с€?- 鏀跺熬楠屾敹鍥哄畾闂幆锛歚python -m compileall`銆乣npm typecheck`銆乣pytest`銆乣deploy/scripts/refresh-dev.ps1`�?# Findings & Decisions

## R2 闇€姹傝ˉ�?(2026-02-11)
- 鐢ㄦ埛鎵╁睍瀛楁锛歚sys_user` 鏂板�?`department_name`銆乣section_name`銆乣mobile_phone`銆乣job_title`�?- 鍟嗗煄鍙充晶缁撶畻鍖烘敮鎸佸揩閫掑唴鑱旀彁浜わ細`EXPRESS` 鏃跺湪褰撳墠椤靛睍绀衡€滃凡淇濆瓨鍦板潃/鏂板湴鍧€鈥濆苟鍙洿鎺ユ彁浜ょ敵璇枫€?- 璐墿杞﹂〉鐗╂枡娓呭崟琛ㄦ牸鍖栵細鏄剧ず缂╃暐鍥俱€佸悕绉般€佸瀷鍙枫€佸搧鐗屻€佽鏍笺€佹暟閲忋�?- 鎴戠殑鐢宠鏀逛负鍚庣鎸夊綋鍓嶇敤鎴锋煡璇紝绂佹璇诲彇鏈�?`sessionStorage` 鐢宠缂撳瓨浣滀负鏁版嵁婧愩�?- 鐢宠鏍囬鑷姩鐢熸垚骞跺叏閾捐矾鏄剧ず锛氬叧浜巤鐗╂�?銆佺墿鏂?}鐨勭敵璇凤紙瓒呰繃涓ら」鏄剧ず鈥滅瓑N椤光€濓級銆?- 鐢宠璇︽儏缁熶竴鍙岃〃锛氱敵璇蜂汉淇℃伅�?+ 棰嗙敤鐗╂枡娓呭崟琛ㄣ€?- 棰嗗瀹℃�?绠＄悊鍛樺鎵癸細鏌ョ湅璇︽儏鏀规ā鎬佹锛涘鎵规剰瑙佹敼涓嬫媺锛堝悓鎰?椹冲洖锛夛紱椹冲洖鏃堕┏鍥炲師鍥犲繀濉�?- 鏁版嵁闈㈡澘鍗囩骇涓哄彲 CRUD锛岃闂潈闄愪�?`SUPER_ADMIN`锛沗applications` 鍒犻櫎鏀硅蒋鍒犻櫎锛堢姸鎬佺�?`CANCELLED`锛夈�?
## R2 鐜扮姸鍙戠幇 (2026-02-11)
- 鍚庣灏氭湭鎸佷箙鍖栫敵璇锋爣棰樹笌鐢宠浜哄揩鐓э紱`/api/v1/applications` 鍒涘缓鍚庝粎杩斿洖鍩虹瀛楁銆?- 鍓嶇�?`ApplicationsPage` 浠嶈鍙?`frontend/src/pages/m02-storage.ts`锛屾棤娉曚繚璇佲€滀粎褰撳墠鐢ㄦ埛鍙鈥濄�?- 瀹℃壒椤?`ApprovalsPage` 浠嶄娇鐢ㄨ烦杞鎯呴〉锛屾湭瀹炵幇璇︽儏寮圭獥銆?- `AdminCrudPage` 褰撳墠涓哄彧璇绘煡璇紝鍚庣浠呮湁 `GET /api/v1/admin/crud/{resource}`�?
## R2 鍐崇�?(2026-02-11)
- 鍏堝仛鍚庣鏁版嵁缁撴瀯涓庢帴鍙ｏ紝鍐嶇粺涓€鏀瑰墠绔〉闈紝閬垮厤鍓嶇骞惰鏀归€犳湡闂存帴鍙ｅ弽澶嶈皟鏁淬€?- `applications` 鍒犻櫎閲囩敤杞垹闄わ紝涓嶅仛纭垹闄わ紝淇濈暀瀹¤涓庢祦绋嬪彲杩芥函鎬с�?- 鏁版嵁闈㈡澘鏉冮檺浠ヨ鑹蹭负绗竴绾︽潫锛堜粎 `SUPER_ADMIN`锛夛紝骞跺湪鍚庣浜屾鏍￠獙銆?## Requirements
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
- 璁ㄨ骞惰惤鍦扮墿鏂?搴撳�?鍏ュ簱涓夎€呴€昏緫�?  - `/materials`锛歋KU CRUD + 鍒嗙�?CRUD锛堟敮鎸佸ぇ�?灏忕被灞傜骇锛夛紝涓嶅寘鍚簱瀛樻暟閲忎俊�?  - `/inventory`锛氬簱瀛樼鐞嗭紙浠ユ暟閲忓簱瀛樹负涓伙級锛屾敮鎸?`on_hand/reserved/available`锛屼笖搴撳瓨鏁伴噺蹇呴』涓庡嚭鍏ュ簱鑱斿姩
  - `/inbound`锛氫繚鐣欐墜宸ュ叆搴撲笌 OCR 鍏ュ簱鍙敤锛涘彲璺宠浆�?`/inventory`銆乣/materials`
- 鏂板�?SKU 鍙岃建搴撳瓨妯″紡锛歚SERIALIZED`锛堝簭鍒楀彿璧勪骇锛変�?`QUANTITY`锛堟暟閲忓簱瀛橈�?- 搴撳瓨鎿嶄綔璁板綍闇€瑕佹敮鎸佸鍑猴紙Excel 鏂瑰悜锛夛紝浼樺厛瀹炵�?CSV锛圲TF-8 BOM�?
- 鎶婃牴鐩綍涓嬬�?`鑳屾�?.avif` 鐢ㄤ�?`http://127.0.0.1:18080/dashboard` �?hero 妯箙鑳屾櫙�?- 鎶婃牴鐩綍涓嬬�?4 寮犲晢鍝佸浘鏀捐繘 `http://127.0.0.1:18080/store` 瀵瑰簲鍟嗗搧鍗＄墖鐨勫浘鐗囨涓細
  - `E:\\itwzgl1\\鑱旀�?png`
  - `E:\\itwzgl1\\鎴村皵鏄剧ず�?png`
  - `E:\\itwzgl1\\閫昏緫閿洏.png`
  - `E:\\itwzgl1\\榧犳�?png`
- 椤圭洰鍒濆鍖栵細瑙ｆ�?`docs/proposal/**` 鎻愭鏂囨。锛屾彁鍙栭」鐩悕�?鏍稿績鐩爣銆佸叧閿氦浠樼墿涓庢椂闂磋妭鐐广€佹牳蹇冪害鏉熸潯浠讹紝骞跺皢姒傜暐鍐呭鍐欏叆鏍圭洰�?`agent.md`锛堜腑鏂囥€?00瀛楀唴锛夈€?- `/inbound`锛氱偣鍑烩€滄煡璇㈢墿鏂欌€濆悗涓嶅啀灞曠ず鍘熷 JSON 鍒楄〃锛屾敼涓哄彲瑙嗗寲琛ㄦ牸锛屽苟鎻愪�?SKU �?CRUD锛堝�?�?鏀?鍒狅紝鍚皝闈㈠浘涓婁紶/棰勮锛夈€?- `/inbound` 椤甸潰澶噧鑲匡細灏嗏€滃簱瀛樼浉鍏冲姛鑳解€濓紙SKU 绠＄悊銆佽祫浜у垱�?鏌ヨ銆佸簱瀛樻眹鎬伙級鎷嗗垎涓虹嫭绔嬮〉闈?`/inventory`锛涘乏渚у鑸皢鈥滃叆搴撲笌搴撳瓨鈥濇媶鎴愪袱涓彍鍗曢」锛歚鍏ュ簱`�?inbound锛変�?`搴撳瓨绠＄悊`�?inventory锛夈�?- `/inventory` 椤甸潰澧炲己�?  - 搴撳瓨姹囨€讳粠 JSON 杈撳嚭鍗囩骇涓鸿〃鏍硷紝浜や簰瀵归綈鈥滅墿鏂欙紙SKU锛夋煡璇笌绠＄悊鈥濓紝骞舵彁渚涘彲鎿嶄綔鐨?CRUD 鑳藉姏锛堜互 SKU 涓虹矑搴︾紪�?鍒犻櫎锛屽垱寤烘部鐢ㄢ€滄柊澧炵墿鏂欌€濓級�?  - 椤甸潰鎵撳紑榛樿鍔犺浇骞跺睍绀?SKU 琛ㄦ牸涓庡簱瀛樻眹鎬昏〃鏍笺€?  - 鈥滄煡璇㈢墿鏂欌€濃€滄煡璇㈠簱瀛樻眹鎬烩€濋兘鏂板鎸夋潯浠剁瓫閫夋煡璇㈢殑鏉′欢琛ㄥ崟銆?  - 鈥滄煡璇㈣祫浜р€濈粨鏋滀�?JSON 杈撳嚭鍗囩骇涓鸿〃鏍硷紝骞惰ˉ榻愯祫浜?CRUD锛堢紪杈?鍒犻櫎锛涘垱寤烘部鐢ㄧ幇鏈夆€滃垱寤鸿祫浜р€濓級銆?- Docker锛氶噸鏋?`deploy/docker-compose.yml` 涓墠鍚庣鏈嶅姟缂栨帓锛坆ackend/frontend/nginx锛夛紝鎻愰珮鍙淮鎶ゆ€у苟鍑忓皯閲嶅鏋勫缓�?- 鍓嶇锛氬乏渚у鑸彍鍗曟爮鍥炬爣缁熶竴鏀圭敤 `lucide-react`锛屽苟鎸夌敤鎴风粰鍑虹殑鏄犲皠閫愰」搴旂敤�?- Fix nav highlight so clicking "棰嗙敤鍟嗗煄" then "棰嗙敤璐墿�? does not keep both highlighted.
- Add a repo-local rule: any workspace change must follow `planning-with-files` and update `task_plan.md`, `findings.md`, `progress.md`.
- Add a repo-local rule: all documentation writing should be in Chinese by default.
- 鏂板浠撳簱绾ц鍒欙細姣忔浼氳瘽缁撴潫鏃讹紝濡傛湰杞湁杩愯鐩稿叧鏀瑰姩锛堜緥濡?`backend/` `frontend/` `deploy/`锛夛紝蹇呴』鑷姩鍒锋�?Docker 闀滃儚涓庡鍣紝纭繚娴嬭瘯鐪嬪埌鐨勬槸鏈€鏂扮増鏈€?- �?`/store/cart` 鎷嗘垚鐙珛椤甸潰缁勪欢锛堜�?`/store` 鍒嗙锛夛紝骞朵繚璇佽喘鐗╄溅鍦ㄩ〉闈㈤棿鍒囨崲鏃朵笉涓㈠け銆?- 淇�?`/assets` 椤甸潰锛氭寜鏂囨。搴斿睍绀衡€滄垜鐨勮祫浜у垪琛ㄢ€濓紝褰撳墠椤甸潰鍐呭涓嶅�?- 鍓嶇鈥滄墦涓嶅紑鈥濈幇璞￠渶瑕佸畾浣嶏細鐢ㄦ埛鐩磋�?`http://127.0.0.1:18080/assets` 搴旇繘鍏モ€滄垜鐨勮祫浜р€濓紝涓嶈兘鍑虹�?301�?03�?- 濡傛�?Docker 闀滃儚鍚嶄笌鍏朵粬椤圭洰閲嶅悕锛岄渶鏀逛负鏇村敮涓€鐨勯暅鍍忓悕锛岄伩鍏嶄簰鐩歌�?鍐茬獊銆?- 棰嗙敤鍟嗗煄椤甸潰锛�?store`锛夐渶瑕佹ā浠跨敤鎴锋彁渚涚殑鎴浘璁捐锛氶櫎搴曡壊鍙笉鏀癸紝鍏跺畠鍏冪礌灏介噺濂楃敤锛堝乏渚у晢鍝佸崱鐗囩綉鏍?+ 鍙充晶缁撶畻鍖轰晶鏍忋€佺┖鎬併€佽〃鍗曘€佹寜閽€佸窘鏍囩瓑锛夈�?- `/inbound` 鍏ュ簱涓庡簱瀛橀〉闈㈤渶瑕佽ˉ榻愨€滄墜鍔ㄥ鍏ヨ祫浜р€濊兘鍔涳細
  - 鍙€夋嫨鍒嗙被锛堜笉瑕佸彧濉暟瀛楀垎绫荤紪鍙凤�?  - 鏀寔涓婁�?SKU 灏侀潰鍥撅紙鐢ㄤ簬鍟嗗煄/搴撳瓨鍒楄〃灞曠ず�?  - 褰曞叆鍝佺墝銆佸瀷鍙枫€佽鏍笺€佸弬鑰冧环鏍笺€佸畨鍏ㄥ簱瀛橀槇鍊?  - 鎵归噺褰曞叆璧勪骇搴忓垪鍙凤紙SN锛夛紝鏀寔鎵爜鏋緭鍏ワ紙Enter 缁撴潫涓€鏉★級涓庢壒閲忕矘�?  - 鍏跺畠琛ュ叏锛氭敮鎸侀€夋嫨鈥滄柊寤虹墿鏂欏苟鍏ュ�?/ 閫夋嫨宸叉湁鐗╂枡鍏ュ簱鈥濄€佸幓閲嶆彁绀恒€佸鍏ョ粨鏋滃彲澶嶅�?瀵煎�?- `/inbound` 鏈€鏂颁氦浜掕皟鏁达�?  - 绉婚櫎鈥滄柊寤虹墿鏂欏苟鍏ュ簱鈥濓紝鐗╂枡鍙兘�?`/materials` 鏂板�?  - 鈥滈€夋嫨宸叉湁鐗╂枡鍏ュ簱鈥濇枃妗堟敼涓衡€滅墿鏂欏叆搴撯�?  - 宸︿晶鑿滃崟 `/inbound` 鏂囨鏀逛负鈥滅墿鏂欏叆搴撯�?  - 鐗╂枡閫夋嫨涓嬫媺鎸夊垎绫诲眰绾у睍绀哄叏閮ㄧ墿鏂?  - 鐗╂枡鍏ュ簱鏂板鈥滃叆搴撴暟閲忊€濆瓧娈碉細SN 鎵�?绮樿创鏃舵暟閲忚嚜鍔ㄥ彉鍖栵紝涔熷厑璁告墜鍔ㄨ緭鍏ワ紱鏃?SN 鏃跺彲鐩存帴鎵嬪姩杈撳叆鏁伴�?  - 杩涗竴姝ヤ紭鍖栵細鏍规嵁 SKU `stockMode` 鑷姩鍒囨崲琛ㄥ�?    - `SERIALIZED`锛氭樉绀?SN 褰曞叆鍖猴紱鍏ュ簱鏁伴噺鍙�?= SN 鏉℃暟锛堥伩鍏嶁€滄暟閲忓彲闅忔剰鏀光€濋€犳垚鏍￠獙鍥版儜�?    - `QUANTITY`锛氶殣钘?SN 褰曞叆鍖猴紱浠呭～鍐欏叆搴撴暟閲忓嵆鍙叆搴擄紙瑙ｅ喅鑰楁潗�?SN 鐨勫叆搴撳満鏅�?  - 鍘绘帀鐙珛鈥滄暟閲忓叆搴撯€濆崱鐗囷紙缁熶竴鍦ㄢ€滅墿鏂欏叆搴撯€濆唴澶勭悊�?- `/inventory` 搴撳瓨姹囨€诲瓧娈佃涔変紭鍖栵紙鍗曡〃锛屼笉鏀瑰悗绔帴鍙ｏ級�?  - 淇濈暀 `in_use_count` 瀛楁涓庡墠绔被鍨嬪吋�?  - 琛ㄥご鏀逛负鈥滀娇鐢ㄤ腑锛堜粎搴忓垪鍙疯祫浜э級鈥?  - `SERIALIZED` 琛屾樉绀?`inUseCount` 鏁板�?  - `QUANTITY` 琛屾樉绀?`-`锛堜笉閫傜敤锛夊苟寮卞寲鏍峰紡锛岄伩鍏嶈瑙ｄ负�? 浠跺湪浣跨敤涓�?- `/inventory` 椤甸潰缁撴瀯璋冩暣�?  - 鍒犻櫎鈥滅墿鏂欙紙SKU锛夋煡璇笌绠＄悊鈥濆崱鐗囷紙鐗╂枡涓绘暟鎹叆鍙ｇ粺涓€鍦?`/materials`�?  - 鈥滄煡璇㈠簱瀛樻眹鎬烩€濈嫭绔嬫垚宸︿晶鍗＄�?  - 鈥滆祫浜у垱寤?鏌ヨ鈥濈嫭绔嬫垚鍙充晶鍗＄墖锛屼笌搴撳瓨姹囨€诲苟鎺掑睍绀?  - 鎸夋渶鏂伴渶姹傛敼涓轰笂涓嬪竷灞€锛氬簱瀛樻眹鎬诲崱鐗囧湪涓婏紝璧勪骇鍒涘缓/鏌ヨ鍗＄墖鍦ㄤ�?- 琛ラ�?RBAC鈥滆彍鍗曠骇 + 鎸夐挳绾?permission 鏍￠獙閾捐矾鈥濓�?  - 鑿滃崟锛氭寜瑙掕壊涓?permission 鍙岄噸鎺у埗鍙�?  - 璺敱锛氳繘鍏ラ〉闈㈠墠鏍￠�?permission锛屼笉婊¤冻鍒欐樉绀烘棤鏉冮檺鎬?  - 鎸夐挳锛氬叧閿搷浣滄寜閽�?actionId 瀵瑰�?permission 鎺у埗鍙�?绂佺�?  - API锛氬叧閿鐞嗘帴鍙ｅ�?permission 鏍￠獙锛岄伩鍏嶄粎鍓嶇鎷︽�?- `/admin/rbac` 闇€瑕佹柊澧炩€滈〉闈㈢骇 + 鎸夐挳绾р€濈殑鍙鍖栭厤缃叆鍙ｏ紝涓嶈兘鍙潬鏂囨湰缂栬�?RESOURCE=ACTION�?- `/admin/rbac` 鐨勨€滈〉闈?鎸夐挳鍒版潈闄愮爜鈥濇槧灏勯渶瑕佺户缁寮轰负鐪熸鍙紪杈戯細涓嶄粎鍙敼鏉冮檺鐮侊紝杩樿鑳芥柊澧炲拰鍒犻櫎鏄犲皠椤广�?- 鐢ㄦ埛鍙嶉锛氭槧灏勯厤缃寮哄悗锛屸€滅粰瑙掕壊璧嬩簣鏉冮檺鈥濆叆鍙ｄ笉澶熺洿瑙傦紝闇€琛ュ洖鍙鍖栬祴鏉冿紙瑙掕壊閫夋嫨 + 鏉冮檺鍕鹃€?+ 淇濆瓨锛夈€?
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
- Docker 杩愯鏍堝嚭�?500锛坄/api/v1/admin/skus`銆乣/api/v1/inventory/summary`锛夋椂锛屼紭鍏堟鏌?Alembic 杩佺Щ鏄惁钀藉簱锛氭湰娆″畾浣嶄�?MySQL volume 鍋滅暀�?`202602070001`锛岀己灏?`sku.stock_mode` 瀛楁锛涘湪 backend 瀹瑰櫒鍐呮墽�?`alembic upgrade head` 鍚庢仮澶嶆甯搞€備负閬垮厤澶嶇幇锛岄渶瑕佽鍚庣瀹瑰櫒鍚姩鏃惰嚜鍔ㄦ墽琛岃縼绉伙紙鎴栧湪鍒锋柊鑴氭湰涓己鍒惰縼绉伙級�?- Nav is generated from `NAV_ROUTE_META` in `frontend/src/routes/app-routes.tsx`.
- `/store` and `/store/cart` both map to `StorePage`. Active nav highlighting must avoid parent + child being active at the same time.
- Dashboard Hero 妯箙瀵瑰簲鐨?DOM �?`frontend/src/pages/dashboard-page.tsx` �?`<section className="dashboard-hero ...">`锛屾牱寮忓叆鍙ｅ�?`frontend/src/styles/index.css` �?`.dashboard-hero`�?- 褰撳�?`frontend/src/pages/inbound-page.tsx` 鍚屾椂鎵胯浇鈥滃叆搴擄紙鎵嬪姩瀵煎�?+ OCR 鍏ュ簱纭锛夆€濅笌鈥滃簱瀛樼鐞嗭紙SKU CRUD + 璧勪骇鍒涘缓/鏌ヨ�?+ 搴撳瓨姹囨€伙級鈥濓紝涓斿簱瀛樼浉鍏?state/handler/UI 涓昏闆嗕腑鍦ㄩ〉闈㈠悗鍗婇儴鍒嗭紙鍖呭�?`fetchAdminSkus/createAdminSku/updateAdminSku/deleteAdminSku/uploadSkuImage`銆乣fetchAdminAssets/createAdminAssets`銆乣fetchInventorySummary`锛夈�?- 褰撳�?`frontend/src/routes/blueprint-routes.ts` 灏氭湭鍖呭惈 `/inventory`锛宍frontend/src/routes/app-routes.tsx` �?`/inbound` 鏂囨浠嶄负鈥滃叆搴撲笌搴撳瓨鈥濓紝闇€瑕佹寜闇€姹傛媶鍒嗗鑸笌璺敱銆?- 鎷嗗垎钀藉湴鏂规锛氭柊�?`/inventory` 椤甸潰鎵胯浇搴撳瓨鑳藉姏锛沗/inbound` 鑱氱劍鍏ュ簱鎵ц骞舵彁渚涜烦杞紱宸︿晶瀵艰埅鎷嗗垎涓衡€滃叆搴撯€濓紙/inbound锛変笌鈥滃簱瀛樼鐞嗏€濓紙/inventory锛夛紝骞朵负搴撳瓨绠＄悊浣跨�?`lucide-react` �?`Boxes` 鍥炬爣銆?- 鍚庣鐜扮姸�?  - `GET /api/v1/admin/skus` 鏆備笉鏀寔鏉′欢鏌ヨ锛堜粎鍏ㄩ噺鍒楄〃锛夈€?  - `GET /api/v1/inventory/summary` 浠呰繑鍥炴寜 `sku_id` 鑱氬悎鐨勬暟閲忓瓧娈碉紝涓嶅寘鍚?SKU 璇︽儏锛堝搧�?鍨嬪�?瑙勬�?闃堝�?灏侀潰绛夛級锛屼笖鏆備笉鏀寔鍏抽敭�?鍒嗙被绛夌瓫閫夈�?- 鍚庣宸插寮猴�?  - `GET /api/v1/admin/skus` 鏀寔 `sku_id`/`category_id`/`q` 鏉′欢绛涢€夈�?  - `GET /api/v1/inventory/summary` 鏀寔 `sku_id`/`category_id`/`q`/`below_threshold` 鏉′欢绛涢€夛紝骞惰繑�?SKU 璇︽儏瀛楁涓?`below_safety_stock` 鏍囪锛屼究浜庡墠绔〃鏍煎寲涓庝綆搴撳瓨绛涢€夈�?- 婕旂�?SKU 鍥哄�?ID锛堟潵鑷?`backend/app/scripts/seed_demo_data.py`锛夛�?001锛堣仈鎯崇瑪璁版湰锛夈€?002锛圖ell 鏄剧ず鍣級�?003锛圠ogitech 閿洏锛夈€?004锛圠ogitech 榧犳爣锛夈€?- 褰撳�?`/store` 鍟嗗搧鍗＄墖鍥剧墖鐩存帴浣跨�?`GET /api/v1/skus` 杩斿洖鐨?`cover_url` 瀛楁锛堝墠绔槧灏勪负 `coverUrl`锛夋覆鏌?`<img src={coverUrl}>`�?- 鎻愭鏂囨。椤圭洰鍚嶇О锛歚docs/proposal/00-鎬讳綋涓庨€氱敤瑙勮�?md` 涓衡€淚T鐗╄祫鍏ㄧ敓鍛藉懆鏈熺鐞嗙郴缁熲€濄€?- 鎻愭瀹氫箟鐨勫墠绔妧鏈爤锛歊eact 18 + TypeScript + Vite锛孶I 缁勪欢搴?Ant Design锛堣�?`docs/proposal/40-鍓嶇璺敱涓庨〉闈㈡竻�?md`锛夈�?- 鎻愭瀹氫箟鐨勯儴缃蹭笌鍚庣渚濊禆鐗堟湰锛歅ython 3.12+銆丯ode.js 20+銆丮ySQL 8.0+銆丷edis 7.0+銆丮inIO銆丏ocker 24+銆丯ginx 1.24+锛堣�?`docs/proposal/80-閮ㄧ讲涓庤繍�?md`锛夈�?- `docs/implementation/baseline.md` 璁板�?`baseline.v1` 瑙勬牸鍐荤粨鏃ユ湡涓?2026-02-07锛屼笖鍏垛€滃喕缁撴簮鏂囦欢鈥濅�?`docs/proposal/**` 涓轰富銆?- 鎻愭鐨勬牳蹇冩ā鍧楃洰鏍囷紙�?`docs/proposal/modules/*.md`锛夛細鏅烘収闂ㄦ埛锛圚ero/鍏�?鎴戠殑璧勪骇/蹇嵎鍏ュ彛锛夈€佺墿璧勭敵棰嗭紙鍒嗙被+SKU 鍗＄�?璐墿杞?缁撶�?AI 棰勫锛夈€佸叆搴撳簱瀛橈紙OCR 鍏ュ�?璧嬬�?鎵撳�?SKU/Asset 绠＄悊锛夈€?- 褰撳�?`/inbound` 鈥滃悗鍙扮墿鏂欌€濇煡璇㈢粨鏋滈€氳�?`<pre className="inbound-result">` 鐩存帴娓叉煋 JSON锛屼笉鍒╀簬绠＄悊鎿嶄綔锛涘彲澶嶇敤鐜版湁琛ㄦ牸鏍峰紡 `analytics-table`锛堝凡鍦ㄦ姤琛ㄣ€佽祫浜ч〉浣跨敤锛夈�?- 鍚庣鐜扮姸锛歋KU 绠＄悊浠呭疄�?`GET/POST /api/v1/admin/skus`锛岀己灏戞洿�?鍒犻櫎锛涘墠绔洜姝ゅ彧鑳解€滄�?+ 鏂板缓鈥濓紝鏃犳硶瀹屾垚瀹屾�?CRUD�?- 褰撳�?`StorePage` 鍚屾椂鍖呭惈鈥滅洰褰曟祻瑙堚€濆拰鈥滅粨绠楀尯锛堣喘鐗╄�?+ 鎻愪氦鐢宠琛ㄥ崟锛夆€濓紝鎷嗗垎鍚庨渶瑕佸叡浜喘鐗╄溅鐘舵€併€?- 鎷嗗垎鏂规锛歚/store` 淇濈暀鐩綍娴忚 + 璐墿杞︽憳瑕佸叆鍙ｏ紱`/store/cart` 鎵胯浇缁撶畻琛ㄥ崟涓庢彁浜ょ敵璇枫€?- 鏍规�?`docs/proposal/40-鍓嶇璺敱涓庨〉闈㈡竻�?md`锛歚/assets` 搴斾负鈥滄垜鐨勮祫浜у垪琛紙鍗＄�?琛ㄦ牸锛夆€濓紝`/assets/:id` 涓衡€滆祫浜ц鎯咃紙SN銆佺姸鎬併€佸巻鍙叉祦姘达級鈥濄�?- 鏍规�?`docs/implementation/baseline.md`锛坆aseline.v1锛夛細M01 宸插喕缁?`GET /api/v1/me/assets` 浣滀负鈥滄垜鐨勮祫浜р€濆熀绾挎帴鍙ｏ紝�?UI 璺敱瀛楀吀�?`/assets` 鍐荤粨涓衡€滄垜鐨勮祫浜у垪琛ㄢ€濄€?- 鏍规�?`docs/implementation/ui-blueprints.md`�?.9 Asset Lifecycle锛夛細`/assets` 棣栧睆搴斿寘鍚祫浜ф竻鍗曪紝骞舵湁绌烘€侊紙寮曞鍘?`/store`锛夈€佸姞杞芥€侀鏋躲€侀敊璇€佹彁绀轰笌寤鸿鍔ㄤ綔�?- 褰撳�?`frontend/src/routes/app-routes.tsx` �?`resolveProtectedPage` 鏈鐩?`/assets` �?`/assets/:id`锛屽洜姝や細钀藉叆 `BlueprintPlaceholderPage`锛堣〃鐜颁负椤甸潰鍐呭涓嶅锛夈€?- 鍓嶇宸叉湁 `fetchMyAssets(accessToken)`锛堣皟鐢?`GET /api/v1/me/assets`锛夛紝Dashboard 宸插湪浣跨敤锛屽彲鐩存帴澶嶇敤鍒?`/assets`�?- 褰撳�?`frontend` 闈欐€佽祫婧愪娇�?Vite 榛樿杈撳嚭鐩�?`/assets/`锛屼�?SPA 璺�?`/assets` 鍚屽悕锛?  - 鐩磋�?`/assets` 浼氳�?Nginx 璇嗗埆涓虹洰褰曞�?301 璺宠�?`/assets/`
  - `/assets/` 娌℃�?index 涓旂鐢ㄧ洰褰曟祻瑙堬紝杩斿�?403锛屽鑷寸敤鎴锋劅瑙夆€滃墠绔墦涓嶅紑�?- 鍦ㄥ灞傚弽鍚戜唬鐞嗭紙`deploy/docker-compose.yml` �?`nginx` 鏈嶅姟锛変腑锛宍proxy_set_header Host $host;` 浼氫涪澶辩鍙ｅ彿锛?  - upstream锛堝墠绔?Nginx锛夎繑鍥炵殑 301 浼氱敓鎴愪笉甯︾鍙ｇ殑 Location锛堜緥濡?`http://127.0.0.1/assets`�?  - 娴忚鍣ㄤ細璺冲�?80 绔彛锛岃〃鐜颁负鈥滄墦涓嶅紑�?  - 淇锛氬皢 Host 閫忎紶鏀逛负 `$http_host`锛堜繚鐣?`127.0.0.1:18080`�?- 杩涗竴姝ラ獙璇佸彂鐜帮細鍗充娇鐩磋繛 `frontend`锛堜緥濡?`http://127.0.0.1:13000/assets/`锛夛紝Location 浠嶇劧涓嶅甫绔彛锛屾牴鍥犳槸鍓嶇 Nginx 榛樿�?`absolute_redirect on` + `port_in_redirect` 浣跨敤瀹瑰櫒鍐呯鍙ｏ�?0锛夊鑷寸鍙ｈ鐪佺暐�?  - 淇锛氬湪 `frontend/nginx.conf` 澧炲�?`absolute_redirect off;`锛岃 301 浣跨敤鐩稿璺緞锛堜緥�?`Location: /assets`锛夛紝浠庤€屼繚鐣欐祻瑙堝櫒褰撳墠绔彛�?- 褰撳�?Docker Compose 榛樿椤圭洰鍚嶄�?`deploy`锛堟潵鑷洰褰曞悕锛夛紝闀滃儚鍚嶅凡鏄惧紡璁剧疆涓?`itwzgl1-*`锛屽彲涓€瀹氱▼搴﹂伩鍏嶄笌鍏跺畠椤圭洰鐨勯暅鍍忛噸鍚嶃€?- 宸查噸鏋勶紙Docker 鍓嶅悗绔湇鍔＄紪鎺掞級�?  - `celery_worker`/`celery_beat` 澶嶇�?`itwzgl1-backend` 闀滃儚锛岄伩鍏嶉噸�?build 鍚屼竴浠藉悗绔暅鍍忋€?  - 澶栧�?`nginx` 閰嶇疆澶栫疆�?`deploy/nginx/default.conf` 骞堕€氳�?volume 鎸傝浇锛屼究浜庣淮鎶や笌瀹￠槄銆?  - 鍏ュ彛鏂板 `GET /api/healthz`锛堥€忎紶鍒板悗�?`/healthz`锛夛紝渚夸簬閫氳繃缁熶竴鍏ュ彛鎺㈡椿鍚庣銆?- `frontend/src/pages/inbound-page.tsx` 宸插叿澶団€滃垱寤虹墿鏂?/ 鍒涘缓璧勪骇 / 鏌ヨ璧勪骇 / 搴撳瓨姹囨€烩€濈瓑鍩虹璋冪敤锛屼絾浜や簰鍋忊€滃伐浣滃彴寮忚皟璇曡〃鍗曗€濓細鍒嗙被闈犳墜�?ID銆佺己灏?SKU 鍥剧墖涓婁紶涓庢壂鐮佸綍鍏ヤ綋楠岋紝缁撴灉浠?JSON `pre` 杈撳嚭涓轰富�?- 鍚庣�?`backend/app/api/v1/routers/m06_inbound_inventory.py` 宸叉敮鎸侊細
  - `POST /api/v1/admin/skus`锛堝寘鍚?`cover_url` 瀛楁锛?  - `POST /api/v1/admin/assets`锛堟壒閲忓垱寤鸿祫浜э紝鏀寔 `inbound_at`�?  - `PUT /api/v1/admin/assets/{id}`锛堟洿鏂拌祫浜э紱閿佸�?娴佺▼寮曠敤璧勪骇闄愬埗淇敼鍏抽敭瀛楁锛?  - `DELETE /api/v1/admin/assets/{id}`锛堝垹闄よ祫浜э紱浠呭厑璁糕€滃湪�?+ 鏈攣�?+ 鏈娴佺▼寮曠敤鈥濈殑璧勪骇锛?  - 閲嶅�?SN 妫€娴嬶細鍚屾壒娆￠噸澶嶄笌搴撳唴宸插瓨鍦ㄩ兘浼氳繑�?`DUPLICATE_SN`
- 璧勪骇鍒犻櫎绾︽潫琛ュ厖锛歚stock_flow.asset_id` 澶栭敭涓?`ondelete="RESTRICT"`锛屾柊寤鸿祫浜т細鐢熸垚搴撳瓨娴佹按锛岃嫢涓嶅厛娓呯悊 `stock_flow`锛屽嵆渚胯祫浜ф弧瓒冲垹闄ゆ潯浠朵篃浼氳Е鍙?`IntegrityError` 鑰屽垹闄ゅけ璐ャ�?- 鍩虹嚎鏂囨。锛坄docs/implementation/baseline.md`銆乣docs/proposal/70-鏂囦欢涓婁紶涓庡瓨鍌ㄨ�?md`锛夊喕缁撲簡涓婁紶鎺ュ彛锛歚POST /api/v1/upload/sku-image`锛屼絾褰撳墠鍚庣灏氭湭瀹炵幇浠讳綍 `/upload/*` 璺緞銆?- 宸茶ˉ榻愪笂浼犺兘鍔涳紙鏈樁娈垫渶灏忓疄鐜帮級锛氬悗绔柊澧?`POST /api/v1/upload/sku-image`锛屽苟閫氳繃 `StaticFiles` 鎸傝�?`/api/v1/uploads/*` 渚涘墠绔洖鏄惧浘鐗囷紱Compose 澧炲�?`backend_uploads` volume 淇濇寔鎸佷箙鍖栥�?- 褰撳墠鏉冮檺鐜扮姸锛堜唬鐮佸疄娴嬶級�?  - 鐧诲綍鎺ュ彛杩斿洖鐨?`user.permissions` 宸叉帴鍏ュ墠绔細璇濓紝鑿滃崟銆佽矾鐢便€佹寜閽潎�?`roles + permissions` 鍙岄噸鍒ゅ畾�?  - 鍓嶇鏂板缁熶竴鏉冮檺鏄犲皠灞傦紙`route -> permission` �?`actionId -> permission`锛夛紝閬垮厤椤甸潰鍒嗘暎纭紪鐮併€?  - 鍚庣�?`AuthContext` 宸茶ˉ�?`permissions`锛屽苟鍦?`m06`銆乣m08` 鍏抽敭鎺ュ彛钀藉湴 permission 鏍￠獙銆?  - 閴存潈閾捐矾褰㈡垚闂幆锛氬墠绔帶鍒跺彲瑙?鍙偣锛屽悗绔帶鍒舵渶缁堟斁琛屻€?  - 鍥炲綊娴嬭瘯宸插悓姝ユ洿鏂帮細`step14`銆乣step17` 娴嬭瘯绉嶅瓙鍔犲叆鏉冮檺鏄犲皠锛岄伩鍏嶆潈闄愬崌绾у紩璧峰亣澶辫触�?- 鐢ㄦ埛鍙嶉纭锛�?admin/rbac` 鍘熼〉闈㈣櫧鍙紪杈?`RESOURCE=ACTION`锛屼絾缂哄皯鈥滈〉闈㈡潈闄愰厤缃?鎸夐挳鏉冮檺閰嶇疆鈥濈殑鍙鍖栧叆鍙ｏ紝鎿嶄綔鎴愭湰楂樸€佸鏄撹閰嶃€?- 褰撳�?`admin-rbac-page` 鐨勬槧灏勮〃浠嶄互鍥哄�?key 琛屼负涓伙紝铏藉彲鏀?`requiredPermissions`锛屼絾缂哄皯鏂板�?鍒犻櫎鏄犲皠椤瑰叆鍙ｏ紝鏃犳硶瑕嗙洊鏂伴〉闈㈡垨鏂版寜閽?actionId�?- 宸茶ˉ�?`admin-rbac-page` 鏄犲皠閰嶇疆鑳藉姏锛氭敮鎸佹柊澧?鍒犻�?`routePath` �?`actionId`锛屼繚瀛樺墠鍋氱┖ key/閲嶅�?key 鏍￠獙锛屽苟鍦ㄤ繚瀛樻垚鍔熷悗鍗虫�?`applyPermissionMappingConfig` 鐢熸晥銆?- 褰撳墠瑙掕壊璧嬫潈浠嶄互鈥滄枃鏈粦瀹氱紪杈戝櫒鈥濅负涓伙紝涓嶇鍚堢敤鎴峰鍚庡彴鍙鍖栭厤缃殑棰勬湡锛岄渶瑕佽ˉ鍏呭嬀閫夊紡璧嬫潈闈㈡澘銆?- 宸叉仮澶?`/admin/rbac` 鍙鍖栬鑹茶祴鏉冿細閫夋嫨瑙掕壊鍚庡彲鎸夋潈闄愮洰褰曞嬀閫夋潈闄愬苟淇濆瓨锛屼笖浼氬悓姝ュ埛鏂版枃鏈粦瀹氱紪杈戝櫒鍐呭銆?
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
| 鏂囨。榛樿浣跨敤涓枃鎾板�?| 缁熶竴璇█椋庢牸锛涗繚鐣欏繀瑕佺殑鑻辨枃鎶€鏈厓绱?|
| 寮曞�?`useM02Cart`锛堝熀�?`sessionStorage`�?| �?`/store` �?`/store/cart` 澶嶇敤鍚屼竴濂楄喘鐗╄溅璇诲啓閫昏緫锛屽噺灏戦噸澶嶄唬鐮?|
| `/store/cart` 浣跨敤鐙珛缁勪�?`StoreCartPage` | 璺敱灞傛竻鏅板垎绂伙紝鍚庣画鍙嫭绔嬭凯浠ｈ喘鐗╄溅椤甸潰浜や簰涓庡竷灞€ |
| 鏂板�?`AssetsPage` 鎵胯�?`/assets` | 瀵归綈璺敱瀛楀吀�?UI 钃濆浘锛屽皢鈥滄垜鐨勮祫浜у垪琛ㄢ€濅粠鍗犱綅椤佃惤鍦颁负鐪熷疄椤甸潰 |
| 鏂板�?`AssetDetailPage`锛堟渶灏忓疄鐜帮級鎵胯浇 `/assets/:id` | 褰撳墠鍩虹嚎鏈喕缁撹祫浜ц�?API锛屽厛澶嶇敤 `fetchMyAssets` 鍒楄〃鎸?id 杩囨护锛屼繚璇佽矾寰勫彲鐢ㄤ笉钀藉叆鍗犱綅椤?|
| `resolveProtectedPage` 鏄惧紡鏄犲皠 `/assets` �?`/assets/:id` | 閬垮厤璇敤 `BlueprintPlaceholderPage`锛屽苟璁╁鑸珮浜笌椤甸潰鑱岃矗涓€�?|
| 鍓嶇�?Nginx 澧炲�?`/assets` 鐗逛緥 | 鏃繚鐣欓潤鎬佹枃浠剁洰�?`/assets/*`锛屽張璁?SPA 璺�?`/assets` 鐩磋揪涓嶅啀 301�?03 |
| Docker Compose 鏄惧紡璁剧疆 build 闀滃儚�?| �?`deploy-*` 鏀逛负鏇村敮涓€鐨勯」鐩暅鍍忓悕锛岄伩鍏嶄笌鍏朵粬椤圭洰鍐茬�?|
| `/store` 渚ф爮浼樺厛鏀寔鑷彁鎻愪氦锛屽揩閫掑紩瀵煎�?`/store/cart` | 鎴浘渚ф爮鏈寘鍚湴鍧€淇℃伅锛涘厛鎶婁富瑕佷綋楠岃惤鍦帮紝閬垮厤鍦ㄥ晢鍩庨〉寮曞叆澶嶆潅鍦板潃绠＄�?|
| 鍏堝疄鐜?`POST /api/v1/upload/sku-image`锛堟湰鍦伴潤鎬佺洰褰曞瓨鍌�?| `cover_url` 闀垮害闄愬埗涓?512锛屾棤娉曞瓨 base64锛涢渶瑕佽繑鍥炲彲璁块棶 URL 鎵嶈兘鍦ㄥ晢鍩庡崱鐗囧洖鏄惧浘鐗?|
| `/inbound` 鎵嬪姩瀵煎叆鎻愪緵鈥滄柊寤?SKU 骞跺叆搴?/ 閫夋嫨宸叉湁 SKU 鍏ュ簱鈥濅袱绉嶈矾寰?| 鏇磋创杩戠湡瀹炲叆搴擄細鍚屼�?SKU 浼氬鎵规鍏ュ簱锛涘噺灏戦噸澶嶅垱�?SKU 鐨勬鐜?|
| `/store` 婕旂ず鍟嗗搧鍥鹃€氳�?`POST /api/v1/upload/sku-image` 涓婁紶骞跺啓�?MySQL `sku.cover_url` | 涓嶆敼鍓嶇娓叉煋閫昏緫鍗冲彲璁╁崱�?`<img src={coverUrl}>` 鍥炴樉锛涗笂浼犳枃浠朵篃鑳介�?`backend_uploads` 鍗锋寔涔呭寲 |
| �?`鑳屾�?.avif` 鏀惧叆 `frontend/public`锛堝懡鍚嶄负 `dashboard-hero-bg.avif`锛夊苟鍦?`.dashboard-hero` 涓紩鐢?| 鍚庣涓婁紶鐧藉悕鍗曟殏涓嶆敮鎸?avif锛涘墠绔?public 鏂瑰紡閮ㄧ讲鏈€绠€鍗曪紝鍥炴粴鎴愭湰浣?|
| `agent.md` 鎺у埗�?500 瀛楀唴涓斾粎淇濈暀鈥滃彲婧簮�?proposal 鐨勬牳蹇冧俊鎭�?| 浣滀负鍒濆鍖栨彁绀哄崱锛岄伩鍏嶉噸澶嶆彁妗堟鏂囦笌涓嶇‘瀹氫俊鎭紙灏ゅ叾鏄帓鏈熸帹鏂級 |
| `/inbound` SKU 鍒楄〃澶嶇敤 `analytics-table` 鍛堢�?| 涓庤祫浜ч�?鎶ヨ〃椤典繚鎸佷竴鑷寸殑琛ㄦ牸瑙嗚涓庡彲璇绘€э紝閬垮厤棰濆寮曞叆鏂扮粍浠跺簱 |
| 鍚庣琛ラ綈 SKU CRUD锛氭柊澧?`PUT/DELETE /api/v1/admin/skus/{id}` | 璁╃墿鏂欑鐞嗛棴鐜紱鍒犻櫎鏃跺仛寮曠敤淇濇姢锛岄伩鍏嶇牬鍧忓閿笌鍘嗗彶鏁版嵁 |
| 鏂板閿欒�?`SKU_IN_USE`�?09�?| 鍒犻�?SKU 琚紩鐢ㄦ椂杩斿洖鏄庣‘鐨勪笟鍔″啿绐侊紝鍓嶇鍙洿鎺ュ睍绀洪敊璇俊鎭?|
| Docker 缂栨帓閲嶆瀯閲囩敤鈥滀綆椋庨櫓缁撴瀯閲嶆瀯鈥?| 浼樺厛锛歝elery 鏈嶅姟澶嶇敤 backend 闀滃儚銆丯ginx 閰嶇疆澶栫疆鏂囦欢骞堕€氳繃 volume 鎸傝浇锛涙殏涓嶈皟鏁?`COMPOSE_PROJECT_NAME` 浠ラ伩鍏嶅嵎鏁版嵁杩佺�?|
| 浼氳瘽缁撴潫鑷姩鍒锋柊 Docker锛堣鍒?+ 鑴氭湰锛?| 淇濊瘉娴嬭瘯鐪嬪埌鐨勫缁堟槸鏈€鏂伴暅鍍忎笌鏈€鏂板鍣ㄧ増鏈紱缁熶竴鐢?`deploy/scripts/refresh-dev.ps1` 鎵ц鍒锋柊涓庡仴搴锋鏌?|
| 鍚庣瀹瑰櫒鍚姩鑷姩鎵ц�?Alembic 杩佺Щ | 閬垮厤鏁版嵁�?volume 钀藉悗浜庝唬鐮佸�?API 500锛涘埛鏂板悗鍗充负鏈€鏂?schema |
| 鍓嶇閬囧埌 401 鑷姩澶辨晥浼氳瘽骞惰烦杞櫥褰?| 闃叉�?token 澶辨晥鍚庝粛淇濇寔鈥滃亣鐧诲綍鈥濈姸鎬侊紝鍑忓皯鎶ラ敊涓庡洶�?|
| `/inbound` 绂佹鏂板缓鐗╂枡锛圫KU�?| 鐗╂枡涓绘暟鎹粺涓€鍦?`/materials` 缁存姢锛岄伩鍏嶅鍏ュ彛閫犳垚鍙ｅ緞鍒嗗弶涓庨噸澶嶅垱寤?|
| 鏂板�?`.gitignore` 蹇界暐鏈湴鐜涓庣紦�?| 閬垮厤灏?`deploy/.env`銆乣node_modules/`銆佺紦瀛樼洰褰曘€佷复鏃舵暟鎹簱鏂囦欢绛夋帹閫佸埌杩滅浠撳�?|
| 渚ц竟鏍忓浘鏍囩粺涓€浣跨�?`lucide-react` 骞舵�?route path 鍋氭槧灏?| 閬垮厤渚濊禆鏂囨鍖归厤瀵艰嚧鍥炬爣閿欎綅锛涢泦涓湪瀵艰埅娓叉煋澶勬洿鏄撶淮�?|
| 鍓嶇寮曞叆鈥渁ctionId/route -> permission鈥濈粺涓€鏄犲皠 | 璁╄彍鍗曘€佽矾鐢便€佹寜閽叡鐢ㄥ悓涓€鏉冮檺璇箟锛岄伩鍏嶅悇椤甸潰纭紪鐮佸垎�?|
| 鍚庣鍦ㄤ繚鐣欒鑹叉牎楠屽墠鎻愪笅琛ュ�?permission 鏍￠�?| 褰㈡垚鍓嶅悗绔棴鐜紝闃叉浠呴潬鍓嶇鎷︽埅琚粫杩?|
| 娴嬭瘯绉嶅瓙鏄惧紡缁戝畾鏉冮檺锛堣€屼笉鏄彧缁戝畾瑙掕壊锛?| permission 鏍￠獙鏄繍琛屾椂纭害鏉燂紱涓嶈ˉ鏉冮檺浼氬鑷存祴璇曞嚭鐜?403 鍋囧け璐?|
| `/admin/rbac` 閲囩敤鈥滆鑹茬淮搴﹂〉闈?鎸夐挳閰嶇疆闈㈡�?+ 缁戝畾缂栬緫鍣ㄨ仈鍔ㄢ€?| 涓嶅鍔犲悗�?schema 鍗冲彲蹇€熸彁渚涘彲瑙嗗寲閰嶇疆鍏ュ彛锛屽吋瀹圭幇鏈夋潈闄愭ā鍨嬩笌鎺ュ彛 |
| `/admin/rbac` 鏄犲皠闈㈡澘琛ラ綈鈥滄柊�?鍒犻櫎鏄犲皠椤光�?| 婊¤冻鈥滃悗鍙板彲缂栬緫鈥濈殑瀹屾暣鎬э紝閬垮厤浠呰兘淇敼鍥哄畾琛屽鑷存墿灞曞彈�?|
| `/admin/rbac` 椤甸潰閲嶅啓涓哄共鍑€瀹炵幇骞朵繚鐣欏師鑳藉姏 | 鏃ф枃浠跺嚭鐜扮紪�?璇硶鎹熷潖瀵艰�?typecheck 澶辨晥锛岄噸鍐欐瘮灞€閮ㄤ慨琛ユ洿绋筹紝鍥炲綊鎴愭湰鍙�?|
| `/admin/rbac` 澧炲姞鍙鍖栬鑹茶祴鏉冮潰鏉匡紙checkbox�?| 闄嶄綆閰嶇疆闂ㄦ锛岄伩鍏嶄粎闈?`RESOURCE=ACTION` 鏂囨湰杈撳叆閫犳垚璇搷�?|

| SKU 澧炲姞搴撳瓨妯″紡 `stock_mode`锛圫ERIALIZED/QUANTITY�?| 璁╁簱瀛樿鍒欑敱 SKU 鍐冲畾锛屽吋瀹硅€愮敤鍝佷笌鑰楁潗涓ょ被鍦烘�?|
| QUANTITY 搴撳瓨浠?`sku_stock` + `sku_stock_flow` 瀹炵�?| 涓嶄緷璧?Asset锛圫N锛夛紝鍚屾椂淇濊瘉搴撳瓨鍙拷婧笌鍙璁?|
| QUANTITY锛氱敵璇锋彁浜ゅ彧澧炲姞 reserved锛屽嚭搴撳啀鎵ｅ�?on_hand | 绗﹀悎鈥滈鍗犱笉鍑哄簱涓嶆墸鐜板瓨鈥濈殑涓氬姟鐩磋锛岄伩鍏嶈鎵?|
| 搴撳瓨娴佹按瀵煎嚭浼樺厛 CSV锛圲TF-8 BOM�?| Excel 鐩存帴鎵撳紑涓嶄贡鐮侊紝瀹炵幇鏈€绋充笖渚濊禆灏?|

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
| `/api/v1/inventory/summary` 鏉冮檺璋冩暣涓虹鐞嗗憳璁块�?| 鍓嶇搴撳瓨绠＄悊椤典笌鍚庣涓€鑷达細搴撳瓨姹囨€荤敤浜庡悗鍙扮鐞嗭紱娴嬭瘯鏀逛负浣跨敤绠＄悊鍛樹护鐗屽苟鏂█鏂板瓧�?|
| `step14/step17` 鐢ㄤ緥鍦?permission 鏀归€犲悗 403 澶辫�?| 涓烘祴璇曠瀛愯ˉ�?`INVENTORY:READ`銆乣INVENTORY:WRITE`銆乣RBAC_ADMIN:UPDATE` 鐨勮鑹叉潈闄愭槧灏勫悗鎭㈠閫氳繃 |

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
- `docs/proposal/40-鍓嶇璺敱涓庨〉闈㈡竻�?md`
- `docs/proposal/modules/09-璧勪骇鐢熷懡鍛ㄦ湡绠＄悊.md`
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
- 鐢ㄦ埛鎴浘锛堥鐢ㄥ晢�?UI 鍙傝€冿級鍏抽敭淇℃伅锛堥渶�?`/store` 钀藉湴锛屽簳鑹插彲淇濇寔涓嶅彉锛夛�?- 宸︿晶涓衡€滅墿鏂欑洰褰?�?鍙鐢ㄧ墿鏂欌€濆尯鍩燂細鍗＄墖缃戞牸灞曠ず鍟嗗搧锛堝皝闈㈠浘 16:9 宸﹀彸銆佸渾瑙掋€佸崱鐗囪竟妗嗕笌鍐呴槾褰辨晥鏋滐級�?- 鍟嗗搧鍗＄墖鍐呭锛氭爣棰橈紙鍝佺墝+鍨嬪彿锛夈€佽鏍艰銆佸簱瀛樺窘鏍囥€?- 搴撳瓨寰芥爣锛氭湁搴撳瓨鏃朵负缁胯壊淇℃伅鍧楋紙鏂囨绫讳技鈥滃彲鐢ㄥ簱�? 1鈥濓級锛涙棤搴撳瓨涓虹伆鑹插潡锛堟枃妗堚€滄棤搴撳瓨鈥濓級锛涙棤搴撳瓨鏃舵寜閽鐢ㄣ€?- 鍙充晶涓衡€滅粨绠楀尯鈥濅晶鏍忥細鏍囬鈥滆喘鐗╄溅�?锛夆€濅笖鏁伴噺鏈夊己璋冭壊锛涗腑闂翠负璐墿杞︾┖鎬侊紙璐墿杞﹀浘鏍?+ 鎻愮ず鏂囨锛夈�?- 渚ф爮琛ㄥ崟锛氫氦浠樻柟寮忎笅鎷夛紙鎴浘鏄剧ず鈥滆嚜鎻愨€濓級銆佸矖浣嶈緭鍏ユ銆佺敵璇峰師鍥犲琛岃緭鍏ユ锛涙瘡椤瑰墠鏈夊皬鍥炬爣銆?- 搴曢儴鎸夐挳缁勶細宸︿晶鐏拌壊鈥滄櫤鑳介妫€鈥濓紝鍙充晶钃濊壊涓绘寜閽€滄彁浜ょ敵璇封€濓紱绌鸿喘鐗╄溅鏃舵暣浣撳簲绂佺敤鎴栫粰鍑烘彁绀恒€?- `/inbound` 褰撳墠椤甸潰瑙傛劅鍋忊€滆皟璇曟帶鍒跺彴鈥濓細澶氫釜鍗＄墖浠?JSON 褰㈠紡灞曠ず缁撴灉锛屼笉绗﹀悎鈥滄墜鍔ㄥ鍏ヨ祫浜р€濆満鏅殑涓€姝ュ紡鎿嶄綔棰勬湡锛涢渶瑕佹洿鏄庢樉鐨勫鍏ュ叆鍙ｄ笌鎵爜褰曞叆鍖恒�?
---
<!-- 
  REMINDER: The 2-Action Rule
  After every 2 view/browser/search operations, you MUST update this file.
  This prevents visual information from being lost when context resets.
-->
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*






















## D1 需求确�?(2026-02-12 申请详情样式优化)
- 目标页面：`/applications` 列表点击“查看详情”进入的申请详情页（`/applications/:id`）�?- 需�?：领用物料清单中的缩略图过大，需缩小约一半�?- 需�?：页面中“申请人信息”“领用物料清单”两张卡片里删除“表1”“表2”标签文案�?
## D1 实施决策
- 仅修改申请详情页，不影响审批页等其他使用物料表格的页面�?- �?`application-detail-page.tsx` 删除“表1/�?”节点�?- 新增独立样式�?`application-detail-cover` 控制缩略图尺寸为 `96x54`，避免影�?`approvals-page.tsx`�?## D1 验收结论 (2026-02-12 申请详情样式优化)
- `/applications/:id` 页面“申请人信息”“领用物料清单”两卡片中的“表1/�?”已移除�?- 领用物料清单缩略图已缩小�?`96x54`，约为此前显示体积的一半，并保�?`object-fit: cover`�?- 本次改动仅影响申请详情页，不影响审批页的物料缩略图显示�?- 验证通过：`npm --prefix frontend run typecheck`、`deploy/scripts/refresh-dev.ps1`、`/healthz`、`/api/healthz`�?
## M1 需求确认（2026-02-12 分类树审批人字段增强�?- 用户要求：在物料管理页（`/materials`）的分类树里新增两个字段：`审批领导设置`、`管理员设置`�?- 用户要求：两个字段均可从人员名单中下拉选择，不再手工输�?ID�?
## M1 现状发现
- 当前分类模型 `category` 仅有 `id/name/parent_id`，无审批人字段�?- 当前分类 CRUD（`/api/v1/admin/categories`）仅支持 `name/parent_id`�?- 当前前端 `materials-page` 分类表和新增/编辑表单均未接入人员列表与审批人字段�?- 现有“人员列表”接口主要在 `m08_admin` 的通用 CRUD 内，权限�?`SUPER_ADMIN`；不适合直接�?`materials` 页面（ADMIN/SUPER_ADMIN）复用�?
## M1 实施决策
- 数据层：�?`category` 增加两个可空字段：`leader_approver_user_id`、`admin_reviewer_user_id`（均外键�?`sys_user.id`）�?- 接口层：
  - 新增 `GET /api/v1/admin/categories/tree`（管理端分类树，返回审批人字段与姓名）�?  - 新增 `GET /api/v1/admin/categories/approver-options`（返回领导候选与管理员候选列表）�?  - 扩展 `POST/PUT /api/v1/admin/categories` 支持两个字段�?- 校验层：
  - `leader_approver_user_id` 必须属于 `LEADER` �?`SUPER_ADMIN`�?  - `admin_reviewer_user_id` 必须属于 `ADMIN` �?`SUPER_ADMIN`�?- 前端层：`/materials` 分类新增/编辑改为下拉选人，分类表新增两列展示“审批领导”“管理员”�?- 兼容性：保留现有 `/api/v1/categories/tree` 给商�?普通用户使用，不暴露管理字段�?
## M1 实施结果�?026-02-12�?- 后端数据模型已完成：`category` 新增
  - `leader_approver_user_id`
  - `admin_reviewer_user_id`
- 后端迁移已新增：`backend/alembic/versions/202602120001_add_category_approver_fields.py`�?- M06 接口已增强：
  - 新增 `GET /api/v1/admin/categories/tree`（管理端分类树，含审批人字段与姓名）
  - 新增 `GET /api/v1/admin/categories/approver-options`（领�?管理员候选列表）
  - 扩展 `POST /api/v1/admin/categories`、`PUT /api/v1/admin/categories/{id}` 支持审批人字�?  - 新增角色校验：领导字段仅允许 `LEADER/SUPER_ADMIN`，管理员字段仅允�?`ADMIN/SUPER_ADMIN`
- 前端 API 已增强：
  - `fetchAdminCategoryTree`
  - `fetchAdminCategoryApproverOptions`
  - 分类创建/更新入参与响应已补齐审批人字�?- `/materials` 页面已完成：
  - 分类新增/编辑表单增加“审批领导设置”“管理员设置”下拉框
  - 分类表格增加“审批领导设置”“管理员设置”两�?  - 分类数据源切换为管理端分类树接口，不影响商城使用的公开分类树接�?- 测试已补齐：`backend/tests/test_step14_m06_inbound_inventory.py` 新增分类审批人字段与选项接口用例�?
## R1 需求确认（2026-02-12 17:40:29 权限治理深度优化�?- 用户要求：权限目录不能只显示少量裸权限码，需要列出完整权限并提供中文说明�?- 用户要求：替换用�?角色分配 需要可视化，用户维度改为账号下拉，角色改为多选下拉，并明确“覆盖替换”语义�?- 已锁定决策：保持基础权限粒度（不做细粒度权限体系重构），通过权限字典与映射可视化提升可读性�?
## R1 当前发现
- 后端 m08_admin.py 当前默认权限主要�?5 项：RBAC_ADMIN:UPDATE、INVENTORY:READ、INVENTORY:WRITE、REPORTS:READ、OUTBOUND:READ�?- 前端 dmin-rbac-page.tsx 现状：权限目录仅标签展示；用户角色设置为“用户编号输�?+ 文本角色编辑”，不满足可视化要求�?- 现有接口已具�?GET /api/v1/admin/crud/users �?PUT /api/v1/admin/users/{id}/roles，可复用来做账号下拉与角色保存�?
## R1 实施决策
- 后端�?GET /api/v1/admin/rbac/permissions 前执行内置权限字典同步（幂等 upsert），并返�?code/zh_name/zh_description/route_refs/action_refs/is_builtin�?- 新增 GET /api/v1/admin/users/{id}/roles 用于前端预填当前用户角色�?- 前端将“权限目录”改为可视化表格并增加“权限使用明细”，将“用户角色设置”改为账号下�?+ 角色多选下拉�?
## F-P1 发现与决�?(2026-02-12 17:47:25)
- 现状�?rontend/src/pages/admin-rbac-page.tsx 仍保留旧版“用户编�?文本角色列表”逻辑，且存在 parsePositiveInteger/parseRoleList 未定义引用，页面当前不可稳定通过 typecheck�?- 已有基础：后端已支持 /api/v1/admin/rbac/permissions 扩展字段（code/zh_name/zh_description/route_refs/action_refs/is_builtin）与 GET /api/v1/admin/users/{id}/roles�?- 本轮决策�?  1. 保留“角色绑定（文本）”作为高级模式，并增加风险说明；
  2. 新增“用户角色可视化分配”卡片：账号下拉 + 角色多�?+ 自动回填当前角色�?  3. 权限目录改为表格化展示，并增加“页面引�?按钮引用”两类明细；
  4. 不改接口契约，仅补齐前端消费逻辑与样式�?
## F-P2 实施结论 (2026-02-12 17:54:14)
- 权限目录已从“裸权限码标签”升级为可视化表格，字段包含：权限码、中文名称、中文说明、资源、动作、页面引用数、按钮引用数、是否内置�?- 新增“权限使用明细视图”：按页面映射与按钮映射分别展示权限码引用，便于直观审计�?- 用户角色设置改为“用户账号下�?+ 角色多选下拉”，并在切换用户后自动预填当前角色�?- 保留“角色绑定（高级文本模式）”作为兜底能力，并增加了优先使用可视化赋权的提示�?- 后端已提供并被前端消费：`GET /api/v1/admin/users/{id}/roles`�?
## F-E1 根因定位 (2026-02-12 18:06:07)
- 现象：浏览器提示 `Failed to load resource: 400 (Bad Request)`�?- 根因：`frontend/src/pages/admin-rbac-page.tsx` 调用 `fetchAdminCrudResource(accessToken, "users", { pageSize: 500 })`�?- 约束：后�?`backend/app/api/v1/routers/m08_admin.py` �?`page_size` 限制 `le=100`�?- 结论：前端分页参数越界触发请求校验失败，返回 400�?
## F-E2 修复结论 (2026-02-12 18:11:06)
- 400 错误由前端查询参数越界触发：`page_size=500` 超过后端限制 `le=100`�?- 现已将用户列表请求参数调整为 `pageSize=100`，与后端契约一致�?- 此修复不改变业务逻辑，仅修复接口调用参数�?
## F-M1 发现与决�?(2026-02-12 18:14:29)
- 现状：用户角色分配控件使用原�?`select multiple`，在桌面端通常需�?Ctrl/Shift 辅助键，用户感知为“无法多选”�?- 决策：改为复选框列表（checkbox group）实现可视化多选，点击即选中/取消；保留覆盖语义与自动预填逻辑�?- 影响范围：仅前端 RBAC 页面与样式，不改后端接口�?
## F-M2 实施结论 (2026-02-12 18:26:42)
- 交互改造：将“角色列表”从 `select[multiple]` 改为 `checkbox` 分组，用户可直接点选多角色�?- 业务保持：用户切换后的角色预填、覆盖保存语义、后端接口均保持不变�?- 可用性提升：消除原生多选下拉的键盘依赖导致的“看起来不能多选”问题�?
## 2026-02-12 新增需求分析（申请回退 + 出库可见性）
- 需�?：我的申请中，领导驳回单需可“回退到购物车”，并允许修改物料数量后重新提交�?- 需�?：管理员审批通过后在“出库执行”不可见，当前代码根因不是权限，而是状态机：序列号物料审批后停�?`ADMIN_APPROVED`，需分配资产后才进入 `READY_OUTBOUND`�?- 实施决策�?  1. 保留状态机不变（避免错误直接出库），但在出库队列展�?`ADMIN_APPROVED` 记录，并明确标注“待分配资产”�?  2. “回退到购物车”通过申请详情数据回填购物车（用户维度存储），不影响他人购物车�?  3. 回填使用申请详情里的物料字段构造购物车条目，数量按申请单回填，可继续编辑后提交�?
## 2026-02-12 实施结论（申请回退 + 出库可见性）
- 购物车已具备批量回填接口，且仍按用户ID隔离存储�?- `LEADER_REJECTED` 单据可从“我的申请”一键回退购物车，并跳转到 `/store/cart` 修改后重提�?- `GET /applications/{id}` 已补充回填所需字段：`category_id/reference_price/stock_mode/safety_stock_threshold/available_stock`�?- 出库队列已将 `ADMIN_APPROVED` 纳入可见范围，并在前端明确提示“待分配资产”，避免误判为权限异常�?- 出库执行提交前对 `ADMIN_APPROVED` 申请做前置拦截提示，不改变原状态机�?
## H1 ����ȷ�ϣ�2026-02-24 �ɼ�����·�ּ��޸���
- �û�Ҫ�󣺰���/��/��˳����֮ǰ���������⡣
- �����ȼ������ɼ� SKU ���ܱ��κη�ʽ�ύ���롣
- �����ȼ������ﳵ������ʷ����ʱ���� SKU �Ѳ��ɼ���Ӧ���������ⷴ�������Զ�������
- �����ȼ��������ԣ���������ع顣

## H1 ��ȷ�Ϸ���
- `/api/v1/skus` �ѹ��� `is_visible=true`���� `POST /api/v1/applications` Ŀǰ���� `sku_id` ȡ����δǿ��У��ɼ��ԡ�
- ���ﳵΪ���س־û�����ʷ��Ŀ���ܰ������������ص� SKU��
- ���� m02 ����δ���ǡ����ɼ� SKU �ύʧ�ܡ�������

## H1 ʵʩ����
- ������ȣ������봴�����ڶ�ÿ�� SKU �� `is_visible` У�飬���ɼ�ֱ�Ӿܾ���
- ǰ����Σ��ύʧ�������в��ɼ� SKU �����룬���Զ��ӹ��ﳵ�Ƴ���Ӧ��Ŀ����ʾ�û���
- ����������� m02 ������֤���б����� + �������ء��ջ���

## H2 ʵʩ�����2026-02-24 �ɼ�����·�ּ��޸���
- ��˱ջ���`create_application` ������У������ SKU ���ϣ�ȱʧ���� `SKU_NOT_FOUND`�����ɼ����� `SKU_NOT_VISIBLE`����Я�� `sku_ids` ϸ�ڡ�
- ǰ�˱ջ���`store-checkout-sidebar` �� `store-cart-page` ���� `SKU_NOT_VISIBLE/SKU_NOT_FOUND` �󣬴ӹ��ﳵ�Ƴ���Ӱ�� SKU ������������ʾ�������û��ظ��ύʧ�ܡ�
- ������Ϣ͸����`AuthApiError` ���� `details` �ֶΣ�ͳһ�нӺ�˴���ϸ�ڡ�
- �ع���ԣ�`test_step11_m02_application.py` ���������ɼ� SKU ���������̳��б��������ɼ� SKU ��������ʧ�ܡ�������

## H2 �����쳣���޸�
- �쳣��ʵʩ�ж� `frontend/src/api/index.ts` ���м�д��ʱ���������������⣬���´����ַ����߽��쳣��
- �޸������ļ�ִ�б���������ַ����߽��޸����������� `typecheck` �� `pytest`�������ͨ����

## L1 ����ȷ�ϣ�2026-02-24 /inventory �������ţ�
- �û�Ҫ��
  - ɾ�� `/inventory` ҳ�ġ���̨���� ���ϣ�SKU����ѯ���������Ƭ��
  - �������ܡ���Ƭ�Ƶ����Ϸ�����ʹ���������򲼾֡�
  - ����̨�ʲ� + ���ܿ�Ƭ�����ڿ������·���
- ���ֽ���ҳ�沼����ɼ�ģ����������Ľӿ���ҵ���߼���

## L1 需求确认（2026-02-24 19:52:47�?- 目标页面�?inventory�?- 删除 SKU 查询与管理卡片；库存汇总置顶并满宽；资产卡片放在其下�?- 现状：库存汇总逻辑�?inventory-page.tsx 的资产卡片内部，需要拆分为独立卡片并调整顺序�?

## R1 发现与决策（2026-02-24 20:39:45�?- 现象�?inventory �?SKU 8001 预占=4，但 /outbound 队列仅显示待出库 2�?- 口径：库存汇总预占来自资�?LOCKED 数（序列号物料）；出库队列来自申请状态（READY_OUTBOUND/ADMIN_APPROVED）�?- 根因：M05 自动分配�?ADMIN_APPROVED 场景会再次从 IN_STOCK 选资产并加锁，未优先复用该申请已锁资产，造成历史残留 LOCKED�?- 修复策略�?  1. 自动分配优先复用“当前申请已锁资产”，不足再补锁�?  2. 超额锁定资产自动解锁并记录流水�?  3. 申请资产关联按最终分配结果重建，避免脏映射�?  4. 出库/发货动作后增加残留锁清理兜底�?

## R2 ��������ۣ�2026-02-24 Ԥռ������ⲻһ�£�
### �ؼ�����
- `/inventory` �ġ�Ԥռ����Դ���ʲ��� `asset.status=LOCKED` ������`/outbound` ������Դ������״̬��`READY_OUTBOUND`/`ADMIN_APPROVED`����
- ��ʷ�����д��ڡ���̬���루`OUTBOUNDED`���Բ��� `LOCKED` �ʲ���������Ԥռ��ߡ�
- M05 �Զ������ھ��߼��»���֡�ͬ�����ظ�������ͬ�ʲ�����·��������ʷ����δ�����ͷš�

### ʵʩ����
- �� `backend/app/api/v1/routers/m05_outbound.py` ��������޸���
1. �Զ��������ȸ��õ�ǰ���������ʲ������㲹����������������ؽ� `ApplicationAsset` ӳ�䡣
2. ����/�����������������������ף�������̬�������ռ������
3. �޸��Ự�� ID ���ɳ�ͻ�� `autoflush=False` ���µ����������⡣

### ���ݶ��˽���
- ����ǰ��SKU 8001����`LOCKED=4`��������ھ��� `ADMIN_APPROVED=2`��
- ������SKU 8001����`LOCKED=2`��������������������롣
- ���ͷ���ʷ�������ʲ���`9017`������ `11013`����`9019`������ `11014`����

## R3 ��������ߣ�2026-02-24 ���˵����ﳵΪ�գ�
### ����
- ��ǰ `replaceCartItems` ������ `setCart`���־û����� `useEffect`��
- ���˶����н�����ִ�� `navigate('/store/cart')`���ᵼ��ԭҳ�����������ж�أ�`useEffect` δ�����д�룬Ŀ��ҳ��ȡ���ɹ��ﳵ���գ���

### ����
- �� `useM02Cart` �ı��������ִ�С�ͬ���־û� + ״̬���¡��������������ύ�� effect��д�̡�
- �� `applications-page` ���˶������� `currentUserId` ����У�飬������д `anonymous` ���ﳵ��Ͱ��

### ʵʩ���
- `frontend/src/pages/m02-cart.ts`��`replaceCartItems` ��Ϊ����ͬ��д localStorage���ٸ���״̬��������������ת����д�붪ʧ��
- `frontend/src/pages/m02-cart.ts`��`clearCart`��`addSkuToCart`��`setCartQuantity` ͬ��д�̣�������Ϊһ�¡�
- `frontend/src/pages/applications-page.tsx`������ǰ���� `currentUserId` У�飬�û�������δ����ʱ��ִ�л���д�롣

## R4 ����ȷ����������ߣ�2026-02-24 ���������ֶΣ�
### ����
- `/applications` �С��������ϡ��������ӡ��������ơ��ֶΡ�
- `/inventory` �Ķ�Ӧ�����б�Ҳ���ӡ��������ơ��С�

### ��������
- ���ȸ������� SKU �ֶ����ɡ��������ơ���Ĭ��ʹ�� `brand + model`�������������ƻ������ݿ�����
- ��ҳ������ `brand/model`���������������ơ�������ֱ��չʾ�����Ƴ�ԭ�ֶΣ�����Ӱ�����ɸѡ�߼���

### ʵʩ���
- `/applications`�������б��е�����ժҪ�������������ơ��ֶα����ʽΪ���������� + �ͺ� + Ʒ�� + ��������
- `/inventory`��
  - �����ܱ��������������ơ��С�
  - ��̨�ʲ����������������ơ��У��� `skuId` �������������ƣ�ȱʧʱ���� `SKU-<id>`����
- ���ν���ǰ��չʾ����죬δ�������ݿ�ṹ�����

## R5 ����ȷ������ߣ�2026-02-24 materials ���������ֶΣ�
### ����
- `/materials` ����ά����Ƭȱ�١��������ơ��ֶΣ���Ҫ���롣

### ����
- ���ֲ��ü��ݷ��������������� `Ʒ�� + �ͺ�` ������ɲ�չʾ��
- ���������ݿ�ṹ���������Ӱ������ API ������Ǩ�ơ�
- ���б����½�/�༭������չʾ���������ơ��ֶΣ�����Ϊֻ��չʾ����

## R6 ��������ߣ�2026-02-24 22:36 materials ���������ֶΣ�
### ����
- /materials ������ά����Ƭֻ��Ʒ�ơ��ͺš������ֶΣ�û�С��������ơ��ֶΡ�

### ����
- ���ü��ݷ������������ư� Ʒ�� + �ͺ� ������ɣ����������ݿ��ֶΡ�
- ͬ����������λ�ã��б��С��½��������༭������

### ʵʩ���
- frontend/src/pages/materials-page.tsx �����б����������ơ��С�
- �½�/�༭����������ֻ�����������ơ��ֶΡ�

## ��¼������2026-02-24 22:39��
- ��һ���Ự��¼�е�������·����ʾ����ת���ַ�������Ϊ��ȷֵ��
- �ļ���frontend/src/pages/materials-page.tsx
- ���npm --prefix frontend run typecheck
- ���powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1



## R7 ����ȷ������ߣ�2026-02-24 22:44 �������ƿɱ༭��
### ����
- �û�Ҫ���������ơ������������д����Ӧ��Ʒ�����ͺ��Զ�ƴ�ӡ�

### ����
- �� SKU ����ģ������־û��ֶ� 
ame��
- ����/�༭����ʱ���� 
ame���б�ֱ����ʾ 
ame��
- ������ʷ���ݣ�Ǩ��ʱ����Ʒ�� + �ͺš�����ɼ�¼��
- ���չʾҳ��inventory/applications������ʹ�� 
ame��ȱʧʱ����ƴ�ӡ�

## R8 发现与决策（2026-02-24 23:10 物料名称可编辑收尾）
### 发现
- 当前 `frontend/src/pages/materials-page.tsx` 存在字符串闭合损坏，导致 TypeScript 解析在 388 行后中断。
- 后端 `sku.name` 持久化改造已落地，主要阻塞点在前端页面语法损坏，未能完成最终验证。

### 决策
- 先最小化修复 `materials-page.tsx` 的语法损坏点，确保编译恢复。
- 保持“物料名称可编辑”业务逻辑不回退：新建/编辑都使用独立 `name` 字段。
- 完成 typecheck + 后端回归 + Docker 刷新后再收尾。

## R8 实施结果（2026-02-24 23:18）
- 已修复 `materials-page.tsx` 中模板字符串闭合损坏与插值损坏，页面恢复可编译。
- “物料名称可编辑”链路保持生效：新建/编辑使用 `name` 字段，不再依赖品牌+型号拼接。
- 顺带修正了分类/审批人员统计文案中的模板占位符错误，避免页面显示异常。

## O1 发现与决策（2026-02-24 23:45 出库执行优化）
### 发现
- 当前 `/outbound` 待自提队列在列表中直接显示 `pickup_code`，不符合“仅申请人可见”的要求。
- 前端仍以 `applicantUserId` 和 `物料#skuId` 呈现，不符合运营可读性。
- 前端有两处“ADMIN_APPROVED 前置阻断”与“待分配资产说明”，与当前后端自动分配能力不一致。

### 决策
- 后端 `/outbound/pickup-queue` 不再返回 `pickup_code`，仅返回申请人姓名与物料名称。
- 后端 `/outbound/express-queue` 同步返回申请人姓名与物料名称。
- 前端移除“待分配资产...”提示与待自提两枚快捷填充按钮。
- 前端把“确认自提”核验类型默认值设为 `CODE`。

## O2 实施结果（2026-02-24 23:56）
- 管理员出库队列不再暴露取件码列表信息，避免非申请人侧可见。
- 队列可读性改造完成：申请人显示姓名、申请条目显示物料名称。
- 旧提示文案与待自提快捷按钮已移除，交互更聚焦。
- 核验默认方式已切换到取件码，符合现场交付习惯。

## F1 发现与决策（2026-02-24 applications/materials 乱码）
### 发现
- `/applications` 与 `/materials` 页面源码中的中文字符串已被写入为乱码字符，属于源码内容损坏，不是浏览器编码设置问题。
- `git` 最近稳定版本（`2f82f1b`）对应页面中文正常，可作为文案恢复基线。

### 决策
- 以最近稳定版本文案为基线恢复中文。
- 同时保留后续已实现业务能力：
  - `/applications`：回退购物车逻辑与“物料名称”显示。
  - `/materials`：物料名称可编辑（`name` 字段）相关表单与表格逻辑。
- 完成后执行 typecheck 与 Docker 刷新健康检查。

## F2 实施结果（2026-02-24 applications/materials 乱码修复）
- `applications-page.tsx`：已重写页面文案为正常中文，保留并校正以下业务逻辑：
  - 被驳回申请回退到购物车；
  - 回退前用户身份校验；
  - 申请列表物料摘要按“物料名称/型号/品牌/数量”展示。
- `materials-page.tsx`：在恢复中文文案基础上，保留以下功能不回退：
  - 新建/编辑物料时可填写并提交 `name`（物料名称）；
  - 编辑提交携带 `isVisible`，保持可见性链路一致；
  - 列表新增“物料名称”列并优先显示 `name`。
- 回归验证：前端 typecheck、Docker 刷新、健康检查均通过。

## V1 发现与决策（2026-02-24 可见性开关入口缺失）
### 发现
- `is_visible` 后端链路仍有效：商城列表只取 `is_visible=true`。
- 入口缺失原因：
  1) `/inventory` 的 SKU 管理卡片已按需求删除；
  2) `/materials` 当前无“可见性切换”交互（仅编辑保存时携带 `isVisible`）。

### 决策
- 在 `/materials` 的物料表中补回入口：
  - 新增“商城可见”列显示当前状态；
  - 操作列新增“设为隐藏/设为可见”按钮，直接切换并刷新列表。
- 不改后端协议，仅调用现有 `updateAdminSku` 完成切换。

## V2 实施结果（2026-02-24 可见性入口恢复）
- 在 `frontend/src/pages/materials-page.tsx` 已补齐商城可见性管理入口：
  - 表格新增“商城可见”状态列；
  - 操作列新增“设为隐藏/设为可见”切换按钮；
  - 切换时复用现有 `updateAdminSku` 接口，携带完整字段避免覆盖。
- 现状：
  - 商城端仍只展示 `is_visible=true` 物料；
  - 管理端可直接切换是否在商城展示。

## R9 需求确认与决策（2026-02-24 新增物料入口上移）
### 需求
- 用户要求把“新增物料”按钮放到卡片上方，位置更显眼。

### 决策
- 在“物料维护”卡片头部新增主按钮（主色按钮），用于展开/收起“新增物料”表单。
- 保留原有新增物料字段与提交流程，不改后端接口，仅改前端交互层。

## R9 实施结果（2026-02-24 新增物料入口上移）
- 已在 `/materials` 的“物料维护”卡片头部新增主按钮“新增物料/收起新增物料”。
- “新增物料”表单已移动到卡片上方区域，点击按钮可展开或收起。
- 保留原有创建逻辑与字段，不改后端接口，仅优化前端交互与可见性。
- 相关样式新增 `materials-card-toolbar`、`materials-create-sku-trigger`，确保按钮更显眼。

## R10 需求确认与决策（2026-02-24 公告栏管理）
### 需求
- 导航菜单新增“公告栏管理”。
- 完善公告栏管理能力，避免只能通过通用 CRUD 面板低效维护。

### 决策
- 新增独立页面 `/announcements/manage`，提供公告表格、关键字查询、状态筛选、分页、创建、编辑、删除、发布、下线、内容预览。
- 复用现有后端 `admin/crud/announcements` 接口，不新增数据库结构。
- 路由角色先与后台管理一致：`SUPER_ADMIN`；权限映射使用 `RBAC_ADMIN:UPDATE`。

## R10 实施结果（2026-02-24 公告栏管理）
- 新增 `frontend/src/pages/announcement-manage-page.tsx`，提供公告可视化管理能力：
  - 查询：关键字、状态筛选、分页；
  - 操作：创建、编辑、删除、发布、下线；
  - 预览：支持正文内容预览。
- 新增导航与路由：`/announcements/manage`，菜单名称“公告栏管理”。
- 权限链路补齐：
  - 前端 `permissions` 新增 route/action 映射；
  - 后端 `m08_admin` 默认 UI guard 新增 route/action 项；
  - RBAC 页面补齐新路由与动作中文标签。
- 本期复用 `admin/crud/announcements` 后端接口，不新增数据库结构。

## R11 需求确认与决策（2026-02-24 materials 卡片布局）
### 需求
- 物料维护卡片移动到分类维护卡片下方。
- 所有卡片都横向铺满。

### 决策
- 保持卡片顺序不变（分类维护在前、物料维护在后），并将两张卡片都设置为跨两列满宽（`inbound-wide`），在 `inbound-grid` 中按纵向顺序全宽展示。
- 不改业务逻辑，仅调整布局类名。

## R11 实施结果（2026-02-24 materials 卡片布局）
- `frontend/src/pages/materials-page.tsx` 中两张主卡片均增加 `inbound-wide` 类。
- 在 `inbound-grid` 双列网格下，卡片跨两列显示，形成上下满宽布局。
- 不涉及接口与业务逻辑变更，仅调整页面布局。

## R12 发现与决策（2026-02-28 仪表盘 502）
### 发现
- `docker compose -f deploy/docker-compose.yml ps` 显示 `deploy-backend-1` 持续重启。
- `docker compose -f deploy/docker-compose.yml logs --tail 120 backend` 显示启动失败根因：`backend/app/api/v1/routers/m07_reports.py` 存在 `SyntaxError: unmatched ')'`。
- `nginx` 日志中的 `backend could not be resolved (3: Host not found)` 是后果，不是根因；根因仍是 backend 进程无法正常启动。

### 决策
- 先做最小修复：仅删除 `m07_reports.py` 末尾多余右括号，不改业务逻辑。
- 修复后按仓库规则执行 Docker 刷新与健康检查，确认 `/healthz` 与 `/api/healthz` 均通过。

## R12 验证结论（2026-02-28 仪表盘 502）
- 修复点：`backend/app/api/v1/routers/m07_reports.py` 删除多余右括号，`python -m py_compile` 通过。
- 容器状态：`deploy-backend-1`、`deploy-nginx-1` 均为 `healthy`。
- 健康检查：
  - `http://127.0.0.1:18080/healthz` 返回 `ok`。
  - `http://127.0.0.1:18080/api/healthz` 返回 `{"status":"ok"}`。
- 接口链路恢复：原先 `502` 的三个接口均可到达后端，当前返回 `401`（未登录），说明错误已从网关/后端崩溃修复为正常鉴权行为。
