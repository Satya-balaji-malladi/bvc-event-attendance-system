/**
 * Service for handling student attendance for events.
 * Responsibilities: Marking attendance, deletion, retrieving and summarizing attendance data.
 */
const AttendanceService = {

  /**
   * Checks if an attendance record already exists for a given event and student.
   * @param {string} eventId 
   * @param {string} rollNumber 
   * @returns {boolean} True if attendance exists.
   */
  checkAttendanceExists: function(eventId, rollNumber) {
    if (!eventId || !rollNumber) return false;
    
    const allAttendance = DatabaseService.readAllRows(CONFIG.SHEETS.ATTENDANCE);
    if (!allAttendance || allAttendance.length === 0) return false;

    const searchEventId = String(eventId).trim();
    const searchRollNum = String(rollNumber).trim().toUpperCase();

    return allAttendance.some(record => {
      return String(record.event_id).trim() === searchEventId && 
             String(record.roll_number).trim().toUpperCase() === searchRollNum;
    });
  },

  /**
   * Marks attendance for a student at an event.
   * @param {object} attendanceData 
   * @param {string} userId - Injected by SessionService
   * @returns {object} Standard response object.
   */
  markAttendance: function(attendanceData, userId) {
    const validationResult = ValidationService.validateAttendance(attendanceData);
    if (!validationResult.valid) {
      return Utils.buildResponse(false, validationResult.errors.join(' '));
    }

    const eventId = attendanceData.event_id;
    const rollNumber = String(attendanceData.roll_number).trim().toUpperCase();

    // Verify event exists
    const event = EventService.getEventById(eventId);
    if (!event) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
    }

    // Verify student exists
    const student = StudentService.getStudentByRollNumber(rollNumber);
    if (!student) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.STUDENT_NOT_FOUND);
    }
    
    // Validate Coordinator Ownership
    const actionBy = userId; // Trust backend session over frontend payload
    const user = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'user_id', actionBy)[0];
    if (user && user.role === CONFIG.ROLES.COORDINATOR) {
      if (event.coordinator_id !== actionBy) {
        return Utils.buildResponse(false, 'Unauthorized: You can only mark attendance for your assigned events.');
      }
    }

    // Sprint 1 Rules: Check Fixed/Open eligibility
    const attendanceType = event.attendance_type || 'Fixed';
    if (attendanceType === 'Fixed') {
      const parts = DatabaseService.findByColumn(CONFIG.SHEETS.EVENT_PARTICIPANTS, 'event_id', eventId);
      const isPart = parts.find(p => p.roll_number === rollNumber && p.status === 'Active');
      if (!isPart) {
        return Utils.buildResponse(false, 'Student is not an active participant for this Fixed event.');
      }
    } else {
      // Open Event - Use ParticipantService.checkEligibility
      const eligibility = ParticipantService.checkEligibility(eventId, rollNumber, actionBy);
      // It might return false because they are already added, which is fine for attendance marking.
      if (!eligibility.eligible && eligibility.reason.indexOf('Already Added') === -1) {
         return Utils.buildResponse(false, eligibility.reason);
      }
    }

    // Prevent duplicate attendance
    if (this.checkAttendanceExists(eventId, rollNumber)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.ATTENDANCE_ALREADY_EXISTS);
    }

    // Determine status
    let status = attendanceData.status || CONFIG.ATTENDANCE_STATUS.PRESENT;
    if (status !== CONFIG.ATTENDANCE_STATUS.PRESENT && status !== CONFIG.ATTENDANCE_STATUS.ABSENT) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.INVALID_ATTENDANCE_STATUS);
    }

    const attendanceId = IdService.generateAttendanceId();
    const attendanceTime = Utils.getCurrentDate();

    const newAttendance = {
      attendance_id: attendanceId,
      event_id: eventId,
      roll_number: rollNumber,
      attendance_time: attendanceTime,
      status: status
    };

    const success = DatabaseService.insertRow(CONFIG.SHEETS.ATTENDANCE, newAttendance);
    if (success) {
      return Utils.buildResponse(true, CONFIG.MESSAGES.ATTENDANCE_MARKED, { attendance: newAttendance });
    }
    return Utils.buildResponse(false, CONFIG.MESSAGES.ATTENDANCE_MARK_FAILED);
  },

  /**
   * Deletes an attendance record.
   * @param {string} attendanceId 
   * @param {string} userId - Injected by SessionService
   * @returns {object} Standard response object.
   */
  deleteAttendance: function(attendanceId, userId) {
    const sheetName = CONFIG.SHEETS.ATTENDANCE;
    
    const attendanceRecord = this.getAttendanceById(attendanceId);
    if (!attendanceRecord) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.ATTENDANCE_NOT_FOUND);
    }

    const event = EventService.getEventById(attendanceRecord.event_id);
    
    // Validate Ownership for deletion
    const user = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'user_id', userId)[0];
    if (user && user.role === CONFIG.ROLES.COORDINATOR) {
      if (event && event.coordinator_id !== userId) {
        return Utils.buildResponse(false, 'Unauthorized: You can only delete attendance for your assigned events.');
      }
    }
    
    if (event && event.status === CONFIG.EVENT_STATUS.COMPLETED) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_ALREADY_COMPLETED);
    }

    const success = DatabaseService.deleteRow(sheetName, 'attendance_id', attendanceId);
    if (success) {
      return Utils.buildResponse(true, CONFIG.MESSAGES.ATTENDANCE_DELETED);
    }
    return Utils.buildResponse(false, CONFIG.MESSAGES.ATTENDANCE_DELETE_FAILED);
  },

  /**
   * Retrieves an attendance record by ID.
   * @param {string} attendanceId 
   * @returns {object|null}
   */
  getAttendanceById: function(attendanceId) {
    if (!attendanceId) return null;
    const records = DatabaseService.findByColumn(CONFIG.SHEETS.ATTENDANCE, 'attendance_id', attendanceId);
    return records.length > 0 ? records[0] : null;
  },

  /**
   * Retrieves attendance records by Event ID.
   * @param {string} eventId 
   * @returns {object[]}
   */
  getAttendanceByEvent: function(eventId) {
    if (!eventId) return [];
    return DatabaseService.findByColumn(CONFIG.SHEETS.ATTENDANCE, 'event_id', eventId);
  },

  /**
   * Retrieves attendance records by Student Roll Number.
   * @param {string} rollNumber 
   * @returns {object[]}
   */
  getAttendanceByStudent: function(rollNumber) {
    if (!rollNumber) return [];
    const normalizedRoll = String(rollNumber).trim().toUpperCase();
    return DatabaseService.findByColumn(CONFIG.SHEETS.ATTENDANCE, 'roll_number', normalizedRoll);
  },

  /**
   * Retrieves attendance records by Date.
   * @param {string} date 
   * @returns {object[]}
   */
  getAttendanceByDate: function(date) {
    if (!date) return [];
    const targetDate = Utils.formatDate(date);
    const allAttendance = DatabaseService.readAllRows(CONFIG.SHEETS.ATTENDANCE);
    return allAttendance.filter(record => Utils.formatDate(record.attendance_time) === targetDate);
  },

  /**
   * Retrieves attendance records by Status.
   * @param {string} status 
   * @returns {object[]}
   */
  getAttendanceByStatus: function(status) {
    if (!status) return [];
    return DatabaseService.findByColumn(CONFIG.SHEETS.ATTENDANCE, 'status', status);
  },

  /**
   * Gets the attendance counts for an event.
   * @param {string} eventId 
   * @returns {object} {total, present, absent}
   */
  getEventAttendanceCount: function(eventId) {
    const records = this.getAttendanceByEvent(eventId);
    let present = 0;
    let absent = 0;
    
    records.forEach(record => {
      if (record.status === CONFIG.ATTENDANCE_STATUS.PRESENT) {
        present++;
      } else if (record.status === CONFIG.ATTENDANCE_STATUS.ABSENT) {
        absent++;
      }
    });

    return {
      total: records.length,
      present: present,
      absent: absent
    };
  },

  /**
   * Gets the total attendance records count for a student.
   * @param {string} rollNumber 
   * @returns {number} Total attendance records count.
   */
  getStudentAttendanceCount: function(rollNumber) {
    const records = this.getAttendanceByStudent(rollNumber);
    return records.length;
  },

  /**
   * Gets the summarized attendance data for a student.
   * @param {string} rollNumber 
   * @returns {object} {totalEvents, present, absent}
   */
  getStudentAttendanceSummary: function(rollNumber) {
    const records = this.getAttendanceByStudent(rollNumber);
    let present = 0;
    let absent = 0;

    records.forEach(record => {
      if (record.status === CONFIG.ATTENDANCE_STATUS.PRESENT) {
        present++;
      } else if (record.status === CONFIG.ATTENDANCE_STATUS.ABSENT) {
        absent++;
      }
    });

    return {
      totalEvents: records.length,
      present: present,
      absent: absent
    };
  },

  /**
   * Gets overall attendance statistics across all events.
   * @returns {object} {totalAttendance, present, absent, attendancePercentage}
   */
  getOverallAttendanceStatistics: function() {
    const allAttendance = DatabaseService.readAllRows(CONFIG.SHEETS.ATTENDANCE) || [];
    let present = 0;
    let absent = 0;

    allAttendance.forEach(record => {
      if (record.status === CONFIG.ATTENDANCE_STATUS.PRESENT) {
        present++;
      } else if (record.status === CONFIG.ATTENDANCE_STATUS.ABSENT) {
        absent++;
      }
    });

    const totalAttendance = allAttendance.length;
    const percentage = totalAttendance === 0 ? 0 : (present / totalAttendance) * 100;

    return {
      totalAttendance: totalAttendance,
      present: present,
      absent: absent,
      attendancePercentage: Number(percentage.toFixed(2))
    };
  },

  /**
   * Gets an attendance summary for a specific event.
   * @param {string} eventId 
   * @returns {object|null} Summary object or null if event not found.
   */
  getAttendanceSummaryByEvent: function(eventId) {
    const event = EventService.getEventById(eventId);
    if (!event) return null;

    const counts = this.getEventAttendanceCount(eventId);

    return {
      eventId: event.event_id,
      eventName: event.event_name,
      total: counts.total,
      present: counts.present,
      absent: counts.absent
    };
  }

};
