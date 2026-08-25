<?php
/**
 * Minder Product Management — Formular-Handler
 * ---------------------------------------------------------------------------
 * Nimmt das Kontaktformular entgegen und stellt die Anfrage per E-Mail zu.
 * Laeuft auf dem eigenen Hosting; es ist kein Formulardienst eines
 * Drittanbieters beteiligt und es werden keine Daten gespeichert.
 *
 * Gegenstueck ist assets/js/site.js. Dort muss stehen:
 *     var FORM_ENDPOINT = "/api/kontakt.php";
 *
 * Antwortet immer mit JSON:
 *     200 {"ok":true}                — angenommen und versandt
 *     4xx {"ok":false,"fehler":"…"}  — Eingabe unbrauchbar
 *     500 {"ok":false,"fehler":"…"}  — Versand fehlgeschlagen
 * Das Skript im Browser weicht bei jedem Fehlschlag auf den E-Mail-Weg aus,
 * eine Anfrage geht also auch dann nicht verloren.
 */

declare(strict_types=1);

// ===========================================================================
// EINSTELLUNGEN
// ===========================================================================

/** Wohin die Anfragen gehen. */
const EMPFAENGER = 'lukas@minder-productmanagement.ch';

/**
 * Absenderadresse. Muss ein echtes Postfach der eigenen Domain sein, sonst
 * stufen viele Empfaenger die Nachricht wegen SPF/DMARC als Faelschung ein.
 * Niemals die Adresse des Besuchers verwenden — die steht im Reply-To.
 */
const ABSENDER = 'website@minder-productmanagement.ch';

/** Kuerzester Abstand zwischen zwei Anfragen derselben Gegenstelle, in Sekunden. */
const SPERRFRIST = 20;

/** Laengengrenzen je Feld. */
const GRENZEN = [
    'name'      => 120,
    'firma'     => 120,
    'email'     => 190,
    'telefon'   => 60,
    'situation' => 4000,
];


// ===========================================================================
// HILFSFUNKTIONEN
// ===========================================================================

/** Beendet die Verarbeitung mit einer JSON-Antwort. */
function antwort(int $status, array $nutzlast): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($nutzlast, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Entfernt Zeilenumbrueche und Steuerzeichen. Pflicht fuer alles, was in
 * einer Kopfzeile landet: sonst liesse sich die Nachricht um zusaetzliche
 * Empfaenger erweitern (Header Injection).
 */
function einzeilig(string $wert): string
{
    return trim(preg_replace('/[\r\n\t\x00-\x1F\x7F]+/u', ' ', $wert) ?? '');
}

/** Entfernt nur Steuerzeichen, laesst Zeilenumbrueche stehen (Fliesstext). */
function mehrzeilig(string $wert): string
{
    $wert = str_replace(["\r\n", "\r"], "\n", $wert);
    return trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', '', $wert) ?? '');
}


// ===========================================================================
// 1  ANFRAGE PRUEFEN
// ===========================================================================

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    antwort(405, ['ok' => false, 'fehler' => 'Nur POST wird entgegengenommen.']);
}

$roh = file_get_contents('php://input');
if ($roh === false || strlen($roh) > 20000) {
    antwort(413, ['ok' => false, 'fehler' => 'Die Anfrage ist zu gross.']);
}

$daten = json_decode($roh, true);
if (!is_array($daten)) {
    // Rueckfall fuer einen Versand als klassisches Formular
    $daten = $_POST;
}
if (!is_array($daten) || $daten === []) {
    antwort(400, ['ok' => false, 'fehler' => 'Keine Formulardaten empfangen.']);
}


// ===========================================================================
// 2  BOTS UND FLUTUNG ABWEHREN
// ===========================================================================

// Honeypot: das Feld ist im Formular unsichtbar. Ist es gefuellt, war es
// kein Mensch. Nach aussen sieht das wie ein Erfolg aus, damit der Bot
// nicht erkennt, woran er gescheitert ist.
if (einzeilig((string) ($daten['website'] ?? '')) !== '') {
    antwort(200, ['ok' => true]);
}

// Sperrfrist: begrenzt, wie oft dieselbe Gegenstelle tatsaechlich eine
// Nachricht ausloesen kann. Der Merker wird erst nach erfolgreichem Versand
// gesetzt (siehe unten) — sonst wuerde eine vertippte E-Mail-Adresse den
// Absender fuer zwanzig Sekunden aussperren, statt ihn zu korrigieren.
$gegenstelle = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unbekannt');
$merker = sys_get_temp_dir() . '/mpm-kontakt-' . sha1($gegenstelle);
if (is_file($merker) && (time() - (int) filemtime($merker)) < SPERRFRIST) {
    antwort(429, ['ok' => false, 'fehler' => 'Bitte einen Moment warten und erneut senden.']);
}


// ===========================================================================
// 3  FELDER PRUEFEN
// ===========================================================================

$feld = static function (string $name) use ($daten): string {
    $wert = (string) ($daten[$name] ?? '');
    return $name === 'situation' ? mehrzeilig($wert) : einzeilig($wert);
};

$name      = $feld('name');
$firma     = $feld('firma');
$email     = $feld('email');
$telefon   = $feld('telefon');
$situation = $feld('situation');

$fehlend = [];
if ($name === '')  { $fehlend[] = 'Name'; }
if ($firma === '') { $fehlend[] = 'Firma'; }
if ($email === '') { $fehlend[] = 'E-Mail'; }
if ($fehlend !== []) {
    antwort(422, ['ok' => false, 'fehler' => 'Pflichtfeld fehlt: ' . implode(', ', $fehlend) . '.']);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    antwort(422, ['ok' => false, 'fehler' => 'Die E-Mail-Adresse ist nicht gültig.']);
}

foreach (GRENZEN as $schluessel => $grenze) {
    if (mb_strlen(${$schluessel}) > $grenze) {
        antwort(422, ['ok' => false, 'fehler' => 'Eine Eingabe ist zu lang.']);
    }
}


// ===========================================================================
// 4  NACHRICHT ZUSAMMENSTELLEN UND VERSENDEN
// ===========================================================================

$betreff = 'Schnellcheck-Anfrage — ' . $firma;

$text = implode("\n", [
    'Neue Anfrage über das Kontaktformular',
    'minder-productmanagement.ch',
    '',
    'Name:      ' . $name,
    'Firma:     ' . $firma,
    'E-Mail:    ' . $email,
    'Telefon:   ' . ($telefon !== '' ? $telefon : '—'),
    '',
    'Situation:',
    $situation !== '' ? $situation : '—',
    '',
    str_repeat('-', 60),
    'Eingegangen: ' . date('d.m.Y H:i') . ' Uhr',
]);

// Betreff und Absendername werden nach RFC 2047 kodiert, damit Umlaute
// in jedem Mailprogramm richtig ankommen.
$kopfzeilen = [
    'From: ' . mb_encode_mimeheader('Website Minder Product Management', 'UTF-8')
             . ' <' . ABSENDER . '>',
    'Reply-To: ' . mb_encode_mimeheader($name, 'UTF-8') . ' <' . $email . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-Mailer: minder-productmanagement.ch',
];

$versandt = mail(
    EMPFAENGER,
    mb_encode_mimeheader($betreff, 'UTF-8'),
    $text,
    implode("\r\n", $kopfzeilen),
    '-f' . ABSENDER
);

if (!$versandt) {
    antwort(500, ['ok' => false, 'fehler' => 'Die Nachricht konnte nicht zugestellt werden.']);
}

// Erst jetzt die Sperrfrist starten
@touch($merker);

antwort(200, ['ok' => true]);
