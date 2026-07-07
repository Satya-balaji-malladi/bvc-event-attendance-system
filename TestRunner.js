/**
 * TestRunner.js
 * Backend test runner (GAS compatible) for TestCases.js.
 *
 * Requirements:
 * - Uses Logger.log() for all output.
 * - One failed test must not stop remaining tests.
 * - Produces summary with PASS/FAIL/SKIPPED + execution time.
 */

var TestRunner = (function() {

  var _summary;

  function _now() {
    try { return Date.now(); } catch (e) { return new Date().getTime(); }
  }

  function _log(msg) {
    try { Logger.log(String(msg)); } catch (e) {}
  }

  function _initSummary() {
    return {
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      executionTimeMs: 0,
      successPercentage: 0,
      failures: [],
      modules: {}
    };
  }

  function _normalizeResult(r, testName) {
    // Standardize to {name,module,status,message,executionTime}
    try {
      if (!r || typeof r !== 'object') {
        return { name: testName, module: '', status: 'FAIL', message: 'Invalid test result', executionTime: 0 };
      }
      var name = r.name || testName;
      var moduleName = r.module || '';
      var status = r.status || 'FAIL';
      var message = r.message || '';
      var executionTime = typeof r.executionTime === 'number' ? r.executionTime : 0;
      return { name: name, module: moduleName, status: status, message: message, executionTime: executionTime };
    } catch (e) {
      return { name: testName, module: '', status: 'FAIL', message: e && e.message ? e.message : String(e), executionTime: 0 };
    }
  }

  function createRunResult(testName, moduleName, status, expected, actual, reason, executionTime) {
    // Used only for framework internals.
    var msgParts = [];
    if (expected !== undefined) msgParts.push('Expected: ' + safeToString(expected));
    if (actual !== undefined) msgParts.push('Actual: ' + safeToString(actual));
    if (reason) msgParts.push('Reason: ' + reason);

    return {
      name: testName,
      module: moduleName,
      status: status,
      message: msgParts.join(' | '),
      executionTime: executionTime || 0
    };
  }

  function safeToString(v) {
    try {
      if (v === undefined) return 'undefined';
      if (v === null) return 'null';
      if (typeof v === 'string') return v;
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    } catch (e) {
      try { return String(v); } catch (e2) { return '[unprintable]'; }
    }
  }

  function _safeRunTest(testFn, testName) {
    var start = _now();
    var res;
    try {
      res = testFn();
      // If testFn returns null, treat as SKIPPED.
      if (res === null || res === undefined) {
        res = { name: testName, module: '', status: 'SKIPPED', message: 'Test returned empty result', executionTime: 0 };
      }
    } catch (e) {
      var msg = e && e.message ? e.message : String(e);
      res = { name: testName, module: '', status: 'FAIL', message: msg, executionTime: 0 };
      _log('[FAIL] ' + testName + ' threw exception: ' + msg);
    }

    var end = _now();
    var normalized = _normalizeResult(res, testName);
    normalized.executionTime = typeof normalized.executionTime === 'number' ? normalized.executionTime : (end - start);
    // Ensure non-negative
    if (normalized.executionTime < 0) normalized.executionTime = 0;
    return normalized;
  }

  function _getTestRegistry() {
    try {
      if (typeof TestCases === 'undefined' || !TestCases) return null;
      return TestCases;
    } catch (e) {
      return null;
    }
  }

  // Helpers required by prompt
  function runSingleTest(testName) {
    var tests = _getTestRegistry();
    if (!tests || typeof tests !== 'object') {
      _summary = _summary || _initSummary();
      return _safeRunTest(function() {
        return { name: testName, module: '', status: 'FAIL', message: 'TestCases registry missing', executionTime: 0 };
      }, testName);
    }

    var testFn = tests[testName];
    if (typeof testFn !== 'function') {
      var r = createRunResult(testName, '', 'SKIPPED', undefined, undefined, 'Test case not found', 0);
      return r;
    }

    var r = _safeRunTest(testFn, testName);

    _summary.totalTests += 1;
    if (r.status === 'PASS') _summary.passed += 1;
    else if (r.status === 'FAIL') _summary.failed += 1;
    else _summary.skipped += 1;

    if (!_summary.modules[r.module]) _summary.modules[r.module] = { total: 0, passed: 0, failed: 0, skipped: 0 };
    _summary.modules[r.module].total += 1;
    if (r.status === 'PASS') _summary.modules[r.module].passed += 1;
    else if (r.status === 'FAIL') _summary.modules[r.module].failed += 1;
    else _summary.modules[r.module].skipped += 1;

    if (r.status === 'FAIL') {
      _summary.failures.push({ module: r.module, testName: r.name, message: r.message });
    }

    _log('[' + r.status + '] Module=' + r.module + ' Test=' + r.name + ' Time=' + r.executionTime + 'ms');
    if (r.status === 'FAIL' && r.message) _log('  ' + r.message);
    if (r.status === 'SKIPPED' && r.message) _log('  ' + r.message);

    return r;
  }

  function runModule(moduleName) {
    var tests = _getTestRegistry();
    if (!tests) {
      _log('TestCases registry missing');
      return [];
    }

    var results = [];
    var keys = Object.keys(tests);
    for (var i = 0; i < keys.length; i++) {
      var testName = keys[i];
      var testFn = tests[testName];
      if (typeof testFn !== 'function') continue;

      // Test module is returned by testFn, but for routing we run and filter by module after.
      // Keep it simple: run then filter.
      var r = runSingleTest(testName);
      if (r && r.module === moduleName) results.push(r);
    }

    return results;
  }

  function runAllTests() {
    _summary = _initSummary();
    var start = _now();

    _log('--- Backend TestRunner: START ---');

    var tests = _getTestRegistry();
    if (!tests) {
      _log('TestCases registry missing.');
      _summary.totalTests = 0;
      _summary.failed = 0;
      _summary.passed = 0;
      _summary.skipped = 0;
      _summary.executionTimeMs = 0;
      _summary.successPercentage = 0;
      printSummary();
      return _summary;
    }

    var keys = Object.keys(tests);
    for (var i = 0; i < keys.length; i++) {
      try {
        runSingleTest(keys[i]);
      } catch (e) {
        // Should not happen because runSingleTest catches, but keep runner robust.
        _log('Runner exception at test=' + keys[i] + ': ' + (e && e.message ? e.message : String(e)));
      }
    }

    _summary.executionTimeMs = _now() - start;
    _summary.successPercentage = _summary.totalTests > 0 ? Number(((_summary.passed / _summary.totalTests) * 100).toFixed(2)) : 0;

    _log('--- Backend TestRunner: END ---');
    printSummary();
    return _summary;
  }

  function printSummary() {
    if (!_summary) return;
    _log('========= TEST SUMMARY =========');
    _log('PASS: ' + _summary.passed);
    _log('FAIL: ' + _summary.failed);
    _log('SKIPPED: ' + _summary.skipped);
    _log('TOTAL: ' + _summary.totalTests);
    _log('Execution Time (ms): ' + _summary.executionTimeMs);
    _log('Success Percentage: ' + _summary.successPercentage + '%');

    if (_summary.failures && _summary.failures.length > 0) {
      _log('--------- FAILURES ---------');
      for (var i = 0; i < _summary.failures.length; i++) {
        var f = _summary.failures[i];
        _log('- Module=' + f.module + ' Test=' + f.testName + ' => ' + f.message);
      }
    }
  }

  return {
    runAllTests: runAllTests,
    runModule: runModule,
    runSingleTest: runSingleTest,
    printSummary: printSummary
  };
})();

// GAS global exposure
if (typeof globalThis !== 'undefined') {
  globalThis.TestRunner = TestRunner;
} else {
  this.TestRunner = TestRunner;
}

/*************************************************
 * GOOGLE APPS SCRIPT GLOBAL WRAPPERS
 *************************************************/

function testLogin() {
  return TestRunner.runSingleTest("Login Success");
}

function testCreateUser() {
  return TestRunner.runSingleTest("Create User");
}

function testCreateStudent() {
  return TestRunner.runSingleTest("Create Student");
}

function testCreateEvent() {
  return TestRunner.runSingleTest("Create Event");
}

function testAddParticipant() {
  return TestRunner.runSingleTest("Add Participant");
}

function testAttendance() {
  return TestRunner.runSingleTest("Mark Attendance");
}

function testEventReport() {
  return TestRunner.runSingleTest("Event Report");
}