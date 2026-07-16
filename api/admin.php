<?php
require_once __DIR__ . '/config.php';
$user   = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id     = $_GET['id'] ?? '';

if ($user['role'] !== 'superadmin') json_err('Superadmin only', 403);

// GET /api/admin.php?action=users
if ($method === 'GET' && $action === 'users') {
    $users = dbAll('SELECT id,name,email,role,pages,brands,active,created_at FROM users ORDER BY created_at DESC');
    foreach ($users as &$u) {
        $u['pages']  = json_decode($u['pages']  ?? '[]', true);
        $u['brands'] = $u['brands'] === '*' ? '*' : json_decode($u['brands'] ?? '[]', true);
    }
    json_out($users);
}

// GET /api/admin.php?action=audit
if ($method === 'GET' && $action === 'audit') {
    $range = $_GET['range'] ?? 'all';
    $limit = isset($_GET['limit']) ? max(1, (int)$_GET['limit']) : 250; // increased limit for full page logs
    
    $where = "";
    $params = [];
    if ($range === 'today') {
        $where = "WHERE DATE(created_at) = CURDATE()";
    } elseif ($range === 'week') {
        $where = "WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    } elseif ($range === 'custom') {
        $start = $_GET['start'] ?? '';
        $end = $_GET['end'] ?? '';
        if ($start && $end) {
            $where = "WHERE created_at >= ? AND created_at <= ?";
            $params = [$start . ' 00:00:00', $end . ' 23:59:59'];
        } elseif ($start) {
            $where = "WHERE created_at >= ?";
            $params = [$start . ' 00:00:00'];
        } elseif ($end) {
            $where = "WHERE created_at <= ?";
            $params = [$end . ' 23:59:59'];
        }
    }
    
    $logs = dbAll("SELECT * FROM audit_log $where ORDER BY created_at DESC LIMIT $limit", $params);
    json_out($logs);
}

// POST /api/admin.php?action=users — create user
if ($method === 'POST' && $action === 'users') {
    $name   = trim(bodyGet('name', ''));
    $email  = strtolower(trim(bodyGet('email', '')));
    $pass   = bodyGet('password', '');
    $role   = bodyGet('role', 'user');
    $pages  = bodyGet('pages', ['dashboard']);
    $brands = bodyGet('brands', '*');
    if (!$name || !$email || !$pass) json_err('Name, email and password required');
    if (strlen($pass) < 6) json_err('Password must be at least 6 characters');
    if (dbGet('SELECT id FROM users WHERE email=?', [$email])) json_err('Email already exists', 409);
    $uid   = uuid4();
    $hash  = password_hash($pass, PASSWORD_BCRYPT);
    $pagesJ  = is_array($pages)  ? json_encode($pages)  : $pages;
    $brandsJ = $brands === '*'   ? '*'                  : (is_array($brands) ? json_encode($brands) : $brands);
    dbRun('INSERT INTO users (id,name,email,password,role,pages,brands) VALUES (?,?,?,?,?,?,?)', [$uid,$name,$email,$hash,$role,$pagesJ,$brandsJ]);
    auditLog($user['id'], $user['name'], 'CREATE_USER', $name);
    json_out(['ok' => true, 'id' => $uid]);
}

// PUT /api/admin.php?action=users&id=X — update user
if ($method === 'PUT' && $action === 'users' && $id) {
    $b = body();
    try {
        dbRun('BEGIN');
        if (isset($b['active'])) {
            dbRun('UPDATE users SET active=? WHERE id=?', [(int)$b['active'], $id]);
            auditLog($user['id'], $user['name'], 'UPDATE_USER_ACTIVE', $id . ' active=' . (int)$b['active']);
        }
        if (isset($b['role'])) {
            dbRun('UPDATE users SET role=? WHERE id=?', [$b['role'], $id]);
            auditLog($user['id'], $user['name'], 'UPDATE_USER_ROLE', $id . ' role=' . $b['role']);
        }
        dbRun('COMMIT');
        json_out(['ok' => true]);
    } catch (Throwable $e) {
        dbRun('ROLLBACK');
        json_err('Update failed');
    }
}

// DELETE /api/admin.php?action=users&id=X — delete user
if ($method === 'DELETE' && $action === 'users' && $id) {
    if ($id === $user['id']) json_err('Cannot delete yourself');
    dbRun('DELETE FROM users WHERE id=?', [$id]);
    json_out(['ok' => true]);
}

// GET /api/admin.php?action=months
if ($method === 'GET' && $action === 'months') {
    $months = dbAll('SELECT bm.*, b.name as brand_name FROM budget_months bm JOIN brands b ON b.id=bm.brand_id ORDER BY bm.year DESC, bm.month DESC, b.name ASC');
    json_out($months);
}

// DELETE /api/admin.php?action=months&id=X
if ($method === 'DELETE' && $action === 'months' && $id) {
    $month = dbGet('SELECT * FROM budget_months WHERE id=?', [$id]);
    if (!$month) json_err('Not found', 404);
    
    try {
        dbRun('BEGIN');
        dbRun('DELETE FROM budget_days WHERE month_id=?', [$id]);
        dbRun('DELETE FROM budget_months WHERE id=?', [$id]);
        dbRun('COMMIT');
        auditLog($user['id'], $user['name'], 'DELETE_BUDGET_MONTH', $month['brand_id'] . ' - ' . $month['label']);
        json_out(['ok' => true]);
    } catch (Throwable $e) {
        dbRun('ROLLBACK');
        json_err('Failed to delete month');
    }
}

// GET /api/admin.php?action=settings
if ($method === 'GET' && $action === 'settings') {
    $keys = ['ai_provider','anthropic_model','openai_model','anthropic_api_key','openai_api_key','jina_api_key','firecrawl_api_key','tavily_api_key','serpapi_api_key'];
    $out  = [];
    foreach ($keys as $k) $out[$k] = getSetting($k);
    json_out($out);
}

// POST /api/admin.php?action=settings
if ($method === 'POST' && $action === 'settings') {
    $b = body();
    $allowed = ['ai_provider','anthropic_model','openai_model','anthropic_api_key','openai_api_key','jina_api_key','firecrawl_api_key','tavily_api_key','serpapi_api_key'];
    foreach ($allowed as $k) {
        if (isset($b[$k])) setSetting($k, $b[$k], $user['name']);
    }
    json_out(['ok' => true]);
}

// POST /api/admin.php?action=test-key
if ($method === 'POST' && $action === 'test-key') {
    $provider = bodyGet('provider', 'anthropic');
    try {
        require_once __DIR__ . '/ai.php';
        $result = testAIKey($provider);
        json_out(['ok' => true, 'message' => $result]);
    } catch (Throwable $e) {
        json_err($e->getMessage());
    }
}

json_err('Not found', 404);
