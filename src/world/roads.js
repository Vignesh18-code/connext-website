/* The roads of the streets scene, drawn the way a real Indian street looks from above:
   worn asphalt (tonal drift, aggregate, repair patches, wheel tracks, sand along the kerb), concrete kerbs, paving slabs on the footpaths,
   centre dashes and edge lines on the main roads (broken at junctions), zebra crossings and stop lines at junctions.
   buildRoadLayers() returns flat layers in drawing order; streets.js draws them one over the other without depth fighting. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addRoadLook, addSurfaceLook } from './city-look.js';

/** flat ribbon along a polyline (a quad per segment plus a disc at each joint so corners stay closed).
    Every vertex also carries aRoad = (metres across the road, metres along it, half width) for the road shaders. */
export function ribbon(p, width, y) {
  const pos = [], idx = [], road = [], hw = width / 2;
  const push = (x, z, lat, s) => { pos.push(x, y, z); road.push(lat, s, hw); return pos.length / 3 - 1; };
  const alongAt = [0], norms = [];
  for (let i = 0; i + 3 < p.length; i += 2) {
    const x1 = p[i], z1 = p[i + 1], x2 = p[i + 2], z2 = p[i + 3], dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz) || 1, ux = -dz / L, uz = dx / L, s0 = alongAt[alongAt.length - 1];
    const a = push(x1 + ux * hw, z1 + uz * hw, hw, s0), b = push(x1 - ux * hw, z1 - uz * hw, -hw, s0), c = push(x2 - ux * hw, z2 - uz * hw, -hw, s0 + L), d = push(x2 + ux * hw, z2 + uz * hw, hw, s0 + L);
    idx.push(a, c, b, a, d, c); alongAt.push(s0 + L); norms.push([ux, uz]);
  }
  for (let i = 0; i < p.length; i += 2) {   // joints
    const j = i / 2, nrm = norms[Math.min(j, norms.length - 1)] || [0, 1], s = alongAt[Math.min(j, alongAt.length - 1)];
    const c = push(p[i], p[i + 1], 0, s); let prev = -1, first = -1;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2, ox = Math.cos(a) * hw, oz = Math.sin(a) * hw, v = push(p[i] + ox, p[i + 1] + oz, ox * nrm[0] + oz * nrm[1], s);
      if (prev >= 0) idx.push(c, v, prev); else first = v; prev = v;
    }
    idx.push(c, first, prev);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));   // every normal up: even lighting
  g.setAttribute('aRoad', new THREE.Float32BufferAttribute(road, 3));
  g.setIndex(idx);
  return g;
}

/** rectangle on the ground: centre, long-axis direction (ux, uz), half length, half width */
function quad(out, cx, cz, ux, uz, hl, hwid, y) {
  const nx = -uz * hwid, nz = ux * hwid, ax = ux * hl, az = uz * hl, base = out.pos.length / 3;
  out.pos.push(cx - ax + nx, y, cz - az + nz, cx - ax - nx, y, cz - az - nz, cx + ax - nx, y, cz + az - nz, cx + ax + nx, y, cz + az + nz);
  out.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
}

/** dashes (or a solid line when off = 0) along a polyline shifted sideways by `shift`; `skip(x, z)` drops pieces (near junctions) */
function lineAlong(p, shift, width, on, off, y, out, skip) {
  let carry = 0, drawing = true;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const x1 = p[i], z1 = p[i + 1], dx = p[i + 2] - x1, dz = p[i + 3] - z1, L = Math.hypot(dx, dz); if (L < 0.01) continue;
    const ux = dx / L, uz = dz / L, sx = -uz * shift, sz = ux * shift; let d = 0;
    while (d < L) {
      const len = drawing ? on : off, step = Math.min(L - d, off === 0 ? L : len - carry);
      if (drawing) { const mx = x1 + ux * (d + step / 2) + sx, mz = z1 + uz * (d + step / 2) + sz; if (!skip(mx, mz)) quad(out, mx, mz, ux, uz, step / 2, width / 2, y); }
      d += step; carry += step; if (off !== 0 && carry >= len - 1e-6) { carry = 0; drawing = !drawing; }
    }
  }
}

const hash2 = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

/** @returns {{ layers: Array<{ name, geometry, material, shadow }>, markings: THREE.MeshStandardMaterial | null }} in drawing order */
export function buildRoadLayers(data, network) {
  const groups = { pave: [], kerb: [], foot: [], rail: [], side: [], major: [], pave_b: [], tar_b: [] };
  const marks = { pos: [], idx: [] };

  // junctions (three or more roads meet): markings stop short of them, zebra crossings go on their arms
  const junctions = network ? network.nodes.filter((n) => n.deg >= 3) : [];
  const jgrid = new Map(), JC = 16, jkey = (cx, cz) => cx + ',' + cz;
  for (const n of junctions) { const k = jkey(Math.floor(n.x / JC), Math.floor(n.z / JC)); (jgrid.get(k) || jgrid.set(k, []).get(k)).push(n); }
  const nearJunction = (x, z, r) => {
    const cx = Math.floor(x / JC), cz = Math.floor(z / JC);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const list = jgrid.get(jkey(cx + i, cz + j)); if (list) for (const n of list) if (Math.hypot(n.x - x, n.z - z) < r) return true; }
    return false;
  };

  for (const r of data.roads) {
    if (r.k === 'f') { groups.foot.push(ribbon(r.p, r.w, 0.035)); continue; }
    if (r.b) { groups.pave_b.push(ribbon(r.p, r.w + 3.2, 0.5)); groups.tar_b.push(ribbon(r.p, r.w, 0.52)); }
    else { groups.pave.push(ribbon(r.p, r.w + 3.2, 0.02)); groups.kerb.push(ribbon(r.p, r.w + 0.9, 0.045)); (r.k === 'm' ? groups.major : groups.side).push(ribbon(r.p, r.w, r.k === 'm' ? 0.07 : 0.055)); }
    if (r.k === 'm' && r.w >= 10) {
      const y = r.b ? 0.54 : 0.08, hw = r.w / 2;
      lineAlong(r.p, 0, 0.16, 3, 4, y, marks, (x, z) => nearJunction(x, z, 9 + hw * 0.4));              // centre dashes
      lineAlong(r.p, hw - 0.7, 0.16, 0, 0, y, marks, (x, z) => nearJunction(x, z, 8 + hw * 0.3));     // edge lines
      lineAlong(r.p, -(hw - 0.7), 0.16, 0, 0, y, marks, (x, z) => nearJunction(x, z, 8 + hw * 0.3));
    }
  }
  for (const rp of data.rails) groups.rail.push(ribbon(rp, 3.2, 0.08));

  // zebra crossings and stop lines on the arms of junctions
  let zebras = 0;
  for (const n of junctions) {
    if (hash2(n.x, n.z) < 0.3) continue;
    for (const o of n.out) {
      if (o.cls < 2 || o.w < 7 || o.len < 16 || o.lift) continue;
      let cross = 0; for (const k of n.out) if (k !== o && Math.abs(k.ux * o.ux + k.uz * o.uz) < 0.8) cross = Math.max(cross, k.w);
      const d0 = (cross || o.w) / 2 + 2.6, px = -o.uz, pz = o.ux;   // d0: distance from the junction centre to the middle of the crossing
      if (d0 + 8 > o.len) continue;
      const span = o.w - 1.6, count = Math.max(3, Math.floor(span / 1.05));
      for (let i = 0; i < count; i++) { const t = (i - (count - 1) / 2) * (span / count); quad(marks, n.x + o.ux * d0 + px * t, n.z + o.uz * d0 + pz * t, o.ux, o.uz, 1.5, 0.27, 0.085); }
      quad(marks, n.x + o.ux * (d0 + 3.3) + px * (o.w / 4), n.z + o.uz * (d0 + 3.3) + pz * (o.w / 4), px, pz, o.w / 4 - 0.4, 0.17, 0.085);   // stop line for the traffic coming in
      zebras++;
    }
  }

  const merged = (list) => (list.length ? mergeGeometries(list, false) : null);
  const layers = [];
  const add = (name, list, material, shadow = true) => { const geometry = merged(list); if (geometry) layers.push({ name, geometry, material, shadow }); };
  add('pave', groups.pave, addRoadLook(new THREE.MeshStandardMaterial({ color: 0xc2bcae, roughness: 0.95 }), 'paving'));
  add('kerb', groups.kerb, addSurfaceLook(new THREE.MeshStandardMaterial({ color: 0xaaa699, roughness: 0.95 }), { grain: [[0.5, 0.06], [4, 0.05]] }));
  add('foot', groups.foot, addRoadLook(new THREE.MeshStandardMaterial({ color: 0xc2bcae, roughness: 0.95 }), 'paving'));
  add('rail', groups.rail, new THREE.MeshStandardMaterial({ color: 0x66696b, roughness: 0.8 }));
  add('side', groups.side, addRoadLook(new THREE.MeshStandardMaterial({ color: 0x555759, roughness: 0.92 }), 'tarmac'));
  add('major', groups.major, addRoadLook(new THREE.MeshStandardMaterial({ color: 0x4a4c4e, roughness: 0.9 }), 'tarmac'));
  add('pave_b', groups.pave_b, addRoadLook(new THREE.MeshStandardMaterial({ color: 0xc2bcae, roughness: 0.95 }), 'paving'));
  add('tar_b', groups.tar_b, addRoadLook(new THREE.MeshStandardMaterial({ color: 0x4a4c4e, roughness: 0.9 }), 'tarmac'));
  let markings = null;
  if (marks.pos.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(marks.pos, 3)); g.setIndex(marks.idx);
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(marks.pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    // paint, a little worn and dusty
    markings = addSurfaceLook(new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.85 }), { grain: [[0.7, 0.10], [5, 0.10]] });
    layers.push({ name: 'marks', geometry: g, material: markings, shadow: true });
  }
  return { layers, markings, zebras };
}
