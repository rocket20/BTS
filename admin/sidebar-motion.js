/* BTS Studio · ambient sidebar lighting. Visual only. */
(() => {
  "use strict";
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarse = window.matchMedia("(pointer: coarse)");
  if (reduced.matches || coarse.matches) return;
  let frame = 0;
  let pending = null;
  sidebar.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const rect = sidebar.getBoundingClientRect();
    pending = [
      Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
    ];
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!pending) return;
      sidebar.style.setProperty("--bts-sidebar-x", pending[0].toFixed(1) + "%");
      sidebar.style.setProperty("--bts-sidebar-y", pending[1].toFixed(1) + "%");
    });
  }, {passive:true});
  sidebar.addEventListener("pointerleave", () => {
    sidebar.style.removeProperty("--bts-sidebar-x");
    sidebar.style.removeProperty("--bts-sidebar-y");
  }, {passive:true});
})();
