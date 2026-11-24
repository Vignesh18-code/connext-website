// INTRO — reveals on entry. The photo settles from a zoom, and the figures
// count up again every time the section comes into view.
import { gsap, ScrollTrigger, revealGroup, TextReveal, FadeUp, LineReveal, rem } from '../reveal.js';

export function initIntro() {
  const root = document.querySelector('.home-intro-wrap');
  if (!root) return;

  const q = (sel) => root.querySelector(sel);

  revealGroup({
    triggerInit: root,
    scrollTrigger: { trigger: q('.home-intro') },
    stagger: 0.02,
    tweens: () => [
      new TextReveal({ el: q('.home-intro-desc .txt') }),
      new FadeUp({ el: q('.home-intro-btn'), delay: 0.4 }),
      new TextReveal({ el: q('.home-intro-title .heading') }),
      new TextReveal({ el: q('.home-intro-label .txt'), delay: 0.2 }),
      new LineReveal({ el: q('.home-intro-label-line'), delay: 0.2 }),
    ],
  });

  // the photo that used to sit above the headline was replaced by the world section that follows, so there may be none
  const photo = q('.home-intro-thumb img');
  const zoom = photo ? gsap.fromTo(photo,
    { scale: 1.16 },
    { scale: 1, duration: 1.25, ease: 'power2.out', paused: true, overwrite: 'auto' },
  ) : null;

  const counts = [...root.querySelectorAll('[data-count]')].map((el) => {
    const raw = el.textContent.trim();
    const grouped = raw.includes(',');
    const decimal = raw.includes('.');
    const target = parseFloat(raw.replace(/,/g, ''));
    const counter = { value: 0 };
    const write = (value) => {
      el.textContent = grouped
        ? Math.round(value).toLocaleString()
        : decimal
          ? value.toFixed(1)
          : Math.round(value);
    };
    return gsap.fromTo(counter, { value: 0 }, {
      value: target,
      duration: 1.15,
      ease: 'power2.out',
      paused: true,
      onUpdate: () => write(counter.value),
    });
  });

  const play = () => {
    if (zoom) zoom.restart();
    counts.forEach((tween) => tween.restart());
  };

  ScrollTrigger.create({
    trigger: q('.home-intro'),
    start: 'top 72%',
    onEnter: play,
    onEnterBack: play,
  });

  // stat rows enter one at a time, each 0.15s behind the last
  const items = [...root.querySelectorAll('.home-intro-stats-item')];
  gsap.set(items, { autoAlpha: 0 });

  ScrollTrigger.batch(items, {
    start: 'top 85%',
    batchMax: 1,
    once: true,
    onEnter: (batch) => {
      batch.forEach((item, i) => {
        gsap.set(item, { autoAlpha: 1 });
        revealGroup({
          triggerInit: item,
          timeline: gsap.timeline({ delay: 0.15 * i }),
          tweens: () => [
            new FadeUp({ el: item, from: { y: rem(100) } }),
            new TextReveal({ el: item.querySelector('.home-intro-stats-item-desc .txt') }),
            new LineReveal({ el: item.querySelector('.home-intro-stats-item-line') }),
          ],
        });
      });
    },
  });

}
