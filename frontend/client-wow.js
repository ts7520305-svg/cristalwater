// Compatibility for older cached HTML: never forward account selectors or arbitrary destinations.
(function () {
  "use strict";
  const values = new URLSearchParams(window.location.search).getAll('lang');
  const language = values.length === 1 && ['pt', 'en', 'fr', 'es', 'de'].includes(values[0]) ? values[0] : null;
  const link = document.getElementById("portalLink");
  if (link) link.href = '/client-portal' + (language ? '?lang=' + language : '');
})();
