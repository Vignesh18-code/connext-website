// WORLD, shot 1 — the camera starts high above a Chennai street, follows the Connext truck down as it drives in, and lands
// low beside it at a home's gate, where the resident hands a parcel to the driver. The scene is src/world/scene.js; the scroll
// logic, lazy loading, quality step-down and fallbacks are shared with the other stage (src/sections/stage.js).
import { initScrollStage } from './stage.js';

export function initWorld() {
  initScrollStage({
    wrapSelector: '.home-world-wrap',
    load: async ({ canvas, quality }) => (await import('../world/scene.js')).createWorld({ canvas, quality }),
    stillAt: 0.94,
    debugName: '__connextWorld',
  });
}
