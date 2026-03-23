/**
 * CRM DATA PROCESSING APP
 * File: 1-Config.gs
 * Configuration constants for the CRM Portal.
 */
const CONFIG_CRM = {
  APP_TITLE: "ARES CRM Portal",
  CRM_SS_ID: "1jXh-Rnj9fRuKD8U7Y4jWdwheMH47TVfcXhRxnWnSu3g",
  PROFILING_SS_ID: "17dIze7RwnA4nqxCVRbTeDIDlwCmW1OvgXQ9zMOM-ovM",
  CLEAN_TARGET_SS_ID: "1jRFK1jPuK_-pVvJYNx1PbvDEJaeAK4ZUZ0QTxWJsxwQ",
  CLEAN_SHEET_NAME: "clean_master",
  P_SHEET_NAME: "Form Profiling",
  T_SHEET_NAME: "Traffic",
  LIVE_SHEET_NAME: "Live Extraction",
  CUSTOMER_SHEET_NAME: "Customer_Master",
  COLS: {
    P: { NAME: 4, PHONE: 16, STORE: 7, DOB: 8 },
    T: { NAME: 2, DATE: 11, SERVED_BY: 5, LOCATION: 6, STATUS: 7, PROSPECT: 17, GROSS: 32, DISC_PCT: 33, VAL_DISC: 34, NET_SALES: 35 },
    C: { CUSTOMER: 2, DATE: 1, SALESMAN: 3, LOCATION: 4, GROSS: 8, DISC_PCT: 9, VAL_DISC: 10, NET_SALES: 14, PHONE: 19, HOME_LOCATION: 18 }
  },
  COLS_EXTRACTION: {
      YM_KEY: 0,
      YEAR: 1,
      MONTH: 2,
      LOCATION: 3,
      NET_SALES: 4,
      QTY: 5,
      UNIQUE_CUSTOMER: 6,
      TRANSACTION_COUNT: 7,
      WALK_IN: 8,
      FOLLOW_UP: 9,
      DELIVERY: 10,
      ONLINE_ONLY: 11,
      PROFILE_MENUNGGU: 12,
      PROFILE_POTENSIAL: 13,
      PROFILE_NEGO: 14,
      PROFILE_BERHASIL: 15,
      PROFILE_GAGAL: 16
  },
  COLS_CUST: {
      NAME: 0,
      PHONE: 1,
      TOTAL_SPEND: 2,
      FREQ_INVOICE: 3,
      TIER: 4,
      LAST_PURCHASE: 5,
      ADVISOR: 6
  },
  
  // Database Supabase Configuration Target
  SUPABASE: {
      URL: 'ISI_DENGAN_URL_SUPABASE_ANDA_DISINI',
      KEY: 'ISI_DENGAN_ANON_KEY_SUPABASE_ANDA_DISINI'
  }
};
