/**
 * Service for handling event management.
 * Responsibilities: CRUD operations for events, status updates, and searching.
 */
const EventService = {

  /**
   * Checks if an event with the same name and date already exists.
   * @param {string} eventName 
   * @param {string} eventDate 
   * @param {string} [excludeEventId] - Event ID to ignore during check.
   * @returns {boolean} True if a duplicate exists.
   */
  _isDuplicateEvent: function(eventName, eventDate, excludeEventId) {
    const allEvents = DatabaseService.readAllRows(CONFIG.SHEETS.EVENTS);
    if (!allEvents || allEvents.length === 0) return false;
    
    const normalizedName = eventName ? Utils.trimText(eventName).toLowerCase() : '';
    const normalizedDate = eventDate ? Utils.formatDate(eventDate) : '';

    return allEvents.some(event => {
      if (excludeEventId && event.event_id === excludeEventId) {
        return false;
      }
      const eName = event.event_name ? Utils.trimText(event.event_name).toLowerCase() : '';
      const eDate = event.event_date ? Utils.formatDate(event.event_date) : '';
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

    if (this._isDuplicateEvent(eventName, eventData.event_date)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_ALREADY_EXISTS);
    }

    const eventId = IdService.generateEventId();

    const newEvent = {
      event_id: eventId,
      event_name: eventName,
      event_date: eventData.event_date,
      venue: venue,
      coordinator_id: eventData.coordinator_id,
      status: eventData.status || CONFIG.EVENT_STATUS.UPCOMING
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
    const eventsSheet = CONFIG.SHEETS.EVENTS;
    
    if (!DatabaseService.exists(eventsSheet, 'event_id', eventId)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
    }

    if (eventData.coordinator_id && !DatabaseService.exists(CONFIG.SHEETS.USERS, 'user_id', eventData.coordinator_id)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.INVALID_COORDINATOR);
    }

    const existingRecords = DatabaseService.findByColumn(eventsSheet, 'event_id', eventId);
    const existingEvent = existingRecords[0];

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
      (updatedEvent.event_date && Utils.formatDate(updatedEvent.event_date) !== Utils.formatDate(existingEvent.event_date))
    ) {
      if (this._isDuplicateEvent(updatedEvent.event_name, updatedEvent.event_date, eventId)) {
        return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_ALREADY_EXISTS);
      }
    }

    const success = DatabaseService.updateRow(eventsSheet, 'event_id', eventId, updatedEvent);
    if (success) {
      return Utils.buildResponse(true, CONFIG.MESSAGES.EVENT_UPDATED, { event: updatedEvent });
    }
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

  /**
   * Gets an event by ID.
   * @param {string} eventId 
   * @returns {object|null} The event object or null.
   */
  getEventById: function(eventId) {
    if (!eventId) return null;
    const records = DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, 'event_id', eventId);
    return records.length > 0 ? records[0] : null;
  },

  /**
   * Gets all events.
   * @returns {object[]} Array of all event objects.
   */
  getAllEvents: function() {
    return DatabaseService.readAllRows(CONFIG.SHEETS.EVENTS);
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
    
    return records.filter(event => {
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
    return DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, 'coordinator_id', coordinatorId);
  },

  /**
   * Gets events by Status.
   * @param {string} status 
   * @returns {object[]} Array of event objects.
   */
  getEventsByStatus: function(status) {
    if (!status) return [];
    return DatabaseService.findByColumn(CONFIG.SHEETS.EVENTS, 'status', status);
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
    return allEvents.filter(event => Utils.formatDate(event.event_date) === targetDate);
  },

  /**
   * Activates an event (Sets status to UPCOMING).
   * @param {string} eventId 
   * @returns {object} Standard response object.
   */
  activateEvent: function(eventId) {
    const event = this.getEventById(eventId);
    if (!event) return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
    if (event.status === CONFIG.EVENT_STATUS.UPCOMING) {
      return Utils.buildResponse(true, CONFIG.MESSAGES.EVENT_ALREADY_UPCOMING || 'Event is already upcoming.');
    }
    return this.updateEvent(eventId, { status: CONFIG.EVENT_STATUS.UPCOMING });
  },

  /**
   * Completes an event (Sets status to COMPLETED).
   * @param {string} eventId 
   * @returns {object} Standard response object.
   */
  completeEvent: function(eventId) {
    const event = this.getEventById(eventId);
    if (!event) return Utils.buildResponse(false, CONFIG.MESSAGES.EVENT_NOT_FOUND);
    if (event.status === CONFIG.EVENT_STATUS.COMPLETED) {
      return Utils.buildResponse(true, CONFIG.MESSAGES.EVENT_ALREADY_COMPLETED || 'Event is already completed.');
    }
    return this.updateEvent(eventId, { status: CONFIG.EVENT_STATUS.COMPLETED });
  }

};
