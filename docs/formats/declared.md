# Declared list format (v0.1)

The declared list records what the district has **published** about which vendors receive student data, and which data each one receives. RosterRadius compares it with what actually flows, to find vendors or data the publication leaves out.

Several states require districts to publish this information. Illinois requires a plain-language explanation of each data element the school discloses, with its recipients (105 ILCS 85/27(a)(1)). Colorado requires the district to post, for each contract provider, the data elements it collects (C.R.S. 22-16-107(1) and 22-16-108(1)). See the [state law table](../methodology/state-laws.md).

It is a CSV file with a header row, encoded in UTF-8, with commas between columns and `|` between items in a list, as in the [app inventory](inventory.md). In v0.1 it is filled in by hand from the district's own publication. Reading exports from the SDPC Resource Registry or LearnPlatform is planned for v0.2.

Each row is one vendor, or some apps of a vendor, as the publication lists them. See [`declared-example.csv`](declared-example.csv) for an example with fictional vendors.

## Columns

| Column | Required | Example | Meaning |
|---|---|---|---|
| `vendor` | yes | `Acme Learning` | The vendor, spelled as in the inventory. |
| `apps` | no | `LunchLine` | The apps the entry covers, spelled as in the inventory. Empty means every app of the vendor. |
| `exhibit_b` | no | `Student Name\|Enrollment` | The data the publication lists, as Exhibit B categories. Names are matched without regard to case, spaces or punctuation. The list of categories is in the [contracts format](contracts.md#exhibit-b). |
| `fields` | no | `student.transportation` | Individual fields the publication lists, by key or label from the [accepted fields](fields.md), when it names single data elements instead of whole categories. |
| `published_on` | no | `2026-08-15` | When the district published or last updated the list, as `YYYY-MM-DD`. |
| `source` | no | `https://…/privacy` | Where the publication is, such as the district's privacy page or its SDPC listing. |
| `notes` | no | | Free text. Not used in calculations. |

## Translating a publication

Published lists are written for parents, not for software, and each district writes them differently. Translate each item to the closest Exhibit B category, or to a catalog field when the item is specific:

| The publication says | Use |
|---|---|
| "Student name" | `exhibit_b`: Student Name |
| "Student ID number" | `exhibit_b`: Student Identifiers |
| "Grade and school" | `exhibit_b`: Enrollment |
| "Free and reduced lunch status" | `exhibit_b`: Special Indicator, or `fields`: `student.frl_status` |
| "Bus stop" | `fields`: `student.transportation` |

When an item could mean more than one thing, choose the narrower reading and say so in `notes`. A vendor the publication names without listing its data is entered with `exhibit_b` and `fields` empty: it counts as disclosed, but its data is not compared (a warning says so).

## How the declared list is used

The analysis compares the declared list with what flows (methodology, section 7.3) and reports:

- **vendors that receive student data but are not in the publication;**
- **apps the publication leaves out** for a vendor it names only for other apps;
- **data that flows but the publication does not list** for that vendor or app, whether by its category or by name, with the number of students whose data it is;
- **vendors in the publication that no longer receive data**, so the district can update its page.

As for contracts, only student and guardian data is compared, and only in one direction: a publication that lists more than what flows is not a finding.
