/* BTS Studio — kinetic editorial homepage (presentation only).
   No external libraries. Uses the existing BTS visual assets and original CTA links. */
(() => {
  "use strict";
  const start = () => {
    const hero = document.querySelector(".hero.bts-cinema-home");
    if (!hero) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    hero.classList.add("bts-cinema-animate");
    let played = false;
    const play = () => {
      if (played) return;
      played = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        hero.classList.add("bts-cinema-ready");
      }));
    };
    const loader = document.getElementById("btsIntroLoader");
    if (loader && !loader.classList.contains("is-dismissing")) {
      const watcher = new MutationObserver(() => {
        if (loader.classList.contains("is-dismissing")) {
          watcher.disconnect();
          setTimeout(play, 240);
        }
      });
      watcher.observe(loader, {attributes:true,attributeFilter:["class"]});
      // Recovery in case the intro is removed unexpectedly.
      setTimeout(() => {watcher.disconnect();play();}, 5600);
    } else {
      play();
    }
    const mouse = window.matchMedia("(hover:hover) and (pointer:fine)");
    if (!mouse.matches) return;
    let raf = 0, x = 64, y = 40;
    hero.addEventListener("pointermove", event => {
      const bounds = hero.getBoundingClientRect();
      x = Math.max(0,Math.min(100,(event.clientX-bounds.left)/bounds.width*100));
      y = Math.max(0,Math.min(100,(event.clientY-bounds.top)/bounds.height*100));
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        hero.style.setProperty("--bts-pointer-x", x.toFixed(1)+"%");
        hero.style.setProperty("--bts-pointer-y", y.toFixed(1)+"%");
      });
    }, {passive:true});
    hero.addEventListener("pointerleave", () => {
      hero.style.removeProperty("--bts-pointer-x");
      hero.style.removeProperty("--bts-pointer-y");
    }, {passive:true});
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {once:true});
  } else {
    start();
  }
})();
