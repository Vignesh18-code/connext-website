# United Carriers — asset library

253 image files pulled from <https://unitedcarriers.com/>, re-filed by **where they appear on
the page** and renamed to say what they are. Nothing was deleted: every original file is still
in `../_raw-dump/` under its `imgi_*` / `download (n)` name, and `asset-map.json` maps every
original filename to its new path.

Open `index.html` (served over http, e.g. `python3 -m http.server`) for a visual contact sheet
of every folder.

## Folder order = page order

| Folder | Where it appears |
| --- | --- |
| `01-brand` | Header + footer logos |
| `02-loader` | Full-screen preloader (dotted world map) |
| `03-hero` | Hero section background stack |
| `04-intro` | "We move freight. We own the outcome." |
| `05-journey` | The scroll-driven freight story — see below |
| `06-service-icons` | The six service lines + 3 feature icons |
| `07-why-icons` | "Why United Carriers" list |
| `08-sky` | Air-freight scene (clouds + plane) |
| `09-testimonials` | Testimonial portraits |
| `10-partners` | Airline + shipping-line logo wall |
| `11-insights` | News card thumbnails |
| `12-footer` | Footer thumb, world map, payment + social icons |
| `13-ui-icons` | Shared small glyphs |

## `05-journey` — road art, and the parcel story has moved

The truck story (street, people, parcels, truck side view, flip frames, top view, mobile truck) now
lives in its own folder, in story order: **`public/assets/parcel-story/`** — see the README there.
What remains here:

```
road/                  road lines, the centre curve, and the giant scrolling label
step-4-ship-ocean/     (not used by the current page)
```

### Rebuilding the animation

Each step is a `position: sticky` scene. The parts are absolutely positioned inside it and
driven off scroll progress — the partner walks and swaps poses, parcels slide in at the truck's
rear, the street slides past, the wheels rotate, then the whole scene swaps to the top-down view.
The scroll choreography lives in `src/sections/street-story.js`. Because every part is its own file, you only ever animate `transform` and `opacity`.

## File naming

- `name.avif` — the full-size original.
- `name-500w.avif`, `-800w`, `-1080w`, `-1600w`, `-2000w` — Webflow's responsive variants.
  Use them as `srcset` widths; the un-suffixed file is the largest.
- `brand--default.png` / `brand--hover.png` — the two states of a partner logo.
- `-mb` suffix — the mobile cut of an asset that also has a desktop version.

## Gaps in the source dump

Two partner logos have only one state, because the live site itself reuses one image for both:
`airlines/air-new-zealand` has no `--hover`, and `shipping-lines/wallenius-wilhelmsen` has no
`--default`. Emirates and Maersk shipped their hover state under a different filename on the
CDN; both are filed correctly here. 33 airline files + 31 shipping-line files = 32 brands.
