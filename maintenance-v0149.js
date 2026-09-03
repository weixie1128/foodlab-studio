'use strict';
/*
 * FoodLab Studio v0.14.9 maintenance patch
 * Scope: statistical guardrails, missing-value display, safer chart extents,
 *        and clearer behavior when independent replication is insufficient.
 *
 * This file is intentionally a post-load patch so the existing v0.14.8
 * application remains intact. service-worker.js loads this file after the
 * current template-fixes.js without requiring index.html to be rewritten.
 */
(() => {
  if (globalThis.__FOODLAB_MAINTENANCE_0149__) return;
  globalThis.__FOODLAB_MAINTENANCE_0149__ = true;

  const PATCH_VERSION = '0.14.9';
  const finiteNumber = v => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const finiteValues = values => {
    const out = [];
    for (const value of values || []) {
      const n = Number(value);
      if (Number.isFinite(n)) out.push(n);
    }
    return out;
  };
  const numericExtent = values => {
    let min = Infinity, max = -Infinity, count = 0;
    for (const value of values || []) {
      const n = Number(value);
      if (!Number.isFinite(n)) continue;
      if (n < min) min = n;
      if (n > max) max = n;
      count++;
    }
    return count ? { min, max, count } : null;
  };
  const chartRangeExtent = () => {
    let min = Infinity, max = -Infinity, count = 0;
    const curve = state?.chart?.type === 'curve';
    for (const row of state?.chartData || []) {
      const m = finiteNumber(row.mean);
      if (m === null) continue;
      const e = finiteNumber(row.error);
      const lo = !curve && e !== null ? m - Math.abs(e) : m;
      const hi = !curve && e !== null ? m + Math.abs(e) : m;
      if (lo < min) min = lo;
      if (hi > max) max = hi;
      count++;
    }
    return count ? { min, max, count } : null;
  };
  const groupCounts = (rows, key) => {
    const map = new Map();
    for (const row of rows || []) {
      const label = row?.[key];
      map.set(label, (map.get(label) || 0) + 1);
    }
    return map;
  };
  const twoWayCellCounts = rows => {
    const map = new Map();
    for (const row of rows || []) {
      const k = `${String(row.a)}\u0001${String(row.b)}`;
      map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  };
  const insufficientMessage = detail =>
    `独立样本不足，未执行推断统计。${detail || '每个比较组至少需要 2 个独立样本。'} Mean 仍可用于描述，但 SD、SE、95% CI、ANOVA 和显著性字母不会被强行解释为有效结果。`;

  // ---- Missing values must never be displayed as a real numeric zero. ----
  if (typeof formatNumber === 'function') {
    formatNumber = function foodlabFormatNumber0149(v, d = 3) {
      if (v === null || v === undefined || v === '') return '—';
      const n = Number(v);
      if (!Number.isFinite(n)) return '—';
      if (Number(d) <= 0) return Math.round(n).toString();
      return n.toFixed(d).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
    };
  }
  if (typeof formatPText === 'function') {
    formatPText = function foodlabFormatPText0149(p) {
      const n = Number(p);
      if (!Number.isFinite(n)) return 'p = —';
      return `p ${n < .001 ? '< 0.001' : `= ${n.toFixed(3)}`}`;
    };
  }

  // ---- A standard deviation requires at least two independent observations. ----
  if (typeof sampleSd === 'function') {
    sampleSd = function foodlabSampleSd0149(values) {
      const a = finiteValues(values);
      if (a.length < 2) return null;
      const m = a.reduce((sum, v) => sum + v, 0) / a.length;
      return Math.sqrt(a.reduce((sum, v) => sum + (v - m) ** 2, 0) / (a.length - 1));
    };
  }

  if (typeof descriptiveStats === 'function') {
    descriptiveStats = function foodlabDescriptiveStats0149(rows) {
      const map = new Map();
      (rows || []).forEach(r => {
        const key = `${r.a}\u0001${r.b}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(r);
      });
      return [...map.entries()].map(([key, samples]) => {
        const [a, b] = key.split('\u0001');
        const values = samples.map(r => Number(r.value)).filter(Number.isFinite);
        const n = values.length;
        const m = n ? values.reduce((sum, v) => sum + v, 0) / n : null;
        const sd = n >= 2 ? sampleSd(values) : null;
        const se = Number.isFinite(sd) ? sd / Math.sqrt(n) : null;
        const ci = Number.isFinite(se) ? se * tCritical975(n - 1) : null;
        const technicalCounts = samples.map(r => Number(r.technicalN) || 1);
        const te = numericExtent(technicalCounts);
        const technicalLabel = new Set(technicalCounts).size === 1
          ? String(technicalCounts[0])
          : `${te?.min ?? '—'}–${te?.max ?? '—'}`;
        return {
          a, b, n, mean: m, sd, se, ci,
          cv: m === 0 || !Number.isFinite(sd) ? null : Math.abs(sd / m * 100),
          values, technicalLabel,
          inferenceReady: n >= 2
        };
      }).sort((x, y) =>
        levelIndex(x.a, state.design.factorALevels) - levelIndex(y.a, state.design.factorALevels) ||
        levelIndex(x.b, state.design.factorBLevels) - levelIndex(y.b, state.design.factorBLevels)
      );
    };
  }

  // ---- Guard ANOVA against n=1 cells/groups and other invalid degrees of freedom. ----
  if (typeof oneWayAnova === 'function') {
    const originalOneWayAnova0149 = oneWayAnova;
    oneWayAnova = function foodlabOneWayAnova0149(rows, key = 'a') {
      const counts = groupCounts(rows, key);
      const groups = [...counts.entries()].map(([label, n]) => ({
        label,
        n,
        values: (rows || []).filter(r => r?.[key] === label).map(r => Number(r.value)).filter(Number.isFinite)
      }));
      groups.forEach(g => { g.mean = g.values.length ? g.values.reduce((s, v) => s + v, 0) / g.values.length : null; });
      const groupCountExtent = numericExtent(groups.map(g => g.n));
      const minCount = groupCountExtent?.min ?? 0;
      if (groups.length < 2) {
        return { kind: 'one', valid: false, balanced: false, groups, rows: [], mse: null, dfError: null, pMain: null,
          message: insufficientMessage('单因素比较至少需要 2 个组。') };
      }
      if (minCount < 2) {
        return { kind: 'one', valid: false, balanced: new Set(groups.map(g => g.n)).size === 1, groups, rows: [], mse: null, dfError: null, pMain: null,
          message: insufficientMessage(`检测到至少一个组只有 ${minCount} 个独立样本。`) };
      }
      const result = originalOneWayAnova0149.call(this, rows, key);
      result.valid = Number.isFinite(result.dfError) && result.dfError > 0;
      if (!result.valid) {
        result.rows = [];
        result.mse = null;
        result.pMain = null;
        result.message = insufficientMessage('误差自由度不足。');
        return result;
      }
      // Degenerate but mathematically well-defined case: zero within-group variance.
      if (result.mse === 0 && Array.isArray(result.rows) && result.rows.length) {
        const main = result.rows[0];
        const differentMeans = Number(main?.ss) > 1e-15;
        main.F = differentMeans ? Infinity : 0;
        main.p = differentMeans ? 0 : 1;
        result.pMain = main.p;
      }
      return result;
    };
  }

  if (typeof twoWayAnova === 'function') {
    const originalTwoWayAnova0149 = twoWayAnova;
    twoWayAnova = function foodlabTwoWayAnova0149(rows) {
      const A = [...new Set((rows || []).map(r => r.a))];
      const B = [...new Set((rows || []).map(r => r.b))];
      if ((state.workflow.chartType === 'line' || state.workflow.chartType === 'curve') && A.length > 250) {
        return originalTwoWayAnova0149.call(this, rows);
      }
      if (A.length < 2 || B.length < 2) {
        return { kind: 'two', valid: false, balanced: false, A, B, rows: [], mse: null, dfError: null,
          message: insufficientMessage('双因素 ANOVA 要求两个因素都至少具有 2 个水平。') };
      }
      const counts = [...twoWayCellCounts(rows).values()];
      const complete = counts.length === A.length * B.length;
      const minCount = numericExtent(counts)?.min ?? 0;
      if (!complete || minCount < 2) {
        const detail = !complete
          ? '双因素设计存在缺失的因素组合。'
          : `检测到至少一个因素组合只有 ${minCount} 个独立样本。`;
        return { kind: 'two', valid: false, balanced: false, A, B, rows: [], mse: null, dfError: null,
          message: insufficientMessage(detail) };
      }
      const result = originalTwoWayAnova0149.call(this, rows);
      result.valid = !!result.balanced && Number.isFinite(result.dfError) && result.dfError > 0;
      if (!result.valid && !result.message) result.message = insufficientMessage('误差自由度不足。');
      if (result.valid && result.mse === 0 && Array.isArray(result.rows)) {
        const effectRows = result.rows.slice(0, 3);
        effectRows.forEach(r => {
          const different = Number(r.ss) > 1e-15;
          r.F = different ? Infinity : 0;
          r.p = different ? 0 : 1;
        });
        result.pA = effectRows[0]?.p ?? null;
        result.pB = effectRows[1]?.p ?? null;
        result.pAB = effectRows[2]?.p ?? null;
      }
      return result;
    };
  }

  // ---- Never manufacture the letter "a" when no valid comparison exists. ----
  if (typeof lettersForComparisons === 'function') {
    const originalLettersForComparisons0149 = lettersForComparisons;
    lettersForComparisons = function foodlabLettersForComparisons0149(items, mse, df) {
      if (!Array.isArray(items) || items.length < 2) return {};
      if (items.some(item => !(Number(item.n) >= 2))) return {};
      if (!Number.isFinite(Number(df)) || Number(df) <= 0 || !Number.isFinite(Number(mse)) || Number(mse) < 0) return {};
      if (Number(mse) === 0) {
        const labels = items.map(x => x.label);
        const sig = Array.from({ length: items.length }, () => Array(items.length).fill(false));
        const meanExtent = numericExtent(items.map(x => Math.abs(Number(x.mean) || 0)));
        const scale = Math.max(1, meanExtent?.max ?? 1);
        const tol = scale * 1e-12;
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            sig[i][j] = sig[j][i] = Math.abs(Number(items[i].mean) - Number(items[j].mean)) > tol;
          }
        }
        const sorted = items.map((it, i) => ({ ...it, original: i })).sort((a, b) => b.mean - a.mean);
        const sortedSig = sorted.map(a => sorted.map(b => sig[a.original][b.original]));
        return compactLetterDisplay(sorted.map(x => x.label), sortedSig);
      }
      return originalLettersForComparisons0149.call(this, items, mse, df);
    };
  }

  if (typeof errorValue === 'function') {
    errorValue = function foodlabErrorValue0149(row) {
      const key = state.design.errorType === 'se' ? 'se' : state.design.errorType === 'ci' ? 'ci' : 'sd';
      return Number.isFinite(row?.[key]) ? row[key] : null;
    };
  }
  if (typeof errorSvg === 'function') {
    const originalErrorSvg0149 = errorSvg;
    errorSvg = function foodlabErrorSvg0149(x, y, e, c, series, clipId = '') {
      if (!Number.isFinite(Number(e)) || Number(e) <= 0) return '';
      return originalErrorSvg0149.call(this, x, y, e, c, series, clipId);
    };
  }

  // If even one group lacks an estimable error term, hide the entire chart error-bar
  // layer for that render rather than visually implying zero uncertainty for that group.
  const wrapErrorWidthForRender = fn => function foodlabRenderWithSafeErrors0149(...args) {
    const settings = state?.chart?.settings;
    if (!settings) return fn.apply(this, args);
    const hasUnavailable = (state.descriptive || []).some(r => !Number.isFinite(errorValue(r)));
    if (!hasUnavailable) return fn.apply(this, args);
    const oldWidth = settings.errorWidth;
    settings.errorWidth = 0;
    try { return fn.apply(this, args); }
    finally { settings.errorWidth = oldWidth; }
  };
  if (typeof renderNormalPlot === 'function') renderNormalPlot = wrapErrorWidthForRender(renderNormalPlot);
  if (typeof renderBrokenPlot === 'function') renderBrokenPlot = wrapErrorWidthForRender(renderBrokenPlot);

  // ---- Safer O(n) extents for large chart arrays (no giant function-argument spread). ----
  if (typeof autoScaleChart === 'function') {
    autoScaleChart = function foodlabAutoScaleChart0149() {
      const s = state.chart.settings, ext = chartRangeExtent();
      if (!ext) return;
      const min = ext.min, max = ext.max, range = max - min || Math.abs(max) || 1, pad = range * .13;
      if (state.chart.type === 'bar' && !state.chart.breakAxis && min >= 0) {
        s.yMin = 0; s.yMax = niceCeil(max + pad);
      } else {
        s.yMin = niceFloor(min - pad); s.yMax = niceCeil(max + pad);
      }
      s.yTickStep = null;
    };
  }
  if (typeof autoBreakScale === 'function') {
    autoBreakScale = function foodlabAutoBreakScale0149() {
      const s = state.chart.settings, ext = chartRangeExtent();
      if (!ext) return;
      const min = ext.min, max = ext.max, range = max - min || Math.abs(max) * .08 || 1;
      const upperStep = niceStep(range / 4);
      s.upperMin = Math.floor((min - range * .10) / upperStep) * upperStep;
      s.upperMax = Math.ceil((max + range * .10) / upperStep) * upperStep;
      s.lowerMin = 0;
      if (s.upperMin < 10) {
        const omitted = Math.max(.5, range * 1.2);
        s.lowerMax = Math.max(0, Math.floor((s.upperMin - omitted) / upperStep) * upperStep);
      } else {
        s.lowerMax = niceStep(s.upperMin / 4);
      }
      if (s.lowerMax >= s.upperMin) s.lowerMax = Math.max(0, s.upperMin - upperStep * 2);
    };
  }
  if (typeof chartBounds === 'function') {
    chartBounds = function foodlabChartBounds0149() {
      const s = state.chart.settings, ext = chartRangeExtent();
      let min = ext?.min ?? 0, max = ext?.max ?? 1;
      const pad = (max - min || 1) * .12;
      min = s.yMin ?? (min - pad);
      max = s.yMax ?? (max + pad);
      if (max <= min) max = min + 1;
      if (s.yTickRound && s.yMin == null && s.yMax == null) {
        const step = niceAxisStep(max - min, s.yAxisSegments || 6);
        min = Math.floor(min / step) * step;
        max = Math.ceil(max / step) * step;
      }
      return { min, max };
    };
  }

  // ---- Univariate gallery inference receives the same replication guardrails. ----
  if (typeof runUnivariateInference === 'function') {
    const originalRunUnivariateInference0149 = runUnivariateInference;
    runUnivariateInference = function foodlabRunUnivariateInference0149(rows) {
      const groups = groupValues(rows);
      if (groups.size < 2 || [...groups.values()].some(rs => rs.length < 2)) {
        return {
          anova: null, pairwise: [], letters: {},
          methodName: statisticalMethodLabel(),
          invalid: true,
          message: insufficientMessage('箱线图/小提琴图的组间推断要求每组至少 2 个独立观测。')
        };
      }
      return originalRunUnivariateInference0149.call(this, rows);
    };
  }

  if (typeof analyzeUnivariate === 'function') {
    analyzeUnivariate = function foodlabAnalyzeUnivariate0149(rows) {
      const groups = groupValues(rows), table = [];
      groups.forEach((rs, g) => {
        const v = rs.map(r => Number(r.Value)).filter(Number.isFinite);
        const st = boxStats(v), ext = numericExtent(v);
        table.push({
          Group: g, n: v.length,
          Mean: v.length ? mean(v) : null,
          SD: v.length >= 2 ? sampleSd(v) : null,
          Median: st.q2, Q1: st.q1, Q3: st.q3,
          WhiskerLow: st.low, WhiskerHigh: st.high,
          Min: ext?.min ?? null, Max: ext?.max ?? null,
          Outliers: st.out.length
        });
      });
      const all = rows.map(r => Number(r.Value)).filter(Number.isFinite);
      const highest = table.length ? table.reduce((a, b) => Number(a.Mean) > Number(b.Mean) ? a : b) : null;
      const lowest = table.length ? table.reduce((a, b) => Number(a.Mean) < Number(b.Mean) ? a : b) : null;
      let anova = null, pairwise = [], letters = {}, methodName = '—', inferenceMessage = '';
      if (groups.size > 1) {
        const result = runUnivariateInference(rows);
        anova = result.anova;
        pairwise = result.pairwise || [];
        letters = result.letters || {};
        methodName = result.methodName || statisticalMethodLabel();
        inferenceMessage = result.message || '';
      }
      const sigCount = pairwise.filter(x => Number(x.p) < .05).length;
      const method = boxMethodLabels();
      const omnibus = anova && Number.isFinite(anova.pMain)
        ? `${anova.methodName || methodName} ${anova.pMain < .05 ? '检出' : '未检出'}总体组间差异（${formatPText(anova.pMain)}）`
        : (inferenceMessage || '未执行组间检验');
      const pairText = pairwise.length ? `；${methodName} 中有 ${sigCount} 组两两比较达到校正后 p<0.05` : '';
      return {
        kind: 'univariate', table, anova, pairwise, letters, methodName, boxMethod: method,
        summary: [['有效观测', all.length], ['组别数', table.length], ['总体均值', all.length ? formatNumber(mean(all), 3) : '—'], ['总体检验 p', anova ? formatP(anova.pMain) : '—']],
        text: `共分析 ${all.length} 个原始观测，包含 ${table.length} 个组。${table.length > 1 && highest && lowest ? `${highest.Group} 的均值最高，${lowest.Group} 的均值最低。` : ''} ${omnibus}${pairText}。箱线图四分位数采用“${method.quartile}”，须线采用“${method.whisker}”。`
      };
    };
  }

  // ---- Statistics UI: unavailable CI is shown as em dash, not mean-to-mean. ----
  if (typeof renderDescriptiveTable === 'function') {
    renderDescriptiveTable = function foodlabRenderDescriptiveTable0149() {
      const d = state.design, cols = d.designType === 'two' ? 9 : 8;
      let html = `<thead><tr><th>${esc(d.factorAName)}</th>${d.designType === 'two' ? `<th>${esc(d.factorBName)}</th>` : ''}<th>n（独立样本）</th><th>每样品测定次数</th><th>Mean</th><th>SD</th><th>SE</th><th>CV (%)</th><th>95% CI</th></tr></thead><tbody>`;
      if (!state.descriptive.length) html += `<tr><td colspan="${cols}" class="empty-row">请先导入原始数据</td></tr>`;
      const displayLimit = 300, displayRows = state.descriptive.slice(0, displayLimit);
      displayRows.forEach(r => {
        const ciText = Number.isFinite(r.ci) ? `${formatNumber(r.mean - r.ci, 4)}–${formatNumber(r.mean + r.ci, 4)}` : '—';
        html += `<tr><td>${esc(r.a)}</td>${d.designType === 'two' ? `<td>${esc(r.b)}</td>` : ''}<td>${r.n}</td><td>${esc(r.technicalLabel)}</td><td>${formatNumber(r.mean,4)}</td><td>${formatNumber(r.sd,4)}</td><td>${formatNumber(r.se,4)}</td><td>${r.cv == null ? '—' : formatNumber(r.cv,2)}</td><td>${ciText}</td></tr>`;
      });
      if (state.descriptive.length > displayLimit) html += `<tr><td colspan="${cols}" class="empty-row">为保证大数据页面流畅，仅显示前 ${displayLimit} 个实验组合；绘图和计算仍使用全部 ${state.descriptive.length} 个组合。</td></tr>`;
      $('#descriptiveTable').innerHTML = html + '</tbody>';
    };
  }

  if (typeof renderAnovaTable === 'function') {
    const originalRenderAnovaTable0149 = renderAnovaTable;
    renderAnovaTable = function foodlabRenderAnovaTable0149() {
      const a = state.analysis;
      if (!a || a.valid !== false) return originalRenderAnovaTable0149.apply(this, arguments);
      $('#anovaMethodText').textContent = '当前数据仅提供描述统计；独立样本或误差自由度不足时不会自动执行 ANOVA 或生成显著性结论。';
      $('#anovaTable').innerHTML = `<thead><tr><th>统计状态</th></tr></thead><tbody><tr><td class="empty-row">${esc(a.message || insufficientMessage())}</td></tr></tbody>`;
    };
  }

  if (typeof renderInterpretation === 'function') {
    const originalRenderInterpretation0149 = renderInterpretation;
    renderInterpretation = function foodlabRenderInterpretation0149() {
      const a = state.analysis;
      if (!a || a.valid !== false) return originalRenderInterpretation0149.apply(this, arguments);
      const box = $('#interpretationText');
      box.className = 'interpretation';
      box.innerHTML = `<p>${esc(a.message || insufficientMessage())}</p><p class="small-note">此处不把“无法检验”写成“无显著差异”。请增加独立平行样本后再进行推断统计。</p>`;
    };
  }

  if (typeof renderStatistics === 'function') {
    const originalRenderStatistics0149 = renderStatistics;
    renderStatistics = function foodlabRenderStatistics0149() {
      const out = originalRenderStatistics0149.apply(this, arguments);
      if (state.workflow.mode === 'experiment' && state.analysis?.valid === false) {
        const cards = document.querySelectorAll('#summaryCards .summary-card b');
        if (cards[3]) cards[3].textContent = '仅描述统计';
      }
      return out;
    };
  }

  // Visible verification without touching the legacy FOODLAB_BUILD localStorage handshake.
  const applyPatchBadge = () => {
    document.documentElement.dataset.foodlabMaintenance = PATCH_VERSION;
    const foot = document.querySelector('.sidebar-foot');
    if (foot) foot.textContent = 'v0.14.9 · 稳定性维护版';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyPatchBadge, { once: true });
  else applyPatchBadge();

  globalThis.FoodLabMaintenance0149 = Object.freeze({ version: PATCH_VERSION, numericExtent, finiteValues });
  console.info(`[FoodLab Studio] maintenance patch v${PATCH_VERSION} active`);
})();
