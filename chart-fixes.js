'use strict';

/*
 * FoodLab Studio v0.9.9 — histogram data-role fix + draggable layout + grouped-scatter fix
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
    if (!['facet', 'overlay'].includes(s.histDisplayMode)) s.histDisplayMode = 'facet';
    if (!['auto', 'independent', 'shared'].includes(s.histAxisMode)) s.histAxisMode = 'auto';
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
        gSelect('histDisplayMode', '多列显示方式', [
          ['facet', '分面显示（推荐）'],
          ['overlay', '半透明叠加']
        ]),
        gSelect('histAxisMode', '分面坐标范围', [
          ['auto', '自动判断（推荐）'],
          ['independent', '各数据列独立 X 轴'],
          ['shared', '所有处理组共享 X 轴']
        ]),
        gSelect('histogramScale', '纵轴含义', [
          ['frequency', '频数 Frequency'],
          ['density', '概率密度 Density']
        ]),
        gRange('bins', '手动分箱数量（关闭自动后生效）', 2, 40, 1),
        gRange('opacity', '柱透明度', 0.15, 1, 0.05),
        gRange('lineWidth', '柱边框粗细', 0, 4, 0.1)
      ]) + `<div class="method-badge"><b>绘图规则：</b>直方图使用连续数值 X 轴。若导入的是 pH、剪切力、亮度、TBARS 等不同变量列，自动为每列使用独立 X 轴；若各列是 Control、Treatment 等同一指标处理组，则可共享 X 轴。图例、图题和坐标轴标题继续支持拖动。</div>`;
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

  const num = (v, fallback=0) => { const n=Number(v); return Number.isFinite(n)?n:fallback; };
  const clampLocal = (v,a,b) => Math.max(a,Math.min(b,v));
  const finiteValues = arr => arr.map(Number).filter(Number.isFinite);

  function niceStepLocal(raw){
    const value=Math.abs(Number(raw)||0); if(!(value>0))return 1;
    const power=Math.floor(Math.log10(value)),scale=Math.pow(10,power),unit=value/scale;
    const niceUnit=unit<=1?1:unit<=2?2:unit<=2.5?2.5:unit<=5?5:10;
    return niceUnit*scale;
  }
  function prettyNumber(v,step=null){
    const value=Number(v);if(!Number.isFinite(value))return'';
    const ref=Math.abs(Number(step)||0);let digits=0;
    if(ref>0&&ref<1)digits=clampLocal(Math.ceil(-Math.log10(ref))+1,0,6);
    const text=value.toFixed(digits).replace(/\.?0+$/,'');return text==='-0'?'0':text;
  }
  function makeNiceTicks(min,max,target=6){
    if(!(Number.isFinite(min)&&Number.isFinite(max)&&max>min))return[Number(min)||0];
    const step=niceStepLocal((max-min)/Math.max(2,target-1)),start=Math.floor(min/step)*step,end=Math.ceil(max/step)*step,ticks=[];
    for(let v=start;v<=end+step*.5;v+=step){ticks.push(Number(v.toFixed(10)));if(ticks.length>100)break}
    return[...new Set(ticks)];
  }
  function mapLinear(a,b,c,d){const den=b-a||1;return v=>c+(v-a)/den*(d-c)}
  function resolvedHistogramGeometry(values,requested,auto){
    const arr=finiteValues(values).sort((a,b)=>a-b);if(!arr.length)return{domainMin:0,domainMax:1,binWidth:1,bins:1};
    let min=arr[0],max=arr[arr.length-1];if(!(max>min)){const pad=Math.abs(min||1)*.05||.5;min-=pad;max+=pad}
    const target=auto?autoHistogramBinCount(arr):clampLocal(Math.round(Number(requested)||10),2,40);
    let width=niceStepLocal((max-min)/Math.max(1,target));
    let domainMin=Math.floor(min/width)*width,domainMax=Math.ceil(max/width)*width,bins=Math.max(2,Math.round((domainMax-domainMin)/width));
    let guard=0;while(bins>30&&guard++<8){width=niceStepLocal(width*1.6);domainMin=Math.floor(min/width)*width;domainMax=Math.ceil(max/width)*width;bins=Math.round((domainMax-domainMin)/width)}
    bins=clampLocal(bins,2,40);domainMax=domainMin+bins*width;
    return{domainMin:Number(domainMin.toFixed(10)),domainMax:Number(domainMax.toFixed(10)),binWidth:Number(width.toFixed(10)),bins};
  }
  function histogramCounts(rows,groups,geometry,density){
    const counts=groups.map(()=>Array(geometry.bins).fill(0)),sizes=groups.map(g=>rows.filter(r=>String(r.Group||'All')===g).length);
    rows.forEach(r=>{const g=String(r.Group||'All'),gi=groups.indexOf(g),v=Number(r.Value);if(gi<0||!Number.isFinite(v))return;let bi=Math.floor((v-geometry.domainMin)/geometry.binWidth);if(v===geometry.domainMax)bi=geometry.bins-1;bi=clampLocal(bi,0,geometry.bins-1);counts[gi][bi]++});
    return{heights:counts.map((a,gi)=>a.map(c=>density?c/(Math.max(1,sizes[gi])*geometry.binWidth):c))};
  }
  function drawNumericAxes(panel,{s,xMap,yMap,xTicks,yTicks,xStep,yStep,showXLabels=true,showYLabels=true,boxMode=true}){
    const axis=s.axisColor||'#20262b',sw=num(s.axisWidth,1.35),tick=num(s.tickLength,6);let out='';
    if(boxMode)out+=`<rect x="${panel.l}" y="${panel.t}" width="${panel.w}" height="${panel.h}" fill="none" stroke="${axis}" stroke-width="${num(s.frameWidth,1.15)}"/>`;
    else out+=`<line x1="${panel.l}" y1="${panel.t+panel.h}" x2="${panel.l+panel.w}" y2="${panel.t+panel.h}" stroke="${axis}" stroke-width="${sw}"/><line x1="${panel.l}" y1="${panel.t}" x2="${panel.l}" y2="${panel.t+panel.h}" stroke="${axis}" stroke-width="${sw}"/>`;
    if(showYLabels)yTicks.forEach(v=>{const y=yMap(v);out+=`<line x1="${panel.l}" x2="${panel.l-tick}" y1="${y}" y2="${y}" stroke="${axis}" stroke-width="${sw}"/><text x="${panel.l-tick-5}" y="${y+4}" text-anchor="end" font-size="${num(s.yTickSize,12)}" fill="${s.yTickColor||axis}">${esc(prettyNumber(v,yStep))}</text>`});
    if(showXLabels)xTicks.forEach(v=>{const x=xMap(v);out+=`<line x1="${x}" x2="${x}" y1="${panel.t+panel.h}" y2="${panel.t+panel.h+tick}" stroke="${axis}" stroke-width="${sw}"/><text x="${x}" y="${panel.t+panel.h+tick+16}" text-anchor="middle" font-size="${num(s.xTickSize,12)}" fill="${s.xTickColor||axis}">${esc(prettyNumber(v,xStep))}</text>`});
    return out;
  }
  function drawHistogramBars(panel,heights,gi,xMap,yMap,geometry,s,overlay=false){
    const st=getGallerySeriesStyle(gi),opacity=overlay?Math.min(.32,num(s.opacity,.72)):Math.min(.88,Math.max(.45,num(s.opacity,.72))),lw=Math.max(.5,num(st.lineWidth,s.lineWidth));let body='';
    heights.forEach((h,i)=>{const l=geometry.domainMin+i*geometry.binWidth,r=l+geometry.binWidth,x1=xMap(l),x2=xMap(r),y=yMap(h);body+=`<rect x="${x1}" y="${y}" width="${Math.max(0,x2-x1)}" height="${Math.max(0,panel.t+panel.h-y)}" fill="${st.color}" fill-opacity="${opacity}" stroke="${st.color}" stroke-width="${lw}"/>`});
    return`<g data-gobject="series" data-gseries="${gi}" class="chart-object">${body}</g>`;
  }

  function histogramSeriesValues(rows, group) {
    return rows.filter(r => String(r.Group || 'All') === group).map(r => Number(r.Value)).filter(Number.isFinite);
  }

  function histogramNeedsIndependentAxes(groups, rows) {
    if (groups.length <= 1) return false;
    const stats = groups.map(g => {
      const v = histogramSeriesValues(rows, g).sort((a,b)=>a-b);
      if (!v.length) return null;
      const min=v[0],max=v[v.length-1],median=v[Math.floor((v.length-1)/2)],range=Math.max(max-min, Math.abs(median)*0.02, 1e-9);
      return {min,max,median,range};
    }).filter(Boolean);
    if (stats.length <= 1) return false;
    const medAbs=stats.map(x=>Math.abs(x.median)).filter(x=>x>1e-12);
    if (medAbs.length >= 2 && Math.max(...medAbs)/Math.min(...medAbs) > 4) return true;
    const globalMin=Math.min(...stats.map(x=>x.min)),globalMax=Math.max(...stats.map(x=>x.max)),globalRange=globalMax-globalMin;
    const meanLocal=stats.reduce((a,x)=>a+x.range,0)/stats.length;
    if (globalRange > meanLocal*4.5) return true;
    for(let i=0;i<stats.length;i++) for(let j=i+1;j<stats.length;j++) {
      const a=stats[i],b=stats[j], overlap=Math.max(0,Math.min(a.max,b.max)-Math.max(a.min,b.min));
      const denom=Math.min(a.range,b.range);
      if (denom>0 && overlap/denom < 0.08 && Math.abs(a.median-b.median) > 2.5*Math.max(a.range,b.range)) return true;
    }
    return false;
  }

  function histogramDraggableAxisTitles(W,H,p,s) {
    let out='';
    const xTitle=String(s.xTitle||'').trim(),yTitle=String(s.yTitle||'').trim();
    const x=s.xTitleX??(p.l+p.w/2),y=s.xTitleY??(H-24),yx=s.yTitleX??28,yy=s.yTitleY??(p.t+p.h/2);
    if(s.xTitleVisible!==false&&xTitle) out+=`<text data-gobject="axis-x" data-gdrag="xTitle" class="chart-object draggable" x="${x}" y="${y}" text-anchor="middle" font-size="${num(s.xTitleSize,15)}" font-weight="${num(s.xTitleWeight,400)}" fill="${s.xTitleColor||'#20262b'}">${esc(xTitle)}</text>`;
    if(s.yTitleVisible!==false&&yTitle) out+=`<text data-gobject="axis-y" data-gdrag="yTitle" class="chart-object draggable" transform="translate(${yx} ${yy}) rotate(-90)" text-anchor="middle" font-size="${num(s.yTitleSize,15)}" font-weight="${num(s.yTitleWeight,400)}" fill="${s.yTitleColor||'#20262b'}">${esc(yTitle)}</text>`;
    return out;
  }

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

    // Different physical variables (e.g. pH, shear force, L*, TBARS) must not be
    // forced onto one numerical X domain. In that case each facet gets its own
    // bin geometry and tick scale. Treatment groups of the same metric can share.
    if (useFacet && independent) {
      const legendSpace = s.legend ? 50 : 8;
      const top = Math.max(base.t + legendSpace, 106);
      const available = Math.max(160, H - top - base.b);
      const gap = 18;
      const panelHeight = Math.max(72, (available - gap*(groups.length-1))/groups.length);
      let out = s.legend ? galleryLegend(groups) : '';

      groups.forEach((group, gi) => {
        const vals = histogramSeriesValues(rows, group);
        const geometry = resolvedHistogramGeometry(vals, s.bins, s.histAutoBins);
        const groupRows = rows.filter(r => String(r.Group || 'All') === group);
        const one = histogramCounts(groupRows, [group], geometry, densityMode).heights[0];
        const rawMax = Math.max(0, ...one);
        const yTicks = densityMode ? makeNiceTicks(0, (rawMax||1)*1.15, 4) : histogramFrequencyTicks((rawMax||1)*1.12);
        const yMax = yTicks[yTicks.length-1] || 1;
        const xTicks = makeNiceTicks(geometry.domainMin, geometry.domainMax, 5);
        const xStep = xTicks.length>1 ? xTicks[1]-xTicks[0] : geometry.binWidth;
        const yStep = yTicks.length>1 ? yTicks[1]-yTicks[0] : 1;
        const panel={l:base.l,t:top+gi*(panelHeight+gap),w:base.w,h:panelHeight};
        const xMap=mapLinear(geometry.domainMin,geometry.domainMax,panel.l,panel.l+panel.w);
        const yMap=mapLinear(0,yMax,panel.t+panel.h,panel.t+8);
        out += drawHistogramBars(panel, one, gi, xMap, yMap, geometry, s, false);
        out += drawNumericAxes(panel,{s,xMap,yMap,xTicks,yTicks,xStep,yStep,showXLabels:true,showYLabels:true,boxMode:String(s.frameMode||'box')==='box'});
        // Facet name is a panel identifier; the actual legend above remains draggable.
        out += `<text x="${panel.l+8}" y="${panel.t+18}" font-size="${Math.max(11,num(s.legendFontSize,12))}" font-weight="600" fill="${getGallerySeriesStyle(gi).color}">${esc(group)}</text>`;
      });
      out += histogramDraggableAxisTitles(W,H,{...base,t:top,h:available},s);
      return out;
    }

    // Shared-axis histogram for one variable or comparable treatment groups.
    const values = rows.map(r => Number(r.Value));
    const geometry = resolvedHistogramGeometry(values, s.bins, s.histAutoBins);
    const stats = histogramCounts(rows, groups, geometry, densityMode);
    const rawMax=Math.max(0,...stats.heights.flat());
    const yTicks=densityMode?makeNiceTicks(0,(rawMax||1)*1.15,5):histogramFrequencyTicks((rawMax||1)*1.12);
    const yMax=yTicks[yTicks.length-1]||1;
    const xTicks=makeNiceTicks(geometry.domainMin,geometry.domainMax,6);
    const xStep=xTicks.length>1?xTicks[1]-xTicks[0]:geometry.binWidth;
    const yStep=yTicks.length>1?yTicks[1]-yTicks[0]:1;
    const xMap=mapLinear(geometry.domainMin,geometry.domainMax,base.l,base.l+base.w);
    const yMap=mapLinear(0,yMax,base.t+base.h,base.t+8);
    let out='';
    groups.forEach((g,gi)=>{out+=drawHistogramBars(base,stats.heights[gi],gi,xMap,yMap,geometry,s,groups.length>1)});
    out+=drawNumericAxes(base,{s,xMap,yMap,xTicks,yTicks,xStep,yStep,showXLabels:true,showYLabels:true,boxMode:String(s.frameMode||'box')==='box'});
    if(groups.length>1) out+=galleryLegend(groups);
    out+=histogramDraggableAxisTitles(W,H,base,s);
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
