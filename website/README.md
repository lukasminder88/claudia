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
├── 404.html                      Fehlerseite
├── .htaccess                     Apache: HTTPS, Caching, Sicherheitskopfzeilen
├── api/kontakt.php               Formular-Handler (versendet die Anfrage)
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

## Veröffentlichen auf Hostpoint

Es braucht kein Node, keine Datenbank und keinen Build-Schritt. Die Dateien
werden hochgeladen, fertig. PHP wird nur für das Kontaktformular benötigt.

### 1 · Website im Control Panel anlegen

Control Panel → **Websites** → Website für `minder-productmanagement.ch`
erstellen. Hostpoint legt dabei automatisch das passende Verzeichnis an.
Der Pfad steht danach in der Spalte **Document-Root** und lautet in der
Regel:

```
/home/<benutzername>/www/minder-productmanagement.ch/
```

### 2 · Dateien hochladen

Der **gesamte Inhalt** von `website/` kommt in dieses Verzeichnis — der
Ordner `website` selbst nicht. Im Document-Root muss also `index.html`
direkt liegen, daneben `assets/`, `api/`, `.htaccess` und die
Seitenverzeichnisse.

Per SFTP (FileZilla, Cyberduck, Transmit) — Zugangsdaten stehen im Control
Panel unter «Zusatzeinstellungen» → «FTP»:

| Feld     | Wert                          |
|----------|-------------------------------|
| Protokoll| SFTP                          |
| Server   | `ftp.<ihre-domain>.ch`        |
| Port     | 22                            |
| Benutzer | Hostpoint-Benutzername        |

SSH ist bei allen Hostpoint-Produkten enthalten. Damit geht es schneller
und wiederholbar — der Befehl lädt nur geänderte Dateien hoch:

```bash
rsync -avz --delete \
  website/ \
  <benutzer>@<benutzer>.hostpoint.ch:/home/<benutzer>/www/minder-productmanagement.ch/
```

Der abschliessende Schrägstrich hinter `website/` ist wichtig: ohne ihn
landet der Ordner selbst auf dem Server statt sein Inhalt. `--delete`
entfernt auf dem Server, was lokal nicht mehr existiert — beim ersten Mal
besser weglassen und mit `--dry-run` prüfen.

### 3 · Verschlüsselung einschalten

Control Panel → **Websites** → «SSL-Verschlüsselung» → **FreeSSL**
(Let's Encrypt, kostenlos, erneuert sich selbst). Meist ist das beim
Anlegen der Website bereits geschehen.

Die mitgelieferte `.htaccess` erzwingt danach HTTPS und leitet `www` auf
die Hauptadresse um. Sie muss dafür nichts konfigurieren.

### 4 · PHP für das Formular

Control Panel → **Websites** → «Web-Einstellungen» → PHP-Version auf eine
aktuelle Fassung (8.2 oder neuer) setzen. Der Handler nutzt nur
Bordmittel, keine Erweiterungen.

### 5 · E-Mail-Postfächer

Zwei Adressen anlegen:

- `lukas@minder-productmanagement.ch` — Ihr Postfach, dorthin gehen die Anfragen
- `website@minder-productmanagement.ch` — Absender des Formulars

Die zweite Adresse ist kein Schmuck: Versendet der Server im Namen einer
fremden Adresse, stufen Empfänger die Nachricht wegen SPF und DMARC oft
als Fälschung ein. Die Adresse des Anfragenden steht stattdessen im
Antwort-an-Feld, ein «Antworten» im Mailprogramm geht also direkt an ihn.

### 6 · Nach dem Hochladen prüfen

- `https://minder-productmanagement.ch` lädt, Schloss-Symbol sichtbar
- `http://` und `www.` leiten beide auf die kanonische Adresse um
- `/leistungen`, `/mandat-interim#mandat` und die übrigen Adressen greifen
- Eine Testanfrage über das Formular kommt an
- Eine erfundene Adresse wie `/gibtsnicht` zeigt die 404-Seite

Erscheint nach dem Hochladen ein Fehler 500, liegt es fast immer an einer
einzelnen Anweisung in `.htaccess`, die der Server nicht erlaubt. Die Datei
ist in nummerierte Abschnitte gegliedert — Abschnitt für Abschnitt
auskommentieren, bis die Ursache gefunden ist.

---

## Kontaktformular

Der Versand läuft über `api/kontakt.php` auf dem eigenen Hosting. Es ist
kein Formulardienst eines Drittanbieters beteiligt, und es wird nichts
gespeichert — die Anfrage wird entgegengenommen, als E-Mail zugestellt und
ist damit erledigt.

Der Handler prüft die Pflichtfelder, begrenzt die Feldlängen, entfernt
Zeilenumbrüche aus allem, was in einer Kopfzeile landet (sonst liessen sich
zusätzliche Empfänger einschleusen), wertet das versteckte Honeypot-Feld
aus und lässt pro Absender höchstens alle zwanzig Sekunden eine Nachricht
durch.

Empfänger und Absender stehen als Konstanten oben in der Datei:

```php
const EMPFAENGER = 'lukas@minder-productmanagement.ch';
const ABSENDER   = 'website@minder-productmanagement.ch';
```

**Fällt der Handler aus** — PHP abgeschaltet, Datei nicht hochgeladen,
Server gestört —, öffnet das Formular ersatzweise eine vorausgefüllte
E-Mail im Mailprogramm des Besuchers. Eine Anfrage geht in keinem Fall
verloren. Dieser Rückfallweg ist auch der Grund, weshalb sich die Seite
ohne PHP betreiben lässt: dann einfach `api/` weglassen.

Ein anderer Dienst (Formspree, Netlify Forms, eigener Endpoint) lässt sich
in einer Zeile in `assets/js/site.js` einsetzen:

```js
var FORM_ENDPOINT = "/api/kontakt.php";
```

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
5. Postfächer `lukas@` und `website@` anlegen (siehe «Veröffentlichen»),
   danach eine Testanfrage über das Formular senden.
6. `sitemap.xml` — `lastmod` beim Launch aktualisieren.
