// Procedural Milky-Way starfield painted onto #starCanvas.
// Approximates their star.avif (a dim Milky-Way photo @ ~0.18 opacity) plus a
// faint warm nebula toward the globe side. Repaints on resize.

export function initStarfield(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

  function rand(a, b) { return a + Math.random() * (b - a); }

  function paint() {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // base
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // ---- soft nebula clouds (very dim) --------------------------------
    const clouds = [
      { x: 0.66, y: 0.30, r: 0.55, c: 'rgba(60,42,80,0.10)' },   // cool violet
      { x: 0.78, y: 0.16, r: 0.42, c: 'rgba(90,50,30,0.12)' },   // warm, globe side
      { x: 0.40, y: 0.55, r: 0.60, c: 'rgba(40,44,70,0.08)' },   // cool blue
      { x: 0.20, y: 0.20, r: 0.35, c: 'rgba(50,50,60,0.06)' },
    ];
    for (const cl of clouds) {
      const g = ctx.createRadialGradient(
        cl.x * w, cl.y * h, 0,
        cl.x * w, cl.y * h, cl.r * Math.max(w, h),
      );
      g.addColorStop(0, cl.c);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // ---- Milky-Way band: a diagonal swathe of denser, dimmer stars -----
    const bandAngle = -0.62;              // radians, top-left -> bottom-right-ish
    const cx = w * 0.55, cy = h * 0.42;
    const cos = Math.cos(bandAngle), sin = Math.sin(bandAngle);

    const total = Math.round((w * h) / 1400);   // overall density
    for (let i = 0; i < total; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;

      // distance from the band centreline
      const dx = x - cx, dy = y - cy;
      const along = dx * cos + dy * sin;      // eslint-disable-line no-unused-vars
      const across = -dx * sin + dy * cos;
      const band = Math.exp(-(across * across) / (2 * (h * 0.22) ** 2)); // 0..1

      // keep field stars everywhere, but bias extra density into the band
      if (Math.random() > 0.35 + band * 0.55) continue;

      const bright = Math.random();
      let a, size;
      if (bright > 0.985) { a = rand(0.7, 1); size = rand(1.3, 2.1); }
      else if (bright > 0.9) { a = rand(0.35, 0.7); size = rand(0.9, 1.4); }
      else { a = rand(0.05, 0.28) * (0.5 + band); size = rand(0.5, 1); }

      // subtle colour temperature
      const t = Math.random();
      const col = t > 0.8 ? `255,225,200` : t < 0.15 ? `205,220,255` : `255,255,255`;

      ctx.fillStyle = `rgba(${col},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // faint glow on the brightest few
      if (bright > 0.985) {
        const gg = ctx.createRadialGradient(x, y, 0, x, y, size * 6);
        gg.addColorStop(0, `rgba(${col},0.22)`);
        gg.addColorStop(1, 'transparent');
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(x, y, size * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  paint();
  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(paint);
  });
  ro.observe(canvas);

  return { repaint: paint, destroy: () => ro.disconnect() };
}
