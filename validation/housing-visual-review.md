# Housing review — local build Dv3KyA3M

**Bounded architectural acceptance: accepted.** The new B102 staircase, supported landing and B103 recessed bays are visibly joined in the saved front/side views. Actual walking reaches the upper exterior entrance and returns to ground; the retained seat and passage beneath the landing remain usable. This is acceptance of this local architectural change, not the overall AAA/parity goal.

Build: `index-Dv3KyA3M.js`, SHA256 `144ab1382dcd80d2df5ec401300d6eff57e430788184906eb4f01cce4c2ac7c0`.

## Evidence

- `validation/housing-browser-Dv3KyA3M-2026-09-06T13-04-12-187Z.json` records actual W movement over all 16 risers, the 3.065 m landing loop and descent to .185 m. No jumping or movement injection occurred after each route began. The under-landing route stayed at .185 m for all 116 sampled frames. Across 1,198 route frames there were zero tested camera/solid intersections; the boom retracted in 229 frames.
- The matching `-stair-loop.webm` is a continuous 11.579 s, 1.67 MB clip. Decoded frames at .2, 2.5 and 10.5 s independently confirm road approach, ascent and the post-descent court. It is not a performance sample.
- Inspected full images: `-matched-court.png`, `-b102-stair-front.png`, `-b102-stair-side.png`, `-b103-bays.png`, `-landing-arrival.png`, `-under-landing.png`, and `-retained-seat.png` under the same prefix. No new obvious floating structural member or blocked intended path was found.
- `validation/housing-detail-blueprint-Dv3KyA3M-2026-09-06T13-16-55-610Z.json` records six additional checks. Actual buttons, canvas picks, assembly checkboxes, drag, zoom and fit work. The selected staircase route exposes .185–3.065 m elevations; the selected upper entrance shows floor 3.065 m and a closed exterior door. The entry screenshot clearly presents that record. Blueprint totals are 24 assemblies, 11 routes and two entrances, with 77 retained frontages. Both browser reports have zero errors and Chrome was closed afterward.

## Apparent player hovering

The earlier landing and bench images prompted a valid concern. A fresh live check transformed every rendered leg/boot vertex through its actual `matrixWorld`, compared the minimum sole Y with the controller's measured support and projected both points through the current camera. At ground, gaps ranged from −1.147 mm to −.003 mm; after real W ascent to the landing, −1.745 mm to −1.664 mm. The largest projected difference was .251 pixels. There is **no positive vertical gap in these settled poses**. Small idle leg rotations put the lowest vertices slightly into the surface.

The visible contact still reads weakly, especially on the landing. These measurements rule out a model/controller elevation offset; they do not isolate the visual cause. Improved local contact/shadow readability may help, but should be tested before changing the root height. Player animation remains simple and lacks per-tread foot placement; this review does not validate stair foot IK.

## Remaining visible limitations

1. The court still has a broad empty foreground and little resident activity. The new vertical route supplies a purpose and silhouette, but does not yet make the courtyard feel inhabited.
2. B102/B103 retain repetitive glazing, regular identical bay modules and older flat window patches. The depth is more legible than the prior flat frontage, but material/window variation remains visibly limited.
3. Player contact and stair movement are visually less convincing than the now-tested physical route. A later scoped animation/contact-lighting pass should preserve these measured support heights and route clearances.

The upper door is a closed exterior endpoint. No accessible apartment interior, broader movement parity, or blind comparison result is claimed. No production source or deployment was changed by this review.
