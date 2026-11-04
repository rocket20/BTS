/* BTS Studio — visual theme only. Does not touch CMS, KPIs, GitHub or Supabase. */
(() => {
  "use strict";
  const KEY = "bts-admin-theme-v1";
  const root = document.documentElement;
  const button = document.getElementById("btsThemeToggle");
  const meta = document.querySelector('meta[name="theme-color"]');
  const isValid = (s) => s === "light" || s === "dark";
  function stored() {
    try { const v = localStorage.getItem(KEY); return isValid(v) ? v : null; }
    catch { return null; }
  }
  function save(mode) { try { localStorage.setItem(KEY, mode); } catch {} }
  function apply(mode) {
    root.setAttribute("data-bts-theme", mode);
    root.style.colorScheme = mode;
    if (meta) meta.setAttribute("content", mode === "light" ? "#ffffff" : "#08080d");
    if (button) {
      const next = mode === "light" ? "oscuro" : "claro";
      button.setAttribute("aria-label", "Cambiar a modo " + next);
      button.setAttribute("title", "Cambiar a modo " + next);
      button.setAttribute("aria-pressed", String(mode === "light"));
      const icon = button.querySelector(".theme-icon");
      const label = button.querySelector(".theme-label");
      if (icon) { const use=icon.querySelector("use"); if(use)use.setAttribute("href","icons/lucide-ui.svg#"+(mode==="light"?"moon":"sun")); }
      if (label) label.textContent = "Modo " + next;
    }
  }
  apply(stored() || "dark");
  if (button) button.addEventListener("click", () => {
    const mode = root.getAttribute("data-bts-theme") === "dark" ? "light" : "dark";
    root.classList.add("bts-theme-switching");
    // One atomic style update. Suppress expensive nested transitions while
    // the theme changes; fade only the composite layer very briefly.
    apply(mode);
    save(mode);
    clearTimeout(window.__btsThemeSwitchTimeout);
    window.__btsThemeSwitchTimeout = setTimeout(() => {
      root.classList.remove("bts-theme-switching");
    }, 220);
  });
})();
