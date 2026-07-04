/**
 * Service for handling user authentication.
 * Responsibilities: login, logout, authentication validation, and password changes.
 */
const AuthService = {
  
  /**
   * Finds a user record by username or email.
   * @param {string} usernameOrEmail 
   * @returns {object|null} The user object or null if not found.
   */
  _findUserByUsernameOrEmail: function(usernameOrEmail) {
    const usersSheet = CONFIG.SHEETS.USERS;
    let userRecords = DatabaseService.findByColumn(usersSheet, 'username', usernameOrEmail);
    if (userRecords.length === 0) {
      userRecords = DatabaseService.findByColumn(usersSheet, 'email', usernameOrEmail);
    }
    return userRecords.length > 0 ? userRecords[0] : null;
  },

  /**
   * Verifies the user's password.
   * @param {object} user 
   * @param {string} password 
   * @returns {boolean} True if password matches.
   */
  _verifyPassword: function(user, password) {
    if (!user || user.password === undefined || user.password === null) return false;
    // Cast to String and trim because Google Sheets might return numeric passwords as Numbers 
    // and manual data entry often includes accidental trailing spaces.
    return String(user.password).trim() === String(password).trim();
  },

  /**
   * Creates a login session and sanitizes the user object.
   * @param {object} user 
   * @returns {object} Session data containing safe user and session info.
   */
  _createLoginSession: function(user) {
    const session = SessionService.createSession(user);
    const safeUser = Object.assign({}, user);
    delete safeUser.password;
    return { user: safeUser, session: session };
  },

  /**
   * Authenticates a user and creates a session.
   * @param {object} loginData - Contains usernameOrEmail and password.
   * @returns {object} Result object with success status and session details if successful.
   */
  login: function(loginData) {
    const validationPayload = {
      username: loginData.usernameOrEmail,
      password: loginData.password
    };
    
    const validationResult = ValidationService.validateLogin(validationPayload);
    if (!validationResult.valid) {
      return Utils.buildResponse(false, validationResult.errors.join(' '));
    }

    const { usernameOrEmail, password } = loginData;
    const user = this._findUserByUsernameOrEmail(usernameOrEmail);

    if (!user) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.INVALID_CREDENTIALS);
    }

    if (user.status !== CONFIG.USER_STATUS.ACTIVE) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.ACCOUNT_INACTIVE);
    }

    if (!this._verifyPassword(user, password)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.INVALID_PASSWORD);
    }

    try {
      const sessionData = this._createLoginSession(user);
      return Utils.buildResponse(true, CONFIG.MESSAGES.LOGIN_SUCCESS, sessionData);
    } catch (error) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.SESSION_CREATE_FAILED + ': ' + error.message);
    }
  },

  /**
   * Logs a user out by destroying their session.
   * @param {string} sessionToken 
   * @returns {object} Result object.
   */
  logout: function(sessionToken) {
    const result = SessionService.destroySession(sessionToken);
    if (result) {
      return Utils.buildResponse(true, CONFIG.MESSAGES.LOGOUT_SUCCESS);
    }
    return Utils.buildResponse(false, CONFIG.MESSAGES.LOGOUT_FAILED);
  },

  /**
   * Validates a session token and returns the current user if valid.
   * @param {string} sessionToken 
   * @returns {object} Result object containing user data if valid.
   */
  authenticate: function(sessionToken) {
    if (!SessionService.isLoggedIn(sessionToken)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.SESSION_INVALID);
    }

    const userId = SessionService.getCurrentUser(sessionToken);
    if (!userId) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.USER_NOT_FOUND_SESSION);
    }

    const userRecords = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'user_id', userId);
    if (userRecords.length === 0) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.USER_RECORD_MISSING);
    }

    const safeUser = Object.assign({}, userRecords[0]);
    delete safeUser.password;

    return Utils.buildResponse(true, CONFIG.MESSAGES.AUTH_SUCCESS, { user: safeUser });
  },

  /**
   * Changes a user's password.
   * @param {string} userId 
   * @param {string} oldPassword 
   * @param {string} newPassword 
   * @returns {object} Result object.
   */
  changePassword: function(userId, oldPassword, newPassword) {
    const reqError = ValidationService.validateRequired(newPassword, 'New Password');
    if (reqError) {
      return Utils.buildResponse(false, reqError);
    }

    const lenError = ValidationService.validateLength(newPassword, 8, 30);
    if (lenError) {
      return Utils.buildResponse(false, lenError);
    }

    const userRecords = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'user_id', userId);
    if (userRecords.length === 0) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.USER_NOT_FOUND);
    }

    const user = userRecords[0];

    if (!this._verifyPassword(user, oldPassword)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.INCORRECT_OLD_PASSWORD);
    }

    const updateSuccess = DatabaseService.updateRow(CONFIG.SHEETS.USERS, 'user_id', userId, { password: newPassword });
    if (updateSuccess) {
      return Utils.buildResponse(true, CONFIG.MESSAGES.PASSWORD_CHANGED);
    }
    
    return Utils.buildResponse(false, CONFIG.MESSAGES.PASSWORD_CHANGE_FAILED);
  }
};
