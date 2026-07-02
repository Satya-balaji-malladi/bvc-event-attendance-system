/**
 * Service for handling data validation.
 * Exclusively performs data validation without accessing the database or executing business logic.
 */
const ValidationService = {

  /**
   * Helper function to construct the validation result.
   * @param {string[]} errors - Array of error messages.
   * @returns {object} Validation result object.
   */
  _buildResult: function(errors) {
    return {
      valid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * Validates if a required value is present.
   * @param {any} value - The value to check.
   * @param {string} fieldName - The name of the field.
   * @returns {string|null} Error message or null if valid.
   */
  validateRequired: function(value, fieldName) {
    if (Utils.checkEmptyValue(value)) {
      return fieldName + ' is required.';
    }
    return null;
  },

  /**
   * Validates the length of a string value.
   * @param {string} value - The string to check.
   * @param {number} minLength - Minimum allowed length.
   * @param {number} maxLength - Maximum allowed length.
   * @returns {string|null} Error message or null if valid.
   */
  validateLength: function(value, minLength, maxLength) {
    if (Utils.checkEmptyValue(value)) return null; // Let validateRequired handle emptiness
    const strValue = String(value).trim();
    if (strValue.length < minLength || strValue.length > maxLength) {
      return 'Length must be between ' + minLength + ' and ' + maxLength + ' characters.';
    }
    return null;
  },

  /**
   * Validates if a role exists in CONFIG.ROLES.
   * @param {string} role - The role to check.
   * @returns {string|null} Error message or null if valid.
   */
  validateRole: function(role) {
    if (Utils.checkEmptyValue(role)) return 'Role is required.';
    let isValid = false;
    for (const key in CONFIG.ROLES) {
      if (CONFIG.ROLES[key] === role) {
        isValid = true;
        break;
      }
    }
    return isValid ? null : 'Invalid role provided.';
  },

  /**
   * Validates if a status exists in CONFIG status maps (USER_STATUS, EVENT_STATUS).
   * @param {string} status - The status to check.
   * @returns {string|null} Error message or null if valid.
   */
  validateStatus: function(status) {
    if (Utils.checkEmptyValue(status)) return 'Status is required.';
    let isValid = false;
    
    // Check against USER_STATUS
    if (CONFIG.USER_STATUS) {
      for (const key in CONFIG.USER_STATUS) {
        if (CONFIG.USER_STATUS[key] === status) {
          isValid = true;
          break;
        }
      }
    }
    
    // Check against EVENT_STATUS if not found yet
    if (!isValid && CONFIG.EVENT_STATUS) {
      for (const key in CONFIG.EVENT_STATUS) {
        if (CONFIG.EVENT_STATUS[key] === status) {
          isValid = true;
          break;
        }
      }
    }

    return isValid ? null : 'Invalid status provided.';
  },

  /**
   * Validates login data.
   * @param {object} loginData - Contains username or email and password.
   * @returns {object} Validation result.
   */
  validateLogin: function(loginData) {
    const errors = [];
    if (!loginData) return this._buildResult(['Login data is missing.']);

    const idError = this.validateRequired(loginData.username || loginData.email, 'Username or Email');
    if (idError) errors.push(idError);

    const pwdError = this.validateRequired(loginData.password, 'Password');
    if (pwdError) errors.push(pwdError);

    return this._buildResult(errors);
  },

  /**
   * Validates user data for creation or update.
   * @param {object} userData - User record data.
   * @returns {object} Validation result.
   */
  validateUser: function(userData) {
    const errors = [];
    if (!userData) return this._buildResult(['User data is missing.']);

    const reqFields = [
      { key: 'full_name', name: 'Full Name' },
      { key: 'username', name: 'Username' },
      { key: 'email', name: 'Email' }
    ];

    reqFields.forEach(field => {
      const err = this.validateRequired(userData[field.key], field.name);
      if (err) errors.push(err);
    });

    if (userData.email && !Utils.validateEmail(userData.email)) {
      errors.push('Invalid Email format.');
    }

    const roleErr = this.validateRole(userData.role);
    if (roleErr) errors.push(roleErr);

    const statusErr = this.validateStatus(userData.status);
    if (statusErr) errors.push(statusErr);

    return this._buildResult(errors);
  },

  /**
   * Validates student data for creation or update.
   * @param {object} studentData - Student record data.
   * @returns {object} Validation result.
   */
  validateStudent: function(studentData) {
    const errors = [];
    if (!studentData) return this._buildResult(['Student data is missing.']);

    const reqFields = [
      { key: 'roll_number', name: 'Roll Number' },
      { key: 'student_name', name: 'Student Name' },
      { key: 'department', name: 'Department' },
      { key: 'year', name: 'Year' },
      { key: 'section', name: 'Section' }
    ];

    reqFields.forEach(field => {
      const err = this.validateRequired(studentData[field.key], field.name);
      if (err) errors.push(err);
    });

    if (studentData.roll_number && !Utils.validateRollNumber(studentData.roll_number)) {
      errors.push('Invalid Roll Number format.');
    }
    
    if (studentData.year !== undefined && studentData.year !== null && studentData.year !== '') {
      const yearStr = String(studentData.year).trim();
      if (!['1', '2', '3', '4'].includes(yearStr)) {
        errors.push('Invalid Year. Must be 1, 2, 3, or 4.');
      }
    }
    
    if (studentData.section && !Utils.isValidSection(studentData.section)) {
      errors.push('Invalid Section format.');
    }

    return this._buildResult(errors);
  },

  /**
   * Validates event data.
   * @param {object} eventData - Event record data.
   * @returns {object} Validation result.
   */
  validateEvent: function(eventData) {
    const errors = [];
    if (!eventData) return this._buildResult(['Event data is missing.']);

    const reqFields = [
      { key: 'event_name', name: 'Event Name' },
      { key: 'start_date', name: 'Start Date' },
      { key: 'end_date', name: 'End Date' },
      { key: 'start_time', name: 'Start Time' },
      { key: 'end_time', name: 'End Time' },
      { key: 'venue', name: 'Venue' },
      { key: 'coordinator_id', name: 'Coordinator ID' },
      { key: 'departments', name: 'Departments' },
      { key: 'status', name: 'Status' }
    ];

    reqFields.forEach(field => {
      const err = this.validateRequired(eventData[field.key], field.name);
      if (err) errors.push(err);
    });

    if (eventData.start_time && eventData.end_time) {
      if (eventData.start_date === eventData.end_date && eventData.start_time >= eventData.end_time) {
        errors.push("End Time must be strictly after Start Time on the same day.");
      }
    }
    
    if (eventData.start_date && eventData.end_date) {
      if (eventData.start_date > eventData.end_date) {
        errors.push("End Date must be greater than or equal to Start Date.");
      }
    }

    return this._buildResult(errors);
  },

  /**
   * Validates attendance data.
   * @param {object} attendanceData - Attendance record data.
   * @returns {object} Validation result.
   */
  validateAttendance: function(attendanceData) {
    const errors = [];
    if (!attendanceData) return this._buildResult(['Attendance data is missing.']);

    const reqFields = [
      { key: 'event_id', name: 'Event ID' },
      { key: 'roll_number', name: 'Roll Number' }
    ];

    reqFields.forEach(field => {
      const err = this.validateRequired(attendanceData[field.key], field.name);
      if (err) errors.push(err);
    });

    if (attendanceData.roll_number && !Utils.validateRollNumber(attendanceData.roll_number)) {
      errors.push('Invalid Roll Number format.');
    }

    return this._buildResult(errors);
  }
};
