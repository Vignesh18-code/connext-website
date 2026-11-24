// THE PICKUP — plays its entrance (copy, lit windows, truck driving in) once,
// the first time the section is properly in view. All motion is CSS, keyed
// off `.is-inview` (src/styles/pickup.css).
export function initPickup() {
  const section = document.querySelector('.home-pickup');
  if (!section) return;

  if (!('IntersectionObserver' in window)) {
    section.classList.add('is-inview');
    return;
  }
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    section.classList.add('is-inview');
    io.disconnect();
  }, { threshold: 0.3 });
  io.observe(section);
}
