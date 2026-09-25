(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CWSupplierRules=value;}(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),positive=n=>Number.isInteger(n)&&n>0&&n<=2147483647,iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
 const id=v=>typeof v==='string'&&/^[1-9]\d{0,9}$/.test(v)&&positive(Number(v))?Number(v):null;
 const limits={name:200,category:100,website:2000,loginUrl:2000,username:500,password:4096,passwordHint:500,contactName:200,phone:100,email:320,address:1000,nif:100,discountNotes:3000,paymentTerms:3000,notes:5000};
 const text=(v,max)=>typeof v==='string'&&v.length<=max&&!/[\u0000]/u.test(v)&&!Array.from(v).some(c=>{const n=c.codePointAt(0);return n>=0xd800&&n<=0xdfff;});
 function href(v){if(typeof v!=='string'||!/^https?:\/\//i.test(v.trim())||/[\u0000-\u0020\u007f\\]/u.test(v.trim()))return null;try{const u=new URL(v.trim());return ['https:','http:'].includes(u.protocol)&&u.hostname&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
 function supplier(v,partial=false){
  if(!object(v)||!Object.keys(v).length||Object.keys(v).some(k=>!Object.hasOwn(limits,k)&&!['favorite','active'].includes(k)))return null;
  if(!partial&&!Object.hasOwn(v,'name'))return null;const out={};
  for(const [k,value] of Object.entries(v)){if(['favorite','active'].includes(k)){if(typeof value!=='boolean')return null;out[k]=value;continue;}if(value===null&&k!=='name'&&k!=='password'){out[k]=null;continue;}if(!text(value,limits[k]))return null;if(k==='name'&&!value.trim())return null;if(['website','loginUrl'].includes(k)&&value.trim()&&!href(value))return null;out[k]=k==='password'?value:(value.trim()||null);}
  return out;
 }
 function link(v){
  const limits={title:200,url:2000,category:100,notes:5000};if(!object(v)||Object.keys(v).some(k=>!Object.hasOwn(limits,k)&&!['supplierId','supplierVersion','favorite','active'].includes(k)))return null;
  if(!text(v.title,200)||!v.title.trim()||!text(v.url,2000)||!href(v.url))return null;
  const out={};for(const [k,value] of Object.entries(v)){if(Object.hasOwn(limits,k)){if(value!==null&&!text(value,limits[k]))return null;out[k]=value===null?null:value.trim()||null;}else if(['favorite','active'].includes(k)){if(typeof value!=='boolean')return null;out[k]=value;}}
  out.supplierId=v.supplierId===undefined||v.supplierId===null?null:v.supplierId;if(out.supplierId!==null&&!positive(out.supplierId))return null;
  if(out.supplierId!==null&&!iso(v.supplierVersion)||out.supplierId===null&&v.supplierVersion!=null)return null;
  out.supplierVersion=out.supplierId?v.supplierVersion:null;return out;
 }
 function query(v={}){if(!object(v)||Object.keys(v).some(k=>!['q','active','page','category'].includes(k)))return null;const page=v.page===undefined?1:id(v.page),active=v.active===undefined?'true':v.active,q=v.q===undefined?'':v.q,category=v.category===undefined?'':v.category;if(!page||page>1000000||!['true','false','all'].includes(active)||!text(q,200)||!text(category,100))return null;return {q:q.trim(),active,page,category:category==='ALL'?'':category.trim()};}
 const base=(p,owner)=>object(p)&&p.ok===true&&p.version===1&&p.owner===owner&&iso(p.asOf);
 function listPacket(p,owner,kind,page){const rows=p?.[kind];return Boolean(base(p,owner)&&p.page===page&&p.size===25&&Number.isSafeInteger(p.total)&&p.total>=0&&Array.isArray(rows)&&rows.length===Math.min(25,Math.max(0,p.total-(page-1)*25))&&new Set(rows.map(r=>r.id)).size===rows.length&&rows.every(r=>object(r)&&positive(r.id)&&typeof r[kind==='suppliers'?'name':'title']==='string'&&typeof r.active==='boolean'&&typeof r.favorite==='boolean'&&iso(r.updatedAt)&&!Object.hasOwn(r,'encryptedPassword')&&!Object.hasOwn(r,'password')&&(kind!=='suppliers'||typeof r.hasPassword==='boolean')));}
 function resultPacket(p,owner,kind,requestId){const r=p?.result;return Boolean(base(p,owner)&&p.kind===kind&&p.requestId===requestId&&uuid(requestId)&&['CONFIRMED','UNCONFIRMED','CANCELLED'].includes(p.status)&&(p.status==='UNCONFIRMED'?r===null:object(r)&&(p.status==='CANCELLED'?r.cancelled===true&&r.id===null:positive(r.id)&&!r.cancelled)&&positive(r.auditId)&&r.kind===kind&&r.receipt?.owner===owner&&r.receipt.requestId===requestId&&iso(r.receipt.confirmedAt)));}
 function pending(raw,owner){if(raw===null)return null;try{const p=JSON.parse(raw);return object(p)&&Object.keys(p).sort().join(',')==='kind,owner,requestId,version'&&p.version===1&&p.owner===owner&&['supplier','link'].includes(p.kind)&&uuid(p.requestId)?p:false;}catch(_){return false;}}
 return {object,positive,id,iso,uuid,text,href,limits,supplier,link,query,base,listPacket,resultPacket,pending};
}));
