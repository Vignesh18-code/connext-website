// NAVBAR — the open/close behaviour of CONNEXT's site-navbar.tsx: the toggle
// flips the mobile/tablet panel, and Escape, a link tap, a click outside or
// resizing up to desktop all close it again.

const DESKTOP = 1024;

export function initNavbar() {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  drawBorder(nav);

  const toggle = nav.querySelector('.site-nav-toggle');

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  const close = () => setOpen(false);

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(!nav.classList.contains('is-open'));
  });

  nav.querySelectorAll('.site-nav-panel a, .site-nav-panel button, .site-nav-logo')
    .forEach((el) => el.addEventListener('click', close));

  document.addEventListener('click', (event) => {
    if (nav.classList.contains('is-open') && !event.target.closest('.site-nav')) close();
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (window.innerWidth >= DESKTOP) close(); });
}

// The bar's outline (matches .site-nav-bar in navbar.css): from 640px up a
// flared top — a 36px concave quarter-circle into each side — and 20px round
// bottom corners; below that a plain rectangle with round bottom corners. The
// top edge sits against the top of the screen, so it gets no line.
const FLARE = 36;
const CORNER = 20;
const flared = window.matchMedia('(min-width: 640px)');

function borderPath(w, h) {
  if (!flared.matches) {
    return `M0 0 V${h - CORNER} A${CORNER} ${CORNER} 0 0 0 ${CORNER} ${h}`
      + ` H${w - CORNER} A${CORNER} ${CORNER} 0 0 0 ${w} ${h - CORNER} V0`;
  }
  const f = FLARE;
  const c = CORNER;
  return `M0 0 A${f} ${f} 0 0 1 ${f} ${f} V${h - c} A${c} ${c} 0 0 0 ${f + c} ${h}`
    + ` H${w - f - c} A${c} ${c} 0 0 0 ${w - f} ${h - c} V${f} A${f} ${f} 0 0 1 ${w} 0`;
}

function drawBorder(nav) {
  const bar = nav.querySelector('.site-nav-bar');
  const svg = nav.querySelector('.site-nav-border');
  const path = svg?.querySelector('path');
  const grad = svg?.querySelector('linearGradient');
  if (!bar || !path) return;

  const draw = () => {
    const w = bar.offsetWidth;
    const h = bar.offsetHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    path.setAttribute('d', borderPath(w, h));
    grad?.setAttribute('x2', String(w));
  };
  draw();
  new ResizeObserver(draw).observe(bar);
  flared.addEventListener('change', draw);
}

