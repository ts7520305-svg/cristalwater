(function(){
 'use strict';
 const messages={
  pending:[
   '{count} registo(s) antigo(s) aguardam recuperação. Guarde uma cópia e peça à gestão para confirmar o histórico antes de limpar os dados deste telemóvel. ',
   '{count} old record(s) await recovery. Save a copy and ask management to confirm the history before clearing the data on this phone. ',
   '{count} ancien(s) enregistrement(s) attendent une récupération. Enregistrez une copie et demandez à la gestion de confirmer l’historique avant d’effacer les données de ce téléphone. ',
   '{count} registro(s) antiguo(s) esperan recuperación. Guarde una copia y pida a la administración que confirme el historial antes de borrar los datos de este teléfono. ',
   '{count} alte Datensätze warten auf Wiederherstellung. Speichern Sie eine Kopie und bitten Sie die Verwaltung, den Verlauf zu bestätigen, bevor Sie die Daten auf diesem Telefon löschen. '
  ],
  download:['Guardar cópia dos registos','Save a copy of the records','Enregistrer une copie des données','Guardar una copia de los registros','Kopie der Datensätze speichern']
 };
 const text=(key,count)=>messages[key][Math.max(0,['pt','en','fr','es','de'].indexOf(String(document.documentElement.lang||'pt').toLowerCase().split('-')[0]))].replace('{count}',String(count));
 // Repaint the captured count and existing controls without rereading the archive.
 let presentation=null;
 function repaint(){
  if(!presentation?.banner.isConnected)return;
  const {message,button,count}=presentation,value=text('pending',count),label=text('download');
  if(message.nodeValue!==value)message.nodeValue=value;
  if(button.textContent!==label)button.textContent=label;
 }
 window.addEventListener('cw-language-change',repaint);
 let observedLanguage=document.documentElement.lang;
 new MutationObserver(()=>{if(observedLanguage===document.documentElement.lang)return;observedLanguage=document.documentElement.lang;repaint();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
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
  if(!rows.length){if(banner)banner.remove();presentation=null;return}
  if(!banner){banner=document.createElement('aside');banner.id='cwFieldRecovery';banner.setAttribute('role','alert');banner.style.cssText='padding:16px;background:#ffe2cf;color:#562800;font-weight:700';document.body.prepend(banner)}
  banner.setAttribute('data-cw-no-i18n','');
  const message=document.createTextNode(text('pending',rows.length));banner.replaceChildren(message);
  const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=text('download');banner.append(button);
  presentation={banner,message,button,count:rows.length};
  button.onclick=async()=>{
   const entries=(await records()).map(row=>{const bytes=new Uint8Array(row.body||[]);let binary='';for(let i=0;i<bytes.length;i+=16000)binary+=String.fromCharCode(...bytes.subarray(i,i+16000));return {store:row.store,id:row.id,url:row.url,method:row.method,createdAt:row.createdAt,contentType:row.headers?.['content-type']||'',bodyBase64:btoa(binary)}});
   const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),entries},null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='cristalwater-registos-por-recuperar.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  };
 }
 window.CWFieldRecovery={refresh};refresh().catch(()=>{});
})();
