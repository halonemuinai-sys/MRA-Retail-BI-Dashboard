/**
 * RETAIL LUXURY WEB APP BACKEND
 * File: 12-API_Footfall.gs
 * Description: API untuk mengkalkulasi Footfall vs Traffic (Capture Rate)
 */

function getFootfallAnalytics(month, year) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const profilingId = CONFIG.EXTERNAL.PROFILING_SHEET_ID;
    const trafficSheetName = CONFIG.EXTERNAL.TRAFFIC_SHEET_NAME;
    
    // Dates bounds
    const mths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const mIdx = mths.indexOf(month);
    
    let targetMonth = -1;
    let targetYear = -1;
    if (month && month !== 'ALL') {
      targetMonth = mIdx;
    }
    if (year && year !== 'ALL') {
      targetYear = parseInt(year);
    }
    
    // Define a map for grouping by Date -> { footfallPI, footfallPS, trafficPI, trafficPS }
    const insightMap = {};
    
    // helper to initialize date key
    const initMapKey = (dateStr) => {
      if (!insightMap[dateStr]) {
        insightMap[dateStr] = {
           date: dateStr,
           footfallPI: 0,
           footfallPS: 0,
           trafficPI: 0,
           trafficPS: 0
        };
      }
    };

    const processFootfallSheet = (sheetName, locType) => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return;
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) return;
      
      const FCOL = CONFIG.EXTERNAL.FOOTFALL_COLS || { DATE: 0, COUNT: 1 };
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const dStr = row[FCOL.DATE];
        if (!dStr) continue;
        
        let d;
        if (dStr instanceof Date) {
          d = dStr;
        } else {
           // Handle string dates cautiously
           d = new Date(dStr);
           if(isNaN(d.getTime())) {
             // Try parsing 'dd/mm/yyyy' or similar if needed. For now assume valid dates.
             continue;
           }
        }

        const rm = d.getMonth();
        const ry = d.getFullYear();
        if (targetMonth !== -1 && rm !== targetMonth) continue;
        if (targetYear !== -1 && ry !== targetYear) continue;
        
        const dateKey = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        initMapKey(dateKey);
        
        const count = parseInt(row[FCOL.COUNT]) || 0;
        if (locType === 'PI') insightMap[dateKey].footfallPI += count;
        if (locType === 'PS') insightMap[dateKey].footfallPS += count;
      }
    };

    processFootfallSheet(CONFIG.SHEETS.FOOTFALL_PI, 'PI');
    processFootfallSheet(CONFIG.SHEETS.FOOTFALL_PS, 'PS');

    // 2. Process Traffic Sheet
    const extSS = SpreadsheetApp.openById(profilingId);
    const trfSheet = extSS.getSheetByName(trafficSheetName);
    if (trfSheet) {
        const tData = trfSheet.getDataRange().getValues();
        const TCOL = CONFIG.EXTERNAL.TRAFFIC_COLS;
        
        for (let i = 1; i < tData.length; i++) {
            const row = tData[i];
            const dStr = row[TCOL.DATE];
            if (!dStr) continue;
            
            let d;
            if (dStr instanceof Date) {
              d = dStr;
            } else {
               d = new Date(dStr);
               if(isNaN(d.getTime())) continue;
            }

            const rm = d.getMonth();
            const ry = d.getFullYear();
            if (targetMonth !== -1 && rm !== targetMonth) continue;
            if (targetYear !== -1 && ry !== targetYear) continue;

            const dateKey = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            initMapKey(dateKey);
            
            const loc = String(row[TCOL.LOCATION] || '').toUpperCase();
            const groupSize = parseInt(row[TCOL.GROUP_SIZE]) || parseInt(row[14]) || 1; // Fallback to 1 if no size
            
            if (loc.indexOf('PLAZA INDONESIA') !== -1 || loc === 'PI') {
                insightMap[dateKey].trafficPI += groupSize;
            } else if (loc.indexOf('PLAZA SENAYAN') !== -1 || loc === 'PS') {
                insightMap[dateKey].trafficPS += groupSize;
            }
        }
    }

    // Convert map to array and compute rates
    const chartData = [];
    const keys = Object.keys(insightMap).sort();
    
    for (const key of keys) {
        const item = insightMap[key];
        
        const ratePIStr = item.footfallPI > 0 ? ((item.trafficPI / item.footfallPI) * 100).toFixed(1) : 0;
        const ratePSStr = item.footfallPS > 0 ? ((item.trafficPS / item.footfallPS) * 100).toFixed(1) : 0;
        
        item.ratePI = parseFloat(ratePIStr);
        item.ratePS = parseFloat(ratePSStr);
        
        chartData.push(item);
    }

    return {
        status: 'success',
        data: chartData
    };

  } catch (error) {
    console.error("Footfall Analytics Error: " + error.message);
    return { status: 'error', message: error.message, data: [] };
  }
}
