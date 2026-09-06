# Completed updates — September 6, 2026

Development is paused. This release starts from the prior public city and includes only completed work:

- The verified ten-part Blender hero, asset kit, pose workshop, source scripts and three inspection renders. Existing whole-leg walking remains active; the unfinished stair animation is excluded.
- Contact shading follows actual boot frames and includes thin physical walking slabs while excluding decorative paint.
- The architectural blueprint uses the existing SVG icon, resolving its favicon request error.
- Tested clearance, supported-foot-placement and timed swing helpers are included as source utilities. They are not connected to live animation.

The city, all twelve commissioned campaigns on 48 mounts, vehicles, combat and physical interactions from the prior release are retained. The full city Blender file remains the prior architectural checkpoint; the separate asset kit and hero workshop contain the new hero.

The quality roadmap remains incomplete. Unfinished player IK, pelvis, stair-speed changes and their associated gameplay experiments are preserved in the local working copy and are not part of this release.

## Release verification

All 22 portable test suites pass ([output](validation/finished-release-tests.txt)). The production build is `index-KpoojZaD.js`, SHA-256 `dc742a1e470834096b530305690f36f50b7dcc3e73bd2fffaf33dd198f08a363`. Seven [actual-input browser groups](validation/finished-release-browser/report.json) pass: ready state/exact build, all 48 new-ad displays and their assets, startup car separation, cameras, driving, authored muzzle/VFX and the blueprint. No page, console or failed local-resource errors were recorded. The test explicitly confirms the unfinished leg planner is not enabled. Vite retains its existing large-chunk advisory.
