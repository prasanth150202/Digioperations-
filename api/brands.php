<?php
require_once __DIR__ . '/config.php';
$user   = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$id     = $_GET['id'] ?? '';

// GET /api/brands.php — list all brands
if ($method === 'GET' && !$id) {
    requirePage($user, 'dashboard');
    $brands = dbAll('SELECT id,slug,name,industry,platform FROM brands ORDER BY name');
    if ($user['role'] !== 'superadmin' && $user['brands'] !== '*') {
        $allowed = is_array($user['brands']) ? $user['brands'] : [];
        $brands  = array_values(array_filter($brands, fn($b) => in_array($b['slug'], $allowed)));
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
    $slug = strtolower(preg_replace('/[^a-z0-9]+/', '-', $name));
    $slug = trim($slug, '-');
    if (dbGet('SELECT id FROM brands WHERE slug=?', [$slug])) json_err('Brand already exists', 409);
    $bid = uuid4();
    dbRun('INSERT INTO brands (id,slug,name,industry,platform,memory_json) VALUES (?,?,?,?,?,?)', [$bid,$slug,$name,$industry,$platform,'{}']);
    auditLog($user['id'], $user['name'], 'CREATE_BRAND', $name);
    json_out(['ok' => true, 'id' => $bid, 'slug' => $slug]);
}

// GET /api/brands.php?id=slug — get one brand
if ($method === 'GET' && $id) {
    // Check access BEFORE confirming the brand exists (prevents slug enumeration)
    if (!canAccessBrand($user, $id)) json_err('Access denied', 403);
    $brand = dbGet('SELECT * FROM brands WHERE slug=?', [$id]);
    if (!$brand) json_err('Not found', 404);
    $brand['memory_json'] = json_decode($brand['memory_json'] ?? '{}', true);
    json_out($brand);
}

json_err('Not found', 404);
