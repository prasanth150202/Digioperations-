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
    
    $crawlSys = 'You are a world-class brand crawler and intelligence compiler. Analyze the inputs and extract precise data. Return ONLY valid JSON, no preamble, no markdown formatting.';
    
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
        $data = callJSON($crawlSys, $prompt, 2000);
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
    
    $stratSys = 'You are a member of a Million-Dollar Advisory Board comprised of Steve Jobs, Elon Musk, Warren Buffett, Charlie Munger, and elite Dentsu/Deloitte marketing directors. You formulate out-of-the-box, highly actionable, deeply personalized D2C strategy recommendations. Return ONLY a valid JSON object matching the requested structure.';
    
    $prompt = "Formulate a comprehensive, highly personalized million-dollar growth strategy deck for the D2C brand: '$brandName' ($brandUrl).\n\n"
            . "CRAWLED BRAND DETAILS:\n$crawledStr\n\n"
            . "HUMAN CONSULTANT BRIEF (Internal secret inputs):\n$briefStr\n\n"
            . "CRITICAL INSTRUCTION: You must think like world-class growth architects. Avoid generic copy-paste marketing advice (like 'run Meta ads', 'do email marketing', 'optimize website'). Every single recommendation must be written as a concrete, highly tailored growth playbook with a custom title, actual pricing tactics, specific ad hooks, and exact implementation steps customized for this brand name ('$brandName') and its target market.\n\n"
            . "FORMATTING RULES FOR EACH RECOMMENDATION:\n"
            . "Every recommendation string in the JSON arrays must follow this exact structured blueprint to ensure it reads like an elite McKinsey/Deloitte strategy brief:\n"
            . "**[PLAYBOOK TITLE]**\n"
            . "• **Strategic Leak**: [1-sentence diagnosis of what current bottleneck this solves]\n"
            . "• **The Execution**: [Detailed, step-by-step tactical implementation plan custom-tailored for $brandName]\n"
            . "• **Real-World Reference**: [Name a real brand/case study that scaled using this exact playbook, e.g. Athletic Greens, Tesla, Warby Parker, or Glossier]\n"
            . "• **Expected Impact**: [Projected financial or performance metrics, e.g. +35% AOV, 22% increase in LTV, or 40% lower CAC]\n\n"
            . "Provide 5 distinct strategic perspectives exactly matching this JSON layout structure (no extra fields, values must be arrays of rich paragraphs):\n"
            . "{\n"
            . "  \"jobs_musk\": {\n"
            . "    \"title\": \"The Product Innovators (Steve Jobs & Elon Musk Perspective)\",\n"
            . "    \"subtitle\": \"First-principles engineering, aesthetic perfection, & cult customer experience\",\n"
            . "    \"recommendations\": [\n"
            . "      \"[THE FIRST-PRINCIPLES DISRUPTION]: Detailed product innovation playbook. For example, introduce a specific customizable engine, premium ingredient redesign, or bespoke hardware addition. Explain how it works, what makes it viral, and how it radically elevates the product value above commodities.\",\n"
            . "      \"[THE CULT UNBOXING & CX MOTIVATION]: A specific, sensory-rich unboxing and packaging strategy. Detail the materials, QR triggers, AR experiences, or surprise elements that make customers feel like they are opening a premium Apple/Tesla product, forcing immediate social UGC sharing.\"\n"
            . "    ]\n"
            . "  },\n"
            . "  \"buffett_munger\": {\n"
            . "    \"title\": \"The Value Investors (Warren Buffett & Charlie Munger Perspective)\",\n"
            . "    \"subtitle\": \"Pricing power, defensive economic moats, & margin protection\",\n"
            . "    \"recommendations\": [\n"
            . "      \"[THE DEFENSIVE ECONOMIC MOAT]: A concrete plan to build switching costs, single-source exclusive partnerships, or proprietary IP/formulas that insulate this brand from competitors and price wars.\",\n"
            . "      \"[PRICING POWER & MARGIN SAFETY]: Specific premium bundling mechanics (e.g. naming specific routine bundles, kit builds, subscription configurations) designed to expand AOV by 30%+ and protect net margins without relying on cheap discount codes.\"\n"
            . "    ]\n"
            . "  },\n"
            . "  \"agency_funnel\": {\n"
            . "    \"title\": \"The Omnichannel Scale (Dentsu & Deloitte Agency Perspective)\",\n"
            . "    \"subtitle\": \"Structured paid acquisition, lifecycle funnels, & retention systems\",\n"
            . "    \"recommendations\": [\n"
            . "      \"[ACQUISITION FUNNEL: META & GOOGLE]: Specific paid media strategy. Write out exact ad angles, custom hook lines, and creative directions designed for their target demographics. Do not write generic advice; name specific formats and audience interests.\",\n"
            . "      \"[RETENTION CRM: LIFECYCLE FLOWS]: Custom email sequences (Klaviyo welcome, abandonment, post-purchase) and WhatsApp conversation triggers. Give concrete examples of copy hooks and timing intervals to maximize repeat customer rate.\"\n"
            . "    ]\n"
            . "  },\n"
            . "  \"cross_pollination\": {\n"
            . "    \"title\": \"Out-of-the-Box Cross-Pollination Playbook\",\n"
            . "    \"subtitle\": \"Applying winning playbooks from unrelated industries to disrupt this space\",\n"
            . "    \"recommendations\": [\n"
            . "      \"[THE CROSS-INDUSTRY PLAYBOOK]: A detailed playbook imported from an entirely different sector (e.g. SaaS metrics, video game gamification, Airbnb community networks, subscription cosmetic models) adapted specifically for $brandName.\",\n"
            . "      \"[TACTICAL LAUNCH & INTEGRATION]: A step-by-step breakdown of how to build, integrate, and launch this cross-pollination playbook to create a completely new market category.\"\n"
            . "    ]\n"
            . "  },\n"
            . "  \"action_plan\": {\n"
            . "    \"title\": \"Million-Dollar Execution Roadmap\",\n"
            . "    \"subtitle\": \"90-day structured rollout plan mapped to weekly deliverables\",\n"
            . "    \"recommendations\": [\n"
            . "      \"Month 1 (Launch & Core Foundation): Clear, step-by-step weekly checklist to audit analytics, setup tracking parameters, produce initial custom ad assets, and launch testing.\",\n"
            . "      \"Month 2 (Scale & Optimization): Specific growth actions to allocate budget to winning sets, launch A/B bundle testing, and activate initial retention hooks.\",\n"
            . "      \"Month 3 (Full scale & Moat building): Launching ambassador seeding campaigns, deploying gamified loyalty systems, and initiating limited-edition scarcity drops.\"\n"
            . "    ]\n"
            . "  }\n"
            . "}";
            
    try {
        $strategyData = callJSON($stratSys, $prompt, 3200);
        json_out($strategyData);
    } catch (Throwable $e) {
        json_err($e->getMessage());
    }
}
