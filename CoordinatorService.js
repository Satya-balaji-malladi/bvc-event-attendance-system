/**
 * CoordinatorService
 * Handles all logic for Coordinator Management and Event assignments (Sprint 1)
 */
const CoordinatorService = {

  _tryWrap: function(methodName, failureMessage, fn) {
    if (typeof failureMessage === 'function') {
      fn = failureMessage;
      failureMessage = 'Coordinator action failed.';
    }
    try {
      return fn();
    } catch (error) {
      Logger.log('CoordinatorService.' + methodName + ' error: ' + (error && error.message ? error.message : error));
      return Utils.buildResponse(false, failureMessage);
    }
  },

  assignCoordinator: function(eventId, userId, role, assignedBy, remarks) {
    return this._tryWrap('assignCoordinator', 'Failed to assign coordinator.', () => {
      // 1. Verify Event exists
      const event = EventService.getEventById(eventId);
      if (!event) {
        return Utils.buildResponse(false, 'Event not found.');
      }
      
      // 2. Verify User exists and is active
      const user = UserService.getUserById(userId);
      if (!user) {
        return Utils.buildResponse(false, 'User not found.');
      }
      const userStatus = user.Status || user.status;
      if (userStatus !== 'Active') {
        return Utils.buildResponse(false, 'Cannot assign an inactive user.');
      }

      // 3. Prevent duplicate assignments
      const all = DatabaseService.readAllRows(CONFIG.SHEETS.EVENT_COORDINATORS) || [];
      const duplicate = all.find(a => 
        String(a['Event ID']).trim() === String(eventId).trim() && 
        String(a['User ID']).trim() === String(userId).trim() &&
        a['Assignment Status'] === 'Active'
      );
      if (duplicate) {
        return Utils.buildResponse(false, 'User is already assigned to this event.');
      }

      // 4. Primary/Lead Coordinator Singleton validation
      // Physical validations allow: Primary Coordinator, Coordinator, Volunteer Coordinator.
      // We map Lead Coordinator to Primary Coordinator.
      const targetRole = (role === 'Lead Coordinator' || role === 'Primary Coordinator') ? 'Primary Coordinator' : (role || 'Coordinator');
      const isLead = targetRole === 'Primary Coordinator';
      if (isLead) {
        const leadExist = all.some(a =>
          String(a['Event ID']).trim() === String(eventId).trim() &&
          a['Assignment Status'] === 'Active' &&
          (a['Assignment Role'] === 'Primary Coordinator' || a['Assignment Role'] === 'Lead Coordinator')
        );
        if (leadExist) {
          return Utils.buildResponse(false, 'A Lead Coordinator is already assigned to this event.');
        }
      }

      // 5. Generate next ID
      const assignmentId = IdService._generateNextIdWithLock('EVENT_COORDINATORS');
      const nowStr = Utils.formatDate(new Date());

      const record = {
        'Assignment ID': assignmentId,
        'Event ID': eventId,
        'User ID': userId,
        'Assignment Role': targetRole,
        'Assignment Status': 'Active',
        'Assigned By': assignedBy || 'System',
        'Assigned Date': nowStr,
        'Updated By': assignedBy || 'System',
        'Updated Date': nowStr,
        'Remarks': remarks || ''
      };

      const success = DatabaseService.insertRow(CONFIG.SHEETS.EVENT_COORDINATORS, record);
      if (success) {
        try {
          AuditService.logAction(
            assignedBy || 'System',
            'CoordinatorService',
            'ASSIGN_COORDINATOR',
            assignmentId,
            'CoordinatorAssignment',
            'Coordinator assigned to event ' + eventId,
            '',
            'SUCCESS',
            userId
          );
        } catch (e) {
          Logger.log(e);
        }
        return Utils.buildResponse(true, 'Coordinator assigned successfully.', { assignment: record });
      }
      return Utils.buildResponse(false, 'Failed to insert coordinator assignment row.');
    });
  },

  removeCoordinator: function(assignmentId, userId) {
    return this._tryWrap('removeCoordinator', 'Failed to remove coordinator.', () => {
      const all = DatabaseService.readAllRows(CONFIG.SHEETS.EVENT_COORDINATORS) || [];
      const record = all.find(a => String(a['Assignment ID']).trim() === String(assignmentId).trim());
      if (!record) {
        return Utils.buildResponse(false, 'Assignment record not found.');
      }

      // Validated values restrict status to 'Active', 'Removed'.
      const updates = {
        'Assignment Status': 'Removed',
        'Updated By': userId || 'System',
        'Updated Date': Utils.formatDate(new Date())
      };

      const success = DatabaseService.updateRow(CONFIG.SHEETS.EVENT_COORDINATORS, 'Assignment ID', assignmentId, updates);
      if (success) {
        try {
          AuditService.logAction(
            userId || 'System',
            'CoordinatorService',
            'REMOVE_COORDINATOR',
            assignmentId,
            'CoordinatorAssignment',
            'Coordinator assignment marked Removed',
            '',
            'SUCCESS',
            record['User ID']
          );
        } catch (e) {
          Logger.log(e);
        }
        return Utils.buildResponse(true, 'Coordinator removed successfully.');
      }
      return Utils.buildResponse(false, 'Failed to update assignment status.');
    });
  },

  updateCoordinatorRole: function(assignmentId, newRole, updatedBy) {
    return this._tryWrap('updateCoordinatorRole', 'Failed to update role.', () => {
      const all = DatabaseService.readAllRows(CONFIG.SHEETS.EVENT_COORDINATORS) || [];
      const record = all.find(a => String(a['Assignment ID']).trim() === String(assignmentId).trim());
      if (!record) {
        return Utils.buildResponse(false, 'Assignment record not found.');
      }

      const targetRole = (newRole === 'Lead Coordinator' || newRole === 'Primary Coordinator') ? 'Primary Coordinator' : (newRole || 'Coordinator');

      // Lead Coordinator singleton check
      const isLead = targetRole === 'Primary Coordinator';
      if (isLead) {
        const leadExist = all.some(a =>
          String(a['Event ID']).trim() === String(record['Event ID']).trim() &&
          String(a['Assignment ID']).trim() !== String(assignmentId).trim() &&
          a['Assignment Status'] === 'Active' &&
          (a['Assignment Role'] === 'Primary Coordinator' || a['Assignment Role'] === 'Lead Coordinator')
        );
        if (leadExist) {
          return Utils.buildResponse(false, 'A Lead Coordinator is already assigned to this event.');
        }
      }

      const updates = {
        'Assignment Role': targetRole,
        'Updated By': updatedBy || 'System',
        'Updated Date': Utils.formatDate(new Date())
      };

      const success = DatabaseService.updateRow(CONFIG.SHEETS.EVENT_COORDINATORS, 'Assignment ID', assignmentId, updates);
      if (success) {
        return Utils.buildResponse(true, 'Role updated successfully.');
      }
      return Utils.buildResponse(false, 'Failed to update role.');
    });
  },

  activateCoordinator: function(assignmentId, updatedBy) {
    return this._tryWrap('activateCoordinator', 'Failed to activate coordinator.', () => {
      const updates = {
        'Assignment Status': 'Active',
        'Updated By': updatedBy || 'System',
        'Updated Date': Utils.formatDate(new Date())
      };
      const success = DatabaseService.updateRow(CONFIG.SHEETS.EVENT_COORDINATORS, 'Assignment ID', assignmentId, updates);
      if (success) return Utils.buildResponse(true, 'Coordinator activated successfully.');
      return Utils.buildResponse(false, 'Failed to activate coordinator.');
    });
  },

  deactivateCoordinator: function(assignmentId, updatedBy) {
    return this._tryWrap('deactivateCoordinator', 'Failed to deactivate coordinator.', () => {
      const updates = {
        'Assignment Status': 'Removed',
        'Updated By': updatedBy || 'System',
        'Updated Date': Utils.formatDate(new Date())
      };
      const success = DatabaseService.updateRow(CONFIG.SHEETS.EVENT_COORDINATORS, 'Assignment ID', assignmentId, updates);
      if (success) return Utils.buildResponse(true, 'Coordinator deactivated successfully.');
      return Utils.buildResponse(false, 'Failed to deactivate coordinator.');
    });
  },

  getCoordinatorById: function(assignmentId) {
    if (!assignmentId) return null;
    const records = DatabaseService.findByColumn(CONFIG.SHEETS.EVENT_COORDINATORS, 'Assignment ID', assignmentId) || [];
    return records.length > 0 ? records[0] : null;
  },

  getCoordinatorByUserId: function(userId) {
    if (!userId) return [];
    return DatabaseService.findByColumn(CONFIG.SHEETS.EVENT_COORDINATORS, 'User ID', userId) || [];
  },

  getCoordinatorByEmployeeId: function(employeeId) {
    if (!employeeId) return [];
    const users = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'Employee ID', employeeId) || [];
    if (users.length === 0) return [];
    return this.getCoordinatorByUserId(users[0]['User ID']);
  },

  getCoordinatorByEvent: function(eventId) {
    if (!eventId) return [];
    return DatabaseService.findByColumn(CONFIG.SHEETS.EVENT_COORDINATORS, 'Event ID', eventId) || [];
  },

  getEventsByCoordinator: function(userId) {
    if (!userId) return [];
    const assignments = this.getCoordinatorByUserId(userId);
    const active = assignments.filter(a => a['Assignment Status'] === 'Active');
    const events = [];
    active.forEach(a => {
      const event = EventService.getEventById(a['Event ID']);
      if (event) events.push(event);
    });
    return events;
  },

  getAllCoordinators: function() {
    return DatabaseService.readAllRows(CONFIG.SHEETS.EVENT_COORDINATORS) || [];
  },

  // Alias methods for compliance with full test suite mapping
  createCoordinator: function(eventId, userId, role, assignedBy, remarks) {
    return this.assignCoordinator(eventId, userId, role, assignedBy, remarks);
  },

  updateCoordinator: function(assignmentId, updates) {
    return this._tryWrap('updateCoordinator', 'Failed to update coordinator.', () => {
      const success = DatabaseService.updateRow(CONFIG.SHEETS.EVENT_COORDINATORS, 'Assignment ID', assignmentId, updates);
      if (success) return Utils.buildResponse(true, 'Coordinator updated successfully.');
      return Utils.buildResponse(false, 'Failed to update coordinator.');
    });
  },

  deleteCoordinator: function(assignmentId, userId) {
    return this.removeCoordinator(assignmentId, userId);
  }
};
