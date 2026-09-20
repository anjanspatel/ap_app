# No-Claude-Required Statement

**Nothing about this app running, serving users, or storing data depends
on Claude, Claude Code, or Anthropic in any way, at any point after
deployment.** This document states exactly what that claim rests on, so
it doesn't have to be taken on faith.

## What actually keeps the site running

- **Cloudflare Worker `ap-app`** — runs `worker/src/index.js`, a single
  JavaScript file with zero external dependencies, executing entirely on
  Cloudflare's own infrastructure. It has no code path that calls
  Anthropic's API, reads a Claude-related environment variable, or
  depends on any file outside itself and its D1 binding.
- **Cloudflare D1 database `ap-workspace`** — stores all user accounts,
  sessions, and saved lookups. Standard SQLite-compatible storage, owned
  directly in your own Cloudflare account.
- **Cloudflare Pages / GitHub Pages** — serves the static HTML/CSS/JS.
  Plain files, no build step, no AI involvement at request time.
- **GitHub repo `anjanspatel/ap_app`** — the source of truth for code and
  docs, owned directly in your own GitHub account.

All four of the above belong to accounts you control (Cloudflare,
GitHub) — not to Claude Code, not to Anthropic, not to this session.
Deleting this Claude Code session, revoking its access, or Anthropic
ceasing to exist tomorrow changes nothing about whether the site keeps
running.

## What Claude Code was actually used for (all one-time, all in the past)

- Writing the application code (`worker/src/index.js`, the frontend
  pages, the test suite).
- Writing the GitHub Actions workflow files that now live as plain YAML
  in `.github/workflows/`.
- Diagnosing issues by triggering those same workflows and reading their
  logs back — because this session's own sandbox has **no direct network
  access** to the production domains (confirmed repeatedly: `curl` and
  `WebFetch` both return `EGRESS_BLOCKED` for both `app.anjanpatel.ca`
  and `*.pages.dev`). The GitHub Actions runners, which do have internet
  access, did the actual checking.
- Writing this documentation.

None of that is a runtime dependency. Once a workflow file is committed,
running it again requires nothing but clicking **Run workflow** on the
Actions tab — GitHub executes it on GitHub's own runners, with no
Claude Code session involved.

## Two things Claude Code specifically could **not** do, by design

These aren't oversights — they're safety restrictions built into Claude
Code itself, confirmed by testing them directly rather than assumed:

1. **Reading real production data rows** (e.g., `SELECT count(*) FROM
   users`) is blocked by Claude Code's own classifier as a "Production
   Reads" restriction, independent of any Cloudflare permission. Schema
   reads (table names, column names) are allowed; row data is not.
2. **Inspecting credentials or auth state** (e.g., checking whether a
   `wrangler` CLI is installed/authenticated in the sandbox) is blocked
   as "Credential Materialization."

Practically, this means: Claude Code was never able to see your users'
real data or hold live Cloudflare credentials, even during active
development. There's no lingering access to revoke.

## What you need to keep this running yourself, forever

- A Cloudflare account (already have one — the Worker, D1 database, and
  Pages project live in it).
- A GitHub account (already have one — the repo lives in it).
- The two GitHub Actions secrets already configured:
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Nothing else. No Claude API key, no Anthropic account, no third-party
  auth provider, no other paid service.

See `docs/CLOUDFLARE-RUNBOOK.md` for how to make a change yourself, and
`docs/DISASTER-RECOVERY.md` for what to do if something breaks.
