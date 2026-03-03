# IT Business Partner Report: Bvlgari Sales Intelligence Dashboard

## 1. Executive Summary

**Project Name:** Bvlgari Sales Intelligence Dashboard (MRA Retail)
**Status:** Active / In Development
**Primary Objective:** To provide a centralized, real-time interface for monitoring sales performance, advisor achievements, and customer segmentation for the Bvlgari retail division.

The **Bvlgari Sales Intelligence Dashboard** is a custom-built web application designed to empower the retail management team with actionable insights. By aggregating data from daily transactions and advisor targets, the system eliminates manual reporting overhead and provides visibility into store performance, category trends, and individual advisor contributions.

---

## 2. Business Value & Strategic Alignment

This project directly supports the business tracking and operational efficiency goals:

*   **Real-Time Performance Tracking:** Moves away from static monthly reports to dynamic, interactive daily/monthly views.
*   **Advisor Accountability:** Dedicated "Advisor Performance" modules allow for granular tracking of individual sales targets, fostering a performance-driven culture.
*   **Customer Insights:** Automated "Customer Segmentation" (RFM Analysis) helps identify Top, Elite, and At-Risk clients, enabling targeted marketing and clienteling strategies.
*   **Operational Efficiency:** Automated ETL (Extract, Transform, Load) processes reduce the manual effort required to clean and format raw sales data.

---

## 3. Product Overview & Key Features

The application is accessible via a web interface and features the following core modules:

### A. Dashboard & Analytics
*   **Monthly Overview:** High-level view of Net Sales vs. Targets, Growth YoY, and key KPIs (MDR, Discount %, UPT).
*   **Transaction Analysis:** Detailed breakdown of sales by transaction, allowing for deep dives into specific line items.
*   **Trend Analysis:** Multi-year comparison (2023-2026) to identify seasonal trends and growth patterns.

### B. Advisor Management
*   **Performance Scorecards:** Individual dashboards for advisors showing Net Sales, Contribution %, and Target Achievement.
*   **Ranking System:** Visual leaderboards to incentivize top performance across store locations.

### C. Reporting & Exports
*   **Daily Reports:** Automated generation of PDF and CSV reports for management updates.
*   **Inventory Breakdown:** Analysis of sales by Main Category and Collection (e.g., Jewelry, Watches, Accessories).

### D. Customer Intelligence
*   **Segmentation Logic:** Automatic categorization of customers into segments (Top, Elite, High Potential, Prospect, Inactive) based on spending history.
*   **Retention Tracking:** Identification of specific customer behaviors (New vs. Repeat) to guide retention strategies.

### E. Advanced Analytics & Forecasting (Recent Updates)
*   **Quarterly Performance Menu:** Aggregated view of Top 10 SAP (Product Codes) by Value and Quantity, Top Categories, Top Collections, and Catalogues on a quarterly basis, enabling seasonal deep dives.
*   **Sales Heatmap Calendar:** Visual calendar interface that color-codes daily sales intensity (from light to dark) for instant identification of high-traffic days, weekends, and holidays.
*   **Category Sales & Qty Trend (Sales Projection):** Multi-year comparative trends (2023-2026) broken down by category (Jewelry, Watches, Accessories). Features interactive toggles for Value (IDR) vs Quantity (Pcs) and dynamic KPI cards tracking 2026 vs 2025 YTD actuals and YoY growth rates.

---

## 4. Technical Architecture

The solution leverages the **Google Workspace Ecosystem** to provide a cost-effective, serverless, and highly accessible platform.

### A. Technology Stack
*   **Frontend:** HTML5, CSS3, JavaScript.
*   **Visualization:** Interactive charts for dynamic data representation.
*   **Backend / Middleware:** Google Apps Script.
*   **Database / Data Store:** Google Sheets (acting as a relational database).
*   **Deployment:** Google Web App.

### B. Data Architecture & Flow
1.  **Ingestion:** Raw transaction data is input/imported into the system.
2.  **Processing (ETL):** Backend scripts automatically cleanse and normalize data (applying date parsing and category alignment).
3.  **Storage:** Cleaned data is stored in structured datasets, partitioned by year for performance.
4.  **Presentation:** The Web Application fetches filtered data via API endpoints and renders it on the client side for user interaction.

### C. Security & Access
*   **Authentication:** Relies on Google Workspace account authentication.
*   **Authorization:** Script permissions control access to the underlying data sheets.

---

## 5. Risks & Challenges

1.  **Scalability:**
    *   *Risk:* As data volume grows (multi-year transaction history), execution time limits and cell limits may become bottlenecks.
    *   *Mitigation:* Logic is already in place to archive data by year.

2.  **Concurrency:**
    *   *Risk:* High concurrent user access might slow down response times due to platform limitations.
    *   *Mitigation:* Client-side caching and optimized data fetching strategies are recommended.

---

## 6. Roadmap & Recommendations (ITBP Perspective)

To ensure the long-term viability and enterprise-readiness of this tool, the following roadmap is recommended:

### Phase 1: Stabilization (Current)
*   [x] Feature Parity with Manual Reports.
*   [ ] Complete Unit Testing for critical calculations (Sales, Targets).
*   [ ] Formalize User Acceptance Testing (UAT) with Store Managers.

### Phase 2: Optimization (Next 3-6 Months)
*   **Data Migration:** Evaluate moving the "Database" layer to a dedicated cloud database if record counts exceed current limits, enabling faster queries and better scalability.
*   **Automated Ingestion:** Automate the import of raw sales data from the POS/ERP system directly, removing manual copy-paste steps.

### Phase 3: Expansion (6-12 Months)
*   **Mobile App Wrapper:** Wrap the web app into a progressive web app (PWA) or hybrid mobile app for better mobile experience.
*   **Advanced Forecasting:** Implement simple ML models in the backend to predict EOQ (End of Quarter) landing based on current run rates.

---
**Prepared By:** IT Business Partner / Development Team
**Date:** February 19, 2026
