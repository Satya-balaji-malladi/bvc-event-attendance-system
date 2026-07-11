/**
 * DashboardService.js
 * Service for computing dashboard statistics and recent audit activities.
 */
const DashboardService = {
  
  getTotalUsersCount: function() {
    Logger.log("DASHBOARD_SERVICE | STEP 3 - Reading Google Sheet | Sheet Name: " + CONFIG.SHEETS.USERS);
    var users = DatabaseService.readAllRows(CONFIG.SHEETS.USERS) || [];
    Logger.log("DASHBOARD_SERVICE | STEP 4 - Processing data");
    var activeUsers = users.filter(function(u) {
      return u[CONFIG.COLUMNS.DELETION_FLAG] !== true && u[CONFIG.COLUMNS.DELETION_FLAG] !== "true";
    });
    return activeUsers.length;
  },

  getTotalCoordinatorsCount: function() {
    Logger.log("DASHBOARD_SERVICE | STEP 3 - Reading Google Sheet | Sheet Name: " + CONFIG.SHEETS.USERS);
    var users = DatabaseService.readAllRows(CONFIG.SHEETS.USERS) || [];
    Logger.log("DASHBOARD_SERVICE | STEP 4 - Processing data");
    var activeCoordinators = users.filter(function(u) {
      if (u[CONFIG.COLUMNS.DELETION_FLAG] === true || u[CONFIG.COLUMNS.DELETION_FLAG] === "true") return false;
      var role = u['Role'] || u.role;
      return role === 'COORDINATOR' || role === 'Coordinator';
    });
    return activeCoordinators.length;
  },

  getTotalStudentsCount: function() {
    Logger.log("DASHBOARD_SERVICE | STEP 3 - Reading Google Sheet | Sheet Name: " + CONFIG.SHEETS.STUDENTS);
    var students = DatabaseService.readAllRows(CONFIG.SHEETS.STUDENTS) || [];
    Logger.log("DASHBOARD_SERVICE | STEP 4 - Processing data");
    var activeStudents = students.filter(function(s) {
      return !s[CONFIG.COLUMNS.DELETION_FLAG];
    });
    return activeStudents.length;
  },

  getTotalEventsCount: function() {
    Logger.log("DASHBOARD_SERVICE | STEP 3 - Reading Google Sheet | Sheet Name: " + CONFIG.SHEETS.EVENTS);
    var events = DatabaseService.readAllRows(CONFIG.SHEETS.EVENTS) || [];
    Logger.log("DASHBOARD_SERVICE | STEP 4 - Processing data");
    var activeEvents = events.filter(function(e) {
      return !e[CONFIG.COLUMNS.DELETION_FLAG];
    });
    return activeEvents.length;
  },

  getActiveEventsCount: function() {
    Logger.log("DASHBOARD_SERVICE | STEP 3 - Reading Google Sheet | Sheet Name: " + CONFIG.SHEETS.EVENTS);
    var events = DatabaseService.readAllRows(CONFIG.SHEETS.EVENTS) || [];
    Logger.log("DASHBOARD_SERVICE | STEP 4 - Processing data");
    var active = events.filter(function(e) {
      if (e[CONFIG.COLUMNS.DELETION_FLAG]) return false;
      var status = e["Event Status"] || e["Status"] || e.status;
      return status === "Active";
    });
    return active.length;
  },

  getUpcomingEventsCount: function() {
    Logger.log("DASHBOARD_SERVICE | STEP 3 - Reading Google Sheet | Sheet Name: " + CONFIG.SHEETS.EVENTS);
    var events = DatabaseService.readAllRows(CONFIG.SHEETS.EVENTS) || [];
    Logger.log("DASHBOARD_SERVICE | STEP 4 - Processing data");
    var upcoming = events.filter(function(e) {
      if (e[CONFIG.COLUMNS.DELETION_FLAG]) return false;
      var status = e["Event Status"] || e["Status"] || e.status;
      return status === "Upcoming";
    });
    return upcoming.length;
  },

  getCompletedEventsCount: function() {
    Logger.log("DASHBOARD_SERVICE | STEP 3 - Reading Google Sheet | Sheet Name: " + CONFIG.SHEETS.EVENTS);
    var events = DatabaseService.readAllRows(CONFIG.SHEETS.EVENTS) || [];
    Logger.log("DASHBOARD_SERVICE | STEP 4 - Processing data");
    var completed = events.filter(function(e) {
      if (e[CONFIG.COLUMNS.DELETION_FLAG]) return false;
      var status = e["Event Status"] || e["Status"] || e.status;
      return status === "Completed";
    });
    return completed.length;
  },

  getAttendanceTodayCount: function(userId) {
    Logger.log("DASHBOARD_SERVICE | STEP 3 - Reading Google Sheet | Sheet Name: Reports / Sessions");
    var summary = ReportService.getDashboardSummary(userId);
    Logger.log("DASHBOARD_SERVICE | STEP 4 - Processing data");
    var s = (summary && summary.report) ? summary.report : {};
    return s.totalAttendance || 0;
  },

  getAttendanceTodayAbsenteesCount: function(userId) {
    Logger.log("DASHBOARD_SERVICE | STEP 3 - Reading Google Sheet");
    var summary = ReportService.getDashboardSummary(userId);
    Logger.log("DASHBOARD_SERVICE | STEP 4 - Processing data");
    var s = (summary && summary.report) ? summary.report : {};
    return s.totalAbsent || 0;
  },

  getMonthlyAttendancePercentage: function(userId) {
    Logger.log("DASHBOARD_SERVICE | STEP 3 - Reading Google Sheet");
    var summary = ReportService.getDashboardSummary(userId);
    Logger.log("DASHBOARD_SERVICE | STEP 4 - Processing data");
    var s = (summary && summary.report) ? summary.report : {};
    return s.attendancePercentage || 0;
  },

  getTotalDepartmentsCount: function() {
    Logger.log("DASHBOARD_SERVICE | STEP 3 - Reading Google Sheet | Sheet Name: " + CONFIG.SHEETS.DEPARTMENTS);
    var depts = DepartmentService.getActiveDepartments() || [];
    return depts.length;
  },

  getRecentActivities: function() {
    Logger.log("DASHBOARD_SERVICE | STEP 3 - Reading Google Sheet | Sheet Name: " + CONFIG.SHEETS.AUDIT_LOGS);
    var logs = AuditService.getAuditLogs() || [];
    Logger.log("DASHBOARD_SERVICE | STEP 4 - Processing data");
    var sorted = AuditService.sortAuditLogs(logs, 'timestamp', 'desc');
    return sorted.slice(0, 5);
  }
};
