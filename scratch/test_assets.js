const http = require('http');

function get(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({
        status: res.statusCode,
        length: data.length,
        snippet: data.slice(0, 100)
      }));
    }).on('error', (err) => {
      resolve({ status: 500, length: 0, error: err.message });
    });
  });
}

async function run() {
  const appJs = await get('http://localhost/assets/app.js?v=26');
  console.log("app.js status:", appJs.status, "length:", appJs.length);
  if (appJs.status !== 200) {
    console.log("Snippet:", appJs.snippet || appJs.error);
  }

  const styleCss = await get('http://localhost/assets/style.css?v=24');
  console.log("style.css status:", styleCss.status, "length:", styleCss.length);
}

run();
