// Cristal Water LDA - barra global estavel de producao
(function(){
  'use strict';
  if(window.__CW_FLOW_SHELL__) return;
  window.__CW_FLOW_SHELL__ = true;

  const path = (location.pathname || '/').replace(/\.html$/i, '').toLowerCase();
  const isLogin = ['/', '/login', '/admin-login', '/client-login', '/technician-login'].includes(path);

  function loadCss(){
    if(!document.querySelector('link[href="/cw-polish.css"]')){
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = '/cw-polish.css';
      document.head.appendChild(l);
    }
  }

  function loadI18n(){
    if(!document.querySelector('script[src="/cw-i18n.js"]')){
      const s = document.createElement('script');
      s.src = '/cw-i18n.js';
      s.defer = true;
      document.body.appendChild(s);
    }
  }

  function loadOperationalRisk(){
    if(isLogin || document.querySelector('script[data-cw-operational-risk]')) return;
    const isAdminArea = path.includes('admin')
      || path.includes('billing')
      || path.includes('invoice')
      || path.includes('to-issue')
      || path.includes('dashboard')
      || path.includes('report');
    if(!isAdminArea) return;
    const s = document.createElement('script');
    s.src = '/cw-operational-risk.js?v=22.6.13-risk-jump';
    s.defer = true;
    s.dataset.cwOperationalRisk = '1';
    document.body.appendChild(s);
  }

  function loadSidebar(){
    if(isLogin || document.querySelector('.cw-side')) return;
    const isAdminArea = path.includes('admin')
      || path.includes('billing')
      || path.includes('invoice')
      || path.includes('to-issue')
      || path.includes('report')
      || path.includes('dashboard')
      || path.includes('communications')
      || path.includes('help-center');
    if(isAdminArea && !window.__CW_PROD_SIDEBAR__){
      const s = document.createElement('script');
      s.src = '/cw-enterprise-sidebar.js';
      document.body.appendChild(s);
    }
  }

  function title(){
    const map = {
      '/admin-master-control': 'Centro de Operacoes',
      '/admin-dashboard': 'Dashboard',
      '/admin-technicians': 'Tecnicos',
      '/admin-clients': 'Clientes',
      '/admin-pools': 'Piscinas',
      '/admin-rounds': 'Rondas',
      '/admin-visits': 'Visitas',
      '/admin-inventory': 'Stock',
      '/billing': 'Financeiro',
      '/invoices': 'Faturas',
      '/to-issue': 'Faturacao Oficial',
      '/client-portal': 'Portal do Cliente',
      '/technician-field-mode': 'Portal Tecnico',
      '/admin-crm': 'Lembretes e Agendamentos'
    };
    return map[path] || document.title.replace(/Cristal Water|LDA|·|-/g, ' ').trim() || 'Cristal Water';
  }

  function addBar(){
    if(isLogin || document.querySelector('.cw-global-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'cw-global-bar';
    bar.innerHTML = `<div class="cw-global-left"><button class="cw-back" type="button">← Voltar</button><a class="cw-home" href="/admin-master-control">🏠 Inicio</a><div><div class="cw-global-title">${title()}</div><span class="cw-global-subtitle">Cristal Water LDA</span></div></div><div class="cw-global-actions"><span class="cw-chip">V22.6.4</span><button type="button" class="cw-undo">↶ Recuperar formulario</button></div>`;
    document.body.prepend(bar);
    bar.querySelector('.cw-back').onclick = () => { if(history.length > 1) history.back(); else location.href = '/admin-master-control'; };
    bar.querySelector('.cw-undo').onclick = restoreLastForm;
  }

  function saveFormSnapshot(form){
    try{
      const id = form.id || form.getAttribute('name') || location.pathname;
      const data = Object.fromEntries(new FormData(form).entries());
      localStorage.setItem('cw:lastform:' + id, JSON.stringify(data));
      localStorage.setItem('cw:lastform:key', id);
    }catch{}
  }

  function restoreLastForm(){
    try{
      const key = localStorage.getItem('cw:lastform:key');
      if(!key) return alert('Sem formulario anterior para recuperar');
      const data = JSON.parse(localStorage.getItem('cw:lastform:' + key) || '{}');
      const form = document.getElementById(key) || document.querySelector('form');
      if(!form) return alert('Nao encontrei formulario nesta pagina');
      Object.entries(data).forEach(([k,v]) => {
        const el = form.elements[k] || document.getElementById(k);
        if(el) el.value = v;
      });
      alert('Ultimo formulario recuperado');
    }catch{
      alert('Nao foi possivel recuperar');
    }
  }

  function addFormMemory(){
    document.addEventListener('submit', e => {
      if(e.target && e.target.tagName === 'FORM') saveFormSnapshot(e.target);
    }, true);
    document.addEventListener('input', e => {
      const f = e.target && e.target.form;
      if(f) saveFormSnapshot(f);
    }, true);
  }

  function removeLegacyTopModules(){
    const remove = () => document.getElementById('cwTopAdminModules')?.remove();
    remove();
    setTimeout(remove, 0);
    setTimeout(remove, 500);
  }

  function boot(){
    removeLegacyTopModules();
    loadCss();
    document.documentElement.classList.add('cw-polish-ready');
    loadSidebar();
    addBar();
    addFormMemory();
    loadI18n();
    loadOperationalRisk();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
