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
      const headers = trfData[0].map(h => String(h).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, ''));
      
      for (let i = 1; i < trfData.length; i++) {
          const row = trfData[i];
          const rowObj = {};
          let isEmptyLine = true;
          
          for (let j = 0; j < headers.length; j++) {
              if (headers[j]) {
                  let val = row[j];
                  if (val !== '' && val !== null) {
                      isEmptyLine = false;
                      // Handle JS Dates to IsoString for Postgres
                      if (val instanceof Date) {
                          val = val.toISOString();
                      }
                      rowObj[headers[j]] = val;
                  }
              }
          }
          
          if (!isEmptyLine) {
              payload.push(rowObj);
          }
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
