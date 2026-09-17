(function(){
 'use strict';
 const reminders=window.CWFieldReminders;
 const read=()=>reminders.list('PUMP_MANUAL').filter(row=>row.status!=='CLOSED'||!row.closeSyncedAt);
 const section=document.createElement('section');section.className='card field-panel field-panel-agora';section.id='pumpReminderCard';
 section.innerHTML='<h2>Bomba em manual</h2><p>Registe quando coloca a bomba em manual. Confirme aqui depois de a colocar novamente em automático.</p><label for="pumpReminderMinutes">Lembrar dentro de (minutos)</label><input id="pumpReminderMinutes" type="number" min="1" max="1440" value="30"><button id="pumpReminderCreate" class="big warn" type="button">Registar bomba em manual</button><p id="pumpReminderFeedback" role="status"></p>';
 document.querySelector('.water-card')?.before(section);
 const banner=document.createElement('aside');banner.id='pumpReminderBanner';banner.setAttribute('role','alert');banner.style.cssText='padding:14px;background:#ffe2cf;color:#562800;overflow-wrap:anywhere';document.body.prepend(banner);
 const feedback=message=>{document.getElementById('pumpReminderFeedback').textContent=message;};
 function render(){
  try{
   const rows=read(),warning=reminders.legacyWarning();banner.hidden=!rows.length&&!warning;banner.replaceChildren();if(warning){const p=document.createElement('p');p.textContent=warning;banner.append(p);}
   for(const item of rows){
    const row=document.createElement('div');row.dataset.pumpReminder=item.localId;row.style.cssText='padding:8px 0';
    const text=document.createElement('p');const remaining=Math.ceil((Date.parse(item.dueAt)-Date.now())/60000);
    text.textContent=`${item.poolName||'Piscina'} · ${item.technicianName||'Técnico responsável'} — ${item.closed ? 'Automático confirmado no telemóvel, envio pendente' : `Bomba em manual: ${remaining>0 ? `${remaining} min até ao lembrete` : 'confirmar agora'}`}. ${item.openedAt ? `${Math.max(0,Math.floor((Date.now()-Date.parse(item.openedAt))/60000))} min em curso. ` : ''}${item.serverId?'Registo no servidor.':'Por enviar ao servidor.'}`;
    row.append(text);
    if(!item.closed){const button=document.createElement('button');button.type='button';button.style.cssText='min-height:44px;padding:10px';button.textContent='Já coloquei em automático';button.onclick=async()=>{
     if(!confirm('Confirma que colocou fisicamente esta bomba em automático?'))return;
     try{await reminders.mark('PUMP_MANUAL',item.localId,'close');await sync();}catch(e){feedback(e.message)}
    };row.append(button);}
    banner.append(row);
   }
  }catch(e){banner.hidden=false;banner.textContent=e.message;}
 }
 async function sync(){
  try{await reminders.sync();}catch(e){feedback(e.message);}finally{render();}
 }
 document.getElementById('pumpReminderCreate').onclick=async()=>{
  try{
   const minutes=Number(document.getElementById('pumpReminderMinutes').value);
   if(!Number.isFinite(minutes)||minutes<1||minutes>1440)throw new Error('Escolha um prazo entre 1 e 1440 minutos.');
   await reminders.create('PUMP_MANUAL',{dueAt:new Date(Date.now()+minutes*60000).toISOString()});
   feedback('Registo guardado neste telemóvel. A confirmar no servidor.');await sync();
  }catch(e){feedback(e.message);}
 };
 window.CWPumpReminders={sync,render};window.addEventListener('cw:reminders-updated',render);setInterval(render,30000);render();
})();
