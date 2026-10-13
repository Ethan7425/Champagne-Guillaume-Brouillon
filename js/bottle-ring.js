/*
 * bottle-ring.js — TEST PAGE (selection.html).
 *
 * The bottles stand in a ring on a stage that stays pinned to the screen while
 * the page scrolls. The cuvée at the front is the selected one. Scrolling does
 * not move the bottle away: it moves the camera.
 *
 *   screen 1  the ring: pick a cuvée (arrows, I–IV, left/right keys, drag, click)
 *   screen 2  the other bottles step back, the chosen one slides aside for its sheet
 *   screen 3  close-up of the top of the bottle
 *   screen 4  close-up of the label
 *
 * Each screen has a camera "pose" (POSES below); between two screens the
 * camera glides from one pose to the next. The text of the page (name, notes,
 * order link) follows the selection.
 *
 * Uses the same model files and the same lazy Three.js loader as bottle-3d.js.
 * Without WebGL, with reduced motion, or opened by double-click, the stage
 * shows the placeholder image; selecting still works.
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
  var RING_ZONE = 0.35;     // how far toward the next screen the ring still counts as "on the ring" (0–1)
  var FOLLOW = 5.5;         // how briskly things reach their place (per second; lower = slower)

  /*
   * One pose per screen. `wide` is for the wide-screen layout, where the stage
   * fills the screen and the text is laid over its left side. `window` is for
   * phones and tablets, where the stage is a window at the top of the screen
   * with nothing over it: the subject stays in the middle and fills the window.
   *   focus   0 = look at the middle of the ring, 1 = look at the chosen bottle
   *   look    height looked at, as a share of the bottle (0 base, 1 top)
   *   view    how much height the camera takes in, in bottle heights (0 = fit the ring)
   *   pitch   how far above the camera sits, in radians
   *   right   where the subject sits on screen: +0.2 = a fifth of the width to the right
   *   up      same, vertically
   *   turn    extra turn of the chosen bottle, in radians
   *   solo    0 = all bottles shown, 1 = only the chosen one
   */
  var POSES = {
    wide: [
      { focus: 0, look: 0.5, view: 0, pitch: 0.3, right: 0, up: 0.14, turn: 0, solo: 0 },
      { focus: 1, look: 0.5, view: 1.45, pitch: 0.06, right: 0.2, up: 0, turn: -0.4, solo: 1 },
      { focus: 1, look: 0.86, view: 0.46, pitch: 0.14, right: 0.2, up: 0, turn: 0.55, solo: 1 },
      { focus: 1, look: 0.3, view: 0.56, pitch: 0, right: 0.2, up: 0, turn: -0.5, solo: 1 }
    ],
    // Phone layout A: the stage is a window at the top, nothing over it.
    window: [
      { focus: 0, look: 0.5, view: 0, pitch: 0.24, right: 0, up: 0, turn: 0, solo: 0 },
      { focus: 1, look: 0.5, view: 1.38, pitch: 0.05, right: 0, up: 0, turn: -0.35, solo: 1 },
      { focus: 1, look: 0.84, view: 0.44, pitch: 0.12, right: 0, up: 0, turn: 0.5, solo: 1 },
      { focus: 1, look: 0.3, view: 0.5, pitch: 0, right: 0, up: 0, turn: -0.45, solo: 1 }
    ],
    // Phone layout B: the stage fills the screen, the text sits over its lower
    // third, so the subject keeps to the upper part.
    fade: [
      { focus: 0, look: 0.5, view: 0, pitch: 0.3, right: 0, up: 0.17, turn: 0, solo: 0 },
      { focus: 1, look: 0.5, view: 2.5, pitch: 0.06, right: 0, up: 0.27, turn: -0.3, solo: 1 },
      { focus: 1, look: 0.84, view: 0.9, pitch: 0.12, right: 0, up: 0.19, turn: 0.5, solo: 1 },
      { focus: 1, look: 0.32, view: 1.05, pitch: 0, right: 0, up: 0.19, turn: -0.45, solo: 1 }
    ],
    // Phone layout C: the stage is a tall narrow column. One bottle at a time:
    // the chosen one, standing the height of the rail.
    rail: [
      { focus: 1, look: 0.5, view: 2.1, pitch: 0.05, right: 0, up: 0.13, turn: 0, solo: 1 },
      { focus: 1, look: 0.5, view: 1.9, pitch: 0.05, right: 0, up: 0.04, turn: -0.5, solo: 1 },
      { focus: 1, look: 0.82, view: 0.9, pitch: 0.12, right: 0, up: 0.04, turn: 0.5, solo: 1 },
      { focus: 1, look: 0.3, view: 1.5, pitch: 0, right: 0, up: 0.04, turn: -0.45, solo: 1 }
    ]
  };
  var POSE_KEYS = ["focus", "look", "view", "pitch", "right", "up", "turn", "solo"];

  var stage = root.querySelector("[data-ring-stage]");
  var picker = root.querySelector("[data-ring-picker]");
  var screens = root.querySelectorAll("[data-ring-screen]");
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
      // shop.js decides where the button leads. An unreleased cuvée has no link:
      // the button becomes a notice.
      window.Shop.wire(nodes[i], selected);
      nodes[i].classList.toggle("is-soon", !!CUVEES[selected].soon);
    }
    nodes = picker.querySelectorAll("button");
    for (i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute("aria-pressed", String(i === selected));
    }

    if (window.I18n && window.I18n.lang) window.I18n.apply(document);
    if (onSelect) onSelect(selected);
    // Other scripts (page tint, the glass) follow the chosen cuvée.
    document.documentElement.setAttribute("data-cuvee", selected);
    document.dispatchEvent(new CustomEvent("cuvee:current", { detail: { index: selected } }));
  }

  // The cuvée can only be changed on the ring itself, at the top of the page.
  // Once the visitor has scrolled into a cuvée's sheet, close-ups or photos,
  // that cuvée stays: to pick another one, they go back up to the ring.
  function onRingScreen() {
    return scrollProgress() < RING_ZONE;
  }

  function choose(index) {
    if (onRingScreen()) select(index);
  }

  CUVEES.forEach(function (cuvee, index) {
    var button = document.createElement("button");
    button.type = "button";
    var number = document.createElement("span");
    number.className = "ring__switch-n";
    number.textContent = ROMAN[index] || String(index + 1);
    var name = document.createElement("span");
    name.className = "ring__switch-name";
    name.setAttribute("data-i18n", "cuvees." + index + ".name");
    button.appendChild(number);
    button.appendChild(name);
    button.addEventListener("click", function () { choose(index); });
    picker.appendChild(button);
  });

  root.querySelector("[data-ring-prev]").addEventListener("click", function () { choose(selected - 1); });
  root.querySelector("[data-ring-next]").addEventListener("click", function () { choose(selected + 1); });

  document.addEventListener("keydown", function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (document.documentElement.classList.contains("is-gated")) return;
    if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    // In the photo strip the arrow keys move the strip, as they would in any scrolling row.
    if (event.target && event.target.closest && event.target.closest("[data-photo-strip]")) return;
    if (event.key === "ArrowLeft") choose(selected - 1);
    else if (event.key === "ArrowRight") choose(selected + 1);
  });

  // Runs before i18n starts, so the first paint already has the right keys.
  select(0);

  // The mobile order bar is always shown on this page.
  if (document.querySelector("[data-ring-buybar]")) document.documentElement.classList.add("has-buybar");

  // Photo strip: the arrows move it by one plate.
  (function photoStrip() {
    var strip = document.querySelector("[data-photo-strip]");
    if (!strip) return;
    function move(direction) {
      var plate = strip.querySelector(".photo");
      var step = plate ? plate.getBoundingClientRect().width + parseFloat(getComputedStyle(strip).columnGap || 0) : 300;
      strip.scrollBy({ left: direction * step, behavior: "smooth" });
    }
    document.querySelector("[data-photo-prev]").addEventListener("click", function () { move(-1); });
    document.querySelector("[data-photo-next]").addEventListener("click", function () { move(1); });
  })();

  function setStatus(text) {
    if (window.Bottle3D) window.Bottle3D.ringStatus = text;
  }

  /* ---- How far down the screens the page is ---------------------------------- */
  // 0 on the ring, 1 on the sheet, 2 and 3 on the close-ups, with every value in between.

  // Which layout is showing: "wide" on wide screens, else the phone layout
  // chosen in config.js or the test panel ("window", "fade" or "rail").
  var wideScreen = window.matchMedia ? window.matchMedia("(min-width: 60em)") : { matches: true };

  function layout() {
    if (wideScreen.matches) return "wide";
    var chosen = document.documentElement.getAttribute("data-mlayout");
    return POSES[chosen] ? chosen : "window";
  }

  // In the bottle-window layout the screens rest under the stage, not on top of it.
  function windowed() {
    return (parseFloat(getComputedStyle(screens[0]).scrollMarginTop) || 0) > 0;
  }

  // Layout "fade": the text of each screen stays put at the bottom of the
  // display and fades in as its screen arrives, out as it leaves. Each screen
  // gets --cap (0 to 1) for its text's opacity; CSS does the rest.
  var captionsQueued = false;

  function updateCaptions() {
    captionsQueued = false;
    var fading = layout() === "fade";
    var progress = fading ? scrollProgress() : 0;
    // Past the last screen the stage scrolls away, and the text with it.
    var leaving = fading ? Math.max(0, Math.min(1, (stage.getBoundingClientRect().bottom - window.innerHeight * 0.6) / (window.innerHeight * 0.25))) : 0;
    for (var i = 0; i < screens.length; i++) {
      var shown = fading ? Math.max(0, Math.min(1, 1 - Math.abs(progress - i) * 2.3)) * leaving : 0;
      screens[i].style.setProperty("--cap", shown.toFixed(3));
      screens[i].classList.toggle("is-on", shown > 0.5);
    }
  }

  function queueCaptions() {
    if (captionsQueued) return;
    captionsQueued = true;
    requestAnimationFrame(updateCaptions);
  }

  window.addEventListener("scroll", queueCaptions, { passive: true });
  window.addEventListener("resize", queueCaptions);
  window.addEventListener("load", queueCaptions);
  document.addEventListener("mlayout:change", queueCaptions);
  document.addEventListener("i18n:change", queueCaptions);

  function scrollProgress() {
    var pinned = stage.getBoundingClientRect();
    var line = windowed() ? pinned.bottom : pinned.top; // where a screen's top rests
    var tops = [];
    for (var i = 0; i < screens.length; i++) tops.push(screens[i].getBoundingClientRect().top - line);
    if (tops[0] > 0) return 0;
    for (var k = tops.length - 1; k >= 0; k--) {
      if (tops[k] <= 0) {
        if (k === tops.length - 1) return k;
        return k + (-tops[k]) / (tops[k + 1] - tops[k]);
      }
    }
    return 0;
  }

  function poseAt(progress, set) {
    var from = Math.min(Math.floor(progress), set.length - 1);
    var to = Math.min(from + 1, set.length - 1);
    var t = progress - from;
    t = t * t * (3 - 2 * t); // ease in and out between two screens
    var pose = {};
    POSE_KEYS.forEach(function (key) { pose[key] = set[from][key] + (set[to][key] - set[from][key]) * t; });
    return pose;
  }

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
    var key = Bottle3D.lights(THREE, scene);
    var hovered = -1; // bottle under the pointer (feature "hover")
    var aim = new THREE.Vector2(); // where the pointer is on the canvas, -1 to 1
    var HOVER_TURN = 0.42;  // radians: how far a bottle turns to face the pointer
    var HOVER_ROLL = 0.07;  // radians: how far it leans sideways toward it
    var HOVER_PITCH = 0.045; // radians: and forward or back

    var camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
    var UP = new THREE.Vector3(0, 1, 0);
    var ring = new THREE.Group();
    scene.add(ring);
    // Coloured light for the chosen cuvée (feature "tint").
    var hue = Bottle3D.hue(THREE, scene, camera, key);
    var hueColors = CUVEES.map(function (cuvee) { return cuvee.tint ? Bottle3D.toRgb(cuvee.tint) : null; });
    // The lamp that follows the pointer (feature "light").
    var lamp = Bottle3D.lamp(THREE, scene);

    // One holder per cuvée, standing on the ring and facing outwards.
    var holders = [];
    var fizz = [];
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

      if (model.mystery) { Bottle3D.disguise(THREE, object); return; }
      Bottle3D.seeThrough(object, model);
      fizz.push(Bottle3D.bubbles(THREE, holder, {
        radius: Math.min(size.x, size.z) * 0.27,
        bottom: size.y * 0.07,
        top: size.y * 0.6,
        height: size.y
      }));
    });

    var radius = widest * SPACING;
    holders.forEach(function (holder, index) {
      holder.position.set(Math.sin(index * STEP) * radius, 0, Math.cos(index * STEP) * radius);
    });
    var ringDistance = 1; // camera distance that fits the whole ring; set in resize()
    var mode = "wide";    // the layout in use: wide, window, fade or rail

    function resize() {
      var width = stage.clientWidth, height = stage.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      mode = layout();
      var vertical = THREE.MathUtils.degToRad(camera.fov / 2);
      var horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
      var halfWidth = radius + widest * FRONT_SCALE;
      var halfHeight = (tallest * FRONT_SCALE) / 2 + radius * Math.sin(POSES.wide[0].pitch);
      // Wide layout: the ring keeps to the upper part of the stage, the title sits
      // under it. Bottle window: the ring has the whole window to itself.
      ringDistance = Math.max(halfHeight / Math.tan(vertical) * (mode === "window" ? 1.1 : 1.5), halfWidth / Math.tan(horizontal) * 1.08);
      dirty = true;
    }

    // Turning: `goal` is the ring angle that puts the selected bottle in front.
    var angle = 0, goal = 0, drag = 0, dirty = true, raf = null, visible = true, last = 0;
    var lookAt = new THREE.Vector3(); // what the camera is looking at, for the lamp
    var now = null; // the pose currently shown, eased toward the pose the scroll asks for
    var progress = 0;

    var lastChosen = selected;

    onSelect = function (index) {
      lastChosen = index;
      var wanted = -index * STEP;
      var delta = wanted - goal;
      delta -= Math.round(delta / (Math.PI * 2)) * Math.PI * 2; // shortest way round
      goal += delta;
    };

    function applyPose(pose) {
      var vertical = THREE.MathUtils.degToRad(camera.fov / 2);
      var distance = pose.view > 0.001
        ? ringDistance + (((pose.view * tallest) / 2) / Math.tan(vertical) - ringDistance) * Math.min(1, pose.focus)
        : ringDistance;
      var viewHeight = 2 * distance * Math.tan(vertical);
      var viewWidth = viewHeight * camera.aspect;

      // What the camera looks at, then slid sideways/up so the subject sits off-centre.
      var scale = 1 + (FRONT_SCALE - 1) * pose.focus;
      var target = new THREE.Vector3(
        -pose.right * viewWidth,
        pose.look * tallest * scale - pose.up * viewHeight,
        radius * pose.focus
      );
      camera.position.set(target.x, target.y + Math.sin(pose.pitch) * distance, target.z + Math.cos(pose.pitch) * distance);
      camera.lookAt(target);
      lookAt.copy(target);
      // The colour pool sits behind the subject, wherever the pose puts it on screen.
      var pool = Math.min(viewWidth, viewHeight) * 1.35;
      hue.place(pose.right * viewWidth * 3, pose.up * viewHeight * 3, pool * 3, pool * 3, distance * 3);

      camera.updateMatrixWorld();
      ring.updateMatrixWorld(true);
      for (var i = 0; i < holders.length; i++) {
        var chosen = i === selected;
        var wanted = chosen ? FRONT_SCALE : 1 - pose.solo;
        var holder = holders[i];
        holder.userData.scale = holder.userData.scale === undefined ? wanted : holder.userData.scale + (wanted - holder.userData.scale) * pose.ease;
        holder.scale.setScalar(Math.max(holder.userData.scale, 0.0001));
        holder.visible = holder.userData.scale > 0.02;

        // Hover: the bottle under the pointer leans toward it, pivoting on its base.
        // The lean is worked out on screen: where the pointer is, measured from the
        // bottle's own middle (-1 to 1 across its width and its height).
        var roll = 0, pitch = 0, yaw = 0;
        if (i === hovered && holder.visible) {
          var middle = holder.getWorldPosition(new THREE.Vector3());
          middle.y += tallest * 0.5 * holder.scale.y;
          var edge = middle.clone();
          edge.y += tallest * 0.5 * holder.scale.y;
          middle.project(camera);
          edge.project(camera);
          var half = Math.max(edge.y - middle.y, 0.01); // half the bottle's height on screen
          var across = Math.max(-1, Math.min(1, (aim.x - middle.x) / (half * 0.45)));
          var along = Math.max(-1, Math.min(1, (aim.y - middle.y) / half));
          // Mostly a turn of the head toward the pointer, with a slight lean the same way.
          yaw = across * HOVER_TURN;
          roll = across * -HOVER_ROLL;
          pitch = along * HOVER_PITCH;
        }
        holder.userData.yaw = (holder.userData.yaw || 0) + (yaw - (holder.userData.yaw || 0)) * pose.ease;
        holder.userData.roll = (holder.userData.roll || 0) + (roll - (holder.userData.roll || 0)) * pose.ease;
        holder.userData.pitch = (holder.userData.pitch || 0) + (pitch - (holder.userData.pitch || 0)) * pose.ease;
        // Facing outward on the ring, then leaned as seen from the camera
        // (the lean is undone and redone around the ring's own turn).
        var facing = new THREE.Quaternion().setFromAxisAngle(UP, i * STEP + (chosen ? pose.turn : 0) + holder.userData.yaw);
        var turned = new THREE.Quaternion().setFromAxisAngle(UP, ring.rotation.y);
        var lean = new THREE.Quaternion().setFromEuler(new THREE.Euler(holder.userData.pitch, 0, holder.userData.roll));
        holder.quaternion.copy(turned).invert().multiply(lean).multiply(turned).multiply(facing);
      }
    }

    function tick(time) {
      raf = requestAnimationFrame(tick);
      // Time-based easing, so everything moves at the same speed on any screen.
      // Never negative: the first frame can carry a timestamp older than `last`.
      var dt = Math.max(0, Math.min((time - last) / 1000, 0.1));
      var ease = 1 - Math.exp(-dt * FOLLOW);
      last = time;

      progress = scrollProgress();
      var wanted = poseAt(progress, POSES[mode]);
      var moving = Math.abs(goal - angle) > 0.0005;
      if (!now) { now = wanted; moving = true; }
      POSE_KEYS.forEach(function (key) {
        if (Math.abs(wanted[key] - now[key]) > 0.0005) moving = true;
        now[key] += (wanted[key] - now[key]) * ease;
      });
      for (var h = 0; h < holders.length; h++) {
        var leaning = Math.abs(holders[h].userData.roll || 0) + Math.abs(holders[h].userData.pitch || 0) + Math.abs(holders[h].userData.yaw || 0);
        if (h === hovered || leaning > 0.001) moving = true;
      }
      if (Bottle3D.aimLamp(THREE, lamp, camera, canvas.getBoundingClientRect(), camera.position.distanceTo(lookAt), tallest, ease)) moving = true;
      if (hue.step(Bottle3D.fx("tint") ? hueColors[selected] : null, ease)) moving = true;
      var bubbling = fizz.length && fizz[0].count > 0;
      if (!moving && !dirty && !bubbling) return;

      angle += (goal - angle) * ease;
      ring.rotation.y = angle + drag;
      now.ease = ease;
      applyPose(now);
      if (bubbling) fizz.forEach(function (system) { system.update(dt, time); });
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

    /* Pointer: drag to turn, click a bottle to bring it to the front.
       Only on the ring screen: further down, the bottle is no longer a control. */
    var canvas = renderer.domElement;
    var pointer = { id: null, startX: 0, dragging: false };
    var raycaster = new THREE.Raycaster();

    function onRing() {
      return progress < RING_ZONE;
    }

    function bottleAt(event) {
      var rect = canvas.getBoundingClientRect();
      var point = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(point, camera);
      var hits = raycaster.intersectObjects(holders.filter(function (holder) { return holder.visible; }), true);
      for (var h = 0; h < hits.length; h++) {
        if (hits[h].object.isPoints) continue; // bubbles are not clickable
        var node = hits[h].object;
        while (node && holders.indexOf(node) === -1) node = node.parent;
        return holders.indexOf(node);
      }
      return -1;
    }

    canvas.addEventListener("pointerdown", function (event) {
      if (!onRing()) return;
      pointer.id = event.pointerId;
      pointer.startX = event.clientX;
      pointer.dragging = false;
    });

    canvas.addEventListener("pointermove", function (event) {
      if (pointer.id !== event.pointerId) {
        if (event.pointerType === "mouse") {
          var under = onRing() ? bottleAt(event) : -1;
          canvas.style.cursor = !onRing() ? "default" : (under === -1 ? "grab" : "pointer");
          hovered = Bottle3D.fx("hover") ? under : -1;
          var area = canvas.getBoundingClientRect();
          aim.set(((event.clientX - area.left) / area.width) * 2 - 1, -(((event.clientY - area.top) / area.height) * 2 - 1));
        }
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
        select(Math.round(-angle / STEP)); // a drag can only start on the ring (see pointerdown)
      } else if (event.type === "pointerup") {
        var index = bottleAt(event);
        if (index === selected) {
          window.Motion.glideTo(document.getElementById("details"));
        } else if (index !== -1) {
          select(index);
        }
      }
      pointer.dragging = false;
    }
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", function () { hovered = -1; });
    document.addEventListener("fx:change", function () { dirty = true; });
    document.addEventListener("mlayout:change", function () { now = null; resize(); });

    stage.appendChild(canvas);
    stage.classList.add("is-live");
    resize();
    onSelect(selected);
    angle = goal; // no opening spin

    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(root);
    }
    document.addEventListener("theme:change", function () {
      scene.background.set(Bottle3D.pageColor());
      hue.repage();
      dirty = true;
    });
    document.addEventListener("bubbles:change", function () { dirty = true; });
    document.addEventListener("motion:change", function () {
      var on = Bottle3D.motionAllows();
      stage.classList.toggle("is-live", on);
      setStatus(on ? "live" : Bottle3D.blocker());
      if (on) start(); else stop();
    });
    canvas.addEventListener("webglcontextlost", function (event) {
      event.preventDefault();
      stop();
      stage.classList.remove("is-live");
      setStatus("failed: the WebGL context was lost");
      console.warn("[3d] ring: the WebGL context was lost. Showing the placeholder image.");
    });

    start();
    setStatus("live");
    console.info("[3d] ring ready:", holders.length, "bottles");
  }

  var started = false;

  function start3d() {
    var Bottle3D = window.Bottle3D;
    if (started || !Bottle3D) return;
    if (location.protocol === "file:") {
      console.info("[3d] The ring needs a local server (npx serve). Showing the placeholder image.");
      setStatus("off: page opened by double-click; 3D needs a server");
      return;
    }
    var reason = Bottle3D.blocker();
    if (reason) { setStatus(reason); return; }
    started = true;
    setStatus("loading");

    Bottle3D.libraries().then(function (lib) {
      return Promise.all(CUVEES.map(function (cuvee) {
        var model = MODELS[cuvee.id];
        return model && model.src ? Bottle3D.file(lib, model.src) : null;
      })).then(function (gltfs) { buildRing(lib, gltfs); });
    }).catch(function (error) {
      setStatus("failed: " + ((error && error.message) || "network error"));
      console.warn("[3d] ring: could not load (" + ((error && error.message) || "network error") + "). Showing the placeholder image.");
    });
  }

  // Start once the page text is in and motion.js has settled the motion level.
  document.addEventListener("motion:change", start3d);
  document.addEventListener("i18n:change", function () { setTimeout(start3d, 0); });
})();
