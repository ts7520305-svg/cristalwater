(function () {
  'use strict';
  const $ = id => document.getElementById(id), panel = $('appearance'), engine = window.CWNavigationPreferences, copies = window.CWAppearanceCopy;
  let language = 'pt', snapshot, baseRaw = null, draft, dirty = false, state = 'loading', suspended = false, writing = false;
  const t = key => copies[language][key] || key;
  function urlLanguage() { const values = new URL(location.href).searchParams.getAll('lang'); language = values.length === 1 && Object.hasOwn(copies, values[0]) ? values[0] : 'pt'; }
  function read() { return {theme:$('preferenceTheme').value, density:$('preferenceDensity').value}; }
  function fact(label, value) { const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = t(label); dd.textContent = t(value || 'empty'); row.append(dt,dd); $('savedAppearance').append(row); }
  function render() {
    document.documentElement.lang = language; document.title = t('title') + ' · Cristal Water';
    panel.querySelectorAll('[data-appearance-copy]').forEach(el=>el.textContent=t(el.dataset.appearanceCopy)); $('appearanceLanguage').value = language;
    panel.querySelectorAll('[data-destination]').forEach(a=>{const url=new URL(a.dataset.destination,location.origin);url.searchParams.set('lang',language);a.href=url.pathname+url.search;});
    panel.dataset.state = state; $('appearanceStatus').dataset.state = state; $('appearanceStatus').textContent = t(state);
    const editable = !suspended && !['loading','session','storage','corrupt','conflict'].includes(state);
    $('preferenceTheme').value = suspended || state === 'session' ? '' : draft?.theme || ''; $('preferenceDensity').value = suspended || state === 'session' ? '' : draft?.density || '';
    $('preferenceTheme').disabled = !editable; $('preferenceDensity').disabled = !editable; $('savePreferences').disabled = !editable || !dirty;
    $('loadPreferences').disabled = suspended || state === 'session'; $('resetPreferences').disabled = !editable || snapshot?.raw === null;
    $('appearanceLogin').hidden = state !== 'session'; $('legacyAppearance').hidden = !snapshot?.legacy || state === 'session';
    const preview = $('appearancePreview'); preview.hidden = suspended || !draft || state === 'session'; preview.setAttribute('aria-label',t('preview'));
    preview.dataset.theme = draft?.theme === 'system' ? snapshot?.deviceTheme || 'light' : draft?.theme || 'light'; preview.dataset.density = draft?.density || 'comfort';
    $('savedAppearance').replaceChildren(); if (!suspended && state !== 'session') { fact('theme',snapshot?.preferences?.theme); fact('density',snapshot?.preferences?.density); fact('device',snapshot?.deviceTheme); }
  }
  function receive(next, force = false) {
    snapshot = next;
    if (state === 'session' || next.status === 'session') { state = 'session'; draft = null; dirty = false; }
    else if (['corrupt','storage'].includes(next.status)) state = next.status;
    else if (dirty && !force && next.raw !== baseRaw) state = 'conflict';
    else if (!dirty || force) { baseRaw = next.raw; draft = next.preferences ? {...next.preferences} : null; dirty = false; state = next.status; }
    render();
  }
  function edit() { if(['loading','session','storage','corrupt','conflict'].includes(state)||suspended)return; draft = read(); dirty = JSON.stringify(draft) !== JSON.stringify(snapshot?.preferences); state = dirty ? 'dirty' : snapshot.status; render(); }
  $('appearanceForm').addEventListener('submit', event=>{
    event.preventDefault(); if ($('savePreferences').disabled || !engine) return;
    writing = true; const result = engine.save(draft,baseRaw); writing = false;
    if (result.ok) { receive(result.snapshot,true); state='saved';render(); } else { state=result.code;render(); }
  });
  $('preferenceTheme').addEventListener('change',edit); $('preferenceDensity').addEventListener('change',edit);
  $('loadPreferences').addEventListener('click',()=>{if(engine)receive(engine.reload(),true);});
  $('resetPreferences').addEventListener('click',()=>{
    if ($('resetPreferences').disabled || !engine) return; writing=true; const result=engine.reset(baseRaw); writing=false;
    if(result.ok)receive(result.snapshot,true);else{state=result.code;render();}
  });
  $('appearanceLanguage').addEventListener('change',()=>{language=$('appearanceLanguage').value;const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);render();});
  window.addEventListener('cw:navigation-preferences',event=>{if(!writing)receive(event.detail);});
  window.addEventListener('pagehide',()=>{suspended=true;render();});
  window.addEventListener('pageshow',()=>{suspended=false;urlLanguage();if(engine)receive(engine.snapshot());else render();});
  for(const id of ['appearanceStatus','savedAppearance'])$(id).dataset.cwStateManaged='manual';
  urlLanguage();if(engine)receive(engine.snapshot(),true);else{state='storage';render();}
}());
