# Native dock render review

Status: **revised apron lighting accepted within the two-view scope below; the first dark apron remains an adverse finding.** This compares actual Blender renders before and after three mounted practical lights, separately from passing source/reopen checks and browser walking evidence. The reviewer authored the dock geometry and is an involved collaborator; this is an independent read of the rendered result, not a blind or uninvolved quality verdict.

## First render evidence

The preserved [first capture report](native-docks-before-practicals-preview.json) is dated 2026-09-06 14:53:21 UTC. It records Blender 5.2.1 LTS, Cycles, 16 samples, frame 1, 1100 × 720 pixels and a 66-degree vertical field of view. Both images came from native SHA256 `9bc43295b530bc8189691947bfe24eda5bb426e9776caec18cf827fd602a0d35`. Its original image paths remain as captured history; the immutable copies below have matching hashes. No new browser, render, production code or native-file edit was performed for this review.

| View | Camera → target, game coordinates | Original image SHA256 |
|---|---|---|
| [Preserved dark apron](native-docks-before-practicals-apron.png) | `(194,1.935,-21.7)` → `(182.4,2.5,-30.1)` | `0a424ffbf22200cc7f2dd829f9ff0437e0e9369c07afe5100319537b0509872a` |
| [Preserved first roof](native-docks-before-practicals-roof.png) | `(134,24,-19)` → `(116.7,15,-45)` | `7c83e1009ae2ba4d7796f3b7ea5e45b71c9fa42c6c1e2ae5635828a7855dd7d9` |

These hashes identify the adverse first images even if the current preview filenames are subsequently replaced. The elevated roof camera is an observer view, not evidence that the player can reach that height. The first images and report have been preserved before the lighting revision.

## First work apron: adverse finding

The canopy has a readable front edge, two visible grounded post feet, roof beams and luminous underside strips. The front post meets its stepped footing and paving without an obvious floating gap. Floor markings and the covered approach remain distinguishable. Those exposed relationships support a limited visible-join assessment.

The covered workspace itself is too dark. The back shutter, small wall hardware, work surface and parts of the rear framing collapse into a nearly continuous black area, despite the bright fixture strips immediately above them. Consequently this image does not demonstrate the intended service/loading depth or allow a reliable inspection of those hidden joins. The foreground paving retains a restrained dark finish rather than a uniform mirror, but that does not compensate for the unreadable work area. The issue is substantive visibility loss, not merely the intended nighttime palette.

## First raised roof

The ribbed cap, framed front panes and lower base are visible, and the base appears seated on the main roof. No detached cap or obvious floating front panel is apparent. The roof monitor reads as a connected industrial assembly from this angle. Its right side, rear and some connections behind the mast remain dark or occluded; their source audit is separate evidence.

The inherited large plain crane still dominates the smaller roof equipment, with little visible bracing or lifting mechanism. Broad roof and upper-wall areas remain sparse, and repeated panel/rib patterns limit the architectural variety. These are design gaps that brighter practical lighting alone will not resolve. No missing billboard texture or obviously invalid material block is visible in this frame; that observation is not a full material or scene audit.

## Implemented lighting revision

The native revision adds three area lights attached to actual dock fixture positions: two beneath the handling canopy and one at the process entrance. Authored geometry, runtime code, global lights and review cameras remain intact. The saved native file now has SHA256 `5d016b746b7caae94e2ceb84caa8e250bb6f40d3c1e56fd06d4c3b13311e54c3`; the parent completed fresh-reopen checks before these renders.

Read-only inspection of `blender/practical_lights.py` confirms that the three current emitter records select those existing luminous window-role boxes, use their actual width/depth, and sit 3 mm below the emitting face, facing downward. Their source IDs and assembly IDs are retained for reopen checks. Positive Three.js yaw maps to positive native Z rotation; the corrected helper follows that basis, and the final verifier also compares actual saved fixture-face vertices with each light rectangle. The 120 W apron and 95 W entrance powers are native preview calibration, not runtime photometric parity. No helper execution or additional render was performed by this reviewer.

## Final images and bounded verdict

The [final capture report](native-docks-preview.json), dated 2026-09-06 15:04:33 UTC, retains the original two cameras, 1100 × 720 resolution, 16 Cycles samples and 66-degree vertical field of view. The first images/report remain linked above.

| Final view | Image SHA256 |
|---|---|
| [Work apron after mounted practicals](../blender/city-docks-preview.png) | `81a354d7698e8cdeb95c5a73a5bf0ce3cf97b1ecee509a598e34b1d6b1b8c96c` |
| [Raised roof after mounted practicals](../blender/city-docks-roof-preview.png) | `0b38990cdfad6c5b41dbb20556c46cec78a7a305a56eeb27328d4f789d896fa8` |

The final apron image resolves the earlier visibility failure. The shutter slats and lower handles, cabinet drawers, work surface and small items, rear framing and underside beams are now distinguishable. The warm light forms a local pool across the covered floor and adjacent wall. Painted green/ochre surfaces retain their color and shape; no broad white hotspot, obvious material bleaching or detached bright patch is apparent. The grounded post feet and canopy/front framing still meet visibly, with no conspicuous floating gap in the exposed joins. This is sufficient to accept the revised work-area readability in this camera.

The final roof view shows the same connected ribbed cap, front panels and base silhouette, with a small entrance-light effect lower in the frame. It does not brighten the entire roof. Right-side, rear and underside connections remain dark or occluded, so they are not newly accepted visually. The inherited crane is still oversized and plain, roof/wall expanses remain sparse, and repetition limits the craft of the equipment. The two images are clean enough for this local inspection, but do not exhaust lighting, material or geometry edge cases.

The bounded gain is a legible, locally illuminated handling workspace plus preserved visible roof/front/base joins. The first dark render remains a recorded failure, and source/material/fixture-face verification remains separate evidence from the visual judgment.

No complete-city visual acceptance, exact runtime/native lighting parity, AAA claim or publication approval follows from these two views. The full quality goal remains open.
