(() => {
  'use strict';
  const panel = document.getElementById('inventoryCountPanel');
  if (!panel) return;
  const el = suffix => document.getElementById('inventoryCount' + suffix);
  const vehicle = el('Vehicle'), product = el('Product'), physical = el('Physical');
  const status = el('Status'), editor = el('Editor'), pendingPanel = el('Pending');
  const getToken = () => window.CristalAuth?.getToken?.() || localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token');
  function principal() {
    const user = JSON.parse(localStorage.getItem('cristalwater_user') || localStorage.getItem('user') || 'null');
    if (user?.role !== 'ADMIN' || !Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) throw Error('Confirme a sessão de administrador.');
    return `ADMIN:${Number(user.id)}`;
  }
  let token, owner, storageKey, pending = null, snapshot = null, balances = [];
  let busy = false, closed = false, blocked = false, vehiclesReady = false, observedAt = '';
  const number = value => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 8 }).format(value);
  function controls() {
    const locked = busy || closed || blocked || Boolean(pending);
    editor.hidden = closed || blocked || Boolean(pending);
    pendingPanel.hidden = closed || blocked || !pending;
    vehicle.disabled = locked || !vehiclesReady;
    el('Reload').disabled = locked;
    el('Load').disabled = locked || !vehicle.value;
    product.disabled = locked || !balances.length;
    physical.disabled = locked || !snapshot;
    el('Save').disabled = locked || !snapshot || physical.value.trim() === '' || !physical.validity.valid;
    el('Retry').disabled = busy || closed || blocked || !pending;
  }
  function session() {
    let current;
    try { current = principal(); } catch {}
    if (!token || getToken() !== token || current !== owner) {
      closed = true; snapshot = null; balances = [];
      el('PendingSummary').textContent = ''; el('Snapshot').textContent = ''; el('Difference').textContent = '';
      physical.value = ''; product.replaceChildren(); vehicle.replaceChildren();
      document.querySelector('[role="dialog"][aria-label="Confirmar contagem física"] .cw-ui-btn-muted')?.click();
      status.textContent = 'A sessão mudou. Reabra o inventário com a conta correta; as contagens pendentes foram mantidas.';
      status.dataset.tone = 'error';
      controls(); throw Error('Sessão alterada.');
    }
  }
  async function api(url, body) {
    session();
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store', ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000),
    });
    session();
    const data = await response.json(); session();
    if (!response.ok || data.ok === false) throw Object.assign(Error(data.error || 'O servidor não confirmou a operação.'), { status: response.status });
    return data;
  }
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  function validPending(value) {
    const body = value?.body;
    return value?.version === 1 && value.owner === owner && body && uuid(body.requestId) &&
      Number.isSafeInteger(body.vehicleId) && body.vehicleId > 0 && Number.isSafeInteger(value.balanceId) && value.balanceId > 0 &&
      typeof body.productName === 'string' && body.productName.length > 0 && body.productName.length <= 160 &&
      typeof body.unit === 'string' && body.unit.length > 0 && body.unit.length <= 24 &&
      typeof body.expectedQuantity === 'number' && Number.isFinite(body.expectedQuantity) && body.expectedQuantity >= 0 &&
      typeof body.physicalQuantity === 'number' && Number.isFinite(body.physicalQuantity) && body.physicalQuantity >= 0 &&
      typeof value.vehicleLabel === 'string';
  }
  function readPending() {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    let value;
    try { value = JSON.parse(raw); } catch { throw Error('A contagem guardada não pôde ser lida. Os dados foram mantidos; peça apoio antes de iniciar outra.'); }
    if (!validPending(value)) throw Error('A contagem guardada não pôde ser lida. Os dados foram mantidos; peça apoio antes de iniciar outra.');
    return value;
  }
  function showPending() {
    if (pending) {
      const b = pending.body;
      el('PendingSummary').textContent = `${pending.vehicleLabel} · ${b.productName}: saldo consultado ${number(b.expectedQuantity)} ${b.unit}; quantidade contada ${number(b.physicalQuantity)} ${b.unit}.`;
    }
    controls();
  }
  function forgetPending() {
    // Never remove a different request saved by another page.
    if (JSON.stringify(readPending()) !== JSON.stringify(pending)) throw Error('A contagem pendente mudou noutra janela. Reabra a página.');
    localStorage.removeItem(storageKey); pending = null;
  }
  function clearSnapshot() {
    snapshot = null; balances = []; physical.value = ''; observedAt = '';
    product.replaceChildren(new Option('Consulte o saldo da viatura', ''));
    el('Snapshot').textContent = ''; el('Difference').textContent = ''; controls();
  }
  async function loadVehicles() {
    const data = await api('/api/guides/vehicles');
    const rows = Array.isArray(data) ? data : data.vehicles || data.data;
    if (!Array.isArray(rows)) throw Error('Não foi possível ler as viaturas. Reabra a página para tentar novamente.');
    vehicle.replaceChildren(new Option('Selecionar viatura', ''));
    for (const row of rows) {
      if (!Number.isSafeInteger(row.id) || row.id <= 0 || row.active === false || row.deletedAt || row.archiveStatus && row.archiveStatus !== 'ATIVO') continue;
      vehicle.add(new Option(row.plate || row.name || `Viatura ${row.id}`, String(row.id)));
    }
    vehiclesReady = true;
  }
  async function run(work) {
    if (busy || closed || blocked) return;
    busy = true; status.dataset.tone = 'info'; controls();
    try { session(); await work(); }
    catch (error) { if (!closed) { status.textContent = error.message || 'Não foi possível confirmar. Volte a tentar.'; status.dataset.tone = 'error'; } }
    finally { busy = false; controls(); }
  }
  function difference() {
    if (!snapshot || physical.value.trim() === '' || !physical.validity.valid) { el('Difference').textContent = ''; controls(); return; }
    const delta = Number(physical.value) - snapshot.quantity;
    el('Difference').textContent = delta === 0 ? 'A contagem coincide com o saldo consultado.' : `Diferença a registar: ${delta > 0 ? '+' : ''}${number(delta)} ${snapshot.unit}.`;
    controls();
  }
  async function sendPending() {
    status.textContent = 'A confirmar a contagem…';
    try {
      const b = pending.body, result = await api('/api/inventory/audit-count', b);
      if (result.ok !== true || !Number.isSafeInteger(result.movement?.id) || result.movement.id <= 0 ||
          result.balance?.id !== pending.balanceId || result.movement.vehicleId !== b.vehicleId ||
          result.digitalQuantity !== b.expectedQuantity || result.physicalQuantity !== b.physicalQuantity ||
          result.desvio !== b.physicalQuantity - b.expectedQuantity || typeof result.balance.quantity !== 'number' ||
          !Number.isFinite(result.balance.quantity) || Math.abs(result.balance.quantity - b.physicalQuantity) > Number.EPSILON * 16 * Math.max(1, Math.abs(b.physicalQuantity), Math.abs(b.expectedQuantity))) {
        throw Error('Resposta incompleta. Repita a confirmação com a contagem guardada.');
      }
      const message = `Contagem confirmada: ${b.productName}, ${number(b.physicalQuantity)} ${b.unit}. Diferença registada: ${number(result.desvio)} ${b.unit}.`;
      forgetPending(); clearSnapshot();
      status.textContent = message + (result.idempotent ? ' Foi recuperada a confirmação original.' : '');
      status.dataset.tone = 'success';
      if (!vehiclesReady) await loadVehicles();
      // Refresh the existing stock/history panel without resubmitting a count.
      if (typeof window.refresh === 'function') window.refresh().catch(() => {});
    } catch (error) {
      if (closed) return;
      status.dataset.tone = 'error';
      if ([400, 403, 404, 409, 422].includes(error.status)) {
        forgetPending(); clearSnapshot();
        status.textContent = `${error.message} Consulte novamente o saldo e volte a contar antes de confirmar.`;
        if (!vehiclesReady) await loadVehicles();
      } else {
        status.textContent = 'Ainda não foi possível confirmar o resultado. A contagem foi guardada; use «Repetir confirmação», mesmo depois de reabrir a página.';
      }
    }
    showPending();
  }
  async function write(retry) {
    if (busy || closed || blocked || retry !== Boolean(pending)) return;
    if (!navigator.locks?.request) { status.textContent = 'Este navegador não permite proteger a confirmação entre janelas. Abra o inventário num navegador atualizado.'; return; }
    await run(() => navigator.locks.request(storageKey, { ifAvailable: true }, async lock => {
      if (!lock) { status.textContent = 'Existe uma confirmação em curso noutra janela. Aguarde e reabra o inventário.'; return; }
      session();
      const stored = readPending();
      if (stored && (!pending || JSON.stringify(stored) !== JSON.stringify(pending))) {
        pending = stored; status.textContent = 'Foi recuperada uma contagem pendente. Confirme o resultado antes de iniciar outra.'; showPending(); return;
      }
      if (!stored && pending) { pending = null; clearSnapshot(); status.textContent = 'A contagem foi resolvida noutra janela. Consulte novamente o saldo.'; return; }
      if (!retry) {
        if (!snapshot || !el('Form').reportValidity()) return;
        const body = { vehicleId: Number(vehicle.value), productName: snapshot.productName, unit: snapshot.unit, expectedQuantity: snapshot.quantity, physicalQuantity: Number(physical.value), requestId: crypto.randomUUID() };
        const vehicleLabel = vehicle.selectedOptions[0].textContent;
        const approved = await window.CwUi?.confirm?.(`${vehicleLabel} · ${body.productName}\nSaldo consultado: ${number(body.expectedQuantity)} ${body.unit}\nQuantidade contada: ${number(body.physicalQuantity)} ${body.unit}\nA diferença ficará no histórico.`, { title: 'Confirmar contagem física', confirmText: 'Confirmar contagem' });
        session(); if (!approved) return;
        if (readPending()) throw Error('Existe outra contagem pendente. Reabra o inventário.');
        const next = { version: 1, owner, balanceId: snapshot.id, vehicleLabel, body };
        try { localStorage.setItem(storageKey, JSON.stringify(next)); }
        catch { throw Error('Não foi possível guardar a contagem neste navegador. Nenhum pedido foi enviado.'); }
        pending = next; showPending();
      }
      await sendPending();
    }));
  }
  vehicle.onchange = () => { clearSnapshot(); status.dataset.tone = 'info'; status.textContent = 'Consulte o saldo desta viatura antes de contar.'; };
  el('Reload').onclick = () => run(async () => { vehiclesReady = false; clearSnapshot(); await loadVehicles(); status.textContent = 'Viaturas atualizadas. Selecione a viatura e consulte o saldo.'; });
  el('Load').onclick = () => run(async () => {
    const selected = Number(vehicle.value); clearSnapshot(); status.textContent = 'A consultar saldo…';
    const data = await api(`/api/inventory/stock?scope=VEHICLE&vehicleId=${selected}`);
    if (data.ok !== true || !Array.isArray(data.balances) || data.balances.some(b => !Number.isSafeInteger(b.id) || b.id <= 0 || b.scope !== 'VEHICLE' || b.vehicleId !== selected || typeof b.productName !== 'string' || typeof b.unit !== 'string' || typeof b.quantity !== 'number' || !Number.isFinite(b.quantity) || b.quantity < 0)) throw Error('Saldo recebido incompleto. Volte a consultar antes de contar.');
    const keys = data.balances.map(b => JSON.stringify([b.productName, b.unit]));
    if (new Set(keys).size !== keys.length) throw Error('Existem saldos duplicados nesta viatura. Peça a revisão do inventário antes de contar.');
    balances = data.balances; observedAt = new Date().toLocaleTimeString('pt-PT');
    product.replaceChildren(new Option('Selecionar produto e unidade', ''));
    for (const b of balances) product.add(new Option(`${b.productName} · ${number(b.quantity)} ${b.unit}`, String(b.id)));
    status.textContent = balances.length ? 'Saldo consultado. Selecione o produto e registe a quantidade contada.' : 'Esta viatura não tem produtos registados no stock.';
  });
  product.onchange = () => {
    snapshot = balances.find(b => String(b.id) === product.value) || null; physical.value = '';
    el('Snapshot').textContent = snapshot ? `Saldo consultado às ${observedAt}: ${number(snapshot.quantity)} ${snapshot.unit}.` : '';
    difference();
  };
  physical.oninput = difference;
  el('Form').onsubmit = event => { event.preventDefault(); void write(false); };
  el('Retry').onclick = () => { void write(true); };
  for (const event of ['storage', 'focus']) window.addEventListener(event, () => { try { session(); } catch {} });
  try {
    token = getToken(); owner = principal(); storageKey = `cwInventoryCount:v1:${owner}`;
    session(); pending = readPending(); showPending();
    if (pending) status.textContent = 'Contagem pendente recuperada. Use «Repetir confirmação» para confirmar o resultado.';
    else void run(async () => { await loadVehicles(); status.textContent = 'Selecione uma viatura para consultar o saldo.'; });
  } catch (error) { blocked = true; status.textContent = error.message; status.dataset.tone = 'error'; controls(); }
})();
