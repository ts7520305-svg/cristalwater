(function () {
  'use strict';
  const status = document.getElementById('documentStatus');
  const button = document.getElementById('openDocument');
  const login = document.getElementById('documentLogin');
  const rawId = new URLSearchParams(location.search).get('id');
  if (!/^[1-9]\d{0,9}$/.test(rawId || '') || Number(rawId) > 2147483647) {
    status.textContent = 'O link do documento é inválido. Solicite um novo link à administração.';
    return;
  }
  const returnTo = encodeURIComponent(`/invoice-document?id=${Number(rawId)}`);
  document.getElementById('clientDocumentLogin').href = `/client-login?returnTo=${returnTo}`;
  document.getElementById('adminDocumentLogin').href = `/login?returnTo=${returnTo}`;
  login.hidden = false;
  function ready() {
    const token = window.CristalAuth.getToken();
    button.hidden = !token;
    status.textContent = token ? 'Abra o PDF com a sua sessão atual ou entre com outra conta.' : 'Entre na sua conta para consultar o documento. Voltará a esta página depois de iniciar sessão.';
  }
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    if (!window.CristalAuth.getToken()) { ready(); return; }
    button.disabled = true;
    status.textContent = 'A obter o documento…';
    try {
      await window.CristalDownloads.open(`/api/invoice-pdf/${Number(rawId)}`);
      status.textContent = 'Documento aberto numa nova janela.';
    } catch (error) {
      status.textContent = error.message || 'Não foi possível abrir o documento. Volte a tentar.';
    } finally { button.disabled = false; }
  });
  window.addEventListener('storage', event => { if (event.key === null || ['cristalwater_jwt', 'token'].includes(event.key)) ready(); });
  ready();
}());
