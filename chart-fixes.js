'use strict';

/*
 * FoodLab Studio v0.9.6 — histogram & grouped-scatter hotfix
 *
 * This file intentionally patches only the generic-chart histogram/scatter
 * functions after app.js has loaded. The rest of FoodLab Studio remains on
 * the original app.js implementation.
 */
(() => {
  const originalGallerySpecificPropertyHtml = gallerySpecificPropertyHtml;
  const originalGalleryMethodNoteText = galleryMethodNoteText;
  const originalAnalyzeXY = analyzeXY;

  function ensureFixSettings() {
    const s = state.gallery.settings;
    if (typeof s.histAutoBins !== 'boolean') s.histAutoBins = true;
    if (!['frequency', 'density'].includes(s.histogramScale)) s.histogramScale = 'frequency';
    if (!['group', 'overall'].includes(s.scatterFitMode)) s.scatterFitMode = 'group';
    return s;
  }

  function autoHistogramBinCount(values) {
    const a = values.filter(Number.isFinite).sort((x, y) => x - y);
    const n = a.length;
    if (n <= 1) return 1;

    const min = a[0];
    const max = a[n - 1];
    const range = max - min;
    if (!(range > 0)) return 1;

    const q1 = quantileByMethod(a, 0.25, 'linear7');
    const q3 = quantileByMethod(a, 0.75, 'linear7');
    const iqr = q3 - q1;
    const fdWidth = iqr > 0 ? 2 * iqr * Math.pow(n, -1 / 3) : 0;
    const fdBins = fdWidth > 0 ? Math.ceil(range / fdWidth) : NaN;
    const sturges = Math.ceil(Math.log2(n) + 1);

    // FD is preferred for ordinary samples; Sturges prevents severe
    // over-fragmentation for very small or nearly uniform datasets.
    let suggested = Number.isFinite(fdBins) && fdBins >= 3 ? fdBins : sturges;
    suggested = clamp(Math.round(suggested), 1, 40);
    return Math.min(suggested, n);
  }

  function resolvedHistogramBinCount(values, requested, auto) {
    const n = values.filter(Number.isFinite).length;
    if (!n) return 1;
    if (auto) return autoHistogramBinCount(values);
    return clamp(Math.round(Number(requested) || 10), 1, 40);
  }

  function histogramFrequencyTicks(maxValue) {
    const ymax = Math.max(1, Math.ceil(maxValue));
    const raw = ymax / 5;
    const step = Math.max(1, Math.ceil(niceStep(raw)));
    const ticks = [];
    for (let v = 0; v <= ymax + step * 0.25; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] < ymax) ticks.push(ymax);
    return [...new Set(ticks)];
  }

  function isDefaultHistogramAxisTitle(value) {
    return ['', 'Value', 'Frequency', 'Density', '频数', '密度'].includes(String(value ?? '').trim());
  }

  // Add only the controls needed by these two fixes. Other property panels are
  // delegated untouched to the original implementation.
  gallerySpecificPropertyHtml = function patchedGallerySpecificPropertyHtml(type, id) {
    const s = ensureFixSettings();

    if (id === 'histogram') {
      return gallerySection('直方图', [
        gCheck('histAutoBins', '自动分箱（推荐：Freedman–Diaconis / Sturges）'),
        gSelect('histogramScale', '纵轴含义', [
          ['frequency', '频数 Frequency'],
          ['density', '概率密度 Density']
        ]),
        gRange('bins', '手动分箱数量（关闭自动后生效）', 2, 40, 1),
        gRange('opacity', '柱透明度', 0.15, 1, 0.05),
        gRange('lineWidth', '柱边框粗细', 0, 4, 0.1)
      ]) + '<div class="method-badge"><b>绘图规则：</b>所有组共享同一组连续分箱边界；相邻柱体无人工间隙。空白区只表示该数值区间确实没有观测。</div>';
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
    if (['scatter', 'bubble'].includes(type)) {
      return `相关：${correlationMethodLabel(s.correlationMethod)}；拟合：${s.scatterFitMode === 'group' ? '按组分别' : '全部样本整体'}普通最小二乘线性回归`;
    }
    return originalGalleryMethodNoteText();
  };

  // Keep the original statistics structure, but make the automatic
  // interpretation consistent with the plotted grouped regressions.
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
    const vals = rows.map(r => r.Value);
    let dataMin = Math.min(...vals);
    let dataMax = Math.max(...vals);

    if (!(dataMax > dataMin)) {
      const pad = Math.abs(dataMin || 1) * 0.05 || 0.5;
      dataMin -= pad;
      dataMax += pad;
    }

    const bins = resolvedHistogramBinCount(vals, s.bins, s.histAutoBins);
    const step = (dataMax - dataMin) / bins;
    const counts = groups.map(() => Array(bins).fill(0));
    const groupSizes = groups.map(g => rows.filter(r => String(r.Group || 'All') === g).length);

    rows.forEach(r => {
      const gi = groups.indexOf(String(r.Group || 'All'));
      let bi = Math.floor((r.Value - dataMin) / step);
      if (r.Value === dataMax) bi = bins - 1;
      bi = clamp(bi, 0, bins - 1);
      counts[gi][bi] += 1;
    });

    const densityMode = s.histogramScale === 'density';
    const heights = counts.map((arr, gi) => arr.map(n => densityMode ? n / ((groupSizes[gi] || 1) * step) : n));
    const yMaxRaw = Math.max(0, ...heights.flat());
    const yMax = densityMode ? (yMaxRaw || 1) * 1.06 : Math.max(1, Math.ceil(yMaxRaw));

    if (!s.xTitle) s.xTitle = 'Value';
    if (isDefaultHistogramAxisTitle(s.yTitle)) s.yTitle = densityMode ? 'Density' : 'Frequency';

    const xMap = scaleLinear(dataMin, dataMax, p.l, p.l + p.w);
    const yMap = scaleLinear(0, yMax, p.t + p.h, p.t);
    const xTicks = makeTicks(dataMin, dataMax, null, 6);
    const yTicks = densityMode ? makeTicks(0, yMax, null, 5) : histogramFrequencyTicks(yMax);
    let out = commonAxes(W, H, p, xTicks, yTicks, v => xMap(v), yMap) + galleryLegend(groups);

    heights.forEach((arr, gi) => {
      const st = getGallerySeriesStyle(gi);
      let body = '';
      arr.forEach((height, i) => {
        const left = dataMin + i * step;
        const right = i === bins - 1 ? dataMax : dataMin + (i + 1) * step;
        const x1 = xMap(left);
        const x2 = xMap(right);
        // No '-1 px' shrink here: adjacent bins share the same boundary.
        const width = Math.max(0.5, x2 - x1 + 0.05);
        const y = yMap(height);
        body += `<rect x="${x1}" y="${y}" width="${width}" height="${p.t + p.h - y}" fill="${st.color}" fill-opacity="${st.opacity}" stroke="${st.color}" stroke-width="${st.lineWidth}"/>`;
      });
      out += `<g data-gobject="series" data-gseries="${gi}" class="chart-object">${body}</g>`;
    });

    return out;
  };

  galleryScatter = function patchedGalleryScatter(W, H, bubble) {
    const s = ensureFixSettings();
    const p = galleryPlotBox(W, H);
    const rows = state.gallery.rows.filter(r => Number.isFinite(r.X) && Number.isFinite(r.Y));
    if (!rows.length) return '';

    const groups = [...new Set(rows.map(r => String(r.Group || 'All')))];
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

    // Default: one model per group. Each line is restricted to that group's
    // observed X range so the chart does not imply unsupported extrapolation.
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
