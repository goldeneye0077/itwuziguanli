## Active Task (2026-02-12 ???????????? - ??)
### Goal
? `/store` ???????????????????????????
### Current Phase
Phase A2-Closed?????

### ????
- [x] ????????planning-with-files?
- [x] ?????????????????
- [x] ?????????`npm --prefix frontend run typecheck`
- [x] Docker ?????`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`
- [x] ???????`/healthz=ok`?`/api/healthz={"status":"ok"}`
## Active Task (2026-02-12 ????????????)
### Goal
? `/store` ???????????????????????????????
### Current Phase
Phase A1-Implementation?????

### ??????
- [x] ????????planning-with-files?
- [x] ?????????????????
- [ ] ??????
- [ ] Docker ???????
## Active Task (2026-02-12 ??????????? - ??)
### Goal
??????????????????????????????????
### Current Phase
Phase P2-Closed?????

### ????
- [x] ??????????planning-with-files?
- [x] ? `useM02Cart` ????? `sessionStorage` ?? `localStorage`
- [x] ??????????`sessionStorage -> localStorage`?
- [x] ?????????`npm --prefix frontend run typecheck`
- [x] Docker ?????`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`
- [x] ???????`/healthz=ok`?`/api/healthz={"status":"ok"}`
## Active Task (2026-02-12 ???????????)
### Goal
????????????????????????????????????????????????
### Current Phase
Phase P1-Implementation?????

### ??????
- [x] ??????????planning-with-files?
- [ ] ? `useM02Cart` ????? `sessionStorage` ?? `localStorage`
- [ ] ??????????`sessionStorage -> localStorage`?
- [ ] ??????
- [ ] Docker ???????
�?# Active Task (2026-02-12 全页面顶�?M 文案移除)
### Goal
移除各页面顶部横幅中�?`M` 开头的模块文案（如 `M02 商城`），保留页面标题与业务功能不变�?
### Current Phase
Phase B3-Closed（已完成�?

### 本轮实施清单
- [x] 记录需求与实施方案（planning-with-files�?
- [x] 批量移除 `className="app-shell__section-label"` �?`Mxx ...` 文案标签
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`
- [x] Docker 刷新通过：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`
## Active Task (2026-02-12 购物车按用户隔离 - 收尾)
### Goal
修复“不同用户共享同一购物车”的问题：购物车必须与登录用户绑定，每个用户只能看到自己的购物车内容�?
### Current Phase
Phase U2-Closed（已完成�?

### 收尾清单
- [x] 记录需求与实施方案（planning-with-files�?
- [x] 调整购物车存储键为用户维度（userId�?
- [x] 用户切换时自动加载对应购物车
- [x] 更新调用方传入当前用户ID
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`
- [ ] Docker 刷新与健康检�?
## Active Task (2026-02-12 购物车缩略图尺寸下调 - 收尾)
### Goal
�?`/store/cart` 物料清单中的缩略图尺寸缩小到当前视觉效果的大约一半，提升表格可读性�?
### Current Phase
Phase C2-Closed（已完成�?

### 收尾清单
- [x] 记录需求与方案（planning-with-files�?
- [x] 仅调�?`/store/cart` 缩略图样式，不影响其他页�?
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`
- [x] Docker 刷新通过：`deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`
## Active Task (2026-02-12 出库记录列表文案与交互精简 - 收尾)
### Goal
将“出库记录列表”改为纯滚动查看：移除“向�?向右”按钮，并把表头统一改成中文，提升可读性�?
### Current Phase
Phase Z2-Closed（已完成�?

### 收尾清单
- [x] 记录需求与实施方案（planning-with-files�?
- [x] 移除出库记录列表的左右滚动按钮与关联逻辑
- [x] 出库记录列表表头全部改为中文
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`
- [x] Docker 刷新通过：`deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`
## Active Task (2026-02-12 滚动条不可见根因修复 - 收尾)
### Goal
修复“列被截断但无可用横向滚动入口”的布局问题，确保表格容器真实产生横向滚动并可被用户操作�?
### Current Phase
Phase Y2-Closed（已完成�?

### 收尾清单
- [x] 记录问题根因与修复方�?
- [x] 修复卡片与表格容器的宽度约束（`min-width: 0` / `max-width: 100%`�?
- [x] 确保提示区左右按钮稳定可�?
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`
- [x] Docker 刷新通过：`deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`
## Active Task (2026-02-12 表格横向可用性修�?- 收尾)
### Goal
解决滚动条不易发现导致后续列不可见的问题�?
### Current Phase
Phase X2-Closed（已完成�?

### 收尾清单
- [x] `/outbound` 记录表增加左右滚动按�?
- [x] `/outbound` �?`/admin/crud` 横向滚动条样式增强并强可�?
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`
- [x] Docker 刷新通过：`deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`
## Active Task (2026-02-12 表格横向可用性修�?
### Goal
解决“看不到滚动条导致后续列不可见”的问题，确保出库记录与数据面板都可稳定横向浏览�?
### Current Phase
Phase X1-Implementation（进行中�?

### 收尾清单
- [x] 记录需求与修复方案�?planning-with-files 文档
- [ ] 出库记录表增加左右滚动按钮（不依赖系统滚动条可见性）
- [ ] 出库记录与数据面板表格滚动条样式增强（轨�?颜色/强可见）
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`
- [x] Docker 刷新通过：`deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`
## Active Task (2026-02-12 数据面板结果表格横向滚动优化 - 收尾)
### Goal
确保 `/admin/crud` 结果表格在多列场景下可通过横向滚动完整浏览�?
### Current Phase
Phase D2-Closed（已完成�?

### 收尾清单
- [x] `admin-crud-table-wrap` 增强横向滚动样式
- [x] 数据表格列改为不换行并按内容扩展宽度
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`
- [x] Docker 刷新通过：`deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`
## Active Task (2026-02-12 数据面板结果表格横向滚动优化)
### Goal
�?`/admin/crud` 数据结果表格在字段较多时支持清晰的横向滚动浏览，避免列被挤压和换行�?
### Current Phase
Phase D1-Implementation（进行中�?

### 收尾清单
- [x] 记录需求与方案�?planning-with-files 文档
- [ ] 调整 `frontend/src/styles/index.css` �?`admin-crud-table-wrap` 相关样式
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`
- [x] Docker 刷新通过：`deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`
## Active Task (2026-02-12 出库记录列表横向滚动优化 - 收尾)
### Goal
确保 `/outbound` 出库记录表格在任意窗口宽度下都能通过横向滚动完整查看�?
### Current Phase
Phase U2-Closed（已完成�?

### 收尾清单
- [x] `outbound-record-table-wrap` 增强横向滚动样式
- [x] 出库记录表头/单元格设置不换行，避免被压缩换行
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`
- [x] Docker 刷新通过：`deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`
## Active Task (2026-02-12 出库记录列表横向滚动优化)
### Goal
�?`/outbound` 的“出库记录列表”区域增加清晰可用的横向滚动条，确保全字段表格在小屏和窄窗口下可完整浏览�?
### Current Phase
Phase U2-Closed（已完成�?

### 收尾清单
- [x] 记录需求与方案�?planning-with-files 文档
- [ ] 调整 `frontend/src/styles/index.css` 的出库记录表格容器样式（横向滚动优先�?
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`
- [x] Docker 刷新通过：`deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`
## Active Task (2026-02-12 M05 出库记录与导�?- 收尾验收)
### Goal
完成 `/outbound` 出库记录能力的最终验收，确认接口、权限、页面、导出与自动化验证均闭环�?
### Current Phase
Phase O3-Closed（已完成�?

### 收尾验收清单
- [x] 后端 `GET /api/v1/outbound/records` 可按条件查询并分页返�?
- [x] 后端 `GET /api/v1/outbound/records/export` 可按当前筛选导�?UTF-8 BOM CSV
- [x] 申请人字段遵循快照口径（历史无快照留空，不回填当前用户）
- [x] 前端 `/outbound` 新增“出库记录”Tab、筛选表单、全字段表格、导出按�?
- [x] 权限链路闭环：route/action/API 均接�?`OUTBOUND:READ`
- [x] 自动化验证通过：`pytest backend/tests/test_step13_m04_m05.py -q`、`pytest backend/tests/test_step17_m08_admin.py -q`、`npm --prefix frontend run typecheck`
- [x] Docker 刷新与健康检查通过：`/healthz`、`/api/healthz`
## Active Task (2026-02-12 M05 出库记录与导�?
### Goal
�?`/outbound` 页面新增“出库记录”Tab，支持全字段筛选查询、明细表格展示与 CSV 导出；记录来源统一聚合 `stock_flow` �?`sku_stock_flow`，申请人信息仅取申请单快照字段�?
### Current Phase
Phase O2-Delivery（已完成�?

### 收尾清单
- [x] 后端新增 `GET /api/v1/outbound/records`
- [x] 后端新增 `GET /api/v1/outbound/records/export`
- [x] 后端实现 `stock_flow + sku_stock_flow` 归一化与全字段返�?
- [x] 后端增加 `OUTBOUND:READ` 权限校验（记录查�?导出�?
- [x] 前端新增出库记录 API 类型与调�?
- [x] 前端 `/outbound` 增加“出库记录”Tab + 筛�?+ 全字段表�?+ 导出
- [x] 权限映射补齐（route/action �?`OUTBOUND:READ`�?
- [x] 自动化验证：`pytest backend/tests/test_step13_m04_m05.py -q`、`pytest backend/tests/test_step17_m08_admin.py -q`、`npm --prefix frontend run typecheck`
- [x] Docker 刷新与健康检查通过

### 本轮错误记录
- 首次 `python -m py_compile` 报错：`m05_outbound.py` 旧乱码文案导�?f-string 未闭合。已统一替换为正常中文错误文案并通过编译�?
- `outbound-page.tsx` 单次写入命令超出 Windows 长度限制。已改为分段写入并完成类型检查�?
## Active Task (2026-02-12 鍑哄簱鎵ц椤垫柊澧炲嚭搴撹�?
### Goal
�?`/outbound` 椤甸潰鏂板鈥滃嚭搴撹褰曗€漈ab锛屾彁渚涙槑缁嗙矑搴﹀叏瀛楁鏌ヨ�?CSV 瀵煎嚭锛涚敵璇蜂汉淇℃伅浠呭睍绀虹敵璇峰崟蹇収瀛楁锛屽巻鍙叉棤蹇収鍒欑暀绌恒�?
### Current Phase
Phase O1-Discovery锛堢幇鐘舵牳鏌ュ畬鎴愶紝杩涘叆鎺ュ彛涓庨〉闈㈠疄鐜帮�?

### 鏈疆瀹炴柦娓呭崟
- [ ] 鍚庣锛氭柊�?`GET /api/v1/outbound/records`
- [ ] 鍚庣锛氭柊�?`GET /api/v1/outbound/records/export`
- [ ] 鍚庣锛氳ˉ鍏?`OUTBOUND:READ` 鏉冮檺鏍￠獙涓庡厹搴?- [ ] 鍓嶇锛氭柊澧炲嚭搴撹�?API 绫诲瀷涓庤皟�?- [ ] 鍓嶇锛�?outbound` 澧炲姞鈥滃嚭搴撹褰曗€漈ab + 绛涢�?+ 琛ㄦ�?+ 瀵煎�?
- [ ] 楠岃瘉锛氬悗绔祴璇?+ 鍓嶇�?typecheck
- [ ] Docker 鍒锋柊涓庡仴搴锋鏌?## Active Task (2026-02-12 鏁版嵁闈㈡澘鍙鍖?CRUD 鏀归€?
### Goal
�?`/admin/crud` 鐨勫啓鎿嶄綔�?JSON 鏂囨湰杈撳叆鏀逛负鍙鍖栬〃鍗曪紙瀛楁鍖栧垱�?缂栬�?鍒犻櫎锛夛紝涓嶅啀瑕佹眰鎵嬪啓鈥滃垱寤?JSON / 鏇存�?JSON鈥濄�?
### Current Phase
Phase C4-Delivery锛堝凡瀹屾垚瀹炵幇銆佹牎楠屼笌鐜鍒锋柊锛?
### 鏈疆瀹炴柦娓呭崟
- [x] 姊崇悊鍚庣 `admin/crud` 鍏被璧勬簮鍐欏叆瀛楁涓庢灇涓剧害鏉?- [x] 鍓嶇�?`admin-crud-page` 绉婚�?JSON textarea 涓庤В鏋愰€昏�?
- [x] 鏂板鎸夎祫婧愬姩鎬佹覆鏌撶殑鍒涘缓/缂栬緫琛ㄥ崟锛堝瓧娈靛寲杈撳叆锛?- [x] 鍏煎�?`applications.express_address_snapshot` 鐨勫彲瑙嗗寲鍦板潃瀛楁�?
- [x] 鍥炲綊楠岃瘉锛歚npm --prefix frontend run typecheck`
- [x] Docker 鍒锋柊涓庡仴搴锋鏌?
### 鏈疆閿欒璁板�?
- `apply_patch` 鐩存帴鏁存枃浠舵浛鎹?`admin-crud-page.tsx` 鏃惰Е�?Windows 鈥滄枃浠跺悕鎴栨墿灞曞悕澶暱鈥濓紝宸叉敼涓哄垎娈佃ˉ涓佹柟寮忓畬鎴愩�?- Docker 鍒锋柊棣栨澶辫触锛氬墠绔瀯寤哄湪 `npm install --no-save vite@^5.4.14` 闃舵璁块棶 `registry.npmjs.org` �?`ECONNRESET`锛涘凡閫氳繃 `frontend/Dockerfile` 鍒囨�?`npmmirror` 骞惰缃?`strict-ssl=false` 淇銆?## Active Task (2026-02-11 缁х画瀹炴�?
### Goal
瀹屾垚鈥滈鐢ㄦ祦绋嬩笌瀹℃壒閾捐矾閲嶆瀯鏂规鈥濆墿浣欑己鍙ｏ紝閲嶇偣鍖呭惈锛?- 鍟嗗煄渚ф�?璐墿杞︾粺涓€鎻愪氦鑳藉姏锛堥儴闂ㄤ笅�?+ 蹇€掑湴鍧€鍐呰仈�?- 鎴戠殑鐢宠鏀瑰悗绔暟鎹簮锛坄/api/v1/me/applications`�?- 鐢宠璇︽儏鍙岃〃涓庡鎵硅鎯呭脊绐楋紙棰嗗/绠＄悊鍛橈級
- 鏁版嵁闈㈡澘琛ラ�?CRUD 鍐欐帴鍙ｏ紝骞舵敹鏁涗负�?`SUPER_ADMIN`

### Current Phase
R2-Phase 3/3 宸插畬鎴愶紙瀹炵�?+ 鍥炲�?+ Docker 鍒锋柊楠屾敹�?
### 鏈疆瀹炴柦娓呭崟
- [x] 鍚庣锛歚m03` 璇︽儏鍝嶅簲琛ラ綈鏍囬/鐢宠浜哄揩�?蹇€掑湴鍧€蹇収/鐗╂枡璇︽儏
- [x] 鍚庣锛歚m08` 鏂板�?`POST/PUT/DELETE /admin/crud/{resource}`锛坄applications` 杞垹闄わ級
- [x] 鍓嶇锛欰PI 绫诲瀷涓庡嚱鏁拌ˉ榻愶紙`/me/departments`銆乣/me/applications`銆丆RUD 鍐欐帴鍙ｏ級
- [x] 鍓嶇锛�?store` 渚ф爮銆乣/store/cart`銆乣/applications`銆乣/approvals`銆乣/admin/crud` 鏀归€?- [x] 鏉冮檺锛�?admin/crud` 璺敱鏀逛粎 `SUPER_ADMIN`
- [x] 楠岃瘉锛氬悗绔祴璇?+ 鍓嶇�?typecheck + Docker 鍒锋柊涓庡仴搴锋鏌?# Task Plan: 鐗╂�?/materials) + 搴撳�?/inventory) + 鍏ュ�?/inbound) 鏁伴噺搴撳瓨閲嶆�?

## Active Task (2026-02-11)
### Goal
瀹炴柦鈥滈鐢ㄦ祦绋嬩笌瀹℃壒閾捐矾閲嶆瀯鏂规锛堝惈鐢ㄦ埛鎵╁睍銆佺敵璇疯鎯呫€佸鎵瑰脊绐椼€佹暟鎹潰鏉?CRUD锛夆€濓紝瑕嗙洊浠ヤ笅浜や粯�?- 鎵╁�?`sys_user` 瀛楁锛歚department_name`銆乣section_name`銆乣mobile_phone`銆乣job_title`
- 鐢宠閾捐矾琛ラ綈锛氬晢鍩庝晶鏍忎笌璐墿杞﹂〉缁熶竴鍙彁浜わ紙鍚揩閫掑湴鍧€锛夛紝鐢宠鏍囬鑷姩鐢熸垚锛岀敵璇蜂汉/鍦板潃蹇収钀藉簱
- 鈥滄垜鐨勭敵璇封€濇敼涓哄悗绔寜褰撳墠鐧诲綍鐢ㄦ埛鏌ヨ锛岀鐢ㄥ墠�?session 涓存椂鏁版嵁�?- 鐢宠璇︽儏缁熶竴涓哄弻琛ㄧ粨鏋勶紙鐢宠浜轰俊鎭�?+ 鐗╂枡娓呭崟琛�?
- 棰嗗�?绠＄悊鍛樺鎵归〉鈥滄煡鐪嬭鎯呪€濇敼涓哄脊绐楋紝瀹℃壒鎰忚鏀逛负涓嬫媺锛堝悓�?椹冲洖锛夛紝椹冲洖鍘熷洜鏉′欢蹇呭�?
- 鏁版嵁闈㈡澘鍗囩�?CRUD锛屼笖浠?`SUPER_ADMIN` 鍙闂紱`applications` 鍒犻櫎鏀硅蒋鍒犻櫎锛坄CANCELLED`�?
### Current Phase
Phase R2-Verification锛堝凡瀹屾垚锛?
### R2 Phases
- R2-Phase 1: 鐜扮姸鐩樼偣涓庡樊璺濈‘璁わ紙瀹屾垚锛?- R2-Phase 2: 鍚庣妯″�?杩佺Щ/API 鏀归€狅紙瀹屾垚锛?- R2-Phase 3: 鍓嶇椤甸潰涓庝氦浜掓敼閫狅紙瀹屾垚锛?- R2-Phase 4: 鍥炲綊娴嬭瘯�?Docker 鍒锋柊楠屾敹锛堝畬鎴愶級

## Goal
閲嶆瀯鐗╂枡銆佸簱瀛樹笌鍏ュ簱涓夎€呰亴璐ｈ竟鐣岋紝骞跺紩鍏モ€滄暟閲忓簱瀛樷€濊兘鍔涳細
- `/materials`锛氱墿鏂?SKU) CRUD + 鍒嗙�?Category) CRUD锛堟敮鎸佸ぇ�?灏忕被灞傜骇锛夛紝涓嶅寘鍚簱瀛樻暟閲忎俊�?- `/inventory`锛氬簱瀛樼鐞嗭紙浠ユ暟閲忓簱瀛樹负涓伙級锛岃〃鏍煎寲灞曠�?`on_hand/reserved/available`锛屽苟鎻愪緵搴撳瓨鎿嶄綔锛堝叆搴?鍑哄�?鐩樼偣璋冩暣/娴佹按瀵煎嚭锛?- `/inbound`锛氫繚鐣欐墜宸ュ叆搴撲笌 OCR 鍏ュ簱锛涘彲璺宠�?`/inventory`銆乣/materials`锛涙牴鎹?SKU 搴撳瓨妯″紡璧扳€滃簭鍒楀彿璧勪骇鍏ュ簱鈥濇垨鈥滄暟閲忓叆搴撯�?- `/inbound`锛氱墿鏂欎富鏁版嵁鍙厑璁稿�?`/materials` 鏂板缓锛涘叆搴撻〉浠呭厑璁搁€夋嫨宸叉湁鐗╂枡鎵ц鍏ュ簱
- 鍏ㄩ摼璺竴鑷达細鐢宠鎻愪氦棰勫崰銆佸鎵归┏鍥為噴鏀俱€佸嚭搴撴墸鍑忓繀椤讳笌搴撳瓨鑱斿姩涓斿彲杩芥�?
- RBAC 琛ラ綈鈥滆彍鍗曠�?+ 鎸夐挳绾?permission 鏍￠獙閾捐矾鈥濓�?
  - 鍓嶇锛氳彍鍗曟樉绀恒€佽矾鐢辫繘鍏ャ€佸叧閿寜閽彲�?鍙偣鍑婚兘鎺ュ�?permission 鍒ゅ�?
  - 鍚庣锛氬叆�?搴撳�?鐗╂枡涓庡悗鍙扮鐞嗘帴鍙ｈˉ�?permission 鏍￠獙锛堜笌瑙掕壊鏍￠獙骞惰锛?- `/admin/rbac` 鐨勯〉闈?鎸夐挳鏄犲皠鏀寔鍙厤缃淮鎶わ�?
  - 鏀寔鏂板�?`routePath` / `actionId` 鏄犲皠椤?  - 鏀寔鍒犻櫎鏄犲皠�?  - 淇濆瓨鍚庣珛鍗冲褰撳墠鍓嶇浼氳瘽鐢熸晥锛堟棤闇€閲嶆柊鐧诲綍�? - `/admin/rbac` 琛ュ洖鈥滅粰瑙掕壊璧嬩簣鏉冮檺鈥濈殑鍙鍖栬兘鍔涳�?
  - 閫夋嫨瑙掕壊鍚庡彲鍕鹃€夋潈闄愰�?
  - 涓€閿繚瀛樿鑹?鏉冮檺缁戝畾
  - 涓庢枃鏈粦瀹氱紪杈戝櫒淇濇寔涓€鑷?
## Success Criteria
- `/materials`锛氬垎绫绘爲鍙淮鎶わ紙鏂板�?鏀瑰悕/绉诲�?鍒犻櫎鍙楅檺锛夛紝SKU 琛ㄦ�?CRUD 鍙敤锛屾敮鎸佽缃?`stock_mode`
- `/inventory`锛氶〉闈㈤粯璁ゅ睍绀鸿〃鏍硷紱鏀寔绛涢€夛紱鏁伴噺搴撳瓨鍙叆�?鍑哄�?鐩樼偣璋冩暣骞惰惤娴佹按锛涙祦姘村彲瀵煎�?CSV锛圗xcel 鍙洿鎺ユ墦寮€�?- `/inbound`锛氬簭鍒楀彿璧勪骇鍏ュ簱娴佺▼涓嶅洖褰掞紱鏂板鏁伴噺鍏ュ簱鍏ュ彛锛汷CR 鍏ュ簱浠嶅彲�?- 鏁伴噺搴撳瓨瀵圭敵璇?瀹℃�?鍑哄簱鍏ㄩ摼璺敓鏁堬細`reserved` �?`on_hand` 閫昏緫姝ｇ�?
- Docker 鍒锋柊鍚庯紙`deploy/scripts/refresh-dev.ps1`锛夊彲鍦?`http://127.0.0.1:18080` 鍐掔儫楠岃瘉閫氳�?

## Current Phase
Phase 3

## Phases

### Phase 1: Requirements & Discovery
- [x] 鏄庣‘鑱岃矗杈圭晫锛?materials 浠呬富鏁版嵁�?inventory 绠℃暟閲忥紱/inbound 绠″叆�?- [x] 鏄庣‘搴撳瓨妯″紡锛歋KU 鍙岃建锛圫ERIALIZED 搴忓垪鍙疯祫�?/ QUANTITY 鏁伴噺搴撳瓨�?- [x] 鏄庣‘鏁伴噺搴撳瓨鑱斿姩鐐癸細鐢宠棰勫崰銆侀┏鍥為噴鏀俱€佸嚭搴撴墸鍑?- [x] 鏄庣‘娴佹按瀵煎嚭锛氬簱瀛樻搷浣滆褰曞彲瀵煎�?Excel锛堜紭鍏?CSV�?- Status: in_progress

### Phase 2: Design
- [x] DB锛歚sku.stock_mode` + `sku_stock` + `sku_stock_flow`
- [x] API�?skus 鍙敤搴撳瓨鍏煎鍙屾ā寮忥紱鏁伴噺搴撳瓨鎿嶄綔蹇呴』鍐欐祦姘达紱鏀寔 CSV 瀵煎�?
- [x] 鍓嶇锛氭柊�?`/materials`锛涢噸鏋?`/inventory`锛涙墿灞?`/inbound`锛堟暟閲忓叆搴擄�?
- Status: complete

### Phase 3: Implementation
- [x] 鍚庣锛氭柊澧炶縼绉伙紙`stock_mode` + `sku_stock` + `sku_stock_flow`�?- [x] 鍚庣锛歚GET /api/v1/skus` 鍙敤搴撳瓨鏀寔 QUANTITY
- [x] 鍚庣锛歚POST /api/v1/applications` �?QUANTITY 鎵ц reserved 棰勫�?
- [x] 鍚庣锛氶┏�?閲婃斁�?QUANTITY 鍥炴�?reserved
- [x] 鍚庣锛氬嚭搴撳�?QUANTITY 鎵ｅ�?on_hand �?reserved
- [x] 鍚庣锛氭柊澧炴暟閲忓簱瀛樻搷浣滄帴鍙ｏ紙鍏ュ簱/鍑哄�?鐩樼�?娴佹按鏌ヨ/CSV 瀵煎嚭锛?- [x] 鍚庣锛氭柊澧炲垎绫?CRUD 鎺ュ彛锛堥槻�?鍒犻櫎绾︽潫�?- [x] 鍓嶇锛氭柊�?`/materials` 椤甸潰锛堝垎绫绘�?CRUD + SKU CRUD锛屼笉灞曠ず搴撳瓨鏁帮級
- [x] 鍓嶇锛氶噸�?`/inventory`锛堥粯璁よ〃鏍?+ 绛涢�?+ 鏁伴噺搴撳瓨鎿嶄�?+ 娴佹按瀵煎嚭锛?- [x] 鍓嶇锛氭墿�?`/inbound`锛堟暟閲忓叆�?+ 璺宠浆锛汷CR 涓嶅洖褰掞級
- [x] 鍓嶇锛�?inbound` 鎵嬪伐鍏ュ簱鏀逛负浠呭厑璁搁€夋嫨宸叉湁鐗╂枡锛堢鐢ㄦ柊寤虹墿鏂欙級锛岀墿鏂欎笅鎷夋寜鍒嗙被灞傜骇灞曠ず锛涙柊澧炲叆搴撴暟閲忎笌 SN 鑱斿姩锛涚Щ闄ょ嫭绔嬫暟閲忓叆搴撳崱鐗?- [x] 鍓嶇锛氬乏渚у鑸彍鍗曞皢 `/inbound` 鏂囨浠庘€滃叆搴撯€濇敼涓衡€滅墿鏂欏叆搴撯€?- [x] `/inventory` 椤甸潰甯冨眬閲嶆帓锛氬垹闄も€滅墿鏂欙紙SKU锛夋煡璇笌绠＄悊鈥濆崱�?- [x] `/inventory` 椤甸潰甯冨眬閲嶆帓锛氬皢鈥滄煡璇㈠簱瀛樻眹鎬烩€濇媶涓哄乏渚х嫭绔嬪崱鐗囷紝骞朵笌鈥滆祫浜у垱寤?鏌ヨ鈥濆苟�?- [x] `/inventory` 椤甸潰甯冨眬寰皟锛氬皢鈥滄煡璇㈠簱瀛樻眹鎬烩€濅笌鈥滆祫浜у垱寤?鏌ヨ鈥濇敼涓轰笂涓嬫帓鍒楋紙搴撳瓨姹囨€诲湪涓婏級
- [x] 鍓嶇锛氭柊澧炵粺涓�?permission 鏄犲皠涓庡垽瀹氬伐鍏凤紙actionId/route -> permission�?- [x] 鍓嶇锛氫晶杈规爮鑿滃崟�?permission + role 鍙岄噸杩囨护
- [x] 鍓嶇锛氬彈淇濇姢璺敱澧炲�?permission 鏍￠獙涓庢棤鏉冮檺鎻愮ず
- [x] 鍓嶇锛氬叧閿笟鍔￠〉闈㈡寜閽帴鍏?permission 鏍￠獙锛堣嚦�?inbound/inventory/materials/admin-rbac/admin-crud�?- [x] 鍚庣锛歚AuthContext` 琛ュ�?permissions锛屽苟鏂板 permission 渚濊�?鏂█宸ュ叿
- [x] 鍚庣锛歚m06`銆乣m08` 鍏抽敭鎺ュ彛鎺ュ�?permission 鏍￠�?
- [x] 鍓嶇锛�?admin/rbac` 澧炲姞鈥滈〉闈㈡潈闄愰厤缃€濃€滄寜閽潈闄愰厤缃€濋潰鏉?- [x] 鍓嶇锛氶〉闈?鎸夐挳閰嶇疆鎿嶄綔鍐欏洖鏉冮檺缁戝畾缂栬緫鍣ㄥ苟閫氳繃鈥滀繚瀛樿鑹茬粦瀹氣€濈敓鏁?- [x] 鍓嶇锛氶〉闈㈡槧灏勪笌鎸夐挳鏄犲皠鏀寔鏂板銆佸垹闄わ紙涓嶅啀灞€闄愬浐瀹氭潯鐩級
- [x] 鍓嶇锛氫繚瀛樺墠澧炲姞�?key / 閲嶅�?key 鏍￠獙锛岄伩鍏嶈鐩栨垨鑴忔暟鎹?- [x] 鍓嶇锛氳ˉ鍏呭彲瑙嗗寲鈥滆鑹茶祴鏉冣€濋潰鏉匡紙鍕鹃€夋潈闄愬苟淇濆瓨瑙掕壊缁戝畾�?- Status: in_progress

### Phase 4: Verification
- [x] 鍚庣�?pytest锛氳鐩?QUANTITY 鐨勬暟閲忓簱瀛樻搷浣滐紙鍏ュ�?鍑哄�?鐩樼�?瀵煎嚭锛?- [ ] 鍚庣�?pytest锛氳鐩?QUANTITY 鐨勯鍗?閲婃�?鍑哄簱鍏ㄩ摼璺紙鐢宠/瀹℃�?鍑哄簱锛?- [x] 鍓嶇�?typecheck锛歚npm --prefix frontend run typecheck`
- [x] Docker 鍒锋柊锛歚powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`
- [x] Docker DB 杩佺Щ锛氬鍣ㄥ惎鍔ㄦ椂鑷姩鎵ц `alembic upgrade head`锛堥伩鍏嶆棫 volume 瀵艰�?500�?- [x] 閴存潈鍏滃簳锛氬�?access token 澶辨晥瀵艰�?401 鏃讹紝鍓嶇鑷姩娓呯悊鏈湴浼氳瘽骞惰烦杞櫥�?- [x] 鍐掔儫锛?materials /inventory /inbound /store /outbound 鏍稿績璺緞鍙�?
- [x] `/inbound`锛氭�?SKU 搴撳瓨妯″紡鑷姩鍒囨崲琛ㄥ崟锛岄伩鍏嶆暟閲忓簱瀛樹篃鏄剧ず SN 褰曞叆鍖哄鑷磋瑙?  - SERIALIZED锛氬繀椤诲綍鍏?SN锛涒€滃叆搴撴暟閲忊€濆彧璇讳笖绛変�?SN 鏉℃�?
  - QUANTITY锛氶殣钘?SN 褰曞叆鍖猴紱浠呭～鍐欌€滃叆搴撴暟閲忊€濆嵆鍙叆搴擄紙鏀寔 `occurredAt` 浼犲弬钀藉簱瀛樻祦姘达級
- [x] `/inventory`锛氬簱瀛樻眹鎬烩€滀娇鐢ㄤ腑鈥濇寜妯″紡娓叉�?
  - SERIALIZED锛氭樉绀虹湡瀹炰娇鐢ㄤ腑鏁伴�?
  - QUANTITY锛氭樉绀?`-`锛堜笉閫傜敤锛夊苟寮卞寲鏍峰紡锛屼笉鍐嶆樉绀?`0`
  - 琛ㄥご鏂囨鏀逛负鈥滀娇鐢ㄤ腑锛堜粎搴忓垪鍙疯祫浜э級鈥?- [ ] 鍐掔儫锛歈UANTITY 鐗╂枡鍙笉�?SN 鍏ュ簱锛汼ERIALIZED 浠嶈姹?SN
- [x] 鍓嶇�?typecheck锛歱ermission 閾捐矾鏀归€犲悗閫氳�?
- [x] 鍚庣�?compile/pytest锛歱ermission 閾捐矾鏀归€犲悗閫氳�?
- [ ] RBAC 鍐掔儫锛氳皟鏁磋鑹叉潈闄愬悗锛岃彍�?鎸夐�?API 鎷掔粷涓庢斁琛岃涓轰竴�?- [ ] RBAC 鍐掔儫锛氶〉闈㈡潈闄愰厤缃笌鎸夐挳鏉冮檺閰嶇疆淇濆瓨鍚庣珛鍗崇敓�?- [ ] RBAC 鍐掔儫锛氭柊�?route/action 鏄犲皠鍚庯紝椤甸潰涓庢寜閽潈闄愬彲鍗虫椂鍙楁帶
- Status: in_progress

### Phase 5: Delivery
- [ ] 鏇存�?`task_plan.md`/`findings.md`/`progress.md` 鍙嶆槧鏈€缁堢姸鎬併€佸喅绛栦笌娴嬭瘯缁撴灉
- Status: pending

## Key Decisions
| Decision | Rationale |
|---|---|
| SKU 鍙岃建搴撳瓨妯″紡锛圫ERIALIZED/QUANTITY�?| 鍏煎鑰愮敤鍝侊紙闇�?SN锛変笌鑰楁潗锛堝彧闇€鏁伴噺锛変袱绫诲吀鍨嬪満�?|
| 鏁伴噺搴撳瓨绂佹鈥滆８鏀规暟瀛椻€濓紝鎵€鏈夊彉鏇村繀椤昏惤娴佹按 | 鍙拷婧€佸彲瀹¤銆佷究浜庡鍑轰笌鎺掗殰 |
| 娴佹按瀵煎嚭浼樺厛 CSV锛圲TF-8 BOM�?| Excel 鐩存帴鎵撳紑涓嶄贡鐮侊紝瀹炵幇绋炽€佷緷璧栧�?|

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| `m06_inbound_inventory.py` CSV 瀵煎嚭鏈熬瀛樺�?`f\\\"...\\\"` 璇硶閿欒瀵艰嚧鍚庣鏃犳硶缂栬瘧 | `python -m compileall backend/app` 澶辫触瀹氫綅鍒?`flows/export` | 淇涓烘爣�?Python 瀛楃涓诧紙`f"..."` 绛夛級锛屽苟閲嶆柊缂栬瘧閫氳�?|
| Docker 鍒锋柊鍚?`/api/v1/admin/skus`銆乣/api/v1/inventory/summary` 杩斿�?500 | 鏌ョ�?`docker compose -f deploy/docker-compose.yml logs backend` | 瀹氫綅涓?MySQL 鏈墽琛屾渶�?Alembic锛堢己灏?`sku.stock_mode` 瀛楁锛夛紱鍦ㄥ鍣ㄥ唴鎵ц `alembic upgrade head` 淇锛屽苟灏嗚ˉ涓娾€滃悗绔惎鍔ㄨ嚜鍔ㄨ縼绉烩€濋伩鍏嶅�?|
| `test_step14_m06_inbound_inventory.py` 鍦ㄦ潈闄愭敼閫犲悗鍏ㄩ儴杩斿�?403 | 鎵ц `pytest -q backend/tests/test_step14_m06_inbound_inventory.py` 骞舵鏌ユ棩蹇椾腑鐨?`PERMISSION_DENIED` | 琛ラ綈娴嬭瘯绉嶅瓙涓殑 `INVENTORY:READ`銆乣INVENTORY:WRITE` 涓庤鑹叉槧灏勶紱骞跺悓姝ヨˉ�?`test_step17_m08_admin.py` �?`RBAC_ADMIN:UPDATE`銆乣INVENTORY:READ` 鏉冮檺鏄犲皠 |
| `frontend/src/pages/admin-rbac-page.tsx` 鍑虹幇澶ц寖鍥?TS 璇硶閿欒锛堝瓧绗︿覆/鏍囩闂悎寮傚父锛?| 鎵ц `npm --prefix frontend run typecheck` 鍙戠幇鏁板崄鏉¤В鏋愭姤�?| 鐩存帴閲嶅啓椤甸潰缁勪欢涓哄共鍑€瀹炵幇骞朵繚鐣欐棦鏈夎兘鍔涳紝闅忓悗 typecheck �?RBAC 娴嬭瘯鎭㈠閫氳�?|
| PowerShell 鍋ュ悍妫€鏌ュ懡浠や娇鐢?`&&` 鎶ヨ娉曢敊�?| 鎵ц `curl.exe -s ... && echo` 澶辫�?| 鏀逛负 PowerShell 鍏煎鍐欐硶锛堝垎鍒墽琛屽懡浠ゆ垨�?`;`锛夛紝鍋ュ悍妫€鏌ラ€氳�?|

## Archive
- 2026-02-10�?inventory 璧勪骇鏌ヨ琛ㄦ牸鍖?+ CRUD锛堝凡瀹屾垚锛岃�?progress.md�?
























## Active Task (2026-02-12 申请详情缩略图与卡片标签优化)
### Goal
�?`/applications` 点击“查看详情”进入的申请详情页中，将“领用物料清单”的缩略图缩小一半，并删除两张卡片中的“表1/�?”标签文案�?
### Current Phase
Phase D1-Implementation（进行中�?

### 本轮实施清单
- [x] 记录需求与实施方案（planning-with-files�?
- [x] 删除申请详情页“表1/�?”标�?
- [x] 缩略图改为独立小尺寸样式（约缩小一半）
- [ ] 前端类型检�?
- [ ] Docker 刷新与健康检�?
## Active Task (2026-02-12 申请详情缩略图与卡片标签优化 - 收尾)
### Goal
�?`/applications` 申请详情页中，缩小领用物料清单缩略图，并删除“表1/�?”标签�?
### Current Phase
Phase D2-Closed（已完成�?

### 收尾清单
- [x] 记录需求与实施方案（planning-with-files�?
- [x] 删除申请详情页“表1/�?”标�?
- [x] 缩略图改为独立小尺寸样式 `application-detail-cover (96x54)`
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`
- [x] Docker 刷新通过：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`

## Active Task (2026-02-12 分类树审批人字段增强)
### Goal
�?`/materials` 的分类树管理中新增“审批领导设置”“管理员设置”两个可维护字段，并支持从人员名单下拉选择对应用户�?
### Current Phase
Phase M1-Implementation（进行中�?

### 本轮实施清单
- [x] 启用 planning-with-files 并记录目�?决策
- [ ] 后端：分类模型与迁移新增 `leader_approver_user_id`、`admin_reviewer_user_id`
- [ ] 后端：新增管理端分类树查询接口与审批人选项接口
- [ ] 后端：分类创�?更新接口支持两个审批人字�?
- [ ] 前端：`/materials` 分类新增/编辑表单接入两个下拉字段
- [ ] 前端：分类表格新增两列显示审批领�?管理�?
- [ ] 自动化验证：后端 pytest + 前端 typecheck
- [ ] Docker 刷新与健康检�?

### 本轮错误记录
- 只读探索阶段误读测试文件路径：`backend/tests/test_step16_m06_inventory.py` 不存在，正确文件�?`backend/tests/test_step14_m06_inbound_inventory.py`�?
- 只读探索阶段误读服务路径：`backend/app/services/rbac.py` 不存在，RBAC 逻辑位于 `backend/app/core/auth.py` �?`backend/app/api/v1/routers/m08_admin.py`�?

## Active Task (2026-02-12 分类树审批人字段增强)
### Goal
�?`/materials` 的分类树管理中新增“审批领导设置”“管理员设置”两个可维护字段，并支持从人员名单下拉选择对应用户�?
### Current Phase
Phase M2-Closed（已完成�?

### 本轮收尾清单
- [x] 启用 planning-with-files 并记录目�?决策
- [x] 后端：分类模型与迁移新增 `leader_approver_user_id`、`admin_reviewer_user_id`
- [x] 后端：新增管理端分类树查询接口与审批人选项接口
- [x] 后端：分类创�?更新接口支持两个审批人字段与角色校验
- [x] 前端：`/materials` 分类新增/编辑表单接入两个下拉字段
- [x] 前端：分类表格新增两列显示审批领�?管理�?
- [x] 自动化验证：`pytest backend/tests/test_step14_m06_inbound_inventory.py -q`
- [x] 自动化验证：`pytest backend/tests/test_step11_m02_application.py -q`
- [x] 自动化验证：`pytest backend/tests/test_step17_m08_admin.py -q`
- [x] 自动化验证：`npm --prefix frontend run typecheck`
- [x] Docker 刷新：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`
- [x] 健康检查：`/healthz=ok`、`/api/healthz={"status":"ok"}`

### 本轮错误记录
- PowerShell 使用 `&&` 串联命令导致解析失败；改�?`;` 后恢复�?
- 新增用例首次断言错误�?22），按实�?`VALIDATION_ERROR=400` 修正�?

## Active Task (2026-02-12 17:40:29 权限治理深度优化)
### Goal
完善 /admin/rbac：权限目录中文化与可视化、用户角色分配改为账号下�?角色多选下拉，保持现有基础权限粒度�?SUPER_ADMIN 权限边界不变�?
### Current Phase
Phase R1-Implementation（进行中�?
### 本轮实施清单
- [x] 启用 planning-with-files 并记录目�?阶段
- [ ] 后端：权限字典幂等入库与权限目录扩展字段
- [ ] 后端：新�?GET /api/v1/admin/users/{id}/roles
- [ ] 前端：权限目录改表格+中文说明+页面/按钮引用
- [ ] 前端：用户角色分配改为账号下�?角色多�?
- [ ] 验证：pytest + frontend typecheck
- [ ] Docker 刷新与健康检�?

### 本轮错误记录�?026-02-12 17:40:44�?
- 错误：PowerShell �?`progress.md` 追加 here-string 时结束符缺失，触�?`TerminatorExpectedAtEndOfString`�?
- 处理：改为单引号 here-string（`@' ... '@`）并重试，已写入成功�?

## Active Task (2026-02-12 17:47:25 RBAC权限治理可视化优�?
### Goal
完成权限目录中文化与用户角色可视化分配：权限表格展示（含中文说明与页�?按钮引用），用户角色改为账号下拉+角色多选并支持自动预填�?
### Current Phase
Phase P1-Implementation（进行中�?
### 本轮执行清单
- [x] 按仓库规则启�?planning-with-files 并完成现状检�?
- [ ] 完成 admin-rbac 页面状�?交互改�?
- [ ] 完成权限目录与使用明细可视化表格
- [ ] 完成用户角色可视化分配（账号下拉+角色多�?覆盖说明�?
- [ ] 前端 typecheck + 后端 pytest
- [ ] Docker 刷新与健康检�?

### 错误记录 (2026-02-12 17:47:41)
- 错误：PowerShell here-string 结束符缺失（TerminatorExpectedAtEndOfString），导致写入 progress.md 失败�?
- 处理：改用单引号 here-string（@' ... '@）并重新执行写入�?

## 收尾更新 (2026-02-12 17:54:14)
### Current Phase
Phase P2-Closed（已完成�?
### 验收结果
- [x] `frontend/src/pages/admin-rbac-page.tsx` 完成权限目录中文�?+ 用户角色可视化分�?
- [x] `frontend/src/styles/index.css` 完成配套样式（权限使用明细、角色多选）
- [x] `npm --prefix frontend run typecheck` 通过
- [x] `pytest -q backend/tests/test_step17_m08_admin.py` 通过�? passed�?
- [x] Docker 刷新通过：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`

## Active Task (2026-02-12 18:06:07 修复RBAC页面400错误)
### Goal
修复 `admin/rbac` 页面请求返回 400 的问题，恢复权限治理页正常加载�?
### Current Phase
Phase E1-Implementation（进行中�?
### 本轮执行清单
- [x] 定位失败请求根因
- [ ] 修复前端非法分页参数
- [ ] 前端 typecheck 验证
- [ ] Docker 刷新与健康检�?

## 收尾更新 (2026-02-12 18:11:06)
### Current Phase
Phase E2-Closed（已完成�?
### 验收结果
- [x] 修复 `admin-rbac-page.tsx` 请求越界参数：`pageSize 500 -> 100`
- [x] `npm --prefix frontend run typecheck` 通过
- [x] Docker 刷新通过：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`

## Active Task (2026-02-12 18:14:29 修复用户角色可视化多选不可用)
### Goal
修复 `/admin/rbac` 页面“可视化替换用户-角色分配”多选体验问题，改为可直接点击的复选框多选�?
### Current Phase
Phase M1-Implementation（进行中�?
### 本轮执行清单
- [x] 记录需求与根因假设
- [ ] 将角色多选控件从 `select[multiple]` 改为复选框列表
- [ ] 前端 typecheck 验证
- [ ] Docker 刷新与健康检�?

### 错误记录 (2026-02-12 18:20:36)
- 错误：执�?`deploy/scripts/refresh-dev.ps1` 超时（工具超时退出码 124）�?
- 处理：先检查容�?健康状态，再以更长超时时间重试刷新�?

## 收尾更新 (2026-02-12 18:26:42)
### Current Phase
Phase M2-Closed（已完成�?
### 验收结果
- [x] 用户角色多选改为可点击复选框列表，不再依�?Ctrl/Shift
- [x] 前端 `typecheck` 通过
- [x] Docker 刷新成功（第二次重试通过�?
- [x] 健康检查通过：`/healthz=ok`、`/api/healthz={"status":"ok"}`
### 错误处理闭环
- 第一�?Docker 刷新因超时中断（exit 124），已记录并采用延长超时重试，最终刷新成功�?

## Active Task (2026-02-12 申请回退购物�?+ 出库执行可见性修�?
### Goal
1. 在“我的申请”中为领导驳回单提供“回退到购物车”操作，支持修改后重新提交�?
2. 修复“管理员审批通过单在出库执行不可见”的流程可见性问题，避免误判为权限异常�?
### Current Phase
Phase R1-Implementation（进行中�?
### 实施清单
- [x] 使用 planning-with-files 记录本轮目标与发�?
- [ ] 实现“领导驳回单回退到购物车�?
- [ ] 增强出库队列展示 ADMIN_APPROVED（待分配）状态并前端提示
- [ ] 前后端类型检查与相关测试
- [ ] Docker 刷新与健康检�?

## Active Task (2026-02-12 申请回退购物�?+ 出库执行可见性修�?- 收尾)
### Goal
1. 领导驳回申请可回退到购物车并二次提交�?
2. 管理员审批通过但未分配资产的申请在出库执行中可见并有明确提示�?
### Current Phase
Phase R2-Closed（已完成�?
### 收尾清单
- [x] 我的申请页增加“回退到购物车”（�?LEADER_REJECTED�?
- [x] 申请详情补充回填购物车所需 SKU 字段（含 available_stock�?
- [x] 出库队列展示 `READY_OUTBOUND` + `ADMIN_APPROVED`，并返回状态字�?
- [x] 出库执行页展示状态并阻止对未分配资产单据执行出库操作
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`
- [x] 后端测试通过：`pytest backend/tests/test_step12_m03_approval.py backend/tests/test_step13_m04_m05.py`
- [x] Docker 刷新通过：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`
- [x] 健康检查通过：`/healthz=ok`，`/api/healthz={"status":"ok"}`

## Active Task (2026-02-25 出库时自动完成资产分�?
### Goal
在出库确认时（`confirm_pickup`），如果申请单状态为 `ADMIN_APPROVED` 且尚未分配资产，自动从库存中锁定所需资产并创建关联记录，然后继续执行出库流程�?

### Current Phase
Phase A1-Closed（已完成�?

### 本轮实施清单
- [x] 记录需求与实施方案（planning-with-files�?
- [x] 后端：修�?`confirm_pickup` 接口，增加自动资产分配逻辑
- [x] 后端：修�?`ship_express` 接口，增加自动资产分配逻辑
- [x] 回归：pytest 覆盖新场�?
- [x] 前端类型检查：`npm --prefix frontend run typecheck`
- [x] Docker 刷新与健康检�?

## Active Task (2026-02-25 库存页面布局调整)
### Goal
根据用户要求调整 `/inventory` 页面布局�?
1. 删除“后台物�?物料（SKU）查询与管理”卡片（移除未使用代码）�?
2. 将“库存汇总”卡片置顶并全宽显示�?
3. 将“后台资产”卡片放置在“库存汇总”下方�?

### Current Phase
Phase A1-Closed（已完成�?

### 本轮实施清单
- [x] 记录需求与实施方案（planning-with-files�?
- [x] 移除 `inventory-page.tsx` 中未使用�?SKU 管理代码（查�?创建/编辑/删除�?
- [x] 确认“库存汇总”卡片为全宽 (`inbound-wide`) 且位于首�?
- [x] 确认“后台资产”卡片位于下�?
- [x] 替换 `canFetchSkus` �?`canReadInventory` 以修复权限检�?
- [x] 前端类型检查：`npm --prefix frontend run typecheck`

## Active Task (2026-02-24 20:39:45 预占与出库队列口径修�?
### Goal
- 修复序列号资产在自动分配/出库后可能残�?LOCKED 的问题�?- 修复后确�?/inventory 预占值与 /outbound 待出库队列口径一致�?### Current Phase
- Phase R1-Implementation（进行中�?### 本轮实施清单
- [x] 代码定位与根因确认（M05 自动分配重复锁定�?- [x] 修复 _auto_assign_assets 复用已锁资产并重建关�?- [x] 修复出库完成后的残留锁清理兜�?- [ ] 执行后端测试
- [ ] 执行历史脏数据修复并验证
- [ ] Docker 刷新与健康检�?

## Active Task��2026-02-24 Ԥռ�������ھ��޸�-��β��
### Goal
- �޸����к��������Զ�����/�������ܲ��� `LOCKED` ���� `/inventory` Ԥռ��ߵ����⡣
- ȷ�� `/inventory` ��Ԥռ�� `/outbound` �Ĵ�������пھ�һ�¡�

### Current Phase
- Phase R2-Closed������ɣ�

### ��β�嵥
- [x] �޸� `_auto_assign_assets`�����ȸ��õ�ǰ���������ʲ��������ٲ��������������Զ�������
- [x] ���ӳ������������� `_release_remaining_locked_assets`��
- [x] �޸�ͬ���� `stock_flow.id` ��ͻ���Ự�� ID �������棩��
- [x] �޸� `autoflush=False` ����������������ѳ����ʲ�������ǰ��ʽ `db.flush()`����
- [x] ͨ����˻ع飺`pytest -q backend/tests/test_step13_m04_m05.py`��3 passed����
- [x] ִ����ʷ��������������̬�����������������ͨ����
- [ ] Docker ˢ���뽡����飨������βִ�У���

### ���̴����¼
- ����1�����������߼�����Ա� `UNIQUE constraint failed: stock_flow.id`��
- ����ͬһ�����ε��á�ȡ max(id)+1����δ����δ flush �Ĵ�д���¼��
- �����`_next_bigint_id` ��Ϊ�Ự������������
- ����2���������ѳ����ʲ����������Ϊ `IN_STOCK`��
- ���򣺻Ự `autoflush=False`��������ѯ������״̬��
- �����`_release_remaining_locked_assets` ��ѯǰǿ�� `db.flush()`��
### ��β����
- [x] Docker ˢ�£�`deploy/scripts/refresh-dev.ps1` ͨ����
- [x] ������飺`/healthz=ok`��`/api/healthz={"status":"ok"}`��
- [x] ��ǰ�׶θ���Ϊ Closed��

## Active Task��2026-02-24 ���������롰���˵����ﳵ���������޸���
### Goal
- �޸� `/applications` ҳ���������˵����ﳵ���� `/store/cart` Ϊ�յ����⡣
- ��֤���˶�����ҳ����תǰ��ɳ־û������ﳵ���ȶ���ȡ��

### Current Phase
- Phase R1-Implementation�������У�

### ����ʵʩ�嵥
- [x] ��λ������·���������� -> ���ﳵд�� -> ·����ת����
- [ ] �޸����ﳵд��ʱ�����⣨ͬ���־û�����
- [ ] ���ӻ���ǰ�û�����У�飨����д�� anonymous ��Ͱ����
- [ ] ǰ�����ͼ�顣
- [ ] Docker ˢ���뽡����顣

### ���ȸ��£�R1 -> R2��
- [x] �޸����ﳵд��ʱ�����⣨ͬ���־û�����
- [x] ���ӻ���ǰ�û�����У�飨����д�� anonymous ��Ͱ����
- [x] ǰ�����ͼ��ͨ����
- [ ] Docker ˢ���뽡����顣

### ��β����
- [x] �޸����ﳵд��ʱ�����⣨ͬ���־û�����
- [x] ���ӻ���ǰ�û�����У�飨����д�� anonymous ��Ͱ����
- [x] ǰ�����ͼ�飺`npm --prefix frontend run typecheck` ͨ����
- [x] Docker ˢ�£�`deploy/scripts/refresh-dev.ps1` ͨ����
- [x] ������飺`/healthz=ok`��`/api/healthz={"status":"ok"}`��

### Current Phase
- Phase R2-Closed������ɣ�

## Active Task��2026-02-24 applications/inventory �������������ơ��ֶΣ�
### Goal
- �� `/applications` ���������ϸչʾ�������ֶΡ��������ơ���
- �� `/inventory` ��Ӧ�б����������������ơ��У���֤չʾһ�¡�

### Current Phase
- Phase R1-Implementation�������У�

### ����ʵʩ�嵥
- [x] ��¼������Ŀ�꣨planning-with-files����
- [ ] ��λ applications �� inventory �б��ֶ���Դ��
- [ ] ���ǰ����ֶβ�����ҳ������Ⱦ��
- [ ] ���ͼ����ع���֤��
- [ ] Docker ˢ���뽡����顣

### ��β����
- [x] applications �б����ӡ��������ơ�չʾ��
- [x] inventory �����ܱ����ӡ��������ơ��С�
- [x] inventory ��̨�ʲ������ӡ��������ơ��С�
- [x] ǰ�����ͼ��ͨ����
- [x] Docker ˢ���뽡�����ͨ����

### Current Phase
- Phase R2-Closed������ɣ�

## Active Task��2026-02-24 materials ����ά���������������ơ��ֶΣ�
### Goal
- �� `/materials` ������ά����Ƭ�в��롰�������ơ��ֶ�չʾ��

### Current Phase
- Phase R1-Implementation�������У�

### ����ʵʩ�嵥
- [x] planning-with-files �ĵ����¡�
- [ ] �޸� materials ҳ�棨�б��� + ά�������ֶΣ���
- [ ] ǰ�����ͼ�顣
- [ ] Docker ˢ���뽡����顣

## Active Task��2026-02-24 22:36 materials ����ά�������������ƣ�
### Goal
- �� /materials ������ά����Ƭ���롰�������ơ��ֶΣ������б�/�½�/�༭һ��չʾ��

### Current Phase
- Phase R2-Closed������ɣ�

### ��β����
- [x] ����ά���б��������������ơ��У���Ʒ��+�ͺ���ϣ���
- [x] �½����ϱ�������ֻ�����������ơ��ֶΡ�
- [x] �༭���ϱ�������ֻ�����������ơ��ֶΡ�
- [x] npm --prefix frontend run typecheck ͨ����
- [x] powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1 ͨ����
- [x] /healthz=ok��/api/healthz={"status":"ok"}��

## ��¼������2026-02-24 22:39��
- ��һ���Ự��¼�е�������·����ʾ����ת���ַ�������Ϊ��ȷֵ��
- �ļ���frontend/src/pages/materials-page.tsx
- ���npm --prefix frontend run typecheck
- ���powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1



## Active Task��2026-02-24 22:44 materials �������Ƹ�Ϊ�ɱ༭�ֶΣ�
### Goal
- �� /materials �ġ��������ơ���Ʒ��+�ͺ�ƴ�Ӹ�Ϊ�����ɱ�д���־û���
- �����б����½����༭�����ҳ��չʾͳһʹ����ʵ 
ame �ֶΡ�

### Current Phase
- Phase R1-Implementation�������У�

### ����ʵʩ�嵥
- [x] ��¼��������ߣ�planning-with-files����
- [ ] ��� SKU ģ���� schema ���� 
ame �ֶΡ�
- [ ] �������ݿ�Ǩ�Ʋ�������ʷ���ݡ�
- [ ] ǰ�� materials ������Ϊ�ɱ༭���Ʋ����ýӿڳ־û���
- [ ] inventory/applications չʾ��Ϊ����ʹ�� 
ame��
- [ ] ���ͼ��/��˲��ԡ�
- [ ] Docker ˢ���뽡����顣

## Active Task（2026-02-24 23:10 物料名称可编辑收尾修复）
### Goal
- 修复 `frontend/src/pages/materials-page.tsx` 的语法损坏，恢复可编译状态。
- 完成“物料名称可自由编写并持久化”的前后端链路收尾验证。

### Current Phase
- Phase R1-Implementation（进行中）

### 本轮实施清单
- [x] 更新 planning-with-files 三文档。
- [ ] 修复 materials-page 语法错误并通过 typecheck。
- [ ] 运行后端相关测试并确认 `name` 字段链路正常。
- [ ] Docker 刷新与健康检查。

### 收尾验收（2026-02-24 23:18）
- [x] 修复 `frontend/src/pages/materials-page.tsx` 语法损坏并恢复编译。
- [x] 前端类型检查：`npm --prefix frontend run typecheck` 通过。
- [x] 后端回归：`pytest -q backend/tests/test_step14_m06_inbound_inventory.py backend/tests/test_step11_m02_application.py backend/tests/test_step12_m03_approval.py backend/tests/test_step17_m08_admin.py` 通过（20 passed）。
- [x] 编译检查：`python -m compileall -q backend/app backend/alembic` 通过。
- [x] Docker 刷新：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1` 通过。
- [x] 健康检查：`/healthz=ok`、`/api/healthz={"status":"ok"}`。

### Current Phase
- Phase R2-Closed（已完成）
### 本轮错误记录（2026-02-24 23:22）
- 错误：在 PowerShell 中使用 `&&` 连接命令执行健康检查，触发 `The token '&&' is not a valid statement separator`。
- 处理：改为分两条独立命令执行 `curl.exe -s /healthz` 与 `curl.exe -s /api/healthz`，检查通过。
- 错误：使用 `rg` 复杂正则在 PowerShell 下出现转义解析失败（`regex parse error`）。
- 处理：改用分段 `Get-Content` 定位行号与简单固定字符串查询完成核对。

## Active Task（2026-02-24 23:45 出库执行页面信息脱敏与展示优化）
### Goal
- `/outbound` 待自提列表不展示取件码，仅申请人自己掌握。
- 删除“待分配资产...”说明（自提/快递队列）。
- 删除待自提列表中“使用申请单编号/使用取件码”两个按钮。
- 队列显示从“申请人ID/物料ID”改为“申请人姓名/物料名称”（自提+快递）。
- 右侧“确认自提”卡片核验类型默认值改为“取件码”。

### Current Phase
- Phase O1-Implementation（进行中）

### 本轮实施清单
- [x] planning-with-files 三文档记录需求与决策。
- [ ] 后端队列接口补充申请人姓名与物料名称，移除 pickup_code 下发。
- [ ] 前端 Outbound 页面按新字段渲染并删除无效说明/按钮。
- [ ] 前端默认核验类型改为 CODE。
- [ ] typecheck + 后端 m05 回归 + Docker 刷新健康检查。

### 收尾验收（2026-02-24 23:56）
- [x] 后端 `/outbound/pickup-queue` 与 `/outbound/express-queue` 返回申请人姓名与物料名称。
- [x] `/outbound/pickup-queue` 不再返回 `pickup_code` 字段用于列表展示。
- [x] 前端自提/快递队列展示改为“申请人姓名 + 物料名称”。
- [x] 删除“待分配资产...”说明（自提/快递队列）。
- [x] 删除待自提列表“使用申请单编号/使用取件码”按钮。
- [x] “确认自提”核验类型默认值改为取件码（`CODE`）。
- [x] `npm --prefix frontend run typecheck` 通过。
- [x] `pytest -q backend/tests/test_step13_m04_m05.py` 通过（3 passed）。
- [x] `python -m compileall -q backend/app` 通过。
- [x] Docker 刷新与健康检查通过。

### Current Phase
- Phase O2-Closed（已完成）

## Active Task（2026-02-24 applications/materials 页面乱码修复）
### Goal
- 修复 `/applications` 与 `/materials` 页面所有中文乱码，恢复正常中文显示。
- 保留现有业务能力（被驳回回退购物车、物料名称可编辑等），仅修复文案编码损坏。

### Current Phase
- Phase F1-Implementation（进行中）

### 本轮实施清单
- [x] 记录需求与决策（planning-with-files）。
- [ ] 修复 `frontend/src/pages/applications-page.tsx` 中文文案。
- [ ] 修复 `frontend/src/pages/materials-page.tsx` 中文文案。
- [ ] 前端类型检查（`npm --prefix frontend run typecheck`）。
- [ ] Docker 刷新与健康检查。

## 收尾更新（2026-02-24 applications/materials 页面乱码修复）
### Current Phase
- Phase F2-Closed（已完成）

### 收尾验收
- [x] `frontend/src/pages/applications-page.tsx` 完成中文文案恢复，并保留“回退到购物车 + 物料名称展示”逻辑。
- [x] `frontend/src/pages/materials-page.tsx` 完成中文文案恢复，并保留“物料名称可编辑（name）”与 `isVisible` 更新链路。
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`。
- [x] Docker 刷新通过：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`。
- [x] 健康检查通过：`/healthz=ok`，`/api/healthz={"status":"ok"}`。

## Active Task（2026-02-24 恢复物料商城可见性开关入口）
### Goal
- 恢复“物料在商城中可见/不可见”的可视化操作入口。
- 保持既有后端过滤逻辑不变，仅补齐前端管理入口。

### Current Phase
- Phase V1-Implementation（进行中）

### 本轮实施清单
- [x] 记录需求与根因（planning-with-files）。
- [ ] 在 `/materials` 物料表增加“商城可见”列。
- [ ] 在操作列增加“设为隐藏/设为可见”按钮。
- [ ] 前端 typecheck。
- [ ] Docker 刷新与健康检查。

## 收尾更新（2026-02-24 恢复物料商城可见性开关入口）
### Current Phase
- Phase V2-Closed（已完成）

### 收尾验收
- [x] `/materials` 物料表新增“商城可见”列。
- [x] 操作列新增“设为隐藏/设为可见”按钮，支持一键切换。
- [x] 切换调用现有 `updateAdminSku`，不改后端协议。
- [x] 前端 typecheck：`npm --prefix frontend run typecheck` 通过。
- [x] Docker 刷新：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1` 通过。
- [x] 健康检查：`/healthz=ok`，`/api/healthz={"status":"ok"}`。

## Active Task（2026-02-24 materials 新增物料按钮上移）
### Goal
- 将 `/materials` 页“新增物料”入口上移到“物料维护”卡片上方，并提升显眼程度。

### Current Phase
- Phase R1-Implementation（进行中）

### 本轮实施清单
- [x] planning-with-files 三文档更新。
- [ ] 页面结构调整：卡片顶部增加“新增物料”主按钮。
- [ ] 保留新增物料表单能力并支持展开/收起。
- [ ] 前端 typecheck。
- [ ] Docker 刷新与健康检查。

## 收尾更新（2026-02-24 materials 新增物料按钮上移）
### Current Phase
- Phase R2-Closed（已完成）

### 收尾验收
- [x] “新增物料”主按钮已上移至“物料维护”卡片头部，位置更显眼。
- [x] 新增物料表单改为顶部可展开/收起，保留原有创建字段与提交流程。
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`。
- [x] Docker 刷新通过：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`。
- [x] 健康检查通过：`/healthz=ok`，`/api/healthz={"status":"ok"}`。

## Active Task（2026-02-24 公告栏管理导航与功能完善）
### Goal
- 在左侧导航新增“公告栏管理”菜单。
- 新增独立公告栏管理页面，提供可视化公告 CRUD、发布/下线、分页查询与预览能力。

### Current Phase
- Phase A1-Implementation（进行中）

### 本轮实施清单
- [x] 记录需求与方案（planning-with-files）。
- [ ] 新增公告管理页面组件与 API 交互。
- [ ] 路由/导航新增“公告栏管理”并配置图标。
- [ ] 补齐权限映射（route/action + 默认 UI guard）。
- [ ] 前端 typecheck。
- [ ] Docker 刷新与健康检查。

## 收尾更新（2026-02-24 公告栏管理导航与功能完善）
### Current Phase
- Phase A2-Closed（已完成）

### 收尾验收
- [x] 新增独立页面：`/announcements/manage`（公告栏管理）。
- [x] 左侧导航新增“公告栏管理”菜单，并配置图标。
- [x] 公告管理实现：关键字查询、状态筛选、分页、创建、编辑、删除、发布、下线、内容预览。
- [x] 权限映射补齐：route `/announcements/manage` 与 action `announcements.manage`。
- [x] 前端检查通过：`npm --prefix frontend run typecheck`。
- [x] 后端回归通过：`pytest -q backend/tests/test_step17_m08_admin.py`。
- [x] Docker 刷新通过：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`。
- [x] 健康检查通过：`/healthz=ok`，`/api/healthz={"status":"ok"}`。

## Active Task（2026-02-24 materials 卡片满宽重排）
### Goal
- `/materials` 页面将“物料维护”卡片放到“分类维护”卡片下方。
- 页面卡片改为横向满宽铺放（每张卡片占整行）。

### Current Phase
- Phase L1-Implementation（进行中）

### 本轮实施清单
- [x] planning-with-files 三文档更新。
- [ ] 调整 materials 页面卡片布局为满宽单列。
- [ ] 前端 typecheck。
- [ ] Docker 刷新与健康检查。

## 收尾更新（2026-02-24 materials 卡片满宽重排）
### Current Phase
- Phase L2-Closed（已完成）

### 收尾验收
- [x] `/materials` 分类维护与物料维护卡片均改为满宽展示。
- [x] 物料维护卡片在分类维护卡片下方显示。
- [x] 前端类型检查通过：`npm --prefix frontend run typecheck`。
- [x] Docker 刷新通过：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`。
- [x] 健康检查通过：`/healthz=ok`，`/api/healthz={"status":"ok"}`。

## Active Task (2026-02-28 仪表盘 API 502 修复)
### Goal
- 修复 `http://localhost:18080` 下多个 API 请求 `502` 问题，恢复 `/api/v1/me/assets`、`/api/v1/announcements`、`/api/v1/dashboard/hero` 可用。

### Current Phase
- Phase S1-Implementation（进行中）

### 本轮实施清单
- [x] planning-with-files 三文档预更新
- [ ] 定位并修复 backend 启动失败根因
- [ ] 语法校验与容器刷新
- [ ] 健康检查与接口验证

### Errors Encountered
- 错误：`backend-1` 启动报 `SyntaxError: unmatched ')'`（`backend/app/api/v1/routers/m07_reports.py`）。
- 处置：删除多余右括号并重建容器验证。

## 收尾更新（2026-02-28 仪表盘 API 502 修复）
### Current Phase
- Phase S2-Closed（已完成）

### 收尾验收
- [x] 已修复 `backend/app/api/v1/routers/m07_reports.py` 的语法错误并恢复 backend 正常启动。
- [x] 已执行 Docker 刷新：`powershell -ExecutionPolicy Bypass -File deploy/scripts/refresh-dev.ps1`。
- [x] 健康检查通过：`GET /healthz -> ok`，`GET /api/healthz -> {"status":"ok"}`。
- [x] 目标接口不再返回 `502`：
  - `GET /api/v1/me/assets -> 401`（未登录）
  - `GET /api/v1/announcements?page=1&page_size=5 -> 401`（未登录）
  - `GET /api/v1/dashboard/hero -> 401`（未登录）
