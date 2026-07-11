/**
 * Data Access Layer (DAL) - BVC Engineering College
 * Production-ready, CONFIG-driven Google Sheets abstraction layer.
 */
const DatabaseService = {
  _cache: {},
  _spreadsheet: null,

  /**
   * PRIVATE: Resolves actual sheet name to logical CONFIG key.
   */
  _getLogicalSheetKey: function(sheetName) {
    if (CONFIG.SHEETS && CONFIG.SHEETS[sheetName]) return sheetName;
    for (var key in CONFIG.SHEETS) {
      if (CONFIG.SHEETS[key] === sheetName) return key;
    }
    return sheetName;
  },

  /**
   * Lazily loads and returns the active spreadsheet instance.
   */
  getSpreadsheet: function() {
    try {
      if (!this._spreadsheet) this._spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET.ID);
      return this._spreadsheet;
    } catch (e) {
      Logger.log('DatabaseService.getSpreadsheet error: ' + (e && e.message ? e.message : e));
      return null;
    }
  },

  /**
   * Gets a sheet instance by logical name or physical sheet name from configuration.
   */
  getSheet: function(sheetName) {
    try {
      const logicalKey = this._getLogicalSheetKey(sheetName);
      const actualSheetName = (CONFIG.SHEETS && CONFIG.SHEETS[logicalKey]) ? CONFIG.SHEETS[logicalKey] : sheetName;

      const ss = this.getSpreadsheet();
      if (!ss) return null;

      const sheet = ss.getSheetByName(actualSheetName);
      if (!sheet) {
        Logger.log("DatabaseService.getSheet: sheet not found: " + actualSheetName);
        return null;
      }
      return sheet;
    } catch (e) {
      Logger.log("DatabaseService.getSheet error: ' + e.message");
      return null;
    }
  },

  /**
   * Returns header row values for a sheet (cached).
   */
  getHeaderRow: function(sheetName) {
    try {
      const logicalKey = this._getLogicalSheetKey(sheetName);
      if (this._cache[logicalKey] && this._cache[logicalKey].headers) return this._cache[logicalKey].headers;

      const sheet = this.getSheet(logicalKey);
      if (!sheet) return [];

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
      if (!this._cache[logicalKey]) this._cache[logicalKey] = {};
      this._cache[logicalKey].headers = headers;
      return headers;
    } catch (e) {
      Logger.log('DatabaseService.getHeaderRow error: ' + (e && e.message ? e.message : e));
      return [];
    }
  },

  mapRowToObject: function(headers, row) {
    let obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  },

  mapObjectToRow: function(headers, object) {
    return headers.map(function(h) { return object[h] ?? ""; });
  },

  getHeaders: function(sheetName) {
    return this.getHeaderRow(sheetName);
  },

  count: function(sheetName) {
    try {
      const sheet = this.getSheet(sheetName);
      if (!sheet) return 0;
      return Math.max(0, sheet.getLastRow() - 1);
    } catch (e) {
      Logger.log('DatabaseService.count error: ' + (e && e.message ? e.message : e));
      return 0;
    }
  },

  clearCache: function(sheetName) {
    try {
      if (sheetName) delete this._cache[this._getLogicalSheetKey(sheetName)];
      else this._cache = {};
    } catch (e) {
      Logger.log('DatabaseService.clearCache error: ' + (e && e.message ? e.message : e));
    }
  },

  readAllRows: function(sheetName) {
    Logger.log("DB STEP 1: readAllRows called for sheetName: " + sheetName);
    try {
      const logicalKey = this._getLogicalSheetKey(sheetName);
      Logger.log("DB STEP 2: Resolved logicalKey: " + logicalKey);
      const cached = this._cache[logicalKey];
      if (cached && cached.records) {
        Logger.log("DB STEP 3: Returning cached records: " + cached.records.length);
        return cached.records;
      }

      const sheet = this.getSheet(logicalKey);
      if (!sheet) {
        Logger.log("DB STEP 4 WARNING: getSheet returned null/undefined for logicalKey: " + logicalKey);
        return [];
      }

      const data = sheet.getDataRange().getValues();
      Logger.log("DB STEP 5: getDataRange().getValues() returned raw rows: " + (data ? data.length : 0));
      if (!data || data.length <= 1) {
        Logger.log("DB STEP 6 WARNING: sheet empty or only headers found");
        return [];
      }

      const headers = data.shift();
      Logger.log("DB STEP 7: Parsed sheet headers: " + JSON.stringify(headers));
      const records = data.map(function(row) { return DatabaseService.mapRowToObject(headers, row); });
      Logger.log("DB STEP 8: Mapped rows count: " + records.length);

      this._cache[logicalKey] = { records: records, headers: headers };
      return records;
    } catch (e) {
      Logger.log('DB STEP 9 ERROR: DatabaseService.readAllRows error: ' + (e && e.message ? e.message : e) + "\nStack: " + e.stack);
      return [];
    }
  },

  getRows: function(sheetName, limit, offset) {
    try {
      const data = this.readAllRows(sheetName);
      const l = Number(limit) || 0;
      const o = Number(offset) || 0;
      return data.slice(o, o + l);
    } catch (e) {
      Logger.log('DatabaseService.getRows error: ' + (e && e.message ? e.message : e));
      return [];
    }
  },

  exists: function(sheetName, key, val) {
    try {
      return Boolean(this.findOne(sheetName, key, val));
    } catch (e) {
      Logger.log('DatabaseService.exists error: ' + (e && e.message ? e.message : e));
      return false;
    }
  },

  findOne: function(sheetName, key, val, includeDeleted) {
  try {
    includeDeleted = includeDeleted === true; // default false
    return this.readAllRows(sheetName).find(function(r) {
      if (!includeDeleted && r[CONFIG.COLUMNS.DELETION_FLAG] === true) return false;
      return String(r[key]) === String(val);
    });
  } catch (e) {
    Logger.log('DatabaseService.findOne error: ' + (e && e.message ? e.message : e));
    return undefined;
  }
},

  findByColumn: function(sheetName, col, val, options) {
    try {
      options = options || { caseSensitive: false, strict: false };
      return this.readAllRows(sheetName).filter(function(r) {
        let target = String(r[col] || "").trim();
        let search = String(val).trim();
        if (!options.caseSensitive) { target = target.toLowerCase(); search = search.toLowerCase(); }
        return options.strict ? target === search : target.indexOf(search) !== -1;
      });
    } catch (e) {
      Logger.log('DatabaseService.findByColumn error: ' + (e && e.message ? e.message : e));
      return [];
    }
  },

  filter: function(sheetName, predicate) {
    try {
      const data = this.readAllRows(sheetName);
      return typeof predicate === 'function' ? data.filter(predicate) : [];
    } catch (e) {
      Logger.log('DatabaseService.filter error: ' + (e && e.message ? e.message : e));
      return [];
    }
  },

  sortByColumn: function(sheetName, col, ascending) {
    try {
      ascending = ascending !== false;
      const data = [].concat(this.readAllRows(sheetName));
      return data.sort(function(a, b) {
        const valA = a[col] ?? "", valB = b[col] ?? "";
        return ascending ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
    } catch (e) {
      Logger.log('DatabaseService.sortByColumn error: ' + (e && e.message ? e.message : e));
      return [];
    }
  },

  sort: function(sheetName, col, ascending) {
    return this.sortByColumn(sheetName, col, ascending);
  },

  paginate: function(sheetName, limit, offset) {
    return this.getRows(sheetName, limit, offset);
  },

  insertRow: function(sheetName, recordData) {
    return this.insertRows(sheetName, [recordData])[0];
  },

insertRows: function(sheetName, records) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const logicalKey = this._getLogicalSheetKey(sheetName);
    const sheet = this.getSheet(logicalKey);
    if (!sheet) throw new Error('Sheet not available for ' + logicalKey);

    const headers = this.getHeaderRow(logicalKey);
    if (!headers || headers.length === 0) throw new Error('Missing headers for ' + logicalKey);

    const now = new Date().toISOString();
    const rows = records.map(function(record) {
      // Fix 1: Generate ID before validation — only if not already set by caller
      if (!record[CONFIG.ID_COLUMNS[logicalKey]]) {
        record[CONFIG.ID_COLUMNS[logicalKey]] = DatabaseService.generateNextId(logicalKey);
      }
      DatabaseService.validateRecord(logicalKey, record);
      
      if (CONFIG.COLUMNS.CREATED_AT) record[CONFIG.COLUMNS.CREATED_AT] = now;
      if (CONFIG.COLUMNS.UPDATED_AT) record[CONFIG.COLUMNS.UPDATED_AT] = new Date().toISOString();
      if (CONFIG.COLUMNS.CREATED_BY && record[CONFIG.COLUMNS.CREATED_BY] === undefined) record[CONFIG.COLUMNS.CREATED_BY] = "";
      if (CONFIG.COLUMNS.UPDATED_BY && record[CONFIG.COLUMNS.UPDATED_BY] === undefined) record[CONFIG.COLUMNS.UPDATED_BY] = "";
Logger.log("===== RECORD BEFORE MAP =====");
Logger.log(JSON.stringify(record, null, 2));

Logger.log("===== HEADERS =====");
Logger.log(JSON.stringify(headers, null, 2));
      return DatabaseService.mapObjectToRow(headers, record);
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
    this.clearCache(logicalKey);
    records.forEach(function(r) { DatabaseService.onInsert(logicalKey, r); });
    return records;
  } catch (e) {
    Logger.log('DatabaseService.insertRows error: ' + (e && e.message ? e.message : e));
    return [];
  } finally {
    lock.releaseLock();
  }
},


  updateRow: function(sheetName, key, val, updates) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const logicalKey = this._getLogicalSheetKey(sheetName);
      const sheet = this.getSheet(logicalKey);
      const headers = this.getHeaderRow(logicalKey);
      const keyIndex = headers.indexOf(key);
      const data = sheet.getDataRange().getValues();
      const rowIdx = data.slice(1).findIndex(function(row) { return String(row[keyIndex]) === String(val); });
      
      if (rowIdx === -1) throw new Error('Record not found.');
      const record = this.mapRowToObject(headers, data[rowIdx + 1]);
      for (let prop in updates) { record[prop] = updates[prop]; }
      if (CONFIG.COLUMNS.UPDATED_AT) record[CONFIG.COLUMNS.UPDATED_AT] = new Date().toISOString();

      sheet.getRange(rowIdx + 2, 1, 1, headers.length).setValues([this.mapObjectToRow(headers, record)]);
      this.clearCache(logicalKey);
      this.onUpdate(logicalKey, val, record);
      return record;
    } catch (e) {
      Logger.log('DatabaseService.updateRow error: ' + (e && e.message ? e.message : e));
      return null;
    } finally {
      lock.releaseLock();
    }
  },

  batchUpdate: function(sheetName, key, vals, updates) {
    try {
      const logicalKey = this._getLogicalSheetKey(sheetName);
      return (Array.isArray(vals) ? vals : []).map(function(v) { return DatabaseService.updateRow(logicalKey, key, v, updates || {}); });
    } catch (e) { return []; }
  },

  hardDelete: function(sheetName, key, val) {
    try {
      const logicalKey = this._getLogicalSheetKey(sheetName);
      const sheet = this.getSheet(logicalKey);
      const headers = this.getHeaderRow(logicalKey);
      const keyIndex = headers.indexOf(key);
      const data = sheet.getDataRange().getValues();
      const rowIdx = data.slice(1).findIndex(function(row) { return String(row[keyIndex]) === String(val); });
      if (rowIdx !== -1) {
        sheet.deleteRow(rowIdx + 2);
        this.clearCache(logicalKey);
        this.onDelete(logicalKey, val);
      }
    } catch (e) { Logger.log('DatabaseService.hardDelete error: ' + (e && e.message ? e.message : e)); }
  },

  softDelete: function(sheetName, key, val, deletedValue) {
    try {
      const logicalKey = this._getLogicalSheetKey(sheetName);
      const updateData = {};
      updateData[CONFIG.COLUMNS.DELETION_FLAG] = (deletedValue !== undefined) ? deletedValue : true;
      if (CONFIG.COLUMNS.UPDATED_AT) updateData[CONFIG.COLUMNS.UPDATED_AT] = new Date().toISOString();
      return Boolean(this.updateRow(logicalKey, key, val, updateData));
    } catch (e) { return false; }
  },

  deleteRow: function(sheetName, key, val) {
    try {
      const logicalKey = this._getLogicalSheetKey(sheetName);
      if (CONFIG && CONFIG.COLUMNS && CONFIG.COLUMNS.DELETION_FLAG) {
        if (this.softDelete(logicalKey, key, val)) return true;
      }
      this.hardDelete(logicalKey, key, val);
      return true;
    } catch (e) { return false; }
  },

 validateRecord: function(sheetName, data) {
    const logicalKey = this._getLogicalSheetKey(sheetName);
    const required = CONFIG.REQUIRED_FIELDS[logicalKey] || [];
    required.forEach(function(f) { if (!data[f]) throw new Error('Missing field: ' + f); });

    const idCol = CONFIG.ID_COLUMNS[logicalKey];
    if (idCol && data[idCol] !== undefined) {
      // Fix 2: Explicitly use DatabaseService to maintain correct context
      if (DatabaseService.findOne(logicalKey, idCol, data[idCol])) throw new Error('Duplicate record.');
    }
  },

  generateNextId: function(sheetName) {
    const logicalKey = this._getLogicalSheetKey(sheetName);
    const cfg = CONFIG.ID_FORMATS[logicalKey];
    const idCol = CONFIG.ID_COLUMNS[logicalKey];
    if (!cfg || !idCol) throw new Error('Missing ID format/column config for ' + logicalKey);

    const records = this.readAllRows(logicalKey);
    const ids = records.map(function(r) {
        const raw = r[idCol];
        return (raw === undefined || raw === null || raw === '') ? NaN : parseInt(String(raw).replace(cfg.prefix, ''), 10);
      }).filter(function(n) { return !isNaN(n); });

    return cfg.prefix + (Math.max.apply(null, [0].concat(ids)) + 1).toString().padStart(cfg.digits, '0');
  },

  onInsert: function(s, d) { Logger.log('Audit: Insert ' + s); },
  onUpdate: function(s, k, d) { Logger.log('Audit: Update ' + s); },
  onDelete: function(s, k) { Logger.log('Audit: Delete ' + s); },
  beginTransaction: function() { Logger.log('Transaction Started'); },
  commit: function() { Logger.log('Transaction Committed'); },
  rollback: function() { Logger.log('Transaction Rollback'); }
};