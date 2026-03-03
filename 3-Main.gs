/**
 * File: 3-Main.gs
 * Description: Entry point untuk Web App (doGet) dan templating.
 */

// ==========================================
// --- APP ENTRY POINTS & TEMPLATING ---
// ==========================================

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Retail Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * !!! FUNGSI INI WAJIB ADA !!!
 * Ini adalah "Kunci" agar Index.html bisa membaca file View lainnya.
 * Jika fungsi ini hilang, akan muncul ReferenceError: include is not defined.
 */
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}