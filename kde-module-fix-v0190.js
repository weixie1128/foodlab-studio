'use strict';
/*
 * FoodLab Studio v0.19.0 — restore the KDE module renderer
 *
 * chart-fixes.js ships a complete KDE implementation (curve / histogram+KDE /
 * ridgeline modes, bandwidth control, dash styles, fill toggle, rug marks) and
 * its own property panel. index.html's v0.11.5 block then replaced galleryKde
 * with a much simpler renderer, so the panel was talking to a renderer that
 * never read any of its settings — which is why "图形专属参数修改基本都失效".
 *
 * This patch runs last in the chain and puts the module renderer back. The
 * re-instated implementation already:
 *   - draws the density baseline on the X axis (Y floored at 0),
 *   - uses a line symbol in the legend (correct for a density curve),
 *   - spaces legend entries with a constant gap;
 * and it was extended in v0.19.0 to keep the numeric X/Y range controls working.
 */
(() => {
  const VERSION = '0.19.0';
  if (globalThis.__FOODLAB_KDE_MODULE_0190__) return;
  globalThis.__FOODLAB_KDE_MODULE_0190__ = true;

  function appState() {
    try { return typeof state !== 'undefined' ? state : globalThis.state; }
    catch (_err) { return globalThis.state; }
  }

  function install0190() {
    const moduleRenderer = globalThis.__foodlabGalleryKde;
    if (typeof moduleRenderer !== 'function') {
      console.warn('[FoodLab v0.19.0] KDE module renderer not found; keeping the previous renderer');
      return;
    }
    galleryKde = moduleRenderer;
    try { window.galleryKde = moduleRenderer; } catch (_e) {}

    // The page may already have drawn a KDE with the previous renderer, so
    // repaint once now that the module is back in charge.
    try {
      const st = appState();
      if (st?.chart?.mode === 'gallery' && st?.gallery?.type === 'kde' && typeof renderGalleryStudioCanvas === 'function') {
        renderGalleryStudioCanvas();
      }
    } catch (error) {
      console.warn('[FoodLab v0.19.0] KDE repaint after restore failed', error);
    }

    globalThis.FoodLabKde0190 = Object.freeze({ version: VERSION });
    console.info('[FoodLab Studio] KDE module restored v0.19.0',
      '(bandwidth / line style / fill toggle / rug / ridgeline now take effect)');
  }

  if (typeof document === 'undefined') return;
  if (document.readyState === 'complete') setTimeout(install0190, 0);
  else window.addEventListener('load', () => setTimeout(install0190, 0), { once: true });
})();
