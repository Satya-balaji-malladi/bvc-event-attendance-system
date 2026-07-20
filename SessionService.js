/**
 * SessionService.gs
 * Service for handling user sessions and authorization.
 * Exclusively manages session state and validation.
 */
const SessionService = {

  // ======== Internal helpers ========

  /**
   * Resolves a column header key using CONFIG.COLUMNS first.
   * If missing, falls back to the existing header name already used by this project.
   * IMPORTANT: Never invent new header names.
   */
  _col: function(configKey, fallbackHeaderName, todoTag) {
    try {
      if (CONFIG && CONFIG.COLUMNS && CONFIG.COLUMNS[configKey]) return CONFIG.COLUMNS[configKey];
      // Fallback: keep the original header name used by this project.
      // TODO: Move this header mapping into CONFIG.COLUMNS.
      if (todoTag) {
        // Intentionally no-op; the TODO marker is below at call sites.
      }
      return fallbackHeaderName;
    } catch (e) {
      Logger.log('SessionService._col error: ' + (e && e.message ? e.message : e));
      return fallbackHeaderName;
    }
  },

  // Token generator: uses Utils.generateUUID if available, else falls back to Utilities.getUuid.
  generateSessionToken: function() {
    try {
      if (typeof Utils !== 'undefined' && Utils && typeof Utils.generateUUID === 'function') {
        return Utils.generateUUID();
      }
      return Utilities.getUuid();
    } catch (e) {
      Logger.log('SessionService.generateSessionToken error: ' + (e && e.message ? e.message : e));
      return Utilities.getUuid();
    }
  },

  // Helper to resolve timestamps safely from Date objects, strings, or numbers
  _getTimestamp: function(val) {
    if (!val) return 0;
    if (val instanceof Date) return val.getTime();
    var t = new Date(val).getTime();
    return isNaN(t) ? 0 : t;
  },

  createSession: function(user) {
    try {
      if (!user) throw new Error('User is required');

      var userIdCol = this._col('USER_ID', 'User ID', 'USER_ID');
      var userId = user[userIdCol];
      if (typeof Utils !== 'undefined' && Utils && typeof Utils.checkEmptyValue === 'function') {
        if (Utils.checkEmptyValue(userId)) throw new Error('Invalid user');
      } else if (!userId) {
        throw new Error('Invalid user');
      }

      var sessionId = (typeof IdService !== 'undefined' && IdService && typeof IdService.generateSessionId === 'function') 
        ? IdService.generateSessionId() 
        : ('SES' + Math.floor(Math.random() * 1000000));
      var sessionToken = this.generateSessionToken();

      const loginTime = new Date();
      var timeoutMinutes = (CONFIG && CONFIG.SECURITY && CONFIG.SECURITY.SESSION_TIMEOUT_MINUTES) ? CONFIG.SECURITY.SESSION_TIMEOUT_MINUTES : 480;
      const expiryTime = new Date(loginTime.getTime() + timeoutMinutes * 60000);

      var c = (CONFIG && CONFIG.COLUMNS) ? CONFIG.COLUMNS : {};
      var updates = {};

      var sessionSheet = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.SESSIONS) ? CONFIG.SHEETS.SESSIONS : 'Sessions';
      var userUsernameCol = c.USER_USERNAME || 'Username';
      var activeStatus = (CONFIG && CONFIG.SESSION_STATUS && CONFIG.SESSION_STATUS.ACTIVE) ? CONFIG.SESSION_STATUS.ACTIVE : 'Active';

      updates[c.SESSION_ID || 'Session ID'] = sessionId;
      updates[c.SESSION_USER_ID || 'User ID'] = userId;
      updates[c.SESSION_USERNAME || 'Username'] = user[userUsernameCol] || "";
      updates[c.SESSION_TOKEN || 'Session Token'] = sessionToken;
      updates[c.SESSION_LOGIN_TIMESTAMP || 'Login Timestamp'] = loginTime;
      updates[c.EXPIRY_TIME || 'Expiry Time'] = expiryTime;
      updates[c.SESSION_STATUS || 'Session Status'] = activeStatus;
      updates[c.SESSION_LAST_ACTIVITY_TIMESTAMP || 'Last Activity Timestamp'] = loginTime;

      if (c.CREATED_BY) updates[c.CREATED_BY] = userId;
      if (c.CREATED_AT) updates[c.CREATED_AT] = loginTime;

      Logger.log("===============");
      Logger.log("SESSION CREATED");
      Logger.log(JSON.stringify(updates));
      Logger.log("===============");

      if (typeof DatabaseService !== 'undefined' && DatabaseService && typeof DatabaseService.insertRow === 'function') {
        DatabaseService.insertRow(sessionSheet, updates);
      } else {
        throw new Error('DatabaseService not available');
      }
      return updates;
    } catch (error) {
      Logger.log('SessionService.createSession error: ' + (error && error.message ? error.message : error));
      var createFailedMsg = (CONFIG && CONFIG.MESSAGES && CONFIG.MESSAGES.SESSION_CREATE_FAILED) ? CONFIG.MESSAGES.SESSION_CREATE_FAILED : 'Session creation failed';
      throw new Error(createFailedMsg);
    }
  },

  getSession: function(sessionToken) {
    Logger.log("ENTER: SessionService.getSession");
    try {
      Logger.log("========== GET SESSION START ==========");
      Logger.log("Incoming Token: " + sessionToken);

      var isEmptyToken = false;
      if (typeof Utils !== 'undefined' && Utils && typeof Utils.checkEmptyValue === 'function') {
        isEmptyToken = Utils.checkEmptyValue(sessionToken);
      } else {
        isEmptyToken = !sessionToken || String(sessionToken).trim() === '';
      }

      if (isEmptyToken) {
        Logger.log("Session token is empty.");
        Logger.log("RETURNING FROM: SessionService.getSession");
        Logger.log("Returned value: null (Token empty fallback)");
        Logger.log("CRITICAL: Returning NULL");
        return null;
      }

      var tokenCol = this._col('SESSION_TOKEN', 'Session Token', 'SESSION_TOKEN');
      var sessionSheet = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.SESSIONS) ? CONFIG.SHEETS.SESSIONS : 'Sessions';
      var statusCol = this._col('SESSION_STATUS', 'Session Status', 'SESSION_STATUS');

      Logger.log("Using Token Column: " + tokenCol);
      Logger.log("Sessions Sheet: " + sessionSheet);

      if (typeof DatabaseService !== 'undefined' && DatabaseService && typeof DatabaseService.readAllRows === 'function') {
        // Read all sessions for debugging purposes
        var allSessions = DatabaseService.readAllRows(sessionSheet) || [];
        Logger.log("Total Sessions Found: " + allSessions.length);
        allSessions.forEach(function(row, index) {
          Logger.log(
            "Row " + (index + 1) + 
            " | Token = " + row[tokenCol] + 
            " | Status = " + row[statusCol]
          );
        });

        // Search for matching session
        if (typeof DatabaseService.findByColumn === 'function') {
          var records = DatabaseService.findByColumn(sessionSheet, tokenCol, sessionToken, {
            caseSensitive: true,
            strict: true
          }) || [];

          Logger.log("Matching Records Found: " + records.length);

          if (records.length > 0) {
            Logger.log("Matched Session:");
            Logger.log(JSON.stringify(records[0]));
            Logger.log("========== GET SESSION SUCCESS ==========");
            Logger.log("RETURNING FROM: SessionService.getSession");
            Logger.log("Returned value: " + JSON.stringify(records[0]));
            return records[0];
          }
        }
      }

      Logger.log("No matching session found.");
      Logger.log("========== GET SESSION END ==========");
      Logger.log("RETURNING FROM: SessionService.getSession");
      Logger.log("Returned value: null (No records matched)");
      Logger.log("CRITICAL: Returning NULL");
      return null;
    } catch (error) {
      Logger.log("SessionService.getSession ERROR: " + (error && error.message ? error.message : error));
      if (error && error.stack) Logger.log(error.stack);
      Logger.log("RETURNING FROM: SessionService.getSession (Catch Error)");
      Logger.log("Returned value: null (Exception occurred)");
      Logger.log("CRITICAL: Returning NULL");
      return null;
    }
  },

  _validateSessionRecord: function(session, sessionToken) {
    try {
      Logger.log("=== ENTER _validateSessionRecord() ===");
      Logger.log("Session Token: " + sessionToken);
      if (!session) {
        Logger.log("Validation FAILED because: Missing session");
        Logger.log("=== EXIT _validateSessionRecord() ===");
        return false;
      }

      var statusCol = this._col('SESSION_STATUS', 'Session Status', 'SESSION_STATUS');
      var expiryCol = this._col('EXPIRY_TIME', 'Expiry Time', 'EXPIRY_TIME');
      var lastActivityCol = this._col('SESSION_LAST_ACTIVITY_TIMESTAMP', 'Last Activity Timestamp', 'SESSION_LAST_ACTIVITY_TIMESTAMP');
      var tokenCol = this._col('SESSION_TOKEN', 'Session Token', 'SESSION_TOKEN');

      var activeStatus = (CONFIG && CONFIG.SESSION_STATUS && CONFIG.SESSION_STATUS.ACTIVE) ? CONFIG.SESSION_STATUS.ACTIVE : 'Active';
      
      Logger.log("Validation Step 1");
      Logger.log("Status Column Name: " + statusCol);
      Logger.log("Status Value: " + session[statusCol]);
      Logger.log("Expected Active Status: " + activeStatus);
      
      if (String(session[statusCol]) !== String(activeStatus)) {
        Logger.log("Validation FAILED because: Status mismatch (Expected Active, got: " + session[statusCol] + ")");
        Logger.log("=== EXIT _validateSessionRecord() ===");
        return false;
      }

      var currentTime = new Date().getTime();
      var rawExpiry = session[expiryCol];
      var expiryTime = this._getTimestamp(rawExpiry);

      Logger.log("Validation Step 2");
      Logger.log("Expiry Column Name: " + expiryCol);
      Logger.log("Expiry Raw Value: " + rawExpiry);
      Logger.log("Parsed Expiry Value: " + expiryTime);
      Logger.log("Current Time: " + currentTime + " (" + new Date(currentTime).toString() + ")");

      // Safe fallback: if expiryTime is NaN or 0, set default timeout to prevent session failure
      if (expiryTime === 0) {
        Logger.log("Warning: Expiry Time is 0 or invalid date. Using safe fallback timeout.");
        var timeoutMinutes = (CONFIG && CONFIG.SECURITY && CONFIG.SECURITY.SESSION_TIMEOUT_MINUTES) ? CONFIG.SECURITY.SESSION_TIMEOUT_MINUTES : 480;
        expiryTime = currentTime + (timeoutMinutes * 60000);
      }

      if (currentTime > expiryTime) {
        Logger.log("Validation FAILED because: Session expired (Current Time: " + currentTime + " > Expiry Time: " + expiryTime + ")");
        this.expireSession(sessionToken);
        Logger.log("=== EXIT _validateSessionRecord() ===");
        return false;
      }

      Logger.log("Validation Step 3");
      Logger.log("Last Activity Column Name: " + lastActivityCol);
      Logger.log("Last Activity Timestamp: " + session[lastActivityCol]);

      if (lastActivityCol && session[lastActivityCol] !== undefined) {
        var updates = {};
        var sessionSheet = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.SESSIONS) ? CONFIG.SHEETS.SESSIONS : 'Sessions';
        
        // Save as standard Date object for consistency with other methods
        updates[lastActivityCol] = new Date();
        
        if (typeof DatabaseService !== 'undefined' && DatabaseService && typeof DatabaseService.updateRow === 'function') {
          DatabaseService.updateRow(sessionSheet, tokenCol, sessionToken, updates);
        }
      }

      Logger.log("Validation PASSED");
      Logger.log("=== EXIT _validateSessionRecord() ===");
      return true;
    } catch (error) {
      Logger.log('Validation FAILED because of exception: ' + (error && error.message ? error.message : error));
      Logger.log("=== EXIT _validateSessionRecord() ===");
      return false;
    }
  },

  validateSession: function(sessionToken) {
    Logger.log("ENTER: SessionService.validateSession");
    try {
      Logger.log("========== VALIDATE SESSION ==========");
      Logger.log("Incoming Token: " + sessionToken);

      var isEmptyToken = false;
      if (typeof Utils !== 'undefined' && Utils && typeof Utils.checkEmptyValue === 'function') {
        isEmptyToken = Utils.checkEmptyValue(sessionToken);
      } else {
        isEmptyToken = !sessionToken || String(sessionToken).trim() === '';
      }

      if (isEmptyToken) {
        Logger.log("Token is empty.");
        Logger.log("RETURNING FROM: SessionService.validateSession");
        Logger.log("Returned value: false (Empty token fallback)");
        return false;
      }

      var session = this.getSession(sessionToken);
      if (!session) {
        Logger.log("Session NOT FOUND in Sessions sheet.");
        Logger.log("RETURNING FROM: SessionService.validateSession");
        Logger.log("Returned value: false (Session not found)");
        return false;
      }

      Logger.log("Session Found:");
      Logger.log(JSON.stringify(session));

      var isValid = this._validateSessionRecord(session, sessionToken);
      Logger.log("SESSION VALID: " + isValid);
      Logger.log("======================================");
      Logger.log("RETURNING FROM: SessionService.validateSession");
      Logger.log("Returned value: " + isValid);
      return isValid;
    } catch (error) {
      Logger.log("SessionService.validateSession error: " + (error && error.message ? error.message : error));
      if (error && error.stack) Logger.log(error.stack);
      Logger.log("RETURNING FROM: SessionService.validateSession (Catch Error)");
      Logger.log("Returned value: false (Exception caught)");
      return false;
    }
  },

  expireSession: function(sessionToken) {
    try {
      var statusCol = this._col('SESSION_STATUS', 'Session Status', 'SESSION_STATUS');
      var tokenCol = this._col('SESSION_TOKEN', 'Session Token', 'SESSION_TOKEN');
      var logoutCol = this._col('SESSION_LOGOUT_TIMESTAMP', 'Logout Timestamp', 'SESSION_LOGOUT_TIMESTAMP');
      var updatedAtCol = this._col('UPDATED_AT', 'Updated At', 'UPDATED_AT');

      var sessionSheet = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.SESSIONS) ? CONFIG.SHEETS.SESSIONS : 'Sessions';
      var expiredStatus = (CONFIG && CONFIG.SESSION_STATUS && CONFIG.SESSION_STATUS.EXPIRED) ? CONFIG.SESSION_STATUS.EXPIRED : 'Expired';

      var updateData = {};
      updateData[statusCol] = expiredStatus;
      if (logoutCol) updateData[logoutCol] = new Date();
      if (updatedAtCol) updateData[updatedAtCol] = new Date();

      if (typeof DatabaseService !== 'undefined' && DatabaseService && typeof DatabaseService.updateRow === 'function') {
        return !!DatabaseService.updateRow(sessionSheet, tokenCol, sessionToken, updateData);
      }
      return false;
    } catch (error) {
      Logger.log('SessionService.expireSession error: ' + (error && error.message ? error.message : error));
      return false;
    }
  },

  destroySession: function(sessionToken) {
    try {
      var session = this.getSession(sessionToken);
      if (!session) return false;

      var statusCol = this._col('SESSION_STATUS', 'Session Status', 'SESSION_STATUS');
      var lastActivityCol = this._col('SESSION_LAST_ACTIVITY_TIMESTAMP', 'Last Activity Timestamp', 'SESSION_LAST_ACTIVITY_TIMESTAMP');
      var logoutCol = this._col('SESSION_LOGOUT_TIMESTAMP', 'Logout Timestamp', 'SESSION_LOGOUT_TIMESTAMP');
      var updatedAtCol = this._col('UPDATED_AT', 'Updated At', 'UPDATED_AT');
      var tokenCol = this._col('SESSION_TOKEN', 'Session Token', 'SESSION_TOKEN');

      var sessionSheet = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.SESSIONS) ? CONFIG.SHEETS.SESSIONS : 'Sessions';
      var loggedOutStatus = (CONFIG && CONFIG.SESSION_STATUS && CONFIG.SESSION_STATUS.LOGGED_OUT) ? CONFIG.SESSION_STATUS.LOGGED_OUT : 'Logged Out';

      var updateData = {};
      updateData[statusCol] = loggedOutStatus;
      if (logoutCol) updateData[logoutCol] = new Date();
      if (lastActivityCol) updateData[lastActivityCol] = new Date();
      if (updatedAtCol) updateData[updatedAtCol] = new Date();

      if (typeof DatabaseService !== 'undefined' && DatabaseService && typeof DatabaseService.updateRow === 'function') {
        return !!DatabaseService.updateRow(sessionSheet, tokenCol, sessionToken, updateData);
      }
      return false;
    } catch (error) {
      Logger.log('SessionService.destroySession error: ' + (error && error.message ? error.message : error));
      return false;
    }
  },

  getCurrentUser: function(sessionToken) {
    try {
      Logger.log("---------------------");
      Logger.log("ENTER getCurrentUser()");
      Logger.log("Session Token: " + sessionToken);
      
      var session = this.getSession(sessionToken);
      Logger.log("Session Object: " + (session ? JSON.stringify(session) : "null/undefined"));
      
      if (!session) {
        Logger.log("getCurrentUser FAILED: Session object not found");
        Logger.log("EXIT getCurrentUser()");
        Logger.log("---------------------");
        return null;
      }

      Logger.log("Session Keys: " + JSON.stringify(Object.keys(session)));
      
      var configUserIdCol = (CONFIG && CONFIG.COLUMNS && CONFIG.COLUMNS.USER_ID) ? CONFIG.COLUMNS.USER_ID : 'User ID';
      Logger.log("CONFIG USER_ID Column: " + configUserIdCol);
      
      var sessionUserIdColVal = session["User ID"];
      Logger.log("session[\"User ID\"]: " + sessionUserIdColVal);
      
      var sessionConfigColVal = session[configUserIdCol];
      Logger.log("session[CONFIG.COLUMNS.USER_ID]: " + sessionConfigColVal);

      var ok = this._validateSessionRecord(session, sessionToken);
      Logger.log("Session Validation Passed: " + ok);
      if (!ok) {
        Logger.log("getCurrentUser FAILED: Session validation failed");
        Logger.log("EXIT getCurrentUser()");
        Logger.log("---------------------");
        return null;
      }

      var userIdCol = this._col('USER_ID', 'User ID', 'USER_ID');
      var finalUserId = session[userIdCol];
      Logger.log("Returned User ID: " + finalUserId);
      Logger.log("EXIT getCurrentUser()");
      Logger.log("---------------------");
      return finalUserId;
    } catch (error) {
      Logger.log('SessionService.getCurrentUser error: ' + (error && error.message ? error.message : error));
      Logger.log("EXIT getCurrentUser() with error");
      Logger.log("---------------------");
      return null;
    }
  },

  isLoggedIn: function(sessionToken) {
    try {
      return this.validateSession(sessionToken);
    } catch (error) {
      Logger.log('SessionService.isLoggedIn error: ' + (error && error.message ? error.message : error));
      return false;
    }
  },

  isUserLoggedIn: function(userId) {
    try {
      var userIdCol = this._col('SESSION_USER_ID', 'User ID', 'SESSION_USER_ID');
      var statusCol = this._col('SESSION_STATUS', 'Session Status', 'SESSION_STATUS');
      var expiryCol = this._col('EXPIRY_TIME', 'Expiry Time', 'EXPIRY_TIME');

      var sessionSheet = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.SESSIONS) ? CONFIG.SHEETS.SESSIONS : 'Sessions';
      var activeStatus = (CONFIG && CONFIG.SESSION_STATUS && CONFIG.SESSION_STATUS.ACTIVE) ? CONFIG.SESSION_STATUS.ACTIVE : 'Active';
      var allowMultiple = (CONFIG && CONFIG.SECURITY && typeof CONFIG.SECURITY.ALLOW_MULTIPLE_SESSIONS !== 'undefined') ? CONFIG.SECURITY.ALLOW_MULTIPLE_SESSIONS : false;

      if (typeof DatabaseService !== 'undefined' && DatabaseService && typeof DatabaseService.findByColumn === 'function') {
        var sessions = DatabaseService.findByColumn(sessionSheet, userIdCol, userId) || [];
        var currentTime = new Date().getTime();

        for (var i = 0; i < sessions.length; i++) {
          var session = sessions[i] || {};
          var expiryTime = this._getTimestamp(session[expiryCol]);
          if (String(session[statusCol]) === String(activeStatus) && currentTime <= expiryTime) {
            if (!allowMultiple) return true;
          }
        }
      }

      return false;
    } catch (error) {
      Logger.log('SessionService.isUserLoggedIn error: ' + (error && error.message ? error.message : error));
      return false;
    }
  },

  cleanupExpiredSessions: function() {
    try {
      var sessionSheet = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.SESSIONS) ? CONFIG.SHEETS.SESSIONS : 'Sessions';
      var statusCol = this._col('SESSION_STATUS', 'Session Status', 'SESSION_STATUS');
      var expiryCol = this._col('EXPIRY_TIME', 'Expiry Time', 'EXPIRY_TIME');
      var tokenCol = this._col('SESSION_TOKEN', 'Session Token', 'SESSION_TOKEN');

      var activeStatus = (CONFIG && CONFIG.SESSION_STATUS && CONFIG.SESSION_STATUS.ACTIVE) ? CONFIG.SESSION_STATUS.ACTIVE : 'Active';
      var expiredStatus = (CONFIG && CONFIG.SESSION_STATUS && CONFIG.SESSION_STATUS.EXPIRED) ? CONFIG.SESSION_STATUS.EXPIRED : 'Expired';

      if (typeof DatabaseService !== 'undefined' && DatabaseService && typeof DatabaseService.readAllRows === 'function') {
        var sessions = DatabaseService.readAllRows(sessionSheet) || [];
        var currentTime = new Date().getTime();

        for (var i = 0; i < sessions.length; i++) {
          var session = sessions[i] || {};
          var expiryTime = this._getTimestamp(session[expiryCol]);
          if (String(session[statusCol]) === String(activeStatus) && currentTime > expiryTime) {
            var updates = {};
            updates[statusCol] = expiredStatus;
            if (typeof DatabaseService.updateRow === 'function') {
              DatabaseService.updateRow(sessionSheet, tokenCol, session[tokenCol], updates);
            }
          }
        }
      }
    } catch (error) {
      Logger.log('SessionService.cleanupExpiredSessions error: ' + (error && error.message ? error.message : error));
    }
  },

  logoutAllSessions: function(userId) {
    try {
      var userIdCol = this._col('SESSION_USER_ID', 'User ID', 'SESSION_USER_ID');
      var statusCol = this._col('SESSION_STATUS', 'Session Status', 'SESSION_STATUS');
      var tokenCol = this._col('SESSION_TOKEN', 'Session Token', 'SESSION_TOKEN');
      var lastActivityCol = this._col('SESSION_LAST_ACTIVITY_TIMESTAMP', 'Last Activity Timestamp', 'SESSION_LAST_ACTIVITY_TIMESTAMP');

      var sessionSheet = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.SESSIONS) ? CONFIG.SHEETS.SESSIONS : 'Sessions';
      var activeStatus = (CONFIG && CONFIG.SESSION_STATUS && CONFIG.SESSION_STATUS.ACTIVE) ? CONFIG.SESSION_STATUS.ACTIVE : 'Active';
      var loggedOutStatus = (CONFIG && CONFIG.SESSION_STATUS && CONFIG.SESSION_STATUS.LOGGED_OUT) ? CONFIG.SESSION_STATUS.LOGGED_OUT : 'Logged Out';

      if (typeof DatabaseService !== 'undefined' && DatabaseService && typeof DatabaseService.findByColumn === 'function') {
        var sessions = DatabaseService.findByColumn(sessionSheet, userIdCol, userId) || [];

        for (var i = 0; i < sessions.length; i++) {
          var session = sessions[i] || {};
          if (String(session[statusCol]) === String(activeStatus)) {
            var updateData = {};
            updateData[statusCol] = loggedOutStatus;
            if (lastActivityCol) updateData[lastActivityCol] = new Date();

            if (typeof DatabaseService.updateRow === 'function') {
              DatabaseService.updateRow(sessionSheet, tokenCol, session[tokenCol], updateData);
            }
          }
        }
      }

      return true;
    } catch (error) {
      Logger.log('SessionService.logoutAllSessions error: ' + (error && error.message ? error.message : error));
      return false;
    }
  },

  refreshSession: function(sessionToken) {
    try {
      var session = this.getSession(sessionToken);
      if (!session) return false;

      var statusCol = this._col('SESSION_STATUS', 'Session Status', 'SESSION_STATUS');
      var expiryCol = this._col('EXPIRY_TIME', 'Expiry Time', 'EXPIRY_TIME');
      var lastActivityCol = this._col('SESSION_LAST_ACTIVITY_TIMESTAMP', 'Last Activity Timestamp', 'SESSION_LAST_ACTIVITY_TIMESTAMP');
      var tokenCol = this._col('SESSION_TOKEN', 'Session Token', 'SESSION_TOKEN');

      var activeStatus = (CONFIG && CONFIG.SESSION_STATUS && CONFIG.SESSION_STATUS.ACTIVE) ? CONFIG.SESSION_STATUS.ACTIVE : 'Active';
      if (String(session[statusCol]) !== String(activeStatus)) return false;

      const currentTime = new Date();
      const expiryTime = new Date(session[expiryCol]);
      if (currentTime.getTime() > expiryTime.getTime()) return false;

      var timeoutMinutes = (CONFIG && CONFIG.SECURITY && CONFIG.SECURITY.SESSION_TIMEOUT_MINUTES) ? CONFIG.SECURITY.SESSION_TIMEOUT_MINUTES : 480;
      const newExpiry = new Date(currentTime.getTime() + timeoutMinutes * 60000);

      var updateData = {};
      updateData[expiryCol] = newExpiry;
      if (lastActivityCol) updateData[lastActivityCol] = currentTime;

      var sessionSheet = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.SESSIONS) ? CONFIG.SHEETS.SESSIONS : 'Sessions';
      if (typeof DatabaseService !== 'undefined' && DatabaseService && typeof DatabaseService.updateRow === 'function') {
        return !!DatabaseService.updateRow(sessionSheet, tokenCol, sessionToken, updateData);
      }
      return false;
    } catch (error) {
      Logger.log('SessionService.refreshSession error: ' + (error && error.message ? error.message : error));
      return false;
    }
  },

  hasRole: function(sessionToken, role) {
    try {
      var userId = this.getCurrentUser(sessionToken);
      if (!userId) return false;

      var userIdCol = this._col('USER_ID', 'User ID', 'USER_ID');
      var roleCol = this._col('ROLE', 'Role', 'ROLE');

      var userSheet = (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.USERS) ? CONFIG.SHEETS.USERS : 'Users';

      if (typeof DatabaseService !== 'undefined' && DatabaseService && typeof DatabaseService.findByColumn === 'function') {
        var userRecords = DatabaseService.findByColumn(userSheet, userIdCol, userId) || [];
        if (!userRecords || userRecords.length === 0) return false;

        return userRecords[0][roleCol] === role;
      }
      return false;
    } catch (error) {
      Logger.log('SessionService.hasRole error: ' + (error && error.message ? error.message : error));
      return false;
    }
  },

  withSession: function(sessionToken, callback) {
    try {
      Logger.log("=== ENTER withSession() ===");
      Logger.log("Incoming Token: " + sessionToken);
      if (!sessionToken || (typeof sessionToken === 'string' && sessionToken.trim() === '')) {
        var msg = (CONFIG && CONFIG.MESSAGES && CONFIG.MESSAGES.SESSION_REQUIRED) ? CONFIG.MESSAGES.SESSION_REQUIRED : 'Session token required';
        throw new Error(msg);
      }

      var userId = this.getCurrentUser(sessionToken);
      Logger.log("Result from getCurrentUser(): " + userId);
      if (!userId) {
        Logger.log("Session rejected because getCurrentUser() returned null.");
        var msg2 = (CONFIG && CONFIG.MESSAGES && CONFIG.MESSAGES.SESSION_INVALID) ? CONFIG.MESSAGES.SESSION_INVALID : 'Invalid session';
        Logger.log("=== EXIT withSession() (REJECTED) ===");
        throw new Error(msg2);
      }

      Logger.log("Session accepted.");
      Logger.log("=== EXIT withSession() (ACCEPTED) ===");
      return callback(userId);
    } catch (error) {
      Logger.log('SessionService.withSession error: ' + (error && error.message ? error.message : error));
      throw error;
    }
  }
};

Object.freeze(SessionService);
