/**
 * File: Supabase.gs
 * Description: Core helper to interact with Supabase REST API via Google Apps Script (UrlFetchApp).
 */

const Supabase = {
    /**
     * Standard headers required by Supabase REST API
     */
    _getHeaders: function() {
        return {
            "apikey": CONFIG_CRM.SUPABASE.KEY,
            "Authorization": "Bearer " + CONFIG_CRM.SUPABASE.KEY,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        };
    },

    /**
     * Fetch all records from a table (GET)
     * @param {string} table - Table name in Supabase
     * @param {string} query - Optional query string (e.g. "?select=*&order=created_at.desc")
     */
    get: function(table, query = "") {
        try {
            const url = `${CONFIG_CRM.SUPABASE.URL}/rest/v1/${table}${query}`;
            const options = {
                method: "get",
                headers: this._getHeaders(),
                muteHttpExceptions: true
            };
            
            const response = UrlFetchApp.fetch(url, options);
            const code = response.getResponseCode();
            
            if (code >= 200 && code < 300) {
                return { success: true, data: JSON.parse(response.getContentText()), code: code };
            } else {
                return { success: false, message: response.getContentText(), code: code };
            }
        } catch(e) {
            return { success: false, message: e.message, code: 500 };
        }
    },

    /**
     * Insert records into a table (POST)
     * @param {string} table - Table name in Supabase
     * @param {Object|Array} payload - JSON object or Array of JSON objects
     */
    insert: function(table, payload) {
        try {
            const url = `${CONFIG_CRM.SUPABASE.URL}/rest/v1/${table}`;
            const options = {
                method: "post",
                headers: this._getHeaders(),
                payload: JSON.stringify(payload),
                muteHttpExceptions: true
            };
            
            const response = UrlFetchApp.fetch(url, options);
            const code = response.getResponseCode();
            
            if (code === 201 || (code >= 200 && code < 300)) {
                return { success: true, data: JSON.parse(response.getContentText()), code: code };
            } else {
                return { success: false, message: response.getContentText(), code: code };
            }
        } catch(e) {
            return { success: false, message: e.message, code: 500 };
        }
    },

    /**
     * Upsert records (Insert or Update if exists)
     * Requires the primary key or unique constraint to be matched.
     */
    upsert: function(table, payload) {
        try {
            const url = `${CONFIG_CRM.SUPABASE.URL}/rest/v1/${table}`;
            const headers = this._getHeaders();
            headers["Prefer"] = "return=representation,resolution=merge-duplicates";
            
            const options = {
                method: "post",
                headers: headers,
                payload: JSON.stringify(payload),
                muteHttpExceptions: true
            };
            
            const response = UrlFetchApp.fetch(url, options);
            const code = response.getResponseCode();
            
            if (code === 201 || (code >= 200 && code < 300)) {
                return { success: true, data: JSON.parse(response.getContentText()), code: code };
            } else {
                return { success: false, message: response.getContentText(), code: code };
            }
        } catch(e) {
            return { success: false, message: e.message, code: 500 };
        }
    },

    /**
     * Update existing records (PATCH)
     * @param {string} table - Table name
     * @param {Object} payload - Data to update
     * @param {string} matchQuery - Conditions e.g. "?id=eq.123"
     */
    update: function(table, payload, matchQuery) {
        try {
            const url = `${CONFIG_CRM.SUPABASE.URL}/rest/v1/${table}${matchQuery}`;
            const options = {
                method: "patch",
                headers: this._getHeaders(),
                payload: JSON.stringify(payload),
                muteHttpExceptions: true
            };
            
            const response = UrlFetchApp.fetch(url, options);
            const code = response.getResponseCode();
            
            if (code >= 200 && code < 300) {
                return { success: true, data: JSON.parse(response.getContentText() || "{}"), code: code };
            } else {
                return { success: false, message: response.getContentText(), code: code };
            }
        } catch(e) {
            return { success: false, message: e.message, code: 500 };
        }
    },

    /**
     * Delete records (DELETE)
     * @param {string} matchQuery - Conditions e.g. "?id=eq.123"
     */
    del: function(table, matchQuery) {
        try {
            const url = `${CONFIG_CRM.SUPABASE.URL}/rest/v1/${table}${matchQuery}`;
            const options = {
                method: "delete",
                headers: this._getHeaders(),
                muteHttpExceptions: true
            };
            
            const response = UrlFetchApp.fetch(url, options);
            const code = response.getResponseCode();
            
            if (code >= 200 && code < 300) {
                return { success: true, code: code };
            } else {
                return { success: false, message: response.getContentText(), code: code };
            }
        } catch(e) {
            return { success: false, message: e.message, code: 500 };
        }
    }
};
