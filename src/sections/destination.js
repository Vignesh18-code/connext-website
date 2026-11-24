// THE DESTINATION + APP DOWNLOAD — plays each panel's entrance once it comes
// into view (all motion is CSS on `.is-inview`, src/styles/destination.css).
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
}
