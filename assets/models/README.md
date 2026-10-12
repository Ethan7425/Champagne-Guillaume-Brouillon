# 3D models

PLACEHOLDER models for the prototype. Which cuvée uses which model is set in `config.js` (`MODELS`).

## What is here

`wine_bottles_01` — one glTF model holding four bottles. All of these files are needed:

- `wine_bottles_01_1k.gltf` — the scene description (points to the files below)
- `wine_bottles_01.bin` — the geometry
- `textures/` — 12 images (glass, cork, paper and four labels), 1k resolution

Keep the names and the `textures/` folder as they are: the `.gltf` refers to them by path.

| Object name in the file | Used for | Glass | Height |
| --- | --- | --- | --- |
| `wine_bottles_01_champagne` | cuvée 1 | green | 31.6 cm |
| `wine_bottles_01_burgundy` | cuvée 2 | clear | 30.6 cm |
| `wine_bottles_01_alsace` | cuvée 3 | yellow | 33.1 cm |
| `wine_bottles_01_bordeaux` | cuvée 4 | orange-brown | 29.8 cm |

Source and licence: to be confirmed by whoever downloaded it (the file names match Poly Haven's "Wine Bottles 01", which is CC0). The labels on the bottles are invented brands, not the house's.

## Options per model (`config.js`)

- `src` — path to the `.gltf` or `.glb`
- `node` — name of one object inside the file; leave out to show the whole file
- `glass` — `true` replaces the model's materials with green-tinted glass
- `yaw` — optional, radians: turns the model if its front does not face the camera

Models must be opened through a local server (`npx serve`); browsers refuse to read them from a double-clicked page.
Draco- or meshopt-compressed files are not supported yet: export without mesh compression.
