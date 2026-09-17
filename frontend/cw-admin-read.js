(function () {
  'use strict';
  // Read-only lists stay tied to the opening account. A failed response must
  // never be rendered as an empty or successfully refreshed result.
  function create({ url, list, status, reload, parse, render, empty, loaded }) {
    const keys = ['cristalwater_jwt', 'token', 'cristalwater_user', 'user'];
    const fingerprint = () => JSON.stringify(keys.map(key => localStorage.getItem(key)));
    let initial = '', credential = '', invalidated = false, sequence = 0, controller;
    try { initial = fingerprint(); credential = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || ''; } catch { /* handled as unavailable */ }
    function state(kind, text) { status.dataset.state = kind; status.textContent = text; }
    function active() {
      let same = false; try { same = !!credential && initial === fingerprint(); } catch { /* storage unavailable */ }
      if (same && !invalidated) return true;
      invalidated = true; controller?.abort(); list.replaceChildren(); reload.disabled = true;
      list.setAttribute('aria-busy', 'false'); state('session', 'A sessão mudou ou terminou. Reabra a página com a conta pretendida.'); return false;
    }
    async function load() {
      if (!active()) return;
      const current = ++sequence; controller?.abort(); const request = new AbortController(); controller = request;
      reload.disabled = true; list.replaceChildren(); list.setAttribute('aria-busy', 'true'); state('loading', 'A carregar…');
      try {
        const response = await fetch(url, { headers: { Authorization: 'Bearer ' + credential }, cache: 'no-store', signal: request.signal });
        const result = await response.json(); if (!active() || current !== sequence) return;
        if (response.status !== 200) throw Error('Unconfirmed read');
        const rows = parse(result); render(rows); state(rows.length ? 'ready' : 'empty', rows.length ? loaded : empty);
      } catch (_) {
        if (active() && current === sequence) { list.replaceChildren(); state('error', 'Não foi possível carregar os dados. Use Atualizar para tentar novamente.'); }
      } finally {
        if (active() && current === sequence) { list.setAttribute('aria-busy', 'false'); reload.disabled = false; }
      }
    }
    reload.addEventListener('click', load); window.addEventListener('storage', active); window.addEventListener('focus', active); setInterval(active, 500);
    return { load, active };
  }
  window.CWAdminRead = { create };
})();
