// HEADER — state is driven off scroll position and direction, exactly as the
// original does it: `on-scroll` past two header heights, `on-hide` while
// scrolling down past three, and `on-<mode>` from the section under the bar.
import { gsap } from '../reveal.js';

const NEWS_INTERVAL = 4200;

export function initHeader({ revealed } = {}) {
  const header = document.querySelector('.header');
  if (!header) return;

  newsTicker(header);
  menu(header);
  scrollState(header);

  // the bar is held back until the loader irises open
  if (revealed) header.classList.remove('on-loader');
}

/** Rotates the three headlines, sliding the outgoing one up and out. */
function newsTicker(header) {
  const items = [...header.querySelectorAll('.related-news-item')];
  if (items.length < 2) return;

  let current = 0;
  setInterval(() => {
    const previous = items[current];
    current = (current + 1) % items.length;
    previous.classList.remove('active');
    previous.classList.add('de-active');
    items[current].classList.add('active');
    // park the outgoing item back below the mask once it has cleared
    setTimeout(() => previous.classList.remove('de-active'), 650);
  }, NEWS_INTERVAL);
}

function menu(header) {
  const toggle = header.querySelector('.header-menu-toggle');
  const wrap = header.querySelector('.header-menu');
  if (!toggle) return;

  const close = () => {
    header.classList.remove('on-open-nav');
    wrap.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = !header.classList.contains('on-open-nav');
    header.classList.toggle('on-open-nav', open);
    wrap.classList.toggle('active', open);
    toggle.setAttribute('aria-expanded', String(open));
  });

  header.querySelectorAll('.header-dropdown-link, .header-logo, .header-btn a')
    .forEach((el) => el.addEventListener('click', () => setTimeout(close, 500)));

  document.addEventListener('click', (event) => {
    if (!header.classList.contains('on-open-nav')) return;
    if (!event.target.closest('.header')) close();
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
}

function scrollState(header) {
  // sections tagged dark flip the bar to transparent + white type
  const darkSections = [...document.querySelectorAll('[data-section="dark"]')];
  let last = window.scrollY;

  const update = () => {
    const y = window.lenis ? window.lenis.scroll : window.scrollY;
    const h = header.offsetHeight || 1;

    const scrolled = y > 2 * h;
    header.classList.toggle('on-scroll', scrolled);
    // at the top of the page the bar shows its nav inline; past two header
    // heights it collapses back to the dots toggle
    if (window.innerWidth > 991 && !header.classList.contains('on-open-nav')) {
      header.classList.toggle('show-menu', !scrolled);
    }

    // only a definite direction changes the hidden state; smooth scrolling
    // eases in sub-pixel steps, so anything under a pixel counts as "still"
    // and leaves the bar however it was
    if (y <= 3 * h) {
      header.classList.remove('on-hide');
      last = y;
    } else if (y - last > 1) {
      header.classList.add('on-hide');
      last = y;
    } else if (last - y > 1) {
      header.classList.remove('on-hide');
      last = y;
    }

    // whichever tagged section is under the bar decides the colour mode
    const probe = header.getBoundingClientRect().bottom;
    const dark = darkSections.some((section) => {
      const box = section.getBoundingClientRect();
      return box.top <= probe && box.bottom >= probe;
    });
    header.classList.toggle('on-dark', dark);
  };

  update();
  gsap.ticker.add(update);
}
