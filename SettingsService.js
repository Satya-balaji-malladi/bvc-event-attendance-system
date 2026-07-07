const SettingsService = {
  // Internal cache for the lifetime of a single invocation (best-effort).
  _cache: null,

  _getSettingsCache: function() {
    try {
      if (this._cache) return this._cache;
      const records = DatabaseService.readAllRows(CONFIG.SHEETS.SETTINGS) || [];
      const data = records.length > 0 ? records[0] : {};
      this._cache = { records: records, data: data };
      return this._cache;
    } catch (e) {
      Logger.log('SettingsService._getSettingsCache error: ' + (e && e.message ? e.message : e));
      this._cache = { records: [], data: {} };
      return this._cache;
    }
  },

  _applyDefaults: function(data) {
    // Defaults if not set
    try {
      // Backward compatible: earlier versions used CONFIG.PROJECT.COLLEGE_NAME,
      // but current Config.js uses CONFIG.APP / CONFIG.DEFAULT_SETTINGS.
      // TODO: Align to actual Settings sheet columns and replace derived defaults with a single config key.
      if (!data.collegeName) {
        data.collegeName = (CONFIG && CONFIG.PROJECT && CONFIG.PROJECT.COLLEGE_NAME)
          ? CONFIG.PROJECT.COLLEGE_NAME
          : (CONFIG && CONFIG.DEFAULT_SETTINGS && CONFIG.DEFAULT_SETTINGS.COLLEGE_NAME)
            ? CONFIG.DEFAULT_SETTINGS.COLLEGE_NAME
            : (CONFIG && CONFIG.APP && CONFIG.APP.NAME ? CONFIG.APP.NAME : 'BVC Engineering College');
      }
      if (!data.pagination && data.pagination !== 0) data.pagination = 10;
      if (!data.theme) data.theme = 'light';

      // Optional fields (null safety)
      if (data.adminEmail === undefined || data.adminEmail === null) data.adminEmail = '';
      if (data.language === undefined || data.language === null) data.language = 'en';
      if (data.notificationsEnabled === undefined || data.notificationsEnabled === null) data.notificationsEnabled = true;

      return data;
    } catch (e) {
      Logger.log('SettingsService._applyDefaults error: ' + (e && e.message ? e.message : e));
      return data || {};
    }
  },

  getSettings: function() {
    try {
      const cache = this._getSettingsCache();
      const data = this._applyDefaults(cache.data ? Object.assign({}, cache.data) : {});
      return Utils.buildResponse(true, 'Settings retrieved', { data: data });
    } catch (e) {
      Logger.log('SettingsService.getSettings error: ' + (e && e.message ? e.message : e));
      return Utils.buildResponse(false, e && e.message ? e.message : 'Failed to get settings');
    }
  },

  saveSettings: function(payload) {
    try {
      payload = payload || {};

      // Use cache only for determining record existence.
      const cache = this._getSettingsCache();
      const records = cache.records || [];

      // TODO: Align primary key/header name with CONFIG.COLUMNS for SETTINGS sheet.
      // Current project logic assumes 'setting_id' exists.
      const primaryKeyHeader = 'setting_id';
      const primaryKeyValue = 'GLOBAL';

      const newSettings = {
        [primaryKeyHeader]: primaryKeyValue, // single record
        collegeName: payload.collegeName !== undefined ? payload.collegeName : '',
        pagination: payload.pagination !== undefined ? payload.pagination : 10,
        adminEmail: payload.adminEmail !== undefined ? payload.adminEmail : '',
        theme: payload.theme !== undefined ? payload.theme : 'light',

        // Optional fields to preserve backward compatibility if UI sends them.
        // If the columns do not exist in the sheet, DatabaseService.mapObjectToRow
        // will safely leave them as empty strings for missing header keys.
        language: payload.language !== undefined ? payload.language : undefined,
        notificationsEnabled: payload.notificationsEnabled !== undefined ? payload.notificationsEnabled : undefined,
        securityLevel: payload.securityLevel !== undefined ? payload.securityLevel : undefined
      };

      if (records.length === 0) {
        DatabaseService.insertRow(CONFIG.SHEETS.SETTINGS, newSettings);
      } else {
        DatabaseService.updateRow(CONFIG.SHEETS.SETTINGS, primaryKeyHeader, primaryKeyValue, newSettings);
      }

      // Refresh cache after write.
      this._cache = null;

      const resp = Utils.buildResponse(true, 'Settings saved successfully');
      try {
        AuditService.logAction(
          'SYSTEM',
          'SettingsService',
          'UPDATE_SETTINGS',
          '',
          'Settings',
          'Settings updated',
          '',
          'SUCCESS',
          'SYSTEM'
        );
      } catch (error) {
        Logger.log(error);
      }

      return resp;
    } catch (e) {
      Logger.log('SettingsService.saveSettings error: ' + (e && e.message ? e.message : e));
      return Utils.buildResponse(false, e && e.message ? e.message : 'Failed to save settings');
    }
  }
};

