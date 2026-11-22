/**
 * Synthetic district generator, v0.1.
 *
 * Builds a complete fictional district: a OneRoster export, Clever
 * "Application Receives" files, an SFTP export, an app inventory and a
 * contracts file. Every name, identifier and date is invented. The output is
 * deterministic: the same seed always gives the same files.
 *
 * The apps are designed so that every alert rule appears at least once, which
 * makes the district useful for tests, demos and the example report.
 *
 * Never use real district or student data in its place (README).
 */

export interface SyntheticOptions {
  /** Seed for the random choices. Default 2026. */
  readonly seed?: number;
}

export interface SyntheticDistrict {
  /** File contents by path, relative to the district folder. */
  readonly files: Readonly<Record<string, string>>;
  /** The "today" the scenario is built around, as YYYY-MM-DD. */
  readonly today: string;
  readonly counts: { readonly students: number; readonly staff: number; readonly schools: number };
}

/** Small, deterministic random number generator (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GIVEN = ['Ava', 'Ben', 'Cora', 'Dev', 'Eli', 'Fia', 'Gus', 'Hana', 'Ivo', 'June', 'Kai', 'Lia', 'Max', 'Nia', 'Oto', 'Pia', 'Quin', 'Rae', 'Sol', 'Tao'];
const FAMILY = ['Sample', 'Fixture', 'Mockwell', 'Testa', 'Placeholder', 'Dummond', 'Fictor', 'Synthe'];

interface School {
  id: string;
  name: string;
  grades: string[];
  perGrade: number;
  teachers: number;
}

const SCHOOLS: School[] = [
  { id: 'org-sch-01', name: 'Synthetic Elementary North', grades: ['KG', '01', '02', '03', '04', '05'], perGrade: 60, teachers: 14 },
  { id: 'org-sch-02', name: 'Synthetic Elementary South', grades: ['KG', '01', '02', '03', '04', '05'], perGrade: 55, teachers: 13 },
  { id: 'org-sch-03', name: 'Synthetic Middle School', grades: ['06', '07', '08'], perGrade: 150, teachers: 22 },
  { id: 'org-sch-04', name: 'Synthetic High School', grades: ['09', '10', '11', '12'], perGrade: 130, teachers: 28 },
];
const DISTRICT = { id: 'org-dist-01', name: 'Synthetic Unified School District' };

const csv = (rows: readonly (readonly (string | number)[])[]): string =>
  rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(',')).join('\n') + '\n';

interface Person {
  sourcedId: string;
  sisId: string;
  given: string;
  family: string;
  school: School;
  grade?: string;
  role: 'student' | 'teacher' | 'administrator' | 'aide';
}

export function generateSyntheticDistrict(options: SyntheticOptions = {}): SyntheticDistrict {
  const rand = random(options.seed ?? 2026);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const people: Person[] = [];
  let n = 0;
  const person = (school: School, role: Person['role'], grade?: string): Person => {
    n++;
    // OneRoster sourcedIds differ from the district's own (SIS) IDs on purpose, as they often do in real exports.
    const p: Person = { sourcedId: `or-u-${String(n).padStart(5, '0')}`, sisId: String(100000 + n), given: pick(GIVEN), family: pick(FAMILY), school, role, ...(grade ? { grade } : {}) };
    people.push(p);
    return p;
  };
  for (const school of SCHOOLS) {
    for (const grade of school.grades) for (let i = 0; i < school.perGrade; i++) person(school, 'student', grade);
    for (let i = 0; i < school.teachers; i++) person(school, 'teacher');
    person(school, 'administrator');
    person(school, 'aide');
  }
  const students = people.filter((p) => p.role === 'student');
  const staff = people.filter((p) => p.role !== 'student');
  const files: Record<string, string> = {};

  // ── OneRoster 1.1 export ────────────────────────────────────────────────
  files['oneroster/manifest.csv'] = csv([
    ['propertyName', 'value'],
    ['manifest.version', '1.0'],
    ['oneroster.version', '1.1'],
    ['file.orgs', 'bulk'],
    ['file.users', 'bulk'],
    ['file.demographics', 'bulk'],
    ['source.systemName', 'Synthetic SIS'],
  ]);
  files['oneroster/orgs.csv'] = csv([
    ['sourcedId', 'status', 'dateLastModified', 'name', 'type', 'identifier', 'parentSourcedId'],
    [DISTRICT.id, '', '', DISTRICT.name, 'district', 'D-001', ''],
    ...SCHOOLS.map((s, i) => [s.id, '', '', s.name, 'school', `S-00${i + 1}`, DISTRICT.id]),
  ]);
  files['oneroster/users.csv'] = csv([
    ['sourcedId', 'status', 'dateLastModified', 'enabledUser', 'orgSourcedIds', 'role', 'username', 'userIds', 'givenName', 'familyName', 'middleName', 'identifier', 'email', 'sms', 'phone', 'agentSourcedIds', 'grades', 'password'],
    ...people.map((p) => [
      p.sourcedId,
      '',
      '',
      'true',
      p.role === 'student' ? p.school.id : `${DISTRICT.id},${p.school.id}`,
      p.role,
      `${p.given}.${p.family}${p.sisId}`.toLowerCase(),
      '',
      p.given,
      p.family,
      '',
      p.sisId,
      `${p.given}.${p.family}${p.sisId}@synthetic.example`.toLowerCase(),
      '',
      '',
      '',
      p.grade ?? '',
      '',
    ]),
  ]);
  // Present in real exports; the OneRoster reader never opens it.
  files['oneroster/demographics.csv'] = csv([
    ['sourcedId', 'status', 'dateLastModified', 'birthDate', 'sex'],
    ...students.map((p) => [p.sourcedId, '', '', `20${String(10 + Math.floor(rand() * 10)).padStart(2, '0')}-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}`, pick(['female', 'male'])]),
  ]);

  // ── Clever "Application Receives" students file for a teacher-requested app ──
  const quizStudents = students.filter((p) => p.school === SCHOOLS[0] && ['03', '04', '05'].includes(p.grade ?? '') && rand() < 0.6);
  files['clever/quizhub/students.csv'] = csv([
    ['School_id', 'Student_id', 'Last_name', 'First_name', 'Grade'],
    ...quizStudents.map((p) => [p.school.id, p.sisId, p.family, p.given, p.grade ?? '']),
  ]);

  // ── SFTP export sent nightly to the math app ────────────────────────────
  const middle = students.filter((p) => p.school === SCHOOLS[2]);
  files['exports/mathpath_students.csv'] = csv([
    ['Student ID', 'First Name', 'Last Name', 'Birth Date', 'Grade', 'School', 'Address', 'Frl Status', 'Locker'],
    ...middle.map((p, i) => [p.sisId, p.given, p.family, '2013-01-01', p.grade ?? '', p.school.name, `${100 + i} Synthetic Ave`, pick(['F', 'R', 'N']), String(i)]),
  ]);

  // ── App inventory ───────────────────────────────────────────────────────
  files['inventory.csv'] = csv([
    ['app', 'vendor', 'channel', 'fields', 'category', 'channel_id', 'students', 'staff', 'schools', 'grades', 'contract_end', 'deletion_days', 'subprocessors', 'notes'],
    ['ReadWell', 'Acme Learning', 'clever', 'student.sis_id|student.first_name|student.last_name|student.grade_level|student.school|student.birth_date|student.iep_status|staff.id|staff.first_name|staff.last_name|staff.email', 'instructional_content', '', 'all', 'teachers', '', 'KG|01|02|03|04|05', '', '', 'CloudHost Inc|TutorAI Labs [ai]', 'Elementary reading'],
    ['MathPath', 'Acme Learning', 'sftp', 'file:exports/mathpath_students.csv', 'instructional_content', '', 'all', '', SCHOOLS[2]!.name, '', '', '', 'CloudHost Inc|TutorAI Labs [ai]', 'Nightly SFTP export'],
    ['LunchLine', 'Food Services Co', 'sftp', 'student.sis_id|student.student_number|student.first_name|student.last_name|student.school|student.grade_level|student.frl_status', 'nutrition', '', 'all', '', '', '', '', '', '', 'Cafeteria point of sale'],
    ['QuizHub', 'QuizHub Inc', 'clever', 'student.first_name|student.last_name|student.email', '', '', 'file:clever/quizhub/students.csv', '', '', '', '', '', 'QuizAnalytics Co', 'Teacher-requested app'],
    ['FamilyTalk', 'Family Messaging LLC', 'manual_upload', 'student.first_name|student.last_name|guardian.name|guardian.phone|guardian.email|student.home_language', 'family_communication', '', 'count:1600', '', '', '', '', '', 'TextRelay Co', 'Uploaded by the front office'],
    ['ClassCloud', 'Classroom Cloud Inc', 'clever', 'student.sis_id|student.first_name|student.last_name|student.email|student.grade_level|student.class_enrollments|staff.id|staff.first_name|staff.last_name|staff.email', 'learning_management', '', 'all', 'teachers', `${SCHOOLS[2]!.name}|${SCHOOLS[3]!.name}`, '', '', '', 'CloudHost Inc|InsightEngine AI [ai]', 'Secondary LMS'],
    ['ShelfScan', 'Library Systems Co', 'sftp', 'student.sis_id|student.first_name|student.last_name|student.username|student.password|student.school', 'library', '', 'all', '', '', '', '', '', '', 'Library circulation'],
    ['RouteRider', 'Transit Apps LLC', 'sftp', 'student.sis_id|student.first_name|student.last_name|student.address|student.transportation|student.school', 'transportation', '', 'all', '', '', '', '2027-08-15', '90', 'MapTiles Inc', 'Bus routing'],
  ]);

  // ── Contracts ───────────────────────────────────────────────────────────
  files['contracts.csv'] = csv([
    ['contract_id', 'vendor', 'apps', 'exhibit_b', 'fields', 'end_date', 'deletion_days', 'agreement', 'source', 'notes'],
    ['ACME-2025', 'Acme Learning', '', 'Student Name|Student Identifiers|Enrollment|Student In App Performance', 'student.birth_date', '2027-06-30', '60', 'ndpa', '', 'Covers every Acme app'],
    ['FOOD-2023', 'Food Services Co', 'LunchLine', 'Student Name|Student Identifiers|Enrollment|Special Indicator', '', '2026-06-30', '30', 'state_dpa', '', 'Renewal pending'],
    ['QUIZ-TOS', 'QuizHub Inc', 'QuizHub', '', '', '', '', 'vendor_terms', '', 'Click-through terms'],
    ['CLOUD-2024', 'Classroom Cloud Inc', '', 'Student Name|Student Identifiers|Enrollment|Schedule|Student Contact Information|Student Work', '', '2026-12-31', '60', 'ndpa', '', 'Up for renewal'],
    ['SHELF-2025', 'Library Systems Co', '', 'Student Name|Student Identifiers|Enrollment', '', '2028-06-30', '30', 'ndpa', '', ''],
  ]);

  // ── Declared list: what the district published on its privacy page ─────
  // Left out on purpose: two vendors (Family Messaging LLC, QuizHub Inc) and
  // some data (Acme's IEP status, meal eligibility and home address; Transit's
  // home address). OldReader Co is still listed, though no app sends it data.
  files['declared.csv'] = csv([
    ['vendor', 'apps', 'exhibit_b', 'fields', 'published_on', 'source', 'notes'],
    ['Acme Learning', '', 'Student Name|Student Identifiers|Enrollment|Demographics', '', '2026-08-15', 'https://www.synthetic-usd.example/privacy', ''],
    ['Food Services Co', 'LunchLine', 'Student Name|Student Identifiers|Enrollment|Special Indicator', '', '2026-08-15', 'https://www.synthetic-usd.example/privacy', ''],
    ['Classroom Cloud Inc', '', 'Student Name|Student Identifiers|Enrollment|Schedule|Student Contact Information', '', '2026-08-15', 'https://www.synthetic-usd.example/privacy', ''],
    ['Library Systems Co', '', 'Student Name|Student Identifiers|Enrollment', '', '2026-08-15', 'https://www.synthetic-usd.example/privacy', ''],
    ['Transit Apps LLC', '', 'Student Name|Student Identifiers|Enrollment', 'student.transportation', '2026-08-15', 'https://www.synthetic-usd.example/privacy', 'Page lists bus stop'],
    ['OldReader Co', '', 'Student Name|Student Identifiers', '', '2026-08-15', 'https://www.synthetic-usd.example/privacy', 'App retired in 2025'],
  ]);

  return {
    files,
    today: '2026-11-17',
    counts: { students: students.length, staff: staff.length, schools: SCHOOLS.length },
  };
}
