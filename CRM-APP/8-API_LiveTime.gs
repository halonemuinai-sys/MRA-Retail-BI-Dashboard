/**
 * File: 8-API_LiveTime.gs
 * Manages the Live Extraction sheet calculating lifetime metrics.
 */

// Writes massive real-time reads into a single tiny Extraction summary sheet
function buildLiveTimeExtraction() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG_CRM.PROFILING_SS_ID);
    
    // 1. Get Total Profiling & Aggregate
    const pSheet = ss.getSheetByName(CONFIG_CRM.P_SHEET_NAME);
    let totalProfiling = 0;
    let yearlyMonthlyProfiling = {};
    if (pSheet) {
       const pData = pSheet.getDataRange().getValues();
       totalProfiling = Math.max(0, pData.length - 1); // asumsi baris 1 header
       for(let i = 1; i < pData.length; i++){
           const row = pData[i];
           const dateVal = row[0]; // Timestamp
           const loc = String(row[CONFIG_CRM.COLS.P.STORE] || '').trim();
           if(dateVal && loc && loc !== '-') {
               let d = new Date(dateVal);
               if(!isNaN(d.getTime())){
                   const y = d.getFullYear();
                   const m = d.getMonth();
                   const keyStr = `PM_${y}_${m}_${loc}`;
                   yearlyMonthlyProfiling[keyStr] = (yearlyMonthlyProfiling[keyStr] || 0) + 1;
               }
           }
       }
    }

    // 2. Get Total Traffic & Aggregate
    const tSheet = ss.getSheetByName(CONFIG_CRM.T_SHEET_NAME);
    let totalTraffic = 0;
    let storeTraffic = {};
    let prospectData = {};
    let yearlyMonthlyLocation = {};
    
    if (tSheet) {
       const tData = tSheet.getDataRange().getValues();
       totalTraffic = Math.max(0, tData.length - 1);
       
       for (let i = 1; i < tData.length; i++) {
           const row = tData[i];
           const loc = String(row[CONFIG_CRM.COLS.T.LOCATION] || '').trim();
           const prospect = String(row[CONFIG_CRM.COLS.T.PROSPECT] || '').trim() || 'Undefined';
           const dateVal = row[CONFIG_CRM.COLS.T.DATE];
           
           if (loc && loc !== '-') storeTraffic[loc] = (storeTraffic[loc] || 0) + 1;
           if (prospect) prospectData[prospect] = (prospectData[prospect] || 0) + 1;
           
           if (dateVal && loc && loc !== '-') {
               let d = new Date(dateVal);
               if (!isNaN(d.getTime())) {
                   const y = d.getFullYear();
                   const m = d.getMonth(); // 0-based
                   const keyStr = `YM_${y}_${m}_${loc}`;
                   yearlyMonthlyLocation[keyStr] = (yearlyMonthlyLocation[keyStr] || 0) + 1;
               }
           }
       }
    }

    // 3. Save to LIVE_SHEET_NAME 
    let liveSheet = ss.getSheetByName(CONFIG_CRM.LIVE_SHEET_NAME);
    if (!liveSheet) {
        liveSheet = ss.insertSheet(CONFIG_CRM.LIVE_SHEET_NAME);
    } else {
        liveSheet.clear();
    }

    // Header array map
    const nowStr = new Date().toLocaleString('id-ID');
    
    // Siapkan array data untuk disimpan sekaligus (super cepat)
    let batchData = [
       ['MetricKey', 'MetricValue', 'Category'],
       ['LAST_UPDATE', nowStr, 'SYSTEM'],
       ['TOTAL_PROFILING', totalProfiling, 'GLOBAL'],
       ['TOTAL_TRAFFIC', totalTraffic, 'GLOBAL']
    ];
    
    // Store aggs
    for (const loc in storeTraffic) {
        batchData.push(['LOC_' + loc, storeTraffic[loc], 'LOCATION']);
    }
    
    // Prospect aggs
    for (const p in prospectData) {
        batchData.push(['PROSP_' + p, prospectData[p], 'PROSPECT']);
    }

    // Matrix aggs
    for (const k in yearlyMonthlyLocation) {
        batchData.push([k, yearlyMonthlyLocation[k], 'MATRIX']);
    }
    
    // Profiling Matrix aggs
    for (const k in yearlyMonthlyProfiling) {
        batchData.push([k, yearlyMonthlyProfiling[k], 'PMATRIX']);
    }

    // Eksekusi penulisan 1x tembak (100x lebih cepat dari appendRow di dalam loop)
    liveSheet.getRange(1, 1, batchData.length, 3).setValues(batchData);
    liveSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#1e293b").setFontColor("white");

    return { 
       success: true, 
       message: 'Extraction complete.', 
       totalProfiling, 
       totalTraffic, 
       storeTraffic, 
       prospectData,
       lastUpdate: nowStr,
       locations: Object.keys(storeTraffic).sort(),
       monthlyMatrix: yearlyMonthlyLocation,
       monthlyProfiling: yearlyMonthlyProfiling
    };

  } catch (e) {
    return { success: false, message: e.message };
  }
}

// Lightweight reader for the UI, only extracts the tiny sheet!
function getLiveTimeDashboardData() {
  try {
     const ss = SpreadsheetApp.openById(CONFIG_CRM.PROFILING_SS_ID);
     const liveSheet = ss.getSheetByName(CONFIG_CRM.LIVE_SHEET_NAME);
     
     if (!liveSheet) {
         // Re-build target if missing
         return buildLiveTimeExtraction();
     }

     const data = liveSheet.getDataRange().getValues();
     if (data.length <= 1) return buildLiveTimeExtraction();

     let totalProfiling = 0;
     let totalTraffic = 0;
     let storeTraffic = {};
     let prospectData = {};
     let yearlyMonthlyLocation = {};
     let yearlyMonthlyProfiling = {};
     let lastUpdate = '';

     for (let i = 1; i < data.length; i++) {
         const key = String(data[i][0]);
         const val = data[i][1];
         const cat = String(data[i][2]);

         if (key === 'LAST_UPDATE') lastUpdate = val;
         else if (key === 'TOTAL_PROFILING') totalProfiling = parseInt(val) || 0;
         else if (key === 'TOTAL_TRAFFIC') totalTraffic = parseInt(val) || 0;
         else if (cat === 'LOCATION') {
             storeTraffic[key.replace('LOC_', '')] = parseInt(val) || 0;
         }
         else if (cat === 'PROSPECT') {
             prospectData[key.replace('PROSP_', '')] = parseInt(val) || 0;
         }
         else if (cat === 'MATRIX') {
             yearlyMonthlyLocation[key] = parseInt(val) || 0;
         }
         else if (cat === 'PMATRIX') {
             yearlyMonthlyProfiling[key] = parseInt(val) || 0;
         }
     }

     return {
         success: true,
         totalProfiling,
         totalTraffic,
         storeTraffic,
         prospectData,
         lastUpdate,
         locations: Object.keys(storeTraffic).sort(),
         monthlyMatrix: yearlyMonthlyLocation,
         monthlyProfiling: yearlyMonthlyProfiling
     };

  } catch(e) {
     return { success: false, message: e.message };
  }
}
