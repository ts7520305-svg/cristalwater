(function(){
  const API = '/api';
  const state = { visits: [], status: '', search: '' };

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt = (d) => d ? new Date(d).toLocaleString('pt-PT') : '-';
  const token = () => localStorage.getItem('adminToken') || localStorage.getItem('token') || '';

  // Only leaves and attributes created by this page are repainted on language change.
  const languages = ['pt','en','fr','es','de'];
  const copy = {
    title: ['Painel Admin - Visitas','Admin Dashboard - Visits','Tableau Admin - Visites','Panel Admin - Visitas','Admin-Dashboard - Besuche'],
    intro: ['Monitorizacao operacional de visitas com estado, parametros e evidencias fotograficas.','Visit monitoring with status, readings and photographic evidence.','Suivi des visites avec état, paramètres et preuves photographiques.','Seguimiento de visitas con estado, parámetros y evidencias fotográficas.','Besuchsübersicht mit Status, Messwerten und Fotobelegen.'],
    back: ['Voltar','Back','Retour','Volver','Zurück'],
    refresh: ['Atualizar','Refresh','Actualiser','Actualizar','Aktualisieren'],
    logout: ['Sair','Log out','Déconnexion','Salir','Abmelden'],
    filters: ['Filtros de visitas','Visit filters','Filtres de visites','Filtros de visitas','Besuchsfilter'],
    search: ['Pesquisar cliente, piscina, tecnico ou nota','Search client, pool, technician or note','Rechercher client, piscine, technicien ou note','Buscar cliente, piscina, técnico o nota','Kunde, Pool, Techniker oder Notiz suchen'],
    statusFilter: ['Filtrar por estado','Filter by status','Filtrer par état','Filtrar por estado','Nach Status filtern'],
    all: ['Todos os estados','All statuses','Tous les états','Todos los estados','Alle Status'],
    done: ['Concluída','Completed','Terminée','Completada','Abgeschlossen'],
    progress: ['Em curso','In progress','En cours','En curso','In Bearbeitung'],
    empty: ['Sem visitas','No visits','Aucune visite','Sin visitas','Keine Besuche'],
    emptyBody: ['Não existem visitas para os filtros selecionados.','No visits match the selected filters.','Aucune visite ne correspond aux filtres sélectionnés.','No hay visitas para los filtros seleccionados.','Keine Besuche für die ausgewählten Filter.'],
    status: ['Estado','Status','État','Estado','Status'],
    technician: ['Técnico','Technician','Technicien','Técnico','Techniker'],
    start: ['Início','Start','Début','Inicio','Beginn'],
    end: ['Fim','End','Fin','Fin','Ende'],
    chlorine: ['Cloro','Chlorine','Chlore','Cloro','Chlor'],
    alkalinity: ['Alcalinidade','Alkalinity','Alcalinité','Alcalinidad','Alkalinität'],
    salt: ['Sal','Salt','Sel','Sal','Salz'],
    notes: ['Notas:','Notes:','Notes :','Notas:','Notizen:'],
    photo: ['Foto da visita','Visit photo','Photo de la visite','Foto de la visita','Besuchsfoto'],
    loading: ['A carregar visitas...','Loading visits...','Chargement des visites...','Cargando visitas...','Besuche werden geladen...'],
    error: ['Erro ao carregar visitas','Unable to load visits','Impossible de charger les visites','No se pudieron cargar las visitas','Besuche konnten nicht geladen werden'],
    errorBody: ['Confirma login e ligação ao servidor.','Check your login and server connection.','Vérifiez votre connexion et la liaison au serveur.','Comprueba el acceso y la conexión al servidor.','Anmeldung und Serververbindung prüfen.'],
  };
  const bindings = new Map();
  const text = key => copy[key][Math.max(0,languages.indexOf(String(document.documentElement.lang || 'pt').toLowerCase().split('-')[0]))];
  function bind(node,key,attribute='') {
    const rendered = text(key);
    if(attribute) node.setAttribute(attribute,rendered);
    else if(node.childNodes.length===1 && node.firstChild.nodeType===Node.TEXT_NODE) node.firstChild.nodeValue=rendered;
    else node.textContent=rendered;
    const leaves=bindings.get(node)||new Map();
    leaves.set(attribute,{key,rendered,textNode:node.firstChild});bindings.set(node,leaves);
  }
  function bindTree(root) {
    for(const node of root.querySelectorAll('[data-cw-visits-copy]')) bind(node,node.dataset.cwVisitsCopy);
    for(const [attribute,marker] of [['placeholder','data-cw-visits-placeholder'],['aria-label','data-cw-visits-aria'],['alt','data-cw-visits-alt']]) {
      for(const node of root.querySelectorAll('['+marker+']')) bind(node,node.getAttribute(marker),attribute);
    }
  }
  function paint() {
    for(const [node,leaves] of bindings) {
      if(!node.isConnected){bindings.delete(node);continue;}
      for(const [attribute,leaf] of leaves) {
        if(attribute ? node.getAttribute(attribute)!==leaf.rendered : node.childNodes.length!==1 || node.firstChild!==leaf.textNode || node.textContent!==leaf.rendered) {leaves.delete(attribute);continue;}
        bind(node,leaf.key,attribute);
      }
      if(!leaves.size)bindings.delete(node);
    }
  }
  function setVisits(box,html) {
    for(const node of bindings.keys())if(box.contains(node))bindings.delete(node);
    box.innerHTML=html;bindTree(box);
  }
  bindTree(document);
  window.addEventListener('cw-language-change',paint);
  new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

  async function api(path){
    const res = await fetch(API + path, { headers: token() ? { Authorization: 'Bearer ' + token() } : {} });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function normalizeStatus(v){
    if(v.status) return v.status;
    return v.endAt ? 'DONE' : 'IN_PROGRESS';
  }

  function photoUrl(photo){
    return photo.url || photo.path || photo.filename || '';
  }

  function render(){
    const box = $('visits');
    if(!box) return;
    const q = state.search.toLowerCase().trim();
    const rows = state.visits.filter(v => {
      const status = normalizeStatus(v);
      const text = [v.client?.name, v.pool?.name, v.technicianName, v.notes, status].join(' ').toLowerCase();
      return (!state.status || status === state.status) && (!q || text.includes(q));
    });
    if(!rows.length){ setVisits(box,'<div class="card"><h3 data-cw-visits-copy="empty">'+esc(text('empty'))+'</h3><p data-cw-visits-copy="emptyBody">'+esc(text('emptyBody'))+'</p></div>'); return; }
    setVisits(box,rows.map(v => {
      const status = normalizeStatus(v);
      const cls = status === 'DONE' ? 'done' : 'progress';
      const photos = (v.photos || []).map(p => {
        const u = photoUrl(p);
        if(!u) return '';
        return `<img src="${esc(u.startsWith('/') ? u : '/uploads/' + u)}" data-cw-visits-alt="photo" alt="${esc(text('photo'))}">`;
      }).join('');
      return `<article class="card ${cls}">
        <h3>${esc(v.client?.name || '-')} · ${esc(v.pool?.name || '-')}</h3>
        <div class="grid">
          <div class="box"><div class="label" data-cw-visits-copy="status">${esc(text('status'))}</div><div class="value ${status === 'DONE' ? 'done-text' : 'pending-text'}">${esc(status)}</div></div>
          <div class="box"><div class="label" data-cw-visits-copy="technician">${esc(text('technician'))}</div><div class="value">${esc(v.technicianName || v.technician?.name || '-')}</div></div>
          <div class="box"><div class="label" data-cw-visits-copy="start">${esc(text('start'))}</div><div class="value">${esc(fmt(v.startAt))}</div></div>
          <div class="box"><div class="label" data-cw-visits-copy="end">${esc(text('end'))}</div><div class="value">${esc(fmt(v.endAt))}</div></div>
          <div class="box"><div class="label">pH</div><div class="value">${esc(v.ph ?? '-')}</div></div>
          <div class="box"><div class="label" data-cw-visits-copy="chlorine">${esc(text('chlorine'))}</div><div class="value">${esc(v.chlorine ?? '-')}</div></div>
          <div class="box"><div class="label" data-cw-visits-copy="alkalinity">${esc(text('alkalinity'))}</div><div class="value">${esc(v.alkalinity ?? '-')}</div></div>
          <div class="box"><div class="label" data-cw-visits-copy="salt">${esc(text('salt'))}</div><div class="value">${esc(v.salt ?? '-')}</div></div>
        </div>
        ${v.notes ? `<p><b data-cw-visits-copy="notes">${esc(text('notes'))}</b> ${esc(v.notes)}</p>` : ''}
        ${photos ? `<div class="photos">${photos}</div>` : ''}
      </article>`;
    }).join(''));
  }

  async function loadVisits(){
    const box = $('visits');
    if(box) setVisits(box,'<div class="card"><h3 data-cw-visits-copy="loading">'+esc(text('loading'))+'</h3></div>');
    try{
      const data = await api('/visits/today');
      state.visits = Array.isArray(data) ? data : (data.visits || []);
      render();
    }catch(err){
      console.error(err);
      if(box) setVisits(box,'<div class="card"><h3 data-cw-visits-copy="error">'+esc(text('error'))+'</h3><p data-cw-visits-copy="errorBody">'+esc(text('errorBody'))+'</p></div>');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('refreshBtn')?.addEventListener('click', loadVisits);
    $('searchInput')?.addEventListener('input', (e) => { state.search = e.target.value; render(); });
    $('statusFilter')?.addEventListener('change', (e) => { state.status = e.target.value; render(); });
    loadVisits();
  });
})();
