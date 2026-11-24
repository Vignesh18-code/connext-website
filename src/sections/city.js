// THE CITY KEEPS MOVING — plays the skyline entrance once when the section
// comes into view (all motion is CSS on `.is-inview`, src/styles/city.css),
// then drifts the two skyline layers apart as the section scrolls past by
// writing a -1..1 progress value to `--cy-p`.
export function initCity() {
  const section = document.querySelector('.home-city');
  if (!section) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!('IntersectionObserver' in window)) {
    section.classList.add('is-inview');
    return;
  }

  let visible = false;
  let frame = 0;
  const update = () => {
    frame = 0;
    const r = section.getBoundingClientRect();
    const vh = window.innerHeight;
    // -1 as the section enters at the bottom, 1 as it leaves at the top
    const p = Math.max(-1, Math.min(1, 1 - 2 * ((r.top + r.height) / (vh + r.height))));
    section.style.setProperty('--cy-p', p.toFixed(3));
  };
  const onScroll = () => {
    if (visible && !frame) frame = requestAnimationFrame(update);
  };

  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) {
      if (entries.some((e) => e.intersectionRatio >= 0.25)) section.classList.add('is-inview');
      if (!reduced) onScroll();
    }
  }, { threshold: [0, 0.25] }).observe(section);

  if (!reduced) window.addEventListener('scroll', onScroll, { passive: true });
}
