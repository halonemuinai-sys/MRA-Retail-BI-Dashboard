/**
 * File: 9-API_Advisor.gs
 * Description: Backend endpoint to aggregate Top Performing Client Advisors.
 */

function getTopAdvisorPerformance(month, year) {
  try {
     const extSS = SpreadsheetApp.openById(CONFIG_CRM.PROFILING_SS_ID);
     const tSheet = extSS.getSheetByName(CONFIG_CRM.T_SHEET_NAME);
     const pSheet = extSS.getSheetByName(CONFIG_CRM.P_SHEET_NAME);
     
     if(!tSheet || !pSheet) return { success: false, message: 'Spreadsheet sumber tidak ditemukan.' };
     
     const m = parseInt(month);
     const y = parseInt(year);
     
     // 1. Data Traffic
     const tData = tSheet.getDataRange().getValues();
     const tCols = CONFIG_CRM.COLS.T; // date=11(L), served=5(F), status=7(H), prospect=17(R)
     
     let advisorStats = {};
     let grandTotalTraffic = 0;
     let grandTotalBerhasil = 0;
     let grandTotalGagal = 0;
     
     for (let i = 1; i < tData.length; i++) {
         const row = tData[i];
         const dateVal = row[tCols.DATE];
         if(!dateVal) continue;
         
         const d = new Date(dateVal);
         if(isNaN(d.getTime())) continue;
         
         if(d.getFullYear() === y && d.getMonth() === m) {
             const advName = String(row[tCols.SERVED_BY] || '').trim();
             if(!advName || advName === '-' || advName.toLowerCase() === 'n/a') continue; // abaikan baris tanpa PIC
             
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
             
             const prospectLvl = String(row[tCols.PROSPECT] || '').toLowerCase();
             if(prospectLvl.includes('berhasil')) { stat.levelBerhasil++; grandTotalBerhasil++; }
             else if(prospectLvl.includes('gagal')) { stat.levelGagal++; grandTotalGagal++; }
             else stat.levelLain++;
             
             const statusStr = String(row[tCols.STATUS] || '').toLowerCase();
             if(statusStr.includes('walk')) stat.walkIn++;
             else if(statusStr.includes('follow') || statusStr.includes('wa')) stat.followUp++;
             else if(statusStr.includes('online')) stat.online++;
             else if(statusStr.includes('delivery') || statusStr.includes('showing')) stat.deliveryShowing++;
             else if(statusStr.includes('repair') || statusStr.includes('service')) stat.service++;
         }
     }
     
     // 2. Data Profiling
     const pData = pSheet.getDataRange().getValues();
     let grandTotalProfiling = 0;
     for (let i = 1; i < pData.length; i++) {
         const row = pData[i];
         const dateVal = row[0]; // Timestamp input
         if(!dateVal) continue;
         
         const d = new Date(dateVal);
         if(isNaN(d.getTime())) continue;
         if(d.getFullYear() === y && d.getMonth() === m) {
             const rowStr = row.join(' ').toLowerCase();
             // Kita cocokkan nama advisor jika disebut di dalam row Form Profiling
             for (const adv in advisorStats) {
                 if (rowStr.includes(adv.toLowerCase())) {
                     advisorStats[adv].profiling++;
                     grandTotalProfiling++;
                 }
             }
         }
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
