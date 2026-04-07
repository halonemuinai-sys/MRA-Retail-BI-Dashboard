// Safe getters — fallback jika 0-Config belum ter-load
function _getSheetId() {
  try { return HELPDESK_CONFIG.DB_SHEET_ID; } catch(e) { return '1HJN4XcdJWmejuBbPZzjnntHSxKL5zYQd31gqc06zwSU'; }
}
function _sn(key) {
  // Safe Sheet Name getter
  try { return HELPDESK_CONFIG.SHEETS[key]; } catch(e) {
    var n = { USERS:'USERS', TICKETS:'TICKETS', CATEGORIES:'CATEGORIES', IT_STAFF:'IT_STAFF' };
    return n[key] || key;
  }
}
function _getDefaultCategories() {
  try { return HELPDESK_CONFIG.DEFAULT_CATEGORIES; } catch(e) {
    return [
      { code:'POS_HW', label:'POS Hardware', desc:'Mesin POS mati, keyboard, monitor' },
      { code:'POS_SW', label:'POS Software', desc:'Error aplikasi POS, update fitur' },
      { code:'POS_ACC', label:'POS Account', desc:'Reset password, akun terkunci' },
      { code:'PRINTER', label:'Printer & Peripheral', desc:'Printer struk, label, scanner' },
      { code:'EMAIL', label:'Email & Ms Office', desc:'Outlook, Word, Excel, PowerPoint' },
      { code:'NETWORK', label:'Network & Internet', desc:'WiFi, koneksi, VPN' },
      { code:'INFRA', label:'Infrastruktur IT', desc:'Server, switch, AP, kabel' },
      { code:'CCTV', label:'CCTV & Security', desc:'CCTV offline, NVR, rekaman' },
      { code:'ERP', label:'ERP / SAP', desc:'Error SAP, sync data' },
      { code:'TRAFFIC', label:'Traffic Counter', desc:'Sensor traffic, footfall' },
      { code:'RETAILSOFT', label:'Retailsoft', desc:'Aplikasi Retailsoft' },
      { code:'BSC', label:'BSC', desc:'Balanced Scorecard' },
      { code:'DEVICE_REQ', label:'Permintaan Perangkat', desc:'Request laptop/HP/tablet' },
      { code:'OTHER', label:'Lainnya', desc:'Masalah lain' }
    ];
  }
}

// ============================================================
// ROUTING — doGet
// ============================================================
function doGet(e) {
  var view = (e && e.parameter && e.parameter.view) ? e.parameter.view : 'mobile';
  var template = (view === 'admin') ? 'Index-Admin' : 'Index-Helpdesk';
  
  return HtmlService.createTemplateFromFile(template)
      .evaluate()
      .setTitle('IT Helpdesk | MRA Retail')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// SETUP — Ensure Sheets Exist
// ============================================================
function ensureHelpdeskSheets() {
  var ss = SpreadsheetApp.openById(_getSheetId());
  
  // ---- USERS ----
  var userSheet = ss.getSheetByName(_sn('USERS'));
  if (!userSheet) {
    userSheet = ss.insertSheet(_sn('USERS'));
    userSheet.appendRow(["Store", "Name", "PIN", "Role"]);
    userSheet.getRange("A1:D1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
    userSheet.appendRow(["Plaza Indonesia", "Store Staff PI", "1234", "staff"]);
    userSheet.appendRow(["Plaza Senayan", "Store Staff PS", "1234", "staff"]);
    userSheet.appendRow(["Head Office", "IT Admin", "9999", "admin"]);
  }

  // ---- CATEGORIES (Master) ----
  var catSheet = ss.getSheetByName(_sn('CATEGORIES'));
  if (!catSheet) {
    catSheet = ss.insertSheet(_sn('CATEGORIES'));
    catSheet.appendRow(["Code", "Label", "Description", "Active"]);
    catSheet.getRange("A1:D1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
    var cats = _getDefaultCategories();
    for (var c = 0; c < cats.length; c++) {
      catSheet.appendRow([cats[c].code, cats[c].label, cats[c].desc, "TRUE"]);
    }
    catSheet.setColumnWidth(1, 120);
    catSheet.setColumnWidth(2, 200);
    catSheet.setColumnWidth(3, 350);
    catSheet.setColumnWidth(4, 80);
  }

  // ---- IT_STAFF ----
  var staffSheet = ss.getSheetByName(_sn('IT_STAFF'));
  if (!staffSheet) {
    staffSheet = ss.insertSheet(_sn('IT_STAFF'));
    staffSheet.appendRow(["Name", "Role", "Active"]);
    staffSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
    staffSheet.appendRow(["IT Admin", "Lead", "TRUE"]);
  }

  // ---- TICKETS ----
  var ticketSheet = ss.getSheetByName(_sn('TICKETS'));
  if (!ticketSheet) {
    ticketSheet = ss.insertSheet(_sn('TICKETS'));
    ticketSheet.appendRow([
      "Ticket ID", "Created At", "Store", "Reported By", "Issue Category",
      "Description", "Priority", "Status", "Responded At", "Resolved At", 
      "IT Notes", "Assigned To"
    ]);
    ticketSheet.getRange("A1:L1").setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }
}

// ============================================================
// AUTH
// ============================================================
function getHelpdeskUserList() {
  try {
    ensureHelpdeskSheets();
    var ss = SpreadsheetApp.openById(_getSheetId());
    var sheet = ss.getSheetByName(_sn('USERS'));
    if (!sheet) return { success: true, users: [] };
    var data = sheet.getDataRange().getValues();
    
    var users = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][1]) {
        users.push({
          store: data[i][0].toString(),
          name: data[i][1].toString()
        });
      }
    }
    return { success: true, users: users };
  } catch(e) {
    return { success: false, message: e.message, users: [] };
  }
}

function loginHelpdesk(name, pin) {
  try {
    var ss = SpreadsheetApp.openById(_getSheetId());
    var sheet = ss.getSheetByName(_sn('USERS'));
    if (!sheet) return { success: false, message: "Sheet USERS tidak ditemukan." };
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][1].toString() === name.toString()) {
        if (data[i][2].toString() === pin.toString()) {
          return {
            success: true,
            user: {
              store: data[i][0].toString(),
              name: data[i][1].toString(),
              role: data[i][3].toString().toLowerCase()
            }
          };
        } else {
          return { success: false, message: "PIN Salah. Silakan coba lagi." };
        }
      }
    }
    return { success: false, message: "Nama tidak ditemukan." };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ============================================================
// CATEGORIES (Dynamic from Sheet)
// ============================================================
function getHelpdeskCategories() {
  try {
    var ss = SpreadsheetApp.openById(_getSheetId());
    var sheet = ss.getSheetByName(_sn('CATEGORIES'));
    if (!sheet) return { success: true, categories: _getDefaultCategories() };
    
    var data = sheet.getDataRange().getValues();
    var categories = [];
    for (var i = 1; i < data.length; i++) {
      var active = data[i][3] ? data[i][3].toString().toUpperCase() : "TRUE";
      if (active === "TRUE" && data[i][0] && data[i][1]) {
        categories.push({
          code: data[i][0].toString(),
          label: data[i][1].toString(),
          desc: data[i][2] ? data[i][2].toString() : ''
        });
      }
    }
    if (categories.length === 0) categories = _getDefaultCategories();
    return { success: true, categories: categories };
  } catch(e) {
    return { success: false, message: e.message, categories: _getDefaultCategories() };
  }
}

// ============================================================
// IT STAFF LIST (for Assign To)
// ============================================================
function getITStaffList() {
  try {
    var ss = SpreadsheetApp.openById(_getSheetId());
    var sheet = ss.getSheetByName(_sn('IT_STAFF'));
    if (!sheet) return { success: true, staff: [] };
    
    var data = sheet.getDataRange().getValues();
    var staff = [];
    for (var i = 1; i < data.length; i++) {
      var active = data[i][2] ? data[i][2].toString().toUpperCase() : "TRUE";
      if (active === "TRUE" && data[i][0]) {
        staff.push({
          name: data[i][0].toString(),
          role: data[i][1] ? data[i][1].toString() : ''
        });
      }
    }
    return { success: true, staff: staff };
  } catch(e) {
    return { success: false, message: e.message, staff: [] };
  }
}

// ============================================================
// TICKETS — Get
// ============================================================
function getHelpdeskTickets(store, role, paramMonth, paramYear) {
  try {
    ensureHelpdeskSheets();
    var ss = SpreadsheetApp.openById(_getSheetId());
    var sheet = ss.getSheetByName(_sn('TICKETS'));
    if (!sheet) return { success: true, tickets: [] };
    var data = sheet.getDataRange().getValues();
    
    var tickets = [];
    var isAdmin = (role === 'admin' || role === 'it');

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      
      var ticketStore = row[2] ? row[2].toString() : '';
      if (!isAdmin && ticketStore !== store) continue;

      var createdAt = row[1];
      if (!createdAt) continue;
      var tDate = new Date(createdAt);
      
      // Filter by month/year if provided
      if (paramMonth !== undefined && paramMonth !== null && paramMonth !== '' && tDate.getMonth() !== parseInt(paramMonth)) continue;
      if (paramYear !== undefined && paramYear !== null && paramYear !== '' && tDate.getFullYear() !== parseInt(paramYear)) continue;

      var priority = row[6] ? row[6].toString() : 'Low';
      var status = row[7] ? row[7].toString() : 'Open';
      var respondedAt = row[8];
      var resolvedAt = row[9];
      
      var slaStatus = calculateSLAStatus(priority, status, createdAt, respondedAt, resolvedAt);

      tickets.push({
        id: row[0].toString(),
        createdAt: Utilities.formatDate(tDate, Session.getScriptTimeZone(), 'dd MMM yyyy HH:mm'),
        createdAtRaw: createdAt,
        store: ticketStore,
        reportedBy: row[3] ? row[3].toString() : '',
        category: row[4] ? row[4].toString() : '',
        description: row[5] ? row[5].toString() : '',
        priority: priority,
        status: status,
        respondedAt: respondedAt ? Utilities.formatDate(new Date(respondedAt), Session.getScriptTimeZone(), 'dd MMM yyyy HH:mm') : '-',
        resolvedAt: resolvedAt ? Utilities.formatDate(new Date(resolvedAt), Session.getScriptTimeZone(), 'dd MMM yyyy HH:mm') : '-',
        notes: row[10] ? row[10].toString() : '',
        assignedTo: (row.length > 11 && row[11]) ? row[11].toString() : '',
        sla: slaStatus
      });
    }

    // Sort ascending: newest at bottom
    tickets.sort(function(a,b) { return new Date(a.createdAtRaw) - new Date(b.createdAtRaw); });

    return { success: true, tickets: tickets };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ============================================================
// TICKETS — Stats (for Admin Dashboard)
// ============================================================
function getTicketStats(paramMonth, paramYear) {
  try {
    ensureHelpdeskSheets();
    var ss = SpreadsheetApp.openById(_getSheetId());
    var sheet = ss.getSheetByName(_sn('TICKETS'));
    var emptyStats = { open:0, responded:0, resolved:0, breached:0, total:0, byCategory:{}, byStore:{}, byPriority:{High:0,Medium:0,Low:0} };
    if (!sheet) return { success: true, stats: emptyStats };
    var data = sheet.getDataRange().getValues();
    
    var stats = { open:0, responded:0, resolved:0, breached:0, total:0,
                  byCategory:{}, byStore:{}, byPriority:{High:0, Medium:0, Low:0} };

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0] || !row[1]) continue;
      var tDate = new Date(row[1]);

      if (paramMonth !== undefined && paramMonth !== null && paramMonth !== '' && tDate.getMonth() !== parseInt(paramMonth)) continue;
      if (paramYear !== undefined && paramYear !== null && paramYear !== '' && tDate.getFullYear() !== parseInt(paramYear)) continue;

      stats.total++;
      var status = row[7] ? row[7].toString() : 'Open';
      var priority = row[6] ? row[6].toString() : 'Low';
      var cat = row[4] ? row[4].toString() : 'Lainnya';
      var store = row[2] ? row[2].toString() : 'Unknown';

      if (status === 'Open') stats.open++;
      else if (status === 'Responded' || status === 'In Progress') stats.responded++;
      else if (status === 'Resolved') stats.resolved++;

      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
      stats.byStore[store] = (stats.byStore[store] || 0) + 1;
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;

      // SLA breach check
      var sla = calculateSLAStatus(priority, status, row[1], row[8], row[9]);
      if (sla.color === 'red') stats.breached++;
    }

    return { success: true, stats: stats };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ============================================================
// TICKETS — Save / Update
// ============================================================
function saveHelpdeskTicket(store, reportedBy, category, description, priority, isUpdate, ticketId, updateStatus, updateNotes, assignedTo) {
  try {
    ensureHelpdeskSheets();
    var ss = SpreadsheetApp.openById(_getSheetId());
    var sheet = ss.getSheetByName(_sn('TICKETS'));
    
    if (isUpdate && ticketId) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0].toString() === ticketId.toString()) {
          var rowIdx = i + 1;
          var currentStatus = data[i][7] ? data[i][7].toString() : 'Open';
          
          // Update status
          if (updateStatus) sheet.getRange(rowIdx, 8).setValue(updateStatus);
          // Update notes
          if (updateNotes !== undefined) sheet.getRange(rowIdx, 11).setValue(updateNotes);
          // Update assignedTo
          if (assignedTo !== undefined) sheet.getRange(rowIdx, 12).setValue(assignedTo);
          
          // Auto-set respondedAt
          if (currentStatus === "Open" && (updateStatus === "Responded" || updateStatus === "In Progress")) {
            if (!data[i][8]) sheet.getRange(rowIdx, 9).setValue(new Date()); 
          }
          // Auto-set resolvedAt
          if (updateStatus === "Resolved") {
            if (!data[i][9]) sheet.getRange(rowIdx, 10).setValue(new Date());
          }
          break;
        }
      }
      SpreadsheetApp.flush();
      return { success: true, message: "Ticket " + ticketId + " berhasil diupdate." };
    } else {
      // Create New
      var ts = new Date();
      var id = "IT-" + Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
      sheet.appendRow([
        id, ts, store, reportedBy, category, description, priority, "Open", "", "", "", ""
      ]);
      SpreadsheetApp.flush();
      return { success: true, message: "Ticket berhasil dibuat: " + id, ticketId: id };
    }
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ============================================================
// SLA LOGIC (Mon - Fri)
// ============================================================
function calculateSLAStatus(priority, status, createdAt, respondedAt, resolvedAt) {
  if (!createdAt) return { text: "No Date", color: "gray" };
  var created = new Date(createdAt);
  var now = new Date();
  
  if (status === "Resolved") {
    return { text: "Selesai", color: "emerald" };
  }

  var hoursPassed = calculateWorkHoursPassed(created, now);

  if (status === "Open") {
    var maxH = 24;
    if (priority === "High") maxH = 0.5;
    else if (priority === "Medium") maxH = 4;
    if (hoursPassed > maxH) return { text: "Response Overdue", color: "red" };
    return { text: "Menunggu Respon", color: "amber" };
  }

  if (status === "In Progress" || status === "Responded") {
    var maxH2 = 40;
    if (priority === "High") maxH2 = 4;
    else if (priority === "Medium") maxH2 = 16;
    if (hoursPassed > maxH2) return { text: "Resolution Overdue", color: "red" };
    return { text: "Dalam Penanganan", color: "blue" };
  }
  
  return { text: "Unknown", color: "gray" };
}

// Optimized: calculate work hours (Mon-Fri, 8h/day)
function calculateWorkHoursPassed(start, end) {
  if (start > end) return 0;
  
  var totalHours = 0;
  var current = new Date(start.getTime());
  
  while (current < end) {
    var day = current.getDay();
    if (day !== 0 && day !== 6) {
      var dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);
      var effectiveEnd = (end < dayEnd) ? end : dayEnd;
      var diffMs = effectiveEnd.getTime() - current.getTime();
      totalHours += Math.min(diffMs / (1000 * 60 * 60), 8);
    }
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }
  
  return totalHours;
}
