(function () {
  'use strict';
  function mergeReminders(local, remote, pump = false) {
    const transferred = remote.filter(row=>row.transferredAway);
    const merged = local.filter(item=>!transferred.some(row=>String(item.serverId)===String(row.id)||item.localId===row.metadata?.localId)).map(item => ({ ...item }));
    for (const row of remote) {
      if (row.isCompleted || row.transferredAway) continue;
      const meta = row.metadata || {};
      if (merged.some(item => (item.serverId && String(item.serverId) === String(row.id)) || (meta.localId && item.localId === meta.localId))) continue;
      merged.push({ ...meta, serverId: row.id, status: 'OPEN', ...(pump ? {closed:false} : {}) });
    }
    return merged;
  }
  function buildReview({ snapshot, water, pumps, outbox, drafts, photos, online, verificationErrors = [] }) {
    const items = [];
    const add = (kind, text) => items.push({ kind, text });
    const name = (id,type='REGULAR') => snapshot.visits.find(v => (v.visitType || 'REGULAR') === type && String(v.id) === String(id))?.name || `Visita ${id}`;
    if (!online || !snapshot.confirmedAt) add('unknown', 'Ronda sem confirmação atual. Ligue à rede e atualize a agenda; podem existir alterações do escritório.');
    for (const section of verificationErrors) add('unknown', `${section}: não foi possível confirmar os dados no servidor. A revisão está incompleta.`);
    for (const reminder of water) {
      if (reminder.status !== 'CLOSED') add('critical', `${reminder.poolName || name(reminder.visitId,reminder.visitType || 'REGULAR')} — água aberta. Confirme o fecho físico ou contacte o responsável.`);
      if (!reminder.serverId || reminder.syncError || (reminder.status === 'CLOSED' && !reminder.closeSyncedAt)) add('pending', `${reminder.poolName || name(reminder.visitId,reminder.visitType || 'REGULAR')} — estado da água por confirmar no servidor.`);
    }
    for (const reminder of Object.values(pumps)) {
      if (!reminder.closed) add('critical', `${reminder.poolName || name(reminder.visitId,reminder.visitType || 'REGULAR')} — bomba em manual. Confirme o regresso físico a automático ou contacte o responsável.`);
      if (!reminder.serverId || reminder.closed) add('pending', `${reminder.poolName || name(reminder.visitId,reminder.visitType || 'REGULAR')} — estado da bomba por confirmar no servidor.`);
    }
    for (const visit of snapshot.visits) {
      if (!visit.done && !visit.future && !Object.values(outbox).some(item=>String(item.visitId)===String(visit.id)&&(item.visitType || 'REGULAR')===(visit.visitType || 'REGULAR')&&item.scope!=='EXTRA_VISIT_START')) add('pending', `${visit.name} — ${visit.visitType === 'EXTRA' ? 'visita extra por concluir' : 'trabalho por concluir'}. Combine o próximo passo com o escritório.`);
    }
    for (const item of Object.values(outbox)) add('pending', `${name(item.visitId,item.visitType || 'REGULAR')} — ${item.scope === 'EXTRA_VISIT_START' ? 'início' : 'conclusão'} por confirmar no servidor${item.blocked ? '; precisa de apoio do escritório' : ''}.`);
    const photoCounts = new Map();
    for (const photo of photos) { const key=(photo.visitType || 'REGULAR')+':'+photo.visitId; photoCounts.set(key,(photoCounts.get(key)||0)+1); }
    for (const [key, count] of photoCounts) add('pending', `${name(key.split(':')[1],key.split(':')[0])} — ${count} fotografia(s) por enviar.`);
    for (const [id, draft] of Object.entries(drafts)) {
      if (draft.pendingProblems?.some(problem => !problem.synced)) add('pending', `${name(id.replace(/^visit-(?:REGULAR-)?/, ''))} — ocorrência guardada no telemóvel, por enviar.`);
    }
    return items;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { buildReview, mergeReminders };
  if (typeof document === 'undefined') return;
  const button = document.getElementById('dayReviewBtn'), result = document.getElementById('dayReviewResult');
  if (!button || !result) return;
  const owner = () => { const user = window.CristalAuth?.parseUser?.() || {}; return String(user.technicianId || user.id || 'none'); };
  function read(key, array = false) {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : (array ? [] : {});
    if (!value || typeof value !== 'object' || Array.isArray(value) !== array || Object.values(value).some(item => !item || typeof item !== 'object')) throw new Error('Dados locais ilegíveis');
    return value;
  }
  let revision = 0;
  async function serverData(token) {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const endpoints = [ ['Ronda', `/api/technician/today?date=${date}`, 'visits'], ['Água aberta', '/api/technician/water-reminders', 'reminders'], ['Bombas em manual', '/api/technician/pump-reminders', 'reminders'] ];
    return Promise.all(endpoints.map(async ([label, url, field]) => {
      try {
        const response = await fetch(url, {headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(8000)});
        const data = await response.json();
        if (!response.ok || data.ok === false || !Array.isArray(data[field])) throw new Error('Resposta incompleta');
        return {label, rows:data[field]};
      } catch (_) { return {label, error:true}; }
    }));
  }
  function invalidate() {
    ++revision;
    if (result.textContent) result.textContent = 'O estado pode ter mudado. Volte a rever as pendências antes de sair.';
    button.disabled = false;
    result.setAttribute('aria-busy', 'false');
  }
  async function review() {
    const requestedOwner = owner(), requestedRevision = ++revision, token = window.CristalAuth?.getToken?.();
    button.disabled = true; result.textContent = 'A verificar pendências neste telemóvel…';
    result.setAttribute('aria-busy', 'true');
    try {
      if (requestedOwner === 'none') throw new Error('Sem técnico identificado');
      const [photos, remote, completions] = await Promise.all([
        window.CWFieldPhotos.pendingSummary(),
        navigator.onLine && token ? serverData(token) : Promise.resolve(null),
        window.CWFieldOffline.entries(),
      ]);
      if (revision !== requestedRevision) return;
      if (owner() !== requestedOwner || token !== window.CristalAuth?.getToken?.()) { result.textContent = 'Sessão alterada. Repita a revisão com a conta atual.'; return; }
      let snapshot = window.CWFieldDaySnapshot();
      let water = window.CWFieldReminders.list('WATER_OPEN');
      let pumps = window.CWFieldReminders.list('PUMP_MANUAL').filter(row=>row.status!=='CLOSED'||!row.closeSyncedAt);
      const verificationErrors = remote ? remote.filter(section=>section.error).map(section=>section.label) : ['Lembretes críticos'];
      if (remote?.[0].rows) snapshot = {confirmedAt:new Date().toISOString(),visits:remote[0].rows.map(visit=>({id:visit.id,visitType:visit.visitType || 'REGULAR',name:visit.pool?.name || `Visita ${visit.id}`,done:Boolean(visit.endAt) || ['DONE','COMPLETED','CONCLUIDA'].includes(String(visit.status).toUpperCase())}))};
      else snapshot = {...snapshot,confirmedAt:null};
      if (remote?.[1].rows) water = mergeReminders(water, remote[1].rows);
      if (remote?.[2].rows) pumps = mergeReminders(pumps, remote[2].rows, true);
      if (window.CWFieldReminders.legacyWarning()) verificationErrors.push('Lembretes antigos por reconciliar com o escritório');
      const outbox = Object.fromEntries(completions.map(row => [row.scope+':'+row.resourceId, { visitId: row.resourceId, visitType:row.scope.startsWith('EXTRA_') ? 'EXTRA' : 'REGULAR', scope:row.scope, blocked: row.failure?.blocked }]));
      if (Object.keys(read(`cwFieldVisitDrafts:${requestedOwner}`)).length) verificationErrors.push('Rascunhos antigos sem conta/tipo de visita confirmados');
      const items = buildReview({ snapshot, water, pumps, outbox, drafts: window.CWFieldDraftSnapshot ? window.CWFieldDraftSnapshot() : {}, photos, online: navigator.onLine, verificationErrors });
      result.replaceChildren();
      const title = document.createElement('p');
      title.textContent = items.length ? 'Existem pendências antes de sair:' : 'Não foram encontradas pendências nos dados verificados. Confirme as condições físicas antes de sair.';
      result.append(title);
      for (const [kind,label] of [['critical','Atenção imediata'],['pending','Por concluir ou enviar'],['unknown','Por confirmar']]) {
        const rows = items.filter(item=>item.kind===kind);
        if (!rows.length) continue;
        const group = document.createElement('section'); group.className = `day-review-group day-review-${kind}`;
        const heading = document.createElement('h3'); heading.textContent = `${label} (${rows.length})`; group.append(heading);
        const list = document.createElement('ul');
        for (const item of rows) { const row = document.createElement('li'); row.textContent = item.text; list.append(row); }
        group.append(list); result.append(group);
      }
      const stamp = document.createElement('small');
      stamp.textContent = `Revisão: ${new Date().toLocaleTimeString('pt-PT')}. Última ronda confirmada: ${snapshot.confirmedAt ? new Date(snapshot.confirmedAt).toLocaleString('pt-PT') : 'não confirmada'}. Não limpe os dados da aplicação enquanto existirem envios pendentes.`;
      result.append(stamp);
    } catch (error) {
      if (owner() === requestedOwner && revision === requestedRevision) result.textContent = 'Não foi possível verificar todas as pendências. Não considere o dia conferido. Preserve os dados e peça apoio ao escritório.';
    } finally { if (revision === requestedRevision) { button.disabled = false; result.setAttribute('aria-busy','false'); } }
  }
  button.addEventListener('click', review);
  ['online', 'offline', 'storage', 'cw:visit-synced', 'cw:water-state-updated', 'cw:field-write-change'].forEach(event => window.addEventListener(event, invalidate));
  document.addEventListener('visibilitychange', invalidate);
  document.addEventListener('input', invalidate);
  window.setInterval(invalidate, 60000);

  const handoverPanel=document.createElement('section');
  handoverPanel.id='handoverPanel';
  handoverPanel.className='card field-panel field-panel-hoje';
  handoverPanel.setAttribute('data-cw-state-managed','manual');
  handoverPanel.innerHTML='<h2>Passar responsabilidade</h2><p>Água aberta e bomba manual: continua responsável até o colega aceitar. Combine a passagem com ele; o pedido não confirma que foi visto.</p><button type="button" class="big" id="handoverRefresh">Atualizar passagens</button><div id="handoverStatus" role="status" aria-live="polite"></div><div id="handoverList"></div>';
  document.getElementById('dayReviewCard').after(handoverPanel);
  const handoverStatus=document.getElementById('handoverStatus'),handoverList=document.getElementById('handoverList');
  let handoverRevision=0;
  async function handoverApi(path,body) {
    const response=await fetch(`/api/technician/${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${window.CristalAuth?.getToken?.()}`},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
    const data=await response.json();if(!response.ok||data.ok===false)throw new Error(data.error||'Resposta indisponível');return data;
  }
  async function loadHandovers() {
    const principal=owner(),token=window.CristalAuth?.getToken?.(),version=++handoverRevision;
    handoverList.replaceChildren();handoverStatus.textContent='A consultar passagens…';
    try {
      const [water,pump,incoming,targets]=await Promise.all(['water-reminders','pump-reminders','reminder-handovers/incoming','reminder-handovers/targets'].map(path=>handoverApi(path)));
      if(version!==handoverRevision||owner()!==principal||token!==window.CristalAuth?.getToken?.())return;
      const outgoing=[...water.reminders,...pump.reminders].filter(row=>!row.isCompleted&&!row.transferredAway);
      for(const [row,isIncoming] of [...incoming.reminders.map(row=>[row,true]),...outgoing.map(row=>[row,false])]) {
        const card=document.createElement('section');card.className='day-review-group';card.dataset.handoverReminder=row.id;
        const title=document.createElement('h3');title.textContent=row.title;card.append(title);
        const text=document.createElement('p'),proposal=row.metadata?.handover;
        text.textContent=isIncoming ? `Pedido para si: ${proposal.reason}. Só aceite se consegue assumir esta responsabilidade.` : proposal?.status==='PENDING' ? `À espera de ${proposal.toName}. Continua responsável.` : 'Escolha quem pode assumir este lembrete.';card.append(text);
        const action=document.createElement('button');action.type='button';action.className='big';
        let select,reason;
        const operation=isIncoming?'accept':proposal?.status==='PENDING'?'cancel':'request';
        if(operation==='request') {
          select=document.createElement('select');select.setAttribute('aria-label','Técnico destinatário');
          const empty=document.createElement('option');empty.value='';empty.textContent='Escolher técnico';select.append(empty);
          for(const tech of targets.technicians.filter(tech=>tech.id!==row.assignedToTechnicianId)){const option=document.createElement('option');option.value=tech.id;option.textContent=tech.name;select.append(option);}
          reason=document.createElement('textarea');reason.placeholder='Motivo da passagem';reason.setAttribute('aria-label','Motivo da passagem');reason.maxLength=1000;card.append(select,reason);
        }
        action.textContent={request:'Pedir passagem',accept:'Aceitar responsabilidade',cancel:'Cancelar pedido'}[operation];
        action.onclick=async()=>{
          if(owner()!==principal||token!==window.CristalAuth?.getToken?.())return loadHandovers();
          if(operation==='accept'&&!confirm('Confirma que consegue assumir este lembrete a partir de agora?'))return;
          action.disabled=true;
          try {
            await handoverApi(`reminder-handovers/${row.id}/${operation}`,operation==='request'?{technicianId:Number(select.value),reason:reason.value}:{handoverId:proposal.id});
            if(owner()!==principal||token!==window.CristalAuth?.getToken?.())return;
            invalidate();await window.CWPumpReminders?.sync?.();await loadHandovers();
          } catch(error){if(owner()===principal&&token===window.CristalAuth?.getToken?.()){handoverStatus.textContent=`${error.message}. Atualize a lista antes de repetir; a resposta pode ter-se perdido.`;action.disabled=false;}}
        };card.append(action);handoverList.append(card);
      }
      handoverStatus.textContent=incoming.reminders.length?`${incoming.reminders.length} pedido(s) para aceitar.`:outgoing.length?'Passagens atualizadas.':'Sem lembretes ativos ou pedidos de passagem.';
    }catch(error){if(version===handoverRevision&&owner()===principal)handoverStatus.textContent='Sem confirmação do servidor. Não considere nenhuma responsabilidade transferida; atualize com rede.';}
  }
  document.getElementById('handoverRefresh').onclick=loadHandovers;
  window.addEventListener('online',loadHandovers);
  loadHandovers();

  const receiptPanel=document.createElement('section');receiptPanel.id='visitReceiptPanel';receiptPanel.className='card field-panel field-panel-hoje';receiptPanel.setAttribute('data-cw-state-managed','manual');
  receiptPanel.innerHTML='<h2>Novas visitas atribuídas</h2><p>Confirme que recebeu o trabalho. Esta confirmação não inicia a visita e não transfere água aberta ou bombas em manual.</p><button class="big" id="receiptRefresh" type="button">Atualizar atribuições</button><p id="receiptStatus" role="status" aria-live="polite"></p><div id="receiptList"></div>';
  document.getElementById('dayReviewCard').before(receiptPanel);
  let receiptRevision=0;
  const receiptEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  async function loadReceipts(){
    const revision=++receiptRevision,token=window.CristalAuth?.getToken?.(),principal=owner(),status=document.getElementById('receiptStatus');
    status.textContent=navigator.onLine?'A verificar atribuições…':'Sem ligação. Ligue à rede para consultar e confirmar as novas atribuições.';
    if(!navigator.onLine)return;
    try{
      const response=await fetch('/api/technician/visit-receipts',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(8000)}),data=await response.json();
      if(!response.ok)throw new Error(data.error||'Falha ao consultar atribuições');
      if(revision!==receiptRevision||principal!==owner()||token!==window.CristalAuth?.getToken?.())return;
      const tomorrow=new Date();tomorrow.setHours(0,0,0,0);tomorrow.setDate(tomorrow.getDate()+1);
      const current=data.receipts.filter(row=>!row.plannedDate||new Date(row.plannedDate)<tomorrow),future=data.receipts.filter(row=>row.plannedDate&&new Date(row.plannedDate)>=tomorrow);
      const renderReceipt=row=>`<div style="padding:12px 0;overflow-wrap:anywhere"><strong>${receiptEscape(row.poolName)} · visita #${row.visitId}</strong><p>${row.plannedDate?new Date(row.plannedDate).toLocaleDateString('pt-PT'):'Data por confirmar'}</p><button class="big" type="button" data-receipt="${row.id}" style="min-height:48px;white-space:normal">Confirmar receção desta visita</button></div>`;
      document.getElementById('receiptList').innerHTML=current.map(renderReceipt).join('')+(future.length?`<details><summary style="min-height:48px;padding:12px 0">${future.length} visita(s) de dias futuros</summary>${future.map(renderReceipt).join('')}</details>`:'');
      status.textContent=data.receipts.length?`${data.receipts.length} visita(s) por confirmar.`:'Sem novas atribuições por confirmar no servidor.';
    }catch(error){if(revision===receiptRevision&&principal===owner()&&token===window.CristalAuth?.getToken?.())status.textContent=`Não foi possível atualizar: ${error.message}. Confirme as atribuições com o escritório.`;}
  }
  document.getElementById('receiptRefresh').onclick=loadReceipts;
  document.getElementById('receiptList').onclick=async event=>{
    const button=event.target.closest('[data-receipt]');if(!button||button.disabled)return;
    const token=window.CristalAuth?.getToken?.(),principal=owner(),status=document.getElementById('receiptStatus');
    if(!navigator.onLine){status.textContent='Sem ligação. A receção ainda não foi confirmada no escritório.';return;}
    button.disabled=true;
    try{
      const response=await fetch(`/api/technician/visit-receipts/${button.dataset.receipt}/acknowledge`,{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)}),data=await response.json();
      if(!response.ok)throw new Error(data.error||'Falha na confirmação');
      if(principal!==owner()||token!==window.CristalAuth?.getToken?.())return;
      await loadReceipts();if(principal!==owner()||token!==window.CristalAuth?.getToken?.())return;status.textContent='Receção confirmada no escritório. Atualize a rota para consultar o trabalho.';
    }catch(error){if(principal===owner()&&token===window.CristalAuth?.getToken?.())status.textContent=`Receção não confirmada: ${error.message}. Pode atualizar e tentar novamente.`;}
    finally{button.disabled=false;}
  };
  window.addEventListener('online',loadReceipts);window.addEventListener('offline',()=>{receiptRevision++;document.getElementById('receiptStatus').textContent='Sem ligação. As confirmações exigem ligação ao escritório.';});
  setInterval(loadReceipts,60000);loadReceipts();

  const shortagePanel=document.createElement('section');shortagePanel.id='fieldShortagePreparation';shortagePanel.className='card field-panel field-panel-hoje';shortagePanel.setAttribute('data-cw-state-managed','manual');
  shortagePanel.innerHTML='<h2>Química a preparar</h2><p>Confira as faltas reportadas antes de sair. Confirme apenas produtos que recebeu fisicamente. A receção não conclui a visita nem calcula dosagens.</p><button type="button" class="big" id="shortageRefresh" style="background:#075c4c!important;color:#fff!important;min-height:48px">Atualizar necessidades</button><p id="shortageStatus" role="status" aria-live="polite"></p><div id="shortageList"></div>';
  receiptPanel.after(shortagePanel);let shortageRevision=0,shortageIdentity=null;
  async function loadShortages(){
    const token=window.CristalAuth?.getToken?.(),principal=owner(),status=document.getElementById('shortageStatus'),identity=JSON.stringify([principal,token]);
    if(identity!==shortageIdentity){shortageIdentity=identity;shortageRevision++;document.getElementById('shortageList').replaceChildren();}
    if(shortagePanel.querySelector('form')&&arguments[0]!==true)return;
    const revision=++shortageRevision;
    if(!navigator.onLine){status.textContent='Sem rede. Confirme as necessidades com o escritório; a lista pode estar desatualizada.';return;}
    status.textContent='A consultar necessidades de reposição…';
    try{
      const response=await fetch('/api/technician/chemical-shortages',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(8000)}),data=await response.json();
      if(!response.ok)throw new Error(data.error||'Falha ao consultar necessidades');
      if(revision!==shortageRevision||principal!==owner()||token!==window.CristalAuth?.getToken?.())return;
      document.getElementById('shortageList').innerHTML=data.rows.map(row=>`<div data-shortage="${row.shortageId}" style="padding:12px 0;overflow-wrap:anywhere"><strong>${receiptEscape(row.productName)} · ${row.quantity===null?'Quantidade por confirmar':receiptEscape(row.quantity+' '+row.unit)}</strong><p>${receiptEscape(row.poolName)} · visita #${row.visitId} · ${row.plannedDate?new Date(row.plannedDate).toLocaleDateString('pt-PT'):'Data por confirmar'}</p><p>Recebido na sua viatura: ${receiptEscape(row.receivedQuantity||0)} ${receiptEscape(row.unit)}${row.quantity===null?' · Total necessário por confirmar':' · Falta receber: '+receiptEscape(Math.max(0,row.quantity-(row.receivedQuantity||0)))+' '+receiptEscape(row.unit)}</p>${row.returnedQuantity?'<p>Devolvido ao armazém: '+receiptEscape(row.returnedQuantity+' '+row.unit)+'. Os valores acima descontam as devoluções.</p>':''}${row.quantity===null||row.receivedQuantity<row.quantity?'<button type="button" class="big" style="background:#075c4c!important;color:#fff!important;min-height:48px" data-delivery-options="'+row.shortageId+'">Confirmar receção de química</button><div data-delivery-form></div>':'<p>Quantidade reportada recebida. A visita continua por resolver.</p>'}</div>`).join('');
      status.textContent=data.rows.length?`${data.rows.length} necessidade(s) reportada(s) para as suas visitas.`:'Sem faltas de química reportadas por resolver. Verifique também o stock da viatura.';
    }catch(error){if(revision===shortageRevision&&principal===owner()&&token===window.CristalAuth?.getToken?.())status.textContent=`Não foi possível atualizar: ${error.message}. Confirme com o escritório.`;}
  }
  shortagePanel.addEventListener('click',async event=>{
    const button=event.target.closest('[data-delivery-options]');if(!button)return;
    if(shortagePanel.querySelector('form')){document.getElementById('shortageStatus').textContent='Termine ou cancele a receção em aberto antes de iniciar outra.';return;}
    const id=button.dataset.deliveryOptions,container=button.parentElement.querySelector('[data-delivery-form]'),token=window.CristalAuth?.getToken?.(),principal=owner();
    if(!navigator.onLine){container.textContent='Ligue-se à rede para confirmar a receção.';return;}
    button.disabled=true;
    try{
      const response=await fetch(`/api/technician/chemical-shortages/${id}/deliveries`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(8000)}),data=await response.json();
      if(token!==window.CristalAuth?.getToken?.()||principal!==owner()||!container.isConnected)return;
      if(!response.ok)throw new Error(data.error||'Falha ao consultar entregas');
      if(!data.rows.length){container.textContent='Sem transferência correspondente registada após esta falta. Confirme com a gestão.';return;}
      if(shortagePanel.querySelector('form'))return;
      shortageRevision++;button.hidden=true;
      container.innerHTML=`<form><label>Transferência para a viatura<select name="movement" required style="min-height:48px;width:100%">${data.rows.map(m=>`<option value="${m.id}">${receiptEscape(m.available+' '+m.unit)} · ${receiptEscape(new Date(m.createdAt).toLocaleString('pt-PT'))} · #${m.id}</option>`).join('')}</select></label><p data-delivery-details></p><label>Quantidade recebida<input name="quantity" type="number" min="0.001" step="any" required inputmode="decimal" style="min-height:48px;width:100%"></label><button type="submit" class="big" style="background:#075c4c!important;color:#fff!important;min-height:48px">Recebi esta quantidade</button><button type="button" data-delivery-cancel style="min-height:48px">Cancelar</button><p role="status"></p></form>`;
      const select=container.querySelector('select');select.onchange=()=>{const movement=data.rows.find(m=>m.id===Number(select.value));container.querySelector('[data-delivery-details]').textContent='Disponível para confirmar: '+movement.available+' '+movement.unit;};select.onchange();
      container.querySelector('[data-delivery-cancel]').onclick=()=>loadShortages(true);
      container.querySelector('form').onsubmit=async e=>{
        e.preventDefault();const form=e.currentTarget,message=form.querySelector('[role=status]');
        if(token!==window.CristalAuth?.getToken?.()||principal!==owner())return;
        if(!navigator.onLine){message.textContent='Sem rede. A receção ainda não foi confirmada.';return;}
        const body={movementId:Number(form.elements.movement.value),quantity:Number(form.elements.quantity.value)},key='cwChemicalDelivery:'+JSON.stringify([principal,id,body]);
        try{body.requestId=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,body.requestId);}catch{message.textContent='Não foi possível guardar o pedido neste dispositivo. Confirme com o escritório.';return;}
        for(const control of form.elements)control.disabled=true;document.getElementById('shortageRefresh').disabled=true;
        try{const reply=await fetch(`/api/technician/chemical-shortages/${id}/deliveries`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)}),result=await reply.json();
          if(token!==window.CristalAuth?.getToken?.()||principal!==owner())return;
          if(!reply.ok)throw new Error(result.error||'Falha ao confirmar');localStorage.removeItem(key);message.textContent='Receção confirmada.';await loadShortages(true);
        }catch(error){if(token===window.CristalAuth?.getToken?.()&&principal===owner())message.textContent=error.message+' Pode repetir com os mesmos dados.';}finally{for(const control of form.elements)control.disabled=false;document.getElementById('shortageRefresh').disabled=false;}
      };
    }catch(error){if(token===window.CristalAuth?.getToken?.()&&principal===owner())container.textContent=error.message;}finally{button.disabled=false;}
  });
  document.getElementById('shortageRefresh').onclick=()=>loadShortages(true);window.addEventListener('online',loadShortages);window.addEventListener('offline',()=>{shortageRevision++;document.getElementById('shortageStatus').textContent='Sem rede. A lista anterior pode estar desatualizada.';});setInterval(loadShortages,60000);loadShortages();
})();
