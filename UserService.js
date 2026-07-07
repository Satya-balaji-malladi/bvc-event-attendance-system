/**
 * UserService.gs
 * Service for handling user management.
 * Responsibilities: CRUD operations for users, activation/deactivation, searching, filtering, sorting, pagination, and profile updates.
 */
const UserService = {

  // ==============================
  // Private helpers
  // ==============================

  _usersSheet: function() {
    return CONFIG.SHEETS && CONFIG.SHEETS.USERS ? CONFIG.SHEETS.USERS : null;
  },

  _mustUsersSheet: function() {
    var s = this._usersSheet();
    if (!s) throw new Error('Users sheet mapping missing in CONFIG.SHEETS.USERS');
    return s;
  },

  _currentUserNow: function() {
    try {
      return Utils.getCurrentTimestamp();
    } catch (e) {
      Logger.log('UserService._currentUserNow error: ' + (e && e.message ? e.message : e));
      return new Date().getTime();
    }
  },

  _mustUserIdCol: function() {
    var idCol = CONFIG.COLUMNS && CONFIG.COLUMNS.USER_ID;
    if (!idCol) throw new Error('Missing CONFIG.COLUMNS.USER_ID');
    return idCol;
  },

  _mustUsernameCol: function() {
  var col = CONFIG.COLUMNS && CONFIG.COLUMNS.USER_USERNAME;

  if (!col) {
    throw new Error("Missing CONFIG.COLUMNS.USER_USERNAME");
  }

  return col;
},
 _mustEmailCol: function() {
  var col = CONFIG.COLUMNS && CONFIG.COLUMNS.USER_EMAIL_ADDRESS;

  if (!col) {
    throw new Error("Missing CONFIG.COLUMNS.USER_EMAIL_ADDRESS");
  }

  return col;
},
  _mustRoleCol: function() {
    var col = CONFIG.COLUMNS && (CONFIG.COLUMNS.ROLE || CONFIG.COLUMNS.USER_ROLE);
    if (!col) throw new Error('Missing CONFIG.COLUMNS.ROLE/USER_ROLE');
    return col;
  },

  _mustStatusCol: function() {
    var col = CONFIG.COLUMNS && (CONFIG.COLUMNS.STATUS || CONFIG.COLUMNS.USER_STATUS);
    if (!col) throw new Error('Missing CONFIG.COLUMNS.STATUS/USER_STATUS');
    return col;
  },

  _getPasswordColumns: function() {
    var hashCol = CONFIG.COLUMNS && CONFIG.COLUMNS.USER_PASSWORD_HASH;
    var saltCol = CONFIG.COLUMNS && (CONFIG.COLUMNS.USER_SALT || CONFIG.COLUMNS.SALT);
    return { hashCol: hashCol, saltCol: saltCol };
  },

  _sanitizeUserSafe: function(user) {
    try {
      if (!user) return null;
      if (Utils && typeof Utils.sanitizeUser === 'function') return Utils.sanitizeUser(user);
      var out = Object.assign({}, user);
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_PASSWORD_HASH) delete out[CONFIG.COLUMNS.USER_PASSWORD_HASH];
      if (CONFIG.COLUMNS && (CONFIG.COLUMNS.USER_SALT || CONFIG.COLUMNS.SALT)) {
        var saltKey = CONFIG.COLUMNS.USER_SALT || CONFIG.COLUMNS.SALT;
        delete out[saltKey];
      }
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_OTP) delete out[CONFIG.COLUMNS.USER_OTP];
      return out;
    } catch (e) {
      Logger.log('UserService._sanitizeUserSafe error: ' + (e && e.message ? e.message : e));
      return null;
    }
  },

 _isUsernameAvailable: function(username) {
  try {

    var usersSheet = this._mustUsersSheet();

    var usernameCol = CONFIG.COLUMNS.USER_USERNAME;

    if (!usernameCol) {
      throw new Error("Missing CONFIG.COLUMNS.USER_USERNAME");
    }

    // Username exists?
    if (DatabaseService.exists(usersSheet, usernameCol, username)) {
      return false;
    }

    return true;

  } catch (e) {
    Logger.log(
      "UserService._isUsernameAvailable error: " +
      (e && e.message ? e.message : e)
    );
    return false;
  }
},

  _isEmailAvailable: function(email) {
    try {
      var usersSheet = this._mustUsersSheet();
      var col = CONFIG.COLUMNS && (CONFIG.COLUMNS.EMAIL || CONFIG.COLUMNS.USER_EMAIL);
      if (!col) throw new Error('Missing CONFIG.COLUMNS.EMAIL/USER_EMAIL');
      return !DatabaseService.exists(usersSheet, col, email);
    } catch (e) {
      Logger.log('UserService._isEmailAvailable error: ' + (e && e.message ? e.message : e));
      return false;
    }
  },

  _getUserByIdRecord: function(userId) {
    try {
      var usersSheet = this._mustUsersSheet();
      var idCol = this._mustUserIdCol();
      var records = DatabaseService.findByColumn(usersSheet, idCol, userId, { caseSensitive: true, strict: true });
      return (records && records.length) ? records[0] : null;
    } catch (e) {
      Logger.log('UserService._getUserByIdRecord error: ' + (e && e.message ? e.message : e));
      return null;
    }
  },

  _validateCreateUpdate: function(userData) {
    try {
      var validationResult = ValidationService.validateUser(userData);
      if (!validationResult || !validationResult.valid) {
        var msg = validationResult && validationResult.errors ? validationResult.errors.join(' ') : (CONFIG.MESSAGES && CONFIG.MESSAGES.VALIDATION_FAILED ? CONFIG.MESSAGES.VALIDATION_FAILED : 'Validation failed');
        return { valid: false, message: msg };
      }
      return { valid: true };
    } catch (e) {
      Logger.log('UserService._validateCreateUpdate error: ' + (e && e.message ? e.message : e));
      return { valid: false, message: (CONFIG.MESSAGES && CONFIG.MESSAGES.VALIDATION_FAILED) ? CONFIG.MESSAGES.VALIDATION_FAILED : 'Validation failed' };
    }
  },

  _buildStatusUpdate: function(statusValue) {
    var updates = {};
    var statusCol = CONFIG.COLUMNS && (CONFIG.COLUMNS.STATUS || CONFIG.COLUMNS.USER_STATUS);
    if (statusCol) updates[statusCol] = statusValue;
    if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_AT) updates[CONFIG.COLUMNS.UPDATED_AT] = Utils.getCurrentTimestamp();
    return updates;
  },

  // ==============================
  // Public API (backward compatible signatures)
  // ==============================

  createUser: function(userData) {
    try {
      if (!userData) return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_CREATE_FAILED) ? CONFIG.MESSAGES.USER_CREATE_FAILED : 'User data missing');

      var usersSheet = this._mustUsersSheet();
      var userIdCol = this._mustUserIdCol();
      var usernameCol = this._mustUsernameCol();
      var emailCol = this._mustEmailCol();
      var roleCol = this._mustRoleCol();
      var statusCol = this._mustStatusCol();

      var username = userData[usernameCol] || userData.username || userData.userName || userData.usernameValue;
      var email = userData[emailCol] || userData.email;

      if (Utils.checkEmptyValue && Utils.checkEmptyValue(username)) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USERNAME_REQUIRED) ? CONFIG.MESSAGES.USERNAME_REQUIRED : 'Username is required');
      }
      if (Utils.checkEmptyValue && Utils.checkEmptyValue(email)) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.EMAIL_REQUIRED) ? CONFIG.MESSAGES.EMAIL_REQUIRED : 'Email is required');
      }

      var userToCreate = Object.assign({}, userData);
      userToCreate.role = userToCreate.role || (CONFIG.ROLES && CONFIG.ROLES.COORDINATOR ? CONFIG.ROLES.COORDINATOR : userToCreate[roleCol]);
      userToCreate.status = userToCreate.status || (CONFIG.USER_STATUS && CONFIG.USER_STATUS.ACTIVE ? CONFIG.USER_STATUS.ACTIVE : userToCreate[statusCol]);

      var validation = this._validateCreateUpdate(userToCreate);
      if (!validation.valid) return Utils.buildResponse(false, validation.message);

      if (!this._isUsernameAvailable(username)) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USERNAME_EXISTS) ? CONFIG.MESSAGES.USERNAME_EXISTS : 'Username already exists');
      }
      if (!this._isEmailAvailable(email)) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.EMAIL_EXISTS) ? CONFIG.MESSAGES.EMAIL_EXISTS : 'Email already exists');
      }

      var userId = IdService.generateUserId();
      var passCols = this._getPasswordColumns();
      if (!passCols.hashCol) throw new Error('Missing CONFIG.COLUMNS.USER_PASSWORD_HASH');

      var rawPassword = Utils.generateRandomPassword ? Utils.generateRandomPassword() : String(new Date().getTime());
      var salt = passCols.saltCol && Utils.generateSalt ? Utils.generateSalt() : null;
      var hashedPassword = salt ? Utils.hashString(String(rawPassword) + ':' + String(salt)) : Utils.hashString(String(rawPassword));

      var now = this._currentUserNow();

      var newUser = {};
      newUser[userIdCol] = userId;
      // Employee ID
if (CONFIG.COLUMNS.USER_EMPLOYEE_ID) {
  newUser[CONFIG.COLUMNS.USER_EMPLOYEE_ID] =
    userData[CONFIG.COLUMNS.USER_EMPLOYEE_ID];
}

// First Name
if (CONFIG.COLUMNS.USER_FIRST_NAME) {
  newUser[CONFIG.COLUMNS.USER_FIRST_NAME] =
    userData[CONFIG.COLUMNS.USER_FIRST_NAME];
}

// Last Name
if (CONFIG.COLUMNS.USER_LAST_NAME) {
  newUser[CONFIG.COLUMNS.USER_LAST_NAME] =
    userData[CONFIG.COLUMNS.USER_LAST_NAME];
}
      newUser[usernameCol] = username;
      newUser[emailCol] = email;
      newUser[roleCol] = userToCreate.role || CONFIG.ROLES.COORDINATOR;
      newUser[statusCol] = userToCreate.status || (CONFIG.USER_STATUS ? CONFIG.USER_STATUS.ACTIVE : userToCreate[statusCol]);
      newUser[passCols.hashCol] = hashedPassword;
      if (salt && passCols.saltCol) newUser[passCols.saltCol] = salt;

      if (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_FIRST_LOGIN) newUser[CONFIG.COLUMNS.USER_FIRST_LOGIN] = true;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_PASSWORD_RESET_REQUIRED) newUser[CONFIG.COLUMNS.USER_PASSWORD_RESET_REQUIRED] = true;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_FAILED_ATTEMPTS) newUser[CONFIG.COLUMNS.USER_FAILED_ATTEMPTS] = 0;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_ACCOUNT_LOCKED) newUser[CONFIG.COLUMNS.USER_ACCOUNT_LOCKED] = false;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_PASSWORD_LAST_CHANGED) newUser[CONFIG.COLUMNS.USER_PASSWORD_LAST_CHANGED] = now;

      if (CONFIG.COLUMNS && CONFIG.COLUMNS.CREATED_AT) newUser[CONFIG.COLUMNS.CREATED_AT] = now;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_AT) newUser[CONFIG.COLUMNS.UPDATED_AT] = now;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.CREATED_BY) newUser[CONFIG.COLUMNS.CREATED_BY] = userData[CONFIG.COLUMNS.CREATED_BY] || userData.createdBy || username;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_BY) newUser[CONFIG.COLUMNS.UPDATED_BY] = userData[CONFIG.COLUMNS.UPDATED_BY] || userData[CONFIG.COLUMNS.CREATED_BY] || '';

      if (CONFIG.COLUMNS && CONFIG.COLUMNS.DELETION_FLAG) newUser[CONFIG.COLUMNS.DELETION_FLAG] = false;

      var inserted = DatabaseService.insertRow(usersSheet, newUser);
      if (!inserted) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_CREATE_FAILED) ? CONFIG.MESSAGES.USER_CREATE_FAILED : 'User create failed');
      }

      var resp = Utils.buildResponse(true, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_CREATED) ? CONFIG.MESSAGES.USER_CREATED : 'User created', { user: this._sanitizeUserSafe(inserted || newUser) });

      try {
        // userId is the entity id; updatedBy/createdBy is best-effort from input.
        AuditService.logAction(
          userId,
          'UserService',
          'CREATE_USER',
          userId,
          'User',
          'User created',
          '',
          'SUCCESS',
          (userData && (userData.updatedBy || userData[CONFIG.COLUMNS && CONFIG.COLUMNS.CREATED_BY ? CONFIG.COLUMNS.CREATED_BY : ''])) || (userData && (userData.createdBy || userData.created_by)) || username
        );
      } catch (error) {
        Logger.log(error);
      }

      return resp;
    } catch (e) {
      Logger.log('UserService.createUser error: ' + (e && e.message ? e.message : e));
      return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_CREATE_FAILED) ? CONFIG.MESSAGES.USER_CREATE_FAILED : 'User create failed');
    }
  },

  updateUser: function(userId, userData) {
    try {
      var usersSheet = this._mustUsersSheet();
      var idCol = this._mustUserIdCol();

      if (!DatabaseService.exists(usersSheet, idCol, userId)) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_NOT_FOUND) ? CONFIG.MESSAGES.USER_NOT_FOUND : 'User not found');
      }

      var existing = this._getUserByIdRecord(userId);
      if (!existing) return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_NOT_FOUND) ? CONFIG.MESSAGES.USER_NOT_FOUND : 'User not found');

      var usernameCol = this._mustUsernameCol();
      var emailCol = this._mustEmailCol();
      var roleCol = this._mustRoleCol();
      var statusCol = this._mustStatusCol();

      var editableData = Object.assign({}, userData);

      // Prevent overwriting identity and sensitive values
      delete editableData[idCol];
      var passCols = this._getPasswordColumns();
      if (passCols.hashCol) delete editableData[passCols.hashCol];
      if (passCols.saltCol) delete editableData[passCols.saltCol];

      // Uniqueness if changed
      if (editableData[usernameCol] !== undefined && editableData[usernameCol] !== existing[usernameCol]) {
        if (!this._isUsernameAvailable(editableData[usernameCol])) {
          return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USERNAME_EXISTS) ? CONFIG.MESSAGES.USERNAME_EXISTS : 'Username already exists');
        }
      }
      if (editableData[emailCol] !== undefined && editableData[emailCol] !== existing[emailCol]) {
        if (!this._isEmailAvailable(editableData[emailCol])) {
          return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.EMAIL_EXISTS) ? CONFIG.MESSAGES.EMAIL_EXISTS : 'Email already exists');
        }
      }

      // Audit
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_AT) editableData[CONFIG.COLUMNS.UPDATED_AT] = Utils.getCurrentTimestamp();
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_BY && userData && userData[CONFIG.COLUMNS.UPDATED_BY] !== undefined) {
        editableData[CONFIG.COLUMNS.UPDATED_BY] = userData[CONFIG.COLUMNS.UPDATED_BY];
      }

      var validationInput = Object.assign({}, existing);
      Object.assign(validationInput, editableData);
      var validation = this._validateCreateUpdate(validationInput);
      if (!validation.valid) return Utils.buildResponse(false, validation.message);

      var updated = DatabaseService.updateRow(usersSheet, idCol, userId, editableData);
      if (!updated) return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_UPDATE_FAILED) ? CONFIG.MESSAGES.USER_UPDATE_FAILED : 'User update failed');

      var resp = Utils.buildResponse(true, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_UPDATED) ? CONFIG.MESSAGES.USER_UPDATED : 'User updated', { user: this._sanitizeUserSafe(updated) });

      try {
        var auditRemarks = (userData && (userData.updatedBy || userData[CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_BY ? CONFIG.COLUMNS.UPDATED_BY : ''])) || '';
        AuditService.logAction(
          userId,
          'UserService',
          'UPDATE_USER',
          userId,
          'User',
          'User updated',
          '',
          'SUCCESS',
          auditRemarks
        );
      } catch (error) {
        Logger.log(error);
      }

      return resp;
    } catch (e) {
      Logger.log('UserService.updateUser error: ' + (e && e.message ? e.message : e));
      return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_UPDATE_FAILED) ? CONFIG.MESSAGES.USER_UPDATE_FAILED : 'User update failed');
    }
  },

  deleteUser: function(userId, updatedBy) {
    try {
      var usersSheet = this._mustUsersSheet();
      var idCol = this._mustUserIdCol();

      if (!DatabaseService.exists(usersSheet, idCol, userId)) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_NOT_FOUND) ? CONFIG.MESSAGES.USER_NOT_FOUND : 'User not found');
      }

      // Soft delete via DatabaseService
      var ok = DatabaseService.deleteRow(usersSheet, idCol, userId);
      if (!ok) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_DELETE_FAILED) ? CONFIG.MESSAGES.USER_DELETE_FAILED : 'User delete failed');
      }

      var resp = Utils.buildResponse(true, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_DELETED) ? CONFIG.MESSAGES.USER_DELETED : 'User deleted');
      try {
        AuditService.logAction(
          userId,
          'UserService',
          'DELETE_USER',
          userId,
          'User',
          'User deleted',
          '',
          'SUCCESS',
          updatedBy || ''
        );
      } catch (error) {
        Logger.log(error);
      }
      return resp;
    } catch (e) {
      Logger.log('UserService.deleteUser error: ' + (e && e.message ? e.message : e));
      return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_DELETE_FAILED) ? CONFIG.MESSAGES.USER_DELETE_FAILED : 'User delete failed');
    }
  },

  activateUser: function(userId, updatedBy) {
    try {
      var usersSheet = this._mustUsersSheet();
      var idCol = this._mustUserIdCol();
      var statusCol = CONFIG.COLUMNS && (CONFIG.COLUMNS.STATUS || CONFIG.COLUMNS.USER_STATUS);
      if (!statusCol) throw new Error('Missing CONFIG.COLUMNS.STATUS/USER_STATUS');

      if (!DatabaseService.exists(usersSheet, idCol, userId)) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_NOT_FOUND) ? CONFIG.MESSAGES.USER_NOT_FOUND : 'User not found');
      }

      var updates = {};
      updates[statusCol] = CONFIG.USER_STATUS && CONFIG.USER_STATUS.ACTIVE ? CONFIG.USER_STATUS.ACTIVE : 'Active';
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_AT) updates[CONFIG.COLUMNS.UPDATED_AT] = Utils.getCurrentTimestamp();
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_BY && updatedBy !== undefined) updates[CONFIG.COLUMNS.UPDATED_BY] = updatedBy;

      var updated = DatabaseService.updateRow(usersSheet, idCol, userId, updates);
      if (!updated) return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_ACTIVATE_FAILED) ? CONFIG.MESSAGES.USER_ACTIVATE_FAILED : 'Activation failed');

      return Utils.buildResponse(true, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_ACTIVATED) ? CONFIG.MESSAGES.USER_ACTIVATED : 'User activated', { user: this._sanitizeUserSafe(updated) });
    } catch (e) {
      Logger.log('UserService.activateUser error: ' + (e && e.message ? e.message : e));
      return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_ACTIVATE_FAILED) ? CONFIG.MESSAGES.USER_ACTIVATE_FAILED : 'Activation failed');
    }
  },

  deactivateUser: function(userId, updatedBy) {
    try {
      var usersSheet = this._mustUsersSheet();
      var idCol = this._mustUserIdCol();
      var statusCol = CONFIG.COLUMNS && (CONFIG.COLUMNS.STATUS || CONFIG.COLUMNS.USER_STATUS);
      if (!statusCol) throw new Error('Missing CONFIG.COLUMNS.STATUS/USER_STATUS');

      if (!DatabaseService.exists(usersSheet, idCol, userId)) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_NOT_FOUND) ? CONFIG.MESSAGES.USER_NOT_FOUND : 'User not found');
      }

      var updates = {};
      updates[statusCol] = CONFIG.USER_STATUS && CONFIG.USER_STATUS.INACTIVE ? CONFIG.USER_STATUS.INACTIVE : 'Inactive';
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_AT) updates[CONFIG.COLUMNS.UPDATED_AT] = Utils.getCurrentTimestamp();
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_BY && updatedBy !== undefined) updates[CONFIG.COLUMNS.UPDATED_BY] = updatedBy;

      var updated = DatabaseService.updateRow(usersSheet, idCol, userId, updates);
      if (!updated) return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_DEACTIVATE_FAILED) ? CONFIG.MESSAGES.USER_DEACTIVATE_FAILED : 'Deactivation failed');

      return Utils.buildResponse(true, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_DEACTIVATED) ? CONFIG.MESSAGES.USER_DEACTIVATED : 'User deactivated', { user: this._sanitizeUserSafe(updated) });
    } catch (e) {
      Logger.log('UserService.deactivateUser error: ' + (e && e.message ? e.message : e));
      return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_DEACTIVATE_FAILED) ? CONFIG.MESSAGES.USER_DEACTIVATE_FAILED : 'Deactivation failed');
    }
  },

  resetPassword: function(userId, updatedBy) {
    try {
      var usersSheet = this._mustUsersSheet();
      var idCol = this._mustUserIdCol();

      if (!DatabaseService.exists(usersSheet, idCol, userId)) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_NOT_FOUND) ? CONFIG.MESSAGES.USER_NOT_FOUND : 'User not found');
      }

      var passCols = this._getPasswordColumns();
      if (!passCols.hashCol) throw new Error('Missing CONFIG.COLUMNS.USER_PASSWORD_HASH');

      var tempPassword = Utils.generateRandomPassword ? Utils.generateRandomPassword() : String(new Date().getTime());
      var salt = passCols.saltCol && Utils.generateSalt ? Utils.generateSalt() : null;
      var hashedPassword = salt ? Utils.hashString(String(tempPassword) + ':' + String(salt)) : Utils.hashString(String(tempPassword));

      var now = Utils.getCurrentTimestamp();
      var updateData = {};
      updateData[passCols.hashCol] = hashedPassword;
      if (passCols.saltCol) updateData[passCols.saltCol] = salt;

      if (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_FIRST_LOGIN) updateData[CONFIG.COLUMNS.USER_FIRST_LOGIN] = true;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_PASSWORD_RESET_REQUIRED) updateData[CONFIG.COLUMNS.USER_PASSWORD_RESET_REQUIRED] = true;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_FAILED_ATTEMPTS) updateData[CONFIG.COLUMNS.USER_FAILED_ATTEMPTS] = 0;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_ACCOUNT_LOCKED) updateData[CONFIG.COLUMNS.USER_ACCOUNT_LOCKED] = false;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_PASSWORD_LAST_CHANGED) updateData[CONFIG.COLUMNS.USER_PASSWORD_LAST_CHANGED] = now;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_BY && updatedBy !== undefined) updateData[CONFIG.COLUMNS.UPDATED_BY] = updatedBy;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_AT) updateData[CONFIG.COLUMNS.UPDATED_AT] = now;

      var success = DatabaseService.updateRow(usersSheet, idCol, userId, updateData);
      
      if (!success) return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.PASSWORD_RESET_FAILED) ? CONFIG.MESSAGES.PASSWORD_RESET_FAILED : 'Password reset failed');
      try {
  AuditService.logAction(
    userId,
    "UserService",
    "RESET_PASSWORD",
    userId,
    "User",
    "Password reset",
    "",
    "SUCCESS",
    updatedBy || ""
  );
} catch (error) {
  Logger.log(error);
}

      // Important: return only the temporary password, no hashes/salts.
      return Utils.buildResponse(true, (CONFIG.MESSAGES && CONFIG.MESSAGES.PASSWORD_RESET_SUCCESS) ? CONFIG.MESSAGES.PASSWORD_RESET_SUCCESS : 'Password reset success', { temporaryPassword: tempPassword });
    } catch (e) {
      Logger.log('UserService.resetPassword error: ' + (e && e.message ? e.message : e));
      return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.PASSWORD_RESET_FAILED) ? CONFIG.MESSAGES.PASSWORD_RESET_FAILED : 'Password reset failed');
    }
  },

  changePassword: function(userId, oldPassword, newPassword, updatedBy) {
    try {
      if (AuthService && typeof AuthService.changePassword === 'function') {
        return AuthService.changePassword(userId, oldPassword, newPassword);
      }

      // If AuthService doesn't exist, do best-effort local update using existing hashing rules.
      var user = this.getUserById(userId);
      if (!user || !user.success || !user.user) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_NOT_FOUND) ? CONFIG.MESSAGES.USER_NOT_FOUND : 'User not found');
      }

      // Validate newPassword
      var req = ValidationService.validatePassword ? ValidationService.validatePassword(newPassword) : null;
      if (req) return Utils.buildResponse(false, req);

      var passCols = this._getPasswordColumns();
      if (!passCols.hashCol) throw new Error('Missing CONFIG.COLUMNS.USER_PASSWORD_HASH');

      var record = this._getUserByIdRecord(userId);
      if (!record) throw new Error('User record not found');

      var salt = passCols.saltCol ? record[passCols.saltCol] : null;
      var hashed = salt ? Utils.hashString(String(salt) + ':' + String(newPassword).trim()) : Utils.hashString(String(newPassword).trim());

      var updateData = {};
      updateData[passCols.hashCol] = hashed;
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.USER_PASSWORD_LAST_CHANGED) updateData[CONFIG.COLUMNS.USER_PASSWORD_LAST_CHANGED] = Utils.getCurrentTimestamp();
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_AT) updateData[CONFIG.COLUMNS.UPDATED_AT] = Utils.getCurrentTimestamp();
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_BY && updatedBy !== undefined) updateData[CONFIG.COLUMNS.UPDATED_BY] = updatedBy;

      var ok = DatabaseService.updateRow(this._mustUsersSheet(), this._mustUserIdCol(), userId, updateData);
      if (!ok) return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.PASSWORD_CHANGE_FAILED) ? CONFIG.MESSAGES.PASSWORD_CHANGE_FAILED : 'Password change failed');

      return Utils.buildResponse(true, (CONFIG.MESSAGES && CONFIG.MESSAGES.PASSWORD_CHANGED) ? CONFIG.MESSAGES.PASSWORD_CHANGED : 'Password changed');
    } catch (e) {
      Logger.log('UserService.changePassword error: ' + (e && e.message ? e.message : e));
      return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.PASSWORD_CHANGE_FAILED) ? CONFIG.MESSAGES.PASSWORD_CHANGE_FAILED : 'Password change failed');
    }
  },

  // ==============================
  // Listing/search/filter/sort/pagination
  // ==============================

  paginateUsers: function(page, pageSize) {
  try {

    page = parseInt(page, 10) || 1;
    pageSize = parseInt(pageSize, 10) || 10;

    if (page < 1) page = 1;
    if (pageSize < 1) pageSize = 10;

    var users = (DatabaseService.readAllRows(CONFIG.SHEETS.USERS) || [])
  .filter(function(user) {
    return user[CONFIG.COLUMNS.DELETION_FLAG] !== true &&
           user[CONFIG.COLUMNS.DELETION_FLAG] !== "true";
  });
    var totalRecords = users.length;

    if (totalRecords === 0) {
      return {
        totalRecords: 0,
        currentPage: 1,
        pageSize: pageSize,
        totalPages: 0,
        hasPrevious: false,
        hasNext: false,
        items: []
      };
    }

    var totalPages = Math.ceil(totalRecords / pageSize);

    if (page > totalPages) {
      page = totalPages;
    }

    var start = (page - 1) * pageSize;
    var end = start + pageSize;

    var items = users.slice(start, end).map(function(user) {
      return Utils.sanitizeUser(user);
    });

    return {
      totalRecords: totalRecords,
      currentPage: page,
      pageSize: pageSize,
      totalPages: totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
      items: items
    };

  } catch (e) {
    Logger.log(
      "UserService.paginateUsers error: " +
      (e && e.message ? e.message : e)
    );

    return {
      totalRecords: 0,
      currentPage: 1,
      pageSize: 10,
      totalPages: 0,
      hasPrevious: false,
      hasNext: false,
      items: []
    };
  }
},
  sortUsers: function(sortBy, order) {
  try {

    var allowedFields = [
      CONFIG.COLUMNS.USER_FIRST_NAME,
      CONFIG.COLUMNS.USER_LAST_NAME,
      CONFIG.COLUMNS.USER_USERNAME,
      CONFIG.COLUMNS.USER_ROLE,
      CONFIG.COLUMNS.USER_STATUS,
      CONFIG.COLUMNS.CREATED_AT
    ].filter(function(field) {
      return !!field;
    });

    if (allowedFields.indexOf(sortBy) === -1) {
      return Utils.buildResponse(false, "Invalid sort column.");
    }

    order = String(order || "asc").toLowerCase();

    var users = DatabaseService.readAllRows(CONFIG.SHEETS.USERS) || [];

    // Ignore deleted users
    users = users.filter(function(user) {
      return user[CONFIG.COLUMNS.DELETION_FLAG] !== true &&
             user[CONFIG.COLUMNS.DELETION_FLAG] !== "true";
    });

    users.sort(function(a, b) {

      var valA = a[sortBy] || "";
      var valB = b[sortBy] || "";

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return order === "desc" ? 1 : -1;
      if (valA > valB) return order === "desc" ? -1 : 1;

      return 0;

    });

    return Utils.buildResponse(
      true,
      "Users sorted successfully.",
      {
        users: users.map(function(user) {
          return Utils.sanitizeUser(user);
        })
      }
    );

  } catch (e) {

    Logger.log(
      "UserService.sortUsers error: " +
      (e && e.message ? e.message : e)
    );

    return Utils.buildResponse(
      false,
      "Sorting failed."
    );
  }
},

 updateProfile: function(userId, profileData, updatedBy) {
    try {
      var usersSheet = this._mustUsersSheet();
      var idCol = this._mustUserIdCol();

      // 1. Verify user existence before attempting any operations
      if (!DatabaseService.exists(usersSheet, idCol, userId)) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.USER_NOT_FOUND) ? CONFIG.MESSAGES.USER_NOT_FOUND : 'User not found');
      }

      // 2. Validate incoming profile payload
      if (!profileData || typeof profileData !== 'object' || Array.isArray(profileData)) {
        return Utils.buildResponse(false, 'No profile data to update.');
      }

      // 3. Dynamically collect strictly allowed profile fields from CONFIG.COLUMNS
      var allowedFields = [
    CONFIG.COLUMNS.USER_FIRST_NAME,
    CONFIG.COLUMNS.USER_LAST_NAME,
    CONFIG.COLUMNS.USER_EMAIL_ADDRESS,
    CONFIG.COLUMNS.USER_PHONE,
    CONFIG.COLUMNS.USER_PROFILE_PICTURE,
    CONFIG.COLUMNS.USER_BIO,
    CONFIG.COLUMNS.USER_THEME,
    CONFIG.COLUMNS.USER_LANGUAGE,
    CONFIG.COLUMNS.USER_TIMEZONE,
    CONFIG.COLUMNS.USER_POPUP_NOTIFICATIONS,
    CONFIG.COLUMNS.USER_NOTIFICATION_SOUND
].filter(function(field) {
    return !!field;
});
      var profileKeys = [
        'USER_FIRST_NAME', 'USER_LAST_NAME', 'USER_EMAIL_ADDRESS', 
        'USER_PHONE', 'USER_PROFILE_PICTURE', 'USER_BIO', 
        'USER_LANGUAGE', 'USER_THEME', 'USER_TIMEZONE', 
        'USER_POPUP_NOTIFICATIONS', 'USER_NOTIFICATION_SOUND'
      ];

      for (var i = 0; i < profileKeys.length; i++) {
        var columnMapping = CONFIG.COLUMNS[profileKeys[i]];
        if (columnMapping) {
          allowedFields.push(columnMapping);
        }
      }

      // 4. Extract and filter data using a secure whitelist approach
      var updateData = {};
      var hasValidUpdates = false;

      for (var j = 0; j < allowedFields.length; j++) {
        var fieldName = allowedFields[j];
        if (profileData[fieldName] !== undefined) {
          // Input sanitization: Trim strings to prevent accidental white space contamination
          var value = profileData[fieldName];
          updateData[fieldName] = (typeof value === 'string') ? value.trim() : value;
          hasValidUpdates = true;
        }
      }

      // 5. Fail early if no valid properties are targeted for updates
      if (!hasValidUpdates) {
        return Utils.buildResponse(false, 'No profile data to update.');
      }

      // 6. Enforce systemic metadata fields
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_AT) {
        updateData[CONFIG.COLUMNS.UPDATED_AT] = Utils.getCurrentTimestamp();
      }
      if (CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_BY && updatedBy !== undefined) {
        updateData[CONFIG.COLUMNS.UPDATED_BY] = updatedBy;
      }

      // 7. Write securely to database layer
      var success = DatabaseService.updateRow(usersSheet, idCol, userId, updateData);
      if (!success) {
        return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.PROFILE_UPDATE_FAILED) ? CONFIG.MESSAGES.PROFILE_UPDATE_FAILED : 'Profile update failed');
      }

      // 8. Generate Audit trail log
      try {
        AuditService.logAction(
          userId,
          "UserService",
          "UPDATE_PROFILE",
          userId,
          "User",
          "Profile updated",
          "",
          "SUCCESS",
          updatedBy || ""
        );
      } catch (auditError) {
        // Log audit failure but do not break execution context for the user
        Logger.log('UserService.updateProfile audit logging warning: ' + (auditError && auditError.message ? auditError.message : auditError));
      }

      // 9. Return structured success payload
      return Utils.buildResponse(true, (CONFIG.MESSAGES && CONFIG.MESSAGES.PROFILE_UPDATED) ? CONFIG.MESSAGES.PROFILE_UPDATED : 'Profile updated');

    } catch (e) {
      Logger.log('UserService.updateProfile error: ' + (e && e.message ? e.message : e));
      return Utils.buildResponse(false, (CONFIG.MESSAGES && CONFIG.MESSAGES.PROFILE_UPDATE_FAILED) ? CONFIG.MESSAGES.PROFILE_UPDATE_FAILED : 'Profile update failed');
    }
  },

updatePreferences: function(userId, preferences, updatedBy) {
  try {
    var usersSheet = CONFIG.SHEETS.USERS;
    var idCol = CONFIG.COLUMNS.USER_ID;

    // Check user exists
    if (!DatabaseService.exists(usersSheet, idCol, userId)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.USER_NOT_FOUND);
    }

    // Allowed preference fields
    var allowedFields = [
      CONFIG.COLUMNS.USER_THEME,
      CONFIG.COLUMNS.USER_LANGUAGE,
      CONFIG.COLUMNS.USER_TIMEZONE,
      CONFIG.COLUMNS.USER_POPUP_NOTIFICATIONS,
      CONFIG.COLUMNS.USER_NOTIFICATION_SOUND
    ].filter(function(field) {
      return !!field;
    });

    var updateData = {};

    allowedFields.forEach(function(field) {
      if (preferences && preferences[field] !== undefined) {
        updateData[field] = preferences[field];
      }
    });

    // Nothing to update
    if (Object.keys(updateData).length === 0) {
      return Utils.buildResponse(false, "No preferences to update.");
    }

    // Audit fields
    if (CONFIG.COLUMNS.UPDATED_AT) {
      updateData[CONFIG.COLUMNS.UPDATED_AT] = Utils.getCurrentTimestamp();
    }

    if (CONFIG.COLUMNS.UPDATED_BY) {
      updateData[CONFIG.COLUMNS.UPDATED_BY] = updatedBy || "";
    }

    var success = DatabaseService.updateRow(
      usersSheet,
      idCol,
      userId,
      updateData
    );

    if (!success) {
      return Utils.buildResponse(
        false,
        CONFIG.MESSAGES.PREFERENCES_UPDATE_FAILED
      );
    }

    try {
      AuditService.logAction(
        userId,
        "UserService",
        "UPDATE_PREFERENCES",
        userId,
        "User",
        "Preferences updated",
        "",
        "SUCCESS",
        updatedBy || ""
      );
    } catch (auditError) {
      Logger.log(auditError);
    }

    return Utils.buildResponse(
      true,
      CONFIG.MESSAGES.PREFERENCES_UPDATED
    );

  } catch (e) {
    Logger.log(
      "UserService.updatePreferences error: " +
      (e && e.message ? e.message : e)
    );

    return Utils.buildResponse(
      false,
      CONFIG.MESSAGES.PREFERENCES_UPDATE_FAILED
    );
  }
}
};
Object.freeze(UserService);

