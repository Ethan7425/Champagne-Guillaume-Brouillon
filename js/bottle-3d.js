/*
 * bottle-3d.js — PROTOTYPE TEST: 3D bottles inside the cuvée .bottle-stage containers.
 *
 * Which cuvée gets which model is set in config.js (SITE_CONFIG.MODELS).
 * Three.js and its GLTFLoader are NOT loaded with the page: they are imported
 * the first time a configured stage scrolls into view. The pinned version
 * lives in the import map in index.html.
 *
 * One WebGL renderer is shared by every stage: each stage owns a plain 2D
 * canvas and the shared renderer's picture is copied into it. Textures and
 * materials are therefore uploaded once, however many bottles are on the page.
 *
 * The grey placeholder image stays underneath and remains the fallback when:
 *   - motion is "reduced" or "off" (includes prefers-reduced-motion)
 *   - WebGL is not available, or the context is lost
 *   - the model file is missing or fails to load
 *   - the page is opened by double-click (browsers block reading models on file://)
 *
 * Scroll drives each model: it makes one turn as its section crosses the screen
 * and faces the front when the section is locked in place.
 * Hovering leans the model toward the pointer, like the placeholder images.
 */
(function () {
  "use strict";

  var CONFIG = window.SITE_CONFIG || {};
  var MODELS = CONFIG.MODELS || {};

  var TURNS = 1;             // full turns while the section crosses the viewport
  var FOLLOW = 6;            // how closely the model follows the scroll (per second; lower = lazier)
  var TILT_Y = 0.35;         // hover lean, radians, left-right
  var TILT_X = 0.12;         // hover lean, radians, up-down
  var GLASS_TINT = 0x2c3b30; // "verre de bouteille", used when a model sets glass: true

  var BUBBLES_DEFAULT = typeof CONFIG.BUBBLES_PER_BOTTLE === "number" ? CONFIG.BUBBLES_PER_BOTTLE : 24;
  var BUBBLES_MAX = 160;     // per bottle; the slider in the test panel stops here

  var libraries = null;
  var shared = null;
  var bubbleTexture = null;
  var bubbleSystems = [];
  var files = {};
  var instances = [];
  var note = "";

  function log() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[3d]");
    console.info.apply(console, args);
  }

  function hasWebGL() {
    try {
      var canvas = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
    } catch (e) {
      return false;
    }
  }

  function motionAllows() {
    return document.documentElement.getAttribute("data-motion") === "full";
  }

  // Why 3D cannot run right now, in plain words, or "" if nothing stands in the way.
  function blocker() {
    var mode = document.documentElement.getAttribute("data-motion");
    if (mode !== "full") {
      var asked = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return "off: motion is \"" + mode + "\"" + (asked ? " (this device asks for reduced motion)" : "");
    }
    if (!hasWebGL()) return "off: WebGL is not available in this browser";
    if (!(window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports("importmap"))) {
      return "off: this browser is too old to load Three.js this way (no import maps, e.g. Safari before 16.4)";
    }
    return "";
  }

  // The bottles stand directly on the page: the scene is filled with the
  // theme's own background colour, so there is no visible panel behind them.
  // (It cannot simply be left transparent: glass needs a colour to refract.)
  var swatch = null;

  // Any CSS colour as [red, green, blue], 0–255: the browser paints one pixel
  // with it and the pixel is read back.
  function toRgb(color) {
    if (!swatch) {
      var canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      swatch = canvas.getContext("2d", { willReadFrequently: true });
    }
    swatch.fillStyle = "#000";
    swatch.fillStyle = color;
    swatch.fillRect(0, 0, 1, 1);
    var pixel = swatch.getImageData(0, 0, 1, 1).data;
    return [pixel[0], pixel[1], pixel[2]];
  }

  function pageColor() {
    var rgb = toRgb(getComputedStyle(document.body).backgroundColor);
    return "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")";
  }

  // Bare specifiers resolve through the import map in index.html.
  function loadLibraries() {
    if (!libraries) {
      libraries = Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
        import("three/addons/environments/RoomEnvironment.js")
      ]).then(function (modules) {
        return { THREE: modules[0], GLTFLoader: modules[1].GLTFLoader, RoomEnvironment: modules[2].RoomEnvironment };
      });
    }
    return libraries;
  }

  // The one renderer, and the studio environment every scene reuses.
  function getShared(lib) {
    if (shared) return shared;
    var THREE = lib.THREE;
    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping; // keeps the model's own colours

    // Only feeds reflections, so glass and metal do not render black.
    var pmrem = new THREE.PMREMGenerator(renderer);
    var environment = pmrem.fromScene(new lib.RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    renderer.domElement.addEventListener("webglcontextlost", function (event) {
      event.preventDefault();
      instances.forEach(function (instance) { instance.fail("the WebGL context was lost."); });
    });

    shared = { THREE: THREE, renderer: renderer, environment: environment, width: 0, height: 0 };
    return shared;
  }

  // Each model file is downloaded and parsed once, then shared.
  function loadFile(lib, src) {
    if (!files[src]) {
      files[src] = new Promise(function (resolve, reject) {
        new lib.GLTFLoader().load(src, resolve, undefined, reject);
      });
    }
    return files[src];
  }

  /* ---- Bubbles inside a bottle --------------------------------------------- */
  // Small rings rising through the lower two thirds of a bottle. How many is
  // read from <html data-bubbles>, set by the test panel's slider; without it,
  // config.js decides (BUBBLES_PER_BOTTLE).

  function bubbleCount() {
    var value = document.documentElement.getAttribute("data-bubbles");
    var count = value === null ? BUBBLES_DEFAULT : Number(value);
    return Math.max(0, Math.min(BUBBLES_MAX, isNaN(count) ? BUBBLES_DEFAULT : Math.round(count)));
  }

  // `parent` turns with the bottle. `zone` = { radius, bottom, top, height } in parent units.
  function makeBubbles(THREE, parent, zone) {
    if (!bubbleTexture) {
      var art = document.createElement("canvas");
      art.width = art.height = 64;
      var pen = art.getContext("2d");
      pen.strokeStyle = "#fff";
      pen.lineWidth = 7;
      pen.beginPath();
      pen.arc(32, 32, 24, 0, Math.PI * 2);
      pen.stroke();
      bubbleTexture = new THREE.CanvasTexture(art);
    }

    var positions = new Float32Array(BUBBLES_MAX * 3);
    var seeds = [];
    function place(i, anywhere) {
      var seed = seeds[i] || (seeds[i] = {});
      seed.angle = Math.random() * Math.PI * 2;
      seed.reach = Math.sqrt(Math.random()) * zone.radius;
      seed.speed = zone.height * (0.05 + Math.random() * 0.09); // per second
      seed.phase = Math.random() * Math.PI * 2;
      positions[i * 3 + 1] = anywhere ? zone.bottom + Math.random() * (zone.top - zone.bottom) : zone.bottom;
    }
    for (var i = 0; i < BUBBLES_MAX; i++) place(i, true);

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    var material = new THREE.PointsMaterial({
      map: bubbleTexture, color: 0xf6efd9, size: zone.height * 0.028, sizeAttenuation: true,
      transparent: true, opacity: 0.8, depthWrite: false
    });
    var points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    parent.add(points);

    var system = {
      count: 0,
      sync: function () {
        system.count = bubbleCount();
        geometry.setDrawRange(0, system.count);
        points.visible = system.count > 0;
      },
      update: function (dt, now) {
        var sway = zone.radius * 0.08;
        for (var i = 0; i < system.count; i++) {
          var seed = seeds[i];
          var y = positions[i * 3 + 1] + seed.speed * dt;
          if (y > zone.top) { place(i, false); y = zone.bottom; }
          var drift = Math.sin(now / 900 + seed.phase) * sway;
          positions[i * 3] = Math.cos(seed.angle) * seed.reach + drift;
          positions[i * 3 + 1] = y;
          positions[i * 3 + 2] = Math.sin(seed.angle) * seed.reach;
        }
        geometry.attributes.position.needsUpdate = true;
      }
    };
    system.sync();
    bubbleSystems.push(system);
    return system;
  }

  // Glass must not hide what is inside it, or the bubbles would never show.
  // That also makes the wine visible, so a model can give it a colour
  // (`wine` in config.js): the downloaded bottles are filled with red.
  function seeThrough(object, model) {
    object.traverse(function (node) {
      if (!node.isMesh || !node.material || !(node.material.transmission > 0)) return;
      if (model && model.wine && /wine/i.test(node.material.name)) {
        node.material = node.material.clone(); // this bottle only
        node.material.color.set(model.wine);
      }
      node.material.depthWrite = false;
    });
  }

  document.addEventListener("bubbles:change", function () {
    bubbleSystems.forEach(function (system) { system.sync(); });
  });

  // The "???" bottle: an unreleased cuvée. The glass becomes satin black, the
  // label and the wine are removed, and only the foil keeps the theme's accent.
  function disguise(THREE, object) {
    var accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#C2A06A";
    var body = new THREE.MeshPhysicalMaterial({ color: 0x0b0c0d, roughness: 0.32, metalness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    var foil = new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), roughness: 0.42, metalness: 0.85 });
    object.traverse(function (node) {
      if (!node.isMesh) return;
      var name = (node.material && node.material.name) || "";
      if (/glass/i.test(name)) node.material = body;
      else if (/seal|cork|foil|cap/i.test(name)) node.material = foil;
      else node.visible = false; // label, wine
    });
  }

  /* ---- The light follows the pointer (feature "light") ----------------------- */
  // A small warm lamp hangs in front of the bottle, at the pointer: move the
  // pointer and the lit side of the glass and the label moves with it. It is a
  // real light close to the bottle (not a distant one turned by a few degrees),
  // so the change is plain to see. Mouse and trackpad only.

  var LAMP_POWER = 0.6; // brightness of the lamp, relative to the bottle's size
  var pointer = { x: null, y: null };

  function fx(name) {
    return document.documentElement.getAttribute("data-fx-" + name) === "on";
  }

  window.addEventListener("pointermove", function (event) {
    if (event.pointerType !== "mouse") return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }, { passive: true });

  function makeLamp(THREE, scene) {
    var lamp = new THREE.PointLight(0xfff0d8, 0, 0, 2);
    scene.add(lamp);
    return lamp;
  }

  // Moves `lamp` to the pointer, as seen through `camera` on the canvas at `rect`.
  // `depth` = camera-to-bottle distance, `size` = bottle height.
  // Returns true while something is still changing.
  function aimLamp(THREE, lamp, camera, rect, depth, size, ease) {
    var on = fx("light") && pointer.x !== null && rect.width > 0;
    var power = on ? LAMP_POWER * size * size : 0;
    var moving = Math.abs(power - lamp.intensity) > 0.00002;
    lamp.intensity += (power - lamp.intensity) * ease;
    if (on) {
      // The pointer may be beside the canvas: the lamp then lights from that side.
      var nx = Math.max(-2.2, Math.min(2.2, ((pointer.x - rect.left) / rect.width) * 2 - 1));
      var ny = Math.max(-1.6, Math.min(1.6, -(((pointer.y - rect.top) / rect.height) * 2 - 1)));
      camera.updateMatrixWorld();
      var ray = new THREE.Vector3(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
      var place = camera.position.clone().addScaledVector(ray, Math.max(depth - size * 0.42, size * 0.2));
      if (place.distanceTo(lamp.position) > size * 0.002) moving = true;
      lamp.position.lerp(place, Math.min(1, ease * 1.6));
    }
    return moving;
  }

  // Soft setup: one key light, one fill light, and a faint rim from behind so
  // dark glass keeps an edge against a dark page. Returns the key light.
  function addLights(THREE, scene) {
    var key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(-3, 4, 5);
    var fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(4, 1, 2);
    var rim = new THREE.DirectionalLight(0xffffff, 1.1);
    rim.position.set(2, 3, -5);
    scene.add(key, fill, rim);
    key.userData.rim = rim;
    return key;
  }

  /* ---- Cuvée hue: coloured light around the bottle (feature "tint") ---------- */
  // Two things carry a cuvée's colour, and nothing else on the page changes:
  //   1. a soft pool of that colour behind the bottle, brightest at its centre
  //      and fading into the page colour, which gives the bottle a depth to
  //      stand in (the glass picks it up too);
  //   2. the rim light from behind, which takes the colour and gets stronger,
  //      so the edges of the bottle catch it.
  // `rgb` is the wanted colour as [r, g, b], or null for none. Colours ease
  // from one to the next, so switching cuvée fades the light over.

  var HUE_GLOW = 0.3;    // how much of the cuvée colour the haze takes at its centre (0–1)
  var HUE_RIM = 1.6;     // rim light strength with a hue (1.1 without)
  var HUE_AMBIENT = 1.1; // strength of the coloured light that washes the bottle itself

  function makeHue(THREE, scene, camera, key) {
    var art = document.createElement("canvas");
    art.width = art.height = 256;
    var pen = art.getContext("2d");
    var texture = new THREE.CanvasTexture(art);
    texture.colorSpace = THREE.SRGBColorSpace;
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, depthWrite: false })
    );
    mesh.renderOrder = -1;
    scene.add(camera); // the haze is fixed to the camera, far behind everything
    camera.add(mesh);
    // Ambient: light of the cuvée's colour from all around, none of it a beam.
    var ambient = new THREE.HemisphereLight(0xffffff, 0x000000, 0);
    scene.add(ambient);

    var page = toRgb(getComputedStyle(document.body).backgroundColor);
    var shown = page.slice(); // the colour currently at the pool's centre
    var amount = 0;           // 0 = no hue, 1 = full

    function paint() {
      var css = function (c) { return "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")"; };
      var mix = function (t) { return [0, 1, 2].map(function (i) { return page[i] + (shown[i] - page[i]) * t; }); };
      var gradient = pen.createRadialGradient(128, 128, 0, 128, 128, 128);
      // A wide, even haze that only falls away near the edge: no bright centre.
      gradient.addColorStop(0, css(mix(HUE_GLOW * amount)));
      gradient.addColorStop(0.45, css(mix(HUE_GLOW * amount * 0.82)));
      gradient.addColorStop(0.78, css(mix(HUE_GLOW * amount * 0.3)));
      gradient.addColorStop(1, css(page));
      pen.fillStyle = css(page);
      pen.fillRect(0, 0, 256, 256);
      pen.fillStyle = gradient;
      pen.fillRect(0, 0, 256, 256);
      texture.needsUpdate = true;
    }
    paint();

    return {
      // Where the pool sits in the camera's view and how big it is.
      place: function (x, y, width, height, depth) {
        mesh.position.set(x, y, -depth);
        mesh.scale.set(width, height, 1);
      },
      // Call when the theme changes.
      repage: function () {
        page = toRgb(getComputedStyle(document.body).backgroundColor);
        paint();
      },
      // Eases toward `rgb` (or toward no hue). Returns true while still changing.
      step: function (rgb, ease) {
        var wanted = rgb ? 1 : 0;
        var moving = Math.abs(wanted - amount) > 0.004;
        if (rgb) {
          for (var i = 0; i < 3; i++) {
            if (amount < 0.02) shown[i] = rgb[i]; // nothing shown yet: no need to fade from the old colour
            if (Math.abs(rgb[i] - shown[i]) > 0.6) moving = true;
            shown[i] += (rgb[i] - shown[i]) * ease;
          }
        }
        if (!moving) return false;
        amount = Math.max(0, Math.min(1, amount + (wanted - amount) * ease));
        paint();
        var rim = key.userData.rim;
        rim.color.setRGB(
          1 + (shown[0] / 255 - 1) * amount, 1 + (shown[1] / 255 - 1) * amount, 1 + (shown[2] / 255 - 1) * amount,
          THREE.SRGBColorSpace
        );
        rim.intensity = 1.1 + (HUE_RIM - 1.1) * amount;
        ambient.color.setRGB(shown[0] / 255, shown[1] / 255, shown[2] / 255, THREE.SRGBColorSpace);
        ambient.groundColor.setRGB(page[0] / 255, page[1] / 255, page[2] / 255, THREE.SRGBColorSpace);
        ambient.intensity = HUE_AMBIENT * amount;
        return true;
      }
    };
  }

  /* ---- One stage ---------------------------------------------------------- */

  function create(stage, model) {
    var frame = stage.closest(".plate__frame");
    var section = stage.closest(".cuvee");
    var header = document.querySelector(".site-header");
    var id = stage.getAttribute("data-cuvee");
    var state = { stage: stage, id: id, live: false, started: false, failed: false, status: "waiting: not scrolled into view yet" };
    var THREE, scene, camera, pivot, canvas, context, bubbles, key, hue, lamp;
    // This cuvée's colour, for the lighting hue (config.js: `tint`).
    var cuvee = (CONFIG.CUVEES || []).filter(function (item) { return String(item.id) === String(id); })[0];
    var hueColor = cuvee && cuvee.tint ? toRgb(cuvee.tint) : null;
    var fit = { height: 1, radius: 1 };
    var progress = 0.5, raf = null, visible = false, dirty = true, last = 0;
    var tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };

    state.fail = function (reason) {
      if (state.failed) return;
      state.failed = true;
      console.warn("[3d] cuvée " + id + ": " + reason + " Showing the placeholder image.");
      state.status = "failed: " + reason;
      stop();
      if (canvas && canvas.parentNode) canvas.remove();
      state.live = false;
      frame.classList.remove("has-3d");
    };

    // Camera distance so the model fits while it turns around its vertical axis.
    function frameCamera() {
      var width = stage.clientWidth, height = stage.clientHeight;
      if (!width || !height) return;
      var ratio = shared.renderer.getPixelRatio();
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      camera.aspect = width / height;
      var vertical = THREE.MathUtils.degToRad(camera.fov / 2);
      var horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
      var distance = Math.max((fit.height / 2) / Math.tan(vertical), fit.radius / Math.tan(horizontal)) * 1.14 + fit.radius;
      camera.position.set(0, 0, distance);
      camera.near = Math.max(distance / 100, 0.001);
      camera.far = distance * 10;
      // The colour pool fills the frame exactly, so it has faded out at every edge.
      var depth = distance * 3;
      var poolHeight = 2 * depth * Math.tan(vertical);
      hue.place(0, 0, poolHeight * camera.aspect, poolHeight, depth);
      camera.updateProjectionMatrix();
      dirty = true;
    }

    function prepare(gltf) {
      var source = model.node ? gltf.scene.getObjectByName(model.node) : gltf.scene;
      if (!source) throw new Error('no object named "' + model.node + '" in the file');
      var object = source.clone(true); // geometry and materials stay shared

      pivot.add(object);
      pivot.updateMatrixWorld(true);
      var box = new THREE.Box3().setFromObject(object);
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());
      object.position.sub(center); // centre the model on the pivot
      pivot.updateMatrixWorld(true);

      var meshes = [];
      var triangles = 0;
      object.traverse(function (node) {
        if (!node.isMesh) return;
        meshes.push(node);
        var geometry = node.geometry;
        triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
        if (model.glass) {
          node.material = new THREE.MeshPhysicalMaterial({
            color: GLASS_TINT, roughness: 0.08, metalness: 0, transmission: 0.92,
            thickness: Math.max(size.x, size.z) * 0.15, ior: 1.5
          });
        }
      });

      fit.height = size.y;
      fit.radius = Math.sqrt(size.x * size.x + size.z * size.z) / 2;

      if (model.mystery) {
        disguise(THREE, object);
        bubbles = { count: 0, update: function () {} }; // nothing to see inside
      } else {
        seeThrough(object, model);
        bubbles = makeBubbles(THREE, pivot, {
          radius: Math.min(size.x, size.z) * 0.27,
          bottom: -size.y / 2 + size.y * 0.07,
          top: -size.y / 2 + size.y * 0.6,
          height: size.y
        });
      }
      state.report = {
        object: model.node || "(whole file)",
        meshes: meshes.length,
        materials: meshes.map(function (mesh) { return mesh.material.name || "(unnamed)"; }),
        triangles: Math.round(triangles),
        size: [size.x, size.y, size.z].map(function (n) { return Number(n.toFixed(3)); }),
        originOffset: [center.x, center.y, center.z].map(function (n) { return Number(n.toFixed(3)); }),
        glassOverride: !!model.glass
      };
    }

    function tick(now) {
      raf = requestAnimationFrame(tick);
      // Time-based easing, so the model moves at the same speed on any screen.
      // Never negative: the first frame can carry a timestamp older than `last`.
      var dt = Math.max(0, Math.min((now - last) / 1000, 0.1));
      var ease = 1 - Math.exp(-dt * FOLLOW);
      last = now;
      // Progress through the visible area below the sticky header: 0 as the
      // section enters at the bottom, 0.5 when it is locked in place, 1 as it leaves.
      var rect = section.getBoundingClientRect();
      var top = header && getComputedStyle(header).position === "sticky" ? header.offsetHeight : 0;
      var view = window.innerHeight - top;
      var target = (view - (rect.top - top)) / (view + rect.height);
      target = Math.min(1, Math.max(0, target));

      var settled = Math.abs(target - progress) < 0.0002 &&
        Math.abs(tilt.targetX - tilt.x) < 0.0005 && Math.abs(tilt.targetY - tilt.y) < 0.0005;
      if (aimLamp(THREE, lamp, camera, stage.getBoundingClientRect(), camera.position.z, fit.height, ease)) dirty = true;
      if (hue.step(fx("tint") ? hueColor : null, ease)) dirty = true;
      // Bubbles keep rising, so with any bubbles the picture is redrawn every frame.
      if (settled && !dirty && !bubbles.count) return;
      if (bubbles.count) bubbles.update(dt, now);
      progress += (target - progress) * ease;
      tilt.x += (tilt.targetX - tilt.x) * ease;
      tilt.y += (tilt.targetY - tilt.y) * ease;
      dirty = false;

      // Locked section = model facing the front; one turn across the whole pass.
      pivot.rotation.y = (progress - 0.5) * Math.PI * 2 * TURNS + (model.yaw || 0) + tilt.y;
      pivot.rotation.x = tilt.x;


      // Draw with the shared renderer, then copy the picture into this stage.
      var width = stage.clientWidth, height = stage.clientHeight;
      if (shared.width !== width || shared.height !== height) {
        shared.renderer.setSize(width, height, false);
        shared.width = width;
        shared.height = height;
      }
      shared.renderer.render(scene, camera);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(shared.renderer.domElement, 0, 0, canvas.width, canvas.height);
    }

    function start() {
      if (raf || !state.live || !visible || !motionAllows()) return;
      dirty = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    function build(lib) {
      var began = performance.now();
      getShared(lib);
      THREE = shared.THREE;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(pageColor());
      scene.environment = shared.environment;
      scene.environmentIntensity = 0.6;
      camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
      pivot = new THREE.Group();
      scene.add(pivot);

      key = addLights(THREE, scene);
      hue = makeHue(THREE, scene, camera, key);
      lamp = makeLamp(THREE, scene);

      return loadFile(lib, model.src).then(function (gltf) {
        if (state.failed) return;
        prepare(gltf);

        canvas = document.createElement("canvas");
        context = canvas.getContext("2d");
        stage.appendChild(canvas);
        state.live = true;
        frameCamera();
        if ("ResizeObserver" in window) new ResizeObserver(frameCamera).observe(stage);
        if (motionAllows()) frame.classList.add("has-3d");

        state.status = motionAllows() ? "live" : blocker();
        state.report.readyMs = Math.round(performance.now() - began);
        log("cuvée " + id + " model ready", state.report);
        start();
      });
    }

    function begin() {
      if (state.started || state.failed) return;
      var reason = blocker();
      if (reason) { state.status = reason; return; } // keep the placeholder; try again if motion changes
      state.started = true;
      state.status = "loading";
      // Check the file is there first, so a missing model costs one small
      // request instead of the whole Three.js download.
      fetch(model.src, { method: "HEAD" }).then(function (response) {
        if (!response.ok) {
          log("no model at " + model.src + " (HTTP " + response.status + "). Showing the placeholder image.");
          state.status = "off: model file not found (HTTP " + response.status + ")";
          return;
        }
        return loadLibraries().then(build);
      }).catch(function (error) {
        state.fail("the model could not be loaded (" + ((error && error.message) || "network error") + ").");
      });
    }

    // Hover: lean toward the pointer, and straighten up on leaving.
    frame.addEventListener("pointermove", function (event) {
      if (event.pointerType !== "mouse" || !state.live) return;
      var rect = frame.getBoundingClientRect();
      tilt.targetY = ((event.clientX - rect.left) / rect.width - 0.5) * 2 * TILT_Y;
      tilt.targetX = ((event.clientY - rect.top) / rect.height - 0.5) * 2 * TILT_X;
    });
    frame.addEventListener("pointerleave", function () {
      tilt.targetX = 0;
      tilt.targetY = 0;
    });

    if ("IntersectionObserver" in window) {
      // The stage itself: first sight triggers the download.
      new IntersectionObserver(function (entries) {
        state.near = entries[0].isIntersecting;
        if (state.near) begin();
      }).observe(stage);
      // The section: the render loop only runs while it is on screen.
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(section);
    }

    // The testing panel can change the theme: follow the new page colour.
    document.addEventListener("theme:change", function () {
      if (!scene) return;
      scene.background.set(pageColor());
      hue.repage();
      dirty = true;
    });
    document.addEventListener("fx:change", function () { dirty = true; });

    // Motion toggle: reduced/off hides the canvas and shows the placeholder again.
    document.addEventListener("motion:change", function () {
      if (!motionAllows()) {
        stop();
        frame.classList.remove("has-3d");
        if (!state.failed) state.status = blocker();
      } else if (state.live) {
        frame.classList.add("has-3d");
        state.status = "live";
        start();
      } else if (state.near) {
        begin();
      }
    });

    return state;
  }

  function init() {
    var wanted = Object.keys(MODELS).filter(function (id) { return MODELS[id] && MODELS[id].src; });
    if (wanted.length && location.protocol === "file:") {
      log("3D models need a local server (npx serve). Opened by double-click, the placeholder images are shown.");
      note = "off: page opened by double-click; 3D needs a server (npx serve)";
      return;
    }
    wanted.forEach(function (id) {
      var stage = document.querySelector('.bottle-stage[data-cuvee="' + id + '"]');
      if (stage) instances.push(create(stage, MODELS[id]));
    });
  }

  window.Bottle3D = {
    init: init,
    instances: instances,
    // Shared with js/bottle-ring.js (the selection test page).
    libraries: loadLibraries,
    file: loadFile,
    lights: addLights,
    hue: makeHue,
    toRgb: toRgb,
    lamp: makeLamp,
    aimLamp: aimLamp,
    fx: fx,
    pageColor: pageColor,
    hasWebGL: hasWebGL,
    motionAllows: motionAllows,
    blocker: blocker,
    bubbles: makeBubbles,
    bubbleCount: bubbleCount,
    bubblesMax: BUBBLES_MAX,
    seeThrough: seeThrough,
    disguise: disguise,
    // One line per 3D element, for the test panel.
    status: function () {
      if (note) return [note];
      var lines = instances.map(function (instance) { return "cuvée " + instance.id + ": " + instance.status; });
      if (window.Bottle3D.ringStatus) lines.push("ring: " + window.Bottle3D.ringStatus);
      return lines.length ? lines : ["no 3D element on this page"];
    }
  };
})();
