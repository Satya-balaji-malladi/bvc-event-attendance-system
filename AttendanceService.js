/**
 * Service for handling student attendance for events.
 * Responsibilities: Marking attendance, deletion, retrieving and summarizing attendance data.
 */
const AttendanceService = {

  // ------------------------------
  // Internal helpers (private)
  // ------------------------------
  _tryWrap: function(methodName, failureMessage, fn) {
    // Supports both call styles:
    // 1) _tryWrap(methodName, fn)
    // 2) _tryWrap(methodName, failureMessage, fn)
    if (typeof failureMessage === 'function') {
      fn = failureMessage;
      failureMessage = (CONFIG.MESSAGES && CONFIG.MESSAGES.ATTENDANCE_MARK_FAILED) ? CONFIG.MESSAGES.ATTENDANCE_MARK_FAILED : 'Attendance action failed.';
    }

    try {
      return fn();
    } catch (error) {
      Logger.log('AttendanceService.' + methodName + ' error: ' + (error && error.message ? error.message : error));
      return Utils.buildResponse(false, failureMessage);
    }
  },

  _getAttendanceColumn: function(maybeConfigKey, fallbackKey) {
    // Centralize “use CONFIG columns if present” behavior to reduce mixed hardcoding.
    // Supports cases where CONFIG.COLUMNS does not include the key.
    if (CONFIG && CONFIG.COLUMNS && maybeConfigKey && CONFIG.COLUMNS[maybeConfigKey]) {
      return CONFIG.COLUMNS[maybeConfigKey];
    }
    if (typeof fallbackKey === 'string' && fallbackKey.length > 0) return fallbackKey;
    return maybeConfigKey;
  },

  _sortByAttendanceTimeDesc: function(list) {
    if (!Array.isArray(list)) return [];

    const timeKey = this._getAttendanceColumn('ATTENDANCE_TIME', 'attendance_time');

    return list.slice().sort((a, b) => {
      const valA = a && (a.Timestamp || a.Date || a[timeKey]);
      const valB = b && (b.Timestamp || b.Date || b[timeKey]);
      const ta = valA ? new Date(valA).getTime() : 0;
      const tb = valB ? new Date(valB).getTime() : 0;
      return tb - ta;
    });
  },

  _getDeletionFlagKey: function() {
    if (CONFIG.COLUMNS && CONFIG.COLUMNS.DELETION_FLAG) return CONFIG.COLUMNS.DELETION_FLAG;
    return 'Deletion Flag';
  },

  _getUpdatedByKey: function() {
    if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_BY) return CONFIG.COLUMNS.UPDATED_BY;
    return 'Updated By';
  },

  _getUpdatedAtKey: function() {
    if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_AT) return CONFIG.COLUMNS.UPDATED_AT;
    return 'Updated At';
  },

  _getLastActionKeys: function() {
    if (CONFIG.COLUMNS && CONFIG.COLUMNS.LAST_ACTION && CONFIG.COLUMNS.LAST_ACTION_BY && CONFIG.COLUMNS.LAST_ACTION_AT) {
      return {
        lastAction: CONFIG.COLUMNS.LAST_ACTION,
        lastActionBy: CONFIG.COLUMNS.LAST_ACTION_BY,
        lastActionAt: CONFIG.COLUMNS.LAST_ACTION_AT
      };
    }
    return {
      lastAction: 'Last Action',
      lastActionBy: 'Last Action By',
      lastActionAt: 'Last Action At'
    };
  },

  _isDeletedAttendance: function(record) {
    if (!record) return false;
    const deletionKey = this._getDeletionFlagKey();
    return Boolean(record[deletionKey]);
  },

  _filterDeletedAttendance: function(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(r => !this._isDeletedAttendance(r));
  },

  _normalizeAttendancePayload: function(attendanceData) {
    // Backward compatibility: support both snake_case and camelCase keys
    if (!attendanceData || typeof attendanceData !== 'object') return {};

    const eventId = attendanceData.event_id !== undefined ? attendanceData.event_id : attendanceData.eventId;
    const rollNumber = attendanceData.roll_number !== undefined ? attendanceData.roll_number : attendanceData.rollNumber;
    const attendanceMethod = attendanceData.attendance_method !== undefined ? attendanceData.attendance_method : attendanceData.attendanceMethod;

    // Keep original keys for any existing logic that depends on them.
    return {
      ...attendanceData,
      // keys expected by ValidationService.validateAttendance()
      eventId: eventId,
      rollNumber: rollNumber,
      attendanceMethod: attendanceMethod,
      // keys used by existing frontend/backend logic
      event_id: eventId,
      roll_number: rollNumber
    };
  },

  _getActionUser: function(userId) {
    try {
      if (!userId) return null;

      const userIdKey = (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_ID) ? CONFIG.COLUMNS.USER_ID : 'user_id';
      const users = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, userIdKey, userId) || [];
      return users.length > 0 ? users[0] : null;
    } catch (e) {
      Logger.log('AttendanceService._getActionUser error: ' + (e && e.message ? e.message : e));
      return null;
    }
  },

  _getUserIdFromUser: function(user) {
    if (!user) return null;
    // Only use the authorization inputs that exist; never reference an undefined local var.
    return user.user_id || user.userId || (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_ID ? user[CONFIG.COLUMNS.USER_ID] : null);
  },

  _validateCoordinatorAccess: function(userId, eventId) {
    // Delegate authorization directly to CoordinatorService as the single source of truth
    if (!userId || !eventId) return false;
    return CoordinatorService.canManageEvent(userId, eventId);
  },

  _validateAttendanceWindow: function(eventId) {
    try {
      if (typeof EventService.isAttendanceOpen === 'function') {
        const open = EventService.isAttendanceOpen(eventId);
        if (!open) {
          if (CONFIG.MESSAGES && CONFIG.MESSAGES.ATTENDANCE_WINDOW_CLOSED) {
            return Utils.buildResponse(false, CONFIG.MESSAGES.ATTENDANCE_WINDOW_CLOSED);
          }
          return Utils.buildResponse(false, 'Attendance window is closed.');
        }
      }

      if (typeof EventService.canScanAttendance === 'function') {
        const can = EventService.canScanAttendance(eventId);
        if (!can) {
          if (CONFIG.MESSAGES && CONFIG.MESSAGES.ATTENDANCE_WINDOW_CLOSED) {
            return Utils.buildResponse(false, CONFIG.MESSAGES.ATTENDANCE_WINDOW_CLOSED);
          }
          return Utils.buildResponse(false, 'Attendance cannot be recorded at this time.');
        }
      }
    } catch (e) {
      Logger.log('AttendanceService._validateAttendanceWindow error: ' + (e && e.message ? e.message : e));
    }

    return null;
  },

  _getActiveAttendanceIndex: function() {
    // Read attendance sheet once per call.
    const allAttendance = DatabaseService.readAllRows(CONFIG.SHEETS.ATTENDANCE) || [];
    const active = this._filterDeletedAttendance(allAttendance);

    const idx = {};
    const eventKey = this._getAttendanceColumn('EVENT_ID', 'event_id');
    const rollKey = this._getAttendanceColumn('ROLL_NUMBER', 'roll_number');

    active.forEach(r => {
      const k = String(r[eventKey]).trim() + '|' + String(r[rollKey]).trim().toUpperCase();
      idx[k] = true;
    });

    return { active, idx };
  },

  // ------------------------------
  // Public methods (existing API)
  // ------------------------------

  /**
   * Checks if an attendance record already exists for a given event and student.
   * @param {string} eventId
   * @param {string} rollNumber
   * @returns {boolean} True if attendance exists.
   */
  checkAttendanceExists: function(eventId, rollNumber) {
    return this._tryWrap('checkAttendanceExists', () => {
      if (!eventId || !rollNumber) return false;

      const { idx } = this._getActiveAttendanceIndex();
      const eventKey = this._getAttendanceColumn('EVENT_ID', 'event_id');
      const rollKey = this._getAttendanceColumn('ROLL_NUMBER', 'roll_number');

      const k = String(eventId).trim() + '|' + String(rollNumber).trim().toUpperCase();
      return Boolean(idx[k]);
    });
  },

  /**
   * Marks attendance for a student at an event.
   * @param {object} attendanceData
   * @param {string} userId - Injected by SessionService
   * @returns {object} Standard response object.
   */
  markAttendance: function(attendanceData, userId) {
    return this._tryWrap(
      'markAttendance',
      CONFIG.MESSAGES && CONFIG.MESSAGES.ATTENDANCE_MARK_FAILED ? CONFIG.MESSAGES.ATTENDANCE_MARK_FAILED : 'Attendance marking failed.',
      () => {
        const startTime = Date.now();
        Logger.log('[START] AttendanceService.markAttendance | User: ' + userId);

        const normalized = this._normalizeAttendancePayload(attendanceData);

        // ValidationService expects camelCase based on current file.
        const validationResult = ValidationService.validateAttendance({
          eventId: normalized.eventId,
          rollNumber: normalized.rollNumber,
          attendanceMethod: normalized.attendanceMethod
        });

        if (!validationResult.valid) {
          Logger.log('[END] AttendanceService.markAttendance | Validation failed');
          return Utils.buildResponse(false, validationResult.errors.join(' '));
        }

        const eventId = normalized.event_id;
        const rollNumber = String(normalized.roll_number).trim().toUpperCase();

        // 1. Authorization Check (Performance improvement: read once and reuse)
        Logger.log('[START] Authorization Check');
        const isAuthorized = this._validateCoordinatorAccess(userId, eventId);
        Logger.log('[END] Authorization Check | Result: ' + isAuthorized);

        if (!isAuthorized) {
          if (CONFIG.MESSAGES && CONFIG.MESSAGES.UNAUTHORIZED) {
            return Utils.buildResponse(false, CONFIG.MESSAGES.UNAUTHORIZED);
          }
          return Utils.buildResponse(false, 'Unauthorized access.');
        }

        // 2. Attendance Validation
        Logger.log('[START] Attendance Validation');
        
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

        // Attendance window validation
        const windowResult = this._validateAttendanceWindow(eventId);
        if (windowResult) return windowResult;

        // Reject completed/cancelled events
        if (event.status === CONFIG.EVENT_STATUS.COMPLETED) {
          return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_ALREADY_COMPLETED);
        }
        if (event.status === CONFIG.EVENT_STATUS.CANCELLED) {
          if (CONFIG.MESSAGES && CONFIG.MESSAGES.EVENT_CANCELLED) {
            return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_CANCELLED);
          }
          return Utils.buildResponse(false, 'Attendance cannot be recorded for cancelled events.');
        }

        // Reject inactive student
        if (student.status && student.status !== CONFIG.USER_STATUS.ACTIVE) {
          if (CONFIG.MESSAGES && CONFIG.MESSAGES.STUDENT_INACTIVE) {
            return Utils.buildResponse(false, CONFIG.MESSAGES.STUDENT_INACTIVE);
          }
          return Utils.buildResponse(false, 'Student is inactive.');
        }

        // Sprint 1 Rules: Check Fixed/Open eligibility
        const attendanceType = event.attendance_type || event.attendanceType || 'Fixed';
        if (attendanceType === 'Fixed') {
          const parts = DatabaseService.findByColumn(CONFIG.SHEETS.EVENT_PARTICIPANTS, 'Event ID', eventId) || [];
          const isPart = parts.find(p =>
            String(p['Roll Number'] || p.roll_number || p.rollNumber).trim().toUpperCase() === rollNumber &&
            (p['Registration Status'] === 'Confirmed' || p.status === 'Active')
          );
          if (!isPart) {
            if (CONFIG.MESSAGES && CONFIG.MESSAGES.STUDENT_NOT_ACTIVE_PARTICIPANT) {
              return Utils.buildResponse(false, CONFIG.MESSAGES.STUDENT_NOT_ACTIVE_PARTICIPANT);
            }
            return Utils.buildResponse(false, 'Student is not an active participant for this Fixed event.');
          }
        }
        Logger.log('[END] Attendance Validation');

        // 3. Duplicate Check
        Logger.log('[START] Duplicate Check');
        const { idx } = this._getActiveAttendanceIndex();
        const duplicateKey = String(eventId).trim() + '|' + String(rollNumber).trim().toUpperCase();
        if (idx[duplicateKey]) {
          return Utils.buildResponse(false, CONFIG.MESSAGES.ATTENDANCE_ALREADY_EXISTS);
        }
        Logger.log('[END] Duplicate Check');

        // Determine status
        let status = normalized.status || CONFIG.ATTENDANCE_STATUS.PRESENT;
        if (status !== CONFIG.ATTENDANCE_STATUS.PRESENT && status !== CONFIG.ATTENDANCE_STATUS.ABSENT) {
          return Utils.buildResponse(false, CONFIG.MESSAGES.INVALID_ATTENDANCE_STATUS);
        }

        // 4. Attendance Save
        Logger.log('[START] Attendance Save');
        const now = new Date();

        const newAttendance = {
          [this._getAttendanceColumn('EVENT_ID', 'Event ID')]: eventId,
          [this._getAttendanceColumn('ROLL_NUMBER', 'Roll Number')]: rollNumber,
          [this._getAttendanceColumn('USER_ID', 'User ID')]: userId,
          [this._getAttendanceColumn('ATTENDANCE_STATUS', 'Attendance Status')]: status,
          [this._getAttendanceColumn('ATTENDANCE_METHOD', 'Attendance Method')]: normalized.attendanceMethod || 'Barcode',
          'Date': Utils.formatDate(now),
          'Time': Utilities.formatDate(now, CONFIG.DATE_TIME.TIMEZONE || 'Asia/Kolkata', 'HH:mm:ss'),
          'Timestamp': now.toISOString(),
          'Is Undo': false,
          'Correction Requested': false
        };

        const success = DatabaseService.insertRow(CONFIG.SHEETS.ATTENDANCE, newAttendance);
        Logger.log('[END] Attendance Save | Success: ' + success);

        if (success) {
          const resp = Utils.buildResponse(true, CONFIG.MESSAGES.ATTENDANCE_MARKED, { attendance: newAttendance });
          try {
            AuditService.logAction(
              userId,
              'AttendanceService',
              'MARK_ATTENDANCE',
              eventId,
              'Attendance',
              'Attendance marked',
              '',
              'SUCCESS',
              userId
            );
          } catch (error) {
            Logger.log('Audit Log Error: ' + error.message);
          }
          try {
            NotificationService.createNotification({
              user_id: userId,
              title: 'Attendance Marked',
              message: 'Attendance marked for event ' + eventId + ' (Roll ' + rollNumber + ').',
              type: 'Attendance',
              related_event_id: eventId
            });
          } catch (error) {
            Logger.log('Notification Error: ' + error.message);
          }
          Logger.log('[END] AttendanceService.markAttendance | Execution Time: ' + (Date.now() - startTime) + 'ms');
          return resp;
        }

        Logger.log('[END] AttendanceService.markAttendance | Execution Time: ' + (Date.now() - startTime) + 'ms');
        return Utils.buildResponse(false, CONFIG.MESSAGES.ATTENDANCE_MARK_FAILED);
      }
    );
  },

  /**
   * Deletes an attendance record.
   * @param {string} attendanceId
   * @param {string} userId - Injected by SessionService
   * @returns {object} Standard response object.
   */
  deleteAttendance: function(attendanceId, userId) {
    return this._tryWrap(
      'deleteAttendance',
      CONFIG.MESSAGES && CONFIG.MESSAGES.ATTENDANCE_DELETE_FAILED ? CONFIG.MESSAGES.ATTENDANCE_DELETE_FAILED : 'Attendance deletion failed.',
      () => {
        const startTime = Date.now();
        Logger.log('[START] AttendanceService.deleteAttendance | Attendance ID: ' + attendanceId);

        const sheetName = CONFIG.SHEETS.ATTENDANCE;

        const attendanceRecord = this.getAttendanceById(attendanceId);
        if (!attendanceRecord) {
          return Utils.buildResponse(false, CONFIG.MESSAGES.ATTENDANCE_NOT_FOUND);
        }

        const attendanceEventId = attendanceRecord[this._getAttendanceColumn('EVENT_ID', 'event_id')] || attendanceRecord.event_id;
        
        // Authorization Check via central service
        Logger.log('[START] Authorization Check');
        const isAuthorized = this._validateCoordinatorAccess(userId, attendanceEventId);
        Logger.log('[END] Authorization Check | Result: ' + isAuthorized);

        if (!isAuthorized) {
          if (CONFIG.MESSAGES && CONFIG.MESSAGES.UNAUTHORIZED) {
            return Utils.buildResponse(false, CONFIG.MESSAGES.UNAUTHORIZED);
          }
          return Utils.buildResponse(false, 'Unauthorized access.');
        }

        const event = EventService.getEventById(attendanceEventId);
        if (event && event.status === CONFIG.EVENT_STATUS.COMPLETED) {
          return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_ALREADY_COMPLETED);
        }
        if (event && event.status === CONFIG.EVENT_STATUS.CANCELLED) {
          if (CONFIG.MESSAGES && CONFIG.MESSAGES.EVENT_CANCELLED) {
            return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_CANCELLED);
          }
          return Utils.buildResponse(false, 'Cannot delete attendance for cancelled events.');
        }

        // Soft delete updates
        const deletionKey = this._getDeletionFlagKey();
        const updatedByKey = this._getUpdatedByKey();
        const updatedAtKey = this._getUpdatedAtKey();
        const lastKeys = this._getLastActionKeys();
        const ts = Utils.getCurrentTimestamp();

        const updateData = {
          [deletionKey]: true,
          [updatedByKey]: userId,
          [updatedAtKey]: ts,
          [lastKeys.lastAction]: 'Deleted',
          [lastKeys.lastActionBy]: userId,
          [lastKeys.lastActionAt]: ts
        };

        const attendanceIdKey = this._getAttendanceColumn('ATTENDANCE_ID', 'attendance_id');
        
        Logger.log('[START] Attendance Save (Soft Delete Update)');
        const success = DatabaseService.updateRow(sheetName, attendanceIdKey, attendanceId, updateData);
        Logger.log('[END] Attendance Save (Soft Delete Update) | Success: ' + success);

        if (success) {
          const resp = Utils.buildResponse(true, CONFIG.MESSAGES.ATTENDANCE_DELETED);
          try {
            AuditService.logAction(
              userId,
              'AttendanceService',
              'DELETE_ATTENDANCE',
              attendanceId,
              'Attendance',
              'Attendance deleted',
              '',
              'SUCCESS',
              userId
            );
          } catch (error) {
            Logger.log('Audit Log Error: ' + error.message);
          }
          Logger.log('[END] AttendanceService.deleteAttendance | Execution Time: ' + (Date.now() - startTime) + 'ms');
          return resp;
        }

        Logger.log('[END] AttendanceService.deleteAttendance | Execution Time: ' + (Date.now() - startTime) + 'ms');
        return Utils.buildResponse(false, CONFIG.MESSAGES.ATTENDANCE_DELETE_FAILED);
      }
    );
  },

  /**
   * Retrieves an attendance record by ID.
   * @param {string} attendanceId
   * @returns {object|null}
   */
  getAttendanceById: function(attendanceId) {
    return this._tryWrap('getAttendanceById', () => {
      if (!attendanceId) return null;
      const idKey = this._getAttendanceColumn('ATTENDANCE_ID', 'attendance_id');
      const records = DatabaseService.findByColumn(CONFIG.SHEETS.ATTENDANCE, idKey, attendanceId) || [];
      if (records.length === 0) return null;
      const rec = records[0];
      return this._isDeletedAttendance(rec) ? null : rec;
    });
  },

  /**
   * Retrieves attendance records by Event ID.
   * @param {string} eventId
   * @returns {object[]}
   */
  getAttendanceByEvent: function(eventId) {
    return this._tryWrap('getAttendanceByEvent', () => {
      if (!eventId) return [];
      const eventKey = this._getAttendanceColumn('EVENT_ID', 'event_id');
      const list = DatabaseService.findByColumn(CONFIG.SHEETS.ATTENDANCE, eventKey, eventId) || [];
      return this._sortByAttendanceTimeDesc(this._filterDeletedAttendance(list));
    });
  },

  /**
   * Retrieves attendance records by Student Roll Number.
   * @param {string} rollNumber
   * @returns {object[]}
   */
  getAttendanceByStudent: function(rollNumber) {
    return this._tryWrap('getAttendanceByStudent', () => {
      if (!rollNumber) return [];
      const rollKey = this._getAttendanceColumn('ROLL_NUMBER', 'roll_number');
      const normalizedRoll = String(rollNumber).trim().toUpperCase();
      const list = DatabaseService.findByColumn(CONFIG.SHEETS.ATTENDANCE, rollKey, normalizedRoll) || [];
      return this._sortByAttendanceTimeDesc(this._filterDeletedAttendance(list));
    });
  },

  /**
   * Retrieves attendance records by Date.
   * @param {string} date
   * @returns {object[]}
   */
  getAttendanceByDate: function(date) {
    return this._tryWrap('getAttendanceByDate', () => {
      if (!date) return [];
      const targetDate = Utils.formatDate(date);
      const allAttendance = DatabaseService.readAllRows(CONFIG.SHEETS.ATTENDANCE) || [];
      const active = this._filterDeletedAttendance(allAttendance);

      const dateKey = 'Date';
      const timeKey = this._getAttendanceColumn('ATTENDANCE_TIME', 'attendance_time');
      const filtered = active.filter(record => {
        const val = record[dateKey] || record['Timestamp'] || record[timeKey];
        return Utils.formatDate(val) === targetDate;
      });

      return this._sortByAttendanceTimeDesc(filtered);
    });
  },

  /**
   * Retrieves attendance records by Status.
   * @param {string} status
   * @returns {object[]}
   */
  getAttendanceByStatus: function(status) {
    return this._tryWrap('getAttendanceByStatus', () => {
      if (!status) return [];
      const statusKey = this._getAttendanceColumn('ATTENDANCE_STATUS', 'Attendance Status');
      const list = DatabaseService.findByColumn(CONFIG.SHEETS.ATTENDANCE, statusKey, status) || [];
      return this._sortByAttendanceTimeDesc(this._filterDeletedAttendance(list));
    });
  },

  /**
   * Gets the attendance counts for an event.
   * @param {string} eventId
   * @returns {object} {total, present, absent}
   */
  getEventAttendanceCount: function(eventId) {
    return this._tryWrap('getEventAttendanceCount', () => {
      const records = this.getAttendanceByEvent(eventId);
      let present = 0;
      let absent = 0;

      const statusKey = this._getAttendanceColumn('ATTENDANCE_STATUS', 'Attendance Status');

      records.forEach(record => {
        if (record[statusKey] === CONFIG.ATTENDANCE_STATUS.PRESENT) present++;
        else if (record[statusKey] === CONFIG.ATTENDANCE_STATUS.ABSENT) absent++;
      });

      return { total: records.length, present: present, absent: absent };
    });
  },

  /**
   * Gets the total attendance records count for a student.
   * @param {string} rollNumber
   * @returns {number} Total attendance records count.
   */
  getStudentAttendanceCount: function(rollNumber) {
    return this._tryWrap('getStudentAttendanceCount', () => {
      const records = this.getAttendanceByStudent(rollNumber);
      return records.length;
    });
  },

  /**
   * Gets the summarized attendance data for a student.
   * @param {string} rollNumber
   * @returns {object} {totalEvents, present, absent}
   */
  getStudentAttendanceSummary: function(rollNumber) {
    return this._tryWrap('getStudentAttendanceSummary', () => {
      const records = this.getAttendanceByStudent(rollNumber);
      let present = 0;
      let absent = 0;

      const statusKey = this._getAttendanceColumn('ATTENDANCE_STATUS', 'Attendance Status');

      records.forEach(record => {
        if (record[statusKey] === CONFIG.ATTENDANCE_STATUS.PRESENT) present++;
        else if (record[statusKey] === CONFIG.ATTENDANCE_STATUS.ABSENT) absent++;
      });

      return { totalEvents: records.length, present: present, absent: absent };
    });
  },

  /**
   * Gets overall attendance statistics across all events.
   * @returns {object} {totalAttendance, present, absent, attendancePercentage}
   */
  getOverallAttendanceStatistics: function() {
    return this._tryWrap('getOverallAttendanceStatistics', () => {
      const allAttendance = DatabaseService.readAllRows(CONFIG.SHEETS.ATTENDANCE) || [];
      const active = this._filterDeletedAttendance(allAttendance);

      let present = 0;
      let absent = 0;

      const statusKey = this._getAttendanceColumn('ATTENDANCE_STATUS', 'Attendance Status');

      active.forEach(record => {
        if (record[statusKey] === CONFIG.ATTENDANCE_STATUS.PRESENT) present++;
        else if (record[statusKey] === CONFIG.ATTENDANCE_STATUS.ABSENT) absent++;
      });

      const totalAttendance = active.length;
      const percentage = totalAttendance === 0 ? 0 : (present / totalAttendance) * 100;

      return {
        totalAttendance: totalAttendance,
        present: present,
        absent: absent,
        attendancePercentage: Number(percentage.toFixed(2))
      };
    });
  },

  /**
   * Gets an attendance summary for a specific event.
   * @param {string} eventId
   * @returns {object|null} Summary object or null if event not found.
   */
  getAttendanceSummaryByEvent: function(eventId) {
    return this._tryWrap('getAttendanceSummaryByEvent', () => {
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
    });
  }

};