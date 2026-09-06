# Editable Blender source

Open **neon-district-city.blend** for the complete Vesper city, **cyberpunk-assets.blend** for the asset kit, **pulse-carbine.blend** for the weapon and projectile effects, or **service-actions.blend** for editable exterior service animations. The city contains native voxel meshes organized by avenue section, material, and building side, editable text signs, seventeen packed billboard images, atmospheric lighting, and five cameras. These four local source files open independently of the game server. The scripts below regenerate them.

Use Blender's scene selector to choose the street composition, **VESPER / complete city aerial**, or **VESPER / architectural blueprint**. The blueprint has separate editable layers for roads, building footprints, parcel boundaries, structural supports, mounted signs, ground assets, elevated connections, and dimensions. Its source records are embedded as JSON in Blender's Text Editor.

The city geometry comes from the same deterministic `src/city-layout.js` layout used by the Three.js game, including the structural corrections from `src/city-blueprint.js`. The generator also imports `src/asset-placements.js`, the traffic and connected activity assemblies from `src/city-life.js`, and supply foundations from `src/simulation.js`. Duplicate distant LOD masses are excluded. `build_city.py` evaluates these sources with Node.js and constructs the Blender scenes; `build_blueprint.py` builds the architectural plan. `build_assets.py` authors and exports the detailed prop kit directly in Blender.

The authored Stacktown court and Lantern Market block come from `src/block-compositions.js`: 21 named assemblies contain 765 voxel modules, including covered circulation, residential entry hardware, seating, branching planters, deep preparation stalls and stepped upper floors. Their editable meshes are grouped in **09 AUTHORED BLOCKS**. The plan includes their footprints and seven checked walking routes. Original services and advertisement placements remain unchanged.

**08 SERVICE MECHANISMS** contains fifteen named service roots, editable motion groups and 318 individually identified parts at the runtime's idle pose. Exactly fifteen original food-hatch slats are replaced. `native_layout.py` gives the builder and verifier the same grounded sites and evaluated `src/service-fixtures.js` recipes; complete site records remain embedded. The separate `service-actions.blend` supplies the keyed action, success and cancellation samples. Beam and steam effects remain runtime effects described in its companion JSON.

The city spans 700 × 790 metres with six districts and connected roads. Sixteen road vehicles follow looping animation paths; the holograms and kinetic sculptures have native animation. The ground assets use the game's shared anchors. Security starts in neutral cyan, and the unused relay kit asset has no placement in the city.

Run `npm ci` with Node.js 24.x first. Install Blender 5.x and make its `blender` executable available on PATH, then run these commands from the project root to regenerate the native sources and exports:

```powershell
blender --background --python blender/build_assets.py
blender --background --python blender/build_weapon.py
node scripts/export-service-fixtures.mjs
blender --background --python blender/build_service_fixtures.py
blender --background --python blender/build_city.py
```

For a CPU-only city save/reopen without rendering or changing the saved viewpoints, use `blender --background --threads 2 --python blender/build_city.py -- --skip-render --preserve-views`.

Blender uses Z-up with forward along +Y. The exported GLBs in `public/assets/` use Y-up with forward along −Z. Scene coordinates convert as `(x, y, z)` in the game to `(x, −z, y)` in Blender.

| Asset | Description | Approximate dimensions, width × height × length |
| --- | --- | --- |
| interceptor.glb | Layered voxel street car, illuminated wheels, white headlights, red taillights | 2.90 × 1.36 × 5.28 m |
| mercenary.glb | Armored hero with pixel hair, red backpack and segmented cyberarm | 1.13 × 1.93 × 0.74 m |
| av.glb | Heavy patrol aircraft with cyan engines and red signals | 6.21 × 2.09 × 7.90 m |
| drone.glb | Quad-engine security drone | 1.84 × 0.77 × 1.23 m |
| relay.glb | Data relay with screen graphics and keypad | 0.91 × 1.83 × 0.80 m |
| crate.glb | Hazard-marked energy cell | 0.95 × 0.95 × 0.99 m |
| kiosk.glb | Illuminated noodle stall | 3.18 × 2.54 × 2.00 m |
| pulse-carbine.glb | M-09 carbine with separate bolt, magazine and trigger | 0.22 × 0.49 × 0.98 m |
| ion-bolt.glb | Stepped luminous projectile; nose at origin | 0.057 × 0.052 × 0.814 m |
| muzzle-flash.glb | Short angular muzzle prongs | 0.080 × 0.084 × 0.183 m |
| impact-shards.glb | Ten separately animated voxel chips | 0.059 × 0.045 × 0.061 m |

The mercenary preserves six separate parts: `head`, `torso`, `left_arm`, `right_arm`, `left_leg`, and `right_leg`. Arms and legs have joint-centered origins for simple rigid-part walking animation. The carbine preserves its part hierarchy and socket nodes; impact chips also remain separate. Other prop GLBs combine voxel geometry into one mesh per asset, with material primitives for the limited color palette.

`weapon-manifest.json` specifies the four exports in `../public/assets/`, the native `pulse-carbine.blend` checksum and verified attachment contract. In glTF metres, `muzzle_socket` is at `(0, 0.103, -0.746)` and points along local −Z. The bore is open. The ion-bolt nose starts at its origin and its tail extends +Z; the muzzle flash extends −Z. Keep the `bolt`, `magazine`, `trigger`, `muzzle_socket` and `eject_socket` nodes intact when editing. The runtime uses these for spring recoil, sway, bolt cycling and reload motion, and samples the actual animated muzzle in both camera modes.

The browser applies hitscan damage immediately after resolving camera aim and muzzle obstruction. The Blender bolt then travels along the resolved path for presentation; it does not independently apply damage. Impact effects are angular chips rather than spherical endpoint domes. Game-time ambient and pooled sign lighting are configured in the Three.js renderer; native preview lighting is a separate Blender setup.

`surface_materials.py` creates editable world-space nodes for concrete, paving and metal. Their base roughness/metallic values are respectively `.86/.08`, `.91/.025` and `.57/.66`. Metre-scaled grain and weathering retain the authored voxel colors; isolated wet ground patches reduce paving roughness. Native noise approximates the runtime finish and physical scale, rather than reproducing its GLSL hash exactly. Normal detail stays below one millimetre. The material-only revision preserves geometry, cameras, packed artwork and animation; `../validation/native-surface-materials.json` records save/reopen checks.

`asset-manifest.json` records exact prop bounds and geometry counts. `city-scene-manifest.json` records city counts, packed images, the source file checksum, and fresh-file verification. The preview PNGs are actual Blender captures from their recorded dates. They predate the current authored blocks and service mechanisms; their dates and checksums remain in the manifest. The separately dated surface preview also predates this geometry update. Save/reopen verification establishes source correspondence, not a fresh visual comparison.
