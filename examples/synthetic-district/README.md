# Synthetic district

A complete fictional district for trying RosterRadius, testing it and demonstrating it. Every name, identifier and date is invented. Regenerate it with `npm run synthetic`; the output is always the same.

**Synthetic Unified School District:** 4 schools (two elementary, one middle, one high), 1,660 students and 85 staff.

| Folder or file | What it is |
|---|---|
| `oneroster/` | A OneRoster 1.1 export. `demographics.csv` is included because real exports have it; RosterRadius never opens it. |
| `clever/quizhub/students.csv` | A Clever "Application Receives" students file for one app. |
| `exports/mathpath_students.csv` | The nightly SFTP export sent to one app. Its `Locker` column is not in the catalog, on purpose. |
| `inventory.csv` | The app inventory: 8 apps from 7 vendors. |
| `contracts.csv` | 5 data privacy agreements. |
| `declared.csv` | What the district published on its privacy page. It leaves out two vendors and some data on purpose, and still lists a vendor that no longer receives data. |

OneRoster `sourcedId` values (`or-u-00001`) differ from the district's own student IDs (`100001`), which Clever and the SFTP export use, as often happens in real exports.

## The scenario

The apps are chosen so that every alert rule appears at least once, with "today" set to 2026-11-17.

| App | Vendor | Channel | What it shows |
|---|---|---|---|
| ReadWell | Acme Learning | Clever | Date of birth an instructional app does not need; IEP status to review and outside the contract |
| MathPath | Acme Learning | SFTP export | Home address and meal eligibility it does not need, outside the contract; fields measured from the export file |
| LunchLine | Food Services Co | SFTP | Meal eligibility it does need; contract expired on 2026-06-30 |
| QuizHub | QuizHub Inc | Clever | No category; terms of service with no Exhibit B; students from a Clever file |
| FamilyTalk | Family Messaging LLC | Manual upload | No contract; only a student count, so results are a range |
| ClassCloud | Classroom Cloud Inc | Clever | Contract ending on 2026-12-31 |
| ShelfScan | Library Systems Co | SFTP | Student passwords |
| RouteRider | Transit Apps LLC | SFTP | Home address a transportation app does need; contract end recorded only in the inventory |
