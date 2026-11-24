// SERVICE — the scroll-driven parcel story.
//
// A Connext truck collects one parcel at a doorstep, drives on, and collects
// three more at a seller's counter, then the camera pulls back over the services
// panel and flips overhead. The street is layered cut-outs moved with transforms;
// the canvas frame-sequence is only used for the truck's flip to the overhead view.
import {
  gsap, ScrollTrigger, revealGroup, TextReveal, FadeUp, LineReveal, rem, isMobile,
} from '../reveal.js';
import '../styles/section-sizing.css';
import { initServiceMobile } from './service-mobile.js';
import { FrameSequence, frameUrls } from '../frame-sequence.js';
import { buildStreetStory } from './street-story.js';

const vh = (n) => (window.innerHeight * n) / 100;
const vw = (n) => (window.innerWidth * n) / 100;
const spin = { rotationZ: gsap.utils.unitize((v) => parseFloat(v) % 360) };

export function initService() {
  const root = document.querySelector('.home-service-wrap');
  if (!root) return;

  speedometer(root);   // runs off the ticker and needs no measuring

  // Everything below is measured in pixels (metres on the street, vh and rem in the drive), so it is built as one
  // unit that can be torn down and built again: whenever the viewport really changes — a window resize, a tablet
  // turned on its side, a foldable opening — the section is rebuilt for the new size and breakpoint.
  let unmount = mount(root);

  let width = window.innerWidth;
  let height = window.innerHeight;
  let timer = 0;
  const coarse = window.matchMedia('(pointer: coarse)');
  const onResize = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // a phone's address bar sliding away changes the height by a few dozen pixels: that is not a resize
      const dw = Math.abs(window.innerWidth - width);
      const dh = Math.abs(window.innerHeight - height);
      if (dw < 2 && dh < (coarse.matches ? 160 : 24)) return;
      width = window.innerWidth;
      height = window.innerHeight;
      unmount();
      unmount = mount(root);
      ScrollTrigger.refresh();
    }, 250);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  if (import.meta.hot) import.meta.hot.dispose(() => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    unmount();
  });
}

/** Builds the scrubbed part of the section for the current viewport; returns the function that takes it down. */
function mount(root) {
  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => [...root.querySelectorAll(sel)];
  const sequences = [];
  let alive = true;
  let context;

  context = gsap.context(() => {
    if (isMobile()) { initServiceMobile(root); return; }
    reveals(root, q, qa);
    const drive = stage(root, q, qa);
    scheduleHorizontalReveals(root, q, qa, drive, () => (alive ? context : null));
    sequences.push(...frameSequences(root, q));
  }, root);

  return () => {
    alive = false;
    sequences.forEach((sequence) => sequence.destroy());
    context.revert();
  };
}

/* -------------------------------------------------------------------------
   Speedometer — reads km/h off scroll velocity, eased so it settles rather
   than flickering, with a little jitter once you are really moving.
   ------------------------------------------------------------------------- */
function speedometer(root) {
  const inner = root.querySelector('.home-service-speed-inner');
  const out = root.querySelector('[data-speed]');
  if (!inner || !out) return;

  let shown = 0;
  let target = 0;
  let lastScroll = window.scrollY;

  gsap.ticker.add((_time, deltaMs) => {
    const scroll = window.lenis ? window.lenis.scroll : window.scrollY;

    if (inner.classList.contains('active') && inner.classList.contains('on-start')) {
      let velocity = Math.abs(scroll - lastScroll) / (deltaMs / 1000);
      if (!Number.isFinite(velocity)) velocity = 0;
      const jitter = velocity > 500 ? Math.random() * 2 - 1 : 0;
      target = Math.min(95, velocity / 25 + jitter);
    } else {
      target = 0;
    }

    // chase up quickly, fall away slowly
    const ease = target > shown ? 0.1 : target === 0 ? 0.15 : 0.06;
    shown += (target - shown) * ease;
    if (shown < 0.5 && target === 0) shown = 0;

    const rounded = Math.round(shown);
    if (out.dataset.currentSpeed !== String(rounded)) {
      out.textContent = String(rounded).padStart(2, '0');
      out.dataset.currentSpeed = String(rounded);
    }
    lastScroll = scroll;
  });
}

/* -------------------------------------------------------------------------
   Entrance reveals for the copy that is not part of the scrubbed stage.
   ------------------------------------------------------------------------- */
function reveals(root, q, qa) {
  // one heading + copy per block on the overhead road (how it works, why Connext)
  // only what this layout shows: the desktop stage and the mobile list each carry
  // a copy, and a trigger on a display:none copy fires (and, being `once`,
  // kills itself) while the rest are still being created
  const shown = (el) => el.getClientRects().length > 0;

  qa('.home-service-stick.third-screen').filter(shown).forEach((block) => {
    const title = block.querySelector('.home-service-title');
    const desc = block.querySelector('.home-service-desc');
    revealGroup({
      triggerInit: root,
      scrollTrigger: { trigger: title },
      tweens: () => [
        new FadeUp({ el: block.querySelector('.home-service-eyebrow') }),
        new TextReveal({ el: title.querySelector('.heading') }),
      ],
    });
    revealGroup({
      triggerInit: root,
      scrollTrigger: { trigger: desc },
      tweens: () => [new TextReveal({ el: desc.querySelector('.txt') })],
    });
  });

  const subItems = qa('.home-service-sub-item').filter(shown);
  gsap.set(subItems, { autoAlpha: 0 });
  ScrollTrigger.batch(subItems, {
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
            new FadeUp({ el: item }),
            new TextReveal({ el: item.querySelector('.home-service-sub-title .heading') }),
            new TextReveal({ el: item.querySelector('.home-service-sub-desc .txt') }),
            new LineReveal({ el: item }),
          ],
        });
      });
    },
  });
}

/* -------------------------------------------------------------------------
   The services headline and cards scroll sideways, so their entrances are
   measured along that tween rather than down the page. A containerAnimation
   trigger can only be built once the driving tween's own ScrollTrigger has
   resolved an `end`, so this retries on the next frame until it has one.
   ------------------------------------------------------------------------- */
function scheduleHorizontalReveals(root, q, qa, drive, getContext, attempt = 0) {
  requestAnimationFrame(() => {
    const context = getContext();
    if (!context) return;                       // this build has already been torn down
    const container = drive?.scrollTrigger;

    if (!Number.isFinite(container?.end)) {
      if (attempt < 2 && root.isConnected) scheduleHorizontalReveals(root, q, qa, drive, getContext, attempt + 1);
      return;
    }

    context.add(() => {
    revealGroup({
      triggerInit: root,
      scrollTrigger: { trigger: q('.home-service-main-inner'), start: 'left left', containerAnimation: drive },
      containerAnimation: drive,
      stagger: 0.05,
      tweens: () => [
        new TextReveal({ el: q('.home-service-title') }),
        new FadeUp({ el: q('.home-service-btn-wrap') }),
        new TextReveal({ el: q('.home-service-sub .txt') }),
      ],
    });

    qa('.home-service-item').forEach((item) => {
      revealGroup({
        triggerInit: item,
        scrollTrigger: { trigger: item, start: 'left left+=60%', containerAnimation: drive },
        containerAnimation: drive,
        tweens: () => [
          new FadeUp({ el: item }),
          ...[...item.querySelectorAll('.home-service-item-title .heading h3')].map((el) => new TextReveal({ el })),
          new TextReveal({ el: item.querySelector('.home-service-item-desc .txt') }),
        ],
      });
    });
    });
  });
}

/* -------------------------------------------------------------------------
   The scrubbed stage.
   ------------------------------------------------------------------------- */
function stage(root, q, qa) {
  const first = q('.home-service-first-screen');
  const second = q('.home-service-second-screen');
  const wide = window.innerWidth > 991;

  /* --- beats 1-2: the street — one parcel, then three (see street-story.js) ---
     One scrubbed timeline that ends exactly where the services-panel drive begins. */
  // how much scroll the pickup story gets, in vh: one number in the CSS (--story on .home-service)
  const STORY_VH = parseFloat(getComputedStyle(q('.home-service')).getPropertyValue('--story')) || 250;
  buildStreetStory({
    root: q('.home-service'),   // the desktop section (the mobile one carries its own copy of the street)
    // starts once the street stage has settled (its ground line is then level with the truck's wheels)
    scrollTrigger: { trigger: first, start: `top+=${q('.home-service-land').offsetHeight} top`, end: `top+=${vh(STORY_VH)} top` },
    M: (n) => rem(n * (wide ? 90.2 : 51.8)),   // metres → px, at the scale the street's --m draws the truck (9.02 / 5.18 section-rem per metre)
    truck: q('.home-service-truck'),
    body: q('.home-service-truck-car-wrap'),
    wheels: qa('.home-service-truck-wheel-i'),
  });

  /* --- beat 3: pull back, and drive the services panel past -------------- */
  gsap.set(q('.home-service-main'), { autoAlpha: 0 });

  const panel = q('.home-service-main-inner');
  const panelWidth = panel.offsetWidth;
  const textHold = window.innerWidth / (panelWidth + window.innerWidth);
  const label = q('.home-service-label');

  const drive = gsap.timeline({
    scrollTrigger: {
      trigger: first,
      start: `top+=${vh(STORY_VH)} top`,    // the drive begins where the pickup story ends
      endTrigger: second,
      end: `bottom-=${vh(100)} bottom`,
      scrub: true,
      onEnter: () => {
        gsap.set(qa('.home-service-main, .home-service-main-inner'), { autoAlpha: 1 });
        q('.home-service-speed-inner').classList.add('active');
      },
      onLeaveBack: () => {
        gsap.set(qa('.home-service-main, .home-service-main-inner'), { autoAlpha: 0 });
        q('.home-service-speed-inner').classList.remove('active');
      },
    },
  });

  drive
    .to(q('.home-service-stick.second-screen'), { top: 0, ease: 'sine.inOut', duration: 1 }, '<=0')
    .to(q('.home-service-land'), { height: vh(60), ease: 'sine.inOut', duration: 1 }, '<=0')
    .to(q('.home-service-truck-inner'), {
      transformOrigin: '0% 100%', scale: wide ? 0.82 : 1, ease: 'sine.inOut', duration: 1, immediateRender: false,
    }, '<=0')
    .to(q('.home-service-scene'), {
      transformOrigin: '-5% 100%', scale: wide ? 0.55 : 0.95, ease: 'sine.inOut', duration: 1,
    }, '<=0')
    // the street slides out of frame behind the truck
    .to(q('.home-service-scene'), {
      xPercent: -80, filter: 'blur(5px)', y: rem(5), ease: 'linear', duration: 1,
    }, '<=0.4')
    .to(qa('.home-service-truck-wheel-i'), {
      rotationZ: 2880, ease: 'linear', duration: 1, modifiers: spin,
      onStart: () => q('.home-service-speed-inner').classList.add('on-start'),
      onReverseComplete: () => q('.home-service-speed-inner').classList.remove('on-start'),
    }, '<=0')
    .to(q('.home-service-truck-inner'), { xPercent: wide ? -12 : -20, ease: 'none', duration: 0.5 }, '<=.48')
    .to(label, { autoAlpha: 1, duration: 0, ease: 'none' }, '<=0')
    .to(label, { x: -label.offsetWidth, duration: 3, ease: 'none' }, '<=0')
    // The reference starts the headline in place and scrolls the cards past it.
    .to(panel, { x: -panelWidth, duration: 3, ease: 'none' }, '<=0')
    // the headline holds on screen until the cards have cleared it
    .to(q('.home-service-text-wrap'), {
      keyframes: [
        { x: 0, duration: 3 * textHold, ease: 'none' },
        { x: wide ? 0 : panelWidth, duration: 3 * (1 - textHold), ease: 'none' },
      ],
      ease: 'none',
    }, '<=0')
    .to(q('.home-service-land'), { autoAlpha: 0, duration: 0, ease: 'none' }, '<=.32')
    .to(q('.home-service-truck-inner'), {
      xPercent: 0, x: wide ? rem(325) : 0, duration: 2, ease: 'none',
    }, '<=0.2')
    .to(qa('.home-service-truck-wheel-i'), {
      rotationZ: 4320, ease: 'linear', duration: 2, modifiers: spin,
    }, '<=0');

  /* --- beat 4: the camera flips overhead --------------------------------- */
  const road = q('.home-service-road');
  const scaleFactor = vh(60) / rem(wide ? 244 : 172.3);
  gsap.set(q('.home-service-road-big'), { autoAlpha: 0, filter: 'blur(1px)' });

  const flip = gsap.timeline({
    scrollTrigger: {
      trigger: second,
      start: `bottom-=${vh(180) + 1} bottom`,
      end: `bottom-=${vh(100)} bottom`,
      scrub: true,
    },
  });

  const cms = q('.home-service-cms');
  const mainPadTop = parseFloat(getComputedStyle(q('.home-service-main')).paddingTop);

  flip
    // the cards tip away from the camera
    .to(qa('.home-service-cms, .home-service-btn-wrap'), {
      autoAlpha: 0,
      rotationX: wide ? -90 : 0,
      y: wide ? cms.offsetHeight + mainPadTop : 0,
      filter: 'blur(2px)',
      duration: 1,
      ease: 'none',
    })
    .to(q('.home-service-main'), {
      '--road-height': `${vh(20)}px`, keyframes: { '0%': { '--bright-fade': 0 }, '40%': { '--bright-fade': 1 }, '100%': { '--bright-fade': 0 } }, backgroundColor: '#0C0C0C', duration: 1, ease: 'none',
    }, wide ? '<=0' : '<=0.9')
    .to(q('.home-service-road-big'), {
      x: -vw(100), filter: 'blur(0px)', autoAlpha: 1, duration: 1, ease: 'none',
    }, '<=0')
    .to(q('.home-service-main-road.top'), { backgroundColor: '#0C0C0C', duration: 1, ease: 'none' }, '<=0')
    .fromTo(q('.home-service-road-big-img'), { scaleY: 0 }, {
      scaleY: 1, backgroundColor: '#0C0C0C', duration: 1, ease: 'none',
    }, '<=0')
    // swap the side-on truck for the top-down one
    .to(qa('.home-service-truck-car, .home-service-truck-wheel, .home-service-truck-seat'), {
      autoAlpha: 0, duration: 0, ease: 'none',
    }, '<=.05')
    .to(q('.home-service-truck-sq'), { autoAlpha: 1, duration: 0, ease: 'none' }, '<=0')
    .to(q('.home-service-text-wrap'), {
      rotationX: wide ? 0 : -90,
      y: wide ? 0 : q('.home-service-text-wrap').offsetHeight + 3 * mainPadTop,
      filter: 'blur(2px)',
      autoAlpha: 0,
      duration: 1,
      ease: 'none',
    }, '<=0')
    .to(label, { y: cms.offsetHeight + mainPadTop, autoAlpha: 0, duration: 1, ease: 'none' }, '<=0')
    .to(q('.home-service-truck-inner'), {
      y: vh(10), yPercent: wide ? 35 : 58, duration: 1, ease: 'none',
    }, '<=0.1')
    // the overhead layers are sized for the truck at its original drive scale, so it eases back to that
    // as the camera rises (the flip frames push in at the same time, so it still reads as one move)
    .to(q('.home-service-truck-inner'), { scale: wide ? 0.6 : 1, duration: 1, ease: 'none' }, '<=0')
    .to(q('.home-service-truck-sq'), {
      bottom: 0, left: 0, scale: 1.04 * 1.0435, duration: 1, ease: 'none',
    }, '<=0')
    .to(q('.home-service-truck-sq'), { autoAlpha: 0, duration: 0, ease: 'none' })
    .to(q('.home-service-new-truck-wrap'), { autoAlpha: 1, duration: 0, ease: 'none' }, '<=0')
    .to(qa('.home-service-new-truck-inner'), { x: wide ? 0 : rem(-20), duration: 0, ease: 'none' }, '<=0');

  /* --- beat 5: the curve, and the container comes off -------------------- */
  road.style.setProperty('--scale-factor', scaleFactor);

  const newTruck = qa('.home-service-new-truck');
  const truckHeightRem = (wide ? 782.675 : 748.816) / (2880 / 809);
  const truckScale = (wide ? 244 : 172.3) / truckHeightRem;

  const curve = gsap.timeline({
    scrollTrigger: {
      trigger: second,
      start: `bottom-=${vh(100)} bottom`,
      end: 'bottom bottom',
      scrub: true,
      fastScrollEnd: true,
    },
  });

  curve
    .to(qa('.home-service-new-truck-inner'), { xPercent: 0, yPercent: 0, duration: 0.5 })
    .to(q('.home-service-road-big'), { x: -vw(200), duration: 1, ease: 'none' }, '<=0')
    .from(q('.home-service-road-wrap'), { x: vw(100), duration: 1, ease: 'none' }, '<=0')
    .to(road, { '--scale-factor': 1, duration: 0.5, ease: 'none' }, '<=.6')
    .to(q('.home-service-main'), { scale: 1 / scaleFactor, duration: 0.5, ease: 'none' }, '<=0')
    .to(newTruck, { scale: truckScale, yPercent: -80, y: 0, duration: 0.5, ease: 'none' }, '<=0')
    .to(q('.home-service-new-truck-stick'), { top: vh(20), duration: 0.5, ease: 'none' }, '<=0')
    .to(qa('.home-service-new-truck-inner'), {
      scale: wide ? 0.346 : 0.49,
      xPercent: -60,
      y: -rem(120),
      yPercent: wide ? -0.3 : -0.8,
      x: 0,
      duration: 0.5,
      ease: 'none',
    }, '<=0')
    // the turn itself: the truck is one rigid body, so cab and box turn together
    .to(qa('.home-service-new-truck-rot'), { rotation: 90, duration: 1, ease: 'power1.inOut' })
    .to(qa('.home-service-road-wrap, .home-service-main'), { y: -rem(120), duration: 0.6, ease: 'none' }, '<=0')
    .to(qa('.home-service-new-truck-rot'), { y: -rem(220), duration: 0.7, ease: 'none' }, '<=0')
    .to(q('.home-service-main'), { autoAlpha: 0, duration: 0, ease: 'none' }, '<=0');

  /* --- beat 6: drive past the three steps, park beside the Why Connext cards -- */
  const subList = q('.home-service-sub-list.is-why');   // the desktop stage's last list (the mobile copy has no .is-why)
  const parkTop = rem(wide ? 650 : 560);

  gsap.timeline({
    scrollTrigger: { trigger: subList, start: `top+=${vh(30)} bottom`, end: `top+=${vh(50)} center`, scrub: true },
  })
    .to(newTruck, { scale: truckScale, top: -parkTop, xPercent: 0, yPercent: 0, duration: 1, ease: 'none' }, '<=0')
    .to(qa('.home-service-new-truck-inner'), {
      x: 0, y: 0, xPercent: wide ? -9.4 : -3.4, duration: 1, ease: 'none',
    }, '<=0')
    .to(q('.home-service-new-truck-stick'), { top: 0, duration: 1, ease: 'none' }, '<=0')
    .to(qa('.home-service-new-truck-rot'), {
      y: -(parkTop - vh(50) + rem(((wide ? 244 : 172.3) / 809) * 2880 / 2)),
      duration: 1,
      ease: 'none',
    }, '<=0');

  /* --- beat 7: the truck stops at Why Connext --------------------------- */
  // From the moment the last card reaches the centre of the screen, the truck
  // is carried up at exactly the scroll speed, so it stands still on the road
  // beside it while the page (and the end of the road) scroll on past.
  const stopDistance = vh(240);
  const lastCard = [...subList.querySelectorAll('.home-service-sub-item')].pop();
  gsap.timeline({
    scrollTrigger: { trigger: lastCard, start: 'center center', end: `+=${stopDistance}`, scrub: true },
  })
    .fromTo(q('.home-service-new-truck-wrap'), { y: 0 }, { y: -stopDistance, duration: 1, ease: 'none', immediateRender: false });

  // the speedometer retires once the story is over
  ScrollTrigger.create({
    trigger: subList,
    start: 'bottom top+=62.5%',
    onEnter: () => q('.home-service-speed-inner').classList.remove('active', 'on-start'),
    onLeaveBack: () => q('.home-service-speed-inner').classList.add('active', 'on-start'),
  });

  return drive;
}


/* -------------------------------------------------------------------------
   The canvas sequence for the truck's flip to the overhead view.
   ------------------------------------------------------------------------- */
function frameSequences(root, q) {
  const second = q('.home-service-second-screen');
  const made = [];

  const truck = q('.home-service-truck-sq');
  if (truck) {
    const wide = window.innerWidth > 991;
    // narrow screens hold on the first frame for a beat before the flip starts
    const lead = wide ? [] : Array(20).fill(frameUrls('3-truck-flip', 1)[0]);
    made.push(new FrameSequence({
      canvas: truck,
      frames: [...lead, ...frameUrls('3-truck-flip', 45)],
      fit: 'contain',
      clear: true,
      scrollTrigger: {
        trigger: second,
        start: `bottom-=${vh(180)} bottom`,
        end: `bottom-=${vh(100)} bottom`,
        scrub: true,
      },
    }));
  }
  return made;
}
