/**
 * Service for handling user sessions and authorization.
 * Exclusively manages session state and validation.
 */
const SessionService = {
  
  /**
   * Generates a random session token.
   * @returns {string} Session token.
   */
  generateSessionToken: function() {
    return Utilities.getUuid();
  },

  /**
   * Creates a new session for the given user.
   * @param {object} user - The user object containing user_id.
   * @returns {object} The created session object.
   */
  createSession: function(user) {
    if (!user || !user.user_id) {
      throw new Error('Invalid user object provided for session creation.');
    }

    const sessionId = IdService.generateSessionId();
    const sessionToken = this.generateSessionToken();
    const loginTime = Utils.getCurrentTimestamp();
    
    // Calculate expiry time: 8 hours from login
    const expiryTime = new Date(loginTime.getTime() + (8 * 60 * 60 * 1000));
    
    const sessionData = {
      session_id: sessionId,
      user_id: user.user_id,
      session_token: sessionToken,
      login_time: loginTime,
      expiry_time: expiryTime,
      status: CONFIG.SESSION_STATUS.ACTIVE,
      created_by: user.user_id,
      created_at: loginTime
    };

    DatabaseService.insertRow(CONFIG.SHEETS.SESSIONS, sessionData);

    return sessionData;
  },

  /**
   * Retrieves a session record by its token.
   * @param {string} sessionToken 
   * @returns {object|null} The session record or null if not found.
   */
  getSession: function(sessionToken) {
    if (Utils.checkEmptyValue(sessionToken)) return null;
    
    const records = DatabaseService.findByColumn(CONFIG.SHEETS.SESSIONS, 'session_token', sessionToken);
    
    if (records.length > 0) {
      return records[0];
    }
    return null;
  },

  /**
   * Internal helper to validate a session record.
   * @param {object} session - The session record object.
   * @param {string} sessionToken - The token for the session.
   * @returns {boolean} True if the session is valid.
   */
  _validateSessionRecord: function(session, sessionToken) {
    if (!session) return false;
    
    if (session.status !== CONFIG.SESSION_STATUS.ACTIVE) return false;
    
    const currentTime = Utils.getCurrentTimestamp().getTime();
    const expiryTime = new Date(session.expiry_time).getTime();
    
    if (currentTime > expiryTime) {
      this.expireSession(sessionToken);
      return false;
    }
    
    return true;
  },

  /**
   * Validates if a session token is active and not expired.
   * @param {string} sessionToken 
   * @returns {boolean} True if the session is valid.
   */
  validateSession: function(sessionToken) {
    const session = this.getSession(sessionToken);
    return this._validateSessionRecord(session, sessionToken);
  },

  /**
   * Marks a session as expired.
   * @param {string} sessionToken 
   * @returns {boolean} True if successful.
   */
  expireSession: function(sessionToken) {
    const updateData = { status: CONFIG.SESSION_STATUS.EXPIRED };
    return DatabaseService.updateRow(CONFIG.SHEETS.SESSIONS, 'session_token', sessionToken, updateData);
  },

  /**
   * Destroys a session by setting its status to Logged Out.
   * @param {string} sessionToken 
   * @returns {boolean} True if successful.
   */
  destroySession: function(sessionToken) {
    const session = this.getSession(sessionToken);
    if (!session) return false;
    
    const updateData = { status: CONFIG.SESSION_STATUS.LOGGED_OUT };
    return DatabaseService.updateRow(CONFIG.SHEETS.SESSIONS, 'session_token', sessionToken, updateData);
  },

  /**
   * Gets the User ID of the currently logged-in user.
   * Reads the session from the database only once.
   * @param {string} sessionToken 
   * @returns {string|null} User ID if valid, else null.
   */
  getCurrentUser: function(sessionToken) {
    const session = this.getSession(sessionToken);
    if (this._validateSessionRecord(session, sessionToken)) {
      return session.user_id;
    }
    return null;
  },

  /**
   * Checks if the user is currently logged in with a valid session.
   * @param {string} sessionToken 
   * @returns {boolean} True if valid session exists.
   */
  isLoggedIn: function(sessionToken) {
    return this.validateSession(sessionToken);
  },

  /**
   * Checks if the logged-in user has a specific role.
   * @param {string} sessionToken 
   * @param {string} role 
   * @returns {boolean} True if the user has the specified role.
   */
  hasRole: function(sessionToken, role) {
    const userId = this.getCurrentUser(sessionToken);
    if (!userId) return false;
    
    const userRecords = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'user_id', userId);
    
    if (userRecords.length === 0) return false;
    
    const user = userRecords[0];
    return user.role === role;
  }
};
