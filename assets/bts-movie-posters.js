/* BTS Studio — accessible movie-poster carousel controls.
 * Adds desktop drag-to-scroll and keyboard navigation.
 * Touch devices keep natural momentum scrolling. Never changes CMS records.
 */
(() => {
  "use strict";
  const init = () => {
    const rail = document.getElementById("projectGrid");
    if (!rail) return;
    rail.tabIndex = 0;
    rail.setAttribute("aria-label","Catálogo de experiencias, desplazamiento horizontal");
    rail.setAttribute("role","region");
    rail.setAttribute("aria-roledescription","carrusel");
    const markImages = () => rail.querySelectorAll("img").forEach(img => {img.draggable=false});
    markImages();
    new MutationObserver(markImages).observe(rail,{childList:true});
    // Preserve native touch/trackpad scrolling. Drag using the mouse on desktop.
    let isPressed=false,startX=0,startScroll=0,moved=false,suppressClick=false;
    let pointerId=null;
    function onMove(event) {
      if (!isPressed || event.pointerId!==pointerId) return;
      const dx=event.clientX-startX;
      if (Math.abs(dx)>5) {
        moved=true;
        rail.classList.add("bts-is-dragging");
      }
      if (!moved) return;
      if (event.cancelable) event.preventDefault();
      rail.scrollLeft=startScroll-dx;
    }
    function finish() {
      if (!isPressed) return;
      isPressed=false;pointerId=null;
      if (moved) {
        suppressClick=true;
        setTimeout(()=>{suppressClick=false},90);
      }
      moved=false;
      rail.classList.remove("bts-is-dragging");
      window.removeEventListener("pointermove",onMove);
      window.removeEventListener("pointerup",finish);
      window.removeEventListener("pointercancel",finish);
    }
    rail.addEventListener("pointerdown",event=>{
      if (event.pointerType!=="mouse" || event.button!==0) return;
      if (event.target.closest("button,a,input,select,textarea"))return;
      isPressed=true;pointerId=event.pointerId;
      startX=event.clientX;startScroll=rail.scrollLeft;moved=false;
      window.addEventListener("pointermove",onMove,{passive:false});
      window.addEventListener("pointerup",finish,{once:true});
      window.addEventListener("pointercancel",finish,{once:true});
    });
    // Stops accidental detail-modal opening after dragging a poster.
    rail.addEventListener("click",event=>{
      if (!suppressClick)return;
      event.preventDefault();event.stopImmediatePropagation();
      suppressClick=false;
    },true);
    // Arrow keys are already handled by bts-web-clean.js; do not scroll twice.

  };
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
