/* BTS Studio — collapsible glass navigation, presentation only.
   The dashboard's existing page handlers and integrations are unchanged. */
(() => {
  "use strict";
  const KEY = "bts-sidebar-collapsed-v1";
  const root = document.documentElement;
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("sidebarCollapse");
  const nav = sidebar?.querySelector("nav");
  const mobile = window.matchMedia("(max-width: 790px)");
  if (!sidebar || !toggle || !nav) return;
  function initial() {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  }
  function save(collapsed) {
    try { localStorage.setItem(KEY, collapsed ? "1" : "0"); } catch {}
  }
  function apply(collapsed) {
    root.classList.toggle("bts-sidebar-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Expandir menú lateral" : "Contraer menú lateral");
    toggle.title = collapsed ? "Expandir menú" : "Contraer menú";
  }
  apply(initial());
  toggle.addEventListener("click", () => {
    if (mobile.matches) {
      sidebar.classList.remove("open");
      return;
    }
    const next = !root.classList.contains("bts-sidebar-collapsed");
    apply(next);
    save(next);
  });
  for (const item of nav.querySelectorAll("button[data-page]")) {
    // Names remain visible to assistive technology in the compact state.
    const label = item.querySelector(".nav-text")?.textContent?.trim() || item.getAttribute("title") || "";
    if (label) {
      item.setAttribute("aria-label", label);
      item.title = label;
    }
    item.addEventListener("click", () => {
      if (mobile.matches) sidebar.classList.remove("open");
    });
  }
})();
