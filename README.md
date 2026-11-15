# RosterRadius

[![CI](https://github.com/bandrade93/roster-radius/actions/workflows/ci.yml/badge.svg)](https://github.com/bandrade93/roster-radius/actions/workflows/ci.yml)

**Which vendors receive which student data, and how many students would each one expose in a breach?**

RosterRadius is an open-source tool for U.S. K-12 school districts, built first for small and rural districts that have no dedicated security team. It reads the files a district already has and answers, in plain language, which vendors hold which kinds of student data and how large each vendor's *exposure radius* is.

> **Status: early development.** There is no usable release yet. This README describes what the project is building; features are marked as available only once they ship. Follow progress in the commit history and releases.

## The problem

Districts share student data with dozens of technology vendors through several channels at once: rostering platforms, scheduled SFTP exports from the student information system, and manual uploads. Each channel shows its own piece. Few districts can answer, in one place, which vendor receives which fields about which students, or what a breach at one vendor would mean.

## What RosterRadius will do

- **Consolidate** the data each vendor receives, field by field, across every channel a district uses.
- **Quantify exposure**: how many distinct students, and which kinds of data, each vendor holds.
- **Flag data that looks unnecessary** for the kind of app receiving it, and show how much exposure removing it would cut.
- **Compare contracts with actual data flows**, using the data categories of the National Data Privacy Agreement (NDPA) where available.
- **Flag expired contracts while data is still flowing.**
- **Answer an incident in minutes**: when a vendor reports a breach, show which students and which kinds of data are affected.

## Design principles

1. **Metadata only.** RosterRadius keeps field names, vendors, scopes and counts. Student values (names, birth dates, grades) are read in memory to be counted and are never stored or written to a report.
2. **Runs locally.** The open-source tool runs on the district's own computer. Nothing is uploaded.
3. **Works with what districts already use.** It reads existing exports and files; no vendor has to integrate with it.
4. **Every number is traceable** to the input file and the rule that produced it.
5. **Built for non-specialists.** A district technology director without security training must be able to read the results.

## Project structure

```
packages/
  core/     the exposure engine (in progress)
docs/
  adr/      architecture decision records
```

## Development

Requires Node.js 22 or later (every Node.js line with upstream support is tested in CI).

```bash
npm install
npm test
npm run typecheck
```

Never commit real district or student data. Use synthetic data for tests and examples; the `private/` folder is git-ignored for local inputs.

## Security

See [SECURITY.md](SECURITY.md) to report a vulnerability privately.

## License

[Apache-2.0](LICENSE)

## Author

Created and maintained by Bruno Persona Negrão de Andrade.
