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
      
      // DEBUG: Log header names supaya kita tahu nama kolom apa saja yang dikirim
      Logger.log('Generated headers: ' + JSON.stringify(headers));
      
      for (let i = 1; i < pData.length; i++) {
          const row = pData[i];
          const rowObj = {};
          let isEmptyLine = true;
          
          for (let j = 0; j < headers.length; j++) {
              if (headers[j]) {
                  let val = row[j];
                  if (val !== '' && val !== null && val !== undefined) {
                      isEmptyLine = false;
                      if (val instanceof Date) {
                          val = val.toISOString();
                      }
                      rowObj[headers[j]] = String(val);
                  } else {
                      rowObj[headers[j]] = ''; // Kirim string kosong, jangan skip
                  }
              }
          }
          
          if (!isEmptyLine) {
              payload.push(rowObj);
          }
      }
      
      if (payload.length === 0) {
          return { success: false, message: 'Tidak ada data yang ditemukan di Sheet.' };
      }
      
      // Step 1: Hapus data lama
      const delRes = Supabase.del('mirror_profiling', '?nama_lengkap=neq.XXXXXXXXX_IMPOSSIBLE');
      Logger.log('Delete result: ' + JSON.stringify(delRes));
      
      // Step 2: Insert per batch, TANGKAP dan LAPORKAN error jika ada
      const BATCH_SIZE = 500;
      let totalInserted = 0;
      const errors = [];
      
      for (let b = 0; b < payload.length; b += BATCH_SIZE) {
          const batch = payload.slice(b, b + BATCH_SIZE);
          const res = Supabase.upsert('mirror_profiling', batch);
          
          if (res.success) {
              totalInserted += batch.length;
          } else {
              Logger.log('Batch error at index ' + b + ': ' + JSON.stringify(res));
              errors.push('Batch ' + (b / BATCH_SIZE + 1) + ': ' + res.message);
          }
      }
      
      if (errors.length > 0) {
          return { success: false, message: 'Beberapa batch gagal: ' + errors.join(' | ') };
      }
      
      return { success: true, count: totalInserted, message: totalInserted + " baris Profiling berhasil dikirim ke Supabase!" };
      
  } catch (e) {
      return { success: false, message: e.message };
  }
}
