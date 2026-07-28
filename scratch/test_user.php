<?php
require_once __DIR__ . '/../api/config.php';

try {
    $users = dbAll("SELECT * FROM users");
    echo "USERS IN DATABASE (" . count($users) . "):\n";
    foreach ($users as $u) {
        echo " - ID: {$u['id']}, Name: {$u['name']}, Email: {$u['email']}, Role: {$u['role']}, Brands: {$u['brands']}\n";
    }
} catch (Throwable $e) {
    echo "ERROR QUERYING USERS: " . $e->getMessage() . "\n";
}
