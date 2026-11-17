# Federal legal basis (v0.1)

> **Not legal advice.** This is a summary of federal law for orientation. Confirm with the district's legal counsel.

Federal law applies to every public school district in the United States. It says what may be shared with a vendor, for what purpose and under whose control. RosterRadius uses it as the basis of its alerts and of the highest sensitivity weights.

Federal law does **not** require districts to publish which vendors receive student data, and FERPA has no breach notification requirement for districts. Those duties come from state law: see the [state law table](state-laws.md).

The same content is kept as data in [`laws/federal.ts`](../../packages/core/src/laws/federal.ts). Last checked: **2026-11-17**.

## The provisions

| Provision | What it says | How RosterRadius uses it |
|---|---|---|
| **FERPA, school official** (34 CFR 99.31(a)(1)(i)(B)) | A vendor may receive education records without parental consent only if it performs a service the district would otherwise use employees for, is under the district's direct control with respect to the use and maintenance of the records, and uses them only as allowed by 99.33(a). | Most vendors receive data this way. Direct control is exercised through the written agreement: the *no contract*, *contract expired*, *contract expiring* and *contract mismatch* alerts rest on it. |
| **FERPA, legitimate educational interest** (34 CFR 99.31(a)(1)(ii); 99.7(a)(3)(iii)) | The district must use reasonable methods so that school officials, vendors included, access only the records in which they have a legitimate educational interest, and must state its criteria in the annual FERPA notice. | Basis for data minimization: the *unnecessary field*, *review field* and *password* alerts. |
| **FERPA, recordkeeping** (34 CFR 99.32) | The district must record disclosures of education records, but disclosures to school officials, vendors included, are exempt. | No federal rule requires a record of what each vendor receives. RosterRadius builds that record from the district's own files. |
| **FERPA, breaches** (20 U.S.C. 1232g) | FERPA has no specific breach notification requirement for districts. | Deadlines after a breach come from state law. |
| **National School Lunch Act** (42 U.S.C. 1758(b)(6); 7 CFR 245.6) | Free and reduced-price meal eligibility may be disclosed only to the programs and people the law lists, with a legitimate need to know. Unauthorized disclosure carries criminal penalties. | Meal eligibility weighs 5 (special status). Shared with an app outside the meal program, it raises an *unnecessary field* alert with a federal basis. |
| **IDEA, Part B confidentiality** (34 CFR 300.610 to 300.627) | Personally identifiable information kept for special education must be protected at collection, storage, disclosure and destruction, with one official responsible for it. | Special education and disability data weighs 5 (special status). |
| **PPRA** (20 U.S.C. 1232h; 34 CFR Part 98) | Surveys on eight protected areas, such as political beliefs, mental or psychological problems and religious practices, require parental notice and consent or opt-out, depending on funding. Collecting student information for marketing also requires notice. | Survey responses weigh 4 (behavior and expression). |
| **COPPA Rule** (16 CFR Part 312) | Online services collecting personal information from children under 13 need verifiable parental consent. The amended Rule took effect on June 23, 2025, with compliance due by April 22, 2026. Schools authorizing collection on behalf of parents remains FTC guidance, not part of the Rule. | Context for vendors serving elementary students. Not an alert in v0.1, because the tool does not know students' ages. |

## Alerts and their federal basis

| Alert | Federal basis |
|---|---|
| Password | FERPA, legitimate educational interest |
| Unnecessary field | FERPA, legitimate educational interest; for meal eligibility, also the National School Lunch Act; for special education, also IDEA |
| No contract, contract expired, contract expiring, contract mismatch | FERPA, school official (direct control) |
| Review field | FERPA, legitimate educational interest |
| Unclassified app | None: it asks the district to classify an app so the other checks can run |

An alert is not a finding that the law was broken. It points to a flow the district should be able to justify under these rules.

## Sources

- [34 CFR 99.31](https://www.law.cornell.edu/cfr/text/34/99.31), conditions for disclosure without consent.
- U.S. Department of Education, Privacy Technical Assistance Center. [Data Breach Response Checklist](https://georgiainsights.gadoe.org/Data-Collections/Documents/DC_Conf_US%20ED/FY2020/Data%20Breach%20Response%20Training.pdf).
- U.S. Department of Education. [Protecting Student Privacy While Using Online Educational Services: Requirements and Best Practices](https://studentprivacy.ed.gov/resources/protecting-student-privacy-while-using-online-educational-services-requirements-and-best) (2014).
- U.S. Department of Agriculture. [Disclosure requirements for the Child Nutrition Programs](https://www.fns.usda.gov/cn/disclosure-requirements-child-nutrition-programs).
- [34 CFR 300.623](https://sites.ed.gov/idea/regs/b/f/300.623), IDEA safeguards.
- U.S. Department of Education. [Protection of Pupil Rights Amendment notice](https://studentprivacy.ed.gov/sites/default/files/resource_document/file/20-0379.PPRA_508.pdf).
- Federal Trade Commission. [Children's Online Privacy Protection Rule, 90 FR 16918](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule) (April 22, 2025).
