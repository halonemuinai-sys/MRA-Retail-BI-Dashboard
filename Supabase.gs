/**
 * File: Supabase.gs
 * Description: Core REST API helper for Supabase — Outer Sales Dashboard.
 * Uses CONFIG.SUPABASE.URL and CONFIG.SUPABASE.KEY from 1-Config.gs.
 */

const SupabaseDB = {
    _getHeaders: function() {
        return {
            "apikey": CONFIG.SUPABASE.KEY,
            "Authorization": "Bearer " + CONFIG.SUPABASE.KEY,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        };
    },

    get: function(table, query) {
        query = query || "";
        try {
            const url = CONFIG.SUPABASE.URL + "/rest/v1/" + table + query;
            const res = UrlFetchApp.fetch(url, { method: "get", headers: this._getHeaders(), muteHttpExceptions: true });
            const code = res.getResponseCode();
            if (code >= 200 && code < 300) return { success: true, data: JSON.parse(res.getContentText()), code: code };
            return { success: false, message: res.getContentText(), code: code };
        } catch(e) { return { success: false, message: e.message, code: 500 }; }
    },

    insert: function(table, payload) {
        try {
            const url = CONFIG.SUPABASE.URL + "/rest/v1/" + table;
            const res = UrlFetchApp.fetch(url, {
                method: "post",
                headers: this._getHeaders(),
                payload: JSON.stringify(payload),
                muteHttpExceptions: true
            });
            const code = res.getResponseCode();
            if (code >= 200 && code < 300) return { success: true, data: JSON.parse(res.getContentText()), code: code };
            return { success: false, message: res.getContentText(), code: code };
        } catch(e) { return { success: false, message: e.message, code: 500 }; }
    },

    del: function(table, matchQuery) {
        try {
            const url = CONFIG.SUPABASE.URL + "/rest/v1/" + table + matchQuery;
            const res = UrlFetchApp.fetch(url, { method: "delete", headers: this._getHeaders(), muteHttpExceptions: true });
            const code = res.getResponseCode();
            if (code >= 200 && code < 300) return { success: true, code: code };
            return { success: false, message: res.getContentText(), code: code };
        } catch(e) { return { success: false, message: e.message, code: 500 }; }
    },

    /**
     * Fetch ALL rows from a table using offset-based pagination.
     * Handles datasets of any size (10k, 50k+) by looping in pages of PAGE_SIZE.
     * @param {string} table - Table name in Supabase
     * @param {string} query - Optional query string (e.g. "?transaction_date=gte.2026-01-01")
     * @returns {{ success: boolean, data: Array, code: number }}
     */
    getAllRows: function(table, query) {
        const PAGE_SIZE = 5000;
        let allData = [];
        let offset = 0;
        let hasMore = true;
        const separator = (query && query.includes("?")) ? "&" : "?";

        while (hasMore) {
            const paginatedQuery = (query || "") + separator + "limit=" + PAGE_SIZE + "&offset=" + offset;
            const result = this.get(table, paginatedQuery);

            if (!result.success) return result; // Propagate error

            if (result.data && result.data.length > 0) {
                allData = allData.concat(result.data);
                offset += result.data.length;
                // If returned fewer than PAGE_SIZE, we've reached the end
                if (result.data.length < PAGE_SIZE) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        return { success: true, data: allData, code: 200 };
    }
};

/**
 * Sinkronisasi seluruh clean_master dari Google Sheet ke Supabase.
 * Strategi: Truncate + Re-insert (Full Replace).
 * Bisa dipanggil manual atau via Time-Based Trigger.
 */
function syncCleanMasterToSupabase() {
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = ss.getSheetByName(CONFIG.SHEETS.CLEAN);
        if (!sheet) return { success: false, message: "Sheet clean_master tidak ditemukan." };

        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) return { success: false, message: "Data clean_master kosong." };

        const CC = CONFIG.CLEAN_COLS;
        const payload = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const transNo = String(row[CC.TRANS_NO] || "").trim();
            if (!transNo) continue; // Lewati baris kosong

            let d = row[CC.DATE];
            if (d && typeof d.getTime === "function" && !isNaN(d.getTime())) {
                d = d.toISOString();
            } else if (d) {
                const parsed = new Date(d);
                d = !isNaN(parsed.getTime()) ? parsed.toISOString() : null;
            } else {
                d = null;
            }

            payload.push({
                trans_no:       transNo,
                transaction_date: d,
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
            });
        }

        if (payload.length === 0) return { success: false, message: "Tidak ada data valid untuk disinkronisasi." };

        // 1. Kosongkan tabel Supabase (Full Replace)
        SupabaseDB.del("clean_master", "?id=not.is.null");

        // 2. Insert batch per 1000 baris
        const BATCH = 1000;
        let failedBatches = [];
        for (let i = 0; i < payload.length; i += BATCH) {
            const chunk = payload.slice(i, i + BATCH);
            const res = SupabaseDB.insert("clean_master", chunk);
            if (!res.success) {
                failedBatches.push("Batch " + (Math.floor(i/BATCH)+1) + ": " + res.message);
            }
        }

        if (failedBatches.length > 0) {
            return { success: false, message: "Beberapa batch gagal: " + failedBatches.join(" | "), count: payload.length };
        }

        return { success: true, count: payload.length, message: "Sinkronisasi " + payload.length + " baris clean_master ke Supabase berhasil!" };
    } catch(e) {
        return { success: false, message: e.message };
    }
}
