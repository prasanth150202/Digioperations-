const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const filePath = path.join(__dirname, '../assets/app.js');
let code = fs.readFileSync(filePath, 'utf8');

// Replace tab followed by 'ext{' with '${'
const corrected = code.replace(/\text{/g, '${');

fs.writeFileSync(filePath, corrected, 'utf8');

try {
  execSync('node -c "' + filePath + '"');
  console.log("SUCCESS: Tab-ext typos fixed and app.js syntax is valid!");
} catch (err) {
  console.error("Syntax check failed after correction:", err.message);
  process.exit(1);
}
