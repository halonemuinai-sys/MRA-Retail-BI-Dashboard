/**
 * File: 2-Utilities.gs
 * Description: Fungsi bantuan umum (Core Utilities).
 * STATUS: UPDATED
 */

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function parseDateFix(input) {
  if (!input) return new Date(0);
  if (input instanceof Date) return input;

  let str = String(input).trim();
  // Fix format YYYY/MM/DD atau sejenisnya jika terlalu panjang
  if (str.length > 10 && str.charAt(2) === '/' && str.charAt(5) === '/') {
    str = str.substring(0, 10);
  }

  // Handle format DD/MM/YYYY
  if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    const parts = str.split('/');
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }

  return new Date(str);
}