/**
 * File: 5-API_Reports.gs
 * Description: Fungsi API untuk Laporan Harian dan Performa Produk/SAP.
 */

// --- B. Product Rank (SAP) ---
function getSapPerformance(monthName, year, forceRefresh = false) {
  const cacheKey = `SAP_PERF_${monthName}_${year}`;
  const cache = CacheService.getScriptCache();
  if (forceRefresh) cache.remove(cacheKey);
  else {
    const cached = cache.get(cacheKey);
    if (cached) try { return JSON.parse(cached); } catch(e) {}
  }

  const ss = getSpreadsheet();
  const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
  if (!cleanSheet) return { error: "Data not found." };
  const data = cleanSheet.getDataRange().getValues();
  data.shift(); 
  const COL = CONFIG.CLEAN_COLS;
  const monthIndex = new Date(`${monthName} 1, 2000`).getMonth();
  const filteredData = data.filter(row => {
    const d = parseDateFix(row[COL.DATE]);
    return d.getMonth() === monthIndex && d.getFullYear() == year;
  });

  const sapMap = {}; const catMap = {}; const collMap = {}; const catalogueMap = {};
  filteredData.forEach(row => {
    const sapCode = String(row[COL.SAP] || "Unknown").trim();
    const cat = String(row[COL.MAIN_CAT] || "Other").trim();
    const coll = String(row[COL.COLL] || "Other").trim();
    const catalogue = String(row[COL.CATALOGUE] || "-").trim();
    const qty = Number(row[COL.QTY]) || 0;
    const net = Number(row[COL.NET_SALES]) || 0;

    if (!sapMap[sapCode]) sapMap[sapCode] = { sap: sapCode, category: cat, collection: coll, qty: 0, net: 0 };
    sapMap[sapCode].qty += qty; sapMap[sapCode].net += net;

    if (!catMap[cat]) catMap[cat] = { name: cat, qty: 0, net: 0 };
    catMap[cat].qty += qty; catMap[cat].net += net;

    if (!collMap[coll]) collMap[coll] = { name: coll, qty: 0, net: 0 };
    collMap[coll].qty += qty; collMap[coll].net += net;

    if (!catalogueMap[catalogue]) catalogueMap[catalogue] = { name: catalogue, qty: 0, net: 0 };
    catalogueMap[catalogue].qty += qty; catalogueMap[catalogue].net += net;
  });

  const sortByNet = (a, b) => b.net - a.net;
  const sortByQty = (a, b) => b.qty - a.qty;

  const result = {
    topSapQty: Object.values(sapMap).sort(sortByQty).slice(0, 10),
    topSapVal: Object.values(sapMap).sort(sortByNet).slice(0, 10),
    topCat: Object.values(catMap).sort(sortByNet),
    topColl: Object.values(collMap).sort(sortByNet).slice(0, 10),
    topCatalogue: Object.values(catalogueMap).sort(sortByNet).slice(0, 10)
  };
  cache.put(cacheKey, JSON.stringify(result), 300);
  return result;
}

function getCategoryTrendData(monthName, year, category, forceRefresh = false) {
  const cacheKey = `CAT_TREND_${category}_${year}`;
  const cache = CacheService.getScriptCache();
  if (forceRefresh) cache.remove(cacheKey);
  else {
    const cached = cache.get(cacheKey);
    if (cached) try { return JSON.parse(cached); } catch(e) {}
  }

  const ss = getSpreadsheet();
  const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
  if (!cleanSheet) return { error: "Data not found." };
  
  const data = cleanSheet.getDataRange().getValues();
  data.shift();
  const COL = CONFIG.CLEAN_COLS;
  
  // Create shell for multi-year stat
  const targetYears = [2023, 2024, 2025, 2026];
  const multiYearStats = {};
  targetYears.forEach(y => {
      multiYearStats[y] = {
          net: new Array(12).fill(0),
          qty: new Array(12).fill(0)
      };
  });
  
  // Aggregation
  data.forEach(row => {
    const dStr = row[COL.DATE];
    if (!dStr) return;
    const d = parseDateFix(dStr);
    const rowYear = d.getFullYear();
    const rowMonth = d.getMonth(); // 0 to 11
    
    if (multiYearStats[rowYear] !== undefined) {
      const rowCat = String(row[COL.MAIN_CAT] || "Other").trim();
      if (category === 'All' || rowCat === category) {
        const net = Number(row[COL.NET_SALES]) || 0;
        const qty = Number(row[COL.QTY]) || 0;
        multiYearStats[rowYear].net[rowMonth] += net;
        multiYearStats[rowYear].qty[rowMonth] += qty;
      }
    }
  });

  // Calculate YTD and comparisons (Hardcoded to 2026 vs 2025 as requested)
  const targetYearNum = 2026;
  const prevYearNum = 2025;
  
  const selectedYearData = multiYearStats[targetYearNum] || { net: new Array(12).fill(0), qty: new Array(12).fill(0) };
  const prevYearData = multiYearStats[prevYearNum] || { net: new Array(12).fill(0), qty: new Array(12).fill(0) };
  
  let ytdNet = 0;
  let ytdQty = 0;
  let prevYtdNet = 0;
  let prevYtdQty = 0;
  let monthsWithData = 0;
  
  const currentDate = new Date();
  const isCurrentYear = (targetYearNum === currentDate.getFullYear());
  const maxMonthToCheck = isCurrentYear ? currentDate.getMonth() : 11;

  for (let i = 0; i <= maxMonthToCheck; i++) {
        if(selectedYearData.net[i] > 0 || selectedYearData.qty[i] > 0) {
           ytdNet += selectedYearData.net[i];
           ytdQty += selectedYearData.qty[i];
           
           prevYtdNet += prevYearData.net[i];
           prevYtdQty += prevYearData.qty[i];

           monthsWithData += 1;
        }
  }

  const result = {
    multiYearStats: multiYearStats,
    metrics: {
        value: {
            ytd: ytdNet,
            prevYtd: prevYtdNet,
            growth: prevYtdNet > 0 ? ((ytdNet - prevYtdNet) / prevYtdNet) * 100 : 0
        },
        qty: {
            ytd: ytdQty,
            prevYtd: prevYtdQty,
            growth: prevYtdQty > 0 ? ((ytdQty - prevYtdQty) / prevYtdQty) * 100 : 0
        }
    },
    monthsMeasured: monthsWithData
  };
  cache.put(cacheKey, JSON.stringify(result), 300);
  return result;
}

// --- C. Daily Report ---
function getDetailedDailyData(dateStr) {
  const ss = getSpreadsheet();
  const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
  const data = cleanSheet ? cleanSheet.getDataRange().getValues() : [];
  if (data.length > 1) data.shift();

  // Get Store List Logic
  const targetSheet = ss.getSheetByName(CONFIG.SHEETS.MASTER_TARGET_STORE);
  const storeSet = new Set();
  if (targetSheet && targetSheet.getLastRow() > 0) {
    const header = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
    header.slice(2).forEach(s => { if (s) storeSet.add(s); });
  }
  data.forEach(r => { if (r[4]) storeSet.add(r[4]); });
  const storeList = Array.from(storeSet);
  const stockSheet = ss.getSheetByName(CONFIG.SHEETS.MASTER_STOCK);
  const stockData = stockSheet ? stockSheet.getDataRange().getValues() : [];

  const resultStores = storeList.map(storeName => {
    return calculateStoreDaily(storeName, dateStr, data, ss, stockData);
  });
  return { date: dateStr, stores: resultStores };
}

function downloadDailyReportCSV(dateStr) {
  try {
    const reportData = getDetailedDailyData(dateStr);
    let csv = "Store,Category,Stock,Qty Sold,Regular Sales,SMI Sales\n";
    
    reportData.stores.forEach(store => {
      // Sort categories to match UI order if possible, or just iterate properties
      const cats = ["Jewelry", "Watches", "Accessories", "Perfume"];
      cats.forEach(cat => {
        const data = store.tableData[cat];
        if (data) {
           // Escape store name just in case
           const storeName = `"${store.storeName.replace(/"/g, '""')}"`;
           csv += `${storeName},${cat},${data.stock},${data.qty},${data.netNonSMI},${data.netSMI}\n`;
        }
      });
    });
    
    const filename = `Daily_Breakdown_${dateStr}.csv`;
    const blob = Utilities.newBlob(csv, MimeType.CSV, filename);
    return { base64: Utilities.base64Encode(blob.getBytes()), filename: filename };
    
  } catch (e) {
    return { error: e.message };
  }
}

function downloadDailyReportPDF_Old(dateStr) {
  try {
    const reportData = getDetailedDailyData(dateStr);
    
    // Simple HTML Template for PDF
    let html = `
    <html>
      <head>
        <style>
          body { font-family: sans-serif; font-size: 10px; color: #333; }
          h1 { font-size: 16px; margin-bottom: 5px; }
          p { margin: 0 0 20px 0; color: #666; }
          .store-section { margin-bottom: 20px; page-break-inside: avoid; }
          h3 { margin: 0 0 10px 0; background: #eee; padding: 5px; border-radius: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th { text-align: left; border-bottom: 1px solid #ccc; padding: 5px; font-size: 9px; }
          td { border-bottom: 1px solid #eee; padding: 5px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          tfoot td { font-weight: bold; border-top: 1px solid #ccc; background: #f9f9f9; }
        </style>
      </head>
      <body>
        <h1>Daily Breakdown Report</h1>
        <p>Date: ${dateStr}</p>
    `;
    
    reportData.stores.forEach(store => {
      html += `
        <div class="store-section">
          <h3>${store.storeName}</h3>
          <table>
            <thead>
              <tr>
                <th width="30%">Category</th>
                <th width="15%" class="text-center">Stock</th>
                <th width="15%" class="text-center">Qty Sold</th>
                <th width="20%" class="text-right">Regular Sales</th>
                <th width="20%" class="text-right">SMI Sales</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      const cats = ["Jewelry", "Watches", "Accessories", "Perfume"];
      let tStock = 0, tQty = 0, tReg = 0, tSmi = 0;
      
      cats.forEach(cat => {
        const data = store.tableData[cat];
        if (data) {
           tStock += data.stock;
           tQty += data.qty;
           tReg += data.netNonSMI;
           tSmi += data.netSMI;
           
           html += `
             <tr>
               <td>${cat}</td>
               <td class="text-center">${data.stock}</td>
               <td class="text-center">${data.qty}</td>
               <td class="text-right">${Number(data.netNonSMI).toLocaleString("id-ID")}</td>
               <td class="text-right">${Number(data.netSMI).toLocaleString("id-ID")}</td>
             </tr>
           `;
        }
      });
      
      html += `
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL</td>
                <td class="text-center">${tStock}</td>
                <td class="text-center">${tQty}</td>
                <td class="text-right">${tReg.toLocaleString("id-ID")}</td>
                <td class="text-right">${tSmi.toLocaleString("id-ID")}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    });
    
    html += `</body></html>`;
    
    const blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF);
    blob.setName(`Daily_Breakdown_${dateStr}.pdf`);
    return { base64: Utilities.base64Encode(blob.getBytes()), filename: blob.getName() };

  } catch (e) {
    return { error: e.message };
  }
}

// --- D. Advisor Report ---
function getAdvisorReportData(monthName, year) {
  const ss = getSpreadsheet();
  const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
  const data = cleanSheet ? cleanSheet.getDataRange().getValues() : [];
  if (data.length > 1) data.shift();
  const COL = CONFIG.CLEAN_COLS; // 0-based from Config
  
  const monthIndex = new Date(`${monthName} 1, 2000`).getMonth();
  const monthlyData = data.filter(row => {
    const d = parseDateFix(row[COL.DATE]);
    return d.getMonth() === monthIndex && d.getFullYear() == year;
  });

  const overview = aggregateOverview(monthlyData, COL, ss, monthName, year);
  const results = calculateAdvisorPerformance(
    monthlyData, COL, ss, monthName, year,
    overview.kpi.totalTarget,
    overview.rawStoreStats,
    overview.rawTargetMap
  );
  
  return { advisors: results, month: monthName, year: year };
}

// --- ANNUAL ADVISOR REPORT ---
function getAnnualAdvisorData(year) {
  const ss = getSpreadsheet();
  const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
  const data = cleanSheet ? cleanSheet.getDataRange().getValues() : [];
  if (data.length > 1) data.shift();
  const COL = CONFIG.CLEAN_COLS; 

  // Filter for whole Year
  const yearData = data.filter(row => {
    const d = parseDateFix(row[COL.DATE]);
    return d.getFullYear() == year;
  });

  // Calculate Annual Target (Aggregated per Advisor)
  // Reuse existing logic but pass "Annual" as month context implies full year aggregation if we tweak logic
  // But calculateAdvisorPerformance expects a specific month for Target lookup usually.
  
  // Custom Aggregation for Annual
  const advisorStats = {}; // name -> { net: 0, target: 0, transactions: Set }
  
  // 1. Sum Actual Sales
  yearData.forEach(row => {
     const name = String(row[COL.SALESMAN]).trim().toLowerCase();
     if(!name) return;
     const net = Number(row[COL.NET_SALES]) || 0;
     const transId = row[COL.TRANS_NO];
     const transDate = parseDateFix(row[COL.DATE]);
     const transMonth = transDate.getMonth();
     
     if(!advisorStats[name]) advisorStats[name] = { name: String(row[COL.SALESMAN]).trim(), net: 0, target: 0, transactions: new Set(), location: String(row[COL.LOCATION]).trim(), productiveMonths: new Set() };
     
     advisorStats[name].net += net;
     advisorStats[name].transactions.add(transId);
     if (!isNaN(transMonth)) advisorStats[name].productiveMonths.add(transMonth);
  });

  // 2. Sum Targets (Iterate all months for the year from Master Advisor)
  const advSheet = ss.getSheetByName(CONFIG.SHEETS.MASTER_ADVISOR);
  if(advSheet) {
    const advData = advSheet.getDataRange().getValues();
    const headers = advData[0] || [];
    // Identify all month columns
    const monthCols = [];
    headers.forEach((h, i) => {
       const hStr = String(h).trim().toLowerCase();
       if(["january","february","march","april","may","june","july","august","september","october","november","december"].some(m => hStr.includes(m))) {
         monthCols.push(i);
       }
    });

    for(let i=1; i<advData.length; i++) {
       const row = advData[i];
       if(String(row[0]) == year) {
          const name = String(row[1]).trim();
          const key = name.toLowerCase();
          
          let totalAnnualTarget = 0;
          monthCols.forEach(idx => totalAnnualTarget += (Number(row[idx]) || 0));
          
          if(!advisorStats[key]) {
             if(totalAnnualTarget > 0) {
                 advisorStats[key] = { name: name, net: 0, target: 0, transactions: new Set(), location: String(row[3]).trim(), productiveMonths: new Set() };
             } else {
               continue;
             }
          }
          advisorStats[key].target += totalAnnualTarget;
       }
    }
  }

  // 3. Format Result
  const results = Object.values(advisorStats).map(s => ({
     name: s.name,
     location: s.location,
     netSales: s.net,
     target: s.target,
     achievement: s.target > 0 ? (s.net / s.target)*100 : 0,
     transCount: s.transactions.size,
     productiveMonths: s.productiveMonths ? s.productiveMonths.size : 0,
     contribution: 0 // Calculated below
  }));
  
  const totalNet = results.reduce((acc, curr) => acc + curr.netSales, 0);
  results.forEach(r => {
    r.contribution = totalNet > 0 ? (r.netSales / totalNet) * 100 : 0;
  });

  return results.sort((a,b) => b.achievement - a.achievement);
}

function downloadAdvisorReportExcel(month, year) {
  try {
    const data = getAdvisorReportData(month, year);
    let csv = "Rank,Advisor Name,Location,Net Sales,Target,Achievement %,Contribution %,Trans Count\n";
    
    data.advisors.forEach((adv, i) => {
       const name = `"${adv.name.replace(/"/g, '""')}"`;
       const loc = `"${adv.location.replace(/"/g, '""')}"`;
       csv += `${i+1},${name},${loc},${adv.netSales},${adv.target},${adv.achievement.toFixed(2)}%,${adv.contribution.toFixed(2)}%,${adv.transCount}\n`;
    });
    
    const filename = `Advisor_Performance_${month}_${year}.csv`;
    const blob = Utilities.newBlob(csv, MimeType.CSV, filename);
    return { base64: Utilities.base64Encode(blob.getBytes()), filename: filename };
    
  } catch (e) { return { error: e.message }; }
}

function downloadAnnualAdvisorReportExcel(year) {
  try {
    const data = getAnnualAdvisorData(year);
    let csv = "Rank,Advisor Name,Location,YTD Sales,YTD Target,Achievement %,Contribution %,Productive Months,Trans Count\n";
    
    data.forEach((adv, i) => {
       const name = `"${adv.name.replace(/"/g, '""')}"`;
       const loc = `"${adv.location.replace(/"/g, '""')}"`;
       csv += `${i+1},${name},${loc},${adv.netSales},${adv.target},${adv.achievement.toFixed(2)}%,${adv.contribution.toFixed(2)}%,${adv.productiveMonths},${adv.transCount}\n`;
    });
    
    const filename = `Advisor_Annual_Performance_YTD_${year}.csv`;
    const blob = Utilities.newBlob(csv, MimeType.CSV, filename);
    return { base64: Utilities.base64Encode(blob.getBytes()), filename: filename };
    
  } catch (e) { return { error: e.message }; }
}

function downloadAdvisorReportPDF(month, year) {
  try {
    const data = getAdvisorReportData(month, year);
    let html = `
    <html><head><style>
      body { font-family: sans-serif; font-size: 10px; color: #333; }
      h1 { font-size: 18px; margin-bottom: 5px; }
      h2 { font-size: 12px; color: #666; margin-bottom: 15px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { text-align: left; background: #2563EB; color: white; padding: 6px; font-size: 10px; }
      td { border-bottom: 1px solid #eee; padding: 6px; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      tr:nth-child(even) { background-color: #f9f9f9; }
    </style></head><body>
      <h1>Advisor Performance Report</h1>
      <h2>Period: ${month} ${year}</h2>
      <table>
        <thead>
          <tr>
            <th width="5%" class="text-center">#</th>
            <th width="25%">Advisor Name</th>
            <th width="20%">Location</th>
            <th width="15%" class="text-right">Net Sales</th>
            <th width="15%" class="text-right">Target</th>
            <th width="10%" class="text-center">Achv %</th>
            <th width="10%" class="text-center">Contrib %</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    data.advisors.forEach((adv, i) => {
      html += `
        <tr>
          <td class="text-center">${i+1}</td>
          <td>${adv.name}</td>
          <td>${adv.location}</td>
          <td class="text-right">${Number(adv.netSales).toLocaleString("id-ID")}</td>
          <td class="text-right">${Number(adv.target).toLocaleString("id-ID")}</td>
          <td class="text-center">${adv.achievement.toFixed(1)}%</td>
          <td class="text-center">${adv.contribution.toFixed(1)}%</td>
        </tr>
      `;
    });
    
    html += `</tbody></table></body></html>`;
    
    const blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF);
    blob.setName(`Advisor_Performance_${month}_${year}.pdf`);
    return { base64: Utilities.base64Encode(blob.getBytes()), filename: blob.getName() };
    
  } catch (e) { return { error: e.message }; }
}

// --- E. Monthly Transaction Report (Daily Trend) ---
function getMonthlyTransReportData(monthName, year, forceRefresh = false) {
  const cacheKey = `HEATMAP_${monthName}_${year}`;
  const cache = CacheService.getScriptCache();
  if (forceRefresh) cache.remove(cacheKey);
  else {
    const cached = cache.get(cacheKey);
    if (cached) try { return JSON.parse(cached); } catch(e) {}
  }

  const ss = getSpreadsheet();
  const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
  const data = cleanSheet ? cleanSheet.getDataRange().getValues() : [];
  if (data.length > 1) data.shift();
  const COL = CONFIG.CLEAN_COLS;
  
  const monthIndex = new Date(`${monthName} 1, 2000`).getMonth();
  const monthlyData = data.filter(row => {
    const d = parseDateFix(row[COL.DATE]);
    return d.getMonth() === monthIndex && d.getFullYear() == year;
  });

  // Calculate Daily Stats
  const activeStores = new Set();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const dailyStats = new Array(daysInMonth).fill(null).map(() => ({ net: 0, qty: 0, breakdown: {} }));

  monthlyData.forEach(row => {
    const d = parseDateFix(row[COL.DATE]);
    const day = d.getDate() - 1;
    if (day >= 0 && day < daysInMonth) {
      const net = Number(row[COL.NET_SALES]) || 0;
      const qty = Number(row[COL.QTY]) || 0;
      const loc = String(row[COL.LOCATION]).trim();
      activeStores.add(loc);
      dailyStats[day].net += net;
      dailyStats[day].qty += qty;
      if (!dailyStats[day].breakdown[loc]) dailyStats[day].breakdown[loc] = { net: 0, qty: 0 };
      dailyStats[day].breakdown[loc].net += net;
      dailyStats[day].breakdown[loc].qty += qty;
    }
  });

  const result = { 
    month: monthName, year: year, 
    days: dailyStats, 
    stores: Array.from(activeStores).sort() 
  };
  cache.put(cacheKey, JSON.stringify(result), 300);
  return result;
}

function downloadMonthlyTransReportExcel(month, year) {
  try {
    const data = getMonthlyTransReportData(month, year);
    let csv = "Date,Day,Total Sales,Total Qty";
    
    // Header
    data.stores.forEach(s => {
       const sn = `"${s.replace(/"/g, '""')}"`;
       csv += `,${sn} Sales,${sn} Qty`;
    });
    csv += "\n";
    
    // Rows
    data.days.forEach((dayData, i) => {
       const dateDates = new Date(`${data.month} ${i+1}, ${data.year}`);
       const dateStr = `${i+1}-${data.month.substr(0,3)}-${data.year}`;
       const dayName = dateDates.toLocaleDateString('en-US', { weekday: 'short' });
       
       csv += `${dateStr},${dayName},${dayData.net},${dayData.qty}`;
       
       data.stores.forEach(s => {
          const storeData = dayData.breakdown[s] || { net: 0, qty: 0 };
          csv += `,${storeData.net},${storeData.qty}`;
       });
       csv += "\n";
    });
    
    const filename = `Monthly_Transactions_${data.month}_${data.year}.csv`;
    const blob = Utilities.newBlob(csv, MimeType.CSV, filename);
    return { base64: Utilities.base64Encode(blob.getBytes()), filename: filename };
    
  } catch (e) { return { error: e.message }; }
}

function downloadMonthlyTransReportPDF(month, year) {
  try {
    const data = getMonthlyTransReportData(month, year);
    let html = `
    <html><head><style>
      body { font-family: sans-serif; font-size: 8px; color: #333; }
      h1 { font-size: 14px; margin-bottom: 5px; }
      h2 { font-size: 10px; color: #666; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; }
      th { text-align: center; background: #2563EB; color: white; padding: 4px; border: 1px solid #ccc; }
      td { border: 1px solid #eee; padding: 4px; text-align: right; }
      .text-left { text-align: left; }
      .text-center { text-align: center; }
      .bg-gray { background-color: #f3f4f6; }
      .font-bold { font-weight: bold; }
    </style></head><body>
      <h1>Monthly Transaction Report</h1>
      <h2>Period: ${data.month} ${data.year}</h2>
      <table>
        <thead>
          <tr>
            <th rowspan="2">Date</th>
            <th rowspan="2">Day</th>
            <th rowspan="2">Total Sales</th>
            <th rowspan="2">Total Qty</th>
    `;
    
    data.stores.forEach(s => {
       html += `<th colspan="2">${s}</th>`;
    });
    html += `</tr><tr>`;
    data.stores.forEach(() => {
       html += `<th>Sales</th><th>Qty</th>`;
    });
    html += `</tr></thead><tbody>`;
    
    data.days.forEach((dayData, i) => {
       const dateDates = new Date(`${data.month} ${i+1}, ${data.year}`);
       const dateStr = `${i+1} ${data.month.substr(0,3)}`;
       const dayName = dateDates.toLocaleDateString('en-US', { weekday: 'short' });
       
       html += `
         <tr>
           <td class="text-center bg-gray font-bold">${dateStr}</td>
           <td class="text-center bg-gray">${dayName}</td>
           <td class="font-bold">${Number(dayData.net).toLocaleString("id-ID")}</td>
           <td class="text-center font-bold">${dayData.qty}</td>
       `;
       
       data.stores.forEach(s => {
          const storeData = dayData.breakdown[s] || { net: 0, qty: 0 };
          const netClass = storeData.net > 0 ? "font-bold" : "text-gray-400";
          html += `
            <td class="${netClass}">${storeData.net > 0 ? Number(storeData.net).toLocaleString("id-ID") : "-"}</td>
            <td class="text-center">${storeData.qty > 0 ? storeData.qty : "-"}</td>
          `;
       });
       html += `</tr>`;
    });
    
    html += `</tbody></table></body></html>`;
    
    const blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF);
    blob.setName(`Monthly_Transactions_${data.month}_${data.year}.pdf`);
    return { base64: Utilities.base64Encode(blob.getBytes()), filename: blob.getName() };
    
  } catch (e) { return { error: e.message }; }
}

// --- F. Crossing Sales Report ---
function getCrossingSalesData(monthName, year, forceRefresh = false) {
  try {
    const cacheKey = `CROSSING_${monthName}_${year}`;
    const cache = CacheService.getScriptCache();
    if (forceRefresh) {
      cache.remove(cacheKey);
    } else {
      const cached = cache.get(cacheKey);
      if (cached) {
          try { return JSON.parse(cached); } catch(e) {}
      }
    }

    const ss = getSpreadsheet();
    const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
    if (!cleanSheet) return { error: "Clean data sheet not found." };
    
    // Check if clean data has headers
    if (cleanSheet.getLastRow() < 2) return { error: "Clean data is empty." };

    const data = cleanSheet.getDataRange().getValues();
    const headers = data.shift(); // Remove headers
    
    const COL = CONFIG.CLEAN_COLS;
    const monthIndex = new Date(`${monthName} 1, 2000`).getMonth();
    
    if (isNaN(monthIndex)) return { error: "Invalid month name provided." };

    const filteredData = data.filter(row => {
      const d = parseDateFix(row[COL.DATE]);
      return d.getMonth() === monthIndex && d.getFullYear() == year;
    });

    const crossingData = [];
    let totalCrossingNet = 0;
    let totalCrossingQty = 0;
    let totalHOCrossingNet = 0;
    let totalHOCrossingQty = 0;
    
    // Overall month calculation (excluding HO)
    let totalNetSalesGenerated = 0;
    let totalNetQtyGenerated = 0;

    // Track original sales vs adjusted sales per main store
    const storeStats = {
      "Plaza Indonesia": { physical: 0, adjusted: 0 },
      "Plaza Senayan": { physical: 0, adjusted: 0 },
      "Bali": { physical: 0, adjusted: 0 }
    };

    filteredData.forEach(row => {
      let transactionLoc = String(row[COL.LOCATION] || "").trim();
      let homeLoc = String(row[COL.HOME_LOCATION] || "").trim();
      
      if (!transactionLoc) transactionLoc = "Unknown";
      if (!homeLoc) homeLoc = "Unknown";

      const tLocLower = transactionLoc.toLowerCase();
      const hLocLower = homeLoc.toLowerCase();

      // Track HO crossing explicitly before whitelist drops it
      const isHO = (l) => l === "head office" || l === "ho";
      if (tLocLower !== "unknown" && hLocLower !== "unknown" && tLocLower !== hLocLower) {
        if (isHO(tLocLower) || isHO(hLocLower)) {
          totalHOCrossingNet += (Number(row[COL.NET_SALES]) || 0);
          totalHOCrossingQty += (Number(row[COL.QTY]) || 0);
        }
      }

      // Strict whitelist for valid crossing stores
      // "Tidy up all locations" - any location outside these 3 is completely ignored
      const validStores = ["plaza indonesia", "plaza senayan", "bali", "bali boutique"];
      
      const isValidT = validStores.includes(tLocLower);
      const isValidH = validStores.includes(hLocLower);

      // If either location is not a valid store (e.g. Head Office, Unknown, blank), skip entirely
      if (!isValidT || !isValidH) return;

      // Track total generated sales (for the left-most KPI card) regardless of crossing
      totalNetSalesGenerated += (Number(row[COL.NET_SALES]) || 0);
      totalNetQtyGenerated += (Number(row[COL.QTY]) || 0);

      // Normalize Bali names for storeStats matching
      if (tLocLower === "bali boutique") transactionLoc = "Bali";
      if (hLocLower === "bali boutique") homeLoc = "Bali";

      // Track physical sales for the 3 main stores
      if (storeStats[transactionLoc]) storeStats[transactionLoc].physical += (Number(row[COL.NET_SALES]) || 0);
      
      // Track adjusted sales
      if (storeStats[homeLoc]) storeStats[homeLoc].adjusted += (Number(row[COL.NET_SALES]) || 0);
      
      // Crossing Sales condition: Transaction Location != Home Location
      if (tLocLower !== hLocLower) {
        const salesman = String(row[COL.SALESMAN] || "Unknown").trim();
        const net = Number(row[COL.NET_SALES]) || 0;
        const qty = Number(row[COL.QTY]) || 0;

        // Find if this record combination already exists
        let existingRecord = crossingData.find(r => r.salesman === salesman && r.baseLoc === homeLoc && r.crossingLoc === transactionLoc);
        
        if (existingRecord) {
          existingRecord.net += net;
          existingRecord.qty += qty;
        } else {
          crossingData.push({
            salesman: salesman,
            baseLoc: homeLoc,
            crossingLoc: transactionLoc,
            net: net,
            qty: qty
          });
        }
        totalCrossingNet += net;
        totalCrossingQty += qty;
      }
    });

    // Sort by net sales descending
    crossingData.sort((a, b) => b.net - a.net);

    const result = {
      records: crossingData,
      totalNet: totalCrossingNet,
      totalQty: totalCrossingQty,
      totalNetSalesGenerated: totalNetSalesGenerated, // Export total generated for KPI
      totalNetQtyGenerated: totalNetQtyGenerated,
      hoCrossingNet: totalHOCrossingNet, // Added explicit export for HO crossing
      hoCrossingQty: totalHOCrossingQty,
      storeStats: storeStats, // PI, PS, Bali adjustments
      month: monthName,
      year: year
    };
    
    // Convert to JSON and truncate if it exceeds 100KB cache limit
    const jsonResult = JSON.stringify(result);
    if (jsonResult.length < 100000) {
      cache.put(cacheKey, jsonResult, 300);
    }
    return result;
  } catch (e) {
    return { error: e.message || "Unknown error occurred in getCrossingSalesData" };
  }
}

function downloadCrossingSalesReportExcel(month, year) {
  try {
    const data = getCrossingSalesData(month, year);
    if(data.error) return { error: data.error };

    let csv = "Salesman,Base Location,Crossing Location,Crossing Net Sales,Crossing Qty\n";
    
    data.records.forEach((rec) => {
       const salesman = `"${rec.salesman.replace(/"/g, '""')}"`;
       const base = `"${rec.baseLoc.replace(/"/g, '""')}"`;
       const target = `"${rec.crossingLoc.replace(/"/g, '""')}"`;
       csv += `${salesman},${base},${target},${rec.net},${rec.qty}\n`;
    });
    
    const filename = `Crossing_Sales_${month}_${year}.csv`;
    const blob = Utilities.newBlob(csv, MimeType.CSV, filename);
    return { base64: Utilities.base64Encode(blob.getBytes()), filename: filename };
    
  } catch (e) { return { error: e.message }; }
}

function downloadCrossingSalesReportPDF(month, year) {
  try {
    const data = getCrossingSalesData(month, year);
    if(data.error) return { error: data.error };

    let html = `
    <html><head><style>
      body { font-family: sans-serif; font-size: 10px; color: #333; }
      h1 { font-size: 18px; margin-bottom: 5px; }
      h2 { font-size: 12px; color: #666; margin-bottom: 5px; }
      .summary { margin-bottom: 20px; font-weight: bold; font-size: 11px; color:#1e40af; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { text-align: left; background: #2563EB; color: white; padding: 6px; font-size: 10px; }
      td { border-bottom: 1px solid #eee; padding: 6px; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      tr:nth-child(even) { background-color: #f9f9f9; }
    </style></head><body>
      <h1>Crossing Sales & Mobility Report</h1>
      <h2>Period: ${month} ${year}</h2>
      <div class="summary">Total Crossing Net Sales: Rp ${Number(data.totalNet).toLocaleString("id-ID")} | Total Qty: ${data.totalQty} pcs</div>
      <table>
        <thead>
          <tr>
            <th width="20%">Salesman</th>
            <th width="25%">Base Location</th>
            <th width="25%">Crossing Location (Destination)</th>
            <th width="15%" class="text-right">Net Sales</th>
            <th width="15%" class="text-center">Qty Pcs</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    data.records.forEach((rec) => {
      html += `
        <tr>
          <td style="font-weight:bold;">${rec.salesman}</td>
          <td>${rec.baseLoc}</td>
          <td style="color:#d97706; font-weight:bold;">${rec.crossingLoc}</td>
          <td class="text-right">${Number(rec.net).toLocaleString("id-ID")}</td>
          <td class="text-center">${rec.qty}</td>
        </tr>
      `;
    });
    
    html += `</tbody></table></body></html>`;
    
    const blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF);
    blob.setName(`Crossing_Sales_${month}_${year}.pdf`);
    return { base64: Utilities.base64Encode(blob.getBytes()), filename: blob.getName() };
    
  } catch (e) { return { error: e.message }; }
}

