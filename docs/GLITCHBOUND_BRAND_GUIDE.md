# GLITCHBOUND Brand Guide

## Brand core

**Product name:** GLITCHBOUND (uppercase in the wordmark; title case is acceptable in prose). Keep the name as one word. Do not revive NEON DISTRICT in the player-facing game or standard startup experience.

**Positioning:** A rain-soaked, free-roam cyberpunk city where people make their own way through the signal noise.

**Voice:** Direct, compact, atmospheric. Use clear English for instructions, status, warnings, and navigation. Keep fiction in district and character names; do not make essential instructions cryptic.

## Wordmark

Use the custom vector wordmark in `public/glitchbound-logo.svg` for the title screen, top bar, and atlas. It pairs the open-G signal mark with a custom, condensed stroke alphabet: **GLITCH** is electric cyan, **BOUND** is warm white, and a small magenta interruption with a lime signal block finishes the lockup. The top-bar version places “NO GODS. ONLY SIGNAL.” beneath the shared logo as an optional campaign line. Keep the product name on one line and legible; use plain text GLITCHBOUND when an image asset is not appropriate.

Do not split the name into separate product names, add a space, or apply a permanent distortion that harms legibility. Glitch cuts can appear as small transient details, never as missing letters.

## Icon

The icon is an angular, open **G**: an electric-cyan circular path with a magenta interruption across its crossbar and a small acid-lime signal block. It appears in `public/glitchbound-logo.svg` and as a standalone vector in `public/favicon.svg`, which is also declared as the installed-app icon in `public/manifest.webmanifest`. Preserve the square obsidian field and proportions in the icon. Do not add a wordmark inside the small icon.

## Palette

| Role | Color | Use |
| --- | --- | --- |
| Obsidian black | `#080A12` | Main interface and app-icon background |
| Electric cyan | `#00E5FF` | Primary brand signal, map and data highlights |
| Signal magenta | `#FF2BD6` | Secondary brand signal and rare glitch accents |
| Acid lime | `#C7FF4A` | Selective interaction, focus and ready states |
| Amber | `#FFB020` | Warnings and vehicle/service status |

Use off-white and muted blue-gray for body copy and secondary data. Neon is a signal, not a surface fill: reserve it for hierarchy, interaction, and wayfinding. Maintain readable text contrast and do not outline every control or object with glow.

## Typography

Use Barlow Condensed for large display text, Barlow for interface copy, and Space Mono for compact telemetry and controls. CSS stacks include system sans-serif and monospace fallbacks so English letters, numbers, punctuation, arrows, and the Latin accents used in proper names remain legible when web fonts are unavailable. Keep gameplay instructions in ordinary sentence case or short uppercase labels; avoid long all-caps paragraphs.

## Interface rules

- Keep the title, menu identity, HUD masthead, loading state, map/atlas, and error states branded GLITCHBOUND.
- Use cyan for brand and informational emphasis, lime for selective actionable/ready states, magenta for the icon accent, and amber for warning/status meaning.
- Keep HUD data compact, grouped, and readable over the city. Use a restrained dark backing or shadow when the moving scene lowers contrast.
- Use plain English for controls, prompts, confirmations, and failures. Put development diagnostics, repository paths, and source provenance in documentation or developer tools, never normal play.
- Use the district and setting names (for example, Vesper City and Kasumi Ward) as fictional locations, not as substitutes for the product wordmark.

## Signage and city graphics

Use GLITCHBOUND on a few high-value city marks: entry/wayfinding boards, the city atlas, and selected branded terminals or billboards. Keep storefront names and local advertisements varied so the city remains visually rich. Signs should pair a concise English headline with a small district, route, or service line; use the existing geometric billboard compositions and preserve their aspect ratios. Do not erase advertisements to remove old branding, stretch text to fit, or turn every sign into a logo. Any retained source artwork must retain its required attribution in `THIRD-PARTY-NOTICES.md`.

## Source and compatibility naming

The visible product identity is GLITCHBOUND. Some legacy technical identifiers are compatibility contracts and are intentionally retained: the saved source file `blender/neon-district-city.blend`, the `neon-district-native-characters` export schema, and the `window.__neon` diagnostic alias. New browser diagnostics use `window.__glitchbound`; both names point to the same object until downstream tools migrate. These technical names must not be rendered as ordinary player-facing UI.
