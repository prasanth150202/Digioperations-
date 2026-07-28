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
  
  let foundBrand = false;
  let foundFounder = false;
  let foundIndustry = false;
  let foundTarget = false;
  let foundOffer = false;

  zipEntries.forEach((entry) => {
    if (entry.entryName.startsWith('ppt/') && entry.entryName.endsWith('.xml')) {
      const content = entry.getData().toString('utf8');
      
      if (content.includes('Nirvana Brews') || content.includes('NIRVANA BREWS')) foundBrand = true;
      if (content.includes('Aditya Sharma')) foundFounder = true;
      if (content.includes('Premium Coffee')) foundIndustry = true;
      if (content.includes('₹25L')) foundTarget = true;
      if (content.includes('Premium Frother') || content.includes('Frother')) foundOffer = true;
    }
  });

  console.log("Verification results for custom brand details in PPTX:");
  console.log(`- Brand Name 'Nirvana Brews' found: ${foundBrand}`);
  console.log(`- Founder Name 'Aditya Sharma' found: ${foundFounder}`);
  console.log(`- Industry 'Premium Coffee' found: ${foundIndustry}`);
  console.log(`- Target '₹25L' found: ${foundTarget}`);
  console.log(`- Offer 'Premium Frother' found: ${foundOffer}`);

  if (foundBrand && foundFounder && foundIndustry && foundTarget && foundOffer) {
    console.log("\nSUCCESS: All custom details for the new brand were successfully mapped to the PowerPoint presentation!");
    process.exit(0);
  } else {
    console.error("\nFAILURE: Some dynamic brand details were missing from the generated presentation slides!");
    process.exit(1);
  }
} catch (err) {
  console.error("Error auditing PPTX:", err.message);
  process.exit(1);
}
