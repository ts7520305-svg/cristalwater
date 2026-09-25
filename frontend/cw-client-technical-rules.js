(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CWClientTechnicalRules=factory();}(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const pageSize=50,positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647,object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&v>='1900-01-01'&&v<='9998-12-31'&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
  const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
  const readingKeys=['ph','chlorine','alkalinity','salt','temperature','orpMv'];
  function filters(raw={}){
    if(!object(raw)||Object.keys(raw).some(k=>!['poolId','from','to','page'].includes(k)))return null;
    const out={poolId:raw.poolId??'',from:raw.from??'',to:raw.to??'',page:raw.page??'1'};
    if(Object.values(out).some(v=>typeof v!=='string')||out.poolId!==''&&(!/^[1-9]\d*$/.test(out.poolId)||!positive(Number(out.poolId)))||!/^([1-9]\d*)$/.test(out.page)||Number(out.page)>42949673||out.from&&!day(out.from)||out.to&&!day(out.to)||out.from&&out.to&&out.from>out.to)return null;
    return {...out,poolId:out.poolId?Number(out.poolId):null,page:Number(out.page)};
  }
  function row(v,clientId){
    if(!object(v)||!positive(v.id)||v.clientId!==clientId||v.poolId!==null&&!positive(v.poolId)||!iso(v.date)||['plannedDate','startAt','endAt'].some(k=>v[k]!==null&&!iso(v[k]))||['poolName','technicianName','notes','products'].some(k=>v[k]!==null&&typeof v[k]!=='string')||typeof v.status!=='string'||!object(v.readings)||!equal(Object.keys(v.readings).sort(),[...readingKeys].sort())||readingKeys.some(k=>v.readings[k]!==null&&(typeof v.readings[k]!=='number'||!Number.isFinite(v.readings[k])))||!Array.isArray(v.chemicals)||v.chemicals.some(c=>!object(c)||typeof c.name!=='string'||!Number.isFinite(c.quantity)||c.unit!==null&&typeof c.unit!=='string'))return false;
    return (v.poolId===null)===(v.poolName===null)&&!['internalNotes','alerts','cost','revenue','profit','client','technician','pool'].some(k=>Object.hasOwn(v,k));
  }
  function packet(v,selection,clientId){
    if(!object(v)||v.ok!==true||v.version!==1||v.clientId!==clientId||!iso(v.asOf)||v.timeZone!=='UTC'||v.basis!=='RECORDED_CLIENT_VISITS'||!equal(v.filters,selection)||v.pageSize!==pageSize||!Number.isSafeInteger(v.total)||v.total<0||v.total>2147483647||v.pages!==Math.max(1,Math.ceil(v.total/pageSize))||v.hasPrevious!==(selection.page>1)||v.hasNext!==(selection.page<v.pages)||!Array.isArray(v.visits)||v.visits.length!==Math.min(pageSize,Math.max(0,v.total-(selection.page-1)*pageSize)))return false;
    const ids=new Set();let previous=null;
    return v.visits.every(item=>{
      if(!row(item,clientId)||ids.has(item.id)||selection.poolId!==null&&item.poolId!==selection.poolId||selection.from&&item.date<selection.from+'T00:00:00.000Z'||selection.to&&item.date>selection.to+'T23:59:59.999Z'||previous&&(item.date>previous.date||item.date===previous.date&&item.id>=previous.id))return false;
      ids.add(item.id);previous=item;return true;
    });
  }
  return {pageSize,positive,day,iso,equal,filters,row,packet,readingKeys};
}));
