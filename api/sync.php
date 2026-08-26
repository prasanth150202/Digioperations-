<?php
require_once __DIR__ . '/config.php';
ini_set('memory_limit', '512M');
set_time_limit(240);

// CLI vs Web authentication helper
$user = null;
if (php_sapi_name() === 'cli') {
    // CLI execution
    $brandSlug = '';
    $opts = getopt('', ['brand:', 'start:', 'end:', 'sync_all::']);
    $slug = $opts['brand'] ?? '';
    $startDate = $opts['start'] ?? date('Y-m-d', strtotime('-1 day'));
    $endDate = $opts['end'] ?? date('Y-m-d', strtotime('-1 day'));
    $action = 'sync';
    
    if (!$slug) {
        die("Usage: php api/sync.php --brand=brand-slug [--start=YYYY-MM-DD] [--end=YYYY-MM-DD]\n");
    }
    $brand = dbGet('SELECT * FROM brands WHERE slug=?', [$slug]);
    if (!$brand) die("Error: Brand not found.\n");
} else {
    // Web execution
    $user = requireAuth();
    $slug = $_GET['brand_id'] ?? '';
    $startDate = $_GET['start_date'] ?? '';
    $endDate = $_GET['end_date'] ?? '';
    $action = $_GET['action'] ?? '';
    
    if (!$slug) json_err('Brand slug required');
    if (!canAccessBrand($user, $slug)) json_err('Access denied', 403);
    
    // Support lookup by ID or slug
    $brand = dbGet('SELECT * FROM brands WHERE slug=? OR id=?', [$slug, $slug]);
    if (!$brand) json_err('Brand not found', 404);
}

// ── GET CONFIGURATION TOKENS ──
$int = json_decode($brand['integrations_json'] ?? '{}', true);

// If testing connections, use payload from body
if ($action === 'test_connections') {
    $body = body();
    if (!empty($body)) $int = $body;
}

// Normalize the Shopify subdomain field — the UI asks for just the bare subdomain (e.g.
// "blackape"), but if someone pastes a full URL (e.g. "http://blackape.myshopify.com") it gets
// concatenated into "https://http://blackape.myshopify.com.myshopify.com", which fails to
// resolve and shows up as a connection timeout rather than the actual input mistake.
if (!empty($int['shopify_subdomain'])) {
    $sd = trim($int['shopify_subdomain']);
    $sd = preg_replace('#^https?://#i', '', $sd);
    $sd = preg_replace('#\.myshopify\.com.*$#i', '', $sd);
    $sd = trim($sd, "/ \t\n\r\0\x0B");
    $int['shopify_subdomain'] = $sd;
}

// Normalize the GSC site URL — "sc-domain:example.com" is Search Console's own scheme-like
// prefix for a Domain property and should never be preceded by http(s)://, but it's an easy
// combination to type by mistake (e.g. "http://sc-domain:example.com"), which Google's API
// correctly rejects as not a valid site URL. Also undo an accidentally pre-encoded colon
// (literal "%3A" typed/pasted in instead of ":") before checking, and strip a stray leading
// "%3A" left behind if "sc-domain" itself got lost in an earlier bad edit.
if (!empty($int['gsc_site_url'])) {
    $g = trim($int['gsc_site_url']);
    $g = str_ireplace('%3a', ':', $g);
    $g = preg_replace('#^https?://(sc-domain:)#i', '$1', $g);
    $g = preg_replace('#^:#', 'sc-domain:', $g); // e.g. stray ":example.com" -> "sc-domain:example.com"
    $int['gsc_site_url'] = $g;
}

// ── GOOGLE CLIENT REFRESH TOKEN HELPER ──
function getGoogleAccessToken() {
    $clientId = getSetting('google_client_id');
    $clientSecret = getSetting('google_client_secret');
    $refreshToken = getSetting('google_refresh_token');
    
    if (empty($clientId) || empty($clientSecret) || empty($refreshToken)) {
        return null;
    }
    
    $ch = curl_init("https://oauth2.googleapis.com/token");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'refresh_token' => $refreshToken,
        'grant_type' => 'refresh_token'
    ]));

    $resp = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($status !== 200) return null;
    $data = json_decode($resp, true);
    return $data['access_token'] ?? null;
}

// ── ACTION: TEST CONNECTIONS ──
// Every check below runs through one curl_multi batch instead of sequential curl_exec calls,
// so the total wait is bounded by the single slowest check (~10-15s) rather than their sum
// (previously up to ~50s+ with all 5 integrations configured, which read as the UI "hanging").
if ($action === 'test_connections') {
    $res = ['shopify' => 'disabled', 'meta' => 'disabled', 'google_ads' => 'disabled', 'ga4' => 'disabled', 'gsc' => 'disabled'];
    $mh = curl_multi_init();
    $handles = []; // key => curl handle, for every check we actually queue up

    // Resolve real (unmasked) tokens up front — trimmed defensively in case stray whitespace/
    // newlines got saved into an older record before the save form started trimming on its own.
    $shopifyTok = trim($int['shopify_access_token'] ?? '');
    if (empty($shopifyTok) || $shopifyTok === str_repeat('·', 8) || $shopifyTok === str_repeat('•', 16)) {
        $dbBrand = dbGet('SELECT integrations_json FROM brands WHERE id=?', [$brand['id']]);
        $dbInt = json_decode($dbBrand['integrations_json'] ?? '{}', true);
        $shopifyTok = trim($dbInt['shopify_access_token'] ?? '');
    }
    $metaTok = trim($int['meta_access_token'] ?? '');
    if (empty($metaTok) || $metaTok === str_repeat('·', 8) || $metaTok === str_repeat('•', 16)) {
        $dbBrand = dbGet('SELECT integrations_json FROM brands WHERE id=?', [$brand['id']]);
        $dbInt = json_decode($dbBrand['integrations_json'] ?? '{}', true);
        $metaTok = trim($dbInt['meta_access_token'] ?? '');
    }

    // 1. Shopify
    if (!empty($int['shopify_enabled']) && !empty($int['shopify_subdomain']) && !empty($shopifyTok)) {
        $ch = curl_init("https://{$int['shopify_subdomain']}.myshopify.com/admin/api/2025-01/shop.json");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ["X-Shopify-Access-Token: {$shopifyTok}"]);
        $handles['shopify'] = $ch;
    }

    // 2. Meta — test EVERY configured account, not just the first. A token can easily be valid
    // for an account that's been connected a while but not yet granted access to one just added,
    // and that was previously invisible here since only $accts[0] ever got checked.
    $accts = array_filter(array_map('trim', explode(',', $int['meta_ad_account_ids'] ?? '')));
    $metaAcctByKey = [];
    if (!empty($accts) && !empty($metaTok)) {
        foreach (array_values($accts) as $i => $testAcct) {
            if (!str_starts_with($testAcct, 'act_')) $testAcct = 'act_' . $testAcct;
            $key = "meta_{$i}";
            $metaAcctByKey[$key] = $testAcct;
            $ch = curl_init("https://graph.facebook.com/v21.0/{$testAcct}?fields=id,name&access_token=" . urlencode($metaTok));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
            $handles[$key] = $ch;
        }
    }

    // 3. Google family (Ads / GA4 / GSC) — share one OAuth token, itself now timeout-bounded
    $gAccessToken = getGoogleAccessToken();
    if ($gAccessToken) {
        if (!empty($int['google_ads_enabled']) && !empty($int['google_ads_customer_id'])) {
            $cust = preg_replace('/[^0-9]/', '', $int['google_ads_customer_id']);
            if (!empty($cust)) {
                $devTok = getSetting('google_developer_token');
                $mccRaw = !empty($int['google_ads_mcc_id']) ? preg_replace('/[^0-9]/', '', $int['google_ads_mcc_id']) : '';
                $mcc = !empty($mccRaw) ? $mccRaw : $cust;
                $ch = curl_init("https://googleads.googleapis.com/v19/customers/{$cust}/googleAds:search");
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    "Authorization: Bearer {$gAccessToken}",
                    "developer-token: {$devTok}",
                    "login-customer-id: {$mcc}",
                    "Content-Type: application/json"
                ]);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['query' => "SELECT campaign.id FROM campaign LIMIT 1"]));
                $handles['google_ads'] = $ch;
            } else {
                $res['google_ads'] = 'Failed (Invalid or missing Google Ads Customer ID)';
            }
        }

        if (!empty($int['ga4_property_id'])) {
            $ch = curl_init("https://analyticsdata.googleapis.com/v1beta/properties/{$int['ga4_property_id']}:runReport");
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$gAccessToken}", "Content-Type: application/json"]);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
                'dateRanges' => [['startDate' => date('Y-m-d'), 'endDate' => date('Y-m-d')]],
                'metrics' => [['name' => 'sessions']]
            ]));
            $handles['ga4'] = $ch;
        }

        if (!empty($int['gsc_site_url'])) {
            $gscUrl = urlencode($int['gsc_site_url']);
            $ch = curl_init("https://www.googleapis.com/webmasters/v3/sites/{$gscUrl}/searchAnalytics/query");
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$gAccessToken}", "Content-Type: application/json"]);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
                'startDate' => date('Y-m-d', strtotime('-7 days')),
                'endDate' => date('Y-m-d', strtotime('-1 day')),
                'rowLimit' => 1
            ]));
            $handles['gsc'] = $ch;
        }
    } else if (!empty($int['google_ads_enabled']) || !empty($int['ga4_property_id']) || !empty($int['gsc_site_url'])) {
        $res['google_ads'] = $res['ga4'] = $res['gsc'] = 'Failed (Google OAuth unauthorized)';
    }

    // Run every queued check concurrently
    foreach ($handles as $ch) curl_multi_add_handle($mh, $ch);
    $running = null;
    do {
        curl_multi_exec($mh, $running);
        curl_multi_select($mh, 1.0);
    } while ($running > 0);

    foreach ($handles as $key => $ch) {
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errno = curl_errno($ch);
        if ($code === 200) {
            $res[$key] = 'Connected';
        } elseif ($errno === CURLE_OPERATION_TIMEDOUT) {
            $res[$key] = 'Failed (timeout — server could not reach the endpoint in time)';
        } elseif ($errno !== 0) {
            // Any other curl-level failure (DNS resolution, malformed URL, connection refused, SSL, etc.)
            $res[$key] = 'Failed (' . curl_error($ch) . ')';
        } else {
            // Got a real HTTP response back — surface the API's own error message if present,
            // instead of just the bare status code, so a wrong token/ID is diagnosable at a glance.
            // Different APIs shape their error bodies differently (Meta: error.message, Google:
            // error.message, Shopify: errors as a plain string OR an object of field => [messages]),
            // so try each in turn and fall back to a raw body snippet rather than showing nothing.
            $body = curl_multi_getcontent($ch);
            $decoded = json_decode($body, true);
            $apiMsg = '';
            if (is_array($decoded)) {
                if (!empty($decoded['error']['message'])) {
                    $apiMsg = $decoded['error']['message'];
                } elseif (!empty($decoded['errors'])) {
                    if (is_string($decoded['errors'])) {
                        $apiMsg = $decoded['errors'];
                    } elseif (is_array($decoded['errors'])) {
                        $first = reset($decoded['errors']);
                        $apiMsg = is_string($first) ? $first : (is_array($first) ? ($first['message'] ?? json_encode($first)) : json_encode($decoded['errors']));
                    }
                } elseif (!empty($decoded['error_description'])) {
                    $apiMsg = $decoded['error_description'];
                } elseif (!empty($decoded['message'])) {
                    $apiMsg = $decoded['message'];
                }
            }
            if ($apiMsg === '' && !empty($body)) {
                $apiMsg = trim(strip_tags($body));
            }
            $res[$key] = 'Failed (' . $code . ($apiMsg !== '' ? ': ' . substr($apiMsg, 0, 100) : '') . ')';
        }
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);

    // Collapse the per-account meta_0/meta_1/... results (added above so every configured
    // account actually gets tested) back into the single `meta` field the settings UI reads —
    // "Connected" only if every account passed, otherwise name which account(s) failed instead
    // of just reporting on whichever one happened to be first.
    if (!empty($metaAcctByKey)) {
        $failedAccts = [];
        foreach ($metaAcctByKey as $key => $acctId) {
            if (($res[$key] ?? '') !== 'Connected') $failedAccts[] = "{$acctId}: " . ($res[$key] ?? 'unknown error');
            unset($res[$key]);
        }
        $res['meta'] = empty($failedAccts)
            ? 'Connected'
            : 'Failed (' . count($failedAccts) . ' of ' . count($metaAcctByKey) . ' accounts — ' . implode('; ', array_slice($failedAccts, 0, 3)) . ')';
    }

    json_out(array_merge(['ok' => true], $res));
}

// ── CORE SYNC EXECUTION ──
if (empty($startDate) || empty($endDate)) {
    if (php_sapi_name() === 'cli') die("Error: start and end dates required.\n");
    json_err('start_date and end_date required');
}

// Resolve password / token obfuscation values (trimmed defensively — see test_connections above)
$shopifyToken = trim($int['shopify_access_token'] ?? '');
if ($shopifyToken === str_repeat('·', 8)) {
    $dbBrand = dbGet('SELECT integrations_json FROM brands WHERE id=?', [$brand['id']]);
    $dbInt = json_decode($dbBrand['integrations_json'] ?? '{}', true);
    $shopifyToken = trim($dbInt['shopify_access_token'] ?? '');
}

$metaToken = trim($int['meta_access_token'] ?? '');
if ($metaToken === str_repeat('·', 8)) {
    $dbBrand = dbGet('SELECT integrations_json FROM brands WHERE id=?', [$brand['id']]);
    $dbInt = json_decode($dbBrand['integrations_json'] ?? '{}', true);
    $metaToken = trim($dbInt['meta_access_token'] ?? '');
}

// 1. Google OAuth Client Access
$gAccessToken = getGoogleAccessToken();

// Google Ads, GA4, and Search Console all share this ONE org-wide OAuth token — connected
// separately by a superadmin via the "Google Global Keys" panel, NOT the per-brand
// Integrations modal (which only has plain fields like a property ID or customer ID, no
// "enabled"/OAuth-status indicator). If a brand has any of those three configured but the
// shared token is missing or expired, all three quietly return zero data below with nothing
// in the sync output to explain why — surface it explicitly instead.
$syncWarnings = [];
if (!$gAccessToken && (!empty($int['google_ads_enabled']) || !empty($int['ga4_property_id']) || !empty($int['gsc_site_url']))) {
    $syncWarnings[] = 'Google Ads / GA4 / Search Console data was not pulled: the shared Google account is not connected (or its access has expired). This is a separate, org-wide connection from the per-brand integration fields — ask a superadmin to reconnect it under Admin → Google Global Keys.';
}

// Create datetime periods array
$dates = [];
$curr = strtotime($startDate);
$last = strtotime($endDate);
while ($curr <= $last) {
    $dates[] = date('Y-m-d', $curr);
    $curr = strtotime('+1 day', $curr);
}

// Stats outputs
$syncShopifyCount = 0;
$syncMetaCount = 0;
$syncGoogleAdsCount = 0;
$syncGA4Count = 0;
$syncGSCCount = 0;

$metaCampaigns = [];
$metaCreatives = [];
$metaAdAudit = new stdClass();
$googleCampaigns = [];
$googleAdAudit = new stdClass();
$googleSearchAds = [];
$ga4Channels = [];
$ga4Funnel = [];
$gscPages = [];
$gscQueries = [];
$shopifyProducts = [];
$shopifyLocations = [];
$shopifyCampaigns = [];
$cohortMatrix = [];

// ── CRAWL THIRD-PARTY APIS FOR RANGE ──

// A. Shopify Rest API
if (!empty($int['shopify_enabled']) && !empty($int['shopify_subdomain']) && !empty($shopifyToken)) {
    $sub = $int['shopify_subdomain'];
    $url = "https://{$sub}.myshopify.com/admin/api/2025-01/orders.json?status=any&created_at_min={$startDate}T00:00:00%2B05:30&created_at_max={$endDate}T23:59:59%2B05:30&limit=250";
    
    $orders = [];
    while ($url) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "X-Shopify-Access-Token: {$shopifyToken}",
            "Content-Type: application/json"
        ]);
        $resp = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        // Read link headers for pagination
        $headerText = '';
        curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($ch, $header) use (&$headerText) {
            $headerText .= $header;
            return strlen($header);
        });
        curl_exec($ch);
        curl_close($ch);
        
        if ($status !== 200) {
            if (php_sapi_name() === 'cli') echo "Shopify sync failed: " . $resp . "\n";
            break;
        }
        
        $data = json_decode($resp, true);
        $orders = array_merge($orders, $data['orders'] ?? []);
        
        // Link header regex pagination check
        $url = null;
        if (preg_match('/<([^>]+)>;\s*rel="next"/', $headerText, $match)) {
            $url = $match[1];
        }
    }
    
    // Group Shopify orders by date (Kolkata offset time)
    $shopifyDaily = [];
    $prodAgg = [];
    $cityAgg = [];
    $utmAgg = [];
    
    $seenCustomers = [];
    $newCustomersCount = 0;
    
    foreach ($orders as $order) {
        if (!empty($order['cancelled_at'])) continue;
        
        $date = substr($order['created_at'], 0, 10);
        if (!isset($shopifyDaily[$date])) {
            $shopifyDaily[$date] = ['sales' => 0, 'orders' => 0, 'new_cust' => 0];
        }
        
        $subtotal = (float)($order['subtotal_price'] ?? 0.0);
        $shopifyDaily[$date]['sales'] += $subtotal;
        $shopifyDaily[$date]['orders'] += 1;
        
        // Track customer acquisition
        if (!empty($order['customer'])) {
            $cid = $order['customer']['id'];
            if (!in_array($cid, $seenCustomers)) {
                $seenCustomers[] = $cid;
                $isNew = ($order['customer']['orders_count'] === 1) || 
                         (!empty($order['customer']['created_at']) && substr($order['customer']['created_at'], 0, 7) === substr($order['created_at'], 0, 7));
                if ($isNew) {
                    $shopifyDaily[$date]['new_cust'] += 1;
                    $newCustomersCount++;
                }
            }
        }
        
        // Shipping region — computed before line items so each product can be cross-referenced
        // against the region of the order it shipped in (see Product×Region aggregation below).
        $addr = $order['shipping_address'] ?? $order['billing_address'] ?? [];
        $city = trim($addr['city'] ?? 'Unknown');
        $prov = trim($addr['province'] ?? '');
        $loc = $prov ? $city . ', ' . $prov : $city;
        if (!isset($cityAgg[$loc])) $cityAgg[$loc] = ['location' => $loc, 'orders' => 0, 'revenue' => 0];
        $cityAgg[$loc]['orders'] += 1;
        $cityAgg[$loc]['revenue'] += $subtotal;

        // Aggregates for reports (products cross-referenced with the region of the order)
        foreach ($order['line_items'] ?? [] as $item) {
            $name = trim($item['title'] ?? '');
            if (empty($name)) continue;
            $qty = (int)($item['quantity'] ?? 0);
            $price = (float)($item['price'] ?? 0.0);
            $lineRevenue = $qty * $price;
            if (!isset($prodAgg[$name])) $prodAgg[$name] = ['name' => $name, 'orders' => 0, 'revenue' => 0, 'regions' => []];
            $prodAgg[$name]['orders'] += $qty;
            $prodAgg[$name]['revenue'] += $lineRevenue;
            if (!isset($prodAgg[$name]['regions'][$loc])) $prodAgg[$name]['regions'][$loc] = 0;
            $prodAgg[$name]['regions'][$loc] += $lineRevenue;
        }

        // Feed the persistent cohort ledger so repeat-purchase behavior can be tracked across
        // months over time (a single sync only ever sees orders within its own date range).
        if (!empty($order['id']) && !empty($order['customer']['id'])) {
            try {
                dbRun('INSERT INTO shopify_customer_orders (id, brand_id, shopify_order_id, shopify_customer_id, order_date, order_value) VALUES (?,?,?,?,?,?)
                       ON DUPLICATE KEY UPDATE order_value = VALUES(order_value)',
                    [uuid4(), $brand['id'], (string)$order['id'], (string)$order['customer']['id'], $date, $subtotal]);
            } catch (Throwable $e) {}
        }

        // UTM campaign mapping — classified straight into report-ready channel buckets
        // (Meta/Google split into Paid vs Organic, WhatsApp broadcast traffic, and a catch-all
        // "Others" bucket for Direct/email/everything-low-traffic) instead of one row per raw
        // source+campaign pair, since the attribution slide reports channel-level totals.
        $landing = $order['landing_site'] ?? '';
        $referring = $order['referring_site'] ?? '';

        $rawSource = '';
        $rawCampaign = '';
        if (preg_match('/utm_source=([^&]+)/', $landing, $m)) $rawSource = strtolower(urldecode($m[1]));
        if (preg_match('/utm_campaign=([^&]+)/', $landing, $m)) $rawCampaign = strtolower(urldecode($m[1]));

        $channel = 'Others';
        if ($rawSource !== '') {
            if (preg_match('/zingbot|whatsapp/', $rawSource)) {
                $channel = 'WhatsApp';
            } elseif (preg_match('/facebook|instagram|^fb$|^ig$|meta/', $rawSource)) {
                $channel = 'Meta Paid';
            } elseif (preg_match('/google/', $rawSource)) {
                $channel = strpos($rawCampaign, 'organic') !== false ? 'Google Organic' : 'Google Paid';
            }
        } elseif (!empty($referring)) {
            if (preg_match('/instagram\.com|facebook\.com/i', $referring)) {
                $channel = 'Meta Organic';
            } elseif (preg_match('/google\./i', $referring)) {
                $channel = 'Google Organic';
            }
        }

        if (!isset($utmAgg[$channel])) $utmAgg[$channel] = ['channel' => $channel, 'orders' => 0, 'revenue' => 0];
        $utmAgg[$channel]['orders'] += 1;
        $utmAgg[$channel]['revenue'] += $subtotal;
    }
    
    // Sort and slice top products, then attach each product's primary shipping region
    // (Product×Region cross-reference) and its share of total product revenue.
    usort($prodAgg, fn($a, $b) => $b['revenue'] <=> $a['revenue']);
    $shopifyProducts = array_slice($prodAgg, 0, 6);
    $totalProductRevenue = array_sum(array_column($prodAgg, 'revenue'));
    foreach ($shopifyProducts as &$p) {
        $topRegion = 'Unknown';
        $topRegionRev = -1;
        foreach ($p['regions'] as $region => $rev) {
            if ($rev > $topRegionRev) { $topRegionRev = $rev; $topRegion = $region; }
        }
        $p['primary_region'] = $topRegion;
        $p['revenue_share'] = $totalProductRevenue > 0 ? round($p['revenue'] / $totalProductRevenue * 100, 1) : 0;
        unset($p['regions']);
    }
    unset($p);

    usort($cityAgg, fn($a, $b) => $b['revenue'] <=> $a['revenue']);
    $shopifyLocations = array_slice($cityAgg, 0, 8);

    usort($utmAgg, fn($a, $b) => $b['revenue'] <=> $a['revenue']);
    $shopifyCampaigns = $utmAgg; // at most 6 channel buckets now, nothing to slice

    // ── BACKFILL THE COHORT LEDGER WITH A TRAILING HISTORICAL WINDOW ──
    // The ledger otherwise only grows from orders inside each report's own date range, so the
    // cohort matrix would only reach real multi-month depth after several months of syncing.
    // Pull an extra ~6 months of order history (customer id + date + value only, via `fields=`
    // to keep the payload light) purely to seed the ledger, before computing the matrix below —
    // this doesn't touch $shopifyDaily/day-level revenue, only the ledger table. Matches the
    // 6-month cohort depth (rows and Month-0..5 columns) computed below.
    try {
        $backfillStart = date('Y-m-01', strtotime($startDate . ' -6 months'));
        $backfillEnd = date('Y-m-d', strtotime($startDate . ' -1 day'));
        if (strtotime($backfillStart) < strtotime($backfillEnd)) {
            $bfUrl = "https://{$sub}.myshopify.com/admin/api/2025-01/orders.json?status=any&fields=id,customer,created_at,subtotal_price,cancelled_at&created_at_min={$backfillStart}T00:00:00%2B05:30&created_at_max={$backfillEnd}T23:59:59%2B05:30&limit=250";
            while ($bfUrl) {
                $ch = curl_init($bfUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 20);
                curl_setopt($ch, CURLOPT_HTTPHEADER, ["X-Shopify-Access-Token: {$shopifyToken}"]);
                $bfHeaderText = '';
                curl_setopt($ch, CURLOPT_HEADERFUNCTION, function ($ch, $header) use (&$bfHeaderText) { $bfHeaderText .= $header; return strlen($header); });
                $bfResp = curl_exec($ch);
                $bfStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                if ($bfStatus !== 200) break;

                $bfData = json_decode($bfResp, true);
                foreach ($bfData['orders'] ?? [] as $bfOrder) {
                    if (!empty($bfOrder['cancelled_at']) || empty($bfOrder['customer']['id']) || empty($bfOrder['id'])) continue;
                    try {
                        dbRun('INSERT INTO shopify_customer_orders (id, brand_id, shopify_order_id, shopify_customer_id, order_date, order_value) VALUES (?,?,?,?,?,?)
                               ON DUPLICATE KEY UPDATE order_value = VALUES(order_value)',
                            [uuid4(), $brand['id'], (string)$bfOrder['id'], (string)$bfOrder['customer']['id'], substr($bfOrder['created_at'], 0, 10), (float)($bfOrder['subtotal_price'] ?? 0)]);
                    } catch (Throwable $e) {}
                }

                $bfUrl = null;
                if (preg_match('/<([^>]+)>;\s*rel="next"/', $bfHeaderText, $bfMatch)) $bfUrl = $bfMatch[1];
            }
        }
    } catch (Throwable $e) {}

    // ── REPEAT-PURCHASE COHORT MATRIX (from the persistent ledger, not just this period) ──
    try {
        $firstOrders = dbAll('SELECT shopify_customer_id, MIN(order_date) AS first_date FROM shopify_customer_orders WHERE brand_id=? GROUP BY shopify_customer_id', [$brand['id']]);
        $firstMonthByCustomer = [];
        foreach ($firstOrders as $fo) {
            $firstMonthByCustomer[$fo['shopify_customer_id']] = substr($fo['first_date'], 0, 7);
        }

        $allLedgerOrders = dbAll('SELECT shopify_customer_id, order_date FROM shopify_customer_orders WHERE brand_id=?', [$brand['id']]);
        $ordersByCustomerMonth = [];
        foreach ($allLedgerOrders as $o) {
            $ordersByCustomerMonth[$o['shopify_customer_id']][substr($o['order_date'], 0, 7)] = true;
        }

        $cohorts = [];
        foreach ($firstMonthByCustomer as $cust => $month) {
            $cohorts[$month][] = $cust;
        }
        ksort($cohorts);
        $reportMonth = substr($endDate, 0, 7);
        $recentCohortMonths = array_slice(array_keys($cohorts), -6);

        foreach ($recentCohortMonths as $cohortMonth) {
            $custIds = $cohorts[$cohortMonth];
            $cohortSize = count($custIds);
            $row = ['cohort_month' => $cohortMonth, 'cohort_size' => $cohortSize, 'months' => []];
            for ($offset = 0; $offset <= 5; $offset++) {
                $targetMonth = date('Y-m', strtotime($cohortMonth . '-01 +' . $offset . ' months'));
                if ($targetMonth > $reportMonth) {
                    $row['months'][$offset] = null; // hasn't happened yet, don't fabricate a value
                    continue;
                }
                $activeCount = 0;
                foreach ($custIds as $cid) {
                    if (!empty($ordersByCustomerMonth[$cid][$targetMonth])) $activeCount++;
                }
                $row['months'][$offset] = $cohortSize > 0 ? round($activeCount / $cohortSize * 100, 1) : 0.0;
            }
            $cohortMatrix[] = $row;
        }
    } catch (Throwable $e) {}

    $syncShopifyCount = count($orders);
}

// Fetches one Meta Graph API insights URL with a bounded timeout, and records any curl-level
// or Graph-API-level error into $errors (keyed by ad account) instead of silently degrading to
// an empty result. Without this, a problem specific to one account — e.g. the token not yet
// having been granted access to a newly-added account, or a rate limit now that syncing 2+
// accounts multiplies the request count — was indistinguishable from "this account genuinely
// has no data for the period," which is exactly what made a broken second account invisible.
function fetchMetaInsights(string $url, string $acct, array &$errors): array {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 25);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    $resp = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($resp === false) {
        $errors[$acct][] = "Request failed: {$curlErr}";
        return [];
    }
    $data = json_decode($resp, true);
    if ($status !== 200 || isset($data['error'])) {
        $errors[$acct][] = $data['error']['message'] ?? "HTTP {$status}";
        return [];
    }
    return $data['data'] ?? [];
}

// B. Meta Ads insights
if (!empty($int['meta_ad_account_ids']) && !empty($metaToken)) {
    $accts = array_filter(array_map('trim', explode(',', $int['meta_ad_account_ids'])));
    $timeRange = json_encode(['since' => $startDate, 'until' => $endDate]);

    $metaDaily = [];
    $metaAnglesTested = 0;
    $metaPlacementAgg = [];
    $metaSyncErrors = [];

    foreach ($accts as $acct) {
        // Auto-add act_ prefix if not present (Meta Graph API requires it)
        if (!str_starts_with($acct, 'act_')) $acct = 'act_' . $acct;

        // 1. Campaign Breakdown
        $cf = urlencode("campaign_name,spend,impressions,clicks,actions,action_values");
        $curlUrl = "https://graph.facebook.com/v21.0/{$acct}/insights?fields={$cf}&level=campaign&time_range=" . urlencode($timeRange) . "&limit=100&access_token=" . urlencode($metaToken);

        foreach (fetchMetaInsights($curlUrl, $acct, $metaSyncErrors) as $row) {
            $spend = (float)($row['spend'] ?? 0.0);
            $revenue = 0.0;
            $orders = 0;
            foreach ($row['action_values'] ?? [] as $av) {
                if ($av['action_type'] === 'purchase') $revenue = (float)$av['value'];
            }
            foreach ($row['actions'] ?? [] as $ac) {
                if ($ac['action_type'] === 'purchase') $orders = (int)$ac['value'];
            }
            $metaCampaigns[] = [
                'channel' => 'META',
                'name' => $row['campaign_name'] ?? 'Campaign',
                'spent' => round($spend),
                'sales' => round($revenue),
                'orders' => $orders,
                'roas' => $spend > 0 ? number_format($revenue / $spend, 1) . 'x' : '—',
                'account' => $acct
            ];
        }
        
        // 2. Creative Ad breakdown
        $adf = urlencode("ad_id,ad_name,spend,ctr,actions,action_values");
        $adUrl = "https://graph.facebook.com/v21.0/{$acct}/insights?fields={$adf}&level=ad&limit=50&time_range=" . urlencode($timeRange) . "&access_token=" . urlencode($metaToken);

        $adRows = fetchMetaInsights($adUrl, $acct, $metaSyncErrors);
        // "Angles tested" = distinct ads that actually spent budget this period.
        $metaAnglesTested += count(array_filter($adRows, fn($ad) => (float)($ad['spend'] ?? 0) > 0));

        foreach ($adRows as $ad) {
            $adOrders = 0;
            $adRevenue = 0.0;
            $adSpend = (float)($ad['spend'] ?? 0.0);
            foreach ($ad['actions'] ?? [] as $ac) {
                if ($ac['action_type'] === 'purchase') $adOrders = (int)$ac['value'];
            }
            foreach ($ad['action_values'] ?? [] as $av) {
                if ($av['action_type'] === 'purchase') $adRevenue = (float)$av['value'];
            }
            if ($adOrders > 0) {
                $metaCreatives[] = [
                    'ad_id' => $ad['ad_id'] ?? '',
                    'name' => $ad['ad_name'] ?? 'Ad Creative',
                    'ctr' => number_format((float)($ad['ctr'] ?? 0.0), 1) . '%',
                    'cpa' => $adOrders > 0 ? '₹' . round($adSpend / $adOrders) : '—',
                    'orders' => $adOrders,
                    'revenue' => round($adRevenue),
                    'roas' => $adSpend > 0 ? round($adRevenue / $adSpend, 2) : 0
                ];
            }
        }

        // 3. Placement breakdown — which surface (Reels/Stories/Feed) actually won
        $pf = urlencode("spend,actions,action_values");
        $placementUrl = "https://graph.facebook.com/v21.0/{$acct}/insights?fields={$pf}&level=account&breakdowns=publisher_platform,platform_position&time_range=" . urlencode($timeRange) . "&limit=50&access_token=" . urlencode($metaToken);

        foreach (fetchMetaInsights($placementUrl, $acct, $metaSyncErrors) as $row) {
            $platform = ucwords(str_replace('_', ' ', $row['publisher_platform'] ?? 'unknown'));
            $position = ucwords(str_replace('_', ' ', $row['platform_position'] ?? ''));
            $label = $position ? "{$platform} {$position}" : $platform;
            $pSpend = (float)($row['spend'] ?? 0.0);
            $pRevenue = 0.0;
            foreach ($row['action_values'] ?? [] as $av) {
                if ($av['action_type'] === 'purchase') $pRevenue = (float)$av['value'];
            }
            if (!isset($metaPlacementAgg[$label])) $metaPlacementAgg[$label] = ['spend' => 0, 'revenue' => 0];
            $metaPlacementAgg[$label]['spend'] += $pSpend;
            $metaPlacementAgg[$label]['revenue'] += $pRevenue;
        }

        // 4. Daily Breakdown logs
        $df = urlencode("date_start,spend,impressions,clicks,actions,action_values");
        $dailyUrl = "https://graph.facebook.com/v21.0/{$acct}/insights?fields={$df}&level=account&time_increment=1&time_range=" . urlencode($timeRange) . "&limit=100&access_token=" . urlencode($metaToken);

        foreach (fetchMetaInsights($dailyUrl, $acct, $metaSyncErrors) as $d) {
            $day = $d['date_start'];
            if (!isset($metaDaily[$day])) {
                $metaDaily[$day] = ['spend' => 0, 'sales' => 0, 'orders' => 0, 'clicks' => 0, 'impressions' => 0];
            }
            $dspend = (float)($d['spend'] ?? 0.0);
            $drev = 0.0;
            $dorders = 0;
            foreach ($d['action_values'] ?? [] as $av) {
                if ($av['action_type'] === 'purchase') $drev = (float)$av['value'];
            }
            foreach ($d['actions'] ?? [] as $ac) {
                if ($ac['action_type'] === 'purchase') $dorders = (int)$ac['value'];
            }
            $metaDaily[$day]['spend'] += $dspend;
            $metaDaily[$day]['sales'] += $drev;
            $metaDaily[$day]['orders'] += $dorders;
            $metaDaily[$day]['clicks'] += (int)($d['clicks'] ?? 0);
            $metaDaily[$day]['impressions'] += (int)($d['impressions'] ?? 0);
        }
    }
    
    usort($metaCreatives, fn($a, $b) => $b['revenue'] <=> $a['revenue']);
    $metaCreatives = array_slice($metaCreatives, 0, 3);

    // Fetch actual creative previews (image/thumbnail/copy/CTA) only for the top 3 winners,
    // to avoid an expensive per-ad call across the whole account.
    foreach ($metaCreatives as &$topAd) {
        if (empty($topAd['ad_id'])) continue;
        $cf2 = urlencode("creative{thumbnail_url,image_url,body,object_story_spec}");
        $creativeUrl = "https://graph.facebook.com/v21.0/{$topAd['ad_id']}?fields={$cf2}&access_token=" . urlencode($metaToken);
        $chCr = curl_init($creativeUrl);
        curl_setopt($chCr, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($chCr, CURLOPT_TIMEOUT, 10);
        $respCr = curl_exec($chCr);
        curl_close($chCr);
        $crData = json_decode($respCr, true);
        $creative = $crData['creative'] ?? [];
        $storySpec = $creative['object_story_spec'] ?? [];
        $linkData = $storySpec['link_data'] ?? $storySpec['video_data'] ?? [];
        $topAd['image_url'] = $creative['thumbnail_url'] ?? $creative['image_url'] ?? '';
        $topAd['body'] = $creative['body'] ?? ($linkData['message'] ?? '');
        $topAd['cta'] = $linkData['call_to_action']['type'] ?? '';
    }
    unset($topAd);

    // Winning placement = highest-ROAS surface that actually spent meaningfully this period.
    $metaWinningPlacement = '—';
    $bestPlacementRoas = -1;
    foreach ($metaPlacementAgg as $label => $m) {
        if ($m['spend'] <= 0) continue;
        $roas = $m['revenue'] / $m['spend'];
        if ($roas > $bestPlacementRoas) { $bestPlacementRoas = $roas; $metaWinningPlacement = $label; }
    }

    $metaAdAudit = [
        'angles_tested' => $metaAnglesTested,
        'winning_placement' => $metaWinningPlacement,
        'winning_placement_roas' => $bestPlacementRoas > 0 ? round($bestPlacementRoas, 2) : 0,
        'winning_angle' => $metaCreatives[0]['name'] ?? '—'
    ];

    $syncMetaCount = count($metaCampaigns);
}

// C. Google Ads API
if ($gAccessToken && !empty($int['google_ads_enabled']) && !empty($int['google_ads_customer_id'])) {
    $cust = str_replace('-', '', $int['google_ads_customer_id']);
    $devTok = getSetting('google_developer_token');
    $mcc = !empty($int['google_ads_mcc_id']) ? str_replace('-', '', $int['google_ads_mcc_id']) : $cust;
    
    // 1. Fetch campaigns details (including network/channel type, for the ad-structure audit)
    $q = "SELECT campaign.name, campaign.advertising_channel_type, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.impressions, metrics.clicks FROM campaign WHERE segments.date BETWEEN '{$startDate}' AND '{$endDate}' AND campaign.status = 'ENABLED' ORDER BY metrics.cost_micros DESC LIMIT 50";

    $ch = curl_init("https://googleads.googleapis.com/v19/customers/{$cust}/googleAds:search");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$gAccessToken}",
        "developer-token: {$devTok}",
        "login-customer-id: {$mcc}",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['query' => $q]));
    $resp = curl_exec($ch);
    curl_close($ch);

    $json = json_decode($resp, true);
    $googleNetworkAgg = [];
    foreach ($json['results'] ?? [] as $row) {
        $m = $row['metrics'] ?? [];
        $spend = (float)($m['cost_micros'] ?? 0.0) / 1e6;
        $revenue = (float)($m['conversions_value'] ?? 0.0);
        $orders = (int)($m['conversions'] ?? 0);
        $googleCampaigns[] = [
            'channel' => 'GOOGLE',
            'name' => $row['campaign']['name'] ?? 'Campaign',
            'spent' => round($spend),
            'sales' => round($revenue),
            'orders' => $orders,
            'roas' => $spend > 0 ? number_format($revenue / $spend, 1) . 'x' : '—'
        ];

        $network = ucwords(strtolower(str_replace('_', ' ', $row['campaign']['advertisingChannelType'] ?? $row['campaign']['advertising_channel_type'] ?? 'Unknown')));
        if (!isset($googleNetworkAgg[$network])) $googleNetworkAgg[$network] = ['spend' => 0, 'revenue' => 0];
        $googleNetworkAgg[$network]['spend'] += $spend;
        $googleNetworkAgg[$network]['revenue'] += $revenue;
    }

    // Winning network = highest-ROAS network that actually spent meaningfully this period.
    $googleWinningNetwork = '—';
    $bestNetworkRoas = -1;
    foreach ($googleNetworkAgg as $label => $m) {
        if ($m['spend'] <= 0) continue;
        $roas = $m['revenue'] / $m['spend'];
        if ($roas > $bestNetworkRoas) { $bestNetworkRoas = $roas; $googleWinningNetwork = $label; }
    }

    // 1b. Fetch top responsive search ad copy (for the creative preview slide)
    $googleSearchAds = [];
    $qAds = "SELECT ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, metrics.clicks, metrics.conversions_value, metrics.cost_micros FROM ad_group_ad WHERE segments.date BETWEEN '{$startDate}' AND '{$endDate}' AND ad_group_ad.status = 'ENABLED' AND campaign.advertising_channel_type = 'SEARCH' ORDER BY metrics.conversions_value DESC LIMIT 3";
    $chAds = curl_init("https://googleads.googleapis.com/v19/customers/{$cust}/googleAds:search");
    curl_setopt($chAds, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($chAds, CURLOPT_POST, true);
    curl_setopt($chAds, CURLOPT_TIMEOUT, 15);
    curl_setopt($chAds, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$gAccessToken}",
        "developer-token: {$devTok}",
        "login-customer-id: {$mcc}",
        "Content-Type: application/json"
    ]);
    curl_setopt($chAds, CURLOPT_POSTFIELDS, json_encode(['query' => $qAds]));
    $respAds = curl_exec($chAds);
    curl_close($chAds);
    $adsJson = json_decode($respAds, true);
    foreach ($adsJson['results'] ?? [] as $row) {
        $rsa = $row['adGroupAd']['ad']['responsiveSearchAd'] ?? [];
        $headlines = array_map(fn($h) => $h['text'] ?? '', $rsa['headlines'] ?? []);
        $descriptions = array_map(fn($d) => $d['text'] ?? '', $rsa['descriptions'] ?? []);
        $m = $row['metrics'] ?? [];
        $aSpend = (float)($m['costMicros'] ?? $m['cost_micros'] ?? 0) / 1e6;
        $aRevenue = (float)($m['conversionsValue'] ?? $m['conversions_value'] ?? 0);
        $googleSearchAds[] = [
            'headline' => $headlines[0] ?? 'Search Ad',
            'description' => $descriptions[0] ?? '',
            'clicks' => (int)($m['clicks'] ?? 0),
            'roas' => $aSpend > 0 ? round($aRevenue / $aSpend, 2) : 0
        ];
    }

    // 2. Fetch daily logs
    $qDaily = "SELECT segments.date, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.impressions, metrics.clicks FROM campaign WHERE segments.date BETWEEN '{$startDate}' AND '{$endDate}'";
    $chD = curl_init("https://googleads.googleapis.com/v19/customers/{$cust}/googleAds:search");
    curl_setopt($chD, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($chD, CURLOPT_POST, true);
    curl_setopt($chD, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$gAccessToken}",
        "developer-token: {$devTok}",
        "login-customer-id: {$mcc}",
        "Content-Type: application/json"
    ]);
    curl_setopt($chD, CURLOPT_POSTFIELDS, json_encode(['query' => $qDaily]));
    $respD = curl_exec($chD);
    curl_close($chD);
    
    $googleDaily = [];
    $jsonD = json_decode($respD, true);
    foreach ($jsonD['results'] ?? [] as $row) {
        $m = $row['metrics'] ?? [];
        $day = $row['segments']['date'];
        if (!isset($googleDaily[$day])) {
            $googleDaily[$day] = ['spend' => 0, 'sales' => 0, 'orders' => 0, 'clicks' => 0, 'impressions' => 0];
        }
        $googleDaily[$day]['spend'] += (float)($m['cost_micros'] ?? 0.0) / 1e6;
        $googleDaily[$day]['sales'] += (float)($m['conversions_value'] ?? 0.0);
        $googleDaily[$day]['orders'] += (int)($m['conversions'] ?? 0);
        $googleDaily[$day]['clicks'] += (int)($m['clicks'] ?? 0);
        $googleDaily[$day]['impressions'] += (int)($m['impressions'] ?? 0);
    }

    $googleAdAudit = [
        'networks_tested' => count($googleNetworkAgg),
        'winning_network' => $googleWinningNetwork,
        'winning_network_roas' => $bestNetworkRoas > 0 ? round($bestNetworkRoas, 2) : 0
    ];

    $syncGoogleAdsCount = count($googleCampaigns);
}

// D. GA4 API
if ($gAccessToken && !empty($int['ga4_property_id'])) {
    $gaPid = $int['ga4_property_id'];
    
    // 1. Fetch channel grouping metrics
    $ch = curl_init("https://analyticsdata.googleapis.com/v1beta/properties/{$gaPid}:runReport");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$gAccessToken}",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'dateRanges' => [['startDate' => $startDate, 'endDate' => $endDate]],
        'dimensions' => [['name' => 'sessionDefaultChannelGrouping']],
        'metrics' => [['name' => 'sessions'], ['name' => 'conversions'], ['name' => 'totalRevenue']]
    ]));
    $resp = curl_exec($ch);
    curl_close($ch);
    
    $ga4Data = json_decode($resp, true);
    $lmap = [
        'Organic Search' => 'SEO / Search',
        'Direct' => 'Direct',
        'Organic Social' => 'Social Organic',
        'Referral' => 'Referral'
    ];
    
    foreach ($ga4Data['rows'] ?? [] as $row) {
        $orig = $row['dimensionValues'][0]['value'] ?? '';
        $lbl = $lmap[$orig] ?? null;
        if (!$lbl) continue;
        
        $sessions = (int)($row['metricValues'][0]['value'] ?? 0);
        $orders = (int)($row['metricValues'][1]['value'] ?? 0);
        $revenue = (float)($row['metricValues'][2]['value'] ?? 0.0);
        
        $ga4Channels[$lbl] = [
            'sessions' => $sessions,
            'convRate' => $sessions > 0 ? number_format(($orders / $sessions) * 100, 2) : '0.00',
            'revenue' => round($revenue)
        ];
    }
    
    // Fill empty defaults
    foreach (['SEO / Search', 'Direct', 'Social Organic', 'Referral'] as $lbl) {
        if (!isset($ga4Channels[$lbl])) {
            $ga4Channels[$lbl] = ['sessions' => 0, 'convRate' => '0.00', 'revenue' => 0];
        }
    }
    
    $syncGA4Count = count($ga4Data['rows'] ?? []);

    // 2. Fetch real ecommerce funnel event counts (session_start / add_to_cart / begin_checkout / purchase)
    // so the monthly deck's conversion funnel shows actual GA4 data instead of guessed ratios.
    $ch3 = curl_init("https://analyticsdata.googleapis.com/v1beta/properties/{$gaPid}:runReport");
    curl_setopt($ch3, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch3, CURLOPT_POST, true);
    curl_setopt($ch3, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch3, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$gAccessToken}",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch3, CURLOPT_POSTFIELDS, json_encode([
        'dateRanges' => [['startDate' => $startDate, 'endDate' => $endDate]],
        'dimensions' => [['name' => 'eventName']],
        'metrics' => [['name' => 'eventCount']],
        'dimensionFilter' => [
            'filter' => [
                'fieldName' => 'eventName',
                'inListFilter' => ['values' => ['session_start', 'add_to_cart', 'begin_checkout', 'purchase']]
            ]
        ]
    ]));
    $resp3 = curl_exec($ch3);
    curl_close($ch3);

    $ga4EventData = json_decode($resp3, true);
    $ga4Funnel = ['session_start' => 0, 'add_to_cart' => 0, 'begin_checkout' => 0, 'purchase' => 0];
    foreach ($ga4EventData['rows'] ?? [] as $row) {
        $ev = $row['dimensionValues'][0]['value'] ?? '';
        $cnt = (int)($row['metricValues'][0]['value'] ?? 0);
        if (isset($ga4Funnel[$ev])) $ga4Funnel[$ev] = $cnt;
    }
}

// E. GSC API
if ($gAccessToken && !empty($int['gsc_site_url'])) {
    $gscUrl = urlencode($int['gsc_site_url']);
    
    // Query landing pages (limit 5)
    $chPages = curl_init("https://www.googleapis.com/webmasters/v3/sites/{$gscUrl}/searchAnalytics/query");
    curl_setopt($chPages, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($chPages, CURLOPT_POST, true);
    curl_setopt($chPages, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$gAccessToken}",
        "Content-Type: application/json"
    ]);
    curl_setopt($chPages, CURLOPT_POSTFIELDS, json_encode([
        'startDate' => $startDate,
        'endDate' => $endDate,
        'dimensions' => ['page'],
        'rowLimit' => 5
    ]));
    $respPages = curl_exec($chPages);
    curl_close($chPages);
    
    $pagesData = json_decode($respPages, true);
    foreach ($pagesData['rows'] ?? [] as $r) {
        $gscPages[] = [
            'page' => $r['keys'][0],
            'clicks' => $r['clicks'],
            'impressions' => $r['impressions'],
            'ctr' => number_format($r['ctr'] * 100, 1) . '%',
            'position' => number_format($r['position'], 1)
        ];
    }
    
    // Query organic search keywords (limit 5)
    $chQueries = curl_init("https://www.googleapis.com/webmasters/v3/sites/{$gscUrl}/searchAnalytics/query");
    curl_setopt($chQueries, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($chQueries, CURLOPT_POST, true);
    curl_setopt($chQueries, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$gAccessToken}",
        "Content-Type: application/json"
    ]);
    curl_setopt($chQueries, CURLOPT_POSTFIELDS, json_encode([
        'startDate' => $startDate,
        'endDate' => $endDate,
        'dimensions' => ['query'],
        'rowLimit' => 5
    ]));
    $respQueries = curl_exec($chQueries);
    curl_close($chQueries);
    
    $queriesData = json_decode($respQueries, true);
    foreach ($queriesData['rows'] ?? [] as $r) {
        $gscQueries[] = [
            'query' => $r['keys'][0],
            'clicks' => $r['clicks'],
            'impressions' => $r['impressions'],
            'ctr' => number_format($r['ctr'] * 100, 1) . '%',
            'position' => number_format($r['position'], 1)
        ];
    }
    
    $syncGSCCount = count($gscQueries);
}

// ── SAVE DAY-LEVEL STATISTICS TO DATABASE ──
// Retrieve or create the brand's budget_months row for this period. The real schema
// (see install.sql / api/budget.php) keys this by (brand_id, year, month) with a `label`
// column — this previously queried a `month_label` column that doesn't exist and an INSERT
// missing several NOT NULL columns (year, month, channels), which is why every sync failed
// outright with "Unknown column 'month_label'" as soon as it reached this point.
$startDt2 = new DateTime($startDate);
$year = (int)$startDt2->format('Y');
$month = (int)$startDt2->format('n');
$monthLabel = $startDt2->format('F Y');
$totalDays = (int)$startDt2->format('t');

$monthRow = dbGet('SELECT id FROM budget_months WHERE brand_id=? AND year=? AND month=?', [$brand['id'], $year, $month]);
if (!$monthRow) {
    $monthId = uuid4();
    dbRun('INSERT INTO budget_months (id, brand_id, label, year, month, total_days, revenue_target, overall_roas, channels, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [$monthId, $brand['id'], $monthLabel, $year, $month, $totalDays, 0, 3.0, '{}', 'auto-sync']);
} else {
    $monthId = $monthRow['id'];
}

foreach ($dates as $date) {
    // 1. Get or create budget day row
    $dayRow = dbGet('SELECT id, channels_json, entered_by FROM budget_days WHERE month_id=? AND day_date=?', [$monthId, $date]);

    // When sync runs, refresh API-connected channels (shopify, meta, google) in $existingChannels,
    // while preserving any manual channels (email_marketing, whatsapp, marketplace, retention) intact.

    $existingChannels = [];
    if ($dayRow && !empty($dayRow['channels_json'])) {
        $existingChannels = json_decode($dayRow['channels_json'], true) ?: [];
    }

    // Clear any channel that isn't currently enabled/configured for this brand. Without this,
    // a channel that was ever synced once (or manually entered, or connected and later
    // disconnected) keeps showing its last real numbers forever — every subsequent report for
    // this brand would silently display stale spend/ROAS for an integration that's now off,
    // with no way to tell from the deck that it's not actually connected.
    if (empty($int['shopify_enabled']) || empty($int['shopify_subdomain'])) unset($existingChannels['shopify']);
    if (empty($int['meta_ad_account_ids'])) unset($existingChannels['meta']);
    if (empty($int['google_ads_enabled']) || empty($int['google_ads_customer_id'])) unset($existingChannels['google']);

    // Shopify storefront values
    $shopifySales = 0.0;
    $shopifyOrders = 0;
    $customersAcquired = 0;
    
    if (isset($shopifyDaily[$date])) {
        $shopifySales = $shopifyDaily[$date]['sales'];
        $shopifyOrders = $shopifyDaily[$date]['orders'];
        $customersAcquired = $shopifyDaily[$date]['new_cust'];
        
        $existingChannels['shopify'] = [
            'spend' => 0.0,
            'sales' => $shopifySales,
            'conversions' => $shopifyOrders,
            'customers_acquired' => $customersAcquired,
            'roas' => 0.0
        ];
    }
    
    // Meta Ads daily values
    $metaSpend = 0.0;
    $metaSales = 0.0;
    $metaOrders = 0;
    $metaClicks = 0;
    $metaImpressions = 0;
    
    if (isset($metaDaily[$date])) {
        $metaSpend = $metaDaily[$date]['spend'];
        $metaSales = $metaDaily[$date]['sales'];
        $metaOrders = $metaDaily[$date]['orders'];
        $metaClicks = $metaDaily[$date]['clicks'];
        $metaImpressions = $metaDaily[$date]['impressions'];
        
        $existingChannels['meta'] = [
            'spend' => $metaSpend,
            'sales' => $metaSales,
            'conversions' => $metaOrders,
            'clicks' => $metaClicks,
            'sessions' => $metaImpressions,
            'roas' => $metaSpend > 0 ? $metaSales / $metaSpend : 0.0
        ];
    }
    
    // Google Ads daily values
    $googleSpend = 0.0;
    $googleSales = 0.0;
    $googleOrders = 0;
    $googleClicks = 0;
    $googleImpressions = 0;
    
    if (isset($googleDaily[$date])) {
        $googleSpend = $googleDaily[$date]['spend'];
        $googleSales = $googleDaily[$date]['sales'];
        $googleOrders = $googleDaily[$date]['orders'];
        $googleClicks = $googleDaily[$date]['clicks'];
        $googleImpressions = $googleDaily[$date]['impressions'];
        
        $existingChannels['google'] = [
            'spend' => $googleSpend,
            'sales' => $googleSales,
            'conversions' => $googleOrders,
            'clicks' => $googleClicks,
            'sessions' => $googleImpressions,
            'roas' => $googleSpend > 0 ? $googleSales / $googleSpend : 0.0
        ];
    }
    
    $chJson = json_encode($existingChannels);
    $dayNum = date('j', strtotime($date));
    
    if ($dayRow) {
        dbRun('UPDATE budget_days SET channels_json=? WHERE id=?', [$chJson, $dayRow['id']]);
    } else {
        // budget_days has no spend_real/sales_real/conversions_real columns (those don't exist —
        // real per-channel numbers live entirely in channels_json, which is what aggregateStats()
        // actually reads) and brand_id is NOT NULL with no default, so it must be supplied here.
        dbRun(
            'INSERT INTO budget_days (id, month_id, brand_id, day_number, day_date, channels_json) VALUES (?,?,?,?,?,?)',
            [uuid4(), $monthId, $brand['id'], $dayNum, $date, $chJson]
        );
    }
}

// ── COMPILE METADATA PACKAGE FOR MONTHLY REPORTS CREATOR ──
// Surface anything that silently degraded to empty/partial data instead of leaving the caller
// to guess why a source came back thin: the shared-Google-OAuth gate (set earlier), plus any
// per-Meta-account fetch failures collected during the sync above.
$warnings = $syncWarnings ?? [];
foreach (($metaSyncErrors ?? []) as $acct => $msgs) {
    foreach ($msgs as $msg) {
        $warnings[] = "Meta account {$acct}: {$msg}";
    }
}

$outData = [
    'ok' => true,
    'warnings' => $warnings,
    'sync_shopify' => $syncShopifyCount,
    'sync_meta' => $syncMetaCount,
    'sync_google_ads' => $syncGoogleAdsCount,
    'sync_ga4' => $syncGA4Count,
    'sync_gsc' => $syncGSCCount,
    'meta_campaigns' => $metaCampaigns,
    'meta_creatives' => $metaCreatives,
    'meta_ad_audit' => $metaAdAudit,
    'google_campaigns' => $googleCampaigns,
    'google_ad_audit' => $googleAdAudit,
    'google_search_ads' => $googleSearchAds,
    'ga4_channels' => $ga4Channels,
    'ga4_funnel' => $ga4Funnel,
    'gsc_pages' => $gscPages,
    'gsc_queries' => $gscQueries,
    'shopify_products' => $shopifyProducts,
    'shopify_locations' => $shopifyLocations,
    'shopify_campaigns' => $shopifyCampaigns,
    'cohort_matrix' => $cohortMatrix
];

if (php_sapi_name() === 'cli') {
    echo "Sync complete!\n";
    echo json_encode($outData, JSON_PRETTY_PRINT) . "\n";
} else {
    json_out($outData);
}
