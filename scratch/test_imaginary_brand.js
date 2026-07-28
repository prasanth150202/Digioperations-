const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

// Mock data for Nirvana Brews (imaginary Premium Coffee brand)
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
  ch_b1: '₹1,20,000', ch_g1: 'Targeting high-intent coffee search queries',
  ch_b2: '₹80,000', ch_g2: 'Recipe videos & lifestyle bumper ads',
  ch_b3: '₹50,000', ch_g3: 'Coffee creators unboxing & taste reviews',
  ch_b4: '₹30,000', ch_g4: 'Subscription retention and drop alerts',
  ch_b5: '₹20,000', ch_g5: 'Organic ranking on coffee brewing guides'
};

// Mock AI output response
const mockAiResponse = {
  pillars: [
    { title: 'The Chikmagalur Estate Origin', description: 'Showcasing the journey from cherry to cup on our estate.' },
    { title: 'Home Brewing Masterclass', description: 'Quick guides to making barista-quality French Press & Pour Over.' },
    { title: 'The Science of Roast', description: 'Educational content on light, medium, and dark roast flavors.' },
    { title: 'Coffee & Productivity hacks', description: 'How to optimize caffeine intake for sustained focus.' },
    { title: 'Sustainable Coffee Farming', description: 'Highlighting our zero-plastic packaging and fair wages.' },
    { title: ' Barista Tasting Notes', description: 'Guiding customers through detecting chocolate, citrus, and berry notes.' },
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

// Implement Slide Generation in Node.js
async function runTestGeneration() {
  console.log("Generating PPTX for Nirvana Brews...");
  
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

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

  const bName = stratForm['brandName'] || activeBrand.name;
  const indName = stratForm['industry'] || activeBrand.industry || 'D2C';
  const platName = stratForm['platform'] || activeBrand.platform || 'Shopify';
  const AM = stratForm['accountManager'] || 'Digifyce Team';
  const mTarget = stratForm['thisTarget'] || '₹30L';
  const mRev = stratForm['lastRevenue'] || '₹2L';
  const mGrowth = stratForm['kt_roas'] || '15x';
  const mMonth = stratForm['strategyMonth'] || 'May 2026';
  const fName = stratForm['founderName'] || 'Founder';

  const isFitness = indName.toLowerCase().includes('fit') || indName.toLowerCase().includes('gym') || indName.toLowerCase().includes('active') || indName.toLowerCase().includes('apparel') || indName.toLowerCase().includes('cloth') || indName.toLowerCase().includes('wear') || indName.toLowerCase().includes('sport');

  const comp1 = isFitness ? 'Fuaark' : 'Mass Competitor';
  const comp2 = isFitness ? 'GymX' : 'Premium Competitor';
  const comp3 = isFitness ? 'Gymshark' : 'Global Benchmark';
  const ourBuild = bName.toUpperCase() + ' BUILD';
  const primaryOffer = stratForm['primaryOffer'] || '';

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
  s1.addText('POWERED BY\nDIGIFYCE', {x: 0.4, y: 0.5, fontSize: 22, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
  s1.addShape('rect', { x: 0.4, y: 1.8, w: 3.0, h: 1.4, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_AMBER, width: 2 } });
  s1.addText(mRev, {x: 0.5, y: 1.9, fontSize: 28, bold: true, color: COLOR_PRIMARY, fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
  s1.addText('Current Monthly Revenue', {x: 0.5, y: 2.6, fontSize: 11, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
  s1.addShape('rect', { x: 0.4, y: 3.4, w: 3.0, h: 1.4, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_AMBER, width: 2 } });
  s1.addText(mTarget, {x: 0.5, y: 3.5, fontSize: 28, bold: true, color: COLOR_PRIMARY, fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
  s1.addText('90-Day Target Plan', {x: 0.5, y: 4.2, fontSize: 11, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
  s1.addShape('rect', { x: 0.4, y: 5.0, w: 3.0, h: 1.4, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_GREEN, width: 2 } });
  s1.addText(mGrowth, {x: 0.5, y: 5.1, fontSize: 28, bold: true, color: COLOR_GREEN, fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
  s1.addText('Projected Blended Growth', {x: 0.5, y: 5.8, fontSize: 11, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
  s1.addText('SHOPIFY SCALE STRATEGY', {x: 4.3, y: 1.5, fontSize: 16, bold: true, color: COLOR_PRIMARY, fontFace: FONT_PRIMARY, w: 8.50, h: 0.35});
  s1.addText(bName.toUpperCase(), {x: 4.3, y: 1.9, fontSize: 44, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 8.50, h: 0.35});
  s1.addText(`${indName} · Pan India D2C · ${platName}`, {x: 4.3, y: 3.4, fontSize: 14, italic: true, color: '888888', fontFace: FONT_PRIMARY, w: 8.50, h: 0.35});
  s1.addText(`90-Day Plan: From ${mRev} to ${mTarget} Monthly Revenue`, {x: 4.3, y: 4.1, fontSize: 20, bold: true, color: COLOR_AMBER, fontFace: FONT_PRIMARY, w: 8.50, h: 0.35});
  s1.addText(`Prepared exclusively by Digifyce | Confidential | ${mMonth}`, {x: 4.3, y: 4.9, fontSize: 12, color: 'CCCCCC', fontFace: FONT_PRIMARY, w: 8.50, h: 0.35});
  s1.addShape('rect', { x: 4.3, y: 5.8, w: 8.5, h: 0.9, fill: { color: COLOR_DARK2 }, rectRadius: 0.05 });
  s1.addText('Framework Tags: Brand · Funnel · Meta · Google · Influencer · Social · CRM · CRO · Roadmap', {x: 4.5, y: 6.1, w: 8.1, fontSize: 10, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

  // SLIDE 2: Brand Foundation (Light Theme)
  let s2 = pptx.addSlide();
  addHeader(s2, 'Brand Foundation', 'Brand Story & Strategic Foundation');
  s2.addShape('rect', { x: 0.5, y: 1.2, w: 5.8, h: 5.6, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_PRIMARY, width: 2 } });
  s2.addShape('rect', { x: 0.5, y: 1.2, w: 5.8, h: 0.6, fill: { color: COLOR_DARK } });
  s2.addText('THE ORIGIN STORY', {x: 0.7, y: 1.35, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
  const storyTitle = isFitness ? 'Born in Coimbatore. Built for India.' : `Born in India. Built for Scale.`;
  const storyBody = isFitness
    ? `Mr. ${fName} quit a high-paying corporate job to solve one overlooked problem: international sizing and products are not engineered for Indian body proportions.\n\nOur products are purpose-built for Indian proportions, chest widths, and thigh circumferences — so every workout feels right.`
    : `Mr./Ms. ${fName} started ${bName} to solve one overlooked problem: legacy offerings in the ${indName} space are not engineered for modern Indian consumers.\n\nOur products are purpose-built to deliver premium quality, tailored specifically for local preferences.`;
  s2.addText(storyTitle, {x: 0.7, y: 2.1, fontSize: 20, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
  s2.addText(storyBody, { x: 0.7, y: 2.7, w: 5.4, fontSize: 12, color: '333333', fontFace: FONT_PRIMARY });
  s2.addShape('rect', { x: 0.7, y: 4.6, w: 5.4, h: 0.9, fill: { color: COLOR_PRIMARY }, rectRadius: 0.05 });
  s2.addText(`${mRev} → ${mTarget} in 90 Days\nTarget Monthly Scale Up`, {x: 0.8, y: 4.75, w: 5.2, align: 'center', fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

  const usps = [
    { t: stratForm.usp_head_1, d: stratForm.usp_detail_1, c: COLOR_PRIMARY },
    { t: stratForm.usp_head_2, d: stratForm.usp_detail_2, c: COLOR_AMBER },
    { t: stratForm.usp_head_3, d: stratForm.usp_detail_3, c: COLOR_RED },
    { t: stratForm.usp_head_4, d: stratForm.usp_detail_4, c: COLOR_PURPLE },
    { t: stratForm.usp_head_5, d: stratForm.usp_detail_5, c: COLOR_GREEN }
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
  const visionQuote = isFitness
    ? `"Build the Gymshark of India — where every serious lifter wears ${bName} not because of an ad, but because everyone at the gym already does."`
    : `"Build the leading ${indName} brand in India — where every consumer chooses ${bName} not because of an ad, but because of our quality and trust."`;
  s3.addText(visionQuote, { x: 0.5, y: 1.8, w: 12.3, fontSize: 13, color: COLOR_AMBER, italic: true, fontFace: FONT_PRIMARY });

  // SLIDE 4: Buyer Personas (Light Theme)
  let s4 = pptx.addSlide();
  addHeader(s4, 'Buyer Personas', "3 Core Customer Profiles — Who We're Selling To");
  const pNames = [stratForm.pname0, stratForm.pname1, stratForm.pname2];
  const pAges = [stratForm.page0, stratForm.page1, stratForm.page2];
  const pIncomes = [stratForm.pincome0, stratForm.pincome1, stratForm.pincome2];
  const pPains = [stratForm.ppain0, stratForm.ppain1, stratForm.ppain2];
  
  for (let i = 0; i < 3; i++) {
    let x = 0.5 + (i * 4.25);
    s4.addShape('rect', { x, y: 1.1, w: 3.9, h: 5.7, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_PRIMARY, width: 2 } });
    s4.addText(pNames[i], {x: x + 0.1, y: 1.2, w: 3.7, align: 'center', fontSize: 13, bold: true, color: COLOR_PRIMARY, fontFace: FONT_PRIMARY, h: 0.35});
    s4.addText('Age: ' + pAges[i] + ' | Income: ' + pIncomes[i], {x: x + 0.2, y: 1.8, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
    s4.addText(pPains[i], {x: x + 0.2, y: 2.7, w: 3.5, fontSize: 11, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
  }

  // SLIDE 27: Campaign Calendar
  let s27 = pptx.addSlide();
  addHeader(s27, 'Campaign Calendar', 'Special Days — Apr to Jun 2026');
  
  let campaignCalendarCols = [];
  if (isFitness) {
    campaignCalendarCols = [
      { m: 'APRIL 2026', c: `Apr 7 ★ KEY\nWorld Health Day\nFitness = Health. ${bName} stands for it.`, color: COLOR_RED },
      { m: 'MAY 2026', c: 'May 1\nLabour Day\nGrind culture. "You earn this" messaging.', color: COLOR_PURPLE },
      { m: 'JUNE 2026', c: `Jun 15 ★ KEY\nFather's Day\nGifting campaign. Joggers, Tanks, Muscle Fit.`, color: COLOR_GREEN }
    ];
  } else {
    campaignCalendarCols = [
      { m: 'APRIL 2026', c: `Apr 7 ★ KEY\nWorld Health Day\nHealth and wellness focus related to ${indName}.`, color: COLOR_RED },
      { m: 'MAY 2026', c: 'May 1\nLabour Day\nCampaign theme: "Reward your hard work".', color: COLOR_PURPLE },
      { m: 'JUNE 2026', c: `Jun 15 ★ KEY\nFather's Day\nMen's gifting segment push. Bundle offers.`, color: COLOR_GREEN }
    ];
  }

  campaignCalendarCols.forEach((col, i) => {
    let x = 0.5 + (i * 4.25);
    s27.addShape('rect', { x, y: 1.1, w: 3.9, h: 5.0, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
    s27.addText(col.m, {x: x + 0.15, y: 1.15, fontSize: 13, bold: true, color: col.color, fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
    s27.addText(col.c, {x: x + 0.2, y: 1.7, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
  });

  // SLIDE 29 & 30: AI content pillars and sales angles
  let s29 = pptx.addSlide();
  addHeader(s29, 'AI Content Pillars', '8 AI-Generated Pillars — Content Marketing Blueprint');
  mockAiResponse.pillars.forEach((p, idx) => {
    let x = 0.5 + (idx % 4) * 3.1;
    let y = 1.1 + Math.floor(idx / 4) * 2.8;
    s29.addShape('rect', { x, y, w: 2.9, h: 2.5, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_PRIMARY, width: 2 } });
    s29.addText(p.title, { x: x + 0.15, y: y + 0.15, fontSize: 11, bold: true, color: COLOR_PRIMARY, fontFace: FONT_PRIMARY, w: 2.6, h: 0.35 });
    s29.addText(p.description, { x: x + 0.15, y: y + 0.6, fontSize: 9.5, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 2.6, h: 1.7 });
  });

  // Save presentation
  const destPath = path.join(__dirname, 'strategy_test_nirvana.pptx');
  await pptx.writeFile({ fileName: destPath });
  console.log("SUCCESS: Saved strategy PPTX file to " + destPath);
}

runTestGeneration().catch(err => {
  console.error("Error in generation test:", err);
  process.exit(1);
});
