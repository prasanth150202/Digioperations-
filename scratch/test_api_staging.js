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
  console.log("Logging in to staging...");
  const loginRes = await post('http://localhost/staging/api/auth/login', JSON.stringify({
    email: 'admin@digifyce.in',
    password: 'Admin@1234'
  }));
  
  console.log("Login Status:", loginRes.status);
  const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0].split(';')[0] : '';
  console.log("Cookie:", cookie);

  if (!cookie) {
    console.error("Could not log in to staging!");
    return;
  }

  console.log("Fetching staging budget dashboard...");
  const dashRes = await get('http://localhost/staging/api/budget/dashboard', { 'Cookie': cookie });
  console.log("Dashboard Status:", dashRes.status);
  console.log("Dashboard Response Length:", dashRes.body.length);
  try {
    const parsed = JSON.parse(dashRes.body);
    console.log("Number of brands:", parsed.brands?.length);
    console.log("Available months:", JSON.stringify(parsed.availableMonths));
    if (parsed.error) {
      console.log("ERROR IN API:", parsed.error);
    }
  } catch (e) {
    console.log("Failed to parse JSON response:", e.message);
    console.log("Response starts with:", dashRes.body.slice(0, 500));
  }
}

run();
