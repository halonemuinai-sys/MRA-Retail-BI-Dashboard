/**
 * File: 10-API_Email.gs
 * Description: Email Reporting Automation
 */

function formatMoneyIdrEmail(val) {
  if (isNaN(val) || val === 0) return "0";
  return Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function sendDailyEmailReport(targetDateStr) {
  try {
    const ss = getSpreadsheet();
    const cleanSheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
    if (!cleanSheet) throw new Error("Clean sheet not found");

    const data = cleanSheet.getDataRange().getValues();
    const headers = data.shift();
    const COL = CONFIG.CLEAN_COLS;

    // Determine target date
    let targetD;
    if (targetDateStr) {
        targetD = new Date(targetDateStr);
    } else {
        // Default to yesterday if running early morning
        targetD = new Date();
        targetD.setDate(targetD.getDate() - 1);
    }

    const targetMonthIndex = targetD.getMonth();
    const targetYear = targetD.getFullYear();
    const maxDate = targetD.getDate();

    // Months mapping for target
    const mNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = mNames[targetMonthIndex];

    // Filter data for MTD (Month to Target Date)
    const mtdData = data.filter(row => {
        const d = parseDateFix(row[COL.DATE]);
        return d.getMonth() === targetMonthIndex && 
               d.getFullYear() === targetYear && 
               d.getDate() <= maxDate;
    });

    // Valid Stores Whitelist
    const validStores = ["plaza indonesia", "plaza senayan", "bali", "bali boutique"];
    const isHO = (l) => {
        const lower = String(l).toLowerCase();
        return lower === "head office" || lower === "ho";
    };

    let totalStoreSales = 0;
    let totalHOSales = 0;
    let grandTotalSales = 0;

    const storeAdjStats = {
      "Plaza Indonesia": { physical: 0, adjusted: 0 },
      "Plaza Senayan": { physical: 0, adjusted: 0 },
      "Bali": { physical: 0, adjusted: 0 }
    };

    // Daily matrix
    // keys: 1 to maxDate. struct: { "Plaza Indonesia": 0, "Plaza Senayan": 0, "Bali": 0 }
    const dailyMatrix = {};
    for (let i = 1; i <= maxDate; i++) {
        dailyMatrix[i] = { "Plaza Indonesia":0, "Plaza Senayan":0, "Bali":0 };
    }

    mtdData.forEach(row => {
        let tLoc = String(row[COL.LOCATION] || "").trim();
        let hLoc = String(row[COL.HOME_LOCATION] || "").trim();
        
        let tLocLower = tLoc.toLowerCase();
        let hLocLower = hLoc.toLowerCase();
        
        // Normalize Bali
        if (tLocLower === "bali boutique") tLoc = "Bali";
        if (hLocLower === "bali boutique") hLoc = "Bali";
        
        tLocLower = tLoc.toLowerCase();
        hLocLower = hLoc.toLowerCase();

        const net = Number(row[COL.NET_SALES]) || 0;
        const d = parseDateFix(row[COL.DATE]);
        const dayNum = d.getDate();

        // 1. Grand Total
        grandTotalSales += net;

        // 2. Head Office Total
        if (isHO(tLocLower)) {
            totalHOSales += net;
        }

        // 3. Store Sales & Matrix (Only Whitelist Physical)
        if (validStores.includes(tLocLower)) {
            totalStoreSales += net;
            if (storeAdjStats[tLoc]) storeAdjStats[tLoc].physical += net;
            if (dailyMatrix[dayNum] && dailyMatrix[dayNum][tLoc] !== undefined) {
                dailyMatrix[dayNum][tLoc] += net;
            }
        }
        
        // 4. Crossing / Adjusted Sales (Only Whitelist Home)
        if (validStores.includes(hLocLower)) {
            // Must have valid physical location constraint too based on previous logic 
            // but for MTD total adjusted, we just map it down
            if (tLoc !== "Unknown" && tLoc !== "") {
                if (storeAdjStats[hLoc]) storeAdjStats[hLoc].adjusted += net;
            }
        }
    });

    // Target MTD Calculation
    const targetMap = getTargetMap(ss, monthName, targetYear);
    // targetMap returns full month target for all stores
    // "Persentase Terhadap Target Store Exclude Head Office"
    let totalTargetStores = 0;
    if (targetMap["Plaza Indonesia"]) totalTargetStores += targetMap["Plaza Indonesia"];
    if (targetMap["Plaza Senayan"]) totalTargetStores += targetMap["Plaza Senayan"];
    if (targetMap["Bali"]) totalTargetStores += targetMap["Bali"];

    const achievement = totalTargetStores > 0 ? ((totalStoreSales / totalTargetStores) * 100).toFixed(1) : 0;

    // BUILD EMAIL HTML
    let html = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto;">
      <p>Dear All,</p>
      <p><b>Laporan Penjualan Harian Bulgari Indonesia : ${maxDate} ${monthName} ${targetYear}</b></p>
      
      <table style="width: 100%; max-width: 600px; margin-bottom: 20px; font-size: 14px;">
        <tr>
          <td style="width: 60%;"><b>Penjualan Store</b></td>
          <td style="text-align: right;"><b>${formatMoneyIdrEmail(totalStoreSales)}</b></td>
        </tr>
        <tr>
          <td>Persentase Terhadap Target Store Exclude Head Office</td>
          <td style="text-align: right;">${achievement}%</td>
        </tr>
        <tr>
          <td>Penjualan Head Office</td>
          <td style="text-align: right;">${formatMoneyIdrEmail(totalHOSales)}</td>
        </tr>
        <tr>
          <td><b>Total Penjualan All</b></td>
          <td style="text-align: right;"><b>${formatMoneyIdrEmail(grandTotalSales)}</b></td>
        </tr>
      </table>
      
      <p style="margin-bottom: 25px; margin-top: 5px;">
        <a href="https://script.google.com/macros/s/AKfycbze-dmRcWkRsbBx9qdnWe1c6DatoawhFS2cvrgG0el7AOy4BTfxLaVw91PcD4C9NrMS_w/exec" style="color: #2563EB; text-decoration: underline; font-weight: bold;">Link Bulgari BI Dashboard</a>
      </p>

      <h3>Crossing Sales</h3>
      <table style="width: 100%; max-width: 600px; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Location</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Total Crossing Sales</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Performance Sales %</th>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Plaza Indonesia</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatMoneyIdrEmail(storeAdjStats["Plaza Indonesia"].adjusted)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${targetMap["Plaza Indonesia"] > 0 ? ((storeAdjStats["Plaza Indonesia"].adjusted / targetMap["Plaza Indonesia"]) * 100).toFixed(1) : 0}%</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Plaza Senayan</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatMoneyIdrEmail(storeAdjStats["Plaza Senayan"].adjusted)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${targetMap["Plaza Senayan"] > 0 ? ((storeAdjStats["Plaza Senayan"].adjusted / targetMap["Plaza Senayan"]) * 100).toFixed(1) : 0}%</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Bali</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatMoneyIdrEmail(storeAdjStats["Bali"].adjusted)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${targetMap["Bali"] > 0 ? ((storeAdjStats["Bali"].adjusted / targetMap["Bali"]) * 100).toFixed(1) : 0}%</td>
        </tr>
      </table>

      <h3>Daily Transaction</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: right;">
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Date</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Plaza Indonesia</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Plaza Senayan</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Bali</th>
        </tr>
    `;

    let totalMatrix = { "Plaza Indonesia":0, "Plaza Senayan":0, "Bali":0 };
    for(let d=1; d<=maxDate; d++) {
        totalMatrix["Plaza Indonesia"] += dailyMatrix[d]["Plaza Indonesia"];
        totalMatrix["Plaza Senayan"] += dailyMatrix[d]["Plaza Senayan"];
        totalMatrix["Bali"] += dailyMatrix[d]["Bali"];
    }

    // Print Total Row First
    html += `
        <tr style="font-weight: bold; background-color: #eef2ff;">
          <td style="padding: 8px; border: 1px solid #ddd; text-align: left;">Total</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formatMoneyIdrEmail(totalMatrix["Plaza Indonesia"])}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formatMoneyIdrEmail(totalMatrix["Plaza Senayan"])}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formatMoneyIdrEmail(totalMatrix["Bali"])}</td>
        </tr>
    `;

    // Calculate Holidays
    const holidays = Array.isArray(CONFIG.HOLIDAYS) ? CONFIG.HOLIDAYS : []; // Placeholder if helper isn't directly global
    
    // Print each day
    for(let d=1; d<=maxDate; d++) {
        let loopDate = new Date(targetYear, targetMonthIndex, d);
        let dayOfWeek = loopDate.getDay();
        let isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        // Assuming global isHoliday implementation
        let isHoliday = false;
        try {
            if (typeof isHolidayDate === "function") {
                isHoliday = isHolidayDate(loopDate);
            }
        } catch(e) {}

        let dateLabelColor = (isWeekend || isHoliday) ? "color: #dc2626; font-weight: bold;" : "";
        let dateStrCell = `${d} ${monthName.slice(0,3)} ${targetYear}`;

        let cellPI = dailyMatrix[d]["Plaza Indonesia"];
        let cellPS = dailyMatrix[d]["Plaza Senayan"];
        let cellBL = dailyMatrix[d]["Bali"];

        let stylePI = cellPI === 0 ? "background-color: #fef08a;" : "";
        let stylePS = cellPS === 0 ? "background-color: #fef08a;" : "";
        let styleBL = cellBL === 0 ? "background-color: #fef08a;" : "";

        html += `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: left; ${dateLabelColor}">${dateStrCell}</td>
          <td style="padding: 8px; border: 1px solid #ddd; ${stylePI}">${formatMoneyIdrEmail(cellPI)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; ${stylePS}">${formatMoneyIdrEmail(cellPS)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; ${styleBL}">${formatMoneyIdrEmail(cellBL)}</td>
        </tr>
        `;
    }

    html += `
      </table>
      <p style="font-size: 11px; color: #888; margin-top: 30px;">This is an automatically generated email from the Bulgari Dashboard.</p>
    </div>
    `;

    // Send Emails
    const recipients = CONFIG.EMAIL_RECIPIENTS;
    if (recipients && recipients.length > 0) {
        MailApp.sendEmail({
            to: recipients.join(","),
            subject: `Daily Sales Report - ${maxDate} ${monthName} ${targetYear}`,
            htmlBody: html
        });
        return { success: true, message: "Email Sent Successfully" };
    } else {
        return { success: false, message: "No recipients configured." };
    }

  } catch(e) {
    return { success: false, message: e.message };
  }
}

/**
 * Run this function ONCE from the Apps Script Editor 
 * to automatically send the email every morning between 8 AM - 9 AM.
 */
function installDailyEmailTrigger() {
  const funcName = "sendDailyEmailReport";
  
  // Delete existing triggers for this function to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === funcName) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Set new trigger for 8 AM
  ScriptApp.newTrigger(funcName)
    .timeBased()
    .atHour(8)
    .nearMinute(0)
    .everyDays(1)
    .create();
    
  Logger.log("Daily Email Trigger successfully installed for 8 AM.");
}

/**
 * ------------------------------------------------------------------------
 * RUN THIS FUNCTION FROM THE APPS SCRIPT EDITOR TO GRANT EMAIL PERMISSION
 * ------------------------------------------------------------------------
 * Karena kita baru saja menambahkan fitur pengiriman Email (MailApp), 
 * Google Apps Script membutuhkan izin eksplisit dari Mas Aris.
 * 
 * CARA:
 * 1. Di bagian atas editor ini, pilih fungsi "testMailPermission"
 * 2. Klik tombol "Run" (Jalankan)
 * 3. Nanti akan muncul pop-up "Authorization Required", klik Review.
 * 4. Kalau sukses, akan ada email masuk ke Mas Aris berisi teks pendek.
 * 
 * Setelah ini berhasil dijalankan sekali, tombol di Dashboard pasti bisa dipakai!
 */
function testMailPermission() {
  const recipients = CONFIG.EMAIL_RECIPIENTS;
  if (!recipients || recipients.length === 0) {
    Logger.log("Belum ada email di-setting di 1-Config.gs");
    return;
  }
  
  MailApp.sendEmail({
    to: recipients.join(","),
    subject: "Bvlgari Dashboard - Test Email Config",
    htmlBody: "<b>Berhasil!</b> Izin pengiriman email otomatis dari Dashboard Bvlgari sudah aktif."
  });
  
  Logger.log("Test Email berhasil dikirim ke: " + recipients.join(","));
}
