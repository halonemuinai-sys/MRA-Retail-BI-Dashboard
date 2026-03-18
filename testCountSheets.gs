function tempCountSheets() {
  const localSS = SpreadsheetApp.getActiveSpreadsheet();
  const extSS = SpreadsheetApp.openById(CONFIG.EXTERNAL.PROFILING_SHEET_ID);
  
  const localSheets = localSS.getSheets();
  const extSheets = extSS.getSheets();
  
  const localNames = localSheets.map(s => s.getName());
  const extNames = extSheets.map(s => s.getName());
  
  Logger.log("Local SS has " + localSheets.length + " sheets.");
  Logger.log("Local Sheets: " + localNames.join(", "));
  
  Logger.log("External SS has " + extSheets.length + " sheets.");
  Logger.log("External Sheets: " + extNames.join(", "));
}
