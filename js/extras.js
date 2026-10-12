/*
 * extras.js — optional page effects. Each one is a feature in config.js
 * (FEATURES) and a switch in the test panel; <html data-fx-NAME="on|off">
 * says whether it is on.
 *
 *   gauge   scroll progress shown as a descent into the cellar: a hairline
 *           that fills, with the depth and the temperature at that depth
 *   tint    the cuvée on screen lends its colour to the small details near it
 *           (the coloured light around the 3D bottle is in bottle-3d.js)
 *   glass   "In the glass" section (selection.html): a flute, drawn in line,
 *           with the cuvée's colour and rising bubbles
 *   chart   aroma chart beside the flute: six axes, values from config.js
 *   cursor  custom cursor: a dot at the pointer and a ring that trails it
 *
 * The two 3D effects (light, hover) live in bottle-3d.js and bottle-ring.js.
 */
(function () {
  "use strict";

  var CONFIG = window.SITE_CONFIG || {};
  var CUVEES = CONFIG.CUVEES || [];
  var root = document.documentElement;

  function fx(name) {
    return root.getAttribute("data-fx-" + name) === "on";
  }

  function motionFull() {
    return root.getAttribute("data-motion") === "full";
  }

  /* ---- Custom cursor ---------------------------------------------------------- */
  // Mouse only. A small dot sits exactly at the pointer (so aiming stays
  // precise) and a hairline ring trails just behind it. The ring widens over
  // anything that can be clicked, and over the 3D bottles. While the feature
  // is on, the system cursor is hidden (see "Custom cursor" in components.css).

  (function cursor() {
    if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var dot = document.createElement("div");
    var halo = document.createElement("div");
    dot.className = "cursor cursor--dot";
    halo.className = "cursor cursor--ring";
    dot.setAttribute("aria-hidden", "true");
    halo.setAttribute("aria-hidden", "true");
    document.body.appendChild(halo);
    document.body.appendChild(dot);

    var x = -100, y = -100, hx = -100, hy = -100, raf = null, last = 0;

    function frame(now) {
      var ease = 1 - Math.exp(-Math.max(0, Math.min((now - last) / 1000, 0.1)) * 16);
      last = now;
      hx += (x - hx) * ease;
      hy += (y - hy) * ease;
      halo.style.transform = "translate(" + hx.toFixed(1) + "px, " + hy.toFixed(1) + "px)";
      raf = Math.abs(x - hx) + Math.abs(y - hy) > 0.2 ? requestAnimationFrame(frame) : null;
    }

    window.addEventListener("pointermove", function (event) {
      if (event.pointerType !== "mouse" || !fx("cursor")) return;
      x = event.clientX;
      y = event.clientY;
      dot.style.transform = "translate(" + x + "px, " + y + "px)";
      root.classList.add("has-cursor");
      var target = event.target;
      var active = !!(target && target.closest && target.closest("a[href], button, summary, input, [role='button']"));
      // On the ring's canvas, only when a bottle is under the pointer (bottle-ring.js marks that).
      if (target && target.tagName === "CANVAS" && target.style.cursor === "pointer") active = true;
      root.classList.toggle("cursor-active", active);
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }, { passive: true });

    document.documentElement.addEventListener("pointerleave", function () { root.classList.remove("has-cursor"); });
    window.addEventListener("blur", function () { root.classList.remove("has-cursor"); });
    document.addEventListener("pointerdown", function () { root.classList.add("cursor-down"); });
    document.addEventListener("pointerup", function () { root.classList.remove("cursor-down"); });
  })();

  /* ---- Cellar gauge -------------------------------------------------------- */

  (function gauge() {
    var cellar = CONFIG.CELLAR || { depthM: 30, surfaceC: 18, cellarC: 11 };
    var header = document.querySelector(".site-header");
    var el = document.createElement("nav");
    el.className = "gauge";
    el.setAttribute("data-i18n-attr", "aria-label:gauge.label");
    el.innerHTML =
      '<span class="gauge__label" aria-hidden="true" data-i18n="gauge.label"></span>' +
      '<span class="gauge__track"><span class="gauge__fill"></span></span>' +
      '<span class="gauge__read" aria-hidden="true"><span class="gauge__depth"></span><span class="gauge__temp"></span></span>';
    document.body.appendChild(el);

    var track = el.querySelector(".gauge__track");
    var depth = el.querySelector(".gauge__depth");
    var temp = el.querySelector(".gauge__temp");
    var queued = false;
    var marks = [];       // { button, section, at } — `at` is 0 to 1 down the page
    var measured = -1;    // page height the marks were last placed for

    // Checkpoints: one small mark per section that carries data-checkpoint
    // (its value is the i18n key of the section's name). A click goes there.
    function headerOffset() {
      return header && getComputedStyle(header).position === "sticky" ? header.offsetHeight : 0;
    }

    function buildMarks() {
      var sections = document.querySelectorAll("[data-checkpoint]");
      for (var i = 0; i < sections.length; i++) {
        (function (section) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "gauge__mark";
          var name = document.createElement("span");
          name.className = "gauge__name";
          name.setAttribute("data-i18n", section.getAttribute("data-checkpoint"));
          button.appendChild(name);
          button.addEventListener("click", function () {
            window.Motion.glideTo(section); // eased, longer for a longer trip
          });
          track.appendChild(button);
          marks.push({ button: button, section: section, at: 0 });
        })(sections[i]);
      }
      if (window.I18n && window.I18n.lang) window.I18n.apply(el);
    }

    function placeMarks(range) {
      var offset = headerOffset();
      marks.forEach(function (mark) {
        var shown = mark.section.getClientRects().length > 0; // e.g. the glass section can be switched off
        mark.button.hidden = !shown;
        if (!shown) return;
        var top = mark.section.getBoundingClientRect().top + window.scrollY - offset;
        mark.at = range > 0 ? Math.min(1, Math.max(0, top / range)) : 0;
        mark.button.style.setProperty("--at", mark.at.toFixed(4));
      });
    }

    function update() {
      queued = false;
      var height = document.documentElement.scrollHeight;
      var range = height - window.innerHeight;
      if (height !== measured) { measured = height; placeMarks(range); }
      var progress = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0;
      el.style.setProperty("--progress", progress.toFixed(4));
      el.classList.toggle("is-started", progress > 0.01);
      depth.textContent = "\u2212\u00a0" + Math.round(cellar.depthM * progress) + "\u00a0m";
      temp.textContent = Math.round(cellar.surfaceC + (cellar.cellarC - cellar.surfaceC) * progress) + "\u00a0°C";

      // The checkpoint the page has reached is marked as the current one.
      var current = null;
      marks.forEach(function (mark) {
        if (!mark.button.hidden && mark.at <= progress + 0.012) current = mark;
        mark.button.removeAttribute("aria-current");
      });
      if (current) current.button.setAttribute("aria-current", "true");
    }

    function request() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    }

    function remeasure() {
      measured = -1;
      request();
    }

    buildMarks();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", remeasure);
    window.addEventListener("load", remeasure);
    document.addEventListener("i18n:change", remeasure); // text length changes the page height
    document.addEventListener("fx:change", remeasure);
    update();
  })();

  /* ---- Page tint ----------------------------------------------------------- */

  // The cuvée on screen, as last announced by main.js or bottle-ring.js
  // (<html data-cuvee>; -1 = none).
  var current = -1;

  function readCurrent() {
    var value = root.getAttribute("data-cuvee");
    current = value === null ? -1 : Number(value);
  }

  function applyTint() {
    readCurrent();
    var cuvee = CUVEES[current];
    if (fx("tint") && cuvee && cuvee.tint) {
      root.style.setProperty("--page-tint", cuvee.tint);
      root.setAttribute("data-tint", "");
    } else {
      root.removeAttribute("data-tint");
    }
  }

  document.addEventListener("cuvee:current", function () {
    applyTint();
    drawGlassOnce();
    drawChart(true);
  });
  document.addEventListener("i18n:change", function () { drawChart(false); });
  document.addEventListener("fx:change", function () {
    applyTint();
    drawGlassOnce();
  });

  applyTint();

  /* ---- Aroma chart ----------------------------------------------------------- */
  // A six-axis chart in hairlines: five rings for the scale, one outline for the
  // cuvée. Values come from config.js (`aromas`, 0 to 5), labels from the i18n
  // files ("glass.axes"). The outline glides to the new values when the cuvée changes.

  var chart = document.querySelector("[data-aroma-chart]");
  var chartValues = null, chartFrame = null;
  var NS = "http://www.w3.org/2000/svg";
  var RADIUS = 78;

  function chartPoint(axis, value) {
    var angle = -Math.PI / 2 + (axis * Math.PI * 2) / 6;
    var reach = (RADIUS * value) / 5;
    return (Math.cos(angle) * reach).toFixed(1) + "," + (Math.sin(angle) * reach).toFixed(1);
  }

  function chartOutline(values) {
    return values.map(function (value, axis) { return chartPoint(axis, value); }).join(" ");
  }

  function drawChart(glide) {
    if (!chart) return;
    readCurrent();
    var cuvee = CUVEES[current] || CUVEES[0] || {};
    var wanted = cuvee.aromas || [0, 0, 0, 0, 0, 0];

    if (!chart.firstChild) {
      var ring, axis, label;
      for (ring = 1; ring <= 5; ring++) {
        var grid = document.createElementNS(NS, "polygon");
        grid.setAttribute("class", "aroma__ring");
        grid.setAttribute("points", chartOutline([ring, ring, ring, ring, ring, ring]));
        chart.appendChild(grid);
      }
      for (axis = 0; axis < 6; axis++) {
        var spoke = document.createElementNS(NS, "line");
        var end = chartPoint(axis, 5).split(",");
        spoke.setAttribute("class", "aroma__ring");
        spoke.setAttribute("x2", end[0]);
        spoke.setAttribute("y2", end[1]);
        chart.appendChild(spoke);
        label = document.createElementNS(NS, "text");
        var at = chartPoint(axis, 6.1).split(",");
        label.setAttribute("class", "aroma__label");
        label.setAttribute("x", at[0]);
        label.setAttribute("y", Number(at[1]) + 3);
        label.setAttribute("text-anchor", Math.abs(Number(at[0])) < 5 ? "middle" : (Number(at[0]) > 0 ? "start" : "end"));
        chart.appendChild(label);
      }
      var outline = document.createElementNS(NS, "polygon");
      outline.setAttribute("class", "aroma__shape");
      chart.appendChild(outline);
    }

    var labels = chart.querySelectorAll(".aroma__label");
    for (var i = 0; i < labels.length; i++) {
      labels[i].textContent = window.I18n && window.I18n.lang ? window.I18n.t("glass.axes." + i) : "";
    }

    var shape = chart.querySelector(".aroma__shape");
    var from = chartValues || [0, 0, 0, 0, 0, 0];
    if (chartFrame) cancelAnimationFrame(chartFrame);
    if (!glide || !motionFull()) {
      chartValues = wanted.slice();
      shape.setAttribute("points", chartOutline(chartValues));
      return;
    }
    var start = performance.now();
    (function step(now) {
      var t = Math.min((now - start) / 700, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      chartValues = wanted.map(function (value, k) { return from[k] + (value - from[k]) * eased; });
      shape.setAttribute("points", chartOutline(chartValues));
      if (t < 1) chartFrame = requestAnimationFrame(step);
    })(start);
  }
  drawChart(false);

  /* ---- The glass ----------------------------------------------------------- */
  // A flute in line drawing, 200 x 520 units, on a 2D canvas.

  var glassCanvas = document.querySelector("[data-glass-canvas]");
  var glass = null;

  function drawGlassOnce() {
    if (glass) glass.draw(performance.now(), 0);
  }

  if (glassCanvas && glassCanvas.getContext) {
    var W = 200, H = 520, LEVEL = 96;
    var ctx = glassCanvas.getContext("2d");
    var bubbles = [];
    var raf = null, visible = false, last = 0;

    function bowl() {
      var path = new Path2D();
      path.moveTo(60, 36);
      path.bezierCurveTo(54, 170, 70, 262, 100, 304);
      path.bezierCurveTo(130, 262, 146, 170, 140, 36);
      return path;
    }

    // Half-width of the bowl at height y, so bubbles stay inside it.
    function halfWidth(y) {
      var t = Math.min(1, Math.max(0, (304 - y) / (304 - 36)));
      return 40 * Math.pow(t, 0.55);
    }

    function wanted() {
      var value = root.getAttribute("data-bubbles");
      var count = value === null ? (CONFIG.BUBBLES_PER_BOTTLE || 24) : Number(value);
      return Math.max(0, Math.min(160, isNaN(count) ? 24 : count));
    }

    function spawn(bubble, anywhere) {
      // Most bubbles leave from the point of the bowl, as from a real flute.
      bubble.y = anywhere ? LEVEL + Math.random() * (300 - LEVEL) : 300;
      bubble.offset = (Math.random() - 0.5) * (Math.random() < 0.6 ? 0.25 : 1.6);
      bubble.speed = 34 + Math.random() * 46;
      bubble.r = 0.9 + Math.random() * 1.7;
      bubble.phase = Math.random() * 6.28;
      return bubble;
    }

    glass = {
      draw: function (now, dt) {
        var ratio = Math.min(window.devicePixelRatio || 1, 2);
        var width = glassCanvas.clientWidth, height = glassCanvas.clientHeight;
        if (!width || !height) return;
        if (glassCanvas.width !== Math.round(width * ratio)) {
          glassCanvas.width = Math.round(width * ratio);
          glassCanvas.height = Math.round(height * ratio);
        }
        var scale = Math.min(glassCanvas.width / W, glassCanvas.height / H);
        ctx.setTransform(scale, 0, 0, scale, (glassCanvas.width - W * scale) / 2, (glassCanvas.height - H * scale) / 2);
        ctx.clearRect(-W, -H, W * 3, H * 3);

        var style = getComputedStyle(glassCanvas);
        var line = style.color;
        var cuvee = CUVEES[current] || CUVEES[0] || {};
        var wine = cuvee.tint || style.getPropertyValue("--accent");
        var shape = bowl();

        // The wine, then its bubbles, both kept inside the bowl.
        ctx.save();
        ctx.clip(shape);
        ctx.globalAlpha = cuvee.soon ? 0.12 : 0.34;
        ctx.fillStyle = wine;
        ctx.fillRect(0, LEVEL, W, H);
        ctx.globalAlpha = 1;

        var count = cuvee.soon ? 0 : wanted();
        while (bubbles.length < count) bubbles.push(spawn({}, true));
        bubbles.length = count;
        ctx.strokeStyle = line;
        ctx.lineWidth = 0.8;
        for (var i = 0; i < bubbles.length; i++) {
          var b = bubbles[i];
          b.y -= b.speed * dt;
          if (b.y < LEVEL) spawn(b, false);
          var x = 100 + b.offset * halfWidth(b.y) * 0.5 + Math.sin(now / 700 + b.phase) * 1.5;
          ctx.globalAlpha = 0.25 + 0.5 * ((300 - b.y) / (300 - LEVEL));
          ctx.beginPath();
          ctx.arc(x, b.y, b.r, 0, 6.2832);
          ctx.stroke();
        }
        ctx.restore();

        // The glass itself: bowl, surface of the wine, stem, foot.
        ctx.strokeStyle = line;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 1;
        ctx.stroke(shape);
        ctx.beginPath();
        ctx.moveTo(100, 304);
        ctx.lineTo(100, 452);
        ctx.moveTo(58, 456);
        ctx.quadraticCurveTo(100, 444, 142, 456);
        ctx.stroke();
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.ellipse(100, LEVEL, halfWidth(LEVEL) - 1, 3, 0, 0, 6.2832);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };

    function tick(now) {
      raf = requestAnimationFrame(tick);
      var dt = Math.max(0, Math.min((now - last) / 1000, 0.1));
      last = now;
      glass.draw(now, dt);
    }

    function update() {
      var run = visible && fx("glass") && motionFull() && !document.hidden;
      if (run && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      if (!run) glass.draw(performance.now(), 0); // a still picture
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        update();
      }).observe(glassCanvas);
    }
    ["motion:change", "fx:change", "theme:change", "visibilitychange"].forEach(function (type) {
      document.addEventListener(type, update);
    });
    window.addEventListener("resize", drawGlassOnce);
  }
})();
