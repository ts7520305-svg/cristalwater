(function(){
  'use strict';
  const store=window.CWFieldWriteStore,captured=store?.adminSession(),mount=document.getElementById('pendingList'),scope='FIELD_CLIENT_APPROVAL';
  if(!mount||!store)return;mount.closest('section').dataset.cwStateManaged='manual';

  // Bind presentation snapshots only; changing language must not reload or approve records.
  const messages = {
    "title": [
        "Fichas pendentes de validação",
        "Records awaiting validation",
        "Fiches en attente de validation",
        "Fichas pendientes de validación",
        "Datensätze zur Prüfung"
    ],
    "intro": [
        "Clientes/piscinas criados por técnicos em campo aparecem aqui para revisão.",
        "Clients/pools created by technicians in the field appear here for review.",
        "Les clients/piscines créés sur le terrain par les techniciens apparaissent ici pour vérification.",
        "Los clientes/piscinas creados por técnicos en campo aparecen aquí para revisión.",
        "Von Technikern vor Ort angelegte Kunden/Pools werden hier zur Prüfung angezeigt."
    ],
    "reload": [
        "Atualizar fichas",
        "Refresh records",
        "Actualiser les fiches",
        "Actualizar fichas",
        "Datensätze aktualisieren"
    ],
    "session": [
        "A sessão mudou. Reabra com a conta original.",
        "The session has changed. Reopen with the original account.",
        "La session a changé. Rouvrez avec le compte d’origine.",
        "La sesión ha cambiado. Vuelva a abrir con la cuenta original.",
        "Die Sitzung hat sich geändert. Öffnen Sie die Seite erneut mit dem ursprünglichen Konto."
    ],
    "client": [
        "Cliente #{id}",
        "Client #{id}",
        "Client n°{id}",
        "Cliente #{id}",
        "Kunde #{id}"
    ],
    "approvalSummary": [
        "Aprovação de cliente #{id} e piscinas: {pools}.",
        "Approval of client #{id} and pools: {pools}.",
        "Approbation du client n°{id} et des piscines : {pools}.",
        "Aprobación del cliente #{id} y piscinas: {pools}.",
        "Genehmigung von Kunde #{id} und Pools: {pools}."
    ],
    "noPools": [
        "sem piscinas pendentes",
        "no pending pools",
        "aucune piscine en attente",
        "sin piscinas pendientes",
        "keine ausstehenden Pools"
    ],
    "savedPending": [
        "Aprovação guardada neste dispositivo, por confirmar.",
        "Approval saved on this device, awaiting confirmation.",
        "Approbation enregistrée sur cet appareil, à confirmer.",
        "Aprobación guardada en este dispositivo, por confirmar.",
        "Genehmigung auf diesem Gerät gespeichert, Bestätigung ausstehend."
    ],
    "rereview": [
        "Rever ficha atual",
        "Review current record",
        "Vérifier la fiche actuelle",
        "Revisar ficha actual",
        "Aktuellen Datensatz prüfen"
    ],
    "recover": [
        "Confirmar aprovação guardada",
        "Confirm saved approval",
        "Confirmer l’approbation enregistrée",
        "Confirmar aprobación guardada",
        "Gespeicherte Genehmigung bestätigen"
    ],
    "clientTitle": [
        "{name} · Cliente #{id}",
        "{name} · Client #{id}",
        "{name} · Client n°{id}",
        "{name} · Cliente #{id}",
        "{name} · Kunde #{id}"
    ],
    "field": [
        "{label}: {value}",
        "{label}: {value}",
        "{label} : {value}",
        "{label}: {value}",
        "{label}: {value}"
    ],
    "phone": [
        "Telefone",
        "Phone",
        "Téléphone",
        "Teléfono",
        "Telefon"
    ],
    "email": [
        "Email",
        "Email",
        "E-mail",
        "Correo electrónico",
        "E-Mail"
    ],
    "address": [
        "Morada",
        "Address",
        "Adresse",
        "Dirección",
        "Adresse"
    ],
    "zone": [
        "Zona",
        "Area",
        "Zone",
        "Zona",
        "Gebiet"
    ],
    "notes": [
        "Notas",
        "Notes",
        "Notes",
        "Notas",
        "Notizen"
    ],
    "absent": [
        "Não indicado",
        "Not provided",
        "Non indiqué",
        "No indicado",
        "Nicht angegeben"
    ],
    "clientState": [
        "Cliente: {state}. A aprovação ativa o cliente e as piscinas pendentes apresentadas.",
        "Client: {state}. Approval activates the client and the pending pools shown.",
        "Client : {state}. L’approbation active le client et les piscines en attente affichées.",
        "Cliente: {state}. La aprobación activa al cliente y las piscinas pendientes mostradas.",
        "Kunde: {state}. Die Genehmigung aktiviert den Kunden und die angezeigten ausstehenden Pools."
    ],
    "clientPending": [
        "pendente de revisão",
        "awaiting review",
        "en attente de vérification",
        "pendiente de revisión",
        "Prüfung ausstehend"
    ],
    "clientReviewed": [
        "já revisto",
        "already reviewed",
        "déjà vérifié",
        "ya revisado",
        "bereits geprüft"
    ],
    "poolTitle": [
        "{name} #{id}{state}",
        "{name} #{id}{state}",
        "{name} n°{id}{state}",
        "{name} #{id}{state}",
        "{name} #{id}{state}"
    ],
    "pool": [
        "Piscina",
        "Pool",
        "Piscine",
        "Piscina",
        "Pool"
    ],
    "poolPending": [
        " · pendente",
        " · pending",
        " · en attente",
        " · pendiente",
        " · ausstehend"
    ],
    "poolReviewed": [
        " · já revista",
        " · already reviewed",
        " · déjà vérifiée",
        " · ya revisada",
        " · bereits geprüft"
    ],
    "poolDetails": [
        "{type} · {volume} · {address} · {gps}",
        "{type} · {volume} · {address} · {gps}",
        "{type} · {volume} · {address} · {gps}",
        "{type} · {volume} · {address} · {gps}",
        "{type} · {volume} · {address} · {gps}"
    ],
    "typeAbsent": [
        "Tipo não indicado",
        "Type not provided",
        "Type non indiqué",
        "Tipo no indicado",
        "Typ nicht angegeben"
    ],
    "volumeAbsent": [
        "Volume não indicado",
        "Volume not provided",
        "Volume non indiqué",
        "Volumen no indicado",
        "Volumen nicht angegeben"
    ],
    "addressAbsent": [
        "Morada não indicada",
        "Address not provided",
        "Adresse non indiquée",
        "Dirección no indicada",
        "Adresse nicht angegeben"
    ],
    "gpsAbsent": [
        "GPS não indicado",
        "GPS not provided",
        "GPS non indiqué",
        "GPS no indicado",
        "GPS nicht angegeben"
    ],
    "limits": [
        "Esta aprovação não agenda visitas nem ativa contrato ou faturação.",
        "This approval does not schedule visits or activate a contract or billing.",
        "Cette approbation ne planifie aucune visite et n’active ni contrat ni facturation.",
        "Esta aprobación no programa visitas ni activa un contrato o la facturación.",
        "Diese Genehmigung plant keine Besuche und aktiviert weder einen Vertrag noch die Abrechnung."
    ],
    "approve": [
        "Aprovar cadastro",
        "Approve registration",
        "Approuver l’inscription",
        "Aprobar registro",
        "Registrierung genehmigen"
    ],
    "open": [
        "Abrir ficha",
        "Open record",
        "Ouvrir la fiche",
        "Abrir ficha",
        "Datensatz öffnen"
    ],
    "empty": [
        "Sem fichas pendentes nos dados consultados.",
        "No pending records in the data checked.",
        "Aucune fiche en attente dans les données consultées.",
        "No hay fichas pendientes en los datos consultados.",
        "Keine ausstehenden Datensätze in den geprüften Daten."
    ],
    "unknown": [
        "A lista de fichas ainda não está confirmada.",
        "The record list is not yet confirmed.",
        "La liste des fiches n’est pas encore confirmée.",
        "La lista de fichas aún no está confirmada.",
        "Die Liste der Datensätze ist noch nicht bestätigt."
    ],
    "confirmed": [
        "Aprovação confirmada: cliente #{id} e {count} piscina(s), em {date}.",
        "Approval confirmed: client #{id} and {count} pool(s), on {date}.",
        "Approbation confirmée : client n°{id} et {count} piscine(s), le {date}.",
        "Aprobación confirmada: cliente #{id} y {count} piscina(s), el {date}.",
        "Genehmigung bestätigt: Kunde #{id} und {count} Pool(s), am {date}."
    ],
    "queryFailed": [
        "Não foi possível confirmar as fichas atuais.",
        "Could not confirm the current records.",
        "Impossible de confirmer les fiches actuelles.",
        "No se pudieron confirmar las fichas actuales.",
        "Die aktuellen Datensätze konnten nicht bestätigt werden."
    ],
    "queryUnconfirmed": [
        "Consulta por confirmar. As aprovações guardadas continuam disponíveis. {detail}",
        "Query awaiting confirmation. Saved approvals remain available. {detail}",
        "Consultation à confirmer. Les approbations enregistrées restent disponibles. {detail}",
        "Consulta por confirmar. Las aprobaciones guardadas siguen disponibles. {detail}",
        "Abfrage noch nicht bestätigt. Gespeicherte Genehmigungen bleiben verfügbar. {detail}"
    ],
    "ready": [
        "Fichas consultadas. Reveja os dados antes de aprovar.",
        "Records retrieved. Review the details before approving.",
        "Fiches consultées. Vérifiez les données avant d’approuver.",
        "Fichas consultadas. Revise los datos antes de aprobar.",
        "Datensätze abgerufen. Prüfen Sie die Angaben vor der Genehmigung."
    ],
    "unconfirmed": [
        "Aprovação por confirmar. {detail}",
        "Approval awaiting confirmation. {detail}",
        "Approbation à confirmer. {detail}",
        "Aprobación por confirmar. {detail}",
        "Genehmigung noch nicht bestätigt. {detail}"
    ],
    "confirm": [
        "Aprovar este cliente e ativar as piscinas pendentes apresentadas?",
        "Approve this client and activate the pending pools shown?",
        "Approuver ce client et activer les piscines en attente affichées ?",
        "¿Aprobar este cliente y activar las piscinas pendientes mostradas?",
        "Diesen Kunden genehmigen und die angezeigten ausstehenden Pools aktivieren?"
    ]
};
  const languages=['pt','en','fr','es','de'],locales=['pt-PT','en-GB','fr-FR','es-ES','de-DE'];
  const descriptors=new WeakSet(),bindings=new WeakMap(),errors=new WeakMap();
  const copy=(key,params={})=>{const value={key,params};descriptors.add(value);return value;};
  const dateCopy=date=>{const value={date};descriptors.add(value);return value;};
  function copyText(value,language=document.documentElement.lang||'pt'){
    if(!value||typeof value!=='object'||!descriptors.has(value))return String(value??'');
    const index=Math.max(0,languages.indexOf(String(language).toLowerCase().split('-')[0]));
    if(value.translations)return value.translations[languages[index]];
    if('date' in value)return new Date(value.date).toLocaleString(locales[index]);
    return messages[value.key][index].replace(/\{(\w+)\}/g,(_,key)=>copyText(value.params[key],language));
  }
  function setCopy(node,value){
    bindings.set(node,value);node.setAttribute('data-cw-intake-review-copy','');node.setAttribute('data-cw-no-i18n','');
    node.textContent=copyText(value);
  }
  function repaint(){for(const node of panel.querySelectorAll('[data-cw-intake-review-copy]')){const value=copyText(bindings.get(node));if(node.textContent!==value)node.textContent=value;}}
  function ownError(key){const value=copy(key),error=Error(copyText(value,'pt'));errors.set(error,value);return error;}
  function errorCopy(error){
    if(errors.has(error))return errors.get(error);
    if(error.copy?.key==='fieldWriteError'){
      const value={translations:Object.freeze(Object.fromEntries(languages.map(language=>[language,store.message(error.copy.params.code,language)])))};
      descriptors.add(value);return value;
    }
    return error.message;
  }
  const panel=mount.closest('section');panel.setAttribute('data-cw-no-i18n','');
  setCopy(panel.querySelector('h2'),copy('title'));setCopy(panel.querySelector(':scope > p'),copy('intro'));
  window.addEventListener('cw-language-change',repaint);
  let observedLanguage=document.documentElement.lang;
  new MutationObserver(()=>{if(observedLanguage===document.documentElement.lang)return;observedLanguage=document.documentElement.lang;repaint();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  const status=document.createElement('p');status.id='intakeReviewStatus';status.setAttribute('role','status');
  const reload=document.createElement('button');reload.type='button';reload.id='intakeReviewReload';setCopy(reload,copy('reload'));
  const list=document.createElement('div');list.id='intakeReviewList';mount.replaceChildren(status,reload,list);mount.style.overflowWrap='anywhere';
  let rows=[],saved=[],busy=false,closed=false,generation=0,listed=false;
  const active=()=>!closed&&store.same(captured),requireActive=()=>{if(!active())throw ownError('session');};
  const live=row=>!row.response||row.response.applied===false&&!row.reviewedAt;
  const text=(parent,tag,value)=>{const node=document.createElement(tag);if(value!=='')setCopy(node,value);parent.append(node);return node;};
  function button(parent,label,kind,id,action){const node=text(parent,'button',label);node.type='button';node.dataset[kind]=String(id);node.disabled=busy||!active();node.addEventListener('click',action);return node;}
  function render(){
    list.replaceChildren();reload.disabled=busy||!active();if(!active()){rows=[];saved=[];setCopy(status,copy('session'));return;}
    for(const row of saved.filter(live)){const card=text(list,'article','');card.className='item';card.dataset.intakePending=row.requestId;text(card,'strong',row.label||copy('client',{id:row.resourceId}));text(card,'p',copy('approvalSummary',{id:row.resourceId,pools:row.payload.poolIds.join(', ')||copy('noPools')}));text(card,'p',row.response?.message||row.failure?.message||copy('savedPending'));button(card,copy(row.response?'rereview':'recover'),'intakeRecover',row.requestId,()=>recover(row));}
    for(const row of rows.filter(row=>!saved.some(record=>record.resourceId===row.id&&live(record)))){
      const card=text(list,'article','');card.className='item';card.dataset.intakeClient=row.id;text(card,'h3',copy('clientTitle',{name:row.name,id:row.id}));
      for(const [label,value] of [['phone',row.phone],['email',row.email],['address',row.address],['zone',row.zone],['notes',row.notes]])text(card,'p',copy('field',{label:copy(label),value:value||copy('absent')}));
      text(card,'p',copy('clientState',{state:copy(row.pendingReview?'clientPending':'clientReviewed')}));
      for(const pool of row.pools){text(card,'strong',copy('poolTitle',{name:pool.name||copy('pool'),id:pool.id,state:copy(pool.pendingReview?'poolPending':'poolReviewed')}));text(card,'p',copy('poolDetails',{type:pool.type||copy('typeAbsent'),volume:pool.volumeM3===null?copy('volumeAbsent'):pool.volumeM3+' m³',address:pool.address||copy('addressAbsent'),gps:pool.latitude===null?copy('gpsAbsent'):pool.latitude+', '+pool.longitude}));if(pool.notes)text(card,'p',pool.notes);}
      text(card,'p',copy('limits'));
      const actions=text(card,'div','');actions.className='actions';button(actions,copy('approve'),'intakeApprove',row.id,()=>approve(row));const link=text(actions,'a',copy('open'));link.className='btn';link.href='/client-detail?id='+encodeURIComponent(row.id);
    }
    if(!rows.length&&!saved.some(live))text(list,'p',copy(listed?'empty':'unknown'));
    const latest=saved.filter(row=>row.response?.applied).at(-1);if(latest)text(list,'p',copy('confirmed',{id:latest.resourceId,count:latest.response.approval.poolIds.length,date:dateCopy(latest.response.approval.reviewedAt)}));
  }
  async function refresh(){if(busy)return;const own=++generation;if(!active()){render();return;}let error='';try{const records=await store.records(scope,captured,true);if(!active()||own!==generation)return;saved=records;}catch(e){if(active()){rows=[];saved=[];listed=false;setCopy(status,errorCopy(e));render();}return;}
    try{const response=await fetch('/api/technician-intake/pending-review',{headers:{Authorization:'Bearer '+captured.token},cache:'no-store',signal:AbortSignal.timeout(8000)}),data=await response.json();requireActive();if(own!==generation)return;if(!response.ok||data.ok!==true||!Array.isArray(data.clients)||data.clients.some(row=>!Number.isSafeInteger(row.id)||!/^intake-v1:[a-f0-9]{64}$/.test(row.approvalVersion)||!Array.isArray(row.approvalPoolIds)||!Array.isArray(row.pools)))throw ownError('queryFailed');rows=data.clients;listed=true;}catch(e){if(!active()||own!==generation)return;rows=[];listed=false;error=errorCopy(e);}
    if(!active()||own!==generation)return;render();setCopy(status,error?copy('queryUnconfirmed',{detail:error}):copy('ready'));
  }
  async function execute(operation){if(busy)return;busy=true;++generation;render();let error='';try{requireActive();await operation();requireActive();}catch(e){error=errorCopy(e);}finally{busy=false;await refresh();if(error&&active())setCopy(status,copy('unconfirmed',{detail:error}));}}
  async function approve(row){if(busy||!active()||!confirm(copyText(copy('confirm'))))return;return execute(async()=>{const record=await store.prepare(scope,row.id,{clientId:row.id,expectedVersion:row.approvalVersion,poolIds:row.approvalPoolIds},{label:row.name},captured);await store.send(record.requestId,captured);});}
  async function recover(row){return execute(async()=>{if(row.response?.applied===false)await store.acknowledgeRejection(row.requestId,captured);else await store.send(row.requestId,captured);});}
  reload.addEventListener('click',refresh);window.addEventListener('cw:field-write-change',refresh);window.addEventListener('storage',()=>{if(!active())refresh();});window.addEventListener('pagehide',()=>{closed=true;++generation;});window.addEventListener('pageshow',()=>{closed=false;refresh();});setInterval(()=>{if(!active())refresh();},1000);refresh();
})();
