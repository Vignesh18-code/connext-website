// Letter-scramble hover. On mouseenter the label's characters shuffle and then
// lock back in from the left, one per tick. Desktop only — on touch there is
// no hover to trigger it, and the reflow would be wasted work.
//
// Buttons carry `data-is-btn`: their label width is pinned first, so the
// shuffled string (which is the same characters in a different order, but
// kerned differently) can't make the button jump.

const DEFAULT_VELOCITY = 30;
const LEAD_IN = -3; // ticks of fully-shuffled text before letters start locking

const shuffled = (chars) => {
  const out = chars.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export function initLinkRandom(selector = '[data-link-random]', velocity = DEFAULT_VELOCITY) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.innerWidth <= 991) return;

  document.querySelectorAll(selector).forEach((el) => {
    if (el.dataset.shuffleInitialized) return;
    el.dataset.shuffleInitialized = 'true';

    const label = el.querySelector('.txt') || el;
    const tick = parseInt(el.dataset.velocity, 10) || velocity;
    const allowWrap = el.hasAttribute('data-allow-wrap');

    if (el.hasAttribute('data-is-btn')) {
      const pinWidth = () => {
        if (!document.body.contains(label)) return window.removeEventListener('resize', pinWidth);
        label.style.width = '';
        const natural = Math.ceil(label.getBoundingClientRect().width);
        // a hidden or not-yet-laid-out label measures 0; pinning that would
        // force the real text to wrap once it appears
        if (natural > 0) label.style.width = `${natural + 1}px`;
        return undefined;
      };
      document.fonts?.ready.then(() => { if (!label.style.width) pinWidth(); });
      window.addEventListener('resize', pinWidth);
    }

    el.addEventListener('mouseenter', () => {
      if (el.classList.contains('is-shuffling')) return;
      el.classList.add('is-shuffling');

      const labels = el.querySelectorAll('.txt').length ? [...el.querySelectorAll('.txt')] : [el];
      let finished = 0;

      labels.forEach((target) => {
        if (!target.dataset.originalText) target.dataset.originalText = target.textContent.trim();
        const original = target.dataset.originalText;
        const chars = original.split('');
        const previousWhiteSpace = target.style.whiteSpace;
        if (!allowWrap) target.style.whiteSpace = 'nowrap';

        let locked = LEAD_IN;
        const step = () => {
          if (locked >= chars.length) {
            target.textContent = original;
            if (!allowWrap) target.style.whiteSpace = previousWhiteSpace;
            finished += 1;
            if (finished === labels.length) el.classList.remove('is-shuffling');
            return;
          }
          const next = shuffled(chars);
          for (let i = 0; i < locked; i++) if (i >= 0) next[i] = chars[i];
          target.textContent = next.join('');
          locked += 1;
          setTimeout(step, tick);
        };
        step();
      });
    });
  });
}
