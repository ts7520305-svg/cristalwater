const API = '/api/core';
const MODULE_ROUTES = {
  technicians: '/admin-technicians',
  clients: '/admin-clients',
  pools: '/admin-pools',
  rounds: '/admin-rounds',
  visits: '/admin-visits',
  stock: '/admin-inventory',
  billing: '/billing',
  'simulate-full-flow': '/api/core/simulate-full-flow'
};
const VISIT_STATUSES = ['PLANNED', 'PENDING_TECHNICIAN', 'IN_PROGRESS', 'RETAINED', 'NOT_DONE', 'DONE', 'CANCELLED'];
const state = {
  dashboard: null,
  technicians: [],
};

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

async function api(path, options = {}) {
  const url = path.startsWith('/api') ? path : API + path;
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store'
  });
  const json = await response.json().catch(() => ({ ok: false, error: 'Resposta inválida do servidor.' }));
  if (!response.ok || json.ok === false) {
    throw new Error(json.error || json.message || `Erro HTTP ${response.status}`);
  }
  return json;
}

function number(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function statusClass(value, type = 'normal') {
  const v = number(value);
  if (type === 'bad' && v > 0) return 'bad-card';
  if (type === 'warn' && v > 0) return 'warn-card';
  if (type === 'ok' && v > 0) return 'ok-card';
  return '';
}

function renderMetrics(counts = {}) {
  const criticalAlerts = number(counts.repairsOpen) + number(counts.notificationsUnread);
  const techniciansInField = number(counts.techniciansActive || counts.techniciansOnField || counts.technicians);
  const lowStock = number(counts.productsLowStock || counts.stockLow || counts.inventoryLow);
  const items = [
    { icon: '🚨', label: 'Críticos', value: criticalAlerts, hint: 'ações imediatas', tone: 'bad', href: '/admin-alerts?priority=critical' },
    { icon: '📍', label: 'Visitas hoje', value: counts.visitsPlanned, hint: 'planeadas no dia', tone: 'warn', href: '/admin-rounds?date=today' },
    { icon: '👨‍🔧', label: 'Técnicos ativos', value: techniciansInField, hint: 'em operação no terreno', tone: 'ok', href: '/admin-technicians?status=active' },
    { icon: '💶', label: 'Pendências', value: counts.invoicesOpen, hint: 'financeiro por fechar', tone: 'warn', href: '/invoices?status=pending' }
  ];

  $('#metrics').innerHTML = items.map((item) => `
    <a class="card metric-card ${statusClass(item.value, item.tone)}" href="${esc(item.href)}" aria-label="Abrir ${esc(item.label)}" title="Abrir ${esc(item.label)}">
      <div class="metric-top">
        <div class="metric-icon">${item.icon}</div>
        <span class="pill">${esc(item.label)}</span>
      </div>
      <div class="metric-value">${number(item.value)}</div>
      <div class="metric-label">${esc(item.hint)}</div>
    </a>
  `).join('');
}

function renderPrioritySummary(counts = {}, pendingPools = []) {
  const critical = number(counts.repairsOpen) + number(counts.notificationsUnread);
  const attention = number(counts.invoicesOpen) + number(counts.messagesUnread) + number(counts.productsLowStock || counts.stockLow);
  const info = Math.max(number(counts.visitsPlanned) - number(counts.visitsDone), 0) + (Array.isArray(pendingPools) ? pendingPools.length : 0);

  const total = critical + attention + info;
  $('#prioritySummary').innerHTML = `
    <a class="item" href="/admin-alerts?priority=critical">
      <div>
        <b>${critical} crítico(s)</b>
        <div class="muted">Decisão imediata necessária</div>
      </div>
      <span class="pill">Abrir</span>
    </a>
    <a class="item" href="/admin-alerts?priority=warning">
      <div>
        <b>${attention} requer(em) atenção</b>
        <div class="muted">Pode impactar operação hoje</div>
      </div>
      <span class="pill">Abrir</span>
    </a>
    <a class="item" href="/admin-alerts">
      <div>
        <b>${info} informativo(s)</b>
        <div class="muted">Monitorização e planeamento</div>
      </div>
      <span class="pill">Ver restantes</span>
    </a>
    <div class="small">${total} prioridade(s) agrupadas sem duplicação.</div>
  `;
}

function renderOperationDigest(counts = {}, visits = []) {
  const now = Date.now();
  const active = visits.filter((visit) => String(visit.status || '').toUpperCase() === 'IN_PROGRESS').length;
  const done = visits.filter((visit) => ['DONE', 'COMPLETED', 'CONCLUIDA', 'CONCLUÍDA'].includes(String(visit.status || '').toUpperCase())).length;
  const delayed = visits.filter((visit) => {
    const status = String(visit.status || '').toUpperCase();
    if (['DONE', 'COMPLETED', 'CONCLUIDA', 'CONCLUÍDA'].includes(status)) return false;
    const when = new Date(visit.plannedDate || visit.scheduledAt || visit.createdAt || 0).getTime();
    return Number.isFinite(when) && when < now;
  }).length;
  const nextDecision = Math.max(number(counts.repairsOpen), number(counts.messagesUnread), number(counts.notificationsUnread));

  const digest = document.getElementById('operationDigest');
  if (!digest) return;
  digest.innerHTML = `
    <div class="item"><strong>${delayed}</strong><span>Visitas em atraso</span></div>
    <div class="item"><strong>${active}</strong><span>Em execução</span></div>
    <div class="item"><strong>${number(counts.techniciansActive || counts.techniciansOnField || counts.technicians)}</strong><span>Técnicos disponíveis</span></div>
    <div class="item"><strong>${nextDecision}</strong><span>Próxima decisão</span></div>
  `;
}

function renderTechnicalPropagation(events = []) {
  const root = $('#technicalPropagationList');
  if (!root) return;
  if (!Array.isArray(events) || events.length === 0) {
    root.innerHTML = '<div class="empty">Sem eventos técnicos propagados nas últimas horas.</div>';
    return;
  }

  root.innerHTML = events.slice(0, 10).map((event) => `
    <div class="item">
      <div>
        <b>${esc(event.message || event.component || 'Evento técnico')}</b>
        <div class="muted">Piscina #${esc(event.poolId || '-')} · ${esc(event.type || 'TECHNICAL_EVENT')}</div>
        <div class="small">${formatDate(event.at)}</div>
      </div>
      <a class="btn ghost" href="/admin-pool-technical">Abrir ficha técnica</a>
    </div>
  `).join('');
}

function renderStatusStrip(counts = {}, pendingPools = []) {
  const planned = number(counts.visitsPlanned);
  const done = number(counts.visitsDone);
  const repairs = number(counts.repairsOpen);
  const invoices = number(counts.invoicesOpen);
  const messages = number(counts.messagesUnread);
  const notifications = number(counts.notificationsUnread);
  const technicalSheetEvents = number(counts.technicalSheetEvents24h);
  const pending = Array.isArray(pendingPools) ? pendingPools.length : 0;
  const risk = repairs + invoices + messages + notifications + pending;
  const now = new Date();
  const lastUpdate = document.getElementById('lastUpdate');
  const syncState = document.getElementById('syncState');

  $('#statusStrip').innerHTML = `
    <div class="status-mini"><strong>${risk > 0 ? 'Atenção' : 'OK'}</strong><span>Estado geral</span></div>
    <div class="status-mini"><strong>${planned}</strong><span>Visitas ativas</span></div>
    <div class="status-mini"><strong>${risk}</strong><span>Pontos a rever</span></div>
    <div class="status-mini"><strong>${now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</strong><span>Atualizado</span></div>
  `;

  if (lastUpdate) lastUpdate.textContent = `Atualizado às ${now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
  if (syncState) syncState.textContent = risk > 0 ? 'Atenção operacional' : 'Sincronizado';

  $('#metricsHint').textContent = `${done} concluídas · ${planned} planeadas · ${messages} mensagem(ns) · ${notifications} aviso(s) · ${technicalSheetEvents} evento(s) técnicos/24h · ${risk} ponto(s) a rever`;
}

function morningTone(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'BAD') return 'bad';
  if (value === 'WARN') return 'warn';
  return 'ok';
}

function morningStatusLabel(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'BAD') return 'Critico';
  if (value === 'WARN') return 'Rever';
  return 'OK';
}

function renderMorningCheck(morningCheck = {}) {
  const grid = $('#morningCheckGrid');
  const message = $('#morningCheckMessage');
  const status = $('#morningCheckStatus');
  if (!grid || !message || !status) return;

  const checks = Array.isArray(morningCheck.checks) ? morningCheck.checks : [];
  const counts = morningCheck.counts || {};
  const tone = morningTone(morningCheck.status);

  message.textContent = morningCheck.message || 'Guias, quimicos, agenda, chaves e lembretes ficam aqui antes das equipas sairem.';
  status.innerHTML = `
    <span class="morning-badge ${tone}">${esc(morningCheck.title || morningStatusLabel(morningCheck.status))}</span>
    <span class="morning-badge bad">${number(counts.bad)} critico(s)</span>
    <span class="morning-badge warn">${number(counts.warn)} aviso(s)</span>
    <span class="morning-badge ok">${number(counts.ok)} ok</span>
  `;

  if (!checks.length) {
    grid.innerHTML = '<div class="morning-empty">Sem dados de arranque disponiveis. Atualiza o Centro de Operacoes.</div>';
    return;
  }

  grid.innerHTML = checks.map((check) => {
    const cardTone = morningTone(check.status);
    const details = Array.isArray(check.details) ? check.details.filter(Boolean).slice(0, 4) : [];
    const href = check.href || '#';
    return `
      <a class="morning-card ${cardTone}" href="${esc(href)}">
        <div class="morning-card-top">
          <div>
            <h3>${esc(check.label || 'Verificacao')}</h3>
            <span class="pill">${esc(morningStatusLabel(check.status))}</span>
          </div>
          <div class="morning-count">${number(check.count)}</div>
        </div>
        <div class="morning-message">${esc(check.message || 'Sem mensagem operacional.')}</div>
        <div class="morning-details">
          ${details.length ? details.map((detail) => `<span>${esc(detail)}</span>`).join('') : '<span>Sem detalhe pendente.</span>'}
        </div>
        <div class="morning-actions">
          <span class="small">Clique para resolver</span>
          <span class="morning-link">Abrir</span>
        </div>
      </a>
    `;
  }).join('');
}

function formatDate(value) {
  if (!value) return 'sem data';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function toDatetimeLocal(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function technicianOptions(selectedId) {
  const selected = String(selectedId || '');
  const options = ['<option value="">Sem tecnico</option>'];
  state.technicians.forEach((tech) => {
    options.push(`<option value="${esc(tech.id)}" ${String(tech.id) === selected ? 'selected' : ''}>${esc(tech.name || `Tecnico #${tech.id}`)}</option>`);
  });
  return options.join('');
}

function statusOptions(selectedStatus) {
  const selected = String(selectedStatus || 'PLANNED').toUpperCase();
  return VISIT_STATUSES.map((status) => `<option value="${status}" ${status === selected ? 'selected' : ''}>${status}</option>`).join('');
}

function ensureVisitEditor() {
  if ($('#visitEditModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="visitEditModal" class="visit-modal" hidden>
      <div class="visit-modal-panel" role="dialog" aria-modal="true" aria-labelledby="visitEditTitle">
        <div class="visit-modal-head">
          <div>
            <h2 id="visitEditTitle">Editar visita</h2>
            <p id="visitEditSubtitle" class="muted">Ajusta a visita sem sair do Centro de Operacoes.</p>
          </div>
          <button id="visitEditClose" type="button" class="btn ghost">Fechar</button>
        </div>
        <form id="visitEditForm" class="visit-edit-form">
          <input id="visitEditId" type="hidden">
          <label>Data e hora
            <input id="visitEditPlannedDate" type="datetime-local">
          </label>
          <label>Tecnico
            <select id="visitEditTechnician"></select>
          </label>
          <label>Estado
            <select id="visitEditStatus"></select>
          </label>
          <label>Motivo / impedimento
            <input id="visitEditReason" placeholder="Ex: cliente pediu adiamento, sem acesso">
          </label>
          <label class="wide">Notas para a equipa
            <textarea id="visitEditNotes" rows="3" placeholder="Notas operacionais da visita"></textarea>
          </label>
          <label class="wide">Notas internas
            <textarea id="visitEditInternalNotes" rows="3" placeholder="Notas internas para administracao"></textarea>
          </label>
          <div id="visitEditStatusBox" class="visit-edit-status"></div>
          <div class="visit-modal-actions">
            <a id="visitEditOpenModule" class="btn ghost" href="/admin-visits">Abrir modulo visitas</a>
            <button type="submit" class="primary">Guardar alteracoes</button>
          </div>
        </form>
      </div>
    </div>
  `);

  $('#visitEditClose')?.addEventListener('click', closeVisitEditor);
  $('#visitEditModal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'visitEditModal') closeVisitEditor();
  });
  $('#visitEditForm')?.addEventListener('submit', saveVisitEdit);
}

function findVisit(id) {
  return (state.dashboard?.nextVisits || []).find((visit) => String(visit.id) === String(id));
}

function openVisitEditor(id) {
  ensureVisitEditor();
  const visit = findVisit(id);
  if (!visit) return;

  $('#visitEditId').value = visit.id;
  $('#visitEditTitle').textContent = `Editar visita #${visit.id}`;
  $('#visitEditSubtitle').textContent = `${visit.pool?.name || 'Piscina'} - ${visit.client?.name || 'Cliente'}`;
  $('#visitEditPlannedDate').value = toDatetimeLocal(visit.plannedDate || visit.date || visit.createdAt);
  $('#visitEditTechnician').innerHTML = technicianOptions(visit.technicianId || visit.technician?.id);
  $('#visitEditStatus').innerHTML = statusOptions(visit.status);
  $('#visitEditReason').value = visit.reason || '';
  $('#visitEditNotes').value = visit.notes || '';
  $('#visitEditInternalNotes').value = visit.internalNotes || '';
  $('#visitEditOpenModule').href = `/admin-visits?visitId=${encodeURIComponent(visit.id)}`;
  $('#visitEditStatusBox').textContent = '';
  $('#visitEditModal').hidden = false;
}

function closeVisitEditor() {
  const modal = $('#visitEditModal');
  if (modal) modal.hidden = true;
}

async function saveVisitEdit(event) {
  event.preventDefault();
  const id = $('#visitEditId')?.value;
  if (!id) return;

  const box = $('#visitEditStatusBox');
  if (box) {
    box.className = 'visit-edit-status';
    box.textContent = 'A guardar visita...';
  }

  try {
    const plannedValue = $('#visitEditPlannedDate')?.value || '';
    const payload = {
      plannedDate: plannedValue ? new Date(plannedValue).toISOString() : undefined,
      technicianId: $('#visitEditTechnician')?.value || null,
      status: $('#visitEditStatus')?.value || 'PLANNED',
      reason: $('#visitEditReason')?.value || '',
      notes: $('#visitEditNotes')?.value || '',
      internalNotes: $('#visitEditInternalNotes')?.value || '',
    };

    const result = await api(`/api/round-planner/visits/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    const visits = state.dashboard?.nextVisits || [];
    const index = visits.findIndex((visit) => String(visit.id) === String(id));
    if (index >= 0) visits[index] = result.visit;

    renderVisits(visits);
    if (box) {
      box.className = 'visit-edit-status ok';
      box.textContent = 'Visita atualizada.';
    }
    setTimeout(closeVisitEditor, 450);
  } catch (error) {
    if (box) {
      box.className = 'visit-edit-status error';
      box.textContent = error.message || 'Erro ao guardar visita.';
    }
  }
}

function renderVisits(visits = []) {
  if (!Array.isArray(visits) || visits.length === 0) {
    $('#todayList').innerHTML = '<div class="empty">Sem visitas abertas. Quando existirem rondas/visitas, aparecem aqui.</div>';
    return;
  }

  $('#todayList').innerHTML = visits.slice(0, 20).map((visit) => `
    <div class="item visit-item">
      <div>
        <b>${esc(visit.pool?.name || 'Piscina')}</b>
        <div class="muted">${esc(visit.client?.name || 'Cliente nao definido')} · ${esc(visit.technician?.name || visit.technicianName || 'sem tecnico')}</div>
        <div class="small">${formatDate(visit.plannedDate || visit.scheduledAt || visit.createdAt)}</div>
      </div>
      <div class="visit-actions">
        <span class="pill">${esc(visit.status || 'SEM ESTADO')}</span>
        <button type="button" class="btn ghost" data-edit-visit="${esc(visit.id)}">Editar</button>
        <a class="btn ghost" href="/admin-visits?visitId=${esc(visit.id)}">Abrir</a>
      </div>
    </div>
  `).join('');
}

function renderPendingPools(pools = []) {
  if (!Array.isArray(pools) || pools.length === 0) {
    $('#pendingPoolsList').innerHTML = '<div class="empty">Sem piscinas pendentes de ronda.</div>';
    return;
  }

  $('#pendingPoolsList').innerHTML = pools.slice(0, 20).map((pool) => `
    <div class="item">
      <div>
        <b>${esc(pool.name || 'Piscina')}</b>
        <div class="muted">${esc(pool.client?.name || 'Cliente não definido')} · ${esc(pool.zone || pool.location || 'zona não definida')}</div>
      </div>
      <a class="btn ghost" href="/admin-rounds">Planear</a>
    </div>
  `).join('');
}

function render(data = {}) {
  state.dashboard = data;
  const counts = data.counts || {};
  const pendingPools = data.pendingPoolsWithoutRound || [];
  const visits = data.nextVisits || [];

  renderMetrics(counts);
  renderStatusStrip(counts, pendingPools);
  renderPrioritySummary(counts, pendingPools);
  renderOperationDigest(counts, visits);
  renderTechnicalPropagation(data.technicalPropagation || []);
  renderMorningCheck(data.morningCheck || {});
  renderVisits(visits);
  renderPendingPools(pendingPools);

  const unreadMessages = number(counts.messagesUnread);
  if (unreadMessages > 0) {
    $('#statusBox').innerHTML = `Atenção: existem <b>${unreadMessages}</b> mensagem(ns) de clientes por responder. <a class="btn ghost" href="/chat?filter=unread" style="margin-left:8px">Abrir mensagens</a>`;
    return;
  }

  $('#statusBox').textContent = `Sistema carregado com sucesso. ${number(counts.clients)} cliente(s), ${number(counts.pools)} piscina(s), ${number(counts.technicians)} técnico(s).`;
}

async function load() {
  const btn = $('#refreshBtn');
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'A atualizar...';
    }
    const [dashboard, techniciansData] = await Promise.all([
      api('/dashboard'),
      api('/api/technicians').catch(() => ({ technicians: [] })),
    ]);
    state.technicians = Array.isArray(techniciansData) ? techniciansData : (techniciansData.technicians || []);
    render(dashboard);
  } catch (error) {
    console.error(error);
    $('#statusBox').textContent = error.message || 'Erro ao carregar Centro de Operações.';
    $('#metrics').innerHTML = '<div class="card bad-card"><div class="metric-value">!</div><div class="metric-label">Erro ao carregar indicadores</div></div>';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Atualizar';
    }
  }
}

const refreshBtn = $('#refreshBtn');
if (refreshBtn) refreshBtn.addEventListener('click', load);

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit-visit]');
  if (button) openVisitEditor(button.dataset.editVisit);
});

document.addEventListener('DOMContentLoaded', load);
