/**
 * Entry point for Google Apps Script Web App
 */
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'Login';
  
  if (page.toLowerCase() === 'forgotpassword') {
    return HtmlService.createTemplateFromFile('ForgotPassword')
        .evaluate()
        .setTitle('Forgot Password - BVC System')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  if (page.toLowerCase() === 'dashboard') {
    return HtmlService.createTemplateFromFile('Index')
        .evaluate()
        .setTitle('Dashboard - Admin')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page.toLowerCase() === 'coordinator') {
    try {
      return HtmlService.createTemplateFromFile('Coordinator')
          .evaluate()
          .setTitle('Dashboard - Coordinator')
          .addMetaTag('viewport', 'width=device-width, initial-scale=1')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (e) {
      // Fallback if CoordinatorIndex doesn't exist yet
      return HtmlService.createTemplateFromFile('Index')
          .evaluate()
          .setTitle('Dashboard - Coordinator (Fallback)')
          .addMetaTag('viewport', 'width=device-width, initial-scale=1')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }
  
  if (page.toLowerCase() === 'login') {
    return HtmlService.createTemplateFromFile('Login')
        .evaluate()
        .setTitle('Login - BVC System')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  // Default fallback to Login
  return HtmlService.createTemplateFromFile('Login')
      .evaluate()
      .setTitle('Login - BVC System')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Returns the raw HTML content for Vanilla SPA navigation
 * to avoid Chrome sandbox top-navigation blocks.
 */
function getPageContent(page) {
  var p = (page || 'login').toLowerCase();
  try {
    if (p === 'forgotpassword') return HtmlService.createTemplateFromFile('ForgotPassword').evaluate().getContent();
    if (p === 'dashboard') return HtmlService.createTemplateFromFile('Index').evaluate().getContent();
    if (p === 'coordinator') {
      try {
        return HtmlService.createTemplateFromFile('Coordinator').evaluate().getContent();
      } catch (e) {
        return HtmlService.createTemplateFromFile('Index').evaluate().getContent();
      }
    }
    return HtmlService.createTemplateFromFile('Login').evaluate().getContent();
  } catch (e) {
    return "Error loading page: " + e.message;
  }
}

/**
 * Returns the raw HTML content of an inner component (Dashboard, Users, Events, etc.)
 * to be injected into the App Shell's pageContainer.
 */
function getComponentHtml(component) {
  try {
    if (!component) return '';
    var name = component.charAt(0).toUpperCase() + component.slice(1);
    return HtmlService.createTemplateFromFile(name).evaluate().getContent();
  } catch (e) {
    // Return empty state or error if component not found
    return `<div class="alert alert-danger m-4"><i class="bi bi-exclamation-triangle-fill me-2"></i> Failed to load component: ${component}</div>`;
  }
}

function getScriptUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch(e) {
    return "";
  }
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

function getAllEvents(sessionToken) {
  try {
    // Pass sessionToken so Controller can validate session via SessionService.withSession
    const res = Controller.Event.getAllEvents(sessionToken);
    // Force serialization to strip any Google Apps Script internal types (like Dates) that might break google.script.run
    const serialized = JSON.parse(JSON.stringify(res || []));
    Logger.log("Global getAllEvents() returning array of length: " + serialized.length);
    return serialized;
  } catch (e) {
    Logger.log("Error in global getAllEvents: " + e.message);
    return [];
  }
}

// Global wrapper: getActiveDepartments (was missing — caused "Method not found" in Students and Participants pages)
function getActiveDepartments(sessionToken) {
  try {
    const res = Controller.Department.getActiveDepartments(sessionToken);
    return JSON.parse(JSON.stringify(res || []));
  } catch (e) {
    Logger.log('Error in global getActiveDepartments: ' + e.message);
    return [];
  }
}

// Global wrapper: getAllEnrichedParticipants
function getAllEnrichedParticipants(sessionToken) {
  try {
    const res = Controller.Participant.getAllEnrichedParticipants(sessionToken);
    // ParticipantService returns buildResponse(true, msg, array)
    // buildResponse spreads array into object keys {0:{}, 1:{}, success:true} — extract array safely
    if (Array.isArray(res)) return JSON.parse(JSON.stringify(res));
    if (res && res.success === false) return [];
    // Convert object with numeric keys back to array
    const arr = [];
    for (var k in res) {
      if (!isNaN(parseInt(k, 10)) && res.hasOwnProperty(k)) arr.push(res[k]);
    }
    return JSON.parse(JSON.stringify(arr.length > 0 ? arr : (res.data || [])));
  } catch (e) {
    Logger.log('Error in global getAllEnrichedParticipants: ' + e.message);
    return [];
  }
}

function getAllUsers(sessionToken) {
  Logger.log("BACKEND STEP 1: Entering global getAllUsers with sessionToken: " + sessionToken);
  try {
    const res = Controller.User.getAllUsers(sessionToken);
    Logger.log("BACKEND STEP 2: Code.js received from Controller: " + typeof res + " / Array? " + Array.isArray(res) + " / Length: " + (res ? res.length : 0));
    // Force serialization to strip any Google Apps Script internal types (like Dates)
    const serialized = JSON.parse(JSON.stringify(res || []));
    Logger.log("BACKEND STEP 3: Code.js returning serialized: " + typeof serialized + " / Array? " + Array.isArray(serialized) + " / Length: " + serialized.length);
    return serialized;
  } catch (e) {
    Logger.log("BACKEND STEP 4: Error in global getAllUsers: " + e.message + "\nStack: " + e.stack);
    return [];
  }
}



function createUser(sessionToken, userData) {
  try {
    const result = Controller.User.createUser(sessionToken, userData);
    return JSON.parse(JSON.stringify(result || {}));
  } catch (e) {
    Logger.log("BACKEND EXCEPTION in Code.js createUser: " + e.message + "\n" + e.stack);
    return { success: false, message: "Backend crash: " + e.message };
  }
}

function importUsers(sessionToken, usersDataArray) {
  try {
    const result = Controller.User.importUsers(sessionToken, usersDataArray);
    return JSON.parse(JSON.stringify(result || {}));
  } catch (e) {
    Logger.log("BACKEND EXCEPTION in Code.js importUsers: " + e.message);
    return { success: false, message: "Backend crash: " + e.message };
  }
}

function updateUser(sessionToken, userId, userData) {
  try {
    const result = Controller.User.updateUser(sessionToken, userId, userData);
    return JSON.parse(JSON.stringify(result || {}));
  } catch (e) {
    Logger.log("BACKEND EXCEPTION in Code.js updateUser: " + e.message);
    return { success: false, message: "Backend crash: " + e.message };
  }
}

function deleteUser(sessionToken, userId) {
  try {
    const result = Controller.User.deleteUser(sessionToken, userId);
    return JSON.parse(JSON.stringify(result || {}));
  } catch (e) {
    Logger.log("BACKEND EXCEPTION in Code.js deleteUser: " + e.message);
    return { success: false, message: "Backend crash: " + e.message };
  }
}

function resetPassword(sessionToken, userId) {
  try {
    const result = Controller.User.resetPassword(sessionToken, userId);
    return JSON.parse(JSON.stringify(result || {}));
  } catch (e) {
    Logger.log("BACKEND EXCEPTION in Code.js resetPassword: " + e.message);
    return { success: false, message: "Backend crash: " + e.message };
  }
}

function getAllStudents(sessionToken) {
  Logger.log("STUDENTS_MODULE | STEP 1 - Request received | Function: getAllStudents");
  try {
    const res = Controller.Student.getAllStudents(sessionToken);
    const serialized = JSON.parse(JSON.stringify(res || []));
    Logger.log("STUDENTS_MODULE | STEP 5 - Returning response | Success: true");
    return serialized;
  } catch(e) {
    Logger.log("STUDENTS_MODULE | STEP 5 - Returning response | Success: false | Error: " + e.message);
    return [];
  }
}

function getDashboardData(sessionToken) {
  try {
    // 1. ముందే ఇక్కడే సెషన్ చెక్ చేద్దాం
    var isValid = SessionService.validateSession(sessionToken);
    if (!isValid) {
      return { success: false, message: 'Session is invalid.' };
    }
    
    var userId = SessionService.getCurrentUser(sessionToken);
    if (!userId) {
      return { success: false, message: 'User not found for session.' };
    }

    // ఇప్పుడు మిగతా డేటాను తెచ్చుకుందాం
    const summaryResp = Controller.Report.getDashboardSummary(sessionToken);
    const summary = (summaryResp && summaryResp.report) ? summaryResp.report : {};
    Logger.log("===== DASHBOARD SUMMARY =====");
    Logger.log(JSON.stringify(summary));
    Logger.log("totalAttendance = " + summary.totalAttendance);
    Logger.log("totalAbsent = " + summary.totalAbsent);
    Logger.log("attendancePercentage = " + summary.attendancePercentage);
    
    const users = (DatabaseService.readAllRows(CONFIG.SHEETS.USERS) || [])
      .filter(u => u[CONFIG.COLUMNS.DELETION_FLAG] !== true && u[CONFIG.COLUMNS.DELETION_FLAG] !== "true");
      
    let totalCoordinators = 0;
    users.forEach(u => {
      const role = u['Role'] || u.role;
      if (role === 'COORDINATOR' || role === 'Coordinator') totalCoordinators++;
    });

    const studentsResp = Controller.Student.getAllStudents(sessionToken);
    const students = (studentsResp && studentsResp.students) ? studentsResp.students : [];
    const depts = new Set();
    students.forEach(s => {
      const d = s['Department ID'] || s.department;
      if (d) depts.add(d);
    });

    let activeEvents = [];
    let completedEventsCount = 0;
    try {
      const allEventsResp = Controller.Event.getAllEvents(sessionToken);
      const allEvents = Array.isArray(allEventsResp) ? allEventsResp : [];

      Logger.log("===== DASHBOARD EVENTS =====");
      Logger.log("Total Events Returned = " + allEvents.length);

      activeEvents = allEvents.filter(function(e) {
        const status = e["Event Status"] || e["Status"] || e.status;
        return status === "Active";
      });

      Logger.log("Active Events Count = " + activeEvents.length);

      completedEventsCount = allEvents.filter(function(e) {
        const status = e["Event Status"] || e["Status"] || e.status;
        return status === "Completed";
      }).length;

    } catch (e) {
      Logger.log("Error while loading events: " + e.message);
    }

    let activities = [];
    try {
      const logs = AuditService.getAuditLogs() || [];
      activities = AuditService.sortAuditLogs(logs, 'timestamp', 'desc').slice(0, 10);
    } catch(e) {}

    const responsePayload = {
      success: true,
      data: {
        stats: {
          totalUsers: users.length,
          totalCoordinators: totalCoordinators,
          totalStudents: students.length,
          totalEvents: summary.totalEvents || 0,
          activeEvents: activeEvents.length,
          completedEvents: completedEventsCount,
          todayAttendance: summary.totalAttendance || 0,
          todayAbsentees: summary.totalAbsent || 0,
          monthlyAttendancePercentage: summary.attendancePercentage || 0,
          totalDepartments: depts.size,
          pendingApprovals: 0
        },
        activeEvents: activeEvents.slice(0, 5),
        recentActivities: activities.slice(0, 5)
      }
    };
    
    return JSON.parse(JSON.stringify(responsePayload));
  } catch(e) {
    return { success: false, message: e.message, stack: e.stack };
  }
}

// ==========================================
// Dashboard Feature-Based Endpoints (STEP 1 & 5 Logging)
// ==========================================

function getTotalUsers(sessionToken) {
  Logger.log("DASHBOARD_MODULE | STEP 1 - Request received | Function: getTotalUsers");
  try {
    const res = Controller.Dashboard.getTotalUsers(sessionToken);
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: true | Value: " + res);
    return res;
  } catch(e) {
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: false | Error: " + e.message);
    return 0;
  }
}

function getTotalStudents(sessionToken) {
  Logger.log("DASHBOARD_MODULE | STEP 1 - Request received | Function: getTotalStudents");
  try {
    const res = Controller.Dashboard.getTotalStudents(sessionToken);
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: true | Value: " + res);
    return res;
  } catch(e) {
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: false | Error: " + e.message);
    return 0;
  }
}

function getTotalEvents(sessionToken) {
  Logger.log("DASHBOARD_MODULE | STEP 1 - Request received | Function: getTotalEvents");
  try {
    const res = Controller.Dashboard.getTotalEvents(sessionToken);
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: true | Value: " + res);
    return res;
  } catch(e) {
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: false | Error: " + e.message);
    return 0;
  }
}

function getActiveEvents(sessionToken) {
  Logger.log("DASHBOARD_MODULE | STEP 1 - Request received | Function: getActiveEvents");
  try {
    const res = Controller.Dashboard.getActiveEvents(sessionToken);
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: true | Value: " + res);
    return res;
  } catch(e) {
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: false | Error: " + e.message);
    return 0;
  }
}

function getUpcomingEvents(sessionToken) {
  Logger.log("DASHBOARD_MODULE | STEP 1 - Request received | Function: getUpcomingEvents");
  try {
    const res = Controller.Dashboard.getUpcomingEvents(sessionToken);
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: true | Value: " + res);
    return res;
  } catch(e) {
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: false | Error: " + e.message);
    return 0;
  }
}

function getTotalParticipants(sessionToken) {
  Logger.log("DASHBOARD_MODULE | STEP 1 - Request received | Function: getTotalParticipants");
  try {
    const res = Controller.Dashboard.getTotalParticipants(sessionToken);
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: true | Value: " + res);
    return res;
  } catch(e) {
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: false | Error: " + e.message);
    return 0;
  }
}

function getAttendanceToday(sessionToken) {
  Logger.log("DASHBOARD_MODULE | STEP 1 - Request received | Function: getAttendanceToday");
  try {
    const res = Controller.Dashboard.getAttendanceToday(sessionToken);
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: true | Value: " + res);
    return res;
  } catch(e) {
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: false | Error: " + e.message);
    return 0;
  }
}

function getRecentEvents(sessionToken) {
  Logger.log("DASHBOARD_MODULE | STEP 1 - Request received | Function: getRecentEvents");
  try {
    const res = Controller.Dashboard.getRecentEvents(sessionToken);
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: true");
    return JSON.parse(JSON.stringify(res || []));
  } catch(e) {
    Logger.log("DASHBOARD_MODULE | STEP 5 - Returning response | Success: false | Error: " + e.message);
    return [];
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

// ==========================================
// Report API Global Wrappers
// ==========================================

function _serializeReport(res) {
  try { return JSON.parse(JSON.stringify(res || {})); } catch(e) { return { success: false, message: e.message }; }
}

function getReportsDashboardSummary(sessionToken) {
  try { return _serializeReport(Controller.Report.getReportsDashboardSummary(sessionToken)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getEventReport(sessionToken, filters) {
  try { return _serializeReport(Controller.Report.getEventReport(sessionToken, filters)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getStudentReport(sessionToken, rollNumber) {
  try { return _serializeReport(Controller.Report.getStudentReport(sessionToken, rollNumber)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getStudentEventHistory(sessionToken, rollNumber) {
  try { return _serializeReport(Controller.Report.getStudentEventHistory(sessionToken, rollNumber)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getDepartmentReport(sessionToken, department) {
  try { return _serializeReport(Controller.Report.getDepartmentReport(sessionToken, department)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getDepartmentComparison(sessionToken) {
  try { return _serializeReport(Controller.Report.getDepartmentComparison(sessionToken)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getCoordinatorReport(sessionToken, coordinatorId) {
  try { return _serializeReport(Controller.Report.getCoordinatorReport(sessionToken, coordinatorId)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getCoordinatorPerformance(sessionToken, coordinatorId) {
  try { return _serializeReport(Controller.Report.getCoordinatorPerformance(sessionToken, coordinatorId)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getDateRangeReport(sessionToken, fromDate, toDate) {
  try { return _serializeReport(Controller.Report.getDateRangeReport(sessionToken, fromDate, toDate)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getMonthlyReport(sessionToken, filters) {
  try { return _serializeReport(Controller.Report.getMonthlyReport(sessionToken, filters)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getEventTrendReport(sessionToken, filters) {
  try { return _serializeReport(Controller.Report.getEventTrendReport(sessionToken, filters)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getYearWiseReport(sessionToken, year) {
  try { return _serializeReport(Controller.Report.getYearWiseReport(sessionToken, year)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getAttendanceDefaulters(sessionToken, filters) {
  try { return _serializeReport(Controller.Report.getAttendanceDefaulters(sessionToken, filters)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getTopParticipants(sessionToken, filters) {
  try { return _serializeReport(Controller.Report.getTopParticipants(sessionToken, filters)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getAbsentStudents(sessionToken, filters) {
  try { return _serializeReport(Controller.Report.getAbsentStudents(sessionToken, filters)); }
  catch(e) { return { success: false, message: e.message }; }
}

function getCancelledEvents(sessionToken, filters) {
  try { return _serializeReport(Controller.Report.getCancelledEvents(sessionToken, filters)); }
  catch(e) { return { success: false, message: e.message }; }
}

