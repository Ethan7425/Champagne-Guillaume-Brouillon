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
| `SHOPIFY_BASE_URL` | `https://example.myshopify.com/products/` (placeholder) |
| `CUVEES[].slug` | `placeholder-cuvee-1` … `-4` |
| `CUVEES[].rose` | `true` on cuvée 3 only, to preview the rosé accent of Direction B |
| `AGE_GATE_ENABLED` | `true` |
| `DEFAULT_LANGUAGE` | `en` |
| `DEFAULT_THEME` | `craie-cave` |
| `DEFAULT_FONT_PAIR` | `pair-a` |
| `DEFAULT_MOTION` | `full` |

Each "Order" button and the mobile buy bar link to `SHOPIFY_BASE_URL + slug`, in the same tab. Adding or removing an entry in `CUVEES` adds or removes a section (the i18n `cuvees` array needs a matching entry).

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

## Motion

Set by `<html data-motion>`: `full`, `reduced` or `off` (`js/motion.js`).

- Scroll reveal: fade and slight rise as blocks enter the screen.
- Bottle tilt: on hover, a bottle leans a few degrees toward the pointer (`TILT_X` / `TILT_Y` in `motion.js`). Mouse only.
- Scroll settle: when scrolling stops within 35% of a screen from the top of a cuvée section, the page glides the rest of the way, so the bottle and its information are fully on screen (`SETTLE_RANGE` in `motion.js`; glide time is `SETTLE_MIN_MS` to `SETTLE_MAX_MS`). On desktop each cuvée section is exactly one screen tall for this reason.
- Tilt, settle, floating bottle and bubbles run in `full` only.

## Before launch: delete the testing controls

1. Delete `js/testing-panel.js`.
2. Delete its `<script>` line in `index.html` and `404.html` (marked `TESTING ONLY`).
3. Delete the `TESTING ONLY` block at the end of `css/themes.css`.
4. Delete the two themes and two font pairs that were not chosen, with their `@font-face` rules in `css/fonts.css` and their files in `assets/fonts/`.
5. Remove the `.proto-badge` element and its styles, and the `noindex` meta tag.

The panel opens with the `T` key, `?test=1`, or the "Test (T)" tab. URL shortcuts: `?theme=`, `?fonts=`, `?lang=`, `?motion=`, `?age=ok`, `?age=reset`.

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
- Each bottle turns with the scroll and faces the front when its section is locked in place. Its label, cork and wine move away from the glass as the section scrolls away. Hovering leans it toward the pointer.
- One WebGL renderer is shared by the four stages.
- The bottles have no panel behind them: the 3D scene is filled with the theme's own background colour.

**Bottle ring test page (`selection.html`).** A second way to present the cuvées, kept apart from the home page for comparison. The four bottles stand in a ring; the one in front is selected. Change it with the arrows, the I–IV buttons, the left/right keys, by dragging the ring or by clicking a bottle. The name, details and order link follow the selection; "See the details" (or a click on the front bottle) scrolls down to them. Reach it from the test panel ("Pages") or open `selection.html` directly. To remove it: delete `selection.html`, `js/bottle-ring.js`, the "Bottle ring" block in `css/components.css` and the `ring` / `meta.titleRing` keys in `i18n/*.json`.
- The placeholder image stays as the fallback: reduced or off motion, no WebGL, missing file, or the page opened by double-click (3D needs a local server).
- To remove the test: delete `js/bottle-3d.js`, its `<script>` line and the import map in `index.html`, `MODELS` in `config.js`, and `assets/models/`.

Each cuvée section has one empty `<div class="bottle-stage" data-cuvee="N" aria-hidden="true">` laid over the image placeholder, on the right or in the centre of the section, with the text on the other side. A canvas can be mounted there without changing the layout.

## Known limits of this skeleton

- Text is injected by JavaScript, so the page is empty without it and search engines see little. Before launch, the chosen default language should be written into the HTML (or the site pre-rendered).
- `404.html` uses relative paths; a host serving it for deep URLs needs a `<base href>` or absolute paths.
- Not yet done: full screenshot review against the anti-generic rules, contrast audit, Lighthouse run, real photography.
