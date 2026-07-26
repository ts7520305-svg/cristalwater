(function () {
  if (window.__CW_V2_SHELL__) return;
  window.__CW_V2_SHELL__ = true;

  const searchInput = document.querySelector('[data-cw-search-input]');
  const searchResults = document.querySelector('[data-cw-search-results]');
  const indicator = document.querySelector('[data-offline-indicator]');

  function loadStateAdapter() {
    if (window.CWV2StateAdapter?.start) {
      window.CWV2StateAdapter.start();
      return;
    }
    if (document.querySelector('script[data-cw-v2-state-adapter="1"]')) return;
    const script = document.createElement('script');
    script.src = '/ui/state-adapter-v2.js';
    script.defer = true;
    script.dataset.cwV2StateAdapter = '1';
    document.body.appendChild(script);
  }

  function getDrawer() {
    return document.querySelector('[data-cw-drawer], .cw-v2-drawer');
  }

  function closeDrawer() {
    const drawer = getDrawer();
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  function openDrawer() {
    const drawer = getDrawer();
    if (!drawer) return;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
  }

  function updateConnectionState() {
    if (!indicator) return;
    if (navigator.onLine) {
      indicator.textContent = 'Online';
      indicator.classList.remove('warning');
      indicator.classList.add('success');
      return;
    }
    indicator.textContent = 'Offline';
    indicator.classList.remove('success');
    indicator.classList.add('warning');
  }

  function closeSearch() {
    if (searchResults) searchResults.style.display = 'none';
  }

  function renderSearch(query) {
    if (!searchInput || !searchResults) return;
    const list = Array.from(document.querySelectorAll('[data-shell-search]'));
    const term = String(query || '').trim().toLowerCase();

    if (!term) {
      closeSearch();
      return;
    }

    const matches = list
      .map((node) => ({
        label: node.getAttribute('data-shell-search') || '',
        href: node.getAttribute('href') || node.getAttribute('data-shell-href') || '#',
      }))
      .filter((item) => item.label.toLowerCase().includes(term))
      .slice(0, 8);

    if (!matches.length) {
      searchResults.innerHTML = '<a href="#" onclick="return false">Sem resultados</a>';
      searchResults.style.display = 'block';
      return;
    }

    searchResults.innerHTML = matches
      .map((item) => `<a href="${item.href}">${item.label}</a>`)
      .join('');
    searchResults.style.display = 'block';
  }

  if (searchInput && searchResults) {
    searchInput.addEventListener('input', (event) => renderSearch(event.target.value));
    searchInput.addEventListener('focus', (event) => renderSearch(event.target.value));
    document.addEventListener('click', (event) => {
      if (!searchResults.contains(event.target) && event.target !== searchInput) closeSearch();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSearch();
    });
  }

  document.addEventListener('click', (event) => {
    const openTrigger = event.target.closest('[data-cw-open-drawer]');
    if (openTrigger) {
      event.preventDefault();
      openDrawer();
      return;
    }

    const closeTrigger = event.target.closest('[data-cw-close-drawer], [data-cw-drawer-backdrop], .cw-v2-drawer-backdrop');
    if (closeTrigger) {
      event.preventDefault();
      closeDrawer();
      return;
    }

    const drawer = getDrawer();
    if (!drawer) return;
    if (!drawer.contains(event.target)) return;
    if (event.target.closest('a[href]')) closeDrawer();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();
  });

  window.addEventListener('online', updateConnectionState);
  window.addEventListener('offline', updateConnectionState);
  updateConnectionState();
  loadStateAdapter();
})();
