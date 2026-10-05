# Jewelry 3D Playbook

How to turn one product photo into three things:

1. **An interactive 3D page.** A single self-contained `.html` file that turns slowly, can be dragged to orbit and scrolled to zoom.
2. **Photoreal listing stills.** 2000×2000, path-traced, on a white sweep with a contact shadow and reflection.
3. **A turntable video.** A seamless 360° MP4 loop.

The working example is the polished gold graduated hoops in `art/`. Its build tools are in `art/jewelry-3d-tools/`.

---

## 1. What to send

| Need | Why |
| --- | --- |
| **Front photo** (required) | Sets the outline, proportions and colour. |
| **Side photo** | Sets the thickness and depth, which a front photo can't show. |
| **Top or back photo** | Shows the hinges, posts, clasps and backs. |
| **Real size in mm** (height, width, thickness) | Keeps proportions right and lets depth of field look natural. |
| **Metal and finish** | For example 14K yellow gold plated, high polish, brushed, hammered, or rhodium. |
| **Stones** | Cut, colour, size and setting type (prong, bezel, pavé). |
| **SKU** | Used for file names and captions. |

One photo is enough to start. Each extra angle removes guesswork about the shape.

---

## 2. Copy-paste prompt

Fill in the brackets and send it together with the photo(s).

```text
Recreate this jewelry piece in 3D from the attached photo(s).

PRODUCT
- SKU: [DEBS0000-G]
- Type: [hoop earrings / stud / drop / pendant / ring / bracelet]
- Real size: [height] x [width] x [thickness] mm
- Metal: [14K yellow gold plated / rose gold / sterling silver / rhodium]
- Finish: [high polish / satin / brushed / hammered]
- Stones: [none / cubic zirconia round 3 mm prong set / pearl 8 mm / enamel colour]
- Closure / hardware: [hinged snap / French hook / push back / lobster clasp]
- Pair or single: [pair / single]

MATCH THE PHOTO
Match the silhouette, proportions, thickness, edges and hardware as closely as the photos allow.
Tell me anything you had to guess.

DELIVER
1. An interactive 3D page: a single self-contained HTML file with slow rotation, drag to orbit,
   scroll to zoom, pause, and a light/dark backdrop toggle, kept fully framed while it turns.
2. Photoreal 2000x2000 stills: three-quarter main, front, side profile and a detail close-up,
   on a seamless white sweep with a soft contact shadow and a glossy reflection.
3. A turntable MP4: a [6]-second seamless 360° loop at [720 / 1080] px.

REALISM
Real studio HDRI lighting with light-tent softboxes and dark flags for contrast bands.
Contact shadows, ambient occlusion, a blurred and fading floor reflection, faint polish marks and
plating waviness, and tone mapping that keeps the metal's true hue.
Avoid blown highlights, plastic-looking metal and floating objects.

CHECK
Render every view and a full rotation, compare them against my photo, and fix any colour,
shape or framing problems before sending.
```

---

## 3. Material presets

These are the values that matched the listing photos. The hex codes are sRGB.

| Material | Live page (three.js) | Photoreal (Blender) |
| --- | --- | --- |
| **Yellow gold, polished** | `color 0xffd384`, metalness 1, roughness 0.2 × roughness map (≈0.09), env 1.45 | Base `(1.0, 0.79, 0.30)`, Metallic 1, Roughness 0.075–0.13 noise |
| **Rose gold** | `0xf2b49b`, roughness ≈0.1 | Base `(0.97, 0.70, 0.60)` |
| **White gold / rhodium** | `0xf2f2f0`, roughness ≈0.08 | Base `(0.92, 0.92, 0.91)` |
| **Sterling silver** | `0xe8e6e2`, roughness ≈0.12 | Base `(0.90, 0.89, 0.87)`, Roughness 0.1–0.16 |
| **Brushed / satin** | same colour, roughness 0.3–0.4 with streaks along the piece | Anisotropic 0.6, Roughness 0.3 |
| **Cubic zirconia / glass stone** | `MeshPhysicalMaterial` transmission 1, IOR 2.15 (CZ) or 1.5 (glass), dispersion ≈0.3 | Principled Transmission 1, IOR 2.15, roughness 0 |
| **Pearl** | color `0xf4ede2`, sheen 0.6, clearcoat 1, roughness 0.35 | Subsurface 0.15, Coat 1, Sheen 0.4 |
| **Stained glass / enamel** | See `src/main.js` (hibiscus): emissive "transmitted light" glass with veins | Transmission 0.9 with a coloured texture |

Tone mapping:
- **Live page:** use `NeutralToneMapping`. ACES drifts gold toward olive.
- **Blender:** use `AgX` with the *Medium High Contrast* look and exposure ≈ −1.0.

---

## 4. Pipeline

All commands run from `art/jewelry-3d-tools/`.

```bash
npm install --legacy-peer-deps      # three.js, BVH, CC0 studio HDRI, esbuild, playwright
npm run extract:hdr                 # writes hdr/studio.exr for Blender
pip install bpy==4.2.0              # Blender as a Python module (Cycles path tracer), Python 3.11
```

### A. Model the piece

- Geometry is generated in code. Edit `src/hoopGeometry.js` or create a new `src/<piece>Geometry.js`.
- **Hoops, bangles and rings:** sweep a cross-section along an oval path, as `bodyGeometry()` does.
  - Taper the width and depth along the path to match the photo.
  - Add a groove or channel in the section if the photo shows one.
- **Hardware:** hinges, catches, posts and jump rings are simple primitives (cylinders, spheres, capsules, tubes, tori).
  - Rings that link must actually pass through each other.
- **Stones:** use the right cut primitive (round brilliant, pear, baguette) and seat it in prongs or a bezel.

### B. Live 3D page

```bash
npm run build:hoops                 # dist/gold-hoops.html (download) + .artifact.html (preview)
PAGE=gold-hoops TAG=check node shot.mjs -0.45,1.4,2.7,4.2   # screenshots of 4 rotation angles
```

What `src/hoops.js` already includes:
- HDRI plus light-tent environment
- Baked ambient occlusion (BVH ray casts)
- Live contact shadow
- Blurred, fading reflection
- Polish and plating maps
- Depth of field, a subtle glow and grain
- Turntable rotation, orbit and zoom, pause, a light/dark backdrop, and exact framing during rotation

### C. Photoreal stills and video

```bash
npm run export:obj                  # blender/hoop.obj
EXPO=-1.0 python3 blender/render.py main 600 64     # quick look-dev render (~20 s)
blender/queue.sh                    # 4 stills at 2000 px / 200 samples, then a 180-frame turntable + MP4
```

Approximate times on 4 CPU cores:

| Render | Time |
| --- | --- |
| One 2000 px still | ≈ 13 min |
| Turntable, 720 px / 32 samples | ≈ 25 s per frame (≈ 75 min for 6 s) |
| Turntable, 1080 px | ≈ 2.5× longer |

The available views (`render.py <shot>`) are `main`, `front`, `side`, `detail` and `turntable`. Camera angles, lens and f-stop are set at the bottom of `render.py`.

---

## 5. Quality checklist

Check all of these before delivering:

- [ ] **Silhouette** matches the photo: proportions, taper, thickness, hardware positions.
- [ ] **Metal hue** matches: yellow gold must not drift to olive, brass or rose.
- [ ] **Highlights** are crisp bands, with dark bands for contrast. Nothing large is blown out to white.
- [ ] **Grounding:** the piece touches the floor, with a soft contact shadow under it.
- [ ] **Reflection** fades and blurs with distance and is not a hard mirror copy.
- [ ] **Full rotation:** no missing faces, inside-out normals, or parts intersecting.
- [ ] **Framing:** fully in frame at every angle, on desktop and on a phone (about 400 px wide).
- [ ] **Backdrop** is clean and seamless, with no softbox streaks or visible horizon.
- [ ] **Turntable loop** is seamless: the last frame flows into the first.

---

## 6. Marketplace notes

Check each marketplace's current image rules before uploading.

- **Amazon main image:** usually needs a **pure white (RGB 255) background**, with the product filling about 85% of the frame.
  - The renders use an off-white sweep (≈ `#f4f4f3`) with a reflection.
  - For an Amazon main image, re-render with `CYC_EMIT` raised, or level the background to 255. Use the reflection shots as secondary images.
- **Walmart:** square images on white, ideally 2000 px or more. The 2000×2000 renders fit.
- **Video:** MP4 H.264, square. The turntable loop works as a listing video or a social clip.

---

## 7. Known limits

- **One photo means estimated depth.** Ask for side and top photos when accuracy matters.
- **Studio HDRI:** the bundled one is CC0 and small (512×256). Extra softboxes in the code supply the sharp highlights.
- **Stones:** faceted stones need correct cut geometry and dispersion. Budget extra time for pavé.
- **Example pages:**
  - `art/gold-hoops.html`: live page (light/dark backdrop)
  - `art/gold-hoops-renders/`: stills and turntable MP4
  - `art/stained-glass-earrings.html`: the stained-glass hibiscus earrings, made from a design prompt rather than a photo
