// Unit tests for the Worker's dependency-free auth primitives. These run
// against the actual worker/src/index.js file (Node 20+'s global crypto.subtle
// is Web-Crypto-compatible, so no Workers runtime or D1 mock is needed for
// the pure hashing/validation logic). Request routing, sessions, and rate
// limiting live behind D1 access and aren't covered here — they're the part
// that needs a real Miniflare/D1 harness, which this project doesn't carry
// a dependency for.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, isValidEmail } = require('../worker/src/index.js');

test('hashPassword produces the documented pbkdf2$iterations$salt$hash format', async () => {
  const hash = await hashPassword('correct horse battery staple');
  const parts = hash.split('$');
  assert.equal(parts.length, 4);
  assert.equal(parts[0], 'pbkdf2');
  assert.equal(parts[1], '100000');
});

test('verifyPassword accepts the correct password', async () => {
  const hash = await hashPassword('TestPassw0rd!');
  assert.equal(await verifyPassword('TestPassw0rd!', hash), true);
});

test('verifyPassword rejects an incorrect password', async () => {
  const hash = await hashPassword('TestPassw0rd!');
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('verifyPassword rejects a malformed/missing stored hash safely (no throw)', async () => {
  assert.equal(await verifyPassword('anything', null), false);
  assert.equal(await verifyPassword('anything', ''), false);
  assert.equal(await verifyPassword('anything', 'not-a-real-hash'), false);
  assert.equal(await verifyPassword('anything', 'pbkdf2$only$three$parts$extra'), false);
});

test('two hashes of the same password are different (random salt)', async () => {
  const a = await hashPassword('same-password');
  const b = await hashPassword('same-password');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('same-password', a), true);
  assert.equal(await verifyPassword('same-password', b), true);
});

test('isValidEmail distinguishes emails from plain usernames', () => {
  assert.equal(isValidEmail('anjan@anjanpatel.ca'), true);
  assert.equal(isValidEmail('Anjan_admin'), false);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail(''), false);
});
