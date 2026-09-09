# Deploying AP Workspace

This is one Node/Express app (`server/`) that serves both the JSON API and
the site's HTML/CSS/JS — one deployment, one URL, no separate frontend
host. It needs a persistent disk (SQLite lives in one file), so it can't
run on Render's free tier — use the Starter plan or above.

No shell or terminal access is needed anywhere in this — everything below
is filling in text boxes in Render's dashboard or your DNS provider's.

## 1. Create the Render service

1. Sign in at **dashboard.render.com** with **"Sign up with GitHub"** — no
   new password, just authorizes Render against the `anjanspatel/ap_app`
   repo.
2. **New +** → **Blueprint** → select `anjanspatel/ap_app`. Render detects
   `render.yaml` at the repo root and proposes the `ap-workspace` service
   with a 1GB persistent disk mounted at `/data`.
3. Before deploying, fill in the values it prompts for (marked
   `sync: false` in `render.yaml`, so Render asks rather than storing them
   in the file):
   - `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` — pick any email
     and password. The server creates this as your first admin account the
     moment it starts up — this is how you get your own login, with no
     migration and no shell command needed.
   - `RESEND_API_KEY` — from resend.com, used only for password-reset
     emails. Leave blank for now if you don't have one — the server falls
     back to logging reset links to its own console, fine for a first
     deploy but real users can't reset their password by email until this
     is set.
   - `SUPABASE_DB_URL` — only fill this in if you have existing Supabase
     accounts to carry over (see step 4). Leave blank otherwise.
4. Confirm the **Starter** plan (needed for the persistent disk) and
   deploy. Once live, visit `https://<your-service>.onrender.com/` and
   sign in with the email/password from step 3 — that's the whole setup.

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

## 3. Add the rest of your users

Sign in with the admin account from step 1, open the **Admin Console**,
and click **+ Add User**. Fill in their name, email, and a password, tick
"Grant admin access" if they need it, and they can sign in immediately —
no email verification step, no signup page, nothing else to configure.
Repeat for anyone else who needs access. This is the normal, day-to-day
way accounts get created — the bootstrap step above only ever creates the
first one.

## 4. (Optional) Migrate existing Supabase accounts

Only relevant if people already have accounts on the old Supabase-based
version of the site and you want them to keep their existing password
instead of you creating fresh logins for them in step 3.

1. Set `SUPABASE_DB_URL` on the Render service (Environment tab) if you
   skipped it in step 1 — from the Supabase dashboard → Settings →
   Database → Connection string (URI).
2. Open the Render service → **Shell** (the one place this does need a
   command) → run:
   ```
   npm run migrate
   ```
3. It prints row counts for users and saved lookups it copied over.
   Supabase bcrypt password hashes carry over directly, so existing
   passwords keep working with no reset — and an account already flagged
   admin in Supabase stays admin here too.
4. Safe to re-run (`insert or ignore`) — running it again after adding
   more Supabase users won't duplicate anything already migrated.

## 5. Verify before calling it done

- Visit `https://app.anjanpatel.ca/` and sign in.
- Save a lookup on the flange/torque/tubing pages and confirm it shows up
  on the dashboard.
- Change your password from Settings → Security (requires entering the
  current password first).
- Sign in from two browsers, then use "Sign out all" in one — confirm the
  other is signed out too.
- In the Admin Console, confirm the user list is correct and that
  ban/unban and grant/revoke admin work.

## 6. After it's been running for a few real days (only if you migrated)

If you migrated from Supabase and are confident the new backend is
stable: pause or delete the Supabase project (Settings → General, in the
Supabase dashboard). Nothing in this repo calls it anymore.
