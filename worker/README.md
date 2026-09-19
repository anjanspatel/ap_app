# AP Workspace API — deploy guide (dashboard only, no terminal)

This replaces Supabase with a backend that runs entirely on Cloudflare —
Workers + D1 — inside your own Cloudflare account. Everything below is
done by clicking through **dash.cloudflare.com** in a browser. No
terminal, no npm, no command-line tools of any kind, and no other
service besides Cloudflare itself.

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
3. Everyone signs in the first time with the password `ChangeMe123!`,
   then changes it immediately from Settings → Change Password.

## 4. Create the Worker

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

## What this app can and can't do without a third-party service

Because there's no email provider connected (on purpose — one less
service to depend on), there is no self-service "forgot password" link.
If someone is locked out, an admin resets their password directly:
Admin Console → Users table → **Reset password** button next to their
name. That's this app's only password-recovery path.

## Ongoing maintenance

- **Cost**: Workers and D1 both have a generous free tier; a small
  personal app like this should stay well within it.
- **Backups**: from the D1 database's page, use **Export** (in the
  dashboard, no terminal needed) occasionally, and keep the downloaded
  file somewhere safe.
- **Making a change later**: edit `src/index.js` locally, then repeat
  step 4 (paste the updated file into Quick Edit, Save and deploy).
