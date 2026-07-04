const SettingsService = {
  getSettings: function() {
    try {
      const records = DatabaseService.readAllRows(CONFIG.SHEETS.SETTINGS) || [];
      const data = records.length > 0 ? records[0] : {};
      
      // Defaults if not set
      if (!data.collegeName) data.collegeName = CONFIG.PROJECT.COLLEGE_NAME;
      if (!data.pagination) data.pagination = 10;
      if (!data.theme) data.theme = 'light';
      
      return Utils.buildResponse(true, 'Settings retrieved', { data: data });
    } catch(e) {
      return Utils.buildResponse(false, e.message);
    }
  },

  saveSettings: function(payload) {
    try {
      const records = DatabaseService.readAllRows(CONFIG.SHEETS.SETTINGS) || [];
      
      const newSettings = {
        setting_id: 'GLOBAL', // Use a fixed ID to maintain a single record
        collegeName: payload.collegeName || '',
        pagination: payload.pagination || 10,
        adminEmail: payload.adminEmail || '',
        theme: payload.theme || 'light'
      };

      if (records.length === 0) {
        DatabaseService.insertRow(CONFIG.SHEETS.SETTINGS, newSettings);
      } else {
        DatabaseService.updateRow(CONFIG.SHEETS.SETTINGS, 'setting_id', 'GLOBAL', newSettings);
      }
      
      return Utils.buildResponse(true, 'Settings saved successfully');
    } catch(e) {
      return Utils.buildResponse(false, e.message);
    }
  }
};
