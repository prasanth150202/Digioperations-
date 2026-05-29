<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// POST /api/auth.php?action=login
if ($method === 'POST' && $action === 'login') {
    $email = strtolower(trim(bodyGet('email', '')));
    $pass  = bodyGet('password', '');
    if (!$email || !$pass) json_err('Email and password required');

    $user = dbGet('SELECT * FROM users WHERE email=? AND active=1', [$email]);
    if (!$user || !password_verify($pass, $user['password'])) json_err('Invalid credentials', 401);

    $_SESSION['user_id'] = $user['id'];
    auditLog($user['id'], $user['name'], 'LOGIN');
    json_out(['ok' => true]);
}

// POST /api/auth.php?action=logout
if ($method === 'POST' && $action === 'logout') {
    session_destroy();
    json_out(['ok' => true]);
}

// GET /api/auth.php?action=me
if ($method === 'GET' && $action === 'me') {
    if (empty($_SESSION['user_id'])) json_err('Unauthorized', 401);
    $u = dbGet('SELECT id,name,email,role,pages,brands,active FROM users WHERE id=? AND active=1', [$_SESSION['user_id']]);
    if (!$u) json_err('Unauthorized', 401);
    $u['pages']  = json_decode($u['pages']  ?? '[]', true);
    $u['brands'] = $u['brands'] === '*' ? '*' : json_decode($u['brands'] ?? '[]', true);
    json_out(['user' => $u, 'app_url' => defined('APP_URL') ? APP_URL : '']);
}

json_err('Not found', 404);
