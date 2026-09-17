(function () {
  'use strict';
  const list = document.getElementById('list'), labels = ['Normal', 'Alta', 'Urgente'];
  let poolEdit;
  const reader = CWAdminRead.create({
    url: '/api/pools', list, status: document.getElementById('priorityStatus'), reload: document.getElementById('priorityReload'),
    empty: 'Sem piscinas ativas.', loaded: 'Prioridades carregadas.',
    parse(result) {
      if (result?.ok !== true || !Array.isArray(result.pools) || !result.pools.every(pool => pool && Number.isSafeInteger(pool.id) && pool.id > 0 && typeof pool.name === 'string' && Number.isSafeInteger(pool.priority) && pool.priority >= 0) || new Set(result.pools.map(pool => pool.id)).size !== result.pools.length) throw Error('Invalid pools');
      return result.pools;
    },
    render(pools) {
      for (const pool of pools) {
        const article = document.createElement('article'), name = document.createElement('strong'), client = document.createElement('p'), priority = document.createElement('p'), button = document.createElement('button');
        article.className = 'card'; article.dataset.poolId = pool.id; article.style.overflowWrap = 'anywhere';
        name.textContent = pool.name; client.textContent = 'Cliente: ' + (pool.client?.name || '—');
        priority.textContent = 'Prioridade: ' + (labels[pool.priority] || String(pool.priority)); priority.dataset.priority = pool.priority;
        button.type = 'button'; button.textContent = 'Editar piscina e prioridade'; button.addEventListener('click', () => { if (reader.active()) void poolEdit.open(pool.id); });
        article.append(name, client, priority, button); list.append(article);
      }
    }
  });
  poolEdit = CWPoolEdit.create({ includePriority: true, confirmed: () => reader.load(), invalidated: () => reader.active() });
  window.poolPriorityEdit = poolEdit;
  void reader.load();
})();
