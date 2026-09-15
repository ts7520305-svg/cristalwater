(function(){
  'use strict';
  const card=document.querySelector('.water-card')||document.querySelector('main')||document.body;if(!card)return;
  const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Ativar avisos no telemóvel';
  const status=document.createElement('div');status.className='muted';status.setAttribute('role','status');
  card.append(button,status);
  const tokenNow=()=>window.CristalAuth?.getToken()||localStorage.getItem('token')||'';
  const current=token=>{if(!token||token!==tokenNow())throw new Error('A sessão mudou. Ative os avisos na conta atual.');};
  const request=async(method,path,body,token=tokenNow())=>{current(token);const response=await fetch('/api/push'+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:body?JSON.stringify(body):undefined});const data=await response.json();current(token);if(!response.ok)throw Object.assign(new Error(data.error||'Falha ao ativar avisos'),{status:response.status});return data};
  let publicKey;const initialToken=tokenNow();
  if(!window.isSecureContext||!('serviceWorker' in navigator)||!('PushManager' in window)){button.disabled=true;status.textContent='Este navegador não disponibiliza avisos com a aplicação fechada.';return;}
  button.disabled=true;
  request('GET','/public-key',null,initialToken).then(data=>{current(initialToken);publicKey=data.publicKey;button.disabled=!data.configured;status.textContent=data.configured?'Permita notificações para receber avisos com o ecrã bloqueado.':'Avisos com ecrã bloqueado ainda indisponíveis. Contacte a administração.'}).catch(()=>{status.textContent=initialToken===tokenNow()?'Ligue-se à rede para ativar os avisos.':'A sessão mudou. Atualize a página para ativar os avisos.'});
  button.onclick=async()=>{
   button.disabled=true;const token=tokenNow();let subscription,submitted=false;
   try{
    current(token);
    if(await Notification.requestPermission()!=='granted')throw new Error('Permissão de notificações não concedida.');
    current(token);
    const registration=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;current(token);
    const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    subscription=await registration.pushManager.getSubscription();current(token);
    if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
    current(token);submitted=true;
    try{await request('POST','/subscriptions',subscription.toJSON(),token)}
    catch(error){current(token);if(error.status!==409)throw error;await subscription.unsubscribe();current(token);subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});current(token);await request('POST','/subscriptions',subscription.toJSON(),token)}
    status.textContent='Dispositivo inscrito. Confirme com a administração a receção de um aviso de teste.';
    button.textContent='Avisos ativados';
   }catch(error){if(token!==tokenNow()){if(submitted&&subscription)await window.CristalAuth?.retirePushSubscription(token,{endpoint:subscription.endpoint});status.textContent='A sessão mudou. Atualize a página para ativar os avisos na conta atual.';return;}status.textContent=error.message;button.disabled=false;}
  };
})();
