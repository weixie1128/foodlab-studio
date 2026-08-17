'use strict';

/*
 * FoodLab Studio v0.9.7 — human-friendly gallery template patch
 *
 * Goals:
 * 1) Keep the existing app.js intact.
 * 2) Redesign gallery chart templates so users can fill wide, human-readable tables.
 * 3) Preserve backward compatibility: old long tables still import.
 * 4) Limit risk by patching only gallery-template generation / import flow.
 */
(() => {
  if (typeof state === 'undefined') return;

  const originalCurrentWorkflowSchema = typeof currentWorkflowSchema === 'function' ? currentWorkflowSchema : null;
  const originalRenderDesignPreview = typeof renderDesignPreview === 'function' ? renderDesignPreview : null;
  const originalProcessGalleryImported = typeof processGalleryImported === 'function' ? processGalleryImported : null;

  const q = sel => document.querySelector(sel);

  const FRIENDLY_SCHEMA_META = {
    hist: {
      kind: 'univariate',
      name: '多数据列宽表（推荐）',
      description: '第一列可写平行号/序号，后面每个数值列代表一个待绘制的数据集或变量（如 pH、剪切力、亮度、TBARS；也可以是 Control、Treatment A 等同一指标处理组）。无需 SampleID。',
      planSchema: '多数据列宽表'
    },
    kde: {
      kind: 'univariate',
      name: '分组宽表（推荐）',
      description: '每列一个 Group，直接填写原始值。适用于 KDE、箱线图、小提琴图和直方图。兼容旧长表。',
      planSchema: '分组宽表'
    },
    box: {
      kind: 'univariate',
      name: '分组宽表（推荐）',
      description: '每列一个 Group，直接填写原始值。无需 SampleID，也无需重复 Group 列。兼容旧长表。',
      planSchema: '分组宽表'
    },
    violin: {
      kind: 'univariate',
      name: '分组宽表（推荐）',
      description: '每列一个 Group，直接填写原始值。适合样本较多时快速录入。兼容旧长表。',
      planSchema: '分组宽表'
    },
    scatter: {
      kind: 'xy',
      name: '分组 XY 宽表（推荐）',
      description: '每个 Group 使用一对列：Group X、Group Y。无需 SampleID，也无需单独 Group 列。兼容旧长表。',
      planSchema: '分组 XY 宽表'
    },
    bubble: {
      kind: 'bubble',
      name: '分组 XY+Size 宽表（推荐）',
      description: '每个 Group 使用三列：Group X、Group Y、Group Size。无需 SampleID，也无需重复 Group 列。兼容旧长表。',
      planSchema: '分组 XY+Size 宽表'
    },
    stacked: {
      kind: 'composition',
      name: '组成宽表（推荐）',
      description: '第一列写组分/类别，后面每列一个 Group。比 Category-Group-Value 长表更适合人工录入。兼容旧长表。',
      planSchema: '组成宽表'
    },
    pie: {
      kind: 'composition',
      name: '组成宽表（推荐）',
      description: '第一列写组分/类别，后面每列一个 Group。单组饼图也可只保留 1 列数值。兼容旧长表。',
      planSchema: '组成宽表'
    },
    radar: {
      kind: 'radar',
      name: '雷达宽表（推荐）',
      description: '第一列写指标，后面每列一个 Group。无需反复填写 Group 和 Indicator。兼容旧长表。',
      planSchema: '雷达宽表'
    }
  };

  function normalize(h) {
    if (typeof normalizeHeader === 'function') return normalizeHeader(h);
    return String(h ?? '').trim().toLowerCase().replace(/[\s_()（）%]/g, '');
  }

  function text(v) {
    return String(v ?? '').trim();
  }

  function isFiniteNumber(v) {
    const n = Number(v);
    return Number.isFinite(n);
  }

  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function isBlankRow(row) {
    return !row || row.every(cell => text(cell) === '');
  }

  function firstNonBlankRow(matrix) {
    for (let i = 0; i < matrix.length; i++) {
      if (!isBlankRow(matrix[i])) return i;
    }
    return -1;
  }

  function matrixToObjects(matrix) {
    const start = firstNonBlankRow(matrix);
    if (start < 0) return [];
    const header = (matrix[start] || []).map(h => text(h));
    const out = [];
    for (let r = start + 1; r < matrix.length; r++) {
      const row = matrix[r] || [];
      if (isBlankRow(row)) continue;
      const obj = {};
      let hasAny = false;
      header.forEach((h, c) => {
        if (!h) return;
        obj[h] = row[c] ?? '';
        if (text(row[c]) !== '') hasAny = true;
      });
      if (hasAny) out.push(obj);
    }
    return out;
  }

  function defaultGroups(minCount = 3) {
    const custom = (state.design?.factorBLevels || []).map(text).filter(Boolean);
    if (custom.length) return custom;
    const fallback = ['Control', 'Treatment A', 'Treatment B'];
    return fallback.slice(0, Math.max(minCount, 1));
  }

  function currentGroups() {
    return defaultGroups(3);
  }

  function previewTemplate(type) {
    const groups = currentGroups();

    if (['hist', 'kde', 'box', 'violin'].includes(type)) {
      return {
        headers: ['平行号', ...groups],
        rows: [
          [1, 5.42, 5.74, 5.63],
          [2, 5.55, 5.81, 5.70],
          [3, 5.61, 5.88, 5.76],
          [4, 5.48, 5.77, 5.68],
          [5, 5.58, 5.83, 5.73],
          [6, 5.64, 5.91, 5.80]
        ]
      };
    }

    if (type === 'scatter') {
      const headers = ['序号'];
      groups.slice(0, 3).forEach(g => headers.push(`${g} X`, `${g} Y`));
      return {
        headers,
        rows: [
          [1, 1.00, 1.96, 4.60, 5.04, 5.70, 5.48],
          [2, 1.45, 2.48, 5.05, 5.02, 6.15, 5.96],
          [3, 1.90, 3.00, 5.50, 5.54, 6.60, 6.44],
          [4, 2.35, 2.98, 5.95, 6.06, 7.05, 6.92],
          [5, 2.80, 3.50, 6.40, 6.04, 7.50, 7.40],
          [6, 3.25, 4.02, 6.85, 6.56, 7.95, 7.88],
          [7, 3.70, 4.00, 7.30, 7.08, 8.40, 8.36]
        ]
      };
    }

    if (type === 'bubble') {
      const headers = ['序号'];
      groups.slice(0, 3).forEach(g => headers.push(`${g} X`, `${g} Y`, `${g} Size`));
      return {
        headers,
        rows: [
          [1, 1.00, 1.96, 12, 4.60, 5.04, 18, 5.70, 5.48, 16],
          [2, 1.45, 2.48, 13, 5.05, 5.02, 20, 6.15, 5.96, 17],
          [3, 1.90, 3.00, 14, 5.50, 5.54, 22, 6.60, 6.44, 18],
          [4, 2.35, 2.98, 15, 5.95, 6.06, 24, 7.05, 6.92, 19],
          [5, 2.80, 3.50, 16, 6.40, 6.04, 26, 7.50, 7.40, 20],
          [6, 3.25, 4.02, 17, 6.85, 6.56, 28, 7.95, 7.88, 22]
        ]
      };
    }

    if (['stacked', 'pie'].includes(type)) {
      return {
        headers: ['类别', ...groups],
        rows: [
          ['Moisture', 72.4, 70.1, 68.8],
          ['Protein', 18.6, 19.1, 19.7],
          ['Fat', 6.2, 7.4, 8.1],
          ['Ash', 1.3, 1.5, 1.6],
          ['Other', 1.5, 1.9, 1.8]
        ]
      };
    }

    if (type === 'radar') {
      return {
        headers: ['指标', ...groups],
        rows: [
          ['Color', 7.2, 7.8, 6.9],
          ['Texture', 6.8, 7.6, 6.5],
          ['Flavor', 7.0, 7.4, 6.8],
          ['Juiciness', 6.6, 7.2, 6.1],
          ['Overall', 7.1, 7.7, 6.6]
        ]
      };
    }

    return null;
  }

  function patchPlanMeta() {
    try {
      if (typeof PLAN_CHART_META === 'undefined') return;
      Object.entries(FRIENDLY_SCHEMA_META).forEach(([id, meta]) => {
        if (PLAN_CHART_META[id]) PLAN_CHART_META[id].schema = meta.planSchema;
      });
    } catch (_) {}
  }

  if (originalCurrentWorkflowSchema) {
    currentWorkflowSchema = function patchedCurrentWorkflowSchema() {
      const base = originalCurrentWorkflowSchema();
      if (state.workflow?.mode !== 'gallery') return base;
      const meta = FRIENDLY_SCHEMA_META[state.workflow.chartType];
      if (!meta) return base;
      return { ...base, name: meta.name, description: meta.description };
    };
  }

  function renderFriendlyGalleryPreview() {
    const tpl = previewTemplate(state.workflow.chartType);
    if (!tpl) {
      if (originalRenderDesignPreview) return originalRenderDesignPreview();
      return;
    }
    const schema = currentWorkflowSchema();
    const headers = tpl.headers;
    const rows = tpl.rows;
    const summary = q('#designSummaryText');
    const count = q('#templateRowCount');
    const table = q('#designPreviewTable');
    if (summary) summary.textContent = `${workflowChartLabel(state.workflow.chartType)} · ${schema.name} · 按人类可读宽表导入`;
    if (count) count.textContent = `${schema.name} · ${rows.length} 行示例`;
    if (table) {
      let html = `<thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>`;
      rows.slice(0, 12).forEach(row => {
        html += `<tr>${headers.map((_, i) => `<td>${esc(row[i] ?? '')}</td>`).join('')}</tr>`;
      });
      html += '</tbody>';
      table.innerHTML = html;
    }
    if (typeof syncWorkflowControls === 'function') syncWorkflowControls();
  }

  if (originalRenderDesignPreview) {
    renderDesignPreview = function patchedRenderDesignPreview() {
      if (state.workflow?.mode === 'gallery' && FRIENDLY_SCHEMA_META[state.workflow.chartType]) {
        return renderFriendlyGalleryPreview();
      }
      return originalRenderDesignPreview();
    };
  }

  function matrixFromTemplate(type) {
    const tpl = previewTemplate(type);
    if (!tpl) return null;
    return [tpl.headers, ...tpl.rows];
  }

  function safeFileName(s) {
    return String(s || 'foodlab').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
  }

  function downloadBlob(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  function downloadFriendlyGalleryCsv() {
    const matrix = matrixFromTemplate(state.workflow.chartType);
    if (!matrix) return;
    const csv = matrix
      .map(row => row.map(cell => {
        const s = String(cell ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
      .join('\n');
    const file = `${safeFileName(state.design?.experimentName)}_${state.workflow.chartType}_friendly_template.csv`;
    downloadBlob(file, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    if (typeof toast === 'function') toast('已生成新版宽表 CSV 模板');
  }

  function downloadFriendlyGalleryXlsx() {
    const matrix = matrixFromTemplate(state.workflow.chartType);
    if (!matrix) return downloadFriendlyGalleryCsv();
    if (!window.XLSX) return downloadFriendlyGalleryCsv();

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(matrix);
    ws['!cols'] = matrix[0].map((h, i) => ({ wch: i === 0 ? 14 : Math.max(12, String(h).length + 4) }));
    ws['!freeze'] = { xSplit: 1, ySplit: 1, topLeftCell: 'B2', activePane: 'bottomRight', state: 'frozen' };
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    const meta = FRIENDLY_SCHEMA_META[state.workflow.chartType] || {};
    const guide = XLSX.utils.aoa_to_sheet([
      ['FoodLab Studio Friendly Template'],
      ['Chart', workflowChartLabel(state.workflow.chartType)],
      ['Layout', meta.name || 'Friendly wide table'],
      ['How to fill', meta.description || 'Fill the table directly.'],
      ['Compatibility', 'The new wide template is recommended. Legacy long tables are still accepted.'],
      ['Reminder', 'Do not change the meaning of header rows. Empty cells are allowed.']
    ]);
    guide['!cols'] = [{ wch: 18 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(wb, guide, 'Instructions');

    const file = `${safeFileName(state.design?.experimentName)}_${state.workflow.chartType}_friendly_template.xlsx`;
    XLSX.writeFile(wb, file);
    if (typeof toast === 'function') toast('已生成新版宽表 Excel 模板');
  }

  function looksLikeIndexHeader(h) {
    const n = normalize(h);
    return [
      '序号', 'index', 'id', 'sampleid', '样品编号', '样本编号', '平行号', '重复号', 'rep', 'replicate', 'parallel'
    ].includes(n) || ['no', 'row'].includes(text(h).trim().toLowerCase());
  }

  function isLegacyLongMatrix(matrix, type) {
    const start = firstNonBlankRow(matrix);
    if (start < 0) return false;
    const headers = (matrix[start] || []).map(normalize);

    if (['hist', 'kde', 'box', 'violin'].includes(type)) {
      return headers.includes('group') && headers.includes('value');
    }
    if (['scatter', 'bubble'].includes(type)) {
      return headers.includes('group') && headers.includes('x') && headers.includes('y');
    }
    if (['stacked', 'pie'].includes(type)) {
      return headers.includes('group') && headers.includes('value') && (headers.includes('category') || headers.includes('component') || headers.includes('part'));
    }
    if (type === 'radar') {
      return headers.includes('group') && headers.includes('value') && (headers.includes('indicator') || headers.includes('metric') || headers.includes('variable'));
    }
    return false;
  }

  function parseWideUnivariate(matrix) {
    const start = firstNonBlankRow(matrix);
    if (start < 0) return [];
    const header = matrix[start].map(h => text(h));
    const skipFirst = header.length > 1 && looksLikeIndexHeader(header[0]);
    const groupStart = skipFirst ? 1 : 0;
    const groups = header.slice(groupStart).map(text).filter(Boolean);
    if (!groups.length) return [];

    const out = [];
    for (let r = start + 1; r < matrix.length; r++) {
      const row = matrix[r] || [];
      if (isBlankRow(row)) continue;
      groups.forEach((g, i) => {
        const value = row[groupStart + i];
        const n = safeNum(value);
        if (n !== null) out.push({ Group: g, Value: n });
      });
    }
    return out;
  }

  function splitGroupVariable(header) {
    const raw = text(header);
    const lower = raw.toLowerCase();
    const suffixes = [
      { key: 'size', re: /(.*?)(?:[\s_\-\/]+)?(?:size|bubble|z)$/i },
      { key: 'x', re: /(.*?)(?:[\s_\-\/]+)?x$/i },
      { key: 'y', re: /(.*?)(?:[\s_\-\/]+)?y$/i }
    ];
    for (const item of suffixes) {
      const m = raw.match(item.re);
      if (m) {
        const group = text(m[1]) || 'All';
        return { group, role: item.key };
      }
    }
    if (['x', 'y', 'size'].includes(lower)) return { group: 'All', role: lower };
    return null;
  }

  function parseWideXY(matrix, bubble = false) {
    const start = firstNonBlankRow(matrix);
    if (start < 0) return [];
    const header = (matrix[start] || []).map(h => text(h));
    const mapping = new Map();

    header.forEach((h, idx) => {
      if (!h) return;
      if (idx === 0 && looksLikeIndexHeader(h)) return;
      const info = splitGroupVariable(h);
      if (!info) return;
      if (!mapping.has(info.group)) mapping.set(info.group, {});
      mapping.get(info.group)[info.role] = idx;
    });

    const out = [];
    [...mapping.entries()].forEach(([group, cols]) => {
      if (!(cols.x >= 0 && cols.y >= 0)) return;
      for (let r = start + 1; r < matrix.length; r++) {
        const row = matrix[r] || [];
        if (isBlankRow(row)) continue;
        const x = safeNum(row[cols.x]);
        const y = safeNum(row[cols.y]);
        if (x === null || y === null) continue;
        const item = { Group: group, X: x, Y: y };
        if (bubble && cols.size >= 0) {
          const size = safeNum(row[cols.size]);
          if (size !== null) item.Size = size;
        }
        out.push(item);
      }
    });

    return out;
  }

  function parseWideComposition(matrix) {
    const start = firstNonBlankRow(matrix);
    if (start < 0) return [];
    const header = (matrix[start] || []).map(h => text(h));
    if (header.length < 2) return [];
    const groups = header.slice(1).map(text).filter(Boolean);
    const out = [];
    for (let r = start + 1; r < matrix.length; r++) {
      const row = matrix[r] || [];
      if (isBlankRow(row)) continue;
      const category = text(row[0]);
      if (!category) continue;
      groups.forEach((g, i) => {
        const value = safeNum(row[i + 1]);
        if (value !== null) out.push({ Category: category, Group: g, Value: value });
      });
    }
    return out;
  }

  function parseWideRadar(matrix) {
    const start = firstNonBlankRow(matrix);
    if (start < 0) return [];
    const header = (matrix[start] || []).map(h => text(h));
    if (header.length < 2) return [];
    const groups = header.slice(1).map(text).filter(Boolean);
    const out = [];
    for (let r = start + 1; r < matrix.length; r++) {
      const row = matrix[r] || [];
      if (isBlankRow(row)) continue;
      const indicator = text(row[0]);
      if (!indicator) continue;
      groups.forEach((g, i) => {
        const value = safeNum(row[i + 1]);
        if (value !== null) out.push({ Indicator: indicator, Group: g, Value: value });
      });
    }
    return out;
  }

  function parseTextMatrix(textInput) {
    const raw = String(textInput || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = raw.split('\n').filter(line => line.trim() !== '');
    if (!lines.length) return [];
    const tabMode = lines.some(line => line.includes('\t'));
    const delim = tabMode ? '\t' : ',';
    return lines.map(line => line.split(delim).map(cell => cell.trim()));
  }

  function completeFriendlyImport(normalized, source) {
    state.gallery.type = state.workflow.chartType;
    state.gallery.rows = normalized;
    state.gallery.sourceName = source;
    if (typeof analyzeGalleryData === 'function') analyzeGalleryData();
    if (typeof renderDataPreview === 'function') renderDataPreview();
    if (typeof showValidation === 'function') {
      showValidation('success', `导入成功：${normalized.length} 行`, `${workflowChartLabel(state.workflow.chartType)} · ${currentWorkflowSchema().name} · ${source}`);
    }
    if (typeof toast === 'function') toast('数据已导入并完成初步分析');
  }

  function importFriendlyMatrix(matrix, source) {
    const type = state.workflow.chartType;
    if (!Array.isArray(matrix) || !matrix.length) {
      if (typeof showValidation === 'function') showValidation('error', '没有读取到有效数据', '文件为空或无法识别。');
      return;
    }

    if (isLegacyLongMatrix(matrix, type) && originalProcessGalleryImported) {
      return originalProcessGalleryImported(matrixToObjects(matrix), source);
    }

    let normalized = [];
    if (['hist', 'kde', 'box', 'violin'].includes(type)) normalized = parseWideUnivariate(matrix);
    else if (type === 'scatter') normalized = parseWideXY(matrix, false);
    else if (type === 'bubble') normalized = parseWideXY(matrix, true);
    else if (['stacked', 'pie'].includes(type)) normalized = parseWideComposition(matrix);
    else if (type === 'radar') normalized = parseWideRadar(matrix);
    else if (originalProcessGalleryImported) return originalProcessGalleryImported(matrixToObjects(matrix), source);

    if (!normalized.length) {
      if (typeof showValidation === 'function') {
        showValidation('error', '没有读取到有效数据', `当前图形推荐使用“${currentWorkflowSchema().name}”。也兼容旧长表。`);
      }
      if (typeof toast === 'function') toast('没有读取到有效数据');
      return;
    }

    completeFriendlyImport(normalized, source);
  }

  async function readAnyFileAsMatrix(file) {
    if (!window.XLSX) throw new Error('Excel 组件未加载，请刷新页面后重试。');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const name = wb.SheetNames.includes('Data') ? 'Data' : wb.SheetNames[0];
    return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true, blankrows: false });
  }

  function galleryFriendlyEnabled() {
    return state.workflow?.mode === 'gallery' && !!FRIENDLY_SCHEMA_META[state.workflow.chartType];
  }

  function interceptDownload(btnId, handler) {
    const el = q(btnId);
    if (!el) return;
    el.addEventListener('click', evt => {
      if (!galleryFriendlyEnabled()) return;
      evt.preventDefault();
      evt.stopImmediatePropagation();
      handler();
    }, true);
  }

  interceptDownload('#downloadCurrentXlsx', downloadFriendlyGalleryXlsx);
  interceptDownload('#downloadCurrentCsv', downloadFriendlyGalleryCsv);
  interceptDownload('#downloadXlsx', downloadFriendlyGalleryXlsx);
  interceptDownload('#downloadCsv', downloadFriendlyGalleryCsv);

  const parseBtn = q('#parsePasted');
  if (parseBtn) {
    parseBtn.addEventListener('click', evt => {
      if (!galleryFriendlyEnabled()) return;
      evt.preventDefault();
      evt.stopImmediatePropagation();
      const textArea = q('#dataText');
      const matrix = parseTextMatrix(textArea ? textArea.value : '');
      importFriendlyMatrix(matrix, '粘贴数据');
    }, true);
  }

  const fileInput = q('#fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', async evt => {
      if (!galleryFriendlyEnabled()) return;
      evt.preventDefault();
      evt.stopImmediatePropagation();
      const file = evt.target?.files?.[0];
      if (!file) return;
      try {
        const matrix = await readAnyFileAsMatrix(file);
        importFriendlyMatrix(matrix, file.name);
      } catch (err) {
        if (typeof showValidation === 'function') showValidation('error', '导入失败', err.message || '无法读取文件');
        if (typeof toast === 'function') toast(err.message || '导入失败');
      } finally {
        evt.target.value = '';
      }
    }, true);
  }

  const dropZone = q('#dropZone');
  if (dropZone) {
    dropZone.addEventListener('dragover', evt => {
      if (!galleryFriendlyEnabled()) return;
      evt.preventDefault();
    }, true);
    dropZone.addEventListener('drop', async evt => {
      if (!galleryFriendlyEnabled()) return;
      evt.preventDefault();
      evt.stopImmediatePropagation();
      const file = evt.dataTransfer?.files?.[0];
      if (!file) return;
      try {
        const matrix = await readAnyFileAsMatrix(file);
        importFriendlyMatrix(matrix, file.name);
      } catch (err) {
        if (typeof showValidation === 'function') showValidation('error', '导入失败', err.message || '无法读取文件');
        if (typeof toast === 'function') toast(err.message || '导入失败');
      }
    }, true);
  }

  patchPlanMeta();
  try {
    if (typeof syncWorkflowControls === 'function') syncWorkflowControls();
    if (typeof renderPlanSelector === 'function') renderPlanSelector();
    if (typeof renderDesignPreview === 'function') renderDesignPreview();
  } catch (_) {}
})();
