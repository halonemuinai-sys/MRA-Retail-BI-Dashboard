/**
 * File: Supabase.gs
 * Description: Modular Sync Engine for Supabase - BI Dashboard.
 */

// ==========================================
// --- 1. SUPABASE DATABASE CLIENT ---
// ==========================================
const SupabaseDB = {
    _getHeaders: function() {
        return {
            "apikey": CONFIG.SUPABASE.KEY,
            "Authorization": "Bearer " + CONFIG.SUPABASE.KEY,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        };
    },

    _buildUrl: function(table, query) {
        let baseUrl = CONFIG.SUPABASE.URL;
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        if (baseUrl.endsWith('/rest/v1')) baseUrl = baseUrl.slice(0, -8);
        return baseUrl + "/rest/v1/" + table + (query || "");
    },

    get: function(table, query) {
        try {
            const url = this._buildUrl(table, query);
            const res = UrlFetchApp.fetch(url, { method: "get", headers: this._getHeaders(), muteHttpExceptions: true });
            const responseText = res.getContentText();
            if (res.getResponseCode() >= 300) Logger.log("Error Get " + table + ": " + responseText);
            return { success: res.getResponseCode() < 300, data: JSON.parse(responseText) };
        } catch(e) { return { success: false, message: e.message }; }
    },

    insert: function(table, payload) {
        try {
            const url = this._buildUrl(table, "");
            const res = UrlFetchApp.fetch(url, {
                method: "post",
                headers: this._getHeaders(),
                payload: JSON.stringify(payload),
                muteHttpExceptions: true
            });
            const responseText = res.getContentText();
            if (res.getResponseCode() >= 300) Logger.log("Error Insert " + table + ": " + responseText);
            return { success: res.getResponseCode() < 300, data: JSON.parse(responseText) };
        } catch(e) { return { success: false, message: e.message }; }
    },

    del: function(table, matchQuery) {
        try {
            const url = this._buildUrl(table, matchQuery);
            const res = UrlFetchApp.fetch(url, { method: "delete", headers: this._getHeaders(), muteHttpExceptions: true });
            if (res.getResponseCode() >= 300) Logger.log("Error Delete " + table + ": " + res.getContentText());
            return { success: res.getResponseCode() < 300 };
        } catch(e) { return { success: false, message: e.message }; }
    }
};

// ==========================================
// --- 2. DATA EXTRACTORS (TRANSFORM LAYER) ---
// ==========================================
const Extractors = {
    /**
     * Mengambil dan membersihkan data dari clean_master
     */
    cleanMaster: function() {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
        const data = sheet.getDataRange().getValues();
        const CC = CONFIG.CLEAN_COLS;
        
        return data.slice(1).filter(row => row[CC.TRANS_NO]).map(row => {
            let d = row[CC.DATE];
            let dateIso = (d instanceof Date && !isNaN(d.getTime())) ? d.toISOString() : null;
            
            return {
                trans_no:       String(row[CC.TRANS_NO]),
                transaction_date: dateIso,
                customer:       String(row[CC.CUSTOMER] || ""),
                salesman:       String(row[CC.SALESMAN] || ""),
                location:       String(row[CC.LOCATION] || ""),
                sap_code:       String(row[CC.SAP] || ""),
                main_category:  String(row[CC.MAIN_CAT] || ""),
                collection:     String(row[CC.COLL] || ""),
                gross_sales:    Number(row[CC.GROSS]) || 0,
                disc_pct:       Number(row[CC.DISC_PCT]) || 0,
                val_disc:       Number(row[CC.VAL_DISC]) || 0,
                net_price:      Number(row[CC.NET_PRICE]) || 0,
                comm:           Number(row[CC.COMM]) || 0,
                cost:           Number(row[CC.SELLING_COST]) || 0,
                net_sales:      Number(row[CC.NET_SALES]) || 0,
                type:           String(row[CC.TYPE] || ""),
                qty:            parseInt(row[CC.QTY]) || 0,
                catalogue_code: String(row[CC.CATALOGUE] || "")
            };
        });
    },

    /**
     * Menggabungkan data footfall dari 3 toko
     */
    footfall: function() {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const stores = [
            { name: CONFIG.SHEETS.FOOTFALL_PI, loc: "Plaza Indonesia" },
            { name: CONFIG.SHEETS.FOOTFALL_PS, loc: "Plaza Senayan" },
            { name: CONFIG.SHEETS.FOOTFALL_BL, loc: "Bali" }
        ];
        
        let payload = [];
        stores.forEach(store => {
            const sheet = ss.getSheetByName(store.name);
            if (!sheet) return;
            const data = sheet.getDataRange().getValues();
            data.slice(1).forEach(row => {
                if (!row[0]) return;
                let d = row[0] instanceof Date ? row[0] : new Date(row[0]);
                if (isNaN(d.getTime())) return;

                payload.push({
                    date: d.toISOString(),
                    location: store.loc,
                    count_in: Number(row[2]) || 0,
                    count_out: Number(row[3]) || 0
                });
            });
        });
        return payload;
    },

    /**
     * Mengambil data Target Toko
     */
    targets: function() {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = ss.getSheetByName(CONFIG.SHEETS.MASTER_TARGET_STORE);
        if (!sheet) return [];
        
        const data = sheet.getDataRange().getValues();
        const header = data[0];
        const payload = [];
        const currentYear = new Date().getFullYear();
        
        data.slice(1).forEach(row => {
            const storeName = String(row[0] || "").trim();
            if (!storeName) return;

            for (let col = 1; col < header.length; col++) {
                const monthName = String(header[col] || "").trim();
                if (!monthName) continue;
                payload.push({
                    store_name: storeName,
                    month: monthName,
                    month_index: col,
                    year: currentYear,
                    target_value: Number(row[col]) || 0
                });
            }
        });
        return payload;
    },

    /**
     * Mengambil data Stock dari master_stock
     */
    stock: function() {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = ss.getSheetByName(CONFIG.SHEETS.MASTER_STOCK);
        if (!sheet) return [];
        
        const data = sheet.getDataRange().getValues();
        const payload = [];
        
        // Skip header, loop rows
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row[0] || !row[1] || !row[2]) continue; // Year, Location, Category must exist
            
            payload.push({
                year:       parseInt(row[0]) || 0,
                location:   String(row[1]).trim(),
                category:   String(row[2]).trim(),
                jan:        Number(row[3]) || 0,
                feb:        Number(row[4]) || 0,
                mar:        Number(row[5]) || 0,
                apr:        Number(row[6]) || 0,
                may:        Number(row[7]) || 0,
                jun:        Number(row[8]) || 0,
                jul:        Number(row[9]) || 0,
                aug:        Number(row[10]) || 0,
                sep:        Number(row[11]) || 0,
                oct:        Number(row[12]) || 0,
                nov:        Number(row[13]) || 0,
                dec:        Number(row[14]) || 0
            });
        }
        return payload;
    }
};

// ==========================================
// --- 3. SYNC ENGINE (ORCHESTRATOR) ---
// ==========================================

/**
 * Fungsi utama untuk menjalankan seluruh sinkronisasi
 */
function syncAllToSupabase() {
    const results = [];
    results.push(runSync("clean_master", Extractors.cleanMaster));
    results.push(runSync("footfall_data", Extractors.footfall));
    results.push(runSync("targets", Extractors.targets));
    results.push(runSync("stock_store", Extractors.stock));
    
    Logger.log("Sync Results: " + JSON.stringify(results));
    return results;
}

/**
 * Fungsi khusus untuk sinkronisasi data Stock saja.
 * Bisa dijalankan manual dari menu "Run" di Apps Script.
 */
function syncStockOnly() {
  const result = runSync("stock_store", Extractors.stock);
  Logger.log("Stock Sync Result: " + JSON.stringify(result));
  return result;
}

/**
 * Helper untuk menjalankan satu proses sinkronisasi (Truncate + Insert)
 */
function runSync(tableName, extractorFn) {
    try {
        const data = extractorFn();
        if (data.length === 0) return { table: tableName, success: false, message: "No data to sync" };

        // 1. Truncate Table
        const delRes = SupabaseDB.del(tableName, "?id=not.is.null");
        if (!delRes.success) return { table: tableName, success: false, message: "Failed to truncate" };

        // 2. Insert Data in Batches (untuk menghindari payload too large)
        const BATCH_SIZE = 500;
        let successCount = 0;
        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const chunk = data.slice(i, i + BATCH_SIZE);
            const res = SupabaseDB.insert(tableName, chunk);
            if (res.success) successCount += chunk.length;
            else Logger.log("Batch failed for " + tableName + ": " + JSON.stringify(res));
        }

        return { table: tableName, success: true, count: successCount };
    } catch (e) {
        return { table: tableName, success: false, error: e.message };
    }
}
