(function(){
  'use strict';
  const owner=()=>{const user=window.CristalAuth?.parseUser?.()||{};return String(user.technicianId||user.id||'none')};
  function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open('cw-field-media',1);request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'key'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});}
  async function change(action,value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos')[action](value);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}});}
  async function save(visitId,photo){await change('put',{key:`${owner()}:${visitId}:${photo.localId}`,owner:owner(),visitId,photo:{...photo,previewUrl:undefined,status:'pending',error:''}})}
  async function remove(visitId,localId){await change('delete',`${owner()}:${visitId}:${localId}`)}
  async function list(visitId){const db=await database();return new Promise((resolve,reject)=>{const request=db.transaction('photos').objectStore('photos').getAll();request.onsuccess=()=>{db.close();resolve(request.result.filter(row=>row.owner===owner()&&String(row.visitId)===String(visitId)).map(row=>({...row.photo,visitId:row.visitId,previewUrl:URL.createObjectURL(row.photo.file)})))};request.onerror=()=>{db.close();reject(request.error)}})}
  async function sync(visitId) {
    for(const photo of await list(visitId)) {
      try {
        const body=new FormData();body.append('type',photo.type||'AFTER');body.append('photo',photo.file,photo.fileName||'photo.jpg');
        const response=await fetch(`/api/visits/${encodeURIComponent(visitId)}/photo`,{method:'POST',body});
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!data.photo?.id)throw Object.assign(new Error(data.error||'Fotografia por sincronizar'),{status:response.status});
        await remove(visitId,photo.localId);
      } finally {URL.revokeObjectURL(photo.previewUrl);}
    }
  }
  window.CWFieldPhotos={save,remove,list,sync};
})();
