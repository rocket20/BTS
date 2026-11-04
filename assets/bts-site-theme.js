/* BTS Studio: public light / burgundy and dark theme toggle.
   Presentation only. Does not touch Supabase, quotes, content or the admin CMS. */
(() => {
  "use strict";
  const root = document.documentElement;
  const KEY = "bts-public-theme-v1";
  const DASHBOARD_KEY = "bts-admin-theme-v1";
  const button = document.getElementById("btsSiteThemeToggle");
  const meta = document.querySelector('meta[name="theme-color"]');
  const valid = s => s === "light" || s === "dark";
  const read = k => {
    try { return localStorage.getItem(k); } catch { return null; }
  };
  const save = (k,v) => {
    try { localStorage.setItem(k,v); } catch {}
  };
  function apply(mode) {
    root.setAttribute("data-bts-site-theme", mode);
    if (meta) meta.setAttribute("content",mode==="light" ? "#ffffff" : "#080b0f");
    if (button) {
      const next=mode==="light" ? "oscuro" : "claro";
      button.title="Cambiar a modo "+next;
      button.setAttribute("aria-label","Cambiar a modo "+next);
      button.setAttribute("aria-pressed",String(mode==="light"));
      const label=button.querySelector(".bts-theme-label");
      if (label) label.textContent="Modo "+next;
    }
  }
  const existing=root.getAttribute("data-bts-site-theme");
  let current=valid(existing) ? existing : (valid(read(KEY)) ? read(KEY) : (valid(read(DASHBOARD_KEY)) ? read(DASHBOARD_KEY) : "dark"));
  apply(current);
  button?.addEventListener("click",()=>{
    current=root.getAttribute("data-bts-site-theme")==="dark" ? "light" : "dark";
    apply(current);
    save(KEY,current);
    // Keep the public site separate from the dashboard after the initial default.
  });
  // If a second tab switches the public site theme, keep the UI in sync.
  window.addEventListener("storage", event=>{
    if(event.key===KEY && valid(event.newValue))apply(event.newValue);
  });
})();
