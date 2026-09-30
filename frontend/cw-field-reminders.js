(function () {
  'use strict';
  // Only errors and warnings produced here carry trusted presentation identity.
  // Error.message, persisted syncError and legacyWarning() keep their original text.
  const reminderCopy = (() => {
    const languages = ['pt', 'en', 'fr', 'es', 'de'];
    const copy = {
  "session": [
    "A sessão mudou. Reabra a página com a conta original. Os lembretes foram preservados.",
    "The session changed. Reopen the page with the original account. Reminders were preserved.",
    "La session a changé. Rouvrez la page avec le compte d’origine. Les rappels ont été conservés.",
    "La sesión ha cambiado. Vuelva a abrir la página con la cuenta original. Los recordatorios se han conservado.",
    "Die Sitzung hat sich geändert. Öffnen Sie die Seite erneut mit dem ursprünglichen Konto. Die Erinnerungen bleiben erhalten."
  ],
  "unreadable": [
    "Lembretes ilegíveis. Preserve os dados deste telemóvel e contacte o escritório.",
    "Unreadable reminders. Keep the data on this phone and contact the office.",
    "Rappels illisibles. Conservez les données de ce téléphone et contactez le bureau.",
    "Recordatorios ilegibles. Conserve los datos de este teléfono y contacte con la oficina.",
    "Unlesbare Erinnerungen. Bewahren Sie die Daten auf diesem Telefon auf und kontaktieren Sie das Büro."
  ],
  "invalid": [
    "Lembretes inválidos. Preserve os dados deste telemóvel e contacte o escritório.",
    "Invalid reminders. Keep the data on this phone and contact the office.",
    "Rappels invalides. Conservez les données de ce téléphone et contactez le bureau.",
    "Recordatorios no válidos. Conserve los datos de este teléfono y contacte con la oficina.",
    "Ungültige Erinnerungen. Bewahren Sie die Daten auf diesem Telefon auf und kontaktieren Sie das Büro."
  ],
  "saveLocks": [
    "Este navegador não permite guardar lembretes em segurança.",
    "This browser cannot save reminders safely.",
    "Ce navigateur ne permet pas d’enregistrer les rappels en toute sécurité.",
    "Este navegador no permite guardar recordatorios de forma segura.",
    "Dieser Browser kann Erinnerungen nicht sicher speichern."
  ],
  "notSaved": [
    "A gravação do lembrete não ficou confirmada.",
    "Saving the reminder was not confirmed.",
    "L’enregistrement du rappel n’a pas été confirmé.",
    "No se ha confirmado que el recordatorio se haya guardado.",
    "Das Speichern der Erinnerung wurde nicht bestätigt."
  ],
  "context": [
    "Selecione uma visita com piscina confirmada.",
    "Select a visit with a confirmed pool.",
    "Sélectionnez une visite dont la piscine est confirmée.",
    "Seleccione una visita con una piscina confirmada.",
    "Wählen Sie einen Besuch mit bestätigtem Pool."
  ],
  "kind": [
    "Lembrete inválido.",
    "Invalid reminder.",
    "Rappel invalide.",
    "Recordatorio no válido.",
    "Ungültige Erinnerung."
  ],
  "deadline": [
    "Indique um prazo até 24 horas e uma nota até 4000 caracteres.",
    "Set a deadline within 24 hours and a note of up to 4000 characters.",
    "Indiquez un délai de 24 heures maximum et une note de 4000 caractères maximum.",
    "Indique un plazo máximo de 24 horas y una nota de hasta 4000 caracteres.",
    "Geben Sie eine Frist von höchstens 24 Stunden und eine Notiz mit höchstens 4000 Zeichen an."
  ],
  "duplicate": [
    "Esta visita já tem este lembrete ativo.",
    "This visit already has an active reminder of this kind.",
    "Cette visite a déjà un rappel actif de ce type.",
    "Esta visita ya tiene un recordatorio activo de este tipo.",
    "Für diesen Besuch gibt es bereits eine aktive Erinnerung dieser Art."
  ],
  "missing": [
    "Lembrete não encontrado. Atualize a página.",
    "Reminder not found. Refresh the page.",
    "Rappel introuvable. Actualisez la page.",
    "No se ha encontrado el recordatorio. Actualice la página.",
    "Erinnerung nicht gefunden. Aktualisieren Sie die Seite."
  ],
  "offline": [
    "Sem ligação. O lembrete permanece neste telemóvel.",
    "No connection. The reminder remains on this phone.",
    "Aucune connexion. Le rappel reste sur ce téléphone.",
    "Sin conexión. El recordatorio permanece en este teléfono.",
    "Keine Verbindung. Die Erinnerung bleibt auf diesem Telefon."
  ],
  "expired": [
    "Sessão expirada. Volte a entrar com a mesma conta.",
    "Session expired. Sign in again with the same account.",
    "Session expirée. Reconnectez-vous avec le même compte.",
    "Sesión caducada. Vuelva a entrar con la misma cuenta.",
    "Sitzung abgelaufen. Melden Sie sich erneut mit demselben Konto an."
  ],
  "server": [
    "O servidor ainda não confirmou o lembrete.",
    "The server has not confirmed the reminder yet.",
    "Le serveur n’a pas encore confirmé le rappel.",
    "El servidor aún no ha confirmado el recordatorio.",
    "Der Server hat die Erinnerung noch nicht bestätigt."
  ],
  "interrupted": [
    "Ligação interrompida. O registo continua neste telemóvel.",
    "Connection interrupted. The record remains on this phone.",
    "Connexion interrompue. L’enregistrement reste sur ce téléphone.",
    "Conexión interrumpida. El registro permanece en este teléfono.",
    "Verbindung unterbrochen. Der Eintrag bleibt auf diesem Telefon."
  ],
  "incomplete": [
    "Resposta incompleta. Conserve o lembrete original.",
    "Incomplete response. Keep the original reminder.",
    "Réponse incomplète. Conservez le rappel d’origine.",
    "Respuesta incompleta. Conserve el recordatorio original.",
    "Unvollständige Antwort. Bewahren Sie die ursprüngliche Erinnerung auf."
  ],
  "wrongVisit": [
    "A confirmação pertence a outra visita. Conserve o lembrete original.",
    "The confirmation belongs to another visit. Keep the original reminder.",
    "La confirmation concerne une autre visite. Conservez le rappel d’origine.",
    "La confirmación pertenece a otra visita. Conserve el recordatorio original.",
    "Die Bestätigung gehört zu einem anderen Besuch. Bewahren Sie die ursprüngliche Erinnerung auf."
  ],
  "wrongRequest": [
    "O servidor não confirmou o pedido original.",
    "The server did not confirm the original request.",
    "Le serveur n’a pas confirmé la demande d’origine.",
    "El servidor no ha confirmado la solicitud original.",
    "Der Server hat die ursprüngliche Anfrage nicht bestätigt."
  ],
  "stale": [
    "Estado antigo recebido. O fecho confirmado foi preservado.",
    "An older state was received. The confirmed closure was preserved.",
    "Un ancien état a été reçu. La clôture confirmée a été conservée.",
    "Se ha recibido un estado antiguo. El cierre confirmado se ha conservado.",
    "Ein älterer Status wurde empfangen. Der bestätigte Abschluss bleibt erhalten."
  ],
  "syncLocks": [
    "Este navegador não permite coordenar os lembretes. Preserve os dados.",
    "This browser cannot coordinate reminders. Keep the data.",
    "Ce navigateur ne permet pas de coordonner les rappels. Conservez les données.",
    "Este navegador no permite coordinar los recordatorios. Conserve los datos.",
    "Dieser Browser kann Erinnerungen nicht koordinieren. Bewahren Sie die Daten auf."
  ],
  "list": [
    "Lista de lembretes incompleta.",
    "Incomplete reminder list.",
    "Liste de rappels incomplète.",
    "Lista de recordatorios incompleta.",
    "Unvollständige Erinnerungsliste."
  ],
  "tampered": [
    "O pedido guardado foi alterado. Preserve os dados e peça revisão.",
    "The saved request was changed. Keep the data and ask for a review.",
    "La demande enregistrée a été modifiée. Conservez les données et demandez une vérification.",
    "La solicitud guardada ha sido modificada. Conserve los datos y solicite una revisión.",
    "Die gespeicherte Anfrage wurde geändert. Bewahren Sie die Daten auf und bitten Sie um eine Prüfung."
  ],
  "unconfirmed": [
    "A alteração ainda não ficou confirmada.",
    "The change has not been confirmed yet.",
    "La modification n’a pas encore été confirmée.",
    "El cambio aún no se ha confirmado.",
    "Die Änderung wurde noch nicht bestätigt."
  ],
  "legacy": [
    "Existem lembretes antigos neste telemóvel. Preserve os dados e confirme água/bombas com o escritório.",
    "There are older reminders on this phone. Keep the data and confirm water and pump status with the office.",
    "Ce téléphone contient d’anciens rappels. Conservez les données et confirmez l’état de l’eau et des pompes avec le bureau.",
    "Hay recordatorios antiguos en este teléfono. Conserve los datos y confirme el estado del agua y las bombas con la oficina.",
    "Auf diesem Telefon gibt es ältere Erinnerungen. Bewahren Sie die Daten auf und klären Sie den Wasser- und Pumpenstatus mit dem Büro."
  ]
};
    const specs = new WeakSet(), errors = new WeakMap();
    function value(key) { const entry = Object.freeze({ key }); specs.add(entry); return entry; }
    function format(entry, language = typeof document === 'undefined' ? 'pt' : document.documentElement?.lang || 'pt') {
      if (!specs.has(entry)) return String(entry ?? '');
      const selected = String(language).toLowerCase().split('-')[0];
      return copy[entry.key][Math.max(0, languages.indexOf(selected))];
    }
    function problem(key) { const error = Error(copy[key][0]); errors.set(error, value(key)); return error; }
    return { problem, presentation: Object.freeze({ format, error: error => errors.get(error) || String(error?.message ?? ''), legacyWarning: () => legacyWarning() ? value('legacy') : '' }) };
  })();
  const store = window.CWFieldWriteStore;
  const captured = store?.session();
  const kinds = ['WATER_OPEN', 'PUMP_MANUAL'];
  const id = value => Number.isSafeInteger(value) && value > 0;
  const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const key = captured && `cwFieldReminders:v1:${captured.owner}`;
  const endpoint = kind => `/api/technician/${kind === 'PUMP_MANUAL' ? 'pump' : 'water'}-reminders`;
  function session() { if (!captured || !store.same(captured)) throw reminderCopy.problem('session'); }
  function read() {
    session();
    let rows;
    try { rows = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) { throw reminderCopy.problem('unreadable'); }
    if (!rows || typeof rows !== 'object' || Array.isArray(rows) || Object.entries(rows).some(([key,row]) => !row || row.owner !== captured.owner || key !== `${row.kind}:${row.localId}` || !kinds.includes(row.kind) || !id(row.visitId) || !id(row.poolId) || !['REGULAR','EXTRA'].includes(row.visitType) || !validDate(row.dueAt) || !['OPEN','OVERDUE','CLOSED'].includes(row.status))) throw reminderCopy.problem('invalid');
    return rows;
  }
  async function change(operation) {
    session();
    if (!navigator.locks?.request) throw reminderCopy.problem('saveLocks');
    await navigator.locks.request(`cw-field-reminder-state:${captured.owner}`,async()=>{
    const rows = read(); operation(rows); session();
    const raw = JSON.stringify(rows); localStorage.setItem(key, raw);
    if (localStorage.getItem(key) !== raw) throw reminderCopy.problem('notSaved');
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
    if (!visit || !id(visit.id) || !id(visit.poolId) || !id(visit.clientId) || !['REGULAR','EXTRA'].includes(visit.visitType)) throw reminderCopy.problem('context');
    return visit;
  }
  async function create(kind, details) {
    if (!kinds.includes(kind)) throw reminderCopy.problem('kind');
    const visit = context();
    const openedAt = new Date().toISOString();
    const payload = {visitType:visit.visitType,visitId:visit.id,poolId:visit.poolId,clientId:visit.clientId,dueAt:details.dueAt,note:String(details.note || ''),flowState:details.flowState || 'FULL',openedAt};
    if (!validDate(payload.dueAt) || Date.parse(payload.dueAt) <= Date.now() || Date.parse(payload.dueAt) > Date.now()+86400000 || payload.note.length > 4000) throw reminderCopy.problem('deadline');
    const payloadHash = await store.hash({kind,...payload}); session();
    const localId = crypto.randomUUID(), row = {...payload,kind,localId,payload,payloadHash,owner:captured.owner,status:'OPEN',createdAt:openedAt,poolName:visit.poolName,clientName:visit.clientName,technicianId:captured.technicianId,technicianName:visit.technicianName,syncError:'Por confirmar no servidor'};
    await change(rows => {
      if (Object.values(rows).some(item=>item.kind===kind&&item.visitType===visit.visitType&&item.visitId===visit.id&&item.status!=='CLOSED')) throw reminderCopy.problem('duplicate');
      rows[`${kind}:${localId}`] = row;
    });
    return row;
  }
  async function mark(kind, localId, action) {
    await change(rows => {
      const item = rows[`${kind}:${localId}`]; if (!item) throw reminderCopy.problem('missing');
      if (item.status === 'CLOSED') return;
      item.status = action === 'close' ? 'CLOSED' : 'OVERDUE';
      item.closed = action === 'close';
      if (action === 'close') item.closedAt = new Date().toISOString();
      item.syncError = 'Por confirmar no servidor';
    });
  }
  async function request(url, body) {
    session(); if (!navigator.onLine) throw reminderCopy.problem('offline');
    if (window.CristalAuth?.isSessionExpired?.()) throw reminderCopy.problem('expired');
    const controller = new AbortController(), timer = setTimeout(()=>controller.abort(),15000);
    const check = setInterval(()=>{if(!store.same(captured))controller.abort();},200);
    try {
      const response = await fetch(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${captured.token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:controller.signal});
      const data = await response.json(); session();
      if (response.status !== 200 || data.ok !== true) throw data.error ? Error(data.error) : reminderCopy.problem('server');
      return data;
    } catch (error) {
      if (['TypeError','AbortError'].includes(error.name)) throw reminderCopy.problem('interrupted');
      throw error;
    } finally { clearTimeout(timer); clearInterval(check); }
  }
  function validateRemote(remote, kind, expected) {
    const meta=remote?.metadata;
    if (!id(remote?.id) || !id(remote.poolId) || !meta || !id(meta.visitId) || !['REGULAR','EXTRA'].includes(meta.visitType || 'REGULAR') || !validDate(remote.dueDate) || typeof remote.isCompleted !== 'boolean' || !remote.sourceKey?.startsWith(kind==='PUMP_MANUAL'?'pump:':'water:') || (!remote.transferredAway && remote.assignedToTechnicianId!==captured.technicianId)) throw reminderCopy.problem('incomplete');
    if (expected && ((expected.serverId && remote.id !== expected.serverId) || meta.visitId !== expected.visitId || (meta.visitType || 'REGULAR') !== expected.visitType || remote.poolId !== expected.poolId || remote.clientId !== expected.clientId)) throw reminderCopy.problem('wrongVisit');
    if (expected?.payload && (meta.owner!==captured.owner || meta.localId!==expected.localId || meta.payloadHash!==expected.payloadHash || remote.sourceKey!==`${kind==='PUMP_MANUAL'?'pump':'water'}:${captured.owner}:${expected.localId}` || Date.parse(remote.dueDate)!==Date.parse(expected.payload.dueAt))) throw reminderCopy.problem('wrongRequest');
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
      if(old?.closeSyncedAt&&!remote.isCompleted)throw reminderCopy.problem('stale');
      const status=remote.isCompleted?'CLOSED':old?.syncError?old.status:meta.alarmedAt?'OVERDUE':'OPEN';
      rows[`${kind}:${localId}`]={...old,owner:captured.owner,kind,localId,serverId:remote.id,visitId:meta.visitId,visitType:meta.visitType||'REGULAR',poolId:remote.poolId,clientId:remote.clientId,technicianId:remote.assignedToTechnicianId,technicianName:meta.technicianName,poolName:meta.poolName,clientName:meta.clientName,flowState:meta.flowState,note:remote.description||'',openedAt:meta.openedAt,createdAt:meta.openedAt||remote.createdAt,dueAt:remote.dueDate,status,closed:status==='CLOSED',syncError:remote.isCompleted?'':old?.syncError||'',...(remote.isCompleted?{closeSyncedAt:new Date().toISOString()}:{}),...(meta.alarmedAt?{alarmedAt:meta.alarmedAt}:{})};
    });
  }
  let syncing=false, currentSync=null, syncRequested=false;
  async function flush() {
    if (syncing || !navigator.onLine || !captured) return;
    session(); syncing=true;
    try {
      if (!navigator.locks?.request) throw reminderCopy.problem('syncLocks');
      await navigator.locks.request(`cw-field-reminders:${captured.owner}`,{ifAvailable:true},async lock=>{
        if (!lock) return;
        for (const kind of kinds) {
          try {
            const data=await request(endpoint(kind));
            if (!Array.isArray(data.reminders)) throw reminderCopy.problem('list');
            data.reminders.forEach(remote=>validateRemote(remote,kind));
            for (const remote of data.reminders) await merge(remote,kind);
          } catch (error) { session(); /* A failed refresh must not erase a pending local request. */ }
          for (const pending of list(kind)) {
            let item=pending;
            try {
              if (!item.serverId) {
                if (!item.payload || await store.hash({kind,...item.payload})!==item.payloadHash) throw reminderCopy.problem('tampered');
                const data=await request(endpoint(kind),{...item.payload,owner:captured.owner,localId:item.localId});
                validateRemote(data.reminder,kind,item); await merge(data.reminder,kind);
              }
              item=list(kind).find(row=>row.localId===pending.localId); if(!item || !item.syncError)continue;
              const action=item.status==='CLOSED'?'close':item.status==='OVERDUE'&&kind==='WATER_OPEN'?'alarm':null;
              if (action) {
                const data=await request(`${endpoint(kind)}/${item.serverId}/${action}`,{});
                const remote=validateRemote(data.reminder,kind,item);
                if (action==='close'&&!remote.isCompleted || action==='alarm'&&!remote.isCompleted&&!validDate(remote.metadata.alarmedAt)) throw reminderCopy.problem('unconfirmed');
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
    syncRequested=true;
    // A request can arrive after this pass already visited its reminder kind.
    // Drain one further pass before resolving all callers; never run in parallel.
    if (!currentSync) currentSync=(async()=>{
      do { syncRequested=false; await flush(); } while (syncRequested);
    })().finally(()=>{currentSync=null;});
    return currentSync;
  }
  window.CWFieldReminders={create,mark,list,sync,legacyWarning,context,presentation:reminderCopy.presentation};
  window.addEventListener('online',()=>sync().catch(()=>{}));
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null||['token','cristalwater_jwt','user','cristalwater_user'].includes(event.key)){window.dispatchEvent(new Event('cw:water-state-updated'));window.dispatchEvent(new Event('cw:reminders-updated'));}});
  let invalidated=false;
  setInterval(()=>{if(captured&&!store.same(captured)&&!invalidated){invalidated=true;window.dispatchEvent(new Event('cw:water-state-updated'));window.dispatchEvent(new Event('cw:reminders-updated'));}},1000);
  setInterval(()=>sync().catch(()=>{}),30000);
  sync().catch(()=>{});
})();
