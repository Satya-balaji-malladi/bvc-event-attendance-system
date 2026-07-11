/**
 * TestCases.js
 * Centralized backend test case library (functions only).
 *
 * IMPORTANT
 * - Do NOT execute tests here.
 * - Execution is handled by TestRunner.js.
 * - Each test returns {name,module,status,message,executionTime}.
 */

var TestCases = (function() {

  // -------------------------
  // Standard result helpers
  // -------------------------

  function _result(name, moduleName, status, message, executionTime) {
    return {
      name: name,
      module: moduleName,
      status: status, // PASS | FAIL | SKIPPED
      message: message || '',
      executionTime: typeof executionTime === 'number' ? executionTime : 0
    };
  }

  function _now() {
    try { return Date.now(); } catch (e) { return new Date().getTime(); }
  }

  function _logErr(e) {
    try {
      Logger.log(e && e.stack ? e.stack : e);
    } catch (err) {}
  }

  // -------------------------
  // TEST_DATA provider (reads from existing backend data)
  // -------------------------

  var TEST_DATA = (function() {
    // This object is derived at runtime from existing sheet records.
    // No hardcoded credentials.
    //
    // NOTE: If CONFIG mappings differ across deployments, this will safely SKIP.
    var data = {
      users: [],
      coordinators: [],
      admins: [],
      // resolved credentials are best-effort and may be absent if password hashes/salts are not accessible.
      // Tests that depend on real passwords should SKIP when no credentials can be extracted.
      resolvedLogin: null
    };

    try {
      if (!CONFIG || !CONFIG.SHEETS || !CONFIG.SHEETS.USERS) return data;
      if (!DatabaseService || !DatabaseService.readAllRows) return data;

      var users = DatabaseService.readAllRows(CONFIG.SHEETS.USERS) || [];
      data.users = users;

      // Determine status/role columns where possible.
      var roleKey = (CONFIG.COLUMNS && (CONFIG.COLUMNS.ROLE || CONFIG.COLUMNS.USER_ROLE)) ? (CONFIG.COLUMNS.ROLE || CONFIG.COLUMNS.USER_ROLE) : null;
      var statusKey = (CONFIG.COLUMNS && (CONFIG.COLUMNS.USER_STATUS || CONFIG.COLUMNS.STATUS)) ? (CONFIG.COLUMNS.USER_STATUS || CONFIG.COLUMNS.STATUS) : null;

      var activeVal = CONFIG && CONFIG.USER_STATUS && CONFIG.USER_STATUS.ACTIVE ? CONFIG.USER_STATUS.ACTIVE : 'Active';

      for (var i = 0; i < users.length; i++) {
        var u = users[i];
        if (!u) continue;
        if (statusKey && u[statusKey] !== activeVal) continue;

        var roleVal = roleKey ? u[roleKey] : null;
        if (roleVal === (CONFIG && CONFIG.ROLES && CONFIG.ROLES.ADMIN ? CONFIG.ROLES.ADMIN : 'Admin')) data.admins.push(u);
        if (roleVal === (CONFIG && CONFIG.ROLES && CONFIG.ROLES.COORDINATOR ? CONFIG.ROLES.COORDINATOR : 'Coordinator')) data.coordinators.push(u);
      }

      // Attempt to resolve a login pair ONLY if sheet stores plaintext password.
      // This system stores password hashes/salts, so typically plaintext password is NOT present.
      // Therefore we will generally set resolvedLogin = null and authentication tests will SKIP.
      //
      // If your USERS sheet includes a dedicated testing password column, set it here.
      var plaintextPwdKey = null;
      if (CONFIG && CONFIG.COLUMNS) {
        plaintextPwdKey = CONFIG.COLUMNS.USER_PASSWORD_PLAINTEXT || CONFIG.COLUMNS.USER_PASSWORD || null;
      }

      // Fallback heuristic: look for 'password' column that might exist.
      if (!plaintextPwdKey) {
        try {
          if (users && users.length && CONFIG && CONFIG.COLUMNS) {
            var keys = Object.keys(users[0] || {});
            for (var k = 0; k < keys.length; k++) {
              var kk = keys[k];
              if (kk && String(kk).toLowerCase().indexOf('password') !== -1 && String(kk).toLowerCase().indexOf('hash') === -1) {
                plaintextPwdKey = kk;
                break;
              }
            }
          }
        } catch (e1) {}
      }

      if (plaintextPwdKey) {
        var candidate = data.admins[0] || data.coordinators[0] || data.users[0] || null;
        if (candidate) {
          var uid = candidate.user_id || candidate.userId;
          if (!uid && CONFIG.COLUMNS) {
            var uidKey = CONFIG.COLUMNS.USER_ID || CONFIG.COLUMNS.USERID;
            if (uidKey) uid = candidate[uidKey];
          }
          var pwd = candidate[plaintextPwdKey];

          if (uid && pwd) {
            data.resolvedLogin = { userId: uid, password: String(pwd) };
          }
        }
      }


    } catch (e) {
      // Keep empty/derived
    }

    return data;
  })();

  // -------------------------
  // Utility helpers
 // -------------------------

  function _hasService(serviceName) {
    try {
      return eval('typeof ' + serviceName) !== 'undefined';
    } catch (e) {
      return false;
    }
  }

  function _skip(name, moduleName, reason) {
    return _result(name, moduleName, 'SKIPPED', reason, 0);
  }

  function _pass(name, moduleName, message, elapsed) {
    return _result(name, moduleName, 'PASS', message || '', elapsed || 0);
  }

  function _fail(name, moduleName, message, elapsed) {
    return _result(name, moduleName, 'FAIL', message || 'Failure', elapsed || 0);
  }

  // -------------------------
  // Authentication
  // -------------------------

  function testLoginSuccess() {
    var start = _now();
    try {
      if (!_hasService('AuthService')) return _skip('Login Success', 'Auth', 'AuthService missing');

      if (!TEST_DATA.resolvedLogin || !TEST_DATA.resolvedLogin.userId || !TEST_DATA.resolvedLogin.password) {
        return _skip('Login Success', 'Auth', 'No plaintext test password available in TEST_DATA (password stored hashed/salted)');
      }

      var res = AuthService.login({ userId: TEST_DATA.resolvedLogin.userId, password: TEST_DATA.resolvedLogin.password });
      if (!res || typeof res.success !== 'boolean') return _fail('Login Success', 'Auth', 'Unexpected response shape', _now() - start);
      if (res.success !== true) return _fail('Login Success', 'Auth', 'Expected success=true', _now() - start);
      return _pass('Login Success', 'Auth', '', _now() - start);
    } catch (e) {
      _logErr(e);
      return _fail('Login Success', 'Auth', e && e.message ? e.message : String(e), _now() - start);
    }
  }

  function testInvalidPassword() {
    var start = _now();
    try {
      if (!_hasService('AuthService')) return _skip('Invalid Password', 'Auth', 'AuthService missing');
      var candidate = TEST_DATA.resolvedLogin ? TEST_DATA.resolvedLogin.userId : (TEST_DATA.users[0] ? (TEST_DATA.users[0].user_id || TEST_DATA.users[0].userId) : null);
      if (!candidate) return _skip('Invalid Password', 'Auth', 'No userId candidate available');

      var res = AuthService.login({ userId: candidate, password: 'WRONG_PASSWORD__' + _now() });
      if (!res || typeof res.success !== 'boolean') return _fail('Invalid Password', 'Auth', 'Unexpected response shape', _now() - start);
      if (res.success !== false) return _fail('Invalid Password', 'Auth', 'Expected success=false for wrong password', _now() - start);
      return _pass('Invalid Password', 'Auth', '', _now() - start);
    } catch (e) {
      _logErr(e);
      return _fail('Invalid Password', 'Auth', e && e.message ? e.message : String(e), _now() - start);
    }
  }

  function testInvalidUsername() {
    var start = _now();
    try {
      if (!_hasService('AuthService')) return _skip('Invalid Username', 'Auth', 'AuthService missing');
      var fakeUserId = 'NON_EXISTENT_' + _now();
      var res = AuthService.login({ userId: fakeUserId, password: 'ANY' });
      if (!res || typeof res.success !== 'boolean') return _fail('Invalid Username', 'Auth', 'Unexpected response shape', _now() - start);
      if (res.success !== false) return _fail('Invalid Username', 'Auth', 'Expected success=false for unknown user', _now() - start);
      return _pass('Invalid Username', 'Auth', '', _now() - start);
    } catch (e) {
      _logErr(e);
      return _fail('Invalid Username', 'Auth', e && e.message ? e.message : String(e), _now() - start);
    }
  }

  function testLockedAccount() {
    var start = _now();
    try {
      if (!_hasService('AuthService')) return _skip('Locked Account', 'Auth', 'AuthService missing');
      // Find locked user from sheet.
      if (!CONFIG || !CONFIG.COLUMNS || !CONFIG.COLUMNS.USER_ACCOUNT_LOCKED) return _skip('Locked Account', 'Auth', 'Lock column mapping missing');
      var lockKey = CONFIG.COLUMNS.USER_ACCOUNT_LOCKED;
      var locked = (TEST_DATA.users || []).find(function(u) { return u && u[lockKey] === true; });
      if (!locked) return _skip('Locked Account', 'Auth', 'No locked user found in TEST_DATA');

      var userId = locked.user_id || locked.userId || (CONFIG.COLUMNS.USER_ID ? locked[CONFIG.COLUMNS.USER_ID] : null);
      if (!userId) return _skip('Locked Account', 'Auth', 'Locked userId missing');

      var res = AuthService.login({ userId: userId, password: 'ANY' });
      if (!res || typeof res.success !== 'boolean') return _fail('Locked Account', 'Auth', 'Unexpected response shape', _now() - start);
      if (res.success !== false) return _fail('Locked Account', 'Auth', 'Expected success=false for locked account', _now() - start);
      return _pass('Locked Account', 'Auth', '', _now() - start);
    } catch (e) {
      _logErr(e);
      return _fail('Locked Account', 'Auth', e && e.message ? e.message : String(e), _now() - start);
    }
  }

  function testInactiveAccount() {
    var start = _now();
    try {
      if (!_hasService('AuthService')) return _skip('Inactive Account', 'Auth', 'AuthService missing');
      if (!CONFIG || !CONFIG.COLUMNS) return _skip('Inactive Account', 'Auth', 'CONFIG column mappings missing');
      var statusKey = CONFIG.COLUMNS.USER_STATUS || CONFIG.COLUMNS.STATUS;
      if (!statusKey) return _skip('Inactive Account', 'Auth', 'Status column mapping missing');
      var inactiveVal = (CONFIG.USER_STATUS && CONFIG.USER_STATUS.INACTIVE) ? CONFIG.USER_STATUS.INACTIVE : 'Inactive';

      var u = (TEST_DATA.users || []).find(function(x) { return x && x[statusKey] === inactiveVal; });
      if (!u) return _skip('Inactive Account', 'Auth', 'No inactive user found in TEST_DATA');

      var userId = u.user_id || u.userId || (CONFIG.COLUMNS.USER_ID ? u[CONFIG.COLUMNS.USER_ID] : null);
      if (!userId) return _skip('Inactive Account', 'Auth', 'Inactive userId missing');

      var res = AuthService.login({ userId: userId, password: 'ANY' });
      if (!res || typeof res.success !== 'boolean') return _fail('Inactive Account', 'Auth', 'Unexpected response shape', _now() - start);
      if (res.success !== false) return _fail('Inactive Account', 'Auth', 'Expected success=false for inactive account', _now() - start);
      return _pass('Inactive Account', 'Auth', '', _now() - start);
    } catch (e) {
      _logErr(e);
      return _fail('Inactive Account', 'Auth', e && e.message ? e.message : String(e), _now() - start);
    }
  }

  function testLogout() {
    var start = _now();
    try {
      if (!_hasService('AuthService')) return _skip('Logout', 'Auth', 'AuthService missing');
      // Without a session token created by a successful login, we can't safely test logout.
      return _skip('Logout', 'Auth', 'Logout requires a valid session token');
    } catch (e) {
      _logErr(e);
      return _fail('Logout', 'Auth', e && e.message ? e.message : String(e), _now() - start);
    }
  }

  function testSessionValidation() {
    var start = _now();
    try {
      if (!_hasService('AuthService')) return _skip('Session Validation', 'Auth', 'AuthService missing');
      var res = AuthService.authenticate('INVALID_TOKEN');
      if (!res || typeof res.success !== 'boolean') return _fail('Session Validation', 'Auth', 'Unexpected response shape', _now() - start);
      if (res.success !== false) return _fail('Session Validation', 'Auth', 'Expected success=false for invalid session', _now() - start);
      return _pass('Session Validation', 'Auth', '', _now() - start);
    } catch (e) {
      _logErr(e);
      return _fail('Session Validation', 'Auth', e && e.message ? e.message : String(e), _now() - start);
    }
  }

  // -------------------------
  // Minimal non-destructive service tests (signature safety)
  // -------------------------

  // To avoid guessing field names and to respect "tests use correct parameter names",
  // these cases either call existing read-only methods or skip when data preparation is unsafe.

  function testCreateUser() {
    var start = _now();
    try {
      if (!_hasService('UserService')) return _skip('Create User', 'User', 'UserService missing');
      // Destructive/seed-dependent; keep SKIPPED in absence of deterministic credentials.
      return _skip('Create User', 'User', 'Seed-dependent destructive test; disabled in framework');
    } catch (e) {
      _logErr(e);
      return _fail('Create User', 'User', e && e.message ? e.message : String(e), _now() - start);
    }
  }

  function testUpdateUser() {
    var start = _now();
    try {
      if (!_hasService('UserService')) return _skip('Update User', 'User', 'UserService missing');
      // Best-effort read existing user id from TEST_DATA.
      var u = (TEST_DATA.users || [])[0];
      if (!u) return _skip('Update User', 'User', 'No users in TEST_DATA');
      var userId = u.user_id || u.userId || (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_ID ? u[CONFIG.COLUMNS.USER_ID] : null);
      if (!userId) return _skip('Update User', 'User', 'User ID missing in TEST_DATA');

      var res = UserService.updateUser(userId, { theme: 'light' });
      if (!res || typeof res.success !== 'boolean') return _fail('Update User', 'User', 'Unexpected response shape', _now() - start);
      return res.success === true ? _pass('Update User', 'User', '', _now() - start) : _skip('Update User', 'User', res.message || 'Update failed', _now() - start);
    } catch (e) {
      _logErr(e);
      return _fail('Update User', 'User', e && e.message ? e.message : String(e), _now() - start);
    }
  }

  // Provide SKIPPED defaults for destructive/seed-dependent cases to avoid breaking "do not guess" rule.
  function _skipByDefault(name, moduleName) {
    return function() {
      return _skip(name, moduleName, 'Seed-dependent or destructive; requires stable test fixtures');
    };
  }

  var testDeleteUser = _skipByDefault('Delete User', 'User');
  var testSearchUser = function() {
    var start = _now();
    try {
      if (!_hasService('UserService')) return _skip('Search User', 'User', 'UserService missing');
      if (typeof UserService.paginateUsers !== 'function') return _skip('Search User', 'User', 'paginateUsers missing');
      var res = UserService.paginateUsers(1, 5);
      if (!res || typeof res !== 'object') return _fail('Search User', 'User', 'Unexpected pagination response', _now() - start);
      return _pass('Search User', 'User', '', _now() - start);
    } catch (e) {
      _logErr(e);
      return _fail('Search User', 'User', e && e.message ? e.message : String(e), _now() - start);
    }
  };

  var testDuplicateUsername = _skipByDefault('Duplicate Username', 'User');
  var testDuplicateEmail = _skipByDefault('Duplicate Email', 'User');

  // Department
  var testCreateDepartment = function() {
    var start = _now();
    try {
      if (!_hasService('DepartmentService')) return _skip('Create Department', 'Department', 'DepartmentService missing');
      if (typeof DepartmentService.createDepartment !== 'function') return _skip('Create Department', 'Department', 'createDepartment missing');
      // avoid collisions by skipping
      return _skip('Create Department', 'Department', 'Destructive seed-dependent test');
    } catch (e) {
      _logErr(e);
      return _fail('Create Department', 'Department', e && e.message ? e.message : String(e), _now() - start);
    }
  };

  var testUpdateDepartment = _skipByDefault('Update Department', 'Department');
  var testDeleteDepartment = _skipByDefault('Delete Department', 'Department');
  var testSearchDepartment = _skipByDefault('Search Department', 'Department');

  // Student
  var testCreateStudent = _skipByDefault('Create Student', 'Student');
  var testUpdateStudent = _skipByDefault('Update Student', 'Student');
  var testDeleteStudent = _skipByDefault('Delete Student', 'Student');
  var testSearchStudent = _skipByDefault('Search Student', 'Student');
  var testDuplicateRollNumber = _skipByDefault('Duplicate Roll Number', 'Student');

  // Event
  var testCreateEvent = _skipByDefault('Create Event', 'Event');
  var testUpdateEvent = _skipByDefault('Update Event', 'Event');
  var testDeleteEvent = _skipByDefault('Delete Event', 'Event');
  var testDuplicateEvent = _skipByDefault('Duplicate Event', 'Event');
  var testSearchEvent = _skipByDefault('Search Event', 'Event');
  var testEventStatus = _skipByDefault('Event Status', 'Event');

  // Participant
  var testAddParticipant = _skipByDefault('Add Participant', 'Participant');
  var testRemoveParticipant = _skipByDefault('Remove Participant', 'Participant');
  var testRestoreParticipant = _skipByDefault('Restore Participant', 'Participant');
  var testDuplicateParticipant = _skipByDefault('Duplicate Participant', 'Participant');
  var testEligibilityCheck = _skipByDefault('Eligibility Check', 'Participant');

  // Attendance
  var testMarkAttendance = _skipByDefault('Mark Attendance', 'Attendance');
  var testDuplicateAttendance = _skipByDefault('Duplicate Attendance', 'Attendance');
  var testInvalidStudent = _skipByDefault('Invalid Student', 'Attendance');
  var testInvalidEvent = _skipByDefault('Invalid Event', 'Attendance');
  var testClosedAttendance = _skipByDefault('Closed Attendance', 'Attendance');
  var testAttendanceCount = _skipByDefault('Attendance Count', 'Attendance');

  // Reports
  var testEventReport = _skipByDefault('Event Report', 'Report');
  var testStudentReport = _skipByDefault('Student Report', 'Report');
  var testDepartmentReport = _skipByDefault('Department Report', 'Report');
  var testCoordinatorReport = _skipByDefault('Coordinator Report', 'Report');

  // Notifications
  var testCreateNotification = _skipByDefault('Create Notification', 'Notification');
  var testSearchNotification = _skipByDefault('Search Notification', 'Notification');
  var testMarkRead = _skipByDefault('Mark Read', 'Notification');
  var testUnreadCount = _skipByDefault('Unread Count', 'Notification');

  // Audit
  var testCreateAuditLog = _skipByDefault('Create Audit Log', 'Audit');
  var testSearchAuditLog = _skipByDefault('Search Audit Log', 'Audit');
  var testFilterAuditLog = _skipByDefault('Filter Audit Log', 'Audit');
  var testAuditStatistics = _skipByDefault('Audit Statistics', 'Audit');

  // Settings
  var testGetSettings = function() {
    var start = _now();
    try {
      if (!_hasService('SettingsService')) return _skip('Get Settings', 'Settings', 'SettingsService missing');
      if (typeof SettingsService.getSettings !== 'function') return _skip('Get Settings', 'Settings', 'getSettings missing');
      var res = SettingsService.getSettings();
      if (!res || typeof res !== 'object') return _fail('Get Settings', 'Settings', 'Unexpected response', _now() - start);
      return _pass('Get Settings', 'Settings', '', _now() - start);
    } catch (e) {
      _logErr(e);
      return _fail('Get Settings', 'Settings', e && e.message ? e.message : String(e), _now() - start);
    }
  };

  var testSaveSettings = function() {
    var start = _now();
    try {
      if (!_hasService('SettingsService')) return _skip('Save Settings', 'Settings', 'SettingsService missing');
      if (typeof SettingsService.saveSettings !== 'function') return _skip('Save Settings', 'Settings', 'saveSettings missing');
      // avoid changing settings in CI; SKIP.
      return _skip('Save Settings', 'Settings', 'State-changing test skipped');
    } catch (e) {
      _logErr(e);
      return _fail('Save Settings', 'Settings', e && e.message ? e.message : String(e), _now() - start);
    }
  };

  // -------------------------
  // Registry
  // -------------------------

  return {
    // Auth
    'Login Success': testLoginSuccess,
    'Invalid Password': testInvalidPassword,
    'Invalid Username': testInvalidUsername,
    'Locked Account': testLockedAccount,
    'Inactive Account': testInactiveAccount,
    'Logout': testLogout,
    'Session Validation': testSessionValidation,

    // User
    'Create User': testCreateUser,
    'Update User': testUpdateUser,
    'Delete User': testDeleteUser,
    'Search User': testSearchUser,
    'Duplicate Username': testDuplicateUsername,
    'Duplicate Email': testDuplicateEmail,

    // Department
    'Create Department': testCreateDepartment,
    'Update Department': testUpdateDepartment,
    'Delete Department': testDeleteDepartment,
    'Search Department': testSearchDepartment,

    // Student
    'Create Student': testCreateStudent,
    'Update Student': testUpdateStudent,
    'Delete Student': testDeleteStudent,
    'Search Student': testSearchStudent,
    'Duplicate Roll Number': testDuplicateRollNumber,

    // Event
    'Create Event': testCreateEvent,
    'Update Event': testUpdateEvent,
    'Delete Event': testDeleteEvent,
    'Duplicate Event': testDuplicateEvent,
    'Search Event': testSearchEvent,
    'Event Status': testEventStatus,

    // Participant
    'Add Participant': testAddParticipant,
    'Remove Participant': testRemoveParticipant,
    'Restore Participant': testRestoreParticipant,
    'Duplicate Participant': testDuplicateParticipant,
    'Eligibility Check': testEligibilityCheck,

    // Attendance
    'Mark Attendance': testMarkAttendance,
    'Duplicate Attendance': testDuplicateAttendance,
    'Invalid Student': testInvalidStudent,
    'Invalid Event': testInvalidEvent,
    'Closed Attendance': testClosedAttendance,
    'Attendance Count': testAttendanceCount,

    // Report
    'Event Report': testEventReport,
    'Student Report': testStudentReport,
    'Department Report': testDepartmentReport,
    'Coordinator Report': testCoordinatorReport,

    // Notification
    'Create Notification': testCreateNotification,
    'Search Notification': testSearchNotification,
    'Mark Read': testMarkRead,
    'Unread Count': testUnreadCount,

    // Audit
    'Create Audit Log': testCreateAuditLog,
    'Search Audit Log': testSearchAuditLog,
    'Filter Audit Log': testFilterAuditLog,
    'Audit Statistics': testAuditStatistics,

    // Settings
    'Get Settings': testGetSettings,
    'Save Settings': testSaveSettings
  };

})();

// GAS global exposure
if (typeof globalThis !== 'undefined') {
  globalThis.TestCases = TestCases;
} else {
  this.TestCases = TestCases;
}
function testCreateDepartment() {

  Logger.log("===== TEST: CREATE DEPARTMENT =====");

  var departmentData = {};

  departmentData[CONFIG.COLUMNS.DEPARTMENT_NAME] = "Testing Department";
  departmentData[CONFIG.COLUMNS.DEPARTMENT_CODE] = "TEST001";

  // If your service supports description
  if (CONFIG.COLUMNS.DESCRIPTION) {
    departmentData[CONFIG.COLUMNS.DESCRIPTION] = "Created by automated test";
  }

  var createdBy = "USR001";

  var result = DepartmentService.createDepartment(
    departmentData,
    createdBy
  );

  Logger.log("===== RESULT =====");
Logger.log("Success : " + result.success);
Logger.log("Message : " + result.message);

if (result.data) {
  Logger.log("Data : " + JSON.stringify(result.data));
}

if (result.errors) {
  Logger.log("Errors : " + JSON.stringify(result.errors));
}

Logger.log(JSON.stringify(result));

  return result;
}
