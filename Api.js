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
  try { return JSON.parse(JSON.stringify(Controller.Auth.login(credentials) || {})); } catch(e) { return {success:false, message:e.message}; }
}

function logout(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Auth.logout(sessionToken) || {})); } catch(e) { return {success:false, message:e.message}; }
}

function authenticate(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Auth.authenticate(sessionToken) || {})); } catch(e) { return {success:false, message:e.message}; }
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
  } catch(e) {
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
  } catch(e) {
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
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function getScriptUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch(e) {
    return "";
  }
}

// ==========================================
// Session API
// ==========================================
function validateSession(sessionToken) { 
  try { return JSON.parse(JSON.stringify(Controller.Session.validateSession(sessionToken) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function getCurrentUser(sessionToken) { 
  try { return JSON.parse(JSON.stringify(Controller.Session.getCurrentUser(sessionToken) || {})); } catch(e) { return {}; }
}
function hasRole(sessionToken, role) { 
  try { return JSON.parse(JSON.stringify(Controller.Session.hasRole(sessionToken, role) || false)); } catch(e) { return false; }
}

// ==========================================
// User API
// ==========================================
function createUser(userData) { 
  try { return JSON.parse(JSON.stringify(Controller.User.createUser(userData) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function getUserById(userId) { 
  try { return JSON.parse(JSON.stringify(Controller.User.getUserById(userId) || {})); } catch(e) { return {}; }
}
function getUserByUsername(username) { 
  try { return JSON.parse(JSON.stringify(Controller.User.getUserByUsername(username) || {})); } catch(e) { return {}; }
}
// function getAllUsers() moved to Code.js
function updateUser(userId, userData) { 
  try { return JSON.parse(JSON.stringify(Controller.User.updateUser(userId, userData) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function deleteUser(userId) { 
  try { return JSON.parse(JSON.stringify(Controller.User.deleteUser(userId) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function resetPassword(userId) {
  try { return JSON.parse(JSON.stringify(Controller.User.resetPassword(userId) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function deactivateUser(userId) { 
  try { return JSON.parse(JSON.stringify(Controller.User.deactivateUser(userId) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function activateUser(userId) { 
  try { return JSON.parse(JSON.stringify(Controller.User.activateUser(userId) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function searchUsers(keyword) { 
  try { return JSON.parse(JSON.stringify(Controller.User.searchUsers(keyword) || [])); } catch(e) { return []; }
}
function changePassword(userId, oldPassword, newPassword) { 
  try { return JSON.parse(JSON.stringify(Controller.User.changePassword(userId, oldPassword, newPassword) || {})); } catch(e) { return {success:false, message:e.message}; }
}

// ==========================================
// Student API
// ==========================================
function createStudent(studentData) { 
  try { return JSON.parse(JSON.stringify(Controller.Student.createStudent(studentData) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function updateStudent(rollNumber, studentData) { 
  try { return JSON.parse(JSON.stringify(Controller.Student.updateStudent(rollNumber, studentData) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function deleteStudent(rollNumber) { 
  try { return JSON.parse(JSON.stringify(Controller.Student.deleteStudent(rollNumber) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function getStudentByRollNumber(rollNumber) { 
  try { return JSON.parse(JSON.stringify(Controller.Student.getStudentByRollNumber(rollNumber) || {})); } catch(e) { return {}; }
}
// function getAllStudents() moved to Code.js
function searchStudents(keyword) { 
  try { return JSON.parse(JSON.stringify(Controller.Student.searchStudents(keyword) || [])); } catch(e) { return []; }
}
function getStudentsByDepartment(department) { 
  try { return JSON.parse(JSON.stringify(Controller.Student.getStudentsByDepartment(department) || [])); } catch(e) { return []; }
}
function getStudentsByYear(year) { 
  try { return JSON.parse(JSON.stringify(Controller.Student.getStudentsByYear(year) || [])); } catch(e) { return []; }
}
function getStudentsBySection(section) { 
  try { return JSON.parse(JSON.stringify(Controller.Student.getStudentsBySection(section) || [])); } catch(e) { return []; }
}

// ==========================================
// Event API
// ==========================================
function createEvent(eventData) { 
  try { return JSON.parse(JSON.stringify(Controller.Event.createEvent(eventData) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function updateEvent(eventId, eventData) { 
  try { return JSON.parse(JSON.stringify(Controller.Event.updateEvent(eventId, eventData) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function deleteEvent(eventId) { 
  try { return JSON.parse(JSON.stringify(Controller.Event.deleteEvent(eventId) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function getEventById(eventId) { 
  try { return JSON.parse(JSON.stringify(Controller.Event.getEventById(eventId) || {})); } catch(e) { return {}; }
}
// function getAllEvents() moved to Code.js
function searchEvents(keyword) { 
  try { return JSON.parse(JSON.stringify(Controller.Event.searchEvents(keyword) || [])); } catch(e) { return []; }
}
function getEventsByCoordinator(coordinatorId) { 
  try { return JSON.parse(JSON.stringify(Controller.Event.getEventsByCoordinator(coordinatorId) || [])); } catch(e) { return []; }
}
function getEventsByStatus(status) { 
  try { return JSON.parse(JSON.stringify(Controller.Event.getEventsByStatus(status) || [])); } catch(e) { return []; }
}
function getEventsByDate(date) { 
  try { return JSON.parse(JSON.stringify(Controller.Event.getEventsByDate(date) || [])); } catch(e) { return []; }
}


// ==========================================
// Attendance API
// ==========================================
function markAttendance(attendanceData) { 
  try { return JSON.parse(JSON.stringify(Controller.Attendance.markAttendance(attendanceData) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function deleteAttendance(attendanceId) { 
  try { return JSON.parse(JSON.stringify(Controller.Attendance.deleteAttendance(attendanceId) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function getAttendanceById(attendanceId) { 
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getAttendanceById(attendanceId) || {})); } catch(e) { return {}; }
}
// function getAttendanceByEvent(eventId) moved to Code.js
function getAttendanceByStudent(rollNumber) { 
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getAttendanceByStudent(rollNumber) || [])); } catch(e) { return []; }
}
function getAttendanceByDate(date) { 
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getAttendanceByDate(date) || [])); } catch(e) { return []; }
}
function getAttendanceByStatus(status) { 
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getAttendanceByStatus(status) || [])); } catch(e) { return []; }
}
function checkAttendanceExists(eventId, rollNumber) { 
  try { return JSON.parse(JSON.stringify(Controller.Attendance.checkAttendanceExists(eventId, rollNumber) || {})); } catch(e) { return {success:false, message:e.message}; }
}
function getEventAttendanceCount(eventId) { 
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getEventAttendanceCount(eventId) || {})); } catch(e) { return {}; }
}
function getStudentAttendanceCount(rollNumber) { 
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getStudentAttendanceCount(rollNumber) || {})); } catch(e) { return {}; }
}
function getStudentAttendanceSummary(rollNumber) { 
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getStudentAttendanceSummary(rollNumber) || {})); } catch(e) { return {}; }
}
function getOverallAttendanceStatistics() { 
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getOverallAttendanceStatistics() || {})); } catch(e) { return {}; }
}
function getAttendanceSummaryByEvent(eventId) { 
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getAttendanceSummaryByEvent(eventId) || {})); } catch(e) { return {}; }
}

// ==========================================
// Report API
// ==========================================
// function getDashboardSummary() moved to Code.js
function getEventReport(eventId) { 
  try { return JSON.parse(JSON.stringify(Controller.Report.getEventReport(eventId) || {})); } catch(e) { return {}; }
}
function getStudentReport(rollNumber) { 
  try { return JSON.parse(JSON.stringify(Controller.Report.getStudentReport(rollNumber) || {})); } catch(e) { return {}; }
}
function getDepartmentReport(department) { 
  try { return JSON.parse(JSON.stringify(Controller.Report.getDepartmentReport(department) || {})); } catch(e) { return {}; }
}
function getYearWiseReport(year) { 
  try { return JSON.parse(JSON.stringify(Controller.Report.getYearWiseReport(year) || {})); } catch(e) { return {}; }
}
function getSectionReport(section) { 
  try { return JSON.parse(JSON.stringify(Controller.Report.getSectionReport(section) || {})); } catch(e) { return {}; }
}
function getDateWiseReport(date) { 
  try { return JSON.parse(JSON.stringify(Controller.Report.getDateWiseReport(date) || {})); } catch(e) { return {}; }
}
function getOverallAttendanceReport() { 
  try { return JSON.parse(JSON.stringify(Controller.Report.getOverallAttendanceReport() || {})); } catch(e) { return {}; }
}
function getCoordinatorReport(coordinatorId) { 
  try { return JSON.parse(JSON.stringify(Controller.Report.getCoordinatorReport(coordinatorId) || {})); } catch(e) { return {}; }
}
