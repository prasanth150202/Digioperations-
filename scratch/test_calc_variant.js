const fs = require('fs');

// Read app.js and extract calcVariant
const code = fs.readFileSync('assets/app.js', 'utf8');

const calcVariantMatch = code.match(/function calcVariant[\s\S]+?\n\}/);

if (!calcVariantMatch) {
  console.error("Could not find calcVariant function in app.js!");
  process.exit(1);
}

// Eval mock environment
const cleanPrice = (r) => Math.ceil(r); // Simple mock
const mockEnv = {
  calcVariant: new Function('v', 'p', 'globals', 'cleanPrice', 
    calcVariantMatch[0] + '\nreturn calcVariant(v, p, globals);')
};

// Run mock tests
const p = {
  mfg_per_pc: 100,
  variant_type: 'single',
  extras: [
    { label: 'Zipper', amount: '15' },   // Flat ₹15 by default
    { label: 'Print', amount: '10%' }    // 10% of Mfg cost by default
  ]
};

const v = {
  name: 'Default',
  mfgO: null,
  packO: null,  // Defaults to ₹20
  shipO: null,  // Defaults to ₹70
  rtoO: 15,     // 15% RTO
  taxO: 18,     // 18% Tax
  pgO: 2,       // 2% PG
  beRoasO: 3.0,
  sellingO: null,
  extraO: {
    'Zipper': '10%', // Override to be 10% of Mfg cost (should equal ₹10)
    'Print': '25'    // Override to be flat ₹25
  }
};

try {
  const calcVariantFn = (v, p) => mockEnv.calcVariant(v, p, null, cleanPrice);
  
  console.log("TEST 1: Dynamic Flat & Percentage Variant Overrides");
  const res = calcVariantFn(v, p);
  console.log("Mfg Cost per pc:", p.mfg_per_pc);
  console.log("Pack Cost (default): ₹20");
  console.log("Ship Cost (default): ₹70");
  console.log("Zipper override ('10%'): ₹" + (100 * 0.1));
  console.log("Print override ('25'): ₹25");
  console.log("Base Cost (sum): ₹" + res.baseCost);
  console.log("Multiplier (RTO 15%): " + res.multiplier + "x");
  console.log("Adjusted Cost:", res.adjC);
  console.log("Calculated Selling Price (ROAS 3.0):", res.selling);
  console.log("Ad Spend:", res.adSpend);
  
} catch (err) {
  console.error("Test failed with error:", err);
}
