<?php
require_once __DIR__ . '/../api/config.php';

$users = dbAll("SELECT * FROM users");
foreach ($users as $u) {
    echo "User: {$u['name']} ({$u['email']})\n";
    echo " - Role: {$u['role']}\n";
    echo " - Pages Raw: {$u['pages']}\n";
    echo " - Pages Array: " . json_encode(json_decode($u['pages'] ?? '[]', true)) . "\n";
    echo " - Brands Raw: {$u['brands']}\n";
    echo " - Brands Array: " . json_encode($u['brands'] === '*' ? '*' : json_decode($u['brands'] ?? '[]', true)) . "\n";
    echo "\n";
}
