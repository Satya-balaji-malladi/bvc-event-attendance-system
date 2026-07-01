/**
 * Controller.js
 * 
 * Acts as the API layer between the frontend and the Service layer.
 * Contains no business logic, validation, calculations, or database operations.
 * Delegates all operations to the appropriate service.
 */

const Controller = {

  // ==========================================
  // Authentication Controller
  // ==========================================
  Auth: {
    /**
     * Authenticates a user and creates a session.
     * @param {object} credentials - { usernameOrEmail, password }
     * @returns {object} Response object.
     */
    login: function(credentials) {
      return AuthService.login(credentials);
    },

    /**
     * Destroys an active session.
     * @param {string} sessionToken 
     * @returns {object} Response object.
     */
    logout: function(sessionToken) {
      return AuthService.logout(sessionToken);
    },

    /**
     * Validates a session token via AuthService.
     * @param {string} sessionToken 
     * @returns {object} Response object.
     */
    authenticate: function(sessionToken) {
      return AuthService.authenticate(sessionToken);
    }
  },

  // ==========================================
  // Session Controller
  // ==========================================
  Session: {
    /**
     * Validates a session token.
     * @param {string} sessionToken 
     * @returns {object|null} The session object if valid, else null.
     */
    validateSession: function(sessionToken) {
      return SessionService.validateSession(sessionToken);
    },

    /**
     * Retrieves the current user for a session.
     * @param {string} sessionToken 
     * @returns {object|null} The user object if session is valid.
     */
    getCurrentUser: function(sessionToken) {
      return SessionService.getCurrentUser(sessionToken);
    },

    /**
     * Checks if a session belongs to a user with a specific role.
     * @param {string} sessionToken 
     * @param {string} role 
     * @returns {boolean} True if user has the specified role.
     */
    hasRole: function(sessionToken, role) {
      return SessionService.hasRole(sessionToken, role);
    }
  },

  // ==========================================
  // User Controller
  // ==========================================
  User: {
    /**
     * Creates a new user.
     * @param {object} userData 
     * @returns {object} Response object.
     */
    createUser: function(userData) {
      return UserService.createUser(userData);
    },

    /**
     * Retrieves a user by ID.
     * @param {string} userId 
     * @returns {object|null}
     */
    getUserById: function(userId) {
      return UserService.getUserById(userId);
    },

    /**
     * Retrieves a user by username.
     * @param {string} username 
     * @returns {object|null}
     */
    getUserByUsername: function(username) {
      return UserService.getUserByUsername(username);
    },

    /**
     * Retrieves all users.
     * @returns {object[]} Array of all users.
     */
    getAllUsers: function() {
      return UserService.getAllUsers();
    },

    /**
     * Updates an existing user.
     * @param {string} userId 
     * @param {object} userData 
     * @returns {object} Response object.
     */
    updateUser: function(userId, userData) {
      return UserService.updateUser(userId, userData);
    },

    /**
     * Deletes a user.
     * @param {string} userId 
     * @returns {object} Response object.
     */
    deleteUser: function(userId) {
      return UserService.deleteUser(userId);
    },

    /**
     * Deactivates a user.
     * @param {string} userId 
     * @returns {object} Response object.
     */
    deactivateUser: function(userId) {
      return UserService.deactivateUser(userId);
    },

    /**
     * Activates a user.
     * @param {string} userId 
     * @returns {object} Response object.
     */
    activateUser: function(userId) {
      return UserService.activateUser(userId);
    },

    /**
     * Searches users by keyword.
     * @param {string} keyword 
     * @returns {object[]}
     */
    searchUsers: function(keyword) {
      return UserService.searchUsers(keyword);
    },

    /**
     * Changes a user's password.
     * @param {string} userId 
     * @param {string} oldPassword 
     * @param {string} newPassword 
     * @returns {object} Response object.
     */
    changePassword: function(userId, oldPassword, newPassword) {
      return UserService.changePassword(userId, oldPassword, newPassword);
    }
  },

  // ==========================================
  // Student Controller
  // ==========================================
  Student: {
    /**
     * Creates a new student.
     * @param {object} studentData 
     * @returns {object} Response object.
     */
    createStudent: function(studentData) {
      return StudentService.createStudent(studentData);
    },

    /**
     * Updates an existing student.
     * @param {string} rollNumber 
     * @param {object} studentData 
     * @returns {object} Response object.
     */
    updateStudent: function(rollNumber, studentData) {
      return StudentService.updateStudent(rollNumber, studentData);
    },

    /**
     * Deletes a student.
     * @param {string} rollNumber 
     * @returns {object} Response object.
     */
    deleteStudent: function(rollNumber) {
      return StudentService.deleteStudent(rollNumber);
    },

    /**
     * Retrieves a student by Roll Number.
     * @param {string} rollNumber 
     * @returns {object|null}
     */
    getStudentByRollNumber: function(rollNumber) {
      return StudentService.getStudentByRollNumber(rollNumber);
    },

    /**
     * Retrieves all students.
     * @returns {object[]}
     */
    getAllStudents: function() {
      return StudentService.getAllStudents();
    },

    /**
     * Searches students by keyword.
     * @param {string} keyword 
     * @returns {object[]}
     */
    searchStudents: function(keyword) {
      return StudentService.searchStudents(keyword);
    },

    /**
     * Retrieves students by Department.
     * @param {string} department 
     * @returns {object[]}
     */
    getStudentsByDepartment: function(department) {
      return StudentService.getStudentsByDepartment(department);
    },

    /**
     * Retrieves students by Year.
     * @param {string|number} year 
     * @returns {object[]}
     */
    getStudentsByYear: function(year) {
      return StudentService.getStudentsByYear(year);
    },

    /**
     * Retrieves students by Section.
     * @param {string} section 
     * @returns {object[]}
     */
    getStudentsBySection: function(section) {
      return StudentService.getStudentsBySection(section);
    }
  },

  // ==========================================
  // Event Controller
  // ==========================================
  Event: {
    /**
     * Creates a new event.
     * @param {object} eventData 
     * @returns {object} Response object.
     */
    createEvent: function(eventData) {
      return EventService.createEvent(eventData);
    },

    /**
     * Updates an existing event.
     * @param {string} eventId 
     * @param {object} eventData 
     * @returns {object} Response object.
     */
    updateEvent: function(eventId, eventData) {
      return EventService.updateEvent(eventId, eventData);
    },

    /**
     * Deletes an event.
     * @param {string} eventId 
     * @returns {object} Response object.
     */
    deleteEvent: function(eventId) {
      return EventService.deleteEvent(eventId);
    },

    /**
     * Retrieves an event by ID.
     * @param {string} eventId 
     * @returns {object|null}
     */
    getEventById: function(eventId) {
      return EventService.getEventById(eventId);
    },

    /**
     * Retrieves all events.
     * @returns {object[]}
     */
    getAllEvents: function() {
      return EventService.getAllEvents();
    },

    /**
     * Searches events by keyword.
     * @param {string} keyword 
     * @returns {object[]}
     */
    searchEvents: function(keyword) {
      return EventService.searchEvents(keyword);
    },

    /**
     * Retrieves events managed by a specific coordinator.
     * @param {string} coordinatorId 
     * @returns {object[]}
     */
    getEventsByCoordinator: function(coordinatorId) {
      return EventService.getEventsByCoordinator(coordinatorId);
    },

    /**
     * Retrieves events by status.
     * @param {string} status 
     * @returns {object[]}
     */
    getEventsByStatus: function(status) {
      return EventService.getEventsByStatus(status);
    },

    /**
     * Retrieves events by date.
     * @param {string} date 
     * @returns {object[]}
     */
    getEventsByDate: function(date) {
      return EventService.getEventsByDate(date);
    },

    /**
     * Marks an event as completed.
     * @param {string} eventId 
     * @returns {object} Response object.
     */
    completeEvent: function(eventId) {
      return EventService.completeEvent(eventId);
    },

    /**
     * Marks an event as upcoming.
     * @param {string} eventId 
     * @returns {object} Response object.
     */
    activateEvent: function(eventId) {
      return EventService.activateEvent(eventId);
    }
  },

  // ==========================================
  // Attendance Controller
  // ==========================================
  Attendance: {
    /**
     * Marks attendance for a student at an event.
     * @param {object} attendanceData 
     * @returns {object} Response object.
     */
    markAttendance: function(attendanceData) {
      return AttendanceService.markAttendance(attendanceData);
    },

    /**
     * Deletes an attendance record.
     * @param {string} attendanceId 
     * @returns {object} Response object.
     */
    deleteAttendance: function(attendanceId) {
      return AttendanceService.deleteAttendance(attendanceId);
    },

    /**
     * Retrieves an attendance record by ID.
     * @param {string} attendanceId 
     * @returns {object|null}
     */
    getAttendanceById: function(attendanceId) {
      return AttendanceService.getAttendanceById(attendanceId);
    },

    /**
     * Retrieves attendance records by Event ID.
     * @param {string} eventId 
     * @returns {object[]}
     */
    getAttendanceByEvent: function(eventId) {
      return AttendanceService.getAttendanceByEvent(eventId);
    },

    /**
     * Retrieves attendance records by Student Roll Number.
     * @param {string} rollNumber 
     * @returns {object[]}
     */
    getAttendanceByStudent: function(rollNumber) {
      return AttendanceService.getAttendanceByStudent(rollNumber);
    },

    /**
     * Retrieves attendance records by date.
     * @param {string} date 
     * @returns {object[]}
     */
    getAttendanceByDate: function(date) {
      return AttendanceService.getAttendanceByDate(date);
    },

    /**
     * Retrieves attendance records by status.
     * @param {string} status 
     * @returns {object[]}
     */
    getAttendanceByStatus: function(status) {
      return AttendanceService.getAttendanceByStatus(status);
    },

    /**
     * Checks if an attendance record already exists.
     * @param {string} eventId 
     * @param {string} rollNumber 
     * @returns {boolean}
     */
    checkAttendanceExists: function(eventId, rollNumber) {
      return AttendanceService.checkAttendanceExists(eventId, rollNumber);
    },

    /**
     * Retrieves attendance counts for a specific event.
     * @param {string} eventId 
     * @returns {object}
     */
    getEventAttendanceCount: function(eventId) {
      return AttendanceService.getEventAttendanceCount(eventId);
    },

    /**
     * Retrieves the total attendance records count for a student.
     * @param {string} rollNumber 
     * @returns {number}
     */
    getStudentAttendanceCount: function(rollNumber) {
      return AttendanceService.getStudentAttendanceCount(rollNumber);
    },

    /**
     * Retrieves the summarized attendance data for a student.
     * @param {string} rollNumber 
     * @returns {object}
     */
    getStudentAttendanceSummary: function(rollNumber) {
      return AttendanceService.getStudentAttendanceSummary(rollNumber);
    },

    /**
     * Retrieves overall attendance statistics across all events.
     * @returns {object}
     */
    getOverallAttendanceStatistics: function() {
      return AttendanceService.getOverallAttendanceStatistics();
    },

    /**
     * Retrieves an attendance summary for a specific event.
     * @param {string} eventId 
     * @returns {object|null}
     */
    getAttendanceSummaryByEvent: function(eventId) {
      return AttendanceService.getAttendanceSummaryByEvent(eventId);
    }
  },

  // ==========================================
  // Report Controller
  // ==========================================
  Report: {
    /**
     * Retrieves the dashboard summary.
     * @returns {object} Response object.
     */
    getDashboardSummary: function() {
      return ReportService.getDashboardSummary();
    },

    /**
     * Retrieves a detailed report for an event.
     * @param {string} eventId 
     * @returns {object} Response object.
     */
    getEventReport: function(eventId) {
      return ReportService.getEventReport(eventId);
    },

    /**
     * Retrieves a detailed report for a student.
     * @param {string} rollNumber 
     * @returns {object} Response object.
     */
    getStudentReport: function(rollNumber) {
      return ReportService.getStudentReport(rollNumber);
    },

    /**
     * Retrieves a report for a specific department.
     * @param {string} department 
     * @returns {object} Response object.
     */
    getDepartmentReport: function(department) {
      return ReportService.getDepartmentReport(department);
    },

    /**
     * Retrieves a report for a specific year.
     * @param {string|number} year 
     * @returns {object} Response object.
     */
    getYearWiseReport: function(year) {
      return ReportService.getYearWiseReport(year);
    },

    /**
     * Retrieves a report for a specific section.
     * @param {string} section 
     * @returns {object} Response object.
     */
    getSectionReport: function(section) {
      return ReportService.getSectionReport(section);
    },

    /**
     * Retrieves an attendance report for a specific date.
     * @param {string} date 
     * @returns {object} Response object.
     */
    getDateWiseReport: function(date) {
      return ReportService.getDateWiseReport(date);
    },

    /**
     * Retrieves the overall attendance report.
     * @returns {object} Response object.
     */
    getOverallAttendanceReport: function() {
      return ReportService.getOverallAttendanceReport();
    },

    /**
     * Retrieves a report of events managed by a specific coordinator.
     * @param {string} coordinatorId 
     * @returns {object} Response object.
     */
    getCoordinatorReport: function(coordinatorId) {
      return ReportService.getCoordinatorReport(coordinatorId);
    }
  }

};
