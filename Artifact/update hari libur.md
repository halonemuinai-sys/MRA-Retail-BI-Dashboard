# Implementation Plan: Add Indonesian Holidays to Daily Breakdown

## Goal Description
The user wants to add a visual indicator (like an asterisk *) with a tooltip to dates in the "Daily Breakdown (All Stores)" table that fall on Indonesian public holidays or joint leave days (cuti bersama).

## Proposed Changes

### 1. Backend Data Source ([2-Utilities.gs](file:///d:/Bvlgari%20Dashboard/2-Utilities.gs) or similar)
Since we need a reliable list of Indonesian holidays for the years the dashboard handles (e.g., 2023-2026), calling an external API on every dashboard load is slow and prone to failure (Google Apps Script quota limits).

**Approach**: Create a static map/dictionary of known Indonesian holidays within [1-Config.gs](file:///d:/Bvlgari%20Dashboard/1-Config.gs) or a dedicated helper file (`7-Holidays.gs`), or fetch them dynamically once and cache them. Given the scope, a hardcoded map of crucial recent/upcoming holidays (2024-2026) is the most robust way for a GAS project, or we can use a free API like `date.nager.at` but it might not have "Cuti Bersama". A built-in dictionary is safer and faster.

Let's maintain a dictionary:
```json
{
  "2024-01-01": "Tahun Baru Masehi",
  "2024-02-08": "Isra Mikraj",
  "2024-02-09": "Cuti Bersama Tahun Baru Imlek",
  // ... etc
}
```

### 2. Dashboard Data Enrichment ([4-API_Dashboard.gs](file:///d:/Bvlgari%20Dashboard/4-API_Dashboard.gs) / [getDashboardData](file:///d:/Bvlgari%20Dashboard/4-API_Dashboard.gs#33-197))
*   Pass the holiday map (or just the holidays for the requested [month](file:///d:/Bvlgari%20Dashboard/JavaScript.html#534-609) and `year`) down to the frontend inside the `dashboardData.kpi` or a new `dashboardData.holidays` object.

### 3. Frontend Rendering ([JavaScript.html](file:///d:/Bvlgari%20Dashboard/JavaScript.html) / [monthlyTransaction](file:///d:/Bvlgari%20Dashboard/JavaScript.html#610-688) renderer)
*   In the [monthlyTransaction](file:///d:/Bvlgari%20Dashboard/JavaScript.html#610-688) function, when building the `dailyHtml` loop:
    *   Form the date string in `YYYY-MM-DD` format to check against the holiday dictionary.
    *   If a match is found:
        *   Append a `*` or a small icon next to the date.
        *   Add a `title="..."` attribute (or a custom tooltip class) to the `<td>` displaying the holiday name.
        *   Optionally style the row slightly differently (e.g., text color).

## User Review Required
We will need to confirm if a hardcoded list of holidays (maintained annually by an admin) is acceptable, as there's no official, always-up-to-date and 100% accurate API for *Cuti Bersama* in Indonesia without paid services. We can provide a comprehensive list for 2024 and 2025.

## Verification Plan
1. Open the "Monthly Transaction" tab.
2. Select a month known to have a holiday (e.g., April 2024 for Eid).
3. Verify the daily breakdown table shows the indicator on the correct dates and the tooltip appears on hover.
