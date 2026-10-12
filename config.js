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
    { id: 1, slug: "placeholder-cuvee-1", rose: false },
    { id: 2, slug: "placeholder-cuvee-2", rose: false },
    { id: 3, slug: "placeholder-cuvee-3", rose: true },
    { id: 4, slug: "placeholder-cuvee-4", rose: false }
  ],

  // PROTOTYPE TEST — 3D models, by cuvée id. A cuvée without an entry keeps its
  // placeholder image. See assets/models/README.md for the options.
  // One downloaded file holds four bottles; `node` picks one of them by name.
  // PLACEHOLDER models: generic wine bottles with made-up labels, not the house's.
  MODELS: {
    1: { src: "assets/models/wine_bottles_01_1k.gltf", node: "wine_bottles_01_champagne" },
    2: { src: "assets/models/wine_bottles_01_1k.gltf", node: "wine_bottles_01_burgundy" },
    3: { src: "assets/models/wine_bottles_01_1k.gltf", node: "wine_bottles_01_alsace" },
    4: { src: "assets/models/wine_bottles_01_1k.gltf", node: "wine_bottles_01_bordeaux" }
  },

  AGE_GATE_ENABLED: true,

  LANGUAGES: ["fr", "en", "es", "ja"],
  DEFAULT_LANGUAGE: "en",

  DEFAULT_THEME: "craie-cave",   // craie-cave | terre-vigneron | art-deco-nuit
  DEFAULT_FONT_PAIR: "pair-a",   // pair-a | pair-b | pair-c
  DEFAULT_MOTION: "full"         // full | reduced | off
};
