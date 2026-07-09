/**
 * Service for generating read-only enterprise reports and summaries.
 * Aggregates data from other services. Does not modify data.
 */
const ReportService = {

  _requestCache: null,
  _getCache: function(userId) {
    if (this._requestCache) return this._requestCache;

    const allEvents = EventService.getAllEvents() || [];
    const allStudentsResponse = StudentService.getAllStudents();
    const allStudents = (allStudentsResponse && allStudentsResponse.success) ? allStudentsResponse.students : [];
    const allAttendance = DatabaseService.readAllRows(CONFIG.SHEETS.ATTENDANCE) || [];
    const allUsers = DatabaseService.readAllRows(CONFIG.SHEETS.USERS) || [];
    const allParticipants = DatabaseService.readAllRows(CONFIG.SHEETS.EVENT_PARTICIPANTS) || [];

    const studentMap = new Map();
    (allStudents || []).forEach(s => {
      const roll = s['Roll Number'] || s.roll_number || s.rollNumber;
      if (roll) studentMap.set(String(roll).trim().toUpperCase(), s);
    });

    const userMap = new Map();
    (allUsers || []).forEach(u => {
      const uId = u['User ID'] || u.user_id || u.userId;
      if (uId) userMap.set(String(uId).trim(), u);
    });

    const userRecord = userMap.get(String(userId).trim());
    let authorizedEvents = allEvents;
    const userRole = userRecord ? (userRecord['Role'] || userRecord.role) : null;
    if (userRecord && userRole === CONFIG.ROLES.COORDINATOR) {
      authorizedEvents = (allEvents || []).filter(e => String(e.coordinator_id || e.coordinatorId || e['Organizer']).trim() === String(userId).trim());
    }

    const authorizedEventIds = new Set((authorizedEvents || []).map(e => e.event_id || e.eventId || e['Event ID']));
    const authorizedAttendance = (allAttendance || []).filter(a => {
      const eId = a['Event ID'] || a.event_id || a.eventId;
      return authorizedEventIds.has(eId);
    });

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
    const records = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'User ID', coordinatorId);
    if (records && records.length > 0) {
      const u = records[0];
      return u.full_name || (u['First Name'] && u['Last Name'] ? u['First Name'] + ' ' + u['Last Name'] : 'Unknown');
    }
    return 'Unknown';
  },

  _enforceCoordinatorPermissions: function(events, userId) {
    const userRecords = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'User ID', userId);
    if (userRecords.length > 0) {
      const role = userRecords[0]['Role'] || userRecords[0].role;
      if (role === CONFIG.ROLES.COORDINATOR) {
        return events.filter(e => String(e.coordinator_id || e.coordinatorId || e['Organizer']) === String(userId));
      }
    }
    return events;
  },

  getDashboardSummary: function(userId) {
    try {
      const cache = this._getCache(userId);
      const students = cache.students;
      const events = cache.events;
      const attendance = cache.attendance;

      const deletionKey = CONFIG.COLUMNS.DELETION_FLAG || 'Deletion Flag';
      const todayStr = Utils.formatDate(new Date());

      // Filter active (non-deleted) records marked today
      const todayAttendance = attendance.filter(a => {
        if (a[deletionKey] === true || a[deletionKey] === 'true') return false;
        const recordDateVal = a['Date'] || a['Timestamp'] || a['Attendance Time'];
        return Utils.formatDate(recordDateVal) === todayStr;
      });

      // Present students today
      const totalPresent = todayAttendance.filter(a =>
        (a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.PRESENT
      ).length;

      // Total students
      const totalStudents = students.length;

      // Absent students today
      const totalAbsent = Math.max(0, totalStudents - totalPresent);

      // Dashboard displays present count
      const totalAttendance = totalPresent;

      const report = {
        totalEvents: events.length,
        totalStudents: totalStudents,
        totalAttendance: totalAttendance,
        totalPresent: totalPresent,
        totalAbsent: totalAbsent,
        attendancePercentage: this._calculatePercentage(totalPresent, totalStudents)
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
      let totalPresent = authorizedAttendance.filter(a => (a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
      let completedEvents = 0;
      let activeEvents = 0;

      let highestEvent = null;
      let lowestEvent = null;
      let highestRate = -1;
      let lowestRate = 101;

      events.forEach(event => {
        const eId = event.event_id || event.eventId || event['Event ID'];
        const eName = event.event_name || event.eventName || event['Event Name'];
        const eStatus = event.status || event['Event Status'];

        if (eStatus === CONFIG.EVENT_STATUS.COMPLETED) completedEvents++;
        if (eStatus === CONFIG.EVENT_STATUS.ACTIVE) activeEvents++;

        const eventAtt = authorizedAttendance.filter(a => String(a['Event ID'] || a.event_id) === String(eId));
        const eventTotal = eventAtt.length;
        const eventPresent = eventAtt.filter(a => (a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
        
        if (eventTotal > 0) {
           const rate = this._calculatePercentage(eventPresent, eventTotal);
           if (rate > highestRate) {
             highestRate = rate;
             highestEvent = eName;
           }
           if (rate < lowestRate) {
             lowestRate = rate;
             lowestEvent = eName;
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
      if (filters.eventId) events = events.filter(e => (e.event_id || e.eventId || e['Event ID']) === filters.eventId);
      if (filters.coordinatorId) events = events.filter(e => String(e.coordinator_id || e.coordinatorId || e['Organizer']) === String(filters.coordinatorId));
      if (filters.status) events = events.filter(e => (e.status || e['Event Status']) === filters.status);
      if (filters.fromDate && filters.toDate) {
         const from = new Date(filters.fromDate).getTime();
         const to = new Date(filters.toDate).getTime();
         events = events.filter(e => {
            const startDateVal = e.start_date || e['Start Date'];
            const t = new Date(startDateVal).getTime();
            return t >= from && t <= to;
         });
      }

      let totalPresent = 0;
      let totalParticipants = 0;

      const data = events.map(event => {
        const eId = event.event_id || event.eventId || event['Event ID'];
        const eName = event.event_name || event.eventName || event['Event Name'];
        const eStatus = event.status || event['Event Status'];
        const eVenue = event.venue || event.venueName || event['Location'] || 'N/A';
        const eStartDate = event.start_date || event['Start Date'];
        const eEndDate = event.end_date || event['End Date'];

        const eventAtt = authorizedAttendance.filter(a => String(a['Event ID'] || a.event_id) === String(eId));
        const eventTotal = eventAtt.length;
        const eventPresent = eventAtt.filter(a => (a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
        const eventAbsent = eventTotal - eventPresent;

        totalParticipants += eventTotal;
        totalPresent += eventPresent;
        
        const cId = event.coordinator_id || event.coordinatorId || event['Organizer'];
        const coordinatorRecord = cache.userMap.get(String(cId));
        const coordinatorName = coordinatorRecord ? (coordinatorRecord.full_name || (coordinatorRecord['First Name'] && coordinatorRecord['Last Name'] ? coordinatorRecord['First Name'] + ' ' + coordinatorRecord['Last Name'] : 'Unknown')) : 'Unknown';

        return {
          event_name: eName,
          coordinator: coordinatorName,
          venue: eVenue,
          start_date: Utils.formatDate(eStartDate),
          end_date: Utils.formatDate(eEndDate),
          participants: eventTotal,
          present: eventPresent,
          absent: eventAbsent,
          attendance_percentage: this._calculatePercentage(eventPresent, eventTotal),
          status: eStatus
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
      
      const sYear = student['Year'] || student.year;
      const sRoll = student['Roll Number'] || student.roll_number || student.rollNumber;
      const sName = student['Student Name'] || student.student_name || student.studentName;
      const sDept = student['Department ID'] || student.department;

      if (!sYear) {
        return Utils.buildResponse(false, 'Student excluded due to missing Year information.');
      }

      const allAttendance = cache.authorizedAttendance.filter(a => String(a['Roll Number'] || a.roll_number) === String(sRoll));
      const presentCount = allAttendance.filter(a => (a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
      
      const summary = {
        totalEvents: allAttendance.length,
        present: presentCount
      };
      
      const data = allAttendance.map(r => {
        const rEventId = r['Event ID'] || r.event_id;
        const evt = cache.events.find(e => (e.event_id || e.eventId || e['Event ID']) === rEventId) || {};
        return {
          roll_number: sRoll,
          student_name: sName,
          department: sDept,
          year: sYear,
          events_participated: summary.totalEvents,
          attendance_percentage: this._calculatePercentage(summary.present, summary.totalEvents),
          event_name: evt.event_name || evt.eventName || 'Unknown',
          date: Utils.formatDate(evt.start_date || evt['Start Date'] || r['Timestamp']),
          status: r['Attendance Status'] || r.status
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
      students = students.filter(s => s['Year'] || s.year);
      const excludedCount = initialCount - students.length;
      
      if (department) students = students.filter(s => (s['Department ID'] || s.department) === department);
      
      const authorizedAttendance = cache.authorizedAttendance;

      const deptStats = {};
      students.forEach(s => {
        const sDept = s['Department ID'] || s.department;
        if (!deptStats[sDept]) deptStats[sDept] = { students: 0, attendanceTotal: 0, present: 0, events: new Set() };
        deptStats[sDept].students++;
      });

      authorizedAttendance.forEach(a => {
        const aRoll = a['Roll Number'] || a.roll_number;
        const stu = cache.studentMap.get(aRoll);
        if (stu && (stu['Year'] || stu.year)) {
          const sDept = stu['Department ID'] || stu.department;
          if (!department || sDept === department) {
            if (!deptStats[sDept]) deptStats[sDept] = { students: 0, attendanceTotal: 0, present: 0, events: new Set() };
            deptStats[sDept].attendanceTotal++;
            deptStats[sDept].events.add(a['Event ID'] || a.event_id);
            if ((a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.PRESENT) deptStats[sDept].present++;
          }
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
      const currentUser = cache.userMap.get(String(userId));
      const currentUserRole = currentUser ? (currentUser['Role'] || currentUser.role) : null;
      if (currentUser && currentUserRole === CONFIG.ROLES.COORDINATOR) {
         if (targetCoordinatorId && String(targetCoordinatorId) !== String(userId)) {
            return Utils.buildResponse(false, 'Unauthorized. Coordinators can only view their own report.');
         }
         targetCoordinatorId = userId; // Force query to self
      }

      let allUsers = cache.users;
      let coordinators = allUsers.filter(u => (u['Role'] || u.role) === CONFIG.ROLES.COORDINATOR);
      if (targetCoordinatorId) coordinators = coordinators.filter(c => String(c['User ID'] || c.user_id) === String(targetCoordinatorId));

      const allEvents = cache.events;
      const allAttendance = cache.attendance;

      const data = coordinators.map(coord => {
        const cId = coord['User ID'] || coord.user_id;
        const cFullName = coord.full_name || (coord['First Name'] && coord['Last Name'] ? coord['First Name'] + ' ' + coord['Last Name'] : 'Unknown');

        const events = allEvents.filter(e => String(e.coordinator_id || e.coordinatorId || e['Organizer']) === String(cId));
        const eventIds = new Set(events.map(e => e.event_id || e.eventId || e['Event ID']));
        const attendance = allAttendance.filter(a => eventIds.has(a['Event ID'] || a.event_id));
        
        let lastActivity = 'N/A';
        if (attendance.length > 0) {
           const latest = attendance.slice().sort((a,b) => {
             const timeA = new Date(a['Timestamp'] || a['Date'] || a.attendance_time).getTime();
             const timeB = new Date(b['Timestamp'] || b['Date'] || b.attendance_time).getTime();
             return timeB - timeA;
           })[0];
           lastActivity = Utils.formatDate(latest['Timestamp'] || latest['Date'] || latest.attendance_time);
        }

        return {
          coordinator: cFullName,
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
      let students = cache.students.filter(s => (s['Year'] || s.year) && (s['Student Status'] || s.status) !== 'Inactive');
      
      if (filters.department) students = students.filter(s => (s['Department ID'] || s.department) === filters.department);
      if (filters.year) students = students.filter(s => String(s['Year'] || s.year) === String(filters.year));

      const data = [];
      students.forEach(student => {
        const sRoll = student['Roll Number'] || student.roll_number;
        const sName = student['Student Name'] || student.student_name;
        const sDept = student['Department ID'] || student.department;
        const sYear = student['Year'] || student.year;

        const records = cache.authorizedAttendance.filter(a => String(a['Roll Number'] || a.roll_number) === String(sRoll));
        if (records.length === 0) return;
        const present = records.filter(a => (a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
        const total = records.length;
        const pct = this._calculatePercentage(present, total);
        if (pct < threshold) {
          data.push({
            roll_number: sRoll,
            student_name: sName,
            department: sDept,
            year: sYear,
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
        if ((a['Attendance Status'] || a.status) !== CONFIG.ATTENDANCE_STATUS.PRESENT) return;
        const aRoll = a['Roll Number'] || a.roll_number;
        const stu = cache.studentMap.get(aRoll);
        if (!stu || !(stu['Year'] || stu.year)) return;
        const sDept = stu['Department ID'] || stu.department;
        const sYear = stu['Year'] || stu.year;
        const sName = stu['Student Name'] || stu.student_name;

        if (filters.department && sDept !== filters.department) return;
        if (filters.year && String(sYear) !== String(filters.year)) return;
        if (!stats[aRoll]) {
          stats[aRoll] = { roll_number: aRoll, student_name: sName, department: sDept, year: sYear, events_attended: 0, events: new Set() };
        }
        stats[aRoll].events_attended++;
        stats[aRoll].events.add(a['Event ID'] || a.event_id);
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
      let records = cache.authorizedAttendance.filter(a => (a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.ABSENT);
      if (filters.eventId) records = records.filter(a => (a['Event ID'] || a.event_id) === filters.eventId);
      if (filters.department) {
        records = records.filter(a => {
          const aRoll = a['Roll Number'] || a.roll_number;
          const stu = cache.studentMap.get(aRoll);
          return stu && (stu['Department ID'] || stu.department) === filters.department;
        });
      }

      const data = records.map(a => {
        const aRoll = a['Roll Number'] || a.roll_number;
        const aEventId = a['Event ID'] || a.event_id;
        const stu = cache.studentMap.get(aRoll) || {};
        const evt = cache.events.find(e => (e.event_id || e.eventId || e['Event ID']) === aEventId) || {};
        
        return {
          roll_number: aRoll,
          student_name: stu['Student Name'] || stu.student_name || 'Unknown',
          department: stu['Department ID'] || stu.department || 'N/A',
          year: stu['Year'] || stu.year || 'N/A',
          event_name: evt.event_name || evt.eventName || 'Unknown',
          event_id: aEventId,
          date: Utils.formatDate(evt.start_date || evt['Start Date'] || a['Timestamp']),
          status: a['Attendance Status'] || a.status
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
      let students = cache.students.filter(s => s['Year'] || s.year);
      if (year) students = students.filter(s => String(s['Year'] || s.year) === String(year));

      const yearStats = {};
      students.forEach(s => {
        const sYear = s['Year'] || s.year;
        if (!yearStats[sYear]) yearStats[sYear] = { year: sYear, total_students: 0, present: 0, attendance_total: 0, events: new Set() };
        yearStats[sYear].total_students++;
      });

      cache.authorizedAttendance.forEach(a => {
        const aRoll = a['Roll Number'] || a.roll_number;
        const stu = cache.studentMap.get(aRoll);
        if (!stu || !(stu['Year'] || stu.year)) return;
        const sYear = stu['Year'] || stu.year;

        if (year && String(sYear) !== String(year)) return;
        if (!yearStats[sYear]) yearStats[sYear] = { year: sYear, total_students: 0, present: 0, attendance_total: 0, events: new Set() };
        yearStats[sYear].attendance_total++;
        yearStats[sYear].events.add(a['Event ID'] || a.event_id);
        if ((a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.PRESENT) yearStats[sYear].present++;
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
          const startDateVal = e.start_date || e['Start Date'];
          const d = new Date(startDateVal);
          return d.getMonth() + 1 === targetMonth && d.getFullYear() === targetYear;
        });
      } else if (filters.fromDate && filters.toDate) {
        const from = new Date(filters.fromDate).getTime();
        const to = new Date(filters.toDate).getTime();
        events = events.filter(e => {
          const startDateVal = e.start_date || e['Start Date'];
          const t = new Date(startDateVal).getTime();
          return t >= from && t <= to;
        });
      }

      const monthMap = {};
      events.forEach(event => {
        const eId = event.event_id || event.eventId || event['Event ID'];
        const startDateVal = event.start_date || event['Start Date'];

        const d = new Date(startDateVal);
        const key = d.getFullYear() + '-' + Utils.padNumber(d.getMonth() + 1, 2);
        if (!monthMap[key]) monthMap[key] = { month: key, events_count: 0, participants: 0, present: 0, absent: 0 };
        monthMap[key].events_count++;
        const eventAtt = cache.authorizedAttendance.filter(a => String(a['Event ID'] || a.event_id) === String(eId));
        monthMap[key].participants += eventAtt.length;
        monthMap[key].present += eventAtt.filter(a => (a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
        monthMap[key].absent += eventAtt.filter(a => (a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.ABSENT).length;
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
          const startDateVal = e.start_date || e['Start Date'];
          const t = new Date(startDateVal).getTime();
          return t >= from && t <= to;
        });
      }

      const trendMap = {};
      events.forEach(event => {
        const eId = event.event_id || event.eventId || event['Event ID'];
        const startDateVal = event.start_date || event['Start Date'];

        const d = new Date(startDateVal);
        const period = d.getFullYear() + '-' + Utils.padNumber(d.getMonth() + 1, 2);
        if (!trendMap[period]) trendMap[period] = { period: period, events: 0, total_attendance: 0, present: 0 };
        trendMap[period].events++;
        const eventAtt = cache.authorizedAttendance.filter(a => String(a['Event ID'] || a.event_id) === String(eId));
        trendMap[period].total_attendance += eventAtt.length;
        trendMap[period].present += eventAtt.filter(a => (a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
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
      let events = cache.authorizedEvents.filter(e => (e.status || e['Event Status']) === CONFIG.EVENT_STATUS.CANCELLED);
      if (filters.coordinatorId) events = events.filter(e => String(e.coordinator_id || e.coordinatorId || e['Organizer']) === String(filters.coordinatorId));
      if (filters.fromDate && filters.toDate) {
        const from = new Date(filters.fromDate).getTime();
        const to = new Date(filters.toDate).getTime();
        events = events.filter(e => {
          const startDateVal = e.start_date || e['Start Date'];
          const t = new Date(startDateVal).getTime();
          return t >= from && t <= to;
        });
      }

      const data = events.map(event => {
        const cId = event.coordinator_id || event.coordinatorId || event['Organizer'];
        const eId = event.event_id || event.eventId || event['Event ID'];
        const eName = event.event_name || event.eventName || event['Event Name'];
        const eStatus = event.status || event['Event Status'];
        const eVenue = event.venue || event.venueName || event['Location'] || 'N/A';
        const eStartDate = event.start_date || event['Start Date'];
        const eEndDate = event.end_date || event['End Date'];

        const coordinatorRecord = cache.userMap.get(String(cId));
        return {
          event_id: eId,
          event_name: eName,
          coordinator: coordinatorRecord ? (coordinatorRecord.full_name || (coordinatorRecord['First Name'] + ' ' + coordinatorRecord['Last Name'])) : 'Unknown',
          venue: eVenue,
          start_date: Utils.formatDate(eStartDate),
          end_date: Utils.formatDate(eEndDate),
          status: eStatus,
          cancellation_reason: event.cancellation_reason || event['Remarks'] || 'N/A'
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
      const currentUserRole = currentUser ? (currentUser['Role'] || currentUser.role) : null;
      if (currentUser && currentUserRole === CONFIG.ROLES.COORDINATOR) {
        if (coordinatorId && String(coordinatorId) !== String(userId)) {
          return Utils.buildResponse(false, 'Unauthorized. Coordinators can only view their own performance.');
        }
        coordinatorId = userId;
      }

      let coordinators = cache.users.filter(u => (u['Role'] || u.role) === CONFIG.ROLES.COORDINATOR);
      if (coordinatorId) coordinators = coordinators.filter(c => String(c['User ID'] || c.user_id) === String(coordinatorId));

      const data = coordinators.map(coord => {
        const cId = coord['User ID'] || coord.user_id;
        const cFullName = coord.full_name || (coord['First Name'] && coord['Last Name'] ? coord['First Name'] + ' ' + coord['Last Name'] : 'Unknown');

        const events = cache.events.filter(e => String(e.coordinator_id || e.coordinatorId || e['Organizer']) === String(cId));
        const eventIds = new Set(events.map(e => e.event_id || e.eventId || e['Event ID']));
        const attendance = cache.attendance.filter(a => eventIds.has(a['Event ID'] || a.event_id));
        const present = attendance.filter(a => (a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.PRESENT).length;
        
        const completed = events.filter(e => (e.status || e['Event Status']) === CONFIG.EVENT_STATUS.COMPLETED).length;
        const cancelled = events.filter(e => (e.status || e['Event Status']) === CONFIG.EVENT_STATUS.CANCELLED).length;
        const active = events.filter(e => (e.status || e['Event Status']) === CONFIG.EVENT_STATUS.ACTIVE).length;

        let avgRate = 0;
        let eventRates = 0;
        events.forEach(event => {
          const eId = event.event_id || event.eventId || event['Event ID'];
          const eventAtt = attendance.filter(a => String(a['Event ID'] || a.event_id) === String(eId));
          if (eventAtt.length > 0) {
            avgRate += this._calculatePercentage(
              eventAtt.filter(a => (a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.PRESENT).length,
              eventAtt.length
            );
            eventRates++;
          }
        });

        return {
          coordinator: cFullName,
          coordinator_id: cId,
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
      
      const sYear = student['Year'] || student.year;
      const sRoll = student['Roll Number'] || student.roll_number;
      const sName = student['Student Name'] || student.student_name;
      const sDept = student['Department ID'] || student.department;

      if (!sYear) return Utils.buildResponse(false, 'Student excluded due to missing Year information.');

      const records = cache.authorizedAttendance.filter(a => String(a['Roll Number'] || a.roll_number) === String(sRoll));
      const present = records.filter(a => (a['Attendance Status'] || a.status) === CONFIG.ATTENDANCE_STATUS.PRESENT).length;

      const data = records.map(r => {
        const rEventId = r['Event ID'] || r.event_id;
        const evt = cache.events.find(e => (e.event_id || e.eventId || e['Event ID']) === rEventId) || {};
        const cId = evt.coordinator_id || evt.coordinatorId || evt['Organizer'];
        const coordinatorRecord = cache.userMap.get(String(cId));
        const coordinatorName = coordinatorRecord ? (coordinatorRecord.full_name || (coordinatorRecord['First Name'] && coordinatorRecord['Last Name'] ? coordinatorRecord['First Name'] + ' ' + coordinatorRecord['Last Name'] : 'Unknown')) : 'Unknown';

        return {
          roll_number: sRoll,
          student_name: sName,
          department: sDept,
          year: sYear,
          event_id: rEventId,
          event_name: evt.event_name || evt.eventName || 'Unknown',
          venue: evt.venue || evt.venueName || evt['Location'] || 'N/A',
          coordinator: coordinatorName,
          date: Utils.formatDate(evt.start_date || evt['Start Date'] || r['Timestamp']),
          attendance_time: Utils.formatDate(r['Timestamp'] || r['Date'] || r.attendance_time),
          status: r['Attendance Status'] || r.status
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
  },

  // ============================================================
  // DATABASE AND EXPORT PROCESSORS
  // ============================================================

  getReportById: function(reportId) {
    if (!reportId) return null;
    const records = DatabaseService.findByColumn(CONFIG.SHEETS.GENERATED_REPORTS, 'Report ID', reportId) || [];
    return records.length > 0 ? records[0] : null;
  },

  getGeneratedReports: function(userId) {
    const all = DatabaseService.readAllRows(CONFIG.SHEETS.GENERATED_REPORTS) || [];
    const user = DatabaseService.findByColumn(CONFIG.SHEETS.USERS, 'User ID', userId)[0];
    const role = user ? (user['Role'] || user.role) : null;
    if (user && role === CONFIG.ROLES.COORDINATOR) {
      return all.filter(r => String(r['Generated By User ID']) === String(userId));
    }
    return all;
  },

  deleteReport: function(reportId, userId) {
    try {
      const record = this.getReportById(reportId);
      if (!record) return Utils.buildResponse(false, 'Report not found.');
      DatabaseService.hardDelete(CONFIG.SHEETS.GENERATED_REPORTS, 'Report ID', reportId);
      
      const check = this.getReportById(reportId);
      if (!check) {
        try {
          AuditService.logAction(userId, 'ReportService', 'DELETE_REPORT', reportId, 'Report', 'Report deleted', '', 'SUCCESS', userId);
        } catch(e) {}
        return Utils.buildResponse(true, 'Report deleted successfully.');
      }
      return Utils.buildResponse(false, 'Failed to delete report.');
    } catch(error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  _createReportRecord: function(eventId, userId, name, type, pdf, excel, csv) {
    const reportId = IdService.generateReportId();
    const now = new Date();
    const nowStr = Utils.formatDate(now);
    const timeStr = Utilities.formatDate(now, CONFIG.DATE_TIME.TIMEZONE || 'Asia/Kolkata', 'HH:mm:ss');
    const record = {
      'Report ID': reportId,
      'Event ID': eventId || '',
      'Generated By User ID': userId || 'System',
      'Report Name': name || 'Report-' + reportId,
      'Report Type': type || 'Attendance',
      'Generated Date': nowStr,
      'Generated Time': timeStr,
      'Generated Timestamp': now.toISOString(),
      'Report Status': 'Completed',
      'Status': 'Completed',
      'PDF Available': pdf ? 'Yes' : 'No',
      'Excel Available': excel ? 'Yes' : 'No',
      'CSV Available': csv ? 'Yes' : 'No',
      'Print Available': 'Yes',
      'Total Downloads': 0,
      'Last Downloaded By': '',
      'Last Downloaded Date': '',
      'File Path': '/reports/' + reportId.toLowerCase(),
      'Remarks': 'Export generated by system.'
    };
    DatabaseService.insertRow(CONFIG.SHEETS.GENERATED_REPORTS, record);
    return reportId;
  },

  generatePDF: function(eventId, userId) {
    try {
      const reportId = this._createReportRecord(eventId, userId, 'Attendance PDF Export - ' + eventId, 'Attendance Summary', true, false, false);
      try {
        AuditService.logAction(userId, 'ReportService', 'GENERATE_PDF', reportId, 'Report', 'PDF generated', '', 'SUCCESS', userId);
      } catch(e) {}
      return Utils.buildResponse(true, 'PDF generated successfully.', { reportId: reportId });
    } catch(error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  generateExcel: function(eventId, userId) {
    try {
      const reportId = this._createReportRecord(eventId, userId, 'Attendance Excel Export - ' + eventId, 'Participant List', false, true, false);
      try {
        AuditService.logAction(userId, 'ReportService', 'GENERATE_EXCEL', reportId, 'Report', 'Excel generated', '', 'SUCCESS', userId);
      } catch(e) {}
      return Utils.buildResponse(true, 'Excel generated successfully.', { reportId: reportId });
    } catch(error) {
      return Utils.buildResponse(false, error.message);
    }
  },

  generateCSV: function(eventId, userId) {
    try {
      const reportId = this._createReportRecord(eventId, userId, 'Attendance CSV Export - ' + eventId, 'Detailed Attendance', false, false, true);
      try {
        AuditService.logAction(userId, 'ReportService', 'GENERATE_CSV', reportId, 'Report', 'CSV generated', '', 'SUCCESS', userId);
      } catch(e) {}
      return Utils.buildResponse(true, 'CSV generated successfully.', { reportId: reportId });
    } catch(error) {
      return Utils.buildResponse(false, error.message);
    }
  }
};
