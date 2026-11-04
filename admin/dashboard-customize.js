/* BTS Studio — personalización visual del dashboard.
   No modifica cifras, Supabase, publicaciones ni formularios. */
(() => {
  "use strict";
  const $ = (s,root=document)=>root.querySelector(s);
  const root=document.documentElement;
  const sidebar=$("#sidebar");
  const backdrop=document.createElement("div");
  backdrop.className="bts-sidebar-backdrop";
  backdrop.setAttribute("aria-hidden","true");
  if(sidebar){
    sidebar.after(backdrop);
    let wasOpen=false;
    const mobile=window.matchMedia("(max-width:790px)");
    sidebar.querySelectorAll(".nav-item").forEach((el,i)=>el.style.setProperty("--menu-index",String(i)));
    const syncMobile=()=>{
      const now=mobile.matches&&sidebar.classList.contains("open");
      backdrop.classList.toggle("is-visible",now);
      document.body.style.overflow=now?"hidden":"";
      if(now&&!wasOpen)sidebar.querySelector(".bts-sidebar-collapse")?.focus({preventScroll:true});
      wasOpen=now;
    };
    const sidebarObserver=new MutationObserver(syncMobile);
    sidebarObserver.observe(sidebar,{attributes:true,attributeFilter:["class"]});
    backdrop.addEventListener("click",()=>sidebar.classList.remove("open"));
    document.addEventListener("keydown",(e)=>{
      if(e.key==="Escape"&&sidebar.classList.contains("open"))sidebar.classList.remove("open");
    });
    const onMediaChange=()=>{sidebar.classList.remove("open");syncMobile()};
    if(mobile.addEventListener)mobile.addEventListener("change",onMediaChange);
    else mobile.addListener(onMediaChange);
    syncMobile();
  }

  const organizer=$("#kpiOrganize");
  const reset=$("#kpiReset");
  const grid=$("#overviewKpis");
  if(!organizer||!grid||!reset)return;
  const KEY="bts-kpi-order-v1";
  const ID_MAP={
    "Visitantes únicos":"visitors",
    "Vistas de página":"views",
    "Solicitudes registradas":"leads",
    "Clics a WhatsApp":"whatsapp"
  };
  const icon=(path)=>'<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
  const ICONS={
    visitors:icon('<circle cx="9" cy="8" r="3"/><path d="M2.5 20v-2a6.5 6.5 0 0 1 13 0v2M17 5.5a3 3 0 0 1 0 5.5M17 14a5 5 0 0 1 4.5 5v1"/>'),
    views:icon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m9 10 6 3-6 3Z"/>'),
    leads:icon('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
    whatsapp:icon('<path d="M7 18 3 21l1-5a9 9 0 1 1 4 4"/><path d="M9 9c1 3 3 5 6 6l1.5-1.5"/>')
  };
  let editing=false;
  let draggingId=null;
  let longPress=null;
  let touchDragging=false;
  let observer=null;
  const initial=["visitors","views","leads","whatsapp"];
  const read=()=>{
    try {
      const v=JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(v)?[...new Set(v.filter(id=>initial.includes(id))),...initial.filter(id=>!v.includes(id))]:initial.slice();
    }catch{return initial.slice()}
  };
  let order=read();
  const store=()=>{try{localStorage.setItem(KEY,JSON.stringify(order))}catch{}};
  const cards=()=>Array.from(grid.querySelectorAll(":scope > .kpi-card"));
  const idOf=(node)=>{
    const label=node.querySelector(".kpi-label")?.textContent?.trim()||"";
    return ID_MAP[label]||"";
  };
  const resetDrag=()=>{
    draggingId=null;touchDragging=false;
    clearTimeout(longPress);longPress=null;
    cards().forEach(c=>c.classList.remove("is-kpi-dragging","is-kpi-over"));
    grid.classList.remove("bts-kpi-touch-drag");
  };
  const move=(source,target,after=false)=>{
    if(!source||!target||source===target)return;
    const ids=cards().map(x=>x.dataset.kpiId).filter(Boolean);
    const from=ids.indexOf(source),to=ids.indexOf(target);
    if(from<0||to<0)return;
    ids.splice(from,1);ids.splice(to+(after&&from>to?1:after?0:0),0,source);
    // For keyboard and drag interactions, inserting immediately before target is predictable.
    order=[...ids,...initial.filter(x=>!ids.includes(x))];
    store();
    applyOrder();
  };
  function applyOrder(){
    const nodes=cards();
    if(!nodes.length)return;
    const map=new Map(nodes.map(node=>[node.dataset.kpiId,node]));
    const expected=order.map(id=>map.get(id)).filter(Boolean);
    const remaining=nodes.filter(node=>!expected.includes(node));
    const desired=[...expected,...remaining];
    if(desired.every((node,i)=>nodes[i]===node))return;
    observer?.disconnect();
    for(const node of desired)grid.appendChild(node);
    observer?.observe(grid,{childList:true});
  }
  function createControl(dir,id) {
    const b=document.createElement("button");
    b.type="button";
    b.title=dir<0?"Mover a la izquierda / arriba":"Mover a la derecha / abajo";
    b.setAttribute("aria-label",b.title);
    b.innerHTML=dir<0?icon('<path d="m14 6-6 6 6 6"/>'):icon('<path d="m10 6 6 6-6 6"/>');
    b.addEventListener("click",(e)=>{
      e.preventDefault();e.stopPropagation();
      const ids=cards().map(el=>el.dataset.kpiId);
      const n=ids.indexOf(id),j=n+dir;
      if(n<0||j<0||j>=ids.length)return;
      [ids[n],ids[j]]=[ids[j],ids[n]];
      order=ids;store();applyOrder();updateArrows();
    });
    return b;
  }
  function updateArrows() {
    const a=cards();
    for(let i=0;i<a.length;i++){
      const buttons=a[i].querySelectorAll(".bts-kpi-card-controls button");
      if(buttons[0])buttons[0].disabled=i===0;
      if(buttons[1])buttons[1].disabled=i===a.length-1;
    }
  }
  function sync() {
    const nodes=cards();
    if(!nodes.length)return;
    for(const card of nodes){
      const id=idOf(card);
      if(!id)continue;
      card.dataset.kpiId=id;
      const original=card.querySelector(".kpi-icon");
      if(original&&!original.querySelector("svg")&&ICONS[id])original.innerHTML=ICONS[id];
      card.draggable=editing;
      const old=card.querySelector(".bts-kpi-card-controls");
      const caption=card.querySelector(".bts-kpi-drag-label");
      if(!editing){
        old?.remove();caption?.remove();continue;
      }
      if(!old){
        const controls=document.createElement("div");
        controls.className="bts-kpi-card-controls";
        controls.append(createControl(-1,id),createControl(1,id));
        card.appendChild(controls);
        const text=document.createElement("span");
        text.className="bts-kpi-drag-label";
        text.textContent="MOVER";
        card.appendChild(text);
      }
    }
    applyOrder();updateArrows();
  }
  const setEdit=(value)=>{
    editing=value;
    organizer.setAttribute("aria-pressed",String(value));
    organizer.querySelector(".bts-kpi-organize-label").textContent=value?"Terminar":"Organizar KPI";
    reset.hidden=!value;
    grid.classList.toggle("bts-kpi-edit",value);
    resetDrag();sync();
  };
  organizer.addEventListener("click",()=>setEdit(!editing));
  reset.addEventListener("click",()=>{
    order=initial.slice();store();sync();
  });
  // HTML5 drag supports the mouse; arrow buttons provide precise touch & keyboard reordering.
  grid.addEventListener("dragstart",(e)=>{
    const card=e.target.closest(".kpi-card");
    if(!editing||!card||e.target.closest(".bts-kpi-card-controls")){e.preventDefault();return}
    draggingId=card.dataset.kpiId;
    if(!draggingId){e.preventDefault();return}
    e.dataTransfer.effectAllowed="move";
    e.dataTransfer.setData("text/plain",draggingId);
    card.classList.add("is-kpi-dragging");
  });
  grid.addEventListener("dragover",(e)=>{
    if(!editing||!draggingId)return;
    const target=e.target.closest(".kpi-card");
    if(!target||target.dataset.kpiId===draggingId)return;
    e.preventDefault();
    e.dataTransfer.dropEffect="move";
    cards().forEach(c=>c.classList.toggle("is-kpi-over",c===target));
  });
  grid.addEventListener("drop",(e)=>{
    if(!editing||!draggingId)return;
    const target=e.target.closest(".kpi-card");
    if(target){e.preventDefault();move(draggingId,target.dataset.kpiId);updateArrows()}
    resetDrag();
  });
  grid.addEventListener("dragend",resetDrag);
  // Mobile long-press drag; touch buttons remain available as a reliable alternative.
  grid.addEventListener("pointerdown",(e)=>{
    if(!editing||e.pointerType==="mouse"||e.target.closest(".bts-kpi-card-controls"))return;
    const card=e.target.closest(".kpi-card");
    if(!card)return;
    const initialX=e.clientX,initialY=e.clientY;
    const id=card.dataset.kpiId;
    clearTimeout(longPress);
    longPress=setTimeout(()=>{
      draggingId=id;touchDragging=true;
      card.classList.add("is-kpi-dragging");
      grid.classList.add("bts-kpi-touch-drag");
      if(navigator.vibrate)navigator.vibrate(15);
    },350);
    const cancelIfScroll=(ev)=>{
      if(!touchDragging&&Math.hypot(ev.clientX-initialX,ev.clientY-initialY)>10){
        clearTimeout(longPress);longPress=null;
      }
    };
    const end=(ev)=>{
      if(touchDragging&&draggingId){
        const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest(".kpi-card");
        if(target&&grid.contains(target))move(draggingId,target.dataset.kpiId);
      }
      resetDrag();
      document.removeEventListener("pointermove",cancelIfScroll);
      document.removeEventListener("pointerup",end);
      document.removeEventListener("pointercancel",end);
    };
    document.addEventListener("pointermove",cancelIfScroll,{passive:true});
    document.addEventListener("pointerup",end,{once:true});
    document.addEventListener("pointercancel",end,{once:true});
  },{passive:true});
  grid.addEventListener("pointermove",(e)=>{
    if(!touchDragging||!draggingId)return;
    cards().forEach(c=>c.style.pointerEvents=c.dataset.kpiId===draggingId?"none":"");
    const over=document.elementFromPoint(e.clientX,e.clientY)?.closest(".kpi-card");
    cards().forEach(c=>c.classList.toggle("is-kpi-over",over===c&&c.dataset.kpiId!==draggingId));
    cards().forEach(c=>c.style.pointerEvents="");
  },{passive:true});
  observer=new MutationObserver(()=>sync());
  observer.observe(grid,{childList:true});
  sync();
})();
