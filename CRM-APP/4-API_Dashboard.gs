/**
 * File: 4-API_Dashboard.gs
 * Fetches required data for CRM global overview.
 */
function getCrmDashboardOverview(selectedMonth, selectedYear) {
  try {
    // Jalankan 2 Fetch ke Supabase 
    // Data yang ditarik HANYA kolom yang dibutuhkan agar memory tidak jebol
    const trfRes = Supabase.get('mirror_traffic', '?select=transaction_date,location,prospect_item&limit=100000');
    const proRes = Supabase.get('mirror_profiling', '?select=tanggal_input&limit=100000');
    
    let monthlyTraffic = 0;
    const locationSet = new Set();
    const storeTraffic = {};
    const dailyData = Array.from({length: 31}, () => ({}));
    const prospectSet = {};
    
    if (trfRes.success && trfRes.data) {
        trfRes.data.forEach(row => {
            if (!row.transaction_date) return;
            const d = new Date(row.transaction_date);
            if (isNaN(d.getTime())) return; // invalid date
            
            const m = d.getMonth();
            const y = d.getFullYear();
            const day = d.getDate(); // 1..31
            const loc = String(row.location || '').trim();
            const prospect = String(row.prospect_item || '').trim() || 'Undetected Level';
            
            if (loc && loc !== '-') locationSet.add(loc);
            
            if (m === selectedMonth && y === selectedYear) {
                monthlyTraffic++;
                
                if (loc) storeTraffic[loc] = (storeTraffic[loc] || 0) + 1;
                
                const dayIdx = day - 1;
                dailyData[dayIdx][loc] = (dailyData[dayIdx][loc] || 0) + 1;
                
                prospectSet[prospect] = (prospectSet[prospect] || 0) + 1;
            }
        });
    }

    let monthlyProfiling = 0;
    if (proRes.success && proRes.data) {
        proRes.data.forEach(row => {
            if (!row.tanggal_input) return;
            const d = new Date(row.tanggal_input);
            if (isNaN(d.getTime())) return;
            
            if (d.getMonth() === selectedMonth && d.getFullYear() === selectedYear) {
                monthlyProfiling++;
            }
        });
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
