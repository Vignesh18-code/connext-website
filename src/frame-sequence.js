// Canvas image-sequence player — the mechanism the reference uses for the two
// beats a layered cut-out can't express: the reach stacker lifting and turning,
// and the truck flipping to its overhead view.
//
// Frames are decoded lazily around the playhead and painted into a canvas
// that a scrubbed ScrollTrigger drives, so scrubbing back and forth stays
// smooth without holding 271 full-size bitmaps in memory at once.
import { gsap, ScrollTrigger } from './reveal.js';

export class FrameSequence {
  constructor({
    canvas,
    frames,
    fit = 'cover',
    clear = false,
    concurrency = 6,
    windowRadius = 12,
    scrollTrigger,
  }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.frames = frames;
    this.fit = fit;
    this.clear = clear;
    this.concurrency = concurrency;
    this.windowRadius = windowRadius;

    this.images = new Array(frames.length);
    this.pending = new Map();
    this.active = 0;
    this.queue = [];
    this.current = -1;
    this.playhead = { frame: 0 };
    this.destroyed = false;

    this._resize();
    this._observeSize();

    this.tween = gsap.to(this.playhead, {
      frame: frames.length - 1,
      ease: 'none',
      onUpdate: () => this._render(),
      scrollTrigger: { scrub: true, ...scrollTrigger },
    });

    // the first frame decides what is on screen before any scrolling happens
    this._request(0).then(() => this._render());
    this._fillWindow(0);
  }

  /* ---- sizing ---------------------------------------------------------- */

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.current = -1;
  }

  _observeSize() {
    this.resizeObserver = new ResizeObserver(() => {
      this._resize();
      this._render();
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 200);
    });
    this.resizeObserver.observe(this.canvas);
  }

  /* ---- loading --------------------------------------------------------- */

  _request(index) {
    if (index < 0 || index >= this.frames.length) return Promise.resolve(null);
    if (this.images[index]) return Promise.resolve(this.images[index]);
    if (this.destroyed) return Promise.resolve(null);
    if (this.pending.has(index)) return this.pending.get(index);

    this.active++;
    const request = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      const finish = (loaded) => {
        this.pending.delete(index);
        this.active--;
        if (!this.destroyed && loaded) this.images[index] = img;
        resolve(loaded ? img : null);
        if (!this.destroyed) this._drain();
      };
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      img.src = this.frames[index];
    });
    this.pending.set(index, request);
    return request;
  }

  /** Keeps a sliding window of frames decoded around the playhead. */
  _fillWindow(centre) {
    const lo = Math.max(0, centre - this.windowRadius);
    const hi = Math.min(this.frames.length - 1, centre + this.windowRadius);

    // Drop stale queued work on a scroll jump and decode the target first.
    this.queue = [];
    for (let distance = 0; distance <= this.windowRadius; distance++) {
      const candidates = distance ? [centre + distance, centre - distance] : [centre];
      for (const index of candidates) {
        if (index >= lo && index <= hi && !this.images[index] && !this.pending.has(index)) {
          this.queue.push(index);
        }
      }
    }
    // release anything well outside the window so long sequences stay cheap
    for (let i = 0; i < this.images.length; i++) {
      if (i < lo - this.windowRadius || i > hi + this.windowRadius) this.images[i] = undefined;
    }
    this._drain();
  }

  _drain() {
    if (this.destroyed) return;
    while (this.active < this.concurrency && this.queue.length) {
      const next = this.queue.shift();
      if (this.images[next] || this.pending.has(next)) continue;
      this._request(next).then((img) => { if (img) this._render(); });
    }
  }

  /* ---- painting -------------------------------------------------------- */

  _render() {
    if (this.destroyed) return;
    const target = Math.round(this.playhead.frame);
    if (target !== this.current) this._fillWindow(target);

    // fall back to the nearest decoded frame so scrubbing never blanks out
    let index = target;
    if (!this.images[index]) {
      for (let d = 1; d <= this.windowRadius; d++) {
        if (this.images[target - d]) { index = target - d; break; }
        if (this.images[target + d]) { index = target + d; break; }
      }
    }
    const img = this.images[index];
    if (!img) return;

    this.current = target;
    const { width: cw, height: ch } = this.canvas;
    if (this.clear) this.ctx.clearRect(0, 0, cw, ch);

    const scale = this.fit === 'contain'
      ? Math.min(cw / img.naturalWidth, ch / img.naturalHeight)
      : Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    this.ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.tween?.scrollTrigger?.kill();
    this.tween?.kill();
    clearTimeout(this.resizeTimer);
    this.queue.length = 0;
    this.images.length = 0;
  }
}

/** Builds the padded frame paths a downloaded sequence was saved under. */
export function frameUrls(name, count) {
  return Array.from(
    { length: count },
    (_, i) => `/assets/parcel-story/${name}/${String(i).padStart(3, '0')}.avif`,
  );
}
