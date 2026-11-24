// A scroll-driven 3D stage: a tall wrapper holds one sticky full-screen canvas, and the scene's camera follows the scroll.
// Shared by the "three streets" section and the "descent" section.
//  - the scene (a module that exports a create function) is loaded shortly before the section is reached
//  - it draws only while the section is on screen, and (unless the scene is `live`, with moving traffic) only when the camera has something new to show
//  - if frames come slowly it steps itself down (smaller picture, then fewer effects) so scrolling stays smooth
//  - reduced motion, a failed start or a lost WebGL context all fall back to the poster picture
import { gsap, ScrollTrigger } from '../reveal.js';

/**
 * @param wrapSelector  the tall wrapper, e.g. '.home-world-wrap' (it holds a <canvas> and a poster image)
 * @param load          async ({ canvas, quality }) => scene API { setProgress, render, resize, degrade, level }
 * @param stillAt       the progress shown when the page must not move (reduced motion)
 * @param debugName     window property that exposes the scene for checking from the console
 * @param onFrame       optional (progress, scene) called whenever a new frame is drawn
 * @param live          the scene has things that move by themselves (it has a tick(seconds)): draw every frame while on screen
 * @param slowMs        average time between drawn frames above which the picture is made a little less sharp (19 = anything below about 52 fps)
 */
export function initScrollStage({ wrapSelector, load, stillAt = 0.9, debugName, onFrame, live = false, slowMs = 26 }) {
  const wrap = document.querySelector(wrapSelector);
  if (!wrap) return null;
  const canvas = wrap.querySelector('canvas');
  const flags = new URLSearchParams(location.search);   // ?still=1 and ?worldq=low|high exist only to test those paths
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || flags.get('still') === '1';
  const mobile = window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches;
  const weak = (navigator.hardwareConcurrency || 8) <= 4;
  const quality = flags.get('worldq') || (mobile || weak ? 'low' : 'high');
  if (reduced) wrap.classList.add('is-still');

  let scene = null;
  let target = 0;       // where the scroll says we are (0..1)
  let shown = -1;       // where the camera is
  let active = false;   // is the section on screen
  let failed = false;

  const fallback = () => { failed = true; wrap.classList.add('is-fallback'); };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fallback(); });

  async function build() {
    try {
      scene = await load({ canvas, quality });
      shown = reduced ? stillAt : target;
      scene.setProgress(shown);
      scene.render();
      if (onFrame) onFrame(shown, scene);
      wrap.classList.add('is-ready');
      if (debugName) window[debugName] = scene;
    } catch (error) {
      console.warn(`[${wrapSelector}] could not start, showing the poster instead`, error);
      fallback();
    }
  }

  // load a little before the section is reached, so the first scroll into it is already alive
  ScrollTrigger.create({ trigger: wrap, start: 'top bottom+=120%', once: true, onEnter: build });

  if (!reduced) {
    ScrollTrigger.create({
      trigger: wrap, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => { target = self.progress; },
    });
    ScrollTrigger.create({
      trigger: wrap, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => { active = self.isActive; },
      onRefresh: (self) => { active = self.isActive; },
    });
    // Keeping frames smooth: the picture is drawn at the screen's full sharpness and steps down only when frames come slowly; if it holds 60 fps
    // for a while at a lower step it tries one step up again (and waits longer each time that turns out too much).
    const samples = []; let lastDrawn = 0, settle = 0, steadyWindows = 0, improvedAt = 0, holdOff = 0, lastChange = 0;
    const watch = () => {
      const now = performance.now(), gap = now - lastDrawn; lastDrawn = now;
      if (gap > 400) { samples.length = 0; return; }   // the visitor stopped scrolling for a while: a pause, not a slow frame
      if (settle > 0) { settle -= 1; return; }          // let a new step settle before judging it
      samples.push(gap);
      if (samples.length < 40) return;
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length; samples.length = 0;
      if (avg > slowMs) {
        steadyWindows = 0;
        if (improvedAt && now - improvedAt < 6000) holdOff = Math.min(120000, (holdOff || 15000) * 2);   // the step we just tried was too much
        if (scene.degrade()) { settle = 12; lastChange = now; console.info(`[${wrapSelector}] frames were slow (${Math.round(avg)} ms), quality lowered to step ${scene.level}`); }
      } else if (scene.improve && scene.level > 0 && avg < 18) {
        steadyWindows += 1;
        if (steadyWindows >= 4 && now - lastChange > 8000 && now > holdOff + lastChange && scene.improve()) { steadyWindows = 0; settle = 12; improvedAt = now; lastChange = now; }
      } else steadyWindows = 0;
    };
    let lastTick = performance.now();
    gsap.ticker.add(() => {
      const now = performance.now(), seconds = Math.min(0.25, (now - lastTick) / 1000); lastTick = now;
      if (!scene || !active || failed) return;
      const k = 1 - Math.exp(-seconds * 14);   // glide towards where the scroll is, the same speed at 60, 90 or 120 frames a second
      if (live) {
        shown = shown < 0 ? target : (Math.abs(target - shown) < 0.0004 ? target : shown + (target - shown) * k);
        scene.setProgress(shown); scene.tick(seconds); scene.render();
        if (onFrame) onFrame(shown, scene);
        watch();
        return;
      }
      if (shown >= 0 && Math.abs(target - shown) < 0.0004) {
        if (shown !== target) { shown = target; scene.setProgress(shown); scene.render(); if (onFrame) onFrame(shown, scene); }
        return;
      }
      shown = shown < 0 ? target : shown + (target - shown) * k;   // a touch of glide on top of the page's smooth scroll
      scene.setProgress(shown);
      scene.render();
      if (onFrame) onFrame(shown, scene);
      watch();
    });
  }

  window.addEventListener('resize', () => { if (scene && !failed) { scene.resize(); scene.render(); } });
  return { get scene() { return scene; } };
}
