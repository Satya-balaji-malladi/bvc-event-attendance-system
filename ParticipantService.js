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
    const user = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, CONFIG.COLUMNS.USER_ID || 'User ID', userId)[0];
    if (user && user[CONFIG.COLUMNS.ROLE || 'Role'] === CONFIG.ROLES.COORDINATOR) {
      const event = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, CONFIG.COLUMNS.EVENT_ID || 'Event ID', eventId)[0];
      if (!event || event[CONFIG.COLUMNS.COORDINATOR_ID || 'Organizer'] !== userId) {
        throw new Error('Unauthorized: You can only manage participants for your assigned events.');
      }
    } else if (!user) {
      throw new Error('Unauthorized: User not found.');
    }

    // 2. Fetch participants
    const participants = DatabaseService.findByColumn(CONFIG.SHEETS.EVENT_PARTICIPANTS, 'Event ID', eventId);

    // 3. Join with Students data
    const allStudents = DatabaseService.readAllRows(CONFIG.SHEETS.STUDENTS);
    const enriched = (participants || []).map(p => {
      const student = (allStudents || []).find(s => s['Roll Number'] === p['Roll Number']) || {};
      return {
        ...p,
        student_name: student['Student Name'] || 'Unknown',
        department: student['Department ID'] || 'Unknown',
        year: student['Year'] || 'Unknown',
        section: student['Section'] || 'Unknown'
      };
    });
    
    return { success: true, data: enriched };
  },

  // Check if a student is eligible for an event
  checkEligibility: function(eventId, rollNumber, userId) {
    const studentRecords = DatabaseService.findByColumn(CONFIG.SHEETS.STUDENTS, 'Roll Number', rollNumber);
    if (studentRecords.length === 0) {
      return { eligible: false, reason: `Student Not Found: Roll Number ${rollNumber} does not exist.` };
    }
    const student = studentRecords[0];

    const eventRecords = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, 'Event ID', eventId);
    if (eventRecords.length === 0) {
      return { eligible: false, reason: 'Event Not Found.' };
    }
    const event = eventRecords[0];

    // Check if already an active participant
    const partsAll = DatabaseService.readAllRows(CONFIG.SHEETS.EVENT_PARTICIPANTS);
    const existing = (partsAll || []).filter(p => p['Event ID'] === eventId && p['Roll Number'] === rollNumber);
    
    // Physical sheet validation restricts Status to 'Confirmed', 'Waitlisted', 'Cancelled'.
    // We treat 'Confirmed' as the active registration status.
    const activeStatus = 'Confirmed';
    if (existing.length > 0 && existing[0]['Registration Status'] === activeStatus) {
      return { eligible: false, reason: 'Already Added: This student is already an active participant.' };
    }

    // Check Department Mismatch
    if (event['Departments']) {
      const allowedDepts = event['Departments'].split(',').map(d => d.trim());
      if (allowedDepts.length > 0 && !allowedDepts.includes(student['Department ID'])) {
        return { eligible: false, reason: `Department mismatch: Allowed Departments: ${allowedDepts.join(', ')} | Student Department: ${student['Department ID']}` };
      }
    }

    // Check Year Mismatch
    if (event['Years']) {
      const allowedYears = event['Years'].split(',').map(y => y.trim());
      if (allowedYears.length > 0 && !allowedYears.includes(String(student['Year']))) {
        return { eligible: false, reason: `Year mismatch: Allowed Years: ${allowedYears.join(', ')} | Student Year: ${student['Year']}` };
      }
    }

    return { eligible: true, reason: 'Eligible' };
  },

  // Private helper: composite key fields used for best-effort updates/search.
  _participantKeyFields: function() {
    return { eventIdField: 'Event ID', rollNumberField: 'Roll Number' };
  },

  addParticipant: function(eventId, rollNumber, userId) {
    const user = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, CONFIG.COLUMNS.USER_ID || 'User ID', userId)[0];
    if (user && user[CONFIG.COLUMNS.ROLE || 'Role'] === CONFIG.ROLES.COORDINATOR) {
      const event = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, CONFIG.COLUMNS.EVENT_ID || 'Event ID', eventId)[0];
      if (!event || event[CONFIG.COLUMNS.COORDINATOR_ID || 'Organizer'] !== userId) {
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

    const activeStatus = 'Confirmed';

    if (existing.length > 0) {
      const existingRec = existing[0];
      const updates = {
        'Registration Status': activeStatus,
        'Registration Timestamp': new Date().toISOString(),
        'Created By': userId,
        'Updated At': new Date().toISOString()
      };

      DatabaseService.updateRow(CONFIG.SHEETS.EVENT_PARTICIPANTS, 'Roll Number', rollNumber, updates);

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
      // New insert matching cell validations: type must be 'Pre-Registered', status must be 'Confirmed'
      const newParticipant = {
        'Event ID': eventId,
        'Roll Number': rollNumber,
        'Registration Timestamp': new Date().toISOString(),
        'Created By': userId,
        'Registration Status': activeStatus,
        'Registration Type': 'Pre-Registered',
        'Attendance Status': 'Absent',
        'Approval Status': 'Approved',
        'Created At': new Date().toISOString(),
        'Updated At': new Date().toISOString(),
        'Deletion Flag': false
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
    const user = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, CONFIG.COLUMNS.USER_ID || 'User ID', userId)[0];
    if (user && user[CONFIG.COLUMNS.ROLE || 'Role'] === CONFIG.ROLES.COORDINATOR) {
      const event = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, CONFIG.COLUMNS.EVENT_ID || 'Event ID', eventId)[0];
      if (!event || event[CONFIG.COLUMNS.COORDINATOR_ID || 'Organizer'] !== userId) {
        throw new Error('Unauthorized: You can only manage participants for your assigned events.');
      }
    }

    const keyFields = this._participantKeyFields();
    const allParts = DatabaseService.readAllRows(CONFIG.SHEETS.EVENT_PARTICIPANTS);
    const idx = (allParts || []).findIndex(p => p[keyFields.eventIdField] === eventId && p[keyFields.rollNumberField] === rollNumber);
    if (idx === -1) {
      throw new Error('Participant not found.');
    }

    const removedStatus = 'Cancelled';
    var removedRec = allParts[idx];

    DatabaseService.updateRow(CONFIG.SHEETS.EVENT_PARTICIPANTS, 'Roll Number', removedRec['Roll Number'], { 'Registration Status': removedStatus, 'Updated At': new Date().toISOString() });

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
