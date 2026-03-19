/**
 * CRM DATA PROCESSING APP
 * File: 1-Config.gs
 * Configuration constants for the CRM Portal.
 */
const CONFIG_CRM = {
  APP_TITLE: "Bvlgari CRM Portal",
  CRM_SS_ID: "1jXh-Rnj9fRuKD8U7Y4jWdwheMH47TVfcXhRxnWnSu3g",
  PROFILING_SS_ID: "17dIze7RwnA4nqxCVRbTeDIDlwCmW1OvgXQ9zMOM-ovM",
  CLEAN_TARGET_SS_ID: "1jRFK1jPuK_-pVvJYNx1PbvDEJaeAK4ZUZ0QTxWJsxwQ",
  CLEAN_SHEET_NAME: "clean_master",
  P_SHEET_NAME: "Form Profiling",
  T_SHEET_NAME: "Traffic",
  COLS: {
    P: { NAME: 4, PHONE: 16, STORE: 7 },
    T: { NAME: 2, DATE: 11, SERVED_BY: 5, LOCATION: 6, STATUS: 7, PROSPECT: 17, GROSS: 32, DISC_PCT: 33, VAL_DISC: 34, NET_SALES: 35 },
    C: { CUSTOMER: 2, DATE: 1, SALESMAN: 3, LOCATION: 4, GROSS: 8, DISC_PCT: 9, VAL_DISC: 10, NET_SALES: 14, PHONE: 19, HOME_LOCATION: 18 }
  }
};
