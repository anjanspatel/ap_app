const test = require('node:test');
const assert = require('node:assert/strict');
const { BOLTS, GRADES, LUBES, computeTorque } = require('../torque/calc.js');

test('torque — known reference case (1" B7, dry, 60% preload, 8 bolts)', () => {
  const b = BOLTS['1.0'];
  const g = GRADES['B7'];
  const lube = LUBES['dry'];
  const d = parseFloat('1.0');
  const proofStr = g.proofFn(d);

  assert.equal(proofStr, 105000, 'B7 proof strength at d<=1in is 105,000 psi per ASTM A193');
  assert.equal(b.area, 0.6060, 'tensile stress area for a 1" bolt');

  const r = computeTorque({ area: b.area, proofStr, preloadPct: 60, K: lube.k, d, numBolts: 8 });

  assert.ok(Math.abs(r.proofLoad - 63630) < 0.01);
  assert.ok(Math.abs(r.clamp - 38178) < 0.01);
  assert.ok(Math.abs(r.torqueFtLb - 636.3) < 0.01);
  assert.ok(Math.abs(r.torqueNm - 862.708) < 0.01);
  assert.ok(Math.abs(r.totalFtLb - 5090.4) < 0.01, 'total torque = per-bolt torque * bolt count');
  assert.ok(Math.abs(r.clampKn - 169.824) < 0.01);
});

test('B7 proof strength steps down at the ASTM A193 diameter breakpoints (2-1/2in, 4in)', () => {
  const proofFn = GRADES['B7'].proofFn;
  assert.equal(proofFn(1.0), 105000, 'd <= 2.5in');
  assert.equal(proofFn(2.0), 105000, 'd <= 2.5in — the largest bolt this app offers');
  assert.equal(proofFn(2.5), 105000, 'd <= 2.5in, inclusive boundary');
  assert.equal(proofFn(3.0), 95000, '2.5in < d <= 4in');
  assert.equal(proofFn(4.0), 95000, 'd <= 4in, inclusive boundary');
  assert.equal(proofFn(4.5), 75000, 'd > 4in');
});

test('B7M and L7M are flat 80,000 psi regardless of diameter', () => {
  assert.equal(GRADES['B7M'].proofFn(0.5), 80000);
  assert.equal(GRADES['B7M'].proofFn(2.0), 80000);
  assert.equal(GRADES['L7M'].proofFn(1.0), 80000);
});

test('total torque scales linearly with bolt count', () => {
  const params = { area: 0.6060, proofStr: 105000, preloadPct: 60, K: 0.20, d: 1.0, numBolts: 4 };
  const four = computeTorque(params);
  const eight = computeTorque({ ...params, numBolts: 8 });
  assert.ok(Math.abs(eight.totalFtLb - four.totalFtLb * 2) < 0.001);
  assert.ok(Math.abs(eight.torqueFtLb - four.torqueFtLb) < 0.001, 'per-bolt torque is independent of bolt count');
});

test('every bolt size table entry has a positive area and thread pitch', () => {
  Object.keys(BOLTS).forEach((size) => {
    const b = BOLTS[size];
    assert.ok(b.area > 0, `${size} area must be positive`);
    assert.ok(b.tpi > 0, `${size} tpi must be positive`);
    assert.ok(typeof b.label === 'string' && b.label.length > 0);
  });
});
