/*
 * bottle-ring.js — TEST PAGE (selection.html): the bottles stand in a ring.
 *
 * The cuvée at the front is the selected one. It can be changed with the
 * arrows, the I–IV buttons, the left/right keys, by dragging the ring, or by
 * clicking a bottle. The text of the page (name, details, order link) follows
 * the selection. Clicking the bottle already in front scrolls to its details.
 *
 * Uses the same model files and the same lazy Three.js loader as bottle-3d.js.
 * Without WebGL, with reduced motion, or opened by double-click, the ring is
 * replaced by the placeholder image; selecting still works.
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-ring]");
  if (!root) return;

  var CONFIG = window.SITE_CONFIG || {};
  var CUVEES = CONFIG.CUVEES || [];
  var MODELS = CONFIG.MODELS || {};
  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
  var COUNT = CUVEES.length;
  var STEP = (Math.PI * 2) / COUNT;

  var SPACING = 2.5;        // ring radius, in bottle widths
  var FRONT_SCALE = 1.16;   // the selected bottle stands a little larger
  var FOLLOW = 5.5;         // how briskly the ring reaches its place (per second; lower = slower)
  var CAMERA_PITCH = 0.3;   // radians: how far above the ring the camera looks from

  var stage = root.querySelector("[data-ring-stage]");
  var picker = root.querySelector("[data-ring-picker]");
  var numeral = root.querySelector("[data-ring-numeral]");
  var selected = 0;
  var onSelect = null; // set once the 3D ring exists

  /* ---- Selection (works with or without 3D) -------------------------------- */

  function wrap(index) {
    return ((index % COUNT) + COUNT) % COUNT;
  }

  function select(index) {
    selected = wrap(index);
    var i, nodes;

    nodes = document.querySelectorAll("[data-ring-key]");
    for (i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute("data-i18n", nodes[i].getAttribute("data-ring-key").replace(/\{i\}/g, selected));
    }
    nodes = document.querySelectorAll("[data-ring-attr]");
    for (i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute("data-i18n-attr", nodes[i].getAttribute("data-ring-attr").replace(/\{i\}/g, selected));
    }
    nodes = document.querySelectorAll("[data-ring-shop]");
    for (i = 0; i < nodes.length; i++) {
      nodes[i].href = (CONFIG.SHOPIFY_BASE_URL || "#") + CUVEES[selected].slug;
    }
    nodes = picker.querySelectorAll("button");
    for (i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute("aria-pressed", String(i === selected));
    }
    numeral.textContent = ROMAN[selected] || String(selected + 1);

    if (window.I18n && window.I18n.lang) window.I18n.apply(document);
    if (onSelect) onSelect(selected);
  }

  CUVEES.forEach(function (cuvee, index) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = ROMAN[index] || String(index + 1);
    button.setAttribute("data-i18n-attr", "aria-label:cuvees." + index + ".name");
    button.addEventListener("click", function () { select(index); });
    picker.appendChild(button);
  });

  root.querySelector("[data-ring-prev]").addEventListener("click", function () { select(selected - 1); });
  root.querySelector("[data-ring-next]").addEventListener("click", function () { select(selected + 1); });

  document.addEventListener("keydown", function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (document.documentElement.classList.contains("is-gated")) return;
    if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (event.key === "ArrowLeft") select(selected - 1);
    else if (event.key === "ArrowRight") select(selected + 1);
  });

  // Runs before i18n starts, so the first paint already has the right keys.
  select(0);

  /* ---- The 3D ring ---------------------------------------------------------- */

  function buildRing(lib, gltfs) {
    var THREE = lib.THREE;
    var Bottle3D = window.Bottle3D;

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(Bottle3D.pageColor());
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new lib.RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    pmrem.dispose();
    Bottle3D.lights(THREE, scene);

    var camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
    var ring = new THREE.Group();
    scene.add(ring);

    // One holder per cuvée, standing on the ring and facing outwards.
    var holders = [];
    var tallest = 0, widest = 0;
    CUVEES.forEach(function (cuvee, index) {
      var model = MODELS[cuvee.id];
      var gltf = gltfs[index];
      var holder = new THREE.Group();
      holders.push(holder);
      ring.add(holder);
      if (!model || !gltf) return;

      var source = model.node ? gltf.scene.getObjectByName(model.node) : gltf.scene;
      if (!source) return;
      var object = source.clone(true);
      holder.add(object);
      holder.updateMatrixWorld(true);
      var box = new THREE.Box3().setFromObject(object);
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());
      // Centred on its own axis, base on the floor.
      object.position.x -= center.x;
      object.position.z -= center.z;
      object.position.y -= box.min.y;
      tallest = Math.max(tallest, size.y);
      widest = Math.max(widest, size.x, size.z);
    });

    var radius = widest * SPACING;
    holders.forEach(function (holder, index) {
      var angle = index * STEP;
      holder.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
      holder.rotation.y = angle;
    });

    function frameCamera() {
      var width = stage.clientWidth, height = stage.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      var vertical = THREE.MathUtils.degToRad(camera.fov / 2);
      var horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
      var halfWidth = radius + widest * FRONT_SCALE;
      var halfHeight = (tallest * FRONT_SCALE) / 2 + radius * Math.sin(CAMERA_PITCH);
      var distance = Math.max(halfHeight / Math.tan(vertical), halfWidth / Math.tan(horizontal)) * 1.06;
      var target = new THREE.Vector3(0, tallest * 0.5, 0);
      camera.position.set(0, target.y + Math.sin(CAMERA_PITCH) * distance, Math.cos(CAMERA_PITCH) * distance);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      dirty = true;
    }

    // Turning: `goal` is the ring angle that puts the selected bottle in front.
    var angle = 0, goal = 0, drag = 0, dirty = true, raf = null, visible = true, last = 0;

    onSelect = function (index) {
      var wanted = -index * STEP;
      var delta = wanted - goal;
      delta -= Math.round(delta / (Math.PI * 2)) * Math.PI * 2; // shortest way round
      goal += delta;
    };

    function tick(now) {
      raf = requestAnimationFrame(tick);
      // Time-based easing, so the ring turns at the same speed on any screen.
      var ease = 1 - Math.exp(-Math.min((now - last) / 1000, 0.1) * FOLLOW);
      last = now;
      var settled = Math.abs(goal - angle) < 0.0005;
      var scaling = false;
      for (var i = 0; i < holders.length; i++) {
        var wantedScale = i === selected ? FRONT_SCALE : 1;
        var scale = holders[i].scale.x;
        if (Math.abs(wantedScale - scale) > 0.001) {
          holders[i].scale.setScalar(scale + (wantedScale - scale) * ease);
          scaling = true;
        }
      }
      if (settled && !scaling && !dirty) return;
      angle += (goal - angle) * ease;
      ring.rotation.y = angle + drag;
      dirty = false;
      renderer.render(scene, camera);
    }

    function start() {
      if (raf || !visible || !Bottle3D.motionAllows()) return;
      dirty = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    /* Pointer: drag to turn, click a bottle to bring it to the front. */
    var canvas = renderer.domElement;
    var pointer = { id: null, startX: 0, dragging: false };
    var raycaster = new THREE.Raycaster();

    function bottleAt(event) {
      var rect = canvas.getBoundingClientRect();
      var point = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(point, camera);
      var hits = raycaster.intersectObjects(holders, true);
      if (!hits.length) return -1;
      var node = hits[0].object;
      while (node && holders.indexOf(node) === -1) node = node.parent;
      return holders.indexOf(node);
    }

    canvas.addEventListener("pointerdown", function (event) {
      pointer.id = event.pointerId;
      pointer.startX = event.clientX;
      pointer.dragging = false;
    });

    canvas.addEventListener("pointermove", function (event) {
      if (pointer.id !== event.pointerId) {
        if (event.pointerType === "mouse") canvas.style.cursor = bottleAt(event) === -1 ? "grab" : "pointer";
        return;
      }
      var dx = event.clientX - pointer.startX;
      if (!pointer.dragging && Math.abs(dx) > 6) {
        pointer.dragging = true;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "grabbing";
      }
      if (pointer.dragging) {
        drag = (dx / canvas.clientWidth) * Math.PI;
        dirty = true;
      }
    });

    function release(event) {
      if (pointer.id !== event.pointerId) return;
      pointer.id = null;
      canvas.style.cursor = "grab";
      if (pointer.dragging) {
        // Keep the ring where it was dropped, then settle on the nearest bottle.
        angle += drag;
        drag = 0;
        goal = angle;
        select(Math.round(-angle / STEP));
      } else if (event.type === "pointerup") {
        var index = bottleAt(event);
        if (index === selected) {
          document.getElementById("details").scrollIntoView();
        } else if (index !== -1) {
          select(index);
        }
      }
      pointer.dragging = false;
    }
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    stage.appendChild(canvas);
    stage.classList.add("is-live");
    frameCamera();
    onSelect(selected);
    angle = goal; // no opening spin

    if ("ResizeObserver" in window) new ResizeObserver(frameCamera).observe(stage);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(stage);
    }
    document.addEventListener("theme:change", function () {
      scene.background.set(Bottle3D.pageColor());
      dirty = true;
    });
    document.addEventListener("motion:change", function () {
      var on = Bottle3D.motionAllows();
      stage.classList.toggle("is-live", on);
      if (on) start(); else stop();
    });
    canvas.addEventListener("webglcontextlost", function (event) {
      event.preventDefault();
      stop();
      stage.classList.remove("is-live");
      console.warn("[3d] ring: the WebGL context was lost. Showing the placeholder image.");
    });

    start();
    console.info("[3d] ring ready:", holders.length, "bottles");
  }

  var started = false;

  function start3d() {
    var Bottle3D = window.Bottle3D;
    if (started || !Bottle3D) return;
    if (location.protocol === "file:") {
      console.info("[3d] The ring needs a local server (npx serve). Showing the placeholder image.");
      return;
    }
    if (!Bottle3D.motionAllows() || !Bottle3D.hasWebGL()) return;
    started = true;

    Bottle3D.libraries().then(function (lib) {
      return Promise.all(CUVEES.map(function (cuvee) {
        var model = MODELS[cuvee.id];
        return model && model.src ? Bottle3D.file(lib, model.src) : null;
      })).then(function (gltfs) { buildRing(lib, gltfs); });
    }).catch(function (error) {
      console.warn("[3d] ring: could not load (" + ((error && error.message) || "network error") + "). Showing the placeholder image.");
    });
  }

  // Start once the page text is in and motion.js has settled the motion level.
  document.addEventListener("motion:change", start3d);
  document.addEventListener("i18n:change", function () { setTimeout(start3d, 0); });
})();
