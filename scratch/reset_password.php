<?php
require_once __DIR__ . '/../api/config.php';

try {
    $hash = password_hash('Admin@1234', PASSWORD_BCRYPT);
    dbRun("UPDATE users SET password=? WHERE email='admin@digifyce.in'", [$hash]);
    echo "SUCCESS: Admin password reset to 'Admin@1234'!\n";
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
