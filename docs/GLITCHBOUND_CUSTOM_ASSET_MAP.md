# GLITCHBOUND custom asset map

## Audit scope and result

This is the pre-integration map for the Tripo character and vehicle references supplied with the full replacement brief. The project, `public/assets`, `blender`, the user's OneDrive workspace and `Downloads` were searched for runtime/source model formats (`.glb`, `.gltf`, `.fbx`, `.blend`, `.obj`, `.stl`, `.usd`/`.usdz`) and archives. The repository contains its existing generated GLBs and six Blender projects, but no exported Tripo character or car models were found. Screenshots and MP4 showcase clips are references; they are not replacement geometry.

The three attached screenshots were visually inspected:

| Reference | Visible design | Intended mapping | Audit result |
|---|---|---|---|
| Car 01 | Low, wide cyan-blue racer with hot-pink front body panels, magenta wheel surrounds and white `990` marking | Player interceptor appearance | No 3D export found. The current player car and parked car share one model reference, so replacing only the player requires separating their visual references. |
| Car 02 | Dark blue-purple armored vehicle with angular front, cyan horizontal lights and roof equipment | Second car appearance | No 3D export found. The game has no second independently drivable car controller or second drivable spawn. Do not substitute the patrol aircraft or silently make the parked car a second player vehicle. |
| Character 01 | Brown swept-back hair, beard, navy-purple jacket with cyan trim, white forearm guards, black cargo trousers and orange-white shoes | Playable hero appearance | No 3D export found. The existing player hero is `mercenary.glb`. |
| Character 02 | Blue-haired character described in the brief as having a lower-face covering, purple/lavender clothing, cyan accents and a dark-blue rectangular accessory | A second existing character role, to be identified after the model is supplied | No 3D export found. There is no second discrete character-GLB slot. City civilians are a shared instanced population, so no civilian or player role has been assigned to this reference. |

Four Tripo showcase MP4s are present under `C:\Users\Abhinaykumar\Downloads` and `C:\Users\Abhinaykumar\Downloads\assets`. The video decoder and Blender MCP tools are not exposed in this Codex execution, so those clips were not frame-reviewed and cannot be used to claim that Character 02 or an export was inspected. This limitation does not affect the visual review of the three supplied screenshots.

## Existing runtime and source assets

`src/main.js` loads GLBs with `GLTFLoader` from `/assets/<name>.glb`. `index.html` loads `/src/main.js`; Vite serves files in `public/` from the site root. The existing asset build is authored by `blender/build_assets.py`; the focused hero path in `blender/hero_articulation.py` exports the current hero. `blender/asset-manifest.json` records model bounds and hierarchy. The checked-in exports and relevant runtime roles are:

| Existing file | Current role and consumers | Integration contract |
|---|---|---|
| `public/assets/mercenary.glb` | Player avatar; loaded unbatched and cloned in `src/main.js` | Named rigid parts `left_arm`, `right_arm`, `left_leg`, `right_leg`, `left_knee`, `right_knee`, `left_foot`, `right_foot`, `head`, and `torso` are queried by the hero pose and `src/foot-contact.js`. The GLB has no glTF skin or animation clips; current movement is applied to named nodes in JS. Keep this source intact and load a supplied model through an explicit new alias. |
| `public/assets/interceptor.glb` | Player car and the static-but-physical parked car | The same loaded asset is cloned for both placements in `src/main.js` and referenced by `src/asset-placements.js`. Physics remains a kinematic `CANNON.Box` (half extents 1.4 × 0.64 × 2.60 m); lighting and damage visuals are applied around the model. The current GLB has one combined mesh and no wheel pivot nodes or animation clips. |
| `public/assets/av.glb` | Patrol aircraft, not a road vehicle | Keep it in the aircraft role. It is not Car 02's replacement slot. |
| `public/assets/drone.glb`, `crate.glb`, `kiosk.glb`, `relay.glb` | Drone, explosive cell, kiosk and data relay props | Unrelated to the requested replacements. |
| `public/assets/pulse-carbine.glb`, `ion-bolt.glb`, `muzzle-flash.glb`, `impact-shards.glb` | Weapon and combat visuals | Preserve their object/socket naming contracts consumed by `src/weapon-rig.js` and `src/weapon-vfx.js`. |

The only clearly defined playable character slot is the hero avatar. Ambient civilians are generated as shared instanced/segmented geometry, with editable source data in `blender/character-workshop.blend` and `blender/native_characters.py`; they are not independent Tripo-ready avatar slots. A second character role must be mapped to an actual existing entity after its export and intended role are available.

The runtime has one player-controlled car (`interceptor`) and one parked car, both using `interceptor.glb`. Ambient traffic is procedural in `src/city-life.js`; it does not use a second imported car model. `src/simulation.js`, `src/street-physics.js`, `src/vehicle-damage.js`, and `src/main.js` own the authoritative vehicle behavior/collision/damage and entry/exit logic. A second vehicle model is not enough to create a second drivable vehicle; a separate spawn/selection or enterable-car contract would need to be identified and tested first.

## Blender deliverables and existing pipeline

The repository currently contains these six `.blend` projects:

| Blender file | Current purpose |
|---|---|
| `blender/neon-district-city.blend` | Editable city, native signs, props, traffic/citizen scene data and packed billboard art. |
| `blender/cyberpunk-assets.blend` | Existing voxel prop and character kit source used by the asset builder. |
| `blender/character-workshop.blend` | Editable city population and finite citizen motion clips; not a second playable Tripo character slot. |
| `blender/hero-pose-workshop.blend` | Static inspection poses for the existing voxel hero. |
| `blender/pulse-carbine.blend` | Weapon and projectile-effect source. |
| `blender/service-actions.blend` | Service mechanism authoring and action source. |

`blender/build_assets.py` creates the existing kit and writes runtime GLBs under `public/assets/`, updating `blender/asset-manifest.json`. `blender/hero_articulation.py` produces/verifies the focused existing hero export. The repository's manifest documents Blender Z-up/+Y-forward to glTF Y-up/-Z-forward conversion. These sources must not be overwritten by imported Tripo files. A future integration should add or preserve source files in a dedicated source folder and wire separate runtime paths in `src/main.js`/asset placement data.

The currently available tool inventory for this Codex execution contains no Blender MCP tools. No `.blend` file was opened or saved during this task, and no Blender object was modified. Existing scene counts and asset conventions below are read from the repository's Phase 0 audit and manifests; custom model rig/material/texture compatibility remains unverified until real exports are available.

## Recommended incoming files and mapping

Place textured runtime exports at these proposed paths (these files do not currently exist):

```text
public/assets/tripo/character-01-brown-hair.glb
public/assets/tripo/character-02-blue-hair.glb
public/assets/tripo/car-01-990-cyan-magenta.glb
public/assets/tripo/car-02-armored-blue.glb
```

Keep editable `.blend` or `.fbx` sources, where available, under `blender/source/tripo/` using matching basenames. Do not replace the existing generated `mercenary.glb` or `interceptor.glb` in place. Once supplied, inspect each model's scene graph, dimensions, origin, forward axis, feet/wheel ground contact, material and texture embedding, skins, weights, animation clips, mesh separation and named wheel pivots before writing a loader or retarget adapter.

| Incoming model | Proposed browser consumer | Work needed before integration |
|---|---|---|
| Character 01 | Explicit player-avatar path replacing the current `mercenary` visual, preserving the hero's gameplay role | Determine scale/origin and facing; rig/animation compatibility; map limbs and boot soles for movement/foot contact; map weapon grip/aim pose. |
| Character 02 | Not assigned yet | Identify an existing entity role with the user. Current ambient civilians are a shared population, not a discrete model slot. Inspect rig and role before replacing anything. |
| Car 01 | Explicit player car visual path, with the parked car kept on its original model unless separately approved | Decide whether player and parked cars should share Car 01; check model bounds/origin/facing, materials, mesh surfaces and wheel nodes. Keep the current physics box unless a measured mismatch proves a targeted change is necessary. |
| Car 02 | No current second independently drivable road-car slot | Confirm whether it should become an alternate player car, an additional enterable vehicle, or a visual replacement for another specific existing role. Do not map it to `av.glb` or procedural traffic by guess. |

## Compatibility and validation requirements

- Preserve existing movement, weapon, combat, city, NPC, vehicle and service logic. Keep the original GLBs and Blender sources as recoverable deliverables.
- Use separate runtime references for the player car and parked car if their models should differ; update `src/asset-placements.js`, bounds-dependent logic and all exact loader references together.
- Preserve the current collision body as authoritative unless in-game measurements demonstrate a problem. Bodywork deformation (`src/vehicle-damage.js`) traverses mesh geometry, so a replacement must be checked for usable meshes/material handling.
- Keep hero named part nodes or add a tested animation/rig adapter. Imported clips alone do not satisfy existing JS pose and foot-contact contracts.
- Validate browser asset requests, scene placement, orientation, scaling, feet-on-ground, aiming/firing and vehicle enter/exit, steering, braking, collision, damage and restart after each asset is integrated.
- Re-export from Blender only when a specific export step requires it. Verify every resulting GLB header and render the real game before claiming an asset is integrated.

## Ordered implementation checklist

1. Provide the four actual textured GLB exports at the paths above, plus editable sources if available; identify Character 02's intended entity role and Car 02's intended driving/selection role.
2. Inspect all four GLBs and sources for dimensions, coordinate basis, pivots, skins, clips, materials, textures and naming; record compatibility before code changes.
3. Wire Character 01 to the player-avatar slot and validate locomotion, feet contact, aim, firing and weapon visibility with the existing controller.
4. Map Character 02 to the confirmed existing entity role and validate its behavior without replacing the player's role or the entire civilian system by assumption.
5. Wire Car 01 to a separate player model reference while preserving physics, damage, lights and parked-car behavior; validate driving and entry/exit.
6. Implement Car 02 only after its intended enterable/alternate-vehicle role is established; preserve the existing vehicle controller and test both vehicles end-to-end.
7. Run regression tests and production build, inspect model/texture network requests and browser console, then visually review the actual scenes and game.
