/* Editor für die Textbausteine.

   Jede Formulierung der Offerte lässt sich hier ändern, ohne eine Datei zu
   bearbeiten. Geprüft wird bei jedem Tastendruck: ein unzulässiger Platzhalter
   wird sofort gemeldet und nicht gespeichert. */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  if (!$("texte-liste")) return;

  const liste = $("texte-liste");
  const katalog = BAUSTEINE.katalog;

  const el = (tag, klasse, text) => {
    const n = document.createElement(tag);
    if (klasse) n.className = klasse;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  // --- Reiter ----------------------------------------------------------

  function zeige(welche) {
    const offerte = welche === "offerte";
    $("ansicht-offerte").classList.toggle("versteckt", !offerte);
    $("ansicht-texte").classList.toggle("versteckt", offerte);
    $("reiter-offerte").classList.toggle("aktiv", offerte);
    $("reiter-texte").classList.toggle("aktiv", !offerte);
    $("reiter-offerte").setAttribute("aria-selected", String(offerte));
    $("reiter-texte").setAttribute("aria-selected", String(!offerte));
  }
  $("reiter-offerte").onclick = () => zeige("offerte");
  $("reiter-texte").onclick = () => zeige("texte");

  // --- Aufbau ----------------------------------------------------------

  function zeichne() {
    liste.innerHTML = "";
    for (const [gruppe, titel] of Object.entries(katalog.gruppen)) {
      const eintraege = Object.entries(katalog.bausteine)
        .filter(([, b]) => b.gruppe === gruppe);
      if (!eintraege.length) continue;

      const box = el("details", "texte-gruppe");
      // Offen, damit sich ein gesuchter Text auch mit der Browsersuche finden
      // lässt und niemand erst Gruppen aufklappen muss.
      box.open = true;
      const kopf = el("summary");
      kopf.append(el("span", null, titel),
                  el("span", "anzahl", `${eintraege.length} Bausteine`));
      box.append(kopf);
      for (const [schluessel] of eintraege) box.append(baustein(schluessel));
      liste.append(box);
    }
    zaehlerAktualisieren();
  }

  function baustein(schluessel) {
    const spez = katalog.bausteine[schluessel];
    const box = el("div", "baustein");
    box.dataset.schluessel = schluessel;

    const kopf = el("div", "baustein-kopf");
    kopf.append(el("span", "baustein-titel", spez.titel));
    const ruecksetzen = el("button", "zuruecksetzen", "auf Original zurücksetzen");
    ruecksetzen.type = "button";
    ruecksetzen.hidden = !BAUSTEINE.geaendert(schluessel);
    kopf.append(ruecksetzen);
    box.append(kopf);

    if (spez.hinweis) box.append(el("p", "baustein-hinweis", spez.hinweis));

    const feld = el("textarea");
    feld.value = BAUSTEINE.rohtext(schluessel).join("\n\n");
    feld.rows = Math.min(8, Math.max(1, Math.ceil(feld.value.length / 78)));
    feld.setAttribute("aria-label", spez.titel);
    box.append(feld);

    const erlaubt = spez.platzhalter || [];
    if (erlaubt.length) {
      const chips = el("div", "chips");
      chips.append(el("span", "beschriftung", "Einfügen:"));
      for (const name of erlaubt) {
        const chip = el("button", "chip", "{" + name + "}");
        chip.type = "button";
        chip.title = katalog.platzhalter[name] || "";
        chip.onclick = () => einfuegen(feld, "{" + name + "}");
        chips.append(chip);
      }
      box.append(chips);
    }

    const fuss = el("div", "baustein-fuss");
    const vorschau = el("div", "vorschau");
    fuss.append(vorschau);
    box.append(fuss);

    const aktualisieren = () => {
      const absaetze = feld.value.split("\n\n");
      const fehler = BAUSTEINE.pruefeText(schluessel, absaetze);
      feld.classList.toggle("fehlerhaft", Boolean(fehler));
      vorschau.classList.toggle("fehler", Boolean(fehler));
      vorschau.innerHTML = "";

      if (fehler) {
        vorschau.append(el("span", null, fehler));
        return;
      }
      vorschau.append(el("span", null, "So sieht es aus: "));
      vorschau.append(el("strong", null, beispiel(absaetze)));

      const istStandard = absaetze.join("\n\n") === standardText(schluessel);
      BAUSTEINE.setzen(schluessel, istStandard ? null : absaetze);
      box.classList.toggle("geaendert", !istStandard);
      ruecksetzen.hidden = istStandard;
      zaehlerAktualisieren();
    };

    ruecksetzen.onclick = () => {
      feld.value = standardText(schluessel);
      aktualisieren();
      feld.focus();
    };

    feld.oninput = aktualisieren;
    aktualisieren();
    box.classList.toggle("geaendert", BAUSTEINE.geaendert(schluessel));
    return box;
  }

  function standardText(schluessel) {
    const spez = katalog.bausteine[schluessel];
    return (spez.absaetze ? spez.absaetze : [spez.text]).join("\n\n");
  }

  /** Vorschau mit Beispielwerten – die stehen nie in einer echten Offerte. */
  function beispiel(absaetze) {
    const werte = katalog.beispiele || {};
    const gefuellt = absaetze.map((a) =>
      a.replace(/(?<!\{)\{([a-z_][a-z0-9_]*)\}(?!\})/g, (_, n) => werte[n] ?? "…")
       .split("{{").join("{").split("}}").join("}")
    ).join(" ⏎ ");
    return gefuellt.length > 160 ? gefuellt.slice(0, 157) + "…" : gefuellt;
  }

  function einfuegen(feld, text) {
    const start = feld.selectionStart ?? feld.value.length;
    const ende = feld.selectionEnd ?? start;
    feld.value = feld.value.slice(0, start) + text + feld.value.slice(ende);
    feld.selectionStart = feld.selectionEnd = start + text.length;
    feld.focus();
    feld.dispatchEvent(new Event("input"));
  }

  function zaehlerAktualisieren() {
    const n = BAUSTEINE.anzahlGeaendert();
    const marke = $("texte-zaehler");
    marke.classList.toggle("versteckt", n === 0);
    marke.textContent = n === 1 ? "1 Baustein geändert" : `${n} Bausteine geändert`;
  }

  // --- Sichern, Laden, Zurücksetzen ------------------------------------

  $("texte-sichern").onclick = () => {
    const daten = BAUSTEINE.exportieren();
    if (!Object.keys(daten).length) {
      alert("Es ist noch kein Baustein geändert – es gibt nichts zu sichern.");
      return;
    }
    const blob = new Blob([JSON.stringify(daten, null, 2)],
                          { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Textbausteine.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  $("texte-laden").onclick = () => $("texte-datei").click();

  $("texte-datei").onchange = async () => {
    const datei = $("texte-datei").files[0];
    $("texte-datei").value = "";
    if (!datei) return;
    try {
      const anzahl = BAUSTEINE.importieren(JSON.parse(await datei.text()));
      zeichne();
      alert(anzahl === 1 ? "1 Baustein geladen." : `${anzahl} Bausteine geladen.`);
    } catch (e) {
      alert("Die Datei konnte nicht geladen werden.\n\n" + (e.detail || e.message));
    }
  };

  $("texte-alle-zuruecksetzen").onclick = () => {
    if (!BAUSTEINE.anzahlGeaendert()) return;
    if (!confirm("Alle eigenen Texte verwerfen und die mitgelieferten wiederherstellen?")) return;
    BAUSTEINE.zuruecksetzen();
    zeichne();
  };

  // --- Suche -----------------------------------------------------------

  const suche = $("texte-suche");
  if (suche) {
    suche.oninput = () => {
      const begriff = suche.value.trim().toLowerCase();
      for (const box of liste.querySelectorAll(".texte-gruppe")) {
        let sichtbar = 0;
        for (const b of box.querySelectorAll(".baustein")) {
          const spez = katalog.bausteine[b.dataset.schluessel];
          const heuhaufen = [
            spez.titel, spez.hinweis || "", b.dataset.schluessel,
            b.querySelector("textarea").value,
          ].join(" ").toLowerCase();
          const treffer = !begriff || heuhaufen.includes(begriff);
          b.classList.toggle("versteckt", !treffer);
          if (treffer) sichtbar++;
        }
        box.classList.toggle("versteckt", sichtbar === 0);
        if (begriff) box.open = true;
      }
    };
  }

  zeichne();
})();
