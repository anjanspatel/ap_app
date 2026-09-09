# Deploying AP Workspace

This is one Node/Express app (`server/`) that serves both the JSON API and
the site's HTML/CSS/JS — one deployment, one URL, no separate frontend
host. It needs a persistent disk (SQLite lives in one file), so it can't
run on Render's free tier — use the Starter plan or above.

## 1. Create the Render service

1. Sign in at **dashboard.render.com** with **"Sign up with GitHub"** — no
   new password, just authorizes Render against the `anjanspatel/ap_app`
   repo.
2. **New +** → **Blueprint** → select `anjanspatel/ap_app`. Render detects
   `render.yaml` at the repo root and proposes the `ap-workspace` service
   with a 1GB persistent disk mounted at `/data`.
3. Before deploying, fill in the two secrets it prompts for (marked
   `sync: false` in `render.yaml`, so Render asks rather than storing them
   in the file):
   - `RESEND_API_KEY` — from resend.com, used only for password-reset
     emails. Leave blank for now if you don't have one — the server falls
     back to logging reset links to its own console, fine for a first
     deploy but real users can't reset their password by email until this
     is set.
   - `SUPABASE_DB_URL` — from the Supabase dashboard → Settings → Database
     → Connection string (URI). Only needed once, for the migration in
     step 3. Safe to leave set afterward.
4. Confirm the **Starter** plan (needed for the persistent disk) and
   deploy. Once live, visit `https://<your-service>.onrender.com/` — you
   should see the actual AP Workspace site, served by this one service.

## 2. Point app.anjanpatel.ca at it

1. In the Render service → **Settings** → **Custom Domains**, add
   `app.anjanpatel.ca`. Render shows the exact CNAME target
   (something like `ap-workspace.onrender.com`).
2. At your DNS provider, update the existing record for `app` to that
   CNAME target (this replaces whatever currently points it at GitHub
   Pages — GitHub Pages is no longer used at all; everything lives on this
   one Render service now).
3. Wait for DNS to propagate and Render to issue the TLS certificate
   (usually a few minutes). The custom domain page shows a green check
   when it's ready.

There's no `api.anjanpatel.ca` to set up — the API lives at the same
origin as the site (`/api/...` paths), so there's only ever one domain to
manage.

## 3. Migrate existing users and lookups

Only run this once, after `SUPABASE_DB_URL` is set (step 1.3):

1. Open the Render service → **Shell**.
2. Run:
   ```
   npm run migrate
   ```
3. It prints row counts for users and saved lookups it copied over. Spot-
   check by signing in with 2-3 real existing accounts (their Supabase
   bcrypt password hashes carry over directly, so existing passwords keep
   working with no reset — and if your account was flagged admin in
   Supabase, it stays admin here too).
4. The script uses `insert or ignore`, so it's safe to re-run — it won't
   duplicate anything already migrated.

## 4. Verify before calling it done

With DNS live and the migration run:

- Visit `https://app.anjanpatel.ca/` and sign in with a migrated account.
- Save a lookup on the flange/torque/tubing pages and confirm it shows up
  on the dashboard.
- Change your password from Settings → Security (requires entering the
  current password first).
- Sign in from two browsers, then use "Sign out all" in one — confirm the
  other is signed out too.
- As an admin account, open the Admin Console and confirm it lists users,
  and that ban/unban and grant/revoke admin work.
- As an admin, create a brand-new user directly (no Supabase history) via
  Render's Shell — see below — and confirm they can sign in.

### Adding a user who was never in Supabase

From the Render Shell:
```
node -e "require('./auth').hashPassword; const {hashPassword}=require('./auth'); const db=require('./db'); const crypto=require('crypto'); const id=crypto.randomUUID(); db.prepare('insert into users (id,email,password_hash,is_admin,created_at) values (?,?,?,?,?)').run(id,'someone@example.com'.toLowerCase(),hashPassword('theirTempPassword'),0,new Date().toISOString()); console.log('created', id);"
```
Change the email, password, and the `0`/`1` admin flag as needed. They can
change their own password afterward from Settings → Security.

## 5. After it's been running for a few real days

Once you're confident the new backend is stable in production:

- Pause or delete the Supabase project (Settings → General, in the
  Supabase dashboard). Nothing in this repo calls it anymore.
- Nothing else to clean up in the codebase — the Supabase SDK, schema, and
  Edge Function, and the separate GitHub Pages deployment, have already
  been removed.
