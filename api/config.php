<?php
// Disable showing errors in HTTP responses (prevents corrupting JSON responses with PHP warnings/notices)
ini_set('display_errors', 0);
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);

// ── Load Environment Variables from .env ──────────────────────
$envPath = dirname(__DIR__) . '/.env';
if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        // Skip comments and empty lines
        if ($line === '' || (isset($line[0]) && $line[0] === '#')) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            // Handle optional quotes around values
            if (preg_match('/^["\'](.*)["\']$/', $value, $m)) {
                $value = $m[1];
            }
            // Put into environment variables so getenv() works (if not already set)
            if (getenv($key) === false) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            } else {
                if (!isset($_ENV[$key])) $_ENV[$key] = getenv($key);
                if (!isset($_SERVER[$key])) $_SERVER[$key] = getenv($key);
            }
        }
    }
}

// ── Application URL ──────────────────────────────────────────
define('APP_URL', getenv('APP_URL') ?: (
    (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost')
));

define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'digifyce');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_CHARSET', 'utf8mb4');

// ── AI Keys (set here OR in Admin → Settings) ────────────────
define('ANTHROPIC_API_KEY', getenv('ANTHROPIC_API_KEY') ?: '');   // sk-ant-...
define('OPENAI_API_KEY', getenv('OPENAI_API_KEY') ?: '');      // sk-...

// ── Session ──────────────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_strict_mode', 1);
    // Only send secure cookies over HTTPS (disabled on local HTTP to allow localhost to work)
    $isSecure = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') || 
                (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    ini_set('session.cookie_secure', $isSecure ? 1 : 0);
    ini_set('session.cookie_samesite', 'Lax'); // Lax is better for cross-page redirects in some environments
    session_start();
}

// ── Database connection (PDO) ────────────────────────────────
function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    try {
        $dsn = 'mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset='.DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        // Self-healing migration for outdated default model names
        try {
            $pdo->exec("UPDATE settings SET value = 'claude-3-5-sonnet-latest' WHERE `key` = 'anthropic_model' AND value = 'claude-sonnet-4-6'");
        } catch (Throwable $migrationErr) {}

        // Self-healing migration for pricing_logs table
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS `pricing_logs` (
              `id`            VARCHAR(36)  NOT NULL PRIMARY KEY,
              `brand_id`      VARCHAR(36)  NOT NULL,
              `product_id`    VARCHAR(36)  NOT NULL,
              `product_name`  VARCHAR(255) NOT NULL,
              `variant_id`    VARCHAR(36)  NOT NULL,
              `variant_name`  VARCHAR(255) NOT NULL,
              `field_changed` VARCHAR(100) NOT NULL,
              `old_value`     VARCHAR(255) DEFAULT NULL,
              `new_value`     VARCHAR(255) NOT NULL,
              `user_name`     VARCHAR(255) NOT NULL DEFAULT '',
              `created_at`    DATETIME     NOT NULL DEFAULT NOW(),
              KEY `idx_pl_brand` (`brand_id`),
              CONSTRAINT `fk_pl_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
        } catch (Throwable $migrationErr) {}

        try {
            $cols = $pdo->query("SHOW COLUMNS FROM `brands` LIKE 'channels_config'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `brands` ADD COLUMN `channels_config` TEXT DEFAULT NULL");
            }
        } catch (Throwable $migrationErr) {}

        try {
            $cols = $pdo->query("SHOW COLUMNS FROM `budget_days` LIKE 'channels_json'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `budget_days` ADD COLUMN `channels_json` TEXT DEFAULT NULL AFTER `posts_real`");
            }
        } catch (Throwable $migrationErr) {}

        try {
            $cols = $pdo->query("SHOW COLUMNS FROM `budget_days` LIKE 'day_date'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `budget_days` ADD COLUMN `day_date` DATE DEFAULT NULL AFTER `day_number`");
            }
        } catch (Throwable $migrationErr) {}

        try {
            $cols = $pdo->query("SHOW COLUMNS FROM `budget_months` LIKE 'channels'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `budget_months` ADD COLUMN `channels` MEDIUMTEXT DEFAULT NULL AFTER `overall_roas`");
            }
        } catch (Throwable $migrationErr) {}

        // Self-healing migration for reports table
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS `reports` (
              `id`                VARCHAR(36)   NOT NULL PRIMARY KEY,
              `brand_id`          VARCHAR(36)   NOT NULL,
              `report_type`       VARCHAR(20)   NOT NULL,
              `period_start`      DATE          NOT NULL,
              `period_end`        DATE          NOT NULL,
              `total_spend`       DECIMAL(15,2) NOT NULL DEFAULT 0.00,
              `total_conversions` INT           NOT NULL DEFAULT 0,
              `total_revenue`     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
              `overall_cpa`       DECIMAL(15,2) NOT NULL DEFAULT 0.00,
              `overall_roas`      DECIMAL(6,2)  NOT NULL DEFAULT 0.00,
              `overall_aov`       DECIMAL(15,2) NOT NULL DEFAULT 0.00,
              `report_data`       LONGTEXT      NOT NULL,
              `shared_link`       VARCHAR(100)  DEFAULT NULL UNIQUE,
              `is_public`         TINYINT(1)    NOT NULL DEFAULT 1,
              `highlights`        TEXT          DEFAULT NULL,
              `blockers`          TEXT          DEFAULT NULL,
              `next_steps`        TEXT          DEFAULT NULL,
              `created_by`        VARCHAR(255)  NOT NULL DEFAULT '',
              `created_at`        DATETIME      NOT NULL DEFAULT NOW(),
              `updated_at`        DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
              KEY `idx_rep_brand` (`brand_id`),
              CONSTRAINT `fk_rep_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
        } catch (Throwable $migrationErr) {}

        // Self-healing migration for report_links table
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS `report_links` (
              `id`           VARCHAR(36)  NOT NULL PRIMARY KEY,
              `report_id`    VARCHAR(36)  NOT NULL,
              `unique_token` VARCHAR(64)  NOT NULL UNIQUE,
              `client_name`  VARCHAR(255) DEFAULT '',
              `client_email` VARCHAR(255) DEFAULT '',
              `view_count`   INT          NOT NULL DEFAULT 0,
              `last_viewed`  DATETIME     DEFAULT NULL,
              `created_at`   DATETIME     NOT NULL DEFAULT NOW(),
              KEY `idx_rl_token` (`unique_token`),
              CONSTRAINT `fk_rl_report` FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
        } catch (Throwable $migrationErr) {}

        // Self-healing migration for report_manual_data table
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS `report_manual_data` (
              `report_id`     VARCHAR(36)  NOT NULL PRIMARY KEY,
              `channels_json` LONGTEXT     NOT NULL,
              `totals_json`   LONGTEXT     NOT NULL,
              `updated_at`    DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
              CONSTRAINT `fk_rmd_report` FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
        } catch (Throwable $migrationErr) {}

        // Self-healing migration for consultant_generations table
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS `consultant_generations` (
              `id`                VARCHAR(36)  NOT NULL PRIMARY KEY,
              `brand_id`          VARCHAR(36)  NOT NULL,
              `brand_name`        VARCHAR(255) NOT NULL DEFAULT '',
              `brand_url`         VARCHAR(500) NOT NULL DEFAULT '',
              `crawled_json`      MEDIUMTEXT   NOT NULL,
              `brief_json`        MEDIUMTEXT   NOT NULL,
              `strategy_json`     MEDIUMTEXT   NOT NULL,
              `modules_json`      LONGTEXT     DEFAULT NULL,
              `generated_by`      VARCHAR(255) NOT NULL DEFAULT '',
              `created_at`        DATETIME     NOT NULL DEFAULT NOW(),
              KEY `idx_cg_brand`   (`brand_id`),
              CONSTRAINT `fk_cg_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
        } catch (Throwable $migrationErr) {}

        // Add modules_json column to existing tables (self-healing)
        try {
            $cols = $pdo->query("SHOW COLUMNS FROM `consultant_generations` LIKE 'modules_json'")->fetchAll();
            if (empty($cols)) {
                $pdo->exec("ALTER TABLE `consultant_generations` ADD COLUMN `modules_json` LONGTEXT DEFAULT NULL");
            }
        } catch (Throwable $migrationErr) {}

        // Seed intelligence API key settings rows if not present
        try {
            foreach (['firecrawl_api_key','tavily_api_key','serpapi_api_key','jina_api_key'] as $k) {
                $pdo->exec("INSERT IGNORE INTO `settings` (`key`, `value`, `updated_by`) VALUES ('{$k}', '', 'system')");
            }
        } catch (Throwable $migrationErr) {}

        // Run self-cleaning retention policy to delete reports older than 12 weeks
        try {
            $pdo->exec("DELETE FROM reports WHERE created_at < DATE_SUB(NOW(), INTERVAL 12 WEEK)");
        } catch (Throwable $cleaningErr) {}

        return $pdo;
    } catch (PDOException $e) {
        json_err('Database connection failed. Did you import install.sql into phpMyAdmin? ' . $e->getMessage(), 500);
    }
}

function dbAll(string $sql, array $p = []): array {
    try {
        $s = db()->prepare($sql);
        $s->execute($p);
        return $s->fetchAll();
    } catch (PDOException $e) {
        json_err('Database error: ' . $e->getMessage(), 500);
    }
}
function dbGet(string $sql, array $p = []): ?array {
    try {
        $s = db()->prepare($sql);
        $s->execute($p);
        $r = $s->fetch();
        return $r ?: null;
    } catch (PDOException $e) {
        json_err('Database error: ' . $e->getMessage(), 500);
    }
}
function dbRun(string $sql, array $p = []): void {
    try {
        $s = db()->prepare($sql);
        $s->execute($p);
    } catch (PDOException $e) {
        json_err('Database error: ' . $e->getMessage(), 500);
    }
}
function dbLastId(): string { return db()->lastInsertId(); }

// ── Response helpers ─────────────────────────────────────────
function json_out(mixed $data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    $out = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    if ($out === false) {
        $out = json_encode(['error' => 'Response encoding failed: ' . json_last_error_msg()]);
    }
    echo $out;
    exit;
}
function json_err(string $msg, int $code = 400): never { json_out(['error' => $msg], $code); }

// ── Input ────────────────────────────────────────────────────
function body(): array {
    static $b = null;
    if ($b !== null) return $b;
    $raw = file_get_contents('php://input');
    $b   = json_decode($raw, true) ?? [];
    return $b;
}
function bodyGet(string $key, mixed $default = null): mixed {
    return body()[$key] ?? $default;
}

// ── Auth helpers ─────────────────────────────────────────────
function requireAuth(): array {
    if (empty($_SESSION['user_id'])) json_err('Unauthorized', 401);
    $u = dbGet('SELECT * FROM users WHERE id=? AND active=1', [$_SESSION['user_id']]);
    if (!$u) { session_destroy(); json_err('Unauthorized', 401); }
    $u['pages']  = is_array($u['pages'])  ? $u['pages']  : json_decode($u['pages']  ?? '[]', true);
    $u['brands'] = $u['brands'] === '*'   ? '*'           : json_decode($u['brands'] ?? '[]', true);
    return $u;
}
function requirePage(array $user, string $page): void {
    if ($user['role'] === 'superadmin') return;
    $pages = is_array($user['pages']) ? $user['pages'] : json_decode($user['pages'] ?? '[]', true);
    if (!in_array($page, $pages)) json_err('Access denied', 403);
}
function canAccessBrand(array $user, string $slug): bool {
    if ($user['role'] === 'superadmin') return true;
    if ($user['brands'] === '*') return true;
    $brands = is_array($user['brands']) ? $user['brands'] : json_decode($user['brands'] ?? '[]', true);
    return in_array($slug, $brands);
}
function canManage(array $user): bool { return in_array($user['role'], ['superadmin','manager']); }

// ── UUID ─────────────────────────────────────────────────────
function uuid4(): string {
    $d = random_bytes(16);
    $d[6] = chr(ord($d[6]) & 0x0f | 0x40);
    $d[8] = chr(ord($d[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}

// ── Settings ─────────────────────────────────────────────────
function getSetting(string $key, string $fallback = ''): string {
    $r = dbGet('SELECT value FROM settings WHERE `key`=?', [$key]);
    return $r ? $r['value'] : $fallback;
}
function setSetting(string $key, string $value, string $by = ''): void {
    dbRun('INSERT INTO settings (`key`,value,updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value),updated_by=VALUES(updated_by)', [$key,$value,$by]);
}

// ── Audit log ────────────────────────────────────────────────
function auditLog(string $userId, string $userName, string $action, string $detail = ''): void {
    try { dbRun('INSERT INTO audit_log (user_id,user_name,action,detail,ip) VALUES (?,?,?,?,?)', [$userId,$userName,$action,$detail,$_SERVER['REMOTE_ADDR']??'']); } catch (Throwable) {}
}

// ── CORS (restrict to same origin in production) ──────────────────
if (isset($_SERVER['HTTP_ORIGIN'])) {
    $parsed = parse_url(APP_URL);
    $allowedHost = isset($parsed['host']) ? ($parsed['scheme'] . '://' . $parsed['host'] . (isset($parsed['port']) ? ':' . $parsed['port'] : '')) : '';
    $allowed = rtrim($allowedHost ?: 'https://' . ($_SERVER['SERVER_NAME'] ?? 'localhost'), '/');
    if ($_SERVER['HTTP_ORIGIN'] === $allowed || strpos($_SERVER['HTTP_ORIGIN'], 'localhost') !== false) {
        header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
        header('Access-Control-Allow-Credentials: true');
    }
}
header('Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
