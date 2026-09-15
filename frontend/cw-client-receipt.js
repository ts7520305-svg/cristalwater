'use strict';
// One immutable, account-bound receipt at a time, shared by this account's tabs.
function setupClientReceipt() {
  let owner, actorId, key, pending = null, blocked = false, working = false, issue = '', form = null, returnFocus = null;
  const panel = document.getElementById('clientReceiptPending'), summary = document.getElementById('clientReceiptSummary');
  const retry = document.getElementById('clientReceiptRetry'), review = document.getElementById('clientReceiptReview');
  const modal = document.getElementById('clientReceiptModal');
  const positive = value => Number.isSafeInteger(value) && value > 0;
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
  const methodNames = { TRANSFER: 'Transferência', MBWAY: 'MB Way', CASH: 'Dinheiro', CARD: 'Cartão', MANUAL: 'Outro' };
  const methods = Object.keys(methodNames);
  const sameSession = () => authHeaders().Authorization === collectionAuthorization;
  const version = client => JSON.stringify([client.id, client.name, client.paymentReference, client.totalDue, client.creditBalance, client.lastPaymentAt, client.openInvoicesCount]);
  function read() {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      const record = JSON.parse(raw);
      if (record?.schema !== 1 || record.owner !== owner || !uuid(record.requestId) || !positive(record.clientId) || !positive(record.amountCents) ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(record.month) || !methods.includes(record.method) || typeof record.notes !== 'string' || record.notes.length > 2000 || record.notes !== record.notes.trim() ||
        typeof record.details !== 'string' || record.details.length > 2000 ||
        (record.rejection && (![400, 404, 409].includes(record.rejection.status) || typeof record.rejection.message !== 'string'))) throw Error();
      return record;
    } catch (_) {
      blocked = true; issue = 'O recebimento guardado não pode ser lido. Foi conservado para revisão; nenhum novo pedido será enviado.';
      throw Error(issue);
    }
  }
  function close(force = false) {
    if (working && !force) return;
    modal.hidden = true; form = null;
    if (sameSession() && returnFocus?.isConnected) returnFocus.focus();
  }
  function render() {
    const same = sameSession(), disabled = !same || working || blocked || Boolean(pending) || !collectionFresh;
    panel.hidden = !same || (!pending && !blocked);
    if (same && pending) summary.textContent = `${pending.rejection ? pending.rejection.message : 'Recebimento por confirmar'}\n${pending.details}\n${(pending.amountCents / 100).toFixed(2)} EUR · ${methodNames[pending.method]} · ${pending.month}${pending.notes ? '\n' + pending.notes : ''}`;
    if (same && blocked) summary.textContent = issue;
    retry.hidden = blocked || !pending; retry.disabled = working || Boolean(pending?.rejection);
    review.hidden = !pending?.rejection || blocked; review.disabled = working;
    document.querySelectorAll('[data-client-receipt]').forEach(button => { button.disabled = disabled; });
    for (const id of ['receiptAmount', 'receiptMethod', 'receiptNotes', 'receiptConfirm']) document.getElementById(id).disabled = disabled;
    document.getElementById('receiptCancel').disabled = working;
    if (!same) close(true);
  }
  function open(clientId) {
    if (!collectionSessionCurrent() || !collectionFresh || blocked || working) return;
    try { pending = read(); } catch (_) { render(); return; }
    if (pending) { render(); panel.scrollIntoView({ block: 'center' }); return; }
    const client = currentClients.find(row => row.id === clientId);
    if (!client || client.totalDue <= 0) return;
    form = { clientId, month: selectedCollectionMonth(), version: version(client) };
    returnFocus = document.activeElement;
    document.getElementById('receiptClient').textContent = `${client.name} · ${client.paymentReference}`;
    document.getElementById('receiptBalance').textContent = `Dívida em faturas: ${formatMoney(client.totalDue)}. Crédito disponível: ${formatMoney(client.creditBalance)}. Mês do recebimento: ${form.month}.`;
    document.getElementById('receiptAmount').value = client.totalDue.toFixed(2);
    document.getElementById('receiptMethod').value = 'TRANSFER'; document.getElementById('receiptNotes').value = '';
    modal.hidden = false; render(); document.getElementById('receiptAmount').focus();
  }
  function forget(record) {
    if (JSON.stringify(read()) !== JSON.stringify(record)) throw Error('O recebimento mudou noutra janela. Atualize a página.');
    localStorage.removeItem(key);
    if (localStorage.getItem(key) !== null) throw Error('A confirmação não pôde ser concluída neste navegador.');
    pending = null;
  }
  function validReceipt(data, record) {
    const receipt = data?.requestReceipt;
    if (data?.ok !== true || data.clientId !== record.clientId || data.month !== record.month || receipt?.scope !== 'CLIENT' || receipt.version !== 1 ||
      receipt.requestId !== record.requestId || receipt.clientId !== record.clientId || receipt.month !== record.month || receipt.actorId !== actorId || receipt.actorRole !== 'ADMIN' ||
      receipt.amountCents !== record.amountCents || receipt.method !== record.method || receipt.notes !== record.notes ||
      !Number.isSafeInteger(receipt.appliedCents) || receipt.appliedCents < 0 || !Number.isSafeInteger(receipt.creditCents) || receipt.creditCents < 0 ||
      receipt.appliedCents + receipt.creditCents !== record.amountCents || !Number.isFinite(data.appliedAmount) || !Number.isFinite(data.creditAdded) ||
      Math.round(data.appliedAmount * 100) !== receipt.appliedCents || Math.round(data.creditAdded * 100) !== receipt.creditCents ||
      !Number.isFinite(data.remainingOpen) || data.remainingOpen < 0 || !Number.isFinite(data.creditBalance) || data.creditBalance < 0 ||
      (receipt.creditCents > 0 ? !positive(data.creditPaymentId) : data.creditPaymentId !== null) ||
      !Array.isArray(data.allocations) || !Array.isArray(data.payments) || !Array.isArray(data.invoices) ||
      data.allocations.length !== data.payments.length || data.allocations.length !== data.invoices.length) return false;
    const seen = new Set(); let allocated = 0;
    for (const row of data.allocations) {
      if (!positive(row.invoiceId) || !positive(row.paymentId) || !positive(row.amountCents) || seen.has(row.invoiceId)) return false;
      seen.add(row.invoiceId); allocated += row.amountCents;
      const payment = data.payments.find(item => item.id === row.paymentId), invoice = data.invoices.find(item => item.id === row.invoiceId);
      if (!invoice || invoice.clientId !== record.clientId || !payment || payment.invoiceId !== row.invoiceId || payment.amountCents !== row.amountCents || Math.round(payment.amount * 100) !== row.amountCents) return false;
    }
    return allocated === receipt.appliedCents;
  }
  async function submit(fresh = false, discard = false) {
    if (blocked || working || !collectionSessionCurrent()) return;
    if (!navigator.locks?.request || !crypto.randomUUID) { collectionStatus('Abra esta página num navegador atualizado para proteger recebimentos entre janelas.', true); return; }
    const captured = fresh && form ? { ...form, amount: document.getElementById('receiptAmount').value.trim().replace(',', '.'),
      method: document.getElementById('receiptMethod').value, notes: document.getElementById('receiptNotes').value.trim() } : null;
    if (fresh && (!captured || !collectionFresh)) return;
    working = true; render();
    try {
      await navigator.locks.request(key, { ifAvailable: true }, async lock => {
        if (!collectionSessionCurrent()) return;
        if (!lock) { collectionStatus('Existe um recebimento em curso noutra janela. Aguarde e atualize a lista.', true); return; }
        pending = read();
        if (discard) {
          if (pending?.rejection && await loadCollection() && collectionSessionCurrent()) {
            forget(pending); close(true); collectionStatus('Reveja a dívida atualizada antes de registar outro recebimento.');
          }
          return;
        }
        if (pending && (fresh || pending.rejection)) { close(true); collectionStatus('Reveja o recebimento guardado antes de preparar outro.', true); return; }
        if (!pending) {
          if (!fresh) { await loadCollection(); collectionStatus('O pedido já foi confirmado noutra janela. Consulte o saldo atualizado.'); return; }
          if (!/^\d+(\.\d{1,2})?$/.test(captured.amount) || !positive(Math.round(Number(captured.amount) * 100))) throw Error('Indica um valor positivo, com até dois decimais.');
          if (!methods.includes(captured.method) || captured.notes.length > 2000) throw Error('Método ou nota inválidos.');
          if (captured.month !== selectedCollectionMonth()) { close(true); throw Error('O mês mudou. Abra novamente o recebimento.'); }
          if (!await loadCollection() || !collectionSessionCurrent()) return;
          const client = currentClients.find(row => row.id === captured.clientId);
          if (captured.month !== selectedCollectionMonth() || !client || client.totalDue <= 0 || version(client) !== captured.version) {
            close(true); collectionStatus('O cliente ou saldo mudou. Reveja a lista e confirme novamente.', true); return;
          }
          const record = { schema: 1, owner, requestId: crypto.randomUUID(), clientId: client.id, month: captured.month,
            amountCents: Math.round(Number(captured.amount) * 100), method: captured.method, notes: captured.notes,
            details: `${String(client.name).slice(0, 1800)} · ${client.paymentReference}` };
          try { localStorage.setItem(key, JSON.stringify(record)); }
          catch (_) { throw Error('Não foi possível guardar o recebimento neste navegador. Nenhum pedido foi enviado.'); }
          pending = read();
          if (JSON.stringify(pending) !== JSON.stringify(record)) throw Error('Não foi possível verificar o pedido guardado. Nenhum pedido foi enviado.');
        }
        const record = pending; close(true); render(); collectionStatus('A confirmar recebimento...');
        try {
          const response = await fetch(`/api/admin/payments/${record.clientId}/manual-received?month=${encodeURIComponent(record.month)}`, {
            method: 'POST', headers: { Authorization: collectionAuthorization, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
            body: JSON.stringify({ requestId: record.requestId, amount: (record.amountCents / 100).toFixed(2), method: record.method, notes: record.notes }),
          });
          const data = await response.json().catch(() => null);
          if (!collectionSessionCurrent()) return;
          if (!response.ok) {
            if ([400, 404, 409].includes(response.status) && data?.ok === false && typeof data.error === 'string') {
              pending = { ...record, rejection: { status: response.status, message: data.error } };
              localStorage.setItem(key, JSON.stringify(pending)); collectionStatus(`${data.error} Use Rever recebimento.`, true); return;
            }
            throw Error('Confirmação indisponível.');
          }
          if (!validReceipt(data, record)) throw Error('Confirmação inválida.');
          forget(record); const refreshed = await loadCollection();
          if (!collectionSessionCurrent()) return;
          collectionStatus(`Recebimento confirmado. Aplicado: ${formatMoney(data.appliedAmount)}.${data.creditAdded ? ` Crédito criado: ${formatMoney(data.creditAdded)}.` : ''}${refreshed ? '' : ' Não foi possível atualizar o saldo. Atualize a lista antes de outro recebimento.'}`, !refreshed);
        } catch (_) {
          if (collectionSessionCurrent()) collectionStatus('Ainda não foi possível confirmar o recebimento. O pedido foi guardado; use Confirmar recebimento guardado, mesmo depois de reabrir a página. O saldo apresentado é da última consulta.', true);
        }
      });
    } catch (error) { if (collectionSessionCurrent()) collectionStatus(error.message, true); }
    finally { working = false; render(); }
  }
  retry.onclick = () => submit(); review.onclick = () => submit(false, true);
  document.getElementById('clientReceiptForm').onsubmit = event => { event.preventDefault(); submit(true); };
  document.getElementById('receiptCancel').onclick = () => close();
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const nodes = [...modal.querySelectorAll('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled)')];
      if (!nodes.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); }
    }
  });
  try {
    const payload = JSON.parse(atob(collectionAuthorization.split(' ')[1].split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    actorId = Number(payload.id);
    if (payload.role !== 'ADMIN' || !positive(actorId)) throw Error('Sessão administrativa por confirmar.');
    owner = `ADMIN:${actorId}`; key = `cwClientReceipt:v1:${owner}`; pending = read();
  } catch (error) { blocked = true; issue = error.message; }
  window.addEventListener('storage', event => {
    if (!collectionSessionCurrent()) return;
    if ((event.key === key || event.key === null) && !working) {
      try { pending = read(); if (pending) close(true); } catch (_) {}
      render();
    }
  });
  render();
  return { open, close, submit, render, busy: () => working };
}
