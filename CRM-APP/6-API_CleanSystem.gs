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
          
          let outDate = rowTraffic[CONFIG_CRM.COLS.T.DATE];
          if (outDate && typeof outDate.getTime === 'function') {
              try {
                  outDate = Utilities.formatDate(outDate, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
              } catch(e) { outDate = String(outDate); }
          }

          if (profileMap.has(searchKey)) {
              // Profil ada. Apakah sudah pernah masuk Clean Target?
              if (!existingNamesInMaster.has(searchKey)) {
                    const clientProfile = profileMap.get(searchKey);
                    let newRow = new Array(20).fill(''); 
                    
                    newRow[CONFIG_CRM.COLS.C.DATE] = outDate;
                    newRow[CONFIG_CRM.COLS.C.CUSTOMER] = rawNameTraffic;
                    newRow[CONFIG_CRM.COLS.C.SALESMAN] = rowTraffic[CONFIG_CRM.COLS.T.SERVED_BY];
                    newRow[CONFIG_CRM.COLS.C.LOCATION] = rowTraffic[CONFIG_CRM.COLS.T.LOCATION];
                    newRow[CONFIG_CRM.COLS.C.GROSS] = rowTraffic[CONFIG_CRM.COLS.T.GROSS] || 0;
                    newRow[CONFIG_CRM.COLS.C.DISC_PCT] = rowTraffic[CONFIG_CRM.COLS.T.DISC_PCT] || 0;
                    newRow[CONFIG_CRM.COLS.C.VAL_DISC] = rowTraffic[CONFIG_CRM.COLS.T.VAL_DISC] || 0;
                    newRow[CONFIG_CRM.COLS.C.NET_SALES] = rowTraffic[CONFIG_CRM.COLS.T.NET_SALES] || 0;
                    newRow[CONFIG_CRM.COLS.C.PHONE] = clientProfile.phone;
                    newRow[CONFIG_CRM.COLS.C.HOME_LOCATION] = clientProfile.home;

                    readyToSync.push({
                        name: rawNameTraffic,
                        phone: String(clientProfile.phone),
                        netSales: Number(rowTraffic[CONFIG_CRM.COLS.T.NET_SALES]) || 0,
                        payload: newRow
                    });
              }
          } else {
              // Profil tidak ada formnya di Profiling Sheet, bocor / butuh ditagih.
              missingProfile.push({
                  date: String(outDate),
                  name: rawNameTraffic,
                  advisor: String(rowTraffic[CONFIG_CRM.COLS.T.SERVED_BY] || '-')
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
      
      // Inject secara Real-time ke Supabase raw_traffic
      const COL = CONFIG_CRM.COLS.C;
      const sbPayload = rowsPayloadArray.map(row => {
          let d = row[COL.DATE];
          if(!d) d = new Date(0);
          else if(typeof d !== 'object' || isNaN(d.getTime())) d = new Date(d);

          return {
              transaction_date: !isNaN(d.getTime()) ? d.toISOString() : null,
              customer_name: String(row[COL.CUSTOMER] || ''),
              advisor: String(row[COL.SALESMAN] || ''),
              location: String(row[COL.LOCATION] || ''),
              gross_sales: Number(row[COL.GROSS]) || 0,
              disc_pct: Number(row[COL.DISC_PCT]) || 0,
              val_disc: Number(row[COL.VAL_DISC]) || 0,
              net_sales: Number(row[COL.NET_SALES]) || 0,
              phone: String(row[COL.PHONE] || ''),
              home_location: String(row[COL.HOME_LOCATION] || '')
          };
      });
      // Kita insert (append) saja
      Supabase.insert('raw_traffic', sbPayload);

      return { success: true, count: rowsPayloadArray.length };
    } catch(e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * UTILITAS SEKALI JALAN:
   * Menyalin ribuan log lama dari Google Sheet Clean Data ke Supabase 'raw_traffic'
   * Jalankan ini HANYA SEKALI dari editor Apps Script saat pertama kali migrasi!
   */
  function syncRawTrafficSupabase() {
      try {
          const targetSS = SpreadsheetApp.openById(CONFIG_CRM.CLEAN_TARGET_SS_ID);
          const cleanSheet = targetSS.getSheetByName(CONFIG_CRM.CLEAN_SHEET_NAME);
          if (!cleanSheet) return { success: false, message: "Gagal: Sheet Clean_Data tidak ditemukan." };
          
          const cData = cleanSheet.getDataRange().getValues();
          cData.shift(); // Buang header

          const COL = CONFIG_CRM.COLS.C;
          const supabasePayload = [];
          
          cData.forEach(row => {
              const rawName = String(row[COL.CUSTOMER] || "").trim();
              if (!rawName) return; 
              
              let d = row[COL.DATE];
              if(!d) d = new Date(0);
              else if(typeof d !== 'object' || isNaN(d.getTime())) d = new Date(d);

              supabasePayload.push({
                  transaction_date: !isNaN(d.getTime()) ? d.toISOString() : null,
                  customer_name: rawName,
                  advisor: String(row[COL.SALESMAN] || ""),
                  location: String(row[COL.LOCATION] || ""),
                  gross_sales: Number(row[COL.GROSS]) || 0,
                  disc_pct: Number(row[COL.DISC_PCT]) || 0,
                  val_disc: Number(row[COL.VAL_DISC]) || 0,
                  net_sales: Number(row[COL.NET_SALES]) || 0,
                  phone: String(row[COL.PHONE] || ""),
                  home_location: String(row[COL.HOME_LOCATION] || "")
              });
          });

          if(supabasePayload.length > 0) {
                // Jangan kosongkan karena ada riwayat baru nantinya jika digabung.
                // Tapi untuk migrasi pertama, kita kosongkan dulu.
                Supabase.del('raw_traffic', '?id=not.is.null'); // Kosongkan
                
                const BATCH_SIZE = 1000;
                for (let i = 0; i < supabasePayload.length; i += BATCH_SIZE) {
                    const chunk = supabasePayload.slice(i, i + BATCH_SIZE);
                    Supabase.insert('raw_traffic', chunk);
                }
          }
          
          return { success: true, count: supabasePayload.length, message: "Sinkronisasi Migrasi Histori Raw Traffic berhasil!" };
      } catch(e) {
          return { success: false, message: e.message };
      }
  }

  // ============================
  // Modul API Khusus untuk Customer Master (Loyalty & Tiering)
  // (Dipindahkan dari 11-API_Customer.gs untuk sinkronisasi paksa)
  // ============================

  /**
  * Setup Tab Customer_Master (Jalankan sekali jika tab belum ada)
  */
  function setupCustomerMasterSheet() {
      try {
          const targetSS = SpreadsheetApp.openById(CONFIG_CRM.CLEAN_TARGET_SS_ID);
          let sheet = targetSS.getSheetByName(CONFIG_CRM.CUSTOMER_SHEET_NAME);
          
          if (!sheet) {
              sheet = targetSS.insertSheet(CONFIG_CRM.CUSTOMER_SHEET_NAME);
              const headers = [
                  'Full Name', 'Phone Number', 'Total Spend (LTV)',
                  'Freq Invoice', 'Loyalty Tier', 'Last Purchase Date', 'Main Advisor'
              ];
              sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
              sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f8fafc");
              
              // Format column C as number only
              sheet.getRange("C2:C").setNumberFormat(`#,##0`);
              // Format format date
              sheet.getRange("G2:G").setNumberFormat(`dd MMM yyyy`);
              
              sheet.setFrozenRows(1);
          }
          return { success: true, message: "Sheet Customer_Master siap." };
      } catch (e) {
          return { success: false, message: "Gagal Setup Sheet Customer_Master: " + e.message };
      }
  }

  /**
  * Endpoint Utama Sinkronisasi Profil & Spend dari Clean Data
  * Menghitung LTV dan merumuskan ulang Tier
  */
  function syncCustomerMaster() {
      try {
          const targetSS = SpreadsheetApp.openById(CONFIG_CRM.CLEAN_TARGET_SS_ID);
          
          // 1. Baca Clean Data (Base Source)
          const cleanSheet = targetSS.getSheetByName(CONFIG_CRM.CLEAN_SHEET_NAME);
          if (!cleanSheet) return { success: false, message: "Gagal: Sheet Clean_Data tidak ditemukan." };
          
          const cData = cleanSheet.getDataRange().getValues();
          cData.shift(); // Buang header

          const COL_CL = CONFIG_CRM.COLS.C; // Reference config
          
          // Objek untuk merangkum belanja per-pelanggan (Key: lowerCase name atau Phone jika ada)
          const custMap = {};
          
          cData.forEach(row => {
              const rawName = String(row[COL_CL.CUSTOMER] || "").trim();
              if (!rawName || rawName.toLowerCase() === "customer" || rawName.toLowerCase() === "walk_in") return; // Abaikan data anonim
              
              const phone = String(row[COL_CL.PHONE] || "").trim();
              const dateStr = row[COL_CL.DATE];
              const net = Number(row[COL_CL.NET_SALES]) || 0;
              const adv = String(row[COL_CL.SALESMAN] || "").trim();
              
              let d = new Date(dateStr);
              if (isNaN(d.getTime())) d = new Date(0); // fallback

              // Validasi dan Perbaiki Deduplikasi: 
              // Gunakan murni Nama Pelanggan sebagai Key utama pemersatu histori transaksi
              const key = rawName.toLowerCase();
              
              if (!custMap[key]) {
                  custMap[key] = {
                      nameKey: rawName, // Keep capitalized one
                      phone: phone,
                      totalSpend: 0,
                      freq: 0,
                      lastDate: d,
                      advisorFreq: {} // Untuk cari The Main Advisor
                  };
              } else {
                  // Jika customer sudah eksis tapi nomor HP nya kosong (length < 5)
                  // namun di transaksi *ini* dia memberikan nomor HP (length > 5), kita UPDATE profilnya!
                  if (phone.length > 5 && (!custMap[key].phone || custMap[key].phone.length < 5)) {
                      custMap[key].phone = phone;
                  }
              }
              
              const cp = custMap[key];
              cp.totalSpend += net;
              cp.freq += 1; // 1 baris = 1 transaksi
              
              if (d > cp.lastDate) {
                  cp.lastDate = d;
              }
              
              if(adv) {
                  cp.advisorFreq[adv] = (cp.advisorFreq[adv] || 0) + 1;
              }
          });

          // 2. Kalkulasi Tier & Siapkan Output Rows
        const outputRows = [];
        const supabasePayload = [];
        const today = new Date();

          for (const key in custMap) {
              const cp = custMap[key];
              
              // Hitung Recency (Jarak hari dari belanja terakhir)
              const diffTime = Math.abs(today - cp.lastDate);
              const recencyDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              // Tentukan Loyalty Tier
              let tier = "";
              if (recencyDays > 730) {
                  tier = "Inactive";
              } else {
                  if (cp.totalSpend > 1350000000) tier = "Top Spender";
                  else if (cp.totalSpend >= 200000000) tier = "Elite";
                  else if (cp.totalSpend >= 50000000) tier = "High Potential";
                  else if (cp.totalSpend > 0) tier = "Potential";
                  else tier = "Prospect";
              }
              
              // Cari Main Advisor
              let mainAdv = "-";
              let maxAdvHit = 0;
              for(const k in cp.advisorFreq) {
                  if(cp.advisorFreq[k] > maxAdvHit) {
                      maxAdvHit = cp.advisorFreq[k];
                      mainAdv = k;
                  }
              }
              
              // Format Last Date untuk output Spreadsheet
              let outDate = "";
              if(cp.lastDate.getTime() > 0) {
                  outDate = Utilities.formatDate(cp.lastDate, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
              }

              const rowData = [];
              rowData[CONFIG_CRM.COLS_CUST.NAME] = cp.nameKey;
              rowData[CONFIG_CRM.COLS_CUST.PHONE] = cp.phone;
              rowData[CONFIG_CRM.COLS_CUST.TOTAL_SPEND] = cp.totalSpend;
              rowData[CONFIG_CRM.COLS_CUST.FREQ_INVOICE] = cp.freq;
              rowData[CONFIG_CRM.COLS_CUST.TIER] = tier;
            rowData[CONFIG_CRM.COLS_CUST.LAST_PURCHASE] = outDate;
            rowData[CONFIG_CRM.COLS_CUST.ADVISOR] = mainAdv;
            
            outputRows.push(rowData);

            // Construct Supabase JSON Payload
            supabasePayload.push({
                fullname: cp.nameKey.substring(0, 100), // Safety clip
                phone: cp.phone ? cp.phone : null,
                total_spend: cp.totalSpend,
                freq_invoice: cp.freq,
                loyalty_tier: tier,
                last_purchase: cp.lastDate.getTime() > 0 ? cp.lastDate.toISOString() : null,
                main_advisor: mainAdv,
                updated_at: new Date().toISOString()
            });
        }
        
        // Urutkan paling banyak belanja di atas
          outputRows.sort((a,b) => b[CONFIG_CRM.COLS_CUST.TOTAL_SPEND] - a[CONFIG_CRM.COLS_CUST.TOTAL_SPEND]);

          // 3. Tulis (Overwrite) ke Tab Customer_Master
          let mastSheet = targetSS.getSheetByName(CONFIG_CRM.CUSTOMER_SHEET_NAME);
          if(!mastSheet) {
              setupCustomerMasterSheet(); // Pastikan ada
              mastSheet = targetSS.getSheetByName(CONFIG_CRM.CUSTOMER_SHEET_NAME);
          }
          
          const lastRow = mastSheet.getLastRow();
          if (lastRow > 1) {
              mastSheet.getRange(2, 1, lastRow - 1, mastSheet.getLastColumn()).clearContent();
          }
          
          if (outputRows.length > 0) {
              mastSheet.getRange(2, 1, outputRows.length, outputRows[0].length).setValues(outputRows);
              // Paksa reset format agar Rp hilang di sheet yang sudah terlanjur dibuat
              mastSheet.getRange("C2:C").setNumberFormat('#,##0');
              
              // 4. Sinkronisasi ke Supabase
              // Pertama, kosongkan master table `crm_customers` (Aggregated)
              Supabase.del('crm_customers', '?id=not.is.null'); // Delete all
              
              // Kedua, insert massive data
              // Karena URL Fetch ada batas payload 50MB, kita main aman insert per 1000 baris
              const BATCH_SIZE = 1000;
              for (let i = 0; i < supabasePayload.length; i += BATCH_SIZE) {
                  const chunk = supabasePayload.slice(i, i + BATCH_SIZE);
                  Supabase.insert('crm_customers', chunk);
              }
          }
          
          return { success: true, count: outputRows.length, message: "Sinkronisasi Tier Pelanggan ke GSheet & Supabase berhasil!" };
          
      } catch (e) {
          return { success: false, message: "System Error Sync Customer: " + e.message };
      }
  }

  /**
  * API untuk dipanggil oleh Frontend (Client)
  * Hanya baca data dari Customer_Master (Kencang dan ringan)
  */
  function getCustomerMasterList() {
      try {
          const response = Supabase.get('crm_customers', '?select=*&order=total_spend.desc&limit=10000');
          if (!response.success) {
               return { success: false, message: "Koneksi Supabase Gagal: " + response.message };
          }
          
          const sData = response.data;
          if (!sData || sData.length === 0) {
               return { success: false, message: "Database belum disinkronisasi ke Supabase." };
          }
          
          const responseData = [];
          
          // Aggregators for KPI
          let totalVal = 0;
          const tierCounts = {
              "Top Spender": 0,
              "Elite": 0,
              "High Potential": 0,
              "Potential": 0,
              "Prospect": 0,
              "Inactive": 0
          };
          
          sData.forEach(row => {
              const name = String(row.fullname);
              if(!name) return;
              
              const tier = String(row.loyalty_tier);
              if (tierCounts[tier] !== undefined) tierCounts[tier]++;
              
              const spend = Number(row.total_spend) || 0;
              totalVal += spend;
              
              let d = row.last_purchase;
              if(d) {
                  const dateObj = new Date(d);
                  if(!isNaN(dateObj.getTime())) {
                       d = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "dd MMM yyyy");
                  } else {
                       d = "-";
                  }
              } else {
                  d = "-";
              }

              responseData.push({
                  name: name,
                  phone: String(row.phone || '-'), // Handle null
                  spend: spend,
                  freq: Number(row.freq_invoice) || 0,
                  tier: tier,
                  lastDate: String(d),
                  advisor: String(row.main_advisor || '-')
              });
          });
          
          return { 
            success: true, 
            data: responseData, 
            stats: {
                totalCustomers: responseData.length,
                totalValue: totalVal,
                tiers: tierCounts
            }
          };
          
      } catch(e) {
          return { success: false, message: "Fetch Error (Supabase): " + e.message };
      }
  }

  /**
   * API untuk mengambil riwayat 360 transaksi pelanggan dari raw_traffic Supabase
   */
  function getClient360Data(nameInput) {
      try {
          // Kita query ke Supabase table raw_traffic berdasarkan nama pelanggan
          // Encode nama untuk mencegah error pada URL
          const encName = encodeURIComponent(String(nameInput));
          const query = `?customer_name=eq.${encName}&order=transaction_date.desc`;
          
          const response = Supabase.get('raw_traffic', query);
          if (!response.success) {
               return { success: false, message: "Gagal menarik histori: " + response.message };
          }
          
          const data = response.data || [];
          
          // Format data
          const formattedData = data.map(item => {
              let dStr = "-";
              if (item.transaction_date) {
                  let dObj = new Date(item.transaction_date);
                  if (!isNaN(dObj.getTime())) {
                      dStr = Utilities.formatDate(dObj, Session.getScriptTimeZone(), "dd MMM yyyy HH:mm");
                  }
              }
              
              return {
                  date: dStr,
                  location: item.location || "-",
                  advisor: item.advisor || "-",
                  gross: item.gross_sales || 0,
                  net: item.net_sales || 0
              };
          });
          
          return { success: true, data: formattedData, customerName: nameInput };
      } catch(e) {
          return { success: false, message: "System Error Client360: " + e.message };
      }
  }
