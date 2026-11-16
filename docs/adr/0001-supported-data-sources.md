# ADR 0001: Start from files the district already has, and treat platform APIs as later sources

- **Status:** accepted
- **Date:** 2026-11-16

## Context

RosterRadius needs to know, for each vendor, which student data fields it receives, through which channel, for how many students, and what the contract allows. A district usually sends data through several channels at once: a rostering hub (Clever or ClassLink), direct SFTP exports, manual uploads, and apps that teachers connect to Google or Microsoft accounts.

We reviewed the public documentation of each candidate source (November 2026):

- **Clever.** On each app's page, a district admin can download "Application Receives" CSV files for schools, students, sections, teachers, staff and district admins. Clever states that these files include only basic details about each shared record and that the app may receive additional fields through Field Access ([Sharing Permissions: Overview](https://support.clever.com/hc/s/articles/203115007?language=en_US)). The files show **who** is shared, not **which fields**. Field Access is shown per app on screen; we found no export of it.
- **Clever and ClassLink APIs.** A partner app only receives the data each district shared with that app ([Clever Secure Sync](https://dev.clever.com/docs/secure-sync-rostering)). A partner API cannot show what other apps receive, so it cannot build a district-wide inventory.
- **ClassLink Roster Server.** Permissions and Shared Fields are configured per app. Release notes mention a CSV export of applications, but its columns are not documented publicly ([release notes](https://classlink.my.site.com/ClassLinkCustomerService/s/article/roster-server-release-notes)). We asked ClassLink support on 2026-11-15.
- **OneRoster 1.1 CSV.** An open standard that districts can export from their SIS or rostering hub. It is enough to count students by school, grade and role.
- **Data privacy agreements.** The National Data Privacy Agreement lists the student data categories a vendor may receive in Exhibit B, and the disposition of data at the end of the contract in Exhibit D.
- **Published disclosure lists.** Several states require districts to publish which vendors receive student data (for example, Illinois [105 ILCS 85/27](https://ilga.gov/legislation/ilcs/documents/010500850K27.htm)). Districts often publish these lists through the SDPC Resource Registry or LearnPlatform. The data elements shown there are the ones declared for the contract, not a measurement of what flows. The SDPC API requires a Premium membership ([API guide](https://files.a4l.org/privacy/SDPC-API/SDPC_Resource_Registry_API_developers_guide.pdf)), and LearnPlatform stores data elements as free text.
- **Google Workspace and Microsoft 365.** Admin APIs list the third-party apps users authorized and their OAuth scopes ([Google tokens.list](https://developers.google.com/admin-sdk/directory/reference/rest/v1/tokens/list), [Microsoft oauth2PermissionGrants](https://learn.microsoft.com/graph/api/oauth2permissiongrant-list?view=graph-rest-1.0)). They show account access, not roster fields, and they require admin consent on a hosted service.

Two project rules constrain the choice: student values are read only in memory to count and are never stored, and the open-source tool runs locally without sending anything to a server.

## Decision

The open-source tool starts from files the district already has or can fill in, processed locally. Platform APIs come later, in the hosted platform, and only where they add data that files cannot.

Supported in v0.1:

| Source | What we read | What we keep |
|---|---|---|
| App inventory (CSV) | App, vendor, channel, fields, scope, optional contract dates and subprocessors | Everything in the file (no student data) |
| OneRoster 1.1 CSV (zip or folder) | Schools, classes, users and enrollments, streamed | Counts by school, grade and role |
| Clever "Application Receives" CSV files | Header row and record counts per collection | Counts and the list of columns present |
| Structured contract file | Allowed Exhibit B categories, end date, deletion terms | Everything in the file |
| Declared disclosure list (CSV) | Fields the district published for each vendor | Everything in the file |

Deferred:

- **SDPC export or API, and LearnPlatform:** v0.2, once a real export has been validated. Until then, the declared list is entered as CSV.
- **ClassLink export:** after its format is confirmed. Until then, Shared Fields are entered in the inventory.
- **Clever, ClassLink, Google and Microsoft APIs:** hosted platform (phase 2), with the district's consent.

Not planned:

- Inspecting network traffic or installing agents on district devices.
- Requiring vendors to integrate with RosterRadius.
- Storing any student-level value, including identifiers used to count distinct students.

The importers match column names case-insensitively and across known spellings (for example `Ell status`, `ell_status` and `roles.student.ell_status`). Unknown columns are reported for review instead of being dropped or causing a failure.

## Consequences

- The tool works for any district, whatever hub it uses, without accounts, API keys or vendor cooperation.
- Part of the inventory stays manual: fields per app come from the district's screens and records. We reduce the effort with a guided template and a catalog of common apps, and we report which values were measured and which were entered by hand.
- The Clever and ClassLink file formats are based on public documentation and have not yet been validated against a real district export. The documentation will say so until a district confirms them.
- Comparing declared lists with measured counts and channels becomes possible in v0.1, without depending on SDPC or LearnPlatform access.
- Revisit this decision when ClassLink answers, when a district shares a real export header, and before the hosted platform adds API integrations.
