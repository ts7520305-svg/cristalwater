(function(){
  'use strict';
  const card=document.querySelector('.water-card')||document.querySelector('main')||document.body;if(!card)return;
  const button=document.createElement('button');button.type='button';button.className='btn';
  const status=document.createElement('div');status.className='muted';status.setAttribute('role','status');
  card.append(button,status);
  // Presentation ownership is separate from raw errors and subscription/session logic.
  const copy={"enable":["Ativar avisos no telemóvel","Enable phone alerts","Activer les alertes sur le téléphone","Activar avisos en el móvil","Handy-Hinweise aktivieren"],"enabled":["Avisos ativados","Alerts enabled","Alertes activées","Avisos activados","Hinweise aktiviert"],"unsupported":["Este navegador não disponibiliza avisos com a aplicação fechada.","This browser does not support alerts while the application is closed.","Ce navigateur ne permet pas les alertes lorsque l’application est fermée.","Este navegador no permite avisos con la aplicación cerrada.","Dieser Browser unterstützt keine Hinweise bei geschlossener Anwendung."],"permissionHint":["Permita notificações para receber avisos com o ecrã bloqueado.","Allow notifications to receive alerts while the screen is locked.","Autorisez les notifications pour recevoir des alertes lorsque l’écran est verrouillé.","Permite las notificaciones para recibir avisos con la pantalla bloqueada.","Erlauben Sie Benachrichtigungen, um Hinweise bei gesperrtem Bildschirm zu erhalten."],"unconfigured":["Avisos com ecrã bloqueado ainda indisponíveis. Contacte a administração.","Alerts with the screen locked are not available yet. Contact the administrator.","Les alertes avec l’écran verrouillé ne sont pas encore disponibles. Contactez l’administration.","Los avisos con la pantalla bloqueada aún no están disponibles. Contacta con la administración.","Hinweise bei gesperrtem Bildschirm sind noch nicht verfügbar. Wenden Sie sich an die Verwaltung."],"network":["Ligue-se à rede para ativar os avisos.","Connect to the network to enable alerts.","Connectez-vous au réseau pour activer les alertes.","Conéctate a la red para activar los avisos.","Verbinden Sie sich mit dem Netzwerk, um Hinweise zu aktivieren."],"permissionDenied":["Permissão de notificações não concedida.","Notification permission was not granted.","L’autorisation des notifications n’a pas été accordée.","No se ha concedido permiso para las notificaciones.","Die Berechtigung für Benachrichtigungen wurde nicht erteilt."],"failure":["Falha ao ativar avisos","Failed to enable alerts","Échec de l’activation des alertes","Error al activar los avisos","Hinweise konnten nicht aktiviert werden"],"registered":["Dispositivo inscrito. Confirme com a administração a receção de um aviso de teste.","Device registered. Confirm receipt of a test alert with the administrator.","Appareil inscrit. Confirmez avec l’administration la réception d’une alerte de test.","Dispositivo registrado. Confirma con la administración la recepción de un aviso de prueba.","Gerät registriert. Bestätigen Sie mit der Verwaltung den Empfang eines Testhinweises."],"initialSession":["A sessão mudou. Atualize a página para ativar os avisos.","The session changed. Refresh the page to enable alerts.","La session a changé. Actualisez la page pour activer les alertes.","La sesión ha cambiado. Actualiza la página para activar los avisos.","Die Sitzung hat sich geändert. Laden Sie die Seite neu, um Hinweise zu aktivieren."],"currentSession":["A sessão mudou. Ative os avisos na conta atual.","The session changed. Enable alerts in the current account.","La session a changé. Activez les alertes dans le compte actuel.","La sesión ha cambiado. Activa los avisos en la cuenta actual.","Die Sitzung hat sich geändert. Aktivieren Sie Hinweise im aktuellen Konto."],"changedSession":["A sessão mudou. Atualize a página para ativar os avisos na conta atual.","The session changed. Refresh the page to enable alerts in the current account.","La session a changé. Actualisez la page pour activer les alertes dans le compte actuel.","La sesión ha cambiado. Actualiza la página para activar los avisos en la cuenta actual.","Die Sitzung hat sich geändert. Laden Sie die Seite neu, um Hinweise im aktuellen Konto zu aktivieren."]};
  const languages=['pt','en','fr','es','de'], ownedErrors=new WeakMap(), leaves=new Map();
  const language=()=>{const value=(document.documentElement.lang||'pt').toLowerCase().split('-')[0];return Math.max(0,languages.indexOf(value));};
  const paint=(node,entry)=>{node.textContent=copy[entry][language()];leaves.set(node,{entry,child:node.firstChild,text:node.textContent});};
  const literal=(node,value)=>{leaves.delete(node);node.textContent=value;};
  const repaint=()=>{for(const [node,leaf] of leaves){if(!node.isConnected||node.firstChild!==leaf.child||node.textContent!==leaf.text){leaves.delete(node);continue;}paint(node,leaf.entry);}};
  const ownError=entry=>{const error=new Error(copy[entry][0]);ownedErrors.set(error,entry);return error;};
  window.addEventListener('cw-language-change',repaint);
  new MutationObserver(repaint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  paint(button,'enable');

  const tokenNow=()=>window.CristalAuth?.getToken()||localStorage.getItem('token')||'';
  const current=token=>{if(!token||token!==tokenNow())throw ownError('currentSession');};
  const request=async(method,path,body,token=tokenNow())=>{current(token);const response=await fetch('/api/push'+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:body?JSON.stringify(body):undefined});const data=await response.json();current(token);if(!response.ok)throw Object.assign(data.error?new Error(data.error):ownError('failure'),{status:response.status});return data};
  let publicKey;const initialToken=tokenNow();
  if(!window.isSecureContext||!('serviceWorker' in navigator)||!('PushManager' in window)){button.disabled=true;paint(status,'unsupported');return;}
  button.disabled=true;
  request('GET','/public-key',null,initialToken).then(data=>{current(initialToken);publicKey=data.publicKey;button.disabled=!data.configured;paint(status,data.configured?'permissionHint':'unconfigured')}).catch(()=>{paint(status,initialToken===tokenNow()?'network':'initialSession')});
  button.onclick=async()=>{
   button.disabled=true;const token=tokenNow();let subscription,submitted=false;
   try{
    current(token);
    if(await Notification.requestPermission()!=='granted')throw ownError('permissionDenied');
    current(token);
    const registration=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;current(token);
    const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    subscription=await registration.pushManager.getSubscription();current(token);
    if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
    current(token);submitted=true;
    try{await request('POST','/subscriptions',subscription.toJSON(),token)}
    catch(error){current(token);if(error.status!==409)throw error;await subscription.unsubscribe();current(token);subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});current(token);await request('POST','/subscriptions',subscription.toJSON(),token)}
    paint(status,'registered');
    paint(button,'enabled');
   }catch(error){if(token!==tokenNow()){if(submitted&&subscription)await window.CristalAuth?.retirePushSubscription(token,{endpoint:subscription.endpoint});paint(status,'changedSession');return;}const entry=ownedErrors.get(error);if(entry)paint(status,entry);else literal(status,error.message);button.disabled=false;}
  };
})();
