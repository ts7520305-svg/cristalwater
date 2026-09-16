(function () {
  'use strict';
  const $ = id => document.getElementById(id), auth = window.CristalAuth;
  let language = '', pending = null, blocked = false, working = false, invalidated = false, rows = [], notices = [], draftProblem = false;
  let readRevision = 0, noticeRevision = 0, hadCriticalNotice = false;
  const states = {}, controllers = new Set();
  function lang() { return document.documentElement.lang || window.CristalI18n?.readLanguage() || 'pt'; }
  function text(key) { const index = Math.max(0, ['pt', 'en', 'fr', 'es', 'de'].indexOf(lang())); return window.CWStaffChatText[key]?.[index] || key; }
  function status(id, key, tone = '') { states[id] = { key, tone }; $(id).textContent = key ? text(key) : ''; $(id).dataset.tone = tone; }
  function token() { return auth?.getToken() || ''; }
  function decode(value) { try { return JSON.parse(decodeURIComponent(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')).split('').map(char => '%' + char.charCodeAt(0).toString(16).padStart(2, '0')).join(''))); } catch { return {}; } }
  if (!auth?.requireAuth()) return;
  const credential = token(), actor = decode(credential), role = String(actor.role || '').toUpperCase();
  const actorType = actor.principalType === 'ENV_ADMIN' ? 'ENV_ADMIN' : actor.principalType === 'USER' || role === 'ADMIN' ? 'USER' : 'TECHNICIAN';
  const actorId = Number(actorType === 'TECHNICIAN' ? actor.technicianId || actor.id : actor.userId || actor.id);
  if (!['ADMIN', 'TECHNICIAN', 'TEAM_LEADER'].includes(role) || !Number.isSafeInteger(actorId) || actorId < 1) { $('sessionStatus').hidden = false; $('sessionStatus').textContent = text('noAccess'); return; }
  const owner = `${actorType}:${actorType === 'ENV_ADMIN' ? String(actor.email || '').toLowerCase() : actorId}`;
  const key = `cwStaffChat:v1:${owner}`, draftKey = `cwStaffChatDraft:v1:${owner}`;
  function same() { return !invalidated && token() === credential && (!localStorage.getItem('token') || localStorage.getItem('token') === credential); }
  function expire() {
    if (same()) return false;
    invalidated = true; readRevision++; noticeRevision++; controllers.forEach(controller => controller.abort());
    rows = []; notices = []; $('messageList').replaceChildren(); $('noticeList').replaceChildren(); $('chatText').value = ''; $('chatPendingText').textContent = '';
    $('staffChat').hidden = true; $('sessionStatus').hidden = false; $('sessionStatus').textContent = text('session'); return true;
  }
  function readPending() {
    try {
      const raw = localStorage.getItem(key); if (raw === null) return null;
      const value = JSON.parse(raw);
      if (value?.schema !== 1 || value.owner !== owner || typeof value.text !== 'string' || !value.text.trim() || value.text !== value.text.trim() || value.text.length > 4000 ||
        typeof value.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.requestId)) throw Error();
      return value;
    } catch { blocked = true; throw Error('storageError'); }
  }
  function renderControls() {
    if (expire()) return;
    $('chatPending').hidden = !pending && !blocked;
    $('chatPendingText').textContent = blocked ? text('storageError') : pending?.text || '';
    $('chatRetry').hidden = blocked || !pending;
    $('chatRetry').disabled = working || blocked;
    $('chatText').disabled = working || blocked || !!pending;
    $('chatSend').disabled = working || blocked || !!pending;
    $('chatForm').setAttribute('aria-busy', String(working));
    $('connectionStatus').textContent = text(navigator.onLine ? 'online' : 'offline');
    $('draftStatus').textContent = draftProblem ? text('draftError') : $('chatText').value ? text('savedDraft') : '';
  }
  function node(tag, content, className) { const element = document.createElement(tag); element.textContent = content; if (className) element.className = className; return element; }
  function when(value) { const date = new Date(value); return typeof value === 'string' && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(lang(), { dateStyle: 'short', timeStyle: 'short' }).format(date) : text('unknownDate'); }
  function renderMessages() {
    const list = $('messageList'), nearEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
    const fragment = document.createDocumentFragment();
    if (!rows.length) fragment.append(node('p', text('empty'), 'empty'));
    for (const row of rows) {
      const verified = row.source === 'DATABASE' && row.identityVerified === true;
      const own = verified && row.actorType === actorType && row.actorId === actorId;
      const article = node('article', '', 'message' + (own ? ' own' : '')); article.dataset.recordId = row.recordId;
      const meta = node('div', '', 'message-meta');
      meta.append(node('strong', verified ? `${row.actorName || text(row.author)}${row.actorName ? '' : ' #' + row.actorId}` : text('history')));
      meta.append(node('time', when(row.created_at)));
      article.append(meta, node('p', typeof row.text === 'string' ? row.text : text('missingText'), 'message-text')); fragment.append(article);
    }
    list.replaceChildren(fragment); if (nearEnd) list.scrollTop = list.scrollHeight;
  }
  function renderNotices() {
    const fragment = document.createDocumentFragment();
    if (!notices.length) fragment.append(node('p', text('emptyNotices'), 'empty'));
    for (const item of notices) {
      const article = node('article', '', 'notice'); article.dataset.critical = String(['CRITICAL', 'ERROR'].includes(String(item.severity).toUpperCase()));
      article.append(node('strong', typeof item.title === 'string' ? item.title : text('notices')), node('p', typeof item.message === 'string' ? item.message : ''), node('small', when(item.createdAt)));
      fragment.append(article);
    }
    $('noticeList').replaceChildren(fragment);
  }
  function labels() {
    language = lang(); document.querySelectorAll('[data-chat-label]').forEach(element => { element.textContent = text(element.dataset.chatLabel); });
    for (const [id, state] of Object.entries(states)) $(id).textContent = state.key ? text(state.key) : '';
    renderMessages(); renderNotices(); renderControls();
  }
  async function request(url, options = {}) {
    const controller = new AbortController(); controllers.add(controller); const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { ...options, cache: 'no-store', headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' }, signal: controller.signal });
      return { response, data: await response.json() };
    } finally { clearTimeout(timer); controllers.delete(controller); }
  }
  async function loadMessages() {
    if (expire()) return;
    const revision = ++readRevision; status('chatReadStatus', 'loading');
    try {
      const { response, data } = await request('/api/chat/internal');
      if (expire() || revision !== readRevision) return;
      if (!response.ok || data?.ok !== true || !Array.isArray(data.messages) || data.messages.some(row => !row || typeof row.recordId !== 'string' || !['LEGACY', 'DATABASE'].includes(row.source))) throw Error();
      rows = data.messages; renderMessages(); status('chatReadStatus', 'readOk');
    } catch { if (!expire() && revision === readRevision) status('chatReadStatus', 'readError', 'error'); }
  }
  async function loadNotices() {
    if (expire()) return;
    const revision = ++noticeRevision; status('noticeStatus', 'loading');
    try {
      const { response, data } = await request('/api/notifications');
      if (expire() || revision !== noticeRevision) return;
      if (!response.ok || data?.ok !== true || !Array.isArray(data.notifications) || data.notifications.some(row => !row || typeof row !== 'object')) throw Error();
      const critical = value => ['CRITICAL', 'ERROR'].includes(String(value.severity).toUpperCase()) ? 0 : 1;
      notices = data.notifications.slice().sort((a, b) => critical(a) - critical(b) || Number(a.isRead) - Number(b.isRead) || new Date(b.createdAt) - new Date(a.createdAt));
      const criticalNow = notices.some(row => critical(row) === 0);
      if (criticalNow && !hadCriticalNotice) $('noticeDetails').open = true;
      hadCriticalNotice = criticalNow;
      const unread = notices.filter(row => !row.isRead).length; $('noticeBadge').textContent = criticalNow ? '!' : unread ? `(${unread})` : '';
      renderNotices(); status('noticeStatus', 'readOk');
    } catch { if (!expire() && revision === noticeRevision) status('noticeStatus', 'readError', 'error'); }
  }
  function validReply(data, record) {
    const row = data?.message;
    return data?.ok === true && typeof data.replayed === 'boolean' && row?.source === 'DATABASE' && row.identityVerified === true &&
      typeof row.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.id) && row.recordId === row.id &&
      row.requestId === record.requestId && row.text === record.text && row.actorType === actorType && row.actorId === actorId && ['ADMIN', 'TECHNICIAN', 'TEAM_LEADER'].includes(row.author);
  }
  async function send(retry = false) {
    if (expire() || working || blocked) return;
    if (!navigator.locks?.request || !crypto.randomUUID) { status('chatWriteStatus', 'browser', 'error'); return; }
    const draft = $('chatText').value;
    if (!retry && (!draft.trim() || draft.length > 4000)) { status('chatWriteStatus', 'invalid', 'error'); return; }
    working = true; renderControls();
    try {
      await navigator.locks.request(key, { ifAvailable: true }, async lock => {
        if (expire()) return;
        if (!lock) { status('chatWriteStatus', 'anotherTab', 'error'); return; }
        pending = readPending();
        if (pending && !retry) { status('chatWriteStatus', 'anotherTab', 'error'); return; }
        if (!pending) {
          if (retry) { await loadMessages(); return; }
          const value = { schema: 1, owner, requestId: crypto.randomUUID(), text: draft.trim() };
          try { localStorage.setItem(key, JSON.stringify(value)); pending = readPending(); if (JSON.stringify(pending) !== JSON.stringify(value)) throw Error(); }
          catch { throw Error('saveError'); }
        }
        const record = pending; renderControls(); status('chatWriteStatus', 'sending');
        const { response, data } = await request('/api/chat/internal', { method: 'POST', body: JSON.stringify({ text: record.text, requestId: record.requestId }) });
        if (expire()) return;
        if (![200, 201].includes(response.status) || !validReply(data, record)) throw Error('uncertain');
        if (JSON.stringify(readPending()) !== JSON.stringify(record)) throw Error('storageError');
        localStorage.removeItem(key); if (localStorage.getItem(key) !== null) throw Error('storageError');
        pending = null; readRevision++;
        rows = rows.filter(row => row.recordId !== data.message.recordId); rows.push(data.message); renderMessages();
        if ($('chatText').value.trim() === record.text) { $('chatText').value = ''; try { sessionStorage.removeItem(draftKey); } catch { draftProblem = true; } }
        status('chatWriteStatus', 'sent'); void loadMessages();
      });
    } catch (error) { if (!expire()) status('chatWriteStatus', ['storageError', 'saveError'].includes(error.message) ? error.message : 'uncertain', 'error'); }
    finally { working = false; renderControls(); }
  }
  function sync() {
    if (expire()) return;
    if (!working) { try { pending = readPending(); } catch { status('chatWriteStatus', 'storageError', 'error'); } }
    if (language !== lang()) labels(); else renderControls();
  }
  $('chatForm').addEventListener('submit', event => { event.preventDefault(); void send(); });
  $('chatRetry').addEventListener('click', () => void send(true));
  $('chatText').addEventListener('input', () => {
    if (expire()) return;
    try { sessionStorage.setItem(draftKey, $('chatText').value); draftProblem = false; } catch { draftProblem = true; }
    renderControls();
  });
  $('refreshChat').addEventListener('click', () => { sync(); void loadMessages(); void loadNotices(); });
  window.addEventListener('storage', sync); window.addEventListener('focus', sync); window.addEventListener('cw-language-change', sync);
  window.addEventListener('online', () => { sync(); void loadMessages(); void loadNotices(); }); window.addEventListener('offline', sync);
  document.addEventListener('visibilitychange', sync);
  setInterval(sync, 500);
  setInterval(() => { if (!document.hidden && navigator.onLine && same()) { void loadMessages(); void loadNotices(); } }, 30000);
  const home = role === 'ADMIN' ? '/admin-master-control' : '/technician-field-mode'; $('backLink').href = home; $('operationLink').href = home;
  try { const draft = sessionStorage.getItem(draftKey); if (draft !== null && draft.length <= 4000) $('chatText').value = draft; } catch { draftProblem = true; }
  $('staffChat').hidden = false; sync(); labels(); void loadMessages(); void loadNotices();
})();
