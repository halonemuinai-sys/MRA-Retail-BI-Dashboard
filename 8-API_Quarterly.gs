/**
 * File: 8-API_Quarterly.gs
 * Description: Dedicated API Backend logic for Quarterly Performance View
 */

function getQuarterlyData(quarterStr, yearStr, forceRefresh = false) {
    try {
        // Caching Logic Start
        const cache = CacheService.getScriptCache();
        const cacheKey = `QTR_${quarterStr}_${yearStr}`;
        
        if (forceRefresh) {
            cache.remove(cacheKey);
        } else {
            const cachedData = cache.get(cacheKey);
            if (cachedData) {
                try {
                   return JSON.parse(cachedData);
                } catch (e) {
                   // Ignore parsing error, proceed to fetch fresh
                }
            }
        }

        const ss = getSpreadsheet();
        const year = Number(yearStr);
        
        let sheetName = CONFIG.SHEETS.CLEAN; 
        const currentYear = new Date().getFullYear();
        if (year != currentYear) {
            const archiveName = `Clean_Data_${year}`;
            if (ss.getSheetByName(archiveName)) sheetName = archiveName;
        }

        const cleanSheet = ss.getSheetByName(sheetName);
        if (!cleanSheet) return { error: `Sheet '${sheetName}' tidak ditemukan.` };

        const data = cleanSheet.getDataRange().getValues();
        data.shift(); // Remove header

        // Define Quarter Months Mapping
        const qMap = {
            "Q1": { months: [0, 1, 2], names: ["January", "February", "March"] }, // Jan, Feb, Mar
            "Q2": { months: [3, 4, 5], names: ["April", "May", "June"] },       // Apr, May, Jun
            "Q3": { months: [6, 7, 8], names: ["July", "August", "September"] },// Jul, Aug, Sep
            "Q4": { months: [9, 10, 11], names: ["October", "November", "December"] }// Oct, Nov, Dec
        };

        const targetQuarter = qMap[quarterStr];
        if (!targetQuarter) return { error: "Format Quarter tidak valid" };

        const COL = CONFIG.CLEAN_COLS || {
            DATE: 1, LOCATION: 4, MAIN_CAT: 6, COLL: 7, GROSS: 8, VAL_DISC: 10,
            SELLING_COST: 13, NET_SALES: 14, TYPE: 15, QTY: 16, CATALOGUE: 17, SALESMAN: 3, TRANS_NO: 0
        };

        // Aggregation Containers
        let qtdSales = 0;           // Quarter to Date Sales (Exc HO)
        let qtdTarget = 0;          // Total target for the 3 months (Exc HO)
        
        // Month by Month Data
        const monthlyPacing = [
            { name: targetQuarter.names[0], index: targetQuarter.months[0], sales: 0, target: 0, achv: 0 },
            { name: targetQuarter.names[1], index: targetQuarter.months[1], sales: 0, target: 0, achv: 0 },
            { name: targetQuarter.names[2], index: targetQuarter.months[2], sales: 0, target: 0, achv: 0 }
        ];

        // Categories Map
        const catMap = {};
        const collMap = {};
        const sapMap = {};

        // Calculate Targets for each month in the quarter
        targetQuarter.names.forEach((mName, i) => {
             const tMap = getTargetMap(ss, mName, year);
             let monthTargetSum = 0;
             for (const store in tMap) {
                 if(store !== 'TOTAL') monthTargetSum += tMap[store];
             }
             monthlyPacing[i].target = monthTargetSum;
             qtdTarget += monthTargetSum;
        });

        // Filter and Calculate Sales Data
        data.forEach(row => {
            const dateVal = row[COL.DATE];
            if (!dateVal) return;
            const d = parseDateFix(dateVal);
            
            // If Year and Month matches the Quarter
            if (d.getFullYear() === year && targetQuarter.months.includes(d.getMonth())) {
                const loc = String(row[COL.LOCATION]).trim();
                const net = Number(row[COL.NET_SALES]) || 0;
                
                // Exclude Head Office for pure Retail QTD logic
                if (!loc.toLowerCase().includes("head office")) {
                    qtdSales += net;
                    
                    // Assign to specific month
                    const mIndex = d.getMonth();
                    const pacingObj = monthlyPacing.find(m => m.index === mIndex);
                    if (pacingObj) pacingObj.sales += net;

                    // Category Dominance
                    const cat = String(row[COL.MAIN_CAT] || "Other").trim();
                    if(!catMap[cat]) catMap[cat] = 0;
                    catMap[cat] += net;

                    // Collection and Catalogue
                    if (net > 0) {
                        const qty = Number(row[COL.QTY]) || 0;
                        const coll = String(row[COL.COLL] || "-").trim();
                        if (coll && coll !== "-") {
                            if(!collMap[coll]) collMap[coll] = { name: coll, cat: cat, value: 0, qty: 0 };
                            collMap[coll].value += net;
                            collMap[coll].qty += qty;
                        }

                        const catalogue = String(row[COL.CATALOGUE] || "-").trim();
                        if (catalogue && catalogue !== "-") {
                            if(!sapMap[catalogue]) sapMap[catalogue] = { name: catalogue, cat: cat, value: 0, qty: 0 };
                            sapMap[catalogue].value += net;
                            sapMap[catalogue].qty += qty;
                        }
                    }
                }
            }
        });

        // Calculate YoY (Last Year Same Quarter)
        let lastYearQtdSales = 0;
        const lastYear = year - 1;
        let lastYearSheetName = CONFIG.SHEETS.CLEAN;
        if (lastYear != currentYear) {
            const archiveName = `Clean_Data_${lastYear}`;
            if (ss.getSheetByName(archiveName)) lastYearSheetName = archiveName;
        }
        const lastYearSheet = ss.getSheetByName(lastYearSheetName);
        if (lastYearSheet) {
             const lyData = lastYearSheet.getDataRange().getValues();
             lyData.shift();
             lyData.forEach(row => {
                 const d = parseDateFix(row[COL.DATE]);
                 if (d.getFullYear() === lastYear && targetQuarter.months.includes(d.getMonth())) {
                     const loc = String(row[COL.LOCATION]).trim();
                     if (!loc.toLowerCase().includes("head office")) {
                         lastYearQtdSales += (Number(row[COL.NET_SALES]) || 0);
                     }
                 }
             });
        }
        
        const yoyGrowth = lastYearQtdSales > 0 ? ((qtdSales - lastYearQtdSales) / lastYearQtdSales) * 100 : 0;
        const qtdAchv = qtdTarget > 0 ? (qtdSales / qtdTarget) * 100 : 0;

        // Finalize Pacing Targets
        monthlyPacing.forEach(m => {
            m.achv = m.target > 0 ? (m.sales / m.target) * 100 : 0;
        });

        // Format Top Categories
        const categories = Object.keys(catMap).map(k => ({ name: k, value: catMap[k] })).sort((a,b) => b.value - a.value);

        // Format Top Collections and Catalogue
        const topCollections = Object.values(collMap).sort((a,b) => b.value - a.value).slice(0, 10);
        const topCatalogue = Object.values(sapMap).sort((a,b) => b.value - a.value).slice(0, 10);

        const finalResult = {
            success: true,
            qtdSales: qtdSales,
            qtdTarget: qtdTarget,
            qtdAchv: qtdAchv,
            yoyGrowth: yoyGrowth,
            monthlyPacing: monthlyPacing,
            categories: categories,
            topCollections: topCollections,
            topCatalogue: topCatalogue
        };

        // Cache the result for 5 minutes (300 seconds)
        try {
            const jsonString = JSON.stringify(finalResult);
            if (jsonString.length < 100000) {
                cache.put(cacheKey, jsonString, 300);
            }
        } catch (e) {
            // Ignore cache write errors
        }

        return finalResult;

    } catch (e) {
        return { error: e.message };
    }
}

/**
 * Generate PDF for Quarterly Report
 */
function downloadQuarterlyReportPDF(quarterStr, yearStr) {
    try {
        const data = getQuarterlyData(quarterStr, yearStr);
        if (data.error) return { error: data.error };

        const formatIDR = (val) => "Rp " + Number(val || 0).toLocaleString("id-ID");
        const formatPct = (val) => Number(val || 0).toFixed(1) + "%";

        let html = `
        <html><head><style>
            body { font-family: 'Helvetica', sans-serif; font-size: 10px; color: #333; margin: 20px; }
            h1 { font-size: 18px; color: #1e3a8a; margin-bottom: 5px; }
            h2 { font-size: 12px; color: #64748b; margin-bottom: 20px; }
            .kpi-container { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .kpi-container td { padding: 10px; border: 1px solid #e2e8f0; text-align: center; background: #f8fafc; }
            .kpi-label { font-size: 9px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; display: block; }
            .kpi-value { font-size: 16px; font-weight: bold; color: #0f172a; }
            
            h3 { font-size: 14px; color: #1e3a8a; margin-top: 20px; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;}
            table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            table.data-table th { background: #1e3a8a; color: white; padding: 6px; text-align: left; font-size: 9px; text-transform: uppercase; }
            table.data-table td { border: 1px solid #e2e8f0; padding: 6px; }
            .text-right { text-align: right !important; }
            .text-center { text-align: center !important; }
            .font-bold { font-weight: bold; }
            .text-blue { color: #1e3a8a; }
            .text-green { color: #10b981; }
            .sub-text { font-size: 8px; color: #64748b; }
            
            .grid-container { width: 100%; }
            .grid-container td { vertical-align: top; width: 50%; padding-right: 10px;}
        </style></head><body>
            
            <h1>Quarterly Performance Report</h1>
            <h2>Period: ${quarterStr} ${yearStr}</h2>

            <table class="kpi-container">
                <tr>
                    <td><span class="kpi-label">QTD Sales (Exc. HO)</span><span class="kpi-value text-blue">${formatIDR(data.qtdSales)}</span></td>
                    <td><span class="kpi-label">Quarter Target</span><span class="kpi-value">${formatIDR(data.qtdTarget)}</span></td>
                    <td><span class="kpi-label">Achievement</span><span class="kpi-value text-green">${formatPct(data.qtdAchv)}</span></td>
                    <td><span class="kpi-label">YoY Growth</span><span class="kpi-value">${formatPct(data.yoyGrowth)}</span></td>
                </tr>
            </table>

            <table class="grid-container">
            <tr><td>
                <!-- Monthly Pacing -->
                <h3>Monthly Breakdown</h3>
                <table class="data-table">
                    <thead><tr>
                        <th>Month</th>
                        <th class="text-right">Net Sales</th>
                        <th class="text-right">Target</th>
                        <th class="text-right">Achv %</th>
                    </tr></thead>
                    <tbody>
        `;

        data.monthlyPacing.forEach(m => {
            html += `
                <tr>
                    <td class="font-bold">${m.name}</td>
                    <td class="text-right">${formatIDR(m.sales)}</td>
                    <td class="text-right">${formatIDR(m.target)}</td>
                    <td class="text-right font-bold">${formatPct(m.achv)}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </td><td>
                <!-- Category Dominance -->
                <h3>Category Overview</h3>
                <table class="data-table">
                    <thead><tr>
                        <th>Category Name</th>
                        <th class="text-right">Net Sales</th>
                        <th class="text-right">% Mix</th>
                    </tr></thead>
                    <tbody>
        `;

        const totalCat = data.categories.reduce((sum, c) => sum + c.value, 0);
        data.categories.forEach(c => {
            const pct = totalCat > 0 ? (c.value / totalCat) * 100 : 0;
            html += `
                <tr>
                    <td class="font-bold">${c.name}</td>
                    <td class="text-right">${formatIDR(c.value)}</td>
                    <td class="text-right">${formatPct(pct)}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </td></tr>
            </table> <!-- End grid container -->

            <!-- Top 10 Lists -->
            <table class="grid-container" style="margin-top: 10px;">
            <tr><td>
                <h3>Top 10 Collection</h3>
                <table class="data-table">
                    <thead><tr>
                        <th>#</th>
                        <th>Collection</th>
                        <th class="text-center">Qty</th>
                        <th class="text-right">Sales</th>
                    </tr></thead>
                    <tbody>
        `;

        (data.topCollections || []).forEach((c, i) => {
            html += `
                <tr>
                    <td class="text-center sub-text">${i + 1}</td>
                    <td><span class="font-bold">${c.name}</span><br><span class="sub-text">${c.cat}</span></td>
                    <td class="text-center">${c.qty}</td>
                    <td class="text-right text-green font-bold">${formatIDR(c.value)}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </td><td>
                <h3>Top 10 Catalogue Code</h3>
                <table class="data-table">
                    <thead><tr>
                        <th>#</th>
                        <th>Catalogue Code</th>
                        <th class="text-center">Qty</th>
                        <th class="text-right">Sales</th>
                    </tr></thead>
                    <tbody>
        `;

        (data.topCatalogue || []).forEach((c, i) => {
             html += `
                <tr>
                    <td class="text-center sub-text">${i + 1}</td>
                    <td><span class="font-bold text-blue">${c.name}</span><br><span class="sub-text">${c.cat}</span></td>
                    <td class="text-center">${c.qty}</td>
                    <td class="text-right text-green font-bold">${formatIDR(c.value)}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </td></tr>
            </table>
            
        </body></html>
        `;

        const blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF);
        blob.setName(`Quarterly_Report_${quarterStr}_${yearStr}.pdf`);
        return { base64: Utilities.base64Encode(blob.getBytes()), filename: blob.getName() };

    } catch (e) {
        return { error: e.message };
    }
}

/**
 * Endpoint for Quarterly Budget vs Actual 2026 Comparison
 */
function getQuarterlyBudgetData(quarterStr, yearStr, forceRefresh = false) {
    try {
        // Only run for 2026 (or dynamically if requested, but requirement is specifically 2026)
        if (yearStr !== '2026' && yearStr !== 2026) {
             return { error: "Budget data is currently only available for the year 2026." };
        }

        // Cache Handling
        const cache = CacheService.getScriptCache();
        const cacheKey = `QTR_BUDGET_${quarterStr}_${yearStr}`;
        
        if (forceRefresh) cache.remove(cacheKey);
        else {
            const cachedData = cache.get(cacheKey);
            if (cachedData) {
                try { return JSON.parse(cachedData); } catch (e) {}
            }
        }

        const ss = getSpreadsheet();
        const year = Number(yearStr);
        let sheetName = CONFIG.SHEETS.CLEAN; 
        const cleanSheet = ss.getSheetByName(sheetName);
        if (!cleanSheet) return { error: `Sheet '${sheetName}' tidak ditemukan.` };

        const data = cleanSheet.getDataRange().getValues();
        data.shift(); // Remove header

        const qMap = {
            "Q1": { months: [0, 1, 2], names: ["January", "February", "March"] },
            "Q2": { months: [3, 4, 5], names: ["April", "May", "June"] },
            "Q3": { months: [6, 7, 8], names: ["July", "August", "September"] },
            "Q4": { months: [9, 10, 11], names: ["October", "November", "December"] }
        };

        const targetQuarter = qMap[quarterStr];
        if (!targetQuarter) return { error: "Format Quarter tidak valid" };

        const COL = CONFIG.CLEAN_COLS || { DATE: 1, LOCATION: 4, NET_SALES: 14 };

        // 1. Calculate Built-in Budget Targets per Store
        const budgetMap = {};
        targetQuarter.names.forEach((mName, idx) => {
             const mKey = 'm' + (idx + 1);
             const bMap = getBudgetMap(ss, mName, year);
             for (const store in bMap) {
                 if(store.toLowerCase() !== 'total' && store.toLowerCase() !== 'head office') {
                    if (!budgetMap[store]) budgetMap[store] = { total: 0, m1: 0, m2: 0, m3: 0 };
                    budgetMap[store][mKey] += bMap[store];
                    budgetMap[store].total += bMap[store];
                 }
             }
        });

        // 2. Aggregate Actual Sales Data
        const actualMap = {};
        data.forEach(row => {
            const dateVal = row[COL.DATE];
            if (!dateVal) return;
            const d = parseDateFix(dateVal);
            
            if (d.getFullYear() === year) {
                const monthIdx = targetQuarter.months.indexOf(d.getMonth());
                if (monthIdx !== -1) {
                    const mKey = 'm' + (monthIdx + 1);
                    const loc = String(row[COL.LOCATION]).trim();
                    const net = Number(row[COL.NET_SALES]) || 0;
                    
                    if (!loc.toLowerCase().includes("head office")) {
                        if(!actualMap[loc]) actualMap[loc] = { total: 0, m1: 0, m2: 0, m3: 0 };
                        actualMap[loc][mKey] += net;
                        actualMap[loc].total += net;
                    }
                }
            }
        });

        // 3. Combine and Calculate Variance
        const stores = new Set([...Object.keys(budgetMap), ...Object.keys(actualMap)]);
        const combinedData = [];
        
        let totalActual = 0;
        let totalBudget = 0;

        stores.forEach(store => {
             const actualData = actualMap[store] || { total: 0, m1: 0, m2: 0, m3: 0 };
             const budgetData = budgetMap[store] || { total: 0, m1: 0, m2: 0, m3: 0 };

             const actual = actualData.total;
             const budget = budgetData.total;
             const variance = actual - budget;
             const achievement = budget > 0 ? (actual / budget) * 100 : 0;

             totalActual += actual;
             totalBudget += budget;

             // Monthly Breakdown Sub-object
             const monthlyBreakdown = {};
             ['m1', 'm2', 'm3'].forEach(mKey => {
                 const mAct = actualData[mKey];
                 const mBud = budgetData[mKey];
                 const mVar = mAct - mBud;
                 const mAchv = mBud > 0 ? (mAct / mBud) * 100 : 0;
                 monthlyBreakdown[mKey] = {
                     actual: mAct,
                     budget: mBud,
                     variance: mVar,
                     achievement: mAchv
                 };
             });

             combinedData.push({
                 store: store,
                 actual: actual,
                 budget: budget,
                 variance: variance,
                 achievement: achievement,
                 isAchieved: variance >= 0,
                 monthlyBreakdown: monthlyBreakdown
             });
        });

        // Sort by Highest Budget Target
        combinedData.sort((a, b) => b.budget - a.budget);

        const result = {
             kpi: {
                 totalActual: totalActual,
                 totalBudget: totalBudget,
                 totalVariance: totalActual - totalBudget,
                 totalAchievement: totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0
             },
             monthNames: targetQuarter.names,
             storeData: combinedData
        };

        // Cache the result for 5 minutes
        cache.put(cacheKey, JSON.stringify(result), 300);

        return result;

    } catch (e) {
        return { error: `[Budget API] ${e.message}` };
    }
}

