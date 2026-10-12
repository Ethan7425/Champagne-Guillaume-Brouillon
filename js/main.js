/*
 * main.js — page assembly. Runs on index.html and 404.html.
 *   1. applies the defaults from config.js to <html>
 *   2. builds one section per cuvée from <template id="cuvee-template">
 *   3. wires shop links, the cuvée index and the mobile buy bar
 *   4. starts i18n, then the age gate and motion
 */
(function () {
  "use strict";

  var CONFIG = window.SITE_CONFIG || {};
  var CUVEES = CONFIG.CUVEES || [];
  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
  var root = document.documentElement;

  root.classList.add("js");
  root.setAttribute("data-theme", CONFIG.DEFAULT_THEME || "craie-cave");
  root.setAttribute("data-fonts", CONFIG.DEFAULT_FONT_PAIR || "pair-a");
  root.setAttribute("data-motion", CONFIG.DEFAULT_MOTION || "full");

  function shopUrl(cuvee) {
    return (CONFIG.SHOPIFY_BASE_URL || "#") + cuvee.slug;
  }

  /* ---- Cuvée sections ---------------------------------------------------- */
  // The template uses "{i}" wherever the cuvée's position in the i18n array goes.

  function fillIndex(node, index) {
    ["data-i18n", "data-i18n-attr"].forEach(function (attr) {
      var targets = node.querySelectorAll("[" + attr + "]");
      for (var i = 0; i < targets.length; i++) {
        targets[i].setAttribute(attr, targets[i].getAttribute(attr).replace(/\{i\}/g, index));
      }
    });
  }

  function buildCuvees() {
    var template = document.getElementById("cuvee-template");
    var list = document.querySelector("[data-cuvees]");
    if (!template || !list) return [];

    return CUVEES.map(function (cuvee, index) {
      var fragment = template.content.cloneNode(true);
      var section = fragment.querySelector(".cuvee");
      var titleId = "cuvee-" + cuvee.id + "-title";

      fillIndex(fragment, index);
      section.id = "cuvee-" + cuvee.id;
      section.setAttribute("aria-labelledby", titleId);
      section.setAttribute("data-index", index);
      // Bottle on the right, then in the centre, alternating. Text takes the other side.
      section.setAttribute("data-layout", index % 2 ? "centre" : "right");
      if (cuvee.rose) section.setAttribute("data-rose", "");

      section.querySelector(".cuvee__name").id = titleId;
      section.querySelector(".cuvee__numeral").textContent = ROMAN[index] || String(index + 1);
      section.querySelector(".bottle-stage").setAttribute("data-cuvee", cuvee.id);
      section.querySelector("[data-shop]").href = shopUrl(cuvee);

      list.appendChild(fragment);
      return section;
    });
  }

  function buildIndex() {
    var nav = document.querySelector("[data-cuvee-index]");
    if (!nav) return;
    CUVEES.forEach(function (cuvee, index) {
      var link = document.createElement("a");
      link.href = "#cuvee-" + cuvee.id;
      link.className = "cuvee-index__link";
      link.textContent = ROMAN[index] || String(index + 1);
      link.setAttribute("data-i18n-attr", "aria-label:cuvees." + index + ".name");
      nav.appendChild(link);
    });
  }

  /* ---- Art déco sunburst (Direction C divider) ---------------------------- */

  function buildSunbursts() {
    var NS = "http://www.w3.org/2000/svg";
    var hosts = document.querySelectorAll(".sunburst");
    for (var h = 0; h < hosts.length; h++) {
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 200 100");
      svg.setAttribute("focusable", "false");
      var RAYS = 17;
      for (var i = 0; i < RAYS; i++) {
        var angle = Math.PI * (i / (RAYS - 1));
        var outer = i % 2 ? 68 : 96;
        var line = document.createElementNS(NS, "line");
        line.setAttribute("x1", (100 - Math.cos(angle) * 14).toFixed(2));
        line.setAttribute("y1", (100 - Math.sin(angle) * 14).toFixed(2));
        line.setAttribute("x2", (100 - Math.cos(angle) * outer).toFixed(2));
        line.setAttribute("y2", (100 - Math.sin(angle) * outer).toFixed(2));
        line.setAttribute("pathLength", "1");
        // Rays draw from the centre outwards, the middle ones first.
        line.style.setProperty("--ray", Math.abs(i - (RAYS - 1) / 2));
        svg.appendChild(line);
      }
      hosts[h].appendChild(svg);
    }
  }

  /* ---- Current cuvée: side index + mobile buy bar -------------------------- */

  function observeSections(sections) {
    var bar = document.querySelector("[data-buybar]");
    var links = document.querySelectorAll(".cuvee-index__link");
    if (!sections.length || !("IntersectionObserver" in window)) return;

    var visible = {};

    function show(index) {
      for (var i = 0; i < links.length; i++) {
        if (i === index) links[i].setAttribute("aria-current", "true");
        else links[i].removeAttribute("aria-current");
      }
      if (!bar) return;
      root.classList.toggle("has-buybar", index !== -1);
      bar.hidden = index === -1;
      if (index === -1) return;
      bar.href = shopUrl(CUVEES[index]);
      bar.querySelector(".buybar__label").setAttribute("data-i18n", "cuvees." + index + ".buy");
      bar.querySelector(".buybar__price").setAttribute("data-i18n", "cuvees." + index + ".price");
      if (window.I18n.lang) window.I18n.apply(bar);
    }

    // A section is "current" while it crosses the middle of the viewport.
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible[entry.target.getAttribute("data-index")] = entry.isIntersecting;
      });
      var current = -1;
      for (var key in visible) if (visible[key]) current = Number(key);
      show(current);
    }, { rootMargin: "-50% 0px -50% 0px" });

    sections.forEach(function (section) { observer.observe(section); });
  }

  /* ---- Start ------------------------------------------------------------- */

  var sections = buildCuvees();
  buildIndex();
  buildSunbursts();
  observeSections(sections);

  window.I18n.init().then(function () {
    window.AgeGate.init();
    window.Motion.init();
    if (window.Bottle3D) window.Bottle3D.init();
  });
})();
