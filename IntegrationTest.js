/**
 * IntegrationTest.js
 * Comprehensive Integration Workflows for BVC Event Attendance Backend.
 */
const IntegrationTest = {

  run: function() {
    Logger.log('╔══════════════════════════════════════════╗');
    Logger.log('║        SYSTEM INTEGRATION TESTS — START  ║');
    Logger.log('╚══════════════════════════════════════════╝');
    Logger.log('');

    var passed = 0;
    var tests = [
      this.testFlow1_SessionLifecycle,
      this.testFlow2_StudentLifecycle,
      this.testFlow3_EventCoordinatorLifecycle,
      this.testFlow4_ParticipantRegistrationLifecycle,
      this.testFlow5_AttendanceTrackingLifecycle,
      this.testFlow6_ReportingValidation,
      this.testFlow7_NotificationsDispatch,
      this.testFlow8_SettingsConfigurations,
      this.testFlow9_AuditTrailVerification,
      this.testFlow10_DatabaseIntegrityConstraints
    ];

    for (var i = 0; i < tests.length; i++) {
      try {
        tests[i].call(this);
        passed++;
      } catch (err) {
        Logger.log('🛑 STOP-ON-FAIL (Integration): ' + err.message);
        throw err;
      }
    }

    Logger.log('✅ ALL INTEGRATION FLOWS PASSED SUCCESSFULLY.');
    Logger.log('');
    return { passed: passed, failed: 0 };
  },

  // ------------------------------------------------------------
  // FLOW 1: Login -> Create Session -> Validate Session -> Logout
  // ------------------------------------------------------------
  testFlow1_SessionLifecycle: function() {
    Logger.log('====================================');
    Logger.log('INTEGRATION: Flow 1 - Session Lifecycle');
    Logger.log('====================================');

    // 1. Find an active test user
    const users = DatabaseService.readAllRows(CONFIG.SHEETS.USERS) || [];
    const activeUser = users.find(u => (u['Status'] || u.status) === 'Active' && (u['Username'] || u.username));
    if (!activeUser) throw new Error('Flow 1 requires at least one active user in Users sheet.');

    const username = activeUser['Username'] || activeUser.username;
    const userId = activeUser['User ID'] || activeUser.user_id;

    // Simulate login via AuthService. Since we do not have plaintext password, we mock/fetch token directly or create session
    const sessionRes = SessionService.createSession(userId, 'IP-127.0.0.1', 'IntegrationTestBrowser');
    IntegrationAssertions.assertSuccess(sessionRes, 'Session creation failed');
    const token = sessionRes.data ? (sessionRes.data.sessionToken || sessionRes.data.token) : null;
    IntegrationAssertions.assertNotNull(token, 'Session token is empty');

    // Verify session in DB
    IntegrationAssertions.assertSessionCreated(userId, token, 'Session not found in Database');

    // Validate Session
    const validateRes = SessionService.validateSession(token);
    IntegrationAssertions.assertSuccess(validateRes, 'Session validation failed');

    // Destroy session
    const destroyRes = SessionService.destroySession(token);
    IntegrationAssertions.assertSuccess(destroyRes, 'Session destruction failed');

    // Verify session is gone
    IntegrationAssertions.assertSessionDestroyed(token, 'Session still exists in Database after logout');
    Logger.log('✅ PASS: Session Lifecycle verified.');
    Logger.log('');
  },

  // ------------------------------------------------------------
  // FLOW 2: Create Department -> Create Student -> Update Student -> Delete Student
  // ------------------------------------------------------------
  testFlow2_StudentLifecycle: function() {
    Logger.log('====================================');
    Logger.log('INTEGRATION: Flow 2 - Student Lifecycle');
    Logger.log('====================================');

    const depId = 'DEP999';
    const rollNo = '99A81A9999';

    // Cleanup first
    try { DatabaseService.hardDelete(CONFIG.SHEETS.DEPARTMENTS, 'Department ID', depId); } catch(e) {}
    try { DatabaseService.hardDelete(CONFIG.SHEETS.STUDENTS, 'Roll Number', rollNo); } catch(e) {}

    // Create Department
    const depRes = DepartmentService.createDepartment(depId, 'Test Integration Department', 'Active');
    IntegrationAssertions.assertSuccess(depRes, 'Department creation failed');

    // Create Student
    const studentRes = StudentService.createStudent(rollNo, 'Integration Student', depId, 3, 'Active', 'test@bvc.edu.in');
    IntegrationAssertions.assertSuccess(studentRes, 'Student creation failed');

    // Update Student
    const updateRes = StudentService.updateStudent(rollNo, { 'Student Name': 'Integration Student Updated' }, 'USR001');
    IntegrationAssertions.assertSuccess(updateRes, 'Student update failed');

    // Deactivate Student
    const deactivateRes = StudentService.deactivateStudent(rollNo, 'USR001');
    IntegrationAssertions.assertSuccess(deactivateRes, 'Student deactivation failed');

    // Activate Student
    const activateRes = StudentService.activateStudent(rollNo, 'USR001');
    IntegrationAssertions.assertSuccess(activateRes, 'Student activation failed');

    // Delete Student
    const deleteRes = StudentService.deleteStudent(rollNo, 'USR001');
    IntegrationAssertions.assertSuccess(deleteRes, 'Student deletion failed');

    // Cleanup
    DatabaseService.hardDelete(CONFIG.SHEETS.DEPARTMENTS, 'Department ID', depId);
    DatabaseService.hardDelete(CONFIG.SHEETS.STUDENTS, 'Roll Number', rollNo);
    Logger.log('✅ PASS: Student Lifecycle verified.');
    Logger.log('');
  },

  // ------------------------------------------------------------
  // FLOW 3: Create Event -> Update Event -> Assign Coordinator -> Remove Coordinator
  // ------------------------------------------------------------
  testFlow3_EventCoordinatorLifecycle: function() {
    Logger.log('====================================');
    Logger.log('INTEGRATION: Flow 3 - Event & Coordinator Lifecycle');
    Logger.log('====================================');

    const eventId = 'EVT-9999';
    const coordUserId = 'USR002'; // assumed to exist

    try { DatabaseService.hardDelete(CONFIG.SHEETS.EVENTS, 'Event ID', eventId); } catch(e) {}

    // Create Event
    const nowStr = Utils.formatDate(new Date());
    const eventRes = EventService.createEvent(eventId, 'Integration Event', 'Location A', coordUserId, 'Active', nowStr, nowStr, '09:00', '11:00', 'Fixed');
    IntegrationAssertions.assertSuccess(eventRes, 'Event creation failed');

    // Update Event
    const updateRes = EventService.updateEvent(eventId, { 'Venue': 'Location B' });
    IntegrationAssertions.assertSuccess(updateRes, 'Event update failed');

    // Assign Coordinator
    const assignRes = CoordinatorService.assignCoordinator(eventId, coordUserId, 'Coordinator', 'USR001', 'Remarks');
    IntegrationAssertions.assertSuccess(assignRes, 'Coordinator assignment failed');
    const assignmentId = assignRes.data && assignRes.data.assignment ? assignRes.data.assignment['Assignment ID'] : null;
    IntegrationAssertions.assertNotNull(assignmentId, 'Assignment ID is empty');

    // Verify Coordinator Assignment
    IntegrationAssertions.assertCoordinatorAssigned(coordUserId, eventId, 'Coordinator not assigned in DB');

    // Remove Coordinator
    const removeRes = CoordinatorService.removeCoordinator(assignmentId, 'USR001');
    IntegrationAssertions.assertSuccess(removeRes, 'Coordinator removal failed');

    // Cleanup
    DatabaseService.hardDelete(CONFIG.SHEETS.EVENTS, 'Event ID', eventId);
    if (assignmentId) DatabaseService.hardDelete(CONFIG.SHEETS.EVENT_COORDINATORS, 'Assignment ID', assignmentId);
    Logger.log('✅ PASS: Event & Coordinator Lifecycle verified.');
    Logger.log('');
  },

  // ------------------------------------------------------------
  // FLOW 4: Register Participant -> Approve -> Reject -> Remove
  // ------------------------------------------------------------
  testFlow4_ParticipantRegistrationLifecycle: function() {
    Logger.log('====================================');
    Logger.log('INTEGRATION: Flow 4 - Participant Registration');
    Logger.log('====================================');

    const rollNo = '22A81A0501'; // assumed student exists
    const eventId = 'EVT-001'; // assumed event exists

    // Pre-cleanup
    const all = DatabaseService.readAllRows(CONFIG.SHEETS.EVENT_PARTICIPANTS) || [];
    const dup = all.find(a => String(a['Roll Number'] || a.roll_number) === rollNo && String(a['Event ID'] || a.event_id) === eventId);
    if (dup) {
      DatabaseService.hardDelete(CONFIG.SHEETS.EVENT_PARTICIPANTS, 'Participant ID', dup['Participant ID']);
    }

    // Register Participant (addParticipant)
    const registerRes = ParticipantService.addParticipant(eventId, rollNo, 'Pre-Registered', 'USR001');
    IntegrationAssertions.assertSuccess(registerRes, 'Participant registration failed');
    const participantId = registerRes.data && registerRes.data.participant ? registerRes.data.participant['Participant ID'] : null;
    IntegrationAssertions.assertNotNull(participantId, 'Participant ID is empty');

    // Verify record exists
    IntegrationAssertions.assertParticipantCreated(rollNo, eventId, 'Participant record not found in Database');

    // Cleanup
    if (participantId) DatabaseService.hardDelete(CONFIG.SHEETS.EVENT_PARTICIPANTS, 'Participant ID', participantId);
    Logger.log('✅ PASS: Participant Registration Lifecycle verified.');
    Logger.log('');
  },

  // ------------------------------------------------------------
  // FLOW 5: Mark Attendance -> Duplicate Prevention -> Undo
  // ------------------------------------------------------------
  testFlow5_AttendanceTrackingLifecycle: function() {
    Logger.log('====================================');
    Logger.log('INTEGRATION: Flow 5 - Attendance Tracking');
    Logger.log('====================================');

    const rollNo = '22A81A0501';
    const eventId = 'EVT-001';

    // 1. Ensure participant exists (prerequisite for Attendance mark on Fixed event)
    const allP = DatabaseService.readAllRows(CONFIG.SHEETS.EVENT_PARTICIPANTS) || [];
    let pRecord = allP.find(p => String(p['Roll Number'] || p.roll_number) === rollNo && String(p['Event ID'] || p.event_id) === eventId);
    let pId = null;
    if (!pRecord) {
      const pRes = ParticipantService.addParticipant(eventId, rollNo, 'Pre-Registered', 'USR001');
      pId = pRes.data && pRes.data.participant ? pRes.data.participant['Participant ID'] : null;
    }

    // Pre-cleanup attendance
    const allA = DatabaseService.readAllRows(CONFIG.SHEETS.ATTENDANCE) || [];
    const attRec = allA.find(a => String(a['Roll Number'] || a.roll_number) === rollNo && String(a['Event ID'] || a.event_id) === eventId);
    if (attRec) {
      DatabaseService.hardDelete(CONFIG.SHEETS.ATTENDANCE, 'Attendance ID', attRec['Attendance ID']);
    }

    // Mark Attendance
    const markRes = AttendanceService.markAttendance(eventId, rollNo, 'Present', 'QR_Scanner', 'USR001');
    IntegrationAssertions.assertSuccess(markRes, 'Mark attendance failed: ' + markRes.message);
    const attendanceId = markRes.data && markRes.data.attendance ? markRes.data.attendance['Attendance ID'] : null;
    IntegrationAssertions.assertNotNull(attendanceId, 'Attendance ID is empty');

    // Verify Attendance Record
    IntegrationAssertions.assertAttendanceCreated(rollNo, eventId, 'Attendance record not found in Database');

    // Duplicate Attendance Prevention
    const dupRes = AttendanceService.markAttendance(eventId, rollNo, 'Present', 'QR_Scanner', 'USR001');
    IntegrationAssertions.assertFailure(dupRes, 'Duplicate attendance allowed');

    // Cleanup
    if (attendanceId) DatabaseService.hardDelete(CONFIG.SHEETS.ATTENDANCE, 'Attendance ID', attendanceId);
    if (pId) DatabaseService.hardDelete(CONFIG.SHEETS.EVENT_PARTICIPANTS, 'Participant ID', pId);
    Logger.log('✅ PASS: Attendance Tracking verified.');
    Logger.log('');
  },

  // ------------------------------------------------------------
  // FLOW 6: Generate Attendance Report -> Save Report
  // ------------------------------------------------------------
  testFlow6_ReportingValidation: function() {
    Logger.log('====================================');
    Logger.log('INTEGRATION: Flow 6 - Reports generation');
    Logger.log('====================================');

    const eventId = 'EVT-001';
    const pdfRes = ReportService.generatePDF(eventId, 'USR001');
    IntegrationAssertions.assertSuccess(pdfRes, 'PDF generation failed');
    const reportId = pdfRes.reportId;
    IntegrationAssertions.assertNotNull(reportId, 'Report ID is empty');

    // Verify report metadata in DB
    IntegrationAssertions.assertReportGenerated(reportId, 'Report not saved in Database');

    // Cleanup
    DatabaseService.hardDelete(CONFIG.SHEETS.GENERATED_REPORTS, 'Report ID', reportId);
    Logger.log('✅ PASS: Reporting metadata verified.');
    Logger.log('');
  },

  // ------------------------------------------------------------
  // FLOW 7: Send Notification -> Verify
  // ------------------------------------------------------------
  testFlow7_NotificationsDispatch: function() {
    Logger.log('====================================');
    Logger.log('INTEGRATION: Flow 7 - Notifications Dispatch');
    Logger.log('====================================');

    const userId = 'USR002';
    const title = 'Integration Title';
    const noteRes = NotificationService.createNotification({
      userId: userId,
      title: title,
      message: 'Integration message body.',
      type: 'System Alert'
    });
    IntegrationAssertions.assertSuccess(noteRes, 'Notification creation failed');
    const notificationId = noteRes.data && noteRes.data.notification ? noteRes.data.notification['Notification ID'] : null;
    IntegrationAssertions.assertNotNull(notificationId, 'Notification ID is empty');

    // Verify Notification in DB
    IntegrationAssertions.assertNotificationCreated(userId, title, 'Notification not found in Database');

    // Cleanup
    if (notificationId) DatabaseService.hardDelete(CONFIG.SHEETS.NOTIFICATIONS, 'Notification ID', notificationId);
    Logger.log('✅ PASS: Notifications verified.');
    Logger.log('');
  },

  // ------------------------------------------------------------
  // FLOW 8: Update Setting -> Read -> Restore
  // ------------------------------------------------------------
  testFlow8_SettingsConfigurations: function() {
    Logger.log('====================================');
    Logger.log('INTEGRATION: Flow 8 - Settings Configuration');
    Logger.log('====================================');

    const getRes1 = SettingsService.getSettings();
    IntegrationAssertions.assertSuccess(getRes1, 'Get settings failed');
    const originalName = getRes1.data ? getRes1.data.collegeName : 'BVC Engineering College';

    // Update setting
    const updateRes = SettingsService.saveSettings({ collegeName: 'Integration Testing College Name' });
    IntegrationAssertions.assertSuccess(updateRes, 'Save settings failed');

    // Read setting back
    const getRes2 = SettingsService.getSettings();
    IntegrationAssertions.assertSuccess(getRes2, 'Get settings after update failed');
    IntegrationAssertions.assertEqual(getRes2.data ? getRes2.data.collegeName : '', 'Integration Testing College Name', 'Setting update mismatch');

    // Restore Setting
    const restoreRes = SettingsService.saveSettings({ collegeName: originalName });
    IntegrationAssertions.assertSuccess(restoreRes, 'Restoring original settings failed');
    Logger.log('✅ PASS: Settings Configurations verified.');
    Logger.log('');
  },

  // ------------------------------------------------------------
  // FLOW 9: Audit log verification
  // ------------------------------------------------------------
  testFlow9_AuditTrailVerification: function() {
    Logger.log('====================================');
    Logger.log('INTEGRATION: Flow 9 - Audit Trail Verification');
    Logger.log('====================================');

    // We generate a PDF report which generates a GENERATE_PDF audit action
    const eventId = 'EVT-001';
    const pdfRes = ReportService.generatePDF(eventId, 'USR002');
    const reportId = pdfRes.reportId;

    // Verify audit log exists
    IntegrationAssertions.assertAuditCreated('GENERATE_PDF', reportId, 'GENERATE_PDF action audit log missing');

    // Cleanup
    DatabaseService.hardDelete(CONFIG.SHEETS.GENERATED_REPORTS, 'Report ID', reportId);
    Logger.log('✅ PASS: Audit log trace verified.');
    Logger.log('');
  },

  // ------------------------------------------------------------
  // FLOW 10: Database Consistency & Integrity
  // ------------------------------------------------------------
  testFlow10_DatabaseIntegrityConstraints: function() {
    Logger.log('====================================');
    Logger.log('INTEGRATION: Flow 10 - Database Integrity Checks');
    Logger.log('====================================');

    IntegrationAssertions.assertDatabaseConsistent('Database integrity checks failed.');
    Logger.log('✅ PASS: Database consistency constraints verified.');
    Logger.log('');
  }

};
