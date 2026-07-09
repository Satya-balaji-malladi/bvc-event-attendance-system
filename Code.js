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

/**
 * Returns the raw HTML content of an inner component (Dashboard, Users, Events, etc.)
 * to be injected into the App Shell's pageContainer.
 */
function getComponentHtml(component) {
  try {
    // Basic mapping, assume the component name matches the HTML filename
    // e.g., "Dashboard" -> "Dashboard.html"
    return HtmlService.createTemplateFromFile(component).evaluate().getContent();
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

function getDashboardData(sessionToken) {
  try {
    // 1. సెషన్ వాలిడేషన్ చెక్
    var isValid = SessionService.validateSession(sessionToken);
    if (!isValid) {
      return { success: false, message: 'Session is invalid.' };
    }
    
    // 2. SAFE BYPASS: getCurrentUser లోపల షీట్ రైటింగ్ ఫెయిల్ అయినా క్రాష్ అవ్వకుండా 
    // నేరుగా సెషన్ ఆబ్జెక్ట్ నుండి లేదా డేటాబేస్ నుండి యూజర్ ఐడీని తీసుకుంటున్నాం
    var session = SessionService.getSession(sessionToken);
    var c = CONFIG.COLUMNS || {};
    var userIdCol = c.SESSION_USER_ID || 'User ID';
    var userId = session ? session[userIdCol] : null;
    
    if (!userId) {
      return { success: false, message: 'User not found for session.' };
    }

    // 3. డాష్‌బోర్డ్ సమ్మరీ డేటా
    const summaryResp = Controller.Report.getDashboardSummary(sessionToken);
    const summary = (summaryResp && summaryResp.report) ? summaryResp.report : {};
    
    // యూజర్స్ లిస్ట్
    const users = (DatabaseService.readAllRows(CONFIG.SHEETS.USERS) || [])
      .filter(u => u[CONFIG.COLUMNS.DELETION_FLAG] !== true && u[CONFIG.COLUMNS.DELETION_FLAG] !== "true");
      
    let totalCoordinators = 0;
    users.forEach(u => {
      const role = u['Role'] || u.role;
      if (role === 'COORDINATOR' || role === 'Coordinator') totalCoordinators++;
    });

    // స్టూడెంట్స్ లిస్ట్
    const studentsResp = Controller.Student.getAllStudents(sessionToken);
    const students = (studentsResp && studentsResp.students) ? studentsResp.students : [];
    const depts = new Set();
    students.forEach(s => {
      const d = s['Department ID'] || s.department;
      if (d) depts.add(d);
    });

    // యాక్టివ్ ఈవెంట్స్
    let activeEvents = [];
    let completedEventsCount = 0;
    try {
      const allEventsResp = Controller.Event.getAllEvents(sessionToken);
      const allEvents = Array.isArray(allEventsResp) ? allEventsResp : [];
      activeEvents = allEvents.filter(e => {
        const status = e['Event Status'] || e['Status'] || e.status;
        return status === 'Active' || status === 'Upcoming';
      });
      completedEventsCount = allEvents.filter(e => {
        const status = e['Event Status'] || e['Status'] || e.status;
        return status === 'Completed';
      }).length;
    } catch(e) {}

    // రీసెంట్ యాక్టివిటీస్
    let activities = [];
    try {
      const logs = AuditService.getAuditLogs() || [];
      activities = AuditService.sortAuditLogs(logs, 'timestamp', 'desc').slice(0, 10);
    } catch(e) {}

    // ఫైనల్ రెస్పాన్స్ పేలోడ్
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
function getAttendanceByEvent(eventId) {
  try {
    const res = Controller.Attendance.getAttendanceByEvent(null, eventId);
    return JSON.parse(JSON.stringify(res || []));
  } catch(e) {
    return [];
  }
}
