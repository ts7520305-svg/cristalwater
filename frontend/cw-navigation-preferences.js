(function (root, factory) {
  'use strict';
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else model.start(root);
}(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const themes = ['system', 'light', 'dark'], densities = ['compact', 'comfort', 'large'];
  const defaults = () => ({theme:'system', density:'comfort'});
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const valid = value => object(value) && Object.keys(value).length === 2 && themes.includes(value.theme) && densities.includes(value.density);
  const positive = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
  const key = owner => 'cw:navigation-preferences:v1:' + owner;
  function record(raw, owner) {
    if (raw === null) return {status:'default', preferences:defaults()};
    try {
      const value = JSON.parse(raw);
      if (!object(value) || Object.keys(value).sort().join(',') !== 'owner,preferences,updatedAt,version' || value.version !== 1 || value.owner !== owner || !valid(value.preferences) || typeof value.updatedAt !== 'string' || new Date(value.updatedAt).toISOString() !== value.updatedAt) throw Error();
      return {status:'ready', preferences:{...value.preferences}};
    } catch (_) { return {status:'corrupt', preferences:null}; }
  }
  function identity(values, decode, now = Date.now()) {
    try {
      const tokens = values.slice(0,3), users = values.slice(3).filter(Boolean).map(JSON.parse), token = tokens.find(Boolean);
      if (!token || tokens.some(t => t && t !== token)) return null;
      const claims = decode(token), id = Number(claims.userId || claims.id);
      if (claims.role !== 'ADMIN' || claims.principalType === 'ENV_ADMIN' || !positive(id) || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now || !users.length || users.some(u => u.role !== 'ADMIN' || Number(u.userId || u.id) !== id)) return null;
      return {owner:'ADMIN:'+id, expires:claims.exp*1000, fingerprint:JSON.stringify([tokens,users.map(u=>[u.role,Number(u.userId||u.id)])])};
    } catch (_) { return null; }
  }
  function effective(preferences, dark) { return preferences.theme === 'system' ? dark ? 'dark' : 'light' : preferences.theme; }
  function start(window) {
    if (window.CWNavigationPreferences) return;
    const document = window.document, storage = window.localStorage, authKeys = ['cristalwater_jwt','token','adminToken','cristalwater_user','user'];
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const capture = () => identity(authKeys.map(k=>storage.getItem(k)), token=>JSON.parse(window.atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))));
    let actor, raw = null, preferences = defaults(), status = 'loading', suspended = false, invalid = false, legacy = false;
    try { actor = capture(); } catch (_) {}
    if (!document.querySelector('link[href="/cw-navigation-preferences.css"]')) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/cw-navigation-preferences.css'; document.head.appendChild(link);
    }
    function snapshot() { return {status, owner:actor?.owner || null, raw, preferences:preferences ? {...preferences} : null, deviceTheme:media.matches?'dark':'light', legacy}; }
    function apply() {
      if (!document.body) return;
      if (invalid || suspended || !preferences || ['corrupt','session','loading'].includes(status)) {
        delete document.body.dataset.cwNavTheme; delete document.body.dataset.cwNavDensity;
      } else {
        document.body.dataset.cwNavTheme = effective(preferences, media.matches);
        document.body.dataset.cwNavDensity = preferences.density;
      }
    }
    function emit() { apply(); window.dispatchEvent(new window.CustomEvent('cw:navigation-preferences', {detail:snapshot()})); }
    function active() {
      let current; try { current = capture(); } catch (_) {}
      if (!invalid && actor && current && actor.fingerprint === current.fingerprint && actor.expires > Date.now()) return true;
      if (!invalid) { invalid = true; status = 'session'; raw = null; preferences = null; emit(); }
      return false;
    }
    function reload() {
      if (!active() || suspended) return snapshot();
      try {
        raw = storage.getItem(key(actor.owner)); const parsed = record(raw, actor.owner);
        preferences = parsed.preferences; status = parsed.status;
        legacy = ['cw_theme','cw_density'].some(k=>storage.getItem(k)!==null);
      } catch (_) { status = 'storage'; }
      emit(); return snapshot();
    }
    function write(next, expectedRaw, remove = false) {
      if (!active() || suspended) return {ok:false, code:'session'};
      if (!remove && !valid(next)) return {ok:false, code:'invalid'};
      try {
        const before = storage.getItem(key(actor.owner));
        if (before !== expectedRaw) { reload(); return {ok:false, code:'conflict'}; }
        if (record(before, actor.owner).status === 'corrupt') return {ok:false, code:'corrupt'};
        const after = remove ? null : JSON.stringify({version:1, owner:actor.owner, preferences:next, updatedAt:new Date().toISOString()});
        if (remove) storage.removeItem(key(actor.owner)); else storage.setItem(key(actor.owner), after);
        if (storage.getItem(key(actor.owner)) !== after) throw Error();
        reload(); return {ok:true, snapshot:snapshot()};
      } catch (_) { status = 'storage'; emit(); return {ok:false, code:'storage'}; }
    }
    window.CWNavigationPreferences = Object.freeze({snapshot, reload, save:(next, expectedRaw)=>write(next, expectedRaw), reset:expectedRaw=>write(defaults(), expectedRaw, true), defaults});
    window.addEventListener('storage', e=>{if (active() && (e.key === null || e.key === key(actor.owner))) reload();});
    window.addEventListener('focus', ()=>{if(active()) reload();});
    document.addEventListener('visibilitychange', ()=>{if(!document.hidden && active()) reload();});
    window.addEventListener('pagehide', ()=>{suspended=true;apply();});
    window.addEventListener('pageshow', ()=>{suspended=false;reload();});
    window.addEventListener('cw:navigation-ready', apply);
    media.addEventListener('change', ()=>{if(active()) emit();});
    window.setInterval(active, 1000);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reload); else reload();
  }
  return {themes,densities,defaults,valid,key,record,identity,effective,start};
}));
