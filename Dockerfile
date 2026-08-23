# Offerttool V3 – Web-Oberfläche für den Betrieb im Firmennetz.
#
# LibreOffice wird nur für einen Zweck gebraucht: Schritt 8 rendert das
# Dokument einmal nach PDF, um die Seitenzahlen des Inhaltsverzeichnisses zu
# ermitteln (Abschnitt 12.1).  Ohne LibreOffice läuft die App, das Verzeichnis
# entsteht dann aber ohne Seitenzahlen (Warnung W321).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOME=/tmp

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libreoffice-writer-nogui \
      poppler-utils \
      fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml README.md ./
COPY offerttool ./offerttool
RUN pip install --no-cache-dir ".[web]"

# Die App schreibt ausschliesslich in temporäre Verzeichnisse und braucht
# kein beschreibbares Projektverzeichnis.
RUN useradd --create-home --uid 10001 offerttool
USER offerttool

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8080/api/gesundheit').read()"

CMD ["offerttool", "serve", "--host", "0.0.0.0", "--port", "8080"]
