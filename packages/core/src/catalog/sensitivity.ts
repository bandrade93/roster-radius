/**
 * Sensitivity classes and their default weights.
 *
 * The weight says how much harm the exposure of one field can cause to one
 * person, on a 1 to 5 scale. It is the "data field sensitivity" factor of
 * NIST SP 800-122; the number of people exposed is applied separately by the
 * exposure formula (`exposure/formula.ts`).
 *
 * These weights are a starting hypothesis, to be validated with district
 * technology leaders and privacy experts (methodology task 1.2.9). Districts
 * can override them; reports always state which weights were used.
 */
export const SENSITIVITY_CLASSES = {
  organizational: {
    weight: 1,
    label: 'Organizational',
    description: 'School, grade, class and staff role data. Reveals little about a person on its own.',
  },
  identifier: {
    weight: 3,
    label: 'Identifiers and contact',
    description:
      'Names, IDs, usernames, email and phone. Identifies a person and enables phishing and impersonation.',
  },
  academic: {
    weight: 3,
    label: 'Academic and activity',
    description: 'Grades, assessments, attendance, student work and in-app activity.',
  },
  birth: {
    weight: 4,
    label: 'Date and place of birth',
    description:
      'Combined with a name, it is a common key for identity theft. FERPA lists it among indirect identifiers.',
  },
  demographic: {
    weight: 4,
    label: 'Demographic',
    description: 'Gender, race, ethnicity, home language and residence status. Can enable discrimination.',
  },
  behavioral: {
    weight: 4,
    label: 'Behavior and expression',
    description:
      'Discipline records, survey responses and messages. Can expose personal beliefs, conflicts or wellbeing.',
  },
  credential: {
    weight: 5,
    label: 'Credentials',
    description: 'Passwords. Exposure gives direct access to accounts.',
  },
  special_status: {
    weight: 5,
    label: 'Special status',
    description:
      'Disability, special education, Section 504, English learner, meal eligibility, health and living situation. Protected by specific federal rules, such as IDEA and the National School Lunch Act.',
  },
  location: {
    weight: 5,
    label: 'Location',
    description: 'Home address and transportation details. Can lead to a child being found physically.',
  },
} as const;

export type SensitivityClass = keyof typeof SENSITIVITY_CLASSES;
