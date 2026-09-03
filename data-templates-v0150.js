'use strict';
/*
 * FoodLab Studio v0.15.0 — scientific data-template normalization
 *
 * Goals
 * 1) Separate one-factor and two-factor experiment templates.
 * 2) Treat R1/R2/R3 as independent replicates, never as unrelated Y series.
 * 3) Download blank structural templates only; demo datasets remain demo-only.
 * 4) Keep already-sound multivariate templates unchanged.
 * 5) Generalize gallery, spectrum and thermal templates so they contain no
 *    food-specific or project-specific example names.
 *
 * This patch is intentionally post-load. service-worker.js injects it while
 * template-fixes.js is loading; installation waits for DOMContentLoaded so it
 * runs after the legacy inline patches in index.html have finished.
 */
(() => {
  if (globalThis.__FOODLAB_DATA_TEMPLATES_0150__) return;
  globalThis.__FOODLAB_DATA_TEMPLATES_0150__ = true;

  const VERSION = '0.15.0';
  const EXPERIMENT_TYPES = new Set(['bar', 'line', 'curve']);
  const MULTIVARIATE_TYPES = new Set(['pca', 'hca', 'plsda', 'oplsda', 'plsr', 'oplsr']);
  const REGRESSION_TYPES = new Set(['plsr', 'oplsr']);
  const DEFAULT_REPLICATES = 3;

  const cleanType = type => String(type || '').trim().toLowerCase();
  const clampInt = (value, min, max, fallback) => {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  const csvEscape = value => {
    const s = String(value ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const safeName = value => String(value || 'FoodLab').replace(/[\\/:*?"<>|]/g, '_').trim() || 'FoodLab';

  function appState() {
    try {
      // FoodLab's main app declares `state` with top-level const. In classic
      // scripts that binding is globally reachable but is not window.state.
      return typeof state !== 'undefined' ? state : globalThis.state;
    } catch (_err) {
      return globalThis.state;
    }
  }

  function currentType() {
    const st = appState();
    return cleanType(st?.workflow?.chartType || st?.gallery?.type || '');
  }

  function preferredReplicates() {
    const st = appState();
    return clampInt(st?.design?.parallelSamples, 2, 12, DEFAULT_REPLICATES);
  }

  function experimentSpec(type, design = 'one', replicates = DEFAULT_REPLICATES) {
    type = cleanType(type);
    design = design === 'two' ? 'two' : 'one';
    replicates = clampInt(replicates, 2, 12, DEFAULT_REPLICATES);
    const xHeader = type === 'bar' ? 'Factor_A' : 'X';
    const groups = design === 'two' ? ['Factor_B_1', 'Factor_B_2'] : ['Response'];
    const top = [xHeader];
    const second = [''];
    const merges = [];
    const flatHeaders = [xHeader];
    let column = 1;

    groups.forEach(group => {
      top[column] = group;
      const start = column;
      for (let r = 1; r <= replicates; r++) {
        if (r > 1) top[column] = '';
        second[column] = `R${r}`;
        flatHeaders.push(`${group}__R${r}`);
        column++;
      }
      if (replicates > 1) merges.push({ s: { r: 0, c: start }, e: { r: 0, c: column - 1 } });
    });
    merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } });

    const blankRows = Array.from({ length: 8 }, () => Array(column).fill(''));
    const matrix = [top, second, ...blankRows];
    const flatRows = Array.from({ length: 8 }, () => Array(flatHeaders.length).fill(''));
    const chartLabel = type === 'bar' ? '柱状图' : type === 'line' ? '折线图' : '曲线图';
    const designLabel = design === 'two' ? '双因素' : '单因素';
    const description = design === 'two'
      ? `${chartLabel}双因素原始重复模板：第一列为因素 A / X；每个 Factor_B_* 列块代表因素 B 的一个水平；R1–R${replicates} 是独立重复。`
      : `${chartLabel}单因素原始重复模板：第一列为因素水平 / X；R1–R${replicates} 是同一条件下的独立重复。`;

    const guide = [
      [`FoodLab Studio ${designLabel}${chartLabel}标准模板`],
      ['模板原则', '这是空白数据结构模板，不含任何具体实验案例或虚构测量值。请把结构性占位名称改成你的真实因素/系列名称。'],
      ['独立重复', `R1–R${replicates} 表示独立实验/生物学重复。误差棒、SD/SE、置信区间和推断统计都以独立重复为样本量。`],
      ['不要填写', '不要把 Mean ± SD、均值、标准误或已经汇总的结果填进原始重复单元格。应填写每个独立重复的原始数值。'],
      ['第一列', type === 'bar'
        ? 'Factor_A：填写因素 A 的各个水平/处理条件。每行是一个因素水平。'
        : 'X：填写有顺序的自变量水平，例如时间、温度、浓度等。请只填写真实 X 值；模板不预置示例。'],
      ['第二因素', design === 'two'
        ? 'Factor_B_1、Factor_B_2 分别代表因素 B 的不同水平。请把这些列块名称改成真实水平名称；需要更多水平时复制整组 R 列。'
        : '单因素模板没有第二因素。Response 只是响应变量/同一系列的结构标签，可改成真实指标名称。'],
      ['缺失值', '缺失或尚未测量的数据请留空，不要用 0、横杠、ND 等文字代替。'],
      ['曲线图说明', type === 'curve'
        ? '曲线图适合 X 为连续变量且数据点相对密集的情况。少量离散时点更建议使用折线图，不应通过平滑制造不存在的实验信息。'
        : '不适用。'],
      ['扩展重复', `需要更多独立重复时继续添加 R${replicates + 1}、R${replicates + 2}……；如果存在同一独立样本的技术重复，请使用“技术重复 / 自定义设计模板”。`]
    ];

    return {
      kind: 'experiment', type, design, designLabel, chartLabel, xHeader, groups, replicates,
      name: `${designLabel}${chartLabel} · 原始独立重复模板`,
      description, matrix, flatHeaders, flatRows, merges, width: column, guide
    };
  }

  const GALLERY_TEMPLATE_SPECS = Object.freeze({
    hist: {
      name: '直方图 · 单变量原始观测模板',
      headers: ['SampleID', 'Group', 'Value'],
      description: '每行一个原始观测值；Group 可留空或用于比较不同组。'
    },
    kde: {
      name: 'KDE · 单变量原始观测模板',
      headers: ['SampleID', 'Group', 'Value'],
      description: '每行一个原始观测值；KDE 描述分布，不应只输入均值。'
    },
    box: {
      name: '箱线图 · 单变量原始观测模板',
      headers: ['SampleID', 'Group', 'Value'],
      description: '每行一个独立观测；箱线图需要原始分布数据，而不是 Mean ± SD。'
    },
    violin: {
      name: '小提琴图 · 单变量原始观测模板',
      headers: ['SampleID', 'Group', 'Value'],
      description: '每行一个独立观测；样本量过少时不建议用小提琴图解释密度形状。'
    },
    scatter: {
      name: '散点图 · XY 样本模板',
      headers: ['SampleID', 'Group', 'X', 'Y'],
      description: '每行一个样本/观测，同时填写两个连续变量 X 和 Y；Group 可选。'
    },
    bubble: {
      name: '气泡图 · XYZ 样本模板',
      headers: ['SampleID', 'Group', 'X', 'Y', 'Size'],
      description: '每行一个样本；X、Y 为坐标，Size 为第三个数值变量；Group 可选。'
    },
    stacked: {
      name: '堆叠条形图 · 组成长表',
      headers: ['Category', 'Component', 'Value'],
      description: '每行记录一个类别中的一个组成部分；Value 为原始量或可比较的比例数值。'
    },
    pie: {
      name: '饼图 / 圆环图 · 组成长表',
      headers: ['Category', 'Component', 'Value'],
      description: 'Component 为组分，Value 为组分值；单个饼图的 Category 可留空。'
    },
    heatmap: {
      name: '相关性热力图 · 多指标样本矩阵',
      headers: ['SampleID', 'Group', 'Variable_1', 'Variable_2', 'Variable_3', 'Variable_4'],
      description: '每行一个独立样本，每个 Variable_* 列是一个连续测量指标；Group 可选。'
    },
    radar: {
      name: '雷达图 · 多指标宽表',
      headers: ['Group', 'Indicator_1', 'Indicator_2', 'Indicator_3', 'Indicator_4'],
      description: '第一列为组别/样品，后续每列为一个指标。不同量纲比较形状时应考虑归一化。'
    },
    spectrum: {
      name: '光谱 / 仪器连续信号 · 成对 XY 模板',
      headers: ['X_1', 'Series_1', 'X_2', 'Series_2', 'X_3', 'Series_3'],
      description: '每一对 X_n / Series_n 是一条独立曲线；没有 SampleID，也不预设任何具体仪器或处理组名称。'
    },
    thermal: {
      name: 'DSC / TGA 热分析 · 成对 XY 模板',
      headers: ['X_1', 'Series_1', 'X_2', 'Series_2', 'X_3', 'Series_3'],
      description: 'DSC 与 TGA 共用成对 XY 结构；Series_n 改成真实曲线名称，平台再根据数据或设置识别分析类型。'
    }
  });

  function multivariateHeaders(type) {
    return REGRESSION_TYPES.has(cleanType(type))
      ? ['因素:Factor_1', '因素:Factor_2', '因素:Factor_3', '因变量:Y', '变量:X_1', '变量:X_2', '变量:X_3', '变量:X_4']
      : ['因素:Factor_1', '因素:Factor_2', '因素:Factor_3', '变量:Variable_1', '变量:Variable_2', '变量:Variable_3', '变量:Variable_4'];
  }

  function genericGuide(type, spec) {
    const common = [
      [`FoodLab Studio · ${spec.name}`],
      ['模板原则', '模板只定义列角色，不包含具体食品指标、处理组名称或虚构数值。'],
      ['原始数据', '除组成图外，请优先填写原始观测。不要把 Mean ± SD 作为一个数值单元格导入。'],
      ['缺失值', '缺失数据留空，不要用 0、横杠或文字替代。'],
      ['列名', '可把占位列名改成真实变量名称；保留关键数据角色列（如 SampleID、Group、X、Y、Value）可获得最稳定的自动识别。']
    ];
    if (['hist', 'kde', 'box', 'violin'].includes(type)) common.push(['统计单元', '每行应对应一个独立观测。若同一样本存在多次技术测量，应先按预先确定的规则汇总到独立样本层级，或使用实验重复设计模块。']);
    if (type === 'scatter') common.push(['关系分析', 'X 与 Y 必须来自同一个观测对象/样本；相关性不代表因果关系。']);
    if (type === 'bubble') common.push(['气泡大小', 'Size 应是具有明确含义的数值变量，避免用任意视觉大小制造差异。']);
    if (type === 'stacked') common.push(['组成关系', '如果切换为百分比堆叠，各 Category 内的 Component 将按该类别总量归一化。']);
    if (type === 'pie') common.push(['使用建议', '饼图只适合少量组分构成；类别较多或需要精确比较时优先考虑条形图。']);
    if (type === 'heatmap') common.push(['数值指标', '所有 Variable_* 列都应是连续数值指标；Group 与 SampleID 不进入相关矩阵。']);
    if (type === 'radar') common.push(['量纲', '若指标单位或量纲不同，直接比较多边形形状可能误导；建议明确归一化方式。']);
    if (type === 'spectrum') common.push(
      ['结构', '每两列组成一条曲线：X_1 / Series_1、X_2 / Series_2……。各曲线允许拥有自己的 X 网格。'],
      ['命名', '把 Series_1、Series_2 改成真实样品/条件名称即可；X_1 等也可改成 Wavenumber、Wavelength、Time 等真实 X 名称。'],
      ['数据点', '每一行是曲线上的一个 X 位置，不是一个独立样本，因此不需要 SampleID。']
    );
    if (type === 'thermal') common.push(
      ['结构', 'DSC 与 TGA 都使用成对 XY。X 可为温度或时间；Series 为 Heat flow、Weight 或其他实际信号。'],
      ['DTG', 'DTG 可由 TGA 派生，不需要为了绘制 DTG 而在标准模板中预先填写一套虚构列。'],
      ['命名', 'Series_1 等只是结构占位符，请改成真实曲线名称；模板不再使用 CK、T1、T2 等案例标签。']
    );
    return common;
  }

  function templateSpecForType(type) {
    type = cleanType(type);
    if (EXPERIMENT_TYPES.has(type)) return experimentSpec(type, 'one', DEFAULT_REPLICATES);
    if (MULTIVARIATE_TYPES.has(type)) return {
      kind: 'multivariate', type,
      name: REGRESSION_TYPES.has(type) ? 'PLS / OPLS 回归矩阵' : '多变量样本矩阵',
      headers: multivariateHeaders(type),
      description: REGRESSION_TYPES.has(type)
        ? '因素列作为元数据；因变量:Y 为连续响应；变量:X_* 为连续预测变量。'
        : '因素列作为元数据/分组；变量:Variable_* 为进入模型的连续测量指标。'
    };
    return GALLERY_TEMPLATE_SPECS[type] || null;
  }

  // Pure API is exported before touching the DOM, which also makes regression
  // tests possible with Node without loading the whole browser application.
  globalThis.FoodLabTemplates0150 = Object.freeze({
    version: VERSION,
    experimentSpec,
    templateSpecForType,
    multivariateHeaders,
    gallerySpecs: GALLERY_TEMPLATE_SPECS
  });

  if (typeof document === 'undefined') return;

  function makeWorkbookSheet(matrix, widths, merges = []) {
    const ws = XLSX.utils.aoa_to_sheet(matrix);
    ws['!cols'] = (widths || matrix[0].map(() => 16)).map(w => ({ wch: w }));
    if (merges.length) ws['!merges'] = merges;
    return ws;
  }

  function writeXlsxFromSpec(spec, filename) {
    if (!globalThis.XLSX) {
      if (typeof toast === 'function') toast('Excel 组件未加载，请刷新页面或下载 CSV');
      return false;
    }
    const wb = XLSX.utils.book_new();
    const rows = [spec.headers, ...Array.from({ length: 8 }, () => Array(spec.headers.length).fill(''))];
    const ws = makeWorkbookSheet(rows, spec.headers.map(h => Math.max(14, String(h).length + 4)));
    const guide = XLSX.utils.aoa_to_sheet(genericGuide(spec.type, spec));
    guide['!cols'] = [{ wch: 20 }, { wch: 105 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.utils.book_append_sheet(wb, guide, 'Instructions');
    XLSX.writeFile(wb, filename);
    return true;
  }

  function writeCsv(headers, filename) {
    const text = '\ufeff' + headers.map(csvEscape).join(',') + '\r\n';
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    if (typeof download === 'function') download(blob, filename);
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  }

  function downloadExperimentXlsx(type, designMode) {
    const spec = experimentSpec(type, designMode, preferredReplicates());
    if (!globalThis.XLSX) {
      downloadExperimentCsv(type, designMode);
      if (typeof toast === 'function') toast('Excel 组件未加载，已下载 CSV 模板');
      return;
    }
    const wb = XLSX.utils.book_new();
    const widths = Array.from({ length: spec.width }, (_, i) => i === 0 ? 18 : 13);
    const ws = makeWorkbookSheet(spec.matrix, widths, spec.merges);
    ws['!freeze'] = { xSplit: 1, ySplit: 2, topLeftCell: 'B3', activePane: 'bottomRight', state: 'frozen' };
    const guide = XLSX.utils.aoa_to_sheet(spec.guide);
    guide['!cols'] = [{ wch: 20 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.utils.book_append_sheet(wb, guide, 'Instructions');
    XLSX.writeFile(wb, `FoodLab_${spec.design}_${spec.type}_raw_replicates_template.xlsx`);
    if (typeof toast === 'function') toast(`${spec.designLabel}${spec.chartLabel}标准模板已生成`);
  }

  function downloadExperimentCsv(type, designMode) {
    const spec = experimentSpec(type, designMode, preferredReplicates());
    const rows = [spec.flatHeaders, ...spec.flatRows];
    const text = '\ufeff' + rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const filename = `FoodLab_${spec.design}_${spec.type}_raw_replicates_template.csv`;
    if (typeof download === 'function') download(blob, filename);
    else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    if (typeof toast === 'function') toast(`${spec.designLabel}${spec.chartLabel} CSV 模板已生成`);
  }

  function downloadGenericXlsx(type) {
    const spec = GALLERY_TEMPLATE_SPECS[type];
    if (!spec) return false;
    return writeXlsxFromSpec({ ...spec, type }, `FoodLab_${safeName(type)}_blank_template.xlsx`);
  }

  function downloadGenericCsv(type) {
    const spec = GALLERY_TEMPLATE_SPECS[type];
    if (!spec) return false;
    writeCsv(spec.headers, `FoodLab_${safeName(type)}_blank_template.csv`);
    if (typeof toast === 'function') toast('空白结构 CSV 模板已生成');
    return true;
  }

  let designMode = 'one';

  function setDesignMode(mode, render = true) {
    designMode = mode === 'two' ? 'two' : 'one';
    const st = appState();
    if (st?.design) st.design.designType = designMode;
    const select = document.querySelector('#designType');
    if (select) select.value = designMode;
    if (render) syncTemplateUi();
  }

  function templateDisplaySpec(type = currentType()) {
    type = cleanType(type);
    if (EXPERIMENT_TYPES.has(type)) return experimentSpec(type, designMode, preferredReplicates());
    if (MULTIVARIATE_TYPES.has(type)) return templateSpecForType(type);
    return GALLERY_TEMPLATE_SPECS[type] || null;
  }

  function ensureStyle() {
    if (document.querySelector('#foodlab-v0150-template-style')) return;
    const style = document.createElement('style');
    style.id = 'foodlab-v0150-template-style';
    style.textContent = `
      #foodlabTemplateDesignSwitch{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 4px;padding:9px 10px;border:1px solid #d7e3dd;border-radius:10px;background:#f8fbf9}
      #foodlabTemplateDesignSwitch>span{font-size:12px;font-weight:700;color:#50635b;margin-right:2px}
      #foodlabTemplateDesignSwitch button{border:1px solid #bfcfc7;background:#fff;color:#33483f;border-radius:8px;padding:6px 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
      #foodlabTemplateDesignSwitch button.active{background:#245f50;color:#fff;border-color:#245f50}
      #foodlabTemplateDesignSwitch small{flex-basis:100%;color:#6c7b74;line-height:1.45}
    `;
    document.head.appendChild(style);
  }

  function ensureDesignSwitch() {
    const card = document.querySelector('.current-template-card.large');
    if (!card) return null;
    let box = document.querySelector('#foodlabTemplateDesignSwitch');
    if (!box) {
      box = document.createElement('div');
      box.id = 'foodlabTemplateDesignSwitch';
      box.innerHTML = '<span>实验设计</span><button type="button" data-foodlab-template-design="one">单因素</button><button type="button" data-foodlab-template-design="two">双因素</button><small>柱状图、折线图和曲线图必须先明确实验因素数量。R 列始终表示独立重复。</small>';
      const actions = card.querySelector('.action-row');
      card.insertBefore(box, actions || null);
      box.querySelectorAll('[data-foodlab-template-design]').forEach(btn => btn.addEventListener('click', () => setDesignMode(btn.dataset.foodlabTemplateDesign)));
    }
    return box;
  }

  function updatePreviewTable(spec) {
    const table = document.querySelector('#designPreviewTable');
    if (!table || !spec) return;
    if (spec.kind === 'experiment') {
      const head1 = spec.matrix[0], head2 = spec.matrix[1];
      const groupSpans = [];
      let i = 1;
      while (i < head1.length) {
        const label = head1[i];
        let span = 1;
        while (i + span < head1.length && !head1[i + span]) span++;
        groupSpans.push({ label, span }); i += span;
      }
      let html = `<thead><tr><th rowspan="2">${head1[0]}</th>${groupSpans.map(g => `<th colspan="${g.span}">${g.label}</th>`).join('')}</tr><tr>${head2.slice(1).map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>`;
      for (let r = 0; r < 3; r++) html += `<tr>${Array.from({ length: spec.width }, () => '<td>&nbsp;</td>').join('')}</tr>`;
      table.innerHTML = html + '</tbody>';
      return;
    }
    const headers = spec.headers || [];
    let html = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
    for (let r = 0; r < 3; r++) html += `<tr>${headers.map(() => '<td>&nbsp;</td>').join('')}</tr>`;
    table.innerHTML = html + '</tbody>';
  }

  function syncTemplateUi() {
    const type = currentType();
    const exp = EXPERIMENT_TYPES.has(type);
    const spec = templateDisplaySpec(type);
    const box = ensureDesignSwitch();
    if (box) {
      box.hidden = !exp;
      box.querySelectorAll('[data-foodlab-template-design]').forEach(btn => btn.classList.toggle('active', btn.dataset.foodlabTemplateDesign === designMode));
    }

    const xlsx = document.querySelector('#downloadCurrentXlsx');
    const csv = document.querySelector('#downloadCurrentCsv');
    const advanced = document.querySelector('#downloadAdvancedXlsx');
    if (xlsx) xlsx.textContent = '下载标准 Excel 模板';
    if (csv) csv.textContent = '下载标准 CSV';
    if (advanced) {
      advanced.textContent = '技术重复 / 自定义设计模板';
      if (exp) advanced.classList.remove('hidden');
    }

    const n = document.querySelector('#currentTemplateName');
    const d = document.querySelector('#currentTemplateDescription');
    if (n && spec) n.textContent = spec.name;
    if (d && spec) d.textContent = spec.description;

    const schemaName = document.querySelector('#designSchemaName');
    const schemaDesc = document.querySelector('#designSchemaDescription');
    if (schemaName && spec) schemaName.textContent = spec.name;
    if (schemaDesc && spec) schemaDesc.textContent = spec.description;

    const summary = document.querySelector('#designSummaryText');
    const count = document.querySelector('#templateRowCount');
    if (summary && spec) summary.textContent = `${typeof workflowChartLabel === 'function' ? workflowChartLabel(type) : type} · ${spec.name}`;
    if (count && spec) count.textContent = '空白结构模板 · 不含示例数据';
    updatePreviewTable(spec);
  }

  function installDownloadOverrides() {
    const previousTemplateXlsx = typeof downloadTemplateXlsx === 'function' ? downloadTemplateXlsx : null;
    const previousTemplateCsv = typeof downloadTemplateCsv === 'function' ? downloadTemplateCsv : null;
    const previousGalleryXlsx = typeof downloadGalleryXlsx === 'function' ? downloadGalleryXlsx : null;
    const previousGalleryCsv = typeof downloadGalleryCsv === 'function' ? downloadGalleryCsv : null;

    if (previousTemplateXlsx) downloadTemplateXlsx = function foodlabTemplateXlsx0150() {
      const type = currentType();
      if (EXPERIMENT_TYPES.has(type)) return downloadExperimentXlsx(type, designMode);
      if (GALLERY_TEMPLATE_SPECS[type]) return downloadGenericXlsx(type);
      return previousTemplateXlsx.apply(this, arguments);
    };
    if (previousTemplateCsv) downloadTemplateCsv = function foodlabTemplateCsv0150() {
      const type = currentType();
      if (EXPERIMENT_TYPES.has(type)) return downloadExperimentCsv(type, designMode);
      if (GALLERY_TEMPLATE_SPECS[type]) return downloadGenericCsv(type);
      return previousTemplateCsv.apply(this, arguments);
    };
    if (previousGalleryXlsx) downloadGalleryXlsx = function foodlabGalleryXlsx0150() {
      const type = currentType();
      if (GALLERY_TEMPLATE_SPECS[type]) return downloadGenericXlsx(type);
      return previousGalleryXlsx.apply(this, arguments); // keep multivariate templates unchanged
    };
    if (previousGalleryCsv) downloadGalleryCsv = function foodlabGalleryCsv0150() {
      const type = currentType();
      if (GALLERY_TEMPLATE_SPECS[type]) return downloadGenericCsv(type);
      return previousGalleryCsv.apply(this, arguments);
    };

    // Legacy gallery buttons were bound directly to the old function during app init.
    // Capture-phase handlers guarantee the normalized template wins there too.
    const intercept = (id, format) => {
      const el = document.querySelector(id);
      if (!el || el.dataset.foodlabTemplate0150) return;
      el.dataset.foodlabTemplate0150 = '1';
      el.addEventListener('click', event => {
        const type = currentType();
        if (!GALLERY_TEMPLATE_SPECS[type]) return;
        event.preventDefault(); event.stopImmediatePropagation();
        format === 'xlsx' ? downloadGenericXlsx(type) : downloadGenericCsv(type);
      }, true);
    };
    intercept('#galleryDownloadXlsx', 'xlsx');
    intercept('#galleryDownloadCsv', 'csv');

    const interceptCurrent = (id, format) => {
      const el = document.querySelector(id);
      if (!el || el.dataset.foodlabCurrentTemplate0150) return;
      el.dataset.foodlabCurrentTemplate0150 = '1';
      el.addEventListener('click', event => {
        const type = currentType();
        if (!EXPERIMENT_TYPES.has(type) && !GALLERY_TEMPLATE_SPECS[type]) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (EXPERIMENT_TYPES.has(type)) {
          format === 'xlsx' ? downloadExperimentXlsx(type, designMode) : downloadExperimentCsv(type, designMode);
        } else {
          format === 'xlsx' ? downloadGenericXlsx(type) : downloadGenericCsv(type);
        }
      }, true);
    };
    interceptCurrent('#downloadCurrentXlsx', 'xlsx');
    interceptCurrent('#downloadCurrentCsv', 'csv');
  }

  function installSchemaOverrides() {
    try {
      if (typeof GALLERY_SCHEMAS !== 'undefined') {
        GALLERY_SCHEMAS.univariate = { name: '单变量原始观测长表', columns: ['SampleID', 'Group', 'Value'], description: GALLERY_TEMPLATE_SPECS.box.description };
        GALLERY_SCHEMAS.xy = { name: 'XY 样本长表', columns: ['SampleID', 'Group', 'X', 'Y', 'Size'], description: '每行一个观测；X/Y 为同一观测的两个连续变量，Size 仅气泡图使用。' };
        GALLERY_SCHEMAS.composition = { name: '组成数据长表', columns: ['Category', 'Component', 'Value'], description: GALLERY_TEMPLATE_SPECS.stacked.description };
        GALLERY_SCHEMAS.matrix = { name: '多指标样本矩阵', columns: GALLERY_TEMPLATE_SPECS.heatmap.headers, description: GALLERY_TEMPLATE_SPECS.heatmap.description };
        GALLERY_SCHEMAS.radar = { name: '雷达图多指标宽表', columns: GALLERY_TEMPLATE_SPECS.radar.headers, description: GALLERY_TEMPLATE_SPECS.radar.description };
      }
    } catch (error) {
      console.warn('[FoodLab v0.15.0] schema metadata update skipped', error);
    }

    if (typeof currentWorkflowSchema === 'function') {
      const previous = currentWorkflowSchema;
      currentWorkflowSchema = function foodlabCurrentWorkflowSchema0150() {
        const type = currentType();
        if (EXPERIMENT_TYPES.has(type)) {
          const spec = experimentSpec(type, designMode, preferredReplicates());
          return { name: spec.name, description: spec.description };
        }
        if (GALLERY_TEMPLATE_SPECS[type]) {
          const spec = GALLERY_TEMPLATE_SPECS[type];
          return { name: spec.name, description: spec.description, columns: spec.headers };
        }
        return previous.apply(this, arguments);
      };
    }
  }

  function installPreviewOverride() {
    if (typeof renderDesignPreview !== 'function') return;
    const previous = renderDesignPreview;
    renderDesignPreview = function foodlabRenderDesignPreview0150() {
      const type = currentType();
      if (!EXPERIMENT_TYPES.has(type) && !GALLERY_TEMPLATE_SPECS[type] && !MULTIVARIATE_TYPES.has(type)) return previous.apply(this, arguments);
      syncTemplateUi();
    };
  }

  function installImportGuard() {
    // Flat CSV headers generated by v0.15.0 encode independent repeats as
    // Group__R1, Group__R2... The existing simple-wide parser already handles
    // these correctly. This guard only synchronizes UI state before delegation.
    if (typeof processImported !== 'function') return;
    const previous = processImported;
    processImported = function foodlabProcessImported0150(rows, source) {
      const type = currentType();
      if (EXPERIMENT_TYPES.has(type) && Array.isArray(rows) && rows.length) {
        const keys = Object.keys(rows[0] || {}).filter(k => String(k).includes('__R'));
        if (keys.length) {
          const groups = new Set(keys.map(k => String(k).split('__')[0]).filter(Boolean));
          const st = appState();
          if (st?.design) st.design.designType = groups.size > 1 ? 'two' : 'one';
          designMode = groups.size > 1 ? 'two' : 'one';
        }
      }
      return previous.apply(this, arguments);
    };
  }

  function installUiSyncHooks() {
    if (typeof syncWorkflowControls === 'function') {
      const previous = syncWorkflowControls;
      syncWorkflowControls = function foodlabSyncWorkflowControls0150() {
        const out = previous.apply(this, arguments);
        syncTemplateUi();
        return out;
      };
    }
    if (typeof showView === 'function') {
      const previous = showView;
      showView = function foodlabShowView0150(view) {
        const out = previous.apply(this, arguments);
        if (view === 'data' || view === 'design' || view === 'plan') syncTemplateUi();
        return out;
      };
    }
  }

  function install() {
    if (globalThis.__FOODLAB_DATA_TEMPLATES_0150_INSTALLED__) return;
    globalThis.__FOODLAB_DATA_TEMPLATES_0150_INSTALLED__ = true;
    if (!appState()) {
      console.warn('[FoodLab Studio] v0.15.0 template patch: state not available');
      return;
    }

    ensureStyle();
    const st = appState();
    designMode = st?.rawData?.some?.(row => String(row?.b ?? '').trim()) || st?.design?.designType === 'two' ? 'two' : 'one';
    installSchemaOverrides();
    installDownloadOverrides();
    installPreviewOverride();
    installImportGuard();
    installUiSyncHooks();
    ensureDesignSwitch();
    syncTemplateUi();

    document.documentElement.dataset.foodlabTemplates = VERSION;
    const foot = document.querySelector('.sidebar-foot');
    if (foot) foot.textContent = 'v0.15.0 · 科研数据模板规范化版';
    console.info(`[FoodLab Studio] scientific data templates v${VERSION} active`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else setTimeout(install, 0);
})();
