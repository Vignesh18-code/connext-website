// Lenis smooth scroll, driven off the GSAP ticker so ScrollTrigger and the
// scroll position never disagree by a frame.
//
// The reference passes almost nothing here, which matters: with no `duration`
// or `easing`, Lenis runs in lerp mode (0.1 per frame) rather than animating
// each wheel gesture over a fixed duration. Lerp mode tracks the wheel far
// more closely, so the scrubbed timelines stay under your finger instead of
// trailing a beat behind.
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './reveal.js';

export function initSmoothScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const lenis = new Lenis({
    content: document.documentElement,
    wrapper: document.documentElement,
    syncTouch: false,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // exposed so the scroll position and timelines can be inspected from the
  // console (and by the comparison harness)
  window.lenis = lenis;
  window.gsap = gsap;
  return lenis;
}
