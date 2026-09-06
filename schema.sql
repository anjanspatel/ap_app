-- ═══════════════════════════════════════════════════
-- Anjan Patel Engineering App — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════

-- Saved lookups table
create table if not exists public.saved_lookups (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references auth.users(id) on delete cascade not null,
  tool          text        not null check (tool in ('flange', 'tubing')),
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
