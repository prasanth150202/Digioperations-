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

async function run() {
  console.log("Logging in...");
  const loginRes = await post('http://localhost/api/auth/login', JSON.stringify({
    email: 'admin@digifyce.in',
    password: 'Admin@1234'
  }));
  const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0].split(';')[0] : '';
  if (!cookie) {
    console.error("Login failed!");
    return;
  }
  
  console.log("Fetching products list...");
  const res = await get('http://localhost/api/pricing/adhya-erbal-are/products', { 'Cookie': cookie });
  console.log("Get status:", res.status);
  try {
    const data = JSON.parse(res.body);
    console.log("Loaded products count:", data.products?.length);
    console.log("First product name:", data.products?.[0]?.name);
    console.log("First product globals_json (pre-migration):", JSON.stringify(data.products?.[0]?.globals_json));
  } catch (e) {
    console.log("Failed to parse products json:", e.message);
    console.log("Body:", res.body.slice(0, 500));
  }
}

run();
