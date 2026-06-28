(function(){
  const API = '/api';
  const state = { visits: [], status: '', search: '' };

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt = (d) => d ? new Date(d).toLocaleString('pt-PT') : '-';
  const token = () => localStorage.getItem('adminToken') || localStorage.getItem('token') || '';

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
    if(!rows.length){ box.innerHTML = '<div class="card"><h3>Sem visitas</h3><p>Não existem visitas para os filtros selecionados.</p></div>'; return; }
    box.innerHTML = rows.map(v => {
      const status = normalizeStatus(v);
      const cls = status === 'DONE' ? 'done' : 'progress';
      const photos = (v.photos || []).map(p => {
        const u = photoUrl(p);
        if(!u) return '';
        return `<img src="${esc(u.startsWith('/') ? u : '/uploads/' + u)}" alt="Foto da visita">`;
      }).join('');
      return `<article class="card ${cls}">
        <h3>${esc(v.client?.name || '-')} · ${esc(v.pool?.name || '-')}</h3>
        <div class="grid">
          <div class="box"><div class="label">Estado</div><div class="value ${status === 'DONE' ? 'done-text' : 'pending-text'}">${esc(status)}</div></div>
          <div class="box"><div class="label">Técnico</div><div class="value">${esc(v.technicianName || v.technician?.name || '-')}</div></div>
          <div class="box"><div class="label">Início</div><div class="value">${esc(fmt(v.startAt))}</div></div>
          <div class="box"><div class="label">Fim</div><div class="value">${esc(fmt(v.endAt))}</div></div>
          <div class="box"><div class="label">pH</div><div class="value">${esc(v.ph ?? '-')}</div></div>
          <div class="box"><div class="label">Cloro</div><div class="value">${esc(v.chlorine ?? '-')}</div></div>
          <div class="box"><div class="label">Alcalinidade</div><div class="value">${esc(v.alkalinity ?? '-')}</div></div>
          <div class="box"><div class="label">Sal</div><div class="value">${esc(v.salt ?? '-')}</div></div>
        </div>
        ${v.notes ? `<p><b>Notas:</b> ${esc(v.notes)}</p>` : ''}
        ${photos ? `<div class="photos">${photos}</div>` : ''}
      </article>`;
    }).join('');
  }

  async function loadVisits(){
    const box = $('visits');
    if(box) box.innerHTML = '<div class="card"><h3>A carregar visitas...</h3></div>';
    try{
      const data = await api('/visits/today');
      state.visits = Array.isArray(data) ? data : (data.visits || []);
      render();
    }catch(err){
      console.error(err);
      if(box) box.innerHTML = '<div class="card"><h3>Erro ao carregar visitas</h3><p>Confirma login e ligação ao servidor.</p></div>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('refreshBtn')?.addEventListener('click', loadVisits);
    $('logoutBtn')?.addEventListener('click', () => { localStorage.clear(); location.href = '/login'; });
    $('searchInput')?.addEventListener('input', (e) => { state.search = e.target.value; render(); });
    $('statusFilter')?.addEventListener('change', (e) => { state.status = e.target.value; render(); });
    loadVisits();
  });
})();
