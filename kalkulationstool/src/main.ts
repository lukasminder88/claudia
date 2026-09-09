/**
 * Einstiegspunkt der Web-Maske.
 *
 * Die Berechnung laeuft vollstaendig im Browser ueber src/engine. Es gibt
 * keinen Server, keine Datenbank und keine Anmeldung - das ist der Umfang
 * dieses Machbarkeitsnachweises.
 */

import "./styles.css";

import { berechnen, leereEingabe, REGELWERK, type Eingabe } from "./engine";
import { SPRACHEN, t, type Sprache } from "./i18n";
import { el, knopf } from "./ui/bausteine";
import { beispielEingabe } from "./ui/beispiel";
import { ergebnisZeichnen } from "./ui/ergebnis";
import { maskeZeichnen } from "./ui/maske";

const SPEICHER_SCHLUESSEL = "kalkulationstool.zustand.v1";

interface Zustand {
  sprache: Sprache;
  eingabe: Eingabe;
}

function zustandLaden(): Zustand {
  try {
    const roh = localStorage.getItem(SPEICHER_SCHLUESSEL);
    if (roh !== null) {
      const gespeichert = JSON.parse(roh) as Zustand;
      if (gespeichert.eingabe && SPRACHEN.includes(gespeichert.sprache)) return gespeichert;
    }
  } catch {
    // Kein oder unlesbarer Speicher: mit einer leeren Kalkulation starten.
  }
  return { sprache: "de", eingabe: leereEingabe() };
}

function zustandSichern(zustand: Zustand): void {
  try {
    localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(zustand));
  } catch {
    // Speichern ist eine Bequemlichkeit, kein Teil der Rechnung.
  }
}

const zustand = zustandLaden();
const wurzel = document.querySelector<HTMLElement>("#app");
if (wurzel === null) throw new Error("Kein Element #app gefunden");

let ergebnisBereich: HTMLElement | null = null;

/**
 * Neu rechnen und nur den Ergebnisbereich ersetzen. Die Eingabefelder bleiben
 * im DOM - sonst verlaere das Feld bei jedem Tastendruck den Fokus.
 */
function aktualisieren(): void {
  zustandSichern(zustand);
  const neu = ergebnisZeichnen(
    berechnen(zustand.eingabe),
    zustand.sprache,
    zustand.eingabe.vertrag.art,
  );
  if (ergebnisBereich === null) return;
  ergebnisBereich.replaceWith(neu);
  ergebnisBereich = neu;
}

function kopfzeile(): HTMLElement {
  const sprachschalter = el("div", { klasse: "sprachschalter" });
  for (const sprache of SPRACHEN) {
    const feld = knopf(
      sprache.toUpperCase(),
      () => {
        zustand.sprache = sprache;
        neuZeichnen();
      },
      zustand.sprache === sprache ? "aktiv" : "",
    );
    feld.setAttribute("aria-pressed", String(zustand.sprache === sprache));
    sprachschalter.append(feld);
  }

  return el("header", { klasse: "kopf" }, [
    el("div", { klasse: "titel" }, [
      el("h1", { text: t(zustand.sprache, "app.titel") }),
      el("p", { text: t(zustand.sprache, "app.untertitel") }),
    ]),
    el("div", { klasse: "werkzeuge" }, [
      el("span", {
        klasse: "regelwerk",
        text: `${t(zustand.sprache, "app.regelwerk")}: ${REGELWERK.version}`,
      }),
      knopf(
        t(zustand.sprache, "app.beispielLaden"),
        () => {
          zustand.eingabe = beispielEingabe(zustand.sprache);
          neuZeichnen();
        },
        "sekundaer",
      ),
      knopf(
        t(zustand.sprache, "app.zuruecksetzen"),
        () => {
          zustand.eingabe = leereEingabe();
          neuZeichnen();
        },
        "sekundaer",
      ),
      sprachschalter,
    ]),
  ]);
}

/** Maske und Ergebnis komplett neu aufbauen. */
function neuZeichnen(): void {
  zustandSichern(zustand);
  ergebnisBereich = ergebnisZeichnen(
    berechnen(zustand.eingabe),
    zustand.sprache,
    zustand.eingabe.vertrag.art,
  );

  const inhalt = el("div", { klasse: "inhalt" }, [
    maskeZeichnen({
      sprache: zustand.sprache,
      eingabe: zustand.eingabe,
      aktualisieren,
      neuZeichnen,
    }),
    ergebnisBereich,
  ]);

  document.documentElement.lang = zustand.sprache;
  wurzel!.replaceChildren(kopfzeile(), inhalt);
}

neuZeichnen();
