# Goal Description
Enable Supervisors, Store Managers (SM), and Assistant Store Managers (ASM) to view the performance of their entire store, including the performance of their staff, within the Advisor App.

## Proposed Changes

### Backend ([Code-Advisor.gs](file:///d:/Bvlgari%20Dashboard/ADVISOR-APP/Code-Advisor.gs))
Currently, [getAdvisorDashboardData](file:///d:/Bvlgari%20Dashboard/ADVISOR-APP/Code-Advisor.gs#154-272) and [getAdvisorProspects](file:///d:/Bvlgari%20Dashboard/ADVISOR-APP/Code-Advisor.gs#277-365) only fetch data for a specific `advisorName`. We need to modify these to accept the user's role and store Location.

- **[MODIFY] [getAdvisorDashboardData(advisorName, month, year, role, store)](file:///d:/Bvlgari%20Dashboard/ADVISOR-APP/Code-Advisor.gs#154-272)**
  - If `role` is 'supervisor' or 'manager' or 'asm':
    - Instead of filtering data by `COL.SALESMAN === advisorName`, filter by `COL.LOCATION === store`.
    - Also, calculate a breakdown of sales per staff member (`staffBreakdown`: { name, netSales, qty, target, achievement }).
    - `myTotalSales`, `myTrxCount`, `myQty`, `myMonthlySales`, and `categoryBreakdown` will now represent the **Store's Total**.
    - For target lookup, instead of finding the advisor's sheet, we need to find the specific **Store's Target** (we might need to define how store targets are read from `master_sales_advisor` or aggregate individual staff targets). *Note: The simplest approach for store target is to sum the targets of all advisors who belong to that store based on the login sheet.*
  - The returned object will include a new array: `staffBreakdown`.

- **[MODIFY] [getAdvisorProspects(advisorName, month, year, role, store)](file:///d:/Bvlgari%20Dashboard/ADVISOR-APP/Code-Advisor.gs#277-365)**
  - If `role` is 'supervisor', 'manager', 'asm':
    - Filter by `TCOL.LOCATION === store` instead of `TCOL.SERVED_BY === advisorName`.
    - Include the `SERVED_BY` field in the returned prospect objects so the manager knows whose prospect it is.

### Frontend ([Index-Advisor.html](file:///d:/Bvlgari%20Dashboard/ADVISOR-APP/Index-Advisor.html))
- **[MODIFY] Global State & Login**
  - Ensure the `role` and `store` from `res.user` are saved in `APP.currentUser` during login and passed to API calls.
  
- **[MODIFY] Navigation Menu**
  - If `APP.currentUser.role` indicates a manager level, show a new navigation button: "Store Performance" or simply make the "My Performance" card represent the Store when logged in as a manager.
  - *Decision:* It's cleaner to keep the existing UI but change the title from "My Performance" to "Store Performance (Plaza Indonesia)" and add a new section in "Laporan" to show the Staff Leaderboard.

- **[MODIFY] Dashboard Page**
  - Update headers to indicate "Store Performance: [Store Name]" if role is manager.
  - Add a **Staff Leaderboard** section (visible only to managers) showing each advisor's sales, target, and achievement percentage.
  
- **[MODIFY] Prospect Page**
  - Add the Advisor Name badge to each prospect card so managers know who is handling the prospect.

## Verification Plan

### Manual Verification
1. Login as an Advisor (e.g., Aris Setiyono). Verify the dashboard shows personal stats, target, and prospects.
2. Login as a Store Manager / Supervisor (e.g., test with an account having role='supervisor' or 'manager' and store='Plaza Indonesia').
3. Verify the Dashboard title changes to "Store Performance".
4. Verify the Total Sales, Target, and Qty represent the whole store.
5. Verify the Staff Leaderboard appears and displays individual advisor performance.
6. Verify the Prospect List shows all prospects for the store, with the serving advisor's name visible.
7. Verify changing the month/year filter updates all store metrics and staff breakdown.
