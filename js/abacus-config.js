/* ============================================================================
 * Abacus-Konfigurator
 * ----------------------------------------------------------------------------
 * Baut aus einem Foliant (Bibliothekseintrag) + gewähltem Modell + Optionen
 * die Vorbelegung für Toner und Serviceteile. Die Zuordnung Modell -> Toner-/
 * Trommel-/Entwickler-Generation und die Default-Ergiebigkeiten sind
 * KM-Referenzwerte und im Rechner frei editierbar.
 * ========================================================================== */
(function (root) {
  'use strict';

  // Modell -> Verbrauchsmaterial-Generation (bizhub C…i-Serie)
  var FAMILY = {
    C251i: { toner: 'TN328', drum: 'DR316', dev: 'DV315' },
    C301i: { toner: 'TN328', drum: 'DR316', dev: 'DV315' },
    C361i: { toner: 'TN328', drum: 'DR316', dev: 'DV315' },
    C451i: { toner: 'TN626', drum: 'DR618', dev: 'DV621' },
    C551i: { toner: 'TN626', drum: 'DR618', dev: 'DV621' },
    C651i: { toner: 'TN715', drum: 'DR618', dev: 'DV621' },
    C751i: { toner: 'TN715', drum: 'DR618', dev: 'DV621' }
  };

  // Default-Ergiebigkeiten (Bilder @5% bzw. Bilder Lebensdauer) – editierbar
  var TONER_YIELD = {
    TN328: { K: 28000, C: 26000 }, TN626: { K: 28000, C: 26000 }, TN715: { K: 38800, C: 35000 }
  };
  var DRUM_YIELD = { DR316: 120000, DR618: 250000 };
  var DEV_YIELD  = { DV315: 600000, DV621: 1200000 };
  var WX_YIELD   = 80000;

  // Default-Servicewerte je Generation (grobe Richtwerte, editierbar)
  var SERVICE = {
    TN328: { mcbf: 120000, pmCycle: 300000, timeCM: 0.4, timePM: 1.2 },
    TN626: { mcbf: 150000, pmCycle: 400000, timeCM: 0.4, timePM: 1.3 },
    TN715: { mcbf: 180000, pmCycle: 450000, timeCM: 0.5, timePM: 1.5 }
  };

  // Optionen, die ein zusätzliches Verbrauchsmaterial verursachen (Heftklammern)
  // Finisher -> Standard-Heftklammer; Booklet (SD) zusätzlich Rückenheftung.
  var STAPLE = {
    'FS-533': ['SK-602'], 'FS-542': ['SK-602'],
    'FS-539': ['SK-602'], 'FS-539SD': ['SK-602', 'SK-704'],
    'FS-540': ['SK-602'], 'FS-540SD': ['SK-602', 'SK-704'],
    'FS-P04': ['SK-602']
  };

  // Welche Artikel als konfigurierbare Optionen angezeigt werden (kuratiert)
  var OPTION_GROUPS = [
    { title: 'Finisher', match: /^FS-/ },
    { title: 'Locher',   match: /^PK-/ },
    { title: 'Papier',   match: /^(LU-|PC-|DK-)/ },
    { title: 'Einzug',   match: /^(DF-|OC-)/ },
    { title: 'Fax / Anbindung', match: /^(FK-|EK-|UK-|SX-)/ }
  ];

  function consBy(foliant, prefix, suffix) {
    var pref = prefix.toUpperCase(), suf = (suffix || '').toUpperCase();
    for (var i = 0; i < foliant.consumables.length; i++) {
      var c = foliant.consumables[i], n = (c.name || '').toUpperCase();
      if (n.indexOf(pref) === 0 && (suf === '' || n.slice(-suf.length) === suf)) return c;
    }
    return null;
  }

  // liste der konfigurierbaren Optionen für die UI
  function optionList(foliant) {
    var models = foliant.models || [];
    var groups = OPTION_GROUPS.map(function (g) {
      var items = (foliant.articles || [])
        .filter(function (a) { return g.match.test(a.name) && models.indexOf(a.name) < 0; })
        .map(function (a) { return { code: a.name, desc: a.desc }; });
      return { title: g.title, items: items };
    }).filter(function (g) { return g.items.length; });
    return groups;
  }

  // Hauptfunktion: baut toners[] + parts[] + service defaults
  function build(foliant, model, options) {
    options = options || [];
    var fam = FAMILY[model] || FAMILY[(foliant.models || [])[0]] || FAMILY.C251i;
    var toners = [], parts = [];

    // ---- Toner (K,C,M,Y) ----
    ['K', 'C', 'M', 'Y'].forEach(function (col) {
      var c = consBy(foliant, fam.toner, col);
      var yld = (TONER_YIELD[fam.toner] || TONER_YIELD.TN328);
      toners.push({
        color: col,
        code: c ? c.name : (fam.toner + col),
        matCode: c ? c.code : '',
        price: 0, qty: 1,
        curve: [[5, col === 'K' ? yld.K : yld.C]]
      });
    });

    // ---- Trommeln (K + CMY) ----
    var drK = consBy(foliant, fam.drum, 'K'), drC = consBy(foliant, fam.drum, 'C');
    var dY = DRUM_YIELD[fam.drum] || 120000;
    if (drK) parts.push(part('Trommel K', drK, 'cons', dY, 1));
    if (drC) parts.push(part('Trommel CMY', drC, 'cons', dY, 3));

    // ---- Entwickler (K + CMY) ----
    var dvK = consBy(foliant, fam.dev, 'K'), dvC = consBy(foliant, fam.dev, 'C');
    var vY = DEV_YIELD[fam.dev] || 600000;
    if (dvK) parts.push(part('Entwickler K', dvK, 'cons', vY, 1));
    if (dvC) parts.push(part('Entwickler CMY', dvC, 'cons', vY, 3));

    // ---- Resttonerbox ----
    var wx = consBy(foliant, 'WX', '');
    if (wx) parts.push(part('Resttonerbox', wx, 'cons', WX_YIELD, 1));

    // ---- PM-Serviceteile (generisch, editierbar, kein Foliant-Preis) ----
    parts.push({ name: 'Fixiereinheit (PM)', code: '', matCode: '', type: 'spare', price: 0, yield: fam.drum === 'DR316' ? 300000 : 500000, qty: 1, yspread: 1, fkt: 'print', unit: 'rl' });
    parts.push({ name: 'Transferband (PM)', code: '', matCode: '', type: 'spare', price: 0, yield: fam.drum === 'DR316' ? 300000 : 500000, qty: 1, yspread: 1, fkt: 'print', unit: 'rl' });
    parts.push({ name: 'Einzugsrollen-Kit (PM)', code: '', matCode: '', type: 'spare', price: 0, yield: 300000, qty: 1, yspread: 1, fkt: 'feed', unit: 'cs' });

    // ---- Heftklammern aus gewählten Finishern ----
    options.forEach(function (opt) {
      var sk = STAPLE[opt];
      if (sk) sk.forEach(function (code) {
        var c = consBy(foliant, code, '');
        parts.push({ name: 'Heftklammern ' + code + ' (' + opt + ')', code: code, matCode: c ? c.code : '', type: 'cons', price: 0, yield: 5000, qty: 1, yspread: 1, fkt: 'feed', unit: 'cs' });
      });
    });

    var svc = SERVICE[fam.toner] || SERVICE.TN328;

    return {
      machineLabel: 'bizhub ' + model + (options.length ? ' + ' + options.join(', ') : ''),
      model: model, family: fam.toner,
      toners: toners, parts: parts,
      service: { mcbf: svc.mcbf, pmCycle: svc.pmCycle, timeCM: svc.timeCM, timePM: svc.timePM,
                 nonPMpartsFact: 0.5, avImgJob: 1, effImgJob: 1, singImgJobMul: 1.2 }
    };

    function part(name, c, type, yield_, qty) {
      return { name: name, code: c ? c.name : '', matCode: c ? c.code : '', type: type,
               price: 0, yield: yield_, qty: qty, yspread: 1, fkt: 'print', unit: 'rl' };
    }
  }

  var api = { build: build, optionList: optionList, FAMILY: FAMILY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AbacusConfig = api;
})(typeof window !== 'undefined' ? window : this);
