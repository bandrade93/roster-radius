# State student privacy laws (v0.1)

> **Not legal advice.** This is a summary of state law for orientation. Other laws, including federal law and general state breach laws, may also apply. Confirm with the district's legal counsel.

Several states require districts to publish which vendors receive student data, and set deadlines after a breach. RosterRadius uses this table in two places:

- **Disclosure versus flow.** Where the law requires the district to publish the data elements it shares, the tool can compare that publication with what actually flows.
- **Incident mode.** When a breach is reported, the tool shows the deadlines that apply and their last day.

The same content is kept as data in [`laws/states.ts`](../../packages/core/src/laws/states.ts). Illinois and Colorado come first; other states will be added.

Last checked against the statutes: **2026-11-17**.

## What the district must publish

| | Illinois (SOPPA, 105 ILCS 85) | Colorado (Student Data Transparency and Security Act, C.R.S. 22-16) |
|---|---|---|
| Data elements | Plain-language explanation of each data element the school collects, maintains or discloses, with uses, recipients and purposes. **27(a)(1)** | Plain-language list of the student data the district keeps, with how it is used and shared. **22-16-107(1)(a)**. For each contract provider, the provider's own description of the data elements it collects and how it uses and shares them. **22-16-108(1)** |
| Vendors and contracts | Operators with written agreements, a copy of each agreement and their business address. **27(a)(2)** | Contract providers and a copy of each contract. **22-16-107(1)(b)** |
| Apps without a contract | Not required | On-demand providers used by the district or its staff, to the extent practicable. **22-16-107(3)(a)** |
| Subcontractors | For each operator, its subcontractors or a link to them. **27(a)(3)** | Not required |
| Breaches | List of breaches with the number of students affected and the date; breaches affecting fewer than 10% of enrollment may be left out. **27(a)(5)** | Not required by this law |
| Other | Parents' rights to inspect, correct and delete. **27(a)(4)** | Providers the district stopped using for privacy reasons. **22-16-107(3)(c)**. The district's privacy and protection policy. **22-16-107(4)** |
| When | Each new agreement within **10 business days**. Other items updated within **30 days** after the start of each fiscal year and each calendar year. | On-demand list at least at the **beginning and mid-point** of each school year. Others kept current. |

## Deadlines after a breach

| | Illinois | Colorado |
|---|---|---|
| Vendor tells the district | Most expedient time possible, no later than **30 calendar days** after determining the breach. **85/15(5)** | **As soon as possible**, for misuse or unauthorized release, including by a subcontractor. **22-16-108** |
| District tells families | Parents of affected students, no later than **30 calendar days** after the vendor's notice or the school's own determination. May be delayed at a law enforcement agency's written request. **85/27(d)** | Not required by the student privacy law. The breach law for governmental entities requires notice to affected residents within **30 days** after determining a breach of "personal information". **C.R.S. 24-73-103** |
| Other | Content of the parent notice is set by law: date, data involved, contacts, consumer reporting agencies and the FTC. The general breach law (815 ILCS 530) may also apply. | After a material breach of contract involving student data, a public hearing of the governing board, within a reasonable time, to decide whether to end the contract. **22-16-107(2)(a)** |

Under C.R.S. 24-73-103, "personal information" includes a first name or first initial and last name together with a student identification number, and a username or email address together with a password. Roster data often contains both.

## How RosterRadius uses it

- **Deadlines** with a fixed number of days are counted in calendar days from the date the district enters (for example, the day it received the vendor's notice). Deadlines without a number ("as soon as possible", "within a reasonable time") are shown as text.
- **Disclosure versus flow** applies to the publications marked as describing data elements: Illinois 27(a)(1), and Colorado 22-16-107(1)(a) and 22-16-108(1). The comparison rule will be specified in the methodology before v0.1.
- The tool does not decide whether a law applies to a given incident or whether a district complies. It shows the duties so the district and its counsel can decide.

## Sources

- Illinois General Assembly. [105 ILCS 85/27, School duties](https://ilga.gov/ftp/ILCS/Ch%200105/Act%200085/010500850K27.html).
- Illinois General Assembly. [105 ILCS 85/15, Operator duties](https://www.ilga.gov/Documents/legislation/ilcs/documents/010500850K15.htm).
- [C.R.S. 22-16-107](https://colorado.public.law/statutes/crs_22-16-107), Local education provider: data collection, data security policy.
- [C.R.S. 22-16-108](https://colorado.public.law/statutes/crs_22-16-108), School service contract provider: data transparency.
- [C.R.S. 24-73-103](https://colorado.public.law/statutes/crs_24-73-103), Governmental entity: notification of security breach.
- Colorado Department of Education. [Student Data Transparency and Security Act: district duties](https://www.cde.state.co.us/node/48831).
