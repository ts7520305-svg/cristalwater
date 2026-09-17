// Synchronous entry check. API authentication remains authoritative.
// Rejecting a session must never erase drafts, queues or saved field documents.
(function () {
  'use strict';
  const root = document.documentElement, previousVisibility = root.style.visibility;
  root.style.visibility = 'hidden';
  const identityKeys = ['cristalwater_jwt', 'cristalwater_user', 'token', 'user', 'adminToken', 'cw_client_id', 'clientId'];

  function reject(reason) {
    for (const key of identityKeys) {
      try { localStorage.removeItem(key); } catch (_) { /* Storage can be unavailable. */ }
    }
    window.location.replace('/client-login?reason=' + encodeURIComponent(reason));
  }
  function payloadOf(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3 || parts.some(part => !part)) return null;
      const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(Array.from(json, char => '%' + char.charCodeAt(0).toString(16).padStart(2, '0')).join('')));
    } catch (_) { return null; }
  }

  try {
    const token = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token');
    const userRaw = localStorage.getItem('cristalwater_user') || localStorage.getItem('user');
    if (!token || !userRaw) { reject('no_session'); return; }
    const payload = payloadOf(token);
    if (!payload || !Number.isFinite(payload.exp)) { reject('invalid_token'); return; }
    if (payload.exp <= Math.floor(Date.now() / 1000)) { reject('session_expired'); return; }
    let user;
    try { user = JSON.parse(userRaw); } catch (_) { reject('invalid_session'); return; }
    const role = String(user?.role || '').toUpperCase().trim();
    const tokenRole = String(payload.role || '').toUpperCase().trim();
    if (role !== tokenRole || !['CLIENT', 'ADMIN', 'TECHNICIAN', 'TEAM_LEADER'].includes(role)) {
      reject('invalid_session'); return;
    }
    const pathname = window.location.pathname.replace(/\/$/, '').replace(/\.html$/, '');
    // Keep the existing administrator preview and the legacy chat redirect.
    if (role === 'ADMIN' && pathname === '/client_chat') { window.location.replace('/chat'); return; }
    const adminPreview = role === 'ADMIN' && pathname === '/client-portal';
    // Account preferences use server-side User ownership. CLIENT/PIN can receive
    // an unavailable state; opening this page never grants access to that table.
    const accountSettings = pathname === '/settings';
    if (role !== 'CLIENT' && !adminPreview && !accountSettings) {
      window.location.replace(role === 'ADMIN' ? '/admin-master-control' : '/technician-field-mode');
      return;
    }
    const clientId = Number(payload.clientId || payload.id || 0);
    if (role === 'CLIENT' && (!Number.isSafeInteger(clientId) || clientId <= 0 || clientId !== Number(user.clientId || user.id || 0))) {
      reject('invalid_session'); return;
    }
    const normalizedUser = JSON.stringify({ ...user, role });
    const aliases = { cristalwater_jwt: token, token, cristalwater_user: normalizedUser, user: normalizedUser };
    if (role === 'CLIENT') Object.assign(aliases, { cw_client_id: String(clientId), clientId: String(clientId) });
    for (const [key, value] of Object.entries(aliases)) {
      if (localStorage.getItem(key) !== value) localStorage.setItem(key, value);
      if (localStorage.getItem(key) !== value) throw new Error('Session alias was not saved');
    }
    root.style.visibility = previousVisibility;
  } catch (_) {
    reject('guard_error');
  }
})();
