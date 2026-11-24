/* Moving traffic for the streets scene.
   The roads of the map are turned into a small road network (junction points, a lane each way). Vehicles drive on it:
   - on the LEFT, as in India, each in its own lane
   - they keep a safe distance to the vehicle in front and queue up behind slower ones (the Intelligent Driver Model)
   - at every junction they pick a way on (straight on more often than a sharp turn, main roads more often than side streets),
     slow down for turns and swing round them
   - vehicles that reach the edge of the map leave and come back in somewhere else; real dead ends turn them round
   Cars, autos, buses and two-wheelers are two boxes each (body and cabin or rider), drawn as two instanced meshes.
   Call `update(seconds)` every frame. Nothing here touches the DOM. */
import * as THREE from 'three';
import { buildVehicleGeometries } from './vehicles.js';

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const wrapPi = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

/* what is on the road: len/wid are the vehicle's footprint for the car-following maths (shapes are in vehicles.js);
   body = paint colours, cabin = the rider's shirt colours on motorbikes */
const KINDS = [
  { len: 4.6, wid: 1.95, body: ['#f2f2ee', '#c9ccd0', '#8b1e2a', '#2a4f8a', '#303438', '#e8e3d6', '#5a6f7c', '#a8323a', '#3f6b4f'], cabin: null, share: 0.40, speed: 8.5, spread: 2.2 },      // cars
  { len: 3.1, wid: 1.55, body: ['#f2c200', '#e8b800', '#2d7a3e'], cabin: null, share: 0.20, speed: 6.8, spread: 1.4 },                                                                       // auto rickshaws
  { len: 11.2, wid: 2.7, body: ['#b3222c', '#e8e8e4', '#1f5a9c', '#c9a227'], cabin: null, share: 0.06, speed: 6.5, spread: 1.0 },                                                            // buses
  { len: 2.1, wid: 0.75, body: ['#222', '#4a4a4a', '#9b1c1c', '#2a5db0'], cabin: ['#d33', '#2a7', '#e6c200', '#ddd', '#2a5db0', '#e87722'], share: 0.34, speed: 8, spread: 2.2 },          // two-wheelers
];
const HERO_LEN = 5.2;
const ACC = 2.2, BRAKE = 3.0, HEADWAY = 1.1, MIN_GAP = 2.4;   // car-following (IDM) parameters

/** the road network: junction points (nodes), road pieces between them (edges) and one lane per direction of each piece */
function buildNetwork(roads, bounds) {
  const pieces = [];
  for (const r of roads) {
    if (r.k === 'f' || r.w < 6) continue;   // footpaths and narrow service lanes carry no traffic
    const pts = []; for (let i = 0; i + 1 < r.p.length; i += 2) pts.push([r.p[i], r.p[i + 1]]);
    if (pts.length >= 2) pieces.push({ pts, w: r.w, cls: r.n ? 3 : (r.k === 'm' ? 2 : 1), lift: r.b ? 0.5 : 0, bridge: !!r.b });
  }
  // a loose end that stops beside another road (the data drops junction points on straight roads) is joined to it
  for (const A of pieces) {
    for (const endIdx of [0, A.pts.length - 1]) {
      const E = A.pts[endIdx]; let best = null, bd = 3.5;
      for (const B of pieces) {
        if (B === A || B.bridge !== A.bridge) continue;
        for (let k = 0; k + 1 < B.pts.length; k++) {
          const [x1, z1] = B.pts[k], [x2, z2] = B.pts[k + 1], dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz; if (L2 < 1e-6) continue;
          const t = Math.max(0, Math.min(1, ((E[0] - x1) * dx + (E[1] - z1) * dz) / L2)), px = x1 + dx * t, pz = z1 + dz * t, d = Math.hypot(E[0] - px, E[1] - pz);
          if (d < bd) { bd = d; best = { B, k, t, px, pz, L: Math.sqrt(L2) }; }
        }
      }
      if (!best) continue;
      const { B, k, t, px, pz, L } = best;
      if (t * L < 1.2) { E[0] = B.pts[k][0]; E[1] = B.pts[k][1]; }
      else if ((1 - t) * L < 1.2) { E[0] = B.pts[k + 1][0]; E[1] = B.pts[k + 1][1]; }
      else { B.pts.splice(k + 1, 0, [px, pz]); E[0] = px; E[1] = pz; }
    }
  }
  const nodes = [], cells = new Map();
  const nodeAt = (x, z) => {
    const cx = Math.round(x / 2), cz = Math.round(z / 2);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const list = cells.get((cx + i) + ',' + (cz + j)); if (list) for (const n of list) if (Math.hypot(n.x - x, n.z - z) < 1.2) return n; }
    const n = { x, z, out: [], deg: 0, portal: false }; nodes.push(n); const key = cx + ',' + cz; (cells.get(key) || cells.set(key, []).get(key)).push(n); return n;
  };
  const lanes = [];   // lane = one direction of one road piece; lane ^ 1 is the way back
  for (const P of pieces) {
    for (let k = 0; k + 1 < P.pts.length; k++) {
      const a = nodeAt(P.pts[k][0], P.pts[k][1]), b = nodeAt(P.pts[k + 1][0], P.pts[k + 1][1]); if (a === b) continue;
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz); if (len < 0.5) continue;
      const ux = dx / len, uz = dz / len, base = { len, w: P.w, cls: P.cls, lift: P.lift };
      const fwd = { ...base, from: a, to: b, ax: a.x, az: a.z, ux, uz, heading: Math.atan2(uz, ux), id: lanes.length };
      const back = { ...base, from: b, to: a, ax: b.x, az: b.z, ux: -ux, uz: -uz, heading: Math.atan2(-uz, -ux), id: lanes.length + 1 };
      lanes.push(fwd, back); a.out.push(fwd); b.out.push(back); a.deg++; b.deg++;
    }
  }
  const [x0, z0, x1, z1] = bounds;
  for (const n of nodes) n.portal = n.deg === 1 && (n.x < x0 + 4 || n.x > x1 - 4 || n.z < z0 + 4 || n.z > z1 - 4);
  return { lanes, nodes, portals: nodes.filter((n) => n.portal) };
}

export function createTraffic({ roads, bounds, density = 1, seed = 20261010 }) {
  const rand = rng(seed);
  const net = buildNetwork(roads, bounds);
  const lanes = net.lanes;
  const group = new THREE.Group();
  /** a way along the busy street for a vehicle that is steered from outside (our truck): starts at the point on the lane nearest to (px, pz)
      that runs roughly along (dx, dz), then carries straight on through junctions for about `length` metres.
      sample(d, out) gives the centre-line point, heading and road width `d` metres along. */
  function route(px, pz, dx, dz, length) {
    let best = null, bd = 1e9;
    for (const ln of lanes) {
      if (ln.cls !== 3 || ln.ux * dx + ln.uz * dz < 0.6) continue;
      const t = Math.max(0, Math.min(ln.len, (px - ln.ax) * ln.ux + (pz - ln.az) * ln.uz)), d = Math.hypot(px - (ln.ax + ln.ux * t), pz - (ln.az + ln.uz * t));
      if (d < bd) { bd = d; best = { ln, t }; }
    }
    if (!best) return null;
    const segs = []; let lane = best.ln, cum = -best.t;
    while (cum < length && segs.length < 60) {
      segs.push({ lane, start: cum }); cum += lane.len;
      let next = null, bc = 0.3;
      for (const o of lane.to.out) { if (o.id === (lane.id ^ 1)) continue; const c = o.ux * lane.ux + o.uz * lane.uz + (o.cls === 3 ? 0.3 : 0); if (c > bc) { bc = c; next = o; } }
      if (!next) break; lane = next;
    }
    return {
      total: cum,
      sample(d, out) {
        let i = segs.length - 1; for (let k = 0; k < segs.length; k++) if (d < segs[k].start + segs[k].lane.len) { i = k; break; }
        const sg = segs[i], s = Math.max(0, Math.min(sg.lane.len, d - sg.start));
        out.x = sg.lane.ax + sg.lane.ux * s; out.z = sg.lane.az + sg.lane.uz * s; out.heading = sg.lane.heading; out.w = sg.lane.w; out.lane = sg.lane.id; out.s = s; return out;
      },
    };
  }
  if (!lanes.length) return { group, update() {}, count: 0, route: () => null, network: net, dispose() {} };

  /* ---- vehicles: where they start ---- */
  const pickKind = () => { let t = rand(), k = 0; for (; k < KINDS.length - 1; k++) { if (t < KINDS[k].share) break; t -= KINDS[k].share; } return k; };
  const SPACING = { 3: 24, 2: 36, 1: 85 };   // metres between vehicles in one lane, by kind of road (the three busy streets, main roads, side streets)
  const starts = [];
  for (const lane of lanes) {
    const gap = SPACING[lane.cls] / density;
    for (let s = rand() * gap; s < lane.len - 3; s += gap * (0.75 + rand() * 0.6)) starts.push([lane.id, s]);
  }
  const N = starts.length;
  const L = new Int32Array(N), NEXT = new Int32Array(N), KIND = new Int8Array(N);
  const S = new Float32Array(N), V = new Float32Array(N), V0 = new Float32Array(N), PHI = new Float32Array(N), LAT = new Float32Array(N), Y = new Float32Array(N), TURN = new Float32Array(N);
  const LEN = new Float32Array(N), KEY = new Float64Array(N);

  const turnLimit = (from, to) => { const d = Math.abs(wrapPi(to.heading - from.heading)); return d > 2.5 ? 2.5 : d > 0.45 ? 4.5 : 99; };
  const pickNext = (lane) => {   // which lane to take at the end of this one (-2: leave the map)
    const outs = net.lanes.length ? lane.to.out : [];
    let total = 0; const w = [];
    for (const o of outs) {
      if (o.id === (lane.id ^ 1)) { w.push(0); continue; }   // no turning back on the spot
      const straight = Math.max(0, Math.cos(wrapPi(o.heading - lane.heading)));
      const x = (o.cls === 3 ? 3 : o.cls === 2 ? 2 : 1) * (0.3 + 0.7 * straight); w.push(x); total += x;
    }
    if (total <= 0) return lane.to.portal ? -2 : (lane.id ^ 1);
    let t = rand() * total; for (let i = 0; i < outs.length; i++) { t -= w[i]; if (t <= 0) return outs[i].id; }
    return outs[outs.length - 1].id;
  };
  const targetLat = (lane) => Math.min(3.6, Math.max(1.2, lane.w * 0.24));
  let hero = null;   // a vehicle steered from outside (our truck), as { lane, s, v }: the others keep their distance to it
  const place = (i, laneId, s) => {
    const lane = lanes[laneId]; L[i] = laneId; S[i] = s; PHI[i] = lane.heading; LAT[i] = targetLat(lane); Y[i] = lane.lift;
    NEXT[i] = pickNext(lane); TURN[i] = NEXT[i] >= 0 ? turnLimit(lane, lanes[NEXT[i]]) : 99;
  };
  /* ---- how they look: per kind of vehicle, an instanced mesh for each part (paint, accent, dark glass, tyres) ---- */
  const colours = new THREE.Color();
  const geo = buildVehicleGeometries(), counts = [0, 0, 0, 0], LOCAL = new Int32Array(N), paintCol = new Array(N), accentCol = new Array(N);
  for (let i = 0; i < N; i++) {
    const k = pickKind(), kd = KINDS[k]; KIND[i] = k; LEN[i] = kd.len; LOCAL[i] = counts[k]++;
    V0[i] = Math.max(3, kd.speed + (rand() - 0.5) * 2 * kd.spread); V[i] = V0[i] * (0.5 + rand() * 0.4);
    place(i, starts[i][0], starts[i][1]);
    paintCol[i] = kd.body[Math.floor(rand() * kd.body.length)]; accentCol[i] = kd.cabin ? kd.cabin[Math.floor(rand() * kd.cabin.length)] : null;
  }
  const mats = {
    paint: new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.3 }),
    accent: new THREE.MeshStandardMaterial({ roughness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.22, metalness: 0.25 }),
    wheels: new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.92 }),
  };
  const fleet = geo.map((parts, k) => {
    const out = {};
    for (const name of ['paint', 'accent', 'dark', 'wheels']) {
      if (!parts[name]) continue;
      const m = new THREE.InstancedMesh(parts[name], mats[name], Math.max(1, counts[k]));
      m.castShadow = name !== 'wheels'; m.receiveShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(m); out[name] = m;
    }
    return out;
  });
  for (let i = 0; i < N; i++) {
    const f = fleet[KIND[i]]; f.paint.setColorAt(LOCAL[i], colours.set(paintCol[i])); if (f.accent) f.accent.setColorAt(LOCAL[i], colours.set(accentCol[i]));
  }
  const flagUpdates = () => { for (const f of fleet) for (const name in f) f[name].instanceMatrix.needsUpdate = true; };

  const write = (i) => {   // turn the vehicle to its heading and put it in its place (the same matrix for every part)
    const lane = lanes[L[i]], phi = PHI[i], cs = Math.cos(phi), sn = Math.sin(phi), f = fleet[KIND[i]], j = LOCAL[i] * 16;
    const cx = lane.ax + lane.ux * S[i], cz = lane.az + lane.uz * S[i];
    const px = cx + sn * LAT[i], pz = cz - cs * LAT[i], py = Y[i] + 0.07;   // to the left of the way it is facing (x east, z south)
    const a = f.paint.instanceMatrix.array;
    a[j] = cs; a[j + 1] = 0; a[j + 2] = sn; a[j + 3] = 0; a[j + 4] = 0; a[j + 5] = 1; a[j + 6] = 0; a[j + 7] = 0; a[j + 8] = -sn; a[j + 9] = 0; a[j + 10] = cs; a[j + 11] = 0; a[j + 12] = px; a[j + 13] = py; a[j + 14] = pz; a[j + 15] = 1;
    for (const name in f) if (name !== 'paint') { const b = f[name].instanceMatrix.array; for (let q = 0; q < 16; q++) b[j + q] = a[j + q]; }
  };
  for (let i = 0; i < N; i++) write(i);
  flagUpdates();

  /* ---- each frame ---- */
  const order = Array.from({ length: N }, (_, i) => i);
  const first = new Int32Array(lanes.length);
  const portalLane = () => { const n = net.portals[Math.floor(rand() * net.portals.length)]; return n ? n.out[Math.floor(rand() * n.out.length)] : null; };

  function step(dt) {
    for (let i = 0; i < N; i++) KEY[i] = L[i] * 1e5 + S[i];
    order.sort((a, b) => KEY[a] - KEY[b]);
    first.fill(-1);
    for (let k = 0; k < N; k++) { const i = order[k]; if (k === 0 || L[order[k - 1]] !== L[i]) first[L[i]] = i; }
    for (let k = 0; k < N; k++) {
      const i = order[k], lane = lanes[L[i]], v = V[i];
      // the vehicle in front: next in this lane, else the last one in the lane we are about to enter
      let lead = -1, gap = 1e9, leadV = 0, leadLen = 0;
      if (k + 1 < N && L[order[k + 1]] === L[i]) { lead = order[k + 1]; gap = S[lead] - S[i]; }
      else if (NEXT[i] >= 0 && first[NEXT[i]] >= 0 && first[NEXT[i]] !== i) { lead = first[NEXT[i]]; gap = lane.len - S[i] + S[lead]; }
      if (lead >= 0) { leadV = V[lead]; leadLen = LEN[lead]; }
      if (hero && hero.blocks) {   // our truck counts as a vehicle in front when it is ahead in this lane (or the next one)
        const hg = L[i] === hero.lane && hero.s > S[i] ? hero.s - S[i] : (NEXT[i] === hero.lane ? lane.len - S[i] + hero.s : 1e9);
        if (hg < gap) { lead = -2; gap = hg; leadV = hero.v; leadLen = HERO_LEN; }
      }
      let acc;
      let v0 = V0[i] * (lane.cls === 1 ? 0.72 : 1);
      const toEnd = lane.len - S[i];
      if (TURN[i] < v0 && toEnd < 20) v0 = TURN[i] + (v0 - TURN[i]) * (toEnd / 20);   // ease off before a turn
      v0 = Math.max(v0, 1.5);
      if (lead !== -1) {
        const net_ = Math.max(0.3, gap - (LEN[i] + leadLen) / 2), dv = v - leadV;
        const sStar = MIN_GAP + Math.max(0, v * HEADWAY + (v * dv) / (2 * Math.sqrt(ACC * BRAKE)));
        acc = ACC * (1 - Math.pow(v / v0, 4) - (sStar / net_) * (sStar / net_));
      } else acc = ACC * (1 - Math.pow(v / v0, 4));
      V[i] = Math.max(0, v + Math.max(-9, acc) * dt);
      S[i] += V[i] * dt;
      // end of this lane: carry on into the next one
      if (S[i] >= lane.len) {
        const over = S[i] - lane.len;
        if (NEXT[i] === -2) { const pl = portalLane(); if (pl) { place(i, pl.id, 0); continue; } else { place(i, L[i] ^ 1, 0); continue; } }
        const nl = NEXT[i]; L[i] = nl; S[i] = over; const ln = lanes[nl];
        NEXT[i] = pickNext(ln); TURN[i] = NEXT[i] >= 0 ? turnLimit(ln, lanes[NEXT[i]]) : 99;
      }
      // swing round corners, settle into the lane, follow bridges up and down
      const cur = lanes[L[i]], turnRate = V[i] / 6 + 0.5, d = wrapPi(cur.heading - PHI[i]);
      PHI[i] += Math.max(-turnRate * dt, Math.min(turnRate * dt, d));
      // swing out round our truck when passing it (it is steered by the scroll, so it may overtake or be overtaken at any speed)
      let near = false;
      if (hero && Math.cos(PHI[i] - hero.heading) > 0.8) { const wx = cur.ax + cur.ux * S[i] - hero.x, wz = cur.az + cur.uz * S[i] - hero.z; near = wx * wx + wz * wz < 144; }
      LAT[i] += (targetLat(cur) - (near ? 3.0 : 0) - LAT[i]) * Math.min(1, dt * (near ? 10 : 2));
      Y[i] += (cur.lift - Y[i]) * Math.min(1, dt * 4);
    }
    for (let i = 0; i < N; i++) write(i);
  }

  return {
    group, count: N, route, network: net,
    /** distance from a point to the nearest vehicle's centre (for checks) */
    nearest(x, z) { let best = 1e9; for (let i = 0; i < N; i++) { const lane = lanes[L[i]], cx = lane.ax + lane.ux * S[i] + Math.sin(PHI[i]) * LAT[i], cz = lane.az + lane.uz * S[i] - Math.cos(PHI[i]) * LAT[i], d = Math.hypot(cx - x, cz - z); if (d < best) best = d; } return best; },
    update(seconds, steered = null) {
      hero = steered;
      let t = Math.min(seconds, 0.25);
      while (t > 1e-4) { const dt = Math.min(t, 0.05); step(dt); t -= dt; }
      flagUpdates();
    },
    dispose() { for (const f of fleet) for (const name in f) f[name].geometry.dispose(); for (const name in mats) mats[name].dispose(); },
  };
}
