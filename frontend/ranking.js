(function () {
  'use strict';
  const list = document.getElementById('ranking');
  const reader = CWAdminRead.create({
    url: '/api/technician/ranking', list, status: document.getElementById('status'), reload: document.getElementById('rankingReload'),
    empty: 'Sem visitas regulares elegíveis.', loaded: 'Ranking carregado.',
    parse(result) {
      if (!Array.isArray(result) || !result.every(row => row && typeof row.name === 'string' && Number.isSafeInteger(row.total) && row.total > 0 && Number.isSafeInteger(row.done) && row.done >= 0 && row.done <= row.total && row.performance === Math.round(row.done / row.total * 100))) throw Error('Invalid ranking');
      return result;
    },
    render(rows) {
      for (const row of rows) {
        const article = document.createElement('article'), name = document.createElement('strong'), counts = document.createElement('p');
        article.style.cssText = 'padding:12px 0;overflow-wrap:anywhere;border-bottom:1px solid #cbd9e8';
        name.textContent = row.name; counts.textContent = `${row.done} de ${row.total} visitas concluídas · ${row.performance}%`;
        article.append(name, counts); list.append(article);
      }
    }
  });
  void reader.load();
})();
