// CTA — the ring pulse runs in CSS; this only handles the copy entrance.
import { revealGroup, TextReveal, FadeUp } from '../reveal.js';

export function initCta() {
  const root = document.querySelector('.home-cta-wrap');
  if (!root) return;

  const q = (sel) => root.querySelector(sel);
  revealGroup({
    triggerInit: root,
    scrollTrigger: { trigger: q('.cta-text-wrap') },
    tweens: () => [
      new TextReveal({ el: q('.cta-title .heading') }),
      new TextReveal({ el: q('.cta-desc .txt'), delay: 0.2 }),
      new FadeUp({ el: q('.cta-btn-wrap'), delay: 0.3 }),
    ],
  });
}
