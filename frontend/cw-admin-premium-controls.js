(function () {
  function notifyBeforeNavigation() {
    window.dispatchEvent(new CustomEvent('cw:navigate-away'));
  }

  function openMenuFallback() {
    notifyBeforeNavigation();
    const drawerTrigger = document.querySelector('[data-cw-open-drawer]');
    if (drawerTrigger) {
      drawerTrigger.click();
      return;
    }
    const search = document.getElementById('menuSearch') || document.querySelector('[data-cw-search-input]');
    if (search) {
      search.focus();
      return;
    }
    if (location.pathname !== '/admin-menu') {
      location.href = '/admin-menu';
    }
  }

  function goBack() {
    notifyBeforeNavigation();
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    location.href = '/admin-master-control';
  }

  function goHome() {
    notifyBeforeNavigation();
    location.href = '/admin-master-control';
  }

  document.addEventListener('click', (event) => {
    const actionNode = event.target.closest('[data-cw-action]');
    if (!actionNode) return;

    const action = actionNode.getAttribute('data-cw-action');
    if (action === 'back') {
      event.preventDefault();
      goBack();
      return;
    }

    if (action === 'home') {
      event.preventDefault();
      goHome();
      return;
    }

    if (action === 'menu') {
      event.preventDefault();
      openMenuFallback();
    }
  });
})();
