# GLITCHBOUND Production Repair and Deployment Report

**Status:** Local production build prepared and verified. Vercel preview and production deployments are pending CLI access and project authentication.

## Verified repository state

- Branch: `main`; starting commit: `6bea17f` (same as `origin/main`).
- The worktree was already dirty before this deployment task. Existing modified Blender scenes/scripts, game source, localization, branding, blueprint files, and untracked `.pnpm-store/` were preserved. No reset, checkout, or cleanup was run.
- The project is a Vite, Three.js, and cannon-es browser game. It is static client-side delivery: no backend, API, WebSocket, auth provider, persistence service, or required environment variables were found.
- Vercel configuration targets Vite and `dist`, with no route rewrites. `/blueprint/` is a static subpage. `vercel.json` now applies the same cache policy to WebP runtime art as GLB and PNG assets.
- `.vercelignore` now excludes the generated local `.pnpm-store/` cache. Runtime source PNGs remain available during builds and remain unchanged in `public/assets` for Blender/source editing.

## Production preparation

The browser was loading the full-resolution PNG campaign artwork. Eighteen same-dimension WebP copies were added for runtime use, and the browser references were updated. A side-by-side contact sheet of original and WebP assets was inspected; composition, readable artwork, and aspect ratios were retained. Original PNGs were not altered.

The `postbuild` lifecycle runs `scripts/prune-deployment-assets.mjs`. It verifies that each editable PNG source exists and each runtime WebP was built, then removes only those source PNG copies and three source-kit-only files from `dist`: `relay.glb`, `advert-prompts.json`, and `user-advert-prompts.json`. It does not delete source files. The resulting build is **15.61 MiB across 41 files**, down from the earlier unoptimized build of about 50.93 MiB.

Required runtime artwork consists of `concept.webp` plus 17 `advert-*.webp` files in `public/assets/`. Runtime browser references were changed in `index.html`, `src/advert-campaigns.js`, and `src/city.js`. `README.md` documents the source/runtime distinction. `vercel.json` configures WebP caching. `scripts/prune-deployment-assets.mjs` provides the safe build cleanup.

## Checks completed

- Production lifecycle equivalent completed successfully: `node scripts/export-blueprint.mjs`, `node node_modules/vite/bin/vite.js build --configLoader native`, and `node scripts/prune-deployment-assets.mjs`.
- Blueprint generation reported 185 envelopes, 646 signs, 77 street fronts, 31 authored assemblies, 15 routes, and 2 entrances.
- Existing test runner: `node scripts/test.mjs` — **22/22 suites passed**.
- `node scripts/check-english.mjs` — passed, 113 text files scanned. This Unicode source check does not detect text rendered inside image pixels.
- Built static-site checks: all 35 required game, blueprint, GLB, and runtime image paths returned HTTP 200. The three excluded source-kit paths and original PNG runtime path returned true 404s on a plain static server. Vite preview separately returned expected WebP and GLB MIME types.
- Targeted `git diff --check` on the deployment changes passed. A repository-wide check still reports trailing whitespace in already-dirty `blender/build_assets.py` and `blender/city-scene-manifest.json`, plus Git line-ending conversion warnings; those files were not changed for this deployment task.
- Vite continues to warn that the Three.js and app chunks exceed its 500 KB advisory threshold. They build successfully; this is not a failed check.

## Deployment blockers and limits

- There is no `.vercel` project link, Vercel CLI installation, CLI auth file, or `VERCEL_TOKEN`/organization/project environment configuration in this session. A sandboxed `pnpm dlx vercel --version` attempt failed with Windows `EPERM` while resolving the user profile, before Vercel could be used.
- No preview URL or production URL has been created. Deployment must first run the Vercel CLI outside the sandbox, confirm the logged-in identity, inspect available projects, and explicitly verify/link the intended GLITCHBOUND project. Do not link to a similarly named project automatically.
- Browser automation is disabled by the current Work settings. The live 3D scene, WebGL console, camera/mouse input, audio, and in-game visual interactions could not be exercised in a real browser here. CPU test suites and static asset checks are not a substitute for that visual acceptance check.
- `npm` itself is not on this shell's PATH; pinned dependencies are already installed and the matching Node/Vite build lifecycle commands were run directly. `npm ci` was therefore not claimed as verified.

## Next deployment sequence

1. Run Vercel CLI with network access; verify CLI version and `whoami`.
2. Inspect candidate Vercel projects and the current directory's project association. Link only after confirming the exact intended project.
3. Create a preview deployment; verify its root document, title, blueprint route, GLBs, WebPs, and expected missing-file 404 behavior.
4. Complete visual browser acceptance of the actual 3D startup and gameplay when browser automation or an interactive browser is available.
5. Promote/deploy production only after the preview and available acceptance checks pass; record both URLs and deployment IDs.

No deployment is represented as complete until Vercel returns a deployment URL and it is verified.
