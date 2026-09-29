(function(){
  'use strict';
  const store=window.CWFieldWriteStore;
  const messages={
    "sessionReopen":["Sessão alterada. Reabra a página.", "Session changed. Reopen the page.", "Session modifiée. Rouvrez la page.", "Sesión modificada. Vuelva a abrir la página.", "Sitzung geändert. Öffnen Sie die Seite erneut."],
    "session":["Sessão alterada.", "Session changed.", "Session modifiée.", "Sesión modificada.", "Sitzung geändert."],
    "connect":["Ligue à rede para confirmar esta visita antes de preparar o pedido.", "Connect to confirm this visit before preparing the request.", "Connectez-vous pour confirmer cette visite avant de préparer la demande.", "Conéctese para confirmar esta visita antes de preparar la solicitud.", "Stellen Sie eine Verbindung her, um diesen Besuch vor dem Vorbereiten der Anfrage zu bestätigen."],
    "viewFailed":["Não foi possível confirmar a visita. Preserve o registo.", "Could not confirm the visit. Preserve the report.", "Impossible de confirmer la visite. Conservez le signalement.", "No se ha podido confirmar la visita. Conserve el registro.", "Der Besuch konnte nicht bestätigt werden. Bewahren Sie die Meldung auf."],
    "invalidDraft":["Rascunho inválido. Conserve os dados e peça apoio.", "Invalid draft. Preserve the data and ask for support.", "Brouillon invalide. Conservez les données et demandez de l’aide.", "Borrador no válido. Conserve los datos y pida ayuda.", "Ungültiger Entwurf. Bewahren Sie die Daten auf und bitten Sie um Unterstützung."],
    "unreadableDraft":["Rascunho ilegível. Conserve os dados e peça apoio.", "Unreadable draft. Preserve the data and ask for support.", "Brouillon illisible. Conservez les données et demandez de l’aide.", "Borrador ilegible. Conserve los datos y pida ayuda.", "Unlesbarer Entwurf. Bewahren Sie die Daten auf und bitten Sie um Unterstützung."],
    "locksUnsupported":["Este navegador não permite coordenar os rascunhos.", "This browser cannot coordinate drafts.", "Ce navigateur ne permet pas de coordonner les brouillons.", "Este navegador no permite coordinar los borradores.", "Dieser Browser kann Entwürfe nicht koordinieren."],
    "crossWindow":["O rascunho mudou noutra janela. Reabra a visita para recuperar a versão guardada.", "The draft changed in another window. Reopen the visit to recover the saved version.", "Le brouillon a changé dans une autre fenêtre. Rouvrez la visite pour récupérer la version enregistrée.", "El borrador ha cambiado en otra ventana. Vuelva a abrir la visita para recuperar la versión guardada.", "Der Entwurf wurde in einem anderen Fenster geändert. Öffnen Sie den Besuch erneut, um die gespeicherte Version wiederherzustellen."],
    "contextFirst":["Confirme primeiro o contexto da visita.", "Confirm the visit context first.", "Confirmez d’abord le contexte de la visite.", "Confirme primero el contexto de la visita.", "Bestätigen Sie zuerst den Besuchskontext."],
    "notSaved":["O rascunho não ficou guardado.", "The draft was not saved.", "Le brouillon n’a pas été enregistré.", "El borrador no se ha guardado.", "Der Entwurf wurde nicht gespeichert."]
  };
  const errorCopies=new WeakMap();
  function describe(error,key){errorCopies.set(error,Object.freeze(Object.fromEntries(['pt','en','fr','es','de'].map((language,index)=>[language,messages[key][index]]))));return error;}
  const problem=key=>describe(Error(messages[key][0]),key);
  // Only errors originating here receive a presentation copy; server text stays literal.
  const errorTranslations=error=>errorCopies.get(error)||null;
  const key=(scope,context,captured)=>`cwIncompleteV2:${captured.owner}:${scope}:${context.visitType}:${context.id}`;
  const validContext=(context,data)=>data?.ok===true&&data.visit?.id===context.id&&data.visit.visitType===context.visitType&&data.visit.poolId===context.poolId&&/^[a-f0-9]{64}$/.test(data.baseVersion)&&typeof data.hasReturn==='boolean'&&typeof data.hasImpediment==='boolean';
  async function view(context,captured){
    if(!store.same(captured))throw problem('sessionReopen');
    const cache=key('context',context,captured);
    if(!navigator.onLine){const saved=JSON.parse(localStorage.getItem(cache)||'null');if(!validContext(context,saved))throw problem('connect');return saved;}
    const response=await fetch(`/api/technician/visits/${context.id}/incomplete?visitType=${context.visitType}`,{headers:{Authorization:'Bearer '+captured.token},cache:'no-store',signal:AbortSignal.timeout(10000)}),data=await response.json();
    if(!store.same(captured))throw problem('session');
    if(response.status!==200||!validContext(context,data))throw (data.error?Error(data.error):problem('viewFailed'));
    localStorage.setItem(cache,JSON.stringify(data));return data;
  }
  function read(scope,context,captured){
    if(!store.same(captured))throw problem('session');
    const name=key(scope,context,captured),raw=localStorage.getItem(name);let value;
    try{value=raw?JSON.parse(raw):null;}catch(error){throw describe(error,'unreadableDraft');}
    if(value&&(value.owner!==captured.owner||value.context.id!==context.id||value.context.visitType!==context.visitType||value.context.poolId!==context.poolId||!value.values||!validContext(context,value.snapshot)))throw problem('invalidDraft');
    return {name,raw,value};
  }
  async function write(previous,context,values,snapshot,captured){
    if(!navigator.locks?.request)throw problem('locksUnsupported');
    return navigator.locks.request(previous.name,async()=>{
      if(!store.same(captured))throw problem('session');
      if(localStorage.getItem(previous.name)!==previous.raw)throw problem('crossWindow');
      if(!validContext(context,snapshot))throw problem('contextFirst');
      const value={owner:captured.owner,context,values,snapshot,savedAt:new Date().toISOString()},raw=JSON.stringify(value);
      localStorage.setItem(previous.name,raw);if(localStorage.getItem(previous.name)!==raw)throw problem('notSaved');
      return {name:previous.name,raw,value};
    });
  }
  async function clear(previous,captured){
    if(!previous)return;
    await navigator.locks.request(previous.name,async()=>{if(store.same(captured)&&localStorage.getItem(previous.name)===previous.raw)localStorage.removeItem(previous.name);});
  }
  async function prepare(scope,context,values,snapshot,captured){
    if(!validContext(context,snapshot))throw problem('contextFirst');
    return store.prepare(scope,context.id,{visitType:context.visitType,poolId:context.poolId,baseVersion:snapshot.baseVersion,...values},{label:`${context.visitType==='EXTRA'?'Visita extra':'Visita'} #${context.id}`},captured);
  }
  window.CWIncompleteWorkflow={view,read,write,clear,prepare,errorTranslations};
})();
