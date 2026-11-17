/**
 * State student privacy laws, v0.1: what a district must publish and the
 * deadlines that apply after a breach. Illinois and Colorado first.
 *
 * This is a summary for orientation, not legal advice. Laws change; each entry
 * records when it was last checked against the statute.
 */

export const LEGAL_DISCLAIMER =
  'This is a summary of state law for orientation, not legal advice. Other laws, including federal law and general state breach laws, may also apply. Confirm with the district’s legal counsel.';

export type StateCode = 'IL' | 'CO';

export interface LegalSource {
  readonly title: string;
  readonly url: string;
}

export interface PublicationDuty {
  /** What the district must publish. */
  readonly what: string;
  /** When it must be published or updated. */
  readonly when: string;
  readonly citation: string;
  /**
   * True when the publication describes the student data elements shared,
   * which RosterRadius can compare with the measured flows.
   */
  readonly describesDataElements: boolean;
}

export interface BreachDuty {
  /** Stable ID, such as "il.parent_notice". */
  readonly id: string;
  /** Who must do what. */
  readonly duty: string;
  /** Calendar days allowed, or null when the law sets no fixed number. */
  readonly days: number | null;
  /** The event the days are counted from, or null when there are no days. */
  readonly startsAt: string | null;
  readonly citation: string;
}

export interface StateLaw {
  readonly state: StateCode;
  readonly name: string;
  readonly law: string;
  readonly citation: string;
  readonly publication: readonly PublicationDuty[];
  readonly breach: readonly BreachDuty[];
  readonly notes: readonly string[];
  readonly sources: readonly LegalSource[];
  /** Date the entry was last checked against the statute, as YYYY-MM-DD. */
  readonly lastVerified: string;
}

export const STATE_LAWS: Readonly<Record<StateCode, StateLaw>> = {
  IL: {
    state: 'IL',
    name: 'Illinois',
    law: 'Student Online Personal Protection Act (SOPPA)',
    citation: '105 ILCS 85',
    publication: [
      {
        what: 'A plain-language explanation of each data element of covered information the school collects, maintains or discloses, with its uses, recipients and purposes.',
        when: 'Updated no later than 30 calendar days after the start of each fiscal year and 30 days after the start of each calendar year.',
        citation: '105 ILCS 85/27(a)(1)',
        describesDataElements: true,
      },
      {
        what: 'A list of operators with written agreements, a copy of each agreement and each operator’s business address.',
        when: 'Each agreement posted no later than 10 business days after it is entered into.',
        citation: '105 ILCS 85/27(a)(2), (c)',
        describesDataElements: false,
      },
      {
        what: 'For each operator, the subcontractors that may receive covered information, or a link to the operator’s list.',
        when: 'Updated no later than 30 calendar days after the start of each fiscal year and 30 days after the start of each calendar year.',
        citation: '105 ILCS 85/27(a)(3)',
        describesDataElements: false,
      },
      {
        what: 'How parents can exercise their rights to inspect, correct and delete covered information.',
        when: 'Updated no later than 30 calendar days after the start of each fiscal year and 30 days after the start of each calendar year.',
        citation: '105 ILCS 85/27(a)(4)',
        describesDataElements: false,
      },
      {
        what: 'A list of breaches of covered information, with the number of students affected, the date or date range and, for an operator breach, the operator’s name. A breach affecting fewer than 10% of enrollment may be left out, among other exceptions.',
        when: 'Updated no later than 30 calendar days after the start of each fiscal year and 30 days after the start of each calendar year.',
        citation: '105 ILCS 85/27(a)(5)',
        describesDataElements: false,
      },
    ],
    breach: [
      {
        id: 'il.operator_notice',
        duty: 'The operator notifies the school of a breach of students’ covered information, in the most expedient time possible and without unreasonable delay.',
        days: 30,
        startsAt: 'the operator determines that a breach occurred',
        citation: '105 ILCS 85/15(5)',
      },
      {
        id: 'il.parent_notice',
        duty: 'The school notifies the parents of the affected students. A law enforcement agency may ask in writing for a delay that would otherwise interfere with a criminal investigation.',
        days: 30,
        startsAt: 'the school receives the operator’s notice or determines that a breach occurred',
        citation: '105 ILCS 85/27(d)',
      },
    ],
    notes: [
      'The parent notice must include the date or estimated date range of the breach, a description of the data compromised, contact information for the operator and the school, and contact information for consumer reporting agencies and the Federal Trade Commission.',
      'The general Illinois breach law (Personal Information Protection Act, 815 ILCS 530) may also apply.',
    ],
    sources: [
      { title: '105 ILCS 85/27, School duties', url: 'https://ilga.gov/ftp/ILCS/Ch%200105/Act%200085/010500850K27.html' },
      { title: '105 ILCS 85/15, Operator duties', url: 'https://www.ilga.gov/Documents/legislation/ilcs/documents/010500850K15.htm' },
    ],
    lastVerified: '2026-11-17',
  },
  CO: {
    state: 'CO',
    name: 'Colorado',
    law: 'Student Data Transparency and Security Act',
    citation: 'C.R.S. 22-16-101 to 22-16-112',
    publication: [
      {
        what: 'A list, understandable by a layperson, of the student personally identifiable information the district collects and keeps in its data system, beyond what it sends to the state, with how it uses and shares it, and a link to the state data inventory.',
        when: 'Kept current.',
        citation: 'C.R.S. 22-16-107(1)(a)',
        describesDataElements: true,
      },
      {
        what: 'A list of school service contract providers and a copy of each contract.',
        when: 'Kept current.',
        citation: 'C.R.S. 22-16-107(1)(b)',
        describesDataElements: false,
      },
      {
        what: 'For each contract provider, the provider’s plain-language description of the student data elements it collects, the learning purpose, and how it uses and shares them.',
        when: 'Updated by the provider as needed to stay accurate.',
        citation: 'C.R.S. 22-16-108(1)',
        describesDataElements: true,
      },
      {
        what: 'To the extent practicable, a list of the on-demand providers (apps used without a negotiated contract) that the district or its employees use.',
        when: 'Updated at least at the beginning and the mid-point of each school year.',
        citation: 'C.R.S. 22-16-107(3)(a)',
        describesDataElements: false,
      },
      {
        what: 'The on-demand providers the district stopped using for privacy reasons, with any written response from them.',
        when: 'When the district stops using one.',
        citation: 'C.R.S. 22-16-107(3)(c)',
        describesDataElements: false,
      },
      {
        what: 'The district’s student information privacy and protection policy.',
        when: 'Reviewed every year.',
        citation: 'C.R.S. 22-16-107(4)',
        describesDataElements: false,
      },
    ],
    breach: [
      {
        id: 'co.provider_notice',
        duty: 'The contract provider notifies the district as soon as possible when it, or a subcontractor, discovers misuse or unauthorized release of student personally identifiable information.',
        days: null,
        startsAt: null,
        citation: 'C.R.S. 22-16-108',
      },
      {
        id: 'co.public_hearing',
        duty: 'After a material breach of contract involving student data, the district’s governing board holds a public hearing within a reasonable time and decides whether to end the contract.',
        days: null,
        startsAt: null,
        citation: 'C.R.S. 22-16-107(2)(a)',
      },
      {
        id: 'co.resident_notice',
        duty: 'Under the state breach law for governmental entities, the district notifies affected Colorado residents when their "personal information" was breached, in the most expedient time possible and without unreasonable delay.',
        days: 30,
        startsAt: 'the district determines that a security breach occurred',
        citation: 'C.R.S. 24-73-103',
      },
    ],
    notes: [
      'The Student Data Transparency and Security Act does not itself require notice to parents. The general breach law does, for "personal information".',
      'Under C.R.S. 24-73-103, "personal information" includes a first name or first initial and last name combined with a student identification number, and a username or email address combined with a password. Roster data often contains both.',
    ],
    sources: [
      { title: 'C.R.S. 22-16-107', url: 'https://colorado.public.law/statutes/crs_22-16-107' },
      { title: 'C.R.S. 22-16-108', url: 'https://colorado.public.law/statutes/crs_22-16-108' },
      { title: 'C.R.S. 24-73-103', url: 'https://colorado.public.law/statutes/crs_24-73-103' },
      { title: 'Colorado Department of Education, district duties', url: 'https://www.cde.state.co.us/node/48831' },
    ],
    lastVerified: '2026-11-17',
  },
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The last day for each breach duty with a fixed number of days, counted in
 * calendar days from the given date (the event the duty starts from).
 */
export function breachDueDates(state: StateCode, startDate: string): { duty: BreachDuty; dueOn: string }[] {
  const start = DATE.test(startDate) ? Date.parse(`${startDate}T00:00:00Z`) : Number.NaN;
  if (Number.isNaN(start)) throw new RangeError(`Invalid date: ${startDate}`);
  return STATE_LAWS[state].breach
    .filter((duty) => duty.days !== null)
    .map((duty) => ({
      duty,
      dueOn: new Date(start + duty.days! * 86_400_000).toISOString().slice(0, 10),
    }));
}
