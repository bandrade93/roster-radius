# ADR 0002: Build the local page with React, Vite and TypeScript, in this repository

- **Status:** accepted
- **Date:** 2026-11-22

## Context

The main deliverable of v0.1 is a page where a district loads its files and sees the results, with nothing sent anywhere (task 1.5.4). The same results are also saved as documents ([format](../formats/report.md)) and shown in an offline HTML report (task 1.5.2). The choice of technology has to meet these requirements:

- **Nothing leaves the browser, verifiably.** The district's files are read on its own computer. The page loads no outside resources (no CDN, analytics or web fonts), and a reviewer must be able to check that it makes no network request.
- **Large files.** A district with tens of thousands of students has large OneRoster files. The engine already reads files in chunks; it must also run off the main thread so the page stays responsive.
- **Identifiers stay contained.** The engine holds student identifiers in memory to count people once and to build the incident notification list. The code that draws the page should never see them.
- **Accessibility.** School districts must make their web content and apps conform to WCAG 2.1 Level AA under the Department of Justice's 2024 rule for ADA Title II ([ADA.gov compliance guide](https://www.ada.gov/resources/small-entity-compliance-guide)). The Department extended the compliance dates by one year in April 2026.. Districts may not be able to adopt a tool they cannot make accessible.
- **Few dependencies.** This is a privacy tool: every dependency is code a reviewer has to trust.
- **Maintenance.** The maintainer works in React, and the hosted platform planned after v0.1 can reuse the same components.
- **One way to draw results.** The page draws a report whether it was just computed or loaded from a saved document, so the HTML report can reuse it.

Options considered:

| Option | For | Against |
|---|---|---|
| React + Vite | Known to the maintainer; reusable in the hosted platform; large ecosystem, including accessible components | More dependencies and runtime size than the alternatives |
| Preact + Vite | React's API in a much smaller runtime | Some React libraries do not work fully |
| Svelte + Vite | Small and concise | New to the maintainer; not reusable in the hosted platform |
| Plain TypeScript or Web Components | Almost no dependencies | Much hand-written work for screens with tables, filters and charts |

Runtime size matters little for a page that runs locally, so it does not outweigh maintenance and reuse.

## Decision

Build the page with **React, Vite and TypeScript**, as the package `packages/web` in this repository, next to the engine.

- **Same repository.** The page and the engine change, are tested and are released together, and a reviewer can audit both in one place. Only the hosted platform will live in a separate, private repository.
- **The engine runs in a Web Worker.** The worker reads the files, runs the analysis and keeps the resolved flows, with their identifiers, in its own memory. The page receives only the report, which holds no identifiers. Incident reports, reduction simulations and the notification list are requested from the worker, which answers from the flows it holds.
- **No network.** The production build sets a Content Security Policy with `connect-src 'none'`, and allows scripts, styles, workers and images only from the page itself. The page loads no outside resource. An end-to-end test will check that no request is made (task 1.6.1).
- **Distribution.** The standard Vite build: a static folder that can be hosted anywhere, such as GitHub Pages, with no server code. For development, `npm run dev`.
- **The engine is used from its source** through an alias, until it gets its own build for publication on npm (task 1.6.5).
- **Accessibility target:** WCAG 2.1 Level AA, checked in the end-to-end tests.

## Consequences

- The page is a static site: there is no server that could receive data, which is easy to explain and to check.
- Keeping identifiers in the worker means every view that needs them (incident, notification list, reduction) goes through a message to the worker. This is more code than sharing memory, and it is the point.
- React and Vite add dependencies. They are limited to the page; the engine keeps a single runtime dependency.
- **Open question, to decide at the release (task 1.6.5):** whether to also offer a download that works without internet. Browsers do not run the standard build when it is opened from disk, so this needs either a build that bundles the page into one HTML file or a command that serves the page on the district's own computer.
