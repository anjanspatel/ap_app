// One-time migration: pulls accounts and saved lookups out of Supabase's
// Postgres and seeds the new SQLite database, so nobody has to re-register
// or loses saved work when Supabase is disconnected.
//
// Supabase hashes passwords with bcrypt, same as this backend — so
// encrypted_password is copied over as-is and existing passwords keep
// working without anyone resetting anything.
//
// Usage:
//   1. Set SUPABASE_DB_URL in server/.env (Supabase dashboard ->
//      Settings -> Database -> Connection string -> URI, "Session" mode)
//   2. npm run migrate
//
// Safe to re-run: uses INSERT OR IGNORE, so already-migrated rows are
// left untouched rather than duplicated or overwritten.

require('dotenv').config();
const { Client } = require('pg');
const db = require('./db');

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('Set SUPABASE_DB_URL in server/.env first (see .env.example).');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('Connected to Supabase Postgres. Reading auth.users...');
  const { rows: users } = await client.query(`
    select id, email, encrypted_password, raw_app_meta_data, banned_until, created_at, last_sign_in_at
    from auth.users
    order by created_at asc
  `);

  console.log('Reading public.saved_lookups...');
  const { rows: lookups } = await client.query(`
    select id, user_id, tool, label, result_summary, params, created_at
    from public.saved_lookups
    order by created_at asc
  `);

  await client.end();

  const insertUser = db.prepare(`
    insert or ignore into users (id, email, password_hash, is_admin, banned_until, created_at, last_sign_in_at)
    values (?,?,?,?,?,?,?)
  `);
  const insertLookup = db.prepare(`
    insert or ignore into saved_lookups (id, user_id, tool, label, result_summary, params, created_at)
    values (?,?,?,?,?,?,?)
  `);

  let userCount = 0;
  for (const u of users) {
    if (!u.encrypted_password) {
      console.warn(`  skipping ${u.email} — no password hash (passkey-only account, needs a password reset after migration)`);
      continue;
    }
    const isAdmin = u.raw_app_meta_data && u.raw_app_meta_data.is_admin === true ? 1 : 0;
    const bannedUntil = u.banned_until && u.banned_until !== 'none' ? new Date(u.banned_until).toISOString() : null;
    insertUser.run(
      u.id,
      u.email.toLowerCase().trim(),
      u.encrypted_password,
      isAdmin,
      bannedUntil,
      new Date(u.created_at).toISOString(),
      u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : null
    );
    userCount++;
  }

  let lookupCount = 0;
  for (const l of lookups) {
    insertLookup.run(
      l.id,
      l.user_id,
      l.tool,
      l.label || null,
      l.result_summary || null,
      JSON.stringify(l.params || {}),
      new Date(l.created_at).toISOString()
    );
    lookupCount++;
  }

  console.log(`\nDone. Migrated ${userCount} user(s) and ${lookupCount} saved lookup(s).`);
  console.log('Spot-check: sign in with 2-3 real accounts against the new backend before cutting over.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
