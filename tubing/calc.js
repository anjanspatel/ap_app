/* AP WORKSPACE — Safety Block Calculator, pure calculation core.
   Loaded by tubing/index.html via <script src="calc.js"> and required
   directly by test/tubing.test.js — this is the single source of truth
   for the formula, not a copy kept in sync by hand.
*/
function computeSWL(bhn, w_in, t_in) {
  var uts = 500 * bhn;
  var tau = uts * 0.577;
  var area = w_in * t_in;
  var swl_lbs = (tau / 3) * area;
  return { uts: uts, tau: tau, area: area, swl_lbs: swl_lbs };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeSWL: computeSWL };
}
