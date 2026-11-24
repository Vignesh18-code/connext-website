// FAQ — one answer open at a time. The panel's height eases open while its
// text fades and lifts in; closing reverses it. Uses `hidden` + aria-expanded
// so screen readers and no-JS visitors get the right state.
import { gsap, ScrollTrigger, revealGroup, TextReveal, FadeUp, LineReveal } from '../reveal.js';

export function initFaq() {
  const root = document.querySelector('.home-faq-wrap');
  if (!root) return;

  const q = (sel) => root.querySelector(sel);
  const items = [...root.querySelectorAll('.home-faq-main-item')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = reduced ? 0 : 0.55;
  const EASE = 'power3.inOut';

  revealGroup({
    triggerInit: root,
    scrollTrigger: { trigger: q('.home-faq-text-wrap') },
    tweens: () => [
      new FadeUp({ el: q('.home-faq-eyebrow') }),
      new TextReveal({ el: q('.home-faq-title .heading') }),
      new TextReveal({ el: q('.home-faq-desc .txt'), delay: 0.2 }),
      new LineReveal({ el: q('.home-faq-main .line'), delay: 0.2 }),
    ],
  });

  // the page below grows/shrinks with the accordion: re-measure the later
  // scroll triggers once the motion settles (debounced across quick clicks)
  let refreshId = 0;
  const refreshSoon = () => {
    clearTimeout(refreshId);
    refreshId = setTimeout(() => ScrollTrigger.refresh(), DUR * 1000 + 60);
  };

  const parts = (item) => ({
    button: item.querySelector('.home-faq-main-item-title-wrap'),
    panel: item.querySelector('.home-faq-main-item-ans'),
    inner: item.querySelector('.home-faq-main-item-ans-in'),
  });

  const close = (item) => {
    const { button, panel, inner } = parts(item);
    gsap.killTweensOf([panel, inner]);
    item.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    gsap.to(inner, { autoAlpha: 0, y: -6, duration: DUR * 0.6, ease: 'power2.in' });
    gsap.to(panel, {
      height: 0,
      duration: DUR,
      ease: EASE,
      onComplete: () => {
        panel.hidden = true;
        gsap.set(panel, { clearProps: 'height' });
      },
    });
  };

  const open = (item) => {
    const { button, panel, inner } = parts(item);
    gsap.killTweensOf([panel, inner]);
    item.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    // from 0 if it was shut, or from wherever a half-finished close left it
    const from = panel.hidden ? 0 : panel.offsetHeight;
    panel.hidden = false;
    gsap.fromTo(panel, { height: from }, {
      height: () => inner.offsetHeight,
      duration: DUR,
      ease: EASE,
      onComplete: () => gsap.set(panel, { clearProps: 'height' }),
    });
    gsap.fromTo(inner, { autoAlpha: 0, y: 10 }, {
      autoAlpha: 1, y: 0, duration: DUR, delay: DUR * 0.25, ease: 'power2.out',
    });
  };

  // answers are all visible in the HTML; only collapse them once JS is here
  items.forEach((item) => {
    const { button, panel } = parts(item);
    const isOpen = item.classList.contains('is-open');
    panel.hidden = !isOpen;
    button.setAttribute('aria-expanded', String(isOpen));
  });

  items.forEach((item) => {
    parts(item).button.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      items.filter((other) => other !== item && other.classList.contains('is-open')).forEach(close);
      if (isOpen) close(item);
      else open(item);
      refreshSoon();
    });
  });
}
