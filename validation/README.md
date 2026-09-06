# Validation

The current game is free roam. Reports identify the build they tested. The first expansion was followed by district art, street activity and a structural placement pass. That pass also corrected overlapping building footprints, so the original driving report describes the earlier build; the final placement and browser checks validate the corrected layout.

- `weapon-assets-report.json`: independent GLTFLoader checks of the four Blender weapon exports, open-bore triangle rays, muzzle orientation, separate animation parts and native/export checksums. The exact source contract is in `../blender/weapon-manifest.json`.
- `gun-shot-simulation.json`: production simulation checks camera/muzzle convergence, close cover, clipped or inside-wall muzzles, floor/slab intersections, rotated surface normals and absence of spherical shot/chain effects. Damage is hitscan; the travelling projectile is visual feedback.
- `gun-fire-performance.json`: a separate warmed firing-only browser run measures real held-mouse shooting without screenshots or scene-traversal telemetry. Projectiles and impact chips reuse fixed GPU resource pools to avoid shader recompilation between shots.
- `gun-vfx-browser.json`: actual mouse, WASD, R and V inputs verify animated muzzle/projectile alignment, recoil and sway, staged magazine/bolt reload, nearby lamp cover, third-person firing, holstering and restart cleanup. The weapon, reload, cover and third-person PNGs capture the Blender assets in the live game.
- `district-lighting-report.json`: twelve before/after browser views covering all six districts, outer edges and service courtyards. Confirms unchanged near-geometry visibility, brighter previously unlit surfaces, no runtime errors and measured frame times. Supporting captures and raw samples are `district-lighting-before.*` and `district-lighting-after.*`.

- `campaign-structure-visibility.json`: all 48 enlarged campaign displays checked with 3,888 rays from road positions; no obstructed artwork samples or intersecting world geometry.
- `enlarged-campaign-structure.json`: independent checks of actual image dimensions, connected wall and rooftop supports, building clearance and clear driving lanes.
- `advert-campaigns-browser.json`: live image loading and rendered placement checks; accompanying screenshots show the commissioned campaigns in the city.
- `native-city-report.json` / `ad-native-integration.json`: fresh reopening of the rebuilt Blender city verifies the shared blueprint, all 48 enlarged placements, 17 packed images and grounded street assets.
- `street-physics-browser.json`: actual keyboard driving launches and lands a bin, wrecks a traffic car, dents and displaces the parked interceptor, and throws a civilian body. Also measures warmed browser frame times after physics optimization.
- `physics-performance-browser.json`: warmed menu and gameplay frame times for the final enlarged-ad build, with measured physics step costs.
- `street-physical-world-report.json`: rigid-body contacts, floor and wall collision, settled-body impulses, bullet cover, bins and parked-car reset checks.
- `traffic-owned-car.json` / `parked-car-traffic-browser.json`: startup and reset spacing, rotated owned vehicles, parked player vehicles and traffic route occupancy checks.
- `traffic-wreck-physics.json`: forward and reverse impacts, damaged traffic geometry, different vehicle masses, normal traffic pushing loose objects and reset behavior.
- `civilian-simulation-report.json` / `civilian-integrated-report.json`: damage, swept vehicle hits, cover ordering, witnesses and crime accounting.
- `civilian-combat-browser.json`: actual shooting and forward/reverse driving verify civilian deaths, harmless stationary contact, restart and removal of the F-key blade action. This precedes the rigid-body impact pass documented above.

- `blueprint-placement.json`: independent building-envelope, sign-intersection, physical-mount and elevated-connection checks after placement corrections.
- `blueprint-clearance.json` / `blueprint-road-audit.json`: final static geometry and network clearance.
- `blueprint-browser-report.json`: live blueprint navigation, selection, layer toggles and drawing/data downloads.
- `activity-connections.json`: vehicle and district activity assemblies tested for grounded, connected geometry across animation phases.
- `asset-grounding.json`: visible GLB minimum bounds checked against actual road and sidewalk surface elevations.
- `final-traffic-drive.json`: actual legal driving with live traffic after building layout corrections; includes traffic yielding, collision and resuming checks.

- `city-road-audit.json`: all 16 road rectangles form one connected network; 48 centre/offset lanes clear the car's actual 1.45 m collision radius; both original-street junctions permit turns; all six districts and all 12 patrol routes are reachable.
- `expanded-city-drive.json`: 2,574 m driven with actual E, WASD and handbrake inputs through all six districts and 13 checkpoints. No vehicle position or simulation-time overrides. Health remained 100, wanted level stayed zero, and no browser errors occurred.
- `expanded-security-browser.json`: a mouse-fired shot in an outer district causes local security to respond; distant patrols remain neutral; escaping clears the alert.
- `city-visual-report.json`: browser inspection of the five outer districts, neutral exploration, and opening/closing the full map using M, Escape and both close buttons. Teleports are used only for these targeted visual checks.
- `free-roam-report.json`: the earlier free-roam revision verifies removal of quests, neutral proximity, holstering, cameras, crime response, wanted cooldown, EMP, driving and destructive ramming.
- `gameplay-report.json`: retained historical report for the original mission prototype; superseded by the reports above.

`ad-campaign-layout.json` documents the first smaller installations and is superseded by the enlarged-campaign reports. `native-unarmed-refresh.json` records the intermediate asset refresh before the complete native rebuild.

The PNG files are captured browser views. The previews in `../blender/` are actual Blender renders of the supplied native scene. FPS readings describe this machine with hardware-accelerated Chrome and are not a cross-device performance guarantee.
