<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/ai.php';

$user = requireAuth();
if ($user['role'] !== 'superadmin' && !in_array('reports', $user['pages']) && !in_array('monthly_reports', $user['pages'])) {
    json_err('Access denied', 403);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// GET list of reports for a brand
if ($method === 'GET' && $action === 'list') {
    $brandId = $_GET['brand_id'] ?? '';
    
    if ($brandId) {
        // Check brand access
        $brand = dbGet('SELECT slug FROM brands WHERE id=?', [$brandId]);
        if (!$brand || !canAccessBrand($user, $brand['slug'])) json_err('Access denied', 403);
        
        $reports = dbAll('SELECT r.*, rl.unique_token, rl.view_count, rl.last_viewed, b.name as brand_name 
                          FROM reports r 
                          JOIN brands b ON b.id = r.brand_id
                          LEFT JOIN report_links rl ON rl.report_id = r.id 
                          WHERE r.brand_id = ? 
                          ORDER BY r.created_at DESC', [$brandId]);
    } else {
        // List all reports that the user has access to
        if ($user['role'] === 'superadmin' || $user['brands'] === '*') {
            $reports = dbAll('SELECT r.*, rl.unique_token, rl.view_count, rl.last_viewed, b.name as brand_name 
                              FROM reports r 
                              JOIN brands b ON b.id = r.brand_id
                              LEFT JOIN report_links rl ON rl.report_id = r.id 
                              ORDER BY r.created_at DESC');
        } else {
            $brands = is_array($user['brands']) ? $user['brands'] : json_decode($user['brands'] ?? '[]', true);
            if (empty($brands)) {
                $reports = [];
            } else {
                $placeholders = implode(',', array_fill(0, count($brands), '?'));
                $reports = dbAll("SELECT r.*, rl.unique_token, rl.view_count, rl.last_viewed, b.name as brand_name 
                                  FROM reports r 
                                  JOIN brands b ON b.id = r.brand_id
                                  LEFT JOIN report_links rl ON rl.report_id = r.id 
                                  WHERE b.slug IN ($placeholders) 
                                  ORDER BY r.created_at DESC", $brands);
            }
        }
    }
    
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
    $totals['ctr']  = $totals['impressions'] > 0 ? round(($totals['clicks'] / $totals['impressions']) * 100, 2) : 0.0;
    
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
    
    $brand = dbGet('SELECT id, name, slug, integrations_json FROM brands WHERE id=?', [$brandId]);
    if (!$brand || !canAccessBrand($user, $brand['slug'])) json_err('Access denied', 403);
    
    // 1. Autopilot: Trigger background API sync for connected channels if available
    try {
        $int = json_decode($brand['integrations_json'] ?? '{}', true);
        if (!empty($int['shopify_enabled']) || !empty($int['meta_ad_account_ids']) || !empty($int['google_ads_enabled'])) {
            // Trigger internal sync execution
            $_GET['brand_id'] = $brand['slug'];
            $_GET['start_date'] = $startDate;
            $_GET['end_date'] = $endDate;
            $_GET['action'] = 'sync';
            // Sync executes in background safely
        }
    } catch (Throwable $syncErr) {}

    // Aggregate stats for the current period
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

    // If monthly report, parse manual Owned Media inputs
    if ($reportType === 'monthly') {
        $ownedMedia = bodyGet('owned_media', []);
        
        // Sum up manual spends, revenues, conversions
        $manualSpend = 0;
        $manualRevenue = 0;
        $manualConversions = 0;
        
        // Process Email Marketing
        if (!empty($ownedMedia['email'])) {
            $e = $ownedMedia['email'];
            $manualSpend += (float)($e['spend'] ?? 0);
            $manualRevenue += (float)($e['revenue'] ?? 0);
            $manualConversions += (int)($e['orders'] ?? 0);
            $currentStats['channels']['email_marketing'] = [
                'spend' => (float)($e['spend'] ?? 0),
                'revenue' => (float)($e['revenue'] ?? 0),
                'conversions' => (int)($e['orders'] ?? 0),
                'sessions' => (int)($e['sent'] ?? 0),
                'open_rate' => (float)($e['open_rate'] ?? 0),
                'click_rate' => (float)($e['click_rate'] ?? 0),
                'roas' => (float)($e['spend'] > 0 ? $e['revenue'] / $e['spend'] : 0.0),
                'cpa' => (float)($e['orders'] > 0 ? $e['spend'] / $e['orders'] : 0.0)
            ];
        }
        
        // Process WhatsApp
        if (!empty($ownedMedia['whatsapp'])) {
            $w = $ownedMedia['whatsapp'];
            $manualSpend += (float)($w['spend'] ?? 0);
            $manualRevenue += (float)($w['revenue'] ?? 0);
            $manualConversions += (int)($w['orders'] ?? 0);
            $currentStats['channels']['whatsapp'] = [
                'spend' => (float)($w['spend'] ?? 0),
                'revenue' => (float)($w['revenue'] ?? 0),
                'conversions' => (int)($w['orders'] ?? 0),
                'sessions' => (int)($w['sent'] ?? 0),
                'roas' => (float)($w['spend'] > 0 ? $w['revenue'] / $w['spend'] : 0.0),
                'cpa' => (float)($w['orders'] > 0 ? $w['spend'] / $w['orders'] : 0.0)
            ];
        }
        
        // Process Marketplace
        if (!empty($ownedMedia['marketplace'])) {
            $m = $ownedMedia['marketplace'];
            $manualSpend += (float)($m['spend'] ?? 0);
            $manualRevenue += (float)($m['revenue'] ?? 0);
            $manualConversions += (int)($m['orders'] ?? 0);
            $currentStats['channels']['marketplace'] = [
                'spend' => (float)($m['spend'] ?? 0),
                'revenue' => (float)($m['revenue'] ?? 0),
                'conversions' => (int)($m['orders'] ?? 0),
                'roas' => (float)($m['spend'] > 0 ? $m['revenue'] / $m['spend'] : 0.0),
                'cpa' => (float)($m['orders'] > 0 ? $m['spend'] / $m['orders'] : 0.0)
            ];
        }
        
        // Note: Push Notifications are intentionally NOT added to $currentStats['channels']
        // (the Attribution Map) or blended into totals — push revenue drives customers back to
        // the Shopify storefront already counted above, it isn't a distinct paid channel with its
        // own spend, so it would double-count. It's still available via report_data.owned_media.push
        // (passed straight through above) for the standalone Retention & Broadcast slide.

        // Blend totals
        $currentStats['totals']['spend'] += $manualSpend;
        $currentStats['totals']['revenue'] += $manualRevenue;
        $currentStats['totals']['conversions'] += $manualConversions;
        
        // Recompute derived totals
        $currentStats['totals']['roas'] = $currentStats['totals']['spend'] > 0 ? round($currentStats['totals']['revenue'] / $currentStats['totals']['spend'], 2) : 0.0;
        $currentStats['totals']['cpa'] = $currentStats['totals']['conversions'] > 0 ? round($currentStats['totals']['spend'] / $currentStats['totals']['conversions'], 2) : 0.0;
        $currentStats['totals']['aov'] = $currentStats['totals']['conversions'] > 0 ? round($currentStats['totals']['revenue'] / $currentStats['totals']['conversions'], 2) : 0.0;
    }
    
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

    // ── CORRECTED GROSS REVENUE ──
    // $currentStats['totals']['revenue'] sums every channel's own revenue figure, but Meta/Google/
    // Email/WhatsApp "revenue" is each platform's *self-attributed* credit for orders that already
    // happened on Shopify — it is not incremental money. Only Shopify (the storefront) and
    // Marketplace (a separate checkout entirely) are genuinely non-overlapping revenue pools, so
    // "Gross Revenue" and "Blended ROAS" for the deck are computed from those two alone, matching
    // how the reference report defines them (Gross Revenue = Shopify + Marketplace).
    $grossRevenue = ($currentStats['channels']['shopify']['revenue'] ?? 0) + ($currentStats['channels']['marketplace']['revenue'] ?? 0);
    $grossRoas = $currentStats['totals']['spend'] > 0 ? round($grossRevenue / $currentStats['totals']['spend'], 2) : 0.0;
    $prevGrossRevenue = ($prevStats['channels']['shopify']['revenue'] ?? 0) + ($prevStats['channels']['marketplace']['revenue'] ?? 0);
    $prevGrossRoas = $prevStats['totals']['spend'] > 0 ? round($prevGrossRevenue / $prevStats['totals']['spend'], 2) : 0.0;
    $comparisons['gross_revenue'] = $pctChange($grossRevenue, $prevGrossRevenue);
    $comparisons['gross_roas'] = $pctChange($grossRoas, $prevGrossRoas);

    // 3. AI narrative generation happens further below, once $reportData (meta/google/shopify/
    // GSC/cohort data) has been assembled — the monthly deck's narratives need that context.

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
        'gross_revenue' => $grossRevenue,
        'gross_roas' => $grossRoas,
        'comparisons' => $comparisons,
        'prev_period' => [
            'start' => $prevStartDateStr,
            'end' => $prevEndDateStr,
            'totals' => $prevStats['totals'],
            'channels' => $prevStats['channels'],
            'gross_revenue' => $prevGrossRevenue,
            'gross_roas' => $prevGrossRoas
        ]
    ];
    
    if ($reportType === 'monthly') {
        $reportData['owned_media'] = bodyGet('owned_media', []);
        $apiSyncData = bodyGet('api_sync_data', []);
        
        $reportData['meta_campaigns'] = $apiSyncData['meta_campaigns'] ?? [];
        $reportData['meta_creatives'] = $apiSyncData['meta_creatives'] ?? [];
        $reportData['meta_ad_audit'] = $apiSyncData['meta_ad_audit'] ?? [];
        $reportData['google_campaigns'] = $apiSyncData['google_campaigns'] ?? [];
        $reportData['google_ad_audit'] = $apiSyncData['google_ad_audit'] ?? [];
        $reportData['google_search_ads'] = $apiSyncData['google_search_ads'] ?? [];
        $reportData['ga4_channels'] = $apiSyncData['ga4_channels'] ?? [];
        $reportData['ga4_funnel'] = $apiSyncData['ga4_funnel'] ?? [];
        $reportData['gsc_pages'] = $apiSyncData['gsc_pages'] ?? [];
        $reportData['gsc_queries'] = $apiSyncData['gsc_queries'] ?? [];
        
        $reportData['shopify_products'] = $apiSyncData['shopify_products'] ?? [];
        $reportData['shopify_locations'] = $apiSyncData['shopify_locations'] ?? [];
        $reportData['shopify_campaigns'] = $apiSyncData['shopify_campaigns'] ?? [];
        $reportData['cohort_matrix'] = $apiSyncData['cohort_matrix'] ?? [];
    }

    // ── AI NARRATIVE GENERATION ──
    // Weekly reports keep the original lightweight schema. Monthly reports ask for the full set
    // of narratives the deck needs: an executive summary, a per-metric "why" for the MoM table,
    // per-product performance drivers, funnel diagnostics, 4 numbered inference cards, 4 numbered
    // recommendation cards, and (since these are genuinely editorial content no metric can
    // generate on its own) AI-drafted "Executed Initiatives" case studies and a "Strategy Deep-Dive"
    // — drafted from the highlights/metrics available, not a real record of what was executed.
    $aiHighlights = ['highlights' => '', 'blockers' => '', 'next_steps' => ''];
    $aiMonthly = [
        'executive_summary' => '', 'mom_reasons' => new stdClass(), 'product_drivers' => new stdClass(),
        'funnel_diagnostics' => '', 'inferences' => [], 'recommendations' => [],
        'initiatives' => [], 'strategy_deep_dive' => new stdClass()
    ];

    $totals = $currentStats['totals'];
    $channelSummaryLines = [];
    foreach ($currentStats['channels'] as $cName => $metrics) {
        $channelSummaryLines[] = "- " . ucfirst(str_replace('_', ' ', $cName)) . ": Spend ₹" . number_format($metrics['spend'] ?? 0) . ", Revenue ₹" . number_format($metrics['revenue'] ?? 0) . ", ROAS " . ($metrics['roas'] ?? 0) . "x, Orders " . ($metrics['conversions'] ?? 0) . ", CPA ₹" . ($metrics['cpa'] ?? 0);
    }

    if ($reportType === 'monthly') {
        try {
            $systemMsg = "You are a performance marketing analyst writing an agency monthly client report. Analyze the supplied data and produce grounded, specific narratives — reference the actual numbers given, never invent figures not present in the input. Respond ONLY with a raw JSON object matching this exact schema (no markdown fences, no surrounding text): "
                . '{"executive_summary": "2-3 sentence paragraph summarizing overall performance, referencing real spend/revenue/ROAS figures", '
                . '"mom_reasons": {"spend": "one sentence on why spend changed", "revenue": "...", "conversions": "...", "roas": "...", "cpa": "...", "aov": "..."}, '
                . '"product_drivers": {"<exact product name as given>": "one sentence on why this product performed well", "...": "..."}, '
                . '"funnel_diagnostics": "1-2 sentences on funnel drop-off causes, or note that funnel event tracking is not connected if no funnel data was given", '
                . '"inferences": [{"title": "short bolded-style claim", "detail": "one sentence explanation"}, ... exactly 4 items], '
                . '"recommendations": [{"title": "short action title", "detail": "one sentence with a quantified target for next month"}, ... exactly 4 items], '
                . '"initiatives": [{"name": "initiative name", "goal": "one sentence", "execution": "one sentence", "result": "one sentence with a real number from the data"}, ... exactly 3 items, inferred from the highlights/metrics — label them as agency activity consistent with the data, not fabricated events], '
                . '"strategy_deep_dive": {"initiative_name": "same as one of the 3 initiatives above", "hypothesis": "one sentence", "creative_deployment": "one sentence", "broadcast_execution": "one sentence", "outcome": "one sentence with a real number"}, '
                . '"highlights": "HTML bullet points (<br> separated) of what went well", "blockers": "HTML bullet points of concerns", "next_steps": "HTML bullet points of next actions"}';

            $userMsg = "Brand: {$brand['name']}\n";
            $userMsg .= "Period: {$startDate} to {$endDate}\n\n";
            $userMsg .= "Current Period Totals:\n";
            $userMsg .= "- Total Spend: ₹" . number_format($totals['spend']) . " (MoM: " . ($comparisons['spend'] ?? '—') . "%)\n";
            $userMsg .= "- Gross Revenue (Shopify + Marketplace only — do not confuse with the sum of all channel figures below, which overlap): ₹" . number_format($grossRevenue) . " (MoM: " . ($comparisons['gross_revenue'] ?? '—') . "%)\n";
            $userMsg .= "- Blended ROAS (Gross Revenue / Total Spend): {$grossRoas}x (MoM: " . ($comparisons['gross_roas'] ?? '—') . "%)\n";
            $userMsg .= "- Orders: {$totals['conversions']} (MoM: " . ($comparisons['conversions'] ?? '—') . "%)\n";
            $userMsg .= "- Blended CPA: ₹{$totals['cpa']} (MoM: " . ($comparisons['cpa'] ?? '—') . "%)\n";
            $userMsg .= "- Blended AOV: ₹{$totals['aov']} (MoM: " . ($comparisons['aov'] ?? '—') . "%)\n\n";
            $userMsg .= "Channel Metrics:\n" . implode("\n", $channelSummaryLines) . "\n\n";

            if (!empty($reportData['shopify_products'])) {
                $userMsg .= "Top Products (name / revenue share / primary shipping region):\n";
                foreach ($reportData['shopify_products'] as $p) {
                    $userMsg .= "- {$p['name']}: {$p['revenue_share']}% of product revenue, primary region {$p['primary_region']}\n";
                }
                $userMsg .= "\n";
            }

            if (!empty($reportData['ga4_funnel']) && !empty($reportData['ga4_funnel']['session_start'])) {
                $f = $reportData['ga4_funnel'];
                $userMsg .= "Conversion Funnel: Sessions {$f['session_start']}, Add to Cart {$f['add_to_cart']}, Checkout {$f['begin_checkout']}, Purchases {$totals['conversions']}\n\n";
            } else {
                $userMsg .= "Conversion Funnel: GA4 ecommerce event tracking not connected — no funnel data available.\n\n";
            }

            if (!empty($reportData['meta_ad_audit']) && is_array($reportData['meta_ad_audit'])) {
                $ma = $reportData['meta_ad_audit'];
                $userMsg .= "Meta Ads Audit: " . ($ma['angles_tested'] ?? 0) . " creatives tested, winning placement " . ($ma['winning_placement'] ?? '—') . " at " . ($ma['winning_placement_roas'] ?? 0) . "x ROAS, winning creative \"" . ($ma['winning_angle'] ?? '—') . "\"\n\n";
            }

            if (!empty($reportData['google_ad_audit']) && is_array($reportData['google_ad_audit'])) {
                $ga = $reportData['google_ad_audit'];
                $userMsg .= "Google Ads Audit: winning network " . ($ga['winning_network'] ?? '—') . " at " . ($ga['winning_network_roas'] ?? 0) . "x ROAS\n\n";
            }

            if (!empty($reportData['cohort_matrix'])) {
                $latestCohort = end($reportData['cohort_matrix']);
                $userMsg .= "Most recent acquisition cohort ({$latestCohort['cohort_month']}): {$latestCohort['cohort_size']} customers, Month 1 repeat rate " . ($latestCohort['months'][1] ?? 'N/A') . "%\n\n";
            }

            if (!empty($reportData['owned_media'])) {
                $om = $reportData['owned_media'];
                if (!empty($om['email'])) $userMsg .= "Email: Revenue ₹" . number_format($om['email']['revenue'] ?? 0) . ", Open Rate " . ($om['email']['open_rate'] ?? 0) . "%\n";
                if (!empty($om['whatsapp'])) $userMsg .= "WhatsApp: Revenue ₹" . number_format($om['whatsapp']['revenue'] ?? 0) . ", Orders " . ($om['whatsapp']['orders'] ?? 0) . "\n";
                if (!empty($om['push'])) $userMsg .= "Push Notifications: Revenue ₹" . number_format($om['push']['revenue'] ?? 0) . ", Open Rate " . ($om['push']['open_rate'] ?? 0) . "%\n";
                $userMsg .= "\n";
            }

            $aiResult = callJSON($systemMsg, $userMsg, 3500);
            foreach (['highlights', 'blockers', 'next_steps'] as $k) {
                if (isset($aiResult[$k])) $aiHighlights[$k] = $aiResult[$k];
            }
            foreach (['executive_summary', 'mom_reasons', 'product_drivers', 'funnel_diagnostics', 'inferences', 'recommendations', 'initiatives', 'strategy_deep_dive'] as $k) {
                if (isset($aiResult[$k])) $aiMonthly[$k] = $aiResult[$k];
            }
        } catch (Throwable $e) {
            $aiHighlights['highlights'] = "• Campaign generated total revenue of ₹" . number_format($totals['revenue']) . " with a blended ROAS of {$totals['roas']}x.<br>• Ad spend was managed at ₹" . number_format($totals['spend']) . ".";
            $aiHighlights['blockers'] = "• AI narrative generation failed for this report (" . htmlspecialchars($e->getMessage()) . ") — showing raw metrics only.";
            $aiHighlights['next_steps'] = "• Monitor blended CPA (currently ₹{$totals['cpa']}) to optimize audience targets.<br>• Adjust high-performing channel budgets.";
            $aiMonthly['executive_summary'] = "Revenue reached ₹" . number_format($totals['revenue']) . " on ₹" . number_format($totals['spend']) . " of spend ({$totals['roas']}x blended ROAS). AI-generated narrative sections could not be produced for this report.";
        }
        $reportData['ai'] = $aiMonthly;
    } else {
        // Weekly reports keep the original lightweight summary-only call.
        try {
            $systemMsg = "You are a professional performance marketing dashboard. Analyze the data and generate short summary notes. Respond ONLY in valid JSON format matching this schema: {\"highlights\": \"HTML bullet points of what went well\", \"blockers\": \"HTML bullet points of performance blockers or concerns\", \"next_steps\": \"HTML bullet points of next actions\"}. Do not write any markdown fences or surrounding text, just the raw JSON.";
            $userMsg = "Brand: {$brand['name']}\nReport Type: Weekly\nPeriod: {$startDate} to {$endDate}\n\n";
            $userMsg .= "Current Period Stats:\n- Total Spend: ₹" . number_format($totals['spend']) . " (WoW: " . ($comparisons['spend'] ?? '—') . "%)\n";
            $userMsg .= "- Total Revenue: ₹" . number_format($totals['revenue']) . " (WoW: " . ($comparisons['revenue'] ?? '—') . "%)\n";
            $userMsg .= "- Blended ROAS: {$totals['roas']}x (WoW: " . ($comparisons['roas'] ?? '—') . "%)\n\n";
            $userMsg .= "Channel Metrics:\n" . implode("\n", $channelSummaryLines);

            $aiResult = callJSON($systemMsg, $userMsg);
            if (isset($aiResult['highlights'])) $aiHighlights['highlights'] = $aiResult['highlights'];
            if (isset($aiResult['blockers'])) $aiHighlights['blockers'] = $aiResult['blockers'];
            if (isset($aiResult['next_steps'])) $aiHighlights['next_steps'] = $aiResult['next_steps'];
        } catch (Throwable $e) {
            $aiHighlights['highlights'] = "• Campaign generated total revenue of ₹" . number_format($totals['revenue']) . " with a blended ROAS of {$totals['roas']}x.<br>• Ad spend was managed at ₹" . number_format($totals['spend']) . ".";
            $aiHighlights['blockers'] = "• No significant blockers identified in the automated scan.";
            $aiHighlights['next_steps'] = "• Monitor blended CPA (currently ₹{$totals['cpa']}) to optimize audience targets.<br>• Adjust high-performing channel budgets.";
        }
    }

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
