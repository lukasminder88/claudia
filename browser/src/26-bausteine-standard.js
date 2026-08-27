/* Erzeugt von tools/browser_daten.py – nicht von Hand bearbeiten. */
/* Mitgelieferte Textbausteine (Abschnitt 8).
   Änderungen gehören in offerttool/resources/textbausteine.yaml. */
const BAUSTEINE_STANDARD = {
  "version": "1.0",
  "platzhalter": {
    "index": "Nummer des Standorts: 1, 2, 3 …",
    "name": "Name des Standorts, zum Beispiel Museum",
    "strasse": "Strasse des Standorts",
    "plz": "Postleitzahl des Standorts",
    "ort": "Ort des Standorts",
    "geraet": "Bezeichnung des Geräts, zum Beispiel bizhub C3351i",
    "sla": "Stufe des Service Level Agreements, zum Beispiel Premium",
    "volumen_sw": "Inkludierte Seiten schwarzweiss",
    "volumen_color": "Inkludierte Seiten in Farbe",
    "ab_seite_sw": "Erste zusätzlich verrechnete Seite schwarzweiss",
    "ab_seite_color": "Erste zusätzlich verrechnete Seite in Farbe",
    "ab_scan": "Erster zusätzlich verrechneter Scan",
    "fleet": "Stufe des Fleet Managements",
    "zaehlerversand": "Art der Zählerstandsmeldung",
    "laufzeit": "Laufzeit in Monaten, als Zahl",
    "summenlabel": "Bezeichnung der Pauschale aus dem Kalktool",
    "vertragsart": "Mietvertrag oder Leasingvertrag",
    "beginn": "Zeitpunkt des Vertragsbeginns, als Satzteil",
    "vertragsbeginn": "Datum des Vertragsbeginns, TT.MM.JJJJ",
    "gueltig_bis": "Letzter Tag der Gültigkeit, TT.MM.JJJJ",
    "datum": "Offertdatum, TT.MM.JJJJ",
    "pauschale_wort": "Miet-, Leasing- oder Servicepauschalen",
    "fakt_pauschale": "Abrechnungsrhythmus der Pauschalen, zum Beispiel Quartalsweise",
    "fakt_mehrseiten": "Abrechnungsrhythmus der Seitenpreise",
    "fakt_gebuehren": "Regelung zu den Gebühren",
    "kalktool_version": "Version des Kalktools",
    "verkaufschance": "Nummer der Verkaufschance",
    "anlieferungsart": "Art der Anlieferung"
  },
  "beispiele": {
    "index": "1",
    "name": "Museum",
    "strasse": "Schulstrasse 29 1.OG",
    "plz": "4127",
    "ort": "Birsfelden",
    "geraet": "bizhub C3351i",
    "sla": "Premium",
    "volumen_sw": "0",
    "volumen_color": "0",
    "ab_seite_sw": "1",
    "ab_seite_color": "1",
    "ab_scan": "1",
    "fleet": "6020 Fleet Service Level Progress",
    "zaehlerversand": "CS Remote Care Internet (https) Integration",
    "laufzeit": "60",
    "summenlabel": "Mietpauschale pro Monat (ohne Service)",
    "vertragsart": "Mietvertrag",
    "beginn": "am 01.08.2026",
    "vertragsbeginn": "01.08.2026",
    "gueltig_bis": "26.09.2026",
    "datum": "28.07.2026",
    "pauschale_wort": "Miet- und Servicepauschalen",
    "fakt_pauschale": "Quartalsweise",
    "fakt_mehrseiten": "Halbjährlich",
    "fakt_gebuehren": "Offen gem. Offerte",
    "kalktool_version": "Version: Q4 2025",
    "verkaufschance": "V-2026-04768",
    "anlieferungsart": "Normal"
  },
  "gruppen": {
    "deckblatt": "Deckblatt",
    "standort": "Überschriften je Standort",
    "tabellen": "Tabellenköpfe",
    "service": "Servicetabelle (Kapitel 1.2)",
    "total": "Summen (Kapitel 1.3)",
    "vertrag": "Vertragstext (Kapitel 1.4)",
    "konditionen": "Konditionen (Kapitel 2)",
    "hardware": "Gerätedatenblätter",
    "schluss": "Schluss und Nachweis"
  },
  "bausteine": {
    "klassifizierung": {
      "titel": "Klassifizierung",
      "hinweis": "Steht auf dem Deckblatt neben «Klassifizierung».",
      "gruppe": "deckblatt",
      "platzhalter": [],
      "text": "Vertraulich"
    },
    "gueltigkeit": {
      "titel": "Gültigkeit des Angebots",
      "hinweis": "Deckblatt, unterste Zeile. Das Datum ist das Offertdatum plus 60 Tage.",
      "gruppe": "deckblatt",
      "platzhalter": [
        "gueltig_bis"
      ],
      "text": "Dieses Angebot ist gültig bis {gueltig_bis}"
    },
    "ort_datum": {
      "titel": "Ort und Datum",
      "hinweis": "Im Kapitel «Verbindlichkeit», über «Graphax AG».",
      "gruppe": "schluss",
      "platzhalter": [
        "datum"
      ],
      "text": "Spreitenbach, {datum}"
    },
    "head_standort": {
      "titel": "Standortüberschrift",
      "hinweis": "Überschrift über der Geräteliste und über der Servicetabelle.",
      "gruppe": "standort",
      "platzhalter": [
        "index",
        "name"
      ],
      "text": "Standort {index}: {name}"
    },
    "head_standort_ohne_name": {
      "titel": "Standortüberschrift ohne Namen",
      "hinweis": "Wird verwendet, wenn im Kalktool kein Standortname steht (Warnung W309).",
      "gruppe": "standort",
      "platzhalter": [
        "index"
      ],
      "text": "Standort {index}"
    },
    "line_adresse": {
      "titel": "Installationsadresse",
      "hinweis": "Kleine Zeile direkt unter der Standortüberschrift. Steht bewusst nicht im Inhaltsverzeichnis.",
      "gruppe": "standort",
      "platzhalter": [
        "strasse",
        "plz",
        "ort"
      ],
      "text": "Installationsadresse: {strasse}, {plz} {ort}"
    },
    "head_dienstleistung": {
      "titel": "Überschrift Schulungen und Dienstleistungen",
      "hinweis": "Nur wenn einmalige Kosten anfallen. Erscheint auch im Inhaltsverzeichnis – kurz halten.",
      "gruppe": "standort",
      "platzhalter": [
        "index",
        "name"
      ],
      "text": "Im Angebot enthaltene Schulungen und Dienstleistungen – Standort {index}: {name}"
    },
    "head_dienstleistung_ohne_name": {
      "titel": "Überschrift Dienstleistungen ohne Standortnamen",
      "hinweis": "Wird verwendet, wenn im Kalktool kein Standortname steht.",
      "gruppe": "standort",
      "platzhalter": [
        "index"
      ],
      "text": "Im Angebot enthaltene Schulungen und Dienstleistungen – Standort {index}"
    },
    "hardware_kapitel": {
      "titel": "Kapitelüberschrift Hardware",
      "hinweis": "Überschrift des Kapitels mit den Gerätedatenblättern. Erscheint einmal, unabhängig von der Anzahl Geräte.",
      "gruppe": "hardware",
      "platzhalter": [],
      "text": "Hardware"
    },
    "hardware_gruppe": {
      "titel": "Zwischenüberschrift Geräteart",
      "hinweis": "Steht unter der Kapitelüberschrift, ebenfalls nur einmal.",
      "gruppe": "hardware",
      "platzhalter": [],
      "text": "Multifunktionsgeräte"
    },
    "tabelle_hardware_artnr": {
      "titel": "Geräteliste: Spalte Artikelnummer",
      "hinweis": "Die Spalte erscheint nur, wenn das Kalktool Artikelnummern führt.",
      "gruppe": "tabellen",
      "platzhalter": [],
      "text": "Artikel No."
    },
    "tabelle_hardware_bezeichnung": {
      "titel": "Geräteliste: Spalte Bezeichnung",
      "hinweis": "",
      "gruppe": "tabellen",
      "platzhalter": [],
      "text": "Bezeichnung"
    },
    "tabelle_hardware_stueck": {
      "titel": "Geräteliste: Spalte Stück",
      "hinweis": "",
      "gruppe": "tabellen",
      "platzhalter": [],
      "text": "Stück"
    },
    "tabelle_dienstleistung_leistung": {
      "titel": "Dienstleistungen: Spalte Leistung",
      "hinweis": "",
      "gruppe": "tabellen",
      "platzhalter": [],
      "text": "Leistung"
    },
    "tabelle_dienstleistung_betrag": {
      "titel": "Dienstleistungen: Spalte Betrag",
      "hinweis": "",
      "gruppe": "tabellen",
      "platzhalter": [],
      "text": "Betrag"
    },
    "tabelle_service_kopf": {
      "titel": "Servicetabelle: linke Kopfzelle",
      "hinweis": "",
      "gruppe": "tabellen",
      "platzhalter": [
        "geraet"
      ],
      "text": "Wartungs- und Klick-Kosten für {geraet}"
    },
    "tabelle_service_total": {
      "titel": "Servicetabelle: rechte Kopfzelle",
      "hinweis": "",
      "gruppe": "tabellen",
      "platzhalter": [],
      "text": "Total"
    },
    "service_geraet": {
      "titel": "Servicevertrag",
      "hinweis": "Erste Zeile der Servicetabelle, immer vorhanden.",
      "gruppe": "service",
      "platzhalter": [
        "geraet"
      ],
      "text": "Servicevertrag pro Monat und pro Gerät für {geraet}"
    },
    "service_sla": {
      "titel": "Service Level Agreement",
      "hinweis": "Nur wenn im Kalktool eine SLA-Stufe steht. Ohne Betrag, weil der SLA in der Servicepauschale steckt.",
      "gruppe": "service",
      "platzhalter": [
        "sla"
      ],
      "text": "Service Level Agreement: {sla}"
    },
    "service_inklusiv": {
      "titel": "Inkludierte Seiten",
      "hinweis": "Immer vorhanden, ohne Betrag.",
      "gruppe": "service",
      "platzhalter": [
        "volumen_color",
        "volumen_sw"
      ],
      "text": "Mit {volumen_color} Seiten in Farbe und {volumen_sw} Seiten schwarzweiss inkludiert"
    },
    "service_color": {
      "titel": "Mehrseiten Farbe",
      "hinweis": "Nur wenn ein Farbvolumen oder ein Farbklickpreis hinterlegt ist.",
      "gruppe": "service",
      "platzhalter": [
        "ab_seite_color"
      ],
      "text": "Zusätzliche Seiten ab der {ab_seite_color}. Seite in Farbe"
    },
    "service_sw": {
      "titel": "Mehrseiten schwarzweiss",
      "hinweis": "",
      "gruppe": "service",
      "platzhalter": [
        "ab_seite_sw"
      ],
      "text": "Zusätzliche Seiten ab der {ab_seite_sw}. Seite schwarzweiss"
    },
    "service_scan": {
      "titel": "Mehrscans",
      "hinweis": "Nur wenn ein Scanvolumen oder ein Scanpreis hinterlegt ist.",
      "gruppe": "service",
      "platzhalter": [
        "ab_scan"
      ],
      "text": "Zusätzliche Scans ab dem {ab_scan}. Scan"
    },
    "service_fleet": {
      "titel": "Zählerstanderfassung",
      "hinweis": "",
      "gruppe": "service",
      "platzhalter": [
        "fleet"
      ],
      "text": "Zählerstanderfassung und Fleet Management: {fleet}"
    },
    "service_zaehlerversand": {
      "titel": "Zählerstandsmeldung",
      "hinweis": "",
      "gruppe": "service",
      "platzhalter": [
        "zaehlerversand"
      ],
      "text": "Zählerstandsmeldung: {zaehlerversand}"
    },
    "total_kauf": {
      "titel": "Summe bei Kauf",
      "hinweis": "",
      "gruppe": "total",
      "platzhalter": [],
      "text": "Total Kauf"
    },
    "total_pauschale": {
      "titel": "Pauschale ohne Service",
      "hinweis": "Erste Summenzeile bei Miete und Leasing.",
      "gruppe": "total",
      "platzhalter": [
        "summenlabel",
        "laufzeit"
      ],
      "text": "{summenlabel} bei einer Laufzeit von {laufzeit} Monaten"
    },
    "total_monatspauschale": {
      "titel": "Monatspauschale total",
      "hinweis": "Zweite Summenzeile bei Miete und Leasing.",
      "gruppe": "total",
      "platzhalter": [],
      "text": "Monatspauschale total inkl. Service"
    },
    "total_dienstleistung": {
      "titel": "Summe der einmaligen Kosten",
      "hinweis": "Letzte Zeile der Dienstleistungstabelle.",
      "gruppe": "total",
      "platzhalter": [],
      "text": "Total einmalige Kosten"
    },
    "gesamt_einmalig": {
      "titel": "Gesamttotal einmalige Kosten",
      "hinweis": "Nur bei mehr als einem Standort.",
      "gruppe": "total",
      "platzhalter": [],
      "text": "Einmalige Kosten – alle Standorte"
    },
    "gesamt_monatlich": {
      "titel": "Gesamttotal monatlich",
      "hinweis": "Nur bei mehr als einem Standort, bei Miete und Leasing.",
      "gruppe": "total",
      "platzhalter": [],
      "text": "Monatspauschale total – alle Standorte"
    },
    "gesamt_kauf": {
      "titel": "Gesamttotal Kauf",
      "hinweis": "Nur bei mehr als einem Standort, bei Kauf.",
      "gruppe": "total",
      "platzhalter": [],
      "text": "Total Kauf – alle Standorte"
    },
    "vertrag_kauf_titel": {
      "titel": "Überschrift Vertragstext bei Kauf",
      "hinweis": "",
      "gruppe": "vertrag",
      "platzhalter": [],
      "text": "Laufzeit und Kündigungsfrist für Serviceverträge beim Kauf"
    },
    "vertrag_kauf": {
      "titel": "Vertragstext bei Kauf",
      "hinweis": "Jeder Eintrag wird ein eigener Absatz.",
      "gruppe": "vertrag",
      "platzhalter": [],
      "absaetze": [
        "Der Start und die Laufzeit des Servicevertrags werden gemäss einer separaten Vereinbarung festgelegt. Nach Ablauf der vereinbarten Laufzeit verlängert sich der Servicevertrag automatisch um jeweils ein Jahr. Eine Kündigung des Servicevertrags ist möglich, indem er mit einer Kündigungsfrist von drei Monaten zum Ende der Laufzeit gekündigt wird."
      ]
    },
    "vertrag_miete_titel": {
      "titel": "Überschrift Vertragstext bei Miete und Leasing",
      "hinweis": "",
      "gruppe": "vertrag",
      "platzhalter": [
        "vertragsart"
      ],
      "text": "Laufzeit und Kündigungsfrist {vertragsart} und Servicevertrag"
    },
    "vertrag_miete": {
      "titel": "Vertragstext bei Miete und Leasing",
      "hinweis": "Jeder Eintrag wird ein eigener Absatz.",
      "gruppe": "vertrag",
      "platzhalter": [
        "vertragsart",
        "beginn",
        "laufzeit"
      ],
      "absaetze": [
        "Der {vertragsart} tritt {beginn} in Kraft und läuft für eine bestimmte Laufzeit von {laufzeit} Monaten. Die Laufzeit des Servicevertrags ist an diese Laufzeit gekoppelt und endet gleichzeitig. Nach Ablauf verlängern sich beide Verträge automatisch um jeweils ein weiteres Jahr. Eine Beendigung ist möglich, indem sie jeweils zum Ende der Laufzeit unter Einhaltung einer Kündigungsfrist von drei Monaten gekündigt werden."
      ]
    },
    "vertrag_beginn_datum": {
      "titel": "Vertragsbeginn mit Datum",
      "hinweis": "Wird für {beginn} eingesetzt, wenn im Kalktool ein Datum steht.",
      "gruppe": "vertrag",
      "platzhalter": [
        "vertragsbeginn"
      ],
      "text": "am {vertragsbeginn}"
    },
    "vertrag_beginn_offen": {
      "titel": "Vertragsbeginn offen",
      "hinweis": "Wird für {beginn} eingesetzt, wenn kein Datum lesbar ist (Warnung W304).",
      "gruppe": "vertrag",
      "platzhalter": [],
      "text": "zum vereinbarten Zeitpunkt"
    },
    "kondition_pauschale": {
      "titel": "Abrechnungsintervall: Pauschalen",
      "hinweis": "",
      "gruppe": "konditionen",
      "platzhalter": [
        "fakt_pauschale"
      ],
      "text": "Servicepauschalen: {fakt_pauschale}, im Voraus."
    },
    "kondition_mehrseiten": {
      "titel": "Abrechnungsintervall: Seitenpreise",
      "hinweis": "",
      "gruppe": "konditionen",
      "platzhalter": [
        "fakt_mehrseiten"
      ],
      "text": "Mehrseitenpreise: {fakt_mehrseiten}, rückwirkend."
    },
    "kondition_gebuehren": {
      "titel": "Abrechnungsintervall: Gebühren",
      "hinweis": "Nur wenn im Kalktool eine Regelung zu den Gebühren steht.",
      "gruppe": "konditionen",
      "platzhalter": [
        "fakt_gebuehren"
      ],
      "text": "Gebühren: {fakt_gebuehren}."
    },
    "rechnung_einmalig": {
      "titel": "Rechnungsstellung: einmalige Kosten",
      "hinweis": "",
      "gruppe": "konditionen",
      "platzhalter": [],
      "text": "Die einmaligen Kosten werden nach der Installation in Rechnung gestellt."
    },
    "rechnung_pauschale": {
      "titel": "Rechnungsstellung: Pauschalen",
      "hinweis": "",
      "gruppe": "konditionen",
      "platzhalter": [
        "pauschale_wort",
        "fakt_pauschale"
      ],
      "text": "Die {pauschale_wort} werden {fakt_pauschale} im Voraus verrechnet."
    },
    "rechnung_seitenpreise": {
      "titel": "Rechnungsstellung: Seitenpreise",
      "hinweis": "",
      "gruppe": "konditionen",
      "platzhalter": [
        "fakt_mehrseiten"
      ],
      "text": "Die Seitenpreise für Schwarzweiss- und Farbdruck werden {fakt_mehrseiten} rückwirkend in Rechnung gestellt."
    },
    "pauschale_wort_miete": {
      "titel": "Bezeichnung der Pauschalen bei Miete",
      "hinweis": "Wird für {pauschale_wort} eingesetzt.",
      "gruppe": "konditionen",
      "platzhalter": [],
      "text": "Miet- und Servicepauschalen"
    },
    "pauschale_wort_leasing": {
      "titel": "Bezeichnung der Pauschalen bei Leasing",
      "hinweis": "",
      "gruppe": "konditionen",
      "platzhalter": [],
      "text": "Leasing- und Servicepauschalen"
    },
    "pauschale_wort_kauf": {
      "titel": "Bezeichnung der Pauschalen bei Kauf",
      "hinweis": "",
      "gruppe": "konditionen",
      "platzhalter": [],
      "text": "Servicepauschalen"
    },
    "nachweis_kalktool": {
      "titel": "Nachweis: Kalkulationsgrundlage",
      "hinweis": "Kleine Zeile ganz am Schluss. Fehlt ein Teil, entfällt er samt Trennzeichen.",
      "gruppe": "schluss",
      "platzhalter": [
        "kalktool_version"
      ],
      "text": "Kalkulationsgrundlage: Kalktool {kalktool_version}"
    },
    "nachweis_verkaufschance": {
      "titel": "Nachweis: Verkaufschance",
      "hinweis": "",
      "gruppe": "schluss",
      "platzhalter": [
        "verkaufschance"
      ],
      "text": "Verkaufschance {verkaufschance}"
    },
    "nachweis_anlieferung": {
      "titel": "Nachweis: Anlieferungsart",
      "hinweis": "",
      "gruppe": "schluss",
      "platzhalter": [
        "anlieferungsart"
      ],
      "text": "Anlieferungsart: {anlieferungsart}"
    },
    "nachweis_trenner": {
      "titel": "Nachweis: Trennzeichen",
      "hinweis": "Steht zwischen den Teilen der Nachweiszeile.",
      "gruppe": "schluss",
      "platzhalter": [],
      "text": " · "
    }
  }
};
