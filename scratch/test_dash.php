<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Start session and mock user BEFORE requiring config
session_start();
$_SESSION['user_id'] = '00000000-0000-0000-0000-000000000001'; // Admin

$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['action'] = 'dashboard';

echo "Running dashboard action test...\n";
require_once __DIR__ . '/../api/budget.php';
