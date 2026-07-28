const fs = require('fs');
const path = require('path');
const admZip = require('adm-zip');

const pptxPath = path.join(__dirname, 'strategy_test_nirvana.pptx');

if (!fs.existsSync(pptxPath)) {
  console.error("Error: strategy_test_nirvana.pptx does not exist!");
  process.exit(1);
}

try {
  const zip = new admZip(pptxPath);
  const zipEntries = zip.getEntries();
  
  let leaks = [];
  const bannedKeywords = [/black\s*ape/i, /fuaark/i, /gymx/i, /coimbatore/i];

  zipEntries.forEach((entry) => {
    // Only parse XML files inside the ppt/ folder (slides, slide layouts, etc.)
    if (entry.entryName.startsWith('ppt/') && entry.entryName.endsWith('.xml')) {
      const content = entry.getData().toString('utf8');
      
      bannedKeywords.forEach((regex) => {
        if (regex.test(content)) {
          // Find matching context
          const matchIndex = content.search(regex);
          const snippet = content.slice(Math.max(0, matchIndex - 50), Math.min(content.length, matchIndex + 50));
          leaks.push({
            file: entry.entryName,
            keyword: regex.toString(),
            snippet: snippet.trim().replace(/[\r\n\t]+/g, ' ')
          });
        }
      });
    }
  });

  if (leaks.length > 0) {
    console.log(`\nFound ${leaks.length} potential leaks of fitness/Black Ape data:`);
    leaks.forEach((leak, idx) => {
      console.log(`[${idx+1}] File: ${leak.file} | Keyword: ${leak.keyword}`);
      console.log(`    Context: "...${leak.snippet}..."`);
    });
    process.exit(1);
  } else {
    console.log("\nSUCCESS: No fitness/Black Ape keyword leaks found in the generated PPTX!");
    process.exit(0);
  }
} catch (err) {
  console.error("Error auditing PPTX:", err.message);
  process.exit(1);
}
