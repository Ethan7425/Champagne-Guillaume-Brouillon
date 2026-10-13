/*
 * testing-panel.js — TESTING ONLY. DELETE BEFORE LAUNCH.
 *
 * Floating review panel: theme, font pair, language, motion.
 * Opens with the T key, with ?test=1, or with the "Test" tab in the corner.
 *
 * To remove: delete this file, its <script> tag in index.html and 404.html,
 * and the "TESTING ONLY" block at the end of css/themes.css. Nothing else
 * depends on it. Its labels are review tooling, so they are not in /i18n.
 *
 * Review shortcuts in the URL (handy for screenshots):
 *   ?theme=terre-vigneron  ?fonts=pair-c  ?lang=ja  ?motion=off
 *   ?age=ok (skip the age gate)   ?age=reset (show it again)
 *   ?loader=1 (play the test loading screen)   ?bubbles=60 (bubbles per bottle)
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var params = new URLSearchParams(location.search);

  var THEMES = [
    ["craie-cave", "A · Craie & Cave (recommended)"],
    ["terre-vigneron", "B · Terre de vigneron"],
    ["art-deco-nuit", "C · Art déco nuit"]
  ];
  var FONTS = [
    ["pair-a", "A · Bodoni Moda + Jost"],
    ["pair-b", "B · Gloock + Instrument Sans"],
    ["pair-c", "C · Italiana + Manrope"]
  ];
  var MOTION = [["full", "Full"], ["reduced", "Reduced"], ["off", "Off"]];

  function valid(list, value) {
    return list.some(function (item) { return item[0] === value; });
  }

  function stored(key) {
    try { return localStorage.getItem("proto." + key); } catch (e) { return null; }
  }

  function store(key, value) {
    try { localStorage.setItem("proto." + key, value); } catch (e) { /* private mode */ }
  }

  /* ---- State ------------------------------------------------------------- */

  function setFonts(pair) {
    root.setAttribute("data-fonts", pair);
    store("fonts", pair);
    sync();
  }

  function setTheme(theme, keepFonts) {
    root.setAttribute("data-theme", theme);
    store("theme", theme);
    // Each theme names its default pair in themes.css (--theme-font-pair).
    if (!keepFonts) {
      var pair = getComputedStyle(root).getPropertyValue("--theme-font-pair").trim();
      if (valid(FONTS, pair)) setFonts(pair);
    }
    document.dispatchEvent(new CustomEvent("theme:change", { detail: { theme: theme } }));
    sync();
  }

  function setMotion(mode) {
    window.Motion.set(mode, true);
    store("motion", mode);
    sync();
  }

  // URL parameters win over the last saved choice.
  (function restore() {
    var theme = params.get("theme") || stored("theme");
    var fonts = params.get("fonts") || (params.get("theme") ? null : stored("fonts"));
    var motion = params.get("motion") || stored("motion");
    var lang = params.get("lang");
    var age = params.get("age");

    if (valid(THEMES, theme)) setTheme(theme, valid(FONTS, fonts));
    if (valid(FONTS, fonts)) setFonts(fonts);
    if (valid(MOTION, motion)) setMotion(motion);
    if (lang) window.I18n.set(lang);
    try {
      if (age === "ok") localStorage.setItem("site.age", "yes");
      if (age === "reset") localStorage.removeItem("site.age");
    } catch (e) { /* private mode */ }
  })();

  /* ---- Panel ------------------------------------------------------------- */

  var panel = document.createElement("aside");
  panel.className = "test-panel";
  panel.setAttribute("aria-label", "Test panel");
  panel.hidden = true;

  var tab = document.createElement("button");
  tab.type = "button";
  tab.className = "test-tab";
  tab.textContent = "Test (T)";
  tab.setAttribute("aria-expanded", "false");

  function group(title, key, options, onPick) {
    var fieldset = document.createElement("fieldset");
    var legend = document.createElement("legend");
    legend.textContent = title;
    fieldset.appendChild(legend);
    options.forEach(function (option) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = option[1];
      button.setAttribute("data-group", key);
      button.setAttribute("data-value", option[0]);
      button.addEventListener("click", function () { onPick(option[0]); });
      fieldset.appendChild(button);
    });
    return fieldset;
  }

  function sync() {
    if (!panel) return; // saved choices are restored before the panel exists
    var current = {
      theme: root.getAttribute("data-theme"),
      fonts: root.getAttribute("data-fonts"),
      motion: root.getAttribute("data-motion")
    };
    var buttons = panel.querySelectorAll("button[data-group]");
    for (var i = 0; i < buttons.length; i++) {
      var on = current[buttons[i].getAttribute("data-group")] === buttons[i].getAttribute("data-value");
      buttons[i].setAttribute("aria-pressed", String(on));
    }
    reportFonts();
  }

  // Says which fonts are really on screen. If a font file failed to load the
  // browser quietly shows a fallback, and every pair then looks the same.
  function reportFonts() {
    var status = panel.querySelector(".test-panel__fonts");
    if (!status || !document.fonts) return;
    var style = getComputedStyle(root);
    var lines = [["Headings", "--font-heading"], ["Body", "--font-body"]].map(function (item) {
      var family = style.getPropertyValue(item[1]).split(",")[0].trim().replace(/["']/g, "");
      var loaded = document.fonts.check('16px "' + family + '"');
      return item[0] + ": " + family + (loaded ? " (loaded)" : " (NOT LOADED, fallback shown)");
    });
    status.textContent = lines.join("\n");
  }

  function toggle(open) {
    panel.hidden = open === undefined ? !panel.hidden : !open;
    tab.setAttribute("aria-expanded", String(!panel.hidden));
    sync();
  }

  (function build() {
    var head = document.createElement("div");
    head.className = "test-panel__head";
    var title = document.createElement("strong");
    title.textContent = "Test panel";
    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.addEventListener("click", function () { toggle(false); tab.focus(); });
    head.appendChild(title);
    head.appendChild(close);
    panel.appendChild(head);

    panel.appendChild(group("Theme", "theme", THEMES, function (value) { setTheme(value); }));
    var fonts = group("Font pair", "fonts", FONTS, setFonts);
    var status = document.createElement("p");
    status.className = "test-panel__fonts";
    fonts.appendChild(status);
    panel.appendChild(fonts);

    var language = document.createElement("fieldset");
    var legend = document.createElement("legend");
    legend.textContent = "Language";
    var switcher = document.createElement("div");
    switcher.className = "test-panel__lang";
    switcher.setAttribute("data-lang-switcher", "");
    language.appendChild(legend);
    language.appendChild(switcher);
    panel.appendChild(language);

    panel.appendChild(group("Motion", "motion", MOTION, setMotion));

    var pages = document.createElement("fieldset");
    var pagesLegend = document.createElement("legend");
    pagesLegend.textContent = "Pages";
    pages.appendChild(pagesLegend);
    [["index.html?all=1", "Scroll page (index.html)"], ["selection.html", "Bottle ring (selection.html)"]].forEach(function (page) {
      var link = document.createElement("a");
      link.href = page[0];
      link.textContent = page[1];
      var file = page[0].split("?")[0];
      if (location.pathname.split("/").pop() === file || (file === "index.html" && /\/$/.test(location.pathname))) {
        link.setAttribute("aria-current", "page");
      }
      pages.appendChild(link);
    });
    panel.appendChild(pages);

    // How "Order" hands over to Shopify (js/shop.js), to compare the options.
    if (window.Shop) {
      var SHOP = [
        ["page", "0 · Shopify product page (first idea)"],
        ["link", "1 · Straight to Shopify checkout"],
        ["embed", "2 · Shopify's embedded cart (simulated)"],
        ["basket", "3 · Our own basket, then checkout"]
      ];
      var shop = document.createElement("fieldset");
      var shopLegend = document.createElement("legend");
      shopLegend.textContent = "Shop";
      shop.appendChild(shopLegend);
      SHOP.forEach(function (option) {
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = option[1];
        button.setAttribute("data-shop-mode", option[0]);
        button.setAttribute("aria-pressed", String(window.Shop.mode() === option[0]));
        button.addEventListener("click", function () {
          root.setAttribute("data-shop", option[0]);
          store("shop", option[0]);
          var all = shop.querySelectorAll("button");
          for (var i = 0; i < all.length; i++) all[i].setAttribute("aria-pressed", String(all[i] === button));
          document.dispatchEvent(new CustomEvent("shop:change"));
        });
        shop.appendChild(button);
      });
      panel.appendChild(shop);
    }

    // Optional effects (config.js: FEATURES), each with its own switch.
    var FEATURES = [
      ["light", "Light follows the pointer"],
      ["hover", "Ring bottles tilt toward the pointer"],
      ["gauge", "Cellar gauge (scroll progress)"],
      ["tint", "Coloured light per cuvée"],
      ["glass", "\"In the glass\" section (ring page)"],
      ["chart", "Aroma chart (in the glass section)"],
      ["intro", "Loading screen lands on the hero"],
      ["ringHome", "Ring page is the home page"],
      ["cursor", "Custom cursor"]
    ];
    var effects = document.createElement("fieldset");
    var effectsLegend = document.createElement("legend");
    effectsLegend.textContent = "Effects";
    effects.appendChild(effectsLegend);
    FEATURES.forEach(function (feature) {
      var name = feature[0];
      var saved = stored("fx." + name);
      if (saved === "on" || saved === "off") root.setAttribute("data-fx-" + name, saved);
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = feature[1];
      button.setAttribute("aria-pressed", String(root.getAttribute("data-fx-" + name) === "on"));
      button.addEventListener("click", function () {
        var next = root.getAttribute("data-fx-" + name) === "on" ? "off" : "on";
        root.setAttribute("data-fx-" + name, next);
        store("fx." + name, next);
        button.setAttribute("aria-pressed", String(next === "on"));
        document.dispatchEvent(new CustomEvent("fx:change", { detail: { name: name, on: next === "on" } }));
      });
      effects.appendChild(button);
    });
    panel.appendChild(effects);
    document.dispatchEvent(new CustomEvent("fx:change", { detail: {} }));

    // Bubbles: how many rise inside each 3D bottle (the hero bubbles scale with it).
    if (window.Bottle3D) {
      var fizz = document.createElement("fieldset");
      var fizzLegend = document.createElement("legend");
      fizzLegend.textContent = "Bubbles per bottle";
      var slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = String(window.Bottle3D.bubblesMax);
      slider.step = "4";
      slider.setAttribute("aria-label", "Bubbles per bottle");
      var amount = document.createElement("output");
      function setBubbles(value, save) {
        root.setAttribute("data-bubbles", value);
        slider.value = value;
        amount.textContent = value;
        if (save) store("bubbles", value);
        document.dispatchEvent(new CustomEvent("bubbles:change"));
      }
      slider.addEventListener("input", function () { setBubbles(slider.value, true); });
      fizz.appendChild(fizzLegend);
      fizz.appendChild(slider);
      fizz.appendChild(amount);
      panel.appendChild(fizz);
      var savedBubbles = params.get("bubbles") || stored("bubbles");
      if (savedBubbles !== null && !isNaN(Number(savedBubbles))) setBubbles(String(Number(savedBubbles)), false);
      else { slider.value = window.Bottle3D.bubbleCount(); amount.textContent = slider.value; }
    }

    // Says why the 3D bottles are, or are not, running on this device.
    var three = document.createElement("fieldset");
    var threeLegend = document.createElement("legend");
    threeLegend.textContent = "3D status";
    var threeStatus = document.createElement("p");
    threeStatus.className = "test-panel__3d";
    three.appendChild(threeLegend);
    three.appendChild(threeStatus);
    panel.appendChild(three);
    setInterval(function () {
      if (panel.hidden || !window.Bottle3D) return;
      threeStatus.textContent = window.Bottle3D.status().join("\n");
    }, 600);

    var loader = document.createElement("button");
    loader.type = "button";
    loader.textContent = "Play loading screen";
    loader.addEventListener("click", function () {
      toggle(false);
      window.scrollTo({ top: 0, behavior: "instant" });
      var hero = document.querySelector(".hero__bottle");
      window.Loader.play(1900, hero && root.getAttribute("data-fx-intro") === "on" ? { into: hero } : null);
    });
    panel.appendChild(loader);

    var reset = document.createElement("button");
    reset.type = "button";
    reset.className = "test-panel__reset";
    reset.textContent = "Show the age gate again";
    reset.addEventListener("click", function () { window.AgeGate.reset(); });
    panel.appendChild(reset);

    var note = document.createElement("p");
    note.textContent = "Testing only. Delete before launch.";
    panel.appendChild(note);

    document.body.appendChild(tab);
    document.body.appendChild(panel);
    window.I18n.mountSwitchers(panel);
    tab.addEventListener("click", function () { toggle(); });
  })();

  document.addEventListener("keydown", function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    var target = event.target;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (event.key === "t" || event.key === "T") toggle();
    else if (event.key === "Escape" && !panel.hidden) toggle(false);
  });
  // Motion.init() may downgrade the default after this file has run.
  document.addEventListener("motion:change", sync);
  // A newly chosen pair is fetched on demand: refresh the status once it lands.
  if (document.fonts) {
    document.fonts.addEventListener("loadingdone", reportFonts);
    document.fonts.addEventListener("loadingerror", reportFonts);
  }

  if (params.get("test") === "1") toggle(true);
  if (params.get("loader") === "1" && window.Loader) {
    document.addEventListener("i18n:change", function once() {
      document.removeEventListener("i18n:change", once);
      window.Loader.play();
    });
  }
  sync();
})();
