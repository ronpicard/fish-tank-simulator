# Artwork

These original project assets were made with the built-in image generation tool, with one generation per asset and no variants or retries:

- `public/assets/home-tank.png`: photographic domestic glass aquarium and cabinet, 1672 × 941.
- `public/assets/home-fish.png`: transparent 3 × 3 atlas of nine distinct small fish, 1254 × 1254. Rows contain clownfish/cardinalfish/gramma, firefish/wrasse/goby, and chromis/mandarin/blenny.
- `public/assets/home-creatures.png`: transparent 2 × 2 atlas of cleaner shrimp, cerith snail, hermit crab, and starfish, 1254 × 1254.

Exact prompts are saved in `public/assets/home-generation-prompts.json`. The built-in tool returned the sizes above rather than the requested 2048 output sizes. The tank photograph is used for the aquarium background and coral occlusion. The fish and creature atlases remain as original artwork references; the renderer no longer loads them.

The live animals are original procedural 3D models built with Three.js in `src/aquarium/animalGeometry.ts` and `src/aquarium/animalModels.ts`. Bodies, shells, starfish arms, eyes, gills, legs, and antennae use solid meshes. Curved fin membranes and fin rays move independently. Species markings and fine scale variation are generated in the material shader. No externally hosted models, animal textures, or additional model downloads are required.

The first version's open-ocean artwork and prompts are preserved in `artwork/previous-reef/`, outside the published assets.

Lucide supplies interface icons under the ISC license. DM Sans and Manrope are loaded from Google Fonts, with system font fallbacks.
