'use strict';
const $ = id => document.getElementById(id);
const money = n => Number(n).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const cents = n => Math.round(Number(n) * 100);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const token = () => localStorage.getItem('token') || localStorage.getItem('cristalwater_jwt') || '';
let authorization = '', owner = '', storageKey = '', clients = [], fresh = false, busy = false, readSerial = 0, target = null;
function status(message) { $('status').textContent = message; $('creditMessage').textContent = message; }
function session() {
  if (authorization && token() === authorization) return true;
  fresh = false; clients = []; target = null;
  $('creditModal').close(); $('billingList').replaceChildren(); $('creditClient').replaceChildren(); $('creditPending').hidden = true;
  for (const id of ['totalClients', 'totalPools', 'totalAmount', 'totalPaid', 'totalOpen', 'paidPercent']) $(id).textContent = '—';
  $('creditOpen').disabled = true; status('A sessão mudou. Recarregue o ecrã para continuar.'); return false;
}
function pending() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  let p; try { p = JSON.parse(raw); } catch { throw Error('O crédito guardado está ilegível. Não foi apagado; peça revisão antes de continuar.'); }
  if (p.version !== 1 || p.owner !== owner || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.requestId) ||
      !Number.isSafeInteger(p.clientId) || p.clientId <= 0 || !Number.isSafeInteger(p.amountCents) || p.amountCents <= 0 ||
      !Number.isSafeInteger(p.expectedCreditCents) || p.expectedCreditCents < 0 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month) ||
      typeof p.notes !== 'string' || !p.notes.trim() || p.notes.length > 2000 || typeof p.name !== 'string' ||
      (p.rejected !== undefined && ![400, 404, 409].includes(p.rejected))) throw Error('Crédito guardado inválido. Foi preservado para revisão.');
  return p;
}
function samePending(p) {
  const saved = pending();
  return saved && ['version', 'owner', 'requestId', 'clientId', 'amountCents', 'expectedCreditCents', 'month', 'notes', 'name'].every(key => saved[key] === p[key]);
}
function controls() {
  if (!session()) return;
  try {
    const p = pending();
    $('creditOpen').disabled = busy || !fresh || !!p || !navigator.locks || !crypto.randomUUID;
    $('creditConfirm').disabled = busy || !fresh || !!p;
    $('creditCancel').disabled = busy;
    $('creditPending').hidden = !p;
    if (p) {
      $('creditPendingSummary').textContent = `${p.name} · ${money(p.amountCents / 100)} de crédito interno · ${p.month}. ${p.rejected ? 'Pedido rejeitado: reveja o saldo.' : 'Confirmação pendente; não crie outro ajuste.'}`;
      $('creditRetry').disabled = busy || !!p.rejected;
      $('creditReview').hidden = !p.rejected; $('creditReview').disabled = busy;
    }
  } catch (error) {
    $('creditOpen').disabled = true; $('creditConfirm').disabled = true; $('creditPending').hidden = true; status(error.message);
  }
}
async function loadBilling() {
  if (!session()) return false;
  const serial = ++readSerial, month = $('monthRef').value;
  fresh = false; controls(); status('A atualizar os saldos…');
  try {
    const r = await fetch(`/api/billing/monthly?monthRef=${encodeURIComponent(month)}`, { headers: { Authorization: `Bearer ${authorization}` }, cache: 'no-store', signal: AbortSignal.timeout(20000) });
    const data = await r.json();
    if (!session() || serial !== readSerial || month !== $('monthRef').value) return false;
    if (!r.ok || data.ok !== true || data.monthRef !== month || !Array.isArray(data.clients) || !Array.isArray(data.items) || !data.totals ||
        !data.clients.every(c => Number.isSafeInteger(c.id) && c.id > 0 && typeof c.name === 'string' && Number.isFinite(c.creditBalance)) ||
        !data.items.every(i => Number.isSafeInteger(i.invoiceId) && i.invoiceId > 0 && Number.isSafeInteger(i.clientId) && i.clientId > 0 && typeof i.clientName === 'string' && Array.isArray(i.lines) && i.lines.every(l => l && Number.isFinite(l.total)) && ['total', 'amountPaid', 'amountOpen', 'creditBalance'].every(k => Number.isFinite(i[k]))) ||
        !['totalClients', 'totalPools', 'totalAmount', 'totalPaid', 'totalOpen'].every(k => Number.isFinite(data.totals[k]))) throw Error('Não foi possível atualizar. Os valores anteriores não estão confirmados.');
    clients = data.clients;
    const selected = $('creditClient').value;
    $('creditClient').replaceChildren(...clients.map(c => new Option(c.name, String(c.id))));
    if (clients.some(c => String(c.id) === selected)) $('creditClient').value = selected;
    for (const id of ['totalClients', 'totalPools']) $(id).textContent = data.totals[id];
    for (const id of ['totalAmount', 'totalPaid', 'totalOpen']) $(id).textContent = money(data.totals[id]);
    $('paidPercent').textContent = (data.totals.totalAmount ? Math.round(data.totals.totalPaid / data.totals.totalAmount * 100) : 0) + '%';
    $('billingList').innerHTML = data.items.map(i => `<article class="card" data-invoice-id="${i.invoiceId}">
      <h3>${escapeHtml(i.clientName)}</h3><p>${escapeHtml(i.status)} · Crédito disponível: ${money(i.creditBalance)}</p>
      <p>Faturado: ${money(i.total)} · Aplicado: ${money(i.amountPaid)} · Em aberto: ${money(i.amountOpen)}</p>
      <a href="/invoices?clientId=${i.clientId}">Consultar faturas e registar pagamento</a>
      <details><summary>Ver linhas</summary><table><thead><tr><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${i.lines.map(l => `<tr><td>${escapeHtml(l.type)}</td><td>${escapeHtml(l.description)}</td><td>${money(l.total)}</td></tr>`).join('')}</tbody></table></details></article>`).join('') || '<p>Sem faturas a receber neste mês.</p>';
    fresh = true; status('Saldos atualizados. Crédito interno não é dinheiro recebido.'); controls(); return true;
  } catch (error) {
    if (session() && serial === readSerial) { fresh = false; status(error.message); controls(); }
    return false;
  }
}
function openCredit() {
  try {
    if (!session() || busy || !fresh || pending()) return;
    const c = clients.find(row => row.id === Number($('creditClient').value));
    if (!c || cents(c.creditBalance) < 0) throw Error('Consulte um cliente com saldo válido.');
    target = { clientId: c.id, name: c.name, expectedCreditCents: cents(c.creditBalance), month: $('monthRef').value };
    $('creditTarget').textContent = c.name; $('creditBalance').textContent = money(c.creditBalance);
    $('creditForm').reset(); $('creditMessage').textContent = ''; $('creditModal').showModal(); $('creditAmount').focus();
  } catch (error) { status(error.message); }
}
async function locked(work) {
  if (busy || !session()) return;
  busy = true; controls();
  try {
    if (!navigator.locks || !crypto.randomUUID) throw Error('Este navegador não permite guardar ajustes com segurança. Use um navegador atualizado.');
    await navigator.locks.request(storageKey, { ifAvailable: true }, async lock => {
      if (!lock) throw Error('Existe um ajuste em curso noutra janela. Aguarde e confirme o pedido guardado.');
      if (session()) await work();
    });
  } catch (error) { if (session()) status(error.message); }
  finally { busy = false; controls(); }
}
function save(p) {
  const raw = JSON.stringify(p); localStorage.setItem(storageKey, raw);
  if (localStorage.getItem(storageKey) !== raw) throw Error('Não foi possível guardar o ajuste. Não foi enviado.');
}
function matchesReceipt(data, p) {
  const r = data?.requestReceipt;
  return data?.ok === true && data.kind === 'NON_CASH_ADJUSTMENT' && Number.isSafeInteger(data.adjustmentId) && data.adjustmentId > 0 &&
    data.clientId === p.clientId && data.client?.id === p.clientId && data.month === p.month && r?.version === 1 && r.scope === 'CREDIT_ADJUSTMENT' &&
    r.requestId === p.requestId && r.clientId === p.clientId && r.actorId === Number(owner.split(':')[1]) && r.actorRole === 'ADMIN' &&
    r.amountCents === p.amountCents && r.expectedCreditCents === p.expectedCreditCents && r.notes === p.notes && r.month === p.month &&
    r.method === 'ADJUSTMENT' && r.appliedCents === 0 && r.creditCents === p.amountCents &&
    data.beforeCreditCents === p.expectedCreditCents && data.afterCreditCents === p.expectedCreditCents + p.amountCents &&
    cents(data.creditAdded) === p.amountCents && cents(data.creditBalance) === data.afterCreditCents && cents(data.client.creditBalance) === data.afterCreditCents;
}
async function send(p) {
  if (!session() || !samePending(p)) throw Error('O pedido guardado mudou. Recarregue o ecrã.');
  $('creditModal').close(); target = null; controls();
  status('A confirmar crédito interno…');
  const r = await fetch(`/api/billing/client/${p.clientId}/credit`, { method: 'POST', headers: { Authorization: `Bearer ${authorization}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20000), body: JSON.stringify({ requestId: p.requestId, month: p.month, amount: (p.amountCents / 100).toFixed(2), notes: p.notes, expectedCreditCents: p.expectedCreditCents }) });
  const data = await r.json();
  if (!session()) return;
  if (!r.ok) {
    if ([400, 404, 409].includes(r.status) && data.ok === false && typeof data.error === 'string' && samePending(p)) save({ ...p, rejected: r.status });
    throw Error(data.error || 'Confirmação pendente. Volte a confirmar o pedido guardado.');
  }
  if (!matchesReceipt(data, p)) throw Error('Resposta não corresponde ao ajuste guardado. O pedido foi preservado para confirmação.');
  if (!samePending(p)) throw Error('O pedido guardado mudou. Reveja antes de continuar.');
  localStorage.removeItem(storageKey);
  if (await loadBilling()) status('Crédito interno confirmado uma única vez. Não foi registado dinheiro recebido.');
}
async function submitCredit(event) {
  event.preventDefault();
  const draft = target && { ...target }, value = $('creditAmount').value.trim().replace(',', '.'), notes = $('creditReason').value.trim();
  await locked(async () => {
    if (pending()) throw Error('Confirme primeiro o ajuste guardado.');
    if (!draft || !/^\d+(\.\d{1,2})?$/.test(value) || !Number.isSafeInteger(cents(value)) || cents(value) <= 0 || !notes || notes.length > 2000) throw Error('Indique um valor positivo com até dois decimais e o motivo.');
    if (!await loadBilling()) throw Error('Atualize os saldos antes de confirmar.');
    const c = clients.find(row => row.id === draft.clientId);
    if (!session() || !c || draft.month !== $('monthRef').value || c.name !== draft.name || cents(c.creditBalance) !== draft.expectedCreditCents) {
      $('creditModal').close(); target = null; throw Error('Os dados ou o saldo mudaram. Abra novamente o ajuste para rever.');
    }
    if (pending()) throw Error('Existe um ajuste guardado noutra janela.');
    const p = { version: 1, owner, requestId: crypto.randomUUID(), ...draft, amountCents: cents(value), notes };
    save(p); await send(p);
  });
}
window.addEventListener('DOMContentLoaded', () => {
  const topbar = document.querySelector('.cw-v2-shell-topbar');
  if (topbar && window.ResizeObserver) new ResizeObserver(() => document.body.style.setProperty('--billing-header-height', `${topbar.getBoundingClientRect().height}px`)).observe(topbar);
  try {
    authorization = token();
    const user = JSON.parse(atob(authorization.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (user.role !== 'ADMIN' || !Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) throw Error('Sessão de administrador necessária.');
    owner = `ADMIN:${Number(user.id)}`; storageKey = `cwCreditAdjustment:v1:${owner}`;
    $('monthRef').value = new Date().toISOString().slice(0, 7);
    $('creditOpen').addEventListener('click', openCredit); $('creditForm').addEventListener('submit', submitCredit);
    $('creditCancel').addEventListener('click', () => { if (!busy) { target = null; $('creditModal').close(); } });
    $('creditModal').addEventListener('cancel', e => { if (busy) e.preventDefault(); else target = null; });
    $('creditRetry').addEventListener('click', () => locked(async () => { const p = pending(); if (p && !p.rejected) await send(p); }));
    $('creditReview').addEventListener('click', () => locked(async () => {
      const p = pending(); if (!p?.rejected || !await loadBilling() || !session()) return;
      if (!samePending(p)) throw Error('O pedido mudou. Recarregue o ecrã.');
      localStorage.removeItem(storageKey); status('Pedido rejeitado encerrado. Consulte o saldo e abra um novo ajuste, se necessário.');
    }));
    $('monthRef').addEventListener('change', () => { target = null; $('creditModal').close(); loadBilling(); });
    window.addEventListener('storage', event => {
      if (!session()) return;
      if (event.key === storageKey || event.key === null) { target = null; $('creditModal').close(); fresh = false; controls(); loadBilling(); }
    });
    loadBilling();
  } catch (error) { status(error.message); $('creditOpen').disabled = true; }
});
