/*
 * config.js — every swappable value lives here.
 * PROTOTYPE: all values below are placeholders.
 */
window.SITE_CONFIG = {
  // Shop links: SHOPIFY_BASE_URL + cuvée slug (opens in the same tab).
  SHOPIFY_BASE_URL: "https://example.myshopify.com/products/",

  // One entry per cuvée section, in page order.
  // `rose` only drives the rosé accent of Direction B. Types are TBD:
  // cuvée 3 is flagged so the rosé accent can be reviewed.
  CUVEES: [
    // `tint` is the colour of the light around that cuvée's bottle
    // (feature "tint" below). PLACEHOLDER colours.
    // `aromas` feeds the aroma chart: fruit, floral, toast, mineral, freshness,
    // length, each from 0 to 5. PLACEHOLDER values.
    { id: 1, slug: "placeholder-cuvee-1", rose: false, tint: "#C9A227", aromas: [4, 3, 2, 4, 5, 3] },
    { id: 2, slug: "placeholder-cuvee-2", rose: false, tint: "#2F8F83", aromas: [3, 4, 3, 5, 4, 4] },
    { id: 3, slug: "placeholder-cuvee-3", rose: true, tint: "#C4526E", aromas: [5, 3, 1, 2, 4, 3] },
    { id: 4, slug: "placeholder-cuvee-4", rose: false, tint: "#B8612A", aromas: [3, 2, 5, 3, 2, 5] },
    // Not released yet: shown as "???", no price, no order link.
    { id: 5, slug: "", rose: false, soon: true, tint: "#4A5FB0", aromas: [0, 0, 0, 0, 0, 0] }
  ],

  // Optional effects. Each one can also be switched in the test panel.
  FEATURES: {
    light: true,   // the light on the 3D bottles follows the pointer
    hover: true,   // in the ring, the bottle under the pointer leans toward it
    gauge: true,   // scroll progress shown as a descent into the cellar
    tint: true,    // each cuvée lights its bottle with its own ambient colour
    glass: true,   // "In the glass" section on the ring page
    chart: true,   // aroma chart in the "In the glass" section
    intro: true,   // loading screen on arrival; its bottle lands on the hero bottle
    ringHome: true, // the ring page is the home page (the scroll page stays at index.html?all=1)
    cursor: true    // custom cursor (mouse only): a dot and a trailing ring
  },

  // The cellar gauge reads from the surface down to these values. PLACEHOLDERS.
  CELLAR: { depthM: 30, surfaceC: 18, cellarC: 11 },

  // PROTOTYPE TEST — 3D models, by cuvée id. A cuvée without an entry keeps its
  // placeholder image. See assets/models/README.md for the options.
  // One downloaded file holds four bottles; `node` picks one of them by name.
  // PLACEHOLDER models: generic wine bottles with made-up labels, not the house's.
  // `wine` recolours the liquid inside (the downloaded bottles hold red wine).
  MODELS: {
    1: { src: "assets/models/wine_bottles_01_1k.gltf", node: "wine_bottles_01_champagne", wine: "#E6D596" },
    2: { src: "assets/models/wine_bottles_01_1k.gltf", node: "wine_bottles_01_burgundy", wine: "#ECDCAE" },
    3: { src: "assets/models/wine_bottles_01_1k.gltf", node: "wine_bottles_01_alsace", wine: "#E9B7A0" },
    4: { src: "assets/models/wine_bottles_01_1k.gltf", node: "wine_bottles_01_bordeaux", wine: "#DCC27A" },
    // `mystery` blacks the bottle out and removes its label; only the foil keeps the accent colour.
    5: { src: "assets/models/wine_bottles_01_1k.gltf", node: "wine_bottles_01_champagne", mystery: true }
  },

  // Bubbles rising inside each 3D bottle (0 = none). The test panel has a slider.
  BUBBLES_PER_BOTTLE: 24,

  AGE_GATE_ENABLED: true,

  LANGUAGES: ["fr", "en", "es", "ja"],
  DEFAULT_LANGUAGE: "en",

  DEFAULT_THEME: "craie-cave",   // craie-cave | terre-vigneron | art-deco-nuit
  DEFAULT_FONT_PAIR: "pair-a",   // pair-a | pair-b | pair-c
  DEFAULT_MOTION: "full"         // full | reduced | off
};
