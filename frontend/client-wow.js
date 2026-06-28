(function () {
  "use strict";

  const target = `/client-portal${window.location.search || ""}`;
  const link = document.getElementById("portalLink");
  if (link) link.href = target;

  window.location.replace(target);
})();
