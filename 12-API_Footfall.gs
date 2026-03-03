/**
 * File: 12-API_Footfall.gs
 * Description: Dedicated logic to handle Footfall extraction
 */

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
