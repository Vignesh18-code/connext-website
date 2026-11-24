# -*- coding: utf-8 -*-
"""Bakes the Chennai globe: public/data/chennai-map.json + src/chennai-projection.json.

The globe is Chennai only — the Chennai Metropolitan Area, with Greater
Chennai as the bright core — wrapped all the way round the ball so it spins
(and can be dragged) a full turn like the world globe, with Chennai on every
side. Chennai is a long, thin coastal city, so it is laid along the
equator: running north-to-south becomes going round the globe (north points
right, east is down), and distance inland from the shore becomes height on
the globe (the Bay of Bengal is below, inland is above). The dots are an even
grid on the sphere itself — made by the world globe's own dot workers.

Projection (`type: 'wrap'`, implemented in src/globe.js and mirrored here):
  globe longitude  lng0 + (lat - centreLat) * kAlong        (a full 360)
  globe latitude   coastLat + (coast(lat) - lng) * cos(centreLat) * kAcross
`coast(lat)` is a smoothed coastline so the shore runs round the globe as a
calm line. Map dots are written in GLOBE coordinates (`space: 'globe'`);
pins / labels / routes use real coordinates and go through the projection.

Output
  src/chennai-projection.json   the projection numbers (imported by src/data.js)
  public/data/chennai-map.json  `land`: the metro-area outline as GeoJSON-style
                                polygons in GLOBE coordinates (`space: 'globe'`).
                                The globe turns it into dots with the same
                                workers / sizes / colours as the world globe.

Sources (download into SRC_DIR before running):
  Zones.geojson, CMA.geojson
                 DataMeet Municipal_Spatial_Data/Chennai (Transparent Chennai),
                 CC BY-SA 2.5 India
                 github.com/datameet/Municipal_Spatial_Data/tree/master/Chennai
  qa.json, qb.json  OpenStreetMap region water (lakes incl. multipolygons via
                 `out geom`) and rivers — see git history / README for the
                 Overpass queries (same as osm.json, bbox 12.30,79.50,13.80,81.00)
  osm.json       OpenStreetMap (ODbL), Overpass:
      [out:json][timeout:120];
      ( way["waterway"~"^(river|canal)$"](12.80,80.08,13.30,80.40);
        way["natural"="coastline"](12.60,80.00,13.50,80.50);
        way["natural"="water"]["water"~"^(lake|reservoir|lagoon|river)$"](12.80,80.08,13.30,80.40);
        way["highway"~"^(motorway|trunk|primary)$"](12.80,80.08,13.30,80.40); );
      out tags geom;

Needs: pip install shapely
Usage: python scripts/build-chennai-map.py <SRC_DIR>
"""
import json, math, os, sys

from shapely.geometry import shape, Polygon, LineString
from shapely.ops import unary_union, transform

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT_MAP = os.path.join(ROOT, 'public', 'data', 'chennai-map.json')
OUT_PROJ = os.path.join(ROOT, 'src', 'chennai-projection.json')

# --- the wrap ----------------------------------------------------------------
LAT_S, LAT_N = 12.848, 13.295     # Chennai Metropolitan Area, south tip .. north tip
LAT_C = 13.044                    # this latitude faces the camera at the start
K_ALONG = 360.0 / (LAT_N - LAT_S) # globe degrees per real degree, round the globe
K_ACROSS = 0.55 * K_ALONG         # inland height (flatter, so the metro area's
                                  # widest part stays clear of the poles)
COAST_LAT = -52.0                 # the shore runs round the globe at this latitude
LNG0 = 52.28                      # globe longitude facing the camera at initialPhi 3.8
COS_C = math.cos(math.radians(LAT_C))

def src(name):
    return os.path.join(SRC, name)


def way_line(el):
    return LineString([(p['lon'], p['lat']) for p in el['geometry']])


def easternmost(coast_geom, lat):
    cross = LineString([(79.4, lat), (81.1, lat)]).intersection(coast_geom)
    xs = [g.x for g in getattr(cross, 'geoms', [cross]) if not g.is_empty and g.geom_type == 'Point']
    return max(xs) if xs else None


def main():
    osm = json.load(open(src('osm.json')))['elements']
    coast_geom = unary_union([way_line(e) for e in osm if e['type'] == 'way' and 'geometry' in e
                              and e.get('tags', {}).get('natural') == 'coastline'])

    # --- smoothed coastline over the city's latitudes ------------------------
    knot_step = 0.01
    lats = [round(LAT_S - 0.02 + i * knot_step, 4)
            for i in range(int((LAT_N - LAT_S + 0.04) / knot_step) + 1)]
    raw = [easternmost(coast_geom, lat) for lat in lats]
    for i, v in enumerate(raw):
        if v is None:
            raw[i] = next(x for x in raw[i:] + raw[::-1] if x is not None)
    smooth = [sum(raw[max(0, i - 3): i + 4]) / len(raw[max(0, i - 3): i + 4]) for i in range(len(raw))]
    knots = [[lat, round(lng, 4)] for lat, lng in zip(lats, smooth)]

    def coast_at(lat):
        if lat <= knots[0][0]:
            return knots[0][1]
        for (a0, b0), (a1, b1) in zip(knots, knots[1:]):
            if lat <= a1:
                return b0 + (b1 - b0) * (lat - a0) / (a1 - a0)
        return knots[-1][1]

    def to_globe(lng, lat, z=None):
        """real (lng, lat) -> globe (lng, lat), vectorised for shapely.transform"""
        if hasattr(lng, '__iter__'):
            pts = [to_globe(a, b) for a, b in zip(lng, lat)]
            return [p[0] for p in pts], [p[1] for p in pts]
        return (LNG0 + (lat - LAT_C) * K_ALONG,
                COAST_LAT + (coast_at(lat) - lng) * COS_C * K_ACROSS)

    # --- the metro area, in globe coordinates --------------------------------
    metro = unary_union([shape(f['geometry']).buffer(0) for f in json.load(open(src('CMA.geojson')))['features']])
    metro = unary_union([Polygon(p.exterior) for p in getattr(metro, 'geoms', [metro]) if p.area > 1e-5])
    g_metro = transform(to_globe, metro).buffer(0).simplify(0.12)
    # GeoJSON-style polygons ([[ring], [hole], ...]) in globe degrees: the
    # globe feeds them to the same dot workers the world globe used, so the
    # dots (even fill grid + edge dots, sizes, colours) are exactly as before
    land = []
    for poly in getattr(g_metro, 'geoms', [g_metro]):
        rings = [poly.exterior] + list(poly.interiors)
        land.append([[[round(x, 3), round(y, 3)] for x, y in r.coords] for r in rings])

    proj = {
        'type': 'wrap',
        'latRange': [LAT_S, LAT_N],
        'centreLat': LAT_C,
        'kAlong': K_ALONG,
        'kAcross': K_ACROSS,
        'coastLat': COAST_LAT,
        'lng0': LNG0,
        'coast': knots,
    }
    data = {
        'source': 'Chennai Metropolitan Area: DataMeet Municipal_Spatial_Data/Chennai (Transparent Chennai), '
                  'CC BY-SA 2.5 India; coastline: (c) OpenStreetMap contributors, ODbL',
        'space': 'globe',
        'land': land,
    }
    os.makedirs(os.path.dirname(OUT_MAP), exist_ok=True)
    with open(OUT_MAP, 'w') as fh:
        json.dump(data, fh, separators=(',', ':'))
    with open(OUT_PROJ, 'w') as fh:
        json.dump(proj, fh, separators=(',', ':'))
    print('land', len(land), 'polygons,', sum(len(r) for poly in land for r in poly), 'points')
    print('globe bounds (lng, lat)', [round(b, 1) for b in g_metro.bounds])
    print('wrote', os.path.normpath(OUT_MAP), os.path.getsize(OUT_MAP), 'bytes;',
          os.path.normpath(OUT_PROJ), os.path.getsize(OUT_PROJ), 'bytes')

    # which places in src/data.js sit inside the city (for the label list)
    if len(sys.argv) > 2:
        for line in open(sys.argv[2]):
            if "('" in line and ("major(" in line or "minor(" in line):
                parts = line.split("'")
                nums = line.split(',')
                try:
                    plat, plng = float(nums[2]), float(nums[3].split(')')[0])
                except (ValueError, IndexError):
                    continue
                d = metro.distance(shape({'type': 'Point', 'coordinates': [plng, plat]}))
                print(f'{parts[3]:20s} {"IN " if d < 0.004 else "OUT"} {d:.4f}')


if __name__ == '__main__':
    main()
