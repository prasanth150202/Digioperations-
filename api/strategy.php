<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/ai.php';
ini_set('memory_limit', '512M');
set_time_limit(180);
$user   = requireAuth();
requirePage($user, 'strategy');
$method = $_SERVER['REQUEST_METHOD'];
$slug   = $_GET['brand'] ?? '';
$action = $_GET['action'] ?? '';

if (!$slug) json_err('Brand slug required');
if (!canAccessBrand($user, $slug)) json_err('Access denied', 403);
$brand = dbGet('SELECT * FROM brands WHERE slug=?', [$slug]);
if (!$brand) json_err('Brand not found', 404);

const SYS = 'You are a senior D2C growth strategist for Indian brands. Return ONLY valid JSON, no markdown, no preamble.';

function buildCtx(array $f): string {
    $g = fn($k) => !empty($f[$k]) ? $f[$k] : '—';
    return "BRAND: {$g('brandName')} | INDUSTRY: {$g('industry')} | PLATFORM: {$g('platform')}
TARGET AUDIENCE: {$g('targetAudience')} | PRICE RANGE: {$g('priceRange')}
AD BUDGET: {$g('adBudget')} | STRATEGY MONTH: {$g('strategyMonth')}
LAST MONTH REVENUE: {$g('lastRevenue')} | THIS MONTH TARGET: {$g('thisTarget')}
TARGET ROAS: {$g('targetROAS')} | TARGET CAC: {$g('targetCAC')}
CURRENT CAC: {$g('currentCAC')} | CURRENT CVR: {$g('currentCVR')}
PROBLEM: {$g('primaryProblem')} | WHAT FAILED: {$g('whatFailed')}
AI INSTRUCTIONS: {$g('aiInstructions')}
BRAND VOICE: {$g('brandVoice')} | TONE: {$g('communicationTone')}";
}

// GET memory
if ($method === 'GET' && $action === 'memory') {
    $mem = json_decode($brand['memory_json'] ?? '{}', true);
    json_out(['memory' => $mem]);
}

// PUT memory
if ($method === 'PUT' && $action === 'memory') {
    $existing = json_decode($brand['memory_json'] ?? '{}', true);
    $updates  = body();
    $memFields = ['brandName','industry','platform','websiteUrl','founderName','accountManager','accountEmail','accountPhone','targetAudience','priceRange','activeSince','activeChannels','brandVoice','communicationTone','brandColours','usps','personas'];
    foreach ($memFields as $f) { if (isset($updates[$f])) $existing[$f] = $updates[$f]; }
    dbRun('UPDATE brands SET memory_json=? WHERE id=?', [json_encode($existing), $brand['id']]);
    json_out(['ok' => true]);
}

// GET form for a month
if ($method === 'GET' && $action === 'form') {
    $month = $_GET['month'] ?? date('Y-m');
    $row = dbGet('SELECT form_json FROM strategy_generations WHERE brand_id=? AND strategy_month=? ORDER BY created_at DESC LIMIT 1', [$brand['id'], $month]);
    $form = $row ? json_decode($row['form_json'], true) : [];
    // Merge memory into form defaults
    $mem  = json_decode($brand['memory_json'] ?? '{}', true);
    foreach ($mem as $k => $v) { if (!isset($form[$k]) || $form[$k] === '') $form[$k] = $v; }
    json_out(['form' => $form]);
}

// PUT form
if ($method === 'PUT' && $action === 'form') {
    $formData = body();
    $month    = $formData['strategyMonth'] ?? date('Y-m');
    $existing = dbGet('SELECT id FROM strategy_generations WHERE brand_id=? AND strategy_month=?', [$brand['id'], $month]);
    if ($existing) {
        dbRun('UPDATE strategy_generations SET form_json=? WHERE id=?', [json_encode($formData), $existing['id']]);
    } else {
        dbRun('INSERT INTO strategy_generations (id,brand_id,strategy_month,form_json,ai_json,flags_json,ai_provider,ai_model,generated_by,generated_by_role) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [uuid4(), $brand['id'], $month, json_encode($formData), '{}', '[]', '', '', $user['name'], $user['role']]);
    }
    json_out(['ok' => true]);
}

// POST scrape
if ($method === 'POST' && $action === 'scrape') {
    $b = body();
    $url = trim($b['url'] ?? '');
    $igUrl = trim($b['instagramUrl'] ?? '');
    $ytUrl = trim($b['youtubeUrl'] ?? '');
    $otherUrl = trim($b['otherUrl'] ?? '');
    $customKnowledge = trim($b['customKnowledge'] ?? '');
    
    if (!$url) json_err('Website URL required');
    
    if (!preg_match('/^https?:\/\//i', $url)) {
        $url = 'https://' . $url;
    }
    
    try {
        $ctx = stream_context_create(['http' => [
            'method'  => 'GET',
            'header'  => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n",
            'timeout' => 15,
            'ignore_errors' => true
        ]]);
        $html = @file_get_contents($url, false, $ctx);
        if (!$html) {
            throw new Exception("Could not fetch website contents. Make sure the URL is public.");
        }
        
        $clean = preg_replace('/<(script|style|svg|noscript|iframe)[^>]*>.*?<\/\1>/is', '', $html);
        $clean = strip_tags($clean);
        $clean = preg_replace('/\s+/', ' ', $clean);
        $clean = substr($clean, 0, 8000); 
        
        $prompt = "You are a senior D2C growth strategist and brand auditor. We Crawled the homepage of a brand website. Here is the text content:\n\n$clean\n\n"
            . "Social media profiles provided:\n"
            . "- Instagram: " . ($igUrl ?: 'Not specified') . "\n"
            . "- YouTube: " . ($ytUrl ?: 'Not specified') . "\n"
            . "- Other Link: " . ($otherUrl ?: 'Not specified') . "\n\n"
            . "Custom brand knowledge pasted by the user (refer to this closely):\n"
            . ($customKnowledge ? "$customKnowledge" : "None") . "\n\n"
            . "Analyze all these sources and return a comprehensive, highly accurate JSON strategy blueprint. Return ONLY a valid JSON object with the following keys:\n"
            . "{\n"
            . "  \"brandName\": \"Extract the true Brand Name\",\n"
            . "  \"industry\": \"Niche or industry, e.g. D2C Fashion, Activewear, Beverage, Premium Cosmetics\",\n"
            . "  \"targetAudience\": \"Demographic & psychographic target profiles (e.g. urban gym-goers aged 20-35)\",\n"
            . "  \"heroProducts\": \"List 3-5 main or hero products/collections seen on the website or socials\",\n"
            . "  \"priceRange\": \"Estimate average price range (e.g. ₹999 - ₹2,499)\",\n"
            . "  \"brandVoice\": \"Brand voice definition (e.g. bold, authentic, raw)\",\n"
            . "  \"communicationTone\": \"Tone of voice, e.g. energetic, premium, highly technical\",\n"
            . "  \"usps\": \"Extract or deduce 3-5 main USPs (Unique Selling Propositions)\",\n"
            . "  \"personas\": \"List 3 highly tailored customer profiles (e.g. The Serious Lifter, The Weekend Runner)\",\n"
            . "  \"monthlyOffer\": \"Current promotional offer seen or a suggested high-converting offer (e.g. Buy 2 Get 1)\",\n"
            . "  \"monthlyTheme\": \"Suggest a strong monthly campaign theme\",\n"
            . "  \"adBudget\": \"Suggested monthly ad budget based on industry size, e.g. ₹3,00,000\",\n"
            . "  \"targetROAS\": \"Suggested target blended ROAS, e.g. 4.2\",\n"
            . "  \"specialDays\": \"Suggested promotional days/special events relevant to their niche (e.g. Father's Day: June 20)\",\n"
            . "  \"channelBudgets\": [\n"
            . "    {\"channel\": \"Meta Ads (FB + IG)\", \"budget\": \"₹1,10,000\", \"goal\": \"TOFU + BOFU conversions\"},\n"
            . "    {\"channel\": \"Google Ads (Shopping+Search)\", \"budget\": \"₹70,000\", \"goal\": \"Intent capture\"},\n"
            . "    {\"channel\": \"YouTube Ads\", \"budget\": \"₹40,000\", \"goal\": \"Brand reach\"},\n"
            . "    {\"channel\": \"Influencer Marketing\", \"budget\": \"₹50,000\", \"goal\": \"UGC creative generation\"},\n"
            . "    {\"channel\": \"Content Production\", \"budget\": \"₹10,000\", \"goal\": \"Ad creatives\"},\n"
            . "    {\"channel\": \"Email + WhatsApp\", \"budget\": \"₹20,000\", \"goal\": \"Retention scale\"}\n"
            . "  ]\n"
            . "}";
            
        $extracted = callJSON(SYS, $prompt, 2000);
        json_out($extracted);
        
    } catch (Throwable $e) {
        json_err($e->getMessage());
    }
}

// POST ai/pillars
if ($method === 'POST' && $action === 'ai-pillars') {
    $f = body();
    $ctx = buildCtx($f);
    $usps = $f['usps'] ?? ''; $theme = $f['monthlyTheme'] ?? '';
    $prompt = "Brand context:\n$ctx\n\nMonthly Theme: $theme\nBrand USPs: $usps\n\nGenerate 8 content pillars for this brand. Return JSON: {\"pillars\":[{\"title\":\"...\",\"description\":\"...\"}]}";
    try {
        $result = callJSON(SYS, $prompt, 2000);
        json_out($result);
    } catch (Throwable $e) { json_err($e->getMessage()); }
}

// POST ai/sales
if ($method === 'POST' && $action === 'ai-sales') {
    $f = body();
    $ctx = buildCtx($f);
    $personas = $f['personas'] ?? ''; $theme = $f['monthlyTheme'] ?? '';
    $prompt = "Brand context:\n$ctx\n\nMonthly Theme: $theme\nBuyer Personas: $personas\n\nGenerate 6 sales angles for this brand's ads. Return JSON: {\"angles\":[{\"headline\":\"...\",\"body\":\"...\",\"cta\":\"...\"}]}";
    try {
        $result = callJSON(SYS, $prompt, 2000);
        json_out($result);
    } catch (Throwable $e) { json_err($e->getMessage()); }
}

// POST generate — full strategy deck (returns JSON, frontend shows download link)
if ($method === 'POST' && $action === 'generate') {
    if ($user['role'] === 'user') json_err('Insufficient permissions', 403);
    $f = body();
    error_reporting(0); // Silence warnings to prevent breaking JSON output
    $ctx = buildCtx($f);

    try {
        $theme = $f['monthlyTheme'] ?? 'Not specified';
        $usps  = $f['usps'] ?? 'Not specified';
        $pers  = $f['personas'] ?? 'Not specified';

        // Step 1: pillars
        $pillarsPrompt = "Brand context:\n$ctx\n\nMonthly Theme: $theme\nBrand USPs: $usps\n\nGenerate 8 content pillars. Return JSON: {\"pillars\":[{\"title\":\"...\",\"description\":\"...\"}]}";
        $pillarsData = callJSON(SYS, $pillarsPrompt, 2000);

        // Step 2: sales angles
        $salesPrompt = "Brand context:\n$ctx\n\nMonthly Theme: $theme\nBuyer Personas: $pers\n\nGenerate 6 sales angles. Return JSON: {\"angles\":[{\"headline\":\"...\",\"body\":\"...\",\"cta\":\"...\"}]}";
        $salesData = callJSON(SYS, $salesPrompt, 2000);

        // Save generation record (Always insert new for v1, v2 history)
        $month = $f['strategyMonth'] ?? date('Y-m');
        $genId = uuid4();
        $aiJson = json_encode(['pillars' => $pillarsData['pillars'] ?? [], 'angles' => $salesData['angles'] ?? []]);
        
        $provider  = getSetting('ai_provider', 'anthropic');
        $modelKey  = $provider === 'openai' ? 'openai_model' : 'anthropic_model';
        $modelDef  = $provider === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-latest';
        $modelUsed = getSetting($modelKey, $modelDef);

        dbRun('INSERT INTO strategy_generations (id,brand_id,strategy_month,form_json,ai_json,flags_json,ai_provider,ai_model,generated_by,generated_by_role) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$genId, $brand['id'], $month, json_encode($f), $aiJson, '[]', $provider, $modelUsed, $user['name'], $user['role']]);

        auditLog($user['id'], $user['name'], 'GENERATE_STRATEGY', $brand['name']);
        json_out(['ok' => true, 'genId' => $genId, 'pillars' => $pillarsData['pillars'] ?? [], 'angles' => $salesData['angles'] ?? [], 'filename' => 'strategy-' . $brand['slug'] . '-' . $month . '.json']);

    } catch (Throwable $e) { 
        error_reporting(E_ALL); // Restore for error response
        json_err($e->getMessage()); 
    }
}

// GET download
if ($method === 'GET' && $action === 'download') {
    $genId = $_GET['genId'] ?? '';
    $gen = dbGet('SELECT * FROM strategy_generations WHERE id=? AND brand_id=?', [$genId, $brand['id']]);
    if (!$gen) json_err('Not found', 404);
    $data = ['brand' => $brand['name'], 'month' => $gen['strategy_month'], 'form' => json_decode($gen['form_json'], true), 'ai' => json_decode($gen['ai_json'], true)];
    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="strategy-' . $brand['slug'] . '-' . $gen['strategy_month'] . '.json"');
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

// GET history
if ($method === 'GET' && $action === 'history') {
    $rows = dbAll('SELECT id, strategy_month, generated_by, created_at FROM strategy_generations WHERE brand_id=? ORDER BY created_at DESC', [$brand['id']]);
    json_out(['history' => $rows]);
}

json_err('Not found', 404);
