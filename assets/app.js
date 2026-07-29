'use strict';

// ─── NAV CONFIG ─────────────────────────────────────────────────────────────
const NAV = [
  { group:'Workspace', items:[
    { id:'dashboard', label:'Dashboard',         icon:'⬡', sub:'Overview & quick access' },
  ]},
  { group:'Tools', items:[
    { id:'strategy',  label:'Strategy Builder',  icon:'🧠', sub:'AI-powered strategy docs' },
    { id:'consultant',label:'AI Consultant',     icon:'👔', sub:'Next-Gen Brand Intelligence' },
    { id:'poa',       label:'Media Buyer POA',   icon:'📋', sub:'Multi-brand POA & workspace' },
    { id:'pricing',   label:'Pricing Calculator',icon:'💰', sub:'Margin & price analysis'  },
    { id:'catalog',   label:'Price Catalog',     icon:'📋', sub:'Searchable price lookup'  },
    { id:'budget',    label:'Budget Tracker',    icon:'📊', sub:'Monthly performance & ROAS'},
    { id:'reports',   label:'Weekly Report Generator', icon:'📄', sub:'Weekly summaries' },
    { id:'monthly_reports', label:'Monthly Report Generator', icon:'📊', sub:'Widescreen monthly summaries' },
  ]},
  { group:'Admin', adminOnly:true, items:[
    { id:'admin',     label:'User Management',   icon:'👥', sub:'Users & permissions'      },
    { id:'activity',  label:'Activity Logs',     icon:'📜', sub:'Team operations timeline' },
  ]},
];

const TOOL_BG = {
  strategy:'var(--blueg)',
  pricing:'rgba(16,185,129,.1)',
  admin:'rgba(245,158,11,.1)',
  budget:'rgba(43,78,255,.1)',
};

const STRATEGY_STEPS = [
  {id:'brand',      label:'Brand Overview',   sub:'Identity, KPIs & targets',     phase:0,ai:false},
  {id:'budget_ch',  label:'Channel Budget',   sub:'Budget by channel',            phase:0,ai:false},
  {id:'budget_prod',label:'Product Budget',   sub:'Budget by product',            phase:0,ai:false},
  {id:'usps',       label:'Brand USPs',       sub:'5 USPs — saved to memory',     phase:0,ai:false},
  {id:'theme',      label:'Monthly Theme',    sub:'Headline, offers & direction', phase:1,ai:false},
  {id:'special',    label:'Special Days',     sub:'Campaign events',              phase:1,ai:false},
  {id:'personas',   label:'Buyer Personas',   sub:'3 segments — saved to memory', phase:1,ai:false},
  {id:'competitors',label:'Competitors',      sub:'Ads, pricing & tech',          phase:1,ai:false},
  {id:'influencers',label:'Influencer List',  sub:'Handles & deliverables',       phase:2,ai:false},
  {id:'pillars',    label:'Content Pillars',  sub:'AI-generated',                 phase:2,ai:true},
  {id:'sales',      label:'Sales Angles',     sub:'AI-generated',                 phase:2,ai:true},
  {id:'ads',        label:'Ads Setup',        sub:'Meta & Google budgets',        phase:3,ai:false},
  {id:'retention',  label:'Retention',        sub:'Email & WhatsApp weekly',      phase:3,ai:false},
  {id:'kpis',       label:'KPIs',             sub:'Current values & targets',     phase:3,ai:false},
];
const PHASES = ['Setup','Strategy','Creative','Execution'];

const CLEAN_PRICES = [99,149,199,249,299,349,399,449,499,549,599,649,699,749,799,849,899,949,
  999,1099,1199,1299,1399,1499,1599,1699,1799,1899,1999,2199,2499,2999,3499,3999,4499,4999];

// ─── STATE ───────────────────────────────────────────────────────────────────
let CU = null;           // current user
let allBrands = [];      // all brands from API
let activeBrand = null;  // selected brand object
let curPage = 'dashboard';

// Strategy state
let stratStep = 0, stratForm = {}, stratDone = new Set(), stratSaveTimer = null;

// Pricing state
let prods = [], pricingSaveTimer = null, globalsOpen = false, globalExtras = [];
let pricingViewMode = 'adv';
let catalogProds = [], catalogActiveBrand = null;

// ─── API HELPER ──────────────────────────────────────────────────────────────
async function api(methodOrUrl, urlOrBody, body) {
  let method, url;
  const HTTP = ['GET','POST','PUT','DELETE','PATCH'];
  if (HTTP.includes(methodOrUrl)) { method = methodOrUrl; url = urlOrBody; }
  else { url = methodOrUrl; method = urlOrBody || 'GET'; }
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const baseUrl = window.APP_URL ? window.APP_URL.replace(/\/$/, '') : '';
  const cleanUrl = url.replace(/^\//, '');
  const finalUrl = baseUrl ? (baseUrl + '/' + cleanUrl) : cleanUrl;
  const r = await fetch(finalUrl, opts);
  if (r.status === 401) { window.location.href = './'; return null; }
  if (!r.ok) { 
    const t = await r.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(t.error || 'Request failed');
  }
  let text = '';
  try {
    text = await r.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch (err) {
    console.error('JSON Parse Error. Raw response:', text);
    throw new Error('Server returned invalid data format. Check console for details.');
  }
}

// ─── INIT ────────────────────────────────────────────────────────────────────
(async function init() {
  const me = await api('api/auth/me');
  if (!me || !me.user) { window.location.href = './'; return; }
  CU = me.user;
  window.currentUser = CU;
  window.APP_URL = me.app_url || '';

  document.getElementById('sb-av').textContent = CU.name[0].toUpperCase();
  document.getElementById('sb-uname').textContent = CU.name;
  document.getElementById('sb-urole').textContent = CU.role;

  // Load brands
  const brands = await api('/api/brands');
  if (brands) allBrands = brands;

  renderSidebar();
  renderDashboard();
  const _hashPage = window.location.hash.slice(1);
  const _validPages = ['dashboard','strategy','consultant','pricing','catalog','budget','reports','monthly_reports','admin','activity'];
  showPage(_validPages.includes(_hashPage) ? _hashPage : 'dashboard');

  // Show add product / new brand buttons for editors
  if (CU.role !== 'user') {
    const ap = document.getElementById('add-prod-btn');
    const nb = document.getElementById('new-brand-btn');
    const nb2 = document.getElementById('mo-new-brand-btn');
    const bsc = document.getElementById('btn-sync-shopify-catalog');
    if (ap) ap.style.display = '';
    if (nb) nb.style.display = '';
    if (nb2) nb2.style.display = '';
    if (bsc) bsc.style.display = '';
  }

  // Load settings if superadmin
  if (CU.role === 'superadmin') loadSettings();

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.style.display = 'none'; });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
  });

  window.addEventListener('resize', () => {
    if (curPage === 'budget' && bgtState.currentMonthData && document.getElementById('bgt-month-view').style.display !== 'none') {
      renderBgtChart(bgtState.currentMonthData);
    }
  });
})();

// ─── AUTH ────────────────────────────────────────────────────────────────────
async function doLogout() {
  await api('api/auth/logout', 'POST');
  window.location.href = './';
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
function showPage(id) {
  if ((id === 'admin' || id === 'activity') && CU.role !== 'superadmin') {
    id = 'dashboard';
  }
  curPage = id;
  history.replaceState(null, '', '#' + id);
  // Close sidebar on mobile after clicking
  document.querySelector('.sb')?.classList.remove('open');
  
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const pg = document.getElementById('page-' + id);
  if (pg) { pg.classList.remove('hidden'); pg.style.animation = 'none'; void pg.offsetWidth; pg.style.animation = 'fadeUp .3s ease'; }
  document.querySelectorAll('.sb-item').forEach(i => i.classList.toggle('active', i.dataset.page === id));
  const labels = { 
    dashboard: 'Dashboard', 
    strategy: 'Strategy Builder', 
    consultant: 'AI Consultant',
    poa: 'Media Buyer POA',
    pricing: 'Pricing Calculator', 
    catalog: 'Price Catalog', 
    budget: 'Budget Tracker', 
    reports: 'Weekly Report Generator',
    monthly_reports: 'Monthly Report Generator',
    admin: 'User Management',
    activity: 'Activity Logs'
  };
  document.getElementById('tb-page-name').textContent = labels[id] || id;
  updateTopbarRight();
  if (id === 'strategy') initStrategyPage();
  if (id === 'consultant') initConsultantPage();
  if (id === 'poa')        initPoaPage();
  if (id === 'pricing')  { renderPricingBrands(); backToBrands(); }
  if (id === 'catalog')  { renderCatalogBrands(); backToCatalogBrands(); }
  if (id === 'admin')    renderAdmin();
  if (id === 'budget')   initBudget();
  if (id === 'reports')  initReportsPage();
  if (id === 'monthly_reports') initMonthlyReportsPage();
  if (id === 'activity') initActivityPage();
}

function toggleSidebar() {
  document.querySelector('.sb')?.classList.toggle('open');
}

function renderSidebar() {
  let html = '';
  NAV.forEach(g => {
    if (g.adminOnly && CU.role !== 'superadmin') return;
    const items = g.items.filter(i => {
      if (CU.role === 'superadmin') return true;
      if (i.id === 'poa') return true;
      const pages = Array.isArray(CU.pages) ? CU.pages : [];
      if (i.id === 'catalog' && pages.includes('pricing')) return true;
      if (i.id === 'consultant' && pages.includes('strategy')) return true;
      return pages.includes(i.id);
    });
    if (!items.length) return;
    html += `<div class="sb-group-label">${g.group}</div>`;
    items.forEach(i => {
      html += `<div class="sb-item${curPage===i.id?' active':''}" data-page="${i.id}" onclick="showPage('${i.id}')">
        <div class="sb-item-icon">${i.icon}</div>
        <div class="sb-item-text"><div class="sb-item-label">${i.label}</div><div class="sb-item-sub">${i.sub}</div></div>
      </div>`;
    });
  });
  document.getElementById('sb-nav').innerHTML = html;
}

function updateTopbarRight() {
  const el = document.getElementById('tb-right');
  if (curPage === 'strategy' && activeBrand && CU.role !== 'user') {
    el.innerHTML = `<button class="btn amr" onclick="bgtOpenHistory()">📜 History</button>
                    <button class="btn amr" onclick="genPPTX()">✦ Generate PPTX</button>`;
  } else {
    el.innerHTML = '';
  }
}

function updateBrandUI() {
  const chip = document.getElementById('tb-brand-chip');
  const dot  = document.getElementById('sb-dot');
  const nm   = document.getElementById('sb-brand-name');
  const em   = document.getElementById('sb-brand-empty');
  if (activeBrand) {
    chip.textContent = '🏷 ' + activeBrand.name; chip.style.display = 'inline-flex';
    dot.classList.add('active');
    nm.textContent = activeBrand.name; nm.style.display = ''; em.style.display = 'none';
  } else {
    chip.style.display = 'none'; dot.classList.remove('active');
    nm.style.display = 'none'; em.style.display = '';
  }
  updateTopbarRight();
}

// ─── BRAND PICKER ────────────────────────────────────────────────────────────
function openBrandPicker() {
  const list = document.getElementById('brand-picker-list');
  list.innerHTML = allBrands.length
    ? allBrands.map(b => `
      <div onclick="selectBrand('${b.id}')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;
        border:1px solid ${activeBrand?.id===b.id?'var(--blue)':'var(--border)'};border-radius:10px;cursor:pointer;
        background:${activeBrand?.id===b.id?'var(--blueg)':'var(--surface,#fff)'};transition:all .15s">
        <div style="width:36px;height:36px;border-radius:9px;background:var(--blueg);display:flex;align-items:center;justify-content:center;font-size:16px">🏷</div>
        <div style="flex:1">
          <div style="font-weight:700;color:var(--dark)">${b.name}</div>
          <div style="font-size:11px;color:var(--mid);margin-top:2px">${b.industry||'—'} · ${b.product_count||0} products</div>
        </div>
        ${activeBrand?.id===b.id?'<span style="color:var(--blue);font-weight:700;font-size:11px">Active</span>':''}
      </div>`).join('')
    : '<div style="text-align:center;padding:20px;color:var(--mid)">No brands available</div>';
  document.getElementById('mo-brand').style.display = 'flex';
}

function selectBrand(id) {
  activeBrand = allBrands.find(b => b.id === id) || null;
  closeMo('mo-brand');
  updateBrandUI();
  renderDashboard();
  if (curPage === 'pricing') loadBrandProducts();
  if (curPage === 'strategy') initStrategyPage();
  if (curPage === 'consultant') initConsultantPage();
  if (curPage === 'poa') {
    _poaSelectedBrands = activeBrand ? [activeBrand.id] : [];
    initPoaPage();
  }
  if (curPage === 'reports') {
    const brandFilter = document.getElementById('reports-filter-brand');
    if (brandFilter) {
      brandFilter.value = id || '';
      filterReportsList();
    }
  }
}

function openMo(id)  { document.getElementById(id).style.display = 'flex'; }
function closeMo(id) { document.getElementById(id).style.display = 'none'; }

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
let dashDataCache = null;

async function fetchDashboardData(month = '') {
  const url = month ? `/api/budget/dashboard?month=${month}` : '/api/budget/dashboard';
  const [bgtRes, auditRes] = await Promise.all([
    api(url),
    CU.role === 'superadmin' ? api('/api/admin/audit?limit=20') : Promise.resolve(null)
  ]);
  dashDataCache = { ...bgtRes, activity: auditRes || [] };
  return dashDataCache;
}

async function loadDashboard(month) {
  window.currentDashMonth = month;
  await renderDashboard();
}

async function renderDashboard() {
  const h = new Date().getHours();
  const greeting = (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ', ' + CU.name.split(' ')[0];
  document.getElementById('dash-greeting').textContent = greeting;
  
  const roleChip = document.getElementById('dash-role-chip');
  roleChip.textContent = CU.role;
  roleChip.className = `role-chip ${CU.role}`;
  roleChip.style.display = 'inline-flex';

  const subEl = document.getElementById('dash-sub');
  subEl.textContent = CU.role === 'superadmin' 
    ? 'Agency Command Center — Overview across all brands' 
    : CU.role === 'manager' 
      ? 'Your assigned brands and today\'s alerts'
      : 'Performance Entry Center — Select a brand below to get started';

  // Setup quick actions
  const qaEl = document.getElementById('dash-quick-actions');
  let qaHtml = '';
  if (CU.role === 'superadmin' || CU.role === 'manager') {
    qaHtml += `<button class="quick-action-btn" onclick="showPage('budget'); bgtOpenNewBrand()">+ New Brand</button>`;
  }
  if (CU.role === 'superadmin') {
    qaHtml += `<button class="quick-action-btn" onclick="showPage('admin')">👥 Add User</button>`;
  }
  qaEl.innerHTML = qaHtml;

  // Load Data
  const data = await fetchDashboardData(window.currentDashMonth || '');
  const brands = data.brands || [];
  
  // Populate Month Filter
  const filterEl = document.getElementById('dash-month-filter');
  if (filterEl && data.availableMonths) {
    let opts = '<option value="">Latest Month (Default)</option>';
    data.availableMonths.forEach(m => {
      const val = `${m.year}-${String(m.month).padStart(2, '0')}`;
      opts += `<option value="${val}" ${window.currentDashMonth === val ? 'selected' : ''}>${m.label}</option>`;
    });
    filterEl.innerHTML = opts;
  }
  
  // KPI Grid (Visible to Admins only)
  const kpiGrid = document.getElementById('dash-kpi-grid');
  let activeAlerts = 0;
  brands.forEach(b => { if (b.todayFlags) activeAlerts += b.todayFlags.length; });
  const onTrack = brands.filter(b => b.summary && b.summary.targetPct >= 80).length;
  const atRisk = brands.filter(b => b.summary && b.summary.targetPct < 50).length;

  if (CU.role === 'user') {
    kpiGrid.style.display = 'none';
  } else {
    kpiGrid.style.display = 'grid';
    kpiGrid.innerHTML = `
      <div class="cmd-stat-card">
        <div class="cmd-stat-v">${brands.length}</div>
        <div class="cmd-stat-l">Assigned Brands</div>
      </div>
      <div class="cmd-stat-card">
        <div class="cmd-stat-v">${activeAlerts}</div>
        <div class="cmd-stat-l" style="color:var(--amber)">Active Alerts Today</div>
      </div>
      <div class="cmd-stat-card">
        <div class="cmd-stat-v">${onTrack}</div>
        <div class="cmd-stat-l" style="color:var(--green)">Brands On Track (≥80%)</div>
      </div>
      <div class="cmd-stat-card">
        <div class="cmd-stat-v">${atRisk}</div>
        <div class="cmd-stat-l" style="color:var(--red)">Brands At Risk (<50%)</div>
      </div>
    `;
  }

  // Main UI
  renderBrandPerfCards(brands);
  
  if (CU.role === 'superadmin' || CU.role === 'manager') {
    renderTodayAlerts(brands);
  } else {
    document.getElementById('dash-alerts-panel').style.display = 'none';
  }

}

function renderBrandPerfCards(brands) {
  const el = document.getElementById('dash-brand-grid');
  if (!brands || brands.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-title">No Brands Assigned</div><div class="empty-sub">You don't have access to any brands yet.</div></div>`;
    return;
  }

  const isUser = CU.role === 'user';

  el.innerHTML = brands.map(b => {
    const s = b.summary || {};
    const pct = s.targetPct || 0;
    const isGood = pct >= 80;
    const isWarn = pct >= 50 && pct < 80;
    const statusClass = isGood ? 'good' : isWarn ? 'warn' : 'bad';
    const cardStatusClass = isGood ? 'status-good' : isWarn ? 'status-warn' : 'status-bad';
    const flagsCount = (b.todayFlags || []).length;
    
    const salesLeft = Math.max(0, (s.target || 0) - (s.totalSalesReal || 0));
    const budgetTotal = (s.target || 0) / (b.month?.overall_roas || 5);
    const budgetLeft = Math.max(0, budgetTotal - (s.totalSpendReal || 0));
    const isOverSpend = (s.totalSpendReal || 0) > budgetTotal;
    const isUnderSpendPacing = (s.projectedSpend || 0) <= budgetTotal;
    const pacingStr = isOverSpend ? '<span style="color:var(--red);font-weight:700">Over Budget</span>' : isUnderSpendPacing ? '<span style="color:var(--green);font-weight:700">Under Spend</span>' : '<span style="color:var(--amber);font-weight:700">Pacing High</span>';
    
    if (isUser) {
      // Executionist POV: direct entry buttons, simplified brand progress card
      return `
        <div class="brand-perf-card ${cardStatusClass}">
          <div class="bp-hd">
            <div>
              <div class="bp-name">${b.brand.name}</div>
              <div class="bp-meta">${b.month ? b.month.label : 'Active Month'}</div>
            </div>
            <div class="bp-pct ${statusClass}">${pct.toFixed(0)}%</div>
          </div>
          <div class="bp-bar-bg" style="margin-bottom:12px">
            <div class="bp-bar-fill ${statusClass}" style="width:0%" data-width="${Math.min(100, pct)}%"></div>
          </div>
          <div class="bp-shortcuts" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button class="bp-btn primary" onclick="selectBrand('${b.brand.id}'); showPage('budget'); ${b.month ? `bgtOpenMonth('${b.brand.id}','${b.month.id}')` : ''}" style="background:var(--blue);color:#fff;border-color:var(--blue);font-weight:700">📝 Enter Budget</button>
            <button class="bp-btn" onclick="selectBrand('${b.brand.id}'); showPage('catalog');">🔍 Price Catalog</button>
          </div>
        </div>
      `;
    }

    // Superadmin & Manager POV: Agency Command Center (Open brand details only, no raw actions)
    return `
      <div class="brand-perf-card ${cardStatusClass}">
        ${b.hasStrat 
          ? '<div class="bp-status-tag done">Strategy: Active</div>' 
          : '<div class="bp-status-tag todo">Strategy: Needed</div>'}
        <div class="bp-hd">
          <div>
            <div class="bp-name">${b.brand.name}</div>
            <div class="bp-meta">${b.month ? b.month.label : 'No month active'}</div>
          </div>
          <div class="bp-pct ${statusClass}">${pct.toFixed(1)}%</div>
        </div>
        <div class="bp-bar-bg">
          <div class="bp-bar-fill ${statusClass}" style="width:0%" data-width="${Math.min(100, pct)}%"></div>
        </div>
        ${b.month ? `
        <div class="bp-stats">
          <div>Sales Left: <span class="bp-stat-v">₹${fmt(salesLeft)}</span></div>
          <div>Budget Left: <span class="bp-stat-v">₹${fmt(budgetLeft)}</span></div>
          <div>ROAS: <span class="bp-stat-v">${s.totalROAS || '—'}</span></div>
          <div>Pacing: ${pacingStr}</div>
          ${flagsCount > 0 ? `<div style="grid-column:1/-1; color:var(--amber);font-weight:700; margin-top:4px">⚠ ${flagsCount} Alert${flagsCount>1?'s':''}</div>` : ''}
        </div>
        ` : '<div class="bp-stats" style="display:block;text-align:center;padding:12px 0">Waiting for budget setup</div>'}
        
        <div class="bp-shortcuts">
          <button class="bp-btn primary" onclick="selectBrand('${b.brand.id}'); showPage('budget'); ${b.month ? `bgtOpenMonth('${b.brand.id}','${b.month.id}')` : ''}" style="width:100%;background:var(--blue);color:#fff;border-color:var(--blue);font-weight:700">🔍 Open Brand Month</button>
        </div>
      </div>
    `;
  }).join('');

  // Trigger animation next frame
  requestAnimationFrame(() => {
    document.querySelectorAll('.bp-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.width;
    });
  });
}

function renderTodayAlerts(brands) {
  const panel = document.getElementById('dash-alerts-panel');
  const feed = document.getElementById('dash-alerts-feed');
  const countEl = document.getElementById('dash-alert-count');
  
  let allFlags = [];
  brands.forEach(b => {
    if (b.todayFlags && b.todayFlags.length) {
      b.todayFlags.forEach(f => {
        allFlags.push({ brandName: b.brand.name, ...f });
      });
    }
  });

  if (allFlags.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = '';
  countEl.textContent = allFlags.length;
  
  feed.innerHTML = allFlags.map(f => `
    <div class="alert-item ${f.level}">
      <div class="alert-brand">${f.brandName}</div>
      <div class="alert-msg">${f.msg}</div>
    </div>
  `).join('');
}

function renderActivityFeed(logs) {
  const el = document.getElementById('dash-activity-feed');
  if (!logs || !logs.length) {
    el.innerHTML = '<div style="padding:16px;font-size:12px;color:var(--mid);text-align:center;">No recent activity</div>';
    return;
  }

  el.innerHTML = logs.map(l => {
    const act = l.action;
    let icon = '📝';
    let cls = 'update';
    if (act.includes('LOGIN')) { icon = '🔑'; cls = 'login'; }
    if (act.includes('CREATE')) { icon = '✨'; cls = 'create'; }
    if (act.includes('UPDATE')) { icon = '✏️'; cls = 'update'; }
    if (act.includes('DELETE')) { icon = '🗑️'; cls = 'delete'; }
    if (act.includes('GENERATE')) { icon = '🧠'; cls = 'generate'; }
    
    const d = new Date(l.created_at + 'Z');
    const now = new Date();
    const mins = Math.floor((now - d) / 60000);
    const timeStr = mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins/60)}h ago` : `${Math.floor(mins/1440)}d ago`;

    const actionText = l.action.replace(/_/g, ' ').toLowerCase();

    return `
      <div class="activity-timeline-card ${cls}" style="display:flex;gap:12px;padding:12px 14px;background:#ffffff;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;box-shadow:var(--sh)">
        <div style="font-size:16px;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,0.02)">${icon}</div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <span style="font-weight:700;font-size:12px;color:var(--dark)">${l.user_name}</span>
            <span style="font-size:10px;color:var(--mid)">${timeStr}</span>
          </div>
          <div style="font-size:11px;color:var(--mid);margin-top:2px">
            <span class="pill sm ${cls}" style="font-size:8px;font-weight:800;text-transform:uppercase;padding:1px 4px;border-radius:3px;margin-right:4px">${actionText}</span>
            <span>${l.detail}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function runBrandScrape() {
  const url = document.getElementById('strat-website-url')?.value.trim() || '';
  const instagramUrl = document.getElementById('strat-instagram-url')?.value.trim() || '';
  const youtubeUrl = document.getElementById('strat-youtube-url')?.value.trim() || '';
  const otherUrl = document.getElementById('strat-other-url')?.value.trim() || '';
  const customKnowledge = document.getElementById('strat-custom-knowledge')?.value.trim() || '';
  
  if (!url) {
    alert('Please enter a valid Brand Website URL first.');
    return;
  }
  
  const btn = document.getElementById('btn-website-scrape');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Analyzing website & socials...';
  
  try {
    const payload = { url, instagramUrl, youtubeUrl, otherUrl, customKnowledge };
    const res = await api(`/api/strategy/${activeBrand.slug}/scrape`, 'POST', payload);
    if (!res) throw new Error('Empty response from crawler engine.');
    
    // Merge extracted data
    Object.entries(res).forEach(([k, v]) => {
      if (k !== 'channelBudgets' && v) {
        stratForm[k] = v;
      }
    });
    
    // Populating dynamic channels list
    if (res.channelBudgets && Array.isArray(res.channelBudgets)) {
      stratForm.channels = [];
      res.channelBudgets.forEach((chData, idx) => {
        stratForm.channels.push(chData.channel);
        stratForm[`ch_b${idx}`] = chData.budget;
        stratForm[`ch_g${idx}`] = chData.goal;
      });
    }
    
    // Save draft form immediately to MySQL
    await api(`/api/strategy/${activeBrand.slug}/form`, 'PUT', stratForm);
    
    alert('🎉 Success! Dynamic crawler parsed website, social links, and custom documents successfully.\n\nNiches, USPs, Tone, Personas, Special Days, Campaigns, and suggested budgets have been populated. Please review.');
    
    recalculateDoneSteps();
    renderPhaseStrip();
    renderStratSteps();
    renderStrategyStep();
    
  } catch (err) {
    alert('Scraper Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

function addCustomChannel() {
  const chName = prompt('Enter the name of the new marketing channel:');
  if (!chName || chName.trim() === '') return;
  if (!stratForm.channels) stratForm.channels = ['Meta Ads (FB + IG)','Google Ads (Shopping+Search)','YouTube Ads','Influencer Marketing','Content Production','Email + WhatsApp','Marketplaces'];
  
  const trimmed = chName.trim();
  if (stratForm.channels.includes(trimmed)) {
    alert('This channel already exists.');
    return;
  }
  
  stratForm.channels.push(trimmed);
  const idx = stratForm.channels.length - 1;
  stratForm[`ch_b${idx}`] = '₹0';
  stratForm[`ch_g${idx}`] = '';
  
  renderStrategyStep();
  deferStratSave();
}

function removeCustomChannel(idx) {
  if (!stratForm.channels || !confirm('Are you sure you want to remove this marketing channel?')) return;
  
  const chs = stratForm.channels;
  chs.splice(idx, 1);
  
  for (let i = idx; i < chs.length; i++) {
    stratForm[`ch_b${i}`] = stratForm[`ch_b${i+1}`] || '';
    stratForm[`ch_g${i}`] = stratForm[`ch_g${i+1}`] || '';
  }
  
  delete stratForm[`ch_b${chs.length}`];
  delete stratForm[`ch_g${chs.length}`];
  
  stratForm.channels = chs;
  renderStrategyStep();
  deferStratSave();
}

function updateChannelName(idx, value) {
  if (stratForm.channels) {
    stratForm.channels[idx] = value;
    deferStratSave();
  }
}

// ─── STRATEGY BUILDER ────────────────────────────────────────────────────────
function recalculateDoneSteps() {
  stratDone = new Set();
  const stepFieldsMap = {
    0: ['brandName', 'industry', 'platform', 'targetAudience', 'heroProducts'],
    1: ['lastRevenue', 'thisTarget', 'adBudget', 'targetROAS'],
    2: ['monthlyTheme', 'monthlyOffer', 'primaryProblem'],
    3: ['brandVoice', 'communicationTone', 'usps'],
    4: ['pillars'],
    5: ['angles']
  };
  
  Object.entries(stepFieldsMap).forEach(([idx, fields]) => {
    const stepIdx = parseInt(idx);
    const isAnyFilled = fields.some(f => {
      const val = stratForm[f];
      if (val === undefined || val === null) return false;
      if (Array.isArray(val)) return val.length > 0;
      return val.toString().trim() !== '';
    });
    if (isAnyFilled) {
      stratDone.add(stepIdx);
    }
  });
}

async function initStrategyPage() {
  if (!activeBrand) {
    document.getElementById('phase-strip').innerHTML = '';
    document.getElementById('strat-steps').innerHTML = `<div class="empty"><div class="empty-icon">🧠</div><div class="empty-title">No brand selected</div><div class="empty-sub">Select a brand from the sidebar</div></div>`;
    document.getElementById('strat-content').innerHTML = '';
    return;
  }

  // Visual Loading Indicator
  document.getElementById('strat-content').innerHTML = `<div style="padding:40px;text-align:center"><div class="spinner"></div><div style="margin-top:12px;color:var(--mid);font-weight:600">Loading brand strategy draft...</div></div>`;

  // Reset page state if brand has changed
  if (stratForm._brandSlug !== activeBrand.slug) {
    stratForm = { _brandSlug: activeBrand.slug };
    stratDone = new Set();
    stratStep = 0;
  }

  try {
    // 1. Fetch form draft from MySQL table strategy_generations
    const curMonth = stratForm.strategyMonth || new Date().toISOString().substring(0, 7);
    const dRes = await api(`/api/strategy/${activeBrand.slug}/form?month=${curMonth}`);
    if (dRes && dRes.form) {
      stratForm = { ...stratForm, ...dRes.form };
    }

    // 2. Fallback to Brand Memory for any missing basic fields
    const mRes = await api(`/api/strategy/${activeBrand.slug}/memory`);
    if (mRes && mRes.memory) {
      Object.entries(mRes.memory).forEach(([k, v]) => {
        if (!stratForm[k] || stratForm[k] === '') {
          stratForm[k] = v;
        }
      });
    }

    // Auto-fill defaults if still empty
    if (!stratForm['brandName']) stratForm['brandName'] = activeBrand.name;
    if (!stratForm['industry'])  stratForm['industry']  = activeBrand.industry;
    if (!stratForm['platform'])  stratForm['platform']  = activeBrand.platform;

    // Recalculate done badges based on loaded fields
    recalculateDoneSteps();

    // Render components
    renderPhaseStrip();
    renderStratSteps();
    renderStrategyStep();

  } catch (err) {
    console.error('Error loading brand strategy data:', err);
    document.getElementById('strat-content').innerHTML = `<div style="padding:40px;color:var(--red);text-align:center">⚠ Failed to load strategy details. Please refresh.</div>`;
  }
}

function renderPhaseStrip() {
  const cur = STRATEGY_STEPS[stratStep].phase;
  const pct = Math.round(stratDone.size / STRATEGY_STEPS.length * 100);
  let h = PHASES.map((ph, i) => {
    const isDone = STRATEGY_STEPS.filter(s => s.phase === i).every((_, j) => {
      const idx = STRATEGY_STEPS.findIndex(s => s.phase === i) + j;
      return stratDone.has(idx);
    });
    return `<button class="ptab${i===cur?' active':isDone?' done':''}" onclick="jumpPhase(${i})">0${i+1} · ${ph}</button>`;
  }).join('');
  h += `<div class="phase-info">${stratDone.size} / ${STRATEGY_STEPS.length} steps · ${pct}%</div>`;
  document.getElementById('phase-strip').innerHTML = h;
  document.getElementById('sb-prog').style.width = pct + '%';
}

function renderStratSteps() {
  document.getElementById('strat-steps').innerHTML = STRATEGY_STEPS.map((st, i) => `
    <div class="step-item${i===stratStep?' active':''}${stratDone.has(i)?' done':''}${st.ai?' ai':''}" onclick="goStratStep(${i})">
      <div class="step-dot"></div>
      <div style="flex:1;min-width:0">
        <div class="step-label">${st.label}</div>
        <div class="step-sub">${st.sub}</div>
      </div>
      ${st.ai ? '<div class="step-ai-badge">AI</div>' : ''}
    </div>`).join('');
  document.querySelector('.step-item.active')?.scrollIntoView({ block: 'nearest' });
}

// Field helpers — output HTML strings
function F(label, key, ph = '', type = 'text', hint = '') {
  const v = (stratForm[key] || '').toString().replace(/"/g, '&quot;');
  return `<div class="field">
    <label>${label}</label>
    <input type="${type}" value="${v}" placeholder="${ph}" oninput="sf('${key}',this.value)">
    ${hint ? `<div class="field-hint">${hint}</div>` : ''}
  </div>`;
}
function TA(label, key, ph = '', rows = 3) {
  return `<div class="field">
    <label>${label}</label>
    <textarea rows="${rows}" placeholder="${ph}" oninput="sf('${key}',this.value)">${stratForm[key] || ''}</textarea>
  </div>`;
}
function sf(k, v) {
  stratForm[k] = v;
  stratDone.add(stratStep);
  renderPhaseStrip();
  renderStratSteps();
  deferStratSave();
}

function deferStratSave() {
  const ind = document.getElementById('strat-save-ind');
  if (!activeBrand) return;
  if (ind) { ind.style.display = ''; ind.textContent = '⟳ Saving…'; ind.style.color = 'var(--amber)'; }
  clearTimeout(stratSaveTimer);
  stratSaveTimer = setTimeout(async () => {
    await api(`/api/strategy/${activeBrand.slug}/form`, 'PUT', stratForm);
    if (ind) { ind.textContent = '✓ Saved'; ind.style.color = 'var(--green)'; }
  }, 1200);
}

function ensureString(val) {
  if (Array.isArray(val)) {
    return val.join(' ').trim();
  }
  if (typeof val === 'object' && val !== null) {
    return JSON.stringify(val);
  }
  return (val || '').toString().trim();
}

function renderStrategyStep() {
  if (!activeBrand) return;
  const st = STRATEGY_STEPS[stratStep];
  let html = `<div class="step-header">
    <div class="step-pill">STEP ${stratStep + 1} / ${STRATEGY_STEPS.length}</div>
    <div class="step-title-text">${st.label}</div>
    ${st.ai ? '<div class="ai-tag">✦ AI</div>' : ''}
  </div>`;

  const canEdit = CU.role !== 'user';
  const canGen  = !!stratForm['brandName'] && CU.role !== 'user';

  switch (stratStep) {
    case 0: html += `
      <div class="mem-notice">💾 Brand identity saved to memory — reused every month and across AI generation</div>
      <div class="card" style="border: 2px solid rgba(43,78,255,0.2); box-shadow: var(--sh)">
        <div class="card-title" style="color:var(--blue);font-size:14px"><div class="ct-num" style="background:var(--blue)">✦</div>AI Brand Knowledge & Scraper Hub</div>
        <p style="font-size:12px;color:var(--mid);margin-bottom:14px">Connect your brand channels and feed the AI custom documents. The system will crawl the inputs and auto-fill your strategy draft immediately.</p>
        
        <!-- Channels Row -->
        <div class="g2" style="margin-bottom:12px">
          <div class="field">
            <label style="color:var(--dark);font-size:9.5px">Website Homepage URL</label>
            <input type="text" id="strat-website-url" value="${stratForm['websiteUrl'] || ''}" placeholder="e.g. https://blackape.in" oninput="sf('websiteUrl',this.value)">
          </div>
          <div class="field">
            <label style="color:var(--dark);font-size:9.5px">Instagram URL</label>
            <input type="text" id="strat-instagram-url" value="${stratForm['instagramUrl'] || ''}" placeholder="e.g. https://instagram.com/blackapeindia" oninput="sf('instagramUrl',this.value)">
          </div>
        </div>

        <div class="g2" style="margin-bottom:14px">
          <div class="field">
            <label style="color:var(--dark);font-size:9.5px">YouTube Channel URL</label>
            <input type="text" id="strat-youtube-url" value="${stratForm['youtubeUrl'] || ''}" placeholder="e.g. https://youtube.com/@blackape" oninput="sf('youtubeUrl',this.value)">
          </div>
          <div class="field">
            <label style="color:var(--dark);font-size:9.5px">Other Social Link (FB, LinkedIn, competitor link)</label>
            <input type="text" id="strat-other-url" value="${stratForm['otherUrl'] || ''}" placeholder="e.g. https://facebook.com/blackape" oninput="sf('otherUrl',this.value)">
          </div>
        </div>

        <!-- Custom Knowledge Base -->
        <div class="field" style="margin-bottom:14px">
          <label style="color:var(--blue);font-weight:700">✦ Paste Brand Strategy notes, PDF text, or Competitor details</label>
          <textarea id="strat-custom-knowledge" rows="4" placeholder="Paste product catalogs, founder notes, campaign briefs, competitor lists, or raw strategy text here. The AI will learn from these details and apply them across your generated PPTX deck." oninput="sf('customKnowledge',this.value)">${stratForm['customKnowledge'] || ''}</textarea>
        </div>

        <div style="display:flex;justify-content:flex-end">
          <button type="button" class="btn primary" id="btn-website-scrape" onclick="runBrandScrape()" style="padding:10px 20px;height:40px;white-space:nowrap;font-weight:700;border-radius:8px;font-size:12px">
            ✦ Auto-Fill from Website, Socials & Docs
          </button>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><div class="ct-num">1</div>Brand Identity <span class="card-note">Saved to memory</span></div>
        <div class="g3" style="margin-bottom:12px">${F('Brand Name','brandName','e.g. '+activeBrand.name)}${F('Industry / Niche','industry',activeBrand.industry||'')}${F('Platform','platform','e.g. Shopify')}</div>
        <div class="g2">${F('Target Audience','targetAudience','e.g. Men 20–35, urban gym-goers')}${F('Hero Products','heroProducts','e.g. Muscle Fit · Stringers · Joggers')}</div>
        <div class="g4" style="margin-top:12px">${F('Price Range','priceRange','₹799–₹1,499')}${F('Strategy Month','strategyMonth','May 2026')}${F('Founder Name','founderName','e.g. Riyas')}${F('Account Manager','accountManager','Full name')}</div>
      </div>
      <div class="card">
        <div class="card-title"><div class="ct-num">2</div>Monthly Targets</div>
        <div class="g4">${F('Last Month Revenue','lastRevenue','₹4L')}${F('This Month Target','thisTarget','₹8L')}${F('Monthly Ad Budget','adBudget','₹2L')}${F('Target ROAS','targetROAS','4.0')}</div>
        <div class="g4" style="margin-top:12px">${F('Target CAC','targetCAC','₹400')}${F('Current CAC','currentCAC','₹580')}${F('Current CVR','currentCVR','1.8%')}${F('Current AOV','currentAOV','₹1,200')}</div>
      </div>
      <div class="card">
        <div class="card-title"><div class="ct-num">3</div>Brand Problem Statement <span class="card-note">AI reads this for every slide</span></div>
        <div class="g2">${TA('Primary Problem (with numbers)','primaryProblem','e.g. CAC at ₹580 vs target ₹400. 90% Meta dependency. CVR 1.2%.',3)}${TA('What Has Been Tried & Failed','whatFailed','e.g. Broad audience campaigns — zero improvement.',3)}</div>
        <div class="g2" style="margin-top:12px">${TA('Founder Concern This Month','founderConcern','e.g. Wants to reduce Meta dependency.',2)}${TA('Instructions to AI','aiInstructions','e.g. Do NOT recommend discounts. Focus on retention.',2)}</div>
      </div>`; break;

    case 1: {
      const activeChs = stratForm.channels || ['Meta Ads (FB + IG)','Google Ads (Shopping+Search)','YouTube Ads','Influencer Marketing','Content Production','Email + WhatsApp','Marketplaces'];
      if (!stratForm.channels) stratForm.channels = activeChs;
      
      html += `<div class="card"><div class="card-title"><div class="ct-num">1</div>Channel Budget Allocation</div>
      <p style="font-size:12px;color:var(--mid);margin-bottom:12px">Allocate monthly ad budgets across active acquisition channels. You can edit names, add custom channels, or remove ones you do not need.</p>`;
      
      stratForm.channels.forEach((ch, i) => {
        html += `<div style="display:grid;grid-template-columns:200px 1fr 1fr 40px;gap:10px;margin-bottom:10px;align-items:end">
          <div class="field"><label>Channel Name</label><input value="${ch}" oninput="updateChannelName(${i}, this.value)" style="font-weight:600;color:var(--dark);background:#fff"></div>
          ${F('Budget (₹)',`ch_b${i}`,'₹XX,XXX')}
          ${F('Goal / Focus',`ch_g${i}`,'e.g. TOFU + BOFU')}
          <button type="button" class="btn sm danger icon" onclick="removeCustomChannel(${i})" style="height:36px;width:36px;display:flex;align-items:center;justify-content:center;padding:0;border-radius:8px">✕</button>
        </div>`;
      });
      
      html += `<div style="display:flex;justify-content:flex-end;margin-top:14px">
        <button type="button" class="btn sm" onclick="addCustomChannel()" style="border-radius:6px;font-size:11px"><span style="margin-right:2px">➕</span> Add Custom Channel</button>
      </div></div>`;
    } break;

    case 3: html += `<div class="card"><div class="card-title"><div class="ct-num">1</div>Brand USPs <span class="card-note">Saved to memory</span></div>
      <div class="mem-notice">💾 USPs are referenced in AI-generated content pillars and sales angles</div>
      ${[1,2,3,4,5].map(i => `<div style="display:grid;grid-template-columns:24px 1fr 1fr;gap:10px;margin-bottom:10px;align-items:end">
        <div style="font-size:12px;font-weight:700;color:var(--mid);padding-top:20px">${i}</div>
        ${F('USP Headline',`usp_head_${i}`,'e.g. ISO 9001 Certified Manufacturing')}
        ${F('Supporting Detail',`usp_detail_${i}`,'e.g. In-house quality testing on every batch')}
      </div>`).join('')}
      </div>`; break;

    case 4: html += `<div class="card"><div class="card-title"><div class="ct-num">1</div>Monthly Theme & Direction</div>
      <div class="g2">${F('Month Headline','monthHeadline','e.g. SUMMER STRONG — BREAK YOUR LIMITS')}${F('Primary Offer','primaryOffer','e.g. Buy 2 Get 1 Free on Stringers')}</div>
      <div style="margin-top:12px">${TA('Creative Direction','creativeDirection','e.g. Outdoor gym shoots, sunrise aesthetic, red+black palette',2)}</div>
      <div style="margin-top:12px">${TA('Key Messages','keyMessages','e.g. Performance over price. Built for the committed.',2)}</div>
      </div>`; break;

    case 6: html += `<div class="card"><div class="card-title"><div class="ct-num">1</div>Buyer Personas <span class="card-note">Saved to memory</span></div>
      <div class="mem-notice">💾 Personas are used in AI content pillar and sales angle generation</div>
      ${['A','B','C'].map((p, i) => `<div style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;color:var(--mid);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Persona ${p}</div>
        <div class="g3">${F('Name / Label',`pname${i}`,'e.g. Gym Bro')}${F('Age Range',`page${i}`,'e.g. 22–30')}${F('Monthly Income',`pincome${i}`,'e.g. ₹40K–80K')}</div>
        <div style="margin-top:8px">${TA('Pain Points & Motivations',`ppain${i}`,'e.g. Wants premium quality at D2C prices, trains 5x/week',2)}</div>
      </div>`).join('')}
      </div>`; break;

    case 9:
    case 10: {
      const type = stratStep === 9 ? 'pillars' : 'sales';
      const savedData = type === 'pillars' ? stratForm.ai_pillars : stratForm.ai_angles;
      let outputHtml = '';
      if (savedData && savedData.length > 0) {
        if (type === 'pillars') {
          outputHtml = savedData.map(p => {
            const pTitle = ensureString(p.title);
            const pDesc = ensureString(p.description);
            return `
            <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#fff;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
              <div style="width:6px;height:6px;border-radius:50%;background:var(--blue);flex-shrink:0;margin-top:5px"></div>
              <div><div style="font-weight:700;color:var(--dark);font-size:13px;margin-bottom:3px">${pTitle}</div>
              <div style="font-size:12px;color:var(--mid)">${pDesc}</div></div>
            </div>`;
          }).join('');
        } else {
          outputHtml = savedData.map((a, i) => {
            const aHead = ensureString(a.headline);
            const aBody = ensureString(a.body);
            const aCta = ensureString(a.cta);
            return `
            <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#fff;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
              <div style="width:22px;height:22px;border-radius:6px;background:var(--navy);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
              <div><div style="font-weight:700;color:var(--dark);font-size:13px;margin-bottom:2px">${aHead}</div>
              <div style="font-size:12px;color:var(--mid);margin-bottom:3px">${aBody}</div>
              ${aCta ? `<div style="font-size:11px;color:var(--green);font-weight:600">${aCta}</div>` : ''}</div>
            </div>`;
          }).join('');
        }
      }
      html += `<div class="ai-block">
        <div class="ai-tag">✦ AI-GENERATED</div>
        <div class="ai-block-title">${st.label}</div>
        <div class="ai-block-desc">${stratStep === 9
          ? 'AI will generate 8 content pillars aligned to your brand voice and USPs.'
          : 'AI will generate 6 high-converting sales angles based on your buyer personas.'}<br>
          Complete Brand Overview, USPs, and Personas first for best results.</div>
        <div style="margin-top:14px">
          ${canGen
            ? `<button class="btn amr" onclick="runAI('${st.id}')">✦ Generate ${st.label}</button>`
            : `<div style="font-size:12px;color:var(--mid)">⚠ Fill Brand Name in Step 1 to unlock generation</div>`}
        </div>
        <div id="ai-output-${st.id}" style="margin-top:14px">${outputHtml}</div>
      </div>`;
    } break;

    case 11: html += `<div class="card"><div class="card-title"><div class="ct-num">1</div>Ads Setup</div>
      <div class="g4">${F('Meta Daily Budget','metaBudget','₹2,000')}${F('Meta Objective','metaObj','Conversions')}${F('Google Daily Budget','googleBudget','₹1,000')}${F('Google Type','googleType','Shopping + Search')}</div>
      <div class="g2" style="margin-top:12px">${TA('Meta Audience Strategy','metaAud','e.g. 1% LAL from purchasers + broad interest stacking',2)}${TA('Google Keywords Focus','googleKW','e.g. Brand + category + competitor conquesting',2)}</div>
      </div>`; break;

    case 12: html += `<div class="card"><div class="card-title"><div class="ct-num">1</div>Retention Plan</div>
      <div class="g2">${F('Email Send Days','emailDays','e.g. Mon, Wed, Fri')}${F('WA Broadcast Days','waDays','e.g. Tue, Thu, Sun')}</div>
      <div style="margin-top:12px">${TA('Email Content Calendar','emailCal','Mon: New arrivals · Wed: Education · Fri: Offer',3)}</div>
      <div style="margin-top:12px">${TA('WhatsApp Messages','waCal','Tue: Product spotlight · Thu: Review · Sun: Flash deal',3)}</div>
      </div>`; break;

    case 13: html += `<div class="card"><div class="card-title"><div class="ct-num">1</div>KPI Tracker</div>
      <div class="g4">${F('Current ROAS','kc_roas','2.8x')}${F('Target ROAS','kt_roas','4.0x')}${F('Current CAC','kc_cac','₹580')}${F('Target CAC','kt_cac','₹400')}</div>
      <div class="g4" style="margin-top:12px">${F('Current CVR','kc_cvr','1.8%')}${F('Target CVR','kt_cvr','2.5%')}${F('Current Repeat Rate','kc_rr','18%')}${F('Target Repeat Rate','kt_rr','30%')}</div>
      </div>`; break;

    default: html += `<div class="card"><div class="card-title"><div class="ct-num">${stratStep+1}</div>${st.label}</div>
      ${TA('Notes & Details','step_notes_'+stratStep,'Enter your notes for this step...',5)}
      </div>`;
  }

  document.getElementById('strat-content').innerHTML = html;
  document.getElementById('s-prev').disabled = stratStep === 0;
  document.getElementById('s-next').disabled = stratStep === STRATEGY_STEPS.length - 1;
  const sg = document.getElementById('s-gen');
  if (sg) sg.style.display = (activeBrand && CU.role !== 'user') ? '' : 'none';
}

function goStratStep(i) { stratStep = i; renderPhaseStrip(); renderStratSteps(); renderStrategyStep(); }
function stratPrev() { if (stratStep > 0) goStratStep(stratStep - 1); }
function stratNext() { if (stratStep < STRATEGY_STEPS.length - 1) goStratStep(stratStep + 1); }
function jumpPhase(i) { const fi = STRATEGY_STEPS.findIndex(s => s.phase === i); if (fi >= 0) goStratStep(fi); }

async function runAI(type) {
  const el = document.getElementById('ai-output-' + type);
  if (!el) return;
  el.innerHTML = '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mid)"><div class="spinner"></div> Generating with AI…</div>';
  
  try {
    const url = `/api/strategy/${activeBrand.slug}/ai/${type === 'pillars' ? 'pillars' : 'sales'}`;
    const data = await api(url, 'POST', stratForm);
    if (!data) throw new Error('Empty response from server');

    if (type === 'pillars') {
      const generatedPillars = data.pillars || [];
      stratForm.ai_pillars = generatedPillars;
      el.innerHTML = generatedPillars.map(p => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#fff;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
          <div style="width:6px;height:6px;border-radius:50%;background:var(--blue);flex-shrink:0;margin-top:5px"></div>
          <div><div style="font-weight:700;color:var(--dark);font-size:13px;margin-bottom:3px">${p.title}</div>
          <div style="font-size:12px;color:var(--mid)">${p.description}</div></div>
        </div>`).join('');
    } else {
      const generatedAngles = data.angles || [];
      stratForm.ai_angles = generatedAngles;
      el.innerHTML = generatedAngles.map((a, i) => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#fff;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
          <div style="width:22px;height:22px;border-radius:6px;background:var(--navy);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
          <div><div style="font-weight:700;color:var(--dark);font-size:13px;margin-bottom:2px">${a.headline}</div>
          <div style="font-size:12px;color:var(--mid);margin-bottom:3px">${a.body}</div>
          ${a.cta ? `<div style="font-size:11px;color:var(--green);font-weight:600">${a.cta}</div>` : ''}</div>
        </div>`).join('');
    }
    stratDone.add(stratStep);
    renderPhaseStrip();
    renderStratSteps();
    deferStratSave();
  } catch (err) {
    el.innerHTML = `<div style="color:var(--red);font-size:12px">⚠ ${err.message}</div>`;
  }
}

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
    s1.addText('POWERED BY\nDIGIFYCE', {x: 0.4, y: 0.5, fontSize: 22, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 11.0, h: 0.35});
    
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
      ? `Mr. ${fName} quit a high-paying corporate job to solve one overlooked problem: international sizing and products are not engineered for Indian body proportions.\n\nOur products are purpose-built for Indian proportions, chest widths, and thigh circumferences — so every workout feels right.`
      : `Mr./Ms. ${fName} started ${bName} to solve one overlooked problem: legacy offerings in the ${indName} space are not engineered for modern Indian consumers.\n\nOur products are purpose-built to deliver premium quality, tailored specifically for local preferences.`;

    s2.addText(storyTitle, {x: 0.7, y: 2.1, fontSize: 20, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 5.4, h: 0.35});
    s2.addText(storyBody, { x: 0.7, y: 2.7, w: 5.4, fontSize: 12, color: '333333', fontFace: FONT_PRIMARY });
    s2.addShape('rect', { x: 0.7, y: 4.6, w: 5.4, h: 0.9, fill: { color: COLOR_PRIMARY }, rectRadius: 0.05 });
    s2.addText(`${mRev} → ${mTarget} in 90 Days\nTarget Monthly Scale Up`, {x: 0.8, y: 4.75, w: 5.2, align: 'center', fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
    
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
      s4.addText('Age\n' + pAges[i], {x: x + 0.3, y: 1.85, w: 1.5, fontSize: 10, color: COLOR_DARK, bold: true, fontFace: FONT_PRIMARY, h: 0.35});
      s4.addShape('rect', { x: x + 2.0, y: 1.8, w: 1.7, h: 0.7, fill: { color: COLOR_BG_LIGHT } });
      s4.addText('Income\n' + pIncomes[i], {x: x + 2.1, y: 1.85, w: 1.5, fontSize: 10, color: COLOR_DARK, bold: true, fontFace: FONT_PRIMARY, h: 0.35});
      
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
      ? 'TAM: ₹55,000 Cr — Total India activewear retail\nSAM: ₹8,000–10,000 Cr — Premium D2C gymwear\nSOM: ₹3–5 Cr ARR — Realistic 12-month target\nGAP: OPEN FIELD — No Indian brand owns body-fit story.'
      : `TAM: ₹1,20,000 Cr — Total India ${indName} retail retail\nSAM: ₹15,000 Cr — Premium D2C D2C segment\nSOM: ₹3–5 Cr ARR — Realistic 12-month target\nGAP: OPEN FIELD — Trust deficit and poor sizing open the market.`;
    s5.addText(mktSizingText, { x: 0.7, y: 3.2, w: 5.5, fontSize: 12, lineSpacing: 26, color: COLOR_DARK, fontFace: FONT_PRIMARY });

    s5.addShape('rect', { x: 6.9, y: 2.5, w: 5.9, h: 4.3, fill: { color: 'FFFFFF' }, rectRadius: 0.1 });
    s5.addShape('rect', { x: 6.9, y: 2.5, w: 5.9, h: 0.5, fill: { color: COLOR_AMBER } });
    s5.addText('KEY MARKET TRENDS', {x: 7.1, y: 2.65, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 5.70, h: 0.35});
    
    const mktTrendsText = isFitness
      ? '· Dark Aesthetic: Gymshark effect reaching serious Indian lifters.\n· Gym = Identity: Consumers wear gym brands 24/7 as lifter badge.\n· Creator Commerce: 62% buy based on creator recommendation.\n· Indian Body Gap: Global brands do not fit Indian ratios.'
      : `· Brand Trust: Consumers value transparency and genuine reviews.\n· Premiumization: Buyers are trading up to premium products.\n· Creator Commerce: 62% buy based on creator recommendation.\n· Local Sizing Gap: Global sizing ratios do not fit Indian consumers.`;
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
    s9.addText('BUDGET\nSPLIT', {x: 2.4, y: 3.2, w: 1.7, align: 'center', fontSize: 12, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});

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

      s10.addText('AUDIENCE\n' + col.aud, {x: x + 0.2, y: 1.85, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      s10.addText('FORMAT\n' + col.fmt, {x: x + 0.2, y: 2.65, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      s10.addText('CREATIVE\n' + col.cr, {x: x + 0.2, y: 3.45, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, h: 0.35});
      s10.addText('KEY TARGET KPIs\n' + col.k, {x: x + 0.2, y: 4.25, w: 3.5, fontSize: 10, bold: true, color: col.c, fontFace: FONT_PRIMARY, h: 0.35});
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

    s11.addText(`Shopping Campaigns\n· All hero SKUs with SEO-optimised titles.\n· Format: ${shoppingTitleFmt}.\n· Keywords: ${kwKeywords}.\n\nSearch Campaigns\n· Brand Bid: ${brandBidKeyword}.\n· Competitor conquests: ${competitorBidKeyword}.\n· Non-brand: ${nonBrandKeywords}.`, { x: 0.7, y: 1.9, w: 5.5, fontSize: 11, lineSpacing: 20, color: COLOR_DARK, fontFace: FONT_PRIMARY });
    
    s11.addShape('rect', { x: 0.7, y: 4.8, w: 5.5, h: 1.6, fill: { color: COLOR_DARK }, rectRadius: 0.05 });
    
    const sampleScript = isFitness
      ? `SAMPLE AD SCRIPT (15-sec)\n[Heavy squat] "Your shorts just ripped. Again." [Cut to ${bName} Shorts] "Squat Proof. Anti-Rip. Built for India." [CTA: Shop Now — ₹999]`
      : `SAMPLE AD SCRIPT (15-sec)\n[Problem hook] "Tired of low-quality ${indName.toLowerCase()}?" [Cut to ${bName} Product] "Premium Quality. Engineered for India." [CTA: Buy Now]`;
    s11.addText(sampleScript, {x: 0.8, y: 4.95, w: 5.3, fontSize: 10, italic: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

    // Right YouTube Ads Card
    s11.addShape('rect', { x: 6.9, y: 1.1, w: 5.9, h: 5.6, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_RED, width: 2 } });
    s11.addShape('rect', { x: 6.9, y: 1.1, w: 5.9, h: 0.6, fill: { color: COLOR_RED } });
    s11.addText('YOUTUBE ADS — Video Reach', { x: 7.1, y: 1.25, fontSize: 14, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY });
    
    const youtubeText = isFitness
      ? '6-Second Bumper Ads\n· Dark visual + product name + single hook. Unskippable.\n· "Anti-rip. Squat proof. Built for India." — mass impression at scale.\n\n15–30 Sec Pre-Roll\n· Structure: Problem → Feature → Proof → CTA.\n· Target: Fitness channels, bodybuilding tutorials vlogs.\n\nTarget Channels:\n· Fitness YouTube & Bodybuilding channels\n· Gym tutorials & transformation vlogs\n· Supplement review channels'
      : `6-Second Bumper Ads\n· Clean visuals + product spotlight + single hook. Unskippable.\n· "Premium quality. Ethically sourced. Built for India."\n\n15–30 Sec Pre-Roll\n· Structure: Problem → Feature → Proof → CTA.\n· Target: Lifestyle channels, product reviews vlogs.\n\nTarget Channels:\n· Industry influencer channels\n· Niche lifestyle and review channels\n· Family and home vlogs`;
    s11.addText(youtubeText, { x: 7.1, y: 1.9, w: 5.5, fontSize: 11, lineSpacing: 22, color: COLOR_DARK, fontFace: FONT_PRIMARY });

    // SLIDE 12: Influencer Strategy (Light Theme)
    let s12 = pptx.addSlide();
    addHeader(s12, 'Influencer Strategy', 'Creator Omnipresence — Maximum Impact Seeding');
    s12.addShape('rect', { x: 0.5, y: 1.1, w: 12.3, h: 0.6, fill: { color: COLOR_DARK } });
    
    const omniGoalText = `THE OMNIPRESENCE GOAL: When someone opens Instagram in India looking for ${indName}, they see ${bName} on 3+ different creators within a week. Not viral — just everywhere.`;
    s12.addText(omniGoalText, { x: 0.7, y: 1.25, w: 11.9, fontSize: 10, bold: true, color: COLOR_AMBER, fontFace: FONT_PRIMARY });

    const infCols = [
      { t: 'MICRO CREATORS', amt: '8 Creators · Seeding', w: '10K–50K Followers', y: 'Highest engagement rates (8–12%). Niche audiences. Most authentic content. Direct community trust.', d: isFitness ? '1 REEL — Product in ACTUAL workout. Show stretch, fit, tech. Dark gym aesthetic.\n2 STORIES — Unboxing reaction.\n1 STATIC POST — Clean product shot.' : '1 REEL — Product in everyday use/styling. Show aesthetic, design, benefits.\n2 STORIES — Unboxing reaction.\n1 STATIC POST — Clean product shot.', c: COLOR_PRIMARY },
      { t: 'MID-MACRO CREATOR', amt: '1 Creator · Authority', w: '100K–500K Followers', y: 'Broader reach for brand authority. Signals we are a real, fast-growing premium D2C brand.', d: '1 REEL — Full review and usage showcase.\nBroad awareness reach targeting modern consumers.\nUsage rights: 90 days for repurposing as paid ads.', c: COLOR_PURPLE },
      { t: 'USAGE RIGHTS', amt: 'All Creators', w: 'All Creators', y: 'Repurpose the best creator content as paid ads. Creator UGC = top-performing ad creative.', d: 'Repurpose rights: 90 days for paid ads across Meta.\nEvery creator brief must include usage rights clause.\nBest UGC content becomes BOFU retargeting ads.', c: COLOR_GREEN }
    ];

    infCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s12.addShape('rect', { x, y: 1.85, w: 3.9, h: 4.8, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: col.c, width: 2 } });
      s12.addShape('rect', { x, y: 1.85, w: 3.9, h: 0.5, fill: { color: col.c } });
      s12.addText(col.t, {x: x + 0.1, y: 1.9, w: 2.2, fontSize: 11, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
      s12.addText(col.amt, {x: x + 2.3, y: 1.9, w: 1.5, align: 'right', fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

      s12.addText('WHY\n' + col.y, {x: x + 0.2, y: 2.5, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, valign: 'top', h: 1.0});
      s12.addText('DELIVERABLES\n' + col.d, {x: x + 0.2, y: 3.6, w: 3.5, fontSize: 10, bold: true, color: col.c, fontFace: FONT_PRIMARY, valign: 'top', h: 2.8});
    });

    // SLIDE 13: Social Branding (Light Theme)
    let s13 = pptx.addSlide();
    addHeader(s13, 'Social Branding', 'Instagram · YouTube · Facebook — Full Platform Strategy');
    
    const handleRaw = bName.toLowerCase().replace(/\\s+/g, '');
    const ytMix = isFitness
      ? `2x Long-form/month: Gymwear comparisons, product deep-dives\nFounder Story: "Why Mr. ${fName} quit his job to build ${bName}"\nGym performance: "Full Leg Day in joggers — Does It Hold?"\nYouTube Shorts from long-form content`
      : `2x Long-form/month: Product comparison and deep-dives\nFounder Story: "Why Mr./Ms. ${fName} started ${bName}"\nProduct performance: "${bName} product testing and reviews"\nYouTube Shorts from long-form content`;

    const socCols = [
      { t: 'INSTAGRAM', s: `@${handleRaw}`, c: `3x Reels/week: Product features · Lifestyle integration · UGC\n2x Static Posts: Product photography · Customer reviews\n5x Stories/day: Polls · User tips · Product of the day\n1x Carousel/week: Product deep-dive explainer`, id: 'Feed: Clean, premium, high-contrast. Reflecting our brand voice.', tag: `#${bName.replace(/\\s+/g, '')} #BuiltForIndia #Premium${indName.replace(/\\s+/g, '')}`, color: COLOR_RED },
      { t: 'YOUTUBE', s: `${bName} Official`, c: ytMix, id: 'Clean thumbnails. Strong product visuals. Bold white text on dark bg.', tag: 'Monthly founder LIVE: Product drops + Q&A session', color: 'FF0000' },
      { t: 'FACEBOOK', s: handleRaw, c: `Primary use: Paid retargeting pixel + dynamic product ads\nCommunity Group: "${bName} VIPs" — drop announcements + Q&As\nCatalogue connected for dynamic product retargeting ads\nNot primary organic channel — mainly used for paid retargeting`, id: 'Focus: pixel-perfect attribution + catalogue for dynamic ads. Community group for loyal buyers.', tag: 'Secondary organic — primary paid retargeting + community', color: COLOR_PRIMARY }
    ];

    socCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s13.addShape('rect', { x, y: 1.1, w: 3.9, h: 5.6, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s13.addShape('rect', { x, y: 1.1, w: 3.9, h: 0.5, fill: { color: col.color } });
      s13.addText(col.t, {x: x + 0.15, y: 1.15, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s13.addText(col.s, {x: x + 2.0, y: 1.15, w: 1.75, align: 'right', fontSize: 10, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

      s13.addText('CONTENT MIX\n' + col.c, {x: x + 0.2, y: 1.7, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, valign: 'top', h: 2.0});
      s13.addText('VISUAL IDENTITY\n' + col.id, {x: x + 0.2, y: 3.8, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, valign: 'top', h: 1.0});
      
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
      upperFunnelText = 'Muscle Fit Tee\n4-way stretch + biceps strap. Fits like it was made for your body.\n\nStringers\nNon-restrictive. Odour-free. Built for serious sets.\n\nLeggings\nSpider Web waistband. Built-in underwear. Squat proof.\n\nOversized Tee\nSweat-wicking. Anti-odour. Hides insecurities.';
    } else {
      upperFunnelText = `${heroProds[0].n}\nPremium build + top features. Designed to meet high-end specifications.\n\n${heroProds[1].n}\nHigh convenience. Value pack design to drive repeat purchase.\n\n${heroProds[2].n}\nStarter bundle that makes onboarding effortless.\n\n${heroProds[3].n}\nTravel-ready option for high convenience on the move.`;
    }
    s14.addText(upperFunnelText, {x: 0.7, y: 2.5, w: 5.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, valign: 'top', h: 4.0});

    s14.addShape('rect', { x: 6.9, y: 1.8, w: 5.9, h: 4.9, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_AMBER, width: 2 } });
    s14.addShape('rect', { x: 6.9, y: 1.8, w: 5.9, h: 0.5, fill: { color: COLOR_AMBER } });
    s14.addText('LOWER FUNNEL — OFFER MECHANICS', {x: 7.1, y: 1.95, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 5.70, h: 0.35});
    
    let lowerFunnelText = '';
    if (isFitness) {
      lowerFunnelText = `Free Shaker @ ₹1,499+\nProgress bar in cart drives AOV. Gift, not discount.\n\nFree ON Whey @ ₹1,500+\nLucky winner gamification on orders. Excitement, not entitlement.\n\nPREPAID50 Code\n₹50 off above ₹799. Drives prepaid shift, reduces COD returns.\n\n48-hr Flash Sale\nMonthly window only. Countdown timer on site. Urgency-led.`;
    } else {
      lowerFunnelText = `${primaryOffer || 'Free Gift @ ₹1,499+'}\nProgress bar in cart drives AOV. Gift incentive, not price slash.\n\nPrepaid Discount Code\n₹50 off above ₹799. Incentivizes online payments, slashing COD RTO rates.\n\nExclusive Bundle Offer\n15% off when custom bundling 3+ items. Boosts AOV immediately.\n\n48-hr Flash Sale\nMonthly window only. Countdown timer on site. Urgency-led.`;
    }
    s14.addText(lowerFunnelText, { x: 7.1, y: 2.5, w: 5.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY });

    // SLIDE 15: Retention Engine (Light Theme)
    let s15 = pptx.addSlide();
    addHeader(s15, 'Retention Engine', 'WhatsApp · Email · Push — The Repeat Purchase Machine');
    
    const retCols = [
      { t: 'WHATSAPP', s: 'Business API · 85%+ Open Rate', c: `Order Confirmed\n"Your ${bName} order is confirmed! [Order summary]"\n\nDay 3–5\n"Your order arrived! Usage tip + styling tip for your next session"\n\nDay 14\n"How's your first week? Tag us @${handleRaw}"\n\nDay 30\n"New [Product] just dropped — check it out! [Link]"\n\nDay 45\n"Complete your kit — here's what pairs with your [product]"`, color: COLOR_GREEN },
      { t: 'EMAIL', s: 'Email CRM · 28%+ Open Rate', c: `Day 0 Welcome\nBrand story + founder origin + what we stand for\n\nDay 2\n"The technology inside your product" — deep features\n\nDay 5\n"Real results." — social proof + UGC + reviews\n\nDay 8\n"Your exclusive offer — because you're part of the family"\n\nDay 10\n"What's next? Here's what pairs with your product"`, color: COLOR_PRIMARY },
      { t: 'PUSH NOTIFICATIONS', s: 'Pushnova · 15%+ CTR', c: 'Flash Sale\n"48 hours only — [Product] now available. Free gift at ₹1,499"\n\nBack In Stock\n"[Product] is back! Limited stock — grab it"\n\nSocial Proof\n"47 people bought this today — your variant is still available"\n\nCart Expires\n"You left something behind. Your cart expires in 2 hours"\n\nNew Drop\n"NEW DROP: [Product] just launched. Be the first to get it"', color: COLOR_PURPLE }
    ];

    retCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s15.addShape('rect', { x, y: 1.1, w: 3.9, h: 5.6, fill: { color: col.color }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s15.addShape('rect', { x, y: 1.1, w: 3.9, h: 0.5, fill: { color: col.color } });
      s15.addText(col.t, {x: x + 0.15, y: 1.15, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s15.addText(col.s, {x: x + 1.8, y: 1.15, w: 1.95, align: 'right', fontSize: 9, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

      s15.addText(col.c, {x: x + 0.2, y: 1.7, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, valign: 'top', h: 4.8});
    });

    // SLIDE 16: Shopify Store CRO (Light Theme)
    let s16 = pptx.addSlide();
    addHeader(s16, 'Shopify CRO', "Store Optimisation — Converting Every Visitor Into Revenue");
    
    const homepageHeroText = isFitness
      ? '· Dark full-width hero video: Real athletes, gym footage, in motion.'
      : '· High-quality lifestyle hero video: Products in use, aesthetic lifestyle.';
    
    const homepageUspStrip = `· USP strip: ${usp1} · ${usp2} · ${usp3} · Free Shipping.`;

    const croPanels = [
      { t: 'HOMEPAGE', c: `${homepageHeroText}\n${homepageUspStrip}\n· UGC wall: Customer photos + creator feed at bottom.\n· Trust bar: "10,000+ Happy Customers" · Star ratings.`, color: COLOR_PRIMARY },
      { t: 'PRODUCT PAGES', c: '· Headline leads with FEATURE — not just product name.\n· 6–8 images: Product shots + close-ups.\n· 15-sec product video: Show the usage or stretch test.\n· Feature pills displayed ABOVE the fold — not buried in description.', color: COLOR_PURPLE },
      { t: 'CART & CHECKOUT', c: `· Progress bar: "Add ₹X more for ${primaryOffer || 'FREE Gift'} + Free Shipping".\n· Cross-sell: "People who bought X also got Y".\n· PREPAID50 code prominently shown at checkout page.\n· Trust badges: Secure payment + easy returns + Made in India.`, color: COLOR_AMBER },
      { t: 'MOBILE UX', c: '· 74% of traffic is mobile — design mobile-first, not desktop.\n· Page speed: Sub 3-second load. Compress all images.\n· Sticky Buy Now button in thumb-zone (bottom 30% of screen).\n· One-thumb checkout: Minimal fields, auto-fill, UPI prominent.', color: COLOR_GREEN }
    ];

    croPanels.forEach((p, i) => {
      let x = 0.5 + (i % 2) * 6.2;
      let y = 1.1 + Math.floor(i / 2) * 2.5;
      s16.addShape('rect', { x, y, w: 5.9, h: 2.3, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: p.color, width: 2 } });
      s16.addShape('rect', { x, y: y, w: 5.9, h: 0.45, fill: { color: p.color } });
      s16.addText(p.t, {x: x + 0.2, y: y + 0.1, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s16.addText(p.c, {x: x + 0.2, y: y + 0.55, w: 5.5, fontSize: 10, lineSpacing: 18, color: COLOR_DARK, fontFace: FONT_PRIMARY, valign: 'top', h: 1.6});
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
      s17.addText(k.d, {x: x + 0.2, y: y + 1.5, w: 2.5, fontSize: 10, color: '666666', fontFace: FONT_PRIMARY, valign: 'top', h: 0.8});
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
      s18.addText(c.o + '\n' + c.d, {x: x + 0.1, y: 2.0, w: 2.7, fontSize: 9, color: '666666', fontFace: FONT_PRIMARY, valign: 'top', h: 0.6});
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
    
    const attributionDataText = `Meta Ads: 40% — ${formatVal(0.40)}\nGoogle+Search: 25% — ${formatVal(0.25)}\nInfluencer: 15% — ${formatVal(0.15)}\nRetention: 15% — ${formatVal(0.15)}\nOrganic/Direct: 5% — ${formatVal(0.05)}\n\nMonthly Spend: ${stratForm['adBudget'] || '₹3,00,000'} · Blended ROAS: ${stratForm['targetROAS'] || '10'}x · Gross Margin (40%): ${formatVal(0.40)}`;
    s18.addText(attributionDataText, { x: 7.1, y: 3.5, w: 5.5, fontSize: 11, lineSpacing: 22, color: COLOR_DARK, fontFace: FONT_PRIMARY });

    // SLIDE 19: 90-Day Execution Roadmap (Light Theme)
    let s19 = pptx.addSlide();
    addHeader(s19, '90-Day Roadmap', 'Month-by-Month Execution Plan — Nothing Left to Chance');
    
    const month1PhotoText = isFitness ? '· Dark-aesthetic product photography — 6 images/SKU.' : '· Premium product photography — 6 images/SKU.';
    const month3AmbassadorText = isFitness ? `· ${bName} Athletes program: 3 ambassadors.` : `· ${bName} Brand Ambassador program: 3 ambassadors.`;

    const rdmCols = [
      { t: 'MONTH 01', st: 'FOUNDATION & LAUNCH', tar: formatVal(0.20), c: `· Shopify store audit — speed, product pages.\n· Meta Pixel + GA4 + WhatsApp API connected.\n${month1PhotoText}\n· 10 ad creatives produced (5 angles × 2 formats).\n· Google Shopping feed with SEO-optimised titles.\n· WhatsApp flows live — 8 touchpoints.\n· 15 micro influencers contacted, confirmed.`, color: COLOR_PRIMARY },
      { t: 'MONTH 02', st: 'SCALE WINNERS', tar: formatVal(0.50), c: '· Analyse Month 1 — identify top ad creatives.\n· Double budget on winning ad sets immediately.\n· Kill bottom 20% underperforming creatives.\n· 5 new creatives produced based on Month 1.\n· Remaining 10 micro influencers activated.\n· Add 1 macro creator (₹20,000 budget).\n· A/B test: Feature-led vs lifestyle creative.', color: COLOR_GREEN },
      { t: 'MONTH 03', st: 'FULL SCALE', tar: mTarget, c: `· Scale all winning channels — increase budgets.\n· Retention driving 30%+ of total monthly revenue.\n· New product drop — pre-hype via Stories + Reels.\n· Launch loyalty: Repeat buyers get early access.\n· UGC wall live on Shopify homepage.\n${month3AmbassadorText}\n· Customer referral: "Give ₹200, Get ₹200".`, color: COLOR_AMBER }
    ];

    rdmCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s19.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 5.6, fill: { color: col.color }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s19.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 0.8, fill: { color: col.color } });
      s19.addText(col.t, {x: x + 0.15, y: 1.15, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s19.addText(col.st, {x: x + 0.15, y: 1.5, fontSize: 9, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s19.addShape('rect', { x: x + 2.3, y: 1.25, w: 1.4, h: 0.5, fill: { color: 'FFFFFF' }, rectRadius: 0.05 });
      s19.addText('TARGET\n' + col.tar, {x: x + 2.3, y: 1.27, w: 1.4, align: 'center', fontSize: 10, bold: true, color: col.color, fontFace: FONT_PRIMARY, h: 0.35});

      s19.addText(col.c, {x: x + 0.2, y: 2.1, w: 3.5, fontSize: 10, lineSpacing: 18, color: COLOR_DARK, fontFace: FONT_PRIMARY, valign: 'top', h: 4.0});
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
      s20.addText(v.d, {x: x + 0.3, y: y + 0.7, w: 5.3, fontSize: 11, color: 'CCCCCC', fontFace: FONT_PRIMARY, valign: 'top', h: 1.0});
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
      ? `· Indian body fit narrative\n· Founder story hooks (${fName})\n· Tech demo videos (anti-rip, stretch)\n· UGC from micro-creators`
      : `· Brand origin narrative\n· Founder story hooks (${fName})\n· Efficacy & Ingredient highlight videos\n· UGC from micro-creators`;

    const adCols = [
      { t: comp1.toUpperCase(), c: 'AD CHANNELS\n· Meta (FB + IG) — Primary only\n· Instagram Reels — lifestyle video\n· No Google Shopping confirmed\n· No YouTube confirmed\n\nAD FORMATS\n· Identity video content\n· Brand film creatives\n· Influencer UGC cut-downs\n· Product Reels\n\nTHEIR GAP: No search intent. No YouTube. No retention ads.', color: COLOR_RED },
      { t: comp2.toUpperCase(), c: 'AD CHANNELS\n· Meta Ads (FB + IG)\n· Google Ads + Shopping\n· Additional Native Ads\n\nAD FORMATS\n· Product-first creatives\n· Sale-led ad copy always\n· Flash SALE permanent campaigns\n· No brand identity in ads\n\nTHEIR GAP: All ads are price/sale focused. Zero brand story.', color: COLOR_AMBER },
      { t: bName.toUpperCase(), c: `AD CHANNELS\n· Meta (FB+IG) — brand story angle\n· Google Shopping — product SEO\n· YouTube Pre-roll — Reel repurpose\n· WhatsApp retargeting (WATI)\n\nAD FORMATS\n${ourAdFormatText}\n\nOUR OPPORTUNITY: Own the unclaimed premium position.`, color: COLOR_PRIMARY }
    ];

    adCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s22.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 5.6, fill: { color: col.color }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s22.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 0.5, fill: { color: col.color } });
      s22.addText(col.t, {x: x + 0.15, y: 1.15, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});

      s22.addText(col.c, {x: x + 0.2, y: 1.7, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, valign: 'top', h: 4.8});
    });

    // SLIDE 23: Competitor Offer Stack (Light Theme)
    let s23 = pptx.addSlide();
    addHeader(s23, 'Competitor Intel', 'Competitor Offer Stack — The Discount Trap We Must Avoid');
    
    let compOfferStack = [];
    if (isFitness) {
      compOfferStack = [
        { t: 'FUAARK — 20+ ACTIVE CODES', c: '· GET10 — 10% off first order\n· JOGGERS15 — 15% off 2+ joggers\n· COMFY350 — ₹350 off 3+ innerwear\n· Influencer codes 10–20% off\n· ₹100 off 2 innerwear bundle\n· ₹500 off orders above ₹2,499\n· Free shipping threshold-based\n· Exchange only, no refunds policy\n· COD available (₹49 extra fee)\n· 70% off sitewide during peak seasons\n\nVERDICT FUAARK\nCheap-first positioning. Brand equity = zero.', color: COLOR_RED },
        { t: 'GYMX — SALE-FIRST MODEL', c: '· Flash SALE — Always live, up to 50% off\n· ₹399 start — Permanent low price anchor\n· 10% off code — First order (generic)\n· No bundles, no structured stacking\n· First order 10% + free shipping stacked\n· Free shipping all India (always on)\n· No influencer discount codes\n· COD available\n· No loyalty program\n· No structured offer architecture\n\nVERDICT GYMX\nDiscount-addicted. Wait-for-code training.', color: COLOR_AMBER },
        { t: `${bName.toUpperCase()} — PREMIUM OFFERS`, c: `· Free Shaker @ ₹1,499+ — Gift, no discount\n· Free Whey @ ₹2,00,000+ — High AOV incentive\n· PREPAID50 — ₹50 drives prepaid shift\n· No influencer discount codes — ever\n· 48-hour Flash Sales only (monthly)\n· TOFU: Features only, never codes\n· Bundle: Outfit sets — cross-sell, not discount\n· Early access for loyalists — reward community\n· WhatsApp recovery: Free shaker reminder\n· Full-price brand equity always protected\n\nOUR MOAT\nPremium brand positioning.`, color: COLOR_PRIMARY }
      ];
    } else {
      compOfferStack = [
        { t: `${comp1.toUpperCase()} — HEAVY DISCOUNTS`, c: '· 10-20% off sitewide codes always active\n· Welcome code stackable with other offers\n· Frequent site-wide clearance sales\n· Influencer codes widely distributed\n· Free shipping on all orders with no minimum\n· No structured AOV progress bars\n· High COD return rates due to lack of prepaid push\n\nVERDICT\nPositioning as low-price alternative. Zero margin cushion.', color: COLOR_RED },
        { t: `${comp2.toUpperCase()} — DISORGANIZED OFFERS`, c: '· Generic 10% off first purchase code\n· Unstructured seasonal sale banners\n· Free shipping threshold is inconsistent\n· No loyalty rewards or gamified incentives\n· High friction checkout experience\n· Lacks post-purchase upsell strategy\n\nVERDICT\nDiscount-addicted but poor UX execution.', color: COLOR_AMBER },
        { t: `${bName.toUpperCase()} — PREMIUM OFFERS`, c: `· ${primaryOffer || 'Free Gift @ ₹1,499+'}\n· PREPAID50 — ₹50 off to incentivize prepaid UPI\n· No permanent sitewide coupons — protect brand value\n· Curated bundles for cross-selling (15% savings)\n· Post-purchase one-click upsells active\n· Flash sales limited to 48-hour monthly windows\n· WhatsApp cart recovery sends gift triggers, not discounts\n\nOUR MOAT\nMargin-protecting premium brand positioning.`, color: COLOR_PRIMARY }
      ];
    }

    compOfferStack.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s23.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 5.6, fill: { color: col.color }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s23.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 0.5, fill: { color: col.color } });
      s23.addText(col.t, {x: x + 0.15, y: 1.15, fontSize: 11, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});

      s23.addText(col.c, {x: x + 0.2, y: 1.7, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, valign: 'top', h: 4.8});
    });

    // SLIDE 24: Recommended Tech Stack (Light Theme)
    let s24 = pptx.addSlide();
    addHeader(s24, 'Tech Stack', `${bName} Recommended Tech Stack — Tools to Install`);
    const techStack = [
      { t: 'WhatsApp Business API', amt: '₹4,000–7,000/mo', sub: 'DAY 1', desc: `WhatsApp Business API — automated order confirm, cart recovery, broadcasts.\n\n${comp1} has NO automation. ${comp2} has NO automation. Immediate advantage.`, color: COLOR_GREEN },
      { t: 'Email Automation', amt: 'Free → ₹3,500/mo', sub: 'DAY 1', desc: `Full email CRM — 5-email welcome flow, abandoned cart, post-purchase sequences.\n\nNeither ${comp1} nor ${comp2} uses email marketing actively.`, color: COLOR_PRIMARY },
      { t: 'Reviews Collector', amt: '₹1,500–2,500/mo', sub: 'DAY 1', desc: `Photo + video reviews auto-collected. Feeds Google Shopping + builds trust wall.\n\n${comp1} uses reviews. Match them. Add photo incentive for UGC advantage.`, color: COLOR_RED },
      { t: 'Push Notifications', amt: 'Free → ₹1,200/mo', sub: 'MONTH 1', desc: `Web push notifications — flash sale alerts, back-in-stock, abandoned cart.\n\nNeither competitor uses push. 15%+ CTR on engaged subscribers.`, color: COLOR_PURPLE },
      { t: 'Rebuy / AfterSell', amt: '₹2,500–4,000/mo', sub: 'MONTH 1', desc: `Post-purchase upsell page + cart upsells. "Complete the bundle" cross-sells.\n\n${comp2} has OutSell. Match + exceed with Rebuy's AI engine.`, color: COLOR_AMBER },
      { t: 'GA4 + Meta Pixel', amt: 'FREE', sub: 'DAY 1', desc: `Full attribution setup. UTM tracking on every campaign from Day 1.\n\nBoth competitors confirmed using GA4 + FB Pixel. Table stakes — must have.`, color: COLOR_DARK }
    ];

    techStack.forEach((stack, i) => {
      let x = 0.5 + (i % 3) * 4.25;
      let y = 1.1 + Math.floor(i / 3) * 2.8;
      s24.addShape('rect', { x: 0.5 + (i % 3) * 4.25, y: 1.1 + Math.floor(i / 3) * 2.8, w: 3.9, h: 2.5, fill: { color: stack.color }, rectRadius: 0.1, line: { color: stack.color, width: 2 } });
      s24.addShape('rect', { x: 0.5 + (i % 3) * 4.25, y: 1.1 + Math.floor(i / 3) * 2.8, w: 3.9, h: 0.45, fill: { color: stack.color } });
      s24.addText(stack.t, {x: x + 0.15, y: y + 0.1, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s24.addText(stack.sub, {x: x + 2.8, y: y + 0.1, w: 1.0, align: 'right', fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
      
      s24.addText(stack.amt, {x: x + 0.15, y: y + 0.55, fontSize: 10, bold: true, color: stack.color, fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s24.addText(stack.desc, {x: x + 0.15, y: y + 0.85, w: 3.6, fontSize: 9, color: COLOR_DARK, fontFace: FONT_PRIMARY, valign: 'top', h: 1.5});
    });

    s24.addShape('rect', { x: 0.5, y: 6.2, w: 12.3, h: 0.6, fill: { color: COLOR_DARK } });
    s24.addText('TOTAL ESTIMATED STACK COST: ₹12,000–18,000/month · ROI: Retention alone recovers 3–4x this cost in saved ad spend', { x: 0.7, y: 6.35, w: 11.9, fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY });

    // SLIDE 25: The Gaps They Left (Dark Theme)
    let s25 = pptx.addSlide();
    addDarkHeader(s25, 'Competitive Advantage', 'THE GAPS THEY LEFT. WE TAKE THEM ALL.');
    
    const gaps = [
      { t: 'WhatsApp Automation', d: `THEM: ${comp1} = manual · ${comp2} = broadcast only\nUS: automated flows — 8 touchpoints from Day 1\nRecover 30–40% of abandoned carts competitors lose forever`, c: COLOR_GREEN },
      { t: 'Email Marketing', d: `THEM: Neither ${comp1} nor ${comp2} runs email nurture\nUS: Klaviyo 5-email welcome flow + lifecycle sequences\nZero competition in inbox = 25–30% open rate from Day 1`, c: COLOR_PRIMARY },
      { t: 'YouTube Strategy', d: `THEM: No competitor owns YouTube SEO\nUS: 2 videos/month — size guide, feature demos, founder story\nCompound organic traffic — competitor presence is extremely low`, c: COLOR_RED },
      { t: 'Google Shopping', d: `THEM: ${comp2} runs Shopping. ${comp1} does NOT.\nUS: All SKUs with SEO-optimised titles from Day 1\nCapture purchase-intent searches competitors ignore completely`, c: COLOR_AMBER },
      { t: 'Premium Offer Design', d: 'THEM: Both brands = discount-dependent. Codes everywhere.\nUS: Gift-first strategy — gifts, bundle upsells, early access.\nHigher AOV, better margins, loyal customers who pay full price', c: COLOR_PURPLE },
      { t: 'Brand Origin Story', d: isFitness
        ? `THEM: No competitor owns the 'engineered for India' narrative\nUS: Every ad, page, and post leads with Indian body fit identity\nEmotional moat — once owned, impossible for others to steal`
        : `THEM: No competitor owns the local founder story\nUS: Every ad, page, and post leads with localized brand values\nEmotional moat — once owned, impossible for others to steal`, c: COLOR_PRIMARY }
    ];

    gaps.forEach((gap, i) => {
      let x = 0.5 + (i % 3) * 4.25;
      let y = 1.1 + Math.floor(i / 3) * 2.8;
      s25.addShape('rect', { x: 0.5 + (i % 3) * 4.25, y: 1.1 + Math.floor(i / 3) * 2.8, w: 3.9, h: 2.5, fill: { color: COLOR_DARK2 }, rectRadius: 0.1, line: { color: gap.c, width: 2 } });
      s25.addText(gap.t, {x: x + 0.15, y: y + 0.2, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});
      s25.addText(gap.d, {x: x + 0.15, y: y + 0.7, w: 3.6, fontSize: 10, lineSpacing: 18, color: 'CCCCCC', fontFace: FONT_PRIMARY, valign: 'top', h: 1.6});
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
      creativeAnglesText = `01. THE PERFORMANCE PROOF (Reel · 15s)\n"Anti-rip test. 100kg deadlift. Watch what happens."\n\n02. THE INDIAN BODY STORY (Reel · 30s)\n"International brands size you down. We size you right."\n\n03. THE DARK AESTHETIC DROP (Video · 6s)\n"New drop. No captions needed."\n\n04. THE SOCIAL PROOF WALL (Static Carousel)\n"47 people bought this today. Here's why."\n\n05. THE OFFER REVEAL (Static Image)\n"Free Shaker when you spend ₹1,499. Today only."`;
    } else {
      creativeAnglesText = `01. THE PERFORMANCE PROOF (Reel · 15s)\n"Demonstrate product efficacy and premium ingredients/materials."\n\n02. THE VALUE / PROBLEM STORY (Reel · 30s)\n"Showcase the core problem Mr./Ms. ${fName || 'Founder'} set out to solve for India."\n\n03. THE AESTHETIC DROP (Video · 6s)\n"Visual-first showcase of the product and its packaging."\n\n04. THE SOCIAL PROOF WALL (Static Carousel)\n"Real user reviews, testimonials, and rating highlights."\n\n05. THE OFFER REVEAL (Static Image)\n"${primaryOffer || 'Exclusive gift with purchase reveal.'}"`;
    }
    s26.addText(creativeAnglesText, { x: 0.7, y: 1.8, w: 5.5, fontSize: 10.5, lineSpacing: 18, color: COLOR_DARK, fontFace: FONT_PRIMARY });

    // Right Production Schedule
    s26.addShape('rect', { x: 6.9, y: 1.1, w: 5.9, h: 5.6, fill: { color: 'FFFFFF' }, rectRadius: 0.1 });
    s26.addShape('rect', { x: 6.9, y: 1.1, w: 5.9, h: 0.5, fill: { color: COLOR_PRIMARY } });
    s26.addText('MONTHLY PRODUCTION SCHEDULE', {x: 7.1, y: 1.25, fontSize: 11, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 5.70, h: 0.35});
    
    const week2AdsText = isFitness
      ? `· 1x Founder story Reel (Indian body fit narrative)\n· 1x YouTube video (size guide or feature deep-dive)\n· 1x BOFU offer static (Free Shaker reveal)`
      : `· 1x Founder story Reel (Brand origin and mission)\n· 1x YouTube video (product comparison or feature deep-dive)\n· 1x BOFU offer static (${primaryOffer || 'Free Gift'} reveal)`;
    s26.addText('WEEK 1\n· 2x Performance Proof Reels (efficacy / tech tests)\n· 2x Aesthetic statics (new product angle)\n· 1x Social Proof carousel (UGC compilation)\n\nWEEK 2\n' + week2AdsText + '\n\nWEEK 3\n· 2x Influencer UGC cuts (from micro-creator deliverables)\n· 1x Shopping search image (clean product on dark BG)\n· 1x A/B test variant of best Week 1 creative\n\nWEEK 4\n· 1x New drop teaser Reel (6-sec dark identity)\n· Review + retire bottom performer — replace with winner', {x: 7.1, y: 1.7, w: 5.5, fontSize: 10, lineSpacing: 16, color: COLOR_DARK, fontFace: FONT_PRIMARY, valign: 'top', h: 4.8});

    // SLIDE 27: Campaign Calendar (Light Theme)
    let s27 = pptx.addSlide();
    addHeader(s27, 'Campaign Calendar', 'Special Days — Apr to Jun 2026');
    
    let campaignCalendarCols = [];
    if (isFitness) {
      campaignCalendarCols = [
        { m: 'APRIL 2026', c: `Apr 7 ★ KEY\nWorld Health Day\nFitness = Health. ${bName} stands for it.\n\nApr 14 ★ KEY\nTamil New Year / Vishu\nHome market moment. Coimbatore roots.\n\nApr 22\nEarth Day\n95% Cotton story. Sustainable fabric.\n\nApr 3\nGood Friday\nLong weekend — gym shopping spike.`, color: COLOR_RED },
        { m: 'MAY 2026', c: `May 1\nLabour Day\nGrind culture. "You earn this" messaging.\n\nMay 10 ★ KEY\nMother's Day\nWomen's line push. Leggings + Sports Bras.\n\nMay 23\nBuddha Purnima\nDiscipline & focus. Mindset content angle.\n\nMay 27\nBakri Eid\nFestive buying mood. Gifting campaign.`, color: COLOR_PURPLE },
        { m: 'JUNE 2026', c: `Jun 15 ★ KEY\nFather's Day\nGifting campaign. Joggers, Tanks, Muscle Fit.\n\nJun 21 ★ KEY\nInternational Yoga Day\nBiggest fitness day in India. Max paid push.\n\nJun 21\nWorld Music Day\nWorkout playlist angle. Reel content hook.\n\nJun 17\nIslamic New Year\nInclusive content. Wide audience reach.`, color: COLOR_GREEN }
      ];
    } else {
      campaignCalendarCols = [
        { m: 'APRIL 2026', c: `Apr 7 ★ KEY\nWorld Health Day\nHealth and wellness focus related to ${indName || 'D2C'}.\n\nApr 14 ★ KEY\nTamil New Year / Vishu\nSpring season buying season. Regional campaigns.\n\nApr 22\nEarth Day\nHighlight eco-friendly packaging and ethics.\n\nApr 3\nGood Friday\nLong weekend shopping spike — boost retention.`, color: COLOR_RED },
        { m: 'MAY 2026', c: `May 1\nLabour Day\nCampaign theme: "Reward your hard work".\n\nMay 10 ★ KEY\nMother's Day\nGifting campaign targeting women. Special gift boxes.\n\nMay 23\nBuddha Purnima\nContent angle: clarity, simplicity, purity.\n\nMay 27\nBakri Eid\nFestive gifting season — run targeted WhatsApp alerts.`, color: COLOR_PURPLE },
        { m: 'JUNE 2026', c: `Jun 15 ★ KEY\nFather's Day\nMen's gifting segment push. Bundle offers.\n\nJun 21 ★ KEY\nSummer Solstice Sale\nMid-year peak shopping days. High paid ads bid.\n\nJun 21\nWorld Music Day\nCurated audio track and Reels lifestyle trend.\n\nJun 17\nIslamic New Year\nFestive greeting and early-access drop alerts.`, color: COLOR_GREEN }
      ];
    }

    campaignCalendarCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s27.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 5.0, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s27.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.1, w: 3.9, h: 0.5, fill: { color: col.color } });
      s27.addText(col.m, {x: x + 0.15, y: 1.15, fontSize: 13, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, w: 3.5, h: 0.35});

      s27.addText(col.c, {x: x + 0.2, y: 1.7, w: 3.5, fontSize: 10, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, valign: 'top', h: 4.0});
    });

    s27.addShape('rect', { x: 0.5, y: 6.2, w: 12.3, h: 0.6, fill: { color: COLOR_DARK } });
    s27.addText("★ Priority: World Health Day · Tamil New Year · Mother's Day · Father's Day · Yoga/Solstice Day — plan campaigns 2 weeks in advance", {x: 0.7, y: 6.35, w: 11.9, fontSize: 10, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

    // SLIDE 28: Brand Ambassadors (Light Theme)
    let s28 = pptx.addSlide();
    addHeader(s28, 'Brand Ambassadors', `${bName} Creator Program — Building the Cult Creator Army`);
    s28.addShape('rect', { x: 0.5, y: 1.1, w: 12.3, h: 0.5, fill: { color: COLOR_DARK } });
    s28.addText(`TARGET: 50+ creators wearing and tagging ${bName} by Month 6. Every serious creator in our space has worn and reviewed us.`, { x: 0.7, y: 1.25, w: 11.9, fontSize: 10, bold: true, color: COLOR_AMBER, fontFace: FONT_PRIMARY });

    const ambCols = [
      { t: 'PHASE 1 — MONTH 1', sub: '15 Micro-Creators', c: '· 10K–50K followers, active creators.\n· High aesthetic required — clean styling.\n· Deliverable: 1 Reel + 2 Stories + 1 Static.\n· Usage rights: 90 days for paid ads.\n· Budget: ₹3,000–4,000 per creator.\n· Track: engagement rate, saves, DM volume.', color: COLOR_PRIMARY },
      { t: 'PHASE 2 — MONTH 2', sub: '10 More Micro + 1 Macro', c: '· 10 additional micro-creators.\n· 1 macro-creator 100K–500K.\n· A/B test: scripted vs unboxing format.\n· Repurpose top 3 UGCs as paid Meta ads.\n· Brief: Bold, authentic. NO influencer codes.\n· Track: which UGC format drives highest ROAS.', color: COLOR_GREEN },
      { t: 'PHASE 3 — MONTH 3+', sub: '3 Brand Ambassadors', c: '· Select top 3 performers from Phase 1+2.\n· Long-term: 3 months minimum commitment.\n· Early access to new product drops.\n· Exclusive ambassador-only WhatsApp group.\n· Co-created content for YouTube long-form.\n· Community: Brand Ambassador identity badge.', color: COLOR_AMBER }
    ];

    ambCols.forEach((col, i) => {
      let x = 0.5 + (i * 4.25);
      s28.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.85, w: 3.9, h: 4.8, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: col.color, width: 2 } });
      s28.addShape('rect', { x: 0.5 + (i * 4.25), y: 1.85, w: 3.9, h: 0.8, fill: { color: col.color } });
      s28.addText(col.t, {x: x + 0.15, y: 1.9, w: 3.6, fontSize: 12, bold: true, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});
      s28.addText(col.sub, {x: x + 0.15, y: 2.25, w: 3.6, fontSize: 10, color: 'FFFFFF', fontFace: FONT_PRIMARY, h: 0.35});

      s28.addText(col.c, {x: x + 0.2, y: 2.8, w: 3.5, fontSize: 10.5, lineSpacing: 18, color: COLOR_DARK, fontFace: FONT_PRIMARY, valign: 'top', h: 3.5});
    });

    // SLIDE 29: AI Content Pillars (Light Theme)
    let s29 = pptx.addSlide();
    addHeader(s29, 'AI Content Pillars', '8 AI-Generated Pillars — Content Marketing Blueprint');
    const pillars = d.pillars || [];
    pillars.slice(0, 8).forEach((p, idx) => {
      let x = 0.5 + (idx % 4) * 3.1;
      let y = 1.1 + Math.floor(idx / 4) * 2.8;
      s29.addShape('rect', { x, y, w: 2.9, h: 2.5, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_PRIMARY, width: 2 } });
      const pTitle = ensureString(p.title) || `Pillar ${idx + 1}`;
      const pDesc = ensureString(p.description);
      s29.addText(pTitle, { x: x + 0.15, y: y + 0.15, fontSize: 11, bold: true, color: COLOR_PRIMARY, fontFace: FONT_PRIMARY, w: 2.6, h: 0.35 });
      s29.addText(pDesc, { x: x + 0.15, y: y + 0.6, fontSize: 9.5, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 2.6, h: 1.7 });
    });

    // SLIDE 30: AI Sales Angles (Light Theme)
    let s30 = pptx.addSlide();
    addHeader(s30, 'AI Sales Angles', '6 AI-Generated Sales Angles — Creative Conversion Angles');
    const angles = d.angles || [];
    angles.slice(0, 6).forEach((a, idx) => {
      let x = 0.5 + (idx % 3) * 4.25;
      let y = 1.1 + Math.floor(idx / 3) * 2.8;
      s30.addShape('rect', { x, y: 1.1 + Math.floor(idx / 3) * 2.8, w: 3.9, h: 2.5, fill: { color: 'FFFFFF' }, rectRadius: 0.1, line: { color: COLOR_AMBER, width: 2 } });
      const aHead = ensureString(a.headline) || `Angle ${idx + 1}`;
      const aBody = ensureString(a.body);
      const aCta = ensureString(a.cta) || 'Shop Now';
      s30.addText(aHead, { x: x + 0.2, y: y + 0.15, fontSize: 11, bold: true, color: COLOR_AMBER, fontFace: FONT_PRIMARY, w: 3.5, h: 0.35 });
      s30.addText(aBody, { x: x + 0.2, y: y + 0.6, fontSize: 9.5, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 3.5, h: 1.4 });
      s30.addText(`CTA: ${aCta}`, { x: x + 0.2, y: y + 2.0, fontSize: 9, bold: true, color: COLOR_DARK, fontFace: FONT_PRIMARY, w: 3.5, h: 0.3 });
    });

    // 3. Trigger Download
    await pptx.writeFile({ fileName: `Strategy_${activeBrand.name}_${new Date().toISOString().split('T')[0]}.pptx` });
    
    document.getElementById('gen-status').textContent = 'Presentation Generated!';
    document.getElementById('gen-done').style.display = '';

  } catch (err) {
    console.error(err);
    document.getElementById('gen-error').textContent = '⚠ ' + err.message;
    document.getElementById('gen-error').style.display = '';
    document.getElementById('gen-status').textContent = 'Generation Failed';
  }
}

// ─── PRICING CALCULATOR ──────────────────────────────────────────────────────
function cleanPrice(r) {
  for (const p of CLEAN_PRICES) if (p >= r) return p;
  return Math.ceil(r / 100) * 100 - 1;
}

function migrateOrGetGlobals(globalsJson) {
  if (globalsJson && Array.isArray(globalsJson.components)) {
    return globalsJson;
  }
  return {
    components: [],
    target_margin: 15
  };
}

const DEFAULT_STAGING_GLOBALS = {
  components: [],
  target_margin: 15
};

function calcVariant(v, p, globals) {
  const mfgPc = (v.mfgO != null) ? parseFloat(v.mfgO) : (parseFloat(p.mfg_per_pc) || 0);
  const qty   = p.variant_type === 'bundle' ? (v.qty || 1) : 1;
  const mfgCost = mfgPc * qty;

  const packCost = v.packO != null ? parseFloat(v.packO) : 20;
  const shipCost = v.shipO != null ? parseFloat(v.shipO) : 70;

  // Extra Column Charges (Flat or Percentage of Mfg cost)
  let extraCost = 0;
  (p.extras || []).forEach(e => {
    let valStr = (v.extraO && v.extraO[e.label] != null) ? String(v.extraO[e.label]) : String(e.amount || '0');
    valStr = valStr.trim();
    if (valStr.endsWith('%')) {
      const pct = parseFloat(valStr) || 0;
      extraCost += mfgCost * (pct / 100);
    } else {
      extraCost += parseFloat(valStr) || 0;
    }
  });

  const baseCost = mfgCost + packCost + shipCost + extraCost;

  const rtoRate = v.rtoO != null ? parseFloat(v.rtoO) : 15;
  const multiplier = 1 + rtoRate / 100;
  const adjBaseCost = baseCost * multiplier;

  const taxRate = v.taxO != null ? parseFloat(v.taxO) : 18;
  const pgRate = v.pgO != null ? parseFloat(v.pgO) : 2;
  const totalVarPct = (taxRate + pgRate) / 100;

  const targetRoas = v.beRoasO != null ? parseFloat(v.beRoasO) : 3.0;

  let selling = 0;
  let beRoas = 0;

  if (v.sellingO != null) {
    // Case A: User overrides Selling Price
    selling = parseFloat(v.sellingO);
    const contributionMargin = selling * (1 - totalVarPct) - adjBaseCost;
    beRoas = contributionMargin > 0 ? selling / contributionMargin : 99.9;
  } else {
    // Case B: User specifies target ROAS
    const denom = targetRoas * (1 - totalVarPct) - 1;
    const safeDenom = Math.max(0.05, denom);
    const suggestedSelling = (targetRoas * adjBaseCost) / safeDenom;
    selling = cleanPrice(suggestedSelling);
    beRoas = targetRoas;
  }

  // Effective Cost including ad spend
  const adSpend = beRoas > 0 ? selling / beRoas : 0;
  const taxCost = (selling * taxRate) / 100;
  const pgCost = (selling * pgRate) / 100;
  const totalCost = adjBaseCost + taxCost + pgCost + adSpend;

  const comp = v.compO != null ? parseFloat(v.compO) : cleanPrice(selling * 1.5);

  return {
    baseCost,
    multiplier,
    adjC: adjBaseCost,
    effC: totalCost,
    effS: selling,
    selling,
    comp,
    roas: beRoas,
    adSpend,
    pgCost,
    taxCost,
    taxRate,
    pgRate,
    rtoRate,
    shipCost
  };
}

function gv(id) { return parseFloat(document.getElementById(id)?.value) || 0; }
function getGlobals() {
  return {
    brand:gv('g-brand'), photo:gv('g-photo'), pack:gv('g-pack'),
    ship:gv('g-ship'),   ops:gv('g-ops'),     gw:gv('g-gw'),
    rto:gv('g-rto'),     roas:gv('g-roas'),
    cod_rate:gv('g-cod-rate'), cod_fee:gv('g-cod-fee'), pg_fee:gv('g-pg-fee'),
    discType: document.getElementById('g-disc-type')?.value || 'pct',
    disc:gv('g-disc'),
    extra_charges: globalExtras
  };
}

function renderPricingBrands() {
  const grid = document.getElementById('brand-grid');
  if (!allBrands.length) {
    grid.innerHTML = '<div class="empty"><div class="empty-icon">🏷</div><div class="empty-title">No brands available</div><div class="empty-sub">Ask your admin to create or assign brands</div></div>';
    return;
  }
  grid.innerHTML = allBrands.map(b => `
    <div class="brand-card" onclick="openBrandCalc('${b.id}')">
      <div class="bc-icon">🏷</div>
      <div class="bc-name">${b.name}</div>
      <div class="bc-meta">${b.industry || '—'}</div>
      <div class="bc-stats">
        <div><div class="bc-sv">${b.product_count || 0}</div><div class="bc-sl">Products</div></div>
        <div style="margin-left:10px"><div class="bc-sv">${b.generation_count || 0}</div><div class="bc-sl">Strategies</div></div>
      </div>
    </div>`).join('');
}

function openBrandCalc(id) {
  const b = allBrands.find(b => b.id === id); if (!b) return;
  activeBrand = b; updateBrandUI();
  document.getElementById('calc-brand-name').textContent = b.name;
  document.getElementById('calc-brand-meta').textContent = (b.industry || '') + ' · Pricing Calculator';
  loadBrandProducts();
  document.getElementById('pricing-brands-view').style.display = 'none';
  document.getElementById('pricing-calc-view').style.display = 'block';
}

function backToBrands() {
  document.getElementById('pricing-brands-view').style.display = '';
  document.getElementById('pricing-calc-view').style.display = 'none';
}

let serverProds = null;

async function loadBrandProducts() {
  if (!activeBrand) return;
  const r = await api(`/api/pricing/${activeBrand.slug}/products`);
  if (!r) return;

  // Process server-loaded products
  serverProds = (r.products || []).map(p => {
    const extras = Array.isArray(p.extras_json) ? p.extras_json : [];
    const globals = migrateOrGetGlobals(p.globals_json);
    const tempP = { ...p, extras, globals };
    return {
      ...p,
      extras,
      globals,
      variants: Array.isArray(p.variants_json) ? p.variants_json.map(v => {
        const calc = calcVariant({ ...v, sellingO: null, compO: null }, tempP, globals);
        const isSellingCalc = v.selling == null || parseFloat(v.selling) === calc.selling;
        const isCompCalc = v.comp == null || parseFloat(v.comp) === calc.comp;
        return {
          ...v,
          sellingO: isSellingCalc ? null : (v.sellingO != null ? parseFloat(v.sellingO) : null),
          compO: isCompCalc ? null : (v.compO != null ? parseFloat(v.compO) : null)
        };
      }) : []
    };
  });

  // Check for unsaved local draft
  const draftKey = 'digifyce_pricing_draft_' + activeBrand.id;
  const draftStr = localStorage.getItem(draftKey);
  let hasDraft = false;
  let draftData = null;
  if (draftStr) {
    try {
      draftData = JSON.parse(draftStr);
      if (draftData && draftData.unsaved && Array.isArray(draftData.products)) {
        hasDraft = true;
      }
    } catch (_) {}
  }

  if (hasDraft) {
    prods = draftData.products;
    document.getElementById('pricing-draft-banner').style.display = 'flex';
  } else {
    prods = JSON.parse(JSON.stringify(serverProds));
    document.getElementById('pricing-draft-banner').style.display = 'none';
  }

  // Show Sync Now button for managers+
  const syncBtn = document.getElementById('pricing-sync-btn');
  if (syncBtn) syncBtn.style.display = (CU.role !== 'user') ? 'inline-block' : 'none';

  renderAll();
}

function renderAll() {
  if (!activeBrand) return;
  const canEdit = CU.role !== 'user';
  let totalVars = 0, totalROAS = 0;

  document.getElementById('products-container').innerHTML = prods.map(p => {
    // Ensure product globals are initialized
    p.globals = migrateOrGetGlobals(p.globals_json);

    const extrasList = p.extras || [];
    const extraHeadersHtml = extrasList.map(e => `
      <th style="background:#fff3bf;color:#495057;border-bottom:1px solid #ffe066">
        <div style="display:flex;align-items:center;justify-content:center;gap:4px">
          <span>${e.label}</span>
          ${canEdit ? `<button onclick="removeProductExtra('${p.id}', '${e.label}')" style="border:none;background:transparent;color:var(--red);cursor:pointer;padding:0 2px;font-size:10px;font-weight:800;line-height:1" title="Delete Column">✕</button>` : ''}
        </div>
      </th>
    `).join('');

    const tableHeaders = `<tr>
      <th>Variant</th>
      <th>Mfg/pc</th>
      <th>Pack/pc</th>
      <th>Shipping</th>
      ${extraHeadersHtml}
      <th>Base Cost</th>
      <th>RTO %</th>
      <th>Multiplier</th>
      <th>Adj Cost</th>
      <th>Tax %</th>
      <th>PG Fee %</th>
      <th>Breakeven ROAS</th>
      <th>Selling Price</th>
      <th>Comp</th>
      ${canEdit?'<th></th>':''}
    </tr>`;

    let rows = (p.variants || []).map(v => {
      const r = calcVariant(v, p, p.globals);
      totalVars++; totalROAS += r.roas;
      
      const mfgInput = canEdit
        ? `<input type="text" inputmode="decimal" value="${v.mfgO != null ? v.mfgO : p.mfg_per_pc}" style="width:55px;${v.mfgO != null ? 'border-color:var(--primary)' : ''}" oninput="this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\\..*?)\\..*/g, '$1')" onchange="setVF('${p.id}','${v.id}','mfgO',this.value)">`
        : `<span style="font-family:var(--fm)">₹${v.mfgO != null ? v.mfgO : p.mfg_per_pc}</span>`;

      const packInput = canEdit
        ? `<input type="text" inputmode="decimal" value="${v.packO != null ? v.packO : 20}" style="width:45px;${v.packO != null ? 'border-color:var(--primary)' : ''}" oninput="this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\\..*?)\\..*/g, '$1')" onchange="setVF('${p.id}','${v.id}','packO',this.value)">`
        : `<span style="font-family:var(--fm)">₹${v.packO != null ? v.packO : 20}</span>`;

      const shipInput = canEdit
        ? `<td><input type="text" inputmode="decimal" value="${v.shipO != null ? v.shipO : 70}" style="width:45px;${v.shipO != null ? 'border-color:var(--primary)' : ''}" oninput="this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\\..*?)\\..*/g, '$1')" onchange="setVF('${p.id}','${v.id}','shipO',this.value)"></td>`
        : `<td><span style="font-family:var(--fm)">₹${v.shipO != null ? v.shipO : 70}</span></td>`;

      const extraCells = extrasList.map(e => {
        const val = (v.extraO && v.extraO[e.label] != null) ? v.extraO[e.label] : e.amount;
        return canEdit
          ? `<td><input type="text" value="${val}" style="width:50px;${v.extraO && v.extraO[e.label] != null ? 'border-color:var(--primary)' : ''}" onchange="setVariantExtraOverride('${p.id}','${v.id}','${e.label}',this.value)"></td>`
          : `<td><span style="font-family:var(--fm)">${val}</span></td>`;
      }).join('');

      const baseCostHtml = `<td style="font-family:var(--fm);color:var(--mid)">₹${r.baseCost.toFixed(0)}</td>`;

      const rtoInput = canEdit
        ? `<td><input type="text" inputmode="decimal" value="${v.rtoO != null ? v.rtoO : 15}" style="width:45px;${v.rtoO != null ? 'border-color:var(--primary)' : ''}" oninput="this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\\..*?)\\..*/g, '$1')" onchange="setVF('${p.id}','${v.id}','rtoO',this.value)"></td>`
        : `<td><span style="font-family:var(--fm)">${v.rtoO != null ? v.rtoO : 15}%</span></td>`;

      const multiplierHtml = `<td style="font-family:var(--fm);color:var(--mid)">${r.multiplier.toFixed(2)}x</td>`;
      const adjCostHtml = `<td style="font-family:var(--fm);color:var(--mid);font-weight:600">₹${r.adjC.toFixed(0)}</td>`;

      const taxInput = canEdit
        ? `<td><input type="text" inputmode="decimal" value="${v.taxO != null ? v.taxO : 18}" style="width:45px;${v.taxO != null ? 'border-color:var(--primary)' : ''}" oninput="this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\\..*?)\\..*/g, '$1')" onchange="setVF('${p.id}','${v.id}','taxO',this.value)"></td>`
        : `<td><span style="font-family:var(--fm)">${v.taxO != null ? v.taxO : 18}%</span></td>`;

      const pgInput = canEdit
        ? `<td><input type="text" inputmode="decimal" value="${v.pgO != null ? v.pgO : 2}" style="width:45px;${v.pgO != null ? 'border-color:var(--primary)' : ''}" oninput="this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\\..*?)\\..*/g, '$1')" onchange="setVF('${p.id}','${v.id}','pgO',this.value)"></td>`
        : `<td><span style="font-family:var(--fm)">${v.pgO != null ? v.pgO : 2}%</span></td>`;

      const targetRoas = v.beRoasO != null ? parseFloat(v.beRoasO) : 3.0;
      const roasValToShow = v.sellingO != null ? r.roas.toFixed(2) : (v.beRoasO != null ? v.beRoasO : targetRoas.toFixed(1));
      const roasInput = canEdit
        ? `<td><input type="text" inputmode="decimal" value="${roasValToShow}" style="width:45px;${v.sellingO != null ? 'background:#e6fcf5;border-color:var(--green);font-weight:600' : (v.beRoasO != null ? 'border-color:var(--primary)' : '')}" oninput="this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\\..*?)\\..*/g, '$1')" onchange="setVF('${p.id}','${v.id}','beRoasO',this.value)" title="${v.sellingO != null ? 'Calculated Breakeven ROAS (Selling Price is fixed)' : 'Target ROAS (Selling Price is auto-calculated)'}"></td>`
        : `<td><span style="font-family:var(--fm)">${r.roas.toFixed(2)}x</span></td>`;

      const sellingInput = canEdit
        ? `<input type="text" inputmode="decimal" value="${v.sellingO != null ? v.sellingO : r.selling}" style="width:55px;${v.sellingO != null ? 'border-color:var(--primary);font-weight:600' : 'background:#f1f3f5;color:var(--mid)'}" oninput="this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\\..*?)\\..*/g, '$1')" onchange="setVF('${p.id}','${v.id}','sellingO',this.value)" title="${v.sellingO != null ? 'Fixed Selling Price' : 'Suggested Selling Price (Target ROAS is fixed)'}">`
        : `<span style="font-family:var(--fm);font-weight:600">₹${r.selling.toLocaleString('en-IN')}</span>`;

      const compInput = canEdit
        ? `<input type="text" inputmode="decimal" value="${v.compO != null ? v.compO : r.comp.toFixed(0)}" style="width:55px;${v.compO != null ? 'border-color:var(--primary)' : ''}" oninput="this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\\..*?)\\..*/g, '$1')" onchange="setVF('${p.id}','${v.id}','compO',this.value)">`
        : `<span style="font-family:var(--fm);color:var(--mid)">₹${r.comp.toLocaleString('en-IN')}</span>`;

      return `<tr>
        <td>${canEdit ? `<input value="${v.name||''}" style="width:85px" onchange="setVF('${p.id}','${v.id}','name',this.value)">` : `<span style="font-family:var(--fm)">${v.name}</span>`}</td>
        <td>${mfgInput}</td>
        <td>${packInput}</td>
        ${shipInput}
        ${extraCells}
        ${baseCostHtml}
        ${rtoInput}
        ${multiplierHtml}
        ${adjCostHtml}
        ${taxInput}
        ${pgInput}
        ${roasInput}
        <td>${sellingInput}</td>
        <td>${compInput}</td>
        ${canEdit ? `<td>
          <button class="btn sm" onclick="openVariantHistory('${activeBrand.id}','${p.id}','${v.id}','${v.name}')" style="padding:4px 6px;font-size:11px;margin-right:2px;background:none;border:1px solid var(--border)" title="History">🕒</button>
          <button class="btn sm danger" onclick="removeVariant('${p.id}','${v.id}')">✕</button>
        </td>` : ''}
      </tr>`;
    }).join('');


    return `<div class="prod-block" style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px">
      <div class="prod-hd" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        ${canEdit ? `<input class="prod-name-inp" value="${p.name}" onchange="setProdName('${p.id}',this.value)" style="font-weight:800;font-size:14px;border:none;border-bottom:1px dashed var(--border);outline:none;background:transparent;padding:2px 4px">` : `<div class="prod-name-inp" style="pointer-events:none;font-weight:800;font-size:14px">${p.name}</div>`}
        <div style="display:flex;align-items:center;gap:6px">
          ${canEdit ? `<button class="btn sm danger" onclick="removeProduct('${p.id}')" style="padding:4px 8px;font-size:11px">✕ Remove</button>` : ''}
        </div>
      </div>

      <div style="overflow-x:auto"><table class="vtable">
        <thead>${tableHeaders}</thead>
        <tbody>${rows}</tbody>
      </table></div>
      
      ${canEdit ? `<div style="margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="btn sm" onclick="addVariant('${p.id}')" style="padding:6px 12px;font-size:11px">+ Add Variant</button>
        <span style="color:var(--border)">|</span>
        <span style="font-size:11px;font-weight:600;color:var(--mid)">Add Extra Column:</span>
        <input type="text" id="new-ex-name-${p.id}" placeholder="Column Name (e.g. Printing)" style="height:28px;font-size:11px;border:1px solid var(--border);border-radius:6px;padding:0 8px;outline:none;width:160px">
        <input type="text" id="new-ex-val-${p.id}" placeholder="Default (e.g. 10% or 15)" style="height:28px;font-size:11px;border:1px solid var(--border);border-radius:6px;padding:0 8px;outline:none;width:150px">
        <button class="btn sm primary" onclick="addProductExtraInline('${p.id}')" style="height:28px;padding:0 12px;font-size:11px;font-weight:600">+ Add Column</button>
      </div>` : ''}
    </div>`;
  }).join('');

  document.getElementById('sum-prods').textContent = prods.length;
  document.getElementById('sum-vars').textContent = totalVars;
  const avgR = totalVars ? totalROAS / totalVars : 0;
  document.getElementById('sum-roas').textContent = avgR.toFixed(1) + 'x';
}

function updateProductTargetMargin(pid, val) {
  const p = prods.find(p => p.id === pid);
  if (p) {
    if (!p.globals) p.globals = { components: [], target_margin: 0 };
    p.globals.target_margin = parseFloat(val) || 0;
    renderAll();
    deferPricingSave();
  }
}

function updateComponentField(pid, cid, field, val) {
  const p = prods.find(p => p.id === pid);
  if (p && p.globals && p.globals.components) {
    const c = p.globals.components.find(c => c.id === cid);
    if (c) {
      if (field === 'value') c[field] = parseFloat(val) || 0;
      else c[field] = val;
      renderAll();
      deferPricingSave();
    }
  }
}

function removeProductComponent(pid, cid) {
  const p = prods.find(p => p.id === pid);
  if (p && p.globals && p.globals.components) {
    p.globals.components = p.globals.components.filter(c => c.id !== cid);
    renderAll();
    deferPricingSave();
  }
}

function addProductComponent(pid) {
  const p = prods.find(p => p.id === pid);
  if (!p) return;
  if (!p.globals) p.globals = { components: [], target_margin: 0 };
  if (!p.globals.components) p.globals.components = [];

  const nameEl = document.getElementById(`new-c-name-${pid}`);
  const appliesEl = document.getElementById(`new-c-applies-${pid}`);
  const typeEl = document.getElementById(`new-c-type-${pid}`);
  const valEl = document.getElementById(`new-c-val-${pid}`);

  const name = nameEl?.value.trim() || 'Custom Cost';
  const applies_to = appliesEl?.value || 'fixed';
  const type = typeEl?.value || 'flat';
  const value = parseFloat(valEl?.value) || 0;

  p.globals.components.push({
    id: 'c_' + Date.now() + Math.random().toString(36).substr(2, 5),
    name,
    applies_to,
    type,
    value
  });

  if (nameEl) nameEl.value = '';
  if (valEl) valEl.value = '';

  renderAll();
  deferPricingSave();
}

function setVF(pid, vid, k, val) {
  const p = prods.find(p => p.id === pid); if (!p) return;
  const v = p.variants.find(v => v.id === vid); if (!v) return;
  if (k === 'beRoasO') {
    v.beRoasO = val === '' ? null : parseFloat(val) || 0;
    v.sellingO = null; // Clear selling override so price recalculates from target ROAS
  } else if (k === 'sellingO') {
    v.sellingO = val === '' ? null : parseFloat(val) || 0;
    v.beRoasO = null; // Clear ROAS override so ROAS recalculates from selling price
  } else if (k === 'mfgO' || k === 'packO' || k === 'shipO' || k === 'compO' || k === 'rtoO' || k === 'taxO' || k === 'pgO') {
    v[k] = val === '' ? null : parseFloat(val) || 0;
    v.sellingO = null; // Clear selling override so price recalculates from target ROAS
  } else {
    v[k] = val;
  }
  renderAll(); deferPricingSave();
}
function setProdName(pid, name) { const p = prods.find(p => p.id === pid); if (p) p.name = name; deferPricingSave(); }
function addVariant(pid) {
  const p = prods.find(p => p.id === pid); if (!p) return;
  p.variants.push({ id: 'v' + Date.now(), name: 'New Variant', qty: 1, mfgO: null, packO: null, compO: null });
  renderAll(); deferPricingSave();
}
function removeVariant(pid, vid) {
  const p = prods.find(p => p.id === pid); if (!p) return;
  p.variants = p.variants.filter(v => v.id !== vid);
  renderAll(); deferPricingSave();
}
function addProduct() {
  prods.push({
    id: 'p' + Date.now(),
    name: 'New Product',
    mfg_per_pc: 0,
    variant_type: 'single',
    extras: [],
    globals: JSON.parse(JSON.stringify(DEFAULT_STAGING_GLOBALS)),
    variants: [{ id: 'v' + Date.now(), name: 'Default', qty: 1, mfgO: null, compO: null }]
  });
  renderAll();
  deferPricingSave();
}
function removeProduct(pid) { prods = prods.filter(p => p.id !== pid); renderAll(); deferPricingSave(); }
function addProductExtraInline(pid) {
  const p = prods.find(p => p.id === pid);
  if (!p) return;
  if (!p.extras) p.extras = [];

  const nameEl = document.getElementById(`new-ex-name-${pid}`);
  const valEl = document.getElementById(`new-ex-val-${pid}`);

  const label = nameEl?.value.trim() || 'Custom Extra';
  const amount = valEl?.value.trim() || '0';

  // Prevent duplicate names
  if (p.extras.some(e => e.label.toLowerCase() === label.toLowerCase())) {
    showToast('An extra column with this name already exists!', 'error');
    return;
  }

  p.extras.push({ label, amount });

  if (nameEl) nameEl.value = '';
  if (valEl) valEl.value = '';

  renderAll();
  deferPricingSave();
}

function updateProductExtraAmount(pid, label, val) {
  const p = prods.find(p => p.id === pid);
  if (p && p.extras) {
    const e = p.extras.find(x => x.label === label);
    if (e) {
      e.amount = parseFloat(val) || 0;
      renderAll();
      deferPricingSave();
    }
  }
}

function removeProductExtra(pid, label) {
  const p = prods.find(p => p.id === pid);
  if (p && p.extras) {
    p.extras = p.extras.filter(x => x.label !== label);
    (p.variants || []).forEach(v => {
      if (v.extraO) delete v.extraO[label];
    });
    renderAll();
    deferPricingSave();
  }
}

function setVariantExtraOverride(pid, vid, label, val) {
  const p = prods.find(p => p.id === pid); if (!p) return;
  const v = p.variants.find(v => v.id === vid); if (!v) return;
  if (!v.extraO) v.extraO = {};
  if (val === '') {
    delete v.extraO[label];
  } else {
    v.extraO[label] = val; // Store string directly to support % suffix!
  }
  v.sellingO = null; // Clear selling override so price recalculates from target ROAS
  renderAll();
  deferPricingSave();
}
async function deleteBrand(slug, name) {
  if (!confirm(`Delete brand "${name}"?\n\nThis will permanently remove all budget months, daily data, and pricing data for this brand. Reports are kept.\n\nThis cannot be undone.`)) return;
  const r = await api(`/api/brands/${slug}`, 'DELETE');
  if (!r || !r.ok) return showToast(r?.error || 'Failed to delete brand (you may need superadmin access)', 'error');
  allBrands = allBrands.filter(b => b.slug !== slug);
  showToast(`Brand "${name}" deleted`, 'success');
  renderAdminBrands();
  renderPricingBrands();
  renderDashboard();
}
function deferSaveAndRender() { renderAll(); deferPricingSave(); }
function toggleGlobals() {}
function renderGlobalExtrasList() {}

function deferPricingSave() {
  if (!activeBrand) return;

  // Save to localStorage immediately
  const draftKey = 'digifyce_pricing_draft_' + activeBrand.id;
  localStorage.setItem(draftKey, JSON.stringify({
    products: prods,
    timestamp: Date.now(),
    unsaved: true
  }));

  const chip = document.getElementById('save-chip');
  if (chip) {
    chip.style.display = 'inline-flex';
    chip.textContent = '● Saving...';
    chip.className = 'chip saving';
  }
  clearTimeout(pricingSaveTimer);
  pricingSaveTimer = setTimeout(() => executePricingSave(chip), 1500);
}

async function executePricingSave(chip) {
  if (!activeBrand) return false;
  const prodsToSave = prods.map(p => ({
    ...p,
    variants_json: (p.variants || []).map(v => {
      const calc = calcVariant(v, p, p.globals);
      return {
        ...v,
        sellingO:  v.sellingO  != null ? parseFloat(v.sellingO)  : null,
        packO:     v.packO     != null ? parseFloat(v.packO)     : null,
        selling:   calc.selling,
        comp:      v.compO != null ? parseFloat(v.compO) : calc.comp,
        compO:     v.compO != null ? parseFloat(v.compO) : null,
        adjC:      calc.adjC,
        margin:    calc.margin,
        profit:    calc.grossProfit,
        netProfit: calc.netProfit,
        netMargin: calc.netMargin,
        roas:      calc.roas,
      };
    }),
    globals_json: p.globals || {},
    extras_json: p.extras || [],
  }));

  try {
    await api(`/api/pricing/${activeBrand.slug}/products`, 'PUT', { products: prodsToSave, globals: {} });
    
    // Clear unsaved flag in localStorage
    const draftKey = 'digifyce_pricing_draft_' + activeBrand.id;
    localStorage.setItem(draftKey, JSON.stringify({
      products: prods,
      timestamp: Date.now(),
      unsaved: false
    }));

    if (chip) {
      chip.textContent = '✓ Saved to Server';
      chip.className = 'chip save';
    }
    return true;
  } catch (err) {
    console.error('Pricing save failed:', err);
    if (chip) {
      chip.textContent = '⚠️ Offline (Saved Locally)';
      chip.className = 'chip warn';
    }
    return false;
  }
}

async function savePricingNow() {
  if (!activeBrand) return showToast('No brand selected', 'error');
  const chip = document.getElementById('save-chip');
  if (chip) {
    chip.style.display = 'inline-flex';
    chip.textContent = '● Saving...';
    chip.className = 'chip saving';
  }
  clearTimeout(pricingSaveTimer);
  const ok = await executePricingSave(chip);
  if (ok) {
    showToast('Pricing saved successfully! Catalogue updated.', 'success');
  } else {
    showToast('Offline - Changes saved locally on your browser.', 'warning');
  }
}

function restorePricingDraft() {
  if (!activeBrand) return;
  const draftKey = 'digifyce_pricing_draft_' + activeBrand.id;
  const draftStr = localStorage.getItem(draftKey);
  if (draftStr) {
    try {
      const draftData = JSON.parse(draftStr);
      prods = draftData.products;
    } catch (_) {}
  }
  document.getElementById('pricing-draft-banner').style.display = 'none';
  renderAll();
  deferPricingSave();
}

function discardPricingDraft() {
  if (!activeBrand) return;
  const draftKey = 'digifyce_pricing_draft_' + activeBrand.id;
  localStorage.removeItem(draftKey);
  prods = JSON.parse(JSON.stringify(serverProds || []));
  document.getElementById('pricing-draft-banner').style.display = 'none';
  renderAll();
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : type === 'error' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #f59e0b, #d97706)';
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.style.cssText = `pointer-events:auto;display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:10px;background:${bgColor};color:#fff;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.15);transform:translateX(120%);transition:transform 0.35s cubic-bezier(0.4,0,0.2,1),opacity 0.35s;font-family:var(--ff),sans-serif;max-width:380px`;
  toast.innerHTML = `<span style="font-size:16px;line-height:1">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

function exportExcel() {
  if (!activeBrand || !prods.length) return alert('No products to export');
  const data = [];
  // Build header
  data.push(['Product Name', 'Variant', 'Qty', 'Selling Price', 'Adj Cost', 'Gross Profit', 'Gross Margin %', 'Net Profit (After Ads)', 'Net Margin %']);

  const globals = getGlobals();
  prods.forEach(p => {
    p.variants.forEach(v => {
      const res = calcVariant(v, p, globals);
      data.push([p.name, v.name, v.qty, res.selling, res.adjC.toFixed(0), res.grossProfit.toFixed(0), (res.margin * 100).toFixed(1), res.netProfit.toFixed(0), (res.netMargin * 100).toFixed(1)]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pricing");
  XLSX.writeFile(wb, `${activeBrand.name}_Pricing.xlsx`);
}

// ─── BRAND MANAGEMENT ────────────────────────────────────────────────────────
function openNewBrand() { document.getElementById('mo-new-brand').style.display = 'flex'; }
async function submitNewBrand() {
  const name     = document.getElementById('nb-name').value.trim();
  const industry = document.getElementById('nb-industry').value.trim();
  const platform = document.getElementById('nb-platform').value.trim();
  const channelsRaw = document.getElementById('nb-channels').value.trim();
  
  if (!name) return alert('Brand name is required');
  
  // Parse comma separated string to JSON array
  let channels_config = ['meta', 'google'];
  if (channelsRaw) {
    channels_config = channelsRaw.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
  }
  
  const r = await api('/api/brands', 'POST', { name, industry, platform, channels_config });
  if (!r || !r.ok) return alert(r?.error || 'Failed to create brand');
  closeMo('mo-new-brand');
  document.getElementById('nb-name').value = '';
  document.getElementById('nb-industry').value = '';
  document.getElementById('nb-platform').value = '';
  document.getElementById('nb-channels').value = 'meta, google';
  const brands = await api('/api/brands');
  if (brands) allBrands = brands;
  renderPricingBrands();
  renderDashboard();
}

async function renderAdminBrands() {
  const tbody = document.getElementById('admin-brands-tbody');
  if (!tbody) return;
  const brands = await api('/api/brands');
  if (!brands) return;
  if (!brands.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--mid);padding:24px">No brands found</td></tr>';
    return;
  }
  tbody.innerHTML = brands.map(b => {
    const channels = (() => { try { return JSON.parse(b.channels_config || '[]').join(', '); } catch(e) { return '—'; } })();
    return `<tr>
      <td><div style="font-weight:700;color:var(--dark)">${b.name}</div><div style="font-size:10px;color:var(--mid);font-family:var(--fm)">${b.slug}</div></td>
      <td>${b.industry || '—'}</td>
      <td>${b.platform || '—'}</td>
      <td style="font-family:var(--fm);font-weight:600">${b.product_count || 0}</td>
      <td style="font-size:11px;color:var(--mid)">${channels}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn sm secondary" onclick="editBrandIntegrations('${b.slug}')">⚙ Integrations</button>
          <button class="btn sm danger" onclick="deleteBrand('${b.slug}','${b.name.replace(/'/g,"\\'")}')">🗑 Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── ADMIN ───────────────────────────────────────────────────────────────────
async function renderAdmin() {
  setAdminTab('users');
  const users = await api('/api/admin/users');
  if (!users) return;

  // Populate brand dropdown in add user modal
  const sel = document.getElementById('nu-brands');
  if (sel) {
    sel.innerHTML = '<option value="*">All Brands</option>' +
      allBrands.map(b => `<option value="${b.slug}">${b.name}</option>`).join('');
  }

  document.getElementById('users-tbody').innerHTML = users.map(u => `
    <tr>
      <td style="font-weight:600;color:var(--dark)">${u.name}</td>
      <td style="font-family:var(--fm);font-size:12px;color:var(--mid)">${u.email}</td>
      <td><span class="badge ${u.role === 'superadmin' ? 'blue' : u.role === 'manager' ? 'purple' : 'gray'}">${u.role}</span></td>
      <td style="font-size:11px;color:var(--mid)">${u.pages || '—'}</td>
      <td style="font-size:11px;color:var(--mid)">${u.brands || '—'}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn icon sm" onclick="openEditUser('${u.id}')" title="Edit">✎</button>
          <button class="btn icon sm" onclick="deleteUser('${u.id}')" title="Delete" style="color:var(--red)">✕</button>
        </div>
      </td>
    </tr>
  `).join('');
  
  // Load settings into fields
  const s = await api('/api/admin/settings');
  if (s) {
    const am = document.getElementById('ai-ant-model');
    const om = document.getElementById('ai-oai-model');
    if (am) am.value = s.anthropic_model || 'claude-3-5-sonnet-latest';
    if (om) om.value = s.openai_model || 'gpt-4o';

    const ak = document.getElementById('ai-ant-key');
    const ok = document.getElementById('ai-oai-key');
    if (ak) ak.value = s.anthropic_api_key || '';
    if (ok) ok.value = s.openai_api_key || '';

    // Load Google credentials
    const googleClientId = document.getElementById('google-client-id');
    const googleClientSecret = document.getElementById('google-client-secret');
    const googleDevToken = document.getElementById('google-developer-token');
    const googleOAuthStatus = document.getElementById('google-oauth-status');

    if (googleClientId) googleClientId.value = s.google_client_id || '';
    if (googleClientSecret) googleClientSecret.value = s.google_client_secret ? '••••••••••••••••' : '';
    if (googleDevToken) googleDevToken.value = s.google_developer_token ? '••••••••••••••••' : '';
    
    if (googleOAuthStatus) {
      if (s.google_refresh_token) {
        googleOAuthStatus.textContent = 'Authorized (Saved)';
        googleOAuthStatus.className = 'badge success';
        googleOAuthStatus.style.background = '#e6fffa';
        googleOAuthStatus.style.color = '#00a389';
      } else if (s.google_client_id) {
        googleOAuthStatus.textContent = 'Pending Authorization';
        googleOAuthStatus.className = 'badge warning';
        googleOAuthStatus.style.background = '#fffbeb';
        googleOAuthStatus.style.color = '#d97706';
      } else {
        googleOAuthStatus.textContent = 'Unconfigured';
        googleOAuthStatus.className = 'badge gray';
        googleOAuthStatus.style.background = '#f1f5f9';
        googleOAuthStatus.style.color = '#64748b';
      }
    }

    selectPrimaryProvider(s.ai_provider || 'anthropic', false);
  }
}

function setAdminTab(tab) {
  document.getElementById('admin-page-users').style.display = tab === 'users' ? 'block' : 'none';
  document.getElementById('admin-page-settings').style.display = tab === 'settings' ? 'block' : 'none';
  const secMonths = document.getElementById('admin-page-months');
  if (secMonths) secMonths.style.display = tab === 'months' ? 'block' : 'none';
  const secBrands = document.getElementById('admin-page-brands');
  if (secBrands) secBrands.style.display = tab === 'brands' ? 'block' : 'none';

  document.getElementById('tab-admin-users').classList.toggle('active', tab === 'users');
  document.getElementById('tab-admin-settings').classList.toggle('active', tab === 'settings');
  const tabMonths = document.getElementById('tab-admin-months');
  if (tabMonths) tabMonths.classList.toggle('active', tab === 'months');
  const tabBrands = document.getElementById('tab-admin-brands');
  if (tabBrands) tabBrands.classList.toggle('active', tab === 'brands');

  if (tab === 'months') {
    renderAdminMonths();
  }
  if (tab === 'brands') {
    renderAdminBrands();
  }
}

async function renderAdminMonths() {
  const tbody = document.getElementById('admin-months-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  const months = await api('/api/admin/months');
  if (!months || !months.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--mid);padding:20px">No budget months found</td></tr>';
    return;
  }
  tbody.innerHTML = months.map(m => `
    <tr>
      <td style="font-weight:600">${m.brand_name}</td>
      <td>${m.label}</td>
      <td>₹${fmt(m.revenue_target)}</td>
      <td>
        <button class="btn sm danger" onclick="deleteAdminMonth('${m.id}')" style="padding:4px 8px;font-size:11px">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function deleteAdminMonth(id) {
  if (!confirm('Are you sure you want to delete this budget month? This will permanently delete all daily data associated with it.')) return;
  const res = await api(`/api/admin/months/${id}`, 'DELETE');
  if (res && res.ok) {
    renderAdminMonths();
  }
}

function openAddUser() { document.getElementById('mo-add-user').style.display = 'flex'; }

async function submitAddUser() {
  const name  = document.getElementById('nu-name').value.trim();
  const email = document.getElementById('nu-email').value.trim();
  const pw    = document.getElementById('nu-pw').value;
  const role  = document.getElementById('nu-role').value;
  const brands = document.getElementById('nu-brands').value;
  if (!name || !email || !pw) return alert('Name, email and password are required');
  const pages = ['dashboard'];
  if (document.getElementById('pg-strategy').checked) pages.push('strategy');
  if (document.getElementById('pg-pricing').checked)  pages.push('pricing');
  const pgb = document.getElementById('pg-budget'); if (pgb && pgb.checked) pages.push('budget');
  const pgr = document.getElementById('pg-reports'); if (pgr && pgr.checked) pages.push('reports');
  const r = await api('POST', '/api/admin/users', {
    name, email, password: pw, role, pages,
    brands: brands === '*' ? '*' : [brands],
  });
  if (!r) return alert('Failed to create user');
  closeMo('mo-add-user');
  document.getElementById('nu-name').value = '';
  document.getElementById('nu-email').value = '';
  document.getElementById('nu-pw').value = '';
  renderAdmin();
}

async function toggleUser(id, active) {
  await api(`/api/admin/users/${id}`, 'PUT', { active });
  renderAdmin();
}

async function deleteUser(id, name) {
  if (!confirm(`Remove user "${name}"? This cannot be undone.`)) return;
  await api(`/api/admin/users/${id}`, 'DELETE');
  renderAdmin();
}

// ─── SETTINGS (AI Keys) ──────────────────────────────────────────────────────
async function loadSettings() {
  const s = await api('/api/settings');
  if (!s) return;
  
  const ps = document.getElementById('ai-provider-sel');
  if (ps) ps.value = s.ai_provider || 'anthropic';
  
  const am = document.getElementById('ai-ant-model');
  const om = document.getElementById('ai-oai-model');
  if (am) am.value = s.anthropic_model || 'claude-3-5-sonnet-latest';
  if (om) om.value = s.openai_model || 'gpt-4o';
  
  const ak = document.getElementById('ai-ant-key');
  const ok = document.getElementById('ai-oai-key');
  if (ak) ak.value = s.anthropic_api_key || '';
  if (ok) ok.value = s.openai_api_key || '';
  
  const jk = document.getElementById('intel-jina-key');
  const fk = document.getElementById('intel-firecrawl-key');
  const tk = document.getElementById('intel-tavily-key');
  const sk = document.getElementById('intel-serpapi-key');
  if (jk) jk.value = s.jina_api_key || '';
  if (fk) fk.value = s.firecrawl_api_key || '';
  if (tk) tk.value = s.tavily_api_key || '';
  if (sk) sk.value = s.serpapi_api_key || '';
  
  selectPrimaryProvider(s.ai_provider || 'anthropic', false);
}

function selectPrimaryProvider(provider, autoSave = true) {
  const isAnthropic = provider === 'anthropic';
  
  const btnAnt = document.getElementById('prov-btn-anthropic');
  const btnOai = document.getElementById('prov-btn-openai');
  if (btnAnt) btnAnt.classList.toggle('active', isAnthropic);
  if (btnOai) btnOai.classList.toggle('active', !isAnthropic);
  
  const hiddenSel = document.getElementById('ai-provider-sel');
  if (hiddenSel) hiddenSel.value = provider;
  
  const cardAnt = document.getElementById('card-anthropic');
  const cardOai = document.getElementById('card-openai');
  
  if (cardAnt) {
    cardAnt.classList.toggle('active-anthropic', isAnthropic);
    cardAnt.classList.toggle('inactive', !isAnthropic);
  }
  if (cardOai) {
    cardOai.classList.toggle('active-openai', !isAnthropic);
    cardOai.classList.toggle('inactive', isAnthropic);
  }
  
  const badgeAnt = document.getElementById('badge-anthropic');
  const badgeOai = document.getElementById('badge-openai');
  
  if (badgeAnt) {
    badgeAnt.textContent = isAnthropic ? 'PRIMARY ENGINE' : 'BACKUP ENGINE';
    badgeAnt.className = 'active-badge ' + (isAnthropic ? 'primary-badge' : 'backup-badge');
  }
  if (badgeOai) {
    badgeOai.textContent = !isAnthropic ? 'PRIMARY ENGINE' : 'BACKUP ENGINE';
    badgeOai.className = 'active-badge ' + (!isAnthropic ? 'primary-badge' : 'backup-badge');
  }
  
  if (autoSave) {
    saveAISettingsImmediate();
  }
}

function togglePasswordVisibility(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const isPwd = inp.type === 'password';
  inp.type = isPwd ? 'text' : 'password';
  btn.textContent = isPwd ? '🙈' : '👁️';
}

let settingsTimer = null;
function saveAISettings() {
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(saveAISettingsImmediate, 1000);
}

async function saveAISettingsImmediate() {
  const provider = document.getElementById('ai-provider-sel')?.value || 'anthropic';
  const antModel = document.getElementById('ai-ant-model')?.value || 'claude-3-5-sonnet-latest';
  const oaiModel = document.getElementById('ai-oai-model')?.value || 'gpt-4o';
  const antKey   = document.getElementById('ai-ant-key')?.value.trim() || '';
  const oaiKey   = document.getElementById('ai-oai-key')?.value.trim() || '';

  const data = {
    ai_provider:       provider,
    anthropic_model:   antModel,
    openai_model:      oaiModel,
    anthropic_api_key: antKey,
    openai_api_key:    oaiKey
  };
  await api('/api/settings', 'POST', data);
}

async function testKeyDirect(provider, btn) {
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Testing...';
  
  const statusEl = document.getElementById('status-' + provider);
  if (statusEl) {
    statusEl.textContent = 'Verifying...';
    statusEl.style.color = 'var(--mid)';
  }
  
  try {
    const d = await api('POST', '/api/admin/test-key', { provider });
    if (!d) {
      if (statusEl) {
        statusEl.textContent = '✗ Connection failed';
        statusEl.style.color = 'var(--red)';
      }
      return;
    }
    
    if (statusEl) {
      statusEl.textContent = d.ok ? '✓ Connected' : '✗ Failed';
      statusEl.style.color = d.ok ? 'var(--green)' : 'var(--red)';
      if (!d.ok && d.error) {
        alert(provider.toUpperCase() + ' verification failed:\n' + d.error);
      }
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = '✗ Error';
      statusEl.style.color = 'var(--red)';
    }
    alert('Request error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

async function bgtOpenHistory() {
  if (!activeBrand) return;
  const list = document.getElementById('hist-list');
  list.innerHTML = '<div style="padding:10px">Loading...</div>';
  openMo('mo-bgt-history');
  
  const r = await api(`/api/strategy/${activeBrand.slug}/history`);
  if (!r || !r.history) { list.innerHTML = '<div style="padding:10px">No history found.</div>'; return; }
  
  list.innerHTML = r.history.map(h => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-weight:600">${h.strategy_month}</div>
        <div style="font-size:11px;color:var(--mid)">Generated by ${h.generated_by} on ${new Date(h.created_at).toLocaleDateString()}</div>
      </div>
      <div style="display:flex;gap:4px">
        <button class="btn sm" onclick="bgtLoadVersion('${h.id}')">Load</button>
        <a class="btn sm" href="/api/strategy/${activeBrand.slug}/download/${h.id}" download>Download JSON</a>
      </div>
    </div>
  `).join('');
}

async function bgtLoadVersion(id) {
  if (!activeBrand) return;
  const gen = await api(`/api/strategy/${activeBrand.slug}/download/${id}`);
  if (!gen) return alert('Failed to load version');
  
  stratForm = gen.form || {};
  stratForm._brandSlug = activeBrand.slug;
  
  recalculateDoneSteps();
  
  closeMo('mo-bgt-history');
  stratStep = 0;
  renderStrategyStep();
  renderPhaseStrip();
  renderStratSteps();
}

// ══════════════════════════════════════════════════════════════
// BUDGET TRACKER
// ══════════════════════════════════════════════════════════════
let bgtState = {
  brands: [],
  currentBrand: null,
  currentMonth: null,
  currentMonthData: null,
  currentTab: 'overview',
  editingDay: null,
  chartInst: null,
};

const CH_LABELS = { meta:'META', google:'Google', mp:'Marketplace', ret:'Retention' };
const BGT_CATEGORY_LABELS = {
  overview: '📊 Overview',
  push: '📣 Push (Meta)',
  pull: '🎯 Pull (Google)',
  retention: '💌 Retention (WhatsApp/Mail)',
  marketplace: '🛒 Push Marketplace',
  social: '📱 Social'
};

// ── Nav entry ────────────────────────────────────────────────
async function initBudget() {
  await bgtLoadDashboard();
}

async function bgtLoadDashboard() {
  showBgtView('dashboard');
  const r = await api('/api/budget/dashboard');
  if (!r) return;
  bgtState.brands = r.brands || [];
  renderBgtDashboard(r.brands || []);

  // Show new brand button for managers+
  const u = window.currentUser;
  if (u && (u.role === 'superadmin' || u.role === 'manager')) {
    const btn = document.getElementById('bgt-new-brand-btn');
    if (btn) btn.style.display = '';
  }
}

function renderBgtDashboard(data) {
  const el = document.getElementById('bgt-agency-cards');
  if (!el) return;
  if (!data.length) { el.innerHTML = '<div style="color:var(--mid);font-size:13px">No brands assigned. Create a brand to get started.</div>'; return; }

  el.innerHTML = data.map(item => {
    if (!item.month) return `<div class="bgt-agency-card" onclick="bgtOpenBrand('${item.brand.id}')"><div class="bgt-card-brand">${item.brand.name}</div><div class="bgt-card-month">No months yet — click to create</div></div>`;
    const s = item.summary;
    const pct = Math.min(100, s.targetPct || 0);
    const projPct = Math.min(100, s.projTargetPct || 0);
    const flags = item.todayFlags || [];
    const hasErr = flags.some(f => f.level === 'error');
    const hasWrn = flags.some(f => f.level === 'warn');
    const cls = hasErr ? 'has-errors' : hasWrn ? 'has-warns' : '';
    return `<div class="bgt-agency-card ${cls}" onclick="bgtOpenMonth('${item.brand.id}','${item.month.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div class="bgt-card-brand">${item.brand.name}</div><div class="bgt-card-month">${item.month.label} · ${s.daysLeft}d left</div></div>
        <div style="text-align:right"><div style="font-size:18px;font-weight:700;color:${pct>=100?'var(--green)':pct>=70?'var(--blue)':'var(--red)'}">${pct.toFixed(1)}%</div><div style="font-size:10px;color:var(--mid)">of target</div></div>
      </div>
      <div class="bgt-card-prog"><div class="bgt-card-prog-fill" style="width:${pct}%;background:${pct>=100?'var(--green)':pct>=70?'var(--blue)':'var(--red)'}"></div></div>
      <div class="bgt-card-stats">
        <span>₹${fmt(s.totalSalesReal)} actual</span>
        <span>Proj: ₹${fmt(s.projectedSales)} (${projPct.toFixed(0)}%)</span>
        <span>ROAS ${s.totalROAS || '—'}</span>
      </div>
      ${flags.length ? `<div class="bgt-card-flag-row">${flags.slice(0,3).map(f=>`<span class="bgt-flag-pill ${f.level}">${f.msg}</span>`).join('')}${flags.length>3?`<span style="font-size:10px;color:var(--mid)">+${flags.length-3} more</span>`:''}</div>` : ''}
    </div>`;
  }).join('');
}

async function bgtOpenBrand(brandId) {
  const brand = bgtState.brands.find(b => b.brand.id === brandId);
  bgtState.currentBrand = brand ? brand.brand : { id: brandId };
  showBgtView('months');
  document.getElementById('bgt-brand-name').textContent = bgtState.currentBrand.name || '—';

  const newMonthBtn = document.getElementById('bgt-new-month-btn');
  if (newMonthBtn) newMonthBtn.style.display = (window.currentUser && window.currentUser.role !== 'user') ? '' : 'none';

  const months = await api(`/api/budget/brands/${brandId}/months`);
  if (!months) return;
  const el = document.getElementById('bgt-months-list');

  if (!months.length) { el.innerHTML = '<div style="color:var(--mid);font-size:13px;padding:16px">No months yet. Click "New Month" to create one.</div>'; return; }

  el.innerHTML = months.map(m => {
    const salesReal = parseFloat(m.total_sales_real) || 0;
    const target = parseFloat(m.revenue_target) || 0;
    const pct = target > 0 ? ((salesReal / target) * 100).toFixed(1) : 0;
    return `<div class="bgt-month-card" onclick="bgtOpenMonth('${brandId}','${m.id}')">
      <div>
        <div style="font-weight:700;font-size:14px">${m.label}</div>
        <div style="font-size:11px;color:var(--mid)">${m.total_days} days · ${m.days_entered} entries</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700;color:var(--blue)">₹${fmt(salesReal)}</div>
        <div style="font-size:11px;color:var(--mid)">${pct}% of ₹${fmt(target)}</div>
      </div>
    </div>`;
  }).join('');
}

async function bgtOpenMonth(brandId, monthId) {
  if (!bgtState.currentBrand || bgtState.currentBrand.id !== brandId) {
    const brand = bgtState.brands.find(b => b.brand.id === brandId);
    bgtState.currentBrand = brand ? brand.brand : { id: brandId };
  }
  bgtState.currentMonth = { id: monthId };
  showBgtView('month');
  await bgtLoadMonth(monthId);
}

async function bgtLoadMonth(monthId) {
  const data = await api(`/api/budget/months/${monthId}`);
  if (!data) return;
  bgtState.currentMonthData = data;
  bgtState.currentMonth = data.month;

  document.getElementById('bgt-month-title').textContent = `${data.month.brand_name} — ${data.month.label}`;
  document.getElementById('bgt-month-sub').textContent = `Target: ₹${fmt(data.month.revenue_target)} · ${data.month.total_days} days`;
  
  const editBtn = document.getElementById('bgt-edit-btn');
  if (editBtn) editBtn.style.display = (window.currentUser && window.currentUser.role !== 'user') ? '' : 'none';
  const compareBtn = document.getElementById('bgt-compare-btn');
  if (compareBtn) compareBtn.style.display = (window.currentUser && window.currentUser.role !== 'user') ? '' : 'none';

  renderBgtSummary(data);
  renderBgtFlags(data);
  
  renderBgtTable(data);
  setTimeout(() => {
    renderBgtChart(data);
  }, 50);
}

function renderBgtFlags(data) {
  const panel = document.getElementById('bgt-flags-panel');
  if (!panel) return;

  let allFlags = [];
  data.days.forEach(day => {
    if (day.flags && day.flags.length) {
      day.flags.forEach(flag => {
        allFlags.push({
          dayNum: day.day_number,
          dateStr: day.day_date ? new Date(day.day_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : `Day ${day.day_number}`,
          ...flag
        });
      });
    }
  });

  panel.style.display = '';

  if (allFlags.length === 0) {
    panel.innerHTML = `
      <div style="background: rgba(16, 185, 129, 0.04); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; gap: 12px; margin-bottom: 14px; box-shadow: var(--sh)">
        <span style="font-size: 20px; background: var(--green); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700">✓</span>
        <div>
          <div style="font-weight: 700; color: var(--dark); font-size: 13px">All Channels Operating within Target Parameters</div>
          <div style="color: var(--mid); font-size: 11px; margin-top: 1px">No pacing, ROAS under-performance, or budget overspend anomalies detected.</div>
        </div>
      </div>
    `;
    return;
  }

  // Sort flags by level (error first) then day (most recent first)
  allFlags.sort((a, b) => {
    if (a.level === 'error' && b.level !== 'error') return -1;
    if (a.level !== 'error' && b.level === 'error') return 1;
    return b.dayNum - a.dayNum;
  });

  const alertsHtml = allFlags.map(f => {
    const isErr = f.level === 'error';
    const bg = isErr ? 'rgba(239,68,68,0.02)' : 'rgba(245,158,11,0.02)';
    const borderColor = isErr ? 'var(--red)' : 'var(--amber)';
    const textBadge = isErr ? 'CRITICAL ROAS/OVERSPEND' : 'PACING WARNING';
    const badgeBg = isErr ? 'var(--red)' : 'var(--amber)';

    return `
      <div class="bgt-flag-card" style="display:flex; align-items:center; justify-content:space-between; background:#fff; padding:12px 18px; border-radius:10px; border-left:4px solid ${borderColor}; box-shadow:var(--sh); margin-bottom:8px; background-color:${bg}">
        <div style="display:flex; align-items:center; gap:14px; flex:1">
          <span style="font-size: 18px; display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:50%; background:${isErr?'rgba(239,68,68,0.08)':'rgba(245,158,11,0.08)'}">
            ${isErr ? '🚨' : '⚠️'}
          </span>
          <div style="flex:1">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
              <span style="font-weight:800; color:var(--dark); font-size:12.5px">${f.msg}</span>
              <span class="pill" style="font-size:9px; font-weight:800; padding:1px 5px; background:${badgeBg}; color:#fff; border-radius:4px">${textBadge}</span>
            </div>
            <div style="color:var(--mid); font-size:10.5px; margin-top:3px; display:flex; align-items:center; gap:6px">
              <span>📅 ${f.dateStr}</span>
              <span style="color:var(--border)">|</span>
              <span>🏷️ Channel: <strong>${f.channel ? f.channel.toUpperCase() : 'General'}</strong></span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div style="margin-bottom: 12px; display:flex; justify-content:space-between; align-items:center">
      <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--mid); letter-spacing:0.06em">🚨 Performance Alerts Hub (${allFlags.length} active anomalies)</div>
      <button class="btn sm link" onclick="document.getElementById('bgt-flags-panel').style.display='none'" style="font-size:10px; color:var(--mid); padding:0">Dismiss Panel</button>
    </div>
    <div style="max-height: 250px; overflow-y:auto; padding-right:4px">
      ${alertsHtml}
    </div>
  `;
}

function renderBgtSummary(data) {
  const s = data.summary;
  const target = parseFloat(s.target) || 0;
  const roas = parseFloat(s.roas) || 5;
  const budget = parseFloat(s.monthlyBudget) || 0;
  
  const achieved = parseFloat(s.totalSalesReal) || 0;
  const spent = parseFloat(s.totalSpendReal) || 0;
  
  const salesLeft = parseFloat(s.revenueLeft) || 0;
  const spendLeft = parseFloat(s.spendLeft) || 0;
  
  // Required ROAS to reach target with remaining budget
  const reqRoas = spendLeft > 0 ? (salesLeft / spendLeft) : 0;
  const reqRoasStr = reqRoas > 0 ? reqRoas.toFixed(1) + 'x' : 'Target Met ✓';

  const daysEntered = parseInt(s.enteredDays) || 0;
  const totalDays = parseInt(s.totalDays) || 30;
  const activeChannels = s.channelSummary || {};
  const tab = bgtState.currentTab || 'overview';

  // 1. Calculate channel performance leaderboard
  const channelRanking = [];
  Object.entries(activeChannels).forEach(([ch, cs]) => {
    const salesVal = cs.salesReal || 0;
    const spendVal = cs.spendReal || 0;
    const targetVal = cs.target || 0;
    const roasVal = cs.roas || 0;
    const roasTarget = cs.roasTarget || 5;

    let score = 0;
    let rankText = 'No Spend';
    let statusColor = 'var(--mid)';

    if (spendVal > 0) {
      score = roasVal / roasTarget;
      if (score >= 1.0) {
        rankText = `Leader 🏆 (${roasVal.toFixed(1)}x ROAS)`;
        statusColor = 'var(--green)';
      } else if (score >= 0.85) {
        rankText = `On Track 🟢 (${roasVal.toFixed(1)}x ROAS)`;
        statusColor = 'var(--blue)';
      } else {
        rankText = `Lagging ⚠️ (${roasVal.toFixed(1)}x ROAS)`;
        statusColor = 'var(--amber)';
      }
    } else if (targetVal > 0 && salesVal > 0) {
      score = salesVal / targetVal;
      rankText = `${(score * 100).toFixed(0)}% Paced`;
      statusColor = score >= 0.9 ? 'var(--green)' : 'var(--blue)';
    }

    channelRanking.push({
      ch,
      name: cs.name,
      score,
      rankText,
      statusColor,
      salesVal,
      targetVal
    });
  });

  // Sort channels by performance score (highest first)
  channelRanking.sort((a, b) => b.score - a.score);

  // Take top 3 channels for a clean leaderboard view
  const leaderboardHtml = channelRanking.length > 0
    ? channelRanking.slice(0, 3).map((item, idx) => {
        const medals = ['🥇', '🥈', '🥉'];
        const medal = medals[idx] || '•';
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; padding:4px 0; border-bottom:1px dashed var(--border)">
            <div style="display:flex; align-items:center; gap:6px">
              <span>${medal}</span>
              <strong style="color:var(--dark)">${item.name}</strong>
            </div>
            <span style="font-weight:700; color:${item.statusColor}">${item.rankText}</span>
          </div>
        `;
      }).join('')
    : '<div style="color:var(--mid); font-size:11px; text-align:center; padding:10px 0">No data entered yet</div>';

  // 2. Build high-end Channel Diagnostics Grid, filtered by active category tab
  let channelsHtml = '';
  let channelsCount = 0;
  Object.entries(activeChannels).forEach(([ch, cs], idx) => {
    const cat = getChannelCategory(ch, cs);
    if (tab !== 'overview' && tab !== 'social' && cat !== tab) {
      return; // Filter out if not in the active category tab
    }

    channelsCount++;
    const color = getChColor(ch, idx);
    const salesVal = cs.salesReal || 0;
    const spendVal = cs.spendReal || 0;
    const salesPct = cs.target > 0 ? (salesVal / cs.target) * 100 : 0;
    const spendPct = cs.budget > 0 ? (spendVal / cs.budget) * 100 : 0;
    
    // Pacing Diagnostic Alerts
    let paceStatus = '🟢 Healthy Pacing';
    let statusClass = 'good';
    let borderL = 'var(--green)';
    
    const expectedSpend = (cs.budget / totalDays) * daysEntered;
    if (spendVal > expectedSpend * 1.2) {
      const overPct = Math.round((spendVal / expectedSpend - 1) * 100);
      paceStatus = `🚨 Over-spending (+${overPct}%)`;
      statusClass = 'bad';
      borderL = 'var(--red)';
    } else if (spendVal < expectedSpend * 0.7 && expectedSpend > 100) {
      const underPct = Math.round((1 - spendVal / expectedSpend) * 100);
      paceStatus = `🟡 Under-spending (-${underPct}%)`;
      statusClass = 'warn';
      borderL = 'var(--amber)';
    }
    
    // Target ROAS Performance
    let roasClass = 'good';
    let roasText = 'Healthy';
    if (cs.roas !== null) {
      if (cs.roas < cs.roasTarget * 0.9) {
        roasText = `Lagging (-${Math.round((1 - cs.roas/cs.roasTarget)*100)}%)`;
        roasClass = 'bad';
        if (statusClass === 'good') {
          paceStatus = '🔴 ROAS Alert';
          statusClass = 'bad';
          borderL = 'var(--red)';
        }
      }
    }

    channelsHtml += `
      <div class="cmd-stat-card" style="grid-column: span 4; display:flex; flex-direction:column; gap:12px; border-left: 4px solid ${borderL}; background: #fff; padding:18px; border-radius:12px; box-shadow: var(--sh)">
        <div style="display:flex; justify-content:space-between; align-items:center">
          <div style="display:flex; align-items:center; gap:8px">
            <span style="background:${color}; width:10px; height:10px; border-radius:50%; display:inline-block"></span>
            <span style="font-weight:800; font-size:13.5px; color:var(--dark)">${cs.name}</span>
          </div>
          <span class="pill ${statusClass}" style="font-size:9.5px; font-weight:700; padding:2px 6px">${paceStatus}</span>
        </div>
        
        <div style="font-size:11.5px; color:var(--mid); display:flex; flex-direction:column; gap:6px">
          <div style="display:flex; justify-content:space-between">
            <span>Sales Attained:</span>
            <span style="font-weight:700; color:var(--dark)">₹${fmtN(salesVal)} / ₹${fmtN(cs.target)}</span>
          </div>
          <div style="height:6px; background:var(--border); border-radius:3px; overflow:hidden">
            <div style="width:${Math.min(100, salesPct)}%; height:100%; background:var(--blue); border-radius:3px"></div>
          </div>
          
          <div style="display:flex; justify-content:space-between; margin-top:4px">
            <span>Budget Burned:</span>
            <span style="font-weight:700; color:var(--dark)">₹${fmtN(spendVal)} / ₹${fmtN(cs.budget)}</span>
          </div>
          <div style="height:6px; background:var(--border); border-radius:3px; overflow:hidden">
            <div style="width:${Math.min(100, spendPct)}%; height:100%; background:${color}; border-radius:3px"></div>
          </div>
        </div>
        
        <div style="margin-top:6px; padding-top:8px; border-top:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center">
          <span style="font-size:10.5px; color:var(--mid)">ROAS Target: <strong>${cs.roasTarget}x</strong></span>
          <span style="font-size:11.5px; font-weight:800; color:${roasClass==='good'?'var(--green)':'var(--red)'}">${cs.roas !== null ? cs.roas.toFixed(2) + 'x (' + roasText + ')' : 'No Spend'}</span>
        </div>
      </div>
    `;
  });

  if (channelsCount === 0) {
    channelsHtml = `
      <div style="grid-column: span 12; background:rgba(0,0,0,0.01); border:1px dashed var(--border); border-radius:12px; padding:24px; text-align:center; color:var(--mid)">
        No active channels configured inside this category for this month.
      </div>
    `;
  }

  const categoryHeadline = tab === 'overview' ? 'All Active Channels' : BGT_CATEGORY_LABELS[tab] || 'Channels';

  document.getElementById('bgt-summary-row').innerHTML = `
    <!-- Card 1: Revenue Targets -->
    <div class="cmd-stat-card" style="grid-column: span 4; display:flex; flex-direction:column; gap:12px; background: #fff; padding:18px; border-radius:12px; box-shadow: var(--sh)">
      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;color:var(--mid);letter-spacing:0.04em">Month Revenue Target</div>
      <div style="display:flex; justify-content:space-between; align-items:center; flex:1">
        <div>
          <div style="font-size:20px;font-weight:800;color:var(--fg)">₹${fmtN(target)}</div>
          <div style="font-size:10.5px;color:var(--mid);margin-top:2px">Target Expectations</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:20px;font-weight:800;color:var(--blue)">₹${fmtN(achieved)}</div>
          <div style="font-size:10.5px;color:var(--mid);margin-top:2px">Achieved (${((achieved/target)*100).toFixed(1)}%)</div>
        </div>
      </div>
    </div>

    <!-- Card 2: pacing telemetry -->
    <div class="cmd-stat-card" style="grid-column: span 4; display:flex; flex-direction:column; gap:12px; background: #fff; padding:18px; border-radius:12px; box-shadow: var(--sh)">
      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;color:var(--mid);letter-spacing:0.04em">Month Target Pacing</div>
      <div style="display:flex; justify-content:space-between; align-items:center; flex:1; gap:6px">
        <div>
          <div style="font-size:15px;font-weight:800;color:${salesLeft>0?'var(--fg)':'var(--green)'}">
            ${salesLeft > 0 ? '₹' + fmt(salesLeft) : 'Met ✓'}
          </div>
          <div style="font-size:9.5px;color:var(--mid);margin-top:2px">Left Sales</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:15px;font-weight:800;color:${spendLeft>0?'var(--blue)':'var(--red)'}">
            ₹${fmt(spendLeft)}
          </div>
          <div style="font-size:9.5px;color:var(--mid);margin-top:2px">Left Budget</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:15px;font-weight:800;color:${reqRoas<=roas?'var(--green)':'var(--red)'}">${reqRoasStr}</div>
          <div style="font-size:9.5px;color:var(--mid);margin-top:2px">Req. ROAS</div>
        </div>
      </div>
    </div>

    <!-- Card 3: Performance Leaderboard -->
    <div class="cmd-stat-card" style="grid-column: span 4; display:flex; flex-direction:column; gap:8px; background: #fff; padding:18px; border-radius:12px; box-shadow: var(--sh)">
      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;color:var(--mid);letter-spacing:0.04em">🏆 Channel Performance Index</div>
      <div style="display:flex; flex-direction:column; gap:4px">
        ${leaderboardHtml}
      </div>
    </div>

    <div style="grid-column: span 12; font-size:11px; font-weight:800; text-transform:uppercase; color:var(--mid); letter-spacing:0.06em; margin: 8px 0 2px 0; display:flex; align-items:center; gap:8px">
      <span>🛒 ${categoryHeadline} Burn & Performance Velocity</span>
      <span style="width:6px; height:6px; border-radius:50%; background:var(--border)"></span>
      <span style="text-transform:none; font-weight:400; color:var(--mid)">Filtered View</span>
    </div>
    ${channelsHtml}
  `;
}

function getChannelCategory(ch, cs) {
  if (cs && cs.category) return cs.category;
  if (ch === 'meta') return 'push';
  if (ch === 'google') return 'pull';
  if (ch === 'email' || ch === 'whatsapp' || ch === 'push_notifications' || ch === 'ret') return 'retention';
  if (ch === 'amazon' || ch === 'flipkart' || ch === 'instamart' || ch === 'blinkit' || ch === 'mp') return 'marketplace';
  return 'push';
}

function renderBgtTable(data) {
  const tab = bgtState.currentTab || 'overview';
  const s = data.summary;
  const activeChannels = s.activeChannels || {};
  
  let tabsHtml = '';
  for (const [catKey, catLabel] of Object.entries(BGT_CATEGORY_LABELS)) {
    let hasActive = true;
    if (catKey !== 'overview' && catKey !== 'social') {
      hasActive = Object.entries(s.channelSummary || {}).some(([ch, cs]) => getChannelCategory(ch, cs) === catKey);
    }
    if (hasActive) {
      tabsHtml += `<button class="bgt-tab ${tab === catKey ? 'active' : ''}" onclick="bgtSetTab('${catKey}')">${catLabel}</button>`;
    }
  }
  document.getElementById('bgt-tabs').innerHTML = tabsHtml;

  // Filter channels inside active category
  const categoryChannels = {};
  if (tab !== 'overview' && tab !== 'social') {
    for (const [ch, cs] of Object.entries(s.channelSummary || {})) {
      const cat = getChannelCategory(ch, cs);
      if (cat === tab) {
        categoryChannels[ch] = cs.name || ucfirst(ch);
      }
    }
  }

  let th = '<tr><th>Day</th><th>Date</th>';
  if (tab === 'overview') {
    th += '<th>Exp. Sales</th><th>Actual Sales</th><th>Exp. Spend</th><th>Actual Spend</th><th>ROAS</th>';
  } else if (tab === 'social') {
    th += '<th>Followers</th><th>Posts</th>';
  } else {
    for (const [ch, name] of Object.entries(categoryChannels)) {
      th += `<th style="background:rgba(43,78,255,0.02)">${name} Exp. Sales</th><th style="background:rgba(43,78,255,0.02)">${name} Sales</th>`;
      th += `<th>${name} Exp. Spend</th><th>${name} Spend</th><th style="font-weight:700">ROAS</th>`;
    }
  }
  th += '</tr>';

  let tb = '';
  const todayNum = new Date().getDate();
  for (const day of data.days) {
    const isToday = day.day_number === todayNum;
    const hasData = day.entered;
    const rowCls = isToday ? 'today-row' : !hasData ? 'no-data' : '';
    const dateStr = day.day_date ? new Date(day.day_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : '—';

    let td = `<tr class="${rowCls}" onclick="bgtClickDay(${day.day_number})">`;
    td += `<td>${day.day_number}${isToday ? ' <span style="font-size:9px;background:var(--blue);color:#fff;border-radius:3px;padding:1px 4px">TODAY</span>' : ''}</td>`;
    td += `<td>${dateStr}</td>`;

    if (tab === 'overview') {
      td += `<td style="color:var(--mid)">₹${fmtN(day.total_sales_exp)}</td>`;
      td += `<td style="font-weight:700;color:var(--blue)">${day.total_sales_real != null ? '₹' + fmtN(day.total_sales_real) : '—'}</td>`;
      td += `<td style="color:var(--mid)">₹${fmtN(day.total_spend_exp)}</td>`;
      td += `<td>${day.total_spend_real != null ? '₹' + fmtN(day.total_spend_real) : '—'}</td>`;
      td += `<td style="font-weight:600">${day.total_roas != null ? day.total_roas + 'x' : '—'}</td>`;
    } else if (tab === 'social') {
      td += `<td>${day.followers_real != null ? day.followers_real.toLocaleString() : '—'}</td>`;
      td += `<td>${day.posts_real != null ? day.posts_real : '—'}</td>`;
    } else {
      for (const ch of Object.keys(categoryChannels)) {
        const chDay = day.channels[ch] || {};
        td += `<td style="color:var(--mid)">₹${fmtN(chDay.salesExp)}</td>`;
        td += `<td style="font-weight:700;color:var(--blue)">${chDay.salesReal != null ? '₹' + fmtN(chDay.salesReal) : '—'}</td>`;
        td += `<td style="color:var(--mid)">₹${fmtN(chDay.spendExp)}</td>`;
        td += `<td>${chDay.spendReal != null ? '₹' + fmtN(chDay.spendReal) : '—'}</td>`;
        td += `<td style="font-weight:600">${chDay.roas != null ? chDay.roas + 'x' : '—'}</td>`;
      }
    }

    td += '</tr>';
    tb += td;
  }

  document.getElementById('bgt-day-thead').innerHTML = th;
  document.getElementById('bgt-day-tbody').innerHTML = tb;
}

const CH_COLORS = {
  meta: '#3B82F6',
  google: '#10B981',
  amazon: '#F59E0B',
  flipkart: '#EF4444',
  email: '#8B5CF6',
  whatsapp: '#EC4899',
  push_notifications: '#06B6D4'
};

function getChColor(ch, idx) {
  if (CH_COLORS[ch]) return CH_COLORS[ch];
  return `hsl(${(idx * 137.5) % 360}, 70%, 55%)`;
}

function renderBgtChart(data) {
  const canvas = document.getElementById('bgt-chart');
  if (!canvas) return;
  if (bgtState.chartInst) { bgtState.chartInst.destroy(); bgtState.chartInst = null; }

  const ctx = canvas.getContext('2d');
  const clientWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
  const W = clientWidth > 50 ? clientWidth - 28 : 600;
  canvas.width = W; canvas.height = 140;
  ctx.clearRect(0, 0, W, 140);

  const tab = bgtState.currentTab || 'overview';
  const s = data.summary;
  const activeChannels = s.activeChannels || {};
  const n = data.days.length;
  const pad = { l: 60, r: 20, t: 25, b: 25 };
  const cw = W - pad.l - pad.r;
  const ch = 140 - pad.t - pad.b;

  const xp = i => n > 1 ? pad.l + (i / (n - 1)) * cw : pad.l + cw / 2;

  // Filter channels inside active category
  const categoryChannels = {};
  if (tab !== 'overview' && tab !== 'social') {
    for (const [chKey, cs] of Object.entries(s.channelSummary || {})) {
      const cat = getChannelCategory(chKey, cs);
      if (cat === tab) {
        categoryChannels[chKey] = cs.name || ucfirst(chKey);
      }
    }
  }

  // Determine line coordinates
  let maxV = 1;
  const linesToDraw = [];

  if (tab === 'overview') {
    // Cumulative aggregate lines
    let cumSalesExp = 0;
    let cumSalesReal = 0;
    let cumSpendExp = 0;
    let cumSpendReal = 0;

    const ptsSalesExp = [];
    const ptsSalesReal = [];
    const ptsSpendExp = [];
    const ptsSpendReal = [];

    data.days.forEach(day => {
      cumSalesExp += parseFloat(day.total_sales_exp || 0);
      ptsSalesExp.push(cumSalesExp);

      if (day.total_sales_real !== null) {
        cumSalesReal += parseFloat(day.total_sales_real);
        ptsSalesReal.push(cumSalesReal);
      } else {
        ptsSalesReal.push(null);
      }

      cumSpendExp += parseFloat(day.total_spend_exp || 0);
      ptsSpendExp.push(cumSpendExp);

      if (day.total_spend_real !== null) {
        cumSpendReal += parseFloat(day.total_spend_real);
        ptsSpendReal.push(cumSpendReal);
      } else {
        ptsSpendReal.push(null);
      }
    });

    maxV = Math.max(100, ...ptsSalesExp, ...ptsSalesReal.filter(v => v !== null), ...ptsSpendExp, ...ptsSpendReal.filter(v => v !== null)) * 1.15;

    linesToDraw.push({ label: 'Expected Revenue Pace', color: '#6366f1', dashed: true, pts: ptsSalesExp });
    linesToDraw.push({ label: 'Actual Revenue Achieved', color: '#2B4EFF', dashed: false, pts: ptsSalesReal });
    linesToDraw.push({ label: 'Expected Spend Pace', color: '#94a3b8', dashed: true, pts: ptsSpendExp });
    linesToDraw.push({ label: 'Actual Spend Burned', color: '#EF4444', dashed: false, pts: ptsSpendReal });
  } else if (tab === 'social') {
    // Followers line
    const ptsFollowers = [];
    data.days.forEach(day => {
      ptsFollowers.push(day.followers_real !== null ? parseFloat(day.followers_real) : null);
    });
    maxV = Math.max(100, ...ptsFollowers.filter(v => v !== null)) * 1.15;
    linesToDraw.push({ label: 'Followers count', color: '#8B5CF6', dashed: false, pts: ptsFollowers });
  } else {
    // Specific channels in the selected category
    let colorIdx = 0;
    Object.keys(categoryChannels).forEach(chKey => {
      const color = getChColor(chKey, colorIdx++);
      
      const ptsSalesExp = [];
      const ptsSalesReal = [];
      let cumSalesExp = 0;
      let cumSalesReal = 0;

      data.days.forEach(day => {
        const chDay = day.channels[chKey] || {};
        cumSalesExp += parseFloat(chDay.salesExp || 0);
        ptsSalesExp.push(cumSalesExp);

        if (chDay.salesReal !== null) {
          cumSalesReal += parseFloat(chDay.salesReal);
          ptsSalesReal.push(cumSalesReal);
        } else {
          ptsSalesReal.push(null);
        }
      });

      maxV = Math.max(maxV, ...ptsSalesExp, ...ptsSalesReal.filter(v => v !== null));

      linesToDraw.push({ label: `${categoryChannels[chKey]} Expected Pace`, color: color, dashed: true, pts: ptsSalesExp });
      linesToDraw.push({ label: `${categoryChannels[chKey]} Actual Revenue`, color: color, dashed: false, pts: ptsSalesReal });
    });
    maxV = maxV * 1.15;
  }

  const yp = v => pad.t + (1 - v / maxV) * ch;

  // Draw grid lines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ch / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.fillStyle = 'var(--mid)'; ctx.font = '500 10px var(--fh)'; ctx.textAlign = 'right';
    ctx.fillText('₹' + fmt(maxV * (1 - i / 4)), pad.l - 8, y + 3);
  }

  // Draw lines
  linesToDraw.forEach(line => {
    const pts = line.pts.map((v, i) => v !== null ? { x: xp(i), y: yp(v) } : null).filter(Boolean);
    if (pts.length === 0) return;

    if (line.dashed) {
      ctx.setLineDash([5, 4]);
    } else {
      ctx.setLineDash([]);
      // Soft fill gradient for actual performance
      const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
      grad.addColorStop(0, line.color + '10');
      grad.addColorStop(1, line.color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pad.t + ch);
      pts.forEach(pt => ctx.lineTo(pt.x, pt.y));
      ctx.lineTo(pts[pts.length - 1].x, pad.t + ch);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.dashed ? 1.5 : 2.5;
    ctx.beginPath();
    pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
    ctx.stroke();

    if (!line.dashed) {
      pts.forEach(pt => {
        ctx.fillStyle = line.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
      });
    }
  });
  ctx.setLineDash([]);

  // Draw X-axis day labels
  ctx.fillStyle = 'var(--mid)'; ctx.font = '500 10px var(--fh)'; ctx.textAlign = 'center';
  data.days.forEach((d, i) => {
    if (i % 5 === 0 || i === n - 1) {
      ctx.fillText('D' + d.day_number, xp(i), 140 - pad.b + 15);
    }
  });

  // Draw Dynamic Legend on Top
  let legendHtml = `<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;margin-bottom:12px;justify-content:center;border-bottom:1px solid rgba(0,0,0,0.03);padding-bottom:10px" class="bgt-chart-legend">`;
  linesToDraw.forEach(line => {
    if (line.dashed) {
      legendHtml += `<div style="display:flex;align-items:center;gap:6px"><span style="border-bottom:2px dashed ${line.color};width:16px;height:0;display:inline-block"></span> <span style="color:var(--mid)">${line.label}</span></div>`;
    } else {
      legendHtml += `<div style="display:flex;align-items:center;gap:6px"><span style="background:${line.color};width:8px;height:8px;border-radius:50%;display:inline-block"></span> <span style="color:var(--fg);font-weight:600">${line.label}</span></div>`;
    }
  });
  legendHtml += `</div>`;

  const parent = canvas.parentElement;
  let legEl = parent.querySelector('.bgt-chart-legend-wrapper');
  if (!legEl) {
    legEl = document.createElement('div');
    legEl.className = 'bgt-chart-legend-wrapper';
    parent.insertBefore(legEl, canvas);
  }
  legEl.innerHTML = legendHtml;
}

function bgtSetTab(tab) {
  bgtState.currentTab = tab;
  if (bgtState.currentMonthData) {
    renderBgtSummary(bgtState.currentMonthData);
    renderBgtTable(bgtState.currentMonthData);
    renderBgtChart(bgtState.currentMonthData);
  }
}
// ── Day entry modal ──────────────────────────────────────────
function bgtClickDay(dayNum) {
  if (!bgtState.currentMonthData) return;
  bgtState.editingDay = dayNum;
  const data = bgtState.currentMonthData;
  const day = data.days.find(d => d.day_number === dayNum);
  const activeChannels = data.summary.activeChannels || {};

  document.getElementById('bgt-day-modal-title').textContent = `Day ${dayNum} — Enter Performance Data`;

  let fields = '';
  for (const [ch, name] of Object.entries(activeChannels)) {
    const chDay = day ? day.channels[ch] || {} : {};
    const salesV = chDay.salesReal != null ? chDay.salesReal : '';
    const spendV = chDay.spendReal != null ? chDay.spendReal : '';
    const ordersV = chDay.conversions != null ? chDay.conversions : '';
    const custV = chDay.customers_acquired != null ? chDay.customers_acquired : '';
    const impV = chDay.impressions != null ? chDay.impressions : '';
    const clickV = chDay.clicks != null ? chDay.clicks : '';
    const expSales = chDay.salesExp || 0;
    const expSpend = chDay.spendExp || 0;
    const roasTarget = chDay.roasTarget || 5;

    fields += `
      <div style="border:1px solid var(--border);border-radius:12px;padding:12px;background:rgba(255,255,255,0.01);margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;color:var(--fg);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em">
          ${name} <span style="font-weight:400;color:var(--mid);text-transform:none">(Pacing Target: ₹${fmtN(expSales)} sales · ₹${fmtN(expSpend)} spend)</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px">
          <div class="field"><label>Sales (₹)</label><input type="number" id="bgtd-${ch}-sales" placeholder="0" value="${salesV}" oninput="bgtLiveDiag('${ch}', ${expSales}, ${expSpend}, ${roasTarget})"></div>
          <div class="field"><label>Ad Spend (₹)</label><input type="number" id="bgtd-${ch}-spend" placeholder="0" value="${spendV}" oninput="bgtLiveDiag('${ch}', ${expSales}, ${expSpend}, ${roasTarget})"></div>
          <div class="field"><label>Orders</label><input type="number" id="bgtd-${ch}-orders" placeholder="0" value="${ordersV}"></div>
          <div class="field"><label>Customers Acquired</label><input type="number" id="bgtd-${ch}-customers" placeholder="0" value="${custV}"></div>
          <div class="field"><label>Sessions</label><input type="number" id="bgtd-${ch}-impressions" placeholder="0" value="${impV}"></div>
          <div class="field"><label>Clicks</label><input type="number" id="bgtd-${ch}-clicks" placeholder="0" value="${clickV}"></div>
        </div>
        <div id="bgt-live-diag-${ch}" style="margin-top:8px; font-size:11px; font-weight:700; display:none;" class="live-diag-text"></div>
      </div>
    `;
  }

  const folV = day && day.followers_real != null ? day.followers_real : '';
  const posV = day && day.posts_real != null ? day.posts_real : '';
  fields += `
    <div class="g2" style="margin-top:12px">
      <div class="field"><label>Followers (total count)</label><input type="number" id="bgtd-followers" value="${folV}" placeholder="0"></div>
      <div class="field"><label>Posts Published</label><input type="number" id="bgtd-posts" value="${posV}" placeholder="0"></div>
    </div>
  `;

  document.getElementById('bgt-day-modal-fields').innerHTML = fields;
  
  // Trigger initial diagnostics for entered data
  for (const [ch, name] of Object.entries(activeChannels)) {
    const chDay = day ? day.channels[ch] || {} : {};
    const expSales = chDay.salesExp || 0;
    const expSpend = chDay.spendExp || 0;
    const roasTarget = chDay.roasTarget || 5;
    bgtLiveDiag(ch, expSales, expSpend, roasTarget);
  }

  openMo('mo-bgt-day');
}

function bgtLiveDiag(ch, expSales, expSpend, roasTarget) {
  const salesInput = document.getElementById(`bgtd-${ch}-sales`);
  const spendInput = document.getElementById(`bgtd-${ch}-spend`);
  const diagEl = document.getElementById(`bgt-live-diag-${ch}`);
  if (!salesInput || !spendInput || !diagEl) return;

  const salesVal = parseFloat(salesInput.value) || 0;
  const spendVal = parseFloat(spendInput.value) || 0;

  if (salesInput.value === '' && spendInput.value === '') {
    diagEl.style.display = 'none';
    return;
  }

  let warnings = [];

  // 1. Under-spending / Over-spending
  if (spendVal > 0 && expSpend > 100) {
    const diffPct = Math.round(((expSpend - spendVal) / expSpend) * 100);
    if (diffPct >= 30) {
      warnings.push(`<span style="color:var(--amber)">⚠️ Under-spending (-${diffPct}%)</span>`);
    } else if (spendVal > expSpend * 1.2) {
      const overPct = Math.round(((spendVal - expSpend) / expSpend) * 100);
      warnings.push(`<span style="color:var(--red)">🚨 Over-spending (+${overPct}%)</span>`);
    }
  }

  // 2. Sales Miss
  if (salesVal > 0 && expSales > 100) {
    const diffPct = Math.round(((expSales - salesVal) / expSales) * 100);
    if (diffPct >= 20) {
      warnings.push(`<span style="color:var(--amber)">⚠️ Sales lagging target (-${diffPct}%)</span>`);
    }
  }

  // 3. ROAS Miss
  if (spendVal > 0 && salesVal > 0) {
    const roas = salesVal / spendVal;
    if (roas < roasTarget * 0.9) {
      const diffPct = Math.round(((roasTarget - roas) / roasTarget) * 100);
      warnings.push(`<span style="color:var(--red)">🚨 ROAS Lagging: ${roas.toFixed(2)}x vs Target ${roasTarget}x (-${diffPct}%)</span>`);
    }
  }

  if (warnings.length > 0) {
    diagEl.style.display = 'block';
    diagEl.innerHTML = warnings.join(' · ');
  } else {
    diagEl.style.display = 'block';
    diagEl.innerHTML = `<span style="color:var(--green)">✓ Channel operating within target guidelines</span>`;
  }
}

async function bgtSaveDay() {
  const dayNum = bgtState.editingDay;
  const monthId = bgtState.currentMonth.id;
  const data = bgtState.currentMonthData;
  const activeChannels = data.summary.activeChannels || {};

  const channelsData = {};
  for (const ch of Object.keys(activeChannels)) {
    const sv   = document.getElementById(`bgtd-${ch}-sales`);
    const spv  = document.getElementById(`bgtd-${ch}-spend`);
    const ordv = document.getElementById(`bgtd-${ch}-orders`);
    const custv = document.getElementById(`bgtd-${ch}-customers`);
    const impv = document.getElementById(`bgtd-${ch}-impressions`);
    const clickv = document.getElementById(`bgtd-${ch}-clicks`);
    channelsData[ch] = {
      sales:               sv   && sv.value   !== '' ? parseFloat(sv.value)   : null,
      spend:               spv  && spv.value  !== '' ? parseFloat(spv.value)  : null,
      conversions:         ordv && ordv.value !== '' ? parseInt(ordv.value)   : null,
      customers_acquired:  custv && custv.value !== '' ? parseInt(custv.value) : null,
      impressions:         impv && impv.value !== '' ? parseInt(impv.value)   : null,
      clicks:              clickv && clickv.value !== '' ? parseInt(clickv.value)   : null,
    };
  }

  const fol = document.getElementById('bgtd-followers');
  const pos = document.getElementById('bgtd-posts');

  const body = {
    day_date: `${bgtState.currentMonth.year}-${String(bgtState.currentMonth.month).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`,
    channels_data: channelsData,
    meta_sales: channelsData['meta']?.sales ?? '',
    meta_spend: channelsData['meta']?.spend ?? '',
    google_sales: channelsData['google']?.sales ?? '',
    google_spend: channelsData['google']?.spend ?? '',
    mp_sales: channelsData['mp']?.sales ?? '',
    mp_spend: channelsData['mp']?.spend ?? '',
    ret_sales: channelsData['ret']?.sales ?? '',
    ret_spend: channelsData['ret']?.spend ?? '',
    followers_real: fol ? fol.value : '',
    posts_real: pos ? pos.value : ''
  };

  try {
    const r = await api(`/api/budget/months/${monthId}/days/${dayNum}`, 'PUT', body);
    if (r && r.ok) {
      closeMo('mo-bgt-day');
      await bgtLoadMonth(monthId);
    }
  } catch (e) {
    alert("Error saving data: " + e.message);
  }
}

// ── New Brand ────────────────────────────────────────────────
function bgtOpenNewBrand() { openMo('mo-bgt-brand'); }
async function bgtSubmitNewBrand() {
  const name = document.getElementById('bgtb-name').value.trim();
  const industry = document.getElementById('bgtb-industry').value.trim();
  if (!name) return alert('Brand name required');
  const r = await api('/api/budget/brands', 'POST', { name, industry });
  if (r && r.ok) { closeMo('mo-bgt-brand'); await bgtLoadDashboard(); }
}// ── New Month ────────────────────────────────────────────────
function bgtOpenNewMonth() {
  const container = document.getElementById('bgt-new-month-channels') || document.querySelector('#mo-bgt-month .g2').nextElementSibling.nextElementSibling.nextElementSibling;
  
  const allKnownChannels = {
    meta: { name: 'Meta', cat: 'push' },
    google: { name: 'Google', cat: 'pull' },
    amazon: { name: 'Amazon', cat: 'marketplace' },
    flipkart: { name: 'Flipkart', cat: 'marketplace' },
    email: { name: 'Email', cat: 'retention' },
    whatsapp: { name: 'WhatsApp', cat: 'retention' },
    push_notifications: { name: 'Push Notifications', cat: 'retention' },
    tiktok: { name: 'TikTok', cat: 'push' },
    snapchat: { name: 'Snapchat', cat: 'push' }
  };
  
  const brandChannels = (bgtState.currentBrand.channels_config && Array.isArray(bgtState.currentBrand.channels_config) && bgtState.currentBrand.channels_config.length > 0)
    ? bgtState.currentBrand.channels_config
    : ['meta', 'google'];
    
  const defaultChannels = {};
  for (const ch of brandChannels) {
    if (allKnownChannels[ch]) {
      defaultChannels[ch] = allKnownChannels[ch];
    } else {
      defaultChannels[ch] = { name: ch.charAt(0).toUpperCase() + ch.slice(1), cat: 'push' };
    }
  }
  
  let html = '';
  for (const [ch, info] of Object.entries(defaultChannels)) {
    html += `
      <div style="border:1px solid var(--border);border-radius:8px;padding:10px" id="bgtc-wrap-${ch}">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;margin-bottom:8px">
          <input type="checkbox" id="bgtc-${ch}-active" checked onchange="bgtToggleChannel('${ch}')"> ${info.name}
        </label>
        <div class="field" style="margin-bottom:6px"><label>% of Revenue</label><input type="number" id="bgtc-${ch}-pct" value="${ch === 'meta' || ch === 'google' ? '15' : '5'}" min="0" max="100"></div>
        <div class="field" style="margin-bottom:6px"><label>Target ROAS</label><input type="number" id="bgtc-${ch}-roas" value="5" step="0.1"></div>
        <div class="field" style="margin-bottom:6px"><label>Start Day</label><input type="number" id="bgtc-${ch}-start" value="1" min="1" max="31"></div>
        <div class="field">
          <label>Category</label>
          <select id="bgtc-${ch}-category" style="width:100%;padding:4px;border:1px solid var(--border);border-radius:6px;font-size:11px">
            <option value="push" ${info.cat === 'push'?'selected':''}>Push</option>
            <option value="pull" ${info.cat === 'pull'?'selected':''}>Pull</option>
            <option value="retention" ${info.cat === 'retention'?'selected':''}>Retention</option>
            <option value="marketplace" ${info.cat === 'marketplace'?'selected':''}>Push Marketplace</option>
          </select>
        </div>
      </div>
    `;
  }
  
  if (container) {
    container.innerHTML = html;
    container.id = 'bgt-new-month-channels';
    container.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:220px;overflow-y:auto;padding-right:4px";
  }
  openMo('mo-bgt-month');
}

function bgtToggleChannel(ch) {
  const active = document.getElementById(`bgtc-${ch}-active`).checked;
  ['pct','roas','start','category'].forEach(f => {
    const el = document.getElementById(`bgtc-${ch}-${f}`);
    if (el) el.disabled = !active;
  });
}

function bgtAddCustomChannel() {
  const name = prompt('Enter custom channel name (e.g. LinkedIn):');
  if (!name) return;
  const ch = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  
  const container = document.getElementById('bgt-new-month-channels');
  if (!container) return;
  
  const div = document.createElement('div');
  div.style.cssText = "border:1px solid var(--border);border-radius:8px;padding:10px";
  div.id = `bgtc-wrap-${ch}`;
  div.innerHTML = `
    <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;margin-bottom:8px">
      <input type="checkbox" id="bgtc-${ch}-active" checked onchange="bgtToggleChannel('${ch}')"> ${name}
    </label>
    <div class="field" style="margin-bottom:6px"><label>% of Revenue</label><input type="number" id="bgtc-${ch}-pct" value="10"></div>
    <div class="field" style="margin-bottom:6px"><label>Target ROAS</label><input type="number" id="bgtc-${ch}-roas" value="5" step="0.1"></div>
    <div class="field" style="margin-bottom:6px"><label>Start Day</label><input type="number" id="bgtc-${ch}-start" value="1" min="1" max="31"></div>
    <div class="field">
      <label>Category</label>
      <select id="bgtc-${ch}-category" style="width:100%;padding:4px;border:1px solid var(--border);border-radius:6px;font-size:11px">
        <option value="push">Push</option>
        <option value="pull">Pull</option>
        <option value="retention">Retention</option>
        <option value="marketplace">Push Marketplace</option>
      </select>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function bgtSubmitNewMonth() {
  if (!bgtState.currentBrand) return;
  const month  = parseInt(document.getElementById('bgtm-month').value);
  const year   = parseInt(document.getElementById('bgtm-year').value);
  const days   = new Date(year, month, 0).getDate();
  const target = parseFloat(document.getElementById('bgtm-target').value);
  const roas   = parseFloat(document.getElementById('bgtm-roas').value) || 5;

  if (!target) return alert('Revenue target is required');

  const monthNames = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const label = `${monthNames[month]} ${year}`;

  const channels = {};
  const container = document.getElementById('bgt-new-month-channels');
  if (container) {
    container.querySelectorAll('[id^="bgtc-wrap-"]').forEach(el => {
      const ch = el.id.replace('bgtc-wrap-', '');
      const active = document.getElementById(`bgtc-${ch}-active`).checked;
      channels[ch] = {
        name: el.querySelector('label').textContent.trim(),
        active,
        pct: parseFloat(document.getElementById(`bgtc-${ch}-pct`).value) || 0,
        roas: parseFloat(document.getElementById(`bgtc-${ch}-roas`).value) || 5,
        start_day: parseInt(document.getElementById(`bgtc-${ch}-start`).value) || 1,
        category: document.getElementById(`bgtc-${ch}-category`).value
      };
    });
  }

  const r = await api(`/api/budget/brands/${bgtState.currentBrand.id}/months`, 'POST', {
    label, year, month, total_days: days, revenue_target: target, overall_roas: roas, channels
  });
  if (r && r.ok) { closeMo('mo-bgt-month'); await bgtOpenBrand(bgtState.currentBrand.id); }
}

function bgtOpenCompare() {
  if (!bgtState.currentBrand) return;
  const brandId = bgtState.currentBrand.id;
  
  // Fetch brand's months to populate MoM select lists
  api(`/api/budget/brands/${brandId}/months`).then(months => {
    if (!months || !months.length) return;
    
    const options = months.map(m => `<option value="${m.id}">${m.label}</option>`).join('');
    document.getElementById('bgt-cmp-m1').innerHTML = options;
    document.getElementById('bgt-cmp-m2').innerHTML = options;
    
    if (bgtState.currentMonth) {
      document.getElementById('bgt-cmp-m2').value = bgtState.currentMonth.id;
      if (months.length > 1) {
        document.getElementById('bgt-cmp-m1').value = months[1].id;
      }
    }
  });

  document.getElementById('bgt-cmp-type').value = 'month';
  bgtChangeCompareType();

  openMo('mo-bgt-compare');
}

function bgtChangeCompareType() {
  const type = document.getElementById('bgt-cmp-type').value;
  document.getElementById('bgt-cmp-inputs-mom').style.display = type === 'month' ? 'flex' : 'none';
  document.getElementById('bgt-cmp-inputs-qoq').style.display = type === 'quarter' ? 'flex' : 'none';
  document.getElementById('bgt-cmp-inputs-yoy').style.display = type === 'year' ? 'flex' : 'none';
}

async function bgtRunCompare() {
  if (!bgtState.currentBrand) return;
  const brandId = bgtState.currentBrand.id;
  const type = document.getElementById('bgt-cmp-type').value;
  
  let url = `/api/budget/compare?type=${type}&brand=${brandId}`;
  
  if (type === 'month') {
    const m1 = document.getElementById('bgt-cmp-m1').value;
    const m2 = document.getElementById('bgt-cmp-m2').value;
    if (!m1 || !m2) return alert('Please select both months to compare.');
    url += `&month1=${m1}&month2=${m2}`;
  } else if (type === 'quarter') {
    const q1 = document.getElementById('bgt-cmp-q1').value;
    const q2 = document.getElementById('bgt-cmp-q2').value;
    url += `&q1=${q1}&q2=${q2}`;
  } else if (type === 'year') {
    const y1 = document.getElementById('bgt-cmp-y1').value;
    const y2 = document.getElementById('bgt-cmp-y2').value;
    url += `&y1=${y1}&y2=${y2}`;
  }
  
  closeMo('mo-bgt-compare');
  const data = await api(url);
  if (!data) return;
  showBgtView('compare');
  renderBgtCompare(data);
}

function renderBgtCompare(data) {
  const el = document.getElementById('bgt-compare-content');
  const renderPanel = (p, label) => {
    const s = p.summary;
    const rows = [
      ['Label', p.month.label],
      ['Target Revenue', '₹' + fmt(s.target)],
      ['Achieved Revenue', '₹' + fmt(s.totalSalesReal) + ' (' + s.targetPct + '%)'],
      ['Monthly Budget', '₹' + fmt(s.monthlyBudget)],
      ['Spent to Date', '₹' + fmt(s.totalSpendReal)],
      ['Current ROAS', s.totalROAS ? s.totalROAS + 'x' : '—'],
      ['Projected Revenue', '₹' + fmt(s.projectedSales) + ' (' + s.projTargetPct + '%)'],
      ['Projected Spend', '₹' + fmt(s.projectedSpend)],
      ['Days Left', s.daysLeft],
    ];
    for (const [ch, cs] of Object.entries(s.channelSummary || {})) {
      rows.push([cs.name + ' Sales', '₹' + fmt(cs.salesReal)]);
      rows.push([cs.name + ' Spend', '₹' + fmt(cs.spendReal)]);
    }
    return `<div class="bgt-compare-panel" style="background:var(--navy2);border:1px solid var(--border);border-radius:12px;padding:20px">
      <div class="bgt-compare-label" style="font-weight:800;font-size:16px;color:var(--blue);margin-bottom:14px">${label}</div>
      ${rows.map(([k,v]) => `<div class="bgt-compare-row" style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.02)"><span class="bgt-compare-key" style="color:var(--mid);font-size:12px">${k}</span><span class="bgt-compare-val" style="font-weight:700;font-size:12px">${v}</span></div>`).join('')}
    </div>`;
  };
  el.innerHTML = renderPanel(data.period1, 'Period 1') + renderPanel(data.period2, 'Period 2');
}

function showBgtView(view) {
  ['dashboard','months','month','compare'].forEach(v => {
    const el = document.getElementById(`bgt-${v}-view`);
    if (el) el.style.display = v === view ? '' : 'none';
  });
}
function bgtBackToDashboard() { bgtLoadDashboard(); }
function bgtBackToMonths()    { if (bgtState.currentBrand) bgtOpenBrand(bgtState.currentBrand.id); else bgtLoadDashboard(); }
function bgtBackToMonth()     { if (bgtState.currentMonth) bgtLoadMonth(bgtState.currentMonth.id); else bgtBackToMonths(); }

function fmt(n)  { if (!n && n !== 0) return '—'; const v = parseFloat(n); if (v >= 1e7) return (v/1e7).toFixed(1)+'Cr'; if (v >= 1e5) return (v/1e5).toFixed(1)+'L'; if (v >= 1e3) return (v/1e3).toFixed(1)+'K'; return v.toFixed(0); }
function fmtN(n) { if (!n && n !== 0) return '—'; return parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

function bgtOpenEditMonth() {
  const m = bgtState.currentMonth;
  if (!m) return;
  document.getElementById('bgte-target').value = m.revenue_target;
  document.getElementById('bgte-roas').value = m.overall_roas || 5;
  
  const channels = JSON.parse(m.channels || '{}');
  const container = document.getElementById('bgte-edit-channels-container') || document.querySelector('#mo-bgt-edit .g2').nextElementSibling.nextElementSibling.nextElementSibling;
  
  if (container) {
    container.id = 'bgte-edit-channels-container';
    container.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:220px;overflow-y:auto;padding-right:4px";
    
    let html = '';
    for (const [ch, cfg] of Object.entries(channels)) {
      const active = cfg.active ?? true;
      const name = cfg.name ?? ucfirst(ch);
      const cat = cfg.category || getChannelCategory(ch, cfg);
      html += `
        <div style="border:1px solid var(--border);border-radius:8px;padding:10px" id="bgte-wrap-${ch}">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;margin-bottom:8px">
            <input type="checkbox" id="bgte-${ch}-active" ${active?'checked':''} onchange="bgtToggleEditChannel('${ch}')"> ${name}
          </label>
          <div class="field" style="margin-bottom:6px"><label>% of Revenue</label><input type="number" id="bgte-${ch}-pct" value="${cfg.pct || 0}"></div>
          <div class="field" style="margin-bottom:6px"><label>Target ROAS</label><input type="number" id="bgte-${ch}-roas" value="${cfg.roas || 1}"></div>
          <div class="field" style="margin-bottom:6px"><label>Start Day</label><input type="number" id="bgte-${ch}-start" value="${cfg.start_day || 1}"></div>
          <div class="field">
            <label>Category</label>
            <select id="bgte-${ch}-category" style="width:100%;padding:4px;border:1px solid var(--border);border-radius:6px;font-size:11px">
              <option value="push" ${cat === 'push' ? 'selected' : ''}>Push</option>
              <option value="pull" ${cat === 'pull' ? 'selected' : ''}>Pull</option>
              <option value="retention" ${cat === 'retention' ? 'selected' : ''}>Retention</option>
              <option value="marketplace" ${cat === 'marketplace' ? 'selected' : ''}>Push Marketplace</option>
            </select>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  }
  openMo('mo-bgt-edit');
}

function bgtToggleEditChannel(ch) {
  const active = document.getElementById(`bgte-${ch}-active`).checked;
  ['pct','roas','start','category'].forEach(f => {
    const el = document.getElementById(`bgte-${ch}-${f}`);
    if (el) el.disabled = !active;
  });
}

function bgtAddEditCustomChannel() {
  const name = prompt('Enter custom channel name (e.g. LinkedIn):');
  if (!name) return;
  const ch = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  
  const container = document.getElementById('bgte-edit-channels-container');
  if (!container) return;
  
  const div = document.createElement('div');
  div.style.cssText = "border:1px solid var(--border);border-radius:8px;padding:10px";
  div.id = `bgte-wrap-${ch}`;
  div.innerHTML = `
    <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;margin-bottom:8px">
      <input type="checkbox" id="bgte-${ch}-active" checked onchange="bgtToggleEditChannel('${ch}')"> ${name}
    </label>
    <div class="field" style="margin-bottom:6px"><label>% of Revenue</label><input type="number" id="bgte-${ch}-pct" value="10"></div>
    <div class="field" style="margin-bottom:6px"><label>Target ROAS</label><input type="number" id="bgte-${ch}-roas" value="5" step="0.1"></div>
    <div class="field" style="margin-bottom:6px"><label>Start Day</label><input type="number" id="bgte-${ch}-start" value="1" min="1" max="31"></div>
    <div class="field">
      <label>Category</label>
      <select id="bgte-${ch}-category" style="width:100%;padding:4px;border:1px solid var(--border);border-radius:6px;font-size:11px">
        <option value="push">Push</option>
        <option value="pull">Pull</option>
        <option value="retention">Retention</option>
        <option value="marketplace">Push Marketplace</option>
      </select>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function bgtSubmitEditMonth() {
  const m = bgtState.currentMonth;
  if (!m) return;
  
  const target = parseFloat(document.getElementById('bgte-target').value);
  const roas   = parseFloat(document.getElementById('bgte-roas').value) || 5;
  if (!target) return alert('Revenue target is required');

  const channels = {};
  const container = document.getElementById('bgte-edit-channels-container');
  if (container) {
    container.querySelectorAll('[id^="bgte-wrap-"]').forEach(el => {
      const ch = el.id.replace('bgte-wrap-', '');
      const active = document.getElementById(`bgte-${ch}-active`).checked;
      channels[ch] = {
        name: el.querySelector('label').textContent.trim(),
        active,
        pct: parseFloat(document.getElementById(`bgte-${ch}-pct`).value) || 0,
        roas: parseFloat(document.getElementById(`bgte-${ch}-roas`).value) || 1,
        start_day: parseInt(document.getElementById(`bgte-${ch}-start`).value) || 1,
        category: document.getElementById(`bgte-${ch}-category`).value
      };
    });
  }

  const r = await api(`/api/budget/months/${m.id}/settings`, 'PUT', {
    revenue_target: target,
    overall_roas: roas,
    channels
  });
  if (r && r.ok) {
    closeMo('mo-bgt-edit');
    await bgtLoadMonth(m.id);
  } else {
    alert('Error saving settings. Please check your connection or console.');
  }
}

function ucfirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── REVAMPED PRICING FRONTEND ACTIONS ──────────────────────────────────────
function setPricingViewMode(mode) {}

function renderCatalogBrands() {
  const grid = document.getElementById('catalog-brand-grid');
  if (!allBrands.length) {
    grid.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">No brands available</div></div>';
    return;
  }
  grid.innerHTML = allBrands.map(b => `
    <div class="brand-card" onclick="openBrandCatalog('${b.id}')">
      <div class="bc-icon">📋</div>
      <div class="bc-name">${b.name}</div>
      <div class="bc-meta">${b.industry || '—'}</div>
      <div class="bc-stats">
        <div><div class="bc-sv">${b.product_count || 0}</div><div class="bc-sl">Products</div></div>
      </div>
    </div>`).join('');
}

async function openBrandCatalog(id) {
  const b = allBrands.find(b => b.id === id); if (!b) return;
  catalogActiveBrand = b;
  document.getElementById('catalog-brand-name').textContent = b.name;
  document.getElementById('catalog-brand-meta').textContent = (b.industry || '') + ' · Price Catalog';
  document.getElementById('catalog-search').value = '';

  const r = await api(`/api/pricing/${b.slug}/products`);
  if (!r) return;

  catalogProds = (r.products || []).map(p => {
    const extras = Array.isArray(p.extras_json) ? p.extras_json : [];
    const prodGlobals = migrateOrGetGlobals(p.globals_json);

    const variants = Array.isArray(p.variants_json) ? p.variants_json.map(v => {
      let selling, comp, margin, profit, netProfit, adjC;
      const hasSavedSelling = (v.selling != null && v.selling !== 0) || (v.sellingO != null);

      if (hasSavedSelling) {
        selling   = parseFloat(v.selling || v.sellingO);
        comp      = v.compO != null ? parseFloat(v.compO) : (v.comp != null ? parseFloat(v.comp) : selling * 1.5);
        margin    = (v.margin    != null) ? parseFloat(v.margin)    : 0;
        profit    = (v.profit    != null) ? parseFloat(v.profit)    : 0;
        netProfit = (v.netProfit != null) ? parseFloat(v.netProfit) : profit;
        adjC      = (v.adjC     != null) ? parseFloat(v.adjC)      : 0;
      } else {
        const fallbackP = { ...p, extras, globals: prodGlobals };
        const fallbackV = { ...v, sellingO: null, compO: null };
        const calc = calcVariant(fallbackV, fallbackP, prodGlobals);
        selling   = calc.selling;
        comp      = calc.comp;
        margin    = calc.margin;
        profit    = calc.grossProfit;
        netProfit = calc.netProfit;
        adjC      = calc.adjC;
      }

      return {
        ...v,
        _selling:   selling,
        _comp:      comp,
        _margin:    margin,
        _profit:    profit,
        _netProfit: netProfit,
        _adjC:      adjC,
      };
    }) : [];

    return { ...p, extras, variants, globals: prodGlobals };
  });

  document.getElementById('catalog-brands-view').style.display = 'none';
  document.getElementById('catalog-view-panel').style.display = 'block';

  renderCatalogProducts();
}

function backToCatalogBrands() {
  document.getElementById('catalog-brands-view').style.display = '';
  document.getElementById('catalog-view-panel').style.display = 'none';
  catalogActiveBrand = null;
}

function renderCatalogProducts() {
  const grid = document.getElementById('catalog-products-grid');
  const query = document.getElementById('catalog-search').value.toLowerCase().trim();

  let filtered = catalogProds;
  if (query) {
    filtered = catalogProds.filter(p => {
      const pNameMatch = p.name.toLowerCase().includes(query);
      const vNameMatch = p.variants.some(v => v.name.toLowerCase().includes(query));
      return pNameMatch || vNameMatch;
    });
  }

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🔍</div><div class="empty-title">No matching products found</div></div>';
    document.getElementById('cat-sum-prods').textContent = 0;
    document.getElementById('cat-sum-vars').textContent = 0;
    return;
  }

  let totalVars = 0;

  grid.innerHTML = filtered.map(p => {
    const extraBadges = (p.extras || []).map(e =>
      `<span class="pill warn" style="font-size:10px;padding:2px 6px;margin:2px 0">${e.label}: ${e.amount}</span>`
    ).join(' ');

    const variantsHtml = p.variants.map(v => {
      const selling   = v._selling   || 0;
      const comp      = v._comp      || 0;
      const margin    = v._margin    || 0;
      const profit    = v._profit    || 0;
      const netProfit = v._netProfit != null ? v._netProfit : profit;
      const adjC      = v._adjC      || 0;

      totalVars++;

      const copyText = `${p.name} - ${v.name} | MRP: ₹${comp.toFixed(0)} | Selling Price: ₹${selling}`;

      return `
        <div class="catalog-variant-row" style="margin-top:8px">
          <div class="catalog-variant-top">
            <span class="catalog-variant-name" style="font-weight:700">${v.name}</span>
            <div style="display:flex;gap:4px">
              <button class="btn-copy" onclick="copyVariantDetails('${encodeURIComponent(copyText).replace(/'/g, "%27")}', this)" title="Copy details">📋</button>
              <button class="btn-history" onclick="openVariantHistory('${catalogActiveBrand.id}','${p.id}','${v.id}','${p.name} - ${v.name}')" title="Price history">🕒</button>
            </div>
          </div>
          <div class="catalog-variant-prices">
            <span class="catalog-price-tag selling">₹${selling.toLocaleString('en-IN')}</span>
            <span class="catalog-price-tag comp">₹${comp.toLocaleString('en-IN')}</span>
          </div>
          <div class="catalog-metrics">
            <span class="catalog-metric-item">Adj Cost: <em>₹${adjC.toFixed(0)}</em></span>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="catalog-card">
        <div class="catalog-card-hd">
          <span class="catalog-card-title">${p.name}</span>
          <span class="pill info" style="font-size:10px">${p.variant_type.toUpperCase()}</span>
        </div>
        <div class="catalog-card-body">
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">
            ${extraBadges}
          </div>
          ${variantsHtml}
        </div>
      </div>`;
  }).join('');

  document.getElementById('cat-sum-prods').textContent = filtered.length;
  document.getElementById('cat-sum-vars').textContent = totalVars;
}

function filterCatalog() {
  renderCatalogProducts();
}

function copyVariantDetails(encodedText, btn) {
  const text = decodeURIComponent(encodedText);
  navigator.clipboard.writeText(text).then(() => {
    const old = btn.textContent;
    btn.textContent = '✓';
    btn.style.color = 'var(--green)';
    btn.style.borderColor = 'var(--green)';
    setTimeout(() => {
      btn.textContent = old;
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 1200);
  });
}

async function openVariantHistory(brandId, productId, variantId, variantName) {
  document.getElementById('hist-drawer-subtitle').textContent = variantName;
  const timelineEl = document.getElementById('history-timeline');
  timelineEl.innerHTML = '<div style="font-size:12px;color:var(--mid);padding:12px 0">Loading price logs…</div>';
  
  // Slide in drawer and show dark overlay
  const overlay = document.getElementById('history-drawer-overlay');
  const drawer = document.getElementById('history-drawer');
  overlay.style.display = 'block';
  setTimeout(() => {
    overlay.classList.add('open');
    drawer.style.right = '0';
  }, 50);
  
  const bSlug = activeBrand ? activeBrand.slug : (catalogActiveBrand ? catalogActiveBrand.slug : '');
  if (!bSlug) return;

  try {
    const r = await api(`/api/pricing/${bSlug}/variant_history?variant_id=${variantId}`);
    if (!r || !r.history || !r.history.length) {
      timelineEl.innerHTML = `
        <div class="empty" style="border:none;background:none;padding:24px 0;text-align:center">
          <div style="font-size:24px;margin-bottom:8px">📜</div>
          <div style="font-size:12px;color:var(--mid)">No adjustments logged yet. Future pricing adjustments will be logged automatically.</div>
        </div>`;
      return;
    }
    
    timelineEl.innerHTML = r.history.map(h => {
      const dateStr = new Date(h.created_at).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      
      let diffHtml = '';
      let dotClass = 'cost';
      let actionText = '';
      
      const oldV = parseFloat(h.old_value) || 0;
      const newV = parseFloat(h.new_value) || 0;
      const diff = newV - oldV;
      const sign = diff >= 0 ? '+' : '';
      
      if (h.field_changed === 'selling_price') {
        dotClass = diff >= 0 ? 'up' : 'down';
        actionText = `adjusted the <strong>Selling Price</strong> from <strong>₹${oldV.toFixed(0)}</strong> to <strong>₹${newV.toFixed(0)}</strong>`;
        diffHtml = `<span class="diff-badge ${diff >= 0 ? 'plus' : 'minus'}">${sign}₹${diff.toFixed(0)}</span>`;
      } else if (h.field_changed === 'mfg_cost') {
        dotClass = 'cost';
        actionText = `updated the <strong>Manufacturing Cost</strong> from <strong>₹${oldV.toFixed(0)}</strong> to <strong>₹${newV.toFixed(0)}</strong>`;
        diffHtml = `<span class="diff-badge ${diff >= 0 ? 'plus' : 'minus'}">${sign}₹${diff.toFixed(0)}</span>`;
      } else if (h.field_changed === 'comp_price') {
        dotClass = diff >= 0 ? 'up' : 'down';
        actionText = `adjusted the <strong>Competitor Price</strong> from <strong>₹${oldV.toFixed(0)}</strong> to <strong>₹${newV.toFixed(0)}</strong>`;
        diffHtml = `<span class="diff-badge ${diff >= 0 ? 'plus' : 'minus'}">${sign}₹${diff.toFixed(0)}</span>`;
      }
      
      return `
        <div class="timeline-item">
          <div class="timeline-dot ${dotClass}"></div>
          <div class="timeline-content">
            <span class="timeline-time">${dateStr}</span>
            <div class="timeline-desc">
              <strong>${h.user_name || 'System'}</strong> ${actionText} ${diffHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (err) {
    timelineEl.innerHTML = '<div style="font-size:12px;color:var(--red);padding:12px 0">Failed to load history</div>';
  }
}

function closeHistoryDrawer() {
  const overlay = document.getElementById('history-drawer-overlay');
  const drawer = document.getElementById('history-drawer');
  drawer.style.right = '-450px';
  overlay.classList.remove('open');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 300);
}

// ─── ADMIN ACTIVITY LOGS DEDICATED PAGE ──────────────────────────────────────
let currentActivityRange = 'today';

async function initActivityPage(range = 'today') {
  currentActivityRange = range;
  
  // Highlight active range button/tab
  document.querySelectorAll('#page-activity .bgt-tab').forEach(btn => {
    btn.classList.toggle('active', btn.id === 'act-tab-' + range);
  });
  
  // Show/hide custom date inputs
  const customInputs = document.getElementById('act-custom-date-inputs');
  if (customInputs) {
    customInputs.style.display = (range === 'custom') ? 'flex' : 'none';
  }
  
  // Fetch logs
  let url = `/api/admin?action=audit&range=${range}`;
  if (range === 'custom') {
    const start = document.getElementById('act-start-date').value;
    const end = document.getElementById('act-end-date').value;
    if (start) url += `&start=${start}`;
    if (end) url += `&end=${end}`;
  }
  
  const container = document.getElementById('activity-logs-container');
  if (container) {
    container.innerHTML = `
      <div style="padding:40px 0;text-align:center;color:var(--mid)">
        <span style="display:inline-block;animation:spin 1s linear infinite;margin-right:8px">⌛</span>
        Loading timeline activity...
      </div>
    `;
  }
  
  try {
    const logs = await api(url);
    renderActivityPageLogs(logs);
  } catch (err) {
    console.error(err);
    if (container) {
      container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--red)">Failed to load activity logs: ${err.message}</div>`;
    }
  }
}

function filterActivityRange(range) {
  if (range === 'custom') {
    const today = new Date().toISOString().split('T')[0];
    const startInput = document.getElementById('act-start-date');
    const endInput = document.getElementById('act-end-date');
    if (startInput && !startInput.value) startInput.value = today;
    if (endInput && !endInput.value) endInput.value = today;
  }
  initActivityPage(range);
}

function applyCustomActivityFilter() {
  if (currentActivityRange === 'custom') {
    initActivityPage('custom');
  }
}

function renderActivityPageLogs(logs) {
  const container = document.getElementById('activity-logs-container');
  if (!container) return;
  
  if (!logs || !logs.length) {
    container.innerHTML = `
      <div class="card" style="padding:40px;text-align:center;color:var(--mid)">
        <div style="font-size:32px;margin-bottom:12px">📜</div>
        <div style="font-weight:600;font-size:14px;color:var(--dark)">No activity logs found</div>
        <div style="font-size:12px;margin-top:4px">Try adjusting your range or date filters.</div>
      </div>
    `;
    return;
  }
  
  // Helper to format date strings to local representation
  const getLocalDateString = (dateStr) => {
    const d = new Date(dateStr + 'Z');
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };
  
  const now = new Date();
  const todayStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  
  const startOfWeek = new Date();
  startOfWeek.setDate(now.getDate() - 7);
  
  const groups = {
    'Today': [],
    'Yesterday': [],
    'Earlier this Week': [],
    'Older': []
  };
  
  logs.forEach(l => {
    const d = new Date(l.created_at + 'Z');
    const localStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    
    if (localStr === todayStr) {
      groups['Today'].push(l);
    } else if (localStr === yesterdayStr) {
      groups['Yesterday'].push(l);
    } else if (d >= startOfWeek) {
      groups['Earlier this Week'].push(l);
    } else {
      groups['Older'].push(l);
    }
  });
  
  let html = '';
  
  Object.entries(groups).forEach(([groupName, groupLogs]) => {
    if (!groupLogs.length) return;
    
    html += `
      <div class="activity-group" style="margin-bottom: 24px;">
        <div class="activity-group-title">
          <span>${groupName}</span>
          <span class="activity-group-count">${groupLogs.length} ${groupLogs.length === 1 ? 'operation' : 'operations'}</span>
        </div>
        <div class="activity-timeline">
          ${groupLogs.map(l => {
            const act = l.action;
            let icon = '📝';
            let cls = 'update';
            if (act.includes('LOGIN')) { icon = '🔑'; cls = 'login'; }
            if (act.includes('CREATE')) { icon = '✨'; cls = 'create'; }
            if (act.includes('UPDATE')) { icon = '✏️'; cls = 'update'; }
            if (act.includes('DELETE')) { icon = '🗑️'; cls = 'delete'; }
            if (act.includes('GENERATE')) { icon = '🧠'; cls = 'generate'; }
            
            const d = new Date(l.created_at + 'Z');
            const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            
            const actionText = l.action.replace(/_/g, ' ').toLowerCase();
            
            return `
              <div class="activity-timeline-card ${cls}">
                <div style="font-size:16px;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,0.02);flex-shrink:0">${icon}</div>
                <div style="flex:1;min-width:0">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:4px">
                    <span style="font-weight:700;font-size:12.5px;color:var(--dark)">${l.user_name}</span>
                    <span style="font-size:10px;color:var(--mid);font-family:var(--fm)">${timeStr}</span>
                  </div>
                  <div style="font-size:12px;color:var(--body);margin-top:4px;display:flex;align-items:baseline;flex-wrap:wrap;gap:6px">
                    <span class="pill sm ${cls}" style="font-size:8.5px;font-weight:800;text-transform:uppercase;padding:2px 6px;border-radius:4px;flex-shrink:0">${actionText}</span>
                    <span style="line-height:1.4">${l.detail}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// ─── REPORTS GENERATOR PAGE ──────────────────────────────────────────────────
let reportsChartSpend = null;
let reportsChartRevenue = null;
let reportsChartEfficiency = null;
let reportsChartRadar = null;
let reportsChartFunnel = null;
let activeReportId = null;

let allReportsCache = [];

async function initReportsPage() {
  const list = document.getElementById('reports-tbody');
  
  // Reset subviews
  document.getElementById('reports-list-view').style.display = 'block';
  document.getElementById('reports-create-view').style.display = 'none';
  document.getElementById('reports-detail-view').style.display = 'none';
  
  // Initialize brand filter select
  const brandFilter = document.getElementById('reports-filter-brand');
  if (brandFilter) {
    brandFilter.innerHTML = '<option value="">All Brands</option>' + 
      allBrands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    if (!brandFilter.dataset.initialized) {
      brandFilter.value = activeBrand ? activeBrand.id : '';
      brandFilter.dataset.initialized = 'true';
    }
  }

  list.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--mid);padding:24px 0">Loading reports…</td></tr>`;
  try {
    const r = await api('/api/reports?action=list');
    allReportsCache = r || [];
    renderReportsListTable();
  } catch (e) {
    list.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--red);padding:24px 0">Failed to load reports: ${e.message}</td></tr>`;
  }
}

function filterReportsList() {
  renderReportsListTable();
}

function handleReportBrandFilterChange(val) {
  activeBrand = allBrands.find(b => b.id === val) || null;
  updateBrandUI();
  filterReportsList();
}

function renderReportsListTable() {
  const list = document.getElementById('reports-tbody');
  if (!list) return;

  const brandFilterVal = document.getElementById('reports-filter-brand')?.value || '';
  const typeFilterVal = document.getElementById('reports-filter-type')?.value || '';

  const filtered = allReportsCache.filter(h => {
    const matchesBrand = !brandFilterVal || h.brand_id === brandFilterVal;
    const matchesType = h.report_type === 'weekly' || !h.report_type;
    return matchesBrand && matchesType;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--mid);padding:24px 0">No reports found matching the filters.</td></tr>`;
    return;
  }

  list.innerHTML = filtered.map(h => {
    const start = new Date(h.period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const end = new Date(h.period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const shareUrl = `${window.location.origin}/report.html?token=${h.unique_token}`;
    return `
      <tr>
        <td style="font-weight:700;color:var(--dark)">${h.brand_name || '—'}</td>
        <td style="font-weight:600;text-transform:capitalize">${h.report_type}</td>
        <td style="font-family:var(--fm)">${start} - ${end}</td>
        <td style="font-family:var(--fm)">₹${parseFloat(h.total_spend).toLocaleString('en-IN')}</td>
        <td style="font-family:var(--fm)">₹${parseFloat(h.total_revenue).toLocaleString('en-IN')}</td>
        <td style="font-family:var(--fm);font-weight:700">${h.overall_roas}x</td>
        <td style="font-family:var(--fm)">${h.view_count} views</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <input type="text" value="${shareUrl}" readonly style="width:160px;font-size:10px;padding:3px 6px;border:1px solid var(--border);border-radius:4px" onclick="this.select()">
            <a href="${shareUrl}" target="_blank" class="btn sm" style="padding:4px 8px;text-decoration:none;display:inline-flex;align-items:center;gap:4px" title="Open client report in new tab">🔗 Open</a>
          </div>
        </td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn sm" onclick="loadReportDetails('${h.id}')">View</button>
            <button class="btn sm danger" onclick="deleteReport('${h.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openClientReport() {
  const shareUrl = document.getElementById('rep-share-link-input')?.value;
  if (shareUrl) {
    window.open(shareUrl, '_blank');
  }
}

function openCreateReport() {
  if (!activeBrand) return alert('Please select a brand first.');
  document.getElementById('reports-list-view').style.display = 'none';
  document.getElementById('reports-create-view').style.display = 'block';
  document.getElementById('reports-create-brand-meta').textContent = `${activeBrand.name} · Report Creator`;
  
  // Set default dates
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById('rep-start-date').value = firstDay.toISOString().split('T')[0];
  document.getElementById('rep-end-date').value = today.toISOString().split('T')[0];
  
  handleReportTypeChange();
}

function backToReportsList() {
  initReportsPage();
}

function handleReportTypeChange() {
  const type = document.querySelector('input[name="rep-type"]:checked').value;
  const startEl = document.getElementById('rep-start-date');
  const endEl = document.getElementById('rep-end-date');
  const today = new Date();
  
  if (type === 'weekly') {
    // Default to last completed week Mon-Sun
    const prevMon = new Date();
    prevMon.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) - 7);
    const prevSun = new Date(prevMon);
    prevSun.setDate(prevMon.getDate() + 6);
    
    startEl.value = prevMon.toISOString().split('T')[0];
    endEl.value = prevSun.toISOString().split('T')[0];
  } else {
    // Default to last full calendar month
    const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    
    startEl.value = firstDayLastMonth.toISOString().split('T')[0];
    endEl.value = lastDayLastMonth.toISOString().split('T')[0];
  }
  
  checkReportMissingData();
}

async function checkReportMissingData() {
  if (!activeBrand) return;
  const start = document.getElementById('rep-start-date').value;
  const end = document.getElementById('rep-end-date').value;
  if (!start || !end) return;
  
  try {
    const r = await api(`/api/reports?action=check_missing&brand_id=${activeBrand.id}&start_date=${start}&end_date=${end}`);
    const alertEl = document.getElementById('reports-missing-alert');
    const formsEl = document.getElementById('reports-missing-forms');
    
    if (r && r.missing && r.missing.length > 0) {
      alertEl.style.display = 'block';
      const channels = (activeBrand.channels_config && Array.isArray(activeBrand.channels_config) && activeBrand.channels_config.length > 0) 
        ? activeBrand.channels_config 
        : ['meta', 'google'];

      formsEl.innerHTML = r.missing.map((date) => `
        <div class="card reports-missing-day-card" data-date="${date}" style="padding:14px;border-left:4px solid var(--amber)">
          <div style="font-weight:700;font-size:12px;color:var(--dark);margin-bottom:10px">${date} — Enter performance data per channel</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            ${channels.map(ch => `
            <div style="background:var(--off);padding:10px;border-radius:8px;border:1px solid var(--border)">
              <div style="font-weight:700;font-size:11px;color:var(--mid);text-transform:uppercase;margin-bottom:8px">${ch}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" data-channel="${ch}">
                <div class="field"><label style="font-size:9px">Spend (₹)</label><input type="number" class="ch-sp" placeholder="0" style="padding:6px;height:30px"></div>
                <div class="field"><label style="font-size:9px">Revenue (₹)</label><input type="number" class="ch-rev" placeholder="0" style="padding:6px;height:30px"></div>
                <div class="field"><label style="font-size:9px">Orders</label><input type="number" class="ch-ord" placeholder="0" style="padding:6px;height:30px"></div>
                <div class="field"><label style="font-size:9px">Customers Acquired</label><input type="number" class="ch-cust" placeholder="0" style="padding:6px;height:30px"></div>
                <div class="field"><label style="font-size:9px">Clicks</label><input type="number" class="ch-clk" placeholder="0" style="padding:6px;height:30px"></div>
                <div class="field"><label style="font-size:9px">Sessions</label><input type="number" class="ch-imp" placeholder="0" style="padding:6px;height:30px"></div>
              </div>
            </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    } else {
      alertEl.style.display = 'none';
      formsEl.innerHTML = '';
    }
  } catch (e) {
    console.error('Check missing data error:', e);
  }
}

async function submitGenerateReport() {
  const type = document.querySelector('input[name="rep-type"]:checked').value;
  const start = document.getElementById('rep-start-date').value;
  const end = document.getElementById('rep-end-date').value;
  
  if (!start || !end) return alert('Please enter start and end dates.');
  
  const generateBtn = document.getElementById('btn-generate-report');
  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating…';
  
  try {
    // 0. Force check missing data if not rendered
    const rCheck = await api(`/api/reports?action=check_missing&brand_id=${activeBrand.id}&start_date=${start}&end_date=${end}`);
    if (rCheck && rCheck.missing && rCheck.missing.length > 0) {
      const cards = document.querySelectorAll('.reports-missing-day-card');
      if (cards.length === 0) {
        await checkReportMissingData();
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Report';
        return alert('Missing data detected! Please fill in the highlighted fields or click Generate again to proceed with 0s.');
      }
    }
    
    // 1. Gather and save missing data if forms exist
    const cards = document.querySelectorAll('.reports-missing-day-card');
    if (cards.length > 0) {
      const missingData = [];
      cards.forEach(card => {
        const date = card.dataset.date;
        const channels = {};
        let hasAnyData = false;

        card.querySelectorAll('[data-channel]').forEach(chDiv => {
          const ch = chDiv.dataset.channel;
          const spend = parseFloat(chDiv.querySelector('.ch-sp')?.value) || 0;
          const sales = parseFloat(chDiv.querySelector('.ch-rev')?.value) || 0;
          const orders = parseInt(chDiv.querySelector('.ch-ord')?.value) || 0;
          const custAcq = parseInt(chDiv.querySelector('.ch-cust')?.value) || 0;
          const clicks = parseInt(chDiv.querySelector('.ch-clk')?.value) || 0;
          const impressions = parseInt(chDiv.querySelector('.ch-imp')?.value) || 0;
          channels[ch] = { spend, sales, conversions: orders, customers_acquired: custAcq, clicks, impressions };
          if (spend > 0 || sales > 0 || orders > 0) hasAnyData = true;
        });

        if (hasAnyData) {
          missingData.push({ date, channels });
        }
      });
      
      if (missingData.length > 0) {
        await api('/api/reports?action=save_missing', 'POST', { brand_id: activeBrand.id, missing_data: missingData });
      }
    }
    
    // 2. Request report generation (which runs AI summaries dynamically)
    const r = await api('/api/reports?action=create', 'POST', {
      brand_id: activeBrand.id,
      report_type: type,
      start_date: start,
      end_date: end
    });
    
    if (r && r.report_id) {
      loadReportDetails(r.report_id);
    } else {
      alert('Failed to generate report.');
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Report';
    }
  } catch (e) {
    alert('Error generating report: ' . e.message);
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Report';
  }
}

async function loadReportDetails(reportId) {
  try {
    const r = await api(`/api/reports?action=view&id=${reportId}`);
    if (!r) return;
    
    activeReportId = reportId;
    document.getElementById('reports-create-view').style.display = 'none';
    document.getElementById('reports-list-view').style.display = 'none';
    document.getElementById('reports-detail-view').style.display = 'block';
    
    const data = r.report_data;
    
    // Setup titles
    const startStr = new Date(r.period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const endStr = new Date(r.period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('rep-detail-title').textContent = `${r.report_type.toUpperCase()} Performance Report`;
    document.getElementById('rep-detail-meta').textContent = `${r.brand_name} · ${startStr} - ${endStr}`;
    
    // Setup KPIs
    document.getElementById('rep-kpi-spend').textContent = `₹${parseFloat(r.total_spend).toLocaleString('en-IN')}`;
    document.getElementById('rep-kpi-sales').textContent = `₹${parseFloat(r.total_revenue).toLocaleString('en-IN')}`;
    document.getElementById('rep-kpi-roas').textContent = `${parseFloat(r.overall_roas).toFixed(2)}x`;
    document.getElementById('rep-kpi-orders').textContent = parseInt(r.total_conversions).toLocaleString('en-IN');
    document.getElementById('rep-kpi-cpa').textContent = `₹${parseFloat(r.overall_cpa).toLocaleString('en-IN')}`;
    document.getElementById('rep-kpi-aov').textContent = `₹${parseFloat(r.overall_aov).toLocaleString('en-IN')}`;
    
    // WoW Badges
    const comps = data.comparisons || {};
    const formatBadge = (val, id, lowerIsBetter = false) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (val === null || val === undefined) {
        el.textContent = 'N/A (First Report)'; el.className = 'bgt-stat-sub';
        return;
      }
      const num = parseFloat(val);
      if (isNaN(num) || num === 0) {
        el.textContent = 'WoW: 0%'; el.className = 'bgt-stat-sub';
        return;
      }
      const sign = num > 0 ? '+' : '';
      el.textContent = `WoW: ${sign}${num}%`;
      const isGood = lowerIsBetter ? (num < 0) : (num > 0);
      el.className = isGood ? 'bgt-stat-sub good' : 'bgt-stat-sub bad';
    };
    
    formatBadge(comps.spend, 'rep-change-spend', true);
    formatBadge(comps.revenue, 'rep-change-sales');
    formatBadge(comps.roas, 'rep-change-roas');
    formatBadge(comps.conversions, 'rep-change-orders');
    formatBadge(comps.cpa, 'rep-change-cpa', true);
    formatBadge(comps.aov, 'rep-change-aov');
    
    // Notes
    document.getElementById('rep-notes-hl').value = (r.highlights || '').replace(/<br>/g, '\n').replace(/• /g, '');
    document.getElementById('rep-notes-ns').value = (r.next_steps || '').replace(/<br>/g, '\n').replace(/• /g, '');
    
    // Client Share URL
    const shareUrl = `${window.location.origin}/report.html?token=${r.unique_token}`;
    document.getElementById('rep-share-link-input').value = shareUrl;
    
    // Populate Channel Table
    const activeChannels = {};
    const untappedChannels = {};
    
    Object.entries(data.channels || {}).forEach(([ch, m]) => {
      const revVal = parseFloat(m.revenue || m.sales) || 0;
      if ((m.spend && parseFloat(m.spend) > 0) || revVal > 0 || (m.conversions && parseInt(m.conversions) > 0)) {
        activeChannels[ch] = m;
      } else {
        untappedChannels[ch] = m;
      }
    });

    // Populate brand chip in detail header
    const brandPill = document.getElementById('rep-detail-brand-pill');
    if (brandPill) brandPill.textContent = r.brand_name || '';

    const tbody = document.getElementById('rep-channel-tbody');
    tbody.innerHTML = Object.entries(activeChannels).map(([ch, m]) => {
      const spend    = parseFloat(m.spend) || 0;
      const revenue  = parseFloat(m.revenue || m.sales) || 0;
      const orders   = parseInt(m.conversions) || 0;
      const custAcq  = parseInt(m.customers_acquired) || 0;
      const roas     = parseFloat(m.roas) || (spend > 0 ? (revenue / spend) : 0);
      const cpa      = parseFloat(m.cpa) || (custAcq > 0 ? (spend / custAcq) : (orders > 0 ? (spend / orders) : 0));
      const aov      = orders > 0 ? Math.round(revenue / orders) : 0;
      return `
      <tr>
        <td style="font-weight:700;text-transform:capitalize">${ch}</td>
        <td style="font-family:var(--fm)">₹${spend.toLocaleString('en-IN')}</td>
        <td style="font-family:var(--fm)">${orders.toLocaleString('en-IN')}</td>
        <td style="font-family:var(--fm)">${custAcq > 0 ? custAcq.toLocaleString('en-IN') : '—'}</td>
        <td style="font-family:var(--fm)">₹${revenue.toLocaleString('en-IN')}</td>
        <td style="font-family:var(--fm)">₹${Math.round(cpa).toLocaleString('en-IN')}</td>
        <td style="font-family:var(--fm)">₹${aov.toLocaleString('en-IN')}</td>
        <td style="font-family:var(--fm);font-weight:700">${roas.toFixed(2)}x</td>
      </tr>
    `;
    }).join('');
    
    const untappedContainer = document.getElementById('rep-untapped-container');
    if (untappedContainer) {
      if (Object.keys(untappedChannels).length > 0) {
        untappedContainer.style.display = 'block';
        untappedContainer.innerHTML = Object.keys(untappedChannels).map(ch => `
          <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); padding:15px; border-radius:10px; margin-top:10px;">
            <div style="color:var(--emerald); font-weight:700; text-transform:capitalize; margin-bottom:5px;">✨ ${ch} Ads</div>
            <div style="color:var(--mid); font-size:13px;">No spend was allocated to ${ch} this period. Activating this channel could be a strong opportunity to scale reach and acquire net-new customers.</div>
          </div>
        `).join('');
      } else {
        untappedContainer.style.display = 'none';
      }
    }
    
    // Draw charts - double requestAnimationFrame ensures DOM is painted before Chart.js draws
    requestAnimationFrame(() => requestAnimationFrame(() =>
      renderReportCharts(activeChannels, data.totals || {})
    ));
    
  } catch (e) {
    alert('Failed to load report: ' + e.message);
  }
}

function renderReportCharts(channels, totals) {
  const labels = Object.keys(channels).map(c => c.charAt(0).toUpperCase() + c.slice(1));
  const spendData = Object.values(channels).map(c => c.spend);
  const revenueData = Object.values(channels).map(c => parseFloat(c.revenue || c.sales) || 0);
  
  const colors = ['#2B4EFF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  
  if (reportsChartSpend) reportsChartSpend.destroy();
  if (reportsChartRevenue) reportsChartRevenue.destroy();
  if (reportsChartEfficiency) reportsChartEfficiency.destroy();
  if (reportsChartRadar) reportsChartRadar.destroy();
  if (reportsChartFunnel) reportsChartFunnel.destroy();
  
  const ctxSpend = document.getElementById('rep-spend-chart').getContext('2d');
  reportsChartSpend = new Chart(ctxSpend, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: spendData,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 2,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } }
      }
    }
  });

  const ctxRev = document.getElementById('rep-revenue-chart').getContext('2d');
  reportsChartRevenue = new Chart(ctxRev, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: revenueData,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 2,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } }
      }
    }
  });

  // ROI & Efficiency
  const ctxEff = document.getElementById('rep-efficiency-chart').getContext('2d');
  const roasData = Object.values(channels).map(c => parseFloat(c.roas) || 0);
  const cpaData = Object.values(channels).map(c => parseFloat(c.cpa) || 0);
  reportsChartEfficiency = new Chart(ctxEff, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'ROAS', data: roasData, backgroundColor: 'rgba(16, 185, 129, 0.7)', yAxisID: 'y' },
        { label: 'CPA (₹)', data: cpaData, backgroundColor: 'rgba(245, 158, 11, 0.7)', yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, devicePixelRatio: 2,
      scales: {
        y: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.05)' } },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } },
        x: { grid: { color: 'rgba(255,255,255,0.05)' } }
      },
      plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } } }
    }
  });

  // Spend vs Revenue (Grouped Bar with log scale)
  const ctxRadar = document.getElementById('rep-radar-chart').getContext('2d');
  reportsChartRadar = new Chart(ctxRadar, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Spend', data: spendData, backgroundColor: 'rgba(43, 78, 255, 0.7)', borderColor: '#2B4EFF', borderWidth: 1, borderRadius: 4 },
        { label: 'Revenue', data: revenueData, backgroundColor: 'rgba(16, 185, 129, 0.7)', borderColor: '#10B981', borderWidth: 1, borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, devicePixelRatio: 2,
      scales: {
        y: {
          type: 'logarithmic',
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            callback: function(v) { return '₹' + v.toLocaleString('en-IN'); }
          }
        },
        x: { grid: { color: 'rgba(255,255,255,0.05)' } }
      },
      plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } } }
    }
  });
}

async function saveReportNotes() {
  if (!activeReportId) return;
  const hlRaw = document.getElementById('rep-notes-hl').value;
  const nsRaw = document.getElementById('rep-notes-ns').value;

  const format = str => str.trim().split('\n').filter(s => s).map(s => `• ${s.replace(/^•\s*/, '')}`).join('<br>');

  const highlights = format(hlRaw);
  const blockers = '';
  const next_steps = format(nsRaw);
  
  try {
    const r = await api('/api/reports?action=save_notes', 'POST', {
      id: activeReportId,
      highlights,
      blockers,
      next_steps
    });
    if (r && r.ok) {
      showToast('Client notes saved successfully!', 'success');
    }
  } catch (e) {
    alert('Failed to save notes: ' + e.message);
  }
}

function copyReportShareLink() {
  const input = document.getElementById('rep-share-link-input');
  input.select();
  document.execCommand('copy');
  
  const btn = document.getElementById('btn-copy-share-link');
  btn.textContent = '✓ Copied Link';
  setTimeout(() => { btn.textContent = '🔗 Copy Share Link'; }, 2000);
  
  showToast('Link copied to clipboard!', 'success');
}

function printReportDetail() {
  window.print();
}

async function deleteReport(reportId) {
  if (!confirm('Are you sure you want to delete this report? This will invalidate the client link permanently.')) return;
  try {
    const r = await api(`/api/reports?action=delete&id=${reportId}`, 'DELETE');
    if (r && r.ok) {
      initReportsPage();
    }
  } catch (e) {
    alert('Failed to delete report: ' + e.message);
  }
}

let currentEditReportData = null;

async function openEditReportDataModal() {
  if (!activeReportId) return;
  try {
    const r = await api(`/api/reports?action=view&id=${activeReportId}`);
    if (!r) return;
    
    currentEditReportData = r;
    const data = r.report_data;
    const channels = data.channels || {};
    
    const container = document.getElementById('edit-report-channels-container');
    container.innerHTML = '';
    
    // Add existing report channels
    Object.entries(channels).forEach(([chName, metrics]) => {
      const rowHtml = createEditChannelRow(chName, metrics);
      container.insertAdjacentHTML('beforeend', rowHtml);
    });
    
    // Also add configured brand channels if they aren't already added
    const brandChannels = (activeBrand.channels_config && Array.isArray(activeBrand.channels_config)) 
      ? activeBrand.channels_config 
      : ['meta', 'google'];
      
    brandChannels.forEach(chName => {
      if (!channels[chName]) {
        const rowHtml = createEditChannelRow(chName, { spend: 0, revenue: 0, conversions: 0, customers_acquired: 0, clicks: 0, impressions: 0 });
        container.insertAdjacentHTML('beforeend', rowHtml);
      }
    });
    
    openMo('mo-edit-report-data');
  } catch (e) {
    alert("Failed to load report data: " + e.message);
  }
}

function createEditChannelRow(chName, m) {
  const spend = parseFloat(m.spend) || 0;
  const revenue = parseFloat(m.revenue || m.sales) || 0;
  const conversions = parseInt(m.conversions) || 0;
  const customers_acquired = parseInt(m.customers_acquired) || 0;
  const clicks = parseInt(m.clicks) || 0;
  const impressions = parseInt(m.impressions) || 0;
  
  const roas = spend > 0 ? (revenue / spend).toFixed(2) : '0.00';
  const cpaDenominator = customers_acquired > 0 ? customers_acquired : conversions;
  const cpa = cpaDenominator > 0 ? Math.round(spend / cpaDenominator) : 0;
  const aov = conversions > 0 ? Math.round(revenue / conversions) : 0;
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';

  return `
    <div class="edit-channel-card" data-edit-channel="${chName}" style="background:var(--off);padding:12px;border-radius:8px;border:1px solid var(--border);margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-weight:700;text-transform:capitalize;font-size:12px;color:var(--dark)">${chName}</span>
        <button class="btn sm danger" onclick="this.closest('.edit-channel-card').remove()" style="padding:2px 6px;font-size:10px">Remove</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(100px, 1fr));gap:8px">
        <div class="field" style="margin-bottom:0">
          <label style="font-size:9px;margin-bottom:2px">Spend (₹)</label>
          <input type="number" class="ch-edit-spend" value="${spend}" style="padding:4px;height:28px;font-size:11px" oninput="recalculateEditRowMetrics('${chName}')">
        </div>
        <div class="field" style="margin-bottom:0">
          <label style="font-size:9px;margin-bottom:2px">Revenue (₹)</label>
          <input type="number" class="ch-edit-revenue" value="${revenue}" style="padding:4px;height:28px;font-size:11px" oninput="recalculateEditRowMetrics('${chName}')">
        </div>
        <div class="field" style="margin-bottom:0">
          <label style="font-size:9px;margin-bottom:2px">Orders</label>
          <input type="number" class="ch-edit-orders" value="${conversions}" style="padding:4px;height:28px;font-size:11px" oninput="recalculateEditRowMetrics('${chName}')">
        </div>
        <div class="field" style="margin-bottom:0">
          <label style="font-size:9px;margin-bottom:2px">Customers</label>
          <input type="number" class="ch-edit-customers" value="${customers_acquired}" style="padding:4px;height:28px;font-size:11px" oninput="recalculateEditRowMetrics('${chName}')">
        </div>
        <div class="field" style="margin-bottom:0">
          <label style="font-size:9px;margin-bottom:2px">Sessions</label>
          <input type="number" class="ch-edit-impressions" value="${impressions}" style="padding:4px;height:28px;font-size:11px" oninput="recalculateEditRowMetrics('${chName}')">
        </div>
        <div class="field" style="margin-bottom:0">
          <label style="font-size:9px;margin-bottom:2px">Clicks</label>
          <input type="number" class="ch-edit-clicks" value="${clicks}" style="padding:4px;height:28px;font-size:11px" oninput="recalculateEditRowMetrics('${chName}')">
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;font-size:10px;color:var(--mid)">
        <span>ROAS: <strong class="ch-edit-roas-lbl">${roas}x</strong></span>
        <span>CPA: <strong class="ch-edit-cpa-lbl">₹${cpa.toLocaleString('en-IN')}</strong></span>
        <span>AOV: <strong class="ch-edit-aov-lbl">₹${aov.toLocaleString('en-IN')}</strong></span>
        <span>CTR: <strong class="ch-edit-ctr-lbl">${ctr}%</strong></span>
      </div>
    </div>
  `;
}

function recalculateEditRowMetrics(chName) {
  const row = document.querySelector(`[data-edit-channel="${chName}"]`);
  if (!row) return;
  const spend = parseFloat(row.querySelector('.ch-edit-spend').value) || 0;
  const revenue = parseFloat(row.querySelector('.ch-edit-revenue').value) || 0;
  const orders = parseInt(row.querySelector('.ch-edit-orders').value) || 0;
  const customers = parseInt(row.querySelector('.ch-edit-customers').value) || 0;
  const impressions = parseInt(row.querySelector('.ch-edit-impressions').value) || 0;
  const clicks = parseInt(row.querySelector('.ch-edit-clicks').value) || 0;

  const roas = spend > 0 ? (revenue / spend).toFixed(2) : '0.00';
  const cpaDenom = customers > 0 ? customers : orders;
  const cpa = cpaDenom > 0 ? Math.round(spend / cpaDenom) : 0;
  const aov = orders > 0 ? Math.round(revenue / orders) : 0;
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';

  row.querySelector('.ch-edit-roas-lbl').textContent = `${roas}x`;
  row.querySelector('.ch-edit-cpa-lbl').textContent = `₹${cpa.toLocaleString('en-IN')}`;
  row.querySelector('.ch-edit-aov-lbl').textContent = `₹${aov.toLocaleString('en-IN')}`;
  row.querySelector('.ch-edit-ctr-lbl').textContent = `${ctr}%`;
}

function addChannelToEditModal() {
  const chNameRaw = prompt("Enter new channel name (e.g. flipkart, amazon, pinterest):");
  if (!chNameRaw) return;
  const chName = chNameRaw.trim().toLowerCase();
  if (!chName) return;
  
  if (document.querySelector(`[data-edit-channel="${chName}"]`)) {
    return alert("Channel already exists!");
  }
  
  const container = document.getElementById('edit-report-channels-container');
  const rowHtml = createEditChannelRow(chName, { spend: 0, revenue: 0, conversions: 0, customers_acquired: 0, clicks: 0, impressions: 0 });
  container.insertAdjacentHTML('beforeend', rowHtml);
}

async function submitEditReportData() {
  if (!activeReportId || !currentEditReportData) return;

  const cards = document.querySelectorAll('.edit-channel-card');
  const updatedChannels = {};

  let totalSpend = 0;
  let totalRevenue = 0;
  let totalConversions = 0;
  let totalCustomers = 0;
  let totalClicks = 0;
  let totalImpressions = 0;

  cards.forEach(card => {
    const chName = card.dataset.editChannel;
    const spend = parseFloat(card.querySelector('.ch-edit-spend').value) || 0;
    const revenue = parseFloat(card.querySelector('.ch-edit-revenue').value) || 0;
    const conversions = parseInt(card.querySelector('.ch-edit-orders').value) || 0;
    const customers_acquired = parseInt(card.querySelector('.ch-edit-customers').value) || 0;
    const clicks = parseInt(card.querySelector('.ch-edit-clicks').value) || 0;
    const impressions = parseInt(card.querySelector('.ch-edit-impressions').value) || 0;

    if (spend > 0 || revenue > 0 || conversions > 0 || clicks > 0 || impressions > 0 || customers_acquired > 0) {
      const cpaDenom = customers_acquired > 0 ? customers_acquired : conversions;
      updatedChannels[chName] = {
        spend,
        revenue,
        conversions,
        customers_acquired,
        clicks,
        impressions,
        roas: spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0.0,
        cpa: cpaDenom > 0 ? parseFloat((spend / cpaDenom).toFixed(2)) : 0.0,
        ctr: impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0.0
      };

      totalSpend += spend;
      totalRevenue += revenue;
      totalConversions += conversions;
      totalCustomers += customers_acquired;
      totalClicks += clicks;
      totalImpressions += impressions;
    }
  });

  const totalCpaDenom = totalCustomers > 0 ? totalCustomers : totalConversions;
  const updatedTotals = {
    spend: totalSpend,
    revenue: totalRevenue,
    conversions: totalConversions,
    customers_acquired: totalCustomers,
    clicks: totalClicks,
    impressions: totalImpressions,
    roas: totalSpend > 0 ? parseFloat((totalRevenue / totalSpend).toFixed(2)) : 0.0,
    cpa: totalCpaDenom > 0 ? parseFloat((totalSpend / totalCpaDenom).toFixed(2)) : 0.0,
    aov: totalConversions > 0 ? parseFloat((totalRevenue / totalConversions).toFixed(2)) : 0.0,
    ctr: totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0.0
  };
  
  try {
    const r = await api('/api/reports?action=update_data', 'POST', {
      report_id: activeReportId,
      channels: updatedChannels,
      totals: updatedTotals
    });
    
    if (r && r.ok) {
      closeMo('mo-edit-report-data');
      showToast('Report performance data updated successfully!', 'success');
      loadReportDetails(activeReportId);
    }
  } catch (e) {
    alert('Failed to update report data: ' + e.message);
  }
}




// === BRAND INTELLIGENCE ENGINE CONTROLLER ===

let _ciIntelligence=null,_ciQuestions=[],_ciSources=[],_ciModules={},_ciCurrentTab='',_ciFounderAnswers={},_ciBrandName='',_ciBrandUrl='';
const CI_MODULES=[{id:'diagnosis',label:'🔍 Diagnosis'},{id:'market_intelligence',label:'📊 Market'},{id:'customer_map',label:'👤 Customer'},{id:'brand_voice',label:'✍️ Brand Voice'},{id:'growth_playbook',label:'📣 Growth'},{id:'crm_retention',label:'📧 CRM'},{id:'revenue_model',label:'💰 Revenue'},{id:'execution_plan',label:'📅 90-Day Plan'},{id:'risk_scenarios',label:'⚠️ Risks'}];
const CI_SCORE_LABELS={product_differentiation:'Product Differentiation',online_presence:'Online Presence & SEO',customer_sentiment:'Customer Sentiment',content_quality:'Content Quality',competitive_positioning:'Competitive Positioning',brand_clarity:'Brand Clarity',revenue_model_strength:'Revenue Model Strength',growth_momentum:'Growth Momentum'};

function goToPhase(n){for(let i=1;i<=5;i++){const ph=document.getElementById('c-phase-'+i),st=document.getElementById('c-step-'+i);if(ph)ph.style.display=(i===n)?'':'none';if(st){st.classList.toggle('active',i===n);st.classList.toggle('done',i<n);}}}
function selectDepth(d){['standard','deep'].forEach(v=>{const el=document.getElementById('depth-opt-'+v);if(el)el.style.borderColor=(v===d)?'var(--blue)':'var(--border)';});}

function initConsultantPage(){
  const b=activeBrand,badge=document.getElementById('consultant-active-brand-badge');
  if(!b){if(badge)badge.textContent='No brand selected';return;}
  if(badge){badge.textContent='🏷 '+b.name;badge.style.background='rgba(43,78,255,0.1)';badge.style.color='var(--blue)';}
  const ne=document.getElementById('c-crawl-name'),ue=document.getElementById('c-crawl-url');
  if(ne&&!ne.value)ne.value=b.name||'';
  if(ue&&!ue.value)ue.value=b.website||'';
  fetch('api/consultant.php?action=load&brand_id='+encodeURIComponent(b.id)).then(r=>r.json()).then(d=>{
    if(d&&!d.empty&&d.modules_json&&Object.keys(d.modules_json).length){
      _ciBrandName=d.brand_name||b.name;_ciBrandUrl=d.brand_url||'';
      if(d.crawled_json)_ciIntelligence=d.crawled_json;
      _ciModules=d.modules_json;renderDocumentWorkspace();goToPhase(4);
    }
  }).catch(()=>{});
  loadIntelKeysToUI();injectConsultantStyles();
}

function startDeepCrawl(){
  const name=(document.getElementById('c-crawl-name')||{value:''}).value.trim();
  const url=(document.getElementById('c-crawl-url')||{value:''}).value.trim();
  if(!name){alert('Please enter a brand name.');return;}
  _ciBrandName=name;_ciBrandUrl=url;_ciModules={};_ciIntelligence=null;
  const feedEl=document.getElementById('c-intel-feed'),startBtn=document.getElementById('c-start-crawl-btn');
  if(feedEl)feedEl.style.display='';
  if(startBtn){startBtn.disabled=true;startBtn.textContent='⏳ Crawling...';}
  const feedLog=document.getElementById('c-feed-log');
  if(feedLog)feedLog.innerHTML='';
  function appendLog(msg,color){if(!feedLog)return;const d=document.createElement('div');if(color)d.style.color=color;d.textContent=msg;feedLog.appendChild(d);feedLog.scrollTop=feedLog.scrollHeight;}
  function setProgress(pct){const bar=document.getElementById('c-feed-progress-bar'),pEl=document.getElementById('c-feed-pct');if(bar)bar.style.width=pct+'%';if(pEl)pEl.textContent=pct+'%';}
  fetch('api/consultant.php?action=deep_crawl',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brand_name:name,brand_url:url})})
  .then(async res=>{
    const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';
    while(true){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const parts=buffer.split('\n\n');buffer=parts.pop();
      for(const part of parts){const lines=part.split('\n');let event='message',data='';for(const line of lines){if(line.startsWith('event: '))event=line.slice(7);if(line.startsWith('data: '))data=line.slice(6);}
        if(!data)continue;let payload;try{payload=JSON.parse(data);}catch{continue;}
        if(event==='progress'){appendLog(payload.message);setProgress(payload.pct||0);}
        else if(event==='start'){appendLog('🚀 '+payload.message,'var(--blue)');}
        else if(event==='done'){
          _ciIntelligence=payload.intelligence;_ciQuestions=payload.questions||[];_ciSources=payload.sources||[];
          const stats=payload.stats||{},statMap={pages:'pages_crawled',searches:'search_results',reddit:'reddit_threads',competitors:'competitor_pages'};
          Object.entries(statMap).forEach(([k,v])=>{const el=document.getElementById('stat-'+k);if(el)el.textContent=stats[v]||0;});
          const sEl=document.getElementById('c-feed-stats');if(sEl)sEl.style.display='grid';
          appendLog('✅ Research complete!','#10B981');setProgress(100);
          setTimeout(()=>{renderScorecard();goToPhase(2);},800);
        }else if(event==='error'){appendLog('❌ '+(payload.message||'Error'),'#ef4444');if(startBtn){startBtn.disabled=false;startBtn.textContent='🚀 Start Intelligence Crawl';}}
      }
    }
  }).catch(err=>{appendLog('❌ Connection error: '+err.message,'#ef4444');if(startBtn){startBtn.disabled=false;startBtn.textContent='🚀 Start Intelligence Crawl';}});
}

function renderScorecard(){
  const intel=_ciIntelligence;if(!intel)return;
  const ovg=document.getElementById('c-overview-grid');
  if(ovg&&intel.brand_overview){const o=intel.brand_overview;ovg.innerHTML=[['Founded',o.founded],['HQ',o.headquarters],['Founders',o.founders],['Category',o.category],['Funding',o.funding],['Mission',o.mission]].map(([l,v])=>'<div style="padding:10px 12px;background:#fff;border-radius:8px;border:1px solid var(--border)"><div style="font-size:10px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+l+'</div><div style="font-size:12px;color:var(--dark);font-weight:600;line-height:1.4">'+(v||'Not found')+'</div></div>').join('');}
  const sb=document.getElementById('c-scorecard-bars');
  if(sb&&intel.brand_health_score){sb.innerHTML=Object.entries(intel.brand_health_score).map(([k,v])=>{const pct=Math.min(100,Math.max(0,Number(v)||0)),col=pct>=70?'#10B981':pct>=45?'#f59e0b':'#ef4444';return '<div><div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="font-size:12px;color:var(--dark);font-weight:600">'+(CI_SCORE_LABELS[k]||k)+'</span><span style="font-size:12px;font-weight:800;color:'+col+'">'+pct+'/100</span></div><div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+col+';transition:width 0.8s;border-radius:3px"></div></div></div>';}).join('');}
  const sl=document.getElementById('c-sources-list');
  if(sl&&_ciSources.length)sl.innerHTML=_ciSources.slice(0,30).map(s=>'<div style="font-size:11px;color:var(--mid);padding:4px 8px;background:var(--off);border-radius:5px">'+s.label+'</div>').join('');
  const pl=document.getElementById('c-priorities-list');
  if(pl&&intel.top_3_priority_fixes)pl.innerHTML=intel.top_3_priority_fixes.map((f,i)=>'<div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start"><div style="width:22px;height:22px;border-radius:50%;background:#ef4444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">'+(i+1)+'</div><div style="font-size:12px;color:var(--dark);line-height:1.5">'+f+'</div></div>').join('');
  const cl=document.getElementById('c-competitors-list');
  if(cl&&intel.competitors)cl.innerHTML=intel.competitors.slice(0,4).map(c=>'<div style="padding:10px;border:1px solid var(--border);border-radius:8px;background:#fff"><div style="font-size:12px;font-weight:700;color:var(--dark);margin-bottom:4px">'+c.name+'</div><div style="font-size:11px;color:#10B981;margin-bottom:2px">✓ '+(c.strength||'—')+'</div><div style="font-size:11px;color:#ef4444">✗ '+(c.weakness||'—')+'</div></div>').join('');
  const cv=document.getElementById('c-customer-voice-grid');
  if(cv&&intel.customer_voice){const praise=(intel.customer_voice.praise||[]).slice(0,3),complaints=(intel.customer_voice.complaints||[]).slice(0,3);cv.innerHTML='<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:#10B981;margin-bottom:6px">CUSTOMERS LOVE</div>'+praise.map(p=>'<div style="font-size:11px;color:var(--mid);padding:4px 0;border-bottom:1px solid var(--border)">✓ '+p+'</div>').join('')+'</div><div><div style="font-size:11px;font-weight:700;color:#ef4444;margin-bottom:6px">CUSTOMERS COMPLAIN</div>'+complaints.map(c=>'<div style="font-size:11px;color:var(--mid);padding:4px 0;border-bottom:1px solid var(--border)">✗ '+c+'</div>').join('')+'</div>';}
  const gl=document.getElementById('c-gaps-list');
  if(gl&&intel.research_gaps)gl.innerHTML=intel.research_gaps.map(g=>'<div>• '+g+'</div>').join('');
}

function proceedToBriefing(){renderBriefingQuestions();goToPhase(3);}
function renderBriefingQuestions(){
  const container=document.getElementById('c-dynamic-questions');if(!container)return;
  container.innerHTML=_ciQuestions.map(q=>'<div style="border:1px solid var(--border);border-radius:10px;padding:18px;background:#fff"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;background:rgba(43,78,255,0.1);color:var(--blue)">'+(q.category||'General')+'</span><span style="font-size:12px;font-weight:700;color:var(--dark)">'+q.question+'</span></div><div style="font-size:11px;color:var(--mid);margin-bottom:10px;font-style:italic">Why this matters: '+(q.why||'')+'</div><textarea id="brief-'+q.id+'" placeholder="'+(q.placeholder||'Your answer...')+'" style="width:100%;min-height:80px;font-size:12px;resize:vertical" oninput="saveBriefingAnswer(\''+q.id+'\',this.value)"></textarea></div>').join('');
  Object.entries(_ciFounderAnswers).forEach(([id,val])=>{const el=document.getElementById('brief-'+id);if(el)el.value=val;});
}
function saveBriefingAnswer(id,value){_ciFounderAnswers[id]=value;}

async function startDocumentGeneration(){
  goToPhase(4);
  const loader=document.getElementById('c-doc-gen-loader'),workspace=document.getElementById('c-doc-workspace');
  if(loader)loader.style.display='';if(workspace)workspace.style.display='none';
  const avatars=['jobs','musk','buffett','munger','agency'];let ai=0;
  const aint=setInterval(()=>{const av=document.getElementById('av-'+avatars[ai%avatars.length]);if(av){av.style.opacity='1';av.style.transform='scale(1.1)';setTimeout(()=>{if(av){av.style.opacity='0.5';av.style.transform='scale(1)';}},500);}ai++;},1200);
  const modulesToGen=(_ciIntelligence&&_ciIntelligence.recommended_documents?_ciIntelligence.recommended_documents:CI_MODULES.map(m=>m.id)).filter(id=>CI_MODULES.find(m=>m.id===id));
  const total=modulesToGen.length;let done=0;
  const upd=(title,sub)=>{const tEl=document.getElementById('c-doc-loader-title'),sEl=document.getElementById('c-doc-loader-sub'),pb=document.getElementById('c-doc-progress-bar');if(tEl)tEl.textContent=title;if(sEl)sEl.textContent=sub;if(pb)pb.style.width=((done/total)*100)+'%';};
  const founderBrief={};_ciQuestions.forEach(q=>{if(_ciFounderAnswers[q.id])founderBrief[(q.category||'Q')+'_'+q.id]={question:q.question,answer:_ciFounderAnswers[q.id]};});
  for(const moduleId of modulesToGen){
    const mod=CI_MODULES.find(m=>m.id===moduleId);
    upd('Generating: '+(mod?mod.label:moduleId)+' ('+(done+1)+'/'+total+')','Applying advisory board frameworks...');
    try{const res=await apiFetch('api/consultant.php?action=generate_module',{brand_name:_ciBrandName,module_id:moduleId,intelligence:_ciIntelligence||{},founder_brief:founderBrief});if(res.ok&&res.content)_ciModules[moduleId]=res.content;}
    catch(e){_ciModules[moduleId]='Generation failed: '+e.message+'\n\nPlease use Regenerate button to retry.';}
    done++;await new Promise(r=>setTimeout(r,300));
  }
  clearInterval(aint);await saveConsultantDossier(true);renderDocumentWorkspace();
  if(loader)loader.style.display='none';if(workspace)workspace.style.display='';
}

function renderDocumentWorkspace(){
  const tabs=document.getElementById('c-doc-tabs'),panels=document.getElementById('c-doc-panels');if(!tabs||!panels)return;
  const avail=CI_MODULES.filter(m=>_ciModules[m.id]);if(!avail.length)return;
  tabs.innerHTML=avail.map((m,i)=>'<button class="c-doc-tab'+(i===0?' active':'')+'" id="tab-'+m.id+'" onclick="switchDocTab(\''+m.id+'\')" style="padding:12px 16px;border:none;border-bottom:3px solid '+(i===0?'var(--blue)':'transparent')+';background:none;cursor:pointer;font-size:12px;font-weight:'+(i===0?'700':'600')+';color:'+(i===0?'var(--blue)':'var(--mid)')+';white-space:nowrap;transition:all 0.2s">'+m.label+'</button>').join('');
  _ciCurrentTab=avail[0].id;renderDocPanel(_ciCurrentTab);
}
function switchDocTab(moduleId){
  _ciCurrentTab=moduleId;
  document.querySelectorAll('.c-doc-tab').forEach(t=>{const a=t.id==='tab-'+moduleId;t.style.borderBottomColor=a?'var(--blue)':'transparent';t.style.color=a?'var(--blue)':'var(--mid)';t.style.fontWeight=a?'700':'600';});
  renderDocPanel(moduleId);
}
function renderDocPanel(moduleId){
  const panels=document.getElementById('c-doc-panels');if(!panels)return;
  const content=_ciModules[moduleId]||'(No content generated yet)';
  panels.innerHTML='<textarea id="doc-panel-'+moduleId+'" style="width:100%;min-height:500px;font-size:13px;font-family:var(--fm);line-height:1.7;border:1px solid var(--border);border-radius:8px;padding:16px;resize:vertical;color:var(--dark)" oninput="markDocumentDirty()">'+content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</textarea>';
}
function markDocumentDirty(){const el=document.getElementById('c-save-status');if(el){el.textContent='Unsaved changes';el.style.color='#f59e0b';}}

async function regenerateCurrentModule(){
  if(!_ciCurrentTab)return;const mod=CI_MODULES.find(m=>m.id===_ciCurrentTab);
  if(!confirm('Regenerate "'+( mod?mod.label:_ciCurrentTab)+'"? This overwrites current content.'))return;
  const btn=event.target;btn.disabled=true;btn.textContent='⏳ Regenerating...';
  const founderBrief={};_ciQuestions.forEach(q=>{if(_ciFounderAnswers[q.id])founderBrief[(q.category||'Q')+'_'+q.id]={question:q.question,answer:_ciFounderAnswers[q.id]};});
  try{const res=await apiFetch('api/consultant.php?action=generate_module',{brand_name:_ciBrandName,module_id:_ciCurrentTab,intelligence:_ciIntelligence||{},founder_brief:founderBrief});if(res.ok&&res.content){_ciModules[_ciCurrentTab]=res.content;renderDocPanel(_ciCurrentTab);showToast('Section regenerated!','success');}}
  catch(e){showToast('Regeneration failed: '+e.message,'error');}
  btn.disabled=false;btn.textContent='🔄 Regenerate This Section';
}

async function saveConsultantDossier(silent){
  CI_MODULES.forEach(m=>{const el=document.getElementById('doc-panel-'+m.id);if(el)_ciModules[m.id]=el.value;});
  const b=activeBrand;if(!b)return;
  try{await apiFetch('api/consultant.php?action=save',{brand_id:b.id,brand_name:_ciBrandName,brand_url:_ciBrandUrl,crawled:_ciIntelligence||{},brief:_ciFounderAnswers,strategy:{},modules:_ciModules});
    if(!silent){const el=document.getElementById('c-save-status');if(el){el.textContent='Saved ✓';el.style.color='#10B981';}showToast('Dossier saved!','success');}
  }catch(e){if(!silent)showToast('Save failed: '+e.message,'error');}
}

function exportConsultantPPTX(){
  const intel=_ciIntelligence||{},brand=_ciBrandName||'Brand';
  const color1=((intel.brand_identity&&intel.brand_identity.primary_color)||'#2B4EFF').replace('#','');
  const scores=intel.brand_health_score||{};
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.title='Brand Intelligence — '+brand;
  const dBg='0F0F1A';
  const newSlide=(title,sub)=>{const s=pptx.addSlide();s.background={color:dBg};if(title)s.addText(title,{x:0.4,y:0.3,w:'95%',h:0.5,fontSize:22,bold:true,color:'FFFFFF',fontFace:'Calibri'});if(sub)s.addText(sub,{x:0.4,y:0.8,w:'95%',h:0.3,fontSize:12,color:'9CA3AF',fontFace:'Calibri'});return s;};
  const cover=pptx.addSlide();cover.background={color:dBg};
  cover.addText('Brand Intelligence Report',{x:1,y:1.5,w:11,h:0.8,fontSize:32,bold:true,color:'FFFFFF',fontFace:'Calibri',align:'center'});
  cover.addText(brand,{x:1,y:2.5,w:11,h:1.2,fontSize:56,bold:true,color:color1,fontFace:'Calibri',align:'center'});
  cover.addText('Prepared by Digifyce Intelligence Engine',{x:1,y:4.5,w:11,h:0.4,fontSize:13,color:'6B7280',fontFace:'Calibri',align:'center'});
  if(intel.brand_overview){const s=newSlide('Brand Overview','AI-synthesized from deep research');const o=intel.brand_overview;[['Founded',o.founded],['HQ',o.headquarters],['Founders',o.founders],['Category',o.category],['Funding',o.funding]].filter(r=>r[1]).forEach(([k,v],i)=>{s.addText(k+':',{x:0.4,y:1.2+i*0.55,w:2,h:0.4,fontSize:11,bold:true,color:'9CA3AF'});s.addText(v||'',{x:2.6,y:1.2+i*0.55,w:10,h:0.4,fontSize:12,color:'FFFFFF'});});if(o.mission)s.addText('"'+o.mission+'"',{x:0.4,y:4.5,w:'90%',h:0.6,fontSize:13,italic:true,color:'6366f1'});}
  if(Object.keys(scores).length){const s=newSlide('Brand Health Scorecard','8-dimension assessment');Object.entries(scores).forEach(([k,v],i)=>{const pct=Math.min(100,Math.max(0,Number(v)||0)),col=pct>=70?'10B981':pct>=45?'F59E0B':'EF4444',cx=i<4?0.4:6.7,cy=i<4?i:i-4;s.addText((CI_SCORE_LABELS[k]||k),{x:cx,y:1.2+cy*1.1,w:3,h:0.3,fontSize:10,color:'9CA3AF'});s.addText(pct+'/100',{x:cx+3.1,y:1.2+cy*1.1,w:1.5,h:0.3,fontSize:12,bold:true,color:col});s.addShape(pptx.ShapeType.rect,{x:cx,y:1.55+cy*1.1,w:4.4,h:0.18,fill:{color:'1F2937'}});if(pct>0)s.addShape(pptx.ShapeType.rect,{x:cx,y:1.55+cy*1.1,w:4.4*pct/100,h:0.18,fill:{color:col}});});}
  if(intel.top_3_priority_fixes){const s=newSlide('Top Priority Issues','Most urgent areas needing attention');intel.top_3_priority_fixes.slice(0,3).forEach((fix,i)=>{s.addText(''+(i+1),{x:0.4,y:1.3+i*1.5,w:0.5,h:0.5,fontSize:18,bold:true,color:color1});s.addText(fix,{x:1.1,y:1.3+i*1.5,w:11.5,h:1.2,fontSize:12,color:'FFFFFF',valign:'top',wrap:true});});}
  CI_MODULES.filter(m=>_ciModules[m.id]).forEach(m=>{const content=_ciModules[m.id];const chunks=[];let buf='';(content||'').split('\n').forEach(line=>{if((buf+line).length>1200){if(buf)chunks.push(buf);buf=line+'\n';}else buf+=line+'\n';});if(buf)chunks.push(buf);chunks.slice(0,3).forEach((chunk,ci)=>{const s=newSlide(m.label+(ci>0?' (cont.)':''),ci===0?'AI-generated intelligence':'');s.addText(chunk.trim(),{x:0.4,y:1.1,w:'90%',h:4.5,fontSize:10.5,color:'D1D5DB',wrap:true,valign:'top',fontFace:'Calibri'});});});
  pptx.writeFile({fileName:'Intelligence_'+brand.replace(/\s+/g,'_')+'_'+new Date().toISOString().split('T')[0]}).then(()=>showToast('Board Presentation downloaded!','success'));
}

function exportDossierPDF(){
  const intel=_ciIntelligence||{},brand=_ciBrandName||'Brand',color=(intel.brand_identity&&intel.brand_identity.primary_color)||'#2B4EFF';
  const html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+brand+' Dossier</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;color:#111;padding:40px;max-width:900px;margin:0 auto}h2{font-size:20px;color:'+color+';margin:40px 0 12px;border-bottom:2px solid '+color+';padding-bottom:6px}p{font-size:14px;line-height:1.8;margin-bottom:12px;white-space:pre-wrap}.cover{text-align:center;padding:60px 0;border-bottom:3px solid '+color+';margin-bottom:40px}@media print{body{padding:20px}}</style></head><body><div class="cover"><h1 style="font-size:42px;color:'+color+'">'+brand+'</h1><p style="color:#666;margin-top:8px">Brand Intelligence Dossier · '+new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})+'</p></div>'+CI_MODULES.filter(m=>_ciModules[m.id]).map(m=>'<h2>'+m.label+'</h2><p>'+(_ciModules[m.id]||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</p>').join('')+'</body></html>';
  const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();}
}

function exportSwipeFile(){
  let text='BRAND INTELLIGENCE SWIPE FILE\n'+_ciBrandName+'\nGenerated: '+new Date().toLocaleDateString()+'\n'+'='.repeat(60)+'\n\n';
  CI_MODULES.filter(m=>_ciModules[m.id]).forEach(m=>{text+='\n'+'='.repeat(60)+'\n'+m.label.toUpperCase()+'\n'+'='.repeat(60)+'\n\n'+_ciModules[m.id]+'\n\n';});
  const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Swipe_File_'+_ciBrandName.replace(/\s+/g,'_')+'.txt';a.click();URL.revokeObjectURL(url);showToast('Swipe file downloaded!','success');
}

function exportExecutiveSummary(){
  const intel=_ciIntelligence||{},brand=_ciBrandName||'Brand',color=(intel.brand_identity&&intel.brand_identity.primary_color)||'#2B4EFF',scores=intel.brand_health_score||{},avg=Object.values(scores).length?Math.round(Object.values(scores).reduce((a,b)=>a+Number(b),0)/Object.values(scores).length):0;
  const html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+brand+' Executive Brief</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;padding:40px;max-width:800px;margin:0 auto}.header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid '+color+';padding-bottom:16px;margin-bottom:24px}.score{font-size:48px;font-weight:900;color:'+color+'}h3{font-size:13px;font-weight:700;color:'+color+';text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;margin-top:20px}ul{font-size:13px;line-height:1.8;padding-left:16px}</style></head><body><div class="header"><div><div style="font-size:11px;color:#888;text-transform:uppercase">Executive Brief</div><div style="font-size:28px;font-weight:900">'+brand+'</div><div style="font-size:12px;color:#888">'+new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})+'</div></div><div style="text-align:center"><div class="score">'+avg+'</div><div style="font-size:11px;color:#888">Brand Health / 100</div></div></div><h3>Mission</h3><p style="font-size:13px">'+((intel.brand_overview&&intel.brand_overview.mission)||'Not captured')+'</p><h3>Top 3 Priority Issues</h3><ul>'+(intel.top_3_priority_fixes||[]).map(f=>'<li>'+f+'</li>').join('')+'</ul><h3>Competitive Gaps</h3><ul>'+(intel.competitors||[]).slice(0,3).map(c=>'<li><strong>'+c.name+'</strong>: '+c.weakness+'</li>').join('')+'</ul></body></html>';
  const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();}
}

let _intelKeySaveTimer=null;
function saveIntelKeys(){
  clearTimeout(_intelKeySaveTimer);
  _intelKeySaveTimer=setTimeout(async()=>{
    const keys={
      jina_api_key:(document.getElementById('intel-jina-key')||{value:''}).value.trim(),
      firecrawl_api_key:(document.getElementById('intel-firecrawl-key')||{value:''}).value.trim(),
      tavily_api_key:(document.getElementById('intel-tavily-key')||{value:''}).value.trim(),
      serpapi_api_key:(document.getElementById('intel-serpapi-key')||{value:''}).value.trim()
    };
    try{ await api('/api/settings','POST',keys); }catch(e){ console.error(e); }
  },1200);
}

function loadIntelKeysToUI(){
  api('/api/settings').then(s=>{
    if(s){
      [['intel-jina-key','jina_api_key'],['intel-firecrawl-key','firecrawl_api_key'],['intel-tavily-key','tavily_api_key'],['intel-serpapi-key','serpapi_api_key']].forEach(([id,k])=>{
        const el=document.getElementById(id);
        if(el&&s[k]) el.value=s[k];
      });
    }
  }).catch(()=>{});
}

function injectConsultantStyles(){
  if(document.getElementById('ci-styles'))return;
  const s=document.createElement('style');s.id='ci-styles';
  s.textContent='.c-step{display:flex;align-items:center;gap:6px;font-weight:600;color:var(--mid);padding:6px 10px;border-radius:8px;transition:all .2s;font-size:12px}.c-step.active{color:var(--blue);background:rgba(43,78,255,.07);font-weight:700}.c-step.done{color:#10B981}.c-step-num{width:20px;height:20px;border-radius:50%;background:var(--border);color:var(--mid);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0}.c-step.active .c-step-num{background:var(--blue);color:#fff}.c-step.done .c-step-num{background:#10B981;color:#fff}.c-step-arrow{color:var(--border);font-size:12px}.export-card:hover{border-color:var(--blue)!important;transform:translateY(-2px);box-shadow:0 8px 24px rgba(43,78,255,.12)}.c-doc-tab:hover{color:var(--dark)!important;background:var(--off)}';
  document.head.appendChild(s);
}


// ═══════════════════════════════════════════════════════════════════════════
// MONTHLY MEDIA BUYER PLAN OF ACTION (POA) ENGINE — Controller
// ═══════════════════════════════════════════════════════════════════════════

let _poaCurrentId       = null;
let _poaActiveTab       = 'overview';
let _poaData            = null;
let _poaDropdowns       = {};
let _poaSelectedBrands  = [];

function initPoaPage() {
  const monthSel = document.getElementById('poa-month-select');
  if (monthSel && !monthSel.value) {
    const now = new Date();
    const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    monthSel.value = ym;
  }

  if (activeBrand && !_poaSelectedBrands.length) {
    _poaSelectedBrands = [activeBrand.id];
  }

  // Load available brands
  api('/api/budget?action=brands').then(res => {
    const brands = Array.isArray(res) ? res : (res.brands || []);
    renderPoaBrandChips(brands);
  }).catch(() => {
    const fallback = (allBrands && allBrands.length) ? allBrands : (window.brandsData || (activeBrand ? [activeBrand] : []));
    renderPoaBrandChips(fallback);
  });

  // Load dropdown options
  loadPoaDropdowns();
}

function renderPoaBrandChips(brands) {
  const chipsEl = document.getElementById('poa-brand-chips');
  if (!chipsEl) return;

  const validBrands = (Array.isArray(brands) && brands.length) 
    ? brands 
    : ((allBrands && allBrands.length) ? allBrands : (window.brandsData || (activeBrand ? [activeBrand] : [])));

  if (!validBrands.length) {
    chipsEl.innerHTML = '<span style="font-size:12px;color:var(--mid)">No brands available</span>';
    return;
  }

  if (activeBrand && (!_poaSelectedBrands.length || !_poaSelectedBrands.includes(activeBrand.id))) {
    _poaSelectedBrands = [activeBrand.id];
  }

  chipsEl.innerHTML = validBrands.map(b => {
    const isSel = _poaSelectedBrands.includes(b.id);
    return `
      <label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;border:1px solid ${isSel ? 'var(--blue)' : 'var(--border)'};background:${isSel ? 'rgba(43,78,255,0.08)' : '#fff'};cursor:pointer;font-size:12px;font-weight:${isSel ? '700' : '600'};color:${isSel ? 'var(--blue)' : 'var(--dark)'}">
        <input type="checkbox" value="${b.id}" ${isSel ? 'checked' : ''} onchange="togglePoaBrandSelection('${b.id}')" style="accent-color:var(--blue)">
        ${b.name}
      </label>
    `;
  }).join('');

  loadPoaForCurrentSelection();
}

function togglePoaBrandSelection(brandId) {
  if (_poaSelectedBrands.includes(brandId)) {
    _poaSelectedBrands = _poaSelectedBrands.filter(id => id !== brandId);
  } else {
    _poaSelectedBrands.push(brandId);
  }

  // Update UI chips
  const brands = window.brandsData || [];
  renderPoaBrandChips(brands);
}

function loadPoaDropdowns() {
  const brandId = _poaSelectedBrands[0] || null;
  api('/api/poa?action=dropdowns&brand_id=' + (brandId || '')).then(res => {
    if (res && res.dropdowns) {
      _poaDropdowns = res.dropdowns;
      renderCustomDropdownsList();
    }
  }).catch(() => {});
}

function loadPoaForCurrentSelection() {
  const monthSel = document.getElementById('poa-month-select');
  const month = monthSel ? monthSel.value : new Date().toISOString().slice(0,7);
  const brandId = _poaSelectedBrands[0];

  const wsEl    = document.getElementById('poa-workspace');
  const emptyEl = document.getElementById('poa-empty-state');
  const feedEl  = document.getElementById('poa-gen-feed');

  if (!brandId) {
    if (wsEl) wsEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    return;
  }

  // Load Brand Sales Context & Ingested Data
  api(`/api/poa?action=brand_context&brand_id=${brandId}&month=${month}`).then(ctx => {
    if (ctx && ctx.ok) {
      const revEl    = document.getElementById('poa-ctx-target-rev');
      const budEl    = document.getElementById('poa-ctx-target-budget');
      const roasEl   = document.getElementById('poa-ctx-target-roas');
      const actualEl = document.getElementById('poa-ctx-actual-sales');
      const prodsEl  = document.getElementById('poa-ctx-products-list');
      const catEl    = document.getElementById('poa-ctx-category');

      if (revEl)    revEl.value = '₹' + Number(ctx.target_revenue).toLocaleString();
      if (budEl)    budEl.value = '₹' + Number(ctx.target_budget).toLocaleString();
      if (roasEl)   roasEl.value = ctx.target_roas + 'x';
      if (actualEl) actualEl.textContent = '₹' + Number(ctx.actual_sales).toLocaleString();
      if (prodsEl)  prodsEl.textContent = (ctx.products || []).join(', ');
      if (catEl)    catEl.textContent = (ctx.category || 'D2C Ecommerce') + (ctx.mission ? ' · ' + ctx.mission : '');
    }
  }).catch(() => {});

  api(`/api/poa?action=load&brand_id=${brandId}&month=${month}`).then(res => {
    if (res && res.ok && !res.empty) {
      _poaCurrentId = res.id;
      _poaData = {
        id:            res.id,
        brand_id:      res.brand_id,
        brand_name:    res.brand_name,
        poa_month:     res.poa_month,
        overview:      res.overview || {},
        communication: res.communication || [],
        competitors:   res.competitors || [],
        website:       res.website || [],
        creative:      res.creative || [],
        retention:     res.retention || []
      };
      renderPoaWorkspace();
      if (wsEl) wsEl.style.display = '';
      if (emptyEl) emptyEl.style.display = 'none';
    } else {
      _poaCurrentId = null;
      _poaData = null;
      if (wsEl) wsEl.style.display = 'none';
      
      const brand = (window.brandsData || []).find(b => b.id === brandId);
      const bName = brand ? brand.name : 'Selected Brand';
      
      const tEl = document.getElementById('poa-empty-title');
      const dEl = document.getElementById('poa-empty-desc');
      if (tEl) tEl.textContent = `No Plan of Action Generated Yet for ${bName}`;
      if (dEl) dEl.textContent = `Click below to generate a comprehensive 6-sheet Monthly Media Buyer Execution Plan for ${bName} (${month}) using AI.`;

      if (emptyEl) {
        if (feedEl) feedEl.style.display = 'none';
        emptyEl.style.display = '';
      }
    }
  }).catch(() => {});
}

// ── BATCH AI GENERATION & BRIEFING MODAL ──────────────────────────────────────
function startPoaBatchGeneration() {
  if (!_poaSelectedBrands.length) {
    alert('Please select at least one brand to generate POA.');
    return;
  }

  const brandId = _poaSelectedBrands[0];
  const brand = (window.brandsData || []).find(b => b.id === brandId);
  const bName = brand ? brand.name : 'Selected Brand';

  const modalTitle = document.getElementById('poa-brief-modal-title');
  if (modalTitle) modalTitle.textContent = `Monthly Strategy Briefing & Inputs — ${bName}`;

  // Pre-fill fields from Context Bar
  const revVal  = document.getElementById('poa-ctx-target-rev')?.value || '';
  const roasVal = document.getElementById('poa-ctx-target-roas')?.value || '';
  const prods   = document.getElementById('poa-ctx-products-list')?.textContent || '';

  if (revVal && document.getElementById('poa-brief-revenue'))  document.getElementById('poa-brief-revenue').value = revVal;
  if (roasVal && document.getElementById('poa-brief-roas'))    document.getElementById('poa-brief-roas').value = roasVal;
  if (prods && document.getElementById('poa-brief-products')) document.getElementById('poa-brief-products').value = prods;

  switchPoaBriefTab(1);
  const modal = document.getElementById('modal-poa-brief');
  if (modal) modal.style.display = 'flex';
}

function closePoaBriefModal() {
  const modal = document.getElementById('modal-poa-brief');
  if (modal) modal.style.display = 'none';
}

let _poaBriefCurrentStep = 1;

function switchPoaBriefTab(num) {
  _poaBriefCurrentStep = num;
  const stepLabels = [
    'Next: Voice & Offers ➔',
    'Next: Problems & Fixes ➔',
    'Next: Audience & Objections ➔',
    'Next: Competitors & Team ➔',
    '🚀 Launch AI POA Generation'
  ];

  for (let i = 1; i <= 5; i++) {
    const btn = document.getElementById(`poa-brief-tab-btn-${i}`);
    const tab = document.getElementById(`poa-brief-tab-${i}`);
    if (btn) btn.classList.toggle('active', i === num);
    if (tab) tab.style.display = (i === num) ? '' : 'none';
  }

  const nextBtn = document.getElementById('poa-brief-next-btn');
  if (nextBtn) {
    nextBtn.textContent = stepLabels[num - 1] || '🚀 Launch AI POA Generation';
    if (num === 5) {
      nextBtn.style.background = 'linear-gradient(135deg,#10B981,#059669)';
    } else {
      nextBtn.style.background = 'linear-gradient(135deg,#2B4EFF,#6366f1)';
    }
  }
}

function advancePoaBriefStep() {
  if (_poaBriefCurrentStep < 5) {
    switchPoaBriefTab(_poaBriefCurrentStep + 1);
  } else {
    submitPoaBriefAndGenerate();
  }
}

async function submitPoaBriefAndGenerate() {
  closePoaBriefModal();

  const month = document.getElementById('poa-month-select').value || new Date().toISOString().slice(0,7);
  const feedEl  = document.getElementById('poa-gen-feed');
  const emptyEl = document.getElementById('poa-empty-state');
  const btn     = document.getElementById('btn-generate-poa');
  const logEl   = document.getElementById('poa-feed-log');
  const pBar    = document.getElementById('poa-feed-progress-bar');
  const pPct    = document.getElementById('poa-feed-pct');

  if (emptyEl) emptyEl.style.display = 'none';
  if (feedEl) feedEl.style.display = '';
  if (btn) btn.disabled = true;
  if (logEl) logEl.innerHTML = '';
  if (pBar) pBar.style.width = '10%';
  if (pPct) pPct.textContent = '10%';

  function appendLog(msg, color) {
    if (!logEl) return;
    const d = document.createElement('div');
    if (color) d.style.color = color;
    d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
  }

  const briefPayload = {
    brand_ids: _poaSelectedBrands,
    month: month,
    override_target_revenue: document.getElementById('poa-brief-revenue')?.value.replace(/[^0-9.]/g, '') || null,
    override_target_roas: document.getElementById('poa-brief-roas')?.value.replace(/[^0-9.]/g, '') || null,
    target_cpa: document.getElementById('poa-brief-cpa')?.value || '',
    target_aov: document.getElementById('poa-brief-aov')?.value || '',
    primary_goal: document.getElementById('poa-brief-primary-goal')?.value || '',
    brand_tone: document.getElementById('poa-brief-tone')?.value || '',
    discount_cap: document.getElementById('poa-brief-discount-cap')?.value || '',
    focus_products: document.getElementById('poa-brief-products')?.value || '',
    monthly_offer: document.getElementById('poa-brief-offer')?.value || '',
    brand_problems: document.getElementById('poa-brief-problems')?.value || '',
    desired_fixes: document.getElementById('poa-brief-fixes')?.value || '',
    target_audience: document.getElementById('poa-brief-audience')?.value || '',
    pain_points: document.getElementById('poa-brief-pain-points')?.value || '',
    objections: document.getElementById('poa-brief-objections')?.value || '',
    competitors: document.getElementById('poa-brief-competitors')?.value || '',
    creative_qty: document.getElementById('poa-brief-creative-qty')?.value || 4,
    team_lead: document.getElementById('poa-brief-team-lead')?.value || ''
  };

  appendLog(`🚀 Starting AI Generation with Briefing Inputs for ${_poaSelectedBrands.length} brand(s)...`, 'var(--blue)');

  try {
    const res = await api('/api/poa?action=generate', 'POST', briefPayload);

    if (pBar) pBar.style.width = '100%';
    if (pPct) pPct.textContent = '100%';

    if (res && res.ok && res.results) {
      appendLog('✅ Hyper-Personalized POA Generation complete!', '#10B981');
      setTimeout(() => {
        if (feedEl) feedEl.style.display = 'none';
        if (btn) btn.disabled = false;
        loadPoaForCurrentSelection();
        showToast('Plan of Action generated with brief inputs!', 'success');
      }, 1000);
    } else {
      appendLog('❌ Generation failed: ' + (res?.error || 'Unknown error'), '#ef4444');
      if (btn) btn.disabled = false;
    }
  } catch (e) {
    appendLog('❌ Error: ' + e.message, '#ef4444');
    if (btn) btn.disabled = false;
  }
}

// ── RENDER WORKSPACE ──────────────────────────────────────────────────────────
function renderPoaWorkspace() {
  if (!_poaData) return;
  switchPoaTab(_poaActiveTab);
}

function switchPoaTab(tabId) {
  _poaActiveTab = tabId;
  const tabs = ['overview','communication','competitors','website','creative','retention','dropdowns'];
  tabs.forEach(t => {
    const btn = document.getElementById('poa-tab-btn-' + t);
    const content = document.getElementById('poa-tab-' + t);
    if (btn) btn.classList.toggle('active', t === tabId);
    if (content) content.style.display = (t === tabId) ? '' : 'none';
  });

  if (tabId === 'overview') renderPoaOverview();
  else if (tabId === 'communication') renderPoaCommunication();
  else if (tabId === 'competitors') renderPoaCompetitors();
  else if (tabId === 'website') renderPoaWebsite();
  else if (tabId === 'creative') renderPoaCreative();
  else if (tabId === 'retention') renderPoaRetention();
  else if (tabId === 'dropdowns') renderCustomDropdownsList();
}

function markPoaDirty() {
  const st = document.getElementById('poa-save-status');
  if (st) { st.textContent = 'Unsaved changes'; st.style.color = '#f59e0b'; }
}

// ── TAB 1: OVERVIEW ───────────────────────────────────────────────────────────
function renderPoaOverview() {
  const ov = _poaData?.overview || {};

  const summaryEl = document.getElementById('poa-ov-exec-summary');
  if (summaryEl) summaryEl.value = ov.executive_summary || '';

  const revEl = document.getElementById('poa-ov-target-rev');
  if (revEl) revEl.value = ov.target_revenue || '';

  const roasEl = document.getElementById('poa-ov-target-roas');
  if (roasEl) roasEl.value = ov.target_roas || '';

  // Primary KPI select
  const kpiSel = document.getElementById('poa-ov-primary-kpi');
  if (kpiSel) {
    const options = _poaDropdowns.website_kpis || ['Blended ROAS', 'Revenue', 'Conversion Rate', 'CAC', 'AOV'];
    kpiSel.innerHTML = options.map(o => `<option value="${o}" ${o === (ov.primary_kpi || 'Blended ROAS') ? 'selected' : ''}>${o}</option>`).join('');
  }

  // Milestones
  renderPoaMilestonesList(ov.milestones || []);

  // Team roles
  renderPoaTeamList(ov.team || {});
}

function renderPoaMilestonesList(list) {
  const container = document.getElementById('poa-ov-milestones-list');
  if (!container) return;

  container.innerHTML = list.map((m, i) => `
    <div style="display:flex;align-items:center;gap:8px">
      <input type="text" value="${escHtml(m)}" oninput="updatePoaMilestone(${i}, this.value)" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:12px;outline:none">
      <button class="btn sm" onclick="removePoaMilestone(${i})" style="color:#ef4444">✕</button>
    </div>
  `).join('');
}

function addPoaMilestone() {
  if (!_poaData.overview.milestones) _poaData.overview.milestones = [];
  _poaData.overview.milestones.push('New strategic milestone');
  renderPoaMilestonesList(_poaData.overview.milestones);
  markPoaDirty();
}

function updatePoaMilestone(idx, val) {
  if (_poaData.overview.milestones) _poaData.overview.milestones[idx] = val;
  markPoaDirty();
}

function removePoaMilestone(idx) {
  if (_poaData.overview.milestones) {
    _poaData.overview.milestones.splice(idx, 1);
    renderPoaMilestonesList(_poaData.overview.milestones);
    markPoaDirty();
  }
}

function renderPoaTeamList(teamObj) {
  const container = document.getElementById('poa-ov-team-list');
  if (!container) return;

  const roles = _poaDropdowns.team_roles || ['Media Buyer', 'Copywriter', 'Designer', 'Shopify Developer'];

  container.innerHTML = roles.slice(0, 6).map(role => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
      <span style="font-size:12px;font-weight:600;color:var(--dark);min-width:110px">${role}</span>
      <input type="text" value="${escHtml(teamObj[role] || '')}" placeholder="Assign member..." oninput="updatePoaTeamRole('${role}', this.value)" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:11px;outline:none">
    </div>
  `).join('');
}

function updatePoaTeamRole(role, name) {
  if (!_poaData.overview.team) _poaData.overview.team = {};
  _poaData.overview.team[role] = name;
  markPoaDirty();
}

// ── TAB 2: COMMUNICATION ──────────────────────────────────────────────────────
function renderPoaCommunication() {
  const tbody = document.getElementById('poa-comm-tbody');
  if (!tbody) return;

  const rows = _poaData?.communication || [];
  const angles = _poaDropdowns.creative_angles || [];
  const statuses = _poaDropdowns.statuses || [];

  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td><input type="text" value="${escHtml(r.product||'')}" oninput="updatePoaCommCell(${i},'product',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaCommCell(${i},'priority',this.value)" style="width:100%">
          <option value="High" ${r.priority==='High'?'selected':''}>High</option>
          <option value="Medium" ${r.priority==='Medium'?'selected':''}>Medium</option>
          <option value="Low" ${r.priority==='Low'?'selected':''}>Low</option>
        </select>
      </td>
      <td><input type="text" value="${escHtml(r.priority_reason||'')}" oninput="updatePoaCommCell(${i},'priority_reason',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.audience||'')}" oninput="updatePoaCommCell(${i},'audience',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.pain_point||'')}" oninput="updatePoaCommCell(${i},'pain_point',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.value_prop||'')}" oninput="updatePoaCommCell(${i},'value_prop',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.claims||'')}" oninput="updatePoaCommCell(${i},'claims',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.packaging_claims||'')}" oninput="updatePoaCommCell(${i},'packaging_claims',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.questions||'')}" oninput="updatePoaCommCell(${i},'questions',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaCommCell(${i},'angle',this.value)" style="width:100%">
          ${angles.map(a => `<option value="${a}" ${r.angle===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </td>
      <td><input type="text" value="${escHtml(r.content_focus||'')}" oninput="updatePoaCommCell(${i},'content_focus',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.offer_format||'')}" oninput="updatePoaCommCell(${i},'offer_format',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.compliance||'')}" oninput="updatePoaCommCell(${i},'compliance',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.verification||'Draft')}" oninput="updatePoaCommCell(${i},'verification',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaCommCell(${i},'status',this.value)" style="width:100%">
          ${statuses.map(s => `<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><button class="btn sm" onclick="removePoaCommRow(${i})" style="color:#ef4444">✕</button></td>
    </tr>
  `).join('');
}

function addPoaCommRow() {
  if (!_poaData.communication) _poaData.communication = [];
  _poaData.communication.push({ product: 'New Product', priority: 'High', priority_reason: 'Hero Product', audience: 'Target Segment', pain_point: 'Problem statement', value_prop: 'Core Benefit', claims: 'Key claims', packaging_claims: 'Packaging notes', questions: 'Objections', angle: 'Problem–Solution', content_focus: 'Demo', offer_format: 'Single Pack', compliance: 'Verified', verification: 'Draft', status: 'Planned' });
  renderPoaCommunication();
  markPoaDirty();
}

function updatePoaCommCell(idx, field, val) {
  if (_poaData.communication && _poaData.communication[idx]) {
    _poaData.communication[idx][field] = val;
    markPoaDirty();
  }
}

function removePoaCommRow(idx) {
  if (_poaData.communication) {
    _poaData.communication.splice(idx, 1);
    renderPoaCommunication();
    markPoaDirty();
  }
}

// ── TAB 3: COMPETITORS ────────────────────────────────────────────────────────
function renderPoaCompetitors() {
  const tbody = document.getElementById('poa-comp-tbody');
  if (!tbody) return;

  const rows = _poaData?.competitors || [];
  const angles = _poaDropdowns.creative_angles || [];

  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td><input type="text" value="${escHtml(r.competitor||'')}" oninput="updatePoaCompCell(${i},'competitor',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.product||'')}" oninput="updatePoaCompCell(${i},'product',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.product_link||'')}" oninput="updatePoaCompCell(${i},'product_link',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.pack_price||'')}" oninput="updatePoaCompCell(${i},'pack_price',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.unit_price||'')}" oninput="updatePoaCompCell(${i},'unit_price',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.offer||'')}" oninput="updatePoaCompCell(${i},'offer',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.positioning||'')}" oninput="updatePoaCompCell(${i},'positioning',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaCompCell(${i},'creative_angle',this.value)" style="width:100%">
          ${angles.map(a => `<option value="${a}" ${r.creative_angle===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </td>
      <td><input type="text" value="${escHtml(r.landing_page_strength||'Strong')}" oninput="updatePoaCompCell(${i},'landing_page_strength',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.customer_concern||'')}" oninput="updatePoaCompCell(${i},'customer_concern',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.test_idea||'')}" oninput="updatePoaCompCell(${i},'test_idea',this.value)" style="width:100%"></td>
      <td><button class="btn sm" onclick="removePoaCompRow(${i})" style="color:#ef4444">✕</button></td>
    </tr>
  `).join('');
}

function addPoaCompRow() {
  if (!_poaData.competitors) _poaData.competitors = [];
  _poaData.competitors.push({ competitor: 'Competitor Name', product: 'Product Mix', product_link: '', pack_price: '₹499', unit_price: '₹1/g', offer: '10% off', positioning: 'Clean positioning', creative_angle: 'Problem–Solution', landing_page_strength: 'Strong', customer_concern: 'Value & Speed', test_idea: 'Test concept' });
  renderPoaCompetitors();
  markPoaDirty();
}

function updatePoaCompCell(idx, field, val) {
  if (_poaData.competitors && _poaData.competitors[idx]) {
    _poaData.competitors[idx][field] = val;
    markPoaDirty();
  }
}

function removePoaCompRow(idx) {
  if (_poaData.competitors) {
    _poaData.competitors.splice(idx, 1);
    renderPoaCompetitors();
    markPoaDirty();
  }
}

// ── TAB 4: WEBSITE & CRO ──────────────────────────────────────────────────────
function renderPoaWebsite() {
  const tbody = document.getElementById('poa-web-tbody');
  if (!tbody) return;

  const rows = _poaData?.website || [];
  const areas = _poaDropdowns.website_areas || [];
  const kpis  = _poaDropdowns.website_kpis || [];
  const roles = _poaDropdowns.team_roles || [];
  const statuses = _poaDropdowns.statuses || [];

  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td>
        <select onchange="updatePoaWebCell(${i},'page_area',this.value)" style="width:100%">
          ${areas.map(a => `<option value="${a}" ${r.page_area===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </td>
      <td><input type="text" value="${escHtml(r.page_url||'')}" oninput="updatePoaWebCell(${i},'page_url',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.problem||'')}" oninput="updatePoaWebCell(${i},'problem',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.evidence||'')}" oninput="updatePoaWebCell(${i},'evidence',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.required_change||'')}" oninput="updatePoaWebCell(${i},'required_change',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaWebCell(${i},'kpi_to_improve',this.value)" style="width:100%">
          ${kpis.map(k => `<option value="${k}" ${r.kpi_to_improve===k?'selected':''}>${k}</option>`).join('')}
        </select>
      </td>
      <td>
        <select onchange="updatePoaWebCell(${i},'priority',this.value)" style="width:100%">
          <option value="High" ${r.priority==='High'?'selected':''}>High</option>
          <option value="Medium" ${r.priority==='Medium'?'selected':''}>Medium</option>
          <option value="Low" ${r.priority==='Low'?'selected':''}>Low</option>
        </select>
      </td>
      <td>
        <select onchange="updatePoaWebCell(${i},'assigned_to',this.value)" style="width:100%">
          ${roles.map(role => `<option value="${role}" ${r.assigned_to===role?'selected':''}>${role}</option>`).join('')}
        </select>
      </td>
      <td><input type="date" value="${escHtml(r.deadline||'')}" onchange="updatePoaWebCell(${i},'deadline',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.completion_link||'')}" oninput="updatePoaWebCell(${i},'completion_link',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.result||'')}" oninput="updatePoaWebCell(${i},'result',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaWebCell(${i},'status',this.value)" style="width:100%">
          ${statuses.map(s => `<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><button class="btn sm" onclick="removePoaWebRow(${i})" style="color:#ef4444">✕</button></td>
    </tr>
  `).join('');
}

function addPoaWebRow() {
  if (!_poaData.website) _poaData.website = [];
  _poaData.website.push({ page_area: 'Home Page', page_url: '', problem: 'CRO issue', evidence: 'Analytics data', required_change: 'Optimized element', kpi_to_improve: 'Conversion Rate', priority: 'High', assigned_to: 'Website Developer', deadline: '', completion_link: '', result: '', status: 'Planned' });
  renderPoaWebsite();
  markPoaDirty();
}

function updatePoaWebCell(idx, field, val) {
  if (_poaData.website && _poaData.website[idx]) {
    _poaData.website[idx][field] = val;
    markPoaDirty();
  }
}

function removePoaWebRow(idx) {
  if (_poaData.website) {
    _poaData.website.splice(idx, 1);
    renderPoaWebsite();
    markPoaDirty();
  }
}

// ── TAB 5: CREATIVE QUEUE ─────────────────────────────────────────────────────
function renderPoaCreative() {
  const tbody = document.getElementById('poa-creat-tbody');
  if (!tbody) return;

  const rows = _poaData?.creative || [];
  const angles = _poaDropdowns.creative_angles || [];
  const styles = _poaDropdowns.content_styles || [];
  const roles  = _poaDropdowns.team_roles || [];
  const statuses = _poaDropdowns.statuses || [];

  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td><input type="text" value="${escHtml(r.product||'')}" oninput="updatePoaCreatCell(${i},'product',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaCreatCell(${i},'angle',this.value)" style="width:100%">
          ${angles.map(a => `<option value="${a}" ${r.angle===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </td>
      <td>
        <select onchange="updatePoaCreatCell(${i},'content_style',this.value)" style="width:100%">
          ${styles.map(s => `<option value="${s}" ${r.content_style===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><input type="text" value="${escHtml(r.hook_idea||'')}" oninput="updatePoaCreatCell(${i},'hook_idea',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.offer||'')}" oninput="updatePoaCreatCell(${i},'offer',this.value)" style="width:100%"></td>
      <td><input type="number" value="${r.quantity||1}" oninput="updatePoaCreatCell(${i},'quantity',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaCreatCell(${i},'priority',this.value)" style="width:100%">
          <option value="High" ${r.priority==='High'?'selected':''}>High</option>
          <option value="Medium" ${r.priority==='Medium'?'selected':''}>Medium</option>
          <option value="Low" ${r.priority==='Low'?'selected':''}>Low</option>
        </select>
      </td>
      <td>
        <select onchange="updatePoaCreatCell(${i},'assigned_to',this.value)" style="width:100%">
          ${roles.map(role => `<option value="${role}" ${r.assigned_to===role?'selected':''}>${role}</option>`).join('')}
        </select>
      </td>
      <td><input type="date" value="${escHtml(r.deadline||'')}" onchange="updatePoaCreatCell(${i},'deadline',this.value)" style="width:100%"></td>
      <td><input type="number" value="${r.delivered_qty||0}" oninput="updatePoaCreatCell(${i},'delivered_qty',this.value)" style="width:100%"></td>
      <td><input type="number" value="${r.live_qty||0}" oninput="updatePoaCreatCell(${i},'live_qty',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.ad_link||'')}" oninput="updatePoaCreatCell(${i},'ad_link',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.result||'Not Tested')}" oninput="updatePoaCreatCell(${i},'result',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.next_action||'')}" oninput="updatePoaCreatCell(${i},'next_action',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaCreatCell(${i},'status',this.value)" style="width:100%">
          ${statuses.map(s => `<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><button class="btn sm" onclick="removePoaCreatRow(${i})" style="color:#ef4444">✕</button></td>
    </tr>
  `).join('');
}

function addPoaCreatRow() {
  if (!_poaData.creative) _poaData.creative = [];
  _poaData.creative.push({ product: 'Hero Product', angle: 'Problem–Solution', content_style: 'UGC / Product Demo', hook_idea: 'Creative hook idea', offer: 'Standard Combo', quantity: 3, priority: 'High', assigned_to: 'Creative Team', deadline: '', delivered_qty: 0, live_qty: 0, ad_link: '', result: 'Not Tested', next_action: '', status: 'Planned' });
  renderPoaCreative();
  markPoaDirty();
}

function updatePoaCreatCell(idx, field, val) {
  if (_poaData.creative && _poaData.creative[idx]) {
    _poaData.creative[idx][field] = val;
    markPoaDirty();
  }
}

function removePoaCreatRow(idx) {
  if (_poaData.creative) {
    _poaData.creative.splice(idx, 1);
    renderPoaCreative();
    markPoaDirty();
  }
}

// ── TAB 6: RETENTION & CRM ────────────────────────────────────────────────────
function renderPoaRetention() {
  const tbody = document.getElementById('poa-ret-tbody');
  if (!tbody) return;

  const rows = _poaData?.retention || [];
  const types    = _poaDropdowns.retention_types || [];
  const rfmSegs  = _poaDropdowns.retention_rfm || [];
  const channels = _poaDropdowns.retention_channels || [];
  const roles    = _poaDropdowns.team_roles || [];
  const statuses = _poaDropdowns.statuses || [];

  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td><input type="text" value="${escHtml(r.campaign||'')}" oninput="updatePoaRetCell(${i},'campaign',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaRetCell(${i},'campaign_type',this.value)" style="width:100%">
          ${types.map(t => `<option value="${t}" ${r.campaign_type===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </td>
      <td><input type="text" value="${escHtml(r.trigger||'')}" oninput="updatePoaRetCell(${i},'trigger',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaRetCell(${i},'rfm_segment',this.value)" style="width:100%">
          ${rfmSegs.map(s => `<option value="${s}" ${r.rfm_segment===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><input type="text" value="${escHtml(r.objective||'First Purchase')}" oninput="updatePoaRetCell(${i},'objective',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.customer_segment||'')}" oninput="updatePoaRetCell(${i},'customer_segment',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.eligibility||'')}" oninput="updatePoaRetCell(${i},'eligibility',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.exclusions||'')}" oninput="updatePoaRetCell(${i},'exclusions',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaRetCell(${i},'channel',this.value)" style="width:100%">
          ${channels.map(ch => `<option value="${ch}" ${r.channel===ch?'selected':''}>${ch}</option>`).join('')}
        </select>
      </td>
      <td><input type="text" value="${escHtml(r.communication||'')}" oninput="updatePoaRetCell(${i},'communication',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.offer_benefit||'')}" oninput="updatePoaRetCell(${i},'offer_benefit',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.content_idea||'')}" oninput="updatePoaRetCell(${i},'content_idea',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.cta_link||'')}" oninput="updatePoaRetCell(${i},'cta_link',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.frequency||'')}" oninput="updatePoaRetCell(${i},'frequency',this.value)" style="width:100%"></td>
      <td><input type="text" value="${escHtml(r.primary_kpi||'Revenue')}" oninput="updatePoaRetCell(${i},'primary_kpi',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaRetCell(${i},'owner',this.value)" style="width:100%">
          ${roles.map(role => `<option value="${role}" ${r.owner===role?'selected':''}>${role}</option>`).join('')}
        </select>
      </td>
      <td><input type="text" value="${escHtml(r.result||'')}" oninput="updatePoaRetCell(${i},'result',this.value)" style="width:100%"></td>
      <td>
        <select onchange="updatePoaRetCell(${i},'status',this.value)" style="width:100%">
          ${statuses.map(s => `<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
      <td><button class="btn sm" onclick="removePoaRetRow(${i})" style="color:#ef4444">✕</button></td>
    </tr>
  `).join('');
}

function addPoaRetRow() {
  if (!_poaData.retention) _poaData.retention = [];
  _poaData.retention.push({ campaign: 'Welcome Flow', campaign_type: 'Scheduled Campaign', trigger: 'First Order', rfm_segment: 'Prospects', objective: 'First Purchase', customer_segment: 'New leads', eligibility: 'All new buyers', exclusions: 'Unsubscribed', channel: 'Email Campaign', communication: 'Welcome offer', offer_benefit: '15% Off', content_idea: 'Brand story', cta_link: '', frequency: 'Day 1, 3, 5', primary_kpi: 'Revenue', owner: 'Retention Team', result: '', status: 'Planned' });
  renderPoaRetention();
  markPoaDirty();
}

function updatePoaRetCell(idx, field, val) {
  if (_poaData.retention && _poaData.retention[idx]) {
    _poaData.retention[idx][field] = val;
    markPoaDirty();
  }
}

function updatePoaRetCell(idx, field, val) {
  if (_poaData.retention && _poaData.retention[idx]) {
    _poaData.retention[idx][field] = val;
    markPoaDirty();
  }
}

function removePoaRetRow(idx) {
  if (_poaData.retention) {
    _poaData.retention.splice(idx, 1);
    renderPoaRetention();
    markPoaDirty();
  }
}

// ── TAB 7: CUSTOM DROPDOWNS MANAGER ───────────────────────────────────────────
function renderCustomDropdownsList() {
  const container = document.getElementById('poa-dd-options-container');
  const catSel = document.getElementById('poa-dd-category-filter');
  if (!container || !catSel) return;

  const category = catSel.value;
  const options = _poaDropdowns[category] || [];

  container.innerHTML = options.map(opt => `
    <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#fff;border:1px solid var(--border);border-radius:20px;font-size:12px;font-weight:600;color:var(--dark)">
      <span>${escHtml(opt)}</span>
    </div>
  `).join('');
}

async function submitNewCustomDropdownOption() {
  const valEl = document.getElementById('poa-dd-new-value');
  const catSel = document.getElementById('poa-dd-category-filter');
  const value = valEl ? valEl.value.trim() : '';
  const category = catSel ? catSel.value : '';

  if (!value) return;

  const brandId = _poaSelectedBrands[0] || null;

  try {
    const res = await api('/api/poa?action=save_dropdowns', 'POST', {
      brand_id: brandId,
      category: category,
      value: value
    });

    if (res && res.dropdowns) {
      _poaDropdowns = res.dropdowns;
      valEl.value = '';
      renderCustomDropdownsList();
      showToast('Custom dropdown option added!', 'success');
    }
  } catch (e) {
    showToast('Failed to add option: ' + e.message, 'error');
  }
}

// ── PERSISTENCE & SAVE PROGRESS ───────────────────────────────────────────────
async function savePoaProgress(silent = false) {
  if (!_poaData) return;

  // Sync overview inputs
  const execEl = document.getElementById('poa-ov-exec-summary');
  const revEl  = document.getElementById('poa-ov-target-rev');
  const roasEl = document.getElementById('poa-ov-target-roas');
  const kpiEl  = document.getElementById('poa-ov-primary-kpi');

  if (execEl) _poaData.overview.executive_summary = execEl.value;
  if (revEl)  _poaData.overview.target_revenue    = revEl.value;
  if (roasEl) _poaData.overview.target_roas       = roasEl.value;
  if (kpiEl)  _poaData.overview.primary_kpi       = kpiEl.value;

  try {
    const res = await api('/api/poa?action=save', 'POST', _poaData);
    if (res && res.id) {
      _poaCurrentId = res.id;
      _poaData.id = res.id;
      const st = document.getElementById('poa-save-status');
      if (st) { st.textContent = 'Saved ✓'; st.style.color = '#10B981'; }
      if (!silent) showToast('POA execution progress saved!', 'success');
    }
  } catch (e) {
    if (!silent) showToast('Save failed: ' + e.message, 'error');
  }
}

// ── HISTORY MODAL ─────────────────────────────────────────────────────────────
function openPoaHistoryModal() {
  const modal = document.getElementById('mo-poa-history');
  const listEl = document.getElementById('poa-history-list');
  if (modal) modal.style.display = 'flex';

  const brandId = _poaSelectedBrands[0] || '';

  api('/api/poa?action=list&brand_id=' + brandId).then(res => {
    if (res && res.list) {
      listEl.innerHTML = res.list.map(item => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#fff;border:1px solid var(--border);border-radius:8px">
          <div>
            <div style="font-size:13px;font-weight:800;color:var(--dark)">${item.brand_name} — ${item.poa_month}</div>
            <div style="font-size:11px;color:var(--mid);margin-top:2px">Created by ${item.created_by || 'System'} on ${new Date(item.created_at).toLocaleDateString()}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn sm primary" onclick="loadPoaFromHistory('${item.id}')">Load Workspace</button>
            <button class="btn sm" onclick="exportPoaXLSXById('${item.id}')">Download XLSX</button>
          </div>
        </div>
      `).join('');
    }
  }).catch(() => {});
}

function loadPoaFromHistory(id) {
  closeMo('mo-poa-history');
  api('/api/poa?action=load&id=' + id).then(res => {
    if (res && res.ok) {
      _poaCurrentId = res.id;
      _poaData = {
        id:            res.id,
        brand_id:      res.brand_id,
        brand_name:    res.brand_name,
        poa_month:     res.poa_month,
        overview:      res.overview || {},
        communication: res.communication || [],
        competitors:   res.competitors || [],
        website:       res.website || [],
        creative:      res.creative || [],
        retention:     res.retention || []
      };
      renderPoaWorkspace();
      document.getElementById('poa-workspace').style.display = '';
      showToast('Loaded POA from history!', 'success');
    }
  }).catch(() => {});
}

// ── EXPORT XLSX ───────────────────────────────────────────────────────────────
function exportPoaXLSX() {
  if (!_poaCurrentId) {
    alert('Please save or load a POA first.');
    return;
  }
  exportPoaXLSXById(_poaCurrentId);
}

function exportPoaXLSXById(id) {
  window.open('/api/poa?action=export_xlsx&id=' + id, '_blank');
}

// ── GOOGLE GLOBAL SETTINGS ───────────────────────────────────────────────────
let _googleGlobalSaveTimer = null;
async function flushGoogleGlobalKeysSave() {
  clearTimeout(_googleGlobalSaveTimer);
  const keys = {
    google_client_id: document.getElementById('google-client-id').value.trim(),
    google_client_secret: document.getElementById('google-client-secret').value.trim(),
    google_developer_token: document.getElementById('google-developer-token').value.trim()
  };
  try {
    await api('/api/admin?action=settings', 'POST', keys);
  } catch(e) {
    console.error(e);
  }
}

function saveGoogleGlobalKeys() {
  clearTimeout(_googleGlobalSaveTimer);
  _googleGlobalSaveTimer = setTimeout(flushGoogleGlobalKeysSave, 1200);
}

async function startGoogleOAuth() {
  const clientId = document.getElementById('google-client-id').value.trim();
  if (!clientId) {
    alert('Please enter a Google Client ID and save it first.');
    return;
  }
  // Flush any pending debounced save immediately so we never redirect to the OAuth
  // flow before the just-typed Client ID has actually landed in the database.
  await flushGoogleGlobalKeysSave();
  window.location.href = '/api/google-auth.php?action=authorize';
}

// ── BRAND CONNECTIONS & INTEGRATIONS MODAL ──────────────────────────────────
let _editBrandSlug = null;
let _editBrandDirty = false;
let _editBrandDirtyTrackingBound = false;

function closeEditBrandModal() {
  if (_editBrandDirty && !confirm('You have unsaved changes that will be lost. Close without saving?')) {
    return;
  }
  _editBrandDirty = false;
  closeMo('mo-edit-brand');
}

async function editBrandIntegrations(slug) {
  _editBrandSlug = slug;
  const brand = await api('/api/brands/' + slug);
  if (!brand) return;

  // Delegated listener: any field changing inside the modal marks it dirty, so Cancel can warn
  // before silently discarding an unsaved checkbox/field change. Attached here (lazily, once)
  // rather than at script load, since app.js runs in <head> before this modal's markup exists.
  if (!_editBrandDirtyTrackingBound) {
    const modal = document.getElementById('mo-edit-brand');
    if (modal) {
      ['input', 'change'].forEach(evt => {
        modal.addEventListener(evt, () => { _editBrandDirty = true; });
      });
      _editBrandDirtyTrackingBound = true;
    }
  }

  document.getElementById('edit-brand-subtitle').textContent = `Configure API integrations for ${brand.name}`;

  let int = {};
  try {
    int = typeof brand.integrations_json === 'object' ? brand.integrations_json : JSON.parse(brand.integrations_json || '{}');
  } catch(e) {}
  
  // Reset fields
  document.getElementById('int-shopify-enabled').checked = !!int.shopify_enabled;
  document.getElementById('int-shopify-subdomain').value = int.shopify_subdomain || '';
  document.getElementById('int-shopify-token').value = int.shopify_access_token ? '••••••••••••••••' : '';
  
  document.getElementById('int-meta-accounts').value = int.meta_ad_account_ids || '';
  document.getElementById('int-meta-token').value = int.meta_access_token ? '••••••••••••••••' : '';
  
  document.getElementById('int-google-enabled').checked = !!int.google_ads_enabled;
  document.getElementById('int-google-customer-id').value = int.google_ads_customer_id || '';
  document.getElementById('int-google-mcc-id').value = int.google_ads_mcc_id || '';
  
  document.getElementById('int-ga4-property-id').value = int.ga4_property_id || '';
  document.getElementById('int-gsc-site-url').value = int.gsc_site_url || '';
  
  document.getElementById('int-test-status').textContent = 'Not checked';
  document.getElementById('int-test-status').className = '';
  document.getElementById('int-test-status').style.color = 'var(--mid)';

  setIntegrationTab('shopify');
  _editBrandDirty = false; // programmatic field resets above don't count as user edits
  openMo('mo-edit-brand');
}

function setIntegrationTab(tab) {
  const tabs = ['shopify', 'meta', 'google', 'ga4', 'gsc'];
  tabs.forEach(t => {
    const elTab = document.getElementById('tab-int-' + t);
    const elPan = document.getElementById('panel-int-' + t);
    if (elTab) elTab.classList.toggle('active', t === tab);
    if (elPan) elPan.style.display = t === tab ? 'block' : 'none';
  });
}

async function submitEditBrand() {
  if (!_editBrandSlug) return;
  
  // Helper: if field shows the masked placeholder (starts with •), don't send it
  // so the backend merge logic keeps the existing stored token unchanged.
  const MASK_CHAR = '\u2022'; // bullet •
  const readToken = (id) => {
    const val = document.getElementById(id).value.trim();
    return val.startsWith(MASK_CHAR) ? null : val; // null = keep existing
  };
  
  const shopifyToken = readToken('int-shopify-token');
  const metaToken = readToken('int-meta-token');
  
  const intPayload = {
    shopify_enabled: document.getElementById('int-shopify-enabled').checked,
    shopify_subdomain: document.getElementById('int-shopify-subdomain').value.trim(),
    
    meta_ad_account_ids: document.getElementById('int-meta-accounts').value.trim(),
    
    google_ads_enabled: document.getElementById('int-google-enabled').checked,
    google_ads_customer_id: document.getElementById('int-google-customer-id').value.trim(),
    google_ads_mcc_id: document.getElementById('int-google-mcc-id').value.trim(),
    
    ga4_property_id: document.getElementById('int-ga4-property-id').value.trim(),
    gsc_site_url: document.getElementById('int-gsc-site-url').value.trim()
  };
  
  // Only include tokens if they were actually changed (not masked placeholder)
  if (shopifyToken !== null) intPayload.shopify_access_token = shopifyToken;
  if (metaToken !== null) intPayload.meta_access_token = metaToken;
  
  const r = await api('/api/brands/' + _editBrandSlug, 'PUT', { integrations_json: intPayload });
  if (r && r.ok) {
    showToast('Brand integrations saved!', 'success');
    // Stay open after saving — closing immediately forced re-opening the modal just to
    // confirm the save landed or to keep configuring another tab (e.g. Meta after Shopify).
    _editBrandDirty = false;
    renderAdminBrands();
  } else {
    alert(r?.error || 'Failed to save brand integrations.');
  }
}

async function testActiveBrandConnections() {
  if (!_editBrandSlug) return;
  const statusEl = document.getElementById('int-test-status');
  statusEl.innerHTML = 'Testing connections... <em style="font-weight:400">(this may take up to 15 seconds)</em>';
  statusEl.style.color = '#d97706';
  
  // Send only the non-sensitive, non-token fields plus the brand slug.
  // PHP will read tokens directly from the DB — this avoids the masking mismatch.
  const payload = {
    shopify_enabled: document.getElementById('int-shopify-enabled').checked,
    shopify_subdomain: document.getElementById('int-shopify-subdomain').value.trim(),
    // Tokens: if masked (starts with •), send empty string so PHP falls back to DB
    shopify_access_token: (() => { const v = document.getElementById('int-shopify-token').value.trim(); return v.startsWith('\u2022') ? '' : v; })(),
    
    meta_ad_account_ids: document.getElementById('int-meta-accounts').value.trim(),
    meta_access_token: (() => { const v = document.getElementById('int-meta-token').value.trim(); return v.startsWith('\u2022') ? '' : v; })(),
    
    google_ads_enabled: document.getElementById('int-google-enabled').checked,
    google_ads_customer_id: document.getElementById('int-google-customer-id').value.trim(),
    google_ads_mcc_id: document.getElementById('int-google-mcc-id').value.trim(),
    
    ga4_property_id: document.getElementById('int-ga4-property-id').value.trim(),
    gsc_site_url: document.getElementById('int-gsc-site-url').value.trim()
  };
  
  try {
    const r = await api(`/api/sync.php?brand_id=${_editBrandSlug}&action=test_connections`, 'POST', payload);
    if (r && r.ok) {
      const statusMap = {
        'Connected': '<span style="color:#10B981;font-weight:800">✓ Connected</span>',
        'disabled': '<span style="color:#94a3b8">— Not configured</span>',
      };
      const fmt = (v) => statusMap[v] || `<span style="color:#ef4444;font-weight:700">✗ ${v}</span>`;
      statusEl.innerHTML = [
        `<strong>Shopify:</strong> ${fmt(r.shopify)}`,
        `<strong>Meta:</strong> ${fmt(r.meta)}`,
        `<strong>Google Ads:</strong> ${fmt(r.google_ads)}`,
        `<strong>GA4:</strong> ${fmt(r.ga4)}`,
        `<strong>GSC:</strong> ${fmt(r.gsc)}`
      ].join(' &nbsp;|&nbsp; ');
      statusEl.style.color = '';
    } else {
      statusEl.textContent = 'Connection test failed: ' + (r?.error || 'Server unreachable');
      statusEl.style.color = '#ef4444';
    }
  } catch(e) {
    statusEl.textContent = 'Test failed: ' + e.message;
    statusEl.style.color = '#ef4444';
  }
}

// ── MONTHLY REPORT GENERATOR PAGE ───────────────────────────────────────────
let allMonthlyReportsCache = [];
let syncedMonthlyData = null;

async function initMonthlyReportsPage() {
  try {
    const list = document.getElementById('monthly-tbody');
    if (!list) {
      alert("Error: monthly-tbody element not found in DOM! Your browser might still be serving a cached version of app.html.");
      return;
    }
    
    const listView = document.getElementById('monthly-list-view');
    const createView = document.getElementById('monthly-create-view');
    if (listView) listView.style.display = 'block';
    if (createView) createView.style.display = 'none';
    
    const brandFilter = document.getElementById('monthly-filter-brand');
    if (brandFilter) {
      brandFilter.innerHTML = '<option value="">All Brands</option>' + 
        allBrands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
      if (!brandFilter.dataset.initialized) {
        brandFilter.value = activeBrand ? activeBrand.id : '';
        brandFilter.dataset.initialized = 'true';
      }
    }

    list.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--mid);padding:24px 0">Loading monthly reports…</td></tr>`;
    try {
      const r = await api('/api/reports?action=list');
      allMonthlyReportsCache = r || [];
      renderMonthlyReportsTable();
    } catch (e) {
      list.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--red);padding:24px 0">Failed to load reports: ${e.message}</td></tr>`;
    }
  } catch (globalError) {
    alert("Global initialization crash: " + globalError.message);
    console.error(globalError);
  }
}

function handleMonthlyBrandFilterChange(val) {
  activeBrand = allBrands.find(b => b.id === val) || null;
  updateBrandUI();
  renderMonthlyReportsTable();
}

function renderMonthlyReportsTable() {
  const list = document.getElementById('monthly-tbody');
  if (!list) return;

  const brandFilterVal = document.getElementById('monthly-filter-brand')?.value || '';

  const filtered = allMonthlyReportsCache.filter(h => {
    const matchesBrand = !brandFilterVal || h.brand_id === brandFilterVal;
    const matchesType = h.report_type === 'monthly';
    return matchesBrand && matchesType;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--mid);padding:24px 0">No monthly reports found matching the filters.</td></tr>`;
    return;
  }

  list.innerHTML = filtered.map(h => {
    const startStr = h.period_start ? new Date(h.period_start).toLocaleDateString('en-US', {month:'short', year:'numeric'}) : '—';
    // MySQL DECIMAL columns come back through PDO (and therefore JSON) as numeric strings, not
    // numbers, so a strict typeof-number check here always failed and showed "—" for every row.
    const spendNum = parseFloat(h.total_spend);
    const revNum = parseFloat(h.total_revenue);
    const roasNum = parseFloat(h.overall_roas);
    const spend = Number.isFinite(spendNum) ? '₹' + Math.round(spendNum).toLocaleString() : '—';
    const rev = Number.isFinite(revNum) ? '₹' + Math.round(revNum).toLocaleString() : '—';
    const roas = Number.isFinite(roasNum) ? roasNum.toFixed(2) + 'x' : '—';
    const created = h.created_at ? new Date(h.created_at).toLocaleDateString() : '—';
    
    // Use unique_token (from report_links join) as the deck URL parameter
    const token = h.unique_token || h.shared_link || h.id;
    const viewUrl = `/monthly-report.html?token=${token}`;
    const fullShareUrl = window.location.origin + viewUrl;

    return `<tr>
      <td style="font-weight:700;color:var(--dark)">${h.brand_name || '—'}</td>
      <td style="font-weight:600">${startStr}</td>
      <td style="font-family:var(--fm)">${spend}</td>
      <td style="font-family:var(--fm)">${rev}</td>
      <td style="font-family:var(--fm);font-weight:700;color:#10B981">${roas}</td>
      <td style="font-size:11px;color:var(--mid)">${created}</td>
      <td>
        <input type="text" readonly value="${fullShareUrl}" onclick="this.select()" style="width:100%;max-width:200px;font-size:10px;padding:4px 6px;border:1px solid var(--border);border-radius:5px;background:var(--off);color:var(--fg);cursor:pointer" title="Click to select share link">
      </td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn sm" onclick="window.open('${viewUrl}','_blank')">👁 View Deck</button>
          <button class="btn sm" onclick="navigator.clipboard.writeText('${fullShareUrl}').then(()=>showToast('Share link copied!','success'))" style="background:rgba(67,97,238,0.1);color:var(--blue);border:1px solid rgba(67,97,238,0.2)">🔗 Copy</button>
          <button class="btn sm danger" onclick="deleteMonthlyReport('${h.id}')">🗑 Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openCreateMonthlyReport() {
  if (!activeBrand) {
    alert('Please select a brand from the top navigation first.');
    return;
  }
  
  document.getElementById('monthly-list-view').style.display = 'none';
  document.getElementById('monthly-create-view').style.display = 'block';
  document.getElementById('monthly-create-brand-meta').textContent = activeBrand.name;
  
  document.getElementById('monthly-rep-month').value = '';
  document.getElementById('monthly-rep-start-date').value = '';
  document.getElementById('monthly-rep-end-date').value = '';
  
  document.getElementById('manual-email-spend').value = 0;
  document.getElementById('manual-email-revenue').value = 0;
  document.getElementById('manual-email-orders').value = 0;
  document.getElementById('manual-email-sent').value = 0;
  document.getElementById('manual-email-open').value = 0;
  document.getElementById('manual-email-click').value = 0;
  
  document.getElementById('manual-wa-spend').value = 0;
  document.getElementById('manual-wa-revenue').value = 0;
  document.getElementById('manual-wa-orders').value = 0;
  document.getElementById('manual-wa-sent').value = 0;
  
  document.getElementById('manual-mp-spend').value = 0;
  document.getElementById('manual-mp-revenue').value = 0;
  document.getElementById('manual-mp-orders').value = 0;

  document.getElementById('manual-push-sent').value = 0;
  document.getElementById('manual-push-revenue').value = 0;
  document.getElementById('manual-push-open').value = 0;
  document.getElementById('manual-push-click').value = 0;

  document.getElementById('monthly-sync-status').textContent = 'Crawl Shopify storefront, Meta/Google ads, GA4 funnel and GSC search impressions.';
  document.getElementById('monthly-sync-status').style.color = '';
  
  syncedMonthlyData = null;
}

function backToMonthlyList() {
  document.getElementById('monthly-list-view').style.display = 'block';
  document.getElementById('monthly-create-view').style.display = 'none';
}

function handleMonthlyMonthSelect() {
  const mVal = document.getElementById('monthly-rep-month').value;
  if (!mVal) return;
  
  const [yr, mn] = mVal.split('-');
  const firstDay = `${yr}-${mn}-01`;
  
  const d = new Date(yr, mn, 0);
  const lastDay = `${yr}-${mn}-${String(d.getDate()).padStart(2, '0')}`;
  
  document.getElementById('monthly-rep-start-date').value = firstDay;
  document.getElementById('monthly-rep-end-date').value = lastDay;
}

async function triggerMonthlySync() {
  if (!activeBrand) return;
  const start = document.getElementById('monthly-rep-start-date').value;
  const end = document.getElementById('monthly-rep-end-date').value;
  
  if (!start || !end) {
    alert('Please select a target month first.');
    return;
  }
  
  const btn = document.getElementById('btn-sync-monthly');
  const statusEl = document.getElementById('monthly-sync-status');
  
  btn.disabled = true;
  btn.textContent = 'Syncing...';
  statusEl.textContent = 'Contacting integrations, downloading storefront & ad campaign metrics...';
  statusEl.style.color = '#d97706';
  
  try {
    const r = await api(`/api/sync.php?brand_id=${activeBrand.id}&start_date=${start}&end_date=${end}`);
    if (r && r.ok) {
      syncedMonthlyData = r;
      statusEl.textContent = `Sync completed successfully! Shopify items: ${r.sync_shopify}, Meta: ${r.sync_meta}, Google Ads: ${r.sync_google_ads}, GA4: ${r.sync_ga4}, GSC: ${r.sync_gsc}.`;
      statusEl.style.color = '#10B981';
    } else {
      statusEl.textContent = 'Sync encountered errors: ' + (r?.error || 'unreachable');
      statusEl.style.color = '#ef4444';
    }
  } catch(e) {
    statusEl.textContent = 'Sync failed: ' + e.message;
    statusEl.style.color = '#ef4444';
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Sync API Data';
  }
}

async function submitGenerateMonthlyReport() {
  if (!activeBrand) return;
  const start = document.getElementById('monthly-rep-start-date').value;
  const end = document.getElementById('monthly-rep-end-date').value;
  
  if (!start || !end) {
    alert('Please select a target month first.');
    return;
  }
  
  const btn = document.getElementById('btn-generate-monthly-report');
  btn.disabled = true;
  btn.textContent = 'Compiling Deck...';
  
  const ownedMedia = {
    email: {
      spend: parseFloat(document.getElementById('manual-email-spend').value) || 0,
      revenue: parseFloat(document.getElementById('manual-email-revenue').value) || 0,
      orders: parseInt(document.getElementById('manual-email-orders').value) || 0,
      sent: parseInt(document.getElementById('manual-email-sent').value) || 0,
      open_rate: parseFloat(document.getElementById('manual-email-open').value) || 0,
      click_rate: parseFloat(document.getElementById('manual-email-click').value) || 0
    },
    whatsapp: {
      spend: parseFloat(document.getElementById('manual-wa-spend').value) || 0,
      revenue: parseFloat(document.getElementById('manual-wa-revenue').value) || 0,
      orders: parseInt(document.getElementById('manual-wa-orders').value) || 0,
      sent: parseInt(document.getElementById('manual-wa-sent').value) || 0
    },
    marketplace: {
      spend: parseFloat(document.getElementById('manual-mp-spend').value) || 0,
      revenue: parseFloat(document.getElementById('manual-mp-revenue').value) || 0,
      orders: parseInt(document.getElementById('manual-mp-orders').value) || 0
    },
    push: {
      sent: parseInt(document.getElementById('manual-push-sent').value) || 0,
      revenue: parseFloat(document.getElementById('manual-push-revenue').value) || 0,
      open_rate: parseFloat(document.getElementById('manual-push-open').value) || 0,
      click_rate: parseFloat(document.getElementById('manual-push-click').value) || 0
    }
  };
  
  const payload = {
    brand_id: activeBrand.id,
    report_type: 'monthly',
    start_date: start,
    end_date: end,
    owned_media: ownedMedia,
    api_sync_data: syncedMonthlyData || {}
  };
  
  try {
    const r = await api('/api/reports?action=create', 'POST', payload);
    if (r && r.ok) {
      showToast('Monthly performance deck created successfully! Opening deck...', 'success');
      // Reload list to get unique_token, then open
      await initMonthlyReportsPage();
      backToMonthlyList();
      // Open the newly created report using its ID
      const viewUrl = `/monthly-report.html?id=${r.report_id}`;
      window.open(viewUrl, '_blank');
    } else {
      alert(r?.error || 'Failed to generate monthly report.');
    }
  } catch(e) {
    alert('Request failed: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Monthly Deck';
  }
}

async function deleteMonthlyReport(id) {
  if (!confirm('Are you sure you want to delete this monthly deck report? This cannot be undone.')) return;
  try {
    const r = await api(`/api/reports?action=delete&id=${id}`, 'DELETE');
    if (r && r.ok) {
      showToast('Report deleted successfully.', 'success');
      initMonthlyReportsPage();
    } else {
      alert(r?.error || 'Delete failed.');
    }
  } catch(e) {
    alert('Delete request failed: ' + e.message);
  }
}

async function triggerShopifyCatalogSync() {
  if (!activeBrand) return;
  const btn = document.getElementById('btn-sync-shopify-catalog');
  btn.disabled = true;
  btn.textContent = 'Syncing...';
  
  try {
    const r = await api(`/api/pricing?brand=${activeBrand.slug}&action=sync_shopify`, 'POST');
    if (r && r.ok) {
      showToast(`Successfully synced ${r.count} products from Shopify!`, 'success');
      if (typeof loadProducts === 'function') loadProducts();
    } else {
      alert(r?.error || 'Failed to sync Shopify catalog.');
    }
  } catch(e) {
    alert('Catalog sync failed: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Sync Shopify Catalog';
  }
}

