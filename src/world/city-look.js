/* How the streets scene's city looks: modern, real-world colours, lighting and surface detail.
   Pure helpers, used by streets.js, roads.js and shopfronts.js:
   - four building styles, chosen by size and height: 0 painted residential / commercial with punched windows, 1 glass curtain wall,
     2 white and coloured cladding with ribbon windows, 3 brick or stone with large windows; fresh paint, clean concrete roofs
   - the wall shader: shop bays with lit interiors, window openings with frames and real depth (a bump made from the window
     height field, so the sun catches the reveals), floor slabs, pilasters, glass that reflects the sky
   - roads: asphalt with tonal drift, aggregate, repair patches, wheel tracks and sand along the kerb; paving slabs
     (every fine pattern fades out with its on-screen size, so nothing shimmers)
   - roof parapets, soft contact shadows around every building, and a sky-based environment light */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/* ---- colours ---- */
const pickWeighted = (list, t) => { let total = 0; for (const [, w] of list) total += w; t *= total; for (const [c, w] of list) { t -= w; if (t <= 0) return c; } return list[list.length - 1][0]; };

/* wall colours by style (fresh paint and cladding, glass tints), and roofs (cool-roof whites, light concrete, a little terracotta, blue sheet, green terrace) */
const PALETTES = [
  [['#f2efe8', 14], ['#eadfc6', 9], ['#cfd1d0', 8], ['#f0dc9a', 5], ['#f2c4a2', 5], ['#eeb3b8', 4], ['#b9d3ea', 5], ['#bfe0cc', 4], ['#d98a62', 3], ['#a9acae', 5], ['#c9bddf', 2], ['#7fc4c0', 3], ['#e9d3a3', 4]],   // 0 painted
  [['#5d8fb5', 12], ['#4f9aa0', 8], ['#5f9a86', 5], ['#7f93a3', 8], ['#9a8466', 3], ['#3d5668', 6]],                                                                                                        // 1 glass tints
  [['#f4f4f1', 14], ['#d9dcdc', 10], ['#cfc8bd', 6], ['#e6e0d2', 6]],                                                                                                                                         // 2 cladding
  [['#b4553f', 10], ['#d5b283', 8], ['#d8c8a8', 6], ['#8a4535', 4], ['#c9a27a', 4]],                                                                                                                         // 3 brick and stone
];
const ROOFS = [['#a39e95', 20], ['#b3aea4', 16], ['#8d8981', 10], ['#c9c4ba', 9], ['#bfb39e', 7], ['#a9573c', 7], ['#b8694a', 3], ['#4f6c8c', 3], ['#6f8c6a', 3], ['#7c7973', 8], ['#d3cfc5', 5]];

const hash01 = (n) => { let h = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
/** the building style (0 painted, 1 glass curtain wall, 2 cladding, 3 brick or stone) for building number `index`, its footprint area and height */
export function styleOf(index, area, h) {
  const t = hash01(index * 2654435761);
  if (h > 20 && area > 180) return t < 0.5 ? 1 : (t < 0.8 ? 2 : 0);
  if (h > 11) return t < 0.14 ? 1 : t < 0.38 ? 2 : t < 0.56 ? 3 : 0;
  return t < 0.18 ? 3 : t < 0.28 ? 2 : 0;
}

/** colours for one building of the given style: [roof, wall], from a random generator */
export function pickColours(rand, style = 0) {
  const wall = new THREE.Color(pickWeighted(PALETTES[style], rand())), roof = new THREE.Color(pickWeighted(ROOFS, rand()));
  const hsl = {};
  for (const c of [wall, roof]) {
    c.getHSL(hsl);
    c.setHSL(hsl.h + (rand() - 0.5) * 0.015, hsl.s * (0.92 + rand() * 0.16), Math.min(0.96, hsl.l * (0.95 + rand() * 0.1)));
  }
  return [roof, wall];
}

/* ---- geometry helpers ---- */
/** a polygon (flat [x, z, x, z, ...]) moved sideways by d (positive: inwards, negative: outwards), corners mitred */
export function offsetRing(ring, d) {
  const n = ring.length / 2; if (n < 3) return null;
  let area = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += ring[i * 2] * ring[j * 2 + 1] - ring[j * 2] * ring[i * 2 + 1]; }
  const sgn = area > 0 ? 1 : -1;   // which side is inside
  const out = new Array(ring.length);
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n;
    let e1x = ring[i * 2] - ring[a * 2], e1z = ring[i * 2 + 1] - ring[a * 2 + 1], l1 = Math.hypot(e1x, e1z) || 1; e1x /= l1; e1z /= l1;
    let e2x = ring[b * 2] - ring[i * 2], e2z = ring[b * 2 + 1] - ring[i * 2 + 1], l2 = Math.hypot(e2x, e2z) || 1; e2x /= l2; e2z /= l2;
    const n1x = -e1z * sgn, n1z = e1x * sgn, n2x = -e2z * sgn, n2z = e2x * sgn;   // inward normals
    const k = 1 / Math.max(0.35, 1 + n1x * n2x + n1z * n2z);
    let mx = (n1x + n2x) * k * d, mz = (n1z + n2z) * k * d; const len = Math.hypot(mx, mz), cap = Math.abs(d) * 2.2; if (len > cap) { mx *= cap / len; mz *= cap / len; }
    out[i * 2] = ring[i * 2] + mx; out[i * 2 + 1] = ring[i * 2 + 1] + mz;
  }
  return out;
}

/** a copy of an extruded (non-indexed) geometry without the faces that look straight down: nobody sees them */
export function dropDownFaces(g) {
  const pos = g.attributes.position.array, nor = g.attributes.normal.array, p = [], q = [];
  for (let t = 0; t < pos.length / 9; t++) { if (nor[t * 9 + 1] < -0.5) continue; for (let k = 0; k < 9; k++) { p.push(pos[t * 9 + k]); q.push(nor[t * 9 + k]); } }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(q, 3)); return out;
}

/** paint a building's geometry: roofs one colour, walls another, walls a little darker towards the ground (soft ambient occlusion).
    Also tags every vertex with aB = (a random number for this building, its height, its style) for the wall shader. */
export function paintBuilding(g, roof, wall, height, hb = 0, style = 0) {
  const pos = g.attributes.position, nor = g.attributes.normal, colors = new Float32Array(pos.count * 3), tag = new Float32Array(pos.count * 3), c = new THREE.Color();
  const span = Math.max(3, Math.min(height * 0.6, 8));
  for (let v = 0; v < pos.count; v++) {
    if (nor.getY(v) > 0.5) c.copy(roof);
    else { const y = pos.getY(v), t = y >= height - 0.01 ? 1 : Math.min(1, Math.max(0, y / span)), s = t * t * (3 - 2 * t); c.copy(wall).multiplyScalar(0.8 + 0.2 * s); }
    colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b; tag[v * 3] = hb; tag[v * 3 + 1] = height; tag[v * 3 + 2] = style;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('aB', new THREE.BufferAttribute(tag, 3));
  // for every wall triangle: how far along its wall each corner is (metres) and how long the wall is, so a picture can be laid on the wall from its start
  const along = new Float32Array(pos.count * 2);
  for (let t = 0; t + 2 < pos.count; t += 3) {
    if (Math.abs(nor.getY(t)) > 0.5) continue;
    const tx = -nor.getZ(t), tz = nor.getX(t), tl = Math.hypot(tx, tz) || 1, ts = [0, 1, 2].map((q) => (pos.getX(t + q) * tx + pos.getZ(t + q) * tz) / tl);
    const lo = Math.min(...ts), hi = Math.max(...ts);
    for (let q = 0; q < 3; q++) { along[(t + q) * 2] = ts[q] - lo; along[(t + q) * 2 + 1] = hi - lo; }
  }
  g.setAttribute('aW', new THREE.BufferAttribute(along, 2));
}

/** soft dark skirt on the ground around a building: strips that fade out away from the wall (colour has alpha) */
export function contactShadow(ring, out, { reach = 3.4, strength = 0.42, steps = 3 } = {}) {
  const rings = [ring]; for (let s = 1; s <= steps; s++) rings.push(offsetRing(ring, -reach * (s / steps)));
  if (rings.some((r) => !r)) return;
  const n = ring.length / 2, base = out.pos.length / 3;
  for (let s = 0; s <= steps; s++) {
    const a = strength * Math.pow(1 - s / (steps + 0.4), 1.6);
    for (let i = 0; i < n; i++) { out.pos.push(rings[s][i * 2], 0.09, rings[s][i * 2 + 1]); out.col.push(0.05, 0.055, 0.07, a); }
  }
  for (let s = 0; s < steps; s++) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = base + s * n + i, b = base + s * n + j, c = base + (s + 1) * n + j, d = base + (s + 1) * n + i;
    out.idx.push(a, b, c, a, c, d);
  }
}

/* ---- surface look (shader additions on a standard material) ---- */
const NOISE = /* glsl */`
float lkHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float lkNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(lkHash(i), lkHash(i + vec2(1.0, 0.0)), f.x), mix(lkHash(i + vec2(0.0, 1.0)), lkHash(i + vec2(1.0, 1.0)), f.x), f.y); }
// how big one pixel is on the ground (metres), and how much of a pattern of this many cycles per metre can still be seen
float lkFw(){ return length(fwidth(vLkP.xz)); }
float lkLod(float freq, float fw){ return 1.0 - smoothstep(0.22, 0.5, fw * freq); }
// soft edges, as wide as a pixel: x in cell units, w the pixel size in the same units
float lkS(float x, float e, float w){ return smoothstep(e - w, e + w, x); }
float lkBand(float x, float a, float b, float w){ return lkS(x, a, w) * (1.0 - lkS(x, b, w)); }
// tilt the shading normal by a height field's screen-space slope (what a bump map does), so recesses and slabs catch the light
vec3 lkPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDirection){
  vec3 sx = normalize(dFdx(surfPos)), sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm), r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDirection;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;

const FACADE = /* glsl */`
  vec3 lkN = normalize(vLkN);
  if (lkN.y > 0.5) {
    // roofs: clean light concrete, terrace tiles, slab joints
    vec2 q = vLkP.xz;
    float ra = lkNoise(q * 0.12), rb = lkNoise(q * 0.9 + 3.1);
    diffuseColor.rgb *= 0.95 + 0.07 * ra + 0.04 * rb * lkLod(0.9, lkFwv);
    vec2 g1 = abs(fract(q / 1.2) - 0.5);
    diffuseColor.rgb *= 1.0 - 0.07 * smoothstep(0.47, 0.5, max(g1.x, g1.y)) * lkLod(0.85, lkFwv);
    vec2 g2 = abs(fract(q / 6.0) - 0.5);
    diffuseColor.rgb *= 1.0 - 0.06 * smoothstep(0.485, 0.5, max(g2.x, g2.y)) * lkLod(0.17, lkFwv);
  } else if (abs(lkN.y) < 0.5) {
    vec2 tdir = normalize(vec2(-lkN.z, lkN.x));
    float u = dot(vLkP.xz, tdir), v = vLkP.y, fu = max(fwidth(u), 1e-4), fv = max(fwidth(v), 1e-4);
    float hb = vB.x, H = vB.y, st = vB.z;
    vec3 base = diffuseColor.rgb;
    if (st > 9.5) {
      // a photographed facade laid on the wall: a top band, as many floors as fit, then the ground band (shopfront or lobby)
      int k = int(st - 9.5);
      vec4 pa = uFacA[k], pb = uFacB[k]; float hM = uFacH[k];
      float L = vW.y, ul = vW.x, wM = pa.x, tu, dux;
      if (L >= 0.75 * wM) { float n = max(1.0, floor(L / wM + 0.5)), x = ul / L * n, cellN = floor(x), fx = x - cellN; tu = mod(cellN, 2.0) < 0.5 ? fx : 1.0 - fx; dux = n / L; }
      else { tu = 0.5 + (ul - 0.5 * L) / wM; dux = 1.0 / wM; }
      float gM = pa.z, tM = pa.y, fM = pa.w;
      float kf = max(0.0, floor((H - gM - tM) / fM + 0.5)), tot = gM + kf * fM + tM, sv = H / tot, m = v / sv, tv;
      if (m < gM) tv = 1.0 - m / hM;
      else if (m < gM + kf * fM) tv = pb.y + pb.z - mod(m - gM, fM) / hM;
      else tv = pb.x - (m - gM - kf * fM) / hM;
      float gs = 1.0 / (hM * sv);
      vec2 gx = vec2(dFdx(ul) * dux, dFdx(v) * gs), gy = vec2(dFdy(ul) * dux, dFdy(v) * gs);
      vec3 tex = textureGrad(uFac, vec3(clamp(tu, 0.002, 0.998), clamp(tv, 0.002, 0.998), float(k)), gx, gy).rgb;
      diffuseColor.rgb = tex;
      float tl = dot(tex, vec3(0.2126, 0.7152, 0.0722));
      lkEmit = smoothstep(0.35, 0.75, tl) * clamp((tex.r - tex.b) * 3.0, 0.0, 1.0) * 0.45;   // the lights that are on inside
      lkGlass = 0.0;
    } else {
    float bayW = 3.0 + hb * 1.0, floorH = 3.2 + fract(hb * 7.31) * 0.35;           // 0 painted, punched windows
    if (st > 0.5 && st < 1.5) { bayW = 1.5; floorH = 3.6; }                          // 1 glass curtain wall
    else if (st > 1.5 && st < 2.5) { bayW = 2.4; floorH = 3.4; }                     // 2 cladding with ribbon windows
    else if (st > 2.5) { bayW = 3.2 + hb * 0.6; floorH = 3.3; }                      // 3 brick or stone
    vec2 cell = vec2(u / bayW, v / floorH), id = floor(cell), f = fract(cell);
    float wx = fu / bayW, wy = fv / floorH;
    float hc = lkHash(id + hb * 37.0);
    vec3 sky = vec3(0.50, 0.64, 0.80);
    if (v < floorH * 1.05) {
      // ground floor: glass shopfronts with the lights on, roller shutters, a dark open bay; aluminium frames
      float bw = (st > 0.5 && st < 1.5) ? 3.0 : bayW * 1.15, bayG = floor(u / bw), fG = fract(u / bw), h2 = lkHash(vec2(bayG, hb * 53.0));
      float opening = lkBand(fG, 0.06, 0.94, fu / bw) * lkBand(v, 0.25, floorH * 0.86, fv);
      float frameG = lkBand(fG, 0.03, 0.97, fu / bw) * lkBand(v, 0.15, floorH * 0.9, fv) - opening;
      vec3 shutter = mix(vec3(0.62, 0.64, 0.64), vec3(0.62, 0.3, 0.22), step(0.85, lkHash(vec2(bayG, hb * 17.0))));
      shutter *= 0.92 + 0.08 * sin(v * 38.0) * lkLod(6.0, fv);
      float shop = h2 < 0.28 ? 0.0 : (h2 < 0.9 ? 1.0 : 2.0);
      vec3 inside = shop < 0.5 ? shutter : (shop < 1.5 ? mix(vec3(0.16, 0.2, 0.24), vec3(0.95, 0.82, 0.6), 0.3 + 0.4 * lkHash(vec2(bayG, hb))) : vec3(0.08, 0.07, 0.06));
      diffuseColor.rgb = mix(base, vec3(0.8, 0.82, 0.83), clamp(frameG, 0.0, 1.0) * 0.85);
      diffuseColor.rgb = mix(diffuseColor.rgb, inside, opening * 0.95);
      lkGlass = opening * step(0.5, shop) * (1.0 - step(1.5, shop)) * 0.8;
      lkEmit = opening * step(0.5, shop) * (1.0 - step(1.5, shop)) * (0.12 + 0.18 * lkHash(vec2(bayG, hb * 3.0)));   // lit shop interiors
      lkH = -0.18 * opening;
    } else if (st < 0.5) {
      // painted wall, punched windows with white frames, floor slabs, a few pilasters
      float win = lkBand(f.x, 0.17, 0.83, wx) * lkBand(f.y, 0.26, 0.82, wy);
      float frm = max(0.0, lkBand(f.x, 0.13, 0.87, wx) * lkBand(f.y, 0.22, 0.86, wy) - win);
      float curtain = step(0.84, hc);
      vec3 glass = mix(vec3(0.10, 0.13, 0.17), sky * 0.55, 0.25 + 0.35 * hc);
      glass = mix(glass, mix(vec3(0.82, 0.74, 0.6), vec3(0.7, 0.76, 0.82), fract(hc * 13.0)), curtain);
      glass *= 1.0 - 0.3 * smoothstep(0.82, 0.55, f.y);
      float grill = step(0.7, lkHash(id + 11.0)) * step(0.5, fract((f.x - 0.17) / 0.66 * 6.0)) * lkLod(6.0 / (0.66 * bayW), fu);
      glass = mix(glass, vec3(0.8), 0.5 * grill);
      float slab = 1.0 - lkBand(f.y, 0.07, 0.93, wy);
      float pil = step(0.5, fract(hb * 3.7)) * (1.0 - lkBand(f.x, 0.06, 0.94, wx));
      diffuseColor.rgb = mix(base, min(vec3(1.0), base * 1.1 + 0.05), max(slab, pil) * 0.9);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.93, 0.92), frm * 0.95);
      diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
      lkGlass = win * (1.0 - curtain) * (1.0 - 0.7 * grill);
      lkH = -0.14 * win - 0.03 * frm + 0.07 * max(slab, pil);
    } else if (st < 1.5) {
      // glass curtain wall: panels, spandrel bands, aluminium mullions, panels that blink in the sky
      float mull = 1.0 - lkBand(f.x, 0.035, 0.965, wx);
      float trans = 1.0 - lkBand(f.y, 0.012, 0.988, wy);
      float spand = 1.0 - lkBand(f.y, 0.3, 0.995, wy);
      vec3 pane = base * (0.5 + 0.4 * hc) * (0.82 + 0.4 * smoothstep(0.0, H, v));
      pane = mix(pane, sky * 0.7, 0.18 * smoothstep(0.3, 1.0, f.y) * (0.5 + 0.5 * lkNoise(vec2(u * 0.05, v * 0.04))));
      float blind = step(0.86, hc) * (1.0 - spand);
      pane = mix(pane, vec3(0.78, 0.72, 0.62), blind);
      vec3 spandCol = mix(base * 0.4 + 0.08, vec3(0.62, 0.64, 0.66), 0.4);
      diffuseColor.rgb = mix(pane, spandCol, spand);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.8, 0.81), max(mull, trans) * 0.9);
      lkGlass = (1.0 - spand) * (1.0 - max(mull, trans)) * (1.0 - blind);
      lkH = -0.05 * (1.0 - max(mull, trans)) - 0.04 * spand;
    } else if (st < 2.5) {
      // cladding panels with joints, ribbon windows between coloured or white fins
      float rib = lkBand(f.y, 0.24, 0.8, wy);
      float fin = lkBand(f.x, 0.44, 0.56, wx);
      float win2 = rib * (1.0 - fin);
      vec3 acc = hb < 0.3 ? vec3(0.93) : (hb < 0.5 ? vec3(0.88, 0.48, 0.18) : (hb < 0.7 ? vec3(0.12, 0.56, 0.58) : (hb < 0.85 ? vec3(0.17, 0.29, 0.48) : vec3(0.55, 0.15, 0.2))));
      vec3 glass = mix(vec3(0.09, 0.12, 0.16), sky * 0.5, 0.2 + 0.3 * hc);
      vec2 pj = abs(fract(vec2(u / 1.2, v / 2.4)) - 0.5);
      float joint = smoothstep(0.485, 0.5, max(pj.x, pj.y)) * lkLod(0.85, fu);
      diffuseColor.rgb = base * (1.0 - 0.1 * joint);
      diffuseColor.rgb = mix(diffuseColor.rgb, acc, rib * fin * 0.92);
      diffuseColor.rgb = mix(diffuseColor.rgb, glass, win2 * 0.95);
      lkGlass = win2;
      lkH = -0.1 * win2 + 0.06 * rib * fin;
    } else {
      // brick or stone, large windows with stone sills and lintels
      float win = lkBand(f.x, 0.14, 0.86, wx) * lkBand(f.y, 0.2, 0.84, wy);
      float sillB = lkBand(f.y, 0.14, 0.2, wy) * lkBand(f.x, 0.1, 0.9, wx), lint = lkBand(f.y, 0.84, 0.9, wy) * lkBand(f.x, 0.1, 0.9, wx);
      float course = floor(v / 0.075), brick = lkHash(vec2(floor(u / 0.23 + 0.5 * mod(course, 2.0)), course));
      float mortar = 1.0 - lkBand(fract(v / 0.075), 0.08, 1.0, fv / 0.075);
      vec3 wall = base * (0.9 + 0.2 * brick * lkLod(13.0, fv)) * (1.0 - 0.14 * mortar * lkLod(13.0, fv));
      vec3 glass = mix(vec3(0.10, 0.13, 0.17), sky * 0.5, 0.2 + 0.35 * hc);
      diffuseColor.rgb = mix(wall, vec3(0.86, 0.84, 0.8), max(sillB, lint) * 0.95);
      diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
      lkGlass = win;
      lkH = -0.16 * win + 0.05 * max(sillB, lint);
    }
    }   // end of the procedural styles
    // a little soft grain in the paint; a whisper of darkness at the very base
    diffuseColor.rgb *= 0.97 + 0.03 * lkNoise(vec2(u * 2.9, v * 0.4) + 5.0) * lkLod(2.9, fu);
    diffuseColor.rgb *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.9, v));
  }
`;

const ROAD = {
  tarmac: /* glsl */`
    float rm = vRoad.x, rhw = vRoad.z, ram = abs(rm);
    float laneC = clamp(rhw * 0.48, 1.2, 3.6);
    vec2 q = vLkP.xz;
    // worn, slightly warm asphalt: broad tonal drift, fine aggregate, repair patches, hairline cracks
    float drift = lkNoise(q * 0.035) * 0.6 + lkNoise(q * 0.13 + 7.0) * 0.4;
    diffuseColor.rgb *= 0.84 + 0.26 * drift;
    float ag = lkNoise(q * 11.0) * 0.55 + lkNoise(q * 37.0) * 0.45;
    diffuseColor.rgb *= 1.0 + 0.22 * (ag - 0.5) * lkLod(11.0, lkFwv);
    float repair = smoothstep(0.585, 0.605, lkNoise(q * 0.06 + 4.0));
    diffuseColor.rgb *= 1.0 - 0.15 * repair;
    float cw = max(0.012, lkFwv * 0.8 * 0.9);
    float crack = 1.0 - smoothstep(0.0, cw, abs(lkNoise(q * 0.8 + 8.0) - 0.5));
    diffuseColor.rgb *= 1.0 - 0.2 * crack * smoothstep(0.62, 0.8, lkNoise(q * 0.1 + 21.0)) * lkLod(6.0, lkFwv);   // cracks only in some stretches
    // wheel tracks in every lane: darker, a little polished; the strip between them stays dusty
    float track = smoothstep(0.5, 0.05, abs(abs(ram - laneC) - 0.85));
    diffuseColor.rgb *= 1.0 - 0.1 * track * lkLod(1.5, lkFwv);
    lkRoad = track * 0.6;
    // sand and dust piled along the kerb
    float dust = smoothstep(rhw - 1.4, rhw - 0.1, ram);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.54, 0.5, 0.44), 0.55 * dust * (0.6 + 0.4 * lkNoise(q * 2.5)));
  `,
  paving: /* glsl */`
    float rm = vRoad.x, ra = vRoad.y;
    vec2 q = vLkP.xz;
    // concrete slabs 0.9 x 0.6 m with seams, each a touch different; stains and dirt
    vec2 tile = vec2(ra / 0.9, rm / 0.6), tid = floor(tile), tf = fract(tile);
    vec2 e = min(tf, 1.0 - tf) * vec2(0.9, 0.6);
    float seam = 1.0 - smoothstep(0.0, 0.012 + lkFwv, min(e.x, e.y));
    diffuseColor.rgb *= 1.0 - 0.24 * seam * lkLod(1.7, lkFwv);
    diffuseColor.rgb *= 0.93 + 0.14 * lkHash(tid) * lkLod(1.7, lkFwv) + 0.07 * (1.0 - lkLod(1.7, lkFwv));
    diffuseColor.rgb *= 0.82 + 0.22 * lkNoise(q * 0.3) + 0.06 * lkNoise(q * 1.7) * lkLod(1.7, lkFwv);
  `,
};

/**
 * Give a standard material a look.
 * @param facade  walls get shop bays, windows and weathering, roofs get mottled concrete (for the merged building mesh)
 * @param grain   [[scale, amount], ...] world-space noise on the colour (cycles per metre; fades out when too fine to see)
 * @param road    'tarmac' | 'paving': the road shaders (needs the aRoad attribute made by roads.js)
 */
export function addSurfaceLook(material, { facade = false, grain = [], road = '', facades = null } = {}) {
  material.onBeforeCompile = (shader) => {
    if (facade && facades) { shader.uniforms.uFac = { value: facades.texture }; shader.uniforms.uFacA = { value: facades.A }; shader.uniforms.uFacB = { value: facades.B }; shader.uniforms.uFacH = { value: facades.H }; }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLkP; varying vec3 vLkN;${facade ? '\nattribute vec3 aB; varying vec3 vB; attribute vec2 aW; varying vec2 vW;' : ''}${road ? '\nattribute vec3 aRoad; varying vec3 vRoad;' : ''}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n  vLkP = (modelMatrix * vec4(transformed, 1.0)).xyz; vLkN = normalize(mat3(modelMatrix) * objectNormal);${facade ? '\n  vB = aB; vW = aW;' : ''}${road ? '\n  vRoad = aRoad;' : ''}`);
    const grainCode = grain.map(([scale, amount], i) => `diffuseColor.rgb *= 1.0 + ${amount.toFixed(3)} * (lkNoise(vLkP.xz * ${scale.toFixed(4)} + ${(i * 13.7).toFixed(1)}) - 0.5) * 2.0 * lkLod(${scale.toFixed(4)}, lkFwv);`).join('\n  ');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLkP; varying vec3 vLkN;${facade ? '\nvarying vec3 vB; varying vec2 vW; uniform sampler2DArray uFac; uniform vec4 uFacA[8]; uniform vec4 uFacB[8]; uniform float uFacH[8];' : ''}${road ? '\nvarying vec3 vRoad;' : ''}\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n  float lkGlass = 0.0; float lkRoad = 0.0; float lkEmit = 0.0; float lkH = 0.0; float lkFwv = lkFw();\n  ${grainCode}\n  ${facade ? FACADE : ''}\n  ${road ? ROAD[road] : ''}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.72, lkRoad); roughnessFactor = mix(roughnessFactor, 0.09, lkGlass);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, 0.55, lkGlass);')
      .replace('#include <normal_fragment_maps>', facade ? '#include <normal_fragment_maps>\n  normal = lkPerturb(-vViewPosition, normal, vec2(dFdx(lkH), dFdy(lkH)) * 0.5, faceDirection);' : '#include <normal_fragment_maps>')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(1.0, 0.78, 0.5) * lkEmit;');
  };
  material.customProgramCacheKey = () => `look-${facade ? (facades ? 'fp' : 'f') : 'g'}-${road}-${grain.map((x) => x.join(':')).join(',')}`;
  return material;
}

/** road shaders: addRoadLook(material, 'tarmac' | 'paving') */
export function addRoadLook(material, kind) { return addSurfaceLook(material, { road: kind }); }

/* ---- light from the sky ---- */
/** an image-based light that matches the sun: the sky itself, so shaded walls pick up blue sky and lit ones stay warm */
export function skyLight(renderer, sunDirection) {
  const sky = new Sky(); sky.scale.setScalar(10000);
  const u = sky.material.uniforms; u.turbidity.value = 5; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.82; u.sunPosition.value.copy(sunDirection);
  const holder = new THREE.Scene(); holder.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer), target = pmrem.fromScene(holder, 0.02);
  pmrem.dispose(); sky.geometry.dispose(); sky.material.dispose();
  return target.texture;
}

/* ---- photographed facades ---- */
const loadImage = (url) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });

/** the facade pictures as one array texture (a layer each), plus the numbers the wall shader needs.
 *  @param list   FACADES from facades.js
 *  @param scale  1 = 1024 x 1536 per layer; 0.5 for phones */
export async function loadFacades(list, scale = 1) {
  const w = Math.round(1024 * scale), h = Math.round(1536 * scale), layer = w * h * 4, data = new Uint8Array(layer * list.length);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const g = canvas.getContext('2d', { willReadFrequently: true });
  const imgs = await Promise.all(list.map((f) => loadImage(f.file)));
  imgs.forEach((img, i) => { g.drawImage(img, 0, 0, w, h); data.set(g.getImageData(0, 0, w, h).data, i * layer); });
  const texture = new THREE.DataArrayTexture(data, w, h, list.length);
  texture.format = THREE.RGBAFormat; texture.type = THREE.UnsignedByteType; texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = true; texture.anisotropy = 16; texture.needsUpdate = true;
  const A = [], B = [], H = [];
  for (let i = 0; i < 8; i++) { const f = list[i]; A.push(f ? new THREE.Vector4(f.widthM, f.topM, f.groundM, f.floorM) : new THREE.Vector4(1, 1, 1, 1)); B.push(f ? new THREE.Vector4(f.vTop, f.v0, f.vp, f.vGround) : new THREE.Vector4()); H.push(f ? f.heightM : 1); }
  return { texture, A, B, H, list };
}

/* ---- finish: tone mapping and colour grade, done in every material instead of an extra full-screen pass ---- */
/** Makes THREE.CustomToneMapping mean: Khronos Neutral tone mapping (true to the paint, soft highlights), then a light grade
 *  (cool shadows, warm highlights, a gentle S-curve, 8% more colour). Only renderers set to CustomToneMapping are affected. */
export function installFinish() {
  if (installFinish.done) return; installFinish.done = true;
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment, old = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
  if (!chunk.includes(old)) { console.warn('[city-look] custom tone mapping hook not found, using the plain look'); return; }
  THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(old, /* glsl */`
vec3 CustomToneMapping( vec3 color ) {
  vec3 g = pow(max(NeutralToneMapping(color), vec3(0.0)), vec3(1.0 / 2.2));      // grade in a perceptual space
  float l = dot(g, vec3(0.2126, 0.7152, 0.0722));
  g += vec3(-0.010, 0.002, 0.018) * (1.0 - smoothstep(0.0, 0.5, l));
  g += vec3(0.022, 0.010, -0.014) * smoothstep(0.45, 1.0, l);
  g = clamp(g, 0.0, 1.0);
  g = mix(g, g * g * (3.0 - 2.0 * g), 0.22);
  g = mix(vec3(dot(g, vec3(0.2126, 0.7152, 0.0722))), g, 1.08);
  return pow(clamp(g, 0.0, 1.0), vec3(2.2));
}`);
}
