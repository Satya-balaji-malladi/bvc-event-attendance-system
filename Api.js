/**
 * Api.js
 * 
 * Top-level Google Apps Script global function wrappers.
 * google.script.run can only invoke top-level functions.
 * This file exposes the Controller methods to the frontend.
 * Contains no business logic, acts as a thin routing layer.
 */

// ==========================================
// Authentication API
// ==========================================
function login(credentials) { return Controller.Auth.login(credentials); }
function logout(sessionToken) { return Controller.Auth.logout(sessionToken); }
function authenticate(sessionToken) { return Controller.Auth.authenticate(sessionToken); }

// ==========================================
// Session API
// ==========================================
function validateSession(sessionToken) { return Controller.Session.validateSession(sessionToken); }
function getCurrentUser(sessionToken) { return Controller.Session.getCurrentUser(sessionToken); }
function hasRole(sessionToken, role) { return Controller.Session.hasRole(sessionToken, role); }

// ==========================================
// User API
// ==========================================
function createUser(userData) { return Controller.User.createUser(userData); }
function getUserById(userId) { 
  try { return JSON.parse(JSON.stringify(Controller.User.getUserById(userId) || {})); } catch(e) { return {}; }
}
function getUserByUsername(username) { return Controller.User.getUserByUsername(username); }
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
function deactivateUser(userId) { return Controller.User.deactivateUser(userId); }
function activateUser(userId) { return Controller.User.activateUser(userId); }
function searchUsers(keyword) { return Controller.User.searchUsers(keyword); }
function changePassword(userId, oldPassword, newPassword) { return Controller.User.changePassword(userId, oldPassword, newPassword); }

// ==========================================
// Student API
// ==========================================
function createStudent(studentData) { return Controller.Student.createStudent(studentData); }
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
function searchStudents(keyword) { return Controller.Student.searchStudents(keyword); }
function getStudentsByDepartment(department) { return Controller.Student.getStudentsByDepartment(department); }
function getStudentsByYear(year) { return Controller.Student.getStudentsByYear(year); }
function getStudentsBySection(section) { return Controller.Student.getStudentsBySection(section); }

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
function searchEvents(keyword) { return Controller.Event.searchEvents(keyword); }
function getEventsByCoordinator(coordinatorId) { return Controller.Event.getEventsByCoordinator(coordinatorId); }
function getEventsByStatus(status) { return Controller.Event.getEventsByStatus(status); }
function getEventsByDate(date) { return Controller.Event.getEventsByDate(date); }


// ==========================================
// Attendance API
// ==========================================
function markAttendance(attendanceData) { return Controller.Attendance.markAttendance(attendanceData); }
function deleteAttendance(attendanceId) { return Controller.Attendance.deleteAttendance(attendanceId); }
function getAttendanceById(attendanceId) { return Controller.Attendance.getAttendanceById(attendanceId); }
// function getAttendanceByEvent(eventId) moved to Code.js
function getAttendanceByStudent(rollNumber) { return Controller.Attendance.getAttendanceByStudent(rollNumber); }
function getAttendanceByDate(date) { return Controller.Attendance.getAttendanceByDate(date); }
function getAttendanceByStatus(status) { return Controller.Attendance.getAttendanceByStatus(status); }
function checkAttendanceExists(eventId, rollNumber) { return Controller.Attendance.checkAttendanceExists(eventId, rollNumber); }
function getEventAttendanceCount(eventId) { return Controller.Attendance.getEventAttendanceCount(eventId); }
function getStudentAttendanceCount(rollNumber) { return Controller.Attendance.getStudentAttendanceCount(rollNumber); }
function getStudentAttendanceSummary(rollNumber) { return Controller.Attendance.getStudentAttendanceSummary(rollNumber); }
function getOverallAttendanceStatistics() { return Controller.Attendance.getOverallAttendanceStatistics(); }
function getAttendanceSummaryByEvent(eventId) { return Controller.Attendance.getAttendanceSummaryByEvent(eventId); }

// ==========================================
// Report API
// ==========================================
// function getDashboardSummary() moved to Code.js
function getEventReport(eventId) { return Controller.Report.getEventReport(eventId); }
function getStudentReport(rollNumber) { return Controller.Report.getStudentReport(rollNumber); }
function getDepartmentReport(department) { return Controller.Report.getDepartmentReport(department); }
function getYearWiseReport(year) { return Controller.Report.getYearWiseReport(year); }
function getSectionReport(section) { return Controller.Report.getSectionReport(section); }
function getDateWiseReport(date) { return Controller.Report.getDateWiseReport(date); }
function getOverallAttendanceReport() { return Controller.Report.getOverallAttendanceReport(); }
function getCoordinatorReport(coordinatorId) { return Controller.Report.getCoordinatorReport(coordinatorId); }
