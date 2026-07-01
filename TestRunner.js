/**
 * Test Runner for BVC Engineering College Event Attendance Management System.
 * Tests foundation modules without affecting business data.
 */

const TestRunner = {
  passedCount: 0,
  failedCount: 0,

  /**
   * Helper function to assert conditions.
   * @param {string} testName - Description of the test.
   * @param {boolean} condition - Boolean condition to check.
   */
  assert: function(testName, condition) {
    if (condition) {
      Logger.log('[PASS] - ' + testName);
      this.passedCount++;
    } else {
      Logger.log('[FAIL] - ' + testName);
      this.failedCount++;
    }
  },

  /**
   * Helper function to catch exceptions during assertions.
   * @param {string} testName - Description of the test.
   * @param {Function} testFn - Function to execute.
   */
  tryAssert: function(testName, testFn) {
    try {
      const result = testFn();
      this.assert(testName, result);
    } catch (e) {
      Logger.log('[FAIL] - ' + testName + ' (Exception: ' + e.message + ')');
      this.failedCount++;
    }
  },

  /**
   * Tests the Config file structure.
   */
  testConfig: function() {
    Logger.log('--- START testConfig ---');
    this.tryAssert('CONFIG object exists', () => typeof CONFIG !== 'undefined');
    this.tryAssert('Spreadsheet ID exists', () => CONFIG && CONFIG.SPREADSHEET && typeof CONFIG.SPREADSHEET.ID === 'string');
    this.tryAssert('USERS sheet configured', () => CONFIG && CONFIG.SHEETS && typeof CONFIG.SHEETS.USERS === 'string');
    this.tryAssert('STUDENTS sheet configured', () => CONFIG && CONFIG.SHEETS && typeof CONFIG.SHEETS.STUDENTS === 'string');
    this.tryAssert('EVENTS sheet configured', () => CONFIG && CONFIG.SHEETS && typeof CONFIG.SHEETS.EVENTS === 'string');
    this.tryAssert('ATTENDANCE sheet configured', () => CONFIG && CONFIG.SHEETS && typeof CONFIG.SHEETS.ATTENDANCE === 'string');
    this.tryAssert('SESSIONS sheet configured', () => CONFIG && CONFIG.SHEETS && typeof CONFIG.SHEETS.SESSIONS === 'string');
    Logger.log('--- END testConfig ---');
  },

  /**
   * Tests the DatabaseService connection and sheet accessibility.
   */
  testDatabaseService: function() {
    Logger.log('--- START testDatabaseService ---');
    this.tryAssert('Spreadsheet connection', () => {
      const ss = DatabaseService.getSpreadsheet();
      return ss !== null && ss !== undefined;
    });
    this.tryAssert('Users sheet access', () => DatabaseService.getSheet(CONFIG.SHEETS.USERS) !== null);
    this.tryAssert('Students sheet access', () => DatabaseService.getSheet(CONFIG.SHEETS.STUDENTS) !== null);
    this.tryAssert('Events sheet access', () => DatabaseService.getSheet(CONFIG.SHEETS.EVENTS) !== null);
    this.tryAssert('Attendance sheet access', () => DatabaseService.getSheet(CONFIG.SHEETS.ATTENDANCE) !== null);
    this.tryAssert('Sessions sheet access', () => DatabaseService.getSheet(CONFIG.SHEETS.SESSIONS) !== null);
    Logger.log('--- END testDatabaseService ---');
  },

  /**
   * Tests Utils helper functions.
   */
  testUtils: function() {
    Logger.log('--- START testUtils ---');
    this.tryAssert('formatDate() formats correctly', () => {
      const date = new Date('2026-07-01T00:00:00');
      return Utils.formatDate(date) === '2026-07-01';
    });
    this.tryAssert('validateEmail() valid email', () => Utils.validateEmail('test@example.com') === true);
    this.tryAssert('validateEmail() invalid email', () => Utils.validateEmail('invalid-email') === false);
    this.tryAssert('validateRollNumber() valid format', () => Utils.validateRollNumber('20B81A05A1') === true);
    this.tryAssert('generateUsername() generation', () => Utils.generateUsername('Satya Balaji') === 'satyabalaji');
    Logger.log('--- END testUtils ---');
  },

  /**
   * Tests IdService generation.
   */
  testIdService: function() {
    Logger.log('--- START testIdService ---');
    // We execute them but don't strictly assert the exact ID since it relies on DB state.
    // Instead, we verify they return strings formatted correctly.
    this.tryAssert('generateUserId() format', () => {
      const id = IdService.generateUserId();
      return typeof id === 'string' && id.startsWith('USR-');
    });
    this.tryAssert('generateEventId() format', () => {
      const id = IdService.generateEventId();
      return typeof id === 'string' && id.startsWith('EVT-');
    });
    this.tryAssert('generateAttendanceId() format', () => {
      const id = IdService.generateAttendanceId();
      return typeof id === 'string' && id.startsWith('ATD-');
    });
    this.tryAssert('generateSessionId() format', () => {
      const id = IdService.generateSessionId();
      return typeof id === 'string' && id.startsWith('SES-');
    });
    Logger.log('--- END testIdService ---');
  },

  /**
   * Tests SessionService existence of methods (does not create real session).
   */
  testSessionService: function() {
    Logger.log('--- START testSessionService ---');
    this.tryAssert('createSession exists', () => typeof SessionService.createSession === 'function');
    this.tryAssert('getSession exists', () => typeof SessionService.getSession === 'function');
    this.tryAssert('validateSession exists', () => typeof SessionService.validateSession === 'function');
    this.tryAssert('destroySession exists', () => typeof SessionService.destroySession === 'function');
    this.tryAssert('getCurrentUser exists', () => typeof SessionService.getCurrentUser === 'function');
    this.tryAssert('isLoggedIn exists', () => typeof SessionService.isLoggedIn === 'function');
    this.tryAssert('hasRole exists', () => typeof SessionService.hasRole === 'function');
    Logger.log('--- END testSessionService ---');
  },

  /**
   * Tests ValidationService methods.
   */
  testValidationService: function() {
    Logger.log('--- START testValidationService ---');
    this.tryAssert('validateLogin exists', () => typeof ValidationService.validateLogin === 'function');
    this.tryAssert('validateUser exists', () => typeof ValidationService.validateUser === 'function');
    this.tryAssert('validateStudent exists', () => typeof ValidationService.validateStudent === 'function');
    this.tryAssert('validateEvent exists', () => typeof ValidationService.validateEvent === 'function');
    this.tryAssert('validateAttendance exists', () => typeof ValidationService.validateAttendance === 'function');
    Logger.log('--- END testValidationService ---');
  },

  /**
   * Tests AuthService logic using mock dependencies to ensure no DB interaction.
   */
  testAuthService: function() {
    Logger.log('--- START testAuthService ---');
    
    // Case 1: Verify AuthService object exists
    this.tryAssert('AuthService exists', () => typeof AuthService !== 'undefined');
    
    // Case 2: Verify functions exist
    this.tryAssert('login() exists', () => typeof AuthService.login === 'function');
    this.tryAssert('logout() exists', () => typeof AuthService.logout === 'function');
    this.tryAssert('authenticate() exists', () => typeof AuthService.authenticate === 'function');
    this.tryAssert('changePassword() exists', () => typeof AuthService.changePassword === 'function');
    
    // Case 3: Login Validation Test
    this.tryAssert('Login validation - empty username fails', () => {
      const res = ValidationService.validateLogin({ username: '', password: 'pwd' });
      return res.valid === false;
    });
    this.tryAssert('Login validation - empty password fails', () => {
      const res = ValidationService.validateLogin({ username: 'usr', password: '' });
      return res.valid === false;
    });
    this.tryAssert('Login validation - valid passes', () => {
      const res = ValidationService.validateLogin({ username: 'usr', password: 'pwd' });
      return res.valid === true;
    });
    
    // Case 4: Authentication API Availability
    this.tryAssert('Authentication API Availability', () => {
      const res = AuthService.login({});
      // Should fail safely returning a response object
      return res && typeof res.success === 'boolean';
    });

    // Case 5: Dry Run Login Test (Stubbed dependencies)
    this.tryAssert('Dry run login', () => {
      const originalValidateLogin = ValidationService.validateLogin;
      const originalFindByColumn = DatabaseService.findByColumn;
      const originalCreateSession = SessionService.createSession;
      
      let success = false;
      
      try {
        ValidationService.validateLogin = function() { return { valid: true }; };
        DatabaseService.findByColumn = function() { 
          // Fake user record
          return [{ user_id: 'USR-001', username: 'testuser', password: 'password123', status: (CONFIG.USER_STATUS ? CONFIG.USER_STATUS.ACTIVE : 'Active') }];
        };
        SessionService.createSession = function(user) { 
          return { session_token: 'fake-token' };
        };
        
        const result = AuthService.login({ usernameOrEmail: 'testuser', password: 'password123' });
        success = (result.success === true && result.user !== undefined && result.session !== undefined);
      } finally {
        ValidationService.validateLogin = originalValidateLogin;
        DatabaseService.findByColumn = originalFindByColumn;
        SessionService.createSession = originalCreateSession;
      }
      return success;
    });

    // Case 6: Dry Run Logout Test
    this.tryAssert('Dry run logout', () => {
      const originalDestroySession = SessionService.destroySession;
      let success = false;
      try {
        SessionService.destroySession = function() { return true; };
        const result = AuthService.logout('fake-token');
        success = result.success === true;
      } finally {
        SessionService.destroySession = originalDestroySession;
      }
      return success;
    });

    Logger.log('--- END testAuthService ---');
  },

  /**
   * Master runner for all tests.
   */
  runAllTests: function() {
    Logger.log('==================================================');
    Logger.log('STARTING ALL TESTS');
    Logger.log('==================================================');
    
    this.passedCount = 0;
    this.failedCount = 0;

    // Wrap in try-catch to ensure one critical failure doesn't stop others
    try { this.testConfig(); } catch (e) { Logger.log('CRITICAL FAIL in testConfig: ' + e.message); }
    try { this.testDatabaseService(); } catch (e) { Logger.log('CRITICAL FAIL in testDatabaseService: ' + e.message); }
    try { this.testUtils(); } catch (e) { Logger.log('CRITICAL FAIL in testUtils: ' + e.message); }
    try { this.testIdService(); } catch (e) { Logger.log('CRITICAL FAIL in testIdService: ' + e.message); }
    try { this.testSessionService(); } catch (e) { Logger.log('CRITICAL FAIL in testSessionService: ' + e.message); }
    try { this.testValidationService(); } catch (e) { Logger.log('CRITICAL FAIL in testValidationService: ' + e.message); }
    try { this.testAuthService(); } catch (e) { Logger.log('CRITICAL FAIL in testAuthService: ' + e.message); }

    Logger.log('==================================================');
    Logger.log('TEST SUMMARY');
    Logger.log('==================================================');
    Logger.log('Total Passed: ' + this.passedCount);
    Logger.log('Total Failed: ' + this.failedCount);
    
    const overallResult = this.failedCount === 0 ? 'ALL PASSED' : 'FAILED';
    Logger.log('Overall Result: ' + overallResult);
    Logger.log('==================================================');
  }
};

/**
 * Top-level function for Google Apps Script execution.
 */
function runAllTests() {
  TestRunner.runAllTests();
}
