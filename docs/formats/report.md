# Saved results format (v0.1)

RosterRadius saves its results as JSON documents: the **district report**, and the **incident report** for a breach. Other tools can read them, a district can keep them to compare years, and any later version of RosterRadius can tell whether it can open them.

See the examples from the [synthetic district](../../examples/synthetic-district/): [`report.json`](../../examples/synthetic-district/results/report.json) and [`incident-acme-il.json`](../../examples/synthetic-district/results/incident-acme-il.json).

**No document holds a student or staff identifier, name or value.** They hold counts, fields, vendors, apps, rules and inventory line numbers. The notification list of an incident, which does hold identifiers, is a separate CSV built on the district's computer and is never part of a document.

## Envelope

Every document has the same envelope:

```json
{
  "format": "rosterradius",
  "kind": "district-report",
  "formatVersion": "0.1.0",
  "generator": { "name": "@roster-radius/core", "version": "0.0.1" },
  "generatedAt": "2026-11-21T12:00:00.000Z",
  "data": { }
}
```

| Field | Meaning |
|---|---|
| `format` | Always `rosterradius`. |
| `kind` | `district-report` or `incident-report`. |
| `formatVersion` | Version of this format. See [Versions](#versions). |
| `generator` | The package and version that wrote the document. |
| `generatedAt` | When it was written. Optional, and left out by default, so the same inputs always give the same file. |
| `data` | The report. |

Files are UTF-8, end with a newline, and are indented with two spaces unless the tool is asked for the smallest file.

## Versions

A document carries three versions, which change for different reasons:

| Version | Where | Changes when |
|---|---|---|
| Format | `formatVersion` | The structure of the document changes |
| Methodology | `data.methodologyVersion` | The catalog, weights, baselines or rules change ([METHODOLOGY.md](../../METHODOLOGY.md)) |
| Package | `generator.version` | The software is released |

The format follows semantic versioning. A new **minor** version only adds fields, so a reader can open documents of other minor versions and ignore what it does not know. A new **major** version removes or changes fields. While the major version is 0, before the format is declared stable, a new minor version may also break readers, so readers accept only their own minor version. A document that cannot be read is refused with a message saying which version it uses, never read wrongly.

## District report

`data` holds:

| Field | Meaning |
|---|---|
| `methodologyVersion`, `weights` | The methodology version and the weight of each sensitivity class used. |
| `today` | The date the analysis is for. Contract dates are checked against it. |
| `inputs` | Every file read, with its role, SHA-256 hash and size ([traceability](../../METHODOLOGY.md#31-traceability)). |
| `totals` | Schools, students, staff, apps, vendors and channels, and the distinct students and staff whose data reaches at least one vendor. |
| `flows` | One entry per inventory line: app, vendor, channel, category, fields, whether the fields and people were measured or entered, how people were matched to the roster, and subprocessors. |
| `students`, `staff` | Exposure by vendor (`byVendor`) and by app (`byApp`), most exposed first. |
| `sharedFields` | Each student or guardian field shared with at least one vendor, with the number of students and the vendors. |
| `alerts` | The alerts, most severe first, each with its rule, fields, people affected, message and inventory lines. |
| `scenarios` | Every vendor and channel as a breach scenario, worst first. |
| `contracts`, `declarations` | The contracts and the published list as read. |
| `disclosure` | The comparison of the published list with what flows. Present only when a published list was given. |
| `issues` | Problems found in the input files, with the file and line. |

An exposure result (in `students`, `staff` and `scenarios`) has:

| Field | Meaning |
|---|---|
| `id` | The vendor or app, or the scenario. |
| `people` | Distinct people whose data reaches it. |
| `points` | The exposure score ([methodology, section 6](../../METHODOLOGY.md#6-exposure)). |
| `peopleByClass` | For each sensitivity class, the people with at least one field of that class exposed. |
| `fields`, `ignoredFields` | Fields counted, and fields received but not counted for this population. |
| `topClass` | The most sensitive class exposed. |
| `flowsWithoutScope` | Flows left out because they do not say which people they reach. Non-zero means the result is incomplete. |
| `lines` | Inventory lines of the flows counted. |

Counts that may be known only as a range are given as `{ "min": 1600, "max": 1600, "exact": false }`. `exact` is true when every flow listed its people. When it is false, the true value lies between `min` and `max`.

## Incident report

`data` holds:

| Field | Meaning |
|---|---|
| `methodologyVersion`, `weights` | As in the district report. |
| `id`, `scope` | What was breached: a vendor, an app or a channel. |
| `notifiedOn`, `state` | The date the district was notified, and its state, when given. |
| `vendors`, `apps`, `channels` | What the breached scope covers. |
| `students`, `staff` | The people affected, by sensitivity class and by field, with the apps each field came through, the people who could not be listed because they are known only by a count, and the share of enrollment. |
| `deadlines` | The state's breach duties. The district's duties with a fixed number of days have their last day in `dueOn`. |
| `findings` | State rules applied to this incident, with their citations. |
| `disclaimer` | Always present: the report is not legal advice. |
