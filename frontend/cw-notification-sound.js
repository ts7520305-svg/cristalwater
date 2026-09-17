(function () {
  'use strict';
  const types = ['ARRIVAL', 'PAYMENT', 'DEBT', 'CHAT', 'REMINDER'];
  const aliases = { CHAT_MESSAGE: 'CHAT', PAYMENT_CONFIRMED: 'PAYMENT', PAYMENT_CONFIRMATION: 'PAYMENT', REPAIR_PAYMENT_RECORDED: 'PAYMENT', OVERDUE_PAYMENT: 'DEBT', PAYMENT_REMINDER: 'REMINDER', AI_REMINDER: 'REMINDER' };
  const copy = {
    pt: { title: 'Som das notificações', intro: 'O som funciona nesta página aberta, depois de o ativar, nas categorias permitidas nas preferências da sua conta.', enable: 'Ativar som nesta página', disable: 'Desativar som nesta página', test: 'Testar som', settings: 'Preferências da conta', idle: 'Som desativado nesta página.', ready: 'Som ativado nesta página. Cada aviso respeita a preferência atual da sua conta.', loading: 'A consultar as preferências de som…', error: 'Não foi possível confirmar as preferências. Este aviso ficou sem som.', unavailable: 'As preferências de som não estão disponíveis para esta conta.', changed: 'A sessão mudou. Reabra esta página com a conta pretendida.', device: 'O navegador não permitiu ativar o som. Tente novamente.', tested: 'Teste de som iniciado. Confirme se o ouviu no dispositivo.' },
    en: { title: 'Notification sound', intro: 'Sound works on this open page after you enable it, for categories allowed by your account preferences.', enable: 'Enable sound on this page', disable: 'Disable sound on this page', test: 'Test sound', settings: 'Account preferences', idle: 'Sound is disabled on this page.', ready: 'Sound is enabled on this page. Each notice follows your current account preference.', loading: 'Checking sound preferences…', error: 'Preferences could not be confirmed. This notice stayed silent.', unavailable: 'Sound preferences are unavailable for this account.', changed: 'The session changed. Reopen this page with the intended account.', device: 'The browser did not allow sound. Try again.', tested: 'Sound test started. Check whether you heard it on your device.' },
    es: { title: 'Sonido de notificaciones', intro: 'El sonido funciona en esta página abierta tras activarlo, para las categorías permitidas en las preferencias de su cuenta.', enable: 'Activar sonido en esta página', disable: 'Desactivar sonido en esta página', test: 'Probar sonido', settings: 'Preferencias de la cuenta', idle: 'Sonido desactivado en esta página.', ready: 'Sonido activado. Cada aviso respeta la preferencia actual de su cuenta.', loading: 'Consultando las preferencias de sonido…', error: 'No se pudieron confirmar las preferencias. Este aviso quedó sin sonido.', unavailable: 'Las preferencias de sonido no están disponibles para esta cuenta.', changed: 'La sesión cambió. Abra la página con la cuenta deseada.', device: 'El navegador no permitió activar el sonido. Inténtelo de nuevo.', tested: 'Prueba de sonido iniciada. Compruebe si lo oyó en el dispositivo.' },
    fr: { title: 'Son des notifications', intro: 'Le son fonctionne sur cette page ouverte après activation, pour les catégories autorisées dans les préférences du compte.', enable: 'Activer le son sur cette page', disable: 'Désactiver le son sur cette page', test: 'Tester le son', settings: 'Préférences du compte', idle: 'Le son est désactivé sur cette page.', ready: 'Le son est activé. Chaque avis respecte la préférence actuelle du compte.', loading: 'Vérification des préférences sonores…', error: 'Les préférences n’ont pas pu être confirmées. Cet avis est resté silencieux.', unavailable: 'Les préférences sonores sont indisponibles pour ce compte.', changed: 'La session a changé. Rouvrez la page avec le compte souhaité.', device: 'Le navigateur n’a pas autorisé le son. Réessayez.', tested: 'Test sonore lancé. Vérifiez si vous l’avez entendu sur votre appareil.' },
    de: { title: 'Benachrichtigungston', intro: 'Nach der Aktivierung funktioniert der Ton auf dieser geöffneten Seite für die in Ihren Kontoeinstellungen erlaubten Kategorien.', enable: 'Ton auf dieser Seite aktivieren', disable: 'Ton auf dieser Seite deaktivieren', test: 'Ton testen', settings: 'Kontoeinstellungen', idle: 'Der Ton ist auf dieser Seite deaktiviert.', ready: 'Der Ton ist aktiviert. Jeder Hinweis berücksichtigt Ihre aktuelle Kontoeinstellung.', loading: 'Toneinstellungen werden geprüft…', error: 'Die Einstellungen konnten nicht bestätigt werden. Dieser Hinweis blieb stumm.', unavailable: 'Toneinstellungen sind für dieses Konto nicht verfügbar.', changed: 'Die Sitzung hat sich geändert. Öffnen Sie die Seite mit dem gewünschten Konto erneut.', device: 'Der Browser hat den Ton nicht zugelassen. Versuchen Sie es erneut.', tested: 'Tontest gestartet. Prüfen Sie, ob Sie ihn auf Ihrem Gerät gehört haben.' }
  };
  function identity() {
    try {
      const token = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token');
      if (localStorage.getItem('token') && localStorage.getItem('token') !== token) return null;
      const user = JSON.parse(localStorage.getItem('cristalwater_user') || localStorage.getItem('user') || '{}');
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))), id = Number(payload.userId || payload.id);
      return token && payload.role === 'ADMIN' && user.role === 'ADMIN' && Number.isSafeInteger(id) && id > 0 && id === Number(user.userId || user.id) && Number.isFinite(payload.exp) && payload.exp > Date.now() / 1000 ? { token, id } : null;
    } catch (_) { return null; }
  }
  const owner = identity(), seen = new Set();
  let enabled = false, busy = false, audio = null, pending = null, revision = 0, invalidated = false, message = 'idle', language = 'pt';
  let panel, toggle, test, status;
  const active = () => { const current = identity(); return !invalidated && owner && current && current.id === owner.id && current.token === owner.token; };
  function words() { return copy[language] || copy.pt; }
  function render() {
    if (!panel) return;
    const text = words();
    panel.querySelector('h2').textContent = text.title; panel.querySelector('[data-sound-intro]').textContent = text.intro;
    panel.querySelector('a').textContent = text.settings; toggle.textContent = text[enabled ? 'disable' : 'enable']; test.textContent = text.test;
    toggle.disabled = busy || !active(); test.disabled = busy || !enabled || !active();
    toggle.setAttribute('aria-pressed', String(enabled)); status.textContent = text[message]; status.dataset.state = message;
  }
  function invalidate() {
    if (invalidated) return;
    invalidated = true; revision++; enabled = false; busy = false; message = 'changed';
    if (audio) { void audio.close().catch(() => {}); audio = null; } render();
  }
  function current(version) { if (!active()) { invalidate(); return false; } return version === revision; }
  function tone() {
    if (!active() || !enabled) return false;
    if (!audio || audio.state !== 'running') { enabled = false; message = 'device'; render(); return false; }
    try {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 880; gain.gain.value = 0.02;
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.08); return true;
    } catch (_) { message = 'device'; render(); return false; }
  }
  async function changeEnabled() {
    if (!active()) { invalidate(); return; }
    if (busy) return;
    revision++;
    if (enabled) { enabled = false; message = 'idle'; render(); return; }
    const version = revision; busy = true; render();
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw Error('Audio unavailable');
      audio = audio || new Audio(); await audio.resume();
      if (!current(version)) return;
      if (audio.state !== 'running') throw Error('Audio suspended');
      enabled = true; message = 'ready';
    } catch (_) { if (current(version)) { enabled = false; message = 'device'; } }
    finally { if (current(version)) { busy = false; render(); } }
  }
  async function preferences() {
    const version = revision;
    if (pending?.version === version) return pending.promise;
    const request = (async () => {
      const response = await fetch('/api/settings/' + owner.id, { headers: { Authorization: 'Bearer ' + owner.token }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!current(version)) return null;
      if ([401, 403].includes(response.status)) { message = 'unavailable'; render(); return null; }
      const data = await response.json(); if (!current(version)) return null;
      if (response.status !== 200 || data.ok !== true || !Array.isArray(data.settings)) throw Error('Unconfirmed preferences');
      const result = new Map();
      for (const row of data.settings) {
        if (!types.includes(row?.type)) continue;
        if (row.userId !== owner.id || typeof row.sound !== 'boolean' || result.has(row.type)) throw Error('Invalid preference identity');
        result.set(row.type, row.sound);
      }
      return result;
    })();
    pending = { version, promise: request };
    try { return await request; } finally { if (pending?.promise === request) pending = null; }
  }
  async function play(notification) {
    if (!active()) { invalidate(); return false; }
    if (!enabled || !notification || notification.isRead === true) return false;
    const type = types.includes(notification.type) ? notification.type : Object.hasOwn(aliases, notification.type) ? aliases[notification.type] : null;
    const id = notification.id;
    if (!type || !(Number.isSafeInteger(id) && id > 0 || /^chat-[1-9]\d*$/.test(String(id)))) return false;
    // Chat event IDs identify a conversation; include the event date to avoid
    // silencing later messages in the same conversation.
    const chat = /^chat-[1-9]\d*$/.test(String(id));
    if (chat && !Number.isFinite(Date.parse(notification.createdAt))) return false;
    const key = JSON.stringify([id, chat ? notification.createdAt : null]);
    if (seen.has(key)) return false;
    seen.add(key); if (seen.size > 500) seen.delete(seen.values().next().value);
    const version = revision; message = 'loading'; render();
    try {
      const values = await preferences();
      if (!current(version) || !enabled || !values) return false;
      message = 'ready'; render();
      return values.get(type) === true && tone();
    } catch (_) { if (current(version)) { message = 'error'; render(); } return false; }
  }
  function init() {
    panel = document.createElement('section'); panel.id = 'notificationSoundPanel'; panel.setAttribute('data-cw-no-i18n', '');
    panel.style.cssText = 'margin:16px 0;padding:16px;border:1px solid #cbdadd;border-radius:12px;background:#fff;color:#173c43;max-width:100%;overflow-wrap:anywhere';
    panel.innerHTML = '<h2 style="margin:0 0 8px;font-size:20px"></h2><p data-sound-intro></p><div style="display:flex;flex-wrap:wrap;gap:10px"><button type="button" id="notificationSoundToggle"></button><button type="button" id="notificationSoundTest"></button><a href="/settings"></a></div><p id="notificationSoundStatus" role="status" data-cw-state-managed="manual"></p>';
    (document.getElementById('count')?.closest('.panel,.top') || document.getElementById('list'))?.before(panel);
    toggle = panel.querySelector('#notificationSoundToggle'); test = panel.querySelector('#notificationSoundTest'); status = panel.querySelector('#notificationSoundStatus');
    panel.querySelectorAll('button,a').forEach(control => { control.style.cssText = 'min-height:44px;max-width:100%;white-space:normal;padding:10px 14px;border-radius:8px;font:inherit'; });
    toggle.addEventListener('click', changeEnabled);
    test.addEventListener('click', () => { if (tone()) { message = 'tested'; render(); } });
    if (!active()) message = 'unavailable'; render();
  }
  function setLanguage(value) { const code = String(value || 'pt').toLowerCase().slice(0, 2); language = copy[code] ? code : 'pt'; render(); }
  try { setLanguage(localStorage.getItem('cw_language') || document.documentElement.lang); } catch (_) {}
  for (const event of ['storage', 'pageshow', 'focus']) window.addEventListener(event, () => { if (!active()) invalidate(); });
  window.addEventListener('cw-language-change', event => setLanguage(event.detail?.language));
  window.CWNotificationSound = Object.freeze({ play });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
