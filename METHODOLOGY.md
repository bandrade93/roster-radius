# RosterRadius methodology

- **Version:** 0.1 (draft)
- **Date:** 2026-11-17
- **Status:** open for review. See [Review and changes](#11-review-and-changes).

This document explains how RosterRadius turns a district's files into the numbers and alerts in its reports: which data is read, how fields are classified, how exposure is calculated, and which rules raise alerts. Everything described here is implemented in [`packages/core`](packages/core/src), and each section links to the code.

Read it together with the [limitations](docs/methodology/limitations.md). They say which numbers can be too low, too high, or given as a range.

## 1. The question

For each vendor that receives student data from a district:

1. Which student data fields does it receive, through which channels, and for how many students?
2. How large is its exposure: how many students would be affected if it were breached, and with which kinds of data?
3. Does it receive data its kind of app does not need?
4. Does what it receives match what its contract allows, and is the contract still in force?

The answers are meant for a district technology director without security training. Reports lead with plain-language counts, such as "1,700 students, 800 of them with home address", and use the exposure score to rank vendors.

## 2. Principles

- **Data minimization.** An app should receive only the data its function requires. This is the reference for every "unnecessary data" alert.
- **Metadata only.** The tool keeps field names, vendors, channels and counts. Student values and identifiers are read in memory to count distinct people and are never stored or written to a report.
- **Runs locally.** The open-source tool processes files on the district's own computer. Nothing is uploaded.
- **Measured or entered, always labeled.** Some inputs come from files and some are typed by the district. Reports say which is which.
- **Traceable and reproducible.** Every number points to the rule and the input that produced it. Every report states the methodology version and the weights used.
- **Conservative alerts.** Baselines and rules are tuned to avoid false alarms. An alert must point to something the district can fix.

## 3. Inputs

The tool starts from files the district already has or can fill in. The choice of sources and the reasons for it are recorded in [ADR 0001](docs/adr/0001-supported-data-sources.md).

| Input | Gives |
|---|---|
| App inventory (CSV) | Each app, its vendor, channel, category, fields shared, and optional contract dates and subprocessors |
| OneRoster 1.1 CSV | Students and staff, by school and grade, to count people |
| Clever "Application Receives" CSV files | Which records each app receives, and the columns present |
| Structured contract record | Exhibit B categories allowed, end date |
| Declared disclosure list (CSV) | What the district published about each vendor |

Each input is resolved into **flows**. A flow says that one app, of one vendor, receives a set of fields about a set of people through one channel. People are given by their identifiers (read in memory only) or, when a source gives no identifiers, only by a count.

## 4. Field catalog

The [field catalog](packages/core/src/catalog/fields.ts) lists 82 facts that can be shared, each with a stable key: 46 about students, 5 about guardians, 16 about staff, 6 about schools and 9 about sections. Examples: `student.birth_date`, `guardian.phone`, `staff.email`.

There is one entry per fact, not per column. OneRoster splits race into six true/false columns, while Clever uses one `Race` column; both map to `student.race`. Each entry records:

- the column names it has in OneRoster 1.1.1 CSV, the Clever SFTP specification v2.1.1 and the Clever Data API, matched case-insensitively and ignoring spaces, hyphens and underscores;
- its sensitivity class (section 5);
- for student and guardian fields, its category in Exhibit B of the National Data Privacy Agreement (NDPA), which is how contracts are compared (section 7.2).

Columns that are not in the catalog are never dropped silently. They are listed for the district to review and are not scored.

## 5. Sensitivity classes

Each field belongs to one [sensitivity class](packages/core/src/catalog/sensitivity.ts). The weight says how much harm exposing that field can cause to one person, on a scale from 1 to 5. It plays the role of the "data field sensitivity" factor in NIST SP 800-122. The number of people exposed is applied separately, by the formula in section 6.

| Class | Weight | Examples | Why |
|---|---|---|---|
| Organizational | 1 | School, grade, classes, staff role | Reveals little about a person on its own |
| Identifiers and contact | 3 | Names, IDs, username, email, phone | Identifies a person; enables phishing and impersonation |
| Academic and activity | 3 | Grades, assessments, attendance, student work | Educational record |
| Date and place of birth | 4 | Birth date, birthplace | With a name, a common key for identity theft; an indirect identifier under FERPA |
| Demographic | 4 | Gender, race, ethnicity, home language | Can enable discrimination |
| Behavior and expression | 4 | Discipline, survey responses, messages | Can expose beliefs, conflicts or wellbeing |
| Credentials | 5 | Passwords | Direct access to accounts |
| Special status | 5 | Disability, special education, Section 504, English learner, meal eligibility, health, living situation | Protected by specific federal rules, such as IDEA and the National School Lunch Act |
| Location | 5 | Home address, transportation | Can lead to a child being found physically |

The weights are a starting hypothesis to be validated in review. A district can replace any weight; reports always state which weights were used. The plain-language counts do not depend on the weights.

## 6. Exposure

Implemented in [`exposure/formula.ts`](packages/core/src/exposure/formula.ts).

### 6.1 Formula

For a vendor *v*, let *P(v)* be the distinct people whose data reaches *v*, and *F(v, i)* the union of fields *v* receives about person *i*, across all of its apps and channels. Then:

```
Exposure(v) = Σ over i in P(v) of  Σ over f in F(v, i) of  w(f)
```

where *w(f)* is the weight of the field's sensitivity class. The same formula gives the exposure of a single app, using only that app's flows.

- **Each person is counted once.** A student who reaches the same vendor through two apps or two channels is not counted twice, and their fields are merged.
- **Weights are added.** Every field adds to the score, so removing any field always lowers it. This makes "what if we stop sharing this field?" simulations meaningful.

Besides the score, each result gives the number of distinct people, the number of people with at least one field of each sensitivity class, the fields counted, and the most sensitive class exposed.

### 6.2 Students and staff

Students and staff are two populations, calculated separately and never added together, because the harm and the people to notify differ.

- **Students:** student and guardian fields. A guardian's phone is part of the student's record.
- **Staff:** staff fields.
- School and section fields describe organizations and are never counted.

A flow that carries fields of a population without saying which people it reaches is left out of the totals and reported, so the result is marked incomplete.

### 6.3 Flows with counts only

When a flow gives only the number of people, it cannot be matched with other flows. The result is then a range: the minimum assumes full overlap with the other flows, the maximum assumes none. Results with a range are marked as not exact.

### 6.4 Worked example

A vendor has two apps:

- a reading app, through Clever, for students 1 to 1,200: first name, last name, grade, school and birth date. Weight per student: 3 + 3 + 1 + 1 + 4 = 12.
- a math app, through SFTP, for students 901 to 1,700: first name, last name, meal eligibility and home address. Weight per student: 3 + 3 + 5 + 5 = 16.

Students 901 to 1,200 are in both apps. For them, the vendor holds the union of fields: 3 + 3 + 1 + 1 + 4 + 5 + 5 = 22.

| | Students | Score |
|---|---|---|
| Reading app | 1,200 | 1,200 × 12 = 14,400 |
| Math app | 800 | 800 × 16 = 12,800 |
| Vendor, added naively | 2,000 | 27,200 |
| **Vendor, per the formula** | **1,700** | 900 × 12 + 500 × 16 + 300 × 22 = **25,400** |

In plain language: *1,700 students; 1,200 with date of birth; 800 with meal eligibility and home address.* The 300 students in both apps are the most exposed: this vendor holds their birth date and home address together.

## 7. Alerts

Implemented in [`alerts/rules.ts`](packages/core/src/alerts/rules.ts). Each alert points to one thing the district can fix. Alerts about data are raised per flow (app and channel), because the fix is made in that channel's sharing settings. Alerts about contracts are raised per app. Alerts are sorted by severity, then by the number of people affected.

| Rule | Severity | Raised when | Federal basis |
|---|---|---|---|
| Password | critical | A flow carries student or staff passwords | FERPA, legitimate educational interest |
| Unnecessary field | high, or medium | The app's category does not need the field; high when any such field has weight 4 or more | FERPA, legitimate educational interest; NSLA and IDEA for special status |
| No contract | high | An app receives student data and no contract covers it | FERPA, school official |
| Contract expired | high | Every contract covering the app has expired, and data still flows | FERPA, school official |
| Contract mismatch | high, or medium | A field's Exhibit B category is not allowed by the contracts in force; high when any such field has weight 4 or more | FERPA, school official |
| Review field | info | A field with weight 4 or more that only some apps of the category use | FERPA, legitimate educational interest |
| Contract expiring | info | The last contract covering the app ends within 60 days (configurable) | FERPA, school official |
| Unclassified app | info | The app has no category, so unnecessary data cannot be checked | None (operational) |

The federal basis of each rule is explained in section 9.

### 7.1 What each kind of app needs

The [category baselines](packages/core/src/baselines/categories.ts) say, for each category of app, which fields are **needed** and which are **conditional**: used by some apps of the category for a legitimate feature, such as accommodations or translated messages. Any other student, guardian or staff field is **not expected**. Conditional fields are only flagged for review when they are sensitive; fields that are not expected raise an "unnecessary field" alert.

| Category | Covers |
|---|---|
| Instructional content and practice | Student-facing reading, math, science and practice apps |
| Learning management system | Course pages, assignments, grading and class messaging |
| Assessment and screening | Benchmark, screening and test delivery platforms |
| Family communication | School-to-home messaging, notifications and translation |
| Special education management | IEP and Section 504 plan writing, services and compliance |
| School nutrition | Cafeteria point of sale and meal accounts |
| Transportation | Bus routing, stop assignment and rider tracking |
| Library | Library catalog, circulation and e-books |
| Student information system | The district's system of record; not checked, since it holds all fields by design |

Passwords are never expected. They raise the password alert only, not a second "unnecessary field" alert. School and section fields are not checked.

### 7.2 Contracts

A contract record lists the Exhibit B categories the agreement allows as a whole, any individual fields it allows (when the agreement marks single data elements rather than whole categories), the apps it covers (or all apps of the vendor) and its end date. The format is described in [docs/formats/contracts.md](docs/formats/contracts.md). The comparison runs from the flow to the contract: every student or guardian field that flows must be allowed, by its category or by name. A contract that records only dates is checked for expiry, but its fields are not compared. A contract that allows more than what flows does not raise an alert. Staff fields are not compared, because Exhibit B lists student data.

When several contracts cover an app, the categories allowed by those still in force are combined, and the app stays covered until the last of them ends.

## 8. Incident scenarios

Implemented in [`exposure/incident.ts`](packages/core/src/exposure/incident.ts). A scenario asks: if this part of the data flow were breached, who would be affected, and with which data? It applies the exposure formula to the flows inside the breached scope, for students and staff separately.

| Scope | What is exposed |
|---|---|
| Vendor | Everything the vendor received, from all of its apps and channels |
| App | The data of one app |
| Channel | Everything that passes through the channel, such as a rostering platform or the district's SFTP account, across all vendors |

Each scenario assumes the worst case: that every field received inside the scope was taken. A district can rank every vendor and channel this way, to see which single breach would affect its students the most. In an incident, the scenario also gives the identifiers of the people affected, in memory, to prepare notifications.

## 9. Legal basis

The methodology rests on two layers of law. Neither is legal advice: the tool does not decide whether a law applies or whether a district complies.

**Federal law** applies to every district in the country. Under FERPA, a vendor receives education records as a "school official" only under the district's direct control and only for records in which it has a legitimate educational interest. These two conditions are the basis of the contract alerts and of the unnecessary-data alerts. The National School Lunch Act and IDEA protect meal eligibility and special education data, which is why they weigh 5. FERPA has no breach notification requirement for districts, and no federal law requires districts to publish which vendors receive student data. See the [federal legal basis](docs/methodology/federal-laws.md), kept as data in [`laws/federal.ts`](packages/core/src/laws/federal.ts).

**State law** adds what districts must publish and the deadlines after a breach. The [state law table](docs/methodology/state-laws.md) starts with Illinois and Colorado and is kept as data in [`laws/states.ts`](packages/core/src/laws/states.ts). In incident mode, the tool shows each deadline and its last day.

## 10. Planned for v0.1, not yet specified

These parts will be specified here before the v0.1 release:

- **Disclosure versus flow:** compare what the district published about the data it shares, as Illinois and Colorado require, with what actually flows.
- **More states:** New York, Connecticut and Utah also require districts to publish information about vendors that receive student data.
- **Reduction simulation:** how much exposure falls if a field stops being shared. It follows directly from the formula in section 6.

## 11. Review and changes

This methodology is open for review. Comments are welcome as [GitHub issues](https://github.com/bandrade93/roster-radius/issues). Before v0.1, it will be reviewed by at least two people outside the project, ideally including district technology or privacy leaders. Their comments, and what changed because of them, will be recorded below.

Any change to the catalog, weights, baselines or rules changes the methodology version. Reports state the version they used.

### Changelog

- **0.1 (draft), 2026-11-17:** first version, with federal and state legal basis.

## References

- National Institute of Standards and Technology. [SP 800-122, Guide to Protecting the Confidentiality of Personally Identifiable Information (PII)](https://csrc.nist.gov/pubs/sp/800/122/final). 2010.
- Student Data Privacy Consortium, Access 4 Learning Community. [National Data Privacy Agreement, version 2.2](https://files.a4l.org/privacy/NDPA/NDPA_v2-2_STANDARD_WEB.pdf), Exhibit B.
- 1EdTech. [OneRoster 1.1](https://www.imsglobal.org/lis), CSV Tables v1.1.1.
- Clever. SFTP upload specification v2.1.1, and Data API v3.0 and v3.1.
- RosterRadius. [ADR 0001: supported data sources](docs/adr/0001-supported-data-sources.md).
- Federal and state law: see the sources of the [federal legal basis](docs/methodology/federal-laws.md) and the [state law table](docs/methodology/state-laws.md).
