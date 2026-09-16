(function () {
  'use strict';
  const token = () => localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
  const credential = token(); let working = false, revision = 0, invalidated = false;
  const list = () => document.getElementById('list') || document.getElementById('rows');
  function status(message, error = false) {
    let box = document.getElementById('notificationActionStatus');
    if (!box) { box = document.createElement('p'); box.id = 'notificationActionStatus'; box.setAttribute('role', 'status'); (list()?.closest('table') || list())?.before(box); }
    box.textContent = message; box.style.color = error ? '#9b2635' : '#175c4a';
  }
  function active() {
    const same = !invalidated && !!credential && token() === credential && (!localStorage.getItem('token') || localStorage.getItem('token') === credential);
    if (!same) { invalidated = true; revision++; list()?.replaceChildren(); const count = document.getElementById('count'); if (count) count.textContent = ''; status('A sessão mudou. Volte a abrir esta página com a sua conta.', true); controls(); }
    return same;
  }
  function controls() { document.querySelectorAll('button[onclick^="markRead"],button[onclick^="markAllRead"],button[data-notification-read]').forEach(button => { button.disabled = working || invalidated; }); }
  function validIds(ids) { return Array.isArray(ids) && ids.length <= 20000 && ids.every(id => Number.isSafeInteger(id) && id > 0 && id <= 2147483647) && new Set(ids).size === ids.length; }
  async function confirm(ids, clientId) {
    if (working || !active()) return false;
    if (!validIds(ids) || (clientId !== undefined && (!Number.isSafeInteger(clientId) || clientId <= 0))) { status('A leitura não foi confirmada. Atualize a lista e tente novamente.', true); return false; }
    working = true; revision++; controls();
    try {
      const path = clientId !== undefined ? `/api/client-messages/seen/${clientId}` : ids.length === 1 ? `/api/notifications/read/${ids[0]}` : '/api/notifications/read-all';
      const response = await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }), signal: AbortSignal.timeout(15000) });
      const data = await response.json(); if (!active()) return false;
      const expected = ids.slice().sort((a,b) => a-b), receipt = data?.receipt;
      if (!response.ok || data?.ok !== true || (clientId === undefined && (receipt?.scope !== 'NOTIFICATION_READ' || receipt.isRead !== true || !validIds(receipt.ids) || JSON.stringify(receipt.ids.slice().sort((a,b) => a-b)) !== JSON.stringify(expected)))) throw Error();
      revision++; status('Leitura confirmada.'); return true;
    } catch { if (active()) status('A leitura não foi confirmada. O estado anterior foi conservado; tente novamente.', true); return false; }
    finally { working = false; controls(); }
  }
  window.CWNotificationRead = {
    one(id, clientId) { return /^chat-[1-9]\d*$/.test(String(id)) ? confirm([], Number(clientId)) : confirm([Number(id)]); },
    all(rows) { return confirm(rows.filter(row => !row.isRead && Number.isSafeInteger(row.id)).map(row => row.id)); },
    begin() { return active() ? { revision: ++revision, credential } : null; },
    accepts(read) { return read && active() && read.revision === revision; },
    headers() { return { Authorization: `Bearer ${credential}` }; },
    active, status, controls,
    validList(data) { return data?.ok === true && Array.isArray(data.notifications) && data.notifications.every(row => row && (Number.isSafeInteger(row.id) || /^chat-[1-9]\d*$/.test(String(row.id))) && typeof row.type === 'string'); }
  };
  window.addEventListener('storage', active); window.addEventListener('focus', active); setInterval(active, 1000);
})();
