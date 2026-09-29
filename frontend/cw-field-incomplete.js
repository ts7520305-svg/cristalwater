(function(){
  'use strict';
  const store=window.CWFieldWriteStore,flow=window.CWIncompleteWorkflow,$=id=>document.getElementById(id),scope='VISIT_INCOMPLETE';
  const messages={
    "title":["Não consegui concluir esta visita", "I could not complete this visit", "Je n’ai pas pu terminer cette visite", "No pude finalizar esta visita", "Ich konnte diesen Besuch nicht abschließen"],
    "intro":["Registe o impedimento e o próximo passo. Não marca a piscina como limpa, não desconta produtos e não fecha água ou bombas.", "Record the impediment and next step. This does not mark the pool as clean, deduct products or turn off water or pumps.", "Enregistrez l’empêchement et la prochaine étape. Cela ne marque pas la piscine comme propre, ne déduit pas de produits et ne ferme ni l’eau ni les pompes.", "Registre el impedimento y el siguiente paso. No marca la piscina como limpia, no descuenta productos ni cierra el agua o las bombas.", "Erfassen Sie die Besuchshinderung und den nächsten Schritt. Dies markiert den Pool nicht als sauber, zieht keine Produkte ab und schaltet weder Wasser noch Pumpen aus."],
    "reason":["Motivo", "Reason", "Motif", "Motivo", "Grund"],
    "choose":["Escolher motivo", "Choose a reason", "Choisir un motif", "Elegir motivo", "Grund wählen"],
    "access":["Acesso impedido", "Access blocked", "Accès bloqué", "Acceso bloqueado", "Zugang blockiert"],
    "key":["Chave indisponível ou incorreta", "Key unavailable or incorrect", "Clé indisponible ou incorrecte", "Llave no disponible o incorrecta", "Schlüssel fehlt oder ist falsch"],
    "client":["Cliente impediu o serviço", "Client prevented the service", "Le client a empêché le service", "El cliente impidió el servicio", "Kunde hat den Service verhindert"],
    "chemical":["Falta de produtos químicos", "Missing chemicals", "Produits chimiques manquants", "Faltan productos químicos", "Fehlende Chemikalien"],
    "material":["Falta de material", "Missing materials", "Matériel manquant", "Falta de material", "Fehlendes Material"],
    "equipment":["Equipamento avariado", "Equipment failure", "Équipement en panne", "Equipo averiado", "Defekte Ausrüstung"],
    "weather":["Condições meteorológicas", "Weather conditions", "Conditions météorologiques", "Condiciones meteorológicas", "Wetterbedingungen"],
    "other":["Outro motivo", "Other reason", "Autre motif", "Otro motivo", "Anderer Grund"],
    "product":["Produto em falta", "Missing product", "Produit manquant", "Producto que falta", "Fehlendes Produkt"],
    "productPlaceholder":["Ex.: hipoclorito de sódio", "E.g. sodium hypochlorite", "Ex. : hypochlorite de sodium", "Ej.: hipoclorito de sodio", "Z. B. Natriumhypochlorit"],
    "quantity":["Quantidade para reposição, se souber", "Replenishment quantity, if known", "Quantité à réapprovisionner, si connue", "Cantidad para reponer, si la conoce", "Nachfüllmenge, falls bekannt"],
    "quantityPlaceholder":["Deixar vazio se ainda não souber", "Leave blank if not known yet", "Laissez vide si elle n’est pas encore connue", "Dejar vacío si aún no la conoce", "Leer lassen, wenn noch unbekannt"],
    "unit":["Unidade", "Unit", "Unité", "Unidad", "Einheit"],
    "litres":["Litros", "Litres", "Litres", "Litros", "Liter"],
    "kilograms":["Quilogramas", "Kilograms", "Kilogrammes", "Kilogramos", "Kilogramm"],
    "units":["Unidades", "Units", "Unités", "Unidades", "Stück"],
    "shortageHelp":["Indique a necessidade de reposição. Este registo não calcula uma dose, não consome stock nem autoriza substituir o produto.", "Indicate the replenishment need. This report does not calculate a dose, consume stock or authorize replacing the product.", "Indiquez le besoin de réapprovisionnement. Ce signalement ne calcule pas de dose, ne consomme pas de stock et n’autorise pas le remplacement du produit.", "Indique la necesidad de reposición. Este registro no calcula una dosis, no consume existencias ni autoriza sustituir el producto.", "Geben Sie den Nachfüllbedarf an. Diese Meldung berechnet keine Dosierung, verbraucht keinen Bestand und erlaubt keinen Produktersatz."],
    "next":["Próximo passo", "Next step", "Prochaine étape", "Siguiente paso", "Nächster Schritt"],
    "nextPlaceholder":["Ex.: escritório confirmar a chave e combinar regresso", "E.g. office to confirm the key and arrange a return", "Ex. : le bureau doit confirmer la clé et organiser un retour", "Ej.: la oficina debe confirmar la llave y acordar el regreso", "Z. B. Büro soll den Schlüssel bestätigen und einen Folgebesuch vereinbaren"],
    "photos":["Pode juntar fotografias na área de fotografias desta visita.", "You can add photos in this visit’s photo area.", "Vous pouvez ajouter des photos dans l’espace photos de cette visite.", "Puede añadir fotografías en el área de fotos de esta visita.", "Sie können im Fotobereich dieses Besuchs Fotos hinzufügen."],
    "save":["Guardar visita por concluir", "Save incomplete visit", "Enregistrer la visite inachevée", "Guardar visita sin finalizar", "Unvollständigen Besuch speichern"],
    "retry":["Reenviar registos pendentes", "Resend pending reports", "Renvoyer les signalements en attente", "Reenviar registros pendientes", "Ausstehende Meldungen erneut senden"],
    "legacyUnreadable":["Registos antigos ilegíveis. Conserve os dados e contacte o escritório.", "Old records are unreadable. Preserve the data and contact the office.", "Les anciens enregistrements sont illisibles. Conservez les données et contactez le bureau.", "Los registros antiguos son ilegibles. Conserve los datos y contacte con la oficina.", "Alte Einträge sind unlesbar. Bewahren Sie die Daten auf und kontaktieren Sie das Büro."],
    "waitSnapshot":["Aguarde a confirmação da visita antes de escrever.", "Wait for visit confirmation before writing.", "Attendez la confirmation de la visite avant d’écrire.", "Espere la confirmación de la visita antes de escribir.", "Warten Sie vor der Eingabe auf die Bestätigung des Besuchs."],
    "sessionPreserved":["Sessão alterada. Reabra a página; os pedidos foram preservados.", "Session changed. Reopen the page; the requests were preserved.", "Session modifiée. Rouvrez la page ; les demandes ont été conservées.", "Sesión modificada. Vuelva a abrir la página; las solicitudes se han conservado.", "Sitzung geändert. Öffnen Sie die Seite erneut; die Anfragen wurden aufbewahrt."],
    "legacyNotice":["Há impedimentos antigos sem conta e tipo confirmados. Conserve os dados e peça reconciliação ao escritório antes de criar outro registo.", "There are old impediments without a confirmed account and visit type. Preserve the data and ask the office to reconcile them before creating another report.", "Des empêchements anciens sans compte ni type de visite confirmés sont présents. Conservez les données et demandez un rapprochement au bureau avant de créer un autre signalement.", "Hay impedimentos antiguos sin cuenta ni tipo de visita confirmados. Conserve los datos y pida su conciliación a la oficina antes de crear otro registro.", "Es gibt alte Besuchshinderungen ohne bestätigtes Konto und bestätigten Besuchstyp. Bewahren Sie die Daten auf und bitten Sie das Büro um Abgleich, bevor Sie eine weitere Meldung erstellen."],
    "bannerRow":["{label} — {status}{blocked}", "{label} — {status}{blocked}", "{label} — {status}{blocked}", "{label} — {status}{blocked}", "{label} — {status}{blocked}"],
    "pendingOffice":["por confirmar no escritório", "awaiting confirmation by the office", "à confirmer par le bureau", "pendiente de confirmación por la oficina", "wartet auf Bestätigung durch das Büro"],
    "bannerBlocked":[". Confirme a situação com o escritório antes de reenviar.", ". Confirm the situation with the office before resending.", ". Confirmez la situation avec le bureau avant de renvoyer.", ". Confirme la situación con la oficina antes de reenviar.", ". Klären Sie die Situation vor dem erneuten Senden mit dem Büro."],
    "retryHelp":[" Confirme a situação com o escritório antes de reenviar.", " Confirm the situation with the office before resending.", " Confirmez la situation avec le bureau avant de renvoyer.", " Confirme la situación con la oficina antes de reenviar.", " Klären Sie die Situation vor dem erneuten Senden mit dem Büro."],
    "reviewRejection":["Rever recusa e atualizar visita", "Review rejection and refresh visit", "Vérifier le refus et actualiser la visite", "Revisar rechazo y actualizar visita", "Ablehnung prüfen und Besuch aktualisieren"],
    "reviewed":["Recusa revista. Confirme o estado atual e prepare novamente o registo.", "Rejection reviewed. Confirm the current state and prepare the report again.", "Refus vérifié. Confirmez l’état actuel et préparez à nouveau le signalement.", "Rechazo revisado. Confirme el estado actual y prepare de nuevo el registro.", "Ablehnung geprüft. Bestätigen Sie den aktuellen Zustand und bereiten Sie die Meldung erneut vor."],
    "blocked":["Registo preservado. Confirme a situação com o escritório antes de reenviar.", "Report preserved. Confirm the situation with the office before resending.", "Signalement conservé. Confirmez la situation avec le bureau avant de renvoyer.", "Registro conservado. Confirme la situación con la oficina antes de reenviar.", "Meldung aufbewahrt. Klären Sie die Situation vor dem erneuten Senden mit dem Büro."],
    "pending":["Registo guardado neste telemóvel, por confirmar no escritório.", "Report saved on this phone, awaiting confirmation by the office.", "Signalement enregistré sur ce téléphone, à confirmer par le bureau.", "Registro guardado en este teléfono, pendiente de confirmación por la oficina.", "Meldung auf diesem Telefon gespeichert, Bestätigung durch das Büro ausstehend."],
    "confirmed":["Visita por concluir registada no servidor. Aviso disponível para o escritório.", "Incomplete visit recorded on the server. Notice available to the office.", "Visite inachevée enregistrée sur le serveur. Avis disponible pour le bureau.", "Visita sin finalizar registrada en el servidor. Aviso disponible para la oficina.", "Unvollständiger Besuch auf dem Server erfasst. Hinweis für das Büro verfügbar."],
    "draft":["Rascunho guardado neste dispositivo. Confirme para enviar.", "Draft saved on this device. Confirm to send.", "Brouillon enregistré sur cet appareil. Confirmez pour envoyer.", "Borrador guardado en este dispositivo. Confirme para enviar.", "Entwurf auf diesem Gerät gespeichert. Zum Senden bestätigen."],
    "checking":["A confirmar a visita…", "Confirming the visit…", "Confirmation de la visite…", "Confirmando la visita…", "Besuch wird bestätigt…"],
    "confirmRetry":["O escritório confirmou que pode repetir o envio destas visitas?", "Has the office confirmed that you may resend these visits?", "Le bureau a-t-il confirmé que vous pouvez renvoyer ces visites ?", "¿La oficina ha confirmado que puede reenviar estas visitas?", "Hat das Büro bestätigt, dass Sie diese Besuche erneut senden dürfen?"],
    "sendError":["{detail}{help}", "{detail}{help}", "{detail}{help}", "{detail}{help}", "{detail}{help}"],
    "validation":["Escolha o motivo e indique o próximo passo (5–1000 caracteres).", "Choose the reason and describe the next step (5–1000 characters).", "Choisissez le motif et indiquez la prochaine étape (5–1000 caractères).", "Elija el motivo e indique el siguiente paso (5–1000 caracteres).", "Wählen Sie den Grund und beschreiben Sie den nächsten Schritt (5–1000 Zeichen)."],
    "chemicalValidation":["Indique o produto e uma quantidade positiva, ou deixe por confirmar.", "Enter the product and a positive quantity, or leave the quantity unconfirmed.", "Indiquez le produit et une quantité positive, ou laissez la quantité à confirmer.", "Indique el producto y una cantidad positiva, o deje la cantidad por confirmar.", "Geben Sie das Produkt und eine positive Menge an, oder lassen Sie die Menge unbestätigt."],
    "sessionChanged":["Sessão alterada. Reabra a página.", "Session changed. Reopen the page.", "Session modifiée. Rouvrez la page.", "Sesión modificada. Vuelva a abrir la página.", "Sitzung geändert. Öffnen Sie die Seite erneut."]
  };
  const descriptors=new WeakSet(),errorCopies=new WeakMap(),bindings=new WeakMap();
  const copy=(key,params={})=>{const value={key,params};descriptors.add(value);return value;};
  function text(value,language=document.documentElement.lang||'pt'){
    if(!value||typeof value!=='object'||!descriptors.has(value))return String(value);
    const index=Math.max(0,['pt','en','fr','es','de'].indexOf(String(language).toLowerCase().split('-')[0]));
    if(value.translations)return value.translations[['pt','en','fr','es','de'][index]];
    return messages[value.key][index].replace(/\{(\w+)\}/g,(_,key)=>text(value.params[key],language));
  }
  function setCopy(node,value,attribute=''){
    if(!node)return;if(!bindings.has(node))bindings.set(node,new Map());bindings.get(node).set(attribute,value);node.setAttribute('data-cw-incomplete-copy','');node.setAttribute('data-cw-no-i18n','');
    const rendered=text(value);if(attribute){if(node.getAttribute(attribute)!==rendered)node.setAttribute(attribute,rendered);}else if(node.textContent!==rendered)node.textContent=rendered;
  }
  function repaintCopy(){for(const node of document.querySelectorAll('[data-cw-incomplete-copy]'))for(const [attribute,value]of bindings.get(node)||[])setCopy(node,value,attribute);}
  function ownError(key){const value=copy(key),error=Error(text(value,'pt'));errorCopies.set(error,value);return error;}
  function errorCopy(error){const own=errorCopies.get(error);if(own)return own;const translations=flow.errorTranslations(error);if(!translations)return error.message;const value={translations};descriptors.add(value);return value;}
  const fields=['incompleteReason','incompleteNextStep','shortageProduct','shortageQuantity','shortageUnit'];
  const terminal=['DONE','COMPLETED','CONCLUIDA','CONCLUIDO','CANCELLED','CANCELED','SKIPPED','ARCHIVED'];
  let state=null,revision=0,syncing=false,message='',selectionSignature=null;
  const banner=document.createElement('aside');banner.id='incompletePendingBanner';banner.setAttribute('role','status');banner.setAttribute('data-cw-state-managed','manual');banner.style.cssText='padding:14px;background:#fff4ce;color:#624400;overflow-wrap:anywhere';banner.hidden=true;document.body.prepend(banner);
  function same(s){return s===state&&store.same(s?.captured);}
  function legacy(captured){const raw=localStorage.getItem(`cwIncompleteVisits:${captured.technicianId}`);if(!raw)return false;let data;try{data=JSON.parse(raw);}catch(error){errorCopies.set(error,copy('legacyUnreadable'));throw error;}if(!data||typeof data!=='object'||Array.isArray(data))throw ownError('legacyUnreadable');return Object.keys(data).length>0;}
  function values(){return Object.fromEntries(fields.map(id=>[id,$(id).value]));}
  function changed(){
    const s=state;if(!same(s))return;
    const input=values();s.queue=s.queue.then(async()=>{if(!s.snapshot)throw ownError('waitSnapshot');s.draft=await flow.write(s.draft,s.context,input,s.draft.value?.snapshot||s.snapshot,s.captured);s.error=null;}).catch(error=>{s.error=error;if(same(s)){message=errorCopy(error);void render();}});
    const show=$('incompleteReason').value==='CHEMICAL_MISSING';$('chemicalShortageFields').hidden=!show;$('chemicalShortageFields').style.display=show?'block':'none';
  }
  async function render(){
    const captured=store.session();if(!captured){banner.hidden=true;$('incompleteSave').disabled=true;setCopy($('incompleteStatus'),copy('sessionPreserved'));return;}
    try{
      const all=await store.records(scope,captured,true),pending=all.filter(r=>!r.response||r.response.applied===false&&!r.reviewedAt),old=legacy(captured);
      if(!store.same(captured))return;
      bindings.delete(banner);banner.removeAttribute('data-cw-incomplete-copy');banner.replaceChildren();banner.hidden=!pending.length&&!old;
      if(old){const p=document.createElement('p');setCopy(p,copy('legacyNotice'));banner.append(p);}
      for(const row of pending){const p=document.createElement('p');setCopy(p,copy('bannerRow',{label:row.label,status:row.response?.message||copy('pendingOffice'),blocked:row.failure?.blocked?copy('bannerBlocked'):''}));banner.append(p);if(row.response?.applied===false){const b=document.createElement('button');b.type='button';setCopy(b,copy('reviewRejection'));b.onclick=async()=>{await store.acknowledgeRejection(row.requestId,captured);if(!store.same(captured))return;message=copy('reviewed');if(state?.context.id===row.resourceId&&state.context.visitType===row.payload.visitType){await state.queue;await flow.clear(state.draft,captured);state=null;await select();}await render();};banner.append(b);}}
      const s=state,own=pending.filter(row=>same(s)&&row.resourceId===s.context.id&&row.payload.visitType===s.context.visitType);
      const blocked=own.some(row=>row.failure?.blocked);
      setCopy($('incompleteStatus'),message||(blocked?copy('blocked'):own.length?copy('pending'):s?.snapshot?.visit.status==='INCOMPLETE'?copy('confirmed'):s?.draft?.value?copy('draft'):''));
      $('incompleteSave').disabled=!same(s)||s.busy||!s.snapshot||old||own.length>0||s.snapshot.hasReturn||!!s.snapshot.visit.endAt||terminal.includes(s.snapshot.visit.status);
      $('incompleteRetry').disabled=!pending.some(r=>!r.response);
      const show=$('incompleteReason').value==='CHEMICAL_MISSING';$('chemicalShortageFields').hidden=!show;$('chemicalShortageFields').style.display=show?'block':'none';
    }catch(error){banner.hidden=false;setCopy(banner,errorCopy(error));setCopy($('incompleteStatus'),errorCopy(error));$('incompleteSave').disabled=true;}
  }
  async function select(force=false){
    const context=window.CWFieldVisitContext?.(),captured=store.session();
    if(!context||!captured){state=null;void render();return;}
    if(!force&&same(state)&&state.context.id===context.id&&state.context.visitType===context.visitType&&state.context.poolId===context.poolId){void render();return;}
    const own=++revision,s={context,captured,snapshot:null,draft:null,queue:Promise.resolve(),busy:false};state=s;message=copy('checking');void render();
    try{
      s.draft=flow.read(scope,context,captured);
      for(const id of fields)$(id).value=s.draft.value?.values[id]??(id==='shortageUnit'?'L':'');
      s.snapshot=await flow.view(context,captured);
      if(own!==revision||!same(s))return;
      message='';await render();
    }catch(error){if(same(s)){message=errorCopy(error);await render();}}
  }
  async function confirmed(record,result,captured){
    if(!store.same(captured))return;
    if(result.applied){
      const context={id:record.resourceId,visitType:record.payload.visitType,poolId:record.payload.poolId};
      const draft=flow.read(scope,context,captured);
      if(draft.value?.snapshot?.baseVersion===record.payload.baseVersion&&draft.value.values.incompleteReason===record.payload.reason&&draft.value.values.incompleteNextStep.trim()===record.payload.nextStep.trim())await flow.clear(draft,captured);
      message=copy('confirmed');
      if(same(state)&&state.context.id===record.resourceId&&state.context.visitType===record.payload.visitType){state.draft=flow.read(scope,context,captured);state.snapshot=null;await select(true);message=copy('confirmed');}
      window.dispatchEvent(new CustomEvent('cw:incomplete-confirmed',{detail:{owner:captured.owner,token:captured.token}}));
    }else message=result.message;
    window.dispatchEvent(new Event('cw:incomplete-updated'));await render();
  }
  async function sync(explicit=false){
    const captured=store.session();if(syncing||!captured||!navigator.onLine)return;syncing=true;
    try{
      const rows=await store.records(scope,captured);
      if(explicit&&rows.some(row=>row.failure?.blocked)&&!confirm(text(copy('confirmRetry'))))return;
      for(const row of rows){if(!explicit&&(row.failure?.blocked||row.failure?.retryAt>Date.now()))continue;try{const result=await store.send(row.requestId,captured,{automatic:!explicit});await confirmed(row,result,captured);}catch(error){if(store.same(captured))message=copy('sendError',{detail:errorCopy(error),help:error.status>=400&&error.status<500?copy('retryHelp'):''});}}
    }catch(error){if(store.same(captured))message=errorCopy(error);}finally{syncing=false;void render();}
  }
  $('incompleteSave').onclick=async()=>{
    const s=state;if(!same(s)||$('incompleteSave').disabled)return;s.busy=true;message='';void render();
    try{
      changed();await s.queue;if(s.error)throw s.error;if(!same(s))return;
      const v=values(),reason=v.incompleteReason,nextStep=v.incompleteNextStep.trim();if(!reason||nextStep.length<5||nextStep.length>1000)throw ownError('validation');
      const body={reason,nextStep};
      if(reason==='CHEMICAL_MISSING'){const quantity=v.shortageQuantity.trim()?Number(v.shortageQuantity.replace(',','.')):null,productName=v.shortageProduct.trim(),unit=v.shortageUnit;if(productName.length<2||productName.length>120||!['L','KG','UN'].includes(unit)||quantity!==null&&(!Number.isFinite(quantity)||quantity<=0||quantity>100000))throw ownError('chemicalValidation');body.chemicalShortage={productName,quantity,unit};}
      await flow.prepare(scope,s.context,body,s.draft.value?.snapshot||s.snapshot,s.captured);message=copy('pending');await render();await sync();
    }catch(error){if(same(s))message=errorCopy(error);}finally{s.busy=false;void render();}
  };
  $('incompleteRetry').onclick=()=>sync(true);
  for(const id of fields){$(id).addEventListener('input',changed);$(id).addEventListener('change',changed);}
  window.addEventListener('cw:field-visit-selected',event=>{const signature=JSON.stringify(event.detail),force=selectionSignature!==null&&selectionSignature!==signature;selectionSignature=signature;void select(force);});
  window.addEventListener('cw:field-write-change',()=>render());
  window.addEventListener('online',()=>{void select(true);void sync();});window.addEventListener('pageshow',()=>sync());
  window.addEventListener('storage',()=>{if(state&&!store.same(state.captured)){state=null;message=copy('sessionChanged');}void render();});
  setInterval(()=>{void render();void sync();},15000);
  const summaryMessages={
    pending:['{label} — impedimento por confirmar no escritório.','{label} — impediment awaiting confirmation by the office.','{label} — empêchement à confirmer par le bureau.','{label} — impedimento pendiente de confirmación por la oficina.','{label} — Besuchshinderung wartet auf Bestätigung durch das Büro.'],
    receipt:['{label} — {message}.','{label} — {message}.','{label} — {message}.','{label} — {message}.','{label} — {message}.'],
    legacy:['Impedimentos antigos por reconciliar com o escritório.','Old impediments awaiting reconciliation with the office.','Anciens empêchements à rapprocher avec le bureau.','Impedimentos antiguos pendientes de conciliación con la oficina.','Alte Besuchshinderungen müssen mit dem Büro abgeglichen werden.'],
    regularDraft:['Visita #{id} — rascunho de impedimento guardado.','Visit #{id} — impediment draft saved.','Visite n°{id} — brouillon d’empêchement enregistré.','Visita #{id} — borrador de impedimento guardado.','Besuch #{id} — Entwurf einer Besuchshinderung gespeichert.'],
    extraDraft:['Visita extra #{id} — rascunho de impedimento guardado.','Extra visit #{id} — impediment draft saved.','Visite supplémentaire n°{id} — brouillon d’empêchement enregistré.','Visita extra #{id} — borrador de impedimento guardado.','Zusatzbesuch #{id} — Entwurf einer Besuchshinderung gespeichert.']
  };
  function summaryItem(kind,key,parameters={}){
    const reviewText=Object.freeze(Object.fromEntries(['pt','en','fr','es','de'].map((language,index)=>[language,summaryMessages[key][index].replace(/\{(\w+)\}/g,(_,name)=>String(parameters[name]))])));
    // Keep the existing Portuguese {kind,text} JSON; the review uses a private,
    // immutable presentation snapshot without rereading records on locale changes.
    const item={kind,text:reviewText.pt};
    Object.defineProperty(item,'reviewText',{value:reviewText});
    return item;
  }
  async function pendingSummary(){
    const captured=store.session();if(!captured)throw Error('Sessão alterada');
    const rows=await store.records(scope,captured,true);
    const items=rows.filter(r=>!r.response||r.response.applied===false&&!r.reviewedAt).map(row=>summaryItem('pending',row.response?.message?'receipt':'pending',{label:row.label,message:row.response?.message}));
    if(legacy(captured))items.push(summaryItem('unknown','legacy'));
    for(let i=0;i<localStorage.length;i++){
      const name=localStorage.key(i);
      if(name.startsWith('cwIncompleteV2:'+captured.owner+':'+scope+':')){
        const value=JSON.parse(localStorage.getItem(name));
        if(value?.values?.incompleteNextStep)items.push(summaryItem('pending',value.context.visitType==='EXTRA'?'extraDraft':'regularDraft',{id:value.context.id}));
      }
    }
    return items;
  }
  const card=$('incompleteVisitCard'),details=card.querySelector('details');
  setCopy(details.querySelector('summary'),copy('title'));const paragraphs=details.querySelectorAll(':scope > p');setCopy(paragraphs[0],copy('intro'));setCopy(paragraphs[1],copy('photos'));
  setCopy($('chemicalShortageFields').querySelector('p'),copy('shortageHelp'));
  for(const [id,key]of [['incompleteReason','reason'],['incompleteNextStep','next'],['shortageProduct','product'],['shortageQuantity','quantity'],['shortageUnit','unit']]){setCopy(card.querySelector('label[for="'+id+'"]'),copy(key));setCopy($(id),copy(key),'aria-label');}
  for(const [id,key]of [['incompleteNextStep','nextPlaceholder'],['shortageProduct','productPlaceholder'],['shortageQuantity','quantityPlaceholder']])setCopy($(id),copy(key),'placeholder');
  for(const [index,option]of [...$('incompleteReason').options].entries())setCopy(option,copy(['choose','access','key','client','chemical','material','equipment','weather','other'][index]));
  for(const [index,option]of [...$('shortageUnit').options].entries())setCopy(option,copy(['litres','kilograms','units'][index]));
  setCopy($('incompleteSave'),copy('save'));setCopy($('incompleteRetry'),copy('retry'));
  window.addEventListener('cw-language-change',repaintCopy);let observedLanguage=document.documentElement.lang;
  new MutationObserver(()=>{if(observedLanguage===document.documentElement.lang)return;observedLanguage=document.documentElement.lang;repaintCopy();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  window.CWFieldIncomplete={refresh:render,pendingSummary};void select();void sync();
})();
