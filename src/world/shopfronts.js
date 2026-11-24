/* Street frontages: what you see where the buildings meet the street in a Chennai shopping area.
   For every building wall that faces a road and stands close to it we add
   - a shop signboard above the ground floor (generic names and bright colours, drawn into one picture atlas; no real brands)
   - on some, a striped canvas awning over the shopfront
   - on some tall walls, a big flex hoarding
   - air-conditioner boxes on the wall
   All of it is merged into a few meshes. */
import * as THREE from 'three';

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---- the signs ---- */
const SIGNS = [
  ['JEWELLERS', '#7a1020', '#f2c14e'], ['SILKS', '#1b5e3a', '#ffffff'], ['TEXTILES', '#c62828', '#ffffff'], ['ELECTRONICS', '#0d47a1', '#ffffff'],
  ['MOBILES', '#f9b000', '#1a1a1a'], ['SWEETS & SNACKS', '#ffffff', '#c62828'], ['BAKERY', '#fff3d6', '#8a3b12'], ['FASHION', '#111111', '#f2c14e'],
  ['FOOTWEAR', '#2e7d32', '#ffffff'], ['MEDICALS', '#ffffff', '#1b7f3b'], ['HOTEL', '#8e1b1b', '#ffffff'], ['RESTAURANT', '#e65100', '#ffffff'],
  ['OPTICALS', '#1565c0', '#ffffff'], ['GOLD HOUSE', '#4a0e1c', '#f2c14e'], ['FURNITURE', '#5d4037', '#ffffff'], ['BOOKS & STATIONERY', '#f9b000', '#12326b'],
  ['TAILORS', '#00695c', '#ffffff'], ['SUPER MARKET', '#d32f2f', '#ffffff'], ['BAGS & LUGGAGE', '#37474f', '#ffd54f'], ['COFFEE', '#3e2723', '#f5e6c8'],
  ['SAREES', '#ad1457', '#ffffff'], ['GIFTS & TOYS', '#6a1b9a', '#ffffff'], ['KIDS WEAR', '#00acc1', '#ffffff'], ['PHOTO STUDIO', '#212121', '#ffffff'],
];
const HOARDINGS = [
  ['GRAND SALE', 'UP TO 50% OFF', '#c62828', '#fff176'], ['NEW ARRIVALS', 'FESTIVE COLLECTION', '#1a237e', '#ffffff'], ['GRAND OPENING', 'THIS WEEK', '#e65100', '#ffffff'],
  ['DIWALI OFFER', 'BUY 1 GET 1', '#4a148c', '#ffd54f'], ['MEGA DISCOUNT', 'ALL FLOORS', '#004d40', '#ffffff'], ['WEDDING SPECIAL', 'SILKS & GOLD', '#880e4f', '#ffe082'],
  ['EASY EMI', 'ZERO INTEREST', '#0d47a1', '#ffffff'], ['FRESH & TASTY', 'OPEN 24 HOURS', '#2e7d32', '#fff9c4'],
];
const COLS = 4, SIGN_ROWS = 6, SIGN_W = 512, SIGN_H = 128, HOARD_ROWS = 2, HOARD_W = 512, HOARD_H = 256;
const ATLAS_W = COLS * SIGN_W, ATLAS_H = SIGN_ROWS * SIGN_H + HOARD_ROWS * HOARD_H;

function drawAtlas() {
  const c = document.createElement('canvas'); c.width = ATLAS_W; c.height = ATLAS_H; const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const fit = (text, maxW, size, weight = '800') => { let s = size; do { g.font = `${weight} ${s}px "Helvetica Neue", Arial, sans-serif`; s -= 2; } while (g.measureText(text).width > maxW && s > 14); };
  SIGNS.forEach(([text, bg, fg], i) => {
    const x = (i % COLS) * SIGN_W, y = Math.floor(i / COLS) * SIGN_H;
    g.fillStyle = bg; g.fillRect(x, y, SIGN_W, SIGN_H);
    g.strokeStyle = fg; g.globalAlpha = 0.8; g.lineWidth = 4; g.strokeRect(x + 8, y + 8, SIGN_W - 16, SIGN_H - 16); g.globalAlpha = 1;
    g.fillStyle = fg; fit(text, SIGN_W - 70, 76); g.fillText(text, x + SIGN_W / 2, y + SIGN_H / 2 + 3);
  });
  const y0 = SIGN_ROWS * SIGN_H;
  HOARDINGS.forEach(([a, b, bg, fg], i) => {
    const x = (i % COLS) * HOARD_W, y = y0 + Math.floor(i / COLS) * HOARD_H;
    const grad = g.createLinearGradient(x, y, x + HOARD_W, y + HOARD_H); grad.addColorStop(0, bg); grad.addColorStop(1, '#000000'); g.fillStyle = grad; g.fillRect(x, y, HOARD_W, HOARD_H);
    g.fillStyle = bg; g.globalAlpha = 0.85; g.fillRect(x, y, HOARD_W, HOARD_H); g.globalAlpha = 1;
    g.fillStyle = fg; fit(a, HOARD_W - 50, 84, '900'); g.fillText(a, x + HOARD_W / 2, y + HOARD_H * 0.42);
    g.globalAlpha = 0.9; fit(b, HOARD_W - 70, 40, '700'); g.fillText(b, x + HOARD_W / 2, y + HOARD_H * 0.74); g.globalAlpha = 1;
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const AWNING_PAIRS = [['#c62828', '#f4f1ea'], ['#1565c0', '#f4f1ea'], ['#2e7d32', '#f4f1ea'], ['#f9a825', '#f4f1ea'], ['#ef6c00', '#f4f1ea'], ['#6a1b9a', '#f4f1ea'], ['#00838f', '#f4f1ea']];

/**
 * @param data   the map data (buildings: [{ r: flat [x, z, ...], h }], roads: [{ p, w, k, b }])
 * @param high   full quality (adds the air conditioners)
 */
export function buildShopfronts(lots, roads, { high = true } = {}) {
  const rand = rng(90210);
  // road centre-line segments in a grid, so a wall can find the nearest street quickly
  const CELL = 32, grid = new Map(), key = (cx, cz) => cx + ',' + cz;
  for (const r of roads) {
    if (r.k === 'f' || r.b || r.w < 6) continue;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const seg = [r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], r.w / 2];
      const x0 = Math.min(seg[0], seg[2]) - 26, x1 = Math.max(seg[0], seg[2]) + 26, z0 = Math.min(seg[1], seg[3]) - 26, z1 = Math.max(seg[1], seg[3]) + 26;
      for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) (grid.get(key(cx, cz)) || grid.set(key(cx, cz), []).get(key(cx, cz))).push(seg);
    }
  }
  /** nearest street to a point: distance to the edge of its tarmac, and the unit direction towards it */
  const nearest = (x, z) => {
    const list = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))); if (!list) return null;
    let best = null;
    for (const [ax, az, bx, bz, hw] of list) {
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(px - x, pz - z);
      if (!best || d - hw < best.edge) best = { edge: d - hw, dx: (px - x) / (d || 1), dz: (pz - z) / (d || 1) };
    }
    return best;
  };

  const signs = { pos: [], uv: [], idx: [] }, awn = { pos: [], col: [], idx: [] }, acs = [], balconies = [];
  const quadUV = (out, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, uv) => {   // corners in order BL, BR, TR, TL
    const base = out.pos.length / 3; out.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz); out.uv.push(...uv); out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const cellUV = (kind, i) => {
    if (kind === 'sign') { const x = (i % COLS) * SIGN_W, y = Math.floor(i / COLS) * SIGN_H; return [x, y, SIGN_W, SIGN_H]; }
    const x = (i % COLS) * HOARD_W, y = SIGN_ROWS * SIGN_H + Math.floor(i / COLS) * HOARD_H; return [x, y, HOARD_W, HOARD_H];
  };
  const uvFor = ([x, y, w, h]) => { const u0 = x / ATLAS_W, u1 = (x + w) / ATLAS_W, vT = 1 - y / ATLAS_H, vB = 1 - (y + h) / ATLAS_H, e = 0.004; return [u0 + e, vB + e, u1 - e, vB + e, u1 - e, vT - e, u0 + e, vT - e]; };

  let frontage = 0;
  for (const b of lots) {
    const p = b.r, n = p.length / 2; if (n < 3 || b.h < 6) continue;
    let area = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1]; }
    const sgn = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ex = p[j * 2] - p[i * 2], ez = p[j * 2 + 1] - p[i * 2 + 1], len = Math.hypot(ex, ez); if (len < 4.5) continue;
      const mx = (p[i * 2] + p[j * 2]) / 2, mz = (p[i * 2 + 1] + p[j * 2 + 1]) / 2;
      const ox = ez / len * sgn, oz = -ex / len * sgn;   // outward normal (the inward one is (-ez, ex) * sgn)
      const hit = nearest(mx + ox * 0.6, mz + oz * 0.6);
      if (!hit || hit.edge < 0.6 || hit.edge > 8 || hit.dx * ox + hit.dz * oz < 0.78) continue;
      frontage++;
      const rx = oz, rz = -ox;   // along the wall, such that (right x up) points outward
      // signboard (the photographed facades have their own shopfronts, so only some of them get a board)
      const photoSkip = b.fac && (!b.fac.sign || rand() < 0.2);   // a photographed facade only gets a board where its picture has a blank fascia, and a name that suits the shop
      const fs = b.fac && b.fac.sign, sw = Math.min(len * 0.84, fs ? 6.5 : 8.5), shift = (rand() - 0.5) * Math.max(0, len - sw - 0.6), sh = fs ? fs.h : 1.0 + rand() * 0.35, y0 = fs ? fs.y : 2.95 + rand() * 0.25;
      const cx = mx + rx * shift + ox * 0.1, cz = mz + rz * shift + oz * 0.1, k = fs ? SIGNS.findIndex((x) => x[0] === fs.names[Math.floor(rand() * fs.names.length)]) : Math.floor(rand() * SIGNS.length);
      if (!photoSkip) quadUV(signs, cx - rx * sw / 2, y0, cz - rz * sw / 2, cx + rx * sw / 2, y0, cz + rz * sw / 2, cx + rx * sw / 2, y0 + sh, cz + rz * sw / 2, cx - rx * sw / 2, y0 + sh, cz - rz * sw / 2, uvFor(cellUV('sign', k)));
      // awning over the shopfront
      if (!b.fac && len > 5.5 && rand() < 0.5) {
        const aw = len * (0.7 + rand() * 0.2), depth = 1.2 + rand() * 0.5, [ca, cb] = AWNING_PAIRS[Math.floor(rand() * AWNING_PAIRS.length)], stripes = Math.max(4, Math.round(aw / 0.55)), sx = aw / stripes;
        const cA = new THREE.Color(ca), cB = new THREE.Color(cb);
        for (let s = 0; s < stripes; s++) {
          const t0 = -aw / 2 + s * sx, t1 = t0 + sx, c = s % 2 ? cB : cA, base = awn.pos.length / 3;
          const wx0 = mx + rx * t0 + ox * 0.12, wz0 = mz + rz * t0 + oz * 0.12, wx1 = mx + rx * t1 + ox * 0.12, wz1 = mz + rz * t1 + oz * 0.12;
          awn.pos.push(wx0, 2.85, wz0, wx1, 2.85, wz1, wx1 + ox * depth, 2.4, wz1 + oz * depth, wx0 + ox * depth, 2.4, wz0 + oz * depth);
          for (let q = 0; q < 4; q++) awn.col.push(c.r, c.g, c.b);
          awn.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
      // hoarding on tall walls
      if (len > 7 && b.h > 14 && rand() < 0.22) {
        const hw = Math.min(len * 0.7, 6), hh = hw / 2, hy = Math.max(6.5, b.h * (0.45 + rand() * 0.15)), hs = (rand() - 0.5) * Math.max(0, len - hw - 1), hcx = mx + rx * hs + ox * 0.22, hcz = mz + rz * hs + oz * 0.22;
        quadUV(signs, hcx - rx * hw / 2, hy, hcz - rz * hw / 2, hcx + rx * hw / 2, hy, hcz + rz * hw / 2, hcx + rx * hw / 2, hy + hh, hcz + rz * hw / 2, hcx - rx * hw / 2, hy + hh, hcz - rz * hw / 2, uvFor(cellUV('hoard', Math.floor(rand() * HOARDINGS.length))));
      }
      // balconies: concrete slabs with glass railings, stacked in columns, on the residential and brick buildings
      if (high && !b.fac && (b.style === 0 || b.style === 3) && b.h > 10 && len > 5.5 && rand() < 0.6) {
        const floors = Math.max(1, Math.floor(b.h / 3.2) - 1), cols = 1 + Math.floor(rand() * 2);
        for (let c = 0; c < cols; c++) {
          const along = (rand() - 0.5) * (len - 3.4), x0 = mx + rx * along, z0 = mz + rz * along, ry = Math.atan2(ox, oz);
          for (let f = 1; f <= floors; f++) if (rand() < 0.75) balconies.push([x0 + ox * 0.55, 3.2 * f + 0.05, z0 + oz * 0.55, ry]);
        }
      }
      // air conditioners
      if (high && !b.fac && b.h > 9) {
        const count = 1 + Math.floor(rand() * 3), floors = Math.max(1, Math.floor(b.h / 3.2) - 1);
        for (let a = 0; a < count; a++) acs.push([mx + rx * (rand() - 0.5) * (len - 1.6) + ox * 0.22, 3.2 * (1 + Math.floor(rand() * floors)) + 1.0 + rand() * 0.4, mz + rz * (rand() - 0.5) * (len - 1.6) + oz * 0.22, Math.atan2(ox, oz), rand()]);
      }
    }
  }

  const group = new THREE.Group();
  if (signs.pos.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(signs.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(signs.uv, 2)); g.setIndex(signs.idx); g.computeVertexNormals();
    const map = drawAtlas();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, roughness: 0.65, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.16, side: THREE.DoubleSide }));
    mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);
  }
  if (awn.pos.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(awn.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(awn.col, 3)); g.setIndex(awn.idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);
  }
  if (acs.length) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.85, 0.55, 0.4), new THREE.MeshStandardMaterial({ roughness: 0.6 }), acs.length);
    const d = new THREE.Object3D(), c = new THREE.Color();
    acs.forEach(([x, y, z, ry, t], i) => { d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); mesh.setColorAt(i, c.set(t < 0.6 ? '#e8e8e6' : t < 0.85 ? '#c9cbcc' : '#9a9d9f')); });
    mesh.frustumCulled = false; group.add(mesh);
  }
  if (balconies.length) {
    const slab = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.14, 1.1), new THREE.MeshStandardMaterial({ color: 0xe4e2dc, roughness: 0.85 }), balconies.length);
    const rail = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.95, 0.05), new THREE.MeshStandardMaterial({ color: 0x9fb8c6, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.55 }), balconies.length);
    const d = new THREE.Object3D();
    balconies.forEach(([x, y, z, ry], i) => {
      d.rotation.set(0, ry, 0); d.position.set(x, y, z); d.updateMatrix(); slab.setMatrixAt(i, d.matrix);
      d.position.set(x + Math.sin(ry) * 0.52, y + 0.55, z + Math.cos(ry) * 0.52); d.updateMatrix(); rail.setMatrixAt(i, d.matrix);
    });
    slab.castShadow = true; slab.receiveShadow = true; slab.frustumCulled = false; rail.frustumCulled = false; group.add(slab, rail);
  }
  return { group, frontage, balconies: balconies.length, signs: signs.pos.length / 12, awnings: awn.pos.length / 12, acs: acs.length };
}
