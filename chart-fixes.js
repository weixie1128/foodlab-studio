'use strict';

/*
 * FoodLab Studio v0.10.2 — histogram axis-range/display redesign + grouped-scatter fix
 *
 * Histogram principles in this patch:
 * - X is always a true continuous linear numeric axis.
 * - The left/right domain boundaries are explicitly ticked; truncated X axes show a break mark.
 * - Histogram bars always occupy the full bin interval and remain touching.
 * - Apparent bar width is controlled only through binning (auto/manual bin count), never by shrinking SVG rectangles.
 * - Multi-variable facets reserve space for tick labels, so panel spacing does not overlap labels.
 * - Legend swatches scale with legend font size and use one row whenever the canvas is wide enough.
 */
(() => {
  const originalGallerySpecificPropertyHtml = gallerySpecificPropertyHtml;
  const originalGalleryMethodNoteText = galleryMethodNoteText;
  const originalAnalyzeXY = analyzeXY;

  const num = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const clampLocal = (v, a, b) => Math.max(a, Math.min(b, v));
  const finiteValues = arr => arr.map(Number).filter(Number.isFinite);

  function ensureFixSettings() {
    const s = state.gallery.settings;
    if (typeof s.histAutoBins !== 'boolean') s.histAutoBins = true;
    if (!['frequency', 'density'].includes(s.histogramScale)) s.histogramScale = 'frequency';
    if (!['facet', 'overlay'].includes(s.histDisplayMode)) s.histDisplayMode = 'facet';
    if (!['auto', 'independent', 'shared'].includes(s.histAxisMode)) s.histAxisMode = 'auto';
    if (!['group', 'overall'].includes(s.scatterFitMode)) s.scatterFitMode = 'group';
    if (!Number.isFinite(Number(s.histFacetGap))) s.histFacetGap = 14;
    if (!['compact', 'standard', 'relaxed', 'manual'].includes(s.histXRangePreset)) s.histXRangePreset = 'standard';
    if (!Number.isFinite(Number(s.histXPaddingPct))) s.histXPaddingPct = 6;
    if (s.histManualXMin === undefined) s.histManualXMin = null;
    if (s.histManualXMax === undefined) s.histManualXMax = null;
    if (typeof s.histShowAxisBreak !== 'boolean') s.histShowAxisBreak = true;
    // v0.10.0 exposed a visual rectangle-width scale. It is intentionally ignored now:
    // histogram bar width must equal the numerical bin interval.
    return s;
  }

  function niceStepLocal(raw) {
    const value = Math.abs(Number(raw) || 0);
    if (!(value > 0)) return 1;
    const power = Math.floor(Math.log10(value));
    const scale = Math.pow(10, power);
    const unit = value / scale;
    const niceUnit = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
    return niceUnit * scale;
  }

  function prettyNumber(v, step = null) {
    const value = Number(v);
    if (!Number.isFinite(value)) return '';
    const ref = Math.abs(Number(step) || 0);
    let digits = 0;
    if (ref > 0) {
      // Preserve fractional nice steps such as 2.5 (do not round 47.5 -> 48).
      const fixed = ref.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
      const dot = fixed.indexOf('.');
      digits = dot >= 0 ? clampLocal(fixed.length - dot - 1, 0, 6) : 0;
    }
    let text = value.toFixed(digits);
    if (digits > 0) text = text.replace(/0+$/, '').replace(/\.$/, '');
    return text === '-0' ? '0' : text;
  }

  function autoHistogramBinCount(values) {
    const a = finiteValues(values).sort((x, y) => x - y);
    const n = a.length;
    if (n <= 1) return 1;
    const min = a[0], max = a[n - 1], range = max - min;
    if (!(range > 0)) return 1;

    const q1 = quantileByMethod(a, 0.25, 'linear7');
    const q3 = quantileByMethod(a, 0.75, 'linear7');
    const iqr = q3 - q1;
    const fdWidth = iqr > 0 ? 2 * iqr * Math.pow(n, -1 / 3) : 0;
    const fdBins = fdWidth > 0 ? Math.ceil(range / fdWidth) : NaN;
    const sturges = Math.ceil(Math.log2(n) + 1);
    let suggested = Number.isFinite(fdBins) && fdBins >= 3 ? fdBins : sturges;
    return clampLocal(Math.round(suggested), 2, Math.min(40, Math.max(2, n)));
  }

  function resolvedHistogramBinCount(values, requested, auto) {
    const n = finiteValues(values).length;
    if (!n) return 1;
    if (auto) return autoHistogramBinCount(values);
    return clampLocal(Math.round(Number(requested) || 10), 2, 40);
  }

  function resolvedHistogramGeometry(values, requested, auto) {
    const arr = finiteValues(values).sort((a, b) => a - b);
    if (!arr.length) return { domainMin: 0, domainMax: 1, binWidth: 1, bins: 1 };

    let dataMin = arr[0], dataMax = arr[arr.length - 1];
    if (!(dataMax > dataMin)) {
      const pad = Math.abs(dataMin || 1) * 0.05 || 0.5;
      dataMin -= pad;
      dataMax += pad;
    }

    const target = resolvedHistogramBinCount(arr, requested, auto);
    const range = dataMax - dataMin;

    if (!auto) {
      // Manual bin count means exactly that many touching bins. We still pad the
      // domain to simple boundaries, then divide that continuous domain exactly.
      const edgeStep = niceStepLocal(range / Math.max(4, Math.min(8, target)));
      let domainMin = Math.floor(dataMin / edgeStep) * edgeStep;
      let domainMax = Math.ceil(dataMax / edgeStep) * edgeStep;
      if (!(domainMax > domainMin)) domainMax = domainMin + edgeStep;
      const binWidth = (domainMax - domainMin) / target;
      return {
        domainMin: Number(domainMin.toFixed(12)),
        domainMax: Number(domainMax.toFixed(12)),
        binWidth: Number(binWidth.toFixed(12)),
        bins: target
      };
    }

    // Automatic mode prefers a readable numerical bin width, so edges and ticks
    // naturally land on values such as 5.5, 5.6... or 20, 25, 30....
    let width = niceStepLocal(range / Math.max(1, target));
    let domainMin = Math.floor(dataMin / width) * width;
    let domainMax = Math.ceil(dataMax / width) * width;
    let bins = Math.round((domainMax - domainMin) / width);
    let guard = 0;
    while ((bins > 30 || bins < 2) && guard++ < 10) {
      width = bins > 30 ? niceStepLocal(width * 1.6) : niceStepLocal(width / 2);
      domainMin = Math.floor(dataMin / width) * width;
      domainMax = Math.ceil(dataMax / width) * width;
      bins = Math.round((domainMax - domainMin) / width);
    }
    bins = clampLocal(bins, 2, 40);
    domainMax = domainMin + bins * width;
    return {
      domainMin: Number(domainMin.toFixed(12)),
      domainMax: Number(domainMax.toFixed(12)),
      binWidth: Number(width.toFixed(12)),
      bins
    };
  }

  function histogramXTicks(geometry, maxTicks = 8) {
    const edges = Array.from({ length: geometry.bins + 1 }, (_, i) =>
      Number((geometry.domainMin + i * geometry.binWidth).toFixed(12))
    );
    if (edges.length <= maxTicks) return edges;
    const stride = Math.ceil(geometry.bins / Math.max(2, maxTicks - 1));
    const ticks = edges.filter((_, i) => i % stride === 0);
    const last = edges[edges.length - 1];
    if (Math.abs(ticks[ticks.length - 1] - last) > Math.abs(geometry.binWidth) * 1e-8) ticks.push(last);
    return ticks;
  }

  function histogramFrequencyTicks(maxValue) {
    const maxV = Math.max(1, Number(maxValue) || 1);
    const step = Math.max(1, niceStepLocal(maxV / 5));
    const end = Math.ceil(maxV / step) * step;
    const ticks = [];
    for (let v = 0; v <= end + step * 0.25; v += step) {
      ticks.push(Number(v.toFixed(10)));
      if (ticks.length > 50) break;
    }
    return ticks;
  }

  function densityTicks(maxValue) {
    const maxV = Math.max(Number(maxValue) || 0, 1e-12);
    const step = niceStepLocal(maxV / 5);
    const end = Math.ceil(maxV / step) * step;
    const ticks = [];
    for (let v = 0; v <= end + step * 0.25; v += step) {
      ticks.push(Number(v.toFixed(12)));
      if (ticks.length > 50) break;
    }
    return ticks;
  }

  function isDefaultHistogramAxisTitle(value) {
    return ['', 'Value', 'Frequency', 'Density', '频数', '密度'].includes(String(value ?? '').trim());
  }

  function mapLinear(a, b, c, d) {
    const den = b - a || 1;
    return v => c + (v - a) / den * (d - c);
  }


  function hasFiniteSetting(v) {
    return v !== null && v !== '' && Number.isFinite(Number(v));
  }

  function histogramPaddingAmount(geometry, s) {
    const preset = s.histXRangePreset || 'standard';
    const bin = Math.abs(Number(geometry.binWidth) || 0);
    if (preset === 'compact') return 0;
    if (preset === 'relaxed') return bin * 2;
    if (preset === 'manual') {
      const range = Math.max(bin || 1, geometry.domainMax - geometry.domainMin);
      return range * clampLocal(num(s.histXPaddingPct, 6), 0, 50) / 100;
    }
    return bin;
  }

  function histogramDisplayDomain(geometry, s, allowManual = false) {
    const naturalMin = geometry.domainMin;
    const naturalMax = geometry.domainMax;
    if (allowManual && s.histXRangePreset === 'manual') {
      const hasMin = hasFiniteSetting(s.histManualXMin);
      const hasMax = hasFiniteSetting(s.histManualXMax);
      const min = hasMin ? Number(s.histManualXMin) : naturalMin;
      const max = hasMax ? Number(s.histManualXMax) : naturalMax;
      if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
        return {
          domainMin: min,
          domainMax: max,
          manual: true,
          cropsLeft: min > naturalMin + Math.abs(geometry.binWidth) * 1e-9,
          cropsRight: max < naturalMax - Math.abs(geometry.binWidth) * 1e-9
        };
      }
    }

    const pad = histogramPaddingAmount(geometry, s);
    return {
      domainMin: naturalMin - pad,
      domainMax: naturalMax + pad,
      manual: false,
      cropsLeft: false,
      cropsRight: false
    };
  }

  function histogramDisplayTicks(display, geometry, maxTicks = 8) {
    const min = display.domainMin, max = display.domainMax;
    if (!(Number.isFinite(min) && Number.isFinite(max) && max > min)) return [geometry.domainMin, geometry.domainMax];
    const target = Math.max(3, maxTicks - 1);
    const step = niceStepLocal((max - min) / target);
    const innerStart = Math.ceil((min - step * 1e-9) / step) * step;
    const ticks = [Number(min.toFixed(12))];
    for (let v = innerStart; v <= max + step * 1e-9; v += step) {
      const vv = Number(v.toFixed(12));
      if (Math.abs(vv - min) < step * 0.22 || Math.abs(vv - max) < step * 0.22) continue;
      ticks.push(vv);
      if (ticks.length > 40) break;
    }
    ticks.push(Number(max.toFixed(12)));
    return [...new Set(ticks)].sort((a, b) => a - b);
  }

  function histogramManualRangeHtml(s) {
    const min = hasFiniteSetting(s.histManualXMin) ? String(s.histManualXMin) : '';
    const max = hasFiniteSetting(s.histManualXMax) ? String(s.histManualXMax) : '';
    const active = s.histXRangePreset === 'manual';
    return `<div class="field" style="margin-top:8px;${active ? '' : 'opacity:.58'}">
      <label>手动 X 轴范围（单图 / 共享 X 轴）</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
        <input type="number" step="any" data-hist-manual-axis="histManualXMin" placeholder="Min（自动）" value="${esc(min)}">
        <input type="number" step="any" data-hist-manual-axis="histManualXMax" placeholder="Max（自动）" value="${esc(max)}">
      </div>
      <small>仅改变显示范围，不改变分箱和频数。独立多变量分面使用“紧凑度”分别扩展各自 X 轴。</small>
    </div>`;
  }

  function histogramCounts(rows, groups, geometry, densityMode) {
    const counts = groups.map(() => Array(geometry.bins).fill(0));
    const sizes = groups.map(g => rows.filter(r => String(r.Group || 'All') === g).length);
    rows.forEach(r => {
      const group = String(r.Group || 'All');
      const gi = groups.indexOf(group);
      const value = Number(r.Value);
      if (gi < 0 || !Number.isFinite(value)) return;
      let bi = Math.floor((value - geometry.domainMin) / geometry.binWidth);
      if (value >= geometry.domainMax) bi = geometry.bins - 1;
      bi = clampLocal(bi, 0, geometry.bins - 1);
      counts[gi][bi] += 1;
    });
    return counts.map((arr, gi) => arr.map(c =>
      densityMode ? c / (Math.max(1, sizes[gi]) * geometry.binWidth) : c
    ));
  }

  function histogramSeriesValues(rows, group) {
    return rows
      .filter(r => String(r.Group || 'All') === group)
      .map(r => Number(r.Value))
      .filter(Number.isFinite);
  }

  function histogramNeedsIndependentAxes(groups, rows) {
    if (groups.length <= 1) return false;
    const stats = groups.map(g => {
      const v = histogramSeriesValues(rows, g).sort((a, b) => a - b);
      if (!v.length) return null;
      const min = v[0], max = v[v.length - 1], median = v[Math.floor((v.length - 1) / 2)];
      const range = Math.max(max - min, Math.abs(median) * 0.02, 1e-9);
      return { min, max, median, range };
    }).filter(Boolean);
    if (stats.length <= 1) return false;

    const medAbs = stats.map(x => Math.abs(x.median)).filter(x => x > 1e-12);
    if (medAbs.length >= 2 && Math.max(...medAbs) / Math.min(...medAbs) > 4) return true;
    const globalMin = Math.min(...stats.map(x => x.min));
    const globalMax = Math.max(...stats.map(x => x.max));
    const meanLocal = stats.reduce((sum, x) => sum + x.range, 0) / stats.length;
    return globalMax - globalMin > meanLocal * 4.5;
  }

  function drawXAxisBreak(panel, geometry, s) {
    if (s.histShowAxisBreak === false) return '';
    // A truncated continuous X axis is valid for a histogram, but the break mark
    // prevents the left Y-axis intersection from being misread as x = 0.
    if (geometry.domainMin <= 0 && geometry.domainMax >= 0) return '';
    const axis = s.axisColor || '#20262b';
    const y = panel.t + panel.h;
    const x = panel.l + 11;
    return `<g data-gobject="axis-x" class="chart-object" pointer-events="none">
      <rect x="${x - 5}" y="${y - 4}" width="23" height="9" fill="${s.background || '#fff'}"/>
      <line x1="${x}" y1="${y + 4}" x2="${x + 7}" y2="${y - 4}" stroke="${axis}" stroke-width="${num(s.axisWidth, 1.35)}"/>
      <line x1="${x + 8}" y1="${y + 4}" x2="${x + 15}" y2="${y - 4}" stroke="${axis}" stroke-width="${num(s.axisWidth, 1.35)}"/>
    </g>`;
  }

  function drawNumericAxes(panel, { s, xMap, yMap, xTicks, yTicks, xStep, yStep, geometry, showXLabels = true, showYLabels = true, boxMode = true }) {
    const axis = s.axisColor || '#20262b';
    const sw = num(s.axisWidth, 1.35);
    const tick = num(s.tickLength, 6);
    const xSize = num(s.xTickSize, 12);
    const ySize = num(s.yTickSize, 12);
    const xWeight = num(s.xTickWeight, 400);
    const yWeight = num(s.yTickWeight, 400);
    let out = '';

    if (boxMode) {
      out += `<rect x="${panel.l}" y="${panel.t}" width="${panel.w}" height="${panel.h}" fill="none" stroke="${axis}" stroke-width="${num(s.frameWidth, 1.15)}"/>`;
    } else {
      out += `<line x1="${panel.l}" y1="${panel.t + panel.h}" x2="${panel.l + panel.w}" y2="${panel.t + panel.h}" stroke="${axis}" stroke-width="${sw}"/>`;
      out += `<line x1="${panel.l}" y1="${panel.t}" x2="${panel.l}" y2="${panel.t + panel.h}" stroke="${axis}" stroke-width="${sw}"/>`;
    }

    if (showYLabels) {
      yTicks.forEach(v => {
        const y = yMap(v);
        out += `<line x1="${panel.l}" x2="${panel.l - tick}" y1="${y}" y2="${y}" stroke="${axis}" stroke-width="${sw}"/>`;
        out += `<text x="${panel.l - tick - 5}" y="${y + ySize * 0.34}" text-anchor="end" font-size="${ySize}" font-weight="${yWeight}" fill="${s.yTickColor || axis}">${esc(prettyNumber(v, yStep))}</text>`;
      });
    }

    if (showXLabels) {
      xTicks.forEach((v, i) => {
        const x = xMap(v);
        const first = i === 0, last = i === xTicks.length - 1;
        const anchor = first ? 'start' : last ? 'end' : 'middle';
        const dx = first ? 2 : last ? -2 : 0;
        out += `<line x1="${x}" x2="${x}" y1="${panel.t + panel.h}" y2="${panel.t + panel.h + tick}" stroke="${axis}" stroke-width="${sw}"/>`;
        out += `<text x="${x + dx}" y="${panel.t + panel.h + tick + xSize + 4}" text-anchor="${anchor}" font-size="${xSize}" font-weight="${xWeight}" fill="${s.xTickColor || axis}">${esc(prettyNumber(v, xStep))}</text>`;
      });
      out += drawXAxisBreak(panel, geometry, s);
    }
    return out;
  }

  function drawHistogramBars(panel, heights, gi, xMap, yMap, geometry, s, overlay = false) {
    const st = getGallerySeriesStyle(gi);
    const opacity = overlay ? Math.min(0.32, num(s.opacity, 0.72)) : Math.min(0.9, Math.max(0.45, num(s.opacity, 0.72)));
    const lw = Math.max(0.45, num(st.lineWidth, s.lineWidth));
    let body = '';
    heights.forEach((height, i) => {
      const left = geometry.domainMin + i * geometry.binWidth;
      const right = left + geometry.binWidth;
      let x1 = xMap(left), x2 = xMap(right);
      if (x2 < panel.l || x1 > panel.l + panel.w) return;
      x1 = clampLocal(x1, panel.l, panel.l + panel.w);
      x2 = clampLocal(x2, panel.l, panel.l + panel.w);
      const y = yMap(height);
      // No visual shrink/gap: histogram rectangle width is exactly the numerical bin interval.
      // A wider display domain creates only outer whitespace; it never inserts gaps between bins.
      body += `<rect x="${x1}" y="${y}" width="${Math.max(0, x2 - x1)}" height="${Math.max(0, panel.t + panel.h - y)}" fill="${st.color}" fill-opacity="${opacity}" stroke="${st.color}" stroke-width="${lw}"/>`;
    });
    return `<g data-gobject="series" data-gseries="${gi}" class="chart-object">${body}</g>`;
  }

  function estimateLegendTextWidth(text, fontSize) {
    let em = 0;
    for (const ch of String(text)) em += ch.charCodeAt(0) > 255 ? 0.98 : 0.60;
    return Math.max(fontSize * 1.5, em * fontSize);
  }

  function histogramLegendLayout(groups, W, base, s) {
    const fontSize = Math.max(8, num(s.legendFontSize, 12));
    const marker = clampLocal(fontSize * 0.78, 8, 30);
    const markerGap = Math.max(5, fontSize * 0.35);
    const itemGap = Math.max(12, fontSize * 0.85);
    const rowGap = Math.max(4, fontSize * 0.28);
    const rowHeight = Math.max(marker, fontSize) + rowGap;
    const x0 = num(s.legendX, base.l + 8);
    const y0 = num(s.legendY, Math.max(34, base.t - 28));
    const usableWidth = Math.max(100, W - base.l - 24);
    const widths = groups.map(g => marker + markerGap + estimateLegendTextWidth(g, fontSize) + itemGap);
    const totalWidth = widths.reduce((a, b) => a + b, 0) - itemGap;
    const forceOneRow = totalWidth <= usableWidth;
    const rows = [];
    let current = [], used = 0;
    groups.forEach((g, gi) => {
      const w = widths[gi];
      if (!forceOneRow && current.length && used + w > usableWidth) {
        rows.push(current);
        current = [];
        used = 0;
      }
      current.push({ g, gi, w });
      used += w;
    });
    if (current.length) rows.push(current);

    let items = '';
    rows.forEach((row, ri) => {
      let x = x0;
      const baseline = y0 + ri * rowHeight;
      row.forEach(item => {
        const st = getGallerySeriesStyle(item.gi);
        const markerY = baseline - fontSize * 0.78;
        items += `<rect x="${x}" y="${markerY}" width="${marker}" height="${marker}" fill="${st.color}"/>`;
        items += `<text x="${x + marker + markerGap}" y="${baseline}" font-size="${fontSize}" font-weight="${num(s.legendWeight, 400)}" fill="${s.axisColor || '#20262b'}">${esc(item.g)}</text>`;
        x += item.w;
      });
    });

    const height = rows.length * rowHeight + 6;
    return {
      rows: rows.length,
      height,
      svg: `<g data-gobject="legend" data-gdrag="legend" class="chart-object draggable">${items}</g>`
    };
  }

  function histogramDraggableAxisTitles(W, H, p, s) {
    let out = '';
    const xTitle = String(s.xTitle || '').trim();
    const yTitle = String(s.yTitle || '').trim();
    const x = s.xTitleX ?? (p.l + p.w / 2);
    const y = s.xTitleY ?? (H - 8);
    const yx = s.yTitleX ?? 28;
    const yy = s.yTitleY ?? (p.t + p.h / 2);
    if (s.xTitleVisible !== false && xTitle) {
      out += `<text data-gobject="axis-x" data-gdrag="xTitle" class="chart-object draggable" x="${x}" y="${y}" text-anchor="middle" font-size="${num(s.xTitleSize, 15)}" font-weight="${num(s.xTitleWeight, 400)}" fill="${s.xTitleColor || '#20262b'}">${esc(xTitle)}</text>`;
    }
    if (s.yTitleVisible !== false && yTitle) {
      out += `<text data-gobject="axis-y" data-gdrag="yTitle" class="chart-object draggable" transform="translate(${yx} ${yy}) rotate(-90)" text-anchor="middle" font-size="${num(s.yTitleSize, 15)}" font-weight="${num(s.yTitleWeight, 400)}" fill="${s.yTitleColor || '#20262b'}">${esc(yTitle)}</text>`;
    }
    return out;
  }

  gallerySpecificPropertyHtml = function patchedGallerySpecificPropertyHtml(type, id) {
    const s = ensureFixSettings();

    if (id === 'histogram') {
      return gallerySection('直方图', [
        gCheck('histAutoBins', '自动分箱（推荐：Freedman–Diaconis / Sturges）'),
        gRange('bins', '手动分箱数量（关闭自动后；越少柱越宽，柱体始终相连）', 2, 40, 1),
        gSelect('histDisplayMode', '多列显示方式', [
          ['facet', '分面显示（推荐）'],
          ['overlay', '半透明叠加']
        ]),
        gSelect('histAxisMode', '分面 X 轴范围', [
          ['auto', '自动判断（推荐）'],
          ['independent', '每列独立 X 轴'],
          ['shared', '所有列共享 X 轴']
        ]),
        gSelect('histXRangePreset', 'X 轴显示紧凑度', [
          ['compact', '紧凑（不额外扩展）'],
          ['standard', '标准（两侧各约 1 个 bin）'],
          ['relaxed', '宽松（两侧各约 2 个 bin）'],
          ['manual', '手动范围 / 自定义外边距']
        ]),
        gRange('histXPaddingPct', '手动模式外边距 %（独立分面使用）', 0, 50, 1),
        histogramManualRangeHtml(s),
        gSelect('histogramScale', '纵轴含义', [
          ['frequency', '频数 Frequency'],
          ['density', '概率密度 Density']
        ]),
        gRange('histFacetGap', '分面额外间距（刻度文字之外）', 0, 60, 2),
        gCheck('histShowAxisBreak', '非零起点显示 X 轴截断标记'),
        gRange('opacity', '柱透明度', 0.15, 1, 0.05),
        gRange('lineWidth', '柱边框粗细', 0, 4, 0.1)
      ]) + '<div class="method-badge"><b>绘图规则：</b>分箱决定统计柱宽；X 轴范围只改变柱子的视觉粗细和两侧留白，不改变频数。柱体始终按真实 bin 区间紧密相连，不会因为调坐标范围而在柱间产生空隙。</div>';
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
      const rangeLabel = ({compact:'紧凑',standard:'标准',relaxed:'宽松',manual:'手动'})[s.histXRangePreset] || '标准';
      return `分箱：${s.histAutoBins ? '自动' : `${Math.round(Number(s.bins) || 10)} 个`}；纵轴：${s.histogramScale === 'density' ? 'Density' : 'Frequency'}；X 轴：${s.histAxisMode === 'shared' ? '共享' : s.histAxisMode === 'independent' ? '独立' : '自动判断'}；显示范围：${rangeLabel}`;
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
    const base = galleryPlotBox(W, H);
    const rows = state.gallery.rows.filter(r => Number.isFinite(r.Value));
    if (!rows.length) return '';

    const groups = [...new Set(rows.map(r => String(r.Group || 'All')))];
    const densityMode = s.histogramScale === 'density';
    if (!String(s.xTitle || '').trim()) s.xTitle = 'Value';
    if (isDefaultHistogramAxisTitle(s.yTitle)) s.yTitle = densityMode ? 'Density' : 'Frequency';

    const autoIndependent = histogramNeedsIndependentAxes(groups, rows);
    const independent = s.histAxisMode === 'independent' || (s.histAxisMode === 'auto' && autoIndependent);
    const useFacet = groups.length > 1 && s.histDisplayMode === 'facet';
    const legend = s.legend && groups.length > 1 ? histogramLegendLayout(groups, W, base, s) : { svg: '', rows: 0, height: 0 };

    if (useFacet && independent) {
      // Gap = room for the previous panel's X tick labels + user-controlled extra whitespace.
      const labelBand = num(s.tickLength, 6) + num(s.xTickSize, 12) + 8;
      const panelGap = labelBand + clampLocal(num(s.histFacetGap, 14), 0, 60);
      const legendReserve = legend.rows ? legend.height + 8 : 0;
      const top = base.t + legendReserve;
      const bottomReserve = labelBand + (s.xTitleVisible !== false ? num(s.xTitleSize, 15) + 30 : 12);
      const availableHeight = Math.max(180, H - top - bottomReserve);
      const panelHeight = Math.max(58, (availableHeight - panelGap * (groups.length - 1)) / groups.length);
      let out = legend.svg;

      groups.forEach((group, gi) => {
        const vals = histogramSeriesValues(rows, group);
        const geometry = resolvedHistogramGeometry(vals, s.bins, s.histAutoBins);
        const display = histogramDisplayDomain(geometry, s, false);
        const groupRows = rows.filter(r => String(r.Group || 'All') === group);
        const heights = histogramCounts(groupRows, [group], geometry, densityMode)[0];
        const rawMax = Math.max(0, ...heights);
        const yTicks = densityMode ? densityTicks((rawMax || 1) * 1.08) : histogramFrequencyTicks((rawMax || 1) * 1.08);
        const yMax = yTicks[yTicks.length - 1] || 1;
        const xTicks = histogramDisplayTicks(display, geometry, 10);
        const xStep = xTicks.length > 1 ? Math.min(...xTicks.slice(1).map((v, i) => Math.abs(v - xTicks[i])).filter(v => v > 0)) : geometry.binWidth;
        const yStep = yTicks.length > 1 ? yTicks[1] - yTicks[0] : 1;
        const panel = { l: base.l, t: top + gi * (panelHeight + panelGap), w: base.w, h: panelHeight };
        const xMap = mapLinear(display.domainMin, display.domainMax, panel.l, panel.l + panel.w);
        const yMap = mapLinear(0, yMax, panel.t + panel.h, panel.t + 6);

        out += drawHistogramBars(panel, heights, gi, xMap, yMap, geometry, s, false);
        // Axes are deliberately appended after bars so bars can never cover the X/Y axes.
        out += drawNumericAxes(panel, {
          s, xMap, yMap, xTicks, yTicks, xStep, yStep, geometry: display,
          showXLabels: true,
          showYLabels: true,
          boxMode: String(s.frameMode || 'box') === 'box'
        });
      });

      out += histogramDraggableAxisTitles(W, H, { ...base, t: top, h: availableHeight }, s);
      return out;
    }

    // One metric / shared-axis comparison. Every group uses exactly the same bin edges.
    const values = rows.map(r => Number(r.Value));
    const geometry = resolvedHistogramGeometry(values, s.bins, s.histAutoBins);
    const display = histogramDisplayDomain(geometry, s, true);
    const allHeights = histogramCounts(rows, groups, geometry, densityMode);
    const rawMax = Math.max(0, ...allHeights.flat());
    const yTicks = densityMode ? densityTicks((rawMax || 1) * 1.08) : histogramFrequencyTicks((rawMax || 1) * 1.08);
    const yMax = yTicks[yTicks.length - 1] || 1;
    const xTicks = histogramDisplayTicks(display, geometry, 10);
    const xStep = xTicks.length > 1 ? Math.min(...xTicks.slice(1).map((v, i) => Math.abs(v - xTicks[i])).filter(v => v > 0)) : geometry.binWidth;
    const yStep = yTicks.length > 1 ? yTicks[1] - yTicks[0] : 1;
    const legendReserve = legend.rows ? legend.height + 8 : 0;
    const panel = { ...base, t: base.t + legendReserve, h: Math.max(80, base.h - legendReserve) };
    const xMap = mapLinear(display.domainMin, display.domainMax, panel.l, panel.l + panel.w);
    const yMap = mapLinear(0, yMax, panel.t + panel.h, panel.t + 6);

    let out = legend.svg;
    groups.forEach((group, gi) => {
      out += drawHistogramBars(panel, allHeights[gi], gi, xMap, yMap, geometry, s, groups.length > 1);
    });
    out += drawNumericAxes(panel, {
      s, xMap, yMap, xTicks, yTicks, xStep, yStep, geometry: display,
      showXLabels: true,
      showYLabels: true,
      boxMode: String(s.frameMode || 'box') === 'box'
    });
    out += histogramDraggableAxisTitles(W, H, panel, s);
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


  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('change', event => {
      const input = event.target?.closest?.('[data-hist-manual-axis]');
      if (!input) return;
      const key = input.dataset.histManualAxis;
      if (!['histManualXMin', 'histManualXMax'].includes(key)) return;
      const raw = String(input.value ?? '').trim();
      state.gallery.settings[key] = raw === '' ? null : Number(raw);
      const min = state.gallery.settings.histManualXMin;
      const max = state.gallery.settings.histManualXMax;
      if (hasFiniteSetting(min) && hasFiniteSetting(max) && Number(max) <= Number(min)) {
        if (typeof toast === 'function') toast('X 轴 Max 必须大于 Min；当前将暂时使用自动范围。');
      } else {
        const vals = (state.gallery.rows || []).map(r => Number(r.Value)).filter(Number.isFinite);
        if (vals.length) {
          const dataMin = Math.min(...vals), dataMax = Math.max(...vals);
          const hidesLeft = hasFiniteSetting(min) && Number(min) > dataMin;
          const hidesRight = hasFiniteSetting(max) && Number(max) < dataMax;
          if ((hidesLeft || hidesRight) && typeof toast === 'function') toast('提示：当前手动 X 轴范围会隐藏部分数据。');
        }
        if (typeof renderChartStudio === 'function') renderChartStudio();
      }
    }, true);
  }

  ensureFixSettings();
})();
