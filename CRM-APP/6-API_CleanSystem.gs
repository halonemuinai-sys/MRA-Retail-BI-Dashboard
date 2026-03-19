/**
 * File: 6-API_CleanSystem.gs
 * Logic pipeline matching traffic with profile contacts and exporting clean master
 */
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
