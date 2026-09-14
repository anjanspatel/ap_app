-- ═══════════════════════════════════════════════════
-- AP Workspace — Cloudflare D1 Schema
-- Replaces the Supabase Postgres schema (see /schema.sql at repo root,
-- kept for historical reference). Run once against a fresh D1 database:
--
--   wrangler d1 execute ap-workspace --remote --file=./schema.sql
-- ═══════════════════════════════════════════════════

create table if not exists users (
  id               text primary key,              -- reuses the Supabase UUID on migration
  email            text unique not null,
  password_hash    text not null,                 -- bcrypt, same format Supabase used
  first_name       text,
  last_name        text,
  is_admin         integer not null default 0,    -- 0/1
  verified_by_id   text,
  verified_by_name text,
  account_number   text,                          -- e.g. AP-0001
  banned_until     text,                           -- ISO timestamp, null = not banned
  created_at       text not null,
  last_sign_in_at  text
);

create table if not exists sessions (
  token         text primary key,   -- random 32-byte hex, the cookie value
  user_id       text not null references users(id) on delete cascade,
  created_at    text not null,
  expires_at    text not null
);
create index if not exists sessions_user_id_idx on sessions (user_id);

create table if not exists password_resets (
  token      text primary key,
  user_id    text not null references users(id) on delete cascade,
  created_at text not null,
  expires_at text not null,
  used       integer not null default 0
);

create table if not exists saved_lookups (
  id             text primary key,
  user_id        text not null references users(id) on delete cascade,
  tool           text not null check (tool in ('flange','torque','tubing')),
  label          text,
  params         text not null,     -- JSON-encoded, same shape as the Supabase jsonb column
  result_summary text,
  created_at     text not null
);
create index if not exists saved_lookups_user_id_idx on saved_lookups (user_id, created_at desc);

create table if not exists admin_audit_log (
  id              text primary key,
  actor_id        text not null references users(id),
  action          text not null check (action in ('create_user','update_profile','set_admin','revoke_admin','ban_user','unban_user')),
  target_user_id  text not null references users(id),
  details         text not null default '{}',  -- JSON-encoded
  created_at      text not null
);
