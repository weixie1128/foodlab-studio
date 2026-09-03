'use strict';
/*
 * FoodLab Studio v0.15.2 — univariate chart semantics + histogram fix
 *
 * Fixes:
 *  - scientific default axis meanings for Histogram/KDE/Box/Violin
 *  - robust live editing for X/Y axis titles in Chart Studio
 *  - histogram auto binning (Freedman–Diaconis / Sturges / Scott / manual)
 *  - common bin edges for all groups
 *  - integer Y ticks in count mode
 *  - optional count / relative-frequency / probability-density scaling
 *  - multi-group smart rendering: filled bars for one group, step outlines for
 *    multiple groups to avoid misleading colour mixing and occlusion
 */
(() => {
  if (globalThis.__FOODLAB_UNIVARIATE_CHART_FIXES_0152__) return;
  globalThis.__FOODLAB_UNIVARIATE_CHART_FIXES_0152__ = true;

  const VERSION = '0.15.2';
  const UNIVARIATE_TYPES = new Set(['hist', 'kde', 'box', 'violin']);
  const LEGACY_AXIS_WORDS = new Set(['', 'value', 'x', 'y', 'group', 'frequency', 'count', 'density', 'probability density', 'relative frequency']);

  function appState0152() {
    try { return typeof state !== 'undefined' ? state : globalThis.state; }
    catch (_err) { return globalThis.state; }
  }

  function currentType0152() {
    const st = appState0152();
    return String(st?.workflow?.chartType || st?.gallery?.type || '').trim().toLowerCase();
  }

  function finite0152(values) {
    const out = [];
    for (const value of values || []) {
      const n = Number(value);
      if (Number.isFinite(n)) out.push(n);
    }
    return out;
  }

  function quantile0152(values, p) {
    const a = finite0152(values).sort((x, y) => x - y);
    if (!a.length) return NaN;
    if (a.length === 1) return a[0];
    const h = (a.length - 1) * p;
    const i = Math.floor(h), f = h - i;
    return a[i] + (a[Math.min(i + 1, a.length - 1)] - a[i]) * f;
  }

  function sd0152(values) {
    const a = finite0152(values);
    if (a.length < 2) return NaN;
    const m = a.reduce((s, v) => s + v, 0) / a.length;
    return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
  }

  function clampInt0152(value, min, max, fallback) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }

  function sturgesBins0152(values) {
    const n = finite0152(values).length;
    return clampInt0152(Math.ceil(Math.log2(Math.max(2, n)) + 1), 4, 40, 8);
  }

  function fdBins0152(values) {
    const a = finite0152(values);
    if (a.length < 2) return 4;
    const min = Math.min(...a), max = Math.max(...a), range = max - min;
    if (!(range > 0)) return 4;
    const iqr = quantile0152(a, .75) - quantile0152(a, .25);
    const width = 2 * iqr * Math.pow(a.length, -1 / 3);
    if (!(width > 0) || !Number.isFinite(width)) return sturgesBins0152(a);
    return clampInt0152(Math.ceil(range / width), 4, 40, sturgesBins0152(a));
  }

  function scottBins0152(values) {
    const a = finite0152(values);
    if (a.length < 2) return 4;
    const min = Math.min(...a), max = Math.max(...a), range = max - min, sd = sd0152(a);
    if (!(range > 0) || !(sd > 0)) return sturgesBins0152(a);
    const width = 3.5 * sd * Math.pow(a.length, -1 / 3);
    if (!(width > 0) || !Number.isFinite(width)) return sturgesBins0152(a);
    return clampInt0152(Math.ceil(range / width), 4, 40, sturgesBins0152(a));
  }

  function effectiveBins0152(values, settings = {}) {
    const rule = settings.histBinRule || 'fd';
    if (rule === 'manual') return clampInt0152(settings.bins, 4, 40, 8);
    if (rule === 'sturges') return sturgesBins0152(values);
    if (rule === 'scott') return scottBins0152(values);
    return fdBins0152(values);
  }

  function niceIntegerStep0152(maxValue, target = 5) {
    const raw = Math.max(1, maxValue) / Math.max(2, target);
    const power = 10 ** Math.floor(Math.log10(raw));
    const fraction = raw / power;
    const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return Math.max(1, Math.ceil(nice * power));
  }

  function countTicks0152(dataMax, target = 5) {
    const step = niceIntegerStep0152(dataMax * 1.08, target);
    let top = Math.ceil((dataMax * 1.08) / step) * step;
    if (top <= dataMax) top += step;
    const ticks = [];
    for (let v = 0; v <= top + step * .001; v += step) ticks.push(v);
    return { ticks, top };
  }

  function histogramModel0152(rows, settings = {}) {
    const cleanRows = (rows || []).map(r => ({ Group: String(r?.Group || 'All'), Value: Number(r?.Value) })).filter(r => Number.isFinite(r.Value));
    const groups = [...new Set(cleanRows.map(r => r.Group))];
    const values = cleanRows.map(r => r.Value);
    if (!values.length) return null;

    let min = Math.min(...values), max = Math.max(...values);
    if (!(max > min)) {
      const pad = Math.max(Math.abs(min) * .05, .5);
      min -= pad; max += pad;
    }
    const bins = effectiveBins0152(values, settings);
    const step = (max - min) / bins;
    const counts = groups.map(() => Array(bins).fill(0));
    const groupN = groups.map(g => cleanRows.filter(r => r.Group === g).length);
    const groupIndex = new Map(groups.map((g, i) => [g, i]));

    cleanRows.forEach(r => {
      const gi = groupIndex.get(r.Group);
      let bi = Math.floor((r.Value - min) / step);
      if (r.Value === max) bi = bins - 1;
      bi = Math.max(0, Math.min(bins - 1, bi));
      counts[gi][bi]++;
    });

    const mode = settings.histYMode || 'count';
    const heights = counts.map((arr, gi) => arr.map(n => {
      if (mode === 'probability') return groupN[gi] ? n / groupN[gi] : 0;
      if (mode === 'density') return groupN[gi] && step > 0 ? n / (groupN[gi] * step) : 0;
      return n;
    }));

    return { groups, values, min, max, bins, step, counts, heights, groupN, mode };
  }

  function axisDefaults0152(type) {
    if (type === 'hist') return { x: 'Value', y: 'Frequency' };
    if (type === 'kde') return { x: 'Value', y: 'Probability density' };
    if (type === 'box' || type === 'violin') return { x: 'Group', y: 'Value' };
    return null;
  }

  function applyAxisDefaults0152(force = false) {
    const st = appState0152(), type = currentType0152();
    if (!st?.gallery?.settings || !UNIVARIATE_TYPES.has(type)) return;
    const d = axisDefaults0152(type), s = st.gallery.settings;
    if (!d) return;
    const xLegacy = LEGACY_AXIS_WORDS.has(String(s.xTitle ?? '').trim().toLowerCase());
    const yLegacy = LEGACY_AXIS_WORDS.has(String(s.yTitle ?? '').trim().toLowerCase());
    if (force || xLegacy) s.xTitle = d.x;
    if (force || yLegacy) s.yTitle = d.y;
    s.xTitleVisible = s.xTitleVisible !== false;
    s.yTitleVisible = s.yTitleVisible !== false;
  }

  function histogramYTitle0152(mode) {
    return mode === 'density' ? 'Probability density' : mode === 'probability' ? 'Relative frequency' : 'Frequency';
  }

  function histogramStepPath0152(arr, model, xMap, yMap) {
    const { min, step } = model;
    let d = `M${xMap(min)},${yMap(0)}`;
    for (let i = 0; i < arr.length; i++) {
      const x0 = xMap(min + i * step), x1 = xMap(min + (i + 1) * step), y = yMap(arr[i]);
      if (i === 0) d += ` L${x0},${y}`;
      else d += ` L${x0},${y}`;
      d += ` L${x1},${y}`;
    }
    d += ` L${xMap(model.max)},${yMap(0)}`;
    return d;
  }

  function installHistogramRenderer0152() {
    if (typeof galleryHistogram !== 'function' || typeof commonAxes !== 'function' || typeof galleryPlotBox !== 'function' || typeof scaleLinear !== 'function') return;
    galleryHistogram = function foodlabGalleryHistogram0152(W, H) {
      const st = appState0152(), s = st.gallery.settings, p = galleryPlotBox(W, H), model = histogramModel0152(st.gallery.rows, s);
      if (!model) return '';

      const { groups, min, max, step, heights, mode } = model;
      const rawYMax = Math.max(0, ...heights.flat());
      const xMap = scaleLinear(min, max, p.l, p.l + p.w);
      let yTop, yTicks;
      if (mode === 'count') {
        const countAxis = countTicks0152(rawYMax, 5);
        yTop = countAxis.top; yTicks = countAxis.ticks;
      } else {
        yTop = rawYMax > 0 ? rawYMax * 1.10 : 1;
        yTicks = typeof makeTicks === 'function' ? makeTicks(0, yTop, null, 5) : [0, yTop];
      }
      const yMap = scaleLinear(0, yTop || 1, p.t + p.h, p.t);
      const xTicks = typeof makeTicks === 'function' ? makeTicks(min, max, null, 6) : [min, max];
      let out = commonAxes(W, H, p, xTicks, yTicks, v => xMap(v), yMap) + (typeof galleryLegend === 'function' ? galleryLegend(groups) : '');

      const requested = s.histDisplayMode || 'smart';
      const display = requested === 'smart' ? (groups.length > 1 ? 'outline' : 'overlay') : requested;

      heights.forEach((arr, gi) => {
        const style = typeof getGallerySeriesStyle === 'function' ? getGallerySeriesStyle(gi) : { color: '#4472c4', opacity: .72, lineWidth: 1.2 };
        let body = '';
        if (display === 'outline') {
          body = `<path d="${histogramStepPath0152(arr, model, xMap, yMap)}" fill="none" stroke="${style.color}" stroke-width="${Math.max(1.2, Number(style.lineWidth) || 1.2)}" stroke-linejoin="miter" stroke-linecap="square"/>`;
        } else {
          arr.forEach((height, i) => {
            const x0 = xMap(min + i * step), x1 = xMap(min + (i + 1) * step);
            const opacity = groups.length > 1 ? Math.min(.50, Number(style.opacity) || .45) : Number(style.opacity) || .72;
            body += `<rect x="${x0}" y="${yMap(height)}" width="${Math.max(.5, x1 - x0)}" height="${Math.max(0, p.t + p.h - yMap(height))}" fill="${style.color}" fill-opacity="${opacity}" stroke="${style.color}" stroke-width="${Math.max(.4, Number(style.lineWidth) || .8)}"/>`;
          });
        }
        out += `<g data-gobject="series" data-gseries="${gi}" class="chart-object">${body}</g>`;
      });
      return out;
    };
  }

  function installHistogramProperties0152() {
    if (typeof gallerySpecificPropertyHtml !== 'function') return;
    const previous = gallerySpecificPropertyHtml;
    gallerySpecificPropertyHtml = function foodlabGallerySpecificPropertyHtml0152(type, id) {
      if (type === 'hist' && id === 'histogram' && typeof gallerySection === 'function' && typeof gSelect === 'function' && typeof gRange === 'function') {
        const st = appState0152(), s = st.gallery.settings;
        const model = histogramModel0152(st.gallery.rows, s);
        const nText = model ? `${model.bins} 个共同分箱；总 n=${model.values.length}` : '等待数据';
        return gallerySection('直方图统计定义', [
          gSelect('histBinRule', '分箱规则', [['fd', 'Freedman–Diaconis（推荐）'], ['sturges', 'Sturges'], ['scott', 'Scott'], ['manual', '手动']]),
          gRange('bins', '手动分箱数量', 4, 40, 1),
          gSelect('histYMode', '纵轴统计量', [['count', '频数 / Count'], ['probability', '相对频率 / Proportion'], ['density', '概率密度 / Density']]),
          gSelect('histDisplayMode', '多组显示', [['smart', '智能（多组用轮廓）'], ['outline', '阶梯轮廓'], ['overlay', '半透明叠加柱']]),
          gRange('opacity', '柱透明度', .15, 1, .05),
          gRange('lineWidth', '边框 / 轮廓粗细', 0, 4, .1)
        ]) + `<div class="method-badge"><b>当前：</b>${nText}。多组比较始终共用同一组 bin 边界，避免各组分箱不同造成视觉误导。</div>`;
      }
      return previous.apply(this, arguments);
    };
  }

  function installSettingsDefaults0152() {
    const st = appState0152();
    if (!st?.gallery?.settings) return;
    const s = st.gallery.settings;
    if (!s.histBinRule) s.histBinRule = 'fd';
    if (!s.histYMode) s.histYMode = 'count';
    if (!s.histDisplayMode) s.histDisplayMode = 'smart';
  }

  function installResetHook0152() {
    if (typeof resetGallerySettings !== 'function') return;
    const previous = resetGallerySettings;
    resetGallerySettings = function foodlabResetGallerySettings0152() {
      const out = previous.apply(this, arguments);
      installSettingsDefaults0152();
      applyAxisDefaults0152(true);
      return out;
    };
  }

  let axisRenderQueued = false;
  function queueAxisRender0152() {
    if (axisRenderQueued) return;
    axisRenderQueued = true;
    requestAnimationFrame(() => {
      axisRenderQueued = false;
      try {
        if (typeof renderGalleryStudioCanvas === 'function' && appState0152()?.chart?.mode === 'gallery') renderGalleryStudioCanvas();
      } catch (error) { console.warn('[FoodLab v0.15.2] axis redraw failed', error); }
    });
  }

  function installAxisEditorBridge0152() {
    const editor = document.querySelector('#propertyEditor') || document;
    const handler = event => {
      const el = event.target?.closest?.('[data-gsetting]');
      if (!el) return;
      const st = appState0152();
      if (!st?.gallery?.settings || st?.chart?.mode !== 'gallery') return;
      const key = el.dataset.gsetting;
      if (!key) return;

      if (key === 'xTitle' || key === 'yTitle') {
        st.gallery.settings[key] = el.value;
        const out = document.querySelector(`[data-gout="${key}"]`);
        if (out) out.textContent = el.value;
        const svgText = document.querySelector(`#paperSvg [data-gdrag="${key}"]`);
        if (svgText) svgText.textContent = el.value;
        queueAxisRender0152();
      } else if (key === 'histYMode' && currentType0152() === 'hist') {
        // A change from count to proportion/density changes the statistical
        // meaning of the Y axis, so the title must follow automatically.
        st.gallery.settings.histYMode = el.value;
        st.gallery.settings.yTitle = histogramYTitle0152(el.value);
        queueAxisRender0152();
      }
    };
    editor.addEventListener('input', handler, true);
    editor.addEventListener('change', handler, true);
  }

  function installRenderGuard0152() {
    if (typeof renderGalleryStudio !== 'function') return;
    const previous = renderGalleryStudio;
    renderGalleryStudio = function foodlabRenderGalleryStudio0152() {
      installSettingsDefaults0152();
      applyAxisDefaults0152(false);
      return previous.apply(this, arguments);
    };
  }

  function syncVersion0152() {
    document.documentElement.dataset.foodlabUnivariateCharts = VERSION;
    const foot = document.querySelector('.sidebar-foot');
    if (foot) foot.textContent = 'v0.15.2 · 直方图与坐标语义修正版';
  }

  globalThis.FoodLabUnivariateCharts0152 = Object.freeze({
    version: VERSION,
    fdBins: fdBins0152,
    sturgesBins: sturgesBins0152,
    scottBins: scottBins0152,
    effectiveBins: effectiveBins0152,
    histogramModel: histogramModel0152,
    countTicks: countTicks0152
  });

  function install0152() {
    if (globalThis.__FOODLAB_UNIVARIATE_CHART_FIXES_0152_INSTALLED__) return;
    globalThis.__FOODLAB_UNIVARIATE_CHART_FIXES_0152_INSTALLED__ = true;
    if (!appState0152()) {
      console.warn('[FoodLab Studio] v0.15.2 chart patch: state not available');
      return;
    }
    installSettingsDefaults0152();
    installHistogramRenderer0152();
    installHistogramProperties0152();
    installResetHook0152();
    installRenderGuard0152();
    applyAxisDefaults0152(false);
    installAxisEditorBridge0152();
    syncVersion0152();
    console.info(`[FoodLab Studio] univariate chart semantics v${VERSION} active`);
  }

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install0152, { once: true });
  else setTimeout(install0152, 0);
})();
