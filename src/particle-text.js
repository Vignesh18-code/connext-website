// Particle wordmark. The footer logo is sampled from a source image on a grid;
// every opaque pixel becomes a dot that eases toward its home position and is
// shoved aside when the pointer comes near, then drifts back.
import { gsap } from './reveal.js';

const DEFAULTS = { imageSelector: '#source-image', color: '#111116', scale: 0.8 };

class Particle {
  constructor(originX, originY, field, color, dpr) {
    this.originX = originX;
    this.originY = originY;
    this.field = field;
    this.ctx = field.ctx;
    this.color = color;
    // dots fly in from random points the first time the field settles
    this.x = Math.random() * field.width;
    this.y = Math.random() * field.height;
    this.vx = 0;
    this.vy = 0;
    this.ease = 0.04 + 0.04 * Math.random();
    this.targetEase = 0.2 + 0.2 * Math.random();
    this.friction = 0.8 + 0.15 * Math.random();
    this.size = 2 * dpr;
  }

  update() {
    const { mouse } = this.field;
    if (mouse.isActive) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < mouse.radius) {
        // inside the pointer's reach the dot snaps back faster once released
        this.ease = this.targetEase;
        const dist = Math.sqrt(distSq);
        const force = (-(mouse.actualRadius - dist) / mouse.actualRadius) * 150 * (0.5 + Math.random());
        this.vx += (dx / dist) * force + (Math.random() - 0.5);
        this.vy += (dy / dist) * force + (Math.random() - 0.5);
      }
    }
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.x += this.vx + (this.originX - this.x) * this.ease;
    this.y += this.vy + (this.originY - this.y) * this.ease;

    this.ctx.fillStyle = this.color;
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

class Field {
  constructor(canvas, config, dpr, parentW, parentH) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.width = canvas.width;
    this.height = canvas.height;
    this.parentW = parentW || canvas.width;
    this.parentH = parentH || canvas.height;
    this.config = config;
    this.dpr = dpr;
    this.particles = [];
    // `gap` (css px between dots) is optional; the reference wordmark used 4
    this.gap = (config.gap || 4) * dpr;

    const radius = 3000 * dpr;
    this.mouse = { radius, actualRadius: Math.sqrt(radius), x: -1000, y: -1000, isActive: false, timeout: null };
    this.offset = { left: 0, top: 0 };

    this.updateOffset = () => {
      const box = this.canvas.getBoundingClientRect();
      this.offset.left = box.left + window.scrollX;
      this.offset.top = box.top + window.scrollY;
    };
    this.updateOffset();

    this.handleMouseMove = (event) => {
      this.mouse.x = (event.pageX - this.offset.left) * this.dpr;
      this.mouse.y = (event.pageY - this.offset.top) * this.dpr;
      this.mouse.isActive = true;
      clearTimeout(this.mouse.timeout);
      this.mouse.timeout = setTimeout(() => { this.mouse.isActive = false; }, 100);
    };
    window.addEventListener('mousemove', this.handleMouseMove);

    this.loadImage().then(() => this.init());
  }

  loadImage() {
    return new Promise((resolve) => {
      const source = this.config.imageSelector && document.querySelector(this.config.imageSelector);
      const src = source?.src;
      if (!src) return resolve();
      this.image = new Image();
      this.image.crossOrigin = 'Anonymous';
      this.image.onload = resolve;
      this.image.onerror = () => resolve();
      this.image.src = src;
      return undefined;
    });
  }

  resize(width, height, parentW, parentH) {
    this.width = width;
    this.height = height;
    if (parentW) this.parentW = parentW;
    if (parentH) this.parentH = parentH;
    this.updateOffset();
    this.init();
  }

  init() {
    this.particles = [];
    if (!this.image) return;

    const iw = this.image.width || this.image.naturalWidth || 300;
    const ih = this.image.height || this.image.naturalHeight || 150;
    const fit = Math.min(this.parentW / iw, this.parentH / ih) * (this.config.scale || 0.8);
    const w = iw * fit;
    const h = ih * fit;
    const left = (this.width - w) / 2;
    const top = (this.height - h) / 2;

    // draw once, read the pixels back, then clear — the canvas only ever
    // shows particles from here on
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.drawImage(this.image, left, top, w, h);
    const pixels = this.ctx.getImageData(0, 0, this.width, this.height);
    this.ctx.clearRect(0, 0, this.width, this.height);

    const y0 = Math.max(0, Math.floor(top));
    const y1 = Math.min(this.height, Math.ceil(top + h));
    const x0 = Math.max(0, Math.floor(left));
    const x1 = Math.min(this.width, Math.ceil(left + w));

    for (let y = y0; y < y1; y += this.gap) {
      for (let x = x0; x < x1; x += this.gap) {
        const i = 4 * (y * this.width + x);
        const alpha = pixels.data[i + 3];
        if (alpha > 0) {
          // `uniform: true` paints every dot in config.color (an even dotted wordmark);
          // otherwise each dot takes the colour of the pixel it was sampled from
          const color = this.config.uniform
            ? this.config.color
            : `rgba(${pixels.data[i]}, ${pixels.data[i + 1]}, ${pixels.data[i + 2]}, ${alpha / 255})`;
          this.particles.push(new Particle(x, y, this, color, this.dpr));
        }
      }
    }
  }

  update() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    for (let i = 0; i < this.particles.length; i++) this.particles[i].update();
  }

  destroy() {
    window.removeEventListener('mousemove', this.handleMouseMove);
    clearTimeout(this.mouse.timeout);
  }
}

export class ParticleText {
  constructor(canvas, options = {}) {
    this.canvas = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
    if (!this.canvas) return;

    this.config = { ...DEFAULTS, ...options };
    this.dpr = window.devicePixelRatio || 1;
    this.resize();
    this.field = new Field(this.canvas, this.config, this.dpr, this.parentW, this.parentH);

    this.handleResize = () => {
      this.resize();
      this.field.resize(this.canvas.width, this.canvas.height, this.parentW, this.parentH);
    };
    window.addEventListener('resize', this.handleResize);

    this.animate = () => this.field.update();
    // only burn frames while the footer is actually on screen
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) gsap.ticker.add(this.animate);
        else gsap.ticker.remove(this.animate);
      });
    });
    this.observer.observe(this.canvas);
  }

  /** The field is drawn larger than its box so dots can scatter off-wordmark. */
  resize() {
    const parent = this.canvas.parentNode || document.body;
    const pw = parent.clientWidth || window.innerWidth;
    const ph = parent.clientHeight || window.innerHeight;
    this.parentW = pw * this.dpr;
    this.parentH = ph * this.dpr;

    const w = 1.5 * pw;
    const h = 3 * ph;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    this.observer?.disconnect();
    gsap.ticker.remove(this.animate);
    this.field?.destroy();
  }
}
