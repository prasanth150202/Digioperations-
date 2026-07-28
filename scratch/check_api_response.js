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

async function run() {
  console.log("Checking login API response...");
  const res = await post('http://localhost/api/auth/login', JSON.stringify({
    email: 'admin@digifyce.in',
    password: 'Admin@1234'
  }));
  console.log("Status:", res.status);
  console.log("Headers:", JSON.stringify(res.headers, null, 2));
  console.log("Body length:", res.body.length);
  console.log("Body excerpt:", res.body.slice(0, 1000));
}

run();
