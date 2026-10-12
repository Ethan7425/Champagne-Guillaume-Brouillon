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
 * and faces the front when the section is locked in place. If the model has
 * several parts, they move apart as the section scrolls away ("explode").
 * Hovering leans the model toward the pointer, like the placeholder images.
 */
(function () {
  "use strict";

  var CONFIG = window.SITE_CONFIG || {};
  var MODELS = CONFIG.MODELS || {};

  var TURNS = 1;             // full turns while the section crosses the viewport
  var EXPLODE = 0.3;         // how far parts travel, as a share of the model's size
  var FOLLOW = 6;            // how closely the model follows the scroll (per second; lower = lazier)
  var TILT_Y = 0.35;         // hover lean, radians, left-right
  var TILT_X = 0.12;         // hover lean, radians, up-down
  var GLASS_TINT = 0x2c3b30; // "verre de bouteille", used when a model sets glass: true

  var libraries = null;
  var shared = null;
  var files = {};
  var instances = [];

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

  // The bottles stand directly on the page: the scene is filled with the
  // theme's own background colour, so there is no visible panel behind them.
  // (It cannot simply be left transparent: glass needs a colour to refract.)
  function pageColor() {
    return getComputedStyle(document.body).backgroundColor;
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

  // Soft setup: one key light, one fill light, and a faint rim from behind so
  // dark glass keeps an edge against a dark page.
  function addLights(THREE, scene) {
    var key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(-3, 4, 5);
    var fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(4, 1, 2);
    var rim = new THREE.DirectionalLight(0xffffff, 1.1);
    rim.position.set(2, 3, -5);
    scene.add(key, fill, rim);
  }

  /* ---- One stage ---------------------------------------------------------- */

  function create(stage, model) {
    var frame = stage.closest(".plate__frame");
    var section = stage.closest(".cuvee");
    var header = document.querySelector(".site-header");
    var id = stage.getAttribute("data-cuvee");
    var state = { stage: stage, live: false, started: false, failed: false };
    var THREE, scene, camera, pivot, canvas, context, parts = [];
    var fit = { height: 1, radius: 1, exploding: false };
    var progress = 0.5, raf = null, visible = false, dirty = true, last = 0;
    var tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };

    state.fail = function (reason) {
      if (state.failed) return;
      state.failed = true;
      console.warn("[3d] cuvée " + id + ": " + reason + " Showing the placeholder image.");
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
      var skinned = false;
      object.traverse(function (node) {
        if (!node.isMesh) return;
        meshes.push(node);
        if (node.isSkinnedMesh) skinned = true;
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
      fit.exploding = meshes.length > 1 && !skinned;

      // Explode: a part moves away from the model's centre, along the line from
      // that centre to its own centre. A part that sits on the centre (the
      // body of a bottle) stays where it is and the others leave it.
      if (fit.exploding) {
        var largest = Math.max(size.x, size.y, size.z);
        meshes.forEach(function (mesh) {
          var own = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
          if (own.length() < largest * 0.04) return;
          var direction = own.clone().normalize().multiplyScalar(largest * EXPLODE);
          // Express that world-space move in the space of the mesh's parent.
          var inverse = new THREE.Matrix4().copy(mesh.parent.matrixWorld).invert();
          var from = own.clone().applyMatrix4(inverse);
          var to = own.clone().add(direction).applyMatrix4(inverse);
          parts.push({ mesh: mesh, origin: mesh.position.clone(), travel: to.sub(from) });
        });
      }

      state.report = {
        object: model.node || "(whole file)",
        meshes: meshes.length,
        materials: meshes.map(function (mesh) { return mesh.material.name || "(unnamed)"; }),
        triangles: Math.round(triangles),
        size: [size.x, size.y, size.z].map(function (n) { return Number(n.toFixed(3)); }),
        originOffset: [center.x, center.y, center.z].map(function (n) { return Number(n.toFixed(3)); }),
        explode: fit.exploding ? "on (" + parts.length + " of " + meshes.length + " parts move)" : (skinned ? "skipped: skinned model" : "skipped: single mesh"),
        glassOverride: !!model.glass
      };
    }

    function tick(now) {
      raf = requestAnimationFrame(tick);
      // Time-based easing, so the model moves at the same speed on any screen.
      var ease = 1 - Math.exp(-Math.min((now - last) / 1000, 0.1) * FOLLOW);
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
      if (settled && !dirty) return;
      progress += (target - progress) * ease;
      tilt.x += (tilt.targetX - tilt.x) * ease;
      tilt.y += (tilt.targetY - tilt.y) * ease;
      dirty = false;

      // Locked section = model facing the front; one turn across the whole pass.
      pivot.rotation.y = (progress - 0.5) * Math.PI * 2 * TURNS + (model.yaw || 0) + tilt.y;
      pivot.rotation.x = tilt.x;

      if (parts.length) {
        var amount = Math.min(1, Math.max(0, (progress - 0.5) * 2));
        amount = amount * amount * (3 - 2 * amount); // smoothstep
        for (var i = 0; i < parts.length; i++) {
          parts[i].mesh.position.copy(parts[i].origin).addScaledVector(parts[i].travel, amount);
        }
      }

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

      addLights(THREE, scene);

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

        state.report.readyMs = Math.round(performance.now() - began);
        log("cuvée " + id + " model ready", state.report);
        start();
      });
    }

    function begin() {
      if (state.started || state.failed) return;
      if (!motionAllows() || !hasWebGL()) return; // keep the placeholder; try again if motion changes
      state.started = true;
      // Check the file is there first, so a missing model costs one small
      // request instead of the whole Three.js download.
      fetch(model.src, { method: "HEAD" }).then(function (response) {
        if (!response.ok) {
          log("no model at " + model.src + " (HTTP " + response.status + "). Showing the placeholder image.");
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
      dirty = true;
    });

    // Motion toggle: reduced/off hides the canvas and shows the placeholder again.
    document.addEventListener("motion:change", function () {
      if (!motionAllows()) {
        stop();
        frame.classList.remove("has-3d");
      } else if (state.live) {
        frame.classList.add("has-3d");
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
    pageColor: pageColor,
    hasWebGL: hasWebGL,
    motionAllows: motionAllows
  };
})();
