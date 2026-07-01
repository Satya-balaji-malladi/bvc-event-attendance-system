/**
 * Global Configuration for College Event Attendance Management System
 * This file contains only configuration constants.
 * No business logic, database queries, or UI code should be placed here.
 */

const CONFIG = {
  // 1. Project Information
  PROJECT: {
    APP_NAME: 'College Event Attendance Management System',
    COLLEGE_NAME: 'BVC Engineering College', // Placeholder for actual college name
    VERSION: '1.0.0'
  },

  // 2. Spreadsheet Configuration
  SPREADSHEET: {
    ID: '1lxOHCKXPr3cY3-N6rXDLWR2wzhgfEHWYwWdFunYybbw' // Replace with actual Google Sheet ID
  },

  // 3. Sheet Names
  SHEETS: {
    USERS: 'Users',
    STUDENTS: 'Students',
    EVENTS: 'Events',
    ATTENDANCE: 'Attendance',
    SESSIONS: 'Sessions'
  },

  // 4. User Roles
  ROLES: {
    SUPER_ADMIN: 'Super Admin',
    COORDINATOR: 'Coordinator'
  },

  // 5. User Status
  USER_STATUS: {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive'
  },

  // 6. Event Status
  EVENT_STATUS: {
    UPCOMING: 'Upcoming',
    COMPLETED: 'Completed'
  },

  // 7. Attendance Status
  ATTENDANCE_STATUS: {
    PRESENT: 'Present'
  },
  // 8. Student Status
STUDENT_STATUS: {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive'
},
  // 8. Session Status
SESSION_STATUS: {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  LOGGED_OUT: 'Logged Out'
},


  // 9. Application Messages
  MESSAGES: {
    LOGIN_SUCCESS: 'Login successful',
    INVALID_CREDENTIALS: 'Invalid username or email',
    ACCOUNT_INACTIVE: 'User account is not active',
    INVALID_PASSWORD: 'Invalid password',
    SESSION_CREATE_FAILED: 'Failed to create session',
    LOGOUT_SUCCESS: 'Logout successful',
    LOGOUT_FAILED: 'Failed to destroy session or session invalid',
    AUTH_SUCCESS: 'Authentication successful',
    SESSION_INVALID: 'Session is invalid or expired',
    USER_NOT_FOUND_SESSION: 'User not found in active session',
    USER_RECORD_MISSING: 'User record does not exist',
    USER_NOT_FOUND: 'User not found',
    INCORRECT_OLD_PASSWORD: 'Incorrect old password',
    PASSWORD_CHANGED: 'Password changed successfully',
    PASSWORD_CHANGE_FAILED: 'Failed to update password in database',
    NEW_PASSWORD_EMPTY: 'New password cannot be empty',
    VALIDATION_FAILED: 'Validation failed',
    USER_CREATED: 'User created successfully',
    USER_UPDATED: 'User updated successfully',
    USER_DELETED: 'User deleted successfully',
    STUDENT_CREATED: 'Student created successfully',
    STUDENT_UPDATED: 'Student updated successfully',
    STUDENT_DELETED: 'Student deleted successfully',
    ROLL_NUMBER_EXISTS: 'Roll number already exists',
    USERNAME_EXISTS: 'Username already exists',
    ROLL_NUMBER_EXISTS: 'Roll number already exists',
    USERNAME_EXISTS: 'Username already exists',
    EMAIL_EXISTS: 'Email already exists',
    STUDENT_NOT_FOUND: 'Student not found',
    EVENT_CREATED: 'Event created successfully',
    EVENT_UPDATED: 'Event updated successfully',
    EVENT_DELETED: 'Event deleted successfully',
    EVENT_NOT_FOUND: 'Event not found',
    EVENT_ALREADY_EXISTS: 'An event with this name and date already exists',
    EVENT_CREATE_FAILED: 'Failed to create event in database',
    EVENT_UPDATE_FAILED: 'Failed to update event in database',
    EVENT_DELETE_FAILED: 'Failed to delete event in database',
    INVALID_COORDINATOR: 'Invalid coordinator ID',
    EVENT_ALREADY_UPCOMING: 'Event is already upcoming',
    EVENT_ALREADY_COMPLETED: 'Event is already completed'
  }
};
