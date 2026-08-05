/* ============================================================================
 * Abacus Klickpreis-Engine  (faithful re-implementation)
 * ----------------------------------------------------------------------------
 * Reproduces the cost model of Konica Minolta's "Abacus for Distributors"
 * PDF tool (Build 171). The formulas below are transcribed 1:1 from the
 * document-level JavaScript embedded in the Abacus PDF
 * (functions calcVolumeValues() and calcVolumeModuleValues()).
 *
 * The engine is framework-free and runs both in the browser and in Node
 * (CommonJS export at the bottom), so it can be unit-tested against the
 * worked example that ships inside the Abacus file (bizhub 4000i / BH4422S).
 * ========================================================================== */

(function (root) {
  'use strict';

  // linear interpolation of y for x on the line through (x0,y0)-(x1,y1)
  function lineY(x, x0, x1, y0, y1) {
    var m = (y0 - y1) / (x0 - x1);
    var n = y1 - m * x1;
    return m * x + n;
  }

  /* --------------------------------------------------------------------------
   * yield of a toner package at a given coverage.
   *   curve: array of [coverage%, images] points, ascending by coverage.
   *   - 1 point  -> yield scales inversely with coverage (KM reference model):
   *                 y(cov) = y0 * cov0 / cov
   *   - >1 point -> piece-wise linear interpolation between bracketing points
   * ------------------------------------------------------------------------ */
  function tonerYieldAt(curve, cov) {
    if (!curve || !curve.length) return 0;
    if (curve.length === 1) {
      var x0 = curve[0][0], y0 = curve[0][1];
      return y0 * x0 / cov; // reference-coverage model
    }
    // find bracketing segment
    for (var i = 0; i < curve.length - 1; i++) {
      var a = curve[i], b = curve[i + 1];
      if (cov >= a[0] && cov <= b[0]) return lineY(cov, a[0], b[0], a[1], b[1]);
    }
    // out of range -> clamp to nearest end segment
    if (cov < curve[0][0]) return curve[0][1] * curve[0][0] / cov;
    var last = curve[curve.length - 1];
    return last[1] * last[0] / cov;
  }

  /* --------------------------------------------------------------------------
   * Per-volume geometric counters (from calcVolumeValues).
   * A click contract is defined per A4 image, therefore the reference media is
   * A4 (refMul = 1). Other media scale via their reference multiplier.
   *   ci = images, cs = sheets, rl = reference-length equiv, ra = ref-area equiv
   * ------------------------------------------------------------------------ */
  function volumeCounters(vol) {
    var img = num(vol.images);
    var plex = num(vol.plexity) || 1;
    var refMul = vol.refMul == null ? 1 : num(vol.refMul);
    var area = vol.areaMul == null ? refMul : num(vol.areaMul);
    return {
      ci: img,                          // images
      cs: Math.ceil(img / plex),        // sheets
      rl: Math.ceil(img * refMul),      // reference length equivalent
      rs: Math.ceil(refMul * img / plex),
      ra: Math.round(img * area * 1000) / 1000 // reference area equivalent
    };
  }

  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  /* ==========================================================================
   * MAIN CALCULATION
   *   model = { currency, conditions, service, labour, toners[], parts[],
   *             volumes[] }   (see README / index.html for the full shape)
   * returns a structured result with per-volume and overall click prices.
   * ======================================================================== */
  function calculate(model) {
    var cond = model.conditions, svc = model.service, lab = model.labour;

    var volumePeriod = num(cond.volumePeriod) || 1;
    var calcPeriod = num(cond.calcPeriod) || 1;
    var mult = calcPeriod / volumePeriod;   // volPeriodMultiplier

    var profitParts = num(cond.profitParts);
    var profitCons = num(cond.profitCons);
    var profitToner = num(cond.profitToner);
    var profitService = num(cond.profitService);

    // ---- per-volume counters ------------------------------------------------
    var vols = model.volumes.map(function (v) {
      var c = volumeCounters(v);
      return {
        def: v, counters: c,
        cost: { toner: 0, cons: 0, parts: 0, labour: 0 }
      };
    });

    // ---- accumulate function+unit counters across all volumes (over period) -
    // key = fkt + '_' + unit  (e.g. 'print_rl', 'feed_cs')
    var fu = {};
    function addFU(fkt, unit, value) {
      var k = fkt + '_' + unit;
      fu[k] = (fu[k] || 0) + value;
    }
    vols.forEach(function (V) {
      var c = V.counters;
      // usage of each function is taken as 100 % on the counted units
      ['ci', 'cs', 'rl', 'rs', 'ra'].forEach(function (u) {
        addFU('print', u, c[u] * mult);
        addFU('feed', u, c[u] * mult);
        addFU('scan', u, c[u] * mult);
        addFU('copy', u, c[u] * mult);
      });
    });

    // ---- spare parts & consumables -----------------------------------------
    var fktCostSpare = {}, fktCostCons = {};
    var spareDetail = [], consDetail = [];
    var totalSpareRaw = 0, totalConsRaw = 0;

    (model.parts || []).forEach(function (p) {
      var qty = num(p.qty) || 1;
      var yspread = num(p.yspread) || 1;
      var y = num(p.yield);
      var price = num(p.price);
      var unitKey = (p.fkt || 'print') + '_' + (p.unit || 'rl');
      var vol = fu[unitKey] || 0;
      var amount = 0, cost = 0;
      if (p.type === 'cons') {
        if (y > 0 && y <= vol) {
          amount = Math.floor(vol / (yspread * y)) * qty;
          cost = price * amount;
          totalConsRaw += cost;
          fktCostCons[unitKey] = (fktCostCons[unitKey] || 0) + cost;
        }
        consDetail.push(row(p, qty, price, y * yspread, vol, amount, cost));
      } else { // spare
        var absY = Math.abs(y);
        if (absY > 0 && absY <= vol) {
          amount = Math.floor(vol / (yspread * absY)) * qty;
          cost = price * amount;
          totalSpareRaw += cost;
          fktCostSpare[unitKey] = (fktCostSpare[unitKey] || 0) + cost;
        }
        spareDetail.push(row(p, qty, price, y * yspread, vol, amount, cost));
      }
    });

    function row(p, qty, price, yield_, vol, amount, cost) {
      return {
        name: p.name, code: p.code || '', qty: qty, price: price,
        yield: yield_, fkt: p.fkt, unit: p.unit, vol: Math.ceil(vol),
        used: amount, cost: cost
      };
    }

    // ---- images-per-job multiplier (service value) -------------------------
    var avImgJob = svc.avImgJob == null ? 1 : num(svc.avImgJob);
    var effImgJob = svc.effImgJob == null ? 1 : num(svc.effImgJob);
    var singImgJobMul = svc.singImgJobMul == null ? 1 : num(svc.singImgJobMul);
    var imgJobMul;
    if (avImgJob >= effImgJob) imgJobMul = 1;
    else {
      var m = (1 - singImgJobMul) / (effImgJob - 1);
      var n = 1 - m * effImgJob;
      imgJobMul = m * avImgJob + n;
    }

    // ---- toner --------------------------------------------------------------
    // per volume, per active colour: packages = printedImages / yield(coverage)
    var tonerCostByColor = {}, tonerAmountByColor = {};
    var tonerDetail = [];
    var tonersByColor = {};
    (model.toners || []).forEach(function (t) { tonersByColor[t.color] = t; });

    vols.forEach(function (V) {
      var v = V.def;
      var colors = colorList(v.colorMode);          // ['K'] or ['K','C','M','Y']
      var printImages = V.counters.ra;              // reference areas printed (=images for A4)
      colors.forEach(function (col) {
        var t = tonersByColor[col];
        if (!t) return;
        var cov = coverageFor(v, col);
        if (cov <= 0) return;
        var yAt = tonerYieldAt(t.curve, cov);
        if (yAt <= 0) return;
        var qty = num(t.qty) || 1;
        var price = num(t.price);
        var amount = printImages / yAt;             // packages for this volumePeriod
        var cost = amount * price / qty;
        tonerAmountByColor[col] = (tonerAmountByColor[col] || 0) + amount;
        tonerCostByColor[col] = (tonerCostByColor[col] || 0) + cost;
        V.cost.toner += cost;                       // per volumePeriod
        tonerDetail.push({
          volume: v.name, color: col, coverage: cov, price: price,
          yieldAt: Math.round(yAt), packages: amount, cost: cost
        });
      });
    });

    var totalTonerRaw = 0;
    for (var col in tonerCostByColor) totalTonerRaw += tonerCostByColor[col];

    // ---- service / labour ---------------------------------------------------
    var totalRefLength = 0;
    vols.forEach(function (V) { totalRefLength += V.counters.rl * mult; });

    var mcbf = num(svc.mcbf), pmCycle = num(svc.pmCycle);
    var mcbv = num(svc.mcbv);
    if (!mcbv) {
      if (mcbf > 0 && pmCycle > 0) mcbv = Math.ceil(1 / (1 / mcbf + 1 / pmCycle));
      else if (mcbf > 0) mcbv = mcbf;
    }
    var visits = mcbv > 0 ? Math.ceil(totalRefLength / mcbv) : 0; // total service visits
    var visitsPM = pmCycle > 0 ? totalRefLength / pmCycle : 0;
    var eventsPM = pmCycle > 0 ? Math.floor(totalRefLength / pmCycle) : 0;

    var plannedOV = num(lab.plannedOV);
    var timeTrav = num(lab.timeTrav), costTravHour = num(lab.costTravHour);
    var distTrav = num(lab.distTrav), costTravDist = num(lab.costTravDist);
    var costFixPerTrav = num(lab.costFixPerTrav), costFixMonthTrav = num(lab.costFixMonthTrav);
    var costLabHour = num(lab.costLabHour);
    var timeOV = num(lab.timeOV), costOV = num(lab.costOV);
    var timeCM = num(svc.timeCM), timePM = num(svc.timePM);

    var trips = plannedOV + visits;
    var travTimeCost = timeTrav * trips * costTravHour;
    var travDistCost = costTravDist * distTrav * trips;
    var fixPerTrav = costFixPerTrav * trips;
    var fixPerMonth = costFixMonthTrav * mult;
    var tCM = (visits - visitsPM) * timeCM;
    var tPM = eventsPM * timePM;
    var labHour = costLabHour * (tCM + tPM);
    var tOV = plannedOV * timeOV;
    var otherVisits = tOV * costOV;
    var serviceCostRaw = travTimeCost + travDistCost + fixPerTrav + fixPerMonth + labHour + otherVisits;

    // ---- apply profit & multipliers ----------------------------------------
    var nonPM = svc.nonPMpartsFact == null ? 0 : num(svc.nonPMpartsFact);

    var totalSpare = totalSpareRaw * imgJobMul;
    totalSpare = totalSpare + totalSpare * (profitParts / 100);
    var costParts = totalSpare * (1 + nonPM);           // billed spare parts incl. non-PM ratio

    var totalCons = totalConsRaw * imgJobMul;
    totalCons = totalCons + totalCons * (profitCons / 100);

    var totalToner = totalTonerRaw * mult;
    totalToner = totalToner + totalToner * (profitToner / 100);

    var totalLabour = serviceCostRaw + serviceCostRaw * (profitService / 100);

    var grandTotal = costParts + totalCons + totalToner + totalLabour;
    var grandTotalNoToner = costParts + totalCons + totalLabour;

    // ---- allocate cost to each volume (from calcVolumeModuleValues report) --
    // parts/cons by their function-unit share, labour by reference-length share
    vols.forEach(function (V) {
      // parts
      var partsCost = allocByUnit(V, fktCostSpare, vols) * (1 + nonPM) / mult;
      var consCost = allocByUnit(V, fktCostCons, vols) / mult;
      V.cost.parts = partsCost * imgJobMul * (1 + profitParts / 100);
      V.cost.cons = consCost * imgJobMul * (1 + profitCons / 100);
      // labour by reference length share
      var volRL = V.counters.rl * mult;
      V.cost.labour = totalRefLength > 0 ? totalLabour * volRL / totalRefLength : 0;
      // toner already per volumePeriod -> scale to period + profit
      V.cost.toner = V.cost.toner * mult * (1 + profitToner / 100);
      V.cost.total = V.cost.parts + V.cost.cons + V.cost.toner + V.cost.labour;
      // per-image click prices
      var imgPeriod = V.counters.ci * mult;
      V.clickTotal = imgPeriod > 0 ? V.cost.total / imgPeriod : 0;
      V.clickToner = imgPeriod > 0 ? V.cost.toner / imgPeriod : 0;
      V.clickCons = imgPeriod > 0 ? V.cost.cons / imgPeriod : 0;
      V.clickParts = imgPeriod > 0 ? V.cost.parts / imgPeriod : 0;
      V.clickLabour = imgPeriod > 0 ? V.cost.labour / imgPeriod : 0;
    });

    function allocByUnit(V, fktCost, allVols) {
      var sum = 0;
      for (var key in fktCost) {
        var unit = key.substr(key.indexOf('_') + 1);
        var base = unit.split('_')[0];
        var volUnitVal = V.counters[base] || 0;
        var totalUnit = 0;
        allVols.forEach(function (W) { totalUnit += (W.counters[base] || 0) * mult; });
        if (totalUnit > 0) sum += volUnitVal * mult * fktCost[key] / totalUnit;
      }
      return sum;
    }

    // total images over the period
    var totalImages = 0;
    vols.forEach(function (V) { totalImages += V.counters.ci * mult; });

    return {
      currency: model.currency || '€',
      period: { calcPeriod: calcPeriod, volumePeriod: volumePeriod, mult: mult },
      totals: {
        toner: totalToner, cons: totalCons, parts: costParts,
        sparePM: totalSpare, labour: totalLabour,
        total: grandTotal, totalNoToner: grandTotalNoToner,
        images: totalImages
      },
      clickOverall: totalImages > 0 ? {
        total: grandTotal / totalImages,
        toner: totalToner / totalImages,
        cons: totalCons / totalImages,
        parts: costParts / totalImages,
        labour: totalLabour / totalImages
      } : null,
      service: {
        mcbv: mcbv, visits: visits, visitsPM: visitsPM, eventsPM: eventsPM,
        totalRefLength: totalRefLength, imgJobMul: imgJobMul,
        breakdown: {
          travelTime: travTimeCost, travelDist: travDistCost,
          fixPerTrav: fixPerTrav, fixPerMonth: fixPerMonth,
          labourHours: labHour, courtesyVisits: otherVisits
        }
      },
      volumes: vols.map(function (V) {
        return {
          name: V.def.name, colorMode: V.def.colorMode,
          images: V.counters.ci, imagesPeriod: V.counters.ci * mult,
          counters: V.counters, cost: V.cost,
          click: {
            total: V.clickTotal, toner: V.clickToner, cons: V.clickCons,
            parts: V.clickParts, labour: V.clickLabour,
            per1000: V.clickTotal * 1000
          }
        };
      }),
      detail: { spare: spareDetail, cons: consDetail, toner: tonerDetail }
    };
  }

  function colorList(mode) {
    if (!mode || mode === 'K' || mode === 'mono' || mode === 'monochrome') return ['K'];
    return ['K', 'C', 'M', 'Y'];
  }
  function coverageFor(vol, col) {
    if (vol.coverage && typeof vol.coverage === 'object') {
      if (vol.coverage[col] != null) return num(vol.coverage[col]);
    }
    // single coverage value applies to each active colour
    return num(vol.coverage);
  }

  var api = { calculate: calculate, tonerYieldAt: tonerYieldAt, volumeCounters: volumeCounters };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AbacusEngine = api;
})(typeof window !== 'undefined' ? window : this);
