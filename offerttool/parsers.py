"""Parser für Freitextfelder gemäss Spezifikation V3, Abschnitt 6.

Trifft kein Muster, greift der Fallback und es entsteht eine Warnung –
nie eine stille Zuweisung.
"""

from __future__ import annotations

import datetime as _dt
import re

from .errors import WarningCollector

RE_PLZ_ORT = re.compile(r"^\s*(?P<plz>\d{4})\s+(?P<ort>.+?)\s*$")
RE_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
RE_TELEFON = re.compile(r"(?:\+41|0)[\s\d]{8,}")
RE_DATUM = re.compile(r"(?P<d>\d{1,2})[.\-/](?P<m>\d{1,2})[.\-/](?P<y>\d{2,4})")


def parse_plz_ort(raw, warn: WarningCollector, feld: str = "") -> dict:
    """``"4127 Birsfelden"`` -> ``{"plz": "4127", "ort": "Birsfelden"}``.

    Fallback: ``plz`` leer, ``ort`` = ganzer String, Warnung ``W301``.
    """
    text = ("" if raw is None else str(raw)).strip()
    if not text:
        # Ein leeres Feld ist nicht unparsbar, sondern schlicht nicht gefüllt;
        # dafür meldet der Renderer bereits die entfallende Zeile.
        return {"plz": "", "ort": ""}
    m = RE_PLZ_ORT.match(text)
    if not m:
        warn.add("W301", f"{feld}={text!r}" if feld else repr(text))
        return {"plz": "", "ort": re.sub(r"\s+", " ", text)}
    return {"plz": m.group("plz"), "ort": re.sub(r"\s+", " ", m.group("ort"))}


def parse_kontakt(raw, warn: WarningCollector) -> dict:
    """Name, Mail und Telefon aus einem Freitextfeld trennen (Abschnitt 6.2)."""
    text = ("" if raw is None else str(raw))
    result = {"vorname": "", "nachname": "", "email": "", "telefon": ""}

    m_mail = RE_EMAIL.search(text)
    if m_mail:
        result["email"] = m_mail.group(0)
        text = text[: m_mail.start()] + "  " + text[m_mail.end() :]

    m_tel = RE_TELEFON.search(text)
    if m_tel:
        result["telefon"] = re.sub(r"\s+", " ", m_tel.group(0)).strip()
        text = text[: m_tel.start()] + "  " + text[m_tel.end() :]

    if not m_mail or not m_tel:
        warn.add("W302", f"email={'ja' if m_mail else 'nein'}, telefon={'ja' if m_tel else 'nein'}")

    # Manche Kalktools trennen mit Komma statt mit Leerzeichen; nach dem
    # Herauslösen von Mail und Telefon bliebe sonst "Istvan Scheibler, ,".
    rest = re.sub(r"[,;/|]+", " ", text)
    rest = re.sub(r"\s+", " ", rest).strip()
    if rest:
        teile = rest.split(" ")
        result["vorname"] = teile[0]
        result["nachname"] = " ".join(teile[1:])
        if len(teile) > 2:
            warn.add("W303", rest)
    return result


def parse_vertragsbeginn(raw, warn: WarningCollector):
    """``"Vertragsbeginn 01.08.2026"`` -> ``date(2026, 8, 1)``.

    Kein Treffer -> ``None`` und Warnung ``W304``.
    """
    if isinstance(raw, _dt.datetime):
        return raw.date()
    if isinstance(raw, _dt.date):
        return raw
    text = ("" if raw is None else str(raw))
    m = RE_DATUM.search(text)
    if not m:
        warn.add("W304", repr(text.strip()))
        return None
    jahr = int(m.group("y"))
    if jahr < 100:
        jahr += 2000
    try:
        return _dt.date(jahr, int(m.group("m")), int(m.group("d")))
    except ValueError:
        warn.add("W304", repr(text.strip()))
        return None


def sla_type_kurz(raw) -> str:
    """``"Premium - CHF 50.00"`` -> ``"Premium"`` (Abschnitt 8.2)."""
    text = re.sub(r"\s+", " ", str(raw or "")).strip()
    cut = text.split(" - CHF")[0]
    return cut.strip(" -")
