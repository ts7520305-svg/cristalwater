(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CWEmailHistoryRules=factory();}(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647,count=v=>Number.isSafeInteger(v)&&v>=0&&v<=2147483647,object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
  const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number(v.slice(0,4))>=1000&&Number(v.slice(0,4))<=9998&&iso(v+'T00:00:00.000Z');
  const limits={status:64,type:80,mode:80,recipient:254,q:120,from:10,to:10};
  function filters(raw={}){
    if(!object(raw)||Object.keys(raw).some(k=>!Object.hasOwn(limits,k)&&!['page','pageSize'].includes(k)))return null;
    const f={};for(const [k,max] of Object.entries(limits)){const v=raw[k]??'';if(typeof v!=='string'||v.length>max||/[\u0000-\u001f\u007f]/.test(v))return null;f[k]=v.trim();}
    if(f.from&&!day(f.from)||f.to&&!day(f.to)||f.from&&f.to&&f.from>f.to)return null;
    for(const [k,def] of [['page','1'],['pageSize','25']]){const v=raw[k]??def;if(typeof v!=='string'||!/^([1-9]\d*)$/.test(v)||!positive(Number(v)))return null;f[k]=Number(v);}
    if(f.pageSize>100||(f.page-1)*f.pageSize>2147483647)return null;return f;
  }
  const fields=['id','to','toEmail','subject','eventType','type','mode','status','error','retryCount','lastRetryAt','createdAt'];
  function row(r){return object(r)&&Object.keys(r).length===fields.length&&fields.every(k=>Object.hasOwn(r,k))&&positive(r.id)&&count(r.retryCount)&&typeof r.status==='string'&&['to','toEmail','subject','eventType','type','mode','error'].every(k=>r[k]===null||typeof r[k]==='string')&&iso(r.createdAt)&&(r.lastRetryAt===null||iso(r.lastRetryAt));}
  const contains=(v,q)=>String(v??'').toLowerCase().includes(q.toLowerCase());
  function matches(r,f){return (!f.status||r.status===f.status)&&(!f.type||r.type===f.type||r.eventType===f.type)&&(!f.mode||r.mode===f.mode)&&(!f.recipient||contains(r.to,f.recipient)||contains(r.toEmail,f.recipient))&&(!f.q||contains(r.subject,f.q)||contains(r.error,f.q))&&(!f.from||r.createdAt.slice(0,10)>=f.from)&&(!f.to||r.createdAt.slice(0,10)<=f.to);}
  function packet(v,f,owner){
    if(!object(v)||v.ok!==true||v.version!==1||v.owner!==owner||!iso(v.asOf)||v.timeZone!=='UTC'||!equal(v.filters,f)||v.page!==f.page||v.pageSize!==f.pageSize||!count(v.total)||v.totalPages!==Math.max(1,Math.ceil(v.total/f.pageSize))||v.hasPrevious!==(f.page>1)||v.hasNext!==(f.page<v.totalPages)||!Array.isArray(v.items)||v.items.length!==Math.min(f.pageSize,Math.max(0,v.total-(f.page-1)*f.pageSize)))return false;
    const seen=new Set();let previous=null;for(const r of v.items){if(!row(r)||!matches(r,f)||seen.has(r.id)||previous&&(previous.createdAt<r.createdAt||previous.createdAt===r.createdAt&&previous.id<=r.id))return false;seen.add(r.id);previous=r;}return true;
  }
  return {positive,count,iso,day,filters,row,matches,packet,equal};
}));
