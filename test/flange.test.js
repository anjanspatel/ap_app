/* Flange dimensions are a lookup table (API 6A Table 2 values), not a
   formula — there's nothing to "compute" and verify against a reference
   calculation. What can regress is the data itself: a typo'd bore, a
   missing rating, a bolt circle smaller than the bore. This test parses
   the real table straight out of flange/index.html (no refactor of the
   live page needed) and checks structural/physical invariants.
*/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../flange/index.html'), 'utf8');

function extract(sourceName) {
  const startMarker = `const ${sourceName} =`;
  const start = html.indexOf(startMarker);
  assert.ok(start !== -1, `could not find "${startMarker}" in flange/index.html — has the variable been renamed?`);
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

test('every size covers at least the base 3000 and 5000 psi ratings', () => {
  // 10000/15000 are intentionally absent for the largest bores (13 5/8",
  // 16 3/4") — those sizes are not manufactured in those pressure
  // classes per API 6A, so this only asserts the ratings every size
  // actually has, not a universal 4-rating grid that doesn't exist.
  sizes.forEach((size) => {
    ['3000', '5000'].forEach((rating) => {
      assert.ok(data[size][rating], `${size} is missing the ${rating} psi rating`);
    });
  });
});

test('only the two largest bores omit the 10000/15000 psi ratings', () => {
  const expectedToOmitHighPressure = ['13 5/8', '16 3/4'];
  sizes.forEach((size) => {
    const hasHighPressure = Boolean(data[size]['10000']) && Boolean(data[size]['15000']);
    if (expectedToOmitHighPressure.includes(size)) {
      assert.ok(!hasHighPressure, `${size} was expected to omit 10K/15K but now has them — update this test if that's an intentional data addition`);
    } else {
      assert.ok(hasHighPressure, `${size} is missing 10000 or 15000 psi — every size except 13 5/8" and 16 3/4" should have all four ratings`);
    }
  });
});
