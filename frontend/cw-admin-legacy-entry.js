(function(root,factory){
  'use strict';
  const api=factory();if(typeof module==='object'&&module.exports){module.exports=api;return;}
  const path=root.location.pathname.replace(/\/$/,'').replace(/\.html$/,'');
  if(!api.aliases.includes(path))return;
  let target;
  try{const before=api.keys.map(k=>root.localStorage.getItem(k));target=api.destination(before,root.location.search,Date.now());if(JSON.stringify(before)!==JSON.stringify(api.keys.map(k=>root.localStorage.getItem(k))))target='/login?reason=invalid_session';}
  catch(_){target='/login?reason=guard_error';}
  // Navigation only: the destination's guard and API authentication remain authoritative.
  // Do not rewrite identity aliases, drafts, queues, receipts or unknown stored bytes here.
  const link=root.document.getElementById('legacyEntryLink');if(link)link.href=target;
  root.location.replace(target);
}(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const aliases=Object.freeze(['/admin-command-center','/admin-core-flow','/admin-operational-flow','/client-wow','/splash']);
  const keys=Object.freeze(['cristalwater_jwt','token','adminToken','cristalwater_user','user']);
  const positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647;
  function destination(values,search='',now=Date.now()){
    const query=new URLSearchParams(search),langs=query.getAll('lang'),language=langs.length===1&&['pt','en','fr','es','de'].includes(langs[0])?langs[0]:null;
    const target=(path,reason)=>path+(reason?'?reason='+reason+(language?'&lang='+language:''):language?'?lang='+language:'');
    if(!Array.isArray(values)||values.length!==keys.length)return target('/login','invalid_session');
    const tokens=values.slice(0,3).filter(Boolean),users=values.slice(3).filter(Boolean);
    if(!tokens.length||!users.length)return target('/login','no_session');
    if(tokens.some(t=>typeof t!=='string'||t!==tokens[0]))return target('/login','invalid_session');
    try{
      const parts=tokens[0].split('.');if(parts.length!==3||parts.some(p=>!p))return target('/login','invalid_token');
      const claims=JSON.parse(decodeURIComponent(Array.from(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')),c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('')));
      if(!claims||!Number.isFinite(claims.exp))return target('/login','invalid_token');
      if(claims.exp*1000<=now)return target('/login','session_expired');
      const role=String(claims.role||'').toUpperCase().trim(),principal=String(claims.principalType||'').toUpperCase();
      if(!['ADMIN','CLIENT','TECHNICIAN','TEAM_LEADER'].includes(role))return target('/login','invalid_session');
      const identity=v=>Number(role==='CLIENT'?(v.clientId||v.id):principal==='USER'||role==='ADMIN'?(v.userId||v.id):(v.technicianId||v.id)),id=identity(claims);
      if(!positive(id)||users.some(raw=>{const user=JSON.parse(raw);return !user||String(user.role||'').toUpperCase().trim()!==role||identity(user)!==id;}))return target('/login','invalid_session');
      return target(role==='ADMIN'?'/admin-master-control':role==='CLIENT'?'/client-portal':'/technician-field-mode');
    }catch(_){return target('/login','invalid_session');}
  }
  return {aliases,keys,destination};
}));
