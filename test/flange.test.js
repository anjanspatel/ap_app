/* Flange dimensions are a lookup table (API 6A Table 2 values), not a
   formula — there's nothing to "compute" and verify against a reference
   calculation. What can regress is the data itself: a typo'd bore, a
   missing rating, a bolt circle smaller than the bore. This test parses
   the real table straight out of flange/calc-page.js (the external file
   the CSP-hardening pass extracted it into — was flange/index.html
   before that; no refactor of the live logic itself) and checks
   structural/physical invariants.
*/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../flange/calc-page.js'), 'utf8');

function extract(sourceName) {
  const startMarker = `const ${sourceName} =`;
  const start = html.indexOf(startMarker);
  assert.ok(start !== -1, `could not find "${startMarker}" in flange/calc-page.js — has the variable been renamed?`);
  const exprStart = start + startMarker.length;
  // Walk forward tracking brace/bracket depth to find the matching end of
  // this literal, then evaluate it as JS (trusted, our own source file).
  let depth = 0, i = exprStart, started = false;
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === '{' || c === '[') { depth++; started = true; }
    else if (c === '}' || c === ']') { depth--; }
    if (started && depth === 0) { i++; break; }
  }
  const literal = html.slice(exprStart, i);
  return new Function(`return (${literal});`)();
}

const sizes = extract('sizes');
const data = extract('data');

test('every nominal size listed has a data table entry', () => {
  sizes.forEach((size) => {
    assert.ok(data[size], `"${size}" is in sizes[] but missing from data{}`);
  });
});

test('every rating row has physically sane, positive dimensions', () => {
  Object.keys(data).forEach((size) => {
    Object.keys(data[size]).forEach((rating) => {
      const row = data[size][rating];
      const ctx = `${size} @ ${rating} psi`;
      ['bore', 'od', 'rf', 'hub', 'bc', 'boltDia', 'boltHole', 'studLen', 'hubMin'].forEach((key) => {
        assert.ok(typeof row[key] === 'number' && row[key] > 0, `${ctx}: ${key} must be a positive number, got ${row[key]}`);
      });
      assert.ok(Number.isInteger(row.n) && row.n > 0, `${ctx}: bolt count n must be a positive integer`);
      assert.ok(row.ring !== undefined && row.ring !== '', `${ctx}: ring designation must not be empty`);
    });
  });
});

test('bore < bolt circle < outside diameter for every row (physical ordering)', () => {
  Object.keys(data).forEach((size) => {
    Object.keys(data[size]).forEach((rating) => {
      const row = data[size][rating];
      const ctx = `${size} @ ${rating} psi`;
      assert.ok(row.bore < row.bc, `${ctx}: bore (${row.bore}) should be smaller than bolt circle (${row.bc})`);
      assert.ok(row.bc < row.od, `${ctx}: bolt circle (${row.bc}) should be smaller than OD (${row.od})`);
    });
  });
});

test('bolt hole is always larger than bolt diameter (clearance)', () => {
  Object.keys(data).forEach((size) => {
    Object.keys(data[size]).forEach((rating) => {
      const row = data[size][rating];
      assert.ok(row.boltHole > row.boltDia, `${size} @ ${rating} psi: bolt hole (${row.boltHole}) must clear the stud diameter (${row.boltDia})`);
    });
  });
});

test('every remaining size has all four pressure ratings (3000/5000/10000/15000 psi)', () => {
  // 13 5/8" and 16 3/4" used to be the exception to this (present, but
  // missing 10K/15K). They've since been removed entirely — see the test
  // below — so this now checks a plain, exception-free invariant: every
  // size that exists has the full rating set.
  sizes.forEach((size) => {
    ['3000', '5000', '10000', '15000'].forEach((rating) => {
      assert.ok(data[size][rating], `${size} is missing the ${rating} psi rating`);
    });
  });
});

test('13 5/8" and 16 3/4" stay removed until re-keyed from a stamped API Spec 6A source', () => {
  // Removed entirely, not just banner-warned — a warning wasn't enough
  // since the wrong OD/BC/bolt numbers were still readable, saveable,
  // and printable. Re-adding needs a stamped API Spec 6A table, not a
  // web-search reconstruction. This test is the guardrail against that
  // happening by accident in a future edit.
  assert.ok(!sizes.includes('13 5/8'), '"13 5/8" should not be reintroduced without a stamped API Spec 6A source');
  assert.ok(!sizes.includes('16 3/4'), '"16 3/4" should not be reintroduced without a stamped API Spec 6A source');
  assert.ok(!data['13 5/8'], 'data table should not have an orphaned "13 5/8" entry either');
  assert.ok(!data['16 3/4'], 'data table should not have an orphaned "16 3/4" entry either');
});
