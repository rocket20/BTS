/* BTS Studio — Opening sequence.
   Uses the original BTS origami mark. No external libraries or data requests.
   Always releases the page; skip and reduced-motion are supported. */
(() => {
  "use strict";
  const loader = document.getElementById("btsIntroLoader");
  if (!loader) return;
  const html = document.documentElement;
  const skip = document.getElementById("btsIntroSkip");
  let closed = false;
  let timeout = null;
  function finish() {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    loader.classList.add("is-dismissing");
    loader.setAttribute("aria-hidden","true");
    html.classList.remove("bts-preloading");
    setTimeout(() => { loader.remove(); }, 950);
  }
  skip?.addEventListener("click", finish, {once:true});
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const admin = location.hash.startsWith("#panel") || location.hash.startsWith("#admin");
  const duration = reduced || admin ? 250 : 3050;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded",()=>{timeout=setTimeout(finish,duration)},{once:true});
  } else {
    timeout=setTimeout(finish,duration);
  }
  // Safety: even if another page script fails, the opening overlay must leave.
  window.addEventListener("load",()=>{if(!closed && !timeout)timeout=setTimeout(finish,duration)},{once:true});
  setTimeout(finish,5200);
})();
