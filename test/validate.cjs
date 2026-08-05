/* Validierung der Abacus-Engine gegen das im Abacus mitgelieferte Beispiel
 * (bizhub 4000i / Modul BH4422S, CalculationReport).
 *   Ausführen:  node test/validate.cjs
 */
const E = require('../js/abacus-engine.js');

const model = {
  currency: '€',
  conditions: { volumePeriod: 1, calcPeriod: 60, profitParts: 0, profitCons: 0, profitToner: 0, profitService: 0 },
  service: { mcbf: 26239, pmCycle: 200000, timeCM: 0.5, timePM: 2.36, nonPMpartsFact: 0.5, avImgJob: 1, effImgJob: 1, singImgJobMul: 1.2 },
  labour: { timeTrav: 0.5, costTravHour: 45, distTrav: 30, costTravDist: 0.7, costFixPerTrav: 0, costFixMonthTrav: 0, costLabHour: 45, timeOV: 0, costOV: 45, plannedOV: 0 },
  toners: [],
  parts: [
    { name: 'IUP26 imaging unit', type: 'cons',  price: 27.70, yield: 60000,  qty: 1, yspread: 1, fkt: 'print', unit: 'rl' },
    { name: 'Transfer Roller',    type: 'spare', price: 7.14,  yield: 200000, qty: 1, yspread: 1, fkt: 'print', unit: 'rl' },
    { name: 'Fusing Unit',        type: 'spare', price: 88.49, yield: 200000, qty: 1, yspread: 1, fkt: 'print', unit: 'rl' },
    { name: 'Pick-Up Roller',     type: 'spare', price: 4.42,  yield: 200000, qty: 1, yspread: 1, fkt: 'feed',  unit: 'cs' },
    { name: 'Feed/Separation Pad',type: 'spare', price: 7.24,  yield: 200000, qty: 1, yspread: 1, fkt: 'feed',  unit: 'cs' }
  ],
  volumes: [ { name: 'A4 mono', type: 'print', colorMode: 'K', coverage: 5, images: 3500, plexity: 1, refMul: 1 } ]
};

const r = E.calculate(model);
const cases = [
  ['Verbrauch (cons)',                 r.totals.cons,    83.10],
  ['Serviceteile PM (roh)',            r.totals.sparePM, 107.29],
  ['Serviceteile abgerechnet',         r.totals.parts,   160.935]
];

let ok = true;
console.log('Abacus-Engine Validierung (bizhub 4000i / BH4422S)\n');
for (const [name, got, exp] of cases) {
  const pass = Math.abs(got - exp) < 0.005;
  ok = ok && pass;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(28)} erwartet ${exp.toFixed(3).padStart(10)}  =  ${got.toFixed(3).padStart(10)}`);
}
console.log(`\n  info  Labour (Formel mit aktuellem Wertesatz): ${r.totals.labour.toFixed(3)}  (Report-Altstand: 833,79)`);
console.log(`  info  Service-Besuche ${r.service.visits}, MCBV ${Math.round(r.service.mcbv)}, Ref-Länge ${r.service.totalRefLength}\n`);
console.log(ok ? 'ALLE KERN-POSITIONEN OK ✓' : 'VALIDIERUNG FEHLGESCHLAGEN ✗');
process.exit(ok ? 0 : 1);
