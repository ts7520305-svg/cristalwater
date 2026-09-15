(function(root){
 'use strict';
 const CACHE='cw-push-session-v1',KEY='/__cw_push_session__';
 let pending=Promise.resolve();
 async function read(){
  try{
   const response=await (await root.caches.open(CACHE)).match(KEY);if(!response)return {known:false};
   const state=await response.json();
   if(state?.known===true&&(state.owner===null||/^[A-Z_]+:[1-9]\d*$/.test(state.owner)))return state;
  }catch(_){}
  return {known:false};
 }
 function sync(ownerFromCurrentSession){
  pending=pending.catch(()=>{}).then(async()=>{
   let cache;
   try{
    cache=await root.caches.open(CACHE);
    const state={known:true,owner:ownerFromCurrentSession()||null};
    await cache.put(KEY,new Response(JSON.stringify(state),{headers:{'Content-Type':'application/json'}}));
    return state;
   }catch(error){
    // Prefer an unknown identity and generic content to retaining a stale identity.
    if(cache)await cache.delete(KEY).catch(()=>{});
    throw error;
   }
  });
  return pending;
 }
 function presentation(data,state){
  if(state?.known&&(!state.owner||(data.owner&&data.owner!==state.owner)))return null;
  if(state?.known&&state.owner&&data.owner===state.owner)return {title:data.title||'Cristal Water',body:data.body||'Tem um aviso operacional.'};
  return {title:'Cristal Water — aviso operacional',body:'Abra a aplicação para verificar os avisos da sua conta.'};
 }
 const api={read,sync,presentation};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.CWPushSession=api;
})(globalThis);
