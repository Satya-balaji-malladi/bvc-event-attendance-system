/**
 * Data Access Layer (DAL) for the College Event Attendance Management System.
 * Handles pure data interactions with Google Sheets.
 */

const DatabaseService = {
  /**
   * Gets the active spreadsheet using the ID from CONFIG.
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  getSpreadsheet: function() {
    if (!CONFIG || !CONFIG.SPREADSHEET || !CONFIG.SPREADSHEET.ID) {
      throw new Error('Spreadsheet ID is not defined in CONFIG.');
    }
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET.ID);
  },

  /**
   * Gets a specific sheet by name.
   * @param {string} sheetName
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getSheet: function(sheetName) {
    const ss = this.getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('Sheet not found: ' + sheetName);
    }
    return sheet;
  },

  /**
   * Gets the header row (first row) of a sheet.
   * @param {string} sheetName
   * @returns {string[]} Array of header names.
   */
  getHeaderRow: function(sheetName) {
    const sheet = this.getSheet(sheetName);
    const lastColumn = sheet.getLastColumn();
    if (lastColumn === 0) return [];
    return sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  },

  /**
   * Gets the number of data rows in a sheet (excluding the header row).
   * @param {string} sheetName
   * @returns {number} The count of data rows.
   */
  getRowCount: function(sheetName) {
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    return lastRow > 1 ? lastRow - 1 : 0;
  },

  /**
   * Reads all rows from a sheet as an array of objects mapping headers to values.
   * @param {string} sheetName
   * @returns {object[]} Array of record objects.
   */
  readAllRows: function(sheetName) {
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    
    if (lastRow <= 1) return [];

    const dataRange = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
    const headers = dataRange.shift();
    
    return dataRange.map(row => {
      let record = {};
      headers.forEach((header, index) => {
        record[header] = row[index];
      });
      return record;
    });
  },

  /**
   * Inserts a new row into the specified sheet.
   * @param {string} sheetName
   * @param {object} recordData
   * @returns {boolean} True if inserted successfully.
   */
  insertRow: function(sheetName, recordData) {
    const sheet = this.getSheet(sheetName);
    const headers = this.getHeaderRow(sheetName);
    
    if (headers.length === 0) {
      throw new Error('Cannot insert into a sheet without headers.');
    }
    
    const rowData = headers.map(header => {
      return recordData.hasOwnProperty(header) ? recordData[header] : '';
    });

    sheet.appendRow(rowData);
    return true;
  },

  /**
   * Updates a row based on a unique identifying column and value.
   * @param {string} sheetName
   * @param {string} searchColumn
   * @param {any} searchValue
   * @param {object} updateData
   * @returns {boolean} True if updated successfully.
   */
  updateRow: function(sheetName, searchColumn, searchValue, updateData) {
    const sheet = this.getSheet(sheetName);
    const records = this.readAllRows(sheetName);
    const headers = this.getHeaderRow(sheetName);
    
    let rowIndex = -1;
    for (let i = 0; i < records.length; i++) {
      if (records[i][searchColumn] === searchValue) {
        rowIndex = i + 2; 
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Record not found for update.');
    }

    const currentRowValues = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    const newRowValues = headers.map((header, index) => {
      return updateData.hasOwnProperty(header) ? updateData[header] : currentRowValues[index];
    });

    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([newRowValues]);
    return true;
  },

  /**
   * Deletes a row based on a unique identifying column and value.
   * @param {string} sheetName
   * @param {string} searchColumn
   * @param {any} searchValue
   * @returns {boolean} True if deleted successfully.
   */
  deleteRow: function(sheetName, searchColumn, searchValue) {
    const sheet = this.getSheet(sheetName);
    const records = this.readAllRows(sheetName);
    
    let rowIndex = -1;
    for (let i = 0; i < records.length; i++) {
      if (records[i][searchColumn] === searchValue) {
        rowIndex = i + 2; 
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Record not found for deletion.');
    }

    sheet.deleteRow(rowIndex);
    return true;
  },

  /**
   * Finds records that match a specific column and value.
   * @param {string} sheetName
   * @param {string} searchColumn
   * @param {any} searchValue
   * @returns {object[]} Array of matched records.
   */
  findByColumn: function(sheetName, searchColumn, searchValue) {
  const records = this.readAllRows(sheetName);

  return records.filter(function(record) {
    return String(record[searchColumn]).trim() ===
           String(searchValue).trim();
  });
},

  /**
   * Checks if a record exists based on a specific column and value.
   * @param {string} sheetName
   * @param {string} searchColumn
   * @param {any} searchValue
   * @returns {boolean} True if exists, false otherwise.
   */
  exists: function(sheetName, searchColumn, searchValue) {
    const records = this.findByColumn(sheetName, searchColumn, searchValue);
    return records.length > 0;
  }
};
