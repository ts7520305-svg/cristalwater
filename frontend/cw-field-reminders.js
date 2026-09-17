(function () {
  'use strict';
  const store = window.CWFieldWriteStore;
  const captured = store?.session();
  const kinds = ['WATER_OPEN', 'PUMP_MANUAL'];
  const id = value => Number.isSafeInteger(value) && value > 0;
  const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const key = captured && `cwFieldReminders:v1:${captured.owner}`;
  const endpoint = kind => `/api/technician/${kind === 'PUMP_MANUAL' ? 'pump' : 'water'}-reminders`;
  function session() { if (!captured || !store.same(captured)) throw Error('A sessão mudou. Reabra a página com a conta original. Os lembretes foram preservados.'); }
  function read() {
    session();
    let rows;
    try { rows = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) { throw Error('Lembretes ilegíveis. Preserve os dados deste telemóvel e contacte o escritório.'); }
    if (!rows || typeof rows !== 'object' || Array.isArray(rows) || Object.entries(rows).some(([key,row]) => !row || row.owner !== captured.owner || key !== `${row.kind}:${row.localId}` || !kinds.includes(row.kind) || !id(row.visitId) || !id(row.poolId) || !['REGULAR','EXTRA'].includes(row.visitType) || !validDate(row.dueAt) || !['OPEN','OVERDUE','CLOSED'].includes(row.status))) throw Error('Lembretes inválidos. Preserve os dados deste telemóvel e contacte o escritório.');
    return rows;
  }
  async function change(operation) {
    session();
    if (!navigator.locks?.request) throw Error('Este navegador não permite guardar lembretes em segurança.');
    await navigator.locks.request(`cw-field-reminder-state:${captured.owner}`,async()=>{
    const rows = read(); operation(rows); session();
    const raw = JSON.stringify(rows); localStorage.setItem(key, raw);
    if (localStorage.getItem(key) !== raw) throw Error('A gravação do lembrete não ficou confirmada.');
    window.dispatchEvent(new Event('cw:water-state-updated'));
    window.dispatchEvent(new Event('cw:reminders-updated'));
    });
  }
  function list(kind) { return Object.values(read()).filter(row => row.kind === kind); }
  function legacyWarning() {
    session();
    for (const name of [`cwWaterReminders:${captured.technicianId}`, `cwPumpReminders:${captured.technicianId}`, 'cwWaterReminders']) {
      const raw = localStorage.getItem(name);
      if (raw && !['[]','{}','null'].includes(raw.trim())) return 'Existem lembretes antigos neste telemóvel. Preserve os dados e confirme água/bombas com o escritório.';
    }
    return '';
  }
  function context() {
    session(); const visit = window.CWFieldVisitContext?.();
    if (!visit || !id(visit.id) || !id(visit.poolId) || !id(visit.clientId) || !['REGULAR','EXTRA'].includes(visit.visitType)) throw Error('Selecione uma visita com piscina confirmada.');
    return visit;
  }
  async function create(kind, details) {
    if (!kinds.includes(kind)) throw Error('Lembrete inválido.');
    const visit = context();
    const openedAt = new Date().toISOString();
    const payload = {visitType:visit.visitType,visitId:visit.id,poolId:visit.poolId,clientId:visit.clientId,dueAt:details.dueAt,note:String(details.note || ''),flowState:details.flowState || 'FULL',openedAt};
    if (!validDate(payload.dueAt) || Date.parse(payload.dueAt) <= Date.now() || Date.parse(payload.dueAt) > Date.now()+86400000 || payload.note.length > 4000) throw Error('Indique um prazo até 24 horas e uma nota até 4000 caracteres.');
    const payloadHash = await store.hash({kind,...payload}); session();
    const localId = crypto.randomUUID(), row = {...payload,kind,localId,payload,payloadHash,owner:captured.owner,status:'OPEN',createdAt:openedAt,poolName:visit.poolName,clientName:visit.clientName,technicianId:captured.technicianId,technicianName:visit.technicianName,syncError:'Por confirmar no servidor'};
    await change(rows => {
      if (Object.values(rows).some(item=>item.kind===kind&&item.visitType===visit.visitType&&item.visitId===visit.id&&item.status!=='CLOSED')) throw Error('Esta visita já tem este lembrete ativo.');
      rows[`${kind}:${localId}`] = row;
    });
    return row;
  }
  async function mark(kind, localId, action) {
    await change(rows => {
      const item = rows[`${kind}:${localId}`]; if (!item) throw Error('Lembrete não encontrado. Atualize a página.');
      if (item.status === 'CLOSED') return;
      item.status = action === 'close' ? 'CLOSED' : 'OVERDUE';
      item.closed = action === 'close';
      if (action === 'close') item.closedAt = new Date().toISOString();
      item.syncError = 'Por confirmar no servidor';
    });
  }
  async function request(url, body) {
    session(); if (!navigator.onLine) throw Error('Sem ligação. O lembrete permanece neste telemóvel.');
    if (window.CristalAuth?.isSessionExpired?.()) throw Error('Sessão expirada. Volte a entrar com a mesma conta.');
    const controller = new AbortController(), timer = setTimeout(()=>controller.abort(),15000);
    const check = setInterval(()=>{if(!store.same(captured))controller.abort();},200);
    try {
      const response = await fetch(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${captured.token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:controller.signal});
      const data = await response.json(); session();
      if (response.status !== 200 || data.ok !== true) throw Error(data.error || 'O servidor ainda não confirmou o lembrete.');
      return data;
    } catch (error) {
      if (['TypeError','AbortError'].includes(error.name)) throw Error('Ligação interrompida. O registo continua neste telemóvel.');
      throw error;
    } finally { clearTimeout(timer); clearInterval(check); }
  }
  function validateRemote(remote, kind, expected) {
    const meta=remote?.metadata;
    if (!id(remote?.id) || !id(remote.poolId) || !meta || !id(meta.visitId) || !['REGULAR','EXTRA'].includes(meta.visitType || 'REGULAR') || !validDate(remote.dueDate) || typeof remote.isCompleted !== 'boolean' || !remote.sourceKey?.startsWith(kind==='PUMP_MANUAL'?'pump:':'water:') || (!remote.transferredAway && remote.assignedToTechnicianId!==captured.technicianId)) throw Error('Resposta incompleta. Conserve o lembrete original.');
    if (expected && ((expected.serverId && remote.id !== expected.serverId) || meta.visitId !== expected.visitId || (meta.visitType || 'REGULAR') !== expected.visitType || remote.poolId !== expected.poolId || remote.clientId !== expected.clientId)) throw Error('A confirmação pertence a outra visita. Conserve o lembrete original.');
    if (expected?.payload && (meta.owner!==captured.owner || meta.localId!==expected.localId || meta.payloadHash!==expected.payloadHash || remote.sourceKey!==`${kind==='PUMP_MANUAL'?'pump':'water'}:${captured.owner}:${expected.localId}` || Date.parse(remote.dueDate)!==Date.parse(expected.payload.dueAt))) throw Error('O servidor não confirmou o pedido original.');
    return remote;
  }
  async function merge(remote, kind) {
    validateRemote(remote,kind);
    await change(rows => {
      const meta=remote.metadata;
      const old=Object.values(rows).find(item=>item.kind===kind&&(item.serverId===remote.id || (meta.owner===captured.owner&&item.localId===meta.localId)));
      if (remote.transferredAway) { if(old)delete rows[`${kind}:${old.localId}`]; return; }
      if (old) validateRemote(remote,kind,old);
      const localId=old?.localId || `server-${remote.id}`;
      if(old?.closeSyncedAt&&!remote.isCompleted)throw Error('Estado antigo recebido. O fecho confirmado foi preservado.');
      const status=remote.isCompleted?'CLOSED':old?.syncError?old.status:meta.alarmedAt?'OVERDUE':'OPEN';
      rows[`${kind}:${localId}`]={...old,owner:captured.owner,kind,localId,serverId:remote.id,visitId:meta.visitId,visitType:meta.visitType||'REGULAR',poolId:remote.poolId,clientId:remote.clientId,technicianId:remote.assignedToTechnicianId,technicianName:meta.technicianName,poolName:meta.poolName,clientName:meta.clientName,flowState:meta.flowState,note:remote.description||'',openedAt:meta.openedAt,createdAt:meta.openedAt||remote.createdAt,dueAt:remote.dueDate,status,closed:status==='CLOSED',syncError:remote.isCompleted?'':old?.syncError||'',...(remote.isCompleted?{closeSyncedAt:new Date().toISOString()}:{}),...(meta.alarmedAt?{alarmedAt:meta.alarmedAt}:{})};
    });
  }
  let syncing=false, currentSync=null;
  async function flush() {
    if (syncing || !navigator.onLine || !captured) return;
    session(); syncing=true;
    try {
      if (!navigator.locks?.request) throw Error('Este navegador não permite coordenar os lembretes. Preserve os dados.');
      await navigator.locks.request(`cw-field-reminders:${captured.owner}`,{ifAvailable:true},async lock=>{
        if (!lock) return;
        for (const kind of kinds) {
          try {
            const data=await request(endpoint(kind));
            if (!Array.isArray(data.reminders)) throw Error('Lista de lembretes incompleta.');
            data.reminders.forEach(remote=>validateRemote(remote,kind));
            for (const remote of data.reminders) await merge(remote,kind);
          } catch (error) { session(); /* A failed refresh must not erase a pending local request. */ }
          for (const pending of list(kind)) {
            let item=pending;
            try {
              if (!item.serverId) {
                if (!item.payload || await store.hash({kind,...item.payload})!==item.payloadHash) throw Error('O pedido guardado foi alterado. Preserve os dados e peça revisão.');
                const data=await request(endpoint(kind),{...item.payload,owner:captured.owner,localId:item.localId});
                validateRemote(data.reminder,kind,item); await merge(data.reminder,kind);
              }
              item=list(kind).find(row=>row.localId===pending.localId); if(!item || !item.syncError)continue;
              const action=item.status==='CLOSED'?'close':item.status==='OVERDUE'&&kind==='WATER_OPEN'?'alarm':null;
              if (action) {
                const data=await request(`${endpoint(kind)}/${item.serverId}/${action}`,{});
                const remote=validateRemote(data.reminder,kind,item);
                if (action==='close'&&!remote.isCompleted || action==='alarm'&&!remote.isCompleted&&!validDate(remote.metadata.alarmedAt)) throw Error('A alteração ainda não ficou confirmada.');
                await merge(remote,kind);
              }
              await change(rows=>{const current=rows[`${kind}:${item.localId}`];if(current&&current.status===item.status){current.syncError='';if(current.status==='CLOSED')current.closeSyncedAt=new Date().toISOString();}});
            } catch (error) {
              session(); await change(rows=>{const current=rows[`${kind}:${pending.localId}`];if(current)current.syncError=error.message;});
            }
          }
        }
      });
    } finally { syncing=false; }
  }
  function sync() {
    if (!currentSync) currentSync=flush().finally(()=>{currentSync=null;});
    return currentSync;
  }
  window.CWFieldReminders={create,mark,list,sync,legacyWarning,context};
  window.addEventListener('online',()=>sync().catch(()=>{}));
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null||['token','cristalwater_jwt','user','cristalwater_user'].includes(event.key)){window.dispatchEvent(new Event('cw:water-state-updated'));window.dispatchEvent(new Event('cw:reminders-updated'));}});
  let invalidated=false;
  setInterval(()=>{if(captured&&!store.same(captured)&&!invalidated){invalidated=true;window.dispatchEvent(new Event('cw:water-state-updated'));window.dispatchEvent(new Event('cw:reminders-updated'));}},1000);
  setInterval(()=>sync().catch(()=>{}),30000);
  sync().catch(()=>{});
})();
