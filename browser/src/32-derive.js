/* Ableitungsregeln (Abschnitt 5) und CRM (Abschnitt 4.4).

   Alle Regeln sind Boolesche oder arithmetische Ausdrücke über Abschnitt 4.
   Keine Regel liest eine Zelle, die nicht im Feldkatalog steht. */

const DERIVE = (() => {
  "use strict";

  const VARIANTE = {
    1: ["KAUF", null],
    2: ["MIETE", "Mietvertrag"],
    3: ["LEASING", "Leasingvertrag"],
    4: ["LEASING", "Leasingvertrag"],
    5: ["MIETE", "Mietvertrag"],
  };

  const PAUSCHALE_WORT = {
    MIETE: "Miet- und Servicepauschalen",
    LEASING: "Leasing- und Servicepauschalen",
    KAUF: "Servicepauschalen",
  };

  const GUELTIGKEIT_TAGE = 60;

  const num = (ctx, name) => EXTRACT.zahl(ctx.values[name]);
  const text = (ctx, name) => FMT.trim(ctx.values[name]);

  function variante(finanzierungsart) {
    const key = Math.trunc(FMT.zahl(finanzierungsart));
    if (!VARIANTE[key]) throw new OfferteError("E401", `finanzierungsart=${finanzierungsart}`);
    return VARIANTE[key];
  }

  function derive(ctx, warn) {
    const [art, wort] = variante(ctx.values.finanzierungsart);
    const d = { variante: art, vertragsartWort: wort };

    const volSw = num(ctx, "volumen.sw"), prSw = num(ctx, "preis.sw");
    const volCol = num(ctx, "volumen.color"), prCol = num(ctx, "preis.color");
    const volScan = num(ctx, "volumen.scan"), prScan = num(ctx, "preis.scan");

    d.dienstleistungTotal = (ctx.listen.dienstleistung || []).reduce((s, p) => s + p.betrag, 0);

    const solSw = EXTRACT.zahl(ctx.probes["solutions.sw_tot"]);
    const solMnt = EXTRACT.zahl(ctx.probes["solutions.mnt_tot"]);
    const solDl = EXTRACT.zahl(ctx.probes["solutions.dl_tot"]);
    d.solutionsTotal = solSw + solMnt + solDl;

    // Abschnitt 5.2 – Schalter. show.color prüft zusätzlich den Klickpreis:
    // im Referenzfall ist volumen.color 0, preis.color aber 0.032.
    d.show = {
      sw: volSw > 0 || prSw > 0,
      color: volCol > 0 || prCol > 0,
      scan: volScan > 0 || prScan > 0,
      fleet: !!text(ctx, "fleet.level"),
      solutions: solSw > 0 || solMnt > 0 || solDl > 0,
      dienstleistung: d.dienstleistungTotal > 0,
      altvertrag: num(ctx, "restwert_altvertrag") > 0,
      sla: !!text(ctx, "sla.type"),
      zaehlerversand: !!text(ctx, "zaehlerversand"),
      // Das Kalktool Q4 2025 führt weder Artikelnummer noch Zeilenpreis
      // (Abschnitt 5.5); der Schalter bleibt bis zur Erweiterung falsch.
      hardware_preise: art === "KAUF" && !!ctx.probes.hardware_spalten,
    };

    d.abSeite = { sw: Math.trunc(volSw) + 1, color: Math.trunc(volCol) + 1, scan: Math.trunc(volScan) + 1 };

    const datum = ctx.values.datum;
    d.gueltigBis = datum instanceof Date
      ? new Date(datum.getTime() + GUELTIGKEIT_TAGE * 86400000)
      : null;

    const hardware = ctx.listen.hardware || [];
    d.geraet = hardware.length ? hardware[0].bezeichnung : "";
    d.slaKurz = PARSE.slaKurz(ctx.values["sla.type"]);

    if (!text(ctx, "standort.name")) warn.add("W309", ctx.quelle);
    if (ctx.probes.stueck_belegbar === false) {
      // Stückzahl wird leer gerendert statt geraten (Abschnitt 5.5).
      for (const p of hardware) p.stueck = "";
    }
    return d;
  }

  /** Summen über alle Standorte (Abschnitt 5.3). */
  function gesamttotal(standorte) {
    const g = { einmalig: 0, monatlich: 0, kauf: 0 };
    for (const { ctx, d } of standorte) {
      g.einmalig += d.dienstleistungTotal;
      g.monatlich += num(ctx, "monatspauschale_total");
      g.kauf += num(ctx, "vertragswert");
    }
    return g;
  }

  return { derive, gesamttotal, variante, num, text, PAUSCHALE_WORT };
})();

/** CRM-Datensatz mit den Ersatzregeln aus Abschnitt 4.4. */
const CRM = (() => {
  "use strict";

  function neu(felder) {
    const werte = felder || {};
    const hol = (name) => FMT.trim(werte[name] || "");
    return {
      get: hol,
      offertnummer(verkaufschance, warn) {
        const v = hol("offertnummer");
        if (v) return v;
        warn.add("W305", `Ersatz: ${verkaufschance}`);
        return verkaufschance;
      },
      offertversion(warn) {
        const v = hol("offertversion");
        if (v) return v;
        warn.add("W306", "Ersatz: 1.0");
        return "1.0";
      },
    };
  }

  return { neu };
})();
