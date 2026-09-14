'use strict';
/*
 * FoodLab Studio v0.16.0 — series controls
 *
 * Fixes the three problems that do not need changes inside app.js:
 *
 *   1. Changing 论文配色 / 全局配色 wiped every per-series setting.
 *      applyGlobalStyle(key, true) sets seriesStyles = {} for both the
 *      experiment charts and the gallery charts, so line width, marker size,
 *      marker shape and fill all snapped back to defaults.
 *      New rule: the palette may repaint colours, nothing else is touched.
 *
 *   2. Marker size / line width / opacity could only be edited one series at
 *      a time. Each of those rows now has a matching 全部系列 row directly
 *      beside it, so related controls stay together instead of hiding in a
 *      separate block at the bottom of the panel.
 *
 *   3. There was no way to show 线+标记 / 仅连线 / 仅标记. Markers were gated by
 *      an automatic rule (hide above 120 x levels) with no switch at all.
 *      Added an explicit display mode; the automatic rule is now only the
 *      fallback behind the "自动" choice.
 *
 * Also added an explicit 重置全部系列样式 button, so "recolour" and "throw my
 * styling away" are two separate actions instead of one accidental one.
 *
 * Scope note: no chart geometry, statistics or export logic is changed.
 * With the defaults untouched, the rendered SVG is identical to v0.15.4.
 */
(() => {
  const VERSION = '0.16.0';
  if (globalThis.__FOODLAB_SERIES_CONTROLS_0160__) return;
  globalThis.__FOODLAB_SERIES_CONTROLS_0160__ = true;

  function appState() {
    try { return typeof state !== 'undefined' ? state : globalThis.state; }
    catch (_err) { return globalThis.state; }
  }

  const DISPLAY_MODES = [
    ['auto', '自动（点多时隐藏标记）'],
    ['both', '连线 + 标记'],
    ['line', '仅连线'],
    ['marker', '仅标记']
  ];
  const MODE_KEYS = { auto: 1, both: 1, line: 1, marker: 1 };
  const DEFAULT_MODE = 'auto';

  function clampMode(v) { return MODE_KEYS[v] ? v : DEFAULT_MODE; }

  /* ==================================================================== *
   * 1. A palette change must repaint colours and nothing else            *
   * ==================================================================== */

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_err) { return null; }
  }

  /*
   * A journal-palette change wipes per-series styling from three places:
   *
   *   app.js:992        #journalTemplate listener, state.gallery.seriesStyles = {}
   *   app.js:1175       applyTemplate(),        state.chart.seriesStyles = {}
   *   index.html:390    applyGlobalStyle(k,true), both of the above
   *
   * None of those functions can be wrapped from here: applyGlobalStyle lives
   * inside an IIFE in index.html, and the listener at app.js:992 is an inline
   * arrow function inside bindChartUi(). So instead of wrapping the writers we
   * bracket the whole change event:
   *
   *   document capture 'change'  -> runs BEFORE every #journalTemplate listener
   *   document bubble  'change'  -> runs AFTER  every #journalTemplate listener
   *
   * Whatever wiped the styles in between, we put the user's work back and then
   * repaint the canvas, because every intermediate re-render happened while the
   * styles were still blank.
   *
   * Experiment styles carry no colour at all (colours live in state.chart
   * .palette), so they are restored verbatim. Gallery styles do carry a colour,
   * and that one field is the only thing allowed to follow the new palette.
   */
  const paletteSnapshot = { experiment: null, gallery: null, taken: false };

  function snapshotSeriesStyles() {
    const st = appState();
    paletteSnapshot.experiment = clone(st?.chart?.seriesStyles) || {};
    paletteSnapshot.gallery = clone(st?.gallery?.seriesStyles) || {};
    paletteSnapshot.taken = true;
  }

  function restoreSeriesStyles() {
    if (!paletteSnapshot.taken) return false;
    paletteSnapshot.taken = false;
    const st = appState();
    let restored = false;
    try {
      if (st?.chart && !isEmpty(paletteSnapshot.experiment)) {
        st.chart.seriesStyles = paletteSnapshot.experiment;
        restored = true;
      }
      if (st?.gallery && !isEmpty(paletteSnapshot.gallery)) {
        const palette = st.gallery.palette || [];
        const styles = {};
        Object.keys(paletteSnapshot.gallery).forEach(key => {
          const index = Number(key);
          const style = paletteSnapshot.gallery[key];
          const color = palette.length
            ? palette[(Number.isFinite(index) ? index : 0) % palette.length]
            : style.color;
          styles[key] = { ...style, ...(color ? { color } : {}) };
        });
        st.gallery.seriesStyles = styles;
        restored = true;
      }
    } catch (error) {
      console.warn('[FoodLab v0.16.0] palette guard restore failed', error);
    }
    return restored;
  }

  function isEmpty(obj) { return !obj || typeof obj !== 'object' || Object.keys(obj).length === 0; }

  function redrawAfterPalette() {
    try {
      if (typeof renderChartStudio === 'function') renderChartStudio();
      else if (typeof renderChart === 'function') renderChart();
    } catch (error) {
      console.warn('[FoodLab v0.16.0] palette redraw failed', error);
    }
    try {
      if (appState()?.chart?.mode === 'gallery' && typeof renderGalleryStudioProperties === 'function') {
        renderGalleryStudioProperties();
      } else if (typeof renderProperties === 'function') {
        renderProperties();
      }
    } catch (_err) {}
  }

  function installPaletteGuard() {
    const select = document.querySelector('#journalTemplate');
    if (!select) {
      console.warn('[FoodLab v0.16.0] #journalTemplate not found; palette guard skipped');
      return;
    }
    const isJournal = event => event.target && event.target.id === 'journalTemplate';

    // Capture phase on document: guaranteed to run before target listeners.
    document.addEventListener('change', event => {
      if (isJournal(event)) snapshotSeriesStyles();
    }, true);

    // Bubble phase on document: guaranteed to run after target listeners.
    document.addEventListener('change', event => {
      if (!isJournal(event)) return;
      if (restoreSeriesStyles()) redrawAfterPalette();
    });

  }

  // state.spectrum.settings.groupStyles holds colours only, so letting the
  // palette reset it is exactly the behaviour we want. Nothing to guard there.

  /*
   * Related bug found while verifying the above, also fixed here.
   *
   * The 论文配色 dropdown is rebuilt from PALETTE_PRESETS, whose keys are
   * npg / aaas / nejm / lancet / jama / jco / tolbright / tolhigh / tolvibrant
   * / tolmuted / okabe / instrument / mono.
   *
   * But app.js:992 routes the experiment-mode branch to applyTemplate(name),
   * and applyTemplate only knows templates = { foodchem, meatsci, nature,
   * mono }. The two lists share exactly one key, so choosing any other preset
   * while a bar / line / curve chart is open throws
   * "Cannot read properties of undefined (reading 'fontEnglish')" and the
   * listener dies half way through.
   *
   * Gallery mode never hit this because its branch already has
   * `templates[e.target.value] || templates.foodchem`. Apply the same fallback
   * on the experiment path.
   */
  function installTemplateFallback() {
    if (typeof applyTemplate !== 'function' || applyTemplate.__foodlabFallback0160) return;
    const previous = applyTemplate;
    const wrapper = function foodlabApplyTemplate0160(name) {
      let safe = name;
      try {
        if (typeof templates === 'object' && templates && !templates[safe]) safe = 'foodchem';
      } catch (_err) { safe = 'foodchem'; }
      return previous.call(this, safe);
    };
    wrapper.__foodlabFallback0160 = true;
    globalThis.applyTemplate = wrapper;
    try { window.applyTemplate = wrapper; } catch (_e) {}
  }

  /* ==================================================================== *
   * 2. 全部系列 controls + 重置按钮                                       *
   * ==================================================================== */

  function experimentGroups() {
    try { return typeof chartGroups === 'function' ? chartGroups() : []; }
    catch (_err) { return []; }
  }
  function galleryNames() {
    try { return typeof galleryStudioSeriesNames === 'function' ? galleryStudioSeriesNames() : []; }
    catch (_err) { return []; }
  }
  function galleryStyle(i) {
    try { return typeof getGallerySeriesStyle === 'function' ? getGallerySeriesStyle(i) : null; }
    catch (_err) { return null; }
  }
  function experimentStyle(i) {
    try { return typeof getSeriesStyle === 'function' ? getSeriesStyle(i) : null; }
    catch (_err) { return null; }
  }

  function rangeRow(attr, label, value, min, max, step) {
    return `<div class="field" data-foodlab-v0160="1"><label><span>${label}</span><output data-v0160-out="${attr}">${value}</output></label>` +
      `<input type="range" data-v0160="${attr}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
  }

  function selectRow(attr, label, value, options) {
    return `<div class="field" data-foodlab-v0160="1"><label><span>${label}</span></label><select data-v0160="${attr}">` +
      options.map(([v, n]) => `<option value="${v}"${String(value) === String(v) ? ' selected' : ''}>${n}</option>`).join('') +
      '</select></div>';
  }

  function modeRow(value) {
    return selectRow('mode', '标记与连线', clampMode(value), DISPLAY_MODES);
  }

  const SHAPE_OPTIONS = [
    ['circle', '圆形'], ['square', '方形'], ['triangle', '上三角'], ['triangleDown', '下三角'],
    ['diamond', '菱形'], ['star', '五角星'], ['pentagon', '五边形'], ['hexagon', '六边形'],
    ['plus', '加号'], ['cross', '叉号']
  ];
  const FILL_OPTIONS = [['white', '白色空心'], ['series', '同系列颜色']];

  function applyToAllExperiment(key, value) {
    const groups = experimentGroups();
    for (let i = 0; i < groups.length; i++) {
      const style = experimentStyle(i);
      if (style) style[key] = value;
    }
  }

  function applyToAllGallery(key, value) {
    const names = galleryNames();
    for (let i = 0; i < names.length; i++) {
      const style = galleryStyle(i);
      if (style) style[key] = value;
    }
  }

  function rerenderExperiment() {
    try { if (typeof renderChart === 'function') renderChart(); } catch (_e) {}
  }
  function rerenderGallery() {
    try { if (typeof renderGalleryStudioCanvas === 'function') renderGalleryStudioCanvas(); } catch (_e) {}
  }

  function displayMode() {
    const st = appState();
    if (st?.chart?.mode === 'gallery') return clampMode(st?.gallery?.settings?.seriesDisplayMode);
    return clampMode(st?.chart?.settings?.seriesDisplayMode);
  }

  function setDisplayMode(mode) {
    const st = appState();
    if (!st) return;
    if (st.chart?.settings) st.chart.settings.seriesDisplayMode = mode;
    if (st.gallery?.settings) st.gallery.settings.seriesDisplayMode = mode;
  }

  function currentGalleryValues() {
    const names = galleryNames();
    const first = names.length ? galleryStyle(0) : null;
    const type = appState()?.gallery?.type;
    return {
      count: names.length,
      opacity: first ? first.opacity : '',
      lineWidth: first ? first.lineWidth : '',
      pointSize: first ? first.pointSize : '',
      hasPointSize: ['kde', 'box', 'violin', 'scatter', 'bubble', 'radar'].includes(type),
      hasLineWidth: ['kde', 'box', 'violin', 'scatter', 'bubble', 'radar', 'hist', 'stacked', 'pie'].includes(type)
    };
  }

  function isLineLikeMode() {
    try { return typeof isLineLike === 'function' ? isLineLike() : false; }
    catch (_err) { return false; }
  }

  /* ---------------------------------------------------------- injection */
  /*
   * Each 全部系列 control is inserted directly beside its 本系列 twin, so the
   * related settings read as one group. A single appended block at the bottom
   * of the panel was too easy to miss.
   */

  function fieldMatching(container, re) {
    // The panel is rebuilt on every render, so locate rows by the semantic
    // attribute the app already puts on each input, never by label text.
    const inputs = container.querySelectorAll('[data-setting],[data-gseries-setting]');
    for (const el of inputs) {
      const key = el.dataset.setting || el.dataset.gseriesSetting || '';
      if (re.test(key)) return el.closest('.field') || el.parentElement;
    }
    return null;
  }

  function insertAfter(node, html) {
    if (!node) return null;
    node.insertAdjacentHTML('afterend', html);
    return node.nextElementSibling;
  }

  function clearInjected(container) {
    container.querySelectorAll('[data-foodlab-v0160]').forEach(el => el.remove());
  }

  function resetRow(count) {
    return `<div class="field" data-foodlab-v0160="1"><button type="button" class="ghost" data-v0160-reset="1">重置全部系列样式</button>` +
      `<div class="hint">当前共 ${count} 条系列。上面的“全部系列”修改一次即全部生效，“本系列”仍可单独微调。</div></div>`;
  }

  function injectExperimentRows(container) {
    if (appState()?.chart?.selected !== 'series') return;
    const groups = experimentGroups();
    if (!groups.length) return;
    clearInjected(container);
    const first = experimentStyle(0) || {};
    let last = null;

    const lineWidthField = fieldMatching(container, /^series:\d+:lineWidth$/);
    last = insertAfter(lineWidthField, rangeRow('lineWidth', '全部系列折线粗细', first.lineWidth, 0.5, 7, 0.1)) || last;

    const markerSizeField = fieldMatching(container, /^series:\d+:markerSize$/);
    last = insertAfter(markerSizeField, rangeRow('markerSize', '全部系列标记大小', first.markerSize, 1, 16, 0.2)) || last;

    // The shape picker is a button grid rather than a select input.
    const shapeField = container.querySelector('[data-marker-series]')?.closest('.field');
    last = insertAfter(shapeField, selectRow('markerShape', '全部系列标记形状', first.markerShape, SHAPE_OPTIONS)) || last;

    const fillField = fieldMatching(container, /^series:\d+:markerFill$/);
    last = insertAfter(fillField, selectRow('markerFill', '全部系列标记填充', first.markerFill, FILL_OPTIONS)) || last;

    // Display mode belongs next to the existing 折线连接方式 control.
    const lineModeField = fieldMatching(container, /^lineMode$/);
    if (lineModeField && isLineLikeMode()) {
      last = insertAfter(lineModeField, modeRow(displayMode())) || last;
    }

    if (last) insertAfter(last, resetRow(groups.length));
    bindExperimentRows(container);
  }

  function injectGalleryRows(container) {
    if (appState()?.gallery?.selected !== 'series') return;
    const names = galleryNames();
    if (!names.length) return;
    clearInjected(container);
    const v = currentGalleryValues();
    const first = galleryStyle(0) || {};
    let last = null;

    const opacityField = fieldMatching(container, /^\d+:opacity$/);
    last = insertAfter(opacityField, rangeRow('gOpacity', '全部系列透明度', first.opacity, 0.1, 1, 0.05)) || last;

    if (v.hasLineWidth) {
      const lineField = fieldMatching(container, /^\d+:lineWidth$/);
      last = insertAfter(lineField, rangeRow('gLineWidth', '全部系列线宽 / 边框', first.lineWidth, 0, 7, 0.1)) || last;
    }
    if (v.hasPointSize) {
      const pointField = fieldMatching(container, /^\d+:pointSize$/);
      last = insertAfter(pointField, rangeRow('gPointSize', '全部系列点大小', first.pointSize, 1, 16, 0.5)) || last;
    }
    const shapeField = fieldMatching(container, /^\d+:markerShape$/);
    last = insertAfter(shapeField, selectRow('gMarkerShape', '全部系列标记形状', first.markerShape, SHAPE_OPTIONS)) || last;

    if (last) insertAfter(last, resetRow(names.length));
    bindGalleryRows(container);
  }

  function bindExperimentRows(container) {
    container.querySelectorAll('[data-v0160]').forEach(el => {
      const key = el.dataset.v0160;
      const handler = () => {
        if (key === 'mode') {
          setDisplayMode(el.value);
          try { renderProperties(); } catch (_e) {}
          rerenderExperiment();
          return;
        }
        const value = Number(el.value);
        applyToAllExperiment(key, value);
        const out = container.querySelector(`[data-v0160-out="${key}"]`);
        if (out) out.textContent = value;
        rerenderExperiment();
        // Keep the per-series controls in sync when they show the same value.
        try { renderProperties(); } catch (_e) {}
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
    const reset = container.querySelector('[data-v0160-reset]');
    if (reset) reset.addEventListener('click', () => {
      const st = appState();
      if (st?.chart) st.chart.seriesStyles = {};
      if (st?.chart?.settings) {
        const defaults = clone(st.chart.__defaults0160) || {};
        st.chart.settings.seriesDisplayMode = DEFAULT_MODE;
        if (defaults.lineWidth) st.chart.settings.lineWidth = defaults.lineWidth;
        if (defaults.markerSize) st.chart.settings.markerSize = defaults.markerSize;
      }
      if (typeof toast === 'function') toast('已重置全部系列样式');
      try { renderProperties(); } catch (_e) {}
      rerenderExperiment();
    });
  }

  function bindGalleryRows(container) {
    container.querySelectorAll('[data-v0160]').forEach(el => {
      const key = el.dataset.v0160;
      const target = { gOpacity: 'opacity', gLineWidth: 'lineWidth', gPointSize: 'pointSize' }[key];
      const handler = () => {
        if (key === 'gMarkerShape') {
          applyToAllGallery('markerShape', el.value);
        } else {
          if (!target) return;
          const value = Number(el.value);
          applyToAllGallery(target, value);
          const out = container.querySelector(`[data-v0160-out="${key}"]`);
          if (out) out.textContent = value;
        }
        rerenderGallery();
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
    const reset = container.querySelector('[data-v0160-reset]');
    if (reset) reset.addEventListener('click', () => {
      const st = appState();
      if (st?.gallery) st.gallery.seriesStyles = {};
      if (typeof toast === 'function') toast('已重置全部系列样式');
      try { renderGalleryStudioProperties(); } catch (_e) {}
      rerenderGallery();
    });
  }

  function injectExperiment(container) {
    if (!container) return;
    injectExperimentRows(container);
  }

  function injectGallery(container) {
    if (!container) return;
    injectGalleryRows(container);
  }

  function wrapRenderer(name, injector) {
    const original = globalThis[name];
    if (typeof original !== 'function' || original.__foodlabInjected0160) return;
    const wrapper = function foodlabPropertyRenderer0160() {
      const out = original.apply(this, arguments);
      try { injector(document.querySelector('#propertyEditor')); }
      catch (error) { console.warn(`[FoodLab v0.16.0] ${name} inject failed`, error); }
      return out;
    };
    wrapper.__foodlabInjected0160 = true;
    globalThis[name] = wrapper;
    try { window[name] = wrapper; } catch (_e) {}
  }

  /* ==================================================================== *
   * 3. 连线 / 标记 显示模式                                               *
   * ==================================================================== */

  function installDisplayModes() {
    // Markers: this one function gates every marker drawing site (normal plot,
    // broken-axis plot and the legend symbol).
    if (typeof seriesMarkersVisible === 'function' && !seriesMarkersVisible.__foodlabMode0160) {
      const previous = seriesMarkersVisible;
      const wrapper = function foodlabSeriesMarkersVisible0160() {
        const mode = displayMode();
        if (mode === 'line') return false;
        if (mode === 'both' || mode === 'marker') return true;
        return previous.apply(this, arguments); // 'auto' keeps the original rule
      };
      wrapper.__foodlabMode0160 = true;
      globalThis.seriesMarkersVisible = wrapper;
      try { window.seriesMarkersVisible = wrapper; } catch (_e) {}
    }

    // The connecting line: seriesPath() only ever produces the stroke path of
    // one series, so returning an empty path removes the line and leaves the
    // markers (and the clickable series object) in place.
    if (typeof seriesPath === 'function' && !seriesPath.__foodlabMode0160) {
      const previous = seriesPath;
      const wrapper = function foodlabSeriesPath0160(coords) {
        const mode = displayMode();
        if (mode === 'marker' && isLineLikeMode()) return '';
        return previous.apply(this, arguments);
      };
      wrapper.__foodlabMode0160 = true;
      globalThis.seriesPath = wrapper;
      try { window.seriesPath = wrapper; } catch (_e) {}
    }

    // The legend draws a short line segment before the marker. In marker-only
    // mode that segment would misrepresent the chart, so drop it.
    if (typeof renderLegend === 'function' && !renderLegend.__foodlabMode0160) {
      const previous = renderLegend;
      const wrapper = function foodlabRenderLegend0160() {
        let out = previous.apply(this, arguments);
        try {
          if (displayMode() === 'marker' && isLineLikeMode() && typeof out === 'string') {
            // <line data-object="legend" .../> is the series symbol stroke only.
            out = out.replace(/<line data-object="legend"[^>]*stroke-width="[^"]*"\/>/g, '');
          }
        } catch (_e) {}
        return out;
      };
      wrapper.__foodlabMode0160 = true;
      globalThis.renderLegend = wrapper;
      try { window.renderLegend = wrapper; } catch (_e) {}
    }
  }

  /* ============================================================ install */

  function install0160() {
    installPaletteGuard();
    installTemplateFallback();
    installDisplayModes();
    wrapRenderer('renderProperties', injectExperiment);
    wrapRenderer('renderGalleryStudioProperties', injectGallery);

    // Remember the shipped defaults so "重置全部系列样式" restores them.
    const st = appState();
    if (st?.chart?.settings && !st.chart.__defaults0160) {
      st.chart.__defaults0160 = {
        lineWidth: st.chart.settings.lineWidth,
        markerSize: st.chart.settings.markerSize
      };
    }

    globalThis.FoodLabSeriesControls0160 = Object.freeze({
      version: VERSION,
      get displayMode() { return displayMode(); },
      setDisplayMode
    });
    console.info('[FoodLab Studio] series controls v0.16.0 active',
      '(palette no longer resets per-series styling)');
  }

  if (typeof document === 'undefined') return;
  // Run after app.js and after every earlier FoodLab patch has replaced its own
  // render/property functions, so these wrappers end up outermost.
  if (document.readyState === 'complete') setTimeout(install0160, 0);
  else window.addEventListener('load', () => setTimeout(install0160, 0), { once: true });
})();
