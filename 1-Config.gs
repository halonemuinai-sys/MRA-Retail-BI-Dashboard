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
    FOOTFALL_PS: 'footfall_ps',
    TRAFFIC_SUMMARY: 'Traffic_Summary'
  },
  // Setting Alamat Email Tujuan Report Otomatis
  EMAIL_RECIPIENTS: [
    "csv.ares@gmail.com",
    "aris@mraretail.co.id"
  ],
  // Konfigurasi File Eksternal
  EXTERNAL: {
    PROFILING_SHEET_ID: '17dIze7RwnA4nqxCVRbTeDIDlwCmW1OvgXQ9zMOM-ovM',
    PROFILING_SHEET_NAME: 'Form Profiling',
    COLS: {
      NAME: 4,      // Index 4 = Kolom E (Nama Lengkap)
      STORE: 7,     // Index 7 = Kolom H (Lokasi Store)
      STATUS: 9,    // Index 9 = Kolom J (Status Pelanggan)
      AGE: 12,      // Index 12 = Kolom M (Umur)
      PHONE: 16,    // Index 16 = Kolom Q (No HP)
      JOB: 18,      // Index 18 = Kolom S (Pekerjaan)
      STYLE: 19     // Index 19 = Kolom T (Fashion Style)
    },
    TRAFFIC_SHEET_NAME: 'Traffic',
    TRAFFIC_COLS: {
      NAME: 2,      // Index 2 = Kolom C (Nama Lengkap)
      SERVED_BY: 5, // Index 5 = Kolom F (Served By)
      LOCATION: 6,  // Index 6 = Kolom G (Lokasi Store)
      STATUS: 7,    // Index 7 = Kolom H (Status Kedatangan)
      DATE: 11,     // Index 11 = Kolom L (Tanggal Berkunjung)
      PROSPECT: 17, // Index 17 = Kolom R (Prospek Level)
      NET_SALES: 35 // Index 35 = Kolom AJ (Net Sales After Tax)
    }
  },
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
    CATALOGUE_CODE: 14,
    PHONE: 15
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
    HOME_LOCATION: 18, // DYNAMIC FROM MASTER
    PHONE: 19
  }
};