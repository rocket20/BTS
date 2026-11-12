/* BTS Studio · tema compartido y navegación para paneles independientes */
(()=>{
 'use strict';
 const storage='bts-admin-theme-v1';
 const valid=mode=>mode==='light'||mode==='dark';
 const root=document.documentElement;
 const page=location.pathname;
 const isBusiness=/\/negocios\//.test(page);
 const isEmbedded=window.self!==window.top||new URLSearchParams(location.search).get('embed')==='1';
 let current='dark';
 function read(){try{const v=localStorage.getItem(storage);return valid(v)?v:'dark'}catch{return 'dark'}}
 function apply(mode){
  current=valid(mode)?mode:'dark';
  root.setAttribute('data-bts-theme',current);
  root.style.colorScheme=current;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=current==='light'?'#f8f6f9':'#101116';
  for(const toggle of document.querySelectorAll('.bts-mode-toggle')){
   const next=current==='light'?'oscuro':'claro';
   toggle.textContent=current==='light'?'☾ Modo oscuro':'☀ Modo claro';
   toggle.setAttribute('aria-label','Cambiar a modo '+next);
   toggle.setAttribute('aria-pressed',String(current==='light'));
  }
 }
 function toggle(){
  const mode=current==='dark'?'light':'dark';
  root.classList.add('bts-theme-switching');apply(mode);
  try{localStorage.setItem(storage,mode)}catch{}
  requestAnimationFrame(()=>requestAnimationFrame(()=>root.classList.remove('bts-theme-switching')));
 }
 function create(){
  const wrapper=document.querySelector('main.shell,main.wrap,body > main');
  if(!wrapper)return;
  const bar=document.createElement('div');bar.className='bts-panel-links';
  const brand=document.createElement('span');brand.className='bts-panel-links-brand';brand.textContent=isBusiness?'MI NEGOCIO · BTS':'BTS STUDIO · OPERACIONES';
  const links=document.createElement('nav');links.className='bts-panel-links-list';links.setAttribute('aria-label','Navegación rápida BTS');
  const entries=isBusiness?[['/negocios/','Mi negocio']]:[
   ['/admin/','Dashboard'],['/admin/accesos/','Empresas y tarjetas'],['/admin/erp/','ERP'],['/nfc/recompensas/','Recompensas'],['/nfc/empresas/','NFC corporativo']
  ];
  for(const [url,label] of entries){
   const a=document.createElement('a');a.href=url;a.textContent=label;
   if(page.replace(/index\.html$/,'')===url)a.setAttribute('aria-current','page');
   links.append(a);
  }
  const button=document.createElement('button');button.type='button';button.className='bts-mode-toggle';button.addEventListener('click',toggle);
  bar.append(brand,links,button);wrapper.prepend(bar);
  apply(current);
 }
 apply(read());
 window.addEventListener('storage',e=>{if(e.key===storage)apply(read())});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(!isEmbedded)create()});
 else if(!isEmbedded)create();
})();
