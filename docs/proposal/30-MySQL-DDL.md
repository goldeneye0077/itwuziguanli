# IT物资全生命周期管理系统｜MySQL 表结构 DDL（草案）

默认引擎 InnoDB、字符集 utf8mb4。主键统一 BIGINT 自增；时间字段使用 UTC 或统一时区策略。

## 0. 数据库与通用约定

```sql
CREATE DATABASE IF NOT EXISTS it_assets
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;
```

## 1. 用户与组织

### 1.1 sys_user

```sql
CREATE TABLE sys_user (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_no VARCHAR(32) NOT NULL,
  name VARCHAR(64) NOT NULL,
  department_id BIGINT NOT NULL,
  email VARCHAR(128) NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_sys_user_employee_no (employee_no),
  KEY idx_sys_user_department (department_id)
) ENGINE=InnoDB;
```

> 角色与权限以 RBAC 关系表（`rbac_user_role` / `rbac_role_permission`）为唯一权威来源，不在 `sys_user` 冗余 `roles_json`。

## 2. 物资档案与分类

### 2.1 category

```sql
CREATE TABLE category (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL,
  parent_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_category_parent (parent_id),
  CONSTRAINT fk_category_parent
    FOREIGN KEY (parent_id) REFERENCES category(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;
```

### 2.2 sku

```sql
CREATE TABLE sku (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  category_id BIGINT NOT NULL,
  brand VARCHAR(64) NOT NULL,
  model VARCHAR(128) NOT NULL,
  spec VARCHAR(255) NOT NULL,
  reference_price DECIMAL(12,2) NOT NULL,
  cover_url VARCHAR(512) NULL,
  safety_stock_threshold INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_sku_category (category_id),
  KEY idx_sku_brand_model (brand, model),
  CONSTRAINT fk_sku_category
    FOREIGN KEY (category_id) REFERENCES category(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;
```

## 3. 实物资产与库存流水

### 3.1 asset

```sql
CREATE TABLE asset (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  asset_tag VARCHAR(64) NOT NULL,
  sku_id BIGINT NOT NULL,
  sn VARCHAR(128) NOT NULL,
  status ENUM('IN_STOCK','LOCKED','IN_USE','PENDING_INSPECTION','BORROWED','REPAIRING','SCRAPPED') NOT NULL,
  holder_user_id BIGINT NULL,
  locked_application_id BIGINT NULL,
  inbound_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_asset_asset_tag (asset_tag),
  UNIQUE KEY uk_asset_sn (sn),
  KEY idx_asset_sku_status (sku_id, status),
  KEY idx_asset_holder (holder_user_id),
  KEY idx_asset_locked_app (locked_application_id),
  CONSTRAINT fk_asset_sku
    FOREIGN KEY (sku_id) REFERENCES sku(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_asset_holder
    FOREIGN KEY (holder_user_id) REFERENCES sys_user(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;
```

### 3.2 stock_flow

```sql
CREATE TABLE stock_flow (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  asset_id BIGINT NOT NULL,
  action ENUM('INBOUND','LOCK','UNLOCK','OUTBOUND','SHIP','RECEIVE','REPAIR_START','REPAIR_FINISH','SCRAP','CANCEL') NOT NULL,
  operator_user_id BIGINT NOT NULL,
  related_application_id BIGINT NULL,
  occurred_at DATETIME(3) NOT NULL,
  meta_json JSON NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_stock_flow_asset_time (asset_id, occurred_at),
  KEY idx_stock_flow_app_time (related_application_id, occurred_at),
  CONSTRAINT fk_stock_flow_asset
    FOREIGN KEY (asset_id) REFERENCES asset(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_stock_flow_operator
    FOREIGN KEY (operator_user_id) REFERENCES sys_user(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;
```

## 4. 申请单、明细、审批与物流

### 4.1 application

```sql
CREATE TABLE application (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  applicant_user_id BIGINT NOT NULL,
  type ENUM('APPLY','RETURN','REPAIR') NOT NULL,
  status ENUM(
    'SUBMITTED','LOCKED','LEADER_APPROVED','LEADER_REJECTED',
    'ADMIN_APPROVED','ADMIN_REJECTED','READY_OUTBOUND',
    'OUTBOUNDED','SHIPPED','DONE','CANCELLED'
  ) NOT NULL,
  delivery_type ENUM('PICKUP','EXPRESS') NOT NULL,
  pickup_code CHAR(6) NOT NULL,
  pickup_qr_string VARCHAR(512) NULL,
  leader_approver_user_id BIGINT NULL,
  admin_reviewer_user_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_application_applicant_time (applicant_user_id, created_at),
  KEY idx_application_status (status),
  KEY idx_application_delivery_type (delivery_type),
  UNIQUE KEY uk_application_pickup_code (pickup_code),
  CONSTRAINT fk_application_applicant
    FOREIGN KEY (applicant_user_id) REFERENCES sys_user(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;
```

### 4.2 application_item

```sql
CREATE TABLE application_item (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  application_id BIGINT NOT NULL,
  sku_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_app_item_app (application_id),
  KEY idx_app_item_sku (sku_id),
  CONSTRAINT fk_app_item_app
    FOREIGN KEY (application_id) REFERENCES application(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_app_item_sku
    FOREIGN KEY (sku_id) REFERENCES sku(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;
```

### 4.3 application_asset（申请单与具体资产分配）

```sql
CREATE TABLE application_asset (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  application_id BIGINT NOT NULL,
  asset_id BIGINT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_app_asset (application_id, asset_id),
  KEY idx_app_asset_asset (asset_id),
  CONSTRAINT fk_app_asset_app
    FOREIGN KEY (application_id) REFERENCES application(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_app_asset_asset
    FOREIGN KEY (asset_id) REFERENCES asset(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;
```

### 4.4 approval_history

```sql
CREATE TABLE approval_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  application_id BIGINT NOT NULL,
  node ENUM('LEADER','ADMIN') NOT NULL,
  action ENUM('APPROVE','REJECT') NOT NULL,
  actor_user_id BIGINT NOT NULL,
  comment VARCHAR(500) NULL,
  ai_recommendation_json JSON NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_approval_app_time (application_id, created_at),
  CONSTRAINT fk_approval_app
    FOREIGN KEY (application_id) REFERENCES application(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_approval_actor
    FOREIGN KEY (actor_user_id) REFERENCES sys_user(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;
```

### 4.5 logistics（快递信息）

```sql
CREATE TABLE logistics (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  application_id BIGINT NOT NULL,
  receiver_name VARCHAR(64) NOT NULL,
  receiver_phone VARCHAR(32) NOT NULL,
  province VARCHAR(64) NOT NULL,
  city VARCHAR(64) NOT NULL,
  district VARCHAR(64) NOT NULL,
  detail VARCHAR(255) NOT NULL,
  carrier VARCHAR(64) NOT NULL,
  tracking_no VARCHAR(64) NOT NULL,
  shipped_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_logistics_app (application_id),
  KEY idx_logistics_tracking (tracking_no),
  CONSTRAINT fk_logistics_app
    FOREIGN KEY (application_id) REFERENCES application(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
```

## 5. 组织架构补充

### 5.1 department（部门表）

```sql
CREATE TABLE department (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL,
  parent_id BIGINT NULL,
  manager_user_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_department_name (name),
  KEY idx_department_parent (parent_id),
  CONSTRAINT fk_department_parent
    FOREIGN KEY (parent_id) REFERENCES department(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_department_manager
    FOREIGN KEY (manager_user_id) REFERENCES sys_user(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;
```

## 6. 智慧门户与公告

### 6.1 announcement（公告表）

```sql
CREATE TABLE announcement (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(128) NOT NULL,
  content TEXT NOT NULL,
  author_user_id BIGINT NOT NULL,
  status ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_announcement_status_time (status, published_at),
  CONSTRAINT fk_announcement_author
    FOREIGN KEY (author_user_id) REFERENCES sys_user(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;
```

### 6.2 hero_banner（Hero 横幅配置）

```sql
CREATE TABLE hero_banner (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(128) NOT NULL,
  subtitle VARCHAR(255) NULL,
  image_url VARCHAR(512) NULL,
  link_url VARCHAR(512) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_hero_active_order (is_active, display_order)
) ENGINE=InnoDB;
```

## 7. RBAC 权限体系

### 7.1 rbac_role（角色表）

```sql
CREATE TABLE rbac_role (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_key VARCHAR(64) NOT NULL,
  role_name VARCHAR(128) NOT NULL,
  description VARCHAR(500) NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_rbac_role_key (role_key)
) ENGINE=InnoDB;
```

### 7.2 rbac_permission（权限点表）

```sql
CREATE TABLE rbac_permission (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  resource VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  description VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_rbac_permission (resource, action)
) ENGINE=InnoDB;
```

### 7.3 rbac_role_permission（角色权限绑定）

```sql
CREATE TABLE rbac_role_permission (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_id BIGINT NOT NULL,
  permission_id BIGINT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_rbac_role_perm (role_id, permission_id),
  KEY idx_rbac_role_perm_perm (permission_id),
  CONSTRAINT fk_rbac_role_perm_role
    FOREIGN KEY (role_id) REFERENCES rbac_role(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_rbac_role_perm_perm
    FOREIGN KEY (permission_id) REFERENCES rbac_permission(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
```

### 7.4 rbac_user_role（用户角色绑定）

```sql
CREATE TABLE rbac_user_role (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_rbac_user_role (user_id, role_id),
  KEY idx_rbac_user_role_role (role_id),
  CONSTRAINT fk_rbac_user_role_user
    FOREIGN KEY (user_id) REFERENCES sys_user(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_rbac_user_role_role
    FOREIGN KEY (role_id) REFERENCES rbac_role(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
```

## 8. OCR 智能入库

### 8.1 ocr_inbound_job（OCR 入库任务）

```sql
CREATE TABLE ocr_inbound_job (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  operator_user_id BIGINT NOT NULL,
  source_file_url VARCHAR(512) NOT NULL,
  doc_type ENUM('INVOICE','DELIVERY_NOTE','OTHER') NULL,
  status ENUM('PENDING','PROCESSING','READY_FOR_REVIEW','CONFIRMED','FAILED') NOT NULL,
  extracted_json JSON NULL,
  error_message VARCHAR(1000) NULL,
  confirmed_sku_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_ocr_job_operator_time (operator_user_id, created_at),
  KEY idx_ocr_job_status (status),
  CONSTRAINT fk_ocr_job_operator
    FOREIGN KEY (operator_user_id) REFERENCES sys_user(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_ocr_job_sku
    FOREIGN KEY (confirmed_sku_id) REFERENCES sku(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;
```

## 9. 安全与审计

### 9.1 token_blacklist（Token 黑名单）

```sql
CREATE TABLE token_blacklist (
  jti VARCHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  revoked_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  reason ENUM('LOGOUT','PASSWORD_CHANGED','ADMIN_FORCED') NOT NULL,
  created_at DATETIME(3) NOT NULL,
  KEY idx_token_blacklist_expires (expires_at),
  KEY idx_token_blacklist_user (user_id)
) ENGINE=InnoDB;
```

### 9.2 audit_log（审计日志）

```sql
CREATE TABLE audit_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NULL,
  action VARCHAR(64) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(128) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  request_id VARCHAR(64) NULL,
  occurred_at DATETIME(3) NOT NULL,
  meta_json JSON NULL,
  created_at DATETIME(3) NOT NULL,
  KEY idx_audit_log_user_time (user_id, occurred_at),
  KEY idx_audit_log_action_time (action, occurred_at),
  KEY idx_audit_log_resource (resource_type, resource_id)
) ENGINE=InnoDB;
```

## 10. 地址与通知（可选，但建议用于说明书功能）

### 10.1 user_address

```sql
CREATE TABLE user_address (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  receiver_name VARCHAR(64) NOT NULL,
  receiver_phone VARCHAR(32) NOT NULL,
  province VARCHAR(64) NOT NULL,
  city VARCHAR(64) NOT NULL,
  district VARCHAR(64) NOT NULL,
  detail VARCHAR(255) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_user_address_user (user_id),
  CONSTRAINT fk_user_address_user
    FOREIGN KEY (user_id) REFERENCES sys_user(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;
```

### 10.2 notification_outbox

```sql
CREATE TABLE notification_outbox (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  channel ENUM('EMAIL','DINGTALK') NOT NULL,
  receiver VARCHAR(128) NOT NULL,
  template_key VARCHAR(64) NOT NULL,
  payload_json JSON NOT NULL,
  status ENUM('PENDING','SENT','FAILED') NOT NULL,
  retry_count INT NOT NULL DEFAULT 0,
  last_error VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_notification_status_time (status, created_at)
) ENGINE=InnoDB;
```
