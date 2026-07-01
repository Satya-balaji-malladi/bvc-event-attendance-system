/**
 * Integration Testing module for BVC Engineering College Event Attendance Management System.
 * For development purposes only. DO NOT use in production logic.
 */

/**
 * Tests the login functionality.
 * @param {string} usernameOrEmail 
 * @param {string} password 
 * @returns {object} Result object from AuthService.login.
 */
function testLogin(usernameOrEmail, password) {
  Logger.log('--- Executing testLogin ---');
  const result = AuthService.login({
    usernameOrEmail: usernameOrEmail,
    password: password
  });

  Logger.log('Login Result: ' + (result.success ? 'SUCCESS' : 'FAILED'));
  if (result.success) {
    Logger.log('User: ' + JSON.stringify(result.user));
    Logger.log('Session: ' + JSON.stringify(result.session));
  } else {
    Logger.log('Reason: ' + result.message);
  }
  
  return result;
}

/**
 * Tests the logout functionality.
 * @param {string} sessionToken 
 * @returns {object} Result object from AuthService.logout.
 */
function testLogout(sessionToken) {
  Logger.log('--- Executing testLogout ---');
  const result = AuthService.logout(sessionToken);
  Logger.log('Logout Result: ' + (result.success ? 'SUCCESS' : 'FAILED'));
  if (!result.success) {
    Logger.log('Reason: ' + result.message);
  }
  return result;
}

/**
 * Tests session authentication.
 * @param {string} sessionToken 
 * @returns {object} Result object from AuthService.authenticate.
 */
function testAuthenticate(sessionToken) {
  Logger.log('--- Executing testAuthenticate ---');
  const result = AuthService.authenticate(sessionToken);
  Logger.log('Authenticate Result: ' + (result.success ? 'SUCCESS' : 'FAILED'));
  if (result.success) {
    Logger.log('Authenticated User: ' + JSON.stringify(result.user));
  } else {
    Logger.log('Reason: ' + result.message);
  }
  return result;
}

/**
 * Tests the database connection and sheet access.
 * @returns {boolean} True if all sheets are accessible.
 */
function testDatabaseConnection() {
  Logger.log('--- Executing testDatabaseConnection ---');
  
  let allPassed = true;
  
  const checkSheet = (name, sheetName) => {
    const sheet = DatabaseService.getSheet(sheetName);
    if (sheet) {
      Logger.log(name + ' sheet connection: PASS');
    } else {
      Logger.log(name + ' sheet connection: FAIL');
      allPassed = false;
    }
  };

  try {
    const ss = DatabaseService.getSpreadsheet();
    if (ss) {
      Logger.log('Spreadsheet connection: PASS');
      
      checkSheet('Users', CONFIG.SHEETS.USERS);
      checkSheet('Students', CONFIG.SHEETS.STUDENTS);
      checkSheet('Events', CONFIG.SHEETS.EVENTS);
      checkSheet('Attendance', CONFIG.SHEETS.ATTENDANCE);
      checkSheet('Sessions', CONFIG.SHEETS.SESSIONS);
    } else {
      Logger.log('Spreadsheet connection: FAIL');
      allPassed = false;
    }
  } catch (e) {
    Logger.log('Database connection error: ' + e.message);
    allPassed = false;
  }
  
  return allPassed;
}

/**
 * Master integration test runner.
 * Executes DB connection, Login, Authenticate, and Logout in sequence.
 */
function runIntegrationTest() {
  Logger.log('=================================');
  Logger.log('INTEGRATION TEST STARTED');
  Logger.log('=================================');

  const results = {
    db: 'FAIL',
    login: 'FAIL',
    auth: 'FAIL',
    logout: 'FAIL',
    overall: 'FAIL'
  };

  // Step 1: Database Connection
  const dbPassed = testDatabaseConnection();
  results.db = dbPassed ? 'PASS' : 'FAIL';

  if (dbPassed) {
    // Step 2: Login
    const loginResult = testLogin("admin", "admin123");
    if (loginResult.success && loginResult.session && loginResult.session.session_token) {
      results.login = 'PASS';
      const sessionToken = loginResult.session.session_token;

      // Step 3: Authenticate
      const authResult = testAuthenticate(sessionToken);
      results.auth = authResult.success ? 'PASS' : 'FAIL';

      // Step 4: Logout
      const logoutResult = testLogout(sessionToken);
      results.logout = logoutResult.success ? 'PASS' : 'FAIL';
      
      if (results.auth === 'PASS' && results.logout === 'PASS') {
        results.overall = 'PASS';
      }
    } else {
      Logger.log('Login step failed. Skipping Authenticate and Logout.');
    }
  } else {
    Logger.log('Database connection failed. Skipping remaining tests.');
  }

  Logger.log('=================================');
  Logger.log('Database Connection : ' + results.db);
  Logger.log('Login               : ' + results.login);
  Logger.log('Authentication      : ' + results.auth);
  Logger.log('Logout              : ' + results.logout);
  Logger.log('=================================');
  Logger.log('INTEGRATION TEST ' + results.overall);
  Logger.log('=================================');
}

/**
 * Tests UserService.createUser
 * @returns {object|null} The created user or null if failed.
 */
function testCreateUser() {
  Logger.log('--- Executing testCreateUser ---');
  const ts = new Date().getTime();
  const userData = {
    full_name: 'Test Coordinator',
    username: 'testcoord_' + ts,
    email: 'testcoord_' + ts + '@example.com',
    role: CONFIG.ROLES.COORDINATOR,
    password: 'password123'
  };

  const result = UserService.createUser(userData);
  if (result.success && result.user) {
    Logger.log('Create User: PASS');
    return result.user;
  } else {
    Logger.log('Create User: FAIL - ' + result.message);
    return null;
  }
}

/**
 * Tests UserService.getUserById
 * @param {string} userId 
 * @returns {boolean}
 */
function testGetUser(userId) {
  Logger.log('--- Executing testGetUser ---');
  const user = UserService.getUserById(userId);
  if (user && user.user_id === userId) {
    Logger.log('Get User: PASS');
    return true;
  } else {
    Logger.log('Get User: FAIL');
    return false;
  }
}

/**
 * Tests UserService.getUserByUsername
 * @param {string} username 
 * @returns {boolean}
 */
function testGetUserByUsername(username) {
  Logger.log('--- Executing testGetUserByUsername ---');
  const user = UserService.getUserByUsername(username);
  if (user && user.username === username) {
    Logger.log('Get User By Username: PASS');
    return true;
  } else {
    Logger.log('Get User By Username: FAIL');
    return false;
  }
}

/**
 * Tests UserService.updateUser
 * @param {string} userId 
 * @returns {boolean}
 */
function testUpdateUser(userId) {
  Logger.log('--- Executing testUpdateUser ---');
  const newName = 'Updated Coordinator Name';
  const result = UserService.updateUser(userId, { full_name: newName });
  if (result.success && result.user && result.user.full_name === newName) {
    Logger.log('Update User: PASS');
    return true;
  } else {
    Logger.log('Update User: FAIL - ' + result.message);
    return false;
  }
}

/**
 * Tests UserService.deactivateUser
 * @param {string} userId 
 * @returns {boolean}
 */
function testDeactivateUser(userId) {
  Logger.log('--- Executing testDeactivateUser ---');
  const result = UserService.deactivateUser(userId);
  if (result.success && result.user && result.user.status === CONFIG.USER_STATUS.INACTIVE) {
    Logger.log('Deactivate User: PASS');
    return true;
  } else {
    Logger.log('Deactivate User: FAIL - ' + result.message);
    return false;
  }
}

/**
 * Tests UserService.activateUser
 * @param {string} userId 
 * @returns {boolean}
 */
function testActivateUser(userId) {
  Logger.log('--- Executing testActivateUser ---');
  const result = UserService.activateUser(userId);
  if (result.success && result.user && result.user.status === CONFIG.USER_STATUS.ACTIVE) {
    Logger.log('Activate User: PASS');
    return true;
  } else {
    Logger.log('Activate User: FAIL - ' + result.message);
    return false;
  }
}

/**
 * Tests UserService.searchUsers
 * @param {string} keyword 
 * @returns {boolean}
 */
function testSearchUsers(keyword) {
  Logger.log('--- Executing testSearchUsers ---');
  const results = UserService.searchUsers(keyword);
  if (results && results.length > 0) {
    Logger.log('Search Users: PASS');
    return true;
  } else {
    Logger.log('Search Users: FAIL');
    return false;
  }
}

/**
 * Tests UserService.deleteUser
 * @param {string} userId 
 * @returns {boolean}
 */
function testDeleteUser(userId) {
  Logger.log('--- Executing testDeleteUser ---');
  const result = UserService.deleteUser(userId);
  if (result.success) {
    // Verify it no longer exists
    const user = UserService.getUserById(userId);
    if (!user) {
      Logger.log('Delete User: PASS');
      return true;
    }
  }
  Logger.log('Delete User: FAIL - ' + result.message);
  return false;
}

/**
 * Master integration test runner for UserService.
 */
function runUserServiceIntegrationTest() {
  Logger.log('=================================');
  Logger.log('USER SERVICE INTEGRATION TEST STARTED');
  Logger.log('=================================');

  const createdUser = testCreateUser();
  if (!createdUser) {
    Logger.log('Test aborted: Create User failed.');
    Logger.log('=================================');
    return;
  }

  const userId = createdUser.user_id;
  const username = createdUser.username;

  try {
    testGetUser(userId);
    testGetUserByUsername(username);
    testUpdateUser(userId);
    testDeactivateUser(userId);
    testActivateUser(userId);
    testSearchUsers(username);
  } catch (e) {
    Logger.log('An error occurred during testing: ' + e.message);
  } finally {
    Logger.log('--- Cleanup ---');
    testDeleteUser(userId);
    Logger.log('=================================');
    Logger.log('USER SERVICE INTEGRATION TEST COMPLETE');
    Logger.log('=================================');
  }
}

/**
 * Tests StudentService.createStudent
 * @returns {object|null} The created student or null if failed.
 */
function testCreateStudent() {
  Logger.log('--- Executing testCreateStudent ---');
  const ts = new Date().getTime().toString().slice(-6);
  const roll = 'TEST' + ts;
  
  const studentData = {
    roll_number: roll,
    student_name: 'Test Student',
    department: 'CSE',
    year: '3',
    section: 'A',
    status: CONFIG.STUDENT_STATUS ? CONFIG.STUDENT_STATUS.ACTIVE : 'Active'
  };

  const result = StudentService.createStudent(studentData);
  if (result.success && result.student) {
    Logger.log('Create Student: PASS');
    return result.student;
  } else {
    Logger.log('Create Student: FAIL - ' + result.message);
    return null;
  }
}

/**
 * Tests StudentService.getStudentByRollNumber
 * @param {string} rollNumber 
 * @returns {boolean}
 */
function testGetStudent(rollNumber) {
  Logger.log('--- Executing testGetStudent ---');
  const student = StudentService.getStudentByRollNumber(rollNumber);
  if (student && student.roll_number === rollNumber) {
    Logger.log('Get Student: PASS');
    return true;
  } else {
    Logger.log('Get Student: FAIL');
    return false;
  }
}

/**
 * Tests StudentService.updateStudent
 * @param {string} rollNumber 
 * @returns {boolean}
 */
function testUpdateStudent(rollNumber) {
  Logger.log('--- Executing testUpdateStudent ---');
  const newName = 'Updated Test Student';
  const result = StudentService.updateStudent(rollNumber, { student_name: newName });
  if (result.success && result.student && result.student.student_name === newName) {
    Logger.log('Update Student: PASS');
    return true;
  } else {
    Logger.log('Update Student: FAIL - ' + result.message);
    return false;
  }
}

/**
 * Tests StudentService.searchStudents
 * @param {string} keyword 
 * @returns {boolean}
 */
function testSearchStudent(keyword) {
  Logger.log('--- Executing testSearchStudent ---');
  const results = StudentService.searchStudents(keyword);
  if (results && results.length > 0) {
    Logger.log('Search Student: PASS');
    return true;
  } else {
    Logger.log('Search Student: FAIL');
    return false;
  }
}

/**
 * Tests StudentService.getStudentsByDepartment
 * @returns {boolean}
 */
function testDepartmentFilter() {
  Logger.log('--- Executing testDepartmentFilter ---');
  const results = StudentService.getStudentsByDepartment('CSE');
  if (Array.isArray(results)) {
    Logger.log('Department Filter: PASS');
    return true;
  } else {
    Logger.log('Department Filter: FAIL');
    return false;
  }
}

/**
 * Tests StudentService.getStudentsByYear
 * @returns {boolean}
 */
function testYearFilter() {
  Logger.log('--- Executing testYearFilter ---');
  const results = StudentService.getStudentsByYear('3');
  if (Array.isArray(results)) {
    Logger.log('Year Filter: PASS');
    return true;
  } else {
    Logger.log('Year Filter: FAIL');
    return false;
  }
}

/**
 * Tests StudentService.getStudentsBySection
 * @returns {boolean}
 */
function testSectionFilter() {
  Logger.log('--- Executing testSectionFilter ---');
  const results = StudentService.getStudentsBySection('A');
  if (Array.isArray(results)) {
    Logger.log('Section Filter: PASS');
    return true;
  } else {
    Logger.log('Section Filter: FAIL');
    return false;
  }
}

/**
 * Tests StudentService.deleteStudent
 * @param {string} rollNumber 
 * @returns {boolean}
 */
function testDeleteStudent(rollNumber) {
  Logger.log('--- Executing testDeleteStudent ---');
  const result = StudentService.deleteStudent(rollNumber);
  if (result.success) {
    const student = StudentService.getStudentByRollNumber(rollNumber);
    if (!student) {
      Logger.log('Delete Student: PASS');
      return true;
    }
  }
  Logger.log('Delete Student: FAIL - ' + result.message);
  return false;
}

/**
 * Master integration test runner for StudentService.
 */
function runStudentServiceIntegrationTest() {
  Logger.log('=================================');
  Logger.log('STUDENT SERVICE INTEGRATION TEST STARTED');
  Logger.log('=================================');

  const createdStudent = testCreateStudent();
  if (!createdStudent) {
    Logger.log('Test aborted: Create Student failed.');
    Logger.log('=================================');
    return;
  }

  const rollNumber = createdStudent.roll_number;

  try {
    testGetStudent(rollNumber);
    testUpdateStudent(rollNumber);
    testSearchStudent(rollNumber);
    testDepartmentFilter();
    testYearFilter();
    testSectionFilter();
  } catch (e) {
    Logger.log('An error occurred during testing: ' + e.message);
  } finally {
    Logger.log('--- Cleanup ---');
    testDeleteStudent(rollNumber);
    Logger.log('=================================');
    Logger.log('STUDENT SERVICE INTEGRATION TEST COMPLETE');
    Logger.log('=================================');
  }
}
