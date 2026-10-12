/*
 * age-gate.js — full-screen age confirmation on first visit.
 * Enabled by SITE_CONFIG.AGE_GATE_ENABLED. The answer is kept in localStorage.
 * All text comes from the "age" block of the i18n files.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "site.age";
  var overlay = null;
  var silenced = [];

  function readAnswer() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function writeAnswer(value) {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* private mode */ }
  }

  function build() {
    var el = document.createElement("div");
    el.className = "age-gate";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "age-gate-title");
    el.innerHTML =
      '<div class="age-gate__inner">' +
        '<div class="age-gate__brand">' +
          '<img class="age-gate__logo" src="assets/logo-placeholder.svg" width="160" height="64" alt="" data-i18n-attr="alt:brand.logoAlt">' +
        '</div>' +
        '<div class="age-gate__view" data-view="question">' +
          '<h2 class="age-gate__title" id="age-gate-title" tabindex="-1" data-i18n="age.question"></h2>' +
          '<p class="age-gate__note" data-i18n="age.note"></p>' +
          '<div class="age-gate__actions">' +
            '<button type="button" class="btn btn--primary" data-answer="yes" data-i18n="age.yes"></button>' +
            '<button type="button" class="btn btn--ghost" data-answer="no" data-i18n="age.no"></button>' +
          '</div>' +
        '</div>' +
        '<div class="age-gate__view" data-view="exit" hidden>' +
          '<h2 class="age-gate__title" id="age-gate-exit" tabindex="-1" data-i18n="age.exitTitle"></h2>' +
          '<p class="age-gate__note" data-i18n="age.exitBody"></p>' +
          '<div class="age-gate__actions">' +
            '<button type="button" class="btn btn--ghost" data-answer="reset" data-i18n="age.back"></button>' +
          '</div>' +
        '</div>' +
        '<div class="lang age-gate__lang" role="group" data-lang-switcher data-i18n-attr="aria-label:a11y.langSwitcher"></div>' +
        '<p class="age-gate__health" data-i18n="footer.health"></p>' +
      '</div>';

    el.addEventListener("click", function (event) {
      var button = event.target.closest("[data-answer]");
      if (!button) return;
      var answer = button.getAttribute("data-answer");
      if (answer === "yes") {
        writeAnswer("yes");
        close();
      } else if (answer === "no") {
        writeAnswer("no");
        show("exit");
      } else {
        writeAnswer(null);
        show("question");
      }
    });
    return el;
  }

  function show(view) {
    var views = overlay.querySelectorAll(".age-gate__view");
    for (var i = 0; i < views.length; i++) {
      views[i].hidden = views[i].getAttribute("data-view") !== view;
    }
    var title = overlay.querySelector('[data-view="' + view + '"] .age-gate__title');
    overlay.setAttribute("aria-labelledby", title.id);
    title.focus();
  }

  function open(view) {
    overlay = build();
    // Everything behind the gate is taken out of the tab order and the a11y tree.
    var siblings = document.body.children;
    for (var i = 0; i < siblings.length; i++) {
      if (!siblings[i].inert && !siblings[i].classList.contains("proto-badge")) {
        siblings[i].inert = true;
        silenced.push(siblings[i]);
      }
    }
    document.body.appendChild(overlay);
    document.documentElement.classList.add("is-gated");
    window.I18n.mountSwitchers(overlay);
    window.I18n.apply(overlay);
    show(view);
  }

  function close() {
    silenced.forEach(function (el) { el.inert = false; });
    silenced = [];
    document.documentElement.classList.remove("is-gated");
    if (overlay) overlay.remove();
    overlay = null;
  }

  function init() {
    var config = window.SITE_CONFIG || {};
    if (!config.AGE_GATE_ENABLED || overlay) return;
    var answer = readAnswer();
    if (answer === "yes") return;
    open(answer === "no" ? "exit" : "question");
  }

  window.AgeGate = {
    init: init,
    reset: function () { writeAnswer(null); close(); init(); }
  };
})();
