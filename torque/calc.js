/* AP WORKSPACE — Bolt Torque Calculator, pure data + calculation core.
   Loaded by torque/index.html via <script src="calc.js"> and required
   directly by test/torque.test.js — single source of truth for the
   bolt table, grade proof-strength functions, lube factors, and the
   torque formula itself.
*/
var BOLTS = {
  '0.5':  {label:'1/2"',   tpi:13,  area:0.1419},
  '0.625':{label:'5/8"',   tpi:11,  area:0.2260},
  '0.75': {label:'3/4"',   tpi:10,  area:0.3340},
  '0.875':{label:'7/8"',   tpi:9,   area:0.4620},
  '1.0':  {label:'1"',     tpi:8,   area:0.6060},
  '1.125':{label:'1-1/8"', tpi:7,   area:0.7630},
  '1.25': {label:'1-1/4"', tpi:7,   area:0.9690},
  '1.375':{label:'1-3/8"', tpi:6,   area:1.1540},
  '1.5':  {label:'1-1/2"', tpi:6,   area:1.4050},
  '1.625':{label:'1-5/8"', tpi:5.5, area:1.6800},
  '1.75': {label:'1-3/4"', tpi:5,   area:1.9800},
  '2.0':  {label:'2"',     tpi:4.5, area:2.5020},
};

var GRADES = {
  'B7' :{label:'A193 B7', proofFn:function(d){return d<=1?105000:d<=1.5?95000:75000;}},
  'B7M':{label:'A193 B7M',proofFn:function(d){return 80000;}},
  'L7' :{label:'A320 L7', proofFn:function(d){return d<=1?105000:d<=1.5?95000:75000;}},
  'L7M':{label:'A320 L7M',proofFn:function(d){return 80000;}},
};

var LUBES = {
  'dry'   :{label:'Dry', k:0.20},
  'oil'   :{label:'Thread oil', k:0.15},
  'grease':{label:'Heavy grease', k:0.13},
  'moly'  :{label:'Molykote MoS₂', k:0.12},
  'nickel':{label:'Ni anti-seize', k:0.13},
  'ptfe'  :{label:'PTFE/Teflon', k:0.10},
};

/* params: {area, proofStr, preloadPct, K, d, numBolts} */
function computeTorque(params) {
  var proofLoad = params.area * params.proofStr;
  var clamp = proofLoad * (params.preloadPct / 100);
  var torqueInLb = params.K * params.d * clamp;
  var torqueFtLb = torqueInLb / 12;
  var torqueNm = torqueFtLb * 1.35582;
  var totalFtLb = torqueFtLb * params.numBolts;
  var totalNm = totalFtLb * 1.35582;
  var clampKn = clamp * 4.44822 / 1000;
  return {
    proofLoad: proofLoad, clamp: clamp,
    torqueFtLb: torqueFtLb, torqueNm: torqueNm,
    totalFtLb: totalFtLb, totalNm: totalNm,
    clampKn: clampKn
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BOLTS: BOLTS, GRADES: GRADES, LUBES: LUBES, computeTorque: computeTorque };
}
