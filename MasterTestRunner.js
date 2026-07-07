/**
 * MasterTestRunner.js
 * The single entry point to execute all BVC Attendance System backend verification suites.
 */
function runMasterSystemTests() {
  const startTime = new Date().getTime();
  Logger.log('╔══════════════════════════════════════════╗');
  Logger.log('║        MASTER SYSTEM TEST RUNNER         ║');
  Logger.log('╚══════════════════════════════════════════╝');
  Logger.log('');

  let unitPassed = 0;
  let unitFailed = 0;

  // 1. Run core unit tests registry via TestRunner
  Logger.log('--- Running TestRunner Registry ---');
  try {
    const summary = TestRunner.runAllTests();
    unitPassed += (summary.passed || 0);
    unitFailed += (summary.failed || 0);
  } catch (e) {
    unitFailed++;
    Logger.log('🛑 TestRunner registry failed: ' + e.message);
  }

  // 2. Run Sprint-specific unit test suites
  const serviceRunners = [
    { name: 'EventServiceTest', fn: typeof runEventServiceUnitTests !== 'undefined' ? runEventServiceUnitTests : null },
    { name: 'ParticipantServiceTest', fn: typeof runParticipantServiceUnitTests !== 'undefined' ? runParticipantServiceUnitTests : null },
    { name: 'AttendanceServiceTest', fn: typeof runAttendanceServiceUnitTests !== 'undefined' ? runAttendanceServiceUnitTests : null },
    { name: 'CoordinatorServiceTest', fn: typeof runCoordinatorServiceUnitTests !== 'undefined' ? runCoordinatorServiceUnitTests : null },
    { name: 'ReportServiceTest', fn: typeof runReportServiceUnitTests !== 'undefined' ? runReportServiceUnitTests : null },
    { name: 'NotificationServiceTest', fn: typeof runNotificationServiceUnitTests !== 'undefined' ? runNotificationServiceUnitTests : null },
    { name: 'SettingsServiceTest', fn: typeof runSettingsServiceUnitTests !== 'undefined' ? runSettingsServiceUnitTests : null }
  ];

  for (var i = 0; i < serviceRunners.length; i++) {
    const s = serviceRunners[i];
    if (s.fn) {
      Logger.log('--- Running Service Unit Test Suite: ' + s.name + ' ---');
      try {
        s.fn();
        unitPassed++;
      } catch (e) {
        unitFailed++;
        Logger.log('🛑 ' + s.name + ' failed: ' + e.message);
      }
    }
  }

  if (unitFailed > 0) {
    Logger.log('🛑 STOP-ON-FAIL: Service Unit Tests failed. Halting integration tests.');
    return;
  }

  // 3. Run Integration Tests
  let integrationPassed = 0;
  let integrationFailed = 0;
  try {
    const intRes = IntegrationTest.run();
    integrationPassed = intRes.passed;
  } catch (e) {
    integrationFailed++;
    Logger.log('🛑 Integration Test Suite failed: ' + e.message);
  }

  if (integrationFailed > 0) {
    Logger.log('🛑 STOP-ON-FAIL: Integration Workflow tests failed. Halting health check.');
    return;
  }

  // 4. Run Health Check
  let healthSuccess = false;
  try {
    const healthRes = BackendHealthCheck.run();
    healthSuccess = healthRes.success;
  } catch (e) {
    Logger.log('🛑 Health Check failed: ' + e.message);
  }

  // 5. Generate Master Report
  const report = TestReportGenerator.generate(
    { passed: unitPassed, failed: unitFailed },
    { passed: integrationPassed, failed: integrationFailed },
    healthSuccess,
    startTime
  );

  Logger.log('');
  Logger.log(report.content);
}
