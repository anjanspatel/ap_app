# AP Workspace API — deploy guide

This replaces Supabase with a backend that runs entirely on Cloudflare
(Workers + D1), inside your own Cloudflare account. Do these steps once.

## 1. Install the tools

```
cd worker
npm install
npx wrangler login
```

`wrangler login` opens a browser to connect your Cloudflare account.

## 2. Create the database

```
npx wrangler d1 create ap-workspace
```

This prints a `database_id`. Copy it into `worker/wrangler.toml`, replacing
`REPLACE_WITH_D1_DATABASE_ID`.

Then create the tables:

```
npx wrangler d1 execute ap-workspace --remote --file=./schema.sql
```

## 3. Migrate your existing users and saved lookups

From the Supabase dashboard: **Settings → Database → Connection string**
(the "URI" tab, direct connection, not the pooler). Then:

```
npm install pg
SUPABASE_DB_URL="postgresql://postgres:<password>@<host>:5432/postgres" node migrate-from-supabase.js
```

This writes `migration-data.sql` — open it and skim it once, then run:

```
npx wrangler d1 execute ap-workspace --remote --file=./migration-data.sql
```

Existing passwords carry over as-is (same bcrypt hashes), so nobody has to
reset their password.

## 4. (Optional) Password reset emails

Sign-in works immediately without this. To let people reset a forgotten
password by email, create a free account at resend.com, verify a sending
domain, then set two secrets:

```
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM
```

(`RESEND_FROM` is an address like `AP Workspace <noreply@anjanpatel.ca>`.)
Skip this step if you'd rather handle password resets manually for now —
everything else works without it.

## 5. Deploy the Worker

```
npx wrangler deploy
```

## 6. Point api.anjanpatel.ca at it

In the Cloudflare dashboard, add `api` as a subdomain on the
`anjanpatel.ca` zone (Cloudflare → DNS → add an A/AAAA or CNAME record is
not needed for Workers routes — instead go to Workers & Pages → your
worker → Settings → Domains & Routes → Add → Custom Domain →
`api.anjanpatel.ca`). Cloudflare provisions the TLS certificate
automatically.

## 7. Point the frontend at it

The site's HTML already calls `https://api.anjanpatel.ca` (see `/api.js`
at the repo root) — nothing else to change once the domain above is live.

## Ongoing maintenance

- **Cost**: D1 and Workers both have a free tier; a personal app like this
  should stay within it. If usage grows, Cloudflare's paid Workers plan is
  $5/month.
- **Backups**: `npx wrangler d1 export ap-workspace --remote --output=backup.sql`
  — run this occasionally and keep the file somewhere safe.
- **Admin audit log / schema changes**: edit `schema.sql` and re-run the
  relevant `create table` / `alter table` statements with
  `wrangler d1 execute ap-workspace --remote --command="..."`.
