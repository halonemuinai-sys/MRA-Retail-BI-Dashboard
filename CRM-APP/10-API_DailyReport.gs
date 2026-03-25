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
      
      // Explicit mappings as requested
      colIndices["Discount (RP)"] = 34; // Column AI
      colIndices["Descriptions"] = 40; // Column AO
      
      let out = [];
      let trafficCounts = {
          "Walk In": 0, "Follow Up": 0, "Delivery & Showing": 0, "Online Only": 0,
          "Repair Order": 0, "Repair Cancel": 0, "Repair Finish": 0, "Lainnya": 0
      };
      let advisorCounts = {};
      let totalHandling = 0;
      
      let locIdx = colIndices["Lokasi Store"];
      let tglIdx = colIndices["Tanggal Berkunjung"];
      let stIdx = colIndices["Status Kedatangan"];
      let advIdx = colIndices["Customer Advisor"];
      
      for (let i = 1; i < data.length; i++) {
          const row = data[i];
          
          // 1. Fast Filter Check
          let match = true;
          
          if (filterLocation && filterLocation !== 'All') {
              let rowLoc = locIdx !== undefined ? String(row[locIdx] || '').trim().toLowerCase() : '';
              if (rowLoc !== filterLocation.toLowerCase()) {
                  match = false;
              }
          }
          if (!match) continue;
          
          let rawTgl = tglIdx !== undefined ? row[tglIdx] : '';
          let m = -1, y = -1;
          
          if (rawTgl) {
             if (rawTgl instanceof Date) {
                 m = rawTgl.getMonth() + 1;
                 y = rawTgl.getFullYear();
             } else {
                 let d = new Date(rawTgl);
                 if (!isNaN(d.getTime())) {
                     m = d.getMonth() + 1;
                     y = d.getFullYear();
                 }
             }
          }
          
          if (filterMonth && filterMonth !== 'All') {
              if (m === -1 || m.toString() !== filterMonth.toString()) match = false;
          }
          if (match && filterYear && filterYear !== 'All') {
              if (y === -1 || y.toString() !== filterYear.toString()) match = false;
          }
          if (!match) continue;
          
          // 2. Build rowData only for matched rows
          let rowData = {};
          let isEmptyRow = true;
          targetCols.forEach(col => {
              let val = colIndices[col] !== undefined ? row[colIndices[col]] : '';
              if (val !== '' && val !== null && val !== undefined) isEmptyRow = false;
              
              if (val instanceof Date) {
                  let yy = val.getFullYear();
                  let mm = String(val.getMonth() + 1).padStart(2, '0');
                  let dd = String(val.getDate()).padStart(2, '0');
                  if (col === "Tanggal Berkunjung") {
                      val = `${yy}-${mm}-${dd}`;
                  } else {
                      let hh = String(val.getHours()).padStart(2, '0');
                      let min = String(val.getMinutes()).padStart(2, '0');
                      let ss = String(val.getSeconds()).padStart(2, '0');
                      val = `${yy}-${mm}-${dd} ${hh}:${min}:${ss}`;
                  }
              }
              rowData[col] = String(val !== undefined && val !== null ? val : '');
          });
          
          if (isEmptyRow) continue;
          out.push(rowData);
          
          // 3. Increment Summaries
          let st = stIdx !== undefined ? String(row[stIdx] || '').trim().toLowerCase() : '';
          if (st.includes('walk')) trafficCounts["Walk In"]++;
          else if (st.includes('follow')) trafficCounts["Follow Up"]++;
          else if (st.includes('delivery')) trafficCounts["Delivery & Showing"]++;
          else if (st.includes('online')) trafficCounts["Online Only"]++;
          else if (st.includes('repair order')) trafficCounts["Repair Order"]++;
          else if (st.includes('cancel') || st.includes('batal')) trafficCounts["Repair Cancel"]++;
          else if (st.includes('finish') || st.includes('selesai')) trafficCounts["Repair Finish"]++;
          else trafficCounts["Lainnya"]++;
          
          let adv = advIdx !== undefined ? String(row[advIdx] || '-').trim() : '-';
          if (!advisorCounts[adv]) advisorCounts[adv] = 0;
          advisorCounts[adv]++;
          totalHandling++;
      }
      
      let totalSalesTraffic = trafficCounts["Walk In"] + trafficCounts["Follow Up"] + trafficCounts["Delivery & Showing"] + trafficCounts["Online Only"];
      let totalRepairTraffic = trafficCounts["Repair Order"] + trafficCounts["Repair Cancel"] + trafficCounts["Repair Finish"];
      
      trafficCounts["Total Traffic"] = totalSalesTraffic + totalRepairTraffic + trafficCounts["Lainnya"];
      trafficCounts["Sales Traffic"] = totalSalesTraffic;
      trafficCounts["Repair Traffic"] = totalRepairTraffic;
      trafficCounts["Total Customer"] = out.length; // usually matches out.length
      
      // Formatting Advisor Summary
      let advSummary = [];
      totalHandling = out.length;
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
