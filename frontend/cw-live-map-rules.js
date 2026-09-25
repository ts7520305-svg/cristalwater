(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CWLiveMapRules=factory();}(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const pageSize=50,freshMs=900000,states=['RECENT','STALE','MISSING','INVALID','FUTURE'];
 const positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647,count=v=>Number.isSafeInteger(v)&&v>=0,object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
 const point=l=>l&&typeof l.latitude==='number'&&Number.isFinite(l.latitude)&&Math.abs(l.latitude)<=90&&typeof l.longitude==='number'&&Number.isFinite(l.longitude)&&Math.abs(l.longitude)<=180?[l.latitude,l.longitude]:null;
 function positionState(l,now){if(l===null)return 'MISSING';if(!point(l)||!iso(l.updatedAt)||!Number.isFinite(now))return 'INVALID';const age=now-Date.parse(l.updatedAt);return age<0?'FUTURE':age<=freshMs?'RECENT':'STALE';}
 function filters(raw={}){if(!object(raw)||Object.keys(raw).some(k=>!['q','state','page'].includes(k)))return null;const q=raw.q??'',state=raw.state??'',page=raw.page??'1';if(typeof q!=='string'||q.length>120||/[\u0000-\u001f\u007f]/.test(q)||!['',...states].includes(state)||typeof page!=='string'||!/^([1-9]\d*)$/.test(page)||Number(page)>42949673)return null;return {q:q.trim(),state,page:Number(page)};}
 function row(r,now){return object(r)&&positive(r.id)&&['TECHNICIAN','USER'].includes(r.kind)&&r.key===r.kind+':'+r.id&&(r.name===null||typeof r.name==='string')&&states.includes(r.state)&&(r.location===null||object(r.location)&&positive(r.location.id)&&['latitude','longitude'].every(k=>r.location[k]===null||typeof r.location[k]==='number'&&Number.isFinite(r.location[k]))&&iso(r.location.updatedAt))&&r.state===positionState(r.location,now);}
 const compare=(a,b)=>a.kind.localeCompare(b.kind)||a.id-b.id;
 const matches=(r,f)=>(!f.state||r.state===f.state)&&(!f.q||[r.name??'',r.key].some(v=>v.toLowerCase().includes(f.q.toLowerCase())));
 function totals(rows){const result={total:rows.length,...Object.fromEntries(states.map(s=>[s,0]))};for(const r of rows)result[r.state]++;return result;}
 function packet(v,f,owner){if(!object(v)||v.ok!==true||v.version!==1||v.owner!==owner||!iso(v.asOf)||v.freshMs!==freshMs||v.timeZone!=='UTC'||v.basis!=='LATEST_EXPLICIT_IDENTITY'||!equal(v.filters,f)||v.pageSize!==pageSize||!count(v.total)||v.total>2147483647||v.pages!==Math.max(1,Math.ceil(v.total/pageSize))||v.hasPrevious!==(f.page>1)||v.hasNext!==(f.page<v.pages)||!object(v.totals)||v.totals.total!==v.total||!states.every(s=>count(v.totals[s]))||states.reduce((n,s)=>n+v.totals[s],0)!==v.total||!Array.isArray(v.rows)||v.rows.length!==Math.min(pageSize,Math.max(0,v.total-(f.page-1)*pageSize)))return false;
  let previous=null;for(const r of v.rows){if(!row(r,Date.parse(v.asOf))||!matches(r,f)||previous&&compare(previous,r)>=0)return false;previous=r;}const part=totals(v.rows);if(states.some(s=>part[s]>v.totals[s]))return false;if(v.total<=pageSize&&f.page===1&&!equal(v.totals,part))return false;return !f.state||v.totals[f.state]===v.total;
 }
 return {pageSize,freshMs,states,positive,count,iso,point,positionState,filters,row,compare,matches,totals,packet,equal};
}));
