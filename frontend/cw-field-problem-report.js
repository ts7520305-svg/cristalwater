(function () {
  'use strict';
  const store=window.CWFieldWriteStore, captured=store?.session();
  const button=document.getElementById('saveProblemBtn'), card=button?.closest('section');
  if(!store||!card)return;
  const formMessages = {
    "section": ["Extras / problemas", "Extras / problems", "Extras / problèmes", "Extras / problemas", "Extras / Probleme"],
    "panel": ["Extra / problema", "Extra / problem", "Extra / problème", "Extra / problema", "Extra / Problem"],
    "register": ["Registar extra ou problema", "Report an extra or problem", "Signaler un extra ou un problème", "Registrar extra o problema", "Extra oder Problem melden"],
    "save": ["Guardar registo", "Save report", "Enregistrer le signalement", "Guardar incidencia", "Meldung speichern"],
    "close": ["Fechar", "Close", "Fermer", "Cerrar", "Schließen"],
    "categoryLabel": ["Classificação", "Classification", "Classification", "Clasificación", "Einstufung"],
    "typeLabel": ["Tipo de problema", "Problem type", "Type de problème", "Tipo de problema", "Problemart"],
    "severityLabel": ["Urgência", "Urgency", "Urgence", "Urgencia", "Dringlichkeit"],
    "description": ["Descrição da ocorrência", "Problem description", "Description du problème", "Descripción del problema", "Problembeschreibung"],
    "placeholder": ["Descreva o problema de forma simples", "Describe the problem simply", "Décrivez simplement le problème", "Describa el problema de forma sencilla", "Beschreiben Sie das Problem einfach"],
    "categoryNormal": ["Serviço normal", "Regular service", "Service habituel", "Servicio habitual", "Regulärer Service"],
    "categoryExtra": ["Extra / reparação", "Extra / repair", "Extra / réparation", "Extra / reparación", "Extra / Reparatur"],
    "typeCloudy": ["Água turva", "Cloudy water", "Eau trouble", "Agua turbia", "Trübes Wasser"],
    "typeEquipment": ["Equipamento", "Equipment", "Équipement", "Equipo", "Ausrüstung"],
    "typeLeak": ["Fuga", "Leak", "Fuite", "Fuga", "Leck"],
    "typeAccess": ["Acesso bloqueado", "Access blocked", "Accès bloqué", "Acceso bloqueado", "Zugang blockiert"],
    "typeAbsent": ["Cliente ausente", "Client absent", "Client absent", "Cliente ausente", "Kunde abwesend"],
    "typeOther": ["Outro", "Other", "Autre", "Otro", "Sonstiges"],
    "severityNormal": ["Normal", "Normal", "Normal", "Normal", "Normal"],
    "severityUrgent": ["Urgente", "Urgent", "Urgent", "Urgente", "Dringend"],
    "contextAssociated": ["Registo associado à visita {visit} · {pool}", "Report linked to visit {visit} · {pool}", "Signalement associé à la visite {visit} · {pool}", "Incidencia asociada a la visita {visit} · {pool}", "Meldung zu Besuch {visit} · {pool}"],
    "contextNew": ["Novo registo para a visita {visit} · {pool}", "New report for visit {visit} · {pool}", "Nouveau signalement pour la visite {visit} · {pool}", "Nueva incidencia para la visita {visit} · {pool}", "Neue Meldung für Besuch {visit} · {pool}"],
    "selectRegularContext": ["Selecione uma visita regular para preparar um novo registo.", "Select a regular visit to prepare a new report.", "Sélectionnez une visite régulière pour préparer un nouveau signalement.", "Seleccione una visita regular para preparar una nueva incidencia.", "Wählen Sie einen regulären Besuch für eine neue Meldung aus."],
    "pool": ["Piscina {id}", "Pool {id}", "Piscine {id}", "Piscina {id}", "Pool {id}"],
    "reviewSaved": ["Rever ocorrência guardada", "Review saved report", "Revoir le signalement enregistré", "Revisar incidencia guardada", "Gespeicherte Meldung prüfen"],
    "clearConfirmed": ["Limpar rascunho confirmado", "Clear confirmed draft", "Effacer le brouillon confirmé", "Borrar borrador confirmado", "Bestätigten Entwurf löschen"],
    "confirmSaved": ["Confirmar ocorrência guardada", "Confirm saved report", "Confirmer le signalement enregistré", "Confirmar incidencia guardada", "Gespeicherte Meldung bestätigen"],
    "sendVisit": ["Enviar ocorrência da visita {visit}", "Send report for visit {visit}", "Envoyer le signalement de la visite {visit}", "Enviar incidencia de la visita {visit}", "Meldung für Besuch {visit} senden"],
    "sessionRecover": ["A sessão mudou. Reabra com a conta original para recuperar o registo.", "The session changed. Reopen with the original account to recover the report.", "La session a changé. Rouvrez avec le compte d’origine pour récupérer le signalement.", "La sesión ha cambiado. Vuelva a abrir con la cuenta original para recuperar la incidencia.", "Die Sitzung hat sich geändert. Öffnen Sie die Seite mit dem ursprünglichen Konto erneut, um die Meldung wiederherzustellen."],
    "sessionChanged": ["A sessão mudou. Reabra a página para recuperar as ocorrências da conta atual.", "The session changed. Reopen the page to recover the current account’s reports.", "La session a changé. Rouvrez la page pour récupérer les signalements du compte actuel.", "La sesión ha cambiado. Vuelva a abrir la página para recuperar las incidencias de la cuenta actual.", "Die Sitzung hat sich geändert. Öffnen Sie die Seite erneut, um die Meldungen des aktuellen Kontos wiederherzustellen."],
    "unreadableDraft": ["Rascunho do registo ilegível. Preserve os dados e peça apoio ao escritório.", "The report draft is unreadable. Preserve the data and ask the office for support.", "Le brouillon du signalement est illisible. Conservez les données et demandez de l’aide au bureau.", "El borrador de la incidencia es ilegible. Conserve los datos y pida ayuda a la oficina.", "Der Meldungsentwurf ist unlesbar. Bewahren Sie die Daten auf und bitten Sie das Büro um Unterstützung."],
    "invalidDraft": ["Rascunho da ocorrência ilegível. Preserve os dados e peça apoio ao escritório.", "The problem report draft is invalid. Preserve the data and ask the office for support.", "Le brouillon du signalement est invalide. Conservez les données et demandez de l’aide au bureau.", "El borrador de la incidencia no es válido. Conserve los datos y pida ayuda a la oficina.", "Der Problemmeldungsentwurf ist ungültig. Bewahren Sie die Daten auf und bitten Sie das Büro um Unterstützung."],
    "crossWindow": ["O registo mudou noutra janela. Copie o texto desta janela e reabra para rever o rascunho guardado.", "The report changed in another window. Copy the text from this window and reopen to review the saved draft.", "Le signalement a changé dans une autre fenêtre. Copiez le texte de cette fenêtre et rouvrez pour vérifier le brouillon enregistré.", "La incidencia ha cambiado en otra ventana. Copie el texto de esta ventana y vuelva a abrir para revisar el borrador guardado.", "Die Meldung wurde in einem anderen Fenster geändert. Kopieren Sie den Text aus diesem Fenster und öffnen Sie die Seite erneut, um den gespeicherten Entwurf zu prüfen."],
    "saveUnconfirmed": ["Não foi possível confirmar a gravação neste dispositivo.", "Could not confirm saving on this device.", "Impossible de confirmer l’enregistrement sur cet appareil.", "No se ha podido confirmar el guardado en este dispositivo.", "Das Speichern auf diesem Gerät konnte nicht bestätigt werden."],
    "missingRequest": ["O registo do rascunho não foi encontrado. Preserve o texto e peça apoio ao escritório.", "The saved draft request was not found. Preserve the text and ask the office for support.", "La demande du brouillon enregistré est introuvable. Conservez le texte et demandez de l’aide au bureau.", "No se ha encontrado la solicitud del borrador guardado. Conserve el texto y pida ayuda a la oficina.", "Die Anfrage des gespeicherten Entwurfs wurde nicht gefunden. Bewahren Sie den Text auf und bitten Sie das Büro um Unterstützung."],
    "mismatch": ["O rascunho difere do registo guardado. Ambos foram preservados; peça revisão antes de enviar.", "The draft differs from the saved request. Both were preserved; ask for a review before sending.", "Le brouillon diffère de la demande enregistrée. Les deux ont été conservés ; demandez une vérification avant l’envoi.", "El borrador difiere de la solicitud guardada. Ambos se han conservado; solicite una revisión antes de enviar.", "Der Entwurf unterscheidet sich von der gespeicherten Anfrage. Beide wurden aufbewahrt; bitten Sie vor dem Senden um Prüfung."],
    "selectRegular": ["Selecione uma visita regular antes de preparar o registo.", "Select a regular visit before preparing the report.", "Sélectionnez une visite régulière avant de préparer le signalement.", "Seleccione una visita regular antes de preparar la incidencia.", "Wählen Sie einen regulären Besuch aus, bevor Sie die Meldung vorbereiten."],
    "locksUnsupported": ["Este navegador não permite coordenar as ocorrências. Preserve o texto.", "This browser cannot coordinate problem reports. Preserve the text.", "Ce navigateur ne permet pas de coordonner les signalements. Conservez le texte.", "Este navegador no permite coordinar las incidencias. Conserve el texto.", "Dieser Browser kann Problemmeldungen nicht koordinieren. Bewahren Sie den Text auf."],
    "lockInUse": ["O registo está em utilização noutra janela. Tente novamente.", "The report is in use in another window. Try again.", "Le signalement est utilisé dans une autre fenêtre. Réessayez.", "La incidencia está en uso en otra ventana. Inténtelo de nuevo.", "Die Meldung wird in einem anderen Fenster verwendet. Versuchen Sie es erneut."],
    "pendingDevice": ["Registo guardado neste dispositivo, por confirmar. {detail}", "Report saved on this device, awaiting confirmation. {detail}", "Signalement enregistré sur cet appareil, à confirmer. {detail}", "Incidencia guardada en este dispositivo, pendiente de confirmación. {detail}", "Meldung auf diesem Gerät gespeichert, Bestätigung ausstehend. {detail}"],
    "useConfirm": ["Use Confirmar ocorrência guardada.", "Use Confirm saved report.", "Utilisez Confirmer le signalement enregistré.", "Use Confirmar incidencia guardada.", "Verwenden Sie Gespeicherte Meldung bestätigen."],
    "unsaved": ["O texto não ficou guardado. Conserve-o e tente novamente.", "The text was not saved. Keep it and try again.", "Le texte n’a pas été enregistré. Conservez-le et réessayez.", "El texto no se ha guardado. Consérvelo e inténtelo de nuevo.", "Der Text wurde nicht gespeichert. Bewahren Sie ihn auf und versuchen Sie es erneut."],
    "confirmed": ["Registo #{id} registado para a administração. O registo não confirma leitura, orçamento ou reparação.", "Report #{id} recorded for administration. This does not confirm that it has been read, quoted or repaired.", "Signalement n°{id} enregistré pour l’administration. Cela ne confirme ni lecture, ni devis, ni réparation.", "Incidencia #{id} registrada para la administración. El registro no confirma lectura, presupuesto ni reparación.", "Meldung #{id} für die Verwaltung erfasst. Dies bestätigt weder das Lesen noch ein Angebot oder eine Reparatur."],
    "savedDraft": ["Rascunho guardado neste dispositivo; ainda não enviado.", "Draft saved on this device; not sent yet.", "Brouillon enregistré sur cet appareil ; pas encore envoyé.", "Borrador guardado en este dispositivo; aún no enviado.", "Entwurf auf diesem Gerät gespeichert; noch nicht gesendet."],
    "beforeSend": ["O registo ficará guardado nesta conta antes de enviar.", "The report will be saved in this account before sending.", "Le signalement sera enregistré dans ce compte avant l’envoi.", "La incidencia se guardará en esta cuenta antes de enviarse.", "Die Meldung wird vor dem Senden in diesem Konto gespeichert."],
    "unsavedError": ["O texto não ficou guardado. {detail}", "The text was not saved. {detail}", "Le texte n’a pas été enregistré. {detail}", "El texto no se ha guardado. {detail}", "Der Text wurde nicht gespeichert. {detail}"],
    "alreadyConfirmed": ["Registo já confirmado; o rascunho foi preservado. {detail}", "Report already confirmed; the draft was preserved. {detail}", "Signalement déjà confirmé ; le brouillon a été conservé. {detail}", "Incidencia ya confirmada; el borrador se ha conservado. {detail}", "Meldung bereits bestätigt; der Entwurf wurde aufbewahrt. {detail}"],
    "pendingError": ["Registo guardado, por confirmar. {detail}", "Report saved, awaiting confirmation. {detail}", "Signalement enregistré, à confirmer. {detail}", "Incidencia guardada, pendiente de confirmación. {detail}", "Meldung gespeichert, Bestätigung ausstehend. {detail}"],
    "notSent": ["O registo não foi enviado. {detail}", "The report was not sent. {detail}", "Le signalement n’a pas été envoyé. {detail}", "La incidencia no se ha enviado. {detail}", "Die Meldung wurde nicht gesendet. {detail}"]
  };
  const descriptors=new WeakSet(), errorCopies=new WeakMap(), bindings=new Map();
  const copy=(key,params={})=>{const value={key,params};descriptors.add(value);return value;};
  function text(value,language=document.documentElement.lang||'pt'){
    if(!value||typeof value!=='object'||!descriptors.has(value))return String(value);
    const index=Math.max(0,['pt','en','fr','es','de'].indexOf(String(language).toLowerCase().split('-')[0]));
    return (formMessages[value.key]||summaryMessages[value.key])[index].replace(/\{(\w+)\}/g,(_,key)=>text(value.params[key],language));
  }
  function setCopy(node,value,attribute=''){
    if(!node)return;
    if(!bindings.has(node))bindings.set(node,new Map());bindings.get(node).set(attribute,value);node.setAttribute('data-cw-no-i18n','');
    const rendered=text(value);if(attribute){if(node.getAttribute(attribute)!==rendered)node.setAttribute(attribute,rendered);}else if(node.textContent!==rendered)node.textContent=rendered;
  }
  function repaintCopy(){for(const [node,values]of bindings)for(const [attribute,value]of values)setCopy(node,value,attribute);}
  function ownError(key){const value=copy(key),error=Error(text(value,'pt'));errorCopies.set(error,value);return error;}
  const errorCopy=error=>errorCopies.get(error)||error.message;
  card.style.marginBottom='calc(96px + env(safe-area-inset-bottom, 0px))';
  const scope='FIELD_PROBLEM_REPORT', key=captured?'cwFieldProblemDraft:'+captured.owner:null;
  const fields={category:'problemCategory',type:'problemType',severity:'problemSeverity',message:'problemText'};
  const panel=document.getElementById('problemPanel');let opened=false;
  const nodes=Object.fromEntries(Object.entries(fields).map(([field,id])=>[field,document.getElementById(id)]));
  const payloadFields=['visitType','visitId','poolId',...Object.keys(fields)];
  const blank=()=>({v:1,owner:captured?.owner,visitType:'REGULAR',visitId:null,poolId:null,poolName:'',category:'Servico normal',type:'Agua turva',severity:'Normal',message:'',requestId:null});
  let draft=blank(), observed, state=null, busy=false, conflict=false, closed=false, revision=0, unsaved=false, ready=false;
  const target=document.createElement('p');target.id='problemReportContext';
  const status=document.createElement('p');status.id='problemReportStatus';status.setAttribute('role','status');
  const legacy=document.createElement('p');legacy.id='problemReportLegacyStatus';legacy.className='muted';
  const recover=document.createElement('button');recover.type='button';recover.id='recoverProblemReportBtn';recover.className='big';recover.hidden=true;
  card.querySelector('.admin-alert-grid').before(target);card.append(status,legacy,recover);
  nodes.message.maxLength=5000;setCopy(nodes.message,copy('description'),'aria-label');
  for(const node of [target,status,legacy])node.style.overflowWrap='anywhere';
  function active(){return !closed&&store.same(captured);}
  function requireActive(){if(!active())throw ownError('sessionRecover');}
  const id=value=>Number.isSafeInteger(value)&&value>0;
  const current=()=>{const value=window.CWFieldVisitContext?.();return value?.visitType==='REGULAR'&&id(value.id)&&id(value.poolId)?value:null;};
  const payload=value=>Object.fromEntries(payloadFields.map(field=>[field,value[field]]));
  const samePayload=(a,b)=>payloadFields.every(field=>a[field]===b[field]);
  const hasContent=value=>value.message!==''||value.category!=='Servico normal'||value.type!=='Agua turva'||value.severity!=='Normal';
  function read(){
    requireActive();const raw=localStorage.getItem(key);let value;
    try{value=raw?JSON.parse(raw):blank();}catch(_){throw ownError('unreadableDraft');}
    if(!value||Object.keys(value).length!==Object.keys(blank()).length||Object.keys(value).some(field=>!Object.hasOwn(blank(),field))||value.v!==1||value.owner!==captured.owner||value.visitType!=='REGULAR'||![value.visitId,value.poolId].every(value=>value===null||id(value))||Boolean(value.visitId)!==Boolean(value.poolId)||typeof value.poolName!=='string'||!['Servico normal','Extra / reparacao'].includes(value.category)||!['Agua turva','Equipamento','Fuga','Acesso bloqueado','Cliente ausente','Outro'].includes(value.type)||!['Normal','Urgente'].includes(value.severity)||typeof value.message!=='string'||value.message.length>5000||(value.requestId!==null&&!/^[0-9a-f-]{36}$/i.test(value.requestId)))throw ownError('invalidDraft');
    if(observed===undefined)observed=raw;return value;
  }
  function write(value){
    requireActive();read();
    if(localStorage.getItem(key)!==observed){conflict=true;throw ownError('crossWindow');}
    const raw=JSON.stringify(value);localStorage.setItem(key,raw);
    if(localStorage.getItem(key)!==raw)throw ownError('saveUnconfirmed');
    observed=raw;draft=value;unsaved=false;
  }
  function show(value){for(const field of Object.keys(fields))nodes[field].value=value[field];}
  function contextChanged(){
    const selected=current(), value=state?.payload||draft, original=id(value.visitId), same=!!selected&&(!original||selected.id===value.visitId&&selected.poolId===value.poolId);
    setCopy(target,original?copy('contextAssociated',{visit:value.visitId,pool:state?.label||draft.poolName||copy('pool',{id:value.poolId})}):selected?copy('contextNew',{visit:selected.id,pool:selected.poolName||copy('pool',{id:selected.poolId})}):copy('selectRegularContext'));
    panel.hidden=!opened;
    const locked=busy||conflict||!active()||!ready;
    for(const node of Object.values(nodes)){if(node.tagName==='SELECT')node.disabled=locked||!!state||(!selected&&!original);else node.readOnly=locked||!!state||(!selected&&!original);}
    button.disabled=locked||!!state||!same;
    button.hidden=!!state||(original&&!same);
    recover.hidden=!state&&!(original&&!same)&&!(hasContent(draft)&&!opened);
    recover.disabled=locked;
    setCopy(recover,copy(!opened?'reviewSaved':state?.response?'clearConfirmed':state?'confirmSaved':'sendVisit',{visit:value.visitId}));
  }
  function legacyNotice(){
    let key='';
    try{const raw=localStorage.getItem('cwFieldProblems');if(raw){const rows=JSON.parse(raw);if(!(Array.isArray(rows)&&rows.length===0))key='legacy';}}
    catch(_){key='legacyUnreadable';}
    setCopy(legacy,key?copy(key):'');return key;
  }
  async function refresh(){
    if(busy)return;const generation=++revision;
    if(!active()){show(blank());draft=blank();state=null;ready=false;setCopy(target,'');setCopy(status,copy('sessionChanged'));contextChanged();return;}
    try{
      const saved=read(),rows=await store.records(scope,captured,true);
      if(!active()||generation!==revision||busy)return;
      if(conflict){contextChanged();return;}
      if(!unsaved)draft=saved;
      state=rows.find(row=>!row.response)||(draft.requestId?rows.find(row=>row.requestId===draft.requestId):null);
      if(draft.requestId&&!state)throw ownError('missingRequest');
      if(state&&draft.visitId&&!samePayload(draft,state.payload))throw ownError('mismatch');
      if(state){draft={...blank(),...state.payload,poolName:state.label,requestId:state.requestId};show(draft);}else if(!unsaved)show(draft);
      if(!ready&&(state||hasContent(draft)))opened=true;ready=true;contextChanged();legacyNotice();
      const confirmed=state?.response||rows.filter(row=>row.response).at(-1)?.response;
      setCopy(status,state&&!state.response?copy('pendingDevice',{detail:state.failure?.message||copy('useConfirm')}):unsaved?copy('unsaved'):confirmed?copy('confirmed',{id:confirmed.problemReport.repairId}):copy(draft.visitId?'savedDraft':'beforeSend'));
    }catch(error){if(active()&&generation===revision){conflict=true;contextChanged();setCopy(status,errorCopy(error));}}
  }
  function collect(){
    requireActive();const selected=current();
    if(!draft.visitId&&!selected)throw ownError('selectRegular');
    const value={...draft,...(!draft.visitId?{visitId:selected.id,poolId:selected.poolId,poolName:selected.poolName||'Piscina '+selected.poolId}:{}),...Object.fromEntries(Object.keys(fields).map(field=>[field,nodes[field].value]))};
    return hasContent(value)?value:blank();
  }
  function saveDraft(){
    if(busy||state||conflict||!ready)return;++revision;
    try{draft=collect();unsaved=true;write(draft);setCopy(status,copy('savedDraft'));}
    catch(error){setCopy(status,copy('unsavedError',{detail:errorCopy(error)}));}
    contextChanged();
  }
  function clearConfirmed(){write(blank());state=null;opened=false;show(draft);}
  const summaryMessages={
    unlinked:['sem associação','unlinked','sans association','sin asociación','ohne Zuordnung'],
    pending:['Visita {visit} — ocorrência por confirmar. Abra Mais → Extras / problemas{blocked}.','Visit {visit} — problem report awaiting confirmation. Open More → Extras / problems{blocked}.','Visite {visit} — signalement à confirmer. Ouvrez Plus → Extras / problèmes{blocked}.','Visita {visit} — incidencia pendiente de confirmación. Abra Más → Extras / problemas{blocked}.','Besuch {visit} — Problemmeldung wartet auf Bestätigung. Öffnen Sie Mehr → Extras / Probleme{blocked}.'],
    blocked:['; confirme o contexto com o escritório','; confirm the context with the office','; confirmez le contexte avec le bureau','; confirme el contexto con la oficina','; klären Sie den Kontext mit dem Büro'],
    unsaved:['A ocorrência não ficou guardada. Conserve o texto em Mais → Extras / problemas.','The problem report was not saved. Keep the text in More → Extras / problems.','Le signalement n’a pas été enregistré. Conservez le texte dans Plus → Extras / problèmes.','La incidencia no se ha guardado. Conserve el texto en Más → Extras / problemas.','Die Problemmeldung wurde nicht gespeichert. Bewahren Sie den Text unter Mehr → Extras / Probleme auf.'],
    draft:['Visita {visit} — rascunho de ocorrência por enviar em Mais → Extras / problemas.','Visit {visit} — problem report draft awaiting submission in More → Extras / problems.','Visite {visit} — brouillon de signalement à envoyer dans Plus → Extras / problèmes.','Visita {visit} — borrador de incidencia pendiente de envío en Más → Extras / problemas.','Besuch {visit} — Problemmeldungsentwurf wartet auf Versand unter Mehr → Extras / Probleme.'],
    legacy:['Há registos antigos de ocorrências sem conta confirmada neste dispositivo. Foram preservados; peça revisão ao escritório. Não serão enviados automaticamente.','There are old problem reports without a confirmed account on this device. They have been preserved; ask the office to review them. They will not be sent automatically.','Des signalements anciens sans compte confirmé sont présents sur cet appareil. Ils ont été conservés ; demandez leur vérification au bureau. Ils ne seront pas envoyés automatiquement.','Hay incidencias antiguas sin cuenta confirmada en este dispositivo. Se han conservado; solicite su revisión a la oficina. No se enviarán automáticamente.','Es gibt alte Problemmeldungen ohne bestätigtes Konto auf diesem Gerät. Sie wurden aufbewahrt; bitten Sie das Büro um Prüfung. Sie werden nicht automatisch gesendet.'],
    legacyUnreadable:['O histórico antigo não pôde ser lido. Preserve os dados e peça revisão ao escritório.','The old history could not be read. Preserve the data and ask the office to review it.','L’ancien historique n’a pas pu être lu. Conservez les données et demandez leur vérification au bureau.','No se ha podido leer el historial antiguo. Conserve los datos y solicite su revisión a la oficina.','Der alte Verlauf konnte nicht gelesen werden. Bewahren Sie die Daten auf und bitten Sie das Büro um Prüfung.']
  };
  function summaryItem(kind,key,parameters={}){
    const reviewText=Object.freeze(Object.fromEntries(['pt','en','fr','es','de'].map((language,index)=>{
      const values={...parameters,visit:key==='pending'?(parameters.visit||summaryMessages.unlinked[index]):parameters.visit,blocked:parameters.blocked?summaryMessages.blocked[index]:''};
      return [language,summaryMessages[key][index].replace(/\{(\w+)\}/g,(_,name)=>String(values[name]))];
    })));
    // Preserve the Portuguese JSON contract; only captured strings reach the review.
    const item={kind,text:reviewText.pt};Object.defineProperty(item,'reviewText',{value:reviewText});return item;
  }
  async function pendingSummary(){
    requireActive();const saved=read(), rows=await store.records(scope,captured,true);requireActive();const items=[];
    for(const row of rows.filter(row=>!row.response))items.push(summaryItem('pending','pending',{visit:row.payload.visitId,blocked:row.failure?.blocked}));
    if((unsaved||hasContent(saved))&&!rows.some(row=>row.requestId===saved.requestId||!row.response&&samePayload(row.payload,saved)))items.push(summaryItem('pending',unsaved?'unsaved':'draft',{visit:saved.visitId}));
    const legacyKey=legacyNotice();if(legacyKey)items.push(summaryItem('unknown',legacyKey));
    return items;
  }
  async function send(){
    if(busy||conflict||!ready)return;busy=true;contextChanged();let message='';
    try{
      requireActive();
      if(!navigator.locks?.request)throw ownError('locksUnsupported');
      await navigator.locks.request('cw-field-problem-draft:'+captured.owner,{ifAvailable:true},async lock=>{
        if(!lock)throw ownError('lockInUse');
        requireActive();
        if(state?.response){clearConfirmed();return;}
        const value=state?{...draft,...state.payload,requestId:state.requestId}:collect();
        write(value);
        state=await store.prepare(scope,captured.technicianId,payload(value),{label:value.poolName},captured);
        write({...value,requestId:state.requestId});
        await store.send(state.requestId,captured);state=await store.get(state.requestId,captured);
        clearConfirmed();
      });
    }catch(error){message=errorCopy(error);}
    finally{busy=false;if(!message||state||!active())await refresh();else contextChanged();if(message&&active())setCopy(status,copy(state?.response?'alreadyConfirmed':state?'pendingError':'notSent',{detail:message}));}
  }
  for(const node of Object.values(nodes))node.addEventListener(node.tagName==='SELECT'?'change':'input',saveDraft);
  function open(){requireActive();opened=true;contextChanged();nodes.message.focus();}
  function close(){opened=false;contextChanged();}
  recover.addEventListener('click',()=>opened?send():open());
  window.addEventListener('storage',event=>{if(event.key===key&&event.newValue!==observed&&!busy){conflict=true;setCopy(status,copy('crossWindow'));contextChanged();}if(!active())refresh();});
  window.addEventListener('cw:field-write-change',refresh);
  window.addEventListener('pagehide',()=>{closed=true;++revision;});
  window.addEventListener('pageshow',()=>{closed=false;refresh();});
  setInterval(()=>{if(!active())refresh();},1000);
  window.CWFieldProblemReport={send,refresh,contextChanged,pendingSummary,open,close};
  // Translate presentation only: option values, input values and stored records stay unchanged.
  setCopy(card.querySelector(':scope > .chip'),copy('section'));setCopy(panel.querySelector('.chip'),copy('panel'));
  for(const [id,key]of [['problemBtn','register'],['saveProblemBtn','save'],['cancelProblemBtn','close']])setCopy(document.getElementById(id),copy(key));
  for(const [field,key]of [['category','categoryLabel'],['type','typeLabel'],['severity','severityLabel']])setCopy(nodes[field],copy(key),'aria-label');
  setCopy(nodes.message,copy('placeholder'),'placeholder');
  const optionKeys={category:['categoryNormal','categoryExtra'],type:['typeCloudy','typeEquipment','typeLeak','typeAccess','typeAbsent','typeOther'],severity:['severityNormal','severityUrgent']};
  for(const [field,keys]of Object.entries(optionKeys))for(const [index,option]of [...nodes[field].options].entries())setCopy(option,copy(keys[index]));
  window.addEventListener('cw-language-change',repaintCopy);
  let observedLanguage=document.documentElement.lang;
  new MutationObserver(()=>{if(observedLanguage===document.documentElement.lang)return;observedLanguage=document.documentElement.lang;repaintCopy();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  contextChanged();refresh();
})();
