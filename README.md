# United Carriers — hero globe (1:1 rebuild)

A faithful reconstruction of the globe in the hero section of
[unitedcarriers.com](https://unitedcarriers.com), rebuilt from their production
bundle (`united-carriers.netlify.app/chunks/my-flights-*.js` + `globe-*.js`) and
their live Webflow CSS.

```bash
npm install
npm run dev        # http://localhost:5173
```

---

## How it maps to the original

The effect is **3 stacked layers** — the WebGL canvas itself is transparent.

| Layer | File | Original source |
|---|---|---|
| **1. CSS atmosphere** (orange sunrise + blue earth) | `src/style.css` → `.home-hero-globe-shadow*` | Webflow CSS, `box-shadow` + `mix-blend-mode:plus-lighter` values copied verbatim |
| **2. three.js dot globe** (dots, pins, arcs) | `src/globe.js` | `chunks/my-flights-*.js` — reimplemented function-for-function |
| **3. country labels** | `CSS2DRenderer` in `src/globe.js` + `.globe-label` CSS | same |
| Boot / ticker / floating UI | `src/main.js` | `chunks/globe-*.js` (`GlobePage.Hero` class) |
| Point-cloud web workers | `src/workers.js` | worker source strings copied **verbatim** from their bundle |
| Airport + flight data, tuning constants | `src/data.js` | their `AirportsCollection` / `FlightsCollection` / `E` defaults, verbatim |

### The dot globe, step by step (`src/globe.js`)

1. **Renderer** — `WebGLRenderer({ alpha:true, antialias:false, powerPreference:'low-power' })`,
   `setClearColor(0,0)`, DPR capped at 2 (1.5 mobile). `PerspectiveCamera(55, …)` at `z = 2.45`.
2. **`CSS2DRenderer`** overlaid on the canvas for the HTML country chips.
3. **`OrbitControls`** — damping on, **zoom + pan disabled** (rotate only), disabled on mobile.
4. **Globe `Group`** tilted `rotation.x = 0.15`, `rotation.z = 0.05`. Auto-spin =
   `rotation.y += 0.0015 * speedMultiplier * (dt/16.666)` each frame, paused while dragging.
5. **Invisible occluder sphere** (`r = 0.99`, `colorWrite:false`, `renderOrder = -1`) hides far-side geometry.
6. **Continent dots**
   - fetch `world-atlas@2/land-110m.json`, decode TopoJSON → land polygons
   - **worker A** samples polygon outlines every `tileDeg * 0.7°` → coastline dots
   - **worker B** walks a lat/lon grid at `tileDeg` (1.2°) spacing, ray-cast point-in-polygon → interior dots
   - each returns a `Float32Array` of unit-sphere XYZ → two `THREE.Points`
   - material = `PointsMaterial` + a soft 64px radial-gradient sprite, with an
     `onBeforeCompile` patch that (a) shrinks `gl_PointSize` toward the rim and
     (b) `discard`s dots on the back hemisphere (`KILL_BACK`)
7. **City pins** — per airport: a tiny orange cylinder dot + an additive halo `Sprite`
   (`pinSize * 7.5`) + a `CSS2DObject` label + a `RingGeometry` pulse ring that fires
   when a route "arrives" at that city.
8. **Route arcs** — for each `status:true` flight: sample 33 points along a lifted
   great-circle (`1.002 + 4·lift·e·(1-e)`), build a thin `TubeGeometry` on a
   `CatmullRomCurve3`, and animate a **comet head** along it in the fragment shader
   (`mod(uTime*2.0 + aOffset, 2.5)` window + `discard`).
9. **`update({ phi, deltaTime })`** each frame: advance `uTime`, set `rotation.y`,
   pulse arrival rings, fade/de-blur labels that face the camera, push `uCamPos`
   into the dot shaders, render both renderers.

`src/main.js` adds the parts from their `Hero` class: a single `requestAnimationFrame`
ticker, an `IntersectionObserver` that pauses rendering when the hero scrolls away,
a `ResizeObserver`, a mobile/desktop rebuild on breakpoint change, and the floating
**label-toggle button + rotation-speed slider** (bottom-right).

---

## Make it *yours* (not a clone)

Everything you'd change lives in `src/data.js`:

- **`AIRPORTS.airports[]`** — your real hubs/offices: `{ text, country, city, lat, lng }`.
  Tip: nudge `lat`/`lng` slightly so a pin sits on a dot, like they did.
- **`FLIGHTS.flights[]`** — your trade lanes: `{ startLat, startLng, endLat, endLng, status:true }`.
  `status:false` lanes are ignored (kept for parity with their data).
- **`OPTS`** — colours (`pinDotColor`, `arcColor`, `edgeColor`, `fillColor`),
  `tileDeg` (dot density), `cameraZ`, `haloScale`, arc thickness/altitude, spin speed.
- **CSS glow** — `.home-hero-globe-shadow.*` in `src/style.css`. Swap the orange/blue
  hues for your brand; the structure (4 layered shadow divs, rotated 180°) stays.
- **Fonts** — currently falls back to a system mono. Add `BT Steinhart` /
  `BT Steinhart Mono` (licensed) or a free pair (Space Grotesk + Space Mono).

---

## Matching their layout exactly

Their hero uses a **fluid rem** system — `html { font-size: calc(100vw / 172.8) }`
(design width 1728 → 10px base → 11.11px @ 1920). Every `rem` in the CSS (the
globe's `right: -25rem`, all the atmosphere `box-shadow` offsets) resolves against
that, so the globe placement and the orange/blue glow scale with viewport width
just like production. `src/style.css` sets the same root rule; the `box-shadow`
values are the ones from their stylesheet, unchanged.

Verified at 1920×1080: `.home-hero-globe` lands at `x≈1117` (theirs: 1118), and
the orange terminator shadow resolves to the identical pixel values.

## Notes / differences from production

- They load the point-cloud workers as inline Blobs across Barba page transitions and
  **cache the globe instance** between navigations. This build has a single page, so
  the caching layer is omitted (the rebuild-on-resize hook is kept).
- Their starfield is a licensed Milky-Way photo (`star.avif` @ 0.18 opacity) plus a
  blurred warm layer. This build paints a **procedural** equivalent in
  `src/starfield.js` (field stars + a diagonal band + faint nebula clouds) so no
  third-party image is bundled. Swap in your own sky texture as a `background-image`
  on `#starCanvas` if you have one licensed.
- three.js pinned to `^0.169`. Their bundle reports r184; the shader-injection points
  used here (`project_vertex`, `color_fragment`, `opaque_fragment`/`output_fragment`)
  are handled defensively so newer three still works.
- `land-110m` is fetched from jsDelivr. For production, vendor it into `/public` and
  point `LAND_URL` at `/land-110m.json`.

### Globe comparison update (September 11, 2026)

Checked the current public reference globe and Hero modules. The previous desktop
camera distance of 2.45 was outdated: the reference uses 2.23 on desktop, 2.8 on
tablet, and 2.7 on mobile. The corrected version also matches the canvas-width
DPR cap, 0.99 depth sphere, route clock starting at 3.8, route-index pulse offsets,
and country-label positioning. Rotation starts with the reveal and uses lag
smoothing when resuming after a long frame. The horizon intentionally relies on
depth occlusion, matching the reference renderer's visible behavior.

At 1280 × 720, both globe wrappers measure 720 × 720 at x=745.1797,
and both glow discs measure 669.6094 × 669.6094 at x=770.375, y=25.1953.
The rendering canvas is 1080 × 1080 on the test display. Independent page loads
start separate animation clocks, so live screenshots can show different countries.

---

## Current globe (Connext)

The **original world globe** — same land dots, sizes, colours and full
side-to-side spin as the start — in the brand green, with **Chennai marked**:
a green pin, a soft pulsing ring and a "Chennai" name chip
(`AIRPORTS` in `src/data.js`; `pulse: true` makes any pin beacon). It starts
with India in view and Chennai just left of centre (`OPTS.initialPhi`).

The Chennai-only and India-only versions below are kept as presets
(`CHENNAI_MAP` + `CHENNAI_PLACES` / `CHENNAI_ROUTES` / `CHENNAI_SEA_LABELS`,
and `INDIA_MAP` + `INDIA_*`): spread the preset into `OPTS` and point
`AIRPORTS` / `FLIGHTS` / `SEA_LABELS` at its lists to switch.

## Chennai-only globe (preset)

The globe (a complete round planet on the right of the hero — `CHENNAI GLOBE
FRAMING` in `src/style.css`) shows **Chennai only**: the Chennai
Metropolitan Area, with Greater Chennai as the bright core, **wrapped all the
way round the ball**. It spins side to side and can be dragged a full turn
like the original world globe, with Chennai on every side.

- Chennai is long and thin, so it is laid along the globe's equator: going
  north = going round the globe (north points right), inland = up, the Bay of
  Bengal = down. Turning the globe walks you along the city: central Chennai
  (T. Nagar, Egmore, Central, Marina) -> North Chennai (Perambur, Madhavaram,
  Tiruvottiyur, Manali, Ennore, Red Hills) -> South Chennai (Tambaram,
  Medavakkam, OMR, Sholinganallur) -> back to the centre.
- Dots are made exactly like the original world globe's: the metro outline
  goes through the same two dot workers (even fill grid at `tileDeg` 1.2 /
  1.5 on phones, plus edge dots along the outline) with the same sprite,
  sizes (`pointSize`) and colours (`edgeColor`, `fillColor`). Set
  `OPTS.dotShading` above 0 to light them like a sphere instead.
- ~70 named places (OpenStreetMap coordinates): major places get a chip,
  minor a smaller name; overlapping names hide automatically while it turns.

How it's built:

- `scripts/build-chennai-map.py` (needs `pip install shapely`; sources and
  queries at the top) writes `public/data/chennai-map.json` (the metro
  outline, already in globe coordinates) and `src/chennai-projection.json` (the wrap: latitude
  range, smoothed shoreline, scales), which `src/data.js` imports as
  `OPTS.mapProjection`.
- `src/globe.js` — `makeWrapProjection` (places / routes / labels go through
  it), sphere shading, label overlap culling, `maxArcLength`.
- Places / routes: `AIRPORTS` / `FLIGHTS` in `src/data.js`
  (`major(code, name, lat, lng, align?)` / `minor(code, name, lat, lng)`).
- Earlier set-ups are kept: India (`INDIA_*`, `public/data/india-map.json`)
  and the world globe (`WORLD_*`, `map: null, mapProjection: null`).

### Map data credits

The active banner now renders zone borders (bright mint) and ward borders
(fine teal) from `public/data/chennai-boundaries.json`. These are the source
dataset's administrative divisions, not invented boundaries around each named
neighbourhood. They use the same stylized spherical projection as the pins.
Outer metropolitan places extend beyond the ward dataset's coverage.

Regenerate the compact rings with
`python3 scripts/build-chennai-boundaries.py /path/to/Chennai`, where the input
directory contains DataMeet's `Zones.geojson` and `Wards.geojson`. The generator
simplifies coordinates; the renderer subdivides each edge to follow the sphere.
The on-page legend links the source and license. Map controls toggle the border
layer and pause/resume rotation and route animation; reduced-motion preferences
keep animation stopped. The routes are illustrative, not live rider positions.

- Chennai city, zone and metropolitan-area boundaries — [DataMeet Municipal_Spatial_Data / Chennai](https://github.com/datameet/Municipal_Spatial_Data/tree/master/Chennai)
  (from Transparent Chennai), [CC BY-SA 2.5 India](http://creativecommons.org/licenses/by-sa/2.5/in/) — attribution required, share-alike.
- Roads, rivers, canals, lakes, coastline (city and surrounding region) — © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL — attribution required.
- (India version) India boundary — DataMeet `india-composite` (CC-0, official boundary per Survey of India);
  states — DataMeet `States/Admin2` (CC BY 4.0); rivers + land — Natural Earth (public domain).
