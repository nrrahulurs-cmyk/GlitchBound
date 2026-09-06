# NEON DISTRICT — Vesper City

A free-roam voxel cyberpunk driving and exploration game, built with Blender assets and Three.js. The generated concept image is the visual target.

Source: **[Hiraeth010/neon-district](https://github.com/Hiraeth010/neon-district)**. The hosted game is linked in the repository's About panel. Local game: **http://127.0.0.1:5173/**.

The `quality-pass-01` branch contains ongoing local improvements. The full quality target and remaining gaps are recorded in [QUALITY_ROADMAP.md](QUALITY_ROADMAP.md); AAA parity and an independent preference result have not been established.

## Play

Requires **Node.js 24.x**, Chrome or Edge, and hardware acceleration. From the project directory:

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/** and choose **Enter the District**. The Windows source package also includes **START-GAME.cmd**. For a production build, run `npm run build` followed by `npm run preview` and open the URL printed by Vite. The static website is in `dist/`; serve it over HTTP rather than opening through `file://`. Blender is only needed to edit or regenerate native assets.

## Explore

Explore a **700 × 790 metre city**, with **six districts**, **34 outer city blocks**, and approximately **9.6 km of connected road centre lines**. Kasumi Ward's original neon boulevard connects to Lantern Market, Iron Docks, Stacktown, Meridian East and Crown Plaza. Drive through intersections, circle blocks and travel between districts. The central landmark occupies its own block; the parallel avenues go around it.

There are no quests, required objectives, or extraction points. Open or close the full city map with **M**. Your interceptor is the amber marker. The nearest junction is just behind the starting car; another is at the far end of the neon boulevard.

Security patrols are neutral. Walking, driving normally, drawing a weapon, and changing cameras are legal. Public gunfire, EMP discharge, attacks and destructive ramming trigger wanted levels. Responding patrols pursue visible targets and search their last known location. Stay out of sight and avoid further crimes to clear the alert. Reconnecting after death starts a neutral session.

## Controls

| Input | Action |
|---|---|
| WASD / arrows | Walk; throttle and steering in vehicle |
| Mouse | Look around; right-drag if pointer lock is unavailable |
| Left click | Draw weapon if holstered; fire if drawn |
| H / R | Holster or draw / reload |
| Shift | Sprint; double tap for kinetic dash |
| Space | Jump / vehicle handbrake |
| E | Use a mounted service terminal / enter or exit your interceptor |
| Q | EMP pulse |
| V | First-person / third-person camera |
| P | Hide or restore the HUD |
| M | Full city map |
| Escape | Pause / menu |

Sound starts muted; enable it in the top bar. Neural capacity recharges automatically. Desktop keyboard and mouse are the supported gameplay controls.

Walking accelerates and brakes, steps onto ordinary curbs, slides along solid walls, and jumps under gravity. The first-person eye and third-person feet share the actual support height. Chase cameras retract at obstacles; inward obstruction recovery snaps to a clear view while ordinary outward motion eases back.

Green map markers identify fifteen working street services. Face the existing wall panel and press **E**, then remain still until the operation finishes. Food hatches restore 25 health and boost neural recovery by 30% for 45 seconds; Meridian clinics restore health, Stacktown utility panels recharge 60 neural energy, and Crown directories mark other services on your map. At the three dock garages, park the interceptor inside the projected service apron, stop, exit, and use the diagnostic panel to restore its damaged bodywork and lights. Moving away, taking damage, drawing a weapon, pausing, or pressing E again interrupts the operation. Services have cooldowns.

The service mechanisms move in the world: food shutters open above serving drawers, clinic heads scan along their rails, garage carriages move over the parked car, and charging contacts and directory maps show progress. You can turn to watch the garage repair while standing at its terminal. Interrupted mechanisms retract to their resting positions.

## Art and simulation

The concept-inspired avenue uses fine voxel masonry, irregular building heights, a stepped cyan landmark, large portrait billboards, warm noodle shops, articulated pedestrians, umbrellas, hovering traffic, rain, vapor and broken wet-road reflections. The detailed interceptor, mercenary and patrol aircraft were modeled in Blender. The mercenary has separate arm and leg joints for animation.

The M-09 carbine and its ion bolt, angular muzzle flash and impact chips are authored Blender assets. Shots originate at the animated `muzzle_socket`, including in third person. Spring recoil, look sway, bolt cycling and magazine removal/reinsertion animate the weapon. Damage uses an immediate hitscan with separate camera-aim and muzzle-cover checks; a travelling ion bolt visualizes that same path afterward. Impacts use short angular chips, with no endpoint dome. Visual projectile travel is not a second delayed damage calculation.

Each district has its own visual identity:

| District | Art direction |
|---|---|
| Kasumi Ward | Dense neon avenue, cyan megatower, nightlife and warm noodle shops |
| Lantern Market | Orange and red lantern canopies, market counters and food stalls |
| Iron Docks | Rust and teal processing sheds, supported handling aprons, framed freight containers and pressure pipes |
| Stacktown | Violet modular housing, laundry terraces, catwalks and magenta clubs |
| Meridian East | White cyberware facades, cyan ribs and acid-green diagnostic panels |
| Crown Plaza | Blue and gold corporate crowns, gardens and orbital ring gateways |

The original woman's portrait appears on just one landmark billboard. Other image ads feature KURO optical implants, AXIOM synthetic bodies, OFFWORLD travel and MIDNIGHT RAMEN, alongside varied local storefront brands. The four original images and their exact generation prompts are included in `public/assets/`.

Twelve additional user-supplied campaigns were restyled with the built-in image generator: RECAST, KINKEEP, EVERON, QUIETUS, VYRA, GRINPOP, SYNTASK, NESTO, IRISYN, ELSE, VESPER ARC and SYNTHSILK. Each has four installations across two districts, with one new campaign per building. Portrait frames measure 8 × 12 metres, landscape frames 14 × 7.88 metres, and NESTO frames 9 × 11.25 metres. Their wall brackets and rooftop supports connect to actual building surfaces, with clear views from the adjacent roads. Images retain their proportions and complete lettering. The finished textures are `public/assets/advert-<brand>.png`; exact prompts and source references are in `public/assets/user-advert-prompts.json`. The blueprint records each campaign's host building and road viewing position.

Connected roads extend through all districts. Geometry is instanced and spatially grouped for distance culling. Both maps use the actual road and building layout. There are 284 animated voxel pedestrians with district-specific clothing palettes, plus 16 neutral taxis, vans, sports cars and buses. Road traffic follows curved routes, slows for other vehicles and stops for the player. District activity includes flickering lanterns, dock steam, projected medical holograms, rotating plaza sculptures and windblown paper.

Ambient fill keeps unlit masonry and service courtyards readable; four broad canopy lights cast colored spill from existing mounted shop signs. A local directional shadow map uses simplified architectural occluders and actual character/vehicle silhouettes. Wet asphalt has scattered puddles, while concrete, metal and paving have separate surface treatments. Twelve browser viewpoints cover all six districts, outer edges and service courtyards.

Player boots receive a small, support-aware contact shade on the actual surface beneath them. Frozen off/on comparisons on final local build `Y0FsMvtw` found modestly clearer sole contact at the bench and landing, with no detached disc or broad halo. Hidden-avatar, airborne, vehicle, lower-floor and restart controls pass, as does actual stair support/fading. This changes shading; the simple player gait and stair foot placement still need work. The comparisons and their conditions are recorded in the [final foot-contact report](validation/foot-contact-final-browser.json).

There are 77 wall-supported street and courtyard assemblies: food hatches, service garages, residential entries, clinic doors and concierge entries. Each has a shared blueprint/native Blender placement. Existing facade rails and glazing are cut around the new apertures, with clear approaches checked against the older street furniture. Fifteen exterior panels provide working services. Doors remain closed; usable interiors and more involved activities are still future work.

The authored Stacktown courtyard includes an exterior staircase to a shared landing, layered apartment bays and connected seating. Sixteen solid treads lead to the 3.065 m landing; the covered ground route stays below it and the upstairs door is closed. The same structures are editable in the Blender city. The interactive blueprint exposes their footprints, route waypoints, floor heights and structural attachments.

The current local Iron Docks pass adds seven shared assemblies with 954 voxel modules: a processing entrance and roof assembly, a covered handling apron, detailed faces on nine freight containers, and grounded paving. Authored block totals are now 31 assemblies, 2,413 modules and fifteen walking paths. Of the new modules, 855 metal pieces use faded paint, localized oxide or exposed working-metal finishes; panes, windows and paving keep their base materials. All four dock routes passed actual W input on `cA0mxVCY`, including the narrow single-person cross-aisle; this is not a vehicle or crowd-width route claim. Six matched views and rendered geometry checks are in the [dock browser report](validation/iron-docks-after-cA0mxVCY-2026-09-06T14-19-06-503Z.json).

The container faces, entrance and apron have more visible depth, but repeated panels, sparse upper walls and an inactive open court remain. An additional raised view shows connected roof-cap, panel and base joins; the inherited large plain crane dominates that view, and hidden rear/underside joins remain outside its visual scope. The native city has been regenerated and reopened against shared source, including all 31 authored assemblies and 855 profiled metal modules. Three native area lights at actual dock fixtures correct an initially unreadable apron render; the revised shutter, cabinet and workbench are legible. The [before/after native review](validation/native-docks-visual-review.md) retains the dark first images and remaining roof-shadow limits. Broader quality work continues; publication does not imply that the full target has been met.

Sound is procedurally synthesized with Web Audio. Footsteps follow actual distance travelled and distinguish road from paving; landings, nearby traffic and mounted machinery provide local feedback. Six traffic and six machinery voices use spatial panning, with district-specific ambience and bounded transient voices. Pause and mute silence the output. These are original synthesized sounds, not recorded crowds or licensed music.

Civilians can be injured and killed by gunfire or vehicle impacts. Two carbine body hits are fatal; faster vehicle impacts are lethal, while slow contact causes no damage. Death preserves the currently rendered pose and creates eleven physical body segments joined at the waist, neck, shoulders, elbows, hips and knees. Umbrellas fall independently. Body proxies use boxes, joint limits and passive damping; upward momentum and extreme spin are bounded to stabilize contacts with the controlled car. Fallen civilians remain in the scene until you reconnect. Assaults and fatalities trigger the city's crime response.

Cannon simulates physical civilian bodies, loose bins, vehicle wrecks, rotating voxel debris, gravity, friction, bounce and explosive chain reactions. Ramming traffic pushes it off its route and damages panels and lamps. The parked interceptor can also be displaced and dented; your car's bodywork shows damage and reports its condition while driving. All twelve existing bins can be launched, spun and pushed. Poles, vending machines, kiosks, rails and other visible street furniture have collision shapes derived from their geometry, including gaps between parts. Supply cells and security drones are destructible; buildings stay rigid. Vehicle controls use arcade handling with physical impact responses. Debris is capped at 120 bodies. At most 24 civilian assemblies retain their joints (240 joints); older remains become simpler compound bodies that preserve their current pose and momentum, sleep at rest, and can move again on impact.

## Editable deliverables

The architectural blueprint is available at **http://127.0.0.1:5173/blueprint/**, or through the link in the full city map. It shows actual roads, parcels, building footprints, sign mounts and supports. Zoom, pan, toggle layers and click placements to inspect coordinates and attachment IDs. The shared plan exports automatically before a development launch or production build.

- `public/blueprint/city-blueprint.svg` — standalone architectural drawing.
- `public/blueprint/blueprint.json` — authoritative placement and attachment data.
- `src/city-blueprint.js` — structural placement rules and blueprint generation.
- `src/asset-placements.js` — shared named car, character, kiosk and aircraft anchors.

- `blender/neon-district-city.blend` — complete editable city and cameras.
- `blender/cyberpunk-assets.blend` — props and character source.
- `blender/pulse-carbine.blend` — editable weapon and projectile-effect workshop.
- `blender/service-actions.blend` — editable service mechanisms, keyed operation/interruption sequences and inspection cameras.
- `blender/character-workshop.blend` — the 284 resolved civilian placements and four editable walking, stopping, turning and fleeing clips.
- `blender/weapon-manifest.json` — weapon bounds, hashes, animation parts and socket contract.
- `blender/build_city.py` / `blender/build_assets.py` / `blender/build_weapon.py` — native source and GLB regeneration scripts.
- `blender/README.md` — Blender commands, dimensions and animation part names.
- `public/assets/concept.png` — original preproduction concept.
- `public/assets/advert-portrait.png` — concept-derived voxel billboard artwork, generated with the built-in image tool.
- `public/assets/*.glb` — Blender exports; the unused relay asset is retained in the source kit only.
- `public/assets/pulse-carbine.glb`, `public/assets/ion-bolt.glb`, `public/assets/muzzle-flash.glb`, `public/assets/impact-shards.glb` — the four weapon exports.
- `validation/` — browser reports and captured previews. Free-roam reports supersede the original mission-build report.

## Source

| File | Purpose |
|---|---|
| `src/main.js` | Renderer, player, driving, cameras, HUD and city map |
| `src/city-layout.js` | Shared deterministic Blender/browser city layout |
| `src/city-expansion.js` | Connected road network, outer blocks, districts and patrol routes |
| `src/city-blueprint.js` | Building envelopes, structural placement, sign mounts and support anchors |
| `src/city-life.js` | Neutral road traffic, grounded assemblies and animated district activity |
| `src/advert-campaigns.js` | Shared artwork catalog and 48 enlarged campaign placements |
| `src/civilians.js` | Civilian movement, damage, vehicle impacts and physical bodies |
| `src/civilian-ragdoll.js` | Constrained body segments, passive damping, sleep and dynamic retirement |
| `src/civilian-motion.js` | Grounded leg IK, planted feet, acceleration, turning and flee poses |
| `src/civilian-navigation.js` | Spatial obstacle queries, accepted movement and living-crowd reservations |
| `src/player-movement.js` | Grounded character motion, step/jump support and box collision sliding |
| `src/ground-height.js` | Indexed immutable pavement footprints shared by foot, tire and prop height queries |
| `src/camera-obstruction.js` | Swept camera clearance and clear-boom recovery |
| `src/street-detail.js` | Supported frontage assemblies, clear approaches and facade apertures |
| `src/block-compositions.js` | Authored residential court and market block, structural links and clear routes |
| `src/iron-docks-compositions.js` | Validated processing shed, handling apron, container relief and walking routes |
| `src/city-services.js` | Authored terminal discovery, service progress, interruptions and outcomes |
| `src/service-interface.js` | Contextual service HUD, recovery status and projected parking guidance |
| `src/service-fixtures.js` / `src/service-world.js` | Shared native mechanism recipes, animation and physical world presentation |
| `src/kinematic-pose.js` | Accepted vehicle/fixture poses and contact momentum across physics substeps |
| `src/surface-materials.js` | Instanced metre-scaled concrete, metal and paving shaders |
| `src/surface-profiles.js` | Shared opaque-metal paint, oxide and working-metal finish values |
| `src/foot-contact.js` | Boot support queries and bounded contact shade on actual receiving surfaces |
| `src/city-shadows.js` | Local directional shadows and simplified architectural occluders |
| `src/world-audio.js` | Spatial city sources, neighborhood profiles and travel-driven footsteps |
| `src/street-collisions.js` | Collision shapes derived from visible street geometry |
| `src/street-physics.js` | Physical bins and the parked interceptor |
| `src/street-broadphase.js` | Cached street-body indexing and collision-pair ownership without duplicate candidate work |
| `src/vehicle-damage.js` | Persistent dents and paint damage on the Blender cars |
| `src/weapon-rig.js` | Blender weapon hierarchy, muzzle socket, recoil, sway and reload animation |
| `src/weapon-vfx.js` | Travelling ion bolts and bounded angular impact effects |
| `src/city.js` | Batched rendering, ambient street animation and mounted-sign lighting |
| `src/civilian-source.js` | Shared deterministic citizen geometry, clothing and continuing aerial-traffic population |
| `src/housing-compositions.js` | Structurally connected apartment bays, exterior stairs, landing and exact facade replacements |
| `scripts/export-native-characters.mjs` | Exact resolved citizen poses, editable group bindings and sampled animation data for Blender |
| `src/aircraft-source.js` | Shared voxel courier geometry for runtime flight and the native city |
| `src/atmosphere.js` | Sky, rain, vapor and wet-road reflection shader |
| `src/simulation.js` | Neutral patrols, crimes, wanted response and destruction |
| `src/voxel-assets.js` | Blender material batching |
| `src/audio.js` | Synthesized ambience and interaction sounds |

`?test=1` enables targeted controls under `window.__neon.test`. Normal play exposes a diagnostic snapshot at `window.__neon.snapshot()`.

Run `npm test` for the portable Node regression suites covering grounded movement, camera clearance, service access/outcomes, gun-cover checks, and articulated physics against production city geometry. The suites use the pinned runtime dependencies and leave stored browser/native reports unchanged. Browser reports record their build identifiers and tested conditions separately; the Node suite does not substitute for a graphics or listening review.

A clean `Y0FsMvtw` sample measured 59.976 FPS ordinarily and 54.195 FPS with 24 fresh articulated deaths (p95 33.3 ms). The loaded result lies within the two preceding `cA0mxVCY` samples, 50.542–54.524 FPS; no FPS improvement caused by the shader guard is established. The [performance report](validation/performance-docks-contact-profile.json) preserves the samples, instrumented diagnosis and their limits. Heavy physical scenes still miss frames.

Dependencies are pinned: Three.js 0.180.0, cannon-es 0.20.0, Vite 7.3.6. `npm ci` uses the included lockfile. Project source code is MIT-licensed; see `LICENSE` and `THIRD-PARTY-NOTICES.md` for dependency licenses and artwork provenance. The project is inspired by Cyberpunk 2077's atmosphere; no assets were extracted from that game. The twelve additional campaign artworks are voxel adaptations of user-supplied references.
