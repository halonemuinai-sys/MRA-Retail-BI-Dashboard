/**
 * File: 4-API_Dashboard.gs
 * Fetches required data for CRM global overview.
 */
function getCrmDashboardOverview(selectedMonth, selectedYear) {
  try {
    const extSS = SpreadsheetApp.openById(CONFIG_CRM.PROFILING_SS_ID);
    
    // 1. Process Traffic Data
    const trfSheet = extSS.getSheetByName(CONFIG_CRM.T_SHEET_NAME);
    const trfData = trfSheet ? trfSheet.getDataRange().getValues() : [];
    
    let monthlyTraffic = 0;
    
    const locationSet = new Set();
    const storeTraffic = {};
    
    // array of 31 days for Daily Area Chart
    const dailyData = Array.from({length: 31}, () => ({}));
    const prospectSet = {};
    
    for (let index = 1; index < trfData.length; index++) {
        const row = trfData[index];
        const dateVal = row[CONFIG_CRM.COLS.T.DATE];
        const loc = String(row[CONFIG_CRM.COLS.T.LOCATION] || '').trim();
        const prospect = String(row[CONFIG_CRM.COLS.T.PROSPECT] || '').trim() || 'Undetected Level';
        
        if (!dateVal) continue;
        
        let d = new Date(dateVal);
        if (isNaN(d.getTime())) continue; // invalid date
        
        const m = d.getMonth();
        const y = d.getFullYear();
        const day = d.getDate(); // 1..31
        
        if (loc && loc !== '-') locationSet.add(loc);
        
        if (m === selectedMonth && y === selectedYear) {
            monthlyTraffic++;
            
            // Store specific stats
            if (loc) storeTraffic[loc] = (storeTraffic[loc] || 0) + 1;
            
            // Daily Chart Data (0-indexed)
            const dayIdx = day - 1;
            dailyData[dayIdx][loc] = (dailyData[dayIdx][loc] || 0) + 1;
            
            // Funnel Stats
            prospectSet[prospect] = (prospectSet[prospect] || 0) + 1;
        }
    }
    
    // 2. Process Profiling Data
    const pSheet = extSS.getSheetByName(CONFIG_CRM.P_SHEET_NAME);
    const pData = pSheet ? pSheet.getDataRange().getValues() : [];
    
    let monthlyProfiling = 0;
    for (let index = 1; index < pData.length; index++) {
        const row = pData[index];
        let dateVal = row[CONFIG_CRM.COLS.P.DATE];
        if (!dateVal) dateVal = row[0]; // fallback to timestamp
        if (!dateVal) continue;
        
        let d = new Date(dateVal);
        if (isNaN(d.getTime())) continue; // invalid date
        
        const m = d.getMonth();
        const y = d.getFullYear();
        if (m === selectedMonth && y === selectedYear) {
            monthlyProfiling++;
        }
    }

    return {
      success: true,
      data: {
        totalTraffic: monthlyTraffic,
        totalProfiling: monthlyProfiling,
        dailyChartData: dailyData,
        storeTraffic: storeTraffic,
        prospectData: prospectSet,
        locations: Array.from(locationSet).sort()
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
