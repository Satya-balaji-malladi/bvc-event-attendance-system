/**
 * ParticipantService
 * Handles all logic for Participant Management (Sprint 1)
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
    const allStudents = DatabaseService.read(CONFIG.SHEETS.STUDENTS);
    const enriched = participants.map(p => {
      const student = allStudents.find(s => s.roll_number === p.roll_number) || {};
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
    const existing = DatabaseService.read(CONFIG.SHEETS.EVENT_PARTICIPANTS).filter(p => p.event_id === eventId && p.roll_number === rollNumber);
    if (existing.length > 0 && existing[0].status === CONFIG.PARTICIPANT_STATUS.ACTIVE) {
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
    const existing = DatabaseService.read(CONFIG.SHEETS.EVENT_PARTICIPANTS).filter(p => p.event_id === eventId && p.roll_number === rollNumber);
    
    if (existing.length > 0) {
      // Update status to active
      const updated = { ...existing[0], status: CONFIG.PARTICIPANT_STATUS.ACTIVE, added_at: new Date().toISOString(), added_by: userId };
      let allParts = DatabaseService.read(CONFIG.SHEETS.EVENT_PARTICIPANTS);
      const idx = allParts.findIndex(p => p.event_id === eventId && p.roll_number === rollNumber);
      allParts[idx] = updated;
      DatabaseService.writeAll(CONFIG.SHEETS.EVENT_PARTICIPANTS, allParts);
      return { success: true, message: 'Participant restored successfully.' };
    } else {
      // New insert
      const newParticipant = {
        event_id: eventId,
        roll_number: rollNumber,
        added_at: new Date().toISOString(),
        added_by: userId,
        status: CONFIG.PARTICIPANT_STATUS.ACTIVE
      };
      DatabaseService.insertRow(CONFIG.SHEETS.EVENT_PARTICIPANTS, newParticipant);
      return { success: true, message: 'Participant added successfully.' };
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

    let allParts = DatabaseService.read(CONFIG.SHEETS.EVENT_PARTICIPANTS);
    const idx = allParts.findIndex(p => p.event_id === eventId && p.roll_number === rollNumber);
    if (idx === -1) {
      throw new Error('Participant not found.');
    }
    
    allParts[idx].status = CONFIG.PARTICIPANT_STATUS.REMOVED;
    DatabaseService.writeAll(CONFIG.SHEETS.EVENT_PARTICIPANTS, allParts);
    return { success: true, message: 'Participant removed successfully.' };
  },

  restoreParticipant: function(eventId, rollNumber, userId) {
    return this.addParticipant(eventId, rollNumber, userId); // Add logic already handles restore
  }
};
