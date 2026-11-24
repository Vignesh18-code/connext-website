// Ship, water, and cloud choreography share the same scroll-driven camera scale.
import { gsap, rem, isMobile } from '../reveal.js';
import { SILK, SMOOTH } from '../eases.js';

const vh = (n) => (window.innerHeight * n) / 100;
const vw = (n) => (window.innerWidth * n) / 100;

export function initWhy() {
  const root = document.querySelector('.home-why-wrap');
  if (!root) return;

  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => [...root.querySelectorAll(sel)];

  const ocean = mountOcean(q('.home-why-ocean'));
  shipBob(qa, ocean);
  if (!isMobile()) pullBack(root, q, qa, ocean);
  else gsap.timeline({ scrollTrigger: {
    trigger: root, start: 'top+=100vh top', endTrigger: q('.home-why'), end: 'bottom bottom', scrub: true,
  }})
    .fromTo(q('.home-why-ship-img'), { scale: 1 }, { scale: .18, ease: 'power1.inOut', duration: 1.05 }, 0)
    .fromTo(q('.home-why-ocean-img img'), { scale: 1 / .18 }, { scale: 1, ease: 'power1.inOut', duration: 1.05 }, 0);
}

/** A slow figure-of-eight so the vessel never sits perfectly still. */
function shipBob(qa, ocean) {
  const layers = qa('.home-why-ship-img-inner');
  if (!layers.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.set(layers, { force3D: true });
  const lead = layers[0];
  const state = { xPercent: 0, yPercent: 0 };

  // drive every layer off the leading one's pixel offset, so the drop-shadow
  // plate and the deck stay locked together at different intrinsic sizes
  const apply = () => {
    const x = ((lead.offsetWidth || 1) * state.xPercent) / 100;
    const y = ((lead.offsetHeight || 1) * state.yPercent) / 100;
    layers.forEach((layer) => {
      gsap.set(layer, {
        xPercent: (x / (layer.offsetWidth || 1)) * 100,
        yPercent: (y / (layer.offsetHeight || 1)) * 100,
        force3D: true,
      });
    });
  };

  gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut' } })
    .to(state, { xPercent: 0.6, yPercent: -1.2, duration: 2.4, onUpdate: apply })
    .to(state, { xPercent: -0.45, yPercent: 2, duration: 2.7, onUpdate: apply });
}

function pullBack(root, q, qa, ocean) {
  const wide = window.innerWidth > 991;

  const camera = { scale: 1, overlayScale: 1 / .082 };
  const syncOcean = () => {
    if (!ocean) return;
    Object.assign(ocean.controls, {
      zoomFactor: (wide ? 8 : 12) / camera.scale,
      fov: 35, height: 2.5 - .8 * camera.scale,
      overlayScale: camera.overlayScale,
    });
  };
  syncOcean();
  /* --- the camera retreats until the ship is a speck --------------------- */
  gsap.timeline({
    scrollTrigger: {
      trigger: root,
      // The reference's source says `top+=100vh`, but its own trigger resolves
      // ~810px earlier than that — its positions are measured before the
      // section's lazy media settles and are never refreshed. This is the
      // range the live site actually plays over.
      start: `top+=${vh(10)} top`,
      endTrigger: q('.home-why'),
      end: 'bottom bottom',
      scrub: wide ? 1 : true,
    },
  })
    .fromTo(q('.home-why-ship-img'), { scale: 1 }, { scale: 0.082, ease: SILK, duration: 1.05 }, 0)
    .to(camera, { scale: .082, overlayScale: 1, ease: SILK, duration: 1.05, onUpdate: syncOcean }, 0);

  /* --- then climbs through the clouds ------------------------------------ */
  const overlap = q('.home-why-cloud-overlap');
  const overlapBg = q('.home-why-cloud-overlap-bg');
  const overlapItems = qa('.home-why-cloud-overlap-item');
  const decorItems = qa('.home-why-cloud-decor-item');
  const all = [overlap, overlapBg, ...overlapItems, ...decorItems];

  const clouds = gsap.timeline({
    scrollTrigger: {
      trigger: root,
      start: `top+=${vh(wide ? 300 : 350)} top`,
      endTrigger: q('.home-why'),
      end: 'bottom top',
      scrub: wide ? 1 : true,
      onEnter: () => gsap.set(all, { willChange: 'transform, opacity', force3D: true }),
      onEnterBack: () => gsap.set(all, { willChange: 'transform, opacity', force3D: true }),
      onLeave: () => gsap.set(all, { clearProps: 'willChange' }),
      onLeaveBack: () => gsap.set(all, { clearProps: 'willChange' }),
    },
  });

  // everything starts blown up and invisible, so the bank resolves *around*
  // the camera rather than sliding in from the edges
  gsap.set([overlap, overlapBg, ...overlapItems], { opacity: 0, visibility: 'visible', force3D: true, backfaceVisibility: 'hidden' });
  gsap.set(decorItems, { visibility: 'visible', force3D: true, backfaceVisibility: 'hidden' });
  gsap.set(q('.home-why-cloud-overlap-item.cloud-1'), { scale: 8 });
  gsap.set(qa('.home-why-cloud-overlap-item.cloud-2, .home-why-cloud-overlap-item.cloud-3, .home-why-cloud-overlap-item.cloud-5, .home-why-cloud-overlap-item.cloud-7'), { scale: 5 });
  gsap.set(q('.home-why-cloud-overlap-item.cloud-4'), { scale: 2 });
  gsap.set(q('.home-why-cloud-overlap-item.cloud-6'), { scale: 4 });

  gsap.set(q('.home-why-cloud-decor-item.cloud-1'), { x: -vw(50), y: 0, scale: 0.8, opacity: 0.3, filter: 'blur(2px)' });
  gsap.set(q('.home-why-cloud-decor-item.cloud-2'), { x: vw(100), y: 150, scale: 0.8, opacity: 1, filter: 'blur(2px)' });
  gsap.set(q('.home-why-cloud-decor-item.cloud-3'), { opacity: 0, x: vw(-5), scale: 0.7, filter: 'blur(2px)' });

  clouds
    .to(q('.home-why-cloud-decor-item.cloud-3'), { x: 0, scale: 1, opacity: 0.3, filter: 'blur(0px)', ease: SILK, duration: 1 })
    .to(q('.home-why-cloud-decor-item.cloud-1'), { x: vw(20), y: 30, scale: 0.6, opacity: 0, ease: SILK, duration: 1 }, 0)
    .to(q('.home-why-cloud-decor-item.cloud-2'), { x: vw(50), y: 120, scale: 0.6, opacity: 0, ease: SILK, duration: 1 }, 0)
    .to(q('.home-why-cloud-decor-item.cloud-3'), { x: vw(-5), scale: 2, opacity: 0, filter: 'blur(2px)', ease: SILK, duration: 1.5 })
    .to(q('.home-why-main'), { autoAlpha: 0.9, ease: SILK, duration: 1 }, wide ? '<=1.2' : '<=.3')
    .to(q('.home-why-ship'), { scale: 0.9, ease: SILK, duration: 1.2 }, '<=0')
    .to(overlap, { opacity: 1, ease: SMOOTH, duration: 1.2 }, '<=0')
    .to(overlapBg, { opacity: 1, ease: SMOOTH, duration: 1.2 }, '<=0')
    // the bank settles one layer at a time, deepest first
    .to(q('.home-why-cloud-overlap-item.cloud-2'), { scale: 1, opacity: 1, force3D: true, ease: SMOOTH, duration: 1.3 }, '<=0')
    .to(q('.home-why-cloud-overlap-item.cloud-7'), { scale: 1, opacity: 1, force3D: true, ease: SMOOTH, duration: 1.2 }, '<=0.2')
    .to(q('.home-why-cloud-overlap-item.cloud-1'), { scale: 1, opacity: 1, force3D: true, ease: SMOOTH, duration: 1.5 }, '<=0.1')
    .to(q('.home-why-cloud-overlap-item.cloud-3'), { scale: 1, opacity: 1, force3D: true, ease: SMOOTH, duration: 1.2 }, '<=0.2')
    .to(q('.home-why-cloud-overlap-item.cloud-5'), { scale: 1, opacity: 1, force3D: true, ease: SMOOTH, duration: 1.2 }, '<=0.15')
    .to(q('.home-why-cloud-overlap-item.cloud-4'), { scale: 1, opacity: 1, force3D: true, ease: SMOOTH, duration: 1.2 }, '<=0.15')
    .to(q('.home-why-cloud-overlap-item.cloud-6'), { scale: 1, opacity: 1, force3D: true, ease: SMOOTH, duration: 1.2 }, '<=0.15');
}

/** Load the water shader before the ship enters, keeping the image as fallback. */
function mountOcean(container) {
  if (!container || isMobile()) return null;
  const scene = document.createElement('div');
  scene.className = 'home-why-ocean-scene';
  scene.setAttribute('aria-hidden', 'true');
  scene.controls = {
    zoomFactor: window.innerWidth > 991 ? 8 : 12, fov: 35,
    wakeCenterY: window.innerWidth > 991 ? -.5 : -.2,
    wakeSpeed: 50, wakeIntensity: .4,
    wakeWidth: window.innerWidth > 991 ? 2.2 : 1.9,
    height: 1.7, overlayScale: 1 / .082,
  };
  container.append(scene);
  let cleanup;
  let disposed = false;
  const observer = new IntersectionObserver(async entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    try {
      const { renderScene } = await import('../vendor/ocean/OceanScene-CggVSafL.js');
      if (!disposed && scene.isConnected) cleanup = renderScene(scene);
    } catch (error) {
      console.warn('Ocean renderer could not initialize; retaining the ocean image.', error);
    }
  }, { rootMargin: '1600px 0px' });
  observer.observe(container);
  if (import.meta.hot) import.meta.hot.dispose(() => {
    disposed = true; observer.disconnect(); cleanup?.(); scene.remove();
  });
  return scene;
}
