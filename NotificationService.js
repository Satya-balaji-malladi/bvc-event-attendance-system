/**
 * NotificationService.js
 *
 * Production-ready notification management for BVC Engineering College system.
 * Responsibilities:
 * - Create, send, read/unread, soft delete
 * - Retrieval by user, unread counts
 * - Search/filter/sort/pagination
 * - Notification statistics
 *
 * IMPORTANT:
 * - All database operations go through DatabaseService.
 * - No direct Spreadsheet access.
 */
const NotificationService = {

  // ==============================
  // Private helpers
  // ==============================

  _notificationSheet: function() {
    // Uses CONFIG.SHEETS.NOTIFICATIONS
    if (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.NOTIFICATIONS) return CONFIG.SHEETS.NOTIFICATIONS;
    // TODO: Verify sheet mapping for Notifications in CONFIG.SHEETS.
    throw new Error('Missing CONFIG.SHEETS.NOTIFICATIONS');
  },

  _statusEnum: function() {
    // Backward compatible: use CONFIG.NOTIFICATION_STATUS if present.
    if (CONFIG && CONFIG.NOTIFICATION_STATUS) return CONFIG.NOTIFICATION_STATUS;
    // Config.js uses CONFIG.NOTIFICATION_STATUS.{UNREAD,READ}
    if (CONFIG && CONFIG.NOTIFICATION_STATUS) return CONFIG.NOTIFICATION_STATUS;

    // TODO: Align notification status enum with sheet values.
    return { UNREAD: 'Unread', READ: 'Read' };
  },

  _softDeleteFlagValue: function() {
    // Soft delete flag stored in CONFIG.COLUMNS.DELETION_FLAG.
    // DatabaseService.softDelete expects deletedValue; if undefined it sets true.
    return true;
  },

  _getDeletionFlagKey: function() {
    // Only for mapping defaults; DatabaseService will use CONFIG.COLUMNS.DELETION_FLAG for softDelete.
    return CONFIG && CONFIG.COLUMNS && CONFIG.COLUMNS.DELETION_FLAG ? CONFIG.COLUMNS.DELETION_FLAG : 'Deletion Flag';
  },

  _getUpdatedAtKey: function() {
    return CONFIG && CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_AT ? CONFIG.COLUMNS.UPDATED_AT : 'Updated At';
  },

  _getUpdatedByKey: function() {
    return CONFIG && CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_BY ? CONFIG.COLUMNS.UPDATED_BY : 'Updated By';
  },

  _tryNormalizePagination: function(page, pageSize) {
    var p = Number(page) || 1;
    var s = Number(pageSize) || 10;
    if (p < 1) p = 1;
    if (s < 1) s = 10;
    return { page: p, pageSize: s, offset: (p - 1) * s, limit: s };
  },

  _applyTextSearch: function(records, field, keyword) {
    if (!Array.isArray(records)) return [];
    if (!keyword) return records;

    var kw = String(keyword).toLowerCase();
    return records.filter(function(r) {
      var val = r && r[field] !== undefined && r[field] !== null ? String(r[field]) : '';
      return val.toLowerCase().indexOf(kw) !== -1;
    });
  },

  _filterByUser: function(records, userId, userIdField) {
    if (!Array.isArray(records)) return [];
    if (userId === undefined || userId === null || userId === '') return records;
    var uid = String(userId);
    return records.filter(function(r) {
      return r && String(r[userIdField]) === uid;
    });
  },

  // Normalize common column keys.
  _colKeys: function() {
    // NOTE: Uses CONFIG.COLUMNS where possible; falls back to existing header names.
    // TODO: If your sheet headers differ, update CONFIG.COLUMNS mapping.
    var c = (CONFIG && CONFIG.COLUMNS) ? CONFIG.COLUMNS : {};
    return {
      id: c.NOTIFICATION_ID || (CONFIG && CONFIG.ID_COLUMNS && CONFIG.ID_COLUMNS.NOTIFICATIONS ? CONFIG.ID_COLUMNS.NOTIFICATIONS : 'Notification ID'),
      userId: c.NOTIFICATION_USER_ID || 'User ID',
      title: c.NOTIFICATION_TITLE || 'Title',
      message: c.NOTIFICATION_MESSAGE || 'Message',
      type: c.NOTIFICATION_TYPE || 'Notification Type',
      status: c.NOTIFICATION_STATUS || 'Status',
      createdAt: c.CREATED_AT || 'Created At',
      updatedAt: c.UPDATED_AT || 'Updated At',
      deletionFlag: c.DELETION_FLAG || 'Deletion Flag'
    };
  },

  // ==============================
  // Public API (required)
  // ==============================

  createNotification: function(notificationData) {
    try {
      if (!notificationData) return Utils.buildResponse(false, 'Notification data is required.');

      var sheetName = this._notificationSheet();
      var k = this._colKeys();

      var userId = notificationData[k.userId] || notificationData.userId || notificationData.user_id || notificationData.userID;
      var title = notificationData[k.title] || notificationData.title || '';
      var message = notificationData[k.message] || notificationData.message || '';
      var type = notificationData[k.type] || notificationData.type || notificationData.notificationType || 'System Notification';

      // Status defaults to UNREAD
      var statusEnum = this._statusEnum();
      var statusValue = notificationData[k.status] || notificationData.status || statusEnum.UNREAD;

      // Generate notification id
      var notificationId;
      try {
        notificationId = IdService.generateNotificationId ? IdService.generateNotificationId() : ('NOT-' + Utils.generateUUID());
      } catch (e1) {
        // TODO: Ensure IdService.generateNotificationId exists and works with CONFIG.
        notificationId = 'NOT-' + new Date().getTime();
      }

      var nowIso = new Date().toISOString();
      var record = {};
      record[k.id] = notificationId;
      record[k.userId] = userId;
      record[k.title] = title;
      record[k.message] = message;
      record[k.type] = type;
      record[k.status] = statusValue;

      if (k.createdAt) record[k.createdAt] = nowIso;
      if (k.updatedAt) record[k.updatedAt] = nowIso;
      if (CONFIG && CONFIG.COLUMNS && CONFIG.COLUMNS.DELETION_FLAG) record[k.deletionFlag] = false;

      var inserted = DatabaseService.insertRow(sheetName, record);
      const resp = Utils.buildResponse(true, 'Notification created', { notification: inserted || record });
      try {
          AuditService.logAction(
          userId,
          'NotificationService',
          'CREATE_NOTIFICATION',
          notificationId,
          'Notification',
          'Notification created',
          '',
          'SUCCESS',
          userId
        );
      } catch (error) {
        Logger.log(error && error.message ? error.message : error);
      }
      return resp;
    } catch (error) {
      Logger.log('NotificationService.createNotification error: ' + (error && error.message ? error.message : error));
      return Utils.buildResponse(false, error && error.message ? error.message : 'Failed to create notification');
    }
  },

  // For this project, "send" is the same as create (no external email/push here).
  sendNotification: function(notificationData) {
    try {
      // Keep business logic backward compatible: createNotification is authoritative.
      return this.createNotification(notificationData);
    } catch (error) {
      Logger.log('NotificationService.sendNotification error: ' + (error && error.message ? error.message : error));
      return Utils.buildResponse(false, error && error.message ? error.message : 'Failed to send notification');
    }
  },

  getNotificationById: function(notificationId) {
    try {
      if (!notificationId) return null;
      var sheetName = this._notificationSheet();
      var k = this._colKeys();

      var records = DatabaseService.findByColumn(sheetName, k.id, notificationId, { caseSensitive: true, strict: true });
      if (!records || records.length === 0) return null;

      // Soft delete filtering: if Deletion Flag exists, hide deleted.
      var delKey = this._getDeletionFlagKey();
      if (records[0] && records[0][delKey]) return null;

      return records[0];
    } catch (error) {
      Logger.log('NotificationService.getNotificationById error: ' + (error && error.message ? error.message : error));
      return null;
    }
  },

  getNotificationsByUser: function(userId) {
    try {
      if (!userId) return [];
      var sheetName = this._notificationSheet();
      var k = this._colKeys();

      var all = DatabaseService.readAllRows(sheetName) || [];
      var active = all.filter(function(r) {
        return r && !r[k.deletionFlag];
      });

      return this._filterByUser(active, userId, k.userId);
    } catch (error) {
      Logger.log('NotificationService.getNotificationsByUser error: ' + (error && error.message ? error.message : error));
      return [];
    }
  },

  getUnreadNotifications: function(userId) {
    try {
      var records = this.getNotificationsByUser(userId);
      var statusEnum = this._statusEnum();
      var unread = records.filter(function(r) {
        return r && String(r[(this._colKeys && this._colKeys().status) ? this._colKeys().status : 'Status']) === String(statusEnum.UNREAD);
      }.bind(this));

      return unread;
    } catch (error) {
      Logger.log('NotificationService.getUnreadNotifications error: ' + (error && error.message ? error.message : error));
      return [];
    }
  },

  markAsRead: function(notificationId, updatedBy) {
    try {
      if (!notificationId) return Utils.buildResponse(false, 'Notification ID is required.');
      var sheetName = this._notificationSheet();
      var k = this._colKeys();
      var statusEnum = this._statusEnum();

      var updates = {};
      updates[k.status] = statusEnum.READ;
      updates[this._getUpdatedAtKey()] = Utils.getCurrentTimestamp();
      if (this._getUpdatedByKey()) updates[this._getUpdatedByKey()] = updatedBy || '';

      var updated = DatabaseService.updateRow(sheetName, k.id, notificationId, updates);
      return Utils.buildResponse(true, 'Notification marked as read', { notification: updated || null });
    } catch (error) {
      Logger.log('NotificationService.markAsRead error: ' + (error && error.message ? error.message : error));
      return Utils.buildResponse(false, error && error.message ? error.message : 'Failed to mark as read');
    }
  },

  markAsUnread: function(notificationId, updatedBy) {
    try {
      if (!notificationId) return Utils.buildResponse(false, 'Notification ID is required.');
      var sheetName = this._notificationSheet();
      var k = this._colKeys();
      var statusEnum = this._statusEnum();

      var updates = {};
      updates[k.status] = statusEnum.UNREAD;
      updates[this._getUpdatedAtKey()] = Utils.getCurrentTimestamp();
      if (this._getUpdatedByKey()) updates[this._getUpdatedByKey()] = updatedBy || '';

      var updated = DatabaseService.updateRow(sheetName, k.id, notificationId, updates);
      return Utils.buildResponse(true, 'Notification marked as unread', { notification: updated || null });
    } catch (error) {
      Logger.log('NotificationService.markAsUnread error: ' + (error && error.message ? error.message : error));
      return Utils.buildResponse(false, error && error.message ? error.message : 'Failed to mark as unread');
    }
  },

  deleteNotification: function(notificationId, updatedBy) {
    // Soft delete
    try {
      if (!notificationId) return Utils.buildResponse(false, 'Notification ID is required.');
      var sheetName = this._notificationSheet();
      var k = this._colKeys();

      // Prefer DatabaseService.deleteRow which is soft-delete aware.
      var ok = DatabaseService.deleteRow(sheetName, k.id, notificationId);

      return Utils.buildResponse(Boolean(ok), ok ? 'Notification deleted' : 'Notification delete failed');
    } catch (error) {
      Logger.log('NotificationService.deleteNotification error: ' + (error && error.message ? error.message : error));
      return Utils.buildResponse(false, error && error.message ? error.message : 'Failed to delete notification');
    }
  },

  searchNotifications: function(userId, keyword) {
    try {
      // Search in title + message + type (best-effort)
      var records = this.getNotificationsByUser(userId);
      if (!keyword) return records;

      var k = this._colKeys();
      var kw = String(keyword).toLowerCase();

      return records.filter(function(r) {
        var t = r && r[k.title] !== undefined && r[k.title] !== null ? String(r[k.title]).toLowerCase() : '';
        var m = r && r[k.message] !== undefined && r[k.message] !== null ? String(r[k.message]).toLowerCase() : '';
        var ty = r && r[k.type] !== undefined && r[k.type] !== null ? String(r[k.type]).toLowerCase() : '';
        return t.indexOf(kw) !== -1 || m.indexOf(kw) !== -1 || ty.indexOf(kw) !== -1;
      });
    } catch (error) {
      Logger.log('NotificationService.searchNotifications error: ' + (error && error.message ? error.message : error));
      return [];
    }
  },

  filterNotifications: function(filters) {
    try {
      filters = filters || {};
      var userId = filters.userId || filters.user_id || '';
      var status = filters.status || filters.notificationStatus || '';
      var type = filters.type || filters.notificationType || '';

      var records = this.getNotificationsByUser(userId);
      var k = this._colKeys();

      if (status) {
        records = records.filter(function(r) { return String(r[k.status]) === String(status); });
      }
      if (type) {
        records = records.filter(function(r) { return String(r[k.type]) === String(type); });
      }

      return records;
    } catch (error) {
      Logger.log('NotificationService.filterNotifications error: ' + (error && error.message ? error.message : error));
      return [];
    }
  },

  sortNotifications: function(records, sortBy, order) {
    try {
      records = Array.isArray(records) ? records.slice() : [];
      order = (order || 'asc').toLowerCase();

      var k = this._colKeys();
      var dir = order === 'desc' ? -1 : 1;

      // sortBy best-effort mapping
      var field = sortBy;
      if (sortBy === 'createdAt') field = k.createdAt;
      if (sortBy === 'updatedAt') field = k.updatedAt;
      if (sortBy === 'title') field = k.title;

      // If field is unknown, keep original ordering.
      if (!field) return records;

      records.sort(function(a, b) {
        var va = a && a[field] !== undefined && a[field] !== null ? a[field] : '';
        var vb = b && b[field] !== undefined && b[field] !== null ? b[field] : '';
        if (va === vb) return 0;
        return va > vb ? dir : -dir;
      });

      return records;
    } catch (error) {
      Logger.log('NotificationService.sortNotifications error: ' + (error && error.message ? error.message : error));
      return Array.isArray(records) ? records : [];
    }
  },

  paginateNotifications: function(records, page, pageSize) {
    try {
      records = Array.isArray(records) ? records : [];
      var meta = this._tryNormalizePagination(page, pageSize);
      return {
        totalRecords: records.length,
        currentPage: meta.page,
        totalPages: Math.ceil(records.length / meta.pageSize) || 0,
        items: records.slice(meta.offset, meta.offset + meta.limit)
      };
    } catch (error) {
      Logger.log('NotificationService.paginateNotifications error: ' + (error && error.message ? error.message : error));
      return { totalRecords: 0, currentPage: 1, totalPages: 0, items: [] };
    }
  },

  getNotificationStatistics: function(userId) {
    try {
      var records = this.getNotificationsByUser(userId);
      var statusEnum = this._statusEnum();
      var k = this._colKeys();

      var unread = records.filter(function(r) { return String(r[k.status]) === String(statusEnum.UNREAD); }).length;
      var read = records.length - unread;

      return Utils.buildResponse(true, 'Notification statistics generated', {
        total: records.length,
        unread: unread,
        read: read
      });
    } catch (error) {
      Logger.log('NotificationService.getNotificationStatistics error: ' + (error && error.message ? error.message : error));
      return Utils.buildResponse(false, error && error.message ? error.message : 'Failed to get notification statistics');
    }
  }

};

