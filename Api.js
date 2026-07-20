/**
 * Api.js
 * * Top-level Google Apps Script global function wrappers.
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
function changePassword(userId, oldPassword, newPassword) {
  try { return JSON.parse(JSON.stringify(Controller.User.changePassword(userId, oldPassword, newPassword) || {})); } catch (e) { return { success: false, message: e.message }; }
}

// ==========================================
// Student API
// ==========================================
function getStudentByRollNumber(sessionToken, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Student.getStudentByRollNumber(sessionToken, rollNumber) || {})); } catch (e) { return {}; }
}

function getStudentAttendanceCount(sessionToken, rollNumber) {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.getStudentAttendanceCount(sessionToken, rollNumber) || 0)); } catch (e) { return 0; }
}

// ==========================================
// Event API
// ==========================================
function getEventById(eventId) {
  try { return JSON.parse(JSON.stringify(Controller.Event.getEventById(eventId) || {})); } catch (e) { return {}; }
}

// ==========================================
// Attendance API
// ==========================================
function markAttendance(attendanceData) {
  try { return JSON.parse(JSON.stringify(Controller.Attendance.markAttendance(attendanceData) || {})); } catch (e) { return { success: false, message: e.message }; }
}

// ==========================================
// Participant API
// ==========================================
function getAllEnrichedParticipants(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Participant.getAllEnrichedParticipants(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}

// ==========================================
// COORDINATOR TERMINAL API ENDPOINTS
// ==========================================

function _deepInspectAndLogResponse(methodName, response) {
  Logger.log("=== [INSPECT] " + methodName + " ===");
  Logger.log("Is Null/Undefined: " + (response === null || response === undefined));
  Logger.log("Type of response: " + typeof response);
  if (response) {
    Logger.log("Keys of response: " + JSON.stringify(Object.keys(response)));
    Logger.log("response.success: " + response.success);
    
    var foundUnserializable = [];
    var seen = [];
    
    function check(val, path) {
      if (val === null || val === undefined) return;
      if (typeof val === 'object') {
        if (seen.indexOf(val) !== -1) {
          foundUnserializable.push(path + " (Circular Reference)");
          return;
        }
        seen.push(val);
        
        if (val instanceof Date) {
          foundUnserializable.push(path + " (Date Object: " + val.toString() + ")");
        } else if (typeof val.getRange === 'function' || typeof val.getLastRow === 'function') {
          foundUnserializable.push(path + " (Spreadsheet/Sheet/Range Object)");
        } else if (typeof val.toString === 'function' && val.toString().indexOf('Blob') !== -1) {
          foundUnserializable.push(path + " (Blob Object)");
        } else {
          for (var k in val) {
            if (Object.prototype.hasOwnProperty.call(val, k)) {
              check(val[k], path + "." + k);
            }
          }
        }
      }
    }
    
    check(response, "response");
    if (foundUnserializable.length > 0) {
      Logger.log("❌ Found non-serializable objects: " + JSON.stringify(foundUnserializable));
    } else {
      Logger.log("✅ No non-serializable objects found.");
    }
  }
  Logger.log("=================================");
}

function getCoordinatorTerminalData(sessionToken) {
  var startTime = Date.now();
  Logger.log("=== ENTER getCoordinatorTerminalData() ===");
  Logger.log("Received token: " + sessionToken);

  try {
    Logger.log("[CONTROLLER CALL] Invoking Controller.CoordinatorTerminal.getContext");
    var response = Controller.CoordinatorTerminal.getContext(sessionToken);
    
    var executionTime = Date.now() - startTime;
    Logger.log("Controller response: " + (response ? JSON.stringify(response) : "null/undefined"));
    Logger.log("Execution time: " + executionTime + "ms");
    Logger.log("Complete response object: " + (response ? JSON.stringify(response) : "null/undefined"));
    Logger.log("=== EXIT getCoordinatorTerminalData() (SUCCESS) ===");
    return JSON.parse(JSON.stringify(response || {}));
  } catch (error) {
    Logger.log("[ERROR] Api.getCoordinatorTerminalData: " + error.message);
    var errResp = Utils.buildResponse(false, "Failed to load coordinator terminal context data: " + error.message);
    var executionTimeErr = Date.now() - startTime;
    Logger.log("Controller response (Error case): " + JSON.stringify(errResp));
    Logger.log("Execution time: " + executionTimeErr + "ms");
    Logger.log("Complete response object (Error case): " + JSON.stringify(errResp));
    Logger.log("=== EXIT getCoordinatorTerminalData() (ERROR) ===");
    return errResp;
  }
}

function markCoordinatorAttendance(sessionToken, rollNumber, attendanceMethod) {
  var startTime = Date.now();
  Logger.log("[START] Api.markCoordinatorAttendance");
  Logger.log("[INPUT] Roll Number: " + rollNumber + " | Method: " + attendanceMethod);

  try {
    Logger.log("[CONTROLLER CALL] Invoking Controller.CoordinatorTerminal.markAttendance");
    var response = Controller.CoordinatorTerminal.markAttendance(sessionToken, rollNumber, attendanceMethod);
    
    Logger.log("[OUTPUT] Attendance Marked. Success Status: " + response.success);
    Logger.log("[END] Api.markCoordinatorAttendance | Execution Time: " + (Date.now() - startTime) + "ms");
    _deepInspectAndLogResponse("markCoordinatorAttendance", response);
    return response;
  } catch (error) {
    Logger.log("[ERROR] Api.markCoordinatorAttendance: " + error.message);
    var errResp = Utils.buildResponse(false, "Failed to process terminal attendance entry: " + error.message);
    _deepInspectAndLogResponse("markCoordinatorAttendance (Error)", errResp);
    return errResp;
  }
}

function getCoordinatorStatistics(sessionToken) {
  var startTime = Date.now();
  Logger.log("[START] Api.getCoordinatorStatistics");
  Logger.log("[INPUT] Session Token: " + (sessionToken ? "Provided" : "Null"));

  try {
    Logger.log("[CONTROLLER CALL] Invoking Controller.CoordinatorTerminal.getLiveStatistics");
    var response = Controller.CoordinatorTerminal.getLiveStatistics(sessionToken);
    
    Logger.log("[OUTPUT] Live Statistics Gathered. Success Status: " + response.success);
    Logger.log("[END] Api.getCoordinatorStatistics | Execution Time: " + (Date.now() - startTime) + "ms");
    _deepInspectAndLogResponse("getCoordinatorStatistics", response);
    return response;
  } catch (error) {
    Logger.log("[ERROR] Api.getCoordinatorStatistics: " + error.message);
    var errResp = Utils.buildResponse(false, "Failed to compile live terminal statistics: " + error.message);
    _deepInspectAndLogResponse("getCoordinatorStatistics (Error)", errResp);
    return errResp;
  }
}

function getCoordinatorRecentScans(sessionToken) {
  var startTime = Date.now();
  Logger.log("[START] Api.getCoordinatorRecentScans");
  Logger.log("[INPUT] Session Token: " + (sessionToken ? "Provided" : "Null"));

  try {
    Logger.log("[CONTROLLER CALL] Invoking Controller.CoordinatorTerminal.getRecentScansStream");
    var response = Controller.CoordinatorTerminal.getRecentScansStream(sessionToken);
    
    Logger.log("[OUTPUT] Recent Scans Fetched. Success Status: " + response.success);
    Logger.log("[END] Api.getCoordinatorRecentScans | Execution Time: " + (Date.now() - startTime) + "ms");
    _deepInspectAndLogResponse("getCoordinatorRecentScans", response);
    return response;
  } catch (error) {
    Logger.log("[ERROR] Api.getCoordinatorRecentScans: " + error.message);
    var errResp = Utils.buildResponse(false, "Failed to retrieve recent terminal operations stream: " + error.message);
    _deepInspectAndLogResponse("getCoordinatorRecentScans (Error)", errResp);
    return errResp;
  }
}

function getCoordinatorStudent(sessionToken, rollNumber) {
  var startTime = Date.now();
  Logger.log("[START] Api.getCoordinatorStudent");
  Logger.log("[INPUT] Roll Number: " + rollNumber);

  try {
    Logger.log("[CONTROLLER CALL] Invoking Controller.CoordinatorTerminal.getStudentProfile");
    var response = Controller.CoordinatorTerminal.getStudentProfile(sessionToken, rollNumber);
    
    Logger.log("[OUTPUT] Student Query Handled. Success Status: " + response.success);
    Logger.log("[END] Api.getCoordinatorStudent | Execution Time: " + (Date.now() - startTime) + "ms");
    _deepInspectAndLogResponse("getCoordinatorStudent", response);
    return response;
  } catch (error) {
    Logger.log("[ERROR] Api.getCoordinatorStudent: " + error.message);
    var errResp = Utils.buildResponse(false, "Failed to query structural student identity bounds: " + error.message);
    _deepInspectAndLogResponse("getCoordinatorStudent (Error)", errResp);
    return errResp;
  }
}

function logoutCoordinator(sessionToken) {
  var startTime = Date.now();
  Logger.log("[START] Api.logoutCoordinator");
  Logger.log("[INPUT] Session Token: " + (sessionToken ? "Provided" : "Null"));

  try {
    Logger.log("[CONTROLLER CALL] Invoking Controller.CoordinatorTerminal.terminateSession");
    var response = Controller.CoordinatorTerminal.terminateSession(sessionToken);
    
    Logger.log("[OUTPUT] Session Termination Finalized. Success Status: " + response.success);
    Logger.log("[END] Api.logoutCoordinator | Execution Time: " + (Date.now() - startTime) + "ms");
    _deepInspectAndLogResponse("logoutCoordinator", response);
    return response;
  } catch (error) {
    Logger.log("[ERROR] Api.logoutCoordinator: " + error.message);
    var errResp = Utils.buildResponse(false, "Failed to gracefully clear active terminal session: " + error.message);
    _deepInspectAndLogResponse("logoutCoordinator (Error)", errResp);
    return errResp;
  }
}

function validateCoordinatorSession(sessionToken) {
  var startTime = Date.now();
  Logger.log("[START] Api.validateCoordinatorSession");
  Logger.log("[INPUT] Session Token: " + (sessionToken ? "Provided" : "Null"));

  try {
    Logger.log("[CONTROLLER CALL] Invoking Controller.CoordinatorTerminal.validateActiveSession");
    var response = Controller.CoordinatorTerminal.validateActiveSession(sessionToken);
    
    Logger.log("[OUTPUT] Security State Evaluated. Success Status: " + response.success);
    Logger.log("[END] Api.validateCoordinatorSession | Execution Time: " + (Date.now() - startTime) + "ms");
    _deepInspectAndLogResponse("validateCoordinatorSession", response);
    return response;
  } catch (error) {
    Logger.log("[ERROR] Api.validateCoordinatorSession: " + error.message);
    var errResp = Utils.buildResponse(false, "Session validation sequence encountered errors: " + error.message);
    _deepInspectAndLogResponse("validateCoordinatorSession (Error)", errResp);
    return errResp;
  }
}

function registerSpotStudentAndMark(sessionToken, rollNumber, name, department, year, section, college) {
  var startTime = Date.now();
  Logger.log("[START] Api.registerSpotStudentAndMark");
  Logger.log("[INPUT] Roll: " + rollNumber + " | Name: " + name + " | Dept: " + department + " | College: " + college);

  try {
    Logger.log("[CONTROLLER CALL] Invoking Controller.CoordinatorTerminal.registerSpotStudentAndMarkAttendance");
    var response = Controller.CoordinatorTerminal.registerSpotStudentAndMarkAttendance(sessionToken, rollNumber, name, department, year, section, college);
    
    Logger.log("[OUTPUT] Spot student registered & marked. Success Status: " + response.success);
    Logger.log("[END] Api.registerSpotStudentAndMark | Execution Time: " + (Date.now() - startTime) + "ms");
    _deepInspectAndLogResponse("registerSpotStudentAndMark", response);
    return response;
  } catch (error) {
    Logger.log("[ERROR] Api.registerSpotStudentAndMark: " + error.message);
    var errResp = Utils.buildResponse(false, "Failed to register spot student and mark attendance: " + error.message);
    _deepInspectAndLogResponse("registerSpotStudentAndMark (Error)", errResp);
    return errResp;
  }
}

// ==========================================
// Analytics API
// ==========================================

function getAnalyticsSummary(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getAnalyticsSummary(sessionToken) || {})); } catch (e) { return { success: false, message: e.message }; }
}

function getTrendData(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getTrendData(sessionToken) || {})); } catch (e) { return {}; }
}

function getDepartmentData(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getDepartmentData(sessionToken) || {})); } catch (e) { return {}; }
}

function getEventWiseData(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getEventWiseData(sessionToken) || {})); } catch (e) { return {}; }
}

function getCheckInPatterns(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getCheckInPatterns(sessionToken) || {})); } catch (e) { return {}; }
}

function getPerformanceDistribution(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getPerformanceDistribution(sessionToken) || {})); } catch (e) { return {}; }
}

function getDefaulterDistribution(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getDefaulterDistribution(sessionToken) || {})); } catch (e) { return {}; }
}

function getLeaderboard(sessionToken) {
  try { return JSON.parse(JSON.stringify(Controller.Analytics.getLeaderboard(sessionToken) || {})); } catch (e) { return {}; }
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

function getEventParticipants(sessionToken, eventId) {
  try {
    const res = Controller.Participant.getEventParticipants(sessionToken, eventId);
    if (res && res.success) {
      return JSON.parse(JSON.stringify(res.data || []));
    }
    return [];
  } catch (e) {
    Logger.log("Error in global getEventParticipants: " + e.message);
    return [];
  }
}

function runCoordinatorTerminalDiagnostic() {
  Logger.log("=== RUNNING COORDINATOR TERMINAL DIAGNOSTIC ===");
  try {
    var sessions = DatabaseService.readAllRows("SESSIONS") || [];
    var activeSession = sessions.find(function(s) { 
      var statusCol = CONFIG.COLUMNS.SESSION_STATUS || 'Session Status';
      return String(s[statusCol]) === 'Active'; 
    });
    
    var token = "";
    if (activeSession) {
      var tokenCol = CONFIG.COLUMNS.SESSION_TOKEN || 'Session Token';
      token = activeSession[tokenCol];
      Logger.log("Found active session token: " + token);
    } else {
      var users = DatabaseService.readAllRows("USERS") || [];
      var coordUser = users.find(function(u) { 
        var role = u['Role'] || u.role || '';
        return String(role).toUpperCase() === 'COORDINATOR';
      });
      if (!coordUser) {
        Logger.log("❌ No Coordinator user found in USERS sheet.");
        return;
      }
      Logger.log("Found coordinator user: " + coordUser['User ID'] + " (" + coordUser['Username'] + ")");
      
      var assignments = DatabaseService.readAllRows("EVENT_COORDINATORS") || [];
      var hasAssign = assignments.some(function(a) {
        return String(a['User ID']).toUpperCase() === String(coordUser['User ID']).toUpperCase() && String(a['Assignment Status']) === 'Active';
      });
      if (!hasAssign) {
        Logger.log("Seeding active event assignment for test...");
        var events = DatabaseService.readAllRows("EVENTS") || [];
        if (events.length === 0) {
          Logger.log("❌ No events found to assign.");
          return;
        }
        var eventId = events[0]['Event ID'];
        CoordinatorService.assignCoordinator(eventId, coordUser['User ID'], 'Coordinator', 'System', 'Diagnostic Seed');
      }
      
      Logger.log("Creating active session for diagnostic...");
      var sessionData = AuthService._createSession(coordUser);
      var tokenCol = CONFIG.COLUMNS.SESSION_TOKEN || 'Session Token';
      token = sessionData.token[tokenCol];
      Logger.log("Created test session token: " + token);
    }
    
    Logger.log("Executing getCoordinatorTerminalData(token)...");
    var res = getCoordinatorTerminalData(token);
    Logger.log("Execution finished successfully!");
    Logger.log("Returned response keys: " + JSON.stringify(Object.keys(res)));
    Logger.log("Returned response success: " + res.success);
  } catch (e) {
    Logger.log("❌ CRITICAL ERROR DURING DIAGNOSTIC: " + e.message);
    if (e.stack) Logger.log(e.stack);
  }
  Logger.log("=== DIAGNOSTIC COMPLETE ===");
}