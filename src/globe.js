// ============================================================================
//  Dot globe — faithful reconstruction of the renderer in
//  united-carriers.netlify.app/chunks/my-flights-*.js  (three.js, no R3F)
//
//  Public API (same shape as theirs):
//    const g = createDotGlobe(canvasEl, opts)
//    g.update({ phi, deltaTime })   // call every frame
//    g.resize(w, h)
//    g.setLabelsVisible(bool)
//    g.isInteracting() -> bool
//    g.destroy()
// ============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import * as topojson from 'topojson-client';
import { EDGE_WORKER_SRC, FILL_WORKER_SRC, runWorker } from './workers.js';
import { OPTS as DEFAULTS } from './data.js';

const LAND_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json';

// their D(lat, lng, r) — lat/lng in DEGREES, returns a point on a sphere of radius r
function lonLatToVec3(lat, lng, r = 1) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

// ---- round soft dot sprite (their n(64)) -----------------------------------
function makeDotTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const a = size / 2;
  const g = ctx.createRadialGradient(a, a, 0.82 * a, a, a, a);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(a, a, a - 0.5, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// ---- soft halo sprite (their tt(64)) -------------------------------------
function makeHaloTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.4)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// Piecewise-linear coastline: [[lat, lng], ...] -> lng at a latitude.
function makeCoast(knots) {
  return (lat) => {
    if (lat <= knots[0][0]) return knots[0][1];
    for (let i = 1; i < knots.length; i++) {
      const [a1, b1] = knots[i];
      if (lat <= a1) {
        const [a0, b0] = knots[i - 1];
        return b0 + ((b1 - b0) * (lat - a0)) / (a1 - a0);
      }
    }
    return knots[knots.length - 1][1];
  };
}

// 'strip' projection (see scripts/build-chennai-map.py): a coastal strip is
// wrapped all the way round the globe. Latitude runs round the globe's X
// axis (a full 360 degrees over `latRange`), so the globe rolls top-to-bottom
// with north up; distance from the smoothed coastline runs across, with the
// shore at `coastBeta` degrees right of centre.
function makeStripProjection(proj) {
  const [s0, s1] = proj.latRange;
  const k = 360 / (s1 - s0);
  const cosC = Math.cos(proj.centreLat * Math.PI / 180);
  const coastAt = makeCoast(proj.coast);
  const D = Math.PI / 180;
  return (lat, lng, r = 1) => {
    const a = (lat - proj.centreLat) * k * D;
    const b = (proj.coastBeta + (lng - coastAt(lat)) * cosC * k) * D;
    return new THREE.Vector3(Math.sin(b), Math.cos(b) * Math.sin(a), Math.cos(b) * Math.cos(a))
      .multiplyScalar(r);
  };
}

// 'wrap' projection (see scripts/build-chennai-map.py): a long, thin city
// laid along the equator. Going north becomes going round the globe (a full
// 360 degrees over `latRange`, so the globe spins round Y like the world
// globe); distance inland from the smoothed shore becomes height, with the
// shore at `coastLat`.
function makeWrapProjection(proj) {
  const cosC = Math.cos(proj.centreLat * Math.PI / 180);
  const coastAt = makeCoast(proj.coast);
  return (lat, lng, r = 1) => lonLatToVec3(
    proj.coastLat + (coastAt(lat) - lng) * cosC * proj.kAcross,
    proj.lng0 + (lat - proj.centreLat) * proj.kAlong,
    r,
  );
}

// Optional magnification for maps far smaller than a hemisphere (a single
// city). Offsets from `centre` (in degrees, longitude scaled by cos(lat)) are
// multiplied by `scale` and laid out as an azimuthal-equidistant projection
// around `target`: distance from the centre becomes arc length on the globe,
// so the enlarged map wraps round the sphere evenly right out to its edge
// (and past the poles) instead of stretching like a flat lat/lng scale.
// `type: 'strip'` uses makeStripProjection instead. Without a projection,
// lat/lng are used as-is.
function makeProjection(proj) {
  if (!proj) return (lat, lng, r = 1) => lonLatToVec3(lat, lng, r);
  if (proj.type === 'strip') return makeStripProjection(proj);
  if (proj.type === 'wrap') return makeWrapProjection(proj);
  const [c0, c1] = proj.centre;
  const [t0, t1] = proj.target || proj.centre;
  const k = proj.scale;
  const cosC = Math.cos(c0 * Math.PI / 180);
  const T = lonLatToVec3(t0, t1);
  const local = (v) => v.sub(T).addScaledVector(T, -v.dot(T)).normalize();
  const N = local(lonLatToVec3(t0 + 0.01, t1));   // north at the target
  const E = local(lonLatToVec3(t0, t1 + 0.01));   // east at the target
  return (lat, lng, r = 1) => {
    const dx = (lng - c1) * cosC;
    const dy = lat - c0;
    const d = Math.hypot(dx, dy);
    if (d === 0) return T.clone().multiplyScalar(r);
    const rho = (d * k * Math.PI) / 180;
    return T.clone().multiplyScalar(Math.cos(rho))
      .addScaledVector(E, (Math.sin(rho) * dx) / d)
      .addScaledVector(N, (Math.sin(rho) * dy) / d)
      .multiplyScalar(r);
  };
}

// their P(color, size, backOpacity, map, killBack) -> PointsMaterial + shader patch
// Dots are lit like a sphere — brightest facing a light up and to the left
// of the camera and fading toward the rim — so whatever map is drawn reads
// as wrapped round a ball rather than flat. `shading` 0 turns it off.
const LIGHT_DIR = new THREE.Vector3(-0.35, 0.45, 1).normalize();

function makeDotMaterial(color, size, backOpacity, map, killBack, shading = 0) {
  const m = new THREE.PointsMaterial({
    color: new THREE.Color(color),
    size,
    sizeAttenuation: true,
    depthWrite: false,
    transparent: true,
    map,
    alphaTest: 0,
    opacity: 1,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCamPos = { value: new THREE.Vector3() };
    shader.uniforms.uBackOpacity = { value: backOpacity };
    shader.uniforms.uLightDir = { value: LIGHT_DIR };
    shader.uniforms.uShade = { value: shading };
    shader.defines = shader.defines || {};
    if (killBack) shader.defines.KILL_BACK = 1;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        '#include <common>\nvarying vec3 vWorldPos;\nvarying float vShade;\n' +
        'uniform vec3 uCamPos;\nuniform vec3 uLightDir;\nuniform float uShade;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvWorldPos = (modelMatrix * vec4(transformed,1.0)).xyz;')
      .replace('#include <project_vertex>',
        '#include <project_vertex>\n' +
        'float ndv = dot(normalize(uCamPos - vWorldPos), normalize(vWorldPos));\n' +
        'gl_PointSize *= mix(0.6, 1.0, smoothstep(0.0, 0.25, ndv));\n' +
        'float lit = clamp(dot(normalize(vWorldPos), uLightDir), 0.0, 1.0);\n' +
        'float rim = smoothstep(-0.02, 0.6, ndv);\n' +
        'vShade = mix(1.0, rim * mix(0.35, 1.0, lit), uShade);\n' +
        // fade out right at the horizon so no dot pokes past the glowing rim
        'vShade *= smoothstep(0.0, 0.14, ndv);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vShade;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vShade;');

    // The reference's r184 renderer has no output_fragment chunk: its
    // attempted fragment culling is a no-op. Match the visible result by
    // relying on the 0.99-radius depth sphere, including the thin horizon dots.

    m.userData.shader = shader;
  };
  return m;
}

// Lines drawn on the sphere (city outline, zone / ward borders) fade out as
// they turn toward the horizon. Without this they stay at full strength right
// up to the limb and stick out past the glowing rim, so the globe's edge
// looks broken. Works in view space: the globe is centred on its group.
function fadeAtLimb(material, from = 0.06, to = 0.32) {
  material.transparent = true;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLimb;')
      .replace('#include <project_vertex>',
        '#include <project_vertex>\n' +
        'vLimb = dot(normalize(normalMatrix * normalize(position)), normalize(-mvPosition.xyz));');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLimb;')
      .replace('#include <color_fragment>',
        `#include <color_fragment>\ndiffuseColor.a *= smoothstep(${from.toFixed(3)}, ${to.toFixed(3)}, vLimb);`);
  };
  return material;
}

// GeoJSON-style polygon coordinates ([[ring], [hole], ...] of [lng, lat]) ->
// { polygons (flat rings for the edge worker), geoPolygons (for the fill worker) }
function toWorkerInput(polygonCoords) {
  const polygons = [];
  const geoPolygons = [];
  const flattenRing = (ring) => {
    const f = new Float32Array(2 * (ring.length + 1));
    let k = 0;
    for (let i = 0; i < ring.length; i++) { f[k++] = ring[i][0]; f[k++] = ring[i][1]; }
    f[k++] = ring[0][0]; f[k++] = ring[0][1];
    return f;
  };
  for (const coords of polygonCoords) {
    polygons.push(coords.map(flattenRing));
    geoPolygons.push({ type: 'Polygon', coordinates: coords });
  }
  return { polygons, geoPolygons };
}

// decode world-atlas topojson -> worker input
function decodeLand(topo) {
  const obj = topo.objects.land;
  const feat = topojson.feature(topo, obj);
  const geoms = feat.type === 'FeatureCollection'
    ? feat.features.map((f) => f.geometry)
    : [feat.geometry];
  const coords = [];
  for (const g of geoms) {
    if (!g) continue;
    if (g.type === 'Polygon') coords.push(g.coordinates);
    else if (g.type === 'MultiPolygon') coords.push(...g.coordinates);
  }
  return toWorkerInput(coords);
}

// ============================================================================
export function createDotGlobe(canvas, userOpts = {}) {
  const O = { ...DEFAULTS, ...userOpts };
  let disposed = false;
  const toVec3 = makeProjection(O.mapProjection);

  // ---- renderer (their exact flags) --------------------------------------
  // The reference caps DPR by canvas width, including narrow desktop globes.
  const dprCap = canvas.clientWidth < 768 ? 1.5 : 2;
  // the India framing makes the canvas far larger than the viewport; cap the
  // drawing buffer so a 190vh globe doesn't render ~3400px squares at 2x
  const MAX_BUFFER = 2600;
  const pixelRatio = (w) => Math.min(window.devicePixelRatio || 1, dprCap, MAX_BUFFER / Math.max(1, w));
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: false, powerPreference: 'low-power',
  });
  renderer.setPixelRatio(pixelRatio(canvas.clientWidth || canvas.parentElement?.clientWidth || 800));
  renderer.setClearColor(0x000000, 0);

  // fall back to the wrapper / viewport box while the canvas has no layout yet
  const W = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerHeight || 800;
  const H = canvas.clientHeight || canvas.parentElement?.clientHeight || W;
  renderer.setSize(W, H, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
  camera.position.set(0, 0, O.cameraZ);

  // ---- CSS2D label renderer (overlay) -----------------------------------
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(W, H);
  Object.assign(labelRenderer.domElement.style, {
    position: 'absolute', top: '0', left: '0', pointerEvents: 'none',
  });
  canvas.parentNode.appendChild(labelRenderer.domElement);

  // ---- controls (rotate only) -----------------------------------------
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enabled = O.enableControls;

  let interacting = false;
  canvas.style.cursor = O.enableControls ? 'grab' : 'default';
  controls.addEventListener('start', () => { interacting = true; canvas.style.cursor = 'grabbing'; });
  controls.addEventListener('end', () => { interacting = false; canvas.style.cursor = O.enableControls ? 'grab' : 'default'; });

  // ---- globe group ----------------------------------------------------
  const globe = new THREE.Group();
  globe.position.set(O.globeOffsetX, O.globeOffsetY, 0);
  globe.scale.setScalar(O.globeScale);
  globe.rotation.x = O.globeRotationX;
  globe.rotation.z = O.globeRotationZ;
  scene.add(globe);

  // Geographic borders share the pins' projection and rotate with the city.
  // Fine wards sit beneath the brighter administrative zone outlines, and the
  // city outline traces the full Chennai shape the dots are built from.
  const boundaries = new THREE.Group();
  globe.add(boundaries);

  // Connect neighbouring edge-dot samples into one stroke, lifted just off
  // the sphere so it reads as the outer border of the dotted city.
  function traceCityEdge(flat) {
    const vertices = [];
    const lift = 1.012;
    let px = 0, py = 0, pz = 0;
    for (let i = 0; i < flat.length; i += 3) {
      const x = flat[i], y = flat[i + 1], z = flat[i + 2];
      if (i > 0) {
        const d = Math.hypot(x - px, y - py, z - pz);
        if (d > 0.0001 && d < 0.05) {
          vertices.push(px * lift, py * lift, pz * lift, x * lift, y * lift, z * lift);
        }
      }
      px = x; py = y; pz = z;
    }
    if (!vertices.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    boundaries.add(new THREE.LineSegments(geometry, fadeAtLimb(new THREE.LineBasicMaterial({
      color: '#f4fff8', transparent: true, opacity: 1, depthWrite: false,
    }))));
  }
  if (O.boundaryMap) {
    fetch(O.boundaryMap).then((response) => {
      if (!response.ok) throw new Error('boundary fetch failed');
      return response.json();
    }).then((data) => {
      if (disposed) return;
      for (const [name, opacity, color] of [['wards', 0.19, '#69cbae'], ['zones', 0.7, '#b6ffe0']]) {
        const vertices = [];
        const seen = new Set();
        for (const ring of data.layers[name] || []) {
          for (let i = 1; i < ring.length; i++) {
            const a = ring[i - 1], b = ring[i];
            const key = [a.join(','), b.join(',')].sort().join('|');
            if (seen.has(key)) continue;
            seen.add(key);
            // Subdivide before projection so each edge hugs the curved surface.
            const steps = Math.max(1, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1]) / 0.001));
            for (let j = 0; j < steps; j++) {
              const t0 = j / steps, t1 = (j+1) / steps;
              const lat0 = a[1] + (b[1]-a[1])*t0, lat1 = a[1] + (b[1]-a[1])*t1;
              if (O.mapProjection?.latRange && (Math.min(lat0, lat1) < O.mapProjection.latRange[0] || Math.max(lat0, lat1) > O.mapProjection.latRange[1])) continue;
              for (const t of [t0, t1]) {
                const v = toVec3(a[1]+(b[1]-a[1])*t, a[0]+(b[0]-a[0])*t, 1.001);
                vertices.push(v.x, v.y, v.z);
              }
            }
          }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        boundaries.add(new THREE.LineSegments(geometry, fadeAtLimb(new THREE.LineBasicMaterial({
          color, opacity, transparent: true, depthWrite: false,
        }))));
      }
    }).catch((error) => console.error('[globe] borders:', error));
  }

  // Match the reference's depth sphere so routes disappear at the horizon.
  const occluder = new THREE.Mesh(
    new THREE.SphereGeometry(0.99, 32, 32),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }),
  );
  occluder.renderOrder = -1;
  globe.add(occluder);

  const dotMaterials = [];
  const st = { uTime: { value: 3.8 } };
  let phi = O.initialPhi;

  // ---- pins + labels --------------------------------------------------
  const haloTex = makeHaloTexture(64);
  const pinGeo = new THREE.CylinderGeometry(O.pinSize, O.pinSize, O.pinAltitude, 12, 1, false);
  pinGeo.rotateX(Math.PI / 2);
  pinGeo.translate(0, 0, O.pinAltitude / 2);
  const pinMat = new THREE.MeshBasicMaterial({ color: O.pinDotColor });
  const haloMat = new THREE.SpriteMaterial({
    color: O.pinDotColor, map: haloTex, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  // a strip projection only covers `latRange`; anything outside it would
  // wrap round to the wrong side of the globe
  const inMap = (lat) => !O.mapProjection?.latRange
    || (lat >= O.mapProjection.latRange[0] && lat <= O.mapProjection.latRange[1]);

  const pins = [];
  for (const ap of (O.airportsData?.airports || [])) {
    if (!inMap(parseFloat(ap.lat))) continue;
    const grp = new THREE.Group();
    grp.userData.airport = ap;
    const pos = toVec3(parseFloat(ap.lat), parseFloat(ap.lng), 1.002);
    grp.position.copy(pos);
    grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize());

    const dot = new THREE.Mesh(pinGeo, pinMat);
    const s = ap.size || 1;
    dot.scale.set(s, s, 1);
    grp.add(dot);

    const halo = new THREE.Sprite(haloMat);
    const hs = O.pinSize * O.haloScale * s;
    halo.scale.set(hs, hs, 1);
    grp.add(halo);

    const el = document.createElement('div');
    el.className = ['globe-label', ap.align && `is-${ap.align}`, ap.minor && 'is-minor'].filter(Boolean).join(' ');
    const inner = document.createElement('div');
    inner.className = 'globe-label-text';
    inner.textContent = ap.country || 'N/A';
    el.appendChild(inner);
    const label = new CSS2DObject(el);
    grp.add(label);
    grp.userData.labelObject = label;
    grp.userData.labelVisible = null;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1, 32),
      new THREE.MeshBasicMaterial({
        color: O.pinDotColor, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    ring.userData = { offset: Math.random() };
    grp.add(ring);
    grp.userData.ringMesh = ring;

    globe.add(grp);
    pins.push(grp);
  }

  // ---- text-only labels (sea names) ------------------------------------
  const tags = [];
  for (const t of (O.seaLabels || [])) {
    if (!inMap(t.lat)) continue;
    const el = document.createElement('div');
    el.className = 'globe-sea-label';
    el.textContent = t.text;
    const obj = new CSS2DObject(el);
    obj.position.copy(toVec3(t.lat, t.lng, 1.0));
    obj.userData.visible = null;
    globe.add(obj);
    tags.push(obj);
  }

  // ---- arcs ---------------------------------------------------------
  const arcs = [];
  const arcMat = new THREE.MeshBasicMaterial({
    color: O.arcColor, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  arcMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = st.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        '#include <common>\n attribute float aOffset;\n varying float vProgress;\n varying float vOffset;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\n vProgress = uv.x;\n vOffset = aOffset;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\n varying float vProgress;\n varying float vOffset;\n uniform float uTime;')
      .replace('#include <color_fragment>',
        '#include <color_fragment>\n' +
        'float pr = mod(uTime * 2.0 + vOffset, 2.5);\n' +
        'float st = clamp(pr - 1.0, 0.0, 1.0);\n' +
        'float en = clamp(pr, 0.0, 1.0);\n' +
        'if (vProgress < st || vProgress > en) discard;\n' +
        'diffuseColor.a *= smoothstep(st, en + 0.001, vProgress);');
  };

  if (O.showArcs && O.flightsData?.flights) {
    O.flightsData.flights.forEach((fl, idx) => {
      if (!fl.status || !inMap(fl.startLat) || !inMap(fl.endLat)) return;
      const a = toVec3(fl.startLat, fl.startLng, 1.002);
      const b = toVec3(fl.endLat, fl.endLng, 1.002);
      const dist = a.distanceTo(b);
      if (O.maxArcLength && dist > O.maxArcLength) return;
      const lift = O.arcAltBase + Math.min(0.5, dist * O.arcAltMultiplier);
      const pts = [];
      for (let t = 0; t <= 32; t++) {
        const e = t / 32;
        const p = a.clone().lerp(b, e).normalize();
        p.multiplyScalar(1.002 + 4 * lift * e * (1 - e));
        pts.push(p);
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 32, O.arcThickness, 4, false);
      const count = geo.attributes.position.count;
      const off = new Float32Array(count);
      const h = (0.6180339887 * idx) % 1;
      off.fill(2.5 * h);
      geo.setAttribute('aOffset', new THREE.BufferAttribute(off, 1));
      const mesh = new THREE.Mesh(geo, arcMat);
      globe.add(mesh);
      arcs.push(mesh);
    });
  }

  // arcs arriving at each pin (drives the pulse ring)
  const arrivingIndex = (O.flightsData?.flights || [])
    .map((f, e) => f.status ? ({
      to: [f.endLat, f.endLng],
      offset: (0.6180339887 * e) % 1,
      delay: Math.min(0.08, (toVec3(f.startLat, f.startLng).distanceTo(toVec3(f.endLat, f.endLng)) / 1.5) * 0.08),
    }) : null).filter(Boolean);
  for (const pin of pins) {
    const ap = pin.userData.airport;
    pin.userData.arrivingArcs = arrivingIndex.filter(
      (arc) => Math.abs(arc.to[0] - parseFloat(ap.lat)) < 0.00001
            && Math.abs(arc.to[1] - parseFloat(ap.lng)) < 0.00001,
    );
  }

  // ---- land dots (async, off-thread) -------------------------------
  const dotTex = makeDotTexture(64);

  // land polygons (lng/lat on the globe) -> the world globe's dots: edge dots
  // along every outline plus an even fill grid, via the two workers
  const buildLandDots = async ({ polygons, geoPolygons }) => {
    const edgeMat = makeDotMaterial(O.edgeColor, O.pointSize, O.backOpacity, dotTex, O.killBack, O.dotShading);
    const fillMat = makeDotMaterial(O.fillColor, Math.max(0.75 * O.pointSize, 0.003), O.backOpacity, dotTex, O.killBack, O.dotShading);
    dotMaterials.push(edgeMat, fillMat);

    const [edge, fill] = await Promise.all([
      runWorker(EDGE_WORKER_SRC, { densityDeg: O.tileDeg, polysIn: polygons }),
      runWorker(FILL_WORKER_SRC, { tileDeg: O.tileDeg, geos: geoPolygons }),
    ]);
    if (disposed) return;

    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(edge.edge, 3));
    globe.add(new THREE.Points(eg, edgeMat));
    // The edge dots are the full city perimeter. Stroke that same path so the
    // border covers the whole place, including the outer side past the zones.
    if (O.map) traceCityEdge(edge.edge);

    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fill.fill, 3));
    globe.add(new THREE.Points(fg, fillMat));
  };

  // single-country mode: pre-baked [lat, lng] dot layers (outline, fill,
  // state borders, rivers, ocean) instead of the world land polygons
  const loadMap = async () => {
    const data = await fetch(O.map).then((r) => {
      if (!r.ok) throw new Error('map fetch failed');
      return r.json();
    });
    if (disposed) return;
    // a map given as land outlines (already on the globe) gets the world
    // globe's own dots
    if (data.land) await buildLandDots(toWorkerInput(data.land));
    if (disposed) return;
    const scale = data.scale || 1;
    const [o0, o1] = data.origin || [0, 0];
    const layers = {};
    for (const [name, flat] of Object.entries(data.layers || {})) {
      const pts = [];
      for (let i = 0; i < flat.length; i += 2) pts.push(o0 + flat[i] / scale, o1 + flat[i + 1] / scale);
      layers[name] = pts;
    }
    // optional compact background grid: one character per cell, mapped to a
    // layer name by `codes` (see scripts/build-chennai-map.py)
    if (data.grid?.kind === 'strip') {
      // rows run along the coast, columns across it (distance from shore)
      const { lat0, dlat, vmin, dv, codes, rows } = data.grid;
      const coastAt = makeCoast(O.mapProjection.coast);
      const cosC = Math.cos(O.mapProjection.centreLat * Math.PI / 180);
      rows.forEach((row, j) => {
        const lat = lat0 + (j + 0.5) * dlat;
        const shore = coastAt(lat);
        for (let i = 0; i < row.length; i++) {
          const name = codes[row[i]];
          if (!name) continue;
          const v = vmin + (i + (j % 2 ? 0.5 : 0)) * dv;
          (layers[name] ||= []).push(lat, shore + v / cosC);
        }
      });
    } else if (data.grid) {
      const { centre: [g0, g1], step, n, codes, rows } = data.grid;
      const cosG = Math.cos(g0 * Math.PI / 180);
      rows.forEach((row, jj) => {
        const j = jj - n;
        for (let ii = 0; ii < row.length; ii++) {
          const name = codes[row[ii]];
          if (!name) continue;
          const u = ii - n + (j % 2 ? 0.5 : 0);
          (layers[name] ||= []).push(g0 + j * step, g1 + (u * step) / cosG);
        }
      });
    }
    for (const layer of O.mapLayers) {
      const flat = layers[layer.name];
      if (!flat || !flat.length) continue;
      const pos = new Float32Array((flat.length / 2) * 3);
      // 'globe' maps are already laid out on the sphere; others are real lat/lng
      const place = data.space === 'globe' ? lonLatToVec3 : toVec3;
      for (let i = 0, k = 0; i < flat.length; i += 2) {
        const v = place(flat[i], flat[i + 1], 1);
        pos[k++] = v.x; pos[k++] = v.y; pos[k++] = v.z;
      }
      const mat = makeDotMaterial(layer.color, layer.size, O.backOpacity, dotTex, O.killBack, O.dotShading);
      mat.opacity = layer.opacity ?? 1;
      dotMaterials.push(mat);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      globe.add(new THREE.Points(geo, mat));
    }
  };

  (async () => {
    try {
      if (O.map) { await loadMap(); return; }
      const topo = await fetch(LAND_URL, { cache: 'force-cache' }).then((r) => {
        if (!r.ok) throw new Error('land fetch failed');
        return r.json();
      });
      if (disposed) return;
      await buildLandDots(decodeLand(topo));
    } catch (err) {
      console.error('[globe] dot build failed:', err);
    }
  })();

  // ---- per-frame update (their update({phi, deltaTime})) -----------
  const _c = new THREE.Vector3();     // globe centre
  const _l = new THREE.Vector3();     // pin world pos
  const _d = new THREE.Vector3();     // pin normal
  const _v = new THREE.Vector3();     // pin -> camera
  let labelsHidden = false;
  let cullFrame = 0;
  let pulseClock = 0;
  const PULSE_MS = 2200;
  // major places claim space first, then the rest in data order
  const pinsByPriority = [...pins].sort((a, b) =>
    (a.userData.airport.minor ? 1 : 0) - (b.userData.airport.minor ? 1 : 0));

  function setPinLabel(pin, show) {
    const lbl = pin.userData.labelObject;
    if (!lbl || pin.userData.labelVisible === show) return;
    pin.userData.labelVisible = show;
    lbl.element.style.opacity = show ? '1' : '0';
    lbl.element.style.filter = show ? 'blur(0px)' : 'blur(4px)';
  }

  // Keep each name chip fully inside the banner so the border and the
  // place name are not sliced off at the right edge of the globe.
  function fitNameChip(pin) {
    const text = pin.userData.labelObject.element.firstChild;
    const align = pin.userData.airport.align;
    const ax = align === 'left' ? -0.45 : align === 'right' ? 0.45 : 0;
    text.style.transform = ax ? `translateX(${ax * 100}%)` : '';
    const hero = text.closest('.home-hero');
    const r = text.getBoundingClientRect();
    if (!hero || !r.width) return r;
    const b = hero.getBoundingClientRect();
    const pad = 14;
    let dx = 0;
    let dy = 0;
    if (r.right > b.right - pad) dx = (b.right - pad) - r.right;
    if (r.left + dx < b.left + pad) dx += (b.left + pad) - (r.left + dx);
    if (r.bottom > b.bottom - pad) dy = (b.bottom - pad) - r.bottom;
    if (r.top + dy < b.top + pad) dy += (b.top + pad) - (r.top + dy);
    const x = ax * r.width + dx;
    if (dx || dy) text.style.transform = `translate(${x}px, ${dy}px)`;
    return text.getBoundingClientRect();
  }

  function cullLabels() {
    const placed = [];
    for (const pin of pinsByPriority) {
      const lbl = pin.userData.labelObject;
      if (!lbl) continue;
      let show = !!pin.userData.facing;
      if (show) {
        const r = fitNameChip(pin);
        if (!r.width) show = false;            // hidden by CSS (e.g. on phones)
        else {
          const box = [r.left - 4, r.top - 3, r.right + 4, r.bottom + 3];
          show = !placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
          if (show) placed.push(box);
        }
      }
      setPinLabel(pin, show);
    }
  }

  function update({ phi: extPhi, deltaTime = 0 } = {}) {
    if (disposed) return;
    const k = Number.isFinite(deltaTime) ? deltaTime / 16.666 : 0;
    st.uTime.value += (O.routeSpeed ?? O.autoSpeed) * k;
    pulseClock += Number.isFinite(deltaTime) ? deltaTime : 0;
    if (extPhi !== undefined) {
      phi = extPhi;
      // 'x': roll top-to-bottom (the Chennai strip); default: spin round Y
      if (O.spinAxis === 'x') globe.rotation.x = phi;
      else globe.rotation.y = phi;
    }

    globe.getWorldPosition(_c);

    for (const pin of pins) {
      // --- pulse ring when an arc "arrives" ---
      const ring = pin.userData.ringMesh;
      const inbound = pin.userData.arrivingArcs;
      if (ring && inbound && inbound.length) {
        let best = 0, prog = 0;
        for (const arc of inbound) {
          let e = (2 * st.uTime.value + 2.5 * arc.offset) % 2.5;
          if (e < 0) e += 2.5;
          const r = 1 + arc.delay - 0.05;
          if (e >= r && e <= r + 0.5) {
            const tt = (e - r) / 0.5;
            const o = 1 - Math.pow(1 - tt, 3);
            const amp = 0.02 * o;
            if (amp > best) { best = amp; prog = o; }
          }
        }
        if (best > 0) {
          const sc = 0.02 + best;
          ring.scale.set(sc, sc, 1);
          ring.material.opacity = 1 - prog;
        } else {
          ring.material.opacity = 0;
        }
      } else if (ring && pin.userData.airport.pulse) {
        // a marked place (`pulse: true`) beacons on its own: a ring that
        // grows and fades every PULSE_MS
        const t = (pulseClock % PULSE_MS) / PULSE_MS;
        const o = 1 - Math.pow(1 - t, 3);
        const sc = 0.012 + 0.045 * o;
        ring.scale.set(sc, sc, 1);
        ring.material.opacity = 0.9 * (1 - t);
      }

      // --- label fade / de-blur when facing the camera ---
      if (!labelsHidden) {
        pin.getWorldPosition(_l);
        _d.subVectors(_l, _c).normalize();
        _v.subVectors(camera.position, _l).normalize();
        pin.userData.facing = _d.dot(_v) > O.labelFacing;
        if (pin.userData.facing) fitNameChip(pin);
        // turning away hides at once; showing waits for the overlap check
        if (!pin.userData.facing) setPinLabel(pin, false);
      }
    }
    // dense maps: every few frames, drop labels that would overlap one with
    // higher priority (major places first), so names never pile up
    if (!labelsHidden && ++cullFrame % 6 === 1) cullLabels();

    for (const tag of tags) {
      tag.getWorldPosition(_l);
      _d.subVectors(_l, _c).normalize();
      _v.subVectors(camera.position, _l).normalize();
      const facing = !labelsHidden && _d.dot(_v) > Math.max(0.15, O.labelFacing ?? 0);
      if (tag.userData.visible !== facing) {
        tag.userData.visible = facing;
        tag.element.style.opacity = facing ? '1' : '0';
      }
    }

    for (const m of dotMaterials) {
      if (m.userData.shader) m.userData.shader.uniforms.uCamPos.value.copy(camera.position);
    }

    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  function resize(w = canvas.clientWidth, h = canvas.clientHeight) {
    if (disposed) return;
    const cw = Math.max(1, Math.round(w || canvas.offsetWidth || 1));
    const ch = Math.max(1, Math.round(h || canvas.offsetHeight || cw));
    renderer.setPixelRatio(pixelRatio(cw));
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    labelRenderer.setSize(cw, ch);
  }

  function setLabelsVisible(v) {
    labelsHidden = !v;
    for (const pin of pins) {
      const lbl = pin.userData.labelObject;
      if (!lbl) continue;
      if (v) { pin.userData.labelVisible = null; }
      else {
        pin.userData.labelVisible = false;
        lbl.element.style.opacity = '0';
      }
    }
  }

  function destroy() {
    disposed = true;
    controls.dispose();
    renderer.dispose();
    labelRenderer.domElement.remove();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.());
    });
    for (const pin of pins) pin.userData.labelObject?.element?.remove();
    for (const tag of tags) tag.element.remove();
  }

  const api = {
    update, resize, setLabelsVisible, destroy,
    setBoundariesVisible: (visible) => { boundaries.visible = visible; },
    isInteracting: () => interacting,
    get phi() { return phi; },
    set phi(v) { phi = v; },
    camera, controls, scene, globe,
    _dotMaterials: dotMaterials,
    _renderer: renderer,
  };
  if (typeof window !== 'undefined') window.__globe = api;
  return api;
}
