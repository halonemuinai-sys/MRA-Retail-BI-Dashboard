/**
 * File: 9-API_Advisor.gs
 * Description: Backend endpoint to aggregate Top Performing Client Advisors.
 */

function getTopAdvisorPerformance(month, year) {
  try {
     const m = parseInt(month);
     const y = parseInt(year);
     
     // Fetch directly from Supabase
     const trfRes = Supabase.get('mirror_traffic', '?select=transaction_date,served_by,prospect_item,status&limit=100000');
     const proRes = Supabase.get('mirror_profiling', '?select=tanggal_input,customer_advisor&limit=100000');
     
     if(!trfRes.success || !proRes.success) {
         return { success: false, message: 'Gagal terhubung ke Supabase Node.' };
     }
     
     let advisorStats = {};
     let grandTotalTraffic = 0;
     let grandTotalBerhasil = 0;
     let grandTotalGagal = 0;
     
     // 1. Data Traffic
     if (trfRes.data) {
         trfRes.data.forEach(row => {
             if (!row.transaction_date) return;
             const d = new Date(row.transaction_date);
             if (isNaN(d.getTime())) return;
             
             if(d.getFullYear() === y && d.getMonth() === m) {
                 const advName = String(row.served_by || '').trim();
                 if(!advName || advName === '-' || advName.toLowerCase() === 'n/a') return; // Abaikan baris kosong
                 
                 // Gunakan Capitalized Name sebagai Key agar Tampilan UI Bagus
                 if(!advisorStats[advName]) {
                     advisorStats[advName] = { 
                         name: advName, traffic: 0, profiling: 0, 
                         levelBerhasil: 0, levelGagal: 0, levelLain: 0,
                         walkIn: 0, followUp: 0, online: 0, deliveryShowing: 0, service: 0 
                     };
                 }
                 
                 const stat = advisorStats[advName];
                 stat.traffic++;
                 grandTotalTraffic++;
                 
                 const prospectLvl = String(row.prospect_item || '').toLowerCase();
                 if(prospectLvl.includes('berhasil')) { stat.levelBerhasil++; grandTotalBerhasil++; }
                 else if(prospectLvl.includes('gagal')) { stat.levelGagal++; grandTotalGagal++; }
                 else stat.levelLain++;
                 
                 const statusStr = String(row.status || '').toLowerCase();
                 if(statusStr.includes('walk')) stat.walkIn++;
                 else if(statusStr.includes('follow') || statusStr.includes('wa')) stat.followUp++;
                 else if(statusStr.includes('online')) stat.online++;
                 else if(statusStr.includes('delivery') || statusStr.includes('showing')) stat.deliveryShowing++;
                 else if(statusStr.includes('repair') || statusStr.includes('service')) stat.service++;
             }
         });
     }
     
     // 2. Data Profiling
     let grandTotalProfiling = 0;
     if (proRes.data) {
         proRes.data.forEach(row => {
             if (!row.tanggal_input) return;
             const d = new Date(row.tanggal_input);
             if (isNaN(d.getTime())) return;
             
             if(d.getFullYear() === y && d.getMonth() === m) {
                 const profilingAdv = String(row.customer_advisor || '').trim().toLowerCase();
                 if (!profilingAdv) return;
                 
                 // Cocokkan nama advisor yang ada di Stats
                 for (const adv in advisorStats) {
                     if (profilingAdv.includes(adv.toLowerCase())) {
                         advisorStats[adv].profiling++;
                         grandTotalProfiling++;
                         break; // Cegah double count jika nama substring
                     }
                 }
             }
         });
     }
     
     // 3. Konversi dan Kalkulasi
     let resultList = [];
     for(const adv in advisorStats) {
         const stat = advisorStats[adv];
         stat.contrib = grandTotalTraffic > 0 ? ((stat.traffic / grandTotalTraffic) * 100) : 0;
         stat.successRate = stat.traffic > 0 ? ((stat.levelBerhasil / stat.traffic) * 100) : 0;
         resultList.push(stat);
     }
     
     // Sort by Traffic highest by default
     resultList.sort((a,b) => b.traffic - a.traffic);
     
     return { 
         success: true, 
         data: resultList, 
         summary: { 
             totalTraffic: grandTotalTraffic, 
             totalBerhasil: grandTotalBerhasil,
             totalGagal: grandTotalGagal,
             totalProfiling: grandTotalProfiling
         } 
     };
     
  } catch(e) { 
      return { success: false, message: e.message }; 
  }
}
