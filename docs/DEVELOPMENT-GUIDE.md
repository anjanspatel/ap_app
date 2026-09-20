# Development Guide

## Requirements

- Node.js 18+ (only for running the test suite — nothing else needs it).
  No npm packages to install; `package.json` declares zero dependencies.
- A text editor. No build tool, bundler, or transpiler is used anywhere
  in this project — the frontend is plain HTML/CSS/JS served as-is.

## Repository layout

```
index.html, dashboard.html, settings.html   — top-level pages
flange/, torque/, tubing/                   — one engineering tool each
worker/                                     — Cloudflare Worker (the API)
  src/index.js                              — the entire backend, one file
  schema.sql, migrations/                   — D1 database schema
  wrangler.toml                             — Worker deploy config
test/                                       — node:test test files
.github/workflows/                          — manual-trigger CI/CD, see docs/CLOUDFLARE-RUNBOOK.md
docs/                                       — this handoff documentation
```

## Running the tests

```
node --test
```

Covers: password hashing/verification, bootstrap-admin idempotency, and
the pure-calculation engines for flange/torque/tubing (`flange/calc.js`,
`torque/calc.js`, `tubing/calc.js` — kept dependency-free and
unit-testable on purpose, separate from their `calc-page.js` DOM-wiring
counterparts).

## Working on the frontend

Open the HTML files directly in a browser, or serve the repo root with
any static file server (`python3 -m http.server`, VS Code's Live
Server, etc.) — there's no build step to run first. The site calls the
live API at `https://api.anjanpatel.ca`, so sign-in/save-lookup features
will hit production during local frontend testing; there is no local
mock backend. Be deliberate about what you test against production data
this way.

## Working on the backend (`worker/src/index.js`)

It's a single file with no imports beyond the Workers runtime's built-in
`crypto`. Add tests in `test/` for any new route or auth logic before
shipping — see `test/worker-auth.test.js` and
`test/worker-bootstrap.test.js` for the existing patterns (they import
directly from `worker/src/index.js`, so exported functions need to stay
exported for testability).

There is no local Cloudflare Workers emulator wired up in this repo —
changes are validated by unit-testing the exported pure functions
(`hashPassword`, `verifyPassword`, `isValidEmail`,
`maybeBootstrapAdmin`) and then deployed to the real `ap-app` Worker to
verify end-to-end (see `docs/CLOUDFLARE-RUNBOOK.md`).

## Conventions worth knowing before changing things

- **Never widen `_headers`' CSP back to `'unsafe-inline'`** — every page
  was deliberately converted off inline scripts/`onclick=` attributes
  (see git log for "CSP Phase B"). New interactive elements should be
  wired with `addEventListener` in an external `.js` file, and that
  script tag must load **after** the DOM elements it wires (a real
  regression from getting this backwards is documented in the git log —
  search for the dashboard sign-out-modal fix).
- **Formulas in `flange/calc.js`, `torque/calc.js`, `tubing/calc.js` are
  off-limits for casual changes** — they encode API 6A / bolt-torque /
  safety-block engineering references. Any change here needs the same
  scrutiny as a spec change, not a refactor.
- **The Worker has zero dependencies on purpose** — it needs to stay
  pasteable into Cloudflare's dashboard Quick Edit box as a single file
  (see `worker/README.md`). Don't add an npm package to `worker/`.
- **No email provider is connected, on purpose** — password reset is
  admin-initiated only (Admin Console → Users → Reset password). Don't
  add a "forgot password" email flow without deciding on an email
  provider first; see `worker/README.md`, "What this app can and can't
  do without a third-party service."
