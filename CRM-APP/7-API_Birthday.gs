/**
 * File: 7-API_Birthday.gs
 * Fetches and sorts client birthdays from Form Profiling.
 */
function getCrmBirthdayData() {
  try {
    const extSS = SpreadsheetApp.openById(CONFIG_CRM.PROFILING_SS_ID);
    const pSheet = extSS.getSheetByName(CONFIG_CRM.P_SHEET_NAME);
    if (!pSheet) throw new Error("Sheet Form Profiling tidak ditemukan.");

    const data = pSheet.getDataRange().getValues();
    if(data.length <= 1) return { success: true, data: [] };

    const today = new Date();
    
    // Normalize today to start of day for accurate comparison
    const curYear = today.getFullYear();
    const curMonth = today.getMonth();
    const curDate = today.getDate();
    const todayNorm = new Date(curYear, curMonth, curDate);

    let bdayList = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rawDate = row[CONFIG_CRM.COLS.P.DOB];
        const name = String(row[CONFIG_CRM.COLS.P.NAME] || '').trim();
        const phone = String(row[CONFIG_CRM.COLS.P.PHONE] || '').trim();
        const loc = String(row[CONFIG_CRM.COLS.P.STORE] || '').trim();

        if (!name || !rawDate) continue;

        let d = new Date(rawDate);
        if (isNaN(d.getTime())) continue; // Skip invalid dates

        const m = d.getMonth();
        const date = d.getDate();
        
        // Pastikan umurnya logis
        const age = curYear - d.getFullYear();
        if(age > 100 || age < 10) continue; 
        
        let nextBday = new Date(curYear, m, date);
        // Jika ultah tahun ini sudah terlewat, set ultahnya ke tahun depan
        if (nextBday.getTime() < todayNorm.getTime()) {
           nextBday.setFullYear(curYear + 1);
        }
        
        const diffTime = nextBday.getTime() - todayNorm.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let status = 'Mendatang';
        if (diffDays === 0) status = 'HARI INI!';
        else if (diffDays <= 7) status = `H-${diffDays}`;
        else if (diffDays <= 30) status = `Bulan Ini`;

        bdayList.push({
            name: name,
            phone: phone,
            location: loc,
            dob: String(date).padStart(2, '0') + '/' + String(m + 1).padStart(2, '0') + '/' + d.getFullYear(),
            age: age,
            diffDays: diffDays,
            status: status
        });
    }

    // Urutkan berdasarkan sisa hari terdekat
    bdayList.sort((a, b) => a.diffDays - b.diffDays);
    
    // Ambil maksimal 100 terdekat agar UI tidak lag
    return { success: true, data: bdayList.slice(0, 100) };

  } catch(e) {
    return { success: false, message: e.message };
  }
}
