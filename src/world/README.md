# The Connext world

Two scroll-driven three.js sections follow the intro ("We move freight. We own the outcome."): first the three streets from above
(`streets.js`, described at the end), then shot 1, the descent to a Chennai home's gate (`scene.js`).
Both share one scroll stage (`src/sections/stage.js`).

## Shot 1: the descent

The section after the three-streets section (`.home-world-wrap` in the generated page).
As you scroll, the camera starts straight above a Chennai street, follows the Connext truck down as it drives in,
and lands low beside it at a home's gate, where the resident hands a parcel to the Connext driver.

Connext is a pickup and delivery service for homes and companies (not a freight company with its own hub), so
the world is an ordinary Chennai street, and the only Connext branding is on the truck.

## Where things are

| Part | File |
| --- | --- |
| The page block (sticky stage, canvas, poster) | `index.html`, made by `world()` in `scripts/build-sections.py` |
| Scroll logic: lazy load, progress, drawing only while visible, automatic quality step-down, fallbacks | `src/sections/stage.js` (shared), started by `src/sections/world.js` |
| The scene: street, buildings, home, truck, people, camera path, effects | `src/world/scene.js` (its own small chunk, loaded when the section is near) |
| Layout and look of the stage | `src/styles/world.css` |
| Truck model, logo, poster pictures | `public/assets/world/` |

## What the scene is made of (no AI credits)

- **Buildings left and right:** the photoreal facades made for the parcel story (`public/assets/parcel-story/1-street/backdrop` and
  `places`: shops, apartments, offices with lit, furnished interiors and people inside) on real 3D blocks, with roofs, water tanks,
  stair rooms, solar heaters and AC units for the view from above. The rows are generated from the `FACADES` list.
- **The home:** compound wall, open gate, house with porch, balcony, lit rooms: built in code (`home` group in `scene.js`).
- **The truck:** `public/assets/world/truck-v3.glb`, the model from `tools/truck-render/`, with the Connext logo as a decal.
- **People and street life:** the cut-out figures from the parcel story (resident, driver, pedestrians, scooters, a fruit cart),
  standing on the footpaths; they fade out when the camera is high, because upright cut-outs look wrong from above.

## Change things

- **Camera:** the `KEYS` list in `scene.js` (camera offset from the truck, look-at, lens, depth of field, roll). Offsets are relative to the truck,
  so the street slides past while the truck drives in. `U_STOP` is where the truck has stopped; `STOP_X` is where.
- **Street plan:** `ROAD_HALF`, `WALK_OUT`, the `FACADES` sizes (`bodyM` is the real height of each building body), `PEOPLE` (positions in metres).
- **Scroll length:** `--world-scroll` in `world.css` (420vh desktop, 360vh phones).
- **Poster pictures** (shown while loading, with reduced motion, or if WebGL is missing): run the `world-recv` preview (it saves into
  `world/stills`), open the site with `?worldq=high`, scroll to the section and in the console call
  `__connextWorld.setProgress(0.92); await __connextWorld.still('http://localhost:5199/save?name=poster.png', 1920, 1080)`
  (and `1080, 1920` for the phone one), then save them as `public/assets/world/poster.jpg` and `poster-mobile.jpg`.

## Quality and safety

- Phones and weak machines start at the light setting (no depth of field or glow); the scene also steps itself down if frames come slowly
  (`degrade()` in `scene.js`, watched in `world.js`).
- Reduced motion: no scroll-driven camera, one still frame (`STILL_AT` in `world.js`). If WebGL is missing or lost, the poster stays.
- Test switches: `?worldq=low|high` forces a quality, `?still=1` forces the still frame.
- Measured on an Apple M4 (GPU time per frame): about 23-35 ms at full effects, 17-19 ms one step down, 9-14 ms at 1x, 7-9 ms with no effects.
  The preview pane in the app throttles animation frames, so measure with a synchronous read-back, not with `requestAnimationFrame`.

## Pondy Bazaar from above, with the Connext truck (`.home-streets-wrap`, before shot 1)

It opens on a straight-down picture of Pondy Bazaar (T. Nagar, Chennai): buildings both sides, the street across the upper part, live traffic.
Scrolling makes a Connext truck (the same model as the descent scene, ringed in pulsing brand green) pull out of the traffic, drive along
the street and park at a shop; the camera locks onto it and comes down to a close, tilted view of the truck at the shop front.
There are no street names or lines. The map is real OpenStreetMap data; heights and colours are made up in code. On tall (phone) screens the
street runs up the screen and the camera follows the truck from behind.

| Part | File |
| --- | --- |
| Page block (stage, canvas, map credit) | made by `streets()` in `scripts/build-sections.py` |
| Scroll logic | `src/sections/streets.js` (uses `stage.js`, `live: true`) |
| The scene: roads, buildings, camera, hero truck and ring | `src/world/streets.js` |
| The truck (model + logo decals) | `src/world/connext-truck.js` (same files and numbers as the descent scene) |
| Traffic | `src/world/traffic.js` |
| Colours, lighting, window/roof detail | `src/world/city-look.js` |
| Map data | `public/data/tnagar-streets.json`, built by `scripts/build-tnagar-map.py` from `data-src/tnagar/part_*.json` |
| Poster pictures | `public/assets/world/streets.jpg`, `streets-mobile.jpg` (the opening picture) |

- **Data:** real street layout from OpenStreetMap, © OpenStreetMap contributors (ODbL). The credit line in the section must stay.
  To refresh: re-download the four Overpass parts into `data-src/tnagar/` and run `python3 scripts/build-tnagar-map.py`.
  Roads and rails are cut at the edge of the building area so the map ends cleanly.
- **Camera:** `START` and `END` (height, tilt, lens) at the top of `streets.js`; the opening picture is Pondy Bazaar's middle shifted 45 m west and
  38 m south (`openAt`); `HERO_FROM` / `HERO_TO` are the scroll range in which the truck drives; the camera locks on between progress 0.02 and 0.5 and comes
  down between 0.28 and 0.94. Every frame it also checks where the corners of the picture land and, if they would leave the mapped area
  (`data.bounds`), comes down a little and/or slides back inside, so empty ground never shows (`__connextStreets.view()` reports the covered area).
- **The truck and its stop:** `traffic.route()` follows the busy street from 62 m west of the middle for 340 m. `STOP_D` (found at start-up) is the first
  place, 100 to 200 m along, where a shop-sized building (150 to 900 m2) stands at the kerb; the truck drives in the traffic lane (the left lane) and
  pulls to the kerb at the end (`pull`, `kerbLat`). It is moved by the scroll, not by time; other vehicles queue behind it while it is in the lane and swing out
  round it (about 2 m clear at any scroll speed, checked from 14 s down to 1.5 s). The model is heavy (about 180k triangles, 8.8 MB file): the scene lowers its quality
  automatically if frames run slow.
- **Roads (`roads.js`):** worn asphalt (tonal drift, aggregate, repair patches, sparse cracks, darker wheel tracks in every lane, sand along the kerb), concrete kerbs, paving slabs
  on the footpaths, and white paint (centre dashes and edge lines on the main roads, broken at junctions; zebra crossings and stop lines on junction arms; found from the traffic
  network). All flat layers (parks, pavement, kerb, tarmac, bridges, markings, contact shadows) are drawn one over the other in a fixed order (`renderOrder`) without writing depth,
  so they cannot fight over pixels at any height. Every fine pattern in the shaders fades out with its on-screen size (`lkLod`), so nothing shimmers; checked numerically.
- **Buildings (`city-look.js`, `facades.js`, `shopfronts.js`):** about nine in ten buildings of 8 m and more wear a PHOTOGRAPHED facade: the lit, furnished facades made for
  the parcel story (`public/assets/parcel-story/1-street/backdrop`, no new AI credits), cut by `scripts/build-facades.py` into 5 layers (`public/assets/world/facades/f0..f4.jpg`,
  one array texture) and described in the generated `src/world/facades.js`. The wall shader lays each one on the wall from the wall's own start (attribute `aW`): a top band,
  as many repeated floors as fit the building's real height (one seam-free floor slice, stretched at most about 25%), then the ground band (pharmacy, shops, cafe, lobby);
  wide walls tile the picture mirrored, narrow ones show its middle. Narrow lots get the narrow facades. Lit interiors glow a little (`lkEmit`). The rest keep four modern
  procedural styles (painted, glass curtain wall, cladding, brick or stone) with real window depth (bump from the window height field). Roofs: light concrete with
  terrace-tile joints, parapets, water tanks, stair rooms, rooftop solar panels; some tall buildings have a set-back top floor. Shop signs (generic names, one picture atlas) are
  only put where a facade picture has a blank fascia and with a name that suits the shop (`sign` in `facades.js`); the procedural buildings also get awnings, balconies and air
  conditioners. To change the facades: edit the table in `build-facades.py` (crop box, floor pitch, slice start, band edges) and run it.
- **Light and finish (`post.js`):** warm low sun with real shadows, the real sky as ambient light, Khronos Neutral tone mapping (keeps painted colours true), ambient occlusion
  (GTAO at half resolution; vehicles and signs are left out of its depth pass; full and middle quality only), and a light grade (cool shadows, warm highlights, S-curve, +8% colour,
  vignette). One composer for every quality level. Quality steps (`LEVELS` in `streets.js`): pixel ratio 1.4 + AO, 1.15 + AO, 1.0, 0.8.
- **Traffic (moves):** `src/world/traffic.js`, shapes in `src/world/vehicles.js` (car, auto rickshaw with black hood, bus with window band, motorbike with rider and helmet; separate instanced parts for paint, glass, tyres). The map's roads become a small network; cars, autos, buses and two-wheelers drive on it, on the left
  as in India, keep a safe distance and queue behind slower vehicles (Intelligent Driver Model), choose a way at every junction (straight on and
  main roads more often), slow down for turns and swing round them. Vehicles leaving the map edge re-enter elsewhere; real dead ends turn them round.
  About 1,200 vehicles at full quality, 55% on phones. The scene is `live` in `stage.js`: it draws every frame while on screen and nothing when scrolled
  away; reduced motion shows the opening picture, frozen. Density: `SPACING` and `KINDS` in `traffic.js`. There are no traffic lights.
- **Poster pictures:** `__connextStreets.setProgress(0)`, tick the traffic a little, then `.still(url, 1920, 1080)` / `(url, 1080, 1920)` through the `world-recv` preview.
