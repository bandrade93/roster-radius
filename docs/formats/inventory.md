# App inventory format (v0.1)

The app inventory is the file a district fills in to tell RosterRadius which apps receive student and staff data, through which channel, which fields, and for whom. It is a CSV file with a header row, encoded in UTF-8, with commas between columns. Files saved with semicolons or tabs, as spreadsheet programs in many countries do, are also read, with a warning. Empty rows are skipped.

Each row is one **flow**: one app receiving data through one channel. An app that receives data through two channels, for example Clever and an SFTP export, has two rows.

The inventory never contains student data. It contains app names, vendor names, field names and how to find the students.

See [`inventory-example.csv`](inventory-example.csv) for a complete example with fictional apps and vendors, and start from [`inventory-template.csv`](inventory-template.csv).

## Columns

Columns can appear in any order. Column names are matched without regard to case. Unknown columns are reported and ignored. Inside a cell, lists use `|` as the separator, so that the file works with spreadsheet programs that use commas or semicolons.

| Column | Required | Example | Meaning |
|---|---|---|---|
| `app` | yes | `ReadWell` | The app's name. Rows with the same name are the same app. |
| `vendor` | yes | `Acme Learning` | The company that receives the data. All apps of a vendor are combined in vendor exposure. |
| `channel` | yes | `clever` | How the data reaches the vendor. See [Channels](#channels). |
| `fields` | yes | `student.first_name\|student.birth_date` | The fields the app receives. See [Fields](#fields). |
| `category` | no | `instructional_content` | The kind of app, used to flag unnecessary data. One of the [category keys](#categories). Empty means not classified, and the tool says so. |
| `channel_id` | no | `sftp:district-export` | Which instance of the channel. See [Channels](#channels). |
| `students` | no | `all` | Which students the app receives. See [Who is reached](#who-is-reached). |
| `staff` | no | `teachers` | Which staff the app receives. See [Who is reached](#who-is-reached). |
| `schools` | no | `Lincoln Middle\|Roosevelt Middle` | Limits `students` and `staff` to these schools, by name or by OneRoster `sourcedId`. Empty means every school. |
| `grades` | no | `KG\|01\|02` | Limits `students` to these grades, using OneRoster grade codes (`PK`, `KG`, `01` to `12`). Empty means every grade. |
| `contract_end` | no | `2027-06-30` | Last day of the vendor's data privacy agreement, as `YYYY-MM-DD`. |
| `deletion_days` | no | `60` | Days after the end of the agreement by which the vendor must delete the data. |
| `subprocessors` | no | `CloudHost Inc\|TutorAI Labs [ai]` | Companies the vendor passes the data on to, as its agreement or privacy policy lists them. Mark AI model providers with `[ai]`. See [Subprocessors](#subprocessors). |
| `notes` | no | | Free text for the district. Not used in calculations. |

## Channels

`channel` says how data travels. One of:

| Value | Meaning |
|---|---|
| `clever` | Shared through Clever |
| `classlink` | Shared through ClassLink Roster Server |
| `sftp` | A file sent by SFTP, usually a scheduled export from the student information system |
| `oneroster` | A OneRoster file or API connection set up directly with the vendor |
| `manual_upload` | A file uploaded by hand by district staff |
| `sso` | Data passed when users sign in with Google, Microsoft or another identity provider |
| `other` | Anything else; describe it in `notes` |

`channel_id` says which instance of the channel the flow uses. It matters for incident scenarios: a breach of one channel affects every flow with the same `channel_id`. When it is empty:

- `clever` and `classlink` flows share one instance per district (`clever`, `classlink`), because the district has one account on each platform;
- other channels get one instance per vendor (for example `sftp:Acme Learning`), because each vendor usually has its own server or upload page.

Set `channel_id` explicitly when several vendors receive files from one shared place, for example a district SFTP server that vendors download from.

## Fields

`fields` lists the fields the app receives, separated by `|`. Each entry is either a catalog key, such as `student.birth_date`, or a catalog label, such as `Date of birth`, matched without regard to case. The [accepted fields](fields.md) table lists every key and label, with the Clever and OneRoster column names.

Instead of a list, `fields` can point to a file: `file:exports/mathpath_students.csv`. The tool then reads only the header row of that file and recognizes its column names. Use this for SFTP exports and uploads, where the district has the exact file the vendor receives. Fields read from a file are reported as **measured**; fields typed into the inventory are reported as **entered**.

## Who is reached

`students` and `staff` say whose data the app receives:

| Value | `students` | `staff` |
|---|---|---|
| `all` | Every student in the selected schools and grades | Every staff member in the selected schools |
| `teachers` | Not allowed | Teachers of the selected schools |
| `none` | No students | No staff |
| `count:N` | Only the number of students is known, for example `count:1700` | Only the number of staff is known |
| `file:PATH` | The students listed in a file, for example the Clever "Application Receives" students file | The staff listed in a file |

When `students` is empty, it means `all` if the row has student or guardian fields, and `none` otherwise. When `staff` is empty, it means `none`, and a row with staff fields but no `staff` value is reported as an error, because the tool cannot know which staff are reached.

`all` and `teachers` are resolved with the district's OneRoster files. A `file:` value is read in memory to identify the people and is never stored. A `count:` value cannot be matched with other flows, so results that use it are given as a range (see the [methodology](../../METHODOLOGY.md#63-flows-with-counts-only)).

Paths in `file:` values are relative to the folder of the inventory file.

## Subprocessors

`subprocessors` lists the companies that receive the data from the vendor: hosting, analytics, support tools and AI model providers. Vendors usually publish this list in their data privacy agreement or on a subprocessors page, and Illinois requires districts to publish it for each operator (105 ILCS 85/27(a)(3)).

Write each name once, separated by `|`. Add `[ai]` after a provider whose AI models receive the data, for example `TutorAI Labs [ai]`. A vendor that runs its own models is not a subprocessor; record that in `notes`.

In v0.1 the report lists the subprocessors of each vendor and flags the AI providers. Counting the students whose data reaches them, as potential exposure, is planned for v0.2.

## Categories

`category` is one of: `instructional_content`, `learning_management`, `assessment`, `family_communication`, `special_education`, `nutrition`, `transportation`, `library`, `student_information_system`. They are described in the [methodology](../../METHODOLOGY.md#71-what-each-kind-of-app-needs).

## Contract columns

`contract_end` and `deletion_days` are a quick way to record the essentials of an agreement. They raise the "contract expired" and "contract expiring" alerts. Comparing fields with the agreement's Exhibit B needs the structured contract file, which is described separately.
