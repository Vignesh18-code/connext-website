// Boots the hero globe exactly the way their `GlobePage.Hero` class does:
//  - build the dot globe into #globe
//  - drive it from a single ticker, advancing `phi` while not interacting
//  - pause rendering when the hero scrolls out of view (IntersectionObserver)
//  - rebuild on desktop <-> mobile breakpoint change
import './style.css';
import { createDotGlobe } from './globe.js';
import { AIRPORTS, FLIGHTS, SEA_LABELS, OPTS } from './data.js';
import { initSmoothScroll } from './smooth.js';
import { ScrollTrigger } from './reveal.js';
import { initNavbar } from './sections/navbar.js';
import { initLinkRandom } from './link-random.js';
import { initPickup } from './sections/pickup.js';
import { initCity } from './sections/city.js';
import { initService } from './sections/service.js';
import { initDestination } from './sections/destination.js';
import { initFaq } from './sections/faq.js';

const canvas = document.getElementById('globe');
const wrap = document.getElementById('globeWrap');
const hero = document.querySelector('.home-hero');



// the globe's reveal is synced to the loader iris
hero.classList.add('is-preload');

let globe = null;
let phi = OPTS.initialPhi;
let speedMultiplier = 1;
let swayTime = 0;
let visible = true;
let revealed = false;
let motionPaused = false;
let bordersVisible = true;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let rafId = 0;
let last = performance.now();

// use innerWidth (reliable at module-eval time, unlike a 0-size canvas)
function isMobile() { return window.innerWidth < 768; }
function globeBreakpoint() { return isMobile() ? 'mobile' : window.innerWidth <= 991 ? 'tablet' : 'desktop'; }

function buildGlobe() {
  const m = isMobile();
  globe = createDotGlobe(canvas, {
    airportsData: AIRPORTS,
    flightsData: FLIGHTS,
    seaLabels: SEA_LABELS,
    showArcs: true,
    // Verified against the current reference Hero configuration.
    cameraZ: m ? 2.7 : window.innerWidth <= 991 ? 2.8 : 2.23,
    tileDeg: m ? 1.5 : 1.2,
    enableControls: !m,
  });
  globe.resize(
    canvas.clientWidth || wrap.clientWidth,
    canvas.clientHeight || wrap.clientHeight,
  );
  globe.update({ phi });
  globe.setBoundariesVisible(bordersVisible);
}

// ---- single ticker (their _createGlobeTick) --------------------------------
function tick(now) {
  rafId = requestAnimationFrame(tick);
  // Match GSAP lag smoothing after a suspended/background frame.
  const elapsed = now - last;
  const dt = elapsed > 500 ? 33 : elapsed;
  last = now;
  if (!visible || !globe || !revealed) return;
  if (!globe.isInteracting() && !reducedMotion.matches && !motionPaused) {
    const e = dt / 16.666;
    if (OPTS.sway) {
      // rock back and forth around the start angle so the map stays in view
      swayTime += dt * speedMultiplier;
      phi = OPTS.initialPhi + OPTS.sway.amplitude * Math.sin((swayTime / OPTS.sway.period) * Math.PI * 2);
    } else {
      phi += OPTS.autoSpeed * speedMultiplier * e;
    }
  }
  globe.update({ phi, deltaTime: reducedMotion.matches || motionPaused ? 0 : dt });
}

const motionButton = document.querySelector('[data-map-motion]');
const borderButton = document.querySelector('[data-map-borders]');
motionButton?.addEventListener('click', () => {
  motionPaused = !motionPaused;
  motionButton.setAttribute('aria-pressed', String(motionPaused));
  motionButton.textContent = motionPaused ? 'Resume motion' : 'Pause motion';
});
borderButton?.addEventListener('click', () => {
  bordersVisible = !bordersVisible;
  borderButton.setAttribute('aria-pressed', String(bordersVisible));
  globe?.setBoundariesVisible(bordersVisible);
});
if (reducedMotion.matches && motionButton) {
  motionButton.disabled = true;
  motionButton.textContent = 'Reduced motion';
}

// ---- pause when hero leaves the viewport -----------------------------------
new IntersectionObserver(
  (entries) => { visible = entries[0].isIntersecting; },
  { rootMargin: '100px' },
).observe(wrap);

// ---- responsive ----------------------------------------------------------
const ro = new ResizeObserver((entries) => {
  const { width, height } = entries[entries.length - 1].contentRect;
  cancelAnimationFrame(ro._raf);
  ro._raf = requestAnimationFrame(() => globe && globe.resize(width, height));
});
ro.observe(canvas);

// rebuild when the mobile/desktop boundary is crossed (params + DPR differ)
let previousBreakpoint = globeBreakpoint();
window.addEventListener('resize', () => {
  const currentBreakpoint = globeBreakpoint();
  if (currentBreakpoint === previousBreakpoint) return;
  previousBreakpoint = currentBreakpoint;
  const keep = phi;
  globe?.destroy();
  buildGlobe();
  phi = keep;
});

// build the globe, then reveal the hero straight away (no intro loader)
buildGlobe();
rafId = requestAnimationFrame(tick);

requestAnimationFrame(() => {
  revealed = true;
  last = performance.now();
  hero.classList.remove('is-preload');
  hero.classList.add('is-revealed');
  document.querySelector('.site-nav')?.classList.remove('on-loader');
});

// ---- the rest of the page --------------------------------------------------
// Smooth scroll first, so every ScrollTrigger below is measured against the
// same scroller; then the sections in page order.
initSmoothScroll();

initNavbar();
initLinkRandom();
initPickup();
initCity();
initService();
initDestination();
initFaq();

// sticky stages and horizontal distances are measured in pixels, so re-measure
// once the webfonts have settled and whenever the viewport changes size
document.fonts?.ready.then(() => ScrollTrigger.refresh());
window.addEventListener('load', () => ScrollTrigger.refresh());
