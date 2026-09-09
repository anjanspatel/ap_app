// Dev-only helper: inserts one admin test account directly into the local
// SQLite database, since this app is invite-only and has no signup
// endpoint (matching the existing product decision). Not used in
// production — real accounts come from migrate-from-supabase.js.
//
// Usage: node seed-test-user.js you@example.com yourpassword

const crypto = require('crypto');
const db = require('./db');
const { hashPassword } = require('./auth');

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: node seed-test-user.js <email> <password>');
  process.exit(1);
}

const id = crypto.randomUUID();
db.prepare(
  'insert into users (id, email, password_hash, is_admin, created_at) values (?,?,?,1,?)'
).run(id, email.toLowerCase().trim(), hashPassword(password), new Date().toISOString());

console.log(`Created admin user ${email} (id ${id})`);
