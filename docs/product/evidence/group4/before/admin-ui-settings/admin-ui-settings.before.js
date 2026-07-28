(function(){
  "use strict";
  const THEMES = ["dark", "mid", "light"];
  const DENSITIES = ["compact", "comfort", "large"];
  function currentTheme(){ return localStorage.getItem("cw_theme") || "dark"; }
  function currentDensity(){ return localStorage.getItem("cw_density") || "comfort"; }
  function mark(){
    document.querySelectorAll("[data-set-theme]").forEach((btn)=>btn.classList.toggle("active", btn.dataset.setTheme === currentTheme()));
    document.querySelectorAll("[data-set-density]").forEach((btn)=>btn.classList.toggle("active", btn.dataset.setDensity === currentDensity()));
  }
  function setTheme(value){ if(!THEMES.includes(value)) return; localStorage.setItem("cw_theme", value); location.reload(); }
  function setDensity(value){ if(!DENSITIES.includes(value)) return; localStorage.setItem("cw_density", value); location.reload(); }
  document.querySelectorAll("[data-set-theme]").forEach((btn)=>btn.addEventListener("click", ()=>setTheme(btn.dataset.setTheme)));
  document.querySelectorAll("[data-set-density]").forEach((btn)=>btn.addEventListener("click", ()=>setDensity(btn.dataset.setDensity)));
  mark();
})();
