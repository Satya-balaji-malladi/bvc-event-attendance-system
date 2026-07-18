/**
 * EventService.gs
 * Service for handling event management.
 * Responsibilities: CRUD operations for events, status updates, searching, filtering, sorting, pagination, statistics, and attendance helpers.
 */
const EventService = {

  // ==========================================================
  // Internal helpers (private)
  // ==========================================================

  _normalizeEventTime_: function(timeValue) {
    // Normalizes event start time for dedup/search.
    // Handles values like "HH:mm", "HH:mm:ss" and Date objects as best-effort.
    try {
      if (timeValue === null || timeValue === undefined) return '';

      // If it is a Date object, format to HH:mm directly
      if (timeValue instanceof Date || (typeof timeValue === 'object' && typeof timeValue.getHours === 'function')) {
        return Utilities.formatDate(timeValue, CONFIG.DATE_TIME.TIMEZONE, 'HH:mm');
      }

      var s = String(timeValue).trim();
      if (!s) return '';

      // If it's a full date-time string containing time
      if (s.includes('1899') || s.includes('GMT') || (s.length > 8 && !isNaN(Date.parse(s)))) {
        var parsedDate = new Date(s);
        if (!isNaN(parsedDate.getTime())) {
          return Utilities.formatDate(parsedDate, CONFIG.DATE_TIME.TIMEZONE, 'HH:mm');
        }
      }

      // If already HH:mm:ss keep first HH:mm
      // e.g. "09:30:00" -> "09:30"
      var m = s.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
      if (m) return m[1] + ':' + m[2];

      // Fallback: return trimmed string
      return s;
    } catch (e) {
      Logger.log('EventService._normalizeEventTime_ error: ' + (e && e.message ? e.message : e));
      return '';
    }
  },

  _safeDeletionFlag_(eventRecord) {
    // Deletion flag can be boolean or string in sheets.
    try {
      if (!eventRecord || !CONFIG || !CONFIG.COLUMNS || !CONFIG.COLUMNS.DELETION_FLAG) return false;
      var v = eventRecord[CONFIG.COLUMNS.DELETION_FLAG];
      if (v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1') return true;
      return false;
    } catch (e) {
      Logger.log('EventService._safeDeletionFlag_ error: ' + (e && e.message ? e.message : e));
      return false;
    }
  },

  _getActiveEventsForDedup_: function() {
    // Best-effort reuse to reduce duplicate DatabaseService reads.
    // Cache is per invocation of EventService object (no cross-request persistence).
    try {
      if (this._activeEventsForDedup_ && Array.isArray(this._activeEventsForDedup_)) {
        return this._activeEventsForDedup_;
      }

      var events = DatabaseService.readAllRows(CONFIG.SHEETS.EVENTS) || [];
      var active = events.filter(function(e) { return !EventService._safeDeletionFlag_(e); });
      this._activeEventsForDedup_ = active;
      return active;
    } catch (e) {
      Logger.log('EventService._getActiveEventsForDedup_ error: ' + (e && e.message ? e.message : e));
      return [];
    }
  },

  _evaluateEventStatus_: function(eventRecord) {
    // Ensure null safety.
    // Best-effort lifecycle/status evaluation without mutating the sheet.
    // NOTE: Some sheets may already store Status. If present we keep it.
    // If missing, we attempt to derive status from dates and configured EVENT_STATUS.
    try {
      if (!eventRecord) return eventRecord;

      var c = CONFIG || {};
      var cols = c.COLUMNS || {};
      var statusKey = eventRecord['Event Status'] !== undefined ? 'Event Status' : (cols.STATUS || null);

      // If sheet already has status, keep it.
      if (statusKey && eventRecord[statusKey]) {
        return eventRecord;
      }

      // Default to Draft if we cannot compute.
      var draft = (c.EVENT_STATUS && c.EVENT_STATUS.DRAFT) ? c.EVENT_STATUS.DRAFT : 'Draft';
      var active = (c.EVENT_STATUS && c.EVENT_STATUS.ACTIVE) ? c.EVENT_STATUS.ACTIVE : 'Active';
      var completed = (c.EVENT_STATUS && c.EVENT_STATUS.COMPLETED) ? c.EVENT_STATUS.COMPLETED : 'Completed';
      var cancelled = (c.EVENT_STATUS && c.EVENT_STATUS.CANCELLED) ? c.EVENT_STATUS.CANCELLED : 'Cancelled';
      var stopped = (c.EVENT_STATUS && c.EVENT_STATUS.STOPPED) ? c.EVENT_STATUS.STOPPED : 'Stopped';

      // If sheet stores a cancellation/deletion-like flag but status is missing.
      if (this._safeDeletionFlag_(eventRecord)) {
        if (statusKey) eventRecord[statusKey] = cancelled;
        return eventRecord;
      }

      // Date-based evaluation uses START_DATE/END_DATE if present.
      var startKey = cols.START_DATE || null;
      var endKey = cols.END_DATE || null;

      var now = Utils.getCurrentDate ? Utils.getCurrentDate() : new Date();
      var nowMs = (now && now.getTime) ? now.getTime() : new Date().getTime();

      var startMs = null;
      var endMs = null;
      try {
        if (startKey && eventRecord[startKey]) startMs = new Date(eventRecord[startKey]).getTime();
      } catch (e1) {}
      try {
        if (endKey && eventRecord[endKey]) endMs = new Date(eventRecord[endKey]).getTime();
      } catch (e2) {}

      // If we have endMs and it's in the past => Completed.
      if (endMs !== null && !isNaN(endMs)) {
        if (nowMs > endMs) {
          if (statusKey) eventRecord[statusKey] = completed;
          return eventRecord;
        }
      }

      // If we have startMs and it's in the future => Draft/Upcoming.
      // This system blueprint uses UPCOMING; keep it if configured.
      var upcoming = (c.EVENT_STATUS && c.EVENT_STATUS.UPCOMING) ? c.EVENT_STATUS.UPCOMING : null;
      if (startMs !== null && !isNaN(startMs)) {
        if (nowMs < startMs) {
          if (statusKey) eventRecord[statusKey] = upcoming || draft;
          return eventRecord;
        }
      }

      // Otherwise, treat as active.
      if (statusKey) {
        // If there is also a stopped field in the record, prefer it.
        // (Backward compatible: only if sheet already has it.)
        if (eventRecord[statusKey] === stopped) {
          eventRecord[statusKey] = stopped;
        } else {
          eventRecord[statusKey] = active;
        }
      }
      return eventRecord;
    } catch (e) {
      Logger.log('EventService._evaluateEventStatus_ error: ' + (e && e.message ? e.message : e));
      return eventRecord;
    }
  },

  _getAllActiveSanitizedEvents_: function() {
    try {
      if (this._allActiveSanitizedEvents_) return this._allActiveSanitizedEvents_;

      var events = DatabaseService.readAllRows(CONFIG.SHEETS.EVENTS) || [];
      var filtered = events.filter(function(e) { return !EventService._safeDeletionFlag_(e); });
      var evaluated = filtered.map(function(e) { return EventService._evaluateEventStatus_(e); });
      this._allActiveSanitizedEvents_ = evaluated.map(function(e) { return Utils.sanitizeEvent(e); });
      return this._allActiveSanitizedEvents_;
    } catch (error) {
      Logger.log('EventService._getAllActiveSanitizedEvents_ error: ' + (error && error.message ? error.message : error));
      this._allActiveSanitizedEvents_ = [];
      return [];
    }
  },

  _getEventValidationPayload_: function(eventData) {
    try {
      var out = {};
      out.eventName = eventData && (eventData[CONFIG.COLUMNS.EVENT_NAME] !== undefined ? eventData[CONFIG.COLUMNS.EVENT_NAME] : (eventData.eventName || eventData.event_name));
      out.startDate = eventData && (eventData[CONFIG.COLUMNS.START_DATE] !== undefined ? eventData[CONFIG.COLUMNS.START_DATE] : (eventData.startDate || eventData.start_date));
      out.endDate = eventData && (eventData[CONFIG.COLUMNS.END_DATE] !== undefined ? eventData[CONFIG.COLUMNS.END_DATE] : (eventData.endDate || eventData.end_date));
      out.startTime = eventData && (eventData[CONFIG.COLUMNS.START_TIME] !== undefined ? eventData[CONFIG.COLUMNS.START_TIME] : (eventData.startTime || eventData.start_time));
      out.endTime = eventData && (eventData[CONFIG.COLUMNS.END_TIME] !== undefined ? eventData[CONFIG.COLUMNS.END_TIME] : (eventData.endTime || eventData.end_time));
      out.venueId = eventData && (eventData[CONFIG.COLUMNS.VENUE] !== undefined ? eventData[CONFIG.COLUMNS.VENUE] : (eventData.venueId || eventData.venue || eventData.location));
      out.status = eventData && (eventData[CONFIG.COLUMNS.EVENT_STATUS] !== undefined ? eventData[CONFIG.COLUMNS.EVENT_STATUS] : (eventData[CONFIG.COLUMNS.STATUS] !== undefined ? eventData[CONFIG.COLUMNS.STATUS] : eventData.status));
      return out;
    } catch (e) {
      Logger.log('EventService._getEventValidationPayload_ error: ' + (e && e.message ? e.message : e));
      return {
        eventName: eventData && (eventData[CONFIG.COLUMNS.EVENT_NAME] || eventData.eventName || eventData.event_name),
        startDate: eventData && (eventData[CONFIG.COLUMNS.START_DATE] || eventData.startDate || eventData.start_date),
        endDate: eventData && (eventData[CONFIG.COLUMNS.END_DATE] || eventData.endDate || eventData.end_date),
        startTime: eventData && (eventData[CONFIG.COLUMNS.START_TIME] || eventData.startTime || eventData.start_time),
        endTime: eventData && (eventData[CONFIG.COLUMNS.END_TIME] || eventData.endTime || eventData.end_time),
        venueId: eventData && (eventData[CONFIG.COLUMNS.VENUE] || eventData.venueId || eventData.venue || eventData.location),
        status: eventData && (eventData[CONFIG.COLUMNS.EVENT_STATUS] || eventData[CONFIG.COLUMNS.STATUS] || eventData.status)
      };
    }
  },

  _invalidateCaches_: function() {
    try {
      delete this._allActiveSanitizedEvents_;
      delete this._activeEventsForDedup_;
    } catch (e) {
      Logger.log('EventService._invalidateCaches_ error: ' + (e && e.message ? e.message : e));
    }
  },

  _isDuplicateEvent: function(eventName, eventStartDate, venue, startTime, excludeEventId) {
    try {
      // Reuse cached active events (best-effort). Fallback to direct read if cache is unavailable.
      const activeEvents = this._getActiveEventsForDedup_();
      if (!activeEvents || activeEvents.length === 0) return false;

      const normalizedName = eventName ? Utils.trimText(eventName).toLowerCase() : '';
      const normalizedDate = eventStartDate ? Utils.formatDate(eventStartDate) : '';
      const normalizedVenue = venue ? Utils.trimText(venue).toLowerCase() : '';
      const normalizedTime = this._normalizeEventTime_(startTime);

      return activeEvents.some(event => {
        if (excludeEventId && event && event[CONFIG.COLUMNS.EVENT_ID] === excludeEventId) return false;
        const eName = event && event[CONFIG.COLUMNS.EVENT_NAME] ? Utils.trimText(event[CONFIG.COLUMNS.EVENT_NAME]).toLowerCase() : '';
        const eDate = event && event[CONFIG.COLUMNS.START_DATE] ? Utils.formatDate(event[CONFIG.COLUMNS.START_DATE]) : '';
        const eVenue = event && event[CONFIG.COLUMNS.VENUE] ? Utils.trimText(event[CONFIG.COLUMNS.VENUE]).toLowerCase() : '';
        const eTime = this._normalizeEventTime_(event ? event[CONFIG.COLUMNS.START_TIME] : null);

        return (eName === normalizedName && eDate === normalizedDate && eVenue === normalizedVenue && eTime === normalizedTime);
      });
    } catch (error) {
      Logger.log('EventService._isDuplicateEvent error: ' + (error && error.message ? error.message : error));
      return false;
    }
  },

  _normalizeEventPayload: function(eventData) {
    if (!eventData) return {};
    var out = {};
    
    var name = eventData[CONFIG.COLUMNS.EVENT_NAME] !== undefined ? eventData[CONFIG.COLUMNS.EVENT_NAME] : (eventData.event_name || eventData.eventName);
    if (name !== undefined) out[CONFIG.COLUMNS.EVENT_NAME] = name;
    
    var desc = eventData[CONFIG.COLUMNS.DESCRIPTION] !== undefined ? eventData[CONFIG.COLUMNS.DESCRIPTION] : eventData.description;
    if (desc !== undefined) out[CONFIG.COLUMNS.DESCRIPTION] = desc;
    
    var sDate = eventData[CONFIG.COLUMNS.START_DATE] !== undefined ? eventData[CONFIG.COLUMNS.START_DATE] : (eventData.start_date || eventData.startDate);
    if (sDate !== undefined) out[CONFIG.COLUMNS.START_DATE] = sDate;
    
    var eDate = eventData[CONFIG.COLUMNS.END_DATE] !== undefined ? eventData[CONFIG.COLUMNS.END_DATE] : (eventData.end_date || eventData.endDate);
    if (eDate !== undefined) out[CONFIG.COLUMNS.END_DATE] = eDate;
    
    var sTime = eventData[CONFIG.COLUMNS.START_TIME] !== undefined ? eventData[CONFIG.COLUMNS.START_TIME] : (eventData.start_time || eventData.startTime);
    if (sTime !== undefined) out[CONFIG.COLUMNS.START_TIME] = sTime;
    
    var eTime = eventData[CONFIG.COLUMNS.END_TIME] !== undefined ? eventData[CONFIG.COLUMNS.END_TIME] : (eventData.end_time || eventData.endTime);
    if (eTime !== undefined) out[CONFIG.COLUMNS.END_TIME] = eTime;
    
    var venueVal = eventData[CONFIG.COLUMNS.VENUE] !== undefined ? eventData[CONFIG.COLUMNS.VENUE] : (eventData.venue || eventData.venueId);
    if (venueVal !== undefined) out[CONFIG.COLUMNS.VENUE] = venueVal;
    
    var coordId = eventData[CONFIG.COLUMNS.COORDINATOR_ID] !== undefined ? eventData[CONFIG.COLUMNS.COORDINATOR_ID] : (eventData.coordinator_id || eventData.coordinatorId);
    if (coordId !== undefined) out[CONFIG.COLUMNS.COORDINATOR_ID] = coordId;
    
    var depts = eventData[CONFIG.COLUMNS.DEPARTMENTS] !== undefined ? eventData[CONFIG.COLUMNS.DEPARTMENTS] : eventData.departments;
    if (depts !== undefined) out[CONFIG.COLUMNS.DEPARTMENTS] = depts;
    
    var yrs = eventData[CONFIG.COLUMNS.YEARS] !== undefined ? eventData[CONFIG.COLUMNS.YEARS] : eventData.years;
    if (yrs !== undefined) out[CONFIG.COLUMNS.YEARS] = yrs;
    
    var cap = eventData[CONFIG.COLUMNS.CAPACITY] !== undefined ? eventData[CONFIG.COLUMNS.CAPACITY] : eventData.capacity;
    if (cap !== undefined) out[CONFIG.COLUMNS.CAPACITY] = cap;
    
    var statusVal = eventData[CONFIG.COLUMNS.EVENT_STATUS] !== undefined ? eventData[CONFIG.COLUMNS.EVENT_STATUS] : (eventData[CONFIG.COLUMNS.STATUS] !== undefined ? eventData[CONFIG.COLUMNS.STATUS] : (eventData.status || eventData.event_status));
    if (statusVal !== undefined) out[CONFIG.COLUMNS.EVENT_STATUS] = statusVal;
    
    var createdBy = eventData[CONFIG.COLUMNS.CREATED_BY] !== undefined ? eventData[CONFIG.COLUMNS.CREATED_BY] : (eventData.created_by || eventData.createdBy);
    if (createdBy !== undefined) out[CONFIG.COLUMNS.CREATED_BY] = createdBy;
    
    var updatedBy = eventData[CONFIG.COLUMNS.UPDATED_BY] !== undefined ? eventData[CONFIG.COLUMNS.UPDATED_BY] : (eventData.updated_by || eventData.updatedBy);
    if (updatedBy !== undefined) out[CONFIG.COLUMNS.UPDATED_BY] = updatedBy;

    for (var k in eventData) {
      if (out[k] === undefined && eventData[k] !== undefined) {
        out[k] = eventData[k];
      }
    }
    return out;
  },

  createEvent: function(eventData) {
    try {
      eventData = this._normalizeEventPayload(eventData);

      const coordinatorId = eventData[CONFIG.COLUMNS.COORDINATOR_ID];
      const coordinator = coordinatorId ? UserService.getUserById(coordinatorId) : null;
      if (!coordinator || coordinator[CONFIG.COLUMNS.STATUS] !== CONFIG.USER_STATUS.ACTIVE || coordinator[CONFIG.COLUMNS.ROLE] !== CONFIG.ROLES.COORDINATOR) {
        return Utils.buildResponse(false, CONFIG.MESSAGES.INVALID_COORDINATOR);
      }

      // Map incoming sheet-style payload to what ValidationService.validateEvent expects.
      const validationPayload = this._getEventValidationPayload_(eventData);
      const validationResult = ValidationService.validateEvent(validationPayload);
      if (!validationResult.valid) {
        return Utils.buildResponse(false, (validationResult.errors || []).join(' '));
      }

      const eventName = Utils.capitalizeWords(Utils.trimText(eventData[CONFIG.COLUMNS.EVENT_NAME]));
      const venue = Utils.capitalizeWords(Utils.trimText(eventData[CONFIG.COLUMNS.VENUE]));

      // Normalize time for duplicate detection.
      const normalizedStartTime = this._normalizeEventTime_(eventData[CONFIG.COLUMNS.START_TIME]);

      if (this._isDuplicateEvent(eventName, eventData[CONFIG.COLUMNS.START_DATE], venue, normalizedStartTime)) {
        return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_ALREADY_EXISTS);
      }

      // Backward compat: method may not exist in this file; keep safe.
      if (typeof this._ensureAuditColumns === 'function') this._ensureAuditColumns();
      else {
        // TODO: _ensureAuditColumns is missing in EventService.js; audit fields will be set explicitly below.
      }

      const eventId = IdService.generateEventId();
      const nowIso = new Date().toISOString();

      const newEvent = {
        [CONFIG.COLUMNS.EVENT_ID]: eventId,
        [CONFIG.COLUMNS.EVENT_NAME]: eventName,
        [CONFIG.COLUMNS.DESCRIPTION]: eventData[CONFIG.COLUMNS.DESCRIPTION] ? Utils.trimText(eventData[CONFIG.COLUMNS.DESCRIPTION]) : '',
        [CONFIG.COLUMNS.START_DATE]: eventData[CONFIG.COLUMNS.START_DATE],
        [CONFIG.COLUMNS.END_DATE]: eventData[CONFIG.COLUMNS.END_DATE],
        [CONFIG.COLUMNS.START_TIME]: normalizedStartTime,
        [CONFIG.COLUMNS.END_TIME]: eventData[CONFIG.COLUMNS.END_TIME] ? this._normalizeEventTime_(eventData[CONFIG.COLUMNS.END_TIME]) : eventData[CONFIG.COLUMNS.END_TIME],
        [CONFIG.COLUMNS.VENUE]: venue,
        [CONFIG.COLUMNS.COORDINATOR_ID]: eventData[CONFIG.COLUMNS.COORDINATOR_ID],
        [CONFIG.COLUMNS.DEPARTMENTS]: eventData[CONFIG.COLUMNS.DEPARTMENTS],
        [CONFIG.COLUMNS.YEARS]: eventData[CONFIG.COLUMNS.YEARS],
        [CONFIG.COLUMNS.CAPACITY]: eventData[CONFIG.COLUMNS.CAPACITY],
        [CONFIG.COLUMNS.EVENT_STATUS]: eventData[CONFIG.COLUMNS.EVENT_STATUS] || eventData[CONFIG.COLUMNS.STATUS] || CONFIG.EVENT_STATUS.DRAFT,
        [CONFIG.COLUMNS.DELETION_FLAG]: false,
        [CONFIG.COLUMNS.CREATED_AT]: nowIso,
        [CONFIG.COLUMNS.CREATED_BY]: eventData[CONFIG.COLUMNS.CREATED_BY] || 'Unknown',
        [CONFIG.COLUMNS.UPDATED_AT]: nowIso,
        [CONFIG.COLUMNS.UPDATED_BY]: eventData[CONFIG.COLUMNS.CREATED_BY] || 'Unknown',
        [CONFIG.COLUMNS.LAST_ACTION]: 'Created',
        [CONFIG.COLUMNS.LAST_ACTION_AT]: nowIso,
        [CONFIG.COLUMNS.LAST_ACTION_BY]: eventData[CONFIG.COLUMNS.CREATED_BY] || 'Unknown'
      };

      for (var k in eventData) {
        if (newEvent[k] === undefined && eventData[k] !== undefined) {
          newEvent[k] = eventData[k];
        }
      }

      const success = DatabaseService.insertRow(CONFIG.SHEETS.EVENTS, newEvent);
      if (success) {
        this._invalidateCaches_();
        const resp = Utils.buildResponse(true, CONFIG.MESSAGES.EVENT_CREATED, { event: Utils.sanitizeEvent(newEvent) });
        try {
          AuditService.logAction(
            eventData[CONFIG.COLUMNS.CREATED_BY] || eventData[CONFIG.COLUMNS.COORDINATOR_ID],
            'EventService',
            'CREATE_EVENT',
            eventId,
            'Event',
            'Event created',
            '',
            'SUCCESS',
            eventData[CONFIG.COLUMNS.CREATED_BY] || eventData[CONFIG.COLUMNS.COORDINATOR_ID]
          );
        } catch (error) {
          Logger.log(error);
        }
        try {
          NotificationService.createNotification({
            user_id: newEvent[CONFIG.COLUMNS.COORDINATOR_ID] || newEvent[CONFIG.COLUMNS.CREATED_BY] || 'Unknown',
            title: 'Event Created',
            message: 'Event "' + eventName + '" created successfully.',
            type: 'Event'
          });
        } catch (error) {
          Logger.log(error);
        }
        return resp;
      }
      return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_CREATE_FAILED);
    } catch (error) {
      Logger.log("EventService.createEvent error: " + (error && error.message ? error.message : error));
      return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_CREATE_FAILED);
    }
  },

  updateEvent: function(eventId, eventData) {
    try {
      const eventsSheet = CONFIG.SHEETS.EVENTS;

      eventData = this._normalizeEventPayload(eventData);

      // Prefer cached record set (best-effort) to reduce reads.
      // Using getEventById avoids an extra readAllRows on update path when possible.
      const existingEvent = this.getEventById(eventId);
      if (!existingEvent) {
        return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
      }

      const updatedEvent = Object.assign({}, existingEvent, eventData);
      updatedEvent[CONFIG.COLUMNS.UPDATED_AT] = new Date().toISOString();

      // Ensure status is written to the correct physical sheet column
      if (eventData[CONFIG.COLUMNS.STATUS] !== undefined) {
        updatedEvent[CONFIG.COLUMNS.EVENT_STATUS] = eventData[CONFIG.COLUMNS.STATUS];
      }
      if (eventData[CONFIG.COLUMNS.EVENT_STATUS] !== undefined) {
        updatedEvent[CONFIG.COLUMNS.EVENT_STATUS] = eventData[CONFIG.COLUMNS.EVENT_STATUS];
      }

      var updatedByKey = CONFIG.COLUMNS && CONFIG.COLUMNS.UPDATED_BY ? CONFIG.COLUMNS.UPDATED_BY : null;
      if (updatedByKey) {
        updatedEvent[updatedByKey] = eventData[updatedByKey] || updatedEvent[updatedByKey] || 'Unknown';
      }


      // Normalize names/venue/time (null-safe)
      if (updatedEvent[CONFIG.COLUMNS.EVENT_NAME]) {
        updatedEvent[CONFIG.COLUMNS.EVENT_NAME] = Utils.capitalizeWords(Utils.trimText(updatedEvent[CONFIG.COLUMNS.EVENT_NAME]));
      }
      if (updatedEvent[CONFIG.COLUMNS.VENUE]) {
        updatedEvent[CONFIG.COLUMNS.VENUE] = Utils.capitalizeWords(Utils.trimText(updatedEvent[CONFIG.COLUMNS.VENUE]));
      }
      if (updatedEvent[CONFIG.COLUMNS.START_TIME] !== undefined) {
        updatedEvent[CONFIG.COLUMNS.START_TIME] = this._normalizeEventTime_(updatedEvent[CONFIG.COLUMNS.START_TIME]);
      }
      if (updatedEvent[CONFIG.COLUMNS.END_TIME] !== undefined) {
        updatedEvent[CONFIG.COLUMNS.END_TIME] = this._normalizeEventTime_(updatedEvent[CONFIG.COLUMNS.END_TIME]);
      }

      // Validation payload mapping
      const validationPayload = this._getEventValidationPayload_(updatedEvent);
      const validationResult = ValidationService.validateEvent(validationPayload);
      if (!validationResult.valid) {
        return Utils.buildResponse(false, (validationResult.errors || []).join(' '));
      }

      // Duplicate detection only if fields impacting dedup changed (best-effort)
      var nameChanged = (updatedEvent[CONFIG.COLUMNS.EVENT_NAME] && updatedEvent[CONFIG.COLUMNS.EVENT_NAME] !== existingEvent[CONFIG.COLUMNS.EVENT_NAME]);
      var dateChanged = (updatedEvent[CONFIG.COLUMNS.START_DATE] && Utils.formatDate(updatedEvent[CONFIG.COLUMNS.START_DATE]) !== Utils.formatDate(existingEvent[CONFIG.COLUMNS.START_DATE]));
      var venueChanged = (updatedEvent[CONFIG.COLUMNS.VENUE] && updatedEvent[CONFIG.COLUMNS.VENUE] !== existingEvent[CONFIG.COLUMNS.VENUE]);
      var timeChanged = (updatedEvent[CONFIG.COLUMNS.START_TIME] && updatedEvent[CONFIG.COLUMNS.START_TIME] !== existingEvent[CONFIG.COLUMNS.START_TIME]);

      if (nameChanged || dateChanged || venueChanged || timeChanged) {
        if (this._isDuplicateEvent(updatedEvent[CONFIG.COLUMNS.EVENT_NAME], updatedEvent[CONFIG.COLUMNS.START_DATE], updatedEvent[CONFIG.COLUMNS.VENUE], updatedEvent[CONFIG.COLUMNS.START_TIME], eventId)) {
          return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_ALREADY_EXISTS);
        }
      }

      const success = DatabaseService.updateRow(eventsSheet, CONFIG.COLUMNS.EVENT_ID, eventId, updatedEvent);
      if (success) {
        this._invalidateCaches_();
        const resp = Utils.buildResponse(true, CONFIG.MESSAGES.EVENT_UPDATED, { event: Utils.sanitizeEvent(updatedEvent) });
        try {
          AuditService.logAction(
            updatedEvent[CONFIG.COLUMNS.UPDATED_BY] || 'Unknown',
            'EventService',
            'UPDATE_EVENT',
            eventId,
            'Event',
            'Event updated',
            '',
            'SUCCESS',
            updatedEvent[CONFIG.COLUMNS.UPDATED_BY] || 'Unknown'
          );
        } catch (error) {
          Logger.log(error);
        }
        try {
          NotificationService.createNotification({
            user_id: updatedEvent[CONFIG.COLUMNS.COORDINATOR_ID] || updatedEvent[CONFIG.COLUMNS.UPDATED_BY] || 'Unknown',
            title: 'Event Updated',
            message: 'Event "' + (updatedEvent[CONFIG.COLUMNS.EVENT_NAME] || '') + '" updated successfully.',
            type: 'Event',
            related_event_id: eventId
          });
        } catch (error) {
          Logger.log(error);
        }
        return resp;
      }
      return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_UPDATE_FAILED);
    } catch (error) {
      Logger.log("EventService.updateEvent error: " + (error && error.message ? error.message : error));
      return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_UPDATE_FAILED);
    }
  },

  deleteEvent: function(eventId, updatedBy) {
    try {
      const eventsSheet = CONFIG.SHEETS.EVENTS;
      if (!DatabaseService.exists(eventsSheet, CONFIG.COLUMNS.EVENT_ID, eventId)) {
        return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
      }

      const headers = DatabaseService.getHeaderRow(eventsSheet);
      const hasDeletionFlagCol = headers.indexOf(CONFIG.COLUMNS.DELETION_FLAG) !== -1;

      if (!hasDeletionFlagCol) {
        // Fallback to hard delete if spreadsheet schema does not support soft deletes
        DatabaseService.hardDelete(eventsSheet, CONFIG.COLUMNS.EVENT_ID, eventId);
        this._invalidateCaches_();
        try {
          AuditService.logAction(
            updatedBy || 'Unknown',
            'EventService',
            'DELETE_EVENT',
            eventId,
            'Event',
            'Event hard deleted (schema fallback)',
            '',
            'SUCCESS',
            updatedBy || 'Unknown'
          );
        } catch (error) {
          Logger.log(error);
        }
        return Utils.buildResponse(true, CONFIG.MESSAGES.EVENT_DELETED);
      }

      var nowIso = new Date().toISOString();
      // Soft delete and update status.
      const updateData = {
        [CONFIG.COLUMNS.DELETION_FLAG]: true,
        [CONFIG.COLUMNS.STATUS]: CONFIG.EVENT_STATUS.CANCELLED,
        [CONFIG.COLUMNS.UPDATED_BY]: updatedBy || 'Unknown',
        [CONFIG.COLUMNS.UPDATED_AT]: nowIso,
        [CONFIG.COLUMNS.LAST_ACTION]: 'Deleted',
        [CONFIG.COLUMNS.LAST_ACTION_BY]: updatedBy || 'Unknown',
        [CONFIG.COLUMNS.LAST_ACTION_AT]: nowIso
      };

      const success = DatabaseService.updateRow(eventsSheet, CONFIG.COLUMNS.EVENT_ID, eventId, updateData);
      if (success) {
        this._invalidateCaches_();
        const resp = Utils.buildResponse(true, CONFIG.MESSAGES.EVENT_DELETED);
        try {
          AuditService.logAction(
            updatedBy || 'Unknown',
            'EventService',
            'DELETE_EVENT',
            eventId,
            'Event',
            'Event deleted',
            '',
            'SUCCESS',
            updatedBy || 'Unknown'
          );
        } catch (error) {
          Logger.log(error);
        }
        try {
          NotificationService.createNotification({
            user_id: updatedBy || 'Unknown',
            title: 'Event Deleted',
            message: 'Event "' + eventId + '" was deleted.',
            type: 'Event',
            related_event_id: eventId
          });
        } catch (error) {
          Logger.log(error);
        }
        return resp;
      }
      return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_DELETE_FAILED);
    } catch (error) {
      Logger.log("EventService.deleteEvent error: " + (error && error.message ? error.message : error));
      return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_DELETE_FAILED);
    }
  },

  getEventById: function(eventId) {
    try {
      const records = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, CONFIG.COLUMNS.EVENT_ID, eventId) || [];
      if (records.length > 0 && !this._safeDeletionFlag_(records[0])) {
        return Utils.sanitizeEvent(this._evaluateEventStatus_(records[0]));
      }
      return null;
    } catch (error) {
      Logger.log("EventService.getEventById error: " + (error && error.message ? error.message : error));
      return null;
    }
  },

   getAllEvents: function() {
    try {
      // Reuse cached evaluation + sanitization (best-effort)
      return this._getAllActiveSanitizedEvents_();
    } catch (error) {
      Logger.log("EventService.getAllEvents error: " + (error && error.message ? error.message : error));
      return [];
    }
  },

  searchEvents: function(keyword) {
    try {
      if (Utils.checkEmptyValue(keyword)) return [];
      var kw = String(keyword).toLowerCase();

      // Reuse cached loaded records.
      const evaluated = this._getAllActiveSanitizedEvents_();

      return (evaluated || []).filter(function(event) {
        var idVal = event && event[CONFIG.COLUMNS.EVENT_ID];
        var nameVal = event && event[CONFIG.COLUMNS.EVENT_NAME];
        var venueVal = event && event[CONFIG.COLUMNS.VENUE];

        var idStr = idVal !== undefined && idVal !== null ? String(idVal).toLowerCase() : '';
        var nameStr = nameVal !== undefined && nameVal !== null ? String(nameVal).toLowerCase() : '';
        var venueStr = venueVal !== undefined && venueVal !== null ? String(venueVal).toLowerCase() : '';

        return idStr.indexOf(kw) !== -1 || nameStr.indexOf(kw) !== -1 || venueStr.indexOf(kw) !== -1;
      });
    } catch (error) {
      Logger.log("EventService.searchEvents error: " + (error && error.message ? error.message : error));
      return [];
    }
  },

  getEventsByCoordinator: function(coordinatorId) {
    try {
      if (!coordinatorId) return [];
      const records = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, CONFIG.COLUMNS.COORDINATOR_ID, coordinatorId);
      const filtered = records.filter(e => !e[CONFIG.COLUMNS.DELETION_FLAG]);
      return filtered.map(e => Utils.sanitizeEvent(this._evaluateEventStatus_(e)));
    } catch (error) {
      Logger.log("EventService.getEventsByCoordinator error: " + error.message);
      return [];
    }
  },

  getEventsByStatus: function(status) {
    try {
      if (!status) return [];
      const records = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, CONFIG.COLUMNS.EVENT_STATUS, status);
      const filtered = records.filter(e => !e[CONFIG.COLUMNS.DELETION_FLAG]);
      return filtered.map(e => Utils.sanitizeEvent(this._evaluateEventStatus_(e))).filter(e => e[CONFIG.COLUMNS.STATUS] === status);
    } catch (error) {
      Logger.log("EventService.getEventsByStatus error: " + error.message);
      return [];
    }
  },

  getEventsByDate: function(date) {
    try {
      if (!date) return [];
      const targetDate = Utils.formatDate(date);
      const allEvents = DatabaseService.readAllRows(CONFIG.SHEETS.EVENTS) || [];
      const filtered = allEvents.filter(e => !e[CONFIG.COLUMNS.DELETION_FLAG]);
      return filtered.map(e => this._evaluateEventStatus_(e))
        .filter(event => Utils.formatDate(event[CONFIG.COLUMNS.START_DATE]) === targetDate)
        .map(e => Utils.sanitizeEvent(e));
    } catch (error) {
      Logger.log("EventService.getEventsByDate error: " + error.message);
      return [];
    }
  },

  filterEvents: function(filters) {
    try {
      let results = this.getAllEvents();
      if (filters[CONFIG.COLUMNS.STATUS]) {
        results = results.filter(e => e[CONFIG.COLUMNS.STATUS] === filters[CONFIG.COLUMNS.STATUS]);
      }
      if (filters[CONFIG.COLUMNS.COORDINATOR_ID]) {
        results = results.filter(e => e[CONFIG.COLUMNS.COORDINATOR_ID] === filters[CONFIG.COLUMNS.COORDINATOR_ID]);
      }
      if (filters[CONFIG.COLUMNS.DEPARTMENTS]) {
        results = results.filter(e => e[CONFIG.COLUMNS.DEPARTMENTS] && e[CONFIG.COLUMNS.DEPARTMENTS].includes(filters[CONFIG.COLUMNS.DEPARTMENTS]));
      }
      if (filters[CONFIG.COLUMNS.YEARS]) {
        results = results.filter(e => e[CONFIG.COLUMNS.YEARS] && e[CONFIG.COLUMNS.YEARS].includes(filters[CONFIG.COLUMNS.YEARS]));
      }
      if (filters[CONFIG.COLUMNS.VENUE]) {
        results = results.filter(e => e[CONFIG.COLUMNS.VENUE] === filters[CONFIG.COLUMNS.VENUE]);
      }
      if (filters[CONFIG.COLUMNS.START_DATE]) {
        results = results.filter(e => Utils.formatDate(e[CONFIG.COLUMNS.START_DATE]) === Utils.formatDate(filters[CONFIG.COLUMNS.START_DATE]));
      }
      if (filters[CONFIG.COLUMNS.END_DATE]) {
        results = results.filter(e => Utils.formatDate(e[CONFIG.COLUMNS.END_DATE]) === Utils.formatDate(filters[CONFIG.COLUMNS.END_DATE]));
      }
      return results;
    } catch (error) {
      Logger.log("EventService.filterEvents error: " + error.message);
      return [];
    }
  },

  sortEvents: function(sortBy, order) {
    try {
      const allowedFields = [
        CONFIG.COLUMNS.EVENT_NAME,
        CONFIG.COLUMNS.START_DATE,
        CONFIG.COLUMNS.END_DATE,
        CONFIG.COLUMNS.CREATED_AT,
        CONFIG.COLUMNS.UPDATED_AT,
        CONFIG.COLUMNS.STATUS
      ];
      if (!allowedFields.includes(sortBy)) {
        return [];
      }
      const records = this.getAllEvents();
      const sorted = records.sort((a, b) => {
        const valA = a[sortBy] || '';
        const valB = b[sortBy] || '';
        if (order === 'desc') {
          return valA < valB ? 1 : -1;
        }
        return valA > valB ? 1 : -1;
      });
      return sorted;
    } catch (error) {
      Logger.log("EventService.sortEvents error: " + error.message);
      return [];
    }
  },

  paginateEvents: function(page, pageSize) {
    try {
      if (page < 1 || pageSize <= 0) {
        return { totalRecords: 0, currentPage: 1, totalPages: 0, items: [] };
      }
      const records = this.getAllEvents();
      const totalRecords = records.length;
      const totalPages = Math.ceil(totalRecords / pageSize);
      const startIndex = (page - 1) * pageSize;
      const items = records.slice(startIndex, startIndex + pageSize);
      return {
        totalRecords: totalRecords,
        currentPage: page,
        totalPages: totalPages,
        items: items
      };
    } catch (error) {
      Logger.log("EventService.paginateEvents error: " + error.message);
      return { totalRecords: 0, currentPage: page, totalPages: 0, items: [] };
    }
  }
};
