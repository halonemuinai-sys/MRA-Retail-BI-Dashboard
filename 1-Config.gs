/**
 * RETAIL LUXURY WEB APP BACKEND
 * File: 1-Config.gs
 * Description: Menyimpan konfigurasi spreadsheet dan mapping kolom.
 * STATUS: UPDATED (Sesuai "Refactored Version")
 */

const SPREADSHEET_ID = '1jRFK1jPuK_-pVvJYNx1PbvDEJaeAK4ZUZ0QTxWJsxwQ';

const CONFIG = {
  SHEETS: {
    RAW: 'raw_system',
    CLEAN: 'clean_master',
    MASTER_CAT: 'master_main_category',
    MASTER_COLL: 'master_collection',
    MASTER_TARGET_STORE: 'master_target_store',
    MASTER_BUDGET: 'master_budget_store_2026',
    MASTER_ADVISOR: 'master_sales_advisor',
    MASTER_STOCK: 'master_stock',
    FOOTFALL_PI: 'footfall_pi',
    FOOTFALL_PS: 'footfall_ps'
  },
  // Setting Alamat Email Tujuan Report Otomatis
  EMAIL_RECIPIENTS: [
    "csv.ares@gmail.com",
    "aris@mraretail.co.id"
  ],
  // Mapping Kolom Data Mentah (Source)
  RAW_COLS: {
    TRANS_NO: 0,
    TRANS_DATE: 1,
    CUSTOMER: 2,
    SALESMAN: 3,
    LOCATION: 4,
    SAP_CODE: 5,
    COLL_CODE: 6,
    TOTAL_PRICE: 7,
    DISC_PCT: 8,
    NET_PRICE: 9,
    NET_SALES: 10,
    TYPE_ITEM: 11,
    QTY: 12,
    CARD_COMM: 13,
    CATALOGUE_CODE: 14
  },
  // Mapping Kolom Data Bersih (Target) - Sesuai fungsi buildCleanMaster
  // 0: Trans No, 1: Date, 2: Customer, 3: Salesman, 4: Location, 5: SAP Code
  // 6: Main Category, 7: Collection, 8: Gross Sales, 9: Disc %, 10: Val Disc
  // 11: Net Price, 12: Comm, 13: Cost, 14: Net Sales, 15: Type, 16: Qty, 17: Catalogue Code, 18: Home Location
  CLEAN_COLS: {
    TRANS_NO: 0,
    DATE: 1,
    CUSTOMER: 2,
    SALESMAN: 3,
    LOCATION: 4,
    SAP: 5,
    MAIN_CAT: 6,
    COLL: 7,
    GROSS: 8,
    DISC_PCT: 9,
    VAL_DISC: 10,
    NET_PRICE: 11,
    COMM: 12,
    SELLING_COST: 13,
    NET_SALES: 14,
    TYPE: 15,
    QTY: 16,
    CATALOGUE: 17,
    HOME_LOCATION: 18 // DYNAMIC FROM MASTER
  }
};