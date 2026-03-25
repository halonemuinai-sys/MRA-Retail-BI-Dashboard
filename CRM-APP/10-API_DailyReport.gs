/**
 * File: 10-API_DailyReport.gs
 * Handles Daily Report data fetching and email/excel exports.
 */

function getDailyReportData(filterLocation, filterMonth, filterYear) {
  try {
      const extSS = SpreadsheetApp.openById(CONFIG_CRM.PROFILING_SS_ID);
      const trfSheet = extSS.getSheetByName(CONFIG_CRM.T_SHEET_NAME);
      if (!trfSheet) throw new Error("Traffic Sheet not found.");
      
      const data = trfSheet.getDataRange().getValues();
      const headers = data[0] || [];
      
      // Target Columns
      const targetCols = [
          "Tanggal Berkunjung", "Rentang Waktu", "Nama Lengkap", "Nama Panggilan", 
          "Customer Advisor", "Served By", "Lokasi Store", "Status Kedatangan", 
          "No HP", "Email", "Etnis", "Status Pelanggan", "Prospek Level", 
          "Domisili", "Domisili Luar Negeri", "Kategori Barang", 
          "Gross Sales (Retail Price)", "Penawaran Discount", "Discount (RP)", 
          "Net Sales", "Detail Items", "Descriptions", "Notes"
      ];
      
      const colIndices = {};
      
      for (let j = 0; j < headers.length; j++) {
          const h = String(headers[j]).trim().toLowerCase();
          
          if (h.includes('tanggal berkunjung') || h === 'tanggal') colIndices["Tanggal Berkunjung"] = j;
          else if (h.includes('rentang waktu')) colIndices["Rentang Waktu"] = j;
          else if (h === 'nama lengkap' || h.includes('nama pelanggan')) colIndices["Nama Lengkap"] = j;
          else if (h === 'nama panggilan') colIndices["Nama Panggilan"] = j;
          else if (h.includes('customer advisor')) colIndices["Customer Advisor"] = j;
          else if (h.includes('served by')) colIndices["Served By"] = j;
          else if (h.includes('lokasi store') || h === 'lokasi') colIndices["Lokasi Store"] = j;
          else if (h.includes('status kedatangan')) colIndices["Status Kedatangan"] = j;
          else if (h.includes('no hp') || h.includes('phone') || h.includes('handphone')) colIndices["No HP"] = j;
          else if (h === 'email') colIndices["Email"] = j;
          else if (h === 'etnis') colIndices["Etnis"] = j;
          else if (h.includes('status pelanggan')) colIndices["Status Pelanggan"] = j;
          else if (h.includes('prospek level')) colIndices["Prospek Level"] = j;
          else if (h === 'kota' || h.includes('domisili')) colIndices["Domisili"] = j;
          else if (h.includes('kewarganegaraan') || h.includes('luar neg')) colIndices["Domisili Luar Negeri"] = j;
          else if (h.includes('minat barang') || h.includes('kategori')) colIndices["Kategori Barang"] = j;
          else if (h.includes('gross sales') || h.includes('retail price')) colIndices["Gross Sales (Retail Price)"] = j;
          else if (h.includes('penawaran discount')) colIndices["Penawaran Discount"] = j;
          else if (h === 'discount (rp)' || h.includes('nilai discount')) colIndices["Discount (RP)"] = j;
          else if (h.includes('net sales')) colIndices["Net Sales"] = j;
          else if (h.includes('detail item')) colIndices["Detail Items"] = j;
          else if (h === 'descriptions' || h === 'deskripsi') colIndices["Descriptions"] = j;
          else if (h === 'notes' || h === 'catatan') colIndices["Notes"] = j;
      }
      
      let out = [];
      
      for (let i = 1; i < data.length; i++) {
          const row = data[i];
          
          let rowData = {};
          let isEmptyRow = true;
          targetCols.forEach(col => {
              let val = colIndices[col] !== undefined ? row[colIndices[col]] : '';
              if(val !== '' && val !== null && val !== undefined) isEmptyRow = false;
              
              if (val instanceof Date) {
                  if (col === "Tanggal Berkunjung") {
                      val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
                  } else {
                     val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
                  }
              }
              rowData[col] = String(val !== undefined && val !== null ? val : '');
          });
          
          if(isEmptyRow) continue;
          
          // Apply Filters
          let match = true;
          
          if (filterLocation && filterLocation !== 'All') {
              if (rowData["Lokasi Store"] && rowData["Lokasi Store"].toLowerCase() !== filterLocation.toLowerCase()) {
                  match = false;
              }
          }
          
          if (filterMonth && filterMonth !== 'All' && rowData["Tanggal Berkunjung"]) {
              let monthStr = rowData["Tanggal Berkunjung"].split('-')[1]; // yyyy-MM-dd
              if (monthStr && parseInt(monthStr, 10).toString() !== parseInt(filterMonth, 10).toString()) {
                  match = false;
              }
          }
          
          if (filterYear && filterYear !== 'All' && rowData["Tanggal Berkunjung"]) {
               let yearStr = rowData["Tanggal Berkunjung"].split('-')[0];
               if (yearStr !== filterYear.toString()) {
                   match = false;
               }
          }
          
          if (match) {
              out.push(rowData);
          }
      }
      
      out.sort((a, b) => new Date(b["Tanggal Berkunjung"]) - new Date(a["Tanggal Berkunjung"]));
      
      // Compute Summaries
      let trafficCounts = {
          "Walk In": 0, "Follow Up": 0, "Delivery & Showing": 0, "Online Only": 0,
          "Repair Order": 0, "Repair Cancel": 0, "Repair Finish": 0, "Lainnya": 0
      };
      
      let advisorCounts = {};
      
      out.forEach(row => {
          // Traffic Status
          let st = String(row["Status Kedatangan"]).trim().toLowerCase();
          if (st.includes('walk')) trafficCounts["Walk In"]++;
          else if (st.includes('follow')) trafficCounts["Follow Up"]++;
          else if (st.includes('delivery')) trafficCounts["Delivery & Showing"]++;
          else if (st.includes('online')) trafficCounts["Online Only"]++;
          else if (st.includes('repair order')) trafficCounts["Repair Order"]++;
          else if (st.includes('cancel') || st.includes('batal')) trafficCounts["Repair Cancel"]++;
          else if (st.includes('finish') || st.includes('selesai')) trafficCounts["Repair Finish"]++;
          else trafficCounts["Lainnya"]++;
          
          // Advisor
          let adv = String(row["Customer Advisor"] || "-").trim();
          if (!advisorCounts[adv]) advisorCounts[adv] = 0;
          advisorCounts[adv]++;
      });
      
      let totalSalesTraffic = trafficCounts["Walk In"] + trafficCounts["Follow Up"] + trafficCounts["Delivery & Showing"] + trafficCounts["Online Only"];
      let totalRepairTraffic = trafficCounts["Repair Order"] + trafficCounts["Repair Cancel"] + trafficCounts["Repair Finish"];
      
      trafficCounts["Total Traffic"] = totalSalesTraffic + totalRepairTraffic + trafficCounts["Lainnya"];
      trafficCounts["Sales Traffic"] = totalSalesTraffic;
      trafficCounts["Repair Traffic"] = totalRepairTraffic;
      trafficCounts["Total Customer"] = out.length; // usually matches out.length
      
      // Formatting Advisor Summary
      let advSummary = [];
      let totalHandling = out.length;
      Object.keys(advisorCounts).forEach(key => {
          let pct = totalHandling > 0 ? ((advisorCounts[key] / totalHandling) * 100).toFixed(2) : 0;
          advSummary.push({
              advisor: key,
              total: advisorCounts[key],
              percentage: pct + "%"
          });
      });
      // Sort advisors by total descending
      advSummary.sort((a,b) => b.total - a.total);
      
      return { 
          success: true, 
          data: out, 
          columns: targetCols,
          summary: {
              traffic: trafficCounts,
              advisors: advSummary,
              totalHandling: totalHandling
          }
      };
  } catch (e) {
      return { success: false, message: e.message };
  }
}

function sendDailyReportEmail(filterLocation, filterMonth, filterYear, emailTo) {
    try {
        const result = getDailyReportData(filterLocation, filterMonth, filterYear);
        if(!result.success) throw new Error(result.message);
        
        const data = result.data;
        if(data.length === 0) throw new Error("No data found for the selected filters.");
        
        const columns = result.columns;
        
        let htmlTable = '<table border="1" style="border-collapse: collapse; font-family: sans-serif; font-size: 11px;">';
        htmlTable += '<thead style="background-color: #f2f2f2;"><tr>';
        columns.forEach(col => {
            htmlTable += `<th style="padding: 6px;">${col}</th>`;
        });
        htmlTable += '</tr></thead><tbody>';
        
        data.forEach(row => {
            htmlTable += '<tr>';
            columns.forEach(col => {
                htmlTable += `<td style="padding: 6px;">${row[col] || '-'}</td>`;
            });
            htmlTable += '</tr>';
        });
        htmlTable += '</tbody></table>';
        
        const subject = `Daily Report - Location: ${filterLocation || 'All'} [Month: ${filterMonth || 'All'}, Year: ${filterYear || 'All'}]`;
        const body = `Please find the requested daily report below.<br><br>${htmlTable}`;
        
        MailApp.sendEmail({
            to: emailTo,
            subject: subject,
            htmlBody: body
        });
        
        return { success: true, message: "Email sent successfully!" };
    } catch(e) {
        return { success: false, message: e.message };
    }
}
