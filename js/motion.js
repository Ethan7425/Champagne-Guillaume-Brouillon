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
    var COUNT = 14;
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
    var header = document.querySelector(".site-header");
    if (!sections.length) return;

    var touching = false;
    var timer = null;
    var gliding = false;
    var glideFrame = null;

    function headerOffset() {
      return header && getComputedStyle(header).position === "sticky" ? header.offsetHeight : 0;
    }

    function settle() {
      if (gliding || get() !== "full" || touching || root.classList.contains("is-gated")) return;
      var offset = headerOffset();
      var range = window.innerHeight * SETTLE_RANGE;
      var best = null;
      for (var i = 0; i < sections.length; i++) {
        var gap = sections[i].getBoundingClientRect().top - offset;
        if (Math.abs(gap) <= range && (best === null || Math.abs(gap) < Math.abs(best))) best = gap;
      }
      // Under 2px counts as already in place (this also ends our own glide).
      if (best === null || Math.abs(best) < 2) return;
      var limit = document.documentElement.scrollHeight - window.innerHeight;
      if (best > 0 && window.scrollY >= limit - 1) return; // nothing left to scroll
      glide(Math.min(window.scrollY + best, limit));
    }

    // Our own glide instead of the browser's smooth scroll, which is too brisk
    // here: it starts gently, takes about a second and eases into place.
    function glide(target) {
      var from = window.scrollY;
      var distance = target - from;
      var duration = Math.max(SETTLE_MIN_MS, Math.min(SETTLE_MAX_MS, SETTLE_MIN_MS + Math.abs(distance) * 2));
      var start = null;

      gliding = true;
      function step(now) {
        if (!gliding) return; // the visitor took over
        if (start === null) start = now;
        var t = Math.min((now - start) / duration, 1);
        var eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease-in-out cubic
        window.scrollTo({ top: from + distance * eased, behavior: "instant" });
        if (t < 1) glideFrame = requestAnimationFrame(step);
        else glideFrame = requestAnimationFrame(function () { gliding = false; });
      }
      glideFrame = requestAnimationFrame(step);
    }

    // Any scroll input hands control straight back to the visitor.
    function release() {
      if (!gliding) return;
      gliding = false;
      cancelAnimationFrame(glideFrame);
    }

    ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (type) {
      window.addEventListener(type, release, { passive: true });
    });

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

  window.Motion = { init: init, set: set, get: get, observe: observe, modes: MODES };
})();
