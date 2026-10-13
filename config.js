/*
 * config.js — every swappable value lives here.
 * PROTOTYPE: all values below are placeholders.
 */
window.SITE_CONFIG = {
  // ---- Shop (see js/shop.js) -------------------------------------------------
  // How an "Order" button hands over to Shopify:
  //   "page"    opens the cuvée's product page (SHOPIFY_BASE_URL + slug)
  //   "link"    LEVEL 1: straight to Shopify's checkout with one bottle in the cart
  //   "embed"   LEVEL 2, simulated: a basket panel in the look of Shopify's embed
  //   "basket"  LEVEL 3: a basket panel in the site's own design
  // The test panel ("Shop") switches between them for comparison.
  SHOP_MODE: "link",

  // PLACEHOLDERS — replace with the real store:
  SHOPIFY_DOMAIN: "example.myshopify.com",                     // the store's address, without https://
  SHOPIFY_BASE_URL: "https://example.myshopify.com/products/", // product pages ("page" mode)
  CURRENCY: "EUR",

  // One entry per cuvée section, in page order.
  // `rose` only drives the rosé accent of Direction B. Types are TBD:
  // cuvée 3 is flagged so the rosé accent can be reviewed.
  CUVEES: [
    // `variantId` is the number Shopify gives each product variant (Shopify admin:
    // open the product, then the variant; it is the long number at the end of
    // the address). `price` is only used to total the basket in levels 2 and 3
    // until prices are read from Shopify. Both are PLACEHOLDERS.
    // `tint` is the colour of the light around that cuvée's bottle
    // (feature "tint" below). PLACEHOLDER colours.
    // `aromas` feeds the aroma chart: fruit, floral, toast, mineral, freshness,
    // length, each from 0 to 5. PLACEHOLDER values.
    { id: 1, slug: "placeholder-cuvee-1", variantId: "00000000000001", price: 0, rose: false, tint: "#C9A227", aromas: [4, 3, 2, 4, 5, 3] },
    { id: 2, slug: "placeholder-cuvee-2", variantId: "00000000000002", price: 0, rose: false, tint: "#2F8F83", aromas: [3, 4, 3, 5, 4, 4] },
    { id: 3, slug: "placeholder-cuvee-3", variantId: "00000000000003", price: 0, rose: true, tint: "#C4526E", aromas: [5, 3, 1, 2, 4, 3] },
    { id: 4, slug: "placeholder-cuvee-4", variantId: "00000000000004", price: 0, rose: false, tint: "#B8612A", aromas: [3, 2, 5, 3, 2, 5] },
    // Not released yet: shown as "???", no price, no order link.
    { id: 5, slug: "", rose: false, soon: true, tint: "#4A5FB0", aromas: [0, 0, 0, 0, 0, 0] }
  ],

  // Layout of the ring page on phones and tablets (below 960px wide):
  //   "window"  the bottle in a window pinned to the top, text scrolls under it
  //   "fade"    the bottle fills the screen; the text stays at the bottom and
  //             fades from one part to the next as you scroll
  //   "rail"    the bottle in a tall column on the left, text scrolls on the right
  // The test panel ("Mobile layout") switches between them.
  MOBILE_LAYOUT: "window",

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
    cursor: true,   // custom cursor (mouse only): a dot and a trailing ring
    keys: true,     // arrow up/down (and Page Up/Down) go to the previous/next section
    noselect: true, // text on the site cannot be selected (highlighted) with the mouse
    noscrollbar: true // the browser's own scrollbar is hidden; the page still scrolls
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
