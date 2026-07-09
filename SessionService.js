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
      // (todoTag is only used to locate the specific TODO in code reviews)
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
      if (Utils && typeof Utils.generateUUID === 'function') return Utils.generateUUID();
      return Utilities.getUuid();
    } catch (e) {
      Logger.log('SessionService.generateSessionToken error: ' + (e && e.message ? e.message : e));
      return Utilities.getUuid();
    }
  },

createSession: function(user) {
  try {
    if (!user) throw new Error('User is required');

    var userIdCol = CONFIG.COLUMNS.SESSION_USER_ID;
    var userId = user[userIdCol];
    if (Utils.checkEmptyValue(userId)) throw new Error('Invalid user');

    var sessionId = IdService.generateSessionId();
    var sessionToken = this.generateSessionToken();

    // Use Date objects directly
    const loginTime = new Date();
    const expiryTime = new Date(
      loginTime.getTime() + CONFIG.SECURITY.SESSION_TIMEOUT_MINUTES * 60000
    );

    var c = CONFIG.COLUMNS;
    var updates = {};

    updates[c.SESSION_ID] = sessionId;
    updates[c.SESSION_USER_ID] = userId;
    updates[c.SESSION_USERNAME] = user[CONFIG.COLUMNS.USER_USERNAME] || "";
    updates[c.SESSION_TOKEN] = sessionToken;

    // Store Date objects instead of milliseconds
    updates[c.SESSION_LOGIN_TIMESTAMP] = loginTime;
    updates[c.EXPIRY_TIME] = expiryTime;
    updates[c.SESSION_STATUS] = CONFIG.SESSION_STATUS.ACTIVE;
    updates[c.SESSION_LAST_ACTIVITY_TIMESTAMP] = loginTime;

    if (c.CREATED_BY) updates[c.CREATED_BY] = userId;
    if (c.CREATED_AT) updates[c.CREATED_AT] = loginTime;
    Logger.log("===============");
Logger.log("SESSION CREATED");
Logger.log(JSON.stringify(updates));
Logger.log("===============");

    DatabaseService.insertRow(CONFIG.SHEETS.SESSIONS, updates);
    return updates;
  } catch (error) {
    Logger.log('SessionService.createSession error: ' + (error && error.message ? error.message : error));
    throw new Error((CONFIG.MESSAGES && CONFIG.MESSAGES.SESSION_CREATE_FAILED) ? CONFIG.MESSAGES.SESSION_CREATE_FAILED : 'Session creation failed');
  }
}
,
 getSession: function(sessionToken) {
  try {
    Logger.log("========== GET SESSION START ==========");

    Logger.log("Incoming Token: " + sessionToken);

    if (Utils.checkEmptyValue(sessionToken)) {
      Logger.log("Session token is empty.");
      return null;
    }

    // Resolve token column
    var tokenCol = (CONFIG.COLUMNS && CONFIG.COLUMNS.SESSION_TOKEN)
      ? CONFIG.COLUMNS.SESSION_TOKEN
      : "Session Token";

    Logger.log("Using Token Column: " + tokenCol);
    Logger.log("Sessions Sheet: " + CONFIG.SHEETS.SESSIONS);

    // Read all sessions
    var allSessions = DatabaseService.readAllRows(CONFIG.SHEETS.SESSIONS);

    Logger.log("Total Sessions Found: " + allSessions.length);

    // Print every token stored in sheet
    allSessions.forEach(function(row, index) {
      Logger.log(
        "Row " +
          (index + 1) +
          " | Token = " +
          row[tokenCol] +
          " | Status = " +
          row[(CONFIG.COLUMNS.SESSION_STATUS || "Session Status")]
      );
    });

    // Search for matching session
    var records = DatabaseService.findByColumn(
      CONFIG.SHEETS.SESSIONS,
      tokenCol,
      sessionToken,
      {
        caseSensitive: true,
        strict: true
      }
    );

    Logger.log("Matching Records Found: " + records.length);

    if (records.length > 0) {
      Logger.log("Matched Session:");
      Logger.log(JSON.stringify(records[0]));
      Logger.log("========== GET SESSION SUCCESS ==========");
      return records[0];
    }

    Logger.log("No matching session found.");
    Logger.log("========== GET SESSION END ==========");
    return null;

  } catch (error) {
    Logger.log("SessionService.getSession ERROR:");
    Logger.log(error.message);
    Logger.log(error.stack);
    return null;
  }
},
_validateSessionRecord: function(session, sessionToken) {
    try {
      if (!session) return false;

      var c = CONFIG.COLUMNS || {};
      var statusCol = c.SESSION_STATUS || 'Session Status';
      var expiryCol = c.EXPIRY_TIME || 'Expiry Time';
      var lastActivityCol = c.SESSION_LAST_ACTIVITY_TIMESTAMP || 'Last Activity Timestamp';
      var tokenCol = c.SESSION_TOKEN || 'Session Token';

      if (String(session[statusCol]) !== String(CONFIG.SESSION_STATUS.ACTIVE)) return false;

      // SAFE TIMESTAMP COMPARISON
      var currentTime = new Date().getTime();
      var expiryTime = session[expiryCol] ? new Date(session[expiryCol]).getTime() : 0;

      // ఒకవేళ NaN వస్తే సెషన్ ని ఫెయిల్ అవ్వకుండా సేఫ్ గా ఉంచుతాం
      if (isNaN(expiryTime) || expiryTime === 0) {
        expiryTime = currentTime + (CONFIG.SECURITY.SESSION_TIMEOUT_MINUTES * 60000);
      }

      if (currentTime > expiryTime) {
        this.expireSession(sessionToken);
        return false;
      }

      if (lastActivityCol && session[lastActivityCol] !== undefined) {
        var updates = {};
        // FIX: నేరుగా ఆబ్జెక్ట్ కాకుండా స్ట్రింగ్ ఫార్మాట్ లో పంపుతున్నాం
        updates[lastActivityCol] = Utilities.formatDate(new Date(), CONFIG.DATE_TIME.TIMEZONE || "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
        DatabaseService.updateRow(CONFIG.SHEETS.SESSIONS, tokenCol, sessionToken, updates);
      }

      return true;
    } catch (error) {
      Logger.log('SessionService._validateSessionRecord error: ' + (error && error.message ? error.message : error));
      return false;
    }
  },

 validateSession: function(sessionToken) {
  try {
    Logger.log("========== VALIDATE SESSION ==========");
    Logger.log("Incoming Token: " + sessionToken);

    if (Utils.checkEmptyValue(sessionToken)) {
      Logger.log("Token is empty.");
      return false;
    }

    var session = this.getSession(sessionToken);

    if (!session) {
      Logger.log("Session NOT FOUND in Sessions sheet.");
      return false;
    }

    Logger.log("Session Found:");
    Logger.log(JSON.stringify(session));

    var c = CONFIG.COLUMNS;

    var statusCol = c.SESSION_STATUS;
    var expiryCol = c.EXPIRY_TIME;
    var lastActivityCol = c.SESSION_LAST_ACTIVITY_TIMESTAMP;
    var tokenCol = c.SESSION_TOKEN;

    Logger.log("Stored Status : " + session[statusCol]);
    Logger.log("Expected Status : " + CONFIG.SESSION_STATUS.ACTIVE);

    if (String(session[statusCol]).trim() !== String(CONFIG.SESSION_STATUS.ACTIVE).trim()) {
      Logger.log("Session Status Invalid");
      return false;
    }

    var currentTime = new Date().getTime();
    var expiryTime = session[expiryCol]
      ? new Date(session[expiryCol]).getTime()
      : 0;

    Logger.log("Current Time : " + currentTime);
    Logger.log("Expiry Time : " + expiryTime);

    if (isNaN(expiryTime)) {
      Logger.log("Expiry Time Invalid");
      return false;
    }

    if (currentTime > expiryTime) {
      Logger.log("Session Expired");
      this.expireSession(sessionToken);
      return false;
    }

    if (lastActivityCol) {
      var updates = {};
      updates[lastActivityCol] = new Date();

      DatabaseService.updateRow(
        CONFIG.SHEETS.SESSIONS,
        tokenCol,
        sessionToken,
        updates
      );

      Logger.log("Last Activity Updated");
    }

    Logger.log("SESSION VALID");
    Logger.log("======================================");

    return true;

  } catch (error) {
    Logger.log("validateSession ERROR");
    Logger.log(error.message);
    Logger.log(error.stack);
    return false;
  }
},
 expireSession: function(sessionToken) {
  try {
    var c = CONFIG.COLUMNS || {};
    var statusCol = c.SESSION_STATUS;
    var tokenCol = c.SESSION_TOKEN;
    var logoutCol = c.SESSION_LOGOUT_TIMESTAMP;
    var updatedAtCol = c.UPDATED_AT;

    var updateData = {};
    updateData[statusCol] = CONFIG.SESSION_STATUS.EXPIRED;
    if (logoutCol) updateData[logoutCol] = new Date();
    if (updatedAtCol) updateData[updatedAtCol] = new Date();

    return DatabaseService.updateRow(CONFIG.SHEETS.SESSIONS, tokenCol, sessionToken, updateData);
  } catch (error) {
    Logger.log('SessionService.expireSession error: ' + (error && error.message ? error.message : error));
    return false;
  }
}
,

destroySession: function(sessionToken) {
  try {
    var session = this.getSession(sessionToken);
    if (!session) return false;

    var c = CONFIG.COLUMNS || {};
    var statusCol = c.SESSION_STATUS;
    var lastActivityCol = c.SESSION_LAST_ACTIVITY_TIMESTAMP;
    var logoutCol = c.SESSION_LOGOUT_TIMESTAMP;
    var updatedAtCol = c.UPDATED_AT;
    var tokenCol = c.SESSION_TOKEN;

    var updateData = {};
    updateData[statusCol] = CONFIG.SESSION_STATUS.LOGGED_OUT;
    if (logoutCol) updateData[logoutCol] = new Date();
    if (lastActivityCol) updateData[lastActivityCol] = new Date();
    if (updatedAtCol) updateData[updatedAtCol] = new Date();

    return DatabaseService.updateRow(CONFIG.SHEETS.SESSIONS, tokenCol, sessionToken, updateData);
  } catch (error) {
    Logger.log('SessionService.destroySession error: ' + (error && error.message ? error.message : error));
    return false;
  }
}
,
  getCurrentUser: function(sessionToken) {
    try {
      var session = this.getSession(sessionToken);
      if (!session) return null;

      // Validate using optional column mapping
      var ok = this._validateSessionRecord(session, sessionToken);
      if (!ok) return null;

      var c = CONFIG.COLUMNS || {};
      var userIdCol = c.USER_ID || (CONFIG.ID_COLUMNS && CONFIG.ID_COLUMNS.USERS) || 'User ID';
      if (!c.USER_ID) {
        // TODO: Move USER_ID header into CONFIG.COLUMNS.USER_ID.
      }
      return session[userIdCol];
    } catch (error) {
      Logger.log('SessionService.getCurrentUser error: ' + (error && error.message ? error.message : error));
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
      var c = CONFIG.COLUMNS || {};
      var userIdCol = c.SESSION_USER_ID || 'User ID';
      var statusCol = c.SESSION_STATUS || 'Session Status';
      var expiryCol = c.EXPIRY_TIME || 'Expiry Time';

      var sessions = DatabaseService.findByColumn(CONFIG.SHEETS.SESSIONS, userIdCol, userId);
      var currentTime = Utils.getCurrentTimestamp();

      for (var i = 0; i < sessions.length; i++) {
        var session = sessions[i] || {};
        var expiryTime = session[expiryCol];
        if (String(session[statusCol]) === String(CONFIG.SESSION_STATUS.ACTIVE) && currentTime <= Number(expiryTime || 0)) {
          if (!CONFIG.SECURITY.ALLOW_MULTIPLE_SESSIONS) return true;
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
      var sessions = DatabaseService.readAllRows(CONFIG.SHEETS.SESSIONS) || [];
      var currentTime = Utils.getCurrentTimestamp();

      var c = CONFIG.COLUMNS || {};
      var statusCol = c.SESSION_STATUS || 'Session Status';
      var expiryCol = c.EXPIRY_TIME || 'Expiry Time';
      var tokenCol = c.SESSION_TOKEN || 'Session Token';

      for (var i = 0; i < sessions.length; i++) {
        var session = sessions[i] || {};
        var expiryTime = session[expiryCol];
        if (String(session[statusCol]) === String(CONFIG.SESSION_STATUS.ACTIVE) && currentTime > Number(expiryTime || 0)) {
          var updates = {};
          updates[statusCol] = CONFIG.SESSION_STATUS.EXPIRED;
          DatabaseService.updateRow(CONFIG.SHEETS.SESSIONS, tokenCol, session[tokenCol], updates);
        }
      }
    } catch (error) {
      Logger.log('SessionService.cleanupExpiredSessions error: ' + (error && error.message ? error.message : error));
    }
  },

  logoutAllSessions: function(userId) {
    try {
      var c = CONFIG.COLUMNS || {};
      var userIdCol = c.SESSION_USER_ID || 'User ID';
      var statusCol = c.SESSION_STATUS || 'Session Status';
      var tokenCol = c.SESSION_TOKEN || 'Session Token';
      var lastActivityCol = c.SESSION_LAST_ACTIVITY_TIMESTAMP || 'Last Activity Timestamp';

      var sessions = DatabaseService.findByColumn(CONFIG.SHEETS.SESSIONS, userIdCol, userId);

      for (var i = 0; i < sessions.length; i++) {
        var session = sessions[i] || {};
        if (String(session[statusCol]) === String(CONFIG.SESSION_STATUS.ACTIVE)) {
          var updateData = {};
          updateData[statusCol] = CONFIG.SESSION_STATUS.LOGGED_OUT;
          if (lastActivityCol) updateData[lastActivityCol] = Utils.getCurrentTimestamp();

          DatabaseService.updateRow(CONFIG.SHEETS.SESSIONS, tokenCol, session[tokenCol], updateData);
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

    var c = CONFIG.COLUMNS || {};
    var statusCol = c.SESSION_STATUS;
    var expiryCol = c.EXPIRY_TIME;
    var lastActivityCol = c.SESSION_LAST_ACTIVITY_TIMESTAMP;
    var tokenCol = c.SESSION_TOKEN;

    if (String(session[statusCol]) !== String(CONFIG.SESSION_STATUS.ACTIVE)) return false;

    const currentTime = new Date();
    const expiryTime = new Date(session[expiryCol]);
    if (currentTime > expiryTime) return false;

    const newExpiry = new Date(
      currentTime.getTime() + CONFIG.SECURITY.SESSION_TIMEOUT_MINUTES * 60000
    );

    var updateData = {};
    updateData[expiryCol] = newExpiry;
    if (lastActivityCol) updateData[lastActivityCol] = currentTime;

    return DatabaseService.updateRow(CONFIG.SHEETS.SESSIONS, tokenCol, sessionToken, updateData);
  } catch (error) {
    Logger.log('SessionService.refreshSession error: ' + (error && error.message ? error.message : error));
    return false;
  }
}
,

  hasRole: function(sessionToken, role) {
    try {
      var userId = this.getCurrentUser(sessionToken);
      if (!userId) return false;

      var c = CONFIG.COLUMNS || {};
      var userIdCol = c.USER_ID || (CONFIG.ID_COLUMNS && CONFIG.ID_COLUMNS.USERS) || 'User ID'; // TODO: Move USER_ID header into CONFIG.COLUMNS.USER_ID
      var roleCol = c.ROLE || 'Role'; // TODO: Move ROLE header into CONFIG.COLUMNS

      var userRecords = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, userIdCol, userId);
      if (!userRecords || userRecords.length === 0) return false;

      return userRecords[0][roleCol] === role;
    } catch (error) {
      Logger.log('SessionService.hasRole error: ' + (error && error.message ? error.message : error));
      return false;
    }
  },

  withSession: function(sessionToken, callback) {
    try {
      if (!sessionToken || (typeof sessionToken === 'string' && sessionToken.trim() === '')) {
        var msg = (CONFIG.MESSAGES && CONFIG.MESSAGES.SESSION_REQUIRED) ? CONFIG.MESSAGES.SESSION_REQUIRED : 'Session token required';
        throw new Error(msg);
      }

      var userId = this.getCurrentUser(sessionToken);
      if (!userId) {
        var msg2 = (CONFIG.MESSAGES && CONFIG.MESSAGES.SESSION_INVALID) ? CONFIG.MESSAGES.SESSION_INVALID : 'Invalid session';
        throw new Error(msg2);
      }

      return callback(userId);
    } catch (error) {
      Logger.log('SessionService.withSession error: ' + (error && error.message ? error.message : error));
      throw error;
    }
  }
};

Object.freeze(SessionService);

