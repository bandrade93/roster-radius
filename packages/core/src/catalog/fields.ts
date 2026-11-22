import type { FieldDefinition } from './types.js';

/**
 * The field catalog, v0.1.
 *
 * One entry per fact, not per column: OneRoster splits race into six true/false
 * columns while Clever uses one `Race` column, and both map to `student.race`.
 *
 * Sources for the column names:
 * - OneRoster 1.1.1 CSV Tables (1EdTech): users, demographics, orgs, classes, enrollments.
 * - Clever SFTP upload specification v2.1.1: schools, students, teachers, sections, enrollments, staff.
 * - Clever Data API v3.0 and v3.1, `roles.student.*` user fields.
 * - `common`: spellings often seen in exports from student information systems.
 *
 * Sensitivity classes and weights are defined in `sensitivity.ts`.
 */
export const FIELDS = [
  // ── Student: identifiers and name ──────────────────────────────────────
  {
    key: 'student.sis_id',
    subject: 'student',
    label: 'Student ID (district system)',
    sensitivity: 'identifier',
    exhibitB: 'Student Identifiers',
    aliases: {
      common: ['ID', 'Student ID', 'StudentID', 'SIS ID', 'Local ID', 'Local Student ID'],
      oneroster: ['users.sourcedId'],
      cleverCsv: ['students.Student id'],
      cleverApi: ['roles.student.sis_id'],
    },
  },
  {
    key: 'student.student_number',
    subject: 'student',
    label: 'Student number',
    sensitivity: 'identifier',
    exhibitB: 'Student Identifiers',
    aliases: {
      oneroster: ['users.identifier'],
      cleverCsv: ['students.Student number'],
      cleverApi: ['roles.student.student_number'],
    },
  },
  {
    key: 'student.state_id',
    subject: 'student',
    label: 'State student ID',
    sensitivity: 'identifier',
    exhibitB: 'Student Identifiers',
    aliases: {
      common: ['SSID', 'State ID', 'State Student ID'],
      cleverCsv: ['students.State id'],
      cleverApi: ['roles.student.state_id'],
    },
  },
  {
    key: 'student.other_ids',
    subject: 'student',
    label: 'Other student IDs',
    sensitivity: 'identifier',
    exhibitB: 'Student Identifiers',
    aliases: { oneroster: ['users.userIds'] },
    note: 'OneRoster userIds can carry several identifiers, including a state ID.',
  },
  {
    key: 'student.username',
    subject: 'student',
    label: 'Student username',
    sensitivity: 'identifier',
    exhibitB: 'Student Identifiers',
    aliases: {
      oneroster: ['users.username'],
      cleverCsv: ['students.Username'],
      cleverApi: ['roles.student.credentials.district_username'],
    },
  },
  {
    key: 'student.password',
    subject: 'student',
    label: 'Student password',
    sensitivity: 'credential',
    exhibitB: 'Student Identifiers',
    aliases: {
      oneroster: ['users.password'],
      cleverCsv: ['students.Password'],
    },
    note: 'Exhibit B lists student app passwords under Student Identifiers.',
  },
  {
    key: 'student.first_name',
    subject: 'student',
    label: 'Student first name',
    sensitivity: 'identifier',
    exhibitB: 'Student Name',
    aliases: {
      oneroster: ['users.givenName'],
      cleverCsv: ['students.First name'],
    },
  },
  {
    key: 'student.middle_name',
    subject: 'student',
    label: 'Student middle name',
    sensitivity: 'identifier',
    exhibitB: 'Student Name',
    aliases: {
      oneroster: ['users.middleName'],
      cleverCsv: ['students.Middle name'],
    },
  },
  {
    key: 'student.last_name',
    subject: 'student',
    label: 'Student last name',
    sensitivity: 'identifier',
    exhibitB: 'Student Name',
    aliases: {
      oneroster: ['users.familyName'],
      cleverCsv: ['students.Last name'],
    },
  },
  {
    key: 'student.preferred_name',
    subject: 'student',
    label: 'Student preferred name',
    sensitivity: 'identifier',
    exhibitB: 'Student Name',
    aliases: {
      cleverCsv: [
        'students.Preferred first name',
        'students.Preferred middle name',
        'students.Preferred last name',
      ],
    },
  },

  // ── Student: contact and location ──────────────────────────────────────
  {
    key: 'student.email',
    subject: 'student',
    label: 'Student email',
    sensitivity: 'identifier',
    exhibitB: 'Student Contact Information',
    aliases: {
      oneroster: ['users.email'],
      cleverCsv: ['students.Student email'],
    },
  },
  {
    key: 'student.phone',
    subject: 'student',
    label: 'Student phone',
    sensitivity: 'identifier',
    exhibitB: 'Student Contact Information',
    aliases: { oneroster: ['users.phone', 'users.sms'] },
  },
  {
    key: 'student.address',
    subject: 'student',
    label: 'Student home address',
    sensitivity: 'location',
    exhibitB: 'Student Contact Information',
    aliases: {
      common: ['Home Address', 'Street Address', 'Street', 'Mailing Address'],
      cleverCsv: [
        'students.Student street',
        'students.Student city',
        'students.Student state',
        'students.Student zip',
      ],
      cleverApi: ['roles.student.location'],
    },
  },

  // ── Student: demographics ──────────────────────────────────────────────
  {
    key: 'student.birth_date',
    subject: 'student',
    label: 'Date of birth',
    sensitivity: 'birth',
    exhibitB: 'Demographics',
    aliases: {
      oneroster: ['demographics.birthDate'],
      cleverCsv: ['students.DOB'],
      cleverApi: ['roles.student.dob'],
    },
  },
  {
    key: 'student.birth_place',
    subject: 'student',
    label: 'Place of birth',
    sensitivity: 'birth',
    exhibitB: 'Demographics',
    aliases: {
      oneroster: [
        'demographics.countryOfBirthCode',
        'demographics.stateOfBirthAbbreviation',
        'demographics.cityOfBirth',
      ],
    },
  },
  {
    key: 'student.gender',
    subject: 'student',
    label: 'Gender or sex',
    sensitivity: 'demographic',
    exhibitB: 'Demographics',
    aliases: {
      common: ['Sex'],
      oneroster: ['demographics.sex'],
      cleverCsv: ['students.Gender'],
      cleverApi: ['roles.student.gender'],
    },
  },
  {
    key: 'student.race',
    subject: 'student',
    label: 'Race',
    sensitivity: 'demographic',
    exhibitB: 'Demographics',
    aliases: {
      common: ['Ethnicity', 'Race/Ethnicity', 'Race Ethnicity', 'Federal Race'],
      oneroster: [
        'demographics.americanIndianOrAlaskaNative',
        'demographics.asian',
        'demographics.blackOrAfricanAmerican',
        'demographics.nativeHawaiianOrOtherPacificIslander',
        'demographics.white',
        'demographics.demographicRaceTwoOrMoreRaces',
      ],
      cleverCsv: ['students.Race'],
      cleverApi: ['roles.student.race'],
    },
  },
  {
    key: 'student.hispanic_latino',
    subject: 'student',
    label: 'Hispanic or Latino ethnicity',
    sensitivity: 'demographic',
    exhibitB: 'Demographics',
    aliases: {
      common: ['Hispanic', 'Hispanic/Latino', 'Hispanic or Latino'],
      oneroster: ['demographics.hispanicOrLatinoEthnicity'],
      cleverCsv: ['students.Hispanic Latino'],
      cleverApi: ['roles.student.hispanic_ethnicity'],
    },
  },
  {
    key: 'student.home_language',
    subject: 'student',
    label: 'Home language',
    sensitivity: 'demographic',
    exhibitB: 'Demographics',
    aliases: {
      common: ['Home Language', 'Primary Language', 'Language'],
      cleverCsv: ['students.Home language'],
      cleverApi: ['roles.student.home_language', 'roles.student.home_language_code'],
    },
  },
  {
    key: 'student.residence_status',
    subject: 'student',
    label: 'Public school residence status',
    sensitivity: 'demographic',
    exhibitB: 'Demographics',
    aliases: { oneroster: ['demographics.publicSchoolResidenceStatus'] },
    note: 'Exhibit B has no closer category; Demographics is the nearest fit.',
  },

  // ── Student: enrollment and schedule ───────────────────────────────────
  {
    key: 'student.grade_level',
    subject: 'student',
    label: 'Grade level',
    sensitivity: 'organizational',
    exhibitB: 'Enrollment',
    aliases: {
      common: ['Grade Level', 'Current Grade'],
      oneroster: ['users.grades'],
      cleverCsv: ['students.Grade'],
      cleverApi: ['roles.student.grade'],
    },
  },
  {
    key: 'student.graduation_year',
    subject: 'student',
    label: 'Graduation year',
    sensitivity: 'organizational',
    exhibitB: 'Enrollment',
    aliases: {
      common: ['Graduation Year', 'Grad Year', 'Cohort Year'],
      cleverCsv: ['students.Graduation year'],
      cleverApi: ['roles.student.graduation_year'],
    },
  },
  {
    key: 'student.school',
    subject: 'student',
    label: 'School attended',
    sensitivity: 'organizational',
    exhibitB: 'Enrollment',
    aliases: {
      oneroster: ['users.orgSourcedIds'],
      cleverCsv: ['students.School id'],
    },
  },
  {
    key: 'student.class_enrollments',
    subject: 'student',
    label: 'Classes the student is enrolled in',
    sensitivity: 'organizational',
    exhibitB: 'Schedule',
    aliases: {
      oneroster: ['enrollments.classSourcedId'],
      cleverCsv: ['enrollments.Section id'],
      cleverApi: ['roles.student.enrollments'],
    },
  },
  {
    key: 'student.guardian_links',
    subject: 'student',
    label: 'Links to the student’s guardians',
    sensitivity: 'identifier',
    exhibitB: 'Parent/Guardian ID',
    aliases: { oneroster: ['users.agentSourcedIds'] },
    note: 'Links a student to guardian records; mapped to Parent/Guardian ID.',
  },

  // ── Student: special indicators and programs ───────────────────────────
  {
    key: 'student.ell_status',
    subject: 'student',
    label: 'English learner status',
    sensitivity: 'special_status',
    exhibitB: 'Special Indicator',
    aliases: {
      common: ['ELL', 'LEP', 'EL', 'English Learner', 'EL Status', 'LEP Status'],
      cleverCsv: ['students.Ell status'],
      cleverApi: ['roles.student.ell_status'],
    },
  },
  {
    key: 'student.frl_status',
    subject: 'student',
    label: 'Free or reduced-price lunch status',
    sensitivity: 'special_status',
    exhibitB: 'Special Indicator',
    aliases: {
      common: ['Lunch Status', 'Free/Reduced Lunch', 'Free Reduced Lunch', 'FRL', 'Meal Status', 'Meal Eligibility', 'Lunch Eligibility'],
      cleverCsv: ['students.Frl status'],
      cleverApi: ['roles.student.frl_status'],
    },
  },
  {
    key: 'student.iep_status',
    subject: 'student',
    label: 'Individualized Education Program (IEP) status',
    sensitivity: 'special_status',
    exhibitB: 'Special Indicator',
    aliases: {
      common: ['IEP', 'IEP Status', 'Special Education', 'SPED', 'Special Ed'],
      cleverCsv: ['students.IEP status'],
      cleverApi: ['roles.student.iep_status'],
    },
  },
  {
    key: 'student.disability',
    subject: 'student',
    label: 'Disability status and type',
    sensitivity: 'special_status',
    exhibitB: 'Special Indicator',
    aliases: {
      common: ['Primary Disability', 'Disability Code'],
      cleverCsv: ['students.Disability status', 'students.Disability type'],
      cleverApi: [
        'roles.student.disability.disability_status',
        'roles.student.disability.disability_code',
      ],
    },
  },
  {
    key: 'student.section_504_status',
    subject: 'student',
    label: 'Section 504 plan status',
    sensitivity: 'special_status',
    exhibitB: 'Special Indicator',
    aliases: {
      common: ['504', '504 Plan', 'Section 504'],
      cleverCsv: ['students.Section 504 status'],
      cleverApi: ['roles.student.section_504_status'],
    },
  },
  {
    key: 'student.medical_alerts',
    subject: 'student',
    label: 'Medical alerts and health data',
    sensitivity: 'special_status',
    exhibitB: 'Special Indicator',
    aliases: {
      common: ['Medical Alert', 'Medical Alerts', 'Health Alert', 'Medical Conditions'],},
  },
  {
    key: 'student.living_situation',
    subject: 'student',
    label: 'Living situation (homeless, foster care)',
    sensitivity: 'special_status',
    exhibitB: 'Special Indicator',
    aliases: {
      common: ['Homeless', 'McKinney-Vento'],},
  },
  {
    key: 'student.gifted_status',
    subject: 'student',
    label: 'Gifted status',
    sensitivity: 'academic',
    exhibitB: 'Student Program Membership',
    aliases: {
      common: ['Gifted', 'GT', 'Gifted and Talented'],
      cleverCsv: ['students.Gifted status'],
      cleverApi: ['roles.student.gifted_status'],
    },
    note: 'Treated as program membership; some contracts may list it as a special indicator.',
  },
  {
    key: 'student.program_membership',
    subject: 'student',
    label: 'Academic or extracurricular program membership',
    sensitivity: 'academic',
    exhibitB: 'Student Program Membership',
    aliases: {},
  },

  // ── Student: academic records and activity (declared in the inventory) ─
  {
    key: 'student.gpa',
    subject: 'student',
    label: 'Grade point average',
    sensitivity: 'academic',
    exhibitB: 'Transcript',
    aliases: { cleverCsv: ['students.Unweighted gpa', 'students.Weighted gpa'] },
  },
  {
    key: 'student.course_grades',
    subject: 'student',
    label: 'Course grades',
    sensitivity: 'academic',
    exhibitB: 'Transcript',
    aliases: {},
  },
  {
    key: 'student.assessment_results',
    subject: 'student',
    label: 'Assessment results',
    sensitivity: 'academic',
    exhibitB: 'Assessment',
    aliases: {},
  },
  {
    key: 'student.attendance',
    subject: 'student',
    label: 'Attendance',
    sensitivity: 'academic',
    exhibitB: 'Attendance',
    aliases: {},
  },
  {
    key: 'student.conduct',
    subject: 'student',
    label: 'Conduct and discipline records',
    sensitivity: 'behavioral',
    exhibitB: 'Conduct',
    aliases: {},
  },
  {
    key: 'student.communications',
    subject: 'student',
    label: 'Messages and online communications',
    sensitivity: 'behavioral',
    exhibitB: 'Communications',
    aliases: {},
  },
  {
    key: 'student.work',
    subject: 'student',
    label: 'Student work',
    sensitivity: 'academic',
    exhibitB: 'Student Work',
    aliases: {},
  },
  {
    key: 'student.survey_responses',
    subject: 'student',
    label: 'Survey responses',
    sensitivity: 'behavioral',
    exhibitB: 'Student Survey Responses',
    aliases: {},
  },
  {
    key: 'student.in_app_performance',
    subject: 'student',
    label: 'Performance inside the app',
    sensitivity: 'academic',
    exhibitB: 'Student In App Performance',
    aliases: {},
  },
  {
    key: 'student.app_usage',
    subject: 'student',
    label: 'App usage statistics',
    sensitivity: 'academic',
    exhibitB: 'Application Use Statistics',
    aliases: {},
  },
  {
    key: 'student.device_metadata',
    subject: 'student',
    label: 'Device and network metadata (IP address, cookies)',
    sensitivity: 'identifier',
    exhibitB: 'Application Technology Meta Data',
    aliases: {},
  },
  {
    key: 'student.transportation',
    subject: 'student',
    label: 'Transportation (bus route, stop)',
    sensitivity: 'location',
    exhibitB: 'Transportation',
    aliases: {
      common: ['Bus Route', 'Bus Stop', 'Bus Number', 'Bus'],},
  },

  // ── Guardians and student contacts ─────────────────────────────────────
  {
    key: 'guardian.id',
    subject: 'guardian',
    label: 'Guardian ID',
    sensitivity: 'identifier',
    exhibitB: 'Parent/Guardian ID',
    aliases: {
      oneroster: ['users.sourcedId'],
      cleverCsv: ['students.Contact sis id'],
    },
  },
  {
    key: 'guardian.name',
    subject: 'guardian',
    label: 'Guardian name',
    sensitivity: 'identifier',
    exhibitB: 'Parent/Guardian Name',
    aliases: {
      common: ['Parent Name', 'Guardian Name', 'Parent/Guardian Name'],
      oneroster: ['users.givenName', 'users.middleName', 'users.familyName'],
      cleverCsv: ['students.Contact name'],
    },
  },
  {
    key: 'guardian.relationship',
    subject: 'guardian',
    label: 'Relationship to the student',
    sensitivity: 'identifier',
    exhibitB: 'Parent/Guardian ID',
    aliases: { cleverCsv: ['students.Contact type', 'students.Contact relationship'] },
    note: 'Exhibit B has no category for the relationship itself; Parent/Guardian ID is the nearest fit.',
  },
  {
    key: 'guardian.email',
    subject: 'guardian',
    label: 'Guardian email',
    sensitivity: 'identifier',
    exhibitB: 'Parent/Guardian Contact Information',
    aliases: {
      common: ['Parent Email', 'Guardian Email'],
      oneroster: ['users.email'],
      cleverCsv: ['students.Contact email'],
    },
  },
  {
    key: 'guardian.phone',
    subject: 'guardian',
    label: 'Guardian phone',
    sensitivity: 'identifier',
    exhibitB: 'Parent/Guardian Contact Information',
    aliases: {
      common: ['Parent Phone', 'Guardian Phone'],
      oneroster: ['users.phone', 'users.sms'],
      cleverCsv: ['students.Contact phone', 'students.Contact phone type'],
    },
  },

  // ── Staff (teachers, staff, administrators) ────────────────────────────
  {
    key: 'staff.id',
    subject: 'staff',
    label: 'Staff ID (district system)',
    sensitivity: 'identifier',
    exhibitB: null,
    aliases: {
      common: ['Staff ID', 'Teacher ID', 'Employee ID'],
      oneroster: ['users.sourcedId'],
      cleverCsv: ['teachers.Teacher id', 'staff.Staff id'],
    },
  },
  {
    key: 'staff.staff_number',
    subject: 'staff',
    label: 'Staff number',
    sensitivity: 'identifier',
    exhibitB: null,
    aliases: {
      oneroster: ['users.identifier'],
      cleverCsv: ['teachers.Teacher number'],
    },
  },
  {
    key: 'staff.state_id',
    subject: 'staff',
    label: 'State educator ID',
    sensitivity: 'identifier',
    exhibitB: null,
    aliases: { cleverCsv: ['teachers.State teacher id'] },
  },
  {
    key: 'staff.first_name',
    subject: 'staff',
    label: 'Staff first name',
    sensitivity: 'identifier',
    exhibitB: null,
    aliases: {
      oneroster: ['users.givenName'],
      cleverCsv: ['teachers.First name', 'staff.First name'],
    },
  },
  {
    key: 'staff.middle_name',
    subject: 'staff',
    label: 'Staff middle name',
    sensitivity: 'identifier',
    exhibitB: null,
    aliases: {
      oneroster: ['users.middleName'],
      cleverCsv: ['teachers.Middle name'],
    },
  },
  {
    key: 'staff.last_name',
    subject: 'staff',
    label: 'Staff last name',
    sensitivity: 'identifier',
    exhibitB: null,
    aliases: {
      oneroster: ['users.familyName'],
      cleverCsv: ['teachers.Last name', 'staff.Last name'],
    },
  },
  {
    key: 'staff.full_name',
    subject: 'staff',
    label: 'Staff full name',
    sensitivity: 'identifier',
    exhibitB: null,
    aliases: { cleverCsv: ['schools.Principal'] },
  },
  {
    key: 'staff.email',
    subject: 'staff',
    label: 'Staff email',
    sensitivity: 'identifier',
    exhibitB: null,
    aliases: {
      oneroster: ['users.email'],
      cleverCsv: ['teachers.Teacher email', 'staff.Staff email', 'schools.Principal email'],
    },
  },
  {
    key: 'staff.phone',
    subject: 'staff',
    label: 'Staff phone',
    sensitivity: 'identifier',
    exhibitB: null,
    aliases: { oneroster: ['users.phone', 'users.sms'] },
  },
  {
    key: 'staff.username',
    subject: 'staff',
    label: 'Staff username',
    sensitivity: 'identifier',
    exhibitB: null,
    aliases: {
      oneroster: ['users.username'],
      cleverCsv: ['teachers.Username', 'staff.Username'],
    },
  },
  {
    key: 'staff.password',
    subject: 'staff',
    label: 'Staff password',
    sensitivity: 'credential',
    exhibitB: null,
    aliases: {
      oneroster: ['users.password'],
      cleverCsv: ['teachers.Password', 'staff.Password'],
    },
  },
  {
    key: 'staff.title',
    subject: 'staff',
    label: 'Job title',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: { cleverCsv: ['teachers.Title', 'staff.Title'] },
  },
  {
    key: 'staff.department',
    subject: 'staff',
    label: 'Department',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: { cleverCsv: ['staff.Department'] },
  },
  {
    key: 'staff.role',
    subject: 'staff',
    label: 'Staff role',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: { cleverCsv: ['staff.Role'] },
  },
  {
    key: 'staff.school',
    subject: 'staff',
    label: 'School where the staff member works',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      oneroster: ['users.orgSourcedIds'],
      cleverCsv: ['teachers.School id', 'staff.School id'],
    },
  },
  {
    key: 'staff.class_assignments',
    subject: 'staff',
    label: 'Classes the staff member teaches',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      oneroster: ['enrollments.classSourcedId'],
      cleverCsv: [
        'sections.Teacher id',
        ...Array.from({ length: 9 }, (_, i) => `sections.Teacher ${i + 2} id`),
      ],
    },
  },

  // ── Schools ────────────────────────────────────────────────────────────
  {
    key: 'school.id',
    subject: 'school',
    label: 'School ID',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      oneroster: ['orgs.sourcedId'],
      cleverCsv: ['schools.School id'],
    },
    note: 'Describes the school, not a student. It becomes student data only through student.school.',
  },
  {
    key: 'school.name',
    subject: 'school',
    label: 'School name',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      oneroster: ['orgs.name'],
      cleverCsv: ['schools.School name'],
    },
  },
  {
    key: 'school.number',
    subject: 'school',
    label: 'School number',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      oneroster: ['orgs.identifier'],
      cleverCsv: ['schools.School number'],
    },
  },
  {
    key: 'school.state_id',
    subject: 'school',
    label: 'State school ID',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: { cleverCsv: ['schools.State id'] },
  },
  {
    key: 'school.contact',
    subject: 'school',
    label: 'School address and phone',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      cleverCsv: [
        'schools.School address',
        'schools.School city',
        'schools.School state',
        'schools.School zip',
        'schools.School phone',
      ],
    },
  },
  {
    key: 'school.grade_range',
    subject: 'school',
    label: 'Grades served',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: { cleverCsv: ['schools.Low grade', 'schools.High grade'] },
  },

  // ── Sections (classes) ─────────────────────────────────────────────────
  {
    key: 'section.id',
    subject: 'section',
    label: 'Section ID',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      oneroster: ['classes.sourcedId'],
      cleverCsv: ['sections.Section id'],
    },
    note: 'Describes the class. Which students take it is student.class_enrollments.',
  },
  {
    key: 'section.name',
    subject: 'section',
    label: 'Section name',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      oneroster: ['classes.title'],
      cleverCsv: ['sections.Name'],
    },
  },
  {
    key: 'section.number',
    subject: 'section',
    label: 'Section number',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      oneroster: ['classes.classCode'],
      cleverCsv: ['sections.Section number'],
    },
  },
  {
    key: 'section.course',
    subject: 'section',
    label: 'Course',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      oneroster: ['classes.courseSourcedId'],
      cleverCsv: ['sections.Course name', 'sections.Course number', 'sections.Course description'],
    },
  },
  {
    key: 'section.subject',
    subject: 'section',
    label: 'Subject',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      oneroster: ['classes.subjects', 'classes.subjectCodes'],
      cleverCsv: ['sections.Subject'],
    },
  },
  {
    key: 'section.grade',
    subject: 'section',
    label: 'Section grade level',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      oneroster: ['classes.grades'],
      cleverCsv: ['sections.Grade'],
    },
  },
  {
    key: 'section.period',
    subject: 'section',
    label: 'Period',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      oneroster: ['classes.periods'],
      cleverCsv: ['sections.Period'],
    },
  },
  {
    key: 'section.term',
    subject: 'section',
    label: 'Term',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: {
      oneroster: ['classes.termSourcedIds'],
      cleverCsv: ['sections.Term name', 'sections.Term start', 'sections.Term end'],
    },
  },
  {
    key: 'section.location',
    subject: 'section',
    label: 'Room or location',
    sensitivity: 'organizational',
    exhibitB: null,
    aliases: { oneroster: ['classes.location'] },
  },
] as const satisfies readonly FieldDefinition[];

/** Every catalog key, as a type. A typo in a key becomes a compile error. */
export type FieldKey = (typeof FIELDS)[number]['key'];
