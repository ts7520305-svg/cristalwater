(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CWExtraHistoryRules=factory();}(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const pageSize=50,positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647,object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&v>='1900-01-01'&&v<='9998-12-31'&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
  const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
  function filters(raw={}){
    if(!object(raw)||Object.keys(raw).some(k=>!['q','clientId','poolId','from','to','page'].includes(k)))return null;
    const out={q:raw.q??'',clientId:raw.clientId??'',poolId:raw.poolId??'',from:raw.from??'',to:raw.to??'',page:raw.page??'1'};
    if(Object.values(out).some(v=>typeof v!=='string')||out.q.length>120||/[\u0000-\u001f\u007f]/.test(out.q))return null;
    out.q=out.q.trim();
    if(['clientId','poolId'].some(k=>out[k]!==''&&(!/^[1-9]\d*$/.test(out[k])||!positive(Number(out[k]))))||!/^([1-9]\d*)$/.test(out.page)||Number(out.page)>42949673||out.from&&!day(out.from)||out.to&&!day(out.to)||out.from&&out.to&&out.from>out.to)return null;
    return {...out,clientId:out.clientId?Number(out.clientId):null,poolId:out.poolId?Number(out.poolId):null,page:Number(out.page)};
  }
  function cents(raw){
    if(typeof raw!=='string'||raw!==String(Number(raw))||!Number.isFinite(Number(raw)))return null;
    const match=raw.match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/);if(!match)return null;
    const fraction=match[3]||'',shift=Number(match[4]||0)+2-fraction.length;let value=BigInt(match[2]+fraction);
    if(shift>=0)value*=10n**BigInt(shift);else{const divisor=10n**BigInt(-shift);if(value%divisor!==0n)return null;value/=divisor;}
    if(match[1])value=-value;return value>BigInt(Number.MAX_SAFE_INTEGER)||value<BigInt(Number.MIN_SAFE_INTEGER)?null:Number(value);
  }
  function row(v){
    if(!object(v)||!positive(v.id)||['clientId','poolId','poolClientId'].some(k=>v[k]!==null&&!positive(v[k]))||['clientName','poolName','notes'].some(k=>v[k]!==null&&typeof v[k]!=='string')||!iso(v.scheduledAt)||v.billedAt!==null&&!iso(v.billedAt)||v.billed!==true||typeof v.status!=='string'||typeof v.billingMode!=='string'||typeof v.priceRaw!=='string'||v.priceRaw!==String(Number(v.priceRaw))||v.priceCents!==cents(v.priceRaw))return false;
    if((v.clientId===null)!==(v.clientName===null)||(v.poolId===null)!==(v.poolName===null)||v.poolId===null&&v.poolClientId!==null)return false;
    return v.clientReview===(v.clientId===null?'MISSING':v.poolClientId!==null&&v.clientId!==v.poolClientId?'POOL_CHANGED':'RECORDED');
  }
  function packet(v,selection,owner){
    if(!object(v)||v.ok!==true||v.version!==1||v.owner!==owner||!iso(v.asOf)||v.timeZone!=='UTC'||v.basis!=='EXTRA_VISIT_BILLED_MARKER'||!equal(v.filters,selection)||v.pageSize!==pageSize||!Number.isSafeInteger(v.total)||v.total<0||v.total>2147483647||v.pages!==Math.max(1,Math.ceil(v.total/pageSize))||v.hasPrevious!==(selection.page>1)||v.hasNext!==(selection.page<v.pages)||!Array.isArray(v.extras)||v.extras.length!==Math.min(pageSize,Math.max(0,v.total-(selection.page-1)*pageSize)))return false;
    const ids=new Set();let previous=null;
    return v.extras.every(item=>{
      if(!row(item)||ids.has(item.id)||selection.clientId!==null&&item.clientId!==selection.clientId||selection.poolId!==null&&item.poolId!==selection.poolId||(selection.from||selection.to)&&item.billedAt===null||selection.from&&item.billedAt<selection.from+'T00:00:00.000Z'||selection.to&&item.billedAt>selection.to+'T23:59:59.999Z'||previous&&(previous.billedAt===null&&item.billedAt!==null||previous.billedAt!==null&&item.billedAt!==null&&item.billedAt>previous.billedAt||item.billedAt===previous.billedAt&&item.id>=previous.id))return false;
      ids.add(item.id);previous=item;return true;
    });
  }
  return {pageSize,positive,day,iso,equal,filters,cents,row,packet};
}));
