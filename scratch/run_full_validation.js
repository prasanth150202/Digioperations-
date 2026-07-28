const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appJsPath = path.join(__dirname, '../assets/app.js');
let appJsCode = fs.readFileSync(appJsPath, 'utf8');

// Find genPPTX start and end
const startKeyword = 'async function genPPTX() {';
const endKeyword = 'function cleanPrice(r) {';

const startIndex = appJsCode.indexOf(startKeyword);
const endIndex = appJsCode.indexOf(endKeyword);

if (startIndex === -1 || endIndex === -1) {
  console.error("Error: Could not locate genPPTX in app.js");
  process.exit(1);
}

const lastBraceIndex = appJsCode.lastIndexOf('}', endIndex);
let genPPTXBody = appJsCode.substring(startIndex, lastBraceIndex + 1);

// Mock data & setup
const setupCode = `
const PptxGenJS = require('pptxgenjs');

const activeBrand = {
  name: 'Nirvana Brews',
  slug: 'nirvana-brews',
  industry: 'Premium Coffee',
  platform: 'Shopify'
};

const stratForm = {
  brandName: 'Nirvana Brews',
  industry: 'Premium Coffee',
  platform: 'Shopify',
  founderName: 'Aditya Sharma',
  accountManager: 'Digifyce Team',
  thisTarget: '₹25L',
  lastRevenue: '₹8L',
  kt_roas: '5x',
  strategyMonth: 'June 2026',
  primaryOffer: 'Free Premium Frother on orders above ₹1,499',
  adBudget: '₹5,00,000',
  targetROAS: '5',
  targetCAC: '350',
  usp_head_1: 'Artisanal Single-Origin Beans',
  usp_detail_1: 'Sourced directly from ethical estates in Chikmagalur for pure taste.',
  usp_head_2: 'Nitrogen-Sealed Freshness',
  usp_detail_2: 'Sealed within seconds of roasting to lock in rich aroma and crema.',
  usp_head_3: 'Zero Artificial Additives',
  usp_detail_3: '100% pure Arabica coffee with natural tasting notes.',
  usp_head_4: 'Precision Roast Profiles',
  usp_detail_4: 'Roasting customized per batch to highlight distinct flavor notes.',
  usp_head_5: 'Eco-Friendly Packaging',
  usp_detail_5: '100% biodegradable pouches to minimize environmental footprint.',
  pname0: 'THE CONNOISSEUR',
  page0: '28–45',
  pincome0: '₹80K–₹2.5L/month',
  ppain0: 'Seeks rich, nuanced taste profiles. Tired of bitter instant coffee.',
  pname1: 'THE DESK GRINDER',
  page1: '24–35',
  pincome1: '₹50K–₹1.2L/month',
  ppain1: 'Needs clean, high-grade caffeine focus for long work-from-home shifts.',
  pname2: 'THE ECO-WELLNESS BUYER',
  page2: '21–32',
  pincome2: '₹30K–₹80K/month',
  ppain2: 'Values organic sourcing and sustainable, ethical trade practices.',
  channels: [
    'Meta Ads (FB + IG)',
    'Google Ads (Shopping+Search)',
    'YouTube Ads',
    'Influencer Marketing',
    'Email + WhatsApp',
    'SEO Content'
  ],
  ch_b0: '₹2,00,000', ch_g0: 'Acquisition via brewing reels & tasting promos',
  ch_b1: '₹1,20,000', ch_g1: 'Targeting high-intent coffee queries',
  ch_b2: '₹80,000', ch_g2: 'Recipe videos & lifestyle bumper ads',
  ch_b3: '₹50,000', ch_g3: 'Coffee creators unboxing & taste reviews',
  ch_b4: '₹30,000', ch_g4: 'Subscription retention and drop alerts',
  ch_b5: '₹20,000', ch_g5: 'Organic ranking on coffee brewing guides'
};

const mockAiResponse = {
  pillars: [
    { title: 'The Chikmagalur Estate Origin', description: 'Showcasing the journey from cherry to cup on our estate.' },
    { title: 'Home Brewing Masterclass', description: 'Quick guides to making barista-quality French Press & Pour Over.' },
    { title: 'The Science of Roast', description: 'Educational content on light, medium, and dark roast flavors.' },
    { title: 'Coffee & Productivity hacks', description: 'How to optimize caffeine intake for sustained focus.' },
    { title: 'Sustainable Coffee Farming', description: 'Highlighting our zero-plastic packaging and fair wages.' },
    { title: 'Barista Tasting Notes', description: 'Guiding customers through detecting chocolate, citrus, and berry notes.' },
    { title: 'Premium Coffee Recipes', description: 'Creative cold brew and affogato recipes for summer.' },
    { title: 'Morning Rituals community', description: 'User-generated posts sharing their morning brewing setups.' }
  ],
  angles: [
    { headline: 'Quit Bitter Instant Coffee.', body: 'Upgrade to fresh, artisanal roasted single-origin beans.', cta: 'Claim Free Frother' },
    { headline: 'Barista-Quality Coffee at Home.', body: 'Brew rich, aromatic espresso right in your kitchen.', cta: 'Shop Nirvana Brews' },
    { headline: 'Sustained Focus, No Crash.', body: '100% pure organic beans with smooth, clean energy release.', cta: 'Order Starter Kit' },
    { headline: 'Direct Fair Trade Chikmagalur Beans.', body: 'Enjoy premium taste while supporting ethical farming practices.', cta: 'Learn Our Story' },
    { headline: 'Get a Free Premium Frother Today.', body: 'Elevate your coffee game. Free frother with orders above ₹1,499.', cta: 'Activate Offer' },
    { headline: 'Roasted Yesterday. At Your Door Tomorrow.', body: 'Experience the rich aroma of coffee sealed at peak roast freshness.', cta: 'Subscribe & Save' }
  ]
};

const document = {
  getElementById: (id) => ({
    style: {},
    set textContent(val) {},
    style: { display: '' }
  })
};

const alert = console.log;

const api = async (url, method, data) => {
  return mockAiResponse;
};
`;

// Replace writeFile inside genPPTX to output directly to the scratch folder
genPPTXBody = genPPTXBody.replace(
  /await pptx\.writeFile\(\{ fileName: `Strategy_\${activeBrand\.name}_\${new Date\(\)\.toISOString\(\)\.split\('T'\)\[0]\}\.pptx` \}\);/,
  `await pptx.writeFile({ fileName: require('path').join(__dirname, 'strategy_test_nirvana.pptx') });`
);

// We need to export or run genPPTX at the end
const executionFooter = `
genPPTX().then(() => {
  console.log("PPTX Generation complete!");
  process.exit(0);
}).catch(err => {
  console.error("PPTX Generation failed:", err);
  process.exit(1);
});
`;

const runnerCode = setupCode + "\n" + genPPTXBody + "\n" + executionFooter;
const runnerPath = path.join(__dirname, 'runner.js');
fs.writeFileSync(runnerPath, runnerCode, 'utf8');

console.log("Running full PPTX generation using runner.js...");
try {
  const out = execSync('node "' + runnerPath + '"');
  console.log(out.toString());
} catch (err) {
  console.error("Execution of runner failed:", err.message);
  if (err.stdout) console.error("Stdout:", err.stdout.toString());
  if (err.stderr) console.error("Stderr:", err.stderr.toString());
  process.exit(1);
}
