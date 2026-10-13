/*
 * motion.js — the three motion levels and the few things that move.
 *
 * <html data-motion="full | reduced | off"> is the single switch; the CSS reads it.
 *   full     fade + slight rise on scroll, floating hero bottle, hero bubbles,
 *            bottle tilt on hover, scroll settle on the cuvée sections
 *   reduced  opacity fades only, nothing travels, no bubbles, no tilt, no settle
 *   off      everything is static
 *
 * Default: SITE_CONFIG.DEFAULT_MOTION, downgraded to "reduced" when the visitor
 * has prefers-reduced-motion. An explicit choice (Motion.set) overrides both.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var MODES = ["full", "reduced", "off"];
  var explicit = false;

  function get() {
    return root.getAttribute("data-motion") || "full";
  }

  function set(mode, isExplicit) {
    if (MODES.indexOf(mode) === -1) return;
    if (isExplicit) {
      explicit = true;
      root.setAttribute("data-motion-explicit", "");
    }
    root.setAttribute("data-motion", mode);
    document.dispatchEvent(new CustomEvent("motion:change", { detail: { mode: mode } }));
  }

  /* ---- Scroll reveal ---------------------------------------------------- */

  var revealObserver = null;

  function observe(scope) {
    var nodes = (scope || document).querySelectorAll("[data-reveal]");
    for (var i = 0; i < nodes.length; i++) {
      if (revealObserver) revealObserver.observe(nodes[i]);
      else nodes[i].classList.add("is-in");
    }
  }

  function setupReveal() {
    if ("IntersectionObserver" in window) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -12% 0px", threshold: 0.1 });
    }
    observe(document);
  }

  /* ---- Hero bubbles ----------------------------------------------------- */
  // A dozen thin rings rising slowly. Shown by the theme (CSS), run only in "full".

  function setupBubbles() {
    var canvas = document.querySelector("[data-bubbles]");
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext("2d");
    var BASE = 14;
    var COUNT = BASE;

    // The test panel's bubble slider (<html data-bubbles>) scales the hero too:
    // the default number per bottle in config.js equals these 14.
    function applyAmount() {
      var value = root.getAttribute("data-bubbles");
      var config = window.SITE_CONFIG || {};
      var normal = config.BUBBLES_PER_BOTTLE || 24;
      COUNT = value === null ? BASE : Math.round(BASE * Number(value) / normal);
      bubbles.length = Math.min(bubbles.length, COUNT);
      while (bubbles.length < COUNT && width) bubbles.push(spawn({}, true));
    }
    var bubbles = [];
    var width = 0, height = 0, color = "#fff";
    var frame = null, inView = true, last = 0;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      color = getComputedStyle(canvas).color;
    }

    function spawn(bubble, anywhere) {
      bubble.x = Math.random() * width;
      bubble.y = anywhere ? Math.random() * height : height + 10;
      bubble.r = 1 + Math.random() * 2.5;
      bubble.speed = 10 + Math.random() * 16;   // px per second
      bubble.sway = 4 + Math.random() * 8;
      bubble.phase = Math.random() * Math.PI * 2;
      bubble.alpha = 0.12 + Math.random() * 0.28;
      return bubble;
    }

    function draw(now) {
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      for (var i = 0; i < bubbles.length; i++) {
        var b = bubbles[i];
        b.y -= b.speed * dt;
        if (b.y < -10) spawn(b, false);
        ctx.globalAlpha = b.alpha * Math.min(1, b.y / (height * 0.25));
        ctx.beginPath();
        ctx.arc(b.x + Math.sin(now / 1600 + b.phase) * b.sway, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      frame = requestAnimationFrame(draw);
    }

    function shouldRun() {
      return get() === "full" && inView && !document.hidden && canvas.offsetParent !== null;
    }

    function update() {
      if (shouldRun()) {
        if (frame) return;
        resize();
        if (!bubbles.length) {
          for (var i = 0; i < COUNT; i++) bubbles.push(spawn({}, true));
        }
        last = performance.now();
        frame = requestAnimationFrame(draw);
      } else {
        if (frame) cancelAnimationFrame(frame);
        frame = null;
        ctx.clearRect(0, 0, width, height);
      }
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        update();
      }).observe(canvas);
    }
    if ("ResizeObserver" in window) {
      new ResizeObserver(function () { if (frame) resize(); }).observe(canvas);
    }
    document.addEventListener("visibilitychange", update);
    document.addEventListener("motion:change", update);
    document.addEventListener("bubbles:change", applyAmount);
    applyAmount();
    // The testing panel fires this; it also decides whether the canvas is shown at all.
    document.addEventListener("theme:change", function () {
      if (frame) { cancelAnimationFrame(frame); frame = null; }
      update();
    });
    update();
  }

  /* ---- Bottle tilt on hover --------------------------------------------- */
  // The bottle leans a few degrees toward the pointer. Mouse only, "full" only.

  var TILT_Y = 12; // degrees, left-right
  var TILT_X = 6;  // degrees, up-down

  function setupTilt() {
    var frames = document.querySelectorAll(".plate__frame");
    Array.prototype.forEach.call(frames, function (frame) {
      var image = frame.querySelector(".plate__img");
      var pending = null;
      if (!image) return;

      function reset() {
        frame.classList.remove("is-tilting");
        image.style.removeProperty("--tilt-x");
        image.style.removeProperty("--tilt-y");
      }

      frame.addEventListener("pointermove", function (event) {
        if (event.pointerType !== "mouse" || get() !== "full") return;
        var x = event.clientX, y = event.clientY;
        if (pending) return;
        pending = requestAnimationFrame(function () {
          pending = null;
          var rect = frame.getBoundingClientRect();
          var across = (x - rect.left) / rect.width - 0.5;   // -0.5 … 0.5
          var down = (y - rect.top) / rect.height - 0.5;
          frame.classList.add("is-tilting");
          image.style.setProperty("--tilt-y", (across * TILT_Y).toFixed(2) + "deg");
          image.style.setProperty("--tilt-x", (-down * TILT_X).toFixed(2) + "deg");
        });
      });
      frame.addEventListener("pointerleave", function () {
        if (pending) { cancelAnimationFrame(pending); pending = null; }
        reset();
      });
    });
  }

  /* ---- Gliding scroll ------------------------------------------------------- */
  // Every scripted move of the page goes through here: the scroll settle below,
  // the gauge's checkpoints, and links to a place on the same page (#cuvees…).
  // It starts gently, travels, and eases into place; the browser's own smooth
  // scroll is too brisk and cannot be slowed down. Longer trips take longer.
  // Any scroll input from the visitor stops it at once.

  var GLIDE_MIN_MS = 1000;  // a short trip (one screen)…
  var GLIDE_MAX_MS = 2600;  // …and the longest (top to bottom)
  var gliding = false;
  var glideFrame = null;
  var glideGoal = 0; // where the current glide is heading
  var glideEnds = 0; // and when it is due to arrive (0 = none under way, or the visitor took over)

  function headerOffset() {
    var header = document.querySelector(".site-header");
    return header && getComputedStyle(header).position === "sticky" ? header.offsetHeight : 0;
  }

  function glide(target, duration) {
    var from = window.scrollY;
    var limit = document.documentElement.scrollHeight - window.innerHeight;
    target = Math.max(0, Math.min(target, limit));
    var distance = target - from;
    if (Math.abs(distance) < 1) return;
    if (get() !== "full") { // reduced or off: no travelling, go straight there
      window.scrollTo({ top: target, behavior: "instant" });
      return;
    }
    duration = duration || Math.max(GLIDE_MIN_MS, Math.min(GLIDE_MAX_MS, 750 + Math.abs(distance) * 0.42));
    var start = null;

    cancelAnimationFrame(glideFrame);
    glideGoal = target;
    glideEnds = performance.now() + duration;
    gliding = true;
    root.classList.add("is-gliding"); // base.css: no scroll snapping meanwhile
    function step(now) {
      if (!gliding) return; // the visitor took over
      if (start === null) start = now;
      var t = Math.min((now - start) / duration, 1);
      var eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease-in-out cubic
      window.scrollTo({ top: from + distance * eased, behavior: "instant" });
      if (t < 1) glideFrame = requestAnimationFrame(step);
      else glideFrame = requestAnimationFrame(function () { glideEnds = 0; release(); });
    }
    glideFrame = requestAnimationFrame(step);
  }

  function release(event) {
    // A wheel, touch or click means the visitor took over: the planned arrival no longer counts.
    // (A key press may be the next arrow step, which carries on from that arrival.)
    if (event && event.type && event.type !== "keydown") glideEnds = 0;
    if (!gliding) return;
    gliding = false;
    cancelAnimationFrame(glideFrame);
    root.classList.remove("is-gliding");
  }

  // The scroll position at which `element` is "in place": just under the sticky
  // header, and under anything else pinned above it (its CSS scroll-margin-top,
  // e.g. the bottle window on phones).
  function restTop(element) {
    var margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
    return element.getBoundingClientRect().top + window.scrollY - headerOffset() - margin;
  }

  function glideTo(element) {
    if (element) glide(restTop(element));
  }

  // Any scroll input hands control straight back to the visitor.
  ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (type) {
    window.addEventListener(type, release, { passive: true });
  });

  /* ---- Arrow keys step through the sections (feature "keys") ------------------ */
  // Arrow down (or Page Down) goes to the next section, arrow up (or Page Up) to
  // the previous one, one press per section. The sections are the same ones the
  // gauge marks as checkpoints (data-checkpoint), plus the very end of the page.
  // Registered after the "release" listeners above, so the key press that starts
  // a glide does not also cancel it.

  window.addEventListener("keydown", function (event) {
    var down = event.key === "ArrowDown" || event.key === "PageDown";
    var up = event.key === "ArrowUp" || event.key === "PageUp";
    if (!down && !up) return;
    if (root.getAttribute("data-fx-keys") !== "on") return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    // Not while something else owns the keys: a form field, an open panel, the age question.
    var target = event.target;
    if (target && target.closest && target.closest("input, textarea, select, [contenteditable], .test-panel, .basket, .age-gate")) return;
    if (root.classList.contains("is-gated") || root.classList.contains("has-basket-open") || root.classList.contains("is-loading")) return;

    var sections = document.querySelectorAll("[data-checkpoint]");
    if (!sections.length) return;
    var offset = headerOffset();
    var limit = document.documentElement.scrollHeight - window.innerHeight;
    var stops = [];
    for (var i = 0; i < sections.length; i++) {
      if (!sections[i].getClientRects().length) continue; // switched off or not laid out
      stops.push(Math.max(0, Math.min(limit, Math.round(restTop(sections[i])))));
    }
    stops.push(limit); // the footer
    stops.sort(function (a, b) { return a - b; });

    // Pressing again mid-glide counts from where that glide is going, so
    // several quick presses move several sections.
    var from = performance.now() < glideEnds ? glideGoal : window.scrollY;
    var next = null;
    if (down) {
      for (var d = 0; d < stops.length; d++) { if (stops[d] > from + 4) { next = stops[d]; break; } }
    } else {
      for (var u = stops.length - 1; u >= 0; u--) { if (stops[u] < from - 4) { next = stops[u]; break; } }
    }
    event.preventDefault(); // no small native scroll on top of the glide
    if (next !== null) glide(next);
  });

  // Links to a place on this page glide there instead of jumping.
  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link) return;
    // Placeholder links ("#", e.g. the legal pages for now) do nothing at all.
    if (link.getAttribute("href") === "#") { event.preventDefault(); return; }
    var url = new URL(link.href, location.href);
    if (url.pathname !== location.pathname || url.search !== location.search || url.hash.length < 2) return;
    var target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    event.preventDefault();
    history.pushState(null, "", url.hash);
    glideTo(target);
  });

  /* ---- Scroll settle ------------------------------------------------------ */
  // When scrolling stops near the top of a cuvée section, the page glides the
  // rest of the way so the bottle and its information sit squarely on screen.
  // It only acts within SETTLE_RANGE of a section top, so long sections (mobile)
  // can still be read freely, and any new scroll input simply takes over.

  var SETTLE_RANGE = 0.35;  // share of the viewport height
  var SETTLE_MIN_MS = 700;  // glide time for a short correction…
  var SETTLE_MAX_MS = 1300; // …and for the longest one

  function setupSettle() {
    var sections = document.querySelectorAll("[data-settle]");
    if (!sections.length) return;
    // Touch screens lock with native CSS scroll snapping instead (base.css):
    // it follows the finger's momentum, which a scripted glide cannot do well.
    if (window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;

    var touching = false;
    var timer = null;

    function settle() {
      if (gliding || get() !== "full" || touching || root.classList.contains("is-gated")) return;
      var offset = headerOffset();
      var range = window.innerHeight * SETTLE_RANGE;
      var best = null;
      for (var i = 0; i < sections.length; i++) {
        if (!sections[i].getClientRects().length) continue; // dissolved on this screen size
        var gap = sections[i].getBoundingClientRect().top - offset - (parseFloat(getComputedStyle(sections[i]).scrollMarginTop) || 0);
        if (Math.abs(gap) <= range && (best === null || Math.abs(gap) < Math.abs(best))) best = gap;
      }
      // Under 2px counts as already in place (this also ends our own glide).
      if (best === null || Math.abs(best) < 2) return;
      var limit = document.documentElement.scrollHeight - window.innerHeight;
      if (best > 0 && window.scrollY >= limit - 1) return; // nothing left to scroll
      var duration = Math.max(SETTLE_MIN_MS, Math.min(SETTLE_MAX_MS, SETTLE_MIN_MS + Math.abs(best) * 2));
      glide(Math.min(window.scrollY + best, limit), duration);
    }

    window.addEventListener("touchstart", function () { touching = true; }, { passive: true });
    window.addEventListener("touchend", function () { touching = false; }, { passive: true });
    window.addEventListener("touchcancel", function () { touching = false; }, { passive: true });

    if ("onscrollend" in window) {
      window.addEventListener("scrollend", settle);
    } else {
      // Older Safari: no scrollend event, so wait for scrolling to go quiet.
      window.addEventListener("scroll", function () {
        clearTimeout(timer);
        timer = setTimeout(settle, 160);
      }, { passive: true });
    }
  }

  function init() {
    var config = window.SITE_CONFIG || {};
    if (!explicit) {
      var prefersLess = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var wanted = config.DEFAULT_MOTION || "full";
      set(prefersLess && wanted === "full" ? "reduced" : wanted, false);
    }
    setupReveal();
    setupBubbles();
    setupTilt();
    setupSettle();
  }

  window.Motion = { init: init, set: set, get: get, observe: observe, modes: MODES, glide: glide, glideTo: glideTo, restTop: restTop };
})();
