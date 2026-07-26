'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const templates = {
  foodchem: {font:'Arial', axis:1.35, colors:['#2f6b2f','#d98222','#526d70','#4c78a8','#a65d4e','#7b6aa8']},
  meatsci:  {font:'Arial', axis:1.25, colors:['#9fcd84','#70b865','#3e8c54','#83b9db','#1986bd','#546e7a']},
  nature:   {font:'Arial', axis:1.25, colors:['#3C5488','#E64B35','#00A087','#4DBBD5','#F39B7F','#8491B4']},
  mono:     {font:'Arial', axis:1.40, colors:['#111111','#4b4b4b','#777777','#a0a0a0','#303030','#c0c0c0']}
};

const defaultDesign = {
  experimentName:'肉品储藏品质研究', metricName:'Moisture content', metricUnit:'%', designType:'two',
  factorAName:'Storage time (d)', factorALevels:['0','2','4','6','8','10'],
  factorBName:'Temperature', factorBLevels:['4 °C','-1 °C','-18 °C'],
  parallelSamples:3, technicalRepeats:3, errorType:'sd'
};

const defaultChartSettings = {
  title:'Moisture content', titleX:490, titleY:39, titleSize:17, titleWeight:600,
  xTitle:'Storage time (d)', xTitleX:490, xTitleY:626, xTitleSize:15,
  yTitle:'Moisture content (%)', yTitleX:31, yTitleY:332, yTitleSize:15,
  axisColor:'#20262b', axisWidth:1.35, frameMode:'box', frameWidth:1.15, frameColor:'#20262b',
  tickSize:12, tickLength:6, xTickRotation:0, showXTicks:true, showYTicks:true,
  lineWidth:2.1, markerSize:4.7, markerShape:'circle', markerFill:'white',
  barGap:3, categoryWidth:.72, barOpacity:.96, barBorderWidth:.55,
  errorWidth:1.15, errorCap:10, errorColorMode:'series',
  legendSize:12, legendVisible:true, legendOrientation:'vertical', legendFrame:false,
  legendFrameStyle:'none', legendFrameWidth:1, legendFrameColor:'#7d898f', legendFrameRadius:2,
  letters:true, letterSize:11, letterOffset:10,
  yMin:null, yMax:null, yTickStep:null,
  lowerMin:0, lowerMax:20, upperMin:70, upperMax:82, breakGap:12, lowerRatio:.23,
  background:'#ffffff'
};

const state = {
  view:'home',
  design:structuredClone(defaultDesign),
  rawData:[],
  analysisRows:[],
  descriptive:[],
  analysis:null,
  chartData:[],
  chart:{
    type:'line', breakAxis:false, selected:'axis-y', selectedSeries:0, xFactor:'A',
    settings:structuredClone(defaultChartSettings), palette:[...templates.foodchem.colors], legend:{x:805,y:74}, seriesStyles:{}
  }
};

function init(){
  bindNavigation();
  bindDesign();
  bindData();
  bindStatistics();
  bindChartUi();
  fillDesignForm();
  renderDesignPreview();
  renderDataPreview();
  showView('home');
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
}

function bindNavigation(){
  $$('#mainNav .nav-item').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
  $$('[data-open]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.open)));
  $('#nextStepBtn').addEventListener('click',()=>showView(nextViewFor(state.view)));
  $('#saveProjectBtn').addEventListener('click',saveProject);
}

function nextViewFor(view){
  return ({home:'design',design:'data',data:'statistics',statistics:'chart',chart:'chart'})[view] || 'design';
}

function showView(view){
  state.view=view;
  $$('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));
  $$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
  const map={
    home:['分析总览','先设计实验，再按统一模板导入、统计和绘图。','开始研究设计'],
    design:['研究设计','定义实验名称、指标、因素水平与重复数。','前往数据导入'],
    data:['数据导入','使用统一 Excel 模板导入原始测定值。','前往统计分析'],
    statistics:['统计分析','描述统计、ANOVA、显著性字母和辅助解读。','前往论文绘图'],
    chart:['论文图工作台','点击图中对象即可修改，位置可直接拖动。','留在图表工作台'],
    multivar:['PCA / PLS-DA','多变量降维与监督分类模块。','返回研究设计'],
    cluster:['HCA / 热图','层次聚类、树状图和热图模块。','返回研究设计'],
    correlation:['相关性分析','Pearson、Spearman 和相关矩阵。','返回研究设计'],
    regression:['回归分析','回归建模与模型诊断。','返回研究设计'],
    export:['论文输出','统一导出 Figure、Table 和图注。','返回论文绘图']
  };
  const m=map[view]||map.home;
  $('#pageTitle').textContent=m[0]; $('#pageSubtitle').textContent=m[1]; $('#nextStepBtn').textContent=m[2];
  if(view==='statistics') renderStatistics();
  if(view==='chart') { prepareChartData(); renderChartStudio(); }
}

function bindDesign(){
  ['experimentName','metricName','metricUnit','factorAName','factorALevels','factorBName','factorBLevels','parallelSamples','technicalRepeats','errorType','designType'].forEach(id=>{
    $('#'+id).addEventListener('input',()=>{ readDesignForm(false); renderDesignPreview(); });
  });
  $('#designType').addEventListener('change',toggleFactorB);
  $('#applyDesign').addEventListener('click',()=>{ if(readDesignForm(true)){renderDesignPreview();toast('研究设计已应用')} });
  $('#downloadXlsx').addEventListener('click',downloadTemplateXlsx);
  $('#downloadCsv').addEventListener('click',downloadTemplateCsv);
  $('#loadDesignDemo').addEventListener('click',()=>{state.design=structuredClone(defaultDesign);fillDesignForm();renderDesignPreview();toast('已载入双因素演示设计')});
}

function fillDesignForm(){
  const d=state.design;
  $('#experimentName').value=d.experimentName; $('#metricName').value=d.metricName; $('#metricUnit').value=d.metricUnit;
  $('#designType').value=d.designType; $('#factorAName').value=d.factorAName; $('#factorALevels').value=d.factorALevels.join(', ');
  $('#factorBName').value=d.factorBName; $('#factorBLevels').value=d.factorBLevels.join(', '); $('#parallelSamples').value=d.parallelSamples; $('#technicalRepeats').value=d.technicalRepeats; $('#errorType').value=d.errorType;
  toggleFactorB();
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
  if(!d.factorAName)errors.push('请填写因素 A 名称'); if(d.factorALevels.length<2)errors.push('因素 A 至少需要 2 个水平');
  if(d.designType==='two'&&!d.factorBName)errors.push('请填写因素 B 名称'); if(d.designType==='two'&&d.factorBLevels.length<2)errors.push('因素 B 至少需要 2 个水平');
  if(!Number.isInteger(d.parallelSamples)||d.parallelSamples<2)errors.push('每个组合至少需要 2 个独立平行样本');
  if(!Number.isInteger(d.technicalRepeats)||d.technicalRepeats<1)errors.push('每个平行样本至少需要 1 次测定');
  if(errors.length){ if(showErrors)toast(errors[0]); return false; }
  if(d.designType==='one'){d.factorBName='';d.factorBLevels=[''];}
  state.design=d; return true;
}

function toggleFactorB(){ const on=$('#designType').value==='two'; $$('.factor-b').forEach(el=>el.classList.toggle('hidden',!on)); }

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
  const d=state.design, rows=templateRows();
  const groupCount=d.factorALevels.length*(d.designType==='two'?d.factorBLevels.length:1);
  const independentCount=groupCount*d.parallelSamples;
  $('#designSummaryText').textContent=`${d.designType==='two'?'双因素':'单因素'} · ${d.factorAName}${d.designType==='two'?` × ${d.factorBName}`:''} · 每组 ${d.parallelSamples} 平行 × 每平行 ${d.technicalRepeats} 次测定`;
  $('#templateRowCount').textContent=`${rows.length} 个原始值 · ${independentCount} 个独立样品`;
  const preview=rows.slice(0,12), headers=['样品编号',d.factorAName,d.designType==='two'?d.factorBName:null,'平行样本','测定重复',`${d.metricName}${d.metricUnit?` (${d.metricUnit})`:''}`].filter(Boolean);
  let html=`<thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>`;
  preview.forEach(r=>{html+='<tr><td>'+esc(r['样品编号'])+'</td><td>'+esc(r['因素A水平'])+'</td>'+(d.designType==='two'?`<td>${esc(r['因素B水平'])}</td>`:'')+`<td>${r['平行样本编号']}</td><td>${r['测定重复编号']}</td><td class="muted-cell">待填写</td></tr>`});
  if(rows.length>preview.length)html+=`<tr><td colspan="${headers.length}" class="empty-row">……其余 ${rows.length-preview.length} 行将在模板中完整生成</td></tr>`;
  $('#designPreviewTable').innerHTML=html+'</tbody>';
}

function designConfigRows(){
  const d=state.design; return [
    ['配置项','值'],['FoodLab模板版本','0.4.2'],['实验名称',d.experimentName],['测定指标',d.metricName],['单位',d.metricUnit],
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
  $('#fileInput').addEventListener('change',e=>{if(e.target.files[0])handleFile(e.target.files[0])});
  const dz=$('#dropZone');
  ['dragenter','dragover'].forEach(name=>dz.addEventListener(name,e=>{e.preventDefault();dz.classList.add('dragover')}));
  ['dragleave','drop'].forEach(name=>dz.addEventListener(name,e=>{e.preventDefault();dz.classList.remove('dragover')}));
  dz.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)handleFile(f)});
  $('#loadRawDemo').addEventListener('click',loadRawDemo);
  $('#pasteToggle').addEventListener('click',()=>$('#pasteBox').classList.toggle('hidden'));
  $('#parsePasted').addEventListener('click',()=>processImported(parseDelimited($('#dataText').value),'粘贴数据'));
  $('#clearData').addEventListener('click',()=>{state.rawData=[];state.analysisRows=[];state.descriptive=[];state.analysis=null;renderDataPreview();showValidation('neutral','数据已清空','请导入新的原始数据。')});
  $('#goStatistics').addEventListener('click',()=>{analyzeData();showView('statistics')});
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
  $('#runAnalysis').addEventListener('click',()=>{analyzeData();renderStatistics();toast('统计结果已更新')});
  $('#goChart').addEventListener('click',()=>showView('chart'));
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
  const d=state.design,a=state.analysis,desc=state.descriptive;
  $('#statsDesignLine').textContent=`${d.experimentName} · ${d.metricName}${d.metricUnit?` (${d.metricUnit})`:''} · ${d.designType==='two'?`${d.factorAName} × ${d.factorBName}`:d.factorAName} · ${d.parallelSamples} 平行 × ${d.technicalRepeats} 测定重复`;
  $('#summaryCards').innerHTML=[
    ['原始测定值',state.rawData.length||'—'],['独立平行样本',state.analysisRows.length||'—'],['实验组合',desc.length||'—'],['分析模型',!a?'—':a.kind==='two'?'双因素 ANOVA':'单因素 ANOVA']
  ].map(([n,v])=>`<div class="summary-card"><span>${n}</span><b>${v}</b></div>`).join('');
  renderDescriptiveTable();renderAnovaTable();renderInterpretation();
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
  $$('[data-chart-type]').forEach(btn=>btn.addEventListener('click',()=>{state.chart.type=btn.dataset.chartType;autoScaleChart();renderChartStudio()}));
  $('#toggleBreak').addEventListener('click',()=>{state.chart.breakAxis=!state.chart.breakAxis;if(state.chart.breakAxis)autoBreakScale();renderChartStudio()});
  $('#autoScale').addEventListener('click',()=>{autoScaleChart();if(state.chart.breakAxis)autoBreakScale();renderChartStudio();toast('坐标范围已自动优化')});
  $('#journalTemplate').addEventListener('change',e=>{applyTemplate(e.target.value);renderChartStudio()});
  $('#xFactorSelect').addEventListener('change',e=>{state.chart.xFactor=e.target.value;prepareChartData();autoScaleChart();renderChartStudio()});
  $('#refreshChart').addEventListener('click',()=>{analyzeData();prepareChartData();autoScaleChart();renderChartStudio();toast('图表已按当前统计结果更新')});
  $('#exportSvg').addEventListener('click',exportSvg);$('#exportPng').addEventListener('click',exportPng);
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
  const s=state.chart.settings,vals=state.chartData.flatMap(d=>[d.mean-d.error,d.mean+d.error]).filter(Number.isFinite);if(!vals.length)return;
  const min=Math.min(...vals),max=Math.max(...vals),range=max-min||Math.abs(max)||1,pad=range*.13;
  if(state.chart.type==='bar'&&!state.chart.breakAxis&&min>=0){s.yMin=0;s.yMax=niceCeil(max+pad)}else{s.yMin=niceFloor(min-pad);s.yMax=niceCeil(max+pad)}
  s.yTickStep=null;
}

function autoBreakScale(){
  const s=state.chart.settings,vals=state.chartData.flatMap(d=>[d.mean-d.error,d.mean+d.error]).filter(Number.isFinite);if(!vals.length)return;
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

function applyTemplate(name){const t=templates[name];state.chart.settings.font=t.font;state.chart.settings.axisWidth=t.axis;state.chart.settings.frameWidth=Math.max(1,t.axis-.1);state.chart.palette=[...t.colors]}

function renderChartStudio(){
  $('#toggleBreak').textContent=`断轴：${state.chart.breakAxis?'开':'关'}`;
  $$('[data-chart-type]').forEach(b=>b.classList.toggle('active',b.dataset.chartType===state.chart.type));
  renderMappingSelect();renderLayers();renderChart();renderProperties();
}

function renderMappingSelect(){
  const select=$('#xFactorSelect'),d=state.design;
  select.innerHTML=`<option value="A">${esc(d.factorAName||'因素 A')}</option>`+(d.designType==='two'?`<option value="B">${esc(d.factorBName||'因素 B')}</option>`:'');
  if(d.designType==='one')state.chart.xFactor='A';select.value=state.chart.xFactor;
}

function chartGroups(){return [...new Set(state.chartData.map(d=>d.group))]}
function chartXs(){return [...new Set(state.chartData.map(d=>d.x))]}

function renderLayers(){
  const gs=chartGroups();const layers=[['title','图题'],['legend','图例'],['axis-y','Y 轴与纵标题'],['axis-x','X 轴与横标题'],['frame','边框']];
  gs.forEach((g,i)=>layers.push([`series:${i}`,`数据系列 · ${g}`]));layers.push(['error','误差棒'],['letters','显著性字母'],['background','背景']);
  $('#layersList').innerHTML=layers.map(([id,name])=>`<button class="layer-item ${selectedMatches(id)?'active':''}" data-layer="${esc(id)}"><span class="layer-dot"></span>${esc(name)}</button>`).join('');
  $$('[data-layer]').forEach(b=>b.addEventListener('click',()=>selectObject(b.dataset.layer)));
}
function selectedMatches(id){return id.startsWith('series:')?state.chart.selected==='series'&&Number(id.split(':')[1])===state.chart.selectedSeries:state.chart.selected===id}
function selectObject(id,seriesIndex=null){
  if(id.startsWith('series:')){state.chart.selected='series';state.chart.selectedSeries=Number(id.split(':')[1])}
  else{state.chart.selected=id;if(seriesIndex!=null)state.chart.selectedSeries=Number(seriesIndex)}
  renderLayers();renderProperties();
  $$('#chartStage .chart-object').forEach(el=>el.classList.toggle('object-selected',el.dataset.object===state.chart.selected&&(state.chart.selected!=='series'||Number(el.dataset.series)===state.chart.selectedSeries)));
}

const SERIES_MARKERS=['circle','square','triangle','diamond'];
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
function ensureSeriesStyles(){chartGroups().forEach((_,i)=>getSeriesStyle(i))}

function chartBounds(){
  const vals=state.chartData.flatMap(d=>[d.mean-d.error,d.mean+d.error]).filter(Number.isFinite);let min=Math.min(...vals),max=Math.max(...vals);if(!Number.isFinite(min)){min=0;max=1}
  const pad=(max-min||1)*.12;return{min:state.chart.settings.yMin??(min-pad),max:state.chart.settings.yMax??(max+pad)};
}

function renderChart(){
  const W=980,H=660,M={l:106,r:80,t:82,b:105},plotW=W-M.l-M.r,plotH=H-M.t-M.b,s=state.chart.settings,colors=state.chart.palette;
  let svg=`<svg id="paperSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="FoodLab figure" style="font-family:${esc(s.font||'Arial')};background:${s.background}"><rect data-object="background" class="chart-object" width="${W}" height="${H}" fill="${s.background}"/>`;
  svg+=`<text data-object="title" data-drag="title" class="chart-object draggable" x="${s.titleX}" y="${s.titleY}" text-anchor="middle" font-size="${s.titleSize}" font-weight="${s.titleWeight}">${esc(s.title)}</text>`;
  if(!state.chartData.length){svg+=`<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#87939c">请先导入原始数据并完成统计分析</text></svg>`;$('#chartStage').innerHTML=svg;return}
  const xvals=chartXs(),gs=chartGroups();ensureSeriesStyles();
  svg+=state.chart.breakAxis?renderBrokenPlot(W,H,M,plotW,plotH,xvals,gs,colors):renderNormalPlot(W,H,M,plotW,plotH,xvals,gs,colors,chartBounds());
  svg+=renderLegend(gs,colors);svg+='</svg>';$('#chartStage').innerHTML=svg;bindChartObjects();bindDraggables();
}

function renderNormalPlot(W,H,M,plotW,plotH,xvals,gs,colors,b){
  const s=state.chart.settings,y=v=>M.t+(b.max-v)/(b.max-b.min)*plotH,xStep=plotW/xvals.length,axisY=M.t+plotH;let out='';
  const yTicks=makeTicks(b.min,b.max,s.yTickStep,6);
  out+=renderNormalAxes(W,H,M,plotW,plotH,xvals,xStep,yTicks,y,axisY);
  if(state.chart.type==='line'){
    gs.forEach((g,gi)=>{const pts=xvals.map(x=>state.chartData.find(d=>d.x===x&&d.group===g)).filter(Boolean),c=colors[gi%colors.length],coords=pts.map(d=>[M.l+(xvals.indexOf(d.x)+.5)*xStep,y(d.mean)]);
      if(coords.length>1)out+=`<path data-object="series" data-series="${gi}" class="chart-object" d="${coords.map((p,i)=>(i?'L':'M')+p[0]+','+p[1]).join(' ')}" fill="none" stroke="${c}" stroke-width="${getSeriesStyle(gi).lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
      pts.forEach(d=>{const xx=M.l+(xvals.indexOf(d.x)+.5)*xStep,yy=y(d.mean),e=Math.abs(y(d.mean+d.error)-yy);out+=errorSvg(xx,yy,e,c,gi);out+=markerSvg(xx,yy,c,gi);if(s.letters&&d.letter)out+=letterSvg(xx,yy-e-s.letterOffset,d.letter)});
    });
  }else{
    const groupW=xStep*s.categoryWidth,barW=groupW/gs.length;
    xvals.forEach((x,i)=>gs.forEach((g,gi)=>{const d=state.chartData.find(r=>r.x===x&&r.group===g);if(!d)return;const w=Math.max(1,barW-s.barGap),xx=M.l+(i+.5)*xStep-groupW/2+gi*barW+s.barGap/2,yy=y(d.mean),base=y(Math.max(b.min,0)),h=Math.max(0,base-yy),c=colors[gi%colors.length];
      out+=`<rect data-object="series" data-series="${gi}" class="chart-object" x="${xx}" y="${yy}" width="${w}" height="${h}" fill="${c}" fill-opacity="${s.barOpacity}" stroke="${darken(c,.25)}" stroke-width="${s.barBorderWidth}"/>`;
      const cx=xx+w/2,e=Math.abs(y(d.mean+d.error)-yy);out+=errorSvg(cx,yy,e,c,gi);if(s.letters&&d.letter)out+=letterSvg(cx,yy-e-s.letterOffset,d.letter);
    }));
  }
  return out;
}

function renderNormalAxes(W,H,M,plotW,plotH,xvals,xStep,yTicks,y,axisY){
  const s=state.chart.settings;let out='';
  out+=`<g data-object="axis-y" class="chart-object" stroke="${s.axisColor}" stroke-width="${s.axisWidth}" fill="none"><path d="M${M.l},${M.t} V${axisY}"/>`;
  if(s.showYTicks)yTicks.forEach(v=>{const yy=y(v);out+=`<line x1="${M.l-s.tickLength}" x2="${M.l}" y1="${yy}" y2="${yy}"/>`});out+='</g>';
  yTicks.forEach(v=>out+=`<text data-object="axis-y" class="chart-object" x="${M.l-s.tickLength-6}" y="${y(v)+4}" text-anchor="end" font-size="${s.tickSize}">${formatTick(v)}</text>`);
  out+=`<g data-object="axis-x" class="chart-object" stroke="${s.axisColor}" stroke-width="${s.axisWidth}" fill="none"><path d="M${M.l},${axisY} H${M.l+plotW}"/>`;
  if(s.showXTicks)xvals.forEach((x,i)=>{const xx=M.l+(i+.5)*xStep;out+=`<line x1="${xx}" x2="${xx}" y1="${axisY}" y2="${axisY+s.tickLength}"/>`});out+='</g>';
  xvals.forEach((x,i)=>{const xx=M.l+(i+.5)*xStep,yy=axisY+s.tickLength+18;out+=`<text data-object="axis-x" class="chart-object" x="${xx}" y="${yy}" text-anchor="middle" font-size="${s.tickSize}" transform="rotate(${s.xTickRotation} ${xx} ${yy})">${esc(x)}</text>`});
  out+=renderFrame(M,plotW,plotH,false);
  out+=axisTitles();return out;
}

function renderBrokenPlot(W,H,M,plotW,plotH,xvals,gs,colors){
  const s=state.chart.settings,gap=clamp(s.breakGap,8,28),usable=plotH-gap,lowerH=usable*clamp(s.lowerRatio,.12,.42),upperH=usable-lowerH,upperBottom=M.t+upperH,lowerTop=upperBottom+gap,axisY=M.t+plotH;
  const loMin=s.lowerMin,loMax=s.lowerMax,hiMin=s.upperMin,hiMax=s.upperMax;
  if(!(loMax>loMin&&hiMax>hiMin&&hiMin>loMax)){return `<text x="490" y="320" text-anchor="middle" fill="#b33b3b">断轴范围无效：应满足 下段最小值 &lt; 下段最大值 &lt; 上段最小值 &lt; 上段最大值</text>`}
  const yLower=v=>lowerTop+(loMax-v)/(loMax-loMin)*lowerH,yUpper=v=>M.t+(hiMax-v)/(hiMax-hiMin)*upperH,xStep=plotW/xvals.length;let out='';
  out+=`<defs><clipPath id="clipUpper"><rect x="${M.l}" y="${M.t}" width="${plotW}" height="${upperH}"/></clipPath><clipPath id="clipLower"><rect x="${M.l}" y="${lowerTop}" width="${plotW}" height="${lowerH}"/></clipPath></defs>`;
  out+=renderBrokenAxes(W,H,M,plotW,plotH,xvals,xStep,yLower,yUpper,upperBottom,lowerTop,axisY);
  if(state.chart.type==='bar'){
    const groupW=xStep*s.categoryWidth,barW=groupW/gs.length;
    xvals.forEach((x,i)=>gs.forEach((g,gi)=>{const d=state.chartData.find(r=>r.x===x&&r.group===g);if(!d)return;const c=colors[gi%colors.length],w=Math.max(1,barW-s.barGap),xx=M.l+(i+.5)*xStep-groupW/2+gi*barW+s.barGap/2,cx=xx+w/2;
      if(d.mean>loMin){const topVal=Math.min(d.mean,loMax),ly=yLower(topVal),lh=axisY-ly;out+=`<rect data-object="series" data-series="${gi}" class="chart-object" x="${xx}" y="${ly}" width="${w}" height="${lh}" fill="${c}" fill-opacity="${s.barOpacity}" stroke="${darken(c,.25)}" stroke-width="${s.barBorderWidth}" clip-path="url(#clipLower)"/>`}
      if(d.mean>=hiMin){const uy=yUpper(d.mean),uh=upperBottom-uy;out+=`<rect data-object="series" data-series="${gi}" class="chart-object" x="${xx}" y="${uy}" width="${w}" height="${uh}" fill="${c}" fill-opacity="${s.barOpacity}" stroke="${darken(c,.25)}" stroke-width="${s.barBorderWidth}" clip-path="url(#clipUpper)"/>`;const e=Math.abs(yUpper(d.mean+d.error)-uy);out+=errorSvg(cx,uy,e,c,gi,'clipUpper');if(s.letters&&d.letter)out+=letterSvg(cx,uy-e-s.letterOffset,d.letter)}
    }));
  }else{
    gs.forEach((g,gi)=>{const c=colors[gi%colors.length],pts=xvals.map(x=>state.chartData.find(d=>d.x===x&&d.group===g)).filter(Boolean);
      ['upper','lower'].forEach(region=>{const mapped=pts.map(d=>({d,xx:M.l+(xvals.indexOf(d.x)+.5)*xStep,region:d.mean>=hiMin?'upper':d.mean<=loMax?'lower':'gap'})).filter(p=>p.region===region);if(mapped.length>1){const yy=p=>region==='upper'?yUpper(p.d.mean):yLower(p.d.mean);out+=`<path data-object="series" data-series="${gi}" class="chart-object" d="${mapped.map((p,i)=>(i?'L':'M')+p.xx+','+yy(p)).join(' ')}" fill="none" stroke="${c}" stroke-width="${getSeriesStyle(gi).lineWidth}" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#clip${region==='upper'?'Upper':'Lower'})"/>`}}
      );
      pts.forEach(d=>{const region=d.mean>=hiMin?'upper':d.mean<=loMax?'lower':null;if(!region)return;const xx=M.l+(xvals.indexOf(d.x)+.5)*xStep,yy=region==='upper'?yUpper(d.mean):yLower(d.mean),map=region==='upper'?yUpper:yLower,e=Math.abs(map(d.mean+d.error)-yy);out+=errorSvg(xx,yy,e,c,gi,region==='upper'?'clipUpper':'clipLower');out+=markerSvg(xx,yy,c,gi);if(s.letters&&d.letter)out+=letterSvg(xx,yy-e-s.letterOffset,d.letter)});
    });
  }
  return out;
}

function renderBrokenAxes(W,H,M,plotW,plotH,xvals,xStep,yLower,yUpper,upperBottom,lowerTop,axisY){
  const s=state.chart.settings,lowerTicks=makeTicks(s.lowerMin,s.lowerMax,null,3),upperTicks=makeTicks(s.upperMin,s.upperMax,null,4);let out='';
  out+=brokenVerticalGroup(M.l,M.t,axisY,upperBottom,lowerTop,'axis-y',s.axisColor,s.axisWidth);
  if(s.showYTicks){lowerTicks.forEach(v=>{const yy=yLower(v);out+=`<line data-object="axis-y" class="chart-object" x1="${M.l-s.tickLength}" x2="${M.l}" y1="${yy}" y2="${yy}" stroke="${s.axisColor}" stroke-width="${s.axisWidth}"/>`});upperTicks.forEach(v=>{const yy=yUpper(v);out+=`<line data-object="axis-y" class="chart-object" x1="${M.l-s.tickLength}" x2="${M.l}" y1="${yy}" y2="${yy}" stroke="${s.axisColor}" stroke-width="${s.axisWidth}"/>`})}
  lowerTicks.forEach(v=>out+=`<text data-object="axis-y" class="chart-object" x="${M.l-s.tickLength-6}" y="${yLower(v)+4}" text-anchor="end" font-size="${s.tickSize}">${formatTick(v)}</text>`);upperTicks.forEach(v=>out+=`<text data-object="axis-y" class="chart-object" x="${M.l-s.tickLength-6}" y="${yUpper(v)+4}" text-anchor="end" font-size="${s.tickSize}">${formatTick(v)}</text>`);
  out+=`<g data-object="axis-x" class="chart-object" stroke="${s.axisColor}" stroke-width="${s.axisWidth}" fill="none"><path d="M${M.l},${axisY} H${M.l+plotW}"/>`;
  if(s.showXTicks)xvals.forEach((x,i)=>{const xx=M.l+(i+.5)*xStep;out+=`<line x1="${xx}" x2="${xx}" y1="${axisY}" y2="${axisY+s.tickLength}"/>`});out+='</g>';
  xvals.forEach((x,i)=>{const xx=M.l+(i+.5)*xStep,yy=axisY+s.tickLength+18;out+=`<text data-object="axis-x" class="chart-object" x="${xx}" y="${yy}" text-anchor="middle" font-size="${s.tickSize}" transform="rotate(${s.xTickRotation} ${xx} ${yy})">${esc(x)}</text>`});
  out+=renderFrame(M,plotW,plotH,true,upperBottom,lowerTop,axisY);out+=axisTitles();return out;
}

function brokenVerticalGroup(x,top,bottom,upperBottom,lowerTop,obj,color,width){
  const mid=(upperBottom+lowerTop)/2,sep=Math.min(5,Math.max(3,(lowerTop-upperBottom)*.28)),half=7,dy=5;
  const c1=mid-sep/2,c2=mid+sep/2,upperEnd=c1-dy-1,lowerStart=c2+dy+1;
  return `<g data-object="${obj}" class="chart-object" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="square" stroke-linejoin="miter"><path d="M${x},${top} V${upperEnd} M${x},${lowerStart} V${bottom}"/><path d="M${x-half},${c1-dy} L${x+half},${c1+dy} M${x-half},${c2-dy} L${x+half},${c2+dy}"/></g>`;
}

function renderFrame(M,plotW,plotH,broken=false,upperBottom=null,lowerTop=null,axisY=null){
  const s=state.chart.settings,mode=s.frameMode;if(mode==='none'||mode==='lb')return'';const right=M.l+plotW,bottom=M.t+plotH;let out=`<g data-object="frame" class="chart-object" stroke="${s.frameColor}" stroke-width="${s.frameWidth}" fill="none">`;
  if(mode==='box')out+=`<path d="M${M.l},${M.t} H${right}"/>`;
  if(mode==='box'||mode==='lbr')out+=broken?brokenVerticalGroup(right,M.t,axisY,upperBottom,lowerTop,'frame',s.frameColor,s.frameWidth).replace(/^<g[^>]*>|<\/g>$/g,''):`<path d="M${right},${M.t} V${bottom}"/>`;
  return out+'</g>';
}

function axisTitles(){
  const s=state.chart.settings;return `<text data-object="axis-x" data-drag="xTitle" class="chart-object draggable" x="${s.xTitleX}" y="${s.xTitleY}" text-anchor="middle" font-size="${s.xTitleSize}">${esc(s.xTitle)}</text><text data-object="axis-y" data-drag="yTitle" class="chart-object draggable" transform="translate(${s.yTitleX} ${s.yTitleY}) rotate(-90)" text-anchor="middle" font-size="${s.yTitleSize}">${esc(s.yTitle)}</text>`;
}

function markerShapeSvg(shape,x,y,r,attrs){
  if(shape==='square')return`<rect ${attrs} x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}"/>`;
  if(shape==='triangle')return`<path ${attrs} d="M${x},${y-r*1.25} L${x+r*1.15},${y+r} L${x-r*1.15},${y+r} Z"/>`;
  if(shape==='diamond')return`<path ${attrs} d="M${x},${y-r*1.25} L${x+r*1.1},${y} L${x},${y+r*1.25} L${x-r*1.1},${y} Z"/>`;
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
function letterSvg(x,y,text){const s=state.chart.settings;return`<text data-object="letters" class="chart-object" x="${x}" y="${y}" text-anchor="middle" font-size="${s.letterSize}" font-weight="600">${esc(text)}</text>`}

function legendFrameSvg(width,height){
  const s=state.chart.settings,style=s.legendFrameStyle||(s.legendFrame?'solid':'none');
  if(style==='none')return'';
  const x=-12,y=-height*.18-8,w=width+24,h=height+16,r=s.legendFrameRadius??2,stroke=s.legendFrameColor||'#7d898f',sw=s.legendFrameWidth||1;
  const dash=style==='dashed'?'8 5':style==='dotted'?'2 4':'';
  if(style==='double')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="white" stroke="${stroke}" stroke-width="${sw}"/><rect x="${x+4}" y="${y+4}" width="${w-8}" height="${h-8}" rx="${Math.max(0,r-1)}" fill="none" stroke="${stroke}" stroke-width="${Math.max(.6,sw*.75)}"/>`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="white" stroke="${stroke}" stroke-width="${sw}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
}
function renderLegend(gs,colors){
  const s=state.chart.settings;if(!s.legendVisible||gs.length<=1)return'';
  ensureSeriesStyles();
  const x=state.chart.legend.x,y=state.chart.legend.y,horizontal=s.legendOrientation==='horizontal';
  const font=s.legendSize,rowH=Math.max(25,font*1.55),symbolW=Math.max(18,font*1.15),textGap=Math.max(9,font*.55),itemGap=Math.max(18,font*.9);
  const labelWidths=gs.map(g=>Math.max(20,String(g).length*font*.62));
  let content='',cursor=0,maxWidth=0;
  gs.forEach((g,i)=>{
    const ox=horizontal?cursor:0,oy=horizontal?0:i*rowH,c=colors[i%colors.length],st=getSeriesStyle(i);
    if(state.chart.type==='bar')content+=`<rect data-object="legend" x="${ox}" y="${oy-font*.48}" width="${symbolW}" height="${Math.max(12,font*.82)}" fill="${c}" stroke="${darken(c,.25)}" stroke-width="${s.barBorderWidth}"/><text data-object="legend" x="${ox+symbolW+textGap}" y="${oy+font*.34}" font-size="${font}">${esc(g)}</text>`;
    else content+=`<line data-object="legend" x1="${ox}" x2="${ox+symbolW}" y1="${oy}" y2="${oy}" stroke="${c}" stroke-width="${st.lineWidth}"/>${markerLegend(ox+symbolW/2,oy,c,i)}<text data-object="legend" x="${ox+symbolW+textGap}" y="${oy+font*.34}" font-size="${font}">${esc(g)}</text>`;
    const itemW=symbolW+textGap+labelWidths[i];maxWidth=Math.max(maxWidth,itemW);if(horizontal)cursor+=itemW+itemGap;
  });
  const width=horizontal?Math.max(0,cursor-itemGap):maxWidth,height=horizontal?rowH:Math.max(rowH,gs.length*rowH);
  return `<g id="legendGroup" data-object="legend" data-drag="legend" class="chart-object draggable" transform="translate(${x} ${y})">${legendFrameSvg(width,height)}${content}</g>`;
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
      e.preventDefault();e.stopPropagation();const key=el.dataset.drag,start=svgPoint(svg,e),snapshot=dragSnapshot(key);el.setPointerCapture(e.pointerId);el.classList.add('dragging');selectObject(key==='legend'?'legend':key==='title'?'title':key==='xTitle'?'axis-x':'axis-y');
      const move=ev=>{const p=svgPoint(svg,ev),dx=p.x-start.x,dy=p.y-start.y;applyDrag(key,snapshot,dx,dy,el)};
      const up=()=>{el.classList.remove('dragging');el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);renderProperties()};
      el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);
    });
  });
}
function svgPoint(svg,e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())}
function dragSnapshot(key){const s=state.chart.settings;if(key==='legend')return{x:state.chart.legend.x,y:state.chart.legend.y};if(key==='title')return{x:s.titleX,y:s.titleY};if(key==='xTitle')return{x:s.xTitleX,y:s.xTitleY};return{x:s.yTitleX,y:s.yTitleY}}
function applyDrag(key,snap,dx,dy,el){const x=snap.x+dx,y=snap.y+dy,s=state.chart.settings;if(key==='legend'){state.chart.legend.x=x;state.chart.legend.y=y;el.setAttribute('transform',`translate(${x} ${y})`)}else if(key==='title'){s.titleX=x;s.titleY=y;el.setAttribute('x',x);el.setAttribute('y',y)}else if(key==='xTitle'){s.xTitleX=x;s.xTitleY=y;el.setAttribute('x',x);el.setAttribute('y',y)}else{s.yTitleX=x;s.yTitleY=y;el.setAttribute('transform',`translate(${x} ${y}) rotate(-90)`)}}

function renderProperties(){
  const id=state.chart.selected,s=state.chart.settings,gs=chartGroups();let name='',html='';
  if(id==='title'){name='图题';html=fieldGroup([
    textField('title','图题文字'),numberField('titleX','水平位置',0,980,1),numberField('titleY','垂直位置',10,120,1),rangeField('titleSize','字号',9,28,1),selectField('titleWeight','字重',[['400','常规'],['600','半粗'],['700','粗体']])
  ]);}
  else if(id==='axis-x'){name='X 轴与横坐标标题';html=fieldGroup([
    textField('xTitle','横坐标标题'),numberField('xTitleX','标题水平位置',0,980,1),numberField('xTitleY','标题垂直位置',500,655,1),rangeField('xTitleSize','标题字号',9,24,1),
    rangeField('axisWidth','坐标轴粗细',.5,4,.1),colorField('axisColor','坐标轴颜色'),rangeField('tickSize','刻度字号',8,20,1),rangeField('tickLength','刻度线长度',0,14,1),rangeField('xTickRotation','刻度标签旋转',-90,90,5),checkField('showXTicks','显示横坐标刻度线')
  ]);}
  else if(id==='axis-y'){name='Y 轴与纵坐标标题';html=fieldGroup([
    textField('yTitle','纵坐标标题'),numberField('yTitleX','标题水平位置',0,120,1),numberField('yTitleY','标题垂直位置',80,620,1),rangeField('yTitleSize','标题字号',9,24,1),
    numberField('yMin','最小值',null,null,.01,true),numberField('yMax','最大值',null,null,.01,true),numberField('yTickStep','刻度间隔',null,null,.01,true),rangeField('axisWidth','坐标轴粗细',.5,4,.1),colorField('axisColor','坐标轴颜色'),rangeField('tickSize','刻度字号',8,20,1),rangeField('tickLength','刻度线长度',0,14,1),checkField('showYTicks','显示纵坐标刻度线')
  ])+breakPropertyBlock();}
  else if(id==='frame'){name='图片边框';html=fieldGroup([
    selectField('frameMode','边框形式',[['lb','仅左、下轴'],['lbr','左、下、右三边'],['box','完整四边框'],['none','不显示边框']]),rangeField('frameWidth','边框粗细',.5,4,.1),colorField('frameColor','边框颜色')
  ]);}
  else if(id==='series'){const idx=clamp(state.chart.selectedSeries,0,Math.max(0,gs.length-1));name=`数据系列 · ${gs[idx]||'Series'}`;html=fieldGroup([
    colorField(`palette:${idx}`,'当前系列颜色'),rangeField(`series:${idx}:lineWidth`,'本系列折线粗细',.5,7,.1),rangeField(`series:${idx}:markerSize`,'本系列标记大小',1,14,.2),selectField(`series:${idx}:markerShape`,'本系列标记形状',[['circle','圆形'],['square','方形'],['triangle','三角形'],['diamond','菱形']]),selectField(`series:${idx}:markerFill`,'本系列标记填充',[['white','白色空心'],['series','同系列颜色']]),
    rangeField('barGap','柱间距',0,16,1),rangeField('categoryWidth','组宽度',.35,.95,.01),rangeField('barOpacity','柱填充透明度',.25,1,.05),rangeField('barBorderWidth','柱边框粗细',0,3,.1)
  ])+`<div class="hint">折线粗细、标记大小、形状和填充只修改当前选中的系列，不再联动其他折线。</div>`+paletteBlock();}
  else if(id==='error'){name='误差棒';html=fieldGroup([rangeField('errorWidth','线条粗细',.5,4,.1),rangeField('errorCap','端帽宽度',2,28,1),selectField('errorColorMode','颜色',[['series','跟随系列颜色'],['black','统一黑色']])])+`<div class="hint">当前误差类型：${state.design.errorType==='sd'?'Mean ± SD':state.design.errorType==='se'?'Mean ± SE':'Mean ± 95% CI'}。可在研究设计页修改。</div>`;}
  else if(id==='legend'){name='图例';html=fieldGroup([checkField('legendVisible','显示图例'),numberLegendField('x','水平位置'),numberLegendField('y','垂直位置'),rangeField('legendSize','字号',8,48,1),selectField('legendOrientation','排列方向',[['vertical','纵向'],['horizontal','横向']]),selectField('legendFrameStyle','边框样式',[['none','无边框'],['solid','实线'],['dashed','虚线'],['dotted','点线'],['double','双线']]),rangeField('legendFrameWidth','边框粗细',.5,4,.1),colorField('legendFrameColor','边框颜色'),rangeField('legendFrameRadius','圆角',0,14,1)])+`<div class="hint">图例字号可放大到 48。柱状图使用色块图例；折线图会读取每条折线各自的线宽和标记形状。图例仍可直接拖动。</div>`;}
  else if(id==='letters'){name='显著性字母';html=fieldGroup([checkField('letters','显示显著性字母'),rangeField('letterSize','字母字号',8,22,1),rangeField('letterOffset','与误差棒间距',3,28,1)])+`<div class="hint">字母由 Fisher's LSD（α=0.05）根据独立平行样本均值生成；同一样品的测定重复不会被当作独立 n。</div>`;}
  else if(id==='background'){name='背景';html=fieldGroup([colorField('background','背景颜色')]);}
  $('#selectedObjectName').textContent=name||'未选择对象';$('#propertyEditor').innerHTML=html||'<div class="empty-state">在图中点击一个对象</div>';bindPropertyInputs();
}

function fieldGroup(items){return items.join('')}
function fieldWrap(label,key,input){return`<div class="field"><label><span>${label}</span><output data-out="${key}">${displaySetting(key)}</output></label>${input}</div>`}
function getSettingValue(k){
  if(k.startsWith('palette:'))return state.chart.palette[Number(k.split(':')[1])];
  if(k.startsWith('legend:'))return state.chart.legend[k.split(':')[1]];
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
function displaySetting(k){return getSettingValue(k)}
function breakPropertyBlock(){const s=state.chart.settings;return `<div class="subhead">真实断轴</div><label class="check-row"><input id="breakFromProp" type="checkbox" ${state.chart.breakAxis?'checked':''}>启用断轴</label><div class="two-col">${numberField('lowerMin','下段最小值',null,null,.01)}${numberField('lowerMax','下段最大值',null,null,.01)}${numberField('upperMin','上段最小值',null,null,.01)}${numberField('upperMax','上段最大值',null,null,.01)}</div>${rangeField('breakGap','断口间距',8,28,1)}${rangeField('lowerRatio','下段高度比例',.12,.42,.01)}<div class="hint">上下为两个独立绘图区；柱体断口与左右 Y 轴断口使用同一高度，避免柱体缺口明显大于坐标轴。</div>`}
function paletteBlock(){return`<div class="subhead">全部系列配色</div><div class="palette-grid">${state.chart.palette.slice(0,6).map((c,i)=>`<input type="color" data-palette="${i}" value="${c}" title="系列 ${i+1}">`).join('')}</div>`}

function bindPropertyInputs(){
  $$('[data-setting]').forEach(el=>el.addEventListener('input',()=>{
    const k=el.dataset.setting;let value=el.type==='checkbox'?el.checked:el.value;
    if(el.type==='range'||el.type==='number')value=el.value===''?null:Number(el.value);
    if(k.startsWith('palette:'))state.chart.palette[Number(k.split(':')[1])]=value;
    else if(k.startsWith('legend:'))state.chart.legend[k.split(':')[1]]=value;
    else if(k.startsWith('series:')){const [,idx,key]=k.split(':');setSeriesSetting(Number(idx),key,value)}
    else state.chart.settings[k]=value;
    const o=$(`[data-out="${cssEscape(k)}"]`);if(o)o.textContent=value??'';renderChart();
  }));
  $$('[data-palette]').forEach(el=>el.addEventListener('input',()=>{state.chart.palette[Number(el.dataset.palette)]=el.value;renderChart()}));
  const br=$('#breakFromProp');if(br)br.addEventListener('change',()=>{state.chart.breakAxis=br.checked;if(br.checked)autoBreakScale();renderChartStudio()});
}

function exportSvg(){const svg=$('#paperSvg');if(!svg)return;const copy=svg.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');download(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}),`${safeFile(state.design.experimentName)}_${safeFile(state.design.metricName)}.svg`)}
function exportPng(){const svg=$('#paperSvg');if(!svg)return;const xml=new XMLSerializer().serializeToString(svg),blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=1960;canvas.height=1320;const ctx=canvas.getContext('2d');ctx.fillStyle=state.chart.settings.background;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(b=>download(b,`${safeFile(state.design.experimentName)}_${safeFile(state.design.metricName)}.png`),'image/png');URL.revokeObjectURL(url)};img.src=url}

function saveProject(){
  const payload={version:'0.4.2',savedAt:new Date().toISOString(),design:state.design,rawData:state.rawData,chart:state.chart};
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

init();
