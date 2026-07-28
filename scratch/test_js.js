const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock browser globals
const sandbox = {
  window: {
    currentUser: { id: '00000000-0000-0000-0000-000000000001', role: 'superadmin', name: 'Admin' },
    location: { hash: '#budget', origin: 'http://localhost' },
    addEventListener: () => {}
  },
  document: {
    getElementById: (id) => {
      return {
        style: {},
        addEventListener: () => {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        appendChild: () => {},
        textContent: '',
        innerHTML: ''
      };
    },
    querySelectorAll: () => []
  },
  navigator: {},
  fetch: async (url) => {
    return {
      status: 200,
      ok: true,
      text: async () => JSON.stringify({
        brands: [
          {
            brand: { id: 'b1', slug: 'b1', name: 'Brand 1', type: 'sales' },
            month: { id: 'm1', label: 'May 2026' },
            summary: { targetPct: 80, projTargetPct: 90, daysLeft: 10, totalSalesReal: 5000, projectedSales: 6000, totalROAS: 4 },
            todayFlags: []
          }
        ],
        availableMonths: []
      })
    };
  },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Math: Math,
  parseFloat: parseFloat,
  parseInt: parseInt,
  Object: Object,
  Array: Array,
  String: String,
  Number: Number,
  Boolean: Boolean,
  Date: Date,
  RegExp: RegExp,
  Error: Error,
  JSON: JSON
};

sandbox.global = sandbox;
sandbox.globalThis = sandbox;

// Load assets/app.js code
const code = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');

try {
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'assets/app.js' });
  console.log("SUCCESSFULLY EVALUATED assets/app.js in VM sandbox!");
  
  if (typeof sandbox.renderBgtDashboard === 'function') {
    console.log("Calling renderBgtDashboard inside sandbox...");
    sandbox.renderBgtDashboard([
      {
        brand: { id: 'b1', slug: 'b1', name: 'Brand 1', type: 'sales' },
        month: { id: 'm1', label: 'May 2026' },
        summary: { targetPct: 80, projTargetPct: 90, daysLeft: 10, totalSalesReal: 5000, projectedSales: 6000, totalROAS: 4 },
        todayFlags: []
      }
    ]);
    console.log("renderBgtDashboard executed successfully!");
  } else {
    console.log("renderBgtDashboard is not a function in sandbox!");
  }
} catch (e) {
  console.error("JAVASCRIPT EXCEPTION THROWN:", e);
}
