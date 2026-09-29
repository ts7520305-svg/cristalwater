(function () {
  'use strict';
  const store = window.CWFieldWriteStore;
  // Presentation descriptors never enter drafts, baselines, conflicts or requests.
  const messages = {
    "ph": ["pH", "pH", "pH", "pH", "pH"],
    "chlorine": ["Cloro", "Chlorine", "Chlore", "Cloro", "Chlor"],
    "alkalinity": ["Alcalinidade", "Alkalinity", "Alcalinité", "Alcalinidad", "Alkalinität"],
    "salt": ["Sal", "Salt", "Sel", "Sal", "Salz"],
    "orp": ["ORP", "ORP", "ORP", "ORP", "ORP"],
    "temperature": ["Temperatura", "Temperature", "Température", "Temperatura", "Temperatur"],
    "notes": ["Notas", "Notes", "Notes", "Notas", "Notizen"],
    "cleaned": ["Limpeza", "Cleaning", "Nettoyage", "Limpieza", "Reinigung"],
    "vacuumed": ["Aspiração", "Vacuuming", "Aspiration", "Aspiración", "Absaugen"],
    "basketCleaned": ["Cestos", "Baskets", "Paniers", "Cestos", "Körbe"],
    "brushed": ["Escovagem", "Brushing", "Brossage", "Cepillado", "Bürsten"],
    "waterlineClean": ["Linha de água", "Waterline", "Ligne d’eau", "Línea de agua", "Wasserlinie"],
    "backwashDone": ["Lavagem do filtro", "Filter backwash", "Contre-lavage du filtre", "Lavado del filtro", "Filterrückspülung"],
    "usedProducts": ["Produtos utilizados", "Products used", "Produits utilisés", "Productos utilizados", "Verwendete Produkte"],
    "pendingProblems": ["Ocorrências", "Issues", "Incidents", "Incidencias", "Vorkommnisse"],
    "startedAt": ["Início da visita", "Visit start", "Début de la visite", "Inicio de la visita", "Besuchsbeginn"],
    "photos": ["Fotografias", "Photos", "Photos", "Fotografías", "Fotos"],
    "server": ["Servidor", "Server", "Serveur", "Servidor", "Server"],
    "otherWindow": ["Outra janela", "Other window", "Autre fenêtre", "Otra ventana", "Anderes Fenster"],
    "previousRecord": ["Registo anterior", "Previous record", "Enregistrement précédent", "Registro anterior", "Vorheriger Eintrag"],
    "thisWindow": ["Nesta janela", "This window", "Cette fenêtre", "Esta ventana", "Dieses Fenster"],
    "yes": ["Sim", "Yes", "Oui", "Sí", "Ja"],
    "no": ["Não", "No", "Non", "No", "Nein"],
    "none": ["(nenhum)", "(none)", "(aucun)", "(ninguno)", "(keine)"],
    "empty": ["(vazio)", "(empty)", "(vide)", "(vacío)", "(leer)"],
    "originalSession": ["A sessão mudou. Reabra com a conta original.", "The session has changed. Reopen with the original account.", "La session a changé. Rouvrez avec le compte d’origine.", "La sesión ha cambiado. Vuelva a abrir con la cuenta original.", "Die Sitzung hat sich geändert. Öffnen Sie die Seite mit dem ursprünglichen Konto erneut."],
    "unreadableEnvelope": ["Rascunhos ilegíveis. Preserve os dados e peça apoio ao escritório.", "Unreadable drafts. Preserve the data and ask the office for help.", "Brouillons illisibles. Conservez les données et demandez de l’aide au bureau.", "Borradores ilegibles. Conserve los datos y pida ayuda a la oficina.", "Die Entwürfe sind unlesbar. Bewahren Sie die Daten auf und bitten Sie das Büro um Hilfe."],
    "invalidIdentity": ["Rascunhos sem identidade válida. Preserve os dados e peça apoio ao escritório.", "Drafts have no valid identity. Preserve the data and ask the office for help.", "Les brouillons n’ont pas d’identité valide. Conservez les données et demandez de l’aide au bureau.", "Los borradores no tienen una identidad válida. Conserve los datos y pida ayuda a la oficina.", "Die Entwürfe haben keine gültige Identität. Bewahren Sie die Daten auf und bitten Sie das Büro um Hilfe."],
    "unreadableDraft": ["Rascunho ilegível. Preserve os dados e peça revisão.", "Unreadable draft. Preserve the data and ask for a review.", "Brouillon illisible. Conservez les données et demandez une vérification.", "Borrador ilegible. Conserve los datos y pida una revisión.", "Der Entwurf ist unlesbar. Bewahren Sie die Daten auf und bitten Sie um Prüfung."],
    "mismatch": ["O rascunho não corresponde à piscina/visita ou está ilegível. Os dados foram preservados.", "The draft does not match the pool/visit or is unreadable. The data has been preserved.", "Le brouillon ne correspond pas à la piscine/visite ou est illisible. Les données ont été conservées.", "El borrador no corresponde a la piscina/visita o es ilegible. Se han conservado los datos.", "Der Entwurf gehört nicht zum Pool/Besuch oder ist unlesbar. Die Daten wurden aufbewahrt."],
    "poolChanged": ["A piscina da visita mudou. Preserve o rascunho e confirme a atribuição com o escritório.", "The visit’s pool has changed. Preserve the draft and confirm the assignment with the office.", "La piscine de la visite a changé. Conservez le brouillon et confirmez l’affectation avec le bureau.", "La piscina de la visita ha cambiado. Conserve el borrador y confirme la asignación con la oficina.", "Der Pool des Besuchs hat sich geändert. Bewahren Sie den Entwurf auf und klären Sie die Zuordnung mit dem Büro."],
    "changed": ["O rascunho mudou noutra janela. Compare os valores antes de guardar.", "The draft changed in another window. Compare the values before saving.", "Le brouillon a changé dans une autre fenêtre. Comparez les valeurs avant d’enregistrer.", "El borrador ha cambiado en otra ventana. Compare los valores antes de guardar.", "Der Entwurf wurde in einem anderen Fenster geändert. Vergleichen Sie die Werte vor dem Speichern."],
    "locksUnavailable": ["Este navegador não permite coordenar os rascunhos. Preserve os campos e reabra num navegador compatível.", "This browser cannot coordinate drafts. Preserve the fields and reopen in a compatible browser.", "Ce navigateur ne permet pas de coordonner les brouillons. Conservez les champs et rouvrez dans un navigateur compatible.", "Este navegador no permite coordinar los borradores. Conserve los campos y vuelva a abrir en un navegador compatible.", "Dieser Browser kann Entwürfe nicht koordinieren. Bewahren Sie die Felder auf und öffnen Sie die Seite in einem kompatiblen Browser erneut."],
    "existingCompletion": ["Existe uma conclusão guardada. Use o pedido original em Envios pendentes.", "A completion is already saved. Use the original request in pending submissions.", "Une clôture est déjà enregistrée. Utilisez la demande d’origine dans les envois en attente.", "Ya hay una finalización guardada. Use la solicitud original en los envíos pendientes.", "Ein Abschluss ist bereits gespeichert. Verwenden Sie die ursprüngliche Anfrage in den ausstehenden Übermittlungen."],
    "reviewBeforeSave": ["O rascunho exige revisão antes de guardar.", "The draft needs review before saving.", "Le brouillon doit être vérifié avant l’enregistrement.", "El borrador requiere revisión antes de guardar.", "Der Entwurf muss vor dem Speichern geprüft werden."],
    "invalidValues": ["O rascunho contém valores inválidos ou texto demasiado longo.", "The draft contains invalid values or text that is too long.", "Le brouillon contient des valeurs invalides ou un texte trop long.", "El borrador contiene valores no válidos o texto demasiado largo.", "Der Entwurf enthält ungültige Werte oder zu langen Text."],
    "saveUnconfirmed": ["Não foi possível confirmar a gravação do rascunho.", "Saving the draft could not be confirmed.", "L’enregistrement du brouillon n’a pas pu être confirmé.", "No se ha podido confirmar el guardado del borrador.", "Das Speichern des Entwurfs konnte nicht bestätigt werden."],
    "removed": ["O rascunho foi removido ou pertence a outra fase da visita. Copie os campos e reabra a visita.", "The draft was removed or belongs to another stage of the visit. Copy the fields and reopen the visit.", "Le brouillon a été supprimé ou appartient à une autre étape de la visite. Copiez les champs et rouvrez la visite.", "El borrador se ha eliminado o pertenece a otra fase de la visita. Copie los campos y vuelva a abrir la visita.", "Der Entwurf wurde entfernt oder gehört zu einer anderen Besuchsphase. Kopieren Sie die Felder und öffnen Sie den Besuch erneut."],
    "reopen": ["Reabra o formulário antes de concluir.", "Reopen the form before completing the visit.", "Rouvrez le formulaire avant de terminer la visite.", "Vuelva a abrir el formulario antes de finalizar la visita.", "Öffnen Sie das Formular erneut, bevor Sie den Besuch abschließen."],
    "reviewBeforeFinish": ["Reveja as diferenças do rascunho antes de concluir.", "Review the draft differences before completing the visit.", "Vérifiez les différences du brouillon avant de terminer la visite.", "Revise las diferencias del borrador antes de finalizar la visita.", "Prüfen Sie die Unterschiede im Entwurf, bevor Sie den Besuch abschließen."],
    "changedDuringPreparation": ["Os campos mudaram durante a preparação. A conclusão conserva os valores originais do pedido.", "The fields changed during preparation. The completion retains the original request values.", "Les champs ont changé pendant la préparation. La clôture conserve les valeurs de la demande d’origine.", "Los campos han cambiado durante la preparación. La finalización conserva los valores de la solicitud original.", "Die Felder haben sich während der Vorbereitung geändert. Der Abschluss behält die ursprünglichen Anfragewerte bei."],
    "chooseVisit": ["Escolha uma visita para registar o trabalho.", "Choose a visit to record the work.", "Choisissez une visite pour enregistrer le travail.", "Elija una visita para registrar el trabajo.", "Wählen Sie einen Besuch, um die Arbeit zu erfassen."],
    "sessionPreserved": ["A sessão mudou. O rascunho foi preservado.", "The session has changed. The draft has been preserved.", "La session a changé. Le brouillon a été conservé.", "La sesión ha cambiado. Se ha conservado el borrador.", "Die Sitzung hat sich geändert. Der Entwurf wurde aufbewahrt."],
    "extraCompleted": ["Visita extra concluída. Use Corrigir registo.", "Extra visit completed. Use Corrigir registo.", "Visite supplémentaire terminée. Utilisez Corrigir registo.", "Visita extra finalizada. Use Corrigir registo.", "Zusätzlicher Besuch abgeschlossen. Verwenden Sie Corrigir registo."],
    "confirmed": ["Conclusão confirmada. Rascunho preservado para consulta.", "Completion confirmed. Draft preserved for reference.", "Clôture confirmée. Brouillon conservé pour consultation.", "Finalización confirmada. Borrador conservado para consulta.", "Abschluss bestätigt. Entwurf zur Ansicht aufbewahrt."],
    "pendingCompletion": ["Conclusão guardada por confirmar. Use o pedido original em Envios pendentes.", "Completion saved, awaiting confirmation. Use the original request in pending submissions.", "Clôture enregistrée, à confirmer. Utilisez la demande d’origine dans les envois en attente.", "Finalización guardada, pendiente de confirmación. Use la solicitud original en los envíos pendientes.", "Abschluss gespeichert, Bestätigung ausstehend. Verwenden Sie die ursprüngliche Anfrage in den ausstehenden Übermittlungen."],
    "notSaved": ["Rascunho não guardado. Não feche a página. {detail}", "Draft not saved. Do not close the page. {detail}", "Brouillon non enregistré. Ne fermez pas la page. {detail}", "Borrador no guardado. No cierre la página. {detail}", "Entwurf nicht gespeichert. Schließen Sie die Seite nicht. {detail}"],
    "external": ["O rascunho mudou noutra janela. Compare os valores; os campos desta janela estão preservados.", "The draft changed in another window. Compare the values; the fields in this window are preserved.", "Le brouillon a changé dans une autre fenêtre. Comparez les valeurs ; les champs de cette fenêtre sont conservés.", "El borrador ha cambiado en otra ventana. Compare los valores; se conservan los campos de esta ventana.", "Der Entwurf wurde in einem anderen Fenster geändert. Vergleichen Sie die Werte; die Felder in diesem Fenster bleiben erhalten."],
    "checking": ["A verificar os pedidos guardados…", "Checking saved requests…", "Vérification des demandes enregistrées…", "Comprobando las solicitudes guardadas…", "Gespeicherte Anfragen werden geprüft…"],
    "saving": ["A guardar rascunho neste telemóvel…", "Saving draft on this phone…", "Enregistrement du brouillon sur ce téléphone…", "Guardando el borrador en este teléfono…", "Entwurf wird auf diesem Telefon gespeichert…"],
    "differences": ["Há diferenças por rever. Os valores foram preservados; reveja antes de concluir.", "There are differences to review. The values have been preserved; review them before completing the visit.", "Des différences doivent être vérifiées. Les valeurs ont été conservées ; vérifiez-les avant de terminer la visite.", "Hay diferencias pendientes de revisión. Se han conservado los valores; revíselos antes de finalizar la visita.", "Es gibt Unterschiede zu prüfen. Die Werte wurden aufbewahrt; prüfen Sie sie vor dem Abschluss des Besuchs."],
    "saved": ["Rascunho guardado neste telemóvel; ainda não submetido.", "Draft saved on this phone; not submitted yet.", "Brouillon enregistré sur ce téléphone ; pas encore envoyé.", "Borrador guardado en este teléfono; aún no enviado.", "Entwurf auf diesem Telefon gespeichert; noch nicht übermittelt."],
    "willSave": ["Os campos serão guardados neste telemóvel enquanto preenche.", "The fields will be saved on this phone as you fill them in.", "Les champs seront enregistrés sur ce téléphone au fur et à mesure de la saisie.", "Los campos se guardarán en este teléfono mientras los rellena.", "Die Felder werden während der Eingabe auf diesem Telefon gespeichert."],
    "compare": ["Comparar rascunhos", "Compare drafts", "Comparer les brouillons", "Comparar borradores", "Entwürfe vergleichen"],
    "retry": ["Guardar rascunho novamente", "Save draft again", "Réenregistrer le brouillon", "Volver a guardar el borrador", "Entwurf erneut speichern"],
    "keep": ["Manter este rascunho", "Keep this draft", "Conserver ce brouillon", "Mantener este borrador", "Diesen Entwurf behalten"],
    "use": ["Usar valor — {source}", "Use value — {source}", "Utiliser la valeur — {source}", "Usar valor — {source}", "Wert verwenden — {source}"],
    "valueLine": ["{source}: {value}", "{source}: {value}", "{source} : {value}", "{source}: {value}", "{source}: {value}"],
    "reviewLabel": ["Rever diferenças do rascunho", "Review draft differences", "Vérifier les différences du brouillon", "Revisar diferencias del borrador", "Unterschiede im Entwurf prüfen"],
    "summaryPending": ["{name} — rascunho de trabalho guardado, ainda não submetido.", "{name} — work draft saved, not submitted yet.", "{name} — brouillon de travail enregistré, pas encore envoyé.", "{name} — borrador de trabajo guardado, aún no enviado.", "{name} — Arbeitsentwurf gespeichert, noch nicht übermittelt."],
    "summaryUnknown": ["{name} — rascunho por guardar ou comparar. Não feche esta janela.", "{name} — draft needs saving or comparison. Do not close this window.", "{name} — brouillon à enregistrer ou à comparer. Ne fermez pas cette fenêtre.", "{name} — borrador pendiente de guardar o comparar. No cierre esta ventana.", "{name} — Entwurf muss gespeichert oder verglichen werden. Schließen Sie dieses Fenster nicht."]
  };
  const bindings = new WeakMap(), errors = new WeakMap(), entryErrors = new WeakMap();
  const copy = (key, params = {}) => ({key,params});
  function text(value) {
    if (!value || typeof value !== 'object') return String(value ?? '');
    if (value.store) return store.message(value.store);
    const language = String(document.documentElement.lang || 'pt').toLowerCase().split('-')[0];
    const index = Math.max(0,['pt','en','fr','es','de'].indexOf(language));
    return messages[value.key][index].replace(/\{(\w+)\}/g,(_,key)=>text(value.params[key]));
  }
  function paintCopy(node, attribute, value) {
    const rendered = text(value);
    if (attribute === 'textContent') { if (node.textContent !== rendered) node.textContent = rendered; }
    else if (node.getAttribute(attribute) !== rendered) node.setAttribute(attribute,rendered);
  }
  function setCopy(node, value, attribute = 'textContent') {
    if (!bindings.has(node)) { bindings.set(node,new Map());node.setAttribute('data-cw-field-draft-copy','');node.setAttribute('data-cw-no-i18n',''); }
    bindings.get(node).set(attribute,value);paintCopy(node,attribute,value);
  }
  function makeError(value) { const error = Error(text(value));errors.set(error,value);return error; }
  const problem = key => makeError(copy(key));
  function rememberError(entry, error) {
    entry.error = error.message;
    entryErrors.set(entry,{message:error.message,value:errors.get(error) || (error.copy?.key === 'fieldWriteError' ? {store:error.copy.params.code} : error.message)});
  }
  function entryErrorCopy(entry) { const saved = entryErrors.get(entry);return saved?.message === entry.error ? saved.value : entry.error; }
  const sourceCopy = source => copy({'Servidor':'server','Outra janela':'otherWindow','Registo anterior':'previousRecord','Nesta janela':'thisWindow'}[source]);
  function repaintCopy() {
    for (const node of document.querySelectorAll('[data-cw-field-draft-copy]'))
      for (const [attribute,value] of bindings.get(node) || []) paintCopy(node,attribute,value);
  }
  window.addEventListener('cw-language-change',repaintCopy);
  // Remote preferences and the shared i18n observer can apply a language silently.
  let observedLanguage = document.documentElement.lang;
  new MutationObserver(()=>{
    if (document.documentElement.lang === observedLanguage) return;
    observedLanguage = document.documentElement.lang;repaintCopy();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  // End presentation adapter.
  const valueIds = ['ph','chlorine','alkalinity','salt','orp','temperature','notes'];
  const checkIds = ['cleaned','vacuumed','basketCleaned','brushed','waterlineClean','backwashDone'];
  const fields = [...valueIds,...checkIds,'usedProducts','pendingProblems','startedAt','photos'];
  const labels = Object.fromEntries(fields.map(id=>[id,copy(id)]));
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
    if (typeof value === 'boolean') return copy(value ? 'yes' : 'no');
    if (Array.isArray(value)) return value.length ? value.map(row=>row.name ? [row.name,row.quantity,row.unit,row.notes].filter(Boolean).join(' · ') : row.fileName ? `${row.fileName} (${row.status || ''})` : row.message || JSON.stringify(row)).join('\n') : copy('none');
    return value || copy('empty');
  }
  function create(captured, hooks) {
    const storageKey = 'cwFieldVisitDrafts:v2:' + captured?.owner, entries = new Map();
    let panelEntry = null;
    const active = () => store.same(captured);
    function requireActive() { if (!active()) throw problem('originalSession'); }
    function read() {
      requireActive(); const raw = localStorage.getItem(storageKey); if (!raw) return {};
      let envelope; try { envelope = JSON.parse(raw); } catch (_) { throw problem('unreadableEnvelope'); }
      if (!envelope || envelope.v !== 2 || envelope.owner !== captured.owner || !object(envelope.drafts) || Object.entries(envelope.drafts).some(([key,value])=>!/^visit-(REGULAR|EXTRA)-[1-9][0-9]*$/.test(key) || !object(value))) throw problem('invalidIdentity');
      return envelope.drafts;
    }
    function validate(value, entry) {
      if (!value) return;
      if (!object(value.values) || !object(value.checks) || Object.entries(value.values).some(([id,v])=>valueIds.includes(id)&&typeof v!=='string') || Object.entries(value.checks).some(([id,v])=>checkIds.includes(id)&&typeof v!=='boolean') || !validateFields(flatten(value))) throw problem('unreadableDraft');
      const meta = value._draft;
      if (meta && (meta.v !== 1 || meta.poolId !== entry.poolId || meta.visitType !== entry.type || meta.visitId !== entry.id || !['WORK','CORRECTION'].includes(meta.mode) || !validateFields(meta.baseline) || !object(meta.conflicts) || !Number.isFinite(Date.parse(meta.savedAt)) || Object.entries(meta.conflicts).some(([id,proposals])=>!fields.includes(id) || !Array.isArray(proposals) || proposals.some(item=>!object(item) || !['Servidor','Outra janela','Registo anterior'].includes(item.source) || !validateFields({...meta.baseline,[id]:item.value}))))) throw problem('mismatch');
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
        } catch (error) { rememberError(entry,error); entry.invalid = true; }
      }
      if(entry.poolId!==(visit.poolId||visit.pool?.id)){entry.invalid=true;rememberError(entry,problem('poolChanged'));}
      if (!entry.invalid && !entry.external && !entry.request && !entry.readonly) reconcile(entry,server);
      void refresh(entry); return entry;
    }
    async function refresh(entry) {
      try { const row = await request(entry); requireActive(); entry.request = row; entry.checking = false; }
      catch (error) { if (active()) { rememberError(entry,error); entry.checking = false; } }
      notify(entry);
    }
    function check(entry, drafts) {
      validate(drafts[entry.key],entry);
      if (currentRaw(drafts,entry) !== entry.observed) { entry.external = true; throw problem('changed'); }
    }
    async function locked(entry, operation) {
      requireActive(); if (!navigator.locks?.request) throw problem('locksUnavailable');
      return navigator.locks.request(storageKey,async()=>{requireActive();entry.request=await request(entry);requireActive();if(entry.request)throw problem('existingCompletion');const drafts=read();check(entry,drafts);return operation(drafts);});
    }
    function write(entry, drafts) {
      requireActive(); if (entry.invalid || entry.external || entry.readonly) throw problem('reviewBeforeSave');
      if (!validateFields(entry.fields)) throw problem('invalidValues');
      const previous=drafts[entry.key];
      if(previous?._draft?.mode===entry.mode&&equal(flatten(previous),entry.fields)&&equal(previous._draft.baseline,entry.baseline)&&equal(previous._draft.conflicts,entry.conflicts)){entry.error='';return;}
      const saved = expand(entry.fields,entry.original);
      saved._draft = {v:1,visitId:entry.id,visitType:entry.type,poolId:entry.poolId,mode:entry.mode,baseline:clone(entry.baseline),conflicts:clone(entry.conflicts),savedAt:new Date().toISOString()};
      const raw = JSON.stringify({v:2,owner:captured.owner,drafts:{...drafts,[entry.key]:saved}});
      localStorage.setItem(storageKey,raw); if (localStorage.getItem(storageKey) !== raw) throw problem('saveUnconfirmed');
      entry.observed = JSON.stringify(saved); entry.observedFields = clone(entry.fields); entry.original = saved; entry.error = '';
    }
    function schedule(entry) {
      if (!entry || !active() || entry.readonly || entry.request) return Promise.resolve();
      ++entry.revision; ++entry.pending; notify(entry);
      entry.chain = entry.chain.catch(()=>{}).then(()=>locked(entry,drafts=>write(entry,drafts))).catch(error=>{if(active())rememberError(entry,error);}).finally(()=>{--entry.pending;notify(entry);});
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
        if (!saved || saved._draft && saved._draft.mode !== entry.mode) throw problem('removed');
        const remote = flatten(saved), reference = entry.observedFields;
        for (const id of fields) {
          if (sameField(id,entry.fields[id],reference[id])) { entry.fields[id] = clone(remote[id]); if (saved._draft?.conflicts[id]) entry.conflicts[id] = clone(saved._draft.conflicts[id]);else delete entry.conflicts[id]; }
          else if (!sameField(id,remote[id],reference[id]) && !sameField(id,remote[id],entry.fields[id])) proposal(entry,id,remote[id],'Outra janela');
        }
        entry.observed = currentRaw(drafts,entry); entry.observedFields = clone(remote); entry.external = false; entry.error = ''; notify(entry,true); await schedule(entry);
      } catch(error) { rememberError(entry,error); notify(entry); }
    }
    function choose(entry,id,value) {
      if (!active() || entry.external || entry.request || entry.invalid) return;
      entry.fields[id] = clone(value); entry.baseline[id] = clone(entry.server[id]); delete entry.conflicts[id]; notify(entry,true); void schedule(entry);
    }
    async function prepare(entry, operation) {
      if (!entry) throw problem('reopen');
      await entry.chain; requireActive();
      return locked(entry,async drafts=>{
        if (entry.pending || entry.error || entry.invalid || Object.keys(entry.conflicts).length) throw makeError(entry.error ? entryErrorCopy(entry) : copy('reviewBeforeFinish'));
        write(entry,drafts);
        const revision = entry.revision, result = await operation(); requireActive();
        entry.request = await request(entry);
        if (revision !== entry.revision) rememberError(entry,problem('changedDuringPreparation'));
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
      setCopy(target,copy('reviewLabel'),'aria-label');
      if (!entry) { target.replaceChildren();target.hidden=true;panelEntry=null;setCopy(status,copy('chooseVisit'));status.dataset.state='empty';return; }
      const conflicts = Object.keys(entry.conflicts).length;
      status.dataset.state = entry.error || entry.invalid || entry.external ? 'error' : entry.pending || entry.checking ? 'saving' : conflicts ? 'review' : entry.observed !== 'null' ? 'saved' : 'empty';
      setCopy(status,!active() ? copy('sessionPreserved') : entry.readonly ? copy('extraCompleted') : entry.request ? (entry.request.response ? copy('confirmed') : copy('pendingCompletion')) : entry.error ? copy('notSaved',{detail:entryErrorCopy(entry)}) : entry.external ? copy('external') : entry.checking ? copy('checking') : entry.pending ? copy('saving') : conflicts ? copy('differences') : entry.observed !== 'null' ? copy('saved') : copy('willSave'));
      const button = (label, action) => { const node=document.createElement('button');node.type='button';setCopy(node,label);node.style.cssText='min-height:44px;margin:4px;white-space:normal';node.onclick=action;return node; };
      if(entry.external&&!entry.invalid)panel.append(button(copy('compare'),()=>compare(entry)));
      else if(entry.error&&!entry.invalid&&!entry.request)panel.append(button(copy('retry'),()=>schedule(entry)));
      for(const [id,proposals] of Object.entries(entry.conflicts)){
        const row=document.createElement('div');row.dataset.draftField=id;row.dataset.draftValues=JSON.stringify([entry.fields[id],proposals]);row.style.cssText='margin:12px 0;padding:12px;border:1px solid #a1b5c8;border-radius:10px;overflow-wrap:anywhere;white-space:pre-wrap';
        const title=document.createElement('strong');setCopy(title,labels[id]);row.append(title);
        for(const [source,value] of [['Nesta janela',entry.fields[id]],...proposals.map(p=>[p.source,p.value])]){const text=document.createElement('p');setCopy(text,copy('valueLine',{source:sourceCopy(source),value:display(value)}));row.append(text);const pick=button(source==='Nesta janela'?copy('keep'):copy('use',{source:sourceCopy(source)}),()=>choose(entry,id,value));pick.disabled=entry.external||entry.invalid||!!entry.request;row.append(pick);}
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
      for(const entry of entries.values())try{const drafts=read();if(currentRaw(drafts,entry)!==entry.observed){entry.external=true;notify(entry);}}catch(error){rememberError(entry,error);entry.invalid=true;notify(entry);}
    });
    window.addEventListener('cw:field-write-change',()=>{if(active())for(const entry of entries.values())void refresh(entry);});
    window.addEventListener('beforeunload',event=>{if(active()&&[...entries.values()].some(entry=>entry.pending||entry.error||entry.external)){event.preventDefault();event.returnValue='';}});
    async function pendingSummary() {
      requireActive(); const drafts=read(),rows=[...await store.records('VISIT_COMPLETION',captured,true),...await store.records('EXTRA_VISIT_COMPLETION',captured,true)];
      const items=[];
      for(const [key,draft] of Object.entries(drafts)){
        const entry=[...entries.values()].find(item=>item.key===key);const meta=draft._draft;
        if(meta?.mode==='WORK'&&rows.some(row=>row.resourceId===meta.visitId&&row.scope===(meta.visitType==='EXTRA'?'EXTRA_VISIT_COMPLETION':'VISIT_COMPLETION')))continue;
        if(!meta||Object.keys(meta.conflicts||{}).length||fields.some(id=>!sameField(id,flatten(draft)[id],meta.baseline?.[id])))items.push({kind:'pending',text:text(copy('summaryPending',{name:entry?.name || key}))});
      }
      for(const entry of entries.values())if(entry.pending||entry.error||entry.external)items.push({kind:'unknown',text:text(copy('summaryUnknown',{name:entry.name}))});
      return items;
    }
    return {bind,save,prepare,acceptCorrection,paint,read,expand:entry=>expand(entry.fields,entry.original),pendingSummary};
  }
  window.CWFieldVisitDrafts = {create};
})();
