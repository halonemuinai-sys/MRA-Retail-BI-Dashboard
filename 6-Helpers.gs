/**
 * File: 6-Helpers.gs
 * Description: Fungsi Helper untuk ETL dan Kalkulasi.
 * STATUS: UPDATED (Sesuai Refactored Version)
 */

function aggregateOverview(rows, COL, ss, monthName, year) {
  let totalNet = 0, totalGross = 0, totalCost = 0, totalValDisc = 0, totalQty = 0;
  let storeStats = {}, catStats = {};

  rows.forEach(row => {
    const net = Number(row[COL.NET_SALES]) || 0;
    const gross = Number(row[COL.GROSS]) || 0;
    const cost = Number(row[COL.SELLING_COST]) || 0;
    const disc = Number(row[COL.VAL_DISC]) || 0;
    const qty = Number(row[COL.QTY]) || 0;
    const loc = row[COL.LOCATION];
    const cat = row[COL.MAIN_CAT];

    totalNet += net;
    totalGross += gross;
    totalCost += cost;
    totalValDisc += disc;
    totalQty += qty;

    if (!storeStats[loc]) storeStats[loc] = { net: 0, cost: 0, qty: 0 };
    storeStats[loc].net += net;
    storeStats[loc].cost += cost;
    storeStats[loc].qty += qty;

    if (!catStats[cat]) catStats[cat] = { qty: 0, net: 0 };
    catStats[cat].net += net;
    catStats[cat].qty += qty;
  });

  let totalTarget = 0;
  let targetMap = getTargetMap(ss, monthName, year);

  const storePerformance = [];
  const allStores = new Set([...Object.keys(storeStats), ...Object.keys(targetMap)]);

  allStores.forEach(store => {
    const actual = storeStats[store] ? storeStats[store].net : 0;
    const cost = storeStats[store] ? storeStats[store].cost : 0;
    const qty = storeStats[store] ? storeStats[store].qty : 0;
    const target = targetMap[store] || 0;
    totalTarget += target;
    storePerformance.push({
      store: store, actual: actual, cost: cost, target: target, qty: qty,
      achievement: target > 0 ? (actual / target) * 100 : 0
    });
  });

  return {
    kpi: {
      totalNet: totalNet, totalTarget: totalTarget, totalQty: totalQty,
      achievement: totalTarget > 0 ? (totalNet / totalTarget) * 100 : 0,
      costPercentage: totalGross > 0 ? (totalCost / totalGross) * 100 : 0,
      avgDiscountPercentage: totalGross > 0 ? (totalValDisc / totalGross) * 100 : 0
    },
    storeData: storePerformance, catData: catStats, rawStoreStats: storeStats, rawTargetMap: targetMap
  };
}

function getAnnualTarget(ss, year) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MASTER_TARGET_STORE);
  if (!sheet) return 0;
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return 0;
  const headers = data[0];
  let totalAnnualTarget = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]) == year) {
      for (let j = 2; j < row.length; j++) {
        if (String(headers[j]).toLowerCase() !== "head office") {
          totalAnnualTarget += (Number(row[j]) || 0);
        }
      }
    }
  }
  return totalAnnualTarget;
}

function getTargetMap(ss, monthName, year) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MASTER_TARGET_STORE);
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const targetMap = {};

  const row = data.find(r => {
    const rYear = String(r[0]);
    const rMonth = String(r[1]).trim().toLowerCase();
    const qMonth = monthName.toLowerCase();
    return rYear == year && (rMonth === qMonth || qMonth.startsWith(rMonth));
  });

  if (row) {
    for (let i = 2; i < headers.length; i++) {
      targetMap[headers[i]] = Number(row[i]) || 0;
    }
  }
  return targetMap;
}

function getBudgetMap(ss, monthName, year) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MASTER_BUDGET);
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const targetMap = {};

  const row = data.find(r => {
    const rYear = String(r[0]);
    const rMonth = String(r[1]).trim().toLowerCase();
    const qMonth = monthName.toLowerCase();
    return rYear == year && (rMonth === qMonth || qMonth.startsWith(rMonth));
  });

  if (row) {
    for (let i = 2; i < headers.length; i++) {
      targetMap[headers[i]] = Number(row[i]) || 0;
    }
  }
  return targetMap;
}

function calculateAdvisorPerformance(rows, COL, ss, monthName, year, globalTarget, storeStats, targetMap) {
  const advisorStatsMap = new Map();

  rows.forEach(row => {
    const advisorName = String(row[COL.SALESMAN]).trim();
    if (!advisorName) return;
    const key = advisorName.toLowerCase();
    const cat = String(row[COL.MAIN_CAT] || "Other").trim();
    const transLoc = String(row[COL.LOCATION]).trim();
    const net = (Number(row[COL.NET_SALES]) || 0);
    const qty = (Number(row[COL.QTY]) || 0);
    const transDate = parseDateFix(row[COL.DATE]);
    const transMonth = transDate.getMonth(); // 0-11

    if (!advisorStatsMap.has(key)) {
      advisorStatsMap.set(key, { 
          name: advisorName, 
          net: 0, 
          loc: transLoc, 
          target: 0, 
          categories: {}, 
          storeBreakdown: {}, 
          transactions: new Set(),
          productiveMonths: new Set() 
      });
    }
    const entry = advisorStatsMap.get(key);
    entry.net += net;
    entry.transactions.add(row[COL.TRANS_NO]); // Track Unique Trans No
    
    if (!isNaN(transMonth)) {
        entry.productiveMonths.add(transMonth);
    }

    if (!entry.categories[cat]) entry.categories[cat] = { net: 0, qty: 0 };
    entry.categories[cat].net += net;
    entry.categories[cat].qty += qty;

    if (!entry.storeBreakdown[transLoc]) entry.storeBreakdown[transLoc] = 0;
    entry.storeBreakdown[transLoc] += net;
  });

  const advSheet = ss.getSheetByName(CONFIG.SHEETS.MASTER_ADVISOR);
  if (advSheet) {
    const advData = advSheet.getDataRange().getValues();
    if (advData.length > 0) {
      const headers = advData[0];
      const monthColIndex = headers.findIndex(h => {
        const hStr = String(h).trim().toLowerCase();
        const mStr = monthName.toLowerCase();
        return hStr === mStr || mStr.startsWith(hStr);
      });

      if (monthColIndex > -1) {
        for (let i = 1; i < advData.length; i++) {
          const r = advData[i];
          if (String(r[0]) != year) continue;
          const sheetName = String(r[1]).trim();
          const targetVal = Number(r[monthColIndex]) || 0;
          const masterLoc = String(r[3]).trim(); // Column D is Location

          if (targetVal === 0 && !advisorStatsMap.has(sheetName.toLowerCase())) continue;

          let foundKey = null;
          for (const [key] of advisorStatsMap.entries()) {
            if (key === sheetName.toLowerCase() || key.includes(sheetName.toLowerCase())) {
              foundKey = key; break;
            }
          }

          if (foundKey) {
            const entry = advisorStatsMap.get(foundKey);
            entry.target = targetVal;
            if (masterLoc) entry.loc = masterLoc; // Force override with Master Location
          } else {
            advisorStatsMap.set(sheetName.toLowerCase(), { 
                name: sheetName, 
                net: 0, 
                loc: masterLoc || "Unknown", 
                target: targetVal, 
                categories: {}, 
                storeBreakdown: {},
                transactions: new Set(),
                productiveMonths: new Set()
            });
          }
        }
      }
    }
  }

  const results = [];
  for (const stats of advisorStatsMap.values()) {
    if (stats.net === 0 && stats.target === 0) continue;
    const contrib = globalTarget > 0 ? (stats.net / globalTarget) * 100 : 0;
    const achv = stats.target > 0 ? (stats.net / stats.target) * 100 : 0;
    const storeTotal = storeStats[stats.loc] ? storeStats[stats.loc].net : 0;
    const storeTarget = targetMap[stats.loc] || 0;
    const storeAchv = storeTarget > 0 ? (storeTotal / storeTarget) * 100 : 0;
    const storeContribPct = storeTotal > 0 ? (stats.net / storeTotal) * 100 : 0;
    const storeStatus = storeAchv >= 100 ? "Achieved" : (storeAchv >= 85 ? "On Track" : "Risk");

    const catMix = Object.entries(stats.categories).map(([k, v]) => ({ category: k, amount: v.net, qty: v.qty, pct: stats.net > 0 ? (v.net / stats.net) * 100 : 0 })).sort((a, b) => b.amount - a.amount);
    const storeMix = Object.entries(stats.storeBreakdown).map(([k, v]) => ({ store: k, amount: v, pct: stats.net > 0 ? (v / stats.net) * 100 : 0 })).sort((a, b) => b.amount - a.amount);

    results.push({
      name: stats.name, location: stats.loc, netSales: stats.net, target: stats.target,
      achievement: achv, contribution: contrib, transCount: stats.transactions ? stats.transactions.size : 0,
      productiveMonths: stats.productiveMonths ? stats.productiveMonths.size : 0,
      storeData: { totalSales: storeTotal, target: storeTarget, achievement: storeAchv, status: storeStatus, advisorContrib: storeContribPct },
      categoryMix: catMix, storeMix: storeMix, insight: "Data processed."
    });
  }
  return results.sort((a, b) => b.achievement - a.achievement);
}

function calculateStoreDaily(storeFilter, dateStr, allData, ss, stockData) {
  const COL = { DATE: 1, LOCATION: 4, MAIN_CAT: 6, GROSS: 8, VAL_DISC: 10, SELLING_COST: 13, NET_SALES: 14, TYPE: 15, QTY: 16 };
  const parts = dateStr.split('-');
  const selectedYear = parseInt(parts[0]);
  const selectedMonth = parseInt(parts[1]) - 1;
  const selectedDay = parseInt(parts[2]);

  let mtdRows = [], todayRows = [];
  allData.forEach(row => {
    if (String(row[COL.LOCATION]).trim().toLowerCase() !== String(storeFilter).trim().toLowerCase()) return;
    const d = parseDateFix(row[COL.DATE]);
    if (isNaN(d.getTime())) return;
    if (d.getMonth() === selectedMonth && d.getFullYear() === selectedYear) {
      if (d.getDate() <= selectedDay) mtdRows.push(row);
      if (d.getDate() === selectedDay) todayRows.push(row);
    }
  });

  const stockMap = {};
  if (stockData.length > 0) {
    const monthColIndex = selectedMonth + 3;
    stockData.forEach((row, i) => {
      if (i === 0 || String(row[0]) != selectedYear) return;
      if (String(row[1]).trim().toLowerCase() === String(storeFilter).trim().toLowerCase()) {
        stockMap[String(row[2]).trim()] = Number(row[monthColIndex]) || 0;
      }
    });
  }

  const catBreakdown = {};
  ["Jewelry", "Watches", "Accessories", "Perfume"].forEach(c => {
    catBreakdown[c] = { qty: 0, netNonSMI: 0, netSMI: 0, stock: stockMap[c] || 0 };
  });

  // Calculate Remaining Stock
  mtdRows.forEach(row => {
    let cat = row[COL.MAIN_CAT] || "Other";
    if (cat === "JWL") cat = "Jewelry";
    if (cat === "WTH") cat = "Watches";
    if (cat === "ACCS") cat = "Accessories";
    if (cat === "PFM") cat = "Perfume";
    if (catBreakdown[cat]) {
      catBreakdown[cat].stock = Math.max(0, catBreakdown[cat].stock - (Number(row[COL.QTY]) || 0));
    }
  });

  // Calculate Today's Sales
  todayRows.forEach(row => {
    let cat = row[COL.MAIN_CAT] || "Other";
    if (cat === "JWL") cat = "Jewelry";
    if (cat === "WTH") cat = "Watches";
    if (cat === "ACCS") cat = "Accessories";
    if (cat === "PFM") cat = "Perfume";
    if (catBreakdown[cat]) {
      catBreakdown[cat].qty += (Number(row[COL.QTY]) || 0);
      if (String(row[COL.TYPE]).trim().toUpperCase() === "SMI") catBreakdown[cat].netSMI += (Number(row[COL.NET_SALES]) || 0);
      else catBreakdown[cat].netNonSMI += (Number(row[COL.NET_SALES]) || 0);
    }
  });

  let mtdSales = 0, mtdGross = 0, mtdCost = 0, mtdDisc = 0, mtdRegQty = 0, mtdSmiQty = 0;
  mtdRows.forEach(r => {
    mtdSales += (Number(r[COL.NET_SALES]) || 0);
    mtdGross += (Number(r[COL.GROSS]) || 0);
    mtdCost += (Number(r[COL.SELLING_COST]) || 0);
    mtdDisc += (Number(r[COL.VAL_DISC]) || 0);
    const qty = Number(r[COL.QTY]) || 0;
    if (String(r[COL.TYPE]).toUpperCase() === "SMI") mtdSmiQty += qty; else mtdRegQty += qty;
  });

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const targetMap = getTargetMap(ss, monthNames[selectedMonth], selectedYear);
  const targetVal = targetMap[storeFilter] || 0;

  let todaySales = 0, todayGross = 0, todayCost = 0, todayReg = 0, todaySMI = 0;
  todayRows.forEach(r => {
    todaySales += (Number(r[COL.NET_SALES]) || 0);
    todayGross += (Number(r[COL.GROSS]) || 0);
    todayCost += (Number(r[COL.SELLING_COST]) || 0);
    if (String(r[COL.TYPE]).toUpperCase() === "SMI") todaySMI += (Number(r[COL.NET_SALES]) || 0);
    else todayReg += (Number(r[COL.NET_SALES]) || 0);
  });

  return {
    storeName: storeFilter,
    tableData: catBreakdown,
    metrics: {
      mtdSales, target: targetVal, achievement: targetVal > 0 ? (mtdSales / targetVal) * 100 : 0,
      mtdRegQty, mtdSmiQty, mtdTotalQty: mtdRegQty + mtdSmiQty,
      sellingCostTodayVal: todayCost, sellingCostTodayPct: todayGross > 0 ? (todayCost / todayGross) * 100 : 0,
      regSalesTodayVal: todayReg, regSalesTodayPct: todaySales > 0 ? (todayReg / todaySales) * 100 : 0,
      smiSalesTodayVal: todaySMI, smiSalesTodayPct: todaySales > 0 ? (todaySMI / todaySales) * 100 : 0,
      sellingCostMtdPct: mtdGross > 0 ? (mtdCost / mtdGross) * 100 : 0, avgDiscMtdPct: mtdGross > 0 ? (mtdDisc / mtdGross) * 100 : 0
    }
  };
}

function loadMasters(ss) {
  const getMap = (name) => {
    const s = ss.getSheetByName(name);
    const m = new Map();
    if (s && s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 2).getValues().forEach(r => m.set(String(r[0]).trim(), r[1]));
    return m;
  };

  const getAdvisors = () => {
    const s = ss.getSheetByName(CONFIG.SHEETS.MASTER_ADVISOR);
    const result = {};
    if (s && s.getLastRow() > 1) {
      const data = s.getDataRange().getValues();
      const headers = data[0];
      const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
      
      const monthIndices = {};
      headers.forEach((h, i) => {
        const hStr = String(h).trim().toLowerCase();
        monthNames.forEach(m => {
          if (m === hStr || hStr.startsWith(m)) {
            // Opsi A: Location column is directly on the right of the target column
            monthIndices[m] = i + 1;
          }
        });
      });

      for (let r = 1; r < data.length; r++) {
         const row = data[r];
         const year = String(row[0]).trim();
         const name = String(row[1]).trim().toLowerCase();
         // Default home location in Column D (index 3)
         const defaultLocation = String(row[3]).trim();
         
         if(!result[year]) result[year] = {};
         if(!result[year][name]) result[year][name] = { default: defaultLocation, months: {} };
         
         monthNames.forEach(m => {
            const locIdx = monthIndices[m];
            if(locIdx && row[locIdx]) {
              result[year][name].months[m] = String(row[locIdx]).trim();
            }
         });
      }
    }
    return result;
  };

  return { categories: getMap(CONFIG.SHEETS.MASTER_CAT), collections: getMap(CONFIG.SHEETS.MASTER_COLL), advisors: getAdvisors() };
}

function buildCleanMaster(ss, masters) {
  const rawSheet = ss.getSheetByName(CONFIG.SHEETS.RAW);
  if (!rawSheet) throw new Error("Sheet 'raw_system' tidak ditemukan");
  const lastRow = rawSheet.getLastRow();
  if (lastRow < 2) return;

  let targetSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
  if (!targetSheet) {
    targetSheet = ss.insertSheet(CONFIG.SHEETS.CLEAN);
    targetSheet.appendRow(["Trans No", "Date", "Customer", "Salesman", "Location", "SAP Code", "Main Category", "Collection", "Gross Sales", "Disc %", "Val Disc", "Net Price", "Comm", "Cost", "Net Sales", "Type", "Qty", "Catalogue Code", "Home Location"]);
  }

  let startRowRaw = 2; // Default full sync
  let isIncremental = false;

  const cleanLastRow = targetSheet.getLastRow();
  if (cleanLastRow > 1) {
    // Incremental Logic: Find the very last Trans No synced
    const lastCleanTransNo = targetSheet.getRange(cleanLastRow, 1).getValue();
    
    // Scan raw_system from bottom to top to locate this Trans No
    // Optimization: only fetching the Trans No column
    const rawTransNos = rawSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    
    let foundIdx = -1;
    for (let i = rawTransNos.length - 1; i >= 0; i--) {
       if (String(rawTransNos[i][0]).trim() === String(lastCleanTransNo).trim()) {
          foundIdx = i;
          break;
       }
    }
    
    if (foundIdx !== -1) {
       // Offset: +2 for getRange array 0-index offset, +1 to start on the NEXT row
       startRowRaw = foundIdx + 3; 
       isIncremental = true;
    } else {
       // Transaction not found in raw_system. Maybe 'raw_system' was replaced/overwritten.
       // Fallback to Full Sync: clear everything
       targetSheet.getRange(2, 1, cleanLastRow - 1, targetSheet.getLastColumn()).clearContent();
    }
  }

  // Update script properties timestamp immediately before calculating num rows
  // So even if there are 0 new rows we register a sync attempt
  const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd MMM yyyy, HH:mm");
  PropertiesService.getScriptProperties().setProperty('LAST_SYNC', nowStr);

  if (startRowRaw > lastRow) {
      // No new rows to append
      return; 
  }

  const numRowsToProcess = lastRow - startRowRaw + 1;
  const rawData = rawSheet.getRange(startRowRaw, 1, numRowsToProcess, rawSheet.getLastColumn()).getValues();

  const cleanData = rawData.map(row => {
    const price = Number(row[CONFIG.RAW_COLS.TOTAL_PRICE]) || 0;
    const disc = Number(row[CONFIG.RAW_COLS.DISC_PCT]) || 0;
    const comm = Number(row[CONFIG.RAW_COLS.CARD_COMM]) || 0;
    const valDisc = price * disc;
    const codes = String(row[CONFIG.RAW_COLS.COLL_CODE] || "").split(',').map(s => s.trim());
    const mainCat = masters.categories.get(codes[0]) || "Other";
    const coll = masters.collections.get(codes[codes.length - 1]) || "Unknown";
    
    // Robust Net Sales Logic
    let netSales = Number(row[CONFIG.RAW_COLS.NET_SALES]);
    if (!netSales || netSales === 0) {
       netSales = Number(row[CONFIG.RAW_COLS.NET_PRICE]) || (price - valDisc);
    }
    
    // Dynamic Home Location Logic
    const transDate = parseDateFix(row[CONFIG.RAW_COLS.TRANS_DATE]);
    const tYear = String(transDate.getFullYear());
    const mNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    let tMonthName = "unknown";
    if (!isNaN(transDate.getMonth())) {
        tMonthName = mNames[transDate.getMonth()];
    }
    const salesmanKey = String(row[CONFIG.RAW_COLS.SALESMAN] || "").trim().toLowerCase();

    let homeLoc = String(row[CONFIG.RAW_COLS.LOCATION]).trim(); // default fallback to same location
    if (masters.advisors[tYear] && masters.advisors[tYear][salesmanKey]) {
       const advInfo = masters.advisors[tYear][salesmanKey];
       homeLoc = advInfo.months[tMonthName] || advInfo.default || "Unknown";
    }

    return [
      row[0], row[1], row[2], row[3], row[4], row[5],
      mainCat, coll, price, disc, valDisc, Number(row[CONFIG.RAW_COLS.NET_PRICE]),
      comm, (valDisc + comm), netSales,
      row[CONFIG.RAW_COLS.TYPE_ITEM] || "Regular", row[CONFIG.RAW_COLS.QTY],
      String(row[CONFIG.RAW_COLS.CATALOGUE_CODE] || "").trim(),
      homeLoc
    ];
  });

  if (cleanData.length > 0) {
      const pasteRow = isIncremental ? targetSheet.getLastRow() + 1 : 2;
      targetSheet.getRange(pasteRow, 1, cleanData.length, cleanData[0].length).setValues(cleanData);
  }
}

/**
 * Helper to parse various date formats safely
 */
function parseDateFix(dateVal) {
  if (Object.prototype.toString.call(dateVal) === '[object Date]') return dateVal;
  if (!dateVal) return new Date(0);
  
  const strVal = String(dateVal).trim();
  
  // Try split by hyphen or slash (e.g. 2024-01-01 or 01/01/2024)
  // Ensure that "01" is treated as base 10 by parseInt
  const parts = strVal.split(/[-\/]/);
  
  if (parts.length === 3) {
    // format YYYY-MM-DD
    if (parts[0].length === 4) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    // format DD/MM/YYYY or MM/DD/YYYY depending on user locale,
    // Google Sheets usually exports DD/MM/YYYY to string, so assuming parts[0] is Day.
    if (parts[2].length === 4) {
       return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
  }
  
  // Fallback
  return new Date(dateVal);
}