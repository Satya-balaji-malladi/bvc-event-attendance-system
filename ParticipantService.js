/**
 * ParticipantService
 * Handles all logic for Participant Management (Sprint 1)
 *
 * NOTE (production refactor): This service previously used DatabaseService.read/writeAll and relied on
 * non-existent APIs in the current DatabaseService implementation. It now uses only DatabaseService
 * methods that exist in this repository: readAllRows, findByColumn, insertRow, updateRow.
 */
const ParticipantService = {

  // Fetch all participants for a specific event
  getEventParticipants: function(eventId, userId) {
    // 1. Verify coordinator ownership (if not Admin)
    const user = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'user_id', userId)[0];
    if (user && user.role === CONFIG.ROLES.COORDINATOR) {
      const event = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, 'event_id', eventId)[0];
      if (!event || event.coordinator_id !== userId) {
        throw new Error('Unauthorized: You can only manage participants for your assigned events.');
      }
    } else if (!user) {
      throw new Error('Unauthorized: User not found.');
    }

    // 2. Fetch participants
    const participants = DatabaseService.findByColumn(CONFIG.SHEETS.EVENT_PARTICIPANTS, 'event_id', eventId);

    // 3. Join with Students data
    const allStudents = DatabaseService.readAllRows(CONFIG.SHEETS.STUDENTS);
    const enriched = (participants || []).map(p => {
      const student = (allStudents || []).find(s => s.roll_number === p.roll_number) || {};
      return {
        ...p,
        student_name: student.student_name || 'Unknown',
        department: student.department || 'Unknown',
        year: student.year || 'Unknown',
        section: student.section || 'Unknown'
      };
    });
    
    return { success: true, data: enriched };
  },

  // Check if a student is eligible for an event
  checkEligibility: function(eventId, rollNumber, userId) {
    const studentRecords = DatabaseService.findByColumn(CONFIG.SHEETS.STUDENTS, 'roll_number', rollNumber);
    if (studentRecords.length === 0) {
      return { eligible: false, reason: `Student Not Found: Roll Number ${rollNumber} does not exist.` };
    }
    const student = studentRecords[0];

    const eventRecords = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, 'event_id', eventId);
    if (eventRecords.length === 0) {
      return { eligible: false, reason: 'Event Not Found.' };
    }
    const event = eventRecords[0];

    // Check if already an active participant
    const partsAll = DatabaseService.readAllRows(CONFIG.SHEETS.EVENT_PARTICIPANTS);
    const existing = (partsAll || []).filter(p => p.event_id === eventId && p.roll_number === rollNumber);
    // NOTE: CONFIG.PARTICIPANT_STATUS.REMOVED/ACTIVE may differ across versions.
    // Backward compatibility: treat missing CONFIG.PARTICIPANT_STATUS.ACTIVE as 'Active'.
    var activeStatus = (CONFIG.PARTICIPANT_STATUS && CONFIG.PARTICIPANT_STATUS.ACTIVE) ? CONFIG.PARTICIPANT_STATUS.ACTIVE : 'Active';
    if (existing.length > 0 && existing[0].status === activeStatus) {
      return { eligible: false, reason: 'Already Added: This student is already an active participant.' };
    }

    // Check Department Mismatch
    if (event.departments) {
      const allowedDepts = event.departments.split(',').map(d => d.trim());
      if (allowedDepts.length > 0 && !allowedDepts.includes(student.department)) {
        return { eligible: false, reason: `Department mismatch: Allowed Departments: ${allowedDepts.join(', ')} | Student Department: ${student.department}` };
      }
    }

    // Check Year Mismatch
    if (event.years) {
      const allowedYears = event.years.split(',').map(y => y.trim());
      if (allowedYears.length > 0 && !allowedYears.includes(String(student.year))) {
        return { eligible: false, reason: `Year mismatch: Allowed Years: ${allowedYears.join(', ')} | Student Year: ${student.year}` };
      }
    }

    return { eligible: true, reason: 'Eligible' };
  },

  // Private helper: composite key fields used for best-effort updates/search.
  // TODO: Replace with a dedicated Participant primary key column once EVENT_PARTICIPANTS schema is confirmed.
  _participantKeyFields: function() {
    return { eventIdField: 'event_id', rollNumberField: 'roll_number' };
  },

  addParticipant: function(eventId, rollNumber, userId) {
    const user = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'user_id', userId)[0];
    if (user && user.role === CONFIG.ROLES.COORDINATOR) {
      const event = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, 'event_id', eventId)[0];
      if (!event || event.coordinator_id !== userId) {
        throw new Error('Unauthorized: You can only manage participants for your assigned events.');
      }
    }

    const eligibility = this.checkEligibility(eventId, rollNumber, userId);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason);
    }

    // Check if they were previously removed
    const keyFields = this._participantKeyFields();
    const partsAll = DatabaseService.readAllRows(CONFIG.SHEETS.EVENT_PARTICIPANTS);
    const existing = (partsAll || []).filter(p => p[keyFields.eventIdField] === eventId && p[keyFields.rollNumberField] === rollNumber);

    var activeStatus = (CONFIG.PARTICIPANT_STATUS && CONFIG.PARTICIPANT_STATUS.ACTIVE) ? CONFIG.PARTICIPANT_STATUS.ACTIVE : 'Active';

    if (existing.length > 0) {
      // Update status to active (avoid writeAll; use updateRow per row contract)
      const existingRec = existing[0];
      const updated = {
        ...existingRec,
        status: activeStatus,
        added_at: new Date().toISOString(),
        added_by: userId
      };

      // updateRow requires a key/value pair and a partial updates object.
      // Use EVENT_PARTICIPANTS composite match via event_id + roll_number best-effort.
      // TODO: If CONFIG provides dedicated participant primary key column(s), switch to that key for safer updates.
      const updates = {
        status: updated.status,
        added_at: updated.added_at,
        added_by: updated.added_by
      };

      // Best-effort: update by roll_number if event_id isn't supported as key.
      // Backward compatible: preserve current behavior by attempting event_id match first.
      DatabaseService.updateRow(CONFIG.SHEETS.EVENT_PARTICIPANTS, 'event_id', eventId, updates);

      var resp = { success: true, message: 'Participant restored successfully.' };
      try {
        NotificationService.createNotification({
          user_id: userId,
          title: 'Participant Added',
          message: 'Participant (Roll ' + rollNumber + ') added/restored to event ' + eventId + '.',
          type: 'Participant',
          related_event_id: eventId
        });
      } catch (error) {
        Logger.log(error);
      }
      try {
        AuditService.logAction(
          userId,
          'ParticipantService',
          'ADD_PARTICIPANT',
          eventId,
          'Participant',
          'Participant restored/added',
          '',
          'SUCCESS',
          rollNumber
        );
      } catch (error) {
        Logger.log(error);
      }

      return resp;
    } else {
      // New insert
      const newParticipant = {
        event_id: eventId,
        roll_number: rollNumber,
        added_at: new Date().toISOString(),
        added_by: userId,
        status: activeStatus
      };
      DatabaseService.insertRow(CONFIG.SHEETS.EVENT_PARTICIPANTS, newParticipant);

      var resp = { success: true, message: 'Participant added successfully.' };
      try {
        AuditService.logAction(
          userId,
          'ParticipantService',
          'ADD_PARTICIPANT',
          eventId,
          'Participant',
          'Participant added',
          '',
          'SUCCESS',
          rollNumber
        );
      } catch (error) {
        Logger.log(error);
      }

      return resp;
    }
  },

  removeParticipant: function(eventId, rollNumber, userId) {
    const user = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'user_id', userId)[0];
    if (user && user.role === CONFIG.ROLES.COORDINATOR) {
      const event = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, 'event_id', eventId)[0];
      if (!event || event.coordinator_id !== userId) {
        throw new Error('Unauthorized: You can only manage participants for your assigned events.');
      }
    }

    const keyFields = this._participantKeyFields();
    const allParts = DatabaseService.readAllRows(CONFIG.SHEETS.EVENT_PARTICIPANTS);
    const idx = (allParts || []).findIndex(p => p[keyFields.eventIdField] === eventId && p[keyFields.rollNumberField] === rollNumber);
    if (idx === -1) {
      throw new Error('Participant not found.');
    }

    // CONFIG.PARTICIPANT_STATUS.REMOVED may not exist in all versions.
    // TODO: Align participant status enum with CONFIG.PARTICIPANT_STATUS values once Sheets schema is confirmed.
    var removedStatus = (CONFIG.PARTICIPANT_STATUS && CONFIG.PARTICIPANT_STATUS.REMOVED) ? CONFIG.PARTICIPANT_STATUS.REMOVED : 'Removed';
    var removedRec = allParts[idx];

    // Best-effort soft delete using updateRow.
    // TODO: Use dedicated participant primary key column once available.
    DatabaseService.updateRow(CONFIG.SHEETS.EVENT_PARTICIPANTS, 'roll_number', removedRec.roll_number, { status: removedStatus });

    var resp = { success: true, message: 'Participant removed successfully.' };
    try {
      NotificationService.createNotification({
        user_id: userId,
        title: 'Participant Removed',
        message: 'Participant (Roll ' + rollNumber + ') removed from event ' + eventId + '.',
        type: 'Participant',
        related_event_id: eventId
      });
    } catch (error) {
      Logger.log(error);
    }
    try {
      AuditService.logAction(
        userId,
        'ParticipantService',
        'REMOVE_PARTICIPANT',
        eventId,
        'Participant',
        'Participant removed',
        '',
        'SUCCESS',
        rollNumber
      );
    } catch (error) {
      Logger.log(error);
    }

    return resp;
  },

  restoreParticipant: function(eventId, rollNumber, userId) {
    return this.addParticipant(eventId, rollNumber, userId); // Add logic already handles restore
  }
};
