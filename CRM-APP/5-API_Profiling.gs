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
