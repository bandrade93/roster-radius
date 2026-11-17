import type { AlertRule } from '../alerts/index.js';
import type { SensitivityClass } from '../catalog/sensitivity.js';
import type { LegalSource } from './states.js';

/**
 * Federal laws, v0.1: the legal basis that applies to every district in the
 * United States.
 *
 * Federal law says what may be shared with a vendor, for what purpose and
 * under whose control. It does not require districts to publish which vendors
 * receive student data, and FERPA has no breach notification requirement:
 * those duties come from state law (see `states.ts`).
 *
 * This is a summary for orientation, not legal advice.
 */

export type FederalLawId = 'ferpa' | 'nsla' | 'idea' | 'ppra' | 'coppa';

export interface FederalProvision {
  /** Stable ID, such as "ferpa.school_official". */
  readonly id: string;
  readonly law: FederalLawId;
  readonly citation: string;
  /** What the provision says, in plain language. */
  readonly summary: string;
  /** Why it matters to RosterRadius. */
  readonly relevance: string;
}

export interface FederalLaw {
  readonly id: FederalLawId;
  readonly name: string;
  readonly citation: string;
  readonly sources: readonly LegalSource[];
  /** Date the entry was last checked, as YYYY-MM-DD. */
  readonly lastVerified: string;
}

export const FEDERAL_LAWS: Readonly<Record<FederalLawId, FederalLaw>> = {
  ferpa: {
    id: 'ferpa',
    name: 'Family Educational Rights and Privacy Act (FERPA)',
    citation: '20 U.S.C. 1232g; 34 CFR Part 99',
    sources: [
      { title: '34 CFR 99.31', url: 'https://www.law.cornell.edu/cfr/text/34/99.31' },
      { title: 'PTAC, Data Breach Response Checklist', url: 'https://georgiainsights.gadoe.org/Data-Collections/Documents/DC_Conf_US%20ED/FY2020/Data%20Breach%20Response%20Training.pdf' },
      {
        title: 'U.S. Department of Education, Protecting Student Privacy While Using Online Educational Services (2014)',
        url: 'https://studentprivacy.ed.gov/resources/protecting-student-privacy-while-using-online-educational-services-requirements-and-best',
      },
    ],
    lastVerified: '2026-11-17',
  },
  nsla: {
    id: 'nsla',
    name: 'Richard B. Russell National School Lunch Act (NSLA)',
    citation: '42 U.S.C. 1758(b)(6); 7 CFR 245.6',
    sources: [
      { title: 'USDA, Disclosure requirements for the Child Nutrition Programs', url: 'https://www.fns.usda.gov/cn/disclosure-requirements-child-nutrition-programs' },
    ],
    lastVerified: '2026-11-17',
  },
  idea: {
    id: 'idea',
    name: 'Individuals with Disabilities Education Act (IDEA), Part B',
    citation: '34 CFR 300.610 to 300.627',
    sources: [{ title: '34 CFR 300.623, Safeguards', url: 'https://sites.ed.gov/idea/regs/b/f/300.623' }],
    lastVerified: '2026-11-17',
  },
  ppra: {
    id: 'ppra',
    name: 'Protection of Pupil Rights Amendment (PPRA)',
    citation: '20 U.S.C. 1232h; 34 CFR Part 98',
    sources: [
      { title: 'U.S. Department of Education, PPRA notice', url: 'https://studentprivacy.ed.gov/sites/default/files/resource_document/file/20-0379.PPRA_508.pdf' },
    ],
    lastVerified: '2026-11-17',
  },
  coppa: {
    id: 'coppa',
    name: 'Children’s Online Privacy Protection Act (COPPA) and Rule',
    citation: '15 U.S.C. 6501 to 6506; 16 CFR Part 312',
    sources: [
      { title: 'FTC, amended COPPA Rule, 90 FR 16918 (April 22, 2025)', url: 'https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule' },
    ],
    lastVerified: '2026-11-17',
  },
};

export const FEDERAL_PROVISIONS = [
  {
    id: 'ferpa.school_official',
    law: 'ferpa',
    citation: '34 CFR 99.31(a)(1)(i)(B)',
    summary:
      'A vendor may receive education records without parental consent as a "school official" only if it performs a service the district would otherwise use employees for, is under the district’s direct control with respect to the use and maintenance of the records, and uses them only as allowed by 34 CFR 99.33(a).',
    relevance:
      'This is how most vendors receive student data. Direct control is exercised through the written agreement, so a flow with no agreement, an expired one, or fields outside it weakens the basis for sharing.',
  },
  {
    id: 'ferpa.legitimate_interest',
    law: 'ferpa',
    citation: '34 CFR 99.31(a)(1)(ii); 99.7(a)(3)(iii)',
    summary:
      'The district must use reasonable methods so that school officials, vendors included, obtain access only to the records in which they have a legitimate educational interest, and must state its criteria in the annual FERPA notice.',
    relevance: 'Basis for data minimization: a field the app does not need is a field it has no legitimate educational interest in.',
  },
  {
    id: 'ferpa.recordkeeping',
    law: 'ferpa',
    citation: '34 CFR 99.32',
    summary:
      'The district must keep a record of disclosures of education records, but disclosures to school officials, which include vendors, are exempt.',
    relevance:
      'No federal rule requires a record of what each vendor receives. RosterRadius builds that record from the district’s own files.',
  },
  {
    id: 'ferpa.no_breach_notice',
    law: 'ferpa',
    citation: '20 U.S.C. 1232g',
    summary: 'FERPA has no specific breach notification requirement for districts.',
    relevance: 'Deadlines after a breach come from state law, which is why incident mode uses the state law table.',
  },
  {
    id: 'nsla.eligibility',
    law: 'nsla',
    citation: '42 U.S.C. 1758(b)(6); 7 CFR 245.6',
    summary:
      'Free and reduced-price meal eligibility may be disclosed only to the programs and people the law lists, who must have a legitimate need to know. Unauthorized disclosure carries criminal penalties.',
    relevance: 'Meal eligibility shared with an app that does not run the meal program is flagged with a federal basis, and weighs 5.',
  },
  {
    id: 'idea.confidentiality',
    law: 'idea',
    citation: '34 CFR 300.610 to 300.627',
    summary:
      'Personally identifiable information collected or kept for special education must be protected at collection, storage, disclosure and destruction, with one official responsible for its confidentiality.',
    relevance: 'Special education and disability data weighs 5 and is checked closely in every app category.',
  },
  {
    id: 'ppra.protected_areas',
    law: 'ppra',
    citation: '20 U.S.C. 1232h',
    summary:
      'Surveys on eight protected areas, such as political beliefs, mental or psychological problems, and religious practices, require parental notice and consent or opt-out, depending on funding. Collecting student information for marketing also requires notice.',
    relevance: 'Survey responses weigh 4 (behavior and expression). An app receiving them should be checked against these rules.',
  },
  {
    id: 'coppa.rule',
    law: 'coppa',
    citation: '16 CFR Part 312',
    summary:
      'Online services collecting personal information from children under 13 must obtain verifiable parental consent. The amended Rule took effect on June 23, 2025, with compliance due by April 22, 2026. Schools authorizing collection on behalf of parents remains FTC guidance, not part of the Rule.',
    relevance: 'Vendors serving elementary students carry COPPA duties; the district’s authorization rests on guidance, which makes knowing what each app receives more important.',
  },
] as const satisfies readonly FederalProvision[];

export type FederalProvisionId = (typeof FEDERAL_PROVISIONS)[number]['id'];

/** The federal provisions each alert rule rests on. Empty when the rule is operational. */
export const ALERT_FEDERAL_BASIS: Readonly<Record<AlertRule, readonly FederalProvisionId[]>> = {
  password: ['ferpa.legitimate_interest'],
  unexpected_field: ['ferpa.legitimate_interest'],
  no_contract: ['ferpa.school_official'],
  contract_expired: ['ferpa.school_official'],
  contract_mismatch: ['ferpa.school_official'],
  review_field: ['ferpa.legitimate_interest'],
  contract_expiring: ['ferpa.school_official'],
  unclassified_app: [],
};

/** Federal provisions that protect specific sensitivity classes, beyond FERPA. */
export const CLASS_FEDERAL_BASIS: Readonly<Partial<Record<SensitivityClass, readonly FederalProvisionId[]>>> = {
  special_status: ['nsla.eligibility', 'idea.confidentiality'],
  behavioral: ['ppra.protected_areas'],
};

export function getProvision(id: FederalProvisionId): FederalProvision {
  return FEDERAL_PROVISIONS.find((p) => p.id === id)!;
}
