# Editable Blender source

Open **neon-district-city.blend** for the complete Vesper city, **cyberpunk-assets.blend** for the asset kit, **pulse-carbine.blend** for the weapon and projectile effects, **service-actions.blend** for editable exterior service animations, or **character-workshop.blend** for civilian rigs and motion. The city contains native voxel meshes organized by avenue section, material, and building side, editable text signs, seventeen packed billboard images, atmospheric lighting, and five cameras. These local source files open independently of the game server. The scripts below regenerate them.

Use Blender's scene selector to choose the street composition, **VESPER / complete city aerial**, or **VESPER / architectural blueprint**. The blueprint has separate editable layers for roads, building footprints, parcel boundaries, structural supports, mounted signs, ground assets, elevated connections, and dimensions. Its source records are embedded as JSON in Blender's Text Editor.

The city geometry comes from the same deterministic `src/city-layout.js` layout used by the Three.js game, including the structural corrections from `src/city-blueprint.js`. The generator also imports `src/asset-placements.js`, the traffic and connected activity assemblies from `src/city-life.js`, and supply foundations from `src/simulation.js`. Duplicate distant LOD masses are excluded. `build_city.py` evaluates these sources with Node.js and constructs the Blender scenes; `build_blueprint.py` builds the architectural plan. `build_assets.py` authors and exports the detailed prop kit directly in Blender.

The authored Stacktown court and Lantern Market block come from `src/block-compositions.js` and `src/housing-compositions.js`: 24 named assemblies contain 1,459 voxel modules. They include covered circulation, residential entries, seating, planters, preparation stalls, upper floors and sixteen solid stair treads to a supported 3.065 m landing. Their editable meshes are grouped in **09 AUTHORED BLOCKS**. The shared plan records their footprints, eleven walking routes and two closed exterior entrances. Services and advertisement placements retain their original records.

The regenerated city now includes `src/iron-docks-compositions.js`: seven additional assemblies and 954 modules bring the totals to 31 authored assemblies, 2,413 modules and fifteen walking paths. The processing shed, supported apron and nine detailed container faces occupy the same authored-block collection. Fresh reopen against source passed for the 160,453-module city, preserving all services, 17 packed images across 91 image panels, 284 civilian rigs and five viewpoints. The final file is 63,111,042 bytes with SHA256 `5d016b746b7caae94e2ceb84caa8e250bb6f40d3c1e56fd06d4c3b13311e54c3`; [native-city-report.json](../validation/native-city-report.json) records the checks. Four dock paths also have actual-input browser evidence on `cA0mxVCY`. The [two-view native review](../validation/native-docks-visual-review.md) accepts the revised apron readability and visible roof joins within its stated limits; the older full-city previews do not validate this pass.

**10 CITIZENS** contains the same 284 resolved civilians as runtime frame zero: 14,785 editable voxel pieces, with the exact clothing palettes, umbrella parts, joint groups and spawn corrections. The native city also contains the game's sixteen overhead couriers, using all 240 shared aircraft cubes and their initial vertical phase. These city characters and overhead aircraft are saved at frame zero; navigation, flight and physical deaths remain live runtime systems. Use the separate character workshop for editable finite motion clips.

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

The character workshop has two scenes: **VESPER / exact character population** contains all 284 resolved runtime placements, and **VESPER / editable motion workshop** contains four finite clips. Each figure has one disconnected voxel mesh, rigid vertex groups and an editable armature. Ordinary and umbrella figures walk, stop, turn and flee over an actual pavement step. The clips are sampled at 30 Hz from the game's accepted-distance gait planner; they hold their final pose instead of looping through an invented return path. The runtime retains the live navigation and physical ragdoll simulation.

Regenerate the separate workshop with an explicit export destination:

```powershell
node scripts/export-native-characters.mjs --output blender/native-characters.json.gz
blender --background --threads 2 --python blender/build_characters.py -- --export blender/native-characters.json.gz --output blender/character-workshop.blend --report validation/native-character-workshop.json --render
```

The workshop packs its source capture and opens without the intermediate JSON. It has been regenerated from the final `Y0FsMvtw` source; fresh-reopen checks evaluate every saved population vertex and all 724 animation poses through the armature modifiers. Material verification reads actual saved face assignments and shader values. The close gait PNG is a Blender render of one recorded pose, not a runtime gameplay capture.

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

The current mercenary preserves ten parts: head, torso, two arms, and two hip–knee–ankle chains (`left_leg` / `left_knee` / `left_foot` and the matching right chain). The existing game animation continues to rotate each whole leg at its hip; unfinished stair IK is not enabled. The separate `hero-pose-workshop.blend` contains three editable static poses, with verified geometry and materials. The large city file remains the preceding architectural snapshot and contains the earlier six-part hero. The carbine preserves its part hierarchy and socket nodes; impact chips also remain separate. Other prop GLBs combine voxel geometry into one mesh per asset, with material primitives for the limited color palette.

`weapon-manifest.json` specifies the four exports in `../public/assets/`, the native `pulse-carbine.blend` checksum and verified attachment contract. In glTF metres, `muzzle_socket` is at `(0, 0.103, -0.746)` and points along local −Z. The bore is open. The ion-bolt nose starts at its origin and its tail extends +Z; the muzzle flash extends −Z. Keep the `bolt`, `magazine`, `trigger`, `muzzle_socket` and `eject_socket` nodes intact when editing. The runtime uses these for spring recoil, sway, bolt cycling and reload motion, and samples the actual animated muzzle in both camera modes.

The browser applies hitscan damage immediately after resolving camera aim and muzzle obstruction. The Blender bolt then travels along the resolved path for presentation; it does not independently apply damage. Impact effects are angular chips rather than spherical endpoint domes. Game-time ambient and pooled sign lighting are configured in the Three.js renderer; native preview lighting is a separate Blender setup.

`surface_materials.py` creates editable world-space nodes for concrete, paving and metal. Their base roughness/metallic values are respectively `.86/.08`, `.91/.025` and `.57/.66`. Metre-scaled grain and weathering retain the authored voxel colors; isolated wet ground patches reduce paving roughness. Native noise approximates the runtime finish and physical scale, rather than reproducing its GLSL hash exactly. Normal detail stays below one millimetre. The material-only revision preserves geometry, cameras, packed artwork and animation; `../validation/native-surface-materials.json` records save/reopen checks.

The dock refresh reads `src/surface-profiles.js`: 706 faded-paint pieces use `.64/.32` roughness/metallic, 121 exposed-metal pieces `.40/.78`, and 28 oxide pieces `.83/.06`. Only opaque metal receives these profiles; the other 99 tagged modules retain their existing window, glass, solid or paving materials. Reopened profile meshes retain source IDs and per-vertex colors. The native checks verify grouped face assignments, source colors, shader metallic values and connected roughness ranges; they do not establish matching noise patterns or render appearance. The runtime's player-foot contact shading is a separate dynamic effect, not baked native geometry or an animation improvement.

`practical_lights.py` supplies three editable native area lights at actual luminous dock strips: two 120 W apron lights and one 95 W process-entry light. Their rectangles follow the saved fixture faces with a 3 mm downward offset, checked against actual native vertices after reopen. These are local preview calibrations, with global lighting and cameras preserved. They correct the initial dark apron without changing runtime lighting. The final work surface, shutter and cabinet read clearly; roof side/rear faces remain partly shadowed or hidden, and the large simple crane remains a design limitation. The first dark renders are retained alongside the revised previews in the visual review.

`asset-manifest.json` records exact prop bounds and geometry counts. `city-scene-manifest.json` records city counts, packed images, the source file checksum, and fresh-file verification. The three complete-city preview PNGs predate the current authored blocks and service mechanisms; their dates and checksums remain in the manifest. The separately dated surface preview also predates this geometry update. The new `city-housing-preview.png` is a fresh Cycles render of the accepted stair approach, recorded in `../validation/native-housing-preview.json`. It shows the joined flight and landing, while the under-landing shade remains visually dark. This local inspection does not replace the dated full-city previews.

For the focused hero export and workshop, run `blender --background --threads 2 --python blender/build_assets.py -- --hero-only --skip-render`, then `blender --background --threads 2 --python blender/render_hero.py` for the inspection renders. See [focused native review](../validation/hero-articulation-visual-review.md). This validates the asset and authored poses, not a new live gait.
