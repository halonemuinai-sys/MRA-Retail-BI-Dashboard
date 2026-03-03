# Implementation Plan: Category Sales Projection & JS Refactoring

## Goal Description
The user wants to add a new sub-menu in the "Product Rank" (SAP) view to analyze "Sales Trend & Projection" with the ability to select and compare specific product categories. Furthermore, the user noted that [JavaScript.html](file:///d:/Bvlgari%20Dashboard/JavaScript.html) is getting too large and requested new logic to be placed in a new file.

## Proposed Changes

### 1. File Refactoring: Extracting Charts Logic
To address the bloated [JavaScript.html](file:///d:/Bvlgari%20Dashboard/JavaScript.html), we will begin by extracting the `CHARTS` object into a dedicated file.
*   **[NEW] `JavaScript_Charts.html`**: Create this file to solely house the `const CHARTS = { ... }` object and any chart-specific helper logic. This keeps visualization logic separated from core application routing and state management.
*   **[MODIFY] [JavaScript.html](file:///d:/Bvlgari%20Dashboard/JavaScript.html)**: Delete the `CHARTS` object from this file.
*   **[MODIFY] [Index.html](file:///d:/Bvlgari%20Dashboard/Index.html)**: Add `<?!= include('JavaScript_Charts'); ?>` immediately below the existing [JavaScript.html](file:///d:/Bvlgari%20Dashboard/JavaScript.html) include.

### 2. Category Sales Projection Sub-View (UI)
We will add a toggle in the Product Rank view, similar to what we did for Monthly Transaction.
*   **[MODIFY] [ViewSap.html](file:///d:/Bvlgari%20Dashboard/ViewSap.html)**:
    *   Add a header toggle: "Top Performers" vs "Category Projection".
    *   Wrap the existing tables in a `<div id="sapTopPerformersView">`.
    *   Create a new `<div id="sapProjectionView" class="hidden">`:
        *   Add a dropdown selector to choose the category (`<select id="sapCategoryFilter">`). It should default to "All Categories" or allow selecting a specific one.
        *   Add a canvas for the trend chart (`<canvas id="sapCategoryTrendChart"></canvas>`).

### 3. Backend Data Retrieval
We need to provide the historical trend data for categories so we can chart it and draw a projection line.
*   **[MODIFY] `9-API_Sap.gs`** (or create it if it doesn't exist, otherwise add to `5-API_Sap.gs`):
    *   Create a new function `getCategoryProjectionData(month, year, category)`.
    *   If `category` is "All", aggregate overall daily trends. If a specific category is provided, filter the raw data before aggregating the daily trend.
    *   Calculate a simple linear regression projection based on the current month's pacing.

### 4. Frontend Logic Integration
*   **[NEW] `JavaScript_Projection.html`**: Create this file to handle the specific logic for this new feature, keeping with the theme of modularity.
    *   Create a `PROJECTION` constant object.
    *   `loadData(category)`: Calls the backend API.
    *   `renderView(data)`: Renders the chart using Chart.js, plotting both the actual daily sales and a dotted line for the projected trajectory to the end of the month.
*   **[MODIFY] [Index.html](file:///d:/Bvlgari%20Dashboard/Index.html)**: Include `JavaScript_Projection.html`.
*   **[MODIFY] [JavaScript.html](file:///d:/Bvlgari%20Dashboard/JavaScript.html)**: Add `switchSapSubView` logic. Update [loadDashboard](file:///d:/Bvlgari%20Dashboard/JavaScript.html#199-235) to trigger the projection logic if the sub-view is active.

## Verification Plan
1.  Verify the dashboard loads without errors after extracting `CHARTS`.
2.  Navigate to Product Rank.
3.  Toggle to "Category Projection".
4.  Select a category from the dropdown; verify the chart updates with the trend and projection line.
5.  Switch back to "Top Performers" and verify standard tables still work.
