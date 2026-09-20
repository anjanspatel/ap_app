-- ═══════════════════════════════════════════════════
-- AP Workspace — migration 0001: auth hardening
-- Run this ONCE against the existing live D1 database (it already has the
-- original schema.sql applied). Paste into the D1 Console → Execute.
-- Adds: username login, forced password-change flag, login rate-limiting,
-- and an expanded audit-log action vocabulary.
-- ═══════════════════════════════════════════════════

alter table users add column username text;
create unique index if not exists users_username_idx on users (username) where username is not null;

alter table users add column must_change_password integer not null default 0;
alter table users add column password_changed_at text;

alter table sessions add column last_used_at text;

create table if not exists login_attempts (
  identifier      text primary key,
  attempt_count   integer not null default 0,
  first_attempt_at text not null,
  locked_until    text
);

-- Renamed admin_audit_log -> audit_logs (matching the Worker code and
-- schema.sql, and dropping the old CHECK constraint SQLite can't alter
-- in place) — recreated rather than altered so existing rows survive
-- with their original action strings intact.
alter table admin_audit_log rename to admin_audit_log_old;

create table audit_logs (
  id              text primary key,
  actor_id        text references users(id),
  action          text not null,
  target_user_id  text references users(id),
  details         text not null default '{}',
  created_at      text not null
);
create index if not exists audit_logs_target_idx on audit_logs (target_user_id, created_at desc);

insert into audit_logs (id, actor_id, action, target_user_id, details, created_at)
  select id, actor_id, action, target_user_id, details, created_at from admin_audit_log_old;

drop table admin_audit_log_old;
