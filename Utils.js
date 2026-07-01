/**
 * Utility functions for the College Event Attendance Management System.
 * Contains purely reusable helper functions. Independent of external services.
 */

const Utils = {
  
  // ==========================================
  // FORMATTING HELPERS
  // ==========================================
  
  /**
   * Helper function to pad numbers with leading zeros.
   * @param {number|string} number 
   * @param {number} width 
   * @returns {string} Padded string
   */
  _padNumber: function(number, width) {
    number = number + '';
    return number.length >= width ? number : new Array(width - number.length + 1).join('0') + number;
  },

  // ==========================================
  // DATE HELPERS
  // ==========================================

  /**
   * Gets the current date object.
   * @returns {Date} The current Date object.
   */
  getCurrentDate: function() {
    return new Date();
  },

  /**
   * Gets the current timestamp in milliseconds.
   * @returns {number} Timestamp.
   */
  getCurrentTimestamp: function() {
    return new Date();
  },

  /**
   * Formats a date object to a standard string (YYYY-MM-DD).
   * @param {Date|string|number} dateValue - The date to format.
   * @returns {string} Formatted date string or empty string if invalid.
   */
  formatDate: function(dateValue) {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = this._padNumber(d.getMonth() + 1, 2);
    const day = this._padNumber(d.getDate(), 2);
    return year + '-' + month + '-' + day;
  },

  // ==========================================
  // VALIDATION HELPERS
  // ==========================================

  /**
   * Validates an email address format.
   * @param {string} email 
   * @returns {boolean} True if valid.
   */
  validateEmail: function(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  /**
   * Validates a roll number (alphanumeric, no spaces).
   * @param {string} rollNumber 
   * @returns {boolean} True if valid.
   */
  validateRollNumber: function(rollNumber) {
    if (!rollNumber) return false;
    const re = /^[a-zA-Z0-9]+$/;
    return re.test(rollNumber);
  },

  /**
   * Validates a phone number (e.g., 10 digits).
   * @param {string} phone 
   * @returns {boolean} True if valid.
   */
  isValidPhone: function(phone) {
    if (!phone) return false;
    const re = /^\+?[0-9\s\-()]{7,15}$/;
    return re.test(phone.toString().trim());
  },

  /**
   * Validates a year format (4 digits).
   * @param {number|string} year 
   * @returns {boolean} True if valid.
   */
  isValidYear: function(year) {
    if (!year) return false;
    const re = /^\d{4}$/;
    return re.test(year.toString().trim());
  },

  /**
   * Validates a section format (e.g., A, B, C or A1, B2).
   * @param {string} section 
   * @returns {boolean} True if valid.
   */
  isValidSection: function(section) {
    if (!section) return false;
    const re = /^[A-Z0-9]{1,3}$/i;
    return re.test(section.trim());
  },

  /**
   * Checks if a value is empty (null, undefined, empty string, or whitespace).
   * @param {any} value 
   * @returns {boolean} True if empty.
   */
  checkEmptyValue: function(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    return false;
  },

  // ==========================================
  // STRING HELPERS
  // ==========================================

  /**
   * Converts text to uppercase safely.
   * @param {string} text 
   * @returns {string}
   */
  toUpper: function(text) {
    if (typeof text !== 'string') return text;
    return text.toUpperCase();
  },

  /**
   * Converts text to lowercase safely.
   * @param {string} text 
   * @returns {string}
   */
  toLower: function(text) {
    if (typeof text !== 'string') return text;
    return text.toLowerCase();
  },

  /**
   * Sanitizes input to prevent basic injection and clean extra spaces.
   * @param {string} input 
   * @returns {string}
   */
  sanitizeInput: function(input) {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/[<>]/g, '');
  },

  /**
   * Trims whitespace from both ends of a string.
   * @param {string} text 
   * @returns {string}
   */
  trimText: function(text) {
    if (typeof text !== 'string') return text;
    return text.trim();
  },

  /**
   * Capitalizes the first letter of each word in a string.
   * @param {string} text 
   * @returns {string}
   */
  capitalizeWords: function(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/\b\w/g, function(char) {
      return char.toUpperCase();
    });
  },

  // ==========================================
  // GENERATOR HELPERS
  // ==========================================

  /**
   * Generates a clean username from a full name (e.g., Satya Balaji -> satyabalaji).
   * @param {string} fullName 
   * @returns {string} Generated username.
   */
  generateUsername: function(fullName) {
    if (!fullName) return '';
    return fullName.toLowerCase().replace(/[^a-z0-9]/g, '');
  },

  /**
   * Generates a readable password (e.g., BVC@4832).
   * @param {string} prefix - Optional prefix, defaults to 'BVC'.
   * @returns {string} Random readable password.
   */
  generateRandomPassword: function(prefix = 'BVC') {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return prefix + '@' + randomNum;
  },

  /**
   * Helper to return standard success/failure format.
   * @param {boolean} success 
   * @param {string} message 
   * @param {object} [data] 
   * @returns {object}
   */
  buildResponse: function(success, message, data = {}) {
    return { success, message, ...data };
  },

  /**
   * Removes sensitive information like password from a user object.
   * @param {object} user 
   * @returns {object} Safe user object.
   */
  sanitizeUser: function(user) {
    if (!user) return null;
    const safeUser = Object.assign({}, user);
    delete safeUser.password;
    return safeUser;
  }
};
