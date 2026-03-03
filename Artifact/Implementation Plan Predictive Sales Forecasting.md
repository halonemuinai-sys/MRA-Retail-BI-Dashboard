# Implementation Plan: Predictive Sales Forecasting

## Concept Overview
The "Sales Forecasting" feature aims to predict the *Expected End of Month (EoM) Sales* based on the current *run-rate* (average daily sales). This gives managers early warning signs if the current sales trajectory is insufficient to meet the monthly target.

Using a linear projection, if a store has achieved $10,000 in the first 10 days of a 30-day month, their *run-rate* is $1,000/day. The system will forecast their EoM sales to be $30,000. 

## Proposed Changes

### [MODIFY] [4-API_Dashboard.gs](file:///d:/Bvlgari%20Dashboard/4-API_Dashboard.gs)
*   In [getDashboardData](file:///d:/Bvlgari%20Dashboard/4-API_Dashboard.gs#33-236), calculate the **Current Elapsed Days** of the selected month (based on the latest transaction date found in the data, or today's date if looking at the current month).
*   For the Grand Total and each individual store, calculate:
    1.  **Run-Rate:** `Current Sales / Elapsed Days`
    2.  **Forecast EoM:** `Run-Rate * Total Days in Month`
    3.  **Required Run-Rate:** [(Target - Current Sales) / Remaining Days](file:///d:/Bvlgari%20Dashboard/ExportHandler.html#38-71) (To show what they *need* to do to catch up).
*   Attach these new metrics to the `overview.kpi` and `overview.segments` payloads.

### [MODIFY] [ViewMonthly.html](file:///d:/Bvlgari%20Dashboard/ViewMonthly.html)
*   Add a new visual indicator or a small card next to the "Achievement" KPI to show the "Forecast Achv %".
*   In the "Store Performance Ranking" table, add a new column for "Forecast" to show the predicted end-of-month figure for each store.

### [MODIFY] [JavaScript.html](file:///d:/Bvlgari%20Dashboard/JavaScript.html)
*   Update `RENDER.monthly` to populate the new Forecast KPIs and table columns.
*   Update the "Daily Sales Trend" chart (`renderOverallTrend`) to include a "Target Line" and possibly a dotted "Forecast Line" extending from the current day to the end of the month, visually indicating if the trajectory hits the target.

## Verification
1. Open the Monthly View for a month that is still in progress.
2. Verify the "Forecast" numbers logically make sense based on the current Run-Rate.
3. Check the Daily Sales Trend chart to ensure the projection lines are rendered correctly without breaking existing tooltips.
