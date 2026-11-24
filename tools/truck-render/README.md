# Connext truck — render pipeline

Builds every truck image of the scroll story in the services section (side view, wheels, the 45-frame
side→overhead flip, the overhead view, the vertical truck for phones) from **one complete 3D truck**, so all
of them line up exactly.

## What the truck is

A small Indian 4-wheeler cargo truck (about 4.2 m long, 2.5 m tall): green cab, navy box with an aluminium
frame, real chassis, springs and wheels. It was made on Magnific:

1. A photoreal side view was generated (Nano Banana Pro, 4K) from the brand's truck artwork, then the front,
   rear and left views of the *same* truck from that image (creations `ks2OTaq16B` side, `vQ71ZjAa47` front,
   `VX5vUqdMMU` rear, `u54scjEQLD` left).
2. Those four views became the 3D model (Tripo v3.1, detailed textures) — `model/truck-v3.glb`.

`build.html` loads that model, centres it with the wheels on the ground, puts the **Connext logo** (from
`assets/logo.png`) on both sides of the box as a decal, adds a soft ground shadow, and renders it with
orthographic cameras. The photo texture already carries its lighting, so it is drawn unlit.

| Layer | Size | How |
| --- | --- | --- |
| side view (`api.plate`) | 2664 × 614 | 200 px per metre, truck centred at x = 1661, wheels on the bottom edge |
| wheels (`api.wheel`) | 256 × 256 | the tyre + rim, cut as a circle (gaps between the bolts filled dark), spun by the page |
| flip (`api.flip`) | 45 × 2880 × 809 | camera rises from the side to overhead and pushes in from 216 to 330 px/m |
| overhead (`api.top`) | 5760 × 1618 | exactly flip frame 44 at 2×; the full Connext logo is a decal on the box roof (`ROOF` in `build.html`) |

Those sizes and centres are the page's own CSS geometry (plate 2664 × 614, flip canvas 2880 × 809), so any
truck rendered here drops into the same layout.

## Re-render

Run these from the project root (the first two in the background):

```bash
python3 -m http.server 5198
```

```bash
node tools/truck-render/recv.mjs tools/truck-render/out
```

Open <http://localhost:5198/tools/truck-render/build.html>, then in the page console:

```js
await api.plate('final/side/plate.png');
await api.wheel('front', 'final/side/wheel-front.png');
await api.wheel('rear',  'final/side/wheel-rear.png');
for (let k = 0; k < 45; k++) await api.flip(k, `final/flip/${String(k).padStart(3, '0')}.png`);
await api.top('final/top/top.png');
```

Then write the AVIFs into `public/assets/parcel-story/` (`2-truck-side`, `3-truck-flip`, `4-truck-top`, `5-mobile`):

```bash
python3 tools/truck-render/export.py
```

## Things you are likely to change

- **Logo on the box**: `LOGO.w` (size) and `PANEL` (where the navy panel is) in `build.html`; the logo file is `assets/logo.png`. The same logo is on the roof, seen in the overhead view: `ROOF` (centre and width, in metres) in `build.html`.
- **Truck size on screen**: the truck is drawn at 200 px per metre (`PX`), the same scale as the people in the street. To make it
  smaller or bigger relative to them, change `PX` — and the street's `--rear` / `--m` in `service.css` and `service-mobile.css`.
- **Wheels**: `WHEELS` (found with `api.groundClusters()`, checked with `api.debugPlate()`), plus the matching `.wheel-1` / `.wheel-2`
  rules in `service.css` and `.mbts-wheel` in `service-mobile.css` (`width` = wheel diameter ÷ 2664, `right` = distance from the plate's right edge ÷ 2664).
- **Cab window**: the glass in the render is see-through on purpose — the page puts the seated driver behind it
  (see `public/assets/parcel-story/README.md`). If a new truck changes the cab window or the steering wheel, re-place the `spr('seat', …)` line in `crew()` in `scripts/build-sections.py`.
- **A different truck**: generate new views, make a new model, save it as `model/truck-v3.glb` (front must point to +x), then re-check `PANEL` and `WHEELS`.

Earlier versions of the truck (the semi-trailer, the long-box hybrid, the first 3D hybrid) and the code that used them are in `_backup-semi-truck/`.
