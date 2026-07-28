const { execSync } = require('child_process');
const http = require('http');

function post(url, data) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: body
      }));
    });
    req.on('error', (e) => resolve({ status: 500, body: e.message }));
    req.write(data);
    req.end();
  });
}

function get(url, headers = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      method: 'GET',
      headers: headers
    };
    http.get(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({
        status: res.statusCode,
        body: body
      }));
    }).on('error', (e) => resolve({ status: 500, body: e.message }));
  });
}

// Replicate the pricing helper functions to run in node
function migrateOrGetGlobals(globalsJson) {
  if (globalsJson && Array.isArray(globalsJson.components)) {
    return globalsJson;
  }
  const legacy = globalsJson || {};
  const brand = parseFloat(legacy.brand) || 0;
  const photo = parseFloat(legacy.photo) || 0;
  const pack = parseFloat(legacy.pack) || 0;
  const ship = parseFloat(legacy.ship) || 0;
  const ops = parseFloat(legacy.ops) || 0;
  const gw = parseFloat(legacy.gw) || 0;
  const rto = parseFloat(legacy.rto) || 0;
  const roas = parseFloat(legacy.roas) || 3;
  const cod_rate = parseFloat(legacy.cod_rate) || 0;
  const cod_fee = parseFloat(legacy.cod_fee) || 0;
  const pg_fee = parseFloat(legacy.pg_fee) || 0;

  const components = [];
  if (brand > 0) components.push({ id: 'c_brand', name: 'Branding', type: 'flat', applies_to: 'fixed', value: brand });
  if (photo > 0) components.push({ id: 'c_photo', name: 'Photography', type: 'flat', applies_to: 'fixed', value: photo });
  if (pack > 0) components.push({ id: 'c_pack', name: 'Packaging', type: 'flat', applies_to: 'fixed', value: pack });
  if (ship > 0) components.push({ id: 'c_ship', name: 'Shipping', type: 'flat', applies_to: 'fixed', value: ship });
  if (ops > 0) components.push({ id: 'c_ops', name: 'Operations', type: 'flat', applies_to: 'fixed', value: ops });
  if (gw > 0) components.push({ id: 'c_gw', name: 'Gift Wrap', type: 'flat', applies_to: 'fixed', value: gw });
  if (pg_fee > 0) components.push({ id: 'c_pg', name: 'PG Fee', type: 'pct', applies_to: 'sell', value: pg_fee });
  
  if (roas > 0) {
    const adSpendPct = Math.round((100 / roas) * 100) / 100;
    components.push({ id: 'c_ad', name: 'Ad Spend (Target ROAS)', type: 'pct', applies_to: 'sell', value: adSpendPct });
  }
  if (rto > 0) {
    components.push({ id: 'c_rto', name: 'RTO Risk Fee', type: 'pct', applies_to: 'mfg', value: rto });
  }
  const codCost = (cod_rate / 100) * cod_fee;
  if (codCost > 0) {
    components.push({ id: 'c_cod', name: 'COD Cost', type: 'flat', applies_to: 'fixed', value: Math.round(codCost * 100) / 100 });
  }

  return {
    components,
    target_margin: 0
  };
}

function cleanPrice(r) {
  const CLEAN_PRICES = [9, 19, 29, 39, 49, 59, 69, 79, 89, 99, 149, 199, 249, 299, 349, 399, 449, 499, 599, 699, 799, 899, 999, 1199, 1299, 1499, 1999, 2499, 2999, 3499, 3999, 4499, 4999];
  for (const p of CLEAN_PRICES) if (p >= r) return p;
  return Math.ceil(r / 100) * 100 - 1;
}

function calcVariant(v, p, globals) {
  const g = migrateOrGetGlobals(globals || p.globals_json);
  const components = g.components || [];
  const targetMargin = parseFloat(g.target_margin) || 0;

  const mfgPc = (v.mfgO != null) ? parseFloat(v.mfgO) : (parseFloat(p.mfg_per_pc) || 0);
  const qty   = p.variant_type === 'bundle' ? (v.qty || 1) : 1;
  const extras = (p.extras || []).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

  const cogsBase = mfgPc * qty + extras;

  let F = 0;
  let P_mfg = 0;
  let P_sell = 0;

  components.forEach(c => {
    const val = parseFloat(c.value) || 0;
    if (c.type === 'flat') {
      F += val;
    } else if (c.type === 'pct') {
      if (c.applies_to === 'mfg') {
        P_mfg += val / 100;
      } else if (c.applies_to === 'sell') {
        P_sell += val / 100;
      } else {
        P_mfg += val / 100;
      }
    }
  });

  const denom = 1 - P_sell - (targetMargin / 100);
  const totalBaseCost = cogsBase * (1 + P_mfg) + F;
  const suggested = denom > 0 ? totalBaseCost / denom : totalBaseCost * 4;

  const selling = v.sellingO != null ? parseFloat(v.sellingO) : cleanPrice(suggested);
  const totalCost = cogsBase * (1 + P_mfg) + F + selling * P_sell;

  const netProfit = selling - totalCost;
  const netMargin = selling > 0 ? netProfit / selling : 0;

  const grossProfit = selling - totalBaseCost;
  const grossMargin = selling > 0 ? grossProfit / selling : 0;

  const adComp = components.find(c => /ad|roas|marketing/i.test(c.name) && c.applies_to === 'sell');
  const adSpend = adComp ? (selling * (parseFloat(adComp.value) || 0) / 100) : 0;
  const roasCalc = adSpend > 0 ? selling / adSpend : (grossProfit > 0 ? selling / grossProfit : 0);

  const pgComp = components.find(c => /pg|pay|fee|gate/i.test(c.name) && c.applies_to === 'sell');
  const pgCost = pgComp ? (selling * (parseFloat(pgComp.value) || 0) / 100) : 0;

  const comp = v.compO != null ? parseFloat(v.compO) : cleanPrice(selling * 1.5);

  return {
    adjC: totalBaseCost,
    effC: totalCost,
    effS: selling,
    selling,
    comp,
    grossProfit,
    profit: grossProfit,
    netProfit,
    netMargin,
    margin: grossMargin,
    roas: roasCalc,
    adSpend,
    pgCost,
    codCost: 0,
    denom,
    suggested
  };
}

async function run() {
  const loginRes = await post('http://localhost/api/auth/login', JSON.stringify({
    email: 'admin@digifyce.in',
    password: 'Admin@1234'
  }));
  const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0].split(';')[0] : '';
  const res = await get('http://localhost/api/pricing/adhya-erbal-are/products', { 'Cookie': cookie });
  const data = JSON.parse(res.body);
  
  data.products.forEach(p => {
    p.globals = migrateOrGetGlobals(p.globals_json);
    p.variants_json = JSON.parse(JSON.stringify(p.variants_json)); // decode if needed
    p.variants_json.forEach(v => {
      const calc = calcVariant(v, p, p.globals);
      console.log(`Product: ${p.name}, Variant: ${v.name}`);
      console.log(`- Denominator: ${calc.denom}`);
      console.log(`- Suggested Price: ${calc.suggested}`);
      console.log(`- Selling Price: ${calc.selling}`);
      console.log(`- Total Cost: ${calc.effC}`);
      console.log(`- Net Profit: ${calc.netProfit}`);
      console.log(`- Net Margin: ${calc.netMargin}`);
    });
  });
}

run();
