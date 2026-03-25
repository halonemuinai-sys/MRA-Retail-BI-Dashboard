/**
 * File: 4-API_Dashboard.gs
 * Fetches required data for CRM global overview.
 */
function getCrmDashboardOverview(selectedMonth, selectedYear) {
  try {
    // 1. Fetch Supabase Data
    const trfRes = Supabase.get('mirror_traffic', '?select=transaction_date,location,prospect_item,net_sales&limit=100000');
    const proRes = Supabase.get('mirror_profiling', '?select=tanggal_input&limit=100000');
    const cleanRes = Supabase.get('clean_master', '?select=transaction_date,location,net_sales&limit=100000');
    
    // 2. Fetch Asal Klien (Domisili vs Luar Negeri) direct from Traffic Sheet (current month)
    let originLokal = 0;
    let originLuar = 0;
    try {
        const extSS = SpreadsheetApp.openById(CONFIG_CRM.PROFILING_SS_ID);
        const trfSheet = extSS.getSheetByName(CONFIG_CRM.T_SHEET_NAME);
        if (trfSheet) {
            const tData = trfSheet.getDataRange().getValues();
            const headers = tData[0] || [];
            let idxTgl = -1, idxLuar = -1;
            for(let j=0; j<headers.length; j++) {
                const h = String(headers[j]).trim().toLowerCase();
                if(h.includes('tanggal berkunjung') || h === 'tanggal') idxTgl = j;
                else if(h.includes('kewarganegaraan') || h.includes('luar nege')) idxLuar = j;
            }
            if (idxTgl > -1 && idxLuar > -1) {
                for (let i = 1; i < tData.length; i++) {
                    const row = tData[i];
                    let d = row[idxTgl];
                    if(d) {
                        let dateObj = (d instanceof Date) ? d : new Date(d);
                        if (!isNaN(dateObj.getTime()) && dateObj.getMonth() === selectedMonth && dateObj.getFullYear() === selectedYear) {
                             const kw = String(row[idxLuar] || '').trim().toLowerCase();
                             if (kw === 'wna' || kw === 'foreign' || kw === 'luar negeri') originLuar++;
                             else originLokal++; // Default to Lokal if empty or WNI
                        }
                    }
                }
            }
        }
    } catch(e) { /* ignore error, fallback to 0 */ }

    // 3. Process Mirror Traffic
    let monthlyTraffic = 0;
    let monthlySalesTransactions = 0;
    const locationSet = new Set();
    const storeTraffic = {};
    const storeSales = {}; 
    const dailyData = Array.from({length: 31}, () => ({}));
    const dailySalesData = Array.from({length: 31}, () => ({})); 
    const prospectSet = {};
    
    if (trfRes.success && trfRes.data) {
        trfRes.data.forEach(row => {
            if (!row.transaction_date) return;
            const d = new Date(row.transaction_date);
            if (isNaN(d.getTime())) return; 
            
            const m = d.getMonth();
            const y = d.getFullYear();
            const day = d.getDate(); // 1..31
            const loc = String(row.location || '').trim();
            const prospect = String(row.prospect_item || '').trim() || 'Undetected Level';
            const ns = Number(row.net_sales) || 0;
            
            if (loc && loc !== '-') locationSet.add(loc);
            
            if (m === selectedMonth && y === selectedYear) {
                monthlyTraffic++;
                if (ns > 0) monthlySalesTransactions++;
                
                if (loc) storeTraffic[loc] = (storeTraffic[loc] || 0) + 1;
                
                const dayIdx = day - 1;
                dailyData[dayIdx][loc] = (dailyData[dayIdx][loc] || 0) + 1;
                if (ns > 0) {
                    dailySalesData[dayIdx][loc] = (dailySalesData[dayIdx][loc] || 0) + 1;
                }
                
                prospectSet[prospect] = (prospectSet[prospect] || 0) + 1;
            }
        });
    }

    // 4. Process Clean Master for Sales KPIs
    if (cleanRes.success && cleanRes.data) {
        cleanRes.data.forEach(row => {
            if (!row.transaction_date) return;
            const d = new Date(row.transaction_date);
            if (isNaN(d.getTime())) return;
            if (d.getMonth() === selectedMonth && d.getFullYear() === selectedYear) {
                const loc = String(row.location || '').trim();
                const ns = Number(row.net_sales) || 0;
                if (loc && loc !== '-') {
                    locationSet.add(loc);
                    storeSales[loc] = (storeSales[loc] || 0) + ns;
                }
            }
        });
    }

    // 5. Process Profiling
    let monthlyProfiling = 0;
    if (proRes.success && proRes.data) {
        proRes.data.forEach(row => {
            if (!row.tanggal_input) return;
            const d = new Date(row.tanggal_input);
            if (isNaN(d.getTime())) return;
            if (d.getMonth() === selectedMonth && d.getFullYear() === selectedYear) monthlyProfiling++;
        });
    }

    // 6. VIP Birthdays (Top 3 Upcoming this week)
    let upcomingVipBdays = [];
    try {
        if (typeof getCrmBirthdayData === 'function') {
             const bData = getCrmBirthdayData();
             if(bData.success && bData.data) {
                  const closest = bData.data.filter(x => x.diffDays <= 7);
                  upcomingVipBdays = closest.slice(0, 3);
             }
        }
    } catch(e) {}

    const lastSyncStr = PropertiesService.getScriptProperties().getProperty('LAST_SUPABASE_SYNC') || 'Belum Pernah Sync';

    return {
      success: true,
      data: {
        totalTraffic: monthlyTraffic,
        totalSalesTransactions: monthlySalesTransactions,
        totalProfiling: monthlyProfiling,
        dailyChartData: dailyData,
        dailySalesData: dailySalesData,
        storeTraffic: storeTraffic,
        storeSales: storeSales,
        prospectData: prospectSet,
        clientOrigin: { lokal: originLokal, luar: originLuar },
        vipBirthdays: upcomingVipBdays,
        locations: Array.from(locationSet).sort(),
        lastSync: lastSyncStr
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Triggers both Traffic & Profiling Sync to Supabase consecutively
 * and registers the timestamp in ScriptProperties.
 */
function triggerGlobalSupabaseSync() {
    try {
        const trafficRes = syncTrafficToSupabase();
        const profilingRes = syncProfilingToSupabase();
        
        if (!trafficRes.success) throw new Error("Traffic Error: " + trafficRes.message);
        if (!profilingRes.success) throw new Error("Profiling Error: " + profilingRes.message);
        
        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd MMM yyyy HH:mm:ss");
        PropertiesService.getScriptProperties().setProperty('LAST_SUPABASE_SYNC', timestamp);
        
        return { 
            success: true, 
            message: `Berhasil tarik ${trafficRes.count} Traffic dan ${profilingRes.count} Profiling!`,
            lastSync: timestamp
        };
    } catch(e) {
        return { success: false, message: e.message };
    }
}
