/**
 * CRM DATA PROCESSING APP
 * File: Code.gs
 * Backend API untuk Portal CRM Bvlgari.
 */

const CONFIG_CRM = {
  APP_TITLE: "Bvlgari CRM Portal",
  CRM_SS_ID: "1jXh-Rnj9fRuKD8U7Y4jWdwheMH47TVfcXhRxnWnSu3g",
  PROFILING_SS_ID: "17dIze7RwnA4nqxCVRbTeDIDlwCmW1OvgXQ9zMOM-ovM",
  CLEAN_TARGET_SS_ID: "1jRFK1jPuK_-pVvJYNx1PbvDEJaeAK4ZUZ0QTxWJsxwQ",
  CLEAN_SHEET_NAME: "clean_master",
  P_SHEET_NAME: "Form Profiling",
  T_SHEET_NAME: "Traffic",
  COLS: {
    P: { NAME: 4, PHONE: 16, STORE: 7 },
    T: { NAME: 2, DATE: 11, SERVED_BY: 5, LOCATION: 6, GROSS: 32, DISC_PCT: 33, VAL_DISC: 34, NET_SALES: 35 },
    C: { CUSTOMER: 2, DATE: 1, SALESMAN: 3, LOCATION: 4, GROSS: 8, DISC_PCT: 9, VAL_DISC: 10, NET_SALES: 14, PHONE: 19, HOME_LOCATION: 18 }
  }
};

// ============================
// WEB APP ENTRY POINT
// ============================
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(CONFIG_CRM.APP_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Fungsi wajib untuk memasukkan modul HTML (Css, Js, Menu)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================
// API: DATABASE INITIALIZATION
// ============================
/**
 * Jalankan fungsi ini 1x (Run dari editor Apps Script) 
 * untuk membuat "Sheet Login" secara otomatis.
 */
function setupCRMSheets() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG_CRM.CRM_SS_ID);
    
    // 1. Buat Sheet Users
    let userSheet = ss.getSheetByName('Users');
    if (!userSheet) {
      userSheet = ss.insertSheet('Users');
      userSheet.appendRow(['Username', 'Password', 'FullName', 'Role', 'IsActive']);
      // Data super-admin default
      userSheet.appendRow(['crm_admin', 'admin123', 'Super CRM', 'Admin', 'TRUE']);
      userSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#1e293b").setFontColor("white");
      userSheet.setFrozenRows(1);
    }

    // 2. Buat Sheet Data Log / Audit (opsional untuk rekam jejak)
    let logSheet = ss.getSheetByName('Logs');
    if (!logSheet) {
      logSheet = ss.insertSheet('Logs');
      logSheet.appendRow(['Timestamp', 'Username', 'Action', 'Target ID', 'Status']);
      logSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#1e293b").setFontColor("white");
      logSheet.setFrozenRows(1);
    }

    return "Setup Database CRM Berhasil! Cek Spreadsheet Anda.";
  } catch(e) {
    return "Gagal Setup: " + e.message;
  }
}

// ============================
// API: AUTHENTICATION
// ============================
function doCrmLogin(username, password) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG_CRM.CRM_SS_ID);
    const userSheet = ss.getSheetByName('Users');
    
    if (!userSheet) {
      return { success: false, message: 'Database Belum Di-Setup (Jalankan setupCRMSheets)' };
    }

    const data = userSheet.getDataRange().getValues();
    if (data.length <= 1) return { success: false, message: 'Belum ada pengguna terdaftar.' };

    for (let i = 1; i < data.length; i++) {
      const dbUser = String(data[i][0] || '').trim();
      const dbPass = String(data[i][1] || '').trim();
      const dbName = String(data[i][2] || '').trim();
      const dbRole = String(data[i][3] || '').trim();
      const isActive = String(data[i][4] || '').trim().toUpperCase() === 'TRUE';

      // Cek kredensial
      if (dbUser === username && dbPass === password) {
        if (!isActive) return { success: false, message: 'Akun Anda dinonaktifkan oleh pusat.' };
        return { success: true, user: { name: dbName, role: dbRole } };
      }
    }
    
    return { success: false, message: 'Username atau Password salah!' };
  } catch (err) {
    return { success: false, message: 'Error DB: ' + err.message };
  }
}

// ============================
// API: DASHBOARD DATA
// ============================
// ============================
// API: DASHBOARD DATA
// ============================
function getCrmDashboardOverview(selectedMonth, selectedYear) {
  try {
    const extSS = SpreadsheetApp.openById(CONFIG_CRM.PROFILING_SS_ID);
    
    // 1. Process Traffic Data
    const trfSheet = extSS.getSheetByName(CONFIG_CRM.T_SHEET_NAME);
    const trfData = trfSheet ? trfSheet.getDataRange().getValues() : [];
    
    let monthlyTraffic = 0;
    
    // Prepare structures for Chart: array of 12 months, each is an object mapping location -> count
    const chartData = [{},{},{},{},{},{},{},{},{},{},{},{}];
    const locationSet = new Set();
    
    for (let index = 1; index < trfData.length; index++) {
        const row = trfData[index];
        const dateVal = row[CONFIG_CRM.COLS.T.DATE];
        const loc = String(row[CONFIG_CRM.COLS.T.LOCATION] || '').trim();
        if (!dateVal) continue;
        
        let d = new Date(dateVal);
        if (isNaN(d.getTime())) continue; // invalid date
        
        const m = d.getMonth();
        const y = d.getFullYear();
        
        if (loc && loc !== '-') locationSet.add(loc);
        
        // Populate chart data untuk sepanjang tahun yang dipilih
        if (y === selectedYear) {
            chartData[m][loc] = (chartData[m][loc] || 0) + 1;
        }
        
        // Hitung Total Traffic bulan berjalan saja
        if (m === selectedMonth && y === selectedYear) {
            monthlyTraffic++;
        }
    }
    
    // 2. Process Profiling Data
    const pSheet = extSS.getSheetByName(CONFIG_CRM.P_SHEET_NAME);
    const pData = pSheet ? pSheet.getDataRange().getValues() : [];
    
    let monthlyProfiling = 0;
    for (let index = 1; index < pData.length; index++) {
        const row = pData[index];
        // Tanggal profiling berdasarkan CONFIG_CRM.P_SHEET_NAME (Biasa Kolom Timestamp di indeks 0)
        let dateVal = row[CONFIG_CRM.COLS.P.DATE];
        if (!dateVal) dateVal = row[0]; // fallback to timestamp
        if (!dateVal) continue;
        
        let d = new Date(dateVal);
        if (isNaN(d.getTime())) continue; // invalid date
        
        const m = d.getMonth();
        const y = d.getFullYear();
        if (m === selectedMonth && y === selectedYear) {
            monthlyProfiling++;
        }
    }

    return {
      success: true,
      data: {
        totalTraffic: monthlyTraffic,
        totalProfiling: monthlyProfiling,
        chartData: chartData,
        locations: Array.from(locationSet).sort()
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ============================
// API: PROFILING DATA
// ============================
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

// ============================
// API: CLEAN SYSTEM PIPELINE
// ============================
function analyzeCleanData() {
  try {
    const extSS = SpreadsheetApp.openById(CONFIG_CRM.PROFILING_SS_ID);
    
    // 1. Fetch Form Profiling (Map valid phones)
    const pSheet = extSS.getSheetByName(CONFIG_CRM.P_SHEET_NAME);
    if (!pSheet) throw new Error("Sheet Profiling tidak ditemukan.");
    const pData = pSheet.getDataRange().getValues();

    const profileMap = new Map();
    for (let i = 1; i < pData.length; i++) {
        const nameRaw = pData[i][CONFIG_CRM.COLS.P.NAME];
        if (!nameRaw) continue; 
        
        const cleanNameKey = String(nameRaw).trim().toLowerCase();
        const phoneData = String(pData[i][CONFIG_CRM.COLS.P.PHONE] || '').trim();
        const homeLocation = String(pData[i][CONFIG_CRM.COLS.P.STORE] || '').trim();

        if (phoneData !== '') {
           profileMap.set(cleanNameKey, { phone: phoneData, home: homeLocation });
        }
    }

    // 2. Fetch Target Clean Master (Cek Duplikasi)
    const targetSS = SpreadsheetApp.openById(CONFIG_CRM.CLEAN_TARGET_SS_ID);
    const targetSheet = targetSS.getSheetByName(CONFIG_CRM.CLEAN_SHEET_NAME);
    if (!targetSheet) throw new Error("Sheet Tujuan Clean Master tidak ada.");
    const tData = targetSheet.getDataRange().getValues();

    const existingNamesInMaster = new Set();
    for (let k = 1; k < tData.length; k++) {
        const extName = String(tData[k][CONFIG_CRM.COLS.C.CUSTOMER] || '').trim().toLowerCase();
        if (extName) existingNamesInMaster.add(extName);
    }

    // 3. Fetch Data Traffic Asal & Cocokkan
    const trfSheet = extSS.getSheetByName(CONFIG_CRM.T_SHEET_NAME);
    if (!trfSheet) throw new Error("Sheet Traffic tidak ada.");
    const trfData = trfSheet.getDataRange().getValues();

    const readyToSync = [];
    const missingProfile = [];
    
    for (let j = 1; j < trfData.length; j++) {
        const rowTraffic = trfData[j];
        
        const rawNameTraffic = String(rowTraffic[CONFIG_CRM.COLS.T.NAME] || '').trim();
        if (!rawNameTraffic) continue;
        
        const searchKey = rawNameTraffic.toLowerCase();

        if (profileMap.has(searchKey)) {
             // Profil ada. Apakah sudah pernah masuk Clean Target?
             if (!existingNamesInMaster.has(searchKey)) {
                  const clientProfile = profileMap.get(searchKey);
                  let newRow = new Array(20).fill(''); 
                  
                  newRow[CONFIG_CRM.COLS.C.DATE] = rowTraffic[CONFIG_CRM.COLS.T.DATE];
                  newRow[CONFIG_CRM.COLS.C.CUSTOMER] = rawNameTraffic;
                  newRow[CONFIG_CRM.COLS.C.SALESMAN] = rowTraffic[CONFIG_CRM.COLS.T.SERVED_BY];
                  newRow[CONFIG_CRM.COLS.C.LOCATION] = rowTraffic[CONFIG_CRM.COLS.T.LOCATION];
                  newRow[CONFIG_CRM.COLS.C.GROSS] = rowTraffic[CONFIG_CRM.COLS.T.GROSS];
                  newRow[CONFIG_CRM.COLS.C.DISC_PCT] = rowTraffic[CONFIG_CRM.COLS.T.DISC_PCT];
                  newRow[CONFIG_CRM.COLS.C.VAL_DISC] = rowTraffic[CONFIG_CRM.COLS.T.VAL_DISC];
                  newRow[CONFIG_CRM.COLS.C.NET_SALES] = rowTraffic[CONFIG_CRM.COLS.T.NET_SALES];
                  newRow[CONFIG_CRM.COLS.C.PHONE] = clientProfile.phone;
                  newRow[CONFIG_CRM.COLS.C.HOME_LOCATION] = clientProfile.home;

                  readyToSync.push({
                      name: rawNameTraffic,
                      phone: clientProfile.phone,
                      netSales: rowTraffic[CONFIG_CRM.COLS.T.NET_SALES],
                      payload: newRow
                  });
             }
        } else {
             // Profil tidak ada formnya di Profiling Sheet, bocor / butuh ditagih.
             missingProfile.push({
                 date: rowTraffic[CONFIG_CRM.COLS.T.DATE],
                 name: rawNameTraffic,
                 advisor: rowTraffic[CONFIG_CRM.COLS.T.SERVED_BY]
             });
        }
    }

    return { 
        success: true, 
        readyToSync: readyToSync,
        missingProfile: missingProfile
    };
  } catch(err) {
    return { success: false, message: 'GAGAL: ' + err.message };
  }
}

function commitCleanData(rowsPayloadArray) {
  try {
    if (!rowsPayloadArray || rowsPayloadArray.length === 0) return { success: true, count: 0 };
    
    const targetSS = SpreadsheetApp.openById(CONFIG_CRM.CLEAN_TARGET_SS_ID);
    const targetSheet = targetSS.getSheetByName(CONFIG_CRM.CLEAN_SHEET_NAME);
    const lastRow = targetSheet.getLastRow();
    
    // Inject ke Sheet Clean System Master
    targetSheet.getRange(lastRow + 1, 1, rowsPayloadArray.length, rowsPayloadArray[0].length).setValues(rowsPayloadArray);
    
    return { success: true, count: rowsPayloadArray.length };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
