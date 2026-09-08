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
