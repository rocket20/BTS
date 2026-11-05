/* BTS Studio | pantalla de carga
   El GIF de 48 fotogramas a 2x conserva su propia animación.
   Solo el contenedor se mueve de lado a lado; el GIF no se transforma.
   La intro conserva su temporización, botón Omitir y salida de seguridad.
*/
(() => {
  "use strict";
  const loader = document.getElementById("btsIntroLoader");
  if (!loader) return;

  const css = document.createElement("style");
  css.id = "bts-colibri-gif-loader-style";
  css.textContent = `
    .bts-loader .bts-loader-orbit {
      animation: bts-colibri-lateral 1.15s ease-in-out infinite alternate !important;
      transform: translate3d(0,0,0);
      will-change: transform;
    }
    .bts-loader .bts-loader-bird {
      position: absolute; left: 50%; top: -41px;
      width: 142px; height: 142px;
      transform: translateX(-50%);
      transform-origin: center;
      filter: none;
    }
    .bts-loader .bts-loader-bird .bts-wing { animation: none !important; }
    .bts-loader .bts-loader-bird img {
      display: block; width: 100%; height: 100%;
      object-fit: contain; image-rendering: auto;
      animation: none !important; transform: none !important;
      pointer-events: none; user-select: none;
    }
    @keyframes bts-colibri-lateral {
      from { transform: translate3d(-106px,0,0); }
      to   { transform: translate3d(106px,0,0); }
    }
    @media (max-width: 600px) {
      .bts-loader .bts-loader-bird { top: -34px; width: 124px; height: 124px; }
      @keyframes bts-colibri-lateral {
        from { transform: translate3d(-68px,0,0); }
        to   { transform: translate3d(68px,0,0); }
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bts-loader .bts-loader-orbit { animation: none !important; }
    }
  `;
  document.head.appendChild(css);

  // Solo sustituye el SVG anterior después de cargar el GIF. Si falta,
  // se conserva estático el logotipo anterior como respaldo visual.
  const bird = loader.querySelector(".bts-loader-bird");
  if (bird) {
    const gif = new Image();
    gif.alt = "";
    gif.setAttribute("aria-hidden", "true");
    gif.draggable = false;
    gif.decoding = "async";
    gif.onload = () => {
      if (loader.isConnected) bird.replaceChildren(gif);
    };
    gif.src = "assets/colibri_origami_vuelo_2x.gif?v=transparente-2x";
  }

  const html = document.documentElement;
  const skip = document.getElementById("btsIntroSkip");
  let closed = false;
  let timeout = null;
  function finish() {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    loader.classList.add("is-dismissing");
    loader.setAttribute("aria-hidden", "true");
    html.classList.remove("bts-preloading");
    setTimeout(() => loader.remove(), 950);
  }
  skip?.addEventListener("click", finish, { once: true });
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const admin = location.hash.startsWith("#panel") || location.hash.startsWith("#admin");
  const duration = reduced || admin ? 250 : 3050;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      timeout = setTimeout(finish, duration);
    }, { once: true });
  } else {
    timeout = setTimeout(finish, duration);
  }
  window.addEventListener("load", () => {
    if (!closed && !timeout) timeout = setTimeout(finish, duration);
  }, { once: true });
  setTimeout(finish, 5200);
})();