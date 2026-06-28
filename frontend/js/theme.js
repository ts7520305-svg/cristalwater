// ======================================================
// CRISTAL WATER THEME
// ======================================================

const THEME_KEY =
  "cristalwater_theme";

// ======================================================
// GET THEME
// ======================================================

function getTheme(){

  return localStorage.getItem(
    THEME_KEY
  ) || "light";
}

// ======================================================
// APPLY THEME
// ======================================================

function applyTheme(theme){

  document.documentElement.setAttribute(
    "data-theme",
    theme
  );

  localStorage.setItem(
    THEME_KEY,
    theme
  );

  const btn =
    document.getElementById(
      "themeToggle"
    );

  if (btn){

    btn.innerText =
      theme === "dark"
        ? "☀️ Modo Claro"
        : "🌙 Modo Escuro";
  }
}

// ======================================================
// TOGGLE THEME
// ======================================================

function toggleTheme(){

  const current =
    getTheme();

  const next =
    current === "dark"
      ? "light"
      : "dark";

  applyTheme(next);
}

// ======================================================
// INIT
// ======================================================

function initTheme(){

  applyTheme(
    getTheme()
  );
}

initTheme();