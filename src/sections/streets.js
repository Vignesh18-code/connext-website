// STREETS — Pondy Bazaar (T. Nagar, Chennai) from straight above, with live traffic. It opens on that exact picture; scrolling makes a Connext
// truck pull out, drive along the street and stop at a shop while the camera follows it down. The scene is src/world/streets.js
// (real OpenStreetMap layout); the scroll logic is shared with the other stage (stage.js).
import { initScrollStage } from './stage.js';

export function initStreets() {
  initScrollStage({
    wrapSelector: '.home-streets-wrap',
    load: async ({ canvas, quality }) => (await import('../world/streets.js')).createStreets({ canvas, quality }),
    stillAt: 0,   // reduced motion: the opening picture
    debugName: '__connextStreets',
    live: true,   // the traffic keeps moving while you look
    slowMs: 19,   // keep frames at about 60 a second: step the sharpness down early rather than let the scroll stutter
  });
}
