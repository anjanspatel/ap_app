# AP Workspace — Owner Manual

Start here. This is the entry point for running AP Workspace yourself,
with no dependency on Claude, Claude Code, or any developer — including
the one who built it.

## What this is

AP Workspace is three engineering field calculators (API 6A flange
selection, bolt torque, safety-block/tubing SWL) behind a simple sign-in,
plus an admin console for managing user accounts. It runs entirely on
your own Cloudflare account (a Worker + a D1 database + Pages hosting)
and your own GitHub repository (`anjanspatel/ap_app`). See
`docs/NO-CLAUDE-REQUIRED.md` for exactly why nothing here depends on
Claude going forward.

## Read this next, in order

1. **`docs/PRODUCTION-INVENTORY.md`** — the real, verified state of
   everything today, including one open incident that needs your
   attention (the live domain is currently blocked by a Cloudflare
   security rule — see that doc's first section).
2. **`docs/CLOUDFLARE-RUNBOOK.md`** — how to ship a change, roll one
   back, or rotate a secret, with the real resource names.
3. **`docs/DISASTER-RECOVERY.md`** — what to do if something breaks,
   including the current backup gap (there's no automated D1 backup
   yet — take one).
4. **`docs/DEVELOPMENT-GUIDE.md`** — for anyone (you or a future
   developer) making code changes.
5. **`docs/NO-CLAUDE-REQUIRED.md`** — the dependency audit backing up
   this manual's core claim.

## Day-to-day operations

**Add a new user account.** Sign in as an admin → **Admin Console** →
**Users** → **+ Add User**. Set their initial password; they're forced
to change it on first sign-in.

**Someone's locked out / forgot their password.** There's no self-service
email reset (no email provider is connected, on purpose — one less
service to depend on). Admin Console → Users → find them → **Reset
password**. They'll be forced to change it again on next sign-in.

**Remove someone's access without deleting their history.** Admin
Console → Users → **Ban** (their sessions are revoked immediately; their
saved lookups and audit trail stay intact). **Unban** reverses it.

**See what's happened on the account.** Admin Console → the audit log
view lists every login, password change, and admin action with a
timestamp — nothing destructive happens silently.

**Back up your data.** There is currently no automatic backup — see
`docs/DISASTER-RECOVERY.md` for the one-click **Export** button on the
D1 database's dashboard page. Do this occasionally; it takes under a
minute.

## The one thing that needs attention right now

`app.anjanpatel.ca` is currently returning Cloudflare's own "checking
your browser" challenge page instead of the app, for every visitor. This
is a Cloudflare Security/WAF setting, not a bug in the code, the Worker,
or the database — all three were verified working. Fixing it needs a
human with Cloudflare dashboard access; the exact steps are in
`docs/PRODUCTION-INVENTORY.md` and `docs/DISASTER-RECOVERY.md` under
"the site shows Cloudflare's bot-challenge page."

## Who to ask if you get stuck

Everything needed to operate, redeploy, or recover this system by
yourself is in the four docs listed above — that was the explicit goal
of writing them. If a step in any of them turns out to be wrong or
missing something, that's a documentation bug worth fixing directly
(they're just Markdown files in `docs/`), not a reason to need outside
help.
