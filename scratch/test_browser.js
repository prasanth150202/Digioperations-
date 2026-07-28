const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log("Starting browser...");
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1200, height: 800 });

  // Listen to console logs
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  // Listen to request failures
  page.on('requestfailed', request => {
    console.log(`[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`);
  });

  // Listen to response errors
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`[HTTP ERROR] ${response.url()} - ${response.status()}`);
      response.text().then(text => console.log(`  Response body: ${text}`)).catch(() => {});
    }
  });

  // Listen to page errors
  page.on('pageerror', err => {
    console.log(`[BROWSER EXCEPTION] ${err.toString()}`);
  });

  try {
    console.log("Navigating to login page...");
    await page.goto('http://localhost/index.html', { waitUntil: 'networkidle2' });

    console.log("Typing login credentials...");
    await page.type('#em', 'admin@digifyce.in');
    await page.type('#pw', 'Admin@1234');
    
    console.log("Clicking login button...");
    await page.click('button.btn');

    console.log("Waiting for navigation to app.html...");
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log("Current URL after login:", page.url());

    // Navigate to Budget page
    console.log("Navigating to #budget...");
    await page.goto('http://localhost/app.html#budget', { waitUntil: 'networkidle2' });
    await page.evaluate(() => showPage('budget'));
    await new Promise(r => setTimeout(r, 2000)); // wait 2s for requests to complete
    
    console.log("Capturing budget page screenshot...");
    await page.screenshot({ path: path.join(__dirname, 'budget_screenshot.png') });

    // Navigate to Catalog page
    console.log("Navigating to #catalog...");
    await page.evaluate(() => showPage('catalog'));
    await new Promise(r => setTimeout(r, 2000)); // wait 2s for requests to complete

    console.log("Capturing catalog page screenshot...");
    await page.screenshot({ path: path.join(__dirname, 'catalog_screenshot.png') });

  } catch (e) {
    console.error("BROWSER SCRIPT ERROR:", e);
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
}

run();
