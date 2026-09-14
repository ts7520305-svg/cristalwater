(function(){
 'use strict';
 const user=()=>window.CristalAuth?.parseUser?.()||{};
 function belongs(record){
  try{const token=String(record.headers?.authorization||record.headers?.Authorization||'').split(' ')[1];const claim=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));const current=user();return claim.role===current.role&&Number(claim.technicianId||claim.id)===Number(current.technicianId||current.id)}catch{return false}
 }
 async function records(){
  return new Promise((resolve,reject)=>{
   const request=indexedDB.open('cristalwater-v22-offline');
   request.onupgradeneeded=()=>request.transaction.abort();
   request.onerror=()=>resolve([]);
   request.onsuccess=async()=>{
    const db=request.result;
    try{const rows=[];for(const store of ['PayloadQueue','MediaQueue']){
     if(!db.objectStoreNames.contains(store))continue;
     const values=await new Promise((yes,no)=>{const read=db.transaction(store).objectStore(store).getAll();read.onsuccess=()=>yes(read.result);read.onerror=()=>no(read.error)});
     rows.push(...values.filter(belongs).map(value=>({...value,store})));
    }resolve(rows)}catch(error){reject(error)}finally{db.close()}
   };
  });
 }
 async function refresh(){
  const rows=await records();let banner=document.getElementById('cwFieldRecovery');
  if(!rows.length){if(banner)banner.remove();return}
  if(!banner){banner=document.createElement('aside');banner.id='cwFieldRecovery';banner.setAttribute('role','alert');banner.style.cssText='padding:16px;background:#ffe2cf;color:#562800;font-weight:700';document.body.prepend(banner)}
  banner.replaceChildren(document.createTextNode(`${rows.length} registo(s) antigo(s) aguardam recuperação. Guarde uma cópia e peça à gestão para confirmar o histórico antes de limpar os dados deste telemóvel. `));
  const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Guardar cópia dos registos';banner.append(button);
  button.onclick=async()=>{
   const entries=(await records()).map(row=>{const bytes=new Uint8Array(row.body||[]);let binary='';for(let i=0;i<bytes.length;i+=16000)binary+=String.fromCharCode(...bytes.subarray(i,i+16000));return {store:row.store,id:row.id,url:row.url,method:row.method,createdAt:row.createdAt,contentType:row.headers?.['content-type']||'',bodyBase64:btoa(binary)}});
   const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),entries},null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='cristalwater-registos-por-recuperar.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  };
 }
 window.CWFieldRecovery={refresh};refresh().catch(()=>{});
})();
