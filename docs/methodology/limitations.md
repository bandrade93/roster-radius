# Limitations of the methodology (v0.1)

RosterRadius measures what a district sends to its vendors, using files the district already has. This page lists what that measurement does not cover, how each gap affects the numbers, and what we do about it.

A report must be read with this page. Each limitation says whether it can make a number too low (**underestimate**), too high (**overestimate**), or less precise (**range**).

## 1. What the data sources can see

**1.1 Only documented channels are measured.** The tool sees the channels the district records in its inventory: rostering platforms (Clever, ClassLink), SFTP exports and OneRoster files. It does not see apps a teacher connects on their own with a Google or Microsoft account, files uploaded by hand, browser extensions, or data typed into an app.
*Effect:* underestimate. *What we do:* reports list the channels that were measured. Apps found in Google Workspace and Microsoft 365 admin consoles can be added to the inventory by hand; reading those consoles directly is planned for the hosted platform (ADR 0001).

**1.2 Fields shared through Clever are entered by hand.** Clever's "Application Receives" files show which records an app receives, not which fields. The fields come from the Field Access screen, which has no export, so the district copies them into the inventory.
*Effect:* underestimate or overestimate, depending on the copy. *What we do:* reports mark each value as measured from a file or entered by hand.

**1.3 File formats are not yet validated with a real district export.** Column names for Clever files follow its public SFTP specification (v2.1.1), and we assume the "Application Receives" files use the same names. ClassLink's export format is not documented publicly.
*Effect:* a column may not be recognized. *What we do:* columns that are not in the field catalog are never dropped silently. They are listed as unknown for the district to review, and they are not scored.

**1.4 Data created inside the app is not seen.** Grades, assessment results, student work and usage data that an app generates are not part of what the district sends.
*Effect:* underestimate, especially for learning and assessment apps.

**1.5 What is sent is not what the vendor keeps.** The tool measures the current sharing configuration. It does not know what a vendor still holds from previous years, from former students, or after the end of a contract.
*Effect:* underestimate for long-standing vendors; overestimate if a vendor already deleted data.

**1.6 Data shared onward is not followed.** Vendors pass data to subprocessors such as hosting, analytics and AI providers. v0.1 does not follow it.
*Effect:* underestimate. *What we do:* the inventory has a subprocessor column, with AI providers marked, and the report lists them for each vendor. Counting the students whose data reaches them is planned for v0.2.

## 2. Counting people

**2.1 People are matched by identifier.** A student who reaches the same vendor through two channels is counted once only if both channels use the same student identifier. If one channel uses the SIS ID and another the state ID, the student is counted twice.
*Effect:* overestimate of people and points for vendors with several channels. *What we do:* a file that lists students is matched to the OneRoster export by both its `sourcedId` and its `identifier` column, which often holds the district's own ID, and the one that matches more students is used. IDs found in neither are counted as separate people and reported, and reports state which identifier was used for each source.

**2.2 Some sources give only a count.** When a flow gives the number of students but not their identifiers, overlap with other flows cannot be removed.
*Effect:* range. *What we do:* the result is shown as a range from full overlap to no overlap, and marked as not exact.

**2.3 Guardian data is counted inside each student's record.** A guardian with three children in the district appears in three student records.
*Effect:* the number of students is right; the number of guardians is not reported in v0.1.

**2.4 Identifiers are read in memory only.** No student identifier or value is stored. As a consequence, a later report cannot be compared person by person with an earlier one. Changes between imports are planned for the hosted platform.

## 3. The exposure score

**3.1 The weights are a hypothesis.** Each field belongs to one of nine sensitivity classes weighted from 1 to 5, following the "data field sensitivity" factor of NIST SP 800-122. The classes come from NIST and from the NDPA Exhibit B categories; the numbers are ours. They have not yet been validated by district technology leaders or privacy experts.
*Effect:* rankings may change with other weights. *What we do:* a district can set its own weights, and every report states which weights were used. The plain-language counts (for example, "800 students with home address shared") do not depend on weights.

**3.2 The score adds up fields.** It does not model combinations. Name, date of birth and home address together allow identity theft in a way that none of them allows alone, but the score only adds their weights.
*Effect:* underestimate of the harm of some combinations. Adding was chosen so that removing any field always lowers the score, which makes reduction simulations meaningful.

**3.3 The score measures exposure, not risk.** It does not include the likelihood of a breach: the vendor's security practices, certifications, breach history or the size of its company. Two vendors with the same score can carry very different risk.
*What we do:* the score is used to rank vendors within one district. It is not a probability, and it should not be compared across districts of different sizes.

**3.4 Staff use the same weights as students.** Some staff data, such as a work email address, is often public on the school's website.
*Effect:* possible overestimate of staff exposure. Staff exposure is always reported separately and never added to student exposure.

**3.5 A reduction simulation shows the score after deletion.** Stopping a field changes what is sent from then on. The vendor still holds what it already received until it deletes it, so the lower score is reached only after the district asks for deletion and the vendor confirms it.
*Effect:* overestimate of the immediate benefit of a cut. *What we do:* the methodology says so where it describes the simulation.

## 4. What an app needs

**4.1 The category baselines are a hypothesis.** "Unnecessary data" alerts compare each app with what its category usually needs. The baselines were kept conservative to avoid false alarms, and they still have to be reviewed with district technology leaders.
*Effect:* missed alerts or false alerts.

**4.2 One category per app.** An app that does several things (for example, content and messaging) is checked against one category only.

**4.3 "Not expected" does not mean "not allowed".** An app may have a legitimate reason for a field. The alert asks the district to stop sharing the field or to record the reason. Recording reasons in the tool is not available in v0.1.

**4.4 The district's student information system is not checked.** It holds all fields by design.

## 5. Contracts and the published list

**5.1 Contract terms are entered by hand.** The district records the Exhibit B categories and the end date of each agreement.
*Effect:* alerts are only as good as that record.

**5.2 Only Exhibit B categories are compared.** Contracts that do not follow the NDPA, or that describe data in other terms, have to be mapped to Exhibit B categories by the district. Other clauses, such as retention, deletion and breach notice, are not checked in v0.1.

**5.3 Only student and guardian data is compared.** Exhibit B lists student data, so staff fields are not compared with the contract.

**5.4 A contract that allows more than what flows is not an alert.** The tool compares what flows with what is allowed, not the other way around.

**5.5 The published list is translated by hand.** Districts describe the data they share in plain language, each in their own way. The district translates its publication into Exhibit B categories and fields, and the comparison with what flows is only as good as that translation. A vendor named without its data counts as disclosed but is not compared.

**5.6 The published list is compared like a contract.** Only student and guardian data is compared, and a publication that lists more than what flows is not a finding.

## 6. Incident scenarios

**6.1 Scenarios assume the worst case.** A scenario assumes that every field received inside the breached scope was taken. A real incident may involve less.
*Effect:* overestimate, on purpose: at the start of an incident, nobody knows what was taken.

**6.2 Scenarios have no dates.** Data that was already deleted still counts, and data from earlier school years is not included.

## 7. Legal

**7.1 This is not legal advice.** Alerts and incident scenarios are not findings that a law was broken. The table of state laws (deadlines and publication duties) is a summary for orientation, and the district's counsel decides what applies.

## 8. Validation so far

**8.1 Tested with synthetic data only.** The formula and the alerts are tested with synthetic districts, including randomized checks against a simple reference calculation. They have not yet been run on a real district.

**8.2 External review is pending.** This methodology will be reviewed by at least two people outside the project before v0.1. Their comments, and what changed because of them, will be recorded here.

## Summary

| Can make numbers too low | Can make numbers too high | Gives a range |
|---|---|---|
| Undocumented channels (1.1) | Different identifiers across channels (2.1) | Flows with counts only (2.2) |
| Data created inside the app (1.4) | Staff weights (3.4) | |
| Data kept from previous years (1.5) | Worst-case incident scenarios (6.1) | |
| | Immediate effect of a reduction (3.5) | |
| Subprocessors (1.6) | | |
| Combinations of fields (3.2) | | |
