/* Textbausteine (Abschnitt 8).

   Templates über die Felder der Abschnitte 4 und 5. Keine Bedingungen im
   Text – Varianten sind eigene Bausteine. */

const TEXT = (() => {
  "use strict";

  const num = DERIVE.num, txt = DERIVE.text;

  const headStandort = (ctx) => {
    const name = txt(ctx, "standort.name");
    return name ? `Standort ${ctx.index}: ${name}` : `Standort ${ctx.index}`;
  };

  const headDl = (ctx) => {
    const name = txt(ctx, "standort.name");
    const basis = "Im Angebot enthaltene Schulungen und Dienstleistungen – Standort";
    return name ? `${basis} ${ctx.index}: ${name}` : `${basis} ${ctx.index}`;
  };

  function lineAdresse(ctx) {
    const ort = ctx.values["standort.plz_ort"] || {};
    const teile = [txt(ctx, "standort.strasse"), `${ort.plz || ""} ${ort.ort || ""}`.trim()];
    return "Installationsadresse: " + teile.filter(Boolean).join(", ");
  }

  const serviceKopf = (d) => `Wartungs- und Klick-Kosten für ${d.geraet}`;

  /** Zeilen der Servicetabelle in fester Reihenfolge (Abschnitt 8.2). */
  function serviceZeilen(ctx, d) {
    const zeilen = [];

    const block1 = [`Servicevertrag pro Monat und pro Gerät für ${d.geraet}`];
    if (d.show.sla) {
      // Ist sla.preis 0, wird kein Betrag ausgegeben – der SLA steckt in
      // service.geraet und würde sonst doppelt wirken.
      block1.push(`Service Level Agreement: ${d.slaKurz}`);
    }
    block1.push(
      `Mit ${FMT.intCh(num(ctx, "volumen.color"))} Seiten in Farbe und ` +
      `${FMT.intCh(num(ctx, "volumen.sw"))} Seiten schwarzweiss inkludiert`
    );
    zeilen.push([block1, [FMT.chf(num(ctx, "service.geraet"))]]);

    const klickT = [], klickB = [];
    if (d.show.color) {
      klickT.push(`Zusätzliche Seiten ab der ${d.abSeite.color}. Seite in Farbe`);
      klickB.push(FMT.rate(num(ctx, "preis.color")));
    }
    if (d.show.sw) {
      klickT.push(`Zusätzliche Seiten ab der ${d.abSeite.sw}. Seite schwarzweiss`);
      klickB.push(FMT.rate(num(ctx, "preis.sw")));
    }
    if (klickT.length) zeilen.push([klickT, klickB]);

    if (d.show.scan) {
      zeilen.push([[`Zusätzliche Scans ab dem ${d.abSeite.scan}. Scan`],
                   [FMT.rate(num(ctx, "preis.scan"))]]);
    }

    const fleetT = [], fleetB = [];
    if (d.show.fleet) {
      fleetT.push(`Zählerstanderfassung und Fleet Management: ${txt(ctx, "fleet.level")}`);
      fleetB.push(num(ctx, "fleet.preis") > 0 ? FMT.chf(num(ctx, "fleet.preis")) : "");
    }
    if (d.show.zaehlerversand) {
      fleetT.push(`Zählerstandsmeldung: ${txt(ctx, "zaehlerversand")}`);
      fleetB.push("");
    }
    if (fleetT.length) zeilen.push([fleetT, fleetB.some(Boolean) ? fleetB : [""]]);

    return zeilen;
  }

  /** Summenzeilen eines Standorts (Abschnitt 5.4). */
  function totalZeilen(ctx, d) {
    if (d.variante === "KAUF") {
      return [["Total Kauf", FMT.chf(num(ctx, "vertragswert"))]];
    }
    const label = `${txt(ctx, "summenlabel")} bei einer Laufzeit von ` +
                  `${FMT.intCh(num(ctx, "laufzeit"))} Monaten`;
    return [
      [label, FMT.chf(num(ctx, "pauschale_ohne_service"))],
      ["Monatspauschale total inkl. Service", FMT.chf(num(ctx, "monatspauschale_total"))],
    ];
  }

  /** Überschrift und Absätze des Vertragstexts (Abschnitt 8.3). */
  function vertragstext(ctx, d) {
    if (d.variante === "KAUF") {
      return ["Laufzeit und Kündigungsfrist für Serviceverträge beim Kauf", [
        "Der Start und die Laufzeit des Servicevertrags werden gemäss einer separaten " +
        "Vereinbarung festgelegt. Nach Ablauf der vereinbarten Laufzeit verlängert sich " +
        "der Servicevertrag automatisch um jeweils ein Jahr. Eine Kündigung des " +
        "Servicevertrags ist möglich, indem er mit einer Kündigungsfrist von drei Monaten " +
        "zum Ende der Laufzeit gekündigt wird.",
      ]];
    }
    const beginn = ctx.values.vertragsbeginn;
    const phrase = beginn ? `am ${FMT.dateDe(beginn)}` : "zum vereinbarten Zeitpunkt";
    return [`Laufzeit und Kündigungsfrist ${d.vertragsartWort} und Servicevertrag`, [
      `Der ${d.vertragsartWort} tritt ${phrase} in Kraft und läuft für eine bestimmte ` +
      `Laufzeit von ${FMT.intCh(num(ctx, "laufzeit"))} Monaten. Die Laufzeit des ` +
      "Servicevertrags ist an diese Laufzeit gekoppelt und endet gleichzeitig. Nach Ablauf " +
      "verlängern sich beide Verträge automatisch um jeweils ein weiteres Jahr. Eine " +
      "Beendigung ist möglich, indem sie jeweils zum Ende der Laufzeit unter Einhaltung " +
      "einer Kündigungsfrist von drei Monaten gekündigt werden.",
    ]];
  }

  function konditionenAbrechnung(ctx) {
    const zeilen = [
      `Servicepauschalen: ${txt(ctx, "fakt.pauschale")}, im Voraus.`,
      `Mehrseitenpreise: ${txt(ctx, "fakt.mehrseiten")}, rückwirkend.`,
    ];
    if (txt(ctx, "fakt.gebuehren")) zeilen.push(`Gebühren: ${txt(ctx, "fakt.gebuehren")}.`);
    return zeilen;
  }

  function konditionenRechnung(ctx, d) {
    return [
      "Die einmaligen Kosten werden nach der Installation in Rechnung gestellt.",
      `Die ${DERIVE.PAUSCHALE_WORT[d.variante]} werden ` +
      `${FMT.klein(txt(ctx, "fakt.pauschale"))} im Voraus verrechnet.`,
      "Die Seitenpreise für Schwarzweiss- und Farbdruck werden " +
      `${FMT.klein(txt(ctx, "fakt.mehrseiten"))} rückwirkend in Rechnung gestellt.`,
    ];
  }

  /** Fehlt ein Teil, entfällt das Segment samt Trennzeichen (Abschnitt 8.5). */
  function nachweis(standorte) {
    const versionen = [...new Set(standorte.map((s) => DERIVE.text(s.ctx, "kalktool.version")).filter(Boolean))];
    const chancen = [...new Set(standorte.map((s) => DERIVE.text(s.ctx, "verkaufschance")).filter(Boolean))];
    const art = DERIVE.text(standorte[0].ctx, "anlieferungsart");
    const teile = [];
    if (versionen.length) teile.push(`Kalkulationsgrundlage: Kalktool ${versionen.join(", ")}`);
    if (chancen.length) teile.push(`Verkaufschance ${chancen.join(", ")}`);
    if (art) teile.push(`Anlieferungsart: ${art}`);
    return teile.join(" · ");
  }

  const gueltigkeit = (d) => `Dieses Angebot ist gültig bis ${FMT.dateDe(d.gueltigBis)}`;
  const ortDatum = (ctx) => `Spreitenbach, ${FMT.dateDe(ctx.values.datum)}`;

  return {
    headStandort, headDl, lineAdresse, serviceKopf, serviceZeilen, totalZeilen,
    vertragstext, konditionenAbrechnung, konditionenRechnung, nachweis,
    gueltigkeit, ortDatum,
    KLASSIFIZIERUNG: "Vertraulich",
    DL_TOTAL_LABEL: "Total einmalige Kosten",
    GESAMT_EINMALIG: "Einmalige Kosten – alle Standorte",
    GESAMT_MONATLICH: "Monatspauschale total – alle Standorte",
    GESAMT_KAUF: "Total Kauf – alle Standorte",
  };
})();
