'use strict';
const rows = document.getElementById('rows');
async function loadNotifications() {
  const read = CWNotificationRead.begin(); if (!read) return false;
  try {
    const response = await fetch('/api/notifications', { headers: CWNotificationRead.headers(), cache: 'no-store' });
    const data = await response.json(); if (!CWNotificationRead.accepts(read)) return false;
    if (!response.ok || !CWNotificationRead.validList(data)) throw Error();
    const fragment = document.createDocumentFragment();
    if (!data.notifications.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 5; td.textContent = 'Sem notificações.'; tr.append(td); fragment.append(tr); }
    for (const notification of data.notifications) {
      const tr = document.createElement('tr'); tr.dataset.notificationId = notification.id;
      const date = new Date(notification.createdAt);
      for (const value of [Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Sem data', notification.title || '', notification.message || '', notification.isRead ? 'Lida' : 'Por ler']) {
        const cell = document.createElement('td'); cell.textContent = value; tr.append(cell);
      }
      const actions = document.createElement('td');
      if (!notification.isRead) { const button = document.createElement('button'); button.type = 'button'; button.dataset.notificationRead = notification.id; button.textContent = 'Marcar como lida'; button.addEventListener('click', () => void markRead(notification.id)); actions.append(button); }
      tr.append(actions); fragment.append(tr);
    }
    rows.replaceChildren(fragment); CWNotificationRead.controls(); return true;
  } catch { if (CWNotificationRead.accepts(read)) CWNotificationRead.status('Não foi possível atualizar as notificações. A última lista foi conservada.', true); return false; }
}
async function markRead(id) { if (await CWNotificationRead.one(id)) await loadNotifications(); }
loadNotifications();
