/* The Connext world, shot 1: a Chennai residential street.
   The camera starts high above the street, follows the Connext truck down as it drives in, and lands low beside it
   at a home's gate, where the resident hands a parcel to the Connext driver.

   Everything is built in code (three.js) from things the project already has, so it costs no AI credits:
   - the buildings on both sides: the photoreal facades made for the parcel story (modern Chennai shops, offices and
     apartments with lit, furnished interiors) on real 3D building blocks, with roofs, water tanks and AC units
   - the home, its compound wall and gate: built in code
   - the Connext truck: the 3D model from tools/truck-render
   - people and street life: the cut-out figures made for the parcel story, standing on the footpaths

   Street axis is x (east is +x), the road centre is z = 0, north (-z) is where the home is. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const ASSET = '/assets/world';
const STORY = '/assets/parcel-story/1-street';

/* ------------------------------------------------------------------ small helpers */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
function tex(c, { srgb = true, rx = 1, ry = 1, aniso = 8, clamp = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + src)); i.src = src; });
function noiseCanvas(w, h, base, amp, seed) {
  const [c, g] = makeCanvas(w, h); g.fillStyle = base; g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h), d = img.data, r = rng(seed);
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amp; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  return [c, g];
}
const shadowize = (o, cast = true, receive = true) => o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = receive; } });
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------------ the street plan (metres) */
const ROAD_HALF = 4.2;      // the tarmac is 8.4 m wide
const KERB = 0.25;
const WALK_OUT = 6.2;       // building fronts stand at |z| = 6.2, behind a 1.75 m footpath
const STOP_X = 0.5;         // where the truck stops, with its rear (x = -1.6) at the home's gate
const TRUCK_Z = -3.3;       // in its lane by the north kerb (traffic keeps left)
const START_X = -44;

/* each facade picture: its size, the pixels above its roofline (rooftop extras are part of the picture) and how tall the
   building body is in the real world, which fixes the scale */
const FACADES = {
  fin:      { file: `${STORY}/backdrop/bld-fin.avif`,        w: 1206, h: 1500, roofPx: 2,   bodyM: 20,   side: '#d6cdb9' },
  med:      { file: `${STORY}/backdrop/bld-med.avif`,        w: 1131, h: 1500, roofPx: 3,   bodyM: 15,   side: '#c4cbc0' },
  cafe:     { file: `${STORY}/backdrop/bld-cafe.avif`,       w: 1026, h: 1500, roofPx: 60,  bodyM: 14.5, side: '#d8ccb6' },
  retail:   { file: `${STORY}/backdrop/bld-retail.avif`,     w: 1103, h: 1500, roofPx: 91,  bodyM: 12.5, side: '#d3957e' },
  elec:     { file: `${STORY}/backdrop/bld-elec.avif`,       w: 1286, h: 1500, roofPx: 3,   bodyM: 14,   side: '#8f8073' },
  it:       { file: `${STORY}/backdrop/bld-it.avif`,         w: 1516, h: 1500, roofPx: 204, bodyM: 19,   side: '#9aa3a8' },
  boutique: { file: `${STORY}/places/shop-boutique.avif`,    w: 1262, h: 1100, roofPx: 5,   bodyM: 6,    side: '#e6dfd4' },
  office:   { file: `${STORY}/places/office-corporate.avif`, w: 2043, h: 1100, roofPx: 3,   bodyM: 12.5, side: '#bfc3c6' },
};
/* the rows are laid out from the facade list, west to east, with a 0.8 m gap between buildings; the home takes x = -9 to 6 on the north side */
const widthOf = (k) => FACADES[k].w * FACADES[k].bodyM / (FACADES[k].h - FACADES[k].roofPx);
function rowWest(edge, order, limit) { const list = []; let x = edge, i = 0; while (x > limit) { const k = order[i++ % order.length]; x -= widthOf(k); list.push([k, x]); x -= 0.8; } return list; }
function rowEast(edge, order, limit) { const list = []; let x = edge, i = 0; while (x < limit) { const k = order[i++ % order.length]; list.push([k, x]); x += widthOf(k) + 0.8; } return list; }
const NORTH = [...rowWest(-9.4, ['cafe', 'med', 'fin', 'boutique', 'retail', 'elec', 'it'], -135), ...rowEast(6.4, ['retail', 'elec', 'it', 'med', 'cafe', 'fin', 'boutique'], 95)];
const SOUTH = rowEast(-135, ['office', 'boutique', 'elec', 'cafe', 'med', 'it', 'retail', 'fin'], 95);

/* people and props: file, folder, real height in metres (from manifest.json), x, z, mirrored */
const PEOPLE = [
  ['customer-offer', 'people', 1.62, -3.95, -5.55, false],     // the resident, parcel in her hands
  ['partner-receive', 'people', 1.76, -2.75, -5.45, true],     // the Connext driver, facing her
  ['life-p02', 'life', 1.73, -16, -5.4, false], ['life-p05', 'life', 1.69, -27, -5.2, true], ['life-p09', 'life', 1.72, 14, -5.3, false],
  ['life-p11', 'life', 1.73, 24, -5.5, true], ['life-p01', 'life', 1.64, -9.5, 5.4, true], ['life-p03', 'life', 1.75, 2.5, 5.2, false],
  ['life-p07', 'life', 1.76, 18, 5.5, true], ['life-p06', 'life', 1.65, -32, 5.3, false], ['life-p10', 'life', 1.6, 36, 5.2, true],
  ['life-scooter', 'life', 1.05, -12.3, -5.1, false], ['life-scooter', 'life', 1.05, 11.6, -5.3, true], ['life-moto', 'life', 1.1, 8.4, 5.1, false],
  ['life-moto', 'life', 1.1, -21, 5.1, true], ['life-cart', 'life', 2.3, -6.2, 5.35, false], ['life-bicycle', 'life', 1.05, -38, -5.1, false],
];

/* ------------------------------------------------------------------ camera flight, relative to the truck */
/* [camera offset from the truck, look-at offset from the truck, field of view, depth-of-field strength, roll in degrees].
   x is metres from the truck's x; y is height; z is absolute metres across the street. */
const KEYS = [
  [[0, 58, 4.0],      [0, 0, -5.0],        40, 0.0,    0],   // straight above, travelling with the truck, the street running level
  [[-6, 30, 6.0],     [1, 0, -3.5],        38, 0.0001, 3],   // sinking behind the truck
  [[-9, 10, 3.5],     [3, 1.0, -3.3],      34, 0.0003, 4],   // a swoop down the street, behind the truck
  [[-8.5, 3.6, 3.6],  [1.5, 1.2, -3.8],    30, 0.0006, 2],   // low, closing in
  [[-5.2, 1.5, 3.0],  [-1.6, 1.35, -5.0],  28, 0.0009, 0],   // hero angle: the handover at the gate, the truck beside it
  [[-4.6, 1.45, 2.8], [-1.7, 1.35, -5.0],  27, 0.0010, 0],   // a last slow push in
];
const U_STOP = 0.6;     // the truck has stopped by this point of the timeline
const progressCurve = (p) => { p = Math.min(1, Math.max(0, p)); return 0.5 * p + 0.5 * smooth(p); };
const truckX = (u) => { const k = Math.min(1, u / U_STOP); return START_X + (STOP_X - START_X) * (1 - Math.pow(1 - k, 2.2)); };

export async function createWorld({ canvas, quality = 'high', onProgress } = {}) {
  const high = quality === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !high, powerPreference: 'high-performance' });
  // quality steps, used by degrade(): a slow device is moved down one step at a time (smaller picture, then fewer effects)
  const LEVELS = high ? [1.5, 1.25, 1, 1] : [1.5, 1.25, 1, 0.8];
  let level = 0;
  const pixelRatio = () => Math.min(devicePixelRatio || 1, LEVELS[level]);
  renderer.setPixelRatio(pixelRatio());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 700);

  /* morning sun over Chennai: a physical sky, also used for reflections */
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 38), THREE.MathUtils.degToRad(-40));
  {
    const skyScene = new THREE.Scene(), sky = new Sky(); sky.scale.setScalar(450000); skyScene.add(sky);
    const u = sky.material.uniforms;
    u.turbidity.value = 5.5; u.rayleigh.value = 1.3; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.83; u.sunPosition.value.copy(sunDir);
    const pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromScene(skyScene).texture; pmrem.dispose();
    scene.background = env; scene.environment = env; scene.environmentIntensity = 0.55; scene.backgroundBlurriness = 0.02;
  }
  scene.fog = new THREE.FogExp2(0xd2dde6, 0.0034);
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
  sun.target.position.set(0, 0, -3); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(high ? 4096 : 2048, high ? 4096 : 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -22, near: 5, far: 170 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  const placeSun = (x) => { sun.target.position.set(x, 0, -3); sun.position.copy(sunDir).multiplyScalar(80).add(sun.target.position); };

  /* ---------------------------------------------------------------- load every picture first */
  const loader = new THREE.TextureLoader();
  const loadTex = (url) => loader.loadAsync(url).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }).catch(() => null);
  const facadeKeys = Object.keys(FACADES);
  const peopleFiles = [...new Set(PEOPLE.map((p) => `${STORY}/${p[1]}/${p[0]}.avif`))];
  const [facadeTex, peopleTex, logoImg] = await Promise.all([
    Promise.all(facadeKeys.map((k) => loadTex(FACADES[k].file))),
    Promise.all(peopleFiles.map(loadTex)),
    loadImg(`${ASSET}/logo-light.png`),
  ]);
  const FT = Object.fromEntries(facadeKeys.map((k, i) => [k, facadeTex[i]]));
  const PT = Object.fromEntries(peopleFiles.map((f, i) => [f, peopleTex[i]]));
  const logoRatio = logoImg.height / logoImg.width;

  /* ---------------------------------------------------------------- textures made in code */
  const plasterTex = (base, seed) => { const [c, g] = noiseCanvas(256, 256, base, 14, seed), r = rng(seed); g.globalAlpha = 0.02; for (let i = 0; i < 24; i++) { g.fillStyle = r() < 0.5 ? '#000' : '#fff'; g.fillRect(r() * 256, r() * 256, 40 + r() * 120, 2 + r() * 8); } g.globalAlpha = 1; return tex(c, { rx: 2, ry: 2 }); };
  const concreteRoof = (() => { const [c, g] = noiseCanvas(512, 512, '#8e918d', 26, 61), r = rng(8); g.globalAlpha = 0.18; for (let i = 0; i < 24; i++) { g.fillStyle = r() < 0.5 ? '#3d403c' : '#c9cbc5'; g.fillRect(r() * 512, r() * 512, 30 + r() * 120, 10 + r() * 60); } g.globalAlpha = 0.5; g.fillStyle = '#5b5e5a'; for (let i = 1; i < 4; i++) { g.fillRect(i * 128, 0, 2, 512); g.fillRect(0, i * 128, 512, 2); } g.globalAlpha = 1; return tex(c, { rx: 4, ry: 4 }); })();
  const roofMat = new THREE.MeshStandardMaterial({ map: concreteRoof, roughness: 0.95 });
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0xb9b8b0, roughness: 0.9 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.55 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xbfc4c6, roughness: 0.5, metalness: 0.4 });
  const acMat = new THREE.MeshStandardMaterial({ color: 0xe4e6e4, roughness: 0.6 });
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x1b2a38, roughness: 0.25, metalness: 0.6 });

  /* ---------------------------------------------------------------- ground, road and footpaths */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: 0x8b8d87, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; scene.add(ground);
  const asphaltTex = (() => {
    const [c, g] = noiseCanvas(512, 512, '#3b3e40', 20, 31), r = rng(5);
    for (let i = 0; i < 3200; i++) { g.globalAlpha = 0.12 + r() * 0.25; g.fillStyle = r() < 0.6 ? '#8e9395' : '#15181a'; g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
    g.globalAlpha = 0.5; for (let i = 0; i < 5; i++) { g.fillStyle = '#2a2d2f'; g.fillRect(r() * 480, r() * 480, 20 + r() * 60, 10 + r() * 30); }
    g.globalAlpha = 1; return tex(c, { rx: 120, ry: 2.2 });
  })();
  const road = new THREE.Mesh(new THREE.PlaneGeometry(600, ROAD_HALF * 2), new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.95 }));
  road.rotation.x = -Math.PI / 2; road.position.y = 0.002; road.receiveShadow = true; scene.add(road);
  const paverTex = (() => {
    const [c, g] = noiseCanvas(256, 256, '#a9a9a4', 18, 71), r = rng(12);
    for (let i = 0; i < 700; i++) { g.globalAlpha = 0.12; g.fillStyle = r() < 0.5 ? '#fff' : '#444'; g.fillRect(r() * 256, r() * 256, 2 + r() * 5, 2 + r() * 5); }
    g.globalAlpha = 0.6; g.fillStyle = '#6f706b'; for (let i = 0; i < 4; i++) { g.fillRect(i * 64, 0, 2, 256); g.fillRect(0, i * 64, 256, 2); }
    g.globalAlpha = 1; return tex(c, { rx: 240, ry: 1.5 });
  })();
  const walkMat = new THREE.MeshStandardMaterial({ map: paverTex, roughness: 0.9 });
  const kerbMat = new THREE.MeshStandardMaterial({ color: 0xc4c4be, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const walkW = WALK_OUT - ROAD_HALF - KERB;
    const walk = new THREE.Mesh(new THREE.BoxGeometry(600, 0.15, walkW), walkMat);
    walk.position.set(0, 0.075, s * (ROAD_HALF + KERB + walkW / 2)); walk.receiveShadow = walk.castShadow = true; scene.add(walk);
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(600, 0.15, KERB), kerbMat); kerb.position.set(0, 0.075, s * (ROAD_HALF + KERB / 2)); kerb.receiveShadow = true; scene.add(kerb);
    const dust = new THREE.Mesh(new THREE.PlaneGeometry(600, 0.7), new THREE.MeshStandardMaterial({ color: 0x77746b, roughness: 1, transparent: true, opacity: 0.45, depthWrite: false }));
    dust.rotation.x = -Math.PI / 2; dust.position.set(0, 0.006, s * (ROAD_HALF - 0.35)); scene.add(dust);
  }
  for (const x of [-27, -4, 19, 38]) {   // manhole covers
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 24), new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.7, metalness: 0.5 })); m.position.set(x, 0.012, 0.6); m.receiveShadow = true; scene.add(m);
  }

  /* ---------------------------------------------------------------- the buildings on both sides */
  function roofClutter(W, D, bodyM, seed, hasStairRoom) {
    const g = new THREE.Group(), r = rng(seed), pH = 0.95, pT = 0.22;
    for (const [w, d, x, z] of [[W, pT, W / 2, -pT / 2], [W, pT, W / 2, -D + pT / 2], [pT, D, pT / 2, -D / 2], [pT, D, W - pT / 2, -D / 2]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, pH, d), parapetMat); p.position.set(x, bodyM + pH / 2, z); g.add(p);
    }
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    const nTanks = 1 + Math.floor(r() * 2);
    for (let i = 0; i < nTanks; i++) {   // the black overhead water tank every Chennai roof has, on a small stand
      const x = 1.6 + r() * (W - 3.2), z = -(1.6 + r() * (D * 0.5));
      add(new THREE.BoxGeometry(1.5, 0.6, 1.5), parapetMat, x, bodyM + 0.3, z);
      add(new THREE.CylinderGeometry(0.85, 0.85, 1.25, 20), tankMat, x, bodyM + 0.6 + 0.62, z);
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12), tankMat, x, bodyM + 0.6 + 1.31, z);
    }
    if (!hasStairRoom && W > 8) add(new THREE.BoxGeometry(2.9, 2.6, 2.9), parapetMat, W - 3.2, bodyM + 1.3, -D + 3.4);   // the stair-head room
    const sx = 1.5 + r() * Math.max(1, W - 4);   // solar water heater
    add(new THREE.BoxGeometry(1.9, 0.08, 1.3), solarMat, sx, bodyM + 0.8, -D * 0.7).rotation.x = -0.35;
    add(new THREE.CylinderGeometry(0.22, 0.22, 1.7, 12), metalMat, sx, bodyM + 1.25, -D * 0.7 - 0.55).rotation.z = Math.PI / 2;
    for (let i = 0; i < 2 + Math.floor(r() * 3); i++) add(new THREE.BoxGeometry(0.9, 0.7, 0.45), acMat, 1 + r() * Math.max(1, W - 2), bodyM + 0.35, -D + 0.9 + r() * 2);   // AC outdoor units
    shadowize(g); return g;
  }
  const sideMats = {};
  function makeBuilding(key, x0, north, seed) {
    const f = FACADES[key], mpp = f.bodyM / (f.h - f.roofPx), W = f.w * mpp, H = f.h * mpp, D = 14;
    const g = new THREE.Group();
    const t = FT[key];
    if (t) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4 }));
      plane.position.set(W / 2, H / 2, 0.03); g.add(plane);
    }
    const sm = sideMats[key] || (sideMats[key] = new THREE.MeshStandardMaterial({ map: plasterTex(f.side, seed + 5), roughness: 0.92 }));
    const body = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, f.bodyM, D), [sm, sm, roofMat, sm, sm, sm]);
    body.position.set(W / 2, f.bodyM / 2, -D / 2); g.add(body);
    g.add(roofClutter(W, D, f.bodyM, seed, f.roofPx > 100));
    shadowize(g, true, true);
    g.children.forEach((c) => { if (c.material && c.material.isMeshBasicMaterial) { c.castShadow = false; c.receiveShadow = false; } });
    if (north) g.position.set(x0, 0, -WALK_OUT); else { g.rotation.y = Math.PI; g.position.set(x0 + W, 0, WALK_OUT); }
    scene.add(g); return g;
  }
  NORTH.forEach(([k, x], i) => makeBuilding(k, x, true, 100 + i * 7));
  SOUTH.forEach(([k, x], i) => makeBuilding(k, x, false, 300 + i * 11));
  for (const x of [-165, 125]) {   // the street is closed off in the distance, softened by fog
    const m = new THREE.Mesh(new THREE.BoxGeometry(30, 22, 26), new THREE.MeshStandardMaterial({ color: 0xc9c2b4, roughness: 0.95 })); m.position.set(x, 11, 0); scene.add(m);
  }

  /* ---------------------------------------------------------------- the home: compound wall, gate and house */
  const home = new THREE.Group(); scene.add(home);
  const hAdd = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; home.add(m); return m; };
  const wallMat = new THREE.MeshStandardMaterial({ map: plasterTex('#e6d9ba', 411), roughness: 0.92 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x1f4a3a, roughness: 0.55, metalness: 0.3 });
  const WALL_Z = -6.35, GATE_L = -5.0, GATE_R = -1.8, WALL_W = -8.85, WALL_E = 5.85;
  hAdd(new THREE.BoxGeometry(GATE_L - WALL_W, 1.75, 0.22), wallMat, (GATE_L + WALL_W) / 2, 0.875, WALL_Z);
  hAdd(new THREE.BoxGeometry(WALL_E - GATE_R, 1.75, 0.22), wallMat, (GATE_R + WALL_E) / 2, 0.875, WALL_Z);
  hAdd(new THREE.BoxGeometry(GATE_L - WALL_W + 0.1, 0.1, 0.32), parapetMat, (GATE_L + WALL_W) / 2, 1.8, WALL_Z);   // wall caps
  hAdd(new THREE.BoxGeometry(WALL_E - GATE_R + 0.1, 0.1, 0.32), parapetMat, (GATE_R + WALL_E) / 2, 1.8, WALL_Z);
  for (const x of [GATE_L, GATE_R]) { hAdd(new THREE.BoxGeometry(0.55, 2.4, 0.55), wallMat, x, 1.2, WALL_Z); hAdd(new THREE.BoxGeometry(0.7, 0.14, 0.7), parapetMat, x, 2.47, WALL_Z); }
  for (const [hx, dir] of [[GATE_L + 0.28, 1], [GATE_R - 0.28, -1]]) {   // two gate leaves, swung open into the compound
    const leaf = new THREE.Group(); leaf.position.set(hx, 0, WALL_Z); leaf.rotation.y = dir * (Math.PI / 2 - 0.25);
    const B = (w, h, d, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), greenMat); m.position.set(x, y, 0); m.castShadow = true; leaf.add(m); };
    B(1.45, 0.08, 0.06, dir * 0.72, 0.35); B(1.45, 0.08, 0.06, dir * 0.72, 1.5); B(0.08, 1.6, 0.06, dir * 0.04, 0.9); B(0.08, 1.6, 0.06, dir * 1.4, 0.9);
    for (let i = 1; i < 9; i++) B(0.03, 1.4, 0.03, dir * i * 0.155, 0.92);
    home.add(leaf);
  }
  const tileFloor = new THREE.Mesh(new THREE.BoxGeometry(14.7, 0.04, 6.6), new THREE.MeshStandardMaterial({ map: tex((() => { const [c, g] = noiseCanvas(256, 256, '#c9c3b6', 12, 91); g.fillStyle = '#9a958a'; for (let i = 0; i < 4; i++) { g.fillRect(i * 64, 0, 2, 256); g.fillRect(0, i * 64, 256, 2); } return c; })(), { rx: 7, ry: 3 }), roughness: 0.85 }));
  tileFloor.position.set(-1.5, 0.02, -9.5); tileFloor.receiveShadow = true; home.add(tileFloor);

  // the house itself (10 m wide, two floors): the front is one painted picture with lit interiors, plus a real porch, balcony and roof
  const HOUSE = { cx: -1.5, w: 10, h: 7.2, frontZ: -12.4, d: 9 };
  {
    const PPM = 200, cw = HOUSE.w * PPM, ch = HOUSE.h * PPM, [c, g] = makeCanvas(cw, ch), r = rng(515);
    const Y = (m) => ch - m * PPM, X = (m) => m * PPM;
    g.fillStyle = '#efe3c4'; g.fillRect(0, 0, cw, ch);
    g.globalAlpha = 0.05; for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.5 ? '#6b5b3a' : '#fff'; g.fillRect(r() * cw, 0, 2 + r() * 8, ch); } g.globalAlpha = 1;
    g.fillStyle = '#4e4640'; g.fillRect(0, Y(0.55), cw, 0.55 * PPM);                       // plinth
    g.fillStyle = '#b8553a'; g.fillRect(0, Y(3.78), cw, 0.28 * PPM);                      // terracotta band at the first-floor slab
    g.fillStyle = '#b8553a'; g.fillRect(0, 0, cw, 0.22 * PPM);                            // top band
    const room = (x, y, w, h, hue) => {   // a lit room seen through glass
      const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, `hsl(${hue},45%,62%)`); gr.addColorStop(1, `hsl(${hue},40%,46%)`);
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      const glow = g.createRadialGradient(x + w / 2, y + h * 0.12, 4, x + w / 2, y + h * 0.12, w * 0.8); glow.addColorStop(0, 'rgba(255,240,200,.85)'); glow.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = glow; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(60,40,30,.55)'; g.fillRect(x + w * 0.1, y + h * 0.62, w * 0.5, h * 0.28);      // sofa / bed
      g.fillStyle = 'rgba(70,45,30,.6)'; g.fillRect(x + w * 0.72, y + h * 0.3, w * 0.2, h * 0.6);        // cupboard
      g.strokeStyle = 'rgba(40,30,25,.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + w * 0.5, y + h * 0.12); g.lineTo(x + w * 0.5 - w * 0.22, y + h * 0.14); g.moveTo(x + w * 0.5, y + h * 0.12); g.lineTo(x + w * 0.5 + w * 0.22, y + h * 0.14); g.stroke();   // ceiling fan
      g.fillStyle = `hsla(${(hue + 150) % 360},40%,45%,.8)`; g.fillRect(x, y, w * 0.12, h); g.fillRect(x + w * 0.88, y, w * 0.12, h);   // curtains
      const refl = g.createLinearGradient(x, y, x + w, y + h); refl.addColorStop(0, 'rgba(255,255,255,.38)'); refl.addColorStop(0.5, 'rgba(255,255,255,.04)'); refl.addColorStop(1, 'rgba(255,255,255,.18)'); g.fillStyle = refl; g.fillRect(x, y, w, h);
    };
    const windowAt = (cxm, bottomM, wM, hM, hue, grill) => {
      const x = X(cxm - wM / 2), y = Y(bottomM + hM), w = wM * PPM, h = hM * PPM;
      g.fillStyle = '#f6f4ee'; g.fillRect(x - 10, y - 10, w + 20, h + 20); room(x, y, w, h, hue);
      g.strokeStyle = '#f6f4ee'; g.lineWidth = 7; g.strokeRect(x, y, w, h); g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.stroke();
      if (grill) { g.strokeStyle = '#2b2b2b'; g.lineWidth = 3; for (let gx = x + 14; gx < x + w; gx += 18) { g.beginPath(); g.moveTo(gx, y); g.lineTo(gx, y + h); g.stroke(); } g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x - 10, y + h + 10, w + 20, 6); g.fillStyle = '#fff'; g.fillRect(x - 16, y + h + 8, w + 32, 9);   // sill
    };
    windowAt(1.7, 1.0, 1.5, 1.45, 28, true); windowAt(8.3, 1.0, 1.5, 1.45, 200, true);          // ground floor
    windowAt(2.2, 3.95, 2.0, 2.3, 35, false); windowAt(7.8, 3.95, 2.0, 2.3, 18, false);         // first floor
    g.fillStyle = '#7b4a26'; g.fillRect(X(4.25), Y(2.45), 1.5 * PPM, 1.9 * PPM);                  // teak door
    g.strokeStyle = '#4d2d14'; g.lineWidth = 5; g.strokeRect(X(4.25), Y(2.45), 1.5 * PPM, 1.9 * PPM); g.beginPath(); g.moveTo(X(5), Y(2.45)); g.lineTo(X(5), Y(0.55)); g.stroke();
    g.fillStyle = '#d9b44a'; g.fillRect(X(4.85), Y(1.3), 6, 26); g.fillRect(X(5.1), Y(1.3), 6, 26);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(HOUSE.w, HOUSE.h), new THREE.MeshStandardMaterial({ map: tex(c, { clamp: true, aniso: 16 }), roughness: 0.85 }));
    front.position.set(HOUSE.cx, HOUSE.h / 2, HOUSE.frontZ); front.castShadow = front.receiveShadow = true; home.add(front);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(HOUSE.w - 0.02, HOUSE.h, HOUSE.d), [wallMat, wallMat, roofMat, wallMat, wallMat, wallMat]);
    shell.position.set(HOUSE.cx, HOUSE.h / 2, HOUSE.frontZ - HOUSE.d / 2 - 0.02); shell.castShadow = shell.receiveShadow = true; home.add(shell);
    for (const x of [HOUSE.cx - 3.3, HOUSE.cx + 3.3]) hAdd(new THREE.BoxGeometry(0.42, 3.4, 0.42), wallMat, x, 1.7, HOUSE.frontZ + 1.7);   // porch pillars
    hAdd(new THREE.BoxGeometry(HOUSE.w - 1.2, 0.24, 2.0), wallMat, HOUSE.cx, 3.55, HOUSE.frontZ + 1.0);                                      // balcony slab
    hAdd(new THREE.BoxGeometry(HOUSE.w - 1.2, 0.2, 0.26), parapetMat, HOUSE.cx, 4.62, HOUSE.frontZ + 1.95);                                  // balcony rail top
    {   // balcony balusters as a cut-out picture
      const [bc, bg] = makeCanvas(1024, 128); bg.fillStyle = '#f2f0ea'; for (let x = 6; x < 1024; x += 26) bg.fillRect(x, 8, 8, 120); bg.fillRect(0, 0, 1024, 14);
      const bm = new THREE.MeshStandardMaterial({ map: tex(bc, { clamp: true }), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 });
      const bal = new THREE.Mesh(new THREE.PlaneGeometry(HOUSE.w - 1.2, 1.0), bm); bal.position.set(HOUSE.cx, 4.07, HOUSE.frontZ + 1.95); bal.castShadow = true; home.add(bal);
    }
    const roof = roofClutter(HOUSE.w, HOUSE.d, HOUSE.h, 777, false); roof.position.set(HOUSE.cx - HOUSE.w / 2, 0, HOUSE.frontZ); home.add(roof);
    hAdd(new THREE.BoxGeometry(0.34, 0.2, 0.03), new THREE.MeshStandardMaterial({ color: 0x20323a, roughness: 0.5 }), GATE_R, 1.7, WALL_Z + 0.3);   // name plate on the gate pillar
  }

  /* ---------------------------------------------------------------- the truck (the model we already have) */
  const truckRoot = new THREE.Group(); scene.add(truckRoot);
  let truckBody = null;
  {
    const gltf = await new GLTFLoader().loadAsync(`${ASSET}/truck-v3.glb`, (e) => { if (e.total && onProgress) onProgress(e.loaded / e.total); });
    const truck = gltf.scene; let mesh; truck.traverse((o) => { if (o.isMesh) mesh = o; });
    const map = mesh.material.map; map.anisotropy = 16;
    mesh.material = new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0.04, envMapIntensity: 0.7, side: THREE.DoubleSide });
    truck.updateMatrixWorld(true); let bb = new THREE.Box3().setFromObject(truck);
    truck.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); truck.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(truck);
    // the Connext logo on the box sides and roof (same numbers as tools/truck-render)
    const logoTex = new THREE.CanvasTexture((() => { const [c, g] = makeCanvas(logoImg.width * 2, logoImg.height * 2); g.drawImage(logoImg, 0, 0, c.width, c.height); return c; })());
    logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 16;
    const tm = new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false, emissive: 0xffffff, emissiveMap: logoTex, emissiveIntensity: 0.28 });
    const PANEL = { x0: -1.97, x1: 0.31, y0: 0.90, y1: 2.33, zR: 0.823, zL: -0.834 }, ROOF = { cx: -0.775, cz: 0, w: 1.7 };
    const lw = (PANEL.x1 - PANEL.x0) * 0.62, lh = lw * logoRatio;
    truckBody = new THREE.Group(); truckRoot.add(truckBody);
    for (const s of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), tm); m.position.set((PANEL.x0 + PANEL.x1) / 2, (PANEL.y0 + PANEL.y1) / 2, s > 0 ? PANEL.zR + 0.004 : PANEL.zL - 0.004); if (s < 0) m.rotation.y = Math.PI; truckBody.add(m); }
    const rm = new THREE.Mesh(new THREE.PlaneGeometry(ROOF.w, ROOF.w * logoRatio), tm); rm.rotation.x = -Math.PI / 2; rm.position.set(ROOF.cx, bb.max.y + 0.006, ROOF.cz); truckBody.add(rm);
    truckBody.add(truck); shadowize(truck);
  }

  /* ---------------------------------------------------------------- people and street life: standing cut-outs (side views, like the parcel story) */
  const standers = [];
  function stand(file, folder, hM, x, z, flip) {
    const t = PT[`${STORY}/${folder}/${file}.avif`]; if (!t) return;
    const img = t.image, wM = hM * img.width / img.height, lift = 0.15;   // footpath height
    const geo = new THREE.PlaneGeometry(wM, hM); geo.translate(0, hM / 2, 0);
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat); m.position.set(x, lift, z); if (flip) m.scale.x = -1; scene.add(m);
    const blob = new THREE.Mesh(new THREE.CircleGeometry(Math.max(0.5, wM * 0.55), 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.scale.y = 0.45; blob.position.set(x + (flip ? 0.12 : -0.12), lift + 0.01, z + 0.1); scene.add(blob);
    standers.push({ m, blob, mat });
  }
  PEOPLE.forEach(([f, d, h, x, z, flip]) => stand(f, d, h, x, z, flip));
  const fadeStanders = (pitchDeg) => {   // seen from straight above, upright cut-outs would look wrong, so they fade out as the camera climbs
    const k = 1 - smooth((pitchDeg - 38) / 24);
    for (const s of standers) { s.m.visible = k > 0.02; s.mat.opacity = k; }
  };

  /* ---------------------------------------------------------------- cinema effects */
  let composer = null, bokeh = null, bloom = null, film = null;
  if (high) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 }));
    bokeh = new BokehPass(scene, camera, { focus: 6, aperture: 0.002, maxblur: 0.012 });
    bloom = new UnrealBloomPass(new THREE.Vector2(16, 16), 0.14, 0.5, 0.94);
    film = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, vig: { value: 0.28 }, grain: { value: 0.028 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float vig, grain; varying vec2 vUv;
        float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = smoothstep(0.9, 0.25, length(d) * 1.12);
          c.rgb *= mix(1.0 - vig, 1.0, v); c.rgb += (rnd(vUv * vec2(1920.0, 1080.0)) - 0.5) * grain; gl_FragColor = c; }`,
    });
    [new RenderPass(scene, camera), bokeh, bloom, new OutputPass(), film].forEach((p) => composer.addPass(p));
  }

  /* ---------------------------------------------------------------- the flight */
  const lerpKey = (u, i) => { const p = u * (KEYS.length - 1), a = Math.min(KEYS.length - 2, Math.floor(p)), f = p - a; return KEYS[a][i] + (KEYS[a + 1][i] - KEYS[a][i]) * f; };
  const curves = [0, 1].map((i) => new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[i])), false, 'catmullrom', 0.5));
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
  let progress = 0;
  function applyCamera() {
    const u = progressCurve(progress), tx = truckX(u);
    // the truck drives in, slows, stops at the gate; it bobs a little on the road and its nose dips as it brakes
    const speed = u < U_STOP ? Math.max(0, 1 - u / U_STOP) : 0;
    truckRoot.position.set(tx, 0, TRUCK_Z);
    if (truckBody) { truckBody.position.y = Math.sin(u * 420) * 0.012 * speed; truckBody.rotation.z = -0.014 * Math.exp(-Math.pow((u - U_STOP * 0.93) * 18, 2)) + Math.sin(u * 300) * 0.004 * speed; }
    placeSun(tx);
    // the camera travels with the truck, so the street slides past
    curves[0].getPoint(Math.min(1, u), pos); curves[1].getPoint(Math.min(1, u), tgt);
    pos.x += tx; tgt.x += tx;
    if (camera.aspect < 1) {   // a tall screen sees less sideways: start over the street, and at the end centre the handover and look a little higher so the road does not fill the bottom
      const shift = 3.5 * Math.max(0, 1 - u * 4), k = smooth((u - 0.5) / 0.4);
      pos.x += shift - 1.9 * k; tgt.x += shift - 1.9 * k; tgt.y += 1.4 * k;
    }
    camera.position.copy(pos); camera.lookAt(tgt);
    camera.rotateZ(THREE.MathUtils.degToRad(lerpKey(u, 4)));
    let fov = lerpKey(u, 2);
    if (camera.aspect < 1.6) fov = Math.min(62, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * 1.6 / camera.aspect)));   // tall screens: a wider lens keeps the subject in
    camera.fov = fov; camera.updateProjectionMatrix();
    if (bokeh) { bokeh.uniforms.focus.value = camera.position.distanceTo(tgt); bokeh.uniforms.aperture.value = lerpKey(u, 3); }
    const dist = Math.max(0.001, pos.distanceTo(tgt));
    fadeStanders(THREE.MathUtils.radToDeg(Math.asin(Math.min(1, Math.max(0, (pos.y - tgt.y) / dist)))));
  }
  function applyLevel() {
    if (composer) { bokeh.enabled = level < 2; bloom.enabled = level < 3; film.enabled = level < 3; }
    resize();
  }
  function render() { applyCamera(); if (composer) composer.render(); else renderer.render(scene, camera); }
  function resize() {
    const box = canvas.parentElement, w = Math.max(2, box.clientWidth), h = Math.max(2, box.clientHeight), r = pixelRatio();
    renderer.setPixelRatio(r); renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(r); composer.setSize(w, h); bloom.setSize(w, h); }
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();

  return {
    setProgress(p) { progress = Math.min(1, Math.max(0, p)); },
    get progress() { return progress; },
    get level() { return level; },
    /** one step down in quality; returns false when there is nothing left to give up */
    degrade() { if (level >= LEVELS.length - 1) return false; level += 1; applyLevel(); return true; },
    resize, render,
    async still(url, w = 1920, h = 1080) {   // used to make the poster pictures
      renderer.setPixelRatio(1); renderer.setSize(w, h, false); if (composer) { composer.setPixelRatio(1); composer.setSize(w, h); bloom.setSize(w, h); }
      camera.aspect = w / h; camera.updateProjectionMatrix(); render();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      resize(); render();
      const res = await fetch(url, { method: 'POST', body: blob }); return res.ok;
    },
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, quality }),
    dispose() { renderer.dispose(); if (composer) composer.dispose(); },
    renderer,
  };
}
