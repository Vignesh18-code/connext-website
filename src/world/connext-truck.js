/* The Connext truck: the navy box-truck model (public/assets/world/truck-v3.glb, made in tools/truck-render) with the Connext logo
   on both sides and on the roof. Front points along +x, wheels on y = 0, centred on the origin. Same numbers as the descent scene. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ASSET = '/assets/world';
const loadImage = (url) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });

/** @returns {Promise<{ group: THREE.Group, length: number, width: number, height: number }>} */
export async function loadConnextTruck() {
  const [gltf, logoImg] = await Promise.all([new GLTFLoader().loadAsync(`${ASSET}/truck-v3.glb`), loadImage(`${ASSET}/logo-light.png`)]);
  const truck = gltf.scene; let mesh; truck.traverse((o) => { if (o.isMesh) mesh = o; });
  const map = mesh.material.map; map.anisotropy = 8;
  mesh.material = new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0.04, side: THREE.DoubleSide });
  mesh.castShadow = true; mesh.receiveShadow = true;
  truck.updateMatrixWorld(true); let bb = new THREE.Box3().setFromObject(truck);
  truck.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); truck.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(truck);

  const logoRatio = logoImg.height / logoImg.width;
  const canvas = document.createElement('canvas'); canvas.width = logoImg.width * 2; canvas.height = logoImg.height * 2; canvas.getContext('2d').drawImage(logoImg, 0, 0, canvas.width, canvas.height);
  const logoTex = new THREE.CanvasTexture(canvas); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;
  const decal = new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false, emissive: 0xffffff, emissiveMap: logoTex, emissiveIntensity: 0.28 });
  const PANEL = { x0: -1.97, x1: 0.31, y0: 0.90, y1: 2.33, zR: 0.823, zL: -0.834 }, ROOF = { cx: -0.775, cz: 0, w: 1.7 };
  const lw = (PANEL.x1 - PANEL.x0) * 0.62, lh = lw * logoRatio;
  const group = new THREE.Group();
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), decal);
    m.position.set((PANEL.x0 + PANEL.x1) / 2, (PANEL.y0 + PANEL.y1) / 2, side > 0 ? PANEL.zR + 0.004 : PANEL.zL - 0.004); if (side < 0) m.rotation.y = Math.PI; group.add(m);
  }
  const roofLogo = new THREE.Mesh(new THREE.PlaneGeometry(ROOF.w, ROOF.w * logoRatio), decal);
  roofLogo.rotation.x = -Math.PI / 2; roofLogo.position.set(ROOF.cx, bb.max.y + 0.006, ROOF.cz); group.add(roofLogo);
  group.add(truck);
  const size = bb.getSize(new THREE.Vector3());
  return { group, length: size.x, width: size.z, height: size.y };
}
