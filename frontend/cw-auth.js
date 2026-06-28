// ======================================================
// CRISTAL WATER ENTERPRISE — V21 FRONTEND CONTINUITY FIX
// Single source of truth for auth/session/navigation stability.
// ======================================================
(function(){
  'use strict';

  const TOKEN_KEY = 'cristalwater_jwt';
  const USER_KEY = 'cristalwater_user';
  const LEGACY_TOKEN_KEY = 'token';
  const LEGACY_USER_KEY = 'user';
  const ADMIN_TOKEN_KEY = 'adminToken';
  const API_ORIGIN_KEY = 'cw_api_origin';
  const PUBLIC_PATHS = new Set(['/', '/login', '/admin-login', '/client-login', '/technician-login', '/splash']);

  function path(){ return String(window.location.pathname || '/').replace(/\\.html$/,'').toLowerCase(); }
  function isPublic(){ return PUBLIC_PATHS.has(path()); }
  function getToken(){ return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || ''; }
  function getUserRaw(){ return localStorage.getItem(USER_KEY) || localStorage.getItem(LEGACY_USER_KEY) || ''; }
  function parseUser(){ try { return JSON.parse(getUserRaw() || '{}') || {}; } catch(e){ return {}; } }
  function validToken(token){ return typeof token === 'string' && token.trim().length >= 8; }
  function isLocalHost(hostname){
    return ['localhost', '127.0.0.1', '::1'].includes(String(hostname || '').toLowerCase());
  }
  function apiOrigin(){
    const configured = String(window.CW_API_ORIGIN || localStorage.getItem(API_ORIGIN_KEY) || '').trim().replace(/\/+$/, '');
    if(configured) return configured;
    if(isLocalHost(location.hostname) && location.port && location.port !== '3002'){
      return `${location.protocol}//${location.hostname}:3002`;
    }
    return '';
  }
  function apiUrl(input){
    const targetOrigin = apiOrigin();
    if(!targetOrigin) return input;
    if(typeof input !== 'string') return input;
    if(input.startsWith('/api/')) return targetOrigin + input;
    if(input.startsWith(location.origin + '/api/')) return targetOrigin + input.slice(location.origin.length);
    return input;
  }

  function persistSession(token, user){
    if(token){
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(LEGACY_TOKEN_KEY, token); // temporary compatibility for legacy modules
      localStorage.setItem(ADMIN_TOKEN_KEY, token);  // temporary compatibility for old admin pages
    }
    if(user){
      const normalized = Object.assign({}, user, { role: String(user.role || '').toUpperCase().trim() });
      localStorage.setItem(USER_KEY, JSON.stringify(normalized));
      localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(normalized)); // temporary compatibility
    }
    window.CristalAuthState = { token: getToken(), user: parseUser(), hydratedAt: Date.now() };
  }

  function clearSession(){
    [TOKEN_KEY, USER_KEY, LEGACY_TOKEN_KEY, LEGACY_USER_KEY, ADMIN_TOKEN_KEY].forEach(k => localStorage.removeItem(k));
    window.CristalAuthState = { token: '', user: null, hydratedAt: Date.now() };
  }

  function hydrate(){
    const token = getToken();
    const user = parseUser();
    if(validToken(token)){ persistSession(token, user); return true; }
    window.CristalAuthState = { token: '', user: null, hydratedAt: Date.now() };
    return false;
  }

  function logout(){
    clearSession();
    if(path() !== '/login') window.location.replace('/login');
  }

  function requireAuth(role){
    if(isPublic()) return true;
    const ok = hydrate();
    if(!ok){ logout(); return false; }
    if(role){
      const user = parseUser();
      const current = String(user.role || '').toUpperCase().trim();
      if(current && current !== String(role).toUpperCase().trim()){ logout(); return false; }
    }
    return true;
  }

  function toast(msg){
    try{
      let el = document.getElementById('cw-v21-toast');
      if(!el){
        el = document.createElement('div');
        el.id = 'cw-v21-toast';
        el.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483647;background:rgba(2,10,24,.92);color:#eaf8ff;border:1px solid rgba(91,213,255,.35);box-shadow:0 18px 45px rgba(0,0,0,.38);border-radius:14px;padding:12px 16px;font:600 13px system-ui,-apple-system,Segoe UI,sans-serif;max-width:88vw;display:none';
        document.body.appendChild(el);
      }
      el.textContent = msg; el.style.display='block';
      clearTimeout(el._t); el._t = setTimeout(()=>{ el.style.display='none'; }, 4200);
    }catch(e){}
  }

  const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  if(nativeFetch && !window.__cristal_fetch_patched){
    window.__cristal_fetch_patched = true;
    window.fetch = async function(input, init){
      init = init || {};
      const headers = new Headers(init.headers || (input && input.headers) || {});
      const token = getToken();
      if(token && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
      init.headers = headers;
      try{
        const res = await nativeFetch(apiUrl(input), init);
        if(res && res.status === 401){ logout(); }
        return res;
      }catch(err){
        toast('Ligação instável. A sessão foi mantida e os dados serão preservados.');
        throw err;
      }
    };
  }

  // Prevent internal anchor clicks from dropping session keys.
  document.addEventListener('click', function(e){
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if(!a) return;
    const href = a.getAttribute('href') || '';
    if(!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    hydrate();
  }, true);

  window.CristalAuth = { TOKEN_KEY, USER_KEY, API_ORIGIN_KEY, getToken, parseUser, persistSession, clearSession, logout, hydrate, requireAuth, toast, apiOrigin, apiUrl };
  hydrate();
})();
