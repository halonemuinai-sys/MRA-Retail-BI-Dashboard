/**
 * File: 11-API_BOD_Report.gs
 * Description: API for generating the specialized Landscape Daily Sales Report for BOD.
 */

function downloadBODReportPDF(dateStr) {
  try {
    const ss = getSpreadsheet();
    if (!ss) throw new Error("Could not access spreadsheet.");

    // Parse requested date
    const targetD = dateStr ? new Date(dateStr) : new Date();
    const targetYear = targetD.getFullYear();
    const targetMonthIndex = targetD.getMonth();
    const maxDate = targetD.getDate();

    const mNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = mNames[targetMonthIndex];

    // Read Clean Master - ⚡ SERVERLESS: Fetch from Supabase
    const data = fetchSupabaseCleanMasterAs2DArray(targetYear);
    if (!data || data.length === 0) throw new Error("Clean Master data not found in Supabase.");
    
    // Read Stock Data
    const stockSheet = ss.getSheetByName(CONFIG.SHEETS.MASTER_STOCK);
    const stockData = stockSheet ? stockSheet.getDataRange().getValues() : [];
    
    // Stores to map
    const stores = ["Plaza Indonesia", "Plaza Senayan", "Bali", "Head Office"];
    const categories = ["Jewelry", "Watches", "Accessories", "Perfume"];
    
    // Target & Master Mappings
    const targetMap = getTargetMap(ss, monthName, targetYear);
    
    // Matrix Structure: [Store] -> [Category] -> { stock, netSMI, netNonSMI, qtySMI, qtyNonSMI }
    const matrix = {};
    stores.forEach(s => {
      matrix[s] = {
        totalSales: 0,
        totalGross: 0,
        totalCost: 0,
        totalDisc: 0,
        todaySalesSMI: 0,
        todaySalesNonSMI: 0,
        todayCost: 0,
        todayGross: 0,
        target: targetMap[s] || 0,
        cats: {}
      };
      categories.forEach(c => {
        matrix[s].cats[c] = { stock: 0, netSMI: 0, netNonSMI: 0, qtySold: 0 };
      });
    });

    // Populate Initial Stock
    if (stockData.length > 0) {
      const stockMonthCol = targetMonthIndex + 3; // e.g. Jan=3, Feb=4
      stockData.forEach((row, i) => {
        if (i===0 || String(row[0]) != targetYear) return;
        let sName = String(row[1]).trim();
        if (sName.toLowerCase() === "bali boutique") sName = "Bali"; // normalization
        let cName = String(row[2]).trim();
        
        // Map to standard stores/cats
        const matchedStore = stores.find(st => st.toLowerCase() === sName.toLowerCase());
        const matchedCat = categories.find(ct => ct.toLowerCase() === cName.toLowerCase());
        
        if (matchedStore && matchedCat) {
          matrix[matchedStore].cats[matchedCat].stock = Number(row[stockMonthCol]) || 0;
        }
      });
    }

    const COL = CONFIG.CLEAN_COLS;
    const isHO = (l) => { const x=String(l).toLowerCase(); return x==="head office" || x==="ho"; };

    // Process MTD Data
    data.forEach(row => {
      const d = parseDateFix(row[COL.DATE]);
      if (d.getFullYear() !== targetYear || d.getMonth() !== targetMonthIndex || d.getDate() > maxDate) return;

      let rLoc = String(row[COL.LOCATION]).trim();
      if (rLoc.toLowerCase() === 'bali boutique') rLoc = "Bali";
      if (isHO(rLoc)) rLoc = "Head Office";

      const matchedStore = stores.find(st => st.toLowerCase() === rLoc.toLowerCase());
      if (!matchedStore) return;

      let rCat = String(row[COL.MAIN_CAT] || "Other").trim();
      if (rCat === "JWL") rCat = "Jewelry";
      if (rCat === "WTH") rCat = "Watches";
      if (rCat === "ACCS") rCat = "Accessories";
      if (rCat === "PFM") rCat = "Perfume";
      
      const isSMI = String(row[COL.TYPE_ITEM]).toUpperCase() === "SMI";
      const net = Number(row[COL.NET_SALES]) || 0;
      const qty = Number(row[COL.QTY]) || 0;
      const gross = Number(row[COL.GROSS]) || 0;
      const cost = Number(row[COL.SELLING_COST]) || 0;
      const disc = Number(row[COL.VAL_DISC]) || 0;
      
      const isToday = d.getDate() === maxDate;

      // Update Store Aggr
      matrix[matchedStore].totalSales += net;
      matrix[matchedStore].totalGross += gross;
      matrix[matchedStore].totalCost += cost;
      matrix[matchedStore].totalDisc += disc;
      
      if (isToday) {
        matrix[matchedStore].todayCost += cost;
        matrix[matchedStore].todayGross += gross;
        if (isSMI) matrix[matchedStore].todaySalesSMI += net;
        else matrix[matchedStore].todaySalesNonSMI += net;
      }

      // Update Category MTD
      if (categories.includes(rCat)) {
        matrix[matchedStore].cats[rCat].qtySold += qty;
        matrix[matchedStore].cats[rCat].stock = Math.max(0, matrix[matchedStore].cats[rCat].stock - qty);
        
        if (isSMI) matrix[matchedStore].cats[rCat].netSMI += net;
        else matrix[matchedStore].cats[rCat].netNonSMI += net;
      }
    });

    // Generate HTML Output
    const template = HtmlService.createTemplateFromFile("BODReportTemplate");
    template.matrix = matrix;
    template.stores = stores;
    template.categories = categories;
    template.dateStr = dateStr;
    template.maxDate = maxDate;
    template.monthName = monthName;
    template.targetYear = targetYear;

    // Use PDF conversion
    const htmlOutput = template.evaluate();
    const pdfBlob = htmlOutput.getAs(MimeType.PDF);
    pdfBlob.setName(`BOD_Daily_Sales_${dateStr}.pdf`);

    return {
      base64: Utilities.base64Encode(pdfBlob.getBytes()),
      filename: pdfBlob.getName()
    };
    
  } catch (e) {
    return { error: e.message };
  }
}
