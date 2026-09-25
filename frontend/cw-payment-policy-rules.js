(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.CWPaymentPolicyRules=factory();}(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const portalKey='PAYMENT_REMINDERS_ENABLED',legacyKeys=['payment_reminder_policy','payment_reminder_default_whatsapp','payment_reminder_default_email','payment_reminder_default_internal'];
 const positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647,iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
 const runtimeEnabled=raw=>raw!=null&&raw!==''&&['true','1','yes','sim','on'].includes(raw.toLowerCase());
 function recognized(key,raw){if(raw===null)return true;if(key===portalKey)return ['true','1','yes','sim','on','false','0','no','nao','não','off',''].includes(raw.toLowerCase());if(key===legacyKeys[0])return ['OVERDUE_ONLY','ALL_CLIENTS','DISABLED'].includes(raw);return ['true','false'].includes(raw);}
 function record(r,key){return !!r&&r.key===key&&['MISSING','SAVED'].includes(r.source)&&(r.source==='MISSING'?r.raw===null&&r.updatedAt===null:typeof r.raw==='string'&&iso(r.updatedAt))&&r.recognized===recognized(key,r.raw);}
 function packet(v,owner){return !!v&&v.ok===true&&v.version===1&&v.owner===owner&&iso(v.asOf)&&v.timeZone==='UTC'&&v.readOnly===true&&v.legacyApplied===false&&v.portal?.defaultEnabled===false&&record(v.portal.setting,portalKey)&&v.portal.enabled===runtimeEnabled(v.portal.setting.raw)&&Array.isArray(v.legacy)&&v.legacy.length===4&&v.legacy.every((r,i)=>record(r,legacyKeys[i]));}
 return {portalKey,legacyKeys,positive,iso,runtimeEnabled,recognized,record,packet};
}));
