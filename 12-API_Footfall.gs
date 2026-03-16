/**
 * RETAIL LUXURY WEB APP BACKEND
 * File: 12-API_Footfall.gs
 * Description: API untuk mengkalkulasi Footfall vs Traffic (Capture Rate)
 */

function getFootfallAnalytics(month, year) {
  try {
    const ss = getSpreadsheet();
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
        const dStr = row[0]; // Always Date in Col A
        if (!dStr) continue;
        
        let d = dStr;
        if (!(dStr instanceof Date)) {
           d = parseDateFix(dStr);
        }

        if(!d || isNaN(d.getTime())) continue;

        const rm = d.getMonth();
        const ry = d.getFullYear();
        if (targetMonth !== -1 && rm !== targetMonth) continue;
        if (targetYear !== -1 && ry !== targetYear) continue;
        
        const dateKey = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        initMapKey(dateKey);
        
        const count = parseInt(row[2]) || 0; // Col C is Masuk
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
            
            let d = dStr;
            if (!(dStr instanceof Date)) {
               d = parseDateFix(dStr);
            }
            if (!d || isNaN(d.getTime())) continue;

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
function getFootfallData(monthName, year) {
  try {
    const ss = getSpreadsheet();
    
    // Resolve the intended filter target
    const monthIndexTarget = new Date(`${monthName} 1, 2000`).getMonth();
    const targetYear = Number(year);
    
    // Result Structures
    const dailyTrend = new Array(31).fill(null).map(() => ({ PI_In: 0, PI_Out: 0, PS_In: 0, PS_Out: 0 }));
    let totalFootfallPI = 0;
    let totalFootfallPS = 0;
    
    let piMen = 0;   // Estimated count based on %
    let piWomen = 0; 
    let piDemographicDays = 0; // Days with demographic info
    
    // Debug tracer
    let parseLogs = [];
    
    // Helper to safely add daily numbers
    const trackDay = (d, store, inCount, outCount) => {
      const day = d.getDate() - 1;
      if (day >= 0 && day < 31) {
         if (store === 'PI') { dailyTrend[day].PI_In += inCount; dailyTrend[day].PI_Out += outCount; }
         if (store === 'PS') { dailyTrend[day].PS_In += inCount; dailyTrend[day].PS_Out += outCount; }
      }
    };
    
    // 1. Process PI Footfall
    const piSheet = ss.getSheetByName(CONFIG.SHEETS.FOOTFALL_PI);
    if (!piSheet) {
        Logger.log(`Sheet missing: ${CONFIG.SHEETS.FOOTFALL_PI}`);
    } else {
      const piData = piSheet.getDataRange().getValues();
      piData.shift(); // remove header
      
      piData.forEach((row, index) => {
         const rawDate = row[0];
         if (!rawDate) return;
         
         // Google Sheets often returns a native JS Date object if the column is formatted as Date.
         // If it's a string, we parse it.
         let d = rawDate;
         let parsedType = 'native';
         if (!(rawDate instanceof Date)) {
             d = parseDateFix(rawDate);
             parsedType = 'parsed';
         }
         
         // Only process valid dates mapping to target month/year
         if (d && !isNaN(d.getMonth())) {
           // Log the first 5 parsed dates from PI for debugging
           if (parseLogs.length < 5) {
               parseLogs.push(`[PI] Raw: ${rawDate}, Parsed: ${d.toISOString()}, Month: ${d.getMonth()}, Year: ${d.getFullYear()}, TargetM: ${monthIndexTarget}, TargetY: ${targetYear}`);
           }
           
           if (d.getMonth() === monthIndexTarget && d.getFullYear() === targetYear) {
              const fIn = Number(row[2]) || 0;
              const fOut = Number(row[3]) || 0;
              const pMen = parseFloat(row[5]) || 0; 
              const pWomen = parseFloat(row[6]) || 0;
              
              totalFootfallPI += fIn;
              trackDay(d, 'PI', fIn, fOut);
              
              if (pMen > 0 || pWomen > 0) {
                const totalOfDay = fIn; 
                piMen += (totalOfDay * (pMen / 100));
                piWomen += (totalOfDay * (pWomen / 100));
                piDemographicDays++;
              }
           }
         }
      });
    }
    
    // 2. Process PS Footfall
    const psSheet = ss.getSheetByName(CONFIG.SHEETS.FOOTFALL_PS);
    if (!psSheet) {
        Logger.log(`Sheet missing: ${CONFIG.SHEETS.FOOTFALL_PS}`);
    } else {
      const psData = psSheet.getDataRange().getValues();
      psData.shift(); // remove header
      
      psData.forEach((row, index) => {
         const rawDate = row[0];
         if (!rawDate) return;
         
         let d = rawDate;
         if (!(rawDate instanceof Date)) {
             d = parseDateFix(rawDate);
         }
         
         if (d && !isNaN(d.getMonth())) {
           if (d.getMonth() === monthIndexTarget && d.getFullYear() === targetYear) {
              const fIn = Number(row[2]) || 0; // Input
              const fOut = Number(row[3]) || 0; // Output
              
              totalFootfallPS += fIn;
              trackDay(d, 'PS', fIn, fOut);
           }
         }
      });
    }
    
    // Demographics Aggregation
    let finalMenPct = 0;
    let finalWomenPct = 0;
    const totalDemographicCalculated = piMen + piWomen;
    if (totalDemographicCalculated > 0) {
       finalMenPct = (piMen / totalDemographicCalculated) * 100;
       finalWomenPct = (piWomen / totalDemographicCalculated) * 100;
       
       const diff = 100 - (finalMenPct + finalWomenPct);
       if (diff !== 0) finalMenPct += diff; 
    }
    
    return {
      dailyTrend: dailyTrend,
      kpis: {
        totalPI: totalFootfallPI,
        totalPS: totalFootfallPS,
        combined: totalFootfallPI + totalFootfallPS
      },
      demographicsPI: {
        menPct: finalMenPct,
        womenPct: finalWomenPct
      },
      debug: {
        piRowsProcessed: piSheet ? piSheet.getLastRow() : 0,
        psRowsProcessed: psSheet ? psSheet.getLastRow() : 0,
        parseLogs: parseLogs
      }
    };
    
  } catch (e) {
    Logger.log("getFootfallData Error: " + e.message);
    return { error: "Footfall extraction failed: " + e.message };
  }
}
