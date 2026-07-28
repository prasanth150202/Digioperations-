<?php
require_once __DIR__ . '/config.php';
$user   = requireAuth();
requirePage($user, 'pricing');
$method = $_SERVER['REQUEST_METHOD'];
$slug   = $_GET['brand'] ?? '';
$action = $_GET['action'] ?? '';

if (!$slug) json_err('Brand slug required');
if (!canAccessBrand($user, $slug)) json_err('Access denied', 403);
$brand = dbGet('SELECT * FROM brands WHERE slug=?', [$slug]);
if (!$brand) json_err('Brand not found', 404);

if ($method === 'GET' && $action === 'products') {
    $prods = dbAll('SELECT * FROM pricing_products WHERE brand_id=? ORDER BY updated_at', [$brand['id']]);
    $out = ['products' => [], 'globals' => []];
    foreach ($prods as $p) {
        $p['extras_json']   = json_decode($p['extras_json'] ?? '[]', true);
        $p['variants_json'] = json_decode($p['variants_json'] ?? '[]', true);
        $p['globals_json']  = json_decode($p['globals_json'] ?? '{}', true);
        // Use the first product that has real globals — don't overwrite with later products
        if (empty($out['globals']) && !empty($p['globals_json'])) {
            $out['globals'] = $p['globals_json'];
        }
        $out['products'][] = $p;
    }
    json_out($out);
}

// GET /api/pricing.php?brand=X&action=history
if ($method === 'GET' && $action === 'history') {
    $logs = dbAll('SELECT * FROM pricing_logs WHERE brand_id=? ORDER BY created_at DESC', [$brand['id']]);
    json_out(['history' => $logs]);
}

// GET /api/pricing.php?brand=X&action=variant_history&variant_id=Y
if ($method === 'GET' && $action === 'variant_history') {
    $vid = $_GET['variant_id'] ?? '';
    if (!$vid) json_err('Variant ID required');
    $logs = dbAll('SELECT * FROM pricing_logs WHERE brand_id=? AND variant_id=? ORDER BY created_at DESC', [$brand['id'], $vid]);
    json_out(['history' => $logs]);
}

// PUT /api/pricing.php?brand=X&action=products
if ($method === 'PUT' && $action === 'products') {
    if (!canManage($user)) json_err('Read only', 403);
    $products = bodyGet('products', []);
    $globals  = bodyGet('globals', []);
    
    // 1. Fetch existing products and variants first to calculate differential logs
    $oldProducts = dbAll('SELECT * FROM pricing_products WHERE brand_id=?', [$brand['id']]);
    $oldVariants = [];
    foreach ($oldProducts as $oldP) {
        $oldVars = json_decode($oldP['variants_json'] ?? '[]', true);
        foreach ($oldVars as $oldV) {
            if (!empty($oldV['id'])) {
                // Store variant details
                $oldVariants[$oldV['id']] = [
                    'product_name' => $oldP['name'],
                    'product_id' => $oldP['id'],
                    'variant_name' => $oldV['name'] ?? 'Default',
                    'selling' => $oldV['selling'] ?? null,
                    'mfg' => isset($oldV['mfgO']) && $oldV['mfgO'] !== null ? $oldV['mfgO'] : $oldP['mfg_per_pc'],
                    'comp' => $oldV['compO'] ?? null
                ];
            }
        }
    }

    // 2. Perform delete and re-insert
    dbRun('DELETE FROM pricing_products WHERE brand_id=?', [$brand['id']]);
    foreach ($products as $p) {
        $pid = $p['id'] ?? uuid4();
        $pName = $p['name'] ?? 'Product';
        $pMfg = $p['mfg_per_pc'] ?? 0;
        
        // Check for modifications and log them
        $incomingVars = $p['variants_json'] ?? [];
        foreach ($incomingVars as $v) {
            $vid = $v['id'] ?? '';
            if ($vid && isset($oldVariants[$vid])) {
                $oldV = $oldVariants[$vid];
                $vName = $v['name'] ?? 'Default';
                
                // Compare Selling Price
                $oldSelling = $oldV['selling'];
                $newSelling = $v['selling'] ?? null;
                if ($oldSelling !== null && $newSelling !== null && (float)$oldSelling != (float)$newSelling) {
                    dbRun(
                        'INSERT INTO pricing_logs (id, brand_id, product_id, product_name, variant_id, variant_name, field_changed, old_value, new_value, user_name) VALUES (?,?,?,?,?,?,?,?,?,?)',
                        [uuid4(), $brand['id'], $pid, $pName, $vid, $vName, 'selling_price', $oldSelling, $newSelling, $user['name']]
                    );
                }

                // Compare Manufacturing Cost
                $oldMfgVal = $oldV['mfg'];
                $newMfgVal = isset($v['mfgO']) && $v['mfgO'] !== null ? $v['mfgO'] : $pMfg;
                if ($oldMfgVal !== null && $newMfgVal !== null && (float)$oldMfgVal != (float)$newMfgVal) {
                    dbRun(
                        'INSERT INTO pricing_logs (id, brand_id, product_id, product_name, variant_id, variant_name, field_changed, old_value, new_value, user_name) VALUES (?,?,?,?,?,?,?,?,?,?)',
                        [uuid4(), $brand['id'], $pid, $pName, $vid, $vName, 'mfg_cost', $oldMfgVal, $newMfgVal, $user['name']]
                    );
                }

                // Compare Competitor/MRP Price
                $oldComp = $oldV['comp'];
                $newComp = $v['compO'] ?? null;
                if ($oldComp !== null && $newComp !== null && (float)$oldComp != (float)$newComp) {
                    dbRun(
                        'INSERT INTO pricing_logs (id, brand_id, product_id, product_name, variant_id, variant_name, field_changed, old_value, new_value, user_name) VALUES (?,?,?,?,?,?,?,?,?,?)',
                        [uuid4(), $brand['id'], $pid, $pName, $vid, $vName, 'comp_price', $oldComp, $newComp, $user['name']]
                    );
                }
            }
        }

        dbRun(
            'INSERT INTO pricing_products (id,brand_id,name,mfg_per_pc,variant_type,extras_json,variants_json,globals_json) VALUES (?,?,?,?,?,?,?,?)',
            [$pid, $brand['id'], $pName, $pMfg, $p['variant_type'] ?? 'single',
             json_encode($p['extras_json'] ?? []), json_encode($p['variants_json'] ?? []), json_encode($globals)]
        );
    }
    json_out(['ok' => true]);
}

// POST /api/pricing.php?brand=X&action=sync_shopify
if ($method === 'POST' && $action === 'sync_shopify') {
    if (!canManage($user)) json_err('Insufficient permissions', 403);
    
    $int = json_decode($brand['integrations_json'] ?? '{}', true);
    $sub = $int['shopify_subdomain'] ?? '';
    $tok = $int['shopify_access_token'] ?? '';
    if ($tok === str_repeat('·', 8)) {
        $dbBrand = dbGet('SELECT integrations_json FROM brands WHERE id=?', [$brand['id']]);
        $dbInt = json_decode($dbBrand['integrations_json'] ?? '{}', true);
        $tok = $dbInt['shopify_access_token'] ?? '';
    }
    
    if (empty($sub) || empty($tok)) {
        json_err('Shopify credentials are not configured for this brand under Integrations settings.');
    }
    
    $ch = curl_init("https://{$sub}.myshopify.com/admin/api/2025-01/products.json?limit=250");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["X-Shopify-Access-Token: {$tok}", "Content-Type: application/json"]);
    $resp = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($status !== 200) {
        json_err('Shopify API returned error code ' . $status . ': ' . $resp);
    }
    
    $data = json_decode($resp, true);
    $products = $data['products'] ?? [];
    
    $currentCatalog = dbAll('SELECT * FROM pricing_products WHERE brand_id=?', [$brand['id']]);
    $existingMap = [];
    foreach ($currentCatalog as $item) {
        $existingMap[trim(strtolower($item['name']))] = $item;
    }
    
    $importedCount = 0;
    foreach ($products as $p) {
        $pName = trim($p['title']);
        $pKey = strtolower($pName);
        
        $variants = [];
        foreach ($p['variants'] ?? [] as $v) {
            $variants[] = [
                'id' => (string)($v['id']),
                'name' => trim($v['title'] === 'Default Title' ? 'Default' : $v['title']),
                'selling' => (float)($v['price'] ?? 0.0),
                'compO' => !empty($v['compare_at_price']) ? (float)$v['compare_at_price'] : null,
                'mfgO' => null
            ];
        }
        
        $variantType = count($variants) > 1 ? 'multi' : 'single';
        
        if (isset($existingMap[$pKey])) {
            $oldItem = $existingMap[$pKey];
            $oldVars = json_decode($oldItem['variants_json'] ?? '[]', true) ?: [];
            
            $mfgMap = [];
            foreach ($oldVars as $oldV) {
                if (!empty($oldV['id'])) {
                    $mfgMap[(string)$oldV['id']] = $oldV['mfgO'] ?? null;
                }
            }
            
            foreach ($variants as &$v) {
                if (isset($mfgMap[$v['id']])) {
                    $v['mfgO'] = $mfgMap[$v['id']];
                }
            }
            
            dbRun('UPDATE pricing_products SET variants_json=?, variant_type=? WHERE id=?', 
                [json_encode($variants), $variantType, $oldItem['id']]);
        } else {
            dbRun('INSERT INTO pricing_products (id, brand_id, name, mfg_per_pc, variant_type, extras_json, variants_json, globals_json) VALUES (?,?,?,?,?,?,?,?)',
                [uuid4(), $brand['id'], $pName, 0.0, $variantType, '[]', json_encode($variants), '{}']);
        }
        $importedCount++;
    }
    
    json_out(['ok' => true, 'count' => $importedCount]);
}

json_err('Not found', 404);
