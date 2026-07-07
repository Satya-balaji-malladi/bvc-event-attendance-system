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
    createUser: function(sessionToken, userData) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      Logger.log("BACKEND STEP 2: Controller.User.createUser started");
      const result = UserService.createUser(userData);
      Logger.log("BACKEND STEP 7: Controller.User.createUser finished.");
      return result;
      });
    },

    /**
     * Retrieves a user by ID.
     * @param {string} userId 
     * @returns {object|null}
     */
    getUserById: function(sessionToken, userId) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return UserService.getUserById(userId);
      });
    },

    /**
     * Retrieves a user by username.
     * @param {string} username 
     * @returns {object|null}
     */
    getUserByUsername: function(sessionToken, username) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return UserService.getUserByUsername(username);
      });
    },

    /**
     * @returns {object[]} Array of all users.
     */
    getAllUsers: function(sessionToken) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      const users = UserService.getAllUsers();
      Logger.log("STEP 3 - Controller.User.getAllUsers received from UserService: " + typeof users + " / Array? " + Array.isArray(users) + " / Length: " + (users ? users.length : 0));
      return users || [];
      });
    },

    /**
     * Updates an existing user.
     * @param {string} userId 
     * @param {object} userData 
     * @returns {object} Response object.
     */
    updateUser: function(sessionToken, userId, userData) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return UserService.updateUser(userId, userData);
      });
    },

    /**
     * Deletes a user.
     * @param {string} userId 
     * @returns {object} Response object.
     */
    deleteUser: function(sessionToken, userId) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return UserService.deleteUser(userId);
      });
    },

    /**
     * Deactivates a user.
     * @param {string} userId 
     * @returns {object} Response object.
     */
    deactivateUser: function(sessionToken, userId) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return UserService.deactivateUser(userId);
      });
    },

    /**
     * Resets a user's password to the default.
     * @param {string} userId 
     * @returns {object} Response object.
     */
    resetPassword: function(sessionToken, userId) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return UserService.resetPassword(userId);
      });
    },

    /**
     * Activates a user.
     * @param {string} userId 
     * @returns {object} Response object.
     */
    activateUser: function(sessionToken, userId) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return UserService.activateUser(userId);
      });
    },

    /**
     * Searches users by keyword.
     * @param {string} keyword 
     * @returns {object[]}
     */
    searchUsers: function(sessionToken, keyword) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return UserService.searchUsers(keyword);
      });
    },

    /**
     * Changes a user's password.
     * @param {string} userId 
     * @param {string} oldPassword 
     * @param {string} newPassword 
     * @returns {object} Response object.
     */
    changePassword: function(sessionToken, userId, oldPassword, newPassword) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return UserService.changePassword(userId, oldPassword, newPassword);
      });
    },
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
    createStudent: function(sessionToken, studentData) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return StudentService.createStudent(studentData);
      });
    },

    /**
     * Updates an existing student.
     * @param {string} rollNumber 
     * @param {object} studentData 
     * @returns {object} Response object.
     */
    updateStudent: function(sessionToken, rollNumber, studentData) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return StudentService.updateStudent(rollNumber, studentData);
      });
    },

    /**
     * Deletes a student.
     * @param {string} rollNumber 
     * @returns {object} Response object.
     */
    deleteStudent: function(sessionToken, rollNumber) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return StudentService.deleteStudent(rollNumber);
      });
    },

    /**
     * Retrieves a student by Roll Number.
     * @param {string} rollNumber 
     * @returns {object|null}
     */
    getStudentByRollNumber: function(sessionToken, rollNumber) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return StudentService.getStudentByRollNumber(rollNumber);
      });
    },

    /**
     * Retrieves all students.
     * @returns {object[]}
     */
    getAllStudents: function(sessionToken) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return StudentService.getAllStudents();
      });
    },

    /**
     * Searches students by keyword.
     * @param {string} keyword 
     * @returns {object[]}
     */
    searchStudents: function(sessionToken, keyword) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return StudentService.searchStudents(keyword);
      });
    },

    /**
     * Retrieves students by Department.
     * @param {string} department 
     * @returns {object[]}
     */
    getStudentsByDepartment: function(sessionToken, department) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return StudentService.getStudentsByDepartment(department);
      });
    },

    /**
     * Retrieves students by Year.
     * @param {string|number} year 
     * @returns {object[]}
     */
    getStudentsByYear: function(sessionToken, year) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return StudentService.getStudentsByYear(year);
      });
    },

    /**
     * Retrieves students by Section.
     * @param {string} section 
     * @returns {object[]}
     */
    getStudentsBySection: function(sessionToken, section) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return StudentService.getStudentsBySection(section);
      });
    },
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
    createEvent: function(sessionToken, eventData) {
      return SessionService.withSession(sessionToken, function(userId) {
      return EventService.createEvent(eventData);
      });
    },

    /**
     * Updates an existing event.
     * @param {string} eventId 
     * @param {object} eventData 
     * @returns {object} Response object.
     */
    updateEvent: function(sessionToken, eventId, eventData) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      Logger.log("BACKEND: Controller.Event.updateEvent started for " + eventId);
      const result = EventService.updateEvent(eventId, eventData);
      Logger.log("BACKEND: Controller.Event.updateEvent finished.");
      return result;
      });
    },

    /**
     * Deletes an event.
     * @param {string} eventId 
     * @returns {object} Response object.
     */
    deleteEvent: function(sessionToken, eventId) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return EventService.deleteEvent(eventId);
      });
    },

    /**
     * Retrieves an event by ID.
     * @param {string} eventId 
     * @returns {object|null}
     */
    getEventById: function(sessionToken, eventId) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      Logger.log("BACKEND: Controller.Event.getEventById started for " + eventId);
      const result = EventService.getEventById(eventId);
      Logger.log("BACKEND: Controller.Event.getEventById finished.");
      return result;
      });
    },

    /**
     * Retrieves all events.
     * @returns {object} Response object.
     */
    getAllEvents: function(sessionToken) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      const events = EventService.getAllEvents();
      Logger.log("Controller.Event.getAllEvents() events length: " + (events ? events.length : "null"));
      return events || [];
      });
    },

    /**
     * Searches events by keyword.
     * @param {string} keyword 
     * @returns {object[]}
     */
    searchEvents: function(sessionToken, keyword) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return EventService.searchEvents(keyword);
      });
    },

    /**
     * Retrieves events managed by a specific coordinator.
     * @param {string} coordinatorId 
     * @returns {object[]}
     */
    getEventsByCoordinator: function(sessionToken, coordinatorId) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return EventService.getEventsByCoordinator(coordinatorId);
      });
    },

    /**
     * Retrieves events by status.
     * @param {string} status 
     * @returns {object[]}
     */
    getEventsByStatus: function(sessionToken, status) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return EventService.getEventsByStatus(status);
      });
    },

    /**
     * Retrieves events by date.
     * @param {string} date 
     * @returns {object[]}
     */
    getEventsByDate: function(sessionToken, date) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return EventService.getEventsByDate(date);
      });
    },

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
    markAttendance: function(sessionToken, attendanceData) {
      return SessionService.withSession(sessionToken, function(sessionUserId) {
        try {
          // Validate request payload (minimal null safety)
          if (!attendanceData || typeof attendanceData !== 'object') {
            return Utils.buildResponse(false, 'Invalid attendance request');
          }
          const res = AttendanceService.markAttendance(attendanceData, sessionUserId);
          return res && (typeof res === 'object') && (res.success !== undefined) ? res : Utils.buildResponse(true, 'Attendance processed', { result: res });
        } catch (e) {
          Logger.log('Controller.Attendance.markAttendance error: ' + (e && e.message ? e.message : e));
          return Utils.buildResponse(false, e && e.message ? e.message : 'Attendance marking failed');
        }
      });
    },


    /**
     * Deletes an attendance record.
     * @param {string} attendanceId 
     * @returns {object} Response object.
     */
    deleteAttendance: function(sessionToken, attendanceId) {
      return SessionService.withSession(sessionToken, function(sessionUserId) {
        try {
          if (!attendanceId) return Utils.buildResponse(false, 'Invalid attendance request');
          return AttendanceService.deleteAttendance(attendanceId, sessionUserId);
        } catch (e) {
          Logger.log('Controller.Attendance.deleteAttendance error: ' + (e && e.message ? e.message : e));
          return Utils.buildResponse(false, e && e.message ? e.message : 'Attendance deletion failed');
        }
      });
    },


    /**
     * Retrieves an attendance record by ID.
     * @param {string} attendanceId 
     * @returns {object|null}
     */
    getAttendanceById: function(sessionToken, attendanceId) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return AttendanceService.getAttendanceById(attendanceId);
      });
    },

    /**
     * Retrieves attendance records by Event ID.
     * @param {string} eventId 
     * @returns {object[]}
     */
    getAttendanceByEvent: function(sessionToken, eventId) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return AttendanceService.getAttendanceByEvent(eventId);
      });
    },

    /**
     * Retrieves attendance records by Student Roll Number.
     * @param {string} rollNumber 
     * @returns {object[]}
     */
    getAttendanceByStudent: function(sessionToken, rollNumber) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return AttendanceService.getAttendanceByStudent(rollNumber);
      });
    },

    /**
     * Retrieves attendance records by date.
     * @param {string} date 
     * @returns {object[]}
     */
    getAttendanceByDate: function(sessionToken, date) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return AttendanceService.getAttendanceByDate(date);
      });
    },

    /**
     * Retrieves attendance records by status.
     * @param {string} status 
     * @returns {object[]}
     */
    getAttendanceByStatus: function(sessionToken, status) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return AttendanceService.getAttendanceByStatus(status);
      });
    },

    /**
     * Checks if an attendance record already exists.
     * @param {string} eventId 
     * @param {string} rollNumber 
     * @returns {boolean}
     */
    checkAttendanceExists: function(sessionToken, eventId, rollNumber) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return AttendanceService.checkAttendanceExists(eventId, rollNumber);
      });
    },

    /**
     * Retrieves attendance counts for a specific event.
     * @param {string} eventId 
     * @returns {object}
     */
    getEventAttendanceCount: function(sessionToken, eventId) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return AttendanceService.getEventAttendanceCount(eventId);
      });
    },

    /**
     * Retrieves the total attendance records count for a student.
     * @param {string} rollNumber 
     * @returns {number}
     */
    getStudentAttendanceCount: function(sessionToken, rollNumber) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return AttendanceService.getStudentAttendanceCount(rollNumber);
      });
    },

    /**
     * Retrieves the summarized attendance data for a student.
     * @param {string} rollNumber 
     * @returns {object}
     */
    getStudentAttendanceSummary: function(sessionToken, rollNumber) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return AttendanceService.getStudentAttendanceSummary(rollNumber);
      });
    },

    /**
     * Retrieves overall attendance statistics across all events.
     * @returns {object}
     */
    getOverallAttendanceStatistics: function(sessionToken) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return AttendanceService.getOverallAttendanceStatistics();
      });
    },

    /**
     * Retrieves an attendance summary for a specific event.
     * @param {string} eventId 
     * @returns {object|null}
     */
    getAttendanceSummaryByEvent: function(sessionToken, eventId) {
      return SessionService.withSession(sessionToken, function(_sessionUserId) {
      return AttendanceService.getAttendanceSummaryByEvent(eventId);
      });
    },
  },

  // ==========================================
  // Report Controller
  // ==========================================
  Report: {
    getDashboardSummary: function(sessionToken) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getDashboardSummary(userId);
      });
    },
    getReportsDashboardSummary: function(sessionToken) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getReportsDashboardSummary(userId);
      });
    },
    getEventReport: function(sessionToken, filters) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getEventReport(userId, filters);
      });
    },
    getStudentReport: function(sessionToken, rollNumber) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getStudentReport(userId, rollNumber);
      });
    },
    getDepartmentReport: function(sessionToken, department) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getDepartmentReport(userId, department);
      });
    },
    getCoordinatorReport: function(sessionToken, coordinatorId) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getCoordinatorReport(userId, coordinatorId);
      });
    },
    getDateRangeReport: function(sessionToken, fromDate, toDate) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getDateRangeReport(userId, fromDate, toDate);
      });
    },
    getAttendanceDefaulters: function(sessionToken, filters) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getAttendanceDefaulters(userId, filters);
      });
    },
    getTopParticipants: function(sessionToken, filters) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getTopParticipants(userId, filters);
      });
    },
    getAbsentStudents: function(sessionToken, filters) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getAbsentStudents(userId, filters);
      });
    },
    getYearWiseReport: function(sessionToken, year) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getYearWiseReport(userId, year);
      });
    },
    getDepartmentComparison: function(sessionToken) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getDepartmentComparison(userId);
      });
    },
    getMonthlyReport: function(sessionToken, filters) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getMonthlyReport(userId, filters);
      });
    },
    getEventTrendReport: function(sessionToken, filters) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getEventTrendReport(userId, filters);
      });
    },
    getCancelledEvents: function(sessionToken, filters) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getCancelledEvents(userId, filters);
      });
    },
    getCoordinatorPerformance: function(sessionToken, coordinatorId) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getCoordinatorPerformance(userId, coordinatorId);
      });
    },
    getStudentEventHistory: function(sessionToken, rollNumber) {
      return SessionService.withSession(sessionToken, function(userId) {
        return ReportService.getStudentEventHistory(userId, rollNumber);
      });
    }
  },

  // ==========================================
  // Participant Controller
  // ==========================================
  Participant: {
    getEventParticipants: function(sessionToken, eventId) {
      return SessionService.withSession(sessionToken, function(sessionUserId) {
        try {
          if (!eventId) return Utils.buildResponse(false, 'Invalid participant request');
          return ParticipantService.getEventParticipants(eventId, sessionUserId);
        } catch (e) {
          Logger.log('Controller.Participant.getEventParticipants error: ' + (e && e.message ? e.message : e));
          return Utils.buildResponse(false, e && e.message ? e.message : 'Failed to get participants');
        }
      });
    },

    addParticipant: function(sessionToken, eventId, rollNumber) {
      return SessionService.withSession(sessionToken, function(sessionUserId) {
        try {
          if (!eventId || !rollNumber) return Utils.buildResponse(false, 'Invalid participant request');
          return ParticipantService.addParticipant(eventId, rollNumber, sessionUserId);
        } catch (e) {
          Logger.log('Controller.Participant.addParticipant error: ' + (e && e.message ? e.message : e));
          return Utils.buildResponse(false, e && e.message ? e.message : 'Failed to add participant');
        }
      });
    },

    removeParticipant: function(sessionToken, eventId, rollNumber) {
      return SessionService.withSession(sessionToken, function(sessionUserId) {
        try {
          if (!eventId || !rollNumber) return Utils.buildResponse(false, 'Invalid participant request');
          return ParticipantService.removeParticipant(eventId, rollNumber, sessionUserId);
        } catch (e) {
          Logger.log('Controller.Participant.removeParticipant error: ' + (e && e.message ? e.message : e));
          return Utils.buildResponse(false, e && e.message ? e.message : 'Failed to remove participant');
        }
      });
    },

    restoreParticipant: function(sessionToken, eventId, rollNumber) {
      return SessionService.withSession(sessionToken, function(sessionUserId) {
        try {
          if (!eventId || !rollNumber) return Utils.buildResponse(false, 'Invalid participant request');
          return ParticipantService.restoreParticipant(eventId, rollNumber, sessionUserId);
        } catch (e) {
          Logger.log('Controller.Participant.restoreParticipant error: ' + (e && e.message ? e.message : e));
          return Utils.buildResponse(false, e && e.message ? e.message : 'Failed to restore participant');
        }
      });
    },

    checkEligibility: function(sessionToken, eventId, rollNumber) {
      return SessionService.withSession(sessionToken, function(sessionUserId) {
        try {
          if (!eventId || !rollNumber) return Utils.buildResponse(false, 'Invalid participant request');
          return ParticipantService.checkEligibility(eventId, rollNumber, sessionUserId);
        } catch (e) {
          Logger.log('Controller.Participant.checkEligibility error: ' + (e && e.message ? e.message : e));
          return Utils.buildResponse(false, e && e.message ? e.message : 'Failed to check eligibility');
        }
      });
    },

  },

  // ==========================================
  // Settings API
  // ==========================================
  Settings: {
    getSettings: function(sessionToken) {
      return SessionService.withSession(sessionToken, function(userId) {
      return SettingsService.getSettings();
      });
    },
    saveSettings: function(sessionToken, payload) {
      return SessionService.withSession(sessionToken, function(userId) {
      return SettingsService.saveSettings(payload);
      });
    },
  }

};
