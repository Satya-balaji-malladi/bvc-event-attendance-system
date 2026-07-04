/**
 * Service for generating read-only enterprise reports and summaries.
 * Aggregates data from other services. Does not modify data.
 */
const ReportService = {

  _requestCache: null,
  _getCache: function(userId) {
    if (this._requestCache) return this._requestCache;
    const allEvents = EventService.getAllEvents() || [];
    const allStudents = StudentService.getAllStudents() || [];
    const allAttendance = DatabaseService.readAllRows(CONFIG.SHEETS.ATTENDANCE) || [];
    const allUsers = DatabaseService.readAllRows(CONFIG.SHEETS.USERS) || [];
    const studentMap = new Map();
    allStudents.forEach(s => studentMap.set(s.roll_number, s));
    const userMap = new Map();
    allUsers.forEach(u => userMap.set(String(u.user_id), u));
    const userRecord = userMap.get(String(userId));
    let authorizedEvents = allEvents;
    if (userRecord && userRecord.role === CONFIG.ROLES.COORDINATOR) {
      authorizedEvents = allEvents.filter(e => String(e.coordinator_id) === String(userId));
    }
    const authorizedEventIds = new Set(authorizedEvents.map(e => e.event_id));
    const authorizedAttendance = allAttendance.filter(a => authorizedEventIds.has(a.event_id));
    this._requestCache = {
      events: allEvents, students: allStudents, attendance: allAttendance, users: allUsers,
      studentMap, userMap, authorizedEvents, authorizedAttendance, authorizedEventIds
    };
    return this._requestCache;
  },
  _clearCache: function() { this._requestCache = null; },

  _calculatePercentage: function(present, total) {
    if (!total || total === 0) return 0;
    return Number(((present / total) * 100).toFixed(2));
  },

  _getCoordinatorName: function(coordinatorId) {
    if (!coordinatorId) return 'Unknown';
    const records = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'user_id', coordinatorId);
    if (records && records.length > 0) return records[0].full_name;
    return 'Unknown';
  },

  _enforceCoordinatorPermissions: function(events, userId) {
    const userRecords = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'user_id', userId);
    if (userRecords.length > 0 && userRecords[0].role === CONFIG.ROLES.COORDINATOR) {
      return events.filter(e => String(e.coordinator_id) === String(userId));
    }
    return events;
  },

  getDashboardSummary: function(userId) {
    try {
      const cache = this._getCache(userId);
      const students = cache.students;
      const events = cache.events;
      const attendance = cache.attendance;

      let totalAttendance = attendance.length;
      let totalPresent = attendance.filter(a => a.status === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
      let totalAbsent = totalAttendance - totalPresent;

      const report = {
        totalEvents: events.length,
        totalStudents: students.length,
        totalAttendance: totalAttendance,
        totalPresent: totalPresent,
        totalAbsent: totalAbsent,
        attendancePercentage: this._calculatePercentage(totalPresent, totalAttendance)
      };

      return Utils.buildResponse(true, 'Summary generated', { report: report });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getReportsDashboardSummary: function(userId) {
    try {
      const cache = this._getCache(userId);
      const students = cache.students;
      let events = cache.authorizedEvents;
      let authorizedAttendance = cache.authorizedAttendance;

      let totalAttendance = authorizedAttendance.length;
      let totalPresent = authorizedAttendance.filter(a => a.status === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
      let completedEvents = 0;
      let activeEvents = 0;

      let highestEvent = null;
      let lowestEvent = null;
      let highestRate = -1;
      let lowestRate = 101;

      events.forEach(event => {
        if (event.status === CONFIG.EVENT_STATUS.COMPLETED) completedEvents++;
        if (event.status === CONFIG.EVENT_STATUS.ACTIVE) activeEvents++;

        const eventAtt = authorizedAttendance.filter(a => a.event_id === event.event_id);
        const eventTotal = eventAtt.length;
        const eventPresent = eventAtt.filter(a => a.status === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
        
        if (eventTotal > 0) {
           const rate = this._calculatePercentage(eventPresent, eventTotal);
           if (rate > highestRate) {
             highestRate = rate;
             highestEvent = event.event_name;
           }
           if (rate < lowestRate) {
             lowestRate = rate;
             lowestEvent = event.event_name;
           }
        }
      });

      const report = {
        totalEvents: events.length,
        completedEvents: completedEvents,
        activeEvents: activeEvents,
        totalStudents: students.length,
        totalAttendance: totalAttendance,
        attendancePercentage: this._calculatePercentage(totalPresent, totalAttendance),
        highestEvent: highestEvent || 'N/A',
        lowestEvent: lowestEvent || 'N/A'
      };

      return Utils.buildResponse(true, 'Summary generated', { report: report });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getEventReport: function(userId, filters = {}) {
    try {
      const cache = this._getCache(userId);
      let events = cache.authorizedEvents;
      const authorizedAttendance = cache.authorizedAttendance;

      // Apply Filters
      if (filters.eventId) events = events.filter(e => e.event_id === filters.eventId);
      if (filters.coordinatorId) events = events.filter(e => String(e.coordinator_id) === String(filters.coordinatorId));
      if (filters.status) events = events.filter(e => e.status === filters.status);
      if (filters.fromDate && filters.toDate) {
         const from = new Date(filters.fromDate).getTime();
         const to = new Date(filters.toDate).getTime();
         events = events.filter(e => {
            const t = new Date(e.start_date).getTime();
            return t >= from && t <= to;
         });
      }

      let totalPresent = 0;
      let totalParticipants = 0;

      const data = events.map(event => {
        const eventAtt = authorizedAttendance.filter(a => a.event_id === event.event_id);
        const eventTotal = eventAtt.length;
        const eventPresent = eventAtt.filter(a => a.status === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
        const eventAbsent = eventTotal - eventPresent;

        totalParticipants += eventTotal;
        totalPresent += eventPresent;
        
        const coordinatorRecord = cache.userMap.get(String(event.coordinator_id));
        const coordinatorName = coordinatorRecord ? coordinatorRecord.full_name : 'Unknown';

        return {
          event_name: event.event_name,
          coordinator: coordinatorName,
          venue: event.venue || 'N/A',
          start_date: Utils.formatDate(event.start_date),
          end_date: Utils.formatDate(event.end_date),
          participants: eventTotal,
          present: eventPresent,
          absent: eventAbsent,
          attendance_percentage: this._calculatePercentage(eventPresent, eventTotal),
          status: event.status
        };
      });

      return Utils.buildResponse(true, 'Report generated', { 
        summary: { total: events.length, present: totalPresent, percentage: this._calculatePercentage(totalPresent, totalParticipants) },
        data: data 
      });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getStudentReport: function(userId, rollNumber) {
    try {
      const cache = this._getCache(userId);
      const student = cache.studentMap.get(rollNumber);
      if (!student) return Utils.buildResponse(false, 'Student not found.');
      
      if (!student.year) {
        return Utils.buildResponse(false, 'Student excluded due to missing Year information.');
      }

      const allAttendance = cache.authorizedAttendance.filter(a => a.roll_number === rollNumber);
      
      const summary = {
        totalEvents: allAttendance.length,
        present: allAttendance.filter(a => a.status === CONFIG.ATTENDANCE_STATUS.PRESENT).length
      };
      
      const data = allAttendance.map(r => {
        const evt = cache.events.find(e => e.event_id === r.event_id) || {};
        return {
          roll_number: student.roll_number,
          student_name: student.student_name,
          department: student.department,
          year: student.year,
          events_participated: summary.totalEvents,
          attendance_percentage: this._calculatePercentage(summary.present, summary.totalEvents),
          event_name: evt.event_name || 'Unknown',
          date: Utils.formatDate(evt.start_date),
          status: r.status
        };
      });

      return Utils.buildResponse(true, 'Report generated', {
        summary: { total: allAttendance.length, present: summary.present, percentage: this._calculatePercentage(summary.present, summary.totalEvents) },
        data: data
      });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getDepartmentReport: function(userId, department) {
    try {
      const cache = this._getCache(userId);
      let students = cache.students;
      
      // Filter out missing years and report count
      const initialCount = students.length;
      students = students.filter(s => s.year);
      const excludedCount = initialCount - students.length;
      
      if (department) students = students.filter(s => s.department === department);
      
      const authorizedAttendance = cache.authorizedAttendance;

      const deptStats = {};
      students.forEach(s => {
        if (!deptStats[s.department]) deptStats[s.department] = { students: 0, attendanceTotal: 0, present: 0, events: new Set() };
        deptStats[s.department].students++;
      });

      authorizedAttendance.forEach(a => {
        const stu = cache.studentMap.get(a.roll_number);
        if (stu && stu.year && (!department || stu.department === department)) {
          deptStats[stu.department].attendanceTotal++;
          deptStats[stu.department].events.add(a.event_id);
          if (a.status === CONFIG.ATTENDANCE_STATUS.PRESENT) deptStats[stu.department].present++;
        }
      });

      const data = Object.keys(deptStats).map(dept => {
        return {
          department: dept,
          total_students: deptStats[dept].students,
          events_conducted: deptStats[dept].events.size,
          attendance_percentage: this._calculatePercentage(deptStats[dept].present, deptStats[dept].attendanceTotal)
        };
      });

      return Utils.buildResponse(true, 'Report generated', { summary: { total: data.length, excluded_students_no_year: excludedCount }, data: data });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getCoordinatorReport: function(userId, targetCoordinatorId) {
    try {
      const cache = this._getCache(userId);
      const userRecords = cache.userMap.get(String(userId));
      if (userRecords && userRecords.role === CONFIG.ROLES.COORDINATOR) {
         if (targetCoordinatorId && String(targetCoordinatorId) !== String(userId)) {
            return Utils.buildResponse(false, 'Unauthorized. Coordinators can only view their own report.');
         }
         targetCoordinatorId = userId; // Force query to self
      }

      let allUsers = cache.users;
      let coordinators = allUsers.filter(u => u.role === CONFIG.ROLES.COORDINATOR);
      if (targetCoordinatorId) coordinators = coordinators.filter(c => String(c.user_id) === String(targetCoordinatorId));

      const allEvents = cache.events;
      const allAttendance = cache.attendance;

      const data = coordinators.map(coord => {
        const events = allEvents.filter(e => String(e.coordinator_id) === String(coord.user_id));
        const eventIds = new Set(events.map(e => e.event_id));
        const attendance = allAttendance.filter(a => eventIds.has(a.event_id));
        
        let lastActivity = 'N/A';
        if (attendance.length > 0) {
           const latest = attendance.sort((a,b) => new Date(b.attendance_time) - new Date(a.attendance_time))[0];
           lastActivity = Utils.formatDate(latest.attendance_time);
        }

        return {
          coordinator: coord.full_name,
          events_managed: events.length,
          participants: attendance.length,
          attendance_records: attendance.length,
          last_activity: lastActivity
        };
      });

      return Utils.buildResponse(true, 'Report generated', { summary: { total: data.length }, data: data });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getDateRangeReport: function(userId, fromDate, toDate) {
    return this.getEventReport(userId, { fromDate, toDate });
  }
};
