# Deploying the AP Workspace backend

The self-hosted backend (`server/`) replaces Supabase. It needs a persistent
disk (SQLite lives in one file), so it can't run on Render's free tier —
use the Starter plan or above.

## 1. Create the Render service

1. Go to the Render dashboard → **New +** → **Blueprint**.
2. Connect the `anjanspatel/ap_app` GitHub repo. Render will detect
   `render.yaml` at the repo root and propose the `ap-workspace-api`
   service with a 1GB persistent disk mounted at `/data`.
3. Before deploying, fill in the two secrets it will prompt for
   (both are marked `sync: false` in `render.yaml`, so Render asks for them
   instead of storing them in the file):
   - `RESEND_API_KEY` — from resend.com, used only for password-reset
     emails. Leave blank for now if you don't have one yet — the server
     falls back to logging reset links to its own console, which is fine
     for a first deploy but means real users can't reset their password by
     email until this is set.
   - `SUPABASE_DB_URL` — from the Supabase dashboard → Settings → Database
     → Connection string (URI). Only needed once, to run the migration in
     step 3. Safe to leave set afterward.
4. Deploy. Once live, confirm `https://<your-service>.onrender.com/api/health`
   returns `{"ok":true}`.

## 2. Point api.anjanpatel.ca at it

1. In the Render service → **Settings** → **Custom Domains**, add
   `api.anjanpatel.ca`. Render will show you the exact CNAME target
   (something like `ap-workspace-api.onrender.com`).
2. At your DNS provider, add a CNAME record: `api` → the target Render gave
   you. Don't use the placeholder above — copy the one Render's UI shows.
3. Wait for DNS to propagate and Render to issue the TLS certificate
   (usually a few minutes, occasionally longer). The custom domain page
   will show a green check when it's ready.

## 3. Migrate existing users and lookups

Only run this once, after `SUPABASE_DB_URL` is set (step 1.3):

1. Open the Render service → **Shell**.
2. Run:
   ```
   npm run migrate
   ```
3. It prints row counts for users and saved lookups it copied over. Spot-
   check by signing in with 2-3 real existing accounts against the new
   backend (their Supabase bcrypt password hashes carry over directly, so
   existing passwords keep working with no reset).
4. The script uses `insert or ignore`, so it's safe to re-run if you add
   more Supabase users later — it won't duplicate anything already migrated.

## 4. Verify before calling it done

With DNS live and the migration run:

- Visit `https://app.anjanpatel.ca/` and sign in with a migrated account.
- Save a lookup on the flange/torque/tubing pages and confirm it shows up
  on the dashboard.
- Change your password from Settings → Security (requires entering the
  current password first).
- Sign in from two browsers, then use "Sign out all" in one — confirm the
  other is signed out too.
- As an admin account, confirm the dashboard's admin panel lists users and
  that ban/unban and grant/revoke admin work.

## 5. After it's been running for a few real days

Once you're confident the new backend is stable in production:

- Pause or delete the Supabase project (Settings → General, in the
  Supabase dashboard). Nothing in this repo calls it anymore.
- Nothing else to clean up in the codebase — the Supabase SDK, schema, and
  Edge Function have already been removed.
