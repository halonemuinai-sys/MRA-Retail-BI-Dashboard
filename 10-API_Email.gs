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
 * ======================================================================
 * CRM WEEKLY EMAIL REPORT
 * ======================================================================
 * Mengirim email ringkasan CRM/App Sheet: Traffic Funnel, Status
 * Kedatangan, Location Traffic, dan Top Advisors.
 */
function sendCRMEmailReport(monthStr, yearStr) {
  try {
    const ss = getSpreadsheet();
    const now = new Date();
    const mNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    
    // monthStr comes as month name (e.g. "March") from the dropdown
    let monthIndex;
    if (monthStr) {
      const idx = mNames.indexOf(monthStr);
      monthIndex = idx >= 0 ? idx : now.getMonth();
    } else {
      monthIndex = now.getMonth();
    }
    const month = monthIndex + 1;
    const year = yearStr ? parseInt(yearStr) : now.getFullYear();
    const monthName = mNames[monthIndex];

    // 1. TRAFFIC FUNNEL from Traffic_Summary
    const funnel = { berhasil:0, gagal:0, menunggu:0, potensial:0, nego:0, total:0 };
    try {
      const tsSheet = ss.getSheetByName(CONFIG.SHEETS.TRAFFIC_SUMMARY);
      if (tsSheet) {
        const tsd = tsSheet.getDataRange().getValues();
        tsd.shift();
        tsd.forEach(r => {
          if (r[0] == year && r[1] == month) {
            funnel.berhasil += Number(r[3])||0;
            funnel.gagal += Number(r[4])||0;
            funnel.menunggu += Number(r[5])||0;
            funnel.potensial += Number(r[6])||0;
            funnel.nego += Number(r[7])||0;
            funnel.total += Number(r[8])||0;
          }
        });
      }
    } catch(e) { console.warn("CRM Email - Funnel error: " + e.message); }

    // 2. STATUS KEDATANGAN + LOCATION + TOP ADVISORS from Traffic Sheet
    const status = { walkIn:0, followUp:0, delivery:0 };
    const loc = { pi:0, ps:0, bali:0, total:0 };
    const advisorMap = {};

    try {
      const TCOL = CONFIG.EXTERNAL.TRAFFIC_COLS;
      const extSS = SpreadsheetApp.openById(CONFIG.EXTERNAL.PROFILING_SHEET_ID);
      const trafficSheet = extSS.getSheetByName(CONFIG.EXTERNAL.TRAFFIC_SHEET_NAME);
      if (trafficSheet) {
        const lastRow = trafficSheet.getLastRow();
        if (lastRow > 1) {
          const tData = trafficSheet.getRange(2, 1, lastRow - 1, trafficSheet.getLastColumn()).getValues();
          tData.forEach(row => {
            let dateVal = row[TCOL.DATE];
            if (!dateVal) return;
            let d;
            try { d = new Date(dateVal); if (isNaN(d.getTime())) return; } catch(e) { return; }
            if (d.getFullYear() != year || d.getMonth() != monthIndex) return;

            // Status Kedatangan
            const st = String(row[TCOL.STATUS]||'').trim().toLowerCase();
            if (st.includes('walk in') || st.includes('walk-in') || st === 'walkin') status.walkIn++;
            else if (st.includes('follow up') || st.includes('follow-up') || st === 'followup') status.followUp++;
            else if (st.includes('delivery') || st.includes('showing')) status.delivery++;

            // Location Traffic
            const l = String(row[TCOL.LOCATION]||'').trim().toLowerCase();
            loc.total++;
            if (l.includes('plaza indonesia') || l === 'pi') loc.pi++;
            else if (l.includes('plaza senayan') || l === 'ps') loc.ps++;
            else if (l.includes('bali')) loc.bali++;

            // Top Advisors
            const adv = String(row[TCOL.SERVED_BY]||'').trim();
            if (adv) advisorMap[adv] = (advisorMap[adv]||0) + 1;
          });
        }
      }
    } catch(e) { console.warn("CRM Email - Traffic error: " + e.message); }

    const topAdvisors = Object.entries(advisorMap)
      .sort((a,b) => b[1] - a[1]);

    const totalVisits = status.walkIn + status.followUp + status.delivery;

    // 3. FOOTFALL DATA from footfall sheets
    let footfall = { kpis: { totalPI: 0, totalPS: 0, combined: 0 }, demographicsPI: { menPct: 0, womenPct: 0 } };
    try {
      const ffData = getFootfallData(monthName, year);
      if (ffData && !ffData.error) footfall = ffData;
    } catch(e) { console.warn('CRM Email - Footfall error: ' + e.message); }

    // BUILD HTML EMAIL — Professional Light Template
    const thBg = '#e8f0fe';
    const thColor = '#1a3a5c';
    const borderColor = '#d6e4f0';
    const zebraLight = '#f5f8fc';
    const sectionTitle = 'font-size:14px; font-weight:600; color:#1a3a5c; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 12px 0;';
    const cellStyle = `padding:9px 14px; border:1px solid ${borderColor}; font-size:13px;`;
    const cellRight = `${cellStyle} text-align:right;`;
    const cellBold = `${cellRight} font-weight:600;`;
    const thStyle = `padding:9px 14px; border:1px solid ${borderColor}; color:${thColor}; background:${thBg}; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.3px;`;

    let html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #333333; max-width: 640px; margin: 0 auto; background: #ffffff;">
      
      <!-- HEADER -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0f5fb; border-bottom: 3px solid #4a90d9;">
        <tr>
          <td style="padding: 24px 28px;">
            <p style="color: #1a3a5c; font-size: 18px; font-weight: 700; margin: 0 0 2px 0; letter-spacing: -0.3px;">CRM Performance Report</p>
            <p style="color: #6b8db5; font-size: 12px; margin: 0; font-weight: 400;">Period: ${monthName} ${year} &mdash; Bvlgari Indonesia</p>
          </td>
        </tr>
      </table>

      <div style="padding: 24px 28px;">

        <p style="font-size: 13px; color: #374151; line-height: 1.6; margin: 0 0 24px 0;">
          Dear All,<br><br>
          Berikut ringkasan performa CRM untuk periode <b>${monthName} ${year}</b>. 
          Tercatat <b>${loc.total}</b> total kunjungan dengan rincian 
          <b>${status.walkIn}</b> Walk-In, <b>${status.followUp}</b> Follow-Up, 
          dan <b>${status.delivery}</b> Delivery/Showing.
          Total Footfall Counter: <b>${footfall.kpis.combined.toLocaleString('id-ID')}</b> 
          (PI: ${footfall.kpis.totalPI.toLocaleString('id-ID')}, PS: ${footfall.kpis.totalPS.toLocaleString('id-ID')}).
        </p>

        <!-- 1. TRAFFIC & PROFILING FUNNEL -->
        <p style="${sectionTitle}">Traffic &amp; Profiling Funnel</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <th style="${thStyle} text-align:left;">Category</th>
            <th style="${thStyle} text-align:right;">Count</th>
          </tr>
          <tr>
            <td style="${cellStyle} font-weight:600;">Total Profiling</td>
            <td style="${cellBold} font-size:15px;">${funnel.total}</td>
          </tr>
          <tr style="background:${zebraLight};">
            <td style="${cellStyle}">Penjualan Berhasil</td>
            <td style="${cellBold}">${funnel.berhasil}</td>
          </tr>
          <tr>
            <td style="${cellStyle}">Menunggu</td>
            <td style="${cellBold}">${funnel.menunggu}</td>
          </tr>
          <tr style="background:${zebraLight};">
            <td style="${cellStyle}">Negosiasi</td>
            <td style="${cellBold}">${funnel.nego}</td>
          </tr>
          <tr>
            <td style="${cellStyle}">Potensial</td>
            <td style="${cellBold}">${funnel.potensial}</td>
          </tr>
          <tr style="background:${zebraLight};">
            <td style="${cellStyle}">Gagal</td>
            <td style="${cellBold}">${funnel.gagal}</td>
          </tr>
        </table>

        <!-- 2. STATUS KEDATANGAN -->
        <p style="${sectionTitle}">Status Kedatangan</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <th style="${thStyle} text-align:left;">Status</th>
            <th style="${thStyle} text-align:right;">Jumlah</th>
          </tr>
          <tr>
            <td style="${cellStyle}">Walk-In</td>
            <td style="${cellBold}">${status.walkIn}</td>
          </tr>
          <tr style="background:${zebraLight};">
            <td style="${cellStyle}">Follow-Up / Appointment</td>
            <td style="${cellBold}">${status.followUp}</td>
          </tr>
          <tr>
            <td style="${cellStyle}">Delivery &amp; Showing</td>
            <td style="${cellBold}">${status.delivery}</td>
          </tr>
          <tr style="background:#eef2ff; font-weight:600;">
            <td style="${cellStyle}">Total</td>
            <td style="${cellBold}">${status.walkIn + status.followUp + status.delivery}</td>
          </tr>
        </table>

        <!-- 3. LOCATION TRAFFIC -->
        <p style="${sectionTitle}">Store Location Traffic</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <th style="${thStyle} text-align:left;">Location</th>
            <th style="${thStyle} text-align:right;">Visits</th>
            <th style="${thStyle} text-align:right;">Share (%)</th>
          </tr>
          <tr>
            <td style="${cellStyle}">Plaza Indonesia</td>
            <td style="${cellBold}">${loc.pi}</td>
            <td style="${cellRight}">${loc.total > 0 ? ((loc.pi/loc.total)*100).toFixed(1) : '0.0'}%</td>
          </tr>
          <tr style="background:${zebraLight};">
            <td style="${cellStyle}">Plaza Senayan</td>
            <td style="${cellBold}">${loc.ps}</td>
            <td style="${cellRight}">${loc.total > 0 ? ((loc.ps/loc.total)*100).toFixed(1) : '0.0'}%</td>
          </tr>
          <tr>
            <td style="${cellStyle}">Bali</td>
            <td style="${cellBold}">${loc.bali}</td>
            <td style="${cellRight}">${loc.total > 0 ? ((loc.bali/loc.total)*100).toFixed(1) : '0.0'}%</td>
          </tr>
          <tr style="background:#eef2ff; font-weight:600;">
            <td style="${cellStyle}">Total</td>
            <td style="${cellBold}">${loc.total}</td>
            <td style="${cellRight}">100.0%</td>
          </tr>
        </table>

        <!-- 4. STORE FOOTFALL (Counter) -->
        <p style="${sectionTitle}">Store Footfall (Counter)</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <th style="${thStyle} text-align:left;">Store</th>
            <th style="${thStyle} text-align:right;">Footfall</th>
            <th style="${thStyle} text-align:right;">Share (%)</th>
          </tr>
          <tr>
            <td style="${cellStyle}">Plaza Indonesia</td>
            <td style="${cellBold}">${footfall.kpis.totalPI.toLocaleString('id-ID')}</td>
            <td style="${cellRight}">${footfall.kpis.combined > 0 ? ((footfall.kpis.totalPI/footfall.kpis.combined)*100).toFixed(1) : '0.0'}%</td>
          </tr>
          <tr style="background:${zebraLight};">
            <td style="${cellStyle}">Plaza Senayan</td>
            <td style="${cellBold}">${footfall.kpis.totalPS.toLocaleString('id-ID')}</td>
            <td style="${cellRight}">${footfall.kpis.combined > 0 ? ((footfall.kpis.totalPS/footfall.kpis.combined)*100).toFixed(1) : '0.0'}%</td>
          </tr>
          <tr style="background:#eef2ff; font-weight:600;">
            <td style="${cellStyle}">Total</td>
            <td style="${cellBold}">${footfall.kpis.combined.toLocaleString('id-ID')}</td>
            <td style="${cellRight}">100.0%</td>
          </tr>
        </table>

        <!-- 4b. DEMOGRAPHICS (PI Only) -->
        ${footfall.demographicsPI.menPct > 0 || footfall.demographicsPI.womenPct > 0 ? `
        <p style="${sectionTitle}">Visitor Demographics (Plaza Indonesia)</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <th style="${thStyle} text-align:left;">Gender</th>
            <th style="${thStyle} text-align:right;">Percentage</th>
          </tr>
          <tr>
            <td style="${cellStyle}">Men</td>
            <td style="${cellBold}">${footfall.demographicsPI.menPct.toFixed(1)}%</td>
          </tr>
          <tr style="background:${zebraLight};">
            <td style="${cellStyle}">Women</td>
            <td style="${cellBold}">${footfall.demographicsPI.womenPct.toFixed(1)}%</td>
          </tr>
        </table>
        ` : ''}

        <!-- 5. TOP ADVISORS -->
        <p style="${sectionTitle}">Customer Advisors Performance</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <th style="${thStyle} text-align:center; width:40px;">No.</th>
            <th style="${thStyle} text-align:left;">Advisor Name</th>
            <th style="${thStyle} text-align:right;">Prospects Handled</th>
          </tr>`;

    if (topAdvisors.length === 0) {
      html += `<tr><td colspan="3" style="${cellStyle} text-align:center; color:#9ca3af; font-style:italic;">No data available for this period.</td></tr>`;
    } else {
      topAdvisors.forEach(([name, count], idx) => {
        const bg = idx % 2 !== 0 ? `background:${zebraLight};` : '';
        html += `<tr style="${bg}">
          <td style="${cellStyle} text-align:center; font-weight:600;">${idx + 1}</td>
          <td style="${cellStyle}">${name}</td>
          <td style="${cellBold}">${count}</td>
        </tr>`;
      });
    }

    html += `
        </table>

        <!-- DASHBOARD LINK -->
        <p style="margin: 28px 0 8px 0; font-size: 13px; color: #374151;">
          For detailed analysis, please access the full dashboard:
        </p>
        <p style="margin: 0 0 24px 0;">
          <a href="https://script.google.com/macros/s/AKfycbze-dmRcWkRsbBx9qdnWe1c6DatoawhFS2cvrgG0el7AOy4BTfxLaVw91PcD4C9NrMS_w/exec" 
             style="color: #2563EB; font-size: 13px; font-weight: 600; text-decoration: underline;">
            Open Bvlgari BI Dashboard
          </a>
        </p>

        <!-- FOOTER -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 14px; margin-top: 8px;">
          <p style="font-size: 11px; color: #9ca3af; margin: 0; line-height: 1.5;">
            This report was automatically generated by the Bvlgari Intelligence Dashboard<br>
            ${new Date().toLocaleString('id-ID')} &mdash; MRA Retail Indonesia
          </p>
        </div>

      </div>
    </div>`;

    // BUILD DAILY FOOTFALL CSV ATTACHMENT
    let csvContent = 'Day,Date,PI In,PI Out,PS In,PS Out,Total In\n';
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const trend = footfall.dailyTrend || [];
    for (let i = 0; i < daysInMonth; i++) {
      const d = trend[i] || { PI_In:0, PI_Out:0, PS_In:0, PS_Out:0 };
      const dateStr = String(i + 1).padStart(2, '0') + '/' + String(monthIndex + 1).padStart(2, '0') + '/' + year;
      const totalIn = d.PI_In + d.PS_In;
      csvContent += `${i + 1},${dateStr},${d.PI_In},${d.PI_Out},${d.PS_In},${d.PS_Out},${totalIn}\n`;
    }
    const csvBlob = Utilities.newBlob(csvContent, 'text/csv', `Daily_Footfall_${monthName}_${year}.csv`);

    // SEND
    const recipients = CONFIG.EMAIL_RECIPIENTS;
    if (!recipients || recipients.length === 0) {
      return { success: false, message: "No email recipients configured in Config." };
    }

    MailApp.sendEmail({
      to: recipients.join(","),
      subject: `CRM Performance Report - ${monthName} ${year} | Bvlgari Indonesia`,
      htmlBody: html,
      attachments: [csvBlob]
    });

    return { success: true, message: "CRM Report sent to " + recipients.join(", ") };

  } catch(e) {
    return { success: false, message: e.message };
  }
}

/**
 * ------------------------------------------------------------------------
 * RUN THIS FUNCTION FROM THE APPS SCRIPT EDITOR TO GRANT EMAIL PERMISSION
 * ------------------------------------------------------------------------
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

/**
 * ======================================================================
 * ADVISOR PERFORMANCE EMAIL REPORT
 * ======================================================================
 * Triggered from Dashboard UI button "Send Advisor Email".
 * Builds and sends a professional email summarizing advisor performance
 * for a given month/year, grouped by store.
 */
function triggerAdvisorEmailManual(monthStr, yearStr) {
  try {
    const now = new Date();
    const mNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const month = monthStr || mNames[now.getMonth()];
    const year = yearStr || String(now.getFullYear());

    // 1. Get Monthly Advisor Data (reuse existing API)
    const monthlyResult = getAdvisorReportData(month, year);
    const advisors = monthlyResult.advisors || [];

    // 2. Get Annual (YTD) Data
    let annualData = [];
    try { annualData = getAnnualAdvisorData(parseInt(year)) || []; } catch(e) { console.warn("Annual data fetch failed: " + e.message); }

    // 3. Filter: exclude advisors with target = 0 or no target (MTD)
    const filteredAdvisors = advisors.filter(adv => {
      const t = Number(adv.target);
      return !isNaN(t) && t > 0;
    });

    // Group by store
    const grouped = {};
    filteredAdvisors.forEach(adv => {
      const loc = (adv.location || "Unknown").trim();
      if (!grouped[loc]) grouped[loc] = [];
      grouped[loc].push(adv);
    });

    // Sort each group by achievement desc
    Object.keys(grouped).forEach(loc => {
      grouped[loc].sort((a, b) => b.achievement - a.achievement);
    });

    const priorityStores = ["Plaza Indonesia", "Plaza Senayan", "Bali"];
    const storeOrder = Object.keys(grouped).sort((a, b) => {
      const idxA = priorityStores.indexOf(a);
      const idxB = priorityStores.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    // 4. Build HTML Email
    const thBg = '#e8f0fe';
    const thColor = '#1a3a5c';
    const borderColor = '#d6e4f0';
    const zebraLight = '#f5f8fc';
    const sectionTitle = 'font-size:14px; font-weight:600; color:#1a3a5c; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 12px 0;';
    const cellStyle = `padding:8px 12px; border:1px solid ${borderColor}; font-size:12px;`;
    const cellRight = `${cellStyle} text-align:right;`;
    const cellBold = `${cellRight} font-weight:600;`;
    const thStyle = `padding:8px 12px; border:1px solid ${borderColor}; color:${thColor}; background:${thBg}; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.3px;`;

    const getColor = (pct) => {
      if (pct >= 100) return '#059669';
      if (pct >= 80)  return '#2563eb';
      if (pct >= 50)  return '#d97706';
      return '#dc2626';
    };

    let html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #333333; max-width: 700px; margin: 0 auto; background: #ffffff;">
      
      <!-- HEADER -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0f5fb; border-bottom: 3px solid #4a90d9;">
        <tr>
          <td style="padding: 24px 28px;">
            <p style="color: #1a3a5c; font-size: 18px; font-weight: 700; margin: 0 0 2px 0;">Advisor Performance Report</p>
            <p style="color: #6b8db5; font-size: 12px; margin: 0;">Period: ${month} ${year} &mdash; Bvlgari Indonesia</p>
          </td>
        </tr>
      </table>

      <div style="padding: 24px 28px;">

        <p style="font-size: 13px; color: #374151; line-height: 1.6; margin: 0 0 24px 0;">
          Dear All,<br><br>
          Berikut ringkasan performa Advisor untuk periode <b>${month} ${year}</b>.
          Total <b>${filteredAdvisors.length}</b> advisors tercatat aktif pada periode ini (exclude non-target).
        </p>

        <!-- MONTHLY PERFORMANCE BY STORE -->
        <p style="${sectionTitle}">Monthly Advisor Performance</p>`;

    if (storeOrder.length === 0) {
      html += `<p style="color:#9ca3af; font-style:italic; font-size:13px;">No advisor data available for this period.</p>`;
    } else {
      storeOrder.forEach(storeName => {
        const advList = grouped[storeName];

        // Calculate store totals
        let storeTotalSales = 0, storeTotalTarget = 0, storeTotalTrx = 0;
        advList.forEach(adv => {
          storeTotalSales += adv.netSales || 0;
          storeTotalTarget += adv.target || 0;
          storeTotalTrx += adv.transCount || 0;
        });
        const storeAchv = storeTotalTarget > 0 ? (storeTotalSales / storeTotalTarget) * 100 : 0;
        const storeAchvColor = getColor(storeAchv);

        html += `
        <p style="font-size:13px; font-weight:600; color:#374151; margin:18px 0 8px 0;">${storeName} <span style="color:#9ca3af; font-weight:400;">(${advList.length} advisors)</span></p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <th style="${thStyle} text-align:center; width:30px;">No</th>
            <th style="${thStyle} text-align:left;">Advisor</th>
            <th style="${thStyle} text-align:right;">Trx</th>
            <th style="${thStyle} text-align:right;">Net Sales</th>
            <th style="${thStyle} text-align:right;">Target</th>
            <th style="${thStyle} text-align:right;">Achv %</th>
            <th style="${thStyle} text-align:right;">Contrib %</th>
          </tr>`;

        advList.forEach((adv, idx) => {
          const bg = idx % 2 !== 0 ? `background:${zebraLight};` : '';
          const achvColor = getColor(adv.achievement);
          html += `
          <tr style="${bg}">
            <td style="${cellStyle} text-align:center; font-weight:600;">${idx + 1}</td>
            <td style="${cellStyle}">${adv.name}</td>
            <td style="${cellRight}">${adv.transCount || 0}</td>
            <td style="${cellBold}">${formatMoneyIdrEmail(adv.netSales)}</td>
            <td style="${cellRight}">${formatMoneyIdrEmail(adv.target)}</td>
            <td style="${cellRight} font-weight:600; color:${achvColor};">${adv.achievement.toFixed(1)}%</td>
            <td style="${cellRight}">${adv.contribution.toFixed(1)}%</td>
          </tr>`;
        });

        // Store Total Row
        html += `
          <tr style="background:#eef2ff; font-weight:600;">
            <td style="${cellStyle} text-align:center;"></td>
            <td style="${cellStyle} font-weight:700; color:#1a3a5c;">Total ${storeName}</td>
            <td style="${cellRight} font-weight:700;">${storeTotalTrx}</td>
            <td style="${cellBold} font-weight:700; color:#1a3a5c;">${formatMoneyIdrEmail(storeTotalSales)}</td>
            <td style="${cellRight} font-weight:700;">${formatMoneyIdrEmail(storeTotalTarget)}</td>
            <td style="${cellRight} font-weight:700; color:${storeAchvColor};">${storeAchv.toFixed(1)}%</td>
            <td style="${cellRight}"></td>
          </tr>`;

        html += `</table>`;
      });
    }

    // ANNUAL (YTD) TABLE — exclude target = 0
    const filteredAnnual = annualData.filter(adv => {
      const t = Number(adv.target);
      return !isNaN(t) && t > 0;
    });
    if (filteredAnnual.length > 0) {
      // YTD Grand Totals
      let ytdTotalSales = 0, ytdTotalTarget = 0;
      filteredAnnual.forEach(adv => { ytdTotalSales += adv.netSales || 0; ytdTotalTarget += adv.target || 0; });
      const ytdAchv = ytdTotalTarget > 0 ? (ytdTotalSales / ytdTotalTarget) * 100 : 0;

      html += `
        <p style="${sectionTitle} margin-top:28px;">Year-To-Date (YTD) Performance ${year}</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <th style="${thStyle} text-align:center; width:30px;">No</th>
            <th style="${thStyle} text-align:left;">Advisor</th>
            <th style="${thStyle} text-align:left;">Store</th>
            <th style="${thStyle} text-align:right;">YTD Sales</th>
            <th style="${thStyle} text-align:right;">YTD Target</th>
            <th style="${thStyle} text-align:right;">Achv %</th>
          </tr>`;

      filteredAnnual.forEach((adv, idx) => {
        const bg = idx % 2 !== 0 ? `background:${zebraLight};` : '';
        const achvColor = getColor(adv.achievement);
        html += `
          <tr style="${bg}">
            <td style="${cellStyle} text-align:center; font-weight:600;">${idx + 1}</td>
            <td style="${cellStyle}">${adv.name}</td>
            <td style="${cellStyle}">${adv.location || '-'}</td>
            <td style="${cellBold}">${formatMoneyIdrEmail(adv.netSales)}</td>
            <td style="${cellRight}">${formatMoneyIdrEmail(adv.target)}</td>
            <td style="${cellRight} font-weight:600; color:${achvColor};">${adv.achievement.toFixed(1)}%</td>
          </tr>`;
      });

      // YTD Grand Total Row
      const ytdAchvColor = getColor(ytdAchv);
      html += `
          <tr style="background:#eef2ff; font-weight:600;">
            <td style="${cellStyle} text-align:center;"></td>
            <td style="${cellStyle} font-weight:700; color:#1a3a5c;" colspan="2">Grand Total YTD</td>
            <td style="${cellBold} font-weight:700; color:#1a3a5c;">${formatMoneyIdrEmail(ytdTotalSales)}</td>
            <td style="${cellRight} font-weight:700;">${formatMoneyIdrEmail(ytdTotalTarget)}</td>
            <td style="${cellRight} font-weight:700; color:${ytdAchvColor};">${ytdAchv.toFixed(1)}%</td>
          </tr>`;

      html += `</table>`;
    }

    html += `
        <!-- DASHBOARD LINK -->
        <p style="margin: 28px 0 8px 0; font-size: 13px; color: #374151;">
          For detailed analysis, please access the full dashboard:
        </p>
        <p style="margin: 0 0 24px 0;">
          <a href="https://script.google.com/macros/s/AKfycbze-dmRcWkRsbBx9qdnWe1c6DatoawhFS2cvrgG0el7AOy4BTfxLaVw91PcD4C9NrMS_w/exec" 
             style="color: #2563EB; font-size: 13px; font-weight: 600; text-decoration: underline;">
            Open Bvlgari BI Dashboard
          </a>
        </p>

        <!-- FOOTER -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 14px; margin-top: 8px;">
          <p style="font-size: 11px; color: #9ca3af; margin: 0; line-height: 1.5;">
            This report was automatically generated by the Bvlgari Intelligence Dashboard<br>
            ${new Date().toLocaleString('id-ID')} &mdash; MRA Retail Indonesia
          </p>
        </div>

      </div>
    </div>`;

    // 5. Send Email
    const recipients = CONFIG.EMAIL_RECIPIENTS;
    if (!recipients || recipients.length === 0) {
      return { success: false, message: "No email recipients configured in Config." };
    }

    MailApp.sendEmail({
      to: recipients.join(","),
      subject: `Advisor Performance Report - ${month} ${year} | Bvlgari Indonesia`,
      htmlBody: html
    });

    return { success: true, message: `Advisor Performance Report sent to ${recipients.join(", ")}` };

  } catch(e) {
    return { success: false, message: e.message };
  }
}
