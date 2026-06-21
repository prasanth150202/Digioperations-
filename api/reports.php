<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/ai.php';

$user = requireAuth();
requirePage($user, 'reports');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// GET list of reports for a brand
if ($method === 'GET' && $action === 'list') {
    $brandId = $_GET['brand_id'] ?? '';
    if (!$brandId) json_err('Brand ID required');
    
    // Check brand access
    $brand = dbGet('SELECT slug FROM brands WHERE id=?', [$brandId]);
    if (!$brand || !canAccessBrand($user, $brand['slug'])) json_err('Access denied', 403);
    
    $reports = dbAll('SELECT r.*, rl.unique_token, rl.view_count, rl.last_viewed 
                      FROM reports r 
                      LEFT JOIN report_links rl ON rl.report_id = r.id 
                      WHERE r.brand_id = ? 
                      ORDER BY r.created_at DESC', [$brandId]);
                      
    json_out($reports);
}

// GET check missing data for a date range
if ($method === 'GET' && $action === 'check_missing') {
    $brandId = $_GET['brand_id'] ?? '';
    $startStr = $_GET['start_date'] ?? '';
    $endStr = $_GET['end_date'] ?? '';
    
    if (!$brandId || !$startStr || !$endStr) json_err('brand_id, start_date, and end_date required');
    
    $brand = dbGet('SELECT slug FROM brands WHERE id=?', [$brandId]);
    if (!$brand || !canAccessBrand($user, $brand['slug'])) json_err('Access denied', 403);
    
    $start = new DateTime($startStr);
    $end = new DateTime($endStr);
    $interval = new DateInterval('P1D');
    $range = new DatePeriod($start, $interval, $end->modify('+1 day'));
    
    // Fetch all existing day date records
    $dayRows = dbAll('SELECT day_date, channels_json, meta_sales, google_sales, mp_sales, ret_sales 
                      FROM budget_days 
                      WHERE brand_id = ? AND day_date BETWEEN ? AND ?', 
                      [$brandId, $startStr, $endStr]);
                      
    $existing = [];
    foreach ($dayRows as $row) {
        $existing[$row['day_date']] = $row;
    }
    
    $missing = [];
    foreach ($range as $date) {
        $dStr = $date->format('Y-m-d');
        if (!isset($existing[$dStr])) {
            $missing[] = $dStr;
        } else {
            // Even if record exists, check if channels_json is empty and legacy columns are all null
            $r = $existing[$dStr];
            $ch = json_decode($r['channels_json'] ?? '{}', true);
            $hasData = false;
            foreach ($ch as $chKey => $vals) {
                if (($vals['sales'] !== null && $vals['sales'] > 0) || ($vals['spend'] !== null && $vals['spend'] > 0)) {
                    $hasData = true;
                    break;
                }
            }
            // Check legacy column fallbacks
            if (!$hasData && ($r['meta_sales'] != null || $r['google_sales'] != null || $r['mp_sales'] != null || $r['ret_sales'] != null)) {
                $hasData = true;
            }
            if (!$hasData) {
                $missing[] = $dStr;
            }
        }
    }
    
    json_out(['missing' => $missing]);
}

// POST save missing day performance data
if ($method === 'POST' && $action === 'save_missing') {
    $brandId = bodyGet('brand_id', '');
    $missingData = bodyGet('missing_data', []);
    
    if (!$brandId || empty($missingData)) json_err('brand_id and missing_data array required');
    
    $brand = dbGet('SELECT slug, id FROM brands WHERE id=?', [$brandId]);
    if (!$brand || !canAccessBrand($user, $brand['slug'])) json_err('Access denied', 403);
    
    foreach ($missingData as $entry) {
        $dateStr = $entry['date'] ?? '';
        $chInput = $entry['channels'] ?? [];
        if (!$dateStr) continue;
        
        $dateTime = new DateTime($dateStr);
        $yr = (int)$dateTime->format('Y');
        $mo = (int)$dateTime->format('m');
        $dayNum = (int)$dateTime->format('d');
        
        // Find or create budget month
        $month = dbGet('SELECT id, total_days FROM budget_months WHERE brand_id=? AND year=? AND month=?', [$brandId, $yr, $mo]);
        if (!$month) {
            $monthId = uuid4();
            $label = $dateTime->format('F Y');
            $totalDays = (int)$dateTime->format('t');
            dbRun('INSERT INTO budget_months (id,brand_id,label,year,month,total_days,revenue_target,overall_roas,channels,created_by) 
                   VALUES (?,?,?,?,?,?,?,?,?,?)',
                [$monthId, $brandId, $label, $yr, $mo, $totalDays, 0, 5, '{}', $user['name']]);
        } else {
            $monthId = $month['id'];
        }
        
        // Extract flat legacy column compatibility values
        $metaSales = isset($chInput['meta']['sales']) && $chInput['meta']['sales'] !== '' ? (float)$chInput['meta']['sales'] : null;
        $metaSpend = isset($chInput['meta']['spend']) && $chInput['meta']['spend'] !== '' ? (float)$chInput['meta']['spend'] : null;
        $googSales = isset($chInput['google']['sales']) && $chInput['google']['sales'] !== '' ? (float)$chInput['google']['sales'] : null;
        $googSpend = isset($chInput['google']['spend']) && $chInput['google']['spend'] !== '' ? (float)$chInput['google']['spend'] : null;
        
        // Clicks/Impressions/Conversions parameters
        $followersReal = null;
        $postsReal = null;
        
        // Update conversions dynamically
        foreach ($chInput as $cName => &$cData) {
            if (isset($cData['sales']) && $cData['sales'] !== '') $cData['sales'] = (float)$cData['sales'];
            else $cData['sales'] = null;
            
            if (isset($cData['spend']) && $cData['spend'] !== '') $cData['spend'] = (float)$cData['spend'];
            else $cData['spend'] = null;
            
            if (isset($cData['clicks']) && $cData['clicks'] !== '') $cData['clicks'] = (int)$cData['clicks'];
            else $cData['clicks'] = null;
            
            if (isset($cData['impressions']) && $cData['impressions'] !== '') $cData['impressions'] = (int)$cData['impressions'];
            else $cData['impressions'] = null;
            
            if (isset($cData['conversions']) && $cData['conversions'] !== '') $cData['conversions'] = (int)$cData['conversions'];
            else $cData['conversions'] = null;

            if (isset($cData['customers_acquired']) && $cData['customers_acquired'] !== '') $cData['customers_acquired'] = (int)$cData['customers_acquired'];
            else $cData['customers_acquired'] = null;

            if ($cName === 'followers' && isset($cData['count'])) $followersReal = (int)$cData['count'];
            if ($cName === 'posts' && isset($cData['count'])) $postsReal = (int)$cData['count'];
        }
        
        $chJson = json_encode($chInput);
        
        // Insert/Update budget day record
        $existingDay = dbGet('SELECT id FROM budget_days WHERE month_id=? AND day_number=?', [$monthId, $dayNum]);
        if ($existingDay) {
            dbRun('UPDATE budget_days SET meta_sales=?,meta_spend=?,google_sales=?,google_spend=?,followers_real=?,posts_real=?,channels_json=?,day_date=?,entered_by=? WHERE id=?',
                [$metaSales, $metaSpend, $googSales, $googSpend, $followersReal, $postsReal, $chJson, $dateStr, $user['name'], $existingDay['id']]);
        } else {
            dbRun('INSERT INTO budget_days (id,month_id,brand_id,day_number,day_date,meta_sales,meta_spend,google_sales,google_spend,followers_real,posts_real,channels_json,entered_by) 
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [uuid4(), $monthId, $brandId, $dayNum, $dateStr, $metaSales, $metaSpend, $googSales, $googSpend, $followersReal, $postsReal, $chJson, $user['name']]);
        }
    }
    
    json_out(['ok' => true]);
}

// Helper to sum and compile performance statistics from a date range
function aggregateStats(string $brandId, string $start, string $end): array {
    $rows = dbAll('SELECT * FROM budget_days WHERE brand_id = ? AND day_date BETWEEN ? AND ?', [$brandId, $start, $end]);
    
    $channels = [];
    $totals = ['spend' => 0.0, 'revenue' => 0.0, 'conversions' => 0, 'customers_acquired' => 0, 'clicks' => 0, 'impressions' => 0];

    foreach ($rows as $r) {
        $ch = json_decode($r['channels_json'] ?? '{}', true);

        // Include legacy fallbacks
        if (!isset($ch['meta']) && ($r['meta_sales'] !== null || $r['meta_spend'] !== null)) {
            $ch['meta'] = ['sales' => $r['meta_sales'], 'spend' => $r['meta_spend']];
        }
        if (!isset($ch['google']) && ($r['google_sales'] !== null || $r['google_spend'] !== null)) {
            $ch['google'] = ['sales' => $r['google_sales'], 'spend' => $r['google_spend']];
        }

        foreach ($ch as $chName => $data) {
            if ($chName === 'followers' || $chName === 'posts') continue;

            if (!isset($channels[$chName])) {
                $channels[$chName] = ['spend' => 0.0, 'revenue' => 0.0, 'conversions' => 0, 'customers_acquired' => 0, 'clicks' => 0, 'impressions' => 0];
            }

            $sp    = isset($data['spend']) ? (float)$data['spend'] : 0.0;
            $rev   = isset($data['sales']) ? (float)$data['sales'] : 0.0;
            $conv  = isset($data['conversions']) ? (int)$data['conversions'] : 0;
            $cust  = isset($data['customers_acquired']) ? (int)$data['customers_acquired'] : 0;
            $clk   = isset($data['clicks']) ? (int)$data['clicks'] : 0;
            $imp   = isset($data['impressions']) ? (int)$data['impressions'] : 0;

            $channels[$chName]['spend']              += $sp;
            $channels[$chName]['revenue']             += $rev;
            $channels[$chName]['conversions']         += $conv;
            $channels[$chName]['customers_acquired']  += $cust;
            $channels[$chName]['clicks']              += $clk;
            $channels[$chName]['impressions']         += $imp;

            $totals['spend']             += $sp;
            $totals['revenue']            += $rev;
            $totals['conversions']        += $conv;
            $totals['customers_acquired'] += $cust;
            $totals['clicks']             += $clk;
            $totals['impressions']        += $imp;
        }
    }

    // Add derived rates
    foreach ($channels as $chName => &$cMetrics) {
        $cMetrics['roas'] = $cMetrics['spend'] > 0 ? round($cMetrics['revenue'] / $cMetrics['spend'], 2) : 0.0;
        // CPA = cost per customer acquired; fall back to cost per order if no customers_acquired data
        $cpaDenominator = $cMetrics['customers_acquired'] > 0 ? $cMetrics['customers_acquired'] : $cMetrics['conversions'];
        $cMetrics['cpa'] = $cpaDenominator > 0 ? round($cMetrics['spend'] / $cpaDenominator, 2) : 0.0;
        $cMetrics['ctr'] = $cMetrics['impressions'] > 0 ? round(($cMetrics['clicks'] / $cMetrics['impressions']) * 100, 2) : 0.0;
    }

    $totals['roas'] = $totals['spend'] > 0 ? round($totals['revenue'] / $totals['spend'], 2) : 0.0;
    $cpaDenomTotal  = $totals['customers_acquired'] > 0 ? $totals['customers_acquired'] : $totals['conversions'];
    $totals['cpa']  = $cpaDenomTotal > 0 ? round($totals['spend'] / $cpaDenomTotal, 2) : 0.0;
    $totals['aov']  = $totals['conversions'] > 0 ? round($totals['revenue'] / $totals['conversions'], 2) : 0.0;
    
    return [
        'channels' => $channels,
        'totals' => $totals,
        'days_count' => count($rows)
    ];
}

// POST create a report with AI highlights
if ($method === 'POST' && $action === 'create') {
    $brandId = bodyGet('brand_id', '');
    $reportType = bodyGet('report_type', ''); // 'weekly' or 'monthly'
    $startDate = bodyGet('start_date', '');
    $endDate = bodyGet('end_date', '');
    
    if (!$brandId || !$reportType || !$startDate || !$endDate) {
        json_err('brand_id, report_type, start_date, and end_date required');
    }
    
    $brand = dbGet('SELECT name, slug FROM brands WHERE id=?', [$brandId]);
    if (!$brand || !canAccessBrand($user, $brand['slug'])) json_err('Access denied', 403);
    
    // 1. Aggregate stats for the current period
    $currentStats = aggregateStats($brandId, $startDate, $endDate);
    
    // 2. Fetch data from the previous period of equal length for WoW / MoM calculations
    $startDt = new DateTime($startDate);
    $endDt = new DateTime($endDate);
    $diffDays = (int)$startDt->diff($endDt)->days + 1;
    
    $prevEndDt = clone $startDt;
    $prevEndDt->modify('-1 day');
    $prevStartDt = clone $prevEndDt;
    $prevStartDt->modify('-' . ($diffDays - 1) . ' days');
    
    $prevStartDateStr = $prevStartDt->format('Y-m-d');
    $prevEndDateStr = $prevEndDt->format('Y-m-d');
    $prevStats = aggregateStats($brandId, $prevStartDateStr, $prevEndDateStr);
    
    // Calculate WoW Percentage Changes — null when no prior data exists
    $pctChange = function($curr, $prev) {
        if ($prev <= 0) return null;
        return round((($curr - $prev) / $prev) * 100, 1);
    };
    
    $comparisons = [
        'spend' => $pctChange($currentStats['totals']['spend'], $prevStats['totals']['spend']),
        'revenue' => $pctChange($currentStats['totals']['revenue'], $prevStats['totals']['revenue']),
        'conversions' => $pctChange($currentStats['totals']['conversions'], $prevStats['totals']['conversions']),
        'roas' => $pctChange($currentStats['totals']['roas'], $prevStats['totals']['roas']),
        'cpa' => $pctChange($currentStats['totals']['cpa'], $prevStats['totals']['cpa']),
        'aov' => $pctChange($currentStats['totals']['aov'], $prevStats['totals']['aov']),
    ];
    
    // 3. Query AI to generate highlights summary
    $aiHighlights = ['highlights' => '', 'blockers' => '', 'next_steps' => ''];
    try {
        $systemMsg = "You are a professional performance marketing dashboard. Analyze the data and generate short summary notes. Respond ONLY in valid JSON format matching this schema: {\"highlights\": \"HTML bullet points of what went well\", \"blockers\": \"HTML bullet points of performance blockers or concerns\", \"next_steps\": \"HTML bullet points of next actions\"}. Do not write any markdown fences or surrounding text, just the raw JSON.";
        
        $userMsg = "Brand: {$brand['name']}\n";
        $userMsg .= "Report Type: " . ucfirst($reportType) . "\n";
        $userMsg .= "Period: {$startDate} to {$endDate}\n\n";
        $userMsg .= "Current Period Stats:\n";
        $userMsg .= "- Total Spend: ₹" . number_format($currentStats['totals']['spend']) . " (WoW: {$comparisons['spend']}%)\n";
        $userMsg .= "- Total Revenue: ₹" . number_format($currentStats['totals']['revenue']) . " (WoW: {$comparisons['revenue']}%)\n";
        $userMsg .= "- Blended ROAS: {$currentStats['totals']['roas']}x (WoW: {$comparisons['roas']}%)\n";
        $userMsg .= "- No of Orders: {$currentStats['totals']['conversions']} (WoW: {$comparisons['conversions']}%)\n";
        $userMsg .= "- Blended CPA: ₹{$currentStats['totals']['cpa']} (WoW: {$comparisons['cpa']}%)\n";
        $userMsg .= "- Blended AOV: ₹{$currentStats['totals']['aov']} (WoW: {$comparisons['aov']}%)\n\n";
        $userMsg .= "Channel Metrics:\n";
        foreach ($currentStats['channels'] as $cName => $metrics) {
            $userMsg .= "- " . ucfirst($cName) . ": Spend ₹" . number_format($metrics['spend']) . ", Revenue ₹" . number_format($metrics['revenue']) . ", ROAS {$metrics['roas']}x, Orders {$metrics['conversions']}, CPA ₹{$metrics['cpa']}\n";
        }
        
        $aiResult = callJSON($systemMsg, $userMsg);
        if (isset($aiResult['highlights'])) $aiHighlights['highlights'] = $aiResult['highlights'];
        if (isset($aiResult['blockers'])) $aiHighlights['blockers'] = $aiResult['blockers'];
        if (isset($aiResult['next_steps'])) $aiHighlights['next_steps'] = $aiResult['next_steps'];
    } catch (Throwable $e) {
        // Fallback default summaries if AI fails or key is missing
        $aiHighlights['highlights'] = "• Campaign generated total revenue of ₹" . number_format($currentStats['totals']['revenue']) . " with a blended ROAS of {$currentStats['totals']['roas']}x.<br>• Ad spend was managed at ₹" . number_format($currentStats['totals']['spend']) . ".";
        $aiHighlights['blockers'] = "• No significant blockers identified in the automated scan.";
        $aiHighlights['next_steps'] = "• Monitor blended CPA (currently ₹" . number_format($currentStats['totals']['cpa']) . ") to optimize audience targets.<br>• Adjust high-performing channel budgets.";
    }
    
    // 4. Generate unique client token
    $safeBrandName = preg_replace('/[^A-Za-z0-9]+/', '-', $brand['name']);
    $safeBrandName = trim($safeBrandName, '-');
    
    if ($reportType === 'monthly') {
        $monthName = date('F', strtotime($startDate));
        $year = date('Y', strtotime($startDate));
        $uniqueToken = "digifyce-{$safeBrandName}-{$monthName}-{$year}";
    } else {
        $uniqueToken = "digifyce-{$safeBrandName}-{$startDate}-{$endDate}";
    }
    
    $sharedLink = 'report_' . $uniqueToken;
    
    // 5. Store report
    $reportId = uuid4();
    $reportData = [
        'type' => $reportType,
        'period_start' => $startDate,
        'period_end' => $endDate,
        'channels' => $currentStats['channels'],
        'totals' => $currentStats['totals'],
        'comparisons' => $comparisons,
        'prev_period' => [
            'start' => $prevStartDateStr,
            'end' => $prevEndDateStr,
            'totals' => $prevStats['totals']
        ]
    ];
    
    // UPSERT LOGIC
    // Check if report already exists for this exact period and type
    $existing = dbGet('SELECT id FROM reports WHERE brand_id=? AND period_start=? AND period_end=? AND report_type=?', 
        [$brandId, $startDate, $endDate, $reportType]);
        
    if ($existing) {
        $reportId = $existing['id'];
        dbRun('UPDATE reports SET total_spend=?, total_conversions=?, total_revenue=?, overall_cpa=?, overall_roas=?, overall_aov=?, report_data=?, shared_link=?, highlights=?, blockers=?, next_steps=? WHERE id=?',
            [
                $currentStats['totals']['spend'],
                $currentStats['totals']['conversions'],
                $currentStats['totals']['revenue'],
                $currentStats['totals']['cpa'],
                $currentStats['totals']['roas'],
                $currentStats['totals']['aov'],
                json_encode($reportData),
                $sharedLink,
                $aiHighlights['highlights'],
                $aiHighlights['blockers'],
                $aiHighlights['next_steps'],
                $reportId
            ]);
            
        // Make sure the link exists or update token if needed
        $existingLink = dbGet('SELECT id FROM report_links WHERE report_id=?', [$reportId]);
        if ($existingLink) {
            dbRun('UPDATE report_links SET unique_token=? WHERE report_id=?', [$uniqueToken, $reportId]);
        } else {
            dbRun('INSERT INTO report_links (id, report_id, unique_token) VALUES (?,?,?)', [uuid4(), $reportId, $uniqueToken]);
        }
    } else {
        dbRun('INSERT INTO reports (id, brand_id, report_type, period_start, period_end, total_spend, total_conversions, total_revenue, overall_cpa, overall_roas, overall_aov, report_data, shared_link, highlights, blockers, next_steps, created_by) 
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [
                $reportId,
                $brandId,
                $reportType,
                $startDate,
                $endDate,
                $currentStats['totals']['spend'],
                $currentStats['totals']['conversions'],
                $currentStats['totals']['revenue'],
                $currentStats['totals']['cpa'],
                $currentStats['totals']['roas'],
                $currentStats['totals']['aov'],
                json_encode($reportData),
                $sharedLink,
                $aiHighlights['highlights'],
                $aiHighlights['blockers'],
                $aiHighlights['next_steps'],
                $user['name']
            ]);
            
        // Insert into report_links
        dbRun('INSERT INTO report_links (id, report_id, unique_token) VALUES (?,?,?)', [uuid4(), $reportId, $uniqueToken]);
    }
    
    auditLog($user['id'], $user['name'], 'REPORT_GENERATE', "{$brand['name']} - {$startDate} to {$endDate}");
    
    json_out(['ok' => true, 'report_id' => $reportId]);
}

// GET view report details
if ($method === 'GET' && $action === 'view') {
    $id = $_GET['id'] ?? '';
    if (!$id) json_err('Report ID required');
    
    $report = dbGet('SELECT r.*, rl.unique_token, rl.view_count, b.name as brand_name, b.slug as brand_slug 
                    FROM reports r 
                    JOIN brands b ON b.id = r.brand_id
                    LEFT JOIN report_links rl ON rl.report_id = r.id 
                    WHERE r.id = ?', [$id]);
                    
    if (!$report || !canAccessBrand($user, $report['brand_slug'])) json_err('Access denied', 403);
    
    $report['report_data'] = json_decode($report['report_data'] ?? '{}', true);
    json_out($report);
}

// POST update report performance data (channelwise & overall totals)
if ($method === 'POST' && $action === 'update_data') {
    $reportId = bodyGet('report_id', '');
    $channelsInput = bodyGet('channels', []);
    $totalsInput = bodyGet('totals', []);
    
    if (!$reportId) json_err('Report ID required');
    if (empty($channelsInput) || empty($totalsInput)) json_err('Channels and Totals data required');
    
    // Retrieve report and verify access
    $report = dbGet('SELECT r.*, b.slug, b.name as brand_name FROM reports r JOIN brands b ON b.id = r.brand_id WHERE r.id=?', [$reportId]);
    if (!$report || !canAccessBrand($user, $report['slug'])) json_err('Access denied', 403);
    
    $reportData = json_decode($report['report_data'] ?? '{}', true);
    
    // Update channels and totals in the report JSON
    $reportData['channels'] = $channelsInput;
    $reportData['totals'] = $totalsInput;
    
    // Recalculate WoW / MoM Comparisons based on new totals and previous period totals
    $prevTotals = $reportData['prev_period']['totals'] ?? [];
    
    $pctChange = function($curr, $prev) {
        if ($prev <= 0) return null;
        return round((($curr - $prev) / $prev) * 100, 1);
    };

    $comparisons = [
        'spend' => $pctChange($totalsInput['spend'] ?? 0, $prevTotals['spend'] ?? 0),
        'revenue' => $pctChange($totalsInput['revenue'] ?? 0, $prevTotals['revenue'] ?? 0),
        'conversions' => $pctChange($totalsInput['conversions'] ?? 0, $prevTotals['conversions'] ?? 0),
        'roas' => $pctChange($totalsInput['roas'] ?? 0, $prevTotals['roas'] ?? 0),
        'cpa' => $pctChange($totalsInput['cpa'] ?? 0, $prevTotals['cpa'] ?? 0),
        'aov' => $pctChange($totalsInput['aov'] ?? 0, $prevTotals['aov'] ?? 0),
    ];
    $reportData['comparisons'] = $comparisons;
    
    $reportDataJson = json_encode($reportData);
    
    // Update reports table
    dbRun('UPDATE reports SET total_spend=?, total_conversions=?, total_revenue=?, overall_cpa=?, overall_roas=?, overall_aov=?, report_data=? WHERE id=?',
        [
            $totalsInput['spend'] ?? 0,
            $totalsInput['conversions'] ?? 0,
            $totalsInput['revenue'] ?? 0,
            $totalsInput['cpa'] ?? 0,
            $totalsInput['roas'] ?? 0,
            $totalsInput['aov'] ?? 0,
            $reportDataJson,
            $reportId
        ]);
        
    // Also store manual override in report_manual_data table
    dbRun('INSERT INTO report_manual_data (report_id, channels_json, totals_json) VALUES (?,?,?) 
           ON DUPLICATE KEY UPDATE channels_json=VALUES(channels_json), totals_json=VALUES(totals_json)',
        [
            $reportId,
            json_encode($channelsInput),
            json_encode($totalsInput)
        ]);
        
    auditLog($user['id'], $user['name'], 'REPORT_EDIT', "{$report['brand_name']} - Report period: {$report['period_start']} to {$report['period_end']}");
    
    json_out(['ok' => true]);
}

// POST save notes overrides
if ($method === 'POST' && $action === 'save_notes') {
    $id = bodyGet('id', '');
    $hl = bodyGet('highlights', '');
    $bl = bodyGet('blockers', '');
    $ns = bodyGet('next_steps', '');
    
    if (!$id) json_err('Report ID required');
    
    $report = dbGet('SELECT r.brand_id, b.slug FROM reports r JOIN brands b ON b.id = r.brand_id WHERE r.id=?', [$id]);
    if (!$report || !canAccessBrand($user, $report['slug'])) json_err('Access denied', 403);
    
    dbRun('UPDATE reports SET highlights=?, blockers=?, next_steps=? WHERE id=?', [$hl, $bl, $ns, $id]);
    json_out(['ok' => true]);
}

// DELETE delete a report
if ($method === 'DELETE' && $action === 'delete') {
    $id = $_GET['id'] ?? '';
    if (!$id) json_err('Report ID required');
    
    $report = dbGet('SELECT r.brand_id, b.slug FROM reports r JOIN brands b ON b.id = r.brand_id WHERE r.id=?', [$id]);
    if (!$report || !canAccessBrand($user, $report['slug'])) json_err('Access denied', 403);
    
    dbRun('DELETE FROM reports WHERE id=?', [$id]);
    json_out(['ok' => true]);
}

json_err('Not found', 404);
