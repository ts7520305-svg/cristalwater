(function () {
  'use strict';
  const help = window.CristalHelp;
  if (!help) return;
  const search = document.getElementById('search'), box = document.getElementById('topics'), detail = document.getElementById('detail');
  let selected = new URLSearchParams(location.search).get('topic') || 'help';
  const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  function render() {
    const words = help.words(), topics = help.topics(), valid = Boolean(help.session());
    document.getElementById('helpTitle').textContent = words.title;
    document.getElementById('helpIntro').textContent = words.intro;
    document.getElementById('searchLabel').textContent = words.search;
    search.placeholder = words.search; search.disabled = !valid;
    const status = document.getElementById('helpStatus');
    const found = Object.hasOwn(topics, selected) && selected !== 'default';
    status.textContent = !valid ? words.session : found ? '' : words.unavailable;
    status.dataset.state = !valid ? 'session' : found ? 'ready' : 'unavailable';
    const active = found ? topics[selected].aliasFor || selected : 'help', query = fold(search.value);
    const entries = Object.entries(topics).filter(([key, topic]) => key !== 'default' && !topic.aliasFor && (!query || fold(`${topic.title} ${topic.summary} ${topic.detail} ${(topic.actions || []).join(' ')}`).includes(query)));
    box.innerHTML = entries.map(([key, topic]) => `<button type="button" class="topic ${key === active ? 'active' : ''}" data-topic="${escapeHtml(key)}" aria-pressed="${key === active}"><strong>${escapeHtml(topic.title)}</strong><small>${escapeHtml(topic.summary)}</small></button>`).join('');
    const empty = document.getElementById('emptyTopics'); empty.textContent = words.empty; empty.hidden = !valid || entries.length > 0;
    box.querySelectorAll('[data-topic]').forEach(button => button.addEventListener('click', () => {
      selected = button.dataset.topic;
      history.replaceState(null, '', '/help-center?topic=' + encodeURIComponent(selected)); render();
      if (innerWidth <= 860) { detail.focus({ preventScroll: true }); detail.scrollIntoView({ block: 'start' }); }
    }));
    document.getElementById('helpActions').innerHTML = help.actions().filter(action => action.topic !== 'help').slice(0, 5).map(action => `<a href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`).join('');
    const topic = topics[active];
    detail.innerHTML = !valid || !topic ? '' : `<h2>${escapeHtml(topic.title)}</h2><p>${escapeHtml(topic.summary)}</p><p>${escapeHtml(topic.detail)}</p>${topic.actions?.length ? `<h3>${escapeHtml(words.actions)}</h3><ul>${topic.actions.map(action => `<li>${escapeHtml(action)}</li>`).join('')}</ul>` : ''}${topic.href && topic.href !== '/help-center' ? `<a href="${escapeHtml(topic.href)}">${escapeHtml(words.open)}</a>` : ''}`;
  }
  search.addEventListener('input', render);
  window.addEventListener('cw-language-change', render);
  window.addEventListener('storage', render);
  window.addEventListener('pageshow', render);
  window.addEventListener('popstate', () => { selected = new URLSearchParams(location.search).get('topic') || 'help'; render(); });
  render();
})();
