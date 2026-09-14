(function(){
  'use strict';
  const card=document.querySelector('.water-card')||document.querySelector('main')||document.body;if(!card)return;
  const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Ativar avisos no telemóvel';
  const status=document.createElement('div');status.className='muted';status.setAttribute('role','status');
  card.append(button,status);
  const request=async(method,path,body)=>{const response=await fetch('/api/push'+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Falha ao ativar avisos'),{status:response.status});return data};
  let publicKey;
  if(!window.isSecureContext||!('serviceWorker' in navigator)||!('PushManager' in window)){button.disabled=true;status.textContent='Este navegador não disponibiliza avisos com a aplicação fechada.';return;}
  button.disabled=true;
  request('GET','/public-key').then(data=>{publicKey=data.publicKey;button.disabled=!data.configured;status.textContent=data.configured?'Permita notificações para receber avisos com o ecrã bloqueado.':'Avisos com ecrã bloqueado ainda indisponíveis. Contacte a administração.'}).catch(()=>{status.textContent='Ligue-se à rede para ativar os avisos.'});
  button.onclick=async()=>{
   button.disabled=true;
   try{
    if(await Notification.requestPermission()!=='granted')throw new Error('Permissão de notificações não concedida.');
    const registration=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
    const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
    try{await request('POST','/subscriptions',subscription.toJSON())}
    catch(error){if(error.status!==409)throw error;await subscription.unsubscribe();subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});await request('POST','/subscriptions',subscription.toJSON())}
    status.textContent='Dispositivo inscrito. Confirme com a administração a receção de um aviso de teste.';
    button.textContent='Avisos ativados';
   }catch(error){status.textContent=error.message;button.disabled=false;}
  };
})();
