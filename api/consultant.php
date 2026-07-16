<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/ai.php';

ini_set('memory_limit', '512M');
set_time_limit(180);

$user = requireAuth();
requirePage($user, 'strategy'); // Reuse strategy page permission since it's the core strategy group

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// GET active brand's latest consultant draft
if ($method === 'GET' && $action === 'load') {
    $brandId = $_GET['brand_id'] ?? '';
    if (!$brandId) json_err('Brand ID required');
    
    $row = dbGet('SELECT * FROM consultant_generations WHERE brand_id = ? ORDER BY created_at DESC LIMIT 1', [$brandId]);
    if ($row) {
        $row['crawled_json'] = json_decode($row['crawled_json'], true);
        $row['brief_json'] = json_decode($row['brief_json'], true);
        $row['strategy_json'] = json_decode($row['strategy_json'], true);
        json_out($row);
    } else {
        json_out(['empty' => true]);
    }
}

// POST save draft
if ($method === 'POST' && $action === 'save') {
    $b = body();
    $brandId = $b['brand_id'] ?? '';
    $brandName = trim($b['brand_name'] ?? '');
    $brandUrl = trim($b['brand_url'] ?? '');
    $crawled = $b['crawled'] ?? [];
    $brief = $b['brief'] ?? [];
    $strategy = $b['strategy'] ?? [];
    
    if (!$brandId) json_err('Brand ID required');
    
    $existing = dbGet('SELECT id FROM consultant_generations WHERE brand_id = ?', [$brandId]);
    if ($existing) {
        dbRun(
            'UPDATE consultant_generations SET brand_name = ?, brand_url = ?, crawled_json = ?, brief_json = ?, strategy_json = ? WHERE id = ?',
            [
                $brandName,
                $brandUrl,
                json_encode($crawled, JSON_UNESCAPED_UNICODE),
                json_encode($brief, JSON_UNESCAPED_UNICODE),
                json_encode($strategy, JSON_UNESCAPED_UNICODE),
                $existing['id']
            ]
        );
    } else {
        dbRun(
            'INSERT INTO consultant_generations (id, brand_id, brand_name, brand_url, crawled_json, brief_json, strategy_json, generated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                uuid4(),
                $brandId,
                $brandName,
                $brandUrl,
                json_encode($crawled, JSON_UNESCAPED_UNICODE),
                json_encode($brief, JSON_UNESCAPED_UNICODE),
                json_encode($strategy, JSON_UNESCAPED_UNICODE),
                $user['name']
            ]
        );
    }
    json_out(['ok' => true]);
}

// POST crawl/scrape simulation
if ($method === 'POST' && $action === 'crawl') {
    $b = body();
    $brandName = trim($b['brand_name'] ?? '');
    $brandUrl = trim($b['brand_url'] ?? '');
    
    if (!$brandName) json_err('Brand Name is required');
    
    $htmlContent = '';
    if ($brandUrl) {
        if (!preg_match('/^https?:\/\//i', $brandUrl)) {
            $brandUrl = 'https://' . $brandUrl;
        }
        try {
            $ctx = stream_context_create(['http' => [
                'method'  => 'GET',
                'header'  => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n",
                'timeout' => 10,
                'ignore_errors' => true
            ]]);
            $html = @file_get_contents($brandUrl, false, $ctx);
            if ($html) {
                $clean = preg_replace('/<(script|style|svg|noscript|iframe)[^>]*>.*?<\/\1>/is', '', $html);
                $clean = strip_tags($clean);
                $clean = preg_replace('/\s+/', ' ', $clean);
                $htmlContent = substr($clean, 0, 7000);
            }
        } catch (Throwable $e) {
            // Ignore scrape failure and fallback to general LLM knowledge
        }
    }
    
    const CRAWL_SYS = 'You are a world-class brand crawler and intelligence compiler. Analyze the inputs and extract precise data. Return ONLY valid JSON, no preamble, no markdown formatting.';
    
    $prompt = "We are performing a deep digital audit on the brand: '$brandName'\n"
            . "Website URL: '$brandUrl'\n"
            . ($htmlContent ? "Website Scraped Content Sample:\n$htmlContent\n\n" : "No active scrape content available. Use your extensive offline training data and brand footprint knowledge to synthesize the details.\n\n")
            . "Crawl and discover the following brand assets. Return ONLY a valid JSON object matching this structure exactly:\n"
            . "{\n"
            . "  \"logoDescription\": \"Describe the brand logo style, shapes, and elements\",\n"
            . "  \"primaryColor\": \"Suggested HEX color representing the brand primary identity (e.g. #2B4EFF)\",\n"
            . "  \"secondaryColor\": \"Suggested HEX color for secondary elements (e.g. #10B981)\",\n"
            . "  \"visualTone\": \"Describe the brand visual identity, typography, imagery style (e.g. Minimalist, bold contrasts, earth-toned, athletic-focused)\",\n"
            . "  \"heroProducts\": [\n"
            . "    {\"name\": \"Product Name 1\", \"price\": \"Est. Price (e.g. ₹1,299)\", \"usp\": \"Short core USP\"},\n"
            . "    {\"name\": \"Product Name 2\", \"price\": \"Est. Price\", \"usp\": \"Short core USP\"},\n"
            . "    {\"name\": \"Product Name 3\", \"price\": \"Est. Price\", \"usp\": \"Short core USP\"}\n"
            . "  ],\n"
            . "  \"usps\": [\n"
            . "    \"Core unique selling proposition 1\",\n"
            . "    \"Core unique selling proposition 2\",\n"
            . "    \"Core unique selling proposition 3\"\n"
            . "  ],\n"
            . "  \"toneOfVoice\": \"Communication tone, e.g. authoritative, conversational, high-energy, scientific\",\n"
            . "  \"socialBio\": \"A suggested/extracted high-converting bio for Instagram/social channels\",\n"
            . "  \"contentStyle\": \"Analysis of their content hooks (e.g. UGC focus, educational infographics, high-production campaign films)\"\n"
            . "}";
            
    try {
        $data = callJSON(CRAWL_SYS, $prompt, 2000);
        json_out($data);
    } catch (Throwable $e) {
        json_err($e->getMessage());
    }
}

// POST formulate million-dollar strategy
if ($method === 'POST' && $action === 'formulate') {
    $b = body();
    $brandName = trim($b['brand_name'] ?? '');
    $brandUrl = trim($b['brand_url'] ?? '');
    $crawled = $b['crawled'] ?? [];
    $brief = $b['brief'] ?? [];
    
    if (!$brandName) json_err('Brand Name is required');
    
    $crawledStr = json_encode($crawled);
    $briefStr = json_encode($brief);
    
    const STRAT_SYS = 'You are a member of a Million-Dollar Advisory Board comprised of Steve Jobs, Elon Musk, Warren Buffett, Charlie Munger, and elite Dentsu/Deloitte marketing directors. You formulate out-of-the-box, highly actionable, deeply personalized D2C strategy recommendations. Return ONLY a valid JSON object matching the requested structure.';
    
    $prompt = "Formulate a comprehensive growth strategy deck for the brand: '$brandName' ($brandUrl).\n\n"
            . "CRAWLED BRAND DETAILS:\n$crawledStr\n\n"
            . "HUMAN CONSULTANT BRIEF (Internal secret inputs):\n$briefStr\n\n"
            . "Your goal is to provide a master-level strategy. Avoid generic advice (like 'improve social media'). Provide customized, hyper-relevant execution plans.\n"
            . "Provide 5 distinct strategic perspectives exactly matching this JSON layout structure (no extra fields, values must be arrays of rich paragraphs):\n"
            . "{\n"
            . "  \"jobs_musk\": {\n"
            . "    \"title\": \"The Product Innovators (Steve Jobs & Elon Musk Perspective)\",\n"
            . "    \"subtitle\": \"First-principles thinking, product redesign, fanatical customer experience\",\n"
            . "    \"recommendations\": [\n"
            . "      \"Core recommendation 1: A radical, product-focused change based on first-principles. How to simplify, redesign, or create a viral product features.\",\n"
            . "      \"Core recommendation 2: Cult positioning strategy. How to design a fanatical customer unboxing and product experience that feels like opening an Apple product.\"\n"
            . "    ]\n"
            . "  },\n"
            . "  \"buffett_munger\": {\n"
            . "    \"title\": \"The Value Investors (Warren Buffett & Charlie Munger Perspective)\",\n"
            . "    \"subtitle\": \"Economic moats, pricing power, return on capital, margin optimization\",\n"
            . "    \"recommendations\": [\n"
            . "      \"Core recommendation 1: How to build a defensive economic moat (switching costs, brand equity, network effects) to insulate the brand from price wars.\",\n"
            . "      \"Core recommendation 2: Pricing power and capital allocation. Tactics to optimize gross margin, bundle for AOV expansion, and protect margins without heavy discount traps.\"\n"
            . "    ]\n"
            . "  },\n"
            . "  \"agency_funnel\": {\n"
            . "    \"title\": \"The Omnichannel Scale (Dentsu & Deloitte Agency Perspective)\",\n"
            . "    \"subtitle\": \"Structured acquisition funnel, lifetime value (LTV) models, retention systems\",\n"
            . "    \"recommendations\": [\n"
            . "      \"Acquisition Strategy: Precise paid acquisition hooks for Meta and Google. Custom ad angles designed for their specific target demographic.\",\n"
            . "      \"Retention & LTV: Klaviyo lifecycle email flows, automated WhatsApp conversational triggers, and subscription/replenishment setup to maximize repeat purchases.\"\n"
            . "    ]\n"
            . "  },\n"
            . "  \"cross_pollination\": {\n"
            . "    \"title\": \"Out-of-the-Box Cross-Pollination Playbook\",\n"
            . "    \"subtitle\": \"Applying winning playbooks from unrelated industries to disrupt this space\",\n"
            . "    \"recommendations\": [\n"
            . "      \"The Strategy: A specific growth playbook from a completely different industry (e.g. SaaS recurring loops, gaming reward systems, Airbnb host programs) adapted to this brand.\",\n"
            . "      \"How it Works: Tactical breakdown of how to build and launch this cross-pollinated system to stand out from direct competitors.\"\n"
            . "    ]\n"
            . "  },\n"
            . "  \"action_plan\": {\n"
            . "    \"title\": \"Million-Dollar Execution Roadmap\",\n"
            . "    \"subtitle\": \"90-day structured rollout plan mapped to weekly deliverables\",\n"
            . "    \"recommendations\": [\n"
            . "      \"Month 1 (Launch & Core Foundation): Clear list of actions to set up analytics, launch initial assets, and initiate testing.\",\n"
            . "      \"Month 2 (Scale & Optimization): Growth tactics to scale winning ad sets, run A/B offers, and deploy email flows.\",\n"
            . "      \"Month 3 (Full scale & Moat building): Ambassador programs, customer referrals, and premium product drops launch.\"\n"
            . "    ]\n"
            . "  }\n"
            . "}";
            
    try {
        $strategyData = callJSON(STRAT_SYS, $prompt, 3200);
        json_out($strategyData);
    } catch (Throwable $e) {
        json_err($e->getMessage());
    }
}
