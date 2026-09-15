(() => {
  'use strict';
  const active = new Set(), deleted = new Set();
  const getToken = () => window.CristalAuth?.getToken?.() || localStorage.getItem('cristalwater_jwt') || localStorage.getItem('token') || '';
  const key = id => String(id);
  function attach(config) {
    const token = getToken(), status = document.getElementById(config.status);
    function session() {
      if (token && token === getToken()) return true;
      status.textContent = 'A sessão mudou. Reabre a página para continuar com a conta atual.';
      return false;
    }
    return async function remove(id) {
      const k = key(id);
      if (active.has(k) || deleted.has(k) || config.isCompleting?.(id) || !session()) return;
      const row = config.get(id);
      if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || !Number.isSafeInteger(row.poolId) || row.poolId <= 0 ||
        !['TECHNICAL_PERIODIC_SERVICE', 'POOL_SERVICE_REMINDER'].includes(row.category) || typeof row.title !== 'string' ||
        typeof row.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.updatedAt)) {
        status.textContent = 'Atualiza a página antes de eliminar este lembrete.'; return;
      }
      const snapshot = JSON.stringify(row), target = JSON.parse(snapshot);
      active.add(k); config.buttons(id).forEach(button => { button.disabled = true; });
      try {
        const accepted = await window.CwUi.confirm('Eliminar este lembrete? O histórico técnico e as visitas são mantidos.', {
          title: 'Eliminar lembrete', confirmText: 'Eliminar', cancelText: 'Cancelar', danger: true,
          details: `${target.title}\n${config.poolLabel(target)}\n${new Date(target.dueAt).toLocaleString(document.documentElement.lang || 'pt-PT')}`,
        });
        if (!accepted || !session()) return;
        if (snapshot !== JSON.stringify(config.get(id)) || config.isCompleting?.(id)) {
          status.textContent = 'O lembrete mudou. Atualiza a lista e confirma novamente.'; return;
        }
        status.textContent = 'A confirmar eliminação…';
        const response = await fetch(`/api/core/pools/${target.poolId}/service-reminders/${target.id}`, {
          method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ expectedUpdatedAt: target.updatedAt }),
        });
        const result = await response.json().catch(() => ({}));
        if (!session()) return;
        if (response.status === 409 || response.status === 404) {
          status.textContent = 'O lembrete mudou ou já não está disponível. Atualiza a página e confirma novamente.';
          try { await config.reload(); } catch { /* Keep the conflict visible if refresh also fails. */ }
          return;
        }
        if (!response.ok || result.ok !== true || result.deleted !== true || result.reminderId !== target.id ||
          result.poolId !== target.poolId || result.deletedVersion !== target.updatedAt || typeof result.deletedAt !== 'string' || !Number.isFinite(Date.parse(result.deletedAt))) {
          throw Error('Unconfirmed deletion');
        }
        deleted.add(k); config.onDeleted(id);
        status.textContent = result.idempotent ? 'Eliminação confirmada. O lembrete já tinha sido eliminado.' : 'Lembrete eliminado.';
        try { await config.reload(); }
        catch { if (session()) status.textContent = 'Lembrete eliminado. Atualiza a página para consultar a lista.'; }
      } catch {
        if (session()) status.textContent = 'Ainda não foi possível confirmar a eliminação. Podes voltar a eliminar este mesmo lembrete para verificar o resultado.';
      } finally {
        active.delete(k); config.buttons(id).forEach(button => { button.disabled = false; });
      }
    };
  }
  window.CwReminderDelete = { attach, busy: id => active.has(key(id)), wasDeleted: id => deleted.has(key(id)) };
})();
