# Website · Minder Product Management

Statische Website zu `minder-productmanagement.ch`. Umgesetzt in reinem
HTML, CSS und JavaScript — ohne Framework, ohne Build-Schritt. Was in
diesem Verzeichnis liegt, ist genau das, was ausgeliefert wird.

Inhalt und Struktur folgen dem Briefing vom August 2026. Alle Seitentexte
sind wörtlich übernommen.

---

## Aufbau

```
website/
├── index.html                    Startseite
├── leistungen/index.html         Leistungsübersicht
├── schnellcheck/index.html       Produktseite 1
├── standortbestimmung/index.html Produktseite 2
├── pmaas-aufbau/index.html       Produktseite 3
├── mandat-interim/index.html     Produktseite 4 (Anker #mandat, #interim)
├── projektbegleitung/index.html  Produktseite 5
├── referenzen/index.html         Referenzen
├── ueber-mich/index.html         Über mich
├── kontakt/index.html            Kontakt mit Formular
├── impressum/index.html          Vorlage, Inhalt folgt vor dem Launch
├── datenschutz/index.html        Vorlage, Inhalt folgt vor dem Launch
├── robots.txt
├── sitemap.xml
└── assets/
    ├── css/style.css             gesamtes Design-System, nummeriert gegliedert
    ├── js/site.js                Navigation, Formular, Jahreszahl
    ├── fonts/*.woff2             Inter, lokal ausgeliefert
    └── img/logo-minder-*.png     Logo in schwarzer und weisser Fassung
```

Jede Seite liegt als `index.html` in einem eigenen Verzeichnis. Damit
ergeben sich die im Briefing vorgesehenen URLs ohne Dateiendung
(`/leistungen`, `/schnellcheck`, …) ohne serverseitige Umschreibregeln.

---

## Lokal ansehen

Die Seiten verweisen mit absoluten Pfaden auf `/assets/…`, deshalb braucht
es einen Webserver — ein Doppelklick auf `index.html` genügt nicht.

```bash
cd website
python3 -m http.server 8000
# danach http://localhost:8000 im Browser öffnen
```

---

## Veröffentlichen

Den gesamten Inhalt von `website/` in das Wurzelverzeichnis der Domain
kopieren (FTP, rsync, Git-Deploy). Es ist kein Node, kein PHP und keine
Datenbank nötig. Empfohlene Servereinstellungen:

- HTTPS erzwingen, `www` auf die Hauptdomain umleiten
- `.woff2` und Bilder mit langer Cache-Dauer ausliefern, HTML ohne Cache
- 404 auf die Startseite oder eine eigene Fehlerseite leiten

---

## Kontaktformular

`assets/js/site.js` prüft die Eingaben und versendet auf zwei Wegen:

1. **Endpoint** — ist in `FORM_ENDPOINT` (oben in der Datei) eine URL
   hinterlegt, wird das Formular als JSON dorthin geschickt. Geeignet sind
   Dienste wie Formspree oder Netlify Forms ebenso wie ein eigener Handler.
2. **E-Mail** — solange kein Endpoint hinterlegt ist oder dieser nicht
   antwortet, öffnet sich eine vorausgefüllte E-Mail an
   `lukas@minder-productmanagement.ch`.

Zum Umschalten genügt eine Zeile:

```js
var FORM_ENDPOINT = "https://formspree.io/f/xxxxxxxx";
```

Am Markup ändert sich dabei nichts. Ein verstecktes Honeypot-Feld fängt
einfache Bots ab.

---

## Gestaltung

Die Design-Token stehen gesammelt am Anfang von `assets/css/style.css`.
Eine Änderung dort wirkt auf die ganze Website.

- **Farbe** — monochrom. Anthrazit `#111` als Text- und zugleich
  Akzentfarbe, Weiss und ein leicht wärmliches Off-White `#f7f6f4` als
  Flächen. Interaktive Elemente unterscheiden sich über Gewicht, Linie und
  Fläche, nicht über Farbe.
- **Schrift** — Inter in zwei Schnitten (Regular 400, Semibold 600),
  Kursiv ausschliesslich für die Kurzzeile der Blöcke. Die Schriftdateien
  werden lokal ausgeliefert; beim Seitenaufruf entsteht keine Verbindung
  zu Dritten.
- **Raster** — Mobile-first. Alle Karten stapeln unterhalb von 40em
  einspaltig. Karten einer Reihe sind gleich hoch, der Link sitzt bündig
  am unteren Rand.
- **Bewegung** — kurze Übergänge; `prefers-reduced-motion` wird
  respektiert.

## Barrierefreiheit

Semantisches HTML, ein Sprunglink als erste Tab-Station, `aria-current` in
der Navigation, `aria-expanded` an der Menütaste, sichtbare Fokusringe,
Formularfehler auf Deutsch mit `role="alert"`. Alle Textfarben erfüllen
WCAG AA (kleinster Wert 4.68:1), Rahmen bedienbarer Elemente 3.18:1.

---

## Vor dem Launch zu ersetzen

Alle offenen Stellen sind im Quelltext mit `<!-- Platzhalter -->`
kommentiert und auf der Seite sichtbar gerahmt, damit sie nicht
versehentlich online gehen.

1. `ueber-mich/` — Abschnitt «Persönlich»: 2–3 Sätze einsetzen.
2. `kontakt/` — Telefonnummer und Ort einsetzen oder die beiden Zeilen
   entfernen.
3. `referenzen/` — je Fall optional eine konkrete Kennzahl. Ohne Kennzahl
   den Platzhalter ersatzlos löschen; keine Zahl erfinden.
4. `impressum/` und `datenschutz/` — Inhalte einfügen (revDSG-konform).
5. `assets/js/site.js` — `FORM_ENDPOINT` setzen, falls das Formular über
   einen Dienst laufen soll.
6. `sitemap.xml` — `lastmod` beim Launch aktualisieren.
