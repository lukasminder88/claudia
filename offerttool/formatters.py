"""Formatter gemäss Spezifikation V3, Abschnitt 7.

Verbindlich inklusive Trennzeichen.  Tausendertrenner ist das typografische
Apostroph U+2019.  Gerundet wird kaufmännisch (half-up) und **erst bei der
Ausgabe** – Zwischensummen rechnen mit dem vollen Wert.
"""

from __future__ import annotations

import datetime as _dt
import re
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

APOSTROPH = "’"
NBSP = " "


def _to_decimal(value) -> Decimal:
    if value is None or value == "":
        return Decimal(0)
    if isinstance(value, Decimal):
        return value
    if isinstance(value, bool):
        return Decimal(int(value))
    if isinstance(value, (int, float)):
        return Decimal(repr(value))
    text = str(value).strip().replace(APOSTROPH, "").replace("'", "").replace(NBSP, "")
    text = text.replace("CHF", "").strip()
    try:
        return Decimal(text)
    except InvalidOperation:
        return Decimal(0)


def _group(digits: str) -> str:
    out = []
    while len(digits) > 3:
        out.insert(0, digits[-3:])
        digits = digits[:-3]
    out.insert(0, digits)
    return APOSTROPH.join(out)


def _fixed(value, places: int, grouping: bool) -> str:
    dec = _to_decimal(value)
    quant = Decimal(1).scaleb(-places) if places else Decimal(1)
    dec = dec.quantize(quant, rounding=ROUND_HALF_UP)
    negative = dec < 0
    text = format(abs(dec), "f")
    if places:
        whole, _, frac = text.partition(".")
        frac = (frac + "0" * places)[:places]
    else:
        whole, frac = text, ""
    if grouping:
        whole = _group(whole)
    result = whole + ("." + frac if places else "")
    return ("-" + result) if negative else result


# --- Textformatter ---------------------------------------------------------


def trim(value) -> str:
    """Aussenleerraum entfernen, innere Mehrfachleerzeichen auf eines reduzieren."""
    if value is None:
        return ""
    if isinstance(value, _dt.datetime):
        return date_de(value)
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return re.sub(r"\s+", " ", str(value)).strip()


def klein(value) -> str:
    """Erster Buchstabe klein (Formatter ``|klein`` aus Abschnitt 8.4)."""
    text = trim(value)
    return text[:1].lower() + text[1:] if text else text


# --- Zahlenformatter -------------------------------------------------------


def chf(value) -> str:
    """``CHF `` + Betrag, 2 Nachkommastellen, Tausendertrenner."""
    return "CHF " + _fixed(value, 2, grouping=True)


def rate(value) -> str:
    """``CHF `` + Betrag, 4 Nachkommastellen, kein Tausendertrenner."""
    return "CHF " + _fixed(value, 4, grouping=False)


def int_ch(value) -> str:
    """Ganzzahl mit Tausendertrenner."""
    return _fixed(value, 0, grouping=True)


def monate(value) -> str:
    """Ganzzahl + ``" Monate"``."""
    return f"{int_ch(value)} Monate"


def date_de(value) -> str:
    """``TT.MM.JJJJ``."""
    if value is None or value == "":
        return ""
    if isinstance(value, _dt.datetime):
        value = value.date()
    if isinstance(value, _dt.date):
        return value.strftime("%d.%m.%Y")
    text = str(value).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", text)
    if m:
        return f"{m.group(3)}.{m.group(2)}.{m.group(1)}"
    return text


# --- label_clean (Abschnitt 7.7) ------------------------------------------

_SPERR = re.compile(r"\b(?:\w\s){2,}\w\b")


def label_clean(value) -> str:
    """Gesperrt geschriebene Labels normalisieren.

    ``"I n t e g r a t i o n - Netzwerk"`` -> ``"Integration Netzwerk"``
    """
    text = str(value or "")
    text = _SPERR.sub(lambda m: m.group(0).replace(" ", ""), text)
    text = text.replace(" - ", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:1].upper() + text[1:] if text else text


FORMATTERS = {
    "trim": trim,
    "klein": klein,
    "chf": chf,
    "rate": rate,
    "int_ch": int_ch,
    "monate": monate,
    "date_de": date_de,
    "label_clean": label_clean,
}


def apply(name: str, value):
    """Formatter über seinen Namen anwenden; unbekannte Namen sind ein Fehler."""
    try:
        return FORMATTERS[name](value)
    except KeyError:
        raise ValueError(f"Unbekannter Formatter: {name}") from None
