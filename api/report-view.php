<?php
// Public endpoint - does not require user login authentication
require_once __DIR__ . '/config.php';

$token = $_GET['token'] ?? '';
$directId = $_GET['id'] ?? '';

if (!$token && !$directId) {
    json_err('Token or ID required', 400);
}

$link = null;
$report = null;

if ($directId) {
    // Direct lookup by report ID (used after generation)
    $report = dbGet('SELECT r.*, b.name as brand_name 
                     FROM reports r 
                     JOIN brands b ON b.id = r.brand_id 
                     WHERE r.id=?', [$directId]);
    if ($report) {
        $link = dbGet('SELECT * FROM report_links WHERE report_id=?', [$report['id']]);
    }
} else {
    // 1. Resolve token via report_links
    $link = dbGet('SELECT * FROM report_links WHERE unique_token=?', [$token]);
    $reportId = $link ? $link['report_id'] : $token;
    
    // 2. Fetch report
    $report = dbGet('SELECT r.*, b.name as brand_name 
                     FROM reports r 
                     JOIN brands b ON b.id = r.brand_id 
                     WHERE r.id=?', [$reportId]);
    
    if (!$report) {
        // Check if token matches shared_link directly
        $report = dbGet('SELECT r.*, b.name as brand_name 
                         FROM reports r 
                         JOIN brands b ON b.id = r.brand_id 
                         WHERE r.shared_link=?', [$token]);
    }
}

if (!$report) {
    json_err('Report not found', 404);
}

// Decode JSON report data
$report['report_data'] = json_decode($report['report_data'] ?? '{}', true);

// 3. Increment view count
if ($link) {
    dbRun('UPDATE report_links SET view_count = view_count + 1, last_viewed = NOW() WHERE id=?', [$link['id']]);
} else {
    dbRun('UPDATE report_links SET view_count = view_count + 1, last_viewed = NOW() WHERE report_id=?', [$report['id']]);
}

json_out([
    'ok' => true,
    'report' => $report
]);
