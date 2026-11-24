// INSIGHTS — hovering a row cross-fades its thumbnail into the frame.
import { revealGroup, TextReveal, FadeUp, LineReveal, gsap } from '../reveal.js';

export function initInsights() {
  const root = document.querySelector('.home-ins-wrap');
  if (!root) return;

  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => [...root.querySelectorAll(sel)];

  revealGroup({
    triggerInit: root,
    scrollTrigger: { trigger: q('.home-ins-text-wrap') },
    tweens: () => [
      new TextReveal({ el: q('.home-ins-title .heading') }),
      new TextReveal({ el: q('.home-ins-desc .txt'), delay: 0.2 }),
      new FadeUp({ el: q('.home-ins-action'), delay: 0.3 }),
    ],
  });

  const rows = qa('.home-ins-cms-item');
  const thumbs = qa('[data-ins-thumb]');

  rows.forEach((row, i) => {
    revealGroup({
      triggerInit: row,
      timeline: gsap.timeline({
        delay: 0.06 * i,
        scrollTrigger: { trigger: row, start: 'top top+=90%', once: true },
      }),
      tweens: () => [
        new TextReveal({ el: row.querySelector('.home-ins-cms-item-title .txt') }),
        new LineReveal({ el: row.querySelector('.home-ins-cms-item-line') }),
      ],
    });

    const activate = () => thumbs.forEach((t, j) => t.classList.toggle('is-active', i === j));
    row.addEventListener('mouseenter', activate);
    row.addEventListener('focusin', activate);
  });
}
