/**
 * Service for handling event management.
 * Responsibilities: CRUD operations for events, status updates, and searching.
 * 
 * ==============================================================
 * ATTENDANCE MODULE COMPATIBILITY RULES
 * ==============================================================
 * The future Attendance Module must strictly obey the Event Status:
 * - Draft      -> Attendance Disabled
 * - Upcoming   -> Attendance Disabled
 * - Active     -> Attendance Enabled
 * - Stopped    -> Attendance Disabled (Display stopped_reason)
 * - Completed  -> Attendance Disabled
 * - Cancelled  -> Attendance Disabled
 * ==============================================================
 */
const EventService = {

  /**
   * Checks if an event with the same name and date already exists.
   * @param {string} eventName 
   * @param {string} eventDate 
   * @param {string} [excludeEventId] - Event ID to ignore during check.
   * @returns {boolean} True if a duplicate exists.
   */
  _isDuplicateEvent: function(eventName, eventStartDate, excludeEventId) {
    const allEvents = DatabaseService.readAllRows(CONFIG.SHEETS.EVENTS);
    if (!allEvents || allEvents.length === 0) return false;
    
    const normalizedName = eventName ? Utils.trimText(eventName).toLowerCase() : '';
    const normalizedDate = eventStartDate ? Utils.formatDate(eventStartDate) : '';

    return allEvents.some(event => {
      if (excludeEventId && event.event_id === excludeEventId) {
        return false;
      }
      const eName = event.event_name ? Utils.trimText(event.event_name).toLowerCase() : '';
      const eDate = event.start_date ? Utils.formatDate(event.start_date) : '';
      return (eName === normalizedName && eDate === normalizedDate);
    });
  },

  /**
   * Creates a new event.
   * @param {object} eventData 
   * @returns {object} Standard response object.
   */
  createEvent: function(eventData) {
    if (!DatabaseService.exists(CONFIG.SHEETS.USERS, 'user_id', eventData.coordinator_id)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.INVALID_COORDINATOR);
    }

    const validationResult = ValidationService.validateEvent(eventData);
    if (!validationResult.valid) {
      return Utils.buildResponse(false, validationResult.errors.join(' '));
    }

    const eventName = Utils.capitalizeWords(Utils.trimText(eventData.event_name));
    const venue = Utils.capitalizeWords(Utils.trimText(eventData.venue));

    if (this._isDuplicateEvent(eventName, eventData.start_date)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_ALREADY_EXISTS);
    }

    this._ensureAuditColumns();
    const eventId = IdService.generateEventId();

    const newEvent = {
      event_id: eventId,
      event_name: eventName,
      description: eventData.description ? Utils.trimText(eventData.description) : '',
      start_date: eventData.start_date,
      end_date: eventData.end_date,
      start_time: eventData.start_time,
      end_time: eventData.end_time,
      venue: venue,
      coordinator_id: eventData.coordinator_id,
      departments: eventData.departments,
      years: eventData.years,
      capacity: eventData.capacity,
      status: eventData.status || CONFIG.EVENT_STATUS.DRAFT,
      created_at: new Date().toISOString(),
      created_by: eventData.created_by || 'Unknown',
      last_action: 'Created',
      last_action_at: new Date().toISOString(),
      last_action_by: eventData.created_by || 'Unknown'
    };

    const success = DatabaseService.insertRow(CONFIG.SHEETS.EVENTS, newEvent);
    if (success) {
      return Utils.buildResponse(true, CONFIG.MESSAGES.EVENT_CREATED, { event: newEvent });
    }
    return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_CREATE_FAILED);
  },

  /**
   * Updates an existing event.
   * @param {string} eventId 
   * @param {object} eventData 
   * @returns {object} Standard response object.
   */
  updateEvent: function(eventId, eventData) {
    Logger.log("BACKEND: EventService.updateEvent started for " + eventId);
    const eventsSheet = CONFIG.SHEETS.EVENTS;
    
    if (!DatabaseService.exists(eventsSheet, 'event_id', eventId)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
    }

    if (eventData.coordinator_id && !DatabaseService.exists(CONFIG.SHEETS.USERS, 'user_id', eventData.coordinator_id)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.INVALID_COORDINATOR);
    }

    const existingRecords = DatabaseService.findByColumn(eventsSheet, 'event_id', eventId);
    const existingEvent = existingRecords[0];

    // --- Lifecycle State Machine Interception ---
    const oldStatus = existingEvent.status || CONFIG.EVENT_STATUS.DRAFT;
    const newStatus = eventData.status || oldStatus;
    const actionBy = eventData.action_by || 'Unknown';
    const nowIso = new Date().toISOString();

    if (oldStatus !== newStatus) {
      this._ensureAuditColumns(); // Ensure DB is ready

      // Prevent modifications if event is Locked (Completed or Cancelled)
      if (oldStatus === CONFIG.EVENT_STATUS.COMPLETED || oldStatus === CONFIG.EVENT_STATUS.CANCELLED) {
         return Utils.buildResponse(false, 'Cannot update a locked event (Completed or Cancelled).');
      }

      let validTransition = false;
      let lastActionStr = '';

      if (oldStatus === CONFIG.EVENT_STATUS.DRAFT && newStatus === CONFIG.EVENT_STATUS.UPCOMING) {
        validTransition = true;
        lastActionStr = 'Published';
        eventData.published_at = nowIso;
        eventData.published_by = actionBy;
      } else if (oldStatus === CONFIG.EVENT_STATUS.UPCOMING && newStatus === CONFIG.EVENT_STATUS.ACTIVE) {
        validTransition = true;
        lastActionStr = 'Started';
        eventData.started_at = nowIso;
        eventData.started_by = actionBy;
      } else if (oldStatus === CONFIG.EVENT_STATUS.UPCOMING && newStatus === CONFIG.EVENT_STATUS.CANCELLED) {
        validTransition = true;
        lastActionStr = 'Cancelled';
        eventData.cancelled_at = nowIso;
        eventData.cancelled_by = actionBy;
        eventData.cancel_reason = eventData.cancel_reason || '';
      } else if (oldStatus === CONFIG.EVENT_STATUS.ACTIVE && newStatus === CONFIG.EVENT_STATUS.STOPPED) {
        validTransition = true;
        lastActionStr = 'Stopped';
        eventData.stopped_at = nowIso;
        eventData.stopped_by = actionBy;
        eventData.stopped_reason = eventData.stop_reason || '';
      } else if (oldStatus === CONFIG.EVENT_STATUS.ACTIVE && newStatus === CONFIG.EVENT_STATUS.COMPLETED) {
        validTransition = true;
        lastActionStr = 'Completed';
        eventData.completed_at = nowIso;
        eventData.completed_by = actionBy;
      } else if (oldStatus === CONFIG.EVENT_STATUS.STOPPED && newStatus === CONFIG.EVENT_STATUS.ACTIVE) {
        validTransition = true;
        lastActionStr = 'Resumed';
        eventData.resumed_at = nowIso;
        eventData.resumed_by = actionBy;
        eventData.resume_reason = eventData.resume_reason || '';
      } else if (oldStatus === CONFIG.EVENT_STATUS.STOPPED && newStatus === CONFIG.EVENT_STATUS.CANCELLED) {
        validTransition = true;
        lastActionStr = 'Cancelled';
        eventData.cancelled_at = nowIso;
        eventData.cancelled_by = actionBy;
        eventData.cancel_reason = eventData.cancel_reason || '';
      }

      if (!validTransition) {
        return Utils.buildResponse(false, `Invalid status transition from ${oldStatus} to ${newStatus}.`);
      }

      eventData.last_action = lastActionStr;
      eventData.last_action_at = nowIso;
      eventData.last_action_by = actionBy;
    }
    
    // Clean up temporary variables from frontend before save
    delete eventData.action_by;
    delete eventData.stop_reason; // it was mapped to stopped_reason
    // resume_reason and cancel_reason map 1:1 so they can stay.

    const updatedEvent = Object.assign({}, existingEvent, eventData);

    const validationResult = ValidationService.validateEvent(updatedEvent);
    if (!validationResult.valid) {
      return Utils.buildResponse(false, validationResult.errors.join(' '));
    }

    if (updatedEvent.event_name) {
      updatedEvent.event_name = Utils.capitalizeWords(Utils.trimText(updatedEvent.event_name));
    }
    if (updatedEvent.venue) {
      updatedEvent.venue = Utils.capitalizeWords(Utils.trimText(updatedEvent.venue));
    }

    if (
      (updatedEvent.event_name && updatedEvent.event_name !== existingEvent.event_name) ||
      (updatedEvent.start_date && Utils.formatDate(updatedEvent.start_date) !== Utils.formatDate(existingEvent.start_date))
    ) {
      if (this._isDuplicateEvent(updatedEvent.event_name, updatedEvent.start_date, eventId)) {
        return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_ALREADY_EXISTS);
      }
    }

    const success = DatabaseService.updateRow(eventsSheet, 'event_id', eventId, updatedEvent);
    if (success) {
      Logger.log("BACKEND: EventService.updateEvent SUCCESS for " + eventId);
      return Utils.buildResponse(true, CONFIG.MESSAGES.EVENT_UPDATED, { event: updatedEvent });
    }
    Logger.log("BACKEND: EventService.updateEvent FAILED for " + eventId);
    return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_UPDATE_FAILED);
  },

  /**
   * Deletes an event.
   * @param {string} eventId 
   * @returns {object} Standard response object.
   */
  deleteEvent: function(eventId) {
    const eventsSheet = CONFIG.SHEETS.EVENTS;
    
    if (!DatabaseService.exists(eventsSheet, 'event_id', eventId)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
    }

    const success = DatabaseService.deleteRow(eventsSheet, 'event_id', eventId);
    if (success) {
      return Utils.buildResponse(true, CONFIG.MESSAGES.EVENT_DELETED);
    }
    return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_DELETE_FAILED);
  },

  _evaluateEventStatus: function(event) {
    if (!event) return event;

    const now = new Date();
    const nowMs = now.getTime();
    let updated = false;
    let newStatus = event.status;

    // Helper to parse date/time safely
    const parseDateTime = (dStr, tStr) => {
      if (!dStr) return 0;
      const dParts = dStr.split('-');
      let dt = new Date(parseInt(dParts[0], 10), parseInt(dParts[1], 10) - 1, parseInt(dParts[2], 10));
      if (tStr) {
        const parts = tStr.split(':');
        if (parts.length >= 2) {
          dt.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
        }
      }
      return dt.getTime();
    };

    if (event.status === CONFIG.EVENT_STATUS.UPCOMING) {
      const startMs = parseDateTime(event.start_date, event.start_time);
      if (startMs > 0 && nowMs >= startMs) {
        newStatus = CONFIG.EVENT_STATUS.ACTIVE;
        event.status = newStatus;
        event.started_at = now.toISOString();
        event.started_by = 'System';
        event.last_action = 'Started';
        event.last_action_at = now.toISOString();
        event.last_action_by = 'System';
        updated = true;
      }
    }

    if (event.status === CONFIG.EVENT_STATUS.ACTIVE) {
      const endMs = parseDateTime(event.end_date, event.end_time);
      // Auto complete if end time has passed
      if (endMs > 0 && nowMs >= endMs) {
        newStatus = CONFIG.EVENT_STATUS.COMPLETED;
        event.status = newStatus;
        event.completed_at = now.toISOString();
        event.completed_by = 'System';
        event.last_action = 'Completed';
        event.last_action_at = now.toISOString();
        event.last_action_by = 'System';
        updated = true;
      }
    }

    if (updated) {
      this._ensureAuditColumns();
      DatabaseService.updateRow(CONFIG.SHEETS.EVENTS, 'event_id', event.event_id, event);
    }
    
    return event;
  },

  /**
   * Gets an event by ID.
   * @param {string} eventId 
   * @returns {object|null} The event object or null.
   */
  getEventById: function(eventId) {
    Logger.log("BACKEND: EventService.getEventById retrieving " + eventId);
    const records = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, 'event_id', eventId);
    if (records.length > 0) {
      return this._evaluateEventStatus(records[0]);
    }
    return null;
  },

  /**
   * Gets all events.
   * @returns {object[]} Array of all event objects.
   */
  getAllEvents: function() {
    try {
      const events = DatabaseService.readAllRows(CONFIG.SHEETS.EVENTS) || [];
      const evaluatedEvents = events.map(e => this._evaluateEventStatus(e));
      Logger.log("EventService.getAllEvents() database rows: " + evaluatedEvents.length);
      if (evaluatedEvents.length > 0) {
        Logger.log(JSON.stringify(evaluatedEvents[0]));
      }
      return evaluatedEvents;
    } catch (e) {
      Logger.log("Error in EventService.getAllEvents: " + e.message);
      return [];
    }
  },

  /**
   * Searches events by keyword (Event ID, Event Name, Venue).
   * @param {string} keyword 
   * @returns {object[]} Array of matching event objects.
   */
  searchEvents: function(keyword) {
    if (Utils.checkEmptyValue(keyword)) return [];
    
    const records = DatabaseService.readAllRows(CONFIG.SHEETS.EVENTS);
    const lowerKeyword = keyword.toLowerCase();
    
    const evaluated = records.map(e => this._evaluateEventStatus(e));
    return evaluated.filter(event => {
      return (event.event_id && event.event_id.toLowerCase().includes(lowerKeyword)) ||
             (event.event_name && event.event_name.toLowerCase().includes(lowerKeyword)) ||
             (event.venue && event.venue.toLowerCase().includes(lowerKeyword));
    });
  },

  /**
   * Gets events by Coordinator ID.
   * @param {string} coordinatorId 
   * @returns {object[]} Array of event objects.
   */
  getEventsByCoordinator: function(coordinatorId) {
    if (!coordinatorId) return [];
    const records = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, 'coordinator_id', coordinatorId);
    return records.map(e => this._evaluateEventStatus(e));
  },

  /**
   * Gets events by Status.
   * @param {string} status 
   * @returns {object[]} Array of event objects.
   */
  getEventsByStatus: function(status) {
    if (!status) return [];
    const records = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, 'status', status);
    return records.map(e => this._evaluateEventStatus(e)).filter(e => e.status === status);
  },

  /**
   * Gets events by Date.
   * @param {string} date 
   * @returns {object[]} Array of event objects.
   */
  getEventsByDate: function(date) {
    if (!date) return [];
    const targetDate = Utils.formatDate(date);
    const allEvents = DatabaseService.readAllRows(CONFIG.SHEETS.EVENTS);
    return allEvents.map(e => this._evaluateEventStatus(e)).filter(event => Utils.formatDate(event.start_date) === targetDate);
  },

  _ensureAuditColumns: function() {
    try {
      const sheet = DatabaseService.getSheet(CONFIG.SHEETS.EVENTS);
      const lastCol = sheet.getLastColumn();
      let headers = [];
      if (lastCol > 0) {
        headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      }
      const required = [
        'created_at', 'created_by', 'published_at', 'published_by',
        'started_at', 'started_by', 'stopped_at', 'stopped_by', 'stopped_reason',
        'resumed_at', 'resumed_by', 'resume_reason', 'completed_at', 'completed_by',
        'cancelled_at', 'cancelled_by', 'cancel_reason', 'last_action', 'last_action_at', 'last_action_by'
      ];
      let added = 0;
      required.forEach(col => {
        if (!headers.includes(col)) {
          sheet.getRange(1, lastCol + 1 + added).setValue(col);
          added++;
        }
      });
    } catch(e) {
      Logger.log("Could not ensure audit columns: " + e.message);
    }
  },

  publishEvent: function(eventId, userId) {
    this._ensureAuditColumns();
    const event = this.getEventById(eventId);
    if (!event) return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
    if (event.status !== CONFIG.EVENT_STATUS.DRAFT) {
      return Utils.buildResponse(false, 'Only Draft events can be published.');
    }
    const updateData = {
      status: CONFIG.EVENT_STATUS.UPCOMING,
      published_at: new Date().toISOString(),
      published_by: userId,
      last_action: 'Published',
      last_action_at: new Date().toISOString(),
      last_action_by: userId
    };
    const success = DatabaseService.updateRow(CONFIG.SHEETS.EVENTS, 'event_id', eventId, updateData);
    return success ? Utils.buildResponse(true, 'Event published successfully.') : Utils.buildResponse(false, 'Failed to publish event.');
  },

  startEvent: function(eventId, userId) {
    this._ensureAuditColumns();
    const event = this.getEventById(eventId);
    if (!event) return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
    if (event.status !== CONFIG.EVENT_STATUS.UPCOMING) {
      return Utils.buildResponse(false, 'Only Upcoming events can be started.');
    }
    const updateData = {
      status: CONFIG.EVENT_STATUS.ACTIVE,
      started_at: new Date().toISOString(),
      started_by: userId,
      last_action: 'Started',
      last_action_at: new Date().toISOString(),
      last_action_by: userId
    };
    const success = DatabaseService.updateRow(CONFIG.SHEETS.EVENTS, 'event_id', eventId, updateData);
    return success ? Utils.buildResponse(true, 'Event started successfully.') : Utils.buildResponse(false, 'Failed to start event.');
  },

  stopEvent: function(eventId, reason, userId) {
    this._ensureAuditColumns();
    if (!reason || reason.trim().length < 10) return Utils.buildResponse(false, 'Reason must be at least 10 characters.');
    if (reason.trim().length > 500) return Utils.buildResponse(false, 'Reason must not exceed 500 characters.');
    const event = this.getEventById(eventId);
    if (!event) return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
    if (event.status !== CONFIG.EVENT_STATUS.UPCOMING && event.status !== CONFIG.EVENT_STATUS.ACTIVE) {
      return Utils.buildResponse(false, 'Only Upcoming or Active events can be stopped.');
    }
    const updateData = {
      status: CONFIG.EVENT_STATUS.STOPPED,
      stopped_reason: reason.trim(),
      stopped_at: new Date().toISOString(),
      stopped_by: userId,
      last_action: 'Stopped',
      last_action_at: new Date().toISOString(),
      last_action_by: userId
    };
    const success = DatabaseService.updateRow(CONFIG.SHEETS.EVENTS, 'event_id', eventId, updateData);
    return success ? Utils.buildResponse(true, 'Event stopped successfully.') : Utils.buildResponse(false, 'Failed to stop event.');
  },

  resumeEvent: function(eventId, reason, userId) {
    this._ensureAuditColumns();
    if (reason && reason.trim().length > 500) return Utils.buildResponse(false, 'Reason must not exceed 500 characters.');
    const event = this.getEventById(eventId);
    if (!event) return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
    if (event.status !== CONFIG.EVENT_STATUS.STOPPED) {
      return Utils.buildResponse(false, 'Only Stopped events can be resumed.');
    }
    const updateData = {
      status: CONFIG.EVENT_STATUS.ACTIVE,
      resume_reason: reason ? reason.trim() : '',
      resumed_at: new Date().toISOString(),
      resumed_by: userId,
      last_action: 'Resumed',
      last_action_at: new Date().toISOString(),
      last_action_by: userId
    };
    const success = DatabaseService.updateRow(CONFIG.SHEETS.EVENTS, 'event_id', eventId, updateData);
    return success ? Utils.buildResponse(true, 'Event resumed successfully.') : Utils.buildResponse(false, 'Failed to resume event.');
  },

  completeEvent: function(eventId, userId) {
    this._ensureAuditColumns();
    const event = this.getEventById(eventId);
    if (!event) return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
    if (event.status !== CONFIG.EVENT_STATUS.ACTIVE) {
      return Utils.buildResponse(false, 'Only Active events can be completed.');
    }
    const updateData = {
      status: CONFIG.EVENT_STATUS.COMPLETED,
      completed_at: new Date().toISOString(),
      completed_by: userId,
      last_action: 'Completed',
      last_action_at: new Date().toISOString(),
      last_action_by: userId
    };
    const success = DatabaseService.updateRow(CONFIG.SHEETS.EVENTS, 'event_id', eventId, updateData);
    return success ? Utils.buildResponse(true, 'Event completed successfully.') : Utils.buildResponse(false, 'Failed to complete event.');
  },

  cancelEvent: function(eventId, reason, userId) {
    this._ensureAuditColumns();
    if (!reason || reason.trim().length < 10) return Utils.buildResponse(false, 'Reason must be at least 10 characters.');
    if (reason.trim().length > 500) return Utils.buildResponse(false, 'Reason must not exceed 500 characters.');
    const event = this.getEventById(eventId);
    if (!event) return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
    if (event.status === CONFIG.EVENT_STATUS.COMPLETED || event.status === CONFIG.EVENT_STATUS.CANCELLED) {
      return Utils.buildResponse(false, 'Event is already ' + event.status + '.');
    }
    const updateData = {
      status: CONFIG.EVENT_STATUS.CANCELLED,
      cancel_reason: reason.trim(),
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
      last_action: 'Cancelled',
      last_action_at: new Date().toISOString(),
      last_action_by: userId
    };
    const success = DatabaseService.updateRow(CONFIG.SHEETS.EVENTS, 'event_id', eventId, updateData);
    return success ? Utils.buildResponse(true, 'Event cancelled successfully.') : Utils.buildResponse(false, 'Failed to cancel event.');
  }

};
