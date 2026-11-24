// Intro loader — mirrors their `.loader` (fixed, z-999, black):
//   1. wordmark fades in top-left
//   2. a column of country names cycles through, one lit at a time
//   3. the whole loader "irises" open (radial mask) to reveal the hero
//
// Runs once on first load. Returns a promise that resolves when the reveal
// starts, so the globe ticker / hero reveal can sync to it.

const COUNTRIES = [
  'Australia', 'New Zealand', 'Hong Kong', 'China', 'Vietnam',
  'United States', 'Thailand', 'Germany', 'United Kingdom',
];

export function runLoader({ onReveal } = {}) {
  const root = document.createElement('div');
  root.className = 'loader';
  root.innerHTML = `
    <div class="loader-inner">
      <div class="loader-home">
        <div class="loader-logo">UNITEDCARRIERS</div>
        <div class="loader-countries">
          <div class="loader-countries-list">
            ${COUNTRIES.map((c) => `<div class="loader-countries-item">${c}</div>`).join('')}
          </div>
        </div>
        <div class="loader-count"><span>0</span><i>%</i></div>
      </div>
    </div>`;
  document.body.appendChild(root);

  const items = [...root.querySelectorAll('.loader-countries-item')];
  const countEl = root.querySelector('.loader-count span');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    root.classList.add('is-revealing');
    onReveal?.();
    // remove after the mask animation completes
    setTimeout(() => root.remove(), 1100);
  };

  // click / key to skip
  const skip = () => finish();
  root.addEventListener('click', skip);
  window.addEventListener('keydown', skip, { once: true });

  if (prefersReduced) { setTimeout(finish, 300); return Promise.resolve(); }

  return new Promise((resolve) => {
    // logo in
    requestAnimationFrame(() => root.classList.add('is-in'));

    const STEP = 190;                 // ms per country
    const START = 450;                // after logo settles
    items.forEach((el, i) => {
      setTimeout(() => {
        items.forEach((x) => x.classList.remove('is-active'));
        el.classList.add('is-active');
        el.classList.add('is-seen');
        countEl.textContent = Math.round(((i + 1) / items.length) * 100);
      }, START + i * STEP);
    });

    const total = START + items.length * STEP + 260;
    setTimeout(() => { finish(); resolve(); }, total);
  });
}
