/**
 * File: 2-API_Traffic.gs
 * Handles Traffic data operations (fetching for Dashboard & Syncing to Supabase)
 */

/**
 * Pushes raw traffic data from Google Sheets directly to Supabase mirror table
 */
function syncTrafficToSupabase() {
  try {
      const extSS = SpreadsheetApp.openById(CONFIG_CRM.PROFILING_SS_ID);
      const trfSheet = extSS.getSheetByName(CONFIG_CRM.T_SHEET_NAME);
      if (!trfSheet) throw new Error("Traffic Sheet not found.");
      
      const trfData = trfSheet.getDataRange().getValues();
      const COL = CONFIG_CRM.COLS.T;
      
      const payload = [];
      const headers = trfData[0] || [];
      
      // Dinamis pencarian indeks kolom tanpa perlu hardcode di Config
      let idxRepair = -1, idxSiapa = -1, idxAkses = -1, idxTgl = -1, idxRentang = -1;
      for (let j = 0; j < headers.length; j++) {
          const h = String(headers[j]).trim().toLowerCase();
          if (h.includes('repair charge')) idxRepair = j;
          else if (h === 'siapa' || h.includes('siapa')) idxSiapa = j;
          else if (h.includes('akses masuk')) idxAkses = j;
          else if (h.includes('tanggal berkunjung')) idxTgl = j;
          else if (h.includes('rentang waktu')) idxRentang = j;
      }
      
      for (let i = 1; i < trfData.length; i++) {
          const row = trfData[i];
          
          let dateVal = row[COL.DATE];
          if (!dateVal) continue;
          
          let d = new Date(dateVal);
          if (isNaN(d.getTime())) continue;
          
          const name = String(row[COL.NAME] || '').trim();
          if (!name) continue;
          
          payload.push({
              transaction_date: d.toISOString(),
              customer_name: name,
              served_by: String(row[COL.SERVED_BY] || ''),
              location: String(row[COL.LOCATION] || ''),
              status: String(row[COL.STATUS] || ''),
              prospect_item: String(row[COL.PROSPECT] || ''),
              gross_sales: Number(row[COL.GROSS]) || 0,
              disc_pct: Number(row[COL.DISC_PCT]) || 0,
              val_disc: Number(row[COL.VAL_DISC]) || 0,
              net_sales: Number(row[COL.NET_SALES]) || 0,
              repair_charge: idxRepair > -1 ? String(row[idxRepair] || '') : '',
              siapa: idxSiapa > -1 ? String(row[idxSiapa] || '') : '',
              akses_masuk: idxAkses > -1 ? String(row[idxAkses] || '') : '',
              tanggal_berkunjung: idxTgl > -1 ? String(row[idxTgl] || '') : '',
              rentang_waktu: idxRentang > -1 ? String(row[idxRentang] || '') : ''
          });
      }
      
      if (payload.length > 0) {
          Supabase.del('mirror_traffic', '?id=not.is.null'); // Delete existing mirror
          
          const BATCH_SIZE = 1000;
          for (let b = 0; b < payload.length; b += BATCH_SIZE) {
              Supabase.insert('mirror_traffic', payload.slice(b, b + BATCH_SIZE));
          }
      }
      
      return { success: true, count: payload.length, message: "Traffic data successfully mirrored to Supabase!" };
      
  } catch (e) {
      return { success: false, message: e.message };
  }
}

/**
 * Fetches recent traffic records for the Traffic Dashboard
 */
function getCrmTrafficData() {
  try {
      const extSS = SpreadsheetApp.openById(CONFIG_CRM.PROFILING_SS_ID);
      const trfSheet = extSS.getSheetByName(CONFIG_CRM.T_SHEET_NAME);
      if (!trfSheet) throw new Error("Traffic Sheet not found.");
      
      const trfData = trfSheet.getDataRange().getValues();
      const COL = CONFIG_CRM.COLS.T;
      
      let out = [];
      // Grab the last 500 rows for dashboard speed
      const startIdx = Math.max(1, trfData.length - 500);
      
      for (let i = trfData.length - 1; i >= startIdx; i--) {
          const row = trfData[i];
          const dateVal = row[COL.DATE];
          if (!dateVal) continue;
          
          let dStr = '';
          try { dStr = Utilities.formatDate(new Date(dateVal), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'); }
          catch(e) { dStr = String(dateVal); }
          
          out.push({
              date: dStr,
              clientName: String(row[COL.NAME] || '-'),
              servedBy: String(row[COL.SERVED_BY] || '-'),
              status: String(row[COL.STATUS] || '-'),
              prospect: String(row[COL.PROSPECT] || '-'),
              location: String(row[COL.LOCATION] || '-')
          });
      }
      
      return { success: true, data: out };
  } catch (e) {
      return { success: false, message: e.message };
  }
}
