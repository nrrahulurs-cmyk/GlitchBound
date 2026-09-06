# Neon District / art direction

The concept image was generated first, using the built-in image-generation tool, and became the art-direction reference for the game. The city pairs dark blue stepped voxel architecture with cyan and magenta technology, amber food stalls, wet pavement, rain, elevated walkways and a looming corporate skyline. The car, terminal, drone, kiosk, signage and game identity are original designs.

Saved image: `public/assets/concept.png`.

## Exact generation prompt

Use case: stylized-concept. Asset type: preproduction game environment concept art, a wide cinematic 16:9 image. Primary request: a richly detailed cyberpunk voxel video game in a gigantic dystopian metropolis, using Cyberpunk 2077 / Night City as visual inspiration: densely layered vertical architecture, corporate oppression, saturated neon advertisements, wet streets and retro-futuristic cybernetic technology. Original city and original designs. Scene: street-level view down a broad boulevard with a towering megastructure at the vanishing point, dozens of stepped voxel buildings, cyan-magenta glowing billboards, orange noodle kiosks, pipes, air conditioning units, cables, bridges, little voxel pedestrians, cybernetic security drones, rain and haze. In foreground a low angular voxel cyberpunk sports car with cyan wheel lighting and a cybernetic mercenary with an illuminated arm blade. Everything made of small crisp three-dimensional cubes with beautifully layered scale, dense details and tangible surfaces; premium Blender voxel render, strong composition, deep depth and moody atmosphere. Color palette: midnight navy architectural shadows, electric cyan and hot magenta signage, warm amber street vendors. Realistic illumination and beautiful rain-slick reflections contrasted with unambiguously cubic voxel shapes. Mood: immersive, alive, dangerous, alluring. No UI, no overlay text, no border, no copyrighted logos. High clarity readable architecture despite night lighting.

## Reference and implementation sources

- [Night City street reference shown by NVIDIA](https://game.watch.impress.co.jp/docs/news/1267411.html) — neon street layering, wet road, elevated architectural density and vehicle mood.
- [Three.js postprocessing documentation](https://threejs.org/manual/en/how-to-use-post-processing.html) — composer, bloom and output color workflow.
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) — renderer setup and animation loop.
- [cannon-es getting started](https://github.com/pmndrs/cannon-es/blob/master/getting-started.md) — rigid bodies and fixed-step physics.

The concept is a visual target. The browser implementation is an interactive voxel approximation with deliberate geometry and rendering limits, rather than an identical recreation of the generated raster image.

## Revision 02 / matching the concept

The first uniform avenue was replaced with much finer voxel masonry, staggered low storefronts and taller supporting towers. A stepped cyan megatower dominates the horizon. The composition includes a large upper-left magenta portrait advertisement, orange noodle storefront, a detailed dark interceptor, an armored mercenary and an overhead patrol aircraft. Rain, vapor and irregular reflective asphalt replace the earlier flat lighting and mirror-like ground. Connected streets and outer districts extend the city for free exploration.

The portrait billboard was generated with the built-in image tool using the original concept as its reference. Saved result: `public/assets/advert-portrait.png`.

## Distinct advertising campaigns

The portrait is used exactly once, as the landmark above the starting avenue. Four additional original raster advertisements were generated separately with the built-in image tool and are placed on other billboards:

| Campaign | Subject and palette | Saved artwork |
|---|---|---|
| KURO OPTICS / SEE BEYOND | Mechanical optical implant; acid lime, black and ivory | `public/assets/advert-kuro-optics.png` |
| AXIOM / BECOME MORE | Chrome synthetic skull; crimson, silver and black | `public/assets/advert-axiom.png` |
| OFFWORLD / LEAVE IT ALL BELOW | Orbital habitat and Earth; cobalt, violet and cream | `public/assets/advert-orbital.png` |
| MIDNIGHT RAMEN / OPEN 25 HOURS | Steaming voxel noodle bowl; tangerine, cream and oxblood | `public/assets/advert-noodle.png` |

Exact prompts for these four generations are saved in `public/assets/advert-prompts.json`. Storefront signs use a separate library of text brands, pixel circuitry and projecting neon signs. Shared layout data controls the campaign assignments in both Blender and Three.js.

Exact prompt for the original HUMAN+ portrait:

Use case: stylized-concept. Asset type: in-game cyberpunk emissive advertising billboard texture. Use the attached concept art as visual reference, specifically the huge illuminated hot-pink portrait billboard high on the left building. Create just the flat advertisement itself, a front-on full-bleed rectangular vertical artwork, no scene, no frame, no perspective distortion. A gorgeous detailed voxel woman's face with electric cyan blue short hair and cybernetic temple hardware, vivid hot pink and pale rose facial cubes, black eyes, cool confident expression. The woman's face turned slightly right in 3/4 view. Everything built from crisp tiny cubic voxel pixels like the reference ad, beautifully detailed with square pixel dithering. Intense magenta and purple flat luminous background with some simple cyan digital bars and small square graphic glitches. The portrait fills most of the image; black pixel borders are okay but avoid a blank black region. Strong resemblance to the reference billboard in the supplied original concept, true cubic voxel character, not smooth illustration. Tall 2:3 composition. No text or logos.
