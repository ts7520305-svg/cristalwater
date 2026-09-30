(function(){
 'use strict';
 const pumpCopy = (() => {
  const languages = ['pt', 'en', 'fr', 'es', 'de'];
  const copy = {
  title: ['Bomba em manual', 'Pump in manual mode', 'Pompe en mode manuel', 'Bomba en modo manual', 'Pumpe im Handbetrieb'],
  intro: ['Registe quando coloca a bomba em manual. Confirme aqui depois de a colocar novamente em automático.', 'Record when you switch the pump to manual mode. Confirm here after switching it back to automatic.', 'Enregistrez le passage de la pompe en mode manuel. Confirmez ici après l’avoir remise en mode automatique.', 'Registre cuándo pone la bomba en modo manual. Confirme aquí después de volver a ponerla en automático.', 'Erfassen Sie, wenn Sie die Pumpe auf Handbetrieb umstellen. Bestätigen Sie hier, nachdem Sie sie wieder auf Automatik gestellt haben.'],
  minutes: ['Lembrar dentro de (minutos)', 'Remind me in (minutes)', 'Me rappeler dans (minutes)', 'Recordar dentro de (minutos)', 'Erinnern in (Minuten)'],
  create: ['Registar bomba em manual', 'Record pump in manual mode', 'Enregistrer la pompe en mode manuel', 'Registrar bomba en modo manual', 'Pumpe im Handbetrieb erfassen'],
  close: ['Já coloquei em automático', 'I have switched it back to automatic', 'Je l’ai remise en mode automatique', 'Ya la he puesto en automático', 'Ich habe sie wieder auf Automatik gestellt'],
  confirm: ['Confirma que colocou fisicamente esta bomba em automático?', 'Do you confirm that you physically switched this pump back to automatic mode?', 'Confirmez-vous avoir physiquement remis cette pompe en mode automatique ?', '¿Confirma que ha puesto físicamente esta bomba en modo automático?', 'Bestätigen Sie, dass Sie diese Pumpe vor Ort wieder auf Automatik gestellt haben?'],
  invalid: ['Escolha um prazo entre 1 e 1440 minutos.', 'Choose a time between 1 and 1440 minutes.', 'Choisissez un délai entre 1 et 1440 minutes.', 'Elija un plazo entre 1 y 1440 minutos.', 'Wählen Sie einen Zeitraum zwischen 1 und 1440 Minuten.'],
  saved: ['Registo guardado neste telemóvel. A confirmar no servidor.', 'Record saved on this phone. Awaiting server confirmation.', 'Enregistrement conservé sur ce téléphone. En attente de confirmation du serveur.', 'Registro guardado en este teléfono. Pendiente de confirmación del servidor.', 'Eintrag auf diesem Telefon gespeichert. Serverbestätigung ausstehend.'],
  pool: ['Piscina', 'Pool', 'Piscine', 'Piscina', 'Pool'],
  technician: ['Técnico responsável', 'Responsible technician', 'Technicien responsable', 'Técnico responsable', 'Zuständiger Techniker'],
  pending: ['Por enviar ao servidor.', 'Awaiting upload to the server.', 'En attente d’envoi au serveur.', 'Pendiente de envío al servidor.', 'Übermittlung an den Server ausstehend.'],
  recorded: ['Registo no servidor.', 'Recorded on the server.', 'Enregistré sur le serveur.', 'Registrado en el servidor.', 'Auf dem Server erfasst.'],
  automatic: ['Automático confirmado no telemóvel, envio pendente', 'Automatic mode confirmed on the phone, upload pending', 'Mode automatique confirmé sur le téléphone, envoi en attente', 'Modo automático confirmado en el teléfono, envío pendiente', 'Automatik auf dem Telefon bestätigt, Übermittlung ausstehend'],
  manual: ['Bomba em manual: ', 'Pump in manual mode: ', 'Pompe en mode manuel : ', 'Bomba en modo manual: ', 'Pumpe im Handbetrieb: '],
  due: [' min até ao lembrete', ' min until the reminder', ' min avant le rappel', ' min hasta el recordatorio', ' Min. bis zur Erinnerung'],
  now: ['confirmar agora', 'confirm now', 'confirmer maintenant', 'confirmar ahora', 'jetzt bestätigen'],
  elapsed: [' min em curso. ', ' min elapsed. ', ' min écoulées. ', ' min transcurridos. ', ' Min. vergangen. ']
  };
  copy.manual = copy.manual.map(text => text + '{when}');
  copy.due = copy.due.map(text => '{minutes}' + text);
  copy.elapsed = copy.elapsed.map(text => '{minutes}' + text);
  copy.row = languages.map(() => '{pool} · {technician} — {state}. {elapsed}{delivery}');
  const specs = new WeakSet(), errors = new WeakMap(), presentations = new Map();
  function value(key, params = {}) { const entry = Object.freeze({ key, params: Object.freeze({ ...params }) }); specs.add(entry); return entry; }
  function format(entry) {
   if (!specs.has(entry)) return reminders.presentation?.format(entry) ?? String(entry ?? '');
   const language = (document.documentElement?.lang || 'pt').toLowerCase().split('-')[0], index = Math.max(0, languages.indexOf(language));
   return copy[entry.key][index].replace(/\{(\w+)\}/g, (_, key) => format(entry.params[key]));
  }
  function bind(node, entry) { if (!node) return; const rendered = format(entry); presentations.set(node, { entry, rendered }); if (node.textContent !== rendered) node.textContent = rendered; }
  function clear(node) { for (const bound of presentations.keys()) if (bound === node || node.contains(bound)) presentations.delete(bound); }
  function literal(node, text) { clear(node); node.textContent = text; }
  function paint() {
   for (const [node, item] of presentations) {
    if (node.isConnected === false || node.textContent !== item.rendered) { presentations.delete(node); continue; }
    const rendered = format(item.entry); if (node.textContent !== rendered) node.textContent = rendered; item.rendered = rendered;
   }
  }
  window.addEventListener('cw-language-change', paint);
  let lastLanguage = document.documentElement?.lang || 'pt';
  if (document.documentElement && typeof MutationObserver === 'function') new MutationObserver(() => { const language = document.documentElement.lang; if (language !== lastLanguage) { lastLanguage = language; paint(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  return { value, format, bind, clear, literal, problem: key => { const error = Error(copy[key][0]); errors.set(error, value(key)); return error; }, error: (node, error) => { const entry = errors.get(error); if (entry) bind(node, entry); else if (reminders.presentation) bind(node, reminders.presentation.error(error)); else literal(node, error.message); } };
 })();
 const reminders=window.CWFieldReminders;
 const read=()=>reminders.list('PUMP_MANUAL').filter(row=>row.status!=='CLOSED'||!row.closeSyncedAt);
 const section=document.createElement('section');section.className='card field-panel field-panel-agora';section.id='pumpReminderCard';section.setAttribute('data-cw-no-i18n','');
 section.innerHTML='<h2 data-cw-pump-text="title">Bomba em manual</h2><p data-cw-pump-text="intro">Registe quando coloca a bomba em manual. Confirme aqui depois de a colocar novamente em automático.</p><label data-cw-pump-text="minutes" for="pumpReminderMinutes">Lembrar dentro de (minutos)</label><input id="pumpReminderMinutes" type="number" min="1" max="1440" value="30"><button data-cw-pump-text="create" id="pumpReminderCreate" class="big warn" type="button">Registar bomba em manual</button><p id="pumpReminderFeedback" role="status"></p>';
 document.querySelector('.water-card')?.before(section);
 for(const node of section.querySelectorAll('[data-cw-pump-text]'))pumpCopy.bind(node,pumpCopy.value(node.dataset.cwPumpText));
 const banner=document.createElement('aside');banner.id='pumpReminderBanner';banner.setAttribute('data-cw-no-i18n','');banner.setAttribute('role','alert');banner.style.cssText='padding:14px;background:#ffe2cf;color:#562800;overflow-wrap:anywhere';document.body.prepend(banner);
 const feedbackError=error=>pumpCopy.error(document.getElementById('pumpReminderFeedback'),error);
 const feedbackCopy=key=>pumpCopy.bind(document.getElementById('pumpReminderFeedback'),pumpCopy.value(key));
 function render(){
  try{
   const rows=read(),warning=reminders.presentation?.legacyWarning() ?? reminders.legacyWarning();banner.hidden=!rows.length&&!warning;pumpCopy.clear(banner);banner.replaceChildren();if(warning){const p=document.createElement('p');pumpCopy.bind(p,warning);banner.append(p);}
   for(const item of rows){
    const row=document.createElement('div');row.dataset.pumpReminder=item.localId;row.style.cssText='padding:8px 0';
    const text=document.createElement('p');const remaining=Math.ceil((Date.parse(item.dueAt)-Date.now())/60000);
    pumpCopy.bind(text,pumpCopy.value('row',{pool:item.poolName||pumpCopy.value('pool'),technician:item.technicianName||pumpCopy.value('technician'),state:item.closed?pumpCopy.value('automatic'):pumpCopy.value('manual',{when:remaining>0?pumpCopy.value('due',{minutes:remaining}):pumpCopy.value('now')}),elapsed:item.openedAt?pumpCopy.value('elapsed',{minutes:Math.max(0,Math.floor((Date.now()-Date.parse(item.openedAt))/60000))}):'',delivery:pumpCopy.value(item.serverId?'recorded':'pending')}));
    row.append(text);
    if(!item.closed){const button=document.createElement('button');button.type='button';button.style.cssText='min-height:44px;padding:10px';pumpCopy.bind(button,pumpCopy.value('close'));button.onclick=async()=>{
     if(!confirm(pumpCopy.format(pumpCopy.value('confirm'))))return;
     try{await reminders.mark('PUMP_MANUAL',item.localId,'close');await sync();}catch(e){feedbackError(e)}
    };row.append(button);}
    banner.append(row);
   }
  }catch(e){banner.hidden=false;pumpCopy.clear(banner);pumpCopy.error(banner,e);}
 }
 async function sync(){
  try{await reminders.sync();}catch(e){feedbackError(e);}finally{render();}
 }
 document.getElementById('pumpReminderCreate').onclick=async()=>{
  try{
   const minutes=Number(document.getElementById('pumpReminderMinutes').value);
   if(!Number.isFinite(minutes)||minutes<1||minutes>1440)throw pumpCopy.problem('invalid');
   await reminders.create('PUMP_MANUAL',{dueAt:new Date(Date.now()+minutes*60000).toISOString()});
   feedbackCopy('saved');await sync();
  }catch(e){feedbackError(e);}
 };
 window.CWPumpReminders={sync,render};window.addEventListener('cw:reminders-updated',render);setInterval(render,30000);render();
})();
