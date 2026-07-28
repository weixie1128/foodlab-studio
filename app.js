'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const templates = {
  foodchem: {fontEnglish:'Arial',fontChinese:'Microsoft YaHei',axis:1.35,colors:['#2f6b2f','#d98222','#526d70','#4c78a8','#a65d4e','#7b6aa8','#4f8f8b','#b07aa1','#d3a03b','#6d904f','#8c6d5a','#5f7f9e']},
  meatsci:  {fontEnglish:'Arial',fontChinese:'Microsoft YaHei',axis:1.25,colors:['#9fcd84','#70b865','#3e8c54','#83b9db','#1986bd','#546e7a','#c8b07a','#c9826b','#8f74a8','#6aa6a6','#b5a4d6','#8f8f8f']},
  nature:   {fontEnglish:'Arial',fontChinese:'Microsoft YaHei',axis:1.25,colors:['#3C5488','#E64B35','#00A087','#4DBBD5','#F39B7F','#8491B4','#91D1C2','#DC0000','#7E6148','#B09C85','#00A1D5','#6A3D9A']},
  mono:     {fontEnglish:'Times New Roman',fontChinese:'SimSun',axis:1.40,colors:['#111111','#333333','#555555','#777777','#999999','#bbbbbb','#222222','#444444','#666666','#888888','#aaaaaa','#cccccc']}
};

const defaultDesign = {
  experimentName:'肉品储藏品质研究', metricName:'Moisture content', metricUnit:'%', designType:'two',
  factorAName:'Storage time (d)', factorALevels:['0','2','4','6','8','10'],
  factorBName:'Temperature', factorBLevels:['4 °C','-1 °C','-18 °C'],
  parallelSamples:3, technicalRepeats:3, errorType:'sd'
};

const defaultChartSettings = {
  title:'Moisture content', titleX:490, titleY:39, titleSize:17, titleWeight:600, titleColor:'#14212a',
  subtitle:'', subtitleEnabled:false, subtitleX:490, subtitleY:60, subtitleSize:11, subtitleWeight:400, subtitleColor:'#687783',
  xTitle:'Storage time (d)', xTitleX:490, xTitleY:626, xTitleSize:15,
  yTitle:'Moisture content (%)', yTitleX:31, yTitleY:332, yTitleSize:15,
  fontEnglish:'Arial', fontChinese:'Microsoft YaHei', globalFontWeight:400, axisTitleWeight:400, tickWeight:400, legendWeight:400,
  canvasWidth:980, canvasHeight:660, panelPreset:'normal', pngDpi:300,
  axisColor:'#20262b', axisWidth:1.35, frameMode:'box', frameWidth:1.15, frameColor:'#20262b',
  tickSize:12, tickLength:6, xTickRotation:0, xTickStagger:false, showXTicks:true, showYTicks:true,
  lineWidth:2.1, markerSize:4.7, markerShape:'circle', markerFill:'white', lineMode:'straight', lineOffset:0,
  barGap:3, categoryWidth:.72, barOpacity:.96, barBorderWidth:.55,
  errorWidth:1.15, errorCap:10, errorColorMode:'series', errorXOffset:0,
  legendSize:12, legendVisible:true, legendOrientation:'horizontal', legendColumns:3,
  legendFrameStyle:'solid', legendFrameWidth:1, legendFrameColor:'#7d898f', legendFrameRadius:2, legendFrameFill:'#ffffff',
  legendShadow:true, legendShadowX:2, legendShadowY:3, legendShadowBlur:3, legendShadowOpacity:.28,
  letters:true, letterSize:11, letterWeight:400, letterOffset:10,
  yMin:null, yMax:null, yTickStep:null,
  lowerMin:0, lowerMax:20, upperMin:70, upperMax:82, breakGap:12, lowerRatio:.23,
  background:'#ffffff'
};


const defaultGallerySettings = {
  title:'',titleX:null,titleY:38,titleSize:17,titleWeight:600,titleColor:'#14212a',
  subtitle:'',subtitleEnabled:false,subtitleX:null,subtitleY:58,subtitleSize:11,subtitleWeight:400,subtitleColor:'#687783',
  xTitle:'',xTitleX:null,xTitleY:null,xTitleSize:15,xTitleWeight:400,xTitleColor:'#20262b',
  yTitle:'Value',yTitleX:28,yTitleY:null,yTitleSize:15,yTitleWeight:400,yTitleColor:'#20262b',
  width:980,height:660,dpi:300,panelPreset:'normal',
  fontEnglish:'Arial',fontChinese:'Microsoft YaHei',globalFontWeight:400,tickSize:12,tickWeight:400,
  axisWidth:1.35,axisColor:'#20262b',tickLength:6,showXTicks:true,showYTicks:true,
  frameMode:'box',frameWidth:1.15,frameColor:'#20262b',background:'#ffffff',
  legend:true,legendX:120,legendY:62,legendFontSize:12,legendWeight:400,legendOrientation:'horizontal',legendColumns:3,
  legendFrameStyle:'none',legendFrameX:108,legendFrameY:50,legendFrameWidthBox:260,legendFrameHeightBox:62,legendFrameAutoSize:true,
  legendFrameWidth:1,legendFrameColor:'#7d898f',legendFrameFill:'#ffffff',legendFrameRadius:3,
  legendShadow:true,legendShadowX:2,legendShadowY:3,legendShadowBlur:3,legendShadowOpacity:.25,
  bins:10,bandwidth:0,opacity:.72,pointSize:4,lineWidth:2,markerShape:'circle',markerFill:'series',
  showPoints:true,showMean:true,showMedian:true,showOutliers:true,boxWidth:.48,whiskerWidth:1.1,medianWidth:1.5,
  orientation:'vertical',donut:false,normalize:false,showRegression:true,showCorrelation:true,
  heatmapShowValues:true,heatmapCellGap:1,radarGridWidth:1,radarPointSize:3,colorScheme:'foodchem'
};

const EXPERIMENT_CHARTS=['bar','line','curve'];
const WORKFLOW_GOAL_DEFAULTS={compare:'bar',trend:'line',dist:'box',relation:'scatter',multi:'radar',composition:'stacked'};
function isExperimentChart(type){return EXPERIMENT_CHARTS.includes(type)}
function setWorkflowChart(type,{keepData=false}={}){
  state.workflow.chartType=type;
  state.workflow.mode=isExperimentChart(type)?'experiment':'gallery';
  state.chart.mode=state.workflow.mode;
  if(state.workflow.mode==='experiment')state.chart.type=type;
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
function currentWorkflowSchema(){return state.workflow.mode==='experiment'?{name:'实验原始数据长表',description:'独立平行样本 × 测定重复，用于 ANOVA、误差棒和显著性字母。'}:GALLERY_SCHEMAS[(GALLERY_CHARTS.find(x=>x.id===state.workflow.chartType)||{}).schema]}

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
    settings:structuredClone(defaultChartSettings), palette:[...templates.foodchem.colors], legend:{x:132,y:70}, legendFrame:{x:118,y:58,width:260,height:62,autoSize:true}, seriesStyles:{}
  },
  gallery:{
    type:'box', rows:[], sourceName:'', analysis:null,
    settings:structuredClone(defaultGallerySettings),
    palette:[...templates.foodchem.colors], goal:'compare', showAll:false, selected:'title', selectedSeries:0, seriesStyles:{}
  }
};

function init(){
  bindNavigation();
  bindWorkflow();
  bindDesign();
  bindData();
  bindStatistics();
  bindChartUi();
  bindGallery();
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
  return ({plan:'design',design:'data',data:'statistics',statistics:'chart',chart:'chart'})[view] || 'plan';
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
    chart:['Chart Studio','统一编辑坐标轴、标题、图例、误差棒与图形专属属性。','留在 Chart Studio']
  };
  const m=map[view]||map.plan;
  $('#pageTitle').textContent=m[0]; $('#pageSubtitle').textContent=m[1]; $('#nextStepBtn').textContent=m[2];
  const stepMap={plan:1,design:2,data:3,statistics:4,chart:5};
  const step=stepMap[view]||1;
  const stepLabel=$('#pageStepLabel');if(stepLabel)stepLabel.textContent=`步骤 ${step} / 5`;
  $$('[data-view]').forEach(el=>{if(el.closest('#mainNav')||el.closest('#workflowProgress'))el.classList.toggle('active',el.dataset.view===view)});
  const topChart=$('#topCurrentChart');if(topChart)topChart.textContent=workflowChartLabel(state.workflow.chartType);
  const sideChart=$('#sidebarChartName');if(sideChart)sideChart.textContent=workflowChartLabel(state.workflow.chartType);
  const sideProject=$('#sidebarProjectName');if(sideProject)sideProject.textContent=state.design.experimentName||'未命名项目';
  if(view==='plan'){syncWorkflowControls();renderPlanSelector()}
  if(view==='design'){syncWorkflowControls();renderDesignPreview();syncStepLabels()}
  if(view==='data'){syncWorkflowControls();renderDataPreview()}
  if(view==='statistics') renderStatistics();
  if(view==='chart') {
    state.chart.mode=state.workflow.mode;
    if(state.workflow.mode==='experiment')prepareChartData();else{state.gallery.type=state.workflow.chartType;analyzeGalleryData()}
    renderChartStudio();
  }
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
  $$('.experiment-only').forEach(el=>el.classList.toggle('hidden',state.workflow.mode!=='experiment'));toggleFactorB();syncStepLabels();
  const top=$('#topCurrentChart');if(top)top.textContent=workflowChartLabel(state.workflow.chartType);
  const side=$('#sidebarChartName');if(side)side.textContent=workflowChartLabel(state.workflow.chartType);
}


const PLAN_CHART_META={
  bar:{group:'趋势与组间差异',icon:'▥',purpose:'比较不同处理组或不同时间点的均值差异',analysis:'描述统计、单/双因素 ANOVA、显著性字母',advice:'适合 Mean ± SD/SE 的常规食品实验论文图',schema:'实验原始数据长表'},
  line:{group:'趋势与组间差异',icon:'⌁',purpose:'展示储藏时间、温度或浓度变化趋势',analysis:'描述统计、ANOVA、误差棒和显著性字母',advice:'食品品质随时间变化的优先图形',schema:'实验原始数据长表'},
  curve:{group:'趋势与组间差异',icon:'∿',purpose:'展示数据点较密集的连续变化趋势',analysis:'趋势摘要与连续数据检查',advice:'仅平滑连线，不擅自修改原始数值；默认不显示误差棒',schema:'实验原始数据长表'},
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
  ['experimentName','metricName','metricUnit','factorAName','factorALevels','factorBName','factorBLevels','parallelSamples','technicalRepeats','errorType','designType'].forEach(id=>{
    $('#'+id).addEventListener('input',()=>{ readDesignForm(false); renderDesignPreview(); const side=$('#sidebarProjectName');if(side)side.textContent=$('#experimentName').value.trim()||'未命名项目'; });
  });
  $('#designType').addEventListener('change',toggleFactorB);
  $('#applyDesign').addEventListener('click',()=>{ if(readDesignForm(true)){renderDesignPreview();toast('研究设计已应用')} });
  $('#downloadXlsx').addEventListener('click',()=>state.workflow.mode==='experiment'?downloadTemplateXlsx():downloadGalleryXlsx());
  $('#downloadCsv').addEventListener('click',()=>state.workflow.mode==='experiment'?downloadTemplateCsv():downloadGalleryCsv());
  $('#loadDesignDemo').addEventListener('click',()=>{state.design=structuredClone(defaultDesign);fillDesignForm();renderDesignPreview();toast('已载入双因素演示设计')});
}

function fillDesignForm(){
  const d=state.design;
  $('#experimentName').value=d.experimentName; $('#metricName').value=d.metricName; $('#metricUnit').value=d.metricUnit;
  $('#designType').value=d.designType; $('#factorAName').value=d.factorAName; $('#factorALevels').value=d.factorALevels.join(', ');
  $('#factorBName').value=d.factorBName; $('#factorBLevels').value=d.factorBLevels.join(', '); $('#parallelSamples').value=d.parallelSamples; $('#technicalRepeats').value=d.technicalRepeats; $('#errorType').value=d.errorType;
  toggleFactorB();syncWorkflowControls();
}

function splitLevels(text){ return [...new Set(String(text).split(/[,，;；\n]+/).map(x=>x.trim()).filter(Boolean))]; }

function readDesignForm(showErrors=true){
  const d={
    experimentName:$('#experimentName').value.trim(), metricName:$('#metricName').value.trim(), metricUnit:$('#metricUnit').value.trim(),
    designType:$('#designType').value, factorAName:$('#factorAName').value.trim(), factorALevels:splitLevels($('#factorALevels').value),
    factorBName:$('#factorBName').value.trim(), factorBLevels:splitLevels($('#factorBLevels').value),
    parallelSamples:Number($('#parallelSamples').value), technicalRepeats:Number($('#technicalRepeats').value), errorType:$('#errorType').value
  };
  const errors=[];
  if(!d.experimentName)errors.push('请填写实验名称'); if(!d.metricName)errors.push('请填写测定指标');
  if(state.workflow.mode==='experiment'){
    if(!d.factorAName)errors.push('请填写因素 A 名称'); if(d.factorALevels.length<2)errors.push('因素 A 至少需要 2 个水平');
    if(d.designType==='two'&&!d.factorBName)errors.push('请填写因素 B 名称'); if(d.designType==='two'&&d.factorBLevels.length<2)errors.push('因素 B 至少需要 2 个水平');
    if(!Number.isInteger(d.parallelSamples)||d.parallelSamples<2)errors.push('每个组合至少需要 2 个独立平行样本');
    if(!Number.isInteger(d.technicalRepeats)||d.technicalRepeats<1)errors.push('每个平行样本至少需要 1 次测定');
  }
  if(errors.length){ if(showErrors)toast(errors[0]); return false; }
  if(d.designType==='one'){d.factorBName='';d.factorBLevels=[''];}
  state.design=d; return true;
}

function toggleFactorB(){ const on=state.workflow.mode==='experiment'&&$('#designType').value==='two'; $$('.factor-b').forEach(el=>el.classList.toggle('hidden',!on)); }

function templateRows(){
  const d=state.design, rows=[]; let sampleIndex=1;
  const bLevels=d.designType==='two'?d.factorBLevels:[''];
  d.factorALevels.forEach(a=>bLevels.forEach(b=>{
    for(let p=1;p<=d.parallelSamples;p++){
      const sampleId=`S${String(sampleIndex++).padStart(3,'0')}`;
      for(let t=1;t<=d.technicalRepeats;t++)rows.push({
        '样品编号':sampleId,'因素A水平':a,'因素B水平':b,'平行样本编号':p,'测定重复编号':t,'测定值':'','备注':''
      });
    }
  }));
  return rows;
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
  const rows=templateRows();
  const groupCount=d.factorALevels.length*(d.designType==='two'?d.factorBLevels.length:1);
  const independentCount=groupCount*d.parallelSamples;
  $('#designSummaryText').textContent=`${d.designType==='two'?'双因素':'单因素'} · ${d.factorAName}${d.designType==='two'?` × ${d.factorBName}`:''} · 每组 ${d.parallelSamples} 平行 × 每平行 ${d.technicalRepeats} 次测定 · ${workflowChartLabel(state.workflow.chartType)}`;
  $('#templateRowCount').textContent=`${rows.length} 个原始值 · ${independentCount} 个独立样品`;
  const preview=rows.slice(0,12), headers=['样品编号',d.factorAName,d.designType==='two'?d.factorBName:null,'平行样本','测定重复',`${d.metricName}${d.metricUnit?` (${d.metricUnit})`:''}`].filter(Boolean);
  let html=`<thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>`;
  preview.forEach(r=>{html+='<tr><td>'+esc(r['样品编号'])+'</td><td>'+esc(r['因素A水平'])+'</td>'+(d.designType==='two'?`<td>${esc(r['因素B水平'])}</td>`:'')+`<td>${r['平行样本编号']}</td><td>${r['测定重复编号']}</td><td class="muted-cell">待填写</td></tr>`});
  if(rows.length>preview.length)html+=`<tr><td colspan="${headers.length}" class="empty-row">……其余 ${rows.length-preview.length} 行将在模板中完整生成</td></tr>`;
  $('#designPreviewTable').innerHTML=html+'</tbody>';syncWorkflowControls();
}

function designConfigRows(){
  const d=state.design; return [
    ['配置项','值'],['FoodLab模板版本','0.7.0'],['实验名称',d.experimentName],['研究目的',state.workflow.goal],['计划图形',state.workflow.chartType],['测定指标',d.metricName],['单位',d.metricUnit],
    ['实验类型',d.designType],['因素A名称',d.factorAName],['因素A水平',d.factorALevels.join('|')],['因素B名称',d.factorBName],['因素B水平',d.factorBLevels.join('|')],
    ['平行样本数',d.parallelSamples],['每个平行样本测定重复数',d.technicalRepeats],['误差棒',d.errorType]
  ];
}

function downloadTemplateXlsx(){
  if(!readDesignForm(true))return;
  if(!window.XLSX){downloadTemplateCsv();toast('Excel 组件未加载，已改为下载 CSV 模板');return;}
  const wb=XLSX.utils.book_new(), rows=templateRows();
  const headers=['样品编号','因素A水平','因素B水平','平行样本编号','测定重复编号','测定值','备注'];
  const ws=XLSX.utils.json_to_sheet(rows,{header:headers});
  ws['!cols']=[{wch:13},{wch:18},{wch:18},{wch:14},{wch:14},{wch:15},{wch:26}]; ws['!autofilter']={ref:ws['!ref']};
  const config=XLSX.utils.aoa_to_sheet(designConfigRows()); config['!cols']=[{wch:24},{wch:55}];
  const guide=XLSX.utils.aoa_to_sheet([
    ['FoodLab Studio 原始数据模板填写说明'],['1. 只在“数据填写”工作表的“测定值”列中填写单个原始数据。'],
    ['2. “平行样本编号”代表相互独立的样品；“测定重复编号”代表同一样品的重复测量。'],
    ['3. 平台先计算每个独立样品的测定重复均值，再以独立样品均值进行统计分析，避免伪重复。'],
    ['4. 不要填写平均值、标准差或“平均值±标准差”，也不要修改样品编号和编号列。'],
    ['5. “备注”列可选填；空白测定值不会参与分析。'],['6. 完成后将整个 Excel 文件导入 FoodLab Studio。']
  ]); guide['!cols']=[{wch:94}];
  XLSX.utils.book_append_sheet(wb,ws,'数据填写'); XLSX.utils.book_append_sheet(wb,config,'项目配置（勿改）'); XLSX.utils.book_append_sheet(wb,guide,'填写说明');
  XLSX.writeFile(wb,`${safeFile(state.design.experimentName)}_FoodLab原始数据模板.xlsx`);
  toast('Excel 模板已生成');
}

function downloadTemplateCsv(){
  if(!readDesignForm(true))return;
  const rows=templateRows(), headers=['样品编号','因素A水平','因素B水平','平行样本编号','测定重复编号','测定值','备注'];
  const csv='\ufeff'+[headers,...rows.map(r=>headers.map(h=>r[h]))].map(row=>row.map(csvCell).join(',')).join('\r\n');
  download(new Blob([csv],{type:'text/csv;charset=utf-8'}),`${safeFile(state.design.experimentName)}_FoodLab原始数据模板.csv`);
  toast('CSV 模板已生成');
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
    const lower=file.name.toLowerCase(); let rows, config=null;
    if(lower.endsWith('.csv')||lower.endsWith('.tsv')) rows=parseDelimited(await file.text());
    else{
      if(!window.XLSX)throw new Error('Excel 组件未加载，请刷新页面或使用 CSV 模板。');
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
      const dataName=wb.SheetNames.includes('数据填写')?'数据填写':wb.SheetNames[0];
      rows=XLSX.utils.sheet_to_json(wb.Sheets[dataName],{defval:'',raw:true});
      if(wb.SheetNames.includes('项目配置（勿改）')) config=XLSX.utils.sheet_to_json(wb.Sheets['项目配置（勿改）'],{header:1,defval:''});
    }
    if(config)applyImportedConfig(config);
    processImported(rows,file.name);
  }catch(err){showValidation('error','导入失败',err.message);toast(err.message)}
}

function applyImportedConfig(rows){
  const map={}; rows.slice(1).forEach(r=>{if(r[0])map[String(r[0])]=r[1]});
  if(!map['FoodLab模板版本'])return;
  state.design={
    experimentName:String(map['实验名称']||'未命名实验'), metricName:String(map['测定指标']||'指标值'), metricUnit:String(map['单位']||''),
    designType:String(map['实验类型']||'one'), factorAName:String(map['因素A名称']||'因素 A'), factorALevels:String(map['因素A水平']||'').split('|').filter(Boolean),
    factorBName:String(map['因素B名称']||''), factorBLevels:String(map['因素B水平']||'').split('|'),
    parallelSamples:Number(map['平行样本数']||map['独立平行样本数']||map['重复数']||3),
    technicalRepeats:Number(map['每个平行样本测定重复数']||map['测定重复数']||1), errorType:String(map['误差棒']||'sd')
  };
  if(state.design.designType==='one')state.design.factorBLevels=[''];
  if(map['计划图形']){state.workflow.goal=String(map['研究目的']||'compare');setWorkflowChart(String(map['计划图形']),{keepData:true})}
  fillDesignForm();renderDesignPreview();
}

function normalizeHeader(h){return String(h??'').trim().toLowerCase().replace(/[\s_()（）%]/g,'')}
function findKey(obj, aliases){const keys=Object.keys(obj);return keys.find(k=>aliases.includes(normalizeHeader(k)))}

function processImported(rows,source){
  if(!Array.isArray(rows)||!rows.length){showValidation('error','没有识别到数据','文件为空或表头不正确。');return}
  const first=rows[0], ka=findKey(first,['因素a水平','factora','a','x']), kb=findKey(first,['因素b水平','factorb','b','group']),
    kp=findKey(first,['平行样本编号','平行编号','独立重复编号','parallel','parallelreplicate','biologicalreplicate']),
    kt=findKey(first,['测定重复编号','技术重复编号','测量重复编号','technicalrepeat','measurementrepeat']),
    kr=findKey(first,['重复编号','replicate','rep','重复']), kv=findKey(first,['测定值','value','result','数值']), ks=findKey(first,['样品编号','sampleid','sample']);
  if(!ka||!kv){showValidation('error','表头不符合模板','至少需要“因素A水平”和“测定值”两列。请使用研究设计页生成的模板。');return}
  const parsed=[], errors=[], seen=new Set();
  rows.forEach((row,i)=>{
    const raw=String(row[kv]??'').trim(); if(raw==='')return;
    const value=Number(raw); if(!Number.isFinite(value)){errors.push(`第 ${i+2} 行测定值不是数字`);return}
    const a=String(row[ka]??'').trim(), b=kb?String(row[kb]??'').trim():'',
      parallel=Number(kp?row[kp]:(kr?row[kr]:1)), technical=Number(kt?row[kt]:1),
      sample=ks?String(row[ks]??'').trim():`${a}-${b||'G'}-P${parallel}`;
    if(!a){errors.push(`第 ${i+2} 行缺少因素 A 水平`);return}
    if(!Number.isFinite(parallel)||parallel<1){errors.push(`第 ${i+2} 行平行样本编号无效`);return}
    if(!Number.isFinite(technical)||technical<1){errors.push(`第 ${i+2} 行测定重复编号无效`);return}
    const key=`${a}\u0001${b}\u0001${parallel}\u0001${technical}`; if(seen.has(key))errors.push(`第 ${i+2} 行与前面存在重复的因素组合、平行样本和测定重复编号`); seen.add(key);
    parsed.push({sampleId:sample||`${a}-${b||'G'}-P${parallel}`,a,b,parallel,technical,rep:parallel,value});
  });
  if(!parsed.length){showValidation('error','没有有效测定值','请在模板的“测定值”列填写原始数字。');return}
  state.rawData=parsed;
  const observedA=[...new Set(parsed.map(r=>r.a))], observedB=[...new Set(parsed.map(r=>r.b))];
  if(!state.design.factorALevels.length||!observedA.every(x=>state.design.factorALevels.includes(x)))state.design.factorALevels=observedA;
  if(observedB.some(Boolean)){state.design.designType='two';state.design.factorBLevels=observedB; if(!state.design.factorBName)state.design.factorBName='因素 B';}
  else{state.design.designType='one';state.design.factorBLevels=[''];}
  const perCell=new Map();parsed.forEach(r=>{const k=`${r.a}\u0001${r.b}`;if(!perCell.has(k))perCell.set(k,new Map());const samples=perCell.get(k);if(!samples.has(r.parallel))samples.set(r.parallel,new Set());samples.get(r.parallel).add(r.technical)});
  const sampleCounts=[...perCell.values()].map(m=>m.size),techCounts=[...perCell.values()].flatMap(m=>[...m.values()].map(v=>v.size));
  if(sampleCounts.length)state.design.parallelSamples=Math.max(...sampleCounts);
  if(techCounts.length)state.design.technicalRepeats=Math.max(...techCounts);
  fillDesignForm();renderDesignPreview();renderDataPreview();
  const independentCount=collapseTechnicalReplicates(parsed).length,unevenSamples=new Set(sampleCounts).size>1,unevenTechnical=new Set(techCounts).size>1;
  if(errors.length)showValidation('warning',`已导入 ${parsed.length} 个有效值，但发现 ${errors.length} 个问题`,errors.slice(0,3).join('；'));
  else if(unevenSamples||unevenTechnical)showValidation('warning',`已导入 ${parsed.length} 个原始测定值`,`共 ${independentCount} 个独立样品；${unevenSamples?'不同实验组合的平行样本数不一致。':''}${unevenTechnical?'部分样品的测定重复次数不一致。':''}平台仍可计算描述统计，但请核对缺失值和研究设计。`);
  else showValidation('success',`导入成功：${parsed.length} 个原始测定值`,`${independentCount} 个独立平行样本 · ${source} · ${observedA.length} 个因素 A 水平${state.design.designType==='two'?` · ${observedB.length} 个因素 B 水平`:''}`);
  analyzeData(); toast('数据已导入并完成初步分析');
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
    const [m,sd]=means[`${a}|${b}`],sampleMeans=[m-sd,m,m+sd];
    sampleMeans.forEach((sampleMean,p)=>{const sampleId=`S${String(n++).padStart(3,'0')}`,noise=sd*.08;[-noise,0,noise].forEach((delta,t)=>raw.push({sampleId,a,b,parallel:p+1,technical:t+1,rep:p+1,value:Number((sampleMean+delta).toFixed(4))}))});
  }));
  state.rawData=raw;renderDataPreview();showValidation('success',`演示数据已载入：${raw.length} 个原始值`,`已按 3 平行 × 3 次测定生成，共 ${collapseTechnicalReplicates(raw).length} 个独立样品。`);analyzeData();toast('已载入完整演示数据');
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
  const map=new Map();
  rows.forEach((r,i)=>{
    const parallel=Number.isFinite(Number(r.parallel))?Number(r.parallel):(Number.isFinite(Number(r.rep))?Number(r.rep):i+1);
    const key=`${r.a}\u0001${r.b}\u0001${parallel}`;
    if(!map.has(key))map.set(key,{a:r.a,b:r.b,parallel,sampleId:r.sampleId||`P${parallel}`,values:[]});
    map.get(key).values.push(Number(r.value));
  });
  return [...map.values()].map(x=>({a:x.a,b:x.b,parallel:x.parallel,rep:x.parallel,sampleId:x.sampleId,value:mean(x.values),technicalN:x.values.length,technicalSd:sampleSd(x.values)}));
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
  $('#statsDesignLine').textContent=`${d.experimentName} · ${d.metricName}${d.metricUnit?` (${d.metricUnit})`:''} · ${d.designType==='two'?`${d.factorAName} × ${d.factorBName}`:d.factorAName} · ${d.parallelSamples} 平行 × ${d.technicalRepeats} 测定重复 · ${workflowChartLabel(state.workflow.chartType)}`;
  $('#summaryCards').innerHTML=[
    ['原始测定值',state.rawData.length||'—'],['独立平行样本',state.analysisRows.length||'—'],['实验组合',desc.length||'—'],['分析模型',!a?'—':a.kind==='two'?'双因素 ANOVA':'单因素 ANOVA']
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
  const methodRows=galleryMethodRows(def.id);
  $('#anovaMethodText').textContent='当前页面先完成描述性统计和与图形对应的初步分析；不在条件不足时自动给出显著性结论。';
  $('#anovaTable').innerHTML=`<thead><tr><th>建议分析</th><th>用途</th><th>当前状态</th></tr></thead><tbody>${methodRows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody>`;
  const box=$('#interpretationText');box.className=a?'interpretation':'interpretation empty';box.innerHTML=a?`<p>${esc(a.text||'已完成初步分析。')}</p><p class="small-note">该结果已与“${def.name}”绑定，下一步进入论文图工作台后继续编辑。</p>`:'暂无可解释结果。';
}
function galleryMethodRows(type){
  if(['box','violin','hist','kde'].includes(type))return[['描述统计','n、均值、标准差、中位数、四分位数和异常值','已接入'],['组间检验','正态性与方差齐性后选择 ANOVA 或非参数检验','待后续增强']];
  if(['scatter','bubble'].includes(type))return[['Pearson 相关','衡量线性相关程度','已接入'],['线性回归','斜率、截距和 R²','已接入'],['Spearman 相关','适合非正态或秩相关','待后续增强']];
  if(type==='heatmap')return[['Pearson 相关矩阵','多指标线性相关','已接入'],['Spearman 矩阵','多指标秩相关','待后续增强'],['显著性标记','相关系数 p 值和星号','待后续增强']];
  if(type==='radar')return[['归一化','不同量纲指标统一尺度','已接入'],['综合评分','权重与综合评价','待后续增强']];
  if(['stacked','pie'].includes(type))return[['构成比例','类别总量和组分百分比','已接入'],['组成差异检验','比较不同类别构成差异','待后续增强']];
  return[['描述统计','基础数据概览','已接入']];
}

function renderDescriptiveTable(){
  const d=state.design,cols=d.designType==='two'?9:8;let html=`<thead><tr><th>${esc(d.factorAName)}</th>${d.designType==='two'?`<th>${esc(d.factorBName)}</th>`:''}<th>n（独立样本）</th><th>每样品测定次数</th><th>Mean</th><th>SD</th><th>SE</th><th>CV (%)</th><th>95% CI</th></tr></thead><tbody>`;
  if(!state.descriptive.length)html+=`<tr><td colspan="${cols}" class="empty-row">请先导入原始数据</td></tr>`;
  state.descriptive.forEach(r=>html+=`<tr><td>${esc(r.a)}</td>${d.designType==='two'?`<td>${esc(r.b)}</td>`:''}<td>${r.n}</td><td>${r.technicalLabel}</td><td>${formatNumber(r.mean,4)}</td><td>${formatNumber(r.sd,4)}</td><td>${formatNumber(r.se,4)}</td><td>${r.cv==null?'—':formatNumber(r.cv,2)}</td><td>${formatNumber(r.mean-r.ci,4)}–${formatNumber(r.mean+r.ci,4)}</td></tr>`);
  $('#descriptiveTable').innerHTML=html+'</tbody>';
}

function renderAnovaTable(){
  const a=state.analysis;$('#anovaMethodText').textContent=(state.design.designType==='two'?'平衡设计双因素 ANOVA，含交互作用。':'单因素 ANOVA。')+' 同一样品的测定重复先取均值，独立平行样本均值作为统计单元。';
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
}

function prepareChartData(){
  if(!state.descriptive.length&&state.rawData.length)analyzeData();
  const d=state.design, xFactor=state.chart.xFactor;
  if(d.designType==='one'){
    const letters=lettersForComparisons(state.descriptive.map(r=>({label:r.a,mean:r.mean,n:r.n})),state.analysis?.mse,state.analysis?.dfError);
    state.chartData=state.descriptive.map(r=>({x:r.a,group:d.metricName,mean:r.mean,error:errorValue(r),letter:letters[r.a]||''}));
  }else{
    const xLevels=xFactor==='A'?d.factorALevels:d.factorBLevels, groupLevels=xFactor==='A'?d.factorBLevels:d.factorALevels, rows=[];
    xLevels.forEach(x=>{
      const comps=groupLevels.map(g=>{const r=state.descriptive.find(s=>xFactor==='A'?(s.a===x&&s.b===g):(s.b===x&&s.a===g));return r?{label:g,mean:r.mean,n:r.n,row:r}:null}).filter(Boolean);
      const letters=lettersForComparisons(comps,state.analysis?.mse,state.analysis?.dfError);
      comps.forEach(c=>rows.push({x,group:c.label,mean:c.mean,error:errorValue(c.row),letter:letters[c.label]||''}));
    });
    state.chartData=rows;
  }
  syncChartText();
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
  if(s.legendFrameX==null)s.legendFrameX=108;if(s.legendFrameY==null)s.legendFrameY=50;
}
function galleryHasAxes(type=state.gallery.type){return !['pie','radar','heatmap'].includes(type)}
function galleryHasLegend(type=state.gallery.type){return type!=='heatmap'}
function gallerySpecificLayerIds(type=state.gallery.type){
  const map={
    hist:[['histogram','柱体与分箱']],kde:[['density','密度曲线']],box:[['box-elements','箱体 / 中位线 / 须线 / 散点']],violin:[['violin-elements','小提琴 / 箱线 / 散点']],
    scatter:[['regression','拟合线与相关系数']],bubble:[['regression','拟合线与相关系数'],['bubble-size','气泡大小']],stacked:[['stack-mode','堆叠方式']],pie:[['pie-label','比例标签']],
    heatmap:[['heatmap-scale','色阶与数值']],radar:[['radar-grid','雷达网格']]
  };return map[type]||[];
}
function galleryStudioLayers(){
  const type=state.gallery.type,layers=[['section','基础对象'],['title','图题','base'],['subtitle','副标题','base'],['typography','中英文字体','base'],['canvas','画布与清晰度','base']];
  if(galleryHasLegend(type))layers.push(['legend','图例内容','base'],['legend-frame','图例边框','base']);
  if(galleryHasAxes(type))layers.push(['axis-y','Y 轴与纵标题','base'],['axis-x','X 轴与横标题','base'],['frame','图片边框','base']);
  layers.push(['background','背景','base'],['section','数据对象']);
  galleryStudioSeriesNames().forEach((g,i)=>layers.push([`series:${i}`,`数据系列 · ${g}`,'series']));
  gallerySpecificLayerIds(type).forEach(([id,name])=>layers.push([id,name,'special']));
  return layers;
}
function renderGalleryStudioLayers(){
  $('#layersList').innerHTML=galleryStudioLayers().map(item=>{
    if(item[0]==='section')return `<div class="layer-section-label">${item[1]}</div>`;
    const [id,name,kind]=item,active=id.startsWith('series:')?state.gallery.selected==='series'&&state.gallery.selectedSeries===Number(id.split(':')[1]):state.gallery.selected===id;
    return `<button class="layer-item ${active?'active':''}" data-glayer="${id}"><span class="layer-dot"></span>${esc(name)}<span class="layer-tag ${kind==='special'?'special':''}">${kind==='special'?'专属':'基础'}</span></button>`;
  }).join('');
  $$('[data-glayer]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.glayer;if(id.startsWith('series:')){state.gallery.selected='series';state.gallery.selectedSeries=Number(id.split(':')[1])}else state.gallery.selected=id;
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
    e.stopPropagation();const id=el.dataset.gobject;state.gallery.selected=id;if(id==='series'&&el.dataset.gseries!=null)state.gallery.selectedSeries=Number(el.dataset.gseries);
    renderGalleryStudioLayers();renderGalleryStudioProperties();highlightGalleryObject();
  }));
}
function bindGalleryStudioDraggables(){
  const svg=$('#paperSvg');if(!svg)return;
  $$('[data-gdrag]').forEach(el=>el.addEventListener('pointerdown',e=>{
    e.preventDefault();e.stopPropagation();const key=el.dataset.gdrag,s=state.gallery.settings,start=svgPoint(svg,e),snap=galleryDragSnapshot(key);el.setPointerCapture(e.pointerId);
    state.gallery.selected=key==='xTitle'?'axis-x':key==='yTitle'?'axis-y':key==='legendFrame'?'legend-frame':key;
    const move=ev=>{const p=svgPoint(svg,ev),x=snap.x+p.x-start.x,y=snap.y+p.y-start.y;galleryApplyDrag(key,x,y,el)};
    const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);renderGalleryStudioLayers();renderGalleryStudioProperties()};
    el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);
  }));
}
function galleryDragSnapshot(key){
  const s=state.gallery.settings;
  if(key==='title')return{x:s.titleX??s.width/2,y:s.titleY??38};if(key==='subtitle')return{x:s.subtitleX??s.width/2,y:s.subtitleY??58};
  if(key==='legend')return{x:s.legendX??120,y:s.legendY??62};if(key==='legendFrame')return{x:s.legendFrameX??108,y:s.legendFrameY??50};
  if(key==='xTitle')return{x:s.xTitleX??s.width/2,y:s.xTitleY??s.height-24};return{x:s.yTitleX??28,y:s.yTitleY??s.height/2};
}
function galleryApplyDrag(key,x,y,el){
  const s=state.gallery.settings;
  if(key==='title'){s.titleX=x;s.titleY=y;el.setAttribute('x',x);el.setAttribute('y',y)}
  else if(key==='subtitle'){s.subtitleX=x;s.subtitleY=y;el.setAttribute('x',x);el.setAttribute('y',y)}
  else if(key==='legend'){s.legendX=x;s.legendY=y;el.setAttribute('transform',`translate(${x} ${y})`)}
  else if(key==='legendFrame'){s.legendFrameX=x;s.legendFrameY=y;el.setAttribute('transform',`translate(${x} ${y})`)}
  else if(key==='xTitle'){s.xTitleX=x;s.xTitleY=y;el.setAttribute('x',x);el.setAttribute('y',y)}
  else{s.yTitleX=x;s.yTitleY=y;el.setAttribute('transform',`translate(${x} ${y}) rotate(-90)`)}
}
function galleryBasePropertyHtml(id){
  const s=state.gallery.settings;
  if(id==='title')return gallerySection('图题文字',[gText('title','图题文字'),gNumber('titleX','水平位置',0,1800,1),gNumber('titleY','垂直位置',0,1200,1),gRange('titleSize','字号',9,40,1),gSelect('titleWeight','字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']]),gColor('titleColor','颜色')])+galleryDragHint('图题');
  if(id==='subtitle')return gallerySection('副标题',[gCheck('subtitleEnabled','显示副标题'),gText('subtitle','副标题文字'),gNumber('subtitleX','水平位置',0,1800,1),gNumber('subtitleY','垂直位置',0,1200,1),gRange('subtitleSize','字号',8,28,1),gSelect('subtitleWeight','字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗']]),gColor('subtitleColor','颜色')])+galleryDragHint('副标题');
  if(id==='typography')return gallerySection('字体族',[gSelect('fontEnglish','英文字体',[['Arial','Arial'],['Times New Roman','Times New Roman'],['Calibri','Calibri'],['Helvetica','Helvetica'],['Georgia','Georgia']]),gSelect('fontChinese','中文字体',[['Microsoft YaHei','微软雅黑'],['SimSun','宋体'],['SimHei','黑体'],['KaiTi','楷体'],['FangSong','仿宋']])])+gallerySection('基础字重',[gSelect('globalFontWeight','全局文字粗细',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']]),gSelect('tickWeight','刻度数字粗细',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗']]),gSelect('legendWeight','图例文字粗细',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗']])]);
  if(id==='canvas')return gallerySection('画布',[gSelect('panelPreset','图幅比例',[['normal','常规 980×660'],['small','拼图小图 760×540'],['square','正方图 700×700'],['wide','宽图 1080×620'],['tall','高图 820×760'],['custom','自定义']]),gNumber('width','画布宽度',500,1800,10),gNumber('height','画布高度',400,1200,10),gSelect('dpi','PNG 清晰度',[[96,'96 dpi'],[150,'150 dpi'],[300,'300 dpi（论文）'],[600,'600 dpi（高精度）']])]);
  if(id==='axis-x')return gallerySection('横坐标标题',[gText('xTitle','标题文字'),gNumber('xTitleX','水平位置',0,1800,1),gNumber('xTitleY','垂直位置',0,1200,1),gRange('xTitleSize','标题字号',9,30,1),gSelect('xTitleWeight','标题字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']]),gColor('xTitleColor','标题颜色')])+gallerySection('X 轴与刻度',[gRange('axisWidth','坐标轴粗细',.5,5,.1),gColor('axisColor','坐标轴颜色'),gRange('tickSize','刻度字号',8,24,1),gRange('tickLength','刻度线长度',0,18,1),gCheck('showXTicks','显示刻度线')])+galleryDragHint('横坐标标题');
  if(id==='axis-y')return gallerySection('纵坐标标题',[gText('yTitle','标题文字'),gNumber('yTitleX','水平位置',0,1800,1),gNumber('yTitleY','垂直位置',0,1200,1),gRange('yTitleSize','标题字号',9,30,1),gSelect('yTitleWeight','标题字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗'],[700,'粗体']]),gColor('yTitleColor','标题颜色')])+gallerySection('Y 轴与刻度',[gRange('axisWidth','坐标轴粗细',.5,5,.1),gColor('axisColor','坐标轴颜色'),gRange('tickSize','刻度字号',8,24,1),gRange('tickLength','刻度线长度',0,18,1),gCheck('showYTicks','显示刻度线')])+galleryDragHint('纵坐标标题');
  if(id==='frame')return gallerySection('图片边框',[gSelect('frameMode','边框形式',[['lb','仅左、下轴'],['lbr','左、下、右三边'],['box','完整四边框'],['none','不显示边框']]),gRange('frameWidth','边框粗细',.5,6,.1),gColor('frameColor','边框颜色')]);
  if(id==='legend')return gallerySection('图例内容',[gCheck('legend','显示图例'),gNumber('legendX','水平位置',0,1800,1),gNumber('legendY','垂直位置',0,1200,1),gRange('legendFontSize','字号',8,36,1),gSelect('legendWeight','字重',[[300,'细体'],[400,'常规'],[500,'中等'],[600,'半粗']]),gSelect('legendOrientation','排列方向',[['horizontal','横向'],['vertical','纵向']]),gRange('legendColumns','列数',1,6,1)])+galleryDragHint('图例内容');
  if(id==='legend-frame')return gallerySection('图例边框',[gSelect('legendFrameStyle','边框样式',[['none','无边框'],['solid','实线'],['dashed','虚线'],['dotted','点线'],['double','双线']]),gNumber('legendFrameX','水平位置',0,1800,1),gNumber('legendFrameY','垂直位置',0,1200,1),gCheck('legendFrameAutoSize','自动适应图例大小'),gNumber('legendFrameWidthBox','边框宽度',20,900,1),gNumber('legendFrameHeightBox','边框高度',20,600,1),gRange('legendFrameWidth','线条粗细',.5,5,.1),gColor('legendFrameColor','边框颜色'),gColor('legendFrameFill','底色'),gRange('legendFrameRadius','圆角',0,20,1)])+gallerySection('阴影',[gCheck('legendShadow','显示阴影'),gRange('legendShadowX','水平偏移',-10,14,1),gRange('legendShadowY','垂直偏移',-10,14,1),gRange('legendShadowBlur','模糊程度',0,12,.5),gRange('legendShadowOpacity','透明度',0,.7,.05)])+galleryDragHint('图例边框');
  if(id==='background')return gallerySection('背景',[gColor('background','背景颜色')]);
  return'';
}
function renderGalleryStudioProperties(){
  const id=state.gallery.selected,def=galleryDef();let name='',html='',scope='基础';
  const baseNames={title:'图题',subtitle:'副标题',typography:'中英文字体',canvas:'画布与清晰度','axis-x':'X 轴与横标题','axis-y':'Y 轴与纵标题',frame:'图片边框',legend:'图例内容','legend-frame':'图例边框',background:'背景'};
  if(baseNames[id]){name=baseNames[id];html=galleryBasePropertyHtml(id)}
  else if(id==='series'){const names=galleryStudioSeriesNames(),idx=clamp(state.gallery.selectedSeries,0,Math.max(0,names.length-1));name=`数据系列 · ${names[idx]||'Series'}`;html=gallerySeriesPropertyHtml(def.id,idx);scope='图形专属'}
  else{name=gallerySpecificLayerIds(def.id).find(x=>x[0]===id)?.[1]||'图形专属属性';html=gallerySpecificPropertyHtml(def.id,id);scope='图形专属'}
  $('#selectedObjectName').textContent=name||'未选择对象';$('#propertyEditor').innerHTML=html||'<div class="empty-state">在图中点击一个对象</div>';
  const badge=$('#propertyScopeBadge');if(badge){badge.textContent=scope;badge.classList.toggle('chart-specific',scope!=='基础')}
  bindGalleryStudioPropertyInputs();
}
function gallerySpecificPropertyHtml(type,id){
  if(id==='histogram')return gallerySection('直方图',[gRange('bins','分箱数量',4,40,1),gRange('opacity','柱透明度',.15,1,.05),gRange('lineWidth','柱边框粗细',0,4,.1)]);
  if(id==='density')return gallerySection('核密度曲线',[gNumber('bandwidth','带宽（0=自动）',0,100,.01),gRange('lineWidth','曲线粗细',.5,6,.1),gRange('opacity','填充透明度',0,1,.05)]);
  if(['box-elements','violin-elements'].includes(id))return gallerySection('分布元素',[gRange('boxWidth','箱体 / 小提琴宽度',.2,.9,.01),gCheck('showMean','显示均值'),gCheck('showMedian','显示中位数'),gCheck('showOutliers','显示异常点'),gCheck('showPoints','叠加原始散点'),gRange('pointSize','散点大小',1,10,.5),gRange('whiskerWidth','须线粗细',.5,4,.1),gRange('medianWidth','中位线粗细',.5,5,.1),gRange('opacity','填充透明度',.1,1,.05)]);
  if(id==='regression')return gallerySection('关系分析显示',[gCheck('showRegression','显示线性拟合'),gCheck('showCorrelation','显示相关系数'),gRange('lineWidth','拟合线粗细',.5,5,.1)]);
  if(id==='bubble-size')return gallerySection('气泡大小',[gRange('pointSize','基础点大小',1,12,.5),gRange('opacity','透明度',.1,1,.05)]);
  if(id==='stack-mode')return gallerySection('堆叠方式',[gCheck('normalize','百分比堆叠'),gSelect('orientation','方向',[['vertical','纵向'],['horizontal','横向']])]);
  if(id==='pie-label')return gallerySection('饼图标签',[gCheck('donut','圆环图'),gCheck('showCorrelation','显示百分比标签')]);
  if(id==='heatmap-scale')return gallerySection('热图色阶',[gSelect('colorScheme','配色',[['foodchem','Food Chemistry'],['meatsci','Meat Science'],['nature','Nature-style'],['mono','黑白打印']]),gCheck('heatmapShowValues','显示数值'),gRange('heatmapCellGap','格子间距',0,6,.5),gRange('tickSize','标签字号',8,22,1)]);
  if(id==='radar-grid')return gallerySection('雷达网格',[gCheck('normalize','按指标 0–1 归一化'),gRange('radarGridWidth','网格粗细',.4,4,.1),gRange('radarPointSize','节点大小',0,10,.5),gRange('opacity','填充透明度',0,1,.05)]);
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
  if(type==='heatmap')return ['相关矩阵'];return [];
}
function galleryPropGroup(items){return items.join('')}
function gColor(k,l){return gWrap(l,k,`<input data-gsetting="${k}" type="color" value="${state.gallery.settings[k]}">`)}
function bindGalleryStudioPropertyInputs(){
  $$('[data-gsetting]').forEach(el=>el.addEventListener('input',()=>{
    let v=el.type==='checkbox'?el.checked:el.value;if(['range','number'].includes(el.type))v=Number(v);
    state.gallery.settings[el.dataset.gsetting]=v;
    if(el.dataset.gsetting==='colorScheme'){state.gallery.palette=[...(templates[v]?.colors||templates.foodchem.colors)];state.gallery.seriesStyles={}}
    if(el.dataset.gsetting==='panelPreset')applyGalleryCanvasPreset(v);
    analyzeGalleryData();renderGalleryStudioCanvas();syncGalleryQuickControls();const out=$(`[data-gout="${el.dataset.gsetting}"]`);if(out)out.textContent=v;
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
  const [nw,nh]=map[value],rx=nw/s.width,ry=nh/s.height;s.titleX*=rx;s.titleY*=ry;s.subtitleX*=rx;s.subtitleY*=ry;s.xTitleX*=rx;s.xTitleY*=ry;s.yTitleX*=rx;s.yTitleY*=ry;s.legendX*=rx;s.legendY*=ry;s.legendFrameX*=rx;s.legendFrameY*=ry;s.width=nw;s.height=nh;
}

function syncQuickControls(){
  const s=state.chart.settings,ids={quickEnglishFont:s.fontEnglish,quickChineseFont:s.fontChinese,quickFontWeight:String(s.globalFontWeight),quickCanvasPreset:s.panelPreset,quickDpi:String(s.pngDpi),quickCanvasWidth:s.canvasWidth,quickCanvasHeight:s.canvasHeight};
  Object.entries(ids).forEach(([id,v])=>{const el=$('#'+id);if(el&&document.activeElement!==el)el.value=v});
  const badge=$('#canvasStatus');if(badge)badge.textContent=`${s.canvasWidth} × ${s.canvasHeight} px · ${s.pngDpi} dpi`;
}

function renderMappingSelect(){
  const select=$('#xFactorSelect'),d=state.design;
  select.innerHTML=`<option value="A">${esc(d.factorAName||'因素 A')}</option>`+(d.designType==='two'?`<option value="B">${esc(d.factorBName||'因素 B')}</option>`:'');
  if(d.designType==='one')state.chart.xFactor='A';select.value=state.chart.xFactor;
}

function chartGroups(){return [...new Set(state.chartData.map(d=>d.group))]}
function chartXs(){return [...new Set(state.chartData.map(d=>d.x))]}

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
function xTickLayout(text,i){
  const s=state.chart.settings;
  const rotate=Number(s.xTickRotation)||0;
  const autoStagger=s.xTickStagger || String(text).length>8 || chartXs().length>8;
  const dy=autoStagger && rotate===0 ? ((i%2)*14) : 0;
  const anchor=rotate<0?'end':rotate>0?'start':'middle';
  return {rotate,dy,anchor};
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
  if(state.chart.type!=='curve')layers.push(['error','误差棒','special'],['letters','显著性字母','special']);
  $('#layersList').innerHTML=layers.map(item=>{if(item[0]==='section')return`<div class="layer-section-label">${item[1]}</div>`;const[id,name,kind]=item;return`<button class="layer-item ${selectedMatches(id)?'active':''}" data-layer="${esc(id)}"><span class="layer-dot"></span>${esc(name)}<span class="layer-tag ${kind==='special'?'special':''}">${kind==='special'?'专属':'基础'}</span></button>`}).join('');
  $$('[data-layer]').forEach(b=>b.addEventListener('click',()=>selectObject(b.dataset.layer)));
}
function selectedMatches(id){return id.startsWith('series:')?state.chart.selected==='series'&&Number(id.split(':')[1])===state.chart.selectedSeries:state.chart.selected===id}
function selectObject(id,seriesIndex=null){
  if(id.startsWith('series:')){state.chart.selected='series';state.chart.selectedSeries=Number(id.split(':')[1])}
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
  const vals=(state.chart.type==='curve'?state.chartData.map(d=>d.mean):state.chartData.flatMap(d=>[d.mean-d.error,d.mean+d.error])).filter(Number.isFinite);let min=Math.min(...vals),max=Math.max(...vals);if(!Number.isFinite(min)){min=0;max=1}
  const pad=(max-min||1)*.12;return{min:state.chart.settings.yMin??(min-pad),max:state.chart.settings.yMax??(max+pad)};
}

function renderChart(){
  const {W,H}=chartDimensions(),M={l:106,r:80,t:82,b:105},plotW=W-M.l-M.r,plotH=H-M.t-M.b,s=state.chart.settings,colors=state.chart.palette;
  let svg=`<svg id="paperSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="FoodLab figure" style="font-family:${esc(fontStack())};font-weight:${s.globalFontWeight||400};background:${s.background}"><defs><filter id="legendShadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="${s.legendShadowX||0}" dy="${s.legendShadowY||0}" stdDeviation="${s.legendShadowBlur||0}" flood-color="#263238" flood-opacity="${s.legendShadowOpacity??.28}"/></filter></defs><rect data-object="background" class="chart-object" width="${W}" height="${H}" fill="${s.background}"/>`;
  svg+=`<text data-object="title" data-drag="title" class="chart-object draggable" x="${s.titleX}" y="${s.titleY}" text-anchor="middle" font-size="${s.titleSize}" font-weight="${s.titleWeight}" fill="${s.titleColor}">${esc(s.title)}</text>`;if(s.subtitleEnabled&&s.subtitle)svg+=`<text data-object="subtitle" data-drag="subtitle" class="chart-object draggable" x="${s.subtitleX}" y="${s.subtitleY}" text-anchor="middle" font-size="${s.subtitleSize}" font-weight="${s.subtitleWeight}" fill="${s.subtitleColor}">${esc(s.subtitle)}</text>`;
  if(!state.chartData.length){svg+=`<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#87939c">请先导入原始数据并完成统计分析</text></svg>`;$('#chartStage').innerHTML=svg;return}
  const xvals=chartXs(),gs=chartGroups();ensureSeriesStyles();
  svg+=state.chart.breakAxis?renderBrokenPlot(W,H,M,plotW,plotH,xvals,gs,colors):renderNormalPlot(W,H,M,plotW,plotH,xvals,gs,colors,chartBounds());
  svg+=renderLegendFrame(gs,colors);svg+=renderLegend(gs,colors);svg+='</svg>';$('#chartStage').innerHTML=svg;bindChartObjects();bindDraggables();
}

function isLineChart(){return state.chart.type==='line'}
function isCurveChart(){return state.chart.type==='curve'}
function isLineLike(){return isLineChart()||isCurveChart()}
function seriesPath(coords){
  return isCurveChart()||state.chart.settings.lineMode==='smooth'
    ? smoothPath(coords)
    : coords.map((p,i)=>(i?'L':'M')+p[0]+','+p[1]).join(' ');
}
function renderXAxisTopOverlay(M,plotW,axisY,xvals,xStep){
  const s=state.chart.settings;
  const under=Math.max(Number(s.axisWidth)+Math.max(1.5,Number(s.barBorderWidth)||0),Number(s.axisWidth)+1.2);
  let out=`<g data-object="axis-x" class="chart-object axis-top-overlay" fill="none" stroke-linecap="butt" pointer-events="all"><path d="M${M.l},${axisY} H${M.l+plotW}" stroke="${s.background}" stroke-width="${under}"/><path d="M${M.l},${axisY} H${M.l+plotW}" stroke="${s.axisColor}" stroke-width="${s.axisWidth}"/>`;
  if(s.showXTicks)xvals.forEach((x,i)=>{const xx=M.l+(i+.5)*xStep;out+=`<line x1="${xx}" x2="${xx}" y1="${axisY}" y2="${axisY+s.tickLength}" stroke="${s.axisColor}" stroke-width="${s.axisWidth}"/>`});
  return out+'</g>';
}

function renderNormalPlot(W,H,M,plotW,plotH,xvals,gs,colors,b){
  const s=state.chart.settings,y=v=>M.t+(b.max-v)/(b.max-b.min)*plotH,xStep=plotW/xvals.length,axisY=M.t+plotH;let out='';
  const yTicks=makeTicks(b.min,b.max,s.yTickStep,6),axes=renderNormalAxes(W,H,M,plotW,plotH,xvals,xStep,yTicks,y,axisY);
  if(isLineLike()){
    gs.forEach((g,gi)=>{const pts=xvals.map(x=>state.chartData.find(d=>d.x===x&&d.group===g)).filter(Boolean),c=colors[gi%colors.length],coords=pts.map(d=>[xBaseAt(xvals.indexOf(d.x),xStep,M),y(d.mean)]);
      if(coords.length>1)out+=`<path data-object="series" data-series="${gi}" class="chart-object" d="${seriesPath(coords)}" fill="none" stroke="${c}" stroke-width="${getSeriesStyle(gi).lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
      pts.forEach(d=>{const xx=xBaseAt(xvals.indexOf(d.x),xStep,M),yy=y(d.mean),e=Math.abs(y(d.mean+d.error)-yy);if(isLineChart())out+=errorSvg(xx,yy,e,c,gi);out+=markerSvg(xx,yy,c,gi);if(isLineChart()&&s.letters&&d.letter)out+=letterSvg(xx,yy-e-s.letterOffset,d.letter)});
    });
  }else{
    const groupW=xStep*s.categoryWidth,barW=groupW/gs.length;
    xvals.forEach((x,i)=>gs.forEach((g,gi)=>{const d=state.chartData.find(r=>r.x===x&&r.group===g);if(!d)return;const w=Math.max(1,barW-s.barGap),xx=M.l+(i+.5)*xStep-groupW/2+gi*barW+s.barGap/2,yy=y(d.mean),base=y(Math.max(b.min,0)),barBottom=base-Math.max(.5,s.axisWidth/2),h=Math.max(0,barBottom-yy),c=colors[gi%colors.length];
      out+=`<rect data-object="series" data-series="${gi}" class="chart-object" x="${xx}" y="${yy}" width="${w}" height="${h}" fill="${c}" fill-opacity="${s.barOpacity}" stroke="${darken(c,.25)}" stroke-width="${s.barBorderWidth}"/>`;
      const cx=xx+w/2,e=Math.abs(y(d.mean+d.error)-yy);out+=errorSvg(cx,yy,e,c,gi);if(s.letters&&d.letter)out+=letterSvg(cx,yy-e-s.letterOffset,d.letter);
    }));
  }
  out+=axes;
  out+=renderXAxisTopOverlay(M,plotW,axisY,xvals,xStep);
  return out;
}

function renderNormalAxes(W,H,M,plotW,plotH,xvals,xStep,yTicks,y,axisY){
  const s=state.chart.settings;let out='';
  out+=`<g data-object="axis-y" class="chart-object" stroke="${s.axisColor}" stroke-width="${s.axisWidth}" fill="none"><path d="M${M.l},${M.t} V${axisY}"/>`;
  if(s.showYTicks)yTicks.forEach(v=>{const yy=y(v);out+=`<line x1="${M.l-s.tickLength}" x2="${M.l}" y1="${yy}" y2="${yy}"/>`});out+='</g>';
  yTicks.forEach(v=>out+=`<text data-object="axis-y" class="chart-object" x="${M.l-s.tickLength-6}" y="${y(v)+4}" text-anchor="end" font-size="${s.tickSize}" font-weight="${s.tickWeight||s.globalFontWeight||400}">${formatTick(v)}</text>`);
  out+=`<g data-object="axis-x" class="chart-object" stroke="${s.axisColor}" stroke-width="${s.axisWidth}" fill="none"><path d="M${M.l},${axisY} H${M.l+plotW}"/>`;
  if(s.showXTicks)xvals.forEach((x,i)=>{const xx=M.l+(i+.5)*xStep;out+=`<line x1="${xx}" x2="${xx}" y1="${axisY}" y2="${axisY+s.tickLength}"/>`});out+='</g>';
  xvals.forEach((x,i)=>{const xx=M.l+(i+.5)*xStep,layout=xTickLayout(x,i),yy=axisY+s.tickLength+18+layout.dy;out+=`<text data-object="axis-x" class="chart-object" x="${xx}" y="${yy}" text-anchor="${layout.anchor}" font-size="${s.tickSize}" font-weight="${s.tickWeight||s.globalFontWeight||400}" transform="rotate(${layout.rotate} ${xx} ${yy})">${esc(x)}</text>`});
  out+=renderFrame(M,plotW,plotH,false);
  out+=axisTitles();return out;
}

function renderBrokenPlot(W,H,M,plotW,plotH,xvals,gs,colors){
  const s=state.chart.settings,gap=clamp(s.breakGap,8,28),usable=plotH-gap,lowerH=usable*clamp(s.lowerRatio,.12,.42),upperH=usable-lowerH,upperBottom=M.t+upperH,lowerTop=upperBottom+gap,axisY=M.t+plotH;
  const loMin=s.lowerMin,loMax=s.lowerMax,hiMin=s.upperMin,hiMax=s.upperMax;
  if(!(loMax>loMin&&hiMax>hiMin&&hiMin>loMax)){return `<text x="490" y="320" text-anchor="middle" fill="#b33b3b">断轴范围无效：应满足 下段最小值 &lt; 下段最大值 &lt; 上段最小值 &lt; 上段最大值</text>`}
  const yLower=v=>lowerTop+(loMax-v)/(loMax-loMin)*lowerH,yUpper=v=>M.t+(hiMax-v)/(hiMax-hiMin)*upperH,xStep=plotW/xvals.length;let out='';
  out+=`<defs><clipPath id="clipUpper"><rect x="${M.l}" y="${M.t}" width="${plotW}" height="${upperH}"/></clipPath><clipPath id="clipLower"><rect x="${M.l}" y="${lowerTop}" width="${plotW}" height="${lowerH}"/></clipPath></defs>`;
  const axes=renderBrokenAxes(W,H,M,plotW,plotH,xvals,xStep,yLower,yUpper,upperBottom,lowerTop,axisY);
  if(state.chart.type==='bar'){
    const groupW=xStep*s.categoryWidth,barW=groupW/gs.length;
    xvals.forEach((x,i)=>gs.forEach((g,gi)=>{const d=state.chartData.find(r=>r.x===x&&r.group===g);if(!d)return;const c=colors[gi%colors.length],w=Math.max(1,barW-s.barGap),xx=M.l+(i+.5)*xStep-groupW/2+gi*barW+s.barGap/2,cx=xx+w/2;
      if(d.mean>loMin){const topVal=Math.min(d.mean,loMax),ly=yLower(topVal),lh=Math.max(0,axisY-Math.max(.5,s.axisWidth/2)-ly);out+=`<rect data-object="series" data-series="${gi}" class="chart-object" x="${xx}" y="${ly}" width="${w}" height="${lh}" fill="${c}" fill-opacity="${s.barOpacity}" stroke="${darken(c,.25)}" stroke-width="${s.barBorderWidth}" clip-path="url(#clipLower)"/>`}
      if(d.mean>=hiMin){const uy=yUpper(d.mean),uh=upperBottom-uy;out+=`<rect data-object="series" data-series="${gi}" class="chart-object" x="${xx}" y="${uy}" width="${w}" height="${uh}" fill="${c}" fill-opacity="${s.barOpacity}" stroke="${darken(c,.25)}" stroke-width="${s.barBorderWidth}" clip-path="url(#clipUpper)"/>`;const e=Math.abs(yUpper(d.mean+d.error)-uy);out+=errorSvg(cx,uy,e,c,gi,'clipUpper');if(s.letters&&d.letter)out+=letterSvg(cx,uy-e-s.letterOffset,d.letter)}
    }));
  }else{
    gs.forEach((g,gi)=>{const c=colors[gi%colors.length],pts=xvals.map(x=>state.chartData.find(d=>d.x===x&&d.group===g)).filter(Boolean);
      ['upper','lower'].forEach(region=>{const mapped=pts.map(d=>({d,xx:xBaseAt(xvals.indexOf(d.x),xStep,M),region:d.mean>=hiMin?'upper':d.mean<=loMax?'lower':'gap'})).filter(p=>p.region===region);if(mapped.length>1){const yy=p=>region==='upper'?yUpper(p.d.mean):yLower(p.d.mean);const coords=mapped.map(p=>[p.xx,yy(p)]);out+=`<path data-object="series" data-series="${gi}" class="chart-object" d="${seriesPath(coords)}" fill="none" stroke="${c}" stroke-width="${getSeriesStyle(gi).lineWidth}" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#clip${region==='upper'?'Upper':'Lower'})"/>`}}
      );
      pts.forEach(d=>{const region=d.mean>=hiMin?'upper':d.mean<=loMax?'lower':null;if(!region)return;const xx=xBaseAt(xvals.indexOf(d.x),xStep,M),yy=region==='upper'?yUpper(d.mean):yLower(d.mean),map=region==='upper'?yUpper:yLower,e=Math.abs(map(d.mean+d.error)-yy);if(isLineChart())out+=errorSvg(xx,yy,e,c,gi,region==='upper'?'clipUpper':'clipLower');out+=markerSvg(xx,yy,c,gi);if(isLineChart()&&s.letters&&d.letter)out+=letterSvg(xx,yy-e-s.letterOffset,d.letter)});
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
  lowerTicks.forEach(v=>out+=`<text data-object="axis-y" class="chart-object" x="${M.l-s.tickLength-6}" y="${yLower(v)+4}" text-anchor="end" font-size="${s.tickSize}" font-weight="${s.tickWeight||s.globalFontWeight||400}">${formatTick(v)}</text>`);
  upperTicks.forEach(v=>out+=`<text data-object="axis-y" class="chart-object" x="${M.l-s.tickLength-6}" y="${yUpper(v)+4}" text-anchor="end" font-size="${s.tickSize}" font-weight="${s.tickWeight||s.globalFontWeight||400}">${formatTick(v)}</text>`);
  out+=`<g data-object="axis-x" class="chart-object" stroke="${s.axisColor}" stroke-width="${s.axisWidth}" fill="none"><path d="M${M.l},${axisY} H${M.l+plotW}"/>`;
  if(s.showXTicks)xvals.forEach((x,i)=>{const xx=M.l+(i+.5)*xStep;out+=`<line x1="${xx}" x2="${xx}" y1="${axisY}" y2="${axisY+s.tickLength}"/>`});out+='</g>';
  xvals.forEach((x,i)=>{const xx=M.l+(i+.5)*xStep,layout=xTickLayout(x,i),yy=axisY+s.tickLength+18+layout.dy;out+=`<text data-object="axis-x" class="chart-object" x="${xx}" y="${yy}" text-anchor="${layout.anchor}" font-size="${s.tickSize}" font-weight="${s.tickWeight||s.globalFontWeight||400}" transform="rotate(${layout.rotate} ${xx} ${yy})">${esc(x)}</text>`});
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
  const s=state.chart.settings;return `<text data-object="axis-x" data-drag="xTitle" class="chart-object draggable" x="${s.xTitleX}" y="${s.xTitleY}" text-anchor="middle" font-size="${s.xTitleSize}" font-weight="${s.axisTitleWeight||s.globalFontWeight||400}">${esc(s.xTitle)}</text><text data-object="axis-y" data-drag="yTitle" class="chart-object draggable" transform="translate(${s.yTitleX} ${s.yTitleY}) rotate(-90)" text-anchor="middle" font-size="${s.yTitleSize}" font-weight="${s.axisTitleWeight||s.globalFontWeight||400}">${esc(s.yTitle)}</text>`;
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
  const horizontal=s.legendOrientation==='horizontal';
  const requested=Math.max(1,Math.round(Number(s.legendColumns)||1));
  const cols=horizontal&&requested===1?gs.length:Math.min(gs.length,requested);
  const rows=Math.ceil(gs.length/cols);
  const labelWidths=gs.map(g=>Math.max(20,String(g).length*font*.62));
  const itemWidths=gs.map((g,i)=>symbolW+textGap+labelWidths[i]);
  const colWidths=Array(cols).fill(0);
  itemWidths.forEach((w,i)=>{colWidths[i%cols]=Math.max(colWidths[i%cols],w)});
  const colX=[];let cursor=0;for(let c=0;c<cols;c++){colX[c]=cursor;cursor+=colWidths[c]+(c<cols-1?colGap:0)}
  let content='';
  gs.forEach((g,i)=>{
    const col=i%cols,row=Math.floor(i/cols),ox=colX[col],oy=row*rowH+rowH*.52,c=colors[i%colors.length],st=getSeriesStyle(i);
    if(state.chart.type==='bar')content+=`<rect data-object="legend" x="${ox}" y="${oy-font*.42}" width="${symbolW}" height="${Math.max(12,font*.82)}" fill="${c}" stroke="${darken(c,.25)}" stroke-width="${s.barBorderWidth}"/><text data-object="legend" x="${ox+symbolW+textGap}" y="${oy+font*.18}" dominant-baseline="middle" font-size="${font}" font-weight="${s.legendWeight||s.globalFontWeight||400}">${esc(g)}</text>`;
    else content+=`<line data-object="legend" x1="${ox}" x2="${ox+symbolW}" y1="${oy}" y2="${oy}" stroke="${c}" stroke-width="${st.lineWidth}"/>${markerLegend(ox+symbolW/2,oy,c,i)}<text data-object="legend" x="${ox+symbolW+textGap}" y="${oy+font*.12}" dominant-baseline="middle" font-size="${font}" font-weight="${s.legendWeight||s.globalFontWeight||400}">${esc(g)}</text>`;
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
  $$('#chartStage .chart-object').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();selectObject(el.dataset.object,el.dataset.series)}));
}

function bindDraggables(){
  const svg=$('#paperSvg');if(!svg)return;
  $$('[data-drag]').forEach(el=>{
    el.addEventListener('pointerdown',e=>{
      e.preventDefault();e.stopPropagation();
      const key=el.dataset.drag,start=svgPoint(svg,e),snapshot=dragSnapshot(key);
      el.setPointerCapture(e.pointerId);el.classList.add('dragging');
      const target=key==='legend'?'legend':key==='legendFrame'?'legend-frame':key==='title'?'title':key==='subtitle'?'subtitle':key==='xTitle'?'axis-x':'axis-y';
      selectObject(target);
      const move=ev=>{const p=svgPoint(svg,ev),dx=p.x-start.x,dy=p.y-start.y;applyDrag(key,snapshot,dx,dy,el)};
      const up=()=>{el.classList.remove('dragging');el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);renderProperties()};
      el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);
    });
  });
}
function svgPoint(svg,e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())}
function dragSnapshot(key){
  const s=state.chart.settings;
  if(key==='legend')return{x:state.chart.legend.x,y:state.chart.legend.y};
  if(key==='legendFrame')return{x:state.chart.legendFrame.x,y:state.chart.legendFrame.y};
  if(key==='title')return{x:s.titleX,y:s.titleY};if(key==='subtitle')return{x:s.subtitleX,y:s.subtitleY};
  if(key==='xTitle')return{x:s.xTitleX,y:s.xTitleY};
  return{x:s.yTitleX,y:s.yTitleY};
}
function applyDrag(key,snap,dx,dy,el){
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
    textField('title','图题文字'),numberField('titleX','水平位置',0,1600,1),numberField('titleY','垂直位置',0,1000,1),rangeField('titleSize','字号',9,36,1),selectField('titleWeight','字重',[['300','细体'],['400','常规'],['500','中等'],['600','半粗'],['700','粗体']]),colorField('titleColor','颜色')
  ]);}
  else if(id==='subtitle'){name='副标题';html=fieldGroup([checkField('subtitleEnabled','显示副标题'),textField('subtitle','副标题文字'),numberField('subtitleX','水平位置',0,1600,1),numberField('subtitleY','垂直位置',0,1000,1),rangeField('subtitleSize','字号',8,28,1),selectField('subtitleWeight','字重',[['300','细体'],['400','常规'],['500','中等'],['600','半粗']]),colorField('subtitleColor','颜色')])+`<div class="hint">副标题可直接拖动；留空或关闭时不显示。</div>`;}
  else if(id==='typography'){name='中英文字体与字重';html=fieldGroup([
    selectField('fontEnglish','英文字体',[['Arial','Arial'],['Times New Roman','Times New Roman'],['Calibri','Calibri'],['Helvetica','Helvetica'],['Georgia','Georgia']]),
    selectField('fontChinese','中文字体',[['Microsoft YaHei','微软雅黑'],['SimSun','宋体'],['SimHei','黑体'],['KaiTi','楷体'],['FangSong','仿宋']]),
    selectField('globalFontWeight','全局文字粗细',[['300','细体'],['400','常规'],['500','中等'],['600','半粗'],['700','粗体']]),
    selectField('axisTitleWeight','坐标标题粗细',[['300','细体'],['400','常规'],['500','中等'],['600','半粗'],['700','粗体']]),
    selectField('tickWeight','刻度数字粗细',[['300','细体'],['400','常规'],['500','中等'],['600','半粗']]),
    selectField('legendWeight','图例文字粗细',[['300','细体'],['400','常规'],['500','中等'],['600','半粗']])
  ])+`<div class="hint">字体与字重已放到图表上方的快捷栏，同时也可以在这里精细设置。</div>`;}
  else if(id==='canvas'){name='画布与导出清晰度';html=fieldGroup([
    selectField('panelPreset','图幅比例',[['normal','常规 980×660'],['small','拼图小图 760×540'],['square','正方图 700×700'],['wide','宽图 1080×620'],['tall','高图 820×760'],['custom','自定义']]),
    numberField('canvasWidth','画布宽度',500,1800,10),numberField('canvasHeight','画布高度',400,1200,10),
    selectField('pngDpi','PNG 清晰度',[['96','96 dpi（屏幕）'],['150','150 dpi'],['300','300 dpi（论文）'],['600','600 dpi（高精度）']])
  ])+`<div class="hint">SVG 为矢量图，不受分辨率限制；PNG 会按画布尺寸与所选 dpi 输出。</div>`;}
  else if(id==='axis-x'){name='X 轴与横坐标标题';html=fieldGroup([
    textField('xTitle','横坐标标题'),numberField('xTitleX','标题水平位置',0,1600,1),numberField('xTitleY','标题垂直位置',0,1200,1),rangeField('xTitleSize','标题字号',9,30,1),
    rangeField('axisWidth','坐标轴粗细',.5,5,.1),colorField('axisColor','坐标轴颜色'),rangeField('tickSize','刻度字号',8,24,1),rangeField('tickLength','刻度线长度',0,18,1),rangeField('xTickRotation','刻度标签旋转',-90,90,5),checkField('xTickStagger','标签交错换行'),checkField('showXTicks','显示横坐标刻度线')
  ]);}
  else if(id==='axis-y'){name='Y 轴与纵坐标标题';html=fieldGroup([
    textField('yTitle','纵坐标标题'),numberField('yTitleX','标题水平位置',0,300,1),numberField('yTitleY','标题垂直位置',0,1200,1),rangeField('yTitleSize','标题字号',9,30,1),
    numberField('yMin','最小值',null,null,.01,true),numberField('yMax','最大值',null,null,.01,true),numberField('yTickStep','刻度间隔',null,null,.01,true),rangeField('axisWidth','坐标轴粗细',.5,5,.1),colorField('axisColor','坐标轴颜色'),rangeField('tickSize','刻度字号',8,24,1),rangeField('tickLength','刻度线长度',0,18,1),checkField('showYTicks','显示纵坐标刻度线')
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
  else if(id==='legend'){name='图例内容';html=fieldGroup([checkField('legendVisible','显示图例'),numberLegendField('x','水平位置'),numberLegendField('y','垂直位置'),rangeField('legendSize','字号',8,48,1),selectField('legendOrientation','排列方向',[['vertical','纵向'],['horizontal','横向']]),rangeField('legendColumns','图例列数',1,6,1)])+`<div class="hint">图例内容可以直接拖动。多系列时可以使用多列排版；图例边框在独立图层中单独移动。</div>`;}
  else if(id==='legend-frame'){name='图例边框';html=fieldGroup([
    selectField('legendFrameStyle','边框样式',[['none','无边框'],['solid','实线'],['dashed','虚线'],['dotted','点线'],['double','双线']]),
    numberLegendFrameField('x','水平位置'),numberLegendFrameField('y','垂直位置'),checkLegendFrameField('autoSize','自动适应图例大小'),numberLegendFrameField('width','边框宽度'),numberLegendFrameField('height','边框高度'),
    rangeField('legendFrameWidth','边框粗细',.5,5,.1),colorField('legendFrameColor','边框颜色'),colorField('legendFrameFill','边框底色'),rangeField('legendFrameRadius','圆角',0,18,1),
    checkField('legendShadow','显示阴影'),rangeField('legendShadowX','阴影水平偏移',-10,14,1),rangeField('legendShadowY','阴影垂直偏移',-10,14,1),rangeField('legendShadowBlur','阴影模糊',0,12,.5),rangeField('legendShadowOpacity','阴影透明度',0,.7,.05)
  ])+`<div class="hint">图例边框可独立拖动；阴影只作用于边框，不会锁住图例内容。</div>`;}
  else if(id==='letters'){name='显著性字母';html=fieldGroup([checkField('letters','显示显著性字母'),rangeField('letterSize','字母字号',8,22,1),selectField('letterWeight','字重',[['400','常规（与刻度接近）'],['500','中等'],['600','半粗']]),rangeField('letterOffset','与误差棒间距',3,28,1)])+`<div class="hint">默认字重已改为常规，不再显得比坐标数字更粗。</div>`;}
  else if(id==='background'){name='背景';html=fieldGroup([colorField('background','背景颜色')]);}
  $('#selectedObjectName').textContent=name||'未选择对象';$('#propertyEditor').innerHTML=html||'<div class="empty-state">在图中点击一个对象</div>';const badge=$('#propertyScopeBadge');if(badge){const special=['series','error','letters'].includes(id);badge.textContent=special?'图形专属':'基础';badge.classList.toggle('chart-specific',special)}bindPropertyInputs();
}

function markerShapeGrid(index){
  const shapes=[['circle','圆'],['square','方'],['triangle','上三角'],['triangleDown','下三角'],['diamond','菱形'],['star','五角星'],['pentagon','五边形'],['hexagon','六边形'],['plus','加号'],['cross','叉号']];
  const current=getSeriesSetting(index,'markerShape');
  return `<div class="field marker-field"><label><span>本系列标记形状</span><output>${shapes.find(x=>x[0]===current)?.[1]||current}</output></label><div class="marker-grid">${shapes.map(([v,l])=>`<button type="button" class="marker-choice ${current===v?'active':''}" data-marker-series="${index}" data-marker-shape="${v}" title="${l}"><span class="marker-icon marker-${v}"></span><small>${l}</small></button>`).join('')}</div></div>`;
}

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
function checkField(k,n){return`<label class="check-row"><input data-setting="${k}" type="checkbox" ${getSettingValue(k)?'checked':''}>${n}</label>`}
function numberLegendField(k,n){return fieldWrap(`图例${n}`,`legend:${k}`,`<input data-setting="legend:${k}" type="number" step="1" value="${state.chart.legend[k]}">`)}
function numberLegendFrameField(k,n){return fieldWrap(`边框${n}`,`legendFrame:${k}`,`<input data-setting="legendFrame:${k}" type="number" step="1" value="${state.chart.legendFrame[k]??''}">`)}
function checkLegendFrameField(k,n){return`<label class="check-row"><input data-setting="legendFrame:${k}" type="checkbox" ${state.chart.legendFrame[k]?'checked':''}>${n}</label>`}
function displaySetting(k){return getSettingValue(k)}
function breakPropertyBlock(){const s=state.chart.settings;return `<div class="subhead">真实断轴</div><label class="check-row"><input id="breakFromProp" type="checkbox" ${state.chart.breakAxis?'checked':''}>启用断轴</label><div class="two-col">${numberField('lowerMin','下段最小值',null,null,.01)}${numberField('lowerMax','下段最大值',null,null,.01)}${numberField('upperMin','上段最小值',null,null,.01)}${numberField('upperMax','上段最大值',null,null,.01)}</div>${rangeField('breakGap','两条断裂线间距',6,28,1)}${rangeField('lowerRatio','下段高度比例',.12,.42,.01)}<div class="hint">柱体空白断口与两条平行断裂线中心之间的距离完全一致；断裂线中心直接落在坐标轴端点上。</div>`}
function paletteBlock(){ensurePalette(chartGroups().length);const count=Math.max(6,chartGroups().length);return`<div class="subhead">全部系列配色</div><div class="palette-grid">${state.chart.palette.slice(0,count).map((c,i)=>`<input type="color" data-palette="${i}" value="${c}" title="系列 ${i+1}">`).join('')}</div>`}

function bindPropertyInputs(){
  $$('[data-setting]').forEach(el=>el.addEventListener('input',()=>{
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
    const o=$(`[data-out="${cssEscape(k)}"]`);if(o)o.textContent=value??'';renderChart();
  }));
  $$('[data-palette]').forEach(el=>el.addEventListener('input',()=>{state.chart.palette[Number(el.dataset.palette)]=el.value;renderChart()}));
  $$('[data-marker-shape]').forEach(btn=>btn.addEventListener('click',()=>{setSeriesSetting(Number(btn.dataset.markerSeries),'markerShape',btn.dataset.markerShape);renderChartStudio()}));
  const br=$('#breakFromProp');if(br)br.addEventListener('change',()=>{state.chart.breakAxis=br.checked;if(br.checked)autoBreakScale();renderChartStudio()});
}

function exportSvg(){const svg=$('#paperSvg');if(!svg)return;const copy=svg.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');const name=state.chart.mode==='gallery'?workflowChartLabel(state.workflow.chartType):state.design.metricName;download(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}),`${safeFile(state.design.experimentName)}_${safeFile(name)}.svg`)}
function exportPng(){
  const svg=$('#paperSvg');if(!svg)return;
  const galleryMode=state.chart.mode==='gallery',W=galleryMode?Number(state.gallery.settings.width):chartDimensions().W,H=galleryMode?Number(state.gallery.settings.height):chartDimensions().H,dpi=galleryMode?Number(state.gallery.settings.dpi||300):Number(state.chart.settings.pngDpi||300),scale=dpi/96;
  const copy=svg.cloneNode(true);copy.setAttribute('width',W);copy.setAttribute('height',H);
  const xml=new XMLSerializer().serializeToString(copy),blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();
  img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);const ctx=canvas.getContext('2d');ctx.fillStyle=galleryMode?state.gallery.settings.background:state.chart.settings.background;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const name=galleryMode?workflowChartLabel(state.workflow.chartType):state.design.metricName;canvas.toBlob(b=>download(b,`${safeFile(state.design.experimentName)}_${safeFile(name)}_${dpi}dpi.png`),'image/png');URL.revokeObjectURL(url)};img.src=url;
}

function saveProject(){
  const payload={version:'0.7.0',savedAt:new Date().toISOString(),workflow:state.workflow,design:state.design,rawData:state.rawData,gallery:state.gallery,chart:state.chart};
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

function makeTicks(min,max,step,count=6){
  if(!(max>min))return[min];let st=Number(step);if(!(st>0))st=niceStep((max-min)/(count-1));const start=Math.ceil((min-1e-10)/st)*st,end=Math.floor((max+1e-10)/st)*st,t=[];for(let v=start,n=0;v<=end+st*1e-8&&n<30;v+=st,n++)t.push(Number(v.toPrecision(12)));if(t.length<2)return[min,max];return t;
}
function niceStep(raw){const exp=Math.floor(Math.log10(Math.abs(raw)||1)),f=raw/10**exp,n=f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10;return n*10**exp}
function niceFloor(v){const st=niceStep(Math.abs(v||1)/5);return Math.floor(v/st)*st}function niceCeil(v){const st=niceStep(Math.abs(v||1)/5);return Math.ceil(v/st)*st}
function formatTick(v){const a=Math.abs(v);return a>=100?formatNumber(v,0):a>=10?formatNumber(v,1):a>=1?formatNumber(v,2):formatNumber(v,3)}
function formatNumber(v,d=3){if(!Number.isFinite(Number(v)))return'—';return Number(v).toFixed(d).replace(/\.?0+$/,'')}
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
  s.title=def.name;s.subtitle='';s.subtitleEnabled=false;s.xTitle=def.schema==='xy'?'X':def.schema==='composition'?'Category':'';s.yTitle=def.schema==='xy'?'Y':def.schema==='univariate'?'Value':def.id==='stacked'?'Value':'';
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
function quantile(values,p){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return NaN;const h=(a.length-1)*p,i=Math.floor(h),f=h-i;return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*f}
function median(values){return quantile(values,.5)}
function analyzeUnivariate(rows){
  const groups=groupValues(rows),table=[];groups.forEach((rs,g)=>{const v=rs.map(r=>r.Value),q1=quantile(v,.25),q3=quantile(v,.75),iqr=q3-q1,out=v.filter(x=>x<q1-1.5*iqr||x>q3+1.5*iqr).length;table.push({Group:g,n:v.length,Mean:mean(v),SD:sampleSd(v),Median:median(v),Q1:q1,Q3:q3,Min:Math.min(...v),Max:Math.max(...v),Outliers:out})});
  const all=rows.map(r=>r.Value),max=table.reduce((a,b)=>a.Mean>b.Mean?a:b),min=table.reduce((a,b)=>a.Mean<b.Mean?a:b);return {kind:'univariate',table,summary:[['有效观测',all.length],['组别数',table.length],['总体均值',formatNumber(mean(all),3)],['总体标准差',formatNumber(sampleSd(all),3)]],text:`共分析 ${all.length} 个原始观测，包含 ${table.length} 个组。${table.length>1?`${max.Group} 的均值最高，${min.Group} 的均值最低。`:''} 箱线图异常值采用 1.5×IQR 规则识别。`};
}
function pearson(x,y){const mx=mean(x),my=mean(y),num=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0),dx=Math.sqrt(x.reduce((s,v)=>s+(v-mx)**2,0)),dy=Math.sqrt(y.reduce((s,v)=>s+(v-my)**2,0));return dx&&dy?num/(dx*dy):NaN}
function regression(x,y){const mx=mean(x),my=mean(y),ssx=x.reduce((s,v)=>s+(v-mx)**2,0),sxy=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0),slope=ssx?sxy/ssx:0,intercept=my-slope*mx,r=pearson(x,y);return{slope,intercept,r,r2:r*r}}
function analyzeXY(rows){
  const table=[];groupValues(rows).forEach((rs,g)=>{const x=rs.map(r=>r.X),y=rs.map(r=>r.Y),m=regression(x,y);table.push({Group:g,n:rs.length,Pearson_r:m.r,Slope:m.slope,Intercept:m.intercept,R2:m.r2})});const x=rows.map(r=>r.X),y=rows.map(r=>r.Y),m=regression(x,y);return{kind:'xy',table,overall:m,summary:[['有效样本',rows.length],['组别数',table.length],['总体 Pearson r',formatNumber(m.r,3)],['总体 R²',formatNumber(m.r2,3)]],text:`总体 Pearson 相关系数为 ${formatNumber(m.r,3)}，线性模型 R² 为 ${formatNumber(m.r2,3)}。相关仅描述变量共同变化，不等同于因果关系。`}}
function analyzeComposition(rows){
  const cats=groupValues(rows,'Category'),table=[];cats.forEach((rs,c)=>{const total=rs.reduce((s,r)=>s+r.Value,0);rs.forEach(r=>table.push({Category:c,Component:r.Component,Value:r.Value,Percent:total?r.Value/total*100:0}));});return{kind:'composition',table,summary:[['类别数',cats.size],['组分数',new Set(rows.map(r=>r.Component)).size],['数据行',rows.length],['总量',formatNumber(rows.reduce((s,r)=>s+r.Value,0),3)]],text:'已按每个类别计算组分总量与百分比。百分比堆叠图和饼图会自动使用类别内部占比。'}}
function analyzeMatrix(rows){
  const vars=[...new Set(rows.flatMap(r=>Object.keys(r).filter(k=>!['SampleID','Group'].includes(k)&&Number.isFinite(r[k]))))],corr={};vars.forEach(a=>{corr[a]={};vars.forEach(b=>{const pairs=rows.filter(r=>Number.isFinite(r[a])&&Number.isFinite(r[b]));corr[a][b]=pairs.length>1?pearson(pairs.map(r=>r[a]),pairs.map(r=>r[b])):NaN})});return{kind:'matrix',vars,corr,summary:[['样本数',rows.length],['数值指标',vars.length],['组别数',new Set(rows.map(r=>r.Group)).size],['相关方法','Pearson']],text:`已对 ${vars.length} 个数值指标计算 Pearson 相关矩阵。强相关并不自动代表指标之间存在直接机制关系。`}}
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
  const shadow=`<filter id="galleryLegendShadow" x="-40%" y="-40%" width="190%" height="200%"><feDropShadow dx="${s.legendShadowX}" dy="${s.legendShadowY}" stdDeviation="${s.legendShadowBlur}" flood-color="#263238" flood-opacity="${s.legendShadowOpacity}"/></filter>`;
  const subtitle=s.subtitleEnabled&&s.subtitle?`<text data-gobject="subtitle" data-gdrag="subtitle" class="${cls} draggable" x="${subtitleX}" y="${subtitleY}" text-anchor="middle" font-size="${s.subtitleSize}" font-weight="${s.subtitleWeight}" fill="${s.subtitleColor}">${esc(s.subtitle)}</text>`:'';
  return `<svg id="${svgId}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="font-family:${escAttr(font)};background:${s.background}"><defs>${shadow}</defs><rect data-gobject="background" class="${cls}" width="${W}" height="${H}" fill="${s.background}"/><text data-gobject="title" data-gdrag="title" class="${cls} draggable" x="${titleX}" y="${titleY}" text-anchor="middle" font-size="${s.titleSize}" font-weight="${s.titleWeight}" fill="${s.titleColor}">${esc(s.title||def.name)}</text>${subtitle}${body}</svg>`;
}
function renderGalleryChart(){
  const stage=$('#galleryStage'),s=state.gallery.settings;if(!state.gallery.rows.length){stage.innerHTML='<div class="gallery-empty"><b>等待数据</b><span>下载匹配模板，填写并导入后即可绘图。</span></div>';$('#galleryChartMeta').textContent='';return}
  stage.innerHTML=gallerySvgMarkup('gallerySvg',false);$('#galleryChartMeta').textContent=`${s.width} × ${s.height} px · ${s.dpi} dpi`;
}
function galleryPlotBox(W,H){const top=state.gallery.settings.subtitleEnabled&&state.gallery.settings.subtitle?82:68;return{l:88,r:48,t:top,b:88,w:W-136,h:H-top-88}}
function scaleLinear(a,b,c,d){return v=>c+(v-a)/(b-a||1)*(d-c)}
function commonAxes(W,H,p,xTicks,yTicks,xMap,yMap){
  const s=state.gallery.settings,axis=s.axisColor||'#20262b',frame=s.frameColor||axis,sw=s.axisWidth||1.2,fw=s.frameWidth||sw;
  const xTitleX=s.xTitleX??(p.l+p.w/2),xTitleY=s.xTitleY??(H-24),yTitleX=s.yTitleX??28,yTitleY=s.yTitleY??(p.t+p.h/2),tick=s.tickSize||12;
  let out='';
  if(s.frameMode!=='none'){
    out+=`<g data-gobject="axis-y" class="chart-object" fill="none" stroke="${axis}" stroke-width="${sw}"><path d="M${p.l},${p.t} V${p.t+p.h}"/></g><g data-gobject="axis-x" class="chart-object" fill="none" stroke="${axis}" stroke-width="${sw}"><path d="M${p.l},${p.t+p.h} H${p.l+p.w}"/></g>`;
    if(s.frameMode==='lbr'||s.frameMode==='box')out+=`<g data-gobject="frame" class="chart-object" fill="none" stroke="${frame}" stroke-width="${fw}"><path d="M${p.l+p.w},${p.t} V${p.t+p.h}"/></g>`;
    if(s.frameMode==='box')out+=`<g data-gobject="frame" class="chart-object" fill="none" stroke="${frame}" stroke-width="${fw}"><path d="M${p.l},${p.t} H${p.l+p.w}"/></g>`;
  }
  yTicks.forEach(v=>{const y=yMap(v);out+=`<g data-gobject="axis-y" class="chart-object">${s.showYTicks?`<line x1="${p.l-s.tickLength}" x2="${p.l}" y1="${y}" y2="${y}" stroke="${axis}" stroke-width="${sw}"/>`:''}<text x="${p.l-s.tickLength-4}" y="${y+4}" text-anchor="end" font-size="${tick}" font-weight="${s.tickWeight}" fill="${axis}">${formatTick(v)}</text></g>`});
  xTicks.forEach((v,i)=>{const x=xMap(v,i);out+=`<g data-gobject="axis-x" class="chart-object">${s.showXTicks?`<line x1="${x}" x2="${x}" y1="${p.t+p.h}" y2="${p.t+p.h+s.tickLength}" stroke="${axis}" stroke-width="${sw}"/>`:''}<text x="${x}" y="${p.t+p.h+s.tickLength+16}" text-anchor="middle" font-size="${tick}" font-weight="${s.tickWeight}" fill="${axis}">${esc(v)}</text></g>`});
  out+=`<text data-gobject="axis-x" data-gdrag="xTitle" class="chart-object draggable" x="${xTitleX}" y="${xTitleY}" text-anchor="middle" font-size="${s.xTitleSize}" font-weight="${s.xTitleWeight}" fill="${s.xTitleColor}">${esc(s.xTitle)}</text><text data-gobject="axis-y" data-gdrag="yTitle" class="chart-object draggable" transform="translate(${yTitleX} ${yTitleY}) rotate(-90)" text-anchor="middle" font-size="${s.yTitleSize}" font-weight="${s.yTitleWeight}" fill="${s.yTitleColor}">${esc(s.yTitle)}</text>`;return out;
}
function galleryLegendLayout(groups){
  const s=state.gallery.settings,font=s.legendFontSize||12,orientation=s.legendOrientation||'horizontal',cols=Math.max(1,Number(s.legendColumns)||1),symbol=14,rowH=Math.max(22,font+10),pad=10;
  const items=groups.map((g,i)=>({name:String(g),color:getGallerySeriesStyle(i).color,w:30+String(g).length*font*.62}));let positions=[],width=0,height=0;
  if(orientation==='vertical'){const useCols=Math.min(cols,items.length),rows=Math.ceil(items.length/useCols),colWidths=Array(useCols).fill(0);items.forEach((it,i)=>{const c=Math.floor(i/rows);colWidths[c]=Math.max(colWidths[c],it.w)});const offsets=[];let acc=pad;colWidths.forEach(w=>{offsets.push(acc);acc+=w+12});items.forEach((it,i)=>{const c=Math.floor(i/rows),r=i%rows;positions.push({x:offsets[c],y:pad+r*rowH,item:it,index:i})});width=acc-12+pad;height=pad*2+rows*rowH}
  else{const useCols=Math.min(cols,items.length),rows=Math.ceil(items.length/useCols),colWidths=Array(useCols).fill(0);items.forEach((it,i)=>{const c=i%useCols;colWidths[c]=Math.max(colWidths[c],it.w)});const offsets=[];let acc=pad;colWidths.forEach(w=>{offsets.push(acc);acc+=w+12});items.forEach((it,i)=>{const c=i%useCols,r=Math.floor(i/useCols);positions.push({x:offsets[c],y:pad+r*rowH,item:it,index:i})});width=acc-12+pad;height=pad*2+rows*rowH}
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
function boxStats(v){const q1=quantile(v,.25),q2=median(v),q3=quantile(v,.75),iqr=q3-q1,low=Math.max(Math.min(...v),q1-1.5*iqr),high=Math.min(Math.max(...v),q3+1.5*iqr);return{q1,q2,q3,low,high,mean:mean(v),out:v.filter(x=>x<low||x>high)}}
function galleryBox(W,H,violin){
  const s=state.gallery.settings,p=galleryPlotBox(W,H),groups=[...new Set(state.gallery.rows.map(r=>r.Group))],all=state.gallery.rows.map(r=>r.Value),pad=(Math.max(...all)-Math.min(...all)||1)*.12,min=Math.min(...all)-pad,max=Math.max(...all)+pad,yMap=scaleLinear(min,max,p.t+p.h,p.t),xStep=p.w/groups.length;let out=commonAxes(W,H,p,groups,makeTicks(min,max,null,6),(v,i)=>p.l+(i+.5)*xStep,yMap)+galleryLegend(groups);
  groups.forEach((g,i)=>{const vals=state.gallery.rows.filter(r=>r.Group===g).map(r=>r.Value),stt=boxStats(vals),x=p.l+(i+.5)*xStep,st=getGallerySeriesStyle(i),bw=Math.min(84,xStep*(s.boxWidth||.48));let body='';
    if(violin){const curve=kdeFor(vals,min,max,80,s.bandwidth),mx=Math.max(...curve.map(q=>q[1]))||1,right=curve.map(q=>[x+(q[1]/mx)*bw/2,yMap(q[0])]),left=[...curve].reverse().map(q=>[x-(q[1]/mx)*bw/2,yMap(q[0])]);body+=`<path d="M${right[0][0]},${right[0][1]} ${right.slice(1).map(q=>'L'+q[0]+','+q[1]).join(' ')} ${left.map(q=>'L'+q[0]+','+q[1]).join(' ')} Z" fill="${st.color}" fill-opacity="${st.opacity}" stroke="${st.color}" stroke-width="${st.lineWidth}"/>`}
    else body+=`<rect x="${x-bw/2}" y="${yMap(stt.q3)}" width="${bw}" height="${yMap(stt.q1)-yMap(stt.q3)}" fill="${st.color}" fill-opacity="${st.opacity}" stroke="${st.color}" stroke-width="${st.lineWidth}"/>`;
    body+=`<line x1="${x}" x2="${x}" y1="${yMap(stt.low)}" y2="${yMap(stt.high)}" stroke="#222" stroke-width="${s.whiskerWidth}"/><line x1="${x-bw*.25}" x2="${x+bw*.25}" y1="${yMap(stt.low)}" y2="${yMap(stt.low)}" stroke="#222" stroke-width="${s.whiskerWidth}"/><line x1="${x-bw*.25}" x2="${x+bw*.25}" y1="${yMap(stt.high)}" y2="${yMap(stt.high)}" stroke="#222" stroke-width="${s.whiskerWidth}"/>`;
    if(s.showMedian)body+=`<line x1="${x-bw/2}" x2="${x+bw/2}" y1="${yMap(stt.q2)}" y2="${yMap(stt.q2)}" stroke="#111" stroke-width="${s.medianWidth}"/>`;
    if(s.showMean)body+=`<circle cx="${x}" cy="${yMap(stt.mean)}" r="3.5" fill="white" stroke="#111"/>`;
    if(s.showPoints)vals.forEach((v,j)=>{if(!s.showOutliers&&(v<stt.low||v>stt.high))return;const jitter=((j*37)%17-8)/8*bw*.36,attrs=`fill="${st.markerFill==='white'?'white':st.color}" stroke="${st.color}" stroke-width="1.2"`;body+=markerShapeSvg(st.markerShape,x+jitter,yMap(v),st.pointSize,attrs)});
    out+=`<g data-gobject="series" data-gseries="${i}" class="chart-object">${body}</g>`;
  });return out;
}
function galleryScatter(W,H,bubble){
  const s=state.gallery.settings,p=galleryPlotBox(W,H),rows=state.gallery.rows,groups=[...new Set(rows.map(r=>r.Group))],xs=rows.map(r=>r.X),ys=rows.map(r=>r.Y),xpad=(Math.max(...xs)-Math.min(...xs)||1)*.08,ypad=(Math.max(...ys)-Math.min(...ys)||1)*.1,xmin=Math.min(...xs)-xpad,xmax=Math.max(...xs)+xpad,ymin=Math.min(...ys)-ypad,ymax=Math.max(...ys)+ypad,xMap=scaleLinear(xmin,xmax,p.l,p.l+p.w),yMap=scaleLinear(ymin,ymax,p.t+p.h,p.t);let out=commonAxes(W,H,p,makeTicks(xmin,xmax,null,6),makeTicks(ymin,ymax,null,6),v=>xMap(v),yMap)+galleryLegend(groups);const sizes=rows.map(r=>r.Size).filter(Number.isFinite),smin=Math.min(...sizes),smax=Math.max(...sizes);
  groups.forEach((g,gi)=>{const st=getGallerySeriesStyle(gi),body=rows.filter(r=>r.Group===g).map(r=>{const radius=bubble&&Number.isFinite(r.Size)?st.pointSize+(r.Size-smin)/(smax-smin||1)*Math.max(5,st.pointSize*2):st.pointSize,attrs=`fill="${st.markerFill==='white'?'white':st.color}" fill-opacity="${st.opacity}" stroke="${st.color}" stroke-width="1.1"`;return markerShapeSvg(st.markerShape,xMap(r.X),yMap(r.Y),radius,attrs)}).join('');out+=`<g data-gobject="series" data-gseries="${gi}" class="chart-object">${body}</g>`});
  if(s.showRegression){const m=state.gallery.analysis.overall,y1=m.intercept+m.slope*xmin,y2=m.intercept+m.slope*xmax;out+=`<g data-gobject="regression" class="chart-object"><line x1="${xMap(xmin)}" y1="${yMap(y1)}" x2="${xMap(xmax)}" y2="${yMap(y2)}" stroke="#222" stroke-width="${s.lineWidth}" stroke-dasharray="6 4"/></g>`}if(s.showCorrelation){const m=state.gallery.analysis.overall;out+=`<text data-gobject="regression" class="chart-object" x="${p.l+p.w-8}" y="${p.t+20}" text-anchor="end" font-size="${s.tickSize}" font-style="italic">r = ${formatNumber(m.r,3)}, R² = ${formatNumber(m.r2,3)}</text>`}return out;
}
function galleryStacked(W,H){
  const s=state.gallery.settings,p=galleryPlotBox(W,H),cats=[...new Set(state.gallery.rows.map(r=>r.Category))],comps=[...new Set(state.gallery.rows.map(r=>r.Component))],totals=Object.fromEntries(cats.map(c=>[c,state.gallery.rows.filter(r=>r.Category===c).reduce((a,b)=>a+b.Value,0)])),max=s.normalize?100:Math.max(...Object.values(totals)),yMap=scaleLinear(0,max,p.t+p.h,p.t),xStep=p.w/cats.length;let out=commonAxes(W,H,p,cats,makeTicks(0,max,null,6),(v,i)=>p.l+(i+.5)*xStep,yMap)+galleryLegend(comps);
  comps.forEach((comp,j)=>{const st=getGallerySeriesStyle(j);let body='';cats.forEach((cat,i)=>{const previous=comps.slice(0,j).reduce((sum,c)=>{const r=state.gallery.rows.find(x=>x.Category===cat&&x.Component===c);const v=r?r.Value:0;return sum+(s.normalize?(totals[cat]?v/totals[cat]*100:0):v)},0),row=state.gallery.rows.find(r=>r.Category===cat&&r.Component===comp),value=row?row.Value:0,v=s.normalize?(totals[cat]?value/totals[cat]*100:0):value,y1=yMap(previous+v),y0=yMap(previous),w=Math.min(78,xStep*.68),x=p.l+(i+.5)*xStep-w/2;body+=`<rect x="${x}" y="${y1}" width="${w}" height="${y0-y1}" fill="${st.color}" fill-opacity="${st.opacity}" stroke="${st.color}" stroke-width="${st.lineWidth}"/>`});out+=`<g data-gobject="series" data-gseries="${j}" class="chart-object">${body}</g>`});return out;
}
function galleryPie(W,H){
  const s=state.gallery.settings,first=state.gallery.rows[0].Category,rows=state.gallery.rows.filter(r=>r.Category===first),total=rows.reduce((a,b)=>a+b.Value,0),cx=W*.42,cy=H*.54,R=Math.min(W,H)*.3,r0=s.donut?R*.52:0;let a=-Math.PI/2,out='';
  rows.forEach((r,i)=>{const st=getGallerySeriesStyle(i),da=total?r.Value/total*Math.PI*2:0,a2=a+da,p1=[cx+R*Math.cos(a),cy+R*Math.sin(a)],p2=[cx+R*Math.cos(a2),cy+R*Math.sin(a2)],q1=[cx+r0*Math.cos(a2),cy+r0*Math.sin(a2)],q2=[cx+r0*Math.cos(a),cy+r0*Math.sin(a)],large=da>Math.PI?1:0,d=r0?`M${p1} A${R},${R} 0 ${large} 1 ${p2} L${q1} A${r0},${r0} 0 ${large} 0 ${q2} Z`:`M${cx},${cy} L${p1} A${R},${R} 0 ${large} 1 ${p2} Z`;let body=`<path d="${d}" fill="${st.color}" fill-opacity="${st.opacity}" stroke="white" stroke-width="${Math.max(1,st.lineWidth)}"/>`;const mid=a+da/2,tx=cx+R*.72*Math.cos(mid),ty=cy+R*.72*Math.sin(mid);if(s.showCorrelation&&da>.12)body+=`<text x="${tx}" y="${ty}" text-anchor="middle" font-size="${s.tickSize}" fill="white" font-weight="600">${formatNumber(r.Value/total*100,1)}%</text>`;out+=`<g data-gobject="series" data-gseries="${i}" class="chart-object">${body}</g>`;a=a2});out+=galleryLegend(rows.map(r=>r.Component));return out;
}
function heatColor(v){const t=clamp((v+1)/2,0,1),r=Math.round(38+(210-38)*(1-t)),g=Math.round(99+(235-99)*(1-Math.abs(t-.5)*2)),b=Math.round(168+(75-168)*t);return`rgb(${r},${g},${b})`}
function galleryHeatmap(W,H){
  const s=state.gallery.settings,a=state.gallery.analysis,vars=a.vars,n=vars.length,pad=105,size=Math.min((W-pad-55)/n,(H-pad-60)/n),x0=pad,y0=72;let body='';vars.forEach((v,i)=>{body+=`<text x="${x0+(i+.5)*size}" y="${y0-10}" text-anchor="start" font-size="${Math.max(9,s.tickSize-1)}" font-weight="${s.tickWeight}" transform="rotate(-45 ${x0+(i+.5)*size} ${y0-10})">${esc(v)}</text><text x="${x0-10}" y="${y0+(i+.55)*size}" text-anchor="end" font-size="${Math.max(9,s.tickSize-1)}" font-weight="${s.tickWeight}">${esc(v)}</text>`;vars.forEach((w,j)=>{const r=a.corr[v][w],x=x0+j*size,y=y0+i*size,gap=s.heatmapCellGap||0;body+=`<rect x="${x+gap/2}" y="${y+gap/2}" width="${Math.max(0,size-gap)}" height="${Math.max(0,size-gap)}" fill="${heatColor(r)}"/>`;if(s.heatmapShowValues)body+=`<text x="${x+size/2}" y="${y+size/2+4}" text-anchor="middle" font-size="${Math.max(8,s.tickSize-2)}" fill="${Math.abs(r)>.55?'white':'#222'}">${formatNumber(r,2)}</text>`})});return `<g data-gobject="series" data-gseries="0" class="chart-object">${body}</g><text data-gobject="heatmap-scale" class="chart-object" x="${W/2}" y="${H-20}" text-anchor="middle" font-size="${s.tickSize}">Pearson correlation · −1 到 1</text>`;
}
function galleryRadar(W,H){
  const s=state.gallery.settings,rows=state.gallery.rows,groups=[...new Set(rows.map(r=>r.Group))],inds=[...new Set(rows.map(r=>r.Indicator))],cx=W*.45,cy=H*.54,R=Math.min(W,H)*.32,n=inds.length;const ranges=Object.fromEntries(inds.map(ind=>{const v=rows.filter(r=>r.Indicator===ind).map(r=>r.Value);return[ind,[Math.min(...v),Math.max(...v)]]}));let out='<g data-gobject="radar-grid" class="chart-object">';for(let k=1;k<=5;k++){const pts=inds.map((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;return`${cx+R*k/5*Math.cos(a)},${cy+R*k/5*Math.sin(a)}`}).join(' ');out+=`<polygon points="${pts}" fill="none" stroke="#ccd4d8" stroke-width="${s.radarGridWidth}"/>`}inds.forEach((ind,i)=>{const a=-Math.PI/2+i*2*Math.PI/n,x=cx+R*Math.cos(a),y=cy+R*Math.sin(a),lx=cx+(R+25)*Math.cos(a),ly=cy+(R+25)*Math.sin(a);out+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#d6dcdf" stroke-width="${s.radarGridWidth}"/><text x="${lx}" y="${ly+4}" text-anchor="middle" font-size="${s.tickSize}" font-weight="${s.tickWeight}">${esc(ind)}</text>`});out+='</g>';groups.forEach((g,gi)=>{const st=getGallerySeriesStyle(gi),pts=inds.map((ind,i)=>{const row=rows.find(r=>r.Group===g&&r.Indicator===ind),v=row?row.Value:0,[mn,mx]=ranges[ind],z=s.normalize?(v-mn)/(mx-mn||1):v/Math.max(...rows.filter(r=>r.Indicator===ind).map(r=>r.Value)),a=-Math.PI/2+i*2*Math.PI/n;return[cx+R*z*Math.cos(a),cy+R*z*Math.sin(a)]});let body=`<polygon points="${pts.map(q=>q.join(',')).join(' ')}" fill="${st.color}" fill-opacity="${st.opacity*.35}" stroke="${st.color}" stroke-width="${st.lineWidth}"/>`;pts.forEach(q=>body+=markerShapeSvg(st.markerShape,q[0],q[1],s.radarPointSize||st.pointSize,`fill="${st.markerFill==='white'?'white':st.color}" stroke="${st.color}" stroke-width="1.1"`));out+=`<g data-gobject="series" data-gseries="${gi}" class="chart-object">${body}</g>`});out+=galleryLegend(groups);return out;
}
function exportGallerySvg(){const svg=$('#gallerySvg');if(!svg){toast('请先生成图形');return}download(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}),`FoodLab_${safeFile(galleryDef().name)}.svg`)}
function exportGalleryPng(){const svg=$('#gallerySvg');if(!svg){toast('请先生成图形');return}const s=state.gallery.settings,scale=Math.max(1,Number(s.dpi||300)/96),xml=new XMLSerializer().serializeToString(svg),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'})),img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=Math.round(s.width*scale);c.height=Math.round(s.height*scale);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);c.toBlob(b=>download(b,`FoodLab_${safeFile(galleryDef().name)}_${s.dpi}dpi.png`),'image/png');URL.revokeObjectURL(url)};img.src=url}


init();
