# Implementation Plan: Quarterly Performance PDF Export

## Goal Description
The user wants to add a "Download PDF" button to the new "Quarterly Performance" view, allowing users to export the quarterly charts and tables into a shareable PDF document.

## Proposed Changes

### [MODIFY] [ViewQuarterly.html](file:///d:/Bvlgari%20Dashboard/ViewQuarterly.html)
*   Add an **Export PDF** button to the header section of the Quarterly View (next to the title).
*   The button will trigger `EXPORT.pdf('viewQuarterly', 'Quarterly_Performance_Report')`.

### [MODIFY] [ExportHandler.html](file:///d:/Bvlgari%20Dashboard/ExportHandler.html)
*   Update the `EXPORT.pdf` function logic to correctly handle the new [Quarterly](file:///d:/Bvlgari%20Dashboard/8-API_Quarterly.gs#6-167) context.
*   It needs to extract the selected Quarter (`Q1-Q4`) and Year from the DOM (`quarterSelect` and `quarterYearSelect`).
*   Route the backend call to a new GAS function specifically for the quarterly report.

### [MODIFY] [8-API_Quarterly.gs](file:///d:/Bvlgari%20Dashboard/8-API_Quarterly.gs) (atau Backend yang Sesuai)
*   Create a new backend function `downloadQuarterlyReportPDF(quarter, year)`.
*   This function will:
    1. Re-fetch the quarterly data payload using the existing [getQuarterlyData](file:///d:/Bvlgari%20Dashboard/8-API_Quarterly.gs#6-167).
    2. Pass the data into a hidden HTML template (e.g., `Template_QuarterlyReport.html`) to format the PDF structure.
    3. Convert the generated HTML into a PDF blob using Google Apps Script's native `getAs('application/pdf')`.
    4. Encode the PDF as base64 and return it to the frontend via the success handler.

### [NEW] `Template_QuarterlyReport.html`
*   Create a dedicated HTML template file designed specifically for A4 print layout.
*   It will consume the quarterly data (KPIs, Monthly Breakdown Table, Top 10 Collections/Catalogues) and format them into a clean, brand-aligned PDF document without interactive/web-only elements (like dropdowns).

## Verification Plan
1.  Navigate to the Quarterly Performance tab.
2.  Click the new "Export PDF" button.
3.  Verify the Toast notification appears ("Generating Quarterly Report (PDF)...").
4.  Wait for the browser to prompt the file download.
5.  Open the downloaded PDF and verify the layout, data accuracy, and branding.
