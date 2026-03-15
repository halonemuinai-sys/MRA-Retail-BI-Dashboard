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
    const homeLoc = String(row[COL.HOME_LOCATION] || "").trim(); // Get Home Location
    const net = (Number(row[COL.NET_SALES]) || 0);
    const qty = (Number(row[COL.QTY]) || 0);
    const transDate = parseDateFix(row[COL.DATE]);
    const transMonth = transDate.getMonth(); // 0-11

    const isHO = (l) => l.toLowerCase() === "head office" || l.toLowerCase() === "ho";
    
    // EXCLUDE HO SALES ENTIRELY FROM ADVISOR PERFORMANCE
    if (isHO(transLoc)) return;

    // Detect Crossing Sale
    const validStores = ["plaza indonesia", "plaza senayan", "bali", "bali boutique"];
    let crossingNet = 0;
    let crossingQty = 0;
    if (transLoc && homeLoc && transLoc.toLowerCase() !== homeLoc.toLowerCase() && !isHO(transLoc) && !isHO(homeLoc)) {
         if (validStores.includes(transLoc.toLowerCase()) && validStores.includes(homeLoc.toLowerCase())) {
             crossingNet = net;
             crossingQty = qty;
         }
    }

    if (!advisorStatsMap.has(key)) {
      advisorStatsMap.set(key, { 
          name: advisorName, 
          net: 0, 
          loc: transLoc, 
          target: 0, 
          categories: {}, 
          storeBreakdown: {}, 
          transactions: new Set(),
          productiveMonths: new Set(),
          crossingNet: 0,
          crossingQty: 0
      });
    }
    const entry = advisorStatsMap.get(key);
    entry.net += net;
    entry.crossingNet += crossingNet;
    entry.crossingQty += crossingQty;
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
                productiveMonths: new Set(),
                crossingNet: 0,
                crossingQty: 0
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
      crossingNet: stats.crossingNet || 0, crossingQty: stats.crossingQty || 0,
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
    targetSheet.appendRow(["Trans No", "Date", "Customer", "Salesman", "Location", "SAP Code", "Main Category", "Collection", "Gross Sales", "Disc %", "Val Disc", "Net Price", "Comm", "Cost", "Net Sales", "Type", "Qty", "Catalogue Code", "Home Location", "Phone"]);
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

    let phoneStr = String(row[CONFIG.RAW_COLS.PHONE] || "").trim();
    let cleanPhone = phoneStr.replace(/\D/g, ''); // Remove non-numeric chars
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.substring(1);
    } else if (cleanPhone.length > 8 && !cleanPhone.startsWith('62')) {
        cleanPhone = '62' + cleanPhone; // Fallback if no 0 or 62 provided (e.g. 812...)
    }
    const phone = cleanPhone;

    return [
      row[0], row[1], row[2], row[3], row[4], row[5],
      mainCat, coll, price, disc, valDisc, Number(row[CONFIG.RAW_COLS.NET_PRICE]),
      comm, (valDisc + comm), netSales,
      row[CONFIG.RAW_COLS.TYPE_ITEM] || "Regular", row[CONFIG.RAW_COLS.QTY],
      String(row[CONFIG.RAW_COLS.CATALOGUE_CODE] || "").trim(),
      homeLoc, phone
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

/**
 * Calculates the Levenshtein distance between two strings
 * Used for Fuzzy Name Matching (Fallback)
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates similarity percentage between two strings
 */
function similarityPercentage(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const dist = levenshteinDistance(a, b);
  return ((maxLen - dist) / maxLen) * 100;
}

/**
 * Connects to external Profiling Sheet and builds Memory Hashes
 * 1. phoneMap: exact matching for 8-digit suffix
 * 2. nameMap: exact name matching
 * 3. nameList: array for fuzzy matching fallback
 */
function loadCustomerProfiles() {
  const phoneMap = new Map();
  const nameMap = new Map();
  const nameList = [];

  try {
    const extSS = SpreadsheetApp.openById(CONFIG.EXTERNAL.PROFILING_SHEET_ID);
    const profileSheet = extSS.getSheetByName(CONFIG.EXTERNAL.PROFILING_SHEET_NAME);
    
    if (!profileSheet) {
       console.warn("Sheet " + CONFIG.EXTERNAL.PROFILING_SHEET_NAME + " not found.");
       return { phoneMap, nameMap, nameList, error: "Sheet not found" };
    }

    const lastRow = profileSheet.getLastRow();
    if (lastRow < 2) return { phoneMap, nameMap, nameList };

    // Load entire ~8k data set into memory
    const data = profileSheet.getRange(2, 1, lastRow - 1, profileSheet.getLastColumn()).getValues();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      const rawName = String(row[CONFIG.EXTERNAL.COLS.NAME] || "").trim();
      const rawPhone = String(row[CONFIG.EXTERNAL.COLS.PHONE] || "").trim();
      
      if (!rawName) continue; // Skip empty rows

      // Build specific profile object mapping
      const profileInfo = {
        name: rawName,
        store: String(row[CONFIG.EXTERNAL.COLS.STORE] || "").trim(),
        status: String(row[CONFIG.EXTERNAL.COLS.STATUS] || "").trim(),
        age: String(row[CONFIG.EXTERNAL.COLS.AGE] || "").trim(),
        job: String(row[CONFIG.EXTERNAL.COLS.JOB] || "").trim(),
        style: String(row[CONFIG.EXTERNAL.COLS.STYLE] || "").trim()
      };

      // 1. Phone Mapping (8-digit Suffix)
      if (rawPhone) {
        let cleanPhone = rawPhone.replace(/\D/g, ''); // Extract digits only
        if (cleanPhone.length >= 8) {
           const suffix = cleanPhone.slice(-8); // extract last 8 digits
           phoneMap.set(suffix, profileInfo);
        }
      }

      // 2. Exact Name Mapping (case-insensitive)
      const nameKey = rawName.toLowerCase();
      if (!nameMap.has(nameKey)) {
          nameMap.set(nameKey, profileInfo);
      }

      // 3. Name List for Fuzzy Matching
      nameList.push({ key: nameKey, profile: profileInfo });
    }

    return { phoneMap, nameMap, nameList, success: true };

  } catch (error) {
    console.error("Error loading profiles: " + error.message);
    return { phoneMap, nameMap, nameList, error: error.message };
  }
}

/**
 * DEBUG FEATURE: 
 * Runs the matching algorithm against the entire clean_master sheet
 * and dumps the result into a new sheet "Joined_Customer_Debug"
 * so the user can visually verify the algorithm's effectiveness.
 */
function exportJoinedCustomerData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
  if (!cleanSheet) throw new Error("Sheet clean_master tidak ditemukan.");

  let debugSheet = ss.getSheetByName("Joined_Customer_Debug");
  if (!debugSheet) {
    debugSheet = ss.insertSheet("Joined_Customer_Debug");
  }
  debugSheet.clear();

  const headers = [
    "Trans No", "Date", "System Name (SAP)", "Clean Name", "Salesman", "System Phone", 
    "Matched Name (Profile)", "Match Confidence / Reason", 
    "Profiling Store", "Profiling Job", "Profiling Age", "Net Sales",
    "Traffic Status (CRM)"
  ];
  debugSheet.appendRow(headers);

  // Load Profiling Memory Hash
  const profilesMap = loadCustomerProfiles();
  if (!profilesMap.success) throw new Error("Gagal meload Profil Pelanggan: " + profilesMap.error);

  // Load Traffic Data for CRM Status matching (Name -> { prospectLevel, status, date })
  const trafficNameMap = new Map();
  try {
    const extSS = SpreadsheetApp.openById(CONFIG.EXTERNAL.PROFILING_SHEET_ID);
    const trafficSheet = extSS.getSheetByName(CONFIG.EXTERNAL.TRAFFIC_SHEET_NAME);
    if (trafficSheet && trafficSheet.getLastRow() > 1) {
      const tData = trafficSheet.getRange(2, 1, trafficSheet.getLastRow() - 1, trafficSheet.getLastColumn()).getValues();
      const TCOL = CONFIG.EXTERNAL.TRAFFIC_COLS;
      tData.forEach(tRow => {
        const tName = String(tRow[TCOL.NAME] || "").trim().toLowerCase();
        if (!tName) return;
        const prospect = String(tRow[TCOL.PROSPECT] || "").trim();
        const tStatus = String(tRow[TCOL.STATUS] || "").trim();
        // Keep the latest / most relevant entry (Penjualan Berhasil takes priority)
        if (!trafficNameMap.has(tName) || prospect.toLowerCase().includes('berhasil')) {
          trafficNameMap.set(tName, { prospect: prospect, status: tStatus });
        }
      });
    }
  } catch(e) {
    console.error("Failed to load Traffic for CRM matching: " + e.message);
  }

  const cleanData = cleanSheet.getDataRange().getValues();
  cleanData.shift(); // Remove headers

  const exportData = [];
  const processedTrans = new Set(); // Prevent duplicates by transaction

  cleanData.forEach(row => {
      const transNo = String(row[CONFIG.CLEAN_COLS.TRANS_NO] || "");
      if (processedTrans.has(transNo)) return;
      processedTrans.add(transNo);

      const custName = String(row[CONFIG.CLEAN_COLS.CUSTOMER] || "").trim();
      if (!custName || custName.toLowerCase() === "customer") return; // Skip walk-ins

      const salesman = String(row[CONFIG.CLEAN_COLS.SALESMAN] || "").trim();
      
      // Clean Name: remove titles (Mr, Mrs, Ms, Miss, Mdm, Madam, Ibu, Bpk, Bapak, Ny, Tn, Dr, Prof, H, Hj)
      // and punctuation (., ,, !, etc)
      const cleanName = custName
        .replace(/\b(mr|mrs|ms|miss|mdm|madam|ibu|bpk|bapak|ny|tn|dr|prof|sir|lady|h|hj)\b[.\s]*/gi, '')
        .replace(/[^a-zA-Z\s'-]/g, '')  // Keep letters, spaces, hyphens, apostrophes
        .replace(/\s{2,}/g, ' ')        // Collapse multiple spaces
        .trim();

      const phoneStr = String(row[CONFIG.CLEAN_COLS.PHONE] || "").trim();
      const net = Number(row[CONFIG.CLEAN_COLS.NET_SALES]) || 0;
      
      let dateStr = "";
      if (row[CONFIG.CLEAN_COLS.DATE]) {
          try {
            dateStr = Utilities.formatDate(new Date(row[CONFIG.CLEAN_COLS.DATE]), Session.getScriptTimeZone(), "yyyy-MM-dd");
          } catch(e) { dateStr = row[CONFIG.CLEAN_COLS.DATE]; }
      }

      let matchedProfile = null;
      let matchType = '1. None (Gagal)';

      // LOGIC 1: Phone Match
      if (phoneStr && phoneStr.length >= 8) {
          const suffix = phoneStr.slice(-8);
          if (profilesMap.phoneMap.has(suffix)) {
              matchedProfile = profilesMap.phoneMap.get(suffix);
              matchType = '✅ Phone Match (Akurat)';
          }
      }

      // LOGIC 2: Exact Name Match
      if (!matchedProfile) {
          const lowerName = custName.toLowerCase();
          if (profilesMap.nameMap.has(lowerName)) {
              matchedProfile = profilesMap.nameMap.get(lowerName);
              matchType = '✅ Exact Name Match';
          }
      }

      // LOGIC 3: Fuzzy Name Match
      if (!matchedProfile && profilesMap.nameList && profilesMap.nameList.length > 0) {
          const lowerName = custName.toLowerCase();
          let bestMatch = null;
          let highestScore = 0;

          for (let i = 0; i < profilesMap.nameList.length; i++) {
             const candidate = profilesMap.nameList[i];
             const score = similarityPercentage(lowerName, candidate.key);
             if (score > highestScore) {
                highestScore = score;
                bestMatch = candidate.profile;
             }
          }

          if (highestScore >= 85) {
             matchedProfile = bestMatch;
             matchType = `⚠️ Fuzzy Name (${Math.round(highestScore)}%)`;
          } else if (highestScore > 0) {
             matchType = `❌ Top Fuzzy Match Only ${Math.round(highestScore)}% (Gagal)`;
          }
      }

      // Look up Traffic CRM Status by customer name
      const trafficEntry = trafficNameMap.get(custName.toLowerCase());
      const trafficStatus = trafficEntry ? trafficEntry.prospect : "-";

      exportData.push([
          transNo, dateStr, custName, cleanName, salesman, `'${phoneStr}`,
          matchedProfile ? matchedProfile.name : "-",
          matchType,
          matchedProfile ? matchedProfile.store : "-",
          matchedProfile ? matchedProfile.job : "-",
          matchedProfile ? matchedProfile.age : "-",
          net,
          trafficStatus
      ]);
  });

  if (exportData.length > 0) {
     debugSheet.getRange(2, 1, exportData.length, headers.length).setValues(exportData);
     // Auto-resize columns for readability
     debugSheet.autoResizeColumns(1, headers.length);
  }

  // Load Traffic Data for Prospects Aggregation
  let trafficStats = {};
  try {
     const extSS = SpreadsheetApp.openById(CONFIG.EXTERNAL.PROFILING_SHEET_ID);
     const trafficSheet = extSS.getSheetByName(CONFIG.EXTERNAL.TRAFFIC_SHEET_NAME);
     if (trafficSheet) {
        const lastRow = trafficSheet.getLastRow();
        if (lastRow > 1) {
           const tData = trafficSheet.getRange(2, 1, lastRow - 1, trafficSheet.getLastColumn()).getValues();
           tData.forEach(row => {
              let level = String(row[CONFIG.EXTERNAL.TRAFFIC_COLS.PROSPECT] || "").trim();
              if (level) {
                 trafficStats[level] = (trafficStats[level] || 0) + 1;
              }
           });
        }
     }
  } catch(e) {
     console.error("Failed to load traffic pipeline: " + e.message);
  }

  const trafficHeaders = ["Prospect Level", "Total Count"];
  debugSheet.getRange(1, headers.length + 2, 1, 2).setValues([trafficHeaders]);
  debugSheet.getRange(1, headers.length + 2, 1, 2).setFontWeight("bold").setBackground("#f3f4f6");

  const trafficRows = Object.keys(trafficStats).map(key => [key, trafficStats[key]]);
  if (trafficRows.length > 0) {
      trafficRows.sort((a, b) => b[1] - a[1]); // Sort by count descending
      debugSheet.getRange(2, headers.length + 2, trafficRows.length, 2).setValues(trafficRows);
  }

  return `Sukses mengekspor ${exportData.length} transaksi pelanggan & Pipeline Profiling Traffic. Silakan cek sheet Joined_Customer_Debug.`;
}

/**
 * Builds a summary of Traffic data from 2023 to 2026 across all locations
 * and exports it to a new sheet called "Traffic_Summary"
 */
function exportTrafficSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let summarySheet = ss.getSheetByName("Traffic_Summary");
  if (!summarySheet) {
    summarySheet = ss.insertSheet("Traffic_Summary");
  }
  summarySheet.clear();

  const headers = [
    "Tahun", "Bulan", "Lokasi Store", 
    "Penjualan Berhasil", "Penjualan Gagal", "Menunggu Respon Pelanggan", 
    "Potensial Pelanggan Baru", "Dalam Tahap Negosiasi", 
    "Total Traffic"
  ];
  summarySheet.appendRow(headers);
  summarySheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#d9ead3");

  const targetYears = [2023, 2024, 2025, 2026];
  const prospectCategories = [
    "Penjualan Berhasil", 
    "Penjualan Gagal", 
    "Menunggu Respon Pelanggan", 
    "Potensial Pelanggan Baru", 
    "Dalam Tahap Negosiasi"
  ];

  // Nested structure: year -> month -> location -> counts
  const aggregatedData = {};

  try {
     const extSS = SpreadsheetApp.openById(CONFIG.EXTERNAL.PROFILING_SHEET_ID);
     const trafficSheet = extSS.getSheetByName(CONFIG.EXTERNAL.TRAFFIC_SHEET_NAME);
     if (!trafficSheet) throw new Error(`Sheet ${CONFIG.EXTERNAL.TRAFFIC_SHEET_NAME} tidak ditemukan.`);

     const lastRow = trafficSheet.getLastRow();
     if (lastRow > 1) {
        const tData = trafficSheet.getRange(2, 1, lastRow - 1, trafficSheet.getLastColumn()).getValues();
        
        tData.forEach(row => {
           let dateVal = row[CONFIG.EXTERNAL.TRAFFIC_COLS.DATE];
           if (!dateVal) return;

           let d;
           try {
             d = new Date(dateVal);
             if (isNaN(d.getTime())) return;
           } catch (e) { return; }

           const year = d.getFullYear();
           if (!targetYears.includes(year)) return; // Only process 2023-2026

           const month = d.getMonth() + 1; // 1-12
           let loc = String(row[CONFIG.EXTERNAL.TRAFFIC_COLS.LOCATION] || "Unknown").trim();
           if (!loc) loc = "Unknown";
           
           let prospect = String(row[CONFIG.EXTERNAL.TRAFFIC_COLS.PROSPECT] || "").trim();

           // Initialize structure
           if (!aggregatedData[year]) aggregatedData[year] = {};
           if (!aggregatedData[year][month]) aggregatedData[year][month] = {};
           if (!aggregatedData[year][month][loc]) {
               aggregatedData[year][month][loc] = { total: 0 };
               prospectCategories.forEach(cat => aggregatedData[year][month][loc][cat] = 0);
           }

           // Increment Counters
           aggregatedData[year][month][loc].total += 1;
           
           // If the prospect level matches one of our target categories, increment it
           let matchedCategory = prospectCategories.find(c => c.toLowerCase() === prospect.toLowerCase());
           if (matchedCategory) {
               aggregatedData[year][month][loc][matchedCategory] += 1;
           }
        });
     }
  } catch(e) {
     return "Error: " + e.message;
  }

  // Flatten the aggregated structure into a 2D Array
  const outputRows = [];
  
  targetYears.forEach(year => {
      if (aggregatedData[year]) {
          // Iterate months 1-12
          for (let month = 1; month <= 12; month++) {
              if (aggregatedData[year][month]) {
                  const locs = Object.keys(aggregatedData[year][month]).sort();
                  locs.forEach(loc => {
                     const data = aggregatedData[year][month][loc];
                     outputRows.push([
                         year,
                         month,
                         loc,
                         data["Penjualan Berhasil"],
                         data["Penjualan Gagal"],
                         data["Menunggu Respon Pelanggan"],
                         data["Potensial Pelanggan Baru"],
                         data["Dalam Tahap Negosiasi"],
                         data.total
                     ]);
                  });
              }
          }
      }
  });

  if (outputRows.length > 0) {
      summarySheet.getRange(2, 1, outputRows.length, headers.length).setValues(outputRows);
      
      // Formatting options
      summarySheet.getRange(2, 1, outputRows.length, 2).setHorizontalAlignment("center");
      summarySheet.getRange(2, 4, outputRows.length, headers.length - 3).setHorizontalAlignment("center");
      summarySheet.autoResizeColumns(1, headers.length);
  }

  return `Sukses! Berhasil merekap ${outputRows.length} baris data Traffic (2023-2026) ke dalam sheet Traffic_Summary.`;
}

/**
 * SYNC CLEAN NAMES TO PROFILING & TRAFFIC
 * ========================================
 * Reads "Phone Match (Akurat)" entries from Joined_Customer_Debug,
 * then updates the customer name in:
 *   1. Form Profiling (matched by phone, last 8 digits)
 *   2. Traffic (matched by original SAP name, case-insensitive)
 *
 * SAFETY: Creates backup sheets before making any changes.
 * RUN: Execute manually from Apps Script editor.
 */
function syncCleanNamesToProfiling() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // ========== STEP 1: Read Joined_Customer_Debug ==========
  const debugSheet = ss.getSheetByName("Joined_Customer_Debug");
  if (!debugSheet) throw new Error("Sheet Joined_Customer_Debug belum ada. Jalankan exportJoinedCustomerData() dulu.");
  
  const debugData = debugSheet.getDataRange().getValues();
  if (debugData.length < 2) throw new Error("Joined_Customer_Debug kosong.");
  debugData.shift(); // Remove headers
  
  // Column indices in Joined_Customer_Debug:
  // 0: Trans No, 1: Date, 2: System Name (SAP), 3: Clean Name, 4: Salesman, 
  // 5: System Phone, 6: Matched Name, 7: Match Confidence, ...
  const DEBUG_COL = { SAP_NAME: 2, CLEAN_NAME: 3, PHONE: 5, CONFIDENCE: 7 };
  
  // Filter: only "Phone Match (Akurat)" rows with a valid Clean Name
  const phoneMatchRows = debugData.filter(row => {
    const confidence = String(row[DEBUG_COL.CONFIDENCE] || "");
    const cleanName = String(row[DEBUG_COL.CLEAN_NAME] || "").trim();
    return confidence.includes("Phone Match") && confidence.includes("Akurat") && cleanName.length > 0;
  });
  
  if (phoneMatchRows.length === 0) {
    return "Tidak ada data Phone Match (Akurat) yang ditemukan di Joined_Customer_Debug.";
  }
  
  // Build lookup maps from debug data
  // phoneToCleanName: phone suffix (8 digits) -> Clean Name
  // sapNameToCleanName: original SAP name (lowercase) -> Clean Name
  const phoneToCleanName = new Map();
  const sapNameToCleanName = new Map();
  
  phoneMatchRows.forEach(row => {
    const cleanName = String(row[DEBUG_COL.CLEAN_NAME]).trim();
    const phone = String(row[DEBUG_COL.PHONE] || "").replace(/'/g, '').replace(/\D/g, '');
    const sapName = String(row[DEBUG_COL.SAP_NAME] || "").trim();
    
    if (phone.length >= 8) {
      phoneToCleanName.set(phone.slice(-8), cleanName);
    }
    if (sapName) {
      sapNameToCleanName.set(sapName.toLowerCase(), cleanName);
    }
  });
  
  console.log(`📊 Found ${phoneMatchRows.length} Phone Match rows. Phone map: ${phoneToCleanName.size}, Name map: ${sapNameToCleanName.size}`);
  
  // ========== STEP 2: Open External Profiling Spreadsheet ==========
  const extSS = SpreadsheetApp.openById(CONFIG.EXTERNAL.PROFILING_SHEET_ID);
  
  // ========== STEP 3: Update Form Profiling (by Phone) ==========
  let profilingUpdated = 0;
  const profilingSheet = extSS.getSheetByName(CONFIG.EXTERNAL.PROFILING_SHEET_NAME);
  if (profilingSheet && profilingSheet.getLastRow() > 1) {
    // Create backup
    const backupName = "BACKUP_FormProfiling_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    profilingSheet.copyTo(extSS).setName(backupName);
    console.log("✅ Backup created: " + backupName);
    
    const profData = profilingSheet.getDataRange().getValues();
    const PROF_NAME_COL = CONFIG.EXTERNAL.COLS.NAME;      // Index 4 = Kolom E
    const PROF_PHONE_COL = CONFIG.EXTERNAL.COLS.PHONE;    // Index 16 = Kolom Q
    
    for (let i = 1; i < profData.length; i++) { // Skip header
      const rawPhone = String(profData[i][PROF_PHONE_COL] || "").replace(/\D/g, '');
      if (rawPhone.length < 8) continue;
      
      const suffix = rawPhone.slice(-8);
      if (phoneToCleanName.has(suffix)) {
        const newName = phoneToCleanName.get(suffix);
        const oldName = String(profData[i][PROF_NAME_COL] || "").trim();
        
        // Only update if name is actually different
        if (oldName.toLowerCase() !== newName.toLowerCase() && newName.length > 0) {
          profilingSheet.getRange(i + 1, PROF_NAME_COL + 1).setValue(newName); // +1 for 1-based index
          profilingUpdated++;
        }
      }
    }
  }
  
  // ========== STEP 4: Update Traffic (by Phone, Column N = index 13) ==========
  let trafficUpdated = 0;
  const trafficSheet = extSS.getSheetByName(CONFIG.EXTERNAL.TRAFFIC_SHEET_NAME);
  if (trafficSheet && trafficSheet.getLastRow() > 1) {
    // Create backup
    const backupName = "BACKUP_Traffic_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    trafficSheet.copyTo(extSS).setName(backupName);
    console.log("✅ Backup created: " + backupName);
    
    const trafData = trafficSheet.getDataRange().getValues();
    const TRAF_NAME_COL = CONFIG.EXTERNAL.TRAFFIC_COLS.NAME; // Index 2 = Kolom C
    const TRAF_PHONE_COL = 13; // Kolom N (0-based index)
    
    for (let i = 1; i < trafData.length; i++) { // Skip header
      const rawPhone = String(trafData[i][TRAF_PHONE_COL] || "").replace(/'/g, '').replace(/\D/g, '');
      if (rawPhone.length < 8) continue;
      
      const suffix = rawPhone.slice(-8);
      if (phoneToCleanName.has(suffix)) {
        const newName = phoneToCleanName.get(suffix);
        const oldName = String(trafData[i][TRAF_NAME_COL] || "").trim();
        
        // Only update if name is actually different
        if (oldName.toLowerCase() !== newName.toLowerCase() && newName.length > 0) {
          trafficSheet.getRange(i + 1, TRAF_NAME_COL + 1).setValue(newName); // +1 for 1-based index
          trafficUpdated++;
        }
      }
    }
  }
  
  const summary = `✅ Sync selesai!\n` +
    `📋 Data Phone Match (Akurat): ${phoneMatchRows.length} baris\n` +
    `🔄 Form Profiling diperbarui: ${profilingUpdated} nama\n` +
    `🔄 Traffic diperbarui: ${trafficUpdated} nama\n` +
    `💾 Backup sheet sudah dibuat otomatis.`;
  
  console.log(summary);
  return summary;
}

/**
 * CLEAN TITLES IN RAW SYSTEM & CLEAN MASTER
 * ==============================================================
 * Removes titles (Mr, Mrs, Ms, Miss, Mdm, Ibu, Bpk, dll)
 * and adjacent punctuation directly from customer names in:
 *   1. raw_system     → Column C (Customer)
 *   2. clean_master   → Column C (Customer)
 *
 * SAFETY: Creates backup sheets before making any changes.
 * RUN: Execute manually from Apps Script editor.
 */
function cleanTitlesRawAndCleanMaster() {
  
  // Reusable function to clean a single name
  function removeTitles(name) {
    if (!name) return "";
    return String(name)
      .replace(/\b(mr|mrs|ms|miss|mdm|madam|ibu|bpk|bapak|ny|tn|dr|prof|sir|lady|h|hj)\b[.\s]*/gi, '')
      .replace(/[,.\-]+\s*$/g, '')   // trailing punctuation
      .replace(/^\s*[,.\-]+/g, '')   // leading punctuation
      .replace(/\s{2,}/g, ' ')       // collapse multiple spaces
      .trim();
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");



  // ========== STEP 3: Clean raw_system (Column C = index 2) ==========
  let rawCleaned = 0;
  const rawSheet = ss.getSheetByName(CONFIG.SHEETS.RAW);
  if (rawSheet && rawSheet.getLastRow() > 1) {
    const backupName = "BACKUP_CleanTitle_Raw_" + nowStr;
    rawSheet.copyTo(ss).setName(backupName);
    console.log("✅ Backup created: " + backupName);

    const rawData = rawSheet.getDataRange().getValues();
    const CUST_COL = CONFIG.RAW_COLS.CUSTOMER; // Index 2 = Column C

    for (let i = 1; i < rawData.length; i++) {
      const oldName = String(rawData[i][CUST_COL] || "").trim();
      if (!oldName) continue;

      const cleanedName = removeTitles(oldName);
      if (cleanedName !== oldName && cleanedName.length > 0) {
        rawSheet.getRange(i + 1, CUST_COL + 1).setValue(cleanedName);
        rawCleaned++;
      }
    }
  }

  // ========== STEP 4: Clean clean_master (Column C = index 2) ==========
  let cleanMasterCleaned = 0;
  const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
  if (cleanSheet && cleanSheet.getLastRow() > 1) {
    const backupName = "BACKUP_CleanTitle_CleanMaster_" + nowStr;
    cleanSheet.copyTo(ss).setName(backupName);
    console.log("✅ Backup created: " + backupName);

    const cleanData = cleanSheet.getDataRange().getValues();
    const CUST_COL = CONFIG.CLEAN_COLS.CUSTOMER; // Index 2 = Column C

    for (let i = 1; i < cleanData.length; i++) {
      const oldName = String(cleanData[i][CUST_COL] || "").trim();
      if (!oldName) continue;

      const cleanedName = removeTitles(oldName);
      if (cleanedName !== oldName && cleanedName.length > 0) {
        cleanSheet.getRange(i + 1, CUST_COL + 1).setValue(cleanedName);
        cleanMasterCleaned++;
      }
    }
  }

  const summary = `✅ Clean Titles selesai untuk Master Data!\n` +
    `🧹 RAW System:     ${rawCleaned} nama dibersihkan\n` +
    `🧹 Clean Master:   ${cleanMasterCleaned} nama dibersihkan\n` +
    `💾 2 Backup sheet sudah dibuat otomatis.`;

  console.log(summary);
  return summary;
}

/**
 * SYNC SALES TO TRAFFIC
 * =====================
 * Aggregates data from `clean_master` by Invoice Number (Trans No),
 * and syncs it securely to the `Traffic` sheet based on the User input Invoice (Column AP).
 * 
 * Aggregates:
 * - SAP Codes into Item 1-10 (Max 10)
 * - Catalogue Codes into Detail Items
 * - Gross, Val Disc, Net Sales (SUM)
 * - Disc % (Average)
 * Updates Prospect Level to 'Penjualan Berhasil'
 */
function syncSalesToTraffic() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
  if (!cleanSheet) return "Error: Sheet clean_master tidak ditemukan.";

  const cData = cleanSheet.getDataRange().getValues();
  if (cData.length <= 1) return "Data clean_master kosong.";

  // 1. Aggregation Phase
  const salesMap = {};
  const CCOL = CONFIG.CLEAN_COLS;

  for (let i = 1; i < cData.length; i++) {
    const row = cData[i];
    const invoice = String(row[CCOL.TRANS_NO] || '').trim();
    if (!invoice) continue;

    if (!salesMap[invoice]) {
      salesMap[invoice] = {
        customerName: String(row[CCOL.CUSTOMER] || '').trim(),
        sapCodes: [],
        catalogueCodes: [],
        grossSum: 0,
        discPctSum: 0,
        valDiscSum: 0,
        netSalesSum: 0,
        itemCount: 0
      };
    }

    const data = salesMap[invoice];
    const sap = String(row[CCOL.SAP] || '').trim();
    if (sap) data.sapCodes.push(sap);
    
    const cat = String(row[CCOL.CATALOGUE] || '').trim();
    if (cat && data.catalogueCodes.indexOf(cat) === -1) {
       data.catalogueCodes.push(cat); // optional: preventing duplicate catalogues
    } else if (cat) {
       data.catalogueCodes.push(cat);
    }

    data.grossSum += Number(row[CCOL.GROSS]) || 0;
    data.discPctSum += Number(row[CCOL.DISC_PCT]) || 0;
    data.valDiscSum += Number(row[CCOL.VAL_DISC]) || 0;
    data.netSalesSum += Number(row[CCOL.NET_SALES]) || 0;
    data.itemCount++;
  }

  // 2. Sync to Traffic Phase
  const extSS = SpreadsheetApp.openById(CONFIG.EXTERNAL.PROFILING_SHEET_ID);
  const trafficSheet = extSS.getSheetByName(CONFIG.EXTERNAL.TRAFFIC_SHEET_NAME);
  if (!trafficSheet) return "Error: Sheet Traffic tidak ditemukan.";

  const tData = trafficSheet.getDataRange().getValues();
  if (tData.length <= 1) return "Data Traffic kosong.";

  // Create Backup
  const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  const backupName = "BACKUP_SyncSales_Traffic_" + nowStr;
  trafficSheet.copyTo(extSS).setName(backupName);
  console.log("✅ Backup Traffic created: " + backupName);

  const TCOL = CONFIG.EXTERNAL.TRAFFIC_COLS;
  let syncCount = 0;

  for (let i = 1; i < tData.length; i++) {
    const row = tData[i];
    const invoiceKey = String(row[TCOL.INVOICE] || '').trim();
    if (!invoiceKey) continue;

    const matchedSales = salesMap[invoiceKey];
    if (matchedSales) {
      // Name
      if (matchedSales.customerName) trafficSheet.getRange(i + 1, TCOL.NAME + 1).setValue(matchedSales.customerName);
      
      // Items 1-10
      for (let j = 0; j < 10; j++) {
        trafficSheet.getRange(i + 1, TCOL.ITEM_1 + j + 1).setValue(matchedSales.sapCodes[j] || '-');
      }

      // Detail Items
      trafficSheet.getRange(i + 1, TCOL.DETAIL_ITEMS + 1).setValue(matchedSales.catalogueCodes.join(', ') || '-');

      // Financials
      trafficSheet.getRange(i + 1, TCOL.GROSS + 1).setValue(matchedSales.grossSum);
      
      const avgDiscPct = matchedSales.itemCount > 0 ? (matchedSales.discPctSum / matchedSales.itemCount) : 0;
      trafficSheet.getRange(i + 1, TCOL.DISC_PCT + 1).setValue(avgDiscPct);
      
      trafficSheet.getRange(i + 1, TCOL.VAL_DISC + 1).setValue(matchedSales.valDiscSum);
      trafficSheet.getRange(i + 1, TCOL.NET_SALES + 1).setValue(matchedSales.netSalesSum);

      // Prospect Level
      trafficSheet.getRange(i + 1, TCOL.PROSPECT + 1).setValue("Penjualan Berhasil");

      syncCount++;
    }
  }

  const resultMsg = `Sinkronisasi Selesai! Berhasil mengupdate ${syncCount} data dari SAP ke Traffic.`;
  console.log(resultMsg);
  return { status: 'success', message: resultMsg, count: syncCount };
}
