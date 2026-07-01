/**
 * Service for generating read-only reports and summaries.
 * Aggregates data from other services. Does not modify data.
 */
const ReportService = {

  /**
   * Helper function to calculate attendance percentage securely.
   * @private
   * @param {number} present - Number of present instances.
   * @param {number} total - Total number of instances.
   * @returns {number} Attendance percentage rounded to 2 decimal places.
   */
  _calculatePercentage: function(present, total) {
    if (!total || total === 0) return 0;
    return Number(((present / total) * 100).toFixed(2));
  },

  /**
   * Helper function to generate aggregate attendance statistics for a list of students.
   * @private
   * @param {object[]} students - Array of student records.
   * @returns {object} Aggregate stats: {totalStudents, totalAttendance, present, absent, attendancePercentage}
   */
  _generateStudentAttendanceStatistics: function(students) {
    const safeStudents = students || [];
    let totalAttendance = 0;
    let present = 0;
    let absent = 0;

    safeStudents.forEach(student => {
      const summary = AttendanceService.getStudentAttendanceSummary(student.roll_number) || {
        totalEvents: 0,
        present: 0,
        absent: 0
      };
      totalAttendance += summary.totalEvents;
      present += summary.present;
      absent += summary.absent;
    });

    return {
      totalStudents: safeStudents.length,
      totalAttendance: totalAttendance,
      present: present,
      absent: absent,
      attendancePercentage: this._calculatePercentage(present, totalAttendance)
    };
  },

  /**
   * Generates a high-level dashboard summary.
   * @returns {object} Standard response containing dashboard summary data.
   */
  getDashboardSummary: function() {
    try {
      const students = StudentService.getAllStudents() || [];
      const events = EventService.getAllEvents() || [];
      const stats = AttendanceService.getOverallAttendanceStatistics() || {
        totalAttendance: 0,
        present: 0,
        absent: 0,
        attendancePercentage: 0
      };

      const report = {
        totalStudents: students.length,
        totalEvents: events.length,
        totalAttendance: stats.totalAttendance,
        totalPresent: stats.present,
        totalAbsent: stats.absent,
        attendancePercentage: stats.attendancePercentage
      };

      return Utils.buildResponse(true, CONFIG.MESSAGES.REPORT_GENERATED || 'Report generated successfully.', { report: report });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  /**
   * Generates a detailed report for a specific event.
   * @param {string} eventId 
   * @returns {object} Standard response containing event report data.
   */
  getEventReport: function(eventId) {
    try {
      const event = EventService.getEventById(eventId);
      if (!event) {
        return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND || 'Event not found.');
      }

      const counts = AttendanceService.getEventAttendanceCount(eventId) || {
        total: 0,
        present: 0,
        absent: 0
      };

      const report = {
        eventId: event.event_id,
        eventName: event.event_name,
        eventDate: event.event_date,
        venue: event.venue,
        coordinatorId: event.coordinator_id,
        status: event.status,
        totalAttendance: counts.total,
        present: counts.present,
        absent: counts.absent,
        attendancePercentage: this._calculatePercentage(counts.present, counts.total)
      };

      return Utils.buildResponse(true, CONFIG.MESSAGES.REPORT_GENERATED || 'Report generated successfully.', { report: report });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  /**
   * Generates a detailed report for a specific student.
   * @param {string} rollNumber 
   * @returns {object} Standard response containing student report data.
   */
  getStudentReport: function(rollNumber) {
    try {
      const student = StudentService.getStudentByRollNumber(rollNumber);
      if (!student) {
        return Utils.buildResponse(false, CONFIG.MESSAGES.STUDENT_NOT_FOUND || 'Student not found.');
      }

      const summary = AttendanceService.getStudentAttendanceSummary(rollNumber) || {
        totalEvents: 0,
        present: 0,
        absent: 0
      };

      const report = {
        rollNumber: student.roll_number,
        studentName: student.student_name,
        department: student.department,
        year: student.year,
        section: student.section,
        status: student.status,
        totalEvents: summary.totalEvents,
        present: summary.present,
        absent: summary.absent,
        attendancePercentage: this._calculatePercentage(summary.present, summary.totalEvents)
      };

      return Utils.buildResponse(true, CONFIG.MESSAGES.REPORT_GENERATED || 'Report generated successfully.', { report: report });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  /**
   * Generates a report for a specific department.
   * @param {string} department 
   * @returns {object} Standard response containing department report data.
   */
  getDepartmentReport: function(department) {
    try {
      const students = StudentService.getStudentsByDepartment(department) || [];
      if (students.length === 0) {
        return Utils.buildResponse(false, CONFIG.MESSAGES.INVALID_DEPARTMENT || 'Invalid department.');
      }
      
      const stats = this._generateStudentAttendanceStatistics(students);
      
      const report = {
        department: department,
        totalStudents: stats.totalStudents,
        totalAttendance: stats.totalAttendance,
        present: stats.present,
        absent: stats.absent,
        attendancePercentage: stats.attendancePercentage
      };

      return Utils.buildResponse(true, CONFIG.MESSAGES.REPORT_GENERATED || 'Report generated successfully.', { report: report });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  /**
   * Generates a report for a specific year.
   * @param {string|number} year 
   * @returns {object} Standard response containing year report data.
   */
  getYearWiseReport: function(year) {
  try {

    const students = StudentService.getStudentsByYear(year) || [];

    if (students.length === 0) {
      return Utils.buildResponse(
        false,
        CONFIG.MESSAGES.INVALID_YEAR || 'Invalid year.'
      );
    }

    const stats = this._generateStudentAttendanceStatistics(students);

    const report = {
      year: String(year),
      totalStudents: stats.totalStudents,
      totalAttendance: stats.totalAttendance,
      present: stats.present,
      absent: stats.absent,
      attendancePercentage: stats.attendancePercentage
    };

    return Utils.buildResponse(
      true,
      CONFIG.MESSAGES.REPORT_GENERATED || 'Report generated successfully.',
      { report: report }
    );

  } catch (error) {
    return Utils.buildResponse(false, error.message);
  }
},
  /**
   * Generates a report for a specific section.
   * @param {string} section 
   * @returns {object} Standard response containing section report data.
   */
  getSectionReport: function(section) {
    try {
      const students = StudentService.getStudentsBySection(section) || [];
      if (students.length === 0) {
        return Utils.buildResponse(false, CONFIG.MESSAGES.INVALID_SECTION || 'Invalid section.');
      }
      
      const stats = this._generateStudentAttendanceStatistics(students);

      const report = {
        section: section,
        totalStudents: stats.totalStudents,
        totalAttendance: stats.totalAttendance,
        present: stats.present,
        absent: stats.absent,
        attendancePercentage: stats.attendancePercentage
      };

      return Utils.buildResponse(true, CONFIG.MESSAGES.REPORT_GENERATED || 'Report generated successfully.', { report: report });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  /**
   * Generates an attendance report for a specific date.
   * @param {string} date 
   * @returns {object} Standard response containing date-wise report data.
   */
  getDateWiseReport: function(date) {
    try {
      const attendanceRecords = AttendanceService.getAttendanceByDate(date) || [];
      
      let present = 0;
      let absent = 0;

      attendanceRecords.forEach(record => {
        if (record.status === CONFIG.ATTENDANCE_STATUS.PRESENT) {
          present++;
        } else if (record.status === CONFIG.ATTENDANCE_STATUS.ABSENT) {
          absent++;
        }
      });

      const totalAttendance = attendanceRecords.length;

      const report = {
        date: Utils.formatDate(date),
        totalAttendance: totalAttendance,
        present: present,
        absent: absent,
        attendancePercentage: this._calculatePercentage(present, totalAttendance)
      };

      return Utils.buildResponse(true, CONFIG.MESSAGES.REPORT_GENERATED || 'Report generated successfully.', { report: report });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  /**
   * Generates the overall attendance report.
   * @returns {object} Standard response containing overall attendance report data.
   */
  getOverallAttendanceReport: function() {
    try {
      const students = StudentService.getAllStudents() || [];
      const events = EventService.getAllEvents() || [];
      const stats = AttendanceService.getOverallAttendanceStatistics() || {
        totalAttendance: 0,
        present: 0,
        absent: 0,
        attendancePercentage: 0
      };

      const report = {
        totalStudents: students.length,
        totalEvents: events.length,
        totalAttendance: stats.totalAttendance,
        attendancePercentage: this._calculatePercentage(stats.present, stats.totalAttendance)
      };

      return Utils.buildResponse(true, CONFIG.MESSAGES.REPORT_GENERATED || 'Report generated successfully.', { report: report });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  /**
   * Generates a report of events managed by a specific coordinator.
   * @param {string} coordinatorId 
   * @returns {object} Standard response containing coordinator report data.
   */
  getCoordinatorReport: function(coordinatorId) {
    try {
      let coordinator = UserService.getUserById(coordinatorId);
      if (!coordinator) {
        // Fallback search
        const records = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'user_id', coordinatorId);
        if (records && records.length > 0) {
          coordinator = records[0];
        }
      }

      if (!coordinator) {
        return Utils.buildResponse(false, CONFIG.MESSAGES.INVALID_COORDINATOR || 'Invalid coordinator ID.');
      }

      const events = EventService.getEventsByCoordinator(coordinatorId) || [];
      
      let totalAttendance = 0;
      let present = 0;
      let absent = 0;

      events.forEach(event => {
        const counts = AttendanceService.getEventAttendanceCount(event.event_id) || {
          total: 0,
          present: 0,
          absent: 0
        };
        totalAttendance += counts.total;
        present += counts.present;
        absent += counts.absent;
      });

      const report = {
        coordinatorId: coordinatorId,
        coordinatorName: coordinator.full_name || '',
        totalEvents: events.length,
        totalAttendance: totalAttendance,
        present: present,
        absent: absent,
        attendancePercentage: this._calculatePercentage(present, totalAttendance)
      };

      return Utils.buildResponse(true, CONFIG.MESSAGES.REPORT_GENERATED || 'Report generated successfully.', { report: report });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  }

};
