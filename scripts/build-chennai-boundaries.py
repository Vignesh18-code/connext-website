"""Build compact geographic border rings from DataMeet Chennai GeoJSON.

Usage: python3 scripts/build-chennai-boundaries.py /path/to/Chennai
Source: https://github.com/datameet/Municipal_Spatial_Data/tree/master/Chennai
Coordinates remain geographic; the renderer applies the same projection as pins.
"""
import json
import sys
from pathlib import Path


def simplify(points, tolerance=0.00008):
    if len(points) <= 2:
        return points
    a, b = points[0], points[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = dx * dx + dy * dy
    best, index = 0, 0
    for i, p in enumerate(points[1:-1], 1):
        t = max(0, min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy)/length)) if length else 0
        distance = (p[0]-a[0]-t*dx)**2 + (p[1]-a[1]-t*dy)**2
        if distance > best:
            best, index = distance, i
    if best <= tolerance*tolerance:
        return [a, b]
    return simplify(points[:index+1], tolerance)[:-1] + simplify(points[index:], tolerance)


def build(source):
    result = {
        'source': 'DataMeet / Transparent Chennai; CC BY-SA 2.5 India',
        'sourceUrl': 'https://github.com/datameet/Municipal_Spatial_Data/tree/master/Chennai',
        'note': 'Source administrative boundaries, stylized on a sphere; not navigation geometry.',
        'layers': {},
    }
    for name in ['Zones', 'Wards']:
        features = json.loads((source / (name + '.geojson')).read_text())['features']
        rings = []
        for feature in features:
            geometry = feature['geometry']
            polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
            for polygon in polygons:
                for ring in polygon:
                    rings.append([[round(x, 6), round(y, 6)] for x, y, *_ in simplify(ring)])
        result['layers'][name.lower()] = rings
    output = Path(__file__).resolve().parents[1] / 'public/data/chennai-boundaries.json'
    output.write_text(json.dumps(result, separators=(',', ':')))
    print(f'Wrote {output}: {output.stat().st_size:,} bytes')


if __name__ == '__main__':
    build(Path(sys.argv[1]))
