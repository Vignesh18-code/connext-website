// PARTNERS — the logo wall fades in tile by tile; the hover swap itself is CSS.
import { gsap, ScrollTrigger, isMobile } from '../reveal.js';

export function initPartners() {
  const root = document.querySelector('.home-partners-wrap');
  if (!root) return;

  const tiles = [...root.querySelectorAll('.home-partners-item')];
  if (isMobile() || !tiles.length) return;

  gsap.set(tiles, { autoAlpha: 0 });
  ScrollTrigger.batch(tiles, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) => gsap.to(batch, {
      autoAlpha: 1,
      duration: 0.6,
      ease: 'power2.out',
      stagger: { each: 0.04, from: 'start' },
    }),
  });
}
