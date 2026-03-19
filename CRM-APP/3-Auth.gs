/**
 * File: 3-Auth.gs
 * Authentication and User Setup logic.
 */

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
