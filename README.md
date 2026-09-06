# NEON DISTRICT — Vesper City

A free-roam voxel cyberpunk driving and exploration game, built with Blender assets and Three.js. The generated concept image is the visual target.

Source: **[Hiraeth010/neon-district](https://github.com/Hiraeth010/neon-district)**. The hosted game is linked in the repository's About panel. Local game: **http://127.0.0.1:5173/**.

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
| E | Enter or exit your interceptor |
| Q | EMP pulse |
| V | First-person / third-person camera |
| P | Hide or restore the HUD |
| M | Full city map |
| Escape | Pause / menu |

Sound starts muted; enable it in the top bar. Neural capacity recharges automatically. Desktop keyboard and mouse are the supported gameplay controls.

## Art and simulation

The concept-inspired avenue uses fine voxel masonry, irregular building heights, a stepped cyan landmark, large portrait billboards, warm noodle shops, articulated pedestrians, umbrellas, hovering traffic, rain, vapor and broken wet-road reflections. The detailed interceptor, mercenary and patrol aircraft were modeled in Blender. The mercenary has separate arm and leg joints for animation.

The M-09 carbine and its ion bolt, angular muzzle flash and impact chips are authored Blender assets. Shots originate at the animated `muzzle_socket`, including in third person. Spring recoil, look sway, bolt cycling and magazine removal/reinsertion animate the weapon. Damage uses an immediate hitscan with separate camera-aim and muzzle-cover checks; a travelling ion bolt visualizes that same path afterward. Impacts use short angular chips, with no endpoint dome. Visual projectile travel is not a second delayed damage calculation.

Each district has its own visual identity:

| District | Art direction |
|---|---|
| Kasumi Ward | Dense neon avenue, cyan megatower, nightlife and warm noodle shops |
| Lantern Market | Orange and red lantern canopies, market counters and food stalls |
| Iron Docks | Rust and teal industrial gantries, pressure pipes and striped smokestacks |
| Stacktown | Violet modular housing, laundry terraces, catwalks and magenta clubs |
| Meridian East | White cyberware facades, cyan ribs and acid-green diagnostic panels |
| Crown Plaza | Blue and gold corporate crowns, gardens and orbital ring gateways |

The original woman's portrait appears on just one landmark billboard. Other image ads feature KURO optical implants, AXIOM synthetic bodies, OFFWORLD travel and MIDNIGHT RAMEN, alongside varied local storefront brands. The four original images and their exact generation prompts are included in `public/assets/`.

Twelve additional user-supplied campaigns were restyled with the built-in image generator: RECAST, KINKEEP, EVERON, QUIETUS, VYRA, GRINPOP, SYNTASK, NESTO, IRISYN, ELSE, VESPER ARC and SYNTHSILK. Each has four installations across two districts, with one new campaign per building. Portrait frames measure 8 × 12 metres, landscape frames 14 × 7.88 metres, and NESTO frames 9 × 11.25 metres. Their wall brackets and rooftop supports connect to actual building surfaces, with clear views from the adjacent roads. Images retain their proportions and complete lettering. The finished textures are `public/assets/advert-<brand>.png`; exact prompts and source references are in `public/assets/user-advert-prompts.json`. The blueprint records each campaign's host building and road viewing position.

Connected roads extend through all districts. Geometry is instanced and spatially grouped for distance culling. Both maps use the actual road and building layout. There are 284 animated voxel pedestrians with district-specific clothing palettes, plus 16 neutral taxis, vans, sports cars and buses. Road traffic follows curved routes, slows for other vehicles and stops for the player. District activity includes flickering lanterns, dock steam, projected medical holograms, rotating plaza sculptures and windblown paper.

Ambient fill keeps unlit masonry and service courtyards readable; four pooled lights cast colored spill from existing mounted shop signs. Twelve browser viewpoints cover all six districts, outer edges and service courtyards. The lighting pass retains the night sky, fog, neon contrast and wet-road reflections.

Civilians can be injured and killed by gunfire or vehicle impacts. Two carbine body hits are fatal; faster vehicle impacts are lethal, while slow contact causes no damage. Physical bodies are thrown by vehicle impacts, tumble, collide with the world and settle on the pavement. Fallen civilians remain in the scene until you reconnect. Assaults and fatalities trigger the city's crime response.

Cannon simulates physical civilian bodies, loose bins, vehicle wrecks, rotating voxel debris, gravity, friction, bounce and explosive chain reactions. Ramming traffic pushes it off its route and damages panels and lamps. The parked interceptor can also be displaced and dented; your car's bodywork shows damage and reports its condition while driving. All twelve existing bins can be launched, spun and pushed. Poles, vending machines, kiosks, rails and other visible street furniture have collision shapes derived from their geometry, including gaps between parts. Supply cells and security drones are destructible; buildings stay rigid. Vehicle controls use arcade handling with physical impact responses. Debris is capped at 120 bodies; settled civilian remains persist while active physics bodies are bounded.

## Editable deliverables

The architectural blueprint is available at **http://127.0.0.1:5173/blueprint/**, or through the link in the full city map. It shows actual roads, parcels, building footprints, sign mounts and supports. Zoom, pan, toggle layers and click placements to inspect coordinates and attachment IDs. The shared plan exports automatically before a development launch or production build.

- `public/blueprint/city-blueprint.svg` — standalone architectural drawing.
- `public/blueprint/blueprint.json` — authoritative placement and attachment data.
- `src/city-blueprint.js` — structural placement rules and blueprint generation.
- `src/asset-placements.js` — shared named car, character, kiosk and aircraft anchors.

- `blender/neon-district-city.blend` — complete editable city and cameras.
- `blender/cyberpunk-assets.blend` — props and character source.
- `blender/pulse-carbine.blend` — editable weapon and projectile-effect workshop.
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
| `src/street-collisions.js` | Collision shapes derived from visible street geometry |
| `src/street-physics.js` | Physical bins and the parked interceptor |
| `src/vehicle-damage.js` | Persistent dents and paint damage on the Blender cars |
| `src/weapon-rig.js` | Blender weapon hierarchy, muzzle socket, recoil, sway and reload animation |
| `src/weapon-vfx.js` | Travelling ion bolts and bounded angular impact effects |
| `src/city.js` | Batched rendering, ambient street animation and mounted-sign lighting |
| `src/atmosphere.js` | Sky, rain, vapor and wet-road reflection shader |
| `src/simulation.js` | Neutral patrols, crimes, wanted response and destruction |
| `src/voxel-assets.js` | Blender material batching |
| `src/audio.js` | Synthesized ambience and interaction sounds |

`?test=1` enables targeted controls under `window.__neon.test`. Normal play exposes a diagnostic snapshot at `window.__neon.snapshot()`.

Dependencies are pinned: Three.js 0.180.0, cannon-es 0.20.0, Vite 7.3.6. `npm ci` uses the included lockfile. Project source code is MIT-licensed; see `LICENSE` and `THIRD-PARTY-NOTICES.md` for dependency licenses and artwork provenance. The project is inspired by Cyberpunk 2077's atmosphere; no assets were extracted from that game. The twelve additional campaign artworks are voxel adaptations of user-supplied references.
