CREATE TABLE `sys_department` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '部门ID',
  `parent_id` bigint DEFAULT 0 COMMENT '父部门ID',
  `dept_name` varchar(100) NOT NULL COMMENT '部门名称',
  `sort` int DEFAULT 0 COMMENT '排序',
  `status` tinyint DEFAULT 1 COMMENT '1启用 0禁用',
  `is_deleted` tinyint DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门';

CREATE TABLE `sys_employee` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '员工ID',
  `dept_id` bigint DEFAULT NULL COMMENT '所属部门',
  `username` varchar(50) NOT NULL COMMENT '登录账号',
  `password` varchar(100) NOT NULL COMMENT '密码加密',
  `real_name` varchar(50) NOT NULL COMMENT '真实姓名',
  `phone` varchar(20) DEFAULT NULL COMMENT '手机号',
  `avatar` varchar(255) DEFAULT NULL COMMENT '头像',
  `status` tinyint DEFAULT 1 COMMENT '1在职 0离职',
  `is_admin` tinyint DEFAULT 0 COMMENT '是否管理员',
  `is_deleted` tinyint DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_username` (`username`),
  KEY `idx_dept` (`dept_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='员工信息';

CREATE TABLE `attendance_rule` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `rule_name` varchar(100) NOT NULL COMMENT '规则名称',
  `start_time` time NOT NULL COMMENT '上班时间 09:00:00',
  `end_time` time NOT NULL COMMENT '下班时间 18:00:00',
  `late_minute` int DEFAULT 15 COMMENT '迟到阈值(分钟)',
  `early_minute` int DEFAULT 15 COMMENT '早退阈值(分钟)',
  `allow_outside_sign` tinyint DEFAULT 0 COMMENT '是否允许外勤打卡',
  `status` tinyint DEFAULT 1,
  `is_deleted` tinyint DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='考勤规则';

CREATE TABLE `attendance_schedule` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `employee_id` bigint NOT NULL COMMENT '员工ID',
  `rule_id` bigint NOT NULL COMMENT '关联考勤规则',
  `schedule_date` date NOT NULL COMMENT '排班日期',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `is_deleted` tinyint DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_emp_date` (`employee_id`,`schedule_date`),
  KEY `idx_rule` (`rule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='员工排班';

CREATE TABLE `attendance_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '打卡记录ID',
  `employee_id` bigint NOT NULL COMMENT '员工id',
  `schedule_id` bigint DEFAULT NULL COMMENT '排班id',
  `rule_id` bigint DEFAULT NULL COMMENT '考勤规则',
  `sign_type` tinyint NOT NULL COMMENT '1签到 2签退',
  `sign_time` datetime NOT NULL COMMENT '实际打卡时间',
  `address` varchar(255) DEFAULT NULL COMMENT '打卡地址',
  `longitude` varchar(32) DEFAULT NULL,
  `latitude` varchar(32) DEFAULT NULL,
  `device` varchar(100) DEFAULT NULL COMMENT '设备信息',
  `sign_source` tinyint DEFAULT 1 COMMENT '1后台手动录入 2H5移动端 3人脸设备',
  `status` tinyint NOT NULL COMMENT '0正常 1迟到 2早退 3缺卡 4外勤打卡',
  `remark` varchar(500) DEFAULT NULL,
  `is_deleted` tinyint DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_emp` (`employee_id`),
  KEY `idx_sign_time` (`sign_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打卡记录表';

CREATE TABLE `attendance_exception` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `employee_id` bigint NOT NULL,
  `record_id` bigint DEFAULT NULL COMMENT '关联打卡记录',
  `exception_type` tinyint NOT NULL COMMENT '1缺卡申诉 2迟到申诉 3早退申诉',
  `apply_date` date NOT NULL COMMENT '申诉日期',
  `reason` varchar(500) NOT NULL COMMENT '申诉理由',
  `attach` varchar(500) DEFAULT NULL COMMENT '附件地址',
  `audit_status` tinyint DEFAULT 0 COMMENT '0待审核 1通过 2驳回',
  `audit_user_id` bigint DEFAULT NULL COMMENT '审核人',
  `audit_time` datetime DEFAULT NULL,
  `audit_comment` varchar(500) DEFAULT NULL,
  `is_deleted` tinyint DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_emp` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='考勤异常申诉';

CREATE TABLE `sys_task` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `task_type` varchar(50) NOT NULL COMMENT 'export_attendance / import_attendance',
  `employee_id` bigint NOT NULL COMMENT '发起人',
  `params` text DEFAULT NULL COMMENT '任务参数JSON',
  `status` tinyint DEFAULT 0 COMMENT '0处理中 1成功 2失败',
  `file_url` varchar(255) DEFAULT NULL COMMENT '生成文件地址',
  `progress` int DEFAULT 0 COMMENT '进度0-100',
  `msg` varchar(500) DEFAULT NULL,
  `is_deleted` tinyint DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_emp` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台异步任务';

INSERT INTO `sys_department` (`id`, `parent_id`, `dept_name`, `sort`, `status`, `created_at`) VALUES
(1, 0, '技术部', 1, 1, NOW()),
(2, 0, '人事部', 2, 1, NOW()),
(3, 0, '财务部', 3, 1, NOW()),
(4, 0, '市场部', 4, 1, NOW()),
(5, 0, '运营部', 5, 1, NOW());

INSERT INTO `sys_employee` (`id`, `dept_id`, `username`, `password`, `real_name`, `phone`, `status`, `is_admin`, `created_at`) VALUES
(1, 1, 'admin', '$2a$10$4FH8CJFQuuEW.G3XZr4tIOdSnTImjLb8E.d2z4zmqN.5u2dOrKKvy', '管理员', '13800138000', 1, 1, NOW()),
(2, 1, 'zhangsan', '$2a$10$4FH8CJFQuuEW.G3XZr4tIOdSnTImjLb8E.d2z4zmqN.5u2dOrKKvy', '张三', '13800138001', 1, 0, NOW()),
(3, 1, 'lisi', '$2a$10$4FH8CJFQuuEW.G3XZr4tIOdSnTImjLb8E.d2z4zmqN.5u2dOrKKvy', '李四', '13800138002', 1, 0, NOW()),
(4, 2, 'wangwu', '$2a$10$4FH8CJFQuuEW.G3XZr4tIOdSnTImjLb8E.d2z4zmqN.5u2dOrKKvy', '王五', '13800138003', 1, 0, NOW()),
(5, 3, 'zhaoliu', '$2a$10$4FH8CJFQuuEW.G3XZr4tIOdSnTImjLb8E.d2z4zmqN.5u2dOrKKvy', '赵六', '13800138004', 1, 0, NOW());

INSERT INTO `attendance_rule` (`id`, `rule_name`, `start_time`, `end_time`, `late_minute`, `early_minute`, `allow_outside_sign`, `status`, `created_at`) VALUES
(1, '标准工时', '09:00:00', '18:00:00', 15, 15, 0, 1, NOW()),
(2, '弹性工时', '10:00:00', '19:00:00', 30, 30, 1, 1, NOW()),
(3, '早班', '07:00:00', '15:00:00', 10, 10, 0, 1, NOW()),
(4, '晚班', '15:00:00', '23:00:00', 10, 10, 0, 1, NOW());