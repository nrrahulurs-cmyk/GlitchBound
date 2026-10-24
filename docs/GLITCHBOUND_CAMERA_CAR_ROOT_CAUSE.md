# GLITCHBOUND Camera and Vehicle Root Cause

## Scope and preserved baseline

This audit uses the local project at `C:\Users\Abhinaykumar\OneDrive\Documents\GlitchBound`, branch `main`, HEAD `6bea17f` (`Ship completed hero assets and ground-contact fixes`). The worktree already contained extensive unstaged and untracked changes before this repair. Those changes were preserved; no reset, clean, blanket restore, asset deletion, or Blender save was performed.

## Confirmed vehicle paths

| Runtime role | Current source and path | Integration consequence |
|---|---|---|
| Player car | `src/main.js` loads `/assets/interceptor.glb` through `GLTFLoader`; the scene is cloned and registered as `VEHICLE-PLAYER`. `src/asset-placements.js` supplies its `interceptor` placement. | This is the only player-controlled road car. Its visual is not either requested Tripo export. |
| Parked car | `src/main.js` clones the same loaded `interceptor` scene as `VEHICLE-PARKED`; `src/asset-placements.js` supplies `parkedCar`. | It is a separate physical parked entity, but not a second player-drivable slot. |
| Ambient traffic | `src/city-life.js` defines 16 routes and calls `createTrafficVehicle(type)` for each. That factory builds colored box-part visuals and collision boxes for `taxi`, `sport`, `van`, and `bus`; four routes use `sport`. `createCityLife()` and its traffic controller own spawning, movement, reservations, damage and reset. | Replacing the player-car GLB cannot change street traffic. The traffic visual factory has no GLTF model-selection path. |
| Vehicle physics and damage | `src/main.js` owns player driving/entry/exit and a fixed Cannon box; `src/simulation.js`, `src/street-physics.js`, and `src/vehicle-damage.js` supply the existing collision, impact and damage behavior. | Any later visual swap must keep the current entity and controller. This repair did not change those systems. |

### Actual model availability

The checked repository has `public/assets/interceptor.glb`; it has no Tripo vehicle export under `public/assets/tripo/`. The previously searched project, OneDrive Documents and Downloads locations also had no matching car exports. The exact candidate runtime paths already recorded in `docs/GLITCHBOUND_CUSTOM_ASSET_MAP.md` are:

- `public/assets/tripo/car-01-990-cyan-magenta.glb`
- `public/assets/tripo/car-02-armored-blue.glb`

These are expected paths, not files found or generated in this repair. The corresponding editable Tripo source files were not available either. Screenshots are not model data. No replacement, duplicate visual, fake GLB, or traffic remapping was added.

The current live Blender MCP connection is usable and read-only inspection succeeded. Blender reports 5.2.3 LTS with addon 1.8. The open `blender/cyberpunk-assets.blend` scene contains the existing `K-77 INTERCEPTOR` mesh (approximately 2.9 × 5.28 × 1.36 m), plus the existing prop kit and `AEON / ARMORED PATROL AV`; no Tripo cars are in that scene. The Blender window title has an unsaved-change marker, so this task did not alter or save it.

## Camera and input root causes

The committed `HEAD` implementation had several interacting issues:

1. **The game started in first person.** `thirdPerson` defaulted to `false`; the user had to discover `V` to switch views.
2. **Unlocked mouse look depended on movement fields that vary by browser.** The committed `mousemove` handler used `movementX`/`movementY` for its right-drag fallback instead of screen-coordinate deltas. It also had no explicit tracking of the cursor position or pointer-lock lifecycle.
3. **Vehicle camera look was not independent.** The committed handler returned early while driving. Vehicle entry reset camera yaw and pitch to the car's heading; exit assigned a new pitch, causing abrupt view changes.
4. **The third-person boom did not follow pitch.** Camera position used a fixed eye-height boom while camera rotation used `lookPitch`, so the orbit position and viewing direction disagreed.
5. **Camera yaw also rotated the avatar while idle.** The same yaw described free camera orbit, locomotion and displayed body facing.

The current working-tree implementation addresses those code-level gaps while keeping `updateCamera()` as the single camera writer and keeping `chaseCamera()` / `resolveCameraBoom()` as the obstruction path:

- TPP is the default; the camera pose is centered on the upper torso with configurable boom, shoulder offset, pitch bounds and follow rate in `src/camera-rig.js`.
- Mouse deltas are time-independent pixels multiplied once by the configured sensitivity. Pointer lock uses relative deltas; when it is unavailable, ordinary cursor movement uses `clientX`/`clientY` deltas. Look is suppressed over interactive controls, so buttons remain usable without rotating the view. `isMouseLookActive()` covers both pointer-locked and unlocked play.
- On-foot and vehicle yaw/pitch are stored separately. Vehicle entry preserves the view relative to vehicle heading, the vehicle boom converts view pitch to boom elevation consistently, and exit restores the vehicle view as the on-foot view.
- Camera-relative movement continues to use the horizontal camera heading. Avatar movement-facing is separate from camera yaw; when the weapon is drawn the avatar faces aim yaw.
- Camera collision continues through the existing boom resolver, including its obstruction tests. No new raycast loop, player physics, or traffic logic was introduced.
- Source exposes active camera yaw/pitch plus the separate vehicle look values through `window.__glitchbound.snapshot().camera`; `window.__neon` remains a compatibility alias. The embedded browser's read-only evaluation bridge did not expose custom globals, so those runtime values were not read in this pass.

## Integration gaps and risk

- **Car A and Car B cannot be integrated until their actual exports arrive.** Needed files: the two GLBs above and, if available, their editable Blender/FBX sources and any external textures.
- **Car B has no existing drivable slot.** Before wiring it, its intended role must be mapped to a real existing entity or a separate vehicle-selection mechanism designed and tested. The current parked car is not enterable.
- **Traffic requires an actual factory change.** Once models exist, the GLBs must be mapped at `createTrafficVehicle`/traffic visual construction for the intended `sport` routes, while retaining the established collision footprints, movement and physics. The current code does not load imported GLBs for ambient traffic.
- **Model dimensions, orientation, origins, textures, wheels and materials remain unknown.** They must be measured from the real files before visual scaling/alignment or a wheel rig is attempted.
- **Actual mouse-orbit behavior requires a post-fix browser check.** The local embedded browser previously rejected pointer lock. The updated fallback now rotates on ordinary cursor movement over the game, and the button-input automation can produce mouse movement while dragging. Recheck both ordinary movement and control-hover behavior after the latest change.

## Recommended order

1. Supply both real car exports and editable sources; confirm whether Car B is an alternate player vehicle or a new enterable entity.
2. Inspect model bounds, origin, forward axis, material/texture embedding, geometry separation and wheel pivots before choosing transforms.
3. Add a runtime manifest that maps each confirmed export to its exact player, parked, and/or traffic role. Preserve the existing physics bodies and traffic controller.
4. Change the corresponding visual loader/factory and verify no old/new visual overlap after load, spawn, despawn and reset.
5. Run the production build and full test suite, then manually test mouse orbit, movement-relative-to-camera, firing, driving transitions, collision and restart in a standard browser.
