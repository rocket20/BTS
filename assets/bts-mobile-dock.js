/* BTS Studio: menú glass inferior solo al desplazarse hacia abajo en móvil/tablet. */
(() => {
  'use strict';
  function init(){
    const header=document.getElementById('siteHeader');
    if(!header||!document.getElementById('mainMenu')||document.getElementById('btsMobileDock'))return;
    const mq=matchMedia('(max-width:1024px)');
    const svg=d=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>';
    const icon={
      home:svg('<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>'),
      services:svg('<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-10 0v2h2v-2"/>'),
      experiences:svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 5l4 5m3-5 4 5"/><path d="m10 13 5 3-5 3z"/>'),
      quote:svg('<path d="M4 4h16v12H7l-3 4z"/><path d="M8 9h8m-8 4h5"/>'),
      menu:svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
      packages:svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16m-8-6v16"/>'),
      studio:svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'),
      process:svg('<path d="M5 6h14M5 12h14M5 18h14"/>'),
      faq:svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.4 1.6c-.9.9-1.9 1.2-1.9 3M12 17.5h.01"/>'),
      contact:svg('<path d="M3 6h18v12H3zM3 6l9 7 9-7"/>')
    };
    const primary=[
      ['Inicio','#inicio','home'],['Servicios','#servicios','services'],
      ['Experiencias','#experiencias','experiences'],['Cotizar','#cotizar','quote']
    ];
    const extra=[
      ['Paquetes','#paquetes','packages'],['Estudio','#estudio','studio'],
      ['Proceso','#proceso','process'],['Preguntas','#preguntas','faq'],
      ['Contacto','#contacto','contact']
    ];
    const dock=document.createElement('nav');
    dock.id='btsMobileDock';dock.className='bts-mobile-dock';
    dock.setAttribute('aria-label','Navegación móvil BTS Studio');
    dock.setAttribute('aria-hidden','true');dock.inert=true;
    const sheet=document.createElement('div');
    sheet.id='btsDockSheet';sheet.className='bts-dock-sheet';sheet.hidden=true;
    function makeLink(item,klass){
      const a=document.createElement('a');a.href=item[1];a.className=klass;
      a.innerHTML=icon[item[2]]+'<span>'+item[0]+'</span>';return a;
    }
    extra.forEach(item=>sheet.appendChild(makeLink(item,'')));
    dock.appendChild(sheet);
    primary.forEach(item=>dock.appendChild(makeLink(item,'bts-dock-tab')));
    const more=document.createElement('button');
    more.type='button';more.className='bts-dock-tab';
    more.setAttribute('aria-label','Más secciones');
    more.setAttribute('aria-controls','btsDockSheet');
    more.setAttribute('aria-expanded','false');
    more.innerHTML=icon.menu+'<span>Más</span>';dock.appendChild(more);
    document.body.appendChild(dock);
    const closeSheet=()=>{sheet.hidden=true;more.setAttribute('aria-expanded','false');updateActive();};
    more.addEventListener('click',()=>{
      const open=sheet.hidden;sheet.hidden=!open;
      more.setAttribute('aria-expanded',String(open));updateActive();
    });
    dock.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeSheet));
    document.addEventListener('pointerdown',e=>{if(!sheet.hidden&&!dock.contains(e.target))closeSheet();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sheet.hidden){closeSheet();more.focus();}});
    let visible=false;
    function showDock(next){
      if(visible===next)return;
      visible=next;document.body.classList.toggle('bts-dock-visible',next);
      dock.setAttribute('aria-hidden',String(!next));dock.inert=!next;
      if(!next)closeSheet();
      if(next){
        const menuBtn=document.getElementById('menuBtn');
        if(menuBtn?.getAttribute('aria-expanded')==='true')menuBtn.click();
      }
    }
    const blocked=()=>!mq.matches||document.body.classList.contains('bts-admin-open')||
      document.body.classList.contains('modal-open');
    let lastY=Math.max(window.scrollY,0),pending=false;
    function scrollUpdate(){
      pending=false;const y=Math.max(window.scrollY,0),dy=y-lastY;
      if(blocked()||y<85){showDock(false);lastY=y;return;}
      if(dy>7&&y>110){showDock(true);lastY=y;}
      else if(dy< -7){showDock(false);lastY=y;}
    }
    window.addEventListener('scroll',()=>{
      if(!pending){pending=true;requestAnimationFrame(scrollUpdate);}
    },{passive:true});
    const reset=()=>{showDock(false);lastY=Math.max(window.scrollY,0);updateActive();};
    window.addEventListener('resize',reset,{passive:true});
    mq.addEventListener?.('change',reset);
    window.addEventListener('hashchange',()=>{
      closeSheet();if(location.hash==='#panel-bts')showDock(false);updateActive();
    });
    document.addEventListener('focusin',e=>{
      if(e.target.matches?.('input,select,textarea,[contenteditable="true"]')){
        document.body.classList.add('bts-dock-keyboard');closeSheet();
      }
    });
    document.addEventListener('focusout',e=>{
      if(e.target.matches?.('input,select,textarea,[contenteditable="true"]')){
        document.body.classList.remove('bts-dock-keyboard');
      }
    });
    const ids=['inicio','experiencias','servicios','paquetes','estudio','proceso','cotizar','preguntas','contacto'];
    function updateActive(){
      let current='inicio';
      for(const id of ids){
        const el=document.getElementById(id);
        if(el&&el.getBoundingClientRect().top<=Math.min(innerHeight*.38,270))current=id;
      }
      dock.querySelectorAll('a[href^="#"]').forEach(a=>{
        const yes=a.hash==='#'+current;
        a.classList.toggle('is-current',yes);
        if(yes)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');
      });
      more.classList.toggle('is-current',extra.some(x=>x[1]==='#'+current)||!sheet.hidden);
    }
    let activePending=false;
    window.addEventListener('scroll',()=>{
      if(!activePending){activePending=true;requestAnimationFrame(()=>{activePending=false;updateActive();});}
    },{passive:true});
    updateActive();scrollUpdate();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();