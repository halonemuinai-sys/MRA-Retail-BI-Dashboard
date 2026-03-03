# Implementation Plan: Data Caching with CacheService

## Goal Description
The dashboard currently suffers from long loading times when users switch between views (Monthly, Quarterly, etc.) or change filters, as it reads directly from Google Sheets every time. To dramatically improve performance, we will implement Google Apps Script's `CacheService` to temporarily store the results of expensive cross-sheet queries.

## Caching Strategy
1.  **Cache Scope:** `CacheService.getScriptCache()` (shared across all users of the script to maximize cache hits).
2.  **Expiration:** 5 Minutes (300 seconds) - This provides an optimal balance between "instant loading" when clicking around tabs and "data freshness" when the Google Sheet is updated by staff.
3.  **Data Limits:** `CacheService` allows max 100KB per string. The JSON payloads might occasionally exceed this if the data is massive. To be safe, we will implement chunked caching (splitting string into parts) OR only cache the final processed objects if they are small enough (which they are, as we aggregate in GAS, not sending raw rows). The returned objects from [getDashboardData](file:///d:/Bvlgari%20Dashboard/4-API_Dashboard.gs#33-209) and [getQuarterlyData](file:///d:/Bvlgari%20Dashboard/8-API_Quarterly.gs#6-167) are heavily aggregated and will easily fit under 100KB.

## Proposed Changes

### [MODIFY] [4-API_Dashboard.gs](file:///d:/Bvlgari%20Dashboard/4-API_Dashboard.gs)
*   In [getDashboardData(monthName, year)](file:///d:/Bvlgari%20Dashboard/4-API_Dashboard.gs#33-209):
    *   Generate a unique cache key: `DASH_${monthName}_${year}`.
    *   Check `CacheService.getScriptCache().get(key)`. If exists, `JSON.parse` and return immediately.
    *   If not, run the standard data fetching logic.
    *   Before returning, `CacheService.getScriptCache().put(key, JSON.stringify(result), 300)`.

### [MODIFY] [8-API_Quarterly.gs](file:///d:/Bvlgari%20Dashboard/8-API_Quarterly.gs)
*   In [getQuarterlyData(quarterStr, yearStr)](file:///d:/Bvlgari%20Dashboard/8-API_Quarterly.gs#6-167):
    *   Generate cache key: `QTR_${quarterStr}_${yearStr}`.
    *   Check cache before processing.
    *   Store in cache for 300 seconds after processing.

### [MODIFY] [JavaScript.html](file:///d:/Bvlgari%20Dashboard/JavaScript.html)
*   **Force Refresh (Sync Button):** When a user clicks the "Sync" button (currently calls `APP.loadDashboard()`), we need a way to bypass the cache if the user explicitly wants fresh data.
*   Update backend functions to accept a `forceRefresh` boolean argument.
    *   Example: [getDashboardData(monthName, year, forceRefresh)](file:///d:/Bvlgari%20Dashboard/4-API_Dashboard.gs#33-209)
    *   If `forceRefresh` is true, delete the cache key before fetching.
*   Update the JS API caller (`google.script.run`) to pass this new parameter when triggered by the Sync button.

## Verification Plan
1.  Open the dashboard. The first load should take the usual amount of time (e.g., 2-4 seconds).
2.  Switch to another tab or change the filter back and forth. The subsequent loads for previously viewed months/quarters should render almost instantaneously (< 0.5 seconds).
3.  Click the "Sync" button and observe the loader indicating a full backend refresh rather than a cached response.
