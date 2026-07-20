<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/ai.php';

$user   = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Default reference dropdown options extracted from template
$DEFAULT_DROPDOWNS = [
    'content_styles' => [
        'Product Demonstration', 'UGC / Problem–Solution', 'UGC / Product Demo', 
        'Lifestyle UGC', 'Lifestyle Reel', 'Educational Reel', 'Comparison Reel', 
        'Before-and-After Demo', 'Transformation Reel', 'Product Tutorial', 
        'Product Explainer', 'Product Showcase', 'Split-Screen Demo'
    ],
    'creative_angles' => [
        'Problem–Solution', 'Product Demonstration', 'Before-and-After', 'UGC', 
        'Founder Story', 'Customer Testimonial', 'Ingredient Education', 
        'Product Education', 'Recipe / Preparation', 'Comparison', 'Lifestyle', 
        'Convenience', 'Price and Value', 'Offer-Led', 'Social Proof', 'Expert Explanation'
    ],
    'website_areas' => [
        'Home Page', 'Product Page', 'Collection Page', 'Landing Page', 
        'Bundle Page', 'Cart', 'Checkout', 'Navigation', 'Website Search', 'Mobile Website'
    ],
    'website_kpis' => [
        'Conversion Rate', 'Add-to-Cart Rate', 'Cart-to-Checkout Rate', 'Checkout Conversion Rate', 
        'Average Order Value', 'Bounce Rate', 'Product-Page Click Rate', 'Homepage Click-Through Rate', 
        'Cart Abandonment Rate', 'Checkout Abandonment Rate', 'Lead Form Completion Rate'
    ],
    'retention_types' => [
        'Scheduled Campaign', 'Behavioural Automation', 'Transactional Automation', 
        'Replenishment Automation', 'Post-Purchase Flow', 'Win-Back Flow', 
        'Community Activity', 'Product Launch', 'Seasonal Campaign'
    ],
    'retention_rfm' => [
        'Prospects', 'Promising', 'Active', 'Loyal', 'Champions', 
        'Needs attention', 'Almost lost', 'At risk', 'Previously loyal', 'Dormant'
    ],
    'retention_channels' => [
        'Email Campaign', 'Email Automation', 'Email Newsletter', 'WhatsApp Business Message', 
        'WhatsApp Broadcast', 'WhatsApp Channel', 'SMS', 'RCS Business Message', 'Telegram Channel'
    ],
    'team_roles' => [
        'Media Buyer', 'Website Developer', 'Shopify Developer', 'UI/UX Designer', 
        'Copywriter', 'Tracking Team', 'Creative Team', 'Product Team', 'Account Manager', 
        'Retention Team', 'Email Marketing Team', 'WhatsApp Marketing Team', 'Designer', 'Video Editor'
    ],
    'statuses' => [
        'Planned', 'Draft', 'Brief Ready', 'Assigned', 'In Production', 
        'Review Pending', 'Revision Required', 'Approved', 'Delivered', 'Live', 'Testing', 'Completed', 'Paused'
    ]
];

// Helper: Get merged dropdowns for a brand
function getPoaDropdowns($brandId = null) {
    global $DEFAULT_DROPDOWNS;
    $out = $DEFAULT_DROPDOWNS;

    $rows = dbAll("SELECT list_category, item_value FROM poa_dropdown_lists WHERE (brand_id IS NULL OR brand_id = ?) AND is_active = 1 ORDER BY sort_order ASC, item_value ASC", [$brandId ?: '']);
    foreach ($rows as $r) {
        $cat = $r['list_category'];
        $val = $r['item_value'];
        if (!isset($out[$cat])) $out[$cat] = [];
        if (!in_array($val, $out[$cat])) {
            $out[$cat][] = $val;
        }
    }
    return $out;
}

// ── GET /api/poa.php?action=brand_context ──────────────────────────────────────
if ($method === 'GET' && $action === 'brand_context') {
    $brandId = $_GET['brand_id'] ?? '';
    $month   = $_GET['month'] ?? date('Y-m');
    if (!$brandId) json_err("Brand ID required");

    $brand = dbGet("SELECT * FROM brands WHERE id = ?", [$brandId]);
    if (!$brand) json_err("Brand not found");

    $parts = explode('-', $month);
    $yVal  = (int)($parts[0] ?? date('Y'));
    $mVal  = (int)($parts[1] ?? date('m'));

    $budgetMonth = dbGet("SELECT * FROM budget_months WHERE brand_id = ? AND year = ? AND month = ? LIMIT 1", [$brandId, $yVal, $mVal]);
    if (!$budgetMonth) {
        $budgetMonth = dbGet("SELECT * FROM budget_months WHERE brand_id = ? ORDER BY year DESC, month DESC LIMIT 1", [$brandId]);
    }

    $targetRevenue = (float)($budgetMonth['revenue_target'] ?? 400000);
    $targetRoas    = (float)($budgetMonth['overall_roas'] ?? 3.5);
    $targetBudget  = $targetRoas > 0 ? round($targetRevenue / $targetRoas, 2) : 100000;

    // Calculate actuals to date if budget month exists
    $actualSales = 0;
    $actualSpend = 0;
    if ($budgetMonth) {
        $dayRows = dbAll("SELECT * FROM budget_days WHERE month_id = ?", [$budgetMonth['id']]);
        foreach ($dayRows as $dr) {
            $chData = json_decode($dr['channels_json'] ?? '{}', true);
            foreach ($chData as $chVals) {
                if (isset($chVals['sales'])) $actualSales += (float)$chVals['sales'];
                if (isset($chVals['spend'])) $actualSpend += (float)$chVals['spend'];
            }
            // Legacy fallbacks
            $actualSales += (float)($dr['meta_sales'] ?? 0) + (float)($dr['google_sales'] ?? 0) + (float)($dr['mp_sales'] ?? 0) + (float)($dr['ret_sales'] ?? 0);
            $actualSpend += (float)($dr['meta_spend'] ?? 0) + (float)($dr['google_spend'] ?? 0) + (float)($dr['mp_spend'] ?? 0) + (float)($dr['ret_spend'] ?? 0);
        }
    }

    // Products catalog
    $productRows = dbAll("SELECT DISTINCT product_name FROM pricing_logs WHERE brand_id = ? AND product_name != '' LIMIT 10", [$brandId]);
    $products = array_column($productRows, 'product_name');
    if (empty($products)) $products = ['Hero Product A', 'Bestseller Combo B', 'Trial Pack C'];

    // Consultant Intelligence
    $intel = dbGet("SELECT * FROM consultant_generations WHERE brand_id = ? ORDER BY created_at DESC LIMIT 1", [$brandId]);
    $crawled = json_decode($intel['crawled_json'] ?? '{}', true);

    json_out([
        'ok'             => true,
        'brand_id'       => $brandId,
        'brand_name'     => $brand['name'],
        'month'          => $month,
        'target_revenue' => $targetRevenue,
        'target_budget'  => $targetBudget,
        'target_roas'    => $targetRoas,
        'actual_sales'   => round($actualSales, 2),
        'actual_spend'   => round($actualSpend, 2),
        'products'       => $products,
        'category'       => $crawled['brand_overview']['category'] ?? 'D2C Ecommerce',
        'mission'        => $crawled['brand_overview']['mission']  ?? 'Premium D2C Quality'
    ]);
}

// ── GET /api/poa.php?action=list ─────────────────────────────────────────────
if ($method === 'GET' && $action === 'list') {
    $brandId = $_GET['brand_id'] ?? '';
    $where  = "";
    $params = [];
    if ($brandId) {
        $where = "WHERE brand_id = ?";
        $params[] = $brandId;
    }
    $rows = dbAll("SELECT id, brand_id, brand_name, poa_month, status, created_by, created_at, updated_at FROM poa_generations $where ORDER BY poa_month DESC, created_at DESC", $params);
    json_out(['ok' => true, 'list' => $rows]);
}

// ── GET /api/poa.php?action=load ─────────────────────────────────────────────
if ($method === 'GET' && $action === 'load') {
    $id      = $_GET['id'] ?? '';
    $brandId = $_GET['brand_id'] ?? '';
    $month   = $_GET['month'] ?? '';

    if ($id) {
        $poa = dbGet("SELECT * FROM poa_generations WHERE id = ?", [$id]);
    } else if ($brandId && $month) {
        $poa = dbGet("SELECT * FROM poa_generations WHERE brand_id = ? AND poa_month = ? ORDER BY created_at DESC LIMIT 1", [$brandId, $month]);
    } else {
        json_err("ID or brand_id and month required");
    }

    if (!$poa) {
        json_out(['ok' => true, 'empty' => true]);
    }

    json_out([
        'ok'                 => true,
        'id'                 => $poa['id'],
        'brand_id'           => $poa['brand_id'],
        'brand_name'         => $poa['brand_name'],
        'poa_month'          => $poa['poa_month'],
        'overview'           => json_decode($poa['overview_json']      ?: '{}', true),
        'communication'      => json_decode($poa['communication_json'] ?: '[]', true),
        'competitors'        => json_decode($poa['competitors_json']   ?: '[]', true),
        'website'            => json_decode($poa['website_json']       ?: '[]', true),
        'creative'           => json_decode($poa['creative_json']      ?: '[]', true),
        'retention'          => json_decode($poa['retention_json']     ?: '[]', true),
        'status'             => $poa['status'],
        'created_by'         => $poa['created_by'],
        'created_at'         => $poa['created_at'],
        'updated_at'         => $poa['updated_at'],
    ]);
}

// ── GET /api/poa.php?action=dropdowns ────────────────────────────────────────
if ($method === 'GET' && $action === 'dropdowns') {
    $brandId = $_GET['brand_id'] ?? null;
    json_out([
        'ok'        => true,
        'dropdowns' => getPoaDropdowns($brandId)
    ]);
}

// ── POST /api/poa.php?action=save_dropdowns ──────────────────────────────────
if ($method === 'POST' && $action === 'save_dropdowns') {
    $b        = body();
    $brandId  = $b['brand_id'] ?? null;
    $category = trim($b['category'] ?? '');
    $value    = trim($b['value'] ?? '');

    if (!$category || !$value) json_err("Category and value required");

    $id = uuid4();
    dbRun("INSERT INTO poa_dropdown_lists (id, brand_id, list_category, item_value, is_active) VALUES (?, ?, ?, ?, 1)", [$id, $brandId, $category, $value]);

    json_out(['ok' => true, 'id' => $id, 'dropdowns' => getPoaDropdowns($brandId)]);
}

// ── POST /api/poa.php?action=save ────────────────────────────────────────────
if ($method === 'POST' && $action === 'save') {
    $b             = body();
    $poaId         = $b['id'] ?? '';
    $brandId       = $b['brand_id'] ?? '';
    $brandName     = $b['brand_name'] ?? '';
    $poaMonth      = $b['poa_month'] ?? date('Y-m');
    $overview      = is_array($b['overview'] ?? null)      ? json_encode($b['overview'])      : '{}';
    $communication = is_array($b['communication'] ?? null) ? json_encode($b['communication']) : '[]';
    $competitors   = is_array($b['competitors'] ?? null)   ? json_encode($b['competitors'])   : '[]';
    $website       = is_array($b['website'] ?? null)       ? json_encode($b['website'])       : '[]';
    $creative      = is_array($b['creative'] ?? null)      ? json_encode($b['creative'])      : '[]';
    $retention     = is_array($b['retention'] ?? null)     ? json_encode($b['retention'])     : '[]';

    if (!$brandId) json_err("Brand ID is required");

    if ($poaId) {
        $existing = dbGet("SELECT id FROM poa_generations WHERE id = ?", [$poaId]);
        if ($existing) {
            dbRun("UPDATE poa_generations SET brand_name=?, poa_month=?, overview_json=?, communication_json=?, competitors_json=?, website_json=?, creative_json=?, retention_json=?, updated_at=NOW() WHERE id=?", 
                [$brandName, $poaMonth, $overview, $communication, $competitors, $website, $creative, $retention, $poaId]);
            json_out(['ok' => true, 'id' => $poaId]);
        }
    }

    $newId = uuid4();
    dbRun("INSERT INTO poa_generations (id, brand_id, brand_name, poa_month, overview_json, communication_json, competitors_json, website_json, creative_json, retention_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [$newId, $brandId, $brandName, $poaMonth, $overview, $communication, $competitors, $website, $creative, $retention, $user['name'] ?? 'System']);

    json_out(['ok' => true, 'id' => $newId]);
}

// ── POST /api/poa.php?action=generate ─────────────────────────────────────────
if ($method === 'POST' && $action === 'generate') {
    $b        = body();
    $brandIds = $b['brand_ids'] ?? [];
    $month    = $b['month'] ?? date('Y-m');

    if (empty($brandIds)) json_err("Select at least one brand to generate POA");

    $results = [];
    $parts = explode('-', $month);
    $yVal  = (int)($parts[0] ?? date('Y'));
    $mVal  = (int)($parts[1] ?? date('m'));

    foreach ($brandIds as $brandId) {
        $brand = dbGet("SELECT * FROM brands WHERE id = ?", [$brandId]);
        if (!$brand) continue;

        // 1. Ingest actual brand sales numbers & monthly budget
        $budgetMonth = dbGet("SELECT * FROM budget_months WHERE brand_id = ? AND year = ? AND month = ? LIMIT 1", [$brandId, $yVal, $mVal]);
        if (!$budgetMonth) {
            $budgetMonth = dbGet("SELECT * FROM budget_months WHERE brand_id = ? ORDER BY year DESC, month DESC LIMIT 1", [$brandId]);
        }

        $targetRevenue = (float)($b['override_target_revenue'] ?? $budgetMonth['revenue_target'] ?? 400000);
        $targetRoas    = (float)($b['override_target_roas']    ?? $budgetMonth['overall_roas']   ?? 3.5);
        $targetBudget  = $targetRoas > 0 ? round($targetRevenue / $targetRoas, 2) : 100000;

        // Actual sales & spend calculations from budget_days
        $actualSales = 0;
        $actualSpend = 0;
        if ($budgetMonth) {
            $dayRows = dbAll("SELECT * FROM budget_days WHERE month_id = ?", [$budgetMonth['id']]);
            foreach ($dayRows as $dr) {
                $chData = json_decode($dr['channels_json'] ?? '{}', true);
                foreach ($chData as $chVals) {
                    if (isset($chVals['sales'])) $actualSales += (float)$chVals['sales'];
                    if (isset($chVals['spend'])) $actualSpend += (float)$chVals['spend'];
                }
                $actualSales += (float)($dr['meta_sales'] ?? 0) + (float)($dr['google_sales'] ?? 0) + (float)($dr['mp_sales'] ?? 0) + (float)($dr['ret_sales'] ?? 0);
                $actualSpend += (float)($dr['meta_spend'] ?? 0) + (float)($dr['google_spend'] ?? 0) + (float)($dr['mp_spend'] ?? 0) + (float)($dr['ret_spend'] ?? 0);
            }
        }

        // Product catalog ingestion
        $productRows = dbAll("SELECT DISTINCT product_name FROM pricing_logs WHERE brand_id = ? AND product_name != '' LIMIT 10", [$brandId]);
        $products = array_column($productRows, 'product_name');
        if (empty($products)) $products = ['Hero Product', 'Combo Pack', 'Starter Pack'];

        // Brand intelligence ingestion
        $intel = dbGet("SELECT * FROM consultant_generations WHERE brand_id = ? ORDER BY created_at DESC LIMIT 1", [$brandId]);
        $crawled = json_decode($intel['crawled_json'] ?? '{}', true);
        $dropdowns = getPoaDropdowns($brandId);

        $brandCategory = $crawled['brand_overview']['category'] ?? 'D2C Ecommerce';
        $brandMission  = $crawled['brand_overview']['mission']  ?? 'Premium D2C Quality';

        // Read user strategy brief inputs
        $bTone      = !empty($b['brand_tone']) ? $b['brand_tone'] : 'Empathetic, Warm & Trustworthy';
        $bOffer     = !empty($b['monthly_offer']) ? $b['monthly_offer'] : 'Special Monthly Combo Offer';
        $bProblems  = !empty($b['brand_problems']) ? $b['brand_problems'] : 'Meta CAC spike & mobile PDP drop-off';
        $bFixes     = !empty($b['desired_fixes']) ? $b['desired_fixes'] : 'Sticky Add-to-Cart bar on PDP & UGC video testing';
        $bAudience  = !empty($b['target_audience']) ? $b['target_audience'] : 'Target D2C Segment';
        $bPain      = !empty($b['pain_points']) ? $b['pain_points'] : 'Convenience and product quality concerns';
        $bComp      = !empty($b['competitors']) ? $b['competitors'] : 'Category Leader Competitors';

        if (!empty($b['focus_products'])) {
            $userProds = array_map('trim', explode(',', $b['focus_products']));
            if (!empty($userProds)) $products = array_merge($userProds, $products);
        }

        // 2. Build deep AI prompt
        $prompt = "You are a Senior D2C Growth Director and Media Buyer generating a 6-sheet Monthly Plan of Action (POA) for '{$brand['name']}' for {$month}.\n\n";
        $prompt .= "INGESTED BRAND METRICS & STRATEGY BRIEF:\n";
        $prompt .= "- Brand Name: {$brand['name']}\n";
        $prompt .= "- Category & Mission: {$brandCategory} · {$brandMission}\n";
        $prompt .= "- Communication Tone: {$bTone}\n";
        $prompt .= "- Target Monthly Revenue: ₹" . number_format($targetRevenue) . "\n";
        $prompt .= "- Target Monthly Ad Spend: ₹" . number_format($targetBudget) . "\n";
        $prompt .= "- Target Blended ROAS: " . number_format($targetRoas, 2) . "x\n";
        $prompt .= "- Monthly Hero Offer: {$bOffer}\n";
        $prompt .= "- CURRENT BRAND PROBLEMS / BOTTLENECKS: {$bProblems}\n";
        $prompt .= "- REQUIRED STRATEGIC FIXES & PRIORITIES: {$bFixes}\n";
        $prompt .= "- Primary Target Audience: {$bAudience}\n";
        $prompt .= "- Core Customer Pain Points: {$bPain}\n";
        $prompt .= "- Competitor Benchmarks: {$bComp}\n";
        $prompt .= "- Focus Catalog Products: " . implode(', ', array_unique($products)) . "\n\n";

        $prompt .= "Return ONLY a valid JSON object matching this exact structure:\n";
        $prompt .= "{\n";
        $prompt .= '  "overview": { "executive_summary": "...", "target_revenue": "...", "target_roas": "...", "primary_kpi": "Blended ROAS", "milestones": ["...", "..."], "team": { "Media Buyer": "...", "Copywriter": "..." } },' . "\n";
        $prompt .= '  "communication": [ { "product": "...", "priority": "High", "priority_reason": "Hero Product", "audience": "...", "pain_point": "...", "desired_action": "...", "value_prop": "...", "claims": "...", "angle": "...", "status": "Planned" } ],' . "\n";
        $prompt .= '  "competitors": [ { "competitor": "...", "product": "...", "offer": "...", "positioning": "...", "creative_angle": "...", "test_idea": "..." } ],' . "\n";
        $prompt .= '  "website": [ { "page_area": "Home Page", "problem": "...", "required_change": "...", "kpi_to_improve": "Conversion Rate", "priority": "High", "assigned_to": "Website Developer", "status": "Planned" } ],' . "\n";
        $prompt .= '  "creative": [ { "product": "...", "angle": "...", "content_style": "Product Demonstration", "hook_idea": "...", "offer": "...", "quantity": 3, "priority": "High", "assigned_to": "Creative Team", "status": "Planned" } ],' . "\n";
        $prompt .= '  "retention": [ { "campaign": "...", "campaign_type": "Scheduled Campaign", "trigger": "...", "rfm_segment": "Prospects", "objective": "First Purchase", "channel": "Email Campaign", "communication": "...", "status": "Planned" } ]' . "\n";
        $prompt .= "}\n";

        $systemPrompt = "You are Digifyce AI Media Buyer, specialized in creating hyper-personalized D2C growth POAs. Output only strict JSON without markdown formatting backticks.";

        $data = null;
        try {
            $raw = callAI($prompt, $systemPrompt, 0.4);
            $clean = trim(preg_replace('/^```json\s*|^```\s*|\s*```$/m', '', $raw));
            $data = json_decode($clean, true);
        } catch (Throwable $aiErr) {
            $data = null;
        }

        // Fallback personalized data generator if AI fails or returns empty
        if (!$data || !isset($data['overview'])) {
            $p1 = $products[0] ?? 'Hero Product';
            $p2 = $products[1] ?? 'Combo Pack';

            $data = [
                'overview' => [
                    'executive_summary' => "Monthly Growth Plan for {$brand['name']} targeting ₹" . number_format($targetRevenue) . " revenue at " . number_format($targetRoas, 2) . "x ROAS. Strategy directly addresses bottlenecks: '{$bProblems}' by deploying fixes: '{$bFixes}'. Tone: {$bTone}.",
                    'target_revenue' => "₹" . number_format($targetRevenue),
                    'target_roas' => number_format($targetRoas, 2) . "x",
                    'primary_kpi' => 'Blended ROAS',
                    'milestones' => [
                        "Scale Meta & Google ads to reach ₹" . number_format($targetBudget) . " spend target",
                        "Execute priority fix: {$bFixes}",
                        "Launch promo offer '{$bOffer}' to drive cold acquisition & AOV"
                    ],
                    'team' => [
                        'Media Buyer' => $b['team_lead'] ?? ($user['name'] ?? 'Media Team'),
                        'Copywriter' => 'Copywriting Team',
                        'Designer' => 'Creative Team',
                        'Shopify Developer' => 'Dev Team'
                    ]
                ],
                'communication' => [
                    [
                        'product' => $p1,
                        'priority' => 'High',
                        'priority_reason' => 'Hero Product',
                        'audience' => $bAudience,
                        'pain_point' => $bPain,
                        'desired_action' => 'Order Starter Pack with Offer',
                        'value_prop' => "100% Quality {$brandCategory}",
                        'claims' => 'Verified Quality / Verified Ingredients',
                        'angle' => 'Problem–Solution',
                        'status' => 'Planned'
                    ],
                    [
                        'product' => $p2,
                        'priority' => 'Medium',
                        'priority_reason' => 'AOV & Bundle Booster',
                        'audience' => 'Repeat & Bundle Buyers',
                        'pain_point' => 'High individual product cost',
                        'desired_action' => 'Upgrade to Combo Pack',
                        'value_prop' => 'Best Value Bundle Offer',
                        'claims' => 'Bundle Savings',
                        'angle' => 'Price and Value',
                        'status' => 'Planned'
                    ]
                ],
                'competitors' => [
                    [
                        'competitor' => $bComp,
                        'product' => 'Category Mix',
                        'offer' => 'Standard Category Discount',
                        'positioning' => 'Clean category positioning',
                        'creative_angle' => 'UGC / Product Demo',
                        'test_idea' => "Test 15-sec comparison reel highlighting {$brand['name']}'s unique benefit over {$bComp}"
                    ]
                ],
                'website' => [
                    [
                        'page_area' => 'Product Page',
                        'problem' => $bProblems,
                        'required_change' => $bFixes,
                        'kpi_to_improve' => 'Conversion Rate',
                        'priority' => 'High',
                        'assigned_to' => 'Shopify Developer',
                        'status' => 'Planned'
                    ]
                ],
                'creative' => [
                    [
                        'product' => $p1,
                        'angle' => 'Problem–Solution',
                        'content_style' => 'UGC / Product Demo',
                        'hook_idea' => "Tired of {$bPain}? Try {$p1} with {$bOffer}!",
                        'offer' => $bOffer,
                        'quantity' => (int)($b['creative_qty'] ?? 4),
                        'priority' => 'High',
                        'assigned_to' => 'Creative Team',
                        'status' => 'Planned'
                    ]
                ],
                'retention' => [
                    [
                        'campaign' => 'Post-Purchase Welcome Sequence',
                        'campaign_type' => 'Post-Purchase Flow',
                        'trigger' => 'Order Delivered',
                        'rfm_segment' => 'Prospects',
                        'objective' => 'Second Purchase',
                        'channel' => 'WhatsApp & Email',
                        'communication' => "Usage guide + {$bOffer} for 2nd order within 14 days",
                        'status' => 'Planned'
                    ]
                ]
            ];
        }

        // Save to DB
        $poaId = uuid4();
        dbRun("INSERT INTO poa_generations (id, brand_id, brand_name, poa_month, overview_json, communication_json, competitors_json, website_json, creative_json, retention_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [$poaId, $brandId, $brand['name'], $month, json_encode($data['overview']), json_encode($data['communication']), json_encode($data['competitors']), json_encode($data['website']), json_encode($data['creative']), json_encode($data['retention']), $user['name'] ?? 'System']);

        $results[] = [
            'id'         => $poaId,
            'brand_id'   => $brandId,
            'brand_name' => $brand['name'],
            'poa_month'  => $month,
            'status'     => 'Generated'
        ];
    }

    json_out(['ok' => true, 'results' => $results]);
}

// ── GET /api/poa.php?action=export_xlsx ───────────────────────────────────────
if ($method === 'GET' && $action === 'export_xlsx') {
    $id = $_GET['id'] ?? '';
    if (!$id) json_err("POA ID required");

    $poa = dbGet("SELECT * FROM poa_generations WHERE id = ?", [$id]);
    if (!$poa) json_err("POA not found", 404);

    $brandName = $poa['brand_name'];
    $month     = $poa['poa_month'];
    $overview  = json_decode($poa['overview_json']      ?: '{}', true);
    $comm      = json_decode($poa['communication_json'] ?: '[]', true);
    $comp      = json_decode($poa['competitors_json']   ?: '[]', true);
    $web       = json_decode($poa['website_json']       ?: '[]', true);
    $creat     = json_decode($poa['creative_json']      ?: '[]', true);
    $ret       = json_decode($poa['retention_json']     ?: '[]', true);

    $filename = "Media_Buyer_POA_" . preg_replace('/\s+/', '_', $brandName) . "_" . $month . ".xls";

    header("Content-Type: application/vnd.ms-excel; charset=utf-8");
    header("Content-Disposition: attachment; filename=\"$filename\"");
    header("Cache-Control: max-age=0");

    echo '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
    echo '<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8">';
    echo '<style>
        body { font-family: Calibri, Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
        th { background-color: #0B192C; color: #FFFFFF; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #1E293B; font-size: 11pt; }
        td { padding: 6px; border: 1px solid #CBD5E1; font-size: 10pt; vertical-align: top; }
        .title-hdr { background-color: #1E293B; color: #FFFFFF; font-size: 16pt; font-weight: bold; padding: 12px; text-align: center; }
        .sec-hdr { background-color: #2B4EFF; color: #FFFFFF; font-size: 12pt; font-weight: bold; padding: 6px; }
    </style></head><body>';

    // SHEET 1: Overview
    echo '<table>';
    echo '<tr><td colspan="4" class="title-hdr">MONTHLY MEDIA BUYER PLAN OF ACTION — ' . htmlspecialchars($brandName) . ' (' . htmlspecialchars($month) . ')</td></tr>';
    echo '<tr><td colspan="4" class="sec-hdr">EXECUTIVE SUMMARY</td></tr>';
    echo '<tr><td colspan="4">' . nl2br(htmlspecialchars($overview['executive_summary'] ?? 'N/A')) . '</td></tr>';
    echo '<tr><td class="sec-hdr">Target Revenue</td><td>' . htmlspecialchars($overview['target_revenue'] ?? 'N/A') . '</td><td class="sec-hdr">Target ROAS</td><td>' . htmlspecialchars($overview['target_roas'] ?? 'N/A') . '</td></tr>';
    echo '</table>';

    // SHEET 2: Communication
    echo '<table>';
    echo '<tr><th colspan="9" class="sec-hdr">COMMUNICATION & MESSAGING PLAN</th></tr>';
    echo '<tr><th>Product</th><th>Priority</th><th>Audience</th><th>Pain Point</th><th>Desired Action</th><th>Value Prop</th><th>Key Claims</th><th>Angle</th><th>Status</th></tr>';
    foreach ($comm as $r) {
        echo '<tr>';
        echo '<td>' . htmlspecialchars($r['product'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['priority'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['audience'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['pain_point'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['desired_action'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['value_prop'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['claims'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['angle'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['status'] ?? 'Planned') . '</td>';
        echo '</tr>';
    }
    echo '</table>';

    // SHEET 3: Creative Plan
    echo '<table>';
    echo '<tr><th colspan="8" class="sec-hdr">CREATIVE PRODUCTION QUEUE</th></tr>';
    echo '<tr><th>Product</th><th>Creative Angle</th><th>Content Style</th><th>Hook / Idea</th><th>Offer</th><th>Qty</th><th>Assigned To</th><th>Status</th></tr>';
    foreach ($creat as $r) {
        echo '<tr>';
        echo '<td>' . htmlspecialchars($r['product'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['angle'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['content_style'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['hook_idea'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['offer'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['quantity'] ?? 1) . '</td>';
        echo '<td>' . htmlspecialchars($r['assigned_to'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['status'] ?? 'Planned') . '</td>';
        echo '</tr>';
    }
    echo '</table>';

    // SHEET 4: Website Changes
    echo '<table>';
    echo '<tr><th colspan="7" class="sec-hdr">WEBSITE & CRO TASK BACKLOG</th></tr>';
    echo '<tr><th>Page / Area</th><th>Current Problem</th><th>Required Change</th><th>KPI to Improve</th><th>Priority</th><th>Assigned To</th><th>Status</th></tr>';
    foreach ($web as $r) {
        echo '<tr>';
        echo '<td>' . htmlspecialchars($r['page_area'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['problem'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['required_change'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['kpi_to_improve'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['priority'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['assigned_to'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['status'] ?? 'Planned') . '</td>';
        echo '</tr>';
    }
    echo '</table>';

    // SHEET 5: Retention Plan
    echo '<table>';
    echo '<tr><th colspan="7" class="sec-hdr">RETENTION & CRM CAMPAIGNS</th></tr>';
    echo '<tr><th>Campaign</th><th>Type</th><th>Trigger</th><th>RFM Segment</th><th>Channel</th><th>Communication</th><th>Status</th></tr>';
    foreach ($ret as $r) {
        echo '<tr>';
        echo '<td>' . htmlspecialchars($r['campaign'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['campaign_type'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['trigger'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['rfm_segment'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['channel'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['communication'] ?? '') . '</td>';
        echo '<td>' . htmlspecialchars($r['status'] ?? 'Planned') . '</td>';
        echo '</tr>';
    }
    echo '</table>';

    echo '</body></html>';
    exit;
}

json_err("Action not found", 404);
