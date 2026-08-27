/* Golden Record – Referenzfall Birsfelden (Abschnitt 14).
   Läuft im Browser, also in genau der Umgebung, für die die Fassung gebaut ist. */

(() => {
  "use strict";

  const ergebnisse = [];
  const gleich = (name, ist, soll) => {
    const ok = JSON.stringify(ist) === JSON.stringify(soll);
    ergebnisse.push({ name, ok, ist, soll });
  };
  const wahr = (name, wert) => ergebnisse.push({ name, ok: !!wert, ist: wert, soll: true });

  window.pruefeAlles = async (datei) => {
    ergebnisse.length = 0;

    // --- Formatter (Abschnitt 7) ---
    gleich("chf(2024.7475)", FMT.chf(2024.7475), "CHF 2’024.75");
    gleich("chf(1.005) half-up", FMT.chf(1.005), "CHF 1.01");
    gleich("chf(0.005) half-up", FMT.chf(0.005), "CHF 0.01");
    gleich("chf(47)", FMT.chf(47), "CHF 47.00");
    gleich("chf(1234567.891)", FMT.chf(1234567.891), "CHF 1’234’567.89");
    gleich("rate(0.032)", FMT.rate(0.032), "CHF 0.0320");
    gleich("rate(0.005)", FMT.rate(0.005), "CHF 0.0050");
    gleich("intCh(1500)", FMT.intCh(1500), "1’500");
    gleich("monate(60)", FMT.monate(60), "60 Monate");
    gleich("trim doppelte Leerzeichen", FMT.trim("Schulstrasse 29  1.OG"), "Schulstrasse 29 1.OG");
    gleich("klein", FMT.klein("Quartalsweise"), "quartalsweise");
    gleich("labelClean gesperrt",
      FMT.labelClean("Wegpauschale - I n t e g r a t i o n - Netzwerk - Fax - Scan - LDAP"),
      "Wegpauschale Integration Netzwerk Fax Scan LDAP");
    gleich("labelClean Transport", FMT.labelClean("T r a n s p o r t"), "Transport");

    // --- Parser (Abschnitt 6) ---
    const w0 = new Warnungen();
    gleich("plzOrt", PARSE.plzOrt("4127 Birsfelden", w0), { plz: "4127", ort: "Birsfelden" });
    gleich("kontakt", PARSE.kontakt("Tom Wiedmer   tom.wiedmer@birsfelden.ch    061 317 33 48", w0),
      { vorname: "Tom", nachname: "Wiedmer", email: "tom.wiedmer@birsfelden.ch", telefon: "061 317 33 48" });
    gleich("Parser ohne Warnung", w0.codes(), []);
    gleich("slaKurz", PARSE.slaKurz("Premium - CHF 50.00"), "Premium");
    const w1 = new Warnungen();
    PARSE.plzOrt("Birsfelden", w1);
    wahr("W301 bei unteilbarem Ort", w1.codes().includes("W301"));

    // --- Textbausteine (Abschnitt 8) ---
    gleich("Baustein mit Werten", BAUSTEINE.text("head_standort", { index: 1, name: "Museum" }),
      "Standort 1: Museum");
    gleich("Baustein ohne Platzhalter", BAUSTEINE.text("klassifizierung"), "Vertraulich");
    wahr("Bausteine vollständig", Object.keys(BAUSTEINE.katalog.bausteine).length > 40);

    wahr("unbekannter Platzhalter wird gemeldet",
      /gibt es nicht/.test(BAUSTEINE.pruefeText("head_standort", ["Standort {naem}"]) || ""));
    wahr("nicht vorgesehener Platzhalter wird gemeldet",
      /nicht vorgesehen/.test(BAUSTEINE.pruefeText("head_standort", ["Standort {geraet}"]) || ""));
    wahr("einzelne Klammer wird gemeldet",
      /Klammer/.test(BAUSTEINE.pruefeText("klassifizierung", ["Vertraulich {"]) || ""));
    gleich("gültiger Text ohne Beanstandung",
      BAUSTEINE.pruefeText("head_standort", ["Einsatzort {index} – {name}"]), null);

    BAUSTEINE.setzen("head_standort", ["Einsatzort {index} – {name}"]);
    gleich("eigener Text greift", BAUSTEINE.text("head_standort", { index: 2, name: "Werkhof" }),
      "Einsatzort 2 – Werkhof");
    wahr("als geändert vermerkt", BAUSTEINE.geaendert("head_standort"));
    gleich("Export enthält den Text", BAUSTEINE.exportieren()["head_standort"],
      "Einsatzort {index} – {name}");
    BAUSTEINE.setzen("head_standort", null);
    gleich("zurückgesetzt", BAUSTEINE.text("head_standort", { index: 1, name: "Museum" }),
      "Standort 1: Museum");
    wahr("nicht mehr als geändert vermerkt", !BAUSTEINE.geaendert("head_standort"));

    let abgewiesen = false;
    try { BAUSTEINE.importieren({ gibt_es_nicht: "x" }); } catch { abgewiesen = true; }
    wahr("unbekannter Schlüssel beim Laden abgewiesen", abgewiesen);
    BAUSTEINE.zuruecksetzen();

    // --- Sperrliste: statischer Vorlagentext ist kein Leck ---
    {
      // Die Konditionentabelle nennt 180 CHF pro Stunde. Steht 180 zufällig
      // auch in einer gesperrten Zelle, ist das kein Leck.
      const statisch = new Set(["180", "120", "130", "200"]);
      let abgebrochen = false;
      try { PIPELINE.pruefeAusgabe("Stundensatz 180.- CHF", new Set(["180"]), statisch); }
      catch { abgebrochen = true; }
      wahr("Stundensatz der Vorlage schlägt nicht an", !abgebrochen);

      let erkannt = false;
      try { PIPELINE.pruefeAusgabe("Irgendwo 2’645", new Set(["2’645"]), statisch); }
      catch (e) { erkannt = e.code === "E601"; }
      wahr("echter Sperrwert wird weiterhin erkannt", erkannt);
    }

    // --- Datenblätter (Zuordnung ohne Raten) ---
    gleich("Modellname normalisiert",
      DATENBLAETTER.normalisieren("bizhub C3351i de"), DATENBLAETTER.normalisieren("bizhub C3351i"));
    gleich("Sprachkürzel und Version fallen weg",
      DATENBLAETTER.normalisieren("brother MFC-L3750CDW de v2"), "brothermfcl3750cdw");

    {
      const w = new Warnungen();
      DATENBLAETTER.setzeEigene([]);
      const treffer = await DATENBLAETTER.finde("bizhub C3351i", w);
      wahr("ohne Quellen kein Treffer", treffer === null);
    }

    if (!datei) return zeige();

    // --- Referenzfall (Abschnitt 14) ---
    const { standorte, warn } = await PIPELINE.pruefen([datei]);
    const { ctx, d } = standorte[0];

    gleich("variante", d.variante, "MIETE");
    gleich("vertragsartWort", d.vertragsartWort, "Mietvertrag");
    gleich("laufzeit", DERIVE.num(ctx, "laufzeit"), 60);
    gleich("kunde.firma", DERIVE.text(ctx, "kunde.firma"), "Gemeindeverwaltung Birsfelden");
    gleich("kunde.plz_ort", ctx.values["kunde.plz_ort"], { plz: "4127", ort: "Birsfelden" });
    gleich("kontakt aus J5", ctx.values["kunde.kontakt"],
      { vorname: "Tom", nachname: "Wiedmer", email: "tom.wiedmer@birsfelden.ch", telefon: "061 317 33 48" });
    gleich("standort.name", DERIVE.text(ctx, "standort.name"), "Museum");
    gleich("HEAD.STANDORT", TEXT.headStandort(ctx), "Standort 1: Museum");
    gleich("LINE.STANDORT_ADRESSE", TEXT.lineAdresse(ctx),
      "Installationsadresse: Schulstrasse 29 1.OG, 4127 Birsfelden");
    gleich("datum", FMT.dateDe(ctx.values.datum), "28.07.2026");
    gleich("gueltig_bis", FMT.dateDe(d.gueltigBis), "26.09.2026");
    gleich("hardware", (ctx.listen.hardware || []).map((p) => p.bezeichnung),
      ["bizhub C3351i", "PF-P27", "DK-P04"]);
    gleich("hardware Stück", [...new Set((ctx.listen.hardware || []).map((p) => p.stueck))], ["1"]);
    gleich("hardware Art.-Nr.", [...new Set((ctx.listen.hardware || []).map((p) => p.artnr))], ["–"]);
    gleich("show.hardware_preise", d.show.hardware_preise, false);
    gleich("volumen.color", DERIVE.num(ctx, "volumen.color"), 0);
    gleich("show.color trotz Volumen 0", d.show.color, true);
    gleich("show.sw", d.show.sw, true);
    gleich("preis.color", FMT.rate(DERIVE.num(ctx, "preis.color")), "CHF 0.0320");
    gleich("preis.sw", FMT.rate(DERIVE.num(ctx, "preis.sw")), "CHF 0.0050");
    gleich("service.geraet", FMT.chf(DERIVE.num(ctx, "service.geraet")), "CHF 3.50");
    gleich("slaKurz", d.slaKurz, "Premium");
    gleich("sla.preis", DERIVE.num(ctx, "sla.preis"), 0);

    const dl = ctx.listen.dienstleistung || [];
    gleich("dienstleistung Beträge", dl.map((p) => p.betrag).sort((a, b) => a - b), [120, 180]);
    gleich("dienstleistung Total", FMT.chf(d.dienstleistungTotal), "CHF 300.00");
    wahr("Transport 200 nicht enthalten", !dl.some((p) => p.betrag === 200));
    wahr("Bereitstellung 115 nicht enthalten", !dl.some((p) => p.betrag === 115));

    gleich("TBL.TOTAL", TEXT.totalZeilen(ctx, d), [
      ["Mietpauschale pro Monat (ohne Service) bei einer Laufzeit von 60 Monaten", "CHF 43.50"],
      ["Monatspauschale total inkl. Service", "CHF 47.00"],
    ]);
    gleich("vertragsbeginn", FMT.dateDe(ctx.values.vertragsbeginn), "01.08.2026");
    gleich("fakt.pauschale", DERIVE.text(ctx, "fakt.pauschale"), "Quartalsweise");
    gleich("fakt.mehrseiten", DERIVE.text(ctx, "fakt.mehrseiten"), "Halbjährlich");
    wahr("W308 gemeldet", warn.codes().includes("W308"));
    wahr("W312 gemeldet", warn.codes().includes("W312"));

    const gesperrt = PIPELINE.gesperrteZeichenketten(standorte);
    for (const wert of ["2’645", "1’587", "2’024.75", "2’339.75"]) {
      wahr(`Sperrliste kennt ${wert}`, gesperrt.has(wert));
    }

    // --- Vollständige Erzeugung ---
    const fertig = await PIPELINE.erzeugen([datei], {
      offertnummer: "OF-2026-04768", offertversion: "1.0",
      "kontakt.anrede": "Herr", "kontakt.vorname": "Tom", "kontakt.nachname": "Wiedmer",
      "vk.funktion": "Account Manager", "vk.telefon": "+41 58 551 11 22",
      "vk.email": "thomas.steiner@graphax.ch",
    });
    wahr("Blob erzeugt", fertig.blob.size > 50000);
    // Ein .docx ist ein ZIP; ohne den richtigen MIME-Typ hängt der Browser
    // beim Herunterladen ".zip" an den Dateinamen an.
    gleich("MIME-Typ der Offerte", fertig.blob.type,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    wahr("Dateiname endet auf .docx", fertig.dateiname.endsWith(".docx"));
    gleich("Dateiname", fertig.dateiname, "Offerte_Gemeindeverwaltung_Birsfelden_V-2026-04768.docx");

    const dateien = await ZIP.lesen(await fertig.blob.arrayBuffer());
    const xml = ZIP.text(dateien, "word/document.xml");
    for (const muss of ["Gemeindeverwaltung Birsfelden", "Standort 1: Museum",
                        "Installationsadresse: Schulstrasse 29 1.OG, 4127 Birsfelden",
                        "bizhub C3351i", "CHF 0.0320", "CHF 0.0050", "CHF 3.50",
                        "CHF 43.50", "CHF 47.00", "CHF 300.00", "28.07.2026",
                        "26.09.2026", "01.08.2026", "OF-2026-04768",
                        "Account Manager", "Direkt +41 58 551 11 22"]) {
      wahr(`Dokument enthält: ${muss}`, xml.includes(muss));
    }
    for (const darfNicht of ["2’645", "1’587", "2’024.75", "2’339.75",
                             "bizhub C257i", "Standort A", "%%", "36 Monaten"]) {
      wahr(`Dokument ohne: ${darfNicht}`, !xml.includes(darfNicht));
    }
    wahr("updateFields gesetzt", ZIP.text(dateien, "word/settings.xml").includes('updateFields w:val="true"'));
    wahr("Prüfprotokoll erzeugt", fertig.protokoll.includes("MIETE"));

    return zeige();
  };

  function zeige() {
    const fehler = ergebnisse.filter((r) => !r.ok);
    const zeilen = ergebnisse.map((r) =>
      r.ok ? `<span class="ok">  ok</span>  ${r.name}`
           : `<span class="fehler">FEHL</span>  ${r.name}\n        ist:  ${JSON.stringify(r.ist)}\n        soll: ${JSON.stringify(r.soll)}`
    );
    zeilen.push("", fehler.length
      ? `<span class="fehler">${fehler.length} von ${ergebnisse.length} fehlgeschlagen</span>`
      : `<span class="ok">${ergebnisse.length} Prüfungen bestanden</span>`);
    document.getElementById("ausgabe").innerHTML = zeilen.join("\n");
    return { gesamt: ergebnisse.length, fehler: fehler.length,
             details: fehler.map((f) => ({ name: f.name, ist: f.ist, soll: f.soll })) };
  }

  const eingabe = document.getElementById("datei");
  if (eingabe) eingabe.onchange = () => window.pruefeAlles(eingabe.files[0]);
})();
