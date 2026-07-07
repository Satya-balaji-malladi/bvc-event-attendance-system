/**
 * Service for generating read-only enterprise reports and summaries.
 * Aggregates data from other services. Does not modify data.
 */
const ReportService = {

  _requestCache: null,
  _getCache: function(userId) {
    if (this._requestCache) return this._requestCache;

    // Best-effort: keep all expensive reads in one place and reuse in public methods.
    // TODO: If CONFIG.COLUMNS mapping differs from sheet headers (roll_number/user_id/event_id),
    // adjust mapping or switch to CONFIG-driven lookups.
    const allEvents = EventService.getAllEvents() || [];
    const allStudents = StudentService.getAllStudents() || [];
    const allAttendance = DatabaseService.readAllRows(CONFIG.SHEETS.ATTENDANCE) || [];
    const allUsers = DatabaseService.readAllRows(CONFIG.SHEETS.USERS) || [];
    const allParticipants = DatabaseService.readAllRows(CONFIG.SHEETS.EVENT_PARTICIPANTS) || [];

    const studentMap = new Map();
    (allStudents || []).forEach(s => {
      // roll_number is used throughout existing logic.
      studentMap.set(s.roll_number, s);
    });

    const userMap = new Map();
    (allUsers || []).forEach(u => {
      userMap.set(String(u.user_id), u);
    });

    const userRecord = userMap.get(String(userId));
    let authorizedEvents = allEvents;
    if (userRecord && userRecord.role === CONFIG.ROLES.COORDINATOR) {
      authorizedEvents = (allEvents || []).filter(e => String(e.coordinator_id) === String(userId));
    }

    const authorizedEventIds = new Set((authorizedEvents || []).map(e => e.event_id));
    const authorizedAttendance = (allAttendance || []).filter(a => authorizedEventIds.has(a.event_id));

    this._requestCache = {
      events: allEvents,
      students: allStudents,
      attendance: allAttendance,
      users: allUsers,
      participants: allParticipants,
      studentMap,
      userMap,
      authorizedEvents,
      authorizedAttendance,
      authorizedEventIds
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

      const resp = Utils.buildResponse(true, 'Report generated', { 
        summary: { total: events.length, present: totalPresent, percentage: this._calculatePercentage(totalPresent, totalParticipants) },
        data: data 
      });

      try {
        NotificationService.createNotification({
          user_id: userId,
          title: 'Report Generated',
          message: 'Report generated by ReportService.',
          type: 'Report',
          related_event_id: (filters && (filters.eventId || filters.event_id)) ? (filters.eventId || filters.event_id) : '',
          metadata: JSON.stringify(filters || {})
        });
      } catch (error) {
        Logger.log(error);
      }

      try {
        AuditService.logAction(
          userId,
          'ReportService',
          'GENERATE_REPORT',
          '',
          'Report',
          'Report generated',
          JSON.stringify(filters || {}),
          'SUCCESS',
          userId
        );
      } catch (error) {
        Logger.log(error);
      }

      return resp;
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
  },

  getAttendanceDefaulters: function(userId, filters = {}) {
    try {
      const cache = this._getCache(userId);
      const threshold = filters.threshold ? Number(filters.threshold) : 75;
      let students = cache.students.filter(s => s.year && s.status !== CONFIG.STUDENT_STATUS.INACTIVE);
      if (filters.department) students = students.filter(s => s.department === filters.department);
      if (filters.year) students = students.filter(s => String(s.year) === String(filters.year));

      const data = [];
      students.forEach(student => {
        const records = cache.authorizedAttendance.filter(a => a.roll_number === student.roll_number);
        if (records.length === 0) return;
        const present = records.filter(a => a.status === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
        const total = records.length;
        const pct = this._calculatePercentage(present, total);
        if (pct < threshold) {
          data.push({
            roll_number: student.roll_number,
            student_name: student.student_name,
            department: student.department,
            year: student.year,
            events_enrolled: total,
            present: present,
            absent: total - present,
            attendance_percentage: pct,
            status: pct < 50 ? 'Critical' : 'Warning'
          });
        }
      });

      data.sort((a, b) => a.attendance_percentage - b.attendance_percentage);
      return Utils.buildResponse(true, 'Report generated', {
        summary: { total: data.length, threshold: threshold },
        data: data
      });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getTopParticipants: function(userId, filters = {}) {
    try {
      const cache = this._getCache(userId);
      const limit = filters.limit ? Number(filters.limit) : 20;
      const stats = {};

      cache.authorizedAttendance.forEach(a => {
        if (a.status !== CONFIG.ATTENDANCE_STATUS.PRESENT) return;
        const stu = cache.studentMap.get(a.roll_number);
        if (!stu || !stu.year) return;
        if (filters.department && stu.department !== filters.department) return;
        if (filters.year && String(stu.year) !== String(filters.year)) return;
        if (!stats[a.roll_number]) {
          stats[a.roll_number] = { roll_number: a.roll_number, student_name: stu.student_name, department: stu.department, year: stu.year, events_attended: 0, events: new Set() };
        }
        stats[a.roll_number].events_attended++;
        stats[a.roll_number].events.add(a.event_id);
      });

      const data = Object.values(stats)
        .map(s => ({ roll_number: s.roll_number, student_name: s.student_name, department: s.department, year: s.year, events_attended: s.events_attended, unique_events: s.events.size }))
        .sort((a, b) => b.events_attended - a.events_attended)
        .slice(0, limit);

      return Utils.buildResponse(true, 'Report generated', { summary: { total: data.length, limit: limit }, data: data });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getAbsentStudents: function(userId, filters = {}) {
    try {
      const cache = this._getCache(userId);
      let records = cache.authorizedAttendance.filter(a => a.status === CONFIG.ATTENDANCE_STATUS.ABSENT);
      if (filters.eventId) records = records.filter(a => a.event_id === filters.eventId);
      if (filters.department) {
        records = records.filter(a => {
          const stu = cache.studentMap.get(a.roll_number);
          return stu && stu.department === filters.department;
        });
      }

      const data = records.map(a => {
        const stu = cache.studentMap.get(a.roll_number) || {};
        const evt = cache.events.find(e => e.event_id === a.event_id) || {};
        return {
          roll_number: a.roll_number,
          student_name: stu.student_name || 'Unknown',
          department: stu.department || 'N/A',
          year: stu.year || 'N/A',
          event_name: evt.event_name || 'Unknown',
          event_id: a.event_id,
          date: Utils.formatDate(evt.start_date || a.attendance_time),
          status: a.status
        };
      });

      return Utils.buildResponse(true, 'Report generated', { summary: { total: data.length }, data: data });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getYearWiseReport: function(userId, year) {
    try {
      const cache = this._getCache(userId);
      let students = cache.students.filter(s => s.year);
      if (year) students = students.filter(s => String(s.year) === String(year));

      const yearStats = {};
      students.forEach(s => {
        if (!yearStats[s.year]) yearStats[s.year] = { year: s.year, total_students: 0, present: 0, attendance_total: 0, events: new Set() };
        yearStats[s.year].total_students++;
      });

      cache.authorizedAttendance.forEach(a => {
        const stu = cache.studentMap.get(a.roll_number);
        if (!stu || !stu.year) return;
        if (year && String(stu.year) !== String(year)) return;
        if (!yearStats[stu.year]) yearStats[stu.year] = { year: stu.year, total_students: 0, present: 0, attendance_total: 0, events: new Set() };
        yearStats[stu.year].attendance_total++;
        yearStats[stu.year].events.add(a.event_id);
        if (a.status === CONFIG.ATTENDANCE_STATUS.PRESENT) yearStats[stu.year].present++;
      });

      const data = Object.values(yearStats).map(ys => ({
        year: ys.year,
        total_students: ys.total_students,
        events_conducted: ys.events.size,
        present: ys.present,
        absent: ys.attendance_total - ys.present,
        attendance_percentage: this._calculatePercentage(ys.present, ys.attendance_total)
      })).sort((a, b) => String(a.year).localeCompare(String(b.year)));

      return Utils.buildResponse(true, 'Report generated', { summary: { total: data.length }, data: data });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getDepartmentComparison: function(userId) {
    try {
      const result = this.getDepartmentReport(userId, '');
      if (!result.success) return result;
      const data = (result.data || []).map(row => ({
        department: row.department,
        total_students: row.total_students,
        events_conducted: row.events_conducted,
        attendance_percentage: row.attendance_percentage,
        rank: 0
      }));
      data.sort((a, b) => b.attendance_percentage - a.attendance_percentage);
      data.forEach((row, idx) => { row.rank = idx + 1; });
      return Utils.buildResponse(true, 'Report generated', { summary: { total: data.length }, data: data });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getMonthlyReport: function(userId, filters = {}) {
    try {
      const cache = this._getCache(userId);
      let events = cache.authorizedEvents;
      if (filters.month && filters.year) {
        const targetMonth = Number(filters.month);
        const targetYear = Number(filters.year);
        events = events.filter(e => {
          const d = new Date(e.start_date);
          return d.getMonth() + 1 === targetMonth && d.getFullYear() === targetYear;
        });
      } else if (filters.fromDate && filters.toDate) {
        const from = new Date(filters.fromDate).getTime();
        const to = new Date(filters.toDate).getTime();
        events = events.filter(e => {
          const t = new Date(e.start_date).getTime();
          return t >= from && t <= to;
        });
      }

      const monthMap = {};
      events.forEach(event => {
        const d = new Date(event.start_date);
        const key = d.getFullYear() + '-' + Utils._padNumber(d.getMonth() + 1, 2);
        if (!monthMap[key]) monthMap[key] = { month: key, events_count: 0, participants: 0, present: 0, absent: 0 };
        monthMap[key].events_count++;
        const eventAtt = cache.authorizedAttendance.filter(a => a.event_id === event.event_id);
        monthMap[key].participants += eventAtt.length;
        monthMap[key].present += eventAtt.filter(a => a.status === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
        monthMap[key].absent += eventAtt.filter(a => a.status === CONFIG.ATTENDANCE_STATUS.ABSENT).length;
      });

      const data = Object.values(monthMap).map(m => ({
        month: m.month,
        events_count: m.events_count,
        participants: m.participants,
        present: m.present,
        absent: m.absent,
        attendance_percentage: this._calculatePercentage(m.present, m.participants)
      })).sort((a, b) => a.month.localeCompare(b.month));

      return Utils.buildResponse(true, 'Report generated', { summary: { total: data.length }, data: data });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getEventTrendReport: function(userId, filters = {}) {
    try {
      const cache = this._getCache(userId);
      let events = cache.authorizedEvents;
      if (filters.fromDate && filters.toDate) {
        const from = new Date(filters.fromDate).getTime();
        const to = new Date(filters.toDate).getTime();
        events = events.filter(e => {
          const t = new Date(e.start_date).getTime();
          return t >= from && t <= to;
        });
      }

      const trendMap = {};
      events.forEach(event => {
        const d = new Date(event.start_date);
        const period = d.getFullYear() + '-' + Utils._padNumber(d.getMonth() + 1, 2);
        if (!trendMap[period]) trendMap[period] = { period: period, events: 0, total_attendance: 0, present: 0 };
        trendMap[period].events++;
        const eventAtt = cache.authorizedAttendance.filter(a => a.event_id === event.event_id);
        trendMap[period].total_attendance += eventAtt.length;
        trendMap[period].present += eventAtt.filter(a => a.status === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
      });

      const data = Object.values(trendMap).map(t => ({
        period: t.period,
        events: t.events,
        total_attendance: t.total_attendance,
        present: t.present,
        absent: t.total_attendance - t.present,
        attendance_percentage: this._calculatePercentage(t.present, t.total_attendance),
        trend: t.events > 0 ? 'Active' : 'Idle'
      })).sort((a, b) => a.period.localeCompare(b.period));

      return Utils.buildResponse(true, 'Report generated', { summary: { total: data.length }, data: data });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getCancelledEvents: function(userId, filters = {}) {
    try {
      const cache = this._getCache(userId);
      let events = cache.authorizedEvents.filter(e => e.status === CONFIG.EVENT_STATUS.CANCELLED);
      if (filters.coordinatorId) events = events.filter(e => String(e.coordinator_id) === String(filters.coordinatorId));
      if (filters.fromDate && filters.toDate) {
        const from = new Date(filters.fromDate).getTime();
        const to = new Date(filters.toDate).getTime();
        events = events.filter(e => {
          const t = new Date(e.start_date).getTime();
          return t >= from && t <= to;
        });
      }

      const data = events.map(event => {
        const coordinatorRecord = cache.userMap.get(String(event.coordinator_id));
        return {
          event_id: event.event_id,
          event_name: event.event_name,
          coordinator: coordinatorRecord ? coordinatorRecord.full_name : 'Unknown',
          venue: event.venue || 'N/A',
          start_date: Utils.formatDate(event.start_date),
          end_date: Utils.formatDate(event.end_date),
          status: event.status,
          cancellation_reason: event.cancellation_reason || 'N/A'
        };
      });

      return Utils.buildResponse(true, 'Report generated', { summary: { total: data.length }, data: data });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getCoordinatorPerformance: function(userId, coordinatorId) {
    try {
      const cache = this._getCache(userId);
      const currentUser = cache.userMap.get(String(userId));
      if (currentUser && currentUser.role === CONFIG.ROLES.COORDINATOR) {
        if (coordinatorId && String(coordinatorId) !== String(userId)) {
          return Utils.buildResponse(false, 'Unauthorized. Coordinators can only view their own performance.');
        }
        coordinatorId = userId;
      }

      let coordinators = cache.users.filter(u => u.role === CONFIG.ROLES.COORDINATOR);
      if (coordinatorId) coordinators = coordinators.filter(c => String(c.user_id) === String(coordinatorId));

      const data = coordinators.map(coord => {
        const events = cache.events.filter(e => String(e.coordinator_id) === String(coord.user_id));
        const eventIds = new Set(events.map(e => e.event_id));
        const attendance = cache.attendance.filter(a => eventIds.has(a.event_id));
        const present = attendance.filter(a => a.status === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
        const completed = events.filter(e => e.status === CONFIG.EVENT_STATUS.COMPLETED).length;
        const cancelled = events.filter(e => e.status === CONFIG.EVENT_STATUS.CANCELLED).length;
        const active = events.filter(e => e.status === CONFIG.EVENT_STATUS.ACTIVE).length;

        let avgRate = 0;
        let eventRates = 0;
        events.forEach(event => {
          const eventAtt = attendance.filter(a => a.event_id === event.event_id);
          if (eventAtt.length > 0) {
            avgRate += this._calculatePercentage(
              eventAtt.filter(a => a.status === CONFIG.ATTENDANCE_STATUS.PRESENT).length,
              eventAtt.length
            );
            eventRates++;
          }
        });

        return {
          coordinator: coord.full_name,
          coordinator_id: coord.user_id,
          events_managed: events.length,
          events_completed: completed,
          events_active: active,
          events_cancelled: cancelled,
          total_participants: attendance.length,
          present: present,
          absent: attendance.length - present,
          avg_attendance_rate: eventRates > 0 ? Number((avgRate / eventRates).toFixed(2)) : 0,
          performance: eventRates > 0 && (avgRate / eventRates) >= 75 ? 'Good' : 'Needs Improvement'
        };
      });

      return Utils.buildResponse(true, 'Report generated', { summary: { total: data.length }, data: data });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  getStudentEventHistory: function(userId, rollNumber) {
    try {
      const cache = this._getCache(userId);
      const student = cache.studentMap.get(rollNumber);
      if (!student) return Utils.buildResponse(false, 'Student not found.');
      if (!student.year) return Utils.buildResponse(false, 'Student excluded due to missing Year information.');

      const records = cache.authorizedAttendance.filter(a => a.roll_number === rollNumber);
      const present = records.filter(a => a.status === CONFIG.ATTENDANCE_STATUS.PRESENT).length;

      const data = records.map(r => {
        const evt = cache.events.find(e => e.event_id === r.event_id) || {};
        const coordinatorRecord = cache.userMap.get(String(evt.coordinator_id));
        return {
          roll_number: student.roll_number,
          student_name: student.student_name,
          department: student.department,
          year: student.year,
          event_id: r.event_id,
          event_name: evt.event_name || 'Unknown',
          venue: evt.venue || 'N/A',
          coordinator: coordinatorRecord ? coordinatorRecord.full_name : 'Unknown',
          date: Utils.formatDate(evt.start_date || r.attendance_time),
          attendance_time: Utils.formatDate(r.attendance_time),
          status: r.status
        };
      }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      return Utils.buildResponse(true, 'Report generated', {
        summary: {
          total: records.length,
          present: present,
          absent: records.length - present,
          percentage: this._calculatePercentage(present, records.length)
        },
        data: data
      });
    } catch (error) {
      return Utils.buildResponse(false, error.message);
    }
  }
};
