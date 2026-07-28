<?php
require_once __DIR__ . '/../api/config.php';

// Mock Bhavu user
$u = dbGet('SELECT * FROM users WHERE email=?', ['bhavana@digifyce.com']);
if (!$u) {
    echo "Bhavu user not found!\n";
    exit;
}
$u['pages']  = is_array($u['pages'])  ? $u['pages']  : json_decode($u['pages']  ?? '[]', true);
$u['brands'] = $u['brands'] === '*'   ? '*'           : json_decode($u['brands'] ?? '[]', true);

// Set method and action
$method = 'GET';
$action = 'dashboard';
$filterMonth = '';

$brands = dbAll('SELECT id,slug,name,industry,type FROM brands ORDER BY name');
if ($u['role'] !== 'superadmin' && $u['brands'] !== '*') {
    $allowed = is_array($u['brands']) ? $u['brands'] : json_decode($u['brands']??'[]',true);
    $brands = array_values(array_filter($brands, fn($b) => in_array($b['slug'],$allowed)));
}

echo "Role: " . $u['role'] . "\n";
echo "Brands setting: " . var_export($u['brands'], true) . "\n";
echo "Allowed brands count: " . count($brands) . "\n";
foreach ($brands as $b) {
    echo "- " . $b['name'] . " (" . $b['type'] . ")\n";
}
