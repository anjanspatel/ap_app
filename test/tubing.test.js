const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSWL } = require('../tubing/calc.js');

test('SWL — known reference case (BHN 250, 4.000in x 2.500in)', () => {
  const r = computeSWL(250, 4.000, 2.500);
  assert.equal(r.uts, 125000, 'UTS = 500 * BHN');
  assert.ok(Math.abs(r.tau - 72125) < 0.001, 'shear strength = UTS * 0.577');
  assert.equal(r.area, 10, 'area = width * thickness');
  assert.ok(Math.abs(r.swl_lbs - 240416.6667) < 0.01, 'SWL = (tau / 3) * area');
});

test('SWL scales linearly with area', () => {
  const base = computeSWL(200, 4, 4);
  const doubled = computeSWL(200, 8, 4); // double the width -> double the area
  assert.ok(Math.abs(doubled.swl_lbs - base.swl_lbs * 2) < 0.001);
});

test('SWL scales linearly with BHN (via UTS)', () => {
  const base = computeSWL(100, 4, 4);
  const doubled = computeSWL(200, 4, 4);
  assert.ok(Math.abs(doubled.swl_lbs - base.swl_lbs * 2) < 0.001);
});

test('zero or negative inputs are not the calculator\'s job to reject — the UI layer validates before calling this', () => {
  // computeSWL is a pure function; the page's calc() guards against
  // invalid input before calling it. Documenting that boundary here
  // so a future refactor doesn't accidentally expect this function
  // to throw on bad input.
  const r = computeSWL(0, 4, 4);
  assert.equal(r.swl_lbs, 0);
});
