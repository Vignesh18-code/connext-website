# -*- coding: utf-8 -*-
"""Bakes the India-only globe map into public/data/india-map.json.

The globe draws everything as dots, so every layer here is just a flat list
of [lat, lng] samples (stored as integers x100 to keep the file small):

  outline  India's border + coastline, sampled along the line
  fill     an even grid of dots inside India
  states   internal state / UT borders (the coast is left to `outline`)
  rivers   major river centrelines, clipped to India
  ocean    a faint grid over the sea around India (neighbouring land is
           left empty so India reads on its own)

Sources (download into SRC_DIR before running):
  india-composite.geojson  DataMeet, official boundary of India per the
                           Survey of India (CC-0)
                           github.com/datameet/maps/blob/master/Country/india-composite.geojson
  Admin2.{shp,shx,dbf,prj} DataMeet, states + UTs incl. Ladakh (CC BY 4.0)
                           github.com/datameet/maps/tree/master/States
  rivers10.geojson         Natural Earth ne_10m_rivers_lake_centerlines (public domain)
  land50.geojson           Natural Earth ne_50m_land (public domain)

Needs: pip install pyshp shapely
Usage: python scripts/build-india-map.py <SRC_DIR>
"""
import json, math, os, sys

import shapefile
from shapely.geometry import shape, Point, LineString, MultiLineString
from shapely.ops import linemerge, unary_union
from shapely.prepared import prep

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'india-map.json')

# dot spacing in degrees (tuned for the hero globe: ~7px per degree at 1440w)
FILL_STEP = 0.42
OUTLINE_STEP = 0.16
STATE_STEP = 0.16
RIVER_STEP = 0.16
OCEAN_STEP = 0.75
OCEAN_CENTRE = (20.0, 80.0)   # lat, lng
OCEAN_RADIUS = 38.0           # degrees of arc around the centre


def src(name):
    return os.path.join(SRC, name)


def sample_line(coords, step):
    """Evenly spaced points along a lng/lat polyline (step in degrees)."""
    out, carry = [], 0.0
    for (x1, y1), (x2, y2) in zip(coords, coords[1:]):
        k = math.cos(math.radians((y1 + y2) / 2))
        seg = math.hypot((x2 - x1) * k, y2 - y1)
        if seg == 0:
            continue
        d = step - carry
        while d <= seg:
            t = d / seg
            out.append((y1 + (y2 - y1) * t, x1 + (x2 - x1) * t))
            d += step
        carry = seg - (d - step)
    return out


def lines_of(geom):
    if geom.is_empty:
        return []
    if isinstance(geom, LineString):
        return [list(geom.coords)]
    if isinstance(geom, MultiLineString):
        return [list(g.coords) for g in geom.geoms]
    if hasattr(geom, 'geoms'):
        return [c for g in geom.geoms for c in lines_of(g)]
    if hasattr(geom, 'exterior'):
        return [list(geom.exterior.coords)] + [list(r.coords) for r in geom.interiors]
    return []


def grid_inside(prepared, bounds, step):
    """lat/lng grid with ~constant spacing on the sphere."""
    minx, miny, maxx, maxy = bounds
    pts = []
    lat = miny + step / 2
    while lat < maxy:
        dlng = step / max(0.2, math.cos(math.radians(lat)))
        # offset alternate rows so the grid reads as dots, not lines
        lng = minx + (dlng / 2 if int((lat - miny) / step) % 2 else 0)
        while lng < maxx:
            if prepared.contains(Point(lng, lat)):
                pts.append((lat, lng))
            lng += dlng
        lat += step
    return pts


def arc_deg(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lng2 - lng1)
    c = math.sin(p1) * math.sin(p2) + math.cos(p1) * math.cos(p2) * math.cos(dl)
    return math.degrees(math.acos(max(-1, min(1, c))))


def pack(pts):
    flat = []
    for lat, lng in pts:
        flat += [round(lat * 100), round(lng * 100)]
    return flat


def main():
    # --- India (official boundary) ------------------------------------------
    gj = json.load(open(src('india-composite.geojson')))
    india = unary_union([shape(f['geometry']) for f in gj['features']]).buffer(0)
    india_p = prep(india)

    outline = []
    for ring in lines_of(india.boundary):
        # skip specks (tiny islets) that would only add noise
        if LineString(ring).length < 0.08:
            continue
        outline += sample_line(ring, OUTLINE_STEP)

    fill = grid_inside(india_p, india.bounds, FILL_STEP)

    # --- states: shared borders only -----------------------------------------
    sf = shapefile.Reader(src('Admin2'))
    states = [shape(s.__geo_interface__).buffer(0) for s in sf.shapes()]
    borders = unary_union([s.boundary for s in states])
    # the union is noded into thousands of tiny segments; merge them back into
    # long lines so the sampler can space dots evenly along each border
    internal = linemerge(borders.difference(india.boundary.buffer(0.06)))
    state_pts = [p for line in lines_of(internal) for p in sample_line(line, STATE_STEP)]

    # --- rivers ---------------------------------------------------------------
    rj = json.load(open(src('rivers10.geojson')))
    river_lines = []
    for f in rj['features']:
        props = f['properties']
        if props.get('featurecla', '').lower().startswith('lake'):
            continue
        if (props.get('scalerank') or 10) > 7:
            continue
        g = shape(f['geometry'])
        if not g.intersects(india):
            continue
        river_lines += lines_of(g.intersection(india))
    river_pts = [p for line in river_lines for p in sample_line(line, RIVER_STEP)]

    # --- ocean: sea dots in a cap around India, land left empty ------------
    land = prep(unary_union([shape(f['geometry']) for f in json.load(open(src('land50.geojson')))['features']]).union(india))
    clat, clng = OCEAN_CENTRE
    r = OCEAN_RADIUS
    cap = (clng - r * 2.2, max(-80, clat - r), clng + r * 2.2, min(80, clat + r))
    ocean = []
    for lat, lng in grid_inside(prep(shape({'type': 'Polygon', 'coordinates': [[
            (cap[0], cap[1]), (cap[2], cap[1]), (cap[2], cap[3]), (cap[0], cap[3]), (cap[0], cap[1])]]})),
            cap, OCEAN_STEP):
        if arc_deg(lat, lng, clat, clng) > r:
            continue
        if land.contains(Point(lng, lat)):
            continue
        ocean.append((lat, lng))

    data = {
        'source': 'India boundary: DataMeet india-composite (CC-0, official boundary per Survey of India); '
                  'states: DataMeet Admin2 (CC BY 4.0); rivers + land: Natural Earth (public domain)',
        'scale': 100,
        'layers': {
            'ocean': pack(ocean),
            'fill': pack(fill),
            'states': pack(state_pts),
            'rivers': pack(river_pts),
            'outline': pack(outline),
        },
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as fh:
        json.dump(data, fh, separators=(',', ':'))
    for k, v in data['layers'].items():
        print(f'{k:8s} {len(v) // 2:6d} dots')
    print('wrote', os.path.normpath(OUT), os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
