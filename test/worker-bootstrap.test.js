// Verifies the secret-driven admin bootstrap actually behaves as specified
// (idempotent, secret-gated, never touches D1 when unconfigured) using a
// minimal in-memory D1 mock — not just asserting the code exists.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { maybeBootstrapAdmin } = require('../worker/src/index.js');

function makeFakeD1() {
  const users = [];
  const auditLogs = [];
  let dbTouched = false;
  const db = {
    prepare(sql) {
      dbTouched = true;
      return {
        bind(...args) {
          this._args = args;
          return this;
        },
        async first() {
          if (sql.includes('count(*) as c from users where is_admin')) {
            return { c: users.filter((u) => u.is_admin === 1).length };
          }
          return null;
        },
        async run() {
          if (sql.startsWith('insert into users')) {
            const [id, email, username, password_hash, account_number, created_at] = this._args;
            users.push({ id, email, username, password_hash, is_admin: 1, account_number, created_at });
          }
          if (sql.startsWith('insert into audit_logs')) {
            auditLogs.push(this._args);
          }
          return { success: true };
        },
      };
    },
  };
  return { db, users, auditLogs, wasTouched: () => dbTouched };
}

test('maybeBootstrapAdmin does nothing and never touches D1 when secrets are unset', async () => {
  const { db, users, wasTouched } = makeFakeD1();
  await maybeBootstrapAdmin({ DB: db });
  assert.equal(users.length, 0);
  assert.equal(wasTouched(), false);
});

test('maybeBootstrapAdmin creates exactly one admin from valid secrets', async () => {
  const { db, users } = makeFakeD1();
  await maybeBootstrapAdmin({ DB: db, BOOTSTRAP_ADMIN_USERNAME: 'Anjan_admin', BOOTSTRAP_ADMIN_PASSWORD: 'TestPassw0rd!' });
  assert.equal(users.length, 1);
  assert.equal(users[0].username, 'Anjan_admin');
  assert.equal(users[0].is_admin, 1);
  // The stored value must be a hash, never the plaintext secret.
  assert.notEqual(users[0].password_hash, 'TestPassw0rd!');
  assert.match(users[0].password_hash, /^pbkdf2\$210000\$/);
});

test('maybeBootstrapAdmin is idempotent — running it again does not create a second admin', async () => {
  const { db, users } = makeFakeD1();
  await maybeBootstrapAdmin({ DB: db, BOOTSTRAP_ADMIN_USERNAME: 'Anjan_admin', BOOTSTRAP_ADMIN_PASSWORD: 'TestPassw0rd!' });
  await maybeBootstrapAdmin({ DB: db, BOOTSTRAP_ADMIN_USERNAME: 'Anjan_admin', BOOTSTRAP_ADMIN_PASSWORD: 'TestPassw0rd!' });
  await maybeBootstrapAdmin({ DB: db, BOOTSTRAP_ADMIN_USERNAME: 'someone_else', BOOTSTRAP_ADMIN_PASSWORD: 'AnotherPassw0rd' });
  assert.equal(users.length, 1);
});

test('maybeBootstrapAdmin refuses malformed secrets (short username/password) without creating a user', async () => {
  const { db, users } = makeFakeD1();
  await maybeBootstrapAdmin({ DB: db, BOOTSTRAP_ADMIN_USERNAME: 'ab', BOOTSTRAP_ADMIN_PASSWORD: 'TestPassw0rd!' });
  await maybeBootstrapAdmin({ DB: db, BOOTSTRAP_ADMIN_USERNAME: 'Anjan_admin', BOOTSTRAP_ADMIN_PASSWORD: 'short' });
  assert.equal(users.length, 0);
});

test('maybeBootstrapAdmin does not create an admin when one already exists from another path', async () => {
  const { db, users } = makeFakeD1();
  users.push({ id: 'existing', is_admin: 1 }); // simulates the manually-seeded admin already in production
  await maybeBootstrapAdmin({ DB: db, BOOTSTRAP_ADMIN_USERNAME: 'Anjan_admin', BOOTSTRAP_ADMIN_PASSWORD: 'TestPassw0rd!' });
  assert.equal(users.length, 1);
  assert.equal(users[0].id, 'existing');
});
