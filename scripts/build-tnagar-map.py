#!/usr/bin/env python3
"""Turns the raw OpenStreetMap download of T. Nagar (Chennai) into public/data/tnagar-streets.json,
the map behind the "three streets from above" section (src/world/streets.js).

Source: © OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright), fetched from the Overpass API on
2026-10-10 for the box 13.0335,80.2275 to 13.0440,80.2415 (roads, buildings, parks, railways) and kept in data-src/tnagar/.
To refresh, run the same Overpass queries, replace the part_*.json files there and run this script again.

Output (all distances in metres, x east, z south, origin at 13.0407 N 80.2370 E near Pondy Bazaar):
  buildings  [{r: [x,z,...], h}]       footprint ring and height
  roads      [{p: [x,z,...], w, k, n?, b?}]  centre line, width, class (m major, s side, f foot), highlight 1-3, bridge
  parks      [[x,z,...]]
  rails      [[x,z,...]]
  foci       the middle of the three highlighted streets: Pondy Bazaar, Usman Road, Ranganathan Street
"""
import json
import math
import os
import random

SRC = 'data-src/tnagar'
OUT = 'public/data/tnagar-streets.json'
LAT0, LON0 = 13.0407, 80.2370

PHI = math.radians(LAT0)
M_LAT = 111132.954 - 559.822 * math.cos(2 * PHI) + 1.175 * math.cos(4 * PHI)
M_LON = 111412.84 * math.cos(PHI) - 93.5 * math.cos(3 * PHI) + 0.118 * math.cos(5 * PHI)


def proj(p):
    return ((p['lon'] - LON0) * M_LON, -(p['lat'] - LAT0) * M_LAT)


def simplify(pts, eps):
    """Douglas-Peucker on an open polyline."""
    if len(pts) < 3:
        return pts
    (x1, z1), (x2, z2) = pts[0], pts[-1]
    dx, dz = x2 - x1, z2 - z1
    norm = math.hypot(dx, dz) or 1e-9
    best, idx = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dz * pts[i][0] - dx * pts[i][1] + x2 * z1 - z2 * x1) / norm
        if d > best:
            best, idx = d, i
    if best <= eps:
        return [pts[0], pts[-1]]
    return simplify(pts[:idx + 1], eps)[:-1] + simplify(pts[idx:], eps)


def simplify_ring(ring, eps):
    """Douglas-Peucker for a closed outline: split it at the corner farthest from the first one, so it cannot collapse."""
    if len(ring) < 4:
        return ring
    k = max(range(1, len(ring)), key=lambda i: math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]))
    return simplify(ring[:k + 1], eps)[:-1] + simplify(ring[k:] + [ring[0]], eps)[:-1]


def area(ring):
    return abs(sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1] for i in range(len(ring)))) / 2


def flat(pts):
    out = []
    for x, z in pts:
        out += [round(x, 1), round(z, 1)]
    return out


def load(name):
    return json.load(open(os.path.join(SRC, name)))['elements']


# ------------------------------------------------------------------ buildings
buildings = []
for e in load('part_buildings.json'):
    g = e.get('geometry') or []
    if len(g) < 4:
        continue
    ring = [proj(p) for p in g]
    if ring[0] == ring[-1]:
        ring = ring[:-1]
    ring = simplify_ring(ring, 0.4)
    if len(ring) < 3:
        continue
    a = area(ring)
    if a < 8:
        continue
    t = e['tags']
    h = None
    try:
        if 'height' in t:
            h = float(str(t['height']).lower().replace('m', '').strip())
        elif 'building:levels' in t:
            h = float(t['building:levels']) * 3.3
    except ValueError:
        h = None
    if h is None:
        r = random.Random(e['id'])
        h = r.uniform(9, 19) if a < 400 else r.uniform(13, 27)   # four to eight floors is typical here
    buildings.append({'r': flat(ring), 'h': round(max(3.0, min(h, 90.0)), 1)})

# the map ends where the buildings end: roads and rails are cut at that edge so nothing trails off into empty ground
_xs = [v for b in buildings for v in b['r'][0::2]]
_zs = [v for b in buildings for v in b['r'][1::2]]
BOX = (min(_xs), min(_zs), max(_xs), max(_zs))


def clip_line(pts, box=BOX):
    """cut a polyline [(x, z), ...] to a rectangle; returns the pieces that lie inside it"""
    x0, z0, x1, z1 = box
    pieces, cur = [], []
    for a, b in zip(pts, pts[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]
        t0, t1 = 0.0, 1.0
        for pk, qk in ((-dx, a[0] - x0), (dx, x1 - a[0]), (-dz, a[1] - z0), (dz, z1 - a[1])):
            if pk == 0:
                if qk < 0:
                    t0, t1 = 1.0, 0.0
                continue
            r = qk / pk
            if pk < 0:
                t0 = max(t0, r)
            else:
                t1 = min(t1, r)
        if t0 >= t1:
            if len(cur) > 1:
                pieces.append(cur)
            cur = []
            continue
        pa = [a[0] + dx * t0, a[1] + dz * t0]
        pb = [a[0] + dx * t1, a[1] + dz * t1]
        if cur and t0 > 0:
            pieces.append(cur)
            cur = []
        if not cur:
            cur = [pa]
        cur.append(pb)
        if t1 < 1:
            pieces.append(cur)
            cur = []
    if len(cur) > 1:
        pieces.append(cur)
    return pieces


# ------------------------------------------------------------------ roads
WIDTH = {'motorway': 16, 'trunk': 16, 'primary': 14, 'secondary': 12, 'tertiary': 10, 'unclassified': 7, 'residential': 7,
         'living_street': 6, 'service': 4, 'pedestrian': 7, 'footway': 2, 'path': 2, 'steps': 1.6, 'cycleway': 2, 'track': 3,
         'construction': 6, 'motorway_link': 8, 'trunk_link': 8, 'primary_link': 8, 'secondary_link': 7, 'tertiary_link': 6}
MAJOR = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'}
FOOT = {'footway', 'path', 'steps', 'cycleway'}
roads = []
foci_pts = {1: [], 2: [], 3: []}
for e in load('part_roads.json'):
    t = e['tags']
    hw = t.get('highway')
    if hw not in WIDTH:
        continue
    pts = [proj(p) for p in e['geometry']]
    if len(pts) < 2:
        continue
    pts = simplify(pts, 0.5)
    name = t.get('name', '')
    lat_mid = sum(p['lat'] for p in e['geometry']) / len(e['geometry'])
    lon_mid = sum(p['lon'] for p in e['geometry']) / len(e['geometry'])
    n = 0
    if e['id'] == 209503012:                                     # Sir Thyagaraya Road between Panagal Park and the bus terminus: Pondy Bazaar
        n = 1
    elif name == 'South Usman Road' and 13.0345 <= lat_mid <= 13.0395 and 80.2295 <= lon_mid <= 80.2320:
        n = 2
    elif e['id'] == 206824299:                                   # Ranganathan Street
        n = 3
    if n:
        foci_pts[n] += pts
    for piece in clip_line(pts):
        r = {'p': flat(piece), 'w': WIDTH[hw], 'k': 'm' if hw in MAJOR else ('f' if hw in FOOT else 's')}
        if n:
            r['n'] = n
        if t.get('bridge') in ('yes', 'viaduct') or (t.get('layer', '0').lstrip('-').isdigit() and int(t.get('layer', '0')) > 0):
            r['b'] = 1
        roads.append(r)

# ------------------------------------------------------------------ parks and railways
parks = []
for e in load('part_leisure.json'):
    g = e.get('geometry') or []
    if len(g) >= 4:
        ring = [proj(p) for p in g]
        parks.append(flat(simplify(ring, 0.6)))
rails = []
for e in load('part_rail.json'):
    g = e.get('geometry') or []
    if len(g) >= 2:
        for piece in clip_line(simplify([proj(p) for p in g], 0.6)):
            rails.append(flat(piece))

foci = []
for n in (1, 2, 3):
    pts = foci_pts[n]
    foci.append([round(sum(p[0] for p in pts) / len(pts), 1), round(sum(p[1] for p in pts) / len(pts), 1)])

xs = [v for b in buildings for v in b['r'][0::2]]
zs = [v for b in buildings for v in b['r'][1::2]]
data = {
    'source': '© OpenStreetMap contributors (ODbL), Overpass API, 2026-10-10',
    'origin': {'lat': LAT0, 'lon': LON0},
    'bounds': [round(min(xs)), round(min(zs)), round(max(xs)), round(max(zs))],
    'foci': foci,
    'names': ['Pondy Bazaar', 'Usman Road', 'Ranganathan Street'],
    'buildings': buildings, 'roads': roads, 'parks': parks, 'rails': rails,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as f:
    json.dump(data, f, separators=(',', ':'))
print(f"{OUT}: {os.path.getsize(OUT) / 1024:.0f} KB | buildings {len(buildings)}, roads {len(roads)}, parks {len(parks)}, rails {len(rails)} | foci {foci}")
