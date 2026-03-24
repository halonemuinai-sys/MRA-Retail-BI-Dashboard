/**
 * File: 8-API_LiveTime.gs
 * Description: Directly aggregates Live Time matrices from Supabase with zero Google Sheet dependency.
 */

function getLiveTimeDashboardData() {
  try {
     const trfRes = Supabase.get('mirror_traffic', '?select=transaction_date,location,prospect_item&limit=100000');
     const proRes = Supabase.get('mirror_profiling', '?select=tanggal_input,lokasi_store&limit=100000');
     
     let totalProfiling = 0;
     let totalTraffic = 0;
     
     let storeTraffic = {};
     let prospectData = {};
     let yearlyMonthlyLocation = {};
     let yearlyMonthlyProfiling = {};
     
     if (trfRes.success && trfRes.data) {
         trfRes.data.forEach(row => {
             if (!row.transaction_date) return;
             const d = new Date(row.transaction_date);
             if (isNaN(d.getTime())) return;
             
             totalTraffic++;
             
             const y = d.getFullYear();
             const m = d.getMonth();
             const loc = String(row.location || '').trim();
             const prospect = String(row.prospect_item || '').trim() || 'Undefined';
             
             if (loc && loc !== '-') {
                 storeTraffic[loc] = (storeTraffic[loc] || 0) + 1;
                 const keyStr = `YM_${y}_${m}_${loc}`;
                 yearlyMonthlyLocation[keyStr] = (yearlyMonthlyLocation[keyStr] || 0) + 1;
             }
             
             if (prospect) {
                 prospectData[prospect] = (prospectData[prospect] || 0) + 1;
             }
         });
     }
     
     if (proRes.success && proRes.data) {
         proRes.data.forEach(row => {
             if (!row.tanggal_input) return;
             const d = new Date(row.tanggal_input);
             if (isNaN(d.getTime())) return;
             
             totalProfiling++;
             
             const y = d.getFullYear();
             const m = d.getMonth();
             const loc = String(row.lokasi_store || '').trim();
             
             if (loc && loc !== '-') {
                 const keyStr = `PM_${y}_${m}_${loc}`;
                 yearlyMonthlyProfiling[keyStr] = (yearlyMonthlyProfiling[keyStr] || 0) + 1;
             }
         });
     }

     const lastUpdate = PropertiesService.getScriptProperties().getProperty('LAST_SUPABASE_SYNC') || 'Belum Pernah Sync';

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

