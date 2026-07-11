/**
 * Api.js
 * 
 * Top-level Google Apps Script global function wrappers.
 * google.script.run can only invoke top-level functions.
 * This file exposes the Controller methods to the frontend.
 * Contains no business logic, acts as a thin routing layer.
 */

// ==========================================
// Authentication API Entry Points
// ==========================================

function login(credentials) {
  try { return JSON.parse(JSON.stringify(Controller.Auth.login(credentials) || {})); } catch (e) { return { success: false, message: e.message }; }
}

function logout(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Auth.logout(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}

function authenticate(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Auth.authenticate(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}

// ==========================================
// Forgot Password & OTP Recovery API Endpoints (Fixed)
// ==========================================

function forgotPassword(employeeId) {
  try {
    if (!employeeId || typeof employeeId !== 'string') {
      return { success: false, message: "Invalid Employee ID format provided." };
    }

    var cleanEmpId = employeeId.trim();

    // 1. Fetch user by Employee ID
    var user = DatabaseService.findOne(CONFIG.SHEETS.USERS, CONFIG.COLUMNS.USER_EMPLOYEE_ID, cleanEmpId);
    if (!user) {
      return { success: false, message: "No registered staff found with Employee ID: " + cleanEmpId };
    }

    // 2. Extract true Primary User ID string key (e.g., USR-0001)
    var userId = String(user[CONFIG.COLUMNS.USER_ID]).trim();

    // 3. CRITICAL ALIAS PATH PROTECTION PATCH:
    // If your Google Sheet uses "Email Address" but AuthService looks up "Email",
    // dynamically safeguard the reference structure right here before processing.
    var trueEmailAttr = CONFIG.COLUMNS.USER_EMAIL || "Email Address";
    if (user[trueEmailAttr] && (!user["Email"] || user["Email"] === "")) {
      var emailSyncPatch = {};
      emailSyncPatch["Email"] = String(user[trueEmailAttr]).trim();
      DatabaseService.updateRow(CONFIG.SHEETS.USERS, CONFIG.ID_COLUMNS.USERS, userId, emailSyncPatch);
    }

    // 4. Pass User ID to AuthService safely
    return JSON.parse(JSON.stringify(AuthService.generateOTP(userId) || {}));
  } catch (e) {
    return { success: false, message: "API Routing Error: " + e.message };
  }
}

function verifyOTP(employeeId, otp) {
  try {
    var cleanEmpId = String(employeeId || "").trim();
    var user = DatabaseService.findOne(CONFIG.SHEETS.USERS, CONFIG.COLUMNS.USER_EMPLOYEE_ID, cleanEmpId);
    if (!user) {
      return { success: false, message: "User not found." };
    }

    var userId = String(user[CONFIG.COLUMNS.USER_ID]).trim();
    return JSON.parse(JSON.stringify(AuthService.verifyOTP(userId, otp) || {}));
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function recoverPassword(employeeId, otp, newPassword) {
  try {
    var cleanEmpId = String(employeeId || "").trim();
    var user = DatabaseService.findOne(CONFIG.SHEETS.USERS, CONFIG.COLUMNS.USER_EMPLOYEE_ID, cleanEmpId);
    if (!user) {
      return { success: false, message: "User not found." };
    }

    var userId = String(user[CONFIG.COLUMNS.USER_ID]).trim();
    return JSON.parse(JSON.stringify(AuthService.resetPassword(userId, otp, newPassword) || {}));
  } catch (e) {
    return { success: false, message: e.message };
  }
}
function getScriptUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (e) {
    return "";
  }
}

// ==========================================
// Session API
// ==========================================
function validateSession(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Session.validateSession(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getCurrentUser(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Session.getCurrentUser(sessionToken) || {})); } catch (e) { return {}; }
}
function hasRole(sessionToken, role) {
  try { return JSON.parse(JSON.stringify(Controller.Session.hasRole(sessionToken, role) || false)); } catch (e) { return false; }
}

// ==========================================
// User API
// ==========================================
function createUser(userData) {
  try { return JSON.parse(JSON.stringify(Controller.User.createUser(userData) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getUserById(userId) {
  try { return JSON.parse(JSON.stringify(Controller.User.getUserById(userId) || {})); } catch (e) { return {}; }
}
function getUserByUsername(username) {
  try { return JSON.parse(JSON.stringify(Controller.User.getUserByUsername(username) || {})); } catch (e) { return {}; }
}
// function getAllUsers() moved to Code.js
function updateUser(userId, userData) {
  try { return JSON.parse(JSON.stringify(Controller.User.updateUser(userId, userData) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function deleteUser(userId) {
  try { return JSON.parse(JSON.stringify(Controller.User.deleteUser(userId) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function resetPassword(userId) {
  try { return JSON.parse(JSON.stringify(Controller.User.resetPassword(userId) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function deactivateUser(userId) {
  try { return JSON.parse(JSON.stringify(Controller.User.deactivateUser(userId) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function activateUser(userId) {
  try { return JSON.parse(JSON.stringify(Controller.User.activateUser(userId) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function searchUsers(keyword) {
  try { return JSON.parse(JSON.stringify(Controller.User.searchUsers(keyword) || [])); } catch (e) { return []; }
}
function changePassword(userId, oldPassword, newPassword) {
  try { return JSON.parse(JSON.stringify(Controller.User.changePassword(userId, oldPassword, newPassword) || {})); } catch (e) { return { success: false, message: e.message }; }
}

// ==========================================
// Student API
// ==========================================
function createStudent(sessionToken, studentData) {
  try { return JSON.parse(JSON.stringify(Controller.Student.createStudent(sessionToken, studentData) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function updateStudent(sessionToken, rollNumber, studentData) {
  try { return JSON.parse(JSON.stringify(Controller.Student.updateStudent(sessionToken, rollNumber, studentData) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function deleteStudent(sessionToken, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Student.deleteStudent(sessionToken, rollNumber) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getStudentByRollNumber(sessionToken, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Student.getStudentByRollNumber(sessionToken, rollNumber) || {})); } catch (e) { return {}; }
}
// function getAllStudents() moved to Code.js
function searchStudents(sessionToken, keyword) {
  try { return JSON.parse(JSON.stringify(Controller.Student.searchStudents(sessionToken, keyword) || [])); } catch (e) { return []; }
}
function getStudentsByDepartment(sessionToken, department) {
  try { return JSON.parse(JSON.stringify(Controller.Student.getStudentsByDepartment(sessionToken, department) || [])); } catch (e) { return []; }
}
function getStudentsByYear(sessionToken, year) {
  try { return JSON.parse(JSON.stringify(Controller.Student.getStudentsByYear(sessionToken, year) || [])); } catch (e) { return []; }
}
function getStudentsBySection(sessionToken, section) {
  try { return JSON.parse(JSON.stringify(Controller.Student.getStudentsBySection(sessionToken, section) || [])); } catch (e) { return []; }
}
function getActiveDepartments(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Department.getActiveDepartments(sessionToken) || [])); } catch (e) { return []; }
}
function getStudentEventHistory(sessionToken, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getStudentEventHistory(sessionToken, rollNumber) || {})); } catch (e) { return {}; }
}

// ==========================================
// Event API
// ==========================================
function createEvent(eventData) {
  try { return JSON.parse(JSON.stringify(Controller.Event.createEvent(eventData) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function updateEvent(eventId, eventData) {
  try { return JSON.parse(JSON.stringify(Controller.Event.updateEvent(eventId, eventData) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function deleteEvent(eventId) {
  try { return JSON.parse(JSON.stringify(Controller.Event.deleteEvent(eventId) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getEventById(eventId) {
  try { return JSON.parse(JSON.stringify(Controller.Event.getEventById(eventId) || {})); } catch (e) { return {}; }
}
// function getAllEvents() moved to Code.js
function searchEvents(keyword) {
  try { return JSON.parse(JSON.stringify(Controller.Event.searchEvents(keyword) || [])); } catch (e) { return []; }
}
function getEventsByCoordinator(coordinatorId) {
  try { return JSON.parse(JSON.stringify(Controller.Event.getEventsByCoordinator(coordinatorId) || [])); } catch (e) { return []; }
}
function getEventsByStatus(status) {
  try { return JSON.parse(JSON.stringify(Controller.Event.getEventsByStatus(status) || [])); } catch (e) { return []; }
}
function getEventsByDate(date) {
  try { return JSON.parse(JSON.stringify(Controller.Event.getEventsByDate(date) || [])); } catch (e) { return []; }
}


// ==========================================
// Attendance API
// ==========================================
function markAttendance(attendanceData) {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.markAttendance(attendanceData) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function deleteAttendance(attendanceId) {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.deleteAttendance(attendanceId) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getAttendanceById(attendanceId) {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getAttendanceById(attendanceId) || {})); } catch (e) { return {}; }
}
// function getAttendanceByEvent(eventId) moved to Code.js
function getAttendanceByStudent(rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getAttendanceByStudent(rollNumber) || [])); } catch (e) { return []; }
}
function getAttendanceByDate(date) {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getAttendanceByDate(date) || [])); } catch (e) { return []; }
}
function getAttendanceByStatus(status) {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getAttendanceByStatus(status) || [])); } catch (e) { return []; }
}
function checkAttendanceExists(eventId, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.checkAttendanceExists(eventId, rollNumber) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getEventAttendanceCount(eventId) {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getEventAttendanceCount(eventId) || {})); } catch (e) { return {}; }
}
function getStudentAttendanceCount(sessionToken, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getStudentAttendanceCount(sessionToken, rollNumber) || {})); } catch (e) { return {}; }
}
function getStudentAttendanceSummary(sessionToken, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getStudentAttendanceSummary(sessionToken, rollNumber) || {})); } catch (e) { return {}; }
}
function getOverallAttendanceStatistics() {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getOverallAttendanceStatistics() || {})); } catch (e) { return {}; }
}
function getAttendanceSummaryByEvent(eventId) {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getAttendanceSummaryByEvent(eventId) || {})); } catch (e) { return {}; }
}

// ==========================================
// Report API
// ==========================================
function getReportsDashboardSummary(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getReportsDashboardSummary(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getEventReport(sessionToken, filters) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getEventReport(sessionToken, filters) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getStudentReport(sessionToken, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getStudentReport(sessionToken, rollNumber) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getDepartmentReport(sessionToken, department) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getDepartmentReport(sessionToken, department) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getDepartmentComparison(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getDepartmentComparison(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getCoordinatorReport(sessionToken, coordinatorId) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getCoordinatorReport(sessionToken, coordinatorId) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getCoordinatorPerformance(sessionToken, coordinatorId) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getCoordinatorPerformance(sessionToken, coordinatorId) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getDateRangeReport(sessionToken, fromDate, toDate) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getDateRangeReport(sessionToken, fromDate, toDate) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getMonthlyReport(sessionToken, filters) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getMonthlyReport(sessionToken, filters) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getEventTrendReport(sessionToken, filters) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getEventTrendReport(sessionToken, filters) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getYearWiseReport(sessionToken, year) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getYearWiseReport(sessionToken, year) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getAttendanceDefaulters(sessionToken, filters) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getAttendanceDefaulters(sessionToken, filters) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getTopParticipants(sessionToken, filters) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getTopParticipants(sessionToken, filters) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getAbsentStudents(sessionToken, filters) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getAbsentStudents(sessionToken, filters) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getCancelledEvents(sessionToken, filters) {
  try { return JSON.parse(JSON.stringify(Controller.Report.getCancelledEvents(sessionToken, filters) || {})); } catch (e) { return { success: false, message: e.message }; }
}

// ==========================================
// Participant API
// ==========================================
function getAllEnrichedParticipants(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Participant.getAllEnrichedParticipants(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getEventParticipants(sessionToken, eventId) {
  try { return JSON.parse(JSON.stringify(Controller.Participant.getEventParticipants(sessionToken, eventId) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function addParticipant(sessionToken, eventId, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Participant.addParticipant(sessionToken, eventId, rollNumber) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function removeParticipant(sessionToken, eventId, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Participant.removeParticipant(sessionToken, eventId, rollNumber) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function restoreParticipant(sessionToken, eventId, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Participant.restoreParticipant(sessionToken, eventId, rollNumber) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function checkEligibility(sessionToken, eventId, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Participant.checkEligibility(sessionToken, eventId, rollNumber) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function bulkAddParticipants(sessionToken, eventId, rollNumbers) {
  try { return JSON.parse(JSON.stringify(Controller.Participant.bulkAddParticipants(sessionToken, eventId, rollNumbers) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function bulkRemoveParticipants(sessionToken, eventId, rollNumbers) {
  try { return JSON.parse(JSON.stringify(Controller.Participant.bulkRemoveParticipants(sessionToken, eventId, rollNumbers) || {})); } catch (e) { return { success: false, message: e.message }; }
}

// ==========================================
// Analytics API
// ==========================================
function getAnalyticsSummary(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getAnalyticsSummary(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getTrendData(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getTrendData(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getDepartmentData(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getDepartmentData(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getEventWiseData(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getEventWiseData(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getCheckInPatterns(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getCheckInPatterns(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getPerformanceDistribution(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getPerformanceDistribution(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getDefaulterDistribution(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getDefaulterDistribution(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getLeaderboard(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getLeaderboard(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}

// ==========================================
// Settings API
// ==========================================
function getSettings(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Settings.getSettings(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function saveSettings(sessionToken, payload) {
  try { return JSON.parse(JSON.stringify(Controller.Settings.saveSettings(sessionToken, payload) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function clearAttendanceLogs(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Settings.clearAttendanceLogs(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function resetSystem(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Settings.resetSystem(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
function getAuditLogs(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Audit.getAuditLogs(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}
