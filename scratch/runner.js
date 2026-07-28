
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

async function genPPTX() {
  if (!stratForm['brandName']) { alert('Please fill in Brand Name in Step 1 first.'); return; }
  
  // 1. Get AI generation results
  document.getElementById('gen-status').textContent = 'Connecting to AI…';
  document.getElementById('gen-prog').style.width = '100%';
  document.getElementById('gen-done').style.display = 'none';
  document.getElementById('gen-error').style.display = 'none';
  document.getElementById('mo-gen').style.display = 'flex';

  try {
    const d = await api(`/api/strategy/${activeBrand.slug}/generate`, 'POST', stratForm);
    if (!d) throw new Error('Empty response from server');

    // 2. Build PPTX using library
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // Standard wide layout (13.33 x 7.5 inches)

    // Design Tokens & Colors
    const COLOR_PRIMARY = '2B4EFF';  // Digifyce Blue
    const COLOR_DARK = '0B1629';     // Dark Navy
    const COLOR_DARK2 = '111E35';    // Card Dark Navy
    const COLOR_AMBER = 'F59E0B';    // Accent Orange/Amber
    const COLOR_GREEN = '10B981';    // Success Green
    const COLOR_PURPLE = '8B5CF6';   // Retention Purple
    const COLOR_RED = 'EF4444';      // Alert Red
    const COLOR_BG_LIGHT = 'F3F4F6'; // Light Background
    const FONT_PRIMARY = 'Plus Jakarta Sans';

    // Dynamic Variables mapping
    const bName = stratForm['brandName'] || activeBrand.name;
    const indName = stratForm['industry'] || activeBrand.industry || 'D2C';
    const platName = stratForm['platform'] || activeBrand.platform || 'Shopify';
    const AM = stratForm['accountManager'] || 'Digifyce Team';
    const mTarget = stratForm['thisTarget'] || '₹30L';
    const mRev = stratForm['lastRevenue'] || '₹2L';
    const mGrowth = stratForm['kt_roas'] || '15x';
    const mMonth = stratForm['strategyMonth'] || 'May 2026';
    const fName = stratForm['founderName'] || 'Founder';

    // Check if industry relates to fitness or apparel
    const isFitness = indName.toLowerCase().includes('fit') || indName.toLowerCase().includes('gym') || indName.toLowerCase().includes('active') || indName.toLowerCase().includes('apparel') || indName.toLowerCase().includes('cloth') || indName.toLowerCase().includes('wear') || indName.toLowerCase().includes('sport');

    // Competitor segments and names based on industry
    const comp1 = isFitness ? 'Fuaark' : 'Mass Competitor';
    const comp2 = isFitness ? 'GymX' : 'Premium Competitor';
    const comp3 = isFitness ? 'Gymshark' : 'Global Benchmark';
    const ourBuild = bName.toUpperCase() + ' BUILD';

    // Primary Offer
    const primaryOffer = stratForm['primaryOffer'] || '';

    // Dynamic Target Math for Slide 18 (Attribution panel)
    let targetNum = 3000000;
    let isFormatted = false;
    let rawNumMatch = mTarget.replace(/[^0-9]/g, '');
    if (rawNumMatch) {
      targetNum = parseFloat(rawNumMatch);
      isFormatted = true;
    }
    const formatVal = (pct) => {
      if (isFormatted) {
        const val = targetNum * pct;
        if (val >= 10000000) return `₹${(val/10000000).toFixed(1).replace(/\.0$/, '')}Cr`;
        if (val >= 100000) return `₹${(val/100000).toFixed(1).replace(/\.0$/, '')}L`;
        return `₹${val.toLocaleString('en-IN')}`;
      }
      return `₹${(30 * pct).toFixed(1).replace(/\.0$/, '')}L`;
    };

    // Helper: Add Light Header
    function addHeader(s, group, title) {
      s.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: COLOR_BG_LIGHT } });
      s.addShape('rect', { x: 0.5, y: 0.3, w: 2.2, h: 0.45, fill: { color: COLOR_PRIMARY }, rectRadius: 0.1 });
      s.addText(group.toUpperCase(), { x: 0.5, y: 0.3, w: 2.2, h: 0.45, align: 'center', fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY });
      s.addText(title, {x: 2.9, y: 0.3, fontSize: 22, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 9.90, h: 0.35});
      s.addText('CONFIDENTIAL', {x: 11.5, y: 0.3, fontSize: 10, bold: true, color: 'CCCCCC', fontFace: FONT_PRIMARY, w: 3.0, h: 0.35});
    }

    // Helper: Add Dark Header
    function addDarkHeader(s, group, title) {
      s.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: COLOR_DARK } });
      s.addShape('rect', { x: 0.5, y: 0.3, w: 2.2, h: 0.45, fill: { color: COLOR_AMBER }, rectRadius: 0.1 });
      s.addText(group.toUpperCase(), { x: 0.5, y: 0.3, w: 2.2, h: 0.45, align: 'center', fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY });
      s.addText(title, {x: 2.9, y: 0.3, fontSize: 22, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 9.90, h: 0.35});
    }

    // SLIDE 1: Cover Page (Dark Theme)
    let s1 = pptx.addSlide();
    s1.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: COLOR_DARK } });
    s1.addShape('rect', { x: 0, y: 0, w: 3.8, h: 7.5, fill: { color: COLOR_PRIMARY } });
    s1.addText('POWERED BY\\nDIGIFYCE', {x: 0.4, y: 0.5, fontSize: 22, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
    
    // KPI boxes on cover slide left panel
    s1.addShape('rect', { x: 0.4, y: 1.8, w: 3.0, h: 1.4, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_AMBER, width: 2 } });
    s1.addText(mRev, {x: 0.5, y: 1.9, fontSize: 28, bold: true, color: COLOR_PRIMARY, fontFace: FONT_PRIMARY, w: 2.8, h: 0.35});
    s1.addText('Current Monthly Revenue', {x: 0.5, y: 2.6, fontSize: 11, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 2.8, h: 0.35});
    
    s1.addShape('rect', { x: 0.4, y: 3.4, w: 3.0, h: 1.4, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_AMBER, width: 2 } });
    s1.addText(mTarget, {x: 0.5, y: 3.5, fontSize: 28, bold: true, color: COLOR_PRIMARY, fontFace: FONT_PRIMARY, w: 2.8, h: 0.35});
    s1.addText('90-Day Target Plan', {x: 0.5, y: 4.2, fontSize: 11, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 2.8, h: 0.35});
    
    s1.addShape('rect', { x: 0.4, y: 5.0, w: 3.0, h: 1.4, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_GREEN, width: 2 } });
    s1.addText(mGrowth, {x: 0.5, y: 5.1, fontSize: 28, bold: true, color: COLOR_GREEN, fontFace: FONT_PRIMARY, w: 2.8, h: 0.35});
    s1.addText('Projected Blended Growth', {x: 0.5, y: 5.8, fontSize: 11, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 2.8, h: 0.35});

    s1.addText('SHOPIFY SCALE STRATEGY', {x: 4.3, y: 1.5, fontSize: 16, bold: true, color: COLOR_PRIMARY, fontFace: FONT_PRIMARY, w: 8.50, h: 0.35});
    s1.addText(bName.toUpperCase(), {x: 4.3, y: 1.9, fontSize: 44, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 8.50, h: 0.35});
    s1.addText(`${indName} · Pan India D2C · ${platName}`, {x: 4.3, y: 3.4, fontSize: 14, italic: true, color: '888888', fontFace: FONT_PRIMARY, w: 8.50, h: 0.35});
    s1.addText(`90-Day Plan: From ${mRev} to ${mTarget} Monthly Revenue`, {x: 4.3, y: 4.1, fontSize: 20, bold: true, color: COLOR_AMBER, fontFace: FONT_PRIMARY, w: 8.50, h: 0.35});
    s1.addText(`Prepared exclusively by Digifyce | Confidential | ${mMonth}`, {x: 4.3, y: 4.9, fontSize: 12, color: 'CCCCCC', fontFace: FONT_PRIMARY, w: 8.50, h: 0.35});

    // Index bar
    s1.addShape('rect', { x: 4.3, y: 5.8, w: 8.5, h: 0.9, fill: { color: COLOR_DARK2 }, rectRadius: 0.05 });
    s1.addText('Framework Tags: Brand · Funnel · Meta · Google · Influencer · Social · CRM · CRO · Roadmap', {x: 4.5, y: 6.1, w: 8.1, fontSize: 10, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

    // SLIDE 2: Brand Foundation (Light Theme)
    let s2 = pptx.addSlide();
    addHeader(s2, 'Brand Foundation', 'Brand Story & Strategic Foundation');
    
    // Left Origin Story Card
    s2.addShape('rect', { x: 0.5, y: 1.2, w: 5.8, h: 5.6, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_PRIMARY, width: 2 } });
    s2.addShape('rect', { x: 0.5, y: 1.2, w: 5.8, h: 0.6, fill: { color: COLOR_DARK } });
    s2.addText('THE ORIGIN STORY', {x: 0.7, y: 1.35, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 5.4, h: 0.35});
    
    const storyTitle = isFitness ? 'Born in Coimbatore. Built for India.' : `Born in India. Built for Scale.`;
    const storyBody = isFitness
      ? `Mr. ${fName} quit a high-paying corporate job to solve one overlooked problem: international sizing and products are not engineered for Indian body proportions.\\n\\nOur products are purpose-built for Indian proportions, chest widths, and thigh circumferences — so every workout feels right.`
      : `Mr./Ms. ${fName} started ${bName} to solve one overlooked problem: legacy offerings in the ${indName} space are not engineered for modern Indian consumers.\\n\\nOur products are purpose-built to deliver premium quality, tailored specifically for local preferences.`;

    s2.addText(storyTitle, {x: 0.7, y: 2.1, fontSize: 20, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 5.4, h: 0.35});
    s2.addText(storyBody, { x: 0.7, y: 2.7, w: 5.4, fontSize: 12, color: '333333', fontFace: FONT_PRIMARY });
    s2.addShape('rect', { x: 0.7, y: 4.6, w: 5.4, h: 0.9, fill: { color: COLOR_PRIMARY }, rectRadius: 0.05 });
    s2.addText(`${mRev} → ${mTarget} in 90 Days\\nTarget Monthly Scale Up`, {x: 0.8, y: 4.75, w: 5.2, align: 'center', fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
    
    // Dynamic USPs mapping
    const usp1 = stratForm['usp_head_1'] || (isFitness ? 'Anti-Rip Technology' : 'Premium Quality');
    const usp1Detail = stratForm['usp_detail_1'] || (isFitness ? 'Engineered to survive the most brutal workouts — every rep, every set.' : 'High-grade materials selected for maximum durability and user experience.');
    const usp2 = stratForm['usp_head_2'] || (isFitness ? 'Odour-Free Fabric' : 'Superior Design');
    const usp2Detail = stratForm['usp_detail_2'] || (isFitness ? 'Stay fresh through every session. Multi-hour wear, zero compromise.' : 'Thoughtfully crafted aesthetic that stands out and fits perfectly.');
    const usp3 = stratForm['usp_head_3'] || (isFitness ? 'Sweat-Wicking' : 'Customer-First Moat');
    const usp3Detail = stratForm['usp_detail_3'] || (isFitness ? 'Moisture pulled away instantly — keeps you dry and fully focused.' : 'Designed around real consumer feedback and solving actual pain points.');
    const usp4 = stratForm['usp_head_4'] || (isFitness ? '4-Way Ultra Stretch' : 'Sustainable Sourcing');
    const usp4Detail = stratForm['usp_detail_4'] || (isFitness ? 'Zero restriction in any direction. Full range. No pulls, no tears.' : 'Ethically made with eco-friendly standards and green logistics.');
    const usp5 = stratForm['usp_head_5'] || (isFitness ? 'Indian Body Fit' : 'Engineered for India');
    const usp5Detail = stratForm['usp_detail_5'] || (isFitness ? 'Built for Indian proportions — not scaled down from global sizes.' : 'Proportions and sizing optimized specifically for the local market.');

    const usps = [
      { t: usp1, d: usp1Detail, c: COLOR_PRIMARY },
      { t: usp2, d: usp2Detail, c: COLOR_AMBER },
      { t: usp3, d: usp3Detail, c: COLOR_RED },
      { t: usp4, d: usp4Detail, c: COLOR_PURPLE },
      { t: usp5, d: usp5Detail, c: COLOR_GREEN }
    ];

    usps.forEach((u, i) => {
      s2.addShape('rect', { x: 6.8, y: 1.2 + (i * 1.15), w: 6.0, h: 0.95, fill: { color: 'FFFFFF' }, rectRadius: 0.05, line: { color: 'E5E7EB', width: 1 } });
      s2.addShape('rect', { x: 6.8, y: 1.2 + (i * 1.15), w: 0.1, h: 0.95, fill: { color: u.c } });
      s2.addText(u.t, {x: 7.1, y: 1.3 + (i * 1.15), fontSize: 14, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 5.70, h: 0.35});
      s2.addText(u.d, {x: 7.1, y: 1.7 + (i * 1.15), fontSize: 10, color: '666666', fontFace: FONT_PRIMARY, w: 5.70, h: 0.35});
    });

    // SLIDE 3: Brand Vision (Dark Theme)
    let s3 = pptx.addSlide();
    addDarkHeader(s3, 'Brand Vision', 'Strategic Narrative & Cult Aspiration');
    s3.addText('NOT JUST A BRAND. A MOVEMENT.', {x: 0.5, y: 1.2, fontSize: 32, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
    
    const visionQuote = isFitness
      ? `"Build the Gymshark of India — where every serious lifter wears ${bName} not because of an ad, but because everyone at the gym already does."`
      : `"Build the leading ${indName} brand in India — where every consumer chooses ${bName} not because of an ad, but because of our superior quality and trust."`;
    s3.addText(visionQuote, { x: 0.5, y: 1.8, w: 12.3, fontSize: 13, color: COLOR_AMBER, italic: true, fontFace: FONT_PRIMARY });
    
    const vision = [
      { t: 'COMMUNITY IDENTITY', d: isFitness ? `"I lift. I wear ${bName}." Own the identity of the serious Indian gym community. Be the brand serious lifters call their own.` : `"I choose ${bName}." Own the customer relationship and build a highly loyal community around the brand.`, c: COLOR_PRIMARY },
      { t: 'PRODUCT TRUST', d: isFitness ? 'Products that prove themselves in every rep. No fluff — just fabric tech, body fit, and real gym performance.' : 'Products that prove themselves in everyday use. No fluff — just high-quality materials and real utility.', c: COLOR_AMBER },
      { t: 'PREMIUM AESTHETIC', d: isFitness ? 'THE Indian brand for serious, performance-focused dark content. Own this aesthetic before anyone else does.' : 'The leading brand for modern, clean, and premium content in this niche.', c: COLOR_GREEN },
      { t: 'STORY > PROMOTION', d: isFitness ? 'Indian body. Indian founder. Indian ambition. This story beats any competitor discount every single time.' : `Indian founder. Indian ambition. This story beats any competitor discount every single time.`, c: COLOR_PURPLE }
    ];

    vision.forEach((v, i) => {
      let x = 0.5 + (i % 2) * 6.2;
      let y = 2.4 + Math.floor(i / 2) * 2.1;
      s3.addShape('rect', { x, y, w: 5.9, h: 1.8, fill: { color: COLOR_DARK2 }, rectRadius: 0.05, line: { color: v.c, width: 2 } });
      s3.addText(v.t, {x: x + 0.3, y: y + 0.25, fontSize: 14, bold: true, color: v.c, fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s3.addText(v.d, {x: x + 0.3, y: y + 0.7, w: 5.3, fontSize: 11, color: 'CCCCCC', fontFace: FONT_PRIMARY, h: 0.35});
    });

    // SLIDE 4: Buyer Personas (Light Theme)
    let s4 = pptx.addSlide();
    addHeader(s4, 'Buyer Personas', "3 Core Customer Profiles — Who We're Selling To");
    const pNames = [stratForm['pname0'] || (isFitness ? 'THE IRON MONK' : 'THE PREMIUM SEEKER'), stratForm['pname1'] || (isFitness ? 'THE AESTHETIC CHASER' : 'THE VALUE BUYER'), stratForm['pname2'] || (isFitness ? 'THE MOTIVATED BEGINNER' : 'THE LIFESTYLE ENTHUSIAST')];
    const pAges = [stratForm['page0'] || '20–32', stratForm['page1'] || '22–35', stratForm['page2'] || '18–26'];
    const pIncomes = [stratForm['pincome0'] || '₹25K–₹80K/month', stratForm['pincome1'] || '₹30K–₹1.2L/month', stratForm['pincome2'] || '₹10K–₹30K/month'];
    const pPains = [
      stratForm['ppain0'] || (isFitness ? 'Gym is identity. Clothes signal seriousness. Won\\\'t compromise on fit.' : 'Wants top tier quality. Values brand reputation and design aesthetics.'),
      stratForm['ppain1'] || (isFitness ? 'Performance AND style. Wants to look good inside and outside the gym.' : 'Balances budget and quality. Seeks high-utility daily items.'),
      stratForm['ppain2'] || (isFitness ? 'Wants to feel like they belong. Right gear = motivation to show up.' : 'Newly exploring the niche. Influenced by reviews and social validation.')
    ];
    
    // Dynamic Hero Products
    let heroProductsLabel = stratForm['heroProducts'] || '';
    if (!heroProductsLabel) {
      heroProductsLabel = isFitness ? 'Stringers · Muscle Fits · Joggers' : `${bName} Bestsellers · Essentials`;
    }

    const pMsgs = [
      isFitness ? '"Built to show what you\\\'ve built"' : '"Premium choices for modern living"',
      isFitness ? '"Sculpted. Strong. Unstoppable."' : '"Quality and style in perfect balance"',
      isFitness ? '"Start somewhere. Look like you belong."' : '"Your journey starts with the best"'
    ];
    const pColors = [COLOR_PRIMARY, COLOR_PURPLE, COLOR_GREEN];

    for (let i = 0; i < 3; i++) {
      let x = 0.5 + (i * 4.25);
      s4.addShape('rect', { x, y: 1.1, w: 3.9, h: 5.7, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: pColors[i], width: 2 } });
      s4.addShape('rect', { x, y: 1.1, w: 3.9, h: 0.5, fill: { color: pColors[i] } });
      s4.addText(pNames[i], {x: x + 0.1, y: 1.2, w: 3.7, align: 'center', fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
      
      // Demographic grid inside card
      s4.addShape('rect', { x: x + 0.2, y: 1.8, w: 1.7, h: 0.7, fill: { color: COLOR_BG_LIGHT } });
      s4.addText('Age\\n' + pAges[i], {x: x + 0.3, y: 1.85, w: 1.5, fontSize: 10, color: COLOR_DARK, bold: true, fontFace: FONT_PRIMARY, h: 0.35});
      s4.addShape('rect', { x: x + 2.0, y: 1.8, w: 1.7, h: 0.7, fill: { color: COLOR_BG_LIGHT } });
      s4.addText('Income\\n' + pIncomes[i], {x: x + 2.1, y: 1.85, w: 1.5, fontSize: 10, color: COLOR_DARK, bold: true, fontFace: FONT_PRIMARY, h: 0.35});
      
      s4.addText('MINDSET', {x: x + 0.2, y: 2.7, fontSize: 10, bold: true, color: '888888', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s4.addText(pPains[i], {x: x + 0.2, y: 2.9, w: 3.5, fontSize: 11, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      
      s4.addText('HERO PRODUCTS', {x: x + 0.2, y: 3.9, fontSize: 10, bold: true, color: '888888', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s4.addText(heroProductsLabel, {x: x + 0.2, y: 4.1, w: 3.5, fontSize: 11, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      
      s4.addShape('rect', { x: x + 0.2, y: 4.9, w: 3.5, h: 0.7, fill: { color: pColors[i] }, rectRadius: 0.05 });
      s4.addText(pMsgs[i], {x: x + 0.2, y: 5.1, w: 3.5, align: 'center', fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
    }

    // SLIDE 5: Market Research (Light Theme)
    let s5 = pptx.addSlide();
    addHeader(s5, 'Market Research', `India ${indName} Market — Dynamic Retail Opportunity`);
    
    // Top 4 cards
    const mkt = [
      { v: isFitness ? '₹55,000 Cr' : '₹1,20,000 Cr', l: `Total India ${indName} Retail Market`, c: COLOR_PRIMARY },
      { v: '38%', l: `YoY Segment D2C Growth Rate`, c: COLOR_GREEN },
      { v: isFitness ? '50M+' : '150M+', l: isFitness ? 'Active Gym Members India' : 'Active Digital D2C Shoppers', c: COLOR_PURPLE },
      { v: '74%', l: 'Mobile-First Purchase Rate', c: COLOR_AMBER }
    ];
    mkt.forEach((m, i) => {
      let x = 0.5 + (i * 3.1);
      s5.addShape('rect', { x, y: 1.1, w: 2.9, h: 1.2, fill: { color: 'FFFFFF' }, rectRadius: 0.05, line: { color: m.c, width: 2 } });
      s5.addText(m.v, {x: x + 0.2, y: 1.2, fontSize: 24, bold: true, color: m.c, fontFace: FONT_PRIMARY, w: 2.5, h: 0.35});
      s5.addText(m.l, {x: x + 0.2, y: 1.7, w: 2.5, fontSize: 10, color: '666666', fontFace: FONT_PRIMARY, h: 0.35});
    });

    // Sizing vs Trends
    s5.addShape('rect', { x: 0.5, y: 2.5, w: 5.9, h: 4.3, fill: { color: 'FFFFFF' }, rectRadius: 0.1 });
    s5.addShape('rect', { x: 0.5, y: 2.5, w: 5.9, h: 0.5, fill: { color: COLOR_DARK } });
    s5.addText('MARKET SIZING', {x: 0.7, y: 2.65, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 5.5, h: 0.35});
    
    const mktSizingText = isFitness
      ? 'TAM: ₹55,000 Cr — Total India activewear retail\\nSAM: ₹8,000–10,000 Cr — Premium D2C gymwear\\nSOM: ₹3–5 Cr ARR — Realistic 12-month target\\nGAP: OPEN FIELD — No Indian brand owns body-fit story.'
      : `TAM: ₹1,20,000 Cr — Total India ${indName} retail retail\\nSAM: ₹15,000 Cr — Premium D2C D2C segment\\nSOM: ₹3–5 Cr ARR — Realistic 12-month target\\nGAP: OPEN FIELD — Trust deficit and poor sizing open the market.`;
    s5.addText(mktSizingText, { x: 0.7, y: 3.2, w: 5.5, fontSize: 12, lineSpacing: 26, color: COLOR_DARK, fontFace: FONT_PRIMARY });

    s5.addShape('rect', { x: 6.9, y: 2.5, w: 5.9, h: 4.3, fill: { color: 'FFFFFF' }, rectRadius: 0.1 });
    s5.addShape('rect', { x: 6.9, y: 2.5, w: 5.9, h: 0.5, fill: { color: COLOR_AMBER } });
    s5.addText('KEY MARKET TRENDS', {x: 7.1, y: 2.65, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 5.70, h: 0.35});
    
    const mktTrendsText = isFitness
      ? '· Dark Aesthetic: Gymshark effect reaching serious Indian lifters.\\n· Gym = Identity: Consumers wear gym brands 24/7 as lifter badge.\\n· Creator Commerce: 62% buy based on creator recommendation.\\n· Indian Body Gap: Global brands do not fit Indian ratios.'
      : `· Brand Trust: Consumers value transparency and genuine reviews.\\n· Premiumization: Buyers are trading up to premium products.\\n· Creator Commerce: 62% buy based on creator recommendation.\\n· Local Sizing Gap: Global sizing ratios do not fit Indian consumers.`;
    s5.addText(mktTrendsText, {x: 7.1, y: 3.2, w: 5.5, fontSize: 12, lineSpacing: 26, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});

    // SLIDE 6: Competitor Landscape Table (Light Theme)
    let s6 = pptx.addSlide();
    addHeader(s6, 'Competitor Landscape', 'Where We Win — Attack & Defend Map');
    
    // Build competitor table dynamically
    let tableData = [
      [
        { text: 'BRAND', options: { fill: COLOR_DARK, color: 'FFFFFF', bold: true, align: 'center', fontSize: 10 } },
        { text: 'PRICE RANGE', options: { fill: COLOR_DARK, color: 'FFFFFF', bold: true, align: 'center', fontSize: 10 } },
        { text: 'D2C?', options: { fill: COLOR_DARK, color: 'FFFFFF', bold: true, align: 'center', fontSize: 10 } },
        { text: 'THREAT', options: { fill: COLOR_DARK, color: 'FFFFFF', bold: true, align: 'center', fontSize: 10 } },
        { text: 'THEIR GAP', options: { fill: COLOR_DARK, color: 'FFFFFF', bold: true, align: 'center', fontSize: 10 } },
        { text: `${bName.toUpperCase()} WINS`, options: { fill: COLOR_DARK, color: 'FFFFFF', bold: true, align: 'center', fontSize: 10 } }
      ]
    ];

    if (isFitness) {
      tableData.push(
        ['Fuaark', '₹799–1,999', 'YES', 'HIGH', 'No Indian body story. Discount-addicted.', 'Body-fit narrative + premium strategy'],
        ['GymX', '₹999–2,499', 'YES', 'HIGH', 'Style-focused, not performance-deep.', 'Performance tech + dark aesthetic'],
        ['Bewakoof', '₹399–999', 'YES', 'MEDIUM', 'Mass fashion brand. Not gym-specific.', 'Gym-first authenticity + lifter identity'],
        ['Snitch Active', '₹699–1,499', 'YES', 'MEDIUM', 'Fashion-first. No performance tech.', 'Gym authenticity + features'],
        ['H&M', '₹999–2,499', 'YES', 'MEDIUM', 'Global fast fashion. No Indian body fit.', 'Indian proportions + community speed'],
        ['Beardo Fit', '₹599–1,299', 'YES', 'LOW', 'Commodity feel. No true fitness identity.', 'Premium positioning + community focus'],
        ['Gymshark', '₹3,00,000+', 'NO', 'BENCHMARK', 'Not in India yet. Global sizing.', 'Own India before they enter']
      );
    } else {
      tableData.push(
        ['Legacy Brands', '₹999–4,999', 'NO', 'HIGH', 'Slow to adapt to digital trends. Impersonal.', 'Direct relation + community agility'],
        ['Mass Market Players', '₹299–999', 'YES', 'MEDIUM', 'Low quality. Discount-addicted.', 'Premium positioning + high utility'],
        ['Niche Competitors', '₹599–1,499', 'YES', 'HIGH', 'Limited product line. Weak visual storytelling.', 'Broad product suite + robust brand narrative'],
        ['New D2C Entrants', '₹499–1,299', 'YES', 'MEDIUM', 'No custom sizing or fit. Supply chain issues.', 'Reliable delivery + localized sizing'],
        ['Imported Brands', '₹2,500+', 'NO', 'LOW', 'High customs duty. Not built for India.', 'Localized pricing + perfect fit'],
        ['Boutique Stores', '₹1,500+', 'YES', 'LOW', 'Poor online experience. Slow delivery.', 'Seamless Shopify CRO + fast shipping'],
        ['Global Benchmark', '₹5,000+', 'NO', 'BENCHMARK', 'Not customized for local market.', 'Own domestic market before they enter']
      );
    }

    s6.addTable(tableData, {
      x: 0.5, y: 1.1, w: 12.3, h: 5.0,
      colW: [1.8, 1.5, 0.8, 1.5, 3.2, 3.5],
      border: { color: 'E5E7EB', width: 1 },
      fontFace: FONT_PRIMARY,
      fontSize: 10,
      valign: 'middle',
      align: 'left'
    });

    const competitorInsightText = isFitness
      ? `KEY INSIGHT: No Indian brand currently owns the 'dark, serious lifter' aesthetic + Indian body-fit story combined. This is our unclaimed territory.`
      : `KEY INSIGHT: No competitor owns the local Indian story + premium D2C retention setup combined. This is our unclaimed territory.`;
    s6.addShape('rect', { x: 0.5, y: 6.2, w: 12.3, h: 0.6, fill: { color: COLOR_AMBER }, rectRadius: 0.05 });
    s6.addText(competitorInsightText, { x: 0.7, y: 6.3, w: 11.9, fontSize: 11, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY });

    // SLIDE 7: Product Comms — 8 Hero Products (Light Theme)
    let s7 = pptx.addSlide();
    addHeader(s7, 'Product Comms', '8 Hero Products — Message, Feature & Creative Bible');
    
    let heroProds = [];
    const rawHeroList = (stratForm['heroProducts'] || '').split(/[·,]+/);
    const cleanedRawHeroList = rawHeroList.map(p => p.trim()).filter(p => p.length > 0);
    
    if (cleanedRawHeroList.length > 0) {
      // Build from user input
      for (let idx = 0; idx < 8; idx++) {
        const name = cleanedRawHeroList[idx % cleanedRawHeroList.length];
        const label = cleanedRawHeroList.length > idx ? name : `${name} (Var ${idx + 1})`;
        heroProds.push({
          n: label.toUpperCase(),
          g: 'BEST SELLER',
          t: `"${bName} signature performance"`,
          f: ['Premium Materials', 'Engineered Fit', 'Daily Durability'],
          c: [COLOR_PRIMARY, COLOR_PURPLE, COLOR_DARK, COLOR_AMBER, COLOR_PRIMARY, COLOR_GREEN, COLOR_RED, COLOR_PURPLE][idx % 8]
        });
      }
    } else {
      // Fallback
      if (isFitness) {
        heroProds = [
          { n: 'MUSCLE FIT TEE', g: 'MEN', t: '"Built to show what you\\\'ve built"', f: ['4-Way Stretch', 'Biceps Strap', 'Auto Body-Adjust'], c: COLOR_PRIMARY },
          { n: 'OVERSIZED TEE', g: 'UNISEX', t: '"Start somewhere. Look like you belong."', f: ['Sweat-Wicking', 'Hides Belly Fat', 'Unisex Fit'], c: COLOR_PURPLE },
          { n: 'JOGGERS', g: 'MEN', t: '"Leg day just got a uniform"', f: ['Bamboo Fit', 'Squat Proof', 'Anti-Rip'], c: COLOR_DARK },
          { n: 'SHORTS', g: 'MEN', t: '"Move without limits"', f: ['Breathable', 'Anti-Odour', 'Squat Proof'], c: COLOR_AMBER },
          { n: 'STRINGERS', g: 'MEN', t: '"Wear your progress"', f: ['Mind-Muscle', 'Non-Restrictive', 'Odour-Free'], c: COLOR_PRIMARY },
          { n: 'TANK TOP', g: 'MEN', t: '"Arms that speak louder than words"', f: ['Arm-Highlight', 'Workout-First', 'Stylish'], c: COLOR_GREEN },
          { n: 'LEGGINGS', g: 'WOMEN', t: '"Sculpted. Strong. Unstoppable."', f: ['Built-in Underwear', 'Squat Proof', 'Spider Web'], c: COLOR_RED },
          { n: 'SPORTS BRA', g: 'WOMEN', t: '"Support that moves with you"', f: ['Fixed Pads', 'No Body Marks', 'Spider Web Tech'], c: COLOR_PURPLE }
        ];
      } else {
        heroProds = [
          { n: 'SIGNATURE PRODUCT', g: 'HERO', t: '"Premium quality you can feel"', f: ['Best-in-Class Inputs', 'Optimized Formulation/Fit', 'Extended Lifetime'], c: COLOR_PRIMARY },
          { n: 'ESSENTIALS KIT', g: 'UNISEX', t: '"Your daily D2C checklist complete"', f: ['Multi-pack value', 'Standardized Sizing', 'Easy Travel Size'], c: COLOR_PURPLE },
          { n: 'PREMIUM BUNDLE', g: 'BEST VALUE', t: '"Everything you need, in one box"', f: ['Curated Selection', 'Gift Boxing included', 'Free Shipping Tier'], c: COLOR_DARK },
          { n: 'TRAVEL PACK', g: 'ACCESSORY', t: '"Take the quality on the road"', f: ['Lightweight', 'Leak-proof / Durable', 'Refillable'], c: COLOR_AMBER },
          { n: 'STARTER PACK', g: 'NEW USER', t: '"Experience the brand difference"', f: ['Low trial barrier', 'Money-back guarantee', 'Exclusive Guide'], c: COLOR_PRIMARY },
          { n: 'LIMITED EDITION', g: 'COLLECTIBLE', t: '"Special release for the loyal community"', f: ['Scarcity branding', 'Custom packaging', 'Early member access'], c: COLOR_GREEN },
          { n: 'GIFTING SET', g: 'FESTIVE', t: '"Perfect expression of care"', f: ['Luxury presentation', 'Custom message card', 'All-occasion fit'], c: COLOR_RED },
          { n: 'REFILL / SUBSCRIPTION', g: 'LOYALTY', t: '"Never run out of your favorites"', f: ['Automated delivery', '15% discount built-in', 'Priority support'], c: COLOR_PURPLE }
        ];
      }
    }

    heroProds.forEach((hp, idx) => {
      let x = 0.5 + (idx % 4) * 3.1;
      let y = 1.1 + Math.floor(idx / 4) * 2.9;
      s7.addShape('rect', { x, y, w: 2.9, h: 2.7, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: 'E5E7EB', width: 1 } });
      s7.addShape('rect', { x, y, w: 2.9, h: 0.45, fill: { color: hp.c }, rectRadius: 0.1 });
      s7.addText(`${hp.g} · ${hp.n}`, {x: x + 0.15, y: y + 0.1, w: 2.6, fontSize: 11, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
      s7.addText(hp.t, {x: x + 0.15, y: y + 0.6, w: 2.6, fontSize: 10, bold: true, italic: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      hp.f.forEach((f, i) => {
        s7.addShape('rect', { x: x + 0.15, y: y + 1.2 + (i * 0.45), w: 2.6, h: 0.35, fill: { color: COLOR_BG_LIGHT } });
        s7.addText(f, {x: x + 0.3, y: y + 1.25 + (i * 0.45), fontSize: 10, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 2.5, h: 0.35});
      });
    });

    // SLIDE 8: Acquisition Funnel Timeline (Light Theme)
    let s8 = pptx.addSlide();
    addHeader(s8, 'Funnel & Journey', 'Acquisition-to-Cult Funnel — Every Stage & Channel');
    
    const funnel = [
      { id: '1', s: 'AWARENESS', t: 'Day 0', ch: 'Meta Broad · YouTube · Influencer', m: 'Product feature story — show the tech', a: isFitness ? 'Dark performance videos' : 'Visual product demo videos', c: COLOR_PRIMARY },
      { id: '2', s: 'INTEREST', t: 'Day 0', ch: 'Meta Engagers · IG Organic · Stories', m: 'Social proof + brand identity story', a: 'UGC posts, creator reviews', c: COLOR_PURPLE },
      { id: '3', s: 'CONSIDERATION', t: 'Day 0–1', ch: 'Meta Retargeting · Google Shopping', m: 'Feature comparison + customer reviews', a: 'Carousels, product close-ups', c: COLOR_DARK },
      { id: '4', s: 'PURCHASE', t: 'Day 1', ch: 'Meta BOFU · Google Search · WhatsApp', m: 'Offer + urgency + trust signals', a: 'Product + CTA + free gift', c: COLOR_AMBER },
      { id: '5', s: 'DELIGHT', t: 'Day 2–7', ch: 'WhatsApp · Email · Confirmation', m: 'Brand welcome + wear guide + care tips', a: 'Thank you sequence, styling', c: COLOR_GREEN },
      { id: '6', s: 'LOYALTY', t: 'Day 14–45', ch: 'WhatsApp · Email · Push', m: 'New drops + personalised next reco', a: 'Retention series, early access', c: COLOR_PURPLE },
      { id: '7', s: 'ADVOCACY', t: 'Day 60+', ch: 'Instagram UGC · Community · Referral', m: `"I am ${bName}" identity content`, a: 'UGC reposts, community events', c: COLOR_RED }
    ];

    funnel.forEach((f, i) => {
      let y = 1.1 + (i * 0.72);
      s8.addShape('rect', { x: 0.5, y, w: 0.5, h: 0.65, fill: { color: f.c } });
      s8.addText(f.id, {x: 0.5, y: y + 0.15, w: 0.5, align: 'center', fontSize: 18, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
      
      s8.addShape('rect', { x: 1.1, y, w: 11.7, h: 0.65, fill: { color: 'FFFFFF' }, rectRadius: 0.05, line: { color: 'E5E7EB', width: 1 } });
      s8.addText(f.s, {x: 1.3, y: y + 0.1, fontSize: 11, bold: true, color: f.c, fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
      s8.addText(f.t, {x: 1.3, y: y + 0.35, fontSize: 9, color: '888888', fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
      
      s8.addText(f.ch, {x: 3.2, y: y + 0.1, w: 3.0, fontSize: 10, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      s8.addText(f.m, {x: 6.4, y: y + 0.1, w: 3.3, fontSize: 10, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      s8.addText(f.a, {x: 9.8, y: y + 0.1, w: 2.8, fontSize: 10, bold: true, color: f.c, fontFace: FONT_PRIMARY, h: 0.35});
    });

    // SLIDE 9: Budget Allocation (Light Theme)
    let s9 = pptx.addSlide();
    addHeader(s9, 'Budget Strategy', `Monthly Budget — Where Every Rupee Goes & Why`);
    
    // Donut chart mock representation (Visual elegance)
    s9.addShape('rect', { x: 0.5, y: 1.1, w: 5.5, h: 5.6, fill: { color: 'FFFFFF' }, rectRadius: 0.1 });
    s9.addShape('oval', { x: 1.5, y: 1.8, w: 3.5, h: 3.5, fill: { color: COLOR_PRIMARY } });
    s9.addShape('oval', { x: 1.8, y: 2.1, w: 2.9, h: 2.9, fill: { color: COLOR_AMBER } });
    s9.addShape('oval', { x: 2.1, y: 2.4, w: 2.3, h: 2.3, fill: { color: COLOR_GREEN } });
    s9.addShape('oval', { x: 2.4, y: 2.7, w: 1.7, h: 1.7, fill: { color: 'FFFFFF' } });
    s9.addText('BUDGET\\nSPLIT', {x: 2.4, y: 3.2, w: 1.7, align: 'center', fontSize: 12, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});

    // Right list of channel allocations (computed dynamically)
    const activeChs = stratForm.channels || ['Meta Ads (FB + IG)','Google Ads (Shopping+Search)','YouTube Ads','Influencer Marketing','Content Production','Email + WhatsApp','Marketplaces'];
    
    let totalBudgetFloat = 0;
    activeChs.forEach((_, idx) => {
      const amtStr = (stratForm[`ch_b${idx}`] || '0').toString();
      totalBudgetFloat += parseFloat(amtStr.replace(/[^0-9.]/g, '')) || 0;
    });

    const channels = activeChs.map((ch, idx) => {
      const amt = stratForm[`ch_b${idx}`] || '₹0';
      const desc = stratForm[`ch_g${idx}`] || 'Channel marketing focus';
      const amtFloat = parseFloat(amt.toString().replace(/[^0-9.]/g, '')) || 0;
      const pct = totalBudgetFloat > 0 ? ((amtFloat / totalBudgetFloat) * 100).toFixed(1) + '%' : '0%';
      const colors = [COLOR_PRIMARY, COLOR_GREEN, COLOR_AMBER, COLOR_PURPLE, COLOR_RED, COLOR_DARK];
      const c = colors[idx % colors.length];
      return { p: pct, amt, label: ch, desc, c };
    });

    const visibleCount = Math.min(channels.length, 6);
    const spacing = visibleCount > 0 ? (5.3 / visibleCount) : 0.93;
    const cardH = visibleCount > 0 ? (spacing - 0.08) : 0.85;

    channels.slice(0, 6).forEach((ch, i) => {
      let y = 1.1 + (i * spacing);
      s9.addShape('rect', { x: 6.5, y, w: 6.3, h: cardH, fill: { color: 'FFFFFF' }, rectRadius: 0.05 });
      s9.addShape('rect', { x: 6.5, y, w: 0.1, h: cardH, fill: { color: ch.c } });
      s9.addText(ch.p, {x: 6.7, y: y + (cardH * 0.05), fontSize: 13, bold: true, color: ch.c, fontFace: FONT_PRIMARY, w: 0.9, h: cardH * 0.45});
      s9.addText(ch.amt, {x: 6.7, y: y + (cardH * 0.5), fontSize: 10, bold: true, color: '666666', fontFace: FONT_PRIMARY, w: 0.9, h: cardH * 0.45});
      s9.addText(ch.label, {x: 7.7, y: y + (cardH * 0.05), fontSize: 11, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 5.0, h: cardH * 0.45});
      s9.addText(ch.desc, {x: 7.7, y: y + (cardH * 0.5), fontSize: 9.5, color: '666666', fontFace: FONT_PRIMARY, w: 5.0, h: cardH * 0.45});
    });

    // SLIDE 10: Meta Ads Strategy (Light Theme)
    let s10 = pptx.addSlide();
    addHeader(s10, 'Meta Ads Strategy', 'Facebook & Instagram — Dynamic Acquisition Funnel');
    
    const metaAudience = isFitness ? 'Fitness interests · Gym · Bodybuilding · Pan India' : `${indName} Interests · Lookalikes · Broad Demographic · Pan India`;
    const metaCreativeTofu = isFitness ? 'Product features + tech demo reels' : 'Product features + visual demo reels';
    
    const metaCols = [
      { t: 'TOFU (Awareness)', amt: '40% Budget', aud: metaAudience, fmt: '15-30 sec Video Reels · Lifestyle shoots', cr: metaCreativeTofu, k: 'CPM < ₹100 · Video View Rate 25%+', c: COLOR_PRIMARY },
      { t: 'MOFU (Nurture)', amt: '30% Budget', aud: 'Video viewers 50%+ · Social Engagers · Site visitors 30d', fmt: 'Carousel Ads · Collection Ads · Slideshows', cr: 'Features + reviews + brand story + unboxings', k: 'CTR 1.5%+ · Add-to-Cart Rate 4%+', c: COLOR_PURPLE },
      { t: 'BOFU (Convert)', amt: '30% Budget', aud: 'Add to cart + checkout abandoners · 7-day visitors', fmt: 'Single Product Ads · Dynamic Product Ads (DPA)', cr: `Product + ${primaryOffer || 'special first-purchase offer'}`, k: 'ROAS 4x+ · CPA < ₹450 limit', c: COLOR_GREEN }
    ];

    metaCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s10.addShape('rect', { x, y: 1.1, w: 3.9, h: 5.0, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: col.c, width: 2 } });
      s10.addShape('rect', { x, y: 1.1, w: 3.9, h: 0.6, fill: { color: col.c } });
      s10.addText(col.t, {x: x + 0.1, y: 1.15, w: 3.7, align: 'center', fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
      s10.addText(col.amt, {x: x + 0.1, y: 1.4, w: 3.7, align: 'center', fontSize: 11, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

      s10.addText('AUDIENCE\\n' + col.aud, {x: x + 0.2, y: 1.85, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      s10.addText('FORMAT\\n' + col.fmt, {x: x + 0.2, y: 2.65, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      s10.addText('CREATIVE\\n' + col.cr, {x: x + 0.2, y: 3.45, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      s10.addText('KEY TARGET KPIs\\n' + col.k, {x: x + 0.2, y: 4.25, w: 3.5, fontSize: 10, bold: true, color: col.c, fontFace: FONT_PRIMARY, h: 0.35});
    });

    s10.addShape('rect', { x: 0.5, y: 6.2, w: 12.3, h: 0.6, fill: { color: COLOR_DARK } });
    s10.addText('5 CREATIVE ANGLES TO TEST IN PARALLEL: Feature Explainer · Customer Testimonial · Brand Film · Raw UGC · Creator Endorsement', {x: 0.7, y: 6.35, w: 11.9, fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

    // SLIDE 11: Google & YouTube (Light Theme)
    let s11 = pptx.addSlide();
    addHeader(s11, 'Google & YouTube', 'Intent Capture + Visual Brand Building');
    
    // Left Google Ads Card
    s11.addShape('rect', { x: 0.5, y: 1.1, w: 5.9, h: 5.6, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_PRIMARY, width: 2 } });
    s11.addShape('rect', { x: 0.5, y: 1.1, w: 5.9, h: 0.6, fill: { color: COLOR_PRIMARY } });
    s11.addText('GOOGLE ADS — Intent Capture', { x: 0.7, y: 1.25, fontSize: 14, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY });
    
    const shoppingTitleFmt = isFitness ? `"${bName} [Product] — Squat Proof | Anti-Rip | India"` : `"${bName} [Product] — Premium Quality | Best Price"`;
    const kwKeywords = isFitness ? '"gym shorts India", "squat proof leggings"' : `"${indName.toLowerCase()} India", "buy ${indName.toLowerCase()}"`;
    const brandBidKeyword = `"${bName} Official" — brand protection.`;
    const competitorBidKeyword = isFitness ? '"fuaark alternatives", "gymx joggers"' : `"buy ${comp1.toLowerCase()}", "${comp2.toLowerCase()} alternatives"`;
    const nonBrandKeywords = isFitness ? '"best gymwear India", "performance gym shorts"' : `"best ${indName.toLowerCase()} India", "premium ${indName.toLowerCase()} online"`;

    s11.addText(`Shopping Campaigns\\n· All hero SKUs with SEO-optimised titles.\\n· Format: ${shoppingTitleFmt}.\\n· Keywords: ${kwKeywords}.\\n\\nSearch Campaigns\\n· Brand Bid: ${brandBidKeyword}.\\n· Competitor conquests: ${competitorBidKeyword}.\\n· Non-brand: ${nonBrandKeywords}.`, { x: 0.7, y: 1.9, w: 5.5, fontSize: 11, lineSpacing: 20, color: COLOR_DARK, fontFace: FONT_PRIMARY });
    
    s11.addShape('rect', { x: 0.7, y: 4.8, w: 5.5, h: 1.6, fill: { color: COLOR_DARK }, rectRadius: 0.05 });
    
    const sampleScript = isFitness
      ? `SAMPLE AD SCRIPT (15-sec)\\n[Heavy squat] "Your shorts just ripped. Again." [Cut to ${bName} Shorts] "Squat Proof. Anti-Rip. Built for India." [CTA: Shop Now — ₹999]`
      : `SAMPLE AD SCRIPT (15-sec)\\n[Problem hook] "Tired of low-quality ${indName.toLowerCase()}?" [Cut to ${bName} Product] "Premium Quality. Engineered for India." [CTA: Buy Now]`;
    s11.addText(sampleScript, {x: 0.8, y: 4.95, w: 5.3, fontSize: 10, italic: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

    // Right YouTube Ads Card
    s11.addShape('rect', { x: 6.9, y: 1.1, w: 5.9, h: 5.6, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_RED, width: 2 } });
    s11.addShape('rect', { x: 6.9, y: 1.1, w: 5.9, h: 0.6, fill: { color: COLOR_RED } });
    s11.addText('YOUTUBE ADS — Video Reach', { x: 7.1, y: 1.25, fontSize: 14, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY });
    
    const youtubeText = isFitness
      ? '6-Second Bumper Ads\\n· Dark visual + product name + single hook. Unskippable.\\n· "Anti-rip. Squat proof. Built for India." — mass impression at scale.\\n\\n15–30 Sec Pre-Roll\\n· Structure: Problem → Feature → Proof → CTA.\\n· Target: Fitness channels, bodybuilding tutorials vlogs.\\n\\nTarget Channels:\\n· Fitness YouTube & Bodybuilding channels\\n· Gym tutorials & transformation vlogs\\n· Supplement review channels'
      : `6-Second Bumper Ads\\n· Clean visuals + product spotlight + single hook. Unskippable.\\n· "Premium quality. Ethically sourced. Built for India."\\n\\n15–30 Sec Pre-Roll\\n· Structure: Problem → Feature → Proof → CTA.\\n· Target: Lifestyle channels, product reviews vlogs.\\n\\nTarget Channels:\\n· Industry influencer channels\\n· Niche lifestyle and review channels\\n· Family and home vlogs`;
    s11.addText(youtubeText, { x: 7.1, y: 1.9, w: 5.5, fontSize: 11, lineSpacing: 22, color: COLOR_DARK, fontFace: FONT_PRIMARY });

    // SLIDE 12: Influencer Strategy (Light Theme)
    let s12 = pptx.addSlide();
    addHeader(s12, 'Influencer Strategy', 'Creator Omnipresence — Maximum Impact Seeding');
    s12.addShape('rect', { x: 0.5, y: 1.1, w: 12.3, h: 0.6, fill: { color: COLOR_DARK } });
    
    const omniGoalText = `THE OMNIPRESENCE GOAL: When someone opens Instagram in India looking for ${indName}, they see ${bName} on 3+ different creators within a week. Not viral — just everywhere.`;
    s12.addText(omniGoalText, { x: 0.7, y: 1.25, w: 11.9, fontSize: 10, bold: true, color: COLOR_AMBER, fontFace: FONT_PRIMARY });

    const infCols = [
      { t: 'MICRO CREATORS', amt: '8 Creators · Seeding', w: '10K–50K Followers', y: 'Highest engagement rates (8–12%). Niche audiences. Most authentic content. Direct community trust.', d: isFitness ? '1 REEL — Product in ACTUAL workout. Show stretch, fit, tech. Dark gym aesthetic.\\n2 STORIES — Unboxing reaction.\\n1 STATIC POST — Clean product shot.' : '1 REEL — Product in everyday use/styling. Show aesthetic, design, benefits.\\n2 STORIES — Unboxing reaction.\\n1 STATIC POST — Clean product shot.', c: COLOR_PRIMARY },
      { t: 'MID-MACRO CREATOR', amt: '1 Creator · Authority', w: '100K–500K Followers', y: 'Broader reach for brand authority. Signals we are a real, fast-growing premium D2C brand.', d: '1 REEL — Full review and usage showcase.\\nBroad awareness reach targeting modern consumers.\\nUsage rights: 90 days for repurposing as paid ads.', c: COLOR_PURPLE },
      { t: 'USAGE RIGHTS', amt: 'All Creators', w: 'All Creators', y: 'Repurpose the best creator content as paid ads. Creator UGC = top-performing ad creative.', d: 'Repurpose rights: 90 days for paid ads across Meta.\\nEvery creator brief must include usage rights clause.\\nBest UGC content becomes BOFU retargeting ads.', c: COLOR_GREEN }
    ];

    infCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s12.addShape('rect', { x, y: 1.85, w: 3.9, h: 4.8, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: col.c, width: 2 } });
      s12.addShape('rect', { x, y: 1.85, w: 3.9, h: 0.5, fill: { color: col.c } });
      s12.addText(col.t, {x: x + 0.1, y: 1.9, w: 2.2, fontSize: 11, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
      s12.addText(col.amt, {x: x + 2.3, y: 1.9, w: 1.5, align: 'right', fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

      s12.addText('WHY\\n' + col.y, {x: x + 0.2, y: 2.5, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      s12.addText('DELIVERABLES\\n' + col.d, {x: x + 0.2, y: 3.6, w: 3.5, fontSize: 10, bold: true, color: col.c, fontFace: FONT_PRIMARY, h: 0.35});
    });

    // SLIDE 13: Social Branding (Light Theme)
    let s13 = pptx.addSlide();
    addHeader(s13, 'Social Branding', 'Instagram · YouTube · Facebook — Full Platform Strategy');
    
    const handleRaw = bName.toLowerCase().replace(/\\s+/g, '');
    const ytMix = isFitness
      ? `2x Long-form/month: Gymwear comparisons, product deep-dives\\nFounder Story: "Why Mr. ${fName} quit his job to build ${bName}"\\nGym performance: "Full Leg Day in joggers — Does It Hold?"\\nYouTube Shorts from long-form content`
      : `2x Long-form/month: Product comparison and deep-dives\\nFounder Story: "Why Mr./Ms. ${fName} started ${bName}"\\nProduct performance: "${bName} product testing and reviews"\\nYouTube Shorts from long-form content`;

    const socCols = [
      { t: 'INSTAGRAM', s: `@${handleRaw}`, c: `3x Reels/week: Product features · Lifestyle integration · UGC\\n2x Static Posts: Product photography · Customer reviews\\n5x Stories/day: Polls · User tips · Product of the day\\n1x Carousel/week: Product deep-dive explainer`, id: 'Feed: Clean, premium, high-contrast. Reflecting our brand voice.', tag: `#${bName.replace(/\\s+/g, '')} #BuiltForIndia #Premium${indName.replace(/\\s+/g, '')}`, color: COLOR_RED },
      { t: 'YOUTUBE', s: `${bName} Official`, c: ytMix, id: 'Clean thumbnails. Strong product visuals. Bold white text on dark bg.', tag: 'Monthly founder LIVE: Product drops + Q&A session', color: 'FF0000' },
      { t: 'FACEBOOK', s: handleRaw, c: `Primary use: Paid retargeting pixel + dynamic product ads\\nCommunity Group: "${bName} VIPs" — drop announcements + Q&As\\nCatalogue connected for dynamic product retargeting ads\\nNot primary organic channel — mainly used for paid retargeting`, id: 'Focus: pixel-perfect attribution + catalogue for dynamic ads. Community group for loyal buyers.', tag: 'Secondary organic — primary paid retargeting + community', color: COLOR_PRIMARY }
    ];

    socCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s13.addShape('rect', { x, y: 1.1, w: 3.9, h: 5.6, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s13.addShape('rect', { x, y: 1.1, w: 3.9, h: 0.5, fill: { color: col.color } });
      s13.addText(col.t, {x: x + 0.15, y: 1.15, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s13.addText(col.s, {x: x + 2.0, y: 1.15, w: 1.75, align: 'right', fontSize: 10, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

      s13.addText('CONTENT MIX\\n' + col.c, {x: x + 0.2, y: 1.7, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      s13.addText('VISUAL IDENTITY\\n' + col.id, {x: x + 0.2, y: 3.8, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      
      s13.addShape('rect', { x: x + 0.2, y: 4.9, w: 3.5, h: 0.6, fill: { color: col.color }, rectRadius: 0.05 });
      s13.addText(col.tag, {x: x + 0.25, y: 4.95, w: 3.4, fontSize: 9, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
    });

    // SLIDE 14: Offer Strategy (Light Theme)
    let s14 = pptx.addSlide();
    addHeader(s14, 'Offer Strategy', 'Feature-First Upper Funnel, Offer-Second Lower Funnel');
    s14.addShape('rect', { x: 0.5, y: 1.1, w: 12.3, h: 0.5, fill: { color: COLOR_DARK } });
    s14.addText('"The product earns the attention. The offer closes the sale. Never the other way around."', {x: 0.7, y: 1.2, w: 11.9, fontSize: 12, bold: true, italic: true, color: COLOR_AMBER, fontFace: FONT_PRIMARY, h: 0.35});

    s14.addShape('rect', { x: 0.5, y: 1.8, w: 5.9, h: 4.9, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_PRIMARY, width: 2 } });
    s14.addShape('rect', { x: 0.5, y: 1.8, w: 5.9, h: 0.5, fill: { color: COLOR_PRIMARY } });
    s14.addText('UPPER FUNNEL — FEATURE FIRST', {x: 0.7, y: 1.95, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
    
    let upperFunnelText = '';
    if (isFitness) {
      upperFunnelText = 'Muscle Fit Tee\\n4-way stretch + biceps strap. Fits like it was made for your body.\\n\\nStringers\\nNon-restrictive. Odour-free. Built for serious sets.\\n\\nLeggings\\nSpider Web waistband. Built-in underwear. Squat proof.\\n\\nOversized Tee\\nSweat-wicking. Anti-odour. Hides insecurities.';
    } else {
      upperFunnelText = `${heroProds[0].n}\\nPremium build + top features. Designed to meet high-end specifications.\\n\\n${heroProds[1].n}\\nHigh convenience. Value pack design to drive repeat purchase.\\n\\n${heroProds[2].n}\\nStarter bundle that makes onboarding effortless.\\n\\n${heroProds[3].n}\\nTravel-ready option for high convenience on the move.`;
    }
    s14.addText(upperFunnelText, {x: 0.7, y: 2.5, w: 5.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});

    s14.addShape('rect', { x: 6.9, y: 1.8, w: 5.9, h: 4.9, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_AMBER, width: 2 } });
    s14.addShape('rect', { x: 6.9, y: 1.8, w: 5.9, h: 0.5, fill: { color: COLOR_AMBER } });
    s14.addText('LOWER FUNNEL — OFFER MECHANICS', {x: 7.1, y: 1.95, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 5.70, h: 0.35});
    
    let lowerFunnelText = '';
    if (isFitness) {
      lowerFunnelText = `Free Shaker @ ₹1,499+\\nProgress bar in cart drives AOV. Gift, not discount.\\n\\nFree ON Whey @ ₹1,500+\\nLucky winner gamification on orders. Excitement, not entitlement.\\n\\nPREPAID50 Code\\n₹50 off above ₹799. Drives prepaid shift, reduces COD returns.\\n\\n48-hr Flash Sale\\nMonthly window only. Countdown timer on site. Urgency-led.`;
    } else {
      lowerFunnelText = `${primaryOffer || 'Free Gift @ ₹1,499+'}\\nProgress bar in cart drives AOV. Gift incentive, not price slash.\\n\\nPrepaid Discount Code\\n₹50 off above ₹799. Incentivizes online payments, slashing COD RTO rates.\\n\\nExclusive Bundle Offer\\n15% off when custom bundling 3+ items. Boosts AOV immediately.\\n\\n48-hr Flash Sale\\nMonthly window only. Countdown timer on site. Urgency-led.`;
    }
    s14.addText(lowerFunnelText, { x: 7.1, y: 2.5, w: 5.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY });

    // SLIDE 15: Retention Engine (Light Theme)
    let s15 = pptx.addSlide();
    addHeader(s15, 'Retention Engine', 'WhatsApp · Email · Push — The Repeat Purchase Machine');
    
    const retCols = [
      { t: 'WHATSAPP', s: 'Business API · 85%+ Open Rate', c: `Order Confirmed\\n"Your ${bName} order is confirmed! [Order summary]"\\n\\nDay 3–5\\n"Your order arrived! Usage tip + styling tip for your next session"\\n\\nDay 14\\n"How's your first week? Tag us @${handleRaw}"\\n\\nDay 30\\n"New [Product] just dropped — check it out! [Link]"\\n\\nDay 45\\n"Complete your kit — here's what pairs with your [product]"`, color: COLOR_GREEN },
      { t: 'EMAIL', s: 'Email CRM · 28%+ Open Rate', c: `Day 0 Welcome\\nBrand story + founder origin + what we stand for\\n\\nDay 2\\n"The technology inside your product" — deep features\\n\\nDay 5\\n"Real results." — social proof + UGC + reviews\\n\\nDay 8\\n"Your exclusive offer — because you're part of the family"\\n\\nDay 10\\n"What's next? Here's what pairs with your product"`, color: COLOR_PRIMARY },
      { t: 'PUSH NOTIFICATIONS', s: 'Pushnova · 15%+ CTR', c: 'Flash Sale\\n"48 hours only — [Product] now available. Free gift at ₹1,499"\\n\\nBack In Stock\\n"[Product] is back! Limited stock — grab it"\\n\\nSocial Proof\\n"47 people bought this today — your variant is still available"\\n\\nCart Expires\\n"You left something behind. Your cart expires in 2 hours"\\n\\nNew Drop\\n"NEW DROP: [Product] just launched. Be the first to get it"', color: COLOR_PURPLE }
    ];

    retCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s15.addShape('rect', { x, y: 1.1, w: 3.9, h: 5.6, fill: { color: col.color }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s15.addShape('rect', { x, y: 1.1, w: 3.9, h: 0.5, fill: { color: col.color } });
      s15.addText(col.t, {x: x + 0.15, y: 1.15, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s15.addText(col.s, {x: x + 1.8, y: 1.15, w: 1.95, align: 'right', fontSize: 9, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

      s15.addText(col.c, {x: x + 0.2, y: 1.7, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
    });

    // SLIDE 16: Shopify Store CRO (Light Theme)
    let s16 = pptx.addSlide();
    addHeader(s16, 'Shopify CRO', "Store Optimisation — Converting Every Visitor Into Revenue");
    
    const homepageHeroText = isFitness
      ? '· Dark full-width hero video: Real athletes, gym footage, in motion.'
      : '· High-quality lifestyle hero video: Products in use, aesthetic lifestyle.';
    
    const homepageUspStrip = `· USP strip: ${usp1} · ${usp2} · ${usp3} · Free Shipping.`;

    const croPanels = [
      { t: 'HOMEPAGE', c: `${homepageHeroText}\\n${homepageUspStrip}\\n· UGC wall: Customer photos + creator feed at bottom.\\n· Trust bar: "10,000+ Happy Customers" · Star ratings.`, color: COLOR_PRIMARY },
      { t: 'PRODUCT PAGES', c: '· Headline leads with FEATURE — not just product name.\\n· 6–8 images: Product shots + close-ups.\\n· 15-sec product video: Show the usage or stretch test.\\n· Feature pills displayed ABOVE the fold — not buried in description.', color: COLOR_PURPLE },
      { t: 'CART & CHECKOUT', c: `· Progress bar: "Add ₹X more for ${primaryOffer || 'FREE Gift'} + Free Shipping".\\n· Cross-sell: "People who bought X also got Y".\\n· PREPAID50 code prominently shown at checkout page.\\n· Trust badges: Secure payment + easy returns + Made in India.`, color: COLOR_AMBER },
      { t: 'MOBILE UX', c: '· 74% of traffic is mobile — design mobile-first, not desktop.\\n· Page speed: Sub 3-second load. Compress all images.\\n· Sticky Buy Now button in thumb-zone (bottom 30% of screen).\\n· One-thumb checkout: Minimal fields, auto-fill, UPI prominent.', color: COLOR_GREEN }
    ];

    croPanels.forEach((p, i) => {
      let x = 0.5 + (i % 2) * 6.2;
      let y = 1.1 + Math.floor(i / 2) * 2.5;
      s16.addShape('rect', { x, y, w: 5.9, h: 2.3, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: p.color, width: 2 } });
      s16.addShape('rect', { x, y: y, w: 5.9, h: 0.45, fill: { color: p.color } });
      s16.addText(p.t, {x: x + 0.2, y: y + 0.1, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s16.addText(p.c, {x: x + 0.2, y: y + 0.55, w: 5.5, fontSize: 10, lineSpacing: 18, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
    });

    s16.addShape('rect', { x: 0.5, y: 6.2, w: 12.3, h: 0.6, fill: { color: COLOR_DARK } });
    s16.addText('The best ad strategy fails on a weak store. Every optimisation above directly increases conversion rate — even without changing a single ad.', {x: 0.7, y: 6.35, w: 11.9, fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

    // SLIDE 17: KPIs & Metric Target Board (Light Theme)
    let s17 = pptx.addSlide();
    addHeader(s17, 'KPIs & Metrics', '8 Non-Negotiable Numbers — How We Measure Winning');
    const kpis = [
      { v: mTarget, l: 'Monthly Revenue Target', d: 'Primary goal — all strategy serves this number', c: COLOR_PRIMARY },
      { v: '3.5x+', l: 'ROAS — Meta Ads', d: '₹1 spent must return ₹3.50 minimum on Meta', c: COLOR_GREEN },
      { v: '5x+', l: 'ROAS — Google', d: 'High-intent buyers should convert at better rate', c: COLOR_RED },
      { v: `< ₹${stratForm['targetCAC'] || '450'}`, l: 'Customer Acquisition Cost', d: `If CAC > ₹${stratForm['targetCAC'] || '450'}, contribution margin suffers`, c: COLOR_AMBER },
      { v: '₹1,800+', l: 'Average Order Value', d: 'Higher AOV = free gift triggered = better margin', c: COLOR_AMBER },
      { v: '2.5–4%', l: 'Conversion Rate', d: '1,000 visitors, <25 buyers = store problem', c: COLOR_PURPLE },
      { v: '< 60%', l: 'Cart Abandonment Rate', d: '40%+ recovery via WhatsApp = big revenue win', c: COLOR_RED },
      { v: '25%', l: 'Repeat Purchase Rate', d: 'Every repeat buyer = 5x acquisition efficiency', c: COLOR_PRIMARY }
    ];

    kpis.forEach((k, i) => {
      let x = 0.5 + (i % 4) * 3.1;
      let y = 1.1 + Math.floor(i / 4) * 2.8;
      s17.addShape('rect', { x, y, w: 2.9, h: 2.5, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: k.c, width: 2 } });
      s17.addText(k.v, {x: x + 0.2, y: y + 0.2, fontSize: 32, bold: true, color: k.c, fontFace: FONT_PRIMARY, w: 2.5, h: 0.35});
      s17.addText(k.l, {x: x + 0.2, y: y + 0.95, w: 2.5, fontSize: 12, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      s17.addText(k.d, {x: x + 0.2, y: y + 1.5, w: 2.5, fontSize: 10, color: '666666', fontFace: FONT_PRIMARY, h: 0.35});
    });

    s17.addShape('rect', { x: 0.5, y: 6.2, w: 12.3, h: 0.6, fill: { color: COLOR_DARK } });
    s17.addText('You can only scale what you can measure. These 8 numbers tell the complete health of the Shopify growth engine.', {x: 0.7, y: 6.35, w: 11.9, fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

    // SLIDE 18: Revenue Projections (Light Theme)
    let s18 = pptx.addSlide();
    addHeader(s18, 'Revenue Projections', `Month-by-Month Revenue Forecast — ${mRev} to ${mTarget} in 90 Days`);
    
    // Month cards
    const mCards = [
      { m: 'M0 (NOW)', v: mRev, o: '~133 orders · AOV ₹1,500', d: 'Baseline — pre-strategy', c: COLOR_PRIMARY },
      { m: 'MONTH 1', v: formatVal(0.20), o: '~375 orders · AOV ₹1,600', d: 'All channels live + seeding', c: COLOR_PRIMARY },
      { m: 'MONTH 2', v: formatVal(0.50), o: '~882 orders · AOV ₹1,700', d: 'Scale winners + retention', c: COLOR_GREEN },
      { m: 'MONTH 3', v: mTarget, o: '~1,667 orders · AOV ₹1,800', d: 'Full scale + repeat buyers', c: COLOR_AMBER }
    ];

    mCards.forEach((c, i) => {
      let x = 0.5 + (i * 3.1);
      s18.addShape('rect', { x, y: 1.1, w: 2.9, h: 1.4, fill: { color: 'FFFFFF' }, rectRadius: 0.05 });
      s18.addShape('rect', { x, y: 1.1, w: 2.9, h: 0.35, fill: { color: c.c } });
      s18.addText(c.m, {x: x + 0.1, y: 1.15, w: 2.7, align: 'center', fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
      s18.addText(c.v, {x: x + 0.1, y: 1.5, fontSize: 24, bold: true, color: c.c, fontFace: FONT_PRIMARY, w: 2.7, h: 0.35});
      s18.addText(c.o + '\\n' + c.d, {x: x + 0.1, y: 2.0, w: 2.7, fontSize: 9, color: '666666', fontFace: FONT_PRIMARY, h: 0.35});
    });

    // Bar chart mock visual
    s18.addShape('rect', { x: 0.5, y: 2.8, w: 5.9, h: 3.9, fill: { color: 'FFFFFF' }, rectRadius: 0.1 });
    s18.addShape('rect', { x: 1.2, y: 6.0, w: 0.6, h: 0.4, fill: { color: COLOR_PRIMARY } }); // M0
    s18.addShape('rect', { x: 2.4, y: 5.4, w: 0.6, h: 1.0, fill: { color: COLOR_PRIMARY } }); // M1
    s18.addShape('rect', { x: 3.6, y: 4.2, w: 0.6, h: 2.2, fill: { color: COLOR_GREEN } }); // M2
    s18.addShape('rect', { x: 4.8, y: 3.2, w: 0.6, h: 3.2, fill: { color: COLOR_AMBER } }); // M3
    s18.addText('M0 Now         Month 1         Month 2         Month 3', {x: 0.8, y: 6.45, w: 5.3, fontSize: 10, color: '555555', fontFace: FONT_PRIMARY, h: 0.35});

    // Month 3 Attribution panel
    s18.addShape('rect', { x: 6.9, y: 2.8, w: 5.9, h: 3.9, fill: { color: 'FFFFFF' }, rectRadius: 0.1 });
    s18.addShape('rect', { x: 6.9, y: 2.8, w: 5.9, h: 0.5, fill: { color: COLOR_DARK } });
    s18.addText('MONTH 3 ATTRIBUTION', {x: 7.1, y: 2.95, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 5.70, h: 0.35});
    
    const attributionDataText = `Meta Ads: 40% — ${formatVal(0.40)}\\nGoogle+Search: 25% — ${formatVal(0.25)}\\nInfluencer: 15% — ${formatVal(0.15)}\\nRetention: 15% — ${formatVal(0.15)}\\nOrganic/Direct: 5% — ${formatVal(0.05)}\\n\\nMonthly Spend: ${stratForm['adBudget'] || '₹3,00,000'} · Blended ROAS: ${stratForm['targetROAS'] || '10'}x · Gross Margin (40%): ${formatVal(0.40)}`;
    s18.addText(attributionDataText, { x: 7.1, y: 3.5, w: 5.5, fontSize: 11, lineSpacing: 22, color: COLOR_DARK, fontFace: FONT_PRIMARY });

    // SLIDE 19: 90-Day Execution Roadmap (Light Theme)
    let s19 = pptx.addSlide();
    addHeader(s19, '90-Day Roadmap', 'Month-by-Month Execution Plan — Nothing Left to Chance');
    
    const month1PhotoText = isFitness ? '· Dark-aesthetic product photography — 6 images/SKU.' : '· Premium product photography — 6 images/SKU.';
    const month3AmbassadorText = isFitness ? `· ${bName} Athletes program: 3 ambassadors.` : `· ${bName} Brand Ambassador program: 3 ambassadors.`;

    const rdmCols = [
      { t: 'MONTH 01', st: 'FOUNDATION & LAUNCH', tar: formatVal(0.20), c: `· Shopify store audit — speed, product pages.\\n· Meta Pixel + GA4 + WhatsApp API connected.\\n${month1PhotoText}\\n· 10 ad creatives produced (5 angles × 2 formats).\\n· Google Shopping feed with SEO-optimised titles.\\n· WhatsApp flows live — 8 touchpoints.\\n· 15 micro influencers contacted, confirmed.`, color: COLOR_PRIMARY },
      { t: 'MONTH 02', st: 'SCALE WINNERS', tar: formatVal(0.50), c: '· Analyse Month 1 — identify top ad creatives.\\n· Double budget on winning ad sets immediately.\\n· Kill bottom 20% underperforming creatives.\\n· 5 new creatives produced based on Month 1.\\n· Remaining 10 micro influencers activated.\\n· Add 1 macro creator (₹20,000 budget).\\n· A/B test: Feature-led vs lifestyle creative.', color: COLOR_GREEN },
      { t: 'MONTH 03', st: 'FULL SCALE', tar: mTarget, c: `· Scale all winning channels — increase budgets.\\n· Retention driving 30%+ of total monthly revenue.\\n· New product drop — pre-hype via Stories + Reels.\\n· Launch loyalty: Repeat buyers get early access.\\n· UGC wall live on Shopify homepage.\\n${month3AmbassadorText}\\n· Customer referral: "Give ₹200, Get ₹200".`, color: COLOR_AMBER }
    ];

    rdmCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s19.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 5.6, fill: { color: col.color }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s19.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 0.8, fill: { color: col.color } });
      s19.addText(col.t, {x: x + 0.15, y: 1.15, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s19.addText(col.st, {x: x + 0.15, y: 1.5, fontSize: 9, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s19.addShape('rect', { x: x + 2.3, y: 1.25, w: 1.4, h: 0.5, fill: { color: 'FFFFFF' }, rectRadius: 0.05 });
      s19.addText('TARGET\\n' + col.tar, {x: x + 2.3, y: 1.27, w: 1.4, align: 'center', fontSize: 10, bold: true, color: col.color, fontFace: FONT_PRIMARY, h: 0.35});

      s19.addText(col.c, {x: x + 0.2, y: 2.1, w: 3.5, fontSize: 10, lineSpacing: 18, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
    });

    // SLIDE 20: Cult Strategy (Dark Theme)
    let s20 = pptx.addSlide();
    addDarkHeader(s20, 'Cult Strategy', 'THE SCALE PLAYBOOK. THE LONG GAME.');
    s20.addText('THE LONG GAME FOR CULT COMMERCE', {x: 0.5, y: 1.2, fontSize: 32, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
    s20.addText(`"Build a community-first ecosystem for ${bName} where repeat purchase rate drives the valuation. Identity over discounts, always."`, { x: 0.5, y: 1.8, w: 12.3, fontSize: 13, color: COLOR_AMBER, italic: true, fontFace: FONT_PRIMARY });

    const cult = [
      { t: 'CREATOR ARMY', d: `50+ creators wearing and tagging ${bName} creates omnipresence — not viral, just everywhere. UGC pipeline never runs dry. CPMs drop as organic grows.`, c: COLOR_PRIMARY },
      { t: 'PRODUCT DROP CULTURE', d: 'Scarcity creates desire. Desire creates community. Limited drops with waitlists. Early access for loyal buyers. "Sold Out" is a marketing event.', c: COLOR_AMBER },
      { t: 'COMMUNITY IDENTITY', d: `"I choose ${bName}. That's who I am." Long-term ambassador programs. Exclusive customer community channels. Build a solid emotional moat.`, c: COLOR_GREEN },
      { t: 'STORY > PROMOTION', d: `Underserved market focus. Mr./Ms. ${fName} started the brand to fix it. Made in India. Built for India. Every content piece reinforces identity — never a discount.`, c: COLOR_PURPLE }
    ];

    cult.forEach((v, i) => {
      let x = 0.5 + (i % 2) * 6.2;
      let y = 2.4 + Math.floor(i / 2) * 2.1;
      s20.addShape('rect', { x, y: y, w: 5.9, h: 1.8, fill: { color: COLOR_DARK2 }, rectRadius: 0.05, line: { color: v.c, width: 2 } });
      s20.addText(v.t, {x: x + 0.3, y: y + 0.25, fontSize: 14, bold: true, color: v.c, fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s20.addText(v.d, {x: x + 0.3, y: y + 0.7, w: 5.3, fontSize: 11, color: 'CCCCCC', fontFace: FONT_PRIMARY, h: 0.35});
    });

    // SLIDE 21: Competitor Tech Stack Table (Light Theme)
    let s21 = pptx.addSlide();
    addHeader(s21, 'Competitor Intel', "Competitor Website Tech Stack — What They're Running");
    
    let techTable = [
      [
        { text: 'CATEGORY', options: { fill: COLOR_DARK, color: 'FFFFFF', bold: true, align: 'center', fontSize: 10 } },
        { text: comp1.toUpperCase(), options: { fill: COLOR_DARK, color: 'FFFFFF', bold: true, align: 'center', fontSize: 10 } },
        { text: comp2.toUpperCase(), options: { fill: COLOR_DARK, color: 'FFFFFF', bold: true, align: 'center', fontSize: 10 } },
        { text: comp3.toUpperCase(), options: { fill: COLOR_DARK, color: 'FFFFFF', bold: true, align: 'center', fontSize: 10 } },
        { text: ourBuild, options: { fill: COLOR_DARK, color: 'FFFFFF', bold: true, align: 'center', fontSize: 10 } }
      ],
      ['Platform', 'Shopify', 'Shopify', 'Shopify Plus', 'Shopify ✓'],
      ['Reviews', 'Judge.me', 'None', 'Yotpo (Premium)', 'Yotpo (Premium)'],
      ['WhatsApp', 'Manual only', 'Channel only', 'N/A', 'WATI / Interakt API'],
      ['Email / CRM', 'None confirmed', 'None confirmed', 'Klaviyo (Full)', 'Klaviyo'],
      ['Loyalty', 'Coins Program', 'None', 'Points / XP', 'Growave / Smile.io'],
      ['Mobile App', 'Yes (Appbrew)', 'No', 'Yes (Custom)', 'Phase 2 – Month 3'],
      ['Upsell', 'Not confirmed', 'OutSell', 'Rebuy', 'Rebuy / AfterSell'],
      ['Push Notifications', 'Not confirmed', 'Not confirmed', 'Yes', 'PushOwl'],
      ['Ad Channels', 'Meta (FB/IG)', 'Meta+Google', 'Meta+Google+YT', 'Meta+Google+YT']
    ];

    s21.addTable(techTable, {
      x: 0.5, y: 1.1, w: 12.3, h: 5.0,
      colW: [2.3, 2.5, 2.5, 2.5, 2.5],
      border: { color: 'E5E7EB', width: 1 },
      fontFace: FONT_PRIMARY,
      fontSize: 10,
      valign: 'middle',
      align: 'left'
    });

    s21.addShape('rect', { x: 0.5, y: 6.2, w: 12.3, h: 0.6, fill: { color: COLOR_AMBER }, rectRadius: 0.05 });
    s21.addText(`${comp1} coins program = loyalty threat. Counter with WhatsApp automation + Klaviyo flows — out-retain them, not out-discount them.`, { x: 0.7, y: 6.3, w: 11.9, fontSize: 11, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY });

    // SLIDE 22: Competitor Ad Strategy (Light Theme)
    let s22 = pptx.addSlide();
    addHeader(s22, 'Competitor Intel', 'Competitor Ad Strategy — What They Run vs. What We Own');
    
    const ourAdFormatText = isFitness
      ? `· Indian body fit narrative\\n· Founder story hooks (${fName})\\n· Tech demo videos (anti-rip, stretch)\\n· UGC from micro-creators`
      : `· Brand origin narrative\\n· Founder story hooks (${fName})\\n· Efficacy & Ingredient highlight videos\\n· UGC from micro-creators`;

    const adCols = [
      { t: comp1.toUpperCase(), c: 'AD CHANNELS\\n· Meta (FB + IG) — Primary only\\n· Instagram Reels — lifestyle video\\n· No Google Shopping confirmed\\n· No YouTube confirmed\\n\\nAD FORMATS\\n· Identity video content\\n· Brand film creatives\\n· Influencer UGC cut-downs\\n· Product Reels\\n\\nTHEIR GAP: No search intent. No YouTube. No retention ads.', color: COLOR_RED },
      { t: comp2.toUpperCase(), c: 'AD CHANNELS\\n· Meta Ads (FB + IG)\\n· Google Ads + Shopping\\n· Additional Native Ads\\n\\nAD FORMATS\\n· Product-first creatives\\n· Sale-led ad copy always\\n· Flash SALE permanent campaigns\\n· No brand identity in ads\\n\\nTHEIR GAP: All ads are price/sale focused. Zero brand story.', color: COLOR_AMBER },
      { t: bName.toUpperCase(), c: `AD CHANNELS\\n· Meta (FB+IG) — brand story angle\\n· Google Shopping — product SEO\\n· YouTube Pre-roll — Reel repurpose\\n· WhatsApp retargeting (WATI)\\n\\nAD FORMATS\\n${ourAdFormatText}\\n\\nOUR OPPORTUNITY: Own the unclaimed premium position.`, color: COLOR_PRIMARY }
    ];

    adCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s22.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 5.6, fill: { color: col.color }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s22.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 0.5, fill: { color: col.color } });
      s22.addText(col.t, {x: x + 0.15, y: 1.15, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});

      s22.addText(col.c, {x: x + 0.2, y: 1.7, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
    });

    // SLIDE 23: Competitor Offer Stack (Light Theme)
    let s23 = pptx.addSlide();
    addHeader(s23, 'Competitor Intel', 'Competitor Offer Stack — The Discount Trap We Must Avoid');
    
    let compOfferStack = [];
    if (isFitness) {
      compOfferStack = [
        { t: 'FUAARK — 20+ ACTIVE CODES', c: '· GET10 — 10% off first order\\n· JOGGERS15 — 15% off 2+ joggers\\n· COMFY350 — ₹350 off 3+ innerwear\\n· Influencer codes 10–20% off\\n· ₹100 off 2 innerwear bundle\\n· ₹500 off orders above ₹2,499\\n· Free shipping threshold-based\\n· Exchange only, no refunds policy\\n· COD available (₹49 extra fee)\\n· 70% off sitewide during peak seasons\\n\\nVERDICT FUAARK\\nCheap-first positioning. Brand equity = zero.', color: COLOR_RED },
        { t: 'GYMX — SALE-FIRST MODEL', c: '· Flash SALE — Always live, up to 50% off\\n· ₹399 start — Permanent low price anchor\\n· 10% off code — First order (generic)\\n· No bundles, no structured stacking\\n· First order 10% + free shipping stacked\\n· Free shipping all India (always on)\\n· No influencer discount codes\\n· COD available\\n· No loyalty program\\n· No structured offer architecture\\n\\nVERDICT GYMX\\nDiscount-addicted. Wait-for-code training.', color: COLOR_AMBER },
        { t: `${bName.toUpperCase()} — PREMIUM OFFERS`, c: `· Free Shaker @ ₹1,499+ — Gift, no discount\\n· Free Whey @ ₹2,00,000+ — High AOV incentive\\n· PREPAID50 — ₹50 drives prepaid shift\\n· No influencer discount codes — ever\\n· 48-hour Flash Sales only (monthly)\\n· TOFU: Features only, never codes\\n· Bundle: Outfit sets — cross-sell, not discount\\n· Early access for loyalists — reward community\\n· WhatsApp recovery: Free shaker reminder\\n· Full-price brand equity always protected\\n\\nOUR MOAT\\nPremium brand positioning.`, color: COLOR_PRIMARY }
      ];
    } else {
      compOfferStack = [
        { t: `${comp1.toUpperCase()} — HEAVY DISCOUNTS`, c: '· 10-20% off sitewide codes always active\\n· Welcome code stackable with other offers\\n· Frequent site-wide clearance sales\\n· Influencer codes widely distributed\\n· Free shipping on all orders with no minimum\\n· No structured AOV progress bars\\n· High COD return rates due to lack of prepaid push\\n\\nVERDICT\\nPositioning as low-price alternative. Zero margin cushion.', color: COLOR_RED },
        { t: `${comp2.toUpperCase()} — DISORGANIZED OFFERS`, c: '· Generic 10% off first purchase code\\n· Unstructured seasonal sale banners\\n· Free shipping threshold is inconsistent\\n· No loyalty rewards or gamified incentives\\n· High friction checkout experience\\n· Lacks post-purchase upsell strategy\\n\\nVERDICT\\nDiscount-addicted but poor UX execution.', color: COLOR_AMBER },
        { t: `${bName.toUpperCase()} — PREMIUM OFFERS`, c: `· ${primaryOffer || 'Free Gift @ ₹1,499+'}\\n· PREPAID50 — ₹50 off to incentivize prepaid UPI\\n· No permanent sitewide coupons — protect brand value\\n· Curated bundles for cross-selling (15% savings)\\n· Post-purchase one-click upsells active\\n· Flash sales limited to 48-hour monthly windows\\n· WhatsApp cart recovery sends gift triggers, not discounts\\n\\nOUR MOAT\\nMargin-protecting premium brand positioning.`, color: COLOR_PRIMARY }
      ];
    }

    compOfferStack.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s23.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 5.6, fill: { color: col.color }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s23.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 0.5, fill: { color: col.color } });
      s23.addText(col.t, {x: x + 0.15, y: 1.15, fontSize: 11, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});

      s23.addText(col.c, {x: x + 0.2, y: 1.7, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
    });

    // SLIDE 24: Recommended Tech Stack (Light Theme)
    let s24 = pptx.addSlide();
    addHeader(s24, 'Tech Stack', `${bName} Recommended Tech Stack — Tools to Install`);
    const techStack = [
      { t: 'WhatsApp Business API', amt: '₹4,000–7,000/mo', sub: 'DAY 1', desc: `WhatsApp Business API — automated order confirm, cart recovery, broadcasts.\\n\\n${comp1} has NO automation. ${comp2} has NO automation. Immediate advantage.`, color: COLOR_GREEN },
      { t: 'Email Automation', amt: 'Free → ₹3,500/mo', sub: 'DAY 1', desc: `Full email CRM — 5-email welcome flow, abandoned cart, post-purchase sequences.\\n\\nNeither ${comp1} nor ${comp2} uses email marketing actively.`, color: COLOR_PRIMARY },
      { t: 'Reviews Collector', amt: '₹1,500–2,500/mo', sub: 'DAY 1', desc: `Photo + video reviews auto-collected. Feeds Google Shopping + builds trust wall.\\n\\n${comp1} uses reviews. Match them. Add photo incentive for UGC advantage.`, color: COLOR_RED },
      { t: 'Push Notifications', amt: 'Free → ₹1,200/mo', sub: 'MONTH 1', desc: `Web push notifications — flash sale alerts, back-in-stock, abandoned cart.\\n\\nNeither competitor uses push. 15%+ CTR on engaged subscribers.`, color: COLOR_PURPLE },
      { t: 'Rebuy / AfterSell', amt: '₹2,500–4,000/mo', sub: 'MONTH 1', desc: `Post-purchase upsell page + cart upsells. "Complete the bundle" cross-sells.\\n\\n${comp2} has OutSell. Match + exceed with Rebuy's AI engine.`, color: COLOR_AMBER },
      { t: 'GA4 + Meta Pixel', amt: 'FREE', sub: 'DAY 1', desc: `Full attribution setup. UTM tracking on every campaign from Day 1.\\n\\nBoth competitors confirmed using GA4 + FB Pixel. Table stakes — must have.`, color: COLOR_DARK }
    ];

    techStack.forEach((stack, i) => {
      let x = 0.5 + (i % 3) * 4.25;
      let y = 1.1 + Math.floor(i / 3) * 2.8;
      s24.addShape('rect', { x: 0.5 + (i % 3) * 4.25, y: 1.1 + Math.floor(i / 3) * 2.8, w: 3.9, h: 2.5, fill: { color: stack.color }, rectRadius: 0.1, line: { color: stack.color, width: 2 } });
      s24.addShape('rect', { x: 0.5 + (i % 3) * 4.25, y: 1.1 + Math.floor(i / 3) * 2.8, w: 3.9, h: 0.45, fill: { color: stack.color } });
      s24.addText(stack.t, {x: x + 0.15, y: y + 0.1, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s24.addText(stack.sub, {x: x + 2.8, y: y + 0.1, w: 1.0, align: 'right', fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
      
      s24.addText(stack.amt, {x: x + 0.15, y: y + 0.55, fontSize: 10, bold: true, color: stack.color, fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s24.addText(stack.desc, {x: x + 0.15, y: y + 0.85, w: 3.6, fontSize: 9, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
    });

    s24.addShape('rect', { x: 0.5, y: 6.2, w: 12.3, h: 0.6, fill: { color: COLOR_DARK } });
    s24.addText('TOTAL ESTIMATED STACK COST: ₹12,000–18,000/month · ROI: Retention alone recovers 3–4x this cost in saved ad spend', { x: 0.7, y: 6.35, w: 11.9, fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY });

    // SLIDE 25: The Gaps They Left (Dark Theme)
    let s25 = pptx.addSlide();
    addDarkHeader(s25, 'Competitive Advantage', 'THE GAPS THEY LEFT. WE TAKE THEM ALL.');
    
    const gaps = [
      { t: 'WhatsApp Automation', d: `THEM: ${comp1} = manual · ${comp2} = broadcast only\\nUS: automated flows — 8 touchpoints from Day 1\\nRecover 30–40% of abandoned carts competitors lose forever`, c: COLOR_GREEN },
      { t: 'Email Marketing', d: `THEM: Neither ${comp1} nor ${comp2} runs email nurture\\nUS: Klaviyo 5-email welcome flow + lifecycle sequences\\nZero competition in inbox = 25–30% open rate from Day 1`, c: COLOR_PRIMARY },
      { t: 'YouTube Strategy', d: `THEM: No competitor owns YouTube SEO\\nUS: 2 videos/month — size guide, feature demos, founder story\\nCompound organic traffic — competitor presence is extremely low`, c: COLOR_RED },
      { t: 'Google Shopping', d: `THEM: ${comp2} runs Shopping. ${comp1} does NOT.\\nUS: All SKUs with SEO-optimised titles from Day 1\\nCapture purchase-intent searches competitors ignore completely`, c: COLOR_AMBER },
      { t: 'Premium Offer Design', d: 'THEM: Both brands = discount-dependent. Codes everywhere.\\nUS: Gift-first strategy — gifts, bundle upsells, early access.\\nHigher AOV, better margins, loyal customers who pay full price', c: COLOR_PURPLE },
      { t: 'Brand Origin Story', d: isFitness
        ? `THEM: No competitor owns the 'engineered for India' narrative\\nUS: Every ad, page, and post leads with Indian body fit identity\\nEmotional moat — once owned, impossible for others to steal`
        : `THEM: No competitor owns the local founder story\\nUS: Every ad, page, and post leads with localized brand values\\nEmotional moat — once owned, impossible for others to steal`, c: COLOR_PRIMARY }
    ];

    gaps.forEach((gap, i) => {
      let x = 0.5 + (i % 3) * 4.25;
      let y = 1.1 + Math.floor(i / 3) * 2.8;
      s25.addShape('rect', { x: 0.5 + (i % 3) * 4.25, y: 1.1 + Math.floor(i / 3) * 2.8, w: 3.9, h: 2.5, fill: { color: COLOR_DARK2 }, rectRadius: 0.1, line: { color: gap.c, width: 2 } });
      s25.addText(gap.t, {x: x + 0.15, y: y + 0.2, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s25.addText(gap.d, {x: x + 0.15, y: y + 0.7, w: 3.6, fontSize: 10, lineSpacing: 18, color: 'CCCCCC', fontFace: FONT_PRIMARY, h: 0.35});
    });

    // SLIDE 26: Creative Strategy (Light Theme)
    let s26 = pptx.addSlide();
    addHeader(s26, 'Creative Strategy', 'Creative Production Plan — What We Make, Why, and For Whom');
    
    // Left 5 Angles
    s26.addShape('rect', { x: 0.5, y: 1.1, w: 5.9, h: 5.6, fill: { color: 'FFFFFF' }, rectRadius: 0.1 });
    s26.addShape('rect', { x: 0.5, y: 1.1, w: 5.9, h: 0.5, fill: { color: COLOR_DARK } });
    s26.addText('5 CORE AD ANGLES — 10 CREATIVES/MONTH', {x: 0.7, y: 1.25, fontSize: 11, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
    
    let creativeAnglesText = '';
    if (isFitness) {
      creativeAnglesText = `01. THE PERFORMANCE PROOF (Reel · 15s)\\n"Anti-rip test. 100kg deadlift. Watch what happens."\\n\\n02. THE INDIAN BODY STORY (Reel · 30s)\\n"International brands size you down. We size you right."\\n\\n03. THE DARK AESTHETIC DROP (Video · 6s)\\n"New drop. No captions needed."\\n\\n04. THE SOCIAL PROOF WALL (Static Carousel)\\n"47 people bought this today. Here's why."\\n\\n05. THE OFFER REVEAL (Static Image)\\n"Free Shaker when you spend ₹1,499. Today only."`;
    } else {
      creativeAnglesText = `01. THE PERFORMANCE PROOF (Reel · 15s)\\n"Demonstrate product efficacy and premium ingredients/materials."\\n\\n02. THE VALUE / PROBLEM STORY (Reel · 30s)\\n"Showcase the core problem Mr./Ms. ${fName || 'Founder'} set out to solve for India."\\n\\n03. THE AESTHETIC DROP (Video · 6s)\\n"Visual-first showcase of the product and its packaging."\\n\\n04. THE SOCIAL PROOF WALL (Static Carousel)\\n"Real user reviews, testimonials, and rating highlights."\\n\\n05. THE OFFER REVEAL (Static Image)\\n"${primaryOffer || 'Exclusive gift with purchase reveal.'}"`;
    }
    s26.addText(creativeAnglesText, { x: 0.7, y: 1.8, w: 5.5, fontSize: 10.5, lineSpacing: 18, color: COLOR_DARK, fontFace: FONT_PRIMARY });

    // Right Production Schedule
    s26.addShape('rect', { x: 6.9, y: 1.1, w: 5.9, h: 5.6, fill: { color: 'FFFFFF' }, rectRadius: 0.1 });
    s26.addShape('rect', { x: 6.9, y: 1.1, w: 5.9, h: 0.5, fill: { color: COLOR_PRIMARY } });
    s26.addText('MONTHLY PRODUCTION SCHEDULE', {x: 7.1, y: 1.25, fontSize: 11, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 5.70, h: 0.35});
    
    const week2AdsText = isFitness
      ? `· 1x Founder story Reel (Indian body fit narrative)\\n· 1x YouTube video (size guide or feature deep-dive)\\n· 1x BOFU offer static (Free Shaker reveal)`
      : `· 1x Founder story Reel (Brand origin and mission)\\n· 1x YouTube video (product comparison or feature deep-dive)\\n· 1x BOFU offer static (${primaryOffer || 'Free Gift'} reveal)`;
    s26.addText('WEEK 1\\n· 2x Performance Proof Reels (efficacy / tech tests)\\n· 2x Aesthetic statics (new product angle)\\n· 1x Social Proof carousel (UGC compilation)\\n\\nWEEK 2\\n' + week2AdsText + '\\n\\nWEEK 3\\n· 2x Influencer UGC cuts (from micro-creator deliverables)\\n· 1x Shopping search image (clean product on dark BG)\\n· 1x A/B test variant of best Week 1 creative\\n\\nWEEK 4\\n· 1x New drop teaser Reel (6-sec dark identity)\\n· Review + retire bottom performer — replace with winner', {x: 7.1, y: 1.7, w: 5.5, fontSize: 10, lineSpacing: 16, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});

    // SLIDE 27: Campaign Calendar (Light Theme)
    let s27 = pptx.addSlide();
    addHeader(s27, 'Campaign Calendar', 'Special Days — Apr to Jun 2026');
    
    let campaignCalendarCols = [];
    if (isFitness) {
      campaignCalendarCols = [
        { m: 'APRIL 2026', c: `Apr 7 ★ KEY\\nWorld Health Day\\nFitness = Health. ${bName} stands for it.\\n\\nApr 14 ★ KEY\\nTamil New Year / Vishu\\nHome market moment. Coimbatore roots.\\n\\nApr 22\\nEarth Day\\n95% Cotton story. Sustainable fabric.\\n\\nApr 3\\nGood Friday\\nLong weekend — gym shopping spike.`, color: COLOR_RED },
        { m: 'MAY 2026', c: `May 1\\nLabour Day\\nGrind culture. "You earn this" messaging.\\n\\nMay 10 ★ KEY\\nMother's Day\\nWomen's line push. Leggings + Sports Bras.\\n\\nMay 23\\nBuddha Purnima\\nDiscipline & focus. Mindset content angle.\\n\\nMay 27\\nBakri Eid\\nFestive buying mood. Gifting campaign.`, color: COLOR_PURPLE },
        { m: 'JUNE 2026', c: `Jun 15 ★ KEY\\nFather's Day\\nGifting campaign. Joggers, Tanks, Muscle Fit.\\n\\nJun 21 ★ KEY\\nInternational Yoga Day\\nBiggest fitness day in India. Max paid push.\\n\\nJun 21\\nWorld Music Day\\nWorkout playlist angle. Reel content hook.\\n\\nJun 17\\nIslamic New Year\\nInclusive content. Wide audience reach.`, color: COLOR_GREEN }
      ];
    } else {
      campaignCalendarCols = [
        { m: 'APRIL 2026', c: `Apr 7 ★ KEY\\nWorld Health Day\\nHealth and wellness focus related to ${indName || 'D2C'}.\\n\\nApr 14 ★ KEY\\nTamil New Year / Vishu\\nSpring season buying season. Regional campaigns.\\n\\nApr 22\\nEarth Day\\nHighlight eco-friendly packaging and ethics.\\n\\nApr 3\\nGood Friday\\nLong weekend shopping spike — boost retention.`, color: COLOR_RED },
        { m: 'MAY 2026', c: `May 1\\nLabour Day\\nCampaign theme: "Reward your hard work".\\n\\nMay 10 ★ KEY\\nMother's Day\\nGifting campaign targeting women. Special gift boxes.\\n\\nMay 23\\nBuddha Purnima\\nContent angle: clarity, simplicity, purity.\\n\\nMay 27\\nBakri Eid\\nFestive gifting season — run targeted WhatsApp alerts.`, color: COLOR_PURPLE },
        { m: 'JUNE 2026', c: `Jun 15 ★ KEY\\nFather's Day\\nMen's gifting segment push. Bundle offers.\\n\\nJun 21 ★ KEY\\nSummer Solstice Sale\\nMid-year peak shopping days. High paid ads bid.\\n\\nJun 21\\nWorld Music Day\\nCurated audio track and Reels lifestyle trend.\\n\\nJun 17\\nIslamic New Year\\nFestive greeting and early-access drop alerts.`, color: COLOR_GREEN }
      ];
    }

    campaignCalendarCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s27.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 5.0, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s27.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 0.5, fill: { color: col.color } });
      s27.addText(col.m, {x: x + 0.15, y: 1.15, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});

      s27.addText(col.c, {x: x + 0.2, y: 1.7, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
    });

    s27.addShape('rect', { x: 0.5, y: 6.2, w: 12.3, h: 0.6, fill: { color: COLOR_DARK } });
    s27.addText("★ Priority: World Health Day · Tamil New Year · Mother's Day · Father's Day · Yoga/Solstice Day — plan campaigns 2 weeks in advance", {x: 0.7, y: 6.35, w: 11.9, fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

    // SLIDE 28: Brand Ambassadors (Light Theme)
    let s28 = pptx.addSlide();
    addHeader(s28, 'Brand Ambassadors', `${bName} Creator Program — Building the Cult Creator Army`);
    s28.addShape('rect', { x: 0.5, y: 1.1, w: 12.3, h: 0.5, fill: { color: COLOR_DARK } });
    s28.addText(`TARGET: 50+ creators wearing and tagging ${bName} by Month 6. Every serious creator in our space has worn and reviewed us.`, { x: 0.7, y: 1.25, w: 11.9, fontSize: 10, bold: true, color: COLOR_AMBER, fontFace: FONT_PRIMARY });

    const ambCols = [
      { t: 'PHASE 1 — MONTH 1', sub: '15 Micro-Creators', c: '· 10K–50K followers, active creators.\\n· High aesthetic required — clean styling.\\n· Deliverable: 1 Reel + 2 Stories + 1 Static.\\n· Usage rights: 90 days for paid ads.\\n· Budget: ₹3,000–4,000 per creator.\\n· Track: engagement rate, saves, DM volume.', color: COLOR_PRIMARY },
      { t: 'PHASE 2 — MONTH 2', sub: '10 More Micro + 1 Macro', c: '· 10 additional micro-creators.\\n· 1 macro-creator 100K–500K.\\n· A/B test: scripted vs unboxing format.\\n· Repurpose top 3 UGCs as paid Meta ads.\\n· Brief: Bold, authentic. NO influencer codes.\\n· Track: which UGC format drives highest ROAS.', color: COLOR_GREEN },
      { t: 'PHASE 3 — MONTH 3+', sub: '3 Brand Ambassadors', c: '· Select top 3 performers from Phase 1+2.\\n· Long-term: 3 months minimum commitment.\\n· Early access to new product drops.\\n· Exclusive ambassador-only WhatsApp group.\\n· Co-created content for YouTube long-form.\\n· Community: Brand Ambassador identity badge.', color: COLOR_AMBER }
    ];

    ambCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s28.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.85, w: 3.9, h: 4.8, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s28.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.85, w: 3.9, h: 0.8, fill: { color: col.color } });
      s28.addText(col.t, {x: x + 0.15, y: 1.9, w: 3.6, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
      s28.addText(col.sub, {x: x + 0.15, y: 2.25, w: 3.6, fontSize: 10, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

      s28.addText(col.c, {x: x + 0.2, y: 2.8, w: 3.5, fontSize: 10.5, lineSpacing: 18, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
    });

    // SLIDE 29: AI Content Pillars (Light Theme)
    let s29 = pptx.addSlide();
    addHeader(s29, 'AI Content Pillars', '8 AI-Generated Pillars — Content Marketing Blueprint');
    const pillars = d.pillars || [];
    pillars.slice(0, 8).forEach((p, idx) => {
      let x = 0.5 + (idx % 4) * 3.1;
      let y = 1.1 + Math.floor(idx / 4) * 2.8;
      s29.addShape('rect', { x, y, w: 2.9, h: 2.5, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_PRIMARY, width: 2 } });
      s29.addText(p.title || `Pillar ${idx + 1}`, { x: x + 0.15, y: y + 0.15, fontSize: 11, bold: true, color: COLOR_PRIMARY, fontFace: FONT_PRIMARY, w: 2.6, h: 0.35 });
      s29.addText(p.description || '', { x: x + 0.15, y: y + 0.6, fontSize: 9.5, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 2.6, h: 1.7 });
    });

    // SLIDE 30: AI Sales Angles (Light Theme)
    let s30 = pptx.addSlide();
    addHeader(s30, 'AI Sales Angles', '6 AI-Generated Sales Angles — Creative Conversion Angles');
    const angles = d.angles || [];
    angles.slice(0, 6).forEach((a, idx) => {
      let x = 0.5 + (idx % 3) * 4.25;
      let y = 1.1 + Math.floor(idx / 3) * 2.8;
      s30.addShape('rect', { x, y, w: 3.9, h: 2.5, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_AMBER, width: 2 } });
      s30.addText(a.headline || `Angle ${idx + 1}`, { x: x + 0.2, y: y + 0.15, fontSize: 11, bold: true, color: COLOR_AMBER, fontFace: FONT_PRIMARY, w: 3.5, h: 0.35 });
      s30.addText(a.body || '', { x: x + 0.2, y: y + 0.6, fontSize: 9.5, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 3.5, h: 1.4 });
      s30.addText(`CTA: ${a.cta || 'Shop Now'}`, { x: x + 0.2, y: y + 2.0, fontSize: 9, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 3.5, h: 0.3 });
    });

    // 3. Trigger Download
    await pptx.writeFile({ fileName: require('path').join(__dirname, 'strategy_test_nirvana.pptx') });
    
    document.getElementById('gen-status').textContent = 'Presentation Generated!';
    document.getElementById('gen-done').style.display = '';

  } catch (err) {
    console.error(err);
    document.getElementById('gen-error').textContent = '⚠ ' + err.message;
    document.getElementById('gen-error').style.display = '';
    document.getElementById('gen-status').textContent = 'Generation Failed';
  }
}

genPPTX().then(() => {
  console.log("PPTX Generation complete!");
  process.exit(0);
}).catch(err => {
  console.error("PPTX Generation failed:", err);
  process.exit(1);
});
