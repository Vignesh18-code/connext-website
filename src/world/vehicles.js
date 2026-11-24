/* Low-poly but proper vehicle shapes for the traffic: a car, an auto rickshaw, a bus and a motorbike with a rider.
   Each is a few merged parts, built in metres with the front towards +x, the wheels' lowest point at y = 0 and the middle at x = z = 0:
     paint   the painted body (takes the vehicle's colour)
     accent  a second colour (the rider's shirt), only on the motorbike
     dark    glass, canopy, helmet (fixed dark colour)
     wheels  tyres (fixed black)
   Sizes are about 15% larger than real so they read from high above. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** a side profile [[x, y], ...] pulled out sideways to a width; above `taperAbove` the sides lean inwards (tumblehome) */
function prism(profile, width, { taperAbove = 99, taper = 1, bevel = 0.05 } = {}) {
  const shape = new THREE.Shape(); profile.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y))); shape.closePath();
  const depth = Math.max(0.02, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, -depth / 2); g.deleteAttribute('uv');
  const p = g.attributes.position; let top = -1e9; for (let v = 0; v < p.count; v++) top = Math.max(top, p.getY(v));
  if (taper < 1) for (let v = 0; v < p.count; v++) { const y = p.getY(v); if (y > taperAbove) p.setZ(v, p.getZ(v) * (1 - (1 - taper) * Math.min(1, (y - taperAbove) / Math.max(1e-3, top - taperAbove)))); }
  g.computeVertexNormals();
  return g;
}

/** tyres: cylinders with the axle across the vehicle, at [x, z] positions */
function wheels(list, radius, width) {
  return mergeGeometries(list.map(([x, z]) => { const g = new THREE.CylinderGeometry(radius, radius, width, 10, 1); g.rotateX(Math.PI / 2); g.translate(x, radius, z); g.deleteAttribute('uv'); return g; }), false);
}
const join = (list) => mergeGeometries(list, false);

export function buildVehicleGeometries() {
  const car = {
    paint: join([
      prism([[-2.3, 0.3], [2.3, 0.3], [2.3, 0.62], [2.2, 0.74], [0.9, 0.84], [-1.6, 0.88], [-2.25, 0.8], [-2.3, 0.62]], 1.95, { taperAbove: 0.6, taper: 0.9 }),
      prism([[-0.95, 1.36], [0.35, 1.36], [0.35, 1.43], [-0.95, 1.43]], 1.55, { bevel: 0.02 }),   // the roof
    ]),
    dark: prism([[-1.55, 0.84], [0.95, 0.84], [0.35, 1.37], [-0.95, 1.37]], 1.78, { taperAbove: 0.9, taper: 0.86, bevel: 0.03 }),
    wheels: wheels([[1.45, 0.85], [1.45, -0.85], [-1.45, 0.85], [-1.45, -0.85]], 0.32, 0.24),
  };
  const auto = {
    paint: prism([[-1.5, 0.3], [1.15, 0.3], [1.55, 0.58], [1.5, 1.05], [0.65, 1.12], [-1.5, 1.0]], 1.42, { taperAbove: 0.8, taper: 0.9 }),
    dark: join([
      prism([[-1.55, 1.62], [0.7, 1.7], [0.7, 1.78], [-1.55, 1.72]], 1.62, { bevel: 0.03 }),     // the black hood
      prism([[0.62, 1.12], [0.95, 1.12], [0.78, 1.64], [0.62, 1.64]], 1.3, { bevel: 0.02 }),     // windscreen
    ]),
    wheels: wheels([[1.2, 0], [-0.9, 0.68], [-0.9, -0.68]], 0.28, 0.2),
  };
  const bus = {
    paint: prism([[-5.6, 0.45], [5.6, 0.45], [5.6, 2.6], [5.35, 3.0], [-5.4, 3.05], [-5.6, 2.85]], 2.62, { taperAbove: 2.4, taper: 0.96 }),
    dark: prism([[-5.3, 1.45], [5.45, 1.45], [5.45, 2.55], [-5.3, 2.55]], 2.7, { bevel: 0.02 }),   // the window band
    wheels: wheels([[3.7, 1.18], [3.7, -1.18], [-3.2, 1.18], [-3.2, -1.18]], 0.5, 0.32),
  };
  const bike = {
    paint: prism([[-0.75, 0.38], [0.7, 0.38], [0.85, 0.72], [0.1, 0.9], [-0.65, 0.84]], 0.34),
    accent: prism([[-0.55, 0.82], [0.05, 0.85], [0.2, 1.35], [-0.1, 1.5], [-0.5, 1.3]], 0.52),     // the rider
    dark: prism([[-0.05, 1.5], [0.3, 1.5], [0.3, 1.8], [-0.05, 1.8]], 0.32, { bevel: 0.04 }),      // the helmet
    wheels: wheels([[0.85, 0], [-0.8, 0]], 0.31, 0.12),
  };
  return [car, auto, bus, bike];
}
