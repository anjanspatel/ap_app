# Disaster Recovery

What to do for each failure scenario, ordered by how likely and how bad
each one is. None of these require Claude Code — everything here is a
Cloudflare-dashboard or GitHub action a human takes directly.

## The site shows Cloudflare's bot-challenge page instead of the app

**This is the current known state as of 2026-09-20** — see
`docs/PRODUCTION-INVENTORY.md`, "Known open incident." It is not data
loss and not a code problem; it's an edge security rule intercepting
requests before they reach either the Pages deployment or the Worker.

1. Cloudflare dashboard → **Security → Events**. Find the blocked
   request, note the exact rule name/ID shown there.
2. That rule lives under either **Security → WAF → Custom rules** or
   **Managed rules** (or, if it's specifically a bot check, **Security →
   Bots**) — open it and add an exception/skip for `app.anjanpatel.ca`,
   or narrow its match conditions so it stops catching normal traffic.
3. Re-run **Live production check** (Actions tab) to confirm — it checks
   the real domain and reports headers/status/console errors directly.

## The D1 database is deleted or corrupted

**There is no automated backup today — this is the single biggest real
gap in this setup.** Recovery depends entirely on whether a manual
export was taken beforehand.

**To take a backup (do this now, and periodically):**
- Dashboard → **Workers & Pages → D1 → `ap-workspace` → Export** button.
  Downloads a `.sql` file. Store it somewhere safe (not in the Git repo —
  it will contain real user data).
- Or, if `wrangler` is ever installed locally:
  `wrangler d1 export ap-workspace --remote --output=backup.sql`

**To restore:**
1. Create a new D1 database (or use the existing one if only some tables
   were affected).
2. Dashboard → D1 → the database → **Console** → paste `worker/schema.sql`
   to recreate the table structure (skip this if tables still exist).
3. Paste the contents of your `.sql` backup export → **Execute**.
4. If the database name or ID changed, update `binding.database_id` in
   `worker/wrangler.toml` and re-bind it to the Worker (Worker → Settings
   → Bindings).

## The Worker (`ap-app`) is deleted or its code is broken

The database is independent of the Worker — deleting/redeploying the
Worker does not touch `ap-workspace`'s data.

1. Cloudflare dashboard → **Workers & Pages → Create → Workers → Create
   Worker**. Name it `ap-app` (matching the real, expected name — see
   `docs/PRODUCTION-INVENTORY.md`).
2. **Edit code** (Quick Edit) → paste the current `worker/src/index.js`
   from this repo → **Save and deploy**.
3. **Settings → Bindings** → add D1 binding, variable name `DB` (must be
   exact), database `ap-workspace`.
4. **Settings → Domains & Routes** → **Add → Custom Domain** →
   `api.anjanpatel.ca`.
5. Confirm via **Live production check** (Actions tab) or by signing in
   on the real site once the challenge-page incident above is also
   resolved.

## The Cloudflare Pages project is deleted

Actions tab → **Deploy preview to Cloudflare Pages** → **Run workflow**.
That workflow already handles "project doesn't exist yet" — it creates
`ap-workspace` fresh and deploys to it, then you re-attach the
`app.anjanpatel.ca` custom domain under the Pages project's **Custom
domains** tab.

## The GitHub repository is lost

Cloudflare doesn't depend on GitHub at runtime — the Worker, D1, and
Pages deployment keep serving exactly as they are with no GitHub
involvement at all. What you lose is the ability to *ship future
changes* and the version history/documentation. Mitigation: keep a local
clone (or a second remote) of `anjanpatel/ap_app` somewhere you control,
updated periodically.

## Total Cloudflare account lockout

The one scenario that stops everything at once — no code runs without
account access. **Not independently verified this pass** (can't check
account-recovery settings via any available tool): confirm directly in
the Cloudflare dashboard that 2FA is enabled and that billing/recovery
contact details are current. This is worth checking now, before it's
needed.
