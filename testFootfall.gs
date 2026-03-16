function testFootfallAnalytics() {
  const t = getFootfallAnalytics('ALL', '2026');
  Logger.log(JSON.stringify(t));
}

function testDateFormats() {
  const ss = SpreadsheetApp.openById('1jRFK1jPuK_-pVvJYNx1PbvDEJaeAK4ZUZ0QTxWJsxwQ');
  const piSheet = ss.getSheetByName('footfall_pi');
  const d1 = piSheet.getDataRange().getValues().slice(1, 4).map(r => r[0]);

  const extSS = SpreadsheetApp.openById('17dIze7RwnA4nqxCVRbTeDIDlwCmW1OvgXQ9zMOM-ovM');
  const trfSheet = extSS.getSheetByName('Traffic');
  const d2 = trfSheet.getDataRange().getValues().slice(1, 4).map(r => r[11]);
  
  return JSON.stringify({
    footfall_dates: d1,
    traffic_dates: d2,
    parsed_footfall: d1.map(d => parseDateFix(d)),
    parsed_traffic: d2.map(d => parseDateFix(d))
  });
}
