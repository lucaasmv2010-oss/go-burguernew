(() => {
  "use strict";

  const KEY = "go_burger_theme";
  const LEGACY_KEYS = [
    "burger_admin_v4_theme",
    "burger_client_theme",
    "go_burger_super_theme",
    "go_burger_market_theme"
  ];
  const DARK = "dark";
  const LIGHT = "light";

  const normalize = value => value === DARK ? DARK : value === LIGHT ? LIGHT : null;

  function savedTheme() {
    try {
      const direct = normalize(localStorage.getItem(KEY));
      if (direct) return direct;
      for (const key of LEGACY_KEYS) {
        const legacy = normalize(localStorage.getItem(key));
        if (legacy) {
          localStorage.setItem(KEY, legacy);
          return legacy;
        }
      }
    } catch {}
    return null;
  }

  function systemTheme() {
    try { return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? DARK : LIGHT; }
    catch { return LIGHT; }
  }

  function getTheme() { return savedTheme() || systemTheme(); }

  function updateMeta(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === DARK ? "#17100c" : "#fff7f1");
  }

  function updateControls(theme) {
    const dark = theme === DARK;
    document.querySelectorAll('[data-gb-theme-toggle]').forEach(button => {
      button.setAttribute("aria-pressed", String(dark));
      button.setAttribute("aria-label", dark ? "Ativar modo claro" : "Ativar modo escuro");
      button.title = dark ? "Ativar modo claro" : "Ativar modo escuro";
      const icon = button.querySelector("i");
      if (icon) icon.className = dark ? "fa-regular fa-sun" : "fa-regular fa-moon";
      const text = button.querySelector("[data-gb-theme-label]");
      if (text) text.textContent = dark ? "Modo claro" : "Modo escuro";
    });
  }

  function applyTheme(theme = getTheme(), options = {}) {
    theme = normalize(theme) || systemTheme();
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (document.body) {
      document.body.dataset.theme = theme;
      document.body.classList.toggle("dark", theme === DARK);
      document.body.classList.toggle("light", theme === LIGHT);
    }
    updateMeta(theme);
    updateControls(theme);

    if (options.persist) {
      try {
        localStorage.setItem(KEY, theme);
        LEGACY_KEYS.forEach(key => localStorage.setItem(key, theme));
      } catch {}
    }

    if (options.broadcast !== false) {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type:"go-burger-theme", theme }, location.origin);
        }
        const frame = document.getElementById("appFrame");
        frame?.contentWindow?.postMessage({ type:"go-burger-theme", theme }, location.origin);
      } catch {}
    }

    window.dispatchEvent(new CustomEvent("go-burger-theme-change", { detail:{ theme } }));
    return theme;
  }

  function setTheme(theme) { return applyTheme(theme, { persist:true }); }
  function toggleTheme() { return setTheme(getTheme() === DARK ? LIGHT : DARK); }

  window.GoBurgerTheme = { key:KEY, get:getTheme, apply:applyTheme, set:setTheme, toggle:toggleTheme };

  // Aplica o tema o mais cedo possível para minimizar flash de tema incorreto.
  applyTheme(getTheme(), { broadcast:false });

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(getTheme(), { broadcast:false });
    document.addEventListener("click", event => {
      const button = event.target.closest?.("[data-gb-theme-toggle]");
      if (!button) return;
      event.preventDefault();
      toggleTheme();
    });
  });

  window.addEventListener("storage", event => {
    if (event.key === KEY || LEGACY_KEYS.includes(event.key)) applyTheme(getTheme(), { broadcast:false });
  });

  window.addEventListener("message", event => {
    if (event.origin !== location.origin || event.data?.type !== "go-burger-theme") return;
    const theme = normalize(event.data.theme);
    if (theme) applyTheme(theme, { persist:true, broadcast:false });
  });

  try {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", () => {
      if (!savedTheme()) applyTheme(systemTheme(), { broadcast:false });
    });
  } catch {}
})();
