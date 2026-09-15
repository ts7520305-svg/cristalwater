(() => {
  'use strict';
  const getToken = () => window.CristalAuth?.getToken?.() || localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  function attach(config) {
    const token = getToken(), fields = config.fields.map(id => document.getElementById(id));
    const button = document.getElementById(config.button), status = document.getElementById(config.status);
    let owner, key, pending = null, busy = false, blocked = false;
    const panel = document.createElement('div'), summary = document.createElement('p');
    const summaryLabel = document.createElement('strong'), summaryDetails = document.createElement('span');
    summaryDetails.setAttribute('data-cw-no-i18n', 'true'); summary.append(summaryLabel, document.createTextNode(': '), summaryDetails);
    panel.dataset.reminderPending = config.scope; panel.style.cssText = 'margin-top:12px;max-width:100%;overflow-wrap:anywhere';
    const retry = document.createElement('button'), correct = document.createElement('button');
    retry.type = correct.type = 'button'; retry.textContent = 'Repetir confirmação'; correct.textContent = 'Corrigir dados';
    panel.append(summary, retry, correct); status.after(panel);
    function session() {
      if (token && token === getToken()) return true;
      blocked = true; pending = null;
      fields.forEach(field => { field.value = ''; field.disabled = true; });
      panel.hidden = true; button.disabled = true;
      status.textContent = 'A sessão mudou. Reabre a página para continuar com a conta atual.';
      return false;
    }
    function validate(record) {
      if (!record || record.version !== 1 || record.owner !== owner || record.scope !== config.scope || !uuid(record.requestId) ||
        !config.validPath(record.path) || !record.body || typeof record.body !== 'object' || Array.isArray(record.body) ||
        typeof record.body.title !== 'string' || !record.body.title.trim() || record.body.title.length > 300 ||
        typeof record.body.dueAt !== 'string' || !Number.isFinite(new Date(record.body.dueAt).getTime()) ||
        Object.keys(record.body).some(k => !['title', 'dueAt', 'description', 'priority', 'repeatRule', 'category'].includes(k)) ||
        Object.values(record.body).some(v => typeof v !== 'string') || !record.fields || Object.keys(record.fields).length !== fields.length ||
        fields.some(f => typeof record.fields[f.id] !== 'string') ||
        record.rejection && (![400, 404, 422].includes(record.rejection.status) || typeof record.rejection.message !== 'string')) throw Error('Dados do lembrete inválidos. Revê o título, a data e o destino.');
      return record;
    }
    function read() {
      try { const raw = localStorage.getItem(key); return raw ? validate(JSON.parse(raw)) : null; }
      catch { blocked = true; throw Error('O pedido guardado está inválido ou não pôde ser lido. Foi conservado para revisão; não será enviado.'); }
    }
    function restore() {
      if (pending) fields.forEach(field => { field.value = pending.fields[field.id]; });
      config.onRestore?.();
    }
    function render() {
      if (!session()) return;
      fields.forEach(field => { field.disabled = busy || blocked || Boolean(pending); });
      button.disabled = busy || blocked || Boolean(pending);
      panel.hidden = !pending;
      if (pending) { summaryLabel.textContent = pending.rejection ? 'Pedido recusado' : 'Pedido por confirmar'; summaryDetails.textContent = `${pending.body.title} · ${new Date(pending.body.dueAt).toLocaleString('pt-PT')}`; }
      retry.disabled = busy || blocked || Boolean(pending?.rejection);
      correct.hidden = !pending?.rejection; correct.disabled = busy || blocked;
    }
    function forget(record) {
      const stored = read();
      if (!stored || stored.requestId !== record.requestId) throw Error('O pedido mudou noutra janela. Atualiza a página.');
      localStorage.removeItem(key); pending = null;
    }
    async function submit(repeat = false) {
      if (busy || blocked || !session()) return;
      if (!navigator.locks?.request || !crypto.randomUUID) { status.textContent = 'Abre esta página num navegador atualizado para proteger os pedidos entre janelas.'; return; }
      busy = true; render();
      try {
        await navigator.locks.request(key, { ifAvailable: true }, async lock => {
          if (!session()) return;
          if (!lock) { status.textContent = 'Existe um pedido em curso noutra janela. Aguarda e atualiza a página.'; return; }
          const stored = read();
          if (stored && (!pending || stored.requestId !== pending.requestId)) { pending = stored; restore(); status.textContent = 'Pedido pendente recuperado. Usa Repetir confirmação.'; return; }
          if (!stored && pending) { pending = null; status.textContent = 'O pedido foi resolvido noutra janela. Atualiza a página antes de criar outro.'; return; }
          if (Boolean(pending) !== repeat || pending?.rejection) return;
          if (!pending) {
            const prepared = config.prepare();
            const record = validate({ version: 1, owner, scope: config.scope, requestId: crypto.randomUUID(), ...prepared, fields: Object.fromEntries(fields.map(f => [f.id, f.value])) });
            try { localStorage.setItem(key, JSON.stringify(record)); }
            catch { throw Error('Não foi possível guardar o pedido neste navegador. Nenhum pedido foi enviado.'); }
            pending = record; render();
          }
          const record = pending;
          status.textContent = 'A confirmar criação do lembrete…';
          try {
            const response = await fetch(record.path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...record.body, requestId: record.requestId }) });
            const result = await response.json().catch(() => ({}));
            if (!session()) return;
            if (!response.ok || result.ok === false) throw Object.assign(Error(result.error || 'Não foi possível confirmar a criação.'), { status: response.status });
            const row = result.reminder, pool = record.path.match(/^\/api\/core\/pools\/(\d+)\/service-reminders$/);
            if (result.ok !== true || result.requestId !== record.requestId || !Number.isSafeInteger(row?.id) || row.id <= 0 ||
              row.title !== record.body.title.trim() || row.dueAt !== new Date(record.body.dueAt).toISOString() || pool && row.poolId !== Number(pool[1])) throw Error('A confirmação recebida não corresponde ao pedido.');
            forget(record);
            status.textContent = result.idempotent ? 'Criação confirmada. Foi recuperado o lembrete original.' : 'Lembrete criado.';
            try { await config.onSuccess?.(result, session); }
            catch { if (session()) status.textContent = 'Lembrete criado. Atualiza a página para consultar a lista.'; }
          } catch (error) {
            if (!session()) return;
            if ([400, 404, 422].includes(error.status)) {
              pending = { ...record, rejection: { status: error.status, message: error.message } };
              localStorage.setItem(key, JSON.stringify(pending));
              status.textContent = `${error.message} Usa Corrigir dados antes de tentar novamente.`;
            } else {
              status.textContent = 'Ainda não foi possível confirmar a criação. O pedido foi guardado; usa Repetir confirmação, mesmo depois de reabrir a página.';
            }
          }
        });
      } catch (error) { if (session()) status.textContent = error.message; }
      finally { busy = false; render(); }
    }
    retry.onclick = () => submit(true);
    correct.onclick = async () => {
      if (busy || blocked || !pending?.rejection || !session()) return;
      busy = true; render();
      try {
        await navigator.locks.request(key, { ifAvailable: true }, async lock => {
          if (!lock || !session()) return;
          const record = read();
          if (!record?.rejection || record.requestId !== pending.requestId) throw Error('O pedido mudou. Atualiza a página.');
          forget(record); status.textContent = 'Corrige os dados e volta a criar o lembrete.';
        });
      } catch (error) { if (session()) status.textContent = error.message; }
      finally { busy = false; render(); }
    };
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'ADMIN' || !Number.isSafeInteger(Number(payload.id)) || Number(payload.id) <= 0) throw Error('Sessão administrativa inválida.');
      owner = `ADMIN:${payload.id}`; key = `cwReminderCreate:v1:${owner}:${config.scope}`;
      pending = read(); restore();
      if (pending) status.textContent = pending.rejection ? `${pending.rejection.message} Usa Corrigir dados.` : 'Pedido pendente recuperado. Usa Repetir confirmação.';
    } catch (error) { blocked = true; status.textContent = error.message; }
    for (const event of ['storage', 'focus']) window.addEventListener(event, () => { session(); });
    render();
    return { submit: () => submit(false), refresh() {
      if (!session()) return;
      try {
        pending = read(); restore();
        if (pending) status.textContent = pending.rejection ? `${pending.rejection.message} Usa Corrigir dados.` : 'Pedido pendente recuperado. Usa Repetir confirmação.';
      } catch (error) { status.textContent = error.message; }
      render();
    } };
  }
  window.CwReminderCreate = { attach };
})();
