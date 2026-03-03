// Let's use clasp to pull the exact output or just inspect the JSON in gas console
// The previous run_command failed because the user doesn't have clasp.
// The best way to debug is to create a snippet in the web UI that logs things, or write a dedicated GS function and ask the user to run it.

function debugBaliGap() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DB_CLEAN_MASTER");
  var data = sheet.getDataRange().getValues();
  var headers = data.shift();
  
  var baliCrossings = data.filter(r => {
      var d = r[1]; // Date
      if (!(d instanceof Date)) return false;
      if (d.getMonth() !== 1) return false; // Feb
      
      var loc = String(r[4] || "").trim(); // LOCATION
      var home = String(r[18] || "").trim(); // HOME_LOCATION
      
      // Is it a discrepancy involving Bali?
      // Either Physical = Bali and Home != Bali
      // OR Home = Bali and Physical != Bali
      return (loc === "Bali" && home !== "Bali" && home !== "") || 
             (home === "Bali" && loc !== "Bali" && loc !== "");
  });
  
  var logs = baliCrossings.map(r => {
     return "Date: " + r[1] + " | Salesman: " + r[3] + " | Loc: " + r[4] + " | HomeLoc: " + r[18] + " | Net: " + r[14];
  });
  
  console.log("Bali Discrepancies:", logs);
}
