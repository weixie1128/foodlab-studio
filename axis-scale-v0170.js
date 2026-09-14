'use strict';
/*
 * FoodLab Studio v0.17.0 — log10 axis support
 *
 * Scope, as agreed: 折线图 / 平滑曲线图 / 散点图 / 气泡图 only.
 *
 * Why this file exists
 * --------------------
 * The value→pixel maths for a log axis lives in app.js (yValueMap,
 * experimentXAxisConfig, galleryRangeMap, formatLogTick, logTicksWithin ...),
 * but ONE of those functions is not reachable there: maintenance-v0149.js
 * replaces `chartBounds` wholesale, so editing the app.js copy has no effect.
 * This patch is installed last and wraps whatever `chartBounds` currently is,
 * which is the only reliable place to layer the log extent on top.
 *
 * Safety
 * ------
 *   - with yScale left at 'linear' this wrapper is a pure pass-through, so the
 *     rendered SVG is byte-identical to v0.16.0;
 *   - a log axis is refused (and the chart falls back to linear) whenever the
 *     data, including the ends of the error bars, contains 0 or a negative
 *     value, because log(0) does not exist;
 *   - the broken-axis plot never uses a log scale.
 */
(() => {
  const VERSION = '0.17.0';
  if (globalThis.__FOODLAB_AXIS_SCALE_0170__) return;
  globalThis.__FOODLAB_AXIS_SCALE_0170__ = true;

  function appState() {
    try { return typeof state !== 'undefined' ? state : globalThis.state; }
    catch (_err) { return globalThis.state; }
  }

  // Same value set the chart bounds are built from: for line/bar the ends of
  // every error bar are included, because those also have to be plottable.
  function chartValues() {
    const st = appState();
    const type = st?.chart?.type;
    const rows = st?.chartData || [];
    const out = [];
    for (const row of rows) {
      const mean = Number(row.mean);
      if (!Number.isFinite(mean)) continue;
      if (type === 'curve') { out.push(mean); continue; }
      out.push(mean);
      const error = Number(row.error);
      if (Number.isFinite(error)) { out.push(mean - error); out.push(mean + error); }
    }
    return out;
  }

  function install0170() {
    if (typeof chartBounds !== 'function' || chartBounds.__foodlabLogAxis0170) return;
    const previous = chartBounds;
    const wrapper = function foodlabChartBounds0170() {
      try {
        const st = appState();
        const settings = st?.chart?.settings;
        if (settings && settings.yScale === 'log' && !st?.chart?.breakAxis) {
          const values = chartValues();
          const usable = values.length > 0 && values.every(v => Number.isFinite(v) && v > 0);
          if (usable) {
            const dmin = Math.min(...values), dmax = Math.max(...values);
            const yMin = Number(settings.yMin), yMax = Number(settings.yMax);
            let lo = Number.isFinite(yMin) && yMin > 0 ? yMin : 10 ** Math.floor(Math.log10(dmin));
            let hi = Number.isFinite(yMax) && yMax > 0 ? yMax : 10 ** Math.ceil(Math.log10(dmax));
            if (!(hi > lo)) hi = lo * 10;
            return { min: lo, max: hi, log: true };
          }
        }
      } catch (error) {
        console.warn('[FoodLab v0.17.0] log bounds failed, falling back to linear', error);
      }
      return previous.apply(this, arguments);
    };
    wrapper.__foodlabLogAxis0170 = true;
    globalThis.chartBounds = wrapper;
    try { window.chartBounds = wrapper; } catch (_e) {}

    globalThis.FoodLabAxisScale0170 = Object.freeze({
      version: VERSION,
      supportedCharts: Object.freeze(['line', 'curve', 'scatter', 'bubble'])
    });
    console.info('[FoodLab Studio] log axis v0.17.0 active',
      '(line / curve / scatter / bubble; refuses data containing 0 or negatives)');
  }

  if (typeof document === 'undefined') return;
  // Last in the patch chain, so the wrapper sits outside the v0.14.9 bounds.
  if (document.readyState === 'complete') setTimeout(install0170, 0);
  else window.addEventListener('load', () => setTimeout(install0170, 0), { once: true });
})();
