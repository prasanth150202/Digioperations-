<?php
require_once __DIR__ . '/config.php';

// Disable showing errors in HTTP responses
ini_set('display_errors', 0);
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);

$method = $_SERVER['REQUEST_METHOD'];
$token = $_GET['token'] ?? '';

if ($method !== 'GET') {
    json_err('Method not allowed', 405);
}

if (!$token) {
    json_err('Token required', 400);
}

// 1. Fetch link and report
$link = dbGet('SELECT * FROM report_links WHERE unique_token = ?', [$token]);
if (!$link) {
    json_err('Report not found or link expired', 404);
}

$report = dbGet('SELECT r.*, b.name as brand_name 
                 FROM reports r 
                 JOIN brands b ON b.id = r.brand_id 
                 WHERE r.id = ?', [$link['report_id']]);
                 
if (!$report) {
    json_err('Report data not found', 404);
}

// 2. Increment view count
dbRun('UPDATE report_links SET view_count = view_count + 1, last_viewed = NOW() WHERE unique_token = ?', [$token]);

// 3. Render output
$report['report_data'] = json_decode($report['report_data'] ?? '{}', true);

// Exclude sensitive user/internal details if needed
unset($report['created_by']);

json_out($report);
