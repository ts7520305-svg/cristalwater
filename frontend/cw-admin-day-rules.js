(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.CWAdminDayRules=factory();}(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const pageSize=50,timeZone='Europe/Lisbon',groups=['PLANNED','IN_PROGRESS','DONE','NOT_DONE','CANCELLED','OTHER'],kinds=['REGULAR','EXTRA'];
 const positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647,count=v=>Number.isSafeInteger(v)&&v>=0&&v<=2147483647,object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
 const day=v=>typeof v==='string'&&/^(20|21)\d{2}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 const clock=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}),parts=instant=>Object.fromEntries(clock.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
 function localDay(instant){const p=parts(instant);return p.year+'-'+p.month+'-'+p.day;}
 function midnight(d){const wall=Date.parse(d+'T00:00:00Z');let instant=wall;for(let i=0;i<4;i++){const p=parts(instant),rendered=Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':00Z'),delta=wall-rendered;if(!delta)return new Date(instant).toISOString();instant+=delta;}return null;}
 function bounds(d){if(!day(d))return null;const next=new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10),start=midnight(d),end=midnight(next);return start&&end?{start,end}:null;}
 function group(raw){const status=String(raw??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/\s+/g,'_');
  if(['NOT_DONE','INCOMPLETE','FAILED','NOT_COMPLETED','NAO_REALIZADA','NAO_REALIZADO','NAO_CONCLUIDA','NAO_CONCLUIDO'].includes(status))return 'NOT_DONE';
  if(['DONE','COMPLETED','CONCLUIDA','CONCLUIDO'].includes(status))return 'DONE';
  if(['CANCELLED','CANCELED','CANCELADA','CANCELADO'].includes(status))return 'CANCELLED';
  if(['IN_PROGRESS','EM_EXECUCAO'].includes(status))return 'IN_PROGRESS';
  if(['PLANNED','PENDING','PENDING_TECHNICIAN','AGENDADA','AGENDADO','PLANEADA','PLANEADO'].includes(status))return 'PLANNED';return 'OTHER';
 }
 function filters(raw={}){if(!object(raw)||Object.keys(raw).some(k=>!['date','q','group','kind','page'].includes(k)))return null;const date=raw.date??'',q=raw.q??'',g=raw.group??'',kind=raw.kind??'',page=raw.page??'1';if(date!==''&&!day(date)||typeof q!=='string'||q.length>120||/[\u0000-\u001f\u007f]/.test(q)||!['',...groups].includes(g)||!['',...kinds].includes(kind)||typeof page!=='string'||!/^([1-9]\d*)$/.test(page)||Number(page)>42949673)return null;return {date,q:q.trim(),group:g,kind,page:Number(page)};}
 const named=v=>v===null||object(v)&&positive(v.id)&&(v.name===null||typeof v.name==='string');
 function row(r,range){return object(r)&&positive(r.id)&&kinds.includes(r.kind)&&r.key===r.kind+':'+r.id&&typeof r.status==='string'&&r.group===group(r.status)&&iso(r.scheduledAt)&&r.scheduledAt>=range.start&&r.scheduledAt<range.end&&(r.kind==='REGULAR'?['plannedDate','date'].includes(r.scheduleSource):r.scheduleSource==='scheduledAt')&&[r.startAt,r.endAt].every(v=>v===null||iso(v))&&['client','pool','technician','legacyUser'].every(k=>named(r[k]))&&(r.recordedTechnicianName===null||typeof r.recordedTechnicianName==='string')&&(r.kind==='REGULAR'?r.legacyUser===null:r.recordedTechnicianName===null);}
 const compare=(a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.kind.localeCompare(b.kind)||a.id-b.id;
 const matches=(r,f)=>(!f.group||r.group===f.group)&&(!f.kind||r.kind===f.kind)&&(!f.q||[r.key,r.client?.name,r.pool?.name,r.technician?.name,r.legacyUser?.name,r.recordedTechnicianName].some(v=>typeof v==='string'&&v.toLowerCase().includes(f.q.toLowerCase())));
 function totals(rows){const result={total:rows.length,...Object.fromEntries(groups.map(k=>[k,0]))};for(const r of rows)result[r.group]++;return result;}
 function packet(v,f,owner){if(!object(v)||v.ok!==true||v.version!==1||v.owner!==owner||!iso(v.asOf)||v.timeZone!==timeZone||v.basis!=='SCHEDULED_DAY'||v.day!==(f.date||localDay(v.asOf))||!equal(v.range,bounds(v.day))||!equal(v.filters,f)||v.pageSize!==pageSize||!count(v.total)||v.pages!==Math.max(1,Math.ceil(v.total/pageSize))||v.hasPrevious!==(f.page>1)||v.hasNext!==(f.page<v.pages)||!object(v.totals)||v.totals.total!==v.total||!groups.every(g=>count(v.totals[g]))||groups.reduce((sum,g)=>sum+v.totals[g],0)!==v.total||!Array.isArray(v.rows)||v.rows.length!==Math.min(pageSize,Math.max(0,v.total-(f.page-1)*pageSize)))return false;
  const seen=new Set();let previous=null;for(const r of v.rows){if(!row(r,v.range)||!matches(r,f)||seen.has(r.key)||previous&&compare(previous,r)>=0)return false;seen.add(r.key);previous=r;}const part=totals(v.rows);if(groups.some(g=>part[g]>v.totals[g]))return false;if(v.total<=pageSize&&f.page===1&&!equal(v.totals,part))return false;return !f.group||v.totals[f.group]===v.total;
 }
 return {pageSize,timeZone,groups,kinds,positive,count,iso,day,localDay,bounds,group,filters,row,compare,matches,totals,packet,equal};
}));
