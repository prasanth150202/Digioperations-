<?php
require_once __DIR__ . '/config.php';
$user   = requireAuth();
requirePage($user, 'budget');
$method  = $_SERVER['REQUEST_METHOD'];
$action  = $_GET['action']  ?? '';
$brandId = $_GET['brand']   ?? '';
$monthId = $_GET['month']   ?? '';
$dayNum  = (int)($_GET['day'] ?? 0);

// ── Flag thresholds ──────────────────────────────────────────
const F_ROAS_MISS    = 10;
const F_SPEND_OVER   = 20;
const F_SPEND_UNDER  = 30;
const F_SALES_MISS   = 20;
const F_PACE_MISS    = 10;
const CH_LABELS = ['meta'=>'META','google'=>'Google','mp'=>'Marketplace','ret'=>'Retention'];

// ── Core calculation engine ──────────────────────────────────
function computeMonth(array $month, array $dayRows): array {
    $brand = dbGet('SELECT type FROM brands WHERE id=?', [$month['brand_id']]);
    $brandType = $brand['type'] ?? 'sales';

    $target        = (float)$month['revenue_target'];
    $roas          = (float)($month['overall_roas'] ?: ($brandType === 'leads' ? 150 : 5));
    if ($brandType === 'leads') {
        $monthlyBudget = $target * $roas;
    } else {
        $monthlyBudget = $roas > 0 ? $target / $roas : 0;
    }
    $totalDays     = (int)$month['total_days'];
    $today         = new DateTime('today');

    // On-the-fly legacy day columns migration to channels_json
    foreach ($dayRows as $idx => $r) {
        $chData = json_decode($r['channels_json'] ?? '{}', true);
        if (!is_array($chData)) $chData = [];
        if ($r['mp_sales'] !== null || $r['mp_spend'] !== null) {
            if (!isset($chData['amazon'])) {
                $chData['amazon'] = [
                    'sales' => $r['mp_sales'] !== null ? round((float)$r['mp_sales'] / 2, 2) : null,
                    'spend' => $r['mp_spend'] !== null ? round((float)$r['mp_spend'] / 2, 2) : null
                ];
            }
            if (!isset($chData['flipkart'])) {
                $chData['flipkart'] = [
                    'sales' => $r['mp_sales'] !== null ? round((float)$r['mp_sales'] / 2, 2) : null,
                    'spend' => $r['mp_spend'] !== null ? round((float)$r['mp_spend'] / 2, 2) : null
                ];
            }
            $dayRows[$idx]['mp_sales'] = null;
            $dayRows[$idx]['mp_spend'] = null;
        }
        if ($r['ret_sales'] !== null || $r['ret_spend'] !== null) {
            if (!isset($chData['email'])) {
                $chData['email'] = [
                    'sales' => $r['ret_sales'] !== null ? round((float)$r['ret_sales'] / 3, 2) : null,
                    'spend' => $r['ret_spend'] !== null ? round((float)$r['ret_spend'] / 3, 2) : null
                ];
            }
            if (!isset($chData['whatsapp'])) {
                $chData['whatsapp'] = [
                    'sales' => $r['ret_sales'] !== null ? round((float)$r['ret_sales'] / 3, 2) : null,
                    'spend' => $r['ret_spend'] !== null ? round((float)$r['ret_spend'] / 3, 2) : null
                ];
            }
            if (!isset($chData['push_notifications'])) {
                $chData['push_notifications'] = [
                    'sales' => $r['ret_sales'] !== null ? round((float)$r['ret_sales'] / 3, 2) : null,
                    'spend' => $r['ret_spend'] !== null ? round((float)$r['ret_spend'] / 3, 2) : null
                ];
            }
            $dayRows[$idx]['ret_sales'] = null;
            $dayRows[$idx]['ret_spend'] = null;
        }
        $dayRows[$idx]['channels_json'] = json_encode($chData);
    }

    // Index entered days by day_number
    $entered = [];
    foreach ($dayRows as $d) {
        $entered[(int)$d['day_number']] = $d;
    }

    // Determine which channels are active (configured in month, or have data in any day)
    $configuredChannels = json_decode($month['channels'] ?? '{}', true);
    if (!is_array($configuredChannels)) $configuredChannels = [];
    $activeChannels = [];

    // Pre-populate with standard channels if empty
    if (empty($configuredChannels)) {
        $configuredChannels = [
            'meta' => ['name' => 'Meta', 'pct' => 40, 'roas' => 4, 'active' => true, 'category' => 'push'],
            'google' => ['name' => 'Google', 'pct' => 30, 'roas' => 4, 'active' => true, 'category' => 'pull'],
            'amazon' => ['name' => 'Amazon', 'pct' => 15, 'roas' => 5, 'active' => true, 'category' => 'marketplace'],
            'flipkart' => ['name' => 'Flipkart', 'pct' => 10, 'roas' => 5, 'active' => true, 'category' => 'marketplace'],
            'email' => ['name' => 'Email', 'pct' => 2, 'roas' => 15, 'active' => true, 'category' => 'retention'],
            'whatsapp' => ['name' => 'WhatsApp', 'pct' => 2, 'roas' => 10, 'active' => true, 'category' => 'retention'],
            'push_notifications' => ['name' => 'Push Notifications', 'pct' => 1, 'roas' => 20, 'active' => true, 'category' => 'retention']
        ];
    } else {
        // If legacy channels exist, automatically migrate them dynamically to split channels
        if ((isset($configuredChannels['mp']) || isset($configuredChannels['ret'])) && !isset($configuredChannels['amazon'])) {
            if (isset($configuredChannels['mp'])) {
                $mp = $configuredChannels['mp'];
                $configuredChannels['amazon'] = [
                    'name' => 'Amazon',
                    'active' => $mp['active'] ?? true,
                    'pct' => round(($mp['pct'] ?? 18) / 2, 1),
                    'roas' => $mp['roas'] ?? 6,
                    'start_day' => $mp['start_day'] ?? 1,
                    'category' => 'marketplace'
                ];
                $configuredChannels['flipkart'] = [
                    'name' => 'Flipkart',
                    'active' => $mp['active'] ?? true,
                    'pct' => round(($mp['pct'] ?? 18) / 2, 1),
                    'roas' => $mp['roas'] ?? 6,
                    'start_day' => $mp['start_day'] ?? 1,
                    'category' => 'marketplace'
                ];
                unset($configuredChannels['mp']);
            }
            if (isset($configuredChannels['ret'])) {
                $ret = $configuredChannels['ret'];
                $configuredChannels['email'] = [
                    'name' => 'Email',
                    'active' => $ret['active'] ?? true,
                    'pct' => round(($ret['pct'] ?? 3) / 3, 1),
                    'roas' => $ret['roas'] ?? 6,
                    'start_day' => $ret['start_day'] ?? 1,
                    'category' => 'retention'
                ];
                $configuredChannels['whatsapp'] = [
                    'name' => 'WhatsApp',
                    'active' => $ret['active'] ?? true,
                    'pct' => round(($ret['pct'] ?? 3) / 3, 1),
                    'roas' => $ret['roas'] ?? 6,
                    'start_day' => $ret['start_day'] ?? 1,
                    'category' => 'retention'
                ];
                $configuredChannels['push_notifications'] = [
                    'name' => 'Push Notifications',
                    'active' => $ret['active'] ?? true,
                    'pct' => round(($ret['pct'] ?? 3) / 3, 1),
                    'roas' => $ret['roas'] ?? 6,
                    'start_day' => $ret['start_day'] ?? 1,
                    'category' => 'retention'
                ];
                unset($configuredChannels['ret']);
            }
        }
    }

    foreach ($configuredChannels as $ch => $cfg) {
        if ($cfg['active'] ?? true) {
            $activeChannels[$ch] = $cfg['name'] ?? ucfirst($ch);
        }
    }

    // Scan day rows to find any other channels that have entered data (even if not configured active)
    foreach ($dayRows as $r) {
        $chData = json_decode($r['channels_json'] ?? '{}', true);
        if (!is_array($chData)) $chData = [];
        foreach ($chData as $ch => $vals) {
            $vSales = $vals['sales'] ?? ($vals['conversions'] ?? null);
            $vSpend = $vals['spend'] ?? null;
            if (($vSales !== null || $vSpend !== null) && !isset($activeChannels[$ch])) {
                $activeChannels[$ch] = ucfirst($ch);
            }
        }
        // Fallback for legacy columns
        if ($r['meta_sales'] !== null && !isset($activeChannels['meta'])) $activeChannels['meta'] = 'Meta';
        if ($r['google_sales'] !== null && !isset($activeChannels['google'])) $activeChannels['google'] = 'Google';
        if ($r['mp_sales'] !== null && !isset($activeChannels['mp'])) $activeChannels['mp'] = 'Marketplace';
        if ($r['ret_sales'] !== null && !isset($activeChannels['ret'])) $activeChannels['ret'] = 'Retention';
    }

    // ── Phase 1: Sum up actuals to date ───────────────────────
    $totalSalesReal = 0;
    $totalSpendReal = 0;
    $totalQualifiedReal = 0;
    $daysEntered = 0;
    $channelActualSales = array_fill_keys(array_keys($activeChannels), 0);
    $channelActualSpend = array_fill_keys(array_keys($activeChannels), 0);
    $channelActualQualified = array_fill_keys(array_keys($activeChannels), 0);

    for ($d = 1; $d <= $totalDays; $d++) {
        $e = $entered[$d] ?? null;
        if ($e) {
            $daysEntered++;
            $daySales = 0;
            $daySpend = 0;
            $dayQualified = 0;
            $chData = json_decode($e['channels_json'] ?? '{}', true);
            if (!is_array($chData)) $chData = [];

            foreach (array_keys($activeChannels) as $ch) {
                $sales = null;
                $spend = null;
                $qualified = null;

                if (isset($chData[$ch])) {
                    if ($brandType === 'leads') {
                        $sales = isset($chData[$ch]['conversions']) && $chData[$ch]['conversions'] !== null ? (float)$chData[$ch]['conversions'] : null;
                        $qualified = isset($chData[$ch]['customers_acquired']) && $chData[$ch]['customers_acquired'] !== null ? (float)$chData[$ch]['customers_acquired'] : null;
                    } else {
                        $sales = isset($chData[$ch]['sales']) && $chData[$ch]['sales'] !== null ? (float)$chData[$ch]['sales'] : null;
                    }
                    $spend = isset($chData[$ch]['spend']) && $chData[$ch]['spend'] !== null ? (float)$chData[$ch]['spend'] : null;
                } else {
                    // Legacy column fallbacks
                    if ($ch === 'meta') { $sales = $e['meta_sales'] !== null ? (float)$e['meta_sales'] : null; $spend = $e['meta_spend'] !== null ? (float)$e['meta_spend'] : null; }
                    elseif ($ch === 'google') { $sales = $e['google_sales'] !== null ? (float)$e['google_sales'] : null; $spend = $e['google_spend'] !== null ? (float)$e['google_spend'] : null; }
                    elseif ($ch === 'mp' || $ch === 'marketplace') { $sales = $e['mp_sales'] !== null ? (float)$e['mp_sales'] : null; $spend = $e['mp_spend'] !== null ? (float)$e['mp_spend'] : null; }
                    elseif ($ch === 'ret' || $ch === 'retention') { $sales = $e['ret_sales'] !== null ? (float)$e['ret_sales'] : null; $spend = $e['ret_spend'] !== null ? (float)$e['ret_spend'] : null; }
                }

                if ($sales !== null) {
                    $channelActualSales[$ch] += $sales;
                    $daySales += $sales;
                }
                if ($spend !== null) {
                    $channelActualSpend[$ch] += $spend;
                    $daySpend += $spend;
                }
                if ($qualified !== null) {
                    $channelActualQualified[$ch] += $qualified;
                    $dayQualified += $qualified;
                }
            }
            $totalSalesReal += $daySales;
            $totalSpendReal += $daySpend;
            $totalQualifiedReal += $dayQualified;
        }
    }

    // ── Phase 2: Compute day-by-day expected targets ──────────
    $days = [];
    $remainingDays = $totalDays - $daysEntered;

    // Running totals of actual spends & sales for daily calculations
    $runningActualSpend = 0;
    $runningActualSales = 0;
    $runningChannelSpend = array_fill_keys(array_keys($activeChannels), 0);
    $runningChannelSales = array_fill_keys(array_keys($activeChannels), 0);

    for ($d = 1; $d <= $totalDays; $d++) {
        $e = $entered[$d] ?? null;
        $row = [
            'day_number'       => $d,
            'day_date'         => $e['day_date'] ?? null,
            'entered'          => (bool)$e,
            'channels'         => [],
            'total_sales_exp'  => 0,
            'total_spend_exp'  => 0,
            'total_sales_real' => null,
            'total_spend_real' => null,
            'total_roas'       => null,
            'followers_real'   => $e['followers_real'] ?? null,
            'posts_real'       => $e['posts_real'] ?? null,
            'flags'            => []
        ];

        $daySalesReal = 0;
        $daySpendReal = 0;
        $hasSales = false;
        $hasSpend = false;

        $chData = $e ? json_decode($e['channels_json'] ?? '{}', true) : [];
        if (!is_array($chData)) $chData = [];

        foreach (array_keys($activeChannels) as $ch) {
            $cfg = $configuredChannels[$ch] ?? ['pct' => 0, 'roas' => ($brandType === 'leads' ? 150 : 5)];
            $chPct = (float)($cfg['pct'] ?? 0);
            $chROAS = (float)($cfg['roas'] ?? ($brandType === 'leads' ? 150 : 5));

            // Channel monthly budget allocations
            $chTarget = $target * ($chPct / 100);
            if ($brandType === 'leads') {
                $chBudget = $chTarget * $chROAS;
            } else {
                $chBudget = $chROAS > 0 ? $chTarget / $chROAS : 0;
            }

            if ($e) {
                // Actual values entered
                $salesReal = null;
                $spendReal = null;
                $conversions = null;
                $customersAcquired = null;
                $impressions = null;
                $clicks = null;

                if (isset($chData[$ch])) {
                    if ($brandType === 'leads') {
                        $salesReal = isset($chData[$ch]['conversions']) && $chData[$ch]['conversions'] !== null ? (float)$chData[$ch]['conversions'] : null;
                        $customersAcquired = isset($chData[$ch]['customers_acquired']) && $chData[$ch]['customers_acquired'] !== null ? (int)$chData[$ch]['customers_acquired'] : null;
                    } else {
                        $salesReal = isset($chData[$ch]['sales']) && $chData[$ch]['sales'] !== null ? (float)$chData[$ch]['sales'] : null;
                        $customersAcquired = isset($chData[$ch]['customers_acquired']) && $chData[$ch]['customers_acquired'] !== null ? (int)$chData[$ch]['customers_acquired'] : null;
                    }
                    $spendReal = isset($chData[$ch]['spend']) && $chData[$ch]['spend'] !== null ? (float)$chData[$ch]['spend'] : null;
                    $conversions = isset($chData[$ch]['conversions']) && $chData[$ch]['conversions'] !== null ? (int)$chData[$ch]['conversions'] : null;
                    $impressions = isset($chData[$ch]['impressions']) && $chData[$ch]['impressions'] !== null ? (int)$chData[$ch]['impressions'] : null;
                    $clicks = isset($chData[$ch]['clicks']) && $chData[$ch]['clicks'] !== null ? (int)$chData[$ch]['clicks'] : null;
                } else {
                    if ($ch === 'meta') { $salesReal = $e['meta_sales'] !== null ? (float)$e['meta_sales'] : null; $spendReal = $e['meta_spend'] !== null ? (float)$e['meta_spend'] : null; }
                    elseif ($ch === 'google') { $salesReal = $e['google_sales'] !== null ? (float)$e['google_sales'] : null; $spendReal = $e['google_spend'] !== null ? (float)$e['google_spend'] : null; }
                    elseif ($ch === 'mp' || $ch === 'marketplace') { $salesReal = $e['mp_sales'] !== null ? (float)$e['mp_sales'] : null; $spendReal = $e['mp_spend'] !== null ? (float)$e['mp_spend'] : null; }
                    elseif ($ch === 'ret' || $ch === 'retention') { $salesReal = $e['ret_sales'] !== null ? (float)$e['ret_sales'] : null; $spendReal = $e['ret_spend'] !== null ? (float)$e['ret_spend'] : null; }
                }

                $salesExp = $totalDays > 0 ? $chTarget / $totalDays : 0;
                $spendExp = $totalDays > 0 ? $chBudget / $totalDays : 0;

                if ($salesReal !== null) {
                    $daySalesReal += $salesReal;
                    $hasSales = true;
                    $runningChannelSales[$ch] += $salesReal;
                }
                if ($spendReal !== null) {
                    $daySpendReal += $spendReal;
                    $hasSpend = true;
                    $runningChannelSpend[$ch] += $spendReal;
                }

                if ($brandType === 'leads') {
                    $roas = ($salesReal !== null && $spendReal !== null && $salesReal > 0) ? round($spendReal / $salesReal, 2) : null;
                } else {
                    $roas = ($salesReal !== null && $spendReal !== null && $spendReal > 0) ? round($salesReal / $spendReal, 2) : null;
                }

                $row['channels'][$ch] = [
                    'salesExp'           => round($salesExp, 2),
                    'spendExp'           => round($spendExp, 2),
                    'salesReal'          => $salesReal,
                    'spendReal'          => $spendReal,
                    'conversions'        => $conversions,
                    'customers_acquired' => $customersAcquired,
                    'impressions'        => $impressions,
                    'clicks'             => $clicks,
                    'roas'               => $roas,
                    'roasTarget'         => $chROAS
                ];
                
                // Real-time Flag/Anomaly Diagnostics
                if ($spendReal !== null) {
                    // Under-spending (Actual spend < Target spend by > 30%)
                    if ($spendExp > 100) {
                        $diffPct = round((($spendExp - $spendReal) / $spendExp) * 100);
                        if ($diffPct >= 30) {
                            $row['flags'][] = [
                                'level' => 'warn',
                                'msg' => "{$name} Spend Under: Actual ₹" . number_format($spendReal) . " vs Target ₹" . number_format($spendExp) . " (-{$diffPct}%)",
                                'channel' => $ch,
                                'type' => 'spend_under',
                                'diff' => $spendExp - $spendReal
                            ];
                        }
                        // Over-spending (Actual spend > Target spend by > 20%)
                        elseif ($spendReal > $spendExp * 1.2) {
                            $diffPct = round((($spendReal - $spendExp) / $spendExp) * 100);
                            $row['flags'][] = [
                                'level' => 'error',
                                'msg' => "{$name} Spend Over: Actual ₹" . number_format($spendReal) . " vs Target ₹" . number_format($spendExp) . " (+{$diffPct}%)",
                                'channel' => $ch,
                                'type' => 'spend_over',
                                'diff' => $spendReal - $spendExp
                            ];
                        }
                    }
                }

                if ($salesReal !== null && $salesExp > 0) {
                    $salesExpLimit = $brandType === 'leads' ? 2 : 100;
                    if ($salesExp > $salesExpLimit) {
                        // Sales Miss (Actual sales < Target sales by > 20%)
                        if ($salesReal < $salesExp * 0.8) {
                            $diffPct = round((($salesExp - $salesReal) / $salesExp) * 100);
                            $labelName = $brandType === 'leads' ? 'Leads' : 'Sales';
                            $row['flags'][] = [
                                'level' => 'warn',
                                'msg' => "{$name} {$labelName} Lagging: Actual " . ($brandType==='leads'?$salesReal:"₹".number_format($salesReal)) . " vs Target " . ($brandType==='leads'?round($salesExp):"₹".number_format($salesExp)) . " (-{$diffPct}%)",
                                'channel' => $ch,
                                'type' => 'sales_miss',
                                'diff' => $salesExp - $salesReal
                            ];
                        }
                    }
                }

                if ($roas !== null && $chROAS > 0) {
                    if ($brandType === 'leads') {
                        if ($roas > $chROAS * 1.1) {
                            $diffPct = round((($roas - $chROAS) / $chROAS) * 100);
                            $row['flags'][] = [
                                'level' => 'error',
                                'msg' => "{$name} CPL Over Target: Actual ₹" . number_format($roas) . " vs Target ₹" . number_format($chROAS) . " (+{$diffPct}%)",
                                'channel' => $ch,
                                'type' => 'cpl_over_target',
                                'diff' => $roas - $chROAS
                            ];
                        }
                    } else {
                        // Target ROAS Miss (Actual ROAS < Target ROAS by > 10%)
                        if ($roas < $chROAS * 0.9) {
                            $diffPct = round((($chROAS - $roas) / $chROAS) * 100);
                            $row['flags'][] = [
                                'level' => 'error',
                                'msg' => "{$name} ROAS Miss: Actual {$roas}x vs Target {$chROAS}x (-{$diffPct}%)",
                                'channel' => $ch,
                                'type' => 'roas_miss',
                                'diff' => $chROAS - $roas
                            ];
                        }
                    }
                }
                
                $row['total_sales_exp'] += $salesExp;
                $row['total_spend_exp'] += $spendExp;
            } else {
                // Future days — adaptive pacing with deficit/surplus splitting
                $daysRemainingCount = $totalDays - $d + 1;

                // Overall expected budget
                $remainingOverallSpend = max(0, $monthlyBudget - $runningActualSpend);
                $remainingOverallSales = max(0, $target - $runningActualSales);

                $spendExp = $daysRemainingCount > 0 ? $remainingOverallSpend / $daysRemainingCount : 0;
                $salesExp = $daysRemainingCount > 0 ? $remainingOverallSales / $daysRemainingCount : 0;

                // Channel-specific adaptive pacing
                $remainingChSpend = max(0, $chBudget - $runningChannelSpend[$ch]);
                $remainingChSales = max(0, $chTarget - $runningChannelSales[$ch]);

                $chSpendExp = $daysRemainingCount > 0 ? $remainingChSpend / $daysRemainingCount : 0;
                $chSalesExp = $daysRemainingCount > 0 ? $remainingChSales / $daysRemainingCount : 0;

                $row['channels'][$ch] = [
                    'salesExp'   => round($chSalesExp, 2),
                    'spendExp'   => round($chSpendExp, 2),
                    'salesReal'  => null,
                    'spendReal'  => null,
                    'roas'       => null,
                    'roasTarget' => $chROAS
                ];
                $row['total_sales_exp'] += $chSalesExp;
                $row['total_spend_exp'] += $chSpendExp;
            }
        }

        if ($e) {
            if ($hasSales) {
                $row['total_sales_real'] = round($daySalesReal, 2);
                $runningActualSales += $daySalesReal;
            }
            if ($hasSpend) {
                $row['total_spend_real'] = round($daySpendReal, 2);
                $runningActualSpend += $daySpendReal;
            }
            if ($hasSales && $hasSpend && $daySalesReal > 0) {
                if ($brandType === 'leads') {
                    $row['total_roas'] = round($daySpendReal / $daySalesReal, 2);
                } else {
                    $row['total_roas'] = round($daySalesReal / $daySpendReal, 2);
                }
            }
        }

        $row['total_sales_exp'] = round($row['total_sales_exp'], 2);
        $row['total_spend_exp'] = round($row['total_spend_exp'], 2);
        $days[] = $row;
    }

    // ── Phase 3: Pacing & Projections Summary ─────────────────
    $avgDailySales = $daysEntered > 0 ? $totalSalesReal / $daysEntered : 0;
    $avgDailySpend = $daysEntered > 0 ? $totalSpendReal / $daysEntered : 0;

    $projSales = round($totalSalesReal + ($avgDailySales * $remainingDays), 2);
    $projSpend = round($totalSpendReal + ($avgDailySpend * $remainingDays), 2);
    
    if ($brandType === 'leads') {
        $projROAS = $projSales > 0 ? round($projSpend / $projSales, 2) : null; // projected CPL
        $totalROAS = $totalSalesReal > 0 ? round($totalSpendReal / $totalSalesReal, 2) : null; // actual CPL
    } else {
        $projROAS = $projSpend > 0 ? round($projSales / $projSpend, 2) : null; // projected ROAS
        $totalROAS = $totalSpendReal > 0 ? round($totalSalesReal / $totalSpendReal, 2) : null; // actual ROAS
    }

    $spendLeft   = round($monthlyBudget - $totalSpendReal, 2);
    $revenueLeft = round($target - $totalSalesReal, 2);

    $targetPct     = $target > 0 ? round(($totalSalesReal / $target) * 100, 1) : 0;
    $projTargetPct = $target > 0 ? round(($projSales / $target) * 100, 1) : 0;

    // Days left calendar-based
    $monthEnd = new DateTime($month['year'].'-'.str_pad($month['month'], 2, '0', STR_PAD_LEFT).'-'.$totalDays);
    $daysLeft = ($today > $monthEnd) ? 0 : (int)$today->diff($monthEnd)->days;

    // Per-channel summaries
    $chSummary = [];
    foreach ($activeChannels as $ch => $name) {
        $cfg = $configuredChannels[$ch] ?? ['pct' => 0, 'roas' => ($brandType === 'leads' ? 150 : 5)];
        $chPct = (float)($cfg['pct'] ?? 0);
        $chROAS = (float)($cfg['roas'] ?? ($brandType === 'leads' ? 150 : 5));
        $chCategory = $cfg['category'] ?? 'push';

        $chTarget = $target * ($chPct / 100);
        if ($brandType === 'leads') {
            $chBudget = $chTarget * $chROAS;
        } else {
            $chBudget = $chROAS > 0 ? $chTarget / $chROAS : 0;
        }

        $cSalesR = $channelActualSales[$ch] ?? 0;
        $cSpendR = $channelActualSpend[$ch] ?? 0;
        $cQualifiedR = $channelActualQualified[$ch] ?? 0;

        if ($brandType === 'leads') {
            $chActualROAS = $cSalesR > 0 ? round($cSpendR / $cSalesR, 2) : null; // CPL = Spend / Leads
            $qualRate = $cSalesR > 0 ? round(($cQualifiedR / $cSalesR) * 100, 1) : 0;
            $cpql = $cQualifiedR > 0 ? round($cSpendR / $cQualifiedR, 2) : null;
        } else {
            $chActualROAS = $cSpendR > 0 ? round($cSalesR / $cSpendR, 2) : null; // ROAS = Sales / Spend
            $qualRate = null;
            $cpql = null;
        }

        $chSummary[$ch] = [
            'name'            => $name,
            'pct'             => $chPct,
            'target'          => round($chTarget, 2),
            'budget'          => round($chBudget, 2),
            'salesReal'       => round($cSalesR, 2),
            'spendReal'       => round($cSpendR, 2),
            'qualifiedReal'   => $cQualifiedR,
            'qualRate'        => $qualRate,
            'cpql'            => $cpql,
            'remaining'       => round($chTarget - $cSalesR, 2),
            'budgetRemaining' => round($chBudget - $cSpendR, 2),
            'roas'            => $chActualROAS,
            'roasTarget'      => $chROAS,
            'category'        => $chCategory
        ];
    }
    return [
        'days'     => $days,
        'channels' => json_encode($configuredChannels),
        'summary'  => [
            'target'          => $target,
            'roas'            => $roas,
            'monthlyBudget'   => round($monthlyBudget, 2),
            'totalDays'       => $totalDays,
            'daysLeft'        => $daysLeft,
            'enteredDays'     => $daysEntered,
            'remainingDays'   => $remainingDays,
            'totalSalesReal'  => round($totalSalesReal, 2),
            'totalSpendReal'  => round($totalSpendReal, 2),
            'totalROAS'       => $totalROAS,
            'totalQualifiedReal' => $totalQualifiedReal,
            'qualRate'        => $totalSalesReal > 0 ? round(($totalQualifiedReal / $totalSalesReal) * 100, 1) : 0,
            'totalCPQL'       => $totalQualifiedReal > 0 ? round($totalSpendReal / $totalQualifiedReal, 2) : null,
            'targetPct'       => $targetPct,
            'projectedSales'  => $projSales,
            'projectedSpend'  => $projSpend,
            'projectedROAS'   => $projROAS,
            'projTargetPct'   => $projTargetPct,
            'spendLeft'       => $spendLeft,
            'revenueLeft'     => $revenueLeft,
            'channelSummary'  => $chSummary,
            'activeChannels'  => $activeChannels
        ]
    ];
}

function getAggregatedPeriod(string $brandId, array $yearMonths): array {
    $months = [];
    foreach ($yearMonths as $ym) {
        $m = dbGet('SELECT * FROM budget_months WHERE brand_id=? AND year=? AND month=?', [$brandId, $ym['year'], $ym['month']]);
        if ($m) $months[] = $m;
    }
    
    if (empty($months)) {
        return [
            'days' => [],
            'month' => ['label' => 'No Data', 'year' => 0, 'month' => 0, 'revenue_target' => 0, 'overall_roas' => 5, 'total_days' => 30],
            'summary' => [
                'target'          => 0,
                'roas'            => 5,
                'monthlyBudget'   => 0,
                'totalDays'       => 30,
                'daysLeft'        => 0,
                'enteredDays'     => 0,
                'remainingDays'   => 30,
                'totalSalesReal'  => 0,
                'totalSpendReal'  => 0,
                'totalROAS'       => null,
                'targetPct'       => 0,
                'projectedSales'  => 0,
                'projectedSpend'  => 0,
                'projectedROAS'   => null,
                'projTargetPct'   => 0,
                'spendLeft'       => 0,
                'revenueLeft'     => 0,
                'channelSummary'  => [],
                'activeChannels'  => []
            ]
        ];
    }
    
    $aggregatedMonth = [
        'id' => 'aggregated',
        'brand_id' => $brandId,
        'label' => count($months) === 1 ? $months[0]['label'] : ($yearMonths[0]['year'] . ' - Period'),
        'year' => $yearMonths[0]['year'],
        'month' => $yearMonths[0]['month'],
        'total_days' => 0,
        'revenue_target' => 0,
        'overall_roas' => 0,
        'channels' => '{}'
    ];
    
    $allDayRows = [];
    $totalBudget = 0;
    $aggregatedChannels = [];
    
    foreach ($months as $m) {
        $aggregatedMonth['total_days'] += (int)$m['total_days'];
        $aggregatedMonth['revenue_target'] += (float)$m['revenue_target'];
        $mBudget = (float)($m['overall_roas'] > 0 ? $m['revenue_target'] / $m['overall_roas'] : 0);
        $totalBudget += $mBudget;
        
        $mChannels = json_decode($m['channels'] ?? '{}', true);
        if (!is_array($mChannels)) $mChannels = [];
        foreach ($mChannels as $ch => $cfg) {
            if (!isset($aggregatedChannels[$ch])) {
                $aggregatedChannels[$ch] = $cfg;
            } else {
                $aggregatedChannels[$ch]['roas'] = (($aggregatedChannels[$ch]['roas'] ?? 5) + ($cfg['roas'] ?? 5)) / 2;
                $aggregatedChannels[$ch]['pct'] = (($aggregatedChannels[$ch]['pct'] ?? 0) + ($cfg['pct'] ?? 0)) / 2;
            }
        }
        
        $dayRows = dbAll('SELECT * FROM budget_days WHERE month_id=? ORDER BY day_number', [$m['id']]);
        $offset = count($allDayRows);
        foreach ($dayRows as $dr) {
            $dr['day_number'] += $offset;
            $allDayRows[] = $dr;
        }
    }
    
    $aggregatedMonth['overall_roas'] = $totalBudget > 0 ? $aggregatedMonth['revenue_target'] / $totalBudget : 5;
    $aggregatedMonth['channels'] = json_encode($aggregatedChannels);
    
    $computed = computeMonth($aggregatedMonth, $allDayRows);
    return array_merge(['month' => $aggregatedMonth], $computed);
}

// ════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════
try {

// GET dashboard — all brands latest month summary (filtered by month if provided)
if ($method === 'GET' && $action === 'dashboard') {
    $filterMonth = $_GET['month'] ?? ''; // Format: "YYYY-MM"
    
    $brands = dbAll('SELECT id,slug,name,industry,type FROM brands ORDER BY name');
    if ($user['role'] !== 'superadmin' && $user['brands'] !== '*') {
        $allowed = is_array($user['brands']) ? $user['brands'] : json_decode($user['brands']??'[]',true);
        $brands = array_values(array_filter($brands, fn($b) => in_array($b['slug'],$allowed)));
    }
    file_put_contents(dirname(__DIR__) . '/scratch/bgt_debug.log', "IP: " . ($_SERVER['REMOTE_ADDR'] ?? '') . " | User ID: " . ($user['id'] ?? '') . " | Email: " . ($user['email'] ?? '') . " | Role: " . ($user['role'] ?? '') . " | Brands Config: " . json_encode($user['brands'] ?? '') . " | Brands Count: " . count($brands) . "\n", FILE_APPEND);
    
    // Get distinct months for the dropdown filter
    $availableMonths = dbAll('SELECT DISTINCT year, month, label FROM budget_months ORDER BY year DESC, month DESC');
    
    $result = [];
    foreach ($brands as $b) {
        if ($filterMonth) {
            $parts = explode('-', $filterMonth);
            $y = (int)$parts[0]; $m = (int)$parts[1];
            $month = dbGet('SELECT * FROM budget_months WHERE brand_id=? AND year=? AND month=? LIMIT 1', [$b['id'], $y, $m]);
        } else {
            $month = dbGet('SELECT * FROM budget_months WHERE brand_id=? ORDER BY year DESC, month DESC LIMIT 1', [$b['id']]);
        }
        
        if (!$month) { $result[] = ['brand'=>$b,'month'=>null,'summary'=>null,'todayFlags'=>[],'hasAlerts'=>false,'hasWarnings'=>false]; continue; }
        $dayRows  = dbAll('SELECT * FROM budget_days WHERE month_id=? ORDER BY day_number', [$month['id']]);
        $computed = computeMonth($month, $dayRows);
        // Match today by entered date OR by calendar day_number (works even if user skipped date field)
        $todayNum   = (int)date('j');
        $todayDate  = date('Y-m-d');
        $todayFlags = [];
        foreach ($computed['days'] as $day) {
            $byDate = ($day['day_date'] && substr($day['day_date'],0,10) === $todayDate);
            $byNum  = ($day['day_number'] === $todayNum);
            if ($byDate || $byNum) { $todayFlags = $day['flags']; break; }
        }
        $curMonth = date('Y-m');
        $hasStrat = (bool)dbGet('SELECT id FROM strategy_generations WHERE brand_id=? AND strategy_month=? LIMIT 1', [$b['id'], $curMonth]);
        
        $result[] = [
            'brand'      => $b,
            'month'      => $month,
            'summary'    => $computed['summary'],
            'todayFlags' => $todayFlags,
            'hasStrat'   => $hasStrat,
            'hasAlerts'  => (bool)array_filter($todayFlags, fn($f) => $f['level'] === 'error'),
            'hasWarnings'=> (bool)array_filter($todayFlags, fn($f) => $f['level'] === 'warn')
        ];
    }
    json_out(['brands' => $result, 'availableMonths' => $availableMonths]);
}

// GET brands list
if ($method === 'GET' && $action === 'brands') {
    $brands = dbAll('SELECT b.id,b.slug,b.name,b.industry,b.type FROM brands b ORDER BY b.name');
    if ($user['role'] !== 'superadmin' && $user['brands'] !== '*') {
        $allowed = is_array($user['brands']) ? $user['brands'] : json_decode($user['brands']??'[]',true);
        $brands = array_values(array_filter($brands, fn($b) => in_array($b['slug'],$allowed)));
    }
    $result = [];
    foreach ($brands as $b) {
        $latest = dbGet('SELECT bm.id,bm.label,bm.year,bm.month,bm.total_days,bm.revenue_target,bm.channels, COUNT(bd.id) as days_entered, COALESCE(SUM(bd.meta_sales),0)+COALESCE(SUM(bd.google_sales),0)+COALESCE(SUM(bd.mp_sales),0)+COALESCE(SUM(bd.ret_sales),0) as total_sales FROM budget_months bm LEFT JOIN budget_days bd ON bd.month_id=bm.id WHERE bm.brand_id=? GROUP BY bm.id ORDER BY bm.year DESC,bm.month DESC LIMIT 1', [$b['id']]);
        $result[] = array_merge($b, ['latest_month'=>$latest]);
    }
    json_out($result);
}

// POST create brand
if ($method === 'POST' && $action === 'brands') {
    if (!canManage($user)) json_err('Insufficient permissions', 403);
    $name     = trim(bodyGet('name',''));
    $industry = trim(bodyGet('industry',''));
    $type     = trim(bodyGet('type','sales'));
    if ($type !== 'leads') $type = 'sales';
    if (!$name) json_err('Brand name required');
    $slug = trim(strtolower(preg_replace('/[^a-z0-9]+/','-',$name)),'-');
    if (dbGet('SELECT id FROM brands WHERE slug=?',[$slug])) json_err('Brand already exists',409);
    $id = uuid4();
    dbRun("INSERT INTO brands (id,slug,name,industry,type,memory_json) VALUES (?,?,?,?,?,'{}')",[$id,$slug,$name,$industry,$type]);
    auditLog($user['id'],$user['name'],'BUDGET_CREATE_BRAND',$name);
    json_out(['ok'=>true,'id'=>$id,'slug'=>$slug]);
}

// GET months for brand
if ($method === 'GET' && $action === 'months' && $brandId) {
    $brand = dbGet('SELECT * FROM brands WHERE id=?',[$brandId]);
    if (!$brand || !canAccessBrand($user,$brand['slug'])) json_err('Access denied',403);
    $brandType = $brand['type'] ?? 'sales';
    $months = dbAll('SELECT bm.*, b.type as brand_type, COUNT(bd.id) as days_entered FROM budget_months bm JOIN brands b ON b.id=bm.brand_id LEFT JOIN budget_days bd ON bd.month_id=bm.id WHERE bm.brand_id=? GROUP BY bm.id ORDER BY bm.year DESC,bm.month DESC', [$brandId]);
    
    foreach ($months as &$m) {
        $dayRows = dbAll('SELECT * FROM budget_days WHERE month_id=?', [$m['id']]);
        $totalSales = 0;
        foreach ($dayRows as $dr) {
            $chData = json_decode($dr['channels_json'] ?? '{}', true);
            if (!is_array($chData)) $chData = [];
            if ($brandType === 'leads') {
                foreach ($chData as $ch) {
                    $totalSales += isset($ch['conversions']) ? (float)$ch['conversions'] : 0;
                }
            } else {
                foreach ($chData as $ch) {
                    $totalSales += isset($ch['sales']) ? (float)$ch['sales'] : 0;
                }
                // Fallback to legacy columns if channels_json is empty
                if (empty($chData)) {
                    $totalSales += (float)$dr['meta_sales'] + (float)$dr['google_sales'] + (float)$dr['mp_sales'] + (float)$dr['ret_sales'];
                }
            }
        }
        $m['total_sales_real'] = $totalSales;
    }
    json_out($months);
}

// POST create month
if ($method === 'POST' && $action === 'months' && $brandId) {
    $brand = dbGet('SELECT * FROM brands WHERE id=?',[$brandId]);
    if (!$brand || !canAccessBrand($user,$brand['slug'])) json_err('Access denied',403);
    $b = body();
    if (empty($b['label'])||empty($b['year'])||empty($b['month'])||empty($b['total_days'])||empty($b['revenue_target'])) json_err('label,year,month,total_days,revenue_target required');
    if (empty($b['channels'])) json_err('channels config required');
    
    // Prevent duplicate month creation for the same brand
    $existing = dbGet('SELECT id FROM budget_months WHERE brand_id=? AND year=? AND month=?', [$brandId, $b['year'], $b['month']]);
    if ($existing) {
        json_err('A budget for this month already exists for this brand.', 409);
    }
    
    $id = uuid4();
    dbRun('INSERT INTO budget_months (id,brand_id,label,year,month,total_days,revenue_target,overall_roas,channels,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [$id,$brandId,$b['label'],$b['year'],$b['month'],$b['total_days'],$b['revenue_target'],$b['overall_roas']??5,json_encode($b['channels']),$user['name']]);
    auditLog($user['id'],$user['name'],'BUDGET_CREATE_MONTH',$brand['name'].' — '.$b['label']);
    json_out(['ok'=>true,'id'=>$id]);
}

// PUT update month settings (revenue target, overall roas, and channels)
if ($method === 'PUT' && $action === 'settings' && $monthId) {
    if (!canManage($user)) json_err('Insufficient permissions', 403);
    $month = dbGet('SELECT bm.*,b.slug FROM budget_months bm JOIN brands b ON b.id=bm.brand_id WHERE bm.id=?', [$monthId]);
    if (!$month || !canAccessBrand($user, $month['slug'])) json_err('Access denied', 403);
    
    $b = body();
    if (empty($b['channels'])) json_err('channels required');
    
    $target = $b['revenue_target'] ?? $month['revenue_target'];
    $roas   = $b['overall_roas']   ?? $month['overall_roas'];
    $ch     = json_encode($b['channels']);
    
    dbRun('UPDATE budget_months SET revenue_target=?, overall_roas=?, channels=? WHERE id=?', [$target, $roas, $ch, $monthId]);
    json_out(['ok' => true]);
}
// GET full month data with computed values
if ($method === 'GET' && $action === 'month' && $monthId) {
    $month = dbGet('SELECT bm.*,b.slug,b.name as brand_name,b.type as brand_type FROM budget_months bm JOIN brands b ON b.id=bm.brand_id WHERE bm.id=?',[$monthId]);
    if (!$month||!canAccessBrand($user,$month['slug'])) json_err('Access denied',403);
    $dayRows  = dbAll('SELECT * FROM budget_days WHERE month_id=? ORDER BY day_number',[$monthId]);
    $computed = computeMonth($month,$dayRows);
    if (isset($computed['channels'])) {
        $month['channels'] = $computed['channels'];
    }
    json_out(array_merge(['month'=>$month],$computed));
}
// PUT save day data
if ($method === 'PUT' && $action === 'day' && $monthId && $dayNum) {
    $month = dbGet('SELECT bm.*,b.slug FROM budget_months bm JOIN brands b ON b.id=bm.brand_id WHERE bm.id=?',[$monthId]);
    if (!$month||!canAccessBrand($user,$month['slug'])) json_err('Access denied',403);
    if ($dayNum<1||$dayNum>$month['total_days']) json_err('Invalid day number');
    $b = body();
    $nf = fn($k) => isset($b[$k])&&$b[$k]!=='' ? (float)$b[$k] : null;
    $ni = fn($k) => isset($b[$k])&&$b[$k]!=='' ? (int)$b[$k]   : null;
    $chJson = isset($b['channels_data']) ? json_encode($b['channels_data']) : null;
    
    $existing = dbGet('SELECT id FROM budget_days WHERE month_id=? AND day_number=?',[$monthId,$dayNum]);
    if ($existing) {
        dbRun('UPDATE budget_days SET meta_sales=?,meta_spend=?,google_sales=?,google_spend=?,mp_sales=?,mp_spend=?,ret_sales=?,ret_spend=?,followers_real=?,posts_real=?,channels_json=?,day_date=?,entered_by=? WHERE id=?',
            [$nf('meta_sales'),$nf('meta_spend'),$nf('google_sales'),$nf('google_spend'),$nf('mp_sales'),$nf('mp_spend'),$nf('ret_sales'),$nf('ret_spend'),$ni('followers_real'),$ni('posts_real'),$chJson,$b['day_date']??null,$user['name'],$existing['id']]);
    } else {
        dbRun('INSERT INTO budget_days (id,month_id,brand_id,day_number,day_date,meta_sales,meta_spend,google_sales,google_spend,mp_sales,mp_spend,ret_sales,ret_spend,followers_real,posts_real,channels_json,entered_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [uuid4(),$monthId,$month['brand_id'],$dayNum,$b['day_date']??null,$nf('meta_sales'),$nf('meta_spend'),$nf('google_sales'),$nf('google_spend'),$nf('mp_sales'),$nf('mp_spend'),$nf('ret_sales'),$nf('ret_spend'),$ni('followers_real'),$ni('posts_real'),$chJson,$user['name']]);
    }
    json_out(['ok'=>true]);
}

// GET compare two periods
if ($method === 'GET' && $action === 'compare') {
    $type = $_GET['type'] ?? 'month';
    $brandId = $_GET['brand'] ?? '';
    
    if ($type === 'month') {
        $m1id = $_GET['month1'] ?? ''; $m2id = $_GET['month2'] ?? '';
        if (!$m1id||!$m2id) json_err('month1 and month2 required');
        $m1 = dbGet('SELECT bm.*,b.slug FROM budget_months bm JOIN brands b ON b.id=bm.brand_id WHERE bm.id=?',[$m1id]);
        $m2 = dbGet('SELECT bm.*,b.slug FROM budget_months bm JOIN brands b ON b.id=bm.brand_id WHERE bm.id=?',[$m2id]);
        if (!$m1||!$m2) json_err('Month(s) not found',404);
        if (!canAccessBrand($user,$m1['slug'])) json_err('Access denied',403);
        if (!canAccessBrand($user,$m2['slug'])) json_err('Access denied',403);
        $d1 = dbAll('SELECT * FROM budget_days WHERE month_id=? ORDER BY day_number',[$m1id]);
        $d2 = dbAll('SELECT * FROM budget_days WHERE month_id=? ORDER BY day_number',[$m2id]);
        $c1 = computeMonth($m1,$d1); $c2 = computeMonth($m2,$d2);
        json_out(['period1'=>array_merge(['month'=>$m1],$c1),'period2'=>array_merge(['month'=>$m2],$c2)]);
    }
    elseif ($type === 'quarter') {
        if (!$brandId) json_err('brand parameter required for quarterly comparison');
        $brand = dbGet('SELECT * FROM brands WHERE id=?', [$brandId]);
        if (!$brand || !canAccessBrand($user,$brand['slug'])) json_err('Access denied',403);
        
        $q1 = $_GET['q1'] ?? '';
        $q2 = $_GET['q2'] ?? '';
        if (!$q1 || !$q2) json_err('q1 and q2 quarter parameters required (e.g. 2026-Q1)');
        
        $parseQ = function($qStr) {
            list($year, $q) = explode('-Q', $qStr);
            $y = (int)$year;
            if ($q == '1') return [['year'=>$y,'month'=>1], ['year'=>$y,'month'=>2], ['year'=>$y,'month'=>3]];
            if ($q == '2') return [['year'=>$y,'month'=>4], ['year'=>$y,'month'=>5], ['year'=>$y,'month'=>6]];
            if ($q == '3') return [['year'=>$y,'month'=>7], ['year'=>$y,'month'=>8], ['year'=>$y,'month'=>9]];
            if ($q == '4') return [['year'=>$y,'month'=>10], ['year'=>$y,'month'=>11], ['year'=>$y,'month'=>12]];
            return [];
        };
        
        $ym1 = $parseQ($q1); $ym2 = $parseQ($q2);
        $p1 = getAggregatedPeriod($brandId, $ym1);
        $p2 = getAggregatedPeriod($brandId, $ym2);
        
        $p1['month']['label'] = $q1;
        $p2['month']['label'] = $q2;
        
        json_out(['period1'=>$p1, 'period2'=>$p2]);
    }
    elseif ($type === 'year') {
        if (!$brandId) json_err('brand parameter required for yearly comparison');
        $brand = dbGet('SELECT * FROM brands WHERE id=?', [$brandId]);
        if (!$brand || !canAccessBrand($user,$brand['slug'])) json_err('Access denied',403);
        
        $y1 = (int)($_GET['y1'] ?? 0);
        $y2 = (int)($_GET['y2'] ?? 0);
        if (!$y1 || !$y2) json_err('y1 and y2 year parameters required (e.g. 2025 and 2026)');
        
        $ym1 = []; $ym2 = [];
        for ($m = 1; $m <= 12; $m++) {
            $ym1[] = ['year'=>$y1, 'month'=>$m];
            $ym2[] = ['year'=>$y2, 'month'=>$m];
        }
        
        $p1 = getAggregatedPeriod($brandId, $ym1);
        $p2 = getAggregatedPeriod($brandId, $ym2);
        
        $p1['month']['label'] = (string)$y1;
        $p2['month']['label'] = (string)$y2;
        
        json_out(['period1'=>$p1, 'period2'=>$p2]);
    }
}

json_err('Not found', 404);

} catch (Throwable $e) {
    http_response_code(500);
    json_out([
        'error' => "PHP Exception: " . $e->getMessage() . " in " . basename($e->getFile()) . " on line " . $e->getLine()
    ]);
}
