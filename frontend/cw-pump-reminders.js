(function(){
 'use strict';
 const user=()=>window.CristalAuth?.parseUser?.()||{};
 const key=()=>`cwPumpReminders:${user().technicianId||user().id||'none'}`;
 const read=(name=key())=>{const rows=JSON.parse(localStorage.getItem(name)||'{}');if(!rows||Array.isArray(rows)||typeof rows!=='object')throw new Error('Não foi possível ler os lembretes. Não limpe os dados deste telemóvel.');return rows;};
 const write=(rows,name=key())=>{localStorage.setItem(name,JSON.stringify(rows));render();};
 const section=document.createElement('section');section.className='card field-panel field-panel-agora';section.id='pumpReminderCard';
 section.innerHTML='<h2>Bomba em manual</h2><p>Registe quando coloca a bomba em manual. Confirme aqui depois de a colocar novamente em automático.</p><label for="pumpReminderMinutes">Lembrar dentro de (minutos)</label><input id="pumpReminderMinutes" type="number" min="1" max="1440" value="30"><button id="pumpReminderCreate" class="big warn" type="button">Registar bomba em manual</button><p id="pumpReminderFeedback" role="status"></p>';
 document.querySelector('.water-card')?.before(section);
 const banner=document.createElement('aside');banner.id='pumpReminderBanner';banner.setAttribute('role','alert');banner.style.cssText='padding:14px;background:#ffe2cf;color:#562800';document.body.prepend(banner);
 const feedback=message=>{document.getElementById('pumpReminderFeedback').textContent=message;};
 function render(){
  try{
   const rows=Object.values(read());banner.hidden=!rows.length;banner.replaceChildren();
   for(const item of rows){
    const row=document.createElement('div');row.dataset.pumpReminder=item.localId;row.style.cssText='padding:8px 0';
    const text=document.createElement('p');const remaining=Math.ceil((Date.parse(item.dueAt)-Date.now())/60000);
    text.textContent=`${item.poolName||'Piscina'} · ${item.technicianName||'Técnico responsável'} — ${item.closed ? 'Automático confirmado no telemóvel, envio pendente' : `Bomba em manual: ${remaining>0 ? `${remaining} min até ao lembrete` : 'confirmar agora'}`}. ${item.openedAt ? `${Math.max(0,Math.floor((Date.now()-Date.parse(item.openedAt))/60000))} min em curso. ` : ''}${item.serverId?'Registo no servidor.':'Por enviar ao servidor.'}`;
    row.append(text);
    if(!item.closed){const button=document.createElement('button');button.type='button';button.style.cssText='min-height:44px;padding:10px';button.textContent='Já coloquei em automático';button.onclick=()=>{
     if(!confirm('Confirma que colocou fisicamente esta bomba em automático?'))return;
     try{const latest=read();if(latest[item.localId]){latest[item.localId].closed=true;write(latest);sync();}}catch(e){feedback(e.message)}
    };row.append(button);}
    banner.append(row);
   }
  }catch(e){banner.hidden=false;banner.textContent=e.message;}
 }
 let syncing=false;
 async function request(url,token,body){
  const response=await fetch(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok||data.ok===false||!data.reminder&&!data.reminders)throw new Error(data.error||'Envio por confirmar');return data;
 }
 async function sync(){
  if(syncing||!navigator.onLine||window.CristalAuth?.isSessionExpired?.())return;
  const ownerKey=key(),token=window.CristalAuth?.getToken?.();if(!token)return;syncing=true;
  try{
   for(const item of Object.values(read(ownerKey))){
    if(key()!==ownerKey)return;
    if(!item.serverId){const data=await request('/api/technician/pump-reminders',token,item);const rows=read(ownerKey);if(rows[item.localId]){rows[item.localId].serverId=data.reminder.id;write(rows,ownerKey);item.serverId=data.reminder.id;}}
    const latest=read(ownerKey)[item.localId];
    if(latest?.closed){await request(`/api/technician/pump-reminders/${item.serverId}/close`,token,{});const rows=read(ownerKey);delete rows[item.localId];write(rows,ownerKey);}
   }
   if(key()!==ownerKey)return;
   const data=await request('/api/technician/pump-reminders',token);const rows=read(ownerKey);
   for(const item of data.reminders){const localId=item.metadata?.localId||`server-${item.id}`;if(item.isCompleted){delete rows[localId];continue;}rows[localId]={...rows[localId],localId,serverId:item.id,visitId:item.metadata?.visitId,poolName:item.metadata?.poolName,technicianName:item.metadata?.technicianName,openedAt:item.metadata?.openedAt,dueAt:item.dueDate};}
   write(rows,ownerKey);
  }catch(e){feedback('Lembrete mantido neste telemóvel. Envio por confirmar.');}
  finally{syncing=false;render();}
 }
 document.getElementById('pumpReminderCreate').onclick=()=>{
  try{
   const visitId=JSON.parse(localStorage.getItem('cw:tech-field:ui-state:v1')||'{}').selectedVisitId;
   const minutes=Number(document.getElementById('pumpReminderMinutes').value);
   if(!Number(visitId)||!Number.isFinite(minutes)||minutes<1||minutes>1440)throw new Error('Escolha uma visita e um prazo entre 1 e 1440 minutos.');
   const rows=read();if(Object.values(rows).some(item=>String(item.visitId)===String(visitId)&&!item.closed))throw new Error('Esta visita já tem um lembrete de bomba em manual.');
   const localId=crypto.randomUUID();rows[localId]={localId,visitId:Number(visitId),technicianName:user().name,poolName:document.getElementById('nextTitle')?.textContent,dueAt:new Date(Date.now()+minutes*60000).toISOString(),openedAt:new Date().toISOString()};
   write(rows);feedback('Registo guardado neste telemóvel.');sync();
  }catch(e){feedback(e.message);}
 };
 window.CWPumpReminders={sync,render};window.addEventListener('online',sync);setInterval(()=>{render();sync();},30000);render();sync();
})();
