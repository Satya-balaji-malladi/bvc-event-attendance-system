/**
 * Service for handling student management.
 * Responsibilities: CRUD operations for students and filtering/searching.
 */
const StudentService = {

  /**
   * Creates a new student.
   * @param {object} studentData 
   * @returns {object} Standard response object.
   */
  createStudent: function(studentData) {
    const validationResult = ValidationService.validateStudent(studentData);
    if (!validationResult.valid) {
      return Utils.buildResponse(false, validationResult.errors.join(' '));
    }

    const studentsSheet = CONFIG.SHEETS.STUDENTS;
    const rollNumber = studentData.roll_number ? studentData.roll_number.toUpperCase() : '';

    if (DatabaseService.exists(studentsSheet, 'roll_number', rollNumber)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.ROLL_NUMBER_EXISTS || 'Roll number already exists.');
    }

    const newStudent = {
      roll_number: rollNumber,
      student_name: studentData.student_name,
      department: studentData.department ? studentData.department.toUpperCase() : '',
      year: studentData.year,
      section: studentData.section ? studentData.section.toUpperCase() : '',
      status: studentData.status || (CONFIG.STUDENT_STATUS ? CONFIG.STUDENT_STATUS.ACTIVE : 'Active')
    };

    const success = DatabaseService.insertRow(studentsSheet, newStudent);
    if (success) {
      return Utils.buildResponse(true, CONFIG.MESSAGES.STUDENT_CREATED || 'Student created successfully.', { student: newStudent });
    }
    return Utils.buildResponse(false, CONFIG.MESSAGES.STUDENT_CREATE_FAILED || 'Failed to create student in database.');
  },

  /**
   * Updates an existing student.
   * @param {string} rollNumber 
   * @param {object} studentData 
   * @returns {object} Standard response object.
   */
  updateStudent: function(rollNumber, studentData) {
    const studentsSheet = CONFIG.SHEETS.STUDENTS;
    const searchRollNumber = rollNumber ? rollNumber.toUpperCase() : '';
    
    if (!DatabaseService.exists(studentsSheet, 'roll_number', searchRollNumber)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.STUDENT_NOT_FOUND || 'Student not found.');
    }

    const existingRecords = DatabaseService.findByColumn(studentsSheet, 'roll_number', searchRollNumber);
    const existingStudent = existingRecords[0];

    // Merge existing data with new data for validation
    const updatedStudent = Object.assign({}, existingStudent, studentData);

    const validationResult = ValidationService.validateStudent(updatedStudent);
    if (!validationResult.valid) {
      return Utils.buildResponse(false, validationResult.errors.join(' '));
    }

    if (studentData.roll_number) {
      studentData.roll_number = studentData.roll_number.toUpperCase();
    }
    if (studentData.department) {
      studentData.department = studentData.department.toUpperCase();
    }
    if (studentData.section) {
      studentData.section = studentData.section.toUpperCase();
    }

    if (studentData.roll_number && studentData.roll_number !== existingStudent.roll_number) {
      if (DatabaseService.exists(studentsSheet, 'roll_number', studentData.roll_number)) {
        return Utils.buildResponse(false, CONFIG.MESSAGES.ROLL_NUMBER_EXISTS || 'Roll number already exists.');
      }
    }

    const success = DatabaseService.updateRow(studentsSheet, 'roll_number', searchRollNumber, studentData);
    if (success) {
      return Utils.buildResponse(true, CONFIG.MESSAGES.STUDENT_UPDATED || 'Student updated successfully.', { student: Object.assign({}, existingStudent, studentData) });
    }
    return Utils.buildResponse(false, CONFIG.MESSAGES.STUDENT_UPDATE_FAILED || 'Failed to update student in database.');
  },

  /**
   * Deletes a student.
   * @param {string} rollNumber 
   * @returns {object} Standard response object.
   */
  deleteStudent: function(rollNumber) {
    const studentsSheet = CONFIG.SHEETS.STUDENTS;
    const searchRollNumber = rollNumber ? rollNumber.toUpperCase() : '';
    
    if (!DatabaseService.exists(studentsSheet, 'roll_number', searchRollNumber)) {
      return Utils.buildResponse(false, CONFIG.MESSAGES.STUDENT_NOT_FOUND || 'Student not found.');
    }

    const success = DatabaseService.deleteRow(studentsSheet, 'roll_number', searchRollNumber);
    if (success) {
      return Utils.buildResponse(true, CONFIG.MESSAGES.STUDENT_DELETED || 'Student deleted successfully.');
    }
    return Utils.buildResponse(false, CONFIG.MESSAGES.STUDENT_DELETE_FAILED || 'Failed to delete student.');
  },

  /**
   * Gets a student by Roll Number.
   * @param {string} rollNumber 
   * @returns {object|null} The student object or null.
   */
  getStudentByRollNumber: function(rollNumber) {
    if (!rollNumber) return null;
    const records = DatabaseService.findByColumn(CONFIG.SHEETS.STUDENTS, 'roll_number', rollNumber.toUpperCase());
    return records.length > 0 ? records[0] : null;
  },

  /**
   * Gets all students.
   * @returns {object[]} Array of all student objects.
   */
  getAllStudents: function() {
    try {
      return DatabaseService.readAllRows(CONFIG.SHEETS.STUDENTS);
    } catch(e) {
      return [{ roll_number: "ERR", student_name: "BACKEND ERROR: " + e.message, department: "ERR", year: 1 }];
    }
  },

  /**
   * Searches students by keyword (Roll Number, Student Name).
   * @param {string} keyword 
   * @returns {object[]} Array of matching student objects.
   */
  searchStudents: function(keyword) {
    if (Utils.checkEmptyValue(keyword)) return [];
    
    const records = DatabaseService.readAllRows(CONFIG.SHEETS.STUDENTS);
    const lowerKeyword = keyword.toLowerCase();
    
    return records.filter(student => {
      return (student.roll_number && student.roll_number.toLowerCase().includes(lowerKeyword)) ||
             (student.student_name && student.student_name.toLowerCase().includes(lowerKeyword));
    });
  },

  /**
   * Gets students by Department.
   * @param {string} department 
   * @returns {object[]} Array of student objects in the specified department.
   */
  getStudentsByDepartment: function(department) {
    if (!department) return [];
    return DatabaseService.findByColumn(CONFIG.SHEETS.STUDENTS, 'department', department.toUpperCase());
  },

  /**
   * Gets students by Year.
   * @param {number|string} year 
   * @returns {object[]} Array of student objects in the specified year.
   */
  getStudentsByYear: function(year) {
    return DatabaseService.findByColumn(CONFIG.SHEETS.STUDENTS, 'year', String(year));
  },

  /**
   * Gets students by Section.
   * @param {string} section 
   * @returns {object[]} Array of student objects in the specified section.
   */
  getStudentsBySection: function(section) {
    if (!section) return [];
    return DatabaseService.findByColumn(CONFIG.SHEETS.STUDENTS, 'section', section.toUpperCase());
  }

};
