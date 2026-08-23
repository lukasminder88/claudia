/* Oberfläche der Browser-Fassung.

   Alles läuft lokal: kein Server, kein Netzwerkzugriff, keine Fremdbibliothek.
   Die Datei spricht nur mit PIPELINE und trifft keine Entscheidung über den
   Inhalt der Offerte. */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // Ohne diese beiden Schnittstellen lässt sich kein ZIP entpacken.
  if (typeof DecompressionStream === "undefined" || typeof CompressionStream === "undefined") {
    document.body.innerHTML =
      '<div class="nicht-unterstuetzt"><h2>Browser zu alt</h2>' +
      "<p>Diese Seite braucht <code>DecompressionStream</code>, um ein Kalktool zu lesen. " +
      "Unterstützt wird das ab Chrome&nbsp;103, Edge&nbsp;103, Firefox&nbsp;113 und " +
      "Safari&nbsp;16.4. Bitte einen aktuellen Browser verwenden.</p></div>";
    return;
  }

  // Die Oberfläche wird auch von der Prüfseite geladen, die diesen Rahmen
  // nicht mitbringt.
  if (!$("ablage")) return;

  const ablage = $("ablage");
  const dateiwahl = $("dateiwahl");
  const liste = $("liste");
  const ergebnis = $("ergebnis");
  const knopfPruefen = $("pruefen");
  const knopfErzeugen = $("erzeugen");

  const CRM_FELDER = {
    offertnummer: "offertnummer",
    offertversion: "offertversion",
    anrede: "kontakt.anrede",
    vorname: "kontakt.vorname",
    nachname: "kontakt.nachname",
    vk_funktion: "vk.funktion",
    vk_email: "vk.email",
    vk_telefon: "vk.telefon",
  };

  /** Gewählte Kalktools; die Reihenfolge ist die Reihenfolge der Standorte. */
  let dateien = [];
  let offeneUrls = [];

  // --- Auswahl ---------------------------------------------------------

  function hinzufuegen(neue) {
    for (const datei of neue) {
      if (!/\.(xlsx|xlsm)$/i.test(datei.name)) {
        zeigeMeldung(`${datei.name}: nur .xlsx und .xlsm werden gelesen.`);
        continue;
      }
      if (!dateien.some((d) => d.name === datei.name && d.size === datei.size)) {
        dateien.push(datei);
      }
    }
    zeichneListe();
  }

  function zeichneListe() {
    liste.innerHTML = "";
    dateien.forEach((datei, i) => {
      const li = document.createElement("li");
      const nr = el("span", "nummer", String(i + 1));
      const name = el("span", "dateiname", datei.name);
      name.title = datei.name;
      const groesse = el("span", "dateigroesse", (datei.size / 1024).toFixed(0) + " kB");
      li.append(nr, name, groesse,
        mini("↑", "Nach oben", i === 0, () => tausche(i, i - 1)),
        mini("↓", "Nach unten", i === dateien.length - 1, () => tausche(i, i + 1)),
        mini("×", "Entfernen", false, () => { dateien.splice(i, 1); zeichneListe(); }));
      liste.append(li);
    });
    $("reihenfolge-hinweis").classList.toggle("versteckt", dateien.length < 2);
    knopfPruefen.disabled = knopfErzeugen.disabled = dateien.length === 0;
  }

  function mini(zeichen, titel, deaktiviert, bei) {
    const b = document.createElement("button");
    b.className = "mini";
    b.type = "button";
    b.textContent = zeichen;
    b.title = titel;
    b.setAttribute("aria-label", titel);
    b.disabled = deaktiviert;
    b.onclick = bei;
    return b;
  }

  function tausche(a, b) {
    [dateien[a], dateien[b]] = [dateien[b], dateien[a]];
    zeichneListe();
  }

  ablage.onclick = () => dateiwahl.click();
  ablage.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dateiwahl.click(); }
  };
  dateiwahl.onchange = () => { hinzufuegen(dateiwahl.files); dateiwahl.value = ""; };

  for (const art of ["dragenter", "dragover"]) {
    ablage.addEventListener(art, (e) => { e.preventDefault(); ablage.classList.add("aktiv"); });
  }
  for (const art of ["dragleave", "drop"]) {
    ablage.addEventListener(art, (e) => { e.preventDefault(); ablage.classList.remove("aktiv"); });
  }
  ablage.addEventListener("drop", (e) => hinzufuegen(e.dataTransfer.files));

  // --- Auslösen --------------------------------------------------------

  function crmFelder() {
    const out = {};
    for (const [id, feld] of Object.entries(CRM_FELDER)) {
      const wert = $(id).value.trim();
      if (wert) out[feld] = wert;
    }
    return out;
  }

  function laden(knopf, text) {
    knopf.dataset.text = knopf.textContent;
    knopf.innerHTML = `<span class="lader"></span>${text}`;
    knopfPruefen.disabled = knopfErzeugen.disabled = true;
  }

  function fertig(knopf) {
    knopf.textContent = knopf.dataset.text;
    knopfPruefen.disabled = knopfErzeugen.disabled = dateien.length === 0;
  }

  knopfPruefen.onclick = async () => {
    laden(knopfPruefen, "Wird gelesen …");
    try {
      const { standorte, warn } = await PIPELINE.pruefen(dateien);
      zeigeVorschau(standorte, warn);
    } catch (e) {
      zeigeFehler(e);
    } finally {
      fertig(knopfPruefen);
    }
  };

  knopfErzeugen.onclick = async () => {
    laden(knopfErzeugen, "Wird erzeugt …");
    try {
      zeigeOfferte(await PIPELINE.erzeugen(dateien, crmFelder()));
    } catch (e) {
      zeigeFehler(e);
    } finally {
      fertig(knopfErzeugen);
    }
  };

  // --- Anzeige ---------------------------------------------------------

  function el(tag, klasse, text) {
    const n = document.createElement(tag);
    if (klasse) n.className = klasse;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function tabelle(paare) {
    const t = el("table", "werte");
    for (const [name, wert] of paare) {
      if (wert === null || wert === undefined || wert === "") continue;
      const tr = el("tr");
      tr.append(el("th", null, name), el("td", null, wert));
      t.append(tr);
    }
    return t;
  }

  function kopfKachel(standorte) {
    const { ctx, d } = standorte[0];
    const ort = ctx.values["kunde.plz_ort"] || {};
    const k = el("div", "kachel");
    const titel = el("h3");
    titel.append(el("span", "marke", d.variante), " " + DERIVE.text(ctx, "kunde.firma"));
    k.append(titel, tabelle([
      ["Ort", `${ort.plz || ""} ${ort.ort || ""}`.trim()],
      ["Verkäufer", DERIVE.text(ctx, "vk.name")],
      ["Verkaufschance", DERIVE.text(ctx, "verkaufschance")],
      ["Laufzeit", d.variante === "KAUF" ? null : FMT.monate(DERIVE.num(ctx, "laufzeit"))],
      ["Offertdatum", FMT.dateDe(ctx.values.datum)],
      ["Gültig bis", FMT.dateDe(d.gueltigBis)],
      ["Standorte", String(standorte.length)],
      ["Kalktool", DERIVE.text(ctx, "kalktool.version")],
    ]));
    return k;
  }

  function standortBlock({ ctx, d }, anzahl) {
    const det = el("details", "standort");
    if (ctx.index === 1) det.open = true;

    const betrag = d.variante === "KAUF"
      ? FMT.chf(DERIVE.num(ctx, "vertragswert"))
      : FMT.chf(DERIVE.num(ctx, "monatspauschale_total"));

    const summary = el("summary");
    summary.append(
      el("span", null, `Standort ${ctx.index}: ${DERIVE.text(ctx, "standort.name") || "ohne Namen"}`),
      el("span", "dateigroesse", betrag)
    );

    const inhalt = el("div", "inhalt");
    inhalt.append(tabelle([
      ["Quelle", ctx.quelle],
      ["Installationsadresse", TEXT.lineAdresse(ctx).replace("Installationsadresse: ", "")],
      ["Gerät", d.geraet],
      ["Positionen", (ctx.listen.hardware || []).map((p) => p.bezeichnung).join(", ")],
      ["Einmalige Kosten", FMT.chf(d.dienstleistungTotal)],
      [d.variante === "KAUF" ? "Total Kauf" : "Monatspauschale total", betrag],
    ]));

    const schalter = el("div", "schalterliste");
    for (const name of Object.keys(d.show).sort()) {
      schalter.append(el("span", d.show[name] ? "an" : null, name));
    }
    inhalt.append(schalter);

    det.append(summary, inhalt);
    return det;
  }

  function warnungsKachel(warn) {
    if (!warn.items.length) {
      const k = el("div", "kachel gut");
      k.append(el("h3", null, "Keine Warnungen"));
      return k;
    }
    const k = el("div", "kachel warn");
    k.append(el("h3", null, `${warn.items.length} Warnung${warn.items.length === 1 ? "" : "en"}`));
    const t = el("table", "werte");
    for (const w of warn.items) {
      const tr = el("tr");
      const th = el("th");
      th.append(el("code", null, w.code));
      if (w.standort) th.append(" · Standort " + w.standort);
      tr.append(th, el("td", null, w.bedeutung + (w.detail ? ` – ${w.detail}` : "")));
      t.append(tr);
    }
    k.append(t, el("p", "hinweis",
      "Warnungen stehen auch im Prüfprotokoll – nie im Dokument selbst."));
    return k;
  }

  function zeigeVorschau(standorte, warn) {
    ergebnis.innerHTML = "";
    ergebnis.append(
      el("p", "hinweis", "Gelesene Werte. Es wurde noch kein Dokument erzeugt."),
      kopfKachel(standorte),
      ...standorte.map((s) => standortBlock(s, standorte.length)),
      warnungsKachel(warn)
    );
  }

  function zeigeOfferte(fertig) {
    aufraeumen();
    ergebnis.innerHTML = "";

    const kachel = el("div", "kachel gut");
    kachel.append(el("h3", null, "Offerte erzeugt"));

    const download = el("div", "download");
    download.append(
      herunterladen(fertig.blob, fertig.dateiname, "Offerte herunterladen", false),
      herunterladen(new Blob([fertig.protokoll], { type: "text/markdown;charset=utf-8" }),
                    fertig.dateiname + ".pruefprotokoll.md", "Prüfprotokoll", true)
    );
    kachel.append(download);

    ergebnis.append(
      kachel,
      kopfKachel(fertig.standorte),
      ...fertig.standorte.map((s) => standortBlock(s, fertig.standorte.length)),
      warnungsKachel(fertig.warn)
    );
  }

  function herunterladen(blob, name, beschriftung, zweitrangig) {
    const url = URL.createObjectURL(blob);
    offeneUrls.push(url);
    const a = el("a", zweitrangig ? "zweitrangig" : null, beschriftung);
    a.href = url;
    a.download = name;
    return a;
  }

  function aufraeumen() {
    for (const url of offeneUrls) URL.revokeObjectURL(url);
    offeneUrls = [];
  }

  function zeigeFehler(e) {
    ergebnis.innerHTML = "";
    const k = el("div", "kachel fehler");
    if (e instanceof OfferteError) {
      k.append(el("h3", null, "Abbruch – es wurde keine Datei erzeugt"));
      const t = el("table", "werte");
      const tr = el("tr");
      const th = el("th");
      th.append(el("code", null, e.code));
      tr.append(th, el("td", null, e.bedeutung));
      t.append(tr);
      if (e.detail) {
        const tr2 = el("tr");
        tr2.append(el("th", null, "Detail"), el("td", null, e.detail));
        t.append(tr2);
      }
      k.append(t, el("p", "hinweis",
        "Der Generator bricht ab, statt eine halbe Offerte zu schreiben. " +
        "Bitte den genannten Wert im Kalktool prüfen."));
    } else {
      k.append(el("h3", null, "Fehlgeschlagen"), el("p", null, e.message || String(e)));
      console.error(e);
    }
    ergebnis.append(k);
  }

  function zeigeMeldung(text) {
    ergebnis.innerHTML = "";
    const k = el("div", "kachel warn");
    k.append(el("h3", null, "Hinweis"), el("p", null, text));
    ergebnis.append(k);
  }

  // --- Start -----------------------------------------------------------

  $("status").textContent = "Version 3.0.0 · Kalktool " + MAPPING.version;
  $("fuss-status").textContent =
    "Seitenzahlen im Inhaltsverzeichnis berechnet Word beim Öffnen.";
  zeichneListe();
})();
