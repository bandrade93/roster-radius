# Contracts format (v0.1)

The contracts file records what each data privacy agreement allows, so that RosterRadius can compare it with what actually flows. It is a CSV file with a header row, encoded in UTF-8, with commas between columns. Lists inside a cell use `|`, as in the [app inventory](inventory.md).

Each row is one agreement. See [`contracts-example.csv`](contracts-example.csv) for an example with fictional vendors.

## Columns

| Column | Required | Example | Meaning |
|---|---|---|---|
| `contract_id` | yes | `ACME-2025` | The district's identifier for the agreement. Must be unique in the file. |
| `vendor` | yes | `Acme Learning` | The vendor, spelled as in the inventory. |
| `apps` | no | `LunchLine` | The apps the agreement covers, spelled as in the inventory. Empty means every app of the vendor. |
| `exhibit_b` | no | `Student Name\|Enrollment` | The Exhibit B categories the agreement allows as a whole. See [Exhibit B](#exhibit-b). |
| `fields` | no | `student.birth_date` | Individual fields the agreement allows, by catalog key or label, for agreements that check single data elements instead of whole categories. |
| `end_date` | no | `2027-06-30` | Last day the agreement is in force, as `YYYY-MM-DD`. |
| `deletion_days` | no | `60` | Days after the end of the agreement by which the vendor must delete the data. |
| `agreement` | no | `ndpa` | The kind of agreement: `ndpa` (National Data Privacy Agreement), `state_dpa` (a state's own agreement), `vendor_terms` (the vendor's terms of service) or `other`. |
| `source` | no | `https://sdpc.a4l.org/...` | Where the agreement can be found, such as its page in the SDPC registry. |
| `notes` | no | | Free text. Not used in calculations. |

## Exhibit B

Exhibit B of the National Data Privacy Agreement is the schedule of student data the vendor may receive. It lists data elements grouped in categories, and the parties mark the ones that apply. RosterRadius uses the category names as they appear there:

Application Technology Meta Data, Application Use Statistics, Assessment, Attendance, Communications, Conduct, Demographics, Enrollment, Parent/Guardian Contact Information, Parent/Guardian ID, Parent/Guardian Name, Schedule, Special Indicator, Student Contact Information, Student Identifiers, Student In App Performance, Student Name, Student Program Membership, Student Survey Responses, Student Work, Transcript, Transportation.

Names are matched without regard to case, spaces or punctuation. Each field in the [catalog](../../packages/core/src/catalog/fields.ts) belongs to one category.

**Whole category or single elements.** If the agreement marks every element of a category, list the category in `exhibit_b`. If it marks only some, list those fields in `fields` instead. For example, an agreement that allows date of birth but not race, both in "Demographics", lists `student.birth_date` in `fields` and not "Demographics" in `exhibit_b`.

## How contracts are used

- A student or guardian field that flows to an app is **allowed** if its category is in `exhibit_b` or the field is in `fields` of an agreement in force that covers the app. Otherwise the tool raises a *contract mismatch* alert.
- When several agreements in force cover the same app, what they allow is combined.
- A row with neither `exhibit_b` nor `fields` records only dates. Its dates are checked, but fields are not compared, because the tool does not know what the agreement allows. This is reported as a warning.
- Staff fields are not compared, because Exhibit B lists student data.
- If an app has a row here and also a `contract_end` in the inventory, this file is used.
