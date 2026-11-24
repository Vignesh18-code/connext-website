// The parcel story shared by the desktop and mobile services sections.
//
// The truck is already standing at the first stop with the customer right beside it. The partner is the
// truck's driver: he leaves his seat, comes out from behind the truck's rear, takes ONE parcel and pushes it
// into the truck, and goes back behind it to his seat; the street slides past with him at the wheel; then he
// does the same with THREE corporate boxes at a company's entrance, and drives off. The readouts count 0 → 1 → 4.
//
// One scrubbed timeline, 3.2 units long, stretched over the scroll run (its length is the `--story` CSS variable on
// desktop and `--story-mb` on mobile — change that one number to speed the whole story up or slow it down).
// Everything is placed in metres from the truck's rear edge (see .st in service.css); `M(n)` converts metres to
// pixels at the scale the caller's layout draws the truck at. The partner's layer is cut off at the rear edge,
// so x > 0 means "behind the truck".
//
// Motion language
//  - every move eases in and out (nothing starts or stops dead); actions overlap instead of waiting for each other
//  - secondary motion: steps bob and sway, the truck squats when it pulls away and dips when it brakes,
//    bounces over the road, the wheels turn the distance the street actually slides, layers blur with speed
//  - depth: three layers at three speeds, contact shadows, wind streaks
//  - UI: chips slide in, the parcel counter rolls like an odometer, "+N" pops over the truck, the route fills
//  - the skyline rises as the stage scrolls in; standing figures breathe while the section is on screen
//  - prefers-reduced-motion keeps the choreography but drops blur, streaks, bounce and idle loops; low-power touch devices
//    (and data-saver mode) drop the blur and streaks too
//  - responsive: fitStreet() sizes the backdrop to the screen's shape (see below); the section is rebuilt when the
//    viewport changes (service.js), so every metre-to-pixel value here is measured fresh
import { gsap, ScrollTrigger } from '../reveal.js';

const spin = { rotationZ: gsap.utils.unitize((v) => parseFloat(v) % 360) };
const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// touch devices with little to spare skip the expensive effects (layer blur, wind streaks)
const lite = typeof navigator !== 'undefined' && (
  navigator.connection?.saveData
  || (matchMedia('(pointer: coarse)').matches && ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4))
);

/**
 * Sizes the street of buildings behind the pickups to the shape of the screen: a 16:9 laptop gets them at their
 * drawn size, an ultra-wide or a short landscape phone gets them smaller so their tops stay on screen, a tall tablet
 * or phone gets them bigger so the white above the street is used. Sets --far-scale on the street (service.css).
 */
function fitStreet(root) {
  const street = root.querySelector('.home-service-street');
  if (!street) return;
  const headline = root.querySelector('.home-service-mb-street-title');     // phones: the headline must stay clear
  const title = headline && headline.getBoundingClientRect().height > 0 ? headline : null;   // (it is hidden on a phone turned on its side)
  const phone = !!headline;
  const tallest = Number(street.dataset.tallest) || 8.8;                // metres, the tallest building
  const probe = document.createElement('i');
  probe.style.cssText = 'position:absolute;left:0;top:0;width:var(--mn);height:0;visibility:hidden;pointer-events:none';
  street.appendChild(probe);
  const m = probe.getBoundingClientRect().width;                        // px per metre at the pickups' scale
  probe.remove();
  const box = street.getBoundingClientRect();
  if (!m || !box.height) return;
  // all measured from the street's own top, so it gives the same answer wherever the page is scrolled to
  const land = root.querySelector('.home-service-land')?.offsetHeight || 0;   // the pinned street starts this far above the viewport
  const ground = box.height - 0.5 * m;                                         // the footpath's top edge
  // the tallest roof must stay clear of the header (or, on a phone, of the headline)
  const ceiling = title ? title.getBoundingClientRect().bottom - box.top + 14 : land + Math.max(36, window.innerHeight * 0.06);
  const cap = title ? 1.5 : phone || window.innerWidth > 991 ? 1.25 : 1.9;
  const scale = Math.min(cap, Math.max(0.6, (ground - ceiling) / (tallest * m)));
  street.style.setProperty('--far-scale', scale.toFixed(3));
}

/**
 * @param {object} o
 * @param {Element} o.root         section root that contains the street markup
 * @param {object}  o.scrollTrigger  ScrollTrigger config for the master timeline (scrub is set here)
 * @param {(n:number)=>number} o.M metres → px
 * @param {Element} o.truck        the element that carries the truck
 * @param {Element} o.body         the truck's side-on picture + wheels + seat (it pitches and bounces as one)
 * @param {Element[]} o.wheels     the spinning wheel sprites
 */
export function buildStreetStory({ root, scrollTrigger, M, truck, body, wheels }) {
  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => [...root.querySelectorAll(sel)];
  const pose = (c) => q(`.home-service-partner .${c}`);

  const partner = q('.home-service-partner');
  const seat = q('.home-service-truck-seat .seat');   // the driver sitting in the cab, hands on the wheel
  const chipStop = q('.home-service-chip.is-stop');
  const chipCount = q('.home-service-chip.is-count');
  const chipTrip = q('.home-service-chip.is-trip');
  const route = q('.home-service-route');
  const routeFill = q('.home-service-route .rt-fill');
  const routeNodes = qa('.home-service-route .rt-node');
  const plusOne = q('.home-service-plus.is-one');
  const plusThree = q('.home-service-plus.is-three');
  const stop1 = q('.home-service-chip .stop-1');
  const stop2 = q('.home-service-chip .stop-2');
  const digits = qa('.home-service-count b');
  const near = q('.home-service-layer.is-near');
  const mid = q('.home-service-layer.is-mid');
  const far = q('.home-service-layer.is-far');
  const streaks = q('.home-service-streaks');
  const GAP = Number(q('.home-service-world').dataset.gap);   // metres the street slides between the two pickups
  const BEHIND = 0.5;                                          // out of sight behind the truck (metres from its rear edge)
  const WHEEL_R = 0.295;                                       // the tyres' radius in metres
  const turns = (GAP / (2 * Math.PI * WHEEL_R)) * 360 * 0.62;  // degrees the wheels turn over the slide (a little under true, so it never strobes)

  fitStreet(root);

  // decode every sprite up front: hidden images are not decoded until they first show, which would cost a hitch (or a blank
  // frame) the first time a building or a pose appears
  qa('.st-img').forEach((img) => { if (img.decode) img.decode().catch(() => {}); });

  // ------------------------------------------------------------------ resting state
  gsap.set(qa('.home-service-partner .pose'), { autoAlpha: 0 });
  gsap.set(partner, { x: M(BEHIND), transformOrigin: '0% 100%' });   // he starts out of sight, behind the truck
  gsap.set(truck, { x: 0, autoAlpha: 1 });                            // the truck is simply standing at the first stop
  gsap.set(q('.cust-stand'), { autoAlpha: 0 });
  gsap.set(digits.slice(1), { yPercent: 110, autoAlpha: 0 });
  gsap.set(stop2, { yPercent: 120, autoAlpha: 0 });
  gsap.set(body, { transformOrigin: '61.7% 100%' });                  // the truck pitches about its wheelbase
  gsap.set([plusOne, plusThree], { xPercent: -50 });

  const story = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { scrub: calm ? true : 0.35, ...scrollTrigger },
  });

  // ------------------------------------------------------------------ small helpers
  const swap = (from, to, at, len = 0.08) => story
    .to(pose(from), { autoAlpha: 0, duration: len }, at)
    .to(pose(to), { autoAlpha: 1, duration: len }, at);
  const pop = (el, at) => story.fromTo(el,
    { autoAlpha: 0, y: -M(0.18), scale: 0.94 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.12, ease: 'power3.out', immediateRender: false }, at);
  const drop = (el, at) => story.to(el, { autoAlpha: 0, y: M(0.12), duration: 0.1, ease: 'power2.in' }, at);
  // the parcel counter rolls like an odometer
  const count = (from, to, at) => story
    .to(digits[from], { yPercent: -110, autoAlpha: 0, duration: 0.07, ease: 'power2.in' }, at)
    .fromTo(digits[to], { yPercent: 110, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.1, ease: 'power3.out', immediateRender: false }, at + 0.02);
  // "+N parcel" pops over the truck's rear and floats away
  const plus = (el, at) => story
    .fromTo(el, { autoAlpha: 0, y: M(0.15), scale: 0.7 }, { autoAlpha: 1, y: -M(0.3), scale: 1, duration: 0.1, ease: 'back.out(2.4)', immediateRender: false }, at)
    .to(el, { autoAlpha: 0, y: -M(0.95), duration: 0.16, ease: 'power1.in' }, at + 0.17);
  // steps: a bob with a little sway, easing at each end of the walk so he never lurches
  const steps = (n, h = 0.06, tilt = 1.1) => Array.from({ length: n }, (_, i) => (
    { y: i % 2 ? 0 : -M(h), rotation: (i % 2 ? 1 : -1) * tilt, ease: 'sine.inOut' }));
  const walk = (to, at, len, ease = 'sine.inOut') => story
    .to(partner, { x: M(to), duration: len, ease }, at)
    .to(partner, { keyframes: steps(Math.max(2, Math.round(len * 22))), duration: len }, at)
    .to(partner, { rotation: 0, y: 0, duration: 0.04, ease: 'power2.out' }, at + len);
  // he leaves his seat and comes out from behind the truck's rear ...
  const leaveSeat = (at) => { story.to(seat, { autoAlpha: 0, duration: 0.06 }, at); story.set(pose('walk-l'), { autoAlpha: 1 }, at + 0.06); };
  // ... and goes back behind it, to sit at the wheel again
  const backToSeat = (at) => { story.set(pose('walk-r'), { autoAlpha: 0 }, at + 0.16); story.to(seat, { autoAlpha: 1, duration: 0.07 }, at + 0.19); };

  story.to({}, { duration: 0 }, 3.2); // pin the timeline's length

  // ------------------------------------------------------------------ hud in
  pop(chipStop, 0); pop(chipCount, 0.05); pop(route, 0.1);

  // ------------------------------------------------------------------ pickup 1
  // the truck and the customer are already there; the driver steps out from behind the truck,
  // takes the parcel, and pushes it straight into the truck
  leaveSeat(0.1);
  walk(-0.8, 0.16, 0.26);
  swap('walk-l', 'recv-l', 0.42);
  story.to(q('.cust-offer'), { autoAlpha: 0, duration: 0.08 }, 0.52).to(q('.cust-stand'), { autoAlpha: 1, duration: 0.08 }, 0.52);
  swap('recv-l', 'carry-1', 0.52);
  swap('carry-1', 'place', 0.66);
  story.to(partner, { x: -M(0.3), duration: 0.12, ease: 'power2.out' }, 0.74);   // pushes the box in through the rear
  count(0, 1, 0.86); plus(plusOne, 0.86);
  story.to(routeNodes[0], { backgroundColor: '#00c853', borderColor: '#00c853', scale: 1.35, duration: 0.1, ease: 'back.out(3)' }, 0.86);
  swap('place', 'walk-r', 0.86, 0.04);
  walk(BEHIND, 0.9, 0.16, 'power2.in');                                            // back behind the truck (out of sight)
  backToSeat(0.9);

  // ------------------------------------------------------------------ pulling away: the street slides, the truck leans into it
  const T0 = 1.12, SLIDE = 0.8;
  story
    .to(near, { x: -M(GAP), ease: 'power2.inOut', duration: SLIDE }, T0)
    .to(mid, { x: -M(GAP * 0.7), ease: 'power2.inOut', duration: SLIDE }, T0)
    .to(far, { x: -M(GAP * 0.6), ease: 'power2.inOut', duration: SLIDE }, T0)
    .to(wheels, { rotationZ: turns, ease: 'power2.inOut', duration: SLIDE, modifiers: spin }, T0)
    .to(routeFill, { scaleX: 0.5, ease: 'power2.inOut', duration: SLIDE }, T0)
    .to(stop1, { yPercent: -120, autoAlpha: 0, duration: 0.08, ease: 'power2.in' }, T0 + SLIDE - 0.12)
    .to(stop2, { yPercent: 0, autoAlpha: 1, duration: 0.1, ease: 'power3.out' }, T0 + SLIDE - 0.1);
  if (!calm) {
    story
      // the nose lifts as it pulls away, settles at cruise, dips as it brakes, and rocks back
      .to(body, { rotation: -0.8, duration: 0.2, ease: 'power2.out' }, T0)
      .to(body, { rotation: 0.05, duration: 0.3, ease: 'sine.inOut' }, T0 + 0.2)
      .to(body, { rotation: 1.0, duration: 0.14, ease: 'power2.out' }, T0 + SLIDE - 0.16)
      .to(body, { rotation: 0, duration: 0.3, ease: 'elastic.out(1, 0.45)' }, T0 + SLIDE - 0.02)
      // bumps in the road
      .to(body, { keyframes: Array.from({ length: 14 }, (_, i) => ({ y: i % 2 ? 0 : -M(0.018 + (i % 3) * 0.006), ease: 'sine.inOut' })), duration: SLIDE - 0.1 }, T0 + 0.05);
  }
  if (!calm && !lite) {
    story
      // layers blur with speed (closest the most), and sharpen as it settles
      .to(far, { filter: 'blur(1.1px)', duration: 0.3, ease: 'sine.in' }, T0 + 0.05)
      .to(far, { filter: 'blur(0px)', duration: 0.32, ease: 'sine.out' }, T0 + 0.45)
      .to(mid, { filter: 'blur(2px)', duration: 0.3, ease: 'sine.in' }, T0 + 0.05)
      .to(mid, { filter: 'blur(0px)', duration: 0.32, ease: 'sine.out' }, T0 + 0.45)
      .to(near, { filter: 'blur(2.6px)', duration: 0.3, ease: 'sine.in' }, T0 + 0.05)
      .to(near, { filter: 'blur(0px)', duration: 0.32, ease: 'sine.out' }, T0 + 0.45)
      // wind streaks
      .to(streaks, { autoAlpha: 1, duration: 0.15, ease: 'power1.out' }, T0 + 0.04)
      .to(streaks, { autoAlpha: 0, duration: 0.25, ease: 'power1.in' }, T0 + SLIDE - 0.25);
    qa('.home-service-streaks i').forEach((line) => {
      story.fromTo(line, { x: M(8) }, { x: -M(GAP * 1.35 * Number(line.dataset.k)), duration: SLIDE, ease: 'power2.inOut', immediateRender: false }, T0);
    });
  }

  // ------------------------------------------------------------------ pickup 2
  // out of his seat again, and three boxes in one go (the entrance is a step from the truck's rear)
  leaveSeat(1.95);
  walk(-0.85, 2.01, 0.2);
  swap('walk-l', 'recv-l', 2.21);
  story.to(qa('.pk'), { autoAlpha: 0, duration: 0.08 }, 2.31);
  swap('recv-l', 'carry-3', 2.31);
  story.to(partner, { x: -M(0.5), duration: 0.17, ease: 'power2.out' }, 2.43);   // the stack reaches the truck's rear and goes in
  count(1, 2, 2.6); count(2, 3, 2.64); count(3, 4, 2.68); plus(plusThree, 2.6);
  story.to(routeNodes[1], { backgroundColor: '#00c853', borderColor: '#00c853', scale: 1.35, duration: 0.1, ease: 'back.out(3)' }, 2.62);
  swap('carry-3', 'walk-r', 2.64, 0.06);
  walk(BEHIND, 2.7, 0.16, 'power2.in');                                             // back behind the truck
  backToSeat(2.7);

  // ------------------------------------------------------------------ done: two pickups, four parcels, one trip
  story.to(routeFill, { scaleX: 1, ease: 'power2.out', duration: 0.25 }, 2.92);
  story.to(routeNodes[2], { backgroundColor: '#00c853', borderColor: '#00c853', scale: 1.35, duration: 0.1, ease: 'back.out(3)' }, 3.08);
  drop(chipStop, 2.92); pop(chipTrip, 3.0);

  // ------------------------------------------------------------------ the skyline rises as the stage scrolls in
  if (!calm && scrollTrigger.trigger) {
    const buildings = qa('.st.bld');
    const life = qa('.st.life');
    gsap.set(buildings, { yPercent: 16, autoAlpha: 0 });
    gsap.set(life, { y: M(0.35), autoAlpha: 0 });
    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: scrollTrigger.trigger, start: 'top 92%', end: scrollTrigger.start, scrub: 0.5 },
    })
      .to(buildings, { yPercent: 0, autoAlpha: 1, duration: 1, ease: 'power3.out', stagger: { each: 0.1, from: 'center' } }, 0)
      .to(life, { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power2.out', stagger: { each: 0.035, from: 'random' } }, 0.35);
  }

  // ------------------------------------------------------------------ idle: standing figures breathe while the section is on screen
  if (!calm) {
    const idle = [...qa('.st.cust'), ...qa('.st.seller'), ...qa('.st.life')]
      .filter((el) => !/moto|scooter|bicycle|cart|menu/.test(el.querySelector('img')?.src || ''))
      .map((el, i) => gsap.to(el, {
        scaleY: 1 + 0.005 + (i % 3) * 0.0015, transformOrigin: '50% 100%', duration: 1.9 + (i % 5) * 0.31,
        ease: 'sine.inOut', yoyo: true, repeat: -1, delay: (i % 7) * 0.23, paused: true,
      }));
    ScrollTrigger.create({
      trigger: root, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => idle.forEach((t) => t.paused(!self.isActive)),
    });
  }

  // the layout settles after webfonts and images; re-fit then, for as long as this story exists
  const refit = () => {
    if (!story.scrollTrigger || !ScrollTrigger.getAll().includes(story.scrollTrigger)) { ScrollTrigger.removeEventListener('refresh', refit); return; }
    fitStreet(root);
  };
  ScrollTrigger.addEventListener('refresh', refit);

  return story;
}
