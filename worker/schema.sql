-- ═══════════════════════════════════════════════════
-- AP Workspace — Cloudflare D1 Schema
-- Everything runs on Cloudflare (Workers + D1) — no other service.
-- Run this once against a fresh D1 database, from the Cloudflare
-- dashboard: your D1 database → Console tab → paste this whole file →
-- Execute. No terminal, no Wrangler needed.
-- ═══════════════════════════════════════════════════

create table if not exists users (
  id                    text primary key,              -- a random id, e.g. from an online UUID generator
  email                 text unique not null,
  username              text,                          -- optional alternate login identifier (e.g. the bootstrap admin)
  password_hash         text not null,                 -- pbkdf2$<iterations>$<salt b64>$<hash b64>, set by the Worker
  first_name            text,
  last_name             text,
  is_admin              integer not null default 0,    -- 0/1
  verified_by_id        text,
  verified_by_name      text,
  account_number        text,                          -- e.g. AP-0001
  banned_until          text,                           -- ISO timestamp, null = not banned
  must_change_password  integer not null default 0,    -- 0/1 — forces the change-password flow on next sign-in
  password_changed_at   text,
  created_at            text not null,
  last_sign_in_at       text
);
create unique index if not exists users_username_idx on users (username) where username is not null;

create table if not exists sessions (
  token         text primary key,   -- random 32-byte hex, the cookie value
  user_id       text not null references users(id) on delete cascade,
  created_at    text not null,
  expires_at    text not null,
  last_used_at  text
);
create index if not exists sessions_user_id_idx on sessions (user_id);

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

-- Login rate-limiting / brute-force lockout. Keyed by the lowercased email
-- or username someone tried to sign in with — not by IP, since Workers
-- doesn't reliably expose a stable client IP behind Cloudflare's edge, and
-- keying by identifier stops credential-stuffing against one account
-- regardless of source IP.
create table if not exists login_attempts (
  identifier      text primary key,
  attempt_count   integer not null default 0,
  first_attempt_at text not null,
  locked_until    text
);

create table if not exists admin_audit_log (
  id              text primary key,
  actor_id        text references users(id),   -- null for a failed login against an unknown identifier
  action          text not null check (action in (
                    'USER_CREATED','USER_UPDATED','USER_DELETED','ROLE_CHANGED',
                    'USER_DISABLED','USER_ENABLED','PASSWORD_RESET_BY_ADMIN','PASSWORD_CHANGED',
                    'LOGIN_SUCCESS','LOGIN_FAILURE','LOGOUT','SESSION_REVOKED'
                  )),
  target_user_id  text references users(id),   -- null when there's no specific target (e.g. an unknown-identifier login failure)
  details         text not null default '{}',  -- JSON-encoded, never passwords/secrets
  created_at      text not null
);
create index if not exists admin_audit_log_target_idx on admin_audit_log (target_user_id, created_at desc);
