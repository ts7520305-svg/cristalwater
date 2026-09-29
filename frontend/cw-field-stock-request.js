(function () {
  'use strict';
  const store=window.CWFieldWriteStore, captured=store?.session();
  const button=document.getElementById('sendAdminAlertBtn'), card=button?.closest('section');
  if(!store||!card)return;
  card.style.marginBottom='calc(96px + env(safe-area-inset-bottom, 0px))';
  const scope='FIELD_STOCK_REQUEST', key=captured?'cwFieldStockDraft:'+captured.owner:null;
  const fields={requestType:'adminAlertType',priority:'adminAlertPriority',productName:'stockProductName',quantity:'stockQuantity',unit:'stockUnit',message:'adminAlertMessage'};
  const nodes=Object.fromEntries(Object.entries(fields).map(([field,id])=>[field,document.getElementById(id)]));
  const payloadFields=['visitType','visitId','poolId',...Object.keys(fields)];
  const blank=()=>({v:1,owner:captured?.owner,visitType:'REGULAR',visitId:null,poolId:null,poolName:'',requestType:'STOCK_REQUEST',priority:'NORMAL',productName:'',quantity:'',unit:'',message:'',requestId:null});
  let draft=blank(), observed, state=null, busy=false, conflict=false, closed=false, revision=0, unsaved=false, ready=false;
  const target=document.createElement('p');target.id='adminAlertContext';
  const status=document.createElement('p');status.id='adminAlertStatus';status.setAttribute('role','status');
  const legacy=document.createElement('p');legacy.id='adminAlertLegacyStatus';legacy.className='muted';
  const recover=document.createElement('button');recover.type='button';recover.id='recoverAdminAlertBtn';recover.className='big';recover.hidden=true;
  card.querySelector('.admin-alert-grid').before(target);button.closest('.actions').before(status,legacy);button.after(recover);
  for(const [field,max] of [['productName',200],['quantity',40],['unit',40],['message',5000]])nodes[field].maxLength=max;
  // Only owned presentation text is translated. Descriptors stay in memory;
  // saved drafts, server failures, payloads and receipts remain original data.
  const messages = {
    "title": ["Alerta administrador / stock", "Administration / stock alert", "Alerte administration / stock", "Aviso a administración / existencias", "Meldung an Verwaltung / Lager"],
    "intro": ["Pedir material, reportar stock baixo ou enviar nota ao escritório.", "Request materials, report low stock or send a note to the office.", "Demandez du matériel, signalez un stock faible ou envoyez une note au bureau.", "Pida material, avise de existencias bajas o envíe una nota a la oficina.", "Material anfordern, niedrigen Bestand melden oder eine Notiz an das Büro senden."],
    "type": ["Tipo de aviso", "Alert type", "Type d’alerte", "Tipo de aviso", "Art der Meldung"],
    "priority": ["Prioridade", "Priority", "Priorité", "Prioridad", "Priorität"],
    "stock": ["Falta de material", "Material shortage", "Manque de matériel", "Falta de material", "Material fehlt"],
    "purchase": ["Lembrete de compra", "Purchase reminder", "Rappel d’achat", "Recordar compra", "Einkaufserinnerung"],
    "note": ["Nota ao escritório", "Note to the office", "Note au bureau", "Nota a la oficina", "Notiz ans Büro"],
    "normal": ["Normal", "Normal", "Normale", "Normal", "Normal"],
    "high": ["Urgente", "Urgent", "Urgente", "Urgente", "Dringend"],
    "productLabel": ["Material ou produto", "Material or product", "Matériel ou produit", "Material o producto", "Material oder Produkt"],
    "quantityLabel": ["Quantidade opcional", "Optional quantity", "Quantité facultative", "Cantidad opcional", "Menge (optional)"],
    "unitLabel": ["Unidade", "Unit", "Unité", "Unidad", "Einheit"],
    "messageLabel": ["Nota para a administração", "Note to administration", "Note à l’administration", "Nota a administración", "Notiz an die Verwaltung"],
    "productHint": ["Material/produto. Ex: cloro shock", "Material/product. E.g. shock chlorine", "Matériel/produit. Ex. : chlore choc", "Material/producto. Ej.: cloro de choque", "Material/Produkt, z. B. Schockchlor"],
    "quantityHint": ["Qtd. opcional", "Qty. (optional)", "Qté facultative", "Cant. opcional", "Menge (optional)"],
    "unitHint": ["Un. ex: kg", "Unit, e.g. kg", "Unité, ex. : kg", "Unidad, ej.: kg", "Einheit, z. B. kg"],
    "messageHint": ["Escreva o que falta ou o que o administrador deve saber", "Describe what is missing or what administration needs to know", "Indiquez ce qui manque ou ce que l’administration doit savoir", "Indique lo que falta o lo que administración debe saber", "Beschreiben Sie, was fehlt oder was die Verwaltung wissen muss"],
    "send": ["Enviar aviso ao administrador", "Send alert to administration", "Envoyer l’alerte à l’administration", "Enviar aviso a administración", "Meldung an die Verwaltung senden"],
    "originalSession": ["A sessão mudou. Reabra com a conta original para recuperar o pedido.", "The session has changed. Reopen with the original account to recover the request.", "La session a changé. Rouvrez avec le compte d’origine pour récupérer la demande.", "La sesión ha cambiado. Vuelva a abrir con la cuenta original para recuperar la solicitud.", "Die Sitzung hat sich geändert. Öffnen Sie die Seite mit dem ursprünglichen Konto erneut, um die Anfrage wiederherzustellen."],
    "unreadable": ["Rascunho do pedido ilegível. Preserve os dados e peça apoio ao escritório.", "Unreadable request draft. Preserve the data and ask the office for help.", "Brouillon de demande illisible. Conservez les données et demandez de l’aide au bureau.", "Borrador de solicitud ilegible. Conserve los datos y pida ayuda a la oficina.", "Der Anfrageentwurf ist unlesbar. Bewahren Sie die Daten auf und bitten Sie das Büro um Hilfe."],
    "changed": ["O pedido mudou noutra janela. Copie o texto desta janela e reabra para rever o rascunho guardado.", "The request changed in another window. Copy the text from this window and reopen to review the saved draft.", "La demande a changé dans une autre fenêtre. Copiez le texte de cette fenêtre et rouvrez pour revoir le brouillon enregistré.", "La solicitud ha cambiado en otra ventana. Copie el texto de esta ventana y vuelva a abrir para revisar el borrador guardado.", "Die Anfrage wurde in einem anderen Fenster geändert. Kopieren Sie den Text aus diesem Fenster und öffnen Sie die Seite erneut, um den gespeicherten Entwurf zu prüfen."],
    "saveUnconfirmed": ["Não foi possível confirmar a gravação neste dispositivo.", "Saving on this device could not be confirmed.", "L’enregistrement sur cet appareil n’a pas pu être confirmé.", "No se ha podido confirmar el guardado en este dispositivo.", "Das Speichern auf diesem Gerät konnte nicht bestätigt werden."],
    "pool": ["Piscina {id}", "Pool {id}", "Piscine {id}", "Piscina {id}", "Pool {id}"],
    "associated": ["Pedido associado à visita {id} · {name}", "Request linked to visit {id} · {name}", "Demande associée à la visite {id} · {name}", "Solicitud asociada a la visita {id} · {name}", "Anfrage zu Besuch {id} · {name}"],
    "newRequest": ["Novo pedido para a visita {id} · {name}", "New request for visit {id} · {name}", "Nouvelle demande pour la visite {id} · {name}", "Nueva solicitud para la visita {id} · {name}", "Neue Anfrage für Besuch {id} · {name}"],
    "choose": ["Selecione uma visita regular para preparar um novo pedido.", "Select a regular visit to prepare a new request.", "Sélectionnez une visite régulière pour préparer une nouvelle demande.", "Seleccione una visita regular para preparar una nueva solicitud.", "Wählen Sie einen regulären Besuch, um eine neue Anfrage vorzubereiten."],
    "clear": ["Limpar rascunho confirmado", "Clear confirmed draft", "Effacer le brouillon confirmé", "Borrar borrador confirmado", "Bestätigten Entwurf löschen"],
    "confirm": ["Confirmar pedido guardado", "Confirm saved request", "Confirmer la demande enregistrée", "Confirmar solicitud guardada", "Gespeicherte Anfrage bestätigen"],
    "sendVisit": ["Enviar pedido da visita {id}", "Send request for visit {id}", "Envoyer la demande de la visite {id}", "Enviar solicitud de la visita {id}", "Anfrage für Besuch {id} senden"],
    "legacy": ["Há avisos antigos sem conta confirmada neste dispositivo. Foram preservados; peça revisão ao escritório. Não serão enviados automaticamente.", "There are old alerts with no confirmed account on this device. They have been preserved; ask the office to review them. They will not be sent automatically.", "Cet appareil contient d’anciennes alertes sans compte confirmé. Elles ont été conservées ; demandez au bureau de les vérifier. Elles ne seront pas envoyées automatiquement.", "Hay avisos antiguos sin cuenta confirmada en este dispositivo. Se han conservado; pida a la oficina que los revise. No se enviarán automáticamente.", "Auf diesem Gerät gibt es alte Meldungen ohne bestätigtes Konto. Sie wurden aufbewahrt; bitten Sie das Büro um Prüfung. Sie werden nicht automatisch gesendet."],
    "legacyUnreadable": ["O histórico antigo não pôde ser lido. Preserve os dados e peça revisão ao escritório.", "The old history could not be read. Preserve the data and ask the office to review it.", "L’ancien historique n’a pas pu être lu. Conservez les données et demandez au bureau de le vérifier.", "No se ha podido leer el historial antiguo. Conserve los datos y pida a la oficina que lo revise.", "Der alte Verlauf konnte nicht gelesen werden. Bewahren Sie die Daten auf und bitten Sie das Büro um Prüfung."],
    "currentSession": ["A sessão mudou. Reabra a página para recuperar os pedidos da conta atual.", "The session has changed. Reopen the page to recover the current account’s requests.", "La session a changé. Rouvrez la page pour récupérer les demandes du compte actuel.", "La sesión ha cambiado. Vuelva a abrir la página para recuperar las solicitudes de la cuenta actual.", "Die Sitzung hat sich geändert. Öffnen Sie die Seite erneut, um die Anfragen des aktuellen Kontos wiederherzustellen."],
    "missing": ["O pedido do rascunho não foi encontrado. Preserve o texto e peça apoio ao escritório.", "The draft request was not found. Preserve the text and ask the office for help.", "La demande du brouillon est introuvable. Conservez le texte et demandez de l’aide au bureau.", "No se ha encontrado la solicitud del borrador. Conserve el texto y pida ayuda a la oficina.", "Die Anfrage des Entwurfs wurde nicht gefunden. Bewahren Sie den Text auf und bitten Sie das Büro um Hilfe."],
    "mismatch": ["O rascunho difere do pedido guardado. Ambos foram preservados; peça revisão antes de enviar.", "The draft differs from the saved request. Both have been preserved; ask for a review before sending.", "Le brouillon diffère de la demande enregistrée. Les deux ont été conservés ; demandez une vérification avant l’envoi.", "El borrador difiere de la solicitud guardada. Se han conservado ambos; pida una revisión antes de enviar.", "Der Entwurf weicht von der gespeicherten Anfrage ab. Beide wurden aufbewahrt; bitten Sie vor dem Senden um Prüfung."],
    "pending": ["Pedido guardado neste dispositivo, por confirmar. {detail}", "Request saved on this device, awaiting confirmation. {detail}", "Demande enregistrée sur cet appareil, à confirmer. {detail}", "Solicitud guardada en este dispositivo, por confirmar. {detail}", "Anfrage auf diesem Gerät gespeichert, Bestätigung ausstehend. {detail}"],
    "useConfirm": ["Use Confirmar pedido guardado.", "Use Confirm saved request.", "Utilisez Confirmer la demande enregistrée.", "Use Confirmar solicitud guardada.", "Wählen Sie Gespeicherte Anfrage bestätigen."],
    "unsaved": ["O texto não ficou guardado. Conserve-o e tente novamente.", "The text was not saved. Keep it and try again.", "Le texte n’a pas été enregistré. Conservez-le et réessayez.", "El texto no se ha guardado. Consérvelo e inténtelo de nuevo.", "Der Text wurde nicht gespeichert. Bewahren Sie ihn auf und versuchen Sie es erneut."],
    "confirmed": ["Pedido #{id} registado para a administração. A leitura e a compra ainda não estão confirmadas.", "Request #{id} recorded for administration. Reading and purchase have not yet been confirmed.", "Demande n°{id} enregistrée pour l’administration. La lecture et l’achat ne sont pas encore confirmés.", "Solicitud n.º {id} registrada para administración. La lectura y la compra aún no están confirmadas.", "Anfrage #{id} für die Verwaltung erfasst. Das Lesen und der Einkauf wurden noch nicht bestätigt."],
    "draftSaved": ["Rascunho guardado neste dispositivo; ainda não enviado.", "Draft saved on this device; not sent yet.", "Brouillon enregistré sur cet appareil ; pas encore envoyé.", "Borrador guardado en este dispositivo; aún no enviado.", "Entwurf auf diesem Gerät gespeichert; noch nicht gesendet."],
    "beforeSend": ["O pedido ficará guardado nesta conta antes de enviar.", "The request will be saved under this account before sending.", "La demande sera enregistrée dans ce compte avant l’envoi.", "La solicitud se guardará en esta cuenta antes de enviarse.", "Die Anfrage wird vor dem Senden unter diesem Konto gespeichert."],
    "chooseBefore": ["Selecione uma visita regular antes de preparar o pedido.", "Select a regular visit before preparing the request.", "Sélectionnez une visite régulière avant de préparer la demande.", "Seleccione una visita regular antes de preparar la solicitud.", "Wählen Sie einen regulären Besuch, bevor Sie die Anfrage vorbereiten."],
    "unsavedDetail": ["O texto não ficou guardado. {detail}", "The text was not saved. {detail}", "Le texte n’a pas été enregistré. {detail}", "El texto no se ha guardado. {detail}", "Der Text wurde nicht gespeichert. {detail}"],
    "summaryPending": ["Visita {id} — pedido de material/nota por confirmar. Abra Mais → Avisos{detail}.", "Visit {id} — material request/note awaiting confirmation. Open Mais → Avisos{detail}.", "Visite {id} — demande de matériel/note à confirmer. Ouvrez Mais → Avisos{detail}.", "Visita {id} — solicitud de material/nota por confirmar. Abra Mais → Avisos{detail}.", "Besuch {id} — Materialanfrage/Notiz wartet auf Bestätigung. Öffnen Sie Mais → Avisos{detail}."],
    "unassociated": ["sem associação", "not linked", "non associée", "sin asociación", "nicht zugeordnet"],
    "summaryBlocked": ["; confirme o contexto com o escritório", "; confirm the context with the office", " ; confirmez le contexte avec le bureau", "; confirme el contexto con la oficina", "; klären Sie den Kontext mit dem Büro"],
    "summaryUnsaved": ["Pedido de material/nota não ficou guardado. Conserve o texto em Mais → Avisos.", "The material request/note was not saved. Keep the text in Mais → Avisos.", "La demande de matériel/note n’a pas été enregistrée. Conservez le texte dans Mais → Avisos.", "La solicitud de material/nota no se ha guardado. Conserve el texto en Mais → Avisos.", "Die Materialanfrage/Notiz wurde nicht gespeichert. Bewahren Sie den Text unter Mais → Avisos auf."],
    "summaryDraft": ["Visita {id} — rascunho de pedido de material/nota por enviar em Mais → Avisos.", "Visit {id} — material request/note draft awaiting sending in Mais → Avisos.", "Visite {id} — brouillon de demande de matériel/note à envoyer dans Mais → Avisos.", "Visita {id} — borrador de solicitud de material/nota pendiente de envío en Mais → Avisos.", "Besuch {id} — Entwurf einer Materialanfrage/Notiz wartet unter Mais → Avisos auf den Versand."],
    "locksUnavailable": ["Este navegador não permite coordenar os pedidos. Preserve o texto.", "This browser cannot coordinate requests. Preserve the text.", "Ce navigateur ne permet pas de coordonner les demandes. Conservez le texte.", "Este navegador no permite coordinar las solicitudes. Conserve el texto.", "Dieser Browser kann Anfragen nicht koordinieren. Bewahren Sie den Text auf."],
    "lockBusy": ["O pedido está em utilização noutra janela. Tente novamente.", "The request is in use in another window. Try again.", "La demande est utilisée dans une autre fenêtre. Réessayez.", "La solicitud está en uso en otra ventana. Inténtelo de nuevo.", "Die Anfrage wird in einem anderen Fenster verwendet. Versuchen Sie es erneut."],
    "confirmedPreserved": ["Pedido já confirmado; o rascunho foi preservado. {detail}", "Request already confirmed; the draft was preserved. {detail}", "Demande déjà confirmée ; le brouillon a été conservé. {detail}", "Solicitud ya confirmada; se ha conservado el borrador. {detail}", "Anfrage bereits bestätigt; der Entwurf bleibt erhalten. {detail}"],
    "savedPending": ["Pedido guardado, por confirmar. {detail}", "Request saved, awaiting confirmation. {detail}", "Demande enregistrée, à confirmer. {detail}", "Solicitud guardada, por confirmar. {detail}", "Anfrage gespeichert, Bestätigung ausstehend. {detail}"],
    "notSent": ["O pedido não foi enviado. {detail}", "The request was not sent. {detail}", "La demande n’a pas été envoyée. {detail}", "La solicitud no se ha enviado. {detail}", "Die Anfrage wurde nicht gesendet. {detail}"]
  };
  const bindings=new Map(), errors=new WeakMap();
  const copy=(key,params={})=>({key,params});
  function text(value){
    if(!value||typeof value!=='object')return String(value??'');
    if(value.store)return store.message(value.store);
    const language=String(document.documentElement.lang||'pt').toLowerCase().split('-')[0];
    const index=Math.max(0,['pt','en','fr','es','de'].indexOf(language));
    return messages[value.key][index].replace(/\{(\w+)\}/g,(_,key)=>text(value.params[key]));
  }
  function paint(node,attribute,value){
    const rendered=text(value);
    if(attribute==='textContent'){if(node.textContent!==rendered)node.textContent=rendered;}
    else if(node.getAttribute(attribute)!==rendered)node.setAttribute(attribute,rendered);
  }
  function set(node,value,attribute='textContent'){
    if(!bindings.has(node)){node.setAttribute('data-cw-no-i18n','');bindings.set(node,new Map());}
    bindings.get(node).set(attribute,value);paint(node,attribute,value);
  }
  function problem(key){const value=copy(key),error=Error(text(value));errors.set(error,value);return error;}
  const errorCopy=error=>errors.get(error)||(error.copy?.key==='fieldWriteError'?{store:error.copy.params.code}:error.message);
  set(card.querySelector('.chip'),copy('title'));
  set(card.querySelector(':scope > .muted'),copy('intro'));
  set(button,copy('send'));
  for(const [field,key] of [['requestType','type'],['priority','priority'],['productName','productLabel'],['quantity','quantityLabel'],['unit','unitLabel'],['message','messageLabel']])set(nodes[field],copy(key),'aria-label');
  for(const [field,key] of [['productName','productHint'],['quantity','quantityHint'],['unit','unitHint'],['message','messageHint']])set(nodes[field],copy(key),'placeholder');
  for(const [value,key] of [['STOCK_REQUEST','stock'],['PURCHASE_REMINDER','purchase'],['ADMIN_NOTE','note'],['NORMAL','normal'],['HIGH','high']])set(card.querySelector('option[value="'+value+'"]'),copy(key));
  window.addEventListener('cw-language-change',()=>{for(const [node,attributes] of bindings)for(const [attribute,value] of attributes)paint(node,attribute,value);});
  for(const node of [target,status,legacy])node.style.overflowWrap='anywhere';
  function active(){return !closed&&store.same(captured);}
  function requireActive(){if(!active())throw problem('originalSession');}
  const id=value=>Number.isSafeInteger(value)&&value>0;
  const current=()=>{const value=window.CWFieldVisitContext?.();return value?.visitType==='REGULAR'&&id(value.id)&&id(value.poolId)?value:null;};
  const payload=value=>Object.fromEntries(payloadFields.map(field=>[field,value[field]]));
  const samePayload=(a,b)=>payloadFields.every(field=>a[field]===b[field]);
  const hasContent=value=>['productName','quantity','unit','message'].some(field=>value[field]!=='')||value.requestType!=='STOCK_REQUEST'||value.priority!=='NORMAL';
  function read(){
    requireActive();const raw=localStorage.getItem(key);let value;
    try{value=raw?JSON.parse(raw):blank();}catch(_){throw problem('unreadable');}
    if(!value||Object.keys(value).length!==Object.keys(blank()).length||Object.keys(value).some(field=>!Object.hasOwn(blank(),field))||value.v!==1||value.owner!==captured.owner||value.visitType!=='REGULAR'||![value.visitId,value.poolId].every(value=>value===null||id(value))||Boolean(value.visitId)!==Boolean(value.poolId)||typeof value.poolName!=='string'||!['STOCK_REQUEST','PURCHASE_REMINDER','ADMIN_NOTE'].includes(value.requestType)||!['NORMAL','HIGH'].includes(value.priority)||[['productName',200],['quantity',40],['unit',40],['message',5000]].some(([field,max])=>typeof value[field]!=='string'||value[field].length>max)||(value.requestId!==null&&!/^[0-9a-f-]{36}$/i.test(value.requestId)))throw problem('unreadable');
    if(observed===undefined)observed=raw;return value;
  }
  function write(value){
    requireActive();read();
    if(localStorage.getItem(key)!==observed){conflict=true;throw problem('changed');}
    const raw=JSON.stringify(value);localStorage.setItem(key,raw);
    if(localStorage.getItem(key)!==raw)throw problem('saveUnconfirmed');
    observed=raw;draft=value;unsaved=false;
  }
  function show(value){for(const field of Object.keys(fields))nodes[field].value=value[field];}
  function contextChanged(){
    const selected=current(), value=state?.payload||draft, original=id(value.visitId), same=!!selected&&(!original||selected.id===value.visitId&&selected.poolId===value.poolId);
    set(target,original?copy('associated',{id:value.visitId,name:state?.label||draft.poolName||copy('pool',{id:value.poolId})}):selected?copy('newRequest',{id:selected.id,name:selected.poolName||copy('pool',{id:selected.poolId})}):copy('choose'));
    const locked=busy||conflict||!active()||!ready;
    for(const node of Object.values(nodes)){if(node.tagName==='SELECT')node.disabled=locked||!!state||(!selected&&!original);else node.readOnly=locked||!!state||(!selected&&!original);}
    button.disabled=locked||!!state||!same;
    button.hidden=!!state||(original&&!same);
    recover.hidden=!state&&!(original&&!same);
    recover.disabled=locked;
    set(recover,state?.response?copy('clear'):state?copy('confirm'):copy('sendVisit',{id:value.visitId}));
  }
  function legacyNotice(){
    try{const raw=localStorage.getItem('cwPendingAdminAlerts');if(!raw){set(legacy,'');return;}const rows=JSON.parse(raw);set(legacy,Array.isArray(rows)&&rows.length===0?'':copy('legacy'));}
    catch(_){set(legacy,copy('legacyUnreadable'));}
  }
  async function refresh(){
    if(busy)return;const generation=++revision;
    if(!active()){show(blank());draft=blank();state=null;ready=false;set(target,'');set(status,copy('currentSession'));contextChanged();return;}
    try{
      const saved=read(),rows=await store.records(scope,captured,true);
      if(!active()||generation!==revision||busy)return;
      if(conflict){contextChanged();return;}
      if(!unsaved)draft=saved;
      state=rows.find(row=>!row.response)||(draft.requestId?rows.find(row=>row.requestId===draft.requestId):null);
      if(draft.requestId&&!state)throw problem('missing');
      if(state&&draft.visitId&&!samePayload(draft,state.payload))throw problem('mismatch');
      if(state){draft={...blank(),...state.payload,poolName:state.label,requestId:state.requestId};show(draft);}else if(!unsaved)show(draft);
      ready=true;contextChanged();legacyNotice();
      const confirmed=state?.response||rows.filter(row=>row.response).at(-1)?.response;
      set(status,state&&!state.response?copy('pending',{detail:state.failure?.message||copy('useConfirm')}):unsaved?copy('unsaved'):confirmed?copy('confirmed',{id:confirmed.stockRequest.notificationId}):draft.visitId?copy('draftSaved'):copy('beforeSend'));
    }catch(error){if(active()&&generation===revision){conflict=true;contextChanged();set(status,errorCopy(error));}}
  }
  function collect(){
    requireActive();const selected=current();
    if(!draft.visitId&&!selected)throw problem('chooseBefore');
    const value={...draft,...(!draft.visitId?{visitId:selected.id,poolId:selected.poolId,poolName:selected.poolName||'Piscina '+selected.poolId}:{}),...Object.fromEntries(Object.keys(fields).map(field=>[field,nodes[field].value]))};
    return hasContent(value)?value:blank();
  }
  function saveDraft(){
    if(busy||state||conflict||!ready)return;++revision;
    try{draft=collect();unsaved=true;write(draft);set(status,copy('draftSaved'));}
    catch(error){set(status,copy('unsavedDetail',{detail:errorCopy(error)}));}
    contextChanged();
  }
  function clearConfirmed(){write(blank());state=null;show(draft);}
  async function pendingSummary(){
    requireActive();const saved=read(), rows=await store.records(scope,captured,true);requireActive();const items=[];
    for(const row of rows.filter(row=>!row.response))items.push({kind:'pending',text:text(copy('summaryPending',{id:row.payload.visitId||copy('unassociated'),detail:row.failure?.blocked?copy('summaryBlocked'):''}))});
    if((unsaved||hasContent(saved))&&!rows.some(row=>row.requestId===saved.requestId||!row.response&&samePayload(row.payload,saved)))items.push({kind:'pending',text:text(unsaved?copy('summaryUnsaved'):copy('summaryDraft',{id:saved.visitId}))});
    legacyNotice();if(legacy.textContent)items.push({kind:'unknown',text:legacy.textContent});
    return items;
  }
  async function send(){
    if(busy||conflict||!ready)return;busy=true;contextChanged();let message='';
    try{
      requireActive();
      if(!navigator.locks?.request)throw problem('locksUnavailable');
      await navigator.locks.request('cw-field-stock-draft:'+captured.owner,{ifAvailable:true},async lock=>{
        if(!lock)throw problem('lockBusy');
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
    finally{busy=false;if(!message||state||!active())await refresh();else contextChanged();if(message&&active())set(status,copy(state?.response?'confirmedPreserved':state?'savedPending':'notSent',{detail:message}));}
  }
  for(const node of Object.values(nodes))node.addEventListener(node.tagName==='SELECT'?'change':'input',saveDraft);
  recover.addEventListener('click',send);
  window.addEventListener('storage',event=>{if(event.key===key&&event.newValue!==observed&&!busy){conflict=true;set(status,copy('changed'));contextChanged();}if(!active())refresh();});
  window.addEventListener('cw:field-write-change',refresh);
  window.addEventListener('pagehide',()=>{closed=true;++revision;});
  window.addEventListener('pageshow',()=>{closed=false;refresh();});
  setInterval(()=>{if(!active())refresh();},1000);
  window.CWFieldStockRequest={send,refresh,contextChanged,pendingSummary};
  contextChanged();refresh();
})();
