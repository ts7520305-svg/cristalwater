(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CWCollectionSummaryRules=factory();}(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const pageSize=50,positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647;
  const count=v=>Number.isSafeInteger(v)&&v>=0,object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
  function filters(raw={}){
    if(!object(raw)||Object.keys(raw).some(k=>!['q','paymentStatus','page'].includes(k)))return null;
    const q=raw.q??'',paymentStatus=raw.paymentStatus??'',page=raw.page??'1';
    if(typeof q!=='string'||q.length>120||/[\u0000-\u001f\u007f]/.test(q)||!['','PENDING','OVERDUE'].includes(paymentStatus)||typeof page!=='string'||!/^([1-9]\d*)$/.test(page)||Number(page)>42949673)return null;
    return {q:q.trim(),paymentStatus,page:Number(page)};
  }
  function row(r){
    return object(r)&&positive(r.id)&&typeof r.name==='string'&&typeof r.clientStatus==='string'&&['PENDING','OVERDUE'].includes(r.paymentStatus)&&['email','phone'].every(k=>r[k]===null||typeof r[k]==='string')&&(r.lastReminderAt===null||iso(r.lastReminderAt))&&count(r.openInvoices)&&r.openInvoices>0&&count(r.overdueInvoices)&&r.overdueInvoices<=r.openInvoices&&count(r.amountCents)&&r.amountCents>0&&count(r.overdueCents)&&r.overdueCents<=r.amountCents&&r.paymentStatus===(r.overdueInvoices?'OVERDUE':'PENDING')&&(r.overdueInvoices===0?r.overdueCents===0:r.overdueCents>0);
  }
  function matches(r,f){const q=f.q.toLowerCase();return (!f.paymentStatus||r.paymentStatus===f.paymentStatus)&&(!q||[r.name,r.email??'',r.phone??'','CW-'+String(r.id).padStart(6,'0')].some(v=>v.toLowerCase().includes(q)));}
  function totals(rows){const sum={clients:rows.length,openInvoices:0,overdueInvoices:0,amountCents:0,overdueCents:0};for(const r of rows)for(const k of ['openInvoices','overdueInvoices','amountCents','overdueCents']){sum[k]+=r[k];if(!count(sum[k]))throw Error('Collection total outside safe range');}return sum;}
  function packet(v,f,owner){
    if(!object(v)||v.ok!==true||v.version!==1||v.owner!==owner||!iso(v.asOf)||v.timeZone!=='UTC'||v.basis!=='RECEIVABLE_DOCUMENT_BALANCES_ALL_CLIENT_STATUSES'||!equal(v.filters,f)||v.pageSize!==pageSize||!count(v.total)||v.total>2147483647||v.pages!==Math.max(1,Math.ceil(v.total/pageSize))||v.hasPrevious!==(f.page>1)||v.hasNext!==(f.page<v.pages)||!Array.isArray(v.clients)||v.clients.length!==Math.min(pageSize,Math.max(0,v.total-(f.page-1)*pageSize))||!object(v.totals)||v.totals.clients!==v.total||!['clients','openInvoices','overdueInvoices','amountCents','overdueCents'].every(k=>count(v.totals[k]))||v.totals.overdueInvoices>v.totals.openInvoices||v.totals.overdueCents>v.totals.amountCents||v.totals.openInvoices<v.total||v.totals.amountCents<v.total)return false;
    let previous=0;for(const r of v.clients){if(!row(r)||r.id<=previous||!matches(r,f))return false;previous=r.id;}
    const part=totals(v.clients);if(Object.keys(part).some(k=>part[k]>v.totals[k]))return false;
    if(v.total<=pageSize&&f.page===1&&!equal(v.totals,part))return false;
    if(f.paymentStatus==='PENDING'&&(v.totals.overdueInvoices||v.totals.overdueCents))return false;
    return true;
  }
  return {pageSize,positive,count,iso,filters,row,matches,totals,packet,equal};
}));
