-- ============================================================
-- Digifyce Platform — MySQL Schema
-- Paste this entire file into phpMyAdmin > SQL tab and run
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `users` (
  `id`         VARCHAR(36)  NOT NULL PRIMARY KEY,
  `name`       VARCHAR(255) NOT NULL,
  `email`      VARCHAR(255) NOT NULL,
  `password`   VARCHAR(255) NOT NULL,
  `role`       VARCHAR(50)  NOT NULL DEFAULT 'user',
  `pages`      TEXT         NOT NULL,
  `brands`     TEXT         NOT NULL,
  `active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` DATETIME     NOT NULL DEFAULT NOW(),
  `updated_at` DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `brands` (
  `id`          VARCHAR(36)  NOT NULL PRIMARY KEY,
  `slug`        VARCHAR(100) NOT NULL,
  `name`        VARCHAR(255) NOT NULL,
  `industry`    VARCHAR(255) NOT NULL DEFAULT '',
  `platform`    VARCHAR(255) NOT NULL DEFAULT '',
  `memory_json` MEDIUMTEXT   NOT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT NOW(),
  `updated_at`  DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY `uq_brands_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pricing_products` (
  `id`            VARCHAR(36)   NOT NULL PRIMARY KEY,
  `brand_id`      VARCHAR(36)   NOT NULL,
  `name`          VARCHAR(255)  NOT NULL DEFAULT 'Product',
  `mfg_per_pc`    DECIMAL(10,2) NOT NULL DEFAULT 0,
  `variant_type`  VARCHAR(50)   NOT NULL DEFAULT 'single',
  `extras_json`   MEDIUMTEXT    NOT NULL,
  `variants_json` MEDIUMTEXT    NOT NULL,
  `globals_json`  MEDIUMTEXT    NOT NULL,
  `updated_at`    DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  KEY `idx_pp_brand` (`brand_id`),
  CONSTRAINT `fk_pp_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pricing_history` (
  `id`         VARCHAR(36)  NOT NULL PRIMARY KEY,
  `brand_id`   VARCHAR(36)  NOT NULL,
  `saved_by`   VARCHAR(255) NOT NULL DEFAULT '',
  `snapshot`   MEDIUMTEXT   NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT NOW(),
  KEY `idx_ph_brand` (`brand_id`),
  CONSTRAINT `fk_ph_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `strategy_generations` (
  `id`                VARCHAR(36)  NOT NULL PRIMARY KEY,
  `brand_id`          VARCHAR(36)  NOT NULL,
  `strategy_month`    VARCHAR(100) NOT NULL DEFAULT '',
  `form_json`         MEDIUMTEXT   NOT NULL,
  `ai_json`           MEDIUMTEXT   NOT NULL,
  `flags_json`        TEXT         NOT NULL,
  `ai_provider`       VARCHAR(50)  NOT NULL DEFAULT '',
  `ai_model`          VARCHAR(100) NOT NULL DEFAULT '',
  `generated_by`      VARCHAR(255) NOT NULL DEFAULT '',
  `generated_by_role` VARCHAR(50)  NOT NULL DEFAULT '',
  `pptx_filename`     VARCHAR(255) NOT NULL DEFAULT '',
  `pptx_path`         VARCHAR(500) NOT NULL DEFAULT '',
  `created_at`        DATETIME     NOT NULL DEFAULT NOW(),
  KEY `idx_sg_brand`   (`brand_id`),
  KEY `idx_sg_created` (`created_at`),
  CONSTRAINT `fk_sg_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  `key`        VARCHAR(100) NOT NULL PRIMARY KEY,
  `value`      TEXT         NOT NULL DEFAULT '',
  `updated_at` DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `updated_by` VARCHAR(255) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_log` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id`    VARCHAR(36)  NOT NULL DEFAULT '',
  `user_name`  VARCHAR(255) NOT NULL DEFAULT '',
  `action`     VARCHAR(100) NOT NULL,
  `detail`     TEXT,
  `ip`         VARCHAR(100) NOT NULL DEFAULT '',
  `created_at` DATETIME     NOT NULL DEFAULT NOW(),
  KEY `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `budget_months` (
  `id`             VARCHAR(36)   NOT NULL PRIMARY KEY,
  `brand_id`       VARCHAR(36)   NOT NULL,
  `label`          VARCHAR(100)  NOT NULL,
  `year`           SMALLINT      NOT NULL,
  `month`          TINYINT       NOT NULL,
  `total_days`     TINYINT       NOT NULL DEFAULT 30,
  `revenue_target` DECIMAL(15,2) NOT NULL DEFAULT 0,
  `overall_roas`   DECIMAL(6,2)  NOT NULL DEFAULT 5,
  `channels`       MEDIUMTEXT    NOT NULL,
  `created_by`     VARCHAR(255)  NOT NULL DEFAULT '',
  `created_at`     DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`     DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  KEY `idx_bm_brand`       (`brand_id`),
  KEY `idx_bm_year_month`  (`year`, `month`),
  CONSTRAINT `fk_bm_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `budget_days` (
  `id`             VARCHAR(36)   NOT NULL PRIMARY KEY,
  `month_id`       VARCHAR(36)   NOT NULL,
  `brand_id`       VARCHAR(36)   NOT NULL,
  `day_number`     TINYINT       NOT NULL,
  `day_date`       DATE          DEFAULT NULL,
  `meta_sales`     DECIMAL(15,2) DEFAULT NULL,
  `meta_spend`     DECIMAL(15,2) DEFAULT NULL,
  `google_sales`   DECIMAL(15,2) DEFAULT NULL,
  `google_spend`   DECIMAL(15,2) DEFAULT NULL,
  `mp_sales`       DECIMAL(15,2) DEFAULT NULL,
  `mp_spend`       DECIMAL(15,2) DEFAULT NULL,
  `ret_sales`      DECIMAL(15,2) DEFAULT NULL,
  `ret_spend`      DECIMAL(15,2) DEFAULT NULL,
  `followers_real` INT           DEFAULT NULL,
  `posts_real`     INT           DEFAULT NULL,
  `channels_json`  TEXT          DEFAULT NULL,
  `entered_by`     VARCHAR(255)  NOT NULL DEFAULT '',
  `updated_at`     DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY `uq_bd_month_day` (`month_id`, `day_number`),
  KEY `idx_bd_brand`  (`brand_id`),
  CONSTRAINT `fk_bd_month` FOREIGN KEY (`month_id`) REFERENCES `budget_months`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ── Default settings ─────────────────────────────────────────
INSERT IGNORE INTO `settings` (`key`, `value`, `updated_by`) VALUES
  ('ai_provider',      'anthropic',          'system'),
  ('anthropic_model',  'claude-3-5-sonnet-latest',  'system'),
  ('openai_model',     'gpt-4o',             'system'),
  ('anthropic_api_key','',                   'system'),
  ('openai_api_key',   '',                   'system');

-- ── First superadmin — CHANGE PASSWORD AFTER FIRST LOGIN ─────
-- Default password hash corresponds to an initial secure password.
INSERT IGNORE INTO `users` (`id`,`name`,`email`,`password`,`role`,`pages`,`brands`,`active`) VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Admin',
   'admin@digifyce.in',
   '$2y$10$0WX1wuSlPbFg65.ytq7SVuY.bdObZZqa9n3NOrgumjqlT7kd1EGt2',
   'superadmin',
   '["dashboard","strategy","pricing","budget","admin"]',
   '*',
   1);
