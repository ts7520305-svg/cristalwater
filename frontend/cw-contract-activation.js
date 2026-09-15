'use strict';
function setupContractActivation() {
  const token = () => localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
  const authorization = token();
  let actor;
  try { actor = JSON.parse(atob(authorization.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (_) { actor = {}; }
  const owner = `ADMIN:${actor.id}`, key = `cwContractActivation:v1:${owner}`;
  const same = () => token() === authorization && actor.role === 'ADMIN' && Number.isSafeInteger(actor.id) && actor.id > 0;
  const panel = document.getElementById('contractActivationPending'), summary = document.getElementById('contractActivationSummary');
  const retry = document.getElementById('contractActivationRetry');
  const review = document.getElementById('contractActivationReview');
  let working = false, blocked = false, pending = null;
  function read() {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      const row = JSON.parse(raw);
      if (row?.schema !== 1 || row.owner !== owner || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.requestId) ||
        !Number.isSafeInteger(row.clientId) || row.clientId <= 0 || !Number.isSafeInteger(row.amountCents) || row.amountCents < 0 ||
        typeof row.name !== 'string' || row.name.length > 1000 || !/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(row.month) ||
        (row.rejection !== undefined && (typeof row.rejection !== 'string' || row.rejection.length > 2000))) throw Error();
      return row;
    } catch (_) { blocked = true; throw Error('Não foi possível ler a ativação guardada. O registo foi conservado para revisão.'); }
  }
  function render() {
    const current = same();
    panel.hidden = !current || (!pending && !blocked);
    summary.textContent = blocked ? 'A ativação guardada precisa de revisão. Nenhum novo pedido será enviado.' : pending ?
      `${pending.rejection || 'Ativação por confirmar'}: ${pending.name} · ${(pending.amountCents / 100).toFixed(2)} EUR · ${pending.month}. Reveja o pedido guardado antes de iniciar outra ativação.` : '';
    retry.hidden = blocked || !pending || !!pending.rejection; retry.disabled = working || !current || !!pending?.rejection;
    review.hidden = blocked || !pending?.rejection; review.disabled = working || !current;
    document.querySelectorAll('[data-activate-client], [id^="activationAmount-"]').forEach(element => { element.disabled = working || blocked || !!pending || !current; });
  }
  function valid(data, record) {
    const r = data?.requestReceipt;
    return data?.ok === true && data.client?.id === record.clientId && data.client.contractActive === true && r?.version === 1 &&
      r.scope === 'CONTRACT_ACTIVATION' && r.actorId === actor.id && r.actorRole === 'ADMIN' && r.clientId === record.clientId &&
      r.requestId === record.requestId && r.month === record.month && r.amountCents === record.amountCents && r.method === 'MANUAL' && r.notes === '' &&
      Number.isSafeInteger(r.appliedCents) && r.appliedCents >= 0 && Number.isSafeInteger(r.creditCents) && r.creditCents >= 0 &&
      r.appliedCents + r.creditCents === record.amountCents && Number.isFinite(data.appliedAmount) && Number.isFinite(data.creditAdded) &&
      Math.round(data.appliedAmount * 100) === r.appliedCents && Math.round(data.creditAdded * 100) === r.creditCents &&
      Number.isFinite(data.creditBalance) && data.creditBalance >= 0;
  }
  async function submit(id = null, discard = false) {
    if (working || blocked || !same()) return;
    if (!navigator.locks?.request || !crypto.randomUUID) { setFeedback('Use um navegador atualizado e uma ligação segura para ativar contratos.', 'error'); return; }
    const fresh = id !== null;
    const amount = fresh ? (document.getElementById(`activationAmount-${id}`)?.value || '').trim().replace(',', '.') : '';
    const client = fresh ? CLIENTS.find(row => row.id === id) : null;
    working = true; render();
    try {
      await navigator.locks.request(key, { ifAvailable: true }, async lock => {
        if (!lock || !same()) return;
        pending = read();
        if (discard) {
          if (!pending?.rejection) return;
          const response = await fetch('/api/core/clients?includeInactive=1', { headers: { Authorization: `Bearer ${authorization}` }, signal: AbortSignal.timeout(20000) });
          const data = await response.json();
          if (!same()) return;
          if (!response.ok || !Array.isArray(data.clients)) throw Error('Não foi possível atualizar os clientes.');
          if (JSON.stringify(read()) !== JSON.stringify(pending)) throw Error('O pedido mudou noutra janela.');
          localStorage.removeItem(key); pending = null;
          CLIENTS = data.clients; renderList(); setFeedback('Pedido recusado retirado. Reveja os dados antes de outra ativação.'); return;
        }
        if (pending && fresh) { setFeedback('Existe uma ativação por confirmar. Use o pedido guardado.', 'warning'); return; }
        if (pending?.rejection) return;
        if (!pending) {
          if (!fresh) { await loadClients(); setFeedback('O pedido já foi confirmado noutra janela.'); return; }
          if (!client || (amount !== '' && !/^\d+(\.\d{1,2})?$/.test(amount)) || !Number.isSafeInteger(Math.round(Number(amount) * 100))) throw Error('Indique um valor válido, com até dois decimais.');
          const response = await fetch('/api/core/clients?includeInactive=1', { headers: { Authorization: `Bearer ${authorization}` }, signal: AbortSignal.timeout(20000) });
          const data = await response.json();
          if (!same()) return;
          if (!response.ok || data.ok === false || !Array.isArray(data.clients)) throw Error('Não foi possível confirmar os dados atuais do cliente.');
          const current = data.clients.find(row => row.id === id);
          if (!current || current.name !== client.name || current.active === false || current.deletedAt || current.contractActive) throw Error('O contrato mudou. Atualize a lista antes de continuar.');
          const record = { schema: 1, owner, requestId: crypto.randomUUID(), clientId: id, name: String(current.name).slice(0, 1000), month: new Date().toISOString().slice(0, 7), amountCents: Math.round(Number(amount) * 100) };
          localStorage.setItem(key, JSON.stringify(record));
          pending = read();
          if (JSON.stringify(pending) !== JSON.stringify(record)) throw Error('Não foi possível guardar o pedido. Nenhuma ativação foi enviada.');
        }
        const record = pending; render();
        const response = await fetch(`/api/core/clients/${record.clientId}/activate`, {
          method: 'POST', headers: { Authorization: `Bearer ${authorization}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
          body: JSON.stringify({ requestId: record.requestId, monthRef: record.month, amount: record.amountCents / 100, method: 'MANUAL', notes: '' }),
        });
        const data = await response.json().catch(() => null);
        if (!same()) return;
        if ([400, 404, 409].includes(response.status) && data?.ok === false && typeof data.error === 'string') {
          pending = { ...record, rejection: data.error.slice(0, 2000) }; localStorage.setItem(key, JSON.stringify(pending));
          setFeedback('A ativação foi recusada. Use Rever pedido recusado para atualizar os dados.', 'error'); return;
        }
        if (!response.ok || !valid(data, record)) throw Error('Ainda não foi possível confirmar a ativação. O pedido permanece guardado; use Confirmar ativação guardada.');
        if (JSON.stringify(read()) !== JSON.stringify(record)) throw Error('O pedido guardado mudou. Atualize a página.');
        localStorage.removeItem(key);
        if (localStorage.getItem(key) !== null) throw Error('Não foi possível concluir a confirmação neste navegador.');
        pending = null;
        await loadClients();
        if (same()) setFeedback(`Contrato ativado. Recebimento confirmado: ${(record.amountCents / 100).toFixed(2)} EUR.`, 'success');
      });
    } catch (error) { if (same()) setFeedback(error.message, 'error'); }
    finally { working = false; render(); }
  }
  function sync() { if (!working && same()) { try { pending = read(); } catch (error) { setFeedback(error.message, 'error'); } } render(); }
  retry.onclick = () => submit();
  review.onclick = () => submit(null, true);
  window.addEventListener('storage', sync); window.addEventListener('focus', sync);
  document.addEventListener('visibilitychange', sync);
  setInterval(() => { if (!same()) render(); }, 1000);
  sync();
  return { submit, render, busy: () => working };
}
