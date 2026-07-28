<?php
require_once __DIR__ . '/config.php';
$user   = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? '';

function obfuscateIntegrations(?string $json): ?string {
    if (!$json) return null;
    $arr = json_decode($json, true);
    if (!is_array($arr)) return $json;
    $keysToObfuscate = ['shopify_access_token', 'meta_access_token'];
    foreach ($keysToObfuscate as $k) {
        if (!empty($arr[$k])) {
            $arr[$k] = str_repeat('·', 8);
        }
    }
    return json_encode($arr);
}

// GET /api/brands.php — list all brands
if ($method === 'GET' && !$id) {
    // Allow if user has access to at least one valid page
    $allowedPages = ['dashboard', 'strategy', 'pricing', 'budget', 'reports', 'monthly_reports'];
    $hasAccess = false;
    foreach ($allowedPages as $ap) {
        if ($user['role'] === 'superadmin' || in_array($ap, $user['pages'])) {
            $hasAccess = true;
            break;
        }
    }
    if (!$hasAccess) json_err('Access denied', 403);

    $brands = dbAll('SELECT b.id, b.slug, b.name, b.industry, b.platform, b.channels_config, b.integrations_json,
        (SELECT COUNT(*) FROM pricing_products WHERE brand_id = b.id) AS product_count,
        (SELECT COUNT(*) FROM strategy_generations WHERE brand_id = b.id) AS generation_count
        FROM brands b ORDER BY b.name');
    if ($user['role'] !== 'superadmin' && $user['brands'] !== '*') {
        $allowed = is_array($user['brands']) ? $user['brands'] : [];
        $brands  = array_values(array_filter($brands, fn($b) => in_array($b['slug'], $allowed)));
    }
    // Obfuscate sensitive credentials for all brands in GET list
    foreach ($brands as &$b) {
        if (!empty($b['integrations_json'])) {
            $b['integrations_json'] = obfuscateIntegrations($b['integrations_json']);
        }
    }
    json_out($brands);
}

// POST /api/brands.php — create brand
if ($method === 'POST') {
    if (!canManage($user)) json_err('Insufficient permissions', 403);
    $name     = trim(bodyGet('name', ''));
    $industry = trim(bodyGet('industry', ''));
    $platform = trim(bodyGet('platform', ''));
    if (!$name) json_err('Brand name required');
    $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($name)), '-');
    if (dbGet('SELECT id FROM brands WHERE slug=?', [$slug])) json_err('Brand already exists', 409);
    $bid = uuid4();
    
    $channels_config = bodyGet('channels_config', '["meta","google"]');
    if (is_array($channels_config)) $channels_config = json_encode($channels_config);
    
    $integrations_json = bodyGet('integrations_json', '{}');
    if (is_array($integrations_json)) $integrations_json = json_encode($integrations_json);
    
    dbRun('INSERT INTO brands (id,slug,name,industry,platform,channels_config,memory_json,integrations_json) VALUES (?,?,?,?,?,?,?,?)', [$bid,$slug,$name,$industry,$platform,$channels_config,'{}',$integrations_json]);
    auditLog($user['id'], $user['name'], 'CREATE_BRAND', $name);
    json_out(['ok' => true, 'id' => $bid, 'slug' => $slug]);
}

// GET /api/brands.php?id=slug — get one brand
if ($method === 'GET' && $id) {
    if (!canAccessBrand($user, $id)) json_err('Access denied', 403);
    $brand = dbGet('SELECT * FROM brands WHERE slug=?', [$id]);
    if (!$brand) json_err('Not found', 404);
    $brand['memory_json'] = json_decode($brand['memory_json'] ?? '{}', true);
    $brand['integrations_json'] = json_decode(obfuscateIntegrations($brand['integrations_json'] ?? '{}'), true) ?: new stdClass();
    json_out($brand);
}

// PUT /api/brands.php?id=slug — update brand
if ($method === 'PUT' && $id) {
    if (!canManage($user)) json_err('Insufficient permissions', 403);
    $brand = dbGet('SELECT * FROM brands WHERE slug=?', [$id]);
    if (!$brand) json_err('Not found', 404);
    
    $name = bodyGet('name', $brand['name']);
    $industry = bodyGet('industry', $brand['industry']);
    $platform = bodyGet('platform', $brand['platform']);
    
    $channels_config = bodyGet('channels_config', $brand['channels_config']);
    if (is_array($channels_config)) $channels_config = json_encode($channels_config);
    
    $incoming = bodyGet('integrations_json', null);
    $finalIntegrations = $brand['integrations_json'] ?? '{}';
    if ($incoming !== null) {
        if (!is_array($incoming)) $incoming = json_decode($incoming, true) ?: [];
        $existing = json_decode($brand['integrations_json'] ?? '{}', true) ?: [];
        
        $merged = array_merge($existing, $incoming);
        foreach ($incoming as $k => $v) {
            if ($v === str_repeat('·', 8) && isset($existing[$k])) {
                $merged[$k] = $existing[$k];
            }
        }
        $finalIntegrations = json_encode($merged);
    }
    
    dbRun('UPDATE brands SET name=?, industry=?, platform=?, channels_config=?, integrations_json=? WHERE slug=?', [$name, $industry, $platform, $channels_config, $finalIntegrations, $id]);
    json_out(['ok' => true]);
}

// DELETE /api/brands.php?id=slug — delete brand (superadmin only)
if ($method === 'DELETE' && $id) {
    if ($user['role'] !== 'superadmin') json_err('Only superadmin can delete brands', 403);
    $brand = dbGet('SELECT * FROM brands WHERE slug=?', [$id]);
    if (!$brand) json_err('Brand not found', 404);
    try {
        dbRun('BEGIN');
        dbRun('DELETE FROM budget_days WHERE month_id IN (SELECT id FROM budget_months WHERE brand_id=?)', [$brand['id']]);
        dbRun('DELETE FROM budget_months WHERE brand_id=?', [$brand['id']]);
        dbRun('DELETE FROM brands WHERE id=?', [$brand['id']]);
        dbRun('COMMIT');
        auditLog($user['id'], $user['name'], 'DELETE_BRAND', $brand['name']);
        json_out(['ok' => true]);
    } catch (Throwable $e) {
        dbRun('ROLLBACK');
        json_err('Delete failed: ' . $e->getMessage(), 500);
    }
}

json_err('Not found', 404);
