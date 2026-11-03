/* BTS Studio: CMS bridge + optional Google Analytics 4. No private visitor data stored here. */
(() => {
  'use strict';
  const DATA_URL = new URL('../../data/bts-content.json', document.currentScript?.src || location.href);
  const byId = id => document.getElementById(id);
  const safeUrl = value => {
    try { const u = new URL(value, location.href); return ['https:','http:'].includes(u.protocol) ? u.href : ''; }
    catch { return ''; }
  };
  const imgUrl = value => {
    if (!value) return '';
    if (/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(value)) return value;
    if (/^(?:assets\/uploads\/|https:\/\/)/.test(value)) return value;
    return '';
  };
  window.BTSMetric = (name) => {
    if (typeof window.gtag === 'function') window.gtag('event', 'bts_'+name, {section:'web',method:'site'});
  };
  const css = (tag, cls, text) => { const el=document.createElement(tag);if(cls) el.className=cls;if(text)el.textContent=text;return el; };
  function applyBrand(c) {
    const b=c.brand || {};
    if(b.heroTitle) { const h=document.querySelector('.hero-copy h1');if(h){h.textContent=b.heroTitle;h.style.whiteSpace='pre-line';} }
    if(b.heroSubtitle) { const h=document.querySelector('.hero-lead');if(h) h.textContent=b.heroSubtitle; }
    if(window.BTS_CONFIG){
      window.BTS_CONFIG.whatsapp = b.whatsapp || window.BTS_CONFIG.whatsapp;
      window.BTS_CONFIG.email = b.contactEmail || window.BTS_CONFIG.email;
      window.BTS_CONFIG.instagram = b.instagram || window.BTS_CONFIG.instagram;
    }
    const email=byId('publicEmail'), phone=byId('publicPhone');
    if(email&&b.contactEmail) email.textContent=b.contactEmail;
    if(phone&&b.whatsapp) phone.textContent='+'+b.whatsapp.replace(/\D/g,'');
  }
  function showBrands(brands) {
    const visible=(brands||[]).filter(x=>x.active!==false && x.name);
    const anchor=document.querySelector('#paquetes');
    if(!anchor||!visible.length)return;
    const section=css('section','bts-partners'); section.id='marcas';
    const wrap=css('div','wrap');
    wrap.append(css('span','bts-partners-eyebrow','MARCAS QUE CONFÍAN EN NOSOTROS'));
    const rail=css('div','bts-partners-rail');
    visible.forEach(b=>{
      const a=css(b.website?'a':'div','bts-partner');
      if(b.website){const url=safeUrl(b.website);if(url){a.href=url;a.target='_blank';a.rel='noopener noreferrer';}}
      const image=imgUrl(b.image); if(image){const pic=css('img','');pic.src=image;pic.alt=b.name;pic.loading='lazy';a.append(pic);}else a.append(css('span','',b.name));
      rail.append(a);
    });
    wrap.append(rail);section.append(wrap);anchor.parentNode.insertBefore(section,anchor);
  }
  function showEvents(events){
    const visible=(events||[]).filter(x=>x.active!==false && x.title);
    const grid=byId('projectGrid');if(!grid||!visible.length)return;
    grid.replaceChildren();
    visible.forEach((e,i)=>{
      const art=css('article','project reveal visible'+(i===0?' wide':''));
      art.tabIndex=0;art.role='button';art.dataset.category=e.category||'eventos';art.dataset.title=e.title;art.dataset.description=e.description||'';
      const image=imgUrl(e.image);
      if(image){const pic=css('img','');pic.src=image;pic.alt=e.title;pic.loading='lazy';art.append(pic);}
      else art.classList.add('bts-empty-cover');
      const meta=css('div','project-meta');
      meta.append(css('span','project-type',e.category||'Evento'));
      meta.append(css('h3','',e.title));
      art.append(meta);
      const open=()=>{const m=byId('projectModal');const im=byId('modalImage');if(!m||!im)return;im.src=image||'';im.alt=e.title;byId('modalTitle').textContent=e.title;byId('modalDescription').textContent=e.description||'';m.querySelector('.bts-gallery-thumbs')?.remove();const gallery=[image,...(e.gallery||[]).map(imgUrl)].filter(Boolean);if(gallery.length>1){const thumbs=css('div','bts-gallery-thumbs');gallery.forEach((src,i)=>{const btn=css('button','bts-gallery-thumb'+(i===0?' selected':''));btn.type='button';btn.setAttribute('aria-label','Ver fotografía '+(i+1));const thumb=css('img','');thumb.src=src;thumb.alt=e.title+' — '+(i+1);btn.append(thumb);btn.addEventListener('click',()=>{im.src=src;thumbs.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');});thumbs.append(btn);});byId('modalDescription').after(thumbs);}m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');byId('modalClose')?.focus();window.BTSMetric?.('project_view');};
      art.addEventListener('click',open);art.addEventListener('keydown',ev=>{if(['Enter',' '].includes(ev.key)){ev.preventDefault();open();}});
      grid.append(art);
    });
    const first=document.querySelector('[data-filter="todos"]');first?.click();
  }
  function showPackages(packs) {
    const articles=Array.from(document.querySelectorAll('.packages-grid article.package'));
    (packs||[]).filter(p=>p.active!==false).slice(0,articles.length).forEach((p,i)=>{
      const card=articles[i];
      const title=card.querySelector('h3'),summary=card.querySelector('.package-summary'),ul=card.querySelector('ul'),btn=card.querySelector('[data-choose-package]');
      if(title)title.textContent=p.title+'.';if(summary)summary.textContent=p.description;
      if(ul&&Array.isArray(p.features)){ul.replaceChildren(...p.features.map(x=>css('li','',x)));}
      if(btn){btn.textContent='Elegir '+p.title+' ↗';}
    });
  }
  function showServices(services){
    const cards=Array.from(document.querySelectorAll('.services-grid .service-card'));
    (services||[]).slice(0,cards.length).forEach((service,i)=>{
      if(!service || service.active===false)return;
      const h=cards[i].querySelector('h3'),p=cards[i].querySelector('p');
      if(h)h.textContent=service.title||''; if(p)p.textContent=service.description||'';
    });
  }
  function setupAnalytics(analyticsId) {
    const id=(analyticsId||'').trim();if(!/^G-[A-Z0-9]{5,20}$/.test(id))return;
    const s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);document.head.append(s);
    window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};
    window.gtag('js', new Date());window.gtag('config',id,{send_page_view:true});
  }
  fetch(DATA_URL.href+'?t='+Date.now(),{cache:'no-store'})
    .then(r=>{if(!r.ok)throw Error('CMS not found');return r.json();})
    .then(data=>{applyBrand(data);showBrands(data.brands);showEvents(data.events);showPackages(data.packages);showServices(data.services);setupAnalytics(data.brand?.analyticsId);})
    .catch(()=>{ /* The original self-contained website remains operational offline. */ });
})();
