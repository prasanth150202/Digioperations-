<?php
require_once __DIR__ . '/../api/config.php';
require_once __DIR__ . '/../api/ai.php';

// Check brands
$brands = dbAll("SELECT id, name FROM brands LIMIT 5");
echo "=== BRANDS IN DATABASE ===\n";
print_r($brands);

if (!empty($brands)) {
    $brandId = $brands[0]['id'];
    $month   = date('Y-m');

    echo "\n=== FETCHING BRAND DATA FOR $brandId ($month) ===\n";
    $brand       = dbGet("SELECT * FROM brands WHERE id = ?", [$brandId]);
    $budgetMonth = dbGet("SELECT * FROM budget_months WHERE brand_id = ? ORDER BY created_at DESC LIMIT 1", [$brandId]);
    $budgetDays  = dbAll("SELECT * FROM budget_days WHERE month_id = ? ORDER BY day_number ASC LIMIT 30", [$budgetMonth['id'] ?? '']);
    $reports     = dbAll("SELECT * FROM reports WHERE brand_id = ? ORDER BY created_at DESC LIMIT 1", [$brandId]);
    $products    = dbAll("SELECT * FROM pricing_logs WHERE brand_id = ? LIMIT 10", [$brandId]);
    $intel       = dbGet("SELECT * FROM consultant_generations WHERE brand_id = ? ORDER BY created_at DESC LIMIT 1", [$brandId]);

    echo "Brand Name: " . ($brand['name'] ?? 'N/A') . "\n";
    echo "Budget Month Target Revenue: " . ($budgetMonth['target_revenue'] ?? '0') . "\n";
    echo "Budget Month Target Spend: " . ($budgetMonth['target_budget'] ?? '0') . "\n";
    echo "Budget Days Count: " . count($budgetDays) . "\n";
    echo "Reports Count: " . count($reports) . "\n";
    echo "Pricing Logs (Products) Count: " . count($products) . "\n";
    echo "Consultant Intel Found: " . ($intel ? 'YES' : 'NO') . "\n";
}
