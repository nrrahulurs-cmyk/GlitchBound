# Articulated hero: bounded native review

The implementation author inspected these actual Cycles CPU renders from the freshly reopened editable workshop. This is a review of three static poses, not a blind review or acceptance of the live gait.

- [Three poses](../blender/hero-pose-preview.png): idle, one 0.18 m riser and two risers; the corrected labels are readable.
- [Knee and ankle detail](../blender/hero-knee-preview.png): the lower leg bends separately from the thigh while the boot remains level. Stepped hinge housings bridge the deliberately relieved armor joints; no obviously detached cuff is visible in this pose.
- [Side articulation](../blender/hero-side-preview.png): the bent knee and counter-rotated ankle are legible against the support blocks. The boot soles meet the intended lower and upper surfaces.

The original boots and knee pads remain bulky. These views do not establish natural stride timing, all-angle armor clearance or reliable live placement on arbitrary stairs. Runtime walking, stopping, turning and support changes still require their separate tests and visual acceptance. The full city has not been regenerated with this hero.

[Native verification](hero-articulation-native.json) checks all 1,496 saved vertices and 1,122 face materials in each pose after reopening, plus four deliberately incorrect transform/material controls. [GLB verification](hero-articulation-glb.json) checks all 187 modules, unchanged non-leg geometry, preserved outsole corners and unchanged rest bounds against the published 175-module asset. The difference is explicit: eight legacy modules were adjusted for articulation and twelve hinge modules were added. [Native descendant-copy verification](native-hero-descendant-copy.json) executes the actual city builder's hierarchy-copy code and checks the ten copied parts at a nontrivial placement, scale and yaw; it does not regenerate the city.

The three images use 1,200 × 850 pixels, 16 samples, denoising and two CPU threads. Rendering did not change the saved workshop. Individual image hashes and capture durations are in the native report.

| Artifact | SHA-256 |
| --- | --- |
| `public/assets/mercenary.glb` | `a610ddd46a4996a65c2616b5292b504b27e5f17bc74975e1e63a2158acb5bcea` |
| `blender/hero-pose-workshop.blend` | `24d347e9b96e2731ab6d99c6573f053dce73f747b7717afd6db3eafc133501cc` |
| `blender/cyberpunk-assets.blend` | `e47fb68da4b545068ebe552381bc25ef5d5591b015136b0b8b6aba7511a7a044` |
