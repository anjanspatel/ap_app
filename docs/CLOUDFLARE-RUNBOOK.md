# Cloudflare Runbook — making changes to the live system

Every command and dashboard path below was checked against this repo's
actual files and the real Cloudflare account state on 2026-09-20 (see
`docs/PRODUCTION-INVENTORY.md`) — not written generically. Real names
used throughout: Worker **`ap-app`**, D1 database **`ap-workspace`**,
Pages project **`ap-workspace`**, GitHub repo **`anjanspatel/ap_app`**.

## Ship a frontend change (HTML/CSS/JS at the repo root)

1. Edit the files (e.g. `dashboard.html`, `torque/calc-page.js`).
2. Commit and push to `main`.
3. **Pushing alone does not deploy it** — the Pages deploy workflow is
   manual-trigger only on purpose (see that file's header comment for
   why). Go to the repo's **Actions** tab → **Deploy preview to
   Cloudflare Pages** → **Run workflow** → branch `main`.
4. That workflow both creates the `ap-workspace` Pages project if it
   doesn't exist yet and deploys to it — safe to re-run any time.

**No-terminal alternative** doesn't exist for the frontend the way it
does for the Worker — Pages deploys need either this workflow or a local
`wrangler pages deploy`. If you ever install Node + `wrangler` locally:
```
wrangler pages deploy . --project-name=ap-workspace
```
(run from the repo root, after `rsync`-excluding `.github`, `.git`,
`test`, `package.json` the same way the workflow does — or just deploy
the whole tree; the exclusions only matter for keeping dev-only files
off the live site).

## Ship a backend change (`worker/src/index.js`)

**Option A — no terminal (dashboard Quick Edit):**
1. Cloudflare dashboard → **Workers & Pages** → **`ap-app`** → **Edit
   code** (Quick Edit).
2. Open `worker/src/index.js` locally, select all, copy, paste over the
   existing code in Quick Edit, replacing it entirely.
3. **Save and deploy.**

**Option B — GitHub Actions (requires the two repo secrets already
configured):**
1. Commit and push your change to `main`.
2. Actions tab → **Deploy AP Workspace API (Cloudflare Worker)** → **Run
   workflow**.
3. This runs `wrangler deploy` from the `worker/` folder using
   `worker/wrangler.toml`, which is now correctly pointed at `ap-app`
   (fixed 2026-09-20 — it previously said a different name that would
   have created a second, disconnected Worker instead of updating the
   real one; see the comment at the top of that file).

**Before either option**, run the test suite locally to catch regressions:
```
node --test
```
No `npm install` needed — zero dependencies (see
`docs/PRODUCTION-INVENTORY.md`).

## Change the database schema

1. Write a new migration file in `worker/migrations/` (see
   `0001_auth_hardening.sql` for the existing pattern — additive changes
   only, never destructive, since real user data lives here).
2. Cloudflare dashboard → **Workers & Pages → D1 → `ap-workspace` →
   Console** tab.
3. Paste the migration's SQL, click **Execute**.
4. Commit the migration file to the repo too, so the schema history
   stays documented even though D1 itself doesn't version schemas.

## Rotate or remove the bootstrap-admin secrets

Cloudflare dashboard → **Workers & Pages → `ap-app` → Settings →
Variables and Secrets**. `BOOTSTRAP_ADMIN_USERNAME` /
`BOOTSTRAP_ADMIN_PASSWORD` are safe to leave configured indefinitely
(the Worker no-ops once any admin exists) or delete once you've
confirmed you can sign in — see `worker/README.md` for the full
explanation of this mechanism.

## Roll back a bad frontend deploy

Cloudflare Pages keeps every previous deployment. Dashboard → **Workers
& Pages → `ap-workspace` (Pages project) → Deployments** tab → find the
last known-good deployment → **Rollback to this deployment**. This is
faster and safer than trying to revert commits and redeploy.

## Roll back a bad Worker deploy

Same idea: **Workers & Pages → `ap-app` → Deployments** tab → pick a
previous version → roll back. Redeploying an older Git commit via either
deploy option above also works, but the dashboard rollback is instant.

## Diagnose whether the live site is actually reachable

Actions tab → **Live production check (read-only, one-off)** → **Run
workflow**. It's read-only (no login, no writes) and checks response
headers and console/page errors on `/`, `/dashboard.html`, `/torque/`,
and `/flange/` against the real `app.anjanpatel.ca` domain, using a
GitHub-hosted runner (this sandbox itself has no direct network access
to production — see `docs/NO-CLAUDE-REQUIRED.md`). As of this writing
it's still surfacing the open incident in
`docs/PRODUCTION-INVENTORY.md` — check **Security → Events** in the
Cloudflare dashboard first if you're picking this back up.
