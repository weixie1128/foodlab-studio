'use strict';
/*
 * FoodLab Studio v0.15.1 — univariate distribution template correction
 *
 * Scope: Histogram / KDE / Boxplot / Violin only.
 *
 * Scientific layout used by the new blank templates:
 *   Group_1 | Group_2 | Group_3 | ...
 *   raw      | raw     | raw
 *   raw      | raw     | raw
 *
 * Every column is one distribution/group and every numeric cell is one raw
 * independent observation.  This avoids asking users to enter pre-binned
 * frequencies, KDE coordinates, five-number summaries, or mean ± SD.
 *
 * Import compatibility is intentionally broader than the download template:
 * 1) New column-wise grouped raw-value tables (recommended)
 * 2) Legacy tidy long tables: SampleID | Group | Value
 * 3) Row-wise replicate tables: Group | R1 | R2 | R3 | ...
 */
(() => {
  if (globalThis.__FOODLAB_UNIVARIATE_TEMPLATES_0151__) return;
  globalThis.__FOODLAB_UNIVARIATE_TEMPLATES_0151__ = true;

  const VERSION = '0.15.1';
  const TYPES = new Set(['hist', 'kde', 'box', 'violin']);
  const DEFAULT_HEADERS = Object.freeze(['Group_1', 'Group_2', 'Group_3']);
  const LONG_VALUE_ALIASES = ['value', 'measurement', 'result', 'score', '数值', '测定值', '结果', '值'];
  const GROUP_ALIASES = ['group', 'treatment', 'condition', 'category', '组别', '分组', '处理', '条件', '类别'];
  const SAMPLE_ALIASES = ['sampleid', 'sample id', 'sample', 'id', '样品编号', '样本编号', '样品', '样本'];
  const META_ALIASES = new Set([
    ...SAMPLE_ALIASES,
    'observation', 'observationid', 'observation id', 'replicate', 'replicateid', 'replicate id',
    'row', 'index', '序号', '观测编号', '重复编号'
  ]);

  const clean = value => String(value ?? '').trim();
  const keyNorm = value => clean(value).toLowerCase().replace(/[\s_\-]+/g, ' ').trim();
  const aliasNorm = value => keyNorm(value).replace(/ /g, '');
  const numOrNull0151 = value => {
    if (value == null || clean(value) === '') return null;
    const n = Number(clean(value));
    return Number.isFinite(n) ? n : null;
  };
  const safeName0151 = value => clean(value || 'FoodLab').replace(/[\\/:*?"<>|]/g, '_') || 'FoodLab';
  const csvCell0151 = value => {
    const s = String(value ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  function appState0151() {
    try {
      return typeof state !== 'undefined' ? state : globalThis.state;
    } catch (_err) {
      return globalThis.state;
    }
  }

  function currentType0151() {
    const st = appState0151();
    return clean(st?.workflow?.chartType || st?.gallery?.type || '').toLowerCase();
  }

  function allKeys(rows) {
    const out = [];
    const seen = new Set();
    (rows || []).forEach(row => Object.keys(row || {}).forEach(key => {
      if (!seen.has(key)) { seen.add(key); out.push(key); }
    }));
    return out;
  }

  function findAliasKey(keys, aliases) {
    const wanted = new Set(aliases.map(aliasNorm));
    return keys.find(key => wanted.has(aliasNorm(key))) || null;
  }

  function sampleIdFor(row, sampleKey, rowIndex, groupName) {
    const explicit = sampleKey ? clean(row?.[sampleKey]) : '';
    return explicit || `${groupName || 'Observation'}_R${rowIndex + 1}`;
  }

  function parseLongUnivariate(rows, keys) {
    const valueKey = findAliasKey(keys, LONG_VALUE_ALIASES);
    const groupKey = findAliasKey(keys, GROUP_ALIASES);
    const sampleKey = findAliasKey(keys, SAMPLE_ALIASES);
    if (!valueKey) return null;

    // A lone column called Value is a valid one-distribution long table.
    // When there are many other numeric columns and no Group/Sample metadata,
    // prefer the column-wise grouped parser instead of guessing that Value is
    // special and silently discarding the remaining columns.
    if (!groupKey && !sampleKey && keys.length > 1) {
      const otherNumeric = keys.filter(k => k !== valueKey).some(k => rows.some(r => numOrNull0151(r?.[k]) != null));
      if (otherNumeric) return null;
    }

    const out = [];
    rows.forEach((row, i) => {
      const value = numOrNull0151(row?.[valueKey]);
      if (value == null) return;
      const group = groupKey ? (clean(row?.[groupKey]) || 'All') : 'All';
      out.push({ SampleID: sampleIdFor(row, sampleKey, i, group), Group: group, Value: value });
    });
    return out.length ? out : null;
  }

  function parseRowGroupedUnivariate(rows, keys) {
    const groupKey = findAliasKey(keys, GROUP_ALIASES);
    if (!groupKey) return null;
    const sampleKey = findAliasKey(keys, SAMPLE_ALIASES);
    const candidateKeys = keys.filter(key => key !== groupKey && key !== sampleKey && !META_ALIASES.has(aliasNorm(key)));
    const numericKeys = candidateKeys.filter(key => rows.some(row => numOrNull0151(row?.[key]) != null));
    if (!numericKeys.length) return null;

    const out = [];
    rows.forEach((row, i) => {
      const group = clean(row?.[groupKey]) || `Group_${i + 1}`;
      numericKeys.forEach(key => {
        const value = numOrNull0151(row?.[key]);
        if (value == null) return;
        const explicitSample = sampleKey ? clean(row?.[sampleKey]) : '';
        out.push({
          SampleID: explicitSample || `${group}_${clean(key) || `R${i + 1}`}`,
          Group: group,
          Value: value
        });
      });
    });
    return out.length ? out : null;
  }

  function parseColumnGroupedUnivariate(rows, keys) {
    const sampleKey = findAliasKey(keys, SAMPLE_ALIASES);
    const candidateKeys = keys.filter(key => {
      if (key === sampleKey) return false;
      return !META_ALIASES.has(aliasNorm(key));
    });
    const groupKeys = candidateKeys.filter(key => rows.some(row => numOrNull0151(row?.[key]) != null));
    if (!groupKeys.length) return [];

    const out = [];
    rows.forEach((row, i) => {
      groupKeys.forEach(key => {
        const value = numOrNull0151(row?.[key]);
        if (value == null) return;
        const group = clean(key) || 'All';
        out.push({
          SampleID: sampleIdFor(row, sampleKey, i, group),
          Group: group,
          Value: value
        });
      });
    });
    return out;
  }

  function normalizeUnivariateRows0151(rows) {
    if (!Array.isArray(rows) || !rows.length) return [];
    const keys = allKeys(rows);
    if (!keys.length) return [];
    return parseLongUnivariate(rows, keys)
      || parseRowGroupedUnivariate(rows, keys)
      || parseColumnGroupedUnivariate(rows, keys)
      || [];
  }

  const SPECS = Object.freeze({
    hist: Object.freeze({
      name: '直方图 · 分组原始值宽表',
      headers: DEFAULT_HEADERS,
      description: '每列代表一个组/一个分布，每个单元格填写一个原始连续观测值。FoodLab 自动分箱；不要输入频数表、区间中点或均值。',
      special: '直方图必须从原始连续观测生成。请不要事先计算“区间—频数”后再导入，否则会丢失原始分布信息。'
    }),
    kde: Object.freeze({
      name: 'KDE · 分组原始值宽表',
      headers: DEFAULT_HEADERS,
      description: '每列代表一个组/一个分布，每个单元格填写一个原始连续观测值。FoodLab 根据原始值估计核密度；不要输入 X–Density 坐标。',
      special: 'KDE 的曲线和带宽应由原始观测估计。样本量很小时密度形状不稳定，应谨慎解释峰形和多峰。'
    }),
    box: Object.freeze({
      name: '箱线图 · 分组原始值宽表',
      headers: DEFAULT_HEADERS,
      description: '每列代表一个组，每个单元格填写一个独立原始观测值。FoodLab 自动计算中位数、Q1、Q3、须线和异常值。',
      special: '不要填写 Min / Q1 / Median / Q3 / Max 五数概括，也不要填写 Mean ± SD；箱线统计必须由原始观测计算。'
    }),
    violin: Object.freeze({
      name: '小提琴图 · 分组原始值宽表',
      headers: DEFAULT_HEADERS,
      description: '每列代表一个组，每个单元格填写一个独立原始观测值。FoodLab 同时从原始值计算密度和分位数。',
      special: '不要输入已经计算好的密度坐标。样本量较少时小提琴形状容易产生过度解读，建议同时显示原始点或改用箱线图。'
    })
  });

  globalThis.FoodLabUnivariateTemplates0151 = Object.freeze({
    version: VERSION,
    specs: SPECS,
    normalizeRows: normalizeUnivariateRows0151
  });

  if (typeof document === 'undefined') return;

  function currentSpec0151(type = currentType0151()) {
    return SPECS[type] || null;
  }

  function templateGuide0151(type, spec) {
    return [
      [`FoodLab Studio v${VERSION} · ${spec.name}`],
      ['模板定位', '这是空白结构模板，不含任何具体实验名称、处理组名称或虚构测量值。'],
      ['推荐结构', '每一列是一组数据 / 一个分布；列名改成你的真实组名。每个数字单元格是一条独立原始观测。'],
      ['单组数据', '只有一个组时只使用第一列即可，可删除其余空列。'],
      ['多组数据', '需要更多组时直接向右新增列；不同组样本量可以不相等，较短的列尾部保持空白。'],
      ['原始观测', '不要输入均值、标准差、标准误、置信区间或 Mean ± SD。'],
      ['图形专属规则', spec.special],
      ['独立性', '当前单变量分布模块的组间推断按独立组处理。若数据属于配对、重复测量或同一样本多次测量，请不要把这些重复当作独立样本增加 n。'],
      ['技术重复', '同一独立样本的技术重复不应直接当作多个独立观测。应先按预先确定的方法汇总到独立样本层级，或使用 FoodLab 的实验重复设计模块。'],
      ['缺失值', '缺失或尚未测量的数据留空；不要填写 0、横杠、ND、NA 等文字代替缺失。'],
      ['兼容格式', 'FoodLab 仍兼容旧的 SampleID | Group | Value 长表，以及 Group | R1 | R2 | R3... 行式宽表。推荐新模板仅用于让数据录入更直观。'],
      ['CSV / Excel', 'CSV 和 Excel 使用相同数据逻辑；模板中的 Group_1、Group_2、Group_3 都是结构占位符，应改成真实组名。']
    ];
  }

  function downloadBlob0151(blob, filename) {
    if (typeof download === 'function') {
      download(blob, filename);
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1200);
  }

  function downloadUnivariateCsv0151(type) {
    const spec = currentSpec0151(type);
    if (!spec) return false;
    const text = '\ufeff' + spec.headers.map(csvCell0151).join(',') + '\r\n';
    downloadBlob0151(new Blob([text], { type: 'text/csv;charset=utf-8' }), `FoodLab_${safeName0151(type)}_grouped_raw_values_template.csv`);
    if (typeof toast === 'function') toast('单变量分组原始值 CSV 模板已生成');
    return true;
  }

  function downloadUnivariateXlsx0151(type) {
    const spec = currentSpec0151(type);
    if (!spec) return false;
    if (!globalThis.XLSX) {
      downloadUnivariateCsv0151(type);
      if (typeof toast === 'function') toast('Excel 组件未加载，已下载 CSV 模板');
      return true;
    }
    const wb = XLSX.utils.book_new();
    const blankRows = Array.from({ length: 30 }, () => spec.headers.map(() => ''));
    const ws = XLSX.utils.aoa_to_sheet([spec.headers, ...blankRows]);
    ws['!cols'] = spec.headers.map(() => ({ wch: 18 }));
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
    const guide = XLSX.utils.aoa_to_sheet(templateGuide0151(type, spec));
    guide['!cols'] = [{ wch: 20 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.utils.book_append_sheet(wb, guide, 'Instructions');
    XLSX.writeFile(wb, `FoodLab_${safeName0151(type)}_grouped_raw_values_template.xlsx`);
    if (typeof toast === 'function') toast(`${spec.name}已生成`);
    return true;
  }

  function updateSchemaMetadata0151() {
    try {
      if (typeof GALLERY_SCHEMAS !== 'undefined') {
        GALLERY_SCHEMAS.univariate = {
          name: '单变量分组原始值宽表',
          columns: [...DEFAULT_HEADERS],
          description: '每列一个组/分布，每个单元格一个独立原始观测。单组只用一列；多组向右增加列；不同组允许不同样本量。'
        };
      }
      if (typeof PLAN_CHART_META !== 'undefined') {
        TYPES.forEach(type => {
          if (PLAN_CHART_META[type]) PLAN_CHART_META[type].schema = '单变量分组原始值宽表';
        });
      }
    } catch (error) {
      console.warn('[FoodLab v0.15.1] schema metadata update skipped', error);
    }
  }

  function installParser0151() {
    if (typeof normalizeGalleryRows !== 'function') return;
    const previous = normalizeGalleryRows;
    normalizeGalleryRows = function foodlabNormalizeGalleryRows0151(rows, schema) {
      if (schema === 'univariate') {
        const parsed = normalizeUnivariateRows0151(rows);
        if (parsed.length) return parsed;
      }
      return previous.apply(this, arguments);
    };
  }

  function installDownloadFunctions0151() {
    if (typeof downloadGalleryXlsx === 'function') {
      const previous = downloadGalleryXlsx;
      downloadGalleryXlsx = function foodlabDownloadGalleryXlsx0151() {
        const type = currentType0151();
        if (TYPES.has(type)) return downloadUnivariateXlsx0151(type);
        return previous.apply(this, arguments);
      };
    }
    if (typeof downloadGalleryCsv === 'function') {
      const previous = downloadGalleryCsv;
      downloadGalleryCsv = function foodlabDownloadGalleryCsv0151() {
        const type = currentType0151();
        if (TYPES.has(type)) return downloadUnivariateCsv0151(type);
        return previous.apply(this, arguments);
      };
    }
  }

  function replaceDownloadButton0151(selector, format, scope) {
    const oldButton = document.querySelector(selector);
    if (!oldButton || oldButton.dataset.foodlabUnivariate0151 === '1') return;
    const button = oldButton.cloneNode(true);
    button.dataset.foodlabUnivariate0151 = '1';
    button.removeAttribute('data-foodlab-template0150');
    button.removeAttribute('data-foodlab-current-template0150');
    oldButton.replaceWith(button);

    button.addEventListener('click', event => {
      event.preventDefault();
      const type = currentType0151();
      if (TYPES.has(type)) {
        format === 'xlsx' ? downloadUnivariateXlsx0151(type) : downloadUnivariateCsv0151(type);
        return;
      }

      // Recreate the original dispatch after cloning removed legacy listeners.
      const st = appState0151();
      if (scope === 'current' && st?.workflow?.mode === 'experiment') {
        if (format === 'xlsx' && typeof downloadTemplateXlsx === 'function') downloadTemplateXlsx();
        else if (format === 'csv' && typeof downloadTemplateCsv === 'function') downloadTemplateCsv();
        return;
      }
      if (format === 'xlsx' && typeof downloadGalleryXlsx === 'function') downloadGalleryXlsx();
      else if (format === 'csv' && typeof downloadGalleryCsv === 'function') downloadGalleryCsv();
    });
  }

  function installButtonOverrides0151() {
    // v0.15.0 installed capture-phase template handlers. Cloning removes those
    // old handlers so v0.15.1 is guaranteed to win for the four distribution
    // charts, while non-univariate charts are delegated to the current global
    // download functions.
    replaceDownloadButton0151('#downloadCurrentXlsx', 'xlsx', 'current');
    replaceDownloadButton0151('#downloadCurrentCsv', 'csv', 'current');
    replaceDownloadButton0151('#galleryDownloadXlsx', 'xlsx', 'gallery');
    replaceDownloadButton0151('#galleryDownloadCsv', 'csv', 'gallery');
  }

  function updatePreview0151(spec) {
    const table = document.querySelector('#designPreviewTable');
    if (!table || !spec) return;
    let html = `<thead><tr>${spec.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
    for (let r = 0; r < 5; r++) html += `<tr>${spec.headers.map(() => '<td>&nbsp;</td>').join('')}</tr>`;
    table.innerHTML = html + '</tbody>';
  }

  function syncUnivariateUi0151() {
    const type = currentType0151();
    if (!TYPES.has(type)) return;
    const spec = currentSpec0151(type);

    const templateName = document.querySelector('#currentTemplateName');
    const templateDesc = document.querySelector('#currentTemplateDescription');
    if (templateName) templateName.textContent = spec.name;
    if (templateDesc) templateDesc.textContent = spec.description;

    const schemaName = document.querySelector('#designSchemaName');
    const schemaDesc = document.querySelector('#designSchemaDescription');
    if (schemaName) schemaName.textContent = spec.name;
    if (schemaDesc) schemaDesc.textContent = spec.description;

    const summary = document.querySelector('#designSummaryText');
    const count = document.querySelector('#templateRowCount');
    if (summary) summary.textContent = `${typeof workflowChartLabel === 'function' ? workflowChartLabel(type) : type} · ${spec.name}`;
    if (count) count.textContent = '空白原始值模板 · 每列一个组';

    const galleryName = document.querySelector('#gallerySchemaBadge');
    const galleryDesc = document.querySelector('#galleryTemplateDescription');
    const galleryChips = document.querySelector('#galleryColumnChips');
    if (galleryName) galleryName.textContent = '单变量分组原始值宽表';
    if (galleryDesc) galleryDesc.textContent = spec.description;
    if (galleryChips) galleryChips.innerHTML = spec.headers.map(h => `<span>${h}</span>`).join('');

    updatePreview0151(spec);
  }

  function installWorkflowSchema0151() {
    if (typeof currentWorkflowSchema !== 'function') return;
    const previous = currentWorkflowSchema;
    currentWorkflowSchema = function foodlabCurrentWorkflowSchema0151() {
      const type = currentType0151();
      if (TYPES.has(type)) {
        const spec = currentSpec0151(type);
        return { name: spec.name, description: spec.description, columns: [...spec.headers] };
      }
      return previous.apply(this, arguments);
    };
  }

  function wrapUiFunction0151(name) {
    try {
      if (name === 'renderDesignPreview' && typeof renderDesignPreview === 'function') {
        const previous = renderDesignPreview;
        renderDesignPreview = function foodlabRenderDesignPreview0151() {
          const out = previous.apply(this, arguments); syncUnivariateUi0151(); return out;
        };
      } else if (name === 'syncWorkflowControls' && typeof syncWorkflowControls === 'function') {
        const previous = syncWorkflowControls;
        syncWorkflowControls = function foodlabSyncWorkflowControls0151() {
          const out = previous.apply(this, arguments); syncUnivariateUi0151(); return out;
        };
      } else if (name === 'showView' && typeof showView === 'function') {
        const previous = showView;
        showView = function foodlabShowView0151() {
          const out = previous.apply(this, arguments); syncUnivariateUi0151(); return out;
        };
      } else if (name === 'renderGallery' && typeof renderGallery === 'function') {
        const previous = renderGallery;
        renderGallery = function foodlabRenderGallery0151() {
          const out = previous.apply(this, arguments); syncUnivariateUi0151(); return out;
        };
      }
    } catch (error) {
      console.warn(`[FoodLab v0.15.1] ${name} UI hook skipped`, error);
    }
  }

  function install0151() {
    if (globalThis.__FOODLAB_UNIVARIATE_TEMPLATES_0151_INSTALLED__) return;
    globalThis.__FOODLAB_UNIVARIATE_TEMPLATES_0151_INSTALLED__ = true;
    if (!appState0151()) {
      console.warn('[FoodLab Studio] v0.15.1 univariate patch: state not available');
      return;
    }

    updateSchemaMetadata0151();
    installParser0151();
    installDownloadFunctions0151();
    installWorkflowSchema0151();
    wrapUiFunction0151('renderDesignPreview');
    wrapUiFunction0151('syncWorkflowControls');
    wrapUiFunction0151('showView');
    wrapUiFunction0151('renderGallery');
    installButtonOverrides0151();
    syncUnivariateUi0151();

    document.documentElement.dataset.foodlabUnivariateTemplates = VERSION;
    const foot = document.querySelector('.sidebar-foot');
    if (foot) foot.textContent = 'v0.15.1 · 单变量分布模板修正版';
    console.info(`[FoodLab Studio] univariate scientific templates v${VERSION} active`);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install0151, { once: true });
  else setTimeout(install0151, 0);
})();
