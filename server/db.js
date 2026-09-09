// AP Workspace — self-hosted database (replaces Supabase Postgres)
//
// SQLite via better-sqlite3: a single file, trivial to back up (copy it),
// no separate database server to run or patch. Plenty for this app's scale.

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.sqlite');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  create table if not exists users (
    id text primary key,
    email text unique not null,
    password_hash text not null,
    is_admin integer not null default 0,
    banned_until text,
    created_at text not null,
    last_sign_in_at text,
    failed_attempts integer not null default 0,
    locked_until text
  );

  create table if not exists sessions (
    token text primary key,
    user_id text not null references users(id) on delete cascade,
    created_at text not null,
    expires_at text not null
  );

  create table if not exists saved_lookups (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    tool text not null check (tool in ('flange','torque','tubing')),
    label text,
    result_summary text,
    params text not null,
    created_at text not null
  );

  create table if not exists admin_audit_log (
    id text primary key,
    actor_id text not null references users(id),
    action text not null check (action in ('set_admin','revoke_admin','ban_user','unban_user')),
    target_user_id text not null references users(id),
    details text,
    created_at text not null
  );

  create table if not exists password_resets (
    token text primary key,
    user_id text not null references users(id) on delete cascade,
    expires_at text not null,
    used integer not null default 0
  );

  create index if not exists idx_sessions_user on sessions(user_id);
  create index if not exists idx_lookups_user on saved_lookups(user_id);
`);

module.exports = db;
