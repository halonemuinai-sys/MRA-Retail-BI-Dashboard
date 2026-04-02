// ============================================================
//  IT HELPDESK — BACKEND
// ============================================================

function doGet(e) {
  var view = 'mobile';
  if (e && e.parameter && e.parameter.view === 'admin') view = 'admin';
  var file = (view === 'admin') ? 'Index-Admin' : 'Index-Helpdesk';
  return HtmlService.createTemplateFromFile(file)
    .evaluate()
    .setTitle('IT Helpdesk | MRA Retail')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ---- Helper: Open spreadsheet ----
function _ss() {
  return SpreadsheetApp.openById(CONFIG.SHEET_ID);
}

// ---- Setup: Pastikan semua sheet ada ----
function setupSheets() {
  var ss = _ss();

  if (!ss.getSheetByName('USERS')) {
    var s = ss.insertSheet('USERS');
    s.appendRow(['Store','Name','PIN','Role']);
    s.getRange('A1:D1').setFontWeight('bold');
    s.appendRow(['Plaza Indonesia','Store Staff PI','1234','staff']);
    s.appendRow(['Head Office','IT Admin','9999','admin']);
  }

  if (!ss.getSheetByName('CATEGORIES')) {
    var s = ss.insertSheet('CATEGORIES');
    s.appendRow(['Label','Active']);
    s.getRange('A1:B1').setFontWeight('bold');
    var cats = [
      'POS Hardware','POS Software','POS Account',
      'Printer & Peripheral','Email & Ms Office',
      'Network & Internet','Infrastruktur IT',
      'CCTV & Security','ERP / SAP','Traffic Counter',
      'Retailsoft','BSC','Permintaan Perangkat','Lainnya'
    ];
    for (var i = 0; i < cats.length; i++) {
      s.appendRow([cats[i], 'TRUE']);
    }
  }

  if (!ss.getSheetByName('IT_STAFF')) {
    var s = ss.insertSheet('IT_STAFF');
    s.appendRow(['Name','Active']);
    s.getRange('A1:B1').setFontWeight('bold');
    s.appendRow(['IT Admin','TRUE']);
  }

  if (!ss.getSheetByName('TICKETS')) {
    var s = ss.insertSheet('TICKETS');
    s.appendRow([
      'Ticket ID','Tanggal','Store','Pelapor',
      'Kategori','Deskripsi','Prioritas',
      'Status','Assigned To','Catatan IT',
      'Responded At','Resolved At'
    ]);
    s.getRange('A1:L1').setFontWeight('bold');
  }
}

// ============================================================
//  AUTH
// ============================================================
function getUsers() {
  try {
    setupSheets();
    var data = _ss().getSheetByName('USERS').getDataRange().getValues();
    var users = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][1]) {
        users.push({ store: String(data[i][0]), name: String(data[i][1]) });
      }
    }
    return { ok: true, users: users };
  } catch(e) {
    return { ok: false, msg: e.message, users: [] };
  }
}

function login(name, pin) {
  try {
    var data = _ss().getSheetByName('USERS').getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(name)) {
        if (String(data[i][2]) === String(pin)) {
          return { ok: true, user: { store: String(data[i][0]), name: String(data[i][1]), role: String(data[i][3]).toLowerCase() } };
        }
        return { ok: false, msg: 'PIN salah.' };
      }
    }
    return { ok: false, msg: 'Nama tidak ditemukan.' };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ============================================================
//  CATEGORIES & IT STAFF
// ============================================================
function getCategories() {
  try {
    var sheet = _ss().getSheetByName('CATEGORIES');
    if (!sheet) return { ok: true, list: ['Lainnya'] };
    var data = sheet.getDataRange().getValues();
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && String(data[i][1]).toUpperCase() === 'TRUE') {
        list.push(String(data[i][0]));
      }
    }
    return { ok: true, list: list.length ? list : ['Lainnya'] };
  } catch(e) {
    return { ok: true, list: ['Lainnya'] };
  }
}

function getStaff() {
  try {
    var sheet = _ss().getSheetByName('IT_STAFF');
    if (!sheet) return { ok: true, list: [] };
    var data = sheet.getDataRange().getValues();
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && String(data[i][1]).toUpperCase() === 'TRUE') {
        list.push(String(data[i][0]));
      }
    }
    return { ok: true, list: list };
  } catch(e) {
    return { ok: true, list: [] };
  }
}

// ============================================================
//  TICKETS — Read
// ============================================================
function getTickets(store, role, month, year) {
  try {
    var sheet = _ss().getSheetByName('TICKETS');
    if (!sheet) return { ok: true, tickets: [] };
    var data = sheet.getDataRange().getValues();
    var isAdmin = (role === 'admin' || role === 'it');
    var tz = Session.getScriptTimeZone();
    var tickets = [];

    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[0] || !r[1]) continue;
      var tStore = String(r[2] || '');
      if (!isAdmin && tStore !== store) continue;

      var d = new Date(r[1]);
      if (month !== undefined && month !== null && month !== '' && d.getMonth() !== parseInt(month)) continue;
      if (year !== undefined && year !== null && year !== '' && d.getFullYear() !== parseInt(year)) continue;

      var prio = String(r[6] || 'Low');
      var status = String(r[7] || 'Open');

      tickets.push({
        id:        String(r[0]),
        date:      Utilities.formatDate(d, tz, 'dd MMM yyyy HH:mm'),
        dateRaw:   r[1],
        store:     tStore,
        reporter:  String(r[3] || ''),
        category:  String(r[4] || ''),
        desc:      String(r[5] || ''),
        priority:  prio,
        status:    status,
        assigned:  String(r[8] || ''),
        notes:     String(r[9] || ''),
        responded: r[10] ? Utilities.formatDate(new Date(r[10]), tz, 'dd MMM yyyy HH:mm') : '-',
        resolved:  r[11] ? Utilities.formatDate(new Date(r[11]), tz, 'dd MMM yyyy HH:mm') : '-',
        sla:       _sla(prio, status, r[1])
      });
    }

    tickets.sort(function(a, b) { return new Date(b.dateRaw) - new Date(a.dateRaw); });
    return { ok: true, tickets: tickets };
  } catch(e) {
    return { ok: false, msg: e.message, tickets: [] };
  }
}

// ============================================================
//  TICKETS — Create
// ============================================================
function createTicket(store, reporter, category, desc, priority) {
  try {
    setupSheets();
    var sheet = _ss().getSheetByName('TICKETS');
    var ts = new Date();
    var id = 'IT-' + Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
    sheet.appendRow([id, ts, store, reporter, category, desc, priority, 'Open', '', '', '', '']);
    SpreadsheetApp.flush();
    return { ok: true, msg: 'Ticket ' + id + ' berhasil dibuat.', id: id };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ============================================================
//  TICKETS — Update (Admin)
// ============================================================
function updateTicket(ticketId, newStatus, assignedTo, notes) {
  try {
    var sheet = _ss().getSheetByName('TICKETS');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(ticketId)) {
        var row = i + 1;
        var oldStatus = String(data[i][7] || 'Open');

        if (newStatus) sheet.getRange(row, 8).setValue(newStatus);
        if (assignedTo !== undefined) sheet.getRange(row, 9).setValue(assignedTo);
        if (notes !== undefined) sheet.getRange(row, 10).setValue(notes);

        // Auto timestamps
        if (oldStatus === 'Open' && (newStatus === 'In Progress' || newStatus === 'Responded')) {
          if (!data[i][10]) sheet.getRange(row, 11).setValue(new Date());
        }
        if (newStatus === 'Resolved') {
          if (!data[i][11]) sheet.getRange(row, 12).setValue(new Date());
        }

        SpreadsheetApp.flush();
        return { ok: true, msg: 'Ticket ' + ticketId + ' updated.' };
      }
    }
    return { ok: false, msg: 'Ticket tidak ditemukan.' };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ============================================================
//  STATS (Admin Dashboard)
// ============================================================
function getStats(month, year) {
  try {
    var sheet = _ss().getSheetByName('TICKETS');
    if (!sheet) return { ok: true, s: { open:0, progress:0, resolved:0, total:0, byCat:{}, byStore:{} } };
    var data = sheet.getDataRange().getValues();

    var s = { open:0, progress:0, resolved:0, total:0, byCat:{}, byStore:{} };

    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[0] || !r[1]) continue;
      var d = new Date(r[1]);
      if (month !== undefined && month !== null && month !== '' && d.getMonth() !== parseInt(month)) continue;
      if (year !== undefined && year !== null && year !== '' && d.getFullYear() !== parseInt(year)) continue;

      s.total++;
      var st = String(r[7] || 'Open');
      if (st === 'Open') s.open++;
      else if (st === 'Resolved') s.resolved++;
      else s.progress++;

      var cat = String(r[4] || 'Lainnya');
      var store = String(r[2] || 'Unknown');
      s.byCat[cat] = (s.byCat[cat] || 0) + 1;
      s.byStore[store] = (s.byStore[store] || 0) + 1;
    }
    return { ok: true, s: s };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ============================================================
//  SLA Helper
// ============================================================
function _sla(priority, status, createdAt) {
  if (status === 'Resolved') return { text:'Selesai', color:'emerald' };
  if (!createdAt) return { text:'—', color:'gray' };
  var hours = (new Date() - new Date(createdAt)) / 3600000;
  if (status === 'Open') {
    var limit = priority === 'High' ? 0.5 : (priority === 'Medium' ? 4 : 24);
    return hours > limit ? { text:'Response Overdue', color:'red' } : { text:'Menunggu Respon', color:'amber' };
  }
  // In Progress
  var limit2 = priority === 'High' ? 4 : (priority === 'Medium' ? 48 : 120);
  return hours > limit2 ? { text:'Resolution Overdue', color:'red' } : { text:'Dalam Penanganan', color:'blue' };
}
