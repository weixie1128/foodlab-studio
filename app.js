'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));


// v0.8.1 性能层：大数据图表只建立一次索引，避免每次绘图重复进行 O(n²) 查找。
let chartDataVersion=0;
let chartModelCache=null;
let xAxisConfigMemo={key:'',value:null};
let chartEntryJob=0;
function invalidateChartModel(){chartDataVersion++;chartModelCache=null;xAxisConfigMemo={key:'',value:null}}
function getChartModel(){
  if(chartModelCache&&chartModelCache.version===chartDataVersion)return chartModelCache;
  const xvals=[],groups=[],xSeen=new Set(),gSeen=new Set(),byKey=new Map(),byGroup=new Map();
  state.chartData.forEach(row=>{
    const xKey=String(row.x),gKey=String(row.group);
    if(!xSeen.has(xKey)){xSeen.add(xKey);xvals.push(row.x)}
    if(!gSeen.has(gKey)){gSeen.add(gKey);groups.push(row.group);byGroup.set(gKey,[])}
    byKey.set(`${xKey}${gKey}`,row);byGroup.get(gKey).push(row);
  });
  const xIndex=new Map(xvals.map((x,i)=>[String(x),i]));
  chartModelCache={version:chartDataVersion,xvals,groups,xIndex,byKey,byGroup};
  return chartModelCache;
}
function clearHeavyStatisticsDom(){
  const table=$('#descriptiveTable');
  if(table&&table.querySelectorAll('tr').length>350)table.innerHTML='<tbody><tr><td class="empty-row">大数据统计表已从页面内存释放；返回“初步分析”时会重新生成。</td></tr></tbody>';
}
function setChartBusy(active,text='正在建立绘图索引并生成图形…'){
  const stage=$('#chartStage');if(!stage)return;
  stage.classList.toggle('is-rendering',active);
  if(active)stage.innerHTML=`<div class="chart-render-loading"><span class="loading-spinner"></span><b>${esc(text)}</b><small>大数据只在首次进入时建立索引，之后编辑会明显更快。</small></div>`;
}
function scheduleChartEntryRender(){
  const job=++chartEntryJob;clearHeavyStatisticsDom();setChartBusy(true);
  requestAnimationFrame(()=>setTimeout(()=>{
    if(job!==chartEntryJob||state.view!=='chart')return;
    try{
      state.chart.mode=state.workflow.mode;
      if(state.workflow.mode==='experiment')prepareChartData();else{state.gallery.type=state.workflow.chartType;analyzeGalleryData()}
      renderChartStudio();
    }catch(err){console.error(err);const stage=$('#chartStage');if(stage)stage.innerHTML=`<div class="gallery-empty"><b>图形生成失败</b><span>${esc(err?.message||'未知错误')}</span></div>`;toast('图形生成失败，请检查数据或刷新页面')}
    finally{setChartBusy(false)}
  },0));
}

const templates = {
  foodchem: {fontEnglish:'Arial',fontChinese:'Microsoft YaHei',axis:1.35,colors:['#2f6b2f','#d98222','#526d70','#4c78a8','#a65d4e','#7b6aa8','#4f8f8b','#b07aa1','#d3a03b','#6d904f','#8c6d5a','#5f7f9e']},
  meatsci:  {fontEnglish:'Arial',fontChinese:'Microsoft YaHei',axis:1.25,colors:['#9fcd84','#70b865','#3e8c54','#83b9db','#1986bd','#546e7a','#c8b07a','#c9826b','#8f74a8','#6aa6a6','#b5a4d6','#8f8f8f']},
  nature:   {fontEnglish:'Arial',fontChinese:'Microsoft YaHei',axis:1.25,colors:['#3C5488','#E64B35','#00A087','#4DBBD5','#F39B7F','#8491B4','#91D1C2','#DC0000','#7E6148','#B09C85','#00A1D5','#6A3D9A']},
  mono:     {fontEnglish:'Times New Roman',fontChinese:'SimSun',axis:1.40,colors:['#111111','#333333','#555555','#777777','#999999','#bbbbbb','#222222','#444444','#666666','#888888','#aaaaaa','#cccccc']}
};

const defaultDesign = {
  experimentName:'肉品储藏品质研究', metricName:'Moisture content', metricUnit:'%', designType:'two',
  factorAName:'Storage time (d)', factorALevels:['0','2','4','6','8','10'], factorALevelMode:'auto',
  factorBName:'Temperature', factorBLevels:['4 °C','-1 °C','-18 °C'],
  parallelSamples:3, technicalRepeats:1, technicalAggregation:'mean', selectedTechnical:1, errorType:'sd'
};

const defaultChartSettings = {
  title:'Moisture content', titleVisible:true, titleX:490, titleY:39, titleSize:17, titleWeight:600, titleColor:'#14212a',
  subtitle:'', subtitleEnabled:false, subtitleX:490, subtitleY:60, subtitleSize:11, subtitleWeight:400, subtitleColor:'#687783',
  xTitle:'Storage time (d)', xTitleVisible:true, xTitleX:490, xTitleY:626, xTitleSize:15, xTitleWeight:400, xTitleColor:'#20262b',
  yTitle:'Moisture content (%)', yTitleVisible:true, yTitleX:31, yTitleY:332, yTitleSize:15, yTitleWeight:400, yTitleColor:'#20262b',
  fontEnglish:'Arial', fontChinese:'Microsoft YaHei', globalFontWeight:400, legendWeight:400,
  canvasWidth:980, canvasHeight:660, panelPreset:'normal', pngDpi:300,
  axisColor:'#20262b', axisWidth:1.35, frameMode:'box', frameWidth:1.15, frameColor:'#20262b',
  xTickSize:12, yTickSize:12, xTickWeight:400, yTickWeight:400, xTickColor:'#20262b', yTickColor:'#20262b', tickLength:6, xTickRotation:0, xTickAutoRotate:true, xTickStagger:false, showXTicks:true, showYTicks:true,
  xUnitSource:'auto', xUnitTarget:'auto', xScaleMode:'auto', xAxisMin:null, xAxisMax:null, xAxisSegments:10, xTickDecimals:'auto', xTickRound:true,
  lineWidth:2.1, markerSize:4.7, markerShape:'circle', markerFill:'white', lineMode:'straight', lineOffset:0,
  barGap:3, categoryWidth:.72, barOpacity:.96, barBorderWidth:.55,
  errorWidth:1.15, errorCap:10, errorColorMode:'series', errorXOffset:0,
  legendSize:12, legendVisible:true, legendOrientation:'horizontal', legendColumns:3,
  legendFrameStyle:'solid', legendFrameWidth:1, legendFrameColor:'#7d898f', legendFrameRadius:2, legendFrameFill:'#ffffff',
  legendShadow:true, legendShadowX:2, legendShadowY:3, legendShadowBlur:3, legendShadowOpacity:.28,
  letters:true, letterSize:11, letterWeight:400, letterOffset:10,
  yMin:null, yMax:null, yTickStep:null, yAxisSegments:6, yTickDecimals:'auto', yTickRound:false,
  lowerMin:0, lowerMax:20, upperMin:70, upperMax:82, breakGap:12, lowerRatio:.23,
  background:'#ffffff'
};


const defaultGallerySettings = {
  title:'',titleVisible:true,titleX:null,titleY:38,titleSize:17,titleWeight:600,titleColor:'#14212a',
  subtitle:'',subtitleEnabled:false,subtitleX:null,subtitleY:58,subtitleSize:11,subtitleWeight:400,subtitleColor:'#687783',
  xTitle:'',xTitleVisible:true,xTitleX:null,xTitleY:null,xTitleSize:15,xTitleWeight:400,xTitleColor:'#20262b',
  yTitle:'Value',yTitleVisible:true,yTitleX:28,yTitleY:null,yTitleSize:15,yTitleWeight:400,yTitleColor:'#20262b',
  width:980,height:660,dpi:300,panelPreset:'normal',
  fontEnglish:'Arial',fontChinese:'Microsoft YaHei',globalFontWeight:400,xTickSize:12,yTickSize:12,xTickWeight:400,yTickWeight:400,xTickColor:'#20262b',yTickColor:'#20262b',
  axisWidth:1.35,axisColor:'#20262b',tickLength:6,showXTicks:true,showYTicks:true,
  frameMode:'box',frameWidth:1.15,frameColor:'#20262b',background:'#ffffff',
  legend:true,legendX:120,legendY:62,legendFontSize:12,legendWeight:400,legendOrientation:'horizontal',legendColumns:3,
  legendFrameStyle:'none',legendFrameX:108,legendFrameY:50,legendFrameWidthBox:260,legendFrameHeightBox:62,legendFrameAutoSize:true,
  legendFrameWidth:1,legendFrameColor:'#7d898f',legendFrameFill:'#ffffff',legendFrameRadius:3,
  legendShadow:true,legendShadowX:2,legendShadowY:3,legendShadowBlur:3,legendShadowOpacity:.25,
  bins:10,bandwidth:0,opacity:.72,pointSize:4,lineWidth:2,markerShape:'circle',markerFill:'series',annotationSize:12,pieLabelSize:12,radarLabelSize:12,
  showPoints:true,showMean:true,showMedian:true,showOutliers:true,boxWidth:.48,whiskerWidth:1.1,medianWidth:1.5,
  boxQuartileMethod:'linear7',boxWhiskerMethod:'iqr15',boxWhiskerPercentile:5,statMethod:'anovaLsd',correlationMethod:'pearson',methodNoteVisible:true,methodNoteX:null,methodNoteY:null,methodNoteSize:10,methodNoteColor:'#5f6d75',
  significanceEnabled:true,significanceDisplay:'brackets',significancePairMode:'significant',significanceLabelMode:'stars',significanceFontSize:11,significanceLineWidth:1,significanceColor:'#20262b',significanceOffset:10,significanceStep:18,
  orientation:'vertical',donut:false,normalize:false,showRegression:true,showCorrelation:true,
  heatmapPalette:'greenMagenta',heatmapShowValues:true,heatmapCellGap:1,heatmapLowColor:'#CE5FA5',heatmapMidColor:'#D9D4C1',heatmapHighColor:'#58B66D',heatmapDiagonalColor:'#236B51',heatmapValueSize:10,heatmapXLabelSize:11,heatmapYLabelSize:11,heatmapColorBar:true,heatmapColorBarOrientation:'horizontal',radarGridWidth:1,radarPointSize:3,colorScheme:'foodchem'
};

const HEATMAP_PALETTES={
  greenMagenta:{name:'绿–米灰–品红（参考风格）',low:'#CE5FA5',mid:'#D9D4C1',high:'#58B66D',diagonal:'#236B51'},
  blueRed:{name:'蓝–白–红',low:'#3C5488',mid:'#F7F7F7',high:'#B40426',diagonal:'#7A0019'},
  purpleGreen:{name:'紫–白–绿',low:'#7E57C2',mid:'#FAFAFA',high:'#2E8B57',diagonal:'#1F6440'},
  tealOrange:{name:'青蓝–浅灰–橙红',low:'#2B8CBE',mid:'#F2F2F2',high:'#E34A33',diagonal:'#A62F1F'},
  mono:{name:'灰度',low:'#222222',mid:'#F5F5F5',high:'#777777',diagonal:'#111111'},
  custom:{name:'自定义',low:null,mid:null,high:null,diagonal:null}
};

const EXPERIMENT_CHARTS=['bar','line','curve'];
const WORKFLOW_GOAL_DEFAULTS={compare:'bar',trend:'line',dist:'box',relation:'scatter',multi:'radar',composition:'stacked'};
function isExperimentChart(type){return EXPERIMENT_CHARTS.includes(type)}
function setWorkflowChart(type,{keepData=false}={}){
  state.workflow.chartType=type;
  state.workflow.mode=isExperimentChart(type)?'experiment':'gallery';
  state.chart.mode=state.workflow.mode;
  if(state.workflow.mode==='experiment'){state.chart.type=type;if((type==='line'||type==='curve')&&!keepData)state.design.factorALevelMode='auto';}
  else{state.gallery.type=type;resetGallerySettings()}
  if(!keepData){
    if(state.workflow.mode==='experiment'){state.rawData=[];state.analysisRows=[];state.descriptive=[];state.analysis=null}
    else{state.gallery.rows=[];state.gallery.analysis=null;state.gallery.sourceName=''}
  }
  syncWorkflowControls();
}
function workflowChartLabel(type){
  const map={bar:'分组柱状图',line:'带误差棒折线图',curve:'平滑曲线图',hist:'直方图',kde:'核密度图 KDE',box:'箱线图',violin:'小提琴图',scatter:'散点图',bubble:'气泡图',stacked:'堆叠条形图',pie:'饼图 / 圆环图',heatmap:'相关性热力图',radar:'雷达图'};
  return map[type]||type;
}
function currentWorkflowSchema(){return state.workflow.mode==='experiment'?{name:'自动识别分组平行宽表',description:'第一列自动识别全部 X 水平；第一层表头识别实验条件；第二层任意样本编号均识别为独立平行。连续采样无需预先填写上千个水平。'}:GALLERY_SCHEMAS[(GALLERY_CHARTS.find(x=>x.id===state.workflow.chartType)||{}).schema]}

const state = {
  view:'plan',
  workflow:{goal:'compare',chartType:'bar',mode:'experiment',search:''},
  design:structuredClone(defaultDesign),
  rawData:[],
  analysisRows:[],
  descriptive:[],
  analysis:null,
  chartData:[],
  chart:{
    mode:'experiment', type:'bar', breakAxis:false, selected:'axis-y', selectedSeries:0, xFactor:'A',
    settings:structuredClone(defaultChartSettings), palette:[...templates.foodchem.colors], legend:{x:132,y:70}, legendFrame:{x:118,y:58,width:260,height:62,autoSize:true}, seriesStyles:{}, annotations:[], selectedAnnotation:null
  },
  gallery:{
    type:'box', rows:[], sourceName:'', analysis:null,
    settings:structuredClone(defaultGallerySettings),
    palette:[...templates.foodchem.colors], goal:'compare', showAll:false, selected:'title', selectedSeries:0, seriesStyles:{}, annotations:[], selectedAnnotation:null
  },
  figureBoard:{
    items:[],columns:2,rows:2,width:1600,height:1200,gap:24,padding:34,dpi:300,background:'#ffffff',
    labelEnabled:true,labelFont:'Arial',labelSize:32,labelWeight:700,labelColor:'#111111',labelPosition:'top-left',labelInsetX:8,labelInsetY:10,
    panelBorder:false,panelBorderWidth:1,panelBorderColor:'#c9d0d4',selected:0,annotations:[],selectedAnnotation:null
  }
};


function normalizeTextSettings(){
  const c=state.chart.settings,g=state.gallery.settings;
  c.titleVisible=c.titleVisible!==false;c.xTitleVisible=c.xTitleVisible!==false;c.yTitleVisible=c.yTitleVisible!==false;
  c.xTitleWeight=c.xTitleWeight??c.axisTitleWeight??400;c.yTitleWeight=c.yTitleWeight??c.axisTitleWeight??400;c.xTitleColor=c.xTitleColor||c.axisColor;c.yTitleColor=c.yTitleColor||c.axisColor;
  c.xTickSize=c.xTickSize??c.tickSize??12;c.yTickSize=c.yTickSize??c.tickSize??12;c.xTickWeight=c.xTickWeight??c.tickWeight??400;c.yTickWeight=c.yTickWeight??c.tickWeight??400;c.xTickColor=c.xTickColor||c.axisColor;c.yTickColor=c.yTickColor||c.axisColor;c.xTickAutoRotate=c.xTickAutoRotate!==false;c.xUnitSource=c.xUnitSource||'auto';c.xUnitTarget=c.xUnitTarget||'auto';
  g.titleVisible=g.titleVisible!==false;g.xTitleVisible=g.xTitleVisible!==false;g.yTitleVisible=g.yTitleVisible!==false;
  g.xTickSize=g.xTickSize??g.tickSize??12;g.yTickSize=g.yTickSize??g.tickSize??12;g.xTickWeight=g.xTickWeight??g.tickWeight??400;g.yTickWeight=g.yTickWeight??g.tickWeight??400;g.xTickColor=g.xTickColor||g.axisColor;g.yTickColor=g.yTickColor||g.axisColor;
  g.heatmapPalette=g.heatmapPalette||'greenMagenta';g.heatmapDiagonalColor=g.heatmapDiagonalColor||'#236B51';
  g.significanceEnabled=g.significanceEnabled!==false;g.significanceDisplay=g.significanceDisplay||'brackets';g.significancePairMode=g.significancePairMode||'significant';g.significanceLabelMode=g.significanceLabelMode||'stars';
  g.boxQuartileMethod=g.boxQuartileMethod||'linear7';g.boxWhiskerMethod=g.boxWhiskerMethod||'iqr15';g.boxWhiskerPercentile=Number(g.boxWhiskerPercentile)||5;g.statMethod=g.statMethod||'anovaLsd';g.correlationMethod=g.correlationMethod||'pearson';g.methodNoteVisible=g.methodNoteVisible!==false;g.methodNoteSize=g.methodNoteSize||10;g.methodNoteColor=g.methodNoteColor||'#5f6d75';
}

function init(){
  normalizeTextSettings();
  bindNavigation();
  bindWorkflow();
  bindDesign();
  bindData();
  bindStatistics();
  bindChartUi();
  setPropertiesPanelCollapsed(false);
  bindGallery();
  bindCompose();
  fillDesignForm();
  renderDesignPreview();
  renderDataPreview();
  showView('plan');
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
}

function bindNavigation(){
  $$('#mainNav .nav-item, #workflowProgress [data-view]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
  $$('[data-open]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.open)));
  $('#nextStepBtn').addEventListener('click',()=>showView(nextViewFor(state.view)));
  $('#saveProjectBtn').addEventListener('click',saveProject);
}

function nextViewFor(view){
  return ({plan:'design',design:'data',data:'statistics',statistics:'chart',chart:'chart',compose:'compose'})[view] || 'plan';
}

function showView(view){
  state.view=view;
  $$('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));
  $$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
  const map={
    plan:['研究目的与图形','先选择研究问题，再从同一图形库中选择合适的图。','填写基本实验信息'],
    design:['基本实验信息','填写实验名称、指标、因素水平与重复设计。','进入模板与导入'],
    data:['数据模板与导入','下载当前图形匹配的模板，再导入原始数据。','进入初步分析'],
    statistics:['初步分析','查看与当前图形和数据结构匹配的统计摘要。','进入 Chart Studio'],
    chart:['Chart Studio','统一编辑坐标轴、标题、图例、误差棒与图形专属属性。','留在 Chart Studio'],
    compose:['论文拼图','组合多张已完成图，自动添加 A、B、C、D 面板标签。','留在论文拼图']
  };
  const m=map[view]||map.plan;
  $('#pageTitle').textContent=m[0]; $('#pageSubtitle').textContent=m[1]; $('#nextStepBtn').textContent=m[2];
  const stepMap={plan:1,design:2,data:3,statistics:4,chart:5};
  const step=stepMap[view]||null;
  const stepLabel=$('#pageStepLabel');if(stepLabel)stepLabel.textContent=step?`步骤 ${step} / 5`:'论文输出';
  $$('[data-view]').forEach(el=>{if(el.closest('#mainNav')||el.closest('#workflowProgress'))el.classList.toggle('active',el.dataset.view===view)});
  const topChart=$('#topCurrentChart');if(topChart)topChart.textContent=workflowChartLabel(state.workflow.chartType);
  const sideChart=$('#sidebarChartName');if(sideChart)sideChart.textContent=workflowChartLabel(state.workflow.chartType);
  const sideProject=$('#sidebarProjectName');if(sideProject)sideProject.textContent=state.design.experimentName||'未命名项目';
  if(view==='plan'){syncWorkflowControls();renderPlanSelector()}
  if(view==='design'){syncWorkflowControls();renderDesignPreview();syncStepLabels()}
  if(view==='data'){syncWorkflowControls();renderDataPreview()}
  if(view==='statistics') renderStatistics();
  if(view==='chart')scheduleChartEntryRender();
  if(view==='compose')renderComposeWorkspace();
}

function bindWorkflow(){
  const goal=$('#workflowGoal'),chart=$('#workflowChartType');
  goal?.addEventListener('change',()=>{
    state.workflow.goal=goal.value;
    const next=WORKFLOW_GOAL_DEFAULTS[goal.value]||'bar';
    setWorkflowChart(next);
    renderPlanSelector();renderDesignPreview();renderDataPreview();
  });
  chart?.addEventListener('change',()=>{
    setWorkflowChart(chart.value);
    renderPlanSelector();renderDesignPreview();renderDataPreview();
  });
  $('#chartSearch')?.addEventListener('input',e=>{state.workflow.search=e.target.value.trim().toLowerCase();renderPlanSelector()});
  $('#downloadCurrentXlsx')?.addEventListener('click',()=>state.workflow.mode==='experiment'?downloadTemplateXlsx():downloadGalleryXlsx());
  $('#downloadCurrentCsv')?.addEventListener('click',()=>state.workflow.mode==='experiment'?downloadTemplateCsv():downloadGalleryCsv());
  $('#studioChartTypeSelect')?.addEventListener('change',e=>{
    const type=e.target.value;
    const mode=isExperimentChart(type)?'experiment':'gallery';
    const hasData=mode==='experiment'?state.rawData.length:state.gallery.rows.length;
    state.workflow.chartType=type;state.workflow.mode=mode;state.chart.mode=mode;
    if(mode==='experiment')state.chart.type=type;else state.gallery.type=type;
    syncWorkflowControls();
    if(!hasData){toast('当前图形需要对应数据模板，请先在数据导入步骤加载数据。');showView('data');return}
    renderChartStudio();
  });
  $('#openGuideFromStudio')?.addEventListener('click',()=>showView('plan'));
  syncWorkflowControls();
}
function syncWorkflowControls(){
  const goal=$('#workflowGoal'),chart=$('#workflowChartType'),studio=$('#studioChartTypeSelect');
  if(goal)goal.value=state.workflow.goal;
  if(chart)chart.value=state.workflow.chartType;
  if(studio)studio.value=state.workflow.chartType;
  const hint=$('#workflowGoalHint');if(hint){const g=GALLERY_GOALS?.find?.(x=>x.id===state.workflow.goal);hint.textContent=g?.desc||'系统会据此推荐图形和模板。'}
  const chartHint=$('#workflowChartHint');if(chartHint)chartHint.textContent=`${workflowChartLabel(state.workflow.chartType)}将贯穿模板、初步分析和 Chart Studio。`;
  const schema=currentWorkflowSchema();
  const n=$('#currentTemplateName'),d=$('#currentTemplateDescription');if(n)n.textContent=schema?.name||'当前数据模板';if(d)d.textContent=schema?.description||'';
  $$('.experiment-only').forEach(el=>el.classList.toggle('hidden',state.workflow.mode!=='experiment'));toggleFactorB();toggleTechnicalAggregation();syncFactorLevelMode();syncStepLabels();
  const top=$('#topCurrentChart');if(top)top.textContent=workflowChartLabel(state.workflow.chartType);
  const side=$('#sidebarChartName');if(side)side.textContent=workflowChartLabel(state.workflow.chartType);
}


const PLAN_CHART_META={
  bar:{group:'趋势与组间差异',icon:'▥',purpose:'比较不同处理组或不同时间点的均值差异',analysis:'描述统计、单/双因素 ANOVA、显著性字母',advice:'适合 Mean ± SD/SE 的常规食品实验论文图',schema:'分组平行宽表'},
  line:{group:'趋势与组间差异',icon:'⌁',purpose:'展示储藏时间、温度或浓度变化趋势',analysis:'描述统计、ANOVA、误差棒和显著性字母',advice:'食品品质随时间变化的优先图形',schema:'分组平行宽表'},
  curve:{group:'趋势与组间差异',icon:'∿',purpose:'展示数据点较密集的连续变化趋势',analysis:'趋势摘要与连续数据检查',advice:'仅平滑连线，不擅自修改原始数值；默认不显示误差棒',schema:'分组平行宽表'},
  hist:{group:'单变量分布',icon:'▥',purpose:'查看连续数值的频数分布、偏态和集中区间',analysis:'n、Mean、SD、Median、范围与分箱频数',advice:'适合判断分布形态，可与 KDE 配合',schema:'单变量长表'},
  kde:{group:'单变量分布',icon:'∿',purpose:'平滑展示一组或多组数据的密度形态',analysis:'n、Mean、SD、Median、带宽与密度估计',advice:'用于观察偏态、多峰和组间分布差异',schema:'单变量长表'},
  box:{group:'单变量分布',icon:'▣',purpose:'比较中位数、四分位数、离散程度和异常值',analysis:'n、Mean、SD、Median、Q1、Q3、IQR异常值',advice:'食品实验高频使用，通常优先于只显示均值的柱状图',schema:'单变量长表'},
  violin:{group:'单变量分布',icon:'◖◗',purpose:'同时展示分位数与数据密度分布',analysis:'箱线统计、KDE 密度与异常值摘要',advice:'样本量较多时比箱线图提供更多分布信息',schema:'单变量长表'},
  scatter:{group:'变量关系',icon:'⠿',purpose:'分析两个连续变量之间的相关和回归关系',analysis:'Pearson r、线性回归、斜率、截距与 R²',advice:'两个连续变量关系的首选图',schema:'XY 关系长表'},
  bubble:{group:'变量关系',icon:'◉',purpose:'同时表达 X、Y 和第三个大小变量',analysis:'Pearson r、回归与气泡变量范围',advice:'适合三变量表达，但应避免气泡差异过度夸张',schema:'XY 关系长表'},
  heatmap:{group:'变量关系',icon:'▦',purpose:'查看多个理化指标之间的相关矩阵',analysis:'Pearson 相关矩阵与指标数量摘要',advice:'相关不等于因果，正式论文应结合显著性和样本量',schema:'多指标矩阵'},
  stacked:{group:'组成与综合评价',icon:'▤',purpose:'比较不同类别内部的组分构成',analysis:'类别总量、组分值与百分比',advice:'组分构成优先使用堆叠或百分比堆叠柱状图',schema:'组成数据长表'},
  pie:{group:'组成与综合评价',icon:'◔',purpose:'展示少量类别在总体中的构成占比',analysis:'总量与各组分百分比',advice:'学术论文谨慎使用；精确比较优先选条形图',schema:'组成数据长表'},
  radar:{group:'组成与综合评价',icon:'✦',purpose:'同步比较多个感官或理化指标的综合表现',analysis:'组别、指标数、组均值和可选 0–1 归一化',advice:'不同量纲指标必须先标准化再比较形状',schema:'雷达图长表'}
};
const PLAN_GROUP_ORDER=['趋势与组间差异','单变量分布','变量关系','组成与综合评价'];
function goalRecommendedIds(goal){
  const map={compare:['box','bar','violin','line'],trend:['line','curve','bar'],dist:['box','violin','hist','kde'],relation:['scatter','bubble','heatmap'],multi:['radar','heatmap'],composition:['stacked','pie']};
  return map[goal]||[];
}
function syncStepLabels(){
  const label=workflowChartLabel(state.workflow.chartType),schema=currentWorkflowSchema();
  const a=$('#designCurrentChart');if(a)a.textContent=label;
  const b=$('#designSchemaName');if(b)b.textContent=schema?.name||'当前模板';
  const c=$('#designSchemaDescription');if(c)c.textContent=schema?.description||'';
  const d=$('#studioContextTitle');if(d)d.textContent=`Chart Studio · ${label}`;
}
function renderPlanSelector(){
  const holder=$('#planChartGroups');if(!holder)return;
  const goals=[
    ['compare','比较处理组'],['trend','时间 / 浓度趋势'],['dist','数据分布'],['relation','变量关系'],['multi','综合评价'],['composition','组分构成']
  ];
  const tabs=$('#goalTabs');
  if(tabs){
    tabs.innerHTML=goals.map(([id,name])=>`<button class="goal-tab ${state.workflow.goal===id?'active':''}" data-goal-tab="${id}">${name}</button>`).join('');
    $$('[data-goal-tab]').forEach(btn=>btn.addEventListener('click',()=>{
      state.workflow.goal=btn.dataset.goalTab;
      const next=WORKFLOW_GOAL_DEFAULTS[state.workflow.goal]||'bar';
      setWorkflowChart(next);
      renderPlanSelector();renderDesignPreview();renderDataPreview();
    }));
  }
  const recommended=goalRecommendedIds(state.workflow.goal),q=state.workflow.search||'';
  holder.innerHTML=PLAN_GROUP_ORDER.map(group=>{
    const ids=Object.keys(PLAN_CHART_META).filter(id=>{
      if(PLAN_CHART_META[id].group!==group)return false;
      if(!q)return true;
      const hay=[workflowChartLabel(id),PLAN_CHART_META[id].purpose,PLAN_CHART_META[id].schema,group].join(' ').toLowerCase();
      return hay.includes(q);
    });
    if(!ids.length)return'';
    return `<div class="plan-chart-section"><div class="plan-chart-section-head"><b>${esc(group)}</b><span>${ids.length} 种</span></div><div class="plan-chart-grid">${ids.map(id=>{
      const m=PLAN_CHART_META[id],active=state.workflow.chartType===id,rec=recommended.includes(id);
      return `<button class="plan-chart-card ${active?'active':''}" data-plan-chart="${id}"><span class="chart-card-icon">${m.icon}</span><span class="chart-card-copy"><b>${esc(workflowChartLabel(id))}</b><small>${esc(m.purpose)}</small></span>${rec?'<em>推荐</em>':''}<i>${esc(m.schema)}</i></button>`;
    }).join('')}</div></div>`;
  }).join('')||'<div class="empty-state">没有找到匹配图形</div>';
  $$('[data-plan-chart]').forEach(btn=>btn.addEventListener('click',()=>{
    const type=btn.dataset.planChart;
    setWorkflowChart(type);
    renderPlanSelector();renderDesignPreview();renderDataPreview();syncStepLabels();
  }));
  const meta=PLAN_CHART_META[state.workflow.chartType]||PLAN_CHART_META.bar;
  const set=(id,value)=>{const el=$(id);if(el)el.textContent=value};
  set('#planChartIcon',meta.icon);set('#planChartTitle',workflowChartLabel(state.workflow.chartType));set('#planPurposeText',meta.purpose);set('#planSchemaText',meta.schema);set('#planAnalysisText',meta.analysis);set('#planAdviceText',meta.advice);
  set('#topCurrentChart',workflowChartLabel(state.workflow.chartType));set('#sidebarChartName',workflowChartLabel(state.workflow.chartType));
  const count=$('#planSupportedCount');if(count)count.textContent=`${Object.keys(PLAN_CHART_META).length} 种图`;
  const search=$('#chartSearch');if(search&&document.activeElement!==search)search.value=state.workflow.search||'';
}

function bindDesign(){
  ['experimentName','metricName','metricUnit','factorAName','factorALevelMode','factorALevels','factorBName','factorBLevels','parallelSamples','technicalRepeats','technicalAggregation','selectedTechnical','errorType','designType'].forEach(id=>{
    $('#'+id).addEventListener('input',()=>{ readDesignForm(false); renderDesignPreview(); const side=$('#sidebarProjectName');if(side)side.textContent=$('#experimentName').value.trim()||'未命名项目'; });
  });
  $('#designType').addEventListener('change',()=>{toggleFactorB();syncFactorLevelMode();renderDesignPreview()});
  $('#factorALevelMode')?.addEventListener('change',()=>{syncFactorLevelMode();readDesignForm(false);renderDesignPreview()});
  $('#technicalAggregation')?.addEventListener('change',()=>{toggleTechnicalAggregation();readDesignForm(false);renderDesignPreview()});
  $('#technicalRepeats')?.addEventListener('input',toggleTechnicalAggregation);
  $('#applyDesign').addEventListener('click',()=>{ if(readDesignForm(true)){renderDesignPreview();toast('研究设计已应用')} });
  $('#downloadXlsx').addEventListener('click',()=>state.workflow.mode==='experiment'?downloadTemplateXlsx():downloadGalleryXlsx());
  $('#downloadCsv').addEventListener('click',()=>state.workflow.mode==='experiment'?downloadTemplateCsv():downloadGalleryCsv());
  $('#loadDesignDemo').addEventListener('click',()=>{state.design=structuredClone(defaultDesign);fillDesignForm();renderDesignPreview();toast('已载入双因素演示设计')});
}

function fillDesignForm(){
  const d=state.design;
  $('#experimentName').value=d.experimentName; $('#metricName').value=d.metricName; $('#metricUnit').value=d.metricUnit;
  $('#designType').value=d.designType; $('#factorAName').value=d.factorAName;
  const effectiveLevelMode=autoXCapable(state.workflow.chartType,d.designType)?(d.factorALevelMode||'auto'):'manual';
  if($('#factorALevelMode'))$('#factorALevelMode').value=effectiveLevelMode;
  $('#factorALevels').value=effectiveLevelMode==='manual'?d.factorALevels.join(', '):'';
  $('#factorBName').value=d.factorBName; $('#factorBLevels').value=d.factorBLevels.join(', '); $('#parallelSamples').value=d.parallelSamples; $('#technicalRepeats').value=d.technicalRepeats; $('#technicalAggregation').value=d.technicalAggregation||'mean'; $('#selectedTechnical').value=d.selectedTechnical||1; $('#errorType').value=d.errorType;
  toggleFactorB();toggleTechnicalAggregation();syncFactorLevelMode();syncWorkflowControls();
}

function splitLevels(text){ return [...new Set(String(text).split(/[,，;；\n]+/).map(x=>x.trim()).filter(Boolean))]; }

function readDesignForm(showErrors=true){
  const d={
    experimentName:$('#experimentName').value.trim(), metricName:$('#metricName').value.trim(), metricUnit:$('#metricUnit').value.trim(),
    designType:$('#designType').value, factorAName:$('#factorAName').value.trim(), factorALevelMode:$('#factorALevelMode')?.value||'manual',
    factorALevels:($('#factorALevelMode')?.value||'manual')==='auto'?[...(state.design.factorALevels||[])]:splitLevels($('#factorALevels').value),
    factorBName:$('#factorBName').value.trim(), factorBLevels:splitLevels($('#factorBLevels').value),
    parallelSamples:Number($('#parallelSamples').value), technicalRepeats:Number($('#technicalRepeats').value), technicalAggregation:$('#technicalAggregation').value, selectedTechnical:Number($('#selectedTechnical').value), errorType:$('#errorType').value
  };
  const errors=[];
  if(!d.experimentName)errors.push('请填写实验名称'); if(!d.metricName)errors.push('请填写测定指标');
  if(state.workflow.mode==='experiment'){
    if(d.factorALevelMode!=='auto'&&!d.factorAName)errors.push('请填写因素 A 名称'); if(d.factorALevelMode!=='auto'&&d.factorALevels.length<2)errors.push('手动模式下因素 A 至少需要 2 个水平');
    if(d.designType==='two'&&!d.factorBName)errors.push('请填写因素 B 名称'); if(d.designType==='two'&&d.factorBLevels.length<2)errors.push('因素 B 至少需要 2 个水平');
    if(!Number.isInteger(d.parallelSamples)||d.parallelSamples<2)errors.push('每个组合至少需要 2 个独立平行样本');
    if(!Number.isInteger(d.technicalRepeats)||d.technicalRepeats<1)errors.push('每个平行样本至少需要 1 次测定');
    if(d.technicalAggregation==='selected'&&(!Number.isInteger(d.selectedTechnical)||d.selectedTechnical<1||d.selectedTechnical>d.technicalRepeats))errors.push('固定测定轮次必须在 1 到技术测定次数之间');
  }
  if(errors.length){ if(showErrors)toast(errors[0]); return false; }
  if(d.designType==='one'){d.factorBName='';d.factorBLevels=[''];}
  state.design=d; return true;
}

function toggleFactorB(){ const on=state.workflow.mode==='experiment'&&$('#designType').value==='two'; $$('.factor-b').forEach(el=>el.classList.toggle('hidden',!on)); }
function autoXCapable(type=state.workflow.chartType,designType=$('#designType')?.value||state.design.designType){return type==='line'||type==='curve'||(type==='bar'&&designType==='two')}
function usesAutomaticXLevels(d=state.design,type=state.workflow.chartType){return (d.factorALevelMode||'manual')==='auto'&&autoXCapable(type,d.designType)}
function syncFactorLevelMode(){
  const select=$('#factorALevelMode'),manual=$('#factorALevelsField'),auto=$('#factorAAutoField');if(!select)return;
  const capable=autoXCapable(),isAuto=capable&&select.value==='auto';
  if(!capable){select.value='manual';select.disabled=true;if($('#factorALevels')&&!$('#factorALevels').value)$('#factorALevels').value=(state.design.factorALevels||[]).join(', ')}else select.disabled=false;
  manual?.classList.toggle('hidden',isAuto);auto?.classList.toggle('hidden',!isAuto);
  const status=$('#factorAAutoStatus');if(status){const levels=state.design.factorALevels||[];status.textContent=levels.length?`已识别 ${levels.length} 个水平：${levels.slice(0,3).join('、')}${levels.length>3?' … '+levels.at(-1):''}`:'等待导入，第一列可包含任意数量数据点'}
}
function toggleTechnicalAggregation(){ const el=$('#selectedTechnicalField'); if(el)el.classList.toggle('hidden',$('#technicalAggregation')?.value!=='selected'); const max=Math.max(1,Number($('#technicalRepeats')?.value)||1); if($('#selectedTechnical')){$('#selectedTechnical').max=max; if(Number($('#selectedTechnical').value)>max)$('#selectedTechnical').value=max;} }

function aggregationLabel(d=state.design){
  if((d.technicalRepeats||1)<=1)return '无技术重复，直接使用独立平行值';
  if(d.technicalAggregation==='median')return '技术重复取中位数';
  if(d.technicalAggregation==='selected')return `统一使用 T${d.selectedTechnical||1}`;
  return '技术重复取平均值';
}
function parallelLabel(i){return `R${i}`}
function technicalLabel(i){return `T${i}`}
function xlsxColumnName(index){let n=index+1,s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}

function experimentTemplateSpec(){
  const d=state.design,type=state.workflow.chartType;
  const pCount=Math.max(2,Number(d.parallelSamples)||3),tCount=Math.max(1,Number(d.technicalRepeats)||1),autoX=usesAutomaticXLevels(d,type);
  let groups,xLevels,xHeader,name,description;
  if(d.designType==='two'){
    groups=d.factorBLevels.length?[...d.factorBLevels]:['第1组','第2组','第3组'];
    xLevels=autoX?[]:[...d.factorALevels];xHeader=d.factorAName||'X';
    name=`${xHeader} × ${d.factorBName||'组别'} 自动识别分组平行表`;
    description=autoX?`第一列可直接粘贴任意数量的 ${xHeader} 数据，导入时自动识别全部水平；第一层表头为不同条件，第二层为独立平行。`:`${d.factorBName||'组别'}的不同条件作为第一层表头，每个条件下按 R1–R${pCount} 填写独立平行。`;
  }else if(type==='bar'){
    groups=[...d.factorALevels];xLevels=[d.metricName||'测定值'];xHeader='指标';
    name=`${d.factorAName||'处理组'}分组平行表`;
    description=`不同处理条件作为第一层表头，每组下直接填写 R1–R${pCount} 独立平行；组数较多时也可直接导入已有合并表头文件，平台自动识别。`;
  }else{
    groups=[`${d.metricName}${d.metricUnit?` (${d.metricUnit})`:''}`];xLevels=autoX?[]:[...d.factorALevels];xHeader=d.factorAName||'X';
    name=`${xHeader}自动识别单系列平行表`;
    description=autoX?`第一列可直接粘贴任意数量的 ${xHeader} 数据，导入时自动识别全部水平；无需在网页中逐个填写。`:`${xHeader}按行排列，每个数据点填写 R1–R${pCount} 独立平行。`;
  }
  if(tCount>1)description+=` 每个独立平行下填写 T1–T${tCount}，平台按“${aggregationLabel(d)}”汇总。`;
  const headerDepth=tCount>1?3:2,columns=[];
  groups.forEach((group,g)=>{for(let parallel=1;parallel<=pCount;parallel++)for(let technical=1;technical<=tCount;technical++)columns.push({group,g,parallel,technical})});
  const width=2+columns.length,headerRows=Array.from({length:headerDepth},()=>Array(width).fill(''));
  headerRows[0][0]=xHeader;headerRows[0][width-1]='备注';let col=1;
  groups.forEach(group=>{headerRows[0][col]=group;for(let parallel=1;parallel<=pCount;parallel++){headerRows[1][col]=parallelLabel(parallel);if(tCount>1)for(let technical=1;technical<=tCount;technical++)headerRows[2][col+technical-1]=technicalLabel(technical);col+=tCount}});
  const dataRows=xLevels.map(x=>[x,...Array(columns.length).fill(''),'']),matrix=[...headerRows,...dataRows],merges=[];
  merges.push({s:{r:0,c:0},e:{r:headerDepth-1,c:0}},{s:{r:0,c:width-1},e:{r:headerDepth-1,c:width-1}});col=1;
  groups.forEach(()=>{const groupStart=col,groupEnd=col+pCount*tCount-1;if(groupEnd>groupStart)merges.push({s:{r:0,c:groupStart},e:{r:0,c:groupEnd}});for(let parallel=1;parallel<=pCount;parallel++){if(tCount>1)merges.push({s:{r:1,c:col},e:{r:1,c:col+tCount-1}});col+=tCount}});
  const flatHeaders=[xHeader,...columns.map(c=>`${c.group}__${parallelLabel(c.parallel)}${tCount>1?`__${technicalLabel(c.technical)}`:''}`),'备注'];
  const flatRows=xLevels.map(x=>[x,...Array(columns.length).fill(''),'']);
  let summary=null;
  if(tCount>1&&!autoX){
    const sw=2+groups.length*pCount,sh=[Array(sw).fill(''),Array(sw).fill('')],sm=[];sh[0][0]=xHeader;sh[0][sw-1]='备注';const summaryColumns=[];let sc=1;
    groups.forEach((group,g)=>{sh[0][sc]=group;for(let parallel=1;parallel<=pCount;parallel++){sh[1][sc]=parallelLabel(parallel);summaryColumns.push({group,g,parallel,col:sc});sc++}});
    sm.push({s:{r:0,c:0},e:{r:1,c:0}},{s:{r:0,c:sw-1},e:{r:1,c:sw-1}});sc=1;groups.forEach(()=>{sm.push({s:{r:0,c:sc},e:{r:0,c:sc+pCount-1}});sc+=pCount});
    const srows=xLevels.map(x=>[x,...Array(groups.length*pCount).fill(''),'']),formulaCells=[];
    srows.forEach((row,ri)=>summaryColumns.forEach(c=>{const rawStart=1+(c.g*pCount+(c.parallel-1))*tCount,rawEnd=rawStart+tCount-1,rawExcelRow=headerDepth+ri+1;let formula;if(d.technicalAggregation==='median')formula=`MEDIAN('数据填写'!${xlsxColumnName(rawStart)}${rawExcelRow}:${xlsxColumnName(rawEnd)}${rawExcelRow})`;else if(d.technicalAggregation==='selected'){const selected=Math.min(tCount,Math.max(1,Number(d.selectedTechnical)||1));formula=`'数据填写'!${xlsxColumnName(rawStart+selected-1)}${rawExcelRow}`}else formula=`AVERAGE('数据填写'!${xlsxColumnName(rawStart)}${rawExcelRow}:${xlsxColumnName(rawEnd)}${rawExcelRow})`;formulaCells.push({r:2+ri,c:c.col,formula})}));
    summary={matrix:[...sh,...srows],merges:sm,formulaCells,width:sw,headerDepth:2};
  }
  return {mode:'grouped-parallel-auto',name,description,groups,xLevels,xHeader,pCount,tCount,headerDepth,columns,width,matrix,merges,flatHeaders,flatRows,summary,autoX};
}
function templateRows(){return experimentTemplateSpec().flatRows}

function renderExperimentHeaderHtml(spec){
  let html='<thead>';
  html+=`<tr><th rowspan="${spec.headerDepth}">${esc(spec.xHeader)}</th>`;
  spec.groups.forEach(group=>html+=`<th colspan="${spec.pCount*spec.tCount}" class="group-head">${esc(group)}</th>`);
  html+=`<th rowspan="${spec.headerDepth}">备注</th></tr>`;
  html+='<tr>';
  spec.groups.forEach(()=>{for(let p=1;p<=spec.pCount;p++)html+=`<th colspan="${spec.tCount}" class="parallel-head">${parallelLabel(p)}</th>`});
  html+='</tr>';
  if(spec.tCount>1){html+='<tr>';spec.groups.forEach(()=>{for(let p=1;p<=spec.pCount;p++)for(let t=1;t<=spec.tCount;t++)html+=`<th class="technical-head">${technicalLabel(t)}</th>`});html+='</tr>'}
  return html+'</thead>';
}

function renderDesignPreview(){
  const d=state.design;
  if(state.workflow.mode==='gallery'){
    const schema=currentWorkflowSchema(),rows=galleryTemplateRows(state.workflow.chartType),preview=rows.slice(0,12),headers=schema.columns;
    $('#designSummaryText').textContent=`${workflowChartLabel(state.workflow.chartType)} · ${schema.name} · 按图形模板导入`;
    $('#templateRowCount').textContent=`${schema.name} · ${rows.length} 行示例`;
    let html=`<thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>`;
    preview.forEach(r=>html+=`<tr>${headers.map(h=>`<td>${esc(r[h]??'待填写')}</td>`).join('')}</tr>`);
    if(rows.length>preview.length)html+=`<tr><td colspan="${headers.length}" class="empty-row">……其余 ${rows.length-preview.length} 行将在模板中完整生成</td></tr>`;
    $('#designPreviewTable').innerHTML=html+'</tbody>';syncWorkflowControls();return;
  }
  const spec=experimentTemplateSpec(),preview=spec.autoX?['在第一列粘贴第 1 个 X 值','在第一列粘贴第 2 个 X 值','……可继续粘贴至上千行']:spec.xLevels.slice(0,10);
  const independentCount=spec.autoX?'导入后自动统计':spec.xLevels.length*spec.groups.length*spec.pCount;
  $('#designSummaryText').textContent=`${workflowChartLabel(state.workflow.chartType)} · ${spec.name} · 每个条件 ${spec.pCount} 个独立平行${spec.tCount>1?` × ${spec.tCount} 次技术测定`:''}`;
  $('#templateRowCount').textContent=spec.autoX?`${spec.groups.length} 个条件 · X 水平自动识别 · ${aggregationLabel(d)}`:`${spec.groups.length} 个条件 · ${independentCount} 个独立样品 · ${aggregationLabel(d)}`;
  let html=renderExperimentHeaderHtml(spec)+'<tbody>';
  preview.forEach(x=>{html+=`<tr><td>${esc(x)}</td>${spec.columns.map(()=>'<td class="muted-cell">待填写</td>').join('')}<td></td></tr>`});
  if(spec.autoX)html+=`<tr><td colspan="${spec.width}" class="empty-row">模板不限制行数；导入时从第一列自动读取全部 X 水平和顺序</td></tr>`;else if(spec.xLevels.length>preview.length)html+=`<tr><td colspan="${spec.width}" class="empty-row">……其余 ${spec.xLevels.length-preview.length} 行将在模板中完整生成</td></tr>`;
  $('#designPreviewTable').innerHTML=html+'</tbody>';syncWorkflowControls();
}

function designConfigRows(){
  const d=state.design,spec=state.workflow.mode==='experiment'?experimentTemplateSpec():null; return [
    ['配置项','值'],['FoodLab模板版本','0.8.2'],['实验名称',d.experimentName],['研究目的',state.workflow.goal],['计划图形',state.workflow.chartType],['测定指标',d.metricName],['单位',d.metricUnit],
    ['实验类型',d.designType],['因素A名称',d.factorAName],['因素A水平来源',d.factorALevelMode||'manual'],['因素A水平',usesAutomaticXLevels(d)?'':d.factorALevels.join('|')],['因素B名称',d.factorBName],['因素B水平',d.factorBLevels.join('|')],
    ['平行样本数',d.parallelSamples],['每个平行样本测定重复数',d.technicalRepeats],['技术重复汇总方式',d.technicalAggregation||'mean'],['固定测定轮次',d.selectedTechnical||1],['误差棒',d.errorType],['数据布局',spec?.mode||'按图形模板'],['数据布局说明',spec?.description||'']
  ];
}

function setFormulaCell(ws,r,c,formula){const address=XLSX.utils.encode_cell({r,c});if(!ws[address])ws[address]={t:'n'};ws[address].f=formula}
function applyTemplateSheetLayout(ws,spec){
  ws['!merges']=spec.merges;ws['!cols']=Array.from({length:spec.width},(_,i)=>({wch:i===0?Math.max(15,String(spec.xHeader).length+5):i===spec.width-1?18:11}));
  ws['!rows']=Array.from({length:spec.headerDepth},()=>({hpt:23}));
  ws['!freeze']={xSplit:1,ySplit:spec.headerDepth,topLeftCell:`B${spec.headerDepth+1}`,activePane:'bottomRight',state:'frozen'};
}

function downloadTemplateXlsx(){
  if(!readDesignForm(true))return;
  if(!window.XLSX){downloadTemplateCsv();toast('Excel 组件未加载，已改为下载 CSV 模板');return;}
  const wb=XLSX.utils.book_new(),spec=experimentTemplateSpec();
  const ws=XLSX.utils.aoa_to_sheet(spec.matrix);applyTemplateSheetLayout(ws,spec);
  XLSX.utils.book_append_sheet(wb,ws,'数据填写');
  if(spec.summary){
    const sws=XLSX.utils.aoa_to_sheet(spec.summary.matrix);sws['!merges']=spec.summary.merges;
    sws['!cols']=Array.from({length:spec.summary.width},(_,i)=>({wch:i===0?Math.max(15,String(spec.xHeader).length+5):i===spec.summary.width-1?18:11}));
    sws['!freeze']={xSplit:1,ySplit:2,topLeftCell:'B3',activePane:'bottomRight',state:'frozen'};
    spec.summary.formulaCells.forEach(x=>setFormulaCell(sws,x.r,x.c,x.formula));
    XLSX.utils.book_append_sheet(wb,sws,'平行值预览（自动）');
  }
  const config=XLSX.utils.aoa_to_sheet(designConfigRows());config['!cols']=[{wch:24},{wch:78}];
  const guide=XLSX.utils.aoa_to_sheet([
    ['FoodLab Studio 分组平行数据模板'],
    ['当前布局',spec.name],
    ['表头逻辑','第一列是 X 轴及全部因素 A 水平；第一层表头是实验条件；第二层任意样本编号（R1、s1、m1 等）都识别为独立平行。只有技术测定次数大于 1 时，才增加第三层 T1、T2、T3。'],
    ['连续采样',spec.autoX?'无需预先填写因素 A 水平。打开模板后直接从第一列向下粘贴几十、几百或上千个时间点，软件导入时自动读取。':'当前使用手动预设水平。'],
    ['填写规则 1','直接在对应条件和独立平行下填写原始数值。3 个平行样本不是 3 次技术重复。'],
    ['填写规则 2',spec.tCount>1?`同一个 R 内的 T1–T${spec.tCount} 属于同一样品的技术测定，平台按“${aggregationLabel()}”汇总后再作图和统计。`:'当前模板没有技术重复，每个 R 单元格就是一个独立样本值。'],
    ['统计规则','误差棒和 ANOVA 使用 R1、R2、R3 等独立平行值；技术重复不直接增加统计样本量 n。'],
    ['选择数据','平台不会自动挑选“最好看”的测定值。可选择平均值、中位数或统一使用固定测定轮次，确保所有组使用同一规则。'],
    ['自动预览',spec.tCount>1?'“平行值预览（自动）”工作表会按当前汇总方式显示每个独立平行的最终值。':'无需额外汇总工作表。'],
    ['缺失值','尚未测定或缺失的数据保持空白，不要填写 0、— 或文字。'],
    ['导入','完成后导入整个 Excel 文件；请勿修改“项目配置（勿改）”工作表。']
  ]);guide['!cols']=[{wch:18},{wch:100}];
  XLSX.utils.book_append_sheet(wb,config,'项目配置（勿改）');XLSX.utils.book_append_sheet(wb,guide,'填写说明');
  XLSX.writeFile(wb,`${safeFile(state.design.experimentName)}_${safeFile(workflowChartLabel(state.workflow.chartType))}_分组平行模板.xlsx`);toast(spec.autoX?'自动识别 X 轴的 Excel 模板已生成':'分组平行 Excel 模板已生成');
}

function downloadTemplateCsv(){
  if(!readDesignForm(true))return;
  const spec=experimentTemplateSpec(),csv='\ufeff'+[spec.flatHeaders,...spec.flatRows].map(row=>row.map(csvCell).join(',')).join('\r\n');
  download(new Blob([csv],{type:'text/csv;charset=utf-8'}),`${safeFile(state.design.experimentName)}_${safeFile(workflowChartLabel(state.workflow.chartType))}_平行数据模板.csv`);toast(spec.autoX?'CSV 只生成表头；第一列可粘贴任意数量 X 值':'CSV 使用“条件__R1__T1”扁平表头');
}

function bindData(){
  $('#chooseFile').addEventListener('click',()=>$('#fileInput').click());
  $('#fileInput').addEventListener('change',e=>{if(e.target.files[0])handleUnifiedFile(e.target.files[0])});
  const dz=$('#dropZone');
  ['dragenter','dragover'].forEach(name=>dz.addEventListener(name,e=>{e.preventDefault();dz.classList.add('dragover')}));
  ['dragleave','drop'].forEach(name=>dz.addEventListener(name,e=>{e.preventDefault();dz.classList.remove('dragover')}));
  dz.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)handleUnifiedFile(f)});
  $('#loadRawDemo').addEventListener('click',()=>{if(state.workflow.mode==='experiment')loadRawDemo();else{state.gallery.type=state.workflow.chartType;loadGalleryDemo();renderDataPreview();showValidation('success','已载入图形示例数据',`${workflowChartLabel(state.workflow.chartType)} · ${state.gallery.rows.length} 行`)}});
  $('#pasteToggle').addEventListener('click',()=>$('#pasteBox').classList.toggle('hidden'));
  $('#parsePasted').addEventListener('click',()=>{const rows=parseDelimited($('#dataText').value);if(state.workflow.mode==='experiment')processImported(rows,'粘贴数据');else processGalleryImported(rows,'粘贴数据')});
  $('#clearData').addEventListener('click',()=>{state.rawData=[];state.analysisRows=[];state.descriptive=[];state.analysis=null;state.gallery.rows=[];state.gallery.analysis=null;state.gallery.sourceName='';renderDataPreview();showValidation('neutral','数据已清空','请导入当前项目模板。')});
  $('#goStatistics').addEventListener('click',()=>{if(state.workflow.mode==='experiment')analyzeData();else analyzeGalleryData();showView('statistics')});
}

async function handleUnifiedFile(file){
  if(state.workflow.mode==='experiment')return handleFile(file);
  try{
    let rows;
    if(/\.(csv|tsv)$/i.test(file.name))rows=parseDelimited(await file.text());
    else{
      if(!window.XLSX)throw new Error('Excel 组件未加载，请刷新页面或使用 CSV 模板。');
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),name=wb.SheetNames.includes('数据填写')?'数据填写':wb.SheetNames[0];
      rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:''});
    }
    processGalleryImported(rows,file.name);
  }catch(err){showValidation('error','导入失败',err.message||'无法读取文件');toast(err.message||'导入失败')}
}
function processGalleryImported(rows,source){
  state.gallery.type=state.workflow.chartType;
  const normalized=normalizeGalleryRows(rows,galleryDef().schema);
  if(!normalized.length){showValidation('error','没有读取到有效数据',`当前需要 ${currentWorkflowSchema().name}。请使用平台生成的模板。`);return}
  state.gallery.rows=normalized;state.gallery.sourceName=source;analyzeGalleryData();renderDataPreview();
  showValidation('success',`导入成功：${normalized.length} 行`,`${workflowChartLabel(state.workflow.chartType)} · ${currentWorkflowSchema().name} · ${source}`);toast('数据已导入并完成初步分析');
}

async function handleFile(file){
  try{
    const lower=file.name.toLowerCase();
    if(lower.endsWith('.csv')||lower.endsWith('.tsv')){processImported(parseDelimited(await file.text()),file.name);return}
    if(!window.XLSX)throw new Error('Excel 组件未加载，请刷新页面或使用 CSV 模板。');
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
    let config=null;
    if(wb.SheetNames.includes('项目配置（勿改）'))config=XLSX.utils.sheet_to_json(wb.Sheets['项目配置（勿改）'],{header:1,defval:''});
    if(config)applyImportedConfig(config);
    const dataName=wb.SheetNames.includes('数据填写')?'数据填写':wb.SheetNames[0],ws=wb.Sheets[dataName];
    const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true,blankrows:false});
    const structured=parseStructuredExperimentMatrix(matrix);
    if(structured&&structured.parsed.length){finalizeImportedExperiment(structured.parsed,structured.errors,file.name,structured.layout,structured.inferred);return}
    const rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:true,blankrows:false});
    processImported(rows,file.name);
  }catch(err){showValidation('error','导入失败',err.message);toast(err.message)}
}

function applyImportedConfig(rows){
  const map={}; rows.slice(1).forEach(r=>{if(r[0])map[String(r[0])]=r[1]});
  if(!map['FoodLab模板版本'])return;
  state.design={
    experimentName:String(map['实验名称']||'未命名实验'), metricName:String(map['测定指标']||'指标值'), metricUnit:String(map['单位']||''),
    designType:String(map['实验类型']||'one'), factorAName:String(map['因素A名称']||'因素 A'), factorALevelMode:String(map['因素A水平来源']||'auto'), factorALevels:String(map['因素A水平']||'').split('|').filter(Boolean),
    factorBName:String(map['因素B名称']||''), factorBLevels:String(map['因素B水平']||'').split('|'),
    parallelSamples:Number(map['平行样本数']||map['独立平行样本数']||map['重复数']||3),
    technicalRepeats:Number(map['每个平行样本测定重复数']||map['测定重复数']||1), technicalAggregation:String(map['技术重复汇总方式']||'mean'), selectedTechnical:Number(map['固定测定轮次']||1), errorType:String(map['误差棒']||'sd')
  };
  if(state.design.designType==='one')state.design.factorBLevels=[''];
  if(map['计划图形']){state.workflow.goal=String(map['研究目的']||'compare');setWorkflowChart(String(map['计划图形']),{keepData:true})}
  fillDesignForm();renderDesignPreview();
}

function normalizeHeader(h){return String(h??'').trim().toLowerCase().replace(/[\s_()（）%]/g,'')}
function findKey(obj, aliases){const keys=Object.keys(obj);return keys.find(k=>aliases.includes(normalizeHeader(k)))}

function findNamedKey(obj,name){
  const target=normalizeHeader(name);return Object.keys(obj).find(k=>normalizeHeader(k)===target);
}
function metadataKeySet(first){
  return new Set([
    findKey(first,['平行样本编号','平行编号','独立重复编号','parallel','parallelreplicate','biologicalreplicate']),
    findKey(first,['测定重复编号','技术重复编号','测量重复编号','technicalrepeat','measurementrepeat']),
    findKey(first,['备注','note','notes'])
  ].filter(Boolean));
}
function pushParsedValue(parsed,errors,seen,{a,b='',parallel=1,technical=1,value,rowNumber}){
  if(String(value??'').trim()==='')return;
  const n=Number(value);if(!Number.isFinite(n)){errors.push(`第 ${rowNumber} 行“${b||a}”不是数字`);return}
  a=String(a??'').trim();b=String(b??'').trim();parallel=Number(parallel);technical=Number(technical);
  if(!a){errors.push(`第 ${rowNumber} 行缺少因素 A 水平`);return}
  if(!Number.isFinite(parallel)||parallel<1){errors.push(`第 ${rowNumber} 行平行样本编号无效`);return}
  if(!Number.isFinite(technical)||technical<1){errors.push(`第 ${rowNumber} 行测定重复编号无效`);return}
  const key=`${a}\u0001${b}\u0001${parallel}\u0001${technical}`;if(seen.has(key)){errors.push(`第 ${rowNumber} 行与前面存在重复的实验组合、平行编号和技术重复编号`);return}seen.add(key);
  parsed.push({sampleId:`${a}-${b||'G'}-P${parallel}`,a,b,parallel,technical,rep:parallel,value:n});
}
function parseLongExperimentRows(rows){
  const first=rows[0],ka=findKey(first,['因素a水平','factora','a','x']),kb=findKey(first,['因素b水平','factorb','b','group']),
    kp=findKey(first,['平行样本编号','平行编号','独立重复编号','parallel','parallelreplicate','biologicalreplicate']),kt=findKey(first,['测定重复编号','技术重复编号','测量重复编号','technicalrepeat','measurementrepeat']),
    kr=findKey(first,['重复编号','replicate','rep','重复']),kv=findKey(first,['测定值','value','result','数值']),ks=findKey(first,['样品编号','sampleid','sample']);
  if(!ka||!kv)return null;
  const parsed=[],errors=[],seen=new Set();
  rows.forEach((row,i)=>{
    const parallel=Number(kp?row[kp]:(kr?row[kr]:1)),technical=Number(kt?row[kt]:1),a=String(row[ka]??'').trim(),b=kb?String(row[kb]??'').trim():'';
    const before=parsed.length;pushParsedValue(parsed,errors,seen,{a,b,parallel,technical,value:row[kv],rowNumber:i+2});
    if(parsed.length>before&&ks){const sample=String(row[ks]??'').trim();if(sample)parsed.at(-1).sampleId=sample}
  });
  return {parsed,errors,layout:'long'};
}
function parseWideExperimentRows(rows){
  const d=state.design,type=state.workflow.chartType,first=rows[0],parsed=[],errors=[],seen=new Set();
  const kp=findKey(first,['平行样本编号','平行编号','独立重复编号','parallel','parallelreplicate','biologicalreplicate','replicate','rep','重复编号']),
    kt=findKey(first,['测定重复编号','技术重复编号','测量重复编号','technicalrepeat','measurementrepeat']),meta=metadataKeySet(first);
  if(!kp)return null;
  if(d.designType==='two'){
    const xKey=findNamedKey(first,d.factorAName)||findKey(first,['因素a水平','factora','a','x']);if(!xKey)return null;
    const seriesKeys=d.factorBLevels.map(level=>[level,findNamedKey(first,level)]).filter(x=>x[1]);if(!seriesKeys.length)return null;
    rows.forEach((row,i)=>seriesKeys.forEach(([level,key])=>pushParsedValue(parsed,errors,seen,{a:row[xKey],b:level,parallel:row[kp],technical:kt?row[kt]:1,value:row[key],rowNumber:i+2})));
    return {parsed,errors,layout:'wide-two'};
  }
  if(type==='bar'){
    const groupKeys=d.factorALevels.map(level=>[level,findNamedKey(first,level)]).filter(x=>x[1]);if(!groupKeys.length)return null;
    rows.forEach((row,i)=>groupKeys.forEach(([level,key])=>pushParsedValue(parsed,errors,seen,{a:level,b:'',parallel:row[kp],technical:kt?row[kt]:1,value:row[key],rowNumber:i+2})));
    return {parsed,errors,layout:'wide-one-bar'};
  }
  const xKey=findNamedKey(first,d.factorAName)||findKey(first,['因素a水平','factora','a','x']);if(!xKey)return null;
  meta.add(xKey);const metricTarget=normalizeHeader(d.metricName),valueKey=Object.keys(first).find(k=>normalizeHeader(k)===metricTarget||normalizeHeader(k).startsWith(metricTarget))||Object.keys(first).find(k=>!meta.has(k));if(!valueKey)return null;
  rows.forEach((row,i)=>pushParsedValue(parsed,errors,seen,{a:row[xKey],b:'',parallel:row[kp],technical:kt?row[kt]:1,value:row[valueKey],rowNumber:i+2}));
  return {parsed,errors,layout:'wide-one-trend'};
}
function parseIndexLabel(value,prefix){
  const s=String(value??'').trim(),m=s.match(new RegExp(`${prefix}\\s*(\\d+)`,'i'))||s.match(/(\d+)/);return m?Number(m[1]):null;
}
function parseStructuredExperimentMatrix(matrix){
  if(!Array.isArray(matrix)||matrix.length<2)return null;
  const top=matrix[0]||[],second=matrix[1]||[],third=matrix[2]||[];
  const noteIndex=top.findIndex(v=>['备注','note','notes'].includes(normalizeHeader(v)));
  const end=noteIndex>0?noteIndex:Math.max(top.length,second.length,third.length);
  const hasTechnical=third.slice(1,end).some(v=>/^t\s*\d+$/i.test(String(v).trim())||/技术|测定/.test(String(v)));
  const headerDepth=hasTechnical?3:2,xHeader=String(top[0]??'').trim()||state.design.factorAName||'X';
  const segments=[];let current=null;
  for(let c=1;c<end;c++){
    const raw=String(top[c]??'').trim();
    if(raw){
      if(!current||normalizeHeader(current.group)!==normalizeHeader(raw)){current={group:raw,start:c,end:c};segments.push(current)}else current.end=c;
    }else if(current)current.end=c;
  }
  if(!segments.length)return null;
  const columns=[];
  segments.forEach(seg=>{
    let parallel=0,previousTechnical=0;
    for(let c=seg.start;c<=seg.end;c++){
      if(hasTechnical){
        const secondLabel=String(second[c]??'').trim(),technical=parseIndexLabel(third[c],'T')||((previousTechnical||0)+1);
        if(secondLabel||parallel===0||technical<=previousTechnical)parallel++;
        columns.push({c,group:seg.group,parallel,technical,label:secondLabel||`R${parallel}`});previousTechnical=technical;
      }else{
        parallel++;
        columns.push({c,group:seg.group,parallel,technical:1,label:String(second[c]??'').trim()||`R${parallel}`});
      }
    }
  });
  const dataRows=[];
  for(let r=headerDepth;r<matrix.length;r++){
    const row=matrix[r]||[],x=String(row[0]??'').trim();
    if(!x&&columns.every(col=>String(row[col.c]??'').trim()===''))continue;
    dataRows.push({r,row,x});
  }
  if(!dataRows.length)return null;
  const groups=[...new Set(columns.map(c=>c.group))],xLevels=[...new Set(dataRows.map(x=>x.x).filter(Boolean))],type=state.workflow.chartType;
  const usesX=type==='line'||type==='curve'||(type==='bar'&&(dataRows.length>1||groups.length===1));
  const isTwo=usesX&&groups.length>1,parsed=[],errors=[],seen=new Set();
  dataRows.forEach(item=>columns.forEach(col=>{
    const a=usesX?item.x:col.group,b=isTwo?col.group:'';
    pushParsedValue(parsed,errors,seen,{a,b,parallel:col.parallel,technical:col.technical,value:item.row[col.c],rowNumber:item.r+1});
  }));
  const maxParallel=Math.max(1,...columns.map(c=>c.parallel)),maxTechnical=Math.max(1,...columns.map(c=>c.technical));
  const inferred=usesX?{
    factorALevelMode:'auto',factorAName:xHeader,factorALevels:xLevels,designType:isTwo?'two':'one',
    factorBName:isTwo?(state.design.factorBName||'组别'):'',factorBLevels:isTwo?groups:[''],parallelSamples:maxParallel,technicalRepeats:maxTechnical
  }:{
    factorALevelMode:'manual',factorAName:state.design.factorAName||'处理组',factorALevels:groups,designType:'one',factorBName:'',factorBLevels:[''],parallelSamples:maxParallel,technicalRepeats:maxTechnical
  };
  return {parsed,errors,layout:'grouped-parallel-auto-xlsx',inferred};
}
function parseFlatParallelWideRows(rows){
  if(!rows?.length)return null;
  const first=rows[0],keys=Object.keys(first),dataKeys=[];
  keys.forEach(key=>{
    const parts=String(key).split('__').map(x=>x.trim());
    if(parts.length<2)return;
    const parallel=parseIndexLabel(parts[1],'R');if(!parallel)return;
    dataKeys.push({key,group:parts[0],parallel,technical:parts[2]?parseIndexLabel(parts[2],'T')||1:1});
  });
  if(!dataKeys.length)return null;
  const d=state.design,type=state.workflow.chartType;
  const xKey=findNamedKey(first,d.factorAName)||findKey(first,['指标','因素a水平','factora','a','x'])||keys.find(k=>!dataKeys.some(d=>d.key===k)&&!['备注','note','notes'].includes(normalizeHeader(k)));
  if(!xKey)return null;
  const parsed=[],errors=[],seen=new Set();
  rows.forEach((row,i)=>dataKeys.forEach(col=>{
    const x=String(row[xKey]??'').trim(),a=d.designType==='two'?x:(type==='bar'?col.group:x),b=d.designType==='two'?col.group:'';
    pushParsedValue(parsed,errors,seen,{a,b,parallel:col.parallel,technical:col.technical,value:row[col.key],rowNumber:i+2});
  }));
  return {parsed,errors,layout:'grouped-parallel-csv'};
}

function processImported(rows,source){
  if(!Array.isArray(rows)||!rows.length){showValidation('error','没有识别到数据','文件为空或表头不正确。');return}
  const result=parseLongExperimentRows(rows)||parseFlatParallelWideRows(rows)||parseWideExperimentRows(rows);
  if(!result){showValidation('error','表头不符合当前模板','请使用平台生成的分组平行模板。第一层是实验条件，第二层是 R1、R2、R3 独立平行；只有存在技术重复时才有 T1、T2、T3。');return}
  finalizeImportedExperiment(result.parsed,result.errors,source,result.layout,result.inferred);
}
function finalizeImportedExperiment(parsed,errors,source,layout,inferred=null){
  if(!parsed.length){showValidation('error','没有有效测定值','请在各实验组的数据列中填写原始数字。');return}
  state.rawData=parsed;
  if(inferred){state.design={...state.design,...inferred};}
  const observedA=[...new Set(parsed.map(r=>r.a))],observedB=[...new Set(parsed.map(r=>r.b))];
  if(inferred?.factorAName)state.design.factorAName=inferred.factorAName;
  if(!state.design.factorALevels.length||!observedA.every(x=>state.design.factorALevels.includes(x)))state.design.factorALevels=observedA;
  if((state.workflow.chartType==='line'||state.workflow.chartType==='curve'||state.design.designType==='two'))state.design.factorALevelMode='auto';
  if(observedB.some(Boolean)){state.design.designType='two';state.design.factorBLevels=observedB;if(!state.design.factorBName)state.design.factorBName='因素 B'}else{state.design.designType='one';state.design.factorBLevels=['']}
  const perCell=new Map();parsed.forEach(r=>{const k=`${r.a}\u0001${r.b}`;if(!perCell.has(k))perCell.set(k,new Map());const samples=perCell.get(k);if(!samples.has(r.parallel))samples.set(r.parallel,new Set());samples.get(r.parallel).add(r.technical)});
  const sampleCounts=[...perCell.values()].map(m=>m.size),techCounts=[...perCell.values()].flatMap(m=>[...m.values()].map(v=>v.size));
  if(sampleCounts.length)state.design.parallelSamples=Math.max(...sampleCounts);if(techCounts.length)state.design.technicalRepeats=Math.max(...techCounts);
  fillDesignForm();renderDesignPreview();renderDataPreview();
  const independentCount=collapseTechnicalReplicates(parsed).length,unevenSamples=new Set(sampleCounts).size>1,unevenTechnical=new Set(techCounts).size>1,layoutName=layout.startsWith('grouped-parallel-auto')?'自动识别分组平行表':layout.startsWith('grouped-parallel')?'分组平行表':layout.startsWith('wide')?'旧版宽表':'兼容长表';
  if(errors.length)showValidation('warning',`已导入 ${parsed.length} 个有效值，但发现 ${errors.length} 个问题`,errors.slice(0,3).join('；'));
  else if(unevenSamples||unevenTechnical)showValidation('warning',`已导入 ${parsed.length} 个原始测定值`,`使用${layoutName}；共 ${independentCount} 个独立样品。${unevenSamples?'不同实验组合的平行样本数不一致。':''}${unevenTechnical?'部分样品的技术重复次数不一致。':''}`);
  else showValidation('success',`导入成功：${parsed.length} 个原始测定值`,`${layoutName} · ${independentCount} 个独立平行样本 · ${source} · 已从第一列识别 ${observedA.length} 个因素 A 水平${state.design.designType==='two'?` · ${observedB.length} 个因素 B 水平`:''}`);
  analyzeData();toast('数据已导入并完成初步分析');
}

function parseDelimited(text){
  const clean=String(text||'').replace(/^\ufeff/,'').trim(); if(!clean)return[];
  const lines=clean.split(/\r?\n/).filter(Boolean), sep=lines[0].includes('\t')?'\t':',';
  const matrix=lines.map(line=>sep==='\t'?line.split('\t'):parseCsvLine(line));
  const headers=matrix[0].map(x=>String(x).trim());
  return matrix.slice(1).map(row=>{const o={};headers.forEach((h,i)=>o[h]=row[i]??'');return o});
}
function parseCsvLine(line){let out=[],cur='',quote=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quote&&line[i+1]==='"'){cur+='"';i++}else quote=!quote}else if(c===','&&!quote){out.push(cur);cur=''}else cur+=c}out.push(cur);return out}

function loadRawDemo(){
  state.design=structuredClone(defaultDesign); fillDesignForm(); renderDesignPreview();
  const means={
    '0|4 °C':[75.1,.32],'0|-1 °C':[74.8,.30],'0|-18 °C':[74.5,.31],
    '2|4 °C':[75.8,.34],'2|-1 °C':[75.4,.32],'2|-18 °C':[75.0,.30],
    '4|4 °C':[76.6,.31],'4|-1 °C':[76.2,.33],'4|-18 °C':[75.8,.31],
    '6|4 °C':[77.4,.35],'6|-1 °C':[77.0,.32],'6|-18 °C':[76.6,.34],
    '8|4 °C':[78.4,.34],'8|-1 °C':[78.0,.33],'8|-18 °C':[77.5,.32],
    '10|4 °C':[79.6,.36],'10|-1 °C':[79.1,.34],'10|-18 °C':[78.6,.35]
  };
  const raw=[];let n=1;
  state.design.factorALevels.forEach(a=>state.design.factorBLevels.forEach(b=>{
    const [m,sd]=means[`${a}|${b}`],sampleMeans=[m-sd,m,m+sd],tCount=Math.max(1,state.design.technicalRepeats||1);
    sampleMeans.forEach((sampleMean,p)=>{const sampleId=`S${String(n++).padStart(3,'0')}`,noise=sd*.08;for(let t=1;t<=tCount;t++){const delta=tCount===1?0:noise*((t-1)/(tCount-1)*2-1);raw.push({sampleId,a,b,parallel:p+1,technical:t,rep:p+1,value:Number((sampleMean+delta).toFixed(4))})}});
  }));
  state.rawData=raw;renderDataPreview();showValidation('success',`演示数据已载入：${raw.length} 个原始值`,`已按 ${state.design.parallelSamples} 个独立平行${state.design.technicalRepeats>1?` × ${state.design.technicalRepeats} 次技术测定（${aggregationLabel()}）`:''}生成，共 ${collapseTechnicalReplicates(raw).length} 个独立样品。`);analyzeData();toast('已载入完整演示数据');
}

function renderDataPreview(){
  syncWorkflowControls();
  if(state.workflow.mode==='gallery'){
    const rows=state.gallery.rows,schema=currentWorkflowSchema(),headers=schema.columns;
    $('#dataPreviewMeta').textContent=`${rows.length} 行 · ${workflowChartLabel(state.workflow.chartType)} · ${schema.name}`;
    let html=`<thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>`;
    if(!rows.length)html+=`<tr><td colspan="${headers.length}" class="empty-row">尚未导入当前图形的数据模板</td></tr>`;
    rows.slice(0,250).forEach(r=>html+=`<tr>${headers.map(h=>`<td>${typeof r[h]==='number'?formatNumber(r[h],4):esc(r[h]??'')}</td>`).join('')}</tr>`);
    if(rows.length>250)html+=`<tr><td colspan="${headers.length}" class="empty-row">仅预览前 250 行，共 ${rows.length} 行</td></tr>`;
    $('#dataPreviewTable').innerHTML=html+'</tbody>';return;
  }
  const rows=state.rawData,independent=rows.length?collapseTechnicalReplicates(rows).length:0; $('#dataPreviewMeta').textContent=`${rows.length} 行原始数据 · ${independent} 个独立样品`;
  const cols=state.design.designType==='two'?7:6;
  let html='<thead><tr><th>样品编号</th><th>'+esc(state.design.factorAName)+'</th>'+(state.design.designType==='two'?`<th>${esc(state.design.factorBName)}</th>`:'')+'<th>平行样本</th><th>测定重复</th><th>'+esc(state.design.metricName)+(state.design.metricUnit?` (${esc(state.design.metricUnit)})`:'')+'</th></tr></thead><tbody>';
  if(!rows.length)html+=`<tr><td colspan="${cols}" class="empty-row">尚未导入数据</td></tr>`;
  rows.slice(0,250).forEach(r=>{html+=`<tr><td>${esc(r.sampleId)}</td><td>${esc(r.a)}</td>${state.design.designType==='two'?`<td>${esc(r.b)}</td>`:''}<td>${r.parallel??r.rep??1}</td><td>${r.technical??1}</td><td>${formatNumber(r.value,4)}</td></tr>`});
  if(rows.length>250)html+=`<tr><td colspan="${cols}" class="empty-row">仅预览前 250 行，共 ${rows.length} 行</td></tr>`;
  $('#dataPreviewTable').innerHTML=html+'</tbody>';
}

function showValidation(type,title,text){const p=$('#validationPanel');p.className=`validation-panel ${type}`;p.innerHTML=`<b>${esc(title)}</b><p>${esc(text)}</p>`}

function bindStatistics(){
  $('#runAnalysis').addEventListener('click',()=>{if(state.workflow.mode==='experiment')analyzeData();else analyzeGalleryData();renderStatistics();toast('统计结果已更新')});
  $('#goChart').addEventListener('click',()=>{state.chart.mode=state.workflow.mode;showView('chart')});
}

function analyzeData(){
  if(!state.rawData.length){state.analysisRows=[];state.descriptive=[];state.analysis=null;return null}
  state.analysisRows=collapseTechnicalReplicates(state.rawData);
  state.descriptive=descriptiveStats(state.analysisRows);
  state.analysis=state.design.designType==='two'?twoWayAnova(state.analysisRows):oneWayAnova(state.analysisRows,'a');
  prepareChartData();
  return state.analysis;
}

function collapseTechnicalReplicates(rows){
  const map=new Map(),method=state.design.technicalAggregation||'mean',selected=Math.max(1,Number(state.design.selectedTechnical)||1);
  rows.forEach((r,i)=>{
    const parallel=Number.isFinite(Number(r.parallel))?Number(r.parallel):(Number.isFinite(Number(r.rep))?Number(r.rep):i+1);
    const key=`${r.a}\u0001${r.b}\u0001${parallel}`;
    if(!map.has(key))map.set(key,{a:r.a,b:r.b,parallel,sampleId:r.sampleId||`P${parallel}`,entries:[]});
    map.get(key).entries.push({technical:Number(r.technical)||1,value:Number(r.value)});
  });
  return [...map.values()].map(x=>{
    x.entries.sort((a,b)=>a.technical-b.technical);const values=x.entries.map(e=>e.value);
    let value,fallback=false;
    if(method==='median')value=median(values);
    else if(method==='selected'){
      const found=x.entries.find(e=>e.technical===selected);if(found)value=found.value;else{value=mean(values);fallback=true}
    }else value=mean(values);
    return {a:x.a,b:x.b,parallel:x.parallel,rep:x.parallel,sampleId:x.sampleId,value,technicalN:values.length,technicalSd:sampleSd(values),technicalMethod:method,technicalFallback:fallback};
  });
}

function descriptiveStats(rows){
  const map=new Map(); rows.forEach(r=>{const key=`${r.a}\u0001${r.b}`;if(!map.has(key))map.set(key,[]);map.get(key).push(r)});
  return [...map.entries()].map(([key,samples])=>{const [a,b]=key.split('\u0001'),values=samples.map(r=>r.value),n=values.length,m=mean(values),sd=sampleSd(values),se=sd/Math.sqrt(n),ci=se*tCritical975(Math.max(1,n-1)),technicalCounts=samples.map(r=>r.technicalN||1),technicalLabel=new Set(technicalCounts).size===1?String(technicalCounts[0]):`${Math.min(...technicalCounts)}–${Math.max(...technicalCounts)}`;return{a,b,n,mean:m,sd,se,ci,cv:m===0?null:Math.abs(sd/m*100),values,technicalLabel}}).sort((x,y)=>levelIndex(x.a,state.design.factorALevels)-levelIndex(y.a,state.design.factorALevels)||levelIndex(x.b,state.design.factorBLevels)-levelIndex(y.b,state.design.factorBLevels));
}

function oneWayAnova(rows,key='a'){
  const groupsMap=new Map();rows.forEach(r=>{const g=r[key];if(!groupsMap.has(g))groupsMap.set(g,[]);groupsMap.get(g).push(r.value)});
  const groups=[...groupsMap.entries()].map(([label,values])=>({label,values,n:values.length,mean:mean(values)})), all=rows.map(r=>r.value), grand=mean(all);
  const ssBetween=groups.reduce((s,g)=>s+g.n*(g.mean-grand)**2,0), ssWithin=groups.reduce((s,g)=>s+g.values.reduce((q,v)=>q+(v-g.mean)**2,0),0);
  const df1=groups.length-1,df2=all.length-groups.length,ms1=ssBetween/df1,ms2=ssWithin/df2,F=ms1/ms2,p=fSurvival(F,df1,df2);
  return{kind:'one',balanced:new Set(groups.map(g=>g.n)).size===1,groups,grand,rows:[
    {source:state.design.factorAName,ss:ssBetween,df:df1,ms:ms1,F,p},
    {source:'误差',ss:ssWithin,df:df2,ms:ms2,F:null,p:null},
    {source:'总计',ss:ssBetween+ssWithin,df:all.length-1,ms:null,F:null,p:null}
  ],mse:ms2,dfError:df2,pMain:p};
}

function twoWayAnova(rows){
  const A=[...new Set(rows.map(r=>r.a))],B=[...new Set(rows.map(r=>r.b))],cell=new Map();
  if((state.workflow.chartType==='line'||state.workflow.chartType==='curve')&&A.length>250){
    return{kind:'two',balanced:false,continuous:true,rows:[],mse:null,dfError:null,message:`检测到 ${A.length} 个连续 X 水平。为避免把上千个时间点错误地当作分类水平并造成浏览器阻塞，初步分析不自动执行超大双因素 ANOVA；图形仍使用全部数据。需要正式推断时建议使用重复测量、混合效应或时间序列模型。`};
  }
  rows.forEach(r=>{const k=`${r.a}\u0001${r.b}`;if(!cell.has(k))cell.set(k,[]);cell.get(k).push(r.value)});
  const counts=[...cell.values()].map(v=>v.length),balanced=cell.size===A.length*B.length&&new Set(counts).size===1;
  if(!balanced)return{kind:'two',balanced:false,rows:[],mse:null,dfError:null,message:'当前双因素 ANOVA 要求每个因素组合具有相同重复数。描述统计仍可使用。'};
  const n=counts[0],all=rows.map(r=>r.value),grand=mean(all),meanA=new Map(),meanB=new Map(),meanCell=new Map();
  A.forEach(a=>meanA.set(a,mean(rows.filter(r=>r.a===a).map(r=>r.value))));
  B.forEach(b=>meanB.set(b,mean(rows.filter(r=>r.b===b).map(r=>r.value))));
  A.forEach(a=>B.forEach(b=>meanCell.set(`${a}\u0001${b}`,mean(cell.get(`${a}\u0001${b}`)))));
  const ssA=B.length*n*A.reduce((s,a)=>s+(meanA.get(a)-grand)**2,0);
  const ssB=A.length*n*B.reduce((s,b)=>s+(meanB.get(b)-grand)**2,0);
  let ssAB=0,sse=0;A.forEach(a=>B.forEach(b=>{const cm=meanCell.get(`${a}\u0001${b}`);ssAB+=n*(cm-meanA.get(a)-meanB.get(b)+grand)**2;cell.get(`${a}\u0001${b}`).forEach(v=>sse+=(v-cm)**2)}));
  const dfA=A.length-1,dfB=B.length-1,dfAB=dfA*dfB,dfE=A.length*B.length*(n-1),msA=ssA/dfA,msB=ssB/dfB,msAB=ssAB/dfAB,mse=sse/dfE;
  const FA=msA/mse,FB=msB/mse,FAB=msAB/mse,pA=fSurvival(FA,dfA,dfE),pB=fSurvival(FB,dfB,dfE),pAB=fSurvival(FAB,dfAB,dfE);
  return{kind:'two',balanced:true,A,B,n,grand,mse,dfError:dfE,pA,pB,pAB,rows:[
    {source:state.design.factorAName,ss:ssA,df:dfA,ms:msA,F:FA,p:pA},
    {source:state.design.factorBName,ss:ssB,df:dfB,ms:msB,F:FB,p:pB},
    {source:`${state.design.factorAName} × ${state.design.factorBName}`,ss:ssAB,df:dfAB,ms:msAB,F:FAB,p:pAB},
    {source:'误差',ss:sse,df:dfE,ms:mse,F:null,p:null},
    {source:'总计',ss:ssA+ssB+ssAB+sse,df:all.length-1,ms:null,F:null,p:null}
  ]};
}

function renderStatistics(){
  if(state.workflow.mode==='gallery'){renderGalleryWorkflowStatistics();return}
  const d=state.design,a=state.analysis,desc=state.descriptive;
  $('#statsDesignLine').textContent=`${d.experimentName} · ${d.metricName}${d.metricUnit?` (${d.metricUnit})`:''} · ${d.designType==='two'?`${d.factorAName} × ${d.factorBName}`:d.factorAName} · ${d.parallelSamples} 个独立平行${d.technicalRepeats>1?` × ${d.technicalRepeats} 次技术测定（${aggregationLabel(d)}）`:''} · ${workflowChartLabel(state.workflow.chartType)}`;
  $('#summaryCards').innerHTML=[
    ['原始测定值',state.rawData.length||'—'],['独立平行样本',state.analysisRows.length||'—'],['实验组合',desc.length||'—'],['分析模型',!a?'—':a.continuous?'连续趋势摘要':a.kind==='two'?'双因素 ANOVA':'单因素 ANOVA']
  ].map(([n,v])=>`<div class="summary-card"><span>${n}</span><b>${v}</b></div>`).join('');
  renderDescriptiveTable();renderAnovaTable();renderInterpretation();
}
function renderGalleryWorkflowStatistics(){
  state.gallery.type=state.workflow.chartType;analyzeGalleryData();
  const def=galleryDef(),schema=gallerySchema(),a=state.gallery.analysis;
  $('#statsDesignLine').textContent=`${state.design.experimentName} · ${def.name} · ${schema.name} · 初步分析`;
  const summary=a?.summary||[['数据行',state.gallery.rows.length],['图形',def.name],['模板',schema.name],['状态',state.gallery.rows.length?'已分析':'待导入']];
  $('#summaryCards').innerHTML=summary.slice(0,4).map(([n,v])=>`<div class="summary-card"><span>${esc(n)}</span><b>${esc(v)}</b></div>`).join('');
  let table=a?.table;
  if(a?.kind==='matrix')table=a.vars.map(v=>({Indicator:v,...Object.fromEntries(a.vars.map(w=>[w,a.corr[v][w]]))}));
  if(table?.length){const headers=Object.keys(table[0]);$('#descriptiveTable').innerHTML=`<thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${table.map(r=>`<tr>${headers.map(h=>`<td>${typeof r[h]==='number'?formatNumber(r[h],4):esc(r[h])}</td>`).join('')}</tr>`).join('')}</tbody>`}
  else $('#descriptiveTable').innerHTML='<tbody><tr><td class="empty-row">请先导入当前图形模板数据</td></tr></tbody>';
  if(a?.kind==='univariate'&&a.anova){
    $('#anovaMethodText').innerHTML=`当前方法：<b>${esc(a.methodName||statisticalMethodLabel())}</b>。 <label class="inline-method-select">切换方法 <select id="statsMethodSelect"><option value="anovaLsd" ${state.gallery.settings.statMethod==='anovaLsd'?'selected':''}>ANOVA + Fisher LSD</option><option value="welchHolm" ${state.gallery.settings.statMethod==='welchHolm'?'selected':''}>Welch ANOVA + Holm</option><option value="kruskalHolm" ${state.gallery.settings.statMethod==='kruskalHolm'?'selected':''}>Kruskal–Wallis + Holm</option></select></label> 不同假设和校正方式会改变结果。`;
    const rows=a.pairwise||[];
    $('#anovaTable').innerHTML=`<thead><tr><th>两两比较</th><th>差值</th><th>统计量</th><th>原始 p</th><th>报告 p</th><th>标记</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.a)} vs ${esc(r.b)}</td><td>${formatNumber(r.meanDiff,4)}</td><td>${Number.isFinite(r.t)?`t=${formatNumber(r.t,3)}`:Number.isFinite(r.U)?`U=${formatNumber(r.U,2)}`:'—'}</td><td>${formatP(r.pRaw??r.p)}</td><td>${formatP(r.p)}</td><td>${r.stars}</td></tr>`).join('')||'<tr><td colspan="6" class="empty-row">至少需要两个组</td></tr>'}</tbody>`;
  }else{
    const methodRows=galleryMethodRows(def.id);
    const corrControl=['scatter','bubble','heatmap'].includes(def.id)?` <label class="inline-method-select">相关方法 <select id="statsCorrelationMethod"><option value="pearson" ${state.gallery.settings.correlationMethod==='pearson'?'selected':''}>Pearson</option><option value="spearman" ${state.gallery.settings.correlationMethod==='spearman'?'selected':''}>Spearman</option></select></label>`:'';$('#anovaMethodText').innerHTML='当前页面完成与图形对应的初步分析；条件不足时不会自动给出显著性结论。'+corrControl;
    $('#anovaTable').innerHTML=`<thead><tr><th>建议分析</th><th>用途</th><th>当前状态</th></tr></thead><tbody>${methodRows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody>`;
  }
  const methodSelect=$('#statsMethodSelect');if(methodSelect)methodSelect.addEventListener('change',e=>{state.gallery.settings.statMethod=e.target.value;renderGalleryWorkflowStatistics()});
  const corrSelect=$('#statsCorrelationMethod');if(corrSelect)corrSelect.addEventListener('change',e=>{state.gallery.settings.correlationMethod=e.target.value;renderGalleryWorkflowStatistics()});
  const box=$('#interpretationText');box.className=a?'interpretation':'interpretation empty';box.innerHTML=a?`<p>${esc(a.text||'已完成初步分析。')}</p><p class="small-note">该结果已与“${def.name}”绑定，下一步进入论文图工作台后继续编辑。</p>`:'暂无可解释结果。';
}
function galleryMethodRows(type){
  if(['box','violin'].includes(type))return[['箱线统计定义','可选 R type 7、Tukey hinges、Excel EXC 与多种须线规则','已接入'],['参数检验','单因素 ANOVA + Fisher LSD；Welch ANOVA + Holm','已接入'],['非参数检验','Kruskal–Wallis + Mann–Whitney U（Holm）','已接入']];
  if(['hist','kde'].includes(type))return[['描述统计','n、均值、标准差、中位数、四分位数和异常值','已接入'],['组间检验','正态性与方差齐性后选择 ANOVA 或非参数检验','可在箱线图/小提琴图中使用']];
  if(['scatter','bubble'].includes(type))return[['Pearson 相关','衡量线性相关程度','已接入'],['Spearman 相关','适合单调关系、非正态或秩数据','已接入'],['线性回归','普通最小二乘斜率、截距和 R²','已接入']];
  if(type==='heatmap')return[['Pearson 相关矩阵','多指标线性相关','已接入'],['Spearman 矩阵','多指标秩相关','已接入'],['色阶与数值','自定义低值、中值、高值与对角线颜色','已接入']];
  if(type==='radar')return[['归一化','不同量纲指标统一尺度','已接入'],['综合评分','权重与综合评价','待后续增强']];
  if(['stacked','pie'].includes(type))return[['构成比例','类别总量和组分百分比','已接入'],['组成差异检验','比较不同类别构成差异','待后续增强']];
  return[['描述统计','基础数据概览','已接入']];
}

function renderDescriptiveTable(){
  const d=state.design,cols=d.designType==='two'?9:8;let html=`<thead><tr><th>${esc(d.factorAName)}</th>${d.designType==='two'?`<th>${esc(d.factorBName)}</th>`:''}<th>n（独立样本）</th><th>每样品测定次数</th><th>Mean</th><th>SD</th><th>SE</th><th>CV (%)</th><th>95% CI</th></tr></thead><tbody>`;
  if(!state.descriptive.length)html+=`<tr><td colspan="${cols}" class="empty-row">请先导入原始数据</td></tr>`;
  const displayLimit=300,displayRows=state.descriptive.slice(0,displayLimit);
  displayRows.forEach(r=>html+=`<tr><td>${esc(r.a)}</td>${d.designType==='two'?`<td>${esc(r.b)}</td>`:''}<td>${r.n}</td><td>${r.technicalLabel}</td><td>${formatNumber(r.mean,4)}</td><td>${formatNumber(r.sd,4)}</td><td>${formatNumber(r.se,4)}</td><td>${r.cv==null?'—':formatNumber(r.cv,2)}</td><td>${formatNumber(r.mean-r.ci,4)}–${formatNumber(r.mean+r.ci,4)}</td></tr>`);
  if(state.descriptive.length>displayLimit)html+=`<tr><td colspan="${cols}" class="empty-row">为保证大数据页面流畅，仅显示前 ${displayLimit} 个实验组合；绘图和计算仍使用全部 ${state.descriptive.length} 个组合。</td></tr>`;
  $('#descriptiveTable').innerHTML=html+'</tbody>';
}

function renderAnovaTable(){
  const a=state.analysis;$('#anovaMethodText').textContent=(state.design.designType==='two'?'平衡设计双因素 ANOVA，含交互作用。':'单因素 ANOVA。')+` 同一样品的技术测定按“${aggregationLabel()}”汇总，R1、R2、R3 等独立平行作为统计单元。`;
  let html='<thead><tr><th>变异来源</th><th>SS</th><th>df</th><th>MS</th><th>F</th><th>p</th></tr></thead><tbody>';
  if(!a)html+='<tr><td colspan="6" class="empty-row">暂无统计结果</td></tr>';
  else if(!a.balanced&&a.kind==='two')html+=`<tr><td colspan="6" class="empty-row">${esc(a.message)}</td></tr>`;
  else a.rows.forEach(r=>html+=`<tr><td>${esc(r.source)}</td><td>${formatNumber(r.ss,5)}</td><td>${r.df}</td><td>${r.ms==null?'—':formatNumber(r.ms,5)}</td><td>${r.F==null?'—':formatNumber(r.F,3)}</td><td>${r.p==null?'—':formatP(r.p)}</td></tr>`);
  $('#anovaTable').innerHTML=html+'</tbody>';
}

function renderInterpretation(){
  const box=$('#interpretationText'),a=state.analysis,d=state.design;if(!a){box.className='interpretation empty';box.textContent='暂无可解释结果。';return}
  const paragraphs=[];
  if(a.kind==='one'){
    const sorted=state.descriptive.slice().sort((x,y)=>levelIndex(x.a,d.factorALevels)-levelIndex(y.a,d.factorALevels)),first=sorted[0],last=sorted[sorted.length-1],change=last.mean-first.mean;
    paragraphs.push(`${d.metricName} 在 ${d.factorAName} 的各水平间${a.pMain<.05?'存在统计学差异':'未检出统计学差异'}（${formatPText(a.pMain)}）。`);
    if(first&&last)paragraphs.push(`从 ${first.a} 到 ${last.a}，均值由 ${formatNumber(first.mean,3)} 变化到 ${formatNumber(last.mean,3)}，总体${change>0?'上升':change<0?'下降':'基本不变'} ${formatNumber(Math.abs(change),3)}${d.metricUnit?` ${d.metricUnit}`:''}。`);
  }else if(!a.balanced)paragraphs.push(a.message);
  else{
    paragraphs.push(`${d.factorAName} 主效应${a.pA<.05?'显著':'不显著'}（${formatPText(a.pA)}），${d.factorBName} 主效应${a.pB<.05?'显著':'不显著'}（${formatPText(a.pB)}）。`);
    paragraphs.push(`两因素交互作用${a.pAB<.05?'显著':'不显著'}（${formatPText(a.pAB)}）${a.pAB<.05?'，说明一个因素的影响会随另一个因素水平而变化，因此应优先比较各组合的简单效应。':'，在当前数据下两因素的变化模式较为一致。'}`);
    d.factorBLevels.forEach(b=>{const series=state.descriptive.filter(r=>r.b===b).sort((x,y)=>levelIndex(x.a,d.factorALevels)-levelIndex(y.a,d.factorALevels));if(series.length>1){const c=series.at(-1).mean-series[0].mean;paragraphs.push(`${b} 条件下，${d.metricName} 从 ${series[0].a} 到 ${series.at(-1).a} 总体${c>0?'增加':c<0?'降低':'保持稳定'} ${formatNumber(Math.abs(c),3)}${d.metricUnit?` ${d.metricUnit}`:''}。`)}});
  }
  box.className='interpretation';box.innerHTML=paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')+'<p class="small-note">以上文字为自动辅助解读。统计 n 指独立平行样本数；同一样品的重复测定仅用于获得该样品均值，不替代独立样本。</p>';
}

function bindChartUi(){
  $$('[data-chart-type]').forEach(btn=>btn.addEventListener('click',()=>{state.chart.type=btn.dataset.chartType;state.workflow.chartType=state.chart.type;state.workflow.mode='experiment';state.chart.mode='experiment';syncWorkflowControls();if(state.chart.type==='curve'&&['error','letters'].includes(state.chart.selected))state.chart.selected='series';autoScaleChart();renderChartStudio()}));
  $('#toggleBreak').addEventListener('click',()=>{state.chart.breakAxis=!state.chart.breakAxis;if(state.chart.breakAxis)autoBreakScale();renderChartStudio()});
  $('#autoScale').addEventListener('click',()=>{autoScaleChart();if(state.chart.breakAxis)autoBreakScale();renderChartStudio();toast('坐标范围已自动优化')});
  $('#journalTemplate').addEventListener('change',e=>{if(state.chart.mode==='gallery'){const t=templates[e.target.value]||templates.foodchem;state.gallery.settings.fontEnglish=t.fontEnglish;state.gallery.settings.fontChinese=t.fontChinese;state.gallery.settings.axisWidth=t.axis;state.gallery.settings.frameWidth=Math.max(1,t.axis-.1);state.gallery.palette=[...t.colors];state.gallery.seriesStyles={}}else applyTemplate(e.target.value);renderChartStudio()});
  $('#xFactorSelect').addEventListener('change',e=>{state.chart.xFactor=e.target.value;prepareChartData();autoScaleChart();renderChartStudio()});
  $('#refreshChart').addEventListener('click',()=>{analyzeData();prepareChartData();autoScaleChart();renderChartStudio();toast('图表已按当前统计结果更新')});
  $('#exportSvg').addEventListener('click',exportSvg);$('#exportPng').addEventListener('click',exportPng);
  $('#addChartText')?.addEventListener('click',()=>addChartAnnotation('text'));
  $('#addChartArrow')?.addEventListener('click',()=>addChartAnnotation('arrow'));
  $('#addPeakLabel')?.addEventListener('click',()=>addChartAnnotation('peak'));
  $('#addGuideLine')?.addEventListener('click',()=>addChartAnnotation('guide'));
  ['togglePropertiesPanel','propertiesPanelDockToggle'].forEach(id=>$('#'+id)?.addEventListener('click',()=>setPropertiesPanelCollapsed(!$('#view-chart').classList.contains('properties-collapsed'))));
  const quickMap={quickEnglishFont:'fontEnglish',quickChineseFont:'fontChinese',quickFontWeight:'globalFontWeight',quickCanvasPreset:'panelPreset',quickDpi:'pngDpi'};
  Object.entries(quickMap).forEach(([id,key])=>{const el=$('#'+id);if(el)el.addEventListener('change',()=>{
    let v=el.value;
    if(state.chart.mode==='gallery'){
      const gs=state.gallery.settings;
      if(key==='fontEnglish')gs.fontEnglish=v;
      else if(key==='fontChinese')gs.fontChinese=v;
      else if(key==='globalFontWeight')gs.globalFontWeight=Number(v);
      else if(key==='pngDpi')gs.dpi=Number(v);
      else if(key==='panelPreset'){gs.panelPreset=v;applyGalleryCanvasPreset(v)}
    }else{
      if(['globalFontWeight','pngDpi'].includes(key))v=Number(v);state.chart.settings[key]=v;if(key==='panelPreset')applyCanvasPreset(v)
    }
    renderChartStudio();
  })});
  [['quickCanvasWidth','canvasWidth'],['quickCanvasHeight','canvasHeight']].forEach(([id,key])=>{const el=$('#'+id);if(el)el.addEventListener('change',()=>{if(state.chart.mode==='gallery'){state.gallery.settings[key==='canvasWidth'?'width':'height']=Number(el.value)}else{const s=state.chart.settings;setCanvasSize(key==='canvasWidth'?Number(el.value):s.canvasWidth,key==='canvasHeight'?Number(el.value):s.canvasHeight);s.panelPreset='custom'}renderChartStudio()})});
  [['quickTitleVisible','titleVisible'],['quickXTitleVisible','xTitleVisible'],['quickYTitleVisible','yTitleVisible']].forEach(([id,key])=>{const el=$('#'+id);if(el)el.addEventListener('change',()=>{const s=state.chart.mode==='gallery'?state.gallery.settings:state.chart.settings;s[key]=el.checked;renderChartStudio()})});
}

function setPropertiesPanelCollapsed(collapsed){
  const view=$('#view-chart');if(!view)return;
  view.classList.toggle('properties-collapsed',collapsed);
  const inner=$('#togglePropertiesPanel'),dock=$('#propertiesPanelDockToggle');
  if(inner)inner.textContent=collapsed?'展开':'收起';
  if(dock){dock.textContent=collapsed?'属性栏：关（点击打开）':'属性栏：开';dock.classList.toggle('properties-panel-toggle-active',!collapsed)}
}


function currentAnnotationState(){return state.chart.mode==='gallery'?state.gallery:state.chart}
function currentAnnotationCanvas(){return state.chart.mode==='gallery'?{W:Number(state.gallery.settings.width)||980,H:Number(state.gallery.settings.height)||660}:chartDimensions()}
function annotationById(id){return currentAnnotationState().annotations.find(a=>a.id===id)}
function makeAnnotationId(){return`ann_${Date.now()}_${Math.random().toString(36).slice(2,7)}`}
function addChartAnnotation(type){
  const store=currentAnnotationState(),{W,H}=currentAnnotationCanvas();let ann={id:makeAnnotationId(),type,color:'#20262b',width:1.2,dash:'',fontSize:13,fontWeight:400,fontFamily:'inherit'};
  if(type==='text')Object.assign(ann,{text:'说明文字',x:W*.56,y:H*.18,anchor:'middle',background:'#ffffff',backgroundOpacity:.9,padding:7,borderColor:'#b8c5c0',borderWidth:1,cornerRadius:4});
  else if(type==='arrow')Object.assign(ann,{x1:W*.36,y1:H*.28,x2:W*.52,y2:H*.42,text:'',arrowEnd:true});
  else if(type==='guide')Object.assign(ann,{orientation:'vertical',x:W*.55,y:H*.45,x1:W*.55,y1:H*.16,x2:W*.55,y2:H*.78,dash:'6 5',text:'',arrowEnd:false});
  else if(type==='peak'){
    if(state.chart.mode==='experiment'&&!isLineLike()){toast('峰值标注适用于折线图或平滑曲线图');return}
    if(state.chart.mode==='gallery'&&!['scatter','bubble','kde'].includes(state.gallery.type)){toast('当前图形暂不支持自动峰值识别，可使用文字和箭头手动标注');return}
    const peak=findCurrentPeak();if(!peak){toast('没有可标注的数据点');return}
    Object.assign(ann,{type:'peak',series:peak.series,dataX:peak.x,dataY:peak.y,label:peak.label,dx:24,dy:-34,showX:true,showY:false,decimals:0,guide:'none',arrowEnd:true});
  }
  store.annotations.push(ann);store.selectedAnnotation=ann.id;store.selected=`annotation:${ann.id}`;
  renderChartStudio();toast(type==='arrow'?'已添加箭头：拖动“起”“终”两个圆点改变方向和长度':type==='peak'?'已添加峰值标注':'已添加标注对象');
}
function findCurrentPeak(){
  if(state.chart.mode==='experiment'){
    const groups=chartGroups(),series=clamp(Number(state.chart.selectedSeries)||0,0,Math.max(0,groups.length-1)),group=groups[series],rows=state.chartData.filter(d=>d.group===group&&Number.isFinite(d.mean));if(!rows.length)return null;
    const p=rows.reduce((a,b)=>b.mean>a.mean?b:a);return{series,x:p.x,y:p.mean,label:formatPeakLabel(p.x,p.mean)};
  }
  const rows=state.gallery.rows,type=state.gallery.type;
  if(type==='kde'){const values=rows.map(r=>r.Value).filter(Number.isFinite);if(!values.length)return null;const min=Math.min(...values),max=Math.max(...values),curve=kdeFor(values,min,max,160,state.gallery.settings.bandwidth),p=curve.reduce((a,b)=>b[1]>a[1]?b:a);return{series:0,x:p[0],y:p[1],label:formatPeakLabel(p[0],p[1])}}
  const usable=rows.filter(r=>Number.isFinite(r.X)&&Number.isFinite(r.Y));if(!usable.length)return null;const p=usable.reduce((a,b)=>b.Y>a.Y?b:a);return{series:Math.max(0,[...new Set(rows.map(r=>r.Group))].indexOf(p.Group)),x:p.X,y:p.Y,label:formatPeakLabel(p.X,p.Y)};
}
function formatPeakLabel(x,y){return Number.isFinite(Number(x))?formatNumber(Number(x),2):String(x)}
function removeSelectedAnnotation(){const store=currentAnnotationState(),id=store.selectedAnnotation;if(!id)return;store.annotations=store.annotations.filter(a=>a.id!==id);store.selectedAnnotation=null;store.selected='title';renderChartStudio();toast('标注已删除')}
function annotationFontStack(ann){if(ann.fontFamily&&ann.fontFamily!=='inherit')return ann.fontFamily;return state.chart.mode==='gallery'?galleryFontStack():fontStack()}
function arrowEndpointHandleMarkup({id,x,y,endpoint,compose=false}){
  const isStart=endpoint==='start',label=isStart?'起':'终',fill=isStart?'#ffffff':'#f28e2b',stroke=isStart?'#0d6b55':'#b65700';
  const handleAttr=compose?`data-compose-arrow-handle="${endpoint}" data-compose-annotation-id="${id}"`:`data-annotation-handle="${endpoint}" data-annotation-id="${id}"`;
  return `<g class="annotation-endpoint-control ${endpoint}" ${handleAttr} transform="translate(${x} ${y})" style="pointer-events:all;cursor:grab;touch-action:none"><title>${isStart?'拖动箭头起点':'拖动箭头终点'}</title><circle class="annotation-handle-halo" r="12" fill="#ffffff" fill-opacity=".92" stroke="#ffffff" stroke-width="4" vector-effect="non-scaling-stroke"/><circle class="annotation-edit-handle ${endpoint}" r="7.5" fill="${fill}" stroke="${stroke}" stroke-width="2.2" vector-effect="non-scaling-stroke"/><text class="annotation-handle-label" x="0" y="3.2" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="${isStart?'#0d6b55':'#ffffff'}" pointer-events="none">${label}</text></g>`;
}
function genericAnnotationSvg(ann,interactive=true){
  const cls=interactive?'chart-object draggable':'',objAttr=state.chart.mode==='gallery'?`data-gobject="annotation:${ann.id}" data-gannotation-id="${ann.id}" data-gdrag="annotation"`:`data-object="annotation" data-annotation-id="${ann.id}" data-drag="annotation"`;
  if(ann.type==='text'){
    const approx=Math.max(24,String(ann.text||'').length*ann.fontSize*.62+(ann.padding||0)*2),h=ann.fontSize*1.35+(ann.padding||0)*2;
    return `<g ${objAttr} class="${cls}" transform="translate(${ann.x} ${ann.y})"><rect x="${-approx/2}" y="${-h+ann.fontSize*.35}" width="${approx}" height="${h}" rx="${ann.cornerRadius??4}" fill="${ann.background||'#fff'}" fill-opacity="${ann.backgroundOpacity??0}" stroke="${ann.borderColor||'none'}" stroke-width="${ann.borderWidth||0}"/><text text-anchor="${ann.anchor||'middle'}" font-family="${escAttr(annotationFontStack(ann))}" font-size="${ann.fontSize}" font-weight="${ann.fontWeight}" fill="${ann.color}">${esc(ann.text||'')}</text></g>`;
  }
  if(ann.type==='arrow'||ann.type==='guide'){
    const marker=ann.arrowEnd!==false?' marker-end="url(#chartAnnotationArrow)"':'';
    const mx=(ann.x1+ann.x2)/2,my=(ann.y1+ann.y2)/2;
    const txt=ann.text?`<text data-ann-label x="${mx}" y="${my-8}" text-anchor="middle" font-family="${escAttr(annotationFontStack(ann))}" font-size="${ann.fontSize}" font-weight="${ann.fontWeight}" fill="${ann.color}">${esc(ann.text)}</text>`:'';
    const handles=interactive?`${arrowEndpointHandleMarkup({id:ann.id,x:ann.x1,y:ann.y1,endpoint:'start'})}${arrowEndpointHandleMarkup({id:ann.id,x:ann.x2,y:ann.y2,endpoint:'end'})}`:'';
    return `<g ${objAttr} class="${cls}"><line class="annotation-hit-line" data-ann-hit x1="${ann.x1}" y1="${ann.y1}" x2="${ann.x2}" y2="${ann.y2}"/><line data-ann-line x1="${ann.x1}" y1="${ann.y1}" x2="${ann.x2}" y2="${ann.y2}" stroke="${ann.color}" stroke-width="${ann.width}" ${ann.dash?`stroke-dasharray="${ann.dash}"`:''}${marker}/>${txt}${handles}</g>`;
  }
  return'';
}
function renderGenericAnnotations(store,interactive=true){return(store.annotations||[]).filter(a=>a.type!=='peak').map(a=>genericAnnotationSvg(a,interactive)).join('')}
function experimentPeakSvg(ann,M,plotW,plotH,xvals,b){
  const idx=xvals.findIndex(v=>String(v)===String(ann.dataX));if(idx<0)return'';const xx=experimentXPosition(ann.dataX,idx,xvals,M,plotW),yy=M.t+(b.max-ann.dataY)/(b.max-b.min||1)*plotH,tx=xx+(ann.dx||24),ty=yy+(ann.dy||-34),label=peakAnnotationLabel(ann),guide=ann.guide==='vertical'?`<line x1="${xx}" y1="${yy}" x2="${xx}" y2="${M.t+plotH}" stroke="${ann.color}" stroke-width="${ann.width}" stroke-dasharray="${ann.dash||'6 5'}"/>`:ann.guide==='horizontal'?`<line x1="${M.l}" y1="${yy}" x2="${xx}" y2="${yy}" stroke="${ann.color}" stroke-width="${ann.width}" stroke-dasharray="${ann.dash||'6 5'}"/>`:'';
  return `<g data-object="annotation" data-annotation-id="${ann.id}" data-drag="annotation" class="chart-object draggable">${guide}<line x1="${tx}" y1="${ty+4}" x2="${xx}" y2="${yy}" stroke="${ann.color}" stroke-width="${ann.width}" marker-end="url(#chartAnnotationArrow)"/><text x="${tx}" y="${ty}" text-anchor="middle" font-family="${escAttr(annotationFontStack(ann))}" font-size="${ann.fontSize}" font-weight="${ann.fontWeight}" fill="${ann.color}">${esc(label)}</text></g>`;
}
function peakAnnotationLabel(ann){const d=ann.decimals==='auto'?2:Number(ann.decimals)||0,parts=[];if(ann.showX!==false)parts.push(Number.isFinite(Number(ann.dataX))?Number(ann.dataX).toFixed(d).replace(/\.0+$/,''):String(ann.dataX));if(ann.showY)parts.push(Number(ann.dataY).toFixed(d).replace(/\.0+$/,''));return ann.customLabel||parts.join(', ')||ann.label||''}
function renderExperimentAnnotations(M,plotW,plotH,xvals,b){return renderGenericAnnotations(state.chart,true)+state.chart.annotations.filter(a=>a.type==='peak').map(a=>experimentPeakSvg(a,M,plotW,plotH,xvals,b)).join('')}
function galleryPeakSvg(ann,W,H){
  const p=galleryPlotBox(W,H),type=state.gallery.type;let xx,yy;
  if(['scatter','bubble'].includes(type)){const rows=state.gallery.rows,xs=rows.map(r=>r.X).filter(Number.isFinite),ys=rows.map(r=>r.Y).filter(Number.isFinite),xp=(Math.max(...xs)-Math.min(...xs)||1)*.08,yp=(Math.max(...ys)-Math.min(...ys)||1)*.1,xMap=scaleLinear(Math.min(...xs)-xp,Math.max(...xs)+xp,p.l,p.l+p.w),yMap=scaleLinear(Math.min(...ys)-yp,Math.max(...ys)+yp,p.t+p.h,p.t);xx=xMap(ann.dataX);yy=yMap(ann.dataY)}else if(type==='kde'){const vals=state.gallery.rows.map(r=>r.Value).filter(Number.isFinite),pad=(Math.max(...vals)-Math.min(...vals)||1)*.08,min=Math.min(...vals)-pad,max=Math.max(...vals)+pad,curve=kdeFor(vals,min,max,120,state.gallery.settings.bandwidth),ymax=Math.max(...curve.map(q=>q[1])),xMap=scaleLinear(min,max,p.l,p.l+p.w),yMap=scaleLinear(0,ymax,p.t+p.h,p.t);xx=xMap(ann.dataX);yy=yMap(ann.dataY)}else return'';
  const tx=xx+(ann.dx||24),ty=yy+(ann.dy||-34);return `<g data-gobject="annotation:${ann.id}" data-gannotation-id="${ann.id}" data-gdrag="annotation" class="chart-object draggable"><line x1="${tx}" y1="${ty+4}" x2="${xx}" y2="${yy}" stroke="${ann.color}" stroke-width="${ann.width}" marker-end="url(#chartAnnotationArrow)"/><text x="${tx}" y="${ty}" text-anchor="middle" font-size="${ann.fontSize}" font-weight="${ann.fontWeight}" fill="${ann.color}">${esc(peakAnnotationLabel(ann))}</text></g>`;
}
function renderGalleryAnnotations(W,H,interactive=true){return renderGenericAnnotations(state.gallery,interactive)+state.gallery.annotations.filter(a=>a.type==='peak').map(a=>galleryPeakSvg(a,W,H)).join('')}

function prepareChartData(){
  if(!state.descriptive.length&&state.rawData.length)analyzeData();
  const d=state.design,xFactor=state.chart.xFactor,rows=[];
  if(d.designType==='one'){
    const letterInput=state.descriptive.map(r=>({label:r.a,mean:r.mean,n:r.n}));
    const letters=(state.chart.type==='curve'||state.analysis?.continuous||state.descriptive.length>250)?{}:lettersForComparisons(letterInput,state.analysis?.mse,state.analysis?.dfError);
    state.descriptive.forEach(r=>rows.push({x:r.a,group:d.metricName,mean:r.mean,error:errorValue(r),letter:letters[r.a]||''}));
  }else{
    const xLevels=xFactor==='A'?d.factorALevels:d.factorBLevels,groupLevels=xFactor==='A'?d.factorBLevels:d.factorALevels;
    const descIndex=new Map(state.descriptive.map(r=>[`${String(r.a)}${String(r.b)}`,r]));
    xLevels.forEach(x=>{
      const comps=[];
      groupLevels.forEach(g=>{
        const r=descIndex.get(xFactor==='A'?`${String(x)}${String(g)}`:`${String(g)}${String(x)}`);
        if(r)comps.push({label:g,mean:r.mean,n:r.n,row:r});
      });
      const letters=(state.chart.type==='curve'||state.analysis?.continuous||xLevels.length>250)?{}:lettersForComparisons(comps,state.analysis?.mse,state.analysis?.dfError);
      comps.forEach(c=>rows.push({x,group:c.label,mean:c.mean,error:errorValue(c.row),letter:letters[c.label]||''}));
    });
  }
  state.chartData=rows;invalidateChartModel();syncChartText();
}

function errorValue(r){return state.design.errorType==='se'?r.se:state.design.errorType==='ci'?r.ci:r.sd}

function lettersForComparisons(items,mse,df){
  const out={};if(!items.length)return out;if(items.length===1){out[items[0].label]='a';return out}
  if(!Number.isFinite(mse)||mse<=0||!Number.isFinite(df)){items.forEach(i=>out[i.label]='a');return out}
  const tcrit=tCritical975(df), sig=Array.from({length:items.length},()=>Array(items.length).fill(false));
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const lsd=tcrit*Math.sqrt(mse*(1/items[i].n+1/items[j].n));sig[i][j]=sig[j][i]=Math.abs(items[i].mean-items[j].mean)>lsd}
  const sorted=items.map((it,i)=>({...it,original:i})).sort((a,b)=>b.mean-a.mean), sortedSig=sorted.map(a=>sorted.map(b=>sig[a.original][b.original]));
  const letters=compactLetterDisplay(sorted.map(x=>x.label),sortedSig);Object.assign(out,letters);return out;
}

function compactLetterDisplay(labels,sig){
  let cols=[new Set(labels.map((_,i)=>i))];
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)if(sig[i][j]){
    const next=[];cols.forEach(set=>{if(set.has(i)&&set.has(j)){const a=new Set(set),b=new Set(set);a.delete(i);b.delete(j);next.push(a,b)}else next.push(set)});cols=absorbSets(next);
  }
  cols.sort((a,b)=>Math.min(...a)-Math.min(...b));const out={};labels.forEach(l=>out[l]='');cols.forEach((set,idx)=>{const letter=indexLetter(idx);set.forEach(i=>out[labels[i]]+=letter)});return out;
}
function absorbSets(sets){
  const uniq=[];sets.filter(s=>s.size).forEach(s=>{if(!uniq.some(u=>sameSet(u,s)))uniq.push(s)});
  return uniq.filter((s,i)=>!uniq.some((u,j)=>i!==j&&isSubset(s,u)));
}
function sameSet(a,b){return a.size===b.size&&[...a].every(x=>b.has(x))}function isSubset(a,b){return a.size<=b.size&&[...a].every(x=>b.has(x))}
function indexLetter(i){let s='';do{s=String.fromCharCode(97+i%26)+s;i=Math.floor(i/26)-1}while(i>=0);return s}

function syncChartText(){
  const d=state.design,s=state.chart.settings;
  if(!s.title||s.title==='Moisture content')s.title=d.metricName;
  s.xTitle=state.chart.xFactor==='A'?d.factorAName:(d.factorBName||d.factorAName);
  s.yTitle=d.metricName+(d.metricUnit?` (${d.metricUnit})`:'');
}

function autoScaleChart(){
  const s=state.chart.settings,vals=(state.chart.type==='curve'?state.chartData.map(d=>d.mean):state.chartData.flatMap(d=>[d.mean-d.error,d.mean+d.error])).filter(Number.isFinite);if(!vals.length)return;
  const min=Math.min(...vals),max=Math.max(...vals),range=max-min||Math.abs(max)||1,pad=range*.13;
  if(state.chart.type==='bar'&&!state.chart.breakAxis&&min>=0){s.yMin=0;s.yMax=niceCeil(max+pad)}else{s.yMin=niceFloor(min-pad);s.yMax=niceCeil(max+pad)}
  s.yTickStep=null;
}

function autoBreakScale(){
  const s=state.chart.settings,vals=(state.chart.type==='curve'?state.chartData.map(d=>d.mean):state.chartData.flatMap(d=>[d.mean-d.error,d.mean+d.error])).filter(Number.isFinite);if(!vals.length)return;
  const min=Math.min(...vals),max=Math.max(...vals),range=max-min||Math.abs(max)*.08||1;
  const upperStep=niceStep(range/4);
  s.upperMin=Math.floor((min-range*.10)/upperStep)*upperStep;
  s.upperMax=Math.ceil((max+range*.10)/upperStep)*upperStep;
  s.lowerMin=0;
  if(s.upperMin<10){
    const omitted=Math.max(.5,range*1.2);
    s.lowerMax=Math.max(0,Math.floor((s.upperMin-omitted)/upperStep)*upperStep);
  }else{
    s.lowerMax=niceStep(s.upperMin/4);
  }
  if(s.lowerMax>=s.upperMin)s.lowerMax=Math.max(0,s.upperMin-upperStep*2);
}

function applyTemplate(name){const t=templates[name];state.chart.settings.fontEnglish=t.fontEnglish;state.chart.settings.fontChinese=t.fontChinese;state.chart.settings.axisWidth=t.axis;state.chart.settings.frameWidth=Math.max(1,t.axis-.1);state.chart.palette=[...t.colors];state.chart.seriesStyles={}}

function renderChartStudio(){
  const context=$('#studioContextTitle');if(context)context.textContent=`Chart Studio · ${workflowChartLabel(state.workflow.chartType)}`;
  if(state.chart.mode==='gallery'){renderGalleryStudio();return}
  setStudioModeUi('experiment');
  $('#toggleBreak').textContent=`断轴：${state.chart.breakAxis?'开':'关'}`;
  $$('[data-chart-type]').forEach(b=>b.classList.toggle('active',b.dataset.chartType===state.chart.type));
  syncQuickControls();renderMappingSelect();renderLayers();renderChart();renderProperties();
}
function setStudioModeUi(mode){
  $('#experimentChartButtons')?.classList.toggle('hidden',mode!=='experiment');
  $('#mappingBox')?.classList.toggle('hidden',mode!=='experiment');
  $('#toggleBreak')?.classList.toggle('hidden',mode!=='experiment');
  $('#autoScale')?.classList.toggle('hidden',mode!=='experiment');
  $('#refreshChart')?.classList.toggle('hidden',mode!=='experiment');
  const select=$('#studioChartTypeSelect');if(select)select.value=state.workflow.chartType;
}
function syncGalleryQuickControls(){
  const s=state.gallery.settings;
  const map={quickEnglishFont:s.fontEnglish,quickChineseFont:s.fontChinese,quickFontWeight:String(s.globalFontWeight),quickCanvasPreset:s.panelPreset||'custom',quickDpi:String(s.dpi),quickCanvasWidth:s.width,quickCanvasHeight:s.height};
  Object.entries(map).forEach(([id,v])=>{const el=$('#'+id);if(el&&document.activeElement!==el)el.value=v});
  [['quickTitleVisible','titleVisible'],['quickXTitleVisible','xTitleVisible'],['quickYTitleVisible','yTitleVisible']].forEach(([id,key])=>{const el=$('#'+id);if(el)el.checked=s[key]!==false});
  const badge=$('#canvasStatus');if(badge)badge.textContent=`${s.width} × ${s.height} px · ${s.dpi} dpi`;
}
function renderGalleryStudio(){
  setStudioModeUi('gallery');state.gallery.type=state.workflow.chartType;ensureGalleryPositions();analyzeGalleryData();syncGalleryQuickControls();renderGalleryStudioLayers();renderGalleryStudioCanvas();renderGalleryStudioProperties();
}
function ensureGalleryPositions(){
  const s=state.gallery.settings;
  if(s.titleX==null)s.titleX=s.width/2;if(s.subtitleX==null)s.subtitleX=s.width/2;
  if(s.xTitleX==null)s.xTitleX=s.width/2;if(s.xTitleY==null)s.xTitleY=s.height-24;
  if(s.yTitleY==null)s.yTitleY=s.height/2;if(s.legendX==null)s.legendX=120;if(s.legendY==null)s.legendY=62;
  if(s.legendFrameX==null)s.legendFrameX=108;if(s.legendFrameY==null)s.legendFrameY=50;if(s.methodNoteX==null)s.methodNoteX=s.width-24;if(s.methodNoteY==null)s.methodNoteY=s.height-10;
}
function galleryHasAxes(type=state.gallery.type){return !['pie','radar','heatmap'].includes(type)}
function galleryHasLegend(type=state.gallery.type){return true}
function gallerySpecificLayerIds(type=state.gallery.type){
  const map={
    hist:[['histogram','柱体与分箱']],kde:[['density','密度曲线']],box:[['box-elements','箱体 / 中位线 / 须线 / 散点'],['significance','显著性比较'],['method-note','方法说明']],violin:[['violin-elements','小提琴 / 箱线 / 散点'],['significance','显著性比较'],['method-note','方法说明']],
    scatter:[['regression','拟合线与相关系数'],['method-note','方法说明']],bubble:[['regression','拟合线与相关系数'],['bubble-size','气泡大小'],['method-note','方法说明']],stacked:[['stack-mode','堆叠方式']],pie:[['pie-label','比例标签']],
    heatmap:[['heatmap-scale','色阶与数值'],['method-note','方法说明']],radar:[['radar-grid','雷达网格']]
  };return map[type]||[];
}
function galleryStudioLayers(){
  const type=state.gallery.type,layers=[['section','基础对象'],['title','图题','base'],['subtitle','副标题','base'],['typography','中英文字体','base'],['canvas','画布与清晰度','base']];
  if(galleryHasLegend(type)){if(type==='heatmap')layers.push(['legend','色带图例','base']);else layers.push(['legend','图例内容','base'],['legend-frame','图例边框','base']);}
  if(galleryHasAxes(type))layers.push(['axis-y','Y 轴与纵标题','base'],['axis-x','X 轴与横标题','base'],['frame','图片边框','base']);
  layers.push(['background','背景','base'],['section','数据对象']);
  galleryStudioSeriesNames().forEach((g,i)=>layers.push([`series:${i}`,`数据系列 · ${g}`,'series']));
  gallerySpecificLayerIds(type).forEach(([id,name])=>layers.push([id,name,'special']));
  if(state.gallery.annotations.length){layers.push(['section','标注对象']);state.gallery.annotations.forEach((a,i)=>layers.push([`annotation:${a.id}`,`${annotationTypeLabel(a.type)} ${i+1}`,'special']))}
  return layers;
}
function renderGalleryStudioLayers(){
  $('#layersList').innerHTML=galleryStudioLayers().map(item=>{
    if(item[0]==='section')return `<div class="layer-section-label">${item[1]}</div>`;
    const [id,name,kind]=item,active=id.startsWith('series:')?state.gallery.selected==='series'&&state.gallery.selectedSeries===Number(id.split(':')[1]):state.gallery.selected===id;
    return `<button class="layer-item ${active?'active':''}" data-glayer="${id}"><span class="layer-dot"></span>${esc(name)}<span class="layer-tag ${kind==='special'?'special':''}">${kind==='special'?'专属':'基础'}</span></button>`;
  }).join('');
  $$('[data-glayer]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.glayer;if(id.startsWith('series:')){state.gallery.selected='series';state.gallery.selectedSeries=Number(id.split(':')[1])}else if(id.startsWith('annotation:')){state.gallery.selected=id;state.gallery.selectedAnnotation=id.split(':')[1]}else state.gallery.selected=id;
    renderGalleryStudioLayers();renderGalleryStudioProperties();highlightGalleryObject();
  }));
}
function renderGalleryStudioCanvas(){
  const stage=$('#chartStage');if(!state.gallery.rows.length){stage.innerHTML='<div class="gallery-empty"><b>等待当前项目数据</b><span>请回到数据导入步骤，使用当前图形模板导入数据。</span></div>';return}
  stage.innerHTML=gallerySvgMarkup('paperSvg',true);bindGalleryStudioObjects();bindGalleryStudioDraggables();highlightGalleryObject();
}
function highlightGalleryObject(){
  $$('#chartStage [data-gobject]').forEach(el=>{
    const hit=el.dataset.gobject===state.gallery.selected&&(state.gallery.selected!=='series'||Number(el.dataset.gseries||0)===state.gallery.selectedSeries);
    el.classList.toggle('object-selected',hit);
  });
}
function bindGalleryStudioObjects(){
  $$('#chartStage [data-gobject]').forEach(el=>el.addEventListener('click',e=>{
    e.stopPropagation();const id=el.dataset.gobject;state.gallery.selected=id;if(id.startsWith('annotation:'))state.gallery.selectedAnnotation=id.split(':')[1];if(id==='series'&&el.dataset.gseries!=null)state.gallery.selectedSeries=Number(el.dataset.gseries);
    renderGalleryStudioLayers();renderGalleryStudioProperties();highlightGalleryObject();
  }));
}
function bindGalleryStudioDraggables(){
  const svg=$('#paperSvg');if(!svg)return;
  bindAnnotationEndpointHandles(svg,state.gallery,()=>{renderGalleryStudioCanvas();renderGalleryStudioLayers();renderGalleryStudioProperties()});
  $$('[data-gdrag]').forEach(el=>el.addEventListener('pointerdown',e=>{
    if(e.target.closest('[data-annotation-handle]'))return;
    e.preventDefault();e.stopPropagation();const key=el.dataset.gdrag,start=svgPoint(svg,e),snap=galleryDragSnapshot(key,el);el.setPointerCapture(e.pointerId);
    state.gallery.selected=key==='annotation'?`annotation:${el.dataset.gannotationId}`:key==='xTitle'?'axis-x':key==='yTitle'?'axis-y':key==='legendFrame'?'legend-frame':key==='methodNote'?'method-note':key;if(key==='annotation')state.gallery.selectedAnnotation=el.dataset.gannotationId;
    const move=ev=>{const p=svgPoint(svg,ev),dx=p.x-start.x,dy=p.y-start.y;if(key==='annotation')galleryApplyAnnotationDrag(el,snap,dx,dy);else galleryApplyDrag(key,snap.x+dx,snap.y+dy,el)};
    const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);renderGalleryStudioCanvas();renderGalleryStudioLayers();renderGalleryStudioProperties()};
    el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);
  }));
}
function galleryDragSnapshot(key,el=null){
  const s=state.gallery.settings;if(key==='annotation'){const ann=state.gallery.annotations.find(a=>a.id===el?.dataset.gannotationId);return ann?structuredClone(ann):{}}
  if(key==='title')return{x:s.titleX??s.width/2,y:s.titleY??38};if(key==='subtitle')return{x:s.subtitleX??s.width/2,y:s.subtitleY??58};
  if(key==='legend')return{x:s.legendX??120,y:s.legendY??62};if(key==='legendFrame')return{x:s.legendFrameX??108,y:s.legendFrameY??50};if(key==='methodNote')return{x:s.methodNoteX??s.width-24,y:s.methodNoteY??s.height-10};
  if(key==='xTitle')return{x:s.xTitleX??s.width/2,y:s.xTitleY??s.height-24};return{x:s.yTitleX??28,y:s.yTitleY??s.height/2};
}
function galleryApplyAnnotationDrag(el,snap,dx,dy){
  const ann=state.gallery.annotations.find(a=>a.id===el.dataset.gannotationId);if(!ann)return;
  if(ann.type==='text'){ann.x=snap.x+dx;ann.y=snap.y+dy;el.setAttribute('transform',`translate(${ann.x} ${ann.y})`)}
  else if(ann.type==='peak'){ann.dx=snap.dx+dx;ann.dy=snap.dy+dy;el.setAttribute('transform',`translate(${dx} ${dy})`)}
  else{ann.x1=snap.x1+dx;ann.y1=snap.y1+dy;ann.x2=snap.x2+dx;ann.y2=snap.y2+dy;el.setAttribute('transform',`translate(${dx} ${dy})`)}
}
function galleryApplyDrag(key,x,y,el){
  const s=state.gallery.settings;
  if(key==='title'){s.titleX=x;s.titleY=y;el.setAttribute('x',x);el.setAttribute('y',y)}
  else if(key==='subtitle'){s.subtitleX=x;s.subtitleY=y;el.setAttribute('x',x);el.setAttribute('y',y)}
  else if(key==='legend'){s.legendX=x;s.legendY=y;el.setAttribute('transform',`translate(${x} ${y})`)}
  else if(key==='legendFrame'){s.legendFrameX=x;s.legendFrameY=y;el.setAttribute('transform',`translate(${x} ${y})`)}
  else if(key==='methodNote'){s.methodNoteX=x;s.methodNoteY=y;el.setAttribute('x',x);el.setAttribute('y',y)}
  else if(key==='xTitle'){s.xTitleX=x;s.xTitleY=y;el.setAttribute('x',x);el.setAttribute('y',y)}
  else{s.yTitleX=x;s.yTitleY=y;el.setAttribute('transform',`translate(${x} ${y}) rotate(-90)`)}
}
function galleryBasePropertyHtml(id){
  const s=state.gallery.settings;
  if(id==='title')return gallerySection('图题文字',[gCheck('titleVisible','显示图题'),gText('title','图题文字'),gNumber('titleX','水平位置',0,1800,1),gNumber('titleY','垂直位置',0,1200,1),gRange('titleSize','字号',9,40,1),gSelect('titleWeight','字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']]),gColor('titleColor','颜色')])+galleryDragHint('图题');
  if(id==='subtitle')return gallerySection('副标题',[gCheck('subtitleEnabled','显示副标题'),gText('subtitle','副标题文字'),gNumber('subtitleX','水平位置',0,1800,1),gNumber('subtitleY','垂直位置',0,1200,1),gRange('subtitleSize','字号',8,28,1),gSelect('subtitleWeight','字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗']]),gColor('subtitleColor','颜色')])+galleryDragHint('副标题');
  if(id==='typography')return gallerySection('字体族',[gSelect('fontEnglish','英文字体',[['Arial','Arial'],['Times New Roman','Times New Roman'],['Calibri','Calibri'],['Helvetica','Helvetica'],['Georgia','Georgia']]),gSelect('fontChinese','中文字体',[['Microsoft YaHei','微软雅黑'],['SimSun','宋体'],['SimHei','黑体'],['KaiTi','楷体'],['FangSong','仿宋']])])+gallerySection('基础字重',[gSelect('globalFontWeight','全局文字粗细',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']]),gSelect('xTickWeight','X轴数字粗细',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗']]),gSelect('yTickWeight','Y轴数字粗细',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗']]),gSelect('legendWeight','图例文字粗细',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗']])]);
  if(id==='canvas')return gallerySection('画布',[gSelect('panelPreset','图幅比例',[['normal','常规 980×660'],['small','拼图小图 760×540'],['square','正方图 700×700'],['wide','宽图 1080×620'],['tall','高图 820×760'],['custom','自定义']]),gNumber('width','画布宽度',500,1800,10),gNumber('height','画布高度',400,1200,10),gSelect('dpi','PNG 清晰度',[[96,'96 dpi'],[150,'150 dpi'],[300,'300 dpi（论文）'],[600,'600 dpi（高精度）']])]);
  if(id==='axis-x')return gallerySection('横坐标标题',[gCheck('xTitleVisible','显示横坐标标题'),gText('xTitle','标题文字'),gNumber('xTitleX','水平位置',0,1800,1),gNumber('xTitleY','垂直位置',0,1200,1),gRange('xTitleSize','标题字号',9,30,1),gSelect('xTitleWeight','标题字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']]),gColor('xTitleColor','标题颜色')])+gallerySection('X 轴与刻度',[gRange('axisWidth','坐标轴粗细',.5,5,.1),gColor('axisColor','坐标轴颜色'),gRange('xTickSize','X轴数字字号',8,28,1),gSelect('xTickWeight','X轴数字字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']]),gColor('xTickColor','X轴数字颜色'),gRange('tickLength','刻度线长度',0,18,1),gCheck('showXTicks','显示刻度线')])+galleryDragHint('横坐标标题');
  if(id==='axis-y')return gallerySection('纵坐标标题',[gCheck('yTitleVisible','显示纵坐标标题'),gText('yTitle','标题文字'),gNumber('yTitleX','水平位置',0,1800,1),gNumber('yTitleY','垂直位置',0,1200,1),gRange('yTitleSize','标题字号',9,30,1),gSelect('yTitleWeight','标题字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']]),gColor('yTitleColor','标题颜色')])+gallerySection('Y 轴与刻度',[gRange('axisWidth','坐标轴粗细',.5,5,.1),gColor('axisColor','坐标轴颜色'),gRange('yTickSize','Y轴数字字号',8,28,1),gSelect('yTickWeight','Y轴数字字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']]),gColor('yTickColor','Y轴数字颜色'),gRange('tickLength','刻度线长度',0,18,1),gCheck('showYTicks','显示刻度线')])+galleryDragHint('纵坐标标题');
  if(id==='frame')return gallerySection('图片边框',[gSelect('frameMode','边框形式',[['lb','仅左、下轴'],['lbr','左、下、右三边'],['box','完整四边框'],['none','不显示边框']]),gRange('frameWidth','边框粗细',.5,6,.1),gColor('frameColor','边框颜色')]);
  if(id==='legend'){if(state.gallery.type==='heatmap')return gallerySection('色带图例',[gCheck('heatmapColorBar','显示色带图例'),gNumber('legendX','水平位置',0,1800,1),gNumber('legendY','垂直位置',0,1200,1),gRange('legendFontSize','数字字号',8,30,1),gOrientationButtons('heatmapColorBarOrientation','排列方向')])+galleryDragHint('色带图例');return gallerySection('图例内容',[gCheck('legend','显示图例'),gNumber('legendX','水平位置',0,1800,1),gNumber('legendY','垂直位置',0,1200,1),gRange('legendFontSize','字号',8,36,1),gSelect('legendWeight','字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗']]),gOrientationButtons('legendOrientation','排列方向'),gRange('legendColumns','横向列数',1,6,1)])+galleryDragHint('图例内容');}
  if(id==='legend-frame')return gallerySection('图例边框',[gSelect('legendFrameStyle','边框样式',[['none','无边框'],['solid','实线'],['dashed','虚线'],['dotted','点线'],['double','双线']]),gNumber('legendFrameX','水平位置',0,1800,1),gNumber('legendFrameY','垂直位置',0,1200,1),gCheck('legendFrameAutoSize','自动适应图例大小'),gNumber('legendFrameWidthBox','边框宽度',20,900,1),gNumber('legendFrameHeightBox','边框高度',20,600,1),gRange('legendFrameWidth','线条粗细',.5,5,.1),gColor('legendFrameColor','边框颜色'),gColor('legendFrameFill','底色'),gRange('legendFrameRadius','圆角',0,20,1)])+gallerySection('阴影',[gCheck('legendShadow','显示阴影'),gRange('legendShadowX','水平偏移',-10,14,1),gRange('legendShadowY','垂直偏移',-10,14,1),gRange('legendShadowBlur','模糊程度',0,12,.5),gRange('legendShadowOpacity','透明度',0,.7,.05)])+galleryDragHint('图例边框');
  if(id==='background')return gallerySection('背景',[gColor('background','背景颜色')]);
  return'';
}
function renderGalleryStudioProperties(){
  const id=state.gallery.selected,def=galleryDef();let name='',html='',scope='基础';
  const baseNames={title:'图题',subtitle:'副标题',typography:'中英文字体',canvas:'画布与清晰度','axis-x':'X 轴与横标题','axis-y':'Y 轴与纵标题',frame:'图片边框',legend:'图例内容','legend-frame':'图例边框',background:'背景'};
  if(baseNames[id]){name=baseNames[id];html=galleryBasePropertyHtml(id)}
  else if(id.startsWith('annotation:')){const ann=annotationById(id.split(':')[1]);name=ann?`标注 · ${annotationTypeLabel(ann.type)}`:'标注';html=ann?annotationPropertyHtml(ann):'';scope='图形专属'}
  else if(id==='series'){const names=galleryStudioSeriesNames(),idx=clamp(state.gallery.selectedSeries,0,Math.max(0,names.length-1));name=`数据系列 · ${names[idx]||'Series'}`;html=gallerySeriesPropertyHtml(def.id,idx);scope='图形专属'}
  else{name=gallerySpecificLayerIds(def.id).find(x=>x[0]===id)?.[1]||'图形专属属性';html=gallerySpecificPropertyHtml(def.id,id);scope='图形专属'}
  $('#selectedObjectName').textContent=name||'未选择对象';$('#propertyEditor').innerHTML=html||'<div class="empty-state">在图中点击一个对象</div>';
  const badge=$('#propertyScopeBadge');if(badge){badge.textContent=scope;badge.classList.toggle('chart-specific',scope!=='基础')}
  bindGalleryStudioPropertyInputs();bindCurrentAnnotationInputs();
}
function gallerySpecificPropertyHtml(type,id){
  if(id==='histogram')return gallerySection('直方图',[gRange('bins','分箱数量',4,40,1),gRange('opacity','柱透明度',.15,1,.05),gRange('lineWidth','柱边框粗细',0,4,.1)]);
  if(id==='density')return gallerySection('核密度曲线',[gNumber('bandwidth','带宽（0=自动）',0,100,.01),gRange('lineWidth','曲线粗细',.5,6,.1),gRange('opacity','填充透明度',0,1,.05)]);
  if(['box-elements','violin-elements'].includes(id))return gallerySection('统计定义',[gSelect('boxQuartileMethod','四分位数算法',[['linear7','线性插值（R type 7 / Excel INC）'],['tukey','Tukey hinges'],['exclusive','Excel QUARTILE.EXC']]),gSelect('boxWhiskerMethod','须线定义',[['iqr15','1.5×IQR'],['iqr30','3×IQR'],['minmax','最小值–最大值'],['percentile','百分位范围']]),gRange('boxWhiskerPercentile','百分位下限',1,20,1)])+gallerySection('分布元素',[gRange('boxWidth','箱体 / 小提琴宽度',.2,.9,.01),gCheck('showMean','显示均值'),gCheck('showMedian','显示中位数'),gCheck('showOutliers','显示异常点'),gCheck('showPoints','叠加原始散点'),gRange('pointSize','散点大小',1,10,.5),gRange('whiskerWidth','须线粗细',.5,4,.1),gRange('medianWidth','中位线粗细',.5,5,.1),gRange('opacity','填充透明度',.1,1,.05)])+`<div class="method-badge"><b>当前定义：</b>${esc(boxMethodLabels().quartile)}；须线：${esc(boxMethodLabels().whisker)}</div>`;
  if(id==='regression')return gallerySection('关系分析方法',[gSelect('correlationMethod','相关方法',[['pearson','Pearson 线性相关'],['spearman','Spearman 秩相关']]),gCheck('showRegression','显示线性拟合'),gCheck('showCorrelation','显示相关系数'),gRange('annotationSize','相关系数文字字号',8,28,1),gRange('lineWidth','拟合线粗细',.5,5,.1)])+`<div class="method-badge"><b>当前方法：</b>${esc(correlationMethodLabel())}；拟合线为普通最小二乘线性回归。</div>`;
  if(id==='bubble-size')return gallerySection('气泡大小',[gRange('pointSize','基础点大小',1,12,.5),gRange('opacity','透明度',.1,1,.05)]);
  if(id==='stack-mode')return gallerySection('堆叠方式',[gCheck('normalize','百分比堆叠'),gSelect('orientation','方向',[['vertical','纵向'],['horizontal','横向']])]);
  if(id==='pie-label')return gallerySection('饼图标签',[gCheck('donut','圆环图'),gCheck('showCorrelation','显示百分比标签'),gRange('pieLabelSize','百分比字号',8,28,1)]);
  if(id==='significance')return gallerySection('显著性分析方法',[gSelect('statMethod','总体检验与事后比较',[['anovaLsd','单因素 ANOVA + Fisher LSD'],['welchHolm','Welch ANOVA + Welch t（Holm）'],['kruskalHolm','Kruskal–Wallis + Mann–Whitney（Holm）']]),gCheck('significanceEnabled','显示显著性结果'),gSelect('significanceDisplay','显示方式',[['brackets','括号 + 标记'],['letters','显著性字母'],['none','不显示']]),gSelect('significancePairMode','比较范围',[['significant','仅显示显著比较'],['control','仅与第一组比较'],['all','显示全部两两比较']]),gSelect('significanceLabelMode','标记形式',[['stars','星号（* / ** / ***）'],['pvalue','p 值'],['letters','字母分组']]),gRange('significanceFontSize','标记字号',8,26,1),gRange('significanceLineWidth','括号线宽',.5,4,.1),gColor('significanceColor','括号与文字颜色'),gRange('significanceOffset','距数据顶部',2,30,1),gRange('significanceStep','层间距',8,40,1)])+`<div class="stat-method-note"><b>当前方法：</b>${esc(statisticalMethodLabel())}。不同方法的假设和校正方式不同，p 值及显著性标记可能变化。</div>`;
  if(id==='heatmap-scale')return gallerySection('相关计算方法',[gSelect('correlationMethod','相关方法',[['pearson','Pearson 线性相关'],['spearman','Spearman 秩相关']])])+gallerySection('热图色阶',[gSelect('heatmapPalette','色阶方案',Object.entries(HEATMAP_PALETTES).map(([k,v])=>[k,v.name])),heatmapPalettePreview(),gHeatColor('heatmapLowColor','负相关 / 低值颜色'),gHeatColor('heatmapMidColor','零值 / 中间颜色'),gHeatColor('heatmapHighColor','正相关 / 高值颜色'),gHeatColor('heatmapDiagonalColor','对角线颜色'),gCheck('heatmapShowValues','显示数值'),gRange('heatmapValueSize','格内数字字号',7,24,1),gRange('heatmapXLabelSize','顶部标签字号',8,28,1),gRange('heatmapYLabelSize','左侧标签字号',8,28,1),gRange('heatmapCellGap','格子间距',0,6,.5)])+gallerySection('色带图例',[gCheck('heatmapColorBar','显示色带图例'),gOrientationButtons('heatmapColorBarOrientation','色带方向'),gNumber('legendX','水平位置',0,1800,1),gNumber('legendY','垂直位置',0,1200,1)])+`<div class="method-badge"><b>当前矩阵：</b>${esc(correlationMethodLabel())}</div>`;
  if(id==='method-note')return gallerySection('方法说明',[gCheck('methodNoteVisible','在图中显示方法说明'),gNumber('methodNoteX','水平位置',0,1800,1),gNumber('methodNoteY','垂直位置',0,1200,1),gRange('methodNoteSize','字号',7,20,1),gColor('methodNoteColor','颜色')])+`<div class="method-badge">${esc(galleryMethodNoteText())}</div>`+galleryDragHint('方法说明');
  if(id==='radar-grid')return gallerySection('雷达网格',[gCheck('normalize','按指标 0–1 归一化'),gRange('radarLabelSize','轴标签字号',8,28,1),gRange('radarGridWidth','网格粗细',.4,4,.1),gRange('radarPointSize','节点大小',0,10,.5),gRange('opacity','填充透明度',0,1,.05)]);
  return gallerySeriesPropertyHtml(type,state.gallery.selectedSeries);
}
function gallerySeriesPropertyHtml(type,index=0){
  const names=galleryStudioSeriesNames(),name=names[index]||`Series ${index+1}`,style=getGallerySeriesStyle(index);
  let html=`<div class="series-picker">${names.map((n,i)=>`<button class="${i===index?'active':''}" data-gseries-select="${i}">${esc(n)}</button>`).join('')}</div>`;
  html+=gallerySection(`系列样式 · ${name}`,[gSeriesColor(index,'颜色'),gSeriesRange(index,'opacity','透明度',.1,1,.05)]);
  if(['kde','box','violin','scatter','bubble','radar'].includes(type))html+=gallerySection('线与点',[gSeriesRange(index,'lineWidth','线宽',.5,7,.1),gSeriesRange(index,'pointSize','点大小',1,16,.5),gSeriesSelect(index,'markerShape','标记形状',[['circle','圆形'],['square','方形'],['triangle','上三角'],['triangleDown','下三角'],['diamond','菱形'],['star','五角星'],['pentagon','五边形'],['hexagon','六边形'],['plus','加号'],['cross','叉号']]),gSeriesSelect(index,'markerFill','标记填充',[['series','同系列颜色'],['white','白色空心']])]);
  if(['box','violin','hist','stacked','pie'].includes(type))html+=gallerySection('填充与边框',[gSeriesRange(index,'lineWidth','边框粗细',0,5,.1)]);
  html+=gallerySection('全部系列配色',[galleryPaletteBlock()]);return html;
}
function gallerySection(title,items){return `<div class="object-property-section"><h3>${title}</h3>${items.join('')}</div>`}
function galleryDragHint(name){return `<div class="hint">${name}可在图中直接拖动，也可以输入精确坐标。</div>`}
function getGallerySeriesStyle(index){
  if(!state.gallery.seriesStyles[index])state.gallery.seriesStyles[index]={color:state.gallery.palette[index%state.gallery.palette.length],opacity:state.gallery.settings.opacity,lineWidth:state.gallery.settings.lineWidth,pointSize:state.gallery.settings.pointSize,markerShape:'circle',markerFill:'series'};
  return state.gallery.seriesStyles[index];
}
function gSeriesWrap(index,key,label,input){const v=getGallerySeriesStyle(index)[key];return `<div class="field"><label><span>${label}</span><output data-gseries-out="${index}:${key}">${esc(v)}</output></label>${input}</div>`}
function gSeriesColor(index,label){return gSeriesWrap(index,'color',label,`<input data-gseries-setting="${index}:color" type="color" value="${getGallerySeriesStyle(index).color}">`)}
function gSeriesRange(index,key,label,min,max,step){return gSeriesWrap(index,key,label,`<input data-gseries-setting="${index}:${key}" type="range" min="${min}" max="${max}" step="${step}" value="${getGallerySeriesStyle(index)[key]}">`)}
function gSeriesSelect(index,key,label,opts){return gSeriesWrap(index,key,label,`<select data-gseries-setting="${index}:${key}">${opts.map(([v,n])=>`<option value="${v}" ${String(getGallerySeriesStyle(index)[key])===String(v)?'selected':''}>${n}</option>`).join('')}</select>`)}
function galleryPaletteBlock(){
  const groups=galleryStudioSeriesNames();if(!groups.length)return'';
  return `<div class="palette-list">${groups.slice(0,12).map((g,i)=>`<label class="palette-item"><input type="color" data-gpalette="${i}" value="${getGallerySeriesStyle(i).color}"><span>${esc(g)}</span></label>`).join('')}</div>`;
}
function galleryStudioSeriesNames(){
  const rows=state.gallery.rows,type=state.gallery.type;
  if(['hist','kde','box','violin','scatter','bubble','radar'].includes(type))return [...new Set(rows.map(r=>r.Group||'Series'))];
  if(['stacked','pie'].includes(type))return [...new Set(rows.map(r=>r.Component||'Component'))];
  if(type==='heatmap')return [];return [];
}
function galleryPropGroup(items){return items.join('')}
function gColor(k,l){return gWrap(l,k,`<input data-gsetting="${k}" type="color" value="${state.gallery.settings[k]}">`)}
function gHeatColor(k,l){const v=state.gallery.settings[k];return `<div class="field heat-color-field"><label><span>${l}</span><output data-gout="${k}">${esc(v)}</output></label><div class="color-pair"><input data-gsetting="${k}" type="color" value="${v}"><input data-gsetting="${k}" data-color-text="${k}" type="text" value="${v}" maxlength="7" spellcheck="false"></div></div>`}
function heatmapPalettePreview(){const s=state.gallery.settings;return `<div class="heatmap-palette-preview"><span style="background:${s.heatmapLowColor}">−1</span><span style="background:${s.heatmapMidColor};color:#333">0</span><span style="background:${s.heatmapHighColor}">+1</span><span style="background:${s.heatmapDiagonalColor}">对角</span></div>`}
function applyHeatmapPalette(name){const preset=HEATMAP_PALETTES[name];if(!preset||name==='custom')return;const s=state.gallery.settings;s.heatmapLowColor=preset.low;s.heatmapMidColor=preset.mid;s.heatmapHighColor=preset.high;s.heatmapDiagonalColor=preset.diagonal}

function bindGalleryStudioPropertyInputs(){
  const applySetting=el=>{
    const key=el.dataset.gsetting;if(!key)return;
    let v=el.type==='checkbox'?el.checked:el.value;if(['range','number'].includes(el.type))v=Number(v);
    if(el.dataset.colorText&& !/^#[0-9a-f]{6}$/i.test(String(v)))return;
    state.gallery.settings[key]=v;
    if(key==='colorScheme'){state.gallery.palette=[...(templates[v]?.colors||templates.foodchem.colors)];state.gallery.seriesStyles={}}
    if(key==='heatmapPalette')applyHeatmapPalette(v);
    if(['heatmapLowColor','heatmapMidColor','heatmapHighColor','heatmapDiagonalColor'].includes(key))state.gallery.settings.heatmapPalette='custom';
    if(key==='panelPreset')applyGalleryCanvasPreset(v);
    if(key==='legendOrientation')state.gallery.settings.legendColumns=v==='vertical'?1:Math.max(2,Math.min(galleryStudioSeriesNames().length||3,3));
    analyzeGalleryData();renderGalleryStudioCanvas();syncGalleryQuickControls();
    $$(`[data-gsetting="${key}"]`).forEach(peer=>{if(peer!==el&&peer.type!=='checkbox')peer.value=state.gallery.settings[key]});
    $$(`[data-gout="${key}"]`).forEach(out=>out.textContent=state.gallery.settings[key]);
    if(['heatmapPalette','statMethod','boxQuartileMethod','boxWhiskerMethod','boxWhiskerPercentile','correlationMethod'].includes(key))renderGalleryStudioProperties();
  };
  $$('[data-gsetting]').forEach(el=>{el.addEventListener('input',()=>applySetting(el));el.addEventListener('change',()=>applySetting(el))});
  $$('[data-gorientation]').forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.gorientation,value=btn.dataset.orientationValue;state.gallery.settings[key]=value;if(key==='legendOrientation')state.gallery.settings.legendColumns=value==='vertical'?1:Math.max(2,Math.min(galleryStudioSeriesNames().length||3,3));renderGalleryStudioProperties();renderGalleryStudioCanvas();
  }));
  $$('[data-gseries-setting]').forEach(el=>el.addEventListener('input',()=>{
    const [idx,key]=el.dataset.gseriesSetting.split(':'),style=getGallerySeriesStyle(Number(idx));let v=el.value;if(el.type==='range')v=Number(v);style[key]=v;if(key==='color')state.gallery.palette[Number(idx)]=v;
    renderGalleryStudioCanvas();const out=$(`[data-gseries-out="${idx}:${key}"]`);if(out)out.textContent=v;
  }));
  $$('[data-gpalette]').forEach(el=>el.addEventListener('input',()=>{const i=Number(el.dataset.gpalette);state.gallery.palette[i]=el.value;getGallerySeriesStyle(i).color=el.value;renderGalleryStudioCanvas()}));
  $$('[data-gseries-select]').forEach(el=>el.addEventListener('click',()=>{state.gallery.selected='series';state.gallery.selectedSeries=Number(el.dataset.gseriesSelect);renderGalleryStudioLayers();renderGalleryStudioProperties();highlightGalleryObject()}));
}
function applyGalleryCanvasPreset(value){
  const s=state.gallery.settings,map={normal:[980,660],small:[760,540],square:[700,700],wide:[1080,620],tall:[820,760]};if(!map[value])return;
  const [nw,nh]=map[value],rx=nw/s.width,ry=nh/s.height;s.titleX*=rx;s.titleY*=ry;s.subtitleX*=rx;s.subtitleY*=ry;s.xTitleX*=rx;s.xTitleY*=ry;s.yTitleX*=rx;s.yTitleY*=ry;s.legendX*=rx;s.legendY*=ry;s.legendFrameX*=rx;s.legendFrameY*=ry;s.methodNoteX*=rx;s.methodNoteY*=ry;s.width=nw;s.height=nh;
}

function syncQuickControls(){
  const s=state.chart.settings,ids={quickEnglishFont:s.fontEnglish,quickChineseFont:s.fontChinese,quickFontWeight:String(s.globalFontWeight),quickCanvasPreset:s.panelPreset,quickDpi:String(s.pngDpi),quickCanvasWidth:s.canvasWidth,quickCanvasHeight:s.canvasHeight};
  Object.entries(ids).forEach(([id,v])=>{const el=$('#'+id);if(el&&document.activeElement!==el)el.value=v});
  [['quickTitleVisible','titleVisible'],['quickXTitleVisible','xTitleVisible'],['quickYTitleVisible','yTitleVisible']].forEach(([id,key])=>{const el=$('#'+id);if(el)el.checked=s[key]!==false});
  const badge=$('#canvasStatus');if(badge)badge.textContent=`${s.canvasWidth} × ${s.canvasHeight} px · ${s.pngDpi} dpi`;
}

function renderMappingSelect(){
  const select=$('#xFactorSelect'),d=state.design;
  select.innerHTML=`<option value="A">${esc(d.factorAName||'因素 A')}</option>`+(d.designType==='two'?`<option value="B">${esc(d.factorBName||'因素 B')}</option>`:'');
  if(d.designType==='one')state.chart.xFactor='A';select.value=state.chart.xFactor;
}

function chartGroups(){return getChartModel().groups}
function chartXs(){return getChartModel().xvals}

function chartDimensions(){
  const s=state.chart.settings;
  let W=Number(s.canvasWidth)||980,H=Number(s.canvasHeight)||660;
  if(s.panelPreset==='small'){W=760;H=540}
  else if(s.panelPreset==='square'){W=700;H=700}
  else if(s.panelPreset==='wide'){W=1080;H=620}
  else if(s.panelPreset==='tall'){W=820;H=760}
  return {W,H};
}
function xBaseAt(i,xStep,M){ return M.l+(i+.5)*xStep; }
function seriesOffset(gi,groupCount){
  const span=Number(state.chart.settings.lineOffset)||0;
  if(groupCount<=1||span===0) return 0;
  return ((gi-(groupCount-1)/2)/(groupCount-1||1))*span;
}
function smoothPath(coords){
  if(coords.length<3) return coords.map((p,i)=>(i?'L':'M')+p[0]+','+p[1]).join(' ');
  let d=`M${coords[0][0]},${coords[0][1]}`;
  for(let i=0;i<coords.length-1;i++){
    const p0=coords[i-1]||coords[i], p1=coords[i], p2=coords[i+1], p3=coords[i+2]||p2;
    const cp1x=p1[0]+(p2[0]-p0[0])/6, cp1y=p1[1]+(p2[1]-p0[1])/6;
    const cp2x=p2[0]-(p3[0]-p1[0])/6, cp2y=p2[1]-(p3[1]-p1[1])/6;
    d+=` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}
const TIME_UNIT_SECONDS={s:1,min:60,h:3600};
function timeUnitLabel(unit){return unit==='s'?'s':unit==='min'?'min':unit==='h'?'h':''}
function detectTimeUnitFromText(text){
  const t=String(text||'').trim();
  if(/(?:\(|（|\[)\s*(?:min|mins|minute|minutes|分钟)\s*(?:\)|）|\])/i.test(t)||/\b(?:min|mins|minute|minutes)\b/i.test(t)||/分钟/.test(t))return'min';
  if(/(?:\(|（|\[)\s*(?:h|hr|hrs|hour|hours|小时)\s*(?:\)|）|\])/i.test(t)||/\b(?:h|hr|hrs|hour|hours)\b/i.test(t)||/小时/.test(t))return'h';
  if(/(?:\(|（|\[)\s*(?:s|sec|secs|second|seconds|秒)\s*(?:\)|）|\])/i.test(t)||/\b(?:sec|secs|second|seconds)\b/i.test(t)||/秒/.test(t))return's';
  return null;
}
function xSourceUnit(){
  const s=state.chart.settings;
  if(['s','min','h'].includes(s.xUnitSource))return s.xUnitSource;
  return detectTimeUnitFromText(s.xTitle)||detectTimeUnitFromText(state.design.factorAName);
}
function numericChartXs(){return chartXs().map(Number).filter(Number.isFinite)}
function xTargetUnit(){
  const s=state.chart.settings,source=xSourceUnit();if(!source)return null;
  if(['s','min','h'].includes(s.xUnitTarget))return s.xUnitTarget;
  if(s.xUnitTarget!=='auto')return source;
  const vals=numericChartXs();if(!vals.length)return source;
  const maxSeconds=Math.max(...vals.map(v=>Math.abs(v)))*TIME_UNIT_SECONDS[source];
  if(maxSeconds>=7200)return'h';
  if(maxSeconds>=120)return'min';
  return's';
}
function convertXValue(raw){
  const n=Number(raw),source=xSourceUnit(),target=xTargetUnit();
  if(!Number.isFinite(n)||!source||!target||source===target)return raw;
  return n*TIME_UNIT_SECONDS[source]/TIME_UNIT_SECONDS[target];
}
function formatXTick(raw){const source=xSourceUnit(),target=xTargetUnit();if(!source||!target||source===target)return String(raw);const v=convertXValue(raw);return Number.isFinite(Number(v))?formatNumber(Number(v),2):String(v)}
function niceAxisStep(span,segments=6){const raw=Math.abs(span)/(Math.max(1,segments)||1);if(!Number.isFinite(raw)||raw===0)return 1;const power=Math.pow(10,Math.floor(Math.log10(raw))),n=raw/power;const nice=n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10;return nice*power}
function axisDecimalsForStep(step){if(!Number.isFinite(step)||step===0)return 0;return Math.max(0,Math.min(6,-Math.floor(Math.log10(Math.abs(step)))+(Math.abs(step/Math.pow(10,Math.floor(Math.log10(Math.abs(step))))-2.5)<1e-9?1:0)))}
function formatAxisNumber(v,mode='auto',step=null,round=false){if(!Number.isFinite(Number(v)))return String(v);let d=mode==='auto'?axisDecimalsForStep(step||1):Number(mode);if(round)d=0;return Number(v).toFixed(clamp(d,0,6)).replace(/\.0+$/,'').replace(/(\.\d*?)0+$/,'$1')}
function experimentXAxisConfig(xvals,M,plotW){
  const s=state.chart.settings,key=[chartDataVersion,M.l,plotW,s.xScaleMode,s.xAxisMin,s.xAxisMax,s.xAxisSegments,s.xTickRound,s.xUnitSource,s.xUnitTarget,s.xTitle].join('|');
  if(xAxisConfigMemo.key===key)return xAxisConfigMemo.value;
  const nums=xvals.map(v=>Number(convertXValue(v))),numeric=isLineLike()&&nums.every(Number.isFinite)&&nums.length>1;
  if(!numeric){xAxisConfigMemo={key,value:null};return null}
  let dataMin=Infinity,dataMax=-Infinity;for(const n of nums){if(n<dataMin)dataMin=n;if(n>dataMax)dataMax=n}
  let segments=clamp(Math.round(Number(s.xAxisSegments)||10),1,40),min=s.xScaleMode==='manual'&&Number.isFinite(Number(s.xAxisMin))?Number(s.xAxisMin):dataMin,max=s.xScaleMode==='manual'&&Number.isFinite(Number(s.xAxisMax))?Number(s.xAxisMax):dataMax;
  if(max<=min)max=min+1;let step=(max-min)/segments;
  if(s.xTickRound){step=niceAxisStep(max-min,segments);if(s.xScaleMode!=='manual'){min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;segments=Math.max(1,Math.round((max-min)/step))}else step=(max-min)/segments}
  const pos=v=>M.l+(Number(v)-min)/(max-min||1)*plotW,ticks=Array.from({length:segments+1},(_,i)=>min+(max-min)*i/segments),value={min,max,segments,step,pos,ticks,nums};
  xAxisConfigMemo={key,value};return value;
}
function experimentXPosition(raw,index,xvals,M,plotW){const cfg=experimentXAxisConfig(xvals,M,plotW);return cfg?cfg.pos(Number(convertXValue(raw))):xBaseAt(index,plotW/xvals.length,M)}
function experimentXAxisTickObjects(xvals,M,plotW){const cfg=experimentXAxisConfig(xvals,M,plotW),s=state.chart.settings;if(cfg)return cfg.ticks.map((v,i)=>({x:cfg.pos(v),label:formatAxisNumber(v,s.xTickDecimals,cfg.step,s.xTickRound),i}));const xStep=plotW/xvals.length;return visibleXTickIndices(xvals).map((idx,j)=>({x:M.l+(idx+.5)*xStep,label:formatXTick(xvals[idx]),i:j,index:idx}))}
function convertedXTitle(){
  const s=state.chart.settings,source=xSourceUnit(),target=xTargetUnit(),title=String(s.xTitle||'');
  if(!source||!target||source===target)return title;
  const label=timeUnitLabel(target);
  const parenthetical={s:/(\(|（|\[)\s*(?:s|sec|secs|second|seconds|秒)\s*(\)|）|\])/i,min:/(\(|（|\[)\s*(?:min|mins|minute|minutes|分钟)\s*(\)|）|\])/i,h:/(\(|（|\[)\s*(?:h|hr|hrs|hour|hours|小时)\s*(\)|）|\])/i}[source];
  if(parenthetical.test(title))return title.replace(parenthetical,(_,a,b)=>`${a}${label}${b}`);
  const plain={s:/\b(?:sec|secs|second|seconds)\b|秒/i,min:/\b(?:min|mins|minute|minutes)\b|分钟/i,h:/\b(?:h|hr|hrs|hour|hours)\b|小时/i}[source];
  return plain.test(title)?title.replace(plain,label):`${title} (${label})`;
}
function xUnitStatusText(){const source=xSourceUnit(),target=xTargetUnit();if(!source)return'未识别到时间单位；可手动指定原单位。';return source===target?`当前保持 ${timeUnitLabel(source)}。`:`当前显示换算：${timeUnitLabel(source)} → ${timeUnitLabel(target)}（仅改变坐标显示，不改原始数据）。`}
function automaticXTickRotation(labels){
  const s=state.chart.settings;if(!s.xTickAutoRotate)return Number(s.xTickRotation)||0;
  const {W}=chartDimensions(),plotW=W-106-80,count=Math.max(1,labels.length),spacing=plotW/Math.max(1,count-1),font=Number(s.xTickSize)||12;
  const maxWidth=Math.max(...labels.map(t=>String(t).length*font*.58),0);
  if(count>=9&&(maxWidth>spacing*.5||Math.max(...labels.map(t=>String(t).length),0)>=6))return maxWidth>spacing*1.05?-60:-45;
  if(maxWidth>spacing*.9)return-45;
  return 0;
}
function xTickLayout(text,i){
  const s=state.chart.settings,labels=visibleXTickIndices(chartXs()).map(idx=>formatXTick(chartXs()[idx]));
  const rotate=automaticXTickRotation(labels);
  const autoStagger=!s.xTickAutoRotate&&(s.xTickStagger||String(text).length>8||chartXs().length>8);
  const dy=autoStagger&&rotate===0?((i%2)*14):0;
  const anchor=rotate<0?'end':rotate>0?'start':'middle';
  return {rotate,dy,anchor};
}
function visibleXTickIndices(xvals,maxTicks=12){
  const n=xvals.length;if(n<=maxTicks)return xvals.map((_,i)=>i);
  const step=Math.max(1,Math.ceil((n-1)/(maxTicks-1))),indices=[];
  for(let i=0;i<n;i+=step)indices.push(i);if(indices.at(-1)!==n-1)indices.push(n-1);return indices;
}

function fontStack(){
  const s=state.chart.settings;
  const en=String(s.fontEnglish||'Arial').replace(/'/g,"\'");
  const zh=String(s.fontChinese||'Microsoft YaHei').replace(/'/g,"\'");
  return `'${en}','${zh}',sans-serif`;
}
function ensurePalette(count){
  while(state.chart.palette.length<count){
    const i=state.chart.palette.length;
    const hue=(i*137.508+28)%360;
    state.chart.palette.push(hslToHex(hue,52,48));
  }
}
function hslToHex(h,s,l){
  s/=100;l/=100;const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let r=0,g=0,b=0;
  if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}
  return '#'+[r,g,b].map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
}
function setCanvasSize(newW,newH){
  const s=state.chart.settings,oldW=Number(s.canvasWidth)||980,oldH=Number(s.canvasHeight)||660;
  newW=clamp(Number(newW)||oldW,500,1800);newH=clamp(Number(newH)||oldH,400,1200);
  const rx=newW/oldW,ry=newH/oldH;
  ['titleX','subtitleX','xTitleX','yTitleX'].forEach(k=>s[k]*=rx);['titleY','subtitleY','xTitleY','yTitleY'].forEach(k=>s[k]*=ry);
  state.chart.legend.x*=rx;state.chart.legend.y*=ry;state.chart.legendFrame.x*=rx;state.chart.legendFrame.y*=ry;
  if(!state.chart.legendFrame.autoSize){state.chart.legendFrame.width*=rx;state.chart.legendFrame.height*=ry}
  s.canvasWidth=Math.round(newW);s.canvasHeight=Math.round(newH);
}
function applyCanvasPreset(value){
  const map={normal:[980,660],small:[760,540],square:[700,700],wide:[1080,620],tall:[820,760]};
  if(map[value])setCanvasSize(map[value][0],map[value][1]);
}

function renderLayers(){
  const gs=chartGroups();const layers=[['section','基础对象'],['title','图题','base'],['subtitle','副标题','base'],['typography','中英文字体','base'],['canvas','画布与清晰度','base'],['legend','图例内容','base'],['legend-frame','图例边框','base'],['axis-y','Y 轴与纵标题','base'],['axis-x','X 轴与横标题','base'],['frame','图片边框','base'],['background','背景','base'],['section','数据对象']];
  gs.forEach((g,i)=>layers.push([`series:${i}`,`数据系列 · ${g}`,'series']));
  if(state.chart.type!=='curve'){layers.push(['error','误差棒','special']);if(!state.analysis?.continuous)layers.push(['letters','显著性字母','special'])}
  if(state.chart.annotations.length){layers.push(['section','标注对象']);state.chart.annotations.forEach((a,i)=>layers.push([`annotation:${a.id}`,`${annotationTypeLabel(a.type)} ${i+1}`,'special']))}
  $('#layersList').innerHTML=layers.map(item=>{if(item[0]==='section')return`<div class="layer-section-label">${item[1]}</div>`;const[id,name,kind]=item;return`<button class="layer-item ${selectedMatches(id)?'active':''}" data-layer="${esc(id)}"><span class="layer-dot"></span>${esc(name)}<span class="layer-tag ${kind==='special'?'special':''}">${kind==='special'?'专属':'基础'}</span></button>`}).join('');
  $$('[data-layer]').forEach(b=>b.addEventListener('click',()=>selectObject(b.dataset.layer)));
}
function selectedMatches(id){if(id.startsWith('series:'))return state.chart.selected==='series'&&Number(id.split(':')[1])===state.chart.selectedSeries;if(id.startsWith('annotation:'))return state.chart.selected===id;return state.chart.selected===id}
function annotationTypeLabel(type){return type==='text'?'文字框':type==='arrow'?'箭头':type==='guide'?'辅助线':type==='peak'?'峰值':'标注'}
function selectObject(id,seriesIndex=null){
  if(id.startsWith('series:')){state.chart.selected='series';state.chart.selectedSeries=Number(id.split(':')[1])}
  else if(id.startsWith('annotation:')){state.chart.selected=id;state.chart.selectedAnnotation=id.split(':')[1]}
  else{state.chart.selected=id;if(seriesIndex!=null)state.chart.selectedSeries=Number(seriesIndex)}
  renderLayers();renderProperties();
  $$('#chartStage .chart-object').forEach(el=>el.classList.toggle('object-selected',el.dataset.object===state.chart.selected&&(state.chart.selected!=='series'||Number(el.dataset.series)===state.chart.selectedSeries)));
}

const SERIES_MARKERS=['circle','square','triangle','triangleDown','diamond','star','pentagon','hexagon','plus','cross'];
function seriesStyleKey(index){
  const groups=chartGroups();
  return String(groups[index]??`Series ${index+1}`);
}
function defaultSeriesStyle(index){
  const s=state.chart.settings;
  return {lineWidth:s.lineWidth,markerSize:s.markerSize,markerShape:SERIES_MARKERS[index%SERIES_MARKERS.length],markerFill:s.markerFill};
}
function getSeriesStyle(index){
  if(!state.chart.seriesStyles||typeof state.chart.seriesStyles!=='object')state.chart.seriesStyles={};
  const key=seriesStyleKey(index);
  if(!state.chart.seriesStyles[key])state.chart.seriesStyles[key]=defaultSeriesStyle(index);
  return state.chart.seriesStyles[key];
}
function getSeriesSetting(index,key){return getSeriesStyle(index)[key]}
function setSeriesSetting(index,key,value){getSeriesStyle(index)[key]=value}
function ensureSeriesStyles(){const groups=chartGroups();ensurePalette(groups.length);groups.forEach((_,i)=>getSeriesStyle(i))}

function chartBounds(){
  const s=state.chart.settings,vals=(state.chart.type==='curve'?state.chartData.map(d=>d.mean):state.chartData.flatMap(d=>[d.mean-d.error,d.mean+d.error])).filter(Number.isFinite);let min=Math.min(...vals),max=Math.max(...vals);if(!Number.isFinite(min)){min=0;max=1}
  const pad=(max-min||1)*.12;min=s.yMin??(min-pad);max=s.yMax??(max+pad);if(max<=min)max=min+1;
  if(s.yTickRound&&s.yMin==null&&s.yMax==null){const step=niceAxisStep(max-min,s.yAxisSegments||6);min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step}
  return{min,max};
}
function chartYTicks(b){const s=state.chart.settings;if(Number.isFinite(s.yTickStep)&&s.yTickStep>0)return makeTicks(b.min,b.max,s.yTickStep,6);const n=clamp(Math.round(Number(s.yAxisSegments)||6),1,30);return Array.from({length:n+1},(_,i)=>b.min+(b.max-b.min)*i/n)}

function renderChart(){
  const {W,H}=chartDimensions(),M={l:106,r:80,t:82,b:105},plotW=W-M.l-M.r,plotH=H-M.t-M.b,s=state.chart.settings,colors=state.chart.palette;
  let svg=`<svg id="paperSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="FoodLab figure" style="font-family:${esc(fontStack())};font-weight:${s.globalFontWeight||400};background:${s.background}"><defs><filter id="legendShadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="${s.legendShadowX||0}" dy="${s.legendShadowY||0}" stdDeviation="${s.legendShadowBlur||0}" flood-color="#263238" flood-opacity="${s.legendShadowOpacity??.28}"/></filter><marker id="chartAnnotationArrow" markerWidth="9" markerHeight="9" refX="7.2" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,7 L8,3.5 z" fill="context-stroke"/></marker></defs><rect data-object="background" class="chart-object" width="${W}" height="${H}" fill="${s.background}"/>`;
  if(s.titleVisible&&s.title)svg+=`<text data-object="title" data-drag="title" class="chart-object draggable" x="${s.titleX}" y="${s.titleY}" text-anchor="middle" font-size="${s.titleSize}" font-weight="${s.titleWeight}" fill="${s.titleColor}">${esc(s.title)}</text>`;if(s.subtitleEnabled&&s.subtitle)svg+=`<text data-object="subtitle" data-drag="subtitle" class="chart-object draggable" x="${s.subtitleX}" y="${s.subtitleY}" text-anchor="middle" font-size="${s.subtitleSize}" font-weight="${s.subtitleWeight}" fill="${s.subtitleColor}">${esc(s.subtitle)}</text>`;
  if(!state.chartData.length){svg+=`<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#87939c">请先导入原始数据并完成统计分析</text></svg>`;$('#chartStage').innerHTML=svg;return}
  const xvals=chartXs(),gs=chartGroups(),bounds=chartBounds();ensureSeriesStyles();
  svg+=state.chart.breakAxis?renderBrokenPlot(W,H,M,plotW,plotH,xvals,gs,colors):renderNormalPlot(W,H,M,plotW,plotH,xvals,gs,colors,bounds);
  svg+=renderExperimentAnnotations(M,plotW,plotH,xvals,bounds);
  svg+=renderLegendFrame(gs,colors);svg+=renderLegend(gs,colors);svg+='</svg>';$('#chartStage').innerHTML=svg;bindChartObjects();bindDraggables();
}

function isLineChart(){return state.chart.type==='line'}
function isCurveChart(){return state.chart.type==='curve'}
function isLineLike(){return isLineChart()||isCurveChart()}
function seriesMarkersVisible(){return isLineLike()&&chartXs().length<=120}
function seriesPath(coords){
  return isCurveChart()||state.chart.settings.lineMode==='smooth'
    ? smoothPath(coords)
    : coords.map((p,i)=>(i?'L':'M')+p[0]+','+p[1]).join(' ');
}
function renderXAxisTopOverlay(M,plotW,axisY,xvals,xStep){
  const s=state.chart.settings;
  const under=Math.max(Number(s.axisWidth)+Math.max(1.5,Number(s.barBorderWidth)||0),Number(s.axisWidth)+1.2);
  let out=`<g data-object="axis-x" class="chart-object axis-top-overlay" fill="none" stroke-linecap="butt" pointer-events="all"><path d="M${M.l},${axisY} H${M.l+plotW}" stroke="${s.background}" stroke-width="${under}"/><path d="M${M.l},${axisY} H${M.l+plotW}" stroke="${s.axisColor}" stroke-width="${s.axisWidth}"/>`;
  if(s.showXTicks)experimentXAxisTickObjects(xvals,M,plotW).forEach(t=>{out+=`<line x1="${t.x}" x2="${t.x}" y1="${axisY}" y2="${axisY+s.tickLength}" stroke="${s.axisColor}" stroke-width="${s.axisWidth}"/>`});
  return out+'</g>';
}

function renderNormalPlot(W,H,M,plotW,plotH,xvals,gs,colors,b){
  const s=state.chart.settings,model=getChartModel(),xCfg=experimentXAxisConfig(xvals,M,plotW),y=v=>M.t+(b.max-v)/(b.max-b.min)*plotH,xStep=plotW/xvals.length,axisY=M.t+plotH;let out='';
  const yTicks=chartYTicks(b),axes=renderNormalAxes(W,H,M,plotW,plotH,xvals,xStep,yTicks,y,axisY);
  if(isLineLike()){
    gs.forEach((g,gi)=>{
      const pts=model.byGroup.get(String(g))||[],c=colors[gi%colors.length],positions=pts.map(d=>{const idx=model.xIndex.get(String(d.x))??0;return{d,xx:xCfg?xCfg.pos(Number(convertXValue(d.x))):xBaseAt(idx,xStep,M),yy:y(d.mean)}}),coords=positions.map(p=>[p.xx,p.yy]);
      if(coords.length>1)out+=`<path data-object="series" data-series="${gi}" class="chart-object" d="${seriesPath(coords)}" fill="none" stroke="${c}" stroke-width="${getSeriesStyle(gi).lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if(isLineChart()&&positions.length){let errorPath='';positions.forEach(p=>{const e=Math.abs(y(p.d.mean+p.d.error)-p.yy),cap=s.errorCap/2;errorPath+=`M${p.xx},${p.yy-e}V${p.yy+e}M${p.xx-cap},${p.yy-e}H${p.xx+cap}M${p.xx-cap},${p.yy+e}H${p.xx+cap}`});const errorColor=s.errorColorMode==='black'?s.axisColor:c;out+=`<path data-object="error" data-series="${gi}" class="chart-object" d="${errorPath}" fill="none" stroke="${errorColor}" stroke-width="${s.errorWidth}"/>`}
      if(seriesMarkersVisible())positions.forEach(p=>out+=markerSvg(p.xx,p.yy,c,gi));
      if(isLineChart()&&s.letters)positions.forEach(p=>{if(p.d.letter){const e=Math.abs(y(p.d.mean+p.d.error)-p.yy);out+=letterSvg(p.xx,p.yy-e-s.letterOffset,p.d.letter)}});
    });
  }else{
    const groupW=xStep*s.categoryWidth,barW=groupW/gs.length;
    xvals.forEach((x,i)=>gs.forEach((g,gi)=>{const d=model.byKey.get(`${String(x)}${String(g)}`);if(!d)return;const w=Math.max(1,barW-s.barGap),xx=M.l+(i+.5)*xStep-groupW/2+gi*barW+s.barGap/2,yy=y(d.mean),base=y(Math.max(b.min,0)),barBottom=base-Math.max(.5,s.axisWidth/2),h=Math.max(0,barBottom-yy),c=colors[gi%colors.length];
      out+=`<rect data-object="series" data-series="${gi}" class="chart-object" x="${xx}" y="${yy}" width="${w}" height="${h}" fill="${c}" fill-opacity="${s.barOpacity}" stroke="${darken(c,.25)}" stroke-width="${s.barBorderWidth}"/>`;
      const cx=xx+w/2,e=Math.abs(y(d.mean+d.error)-yy);out+=errorSvg(cx,yy,e,c,gi);if(s.letters&&d.letter)out+=letterSvg(cx,yy-e-s.letterOffset,d.letter);
    }));
  }
  out+=axes;out+=renderXAxisTopOverlay(M,plotW,axisY,xvals,xStep);return out;
}

function renderNormalAxes(W,H,M,plotW,plotH,xvals,xStep,yTicks,y,axisY){
  const s=state.chart.settings;let out='';
  out+=`<g data-object="axis-y" class="chart-object" stroke="${s.axisColor}" stroke-width="${s.axisWidth}" fill="none"><path d="M${M.l},${M.t} V${axisY}"/>`;
  if(s.showYTicks)yTicks.forEach(v=>{const yy=y(v);out+=`<line x1="${M.l-s.tickLength}" x2="${M.l}" y1="${yy}" y2="${yy}"/>`});out+='</g>';
  const yStep=yTicks.length>1?yTicks[1]-yTicks[0]:1;
  yTicks.forEach(v=>out+=`<text data-object="axis-y" class="chart-object" x="${M.l-s.tickLength-6}" y="${y(v)+4}" text-anchor="end" font-size="${s.yTickSize}" font-weight="${s.yTickWeight||s.globalFontWeight||400}" fill="${s.yTickColor}">${formatAxisNumber(v,s.yTickDecimals,yStep,s.yTickRound)}</text>`);
  out+=`<g data-object="axis-x" class="chart-object" stroke="${s.axisColor}" stroke-width="${s.axisWidth}" fill="none"><path d="M${M.l},${axisY} H${M.l+plotW}"/>`;
  const tickObjects=experimentXAxisTickObjects(xvals,M,plotW);
  if(s.showXTicks)tickObjects.forEach(t=>{out+=`<line x1="${t.x}" x2="${t.x}" y1="${axisY}" y2="${axisY+s.tickLength}"/>`});out+='</g>';
  const labels=tickObjects.map(t=>t.label),rotation=automaticXTickRotation(labels);
  tickObjects.forEach((t,j)=>{const layout={rotate:rotation,dy:(!s.xTickAutoRotate&&s.xTickStagger&&rotation===0?(j%2)*14:0),anchor:rotation<0?'end':rotation>0?'start':'middle'},yy=axisY+s.tickLength+18+layout.dy;out+=`<text data-object="axis-x" class="chart-object" x="${t.x}" y="${yy}" text-anchor="${layout.anchor}" font-size="${s.xTickSize}" font-weight="${s.xTickWeight||s.globalFontWeight||400}" fill="${s.xTickColor}" transform="rotate(${layout.rotate} ${t.x} ${yy})">${esc(t.label)}</text>`});
  out+=renderFrame(M,plotW,plotH,false);
  out+=axisTitles();return out;
}

function renderBrokenPlot(W,H,M,plotW,plotH,xvals,gs,colors){
  const s=state.chart.settings,model=getChartModel(),xCfg=experimentXAxisConfig(xvals,M,plotW),gap=clamp(s.breakGap,8,28),usable=plotH-gap,lowerH=usable*clamp(s.lowerRatio,.12,.42),upperH=usable-lowerH,upperBottom=M.t+upperH,lowerTop=upperBottom+gap,axisY=M.t+plotH;
  const loMin=s.lowerMin,loMax=s.lowerMax,hiMin=s.upperMin,hiMax=s.upperMax;
  if(!(loMax>loMin&&hiMax>hiMin&&hiMin>loMax)){return `<text x="490" y="320" text-anchor="middle" fill="#b33b3b">断轴范围无效：应满足 下段最小值 &lt; 下段最大值 &lt; 上段最小值 &lt; 上段最大值</text>`}
  const yLower=v=>lowerTop+(loMax-v)/(loMax-loMin)*lowerH,yUpper=v=>M.t+(hiMax-v)/(hiMax-hiMin)*upperH,xStep=plotW/xvals.length;let out='';
  out+=`<defs><clipPath id="clipUpper"><rect x="${M.l}" y="${M.t}" width="${plotW}" height="${upperH}"/></clipPath><clipPath id="clipLower"><rect x="${M.l}" y="${lowerTop}" width="${plotW}" height="${lowerH}"/></clipPath></defs>`;
  const axes=renderBrokenAxes(W,H,M,plotW,plotH,xvals,xStep,yLower,yUpper,upperBottom,lowerTop,axisY);
  if(state.chart.type==='bar'){
    const groupW=xStep*s.categoryWidth,barW=groupW/gs.length;
    xvals.forEach((x,i)=>gs.forEach((g,gi)=>{const d=model.byKey.get(`${String(x)}\u0001${String(g)}`);if(!d)return;const c=colors[gi%colors.length],w=Math.max(1,barW-s.barGap),xx=M.l+(i+.5)*xStep-groupW/2+gi*barW+s.barGap/2,cx=xx+w/2;
      if(d.mean>loMin){const topVal=Math.min(d.mean,loMax),ly=yLower(topVal),lh=Math.max(0,axisY-Math.max(.5,s.axisWidth/2)-ly);out+=`<rect data-object="series" data-series="${gi}" class="chart-object" x="${xx}" y="${ly}" width="${w}" height="${lh}" fill="${c}" fill-opacity="${s.barOpacity}" stroke="${darken(c,.25)}" stroke-width="${s.barBorderWidth}" clip-path="url(#clipLower)"/>`}
      if(d.mean>=hiMin){const uy=yUpper(d.mean),uh=upperBottom-uy;out+=`<rect data-object="series" data-series="${gi}" class="chart-object" x="${xx}" y="${uy}" width="${w}" height="${uh}" fill="${c}" fill-opacity="${s.barOpacity}" stroke="${darken(c,.25)}" stroke-width="${s.barBorderWidth}" clip-path="url(#clipUpper)"/>`;const e=Math.abs(yUpper(d.mean+d.error)-uy);out+=errorSvg(cx,uy,e,c,gi,'clipUpper');if(s.letters&&d.letter)out+=letterSvg(cx,uy-e-s.letterOffset,d.letter)}
    }));
  }else{
    gs.forEach((g,gi)=>{const c=colors[gi%colors.length],pts=model.byGroup.get(String(g))||[];
      ['upper','lower'].forEach(region=>{const mapped=pts.map(d=>({d,xx:xCfg?xCfg.pos(Number(convertXValue(d.x))):xBaseAt(model.xIndex.get(String(d.x))??0,xStep,M),region:d.mean>=hiMin?'upper':d.mean<=loMax?'lower':'gap'})).filter(p=>p.region===region);if(mapped.length>1){const yy=p=>region==='upper'?yUpper(p.d.mean):yLower(p.d.mean);const coords=mapped.map(p=>[p.xx,yy(p)]);out+=`<path data-object="series" data-series="${gi}" class="chart-object" d="${seriesPath(coords)}" fill="none" stroke="${c}" stroke-width="${getSeriesStyle(gi).lineWidth}" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#clip${region==='upper'?'Upper':'Lower'})"/>`}}
      );
      pts.forEach(d=>{const region=d.mean>=hiMin?'upper':d.mean<=loMax?'lower':null;if(!region)return;const idx=model.xIndex.get(String(d.x))??0,xx=xCfg?xCfg.pos(Number(convertXValue(d.x))):xBaseAt(idx,xStep,M),yy=region==='upper'?yUpper(d.mean):yLower(d.mean),map=region==='upper'?yUpper:yLower,e=Math.abs(map(d.mean+d.error)-yy);if(isLineChart())out+=errorSvg(xx,yy,e,c,gi,region==='upper'?'clipUpper':'clipLower');if(seriesMarkersVisible())out+=markerSvg(xx,yy,c,gi);if(isLineChart()&&s.letters&&d.letter)out+=letterSvg(xx,yy-e-s.letterOffset,d.letter)});
    });
  }
  out+=axes;
  out+=renderXAxisTopOverlay(M,plotW,axisY,xvals,xStep);
  return out;
}

function renderBrokenAxes(W,H,M,plotW,plotH,xvals,xStep,yLower,yUpper,upperBottom,lowerTop,axisY){
  const s=state.chart.settings,lowerTicks=makeTicks(s.lowerMin,s.lowerMax,null,3),upperTicks=makeTicks(s.upperMin,s.upperMax,null,4);let out='';
  out+=brokenVerticalGroup(M.l,M.t,axisY,upperBottom,lowerTop,'axis-y',s.axisColor,s.axisWidth);
  if(s.showYTicks){
    lowerTicks.forEach(v=>{const yy=yLower(v);out+=`<line data-object="axis-y" class="chart-object" x1="${M.l-s.tickLength}" x2="${M.l}" y1="${yy}" y2="${yy}" stroke="${s.axisColor}" stroke-width="${s.axisWidth}"/>`});
    upperTicks.forEach(v=>{const yy=yUpper(v);out+=`<line data-object="axis-y" class="chart-object" x1="${M.l-s.tickLength}" x2="${M.l}" y1="${yy}" y2="${yy}" stroke="${s.axisColor}" stroke-width="${s.axisWidth}"/>`})
  }
  lowerTicks.forEach(v=>out+=`<text data-object="axis-y" class="chart-object" x="${M.l-s.tickLength-6}" y="${yLower(v)+4}" text-anchor="end" font-size="${s.yTickSize}" font-weight="${s.yTickWeight||s.globalFontWeight||400}" fill="${s.yTickColor}">${formatTick(v)}</text>`);
  upperTicks.forEach(v=>out+=`<text data-object="axis-y" class="chart-object" x="${M.l-s.tickLength-6}" y="${yUpper(v)+4}" text-anchor="end" font-size="${s.yTickSize}" font-weight="${s.yTickWeight||s.globalFontWeight||400}" fill="${s.yTickColor}">${formatTick(v)}</text>`);
  out+=`<g data-object="axis-x" class="chart-object" stroke="${s.axisColor}" stroke-width="${s.axisWidth}" fill="none"><path d="M${M.l},${axisY} H${M.l+plotW}"/>`;
  const tickObjects=experimentXAxisTickObjects(xvals,M,plotW);
  if(s.showXTicks)tickObjects.forEach(t=>{out+=`<line x1="${t.x}" x2="${t.x}" y1="${axisY}" y2="${axisY+s.tickLength}"/>`});out+='</g>';
  const labels=tickObjects.map(t=>t.label),rotation=automaticXTickRotation(labels);
  tickObjects.forEach((t,j)=>{const layout={rotate:rotation,dy:(!s.xTickAutoRotate&&s.xTickStagger&&rotation===0?(j%2)*14:0),anchor:rotation<0?'end':rotation>0?'start':'middle'},yy=axisY+s.tickLength+18+layout.dy;out+=`<text data-object="axis-x" class="chart-object" x="${t.x}" y="${yy}" text-anchor="${layout.anchor}" font-size="${s.xTickSize}" font-weight="${s.xTickWeight||s.globalFontWeight||400}" fill="${s.xTickColor}" transform="rotate(${layout.rotate} ${t.x} ${yy})">${esc(t.label)}</text>`});
  out+=renderFrame(M,plotW,plotH,true,upperBottom,lowerTop,axisY);out+=axisTitles();return out;
}

function brokenVerticalGroup(x,top,bottom,upperBottom,lowerTop,obj,color,width){
  const half=7,dy=5;
  const c1=upperBottom,c2=lowerTop;
  return `<g data-object="${obj}" class="chart-object" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="square" stroke-linejoin="miter"><path d="M${x},${top} V${c1} M${x},${c2} V${bottom}"/><path d="M${x-half},${c1-dy} L${x+half},${c1+dy} M${x-half},${c2-dy} L${x+half},${c2+dy}"/></g>`;
}

function renderFrame(M,plotW,plotH,broken=false,upperBottom=null,lowerTop=null,axisY=null){
  const s=state.chart.settings,mode=s.frameMode;if(mode==='none'||mode==='lb')return'';const right=M.l+plotW,bottom=M.t+plotH;let out=`<g data-object="frame" class="chart-object" stroke="${s.frameColor}" stroke-width="${s.frameWidth}" fill="none">`;
  if(mode==='box')out+=`<path d="M${M.l},${M.t} H${right}"/>`;
  if(mode==='box'||mode==='lbr')out+=broken?brokenVerticalGroup(right,M.t,axisY,upperBottom,lowerTop,'frame',s.frameColor,s.frameWidth).replace(/^<g[^>]*>|<\/g>$/g,''):`<path d="M${right},${M.t} V${bottom}"/>`;
  return out+'</g>';
}

function axisTitles(){
  const s=state.chart.settings;let out='';if(s.xTitleVisible&&s.xTitle)out+=`<text data-object="axis-x" data-drag="xTitle" class="chart-object draggable" x="${s.xTitleX}" y="${s.xTitleY}" text-anchor="middle" font-size="${s.xTitleSize}" font-weight="${s.xTitleWeight||s.globalFontWeight||400}" fill="${s.xTitleColor}">${esc(convertedXTitle())}</text>`;if(s.yTitleVisible&&s.yTitle)out+=`<text data-object="axis-y" data-drag="yTitle" class="chart-object draggable" transform="translate(${s.yTitleX} ${s.yTitleY}) rotate(-90)" text-anchor="middle" font-size="${s.yTitleSize}" font-weight="${s.yTitleWeight||s.globalFontWeight||400}" fill="${s.yTitleColor}">${esc(s.yTitle)}</text>`;return out;
}

function regularPolygonPoints(x,y,r,n,rotation=-Math.PI/2){
  return Array.from({length:n},(_,i)=>{const a=rotation+i*Math.PI*2/n;return `${x+Math.cos(a)*r},${y+Math.sin(a)*r}`}).join(' ');
}
function starPoints(x,y,r){
  return Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,rr=i%2===0?r:r*.45;return `${x+Math.cos(a)*rr},${y+Math.sin(a)*rr}`}).join(' ');
}
function markerShapeSvg(shape,x,y,r,attrs){
  if(shape==='square')return`<rect ${attrs} x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}"/>`;
  if(shape==='triangle')return`<path ${attrs} d="M${x},${y-r*1.25} L${x+r*1.15},${y+r} L${x-r*1.15},${y+r} Z"/>`;
  if(shape==='triangleDown')return`<path ${attrs} d="M${x-r*1.15},${y-r} L${x+r*1.15},${y-r} L${x},${y+r*1.25} Z"/>`;
  if(shape==='diamond')return`<path ${attrs} d="M${x},${y-r*1.25} L${x+r*1.1},${y} L${x},${y+r*1.25} L${x-r*1.1},${y} Z"/>`;
  if(shape==='star')return`<polygon ${attrs} points="${starPoints(x,y,r*1.25)}"/>`;
  if(shape==='pentagon')return`<polygon ${attrs} points="${regularPolygonPoints(x,y,r*1.2,5)}"/>`;
  if(shape==='hexagon')return`<polygon ${attrs} points="${regularPolygonPoints(x,y,r*1.15,6)}"/>`;
  if(shape==='plus')return`<path ${attrs} fill="none" stroke-linecap="round" d="M${x-r*1.2},${y} H${x+r*1.2} M${x},${y-r*1.2} V${y+r*1.2}"/>`;
  if(shape==='cross')return`<path ${attrs} fill="none" stroke-linecap="round" d="M${x-r},${y-r} L${x+r},${y+r} M${x+r},${y-r} L${x-r},${y+r}"/>`;
  return`<circle ${attrs} cx="${x}" cy="${y}" r="${r}"/>`;
}
function markerSvg(x,y,c,series){
  const st=getSeriesStyle(series),fill=st.markerFill==='series'?c:st.markerFill,r=st.markerSize;
  const common=`data-object="series" data-series="${series}" class="chart-object" fill="${fill}" stroke="${c}" stroke-width="${Math.max(1.5,st.lineWidth*.72)}"`;
  return markerShapeSvg(st.markerShape,x,y,r,common);
}

function errorSvg(x,y,e,c,series,clipId=''){
  const s=state.chart.settings,color=s.errorColorMode==='black'?s.axisColor:c,clip=clipId?` clip-path="url(#${clipId})"`:'';
  return `<g data-object="error" data-series="${series}" class="chart-object" stroke="${color}" stroke-width="${s.errorWidth}"${clip}><line x1="${x}" x2="${x}" y1="${y-e}" y2="${y+e}"/><line x1="${x-s.errorCap/2}" x2="${x+s.errorCap/2}" y1="${y-e}" y2="${y-e}"/><line x1="${x-s.errorCap/2}" x2="${x+s.errorCap/2}" y1="${y+e}" y2="${y+e}"/></g>`;
}
function letterSvg(x,y,text){const s=state.chart.settings;return`<text data-object="letters" class="chart-object" x="${x}" y="${y}" text-anchor="middle" font-size="${s.letterSize}" font-weight="${s.letterWeight||400}">${esc(text)}</text>`}

function legendLayout(gs,colors){
  const s=state.chart.settings,font=s.legendSize,rowH=Math.max(25,font*1.55),symbolW=Math.max(18,font*1.15),textGap=Math.max(9,font*.55),itemGap=Math.max(18,font*.9),colGap=Math.max(18,font*1.1);
  const horizontal=s.legendOrientation!=='vertical';
  const requested=Math.max(1,Math.round(Number(s.legendColumns)||1));
  const cols=horizontal?Math.min(gs.length,requested===1?gs.length:requested):1;
  const rows=Math.ceil(gs.length/cols);
  const labelWidths=gs.map(g=>Math.max(20,String(g).length*font*.62));
  const itemWidths=gs.map((g,i)=>symbolW+textGap+labelWidths[i]);
  const colWidths=Array(cols).fill(0);
  itemWidths.forEach((w,i)=>{colWidths[i%cols]=Math.max(colWidths[i%cols],w)});
  const colX=[];let cursor=0;for(let c=0;c<cols;c++){colX[c]=cursor;cursor+=colWidths[c]+(c<cols-1?colGap:0)}
  let content='';
  gs.forEach((g,i)=>{
    const col=horizontal?i%cols:0,row=horizontal?Math.floor(i/cols):i,ox=colX[col],oy=row*rowH+rowH*.52,c=colors[i%colors.length],st=getSeriesStyle(i);
    if(state.chart.type==='bar')content+=`<rect data-object="legend" x="${ox}" y="${oy-font*.42}" width="${symbolW}" height="${Math.max(12,font*.82)}" fill="${c}" stroke="${darken(c,.25)}" stroke-width="${s.barBorderWidth}"/><text data-object="legend" x="${ox+symbolW+textGap}" y="${oy+font*.18}" dominant-baseline="middle" font-size="${font}" font-weight="${s.legendWeight||s.globalFontWeight||400}">${esc(g)}</text>`;
    else content+=`<line data-object="legend" x1="${ox}" x2="${ox+symbolW}" y1="${oy}" y2="${oy}" stroke="${c}" stroke-width="${st.lineWidth}"/>${seriesMarkersVisible()?markerLegend(ox+symbolW/2,oy,c,i):''}<text data-object="legend" x="${ox+symbolW+textGap}" y="${oy+font*.12}" dominant-baseline="middle" font-size="${font}" font-weight="${s.legendWeight||s.globalFontWeight||400}">${esc(g)}</text>`;
  });
  return {content,width:cursor,height:Math.max(rowH,rows*rowH),padX:14,padY:10};
}
function legendFrameSvg(width,height){
  const s=state.chart.settings,style=s.legendFrameStyle;
  if(style==='none')return'';
  const x=0,y=0,w=width,h=height,r=s.legendFrameRadius??2,stroke=s.legendFrameColor||'#7d898f',sw=s.legendFrameWidth||1;
  const dash=style==='dashed'?'8 5':style==='dotted'?'2 4':'';
  if(style==='double')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${s.legendFrameFill||'#ffffff'}" stroke="${stroke}" stroke-width="${sw}"/><rect x="${x+4}" y="${y+4}" width="${Math.max(1,w-8)}" height="${Math.max(1,h-8)}" rx="${Math.max(0,r-1)}" fill="none" stroke="${stroke}" stroke-width="${Math.max(.6,sw*.75)}"/>`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${s.legendFrameFill||'#ffffff'}" stroke="${stroke}" stroke-width="${sw}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
}
function renderLegendFrame(gs,colors){
  const s=state.chart.settings;if(!s.legendVisible||gs.length<=1||s.legendFrameStyle==='none')return'';
  const layout=legendLayout(gs,colors),lf=state.chart.legendFrame;
  const autoW=layout.width+layout.padX*2,autoH=layout.height+layout.padY*2;
  const w=lf.autoSize?autoW:Math.max(20,Number(lf.width)||autoW),h=lf.autoSize?autoH:Math.max(20,Number(lf.height)||autoH);
  const shadow=s.legendShadow?' filter="url(#legendShadow)"':'';
  return `<g id="legendFrameGroup" data-object="legend-frame" data-drag="legendFrame" class="chart-object draggable" transform="translate(${lf.x} ${lf.y})"${shadow}>${legendFrameSvg(w,h)}</g>`;
}
function renderLegend(gs,colors){
  const s=state.chart.settings;if(!s.legendVisible||gs.length<=1)return'';
  ensureSeriesStyles();const layout=legendLayout(gs,colors),x=state.chart.legend.x,y=state.chart.legend.y;
  return `<g id="legendGroup" data-object="legend" data-drag="legend" class="chart-object draggable" transform="translate(${x} ${y})"><g transform="translate(${layout.padX} ${layout.padY})">${layout.content}</g></g>`;
}
function markerLegend(x,y,c,series){
  const st=getSeriesStyle(series),r=Math.min(st.markerSize,Math.max(4.6,state.chart.settings.legendSize*.34)),fill=st.markerFill==='series'?c:st.markerFill;
  return markerShapeSvg(st.markerShape,x,y,r,`fill="${fill}" stroke="${c}" stroke-width="${Math.max(1.2,st.lineWidth*.68)}"`);
}

function bindChartObjects(){
  const stage=$('#chartStage');if(!stage)return;
  stage.onclick=e=>{const el=e.target.closest('.chart-object');if(!el||!stage.contains(el))return;e.stopPropagation();if(el.dataset.annotationId)selectObject(`annotation:${el.dataset.annotationId}`);else selectObject(el.dataset.object,el.dataset.series)};
}

function updateArrowAnnotationDom(group,ann){
  if(!group||!ann)return;
  group.querySelectorAll('[data-ann-line],[data-ann-hit]').forEach(line=>{line.setAttribute('x1',ann.x1);line.setAttribute('y1',ann.y1);line.setAttribute('x2',ann.x2);line.setAttribute('y2',ann.y2)});
  const start=group.querySelector('[data-annotation-handle="start"]'),end=group.querySelector('[data-annotation-handle="end"]');
  if(start)start.setAttribute('transform',`translate(${ann.x1} ${ann.y1})`);if(end)end.setAttribute('transform',`translate(${ann.x2} ${ann.y2})`);
  const label=group.querySelector('[data-ann-label]');if(label){label.setAttribute('x',(ann.x1+ann.x2)/2);label.setAttribute('y',(ann.y1+ann.y2)/2-8)}
}
function bindAnnotationEndpointHandles(svg,store,finish){
  svg.querySelectorAll('[data-annotation-handle]').forEach(handle=>handle.addEventListener('pointerdown',e=>{
    e.preventDefault();e.stopPropagation();const id=handle.dataset.annotationId,ann=store.annotations.find(a=>a.id===id);if(!ann)return;
    store.selectedAnnotation=id;store.selected=`annotation:${id}`;
    const endpoint=handle.dataset.annotationHandle,group=handle.closest('[data-annotation-id],[data-gannotation-id]');handle.setPointerCapture(e.pointerId);handle.classList.add('is-dragging');
    const move=ev=>{const p=svgPoint(svg,ev);if(endpoint==='start'){ann.x1=p.x;ann.y1=p.y}else{ann.x2=p.x;ann.y2=p.y}updateArrowAnnotationDom(group,ann)};
    const endDrag=()=>{handle.classList.remove('is-dragging');handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',endDrag);handle.removeEventListener('pointercancel',endDrag);finish?.()};
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',endDrag);handle.addEventListener('pointercancel',endDrag);
  }));
}

function bindDraggables(){
  const svg=$('#paperSvg');if(!svg)return;
  bindAnnotationEndpointHandles(svg,state.chart,()=>{renderChart();renderLayers();renderProperties()});
  $$('[data-drag]').forEach(el=>{
    el.addEventListener('pointerdown',e=>{
      if(e.target.closest('[data-annotation-handle]'))return;
      e.preventDefault();e.stopPropagation();
      const key=el.dataset.drag,start=svgPoint(svg,e),snapshot=dragSnapshot(key,el);
      el.setPointerCapture(e.pointerId);el.classList.add('dragging');
      const target=key==='annotation'?`annotation:${el.dataset.annotationId}`:key==='legend'?'legend':key==='legendFrame'?'legend-frame':key==='title'?'title':key==='subtitle'?'subtitle':key==='xTitle'?'axis-x':'axis-y';
      selectObject(target);
      const move=ev=>{const p=svgPoint(svg,ev),dx=p.x-start.x,dy=p.y-start.y;applyDrag(key,snapshot,dx,dy,el)};
      const up=()=>{el.classList.remove('dragging');el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);renderChart();renderProperties()};
      el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);
    });
  });
}
function svgPoint(svg,e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())}
function dragSnapshot(key,el=null){
  const s=state.chart.settings;if(key==='annotation'){const ann=state.chart.annotations.find(a=>a.id===el?.dataset.annotationId);return ann?structuredClone(ann):{}}
  if(key==='legend')return{x:state.chart.legend.x,y:state.chart.legend.y};
  if(key==='legendFrame')return{x:state.chart.legendFrame.x,y:state.chart.legendFrame.y};
  if(key==='title')return{x:s.titleX,y:s.titleY};if(key==='subtitle')return{x:s.subtitleX,y:s.subtitleY};
  if(key==='xTitle')return{x:s.xTitleX,y:s.xTitleY};
  return{x:s.yTitleX,y:s.yTitleY};
}
function applyDrag(key,snap,dx,dy,el){
  if(key==='annotation'){
    const ann=state.chart.annotations.find(a=>a.id===el.dataset.annotationId);if(!ann)return;
    if(ann.type==='text'){ann.x=snap.x+dx;ann.y=snap.y+dy;el.setAttribute('transform',`translate(${ann.x} ${ann.y})`)}
    else if(ann.type==='peak'){ann.dx=snap.dx+dx;ann.dy=snap.dy+dy;el.setAttribute('transform',`translate(${dx} ${dy})`)}
    else{ann.x1=snap.x1+dx;ann.y1=snap.y1+dy;ann.x2=snap.x2+dx;ann.y2=snap.y2+dy;el.setAttribute('transform',`translate(${dx} ${dy})`)}
    return;
  }
  const x=snap.x+dx,y=snap.y+dy,s=state.chart.settings;
  if(key==='legend'){state.chart.legend.x=x;state.chart.legend.y=y;el.setAttribute('transform',`translate(${x} ${y})`)}
  else if(key==='legendFrame'){state.chart.legendFrame.x=x;state.chart.legendFrame.y=y;el.setAttribute('transform',`translate(${x} ${y})`)}
  else if(key==='title'){s.titleX=x;s.titleY=y;el.setAttribute('x',x);el.setAttribute('y',y)}else if(key==='subtitle'){s.subtitleX=x;s.subtitleY=y;el.setAttribute('x',x);el.setAttribute('y',y)}
  else if(key==='xTitle'){s.xTitleX=x;s.xTitleY=y;el.setAttribute('x',x);el.setAttribute('y',y)}
  else{s.yTitleX=x;s.yTitleY=y;el.setAttribute('transform',`translate(${x} ${y}) rotate(-90)`)}
}

function renderProperties(){
  const id=state.chart.selected,s=state.chart.settings,gs=chartGroups();let name='',html='';
  if(id==='title'){name='图题';html=fieldGroup([
    checkField('titleVisible','显示图题'),textField('title','图题文字'),numberField('titleX','水平位置',0,1600,1),numberField('titleY','垂直位置',0,1000,1),rangeField('titleSize','字号',9,36,1),selectField('titleWeight','字重',[['300','细体'],['400','常规'],['500','中等'],['600','半粗'],['700','粗体']]),colorField('titleColor','颜色')
  ]);}
  else if(id==='subtitle'){name='副标题';html=fieldGroup([checkField('subtitleEnabled','显示副标题'),textField('subtitle','副标题文字'),numberField('subtitleX','水平位置',0,1600,1),numberField('subtitleY','垂直位置',0,1000,1),rangeField('subtitleSize','字号',8,28,1),selectField('subtitleWeight','字重',[['300','细体'],['400','常规'],['500','中等'],['600','半粗']]),colorField('subtitleColor','颜色')])+`<div class="hint">副标题可直接拖动；留空或关闭时不显示。</div>`;}
  else if(id==='typography'){name='中英文字体与字重';html=fieldGroup([
    selectField('fontEnglish','英文字体',[['Arial','Arial'],['Times New Roman','Times New Roman'],['Calibri','Calibri'],['Helvetica','Helvetica'],['Georgia','Georgia']]),
    selectField('fontChinese','中文字体',[['Microsoft YaHei','微软雅黑'],['SimSun','宋体'],['SimHei','黑体'],['KaiTi','楷体'],['FangSong','仿宋']]),
    selectField('globalFontWeight','全局文字粗细',[['300','细体'],['400','常规'],['500','中等'],['600','半粗'],['700','粗体']]),
    selectField('xTitleWeight','X轴标题粗细',[['300','细体'],['400','常规'],['500','中等'],['600','半粗'],['700','粗体']]),
    selectField('yTitleWeight','Y轴标题粗细',[['300','细体'],['400','常规'],['500','中等'],['600','半粗'],['700','粗体']]),
    selectField('xTickWeight','X轴数字粗细',[['300','细体'],['400','常规'],['500','中等'],['600','半粗']]),
    selectField('yTickWeight','Y轴数字粗细',[['300','细体'],['400','常规'],['500','中等'],['600','半粗']]),
    selectField('legendWeight','图例文字粗细',[['300','细体'],['400','常规'],['500','中等'],['600','半粗']])
  ])+`<div class="hint">字体与字重已放到图表上方的快捷栏，同时也可以在这里精细设置。</div>`;}
  else if(id==='canvas'){name='画布与导出清晰度';html=fieldGroup([
    selectField('panelPreset','图幅比例',[['normal','常规 980×660'],['small','拼图小图 760×540'],['square','正方图 700×700'],['wide','宽图 1080×620'],['tall','高图 820×760'],['custom','自定义']]),
    numberField('canvasWidth','画布宽度',500,1800,10),numberField('canvasHeight','画布高度',400,1200,10),
    selectField('pngDpi','PNG 清晰度',[['96','96 dpi（屏幕）'],['150','150 dpi'],['300','300 dpi（论文）'],['600','600 dpi（高精度）']])
  ])+`<div class="hint">SVG 为矢量图，不受分辨率限制；PNG 会按画布尺寸与所选 dpi 输出。</div>`;}
  else if(id==='axis-x'){name='X 轴与横坐标标题';html=fieldGroup([
    checkField('xTitleVisible','显示横坐标标题'),textField('xTitle','横坐标标题'),numberField('xTitleX','标题水平位置',0,1600,1),numberField('xTitleY','标题垂直位置',0,1200,1),rangeField('xTitleSize','标题字号',9,36,1),selectField('xTitleWeight','标题字重',[['300','细体'],['400','常规'],['500','中等'],['600','半粗'],['700','粗体']]),colorField('xTitleColor','标题颜色'),
    selectField('xUnitSource','原始时间单位',[['auto','从标题自动识别'],['s','秒 s'],['min','分钟 min'],['h','小时 h']]),selectField('xUnitTarget','显示时间单位',[['original','保持原单位'],['auto','自动选择合适单位'],['s','秒 s'],['min','分钟 min'],['h','小时 h']]),
    selectField('xScaleMode','坐标范围',[['auto','自动读取数据范围'],['manual','手动指定起止值']]),numberField('xAxisMin','起始值',null,null,.01,true),numberField('xAxisMax','结束值',null,null,.01,true),rangeField('xAxisSegments','分段数量',1,30,1),checkField('xTickRound','刻度取整/使用整洁间隔'),selectField('xTickDecimals','数字小数位',[['auto','自动'],['0','整数'],['1','1 位'],['2','2 位'],['3','3 位']]),
    rangeField('axisWidth','坐标轴粗细',.5,5,.1),colorField('axisColor','坐标轴颜色'),rangeField('xTickSize','X轴数字字号',8,30,1),selectField('xTickWeight','X轴数字字重',[['300','细体'],['400','常规'],['500','中等'],['600','半粗'],['700','粗体']]),colorField('xTickColor','X轴数字颜色'),rangeField('tickLength','刻度线长度',0,18,1),checkField('xTickAutoRotate','标签放不下时自动倾斜'),rangeField('xTickRotation','手动旋转角度',-90,90,5),checkField('xTickStagger','关闭自动倾斜后交错换行'),checkField('showXTicks','显示横坐标刻度线')
  ])+`<div class="hint">${esc(xUnitStatusText())} 自动倾斜开启时，标签拥挤会使用 −45° 或 −60°；关闭后才使用手动角度和交错换行。</div>`;}
  else if(id==='axis-y'){name='Y 轴与纵坐标标题';html=fieldGroup([
    checkField('yTitleVisible','显示纵坐标标题'),textField('yTitle','纵坐标标题'),numberField('yTitleX','标题水平位置',0,300,1),numberField('yTitleY','标题垂直位置',0,1200,1),rangeField('yTitleSize','标题字号',9,36,1),selectField('yTitleWeight','标题字重',[['300','细体'],['400','常规'],['500','中等'],['600','半粗'],['700','粗体']]),colorField('yTitleColor','标题颜色'),
    numberField('yMin','最小值',null,null,.01,true),numberField('yMax','最大值',null,null,.01,true),numberField('yTickStep','刻度间隔（留空按分段）',null,null,.01,true),rangeField('yAxisSegments','分段数量',1,20,1),checkField('yTickRound','刻度取整/整洁范围'),selectField('yTickDecimals','数字小数位',[['auto','自动'],['0','整数'],['1','1 位'],['2','2 位'],['3','3 位']]),rangeField('axisWidth','坐标轴粗细',.5,5,.1),colorField('axisColor','坐标轴颜色'),rangeField('yTickSize','Y轴数字字号',8,30,1),selectField('yTickWeight','Y轴数字字重',[['300','细体'],['400','常规'],['500','中等'],['600','半粗'],['700','粗体']]),colorField('yTickColor','Y轴数字颜色'),rangeField('tickLength','刻度线长度',0,18,1),checkField('showYTicks','显示纵坐标刻度线')
  ])+breakPropertyBlock();}
  else if(id==='frame'){name='图片边框';html=fieldGroup([
    selectField('frameMode','边框形式',[['lb','仅左、下轴'],['lbr','左、下、右三边'],['box','完整四边框'],['none','不显示边框']]),rangeField('frameWidth','边框粗细',.5,6,.1),colorField('frameColor','边框颜色')
  ]);}
  else if(id==='series'){const idx=clamp(state.chart.selectedSeries,0,Math.max(0,gs.length-1));name=`数据系列 · ${gs[idx]||'Series'}`;html=fieldGroup([
    colorField(`palette:${idx}`,'当前系列颜色'),rangeField(`series:${idx}:lineWidth`,'本系列折线粗细',.5,7,.1),rangeField(`series:${idx}:markerSize`,'本系列标记大小',1,16,.2),
    markerShapeGrid(idx),
    selectField(`series:${idx}:markerFill`,'本系列标记填充',[['white','白色空心'],['series','同系列颜色']]),
    selectField('lineMode','折线连接方式',[['straight','直线连接'],['smooth','平滑连接']]),
    rangeField('barGap','柱间距',0,16,1),rangeField('categoryWidth','组宽度',.35,.95,.01),rangeField('barOpacity','柱填充透明度',.25,1,.05),rangeField('barBorderWidth','柱边框粗细',0,3,.1)
  ])+`<div class="hint">每条系列的颜色、线宽、标记形状和填充均独立保存。曲线图固定采用平滑连接，且不绘制误差棒和显著性字母。</div>`+paletteBlock();}
  else if(id==='error'){name='误差棒';html=fieldGroup([rangeField('errorWidth','线条粗细',.5,4,.1),rangeField('errorCap','端帽宽度',2,28,1),selectField('errorColorMode','颜色',[['series','跟随系列颜色'],['black','统一黑色']])])+`<div class="hint">当前误差类型：${state.design.errorType==='sd'?'Mean ± SD':state.design.errorType==='se'?'Mean ± SE':'Mean ± 95% CI'}。</div>`;}
  else if(id==='legend'){name='图例内容';html=fieldGroup([checkField('legendVisible','显示图例'),numberLegendField('x','水平位置'),numberLegendField('y','垂直位置'),rangeField('legendSize','字号',8,48,1),orientationButtonField('legendOrientation','排列方向'),rangeField('legendColumns','横向图例列数',1,6,1)])+`<div class="hint">图例内容可以直接拖动。多系列时可以使用多列排版；图例边框在独立图层中单独移动。</div>`;}
  else if(id==='legend-frame'){name='图例边框';html=fieldGroup([
    selectField('legendFrameStyle','边框样式',[['none','无边框'],['solid','实线'],['dashed','虚线'],['dotted','点线'],['double','双线']]),
    numberLegendFrameField('x','水平位置'),numberLegendFrameField('y','垂直位置'),checkLegendFrameField('autoSize','自动适应图例大小'),numberLegendFrameField('width','边框宽度'),numberLegendFrameField('height','边框高度'),
    rangeField('legendFrameWidth','边框粗细',.5,5,.1),colorField('legendFrameColor','边框颜色'),colorField('legendFrameFill','边框底色'),rangeField('legendFrameRadius','圆角',0,18,1),
    checkField('legendShadow','显示阴影'),rangeField('legendShadowX','阴影水平偏移',-10,14,1),rangeField('legendShadowY','阴影垂直偏移',-10,14,1),rangeField('legendShadowBlur','阴影模糊',0,12,.5),rangeField('legendShadowOpacity','阴影透明度',0,.7,.05)
  ])+`<div class="hint">图例边框可独立拖动；阴影只作用于边框，不会锁住图例内容。</div>`;}
  else if(id==='letters'){name='显著性字母';html=fieldGroup([checkField('letters','显示显著性字母'),rangeField('letterSize','字母字号',8,22,1),selectField('letterWeight','字重',[['400','常规（与刻度接近）'],['500','中等'],['600','半粗']]),rangeField('letterOffset','与误差棒间距',3,28,1)])+`<div class="hint">默认字重已改为常规，不再显得比坐标数字更粗。</div>`;}
  else if(id.startsWith('annotation:')){const ann=annotationById(id.split(':')[1]);name=ann?`标注 · ${annotationTypeLabel(ann.type)}`:'标注';html=ann?annotationPropertyHtml(ann):'';}
  else if(id==='background'){name='背景';html=fieldGroup([colorField('background','背景颜色')]);}
  $('#selectedObjectName').textContent=name||'未选择对象';$('#propertyEditor').innerHTML=html||'<div class="empty-state">在图中点击一个对象</div>';const badge=$('#propertyScopeBadge');if(badge){const special=['series','error','letters'].includes(id)||id.startsWith('annotation:');badge.textContent=special?'图形专属':'基础';badge.classList.toggle('chart-specific',special)}bindPropertyInputs();
}

function markerShapeGrid(index){
  const shapes=[['circle','圆'],['square','方'],['triangle','上三角'],['triangleDown','下三角'],['diamond','菱形'],['star','五角星'],['pentagon','五边形'],['hexagon','六边形'],['plus','加号'],['cross','叉号']];
  const current=getSeriesSetting(index,'markerShape');
  return `<div class="field marker-field"><label><span>本系列标记形状</span><output>${shapes.find(x=>x[0]===current)?.[1]||current}</output></label><div class="marker-grid">${shapes.map(([v,l])=>`<button type="button" class="marker-choice ${current===v?'active':''}" data-marker-series="${index}" data-marker-shape="${v}" title="${l}"><span class="marker-icon marker-${v}"></span><small>${l}</small></button>`).join('')}</div></div>`;
}

function annotationPropertyHtml(ann){
  const fonts=[['inherit','跟随图表字体'],['Arial','Arial'],['Times New Roman','Times New Roman'],['Calibri','Calibri'],['Georgia','Georgia'],['Microsoft YaHei','微软雅黑'],['SimSun','宋体'],['SimHei','黑体']];
  let fields='',tip='可直接在图中拖动标注。';
  if(ann.type==='text')fields=annTextField('text','文字内容')+annNumberField('x','水平位置',0,2000,1)+annNumberField('y','垂直位置',0,1400,1)+annSelectField('fontFamily','字体',fonts)+annRangeField('fontSize','字号',8,60,1)+annSelectField('fontWeight','字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']])+annColorField('color','文字颜色')+annColorField('background','文字框底色')+annRangeField('backgroundOpacity','底色透明度',0,1,.05)+annRangeField('padding','内边距',0,30,1)+annColorField('borderColor','边框颜色')+annRangeField('borderWidth','边框粗细',0,6,.1)+annRangeField('cornerRadius','圆角',0,20,1);
  else if(ann.type==='peak')fields=annTextField('customLabel','自定义文字（留空自动）')+annCheckField('showX','显示 X 值')+annCheckField('showY','同时显示 Y 值')+annSelectField('decimals','小数位',[['0','整数'],['1','1 位'],['2','2 位'],['3','3 位']])+annSelectField('guide','辅助虚线',[['none','不显示'],['vertical','垂直到 X 轴'],['horizontal','水平到 Y 轴']])+annNumberField('dx','文字水平偏移',-300,300,1)+annNumberField('dy','文字垂直偏移',-300,300,1)+annSelectField('fontFamily','字体',fonts)+annRangeField('fontSize','字号',8,48,1)+annSelectField('fontWeight','字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']])+annColorField('color','颜色')+annRangeField('width','线宽',.5,5,.1);
  else{fields=annTextField('text','线上文字')+annSelectField('fontFamily','字体',fonts)+annColorField('color','颜色')+annRangeField('width','线宽',.5,6,.1)+annSelectField('dash','线型',[['','实线'],['6 5','虚线'],['2 4','点线'],['10 4 2 4','点划线']])+annCheckField('arrowEnd','显示箭头')+annRangeField('fontSize','文字字号',8,40,1);tip='拖动箭头本体可整体移动；拖动两端圆形手柄可任意改变方向和长度。';}
  return `<div class="object-property-section"><h3>${annotationTypeLabel(ann.type)}设置</h3>${fields}<button id="deleteAnnotation" class="ghost danger wide" type="button">删除此标注</button></div><div class="annotation-drag-tip">${tip}</div>`;
}
function annWrap(k,l,input){const ann=annotationById(currentAnnotationState().selectedAnnotation),v=ann?.[k]??'';return `<div class="field"><label><span>${l}</span><output data-ann-out="${k}">${esc(v)}</output></label>${input}</div>`}
function annTextField(k,l){const ann=annotationById(currentAnnotationState().selectedAnnotation);return annWrap(k,l,`<input data-ann-setting="${k}" type="text" value="${escAttr(ann?.[k]??'')}">`)}
function annNumberField(k,l,min,max,step){const ann=annotationById(currentAnnotationState().selectedAnnotation);return annWrap(k,l,`<input data-ann-setting="${k}" type="number" min="${min}" max="${max}" step="${step}" value="${ann?.[k]??''}">`)}
function annRangeField(k,l,min,max,step){const ann=annotationById(currentAnnotationState().selectedAnnotation);return annWrap(k,l,`<input data-ann-setting="${k}" type="range" min="${min}" max="${max}" step="${step}" value="${ann?.[k]??0}">`)}
function annColorField(k,l){const ann=annotationById(currentAnnotationState().selectedAnnotation);return annWrap(k,l,`<input data-ann-setting="${k}" type="color" value="${ann?.[k]||'#20262b'}">`)}
function annSelectField(k,l,opts){const ann=annotationById(currentAnnotationState().selectedAnnotation),v=ann?.[k]??'';return annWrap(k,l,`<select data-ann-setting="${k}">${opts.map(([x,n])=>`<option value="${x}" ${String(v)===String(x)?'selected':''}>${n}</option>`).join('')}</select>`)}
function annCheckField(k,l){const ann=annotationById(currentAnnotationState().selectedAnnotation);return `<label class="check-row"><input data-ann-setting="${k}" type="checkbox" ${ann?.[k]?'checked':''}>${l}</label>`}

function fieldGroup(items){return items.join('')}
function fieldWrap(label,key,input){return`<div class="field"><label><span>${label}</span><output data-out="${key}">${displaySetting(key)}</output></label>${input}</div>`}
function getSettingValue(k){
  if(k.startsWith('palette:'))return state.chart.palette[Number(k.split(':')[1])];
  if(k.startsWith('legend:'))return state.chart.legend[k.split(':')[1]];
  if(k.startsWith('legendFrame:'))return state.chart.legendFrame[k.split(':')[1]];
  if(k.startsWith('series:')){const [,idx,key]=k.split(':');return getSeriesSetting(Number(idx),key)}
  return state.chart.settings[k]??'';
}
function textField(k,n){return fieldWrap(n,k,`<input data-setting="${k}" type="text" value="${escAttr(getSettingValue(k)??'')}">`)}
function numberField(k,n,min,max,step=1,nullable=false){const v=getSettingValue(k);return fieldWrap(n,k,`<input data-setting="${k}" type="number" ${min!=null?`min="${min}"`:''} ${max!=null?`max="${max}"`:''} step="${step}" value="${v==null&&nullable?'':v??''}" placeholder="自动">`)}
function rangeField(k,n,min,max,step){return fieldWrap(n,k,`<input data-setting="${k}" type="range" min="${min}" max="${max}" step="${step}" value="${getSettingValue(k)}">`)}
function colorField(k,n){const v=getSettingValue(k);return fieldWrap(n,k,`<input data-setting="${k}" type="color" value="${v}">`)}
function selectField(k,n,options){const current=getSettingValue(k);return fieldWrap(n,k,`<select data-setting="${k}">${options.map(([v,l])=>`<option value="${v}" ${String(current)===String(v)?'selected':''}>${l}</option>`).join('')}</select>`)}
function orientationButtonField(k,n){const current=getSettingValue(k)||'horizontal';return `<div class="field"><label><span>${n}</span><output data-out="${k}">${current==='vertical'?'纵向':'横向'}</output></label><div class="orientation-buttons"><button type="button" data-orientation-setting="${k}" data-orientation-value="horizontal" class="${current==='horizontal'?'active':''}">横向</button><button type="button" data-orientation-setting="${k}" data-orientation-value="vertical" class="${current==='vertical'?'active':''}">纵向</button></div></div>`}
function gOrientationButtons(k,l){const current=state.gallery.settings[k]||'horizontal';return `<div class="field"><label><span>${l}</span><output data-gout="${k}">${current==='vertical'?'纵向':'横向'}</output></label><div class="orientation-buttons"><button type="button" data-gorientation="${k}" data-orientation-value="horizontal" class="${current==='horizontal'?'active':''}">横向</button><button type="button" data-gorientation="${k}" data-orientation-value="vertical" class="${current==='vertical'?'active':''}">纵向</button></div></div>`}
function checkField(k,n){return`<label class="check-row"><input data-setting="${k}" type="checkbox" ${getSettingValue(k)?'checked':''}>${n}</label>`}
function numberLegendField(k,n){return fieldWrap(`图例${n}`,`legend:${k}`,`<input data-setting="legend:${k}" type="number" step="1" value="${state.chart.legend[k]}">`)}
function numberLegendFrameField(k,n){return fieldWrap(`边框${n}`,`legendFrame:${k}`,`<input data-setting="legendFrame:${k}" type="number" step="1" value="${state.chart.legendFrame[k]??''}">`)}
function checkLegendFrameField(k,n){return`<label class="check-row"><input data-setting="legendFrame:${k}" type="checkbox" ${state.chart.legendFrame[k]?'checked':''}>${n}</label>`}
function displaySetting(k){return getSettingValue(k)}
function breakPropertyBlock(){const s=state.chart.settings;return `<div class="subhead">真实断轴</div><label class="check-row"><input id="breakFromProp" type="checkbox" ${state.chart.breakAxis?'checked':''}>启用断轴</label><div class="two-col">${numberField('lowerMin','下段最小值',null,null,.01)}${numberField('lowerMax','下段最大值',null,null,.01)}${numberField('upperMin','上段最小值',null,null,.01)}${numberField('upperMax','上段最大值',null,null,.01)}</div>${rangeField('breakGap','两条断裂线间距',6,28,1)}${rangeField('lowerRatio','下段高度比例',.12,.42,.01)}<div class="hint">柱体空白断口与两条平行断裂线中心之间的距离完全一致；断裂线中心直接落在坐标轴端点上。</div>`}
function paletteBlock(){ensurePalette(chartGroups().length);const count=Math.max(6,chartGroups().length);return`<div class="subhead">全部系列配色</div><div class="palette-grid">${state.chart.palette.slice(0,count).map((c,i)=>`<input type="color" data-palette="${i}" value="${c}" title="系列 ${i+1}">`).join('')}</div>`}

function bindPropertyInputs(){
  const applyPropertyInput=el=>{
    const k=el.dataset.setting;let value=el.type==='checkbox'?el.checked:el.value;
    if(el.type==='range'||el.type==='number')value=el.value===''?null:Number(el.value);
    if(k.startsWith('palette:'))state.chart.palette[Number(k.split(':')[1])]=value;
    else if(k.startsWith('legend:'))state.chart.legend[k.split(':')[1]]=value;
    else if(k.startsWith('legendFrame:'))state.chart.legendFrame[k.split(':')[1]]=value;
    else if(k.startsWith('series:')){const [,idx,key]=k.split(':');setSeriesSetting(Number(idx),key,value)}
    else{
      if(k==='canvasWidth'||k==='canvasHeight'){
        const s=state.chart.settings;setCanvasSize(k==='canvasWidth'?value:s.canvasWidth,k==='canvasHeight'?value:s.canvasHeight);s.panelPreset='custom';
      }else{
        state.chart.settings[k]=value;
        if(k==='panelPreset')applyCanvasPreset(value);
      }
    }
    if(k==='legendOrientation'){
      state.chart.settings.legendColumns=value==='vertical'?1:Math.max(2,Math.min(chartGroups().length||3,3));
      renderProperties();
    }
    const o=$(`[data-out="${cssEscape(k)}"]`);if(o)o.textContent=value??'';renderChart();
  };
  $$('[data-setting]').forEach(el=>{el.addEventListener('input',()=>applyPropertyInput(el));el.addEventListener('change',()=>applyPropertyInput(el))});
  $$('[data-orientation-setting]').forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.orientationSetting,value=btn.dataset.orientationValue;state.chart.settings[key]=value;state.chart.settings.legendColumns=value==='vertical'?1:Math.max(2,Math.min(chartGroups().length||3,3));renderProperties();renderChart();
  }));
  $$('[data-palette]').forEach(el=>el.addEventListener('input',()=>{state.chart.palette[Number(el.dataset.palette)]=el.value;renderChart()}));
  $$('[data-marker-shape]').forEach(btn=>btn.addEventListener('click',()=>{setSeriesSetting(Number(btn.dataset.markerSeries),'markerShape',btn.dataset.markerShape);renderChartStudio()}));
  bindCurrentAnnotationInputs();
  const br=$('#breakFromProp');if(br)br.addEventListener('change',()=>{state.chart.breakAxis=br.checked;if(br.checked)autoBreakScale();renderChartStudio()});
}

function bindCurrentAnnotationInputs(){
  $$('[data-ann-setting]').forEach(el=>{const fn=()=>{const store=currentAnnotationState(),ann=store.annotations.find(a=>a.id===store.selectedAnnotation);if(!ann)return;let v=el.type==='checkbox'?el.checked:el.value;if(['number','range'].includes(el.type))v=Number(v);ann[el.dataset.annSetting]=v;const out=$(`[data-ann-out="${el.dataset.annSetting}"]`);if(out)out.textContent=v;renderChartStudio()};el.addEventListener('input',fn);el.addEventListener('change',fn)});
  $('#deleteAnnotation')?.addEventListener('click',removeSelectedAnnotation);
}

function cleanAnnotationEditorArtifacts(root){root.querySelectorAll('.annotation-endpoint-control,.annotation-edit-handle,.annotation-hit-line').forEach(el=>el.remove());return root}
function exportSvg(){const svg=$('#paperSvg');if(!svg)return;const copy=cleanAnnotationEditorArtifacts(svg.cloneNode(true));copy.setAttribute('xmlns','http://www.w3.org/2000/svg');const name=state.chart.mode==='gallery'?workflowChartLabel(state.workflow.chartType):state.design.metricName;download(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}),`${safeFile(state.design.experimentName)}_${safeFile(name)}.svg`)}
function exportPng(){
  const svg=$('#paperSvg');if(!svg)return;
  const galleryMode=state.chart.mode==='gallery',W=galleryMode?Number(state.gallery.settings.width):chartDimensions().W,H=galleryMode?Number(state.gallery.settings.height):chartDimensions().H,dpi=galleryMode?Number(state.gallery.settings.dpi||300):Number(state.chart.settings.pngDpi||300),scale=dpi/96;
  const copy=cleanAnnotationEditorArtifacts(svg.cloneNode(true));copy.setAttribute('width',W);copy.setAttribute('height',H);
  const xml=new XMLSerializer().serializeToString(copy),blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();
  img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);const ctx=canvas.getContext('2d');ctx.fillStyle=galleryMode?state.gallery.settings.background:state.chart.settings.background;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const name=galleryMode?workflowChartLabel(state.workflow.chartType):state.design.metricName;canvas.toBlob(b=>download(b,`${safeFile(state.design.experimentName)}_${safeFile(name)}_${dpi}dpi.png`),'image/png');URL.revokeObjectURL(url)};img.src=url;
}

function saveProject(){
  const payload={version:'0.8.3',savedAt:new Date().toISOString(),workflow:state.workflow,design:state.design,rawData:state.rawData,gallery:state.gallery,chart:state.chart,figureBoard:state.figureBoard};
  localStorage.setItem('foodlab-project',JSON.stringify(payload));download(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`${safeFile(state.design.experimentName)}_FoodLab项目.json`);toast('项目已保存为 JSON，并同步保存在当前浏览器')
}

function mean(a){return a.reduce((s,v)=>s+v,0)/a.length}function sampleSd(a){if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1))}
function levelIndex(v,arr){const i=arr.indexOf(v);return i<0?999:i}
function logGamma(z){const c=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);z-=1;let x=.99999999999980993;for(let i=0;i<c.length;i++)x+=c[i]/(z+i+1);const t=z+c.length-.5;return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x)}
function betaCf(a,b,x){const MAX=200,EPS=3e-10,FPMIN=1e-30;let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;if(Math.abs(d)<FPMIN)d=FPMIN;d=1/d;let h=d;for(let m=1;m<=MAX;m++){let m2=2*m,aa=m*(b-m)*x/((qam+m2)*(a+m2));d=1+aa*d;if(Math.abs(d)<FPMIN)d=FPMIN;c=1+aa/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;h*=d*c;aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<FPMIN)d=FPMIN;c=1+aa/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<EPS)break}return h}
function regIncompleteBeta(x,a,b){if(x<=0)return 0;if(x>=1)return 1;const bt=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log(1-x));return x<(a+1)/(a+b+2)?bt*betaCf(a,b,x)/a:1-bt*betaCf(b,a,1-x)/b}
function fSurvival(F,df1,df2){if(!Number.isFinite(F)||F<0)return NaN;const x=df2/(df2+df1*F);return clamp(regIncompleteBeta(x,df2/2,df1/2),0,1)}
function tCdf(t,df){if(t===0)return .5;const x=df/(df+t*t),ib=regIncompleteBeta(x,df/2,.5);return t>0?1-.5*ib:.5*ib}
function tCritical975(df){if(!Number.isFinite(df)||df<=0)return 1.96;let lo=0,hi=20;for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(tCdf(mid,df)<.975)lo=mid;else hi=mid}return(lo+hi)/2}
function erfApprox(x){const sign=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a),y=1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t)*Math.exp(-a*a);return sign*y}
function normalCdf(x){return .5*(1+erfApprox(x/Math.SQRT2))}
function gammaSeries(a,x){let sum=1/a,del=sum,ap=a;for(let n=1;n<=200;n++){ap++;del*=x/ap;sum+=del;if(Math.abs(del)<Math.abs(sum)*3e-10)break}return sum*Math.exp(-x+a*Math.log(x)-logGamma(a))}
function gammaContinuedFraction(a,x){const FPMIN=1e-30;let b=x+1-a,c=1/FPMIN,d=1/b,h=d;for(let i=1;i<=200;i++){const an=-i*(i-a);b+=2;d=an*d+b;if(Math.abs(d)<FPMIN)d=FPMIN;c=b+an/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<3e-10)break}return Math.exp(-x+a*Math.log(x)-logGamma(a))*h}
function chiSquareSurvival(x,df){if(!(x>=0)||!(df>0))return NaN;const a=df/2,z=x/2;return clamp(z<a+1?1-gammaSeries(a,z):gammaContinuedFraction(a,z),0,1)}
function averageRanks(values){const indexed=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),ranks=Array(values.length),ties=[];for(let i=0;i<indexed.length;){let j=i+1;while(j<indexed.length&&indexed[j].v===indexed[i].v)j++;const rank=(i+1+j)/2;for(let k=i;k<j;k++)ranks[indexed[k].i]=rank;if(j-i>1)ties.push(j-i);i=j}return{ranks,ties}}
function holmAdjust(items){const sorted=items.map((x,i)=>({i,p:clamp(Number(x.pRaw??x.p),0,1)})).sort((a,b)=>a.p-b.p);let prev=0;sorted.forEach((x,rank)=>{const adj=Math.max(prev,Math.min(1,(sorted.length-rank)*x.p));items[x.i].pAdjusted=adj;items[x.i].p=adj;prev=adj});return items}
function starsForP(p){return p<.001?'***':p<.01?'**':p<.05?'*':'ns'}
function welchAnova(groups){
  const usable=groups.filter(g=>g.n>1),k=usable.length;if(k<2)return null;
  const weighted=usable.map(g=>{const variance=sampleSd(g.values)**2;return{...g,variance,w:g.n/Math.max(variance,1e-12)}}),W=weighted.reduce((s,g)=>s+g.w,0),mw=weighted.reduce((s,g)=>s+g.w*g.mean,0)/W;
  const A=weighted.reduce((s,g)=>s+g.w*(g.mean-mw)**2,0)/(k-1),term=weighted.reduce((s,g)=>s+((1-g.w/W)**2)/(g.n-1),0),den=1+2*(k-2)/(k*k-1)*term,F=A/den,df1=k-1,df2=(k*k-1)/(3*term),p=fSurvival(F,df1,df2);
  return{kind:'welch',methodName:'Welch ANOVA',groups:weighted,pMain:p,statistic:F,statName:'F',df1,df2,rows:[{source:'组间（Welch）',ss:null,df:df1,ms:null,F,p},{source:'近似误差自由度',ss:null,df:df2,ms:null,F:null,p:null}]};
}
function welchPairwise(groups){const out=[];for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){const a=groups[i],b=groups[j],va=sampleSd(a.values)**2,vb=sampleSd(b.values)**2,se=Math.sqrt(va/a.n+vb/b.n),t=se?Math.abs(a.mean-b.mean)/se:Infinity,df=(va/a.n+vb/b.n)**2/(((va/a.n)**2)/(a.n-1||1)+((vb/b.n)**2)/(b.n-1||1)),pRaw=Number.isFinite(t)?clamp(2*(1-tCdf(t,df)),0,1):0;out.push({i,j,a:a.label,b:b.label,meanDiff:a.mean-b.mean,t,df,pRaw,p:pRaw})}holmAdjust(out);out.forEach(x=>x.stars=starsForP(x.p));return out}
function kruskalWallis(groups){
  const values=[],owners=[];groups.forEach((g,gi)=>g.values.forEach(v=>{values.push(v);owners.push(gi)}));const N=values.length,k=groups.length;if(k<2||N<3)return null;const {ranks,ties}=averageRanks(values),rankSums=Array(k).fill(0);ranks.forEach((r,i)=>rankSums[owners[i]]+=r);let H=12/(N*(N+1))*groups.reduce((s,g,i)=>s+rankSums[i]**2/g.n,0)-3*(N+1);const tieC=1-ties.reduce((s,t)=>s+(t**3-t),0)/(N**3-N||1);H/=Math.max(tieC,1e-12);const df1=k-1,p=chiSquareSurvival(H,df1);return{kind:'kruskal',methodName:'Kruskal–Wallis',groups,pMain:p,statistic:H,statName:'H',df1,df2:null,rows:[{source:'Kruskal–Wallis',ss:null,df:df1,ms:null,F:H,p}]};
}
function mannWhitneyPairwise(groups){const out=[];for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){const a=groups[i],b=groups[j],values=[...a.values,...b.values],{ranks,ties}=averageRanks(values),R1=ranks.slice(0,a.n).reduce((s,v)=>s+v,0),U1=R1-a.n*(a.n+1)/2,U2=a.n*b.n-U1,U=Math.min(U1,U2),N=a.n+b.n,meanU=a.n*b.n/2,tieTerm=ties.reduce((s,t)=>s+t**3-t,0),variance=a.n*b.n/12*((N+1)-tieTerm/(N*(N-1)||1)),z=variance>0?(Math.abs(U-meanU)-.5)/Math.sqrt(variance):0,pRaw=clamp(2*(1-normalCdf(Math.abs(z))),0,1);out.push({i,j,a:a.label,b:b.label,meanDiff:a.mean-b.mean,U,z,pRaw,p:pRaw})}holmAdjust(out);out.forEach(x=>x.stars=starsForP(x.p));return out}
function lettersFromPairwise(groups,pairs){const labels=groups.map(g=>g.label),sig=Array.from({length:labels.length},()=>Array(labels.length).fill(false));pairs.forEach(r=>{if(r.p<.05)sig[r.i][r.j]=sig[r.j][r.i]=true});const sorted=groups.map((g,i)=>({...g,original:i})).sort((a,b)=>b.mean-a.mean),sortedSig=sorted.map(a=>sorted.map(b=>sig[a.original][b.original]));return compactLetterDisplay(sorted.map(g=>g.label),sortedSig)}
function runUnivariateInference(rows){
  const mapped=rows.map(r=>({a:r.Group,value:r.Value})),base=oneWayAnova(mapped,'a'),groups=base.groups,method=state.gallery.settings.statMethod;
  if(method==='welchHolm'){const omnibus=welchAnova(groups),pairwise=welchPairwise(groups);return{anova:omnibus,pairwise,letters:lettersFromPairwise(groups,pairwise),methodName:statisticalMethodLabel(method)}}
  if(method==='kruskalHolm'){const omnibus=kruskalWallis(groups),pairwise=mannWhitneyPairwise(groups);return{anova:omnibus,pairwise,letters:lettersFromPairwise(groups,pairwise),methodName:statisticalMethodLabel(method)}}
  const pairwise=fisherLsdPairwise(base.groups,base.mse,base.dfError);return{anova:base,pairwise,letters:lettersForComparisons(base.groups.map(g=>({label:g.label,mean:g.mean,n:g.n})),base.mse,base.dfError),methodName:statisticalMethodLabel('anovaLsd')};
}


function makeTicks(min,max,step,count=6){
  if(!(max>min))return[min];let st=Number(step);if(!(st>0))st=niceStep((max-min)/(count-1));const start=Math.ceil((min-1e-10)/st)*st,end=Math.floor((max+1e-10)/st)*st,t=[];for(let v=start,n=0;v<=end+st*1e-8&&n<30;v+=st,n++)t.push(Number(v.toPrecision(12)));if(t.length<2)return[min,max];return t;
}
function niceStep(raw){const exp=Math.floor(Math.log10(Math.abs(raw)||1)),f=raw/10**exp,n=f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10;return n*10**exp}
function niceFloor(v){const st=niceStep(Math.abs(v||1)/5);return Math.floor(v/st)*st}function niceCeil(v){const st=niceStep(Math.abs(v||1)/5);return Math.ceil(v/st)*st}
function formatTick(v){const a=Math.abs(v);return a>=100?formatNumber(v,0):a>=10?formatNumber(v,1):a>=1?formatNumber(v,2):formatNumber(v,3)}
function formatNumber(v,d=3){const n=Number(v);if(!Number.isFinite(n))return'—';if(Number(d)<=0)return Math.round(n).toString();return n.toFixed(d).replace(/(\.\d*?[1-9])0+$|\.0+$/,'$1')}
function formatP(p){if(!Number.isFinite(p))return'—';if(p<.001)return'<0.001';return p.toFixed(3)}function formatPText(p){return`p ${p<.001?'< 0.001':`= ${p.toFixed(3)}`}`}
function darken(hex,amount=.2){const h=hex.replace('#','');if(h.length!==6)return hex;const n=parseInt(h,16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;return'#'+[r,g,b].map(v=>Math.round(v*(1-amount)).toString(16).padStart(2,'0')).join('')}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1200)}
function csvCell(v){const s=String(v??'');return/[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function safeFile(s){return String(s||'FoodLab').replace(/[\\/:*?"<>|]/g,'_').trim()||'FoodLab'}
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1900)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function escAttr(s){return esc(s)}
function cssEscape(s){return String(s).replace(/([:\.])/g,'\\$1')}

// ===== v0.5.0 通用图表库：模板、初步分析与首批通用图形 =====
const GALLERY_SCHEMAS={
  univariate:{name:'单变量长表',columns:['SampleID','Group','Value'],description:'每行一个原始观测值。Group 可用于多组叠加或比较；只有一组时也保留 Group 列。'},
  xy:{name:'XY 关系长表',columns:['SampleID','Group','X','Y','Size'],description:'X、Y 为两个连续变量；Size 仅气泡图使用，普通散点图可以留空。'},
  composition:{name:'组成数据长表',columns:['Category','Component','Value'],description:'Category 为横坐标类别，Component 为类别内部组成；饼图可将 Category 全部填写为 Overall。'},
  matrix:{name:'多指标矩阵',columns:['SampleID','Group','Moisture','pH','TBARS','Color_a','Texture'],description:'每行一个样本，每个数值指标占一列。用于相关性热图，并为后续 PCA、HCA 共用。'},
  radar:{name:'雷达图长表',columns:['Group','Indicator','Value'],description:'每行表示一个组在一个指标上的数值。不同单位的指标建议开启归一化。'}
};

const GALLERY_CHARTS=[
  {id:'hist',category:'数据分布',name:'直方图',schema:'univariate',desc:'观察连续数据的频数或概率密度分布，可按组叠加。'},
  {id:'kde',category:'数据分布',name:'核密度图 KDE',schema:'univariate',desc:'以平滑密度曲线显示分布形态、偏态和多峰特征。'},
  {id:'box',category:'数据分布',name:'箱线图',schema:'univariate',desc:'展示中位数、四分位数、须线与异常值，可叠加原始散点。'},
  {id:'violin',category:'数据分布',name:'小提琴图',schema:'univariate',desc:'结合核密度和箱线统计，同时观察分布形状与分位数。'},
  {id:'scatter',category:'变量关系',name:'散点图',schema:'xy',desc:'分析两个连续变量的关系，可显示 Pearson 相关与线性回归。'},
  {id:'bubble',category:'变量关系',name:'气泡图',schema:'xy',desc:'用 X、Y 和气泡大小同时表达三个变量。'},
  {id:'stacked',category:'组间比较',name:'堆叠条形图',schema:'composition',desc:'展示各类别内部组分构成，可切换原始值或百分比。'},
  {id:'pie',category:'组成比例',name:'饼图 / 圆环图',schema:'composition',desc:'展示少量组分占比。学术论文中应谨慎使用。'},
  {id:'heatmap',category:'多指标关系',name:'相关性热力图',schema:'matrix',desc:'计算数值指标的 Pearson 相关矩阵，并用色阶展示。'},
  {id:'radar',category:'综合评价',name:'雷达图',schema:'radar',desc:'同步比较多项感官或理化指标，可进行组内归一化。'}
];
const GALLERY_GOALS=[
  {id:'dist',name:'看一组数据的分布',desc:'查看偏态、多峰、离群值或分布宽窄。',recommend:[{kind:'gallery',id:'box',reason:'最适合查看中位数、四分位数和异常值。'},{kind:'gallery',id:'violin',reason:'样本量较多时同时展示密度与分位数。'},{kind:'gallery',id:'hist',reason:'需要看频数分布和分箱时使用。'},{kind:'gallery',id:'kde',reason:'需要更平滑地观察分布形态时使用。'}]},
  {id:'compare',name:'比较不同处理组',desc:'看组间差异、离散程度和均值比较。',recommend:[{kind:'gallery',id:'box',reason:'优先推荐，信息量比柱状图更高。'},{kind:'gallery',id:'violin',reason:'适合样本量较多或想看分布形态时使用。'},{kind:'route',id:'bar',name:'分组柱状图',schema:'3平行×技术重复模板',reason:'均值±SD/SE 与显著性字母的常规论文图。'}]},
  {id:'trend',name:'看时间/浓度变化趋势',desc:'适用于储藏时间、处理浓度、温度变化等连续趋势。',recommend:[{kind:'route',id:'line',name:'折线图 / 误差棒折线图',schema:'3平行×技术重复模板',reason:'食品论文中最常见的动态变化图。'},{kind:'route',id:'curve',name:'平滑曲线图',schema:'连续趋势数据',reason:'数据点较密时用平滑曲线表达整体趋势。'},{kind:'route',id:'bar',name:'分组柱状图',schema:'3平行×技术重复模板',reason:'如果更想强调离散时点比较，也可用柱状图。'}]},
  {id:'relation',name:'分析变量之间的关系',desc:'看两个或多个指标是否相关。',recommend:[{kind:'gallery',id:'scatter',reason:'两个连续变量关系的首选图。'},{kind:'gallery',id:'bubble',reason:'需要同时表达第三个变量时使用。'},{kind:'gallery',id:'heatmap',reason:'要同时查看多个指标相关性矩阵时使用。'}]},
  {id:'multi',name:'做综合评价或样本区分',desc:'多个指标共同分析样本差异与综合表现。',recommend:[{kind:'gallery',id:'radar',reason:'多指标综合展示，适合感官或理化综合评价。'},{kind:'gallery',id:'heatmap',reason:'多个指标的高低模式与相关关系。'},{kind:'view',id:'multivar',name:'PCA / PLS-DA',schema:'多指标矩阵',reason:'需要更正式的多元统计区分样本时进入高级分析。'},{kind:'view',id:'cluster',name:'HCA / 热图',schema:'多指标矩阵',reason:'查看样品或指标的聚类关系。'}]},
  {id:'composition',name:'看组分构成或占比',desc:'比较配方、组分或构成比例。',recommend:[{kind:'gallery',id:'stacked',reason:'论文中优先使用堆叠条形图展示组分构成。'},{kind:'gallery',id:'pie',reason:'仅类别较少时可用，学术论文谨慎使用。'}]}
];

function bindGallery(){
  $('#galleryDownloadXlsx')?.addEventListener('click',downloadGalleryXlsx);
  $('#galleryDownloadCsv')?.addEventListener('click',downloadGalleryCsv);
  $('#galleryLoadDemo')?.addEventListener('click',loadGalleryDemo);
  $('#galleryChooseFile')?.addEventListener('click',()=>$('#galleryFileInput').click());
  $('#galleryFileInput')?.addEventListener('change',e=>{if(e.target.files[0])handleGalleryFile(e.target.files[0])});
  $('#galleryClearData')?.addEventListener('click',()=>{state.gallery.rows=[];state.gallery.analysis=null;state.gallery.sourceName='';renderGallery()});
  $('#galleryExportSvg')?.addEventListener('click',exportGallerySvg);
  $('#galleryExportPng')?.addEventListener('click',exportGalleryPng);
  $('#galleryShowAll')?.addEventListener('click',()=>{state.gallery.showAll=!state.gallery.showAll;renderGallery()});
  $('#galleryOpenStudio')?.addEventListener('click',()=>{state.workflow.goal=state.gallery.goal;setWorkflowChart(state.gallery.type,{keepData:true});state.chart.mode='gallery';showView('chart')});
}

function galleryDef(){return GALLERY_CHARTS.find(x=>x.id===state.gallery.type)||GALLERY_CHARTS[2]}
function gallerySchema(){return GALLERY_SCHEMAS[galleryDef().schema]}
function galleryGoal(){return GALLERY_GOALS.find(x=>x.id===state.gallery.goal)||GALLERY_GOALS[1]}
function galleryRecommendations(){return galleryGoal().recommend}
function matchesGoal(chartId){return galleryRecommendations().some(x=>x.kind==='gallery'&&x.id===chartId)}

function renderGallery(){
  if(!$('#galleryChartList'))return;
  const goal=galleryGoal();
  $('#galleryShowAll').textContent=state.gallery.showAll?'只看推荐图形':'显示全部图形';
  $('#galleryGoalChips').innerHTML=GALLERY_GOALS.map(g=>`<button class="goal-chip ${state.gallery.goal===g.id?'active':''}" data-gallery-goal="${g.id}"><b>${esc(g.name)}</b><span>${esc(g.desc)}</span></button>`).join('');
  $$('[data-gallery-goal]').forEach(btn=>btn.addEventListener('click',()=>{state.gallery.goal=btn.dataset.galleryGoal;state.gallery.showAll=false;const rec=galleryRecommendations().find(x=>x.kind==='gallery'); if(rec){state.gallery.type=rec.id; resetGallerySettings();} renderGallery()}));
  $('#galleryRecommendList').innerHTML=galleryRecommendations().map(item=>{
    const name=item.kind==='gallery'?(GALLERY_CHARTS.find(x=>x.id===item.id)?.name||item.id):item.name;
    const schema=item.kind==='gallery'?(GALLERY_SCHEMAS[(GALLERY_CHARTS.find(x=>x.id===item.id)||{}).schema]?.name||''):(item.schema||'');
    const badge=item.kind==='gallery'?'推荐图形':item.kind==='route'?'已有实验图':'高级分析';
    return `<div class="recommend-card ${item.kind}"><span class="recommend-badge">${badge}</span><h3>${esc(name)}</h3><p>${esc(item.reason)}</p><small>${esc(schema)}</small><div class="recommend-actions">${item.kind==='gallery'?`<button class="primary" data-gallery-type="${item.id}">选择此图</button>`:item.kind==='route'?`<button class="primary" data-route-chart="${item.id}">进入绘图</button>`:`<button class="secondary" data-route-view="${item.id}">打开模块</button>`}</div></div>`;
  }).join('');
  const categories=[...new Set(GALLERY_CHARTS.map(x=>x.category))];
  const filtered=state.gallery.showAll?GALLERY_CHARTS:GALLERY_CHARTS.filter(x=>matchesGoal(x.id));
  $('#galleryChartList').innerHTML=categories.map(cat=>{
    const items=filtered.filter(x=>x.category===cat);
    if(!items.length)return '';
    return `<div class="gallery-category"><b>${esc(cat)}</b>${items.map(x=>`<button data-gallery-type="${x.id}" class="gallery-chart-button ${state.gallery.type===x.id?'active':''}"><span>${esc(x.name)}</span><small>${esc(GALLERY_SCHEMAS[x.schema].name)}</small></button>`).join('')}</div>`;
  }).join('')+`<div class="gallery-category"><b>已有实验图</b><button data-route-chart="line" class="gallery-chart-button"><span>折线图 / 误差线图</span><small>3平行×技术重复模板</small></button><button data-route-chart="curve" class="gallery-chart-button"><span>平滑曲线图</span><small>连续趋势数据</small></button><button data-route-chart="bar" class="gallery-chart-button"><span>分组柱状图</span><small>ANOVA 与显著性字母</small></button></div>`;
  $$('[data-gallery-type]').forEach(btn=>btn.addEventListener('click',()=>{state.gallery.type=btn.dataset.galleryType;state.workflow.goal=state.gallery.goal;setWorkflowChart(btn.dataset.galleryType);resetGallerySettings();renderGallery()}));
  $$('[data-route-chart]').forEach(btn=>btn.addEventListener('click',()=>{state.workflow.goal=state.gallery.goal;setWorkflowChart(btn.dataset.routeChart,{keepData:true});const has=state.rawData.length;if(has)showView('chart');else{toast('请先在数据导入步骤加载当前项目模板。');showView('data')}}));
  $$('[data-route-view]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.routeView)));
  const def=galleryDef(),schema=gallerySchema();
  $('#galleryCategory').textContent=def.category;
  $('#galleryTitle').textContent=def.name;
  $('#galleryDescription').textContent=def.desc;
  $('#gallerySchemaBadge').textContent=schema.name;
  $('#galleryTemplateDescription').textContent=schema.description;
  $('#galleryColumnChips').innerHTML=schema.columns.map(c=>`<span>${esc(c)}</span>`).join('');
  $('#galleryDataStatus').textContent=state.gallery.rows.length?`${state.gallery.sourceName||'数据'} · ${state.gallery.rows.length} 行`:'尚未导入数据';
  analyzeGalleryData();
  renderGalleryAnalysis();
  renderGallerySettings();
  renderGalleryChart();
}

function resetGallerySettings(){
  const def=galleryDef(),s=state.gallery.settings;
  s.title=def.name;s.titleVisible=true;s.subtitle='';s.subtitleEnabled=false;s.xTitle=def.schema==='xy'?'X':def.schema==='composition'?'Category':'';s.yTitle=def.schema==='xy'?'Y':def.schema==='univariate'?'Value':def.id==='stacked'?'Value':'';
  s.normalize=false;s.donut=false;s.orientation='vertical';s.showRegression=true;s.showCorrelation=true;s.heatmapShowValues=true;state.gallery.seriesStyles={};state.gallery.selected='title';state.gallery.selectedSeries=0;
}

function galleryTemplateRows(type=state.gallery.type){
  if(['hist','kde','box','violin'].includes(type))return [
    {SampleID:'S001',Group:'Control',Value:5.42},{SampleID:'S002',Group:'Control',Value:5.55},{SampleID:'S003',Group:'Control',Value:5.61},
    {SampleID:'S004',Group:'Treatment A',Value:5.74},{SampleID:'S005',Group:'Treatment A',Value:5.81},{SampleID:'S006',Group:'Treatment A',Value:5.88},
    {SampleID:'S007',Group:'Treatment B',Value:5.63},{SampleID:'S008',Group:'Treatment B',Value:5.70},{SampleID:'S009',Group:'Treatment B',Value:5.76}
  ];
  if(['scatter','bubble'].includes(type))return Array.from({length:15},(_,i)=>({SampleID:`S${String(i+1).padStart(3,'0')}`,Group:i<8?'Control':'Treatment',X:Number((1+i*.45).toFixed(2)),Y:Number((2.1+i*.34+(i%3-.8)*.18).toFixed(2)),Size:type==='bubble'?20+(i%5)*12:''}));
  if(type==='stacked')return [
    {Category:'0 d',Component:'Protein',Value:22},{Category:'0 d',Component:'Fat',Value:12},{Category:'0 d',Component:'Moisture',Value:66},
    {Category:'5 d',Component:'Protein',Value:23},{Category:'5 d',Component:'Fat',Value:13},{Category:'5 d',Component:'Moisture',Value:64},
    {Category:'10 d',Component:'Protein',Value:24},{Category:'10 d',Component:'Fat',Value:14},{Category:'10 d',Component:'Moisture',Value:62}
  ];
  if(type==='pie')return [{Category:'Overall',Component:'Protein',Value:22},{Category:'Overall',Component:'Fat',Value:14},{Category:'Overall',Component:'Moisture',Value:60},{Category:'Overall',Component:'Ash',Value:4}];
  if(type==='heatmap')return Array.from({length:12},(_,i)=>({SampleID:`S${String(i+1).padStart(3,'0')}`,Group:i<6?'Control':'Treatment',Moisture:Number((72-i*.35+(i%2)*.2).toFixed(2)),pH:Number((5.55+i*.035).toFixed(2)),TBARS:Number((.21+i*.045).toFixed(3)),Color_a:Number((12.2-i*.25).toFixed(2)),Texture:Number((34+i*1.8).toFixed(2))}));
  if(type==='radar')return ['Tenderness','Juiciness','Flavor','Color','Acceptability'].flatMap((indicator,i)=>[
    {Group:'Control',Indicator:indicator,Value:[6.2,6.5,6.8,6.0,6.4][i]},
    {Group:'Treatment A',Indicator:indicator,Value:[7.4,7.1,7.6,7.2,7.5][i]},
    {Group:'Treatment B',Indicator:indicator,Value:[6.9,7.5,7.1,7.8,7.2][i]}
  ]);
  return [];
}

function downloadGalleryXlsx(){
  if(!window.XLSX){downloadGalleryCsv();toast('Excel 组件未加载，已下载 CSV 模板');return}
  const def=galleryDef(),schema=gallerySchema(),wb=XLSX.utils.book_new();
  const empty=galleryTemplateRows().map(r=>Object.fromEntries(schema.columns.map(c=>[c,r[c]??''])));
  const ws=XLSX.utils.json_to_sheet(empty,{header:schema.columns});
  ws['!cols']=schema.columns.map(c=>({wch:Math.max(13,c.length+4)}));
  const guide=XLSX.utils.aoa_to_sheet([
    ['FoodLab Studio 通用图表模板'],['图表类型',def.name],['模板结构',schema.name],['填写规则',schema.description],
    ['注意','每行填写一个原始记录；不要把均值±标准差写进单个数值单元格。'],['数值列','必须为纯数字，缺失值可以留空。'],['分组列','分组名称应保持完全一致，避免多余空格。']
  ]);guide['!cols']=[{wch:18},{wch:85}];
  XLSX.utils.book_append_sheet(wb,ws,'数据填写');XLSX.utils.book_append_sheet(wb,guide,'填写说明');
  XLSX.writeFile(wb,`FoodLab_${safeFile(def.name)}_${safeFile(schema.name)}.xlsx`);toast('图表模板已生成');
}
function downloadGalleryCsv(){
  const schema=gallerySchema(),rows=galleryTemplateRows(),csv='\ufeff'+[schema.columns,...rows.map(r=>schema.columns.map(c=>r[c]??''))].map(row=>row.map(csvCell).join(',')).join('\r\n');
  download(new Blob([csv],{type:'text/csv;charset=utf-8'}),`FoodLab_${safeFile(galleryDef().name)}_模板.csv`);toast('CSV 模板已生成');
}
function loadGalleryDemo(){state.gallery.rows=galleryTemplateRows();state.gallery.sourceName='内置示例';renderGallery();toast('已载入示例数据')}

async function handleGalleryFile(file){
  try{
    let rows;if(/\.(csv|tsv)$/i.test(file.name))rows=parseDelimited(await file.text());else{
      if(!window.XLSX)throw new Error('Excel 组件未加载');const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
    }
    const normalized=normalizeGalleryRows(rows,galleryDef().schema);if(!normalized.length)throw new Error('没有读取到符合模板的有效数据');
    state.gallery.rows=normalized;state.gallery.sourceName=file.name;renderGallery();toast(`已导入 ${normalized.length} 行数据`);
  }catch(err){toast(err.message||'数据导入失败')}
}
function pickAlias(row,aliases){const keys=Object.keys(row);for(const a of aliases){const key=keys.find(k=>String(k).trim().toLowerCase()===a.toLowerCase());if(key!=null)return row[key]}return''}
function numOrNull(v){const n=Number(String(v).trim());return Number.isFinite(n)?n:null}
function normalizeGalleryRows(rows,schema){
  return rows.map((r,i)=>{
    if(schema==='univariate')return {SampleID:String(pickAlias(r,['SampleID','样品编号','样本编号'])||`S${i+1}`),Group:String(pickAlias(r,['Group','组别','分组','处理'])||'All'),Value:numOrNull(pickAlias(r,['Value','数值','测定值','值']))};
    if(schema==='xy')return {SampleID:String(pickAlias(r,['SampleID','样品编号','样本编号'])||`S${i+1}`),Group:String(pickAlias(r,['Group','组别','分组','处理'])||'All'),X:numOrNull(pickAlias(r,['X','x','变量X','横坐标'])),Y:numOrNull(pickAlias(r,['Y','y','变量Y','纵坐标'])),Size:numOrNull(pickAlias(r,['Size','气泡大小','大小']))};
    if(schema==='composition')return {Category:String(pickAlias(r,['Category','类别','时间','横坐标'])||'Overall'),Component:String(pickAlias(r,['Component','组分','成分','系列'])||'Value'),Value:numOrNull(pickAlias(r,['Value','数值','含量','比例']))};
    if(schema==='radar')return {Group:String(pickAlias(r,['Group','组别','处理'])||'All'),Indicator:String(pickAlias(r,['Indicator','指标','变量'])),Value:numOrNull(pickAlias(r,['Value','数值','评分']))};
    const out={SampleID:String(pickAlias(r,['SampleID','样品编号','样本编号'])||`S${i+1}`),Group:String(pickAlias(r,['Group','组别','分组','处理'])||'All')};Object.keys(r).forEach(k=>{if(!['sampleid','样品编号','样本编号','group','组别','分组','处理'].includes(String(k).trim().toLowerCase())){const n=numOrNull(r[k]);if(n!=null)out[String(k).trim()]=n}});return out;
  }).filter(r=>schema==='univariate'?r.Value!=null:schema==='xy'?r.X!=null&&r.Y!=null:schema==='composition'?r.Component&&r.Value!=null:schema==='radar'?r.Indicator&&r.Value!=null:Object.keys(r).some(k=>!['SampleID','Group'].includes(k)&&Number.isFinite(r[k])));
}

function analyzeGalleryData(){
  const rows=state.gallery.rows,def=galleryDef();if(!rows.length){state.gallery.analysis=null;return}
  if(def.schema==='univariate')state.gallery.analysis=analyzeUnivariate(rows);
  else if(def.schema==='xy')state.gallery.analysis=analyzeXY(rows);
  else if(def.schema==='composition')state.gallery.analysis=analyzeComposition(rows);
  else if(def.schema==='matrix')state.gallery.analysis=analyzeMatrix(rows);
  else state.gallery.analysis=analyzeRadar(rows);
}
function groupValues(rows,key='Group'){const map=new Map();rows.forEach(r=>{const k=String(r[key]||'All');if(!map.has(k))map.set(k,[]);map.get(k).push(r)});return map}
function quantile(values,p){return quantileByMethod(values,p,'linear7')}
function quantileByMethod(values,p,method='linear7'){
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y),n=a.length;if(!n)return NaN;if(n===1)return a[0];
  if(method==='exclusive'){
    const h=(n+1)*p;if(h<=1)return a[0];if(h>=n)return a[n-1];const i=Math.floor(h)-1,f=h-Math.floor(h);return a[i]+(a[i+1]-a[i])*f;
  }
  if(method==='tukey'){
    if(p===.5)return medianBySorted(a);const mid=Math.floor(n/2),lower=a.slice(0,mid),upper=a.slice(n%2?mid+1:mid);return p<.5?medianBySorted(lower):medianBySorted(upper);
  }
  const h=(n-1)*p,i=Math.floor(h),f=h-i;return a[i]+(a[Math.min(i+1,n-1)]-a[i])*f;
}
function medianBySorted(a){const n=a.length;if(!n)return NaN;const m=Math.floor(n/2);return n%2?a[m]:(a[m-1]+a[m])/2}
function median(values){return quantileByMethod(values,.5,'linear7')}
function boxMethodLabels(){
  const s=state.gallery.settings;
  const q={linear7:'线性插值（R type 7 / Excel QUARTILE.INC）',tukey:'Tukey hinges（上下半区中位数）',exclusive:'排除端点插值（Excel QUARTILE.EXC）'}[s.boxQuartileMethod]||s.boxQuartileMethod;
  const w={iqr15:'1.5×IQR',iqr30:'3×IQR',minmax:'最小值–最大值',percentile:`${s.boxWhiskerPercentile||5}–${100-(s.boxWhiskerPercentile||5)}百分位`}[s.boxWhiskerMethod]||s.boxWhiskerMethod;
  return{quartile:q,whisker:w};
}
function statisticalMethodLabel(method=state.gallery.settings.statMethod){return({anovaLsd:'单因素 ANOVA + Fisher LSD',welchHolm:'Welch ANOVA + Welch t 检验（Holm校正）',kruskalHolm:'Kruskal–Wallis + Mann–Whitney U（Holm校正）'}[method]||method)}
function correlationMethodLabel(method=state.gallery.settings.correlationMethod){return method==='spearman'?'Spearman 秩相关':'Pearson 线性相关'}
function analyzeUnivariate(rows){
  const s=state.gallery.settings,groups=groupValues(rows),table=[];
  groups.forEach((rs,g)=>{
    const v=rs.map(r=>r.Value),st=boxStats(v);
    table.push({Group:g,n:v.length,Mean:mean(v),SD:sampleSd(v),Median:st.q2,Q1:st.q1,Q3:st.q3,WhiskerLow:st.low,WhiskerHigh:st.high,Min:Math.min(...v),Max:Math.max(...v),Outliers:st.out.length});
  });
  const all=rows.map(r=>r.Value),highest=table.reduce((a,b)=>a.Mean>b.Mean?a:b),lowest=table.reduce((a,b)=>a.Mean<b.Mean?a:b);
  let anova=null,pairwise=[],letters={},methodName='—';
  if(groups.size>1){const result=runUnivariateInference(rows);anova=result.anova;pairwise=result.pairwise;letters=result.letters;methodName=result.methodName}
  const sigCount=pairwise.filter(x=>x.p<.05).length,method=boxMethodLabels(),omnibus=anova?`${anova.methodName||methodName} ${anova.pMain<.05?'检出':'未检出'}总体组间差异（${formatPText(anova.pMain)}）`:'未执行组间检验',pairText=pairwise.length?`；${methodName} 中有 ${sigCount} 组两两比较达到校正后 p<0.05` : '';
  return {kind:'univariate',table,anova,pairwise,letters,methodName,boxMethod:method,summary:[['有效观测',all.length],['组别数',table.length],['总体均值',formatNumber(mean(all),3)],['总体检验 p',anova?formatP(anova.pMain):'—']],text:`共分析 ${all.length} 个原始观测，包含 ${table.length} 个组。${table.length>1?`${highest.Group} 的均值最高，${lowest.Group} 的均值最低。`:''} ${omnibus}${pairText}。箱线图四分位数采用“${method.quartile}”，须线采用“${method.whisker}”。`};
}

function fisherLsdPairwise(groups,mse,df){
  if(!Number.isFinite(mse)||mse<0||!Number.isFinite(df)||df<=0)return[];const out=[];
  for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
    const a=groups[i],b=groups[j],se=Math.sqrt(mse*(1/a.n+1/b.n)),t=se?Math.abs(a.mean-b.mean)/se:Infinity,p=Number.isFinite(t)?clamp(2*(1-tCdf(t,df)),0,1):0;
    out.push({i,j,a:a.label,b:b.label,meanDiff:a.mean-b.mean,t,p,stars:p<.001?'***':p<.01?'**':p<.05?'*':'ns'});
  }
  return out;
}
function pearson(x,y){const mx=mean(x),my=mean(y),num=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0),dx=Math.sqrt(x.reduce((s,v)=>s+(v-mx)**2,0)),dy=Math.sqrt(y.reduce((s,v)=>s+(v-my)**2,0));return dx&&dy?num/(dx*dy):NaN}
function spearman(x,y){const rx=averageRanks(x).ranks,ry=averageRanks(y).ranks;return pearson(rx,ry)}
function regression(x,y){const mx=mean(x),my=mean(y),ssx=x.reduce((s,v)=>s+(v-mx)**2,0),sxy=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0),slope=ssx?sxy/ssx:0,intercept=my-slope*mx,r=pearson(x,y);return{slope,intercept,r,r2:r*r}}
function analyzeXY(rows){
  const method=state.gallery.settings.correlationMethod||'pearson',corrFn=method==='spearman'?spearman:pearson,label=correlationMethodLabel(method),table=[];
  groupValues(rows).forEach((rs,g)=>{const x=rs.map(r=>r.X),y=rs.map(r=>r.Y),m=regression(x,y),r=corrFn(x,y);table.push({Group:g,n:rs.length,Correlation:r,Method:label,Slope:m.slope,Intercept:m.intercept,R2:m.r2})});
  const x=rows.map(r=>r.X),y=rows.map(r=>r.Y),m=regression(x,y),association=corrFn(x,y);return{kind:'xy',table,overall:{...m,association,method,label},summary:[['有效样本',rows.length],['组别数',table.length],[`总体 ${method==='spearman'?'Spearman ρ':'Pearson r'}`,formatNumber(association,3)],['线性回归 R²',formatNumber(m.r2,3)]],text:`总体${label}系数为 ${formatNumber(association,3)}；线性拟合模型 R² 为 ${formatNumber(m.r2,3)}。相关方法和回归模型是两个不同设置，相关不等同于因果关系。`}
}

function analyzeComposition(rows){
  const cats=groupValues(rows,'Category'),table=[];cats.forEach((rs,c)=>{const total=rs.reduce((s,r)=>s+r.Value,0);rs.forEach(r=>table.push({Category:c,Component:r.Component,Value:r.Value,Percent:total?r.Value/total*100:0}));});return{kind:'composition',table,summary:[['类别数',cats.size],['组分数',new Set(rows.map(r=>r.Component)).size],['数据行',rows.length],['总量',formatNumber(rows.reduce((s,r)=>s+r.Value,0),3)]],text:'已按每个类别计算组分总量与百分比。百分比堆叠图和饼图会自动使用类别内部占比。'}}
function analyzeMatrix(rows){
  const method=state.gallery.settings.correlationMethod||'pearson',corrFn=method==='spearman'?spearman:pearson,label=correlationMethodLabel(method),vars=[...new Set(rows.flatMap(r=>Object.keys(r).filter(k=>!['SampleID','Group'].includes(k)&&Number.isFinite(r[k]))))],corr={};
  vars.forEach(a=>{corr[a]={};vars.forEach(b=>{const pairs=rows.filter(r=>Number.isFinite(r[a])&&Number.isFinite(r[b]));corr[a][b]=pairs.length>1?corrFn(pairs.map(r=>r[a]),pairs.map(r=>r[b])):NaN})});return{kind:'matrix',vars,corr,method,label,summary:[['样本数',rows.length],['数值指标',vars.length],['组别数',new Set(rows.map(r=>r.Group)).size],['相关方法',label]],text:`已对 ${vars.length} 个数值指标计算${label}矩阵。强相关并不自动代表指标之间存在直接机制关系。`}
}

function analyzeRadar(rows){const groups=new Set(rows.map(r=>r.Group)),indicators=new Set(rows.map(r=>r.Indicator));return{kind:'radar',summary:[['组别数',groups.size],['指标数',indicators.size],['数据行',rows.length],['归一化',state.gallery.settings.normalize?'已开启':'未开启']],table:[...groups].map(g=>({Group:g,Indicators:rows.filter(r=>r.Group===g).length,Mean:mean(rows.filter(r=>r.Group===g).map(r=>r.Value))})),text:'雷达图适合综合展示多个指标。若各指标单位或量纲不同，应开启 0–1 归一化后再比较形状。'}}

function renderGalleryAnalysis(){
  const a=state.gallery.analysis;if(!a){$('#gallerySummaryCards').innerHTML='';$('#galleryAnalysisTable').innerHTML='<tbody><tr><td class="empty-row">导入模板数据后显示初步分析</td></tr></tbody>';$('#galleryInterpretation').className='interpretation empty';$('#galleryInterpretation').textContent='暂无可解释结果。';return}
  $('#gallerySummaryCards').innerHTML=a.summary.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  let table=a.table;if(a.kind==='matrix')table=a.vars.map(v=>({Indicator:v,...Object.fromEntries(a.vars.map(w=>[w,a.corr[v][w]]))}));
  if(table?.length){const headers=Object.keys(table[0]);$('#galleryAnalysisTable').innerHTML=`<thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${table.map(r=>`<tr>${headers.map(h=>`<td>${typeof r[h]==='number'?formatNumber(r[h],3):esc(r[h])}</td>`).join('')}</tr>`).join('')}</tbody>`}else $('#galleryAnalysisTable').innerHTML='';
  $('#galleryInterpretation').className='interpretation';$('#galleryInterpretation').textContent=a.text;
}

function renderGallerySettings(){
  const s=state.gallery.settings,def=galleryDef();
  const common=`<div class="subhead">图题与字体</div>${gText('title','图题')}${gText('xTitle','X轴标题')}${gText('yTitle','Y轴标题')}${gSelect('font','字体',[['Arial','Arial'],['Times New Roman','Times New Roman'],['Microsoft YaHei','微软雅黑'],['SimSun','宋体']])}${gRange('fontSize','字号',9,24,1)}${gSelect('fontWeight','字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']])}<div class="subhead">坐标与画布</div>${gRange('axisWidth','坐标轴粗细',.6,3,.1)}${gCheck('frame','显示完整边框')}${gNumber('width','画布宽度',500,1400,10)}${gNumber('height','画布高度',400,1000,10)}${gSelect('dpi','PNG清晰度',[[96,'96 dpi'],[150,'150 dpi'],[300,'300 dpi'],[600,'600 dpi']])}<div class="subhead">配色与图例</div>${gSelect('colorScheme','配色',[['foodchem','Food Chemistry'],['meatsci','Meat Science'],['nature','Nature-style'],['mono','黑白打印']])}${gCheck('legend','显示图例')}`;
  let specific='';
  if(def.id==='hist')specific=gRange('bins','分箱数量',4,30,1)+gRange('opacity','柱透明度',.2,1,.05);
  if(def.id==='kde')specific=gNumber('bandwidth','带宽（0=自动）',0,100,.01)+gRange('lineWidth','曲线粗细',.8,5,.1)+gRange('opacity','填充透明度',0,1,.05);
  if(['box','violin'].includes(def.id))specific=gCheck('showPoints','叠加原始散点')+gCheck('showMean','显示均值')+gRange('pointSize','散点大小',1,9,.5)+gRange('opacity','填充透明度',.2,1,.05);
  if(['scatter','bubble'].includes(def.id))specific=gRange('pointSize','点大小',1,10,.5)+gRange('opacity','点透明度',.2,1,.05)+gCheck('showRegression','显示线性拟合')+gCheck('showCorrelation','显示相关系数');
  if(def.id==='stacked')specific=gCheck('normalize','百分比堆叠')+gSelect('orientation','方向',[['vertical','纵向'],['horizontal','横向']]);
  if(def.id==='pie')specific=gCheck('donut','圆环图');
  if(def.id==='heatmap')specific=gCheck('showCorrelation','显示相关系数数字');
  if(def.id==='radar')specific=gCheck('normalize','按指标0–1归一化')+gRange('opacity','填充透明度',0,1,.05);
  $('#gallerySettings').innerHTML=common+`<div class="subhead">当前图形</div>`+specific;
  $$('[data-gsetting]').forEach(el=>el.addEventListener('input',()=>{let v=el.type==='checkbox'?el.checked:el.value;if(['range','number'].includes(el.type))v=Number(v);state.gallery.settings[el.dataset.gsetting]=v;if(el.dataset.gsetting==='colorScheme')state.gallery.palette=[...(templates[v]?.colors||templates.foodchem.colors)];analyzeGalleryData();renderGalleryAnalysis();renderGalleryChart();const out=$(`[data-gout="${el.dataset.gsetting}"]`);if(out)out.textContent=v}));
}
function gWrap(label,key,input){return`<div class="field"><label><span>${label}</span><output data-gout="${key}">${esc(state.gallery.settings[key])}</output></label>${input}</div>`}
function gText(k,l){return gWrap(l,k,`<input data-gsetting="${k}" type="text" value="${escAttr(state.gallery.settings[k])}">`)}
function gNumber(k,l,min,max,step){return gWrap(l,k,`<input data-gsetting="${k}" type="number" min="${min}" max="${max}" step="${step}" value="${state.gallery.settings[k]}">`)}
function gRange(k,l,min,max,step){return gWrap(l,k,`<input data-gsetting="${k}" type="range" min="${min}" max="${max}" step="${step}" value="${state.gallery.settings[k]}">`)}
function gSelect(k,l,opts){return gWrap(l,k,`<select data-gsetting="${k}">${opts.map(([v,n])=>`<option value="${v}" ${String(state.gallery.settings[k])===String(v)?'selected':''}>${n}</option>`).join('')}</select>`)}
function gCheck(k,l){return`<label class="check-row"><input data-gsetting="${k}" type="checkbox" ${state.gallery.settings[k]?'checked':''}>${l}</label>`}

function galleryFontStack(){
  const s=state.gallery.settings,en=String(s.fontEnglish||'Arial').replace(/'/g,"\\'"),zh=String(s.fontChinese||'Microsoft YaHei').replace(/'/g,"\\'");return `'${en}','${zh}',sans-serif`;
}
function gallerySvgMarkup(svgId='gallerySvg',interactive=false){
  const s=state.gallery.settings,def=galleryDef(),W=clamp(Number(s.width)||980,500,1800),H=clamp(Number(s.height)||660,400,1200),font=galleryFontStack();
  const titleX=s.titleX??W/2,titleY=s.titleY??38,subtitleX=s.subtitleX??W/2,subtitleY=s.subtitleY??58;
  let body='';
  if(def.id==='hist')body=galleryHistogram(W,H);else if(def.id==='kde')body=galleryKde(W,H);else if(def.id==='box')body=galleryBox(W,H,false);else if(def.id==='violin')body=galleryBox(W,H,true);
  else if(def.id==='scatter'||def.id==='bubble')body=galleryScatter(W,H,def.id==='bubble');else if(def.id==='stacked')body=galleryStacked(W,H);else if(def.id==='pie')body=galleryPie(W,H);
  else if(def.id==='heatmap')body=galleryHeatmap(W,H);else if(def.id==='radar')body=galleryRadar(W,H);
  const cls=interactive?'chart-object':'';
  const shadow=`<filter id="galleryLegendShadow" x="-40%" y="-40%" width="190%" height="200%"><feDropShadow dx="${s.legendShadowX}" dy="${s.legendShadowY}" stdDeviation="${s.legendShadowBlur}" flood-color="#263238" flood-opacity="${s.legendShadowOpacity}"/></filter><marker id="chartAnnotationArrow" markerWidth="9" markerHeight="9" refX="7.2" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,7 L8,3.5 z" fill="context-stroke"/></marker>`;
  const title=s.titleVisible&&s.title?`<text data-gobject="title" data-gdrag="title" class="${cls} draggable" x="${titleX}" y="${titleY}" text-anchor="middle" font-size="${s.titleSize}" font-weight="${s.titleWeight}" fill="${s.titleColor}">${esc(s.title)}</text>`:'';
  const subtitle=s.subtitleEnabled&&s.subtitle?`<text data-gobject="subtitle" data-gdrag="subtitle" class="${cls} draggable" x="${subtitleX}" y="${subtitleY}" text-anchor="middle" font-size="${s.subtitleSize}" font-weight="${s.subtitleWeight}" fill="${s.subtitleColor}">${esc(s.subtitle)}</text>`:'';
  const methodNote=galleryMethodNoteSvg(W,H,interactive);
  const annotations=renderGalleryAnnotations(W,H,interactive);
  return `<svg id="${svgId}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="font-family:${escAttr(font)};background:${s.background}"><defs>${shadow}</defs><rect data-gobject="background" class="${cls}" width="${W}" height="${H}" fill="${s.background}"/>${title}${subtitle}${body}${methodNote}${annotations}</svg>`;
}
function galleryMethodNoteText(){
  const type=state.gallery.type,s=state.gallery.settings;
  if(['box','violin'].includes(type)){const m=boxMethodLabels();return `四分位：${m.quartile}；须线：${m.whisker}；检验：${statisticalMethodLabel(s.statMethod)}`}
  if(['scatter','bubble'].includes(type))return `相关：${correlationMethodLabel(s.correlationMethod)}；拟合：普通最小二乘线性回归`;
  if(type==='heatmap')return `相关矩阵：${correlationMethodLabel(s.correlationMethod)}`;
  return '';
}
function galleryMethodNoteSvg(W,H,interactive=false){
  const s=state.gallery.settings,text=galleryMethodNoteText();if(!s.methodNoteVisible||!text)return'';const x=s.methodNoteX??(W-24),y=s.methodNoteY??(H-10),cls=interactive?'chart-object method-note draggable':'method-note';return `<text data-gobject="method-note" data-gdrag="methodNote" class="${cls}" x="${x}" y="${y}" text-anchor="end" font-size="${s.methodNoteSize}" fill="${s.methodNoteColor}">${esc(text)}</text>`;
}
function renderGalleryChart(){
  const stage=$('#galleryStage'),s=state.gallery.settings;if(!state.gallery.rows.length){stage.innerHTML='<div class="gallery-empty"><b>等待数据</b><span>下载匹配模板，填写并导入后即可绘图。</span></div>';$('#galleryChartMeta').textContent='';return}
  stage.innerHTML=gallerySvgMarkup('gallerySvg',false);$('#galleryChartMeta').textContent=`${s.width} × ${s.height} px · ${s.dpi} dpi`;
}
function galleryPlotBox(W,H){const top=state.gallery.settings.subtitleEnabled&&state.gallery.settings.subtitle?82:68;return{l:88,r:48,t:top,b:88,w:W-136,h:H-top-88}}
function scaleLinear(a,b,c,d){return v=>c+(v-a)/(b-a||1)*(d-c)}
function commonAxes(W,H,p,xTicks,yTicks,xMap,yMap){
  const s=state.gallery.settings,axis=s.axisColor||'#20262b',frame=s.frameColor||axis,sw=s.axisWidth||1.2,fw=s.frameWidth||sw;
  const xTitleX=s.xTitleX??(p.l+p.w/2),xTitleY=s.xTitleY??(H-24),yTitleX=s.yTitleX??28,yTitleY=s.yTitleY??(p.t+p.h/2),xTick=s.xTickSize||12,yTick=s.yTickSize||12;
  let out='';
  if(s.frameMode!=='none'){
    out+=`<g data-gobject="axis-y" class="chart-object" fill="none" stroke="${axis}" stroke-width="${sw}"><path d="M${p.l},${p.t} V${p.t+p.h}"/></g><g data-gobject="axis-x" class="chart-object" fill="none" stroke="${axis}" stroke-width="${sw}"><path d="M${p.l},${p.t+p.h} H${p.l+p.w}"/></g>`;
    if(s.frameMode==='lbr'||s.frameMode==='box')out+=`<g data-gobject="frame" class="chart-object" fill="none" stroke="${frame}" stroke-width="${fw}"><path d="M${p.l+p.w},${p.t} V${p.t+p.h}"/></g>`;
    if(s.frameMode==='box')out+=`<g data-gobject="frame" class="chart-object" fill="none" stroke="${frame}" stroke-width="${fw}"><path d="M${p.l},${p.t} H${p.l+p.w}"/></g>`;
  }
  yTicks.forEach(v=>{const y=yMap(v);out+=`<g data-gobject="axis-y" class="chart-object">${s.showYTicks?`<line x1="${p.l-s.tickLength}" x2="${p.l}" y1="${y}" y2="${y}" stroke="${axis}" stroke-width="${sw}"/>`:''}<text x="${p.l-s.tickLength-4}" y="${y+4}" text-anchor="end" font-size="${yTick}" font-weight="${s.yTickWeight}" fill="${s.yTickColor}">${formatTick(v)}</text></g>`});
  xTicks.forEach((v,i)=>{const x=xMap(v,i);out+=`<g data-gobject="axis-x" class="chart-object">${s.showXTicks?`<line x1="${x}" x2="${x}" y1="${p.t+p.h}" y2="${p.t+p.h+s.tickLength}" stroke="${axis}" stroke-width="${sw}"/>`:''}<text x="${x}" y="${p.t+p.h+s.tickLength+16}" text-anchor="middle" font-size="${xTick}" font-weight="${s.xTickWeight}" fill="${s.xTickColor}">${esc(v)}</text></g>`});
  if(s.xTitleVisible&&s.xTitle)out+=`<text data-gobject="axis-x" data-gdrag="xTitle" class="chart-object draggable" x="${xTitleX}" y="${xTitleY}" text-anchor="middle" font-size="${s.xTitleSize}" font-weight="${s.xTitleWeight}" fill="${s.xTitleColor}">${esc(s.xTitle)}</text>`;if(s.yTitleVisible&&s.yTitle)out+=`<text data-gobject="axis-y" data-gdrag="yTitle" class="chart-object draggable" transform="translate(${yTitleX} ${yTitleY}) rotate(-90)" text-anchor="middle" font-size="${s.yTitleSize}" font-weight="${s.yTitleWeight}" fill="${s.yTitleColor}">${esc(s.yTitle)}</text>`;return out;
}
function galleryLegendLayout(groups){
  const s=state.gallery.settings,font=s.legendFontSize||12,orientation=s.legendOrientation||'horizontal',cols=Math.max(1,Number(s.legendColumns)||1),symbol=14,rowH=Math.max(22,font+10),pad=10;
  const items=groups.map((g,i)=>({name:String(g),color:getGallerySeriesStyle(i).color,w:30+String(g).length*font*.62}));let positions=[],width=0,height=0;
  if(orientation==='vertical'){const useCols=1,rows=items.length,colWidths=[Math.max(0,...items.map(it=>it.w))],offsets=[pad];items.forEach((it,i)=>positions.push({x:offsets[0],y:pad+i*rowH,item:it,index:i}));width=pad*2+colWidths[0];height=pad*2+rows*rowH}
  else{const useCols=Math.min(cols===1?items.length:cols,items.length),rows=Math.ceil(items.length/useCols),colWidths=Array(useCols).fill(0);items.forEach((it,i)=>{const c=i%useCols;colWidths[c]=Math.max(colWidths[c],it.w)});const offsets=[];let acc=pad;colWidths.forEach(w=>{offsets.push(acc);acc+=w+12});items.forEach((it,i)=>{const c=i%useCols,r=Math.floor(i/useCols);positions.push({x:offsets[c],y:pad+r*rowH,item:it,index:i})});width=acc-12+pad;height=pad*2+rows*rowH}
  return{positions,width:Math.max(48,width),height:Math.max(30,height),symbol,font};
}
function galleryLegend(groups){
  const s=state.gallery.settings;if(!s.legend||!groups.length)return'';const l=galleryLegendLayout(groups),fx=s.legendFrameX??108,fy=s.legendFrameY??50,lx=s.legendX??120,ly=s.legendY??62;
  const fw=s.legendFrameAutoSize?l.width:s.legendFrameWidthBox,fh=s.legendFrameAutoSize?l.height:s.legendFrameHeightBox,style=s.legendFrameStyle||'none',dash=style==='dashed'?'8 5':style==='dotted'?'2 4':'',dbl=style==='double';
  let frame='';if(style!=='none'){frame=`<g data-gobject="legend-frame" data-gdrag="legendFrame" class="chart-object draggable" transform="translate(${fx} ${fy})"><rect width="${fw}" height="${fh}" rx="${s.legendFrameRadius}" fill="${s.legendFrameFill}" stroke="${s.legendFrameColor}" stroke-width="${s.legendFrameWidth}" ${dash?`stroke-dasharray="${dash}"`:''} ${s.legendShadow?'filter="url(#galleryLegendShadow)"':''}/>${dbl?`<rect x="4" y="4" width="${Math.max(0,fw-8)}" height="${Math.max(0,fh-8)}" rx="${Math.max(0,s.legendFrameRadius-2)}" fill="none" stroke="${s.legendFrameColor}" stroke-width="${Math.max(.5,s.legendFrameWidth*.7)}"/>`:''}</g>`}
  const content=l.positions.map(({x,y,item,index})=>`<g data-gobject="series" data-gseries="${index}" class="chart-object"><rect x="${x}" y="${y+4}" width="${l.symbol}" height="${Math.max(10,l.font*.72)}" fill="${item.color}"/><text x="${x+l.symbol+7}" y="${y+l.font}" font-size="${l.font}" font-weight="${s.legendWeight}" fill="#263238">${esc(item.name)}</text></g>`).join('');
  return `${frame}<g data-gobject="legend" data-gdrag="legend" class="chart-object draggable" transform="translate(${lx} ${ly})">${content}</g>`;
}

function galleryHistogram(W,H){
  const s=state.gallery.settings,p=galleryPlotBox(W,H),rows=state.gallery.rows,groups=[...new Set(rows.map(r=>r.Group))],vals=rows.map(r=>r.Value),min=Math.min(...vals),max=Math.max(...vals),bins=Math.max(4,Math.round(s.bins)),step=(max-min||1)/bins,counts=groups.map(g=>Array(bins).fill(0));
  rows.forEach(r=>{const gi=groups.indexOf(r.Group),bi=Math.min(bins-1,Math.max(0,Math.floor((r.Value-min)/(step||1))));counts[gi][bi]++});
  const ymax=Math.max(1,...counts.flat()),xMap=scaleLinear(min,max,p.l,p.l+p.w),yMap=scaleLinear(0,ymax,p.t+p.h,p.t),yTicks=makeTicks(0,ymax,null,5),xTicks=makeTicks(min,max,null,6);let out=commonAxes(W,H,p,xTicks,yTicks,v=>xMap(v),yMap)+galleryLegend(groups);
  counts.forEach((arr,gi)=>{const st=getGallerySeriesStyle(gi);let body='';arr.forEach((n,i)=>{const x=xMap(min+i*step),w=Math.max(1,xMap(min+(i+1)*step)-x-1);body+=`<rect x="${x}" y="${yMap(n)}" width="${w}" height="${p.t+p.h-yMap(n)}" fill="${st.color}" fill-opacity="${st.opacity}" stroke="${st.color}" stroke-width="${st.lineWidth}"/>`});out+=`<g data-gobject="series" data-gseries="${gi}" class="chart-object">${body}</g>`});return out;
}
function kdeFor(values,min,max,points=100,bw=0){const n=values.length,sd=sampleSd(values),h=bw>0?bw:Math.max(1e-9,1.06*(sd||((max-min)/6)||1)*Math.pow(n,-.2)),arr=[];for(let i=0;i<points;i++){const x=min+(max-min)*i/(points-1),d=values.reduce((sum,v)=>sum+Math.exp(-.5*((x-v)/h)**2),0)/(n*h*Math.sqrt(2*Math.PI));arr.push([x,d])}return arr}
function galleryKde(W,H){
  const s=state.gallery.settings,p=galleryPlotBox(W,H),groups=[...new Set(state.gallery.rows.map(r=>r.Group))],all=state.gallery.rows.map(r=>r.Value),pad=(Math.max(...all)-Math.min(...all)||1)*.08,min=Math.min(...all)-pad,max=Math.max(...all)+pad,curves=groups.map(g=>kdeFor(state.gallery.rows.filter(r=>r.Group===g).map(r=>r.Value),min,max,120,s.bandwidth)),ymax=Math.max(...curves.flatMap(c=>c.map(p=>p[1]))),xMap=scaleLinear(min,max,p.l,p.l+p.w),yMap=scaleLinear(0,ymax,p.t+p.h,p.t);let out=commonAxes(W,H,p,makeTicks(min,max,null,6),makeTicks(0,ymax,null,5),v=>xMap(v),yMap)+galleryLegend(groups);
  curves.forEach((curve,i)=>{const st=getGallerySeriesStyle(i),d=curve.map((q,j)=>(j?'L':'M')+xMap(q[0])+','+yMap(q[1])).join(' ');out+=`<g data-gobject="series" data-gseries="${i}" class="chart-object">${st.opacity>0?`<path d="${d} L${xMap(max)},${p.t+p.h} L${xMap(min)},${p.t+p.h} Z" fill="${st.color}" fill-opacity="${st.opacity*.32}"/>`:''}<path d="${d}" fill="none" stroke="${st.color}" stroke-width="${st.lineWidth}"/></g>`});return out;
}
function boxStats(v){
  const s=state.gallery.settings,method=s.boxQuartileMethod||'linear7',a=v.filter(Number.isFinite).sort((x,y)=>x-y),q1=quantileByMethod(a,.25,method),q2=quantileByMethod(a,.5,method),q3=quantileByMethod(a,.75,method),iqr=q3-q1;let low,high;
  if(s.boxWhiskerMethod==='minmax'){low=a[0];high=a[a.length-1]}
  else if(s.boxWhiskerMethod==='percentile'){const p=clamp(Number(s.boxWhiskerPercentile)||5,0,49)/100;low=quantileByMethod(a,p,'linear7');high=quantileByMethod(a,1-p,'linear7')}
  else{const factor=s.boxWhiskerMethod==='iqr30'?3:1.5,loFence=q1-factor*iqr,hiFence=q3+factor*iqr;low=a.find(x=>x>=loFence);high=[...a].reverse().find(x=>x<=hiFence);if(low==null)low=a[0];if(high==null)high=a[a.length-1]}
  return{q1,q2,q3,low,high,mean:mean(a),out:a.filter(x=>x<low||x>high)};
}
function significancePairsForGroups(groups){
  const s=state.gallery.settings,a=state.gallery.analysis;if(!s.significanceEnabled||s.significanceDisplay==='none'||!a?.pairwise?.length)return[];
  let pairs=a.pairwise.map(r=>({...r,i:groups.indexOf(r.a),j:groups.indexOf(r.b)})).filter(r=>r.i>=0&&r.j>=0);
  if(s.significancePairMode==='significant')pairs=pairs.filter(r=>r.p<.05);
  else if(s.significancePairMode==='control')pairs=pairs.filter(r=>r.i===0||r.j===0);
  pairs.sort((a,b)=>(a.j-a.i)-(b.j-b.i)||a.i-b.i);
  const levels=[];pairs.forEach(pair=>{let level=0;while(levels[level]?.some(q=>!(pair.j<q.i||pair.i>q.j)))level++;(levels[level]||(levels[level]=[])).push(pair);pair.level=level});
  return pairs;
}
function significanceLabel(pair){const s=state.gallery.settings;if(s.significanceLabelMode==='pvalue')return pair.p<.001?'p < 0.001':`p = ${formatNumber(pair.p,3)}`;return pair.stars}
function significanceBracketsSvg(groups,pairs,xAt,yMap,dataMax,range){
  const s=state.gallery.settings;if(!pairs.length)return'';let out='<g data-gobject="significance" class="chart-object">';
  pairs.forEach(pair=>{const x1=xAt(pair.i),x2=xAt(pair.j),value=dataMax+range*(.08+pair.level*.09)+s.significanceOffset*range/220,y=yMap(value),cap=Math.max(5,s.significanceStep*.28),label=significanceLabel(pair);out+=`<path d="M${x1},${y+cap} V${y} H${x2} V${y+cap}" fill="none" stroke="${s.significanceColor}" stroke-width="${s.significanceLineWidth}"/><text x="${(x1+x2)/2}" y="${y-4}" text-anchor="middle" font-size="${s.significanceFontSize}" font-weight="500" fill="${s.significanceColor}">${esc(label)}</text>`});
  return out+'</g>';
}
function significanceLettersSvg(groups,xAt,yMap,dataMax,range){
  const s=state.gallery.settings,a=state.gallery.analysis;if(!s.significanceEnabled||s.significanceDisplay!=='letters'||!a?.letters)return'';let out='<g data-gobject="significance" class="chart-object">';groups.forEach((g,i)=>{const label=a.letters[g]||'',y=yMap(dataMax+range*.09);if(label)out+=`<text x="${xAt(i)}" y="${y}" text-anchor="middle" font-size="${s.significanceFontSize}" font-weight="600" fill="${s.significanceColor}">${esc(label)}</text>`});return out+'</g>';
}
function galleryBox(W,H,violin){
  const s=state.gallery.settings,p=galleryPlotBox(W,H),groups=[...new Set(state.gallery.rows.map(r=>r.Group))],all=state.gallery.rows.map(r=>r.Value),dataMin=Math.min(...all),dataMax=Math.max(...all),range=(dataMax-dataMin)||1,pairs=significancePairsForGroups(groups),maxLevel=pairs.length?Math.max(...pairs.map(x=>x.level))+1:0;
  const showBrackets=s.significanceEnabled&&s.significanceDisplay==='brackets'&&pairs.length>0,extraTop=showBrackets?range*(.18+maxLevel*.1):s.significanceDisplay==='letters'?range*.18:range*.12,min=dataMin-range*.12,max=dataMax+extraTop,yMap=scaleLinear(min,max,p.t+p.h,p.t),xStep=p.w/groups.length,xAt=i=>p.l+(i+.5)*xStep;
  let out=commonAxes(W,H,p,groups,makeTicks(min,max,null,6),(v,i)=>xAt(i),yMap)+galleryLegend(groups);
  groups.forEach((g,i)=>{const vals=state.gallery.rows.filter(r=>r.Group===g).map(r=>r.Value),stt=boxStats(vals),x=xAt(i),st=getGallerySeriesStyle(i),bw=Math.min(84,xStep*(s.boxWidth||.48));let body='';
    if(violin){const curve=kdeFor(vals,dataMin-range*.08,dataMax+range*.08,80,s.bandwidth),mx=Math.max(...curve.map(q=>q[1]))||1,right=curve.map(q=>[x+(q[1]/mx)*bw/2,yMap(q[0])]),left=[...curve].reverse().map(q=>[x-(q[1]/mx)*bw/2,yMap(q[0])]);body+=`<path d="M${right[0][0]},${right[0][1]} ${right.slice(1).map(q=>'L'+q[0]+','+q[1]).join(' ')} ${left.map(q=>'L'+q[0]+','+q[1]).join(' ')} Z" fill="${st.color}" fill-opacity="${st.opacity}" stroke="${st.color}" stroke-width="${st.lineWidth}"/>`}
    else body+=`<rect x="${x-bw/2}" y="${yMap(stt.q3)}" width="${bw}" height="${yMap(stt.q1)-yMap(stt.q3)}" fill="${st.color}" fill-opacity="${st.opacity}" stroke="${st.color}" stroke-width="${st.lineWidth}"/>`;
    body+=`<line x1="${x}" x2="${x}" y1="${yMap(stt.low)}" y2="${yMap(stt.high)}" stroke="#222" stroke-width="${s.whiskerWidth}"/><line x1="${x-bw*.25}" x2="${x+bw*.25}" y1="${yMap(stt.low)}" y2="${yMap(stt.low)}" stroke="#222" stroke-width="${s.whiskerWidth}"/><line x1="${x-bw*.25}" x2="${x+bw*.25}" y1="${yMap(stt.high)}" y2="${yMap(stt.high)}" stroke="#222" stroke-width="${s.whiskerWidth}"/>`;
    if(s.showMedian)body+=`<line x1="${x-bw/2}" x2="${x+bw/2}" y1="${yMap(stt.q2)}" y2="${yMap(stt.q2)}" stroke="#111" stroke-width="${s.medianWidth}"/>`;
    if(s.showMean)body+=`<circle cx="${x}" cy="${yMap(stt.mean)}" r="3.5" fill="white" stroke="#111"/>`;
    if(s.showPoints)vals.forEach((v,j)=>{if(!s.showOutliers&&(v<stt.low||v>stt.high))return;const jitter=((j*37)%17-8)/8*bw*.36,attrs=`fill="${st.markerFill==='white'?'white':st.color}" stroke="${st.color}" stroke-width="1.2"`;body+=markerShapeSvg(st.markerShape,x+jitter,yMap(v),st.pointSize,attrs)});
    out+=`<g data-gobject="series" data-gseries="${i}" class="chart-object">${body}</g>`;
  });
  if(s.significanceDisplay==='letters')out+=significanceLettersSvg(groups,xAt,yMap,dataMax,range);else out+=significanceBracketsSvg(groups,pairs,xAt,yMap,dataMax,range);
  return out;
}
function galleryScatter(W,H,bubble){
  const s=state.gallery.settings,p=galleryPlotBox(W,H),rows=state.gallery.rows,groups=[...new Set(rows.map(r=>r.Group))],xs=rows.map(r=>r.X),ys=rows.map(r=>r.Y),xpad=(Math.max(...xs)-Math.min(...xs)||1)*.08,ypad=(Math.max(...ys)-Math.min(...ys)||1)*.1,xmin=Math.min(...xs)-xpad,xmax=Math.max(...xs)+xpad,ymin=Math.min(...ys)-ypad,ymax=Math.max(...ys)+ypad,xMap=scaleLinear(xmin,xmax,p.l,p.l+p.w),yMap=scaleLinear(ymin,ymax,p.t+p.h,p.t);let out=commonAxes(W,H,p,makeTicks(xmin,xmax,null,6),makeTicks(ymin,ymax,null,6),v=>xMap(v),yMap)+galleryLegend(groups);const sizes=rows.map(r=>r.Size).filter(Number.isFinite),smin=Math.min(...sizes),smax=Math.max(...sizes);
  groups.forEach((g,gi)=>{const st=getGallerySeriesStyle(gi),body=rows.filter(r=>r.Group===g).map(r=>{const radius=bubble&&Number.isFinite(r.Size)?st.pointSize+(r.Size-smin)/(smax-smin||1)*Math.max(5,st.pointSize*2):st.pointSize,attrs=`fill="${st.markerFill==='white'?'white':st.color}" fill-opacity="${st.opacity}" stroke="${st.color}" stroke-width="1.1"`;return markerShapeSvg(st.markerShape,xMap(r.X),yMap(r.Y),radius,attrs)}).join('');out+=`<g data-gobject="series" data-gseries="${gi}" class="chart-object">${body}</g>`});
  if(s.showRegression){const m=state.gallery.analysis.overall,y1=m.intercept+m.slope*xmin,y2=m.intercept+m.slope*xmax;out+=`<g data-gobject="regression" class="chart-object"><line x1="${xMap(xmin)}" y1="${yMap(y1)}" x2="${xMap(xmax)}" y2="${yMap(y2)}" stroke="#222" stroke-width="${s.lineWidth}" stroke-dasharray="6 4"/></g>`}if(s.showCorrelation){const m=state.gallery.analysis.overall,symbol=m.method==='spearman'?'ρ':'r';out+=`<text data-gobject="regression" class="chart-object" x="${p.l+p.w-8}" y="${p.t+20}" text-anchor="end" font-size="${s.annotationSize}" font-style="italic">${symbol} = ${formatNumber(m.association,3)}, R² = ${formatNumber(m.r2,3)}</text>`}return out;
}
function galleryStacked(W,H){
  const s=state.gallery.settings,p=galleryPlotBox(W,H),cats=[...new Set(state.gallery.rows.map(r=>r.Category))],comps=[...new Set(state.gallery.rows.map(r=>r.Component))],totals=Object.fromEntries(cats.map(c=>[c,state.gallery.rows.filter(r=>r.Category===c).reduce((a,b)=>a+b.Value,0)])),max=s.normalize?100:Math.max(...Object.values(totals)),yMap=scaleLinear(0,max,p.t+p.h,p.t),xStep=p.w/cats.length;let out=commonAxes(W,H,p,cats,makeTicks(0,max,null,6),(v,i)=>p.l+(i+.5)*xStep,yMap)+galleryLegend(comps);
  comps.forEach((comp,j)=>{const st=getGallerySeriesStyle(j);let body='';cats.forEach((cat,i)=>{const previous=comps.slice(0,j).reduce((sum,c)=>{const r=state.gallery.rows.find(x=>x.Category===cat&&x.Component===c);const v=r?r.Value:0;return sum+(s.normalize?(totals[cat]?v/totals[cat]*100:0):v)},0),row=state.gallery.rows.find(r=>r.Category===cat&&r.Component===comp),value=row?row.Value:0,v=s.normalize?(totals[cat]?value/totals[cat]*100:0):value,y1=yMap(previous+v),y0=yMap(previous),w=Math.min(78,xStep*.68),x=p.l+(i+.5)*xStep-w/2;body+=`<rect x="${x}" y="${y1}" width="${w}" height="${y0-y1}" fill="${st.color}" fill-opacity="${st.opacity}" stroke="${st.color}" stroke-width="${st.lineWidth}"/>`});out+=`<g data-gobject="series" data-gseries="${j}" class="chart-object">${body}</g>`});return out;
}
function galleryPie(W,H){
  const s=state.gallery.settings,first=state.gallery.rows[0].Category,rows=state.gallery.rows.filter(r=>r.Category===first),total=rows.reduce((a,b)=>a+b.Value,0),cx=W*.42,cy=H*.54,R=Math.min(W,H)*.3,r0=s.donut?R*.52:0;let a=-Math.PI/2,out='';
  rows.forEach((r,i)=>{const st=getGallerySeriesStyle(i),da=total?r.Value/total*Math.PI*2:0,a2=a+da,p1=[cx+R*Math.cos(a),cy+R*Math.sin(a)],p2=[cx+R*Math.cos(a2),cy+R*Math.sin(a2)],q1=[cx+r0*Math.cos(a2),cy+r0*Math.sin(a2)],q2=[cx+r0*Math.cos(a),cy+r0*Math.sin(a)],large=da>Math.PI?1:0,d=r0?`M${p1} A${R},${R} 0 ${large} 1 ${p2} L${q1} A${r0},${r0} 0 ${large} 0 ${q2} Z`:`M${cx},${cy} L${p1} A${R},${R} 0 ${large} 1 ${p2} Z`;let body=`<path d="${d}" fill="${st.color}" fill-opacity="${st.opacity}" stroke="white" stroke-width="${Math.max(1,st.lineWidth)}"/>`;const mid=a+da/2,tx=cx+R*.72*Math.cos(mid),ty=cy+R*.72*Math.sin(mid);if(s.showCorrelation&&da>.12)body+=`<text x="${tx}" y="${ty}" text-anchor="middle" font-size="${s.pieLabelSize}" fill="white" font-weight="600">${formatNumber(r.Value/total*100,1)}%</text>`;out+=`<g data-gobject="series" data-gseries="${i}" class="chart-object">${body}</g>`;a=a2});out+=galleryLegend(rows.map(r=>r.Component));return out;
}
function hexRgb(hex){const h=String(hex||'#000000').replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))return[0,0,0];const n=parseInt(h,16);return[(n>>16)&255,(n>>8)&255,n&255]}
function rgbHex(rgb){return'#'+rgb.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('')}
function blendHex(a,b,t){const A=hexRgb(a),B=hexRgb(b);return rgbHex(A.map((v,i)=>v+(B[i]-v)*clamp(t,0,1)))}
function heatColor(v,diagonal=false){const s=state.gallery.settings;if(diagonal)return s.heatmapDiagonalColor||s.heatmapHighColor;const t=clamp((v+1)/2,0,1);return t<=.5?blendHex(s.heatmapLowColor,s.heatmapMidColor,t*2):blendHex(s.heatmapMidColor,s.heatmapHighColor,(t-.5)*2)}
function heatmapColorBar(W,H){const s=state.gallery.settings;if(!s.heatmapColorBar)return'';const x=s.legendX??120,y=s.legendY??62,horizontal=s.heatmapColorBarOrientation!=='vertical',steps=80;let out=`<g data-gobject="legend" data-gdrag="legend" class="chart-object draggable" transform="translate(${x} ${y})">`;if(horizontal){const w=180,h=14;for(let i=0;i<steps;i++){const v=-1+2*i/(steps-1);out+=`<rect x="${i*w/steps}" y="0" width="${w/steps+0.5}" height="${h}" fill="${heatColor(v)}"/>`}out+=`<rect width="${w}" height="${h}" fill="none" stroke="#58666d" stroke-width=".7"/><text x="0" y="${h+14}" font-size="${Math.max(9,s.legendFontSize-1)}">−1</text><text x="${w/2}" y="${h+14}" text-anchor="middle" font-size="${Math.max(9,s.legendFontSize-1)}">0</text><text x="${w}" y="${h+14}" text-anchor="end" font-size="${Math.max(9,s.legendFontSize-1)}">1</text>`}else{const w=14,h=160;for(let i=0;i<steps;i++){const v=1-2*i/(steps-1);out+=`<rect x="0" y="${i*h/steps}" width="${w}" height="${h/steps+0.5}" fill="${heatColor(v)}"/>`}out+=`<rect width="${w}" height="${h}" fill="none" stroke="#58666d" stroke-width=".7"/><text x="${w+7}" y="9" font-size="${Math.max(9,s.legendFontSize-1)}">1</text><text x="${w+7}" y="${h/2+4}" font-size="${Math.max(9,s.legendFontSize-1)}">0</text><text x="${w+7}" y="${h}" font-size="${Math.max(9,s.legendFontSize-1)}">−1</text>`}return out+'</g>'}
function galleryHeatmap(W,H){const s=state.gallery.settings,a=state.gallery.analysis,vars=a.vars,n=vars.length,pad=115,size=Math.min((W-pad-80)/n,(H-pad-72)/n),x0=pad,y0=82;let body='';vars.forEach((v,i)=>{body+=`<text x="${x0+(i+.5)*size}" y="${y0-10}" text-anchor="start" font-size="${s.heatmapXLabelSize}" font-weight="${s.xTickWeight}" fill="${s.xTickColor}" transform="rotate(-45 ${x0+(i+.5)*size} ${y0-10})">${esc(v)}</text><text x="${x0-10}" y="${y0+(i+.55)*size}" text-anchor="end" font-size="${s.heatmapYLabelSize}" font-weight="${s.yTickWeight}" fill="${s.yTickColor}">${esc(v)}</text>`;vars.forEach((w,j)=>{const r=a.corr[v][w],x=x0+j*size,y=y0+i*size,gap=s.heatmapCellGap||0,isDiag=i===j,cellColor=heatColor(r,isDiag);body+=`<rect x="${x+gap/2}" y="${y+gap/2}" width="${Math.max(0,size-gap)}" height="${Math.max(0,size-gap)}" fill="${cellColor}"/>`;if(s.heatmapShowValues){const rgb=hexRgb(cellColor),lum=(.299*rgb[0]+.587*rgb[1]+.114*rgb[2]);body+=`<text x="${x+size/2}" y="${y+size/2+s.heatmapValueSize*.34}" text-anchor="middle" font-size="${s.heatmapValueSize}" fill="${lum<145?'white':'#222'}">${formatNumber(r,2)}</text>`}})});return `<g data-gobject="heatmap-scale" class="chart-object">${body}</g>${heatmapColorBar(W,H)}`}

function galleryRadar(W,H){
  const s=state.gallery.settings,rows=state.gallery.rows,groups=[...new Set(rows.map(r=>r.Group))],inds=[...new Set(rows.map(r=>r.Indicator))],cx=W*.45,cy=H*.54,R=Math.min(W,H)*.32,n=inds.length;const ranges=Object.fromEntries(inds.map(ind=>{const v=rows.filter(r=>r.Indicator===ind).map(r=>r.Value);return[ind,[Math.min(...v),Math.max(...v)]]}));let out='<g data-gobject="radar-grid" class="chart-object">';for(let k=1;k<=5;k++){const pts=inds.map((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;return`${cx+R*k/5*Math.cos(a)},${cy+R*k/5*Math.sin(a)}`}).join(' ');out+=`<polygon points="${pts}" fill="none" stroke="#ccd4d8" stroke-width="${s.radarGridWidth}"/>`}inds.forEach((ind,i)=>{const a=-Math.PI/2+i*2*Math.PI/n,x=cx+R*Math.cos(a),y=cy+R*Math.sin(a),lx=cx+(R+25)*Math.cos(a),ly=cy+(R+25)*Math.sin(a);out+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#d6dcdf" stroke-width="${s.radarGridWidth}"/><text x="${lx}" y="${ly+4}" text-anchor="middle" font-size="${s.radarLabelSize}" font-weight="${s.xTickWeight}">${esc(ind)}</text>`});out+='</g>';groups.forEach((g,gi)=>{const st=getGallerySeriesStyle(gi),pts=inds.map((ind,i)=>{const row=rows.find(r=>r.Group===g&&r.Indicator===ind),v=row?row.Value:0,[mn,mx]=ranges[ind],z=s.normalize?(v-mn)/(mx-mn||1):v/Math.max(...rows.filter(r=>r.Indicator===ind).map(r=>r.Value)),a=-Math.PI/2+i*2*Math.PI/n;return[cx+R*z*Math.cos(a),cy+R*z*Math.sin(a)]});let body=`<polygon points="${pts.map(q=>q.join(',')).join(' ')}" fill="${st.color}" fill-opacity="${st.opacity*.35}" stroke="${st.color}" stroke-width="${st.lineWidth}"/>`;pts.forEach(q=>body+=markerShapeSvg(st.markerShape,q[0],q[1],s.radarPointSize||st.pointSize,`fill="${st.markerFill==='white'?'white':st.color}" stroke="${st.color}" stroke-width="1.1"`));out+=`<g data-gobject="series" data-gseries="${gi}" class="chart-object">${body}</g>`});out+=galleryLegend(groups);return out;
}
function exportGallerySvg(){const svg=$('#gallerySvg');if(!svg){toast('请先生成图形');return}download(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}),`FoodLab_${safeFile(galleryDef().name)}.svg`)}
function exportGalleryPng(){const svg=$('#gallerySvg');if(!svg){toast('请先生成图形');return}const s=state.gallery.settings,scale=Math.max(1,Number(s.dpi||300)/96),xml=new XMLSerializer().serializeToString(svg),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'})),img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=Math.round(s.width*scale);c.height=Math.round(s.height*scale);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);c.toBlob(b=>download(b,`FoodLab_${safeFile(galleryDef().name)}_${s.dpi}dpi.png`),'image/png');URL.revokeObjectURL(url)};img.src=url}


// ===== v0.7.6 论文拼图工作台：平台图表 + 本地图片 =====
function bindCompose(){
  $('#addToFigure')?.addEventListener('click',()=>addCurrentChartToFigure(false));
  $('#openCompose')?.addEventListener('click',()=>showView('compose'));
  $('#composeBackStudio')?.addEventListener('click',()=>showView('chart'));
  $('#composeAddText')?.addEventListener('click',()=>addComposeAnnotation('text'));
  $('#composeAddArrow')?.addEventListener('click',()=>addComposeAnnotation('arrow'));
  $('#composeAddCurrent')?.addEventListener('click',()=>addCurrentChartToFigure(true));
  $('#composeImportImages')?.addEventListener('click',()=>$('#composeImageInput')?.click());
  $('#composeImageInput')?.addEventListener('change',async e=>{if(e.target.files?.length)await importComposeImages([...e.target.files]);e.target.value=''});
  $('#composeClear')?.addEventListener('click',()=>{if(!state.figureBoard.items.length)return;state.figureBoard.items=[];renderComposeWorkspace();toast('拼图已清空')});
  $('#composeExportSvg')?.addEventListener('click',exportComposeSvg);
  $('#composeExportPng')?.addEventListener('click',exportComposePng);
}
function currentChartSvgElement(){return $('#paperSvg')||$('#gallerySvg')}
function cleanChartSvgClone(svg){
  const clone=cleanAnnotationEditorArtifacts(svg.cloneNode(true));clone.removeAttribute('id');clone.querySelectorAll('.object-selected').forEach(el=>el.classList.remove('object-selected'));clone.querySelectorAll('[data-gobject],[data-object],[data-gdrag]').forEach(el=>{el.removeAttribute('data-gobject');el.removeAttribute('data-object');el.removeAttribute('data-gdrag');el.classList.remove('chart-object','draggable')});return clone;
}
function ensureComposeGridCapacity(){
  const b=state.figureBoard;b.columns=clamp(Number(b.columns)||2,1,6);b.rows=clamp(Number(b.rows)||1,1,8);b.rows=Math.max(b.rows,Math.ceil(b.items.length/b.columns)||1);
}
function addFigureItem(item){
  const b=state.figureBoard;item.label=item.label||indexLetter(b.items.length).toUpperCase();item.id=item.id||`panel_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;b.items.push(item);b.selected=b.items.length-1;ensureComposeGridCapacity();
}
function addCurrentChartToFigure(openAfter=false){
  const svg=currentChartSvgElement();if(!svg){toast('当前没有可加入的图');return}
  const clone=cleanChartSvgClone(svg),vb=svg.viewBox?.baseVal,w=vb?.width||Number(svg.getAttribute('width'))||980,h=vb?.height||Number(svg.getAttribute('height'))||660;
  addFigureItem({title:workflowChartLabel(state.workflow.chartType),type:state.workflow.chartType,kind:'svg',width:w,height:h,svg:new XMLSerializer().serializeToString(clone)});
  toast(`已加入拼图：${state.figureBoard.items.at(-1).label} · ${workflowChartLabel(state.workflow.chartType)}`);if(openAfter)showView('compose');else renderComposeWorkspace();
}
function readAsText(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error(`无法读取 ${file.name}`));r.readAsText(file)})}
function readAsDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error(`无法读取 ${file.name}`));r.readAsDataURL(file)})}
function imageDimensions(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve({width:img.naturalWidth||img.width||980,height:img.naturalHeight||img.height||660});img.onerror=()=>reject(new Error('图片尺寸读取失败'));img.src=src})}
function parseImportedSvg(text,name){
  const doc=new DOMParser().parseFromString(text,'image/svg+xml'),root=doc.documentElement;if(!root||root.nodeName.toLowerCase()!=='svg'||doc.querySelector('parsererror'))throw new Error(`${name} 不是有效 SVG`);
  root.querySelectorAll('script,foreignObject').forEach(x=>x.remove());
  const vb=(root.getAttribute('viewBox')||'').trim().split(/[ ,]+/).map(Number),width=vb.length===4&&Number.isFinite(vb[2])?vb[2]:parseFloat(root.getAttribute('width'))||980,height=vb.length===4&&Number.isFinite(vb[3])?vb[3]:parseFloat(root.getAttribute('height'))||660;
  if(!root.getAttribute('viewBox'))root.setAttribute('viewBox',`0 0 ${width} ${height}`);root.removeAttribute('id');
  return {kind:'svg',title:name.replace(/\.svg$/i,''),type:'imported-svg',width,height,svg:new XMLSerializer().serializeToString(root)};
}
async function importComposeImages(files){
  let added=0;
  for(const file of files){
    try{
      if(file.type==='image/svg+xml'||/\.svg$/i.test(file.name)){addFigureItem(parseImportedSvg(await readAsText(file),file.name))}
      else if(/^image\//.test(file.type)||/\.(png|jpe?g|webp)$/i.test(file.name)){const src=await readAsDataUrl(file),dim=await imageDimensions(src);addFigureItem({kind:'image',title:file.name.replace(/\.[^.]+$/,''),type:'imported-image',width:dim.width,height:dim.height,src})}
      else continue;added++;
    }catch(err){toast(err.message||`无法导入 ${file.name}`)}
  }
  renderComposeWorkspace();if(added)toast(`已导入 ${added} 张本地图片`);
}
function addComposeAnnotation(type){
  const b=state.figureBoard,id=makeAnnotationId();let ann={id,type,color:'#111111',width:2,dash:'',fontFamily:b.labelFont||'Arial',fontSize:28,fontWeight:500};
  if(type==='text')Object.assign(ann,{text:'说明文字',x:b.width*.52,y:b.height*.12,background:'#ffffff',backgroundOpacity:.9,padding:8,borderColor:'#b8c5c0',borderWidth:1,cornerRadius:4});
  else Object.assign(ann,{x1:b.width*.35,y1:b.height*.18,x2:b.width*.50,y2:b.height*.32,arrowEnd:true,text:''});
  b.annotations.push(ann);b.selectedAnnotation=id;renderComposeWorkspace();toast(type==='text'?'已加入拼图文字框':'已加入拼图箭头：拖动“起”“终”圆点调整');
}
function selectedComposeAnnotation(){return state.figureBoard.annotations.find(a=>a.id===state.figureBoard.selectedAnnotation)}
function composeAnnotationSvg(ann,interactive=true){
  if(ann.type==='text'){
    const w=Math.max(40,String(ann.text||'').length*ann.fontSize*.62+(ann.padding||0)*2),h=ann.fontSize*1.35+(ann.padding||0)*2;
    return `<g data-compose-annotation="${ann.id}" class="compose-annotation" transform="translate(${ann.x} ${ann.y})"><rect x="${-w/2}" y="${-h+ann.fontSize*.35}" width="${w}" height="${h}" rx="${ann.cornerRadius??4}" fill="${ann.background}" fill-opacity="${ann.backgroundOpacity}" stroke="${ann.borderColor||'none'}" stroke-width="${ann.borderWidth||0}"/><text text-anchor="middle" font-family="${escAttr(ann.fontFamily)},sans-serif" font-size="${ann.fontSize}" font-weight="${ann.fontWeight}" fill="${ann.color}">${esc(ann.text)}</text></g>`
  }
  const mx=(ann.x1+ann.x2)/2,my=(ann.y1+ann.y2)/2,handles=interactive?`${arrowEndpointHandleMarkup({id:ann.id,x:ann.x1,y:ann.y1,endpoint:'start',compose:true})}${arrowEndpointHandleMarkup({id:ann.id,x:ann.x2,y:ann.y2,endpoint:'end',compose:true})}`:'';
  return `<g data-compose-annotation="${ann.id}" class="compose-annotation"><line class="annotation-hit-line" data-compose-arrow-hit x1="${ann.x1}" y1="${ann.y1}" x2="${ann.x2}" y2="${ann.y2}"/><line data-compose-arrow-line x1="${ann.x1}" y1="${ann.y1}" x2="${ann.x2}" y2="${ann.y2}" stroke="${ann.color}" stroke-width="${ann.width}" ${ann.dash?`stroke-dasharray="${ann.dash}"`:''} ${ann.arrowEnd!==false?'marker-end="url(#composeArrowHead)"':''}/>${ann.text?`<text data-compose-arrow-label x="${mx}" y="${my-8}" text-anchor="middle" font-family="${escAttr(ann.fontFamily)},sans-serif" font-size="${ann.fontSize}" fill="${ann.color}">${esc(ann.text)}</text>`:''}${handles}</g>`
}
function updateComposeArrowDom(group,ann){
  group.querySelectorAll('[data-compose-arrow-line],[data-compose-arrow-hit]').forEach(line=>{line.setAttribute('x1',ann.x1);line.setAttribute('y1',ann.y1);line.setAttribute('x2',ann.x2);line.setAttribute('y2',ann.y2)});
  const a=group.querySelector('[data-compose-arrow-handle="start"]'),b=group.querySelector('[data-compose-arrow-handle="end"]');if(a)a.setAttribute('transform',`translate(${ann.x1} ${ann.y1})`);if(b)b.setAttribute('transform',`translate(${ann.x2} ${ann.y2})`);
  const t=group.querySelector('[data-compose-arrow-label]');if(t){t.setAttribute('x',(ann.x1+ann.x2)/2);t.setAttribute('y',(ann.y1+ann.y2)/2-8)}
}
function bindComposeAnnotationInteractions(){
  const svg=$('#composeSvg');if(!svg)return;
  svg.querySelectorAll('[data-compose-arrow-handle]').forEach(handle=>handle.addEventListener('pointerdown',e=>{
    e.preventDefault();e.stopPropagation();const id=handle.dataset.composeAnnotationId,ann=state.figureBoard.annotations.find(a=>a.id===id);if(!ann)return;state.figureBoard.selectedAnnotation=id;
    const endpoint=handle.dataset.composeArrowHandle,group=handle.closest('[data-compose-annotation]');handle.setPointerCapture(e.pointerId);handle.classList.add('is-dragging');
    const move=ev=>{const p=svgPoint(svg,ev);if(endpoint==='start'){ann.x1=p.x;ann.y1=p.y}else{ann.x2=p.x;ann.y2=p.y}updateComposeArrowDom(group,ann)};
    const endDrag=()=>{handle.classList.remove('is-dragging');handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',endDrag);handle.removeEventListener('pointercancel',endDrag);renderComposeWorkspace()};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',endDrag);handle.addEventListener('pointercancel',endDrag);
  }));
  $$('[data-compose-annotation]').forEach(el=>{
    el.addEventListener('click',e=>{e.stopPropagation();state.figureBoard.selectedAnnotation=el.dataset.composeAnnotation;renderComposeSettings();$$('[data-compose-annotation]').forEach(x=>x.classList.toggle('compose-annotation-selected',x===el))});
    el.addEventListener('pointerdown',e=>{if(e.target.closest('[data-compose-arrow-handle]'))return;e.preventDefault();e.stopPropagation();const ann=state.figureBoard.annotations.find(a=>a.id===el.dataset.composeAnnotation);if(!ann)return;state.figureBoard.selectedAnnotation=ann.id;const start=svgPoint(svg,e),snap=structuredClone(ann);el.setPointerCapture(e.pointerId);const move=ev=>{const p=svgPoint(svg,ev),dx=p.x-start.x,dy=p.y-start.y;if(ann.type==='text'){ann.x=snap.x+dx;ann.y=snap.y+dy;el.setAttribute('transform',`translate(${ann.x} ${ann.y})`)}else{ann.x1=snap.x1+dx;ann.y1=snap.y1+dy;ann.x2=snap.x2+dx;ann.y2=snap.y2+dy;el.setAttribute('transform',`translate(${dx} ${dy})`)}};const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);renderComposeWorkspace()};el.addEventListener('pointermove',move);el.addEventListener('pointerup',up)});
  });
}
function renderComposeWorkspace(){
  if(!$('#composeStage'))return;ensureComposeGridCapacity();renderComposeItemList();renderComposeSettings();const svg=composeSvgMarkup();$('#composeStage').innerHTML=svg||'<div class="gallery-empty"><b>还没有拼图面板</b><span>可加入当前 Chart Studio 图，也可直接导入 PNG、JPG、WebP 或 SVG。</span></div>';bindComposeAnnotationInteractions();const b=state.figureBoard;$('#composeCount').textContent=`${b.items.length} 张`;$('#composeCanvasMeta').textContent=`${b.columns} 列 × ${b.rows} 行 · ${b.width} × ${b.height} px · ${b.dpi} dpi`;
}
function composeThumbSrc(item){return item.kind==='image'?item.src:svgDataUri(item.svg||'')}
function renderComposeItemList(){
  const box=$('#composeItemList'),items=state.figureBoard.items;if(!items.length){box.innerHTML='<div class="empty-state">尚未加入图表或图片</div>';return}
  box.innerHTML=items.map((item,i)=>`<div class="compose-item ${i===state.figureBoard.selected?'active':''}" data-compose-select="${i}"><div class="compose-thumb"><img alt="${escAttr(item.title)}" src="${composeThumbSrc(item)}"></div><div class="compose-item-meta"><label>面板标签<input data-compose-label="${i}" value="${escAttr(item.label||indexLetter(i).toUpperCase())}" maxlength="8"></label><b>${esc(item.title)}</b><small>${item.kind==='image'?'本地图片':'SVG 图表'} · ${item.width} × ${item.height}</small></div><div class="compose-item-actions"><button data-compose-up="${i}" ${i===0?'disabled':''}>↑</button><button data-compose-down="${i}" ${i===items.length-1?'disabled':''}>↓</button><button data-compose-remove="${i}" class="danger">×</button></div></div>`).join('');
  $$('[data-compose-select]').forEach(el=>el.addEventListener('click',e=>{if(e.target.closest('button,input'))return;state.figureBoard.selected=Number(el.dataset.composeSelect);renderComposeItemList()}));
  $$('[data-compose-label]').forEach(el=>el.addEventListener('input',()=>{items[Number(el.dataset.composeLabel)].label=el.value;renderComposePreviewOnly()}));
  $$('[data-compose-up]').forEach(el=>el.addEventListener('click',()=>moveComposeItem(Number(el.dataset.composeUp),-1)));
  $$('[data-compose-down]').forEach(el=>el.addEventListener('click',()=>moveComposeItem(Number(el.dataset.composeDown),1)));
  $$('[data-compose-remove]').forEach(el=>el.addEventListener('click',()=>{items.splice(Number(el.dataset.composeRemove),1);state.figureBoard.selected=clamp(state.figureBoard.selected,0,Math.max(0,items.length-1));renderComposeWorkspace()}));
}
function moveComposeItem(i,delta){const items=state.figureBoard.items,j=i+delta;if(j<0||j>=items.length)return;[items[i],items[j]]=[items[j],items[i]];state.figureBoard.selected=j;renderComposeWorkspace()}
function renderComposePreviewOnly(){const stage=$('#composeStage');if(stage){stage.innerHTML=composeSvgMarkup()||'';bindComposeAnnotationInteractions()}const b=state.figureBoard;const meta=$('#composeCanvasMeta');if(meta)meta.textContent=`${b.columns} 列 × ${b.rows} 行 · ${b.width} × ${b.height} px · ${b.dpi} dpi`}
function renderComposeSettings(){
  const b=state.figureBoard;b.labelFont=b.labelFont||'Arial';b.rows=b.rows||Math.max(1,Math.ceil(b.items.length/(b.columns||2)));
  const fonts=[['Arial','Arial'],['Times New Roman','Times New Roman'],['Calibri','Calibri'],['Helvetica','Helvetica'],['Georgia','Georgia'],['Microsoft YaHei','微软雅黑'],['SimSun','宋体'],['SimHei','黑体']];
  const html=`<div class="object-property-section"><h3>画布与布局</h3>${composeSelect('columns','列数',[[1,'1 列'],[2,'2 列'],[3,'3 列'],[4,'4 列'],[5,'5 列'],[6,'6 列']])}${composeSelect('rows','行数',[[1,'1 行'],[2,'2 行'],[3,'3 行'],[4,'4 行'],[5,'5 行'],[6,'6 行'],[7,'7 行'],[8,'8 行']])}${composeNumber('width','总宽度',800,5000,10)}${composeNumber('height','总高度',600,5000,10)}${composeNumber('gap','面板间距',0,120,1)}${composeNumber('padding','外边距',0,160,1)}${composeSelect('dpi','PNG 清晰度',[[96,'96 dpi'],[150,'150 dpi'],[300,'300 dpi'],[600,'600 dpi']])}${composeColor('background','背景颜色')}</div><div class="object-property-section"><h3>面板标签</h3>${composeCheck('labelEnabled','显示 A、B、C、D 标签')}${composeSelect('labelFont','标签字体',fonts)}${composeRange('labelSize','标签字号',12,72,1)}${composeSelect('labelWeight','标签字重',[[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']])}${composeColor('labelColor','标签颜色')}${composeSelect('labelPosition','标签位置',[['top-left','左上角'],['top-right','右上角'],['outside-top-left','面板外左上']])}${composeNumber('labelInsetX','水平内缩',-40,80,1)}${composeNumber('labelInsetY','垂直内缩',-40,80,1)}</div><div class="object-property-section"><h3>面板边框</h3>${composeCheck('panelBorder','显示面板边框')}${composeRange('panelBorderWidth','边框粗细',.5,6,.1)}${composeColor('panelBorderColor','边框颜色')}</div>${composeAnnotationSettingsHtml(fonts)}`;
  $('#composeSettings').innerHTML=html;$$('[data-compose-setting]').forEach(el=>{const fn=()=>{const k=el.dataset.composeSetting;let v=el.type==='checkbox'?el.checked:el.value;if(['number','range'].includes(el.type)||['columns','rows','dpi'].includes(k))v=Number(v);state.figureBoard[k]=v;if(k==='columns'||k==='rows')ensureComposeGridCapacity();renderComposePreviewOnly();const out=el.closest('.field')?.querySelector('output');if(out)out.textContent=state.figureBoard[k]};el.addEventListener('input',fn);el.addEventListener('change',fn)});bindComposeAnnotationInputs();
}
function composeAnnotationSettingsHtml(fonts){
  const b=state.figureBoard,ann=selectedComposeAnnotation(),list=b.annotations.map((a,i)=>`<button type="button" class="compose-ann-chip ${a.id===b.selectedAnnotation?'active':''}" data-compose-ann-select="${a.id}">${annotationTypeLabel(a.type)} ${i+1}</button>`).join('');
  let fields='<div class="empty-state">使用顶部“＋文字框”或“＋箭头”添加拼图标注。</div>',tip='文字框和箭头可直接在组合图中拖动。';
  if(ann){
    if(ann.type==='text')fields=composeAnnText('text','文字内容')+composeAnnNumber('x','水平位置',0,5000,1)+composeAnnNumber('y','垂直位置',0,5000,1)+composeAnnSelect('fontFamily','字体',fonts)+composeAnnRange('fontSize','字号',10,96,1)+composeAnnSelect('fontWeight','字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']])+composeAnnColor('color','文字颜色')+composeAnnColor('background','文字框底色')+composeAnnRange('backgroundOpacity','底色透明度',0,1,.05)+composeAnnRange('padding','内边距',0,40,1)+composeAnnColor('borderColor','边框颜色')+composeAnnRange('borderWidth','边框粗细',0,8,.1)+composeAnnRange('cornerRadius','圆角',0,24,1);
    else{fields=composeAnnText('text','箭头文字')+composeAnnSelect('fontFamily','字体',fonts)+composeAnnRange('fontSize','文字字号',10,72,1)+composeAnnColor('color','颜色')+composeAnnRange('width','线宽',.5,8,.1)+composeAnnSelect('dash','线型',[['','实线'],['8 5','虚线'],['2 4','点线']])+composeAnnCheck('arrowEnd','显示箭头');tip='拖动箭头本体可整体移动；拖动两端圆形手柄可任意改变方向和长度。';}
    fields+=`<button id="composeDeleteAnnotation" class="ghost danger wide" type="button">删除此标注</button>`;
  }
  return `<div class="object-property-section"><h3>拼图文字与箭头</h3><div class="compose-ann-list">${list||'<span class="small-note">暂无标注</span>'}</div>${fields}<div class="annotation-drag-tip">${tip}</div></div>`;
}
function composeAnnWrap(k,l,input){const a=selectedComposeAnnotation(),v=a?.[k]??'';return `<div class="field"><label><span>${l}</span><output>${esc(v)}</output></label>${input}</div>`}
function composeAnnText(k,l){const a=selectedComposeAnnotation();return composeAnnWrap(k,l,`<input data-compose-ann-setting="${k}" type="text" value="${escAttr(a?.[k]??'')}">`)}
function composeAnnNumber(k,l,min,max,step){const a=selectedComposeAnnotation();return composeAnnWrap(k,l,`<input data-compose-ann-setting="${k}" type="number" min="${min}" max="${max}" step="${step}" value="${a?.[k]??''}">`)}
function composeAnnRange(k,l,min,max,step){const a=selectedComposeAnnotation();return composeAnnWrap(k,l,`<input data-compose-ann-setting="${k}" type="range" min="${min}" max="${max}" step="${step}" value="${a?.[k]??0}">`)}
function composeAnnColor(k,l){const a=selectedComposeAnnotation();return composeAnnWrap(k,l,`<input data-compose-ann-setting="${k}" type="color" value="${a?.[k]||'#111111'}">`)}
function composeAnnSelect(k,l,opts){const a=selectedComposeAnnotation(),v=a?.[k]??'';return composeAnnWrap(k,l,`<select data-compose-ann-setting="${k}">${opts.map(([x,n])=>`<option value="${x}" ${String(v)===String(x)?'selected':''}>${n}</option>`).join('')}</select>`)}
function composeAnnCheck(k,l){const a=selectedComposeAnnotation();return `<label class="check-row"><input data-compose-ann-setting="${k}" type="checkbox" ${a?.[k]?'checked':''}>${l}</label>`}
function bindComposeAnnotationInputs(){
  $$('[data-compose-ann-select]').forEach(btn=>btn.addEventListener('click',()=>{state.figureBoard.selectedAnnotation=btn.dataset.composeAnnSelect;renderComposeSettings();renderComposePreviewOnly()}));
  $$('[data-compose-ann-setting]').forEach(el=>{const fn=()=>{const a=selectedComposeAnnotation();if(!a)return;let v=el.type==='checkbox'?el.checked:el.value;if(['number','range'].includes(el.type))v=Number(v);a[el.dataset.composeAnnSetting]=v;renderComposePreviewOnly()};el.addEventListener('input',fn);el.addEventListener('change',fn)});
  $('#composeDeleteAnnotation')?.addEventListener('click',()=>{const b=state.figureBoard;b.annotations=b.annotations.filter(a=>a.id!==b.selectedAnnotation);b.selectedAnnotation=b.annotations.at(-1)?.id||null;renderComposeWorkspace()});
}

function composeWrap(label,key,input){return `<div class="field"><label><span>${label}</span><output>${esc(state.figureBoard[key])}</output></label>${input}</div>`}
function composeNumber(k,l,min,max,step){return composeWrap(l,k,`<input data-compose-setting="${k}" type="number" min="${min}" max="${max}" step="${step}" value="${state.figureBoard[k]}">`)}
function composeRange(k,l,min,max,step){return composeWrap(l,k,`<input data-compose-setting="${k}" type="range" min="${min}" max="${max}" step="${step}" value="${state.figureBoard[k]}">`)}
function composeSelect(k,l,opts){return composeWrap(l,k,`<select data-compose-setting="${k}">${opts.map(([v,n])=>`<option value="${v}" ${String(state.figureBoard[k])===String(v)?'selected':''}>${n}</option>`).join('')}</select>`)}
function composeColor(k,l){return composeWrap(l,k,`<input data-compose-setting="${k}" type="color" value="${state.figureBoard[k]}">`)}
function composeCheck(k,l){return `<label class="check-row"><input data-compose-setting="${k}" type="checkbox" ${state.figureBoard[k]?'checked':''}>${l}</label>`}
function svgDataUri(svg){return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
function prefixSvgIds(text,prefix){let out=String(text);const ids=[];out=out.replace(/\bid="([^"]+)"/g,(m,id)=>{ids.push(id);return `id="${prefix}${id}"`});ids.forEach(id=>{const escId=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');out=out.replace(new RegExp(`url\\(#${escId}\\)`,'g'),`url(#${prefix}${id})`).replace(new RegExp(`(["'])#${escId}(["'])`,'g'),`$1#${prefix}${id}$2`)});return out}
function svgInner(text){const m=String(text).match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i);return m?m[1]:text}
function svgRootPresentation(text){try{const doc=new DOMParser().parseFromString(String(text),'image/svg+xml'),root=doc.documentElement;return{style:root.getAttribute('style')||'',fontFamily:root.getAttribute('font-family')||'',fontWeight:root.getAttribute('font-weight')||''}}catch{return{style:'',fontFamily:'',fontWeight:''}}}
function composeSvgMarkup(interactive=true){
  const b=state.figureBoard,items=b.items;if(!items.length&&!b.annotations.length)return'';ensureComposeGridCapacity();const W=clamp(Number(b.width)||1600,800,5000),H=clamp(Number(b.height)||1200,600,5000),cols=clamp(Number(b.columns)||2,1,6),rows=clamp(Math.max(Number(b.rows)||1,Math.ceil(items.length/cols)),1,8),gap=Math.max(0,Number(b.gap)||0),pad=Math.max(0,Number(b.padding)||0),cellW=(W-pad*2-gap*(cols-1))/cols,cellH=(H-pad*2-gap*(rows-1))/rows;
  let body=`<rect width="${W}" height="${H}" fill="${b.background}"/>`;
  items.forEach((item,i)=>{const c=i%cols,r=Math.floor(i/cols),x=pad+c*(cellW+gap),y=pad+r*(cellH+gap);if(item.kind==='image'){body+=`<image x="${x}" y="${y}" width="${cellW}" height="${cellH}" href="${escAttr(item.src)}" preserveAspectRatio="xMidYMid meet"/>`}else{const prefix=`p${i}_`,prefixed=prefixSvgIds(item.svg,prefix),inner=svgInner(prefixed),pres=svgRootPresentation(item.svg),style=pres.style?` style="${escAttr(pres.style)}"`:'',ff=pres.fontFamily?` font-family="${escAttr(pres.fontFamily)}"`:'',fw=pres.fontWeight?` font-weight="${escAttr(pres.fontWeight)}"`:'';body+=`<svg x="${x}" y="${y}" width="${cellW}" height="${cellH}" viewBox="0 0 ${item.width} ${item.height}" preserveAspectRatio="xMidYMid meet"${style}${ff}${fw}>${inner}</svg>`}if(b.panelBorder)body+=`<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="none" stroke="${b.panelBorderColor}" stroke-width="${b.panelBorderWidth}"/>`;if(b.labelEnabled){let lx=x+b.labelInsetX,ly=y+b.labelSize+b.labelInsetY,anchor='start';if(b.labelPosition==='top-right'){lx=x+cellW-b.labelInsetX;anchor='end'}else if(b.labelPosition==='outside-top-left'){lx=x-b.labelInsetX;ly=y-b.labelInsetY}body+=`<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-family="${escAttr(b.labelFont||'Arial')},sans-serif" font-size="${b.labelSize}" font-weight="${b.labelWeight}" fill="${b.labelColor}">${esc(item.label||indexLetter(i).toUpperCase())}</text>`}});
  body+=(b.annotations||[]).map(a=>composeAnnotationSvg(a,interactive)).join('');
  return `<svg id="composeSvg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" style="background:${b.background}"><defs><marker id="composeArrowHead" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,8 L9,4 z" fill="context-stroke"/></marker></defs>${body}</svg>`;
}
function exportComposeSvg(){const markup=composeSvgMarkup(false);if(!markup){toast('请先加入至少一张图或图片');return}download(new Blob([markup],{type:'image/svg+xml;charset=utf-8'}),`${safeFile(state.design.experimentName)}_论文拼图.svg`)}
function exportComposePng(){const markup=composeSvgMarkup(false);if(!markup){toast('请先加入至少一张图或图片');return}const b=state.figureBoard,scale=Math.max(1,Number(b.dpi||300)/96),url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml'})),img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=Math.round(b.width*scale);c.height=Math.round(b.height*scale);const ctx=c.getContext('2d');ctx.fillStyle=b.background;ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);c.toBlob(blob=>download(blob,`${safeFile(state.design.experimentName)}_论文拼图_${b.dpi}dpi.png`),'image/png');URL.revokeObjectURL(url)};img.onerror=()=>{URL.revokeObjectURL(url);toast('拼图导出失败，请检查导入图片格式')};img.src=url}


init();
