import type { FieldKey } from '../catalog/fields.js';

/**
 * What each category of app needs to work.
 *
 * - `needed`: the app cannot do its job without the field.
 * - `conditional`: some apps in the category use it for a legitimate feature
 *   (for example accommodations or translated messages). Flagged for the
 *   district to confirm, not reported as unnecessary.
 * - Any other student, guardian or staff field is not expected for the
 *   category. School and section fields describe organizations, not people,
 *   and are not checked.
 *
 * Built on the data-minimization principle: share only what the app's
 * function requires. These baselines are a first hypothesis, kept
 * conservative to avoid false alarms, and must be reviewed with district
 * technology leaders (methodology task 1.2.9).
 */
export interface CategoryBaseline {
  readonly label: string;
  readonly description: string;
  /**
   * The district's own system of record (SIS). It legitimately holds all
   * fields, so it is excluded from the unnecessary-data check.
   */
  readonly systemOfRecord?: boolean;
  readonly needed: readonly FieldKey[];
  readonly conditional: readonly FieldKey[];
}

/** Teachers sign in and see their classes in almost every app. */
const STAFF_BASICS = [
  'staff.id',
  'staff.first_name',
  'staff.last_name',
  'staff.email',
  'staff.username',
  'staff.school',
  'staff.class_assignments',
] as const satisfies readonly FieldKey[];

/** A student account rostered into classes. */
const STUDENT_ROSTER = [
  'student.sis_id',
  'student.first_name',
  'student.last_name',
  'student.username',
  'student.email',
  'student.school',
  'student.grade_level',
  'student.class_enrollments',
] as const satisfies readonly FieldKey[];

export const APP_CATEGORIES = {
  instructional_content: {
    label: 'Instructional content and practice',
    description: 'Student-facing reading, math, science and practice apps.',
    needed: [...STUDENT_ROSTER, ...STAFF_BASICS, 'student.in_app_performance', 'student.app_usage'],
    conditional: [
      'student.preferred_name',
      'student.student_number',
      'student.ell_status',
      'student.iep_status',
      'student.section_504_status',
      'student.device_metadata',
      'student.work',
    ],
  },
  learning_management: {
    label: 'Learning management system',
    description: 'Course pages, assignments, grading and class messaging.',
    needed: [
      ...STUDENT_ROSTER,
      ...STAFF_BASICS,
      'student.work',
      'student.course_grades',
      'student.assessment_results',
      'student.communications',
      'student.app_usage',
    ],
    conditional: [
      'student.preferred_name',
      'student.student_number',
      'student.attendance',
      'student.iep_status',
      'student.section_504_status',
      'student.guardian_links',
      'guardian.id',
      'guardian.name',
      'guardian.email',
      'student.device_metadata',
    ],
  },
  assessment: {
    label: 'Assessment and screening',
    description: 'Benchmark, screening and test delivery platforms.',
    needed: [...STUDENT_ROSTER, ...STAFF_BASICS, 'student.assessment_results', 'student.student_number'],
    conditional: [
      'student.state_id',
      'student.birth_date',
      'student.gender',
      'student.race',
      'student.hispanic_latino',
      'student.ell_status',
      'student.frl_status',
      'student.iep_status',
      'student.section_504_status',
      'student.disability',
      'student.preferred_name',
    ],
  },
  family_communication: {
    label: 'Family communication',
    description: 'School-to-home messaging, notifications and translation.',
    needed: [
      'student.sis_id',
      'student.first_name',
      'student.last_name',
      'student.school',
      'student.grade_level',
      'student.class_enrollments',
      'student.guardian_links',
      'guardian.id',
      'guardian.name',
      'guardian.relationship',
      'guardian.email',
      'guardian.phone',
      ...STAFF_BASICS,
    ],
    conditional: [
      'student.home_language',
      'student.attendance',
      'student.email',
      'student.phone',
      'student.preferred_name',
      'staff.phone',
    ],
  },
  special_education: {
    label: 'Special education management',
    description: 'IEP and Section 504 plan writing, services and compliance.',
    needed: [
      ...STUDENT_ROSTER,
      ...STAFF_BASICS,
      'student.student_number',
      'student.birth_date',
      'student.iep_status',
      'student.section_504_status',
      'student.disability',
      'student.guardian_links',
      'guardian.id',
      'guardian.name',
      'guardian.relationship',
      'guardian.email',
      'guardian.phone',
    ],
    conditional: [
      'student.state_id',
      'student.gender',
      'student.race',
      'student.hispanic_latino',
      'student.home_language',
      'student.ell_status',
      'student.address',
      'student.medical_alerts',
      'student.assessment_results',
      'student.attendance',
      'student.preferred_name',
    ],
  },
  nutrition: {
    label: 'School nutrition',
    description: 'Cafeteria point of sale and meal accounts.',
    needed: [
      'student.sis_id',
      'student.student_number',
      'student.first_name',
      'student.last_name',
      'student.school',
      'student.grade_level',
      'student.frl_status',
    ],
    conditional: [
      'student.medical_alerts',
      'student.guardian_links',
      'guardian.id',
      'guardian.name',
      'guardian.email',
      'guardian.phone',
      'staff.id',
      'staff.first_name',
      'staff.last_name',
      'staff.email',
      'staff.school',
    ],
  },
  transportation: {
    label: 'Transportation',
    description: 'Bus routing, stop assignment and rider tracking.',
    needed: [
      'student.sis_id',
      'student.first_name',
      'student.last_name',
      'student.school',
      'student.grade_level',
      'student.address',
      'student.transportation',
    ],
    conditional: [
      'student.student_number',
      'student.disability',
      'student.medical_alerts',
      'student.guardian_links',
      'guardian.id',
      'guardian.name',
      'guardian.phone',
      'guardian.email',
    ],
  },
  library: {
    label: 'Library',
    description: 'Library catalog, circulation and e-books.',
    needed: [
      'student.sis_id',
      'student.student_number',
      'student.first_name',
      'student.last_name',
      'student.username',
      'student.email',
      'student.school',
      'student.grade_level',
      ...STAFF_BASICS,
    ],
    conditional: ['student.class_enrollments', 'student.guardian_links', 'guardian.email', 'student.preferred_name'],
  },
  student_information_system: {
    label: 'Student information system',
    description: 'The district’s system of record for student data.',
    systemOfRecord: true,
    needed: [],
    conditional: [],
  },
} as const satisfies Record<string, CategoryBaseline>;

export type AppCategory = keyof typeof APP_CATEGORIES;

/** How a field relates to what an app category needs. */
export type FieldNeed = 'needed' | 'conditional' | 'not_expected' | 'not_checked';

/**
 * Says whether a category of app needs a field.
 *
 * Returns `not_checked` for the system of record and for school and section
 * fields, which describe organizations rather than people.
 */
export function fieldNeed(category: AppCategory, key: FieldKey): FieldNeed {
  const baseline: CategoryBaseline = APP_CATEGORIES[category];
  if (baseline.systemOfRecord) return 'not_checked';
  if (key.startsWith('school.') || key.startsWith('section.')) return 'not_checked';
  if (baseline.needed.includes(key)) return 'needed';
  if (baseline.conditional.includes(key)) return 'conditional';
  return 'not_expected';
}
