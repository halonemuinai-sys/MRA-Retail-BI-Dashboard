/**
 * File: 5-API_Profiling.gs
 * Operations for the raw Extract Profiling view.
 */
function getCrmProfilingData() {
  try {
    const extSS = SpreadsheetApp.openById(CONFIG_CRM.PROFILING_SS_ID);
    const pSheet = extSS.getSheetByName('Form Profiling');
    if (!pSheet) return { success: false, message: 'Sheet Form Profiling tidak ditemukan!' };

    // Pakai getDisplayValues agar tanggal terformat dari gsheet
    const data = pSheet.getDataRange().getDisplayValues();
    if (data.length < 1) return { success: true, headers: [], rows: [] };

    // Ambil maksimal 12 kolom pertama agar tabel UI rapi
    const MAX_COLS = 12;
    const rawHeaders = data[0];
    const headers = [];
    const validColIndexes = [];
    
    for(let c = 0; c < rawHeaders.length && c < MAX_COLS; c++) {
      if(String(rawHeaders[c]).trim() !== '') {
        headers.push(String(rawHeaders[c]).trim());
        validColIndexes.push(c);
      }
    }

    const rows = [];
    for (let i = 1; i < data.length; i++) {
        if (!data[i][0]) continue; // Skip baris kosong yg gak ada tgl input
        
        let rowData = [];
        for(let idx of validColIndexes) {
           rowData.push(String(data[i][idx] || '').trim());
        }
        rows.push(rowData);
    }
    
    // Terbaru di atas
    rows.reverse();

    return { success: true, headers: headers, rows: rows };
  } catch(e) {
    return { success: false, message: 'Gagal tarik data Profiling: ' + e.message };
  }
}

/**
 * Pushes raw Profiling data from Google Sheets directly to Supabase mirror_profiling table
 */
function syncProfilingToSupabase() {
  try {
      const extSS = SpreadsheetApp.openById(CONFIG_CRM.PROFILING_SS_ID);
      const pSheet = extSS.getSheetByName(CONFIG_CRM.P_SHEET_NAME);
      if (!pSheet) throw new Error("Sheet Form Profiling not found.");
      
      const pData = pSheet.getDataRange().getValues();
      const payload = [];
      const headers = pData[0].map(h => String(h).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, ''));
      
      for (let i = 1; i < pData.length; i++) {
          const row = pData[i];
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
          Supabase.del('mirror_profiling', '?id=not.is.null'); // Delete existing mirror
          
          const BATCH_SIZE = 1000;
          for (let b = 0; b < payload.length; b += BATCH_SIZE) {
              Supabase.insert('mirror_profiling', payload.slice(b, b + BATCH_SIZE));
          }
      }
      
      return { success: true, count: payload.length, message: "Profiling data successfully mirrored to Supabase!" };
      
  } catch (e) {
      return { success: false, message: e.message };
  }
}
