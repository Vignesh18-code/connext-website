// SERVICES — mobile. The same parcel story as desktop (see street-story.js), laid out as one
// full-bleed pinned stage, followed by the vertical top-down truck that drives past the cards.
import { gsap as e } from '../reveal.js';
import '../styles/service-mobile.css';
import { buildStreetStory } from './street-story.js';

const rem = (n) => n / 10 * innerWidth * .025445292621;
const f = (n, unit) => (unit === 'rem' ? rem(n) : n * (unit === 'vh' ? innerHeight : innerWidth) / 100);

export function initServiceMobile(root) {
  if (innerWidth > 767) return;
  const q = (selector) => root.querySelector(selector);
  const stage = {};

  const first = q('.home-service-mb-first-screen');
  const run = q('.home-service-mb-street-run');
  const truckStick = q('.home-service-mb-truck-stick');

  // beats 1-2: one parcel, then three. One metre is --mm on this stage (7.2vw on a portrait phone, smaller on a short screen):
  // measured, so the story follows whatever the CSS decided
  const probe = document.createElement('i');
  probe.style.cssText = 'position:absolute;left:0;top:0;width:var(--mm);height:0;visibility:hidden;pointer-events:none';
  q('.home-service-mb-street-stick').appendChild(probe);
  const metre = probe.getBoundingClientRect().width || 0.072 * innerWidth;
  probe.remove();
  stage.story = buildStreetStory({
    root: q('.home-service-mb'),  // not the shared wrapper: the desktop section carries a copy of the street too
    scrollTrigger: { trigger: run, start: 'top top', end: 'bottom bottom' },
    M: (n) => n * metre,
    truck: q('.home-service-mb-truck-side'),
    body: q('.home-service-mb .mbts'),
    wheels: [...root.querySelectorAll('.mbts-wheel')],
  });

  // the top-down truck drops in as the stage lets go
  stage.truckIn = e.timeline({
    scrollTrigger: { trigger: first, start: 'bottom bottom', end: 'bottom top', scrub: true },
  })
    .fromTo(truckStick, { y: -truckStick.getBoundingClientRect().height }, { y: f(107, 'rem'), duration: 1, ease: 'none' });

  stage.truckRun = e.timeline({
    scrollTrigger: { trigger: first, start: 'bottom bottom', end: `bottom top+=${f(405, 'rem')}`, scrub: true },
  })
    .to(q('.home-service-mb-road'), { right: -f(12, 'rem'), autoAlpha: 1, duration: 1 })
    .to(root.querySelectorAll('.home-service-mb-road-line'), { scale: 1.3, skewY: -20, duration: 1 }, '<=0');

  const second = q('.home-service-mb-second-screen');
  stage.truckPosition = e.timeline({
    scrollTrigger: {
      trigger: second,
      start: `bottom-=${parseFloat(getComputedStyle(second).paddingBottom)}px top`,
      end: 'bottom bottom',
      scrub: true,
    },
  })
    .to(truckStick, { left: '50%', y: 0, yPercent: -50, scale: .59, top: '53%', duration: 1, ease: 'power1.inOut' })
    .to(truckStick, { xPercent: -50, duration: 1, ease: 'power1.inOut' }, '<=0.2')
    .to(root.querySelectorAll('.home-service-mb-road-line'), { scale: 1, skewY: 0, duration: .8 }, '<=0')
    .to(q('.home-service-mb-road'), { left: -f(10, 'rem'), right: -f(10, 'rem'), duration: .8 }, '<=0.3');

  stage.roadTransition = e.timeline({
    scrollTrigger: { trigger: q('.home-service-mb-empty-block.second-screen'), start: 'bottom bottom', end: 'bottom top', scrub: true },
  })
    .to(q('.home-service-mb-road'), { y: -f(100, 'vh'), duration: 1, ease: 'none' });

  if (import.meta.hot) import.meta.hot.dispose(() => Object.values(stage).forEach((value) => value?.kill?.()));
}
