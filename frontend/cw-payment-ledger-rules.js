(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CWPaymentLedgerRules=factory();}(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const pageSize=50,positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&v>='1900-01-01'&&v<='9998-12-31'&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
  const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
  function filters(raw={}){
    if(!object(raw)||Object.keys(raw).some(k=>!['q','clientId','method','from','to','page'].includes(k)))return null;
    const out={q:raw.q??'',clientId:raw.clientId??'',method:raw.method??'',from:raw.from??'',to:raw.to??'',page:raw.page??'1'};
    if(Object.values(out).some(v=>typeof v!=='string')||out.q.length>120||out.method.length>80||/[\u0000-\u001f\u007f]/.test(out.q+out.method))return null;
    out.q=out.q.trim();out.method=out.method.trim();
    if(out.clientId!==''&&(!/^[1-9]\d*$/.test(out.clientId)||!positive(Number(out.clientId)))||!/^([1-9]\d*)$/.test(out.page)||Number(out.page)>42949673||out.from&&!day(out.from)||out.to&&!day(out.to)||out.from&&out.to&&out.from>out.to)return null;
    return {...out,clientId:out.clientId?Number(out.clientId):null,page:Number(out.page)};
  }
  function money(raw,stored){
    const value=Number(raw),cents=Math.round(value*100);
    const valid=typeof raw==='string'&&raw===String(value)&&Number.isFinite(value)&&Number.isSafeInteger(cents)&&Math.abs(value*100-cents)<0.000001;
    return {amountCents:valid?cents:null,amountReview:!valid?'INVALID_AMOUNT':stored===cents?'MATCH':stored===0?'LEGACY_ZERO_CENTS':'CONFLICT'};
  }
  function row(value){
    if(!object(value)||!positive(value.id)||!positive(value.invoiceId)||!positive(value.clientId)||!iso(value.paidAt)||typeof value.clientName!=='string'||['documentReference','monthRef','method','notes'].some(k=>value[k]!==null&&typeof value[k]!=='string')||typeof value.documentStatus!=='string'||typeof value.internalCredit!=='boolean'||typeof value.amountRaw!=='string'||value.amountRaw!==String(Number(value.amountRaw))||!Number.isSafeInteger(value.storedAmountCents))return false;
    const projected=money(value.amountRaw,value.storedAmountCents);
    return value.amountCents===projected.amountCents&&value.amountReview===projected.amountReview;
  }
  function packet(value,selection,owner){
    if(!object(value)||value.ok!==true||value.version!==1||value.owner!==owner||!iso(value.asOf)||value.timeZone!=='UTC'||value.basis!=='PAYMENT_RECORDS_INCLUDING_INTERNAL_CREDIT'||!equal(value.filters,selection)||value.pageSize!==pageSize||!Number.isSafeInteger(value.total)||value.total<0||value.total>2147483647||value.pages!==Math.max(1,Math.ceil(value.total/pageSize))||value.hasPrevious!==(selection.page>1)||value.hasNext!==(selection.page<value.pages)||!Array.isArray(value.payments)||value.payments.length!==Math.min(pageSize,Math.max(0,value.total-(selection.page-1)*pageSize)))return false;
    const ids=new Set();let previous=null;
    return value.payments.every(item=>{
      if(!row(item)||ids.has(item.id)||selection.clientId!==null&&item.clientId!==selection.clientId||selection.method&&String(item.method??'').toLowerCase()!==selection.method.toLowerCase()||selection.from&&item.paidAt<selection.from+'T00:00:00.000Z'||selection.to&&item.paidAt>selection.to+'T23:59:59.999Z'||previous&&(item.paidAt>previous.paidAt||item.paidAt===previous.paidAt&&item.id>=previous.id))return false;
      ids.add(item.id);previous=item;return true;
    });
  }
  return {pageSize,positive,day,iso,filters,money,row,packet,equal};
}));
