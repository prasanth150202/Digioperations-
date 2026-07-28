<?php
require_once __DIR__ . '/../api/config.php';

try {
    $brands = dbAll("SELECT * FROM brands");
    echo "BRANDS IN DATABASE (" . count($brands) . "):\n";
    foreach ($brands as $b) {
        echo " - ID: {$b['id']}, Slug: {$b['slug']}, Name: {$b['name']}, Type: {$b['type']}\n";
    }
} catch (Throwable $e) {
    echo "ERROR QUERYING BRANDS: " . $e->getMessage() . "\n";
}
