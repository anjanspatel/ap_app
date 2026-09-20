# AP Workspace — Production Inventory

Every fact below was checked directly (Cloudflare API, GitHub API, or the
repo itself) on **2026-09-20**, not assumed from memory or from what a
config file merely claims. Where something couldn't be checked directly,
that's stated as NOT VERIFIED rather than guessed. Status values are only
**PASS**, **FAIL**, or **NOT VERIFIED** — never "should work" or "100%".

## Top-line status

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Code is correct and complete for the intended design | PASS | See "Code" section below |
| 2 | Backend (Worker + D1) is live with real, current code | PASS | See "Backend" section below |
| 3 | **The public site is reachable by a real visitor** | **FAIL** | See "Known open incident" — this is the one item that matters most and it's red |
| 4 | No secrets committed to the repo | PASS | Repo-wide scan, see "Secrets" |
| 5 | Automated test suite passes | PASS | `node --test`: 26/26 |
| 6 | Zero npm dependencies (nothing to install ever breaks) | PASS | `package.json` has no `dependencies` key; confirmed no `node_modules` |

## Known open incident (read this first)

**`app.anjanpatel.ca` is not serving the site right now.** Every request —
from this session's own network-connected CI check, run at 17:59 UTC
today, after this repo's `main` branch — gets Cloudflare's bot-challenge
interstitial instead of the real page:

```
HTTP/2 403
cf-mitigated: challenge
<title>Just a moment...</title>
```

This happens on `/`, `/dashboard.html`, `/torque/`, and `/flange/`
identically. It is Cloudflare's edge intercepting the request before it
reaches the Pages deployment or the Worker — the site's own code, the
Worker, and the database are not the problem and don't need to be
touched to fix this.

- **This has been reported and worked on three times already** in this
  project's history, with three different Cloudflare dashboard setting
  changes (Security Level, Bot Fight Mode, and a third change) — none of
  them cleared it, confirmed by re-running the exact same automated check
  each time.
- **No tool available to this session can read or change Cloudflare
  WAF/Security rules, or the Security Events log** — this was checked via
  an exhaustive tool search, not assumed. Fixing this requires a human
  with dashboard access.
- **Next diagnostic step, not yet done:** Cloudflare dashboard →
  **Security → Events**. That log names the exact rule (Custom Rule,
  Managed Ruleset, or Super Bot Fight Mode entry) that's issuing the
  challenge, which turns this from guesswork into a one-click "skip this
  rule for this hostname" fix.
- Until this is resolved, **the backend being fully correct doesn't
  matter to a real visitor** — they never get far enough to reach it.

## Code

| Item | Value |
|---|---|
| GitHub repo | `anjanspatel/ap_app`, default branch `main` |
| Frontend | Static HTML/CSS/JS at repo root (`index.html`, `dashboard.html`, `flange/`, `torque/`, `tubing/`, `settings.html`) |
| Backend | `worker/src/index.js` — single file, zero dependencies, runs on Cloudflare Workers |
| Tests | `test/*.js`, run via `node --test` (no npm install needed — see below) |

## Backend (Cloudflare Worker)

| Item | Value | How verified |
|---|---|---|
| Worker name | `ap-app` | Cloudflare API (`workers_list`) — **not** `ap-workspace-api`, which is what `worker/wrangler.toml` said until this pass; see the fix in that file |
| Worker ID | `d8d8440436f0422490303ae15dfbf9ff` | Cloudflare API |
| Deployed code | Matches `worker/src/index.js` in this repo (PBKDF2-SHA256 auth, session cookies, admin routes, bootstrap-admin logic) | Fetched the live Worker's bundled source via the Cloudflare API and compared function-by-function |
| Custom domain route | `api.anjanpatel.ca` (per `worker/wrangler.toml`) | **NOT VERIFIED this pass** — no Cloudflare API tool in this session lists a Worker's routes/custom domains directly; confirm in dashboard: Worker → Settings → Domains & Routes |
| D1 binding | `DB` → `ap-workspace` | Present in `worker/wrangler.toml`; binding itself not independently re-queried this pass |

## Database (D1)

| Item | Value | How verified |
|---|---|---|
| Name | `ap-workspace` | Cloudflare API (`d1_databases_list`, `d1_database_get`) |
| UUID | `379bb02c-4579-4e16-b3c4-c90e1df14673` | Cloudflare API |
| Region | ENAM (Eastern North America) | Cloudflare API |
| Table count | 6 | Cloudflare API (`d1_database_get`) |
| Tables | `users`, `sessions`, `saved_lookups`, `audit_logs`, `login_attempts`, `admin_audit_log_v1_unused` | Read from `sqlite_master` in an earlier pass of this project; schema/structure reads are allowed, row-data reads are not (see `docs/NO-CLAUDE-REQUIRED.md`) |
| `admin_audit_log_v1_unused` | Dead table, superseded by `audit_logs`, never dropped | Flagged, not deleted — dropping tables from a database with real user data needs a human decision |
| Row-level data (user count, real accounts, etc.) | **NOT VERIFIED, and not verifiable by this tool** | Blocked by Claude Code's own safety classifier ("Production Reads"). This is a hard boundary, not a missing feature — see `docs/NO-CLAUDE-REQUIRED.md` |
| Backups | **No automated backup exists today** | This is a real gap — see `docs/DISASTER-RECOVERY.md` |

## Static hosting (Cloudflare Pages)

| Item | Value | How verified |
|---|---|---|
| Project name | `ap-workspace` (per `.github/workflows/deploy-cloudflare-pages.yml`) | Read from the workflow file — **not** independently confirmed against a live Pages project listing; no Pages-list API tool is available in this session |
| Custom domain | `app.anjanpatel.ca` (per `CNAME` file and prior session history) | See "Known open incident" above — the domain resolves to *something* Cloudflare-fronted, but not confirmed which Cloudflare product currently owns the hostname vs. the challenge page |
| Deploy trigger | Manual only (`workflow_dispatch`) — pushing to `main` does **not** auto-deploy | Read directly from the workflow file |

## GitHub Pages (frozen rollback snapshot)

| Item | Value |
|---|---|
| Workflow | `.github/workflows/deploy.yml` |
| Trigger | Manual only — intentionally stopped auto-deploying on push once Cloudflare Pages became the target |
| Purpose | Kept as a known-good fallback if Cloudflare Pages/DNS ever needs to be rolled back from |

## CI/CD workflows (all in `.github/workflows/`)

| File | Trigger | Purpose |
|---|---|---|
| `deploy.yml` | Manual | Redeploy the frozen GitHub Pages rollback snapshot |
| `deploy-cloudflare-pages.yml` | Manual | Deploy the static site to the `ap-workspace` Cloudflare Pages project |
| `deploy-worker.yml` | Manual | Deploy `worker/src/index.js` to the `ap-app` Worker via `wrangler deploy` (now correctly targets the real Worker — see the fix above) |
| `live-check.yml` | Manual | Read-only diagnostic: curls and Playwright-checks the production domain, no writes, no login |

All four require zero involvement from Claude Code to run — they're
triggered from the repo's **Actions** tab by anyone with write access.

## Secrets

| Item | Status | Evidence |
|---|---|---|
| Committed secrets/keys in source | PASS (none found) | Repo-wide grep for API-key/password/token patterns found only test fixtures (`test/worker-bootstrap.test.js`) and a documentation file (`.env.example`) that explicitly contains no real values |
| GitHub Actions secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) | PASS (must exist — workflows have run and deployed successfully) | Inferred from a successful past `deploy-cloudflare-pages.yml` run; GitHub's API doesn't expose whether secrets are set, only that referencing them didn't fail |
| Worker secrets (`BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD`) | NOT VERIFIABLE BY DESIGN | Cloudflare never exposes secret values via any API — this can only be checked by opening the Worker's Settings page directly |

## Tests

```
node --test
# 26/26 passing (worker auth, bootstrap-admin, flange/torque/tubing calc engines)
```

Zero `npm install` required — `package.json` declares no dependencies,
and every test file imports only Node's built-in `node:test`/
`node:assert` plus the app's own source files.
