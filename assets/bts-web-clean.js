/* BTS Studio · Clean public-site enhancements.
 * Moves (not duplicates) live CMS cards into the hero catalog.
 * Keeps existing quote form nodes, required validation and Supabase handlers.
 * No external dependencies or credentials.
 */
(() => {
  "use strict";
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));
  const start = () => {
    const hero = $(".hero.bts-cinema-home");
    const grid = $("#projectGrid");
    const catalogSlot = $("#btsHeroCatalog");
    const oldExperiences = $("section.experiences");
    if (hero && grid && catalogSlot) {
      const track = $("#btsCatalogTrack");
      const prev = $("#btsCatalogPrev");
      const next = $("#btsCatalogNext");
      const count = $("#btsCatalogCount");
      if (track) {
        track.appendChild(grid); // preserve the same live CMS target and project click listeners
        document.body.classList.add("bts-catalog-mounted");
        if (oldExperiences) {
          oldExperiences.id = "experiencias-archivo";
          oldExperiences.setAttribute("aria-hidden", "true");
        }
        const cards = () => $$(".project:not([hidden])", grid);
        const update = () => {
          const active = cards();
          const firstWidth = active[0]?.getBoundingClientRect().width || 240;
          const idx = Math.round(grid.scrollLeft / (firstWidth + 16)) + 1;
          if (count) count.textContent = active.length ? String(Math.min(idx,active.length)).padStart(2,"0")+" / "+String(active.length).padStart(2,"0") : "00 / 00";
          if (prev) prev.disabled = !active.length || grid.scrollLeft < 6;
          if (next) next.disabled = !active.length || grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 7;
        };
        const scroll = dir => grid.scrollBy({left:dir * Math.max(230,grid.clientWidth * .72),behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
        prev?.addEventListener("click",()=>scroll(-1));
        next?.addEventListener("click",()=>scroll(1));
        grid.addEventListener("scroll",update,{passive:true});
        grid.addEventListener("keydown",event=>{
          if (event.target !== grid) return;
          if (event.key==="ArrowRight" || event.key==="ArrowLeft") {
            event.preventDefault();
            scroll(event.key==="ArrowRight"?1:-1);
          }
        });
        if (window.ResizeObserver) {
          new ResizeObserver(update).observe(grid);
        } else {
          window.addEventListener("resize",update,{passive:true});
        }
        new MutationObserver(update).observe(grid,{childList:true,subtree:false,attributes:true,attributeFilter:["hidden"]});
        update();
        window.addEventListener("load",update,{once:true});
      }
    }
    // A compact quotation that reuses all original field nodes, so calculations,
    // form validation, PDF creation, WhatsApp/email and database submission survive.
    const form = $("#quoteForm");
    if (form && !$("#btsQuoteEssential")) {
      const essential = document.createElement("div");
      essential.className = "bts-quote-essential-grid";
      essential.id = "btsQuoteEssential";
      const details = document.createElement("details");
      details.className = "bts-quote-extra";
      const summary = document.createElement("summary");
      summary.textContent = "Agregar detalles del evento (opcional)";
      summary.setAttribute("aria-label","Agregar detalles opcionales del evento");
      const extraGrid = document.createElement("div");
      extraGrid.className = "bts-quote-optional-grid";
      details.append(summary,extraGrid);
      const move = (ids,target) => {
        for (const id of ids) {
          const input = document.getElementById(id);
          const field = input?.closest(".field");
          if (field && form.contains(field) && !target.contains(field)) target.appendChild(field);
        }
      };
      // Extract nested qContactPref first: the original markup nests that
      // optional field under the phone field.
      move(["qContactPref","qTime","qHours","qPeople","qGoal","qDeliverables",
            "qChannel","quoteExtras","qMustHave","qReference",
            "qCompany","qPhone","qEventName","qMessage"],extraGrid);
      move(["qName","qEmail","qType","qDate","qPlace","qPackage"],essential);
      const firstHeading = $(".form-label",form);
      if (firstHeading) firstHeading.before(essential,details);
      else form.prepend(essential,details);
      // Arrange the concise visible inputs in a logical user-first order.
      const preferred = ["qName","qEmail","qType","qDate","qPlace","qPackage"];
      const byId = new Map($$(".field",essential).map(field=>{
        const input = field.querySelector("[id]");
        return [input?.id,field];
      }));
      for (const id of preferred) {
        const field = byId.get(id);
        if (field) essential.appendChild(field);
      }
      $("#submitQuote")?.replaceChildren(document.createTextNode("Enviar cotización"));
      $("#downloadBrief")?.replaceChildren(document.createTextNode("Descargar brief PDF"));
      $("#sendWhatsapp")?.replaceChildren(document.createTextNode("WhatsApp"));
      $("#sendEmail")?.replaceChildren(document.createTextNode("Enviar correo"));
    }
    // Scroll-position-aware glass tab. The current section is marked without
    // changing page navigation, hash behavior or website content.
    const nav = $("#mainMenu");
    if (nav) {
      const ids = ["inicio","experiencias","servicios","paquetes","estudio","proceso","cotizar","preguntas"];
      const links = $$('a[href^="#"]',nav).filter(a=>ids.includes(a.hash.slice(1)));
      let ticking=false;
      const updateNav=()=>{
        ticking=false;
        const viewportLine=Math.min(innerHeight * .36,270);
        let current="inicio";
        for (const id of ids) {
          const target=$("#"+id);
          if (target && target.getBoundingClientRect().top <= viewportLine) current=id;
        }
        for (const link of links) {
          const active=link.hash==="#"+current;
          link.classList.toggle("bts-nav-current",active);
          if (active) link.setAttribute("aria-current","location");
          else link.removeAttribute("aria-current");
        }
      };
      window.addEventListener("scroll",()=>{if(!ticking){ticking=true;requestAnimationFrame(updateNav)}},{passive:true});
      window.addEventListener("resize",updateNav,{passive:true});
      window.addEventListener("hashchange",updateNav);
      updateNav();
    }
  };
  if (document.readyState==="loading") {
    document.addEventListener("DOMContentLoaded",start,{once:true});
  } else start();
})();
