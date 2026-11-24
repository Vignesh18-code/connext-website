// THE DESTINATION + APP DOWNLOAD — plays each panel's entrance once it comes
// into view (all motion is CSS on `.is-inview`, src/styles/destination.css),
// and drives the truck home: the services road runs on into the destination
// panel and the truck follows it with the scroll, parking at the delivery pin.
import { gsap, ScrollTrigger } from '../reveal.js';

// the overhead truck image (5760 x 1618) points right, cab first
const TRUCK_RATIO = 5760 / 1618;

export function initDestination() {
  const panels = document.querySelectorAll('.home-dest, .home-app');
  if (!panels.length) return;

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-inview');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.25 });
    panels.forEach((p) => io.observe(p));
  } else {
    panels.forEach((p) => p.classList.add('is-inview'));
  }

  initArrival();
}

function initArrival() {
  const section = document.querySelector('.home-dest');
  const scene = section?.querySelector('.dest-scene');
  if (!scene) return;

  const svg = scene.querySelector('.dest-road');
  const base = scene.querySelector('.dest-road-base');
  const line = scene.querySelector('.dest-road-line');
  const truck = scene.querySelector('.dest-truck');
  const route = scene.querySelector('.dest-truck-path');
  const pin = scene.querySelector('.dest-pin');
  // the truck parked at Why Connext: this one takes over from exactly where it stands
  const parked = document.querySelector('.home-service-new-truck-inner');
  const parkedStick = document.querySelector('.home-service-new-truck-stick');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = { p: reduced ? 1 : 0 };
  let geo = null;
  let handoff = false;     // true when the drive starts from the parked truck

  /** Where the road above sits on screen, so this one carries straight on. */
  const roadAbove = () => {
    const road = document.querySelector('.home-service-road-bot');
    if (!road || !road.getClientRects().length) return null;
    const r = road.getBoundingClientRect();
    return r.width > 20 ? { center: r.left + r.width / 2, width: r.width } : null;
  };

  const build = () => {
    const W = scene.clientWidth;
    const H = scene.clientHeight;
    if (!W || !H) return;
    const box = scene.getBoundingClientRect();
    const phone = window.innerWidth <= 767;
    // the road and parked truck above are only in their final places once the
    // page is down here, so wait until the panel is close
    if (!phone && box.top > window.innerHeight * 1.25) return;

    let d, roadW, truckL, pinX, pinY;
    let drive = null;        // the truck's route, when it differs from the road
    if (phone) {
      // a short strip under the copy: in from the left, home at the right
      roadW = 58;
      truckL = roadW * 0.42 * TRUCK_RATIO;
      pinY = H * 0.42;
      pinX = W - 24 - roadW / 2;
      d = `M ${-truckL - 20} ${pinY} H ${pinX}`;
      handoff = false;
      section.style.removeProperty('--dest-text-max');
    } else {
      // same x and width as the vertical road in the services story
      const above = roadAbove();
      const cx = above ? above.center - box.left : W * 0.5;
      roadW = above ? above.width : W * 0.141;
      truckL = roadW * 0.347 * TRUCK_RATIO;           // the same scale as the truck on that road
      const pad = parseFloat(getComputedStyle(section).paddingLeft) || 0;
      pinY = H * 0.56;
      pinX = W - pad - roadW / 2;
      const r = Math.min(roadW * 1.1, pinY * 0.75, (pinX - cx) * 0.4);
      const tail = `L ${cx} ${pinY - r} Q ${cx} ${pinY} ${cx + r} ${pinY} L ${pinX} ${pinY}`;
      // the road: down from the top edge (meeting the road above), a soft
      // right turn, then along to the pin
      d = `M ${cx} -2 ${tail}`;
      // the drive starts from the parked truck, same size and heading
      const t = parked && parked.getClientRects().length ? parked.getBoundingClientRect() : null;
      handoff = !!(t && t.width && t.bottom < box.top + 4);
      if (handoff) {
        truckL = Math.max(t.width, t.height);
        drive = `M ${t.left + t.width / 2 - box.left} ${t.top + t.height / 2 - box.top} ${tail}`;
      } else {
        drive = `M ${cx} ${-truckL} ${tail}`;
      }
      // keep the copy clear of the road
      section.style.setProperty('--dest-text-max', `${Math.max(320, cx - roadW / 2 - pad - 56)}px`);
    }

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    base.setAttribute('d', d);
    line.setAttribute('d', d);
    route.setAttribute('d', drive || d);
    base.style.strokeWidth = `${roadW}px`;
    scene.style.setProperty('--dest-truck-l', `${truckL}px`);
    scene.style.setProperty('--dest-ring', `${roadW * 0.8}px`);
    pin.style.transform = `translate(${pinX}px, ${pinY}px)`;

    // park with the cab just short of the ring around the pin
    const len = route.getTotalLength();
    const parkLen = len - (roadW * 0.4 + 14 + truckL / 2);
    geo = { len, parkLen, truckL, truckT: truckL / TRUCK_RATIO };
    render();
  };

  const render = () => {
    if (!geo) return;
    const dist = Math.max(0, state.p * geo.parkLen);
    const a = route.getPointAtLength(dist);
    const b = route.getPointAtLength(Math.min(geo.len, dist + 2));
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    truck.style.transform = `translate(${a.x - geo.truckL / 2}px, ${a.y - geo.truckT / 2}px) rotate(${angle}deg)`;
    scene.classList.toggle('is-arrived', state.p > 0.985);
    // one truck on screen: the parked one hands over the moment this one moves
    if (handoff) {
      const moving = state.p > 0.0005;
      truck.style.visibility = moving ? 'visible' : 'hidden';
      if (parkedStick) parkedStick.style.visibility = moving ? 'hidden' : '';
    } else {
      truck.style.visibility = 'visible';
      if (parkedStick) parkedStick.style.visibility = '';
    }
  };

  // the road above is only in its final place once the page has scrolled past
  // the turn, so measure lazily and again after every resize
  const ensure = () => { if (!geo) build(); };
  ScrollTrigger.addEventListener('refresh', () => { geo = null; ensure(); });

  if (reduced) {
    ensure();
    return;
  }

  gsap.to(state, {
    p: 1,
    ease: 'power2.inOut',
    onUpdate: () => { ensure(); render(); },
    scrollTrigger: {
      trigger: section,
      // desktop: a beat after the truck has parked at Why Connext, it pulls
      // away and drives down into this panel, arriving as it reaches the middle
      start: window.innerWidth <= 767 ? 'top bottom' : 'top 72%',
      end: window.innerWidth <= 767 ? 'bottom bottom' : 'center 55%',
      scrub: 0.8,
      onEnter: ensure,
      onEnterBack: ensure,
    },
  });
}
