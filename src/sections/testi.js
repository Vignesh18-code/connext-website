// TESTIMONIALS — a plane crosses the frame and the angled clip on the white
// panel rides its nose, so the panel reads as being wiped in by the flypast.
// One custom property on the section drives both: the plane's x offset and
// the wedge cut out of the panel.
import { gsap, revealGroup, TextReveal, FadeUp, isMobile } from '../reveal.js';
import { SMOOTH } from '../eases.js';

const vh = (n) => (window.innerHeight * n) / 100;

export function initTesti() {
  const root = document.querySelector('.home-testi-wrap');
  if (!root) return;

  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => [...root.querySelectorAll(sel)];

  revealGroup({
    triggerInit: root,
    scrollTrigger: { trigger: q('.home-testi-text-wrap') },
    tweens: () => [
      new TextReveal({ el: q('.home-testi-title .heading') }),
      new TextReveal({ el: q('.home-testi-desc .txt') }),
      ...qa('.home-testi-item').map((item) => new FadeUp({ el: item })),
    ],
  });

  if (isMobile() || window.innerWidth <= 991) return;

  // the cloud bank from the section above (when there is one) shrinks away as the plane arrives
  const cloudOverlap = document.querySelector('.home-why-cloud-overlap');

  gsap.timeline({
    scrollTrigger: {
      trigger: q('.home-testi'),
      start: `top+=${vh(20)} top`,
      end: `top+=${vh(220)} top`,
      scrub: true,
      fastScrollEnd: true,
    },
  })
    .fromTo(q('.home-testi'),
      { '--overlap-clip': -60 },
      { '--overlap-clip': 180, ease: SMOOTH, duration: 1 })
    .fromTo(q('.home-testi-plane-inner'),
      { scale: 1 },
      { yPercent: 0, scale: 1.3, force3D: true, ease: SMOOTH, duration: 1 }, '<=0')
    .fromTo(q('.home-testi-plane-img-shadow'),
      { '--pos-x': -5, '--pos-y': 0, '--scale': 0.9 },
      { '--pos-x': 3, '--pos-y': 2, '--scale': 0.5, ease: SMOOTH, duration: 1 }, '<=0')
    .fromTo(cloudOverlap || {},
      { scale: 1, yPercent: 0 },
      { scale: 0.8, yPercent: -55, ease: SMOOTH, duration: 0.5 }, '<=0');
}
