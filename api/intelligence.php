<?php
/**
 * Digifyce Intelligence Engine
 * Deep multi-source brand research orchestrator.
 *
 * Free-first strategy:
 *  - Jina AI Reader  (r.jina.ai)  – free, no key, converts any URL to clean Markdown
 *  - Jina AI Search  (s.jina.ai)  – free, no key, real-time web search → Markdown
 *  - Reddit JSON API              – free, no key, public subreddit + search results
 *  - DuckDuckGo Instant API       – free, no key, quick structured search
 *  - PHP native recursive crawler – free, no key, follows internal links up to N pages
 * Optional upgrades (add API keys in Admin → Settings):
 *  - Firecrawl  (FIRECRAWL_API_KEY)  – superior JS-rendered full site crawl
 *  - Tavily     (TAVILY_API_KEY)     – deep research-grade web search
 *  - SerpAPI    (SERPAPI_API_KEY)    – Google, YouTube, Amazon, Reddit structured results
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/ai.php';

ini_set('memory_limit', '512M');
set_time_limit(600); // Allow up to 10 min for deep research

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function igFetch(string $url, array $opts = []): string {
    $headers = array_merge([
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Accept: text/html,application/xhtml+xml,application/json,*/*;q=0.9',
        'Accept-Language: en-US,en;q=0.9',
    ], $opts['headers'] ?? []);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => $opts['timeout'] ?? 20,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_ENCODING       => 'gzip, deflate, br',
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ]);
    if (!empty($opts['post'])) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, is_array($opts['post']) ? json_encode($opts['post']) : $opts['post']);
    }
    $body = curl_exec($ch);
    curl_close($ch);
    return $body ?: '';
}

// ─── Layer 1: Jina AI Reader — convert any URL to LLM-ready Markdown ────────
function jinaRead(string $url, int $maxChars = 6000): string {
    $jinaKey = getSetting('jina_api_key');
    $hdrs = ['X-No-Cache: true', 'X-Return-Format: markdown'];
    if ($jinaKey) $hdrs[] = 'Authorization: Bearer ' . $jinaKey;
    $raw = igFetch('https://r.jina.ai/' . $url, ['headers' => $hdrs, 'timeout' => 25]);
    if (!$raw) return '';
    // Strip Jina header metadata lines
    $raw = preg_replace('/^(Title:|URL:|Published Time:)[^\n]*\n/m', '', $raw);
    return substr(trim($raw), 0, $maxChars);
}

// ─── Layer 2: Jina AI Search — real-time web search results as Markdown ──────
function jinaSearch(string $query, int $maxChars = 5000): string {
    $jinaKey = getSetting('jina_api_key');
    $hdrs = ['Accept: text/event-stream'];
    if ($jinaKey) $hdrs[] = 'Authorization: Bearer ' . $jinaKey;
    $raw = igFetch('https://s.jina.ai/' . urlencode($query), ['headers' => $hdrs, 'timeout' => 30]);
    if (!$raw) return '';
    return substr(trim($raw), 0, $maxChars);
}

// ─── Layer 3: Reddit JSON API — mine public Reddit discussions ───────────────
function redditSearch(string $query, int $limit = 10): array {
    $url = 'https://www.reddit.com/search.json?q=' . urlencode($query) . '&limit=' . $limit . '&sort=relevance&type=link';
    $raw = igFetch($url, [
        'headers' => ['User-Agent: Digifyce-Research-Bot/1.0'],
        'timeout' => 15
    ]);
    if (!$raw) return [];
    $data = json_decode($raw, true);
    $posts = $data['data']['children'] ?? [];
    $results = [];
    foreach ($posts as $post) {
        $p = $post['data'] ?? [];
        if (empty($p['title'])) continue;
        $results[] = [
            'title'     => $p['title'],
            'subreddit' => $p['subreddit'],
            'score'     => $p['score'] ?? 0,
            'url'       => 'https://reddit.com' . ($p['permalink'] ?? ''),
            'selftext'  => substr($p['selftext'] ?? '', 0, 500),
            'num_comments' => $p['num_comments'] ?? 0,
        ];
    }
    return $results;
}

// ─── Layer 4: DuckDuckGo — free instant structured answer API ────────────────
function duckduckgoSearch(string $query): array {
    $url = 'https://api.duckduckgo.com/?q=' . urlencode($query) . '&format=json&no_redirect=1&no_html=1&skip_disambig=1';
    $raw = igFetch($url, ['timeout' => 12]);
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return [
        'abstract'       => $data['AbstractText']  ?? '',
        'abstract_url'   => $data['AbstractURL']   ?? '',
        'abstract_src'   => $data['AbstractSource'] ?? '',
        'related'        => array_slice(array_map(function($r) {
            return ['text' => $r['Text'] ?? '', 'url' => $r['FirstURL'] ?? ''];
        }, $data['RelatedTopics'] ?? []), 0, 8),
    ];
}

// ─── Layer 5: PHP Native Recursive Crawler ───────────────────────────────────
function crawlSiteNative(string $startUrl, int $maxPages = 15): array {
    if (!preg_match('/^https?:\/\//i', $startUrl)) $startUrl = 'https://' . $startUrl;
    $parsed  = parse_url($startUrl);
    $base    = ($parsed['scheme'] ?? 'https') . '://' . ($parsed['host'] ?? '');
    $visited = [];
    $queue   = [$startUrl];
    $pages   = [];

    while (!empty($queue) && count($pages) < $maxPages) {
        $url = array_shift($queue);
        $normUrl = strtok($url, '?#');
        if (isset($visited[$normUrl])) continue;
        $visited[$normUrl] = true;

        $html = igFetch($url, ['timeout' => 12]);
        if (!$html) continue;

        // Extract text content
        $clean = preg_replace('/<(script|style|svg|noscript|iframe|nav|footer|header)[^>]*>.*?<\/\1>/is', '', $html);
        $clean = strip_tags($clean);
        $clean = preg_replace('/\s+/', ' ', $clean);
        $text  = substr(trim($clean), 0, 3000);

        // Extract page title
        preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $tm);
        $title = trim(strip_tags($tm[1] ?? ''));

        if (strlen($text) > 100) {
            $pages[] = ['url' => $url, 'title' => $title, 'content' => $text];
        }

        // Find internal links
        if (count($pages) < $maxPages) {
            preg_match_all('/href=["\'](https?:\/\/[^"\']+|\/[^"\']*)["\']/', $html, $linkMatches);
            foreach ($linkMatches[1] as $href) {
                if (strpos($href, '/') === 0) $href = $base . $href;
                $hParsed = parse_url($href);
                // Same domain only, skip assets
                if (($hParsed['host'] ?? '') !== ($parsed['host'] ?? '')) continue;
                $ext = strtolower(pathinfo($hParsed['path'] ?? '', PATHINFO_EXTENSION));
                if (in_array($ext, ['jpg','jpeg','png','gif','svg','pdf','zip','mp4','webp','ico','css','js','woff','woff2'])) continue;
                $normHref = strtok($href, '?#');
                if (!isset($visited[$normHref])) $queue[] = $href;
            }
        }
    }
    return $pages;
}

// ─── Layer 6: Firecrawl (optional, if key exists) ────────────────────────────
function firecrawlSite(string $url, string $apiKey, int $limit = 25): array {
    $payload = json_encode([
        'url'    => $url,
        'limit'  => $limit,
        'scrapeOptions' => ['formats' => ['markdown'], 'onlyMainContent' => true],
    ]);
    $raw = igFetch('https://api.firecrawl.dev/v1/crawl', [
        'headers' => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
        'post'    => $payload,
        'timeout' => 120,
    ]);
    if (!$raw) return [];
    $data = json_decode($raw, true);
    // Firecrawl returns job ID for async - try sync scrape endpoint instead
    if (!empty($data['id'])) {
        // Poll for results up to 90s
        $jobId = $data['id'];
        for ($i = 0; $i < 18; $i++) {
            sleep(5);
            $poll = igFetch('https://api.firecrawl.dev/v1/crawl/' . $jobId, [
                'headers' => ['Authorization: Bearer ' . $apiKey],
                'timeout' => 15,
            ]);
            $pData = json_decode($poll, true);
            if (!empty($pData['data'])) {
                return array_map(function($d) {
                    return [
                        'url'     => $d['metadata']['sourceURL'] ?? '',
                        'title'   => $d['metadata']['title'] ?? '',
                        'content' => substr($d['markdown'] ?? '', 0, 3000),
                    ];
                }, $pData['data']);
            }
        }
        return [];
    }
    if (!empty($data['data'])) {
        return array_map(function($d) {
            return [
                'url'     => $d['metadata']['sourceURL'] ?? '',
                'title'   => $d['metadata']['title'] ?? '',
                'content' => substr($d['markdown'] ?? '', 0, 3000),
            ];
        }, $data['data']);
    }
    return [];
}

// ─── Layer 7: Tavily Deep Search (optional) ───────────────────────────────────
function tavilySearch(string $query, string $apiKey, string $depth = 'advanced'): array {
    $raw = igFetch('https://api.tavily.com/search', [
        'headers' => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
        'post' => json_encode([
            'query'        => $query,
            'search_depth' => $depth,
            'max_results'  => 8,
            'include_answer' => true,
        ]),
        'timeout' => 45,
    ]);
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return [
        'answer'  => $data['answer'] ?? '',
        'results' => array_slice(array_map(function($r) {
            return [
                'title'   => $r['title'] ?? '',
                'url'     => $r['url'] ?? '',
                'content' => substr($r['content'] ?? '', 0, 1000),
                'score'   => $r['score'] ?? 0,
            ];
        }, $data['results'] ?? []), 0, 8),
    ];
}

// ─── Layer 8: SerpAPI (optional) ─────────────────────────────────────────────
function serpSearch(string $query, string $apiKey, string $engine = 'google'): array {
    $url = 'https://serpapi.com/search?engine=' . $engine
         . '&q=' . urlencode($query)
         . '&api_key=' . $apiKey
         . '&num=10&hl=en';
    $raw = igFetch($url, ['timeout' => 25]);
    if (!$raw) return [];
    $data = json_decode($raw, true);
    $results = [];
    foreach ($data['organic_results'] ?? [] as $r) {
        $results[] = [
            'title'   => $r['title'] ?? '',
            'link'    => $r['link'] ?? '',
            'snippet' => $r['snippet'] ?? '',
        ];
    }
    return $results;
}

// ─── MASTER ORCHESTRATOR ─────────────────────────────────────────────────────
/**
 * runDeepResearch()
 * Runs all available layers in sequence, collecting as much intelligence
 * as possible about the brand. Falls back gracefully when no API key is set.
 *
 * Returns an array of:
 *   sources[]    - every data point found, with source label
 *   summary      - flat text blob of everything gathered (for AI synthesis)
 *   stats        - counts of what was gathered
 */
function runDeepResearch(string $brandName, string $brandUrl, callable $progress): array {
    $sources = [];
    $stats   = [
        'pages_crawled' => 0,
        'search_results' => 0,
        'reddit_threads' => 0,
        'competitor_pages' => 0,
    ];

    // Normalise URL
    if ($brandUrl && !preg_match('/^https?:\/\//i', $brandUrl)) {
        $brandUrl = 'https://' . $brandUrl;
    }

    // Get optional API keys
    $firecrawlKey = getSetting('firecrawl_api_key');
    $tavilyKey    = getSetting('tavily_api_key');
    $serpKey      = getSetting('serpapi_api_key');

    // ── STEP 1: Crawl brand website ──────────────────────────────────────────
    if ($brandUrl) {
        $progress('🌐 Crawling brand website: ' . $brandUrl, 8);

        if ($firecrawlKey) {
            $progress('⚡ Using Firecrawl for deep JS-rendered crawl...', 10);
            $pages = firecrawlSite($brandUrl, $firecrawlKey, 30);
        } else {
            $progress('🔍 Using native crawler (free mode)...', 10);
            $pages = crawlSiteNative($brandUrl, 15);
        }

        // Fall back to Jina Reader for homepage if native got nothing
        if (empty($pages)) {
            $progress('📄 Reading homepage via Jina AI...', 12);
            $jinaContent = jinaRead($brandUrl, 8000);
            if ($jinaContent) {
                $pages = [['url' => $brandUrl, 'title' => $brandName . ' Homepage', 'content' => $jinaContent]];
            }
        }

        foreach ($pages as $p) {
            $sources[] = [
                'layer'   => 'Website Crawl',
                'label'   => '📄 ' . ($p['title'] ?: $p['url']),
                'url'     => $p['url'],
                'content' => $p['content'],
            ];
            $stats['pages_crawled']++;
            $progress('📄 Read: ' . ($p['title'] ?: basename($p['url'])), min(25, 10 + $stats['pages_crawled']));
        }
    }

    // ── STEP 2: Jina web searches — brand reputation & context ───────────────
    $progress('🔎 Searching web for brand reputation & customer opinions...', 27);
    $brandSearchQueries = [
        $brandName . ' brand review honest opinion',
        $brandName . ' complaints problems customer experience',
        $brandName . ' vs competitors comparison',
    ];

    foreach ($brandSearchQueries as $q) {
        if ($tavilyKey) {
            $res = tavilySearch($q, $tavilyKey);
            if (!empty($res['answer']) || !empty($res['results'])) {
                $sources[] = [
                    'layer'   => 'Web Search (Tavily)',
                    'label'   => '🔍 ' . $q,
                    'content' => ($res['answer'] ? "AI Answer: {$res['answer']}\n\n" : '') .
                                 implode("\n", array_map(fn($r) => "• {$r['title']}: {$r['content']}", $res['results'])),
                ];
                $stats['search_results'] += count($res['results']);
            }
        } else {
            $res = jinaSearch($q, 4000);
            if ($res) {
                $sources[] = [
                    'layer'   => 'Web Search (Jina)',
                    'label'   => '🔍 ' . $q,
                    'content' => $res,
                ];
                $stats['search_results']++;
            }
        }
        $progress('🔍 Searched: ' . $q, 30);
    }

    // ── STEP 3: Market & category intelligence ────────────────────────────────
    $progress('📊 Researching market landscape & category trends...', 35);
    $category = $brandName; // Will be refined by AI later
    $marketQueries = [
        $brandName . ' industry market size India 2024 2025',
        $brandName . ' target customer psychographic profile',
        'D2C brands like ' . $brandName . ' growth strategy India',
    ];
    foreach ($marketQueries as $q) {
        if ($tavilyKey) {
            $res = tavilySearch($q, $tavilyKey, 'basic');
            if (!empty($res['answer'])) {
                $sources[] = [
                    'layer'   => 'Market Intelligence (Tavily)',
                    'label'   => '📊 ' . $q,
                    'content' => $res['answer'] . "\n\n" . implode("\n", array_map(fn($r) => "• {$r['title']}: {$r['snippet'] ?? $r['content']}", array_slice($res['results'], 0, 4))),
                ];
            }
        } else {
            $res = jinaSearch($q, 3000);
            if ($res) {
                $sources[] = [
                    'layer'   => 'Market Intelligence (Jina)',
                    'label'   => '📊 ' . $q,
                    'content' => $res,
                ];
            }
        }
        $progress('📊 Market research: ' . $q, 40);
    }

    // ── STEP 4: Reddit — real customer voice mining ───────────────────────────
    $progress('💬 Mining Reddit for real customer conversations...', 45);
    $redditQueries = [
        $brandName,
        $brandName . ' review',
    ];
    foreach ($redditQueries as $q) {
        $threads = redditSearch($q, 8);
        if (!empty($threads)) {
            $content = implode("\n\n", array_map(function($t) {
                return "r/{$t['subreddit']} [{$t['score']} upvotes, {$t['num_comments']} comments]\n"
                     . "Title: {$t['title']}\n"
                     . ($t['selftext'] ? "Content: {$t['selftext']}\n" : '')
                     . "URL: {$t['url']}";
            }, $threads));
            $sources[] = [
                'layer'   => 'Reddit Discussions',
                'label'   => '💬 Reddit: "' . $q . '" (' . count($threads) . ' threads)',
                'content' => $content,
            ];
            $stats['reddit_threads'] += count($threads);
            $progress('💬 Reddit: Found ' . count($threads) . ' threads for "' . $q . '"', 52);
        }
    }

    // ── STEP 5: Competitor discovery & research ───────────────────────────────
    $progress('🏆 Discovering and researching competitors...', 55);
    $compSearchQuery = 'top competitors of ' . $brandName . ' brand India same category alternatives';
    if ($tavilyKey) {
        $compRes = tavilySearch($compSearchQuery, $tavilyKey, 'basic');
        $compText = $compRes['answer'] ?? implode(' ', array_column(array_slice($compRes['results'] ?? [], 0, 5), 'content'));
    } else {
        $compText = jinaSearch($compSearchQuery, 5000);
    }

    if ($compText) {
        $sources[] = [
            'layer'   => 'Competitor Discovery',
            'label'   => '🏆 Competitor landscape research',
            'content' => $compText,
        ];

        // Try to extract competitor URLs from the text and crawl their homepages
        preg_match_all('/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9\-]+\.(?:com|in|co\.in|io|net|org))/', $compText, $urlMatches);
        $compUrls = array_unique(array_slice($urlMatches[0] ?? [], 0, 3));
        $compCount = 0;
        foreach ($compUrls as $cUrl) {
            if ($brandUrl && strpos($cUrl, parse_url($brandUrl, PHP_URL_HOST) ?? 'NOMATCH') !== false) continue;
            if (!preg_match('/^https?:\/\//i', $cUrl)) $cUrl = 'https://' . $cUrl;
            $progress('🏆 Crawling competitor: ' . $cUrl, 60 + $compCount * 3);
            $cContent = jinaRead($cUrl, 4000);
            if ($cContent) {
                $sources[] = [
                    'layer'   => 'Competitor Website',
                    'label'   => '🏆 Competitor: ' . parse_url($cUrl, PHP_URL_HOST),
                    'url'     => $cUrl,
                    'content' => $cContent,
                ];
                $stats['competitor_pages']++;
                $compCount++;
            }
            if ($compCount >= 3) break;
        }
    }

    // ── STEP 6: SerpAPI — YouTube and Google (optional) ──────────────────────
    if ($serpKey) {
        $progress('🎥 Searching YouTube for brand reviews & competitor videos...', 72);
        $ytRes = serpSearch($brandName . ' brand review India', $serpKey, 'youtube');
        if (!empty($ytRes)) {
            $sources[] = [
                'layer'   => 'YouTube Videos (SerpAPI)',
                'label'   => '🎥 YouTube: Brand & category videos (' . count($ytRes) . ' found)',
                'content' => implode("\n", array_map(fn($r) => "• {$r['title']}: {$r['snippet']}", array_slice($ytRes, 0, 8))),
            ];
        }

        $progress('📰 Google news search for press coverage...', 76);
        $gnRes = serpSearch($brandName . ' news launch funding India', $serpKey, 'google');
        if (!empty($gnRes)) {
            $sources[] = [
                'layer'   => 'Google News (SerpAPI)',
                'label'   => '📰 Press & news coverage (' . count($gnRes) . ' results)',
                'content' => implode("\n", array_map(fn($r) => "• {$r['title']}: {$r['snippet']}", array_slice($gnRes, 0, 8))),
            ];
        }
    } else {
        // Free fallback: Jina search for news
        $progress('📰 Searching for press coverage & news...', 72);
        $newsSearch = jinaSearch($brandName . ' news press coverage India startup', 3000);
        if ($newsSearch) {
            $sources[] = [
                'layer'   => 'News & Press (Jina)',
                'label'   => '📰 Press coverage & news',
                'content' => $newsSearch,
            ];
        }
    }

    // ── STEP 7: DuckDuckGo instant answer ─────────────────────────────────────
    $progress('🦆 DuckDuckGo instant knowledge lookup...', 82);
    $ddg = duckduckgoSearch($brandName . ' brand');
    if (!empty($ddg['abstract'])) {
        $sources[] = [
            'layer'   => 'DuckDuckGo',
            'label'   => '🦆 DuckDuckGo instant answer',
            'content' => $ddg['abstract'] . ' (Source: ' . $ddg['abstract_src'] . ')',
        ];
    }

    // ── STEP 8: Brand social presence ─────────────────────────────────────────
    $progress('📱 Checking social media presence...', 86);
    foreach (['instagram', 'youtube'] as $platform) {
        $socialQuery = $brandName . ' ' . $platform . ' official account followers';
        if ($tavilyKey) {
            $sRes = tavilySearch($socialQuery, $tavilyKey, 'basic');
            $sContent = $sRes['answer'] ?? '';
        } else {
            $sContent = jinaSearch($socialQuery, 2000);
        }
        if ($sContent) {
            $sources[] = [
                'layer'   => 'Social Intelligence',
                'label'   => '📱 ' . ucfirst($platform) . ' presence research',
                'content' => $sContent,
            ];
        }
    }

    // ── BUILD SUMMARY ─────────────────────────────────────────────────────────
    $progress('🧠 Compiling all intelligence for AI synthesis...', 92);
    $summaryParts = [];
    foreach ($sources as $s) {
        $summaryParts[] = "=== [{$s['layer']}] {$s['label']} ===\n{$s['content']}";
    }
    $summary = implode("\n\n", $summaryParts);
    // Limit total summary to ~40000 chars to avoid token overflow
    $summary = substr($summary, 0, 40000);

    $progress('✅ Research complete. Total sources: ' . count($sources), 100);

    return [
        'sources' => $sources,
        'summary' => $summary,
        'stats'   => $stats,
    ];
}

// ─── AI SYNTHESIS ─────────────────────────────────────────────────────────────
/**
 * synthesizeBrandIntelligence()
 * Takes raw research data and produces structured brand intelligence JSON.
 */
function synthesizeBrandIntelligence(string $brandName, string $brandUrl, string $researchSummary): array {
    $sys = 'You are a senior brand intelligence analyst at a top-tier consulting firm. Your job is to synthesize raw research data into precise, structured brand intelligence. Return ONLY valid JSON matching the requested structure exactly. No preamble, no markdown, no explanation.';

    $prompt = "Brand: {$brandName}\nURL: {$brandUrl}\n\n"
            . "RESEARCH DATA FROM ALL SOURCES:\n{$researchSummary}\n\n"
            . "Synthesize all research into this exact JSON structure. Be SPECIFIC and use actual data found — not generic placeholders. "
            . "If something was not found in research, mark it 'Not found in public data' rather than guessing:\n"
            . "{\n"
            . "  \"brand_overview\": {\n"
            . "    \"founded\": \"Year founded if found\",\n"
            . "    \"headquarters\": \"City, Country\",\n"
            . "    \"founders\": \"Founder names if found\",\n"
            . "    \"funding\": \"Funding raised if found\",\n"
            . "    \"category\": \"Primary product category\",\n"
            . "    \"mission\": \"Brand mission/purpose statement\"\n"
            . "  },\n"
            . "  \"products\": [\n"
            . "    {\"name\": \"Product name\", \"price\": \"Price\", \"usp\": \"What makes it unique\"}\n"
            . "  ],\n"
            . "  \"brand_identity\": {\n"
            . "    \"primary_color\": \"#HEX\",\n"
            . "    \"secondary_color\": \"#HEX\",\n"
            . "    \"logo_style\": \"Description\",\n"
            . "    \"visual_tone\": \"Design aesthetic\",\n"
            . "    \"tone_of_voice\": \"Communication style\"\n"
            . "  },\n"
            . "  \"usps\": [\"USP 1\", \"USP 2\", \"USP 3\"],\n"
            . "  \"competitors\": [\n"
            . "    {\"name\": \"Competitor\", \"website\": \"url\", \"strength\": \"What they do well\", \"weakness\": \"Gap we can exploit\"}\n"
            . "  ],\n"
            . "  \"customer_voice\": {\n"
            . "    \"praise\": [\"What customers love (from reviews/Reddit)\"],\n"
            . "    \"complaints\": [\"Real complaints found\"],\n"
            . "    \"language\": [\"Exact phrases customers use\"]\n"
            . "  },\n"
            . "  \"social_presence\": {\n"
            . "    \"instagram\": \"Handle + followers if found\",\n"
            . "    \"youtube\": \"Channel + subscribers if found\",\n"
            . "    \"content_style\": \"How they post\"\n"
            . "  },\n"
            . "  \"market\": {\n"
            . "    \"category_size\": \"Market size estimate\",\n"
            . "    \"growth_rate\": \"Category growth rate\",\n"
            . "    \"key_trends\": [\"Trend 1\", \"Trend 2\"]\n"
            . "  },\n"
            . "  \"brand_health_score\": {\n"
            . "    \"product_differentiation\": 0,\n"
            . "    \"online_presence\": 0,\n"
            . "    \"customer_sentiment\": 0,\n"
            . "    \"content_quality\": 0,\n"
            . "    \"competitive_positioning\": 0,\n"
            . "    \"brand_clarity\": 0,\n"
            . "    \"revenue_model_strength\": 0,\n"
            . "    \"growth_momentum\": 0\n"
            . "  },\n"
            . "  \"top_3_priority_fixes\": [\"Fix 1 — most urgent\", \"Fix 2\", \"Fix 3\"],\n"
            . "  \"recommended_documents\": [\"diagnosis\", \"market_intelligence\", \"customer_map\", \"product_strategy\", \"revenue_model\", \"brand_voice\", \"growth_playbook\", \"crm_retention\", \"risk_scenarios\", \"execution_plan\"],\n"
            . "  \"research_gaps\": [\"Things AI could not find that the founder must answer\"]\n"
            . "}";

    try {
        return callJSON($sys, $prompt, 4000);
    } catch (Throwable $e) {
        throw new Exception('AI synthesis failed: ' . $e->getMessage());
    }
}

// ─── GENERATE DYNAMIC BRIEFING QUESTIONS ──────────────────────────────────────
function generateBriefingQuestions(string $brandName, array $intelligence): array {
    $sys = 'You are a senior strategy consultant conducting a founder briefing. Generate highly specific, intelligent questions that the internet CANNOT answer about this brand. Return only valid JSON array of question objects.';

    $gaps = implode(', ', $intelligence['research_gaps'] ?? []);
    $health = json_encode($intelligence['brand_health_score'] ?? []);
    $fixes  = implode('; ', $intelligence['top_3_priority_fixes'] ?? []);

    $prompt = "Brand: {$brandName}\n"
            . "Research gaps found: {$gaps}\n"
            . "Brand health scores: {$health}\n"
            . "Priority issues: {$fixes}\n\n"
            . "Generate 8-12 highly specific briefing questions ONLY for things the internet doesn't know about this brand. "
            . "Each question must be something ONLY the founder can answer. Avoid generic questions.\n"
            . "Return JSON array:\n"
            . "[{\"id\": \"q1\", \"category\": \"Finance\", \"question\": \"...\", \"why\": \"Why this matters strategically\", \"placeholder\": \"Example answer format\"}, ...]";

    try {
        return callJSON($sys, $prompt, 2000);
    } catch (Throwable $e) {
        // Fallback to default questions
        return [
            ['id'=>'q1','category'=>'Finance','question'=>'What is your current monthly revenue and what does the breakdown look like by channel?','why'=>'Determines where to invest growth budget','placeholder'=>'e.g. ₹4L/month, 60% D2C website, 40% Amazon'],
            ['id'=>'q2','category'=>'Operations','question'=>'What is your gross margin per unit after COGS and logistics?','why'=>'Critical for pricing strategy and ad budget math','placeholder'=>'e.g. 45% gross margin after shipping'],
            ['id'=>'q3','category'=>'Customer','question'=>'What is your current repeat purchase rate, and do you know why customers come back?','why'=>'Determines retention strategy depth needed','placeholder'=>'e.g. 23% repurchase within 60 days'],
            ['id'=>'q4','category'=>'Product','question'=>'Which is your hero SKU and what does it solve better than everything else in the market?','why'=>'Hero product defines the entire brand narrative','placeholder'=>'e.g. Our overnight muesli is the only one with 3h prep time'],
            ['id'=>'q5','category'=>'Growth','question'=>'What have you tried in marketing that failed, and what was the reason it failed?','why'=>'Prevents repeating expensive mistakes','placeholder'=>'e.g. Tried influencer marketing but got zero conversions'],
            ['id'=>'q6','category'=>'Competitive','question'=>'What do you know about your competitors that they don\'t publicly advertise?','why'=>'Insider intelligence shapes positioning strategy','placeholder'=>'e.g. Our main competitor has quality complaints on Amazon'],
            ['id'=>'q7','category'=>'Vision','question'=>'Where do you want this brand to be in 3 years — category, scale, and exit or IPO?','why'=>'All strategic decisions must align with this end game','placeholder'=>'e.g. ₹50Cr brand acquired by a food conglomerate'],
            ['id'=>'q8','category'=>'Team','question'=>'What does your current team look like and what capability are you most urgently missing?','why'=>'Determines what to outsource vs build in-house','placeholder'=>'e.g. No content creator, doing everything ourselves'],
        ];
    }
}

// ─── GENERATE ONE DOCUMENT MODULE ─────────────────────────────────────────────
function generateDocumentModule(string $brandName, string $moduleId, array $intelligence, array $founderBrief): string {
    $intelStr  = json_encode($intelligence, JSON_UNESCAPED_UNICODE);
    $briefStr  = json_encode($founderBrief, JSON_UNESCAPED_UNICODE);

    $modulePrompts = [
        'diagnosis' => [
            'title'  => 'Brand Diagnosis Report',
            'tokens' => 3000,
            'prompt' => "Write a detailed Brand Diagnosis Report for {$brandName}. This is the honest mirror — before strategy comes truth. Include:\n"
                      . "1. Executive Summary (3-5 sentences — the brutal honest state of the brand)\n"
                      . "2. Brand Positioning Score (score each of the 8 dimensions from the intelligence data with explanation)\n"
                      . "3. Perception Gap Analysis (what the brand says vs what customers actually perceive)\n"
                      . "4. The 3 Critical Brand Leaks (real reasons growth is slow, with evidence from research)\n"
                      . "5. Digital Footprint Audit (website, social, SEO presence quality assessment)\n"
                      . "6. Verdict: Is this primarily a product problem, marketing problem, distribution problem, or brand clarity problem?\n"
                      . "Write like a McKinsey partner giving the CEO their first honest briefing. Be specific, use actual brand data.\n\n"
                      . "INTELLIGENCE DATA:\n{$intelStr}\n\nFOUNDER BRIEF:\n{$briefStr}",
        ],
        'market_intelligence' => [
            'title'  => 'Market Intelligence Brief',
            'tokens' => 3000,
            'prompt' => "Write a Market Intelligence Brief for {$brandName}'s category. Include:\n"
                      . "1. Market Size & Opportunity (TAM/SAM/SOM estimation with reasoning)\n"
                      . "2. Competitor Tier Map (Direct / Indirect / Substitute with specific brands)\n"
                      . "3. For each key competitor: positioning, estimated strengths, exploitable weaknesses\n"
                      . "4. White Space Identification (what no one in this market is doing or saying)\n"
                      . "5. Category Trends (what is rising, what is dying)\n"
                      . "6. The 1 Unfair Advantage opportunity none of the competitors have spotted\n"
                      . "Be specific. Use actual competitor names found in research. Add data where available.\n\n"
                      . "INTELLIGENCE DATA:\n{$intelStr}\n\nFOUNDER BRIEF:\n{$briefStr}",
        ],
        'customer_map' => [
            'title'  => 'Customer Intelligence Map',
            'tokens' => 3000,
            'prompt' => "Write a Customer Intelligence Map for {$brandName}'s audience. Include:\n"
                      . "1. Three Psychographic Personas (not demographics — actual belief systems, fears, aspirations, purchase triggers)\n"
                      . "2. The Job-to-be-Done for each persona (what are they actually hiring this product to do in their life?)\n"
                      . "3. Customer Language Map (exact words and phrases customers use from reviews/Reddit — these become ad copy)\n"
                      . "4. The Emotional Journey Map (what customers feel at awareness → consideration → purchase → post-purchase → loyalty)\n"
                      . "5. Retention Risk Map (what makes them leave, what makes them stay)\n"
                      . "6. The Insight No One Else Has (a non-obvious customer truth that changes the marketing approach)\n"
                      . "Use actual customer language found in research. Be specific.\n\n"
                      . "INTELLIGENCE DATA:\n{$intelStr}\n\nFOUNDER BRIEF:\n{$briefStr}",
        ],
        'brand_voice' => [
            'title'  => 'Brand Voice & Content OS',
            'tokens' => 3000,
            'prompt' => "Write a Brand Voice & Content Operating System for {$brandName}. Include:\n"
                      . "1. Brand Voice Spectrum (position on 5 axes with explanation)\n"
                      . "2. The Core Brand Narrative (origin story, mission, proof points, future vision — fully written)\n"
                      . "3. Content Pillar Architecture (4-5 thematic pillars with rationale + 3 example angles each)\n"
                      . "4. Platform-specific tone adaptation (Instagram, LinkedIn, WhatsApp, packaging copy)\n"
                      . "5. 15 Headlines pre-written in brand voice for immediate use across formats\n"
                      . "6. Content Guardrails (what NOT to say, what topics to avoid)\n"
                      . "Write everything in the actual brand voice, not a description of it.\n\n"
                      . "INTELLIGENCE DATA:\n{$intelStr}\n\nFOUNDER BRIEF:\n{$briefStr}",
        ],
        'growth_playbook' => [
            'title'  => 'Paid Growth Playbook',
            'tokens' => 3500,
            'prompt' => "Write a Paid Growth Playbook for {$brandName}. Include:\n"
                      . "1. Meta Campaign Architecture (funnel stages, creative types, audience logic for THIS brand)\n"
                      . "2. 8 Ad Hook Scripts in brand voice (cold, warm, retargeting — for the 3 customer personas)\n"
                      . "3. Google Search structure (keyword clusters, match types, specific ad copy examples)\n"
                      . "4. Creative Brief for first 5 video ads (visual direction, script structure, emotional arc, 30-60s)\n"
                      . "5. Budget allocation model (how to split by channel stage based on brand stage)\n"
                      . "6. Testing framework (what to test first, how to measure, when to scale)\n"
                      . "7. Advisory Board Perspective: Steve Jobs + Musk (product innovation angle), Buffett + Munger (pricing moat angle), Dentsu (omnichannel scale angle)\n"
                      . "Be specific to this brand's products and customer personas.\n\n"
                      . "INTELLIGENCE DATA:\n{$intelStr}\n\nFOUNDER BRIEF:\n{$briefStr}",
        ],
        'crm_retention' => [
            'title'  => 'CRM & Retention Playbook',
            'tokens' => 3000,
            'prompt' => "Write a CRM & Retention Playbook for {$brandName}. Include:\n"
                      . "1. Email Flow Architecture (Welcome, Post-purchase, Win-back, Loyalty, Educational — with trigger logic)\n"
                      . "2. For each email flow: specific subject lines, preview text, copy hooks, timing intervals\n"
                      . "3. WhatsApp conversation scripts (order updates, tips, replenishment reminders — in brand voice)\n"
                      . "4. Loyalty Program Design (mechanics, reward structure, gamification)\n"
                      . "5. NPS System Design (when to ask, how to segment responses, how to close the loop)\n"
                      . "6. Subscription Model Design (if applicable — what goes in, at what cadence, at what price)\n"
                      . "Write the actual copy, not a description of what copy should say.\n\n"
                      . "INTELLIGENCE DATA:\n{$intelStr}\n\nFOUNDER BRIEF:\n{$briefStr}",
        ],
        'revenue_model' => [
            'title'  => 'Revenue Architecture Model',
            'tokens' => 3000,
            'prompt' => "Write a Revenue Architecture Model for {$brandName}. Include:\n"
                      . "1. Current Unit Economics Assessment (estimate based on category benchmarks if founder data not available)\n"
                      . "2. Pricing Power Analysis (where is room to raise prices without volume drop?)\n"
                      . "3. Bundle Architecture (specific bundle recommendations with projected AOV lift %)\n"
                      . "4. LTV Modeling (3 scenarios: current state, improved retention, subscription layer added)\n"
                      . "5. Revenue Bridge to 2x (which levers, in which sequence, over what timeline)\n"
                      . "6. CAC Benchmarks vs category average and what a healthy CAC looks like for this brand\n"
                      . "7. Margin Expansion Opportunities (where can COGS be reduced without quality sacrifice)\n"
                      . "Be specific with numbers. Use benchmarks from the category if actual data not given.\n\n"
                      . "INTELLIGENCE DATA:\n{$intelStr}\n\nFOUNDER BRIEF:\n{$briefStr}",
        ],
        'execution_plan' => [
            'title'  => '90-Day Execution Roadmap',
            'tokens' => 3500,
            'prompt' => "Write a 90-Day Execution Operating Manual for {$brandName}. This is not a generic timeline — it is an operating system. Include:\n"
                      . "MONTH 1 — Foundation & Diagnosis\n"
                      . "• Week-by-week initiative breakdown with specific owner roles and 'done' criteria\n"
                      . "• Key decisions to make in Month 1 with decision frameworks\n"
                      . "• Quick wins that build momentum (must show results in 30 days)\n"
                      . "MONTH 2 — Build & Scale\n"
                      . "• What to build, launch, or optimize based on Month 1 learnings\n"
                      . "• Scale criteria: when to increase budget, when to kill a test\n"
                      . "MONTH 3 — Moat Building\n"
                      . "• Long-term competitive moat initiatives to launch\n"
                      . "• Retention and loyalty systems to activate\n"
                      . "KPI DASHBOARD DESIGN:\n"
                      . "• Which metrics to track weekly vs monthly, with target thresholds\n"
                      . "• Red flags to watch for that indicate strategy adjustment needed\n"
                      . "TEAM STRUCTURE:\n"
                      . "• Who to hire next, in what order, with what skills\n\n"
                      . "INTELLIGENCE DATA:\n{$intelStr}\n\nFOUNDER BRIEF:\n{$briefStr}",
        ],
        'risk_scenarios' => [
            'title'  => 'Risk & Scenario Planning',
            'tokens' => 2500,
            'prompt' => "Write a Risk & Scenario Planning report for {$brandName}. Include:\n"
                      . "1. Top 5 Threats in the next 12 months (for THIS brand specifically, based on research)\n"
                      . "   For each: probability, impact severity, early warning signals, mitigation playbook\n"
                      . "2. Scenario Modeling: 3 futures\n"
                      . "   • Bear Case (what happens if CAC rises 40% and category competition intensifies)\n"
                      . "   • Base Case (current trajectory with strategy improvements)\n"
                      . "   • Bull Case (if everything goes right — what does the brand look like?)\n"
                      . "3. Category Disruption Risk (what tech or trend could make this category obsolete?)\n"
                      . "4. Platform Dependency Risk (over-reliance on any single channel, marketplace, or supplier)\n"
                      . "5. Founder Blind Spots (based on the briefing data — what risks is the founder not seeing?)\n\n"
                      . "INTELLIGENCE DATA:\n{$intelStr}\n\nFOUNDER BRIEF:\n{$briefStr}",
        ],
        'product_strategy' => [
            'title'  => 'Product Strategy Brief',
            'tokens' => 3000,
            'prompt' => "Write a Product Strategy Brief for {$brandName}. Include:\n"
                      . "1. Current Product Line Audit (hero vs filler SKUs, pricing ladder gaps, which SKUs to kill)\n"
                      . "2. First-Principles Product Redesign (applying Jobs/Musk thinking — what would they redesign?)\n"
                      . "3. Three New Product Concepts derived from customer Job-to-be-Done gaps found in research\n"
                      . "4. SKU Rationalization (what to kill, what to double down on, what to launch)\n"
                      . "5. Packaging Redesign Brief (materials, information hierarchy, sustainability signal, unboxing experience)\n"
                      . "6. Price Architecture Redesign (good/better/best if not already present)\n"
                      . "Be specific. Use actual product names from the research data.\n\n"
                      . "INTELLIGENCE DATA:\n{$intelStr}\n\nFOUNDER BRIEF:\n{$briefStr}",
        ],
    ];

    if (!isset($modulePrompts[$moduleId])) {
        throw new Exception("Unknown module: {$moduleId}");
    }

    $mod    = $modulePrompts[$moduleId];
    $sys    = 'You are a senior partner at a top-tier brand strategy consulting firm. Write with the depth, specificity, and authority of a McKinsey or BCG engagement partner. Every recommendation must be specific to THIS brand\'s actual data — no generic advice. Use structured headings and bullet points for readability.';

    return callAI($sys, $mod['prompt'], $mod['tokens']);
}
