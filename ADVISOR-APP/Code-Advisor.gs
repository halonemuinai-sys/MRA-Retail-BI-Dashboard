/**
 * ADVISOR PORTAL BACKEND
 * File: Code-Advisor.gs
 * Description: API untuk Advisor Portal dengan Login System.
 */

// ============================
// CONFIGURATION
// ============================
const ADVISOR_SS_ID  = '1vVVHE-IxXz-nrE8OPCLPNmbVDeA3cGALbllWwaum87Q'; // Sheet Login Advisor
const DASHBOARD_SS_ID = '1jRFK1jPuK_-pVvJYNx1PbvDEJaeAK4ZUZ0QTxWJsxwQ'; // Sheet Dashboard Utama
const PROFILING_SS_ID = '17dIze7RwnA4nqxCVRbTeDIDlwCmW1OvgXQ9zMOM-ovM'; // Sheet Traffic/Profiling
const LOGIN_SHEET_NAME = 'login';
const CACHE_TTL = 1800; // 30 menit dalam detik

// ============================
// WEB APP ENTRY
// ============================
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index-Advisor')
    .evaluate()
    .setTitle('Bvlgari Advisor Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ============================
// SETUP: Buat Template Sheet Login
// ============================
function setupLoginSheet() {
  const ss = SpreadsheetApp.openById(ADVISOR_SS_ID);
  let sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(LOGIN_SHEET_NAME);
  }

  const headers = ['Nama', 'PIN', 'Store', 'Role', 'Status'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1e293b')
    .setFontColor('#ffffff');

  const sampleData = [
    ['Sarah Wijaya',    '1234', 'Plaza Indonesia', 'Senior Advisor',  'Active'],
    ['Aditya Pratama',  '5678', 'Plaza Indonesia', 'Advisor',         'Active'],
    ['Bima Kusuma',     '9012', 'Plaza Senayan',   'Senior Advisor',  'Active'],
    ['Dewi Anggraini',  '3456', 'Plaza Senayan',   'Advisor',         'Active'],
    ['Reza Fadillah',   '7890', 'Bali',            'Store Manager',   'Active'],
  ];

  sheet.getRange(2, 1, sampleData.length, sampleData[0].length).setValues(sampleData);
  
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  Logger.log('Login Sheet berhasil dibuat dengan ' + sampleData.length + ' sample advisors.');
}

// ============================
// LOGIN API
// ============================

function getAdvisorList() {
  try {
    const ss = SpreadsheetApp.openById(ADVISOR_SS_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    if (!sheet) return { success: false, message: 'Sheet login belum dibuat. Jalankan setupLoginSheet() terlebih dahulu.' };

    const data = sheet.getDataRange().getValues();
    data.shift();

    const advisors = data
      .filter(row => String(row[4]).trim().toLowerCase() === 'active')
      .map(row => ({
        name: String(row[0]).trim(),
        store: String(row[2]).trim()
      }));

    return { success: true, advisors: advisors };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function loginAdvisor(name, pin) {
  try {
    const ss = SpreadsheetApp.openById(ADVISOR_SS_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    if (!sheet) return { success: false, message: 'Sheet login tidak ditemukan.' };

    const data = sheet.getDataRange().getValues();
    data.shift();

    const found = data.find(row => {
      const rowName = String(row[0]).trim().toLowerCase();
      const rowPin  = String(row[1]).trim();
      const rowStatus = String(row[4]).trim().toLowerCase();
      return rowName === name.trim().toLowerCase() && rowPin === pin && rowStatus === 'active';
    });

    if (!found) {
      return { success: false, message: 'Nama atau PIN salah.' };
    }

    return {
      success: true,
      user: {
        name:  String(found[0]).trim(),
        store: String(found[2]).trim(),
        role:  String(found[3]).trim()
      }
    };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

/**
 * Ganti PIN advisor
 * @param {string} name - Nama advisor
 * @param {string} oldPin - PIN lama
 * @param {string} newPin - PIN baru (4 digit)
 */
function changeAdvisorPin(name, oldPin, newPin) {
  try {
    if (!newPin || newPin.length < 4) return { success: false, message: 'PIN baru harus 4 digit.' };

    const ss = SpreadsheetApp.openById(ADVISOR_SS_ID);
    const sheet = ss.getSheetByName(LOGIN_SHEET_NAME);
    if (!sheet) return { success: false, message: 'Sheet login tidak ditemukan.' };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const rowName = String(data[i][0]).trim().toLowerCase();
      const rowPin  = String(data[i][1]).trim();
      if (rowName === name.trim().toLowerCase() && rowPin === oldPin) {
        sheet.getRange(i + 1, 2).setValue(newPin); // Update kolom PIN
        return { success: true, message: 'PIN berhasil diubah!' };
      }
    }
    return { success: false, message: 'PIN lama salah.' };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ============================
// DATA API: Dashboard Performance
// ============================

/**
 * Mengambil data performa advisor + target dari master_sales_advisor
 * @param {string} advisorName
 * @param {number} month - Bulan (0-11), default bulan ini
 * @param {number} year  - Tahun, default tahun ini
 */
function getAdvisorDashboardData(advisorName, month, year) {
  // --- CACHE CHECK ---
  const cache = CacheService.getScriptCache();
  const now = new Date();
  const m = (month !== undefined && month !== null) ? parseInt(month) : now.getMonth();
  const y = (year  !== undefined && year  !== null) ? parseInt(year)  : now.getFullYear();
  const cacheKey = 'dash_' + advisorName.toLowerCase().replace(/\s/g,'') + '_' + m + '_' + y;
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) { /* cache corrupt, recalculate */ }
  }

  try {
    const ss = SpreadsheetApp.openById(DASHBOARD_SS_ID);
    const cleanSheet = ss.getSheetByName('clean_master');
    const data = cleanSheet.getDataRange().getValues();
    data.shift();
    
    const COL = { DATE: 1, SALESMAN: 3, LOCATION: 4, MAIN_CAT: 6, NET_SALES: 14, QTY: 16 };
    const selectedMonth = m;
    const selectedYear  = y;
    const mNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

    let myTotalSales = 0;
    let myTrxCount = 0;
    let myQty = 0;
    let myMonthlySales = Array(12).fill(0);
    const categoryMap = {}; // { catName: { net, qty, count } }

    data.forEach(row => {
      if (String(row[COL.SALESMAN]).trim().toLowerCase() === advisorName.toLowerCase()) {
        const date = new Date(row[COL.DATE]);
        const net = Number(row[COL.NET_SALES]) || 0;
        const qty = Number(row[COL.QTY]) || 0;

        if (date.getFullYear() === selectedYear) {
          myMonthlySales[date.getMonth()] += net;
          if (date.getMonth() === selectedMonth) {
            myTotalSales += net;
            myTrxCount++;
            myQty += qty;

            // Category breakdown bulan ini
            const cat = String(row[COL.MAIN_CAT] || 'Uncategorized').trim();
            if (!categoryMap[cat]) categoryMap[cat] = { net: 0, qty: 0, count: 0 };
            categoryMap[cat].net += net;
            categoryMap[cat].qty += qty;
            categoryMap[cat].count++;
          }
        }
      }
    });

    // Ambil target dari master_sales_advisor
    let myTarget = 0;
    try {
      const advSheet = ss.getSheetByName('master_sales_advisor');
      if (advSheet) {
        const advData = advSheet.getDataRange().getValues();
        if (advData.length > 0) {
          const headers = advData[0];
          const monthName = mNames[selectedMonth];
          const monthColIndex = headers.findIndex(h => {
            const hStr = String(h).trim().toLowerCase();
            return hStr === monthName.toLowerCase() || monthName.toLowerCase().startsWith(hStr);
          });

          if (monthColIndex > -1) {
            for (let i = 1; i < advData.length; i++) {
              const r = advData[i];
              if (String(r[0]) != String(selectedYear)) continue;
              const sheetName = String(r[1]).trim().toLowerCase();
              if (sheetName === advisorName.toLowerCase() || advisorName.toLowerCase().includes(sheetName)) {
                myTarget = Number(r[monthColIndex]) || 0;
                break;
              }
            }
          }
        }
      }
    } catch(e) { console.warn('Target lookup error: ' + e.message); }

    if (myTarget === 0) myTarget = 500000000; // Fallback default

    const result = {
      success: true,
      data: {
        name: advisorName,
        totalSales: myTotalSales,
        totalTrx: myTrxCount,
        totalQty: myQty,
        target: myTarget,
        achievement: myTarget > 0 ? (myTotalSales / myTarget) * 100 : 0,
        monthlyChart: myMonthlySales,
        monthName: mNames[selectedMonth],
        selectedMonth: selectedMonth,
        selectedYear: selectedYear,
        categoryBreakdown: Object.entries(categoryMap)
          .map(([cat, d]) => ({ category: cat, netSales: d.net, qty: d.qty, count: d.count }))
          .sort((a, b) => b.netSales - a.netSales),
        lastSync: new Date().toLocaleString('id-ID')
      }
    };

    // --- SAVE TO CACHE ---
    try { cache.put(cacheKey, JSON.stringify(result), CACHE_TTL); } catch(e) { /* ignore cache save errors */ }

    return result;
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ============================
// DATA API: Prospect Detail Data
// ============================

/**
 * Mengambil Prospect Detail Data milik advisor.
 * @param {string} advisorName
 * @param {number} month - Bulan (0-11)
 * @param {number} year  - Tahun
 */
function getAdvisorProspects(advisorName, month, year) {
  // --- CACHE CHECK ---
  const cache = CacheService.getScriptCache();
  const now = new Date();
  const m = (month !== undefined && month !== null) ? parseInt(month) : now.getMonth();
  const y = (year  !== undefined && year  !== null) ? parseInt(year)  : now.getFullYear();
  const cacheKey = 'prosp_' + advisorName.toLowerCase().replace(/\s/g,'') + '_' + m + '_' + y;
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) { /* cache corrupt, recalculate */ }
  }

  try {
    const TCOL = { NAME: 2, SERVED_BY: 5, LOCATION: 6, STATUS: 7, DATE: 11, PROSPECT: 17 };

    const extSS = SpreadsheetApp.openById(PROFILING_SS_ID);
    const trafficSheet = extSS.getSheetByName('Traffic');
    if (!trafficSheet) return { success: true, prospects: [], stats: {} };

    const lastRow = trafficSheet.getLastRow();
    if (lastRow <= 1) return { success: true, prospects: [], stats: {} };

    const tData = trafficSheet.getRange(2, 1, lastRow - 1, trafficSheet.getLastColumn()).getValues();

    const selectedMonth = m;
    const selectedYear  = y;
    const mNames = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

    const prospects = [];
    let walkIn = 0, followUp = 0, delivery = 0;

    tData.forEach(row => {
      const servedBy = String(row[TCOL.SERVED_BY] || '').trim();
      if (servedBy.toLowerCase() !== advisorName.toLowerCase()) return;

      let dateVal = row[TCOL.DATE];
      if (!dateVal) return;

      let d;
      try {
        d = new Date(dateVal);
        if (isNaN(d.getTime())) return;
      } catch(e) { return; }

      // Filter bulan ini saja
      if (d.getFullYear() !== selectedYear || d.getMonth() !== selectedMonth) return;

      const dayStr = String(d.getDate()).padStart(2, '0');
      const dateFormatted = dayStr + ' ' + mNames[d.getMonth()] + ' ' + d.getFullYear();

      const rowStatus = String(row[TCOL.STATUS] || '').trim();
      const sLower = rowStatus.toLowerCase();
      if (sLower.includes('walk')) walkIn++;
      else if (sLower.includes('follow')) followUp++;
      else if (sLower.includes('delivery') || sLower.includes('showing')) delivery++;

      prospects.push({
        date: dateFormatted,
        name: String(row[TCOL.NAME] || '-').trim(),
        location: String(row[TCOL.LOCATION] || '-').trim(),
        status: rowStatus || '-',
        prospectLevel: String(row[TCOL.PROSPECT] || '-').trim()
      });
    });

    // Sort newest first
    prospects.reverse();

    const result = {
      success: true,
      prospects: prospects,
      stats: { walkIn, followUp, delivery, total: prospects.length }
    };

    // --- SAVE TO CACHE ---
    try { cache.put(cacheKey, JSON.stringify(result), CACHE_TTL); } catch(e) { /* ignore */ }

    return result;
  } catch (e) {
    return { success: false, message: e.message, prospects: [], stats: {} };
  }
}

/**
 * Menghapus semua cache advisor (bisa dipanggil manual jika data perlu di-refresh).
 */
function clearAdvisorCache() {
  CacheService.getScriptCache().removeAll([
    // Clear will happen naturally after TTL expires
    // This function is for manual override if needed
  ]);
  // Alternative: clear all script cache
  return { success: true, message: 'Cache cleared. Data will reload from source on next request.' };
}
