/*
 * loader.js — TEST loading screen: a bottle outline that fills as loading advances.
 *
 * Nothing shows it automatically yet. It is played from the test panel
 * ("Play loading screen") or with ?loader=1, with a simulated progress.
 * With the "intro" feature it also plays on arrival at the home page, and its
 * bottle then travels to the hero bottle and lands on it (Loader.play's `into`).
 * To wire it to real loading later: Loader.show(), Loader.set(0…1), Loader.hide().
 * Its one word of text comes from the i18n files ("loader.label").
 */
(function () {
  "use strict";

  // Same silhouette as assets/placeholder-bottle.svg.
  var BOTTLE = "M172 120h56v190c0 70 72 100 72 190v390q0 20-20 20h-160q-20 0-20-20v-390c0-90 72-120 72-190z";
  var TOP = 96, BOTTOM = 910; // the bottle's vertical extent in the drawing

  var overlay = null, level = null, count = null, raf = null;

  function build() {
    var el = document.createElement("div");
    el.className = "loader";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<div class="loader__inner">' +
        '<svg class="loader__bottle" viewBox="90 86 220 834" aria-hidden="true" focusable="false">' +
          '<defs><clipPath id="loader-clip"><rect x="166" y="96" width="68" height="24"/><path d="' + BOTTLE + '"/></clipPath></defs>' +
          '<rect class="loader__level" x="90" y="' + BOTTOM + '" width="220" height="0" clip-path="url(#loader-clip)"/>' +
          '<rect class="loader__line" x="166" y="96" width="68" height="24"/>' +
          '<path class="loader__line" d="' + BOTTLE + '"/>' +
        '</svg>' +
        '<p class="label loader__text"><span data-i18n="loader.label"></span> <span class="loader__count">0</span>&nbsp;%</p>' +
      '</div>';
    level = el.querySelector(".loader__level");
    count = el.querySelector(".loader__count");
    return el;
  }

  function set(progress) {
    if (!overlay) return;
    progress = Math.min(1, Math.max(0, progress));
    var height = (BOTTOM - TOP) * progress;
    level.setAttribute("y", BOTTOM - height);
    level.setAttribute("height", height);
    count.textContent = String(Math.round(progress * 100));
  }

  function show() {
    if (overlay) return;
    overlay = build();
    document.body.appendChild(overlay);
    document.documentElement.classList.add("is-loading");
    if (window.I18n && window.I18n.lang) window.I18n.apply(overlay);
    set(0);
  }

  function hide() {
    if (!overlay) return;
    var el = overlay;
    overlay = null;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    document.documentElement.classList.remove("is-loading");
    el.classList.add("is-leaving");
    // Removed after the fade (or at once when motion is off and nothing fades).
    setTimeout(function () { el.remove(); }, 700);
  }

  // Instead of fading out, the loader's bottle moves onto `target` (an <img> of
  // assets/placeholder-bottle.svg, which has the same outline) while the
  // background clears, so the page opens in one gesture.
  function land(target) {
    var gated = document.documentElement.classList.contains("is-gated");
    var box = target && target.getBoundingClientRect();
    if (!overlay || gated || !box || !box.width || box.bottom < 0 || box.top > window.innerHeight) return hide();

    var bottle = overlay.querySelector(".loader__bottle");
    var from = bottle.getBoundingClientRect();
    // Where the 220 x 834 crop drawn by the loader sits inside the target image (400 x 1000, contained).
    var scale = Math.min(box.width / 400, box.height / 1000);
    var left = box.left + (box.width - 400 * scale) / 2 + 90 * scale;
    var top = box.top + (box.height - 1000 * scale) / 2 + 86 * scale;
    var el = overlay;
    overlay = null;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    document.documentElement.classList.remove("is-loading");
    el.classList.add("is-landing");
    bottle.style.transform = "translate(" + (left - from.left) + "px, " + (top - from.top) + "px) scale(" + ((220 * scale) / from.width) + ")";
    setTimeout(function () { el.classList.add("is-leaving"); }, 1000);
    setTimeout(function () { el.remove(); }, 1500);
  }

  // Simulated run for review: fills in `duration` ms, holds a moment, then
  // fades out, or lands on `options.into` if given.
  function play(duration, options) {
    duration = duration || 2600;
    var finish = options && options.into ? function () { land(options.into); } : hide;
    show();
    var still = document.documentElement.getAttribute("data-motion") !== "full";
    if (still) {
      set(1);
      setTimeout(hide, 900);
      return;
    }
    if (window.I18n && window.I18n.lang && overlay) window.I18n.apply(overlay);
    var start = performance.now();
    (function step(now) {
      if (!overlay) return;
      var t = Math.min((now - start) / duration, 1);
      set(1 - Math.pow(1 - t, 2.2)); // quick start, slow last drops
      if (t < 1) raf = requestAnimationFrame(step);
      else setTimeout(finish, 350);
    })(start);
  }

  window.Loader = { show: show, set: set, hide: hide, play: play };
})();
