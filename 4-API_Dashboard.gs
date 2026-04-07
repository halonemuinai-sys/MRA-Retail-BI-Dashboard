/**
 * File: 4-API_Dashboard.gs
 * Description: Fungsi API untuk Sinkronisasi Data (ETL) & Dashboard Utama.
 * STATUS: UPDATED (Menggunakan logika Refactored Version)
 */

// ==========================================
// --- 1. DATA SYNC (ETL PROCESS) ---
// ==========================================

function runDataSync() {
  try {
    const ss = getSpreadsheet();
    // Helper loadMasters dan buildCleanMaster ada di 6-Helpers.gs
    const masters = loadMasters(ss);
    buildCleanMaster(ss, masters);
    
    // Traffic Data Mart update dipindahkan ke cron trigger (tidak lagi dipicu manual via Tombol Sync)
    // agar sinkronisasi dashboard kembali ringan.

    return {
      success: true,
      message: "Data berhasil disinkronisasi & dibersihkan."
    };
  } catch (e) {
    return {
      success: false,
      message: "Gagal Sync: " + e.message
    };
  }
}

// ==========================================
// --- 2. DASHBOARD DATA GETTERS ---
// ==========================================

function getDashboardData(monthName, year, forceRefresh = false) {
  // Caching Logic Start
  const cache = CacheService.getScriptCache();
  const cacheKey = `DASH_${monthName}_${year}`;
  
  // Temporarily force refresh to bust the bad cache state
  forceRefresh = true;

  if (forceRefresh) {
    cache.remove(cacheKey);
  } else {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      try {
        return JSON.parse(cachedData);
      } catch (e) {
        // If parse fails, ignore and fetch fresh
      }
    }
  }

  const ss = getSpreadsheet();
  
  // DYNAMIC LOADING: Coba cari sheet Archive dulu (misal Clean_Data_2024)
  let sheetName = CONFIG.SHEETS.CLEAN; 
  const currentYear = new Date().getFullYear();
  
  // Logic: Jika tahun yg diminta BUKAN tahun sekarang, coba cari di archive
  if (year != currentYear) {
      const archiveName = `Clean_Data_${year}`;
      if (ss.getSheetByName(archiveName)) {
          sheetName = archiveName;
      }
  }

  const cleanSheet = ss.getSheetByName(sheetName);
  if (!cleanSheet) return {
    error: `Sheet '${sheetName}' tidak ditemukan. Harap Sync Data atau Arsip.`
  };

  const data = cleanSheet.getDataRange().getValues();
  data.shift(); // Remove header

  // Column Mapping Lokal (Sesuai buildCleanMaster)
  const COL = {
    DATE: 1,
    CUSTOMER: 2,
    LOCATION: 4,
    MAIN_CAT: 6,
    GROSS: 8,
    VAL_DISC: 10,
    SELLING_COST: 13,
    NET_SALES: 14,
    TYPE: 15,
    QTY: 16,
    SALESMAN: 3,
    PHONE: 19,
    TRANS_NO: 0
  };

  const monthIndex = new Date(`${monthName} 1, 2000`).getMonth();

  // Filter Data Bulanan
  const monthlyData = data.filter(row => {
    const d = parseDateFix(row[COL.DATE]);
    return d.getMonth() === monthIndex && d.getFullYear() == year;
  });

  // Filter Data Tahunan
  const yearlyData = data.filter(row => {
    const d = parseDateFix(row[COL.DATE]);
    return d.getFullYear() == year;
  });

  // 1. Multi-Year Trend Analysis (2023 - 2026)
  const targetYears = [2023, 2024, 2025, 2026];
  const multiYearStats = {};
  
  targetYears.forEach(y => {
    multiYearStats[y] = new Array(12).fill(0); // Only Net Sales for now
    const yData = data.filter(row => {
        const d = parseDateFix(row[COL.DATE]);
        return d.getFullYear() == y;
    });
    
    yData.forEach(row => {
        const d = parseDateFix(row[COL.DATE]);
        const m = d.getMonth();
        const net = (Number(row[COL.NET_SALES]) || 0);
        if (multiYearStats[y][m] !== undefined) {
             multiYearStats[y][m] += net;
        }
    });
  });

  // Current Year Details (for other charts)
  const trendStats = new Array(12).fill(null).map(() => ({ net: 0, qty: 0, transSet: new Set(), custSet: new Set() }));
  let annualSalesExcHO = 0;
  


  // 2. Annual Trend (Per Category)
  const categoryTrend = {};

  yearlyData.forEach(row => {
    const d = parseDateFix(row[COL.DATE]);
    const m = d.getMonth();
    const day = d.getDate();
    const net = (Number(row[COL.NET_SALES]) || 0);
    const qty = (Number(row[COL.QTY]) || 0);
    const cat = String(row[COL.MAIN_CAT] || "Other").trim();
    const loc = String(row[COL.LOCATION]).trim();
    const transNo = String(row[COL.TRANS_NO] || "");
    const custName = String(row[COL.CUSTOMER] || "").trim();

    if (trendStats[m]) {
      trendStats[m].net += net;
      trendStats[m].qty += qty;
      if (transNo) trendStats[m].transSet.add(transNo);
      if (custName && custName.toLowerCase() !== "customer") trendStats[m].custSet.add(custName);
    }

    // ROBUST CHECK: Use includes to catch "Head Office", "Head Office " etc.
    if (!loc.toLowerCase().includes("head office")) {
      annualSalesExcHO += net;
      

    }

    if (!categoryTrend[cat]) {
      categoryTrend[cat] = { net: new Array(12).fill(0), qty: new Array(12).fill(0) };
    }
    if (categoryTrend[cat].net[m] !== undefined) {
      categoryTrend[cat].net[m] += net;
      categoryTrend[cat].qty[m] += qty;
    }
  });
  


  // 3. Daily Stats (Untuk Grafik Dashboard) & MTD Baseline
  const activeStores = new Set();
  const dailyStats = new Array(31).fill(null).map(() => ({ net: 0, qty: 0, breakdown: {} }));
  
  let currentMtdSales = 0;
  let maxDayInCurrentMonth = 0;

  monthlyData.forEach(row => {
    const d = parseDateFix(row[COL.DATE]);
    const day = d.getDate() - 1;
    
    // Find absolute max date available for current month to bound MTD
    if (day + 1 > maxDayInCurrentMonth) {
        maxDayInCurrentMonth = day + 1; 
    }

    if (day >= 0 && day < 31) {
      const net = Number(row[COL.NET_SALES]) || 0;
      const qty = Number(row[COL.QTY]) || 0;
      const loc = String(row[COL.LOCATION]).trim();

      activeStores.add(loc);

      dailyStats[day].net += net;
      dailyStats[day].qty += qty;
      
      // Accumulate MTD for Store Sales
      if (!loc.toLowerCase().includes("head office")) {
         currentMtdSales += net;
      }

      if (!dailyStats[day].breakdown[loc]) dailyStats[day].breakdown[loc] = { net: 0, qty: 0 };
      dailyStats[day].breakdown[loc].net += net;
      dailyStats[day].breakdown[loc].qty += qty;
    }
  });

  const overview = aggregateOverview(monthlyData, COL, ss, monthName, year);
  const annualTarget = getAnnualTarget(ss, year);

  // 4. LOAD EXTERNAL CUSTOMER PROFILES AND ENRICH MONTHLY DATA
  const profilesMap = loadCustomerProfiles();
  const enrichedCustomers = [];

  if (profilesMap.success) {
      // Create a set to track processed transactions so we don't duplicate customer rows
      const processedTrans = new Set();
      
      monthlyData.forEach(row => {
          const transNo = String(row[COL.TRANS_NO] || "");
          if (processedTrans.has(transNo)) return;
          processedTrans.add(transNo);

          const custName = String(row[COL.CUSTOMER] || "").trim();
          if (!custName || custName.toLowerCase() === "customer") return;

          const phoneStr = String(row[COL.PHONE] || "").trim();
          const net = Number(row[COL.NET_SALES]) || 0;
          const loc = String(row[COL.LOCATION]).trim();
          const adv = String(row[COL.SALESMAN]).trim();
          
          let matchedProfile = null;
          let matchType = 'None';

          // A: Priority 1 - Phone Match (Last 8 digits)
          if (phoneStr && phoneStr.length >= 8) {
              const suffix = phoneStr.slice(-8);
              if (profilesMap.phoneMap.has(suffix)) {
                  matchedProfile = profilesMap.phoneMap.get(suffix);
                  matchType = 'Phone';
              }
          }

          // B: Priority 2 - Exact Name Match
          if (!matchedProfile) {
              const lowerName = custName.toLowerCase();
              if (profilesMap.nameMap.has(lowerName)) {
                  matchedProfile = profilesMap.nameMap.get(lowerName);
                  matchType = 'Exact Name';
              }
          }

          // C: Priority 3 - Fuzzy Name Match (Threshold > 85%)
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
                 matchType = `Fuzzy (${Math.round(highestScore)}%)`;
              }
          }

          // Append to our list of enriched active customers this month
          enrichedCustomers.push({
              sysName: custName,
              sysPhone: phoneStr,
              netSales: net,
              location: loc,
              advisor: adv,
              profile: matchedProfile,
              matchReason: matchType
          });
      });
  }

  const advisorStats = calculateAdvisorPerformance(
    monthlyData, COL, ss, monthName, year,
    overview.kpi.totalTarget,
    overview.rawStoreStats,
    overview.rawTargetMap
  );

  overview.trendData = trendStats.map(t => ({
    net: t.net,
    qty: t.qty,
    trans: t.transSet.size,
    customers: t.custSet.size
  }));
  overview.multiYearStats = multiYearStats; // New Multi-Year Data
  overview.categoryTrend = categoryTrend;
  overview.advisorData = advisorStats;
  overview.dailyTrendData = dailyStats;
  overview.activeStores = Array.from(activeStores).sort();
  overview.customerInsights = enrichedCustomers; // Array of dynamically merged customers
  overview.annualStats = {
    salesExcHO: annualSalesExcHO,
    target: annualTarget,
    achievement: annualTarget > 0 ? (annualSalesExcHO / annualTarget) * 100 : 0,
  };

  // 4. PREVIOUS YEAR MTD CALCULATION
  let previousMtdSales = 0;
  if (maxDayInCurrentMonth > 0) {
      const prevYear = year - 1;
      let prevSheetName = CONFIG.SHEETS.CLEAN; 
      if (ss.getSheetByName(`Clean_Data_${prevYear}`)) {
          prevSheetName = `Clean_Data_${prevYear}`;
      }
      
      const prevSheet = ss.getSheetByName(prevSheetName);
      if (prevSheet) {
          const prevData = prevSheet.getDataRange().getValues();
          prevData.shift(); // Remove Header
          
          prevData.forEach(row => {
              const d = parseDateFix(row[COL.DATE]);
              if (d.getFullYear() == prevYear && d.getMonth() === monthIndex && d.getDate() <= maxDayInCurrentMonth) {
                  const loc = String(row[COL.LOCATION]).trim();
                  // Must exclude HO like we do in currentMtdSales
                  if (!loc.toLowerCase().includes("head office")) {
                      previousMtdSales += (Number(row[COL.NET_SALES]) || 0);
                  }
              }
          });
      }
  }

  // Inject into KPI object returned by overview
  if (overview.kpi) {
      overview.kpi.mtdSalesCurrent = currentMtdSales;
      overview.kpi.mtdSalesPrevYear = previousMtdSales;
      overview.kpi.mtdGrowthPct = previousMtdSales > 0 ? ((currentMtdSales - previousMtdSales) / previousMtdSales) * 100 : 0;
  }

  // --- Add Holidays for the Request Month ---
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const monthHolidays = {};
  for(let i=1; i<=daysInMonth; i++) {
     const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
     const holiday = getIndonesianHoliday(dateStr);
     if(holiday) {
         monthHolidays[i] = holiday;
     }
  }
  overview.holidays = monthHolidays;

  delete overview.rawStoreStats;
  delete overview.rawTargetMap;

  // Add Last Sync Info
  const lastSyncStr = PropertiesService.getScriptProperties().getProperty('LAST_SYNC') || 'Unknown';
  overview.lastSync = lastSyncStr;

  // 5. LOAD TRAFFIC FUNNEL FROM DATA MART (Traffic_Summary)
  const trafficFunnel = {
      berhasil: 0,
      gagal: 0,
      menunggu: 0,
      potensial: 0,
      nego: 0,
      total: 0
  };

  try {
      const trafficSummarySheet = ss.getSheetByName(CONFIG.SHEETS.TRAFFIC_SUMMARY);
      if (trafficSummarySheet) {
          const tSumData = trafficSummarySheet.getDataRange().getValues();
          tSumData.shift(); // remove header
          tSumData.forEach(row => {
              // Col 0: Tahun, Col 1: Bulan (1-12)
              if (row[0] == year && row[1] == monthIndex + 1) {
                  // Col 3: Penjualan Berhasil, Col 4: Gagal, Col 5: Menunggu
                  // Col 6: Potensial, Col 7: Nego, Col 8: Total
                  trafficFunnel.berhasil += Number(row[3]) || 0;
                  trafficFunnel.gagal += Number(row[4]) || 0;
                  trafficFunnel.menunggu += Number(row[5]) || 0;
                  trafficFunnel.potensial += Number(row[6]) || 0;
                  trafficFunnel.nego += Number(row[7]) || 0;
                  trafficFunnel.total += Number(row[8]) || 0;
              }
          });
      }
  } catch (e) {
      console.warn("Failed to load Traffic_Summary Data Mart: " + e.message);
  }

  overview.trafficFunnel = trafficFunnel;

  // 6. LOAD STATUS KEDATANGAN & LOCATION TRAFFIC FROM EXTERNAL TRAFFIC SHEET
  const statusKedatangan = { walkIn: 0, followUp: 0, delivery: 0, service: 0, onlineOnly: 0 };
  const locationTraffic = { pi: 0, ps: 0, bali: 0, total: 0 };
  try {
      const TCOL = CONFIG.EXTERNAL.TRAFFIC_COLS;
      const extSS = SpreadsheetApp.openById(CONFIG.EXTERNAL.PROFILING_SHEET_ID);
      const trafficSheet = extSS.getSheetByName(CONFIG.EXTERNAL.TRAFFIC_SHEET_NAME);
      if (trafficSheet) {
          const lastRow = trafficSheet.getLastRow();
          if (lastRow > 1) {
              const tData = trafficSheet.getRange(2, 1, lastRow - 1, trafficSheet.getLastColumn()).getValues();
              tData.forEach(row => {
                  let dateVal = row[TCOL.DATE];
                  if (!dateVal) return;
                  let d;
                  try { d = new Date(dateVal); if (isNaN(d.getTime())) return; } catch(e) { return; }
                  if (d.getFullYear() != year || d.getMonth() != monthIndex) return;

                  // Status Kedatangan
                  const st = String(row[TCOL.STATUS] || '').trim().toLowerCase();
                  if (st.includes('walk in') || st.includes('walk-in') || st === 'walkin') statusKedatangan.walkIn++;
                  else if (st.includes('follow up') || st.includes('follow-up') || st === 'followup') statusKedatangan.followUp++;
                  else if (st.includes('delivery') || st.includes('showing')) statusKedatangan.delivery++;
                  else if (st.includes('repair') || st.includes('service')) statusKedatangan.service++;
                  else if (st.includes('online')) statusKedatangan.onlineOnly++;

                  // Location Traffic
                  const loc = String(row[TCOL.LOCATION] || '').trim().toLowerCase();
                  locationTraffic.total++;
                  if (loc.includes('plaza indonesia') || loc === 'pi') locationTraffic.pi++;
                  else if (loc.includes('plaza senayan') || loc === 'ps') locationTraffic.ps++;
                  else if (loc.includes('bali')) locationTraffic.bali++;
              });
          }
      }
  } catch (e) {
      console.warn("Failed to load Traffic data: " + e.message);
  }
  overview.statusKedatangan = statusKedatangan;
  overview.locationTraffic = locationTraffic;

  // Save to Cache
  try {
    const jsonString = JSON.stringify(overview);
    if (jsonString.length < 100000) { // Safety check for GAS cache limit (100KB string)
       cache.put(cacheKey, jsonString, 300);
    }
  } catch (e) {
    // Ignore cache write errors
  }

  return overview;
}

// --- D. Customer Segmentation ---
function getCustomerSegmentationData() {
  const ss = getSpreadsheet();
  const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
  if (!cleanSheet) return { error: "Data transaksi tidak ditemukan. Harap Sync Data." };

  const data = cleanSheet.getDataRange().getValues();
  data.shift();

  // Gunakan Global CLEAN_COLS dari 1-Config.gs
  const COL = CONFIG.CLEAN_COLS; 
  const customers = {};
  const today = new Date(); 

  data.forEach(row => {
    const name = String(row[COL.CUSTOMER]).trim();
    if (!name || name === "" || name === "Customer") return;
    const date = parseDateFix(row[COL.DATE]);
    const net = Number(row[COL.NET_SALES]) || 0;

    if (!customers[name]) { 
      customers[name] = { 
        name: name, 
        totalSpend: 0, 
        transactions: new Set(), // Track unique Trans No
        totalQty: 0,
        lastDate: date 
      }; 
    }
    const c = customers[name];
    c.totalSpend += net;
    c.transactions.add(row[COL.TRANS_NO]); // Add Trans No to Set
    c.totalQty += (Number(row[COL.QTY]) || 0); // Sum Qty
    if (date > c.lastDate) c.lastDate = date;
  });

  const resultList = [];
  const segmentCounts = { "Prospect": 0, "Potential": 0, "High Potential": 0, "Elite": 0, "Top": 0, "Inactive": 0 };
  const revenueMix = { "New": 0, "Repeat": 0 };

  // Metric calculations
  const currentYear = today.getFullYear();
  let totalActiveCustomers = 0; // Active within 24 months
  let newCustomersCurrentYear = 0;
  let totalSpendAll = 0;
  
  // Growth Trend data: Array of 12 months (Jan-Dec) for current year
  const growthTrend = {
      new: new Array(12).fill(0),
      repeat: new Array(12).fill(0)
  };

  for (const name in customers) {
    const c = customers[name];
    const diffTime = Math.abs(today - c.lastDate);
    const recencyDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const freq = c.transactions.size; // Use Unique Transaction Count

    let segment = "";
    if (recencyDays > 730) { segment = "Inactive"; }
    else {
      totalActiveCustomers++;
      totalSpendAll += c.totalSpend;
      
      if (c.totalSpend > 1350000000) segment = "Top";
      else if (c.totalSpend >= 200000000) segment = "Elite";
      else if (c.totalSpend >= 50000000) segment = "High Potential";
      else if (c.totalSpend > 0) segment = "Potential";
      else segment = "Prospect";
    }

    if (segmentCounts[segment] !== undefined) segmentCounts[segment]++;
    
    // Revenue Mix Logic based on Unique Transactions
    if (freq === 1) {
        revenueMix["New"] += c.totalSpend; 
        if (c.lastDate.getFullYear() === currentYear) {
            newCustomersCurrentYear++;
            growthTrend.new[c.lastDate.getMonth()]++;
        }
    } else {
        revenueMix["Repeat"] += c.totalSpend;
        if (c.lastDate.getFullYear() === currentYear) {
            growthTrend.repeat[c.lastDate.getMonth()]++;
        }
    }

    resultList.push({ 
      name: c.name, 
      spend: c.totalSpend, 
      freq: freq, // Unique Visit
      qty: c.totalQty, // Total Qty 
      recency: recencyDays, 
      segment: segment 
    });
  }
  
  resultList.sort((a, b) => b.spend - a.spend);
  
  // KPI Calculations
  const topSpender = resultList.length > 0 ? resultList[0] : null;
  const avgLtv = totalActiveCustomers > 0 ? (totalSpendAll / totalActiveCustomers) : 0;
  const newRatio = totalActiveCustomers > 0 ? (newCustomersCurrentYear / totalActiveCustomers) * 100 : 0;

  const summaryKpi = {
      totalActive: totalActiveCustomers,
      topSpender: topSpender,
      newRatio: newRatio,
      avgLtv: avgLtv
  };

  return { 
      details: resultList, 
      segments: segmentCounts, 
      revenueMix: revenueMix,
      summaryKpi: summaryKpi,
      growthTrend: growthTrend
  };
}

// --- E. Specific Customer Detail ---
function getCustomerDetails(customerName) {
  const ss = getSpreadsheet();
  const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
  if (!cleanSheet) return { error: "Data transaksi tidak ditemukan." };

  const data = cleanSheet.getDataRange().getValues();
  data.shift();
  const COL = CONFIG.CLEAN_COLS; 
  
  const history = [];
  const collMap = {};
  let totalSpend = 0;

  data.forEach(row => {
      const name = String(row[COL.CUSTOMER]).trim();
      if (name === customerName) {
          const d = parseDateFix(row[COL.DATE]);
          const loc = String(row[COL.LOCATION]).trim();
          const net = Number(row[COL.NET_SALES]) || 0;
          const qty = Number(row[COL.QTY]) || 0;
          const coll = String(row[COL.COLL] || "-").trim();
          const cat = String(row[COL.MAIN_CAT] || "-").trim();

          history.push({
              date: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
              rawDate: d.getTime(), // For sorting
              location: loc,
              net: net,
              qty: qty,
              category: cat,
              collection: coll
          });

          totalSpend += net;

          if (!collMap[coll]) collMap[coll] = { name: coll, spend: 0, qty: 0 };
          collMap[coll].spend += net;
          collMap[coll].qty += qty;
      }
  });

  history.sort((a, b) => b.rawDate - a.rawDate);
  const topCollections = Object.values(collMap).sort((a, b) => b.spend - a.spend).slice(0, 5); // Get top 5

  return {
      history: history,
      topCollections: topCollections,
      totalSpend: totalSpend
  };
}

// ==========================================
// --- 3. REPORT GENERATION (PDF) ---
// ==========================================


// ==========================================
// --- 3. DAILY REPORT API (SUMMARY) ---
// ==========================================


function getDailyReportData(dateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
  if (!cleanSheet) return { error: 'Clean Data not found.' };

  const data = cleanSheet.getDataRange().getValues();
  data.shift(); // Remove header

  // Date Parsing
  const targetDate = new Date(dateStr);
  const targetDay = targetDate.getDate();
  const targetMonth = targetDate.getMonth(); // 0-indexed
  const targetYear = targetDate.getFullYear();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthName = monthNames[targetMonth];

  const COL = CONFIG.CLEAN_COLS;
  
  // 1. Get Targets
  const targetMap = getTargetMap(ss, currentMonthName, targetYear) || {};

  // 2. Aggregate Data
  const stores = {}; 
  const breakdownMap = {}; // Key: "Store|Category|Collection"

  data.forEach(row => {
    const d = parseDateFix(row[COL.DATE]);
    // Filter for same month and year
    if (d.getMonth() === targetMonth && d.getFullYear() === targetYear) {
      
      const store = String(row[COL.LOCATION]).trim();
      if (!store) return; // Allow Head Office now

      if (!stores[store]) {
        stores[store] = { 
          store: store, 
          dailyNet: 0, dailyQty: 0, dailyCost: 0, dailyGross: 0, dailyDisc: 0,
          mtdNet: 0, 
          regQty: 0, smiQty: 0 
        };
      }

      const net = (Number(row[COL.NET_SALES]) || 0);
      
      // MTD Calculation
      if (d <= targetDate) {
        stores[store].mtdNet += net;
      }

      // Daily Calculation
      if (d.getDate() === targetDay) {
        stores[store].dailyNet += net;
        const qty = (Number(row[COL.QTY]) || 0);
        stores[store].dailyQty += qty;
        stores[store].dailyCost += (Number(row[COL.COMM]) || 0); // Use Card Comm
        stores[store].dailyGross += (Number(row[COL.GROSS]) || 0);
        stores[store].dailyDisc += (Number(row[COL.VAL_DISC]) || 0);

        // Breakdown Summary (Reg/SMI)
        const type = String(row[COL.TYPE] || "").toUpperCase();
        if (type.includes("SMI") || type.includes("SEMI")) {
           stores[store].smiQty += qty;
        } else {
           stores[store].regQty += qty;
        }

        // Detailed Breakdown Collection
        const cat = String(row[COL.MAIN_CAT] || "Other").trim();
        const coll = String(row[COL.COLL] || "-").trim();
        const key = `${store}|${cat}|${coll}`;
        
        if (!breakdownMap[key]) {
             breakdownMap[key] = { store: store, cat: cat, coll: coll, qty: 0, net: 0 };
        }
        breakdownMap[key].qty += qty;
        breakdownMap[key].net += net;
      }
    }
  });

  // 3. Compile Summary Result
  const reportData = [];
  const totalStats = { daily: 0, qty: 0, cost: 0, gross: 0, disc: 0, mtd: 0, target: 0, reg: 0, smi: 0 };

  const allStores = new Set([...Object.keys(stores), ...Object.keys(targetMap)]);

  allStores.forEach(store => {
    // Note: We include Head Office now
    const s = stores[store] || { dailyNet: 0, dailyQty: 0, dailyCost: 0, dailyGross: 0, dailyDisc: 0, mtdNet: 0, regQty: 0, smiQty: 0 };
    const target = targetMap[store] || 0;

    const avgDisc = s.dailyGross > 0 ? (s.dailyDisc / s.dailyGross) : 0;
    const mdr = s.dailyNet > 0 ? (s.dailyCost / s.dailyNet) : 0;
    const achv = target > 0 ? (s.mtdNet / target) : 0;

    reportData.push({
      store: store,
      net: s.dailyNet,
      qty: s.dailyQty,
      reg: s.regQty,
      smi: s.smiQty,
      avgDisc: avgDisc,
      cost: s.dailyCost,
      mdr: mdr,
      mtd: s.mtdNet,
      achv: achv
    });

    totalStats.daily += s.dailyNet;
    totalStats.qty += s.dailyQty;
    totalStats.reg += s.regQty;
    totalStats.smi += s.smiQty;
    totalStats.gross += s.dailyGross;
    totalStats.disc += s.dailyDisc;
    totalStats.cost += s.dailyCost;
    totalStats.mtd += s.mtdNet;
    totalStats.target += target;
  });

  totalStats.avgDisc = totalStats.gross > 0 ? (totalStats.disc / totalStats.gross) : 0;
  totalStats.mdr = totalStats.daily > 0 ? (totalStats.cost / totalStats.daily) : 0;
  totalStats.achv = totalStats.target > 0 ? (totalStats.mtd / totalStats.target) : 0;

  reportData.sort((a, b) => b.net - a.net);

  // 4. Compile Breakdown Result
  const breakdownList = Object.values(breakdownMap).sort((a, b) => {
      if (a.store !== b.store) return a.store.localeCompare(b.store);
      return b.net - a.net;
  });

  return {
    date: dateStr,
    data: reportData,
    totals: totalStats,
    breakdown: breakdownList
  };
}

function downloadDailyReportCSV(dateStr) {
  const report = getDailyReportData(dateStr);
  if (report.error) return { error: report.error };

  // Generate CSV String
  let csv = 'Rank,Store Location,Daily Sales,Qty,Reg,SMI,Avg Disc,Selling Cost,MDR,MTD Sales,Achv %\n';
  let rank = 1;

  report.data.forEach(s => {
    const store = String(s.store).replace(/"/g, '""');
    const avgDisc = (s.avgDisc * 100).toFixed(1) + '%';
    const mdr = (s.mdr * 100).toFixed(1) + '%';
    const achv = (s.achv * 100).toFixed(1) + '%';
    
    csv += `${rank},"${store}",${s.net},${s.qty},${s.reg},${s.smi},${avgDisc},${s.cost},${mdr},${s.mtd},${achv}\n`;
    rank++;
  });

  // Totals
  const t = report.totals;
  const tAvgDisc = (t.avgDisc * 100).toFixed(1) + '%';
  const tMdr = (t.mdr * 100).toFixed(1) + '%';
  const tAchv = (t.achv * 100).toFixed(1) + '%';
  
  csv += `\n,,${t.daily},${t.qty},${t.reg},${t.smi},${tAvgDisc},${t.cost},${tMdr},${t.mtd},${tAchv}\n`;

  csv += `\n\nInventory Sales\n`;
  csv += `Store,Main Category,Collection,Qty,Net Sales\n`;
  report.breakdown.forEach(b => {
    const store = String(b.store).replace(/"/g, '""');
    const cat = String(b.cat).replace(/"/g, '""');
    const coll = String(b.coll).replace(/"/g, '""');
    csv += `"${store}","${cat}","${coll}",${b.qty},${b.net}\n`;
  });

  const base64 = Utilities.base64Encode(csv, Utilities.Charset.UTF_8);
  return { base64: base64, filename: 'DailyReport_' + report.date + '.csv' };
}

function downloadDailyReportPDF(dateStr) {
  const report = getDailyReportData(dateStr);
  if (report.error) return { error: report.error };

  const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'decimal', minimumFractionDigits: 0 }).format(n);
  const formatPct = (n) => (n * 100).toFixed(1) + '%';
  
  const dateObj = new Date(report.date);
  const displayDate = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // HTML Construction for PDF
  let html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 15px; color: #333; font-size: 10px;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">
        <h2 style="margin: 0; color: #1e293b; text-transform: uppercase; font-size: 18px;">Daily Sales Report</h2>
        <div style="text-align: right;">
           <div style="font-size: 12px; font-weight: bold; color: #334155;">${displayDate}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f8fafc; color: #64748b; text-transform: uppercase;">
             <th style="padding: 10px 5px; text-align: left; font-weight: 800; border-bottom: 1px solid #e2e8f0;">Store Location</th>
             <th style="padding: 10px 5px; text-align: right; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0;">Daily Sales</th>
             <th style="padding: 10px 5px; text-align: center; font-weight: 800; border-bottom: 1px solid #e2e8f0;">Qty</th>
             <th style="padding: 10px 5px; text-align: center; font-weight: 800; border-bottom: 1px solid #e2e8f0;">Breakdown (Reg/SMI)</th>
             <th style="padding: 10px 5px; text-align: center; font-weight: 800; border-bottom: 1px solid #e2e8f0;">Avg Disc</th>
             <th style="padding: 10px 5px; text-align: right; font-weight: 800; color: #ef4444; border-bottom: 1px solid #e2e8f0;">Selling Cost</th>
             <th style="padding: 10px 5px; text-align: center; font-weight: 800; color: #ef4444; border-bottom: 1px solid #e2e8f0;">MDR</th>
             <th style="padding: 10px 5px; text-align: right; font-weight: 800; border-bottom: 1px solid #e2e8f0;">MTD Sales</th>
             <th style="padding: 10px 5px; text-align: center; font-weight: 800; border-bottom: 1px solid #e2e8f0;">Achv %</th>
          </tr>
        </thead>
        <tbody>`;

  report.data.forEach(s => {
    const mdrColor = s.mdr > 0 ? '#ef4444' : '#64748b';
    const achvColor = s.achv < 0.8 ? '#ef4444' : (s.achv >= 1 ? '#10b981' : '#f59e0b');
    
    html += `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 8px 5px; font-weight: 700; color: #334155;">${s.store}</td>
        <td style="padding: 8px 5px; text-align: right; font-weight: 800; color: #0f172a;">${formatIDR(s.net)}</td>
        <td style="padding: 8px 5px; text-align: center; color: #475569;">${s.qty}</td>
        <td style="padding: 8px 5px; text-align: center;">
            <span style="color: #3b82f6; font-weight: bold;">${s.reg} Reg</span> 
            <span style="color: #f59e0b; font-weight: bold; margin-left: 5px;">${s.smi} SMI</span>
        </td>
        <td style="padding: 8px 5px; text-align: center; color: #475569;">${formatPct(s.avgDisc)}</td>
        <td style="padding: 8px 5px; text-align: right; color: #ef4444; font-weight: 600;">${formatIDR(s.cost)}</td>
        <td style="padding: 8px 5px; text-align: center; color: ${mdrColor}; font-weight: 700;">${formatPct(s.mdr)}</td>
        <td style="padding: 8px 5px; text-align: right; color: #334155; font-weight: 600;">${formatIDR(s.mtd)}</td>
        <td style="padding: 8px 5px; text-align: center; color: ${achvColor}; font-weight: 800;">${formatPct(s.achv)}</td>
      </tr>`;
  });

  // Grand Total
  const t = report.totals;
  const tMdrColor = t.mdr > 0 ? '#ef4444' : '#64748b';
  
  html += `
        <tr style="background-color: #f8fafc; border-top: 2px solid #e2e8f0;">
             <td style="padding: 10px 5px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Grand Total</td>
             <td style="padding: 10px 5px; text-align: right; font-weight: 900; color: #2563eb; font-size: 11px;">${formatIDR(t.daily)}</td>
             <td style="padding: 10px 5px; text-align: center; font-weight: 900;">${t.qty}</td>
             <td style="padding: 10px 5px; text-align: center;"></td>
             <td style="padding: 10px 5px; text-align: center; font-weight: 800;">${formatPct(t.avgDisc)}</td>
             <td style="padding: 10px 5px; text-align: right; color: #ef4444; font-weight: 800;">${formatIDR(t.cost)}</td>
             <td style="padding: 10px 5px; text-align: center; color: ${tMdrColor}; font-weight: 900;">${formatPct(t.mdr)}</td>
             <td style="padding: 10px 5px; text-align: right; font-weight: 900; color: #0f172a; font-size: 11px;">${formatIDR(t.mtd)}</td>
             <td style="padding: 10px 5px; text-align: center; font-weight: 900; color: #0f172a;">${formatPct(t.achv)}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-bottom: 10px; border-bottom: 2px solid #f0f0f0; padding-bottom: 5px;">
        <h3 style="margin: 0; color: #1e293b; text-transform: uppercase; font-size: 14px;">Inventory Sales</h3>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
        <thead>
          <tr style="background-color: #f8fafc; color: #64748b; text-transform: uppercase;">
             <th style="padding: 8px 5px; text-align: left; font-weight: 800; border-bottom: 1px solid #e2e8f0;">Store</th>
             <th style="padding: 8px 5px; text-align: left; font-weight: 800; border-bottom: 1px solid #e2e8f0;">Main Category</th>
             <th style="padding: 8px 5px; text-align: left; font-weight: 800; border-bottom: 1px solid #e2e8f0;">Collection</th>
             <th style="padding: 8px 5px; text-align: center; font-weight: 800; border-bottom: 1px solid #e2e8f0;">Qty</th>
             <th style="padding: 8px 5px; text-align: right; font-weight: 800; border-bottom: 1px solid #e2e8f0;">Net Sales</th>
          </tr>
        </thead>
        <tbody>`;

  if (report.breakdown && report.breakdown.length > 0) {
    report.breakdown.forEach(b => {
      html += `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 6px 5px; font-weight: 700; color: #334155;">${b.store}</td>
          <td style="padding: 6px 5px; color: #475569;">${b.cat}</td>
          <td style="padding: 6px 5px; color: #64748b;">${b.coll}</td>
          <td style="padding: 6px 5px; text-align: center; font-weight: 600;">${b.qty}</td>
          <td style="padding: 6px 5px; text-align: right; font-weight: 700; color: #0f172a;">${formatIDR(b.net)}</td>
        </tr>`;
    });
  } else {
     html += `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #94a3b8;">No transactions found for this date.</td></tr>`;
  }

  html += `
        </tbody>
    </table>


  </div>`;

  const blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF);
  const base64 = Utilities.base64Encode(blob.getBytes());
  return { base64: base64, filename: 'DailyReport_' + report.date + '.pdf' };
}

// ==========================================
// --- CRM: PROSPECT DETAIL DATA ---
// ==========================================

/**
 * Mengambil data detail prospek dari sheet Traffic (eksternal).
 * Digunakan oleh halaman App Sheet (CRM).
 * @param {string} month - Nama bulan (January, February, dst)
 * @param {string} year - Tahun (2024, 2025, dst)
 * @param {string} location - Filter lokasi (kosong = semua)
 * @param {string} prospectLevel - Filter prospek level (kosong = semua)
 * @returns {Object} { rows: [...], locations: [...], prospectLevels: [...] }
 */
function getTrafficProspectData(month, year, location, prospectLevel, status) {
  try {
    const TCOL = CONFIG.EXTERNAL.TRAFFIC_COLS;
    const extSS = SpreadsheetApp.openById(CONFIG.EXTERNAL.PROFILING_SHEET_ID);
    const trafficSheet = extSS.getSheetByName(CONFIG.EXTERNAL.TRAFFIC_SHEET_NAME);
    if (!trafficSheet) throw new Error('Sheet Traffic tidak ditemukan.');

    const lastRow = trafficSheet.getLastRow();
    if (lastRow <= 1) return { rows: [], locations: [], prospectLevels: [], statuses: [] };

    const tData = trafficSheet.getRange(2, 1, lastRow - 1, trafficSheet.getLastColumn()).getValues();

    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];
    const targetMonthIdx = monthNames.indexOf(month);
    const targetYear = parseInt(year);

    const locationSet = new Set();
    const prospectSet = new Set();
    const statusSet = new Set();
    const filtered = [];

    tData.forEach(row => {
      let dateVal = row[TCOL.DATE];
      if (!dateVal) return;

      let d;
      try {
        d = new Date(dateVal);
        if (isNaN(d.getTime())) return;
      } catch (e) { return; }

      const rowYear = d.getFullYear();
      const rowMonth = d.getMonth();

      const loc = String(row[TCOL.LOCATION] || '').trim();
      const prospect = String(row[TCOL.PROSPECT] || '').trim();
      const rowStatus = String(row[TCOL.STATUS] || '').trim();

      if (loc) locationSet.add(loc);
      if (prospect) prospectSet.add(prospect);
      if (rowStatus) statusSet.add(rowStatus);

      // Filter by month & year
      if (rowYear !== targetYear || rowMonth !== targetMonthIdx) return;

      // Filter by location (if specified)
      if (location && location !== 'ALL' && loc !== location) return;

      // Filter by prospect level (if specified)
      if (prospectLevel && prospectLevel !== 'ALL' && prospect !== prospectLevel) return;

      // Filter by status kedatangan (if specified)
      if (status && status !== 'ALL' && rowStatus !== status) return;

      // Format date nicely
      const dayStr = String(d.getDate()).padStart(2, '0');
      const monStr = month.substring(0, 3);
      const dateFormatted = dayStr + ' ' + monStr + ' ' + rowYear;

      filtered.push({
        date: dateFormatted,
        name: String(row[TCOL.NAME] || '-').trim(),
        location: loc || '-',
        servedBy: String(row[TCOL.SERVED_BY] || '-').trim(),
        status: rowStatus || '-',
        prospectLevel: prospect || '-',
        netSales: Number(row[TCOL.NET_SALES]) || 0
      });
    });

    // Sort by date descending (most recent first)
    filtered.sort((a, b) => {
      const dA = new Date(a.date);
      const dB = new Date(b.date);
      return dB - dA;
    });

    return {
      rows: filtered,
      locations: Array.from(locationSet).sort(),
      prospectLevels: Array.from(prospectSet).sort(),
      statuses: Array.from(statusSet).sort()
    };
  } catch (e) {
    return { error: 'Gagal load data Traffic: ' + e.message, rows: [], locations: [], prospectLevels: [], statuses: [] };
  }
}

/**
 * Trigger Sinkronisasi Sales (SAP) ke Traffic
 * Dipanggil dari UI CRM Dashboard
 */
function triggerSyncSalesToTraffic() {
  return syncSalesToTraffic();
}

// ======================================================================
// STORE PERFORMANCE MODULE (ANNUAL DRILL-DOWN)
// ======================================================================

/**
 * Fetches annual (YTD) performance data for a specific store or ALL stores.
 * Includes YoY comparison, discount monitoring, category & advisor breakdown.
 * 
 * @param {string} storeName - "ALL", "Plaza Indonesia", "Plaza Senayan", or "Bali"
 * @param {string|number} year - Target year (e.g. "2026")
 * @returns {object} Store performance payload
 */
function getStorePerformanceData(storeName, year) {
  try {
    const ss = getSpreadsheet();
    const targetY = Number(year);
    const prevY = targetY - 1;
    
    // 1. Resolve sheet for current year
    let sheetName = CONFIG.SHEETS.CLEAN;
    const currentYear = new Date().getFullYear();
    if (targetY !== currentYear) {
      const archiveName = 'Clean_Data_' + targetY;
      if (ss.getSheetByName(archiveName)) sheetName = archiveName;
    }
    
    const cleanSheet = ss.getSheetByName(sheetName);
    if (!cleanSheet) throw new Error("Sheet '" + sheetName + "' tidak ditemukan.");
    
    const data = cleanSheet.getDataRange().getValues();
    data.shift();

    const COL = CONFIG.CLEAN_COLS;
    var filterStore = (!storeName || storeName === 'ALL') ? null : storeName.toLowerCase();

    // Structures for current year
    var monthlyTrend = new Array(12).fill(0);
    var monthlyQty = new Array(12).fill(0);
    var categoryMap = {};
    var advisorMap = {};
    var activeStoresSet = {};
    var transactionSet = {};
    
    var totalNet = 0, totalQty = 0, totalGross = 0, totalDisc = 0, totalCost = 0;

    // 2. Process current year data
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var d = parseDateFix(row[COL.DATE]);
      if (d.getFullYear() !== targetY) continue;

      var loc = String(row[COL.LOCATION]).trim();
      if (loc.toLowerCase().includes('head office')) continue;
      
      activeStoresSet[loc] = true;
      if (filterStore && loc.toLowerCase() !== filterStore) continue;

      var m = d.getMonth();
      var net = Number(row[COL.NET_SALES]) || 0;
      var qty = Number(row[COL.QTY]) || 0;
      var gross = Number(row[COL.GROSS]) || 0;
      var disc = Number(row[COL.VAL_DISC]) || 0;
      var cost = Number(row[COL.SELLING_COST]) || 0;
      var cat = String(row[COL.MAIN_CAT] || 'Other').trim();
      var adv = String(row[COL.SALESMAN] || 'Unknown').trim();
      var transNo = String(row[COL.TRANS_NO] || '');

      monthlyTrend[m] += net;
      monthlyQty[m] += qty;
      totalNet += net;
      totalQty += qty;
      totalGross += gross;
      totalDisc += disc;
      totalCost += cost;
      if (transNo) transactionSet[transNo] = true;

      if (!categoryMap[cat]) categoryMap[cat] = { net: 0, qty: 0 };
      categoryMap[cat].net += net;
      categoryMap[cat].qty += qty;

      if (!advisorMap[adv]) advisorMap[adv] = { net: 0, qty: 0, trans: 0 };
      advisorMap[adv].net += net;
      advisorMap[adv].qty += qty;
      advisorMap[adv].trans++;
    }

    // 3. Load advisor targets from master_sales_advisor
    var advSheet = ss.getSheetByName(CONFIG.SHEETS.MASTER_ADVISOR);
    if (advSheet) {
      var advData = advSheet.getDataRange().getValues();
      if (advData.length > 1) {
        var advHeaders = advData[0];
        // Find all month column indices for summing annual target
        var monthColIndices = [];
        var monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
        for (var ci = 0; ci < advHeaders.length; ci++) {
          var hStr = String(advHeaders[ci]).trim().toLowerCase();
          for (var mi = 0; mi < monthNames.length; mi++) {
            if (hStr === monthNames[mi] || hStr.startsWith(monthNames[mi])) {
              monthColIndices.push(ci);
              break;
            }
          }
        }
        
        for (var ai = 1; ai < advData.length; ai++) {
          var advRow = advData[ai];
          if (String(advRow[0]) != targetY) continue;
          var advName = String(advRow[1]).trim();
          var advLoc = String(advRow[3] || '').trim(); // Column D = Location
          var advKey = advName.toLowerCase();
          
          // Sum annual target across all month columns
          var annualAdvTarget = 0;
          for (var mci = 0; mci < monthColIndices.length; mci++) {
            annualAdvTarget += (Number(advRow[monthColIndices[mci]]) || 0);
          }
          
          // Match advisor
          var foundKey = null;
          for (var ak in advisorMap) {
            if (ak.toLowerCase() === advKey || ak.toLowerCase().includes(advKey)) {
              foundKey = ak;
              break;
            }
          }
          
          if (foundKey) {
            advisorMap[foundKey].target = annualAdvTarget;
            advisorMap[foundKey].location = advLoc;
          } else if (annualAdvTarget > 0) {
            advisorMap[advName] = { net: 0, qty: 0, trans: 0, target: annualAdvTarget, location: advLoc };
          }
        }
      }
    }

    // 4. YoY: Load previous year data
    var prevMonthlyTrend = new Array(12).fill(0);
    var prevTotalNet = 0;
    
    var prevSheetName = CONFIG.SHEETS.CLEAN;
    var prevArchive = 'Clean_Data_' + prevY;
    if (ss.getSheetByName(prevArchive)) {
      prevSheetName = prevArchive;
    }
    
    var prevSheet = ss.getSheetByName(prevSheetName);
    if (prevSheet) {
      var prevData = prevSheet.getDataRange().getValues();
      prevData.shift();
      for (var pi = 0; pi < prevData.length; pi++) {
        var pRow = prevData[pi];
        var pd = parseDateFix(pRow[COL.DATE]);
        if (pd.getFullYear() !== prevY) continue;
        var pLoc = String(pRow[COL.LOCATION]).trim();
        if (pLoc.toLowerCase().includes('head office')) continue;
        if (filterStore && pLoc.toLowerCase() !== filterStore) continue;
        
        var pNet = Number(pRow[COL.NET_SALES]) || 0;
        prevMonthlyTrend[pd.getMonth()] += pNet;
        prevTotalNet += pNet;
      }
    }

    // 5. Annual Target
    var totalTarget = getAnnualStoreTarget(ss, storeName, targetY);

    // 6. Monthly targets (for target line on chart)
    var monthlyTargets = getMonthlyStoreTargets(ss, storeName, targetY);

    // 7. Format output
    var transCount = Object.keys(transactionSet).length;
    var avgTransValue = transCount > 0 ? totalNet / transCount : 0;
    var discountPct = totalGross > 0 ? (totalDisc / totalGross) * 100 : 0;
    var costPct = totalGross > 0 ? (totalCost / totalGross) * 100 : 0;
    var yoyGrowth = prevTotalNet > 0 ? ((totalNet - prevTotalNet) / prevTotalNet) * 100 : 0;

    var catData = [];
    for (var ck in categoryMap) {
      catData.push({ name: ck, value: categoryMap[ck].net, qty: categoryMap[ck].qty });
    }
    catData.sort(function(a, b) { return b.value - a.value; });

    var advResults = [];
    for (var advk in advisorMap) {
      var av = advisorMap[advk];
      if (av.net === 0 && (!av.target || av.target === 0)) continue;
      var advAchv = av.target > 0 ? (av.net / av.target) * 100 : 0;
      advResults.push({
        name: advk,
        location: av.location || '',
        totalSales: av.net,
        qty: av.qty,
        trans: av.trans,
        target: av.target || 0,
        achievement: advAchv
      });
    }
    advResults.sort(function(a, b) { return b.totalSales - a.totalSales; });

    var storeList = Object.keys(activeStoresSet).sort();

    // 8. TRAFFIC DATA (from Traffic_Summary data mart — lightweight)
    var trafficTotal = 0, trafficBerhasil = 0, trafficGagal = 0;
    var trafficMenunggu = 0, trafficPotensial = 0, trafficNego = 0;
    try {
      var tsSheet = ss.getSheetByName(CONFIG.SHEETS.TRAFFIC_SUMMARY);
      if (tsSheet) {
        var tsData = tsSheet.getDataRange().getValues();
        tsData.shift(); // remove header
        for (var ti = 0; ti < tsData.length; ti++) {
          var tRow = tsData[ti];
          if (String(tRow[0]) != targetY) continue;
          
          var tLoc = String(tRow[2] || '').trim().toLowerCase();
          
          // Filter by store
          if (filterStore) {
            var matchStore = false;
            if (filterStore === 'plaza indonesia' && (tLoc.indexOf('plaza indonesia') !== -1 || tLoc === 'pi')) matchStore = true;
            if (filterStore === 'plaza senayan' && (tLoc.indexOf('plaza senayan') !== -1 || tLoc === 'ps')) matchStore = true;
            if (filterStore === 'bali' && tLoc.indexOf('bali') !== -1) matchStore = true;
            if (!matchStore) continue;
          } else {
            // Exclude unknown/empty for ALL
            if (!tLoc || tLoc === 'unknown') continue;
          }
          
          trafficBerhasil += Number(tRow[3]) || 0;
          trafficGagal += Number(tRow[4]) || 0;
          trafficMenunggu += Number(tRow[5]) || 0;
          trafficPotensial += Number(tRow[6]) || 0;
          trafficNego += Number(tRow[7]) || 0;
          trafficTotal += Number(tRow[8]) || 0;
        }
      }
    } catch (te) {
      Logger.log('Traffic_Summary load error: ' + te.message);
    }

    // 9. FOOTFALL DATA (from footfall_pi / footfall_ps — lightweight daily counts)
    var footfallTotal = 0;
    try {
      var footfallSheets = [];
      if (!filterStore || filterStore === 'plaza indonesia') {
        footfallSheets.push(CONFIG.SHEETS.FOOTFALL_PI);
      }
      if (!filterStore || filterStore === 'plaza senayan') {
        footfallSheets.push(CONFIG.SHEETS.FOOTFALL_PS);
      }
      if (!filterStore || filterStore === 'bali') {
        footfallSheets.push(CONFIG.SHEETS.FOOTFALL_BL);
      }
      
      for (var fi = 0; fi < footfallSheets.length; fi++) {
        var fSheet = ss.getSheetByName(footfallSheets[fi]);
        if (!fSheet) continue;
        var fData = fSheet.getDataRange().getValues();
        for (var fj = 1; fj < fData.length; fj++) {
          var fRow = fData[fj];
          var fDate = fRow[0];
          if (!fDate) continue;
          try {
            var fd = new Date(fDate);
            if (isNaN(fd.getTime())) continue;
            if (fd.getFullYear() !== targetY) continue;
            footfallTotal += parseInt(fRow[2]) || 0; // Col C = Masuk
          } catch (fe) { continue; }
        }
      }
    } catch (fte) {
      Logger.log('Footfall load error: ' + fte.message);
    }

    // 10. Efficiency Metrics
    var captureRate = footfallTotal > 0 ? (trafficTotal / footfallTotal) * 100 : 0;
    var conversionRate = trafficTotal > 0 ? (transCount / trafficTotal) * 100 : 0;
    var salesPerVisitor = footfallTotal > 0 ? totalNet / footfallTotal : 0;

    return {
      status: 'success',
      store: storeName || 'ALL',
      year: targetY,
      kpi: {
        totalSales: totalNet,
        totalQty: totalQty,
        annualTarget: totalTarget,
        achievement: totalTarget > 0 ? (totalNet / totalTarget) * 100 : 0,
        avgTransValue: avgTransValue,
        transCount: transCount,
        discountPct: discountPct,
        costPct: costPct,
        yoyGrowth: yoyGrowth,
        prevYearSales: prevTotalNet
      },
      efficiency: {
        footfall: footfallTotal,
        traffic: trafficTotal,
        captureRate: captureRate,
        conversionRate: conversionRate,
        salesPerVisitor: salesPerVisitor,
        trafficBreakdown: {
          berhasil: trafficBerhasil,
          gagal: trafficGagal,
          menunggu: trafficMenunggu,
          potensial: trafficPotensial,
          nego: trafficNego
        }
      },
      monthlyTrend: monthlyTrend,
      monthlyQtyTrend: monthlyQty,
      monthlyTargets: monthlyTargets,
      prevYearTrend: prevMonthlyTrend,
      prevYear: prevY,
      categoryStats: catData,
      advisorStats: advResults,
      availableStores: storeList
    };

  } catch (e) {
    Logger.log('getStorePerformanceData Error: ' + e.message);
    return { status: 'error', message: e.message };
  }
}

/**
 * Resolves ANNUAL target for specific store or full network.
 * Sums all monthly targets for the given year.
 */
function getAnnualStoreTarget(ss, storeName, year) {
  var sheet = ss.getSheetByName(CONFIG.SHEETS.MASTER_TARGET_STORE);
  if (!sheet) return 0;
  
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return 0;
  
  var headers = data[0];
  var totalTarget = 0;
  var filterStore = (!storeName || storeName === 'ALL') ? null : storeName.toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[0]) != year) continue;

    for (var j = 2; j < row.length; j++) {
      var colLoc = String(headers[j]).trim().toLowerCase();
      if (colLoc === 'head office') continue;
      if (!filterStore || colLoc === filterStore) {
        totalTarget += (Number(row[j]) || 0);
      }
    }
  }
  return totalTarget;
}

/**
 * Returns array[12] of monthly targets for a specific store or all stores.
 * Used to draw "target line" on the annual trend chart.
 * Supports both English and Indonesian month names in the sheet.
 */
function getMonthlyStoreTargets(ss, storeName, year) {
  var sheet = ss.getSheetByName(CONFIG.SHEETS.MASTER_TARGET_STORE);
  if (!sheet) return new Array(12).fill(0);
  
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return new Array(12).fill(0);
  
  var headers = data[0];
  var filterStore = (!storeName || storeName === 'ALL') ? null : storeName.toLowerCase();
  
  // Support both English and Indonesian month names
  var monthNamesEN = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  var monthNamesID = ['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
  var monthTargets = new Array(12).fill(0);

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[0]) != year) continue;
    
    var rowMonth = String(row[1]).trim().toLowerCase();
    var mIdx = -1;
    
    // Try English first
    for (var mi = 0; mi < monthNamesEN.length; mi++) {
      if (rowMonth === monthNamesEN[mi] || monthNamesEN[mi].startsWith(rowMonth) || rowMonth.startsWith(monthNamesEN[mi])) {
        mIdx = mi;
        break;
      }
    }
    
    // Fallback: try Indonesian
    if (mIdx === -1) {
      for (var mi2 = 0; mi2 < monthNamesID.length; mi2++) {
        if (rowMonth === monthNamesID[mi2] || monthNamesID[mi2].startsWith(rowMonth) || rowMonth.startsWith(monthNamesID[mi2])) {
          mIdx = mi2;
          break;
        }
      }
    }
    
    if (mIdx === -1) continue;
    
    for (var j = 2; j < row.length; j++) {
      var colLoc = String(headers[j]).trim().toLowerCase();
      if (colLoc === 'head office') continue;
      if (!filterStore || colLoc === filterStore) {
        monthTargets[mIdx] += (Number(row[j]) || 0);
      }
    }
  }
  return monthTargets;
}