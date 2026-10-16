# [BRAND NAME] — showcase site (prototype)

**PROTOTYPE — NOT FOR PUBLICATION.** Brand name, logo, cuvée names, colours, fonts, copy and prices are placeholders. This is a base skeleton for review, not a finished design.

## Run it

- Double-click `index.html`, or
- from this folder: `npx serve` (or `python3 -m http.server`) and open the printed address.

No framework, no dependencies, no build step.

## File tree

```
index.html              home page: hero, four cuvée sections, the house, footer
404.html                not-found page
selection.html          TEST PAGE: the four bottles in a ring, pick one, scroll for its details
config.js               every swappable value (shop URL, slugs, defaults, age gate)
css/
  base.css              reset, layout and type tokens, shared motion rules
  themes.css            the three colour directions + TESTING ONLY panel styles
  fonts.css             the three font pairs + Japanese fallback
  components.css        header, hero, cuvée sections, footer, age gate, 404
js/
  main.js               builds the cuvée sections, wires links, starts everything
  i18n.js               loads translations, fills the page, language switcher
  motion.js             motion levels, scroll reveal, hero bubbles, tilt, scroll settle
  bottle-3d.js          PROTOTYPE TEST: 3D model in a bottle stage (loads Three.js on demand)
  bottle-ring.js        TEST PAGE only: the bottle ring of selection.html
  loader.js             TEST: loading screen, played from the test panel
  shop.js               order links and basket: the four ways to reach Shopify
  extras.js             optional effects: cellar gauge, page tint, the glass
  consent.js            cookie banner and the visitor's cookie choice
  newsletter.js         release letter sign-up form
  age-gate.js           18+ overlay
  testing-panel.js      TESTING ONLY review panel
i18n/
  fr.json en.json es.json ja.json   all visible text
  bundle.js             generated copy of the four files (double-click mode)
assets/
  logo-placeholder.svg  placeholder-bottle.svg
  fonts/                the six Latin review fonts (woff2, SIL Open Font License)
  models/               3D test models (.glb) go here
tools/
  build-i18n-bundle.js  regenerates i18n/bundle.js
```

## Editing text

All visible text lives in `i18n/*.json`. The HTML only holds keys (`data-i18n="hero.title"`).

Browsers refuse to read JSON files from a page opened by double-click. For that case the site reads `i18n/bundle.js`, a generated copy. **After editing any translation, run `node tools/build-i18n-bundle.js`**, otherwise double-click mode shows the old text. Over a local server or a real host, the JSON files are read directly.

## Config (`config.js`)

| Key | Value now |
| --- | --- |
| `SHOP_MODE` | `link` |
| `SHOPIFY_DOMAIN` | `example.myshopify.com` (placeholder) |
| `SHOPIFY_BASE_URL` | `https://example.myshopify.com/products/` (placeholder) |
| `CUVEES[].slug` | `placeholder-cuvee-1` … `-4` |
| `CUVEES[].variantId`, `.price` | placeholders (`00000000000001` …, `0`) |
| `CUVEES[].rose` | `true` on cuvée 3 only, to preview the rosé accent of Direction B |
| `AGE_GATE_ENABLED` | `true` |
| `DEFAULT_LANGUAGE` | `en` |
| `DEFAULT_THEME` | `craie-cave` |
| `DEFAULT_FONT_PAIR` | `pair-a` |
| `DEFAULT_MOTION` | `full` |

### Shop: how "Order" reaches Shopify

`js/shop.js` builds every order link. `SHOP_MODE` in `config.js` picks one of four ways, and the test panel ("Shop") switches between them so they can be compared:

| Mode | What the visitor gets |
| --- | --- |
| `page` | The first idea: the cuvée's product page on Shopify (`SHOPIFY_BASE_URL + slug`) |
| `link` (default, "level 1") | Straight to Shopify's checkout with one bottle in the cart: `https://SHOPIFY_DOMAIN/cart/VARIANT_ID:1` |
| `embed` ("level 2", **simulated**) | A basket panel styled like Shopify's own embedded cart. A stand-in to judge the experience; the real one comes from Shopify once a store exists |
| `basket` ("level 3") | A basket panel in the site's design, with quantities and a subtotal. "Go to checkout" sends the whole basket to Shopify in one link |

To connect a real store: set `SHOPIFY_DOMAIN`, give each cuvée its `variantId` (Shopify admin, product, variant: the long number at the end of the address) and its `price`. Nothing talks to Shopify yet: prices in the basket come from `config.js`. Later, level 3 can read live prices and stock through Shopify's Storefront API without changing how the basket behaves.

In every mode the link opens in the same tab. A cuvée marked `soon: true` (the fifth, "???") is unreleased: no price, no shop link, a "Coming soon" notice instead of the button, and a blacked-out 3D bottle (`mystery: true` in `MODELS`). To release it, give it a slug, remove `soon` and `mystery`, and fill in its text in the i18n files. Adding or removing an entry in `CUVEES` adds or removes a section (the i18n `cuvees` array needs a matching entry).

## Placeholders to replace

- Brand name `[BRAND NAME]` (i18n `brand.name`, page titles, footer, label line)
- Logo `assets/logo-placeholder.svg`
- Bottle images `assets/placeholder-bottle.svg` (hero + four cuvées), with their captions and alt text
- Cuvée names `[CUVÉE 1]`–`[CUVÉE 4]`, `Type: TBD`, blends, tasting notes, ageing, dosage
- Prices `€00.00`
- Every bracketed fact: `[VILLAGE]`, `[PARCEL A]`, `[YEAR]`, `[00]`, first names, hectares, press size, `RM-000-000`, `% vol.`
- Hero, house and 404 copy
- Shopify URL and slugs
- Legal links (all point to `#`)
- Colours and fonts (`css/themes.css`, `css/fonts.css`), all marked "PLACEHOLDER — to be replaced after review"
- The yellow "PROTOTYPE — NOT FOR PUBLICATION" badge (`.proto-badge` in both HTML files and `components.css`)

## Design directions (testing only)

| | A · Craie & Cave (default, recommended) | B · Terre de vigneron | C · Art déco nuit |
| --- | --- | --- | --- |
| Background | `#16181A` | `#EFE7DB` | `#141C2E` |
| Text | `#ECEBE6` | `#2B2420` | `#EAE4D6` |
| Accent | `#C2A06A` | `#4F5D3A` | `#D7B98A` |
| Other | surface `#1C1F20`, muted `#8A8D86`, glass `#2C3B30` | rosé `#C98B76`, straw `#D8C08E` | main button `#E5B9A6` |
| Fonts | Bodoni Moda + Jost | Gloock + Instrument Sans | Italiana + Manrope |
| Signature motion | floating bottle, hero bubbles | slow fades | sunburst divider draws in |

Tokens marked `derived` in `themes.css` (hairlines, plus surface and muted for B and C) were not in the review artifact and need confirming.

Japanese text always falls back to Noto Serif JP (headings) and Noto Sans JP (body).

The six Latin fonts are bundled in `assets/fonts/` and declared in `css/fonts.css`, so the font switcher works offline and no visitor data goes to Google for them. Only Noto JP is still linked from Google Fonts (it is too large to bundle and is only downloaded when Japanese text is shown); self-host or drop it before launch if Google Fonts must be avoided entirely. The test panel shows, under "Font pair", which fonts are really loaded.

## Optional effects

Five effects are listed under `FEATURES` in `config.js` and each has a switch in the test panel ("Effects"). `<html data-fx-NAME="on|off">` carries the state.

| Feature | What it does | Where |
| --- | --- | --- |
| `light` | A small warm lamp hangs in front of the bottle at the pointer, so the lit side moves with it (mouse only) | `js/bottle-3d.js` |
| `hover` | In the ring, the bottle under the pointer turns to face it and leans slightly the same way | `js/bottle-ring.js` |
| `gauge` | Scroll progress as a descent into the cellar: a hairline that fills, with depth and temperature (`CELLAR` in `config.js`, placeholder values). Small marks on the line are checkpoints, one per section: click one to go there. A section becomes a checkpoint with `data-checkpoint="i18n.key.of.its.name"` | `js/extras.js` |
| `tint` | Each cuvée lights its bottle with its own ambient colour: an even haze of that colour behind the bottle, a coloured wash on the bottle and a tinted rim light. The page keeps its colour; only small details near the bottle take the hue (`tint` per cuvée in `config.js`, placeholders; strength is `HUE_GLOW` / `HUE_AMBIENT` / `HUE_RIM` in `bottle-3d.js`) | `js/bottle-3d.js`, `js/bottle-ring.js` |
| `glass` | "In the glass" section on the ring page: a flute in line drawing with rising bubbles, the three tasting words and serving notes | `js/extras.js`, `selection.html` |
| `chart` | Aroma chart beside the flute: six axes, values from `aromas` per cuvée in `config.js` (placeholders) | `js/extras.js` |
| `intro` | The loading screen plays on arrival at the home page and its bottle lands on the hero bottle | `js/loader.js`, `js/main.js` |
| `cursor` | Custom cursor: a dot at the pointer and a ring that trails it and widens over links, buttons and bottles. Mouse only; the system cursor is hidden while it is on | `js/extras.js` |
| `keys` | Arrow down / Page Down goes to the next section, arrow up / Page Up to the previous one, one press per section (the same sections as the gauge's checkpoints) | `js/motion.js` |
| `noselect` | Text on the site cannot be selected. Form fields and the test panel stay selectable | `css/base.css` |
| `noscrollbar` | The browser's own scrollbar is hidden; the page scrolls as before and the gauge shows progress | `css/base.css` |
| `ringHome` | The ring page replaces the home page; the scroll page stays at `index.html?all=1` | `js/main.js` |

## Motion

Set by `<html data-motion>`: `full`, `reduced` or `off` (`js/motion.js`).

- Scroll reveal: fade and slight rise as blocks enter the screen.
- Bottle tilt: on hover, a bottle leans a few degrees toward the pointer (`TILT_X` / `TILT_Y` in `motion.js`). Mouse only.
- Scroll settle: when scrolling stops within 35% of a screen from the top of a cuvée section, the page glides the rest of the way, so the bottle and its information are fully on screen (`SETTLE_RANGE` in `motion.js`; glide time is `SETTLE_MIN_MS` to `SETTLE_MAX_MS`). On desktop each cuvée section is exactly one screen tall for this reason.
- Gliding scroll: every scripted move of the page (the settle, the gauge's checkpoints, links such as "Discover the cuvées") uses one eased glide in `motion.js`. It lasts about 1 second for one screen and up to 2.6 seconds for the whole page (`GLIDE_MIN_MS` / `GLIDE_MAX_MS`), and stops as soon as the visitor scrolls.
- Tilt, settle, floating bottle and bubbles run in `full` only.
- Phones and tablets: the hero is one screen, and each cuvée is two screens (the bottle, then the text and cellar card). On touch screens the lock uses native CSS scroll snapping (`base.css`); the scripted settle is for mouse and trackpad only.
- Loading screen (test): `js/loader.js` draws a bottle that fills up. Nothing shows it automatically; play it from the test panel or with `?loader=1`.

## Before launch: delete the testing controls

1. Delete `js/testing-panel.js`.
2. Delete its `<script>` line in `index.html` and `404.html` (marked `TESTING ONLY`).
3. Delete the `TESTING ONLY` block at the end of `css/themes.css`.
4. Delete the two themes and two font pairs that were not chosen, with their `@font-face` rules in `css/fonts.css` and their files in `assets/fonts/`.
5. Remove the `.proto-badge` element and its styles, and the `noindex` meta tag.

The panel opens with the `T` key, `?test=1`, or the "Test (T)" tab. URL shortcuts: `?theme=`, `?fonts=`, `?lang=`, `?motion=`, `?age=ok`, `?age=reset`.

## Pages and parts added for launch

- `legal.html`: legal notice, terms of sale, privacy policy, cookie notice. Every footer links to it. PLACEHOLDER wording, to be written and checked by a lawyer.
- Cookie banner (`js/consent.js`): refuse, choose or accept, with equal weight; "Cookie settings" in the footer reopens it. Anything that later sets statistics or marketing cookies must first check `Consent.has("statistics")` / `Consent.has("marketing")`.
- Age question by country (`js/age-gate.js`): the visitor picks a country and is asked for the age that applies there (`AGE_BY_COUNTRY` in `config.js`, values to confirm).
- Food pairing per cuvée (`cuvees.N.pairing` in the i18n files): on the scroll page's cellar card and in the ring page's "In the glass".
- Gift option in the basket (shop modes `embed` and `basket`): a checkbox and a message, sent to Shopify in the checkout link as `attributes[gift]` and `note`. To check with the real store that its checkout keeps them.
- Release letter sign-up in every footer (`js/newsletter.js`). `NEWSLETTER_ACTION` in `config.js` says where to send it; empty means nothing is sent (prototype).
- Ring page: "Father and son" (`#maison`, two portrait placeholders and the house facts) and "Visits and contact" (`#contact`, address, hours, phone, email, map link from `MAP_URL`). Phone, email and address are placeholders.
- `changes.html` (TESTING ONLY): what changed in each version shared for review. Add an entry each time; delete before launch.

## Legal

- **Copy must be reviewed by a lawyer before launch.** Alcohol advertising in France is restricted by the Loi Évin: content must stay informational (producer, origin, composition, vinification, tasting). Swiss and EU rules also need checking for the markets served.
- The health line is in the footer of every page and in the age gate.
- The age gate asks for 18+. The legal drinking age differs by country (20 in Japan, for example): confirm the wording per market.
- Legal pages (mentions légales, CGV, privacy, cookies) do not exist yet.

## Shopify styling to match

Fill this in once a direction is chosen, so the Shopify theme matches the site.

| | Value |
| --- | --- |
| Heading font | TBD (candidates: Bodoni Moda / Gloock / Italiana) |
| Body font | TBD (candidates: Jost / Instrument Sans / Manrope) |
| Background | TBD (`--bg` of the chosen theme) |
| Text colour | TBD (`--fg`) |
| Button colour / text | TBD (`--btn-bg` / `--btn-fg`) |
| Corners | square, 1px hairline borders, no shadows |
| Logo | TBD (`assets/logo-placeholder.svg` for now) |

## Future

Future: 3D bottle scroll animation (Three.js or similar) goes into the `.bottle-stage` containers. Not in this prototype.

**3D test (in progress).** `js/bottle-3d.js` shows a 3D bottle in each cuvée's bottle stage. The models are PLACEHOLDERS: four generic wine bottles from one downloaded file (`assets/models/`, see the README there), carrying invented labels. `config.js` (`MODELS`) says which bottle goes to which cuvée. The hero keeps its placeholder image.

- Three.js 0.170.0 is loaded from unpkg only when a bottle stage first scrolls into view; nothing 3D is downloaded with the page. The model files total about 3.8 MB.
- Each bottle turns with the scroll and faces the front when its section is locked in place. Hovering leans it toward the pointer.
- The test panel has a "3D status" line that says, for the device in hand, whether each bottle is live and, if not, why (reduced motion, no WebGL, old browser, missing file).
- One WebGL renderer is shared by the four stages.
- The bottles have no panel behind them: the 3D scene is filled with the theme's own background colour.
- Bubbles rise inside each bottle. `BUBBLES_PER_BOTTLE` in `config.js` sets how many (0 = none); the test panel has a slider (0–160) that also scales the hero bubbles. `wine` in `MODELS` colours the liquid.

**Bottle ring test page (`selection.html`).** A second way to present the cuvées, kept apart from the home page for comparison. Its structure is modelled on moon-shine.fr, converted to wine. The 3D stage is pinned to the screen and four full-height screens scroll over it; scrolling moves the camera, not the bottle off the page:

1. the ring: the four bottles, the name of the one in front set large underneath with three tasting words, arrows either side, and a I–IV switcher (left edge on desktop). Change the selection with the arrows, the switcher, the left/right keys, by dragging the ring or by clicking a bottle. The cuvée can only be changed here, at the top of the page: once the visitor has scrolled into the sheet, the close-ups or the photographs, that cuvée stays until they go back up;
2. the cuvée sheet: the other bottles step back, the chosen one slides to the right, label-style rows and the order button come in on the left;
3. and 4. two close-ups of the bottle (top, then label) with a short text;
5. a row of five tall photograph placeholders that scrolls sideways (`ring.photos` in the i18n files, `assets/placeholder-photo.svg`; shared by the four cuvées for now).

On phones and tablets (below 960px wide) the page has three layouts to compare, chosen by `MOBILE_LAYOUT` in `config.js` or the test panel ("Mobile layout"):

| Layout | What it is |
| --- | --- |
| `window` (A) | The 3D stage is a solid window pinned to the top of the screen (`--stage-h`); each part of the text scrolls underneath it and rests just below |
| `fade` (B) | The stage fills the screen. The text of each part stays put at the bottom and fades in and out as you scroll from one part to the next |
| `rail` (C) | The stage is a tall column on the left showing one bottle; the text scrolls in a column on the right |

The rules are in `css/components.css` ("Phone layouts B and C"; A is the base). In none of them does text move across the bottle.

The camera position for each screen is the `POSES` table at the top of `js/bottle-ring.js`, with one set per layout (`wide`, `window`, `fade`, `rail`). Reach it from the test panel ("Pages") or open `selection.html` directly. To remove it: delete `selection.html`, `js/bottle-ring.js`, the "Bottle ring" block in `css/components.css` and the `ring` / `meta.titleRing` keys in `i18n/*.json`.
- The placeholder image stays as the fallback: reduced or off motion, no WebGL, missing file, or the page opened by double-click (3D needs a local server).
- To remove the test: delete `js/bottle-3d.js`, its `<script>` line and the import map in `index.html`, `MODELS` in `config.js`, and `assets/models/`.

Each cuvée section has one empty `<div class="bottle-stage" data-cuvee="N" aria-hidden="true">` laid over the image placeholder, on the right or in the centre of the section, with the text on the other side. A canvas can be mounted there without changing the layout.

## Known limits of this skeleton

- Text is injected by JavaScript, so the page is empty without it and search engines see little. Before launch, the chosen default language should be written into the HTML (or the site pre-rendered).
- `404.html` uses relative paths; a host serving it for deep URLs needs a `<base href>` or absolute paths.
- Not yet done: full screenshot review against the anti-generic rules, contrast audit, Lighthouse run, real photography.
