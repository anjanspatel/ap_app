# AP Workspace API — deploy guide (dashboard only, no terminal)

This replaces Supabase with a backend that runs entirely on Cloudflare —
Workers + D1 — inside your own Cloudflare account. Everything below is
done by clicking through **dash.cloudflare.com** in a browser. No
terminal, no npm, no command-line tools of any kind, and no other
service besides Cloudflare itself.

> **This is already done in production.** The Worker (`ap-app`), the D1
> database (`ap-workspace`), and the `api.anjanpatel.ca` route all exist
> and are live today — verified directly against the Cloudflare account,
> not assumed. Steps 1–7 below are the from-scratch instructions kept for
> disaster recovery (see `../docs/DISASTER-RECOVERY.md`) or setting this
> up again elsewhere; you don't need to repeat them to keep the current
> site running. See `../docs/PRODUCTION-INVENTORY.md` for the exact,
> current resource names/IDs, and `../docs/CLOUDFLARE-RUNBOOK.md` for how
> to ship a code change to the *existing* Worker.

## 1. Create a Cloudflare account

If you don't already have one: cloudflare.com → Sign up. Free plan is
enough for this.

## 2. Create the database

1. In the Cloudflare dashboard, go to **Workers & Pages → D1**.
2. Click **Create database**. Name it `ap-workspace`. Create.
3. Open the new database, go to its **Console** tab.
4. Open `schema.sql` (in this folder), copy its entire contents, paste
   into the Console, and click **Execute**.

## 3. Add your first account(s)

1. Open `seed-users.sql` (in this folder). Edit the placeholder row(s)
   with real email/name/admin values for yourself (and anyone else who
   needs an account) — leave the `password_hash` values exactly as
   they are.
2. Paste the edited SQL into the same D1 Console and click **Execute**.
3. Everyone signs in the first time with the password `ChangeMe123!` —
   the app forces a password change immediately after that first sign-in
   (`must_change_password` on the row), before anything else is usable.

If you're running this against an **existing** database (one that already
has accounts and data on it), don't re-run `schema.sql` — run
`migrations/0001_auth_hardening.sql` once instead. It adds the columns/
tables this section needs without touching existing rows.

## 4. Create the Worker

**Faster alternative to steps 4-6 below, if you'd rather not click through
bindings and routes by hand:** Workers & Pages → Create → **Import a
repository** → connect this GitHub repo → set the project's root
directory to `worker/`. Cloudflare reads `wrangler.toml` (already in this
folder, pointed at the real production database) and configures the D1
binding and the `api.anjanpatel.ca` route automatically as part of the
import — skip straight to step 7. Every future `git push` to `main` then
redeploys the Worker automatically too, the same way GitHub Pages already
auto-deploys the frontend.

Prefer to click through it by hand, or the Git-import option isn't
available on your plan? Continue with the manual steps below — they
produce the exact same result.

1. Go to **Workers & Pages → Create → Workers → Create Worker**.
2. Name it `ap-workspace-api`. Deploy the default starter (you'll
   replace its code next).
3. Open the Worker → **Edit code** (Quick Edit).
4. Open `src/index.js` (in this folder), select all, copy, and paste
   it over the starter code in the Quick Edit box, replacing it
   entirely.
5. Click **Save and deploy**.

## 5. Connect the database to the Worker

1. On the Worker's page, go to **Settings → Bindings** (sometimes
   labelled **Variables and Bindings**).
2. Add a **D1 database** binding: variable name `DB` (must be exactly
   this, capital letters), database `ap-workspace`. Save.

## 6. Point api.anjanpatel.ca at the Worker

1. Still on the Worker's page: **Settings → Domains & Routes → Add →
   Custom Domain**.
2. Enter `api.anjanpatel.ca` and confirm. Cloudflare issues the TLS
   certificate automatically — this can take a couple of minutes.

(This assumes `anjanpatel.ca` is already using Cloudflare for DNS. If
it isn't yet, Cloudflare's domain setup wizard — **Add a site** — walks
you through pointing your domain's nameservers at Cloudflare first.)

## 7. Point the frontend at it

Nothing to do here — the site's pages already call
`https://api.anjanpatel.ca` (see `/api.js` at the repo root). Once step
6 finishes, sign-in works.

## Authentication architecture (2026-09-19 hardening pass)

- **Login by email or username.** The `identifier` field on sign-in is
  checked against `email` if it looks like one, otherwise `username`.
  Most accounts only need an email; `username` is there for cases like a
  bootstrap admin account that shouldn't need a real mailbox.
- **Password hashing: PBKDF2-SHA256, 100,000 iterations**, via the
  Workers runtime's native `crypto.subtle` — zero dependencies. Argon2id
  was considered first (it's the generally preferred choice today) but
  has no native implementation on Workers; using it would require a WASM
  package, which breaks this Worker's one deliberate constraint: a single
  file with zero dependencies that can be pasted straight into the
  dashboard's Quick Edit box. OWASP's current minimum-acceptable
  recommendation for PBKDF2-SHA256 is 210,000 iterations, but Cloudflare
  Workers' `crypto.subtle` implementation hard-caps PBKDF2 at 100,000 —
  a higher value throws at derive time rather than silently truncating,
  which is how this got caught. 100,000 is this platform's real ceiling
  for this primitive, not a deliberate security tradeoff.
- **Forced password change.** Every account created or reset by an admin
  (including the bootstrap seed) gets `must_change_password = 1`. The
  frontend checks this on sign-in and routes straight to Settings →
  Security with an explanatory banner before anything else — the account
  works for that one screen only until the password is changed.
- **Brute-force protection.** `login_attempts` tracks failed sign-ins by
  the identifier typed in (not by IP — Workers doesn't reliably expose a
  stable client IP behind Cloudflare's edge, and keying by identifier
  stops credential-stuffing against one account regardless of source
  IP). After 10 failures inside a 15-minute window, that identifier is
  locked out for 15 minutes; a successful sign-in clears it.
- **This is application-level rate limiting, not edge-level.** It stops
  one account from being brute-forced but doesn't stop a flood of
  requests generally. Pair it with a Cloudflare dashboard rate-limiting
  rule on `POST /api/auth/signin` (Security → WAF → Rate limiting rules,
  free plan includes a small number) for defense in depth at the edge —
  that's a dashboard toggle, not something this Worker can configure for
  itself.
- **Audit log.** Every account and session-affecting action writes a row
  to `audit_logs`: `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`,
  `PASSWORD_CHANGED`, `PASSWORD_RESET_BY_ADMIN`, `USER_CREATED`,
  `USER_UPDATED`, `USER_DELETED`, `USER_DISABLED`, `USER_ENABLED`,
  `ROLE_CHANGED`, `SESSION_REVOKED`. Never a password or hash — `details`
  is always a small, specific object.
- **Authorization is server-side, always.** Every `/api/admin/*` route
  calls `requireAdmin()`, which re-checks the session and the caller's
  `is_admin` flag on every single request — hiding the Admin Console nav
  item from a non-admin's browser is a UX nicety, not the enforcement.
- **Last-admin lockout is structurally impossible, not just checked for.**
  An admin can never target their own account through `/set-admin`,
  `/ban`, or delete (each has an explicit self-action guard). Since only
  *another* admin can revoke, disable, or delete an admin, and the sole
  remaining admin has no other admin to do that to them, the system can
  never reach zero admins through these APIs.
- **Bootstrap from Cloudflare secrets** (preferred over manually running
  `seed-users.sql`): set two Worker secrets, `BOOTSTRAP_ADMIN_USERNAME`
  and `BOOTSTRAP_ADMIN_PASSWORD` (Worker → Settings → Variables and
  Secrets — never as a repo file). The first request to any `/api/auth/*`
  route checks whether an admin already exists; if not, it hashes the
  secret password and creates exactly one admin from it, with
  `must_change_password` set. Running it again — or leaving the secrets
  configured indefinitely — is safe: it's a no-op once an admin exists.
  Once you've confirmed you can sign in, delete both secrets; after
  that the check is a single unset-env-var read per auth request, with
  no database query at all. See `.env.example` for the exact names.

## What this app can and can't do without a third-party service

Because there's no email provider connected (on purpose — one less
service to depend on), there is no self-service "forgot password" link.
If someone is locked out, an admin resets their password directly:
Admin Console → Users table → **Reset password** button next to their
name. That's this app's only password-recovery path.

## 8. Optional: move static hosting to Cloudflare Pages

The site itself (everything outside this `worker/` folder) currently
serves from GitHub Pages. GitHub Pages can't send custom HTTP response
headers, so a few security headers (`frame-ancestors`, `Permissions-
Policy`, and closing off a wildcard `Access-Control-Allow-Origin` on
HTML pages) can't be added there — only a `<meta>`-tag CSP can, which
covers most but not all of it. Moving the static site to Cloudflare
Pages fixes this, and since `anjanpatel.ca` is already on Cloudflare
DNS (step 6 above), there's no nameserver change — just a dashboard
project and one DNS record swap, whenever you're ready.

**This is optional and the live site keeps working exactly as-is until
you do the last step.** Steps 1–3 don't touch `app.anjanpatel.ca` at all.

1. **Add the two repo secrets** GitHub Actions needs (Settings → Secrets
   and variables → Actions → New repository secret):
   - `CLOUDFLARE_API_TOKEN` — dash.cloudflare.com → My Profile → API
     Tokens → Create Token (the "Edit Cloudflare Workers" template
     covers Pages too).
   - `CLOUDFLARE_ACCOUNT_ID` — shown in the right sidebar of any page in
     your Cloudflare dashboard.
2. **Push to `main`** (or run the workflow manually from the Actions
   tab). The `Deploy preview to Cloudflare Pages` workflow creates a
   `ap-workspace` Pages project and publishes to a `*.pages.dev` URL —
   this does not touch `app.anjanpatel.ca`.
3. **Check the preview.** Open the `.pages.dev` URL from that workflow
   run, sign in, and try the tools. Open your browser's dev tools →
   Network → click the page request → confirm `content-security-policy`
   and the other headers from `/_headers` are present in the response.
4. **Cut over the domain** (only once you're happy with step 3):
   - Workers & Pages → your `ap-workspace` Pages project → **Custom
     domains → Set up a custom domain** → enter `app.anjanpatel.ca`.
   - Cloudflare will offer to update the DNS record for you (it's the
     same account, so this is a one-click confirmation, not a manual
     DNS edit). Once it's active, GitHub Pages is no longer in the loop
     for this domain — the `deploy.yml` workflow can stay (harmless,
     just deploying somewhere nothing points at) or be deleted later.

## Ongoing maintenance

- **Cost**: Workers and D1 both have a generous free tier; a small
  personal app like this should stay well within it.
- **Backups**: from the D1 database's page, use **Export** (in the
  dashboard, no terminal needed) occasionally, and keep the downloaded
  file somewhere safe.
- **Making a change later**: edit `src/index.js` locally, then repeat
  step 4 (paste the updated file into Quick Edit, Save and deploy).
