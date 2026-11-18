# White House 3D

A procedural, real-time model of the White House built with vanilla [Three.js](https://threejs.org) (r160) and `OrbitControls`. Every surface is generated in code: no external models or image files.

## Run

Serve this folder with any static server and open `index.html`:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Three.js loads from jsDelivr through the import map in `index.html`.

## What is modeled

- **Main block** at true scale (51.2 m × 26 m, about 168 × 85.5 ft): rusticated ground floor, belt course, Ionic corner pilasters, dentil cornice and the roof balustrade.
- **North Portico**: Ionic columns with spiral volutes, coffered ceiling, pediment with cartouche, fanlit entrance door, hanging lantern and the stoop over the areaway.
- **South Portico**: bowed colonnade, the Truman Balcony, curved twin staircases and the rusticated base with the diplomatic entrance.
- **Windows**: multi-pane sashes with muntins and meeting rails, architraves, sills, consoles and alternating triangular and segmental pediments.
- **Grounds**: north areaway, sloped terrain (the land rises about 2.9 m toward Pennsylvania Avenue), drives with curbs, walks, fences with stone piers, lamp posts, hedges, flower beds, procedural trees, both fountains with animated jets, the flag and the Washington Monument on the horizon.

## Rendering

- `MeshStandardMaterial` everywhere, with procedural canvas textures (painted sandstone ashlar, rustication, standing-seam roof, lawn, paving, bark, foliage) including normal and roughness maps.
- A custom sky dome (gradient, sun or moon disc, scattering glow, drifting clouds, stars) that also feeds a PMREM environment map.
- ACES Filmic tone mapping, exponential fog, 4096 px soft shadow map (re-rendered only when the light changes), bloom and MSAA.
- Three light presets (day, golden hour, floodlit night). The sun keeps a three-quarter angle to the chosen viewpoint.

## Files

| File | Contents |
| --- | --- |
| `src/main.js` | renderer, materials, light presets, camera flights, render loop |
| `src/house.js` | assembly of the residence |
| `src/parts.js` | columns, pilasters, windows, balustrades |
| `src/grounds.js` | terrain, drives, fences, lamps, beds, monument |
| `src/nature.js` | trees, hedges, flowers |
| `src/water.js` | fountains and GPU water jets |
| `src/sky.js` | sky dome shader |
| `src/textures.js` | procedural canvas textures |
| `src/builder.js` | geometry batching with world-space UVs |
| `src/hud.js` | site-plan viewpoints and light controls |
| `src/site.js` | dimensions and ground height |
