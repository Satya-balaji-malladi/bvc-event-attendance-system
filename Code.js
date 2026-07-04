/**
 * Entry point for Google Apps Script Web App
 */
function doGet(e) {
  // Returns the Index.html as an HtmlOutput object
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('BVC Event Attendance Admin')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Helper function to include external HTML files within the template
 * @param {string} filename 
 */
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

// ==========================================
// Global API Wrappers (callable by google.script.run)
// ==========================================

function login(credentials) {
  try { return JSON.parse(JSON.stringify(Controller.Auth.login(credentials) || {})); } 
  catch(e) { return { success: false, message: e.message }; }
}

function logout(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Auth.logout(sessionToken) || {})); } 
  catch(e) { return { success: false, message: e.message }; }
}

function authenticate(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Auth.authenticate(sessionToken) || {})); } 
  catch(e) { return { success: false, message: e.message }; }
}

function getAllEvents(sessionToken) {
  try {
    const res = Controller.Event.getAllEvents(sessionToken);
    const serialized = JSON.parse(JSON.stringify(res || []));
    Logger.log("Global getAllEvents() returning array of length: " + serialized.length);
    return serialized;
  } catch(e) {
    Logger.log("Error in global getAllEvents: " + e.message);
    return [];
  }
}

function createEvent(sessionToken, eventData) {
  try {
    const res = Controller.Event.createEvent(sessionToken, eventData);
    return JSON.parse(JSON.stringify(res || {}));
  } catch(e) {
    Logger.log(e);
    return { success: false, message: e.message };
  }
}

function updateEvent(sessionToken, eventId, eventData) {
  try {
    Logger.log("BACKEND: Code.js updateEvent called for " + eventId);
    const res = Controller.Event.updateEvent(sessionToken, eventId, eventData);
    Logger.log("BACKEND: Code.js updateEvent returning success: " + (res && res.success));
    return JSON.parse(JSON.stringify(res || {}));
  } catch(e) {
    Logger.log("BACKEND EXCEPTION in Code.js updateEvent: " + e.message);
    return { success: false, message: e.message };
  }
}

function deleteEvent(sessionToken, eventId) {
  try {
    const res = Controller.Event.deleteEvent(sessionToken, eventId);
    return JSON.parse(JSON.stringify(res || {}));
  } catch(e) {
    Logger.log(e);
    return { success: false, message: e.message };
  }
}

function getEventById(sessionToken, eventId) {
  try {
    Logger.log("BACKEND: Code.js getEventById called for " + eventId);
    const res = Controller.Event.getEventById(sessionToken, eventId);
    Logger.log("BACKEND: Code.js getEventById returning event");
    return JSON.parse(JSON.stringify(res || {}));
  } catch(e) {
    Logger.log("BACKEND EXCEPTION in Code.js getEventById: " + e.message);
    return [];
  }
}



function getAllUsers(sessionToken) {
  try {
    const res = Controller.User.getAllUsers(sessionToken);
    Logger.log("STEP 2 - Code.js received from Controller: " + typeof res + " / Array? " + Array.isArray(res) + " / Length: " + (res ? res.length : 0));
    // Force serialization to strip any Google Apps Script internal types (like Dates)
    const serialized = JSON.parse(JSON.stringify(res || []));
    Logger.log("STEP 2 - Code.js returning serialized: " + typeof serialized + " / Array? " + Array.isArray(serialized) + " / Length: " + serialized.length);
    return serialized;
  } catch (e) {
    Logger.log("STEP 2 - Error in global getAllUsers: " + e.message);
    return [];
  }
}

function createUser(sessionToken, userData) {
  try {
    Logger.log("BACKEND STEP 1: Code.js createUser started.");
    const result = Controller.User.createUser(sessionToken, userData);
    const serialized = JSON.parse(JSON.stringify(result || {}));
    Logger.log("BACKEND STEP 8: Code.js createUser finished. Returning: " + JSON.stringify(serialized));
    return serialized;
  } catch (e) {
    Logger.log("BACKEND EXCEPTION in Code.js createUser: " + e.message + "\\n" + e.stack);
    return { success: false, message: "Backend crash: " + e.message };
  }
}

function getAllStudents(sessionToken) {
  try {
    const res = Controller.Student.getAllStudents(sessionToken);
    return JSON.parse(JSON.stringify(res || []));
  } catch(e) {
    return [];
  }
}

function getDashboardSummary(sessionToken) {
  try {
    const res = Controller.Report.getDashboardSummary(sessionToken);
    return JSON.parse(JSON.stringify(res || {}));
  } catch(e) {
    return {};
  }
}

// Single endpoint to avoid google.script.run concurrency errors
function getDashboardData(sessionToken) {
  try {
    const data = {
      summary: Controller.Report.getDashboardSummary(sessionToken),
      events: Controller.Event.getAllEvents(sessionToken),
      users: Controller.User.getAllUsers(sessionToken),
      students: Controller.Student.getAllStudents(sessionToken)
    };
    return JSON.parse(JSON.stringify(data));
  } catch (e) {
    Logger.log("Error in getDashboardData: " + e.message);
    return { error: e.message };
  }
}

function getAttendanceByEvent(sessionToken, eventId) {
  try {
    const res = Controller.Attendance.getAttendanceByEvent(sessionToken, eventId);
    return JSON.parse(JSON.stringify(res || []));
  } catch(e) {
    return [];
  }
}

function markAttendance(sessionToken, attendanceData) {
  try {
    return JSON.parse(JSON.stringify(Controller.Attendance.markAttendance(sessionToken, attendanceData) || {}));
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function deleteAttendance(sessionToken, attendanceId) {
  try {
    return JSON.parse(JSON.stringify(Controller.Attendance.deleteAttendance(sessionToken, attendanceId) || {}));
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ==========================================
// Participant Management (Sprint 1)
// ==========================================
function getEventParticipants(sessionToken, eventId) {
  try {
    return JSON.parse(JSON.stringify(Controller.Participant.getEventParticipants(sessionToken, eventId) || {}));
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function addParticipant(sessionToken, eventId, rollNumber) {
  try {
    return JSON.parse(JSON.stringify(Controller.Participant.addParticipant(sessionToken, eventId, rollNumber) || {}));
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function removeParticipant(sessionToken, eventId, rollNumber) {
  try {
    return JSON.parse(JSON.stringify(Controller.Participant.removeParticipant(sessionToken, eventId, rollNumber) || {}));
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function restoreParticipant(sessionToken, eventId, rollNumber) {
  try {
    return JSON.parse(JSON.stringify(Controller.Participant.restoreParticipant(sessionToken, eventId, rollNumber) || {}));
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function checkEligibility(sessionToken, eventId, rollNumber) {
  try {
    return JSON.parse(JSON.stringify(Controller.Participant.checkEligibility(sessionToken, eventId, rollNumber) || {}));
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ==========================================
// Reports API
// ==========================================

function getDashboardSummary(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getDashboardSummary(sessionToken) || {})); } 
  catch(e) { return { success: false, message: e.message }; }
}

function getReportsDashboardSummary(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getReportsDashboardSummary(sessionToken) || {})); } 
  catch(e) { return { success: false, message: e.message }; }
}

function getEventReport(sessionToken, filters) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getEventReport(sessionToken, filters) || {})); } 
  catch(e) { return { success: false, message: e.message }; }
}

function deleteStudent(sessionToken, rollNumber) {
  try {
    return JSON.parse(JSON.stringify(Controller.Student.deleteStudent(sessionToken, rollNumber) || {}));
  } catch(e) {
    return {success: false, message: e.message};
  }
}

function runDiagnostics() {
  Logger.log("=== DIAGNOSTICS START ===");
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET.ID);
    Logger.log("Spreadsheet Name: " + ss.getName());
    
    const sheets = ss.getSheets();
    Logger.log("Total Tabs: " + sheets.length);
    
    sheets.forEach(sheet => {
      const name = sheet.getName();
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      Logger.log("Tab: '" + name + "' | Last Row: " + lastRow + " | Last Col: " + lastCol);
      
      if (lastRow > 1) {
        const data = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
        Logger.log("  -> Row 2 Data: " + JSON.stringify(data));
      } else {
        Logger.log("  -> NO DATA (Only Headers or Empty)");
      }
    });
  } catch(e) {
    Logger.log("Diagnostics Error: " + e.message);
  }
  Logger.log("=== DIAGNOSTICS END ===");
}

function getStudentReport(sessionToken, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getStudentReport(sessionToken, rollNumber) || {})); } 
  catch(e) { return { success: false, message: e.message }; }
}

function getDepartmentReport(sessionToken, department) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getDepartmentReport(sessionToken, department) || {})); } 
  catch(e) { return { success: false, message: e.message }; }
}

function getCoordinatorReport(sessionToken, coordinatorId) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getCoordinatorReport(sessionToken, coordinatorId) || {})); } 
  catch(e) { return { success: false, message: e.message }; }
}

function getDateRangeReport(sessionToken, fromDate, toDate) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getDateRangeReport(sessionToken, fromDate, toDate) || {})); } 
  catch(e) { return { success: false, message: e.message }; }
}

// ==========================================
// Settings API
// ==========================================
function getSettings(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Settings.getSettings(sessionToken) || {})); } 
  catch(e) { return { success: false, message: e.message }; }
}

function saveSettings(sessionToken, payload) {
  try { return JSON.parse(JSON.stringify(Controller.Settings.saveSettings(sessionToken, payload) || {})); } 
  catch(e) { return { success: false, message: e.message }; }
}
