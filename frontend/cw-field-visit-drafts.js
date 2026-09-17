(function () {
  'use strict';
  const store = window.CWFieldWriteStore;
  const valueIds = ['ph','chlorine','alkalinity','salt','orp','temperature','notes'];
  const checkIds = ['cleaned','vacuumed','basketCleaned','brushed','waterlineClean','backwashDone'];
  const fields = [...valueIds,...checkIds,'usedProducts','pendingProblems','startedAt','photos'];
  const labels = { ph:'pH',chlorine:'Cloro',alkalinity:'Alcalinidade',salt:'Sal',orp:'ORP',temperature:'Temperatura',notes:'Notas',cleaned:'Limpeza',vacuumed:'Aspiração',basketCleaned:'Cestos',brushed:'Escovagem',waterlineClean:'Linha de água',backwashDone:'Lavagem do filtro',usedProducts:'Produtos utilizados',pendingProblems:'Ocorrências',startedAt:'Início da visita',photos:'Fotografias' };
  const clone = value => JSON.parse(JSON.stringify(value));
  const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const sameField = (id,a,b) => id === 'photos' ? equal(a.map(photo=>photo.url ? [photo.url,photo.type] : [photo.localId,photo.type]).sort(),b.map(photo=>photo.url ? [photo.url,photo.type] : [photo.localId,photo.type]).sort()) : equal(a,b);
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const visitKey = visit => `visit-${visit.visitType || 'REGULAR'}-${visit.id}`;
  const done = visit => !!visit.endAt || ['DONE','COMPLETED','CONCLUIDA'].includes(visit.status);
  function flatten(draft) {
    return { ...Object.fromEntries(valueIds.map(id=>[id,String(draft?.values?.[id] ?? '')])), ...Object.fromEntries(checkIds.map(id=>[id,!!draft?.checks?.[id]])), usedProducts:clone(draft?.usedProducts || []),pendingProblems:clone(draft?.pendingProblems || []),startedAt:draft?.startedAt || null,photos:clone(draft?.photos || []) };
  }
  function expand(fields, original = {}) {
    return { ...original,values:{...original.values,...Object.fromEntries(valueIds.map(id=>[id,fields[id]]))},checks:Object.fromEntries(checkIds.map(id=>[id,fields[id]])),...Object.fromEntries(['usedProducts','pendingProblems','startedAt','photos'].map(id=>[id,clone(fields[id])])) };
  }
  function validateFields(value) {
    return object(value) && fields.every(id=>valueIds.includes(id) ? typeof value[id] === 'string' && value[id].length <= 20000 : checkIds.includes(id) ? typeof value[id] === 'boolean' : id === 'startedAt' ? value[id] === null || typeof value[id] === 'string' && Number.isFinite(Date.parse(value[id])) : Array.isArray(value[id]) && value[id].every(object));
  }
  function display(value) {
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (Array.isArray(value)) return value.length ? value.map(row=>row.name ? [row.name,row.quantity,row.unit,row.notes].filter(Boolean).join(' · ') : row.fileName ? `${row.fileName} (${row.status || ''})` : row.message || JSON.stringify(row)).join('\n') : '(nenhum)';
    return value || '(vazio)';
  }
  function create(captured, hooks) {
    const storageKey = 'cwFieldVisitDrafts:v2:' + captured?.owner, entries = new Map();
    let panelEntry = null;
    const active = () => store.same(captured);
    function requireActive() { if (!active()) throw Error('A sessão mudou. Reabra com a conta original.'); }
    function read() {
      requireActive(); const raw = localStorage.getItem(storageKey); if (!raw) return {};
      let envelope; try { envelope = JSON.parse(raw); } catch (_) { throw Error('Rascunhos ilegíveis. Preserve os dados e peça apoio ao escritório.'); }
      if (!envelope || envelope.v !== 2 || envelope.owner !== captured.owner || !object(envelope.drafts) || Object.entries(envelope.drafts).some(([key,value])=>!/^visit-(REGULAR|EXTRA)-[1-9][0-9]*$/.test(key) || !object(value))) throw Error('Rascunhos sem identidade válida. Preserve os dados e peça apoio ao escritório.');
      return envelope.drafts;
    }
    function validate(value, entry) {
      if (!value) return;
      if (!object(value.values) || !object(value.checks) || Object.entries(value.values).some(([id,v])=>valueIds.includes(id)&&typeof v!=='string') || Object.entries(value.checks).some(([id,v])=>checkIds.includes(id)&&typeof v!=='boolean') || !validateFields(flatten(value))) throw Error('Rascunho ilegível. Preserve os dados e peça revisão.');
      const meta = value._draft;
      if (meta && (meta.v !== 1 || meta.poolId !== entry.poolId || meta.visitType !== entry.type || meta.visitId !== entry.id || !['WORK','CORRECTION'].includes(meta.mode) || !validateFields(meta.baseline) || !object(meta.conflicts) || !Number.isFinite(Date.parse(meta.savedAt)) || Object.entries(meta.conflicts).some(([id,proposals])=>!fields.includes(id) || !Array.isArray(proposals) || proposals.some(item=>!object(item) || !['Servidor','Outra janela','Registo anterior'].includes(item.source) || !validateFields({...meta.baseline,[id]:item.value}))))) throw Error('O rascunho não corresponde à piscina/visita ou está ilegível. Os dados foram preservados.');
    }
    const currentRaw = (drafts, entry) => JSON.stringify(drafts[entry.key] || null);
    const scope = entry => entry.type === 'EXTRA' ? 'EXTRA_VISIT_COMPLETION' : 'VISIT_COMPLETION';
    async function request(entry) { return entry.mode === 'WORK' ? (await store.records(scope(entry),captured,true)).find(row=>row.resourceId === entry.id) || null : null; }
    function notify(entry, fill = false) { if (active()) hooks.changed(entry,fill); }
    function proposal(entry,id,value,source) {
      const rows = (entry.conflicts[id] || []).filter(row=>row.source !== source);
      if (!sameField(id,value,entry.fields[id])) rows.push({source,value:clone(value)});
      if (rows.length) entry.conflicts[id] = rows; else delete entry.conflicts[id];
    }
    function reconcile(entry, server) {
      for (const id of fields) {
        if (id === 'startedAt' && server[id]) { entry.fields[id]=server[id];delete entry.conflicts[id]; }
        else if (entry.conflicts[id]?.length) proposal(entry,id,server[id],'Servidor');
        else if (sameField(id,entry.fields[id],entry.baseline[id])) entry.fields[id] = clone(server[id]);
        else if (!sameField(id,server[id],entry.baseline[id]) && !sameField(id,server[id],entry.fields[id])) proposal(entry,id,server[id],'Servidor');
        entry.baseline[id] = clone(server[id]);
      }
      entry.server = clone(server);
    }
    function bind(visit, serverDraft) {
      if (!visit?.id) return null;
      requireActive(); const key = visitKey(visit), mode = done(visit) ? 'CORRECTION' : 'WORK', mapKey = key + ':' + mode;
      let entry = entries.get(mapKey); const server = flatten(serverDraft);
      if (!entry) {
        entry = { key,id:visit.id,type:visit.visitType || 'REGULAR',poolId:visit.poolId || visit.pool?.id,name:visit.pool?.name || key,mode,fields:clone(server),baseline:clone(server),server:clone(server),observed:'null',observedFields:clone(server),conflicts:{},original:{},pending:0,revision:0,chain:Promise.resolve(),error:'',external:false,request:null,checking:true,readonly:done(visit) && visit.visitType === 'EXTRA' };
        entries.set(mapKey,entry);
        try {
          const drafts = read(), saved = drafts[key]; validate(saved,entry); entry.observed = currentRaw(drafts,entry);
          if (saved && (!saved._draft || saved._draft.mode === mode) && !entry.readonly) {
            entry.original = saved; entry.fields = flatten(saved); entry.observedFields = clone(entry.fields);
            if (saved._draft) { entry.baseline = clone(saved._draft.baseline); entry.conflicts = clone(saved._draft.conflicts); }
            else for (const id of fields) if (!sameField(id,entry.fields[id],server[id])) proposal(entry,id,server[id],'Registo anterior');
          }
        } catch (error) { entry.error = error.message; entry.invalid = true; }
      }
      if(entry.poolId!==(visit.poolId||visit.pool?.id)){entry.invalid=true;entry.error='A piscina da visita mudou. Preserve o rascunho e confirme a atribuição com o escritório.';}
      if (!entry.invalid && !entry.external && !entry.request && !entry.readonly) reconcile(entry,server);
      void refresh(entry); return entry;
    }
    async function refresh(entry) {
      try { const row = await request(entry); requireActive(); entry.request = row; entry.checking = false; }
      catch (error) { if (active()) { entry.error = error.message; entry.checking = false; } }
      notify(entry);
    }
    function check(entry, drafts) {
      validate(drafts[entry.key],entry);
      if (currentRaw(drafts,entry) !== entry.observed) { entry.external = true; throw Error('O rascunho mudou noutra janela. Compare os valores antes de guardar.'); }
    }
    async function locked(entry, operation) {
      requireActive(); if (!navigator.locks?.request) throw Error('Este navegador não permite coordenar os rascunhos. Preserve os campos e reabra num navegador compatível.');
      return navigator.locks.request(storageKey,async()=>{requireActive();entry.request=await request(entry);requireActive();if(entry.request)throw Error('Existe uma conclusão guardada. Use o pedido original em Envios pendentes.');const drafts=read();check(entry,drafts);return operation(drafts);});
    }
    function write(entry, drafts) {
      requireActive(); if (entry.invalid || entry.external || entry.readonly) throw Error('O rascunho exige revisão antes de guardar.');
      if (!validateFields(entry.fields)) throw Error('O rascunho contém valores inválidos ou texto demasiado longo.');
      const previous=drafts[entry.key];
      if(previous?._draft?.mode===entry.mode&&equal(flatten(previous),entry.fields)&&equal(previous._draft.baseline,entry.baseline)&&equal(previous._draft.conflicts,entry.conflicts)){entry.error='';return;}
      const saved = expand(entry.fields,entry.original);
      saved._draft = {v:1,visitId:entry.id,visitType:entry.type,poolId:entry.poolId,mode:entry.mode,baseline:clone(entry.baseline),conflicts:clone(entry.conflicts),savedAt:new Date().toISOString()};
      const raw = JSON.stringify({v:2,owner:captured.owner,drafts:{...drafts,[entry.key]:saved}});
      localStorage.setItem(storageKey,raw); if (localStorage.getItem(storageKey) !== raw) throw Error('Não foi possível confirmar a gravação do rascunho.');
      entry.observed = JSON.stringify(saved); entry.observedFields = clone(entry.fields); entry.original = saved; entry.error = '';
    }
    function schedule(entry) {
      if (!entry || !active() || entry.readonly || entry.request) return Promise.resolve();
      ++entry.revision; ++entry.pending; notify(entry);
      entry.chain = entry.chain.catch(()=>{}).then(()=>locked(entry,drafts=>write(entry,drafts))).catch(error=>{if(active())entry.error=error.message;}).finally(()=>{--entry.pending;notify(entry);});
      return entry.chain;
    }
    function save(entry, draft) {
      if (!entry || !active() || entry.request || entry.readonly) return Promise.resolve();
      entry.fields = flatten(draft); return schedule(entry);
    }
    async function compare(entry) {
      await entry.chain; requireActive();
      try {
        const drafts = read(), saved = drafts[entry.key]; validate(saved,entry);
        if (!saved || saved._draft && saved._draft.mode !== entry.mode) throw Error('O rascunho foi removido ou pertence a outra fase da visita. Copie os campos e reabra a visita.');
        const remote = flatten(saved), reference = entry.observedFields;
        for (const id of fields) {
          if (sameField(id,entry.fields[id],reference[id])) { entry.fields[id] = clone(remote[id]); if (saved._draft?.conflicts[id]) entry.conflicts[id] = clone(saved._draft.conflicts[id]);else delete entry.conflicts[id]; }
          else if (!sameField(id,remote[id],reference[id]) && !sameField(id,remote[id],entry.fields[id])) proposal(entry,id,remote[id],'Outra janela');
        }
        entry.observed = currentRaw(drafts,entry); entry.observedFields = clone(remote); entry.external = false; entry.error = ''; notify(entry,true); await schedule(entry);
      } catch(error) { entry.error = error.message; notify(entry); }
    }
    function choose(entry,id,value) {
      if (!active() || entry.external || entry.request || entry.invalid) return;
      entry.fields[id] = clone(value); entry.baseline[id] = clone(entry.server[id]); delete entry.conflicts[id]; notify(entry,true); void schedule(entry);
    }
    async function prepare(entry, operation) {
      if (!entry) throw Error('Reabra o formulário antes de concluir.');
      await entry.chain; requireActive();
      return locked(entry,async drafts=>{
        if (entry.pending || entry.error || entry.invalid || Object.keys(entry.conflicts).length) throw Error(entry.error || 'Reveja as diferenças do rascunho antes de concluir.');
        write(entry,drafts);
        const revision = entry.revision, result = await operation(); requireActive();
        entry.request = await request(entry);
        if (revision !== entry.revision) entry.error = 'Os campos mudaram durante a preparação. A conclusão conserva os valores originais do pedido.';
        notify(entry); return result;
      });
    }
    async function acceptCorrection(entry, serverDraft) {
      requireActive(); if(entry.mode!=='CORRECTION')return;
      reconcile(entry,flatten(serverDraft));await schedule(entry);
    }
    function paint(entry) {
      const status = document.getElementById('fieldSaveStatus'), target = document.getElementById('fieldDraftReview'), panel=document.createElement('div');
      if (!status || !target) return;
      if (!entry) { target.replaceChildren();target.hidden=true;panelEntry=null;status.textContent='Escolha uma visita para registar o trabalho.';status.dataset.state='empty';return; }
      const conflicts = Object.keys(entry.conflicts).length;
      status.dataset.state = entry.error || entry.invalid || entry.external ? 'error' : entry.pending || entry.checking ? 'saving' : conflicts ? 'review' : entry.observed !== 'null' ? 'saved' : 'empty';
      status.textContent = !active() ? 'A sessão mudou. O rascunho foi preservado.' : entry.readonly ? 'Visita extra concluída. Use Corrigir registo.' : entry.request ? (entry.request.response ? 'Conclusão confirmada. Rascunho preservado para consulta.' : 'Conclusão guardada por confirmar. Use o pedido original em Envios pendentes.') : entry.error ? 'Rascunho não guardado. Não feche a página. '+entry.error : entry.external ? 'O rascunho mudou noutra janela. Compare os valores; os campos desta janela estão preservados.' : entry.checking ? 'A verificar os pedidos guardados…' : entry.pending ? 'A guardar rascunho neste telemóvel…' : conflicts ? 'Há diferenças por rever. Os valores foram preservados; reveja antes de concluir.' : entry.observed !== 'null' ? 'Rascunho guardado neste telemóvel; ainda não submetido.' : 'Os campos serão guardados neste telemóvel enquanto preenche.';
      const button = (label, action) => { const node=document.createElement('button');node.type='button';node.textContent=label;node.style.cssText='min-height:44px;margin:4px;white-space:normal';node.onclick=action;return node; };
      if(entry.external&&!entry.invalid)panel.append(button('Comparar rascunhos',()=>compare(entry)));
      else if(entry.error&&!entry.invalid&&!entry.request)panel.append(button('Guardar rascunho novamente',()=>schedule(entry)));
      for(const [id,proposals] of Object.entries(entry.conflicts)){
        const row=document.createElement('div');row.dataset.draftField=id;row.dataset.draftValues=JSON.stringify([entry.fields[id],proposals]);row.style.cssText='margin:12px 0;padding:12px;border:1px solid #a1b5c8;border-radius:10px;overflow-wrap:anywhere;white-space:pre-wrap';
        const title=document.createElement('strong');title.textContent=labels[id];row.append(title);
        for(const [source,value] of [['Nesta janela',entry.fields[id]],...proposals.map(p=>[p.source,p.value])]){const text=document.createElement('p');text.textContent=source+': '+display(value);row.append(text);const pick=button(source==='Nesta janela'?'Manter este rascunho':'Usar valor — '+source,()=>choose(entry,id,value));pick.disabled=entry.external||entry.invalid||!!entry.request;row.append(pick);}
        panel.append(row);
      }
      if(panelEntry!==entry||target.innerHTML!==panel.innerHTML){target.replaceChildren(...panel.childNodes);panelEntry=entry;}
      target.hidden=!target.childElementCount;
      const blocked = !active() || entry.invalid || !!entry.request || entry.readonly || entry.submitting;
      for(const selector of [...valueIds.map(id=>'#'+id),...checkIds.map(id=>'#'+id),'#addDoseBtn','#doseRows input','#doseRows select','#doseRows button','#galleryPhotoBtn','#photoInput','#galleryPhotoInput','[data-photo-type]','#photoList button'])document.querySelectorAll(selector).forEach(node=>{node.disabled=blocked;});
      const finish=document.getElementById('finishBtn');if(finish&&!entry.readonly)finish.disabled=blocked||entry.checking||entry.pending>0||!!entry.error||entry.external||conflicts>0;
    }
    window.addEventListener('storage',event=>{
      if(event.key!==storageKey || !active())return;
      for(const entry of entries.values())try{const drafts=read();if(currentRaw(drafts,entry)!==entry.observed){entry.external=true;notify(entry);}}catch(error){entry.error=error.message;entry.invalid=true;notify(entry);}
    });
    window.addEventListener('cw:field-write-change',()=>{if(active())for(const entry of entries.values())void refresh(entry);});
    window.addEventListener('beforeunload',event=>{if(active()&&[...entries.values()].some(entry=>entry.pending||entry.error||entry.external)){event.preventDefault();event.returnValue='';}});
    async function pendingSummary() {
      requireActive(); const drafts=read(),rows=[...await store.records('VISIT_COMPLETION',captured,true),...await store.records('EXTRA_VISIT_COMPLETION',captured,true)];
      const items=[];
      for(const [key,draft] of Object.entries(drafts)){
        const entry=[...entries.values()].find(item=>item.key===key);const meta=draft._draft;
        if(meta?.mode==='WORK'&&rows.some(row=>row.resourceId===meta.visitId&&row.scope===(meta.visitType==='EXTRA'?'EXTRA_VISIT_COMPLETION':'VISIT_COMPLETION')))continue;
        if(!meta||Object.keys(meta.conflicts||{}).length||fields.some(id=>!sameField(id,flatten(draft)[id],meta.baseline?.[id])))items.push({kind:'pending',text:`${entry?.name || key} — rascunho de trabalho guardado, ainda não submetido.`});
      }
      for(const entry of entries.values())if(entry.pending||entry.error||entry.external)items.push({kind:'unknown',text:`${entry.name} — rascunho por guardar ou comparar. Não feche esta janela.`});
      return items;
    }
    return {bind,save,prepare,acceptCorrection,paint,read,expand:entry=>expand(entry.fields,entry.original),pendingSummary};
  }
  window.CWFieldVisitDrafts = {create};
})();
