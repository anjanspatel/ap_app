-- ═══════════════════════════════════════════════════
-- AP Workspace — Supabase Schema
-- Fresh setup: run this whole file in Supabase Dashboard → SQL Editor → Run
-- Existing database: skip to the MIGRATION section at the bottom instead —
-- running the create-table statements again is harmless (IF NOT EXISTS)
-- but will NOT update an existing check constraint, which is the actual
-- issue that needs the migration.
-- ═══════════════════════════════════════════════════

-- Saved lookups table
create table if not exists public.saved_lookups (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references auth.users(id) on delete cascade not null,
  tool          text        not null check (tool in ('flange', 'torque', 'tubing')),
  label         text,
  params        jsonb       not null default '{}',
  result_summary text,
  created_at    timestamptz default now() not null
);

-- Row Level Security — users only see their own rows
alter table public.saved_lookups enable row level security;

create policy "select_own" on public.saved_lookups
  for select using (auth.uid() = user_id);

create policy "insert_own" on public.saved_lookups
  for insert with check (auth.uid() = user_id);

create policy "delete_own" on public.saved_lookups
  for delete using (auth.uid() = user_id);

-- Index for fast per-user queries
create index if not exists saved_lookups_user_id_idx
  on public.saved_lookups (user_id, created_at desc);

-- Client-side error log (see global-features.js — best-effort inserts,
-- write-only from the client, no read policy since only the operator
-- needs to read these via the Supabase dashboard, not the app itself)
create table if not exists public.error_logs (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  message     text,
  source      text,
  stack       text,
  page        text,
  user_agent  text
);
alter table public.error_logs enable row level security;
create policy "anyone can insert" on public.error_logs
  for insert to anon, authenticated with check (true);


-- ═══════════════════════════════════════════════════
-- MIGRATION — run this against an EXISTING database that was set up
-- before the torque calculator existed. The create-table statements
-- above only apply to a table that doesn't exist yet; an existing
-- saved_lookups table keeps its original check constraint until you
-- explicitly drop and recreate it, which is what this does.
-- ═══════════════════════════════════════════════════
alter table public.saved_lookups drop constraint if exists saved_lookups_tool_check;
alter table public.saved_lookups add constraint saved_lookups_tool_check
  check (tool in ('flange', 'torque', 'tubing'));

-- ═══════════════════════════════════════════════════
-- ADMIN FLAG — dashboard.html/settings.html now read is_admin from
-- app_metadata, not user_metadata. user_metadata can be rewritten by
-- any signed-in user via the client SDK (auth.updateUser({data:{...}})
-- is intentionally self-service in Supabase), so it must never gate
-- admin UI or, worse, an RLS policy — app_metadata can only be set
-- from here (SQL editor / service role), never from the browser.
-- Run this once per account that should see the admin panel, replacing
-- the email:
-- ═══════════════════════════════════════════════════
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
where email = 'you@example.com';

-- ═══════════════════════════════════════════════════
-- BAN AN ACCOUNT — sets banned_until far in the future so GoTrue
-- rejects sign-in attempts. Reversible (set banned_until = null to
-- unban) and non-destructive — their row and any saved_lookups stay
-- intact, unlike deleting the user outright. Also revokes any
-- outstanding refresh tokens so an already-open session is cut too.
-- ═══════════════════════════════════════════════════
update auth.users
set banned_until = '2099-01-01T00:00:00Z'
where email = 'info@anjanpatel.ca';

delete from auth.refresh_tokens
where user_id = (select id from auth.users where email = 'info@anjanpatel.ca');

-- ═══════════════════════════════════════════════════
-- ADMIN AUDIT LOG — every grant/revoke/ban/unban performed through the
-- admin-users Edge Function (supabase/functions/admin-users) writes a
-- row here. Only the service role can insert (the Edge Function's own
-- key), so this table is trustworthy — a client can never fake an
-- entry. Admins can read it to see who did what and when.
-- ═══════════════════════════════════════════════════
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('set_admin','revoke_admin','ban_user','unban_user')),
  target_user_id uuid not null references auth.users(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admins can read audit log" on public.admin_audit_log;
create policy "admins can read audit log"
  on public.admin_audit_log for select
  using ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true);

-- No insert/update/delete policy is defined on purpose — only the
-- service role (which bypasses RLS entirely) can write to this table,
-- so even a signed-in admin cannot edit or fabricate audit history
-- through the client SDK.

-- ═══════════════════════════════════════════════════
-- DEPLOYING THE admin-users EDGE FUNCTION
-- From the project root, with the Supabase CLI installed and logged in:
--
--   supabase functions deploy admin-users --project-ref <your-project-ref>
--
-- The function reads SUPABASE_URL, SUPABASE_ANON_KEY, and
-- SUPABASE_SERVICE_ROLE_KEY — all three are already auto-injected by
-- Supabase into every Edge Function's environment, so no manual secret
-- setup is needed. Find <your-project-ref> in the dashboard URL:
-- supabase.com/dashboard/project/<project-ref>.
-- ═══════════════════════════════════════════════════
