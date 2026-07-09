/**
 * Entry point for Google Apps Script Web App
 */
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'Login';
  
  if (page.toLowerCase() === 'forgotpassword') {
    return HtmlService.createTemplateFromFile('ForgotPassword')
        .evaluate()
        .setTitle('Forgot Password - BVC System')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  if (page.toLowerCase() === 'dashboard') {
    return HtmlService.createTemplateFromFile('Index')
        .evaluate()
        .setTitle('Dashboard - Admin')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page.toLowerCase() === 'coordinator') {
    try {
      return HtmlService.createTemplateFromFile('CoordinatorIndex')
          .evaluate()
          .setTitle('Dashboard - Coordinator')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (e) {
      // Fallback if CoordinatorIndex doesn't exist yet
      return HtmlService.createTemplateFromFile('Index')
          .evaluate()
          .setTitle('Dashboard - Coordinator (Fallback)')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }
  
  if (page.toLowerCase() === 'login') {
    return HtmlService.createTemplateFromFile('Login')
        .evaluate()
        .setTitle('Login - BVC System')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  // Default fallback to Login
  return HtmlService.createTemplateFromFile('Login')
      .evaluate()
      .setTitle('Login - BVC System')
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
        return HtmlService.createTemplateFromFile('CoordinatorIndex').evaluate().getContent();
      } catch (e) {
        return HtmlService.createTemplateFromFile('Index').evaluate().getContent();
      }
    }
    return HtmlService.createTemplateFromFile('Login').evaluate().getContent();
  } catch (e) {
    return "Error loading page: " + e.message;
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

function getAllEvents() {
  try {
    const res = Controller.Event.getAllEvents();
    // Force serialization to strip any Google Apps Script internal types (like Dates) that might break google.script.run
    const serialized = JSON.parse(JSON.stringify(res || []));
    Logger.log("Global getAllEvents() returning array of length: " + serialized.length);
    return serialized;
  } catch (e) {
    Logger.log("Error in global getAllEvents: " + e.message);
    return [];
  }
}

function getAllUsers() {
  try {
    const res = Controller.User.getAllUsers();
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

function createUser(userData) {
  try {
    Logger.log("BACKEND STEP 1: Code.js createUser started.");
    const result = Controller.User.createUser(userData);
    const serialized = JSON.parse(JSON.stringify(result || {}));
    Logger.log("BACKEND STEP 8: Code.js createUser finished. Returning: " + JSON.stringify(serialized));
    return serialized;
  } catch (e) {
    Logger.log("BACKEND EXCEPTION in Code.js createUser: " + e.message + "\\n" + e.stack);
    return { success: false, message: "Backend crash: " + e.message };
  }
}

function getAllStudents() {
  try {
    const res = Controller.Student.getAllStudents();
    return JSON.parse(JSON.stringify(res || []));
  } catch(e) {
    return [];
  }
}

function getDashboardSummary() {
  try {
    const res = Controller.Report.getDashboardSummary();
    return JSON.parse(JSON.stringify(res || {}));
  } catch(e) {
    return {};
  }
}

function getAttendanceByEvent(eventId) {
  try {
    const res = Controller.Attendance.getAttendanceByEvent(eventId);
    return JSON.parse(JSON.stringify(res || []));
  } catch(e) {
    return [];
  }
}
