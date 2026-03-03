function debugBaliCrossingSales() {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_CLEAN_MASTER");
  const data = ws.getDataRange().getValues();
  const headers = data[0];
  
  const COL = {
    MONTH: headers.indexOf("MONTH"),
    LOCATION: headers.indexOf("LOCATION"),
    HOME_LOCATION: headers.indexOf("HOME_LOCATION"),
    SALESMAN: headers.indexOf("SALESMAN"),
    NET_SALES: headers.indexOf("NET_SALES"),
    QTY: headers.indexOf("QTY")
  };
  
  let baliPhysical = 0;
  let baliAdjusted = 0;
  
  const baliIncomingCross = [];
  const baliOutgoingCross = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[COL.MONTH]).trim() !== "February") continue;
    
    let tLoc = String(row[COL.LOCATION] || "").trim();
    let hLoc = String(row[COL.HOME_LOCATION] || "").trim();
    const isHO = (l) => l.toLowerCase() === "head office" || l.toLowerCase() === "ho";
    if (isHO(tLoc) || isHO(hLoc)) continue;
    
    let net = Number(row[COL.NET_SALES]) || 0;
    
    // Physical Tracking
    if (tLoc === "Bali") {
      baliPhysical += net;
      if (hLoc !== "Bali" && hLoc !== "Unknown" && hLoc !== "") {
        baliOutgoingCross.push(`Transaction at Bali, but Home=${hLoc}, Salesman=${row[COL.SALESMAN]}, Net=${net}`);
      }
    }
    
    // Adjusted Tracking
    if (hLoc === "Bali") {
      baliAdjusted += net;
      if (tLoc !== "Bali" && tLoc !== "Unknown" && tLoc !== "") {
        baliIncomingCross.push(`Transaction at ${tLoc}, but Home=Bali, Salesman=${row[COL.SALESMAN]}, Net=${net}`);
      }
    }
  }
  
  console.log("Bali Physical: " + baliPhysical);
  console.log("Bali Adjusted: " + baliAdjusted);
  console.log("Difference (Adj - Phys): " + (baliAdjusted - baliPhysical));
  
  console.log("Incoming Cross (Sales made by Bali staff AT OTHER locations):", baliIncomingCross);
  console.log("Outgoing Cross (Sales made by OTHER staff AT BALI):", baliOutgoingCross);
}
