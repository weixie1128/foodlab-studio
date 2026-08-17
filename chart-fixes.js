'use strict';

/*
 * FoodLab Studio v0.9.8 — histogram redesign + grouped-scatter fix
 *
 * Scope of this patch:
 * 1) Rebuild the gallery histogram renderer with a true continuous X axis.
 * 2) Use nicer bin edges / ticks and keep axes visible above bars.
 * 3) Default multi-group histograms to faceted panels instead of muddy overlays.
 * 4) Preserve the earlier grouped regression fix for scatter / bubble plots.
 */
(() => {
  const originalGallerySpecificPropertyHtml = gallerySpecificPropertyHtml;
  const originalGalleryMethodNoteText = galleryMethodNoteText;
  const originalAnalyzeXY = analyzeXY;

  const clampLocal = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const finiteValues = arr => arr.map(Number).filter(Number.isFinite);

  function ensureFixSettings() {
    const s = state.gallery.settings;
    if (typeof s.histAutoBins !== 'boolean') s.histAutoBins = true;
    if (!['frequency', 'density'].includes(s.histogramScale)) s.histogramScale = 'frequency';
    if (!['facet', 'overlay'].includes(s.histDisplayMode)) s.histDisplayMode = 'facet';
    if (!['group', 'overall'].includes(s.scatterFitMode)) s.scatterFitMode = 'group';
    if (!Number.isFinite(Number(s.opacity))) s.opacity = 0.72;
    if (!Number.isFinite(Number(s.lineWidth))) s.lineWidth = 1.25;
    return s;
  }

  function niceStepLocal(raw) {
    const value = Math.abs(Number(raw) || 0);
    if (!(value > 0)) return 1;
    const power = Math.floor(Math.log10(value));
    const scale = Math.pow(10, power);
    const unit = value / scale;
    let niceUnit;
    if (unit <= 1) niceUnit = 1;
    else if (unit <= 2) niceUnit = 2;
    else if (unit <= 2.5) niceUnit = 2.5;
    else if (unit <= 5) niceUnit = 5;
    else niceUnit = 10;
    return niceUnit * scale;
  }

  function prettyNumber(v, step = null) {
    const value = Number(v);
    if (!Number.isFinite(value)) return '';
    const ref = Math.abs(Number(step) || 0);
    let digits = 0;
    if (ref > 0 && ref < 1) digits = clampLocal(Math.ceil(-Math.log10(ref)) + (String(ref).includes('5') ? 1 : 0), 0, 6);
    const text = value.toFixed(digits).replace(/\.?0+$/, '');
    return text === '-0' ? '0' : text;
  }

  function makeNiceTicks(min, max, target = 6) {
    const a = Number(min);
    const b = Number(max);
    if (!(Number.isFinite(a) && Number.isFinite(b))) return [0, 1];
    if (!(b > a)) return [a];
    const step = niceStepLocal((b - a) / Math.max(2, target - 1));
    const start = Math.floor(a / step) * step;
    const end = Math.ceil(b / step) * step;
    const ticks = [];
    for (let v = start; v <= end + step * 0.5; v += step) {
      ticks.push(Number(v.toFixed(10)));
      if (ticks.length > 100) break;
    }
    return [...new Set(ticks)];
  }

  function histogramFrequencyTicks(maxValue) {
    const m = Math.max(1, Math.ceil(Number(maxValue) || 1));
    if (m <= 6) return Array.from({ length: m + 1 }, (_, i) => i);
    const step = Math.max(1, Math.ceil(niceStepLocal(m / 5)));
    const ticks = [];
    for (let v = 0; v <= m + step * 0.5; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] < m) ticks.push(m);
    return [...new Set(ticks)];
  }

  function isDefaultHistogramAxisTitle(value) {
    return ['', 'Value', 'Frequency', 'Density', '频数', '密度'].includes(String(value ?? '').trim());
  }

  function autoHistogramBinCount(values) {
    const a = finiteValues(values).sort((x, y) => x - y);
    const n = a.length;
    if (n <= 1) return 1;
    const min = a[0];
    const max = a[n - 1];
    const range = max - min;
    if (!(range > 0)) return 1;

    const q1 = quantileByMethod(a, 0.25, 'linear7');
    const q3 = quantileByMethod(a, 0.75, 'linear7');
    const iqr = q3 - q1;
    const fdWidth = iqr > 0 ? 2 * iqr * Math.pow(n, -1 / 3) : NaN;
    const fdBins = Number.isFinite(fdWidth) && fdWidth > 0 ? Math.ceil(range / fdWidth) : NaN;
    const sturges = Math.ceil(Math.log2(n) + 1);

    let suggested = Number.isFinite(fdBins) && fdBins >= 4 ? fdBins : sturges;
    suggested = clampLocal(Math.round(suggested), 3, 24);
    return Math.min(suggested, Math.max(3, n));
  }

  function resolvedHistogramGeometry(values, requested, auto) {
    const arr = finiteValues(values).sort((x, y) => x - y);
    if (!arr.length) {
      return { domainMin: 0, domainMax: 1, binWidth: 1, bins: 1, step: 1 };
    }

    let dataMin = arr[0];
    let dataMax = arr[arr.length - 1];
    if (!(dataMax > dataMin)) {
      const pad = Math.abs(dataMin || 1) * 0.05 || 0.5;
      dataMin -= pad;
      dataMax += pad;
    }

    const range = dataMax - dataMin;
    const targetBins = auto ? autoHistogramBinCount(arr) : clampLocal(Math.round(Number(requested) || 10), 2, 40);
    let rawWidth = range / Math.max(1, targetBins);
    if (!(rawWidth > 0)) rawWidth = 1;
    let binWidth = niceStepLocal(rawWidth);

    let domainMin = Math.floor(dataMin / binWidth) * binWidth;
    let domainMax = Math.ceil(dataMax / binWidth) * binWidth;
    let bins = Math.round((domainMax - domainMin) / binWidth);

    let safety = 0;
    while ((bins > 30 || bins < 2) && safety < 10) {
      if (bins > 30) binWidth = niceStepLocal(binWidth * 1.6);
      else if (bins < 2) binWidth = niceStepLocal(binWidth / 2);
      domainMin = Math.floor(dataMin / binWidth) * binWidth;
      domainMax = Math.ceil(dataMax / binWidth) * binWidth;
      bins = Math.round((domainMax - domainMin) / binWidth);
      safety += 1;
    }

    bins = clampLocal(bins, 2, 40);
    domainMax = domainMin + bins * binWidth;

    return {
      dataMin,
      dataMax,
      domainMin: Number(domainMin.toFixed(10)),
      domainMax: Number(domainMax.toFixed(10)),
      binWidth: Number(binWidth.toFixed(10)),
      bins,
      step: binWidth
    };
  }

  function mapLinear(domainMin, domainMax, rangeMin, rangeMax) {
    const d = domainMax - domainMin || 1;
    const r = rangeMax - rangeMin;
    return value => rangeMin + ((value - domainMin) / d) * r;
  }

  function histogramCounts(rows, groups, geometry, densityMode) {
    const counts = groups.map(() => Array(geometry.bins).fill(0));
    const groupSizeMap = new Map(groups.map(g => [g, 0]));

    rows.forEach(r => {
      const g = String(r.Group || 'All');
      const v = Number(r.Value);
      if (!Number.isFinite(v) || !groupSizeMap.has(g)) return;
      groupSizeMap.set(g, groupSizeMap.get(g) + 1);
      let idx = Math.floor((v - geometry.domainMin) / geometry.binWidth);
      if (v === geometry.domainMax) idx = geometry.bins - 1;
      idx = clampLocal(idx, 0, geometry.bins - 1);
      counts[groups.indexOf(g)][idx] += 1;
    });

    const heights = counts.map((arr, i) => {
      const n = Math.max(1, groupSizeMap.get(groups[i]) || 1);
      return arr.map(c => densityMode ? c / (n * geometry.binWidth) : c);
    });

    return { counts, heights, groupSizes: groups.map(g => groupSizeMap.get(g) || 0) };
  }

  function svgText(x, y, text, attrs = '') {
    return `<text x="${x}" y="${y}" ${attrs}>${esc(String(text))}</text>`;
  }

  function drawNumericAxes(panel, options) {
    const {
      s,
      xMap,
      yMap,
      xTicks,
      yTicks,
      xStep,
      yStep,
      showXLabels,
      showYLabels,
      boxMode
    } = options;

    const axisColor = s.axisColor || '#20262b';
    const axisWidth = num(s.axisWidth, 1.35);
    const tickLength = num(s.tickLength, 6);
    const xTickSize = num(s.xTickSize, 12);
    const yTickSize = num(s.yTickSize, 12);
    const xTickWeight = num(s.xTickWeight, 400);
    const yTickWeight = num(s.yTickWeight, 400);
    const xTickColor = s.xTickColor || axisColor;
    const yTickColor = s.yTickColor || axisColor;

    let out = '';

    // Optional frame.
    if (boxMode) {
      out += `<rect x="${panel.l}" y="${panel.t}" width="${panel.w}" height="${panel.h}" fill="none" stroke="${axisColor}" stroke-width="${num(s.frameWidth, 1.15)}"/>`;
    } else {
      out += `<line x1="${panel.l}" y1="${panel.t + panel.h}" x2="${panel.l + panel.w}" y2="${panel.t + panel.h}" stroke="${axisColor}" stroke-width="${axisWidth}"/>`;
      out += `<line x1="${panel.l}" y1="${panel.t}" x2="${panel.l}" y2="${panel.t + panel.h}" stroke="${axisColor}" stroke-width="${axisWidth}"/>`;
    }

    if (showYLabels !== false) {
      yTicks.forEach(t => {
        const y = yMap(t);
        out += `<line x1="${panel.l}" y1="${y}" x2="${panel.l - tickLength}" y2="${y}" stroke="${axisColor}" stroke-width="${axisWidth}"/>`;
        out += svgText(panel.l - tickLength - 5, y + yTickSize * 0.35, prettyNumber(t, yStep), `text-anchor="end" font-size="${yTickSize}" font-weight="${yTickWeight}" fill="${yTickColor}"`);
      });
    }

    if (showXLabels !== false) {
      xTicks.forEach(t => {
        const x = xMap(t);
        out += `<line x1="${x}" y1="${panel.t + panel.h}" x2="${x}" y2="${panel.t + panel.h + tickLength}" stroke="${axisColor}" stroke-width="${axisWidth}"/>`;
        out += svgText(x, panel.t + panel.h + tickLength + xTickSize + 2, prettyNumber(t, xStep), `text-anchor="middle" font-size="${xTickSize}" font-weight="${xTickWeight}" fill="${xTickColor}"`);
      });
    }

    return out;
  }

  function drawHistogramBars(panel, heights, gi, xMap, yMap, geometry, s, overlayMode = false) {
    const st = getGallerySeriesStyle(gi);
    const lineWidth = Math.max(0.5, num(st.lineWidth, s.lineWidth));
    const fillOpacity = overlayMode ? Math.min(0.32, num(s.opacity, 0.72)) : Math.min(0.88, Math.max(0.45, num(s.opacity, 0.72)));
    let body = '';

    heights.forEach((height, i) => {
      const left = geometry.domainMin + i * geometry.binWidth;
      const right = left + geometry.binWidth;
      const x1 = xMap(left);
      const x2 = xMap(right);
      const y = yMap(height);
      const h = Math.max(0, panel.t + panel.h - y);
      body += `<rect x="${x1}" y="${y}" width="${Math.max(0, x2 - x1)}" height="${h}" fill="${st.color}" fill-opacity="${fillOpacity}" stroke="${st.color}" stroke-width="${lineWidth}"/>`;
    });

    return `<g data-gobject="series" data-gseries="${gi}" class="chart-object">${body}</g>`;
  }

  function histogramAxisTitles(W, H, p, s) {
    let out = '';
    const xTitle = String(s.xTitle || '').trim();
    const yTitle = String(s.yTitle || '').trim();
    const x = Number.isFinite(Number(s.xTitleX)) ? Number(s.xTitleX) : p.l + p.w / 2;
    const y = Number.isFinite(Number(s.xTitleY)) ? Number(s.xTitleY) : H - 18;
    const yx = Number.isFinite(Number(s.yTitleX)) ? Number(s.yTitleX) : 26;
    const yy = Number.isFinite(Number(s.yTitleY)) ? Number(s.yTitleY) : p.t + p.h / 2;

    if (s.xTitleVisible !== false && xTitle) {
      out += svgText(x, y, xTitle, `text-anchor="middle" font-size="${num(s.xTitleSize, 15)}" font-weight="${num(s.xTitleWeight, 400)}" fill="${s.xTitleColor || '#20262b'}"`);
    }
    if (s.yTitleVisible !== false && yTitle) {
      out += `<text x="${yx}" y="${yy}" transform="rotate(-90 ${yx} ${yy})" text-anchor="middle" font-size="${num(s.yTitleSize, 15)}" font-weight="${num(s.yTitleWeight, 400)}" fill="${s.yTitleColor || '#20262b'}">${esc(yTitle)}</text>`;
    }
    return out;
  }

  function histogramFacetLabel(panel, label, color, s) {
    const fontSize = Math.max(11, num(s.legendFontSize, 12));
    return `<g class="chart-object" data-gobject="legend"><rect x="${panel.l + 6}" y="${panel.t + 6}" width="12" height="12" fill="${color}" fill-opacity="0.9" stroke="${color}" stroke-width="0.8"/><text x="${panel.l + 24}" y="${panel.t + 17}" font-size="${fontSize}" font-weight="${num(s.legendWeight, 400)}" fill="${color}">${esc(label)}</text></g>`;
  }

  gallerySpecificPropertyHtml = function patchedGallerySpecificPropertyHtml(type, id) {
    const s = ensureFixSettings();

    if (id === 'histogram') {
      return gallerySection('直方图', [
        gCheck('histAutoBins', '自动分箱（推荐）'),
        gSelect('histDisplayMode', '多组显示方式', [
          ['facet', '按组分面（推荐）'],
          ['overlay', '半透明叠加']
        ]),
        gSelect('histogramScale', '纵轴含义', [
          ['frequency', '频数 Frequency'],
          ['density', '概率密度 Density']
        ]),
        gRange('bins', '手动分箱数量（关闭自动后生效）', 2, 40, 1),
        gRange('opacity', '柱填充透明度', 0.2, 1, 0.05),
        gRange('lineWidth', '柱边框粗细', 0.5, 4, 0.1)
      ]) + `<div class="method-badge"><b>绘图规则：</b>直方图使用真正的连续数值 X 轴；所有组共享同一套连续分箱边界；坐标轴始终绘制在柱子上层，不再被数据柱遮挡。当前多组默认采用<b>${s.histDisplayMode === 'facet' ? '按组分面' : '半透明叠加'}</b>。</div>`;
    }

    if (id === 'regression' && ['scatter', 'bubble'].includes(type)) {
      return gallerySection('关系分析方法', [
        gSelect('correlationMethod', '相关方法', [
          ['pearson', 'Pearson 线性相关'],
          ['spearman', 'Spearman 秩相关']
        ]),
        gSelect('scatterFitMode', '回归拟合范围', [
          ['group', '按组分别拟合（推荐）'],
          ['overall', '全部样本整体拟合']
        ]),
        gCheck('showRegression', '显示线性拟合'),
        gCheck('showCorrelation', '显示相关系数'),
        gRange('annotationSize', '相关系数文字字号', 8, 28, 1),
        gRange('lineWidth', '拟合线粗细', 0.5, 5, 0.1)
      ]) + `<div class="method-badge"><b>当前方法：</b>${esc(correlationMethodLabel())}；${s.scatterFitMode === 'group' ? '每个 Group 独立进行普通最小二乘线性回归' : '全部样本合并进行普通最小二乘线性回归'}。</div>`;
    }

    return originalGallerySpecificPropertyHtml(type, id);
  };

  galleryMethodNoteText = function patchedGalleryMethodNoteText() {
    const s = ensureFixSettings();
    const type = state.gallery.type;
    if (type === 'hist') {
      return `分箱：${s.histAutoBins ? '自动' : '手动'}；纵轴：${s.histogramScale === 'density' ? 'Density' : 'Frequency'}；多组显示：${s.histDisplayMode === 'facet' ? '按组分面' : '半透明叠加'}`;
    }
    if (['scatter', 'bubble'].includes(type)) {
      return `相关：${correlationMethodLabel(s.correlationMethod)}；拟合：${s.scatterFitMode === 'group' ? '按组分别' : '全部样本整体'}普通最小二乘线性回归`;
    }
    return originalGalleryMethodNoteText();
  };

  analyzeXY = function patchedAnalyzeXY(rows) {
    const result = originalAnalyzeXY(rows);
    const s = ensureFixSettings();
    if (s.scatterFitMode === 'group' && result?.table?.length > 1) {
      result.summary = [
        ['有效样本', rows.length],
        ['组别数', result.table.length],
        ['相关方法', result.overall?.label || correlationMethodLabel()],
        ['回归拟合', '按组分别']
      ];
      result.text = `检测到 ${result.table.length} 个组。散点图默认对每个 Group 分别计算相关系数并分别进行普通最小二乘线性回归；初步分析表中的每一行对应一个组。不会再用一条整体回归线同时代表多个处理组。`;
    }
    return result;
  };

  galleryHistogram = function patchedGalleryHistogram(W, H) {
    const s = ensureFixSettings();
    const p = galleryPlotBox(W, H);
    const rows = state.gallery.rows.filter(r => Number.isFinite(r.Value));
    if (!rows.length) return '';

    const groups = [...new Set(rows.map(r => String(r.Group || 'All')))];
    const values = rows.map(r => Number(r.Value));
    const densityMode = s.histogramScale === 'density';
    const geometry = resolvedHistogramGeometry(values, s.bins, s.histAutoBins);
    const stats = histogramCounts(rows, groups, geometry, densityMode);
    const globalYMaxRaw = Math.max(0, ...stats.heights.flat());
    const yMaxPadded = densityMode ? globalYMaxRaw * 1.12 : globalYMaxRaw * 1.12;

    if (!String(s.xTitle || '').trim()) s.xTitle = 'Value';
    if (isDefaultHistogramAxisTitle(s.yTitle)) s.yTitle = densityMode ? 'Density' : 'Frequency';

    const xTicks = makeNiceTicks(geometry.domainMin, geometry.domainMax, 6);
    const xStep = xTicks.length > 1 ? xTicks[1] - xTicks[0] : geometry.binWidth;
    const boxMode = String(s.frameMode || 'box') === 'box';

    // Single group always behaves like a standard histogram.
    const useFacet = groups.length > 1 && s.histDisplayMode === 'facet';
    let out = '';

    if (useFacet) {
      const gap = 18;
      const panelHeight = Math.max(70, (p.h - gap * (groups.length - 1)) / groups.length);
      const yTicks = densityMode ? makeNiceTicks(0, yMaxPadded || 1, 5) : histogramFrequencyTicks(yMaxPadded || 1);
      const yStep = yTicks.length > 1 ? yTicks[1] - yTicks[0] : 1;
      const facetYMax = yTicks[yTicks.length - 1] || 1;

      groups.forEach((group, gi) => {
        const panel = {
          l: p.l,
          t: p.t + gi * (panelHeight + gap),
          w: p.w,
          h: panelHeight
        };
        const xMap = mapLinear(geometry.domainMin, geometry.domainMax, panel.l, panel.l + panel.w);
        const yMap = mapLinear(0, facetYMax, panel.t + panel.h, panel.t + 8);
        out += drawHistogramBars(panel, stats.heights[gi], gi, xMap, yMap, geometry, s, false);
        out += drawNumericAxes(panel, {
          s,
          xMap,
          yMap,
          xTicks,
          yTicks,
          xStep,
          yStep,
          showXLabels: gi === groups.length - 1,
          showYLabels: true,
          boxMode
        });
        out += histogramFacetLabel(panel, group, getGallerySeriesStyle(gi).color, s);
      });

      out += histogramAxisTitles(W, H, p, s);
      return out;
    }

    // Standard single histogram or explicit overlay mode.
    const yTicks = densityMode ? makeNiceTicks(0, yMaxPadded || 1, 5) : histogramFrequencyTicks(yMaxPadded || 1);
    const yStep = yTicks.length > 1 ? yTicks[1] - yTicks[0] : 1;
    const plotYMax = yTicks[yTicks.length - 1] || 1;
    const xMap = mapLinear(geometry.domainMin, geometry.domainMax, p.l, p.l + p.w);
    const yMap = mapLinear(0, plotYMax, p.t + p.h, p.t + 8);

    groups.forEach((group, gi) => {
      out += drawHistogramBars(p, stats.heights[gi], gi, xMap, yMap, geometry, s, groups.length > 1);
    });

    out += drawNumericAxes(p, {
      s,
      xMap,
      yMap,
      xTicks,
      yTicks,
      xStep,
      yStep,
      showXLabels: true,
      showYLabels: true,
      boxMode
    });
    if (groups.length > 1) out += galleryLegend(groups);
    out += histogramAxisTitles(W, H, p, s);
    return out;
  };

  galleryScatter = function patchedGalleryScatter(W, H, bubble) {
    const s = ensureFixSettings();
    const p = galleryPlotBox(W, H);
    const rows = state.gallery.rows.filter(r => Number.isFinite(r.X) && Number.isFinite(r.Y));
    if (!rows.length) return '';

    const groups = [...new Set(rows.map(r => String(r.Group || 'All')))].sort();
    const xs = rows.map(r => r.X);
    const ys = rows.map(r => r.Y);
    const xpad = (Math.max(...xs) - Math.min(...xs) || 1) * 0.08;
    const ypad = (Math.max(...ys) - Math.min(...ys) || 1) * 0.10;
    const xmin = Math.min(...xs) - xpad;
    const xmax = Math.max(...xs) + xpad;
    const ymin = Math.min(...ys) - ypad;
    const ymax = Math.max(...ys) + ypad;
    const xMap = scaleLinear(xmin, xmax, p.l, p.l + p.w);
    const yMap = scaleLinear(ymin, ymax, p.t + p.h, p.t);

    let out = commonAxes(
      W, H, p,
      makeTicks(xmin, xmax, null, 6),
      makeTicks(ymin, ymax, null, 6),
      v => xMap(v),
      yMap
    ) + galleryLegend(groups);

    const sizes = rows.map(r => r.Size).filter(Number.isFinite);
    const smin = sizes.length ? Math.min(...sizes) : 0;
    const smax = sizes.length ? Math.max(...sizes) : 1;

    groups.forEach((g, gi) => {
      const st = getGallerySeriesStyle(gi);
      const groupRows = rows.filter(r => String(r.Group || 'All') === g);
      const body = groupRows.map(r => {
        const radius = bubble && Number.isFinite(r.Size)
          ? st.pointSize + (r.Size - smin) / (smax - smin || 1) * Math.max(5, st.pointSize * 2)
          : st.pointSize;
        const attrs = `fill="${st.markerFill === 'white' ? 'white' : st.color}" fill-opacity="${st.opacity}" stroke="${st.color}" stroke-width="1.1"`;
        return markerShapeSvg(st.markerShape, xMap(r.X), yMap(r.Y), radius, attrs);
      }).join('');
      out += `<g data-gobject="series" data-gseries="${gi}" class="chart-object">${body}</g>`;
    });

    const analysis = state.gallery.analysis;
    const symbol = s.correlationMethod === 'spearman' ? 'ρ' : 'r';

    if (s.scatterFitMode === 'overall') {
      const m = analysis?.overall;
      if (s.showRegression && m && Number.isFinite(m.slope) && Number.isFinite(m.intercept)) {
        const y1 = m.intercept + m.slope * xmin;
        const y2 = m.intercept + m.slope * xmax;
        out += `<g data-gobject="regression" class="chart-object"><line x1="${xMap(xmin)}" y1="${yMap(y1)}" x2="${xMap(xmax)}" y2="${yMap(y2)}" stroke="#222" stroke-width="${s.lineWidth}" stroke-dasharray="6 4"/></g>`;
      }
      if (s.showCorrelation && m) {
        out += `<text data-gobject="regression" class="chart-object" x="${p.l + p.w - 8}" y="${p.t + 20}" text-anchor="end" font-size="${s.annotationSize}" font-style="italic">${symbol} = ${formatNumber(m.association, 3)}, R² = ${formatNumber(m.r2, 3)}</text>`;
      }
      return out;
    }

    const table = analysis?.table || [];
    const annotationRows = [];

    groups.forEach((g, gi) => {
      const st = getGallerySeriesStyle(gi);
      const groupRows = rows.filter(r => String(r.Group || 'All') === g);
      const model = table.find(r => String(r.Group) === g);
      if (!model) return;

      const gx = groupRows.map(r => r.X).filter(Number.isFinite);
      const gxMin = Math.min(...gx);
      const gxMax = Math.max(...gx);

      if (s.showRegression && gx.length >= 2 && gxMax > gxMin && Number.isFinite(model.Slope) && Number.isFinite(model.Intercept)) {
        const gy1 = model.Intercept + model.Slope * gxMin;
        const gy2 = model.Intercept + model.Slope * gxMax;
        out += `<g data-gobject="regression" data-gseries="${gi}" class="chart-object"><line x1="${xMap(gxMin)}" y1="${yMap(gy1)}" x2="${xMap(gxMax)}" y2="${yMap(gy2)}" stroke="${st.color}" stroke-width="${s.lineWidth}" stroke-dasharray="6 4"/></g>`;
      }

      if (s.showCorrelation) {
        annotationRows.push({
          group: g,
          color: st.color,
          correlation: model.Correlation,
          r2: model.R2
        });
      }
    });

    if (annotationRows.length) {
      const lineHeight = Math.max(18, Number(s.annotationSize) + 8);
      const x = p.l + p.w - 8;
      annotationRows.forEach((item, i) => {
        const y = p.t + 20 + i * lineHeight;
        out += `<text data-gobject="regression" data-gseries="${i}" class="chart-object" x="${x}" y="${y}" text-anchor="end" font-size="${s.annotationSize}" font-style="italic" fill="${item.color}">${esc(item.group)}: ${symbol} = ${formatNumber(item.correlation, 3)}, R² = ${formatNumber(item.r2, 3)}</text>`;
      });
    }

    return out;
  };

  ensureFixSettings();
})();
