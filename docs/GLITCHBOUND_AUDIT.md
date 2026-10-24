# GLITCHBOUND project audit

Audit date: 2026-10-23  
Workspace: `C:\Users\Abhinaykumar\OneDrive\Documents\GlitchBound`

## Scope and evidence

This refresh inspects the current worktree, project documentation, manifests, generated data, GLB headers, source text, and repository previews. The game was not launched in a browser during this refresh. The current English source scan, all 22 Node regression suites, and Blender-side text scans for all six saved scenes were run. Public-image contact sheets, packed Blender advert exports, and prior Blender scene previews are available under docs/ and were visually reviewed during the preceding localization work. Source and Blender text scans do not inspect lettering in image pixels.

Blender 5.2.3 LTS is installed at C:/Program Files/Blender Foundation/Blender 5.2/blender.exe. It opened each of the six .blend files for read-only text inspection. The Blender MCP tool registry in this Codex execution environment contains no Blender-specific tools; Antigravity's separate MCP session is not exposed here, so no Blender MCP access is claimed. Blender inspection was performed with the local CLI only.

No AGENTS.md was found. Current project documentation includes README.md, CONCEPT.md, QUALITY_ROADMAP.md, RELEASE_CHECKPOINT.md, THIRD-PARTY-NOTICES.md, blender/README.md, validation/README.md, docs/GLITCHBOUND_AUDIT.md, and docs/GLITCHBOUND_BRAND_GUIDE.md.

The inspected root layout includes package.json/package-lock.json, index.html, vite.config.js and vercel.json; runtime modules under src/; shipped images, GLBs, favicon, manifest and blueprint app under public/; build/export/check scripts under scripts/; native scenes, manifests and Blender Python under blender/; regression suites under tests/; historical evidence under validation/; and generated output/dependencies under dist/, node_modules/ and .pnpm-store/.

## Safe baseline

At the start of this refresh:

| Item | Recorded state |
|---|---|
| Branch | `main` |
| HEAD | `6bea17f` — `Ship completed hero assets and ground-contact fixes` (2026-09-06) |
| Git status | main tracks origin/main, with 20 modified tracked paths and 8 untracked paths at inspection start |
| Local edits | Existing Phase 1/2 source, Blender, generated-blueprint, documentation, and package changes were present and preserved. The lockfile has a local peer metadata edit. The character workshop scene and .pnpm-store are also local changes. |
| Audit edits | This refresh changes only docs/GLITCHBOUND_AUDIT.md; no source, gameplay, or asset edits were made for Phase 0. |
| Git checkpoint | None created; the branch and existing worktree state were preserved. |

The local setup URL remains http://127.0.0.1:5173/. Node.js 24.22.1 is available through the bundled runtime, but npm is not on this shell's PATH. package.json pins Three.js 0.180.0, cannon-es 0.20.0, and Vite 7.3.6 and requires Node 24.x. A direct Vite production build completed during the preceding Phase 2 work and passed with the existing large-chunk advisory. The historical release bundle checksum and old city-scene checksum below are not measurements of the current assets.

**Build preservation risk:** both npm run dev and npm run build trigger predev/prebuild, which execute scripts/export-blueprint.mjs and rewrite public/blueprint/blueprint.json. That generated file is locally modified, so review its diff after invoking either lifecycle command. This refresh ran the source scan and test runner directly with the bundled Node executable; it did not invoke those hooks.

## Architecture and browser startup

### Entry points

- `index.html` is the game shell: metadata, the inline SVG/wordmark, menu, HUD, dialogs, and `<script type="module" src="/src/main.js">`.
- `src/main.js` is the runtime bootstrap and frame loop. It owns the game mode, camera, input and HUD, and coordinates rendering, physics, world systems, combat, vehicle, services and audio.
- `src/city.js` composes the city from layout and expansion data; `src/city-layout.js`, `src/city-expansion.js`, and `src/city-blueprint.js` supply most of the static map and district structures.
- `public/blueprint/index.html` and `public/blueprint/blueprint.js` are a separate browser-based architectural map and inspector, backed by `public/blueprint/blueprint.json` and `city-blueprint.svg`.
- `vite.config.js` configures Vite; `vercel.json` and `.vercelignore` cover deployment.

### Startup sequence observed in `src/main.js`

1. Vite serves `index.html`, which presents the menu over an empty `#world` container and imports `src/main.js` as an ES module.
2. `init()` creates the WebGL renderer, camera, lighting/environment and post-processing; then creates the city, city life and atmosphere. The visible loading label changes to “City online. Loading Blender assets…”.
3. `GLTFLoader.loadAsync` requests `/assets/{interceptor,drone,crate,kiosk,mercenary,av,pulse-carbine,ion-bolt,muzzle-flash,impact-shards}.glb` in parallel. Six static game props are batched; the mercenary and weapon/VFX sources retain their named hierarchies. `relay.glb` exists but is not in this startup list.
4. The bootstrap attaches player/car/aircraft visuals, simulation and collision systems, weapon rigs/effects, shadows, city services and the generated service interface. It enables the start button, builds the map, writes `window.__glitchbound` and the compatibility alias `window.__neon` to the same diagnostic object, updates the HUD and starts `renderer.setAnimationLoop(animate)`.
5. The player enters only after clicking the start button. `start()` hides the menu, shows the HUD, changes mode, displays a first-run toast and requests pointer lock; right-drag is the fallback.
6. Initialization errors are caught and shown as GLITCHBOUND-branded startup failure text plus a WebGL/browser support message and toast. The render/update loop also handles movement, camera, physics, district/HUD updates and input-driven systems.

Dependencies imported by the entry module include Three.js, `cannon-es`, GLTFLoader, EffectComposer/RenderPass/UnrealBloomPass/OutputPass, and the city, simulation, audio, city-life, player movement, shadow, camera, combat, service and foot-contact modules. `src/service-world.js` depends on `service-fixtures.js` and `kinematic-pose.js`; `src/simulation.js` depends on street physics and broadphase; `src/street-collisions.js` reads `blender/asset-manifest.json` for exported bounds. The rest of `src/` contains separate world, city, civilian, surface, camera, weapon, audio and locomotion modules.

## Visible UI, maps, settings and title graphics

The static player-facing copy is in `index.html` and `src/style.css` / `src/free-roam.css`; interaction-generated copy is mainly in `src/main.js`, `src/service-interface.js`, `src/city-services.js`, and `src/service-world.js`.

| Surface | Visible content and behavior |
|---|---|
| Header | GLITCHBOUND mark; current district, VESPER CITY GRID and clock; map (M), sound state, controls and menu buttons |
| Start menu | GLITCHBOUND title, AFTER DARK city card, initializing/enter button, concept art and controls buttons, connection status, location coordinates, LIVE WORLD status, free-roam copy and GLITCHBOUND footer |
| HUD | District label and AFTER DARK subtitle; civic security/patrol/wanted state/crime reason; minimap and compass; E interaction prompt; vehicle name/speed/controls; health, neural capacity, kinetic dash, EMP, weapon/ammo/reload; movement/camera/menu hints; kill feed and transient toast |
| City map dialog | Street/district canvas, connected-streets scale, six districts (Kasumi Ward, Lantern Market, Iron Docks, Stacktown, Meridian East, Crown Plaza), YOU/interceptor/patrol/hostile/service/destination legend, service instructions, return button and link to the blueprint |
| Other dialogs | Concept art caption; controls/how-to-play and crime/security explanation; death/reconnect result and stats |
| Generated service interface | Nearby food, clinic, neural recharge, directory and garage prompts; progress/result, waypoint and parking guidance |
| Architectural blueprint page | GLITCHBOUND / CITY ATLAS header, VESPER CITY BLUEPRINT title, revision 05, open-game link, authored-view presets, fit/zoom/pan/inspect controls, layer/metric readouts, coordinates, selected-object details and SVG/JSON placement downloads. Eleven toggles cover roads/intersections, parcels, buildings, storefronts, authored blocks, walking routes, entrances, signs/brackets, structural supports, vehicle/kiosk anchors and overhead connections. |

There is no dedicated settings screen. The only explicit setting is the sound ON/OFF toggle in the header. The principal title graphic is HTML/CSS type plus an inline SVG mark; public/favicon.svg is a separate SVG icon, and public/manifest.webmanifest supplies app metadata. The concept image is opened in a dialog, not used as the title graphic. src/style.css imports Barlow, Barlow Condensed and Space Mono from Google Fonts, with system fallbacks; no font files are bundled under public/.

### E-to-enter-car text trace

- The nearby-car interaction element is the E key in index.html, with its label set in src/main.js. Within five metres of the interceptor, the runtime sets the label to “DRIVE YŪREI INTERCEPTOR” (src/main.js, prompt selection in updateHUD). Pressing E calls interact(); successful entry displays “INTERCEPTOR ONLINE // WASD DRIVE · E EXIT”. The in-vehicle HUD title is “YŪREI // INTERCEPTOR”, and its controls are English. Exiting shows “EXIT INTERCEPTOR” and “INTERCEPTOR // DISCONNECTED”.
- The visible word YŪREI is a romanized Japanese proper name, not Japanese-script text or a rendering failure. It is the likely non-English-looking word in the car prompt/HUD. KASUMI WARD and Kasumi in the death message are also romanized setting names. The source and Blender Unicode scans do not flag those Latin-script names; if strict all-English vocabulary is intended, these exact UI strings are localization candidates.
- Relevant exact source locations are index.html lines 40–41 and src/main.js lines 98, 252, 359–360. The E help text is in index.html and the input routing is in src/main.js.

## Branding and legacy-name inventory

| Name | Locations and treatment |
|---|---|
| `NEON DISTRICT` / `neon-district` | Removed from normal game title/start/HUD and the generated city brand sign. Remaining occurrences are technical compatibility paths and schema, upstream source attribution in README.md, compatibility diagnostics, and historical docs/validation. Do not rename the city .blend or native-character schema without updating every builder, verifier and consumer. |
| `VESPER CITY` / `VESPER` | Current in-world city name in the gameplay header and blueprint. Blender scenes and embedded data also use VESPER identifiers. This is a setting name, not the product name. |
| `VESPER ARC` | A commissioned in-world billboard brand in `src/advert-campaigns.js`, four placements, image artwork and blueprint records. It is not a city/project-name reference; a blanket replacement of “Vesper” would damage this campaign identity. |
| `KASUMI WARD` and six district names | World/district identity used throughout the interface, layout and maps; these are not project names. |

The README retains a third-party inspiration statement and source-provenance link in documentation, not gameplay UI. VESPER ARC is a commissioned in-world billboard identity, not the GLITCHBOUND product brand.

## Japanese Unicode and image-based text

Current source scan result: scripts/check-english.mjs passed and scanned 111 text files across src/, public/, blender/, scripts/, tests/, index.html, README.md and package.json. It found no Hiragana, Katakana or Han characters. The Blender-side scan passed on all six .blend files and checked scene, collection, object, FONT body, text datablock, material/action/font/world names, and string custom properties. These checks do not inspect pixels.

The pre-localization audit found Japanese-script text in the HUD subtitle in index.html, paired and prominent storefront/sign labels in src/city-layout.js, vertical signs in src/city-expansion.js, a sign-rendering special case in src/city.js, and generated records in public/blueprint/blueprint.json. Phase 1 replaced these in the shared JS source, generated blueprint and saved city scene. Those are historical locations, not current Japanese-script matches.

The Phase 1 localization contact sheet at docs/english-localization-contact-sheet.png shows all 18 public PNGs and the 17 extracted packed billboard images. All 17 ads have legible Latin-script campaign branding; no Japanese lettering was identified. public/assets/concept.png contains tiny distant details that are not classifiable at the available resolution. This is visual inspection, not OCR. The Blender CLI text check opened all six current scenes; it separately confirms there is no Japanese-script lettering in the scanned datablock text.

The city manifest lists these 17 images packed in the native city: `advert-portrait.png`, `advert-kuro-optics.png`, `advert-axiom.png`, `advert-orbital.png`, `advert-noodle.png`, `advert-recast.png`, `advert-kinkeep.png`, `advert-everon.png`, `advert-quietus.png`, `advert-vyra.png`, `advert-grinpop.png`, `advert-syntask.png`, `advert-nesto.png`, `advert-irisyn.png`, `advert-else.png`, `advert-vesper-arc.png`, and `advert-synthsilk.png`.

The extracted 17 packed city advert images match their public/assets counterparts pixel-for-pixel, as checked during localization. The separate image review is not part of either Unicode scanner and cannot certify tiny, unreadable background lettering.

## Blender sources and deliverables

### Native `.blend` files

There are six checked-in Blender projects:

| File | Role and known content |
|---|---|
| `blender/neon-district-city.blend` | Main editable city. The manifest records 3 scenes (`VESPER / street composition`, `VESPER / complete city aerial`, `VESPER / architectural blueprint`), 5 cameras, 160,453 voxel modules, 185 building envelopes, 646 editable signs, 5,775 structural supports, 45 elevated connections, 75 parcels, 16 roads, 17 packed billboard images across 91 panels, 16 animated road vehicles, 284 frame-zero civilian rigs/14,785 voxel parts, 16 overhead aircraft, 15 service mechanisms/318 parts and 31 authored blocks/2,413 modules. The main scene collections declared by `build_city.py` are `01 CITY / editable voxel architecture`, `02 NEON / editable signage`, `03 GAMEPLAY / Blender asset kit`, `04 STREET LIFE / commuters and traffic`, `05 LIGHTING / cameras and atmosphere`, `07 STREET FRONTS / attached entrance assemblies`, `08 SERVICE MECHANISMS / editable idle fixtures`, `09 AUTHORED BLOCKS / residential court and market`, and `10 CITIZENS / exact resolved runtime population`; the aerial scene also adds `06 AERIAL / exclusive overview lighting`. The separate blueprint scene declares 11 `PLAN / ...` collections for sheet/grid, roads, building footprints, parcels/setbacks, supports, districts/labels, dimensions/legend, signs/anchors, elevated connections, street fronts and authored-block circulation. The README notes that this full city retains the earlier six-part hero, while the current standalone hero export is ten parts. |
| `blender/cyberpunk-assets.blend` | Native voxel prop/character kit produced by `build_assets.py`; the preview shows the interceptor, patrol craft, mercenary, kiosk and props. Its camera is named `Asset kit overview`. The focused hero workflow patches the hero into this file and exports `mercenary.glb`. |
| `blender/pulse-carbine.blend` | M-09 carbine and projectile-effects authoring scene (`M-09 / weapon workshop`); editable part/socket hierarchy and preview camera. |
| `blender/service-actions.blend` | Exterior fixture action workshop (`VESPER / exterior service mechanisms`); per-service mechanism collections plus an inspection rig; keyed active, success/cancel action data is represented in `service-fixtures.json`. |
| `blender/character-workshop.blend` | Two scenes: `VESPER / exact character population` and `VESPER / editable motion workshop`. The former stores the 284 exact frame-zero city placements; the latter has four finite 30 Hz clips. The saved verification report names them `CIV-002-walk-stop-turn`, `CIV-002-flee-curb`, `CIV-001-walk-stop-turn`, and `CIV-001-flee-curb`. Characters are rigid voxel meshes with editable armatures/vertex groups, not live runtime navigation. |
| `blender/hero-pose-workshop.blend` | `VEX / articulated hero inspection`; separate workshop for three authored static hero poses and support risers. It validates the authored poses, not the live gait. |

The six saved scenes were opened read-only in Blender 5.2.3 LTS for an object/data count and English-text check. Snapshot counts:

| File | Scenes / collections | Objects (mesh / FONT) | Armatures | Materials | Actions | Packed images |
|---|---:|---:|---:|---:|---:|---:|
| character-workshop.blend | 2 / 4 | 592 (294 / 4) | 288 | 45 | 4 | 0 |
| cyberpunk-assets.blend | 1 / 0 | 21 (16 / 0) | 0 | 44 | 0 | 0 |
| hero-pose-workshop.blend | 1 / 1 | 45 (34 / 3) | 0 | 17 | 0 | 0 |
| neon-district-city.blend | 3 / 21 | 14,304 (10,550 / 1,299) | 284 | 304 | 23 | 17 |
| pulse-carbine.blend | 1 / 5 | 37 (25 / 0) | 0 | 12 | 3 | 0 |
| service-actions.blend | 1 / 16 | 1,349 (1,324 / 0) | 0 | 144 | 243 | 0 |

The counts above come from direct Blender datablock queries; they do not count evaluated dependency-graph instances. The city has 10,550 mesh objects but 10,530 unique mesh datablocks. Summed per unique mesh datablock, it has 1,119,920 polygons and 1,509,824 vertices; summed per mesh object, it has 1,127,774 polygons and 1,520,296 vertices. This reconciles the two geometry totals in the older Phase 1 record. The city-scene manifest is 63,107,383 bytes with SHA-256 06c5b451aa2fc9b5c0a107170878f161700b8267a4341edf8eb4e18f1355167f. Its manifest still says Blender 5.2.1 LTS; the installed 5.2.3 LTS opened it and the other five files successfully. No file was saved during this inspection. All six Blender text scans passed. The full 304-name city material list was not exported; the count, material-builder sources, and GLB material names above provide the current inventory.

### Blender Python source (all 19 files)

| Script/module | Responsibility |
|---|---|
| `blender/build_city.py` | Evaluates shared JS city data through Node; creates, packs, saves and optionally renders the editable city scenes. |
| `blender/build_blueprint.py` | Creates the native architectural plan scene and its 11 editable plan layers. |
| `blender/build_assets.py` | Authors/exports the voxel prop kit and asset manifest. |
| `blender/build_weapon.py` | Authors/exports the M-09 plus bolt, flash and impact chips; writes attachment manifest. |
| `blender/build_service_fixtures.py` | Builds the standalone service-action workshop from exported service recipes. |
| `blender/build_characters.py` | Builds and freshly reopens the population and finite-clip workshop. |
| `blender/hero_articulation.py` | Exports the focused ten-part hero and generates/verifies its pose workshop. |
| `blender/native_layout.py` | Calls Node to evaluate shared layout and native character exports for Blender. |
| `blender/native_characters.py` | Constructs/validates Blender citizen armatures, meshes, material assignments and embedded source export. |
| `blender/advert_materials.py` | Creates/adapts image-backed billboard materials and image planes. |
| `blender/refresh_adverts.py` | Refreshes billboard artwork/placements in the existing city and updates embedded data/manifests. |
| `blender/surface_materials.py` | Defines editable concrete, paving and metal shader treatment. |
| `blender/practical_lights.py` | Adds/verifies mapped native dock practical lights. |
| `blender/render_hero.py` | Reopens and renders the focused hero workshop. |
| `blender/verify_city.py` | Fresh-reopen/source equality, geometry, service, image, character, vehicle and lighting checks for the native city. |
| `blender/check_english_text.py` | Read-only scan of Blender scene/object/text/material/action/world labels and string properties for Japanese-script Unicode; does not inspect pixels. |
| `blender/export_packed_images.py` | Extracts packed images for visual inspection without saving the source scene. |
| `blender/localize_city_text.py` | Dry-run/write-capable city text localization utility; --write is a mutating option and was not run in this audit refresh. |
| `blender/render_localization_preview.py` | Renders a focused street/sign preview from the city scene. |

`blender/asset-manifest.json`, `blender/city-scene-manifest.json`, `blender/weapon-manifest.json`, and `blender/service-fixtures.json` are runtime/build references, not documentation. The city source packs the poster PNGs in its `.blend`; the campaign catalog and authoritative blueprint are also embedded as Blender text data.

### Model exports and runtime contracts

There are 11 GLB files under `public/assets/`; the JSON chunk of each was read for node, mesh, skin, animation and material names.

| Export | Runtime role / notable hierarchy |
|---|---|
| `interceptor.glb` | Driveable/parked K-77 vehicle |
| `mercenary.glb` | Player avatar; nodes `head`, `torso`, `left_arm`, `right_arm`, `left_leg`, `right_leg`, `left_knee`, `right_knee`, `left_foot`, `right_foot` |
| `av.glb` | Patrol aircraft |
| `drone.glb` | Security drone |
| `crate.glb` | Explosive cell |
| `kiosk.glb` | Noodle stall |
| `relay.glb` | Data relay; not requested by `src/main.js` startup and described as unused in city placements |
| `pulse-carbine.glb` | M-09 with separate `bolt`, `magazine`, `trigger`, `muzzle_socket`, `eject_socket`, sight and grip sockets, and receiver/barrel/stock components |
| `ion-bolt.glb` | Projectile visual, nose at origin and tail along +Z |
| `muzzle-flash.glb` | Angular muzzle flash, extending from its origin along -Z |
| `impact-shards.glb` | Ten individually named `shard_00`–`shard_09` meshes |

The exports use glTF metres, Y-up, forward along -Z; Blender uses Z-up, forward +Y; the documented conversion is Three coordinates `(x,y,z)` to Blender `(x,-z,y)`. Weapon values are part of the integration contract: `muzzle_socket` at `(0, 0.103, -0.746)`, direction `(0,0,-1)`; `eject_socket` at `(0.095,0.144,-0.053)`; `bolt`, `magazine`, `trigger`, socket and shard names are consumed by `src/weapon-rig.js` / `src/weapon-vfx.js`. The live player animation queries the mercenary's named leg/arm nodes in `src/main.js`; foot contact queries `left_foot` / `right_foot` with leg fallback. Preserve these names and local transforms unless runtime code changes with them.

The GLB files contain no glTF `skins` or `animations` in the inspected headers. Runtime motion is applied in Three.js to rigid named parts; the editable Blender citizen armatures and finite animations are native `.blend` deliverables. That makes Blender workshop animation data distinct from runtime GLB animation clips.

### Image assets and previews

There are 18 PNGs in `public/assets/`: 17 billboard textures plus `concept.png`.

- Original five billboard textures: `advert-axiom.png`, `advert-kuro-optics.png`, `advert-noodle.png`, `advert-orbital.png`, `advert-portrait.png`.
- Twelve campaign textures: `advert-recast.png`, `advert-kinkeep.png`, `advert-everon.png`, `advert-quietus.png`, `advert-vyra.png`, `advert-grinpop.png`, `advert-syntask.png`, `advert-nesto.png`, `advert-irisyn.png`, `advert-else.png`, `advert-vesper-arc.png`, `advert-synthsilk.png`.
- Prompt/reference data: `advert-prompts.json` and `user-advert-prompts.json`.

There are 12 Blender preview renders in `blender/`: `asset-kit-preview.png`, `character-workshop-preview.png`, `city-aerial-preview.png`, `city-blueprint-preview.png`, `city-docks-preview.png`, `city-docks-roof-preview.png`, `city-housing-preview.png`, `city-scene-preview.png`, `hero-knee-preview.png`, `hero-pose-preview.png`, `hero-side-preview.png`, and `pulse-carbine-preview.png`. The current localization contact sheet and Blender close-up previews are in docs/. The older validation renders and contact sheet remain historical. The full-city aerial, street and blueprint previews predate some authored-block/service work; preview images help locate visual text but do not replace the read-only scene inspection above.

The `validation/` directory is a historical evidence archive of 438 files: 246 PNG, 165 JSON, 11 gzip captures, 7 Markdown reviews, 7 WebM clips, one HTML contact sheet and one text test log. It contains browser captures, Blender renders, source diagnostics and multiple intermediate/failure captures; artifacts are build-specific and should not be treated as all current-build results.

### Materials, rigs and animation data

The exported GLBs contain these named material slots in their inspected JSON chunks:

| Export | Material names |
|---|---|
| `av.glb` | armor charcoal; armor graphite; carbon rubber; obsidian glass; armor bluegrey; armor steel; display black; ion cyan; headlight white; signal red; hot magenta |
| `crate.glb` | midnight ceramic; carbon rubber; titanium navy; gunmetal edge; hazard amber; hot magenta; display black; ion cyan; pale markings |
| `drone.glb` | midnight ceramic; titanium navy; display black; hot magenta; pale markings; ion cyan; gunmetal edge; carbon rubber; hazard amber |
| `impact-shards.glb`, `ion-bolt.glb` | M09 / white; M09 / cyan; M09 / amber; M09 / steel |
| `interceptor.glb` | armor charcoal; armor graphite; carbon rubber; armor bluegrey; titanium navy; obsidian glass; armor steel; display black; signal red; headlight white; hazard amber; ion cyan; pale markings |
| `kiosk.glb` | carbon rubber; midnight ceramic; gunmetal edge; ion cyan; hot magenta; hazard amber; display black; titanium navy; paper cream; pale markings |
| `mercenary.glb` | armor charcoal; warm skin; display black; armor graphite; ion cyan; armor bluegrey; carbon rubber; hazard amber; armor worn edge; black fabric; armor steel; weathered khaki; signal red |
| `muzzle-flash.glb` | M09 / white; M09 / cyan; M09 / amber |
| `pulse-carbine.glb` | M09 / steel; M09 / navy; M09 / cyan; M09 / ceramic; M09 / bright steel; M09 / black; M09 / amber; M09 / rubber; M09 / magenta; M09 / markings |
| `relay.glb` | carbon rubber; gunmetal edge; midnight ceramic; titanium navy; display black; obsidian glass; ion cyan; acid green; hot magenta; hazard amber; pale markings |

The city material builder creates per-voxel-category and per-sign/panel materials. `surface_materials.py` defines world-space concrete, paving and metal finishes; documented base roughness/metalness are .86/.08, .91/.025 and .57/.66. The dock profiles `paintedSteel`, `contactMetal`, and `oxide` are also source-driven. Blender inspection counted 304 materials in the current city scene and 17 packed images. GLB material names are listed above; a full dump of every native material name remains a follow-up if an exact per-slot comparison is needed.

## Source-to-Blender and Blender-to-game workflows

- The city is source-derived: `blender/native_layout.py` evaluates `src/city-layout.js` and shared source modules through Node. `build_city.py` also reads layout/blueprint corrections, asset placements, city life, service fixtures, authored block compositions and the exported civilian population. It creates editable Blender geometry and scenes. `build_blueprint.py` makes the plan scene from the same plan data.
- `blender/build_assets.py` creates `cyberpunk-assets.blend`, `asset-manifest.json` and prop GLBs in `public/assets/`; the hero articulation path can replace the hero export and workshop without rebuilding the whole city.
- `blender/build_weapon.py` authors `pulse-carbine.blend`, exports the four weapon/VFX GLBs and writes `weapon-manifest.json`.
- `node scripts/export-service-fixtures.mjs` generates `blender/service-fixtures.json`; `build_service_fixtures.py` then generates `service-actions.blend`.
- `node scripts/export-native-characters.mjs --output blender/native-characters.json.gz` feeds `build_characters.py`, which generates `character-workshop.blend` and a report.
- `scripts/export-blueprint.mjs` generates the served SVG/JSON blueprint from JS layout data. It runs automatically before dev and build.
- Blender advert artwork is refreshed by `refresh_adverts.py`; `advert_materials.py` loads/creates image material and panel geometry. `verify_city.py` and the character/weapon builders contain source/reopen assertions.

## Build, test and known validation state

`package.json` records name `glitchbound`, ESM, Node `24.x`, Three `0.180.0`, `cannon-es` `0.20.0`, and Vite `7.3.6`.

| Command | Effect |
|---|---|
| `npm ci` | Installs the lockfile dependencies; README requires Node.js 24.x |
| `npm run dev` | Runs `predev` blueprint export, then `vite --configLoader native` |
| `npm run build` | Runs `prebuild` blueprint export, then Vite production build |
| `npm run preview` | Serves the production build through Vite |
| `npm test` | `node scripts/test.mjs`, which discovers and runs 22 `tests/*.test.mjs` suites |
| `npm run check:english` | Runs `node scripts/check-english.mjs`; scans textual source and explicitly excludes image pixels |
| `node scripts/export-blueprint.mjs` | Regenerates public blueprint assets; writes the locally modified `public/blueprint/blueprint.json` |
| Blender city pipeline | `blender --background --python blender/build_assets.py`; `blender --background --python blender/build_weapon.py`; `node scripts/export-service-fixtures.mjs`; `blender --background --python blender/build_service_fixtures.py`; `blender --background --python blender/build_city.py` |
| Character workshop | `node scripts/export-native-characters.mjs --output blender/native-characters.json.gz`; then `blender --background --threads 2 --python blender/build_characters.py -- --export blender/native-characters.json.gz --output blender/character-workshop.blend --report validation/native-character-workshop.json --render` |
| CPU city reopen | `blender --background --threads 2 --python blender/build_city.py -- --skip-render --preserve-views` |

Baseline checks for this refresh:

- Bundled Node 24.22.1 ran `scripts/check-english.mjs`: passed, 111 text files scanned, no Japanese-script matches. The scan does not inspect image pixels or Blender binary data.
- `scripts/test.mjs`: 22/22 existing regression suites passed. The native-character exporter suite uses a temporary directory and removes its generated files.
- Blender 5.2.3 LTS opened all six .blend files read-only. `check_english_text.py` found no Japanese-script text in the scanned datablocks in any of them.
- A direct Vite production build completed during the preceding Phase 2 work; it passed with the existing advisory for a generated chunk over 500 kB. This refresh did not launch a browser or rerun the build lifecycle hook because it regenerates the already-modified blueprint JSON.
- `npm` is not on this shell's PATH. Use the package commands from a Node 24 environment with npm installed; this execution used the bundled Node binary directly.

`RELEASE_CHECKPOINT.md` records seven actual-input browser groups passing with no page/console/failed-local-resource errors in that September 6 capture; this refresh did not reproduce those browser groups. `validation/README.md` identifies an empty/interrupted historical ragdoll browser capture and retained adverse/intermediate captures; they are not current failing tests. `QUALITY_ROADMAP.md` says the broader quality target is incomplete. The Vite large-chunk advisory remains.

## Integration gaps and risks

1. **A romanized Japanese vehicle name remains player-facing.** The E prompt and in-car HUD say YŪREI. It is a proper name rather than Japanese-script text, but it may be the non-English term the player sees. Kasumi is also used as a romanized district name. Decide their treatment before changing ordinary text.
2. **Generated artifact can overwrite local work.** `predev` and `prebuild` rewrite the already-modified blueprint JSON. Review that generated diff after running either command.
3. **Native and runtime hero snapshots differ.** The main city `.blend` is documented as holding an earlier six-part hero; the current `mercenary.glb` and kit are ten-part. Runtime animation/contact code depends on exact node names and falls back between foot and leg nodes.
4. **Blender MCP is unavailable in this execution.** Blender 5.2.3 CLI successfully opened all six scenes and produced text/count checks, but no Blender-specific MCP tools are registered in this Codex session. Antigravity MCP operations remain unverified here.
5. **GLB object contracts are gameplay dependencies.** `muzzle_socket`, `eject_socket`, `bolt`, `magazine`, `trigger`, hero part names, local axes and Y-up/-Z-forward orientation are consumed by runtime code. Asset-only edits can silently break weapon origins, reload motion, collision bounds, feet and animation.
6. **Source and generated data must stay synchronized.** Blueprint JSON/SVG, service fixture JSON, Blender scenes, advert catalog and runtime JS share IDs/placements/hashes. Editing generated JSON or packed artwork alone can leave the code, browser map and native file disagreeing.
7. **Evidence has mixed provenance.** The validation archive includes many historical runs and known interrupted/adverse captures. Check report build IDs and dates before accepting them as evidence for a new source state.
8. **Runtime compatibility.** Supported setup documented by the project is Node 24.x, HTTP-served Vite (not `file://`), Chrome/Edge with WebGL/hardware acceleration, Three.js 0.180.0 and Cannon-es 0.20.0. Blender source generation documents Blender 5.x; the city manifest names 5.2.1 LTS while this environment opened the files with 5.2.3 LTS.
9. **Font delivery is network-dependent.** Barlow and Space Mono are imported from Google Fonts, with system fallbacks. No font assets are bundled locally, so exact typography depends on network/font availability.

## Implementation checklist, ordered by dependency and risk

1. Preserve the current worktree as found; review existing edits before any new build or generation step.
2. Decide whether YŪREI and Kasumi remain as in-world proper names or should be replaced for a strictly English vocabulary. Keep VESPER ARC as advertiser identity and VESPER CITY as the current setting name unless specifically retitled.
3. If text changes are requested, edit authoritative HTML/JS/Blender text sources first and regenerate derived blueprint/scene data only after reviewing the current generated diff.
4. Verify affected visible text in a live browser, especially the E-to-enter-car prompt, in-car HUD, exit prompt, startup, help, map and error states. The current source scans do not replace visual verification.
5. Preserve GLB node/socket names, coordinate axes, file/schema paths and manifest contracts. Run the English scanner, 22-suite test runner, production build and read-only Blender scans; compare generated diffs and scene invariants before accepting changes.

## Phase 0 refresh: verified current findings

This section is the current-worktree summary for the Phase 0 audit refresh; the Phase 1/2 sections below are historical records of the earlier implementation work.

- Git baseline: branch main at 6bea17f, tracking origin/main. At the start of this refresh there were 20 modified tracked paths and 8 untracked paths from the earlier localization/rebrand work plus existing local data. Those changes were preserved. This refresh edited only this audit document.
- Startup and visible UI: index.html imports src/main.js. The runtime creates the Three.js scene and world systems, then loads ten GLBs from public/assets in parallel; relay.glb is retained but not loaded by the main startup. UI strings live in index.html, src/main.js, service-interface.js, city-services.js and related modules. Current player-visible surfaces are GLITCHBOUND, the VESPER CITY setting/grid, six district names, controls, security HUD, map, car HUD, help/results dialogs, service prompts, loading state and branded errors.
- Car interaction language finding: before entry, the E prompt says DRIVE YŪREI INTERCEPTOR; after entry the header says YŪREI // INTERCEPTOR. Entry/exit notifications and the driving instructions are English. YŪREI is a romanized Japanese proper name, not Japanese-script text; it is the likely non-English-looking word reported by the player. KASUMI is another visible romanized setting name. The exact prompt sources are index.html and src/main.js. No browser screenshot was captured in this refresh, so the displayed wording is confirmed from the source rather than a new live reproduction.
- Japanese-script status: scripts/check-english.mjs passed on 111 text files. The six Blender scenes passed blender/check_english_text.py. The historical examples elsewhere in this audit and validation/ are intentionally retained as non-shipped evidence and are excluded from the scanner. Raster checks are separate: docs/english-localization-contact-sheet.png visually covers all public PNGs and 17 packed city images. The ads read as English; tiny distant wording in concept.png is not legible enough to classify.
- Blender capability and inventory: there are six .blend files, 19 Blender Python files, 11 GLB exports, 18 public PNGs and 17 packed city billboard images. Blender 5.2.3 LTS opened each .blend read-only; no Blender MCP tools are registered in this execution. The scene-level object/material/action counts are in the inventory table above. City scene manifest size/hash currently reads 63,107,383 bytes / 06c5b451aa2fc9b5c0a107170878f161700b8267a4341edf8eb4e18f1355167f.
- Baseline checks: scripts/test.mjs passed 22/22 suites. The English source scan and all six Blender text scans passed. A direct Vite production build passed in the preceding Phase 2 work with the existing >500 kB chunk advisory. No gameplay behavior, physics, city geometry, source assets or saved Blender files were modified in this Phase 0 refresh.

### Exact files likely to require changes if the English-text issue is continued

- For the reported car prompt/HUD only: index.html (E interaction/vehicle HUD labels) and src/main.js (nearby-car prompt, entry/exit notifications and dynamic HUD copy). Changing YŪREI would be a proper-name decision, not a Japanese-script repair.
- If district/storefront text also changes: src/city-layout.js, src/city-expansion.js and src/city.js are the source layer. Rebuild public/blueprint/blueprint.json and city-blueprint.svg through scripts/export-blueprint.mjs; update blender/neon-district-city.blend only if corresponding editable scene text changed.
- If another player-facing product/map label changes: public/blueprint/index.html, scripts/export-blueprint.mjs, README.md, package.json, public/favicon.svg and public/manifest.webmanifest are the relevant owned surfaces. Keep license and source-provenance notices.
- Do not rename blender/neon-district-city.blend, its references in Blender builders/manifests, the neon-district-native-characters schema, or window.__neon without migrating all writers/readers and preserving the compatibility alias. These are technical identifiers, not player-facing copy.

### Recommended implementation order

1. Confirm whether YŪREI and KASUMI are retained proper names or should be replaced for strict all-English vocabulary.
2. Change only the authoritative player-facing strings in index.html/src/main.js, or the shared city text sources if the requested scope includes districts and storefronts.
3. Regenerate derived blueprint/Blender text only from authoritative sources; review the locally modified generated JSON and keep image-art changes separate from Unicode scanning.
4. Verify the E entry/exit experience and all loading, HUD, help, map, error and service text in a live browser; use the Blender CLI for saved-scene inspections because MCP is unavailable here.
5. Run the English scan and existing tests, build the production bundle, inspect the Vite advisory and verify GLB node/socket contracts and Blender scene geometry/counts remain stable.

---

## Phase 1 update: English localization

### Scope and implementation

- The source scan found Japanese-script text in the runtime HUD, procedural district signage, and English/Japanese paired sign labels. `index.html` now says **AFTER DARK**. `src/city-layout.js` and `src/city-expansion.js` use English sign and storefront labels; `src/city.js` uses the English neural-circuit label and an English-capable canvas font stack. The labels remain tied to their existing sign placements and artwork types.
- The saved `blender/neon-district-city.blend` was localized in place. The pass updated 646 sign records, Blender text rows and embedded sign source text; it also corrected 25 stale sign `record` properties to match the generated public blueprint. The pass left mesh/object/polygon/vertex totals unchanged: 10,530 meshes, 14,304 objects, 1,119,920 polygons, and 1,509,824 vertices.
- The six discovered Blender files were reopened through the installed Blender 5.2.1 command-line application and checked with `blender/check_english_text.py`: `character-workshop.blend`, `cyberpunk-assets.blend`, `hero-pose-workshop.blend`, `neon-district-city.blend`, `pulse-carbine.blend`, and `service-actions.blend`. No Japanese-script text remained in the checked names, labels, text objects, or custom properties. Only the city file needed a localization edit.
- Browser CSS now declares Barlow with Segoe UI and Arial fallbacks; generated canvas signs use the same English-capable stack. These fallbacks cover English letters, punctuation, and common symbols without relying on the remote font import. No gameplay, physics, vehicle, NPC, combat, or city geometry code was changed.
- `package.json` adds `npm run check:english`. `scripts/check-english.mjs` scans 111 textual files across `src/`, `public/`, `scripts/`, `tests/`, `blender/`, plus the root HTML/README/package manifest. It checks Hiragana, Katakana, and Han Unicode ranges and reports locations/code points. It deliberately skips binary images and Blender files: it does not detect text embedded in pixels. `blender/check_english_text.py` is the separate Blender-side scan.

### Raster and Blender image inspection

- `docs/english-localization-contact-sheet.png` contains all 18 PNGs under `public/assets/` (17 advertisements and the concept image) plus all 17 packed Blender billboard image exports, with source labels. The advertisements were inspected in the contact sheet and individually at native resolution where needed; their visible wording is English. The noodle poster has decorative bowl-side marks that appear geometric rather than legible Japanese. The concept image shows the English **NOODLES** sign; some tiny distant artwork lettering is too small to classify from that image, and no Japanese text was visible.
- `blender/export_packed_images.py` extracted the 17 discoverable packed city billboard images to a temporary inspection directory. Pixel comparisons against their corresponding public advert PNGs were identical. The packed assets therefore need no replacement. The Blender camera preview at `docs/english-localization-blender-preview.png` shows the updated English sign objects in the saved city scene.
- The image review is a separate visual check from the source Unicode validator. Neither the source scanner nor the Blender text scanner claims to inspect pixels.

### Retained names and branding

- No Japanese-script exception is intentionally retained in shipped UI or scene text. Romanized/proper names remain where they are already English-readable: **KASUMI WARD**, **VESPER CITY**, **VESPER ARC**, and **YŪREI**. At the Phase 1 checkpoint, the English brand **NEON DISTRICT** remained because that phase covered localization and the final rebrand decision was unresolved; Phase 2 below records its replacement. No proper name was translated solely because of its origin.
- Historical Japanese examples in this audit and prior validation records describe the pre-localization state. `docs/` and `validation/` are excluded from `check-english.mjs` so those records can remain useful; they are not shipped game text. The shipped-source scan has no unexplained Japanese-script matches.

### Validation and current baseline

- `node scripts/check-english.mjs`: passed; 111 text files scanned, no Japanese-script matches.
- Existing test suite: **22/22 suites passed** with `scripts/test.mjs`.
- Vite production build: passed. Vite still reports the existing advisory that a generated chunk exceeds 500 kB.
- Production preview was opened at `http://127.0.0.1:4173/`; the English HUD and nearby city signs were visually confirmed in the running game.
- Blender scan passed for all six `.blend` files. The city scene was saved and reopened for the English preview; geometry totals stayed fixed. `blender/city-scene-manifest.json` records the updated city file size and checksum. The public blueprint JSON was regenerated from its JavaScript layout source.
- The Phase 0 Git baseline was branch `main` at `6bea17f`. The pre-existing `package-lock.json` local edit was preserved. The current working tree also includes the generated localized blueprint and Phase 1 files; no branch or checkpoint was created.
- The current Codex tool session does not expose an Antigravity Blender MCP connector, so MCP operations cannot be confirmed from this session. Blender CLI operations were available and are the verified inspection path; no MCP operation is claimed.

### Remaining visual review

- No Japanese pixels were identified in the reviewed public or packed artwork. If the concept art is revised later, inspect the tiny background lettering from a higher-resolution source before changing or removing any sign.
- The browser and Blender previews confirm the updated nearby signs. The current brand and romanized district names are retained as documented above; a future branding decision should be handled as a separate scoped change.

### Phase 1 implementation checklist, ordered by dependency and risk

1. Preserve the Phase 0 local edits and establish the authoritative source (`src/`) before generated output. Completed: existing lockfile edit preserved; blueprint regenerated from source.
2. Replace source-visible Japanese and ensure English font fallback coverage before rebuilding. Completed: HTML, procedural city labels, canvas font stack, and `check:english` validator updated.
3. Inspect raster and packed Blender artwork before replacing assets. Completed: public contact sheet and packed-image comparison found no Japanese artwork requiring replacement.
4. Update Blender text in place, then inspect saved scene and geometry invariants. Completed: city signage localized; all six Blender files passed text scan; city geometry counts stayed unchanged.
5. Run source scan, existing tests, production build, browser preview, and Blender reopen checks. Completed: scanner passed, 22/22 suites passed, production build and preview succeeded, and Blender inspection passed. The chunk-size advisory remains for a later performance phase.

## Phase 2 update: complete GLITCHBOUND rebrand

- `docs/GLITCHBOUND_BRAND_GUIDE.md` is the brand reference: it defines the GLITCHBOUND wordmark, open-G icon, palette, typography, interface hierarchy, signage rules, and compatibility naming.
- `public/glitchbound-logo.svg` is the shared original vector logo: an open-G signal icon and custom GLITCHBOUND stroke wordmark. The title screen, persistent top bar, and atlas use this asset. `public/favicon.svg` is the icon-only companion used by the browser and by `public/manifest.webmanifest` for installed apps.
- `index.html`, runtime loading/success/failure copy, the title screen, HUD masthead, map dialog, concept overlay, metadata, city atlas page, and generated blueprint title identify GLITCHBOUND. The atlas now includes the same shared logo asset.
- The browser palette uses obsidian `#080A12`, cyan `#00E5FF`, magenta `#FF2BD6`, lime `#C7FF4A`, and amber `#FFB020`. Existing Barlow/Space Mono stacks keep system font fallbacks for English, punctuation, and common UI symbols.
- Runtime diagnostics are exposed through `window.__glitchbound`; `window.__neon` points to the same object for existing test tools. The package name is `glitchbound`.
- The generated city sign source in `src/city-expansion.js` and the matching Blender text object/data block were changed from `NORTH / NEON DISTRICT` to `NORTH / GLITCHBOUND`. The saved Blender city was reopened after the edit; its object and mesh totals and 17 packed images remain intact. The city manifest size and SHA-256 were refreshed.
- The contact sheet from Phase 1 was revisited for brand artwork. Its public and packed advertisements use distinct in-world advertiser names; none contains the old product wordmark, so those advertisements were preserved. No pixel artwork was cropped or stretched. The GLITCHBOUND icon is vector artwork rather than a replacement raster advertisement.
- The production build was rerun after adding the shared logo and atlas metadata. The English scanner passed on 112 text files, and the built app, logo, favicon, manifest, concept image, and atlas assets were served from Vite preview. A browser-panel preview request was queued; the browser-control surface in this Codex Work session is disabled, so an interactive game screenshot could not be captured here. The vector logo was raster-previewed and checked visually.
- Remaining legacy text is confined to provenance or compatibility: the Blender source filename and references (`neon-district-city.blend`), the native-character schema string (`neon-district-native-characters`), `window.__neon`, upstream repository attribution, and historical validation records. These names are documented in the brand guide and are not rendered as normal gameplay UI. Generic Blender object names containing “neon” describe neon lighting and remain descriptive rather than product branding.

### Phase 2 implementation checklist

1. Replace player-facing product identity and startup/error copy. Completed in browser HTML and runtime source.
2. Establish vector wordmark/icon, palette, typography, and signage rules. Completed in `docs/GLITCHBOUND_BRAND_GUIDE.md`, `public/favicon.svg`, and `public/manifest.webmanifest`.
3. Rebrand maps and generated scene text while preserving saved asset contracts. Completed; source and saved Blender sign now read GLITCHBOUND.
4. Preserve license, upstream attribution, and diagnostics compatibility. Completed; `LICENSE` and `THIRD-PARTY-NOTICES.md` remain intact.
5. Build production output, check local asset references, and verify generated browser branding. Completed during the preceding Phase 2 work; the direct Vite build and static asset/title checks passed, with the chunk-size advisory retained. The current Phase 0 refresh did not relaunch the browser.
