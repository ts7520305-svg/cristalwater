(function () {
  'use strict';
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const scopes = ['VISIT_PHOTO', 'VISIT_COMPLETION', 'TECHNICIAN_ALERT', 'FIELD_STOCK_REQUEST', 'FIELD_PROBLEM_REPORT', 'FIELD_CLIENT_INTAKE', 'FIELD_CLIENT_APPROVAL', 'EXTRA_VISIT_START', 'EXTRA_VISIT_PHOTO', 'EXTRA_VISIT_COMPLETION', 'EXTRA_VISIT_CORRECTION', 'EQUIPMENT_MAINTENANCE', 'VISIT_INCOMPLETE', 'VISIT_RETURN'];
  const photoScope = scope => ['VISIT_PHOTO','EXTRA_VISIT_PHOTO'].includes(scope);
  const extraScope = scope => scope.startsWith('EXTRA_VISIT_');
  const id = value => Number.isSafeInteger(value) && value > 0;
  const workInstant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  const workTime = value => value && Object.keys(value).length === 2 && workInstant(value.startAt) && workInstant(value.endAt) && Date.parse(value.endAt) > Date.parse(value.startAt);
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
  const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(value => value.toString(16).padStart(2, '0')).join('');
  const hash = value => digest(new TextEncoder().encode(JSON.stringify(canonical(value))));
  const envelope = record => ({ v: 1, scope: record.scope, resourceId: record.resourceId, payload: record.payload });
  function session(admin = false) {
    try {
      const token = window.CristalAuth?.getToken?.();
      if (!token || (localStorage.getItem('token') && localStorage.getItem('token') !== token)) return null;
      const claim = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))), technicianId = Number(claim.technicianId || claim.id), userId = Number(claim.userId || claim.id);
      if(admin===true){if(claim.role!=='ADMIN'||!id(userId))return null;return {token,userId,owner:`ADMIN:${userId}`,admin:true};}
      if (!['TECHNICIAN', 'TEAM_LEADER'].includes(claim.role) || !id(technicianId) || (claim.principalType === 'USER' && !id(userId))) return null;
      return { token, technicianId, owner: claim.principalType === 'USER' ? `USER:${userId}:TECH:${technicianId}` : `TECH:${technicianId}` };
    } catch (_) { return null; }
  }
  function same(captured) { const current = session(captured?.admin === true); return !!captured && current?.owner === captured.owner && current?.token === captured.token; }
  function requireSession(captured) { if (!same(captured)) throw Error('A sessão mudou. Reabra a página com a conta original; os envios foram preservados.'); }
  const key = record => `${record.owner}:${record.requestId}`;
  function database() { return new Promise((resolve, reject) => { const request = indexedDB.open('cw-field-writes', 1); request.onupgradeneeded = () => request.result.createObjectStore('requests', { keyPath: 'key' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onblocked = () => reject(Error('Feche as outras janelas para recuperar os envios.')); }); }
  async function transaction(mode, operation) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('requests', mode), store = tx.objectStore('requests'); let result, failure;
      tx.oncomplete = () => { db.close(); resolve(result); }; tx.onabort = tx.onerror = () => { db.close(); reject(failure || tx.error || Error('Não foi possível guardar o envio.')); };
      const done = value => { result = value; }, abort = error => { failure = error; tx.abort(); };
      try { operation(store, done, abort); } catch (error) { abort(error); }
    });
  }
  function confirmation(response, record) {
    const receipt = response?.receipt;
    if (response?.ok !== true || !receipt || receipt.owner !== record.owner || receipt.requestId !== record.requestId || receipt.scope !== record.scope || receipt.resourceId !== record.resourceId || receipt.payloadHash !== record.payloadHash || !Number.isFinite(Date.parse(receipt.confirmedAt))) throw Error('Resposta incompleta. O pedido original continua por confirmar.');
    if (photoScope(record.scope)) {
      if (!id(response.photo?.id) || response.photo[extraScope(record.scope) ? 'extraVisitId' : 'visitId'] !== record.resourceId || response.photo.type !== record.payload.type || !(extraScope(record.scope) ? /^\/uploads\/(?:qa\/)?extra-visit-/ : /^\/uploads\/(?:qa\/)?visit-/).test(response.photo.url) || response.sha256 !== record.payload.sha256 || response.size !== record.payload.size) throw Error('A confirmação não corresponde à fotografia guardada.');
    } else if (record.scope === 'TECHNICIAN_ALERT') {
      if (!id(response.alert?.id) || response.alert.technicianId !== record.resourceId || response.alert.visitId !== record.payload.visitId || response.alert.message !== record.payload.message || response.alert.priority !== record.payload.priority || response.alert.recipientRole !== 'ADMIN' || !Number.isFinite(Date.parse(response.alert.createdAt))) throw Error('A confirmação não corresponde ao alerta original para a administração.');
    } else if (record.scope === 'FIELD_STOCK_REQUEST') {
      const result=response.stockRequest;
      if(!result || Object.entries(record.payload).some(([field,value])=>result[field]!==value) || result.technicianId!==record.resourceId || !id(result.notificationId) || !id(result.reminderId) || result.recipientRole!=='ADMIN' || !Number.isFinite(Date.parse(result.createdAt)) || ![result.clientId,result.vehicleId].every(value=>value===null||id(value)))throw Error('A confirmação não corresponde ao pedido original para a administração.');
    } else if(record.scope==='FIELD_CLIENT_INTAKE') {
      const r=response.intake,p=record.payload,policy=r?.policy;
      if(!r||Object.entries(p).some(([k,v])=>r[k]!==v)||r.technicianId!==record.resourceId||![r.clientId,r.poolId,r.taskId,r.auditId].every(id)||!Number.isFinite(Date.parse(r.createdAt))||!policy||policy.techniciansCanCreateClientsPools!==true||typeof policy.requireAdminReview!=='boolean'||typeof policy.poolsActiveByDefault!=='boolean'||r.pendingReview!==policy.requireAdminReview||r.clientActive!==!policy.requireAdminReview||r.poolActive!==(policy.requireAdminReview?policy.poolsActiveByDefault:true)||response.pendingReview!==r.pendingReview||response.client?.id!==r.clientId||response.pool?.id!==r.poolId||response.pool.clientId!==r.clientId||response.client.name!==p.clientName.trim()||response.pool.name!==(p.poolName.trim()||'Piscina principal'))throw Error('A confirmação não corresponde à ficha original.');
      const clean=v=>v.trim()||null,number=v=>v===''?null:Number(v.replace(',','.'));
      for(const [field,value] of Object.entries({name:p.clientName.trim(),phone:clean(p.phone),email:clean(p.email),address:clean(p.address),zone:clean(p.zone),notes:clean(p.notes),latitude:number(p.latitude),longitude:number(p.longitude),active:r.clientActive,pendingReview:r.pendingReview,createdByTechnicianId:record.resourceId,status:r.pendingReview?'PENDING_REVIEW':'ACTIVE',reviewStatus:r.pendingReview?'PENDING':'APPROVED',source:'TECHNICIAN_FIELD_INTAKE'}))if(response.client[field]!==value)throw Error('O cliente confirmado difere da ficha original.');
      for(const [field,value] of Object.entries({name:p.poolName.trim()||'Piscina principal',type:clean(p.poolType),volumeM3:number(p.volumeM3),address:clean(p.address),zone:clean(p.zone),notes:clean(p.notes),latitude:number(p.latitude),longitude:number(p.longitude),active:r.poolActive,pendingReview:r.pendingReview,createdByTechnicianId:record.resourceId,reviewStatus:r.pendingReview?'PENDING':'APPROVED',source:'TECHNICIAN_FIELD_INTAKE'}))if(response.pool[field]!==value)throw Error('A piscina confirmada difere da ficha original.');
    } else if(record.scope==='FIELD_CLIENT_APPROVAL') {
      const p=record.payload,r=response.approval;
      if(!equal(response.context,p)||typeof response.applied!=='boolean')throw Error('A confirmação não corresponde à aprovação original.');
      if(response.applied){if(!r||r.clientId!==record.resourceId||!equal(r.poolIds,p.poolIds)||r.reviewedByUserId!==Number(record.owner.slice(6))||!Number.isFinite(Date.parse(r.reviewedAt))||!id(r.auditId)||!/^intake-v1:[a-f0-9]{64}$/.test(r.version)||response.client?.id!==r.clientId||response.client.active!==true||response.client.pendingReview!==false||response.client.reviewStatus!=='APPROVED'||response.client.reviewedAt!==r.reviewedAt||response.client.reviewedByUserId!==r.reviewedByUserId||!Array.isArray(response.pools)||p.poolIds.some(poolId=>!response.pools.some(pool=>pool.id===poolId&&pool.clientId===r.clientId&&pool.active===true&&pool.pendingReview===false&&pool.reviewStatus==='APPROVED'&&pool.reviewedAt===r.reviewedAt&&pool.reviewedByUserId===r.reviewedByUserId)))throw Error('A ativação de cliente e piscinas ainda não está confirmada.');}
      else if(!['INTAKE_APPROVAL_STALE','INTAKE_APPROVAL_STATE'].includes(response.code)||typeof response.message!=='string'||!/^intake-v1:[a-f0-9]{64}$/.test(response.currentVersion))throw Error('Recusa de aprovação inválida.');
    } else if(record.scope==='FIELD_PROBLEM_REPORT') {
      const result=response.problemReport;
      if(!result||Object.entries(record.payload).some(([field,value])=>result[field]!==value)||result.technicianId!==record.resourceId||![result.repairId,result.alertId,result.historyId,result.notificationId].every(id)||result.recipientRole!=='ADMIN'||!Number.isFinite(Date.parse(result.createdAt))||result.pricingStatus!=='UNQUOTED'||result.unitPrice!==null||result.totalPrice!==null)throw Error('A confirmação não corresponde à ocorrência original sem orçamento.');
    } else if (['VISIT_INCOMPLETE','VISIT_RETURN'].includes(record.scope)) {
      const p=record.payload,context={visitId:record.resourceId,visitType:p.visitType,poolId:p.poolId,baseVersion:p.baseVersion};
      if(!equal(response.context,context)||typeof response.applied!=='boolean')throw Error('A confirmação não corresponde ao impedimento desta visita.');
      if(!response.applied){if(!['INCOMPLETE_CONTEXT','INCOMPLETE_STALE','INCOMPLETE_STATE','INCOMPLETE_RETURN_EXISTS','INCOMPLETE_DATE','INCOMPLETE_TECHNICIAN','INCOMPLETE_SCHEDULE_CONFLICT','INCOMPLETE_BILLING'].includes(response.code)||typeof response.message!=='string'||!response.message)throw Error('A recusa está incompleta. Conserve o pedido.');}
      else {
        if(response.visit?.visitType!==p.visitType||response.visit.poolId!==p.poolId)throw Error('A confirmação pertence a outra visita.');
        if(record.scope==='VISIT_INCOMPLETE'){
          const m=response.reminder?.metadata;
          const shortage=p.reason==='CHEMICAL_MISSING'?{productName:p.chemicalShortage.productName.trim(),quantity:p.chemicalShortage.quantity===''||p.chemicalShortage.quantity===null?null:Number(String(p.chemicalShortage.quantity).replace(',','.')),unit:p.chemicalShortage.unit}:null;
          if(response.visit.id!==record.resourceId||response.visit.status!=='INCOMPLETE'||!id(response.reminder?.id)||response.reminder.sourceKey!==`incomplete:${p.visitType==='EXTRA'?'EXTRA:':''}${record.resourceId}:${record.requestId}`||m?.visitType!==p.visitType||m.visitId!==record.resourceId||m.reason!==p.reason||m.nextStep!==p.nextStep.trim()||!equal(m.chemicalShortage||null,shortage))throw Error('O impedimento ainda não está confirmado.');
        }else{
          const plan=response.plan;
          if(!id(response.visit.id)||response.visit.status!=='PLANNED'||response.visit.technicianId!==Number(p.technicianId)||response.visit.plannedDate?.slice(0,10)!==p.date||plan?.visitId!==response.visit.id||plan.visitType!==p.visitType||plan.requestId!==record.requestId||plan.date!==p.date||plan.technicianId!==Number(p.technicianId)||plan.instructions!==p.instructions.trim())throw Error('O regresso ainda não está confirmado.');
        }
      }
    } else if (record.scope === 'EQUIPMENT_MAINTENANCE') {
      const p = record.payload, context = { planId: record.resourceId, visitType: p.visitType, visitId: p.visitId, poolId: p.poolId, expectedVersion: p.expectedVersion };
      if (!equal(response.context, context) || typeof response.applied !== 'boolean') throw Error('A confirmação não corresponde à revisão desta visita.');
      if (!response.applied) {
        if (!['EQUIPMENT_CONTEXT','EQUIPMENT_DUPLICATE','EQUIPMENT_STATE','EQUIPMENT_STALE','EQUIPMENT_WORK_TIME'].includes(response.code) || typeof response.message !== 'string' || !response.message) throw Error('A recusa da revisão está incompleta.');
      } else {
        const c = response.completion;
        if (!id(c?.id) || c.planId !== record.resourceId || c.visitType !== p.visitType || c.visitId !== p.visitId || c.poolId !== p.poolId || c.version !== p.expectedVersion || c.requestId !== record.requestId || c.notes !== p.notes.trim() || !Number.isFinite(Date.parse(c.completedAt)) || c.completedAt !== response.completedAt || response.plan?.id !== record.resourceId || response.plan.poolId !== p.poolId || response.plan.version !== p.expectedVersion + 1 || !/^\d{4}-\d{2}-\d{2}$/.test(response.plan.nextDue) || response.plan.lastCompletedAt !== c.completedAt) throw Error('A revisão ainda não está confirmada. Conserve o pedido original.');
        const t = c.workTime;
        if (p.workTime ? !t || t.schema !== 1 || t.basis !== 'DECLARED_EQUIPMENT_WORK_INTERVAL' || !equal({ startAt: t.startAt, endAt: t.endAt }, p.workTime) || t.durationMs !== Date.parse(p.workTime.endAt) - Date.parse(p.workTime.startAt) || t.origin?.visitId !== p.visitId || t.origin?.visitType !== p.visitType || t.origin?.poolId !== p.poolId || (record.owner.startsWith('ADMIN:') ? !id(t.origin?.technicianId) : t.origin?.technicianId !== Number(record.owner.split(':').at(-1))) || !workInstant(t.origin?.visitStartAt) || Date.parse(t.startAt) < Date.parse(t.origin.visitStartAt) || Date.parse(t.endAt) > Date.parse(c.completedAt) : t !== undefined) throw Error('O tempo da revisão ainda não está confirmado. Conserve o pedido original.');
      }
    } else if (record.scope === 'EXTRA_VISIT_CORRECTION') {
      if (response.visit?.id !== record.resourceId || !/^[a-f0-9]{64}$/.test(response.version) || typeof response.applied !== 'boolean' || (response.applied ? response.visit.status !== 'DONE' || !Number.isFinite(Date.parse(response.visit.endAt)) : !['EXTRA_CORRECTION_STATE','EXTRA_CORRECTION_STALE','EXTRA_CORRECTION_STOCK'].includes(response.code) || typeof response.message !== 'string')) throw Error('A correção ainda não está confirmada. Conserve o pedido original.');
      if(response.applied)for(const [field,value] of Object.entries(record.payload)){
        if(['ph','chlorine','alkalinity','salt','temperature','orpMv'].includes(field) && response.visit[field] !== (value===''||value===null?null:Number(value)))throw Error('A medição confirmada não corresponde à correção.');
        if(['cleaned','brushed','vacuumed','basketCleaned','waterlineClean','backwashDone','notes'].includes(field) && response.visit[field]!==value)throw Error('O registo confirmado não corresponde à correção.');
        if(field==='products') { const expected=(typeof value==='string'?JSON.parse(value):value).map(row=>({...row,name:String(row.name||row.productName).trim(),quantity:Number(row.quantity),unit:row.unit||null})); if(!equal(expected,response.visit.chemicalsJson))throw Error('Os produtos confirmados não correspondem à correção.'); }
      }
    } else if (record.scope === 'EXTRA_VISIT_START') {
      if (response.visit?.id !== record.resourceId || response.visit.visitType !== 'EXTRA' || response.visit.poolId !== record.payload.poolId || response.visit.status !== 'IN_PROGRESS' || !Number.isFinite(Date.parse(response.visit.startAt)) || response.visit.endAt) throw Error('O início da visita extra ainda não está confirmado.');
    } else if (response.visit?.id !== record.resourceId || response.visit.status !== 'DONE' || response.visit.completionRequestId !== record.requestId || !Number.isFinite(Date.parse(response.visit.endAt))) throw Error('A conclusão desta visita ainda não está confirmada.');
    if (extraScope(record.scope) && !photoScope(record.scope) && (response.visit.visitType !== 'EXTRA' || response.visit.poolId !== record.payload.poolId)) throw Error('A confirmação pertence a outra piscina ou tipo de visita.');
    return response;
  }
  async function validate(record, captured, bytes = false) {
    const allowed = ['key','owner','requestId','scope','resourceId','payload','payloadHash','createdAt','file','fileName','label','attemptedAt','response','failure','reviewedAt'];
    if (!record || Object.keys(record).some(field => !allowed.includes(field)) || record.owner !== captured.owner || !uuid.test(record.requestId) || record.key !== key(record) || !scopes.includes(record.scope) || !id(record.resourceId) || !record.payload || typeof record.payload !== 'object' || Array.isArray(record.payload) || !Number.isFinite(Date.parse(record.createdAt)) || await hash(envelope(record)) !== record.payloadHash) throw Error('Envio guardado inválido. Os dados foram preservados; peça apoio ao escritório.');
    if(captured.admin && !['VISIT_RETURN','FIELD_CLIENT_APPROVAL'].includes(record.scope))throw Error('Pedido incompatível com esta conta de escritório.');
    if(record.scope==='FIELD_CLIENT_INTAKE'){
      const p=record.payload,limits={clientName:200,phone:60,email:254,address:1000,zone:120,poolName:200,poolType:80,volumeM3:40,latitude:40,longitude:40,notes:5000},number=v=>v===''?null:Number(v.replace(',','.'));
      if(captured.admin||record.resourceId!==captured.technicianId||Object.keys(p).length!==11||Object.keys(p).some(k=>!Object.hasOwn(limits,k))||Object.entries(limits).some(([k,n])=>typeof p[k]!=='string'||p[k].length>n)||!p.clientName.trim()||p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())||!['','Privada','Condomínio','Hotel','Jacuzzi'].includes(p.poolType))throw Error('Confirme o nome e os dados da ficha.');
      if(['volumeM3','latitude','longitude'].some(k=>p[k]!==''&&(!/^-?\d+(?:[.,]\d+)?$/.test(p[k])||!Number.isFinite(number(p[k]))))||number(p.volumeM3)!==null&&(number(p.volumeM3)<=0||number(p.volumeM3)>1000000)||(p.latitude==='')!==(p.longitude==='')||p.latitude!==''&&(Math.abs(number(p.latitude))>90||Math.abs(number(p.longitude))>180))throw Error('Confirme o volume e as duas coordenadas.');
    }
    if(record.scope==='FIELD_CLIENT_APPROVAL'){
      const p=record.payload;
      if(!captured.admin||p.clientId!==record.resourceId||Object.keys(p).length!==3||Object.keys(p).some(k=>!['clientId','expectedVersion','poolIds'].includes(k))||!/^intake-v1:[a-f0-9]{64}$/.test(p.expectedVersion)||!Array.isArray(p.poolIds)||p.poolIds.some((v,i)=>!id(v)||i>0&&v<=p.poolIds[i-1]))throw Error('Aprovação guardada inválida. Preserve o pedido.');
    }
    if(record.scope==='FIELD_PROBLEM_REPORT'){
      const p=record.payload,fields=['visitType','visitId','poolId','category','type','severity','message'];
      if(record.resourceId!==captured.technicianId||Object.keys(p).length!==fields.length||Object.keys(p).some(field=>!fields.includes(field))||p.visitType!=='REGULAR'||!id(p.visitId)||!id(p.poolId)||!['Servico normal','Extra / reparacao'].includes(p.category)||!['Agua turva','Equipamento','Fuga','Acesso bloqueado','Cliente ausente','Outro'].includes(p.type)||!['Normal','Urgente'].includes(p.severity)||typeof p.message!=='string'||!p.message.trim()||p.message.length>5000)throw Error('Ocorrência inválida. Preserve os dados e reveja os campos.');
    }
    if(record.scope==='FIELD_STOCK_REQUEST') {
      const p=record.payload, fields=['visitType','visitId','poolId','requestType','priority','productName','quantity','unit','message'];
      if(record.resourceId!==captured.technicianId || Object.keys(p).length!==fields.length || Object.keys(p).some(field=>!fields.includes(field)) || p.visitType!=='REGULAR' || ![p.visitId,p.poolId].every(value=>value===null||id(value)) || (!p.visitId&&p.poolId) || !['STOCK_REQUEST','PURCHASE_REMINDER','ADMIN_NOTE'].includes(p.requestType) || !['NORMAL','HIGH'].includes(p.priority) || [['productName',200],['quantity',40],['unit',40],['message',5000]].some(([field,max])=>typeof p[field]!=='string'||p[field].length>max) || (!p.productName.trim()&&!p.message.trim()))throw Error('Pedido de material inválido. Preserve os dados e reveja os campos.');
      if(p.quantity!==''&&(!/^\d+(?:[.,]\d{1,6})?$/.test(p.quantity)||!Number.isFinite(Number(p.quantity.replace(',','.')))||Number(p.quantity.replace(',','.'))<=0||Number(p.quantity.replace(',','.'))>1000000||!p.unit.trim()))throw Error('Indique uma quantidade positiva e a respetiva unidade, ou deixe a quantidade vazia.');
    }
    if(['VISIT_INCOMPLETE','VISIT_RETURN'].includes(record.scope)&&(!['REGULAR','EXTRA'].includes(record.payload.visitType)||!id(record.payload.poolId)||!(/^[a-f0-9]{64}$/).test(record.payload.baseVersion)))throw Error('Contexto do impedimento inválido. Conserve os dados.');
    if (record.scope === 'TECHNICIAN_ALERT' && (record.resourceId !== captured.technicianId || Object.keys(record.payload).some(field => !['message','visitId','priority'].includes(field)) || typeof record.payload.message !== 'string' || !record.payload.message.trim() || record.payload.message.length > 5000 || !['NORMAL','HIGH'].includes(record.payload.priority) || (record.payload.visitId !== null && !id(record.payload.visitId)))) throw Error('Alerta guardado inválido. Preserve os dados e peça revisão ao escritório.');
    if(record.scope==='EQUIPMENT_MAINTENANCE' && (Object.keys(record.payload).some(field=>!['visitType','visitId','poolId','expectedVersion','notes','confirmed','workTime'].includes(field)) || !['REGULAR','EXTRA'].includes(record.payload.visitType) || !id(record.payload.visitId) || !id(record.payload.poolId) || !id(record.payload.expectedVersion) || record.payload.confirmed!==true || typeof record.payload.notes!=='string' || record.payload.notes.trim().length<3 || record.payload.notes.length>3000 || Object.hasOwn(record.payload,'workTime') && !workTime(record.payload.workTime)))throw Error('Revisão guardada inválida. Preserve os dados.');
    if(record.reviewedAt && (!['EXTRA_VISIT_CORRECTION','EQUIPMENT_MAINTENANCE','VISIT_INCOMPLETE','VISIT_RETURN','FIELD_CLIENT_APPROVAL'].includes(record.scope)||record.response?.applied!==false||!Number.isFinite(Date.parse(record.reviewedAt))))throw Error('Revisão guardada inválida. Preserve os dados.');
    if (record.response) confirmation(record.response, record);
    else if (photoScope(record.scope)) {
      if (!(record.file instanceof Blob) || !record.file.size || record.file.size > 25 * 1024 * 1024 || record.file.size !== record.payload.size || !['BEFORE','AFTER','PROBLEM','ACCESS','GENERAL'].includes(record.payload.type) || !/^[0-9a-f]{64}$/.test(record.payload.sha256) || (bytes && await digest(await record.file.arrayBuffer()) !== record.payload.sha256)) throw Error('Fotografia guardada inválida. Os dados foram preservados.');
    }
    return record;
  }
  async function records(scope, captured = session(), includeConfirmed = false) {
    requireSession(captured);
    const all = await transaction('readonly', (store, done) => { const read = store.getAll(); read.onsuccess = () => done(read.result); });
    const own = all.filter(record => record.owner === captured.owner || String(record.key).startsWith(captured.owner + ':'));
    for (const record of own) await validate(record, captured);
    requireSession(captured); return own.filter(record => (!scope || record.scope === scope) && (includeConfirmed || !record.response)).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.resourceId - b.resourceId || a.requestId.localeCompare(b.requestId));
  }
  async function get(requestId, captured) { requireSession(captured); const record = await transaction('readonly', (store, done) => { const read = store.get(`${captured.owner}:${requestId}`); read.onsuccess = () => done(read.result); }); requireSession(captured); if (!record) throw Error('Pedido guardado não encontrado.'); return validate(record, captured, true); }
  async function locked(name, captured, operation) {
    requireSession(captured);
    if (!navigator.locks?.request) throw Error('Este navegador não permite coordenar os envios. Os dados foram preservados.');
    return navigator.locks.request(`cw-field-write:${captured.owner}:${name}`, { ifAvailable: true }, async lock => { if (!lock) throw Error('O envio está em utilização noutra janela. Tente confirmar novamente.'); requireSession(captured); return operation(); });
  }
  async function prepare(scope, resourceId, payload, options = {}, captured = session()) {
    return locked(`prepare:${scope}:${resourceId}`, captured, async () => {
      const previous = await records(scope, captured, true);
      if(['VISIT_INCOMPLETE','VISIT_RETURN'].includes(scope)){const existing=previous.find(row=>row.resourceId===resourceId&&row.payload.visitType===payload.visitType&&(!row.response||row.response.applied===false&&!row.reviewedAt||equal(row.payload,payload)));if(existing){if(!equal(existing.payload,payload))throw Error('Há um pedido por confirmar ou uma recusa por rever. Conserve o pedido original.');return existing;}}
      if(scope==='EQUIPMENT_MAINTENANCE'){const existing=previous.find(record=>record.resourceId===resourceId&&record.payload.visitType===payload.visitType&&record.payload.visitId===payload.visitId&&(!record.response||record.response.applied===true));if(existing){if(!equal(existing.payload,payload))throw Error('Há uma revisão desta visita por confirmar ou já registada. Conserve o pedido original.');return existing;}}
      if(scope==='EXTRA_VISIT_CORRECTION'){const existing=previous.find(record=>record.resourceId===resourceId&&!record.response);if(existing){if(!equal(existing.payload,payload))throw Error('Há uma correção diferente por confirmar. Conserve o pedido original antes de preparar outra.');return existing;}}
      if (['VISIT_COMPLETION','EXTRA_VISIT_COMPLETION','EXTRA_VISIT_START'].includes(scope)) { const existing = previous.find(record => record.resourceId === resourceId); if (existing) { if (!equal(existing.payload, payload)) throw Error(existing.response ? 'Esta conclusão já foi confirmada. Use o procedimento de correção da visita.' : 'Há uma conclusão diferente por confirmar. Conserve-a e peça revisão antes de alterar.'); return existing; } }
      if (scope === 'TECHNICIAN_ALERT') { const existing = previous.find(record => !record.response); if (existing) { if (!equal(existing.payload, payload)) throw Error('Há um alerta diferente por confirmar. Preserve-o antes de preparar outro.'); return existing; } }
      if (scope === 'FIELD_STOCK_REQUEST') { const existing = previous.find(record => !record.response); if (existing) { if (!equal(existing.payload, payload)) throw Error('Há um pedido de material diferente por confirmar. Preserve-o antes de preparar outro.'); return existing; } }
      if(scope==='FIELD_CLIENT_APPROVAL'){const existing=previous.find(row=>row.resourceId===resourceId&&(!row.response||row.response.applied===false&&!row.reviewedAt||equal(row.payload,payload)));if(existing){if(!equal(existing.payload,payload))throw Error('Há uma aprovação por confirmar ou uma recusa por rever.');return existing;}}
      if(scope==='FIELD_CLIENT_INTAKE'){const existing=previous.find(row=>!row.response);if(existing){if(!equal(existing.payload,payload))throw Error('Há outra ficha por confirmar. Preserve o envio original.');return existing;}}
      if (scope === 'FIELD_PROBLEM_REPORT') { const existing = previous.find(record => !record.response); if (existing) { if (!equal(existing.payload, payload)) throw Error('Há uma ocorrência diferente por confirmar. Preserve-a antes de preparar outra.'); return existing; } }
      const record = { owner: captured.owner, requestId: options.requestId || crypto.randomUUID(), scope, resourceId, payload: JSON.parse(JSON.stringify(payload)), createdAt: new Date().toISOString(), label: options.label || `Visita ${resourceId}`, ...(options.file ? { file: options.file, fileName: options.fileName || 'photo' } : {}) };
      record.key = key(record); record.payloadHash = await hash(envelope(record)); await validate(record, captured, true); requireSession(captured);
      await transaction('readwrite', (store, done, abort) => { const read = store.get(record.key); read.onsuccess = () => { try { if (read.result) throw Error('Identificador já guardado. Conserve o envio original.'); if (!same(captured)) throw Error('Sessão alterada.'); store.add(record); done(record); } catch (error) { abort(error); } }; });
      const saved = await get(record.requestId, captured); if (saved.payloadHash !== record.payloadHash) throw Error('A gravação local não ficou confirmada.'); window.dispatchEvent(new Event('cw:field-write-change')); return saved;
    });
  }
  async function update(record, captured, change) {
    requireSession(captured);
    await transaction('readwrite', (store, done, abort) => { const read = store.get(record.key); read.onsuccess = () => { try { const current = read.result; if (!same(captured) || !current || current.owner !== record.owner || current.payloadHash !== record.payloadHash || !equal(current.payload, record.payload)) throw Error('O pedido ou a sessão mudou. Os dados foram preservados.'); const next = change(current); store.put(next); done(next); } catch (error) { abort(error); } }; });
  }
  async function send(requestId, captured = session(), options = {}) {
    return locked(requestId, captured, async () => {
      const record = await get(requestId, captured); if (record.response) return record.response;
      if (!navigator.onLine) throw Error('Envio guardado neste dispositivo; aguarda ligação.');
      if (window.CristalAuth?.isSessionExpired?.()) throw Error('Sessão expirada. Volte a entrar com a mesma conta.');
      if (record.failure?.retryAt > Date.now()) throw Error('O servidor pediu uma pausa. O pedido foi preservado e será repetido depois.');
      if (options.automatic && record.failure?.blocked) throw Error(record.failure.message);
      await update(record, captured, current => ({ ...current, attemptedAt: current.attemptedAt || new Date().toISOString() }));
      const headers = { Authorization: 'Bearer ' + captured.token }; let body, endpoint;
      if (photoScope(record.scope)) { body = new FormData(); body.append('type', record.payload.type); body.append('requestId', record.requestId); body.append('photo', record.file, record.fileName); if(extraScope(record.scope))body.append('poolId', String(record.payload.poolId)); headers['X-CW-Field-Request'] = record.requestId; endpoint = extraScope(record.scope) ? `/api/field/extra-visits/${record.resourceId}/photo` : `/api/visits/${record.resourceId}/photo`; }
      else { headers['Content-Type'] = 'application/json'; body = JSON.stringify({ ...record.payload, requestId: record.requestId }); endpoint = ['VISIT_INCOMPLETE','VISIT_RETURN'].includes(record.scope) ? `/api/technician/visits/${record.resourceId}/${record.scope==='VISIT_RETURN'?'schedule-return':'incomplete'}` : record.scope === 'EQUIPMENT_MAINTENANCE' ? `/api/equipment-maintenance/plans/${record.resourceId}/complete` : record.scope === 'FIELD_CLIENT_INTAKE' ? '/api/technician-intake/client-with-pool' : record.scope === 'FIELD_CLIENT_APPROVAL' ? `/api/technician-intake/clients/${record.resourceId}/approve` : record.scope === 'FIELD_PROBLEM_REPORT' ? `/api/core/visits/${record.payload.visitId}/problem` : record.scope === 'FIELD_STOCK_REQUEST' ? '/api/technician/stock-reminders' : record.scope === 'TECHNICIAN_ALERT' ? '/api/visits/internal-alert' : extraScope(record.scope) ? `/api/field/extra-visits/${record.resourceId}/${record.scope === 'EXTRA_VISIT_START' ? 'start' : record.scope === 'EXTRA_VISIT_CORRECTION' ? 'correction' : 'complete'}` : `/api/core/visits/${record.resourceId}/complete`; }
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000), check = setInterval(() => { if (!same(captured)) controller.abort(); }, 250);
      try {
        const response = await fetch(endpoint, { method: 'POST', headers, body, signal: controller.signal }); const result = await response.json(); requireSession(captured);
        if (response.status !== 200) { const value = response.headers.get('Retry-After'), seconds = Number(value), wait = value && Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now(); throw Object.assign(Error(result.error || 'Envio por confirmar. Conserve o pedido original.'), { status: response.status, retryAt: response.status === 429 ? Date.now() + Math.max(30000, Math.min(Number.isFinite(wait) ? wait : 30000, 3600000)) : null }); }
        confirmation(result, record);
        await update(record, captured, current => { if (current.response && !equal(current.response, result)) throw Error('Confirmações incompatíveis. Os dados foram preservados.'); const next = { ...current, response: result }; delete next.file; delete next.failure; return next; });
        const saved = await get(requestId, captured); if (!equal(saved.response, result)) throw Error('A confirmação não ficou guardada neste dispositivo.');
        window.dispatchEvent(new Event('cw:field-write-change')); return result;
      } catch (error) {
        // Account changes can abort fetch before its response reaches the
        // identity check. Keep the original request and explain the interruption.
        requireSession(captured);
        await update(record, captured, current => current.response ? current : { ...current, failure: { message: String(error.message).slice(0, 500), status: error.status || null, retryAt: error.retryAt || null, blocked: error.status >= 400 && error.status < 500 && ![401,408,425,429].includes(error.status) } }).catch(() => {});
        requireSession(captured);
        throw error;
      }
      finally { clearTimeout(timer); clearInterval(check); }
    });
  }
  async function remove(requestId, captured = session()) { return locked(requestId, captured, async () => { const record = await get(requestId, captured); if (record.response) return; if (record.attemptedAt) throw Error('O envio já foi iniciado. Confirme o pedido antes de remover a fotografia.'); requireSession(captured); await transaction('readwrite', (store, done) => { requireSession(captured); store.delete(record.key); done(); }); window.dispatchEvent(new Event('cw:field-write-change')); }); }
  async function flush(scope, captured = session()) { const pending = await records(scope, captured); const confirmed = []; for (const record of pending) { if (record.failure?.blocked || record.failure?.retryAt > Date.now()) continue; try { confirmed.push(await send(record.requestId, captured, { automatic: true })); } catch (error) { return { pending: (await records(scope, captured)).length, confirmed, error: error.message }; } } return { pending: (await records(scope, captured)).length, confirmed }; }
  async function acknowledgeRejection(requestId,captured=session()){return locked(requestId,captured,async()=>{const row=await get(requestId,captured);if(!['EXTRA_VISIT_CORRECTION','EQUIPMENT_MAINTENANCE','VISIT_INCOMPLETE','VISIT_RETURN','FIELD_CLIENT_APPROVAL'].includes(row.scope)||row.response?.applied!==false)throw Error('Apenas uma recusa confirmada pode ser reconhecida.');await update(row,captured,current=>({...current,reviewedAt:current.reviewedAt||new Date().toISOString()}));window.dispatchEvent(new Event('cw:field-write-change'));});}
  window.CWFieldWriteStore = { session, adminSession:()=>session(true), same, prepare, send, records, get, remove, flush, digest, hash, confirmation, acknowledgeRejection };
})();
