/*
 * consent.js — the cookie banner.
 *
 * Shown on the first visit (after the age question). Three choices of equal
 * weight: refuse, choose, accept all. "Choose" opens the categories:
 *   necessary   always on (language, basket, age answer, checkout)
 *   statistics  off unless accepted
 *   marketing   off unless accepted
 * The choice is kept in the browser and can be changed at any time from the
 * "Cookie settings" link in the footer (or anything with data-consent-open).
 *
 * Nothing on the site sets statistics or marketing cookies yet. When something
 * does (analytics, ads), it must first ask: Consent.has("statistics").
 * A change fires the "consent:change" event.
 *
 * All text comes from the i18n files ("consent").
 * PLACEHOLDER wording: to be checked by a lawyer with the cookie notice.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "site.consent";
  var CATEGORIES = ["statistics", "marketing"];
  var choice = null;
  var banner = null;
  var ready = false; // the page's text is in and the age question (if any) has had its turn

  function read() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (e) { return null; }
  }

  function write(value) {
    choice = value;
    try {
      if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* private mode: the banner will simply ask again next time */ }
    document.dispatchEvent(new CustomEvent("consent:change", { detail: value }));
  }

  function has(category) {
    return !!(choice && choice[category]);
  }

  function build() {
    var el = document.createElement("section");
    el.className = "consent";
    el.setAttribute("role", "region");
    el.setAttribute("aria-labelledby", "consent-title");
    el.hidden = true;
    var rows = CATEGORIES.map(function (name) {
      return '<label class="consent__row"><input type="checkbox" data-consent-category="' + name + '">' +
        '<span><strong data-i18n="consent.' + name + '"></strong><span data-i18n="consent.' + name + 'Note"></span></span></label>';
    }).join("");
    el.innerHTML =
      '<h2 class="consent__title" id="consent-title" data-i18n="consent.title"></h2>' +
      '<p class="consent__body" data-i18n="consent.body"></p>' +
      '<div class="consent__choices" data-consent-details hidden>' +
        '<p class="consent__row consent__row--fixed"><span><strong data-i18n="consent.necessary"></strong><span data-i18n="consent.necessaryNote"></span></span></p>' +
        rows +
      '</div>' +
      '<div class="consent__actions">' +
        '<button type="button" class="btn btn--ghost" data-consent="refuse" data-i18n="consent.refuse"></button>' +
        '<button type="button" class="btn btn--ghost" data-consent="choose" data-i18n="consent.choose"></button>' +
        '<button type="button" class="btn btn--ghost" data-consent="save" data-i18n="consent.save" hidden></button>' +
        '<button type="button" class="btn btn--ghost" data-consent="accept" data-i18n="consent.accept"></button>' +
      '</div>';

    el.addEventListener("click", function (event) {
      var button = event.target.closest("[data-consent]");
      if (!button) return;
      var action = button.getAttribute("data-consent");
      if (action === "choose") return details(true);
      var value = { at: new Date().toISOString() };
      CATEGORIES.forEach(function (name) {
        if (action === "accept") value[name] = true;
        else if (action === "refuse") value[name] = false;
        else value[name] = el.querySelector('[data-consent-category="' + name + '"]').checked;
      });
      write(value);
      close();
    });

    document.body.appendChild(el);
    if (window.I18n && window.I18n.lang) window.I18n.apply(el);
    return el;
  }

  function details(open) {
    banner.querySelector("[data-consent-details]").hidden = !open;
    banner.querySelector('[data-consent="choose"]').hidden = open;
    banner.querySelector('[data-consent="save"]').hidden = !open;
    CATEGORIES.forEach(function (name) {
      banner.querySelector('[data-consent-category="' + name + '"]').checked = has(name);
    });
  }

  function open(withDetails) {
    if (!banner) banner = build();
    details(!!withDetails);
    banner.hidden = false;
    document.documentElement.classList.add("has-consent");
  }

  function close() {
    if (banner) banner.hidden = true;
    document.documentElement.classList.remove("has-consent");
  }

  // The age question comes first: the banner waits until it has been answered.
  function maybeAsk() {
    if (!ready || choice || document.documentElement.classList.contains("is-gated") || document.querySelector(".age-gate")) return;
    if (banner && !banner.hidden) return; // already open: leave it as the visitor has it
    open(false);
  }

  choice = read();

  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("[data-consent-open]");
    if (!link) return;
    event.preventDefault();
    open(true);
  });

  document.addEventListener("i18n:change", function () {
    if (banner) window.I18n.apply(banner);
    // First paint of the page: ask, unless the age question is up (it asks after).
    // The short wait lets the age question open first when it is needed.
    setTimeout(function () { ready = true; maybeAsk(); }, 500);
  });

  // The age gate removes .is-gated when it closes: ask then.
  new MutationObserver(function () { setTimeout(maybeAsk, 0); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  window.Consent = {
    has: has,
    open: open,
    reset: function () { write(null); open(false); }
  };
})();
