/**
 * Beispielkalkulation - entspricht dem Pro-Memoria-Beispiel im Blatt
 * "Miete Graphax" (bizhub C360i, Listenpreis 13'680, 5 % Rabatt, 48 Monate),
 * ergaenzt um Solutions und Pauschalen.
 */

import {
  leereEingabe,
  KALKULATIONSART_HARDWARE,
  KALKULATIONSART_SOFTWARE,
  type Eingabe,
} from "../engine";
import { t, type Sprache } from "../i18n";

export function beispielEingabe(sprache: Sprache): Eingabe {
  const eingabe = leereEingabe();
  eingabe.vertrag.laufzeitMonate = 48;
  eingabe.hardware.rabattsatz = 0.05;
  eingabe.hardware.positionen = [
    {
      bezeichnung: t(sprache, "beispiel.geraet"),
      listenpreis: 13680,
      kalkulationsart: KALKULATIONSART_HARDWARE,
    },
    {
      bezeichnung: t(sprache, "beispiel.finisher"),
      listenpreis: 4200,
      kalkulationsart: KALKULATIONSART_HARDWARE,
    },
  ];
  eingabe.solutions.software = [
    {
      anzahl: 1,
      artikelNr: "SW-DPX-BASE",
      bezeichnung: t(sprache, "beispiel.software"),
      listenpreisProArtikel: 4800,
      kalkulationsart: KALKULATIONSART_SOFTWARE,
      nettoPreis: null,
      functionCode: "MIETESOFT",
    },
    {
      anzahl: 25,
      artikelNr: "SW-DPX-CLIENT",
      bezeichnung: t(sprache, "beispiel.softwareClient"),
      listenpreisProArtikel: 120,
      kalkulationsart: KALKULATIONSART_SOFTWARE,
      nettoPreis: null,
      functionCode: "MIETESOFT",
    },
  ];
  eingabe.solutions.maintenance = [
    {
      anzahl: 1,
      artikelNr: "SWM-DPX",
      bezeichnung: t(sprache, "beispiel.maintenance"),
      listenpreisProArtikel: 950,
      kalkulationsart: KALKULATIONSART_SOFTWARE,
      nettoPreis: null,
      functionCode: "MIETESWM",
    },
  ];
  eingabe.solutions.dienstleistungen = [
    { stunden: 16, artikelNr: "IMPLTRAI", bezeichnung: t(sprache, "beispiel.implementation"), preisProStunde: 185 },
    { stunden: 8, artikelNr: "IMPLTRAI", bezeichnung: t(sprache, "beispiel.schulung"), preisProStunde: 210 },
  ];
  eingabe.zusatzpositionen = [
    { bezeichnung: t(sprache, "beispiel.transport"), verrechnet: 0, finanziert: 450 },
    { bezeichnung: t(sprache, "beispiel.netzwerk"), verrechnet: 320, finanziert: 780 },
  ];
  eingabe.volumen.swSeiten = 3000;
  eingabe.volumen.swPreis = 0.011;
  eingabe.volumen.swMehrseitenpreis = 0.013;
  eingabe.volumen.colorSeiten = 1200;
  eingabe.volumen.colorPreis = 0.072;
  eingabe.volumen.colorMehrseitenpreis = 0.079;
  eingabe.pauschalen.sla = 50;
  eingabe.pauschalen.grundpauschale = 55;
  eingabe.pauschalen.solutions = [35, 0, 0, 0, 0, 0];
  return eingabe;
}
