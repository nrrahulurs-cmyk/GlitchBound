# Docks and player contact — local cA0mxVCY

Build SHA256: `37b91e7f79500afc132cccf7224d850bab03a077e1628041546a2c0795e6a36d`. All reported images below came from that served bundle, with no source modification or build performed by the reviewer. The older Bynkp4Gf baseline remains preserved.

## Foot contact

The frozen off/on comparison modestly improves the apparent support beneath the bench and landing boots. A small dark region meets the soles and fades into the receiving surface. No detached disc, ring or broad halo was observed in either full image. It does not make the simple player gait or stair foot placement more realistic, and should not be described as doing so.

`validation/foot-contact-ab-cA0mxVCY-2026-09-06T14-15-36-337Z.json` and its PNGs/raw gzip record the exact comparison. A test-only RAF gate held simulation and animation; composer rendering toggled only the controller. Elapsed time, camera matrix and both animated leg matrices stayed equal. Repeat-off maximum channel difference was1/255 at the bench and0 at the landing; none exceeded1. Projected sole quads supplied each ROI. Average ROI luma changes ranged −1.22 to −1.59 on the0–255 display scale, including unaffected boot pixels. That number verifies an effect, not artistic quality. No shader/runtime errors occurred.

## Visible dock changes

`validation/iron-docks-after-cA0mxVCY-2026-09-06T14-19-06-503Z.json` records six fixed views, matched to the baseline cameras. Detailed block8 geometry was visible and its far duplicate hidden. No camera point lay inside queried static solids.

- Container panels now have legible ribs, framing, plates and vents instead of broad bare slabs. The added detail reads from the court and on both faces. Repeated plate placement and flat panel expanses still look manufactured from a limited set of modules.
- The covered handling apron has visible grounded posts, roof beams, lights, floor markings and a work surface. These supply a useful architectural purpose and depth while retaining the walking approach. No obvious floating or overlapping element is visible in this camera.
- The process-wall entrance has more distinct framing and door/vent detail. **Most rooftop equipment remains hidden behind the wall/parapet in the fixed process/roof camera.** That image does not visually validate the rooftop assembly; a separate raised inspection view would be needed. The broad upper wall remains sparse.
- Hiding billboard meshes leaves the new container structure readable, but the overall court remains open and largely inactive. This diagnostic retains sign supports and light spill; it is not an unlit/no-ad scene.

Live instance-matrix/material matching found all954 authored dock modules in the actual rendered batches:706 paintedSteel,121 contactMetal,28 oxide and99 nonmetal modules retaining base materials. This proves assignment, not that every finish achieves a realistic material impression.

## Raised B074 roof inspection

An additional read-only review inspected `validation/foot-contact-negative-cA0mxVCY-2026-09-06T14-30-04-789Z-B074-raised-roof.png`, captured from `(134,24,-19)` toward `(116.7,15,-45)`. This is an elevated observation camera, not a reachable player position. The reviewer authored the dock geometry; this assessment is an involved collaborator's second reading, not a blind or uninvolved preference verdict. No new browser, render or production edit was performed for this review. The HUD is visible, but the central roof assembly is clear.

The raised view resolves the earlier visibility limit for the exposed front and cap. The ribbed cap spans the framed side panels, the dark vertical members meet the lower curb, and that curb visibly sits on the main roof. The small cap height changes and panel rhythm now distinguish this equipment from a bare rooftop cuboid. The visible nearby equipment bases also appear seated on the roof. No detached cap, obvious floating panel or conspicuous intersection is apparent on these exposed faces. The rear, underside and some connections behind the large mast remain hidden; this image does not replace the source support/overlap audit.

The inherited ochre crane is the strongest remaining weakness in this view: its very large plain mast and beam dominate the smaller equipment, with little visible bracing, lifting hardware or articulation. The broad empty roof strip and upper wall below the neon edge remain sparse, while the monitor's repeated ribs and mostly flat panel fields still suggest a limited module family. The stepped silhouette reads, but its height variation is restrained. A later bounded crane/roof-access pass could add a legible bearing, bracing and connected maintenance route while preserving the current advert view and structural clearances; such work is not part of this acceptance.

Acceptance now includes the visible roof cap/front/base joins and their improved industrial silhouette in this one elevated view. It does not establish complete rooftop inspection, full-city quality, native-file correspondence or new publication readiness. The native dock refresh remains pending.

## Actual routes

All four paths passed actual W input: road→handling431 frames; the two longitudinal aisles269 frames each; cross-aisle226 frames. Only initial route setup used placement; active-route teleport was prohibited. There was no jump input, health remained100, and feet followed actual road/paver support (.057–.185 m on approach, .185 m in the aisles). Stopping drift can pass an endpoint slightly; the recorded full route was traversed. These were functional checks, not timing benchmarks or proof of crowd-width usability in the single-person cross-aisle.

Chrome is fully closed. Appearance acceptance is bounded to the observed sole contact, visible container/entrance/apron improvements, the exposed roof joins in the raised view and tested walking clearances. No blind comparison, complete rooftop visual acceptance, AAA parity, native source update or publication is claimed.

## Final guard verification — 2026-09-06, Y0FsMvtw

Final shader build `Y0FsMvtw`, SHA256 `10230ce13f05aaa5562ac79b9a51ce366d49e20a3e9e4bce469e86d7d83612d4`, passed the same frozen grounded comparisons. Repeat-off pixels were exactly equal in both poses; the small sole-adjacent darkening remains visible without a detached halo or ring. This is a restrained contact-readability improvement. The player still uses simple rigid leg animation; its stair motion was not improved by this shader.

Actual V-hidden, Space-airborne and E-vehicle transitions, production restart and lower-ground viewing beneath the occupied landing passed frozen off/on negative controls. No pixel changed by more than1/255; hidden, vehicle and lower-ground cases were exactly equal. Actual jump landing restored contact, and W stair telemetry recorded per-foot clear/partial states using real geometry/support. These checks extend the original two positive poses; they do not exhaust arbitrary support edges, tilted dynamic objects or all lighting. Raw state and telemetry remain in compressed reports.

Actual `IRON DOCKS YARD` button focus and canvas selection of `DOCKS-CONTAINER-CROSS-AISLE` displayed its0.80m width and authored points. Compact final evidence is `validation/foot-contact-final-browser.json`, linking the actual guarded-build images and blueprint data. No new rooftop image was needed after the shader-only guard.

Performance remains an open quality limit. The two unguarded cA clean loaded samples were50.542 and54.524FPS; the guarded final sample was54.195FPS, inside that range. Baseline stayed59.976FPS; guarded loaded p95 was33.3ms with32/300intervals over25ms. No FPS benefit is established. The existing instrumented cA profile measured CPU20.832ms/RAF versus GPU9.414ms, with8.454ms world stepping and6.284ms civilian updates. It is a separately instrumented observation, with overlapping costs and altered sampling overhead. All samples, exact hashes and qualifications are preserved in `validation/performance-docks-contact-profile.json`. No source, renderer setting, solver iteration count or effect was changed during these measurements. All Chrome processes were closed before native work resumed.
