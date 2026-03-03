# Implementation Plan: Quarterly Performance View

## Goal Description
The user wants to add a new "Quarterly" view to the retail dashboard. To keep the existing files manageable and avoid massive code files, this new feature will be built using newly created files for both the frontend markup and the backend logic, bridging them via the existing [Index.html](file:///d:/Bvlgari%20Dashboard/Index.html) routing.

## Proposed Changes

### [New Backend File]
#### [NEW] `8-API_Quarterly.gs`
*   Create a dedicated file for all quarterly backend functions.
*   **Function 1**: `getQuarterlyFilterOptions()`: A helper to get distinct years to populate a Q1-Q4 filter.
*   **Function 2**: `getQuarterlyData(quarter, year)`: The main logic that will:
    *   Map the requested quarter (e.g., "Q1" -> Jan, Feb, Mar) to parse data correctly.
    *   Fetch raw database transactions and target logs using the established `getDatabaseData()` pattern.
    *   Calculate QTD (Quarter-To-Date) Net Sales, Targets, and Achievements.
    *   Return grouped data per month (for a 3-month breakdown chart).
    *   Return top categories, slow/fast moving SAPs within the 3 months.
    *   Return Advisor performance for the quarter.

### [New Frontend File]
#### [NEW] `ViewQuarterly.html`
*   A new HTML template that contains the UI components for the Quarterly view:
    *   A filter interface specifically for Quarterly selection (Q1, Q2, Q3, Q4 dropdown + Year dropdown).
    *   Highlight KPI cards (Quarterly Sales, Target, Achievement %, QoQ Growth).
    *   3-Month Breakdown components (Line Chart for pacing, Table for summary).
    *   Category Dominance charts.
    *   Top Advisors & Top SAP list for the quarter.
*   This file will be included in the main app layout.

### [Modifications to Existing Files]

#### [MODIFY] [Index.html](file:///d:/Bvlgari%20Dashboard/Index.html)
*   Update the Sidebar Menu/Navigation to include a new button for "Quarterly Performance".
*   Add `<?!= include('ViewQuarterly'); ?>` inside the main content area (initially hidden, similar to `viewMonthly`).

#### [MODIFY] [JavaScript.html](file:///d:/Bvlgari%20Dashboard/JavaScript.html)
*   **State Management**: Update `APP.switchTab(mode)` to handle the newly added `mode === 'quarterly'`.
*   **Data Fetching**: Update `APP.loadDashboard()` to call `getQuarterlyData(q, y)` when the mode is `quarterly`.
*   **Renderers**: Add a new block `quarterly: (data) => { ... }` inside `RENDER` to paint the data into `ViewQuarterly.html` components. This keeps all rendering isolated.
*   **Filter UI**: Manage the visibility of the new Quarterly Filter bar (hide the monthly/daily filters when on the quarterly tab).

## Verification Plan

### Automated Tests
*   Ensure that mapping "Q1" accurately slices transactions strictly between January 1st and March 31st.

### Manual Verification
1.  Click the new "Quarterly" tab in the sidebar.
2.  Use the dropdowns to select "Q1" and the respective year.
3.  Load the data and verify that the "Highlight KPI" numbers match manual aggregates of Jan+Feb+Mar reports.
4.  Verify that the layout switches back flawlessly when clicking another tab (e.g., "Monthly").
