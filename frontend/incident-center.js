(function () {
  'use strict';
  const authKeys = ['token', 'cristalwater_jwt', 'adminToken', 'user', 'cristalwater_user'];
  const $ = id => document.getElementById(id);
  const fingerprint = () => authKeys.map(key => localStorage.getItem(key) || '').join('\u0000');
  const owner = fingerprint();
  const token = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token');
  let incidents = [], timeline = [], ready = false, loading = false, writing = false;
  let invalidated = false, readVersion = 0, readController, writeController, socket;

  function textElement(tag, text, className) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = String(text ?? '');
    return el;
  }
  function status(message, state) {
    $('incidentStatus').textContent = message;
    $('incidentStatus').dataset.state = state;
  }
  function controls() {
    $('refreshBtn').disabled = invalidated || writing || loading || !navigator.onLine;
    $('refreshBtn').setAttribute('aria-busy', String(loading));
    $('incidentList').setAttribute('aria-busy', String(loading || writing));
    document.querySelectorAll('.incident-actions button').forEach(button => {
      button.disabled = invalidated || writing || loading || !ready || !navigator.onLine;
    });
  }
  function clearSnapshot(message) {
    incidents = []; ready = false;
    for (const id of ['criticalCount', 'highCount', 'activeCount', 'resolvedCount']) $(id).textContent = '—';
    $('incidentList').replaceChildren(textElement('p', message));
    controls();
  }
  function invalidate() {
    if (invalidated) return;
    invalidated = true; readVersion++;
    readController?.abort(); writeController?.abort(); socket?.disconnect();
    loading = writing = false; timeline = [];
    $('incidentTimeline').replaceChildren(); $('actionStatus').textContent = '';
    clearSnapshot('Volte a abrir esta página com a conta pretendida.');
    status('A sessão mudou. A informação anterior foi retirada.', 'session');
  }
  function sameSession() {
    if (invalidated) return false;
    if (!token || fingerprint() !== owner) { invalidate(); return false; }
    return true;
  }
  function validIncident(row) {
    return row && Number.isSafeInteger(row.id) && row.id > 0 &&
      ['title', 'severity', 'status'].every(key => typeof row[key] === 'string') &&
      typeof row.escalated === 'boolean' &&
      Number.isFinite(row.impactScore) && Number.isFinite(row.priorityScore);
  }
  function validList(data) {
    return data?.ok === true && Array.isArray(data.incidents) && data.incidents.every(validIncident) &&
      new Set(data.incidents.map(row => row.id)).size === data.incidents.length;
  }
  function dateLabel(value) {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date.toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' }) : '—';
  }
  function sla(row) {
    const deadline = row.slaDeadline ? new Date(row.slaDeadline).getTime() : NaN;
    const created = row.createdAt ? new Date(row.createdAt).getTime() : NaN;
    if (row.status === 'RESOLVED') return { label: 'SLA: encerrado', percent: 0 };
    if (!Number.isFinite(deadline) || !Number.isFinite(created) || deadline <= created) return { label: 'SLA: —', percent: 0 };
    const minutes = Math.ceil((deadline - Date.now()) / 60000);
    return { label: 'SLA: ' + (minutes <= 0 ? 'VENCIDO' : minutes + ' min'), percent: Math.max(0, Math.min(100, Math.floor((Date.now() - created) / (deadline - created) * 100))) };
  }
  function refreshSla() {
    if (!ready || invalidated) return;
    for (const row of incidents) {
      const card = $('incident-' + row.id); if (!card) continue;
      const value = sla(row), bar = card.querySelector('.sla-progress');
      card.querySelector('.badge-sla').textContent = value.label;
      bar.style.width = value.percent + '%';
      bar.style.background = value.percent >= 90 ? '#dc2626' : value.percent >= 60 ? '#ea580c' : '#16a34a';
    }
  }
  function render() {
    $('criticalCount').textContent = incidents.filter(row => row.severity === 'CRITICAL').length;
    $('highCount').textContent = incidents.filter(row => row.severity === 'HIGH').length;
    $('activeCount').textContent = incidents.filter(row => row.status !== 'RESOLVED').length;
    $('resolvedCount').textContent = incidents.filter(row => row.status === 'RESOLVED').length;
    const fragment = document.createDocumentFragment();
    for (const row of incidents) {
      const severity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(row.severity) ? row.severity.toLowerCase() : 'unknown';
      const card = textElement('article', '', 'incident incident-' + severity); card.id = 'incident-' + row.id;
      card.append(textElement('h3', row.title), textElement('p', row.description));
      const badges = textElement('div', '', 'badges');
      badges.append(textElement('span', row.severity, 'badge badge-' + severity), textElement('span', '', 'badge badge-sla'));
      if (row.escalated) badges.append(textElement('span', 'ESCALADO', 'badge badge-escalated'));
      card.append(badges);
      const meta = textElement('div', '', 'incident-meta');
      for (const [label, value] of [['Estado', row.status], ['Impacto', row.impactScore], ['Prioridade', row.priorityScore], ['Origem', row.source || '—'], ['Criado (Lisboa)', dateLabel(row.createdAt)]]) {
        const line = textElement('div', label + ': '); line.append(textElement('b', value)); meta.append(line);
      }
      const container = textElement('div', '', 'sla-container'), bar = textElement('div', '', 'sla-bar');
      bar.setAttribute('aria-hidden', 'true'); bar.append(textElement('div', '', 'sla-progress')); container.append(bar);
      card.append(meta, container);
      if (row.status !== 'RESOLVED') {
        const actions = textElement('div', '', 'incident-actions');
        for (const [action, label] of [['resolve', 'Resolver'], ['escalate', 'Escalar']]) {
          if (action === 'escalate' && row.escalated) continue;
          const button = textElement('button', label, 'btn-' + action); button.type = 'button';
          button.setAttribute('aria-label', label + ' incidente #' + row.id);
          button.addEventListener('click', () => mutate(row.id, action)); actions.append(button);
        }
        card.append(actions);
      }
      fragment.append(card);
    }
    if (!incidents.length) fragment.append(textElement('p', 'Sem incidentes registados.'));
    $('incidentList').replaceChildren(fragment); refreshSla(); controls();
  }
  function addTimeline(title, id) {
    timeline.unshift({ title, id, date: new Date().toISOString() }); timeline = timeline.slice(0, 30);
    $('incidentTimeline').replaceChildren(...timeline.map(item => {
      const entry = textElement('div', '', 'timeline-item');
      entry.append(textElement('b', item.title), textElement('div', 'Incidente #' + item.id), textElement('div', dateLabel(item.date), 'timeline-time'));
      return entry;
    }));
  }
  async function loadIncidents() {
    if (!sameSession() || writing) return;
    const version = ++readVersion;
    readController?.abort(); readController = new AbortController();
    if (!navigator.onLine) {
      loading = false; clearSnapshot('Ligue-se à rede para consultar os incidentes.');
      status('Sem ligação. Os incidentes não foram confirmados.', 'offline'); return;
    }
    loading = true; clearSnapshot('A consultar os incidentes…'); status('A carregar incidentes…', 'loading');
    try {
      const response = await fetch('/api/incidents', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: readController.signal });
      if (!sameSession() || version !== readVersion) return;
      if (!response.ok) throw Object.assign(Error('read'), { status: response.status });
      const data = await response.json();
      if (!sameSession() || version !== readVersion) return;
      if (!validList(data)) throw Error('invalid response');
      incidents = data.incidents; ready = true; render();
      status('Lista atualizada às ' + dateLabel(new Date().toISOString()) + '.', incidents.length ? 'ready' : 'empty');
    } catch (error) {
      if (!sameSession() || version !== readVersion) return;
      if (error.status === 401 || error.status === 403) { timeline = []; $('incidentTimeline').replaceChildren(); }
      clearSnapshot('Não foi possível consultar a lista. Use Atualizar para tentar novamente.');
      status(error.status === 403 ? 'Sem permissão para consultar os incidentes.' : error.status === 401 ? 'Sessão inválida. Volte a entrar.' : 'Não foi possível carregar os incidentes. Os totais estão indisponíveis.', 'error');
    } finally {
      if (version === readVersion) { loading = false; controls(); }
    }
  }
  async function mutate(id, action) {
    if (!sameSession() || !ready || writing || loading || !navigator.onLine) return;
    const row = incidents.find(item => item.id === id);
    if (!row || row.status === 'RESOLVED' || (action === 'escalate' && row.escalated)) return;
    writing = true; controls();
    $('actionStatus').textContent = 'A confirmar a operação no servidor…';
    writeController = new AbortController();
    let confirmed = false;
    try {
      const response = await fetch('/api/incidents/' + (action === 'resolve' ? 'status/' : 'escalate/') + id, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'resolve' ? { status: 'RESOLVED' } : {}), signal: writeController.signal,
      });
      if (!sameSession()) return;
      if (!response.ok) throw Object.assign(Error('write'), { status: response.status });
      const data = await response.json();
      if (!sameSession()) return;
      if (data?.ok !== true || !validIncident(data.incident) || data.incident.id !== id ||
          (action === 'resolve' ? data.incident.status !== 'RESOLVED' : data.incident.escalated !== true)) throw Error('unconfirmed response');
      const title = action === 'resolve' ? 'Incidente resolvido' : 'Incidente escalado';
      addTimeline(title, id); $('actionStatus').textContent = title + ' — confirmação recebida do servidor.'; confirmed = true;
    } catch (error) {
      if (!sameSession()) return;
      ready = false;
      clearSnapshot('Atualize a lista para verificar o estado dos incidentes.');
      status('O estado da operação não foi confirmado. Atualize a lista.', 'error');
      if (error.status === 401 || error.status === 403) {
        timeline = []; $('incidentTimeline').replaceChildren(); clearSnapshot('Atualize a lista após confirmar o seu acesso.');
        $('actionStatus').textContent = error.status === 403 ? 'Sem permissão para esta operação.' : 'Sessão inválida. Volte a entrar.';
      } else {
        $('actionStatus').textContent = 'Não foi possível confirmar a operação. Atualize a lista para verificar o estado antes de tentar novamente.';
      }
    } finally {
      writing = false; writeController = null; controls();
    }
    if (confirmed && sameSession()) await loadIncidents();
  }
  $('refreshBtn').addEventListener('click', () => { $('actionStatus').textContent = ''; void loadIncidents(); });
  $('dashboardBtn').addEventListener('click', () => { window.location.href = '/admin-dashboard'; });
  window.addEventListener('storage', event => {
    if ((event.key === null || authKeys.includes(event.key)) && event.oldValue !== event.newValue) invalidate();
  });
  window.addEventListener('offline', () => {
    if (!sameSession()) return;
    ++readVersion; readController?.abort(); loading = false;
    clearSnapshot('Ligue-se à rede para consultar os incidentes.'); status('Sem ligação. Os incidentes não foram confirmados.', 'offline');
  });
  window.addEventListener('online', () => { if (sameSession() && !writing) void loadIncidents(); });
  const timer = setInterval(() => { if (sameSession()) refreshSla(); }, 1000);
  window.addEventListener('pagehide', () => { invalidate(); clearInterval(timer); });
  try {
    if (sameSession() && typeof window.io === 'function') {
      socket = window.io({ auth: { token } });
      for (const event of ['new-incident', 'incident-updated', 'incident-escalated']) socket.on(event, () => { if (sameSession() && !writing) void loadIncidents(); });
    }
  } catch (_) { /* Manual reads remain available if realtime is unavailable. */ }
  $('incidentTimeline').append(textElement('p', 'As operações confirmadas nesta sessão aparecem aqui.'));
  void loadIncidents();
})();
