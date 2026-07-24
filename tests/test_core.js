const c=require('../core.js');
const design={factorCount:1,factors:[{levels:['0','2','4'],type:'numeric',header:'Factor1_储藏时间(d)'},{levels:[]}],parallelCount:3,measureCount:1};
const rows=[];for(const [i,a] of design.factors[0].levels.entries())for(let p=1;p<=3;p++)rows.push({Factor1:a,ParallelSample:p,MeasureReplicate:1,pH:5.6+i*.1+[0,.02,-.01][p-1],Include:'是'});
const n=c.normalizeRows(rows,design,'pH');const a=c.analyze(n,design,'pH');
if(!a.validation.valid||a.results.length!==3)throw new Error('analysis failed');
const an=c.oneWayAnova(a.samples,'pH');if(!(an.F>1&&an.p<.05))throw new Error('anova failed');
const tr=c.linearRegression(a.samples,'pH');if(!(tr.r2>.9))throw new Error('trend failed');
console.log('ok',a.results[0].pH,an.F,an.p,tr.r2);
