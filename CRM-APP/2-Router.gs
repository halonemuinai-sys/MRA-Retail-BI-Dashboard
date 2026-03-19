/**
 * File: 2-Router.gs
 * Entry point and HTML routing.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(CONFIG_CRM.APP_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Fungsi wajib untuk memasukkan modul HTML (Css, Js, Menu)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
