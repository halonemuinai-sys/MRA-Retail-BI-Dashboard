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
    let debugLogs = { pi_rows: 0, ps_rows: 0, bl_rows: 0, trf_rows: 0 };
    
    // helper to initialize date key
    const initMapKey = (dateStr) => {
      if (!insightMap[dateStr]) {
        insightMap[dateStr] = {
           date: dateStr,
           footfallPI: 0,
           footfallPS: 0,
           footfallBL: 0,
           trafficPI: 0,
           trafficPS: 0,
           trafficBL: 0
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
        
        if (locType === 'PI') debugLogs.pi_rows++;
        if (locType === 'PS') debugLogs.ps_rows++;
        if (locType === 'BL') debugLogs.bl_rows++;

        let d;
        try {
            d = new Date(dStr);
            if (isNaN(d.getTime())) continue;
        } catch (e) { continue; }

        const rm = d.getMonth();
        const ry = d.getFullYear();
        if (targetMonth !== -1 && rm !== targetMonth) continue;
        if (targetYear !== -1 && ry !== targetYear) continue;
        
        const dateKey = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        initMapKey(dateKey);
        
        const count = parseInt(row[2]) || 0; // Col C is Masuk
        if (locType === 'PI') insightMap[dateKey].footfallPI += count;
        if (locType === 'PS') insightMap[dateKey].footfallPS += count;
        if (locType === 'BL') insightMap[dateKey].footfallBL += count;
      }
    };

    processFootfallSheet(CONFIG.SHEETS.FOOTFALL_PI, 'PI');
    processFootfallSheet(CONFIG.SHEETS.FOOTFALL_PS, 'PS');
    processFootfallSheet(CONFIG.SHEETS.FOOTFALL_BL, 'BL');

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
            
            debugLogs.trf_rows++;
            
            let d;
            try {
                d = new Date(dStr);
                if (isNaN(d.getTime())) continue;
            } catch (e) { continue; }

            const rm = d.getMonth();
            const ry = d.getFullYear();
            if (targetMonth !== -1 && rm !== targetMonth) continue;
            if (targetYear !== -1 && ry !== targetYear) continue;

            const dateKey = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            initMapKey(dateKey);
            
            const loc = String(row[TCOL.LOCATION] || '').toUpperCase();
            const groupSize = parseInt(row[TCOL.GROUP_SIZE]) || 1; // Fallback to 1 if empty/NaN
            
            if (loc.indexOf('PLAZA INDONESIA') !== -1 || loc === 'PI') {
                insightMap[dateKey].trafficPI += groupSize;
            } else if (loc.indexOf('PLAZA SENAYAN') !== -1 || loc === 'PS') {
                insightMap[dateKey].trafficPS += groupSize;
            } else if (loc.indexOf('BALI') !== -1 || loc === 'BL' || loc.indexOf('BALI BOUTIQUE') !== -1) {
                insightMap[dateKey].trafficBL += groupSize;
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
        const rateBLStr = item.footfallBL > 0 ? ((item.trafficBL / item.footfallBL) * 100).toFixed(1) : 0;
        
        item.ratePI = parseFloat(ratePIStr);
        item.ratePS = parseFloat(ratePSStr);
        item.rateBL = parseFloat(rateBLStr);
        
        chartData.push(item);
    }

    return {
        status: 'success',
        data: chartData,
        debug: {
            targetM: targetMonth,
            targetY: targetYear,
            piRowsEvaluated: debugLogs.pi_rows || 0,
            psRowsEvaluated: debugLogs.ps_rows || 0,
            blRowsEvaluated: debugLogs.bl_rows || 0,
            trfRowsEvaluated: debugLogs.trf_rows || 0
        }
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
    const dailyTrend = new Array(31).fill(null).map(() => ({ PI_In: 0, PI_Out: 0, PS_In: 0, PS_Out: 0, BL_In: 0, BL_Out: 0 }));
    let totalFootfallPI = 0;
    let totalFootfallPS = 0;
    let totalFootfallBL = 0;
    
    let piMen = 0;   // Estimated count based on %
    let piWomen = 0; 
    let piDemographicDays = 0; // Days with demographic info

    let blMen = 0;
    let blWomen = 0;
    let blDemographicDays = 0;
    
    // Debug tracer
    let parseLogs = [];
    
    // Helper to safely add daily numbers
    const trackDay = (d, store, inCount, outCount) => {
      const day = d.getDate() - 1;
      if (day >= 0 && day < 31) {
         if (store === 'PI') { dailyTrend[day].PI_In += inCount; dailyTrend[day].PI_Out += outCount; }
         if (store === 'PS') { dailyTrend[day].PS_In += inCount; dailyTrend[day].PS_Out += outCount; }
         if (store === 'BL') { dailyTrend[day].BL_In += inCount; dailyTrend[day].BL_Out += outCount; }
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

    // 3. Process BL Footfall
    const blSheet = ss.getSheetByName(CONFIG.SHEETS.FOOTFALL_BL);
    if (!blSheet) {
        Logger.log(`Sheet missing: ${CONFIG.SHEETS.FOOTFALL_BL}`);
    } else {
      const blData = blSheet.getDataRange().getValues();
      blData.shift(); // remove header
      
      blData.forEach((row, index) => {
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
              const pMen = parseFloat(row[5]) || 0; 
              const pWomen = parseFloat(row[6]) || 0;
              
              totalFootfallBL += fIn;
              trackDay(d, 'BL', fIn, fOut);

              if (pMen > 0 || pWomen > 0) {
                const totalOfDay = fIn; 
                blMen += (totalOfDay * (pMen / 100));
                blWomen += (totalOfDay * (pWomen / 100));
                blDemographicDays++;
              }
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

    let finalBlMenPct = 0;
    let finalBlWomenPct = 0;
    const totalBlDemographic = blMen + blWomen;
    if (totalBlDemographic > 0) {
       finalBlMenPct = (blMen / totalBlDemographic) * 100;
       finalBlWomenPct = (blWomen / totalBlDemographic) * 100;
       
       const diff = 100 - (finalBlMenPct + finalBlWomenPct);
       if (diff !== 0) finalBlMenPct += diff; 
    }
    
    return {
      dailyTrend: dailyTrend,
      kpis: {
        totalPI: totalFootfallPI,
        totalPS: totalFootfallPS,
        totalBL: totalFootfallBL,
        combined: totalFootfallPI + totalFootfallPS + totalFootfallBL
      },
      demographicsPI: {
        menPct: finalMenPct,
        womenPct: finalWomenPct
      },
      demographicsBL: {
        menPct: finalBlMenPct,
        womenPct: finalBlWomenPct
      },
      debug: {
        piRowsProcessed: piSheet ? piSheet.getLastRow() : 0,
        psRowsProcessed: psSheet ? psSheet.getLastRow() : 0,
        blRowsProcessed: blSheet ? blSheet.getLastRow() : 0,
        parseLogs: parseLogs
      }
    };
    
  } catch (e) {
    Logger.log("getFootfallData Error: " + e.message);
    return { error: "Footfall extraction failed: " + e.message };
  }
}

/**
 * ======================================================================
 * FOOTFALL CAPTURE RATE EMAIL REPORT
 * ======================================================================
 * Triggered from Footfall (CRM) UI - "Send Email" button.
 * Builds professional HTML email with KPIs + daily table. Attaches CSV.
 */
function sendFootfallCaptureRateEmail(month, year) {
  try {
    var result = getFootfallAnalytics(month, year);
    if (!result || result.status === 'error') {
      return { success: false, message: 'Gagal mengambil data: ' + (result ? result.message : 'empty response') };
    }
    var data = result.data || [];
    if (data.length === 0) {
      return { success: false, message: 'Tidak ada data Footfall untuk periode ini.' };
    }

    var sumFF_PI = 0, sumCRM_PI = 0, sumFF_PS = 0, sumCRM_PS = 0, sumFF_BL = 0, sumCRM_BL = 0;
    data.forEach(function(item) {
      sumFF_PI  += item.footfallPI  || 0;
      sumCRM_PI += item.trafficPI   || 0;
      sumFF_PS  += item.footfallPS  || 0;
      sumCRM_PS += item.trafficPS   || 0;
      sumFF_BL  += item.footfallBL  || 0;
      sumCRM_BL += item.trafficBL   || 0;
    });

    var ratePI = sumFF_PI > 0 ? ((sumCRM_PI / sumFF_PI) * 100).toFixed(1) : '0.0';
    var ratePS = sumFF_PS > 0 ? ((sumCRM_PS / sumFF_PS) * 100).toFixed(1) : '0.0';
    var rateBL = sumFF_BL > 0 ? ((sumCRM_BL / sumFF_BL) * 100).toFixed(1) : '0.0';
    var totalFF = sumFF_PI + sumFF_PS + sumFF_BL;
    var totalCRM = sumCRM_PI + sumCRM_PS + sumCRM_BL;
    var totalRate = totalFF > 0 ? ((totalCRM / totalFF) * 100).toFixed(1) : '0.0';

    // CSV Attachment
    var csvContent = '\uFEFFDate,PI Footfall,PI Captured,PI Rate (%),PS Footfall,PS Captured,PS Rate (%),BL Footfall,BL Captured,BL Rate (%)\n';
    data.forEach(function(row) {
      csvContent += row.date + ',' + row.footfallPI + ',' + row.trafficPI + ',' + row.ratePI + ',' + row.footfallPS + ',' + row.trafficPS + ',' + row.ratePS + ',' + row.footfallBL + ',' + row.trafficBL + ',' + row.rateBL + '\n';
    });
    var csvBlob = Utilities.newBlob(csvContent, 'text/csv', 'Footfall_CaptureRate_' + month + '_' + year + '.csv');

    // Styles (Removed unused inline styles)

    var rc = function(r) { var v = parseFloat(r); if (v >= 50) return '#059669'; if (v >= 30) return '#2563eb'; return '#dc2626'; };
    var fn = function(n) { return Number(n).toLocaleString('id-ID'); };

    // Reduce HTML size by using a central <style> block instead of heavy inline styling
    var html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; color: #333; margin: 0; padding: 0; background: #f9fafb; }
        .wrap { max-width: 660px; margin: 0 auto; background: #fff; }
        .hdr { background: #0f4c3a; border-bottom: 3px solid #10b981; width: 100%; border-collapse: collapse; }
        .hdr td { padding: 26px 28px; }
        .h-title { color: #fff; font-size: 19px; font-weight: 700; margin: 0 0 4px 0; }
        .h-sub { color: #a7f3d0; font-size: 12px; margin: 0; }
        .h-rate { color: #fff; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -1px; text-align: right; }
        .h-rate-sub { color: #a7f3d0; font-size: 10px; margin: 2px 0 0; text-transform: uppercase; letter-spacing: 1px; text-align: right; }
        .content { padding: 24px 28px; }
        .t-head { padding: 9px 12px; border: 1px solid #d6e4f0; color: #1a3a5c; background: #e8f0fe; font-size: 11px; font-weight: 600; text-transform: uppercase; }
        .t-cell { padding: 8px 12px; border: 1px solid #d6e4f0; font-size: 12px; }
        .num { text-align: right; }
        .b { font-weight: 600; }
        .tbl { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .t-crm { color: #4f46e5; font-weight: 600; }
        .sec-t { font-size: 14px; font-weight: 600; color: #1a3a5c; text-transform: uppercase; margin: 0 0 12px 0; }
      </style>
    </head>
    <body>
    <div class="wrap">
      <table class="hdr">
        <tr>
          <td>
            <p class="h-title">Footfall &amp; Capture Rate Report</p>
            <p class="h-sub">Period: ${month} ${year} &mdash; Bvlgari Indonesia</p>
          </td>
          <td>
            <p class="h-rate">${totalRate}%</p>
            <p class="h-rate-sub">Overall Capture</p>
          </td>
        </tr>
      </table>
      <div class="content">
        <p style="font-size:13px;line-height:1.6;margin:0 0 24px 0;">
          Dear All,<br><br>
          Berikut adalah laporan <b>Footfall Capture Rate</b> untuk periode <b>${month} ${year}</b>. 
          Total <b>${fn(totalFF)}</b> pengunjung melalui door counter, 
          dan <b>${fn(totalCRM)}</b> di-capture oleh advisor (<b>${totalRate}%</b> overall capture rate).
        </p>

        <p class="sec-t">Store Performance</p>
        <table class="tbl">
          <tr>
            <th class="t-head" style="text-align:left;">Store</th>
            <th class="t-head num">Footfall</th>
            <th class="t-head num">Captured (CRM)</th>
            <th class="t-head num">Rate</th>
          </tr>
          <tr>
            <td class="t-cell">Plaza Indonesia</td>
            <td class="t-cell num b">${fn(sumFF_PI)}</td>
            <td class="t-cell num t-crm">${fn(sumCRM_PI)}</td>
            <td class="t-cell num b" style="color:${rc(ratePI)};">${ratePI}%</td>
          </tr>
          <tr style="background:#f5f8fc;">
            <td class="t-cell">Plaza Senayan</td>
            <td class="t-cell num b">${fn(sumFF_PS)}</td>
            <td class="t-cell num t-crm">${fn(sumCRM_PS)}</td>
            <td class="t-cell num b" style="color:${rc(ratePS)};">${ratePS}%</td>
          </tr>
          <tr style="background:#eef2ff;">
            <td class="t-cell">Bali</td>
            <td class="t-cell num b">${fn(sumFF_BL)}</td>
            <td class="t-cell num t-crm">${fn(sumCRM_BL)}</td>
            <td class="t-cell num b" style="color:${rc(rateBL)};">${rateBL}%</td>
          </tr>
          <tr style="background:#eef2ff;">
            <td class="t-cell" style="font-weight:700;">TOTAL</td>
            <td class="t-cell num b">${fn(totalFF)}</td>
            <td class="t-cell num" style="color:#4f46e5;font-weight:700;">${fn(totalCRM)}</td>
            <td class="t-cell num" style="font-weight:800;font-size:14px;color:${rc(totalRate)};">${totalRate}%</td>
          </tr>
        </table>

        <p class="sec-t">Daily Breakdown</p>
        <table class="tbl">
          <tr>
            <th class="t-head" style="text-align:left;" rowspan="2">Date</th>
            <th class="t-head" style="text-align:center;background:#e0f2e8;color:#065f46;" colspan="3">Plaza Indonesia</th>
            <th class="t-head" style="text-align:center;background:#fef3c7;color:#92400e;" colspan="3">Plaza Senayan</th>
            <th class="t-head" style="text-align:center;background:#e0f2fe;color:#0369a1;" colspan="3">Bali</th>
          </tr>
          <tr>
            <th class="t-head num" style="font-size:8px;padding:4px 6px;">Door</th>
            <th class="t-head num" style="font-size:8px;padding:4px 6px;">CRM</th>
            <th class="t-head num" style="font-size:8px;padding:4px 6px;">Rate</th>
            <th class="t-head num" style="font-size:8px;padding:4px 6px;">Door</th>
            <th class="t-head num" style="font-size:8px;padding:4px 6px;">CRM</th>
            <th class="t-head num" style="font-size:8px;padding:4px 6px;">Rate</th>
            <th class="t-head num" style="font-size:8px;padding:4px 6px;">Door</th>
            <th class="t-head num" style="font-size:8px;padding:4px 6px;">CRM</th>
            <th class="t-head num" style="font-size:8px;padding:4px 6px;">Rate</th>
          </tr>`;

    // Process daily rows concisely
    data.forEach(function(item, idx) {
      var bg = idx % 2 !== 0 ? 'background:#f5f8fc;' : '';
      var dL = item.date;
      try {
        var d = new Date(item.date);
        if (!isNaN(d.getTime())) {
          dL = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          if (d.getDay() === 0 || d.getDay() === 6) dL = '<span style="color:#dc2626;font-weight:bold;">' + dL + '</span>';
        }
      } catch(e) {}

      html += `
          <tr style="${bg}">
            <td class="t-cell" style="white-space:nowrap;">${dL}</td>
            <td class="t-cell num">${item.footfallPI}</td>
            <td class="t-cell num t-crm">${item.trafficPI}</td>
            <td class="t-cell num b" style="color:${rc(item.ratePI)};">${item.ratePI}%</td>
            <td class="t-cell num">${item.footfallPS}</td>
            <td class="t-cell num t-crm">${item.trafficPS}</td>
            <td class="t-cell num b" style="color:${rc(item.ratePS)};">${item.ratePS}%</td>
            <td class="t-cell num">${item.footfallBL}</td>
            <td class="t-cell num t-crm">${item.trafficBL}</td>
            <td class="t-cell num b" style="color:${rc(item.rateBL)};">${item.rateBL}%</td>
          </tr>`;
    });

    html += `
          <tr style="background:#eef2ff;font-weight:700;">
            <td class="t-cell">TOTAL</td>
            <td class="t-cell num">${fn(sumFF_PI)}</td>
            <td class="t-cell num" style="color:#4f46e5;">${fn(sumCRM_PI)}</td>
            <td class="t-cell num" style="color:${rc(ratePI)};">${ratePI}%</td>
            <td class="t-cell num">${fn(sumFF_PS)}</td>
            <td class="t-cell num" style="color:#4f46e5;">${fn(sumCRM_PS)}</td>
            <td class="t-cell num" style="color:${rc(ratePS)};">${ratePS}%</td>
            <td class="t-cell num">${fn(sumFF_BL)}</td>
            <td class="t-cell num" style="color:#4f46e5;">${fn(sumCRM_BL)}</td>
            <td class="t-cell num" style="color:${rc(rateBL)};">${rateBL}%</td>
          </tr>
        </table>
        
        <p style="font-size:11px;color:#9ca3af;margin:8px 0 0 0;"><em>Detail terlampir di file CSV.</em></p>
        <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:24px;">
          <p style="font-size:11px;color:#9ca3af;margin:0;line-height:1.5;">
            Generated by Bvlgari Dashboard<br>
            ${new Date().toLocaleString('id-ID')} &mdash; MRA Retail
          </p>
        </div>
      </div>
    </div>
    </body>
    </html>`;

    // Send
    var recipients = CONFIG.EMAIL_RECIPIENTS;
    if (!recipients || recipients.length === 0) {
      logEmailActivity('Footfall Rate Report', `${month} ${year}`, 'None', 'FAILED: No Config');
      return { success: false, message: 'Tidak ada email penerima di Config.' };
    }

    MailApp.sendEmail({
      to: recipients.join(','),
      subject: 'Footfall Capture Rate Report - ' + month + ' ' + year + ' | Bvlgari Indonesia',
      htmlBody: html
    });

    logEmailActivity('Footfall Rate Report', `${month} ${year}`, recipients.join(','), 'SUCCESS');
    return { success: true, message: 'Report berhasil dikirim ke ' + recipients.join(', ') };

  } catch (e) {
    console.error('sendFootfallCaptureRateEmail Error: ' + e.message);
    logEmailActivity('Footfall Rate Report', 'Unknown', 'Unknown', `ERROR: ${e.message}`);
    return { success: false, message: e.message };
  }
}

/**
 * =====================================================
 * TEST FUNCTIONS - Jalankan dari Apps Script Editor
 * =====================================================
 */

/**
 * TEST 1: Kirim email Footfall report lengkap
 * Pilih fungsi ini di dropdown editor → Run
 * Jika pertama kali, akan minta otorisasi → Klik "Review Permissions" → Allow
 */
function manualTestFootfallEmail() {
  var result = sendFootfallCaptureRateEmail('Maret', '2026');
  Logger.log('=== RESULT ===');
  Logger.log(JSON.stringify(result));
}

/**
 * TEST 2: Kirim email sederhana untuk verify MailApp permission 
 * Jika ini berhasil tapi TEST 1 gagal, berarti masalah di data/logic
 * Jika ini juga gagal, berarti masalah permission MailApp
 */
function testEmailPermission() {
  try {
    var quota = MailApp.getRemainingDailyQuota();
    Logger.log('Email quota remaining: ' + quota);
    
    if (quota <= 0) {
      Logger.log('ERROR: No email quota left!');
      return;
    }
    
    MailApp.sendEmail({
      to: CONFIG.EMAIL_RECIPIENTS[0],
      subject: '[TEST] Footfall Email Permission Test',
      htmlBody: '<h2>Test Email Berhasil</h2><p>MailApp sudah ter-otorisasi. Timestamp: ' + new Date().toLocaleString('id-ID') + '</p>'
    });
    
    Logger.log('SUCCESS: Test email sent to ' + CONFIG.EMAIL_RECIPIENTS[0]);
  } catch (e) {
    Logger.log('ERROR: ' + e.message);
  }
}

