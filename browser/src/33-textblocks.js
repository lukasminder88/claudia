/* Textbausteine zusammensetzen (Abschnitt 8).

   Der Wortlaut steht nicht hier, sondern in den Bausteinen. Dieses Modul
   entscheidet nur, welcher Baustein wann gebraucht wird und mit welchen
   Werten er gefüllt wird – die Regeln also, nicht die Formulierung. */

const TEXT = (() => {
  "use strict";

  const num = DERIVE.num, txt = DERIVE.text;
  const B = () => BAUSTEINE;

  const headStandort = (ctx) => {
    const name = txt(ctx, "standort.name");
    return name
      ? B().text("head_standort", { index: ctx.index, name })
      : B().text("head_standort_ohne_name", { index: ctx.index });
  };

  const headDl = (ctx) => {
    const name = txt(ctx, "standort.name");
    return name
      ? B().text("head_dienstleistung", { index: ctx.index, name })
      : B().text("head_dienstleistung_ohne_name", { index: ctx.index });
  };

  /* Installationsadresse; leer, wenn das Kalktool keine führt.

     Manche Kalktools lassen D7 und G7 leer, weil die Installationsadresse der
     Kundenadresse entspricht. Dann entfällt die Zeile ganz – ein blosses
     «Installationsadresse:» ohne Inhalt hilft niemandem. */
  function lineAdresse(ctx) {
    const ort = ctx.values["standort.plz_ort"] || {};
    const strasse = txt(ctx, "standort.strasse");
    const ortszeile = `${ort.plz || ""} ${ort.ort || ""}`.trim();
    if (!strasse && !ortszeile) return "";

    const text = B().text("line_adresse", {
      strasse,
      plz: ort.plz || "",
      ort: ort.ort || "",
    });
    // Fehlt ein Teil, bleibt kein einsames Komma stehen.
    return text
      .replace(/\s*,\s*(?=,|$)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .replace(/,$/, "");
  }

  const serviceKopf = (d) => B().text("tabelle_service_kopf", { geraet: d.geraet });

  const kopfHardware = (mitArtNr) => {
    const spalten = [
      B().text("tabelle_hardware_bezeichnung"),
      B().text("tabelle_hardware_stueck"),
    ];
    return mitArtNr ? [B().text("tabelle_hardware_artnr"), ...spalten] : spalten;
  };

  const kopfDienstleistung = () => [
    B().text("tabelle_dienstleistung_leistung"),
    B().text("tabelle_dienstleistung_betrag"),
  ];

  const kopfService = (d) => [serviceKopf(d), B().text("tabelle_service_total")];

  /** Zeilen der Servicetabelle in fester Reihenfolge (Abschnitt 8.2). */
  function serviceZeilen(ctx, d) {
    const zeilen = [];

    const block1 = [B().text("service_geraet", { geraet: d.geraet })];
    if (d.show.sla) {
      // Ist sla.preis 0, wird kein Betrag ausgegeben – der SLA steckt in
      // service.geraet und würde sonst doppelt wirken.
      block1.push(B().text("service_sla", { sla: d.slaKurz }));
    }
    block1.push(B().text("service_inklusiv", {
      volumen_color: FMT.intCh(num(ctx, "volumen.color")),
      volumen_sw: FMT.intCh(num(ctx, "volumen.sw")),
    }));
    zeilen.push([block1, [FMT.chf(num(ctx, "service.geraet"))]]);

    const klickT = [], klickB = [];
    if (d.show.color) {
      klickT.push(B().text("service_color", { ab_seite_color: d.abSeite.color }));
      klickB.push(FMT.rate(num(ctx, "preis.color")));
    }
    if (d.show.sw) {
      klickT.push(B().text("service_sw", { ab_seite_sw: d.abSeite.sw }));
      klickB.push(FMT.rate(num(ctx, "preis.sw")));
    }
    if (klickT.length) zeilen.push([klickT, klickB]);

    if (d.show.scan) {
      zeilen.push([[B().text("service_scan", { ab_scan: d.abSeite.scan })],
                   [FMT.rate(num(ctx, "preis.scan"))]]);
    }

    const fleetT = [], fleetB = [];
    if (d.show.fleet) {
      fleetT.push(B().text("service_fleet", { fleet: txt(ctx, "fleet.level") }));
      fleetB.push(num(ctx, "fleet.preis") > 0 ? FMT.chf(num(ctx, "fleet.preis")) : "");
    }
    if (d.show.zaehlerversand) {
      fleetT.push(B().text("service_zaehlerversand", { zaehlerversand: txt(ctx, "zaehlerversand") }));
      fleetB.push("");
    }
    if (fleetT.length) zeilen.push([fleetT, fleetB.some(Boolean) ? fleetB : [""]]);

    return zeilen;
  }

  /** Summenzeilen eines Standorts (Abschnitt 5.4). */
  function totalZeilen(ctx, d) {
    if (d.variante === "KAUF") {
      return [[B().text("total_kauf"), FMT.chf(num(ctx, "vertragswert"))]];
    }
    const label = B().text("total_pauschale", {
      summenlabel: txt(ctx, "summenlabel"),
      laufzeit: FMT.intCh(num(ctx, "laufzeit")),
    });
    return [
      [label, FMT.chf(num(ctx, "pauschale_ohne_service"))],
      [B().text("total_monatspauschale"), FMT.chf(num(ctx, "monatspauschale_total"))],
    ];
  }

  function gesamtZeilen(g, variante) {
    const zeilen = [];
    if (g.einmalig > 0) zeilen.push([B().text("gesamt_einmalig"), FMT.chf(g.einmalig)]);
    zeilen.push(variante === "KAUF"
      ? [B().text("gesamt_kauf"), FMT.chf(g.kauf)]
      : [B().text("gesamt_monatlich"), FMT.chf(g.monatlich)]);
    return zeilen;
  }

  /** Überschrift und Absätze des Vertragstexts (Abschnitt 8.3). */
  function vertragstext(ctx, d) {
    if (d.variante === "KAUF") {
      return [B().text("vertrag_kauf_titel"), B().absaetze("vertrag_kauf")];
    }
    const beginn = ctx.values.vertragsbeginn;
    const phrase = beginn
      ? B().text("vertrag_beginn_datum", { vertragsbeginn: FMT.dateDe(beginn) })
      : B().text("vertrag_beginn_offen");
    return [
      B().text("vertrag_miete_titel", { vertragsart: d.vertragsartWort }),
      B().absaetze("vertrag_miete", {
        vertragsart: d.vertragsartWort,
        beginn: phrase,
        laufzeit: FMT.intCh(num(ctx, "laufzeit")),
      }),
    ];
  }

  const PAUSCHALE_BAUSTEIN = {
    MIETE: "pauschale_wort_miete",
    LEASING: "pauschale_wort_leasing",
    KAUF: "pauschale_wort_kauf",
  };

  function konditionenAbrechnung(ctx) {
    const zeilen = [
      B().text("kondition_pauschale", { fakt_pauschale: txt(ctx, "fakt.pauschale") }),
      B().text("kondition_mehrseiten", { fakt_mehrseiten: txt(ctx, "fakt.mehrseiten") }),
    ];
    if (txt(ctx, "fakt.gebuehren")) {
      zeilen.push(B().text("kondition_gebuehren", { fakt_gebuehren: txt(ctx, "fakt.gebuehren") }));
    }
    return zeilen;
  }

  function konditionenRechnung(ctx, d) {
    return [
      B().text("rechnung_einmalig"),
      B().text("rechnung_pauschale", {
        pauschale_wort: B().text(PAUSCHALE_BAUSTEIN[d.variante]),
        fakt_pauschale: FMT.klein(txt(ctx, "fakt.pauschale")),
      }),
      B().text("rechnung_seitenpreise", {
        fakt_mehrseiten: FMT.klein(txt(ctx, "fakt.mehrseiten")),
      }),
    ];
  }

  /** Fehlt ein Teil, entfällt das Segment samt Trennzeichen (Abschnitt 8.5). */
  function nachweis(standorte) {
    const einmalig = (f) => [...new Set(standorte.map(f).filter(Boolean))];
    const versionen = einmalig((s) => DERIVE.text(s.ctx, "kalktool.version"));
    const chancen = einmalig((s) => DERIVE.text(s.ctx, "verkaufschance"));
    const art = DERIVE.text(standorte[0].ctx, "anlieferungsart");

    const teile = [];
    if (versionen.length) {
      teile.push(B().text("nachweis_kalktool", { kalktool_version: versionen.join(", ") }));
    }
    if (chancen.length) {
      teile.push(B().text("nachweis_verkaufschance", { verkaufschance: chancen.join(", ") }));
    }
    if (art) teile.push(B().text("nachweis_anlieferung", { anlieferungsart: art }));
    return teile.join(B().text("nachweis_trenner"));
  }

  const gueltigkeit = (d) => B().text("gueltigkeit", { gueltig_bis: FMT.dateDe(d.gueltigBis) });
  const ortDatum = (ctx) => B().text("ort_datum", { datum: FMT.dateDe(ctx.values.datum) });
  const klassifizierung = () => B().text("klassifizierung");
  const hardwareKapitel = () => B().text("hardware_kapitel");
  const hardwareGruppe = () => B().text("hardware_gruppe");
  const dlTotalLabel = () => B().text("total_dienstleistung");

  return {
    headStandort, headDl, lineAdresse, serviceKopf, serviceZeilen, totalZeilen,
    gesamtZeilen, vertragstext, konditionenAbrechnung, konditionenRechnung,
    nachweis, gueltigkeit, ortDatum, klassifizierung, dlTotalLabel,
    hardwareKapitel, hardwareGruppe,
    kopfHardware, kopfDienstleistung, kopfService,
  };
})();
