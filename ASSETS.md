# Artwork

These original project assets were made with the built-in image generation tool, with one generation per asset and no variants or retries:

- `public/assets/home-tank.png`: photographic domestic glass aquarium and cabinet, 1672 × 941.
- `public/assets/home-fish.png`: transparent 3 × 3 atlas of nine distinct small fish, 1254 × 1254. Rows contain clownfish/cardinalfish/gramma, firefish/wrasse/goby, and chromis/mandarin/blenny.
- `public/assets/home-creatures.png`: transparent 2 × 2 atlas of cleaner shrimp, cerith snail, hermit crab, and starfish, 1254 × 1254.

Exact prompts are saved in `public/assets/home-generation-prompts.json`. The built-in tool returned the sizes above rather than the requested 2048 output sizes. The original tank photograph supplies both the live background and the static fallback. A depth-tested mask of its rock and coral silhouettes occludes distant fish. The fish and creature atlases remain as original artwork references; the renderer no longer loads them.

The live animals are original procedural 3D models built with Three.js in `src/aquarium/animalGeometry.ts`, `src/aquarium/animalModels.ts`, `src/aquarium/modelParts.ts`, and `src/aquarium/cuttlefishModel.ts`. Bodies, shells, starfish arms, eyes, gills, legs, and antennae use solid meshes. Curved fin membranes and fin rays move independently. The lionfish and betta have distinct fin shapes and procedural pigments; the cuttlefish has a solid mantle, eight arms, and rippling side fins. Starfish arm-tip deformation is coordinated with its raised surface detail. Species markings and fine scale variation are generated in the material shader. No externally hosted models, animal textures, or additional model downloads are required.

The first version's open-ocean artwork and prompts are preserved in `artwork/previous-reef/`, outside the published assets.

Lucide supplies interface icons under the ISC license. DM Sans and Manrope are loaded from Google Fonts, with system font fallbacks.

## Aquarium recording

`public/assets/aquarium-filter.mp3` is adapted from **Fish Tank Aquarium Water Filter Natural Sounds** by **DudeAwesome**, published March 28, 2017 on [Freesound](https://freesound.org/people/DudeAwesome/sounds/386023/), under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

The source is Freesound's [public high-quality MP3 preview](https://cdn.freesound.org/previews/386/386023_6885640-hq.mp3). The app bundles a 60-second stereo excerpt at 44.1 kHz / 160 kbps, with no external audio requests at playback time. Attribution, source, license, and modification details are also embedded in the MP3 metadata; the Settings panel links to the creator's recording and license.

Changes: take seconds 30–93; remove sub-bass below 45 Hz; reduce treble above 4 kHz by 3 dB; raise the level by 3 dB. Join the final three seconds to the first three with an equal-power crossfade, and place that blend after the middle 57 seconds to produce a continuous 60-second loop. Playback uses a 55% gain with smooth mute/unmute fades. The synthesized pump and bubble tones have been removed.
