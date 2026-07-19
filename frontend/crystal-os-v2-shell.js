(function () {
  const searchInput = document.querySelector('[data-cw-search-input]');
  const searchResults = document.querySelector('[data-cw-search-results]');
  const indicator = document.querySelector('[data-offline-indicator]');
  const drawer = document.querySelector('[data-cw-drawer]');

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  function openDrawer() {
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

  document.querySelectorAll('[data-cw-open-drawer]').forEach((button) => {
    button.addEventListener('click', openDrawer);
  });

  document.querySelectorAll('[data-cw-close-drawer]').forEach((button) => {
    button.addEventListener('click', closeDrawer);
  });

  if (drawer) {
    drawer.addEventListener('click', (event) => {
      if (event.target.hasAttribute('data-cw-drawer-backdrop')) closeDrawer();
      if (event.target.closest('a')) closeDrawer();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();
  });

  window.addEventListener('online', updateConnectionState);
  window.addEventListener('offline', updateConnectionState);
  updateConnectionState();
})();
