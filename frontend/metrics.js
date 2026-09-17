(function () {
  'use strict';
  const list = document.getElementById('metricsList');
  function valid(row) {
    return row && (row.id === null || (Number.isSafeInteger(row.id) && row.id > 0)) && typeof row.name === 'string'
      && Number.isSafeInteger(row.totalVisits) && row.totalVisits > 0
      && Number.isSafeInteger(row.measuredVisits) && row.measuredVisits >= 0 && row.measuredVisits <= row.totalVisits
      && Number.isFinite(row.totalTime) && row.totalTime >= 0
      && (row.measuredVisits ? row.avgTime === Math.round(row.totalTime / row.measuredVisits) : row.totalTime === 0 && row.avgTime === null);
  }
  const reader = CWAdminRead.create({
    url: '/api/metrics/productivity', list, status: document.getElementById('status'), reload: document.getElementById('metricsReload'),
    empty: 'Sem visitas regulares concluídas.', loaded: 'Métricas carregadas.',
    parse(result) {
      if (!result || result.ok !== true || !Array.isArray(result.clients) || !Array.isArray(result.technicians) || !result.clients.every(valid) || !result.technicians.every(valid)) throw Error('Invalid metrics');
      return ['clients', 'technicians'].flatMap(kind => result[kind].map(row => ({ ...row, kind })));
    },
    render(rows) {
      const maximum = rows.reduce((max, row) => Math.max(max, row.avgTime || 0), 0);
      for (const [kind, title] of [['clients', 'Clientes'], ['technicians', 'Técnicos']]) {
        const records = rows.filter(row => row.kind === kind); if (!records.length) continue;
        const section = document.createElement('section'), heading = document.createElement('h2');
        section.dataset.metricKind = kind; section.className = 'metrics-group'; heading.textContent = title; section.append(heading);
        for (const row of records) {
          const article = document.createElement('article'), name = document.createElement('strong'), average = document.createElement('span'), counts = document.createElement('p');
          article.className = 'metrics-row'; article.dataset.metricId = row.id === null ? 'legacy:' + row.name : String(row.id);
          name.textContent = row.name;
          if (row.id !== null) name.textContent += ' · #' + row.id;
          average.dataset.average = ''; average.textContent = row.avgTime === null ? 'Sem duração válida' : row.avgTime + ' min';
          counts.textContent = row.measuredVisits + ' de ' + row.totalVisits + ' visitas concluídas com duração válida.';
          article.append(name, average, counts);
          if (row.avgTime !== null) {
            const track = document.createElement('div'), bar = document.createElement('span');
            track.className = 'metrics-track'; track.setAttribute('aria-hidden', 'true'); bar.className = 'metrics-bar';
            bar.style.width = (maximum ? row.avgTime / maximum * 100 : 0) + '%'; track.append(bar); article.append(track);
          }
          section.append(article);
        }
        list.append(section);
      }
    },
  });
  void reader.load();
})();
