/**
 * File: 9-API_CalendarNotes.gs
 * Description: API functions for Calendar Notes feature.
 * Allows users to add/edit/delete notes on specific dates in the Heatmap Calendar.
 * Notes are stored in a dedicated "Calendar_Notes" sheet tab.
 * Sheet columns: A=Date (YYYY-MM-DD), B=Note, C=UpdatedBy, D=UpdatedAt
 */

const NOTES_SHEET_NAME = 'Calendar_Notes';

/**
 * Get all calendar notes for a given month/year.
 * @param {string} monthName - Month name (e.g. "January")
 * @param {number} year - Year (e.g. 2026)
 * @returns {Object} Map of day number (string) to note text, e.g. {"1": "Event mall", "15": "Hujan"}
 */
function getCalendarNotes(monthName, year) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(NOTES_SHEET_NAME);
    if (!sheet) return {};

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return {}; // Only header row

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthIndex = monthNames.indexOf(monthName);
    if (monthIndex === -1) return {};

    const notes = {};
    for (let i = 1; i < data.length; i++) {
      const dateVal = data[i][0];
      const noteText = data[i][1];
      if (!dateVal || !noteText) continue;

      let d;
      if (dateVal instanceof Date) {
        d = dateVal;
      } else {
        d = new Date(String(dateVal));
      }

      if (d.getFullYear() === Number(year) && d.getMonth() === monthIndex) {
        notes[String(d.getDate())] = String(noteText);
      }
    }

    return notes;
  } catch (e) {
    console.error('getCalendarNotes error:', e);
    return {};
  }
}

/**
 * Save (upsert) or delete a calendar note for a specific date.
 * @param {string} dateStr - Date in YYYY-MM-DD format (e.g. "2026-03-05")
 * @param {string} noteText - The note text. If empty, the note is deleted.
 * @returns {Object} { success: boolean, message: string }
 */
function saveCalendarNote(dateStr, noteText) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(NOTES_SHEET_NAME);

    // Auto-create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(NOTES_SHEET_NAME);
      sheet.appendRow(['Date', 'Note', 'UpdatedBy', 'UpdatedAt']);
      // Format header
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    }

    const targetDate = new Date(dateStr);
    const data = sheet.getDataRange().getValues();
    let existingRow = -1;

    // Search for existing note on this date
    for (let i = 1; i < data.length; i++) {
      const cellDate = data[i][0];
      let d;
      if (cellDate instanceof Date) {
        d = cellDate;
      } else {
        d = new Date(String(cellDate));
      }

      if (d.getFullYear() === targetDate.getFullYear() &&
          d.getMonth() === targetDate.getMonth() &&
          d.getDate() === targetDate.getDate()) {
        existingRow = i + 1; // 1-indexed for sheet
        break;
      }
    }

    const userEmail = Session.getActiveUser().getEmail() || 'Unknown';
    const now = new Date();

    if (!noteText || noteText.trim() === '') {
      // DELETE: Remove the note
      if (existingRow > 0) {
        sheet.deleteRow(existingRow);
        return { success: true, message: 'Note deleted' };
      }
      return { success: true, message: 'No note to delete' };
    }

    if (existingRow > 0) {
      // UPDATE: Overwrite existing note
      sheet.getRange(existingRow, 2).setValue(noteText.trim());
      sheet.getRange(existingRow, 3).setValue(userEmail);
      sheet.getRange(existingRow, 4).setValue(now);
      return { success: true, message: 'Note updated' };
    } else {
      // INSERT: Add new note
      sheet.appendRow([dateStr, noteText.trim(), userEmail, now]);
      return { success: true, message: 'Note saved' };
    }
  } catch (e) {
    console.error('saveCalendarNote error:', e);
    return { success: false, message: 'Error: ' + e.toString() };
  }
}
