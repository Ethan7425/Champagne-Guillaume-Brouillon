/*
 * i18n.js — loads /i18n/<lang>.json and fills the page.
 *
 * Markup contract:
 *   data-i18n="path.to.key"                  -> textContent
 *   data-i18n-attr="alt:path.key;title:..."  -> attributes
 *   data-lang-switcher                       -> receives FR / EN / ES / 日本語 buttons
 *
 * On http(s) the JSON files are fetched. Browsers block fetch() on file://,
 * so when index.html is opened by double-click we fall back to i18n/bundle.js,
 * a generated copy of the same four files (see tools/build-i18n-bundle.js).
 */
(function () {
  "use strict";

  var CONFIG = window.SITE_CONFIG || {};
  var LANGS = CONFIG.LANGUAGES || ["en"];
  var STORAGE_KEY = "site.lang";
  // Language names are shown in their own language, so they are not translated.
  var LABELS = { fr: "FR", en: "EN", es: "ES", ja: "日本語" };
  var NAMES = { fr: "Français", en: "English", es: "Español", ja: "日本語" };

  var cache = {};
  var current = null;
  var requestId = 0;
  var bundlePromise = null;

  function readStored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function writeStored(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* private mode */ }
  }

  function loadBundle() {
    if (!bundlePromise) {
      bundlePromise = new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = "i18n/bundle.js";
        script.onload = function () { resolve(window.__I18N_BUNDLE__ || {}); };
        script.onerror = function () { reject(new Error("i18n/bundle.js not found")); };
        document.head.appendChild(script);
      });
    }
    return bundlePromise;
  }

  function load(lang) {
    if (cache[lang]) return Promise.resolve(cache[lang]);
    var fromJson = location.protocol === "file:"
      ? Promise.reject(new Error("file://"))
      : fetch("i18n/" + lang + ".json").then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        });
    return fromJson
      .catch(function () {
        return loadBundle().then(function (bundle) {
          if (!bundle[lang]) throw new Error("No translations for " + lang);
          return bundle[lang];
        });
      })
      .then(function (dict) {
        cache[lang] = dict;
        return dict;
      });
  }

  function t(key) {
    var node = cache[current];
    var parts = String(key).split(".");
    for (var i = 0; i < parts.length && node != null; i++) node = node[parts[i]];
    // A missing key stays visible on purpose, so it gets noticed in review.
    return typeof node === "string" ? node : "⟦" + key + "⟧";
  }

  function apply(root) {
    root = root || document;
    var i, nodes;

    nodes = root.querySelectorAll("[data-i18n]");
    for (i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
    }

    nodes = root.querySelectorAll("[data-i18n-attr]");
    for (i = 0; i < nodes.length; i++) {
      nodes[i].getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var idx = pair.indexOf(":");
        if (idx < 1) return;
        nodes[i].setAttribute(pair.slice(0, idx).trim(), t(pair.slice(idx + 1).trim()));
      });
    }
  }

  function syncSwitchers() {
    var buttons = document.querySelectorAll("[data-lang-switcher] button[data-lang]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", String(buttons[i].getAttribute("data-lang") === current));
    }
  }

  function mountSwitcher(container) {
    if (container.querySelector("button[data-lang]")) return;
    LANGS.forEach(function (lang) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "lang__btn";
      button.setAttribute("data-lang", lang);
      button.setAttribute("lang", lang);
      button.setAttribute("title", NAMES[lang] || lang);
      button.setAttribute("aria-pressed", "false");
      button.textContent = LABELS[lang] || lang.toUpperCase();
      button.addEventListener("click", function () { set(lang); });
      container.appendChild(button);
    });
    syncSwitchers();
  }

  function mountSwitchers(root) {
    var containers = (root || document).querySelectorAll("[data-lang-switcher]");
    for (var i = 0; i < containers.length; i++) mountSwitcher(containers[i]);
  }

  function set(lang, options) {
    if (LANGS.indexOf(lang) === -1) lang = CONFIG.DEFAULT_LANGUAGE || LANGS[0];
    var id = ++requestId;
    return load(lang)
      .then(function () {
        if (id !== requestId) return current; // a newer choice won
        current = lang;
        if (!options || options.persist !== false) writeStored(lang);
        document.documentElement.lang = lang;
        apply(document);
        syncSwitchers();
        document.documentElement.classList.remove("i18n-pending");
        document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang: lang } }));
        return lang;
      })
      .catch(function (error) {
        document.documentElement.classList.remove("i18n-pending");
        console.warn("[i18n] could not load \"" + lang + "\":", error.message);
        return current;
      });
  }

  function init() {
    mountSwitchers(document);
    return set(readStored() || CONFIG.DEFAULT_LANGUAGE || LANGS[0], { persist: false });
  }

  window.I18n = {
    init: init,
    set: set,
    t: t,
    apply: apply,
    mountSwitchers: mountSwitchers,
    get lang() { return current; },
    languages: LANGS,
    labels: LABELS
  };
})();
