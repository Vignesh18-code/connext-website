/* Pondy Bazaar, a busy street in T. Nagar, Chennai, from above.
   The layout is real: roads and building outlines from OpenStreetMap (© OpenStreetMap contributors, ODbL), converted by
   scripts/build-tnagar-map.py into public/data/tnagar-streets.json and drawn here in our own style with real sun shadows.
   Building heights are estimates (OpenStreetMap rarely records them here).
   The shot: it opens on a straight-down view of the street with live traffic; as you scroll, a Connext truck (ringed in brand
   green) pulls out, drives along the street and stops at a shop, while the camera locks on and comes down to it.
   Driven by `setProgress(0..1)`; the traffic moves with `tick(seconds)`.

   Axes: x east, z south (north is -z), origin near Pondy Bazaar. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTraffic } from './traffic.js';
import { loadConnextTruck } from './connext-truck.js';
import { addSurfaceLook, pickColours, styleOf, offsetRing, dropDownFaces, paintBuilding, contactShadow, skyLight, loadFacades, installFinish } from './city-look.js';
import { FACADES } from './facades.js';
import { buildRoadLayers } from './roads.js';
import { buildShopfronts } from './shopfronts.js';

const DATA_URL = '/data/tnagar-streets.json';

const START = { alt: 215, tilt: 55, fov: 38 }, END = { alt: 42, tilt: 34, fov: 32 };   // the opening picture, and where the camera comes down to
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 0));   // lets the page draw a frame between the big steps of building the scene, so scrolling never stalls

export async function createStreets({ canvas, quality = 'high' } = {}) {
  const high = quality === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const LEVELS = [2, 1.75, 1.5, 1.25, 1.0, 0.85];   // the most pixels per CSS pixel the picture may have; the scene steps down this list when frames come slowly (it never draws more pixels than the screen has)
  let level = 0;
  let dprOverride = 0;   // for measuring only
  const pixelRatio = () => dprOverride || Math.min(devicePixelRatio || 1, LEVELS[level]);
  renderer.setPixelRatio(pixelRatio());
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  installFinish(); renderer.toneMapping = THREE.CustomToneMapping; renderer.toneMappingExposure = 1.0;   // true-to-paint tone mapping and a light colour grade, done in every material (no extra full-screen pass)

  const data = await fetch(DATA_URL).then((r) => { if (!r.ok) throw new Error('map data missing'); return r.json(); });

  const facades = await loadFacades(FACADES, high ? 1 : 0.5).catch((e) => { console.warn('[streets] facade pictures not loaded, using painted walls', e); return null; });

  await nextFrame();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcdd8e2);
  scene.fog = new THREE.Fog(0xd3dce4, 1100, 4200);   // a little haze with distance
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 1, 4000);

  /* light: a morning sun from the south-west, a soft sky fill */
  scene.add(new THREE.HemisphereLight(0xeeeeea, 0x8a857a, 0.7));
  const sun = new THREE.DirectionalLight(0xffeccc, 3.0);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 40), THREE.MathUtils.degToRad(-50));
  const skyTex = skyLight(renderer, sunDir); scene.environment = skyTex; scene.environmentIntensity = 0.25;   // shaded walls pick up the blue of the sky, lit ones stay warm
  scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(high ? 4096 : 2048, high ? 4096 : 2048);
  const SH = 170; Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 10, far: 700 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.25; sun.shadow.radius = 2.5;
  /* The shadow map covers just what the picture shows: close views get a small, very sharp map (2-3 cm per texel), wide ones a larger one.
     The size changes in a few steps (with some hysteresis), not continuously, so shadow edges never crawl; its centre moves in whole texels only. */
  const REACH_STEPS = [40, 60, 85, 120, 170, 240];
  let reachIndex = REACH_STEPS.length - 1;
  const lightX = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), sunDir).normalize(), lightY = new THREE.Vector3().crossVectors(sunDir, lightX).normalize();
  const sunSpot = new THREE.Vector3();
  const placeSun = (x, z, need) => {
    let want = REACH_STEPS.findIndex((r) => r >= need); if (want < 0) want = REACH_STEPS.length - 1;
    if (want > reachIndex || want < reachIndex - 1) reachIndex = want;   // grow at once; shrink only when the view is well inside the next smaller step
    const reach = REACH_STEPS[reachIndex], c = sun.shadow.camera;
    if (c.right !== reach) { Object.assign(c, { left: -reach, right: reach, top: reach, bottom: -reach, far: 700 + reach * 2 }); c.updateProjectionMatrix(); sun.shadow.normalBias = 0.05 + 0.2 * (reach / 170); }
    const texel = (2 * reach) / sun.shadow.mapSize.x;
    sunSpot.set(x, 0, z); const a = sunSpot.dot(lightX), b = sunSpot.dot(lightY);
    sunSpot.addScaledVector(lightX, Math.round(a / texel) * texel - a).addScaledVector(lightY, Math.round(b / texel) * texel - b);
    sun.target.position.copy(sunSpot); sun.position.copy(sunDir).multiplyScalar(380 + Math.max(0, reach - SH) * 1.2).add(sunSpot); sun.target.updateMatrixWorld();
  };

  /* ground */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), addSurfaceLook(new THREE.MeshStandardMaterial({ color: 0x93938e, roughness: 1 }), { grain: [[0.012, 0.12], [0.045, 0.08], [0.35, 0.06], [2.1, 0.04]] }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);

  /* The flat layers (parks, pavement, roads, markings) are drawn one over the other in a fixed order and do not write depth,
     so they can never fight over the same pixels, however high the camera is. Buildings and cars are drawn after them. */
  let layer = -20;
  const flat = (geometry, material, { shadow = true } = {}) => {
    material.depthWrite = false; material.polygonOffset = true; material.polygonOffsetFactor = -2; material.polygonOffsetUnits = -2;
    const m = new THREE.Mesh(geometry, material); m.receiveShadow = shadow; m.renderOrder = layer++; scene.add(m); return m;
  };
  ground.renderOrder = -21;

  /* parks */
  const parkGeos = [];
  for (const ring of data.parks) {
    const sh = new THREE.Shape(); for (let i = 0; i < ring.length; i += 2) { if (i === 0) sh.moveTo(ring[i], -ring[i + 1]); else sh.lineTo(ring[i], -ring[i + 1]); }
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.translate(0, 0.02, 0); parkGeos.push(g);
  }
  if (parkGeos.length) flat(mergeGeometries(parkGeos, false), new THREE.MeshStandardMaterial({ color: 0x9dba8b, roughness: 1 }));

  /* traffic first: its road network also tells the road painter where the junctions are */
  const traffic = createTraffic({ roads: data.roads, bounds: data.bounds, density: high ? 1 : 0.55 });
  scene.add(traffic.group);
  await nextFrame();

  /* roads (roads.js): pavement, kerb, tarmac, bridges, lane markings, zebra crossings; drawn one layer over the other */
  const road = buildRoadLayers(data, traffic.network);
  for (const l of road.layers) flat(l.geometry, l.material, { shadow: l.shadow });
  await nextFrame();
  const marksMat = road.markings;
  const TARMAC = new THREE.Color(0x4a4c4e), MARK = new THREE.Color(0xe9e6dc);

  /* buildings: every outline extruded to its height, in one of four modern styles (painted, glass curtain wall, cladding, brick or stone), with a
     parapet round the roof and, on some, a set-back top floor. A soft dark skirt on the ground round each one stands in for ambient occlusion. */
  const area2 = (p) => { let a = 0; for (let k = 0; k < p.length; k += 2) { const k2 = (k + 2) % p.length; a += p[k] * p[k2 + 1] - p[k2] * p[k + 1]; } return a / 2; };
  const hash = (n) => { let h = Math.imul((n | 0) ^ 0x7f4a7c15, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const lots = data.buildings.map((b, i) => {
    const area = Math.abs(area2(b.r)), style = styleOf(i, area, b.h);
    // about nine in ten buildings of 8 m and more wear a photographed facade that fits their size (narrow lots get the narrow ones)
    let photo = -1;
    if (facades && b.h >= 8 && hash(i * 31 + 7) < 0.9) {
      const narrow = Math.sqrt(area) < 11, ok = FACADES.map((f, k) => k).filter((k) => FACADES[k].minH <= b.h && (!narrow || FACADES[k].widthM < 13));
      if (ok.length) photo = ok[Math.floor(hash(i * 17 + 3) * ok.length)];
    }
    return { r: b.r, h: b.h, area, style, index: i, photo, fac: photo >= 0 ? FACADES[photo] : null };
  });
  const tanks = []; const stairs = []; const panels = [];
  const shadowSkirt = { pos: [], col: [], idx: [] };
  const CHUNK = 128;   // buildings are merged per 128 m square, so the page can skip the squares that are off screen (and out of the sun's shadow view)
  const chunks = new Map();
  for (const [i, b] of lots.entries()) {
    if (i % 250 === 249) await nextFrame();
    const r = rng(i * 7919 + 13), pts = b.r, area = b.area;
    const cell = Math.floor(pts[0] / CHUNK) + ',' + Math.floor(pts[1] / CHUNK), geos = (chunks.get(cell) || chunks.set(cell, []).get(cell));
    const ringShape = (ring) => { const sh = new THREE.Shape(); for (let k = 0; k < ring.length; k += 2) { if (k === 0) sh.moveTo(ring[k], -ring[k + 1]); else sh.lineTo(ring[k], -ring[k + 1]); } return sh; };
    const shapeOf = () => ringShape(pts);
    const [roof, wall] = pickColours(r, b.style), hbRand = r();
    let g = new THREE.ExtrudeGeometry(shapeOf(), { depth: b.h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g = dropDownFaces(g); paintBuilding(g, roof, wall, b.h, hbRand, b.photo >= 0 ? 10 + b.photo : b.style); geos.push(g);
    let cx = 0, cz = 0; const m = pts.length / 2; for (let k = 0; k < pts.length; k += 2) { cx += pts[k]; cz += pts[k + 1]; } cx /= m; cz /= m;
    // a set-back top floor on some of the taller buildings: a smaller block on the roof, in the same style
    let top = b.h;
    if (b.h >= 14 && area > 120 && m <= 8 && r() < 0.4) {
      const inner = offsetRing(pts, 2.2);
      if (inner && Math.sign(area2(inner)) === Math.sign(area2(pts)) && Math.abs(area2(inner)) > area * 0.35) {
        let pg = new THREE.ExtrudeGeometry(ringShape(inner), { depth: 3.2, bevelEnabled: false });
        pg.rotateX(-Math.PI / 2); pg.translate(0, b.h, 0); pg = dropDownFaces(pg); paintBuilding(pg, roof, wall.clone().multiplyScalar(1.04), b.h + 3.2, hbRand, b.photo >= 0 || b.style === 1 ? 2 : b.style); geos.push(pg);
        top = b.h + 3.2;
      }
    }
    // parapet: the low wall round the edge of every flat roof
    if (high && area > 28) {
      const inner = offsetRing(pts, 0.3);
      if (inner) {
        const sh = shapeOf(), hole = new THREE.Path(); inner.forEach((v, k) => { if (k % 2) return; if (k === 0) hole.moveTo(v, -inner[k + 1]); else hole.lineTo(v, -inner[k + 1]); }); sh.holes.push(hole);
        let pg = new THREE.ExtrudeGeometry(sh, { depth: 0.7 + r() * 0.25, bevelEnabled: false });
        pg.rotateX(-Math.PI / 2); pg.translate(0, b.h, 0); pg = dropDownFaces(pg); paintBuilding(pg, roof.clone().multiplyScalar(1.08), wall, b.h, hbRand, 0); geos.push(pg);
      }
    }
    contactShadow(pts, shadowSkirt, { steps: high ? 3 : 2, strength: 0.34 });
    // roof clutter: the water tank every roof has, a stair-head room on the bigger ones, and solar panels on some
    if (area > 45) { tanks.push([cx + (r() - 0.5) * 2, top, cz + (r() - 0.5) * 2, r()]); if (area > 220) tanks.push([cx + (r() - 0.5) * 6, top, cz + (r() - 0.5) * 6, r()]); }
    if (area > 120) stairs.push([cx + (r() - 0.5) * 3, top, cz + (r() - 0.5) * 3, 2.4 + r() * 1.2, r()]);
    if (high && area > 90 && top === b.h && r() < 0.4) {
      // panels in rows along the building's longest wall, on the half of the roof away from the centre
      let best = 0, ex = 1, ez = 0; for (let k = 0; k < pts.length; k += 2) { const k2 = (k + 2) % pts.length, dx = pts[k2] - pts[k], dz = pts[k2 + 1] - pts[k + 1], L = Math.hypot(dx, dz); if (L > best) { best = L; ex = dx / L; ez = dz / L; } }
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; for (let k = 0; k < pts.length; k += 2) { const uu = pts[k] * ex + pts[k + 1] * ez, vv = -pts[k] * ez + pts[k + 1] * ex; u0 = Math.min(u0, uu); u1 = Math.max(u1, uu); v0 = Math.min(v0, vv); v1 = Math.max(v1, vv); }
      const cu = cx * ex + cz * ez, cv = -cx * ez + cz * ex, side = r() < 0.5 ? 1 : -1, rows = 2 + Math.floor(r() * 2);
      for (let row = 0; row < rows; row++) {
        const vv = cv + side * (3.2 + row * 1.9); if (vv < v0 + 1.6 || vv > v1 - 1.6) continue;
        for (let uu = Math.max(u0 + 1.8, cu - 7); uu < Math.min(u1 - 1.8, cu + 7); uu += 2.15) panels.push([uu * ex - vv * ez, top + 0.55, uu * ez + vv * ex, Math.atan2(-ez, ex) * 1, side]);
      }
    }
  }
  const buildingMat = addSurfaceLook(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, envMap: skyTex, envMapIntensity: 0.85 }), { facade: true, facades });
  for (const list of chunks.values()) {
    const m = new THREE.Mesh(mergeGeometries(list, false), buildingMat); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    list.forEach((g) => g.dispose());
  }
  await nextFrame();
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(shadowSkirt.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(shadowSkirt.col, 4)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(shadowSkirt.pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex(shadowSkirt.idx);
    flat(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true }), { shadow: false });
  }
  const dummy = new THREE.Object3D();
  const tankMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 0.7, 1.1, 12), new THREE.MeshStandardMaterial({ roughness: 0.55 }), tanks.length);
  tanks.forEach(([x, y, z, t], i) => { dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.position.set(x, y + 0.65, z); dummy.updateMatrix(); tankMesh.setMatrixAt(i, dummy.matrix); tankMesh.setColorAt(i, new THREE.Color(t < 0.74 ? '#25292c' : t < 0.92 ? '#d4d8da' : '#2f5d96')); });
  tankMesh.castShadow = true; scene.add(tankMesh);
  const stairMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.95 }), stairs.length);
  stairs.forEach(([x, y, z, s, t], i) => { dummy.position.set(x, y + 1.25, z); dummy.scale.set(s, 2.5, s); dummy.updateMatrix(); stairMesh.setMatrixAt(i, dummy.matrix); stairMesh.setColorAt(i, new THREE.Color(t < 0.5 ? '#c9c3b6' : t < 0.8 ? '#e2dccd' : '#b0aa9d')); });
  stairMesh.castShadow = true; scene.add(stairMesh);
  if (panels.length) {   // rooftop solar panels, tilted towards the sun
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(2.0, 0.05, 1.0), new THREE.MeshStandardMaterial({ color: 0x1b2a47, roughness: 0.28, metalness: 0.6 }), panels.length);
    panels.forEach(([x, y, z, ry, side], i) => { dummy.position.set(x, y, z); dummy.rotation.set(0.26 * side, ry, 0, 'YXZ'); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); pm.setMatrixAt(i, dummy.matrix); });
    pm.castShadow = true; pm.receiveShadow = true; scene.add(pm); dummy.rotation.set(0, 0, 0);
  }

  /* street frontages: shop signboards, awnings, hoardings and air conditioners on the walls that face the street (shopfronts.js) */
  const shopfronts = buildShopfronts(lots, data.roads, { high });
  scene.add(shopfronts.group);

  for (let i = 0; i < 80; i++) traffic.update(0.05);   // let the traffic mix before the first picture

  /* the street we start on */
  const focus = data.foci[0];   // the middle of Pondy Bazaar
  const heading = () => {   // the direction of Pondy Bazaar, as the angle that makes it horizontal on screen
    const pts = []; for (const r of data.roads) if (r.n === 1) for (let i = 0; i < r.p.length; i += 2) pts.push([r.p[i], r.p[i + 1]]);
    let a = pts[0], b = pts[0], best = 0; for (const p of pts) for (const q of pts) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > best) { best = d; a = p; b = q; } }
    let dx = b[0] - a[0], dz = b[1] - a[1]; if (dx < 0) { dx = -dx; dz = -dz; } const L = Math.hypot(dx, dz) || 1;
    return Math.atan2(dz / L, dx / L);   // angle of the street from +x towards +z
  };
  const HEAD = heading(), ux = Math.cos(HEAD), uz = Math.sin(HEAD);   // (ux, uz): the way the truck drives (east-ish)

  /* our truck: drives the street from a little west of the first picture's middle to a shop, in the kerb lane */
  const route = traffic.route(focus[0] - ux * 62, focus[1] - uz * 62, ux, uz, 340);
  const spot = { x: 0, z: 0, heading: 0, w: 10 };
  const inRing = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { if ((p[i + 1] > z) !== (p[j + 1] > z) && x < ((p[j] - p[i]) * (z - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) c = !c; } return c; };
  const ringArea = (p) => { let a = 0; for (let k = 0; k < p.length; k += 2) { const k2 = (k + 2) % p.length; a += p[k] * p[k2 + 1] - p[k2] * p[k + 1]; } return Math.abs(a) / 2; };
  let STOP_D = 140;   // metres from the start where the truck stops: in front of a shop-sized building on the kerb side
  if (route) {
    let bestScore = 0;
    for (let d = 100; d <= 200; d += 3) {
      route.sample(d, spot); const lx = Math.sin(spot.heading), lz = -Math.cos(spot.heading);
      for (const off of [spot.w / 2 + 2.5, spot.w / 2 + 5]) {
        const kx = spot.x + lx * off, kz = spot.z + lz * off;
        for (const b of data.buildings) { if (!inRing(kx, kz, b.r)) continue; const area = ringArea(b.r); if (area < 150 || area > 900) continue; const score = Math.min(area, 400); if (score > bestScore + 1) { bestScore = score; STOP_D = d; } }
      }
    }
  }
  const HERO_FROM = 0.06, HERO_TO = 0.78;   // scroll progress during which the truck drives
  const heroDistance = (p) => STOP_D * smooth((p - HERO_FROM) / (HERO_TO - HERO_FROM));
  const laneLat = (w) => Math.min(3.6, Math.max(1.2, w * 0.24));   // the same lane the traffic uses
  const pull = (p) => smooth((p - 0.66) / 0.14);   // 0 while driving in the lane, 1 once pulled in to the kerb at the shop
  const kerbLat = (w, p) => laneLat(w) + (w / 2 - 2.5 - laneLat(w)) * pull(p);

  const hero = new THREE.Group(); scene.add(hero);
  const ringTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 126);
    [[0, 0.10], [0.6, 0.14], [0.74, 0.5], [0.79, 0.95], [0.84, 0.4], [0.95, 0], [1, 0]].forEach(([t, a]) => grad.addColorStop(t, `rgba(0,199,87,${a})`));
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.16; ring.renderOrder = 5; hero.add(ring);
  let truckModel = null;
  const truckReady = loadConnextTruck().then(({ group }) => { truckModel = group; group.scale.setScalar(1.5); hero.add(group); }).catch((e) => console.warn('[streets] truck model not loaded', e));
  const heroGround = new THREE.Vector3();   // where the truck stands (on the road) in the current picture
  function placeHero(p) {
    if (!route) { hero.visible = false; return; }
    route.sample(heroDistance(p), spot);
    const lat = kerbLat(spot.w, p), c = Math.cos(spot.heading), s = Math.sin(spot.heading);
    heroGround.set(spot.x + s * lat, 0, spot.z - c * lat);
    hero.position.copy(heroGround); hero.rotation.y = -spot.heading;
  }
  let clock = 0, lastD = 0, heroV = 0;
  const probe = { x: 0, z: 0, heading: 0, w: 10, lane: 0, s: 0 };

  const openAt = new THREE.Vector3();   // what the opening picture looks at (set below, once the screen directions are known)
  const up = new THREE.Vector3(), right = new THREE.Vector3(), tgt = new THREE.Vector3(), pos = new THREE.Vector3(), lead = new THREE.Vector3();
  let progress = 0;
  const bounds = data.bounds, MAP_W = bounds[2] - bounds[0], MAP_D = bounds[3] - bounds[1];
  const corner = new THREE.Vector3();
  let lastView = null;   // what the last frame covered (for checking from the console)
  function place(alt, tilt) {
    pos.copy(tgt).addScaledVector(up, -tilt).setY(alt);
    camera.up.copy(up); camera.position.copy(pos); camera.lookAt(tgt); camera.updateMatrixWorld();
  }
  /** where the four corners of the picture land on the ground: [minX, minZ, maxX, maxZ] */
  function footprint() {
    const f = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [nx, ny] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      corner.set(nx, ny, 0.5).unproject(camera).sub(camera.position);
      const k = corner.y < -0.001 ? -camera.position.y / corner.y : 4000 / corner.length();   // a corner above the horizon counts as far away
      const x = camera.position.x + corner.x * k, z = camera.position.z + corner.z * k;
      f[0] = Math.min(f[0], x); f[2] = Math.max(f[2], x); f[1] = Math.min(f[1], z); f[3] = Math.max(f[3], z);
    }
    return f;
  }
  function applyCamera() {
    const p = progress, portrait = camera.aspect < 1;
    placeHero(p);
    // the camera starts on Pondy Bazaar's middle, then locks onto the truck (k) and comes down to it (e)
    const k = smooth((p - 0.02) / 0.48), e = smooth((p - 0.28) / 0.66);
    let alt = START.alt * Math.pow(END.alt / START.alt, e);   // heights change by the same ratio per step, so the descent feels even
    const tilt = START.tilt + (END.tilt - START.tilt) * e;
    // screen-right follows the street (angle head from +x towards +z); screen-up is the way "north" points when head = 0.
    // On a tall screen the street runs up the screen and the camera follows the truck from behind.
    const head = portrait ? HEAD + Math.PI / 2 : HEAD;
    right.set(Math.cos(head), 0, Math.sin(head)); up.set(right.z, 0, -right.x);
    openAt.set(focus[0], 0, focus[1]).addScaledVector(right, -45).addScaledVector(up, -38);   // the street runs across the upper part of the opening picture
    if (route) { const c = Math.cos(spot.heading), s = Math.sin(spot.heading), side = 5 * e, ahead = 14 * (1 - e) + 6 * e; lead.set(heroGround.x + c * ahead + s * side, 0, heroGround.z + s * ahead - c * side); tgt.copy(openAt).lerp(lead, k); } else tgt.copy(openAt);
    let fov = START.fov + (END.fov - START.fov) * e;
    if (camera.aspect < 1.4) fov = Math.min(66, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * 1.4 / camera.aspect)));   // tall screens: a wider lens
    camera.fov = fov; camera.updateProjectionMatrix();
    // keep the picture inside the mapped area, so it never shows empty ground: come down if the view is wider than the map, then slide it back inside
    let foot = null;
    for (let it = 0; it < 10; it++) {
      place(alt, tilt); foot = footprint();
      const w = foot[2] - foot[0], d = foot[3] - foot[1];
      if (w <= MAP_W && d <= MAP_D) break;
      alt *= Math.max(0.8, Math.min(MAP_W / w, MAP_D / d) * 0.995);
    }
    const dx = foot[0] < bounds[0] ? bounds[0] - foot[0] : (foot[2] > bounds[2] ? bounds[2] - foot[2] : 0);
    const dz = foot[1] < bounds[1] ? bounds[1] - foot[1] : (foot[3] > bounds[3] ? bounds[3] - foot[3] : 0);
    if (dx || dz) { tgt.x += dx; tgt.z += dz; place(alt, tilt); foot = footprint(); }
    // the clipping planes follow the height: a far-away camera gets a far-away near plane, which keeps depth precision fine
    camera.near = Math.max(1, alt * 0.25); camera.far = alt * 4 + 1000; camera.updateProjectionMatrix();
    if (marksMat) { const m = 1 - smooth((alt - 380) / 260); marksMat.color.lerpColors(TARMAC, MARK, m); marksMat.visible = m > 0.02; }
    lastView = { footprint: foot.map(Math.round), alt: Math.round(alt) };
    placeSun((foot[0] + foot[2]) / 2, (foot[1] + foot[3]) / 2, Math.hypot(foot[2] - foot[0], foot[3] - foot[1]) / 2 + 8);
  }
  function render() { applyCamera(); renderer.render(scene, camera); }
  function resize() {
    const box = canvas.parentElement, w = Math.max(2, box.clientWidth), h = Math.max(2, box.clientHeight);
    renderer.setPixelRatio(pixelRatio()); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  await truckReady; await nextFrame();
  // compile every shader without freezing the page, so the first picture does not stall (a hidden tab pauses this, so do not wait for it for long)
  await Promise.race([renderer.compileAsync(scene, camera).catch(() => {}), new Promise((resolve) => setTimeout(resolve, 2500))]);

  return {
    setProgress(v) { progress = Math.min(1, Math.max(0, v)); },
    get progress() { return progress; },
    get level() { return level; },
    degrade() { if (level >= LEVELS.length - 1) return false; level += 1; resize(); return true; },
    improve() { if (level <= 0) return false; level -= 1; resize(); return true; },
    resize, render,
    tick(seconds) {
      // the truck is steered by the scroll: the other vehicles queue behind it while it is in the lane, and swing out round it when passing
      let steered = null; placeHero(progress);
      if (route) {
        const d = heroDistance(progress); route.sample(d, probe);
        const v = Math.max(0, Math.min(12, (d - lastD) / Math.max(seconds, 1e-3))); lastD = d; heroV += (v - heroV) * Math.min(1, seconds * 4);
        steered = { lane: probe.lane, s: probe.s, v: heroV, blocks: d > 1 && pull(progress) < 0.5, x: heroGround.x, z: heroGround.z, heading: probe.heading };
      }
      traffic.update(seconds, steered); clock += seconds;
      const pulse = 0.5 + 0.5 * Math.sin(clock * 3.2);   // the green ring around our truck breathes
      ring.scale.setScalar(0.94 + 0.12 * pulse); ring.material.opacity = 0.7 + 0.3 * pulse;
    },
    view: () => ({ ...lastView, bounds, stopDistance: STOP_D, truckLoaded: !!truckModel, aspect: +camera.aspect.toFixed(2) }),
    tune({ dpr, shadow }) { if (dpr !== undefined) { dprOverride = dpr; resize(); } if (shadow !== undefined) { sun.castShadow = shadow; renderer.shadowMap.needsUpdate = true; } },   // for measuring only
    nearestToTruck: () => traffic.nearest(heroGround.x, heroGround.z),
    async still(url, w = 1920, h = 1080) {
      renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); render();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png')); resize(); render();
      const res = await fetch(url, { method: 'POST', body: blob }); return res.ok;
    },
    info: () => ({ frontage: shopfronts.frontage, balconies: shopfronts.balconies, panels: panels.length, signs: shopfronts.signs, awnings: shopfronts.awnings, acs: shopfronts.acs, zebras: road.zebras, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, buildings: data.buildings.length, roads: data.roads.length, quality }),
    dispose() { renderer.dispose(); },
    renderer,
  };
}
