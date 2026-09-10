-- AP Workspace — schema, applied automatically by the GitHub Action on
-- every push (see .github/workflows/deploy-supabase.yml). Only the
-- structural, safe-to-replay pieces live here — one-off data operations
-- (flagging a specific account as admin, banning a specific account) stay
-- in schema.sql at the repo root, run by hand, since blindly re-running
-- those on every push could undo something an admin changed since.

create table if not exists public.saved_lookups (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references auth.users(id) on delete cascade not null,
  tool          text        not null check (tool in ('flange', 'torque', 'tubing')),
  label         text,
  params        jsonb       not null default '{}',
  result_summary text,
  created_at    timestamptz default now() not null
);

alter table public.saved_lookups enable row level security;

drop policy if exists "select_own" on public.saved_lookups;
create policy "select_own" on public.saved_lookups
  for select using (auth.uid() = user_id);

-- Multiple permissive policies for the same command combine with OR, so
-- this adds "or the caller is an admin" on top of select_own rather than
-- replacing it — without it, the dashboard's admin lookups panel could
-- only ever show the admin's own rows, same as everyone else, since
-- app_metadata.is_admin means nothing to Postgres without a policy that
-- checks it.
drop policy if exists "admins_select_all" on public.saved_lookups;
create policy "admins_select_all" on public.saved_lookups
  for select using ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true);

drop policy if exists "insert_own" on public.saved_lookups;
create policy "insert_own" on public.saved_lookups
  for insert with check (auth.uid() = user_id);

drop policy if exists "delete_own" on public.saved_lookups;
create policy "delete_own" on public.saved_lookups
  for delete using (auth.uid() = user_id);

create index if not exists saved_lookups_user_id_idx
  on public.saved_lookups (user_id, created_at desc);

-- Client-side error log (see global-features.js) — currently console-only
-- on the client, this table exists for if that's reconnected later.
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
drop policy if exists "anyone can insert" on public.error_logs;
create policy "anyone can insert" on public.error_logs
  for insert to anon, authenticated with check (true);

-- Every grant/revoke/ban/unban/create performed through the admin-users
-- Edge Function writes a row here. Only the service role can insert (the
-- Edge Function's own key), so this table is trustworthy — a client can
-- never fake an entry.
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('create_user','update_profile','set_admin','revoke_admin','ban_user','unban_user')),
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
