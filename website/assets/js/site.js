/**
 * Minder Product Management — Website-Skripte
 * ---------------------------------------------------------------------------
 * Bewusst schlank gehalten und ohne Abhaengigkeiten. Die Seite ist ohne
 * JavaScript vollstaendig lesbar und bedienbar; die Skripte verbessern
 * lediglich die Bedienung.
 *
 * Module:
 *   1. Navigation   — Menue auf kleinen Bildschirmen, Haarlinie beim Scrollen
 *   2. Formular     — Validierung in Deutsch, Versand mit E-Mail-Rueckfallweg
 *   3. Jahr         — Jahreszahl im Fussbereich aktuell halten
 */

(function () {
  "use strict";

  /* =========================================================================
     KONFIGURATION
     -------------------------------------------------------------------------
     FORM_ENDPOINT: URL eines Formulardienstes (z. B. Formspree, Netlify Forms
     oder ein eigener Handler), der ein JSON-POST entgegennimmt.
     Solange der Wert leer ist, oeffnet das Formular eine vorausgefuellte
     E-Mail an die unten hinterlegte Adresse. Zum Aktivieren genuegt es, hier
     die Ziel-URL einzutragen — am Markup aendert sich nichts.
     ========================================================================= */

  var FORM_ENDPOINT = ""; // z. B. "https://formspree.io/f/xxxxxxxx"
  var CONTACT_MAIL = "lukas@minder-productmanagement.ch";

  /* =========================================================================
     1  NAVIGATION
     ========================================================================= */

  function initNavigation() {
    var toggle = document.querySelector("[data-nav-toggle]");
    var nav = document.querySelector("[data-nav]");
    var header = document.querySelector("[data-header]");

    /* --- Menue oeffnen und schliessen ------------------------------------ */
    if (toggle && nav) {
      var setOpen = function (open) {
        toggle.setAttribute("aria-expanded", String(open));
        nav.setAttribute("data-open", String(open));
        document.body.setAttribute("data-nav-open", String(open));
        toggle.setAttribute(
          "aria-label",
          open ? "Menü schliessen" : "Menü öffnen"
        );
      };

      toggle.addEventListener("click", function () {
        setOpen(toggle.getAttribute("aria-expanded") !== "true");
      });

      /* Nach einem Klick auf einen Menuepunkt schliessen */
      nav.addEventListener("click", function (event) {
        if (event.target.closest("a")) {
          setOpen(false);
        }
      });

      /* Escape schliesst das Menue und gibt den Fokus zurueck */
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
          setOpen(false);
          toggle.focus();
        }
      });

      /* Beim Wechsel auf die Desktop-Breite den Zustand zuruecksetzen */
      var desktop = window.matchMedia("(min-width: 62em)");
      var onBreakpoint = function (event) {
        if (event.matches) {
          setOpen(false);
        }
      };
      if (typeof desktop.addEventListener === "function") {
        desktop.addEventListener("change", onBreakpoint);
      } else if (typeof desktop.addListener === "function") {
        desktop.addListener(onBreakpoint); // aeltere Safari-Versionen
      }
    }

    /* --- Haarlinie am Header, sobald gescrollt wird ----------------------- */
    if (header) {
      var updateHeader = function () {
        header.classList.toggle("is-scrolled", window.scrollY > 4);
      };
      updateHeader();
      window.addEventListener("scroll", updateHeader, { passive: true });
    }
  }

  /* =========================================================================
     2  FORMULAR
     ========================================================================= */

  /** Prueft ein einzelnes Feld und blendet die Fehlermeldung ein oder aus. */
  function validateField(control) {
    var field = control.closest(".field");
    if (!field) {
      return true;
    }

    var value = control.value.trim();
    var valid = true;

    if (control.required && value === "") {
      valid = false;
    } else if (control.type === "email" && value !== "") {
      /* Bewusst tolerante Pruefung: irgendetwas@irgendetwas.tld */
      valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    }

    field.setAttribute("data-invalid", String(!valid));
    control.setAttribute("aria-invalid", String(!valid));
    return valid;
  }

  /** Baut aus den Formulardaten eine lesbare E-Mail als Rueckfallweg. */
  function buildMailtoLink(data) {
    var betreff = "Schnellcheck-Anfrage" + (data.firma ? " — " + data.firma : "");
    var zeilen = [
      "Name: " + data.name,
      "Firma: " + data.firma,
      "E-Mail: " + data.email,
      "Telefon: " + (data.telefon || "—"),
      "",
      "Situation:",
      data.situation || "—"
    ];

    return (
      "mailto:" +
      CONTACT_MAIL +
      "?subject=" +
      encodeURIComponent(betreff) +
      "&body=" +
      encodeURIComponent(zeilen.join("\n"))
    );
  }

  function initForm() {
    var form = document.querySelector("[data-contact-form]");
    if (!form) {
      return;
    }

    var success = document.querySelector("[data-form-success]");
    var submit = form.querySelector("[data-form-submit]");
    var controls = Array.prototype.slice.call(
      form.querySelectorAll(".field__control")
    );

    /* Browsereigene Meldungen abschalten — wir melden auf Deutsch selbst */
    form.setAttribute("novalidate", "novalidate");

    /* Ein Feld, das einmal beanstandet wurde, wird laufend nachgeprueft */
    controls.forEach(function (control) {
      control.addEventListener("blur", function () {
        validateField(control);
      });
      control.addEventListener("input", function () {
        var field = control.closest(".field");
        if (field && field.getAttribute("data-invalid") === "true") {
          validateField(control);
        }
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      /* Honeypot: ausgefuellt heisst Bot — kommentarlos abbrechen */
      var honeypot = form.querySelector("[data-honeypot]");
      if (honeypot && honeypot.value !== "") {
        return;
      }

      /* Alle Felder pruefen, zum ersten Fehler springen */
      var firstInvalid = null;
      controls.forEach(function (control) {
        if (!validateField(control) && !firstInvalid) {
          firstInvalid = control;
        }
      });

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      var data = {
        name: (form.elements.name || {}).value || "",
        firma: (form.elements.firma || {}).value || "",
        email: (form.elements.email || {}).value || "",
        telefon: (form.elements.telefon || {}).value || "",
        situation: (form.elements.situation || {}).value || ""
      };

      /** Blendet das Formular aus und die Bestaetigung ein. */
      var showSuccess = function () {
        if (!success) {
          return;
        }
        form.hidden = true;
        success.setAttribute("data-visible", "true");
        success.focus();
      };

      /* Weg A: konfigurierter Endpoint */
      if (FORM_ENDPOINT && typeof window.fetch === "function") {
        if (submit) {
          submit.disabled = true;
        }

        window
          .fetch(FORM_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: JSON.stringify(data)
          })
          .then(function (response) {
            if (!response.ok) {
              throw new Error("Antwortstatus " + response.status);
            }
            showSuccess();
          })
          .catch(function () {
            /* Endpoint nicht erreichbar — auf den E-Mail-Weg ausweichen */
            window.location.href = buildMailtoLink(data);
            showSuccess();
          })
          .then(function () {
            if (submit) {
              submit.disabled = false;
            }
          });
        return;
      }

      /* Weg B: kein Endpoint hinterlegt — vorausgefuellte E-Mail oeffnen */
      window.location.href = buildMailtoLink(data);
      showSuccess();
    });
  }

  /* =========================================================================
     3  JAHRESZAHL
     ========================================================================= */

  function initYear() {
    var nodes = document.querySelectorAll("[data-year]");
    var jahr = String(new Date().getFullYear());
    Array.prototype.forEach.call(nodes, function (node) {
      /* Nie in die Vergangenheit zurueckdatieren */
      if (Number(jahr) > Number(node.textContent.trim() || 0)) {
        node.textContent = jahr;
      }
    });
  }

  /* =========================================================================
     START
     ========================================================================= */

  function init() {
    initNavigation();
    initForm();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
