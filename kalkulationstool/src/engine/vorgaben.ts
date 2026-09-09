/**
 * Vorgabewerte der leeren Vorlage.
 *
 * Quelle: spec/vorlage-defaults.json - die Werte, die im leeren Excel stehen.
 * Hier bewusst als Code, damit die Engine ohne Datei auskommt; die Tests
 * pruefen gegen die JSON-Fassung.
 */

import type {
  DienstleistungsPosition,
  Eingabe,
  HardwarePosition,
  SolutionsPosition,
  ZusatzPosition,
} from "./typen";

/** Kalkulation D27:D52 - Vorgabe der Kalkulationsart Hardware. */
export const KALKULATIONSART_HARDWARE = 0.6;
/** 'Detail Solutions' F21:F56 - Vorgabe der Kalkulationsart Software. */
export const KALKULATIONSART_SOFTWARE = 0.7;
/** Kalkulation G16 - Vorgabe des Faktors "Spezial Miete". */
export const FAKTOR_SPEZIAL_MIETE = 0.018914;

export function leereHardwarePosition(bezeichnung = ""): HardwarePosition {
  return { bezeichnung, listenpreis: 0, kalkulationsart: KALKULATIONSART_HARDWARE };
}

export function leereSolutionsPosition(bezeichnung = ""): SolutionsPosition {
  return {
    anzahl: 1,
    artikelNr: "",
    bezeichnung,
    listenpreisProArtikel: 0,
    kalkulationsart: KALKULATIONSART_SOFTWARE,
    nettoPreis: null,
    functionCode: "",
  };
}

export function leereDienstleistungsPosition(bezeichnung = ""): DienstleistungsPosition {
  return { stunden: 0, artikelNr: "", bezeichnung, preisProStunde: 0 };
}

export function leereZusatzPosition(bezeichnung = ""): ZusatzPosition {
  return { bezeichnung, verrechnet: 0, finanziert: 0 };
}

/** Eine leere Kalkulation - entspricht der frisch geoeffneten Vorlage. */
export function leereEingabe(): Eingabe {
  return {
    vertrag: {
      art: 2,
      laufzeitMonate: 48,
      kam: false,
      verlaengerungNew: false,
      faktLeasing: "Monatlich",
      faktorSpezialMiete: FAKTOR_SPEZIAL_MIETE,
      faktorSpezialLeasing: 0,
    },
    hardware: {
      positionen: [leereHardwarePosition()],
      positionenNachSupport: [],
      rabattsatz: 0,
      supportSatz: 0,
      supportPauschale: 0,
      supportKalkulationsart: KALKULATIONSART_HARDWARE,
    },
    solutions: {
      software: [],
      maintenance: [],
      dienstleistungen: [],
      softwareZusatz: [],
      maintenanceZusatz: [],
      dienstleistungenZusatz: [],
      maintenanceInServicepauschale: false,
      dienstleistungVerrechnet: 0,
    },
    altvertrag: {
      vertragNichtErfuellt: false,
      offeneMietraten: 0,
      mieteProMonat: 0,
      faktor: 1,
      aufrechnung: false,
    },
    zusatzpositionen: [],
    volumen: {
      swSeiten: 0,
      swPreis: 0,
      swMehrseitenpreis: 0,
      colorSeiten: 0,
      colorPreis: 0,
      colorMehrseitenpreis: 0,
      scanSeiten: 0,
      scanPreis: 0,
      mehrscanpreis: 0,
    },
    pauschalen: {
      sla: 0,
      grundpauschale: 0,
      wartungController: 0,
      wartungMuenzer: 0,
      bizhubSecure: 0,
      solutions: [0, 0, 0, 0, 0, 0],
    },
  };
}
