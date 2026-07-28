<?php
require_once __DIR__ . '/../api/config.php';

// Mock session and auth
$user = dbGet("SELECT * FROM users WHERE active=1 LIMIT 1");
$_SESSION['user_id'] = $user['id'];
$_SERVER['REQUEST_METHOD'] = 'GET';

// Include budget.php to run functions
ob_start();
require_once __DIR__ . '/../api/budget.php';
ob_end_clean();

$brands = dbAll('SELECT id,slug,name,industry,type FROM brands ORDER BY name');
foreach ($brands as $b) {
    $month = dbGet('SELECT * FROM budget_months WHERE brand_id=? ORDER BY year DESC, month DESC LIMIT 1', [$b['id']]);
    if (!$month) {
        echo "Brand: {$b['name']} has NO months.\n";
        continue;
    }
    $dayRows  = dbAll('SELECT * FROM budget_days WHERE month_id=? ORDER BY day_number', [$month['id']]);
    $computed = computeMonth($month, $dayRows);
    $sum = $computed['summary'];
    
    echo "Brand: {$b['name']}\n";
    echo " - Month Label: {$month['label']}\n";
    echo " - Summary keys: " . implode(', ', array_keys($sum)) . "\n";
    echo " - targetPct: " . (isset($sum['targetPct']) ? var_export($sum['targetPct'], true) : 'MISSING') . "\n";
    echo " - projTargetPct: " . (isset($sum['projTargetPct']) ? var_export($sum['projTargetPct'], true) : 'MISSING') . "\n";
    echo " - totalSalesReal: " . (isset($sum['totalSalesReal']) ? var_export($sum['totalSalesReal'], true) : 'MISSING') . "\n";
    echo " - projectedSales: " . (isset($sum['projectedSales']) ? var_export($sum['projectedSales'], true) : 'MISSING') . "\n";
    echo " - totalROAS: " . (isset($sum['totalROAS']) ? var_export($sum['totalROAS'], true) : 'MISSING') . "\n";
}
