(function () {
  'use strict';
  const types = ['ARRIVAL', 'PAYMENT', 'DEBT', 'CHAT', 'REMINDER'];
  const copy = {
    pt: { label: 'Notificações', title: 'Preferências de som', intro: 'Consulte e guarde preferências associadas à sua conta.', reload: 'Atualizar preferências', notices: 'Ver notificações', loading: 'A carregar preferências…', ready: 'Preferências consultadas.', saving: 'A guardar a alteração…', saved: 'Alteração confirmada.', unavailable: 'Estas preferências não estão disponíveis para esta conta. Pode consultar as suas notificações.', error: 'Não foi possível carregar as preferências. Tente novamente.', unconfirmed: 'Não foi possível confirmar a alteração. Atualize as preferências antes de tentar novamente.', changed: 'A sessão mudou. Volte a abrir esta página com a conta pretendida.', unset: 'Não definida', on: 'Ativado', off: 'Desativado', types: ['Chegadas', 'Pagamentos', 'Valores em aberto', 'Conversas', 'Lembretes'] },
    en: { label: 'Notifications', title: 'Sound preferences', intro: 'View and save preferences associated with your account.', reload: 'Refresh preferences', notices: 'View notifications', loading: 'Loading preferences…', ready: 'Preferences loaded.', saving: 'Saving the change…', saved: 'Change confirmed.', unavailable: 'These preferences are not available for this account. You can view your notifications.', error: 'Could not load preferences. Try again.', unconfirmed: 'The change could not be confirmed. Refresh preferences before trying again.', changed: 'The session changed. Reopen this page with the intended account.', unset: 'Not set', on: 'Enabled', off: 'Disabled', types: ['Arrivals', 'Payments', 'Outstanding amounts', 'Conversations', 'Reminders'] },
    es: { label: 'Notificaciones', title: 'Preferencias de sonido', intro: 'Consulta y guarda las preferencias asociadas a tu cuenta.', reload: 'Actualizar preferencias', notices: 'Ver notificaciones', loading: 'Cargando preferencias…', ready: 'Preferencias consultadas.', saving: 'Guardando el cambio…', saved: 'Cambio confirmado.', unavailable: 'Estas preferencias no están disponibles para esta cuenta. Puedes consultar tus notificaciones.', error: 'No se pudieron cargar las preferencias. Inténtalo de nuevo.', unconfirmed: 'No se pudo confirmar el cambio. Actualiza las preferencias antes de volver a intentarlo.', changed: 'La sesión ha cambiado. Abre esta página con la cuenta deseada.', unset: 'Sin definir', on: 'Activado', off: 'Desactivado', types: ['Llegadas', 'Pagos', 'Importes pendientes', 'Conversaciones', 'Recordatorios'] },
    fr: { label: 'Notifications', title: 'Préférences sonores', intro: 'Consultez et enregistrez les préférences associées à votre compte.', reload: 'Actualiser les préférences', notices: 'Voir les notifications', loading: 'Chargement des préférences…', ready: 'Préférences consultées.', saving: 'Enregistrement de la modification…', saved: 'Modification confirmée.', unavailable: 'Ces préférences ne sont pas disponibles pour ce compte. Vous pouvez consulter vos notifications.', error: 'Impossible de charger les préférences. Réessayez.', unconfirmed: 'La modification n’a pas pu être confirmée. Actualisez les préférences avant de réessayer.', changed: 'La session a changé. Rouvrez cette page avec le compte souhaité.', unset: 'Non définie', on: 'Activé', off: 'Désactivé', types: ['Arrivées', 'Paiements', 'Montants dus', 'Conversations', 'Rappels'] },
    de: { label: 'Benachrichtigungen', title: 'Toneinstellungen', intro: 'Einstellungen für Ihr Konto ansehen und speichern.', reload: 'Einstellungen aktualisieren', notices: 'Benachrichtigungen ansehen', loading: 'Einstellungen werden geladen…', ready: 'Einstellungen geladen.', saving: 'Änderung wird gespeichert…', saved: 'Änderung bestätigt.', unavailable: 'Diese Einstellungen sind für dieses Konto nicht verfügbar. Sie können Ihre Benachrichtigungen ansehen.', error: 'Einstellungen konnten nicht geladen werden. Bitte erneut versuchen.', unconfirmed: 'Die Änderung konnte nicht bestätigt werden. Aktualisieren Sie die Einstellungen vor einem weiteren Versuch.', changed: 'Die Sitzung hat sich geändert. Öffnen Sie diese Seite mit dem gewünschten Konto erneut.', unset: 'Nicht festgelegt', on: 'Aktiviert', off: 'Deaktiviert', types: ['Ankünfte', 'Zahlungen', 'Offene Beträge', 'Gespräche', 'Erinnerungen'] },
  };
  const list = document.getElementById('list'), status = document.getElementById('settingsStatus'), reload = document.getElementById('settingsReload'), notices = document.getElementById('settingsNotices');
  function identity() {
    try {
      const user = JSON.parse(localStorage.getItem('cristalwater_user') || localStorage.getItem('user') || '{}');
      const token = localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token');
      const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const userId = Number(claims.userId || claims.id || claims.clientId), role = String(claims.role || '').toUpperCase();
      const localId = Number(user.userId || user.id || user.clientId);
      return token && Number.isSafeInteger(userId) && userId > 0 && userId === localId && role === String(user.role || '').toUpperCase() && ['ADMIN', 'CLIENT', 'TECHNICIAN', 'TEAM_LEADER'].includes(role) ? { token, userId, role } : null;
    } catch (_) { return null; }
  }
  const owner = identity();
  let values = new Map(), busy = false, loaded = false, revision = 0, message = 'loading', language = 'pt';
  function active() { const current = identity(); return Boolean(owner && current && current.token === owner.token && current.userId === owner.userId && current.role === owner.role); }
  function currentCopy() { return copy[language] || copy.pt; }
  function render() {
    const words = currentCopy();
    for (const [id, key] of [['settingsLabel', 'label'], ['settingsTitle', 'title'], ['settingsIntro', 'intro'], ['settingsReload', 'reload'], ['settingsNotices', 'notices']]) document.getElementById(id).textContent = words[key];
    status.textContent = words[message]; status.dataset.state = message;
    status.setAttribute('role', ['error', 'unconfirmed', 'changed'].includes(message) ? 'alert' : 'status');
    reload.disabled = busy || !active(); list.setAttribute('aria-busy', String(busy));
    list.replaceChildren();
    if (!loaded) return;
    for (const [index, type] of types.entries()) {
      const card = document.createElement('div'); card.className = 'card';
      const label = document.createElement('label'), text = document.createElement('span'), select = document.createElement('select');
      text.textContent = words.types[index]; select.dataset.settingType = type; select.setAttribute('aria-label', words.types[index]);
      for (const [value, title] of [['', words.unset], ['true', words.on], ['false', words.off]]) {
        const option = document.createElement('option'); option.value = value; option.textContent = title; option.disabled = value === ''; select.append(option);
      }
      select.value = values.has(type) ? String(values.get(type)) : ''; select.disabled = busy || !active();
      select.addEventListener('change', () => save(type, select.value === 'true'));
      label.append(text, select); card.append(label); list.append(card);
    }
  }
  function invalidate() { revision++; loaded = false; busy = false; values.clear(); message = 'changed'; render(); }
  function accepts(version) { if (!active()) { invalidate(); return false; } return version === revision; }
  function validRecord(record, type) { return record && Number.isSafeInteger(record.userId) && record.userId === owner.userId && record.type === type && typeof record.sound === 'boolean'; }
  function headers() { return { Authorization: 'Bearer ' + owner.token, 'Content-Type': 'application/json' }; }
  async function load() {
    if (busy) return;
    if (!active()) { invalidate(); return; }
    const read = ++revision; loaded = false; busy = true; message = 'loading'; render();
    try {
      const response = await fetch('/api/settings/' + owner.userId, { headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!accepts(read)) return;
      if ([401, 403].includes(response.status)) { message = 'unavailable'; return; }
      const data = await response.json();
      if (!accepts(read)) return;
      if (response.status !== 200 || data.ok !== true || !Array.isArray(data.settings)) throw Error('Unconfirmed preference read');
      const next = new Map();
      for (const record of data.settings) {
        if (!types.includes(record?.type)) continue;
        if (!validRecord(record, record.type) || next.has(record.type)) throw Error('Invalid preference identity');
        next.set(record.type, record.sound);
      }
      values = next; loaded = true; message = 'ready';
    } catch (_) { if (accepts(read)) message = 'error'; }
    finally { if (active() && read === revision) { busy = false; render(); } }
  }
  async function save(type, sound) {
    if (!active()) { invalidate(); return; }
    if (busy || !loaded || !types.includes(type) || typeof sound !== 'boolean') { render(); return; }
    const write = ++revision; busy = true; message = 'saving'; render();
    try {
      const response = await fetch('/api/settings', { method: 'POST', headers: headers(), body: JSON.stringify({ userId: owner.userId, type, sound }), signal: AbortSignal.timeout(15000) });
      if (!accepts(write)) return;
      if ([401, 403].includes(response.status)) { loaded = false; message = 'unavailable'; return; }
      const data = await response.json();
      if (!accepts(write)) return;
      if (response.status !== 200 || data.ok !== true || !validRecord(data.setting, type) || data.setting.sound !== sound) throw Error('Unconfirmed preference write');
      values.set(type, sound); message = 'saved';
    } catch (_) { if (accepts(write)) { loaded = false; message = 'unconfirmed'; } }
    finally { if (active() && write === revision) { busy = false; render(); } }
  }
  function setLanguage(value) { const code = String(value || 'pt').toLowerCase().slice(0, 2); language = copy[code] ? code : 'pt'; render(); }
  const destination = owner?.role === 'ADMIN' ? '/admin-notifications' : owner?.role === 'CLIENT' ? '/client-notifications' : '/technician-chat#noticesTitle';
  notices.href = destination;
  const back = document.querySelector('[data-cw-back]'); if (back) back.dataset.cwFallback = owner?.role === 'ADMIN' ? '/admin-master-control' : owner?.role === 'CLIENT' ? '/client-menu' : '/technician-profile';
  reload.addEventListener('click', load);
  window.addEventListener('storage', () => { if (!active()) invalidate(); });
  window.addEventListener('pageshow', () => { if (!active()) invalidate(); });
  window.addEventListener('cw-language-change', event => setLanguage(event.detail?.language));
  try { setLanguage(localStorage.getItem('cw_language') || document.documentElement.lang); } catch (_) { setLanguage('pt'); }
  load();
})();
