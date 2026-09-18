(function () {
  'use strict';
  const month = document.getElementById('monthRef'), filter = document.getElementById('onlyRequiresInvoice');
  const language = document.getElementById('reportLanguage');
  const button = document.getElementById('openPrintableReport'), status = document.getElementById('status');
  const now = new Date(); month.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const reader = window.CristalReportDownloads.create({
    context: () => ({ monthRef: month.value, onlyRequiresInvoice: filter.value, language: language.value }),
    state: (kind, message) => { status.dataset.state = kind; status.textContent = message; status.setAttribute('role', ['error', 'session'].includes(kind) ? 'alert' : 'status'); button.disabled = kind === 'loading' || kind === 'session'; if (kind === 'session') { month.disabled = true; filter.disabled = true; language.disabled = true; } },
  });
  function open() {
    if (!/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month.value) || !['true', 'false'].includes(filter.value) || !['pt', 'en', 'fr', 'es'].includes(language.value)) { reader.cancel('Indique um mês válido entre 2000 e 2199 e escolha o filtro e o idioma do relatório.', 'error'); return; }
    reader.open('/api/reports/monthly-print?monthRef=' + encodeURIComponent(month.value) + '&onlyRequiresInvoice=' + filter.value + '&lang=' + language.value,
      { type: 'text/html', headers: { 'Content-Language': language.value, 'X-CW-Report-Type': 'monthly-print', 'X-CW-Month-Ref': month.value, 'X-CW-Invoice-Filter': filter.value } });
  }
  month.addEventListener('input', () => reader.cancel()); filter.addEventListener('change', () => reader.cancel());
  language.addEventListener('change', () => reader.cancel());
  button.addEventListener('click', open); reader.observe();
}());
