// Reveal primitives — ports of the four tween classes the original composes
// every on-scroll entrance from, plus the batch runner that sequences them.
//
//   TextReveal  sweeps a clipped gradient across each line of text
//   FadeUp      opacity + 3.2rem translate, power3
//   LineReveal  scaleX/scaleY 0 -> 1 for the hairline rules
//   ImgReveal   clip-path inset(20%) -> inset(0) with the image scaling 1.4 -> 1
//   revealGroup runs an array of the above off one ScrollTrigger, staggered
//
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

/** rem helper: their `pt()` — a design-pixel value scaled by the fluid root. */
export const rem = (px) =>
  (px / 10) * window.innerWidth * (window.innerWidth <= 767 ? .025445292621 : window.innerWidth <= 991 ? .010090817356 : .0057870370373);

export const isMobile = () => window.innerWidth < 768;

const node = (el) => (el && el.length !== undefined && !el.tagName ? el[0] : el);

/* -------------------------------------------------------------------------- */

export class TextReveal {
  constructor({ el, delay, keepSplit, ...vars } = {}) {
    const target = node(el);
    if (!target || !target.textContent.trim()) return;
    this.delay = delay;

    // lock the measured width so re-flowing into lines can't reshape the block
    const originalWidth = target.style.width;
    const height = target.offsetHeight;
    const clipped = target.scrollHeight > height + 1;
    gsap.set(target, { width: target.offsetWidth + 5 });

    const split = new SplitText(target, { type: 'lines' });
    const lines = split.lines;
    if (!lines.length) return;

    if (clipped) gsap.set(target, { height, overflow: 'hidden' });

    lines.forEach((line) => {
      line.classList.add('split-line-p');
      // remember the colour the line would otherwise have painted in, so the
      // gradient can land on it instead of a hard-coded token
      gsap.set(line, { '--color-final': getComputedStyle(line.parentElement).color });
    });
    gsap.set(lines, { '--bg-progress': '30' });

    this.animation = gsap.to(lines, {
      '--bg-progress': '100',
      stagger: 0.1,
      duration: 1.2,
      ease: 'power1.inOut',
      onComplete: () => {
        if (keepSplit) return;
        split.revert();
        target.style.width = originalWidth;
        if (clipped) gsap.set(target, { clearProps: 'height,overflow' });
      },
      ...vars,
    });
  }
  init() {}
}

/* -------------------------------------------------------------------------- */

const FADE_DIRECTIONS = {
  bottom: { y: 32 },
  top: { y: -32 },
  left: { x: 32 },
  right: { x: -32 },
};

export class FadeUp {
  constructor({ el, type = 'default', delay, keepProps, from, to, ...vars } = {}) {
    const target = node(el);
    if (!target) return;
    this.DOM = { el: target };
    this.delay = delay;

    const offset = FADE_DIRECTIONS[type] || FADE_DIRECTIONS.bottom;
    const axis = 'x' in offset ? 'x' : 'y';
    this.from = { opacity: 0, [axis]: rem(offset[axis]), ...from };
    this.to = { opacity: 1, [axis]: 0, ...to };

    this.animation = gsap.fromTo(target, this.from, {
      ...this.to,
      duration: 1,
      ease: 'power3',
      clearProps: keepProps ? '' : 'all',
      ...vars,
    });
  }
  init() {
    if (this.DOM) gsap.set(this.DOM.el, this.from);
  }
}

/* -------------------------------------------------------------------------- */

const LINE_ORIGINS = {
  top: { prop: 'scaleY', origin: 'top left' },
  left: { prop: 'scaleX', origin: 'top left' },
  right: { prop: 'scaleX', origin: 'top right' },
  bottom: { prop: 'scaleX', origin: 'bottom right' },
};

export class LineReveal {
  constructor({ el, type = 'default', isCenter, delay, keepProps, ...vars } = {}) {
    const target = node(el);
    if (!target) return;
    this.DOM = { el: target };
    this.delay = delay;

    const { prop, origin } = LINE_ORIGINS[type] || LINE_ORIGINS.left;
    this.from = { [prop]: 0, transformOrigin: isCenter ? 'center center' : origin };
    this.to = { [prop]: 1 };

    this.animation = gsap.fromTo(target, this.from, {
      ...this.to,
      duration: 1.2,
      ease: 'power1.out',
      clearProps: keepProps ? '' : 'all',
      ...vars,
    });
  }
  init() {
    if (this.DOM) gsap.set(this.DOM.el, this.from);
  }
}

/* -------------------------------------------------------------------------- */

export class ImgReveal {
  constructor({ el, elInner, delay, keepProps } = {}) {
    const target = node(el);
    if (!target) return;
    this.DOM = { el: target, elInner: node(elInner) || target.querySelector('img') };
    this.delay = delay;
    this.radius = gsap.getProperty(target, 'border-radius');

    this.animation = gsap
      .timeline()
      .to(target, {
        clipPath: `inset(0% round ${this.radius}px)`,
        duration: 2,
        ease: 'expo.out',
        clearProps: keepProps ? '' : 'all',
      })
      .to(this.DOM.elInner, {
        scale: 1,
        autoAlpha: 1,
        duration: 2,
        ease: 'expo.out',
        overwrite: true,
        clearProps: keepProps ? '' : 'all',
      }, '<=0');
  }
  init() {
    if (!this.DOM) return;
    gsap.set(this.DOM.el, { clipPath: `inset(20% round ${this.radius}px)` });
    gsap.set(this.DOM.elInner, { scale: 1.4, autoAlpha: 0 });
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Sequences an array of the primitives above off a single ScrollTrigger.
 *
 * Two triggers are involved, which is what makes the entrance read cleanly:
 * a priming trigger one viewport early calls `init()` on every tween so the
 * elements are already in their "before" state by the time they scroll up,
 * then the real trigger at `top 85%` plays the timeline.
 */
export function revealGroup({
  triggerInit,
  timeline,
  tweens,
  stagger = 0.1,
  scrollTrigger,
  allowMobile = false,
  containerAnimation,
} = {}) {
  if (isMobile() && !allowMobile) return null;

  const list = (typeof tweens === 'function' ? tweens() : tweens) || [];

  gsap.timeline({
    scrollTrigger: {
      trigger: triggerInit,
      start: 'top bottom+=100vh',
      end: 'bottom top',
      once: true,
      scrub: false,
      ...(containerAnimation && { containerAnimation }),
      onEnter: () => list.forEach((t) => t && typeof t.init === 'function' && t.init()),
    },
  });

  const tl =
    timeline ||
    gsap.timeline({
      scrollTrigger: {
        start: 'top top+=85%',
        end: '+=100%',
        scrub: false,
        once: true,
        ...scrollTrigger,
      },
    });

  list.forEach((t) => {
    if (t && t.animation) tl.add(t.animation, t.delay ?? `<=${stagger}`);
  });

  return tl;
}

export { gsap, ScrollTrigger, SplitText };
