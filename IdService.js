/**
 * Service for generating unique IDs across the system.
 * Prevents duplicates by parsing the highest existing sequence number instead of relying on row count.
 */
const IdService = {

  /**
   * Private helper to generate the next ID in a sequence based on existing records.
   * @param {string} prefix - The ID prefix (e.g., 'USR-', 'EVT-2026-').
   * @param {string} sheetName - The name of the sheet.
   * @param {string} columnName - The header name of the ID column.
   * @param {number} paddingLength - The required padding length for the number.
   * @returns {string} The next unique ID.
   */
  _generateNextId: function(prefix, sheetName, columnName, paddingLength) {
    const records = DatabaseService.readAllRows(sheetName);
    let maxSequence = 0;

    for (let i = 0; i < records.length; i++) {
      const currentId = records[i][columnName];
      if (currentId && typeof currentId === 'string' && currentId.startsWith(prefix)) {
        // Extract the numeric part after the prefix
        const sequenceStr = currentId.substring(prefix.length);
        const sequenceNum = parseInt(sequenceStr, 10);
        
        if (!isNaN(sequenceNum) && sequenceNum > maxSequence) {
          maxSequence = sequenceNum;
        }
      }
    }

    const nextSequence = maxSequence + 1;
    return prefix + Utils._padNumber(nextSequence, paddingLength);
  },

  /**
   * Generates a unique User ID.
   * Format: USR-001
   * @returns {string}
   */
  generateUserId: function() {
    return this._generateNextId('USR-', CONFIG.SHEETS.USERS, 'user_id', 3);
  },

  /**
   * Generates a unique Event ID.
   * Format: EVT-YYYY-001
   * @returns {string}
   */
  generateEventId: function() {
    const year = Utils.getCurrentDate().getFullYear();
    const prefix = 'EVT-' + year + '-';
    return this._generateNextId(prefix, CONFIG.SHEETS.EVENTS, 'event_id', 3);
  },

  /**
   * Generates a unique Attendance ID.
   * Format: ATD-YYYY-000001
   * @returns {string}
   */
  generateAttendanceId: function() {
    const year = Utils.getCurrentDate().getFullYear();
    const prefix = 'ATD-' + year + '-';
    return this._generateNextId(prefix, CONFIG.SHEETS.ATTENDANCE, 'attendance_id', 6);
  },

  /**
   * Generates a unique Session ID.
   * Format: SES-000001
   * @returns {string}
   */
  generateSessionId: function() {
    return this._generateNextId('SES-', CONFIG.SHEETS.SESSIONS, 'session_id', 6);
  },

  /**
   * Generates a unique Student ID.
   * Format: STU-000001
   * @returns {string}
   */
  generateStudentId: function() {
    return this._generateNextId('STU-', CONFIG.SHEETS.STUDENTS, 'student_id', 6);
  }
};
