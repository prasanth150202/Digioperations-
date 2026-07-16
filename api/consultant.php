<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/ai.php';
require_once __DIR__ . '/intelligence.php';

ini_set('memory_limit', '512M');
set_time_limit(600);

$user   = requireAuth();
requirePage($user, 'strategy');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── GET: Load saved session ──────────────────────────────────────────────────
if ($method === 'GET' && $action === 'load') {
    $brandId = $_GET['brand_id'] ?? '';
    if (!$brandId) json_err('Brand ID required');
    $row = dbGet('SELECT * FROM consultant_generations WHERE brand_id = ? ORDER BY created_at DESC LIMIT 1', [$brandId]);
    if ($row) {
        foreach (['crawled_json','brief_json','strategy_json','modules_json'] as $col) {
            $row[$col] = json_decode($row[$col] ?? 'null', true);
        }
        json_out($row);
    } else {
        json_out(['empty' => true]);
    }
}

// ── POST: Deep crawl with live SSE progress ──────────────────────────────────
if ($method === 'POST' && $action === 'deep_crawl') {
    $b         = body();
    $brandName = trim($b['brand_name'] ?? '');
    $brandUrl  = trim($b['brand_url']  ?? '');

    if (!$brandName) json_err('Brand name is required');

    // Stream-safe SSE response
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('X-Accel-Buffering: no');
    if (ob_get_level()) ob_end_clean();

    $send = function(string $event, array $data) {
        echo "event: {$event}\n";
        echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
        flush();
    };

    $progress = function(string $msg, int $pct) use ($send) {
        $send('progress', ['message' => $msg, 'pct' => $pct]);
    };

    try {
        $send('start', ['message' => "🚀 Starting deep intelligence crawl for {$brandName}..."]);

        // Run multi-source research
        $research = runDeepResearch($brandName, $brandUrl, $progress);

        $progress('🧠 AI synthesizing all gathered intelligence...', 93);

        // AI synthesis
        $intelligence = synthesizeBrandIntelligence($brandName, $brandUrl, $research['summary']);

        $progress('❓ Generating dynamic founder briefing questions...', 97);

        // Generate personalized briefing questions
        $questions = generateBriefingQuestions($brandName, $intelligence);

        $progress('✅ Complete! Ready for founder briefing.', 100);

        $send('done', [
            'intelligence' => $intelligence,
            'questions'    => $questions,
            'sources'      => array_map(fn($s) => ['label' => $s['label'], 'layer' => $s['layer']], $research['sources']),
            'stats'        => $research['stats'],
        ]);

    } catch (Throwable $e) {
        $send('error', ['message' => $e->getMessage()]);
    }
    exit;
}

// ── POST: Generate one document module ──────────────────────────────────────
if ($method === 'POST' && $action === 'generate_module') {
    $b            = body();
    $brandName    = trim($b['brand_name']   ?? '');
    $moduleId     = trim($b['module_id']    ?? '');
    $intelligence = $b['intelligence']       ?? [];
    $founderBrief = $b['founder_brief']      ?? [];

    if (!$brandName || !$moduleId) json_err('brand_name and module_id required');

    try {
        $content = generateDocumentModule($brandName, $moduleId, $intelligence, $founderBrief);
        json_out(['ok' => true, 'module_id' => $moduleId, 'content' => $content]);
    } catch (Throwable $e) {
        json_err($e->getMessage());
    }
}

// ── POST: Save full session ──────────────────────────────────────────────────
if ($method === 'POST' && $action === 'save') {
    $b         = body();
    $brandId   = $b['brand_id']   ?? '';
    $brandName = trim($b['brand_name'] ?? '');
    $brandUrl  = trim($b['brand_url']  ?? '');
    $crawled   = $b['crawled']    ?? [];
    $brief     = $b['brief']      ?? [];
    $strategy  = $b['strategy']   ?? [];
    $modules   = $b['modules']    ?? [];

    if (!$brandId) json_err('Brand ID required');

    $existing = dbGet('SELECT id FROM consultant_generations WHERE brand_id = ?', [$brandId]);
    if ($existing) {
        dbRun(
            'UPDATE consultant_generations SET brand_name=?, brand_url=?, crawled_json=?, brief_json=?, strategy_json=?, modules_json=? WHERE id=?',
            [
                $brandName, $brandUrl,
                json_encode($crawled, JSON_UNESCAPED_UNICODE),
                json_encode($brief, JSON_UNESCAPED_UNICODE),
                json_encode($strategy, JSON_UNESCAPED_UNICODE),
                json_encode($modules, JSON_UNESCAPED_UNICODE),
                $existing['id'],
            ]
        );
    } else {
        dbRun(
            'INSERT INTO consultant_generations (id,brand_id,brand_name,brand_url,crawled_json,brief_json,strategy_json,modules_json,generated_by) VALUES (?,?,?,?,?,?,?,?,?)',
            [
                uuid4(), $brandId, $brandName, $brandUrl,
                json_encode($crawled, JSON_UNESCAPED_UNICODE),
                json_encode($brief, JSON_UNESCAPED_UNICODE),
                json_encode($strategy, JSON_UNESCAPED_UNICODE),
                json_encode($modules, JSON_UNESCAPED_UNICODE),
                $user['name'],
            ]
        );
    }
    json_out(['ok' => true]);
}

// ── POST: Legacy crawl action (backward compat) ──────────────────────────────
if ($method === 'POST' && $action === 'crawl') {
    $b         = body();
    $brandName = trim($b['brand_name'] ?? '');
    $brandUrl  = trim($b['brand_url']  ?? '');
    if (!$brandName) json_err('Brand Name is required');

    // Quick single-pass crawl for legacy callers
    $content = '';
    if ($brandUrl) {
        if (!preg_match('/^https?:\/\//i', $brandUrl)) $brandUrl = 'https://' . $brandUrl;
        $content = jinaRead($brandUrl, 7000);
        if (!$content) {
            $pages = crawlSiteNative($brandUrl, 5);
            $content = implode("\n\n", array_map(fn($p) => $p['content'], $pages));
        }
    }
    if (!$content) {
        $content = jinaSearch($brandName . ' brand products USP India', 5000);
    }

    $sys = 'You are a brand intelligence compiler. Return ONLY valid JSON, no preamble, no markdown.';
    $prompt = "Brand: {$brandName}\nURL: {$brandUrl}\nContent:\n{$content}\n\n"
            . "Extract and return JSON:\n"
            . "{\"logoDescription\":\"\",\"primaryColor\":\"#HEX\",\"secondaryColor\":\"#HEX\",\"visualTone\":\"\","
            . "\"heroProducts\":[{\"name\":\"\",\"price\":\"\",\"usp\":\"\"}],"
            . "\"usps\":[\"\"],\"toneOfVoice\":\"\",\"socialBio\":\"\",\"contentStyle\":\"\"}";
    try {
        json_out(callJSON($sys, $prompt, 2000));
    } catch (Throwable $e) {
        json_err($e->getMessage());
    }
}

// ── POST: Legacy formulate action ────────────────────────────────────────────
if ($method === 'POST' && $action === 'formulate') {
    $b         = body();
    $brandName = trim($b['brand_name'] ?? '');
    $crawled   = $b['crawled'] ?? [];
    $brief     = $b['brief']   ?? [];
    if (!$brandName) json_err('Brand name required');

    $sys = 'You are a Million-Dollar Advisory Board. Return ONLY valid JSON.';
    $prompt = "Brand: {$brandName}\nCrawled: " . json_encode($crawled) . "\nBrief: " . json_encode($brief) . "\n\n"
            . "Formulate a strategy in this JSON structure:\n"
            . "{\"jobs_musk\":{\"title\":\"\",\"subtitle\":\"\",\"recommendations\":[\"\"]},\"buffett_munger\":{\"title\":\"\",\"subtitle\":\"\",\"recommendations\":[\"\"]},\"agency_funnel\":{\"title\":\"\",\"subtitle\":\"\",\"recommendations\":[\"\"]},\"cross_pollination\":{\"title\":\"\",\"subtitle\":\"\",\"recommendations\":[\"\"]},\"action_plan\":{\"title\":\"\",\"subtitle\":\"\",\"recommendations\":[\"\"]}}";
    try {
        json_out(callJSON($sys, $prompt, 3500));
    } catch (Throwable $e) {
        json_err($e->getMessage());
    }
}
