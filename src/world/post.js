/* Finishing for the streets scene: ambient occlusion (the soft darkening where walls meet the ground, between close buildings and
   under vehicles), true-to-life tone mapping, and a light colour grade (cool shadows, warm highlights, a touch more contrast and
   saturation, a soft vignette). One composer for all quality levels; ambient occlusion is switched off on weak devices. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GRADE = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.32 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float vignette; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;                       // already tone mapped, in sRGB
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c += vec3(-0.010, 0.002, 0.018) * (1.0 - smoothstep(0.0, 0.5, l));   // cool, slightly teal shadows
      c += vec3(0.022, 0.010, -0.014) * smoothstep(0.45, 1.0, l);          // warm highlights
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);                           // gentle S-curve
      c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, 1.08);        // a little more colour
      vec2 q = vUv - 0.5; c *= 1.0 - vignette * dot(q, q) * 1.5;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

const AO_SCALE = 0.5;   // ambient occlusion is soft by nature, so it is computed at half the picture size: far cheaper, hardly different

/** @param skip  objects the occlusion pass does not need to see (vehicles, signs): leaving them out of its depth pass saves a lot of drawing */
export function createPost({ renderer, scene, camera, ao = true, skip = [] }) {
  const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
  const target = new THREE.WebGLRenderTarget(Math.max(2, size.x * pr), Math.max(2, size.y * pr), { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(pr); composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (ao) {
    gtao = new GTAOPass(scene, camera, Math.round(size.x * pr * AO_SCALE), Math.round(size.y * pr * AO_SCALE));
    gtao.blendIntensity = 1.0;
    gtao.updateGtaoMaterial({ radius: 3, distanceExponent: 1.4, thickness: 4, scale: 1.2, samples: 10, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 10 });
    const hideForDepth = gtao.overrideVisibility.bind(gtao);   // the pass puts everything back from its own cache afterwards
    gtao.overrideVisibility = () => { hideForDepth(); for (const o of skip) o.visible = false; };
    composer.addPass(gtao);
  }
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GRADE); composer.addPass(grade);
  return {
    get hasAO() { return !!gtao; },
    setSamples(n) { target.samples = n; composer.renderTarget1.samples = n; composer.renderTarget2.samples = n; composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); },
    debugOutput(mode) { if (gtao) gtao.output = mode; },   // for checking: 0 normal, 2 depth, 3 normals, 4 AO, 5 denoised AO
    setAO(on) { if (gtao) gtao.enabled = !!on; },
    /** ambient occlusion reaches this many metres: wide when the camera is high, tight when it is low */
    setReach(metres) { if (gtao) gtao.updateGtaoMaterial({ radius: metres }); },
    setSize(w, h, pixelRatio) { composer.setPixelRatio(pixelRatio); composer.setSize(w, h); if (gtao) gtao.setSize(Math.round(w * pixelRatio * AO_SCALE), Math.round(h * pixelRatio * AO_SCALE)); },
    render(dt) { composer.render(dt); },
    dispose() { composer.dispose(); target.dispose(); },
  };
}
