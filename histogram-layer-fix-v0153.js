'use strict';
/*
 * FoodLab Studio v0.15.3 — Histogram paint-order / plot clipping fix
 *
 * Scientific rendering rule:
 *   data layer -> axes/ticks/titles -> legend
 * Bars still start exactly at y=0; the axis is NOT faked with a gap.
 */
(() => {
  if (globalThis.__FOODLAB_HISTOGRAM_LAYER_FIX_0153__) return;
  globalThis.__FOODLAB_HISTOGRAM_LAYER_FIX_0153__ = true;

  const VERSION = '0.15.3';

  function appState0153() {
    try { return typeof state !== 'undefined' ? state : globalThis.state; }
    catch (_err) { return globalThis.state; }
  }

  function histogramModel0153(rows, settings) {
    const helper = globalThis.FoodLabUnivariateCharts0152;
    if (helper?.histogramModel) return helper.histogramModel(rows, settings);
    return null;
  }

  function countTicks0153(maxValue) {
    const helper = globalThis.FoodLabUnivariateCharts0152;
    if (helper?.countTicks) return helper.countTicks(maxValue, 5);
    const top = Math.max(1, Math.ceil(maxValue));
    const step = Math.max(1, Math.ceil(top / 5));
    const axisTop = Math.ceil(top / step) * step;
    const ticks = [];
    for (let value = 0; value <= axisTop; value += step) ticks.push(value);
    return { ticks, top: axisTop };
  }

  function stepPath0153(arr, model, xMap, yMap) {
    let d = `M${xMap(model.min)},${yMap(0)}`;
    for (let i = 0; i < arr.length; i++) {
      const x0 = xMap(model.min + i * model.step);
      const x1 = xMap(model.min + (i + 1) * model.step);
      const y = yMap(arr[i]);
      d += ` L${x0},${y} L${x1},${y}`;
    }
    return d + ` L${xMap(model.max)},${yMap(0)}`;
  }

  function safeId0153() {
    return `foodlab-hist-clip-${Math.random().toString(36).slice(2, 9)}`;
  }

  function installRenderer0153() {
    if (typeof galleryHistogram !== 'function' ||
        typeof galleryPlotBox !== 'function' ||
        typeof scaleLinear !== 'function' ||
        typeof commonAxes !== 'function') return false;

    galleryHistogram = function foodlabGalleryHistogram0153(W, H) {
      const st = appState0153();
      const s = st?.gallery?.settings;
      const p = galleryPlotBox(W, H);
      const model = histogramModel0153(st?.gallery?.rows, s);
      if (!s || !model) return '';

      const { groups, min, max, step, heights, mode } = model;
      let rawYMax = 0;
      for (const row of heights) for (const value of row) if (Number.isFinite(value) && value > rawYMax) rawYMax = value;

      const xMap = scaleLinear(min, max, p.l, p.l + p.w);
      let yTop, yTicks;
      if (mode === 'count') {
        const axis = countTicks0153(rawYMax);
        yTop = axis.top;
        yTicks = axis.ticks;
      } else {
        yTop = rawYMax > 0 ? rawYMax * 1.10 : 1;
        yTicks = typeof makeTicks === 'function' ? makeTicks(0, yTop, null, 5) : [0, yTop];
      }
      const yMap = scaleLinear(0, yTop || 1, p.t + p.h, p.t);
      const xTicks = typeof makeTicks === 'function' ? makeTicks(min, max, null, 6) : [min, max];

      const requested = s.histDisplayMode || 'smart';
      const display = requested === 'smart' ? (groups.length > 1 ? 'outline' : 'overlay') : requested;
      const clipId = safeId0153();

      // Important: series are emitted FIRST. The axes are emitted afterwards,
      // so bars/paths can touch y=0 without visually erasing the baseline.
      let dataLayer = `<defs><clipPath id="${clipId}"><rect x="${p.l}" y="${p.t}" width="${p.w}" height="${p.h}"/></clipPath></defs>`;
      dataLayer += `<g data-foodlab-layer="data" clip-path="url(#${clipId})">`;

      heights.forEach((arr, gi) => {
        const style = typeof getGallerySeriesStyle === 'function'
          ? getGallerySeriesStyle(gi)
          : { color: '#4472c4', opacity: .72, lineWidth: 1.2 };
        let body = '';

        if (display === 'outline') {
          body = `<path d="${stepPath0153(arr, model, xMap, yMap)}" fill="none" stroke="${style.color}" stroke-width="${Math.max(1.2, Number(style.lineWidth) || 1.2)}" stroke-linejoin="miter" stroke-linecap="butt" vector-effect="non-scaling-stroke"/>`;
        } else {
          arr.forEach((height, i) => {
            const x0 = xMap(min + i * step);
            const x1 = xMap(min + (i + 1) * step);
            const opacity = groups.length > 1
              ? Math.min(.50, Number(style.opacity) || .45)
              : Number(style.opacity) || .72;
            body += `<rect x="${x0}" y="${yMap(height)}" width="${Math.max(.5, x1 - x0)}" height="${Math.max(0, p.t + p.h - yMap(height))}" fill="${style.color}" fill-opacity="${opacity}" stroke="${style.color}" stroke-width="${Math.max(.4, Number(style.lineWidth) || .8)}" vector-effect="non-scaling-stroke"/>`;
          });
        }
        dataLayer += `<g data-gobject="series" data-gseries="${gi}" class="chart-object">${body}</g>`;
      });
      dataLayer += '</g>';

      // Axes, ticks and axis titles must be visually above data.
      const axesLayer = `<g data-foodlab-layer="axes">${commonAxes(W, H, p, xTicks, yTicks, v => xMap(v), yMap)}</g>`;
      const legendLayer = typeof galleryLegend === 'function'
        ? `<g data-foodlab-layer="legend">${galleryLegend(groups)}</g>`
        : '';

      return dataLayer + axesLayer + legendLayer;
    };
    return true;
  }

  function reinforceSmartDefault0153() {
    const st = appState0153();
    const s = st?.gallery?.settings;
    if (!s) return;
    if (!s.histDisplayMode) s.histDisplayMode = 'smart';
  }

  function syncVersion0153() {
    document.documentElement.dataset.foodlabHistogramLayer = VERSION;
    const foot = document.querySelector('.sidebar-foot');
    if (foot) foot.textContent = 'v0.15.3 · 直方图图层与坐标轴修正版';
  }

  function install0153() {
    reinforceSmartDefault0153();
    const ok = installRenderer0153();
    syncVersion0153();
    if (ok) {
      try {
        const st = appState0153();
        if (st?.chart?.mode === 'gallery' && st?.gallery?.type === 'hist' && typeof renderGalleryChart === 'function') renderGalleryChart();
        if (st?.chart?.mode === 'gallery' && st?.gallery?.type === 'hist' && typeof renderGalleryStudioCanvas === 'function') renderGalleryStudioCanvas();
      } catch (error) {
        console.warn('[FoodLab v0.15.3] histogram redraw failed', error);
      }
      console.info('[FoodLab Studio] histogram layer fix v0.15.3 active');
    } else {
      console.warn('[FoodLab Studio] histogram layer fix v0.15.3 could not install');
    }
  }

  if (typeof document === 'undefined') return;
  // Run after the page's own scripts and earlier FoodLab patches have settled.
  if (document.readyState === 'complete') setTimeout(install0153, 0);
  else window.addEventListener('load', () => setTimeout(install0153, 0), { once: true });
})();
