const http = require('http');

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let chunk = '';
      res.on('data', c => chunk += c);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: chunk
      }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(url, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: 'GET',
      headers: headers
    }, (res) => {
      let chunk = '';
      res.on('data', c => chunk += c);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: chunk
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  try {
    console.log("LOGGING IN...");
    const loginRes = await post('http://localhost/api/auth/login', {
      email: 'admin@digifyce.in',
      password: 'Admin@1234'
    });
    console.log("Login Response Status:", loginRes.status);
    console.log("Login Response Body:", loginRes.body);
    
    const setCookie = loginRes.headers['set-cookie'];
    console.log("Cookies:", setCookie);
    if (!setCookie) {
      console.log("ERROR: No cookie returned from login!");
      return;
    }
    
    // Extract PHPSESSID
    const cookie = setCookie[0].split(';')[0];
    
    console.log("REQUESTING BRANDS LIST...");
    const brandsRes = await get('http://localhost/api/brands', {
      'Cookie': cookie
    });
    console.log("Brands List Status:", brandsRes.status);
    console.log("Brands List Response Length:", brandsRes.body.length);
    try {
      const data = JSON.parse(brandsRes.body);
      console.log("Brands List JSON parse successful! Count:", data.length);
    } catch (e) {
      console.log("Brands List JSON parse failed! Response:");
      console.log(brandsRes.body.slice(0, 1000));
    }
    
    console.log("REQUESTING BUDGET DASHBOARD...");
    const dashRes = await get('http://localhost/api/budget/dashboard', {
      'Cookie': cookie
    });
    console.log("Dashboard Status:", dashRes.status);
    console.log("Dashboard Response Length:", dashRes.body.length);
    try {
      const data = JSON.parse(dashRes.body);
      console.log("JSON parse successful! Brands count:", data.brands ? data.brands.length : 'undefined');
      if (data.error) {
        console.log("API Error:", data.error);
      } else {
        const brands = data.brands || [];
        brands.forEach((b, idx) => {
          const name = b.brand ? b.brand.name : 'Unknown';
          const type = b.brand ? b.brand.type : 'Unknown';
          const monthLabel = b.month ? b.month.label : 'No Month';
          const hasSum = !!b.summary;
          console.log(`Brand ${idx + 1}: ${name} [${type}] - Month: ${monthLabel} - Has Summary: ${hasSum}`);
          if (hasSum) {
            console.log(`  - targetPct: ${b.summary.targetPct}, projTargetPct: ${b.summary.projTargetPct}`);
            console.log(`  - totalSalesReal: ${b.summary.totalSalesReal}, totalROAS: ${b.summary.totalROAS}`);
          }
        });
      }
    } catch (e) {
      console.log("JSON parse failed! Raw response snippet:");
      console.log(dashRes.body.slice(0, 1000));
    }
  } catch (err) {
    console.error("HTTP REQUEST FAILED:", err);
  }
}

run();
