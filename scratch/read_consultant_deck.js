const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const pptxPath = "C:\\Users\\Lenovo\\Downloads\\Strategy_Consultant_Hapli_earth_2026-07-16.pptx";

if (!fs.existsSync(pptxPath)) {
  console.error("File does not exist:", pptxPath);
  process.exit(1);
}

const zip = new AdmZip(pptxPath);
const zipEntries = zip.getEntries();

const slideEntries = zipEntries
  .filter(e => e.entryName.startsWith('ppt/slides/slide') && e.entryName.endsWith('.xml'))
  .sort((a, b) => {
    const numA = parseInt(a.entryName.replace(/[^0-9]/g, ''));
    const numB = parseInt(b.entryName.replace(/[^0-9]/g, ''));
    return numA - numB;
  });

console.log(`Found ${slideEntries.length} slides.`);

slideEntries.forEach((entry, idx) => {
  const xmlText = entry.getData().toString('utf8');
  console.log(`\n=================== SLIDE ${idx + 1} (${entry.entryName}) ===================`);
  
  const matches = [];
  const regex = /<a:t>([^<]*)<\/a:t>/g;
  let match;
  while ((match = regex.exec(xmlText)) !== null) {
    if (match[1].trim()) {
      matches.push(match[1].trim());
    }
  }
  console.log("TEXT CONTENTS:");
  console.log(matches.join(' | '));
});
